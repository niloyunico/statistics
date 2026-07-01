/* Data layer. Backed by MongoDB Atlas when MONGODB_URI is set; otherwise an
   in-memory store (NOT persistent) so you can run/test without a database.
   Two collections:
     users   — login accounts (bcrypt-hashed passwords)
     appdata — a single shared document holding the whole app state snapshot
   The connection string lives ONLY here on the server. */
const bcrypt = require('bcryptjs');

// Many ISP/home-router DNS resolvers can't perform the SRV lookups that
// mongodb+srv:// needs (the classic "querySrv ECONNREFUSED" error). Force a
// public DNS for the driver's SRV/TXT resolution so Atlas works anywhere.
try { require('dns').setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']); } catch (e) { /* ignore */ }

let _client = null, _users = null;
let _memUsers = null, _memApp = { data: {}, updatedAt: 0 };

async function ensureClient() {
  if (_client) return _client;
  const { MongoClient } = require('mongodb');
  _client = new MongoClient(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 8000,
    maxPoolSize: 10,
    minPoolSize: 2,        // keep warm sockets so idle drops don't force a re-handshake
    maxIdleTimeMS: 60000,
  });
  await _client.connect();
  return _client;
}
function dbHandle() { return _client.db(process.env.DB_NAME || 'unico'); }

/* ---- users ---- */
async function usersCollection() {
  if (_users) return _users;
  await ensureClient();
  _users = dbHandle().collection('users');
  try { await _users.createIndex({ username: 1 }, { unique: true }); } catch (e) { /* ignore */ }
  return _users;
}
function memUsers() {
  if (!_memUsers) {
    const pass = process.env.SEED_ADMIN_PASSWORD || 'unico-admin';
    const user = (process.env.SEED_ADMIN_USER || 'admin').toLowerCase();
    _memUsers = [{ username: user, name: 'Administrator', role: 'Administrator', passwordHash: bcrypt.hashSync(pass, 10), active: true }];
    console.warn('[db] No MONGODB_URI set — using an in-memory store (DEV ONLY, not saved).');
    console.warn(`[db] Dev admin login:  ${user} / ${pass}`);
  }
  return {
    findOne: async (q) => _memUsers.find(u => u.username === q.username) || null,
    insertOne: async (doc) => { _memUsers.push(doc); return { insertedId: doc.username }; },
    updateOne: async (q, upd) => { const u = _memUsers.find(x => x.username === q.username); if (u) Object.assign(u, upd.$set || {}); return { matchedCount: u ? 1 : 0 }; },
    countDocuments: async () => _memUsers.length,
  };
}
async function getUsers() { return process.env.MONGODB_URI ? usersCollection() : memUsers(); }

/* ---- app data (single shared snapshot document) ---- */
async function getAppData() {
  if (process.env.MONGODB_URI) {
    await ensureClient();
    const doc = await dbHandle().collection('appdata').findOne({ _id: 'shared' });
    return doc ? { data: doc.data || {}, updatedAt: doc.updatedAt || 0 } : { data: {}, updatedAt: 0 };
  }
  return _memApp;
}
// Overlay keys that were retired by the quality rebuild; strip them on every write so a
// client mirroring its (still-stale) localStorage can't resurrect them into the shared blob.
const STALE_OVERLAY_KEYS = ['unico_quality_v1', 'unico_qentries_v1'];
async function setAppData(data) {
  const updatedAt = Date.now();
  if (data && typeof data === 'object') { STALE_OVERLAY_KEYS.forEach((k) => { if (k in data) delete data[k]; }); }
  if (process.env.MONGODB_URI) {
    await ensureClient();
    await dbHandle().collection('appdata').updateOne({ _id: 'shared' }, { $set: { data, updatedAt } }, { upsert: true });
  } else {
    _memApp = { data, updatedAt };
  }
  return { updatedAt };
}

/* ---- departments (the monthly statistics, moved out of the renderer) ---- */
// Returns the canonical department definitions (metadata + months[] + data[]),
// ordered, with the Mongo _id stripped (the renderer keys off `id`).
async function getDepartments() {
  if (process.env.MONGODB_URI) {
    await ensureClient();
    const docs = await dbHandle().collection('departments').find({}).sort({ order: 1, _id: 1 }).toArray();
    return docs.map((d) => { const { _id, ...rest } = d; return rest; });
  }
  // dev/in-memory: serve the on-disk seed directly so the app still has data.
  try { return require('./seed-departments').loadSeed(); } catch (e) { return []; }
}

// Populate the departments collection from the seed on first run (idempotent).
async function ensureDepartmentsSeeded() {
  if (!process.env.MONGODB_URI) return { seeded: 0, existing: 0 };
  await ensureClient();
  const { seedDepartments } = require('./seed-departments');
  return seedDepartments(dbHandle());
}

/* ---- staff + quality (also moved out of the renderer; see seed-data.js) ---- */
async function getRendererData(name) {
  if (process.env.MONGODB_URI) {
    await ensureClient();
    return require('./seed-data').getCollection(dbHandle(), name);
  }
  try { return require('./seed-data').loadSeed(name); } catch (e) { return []; }
}
async function getStaff() { return getRendererData('staff'); }
async function getQuality() { return getRendererData('quality'); }
async function ensureRendererSeeded(name) {
  if (!process.env.MONGODB_URI) return { name, seeded: 0, existing: 0 };
  await ensureClient();
  return require('./seed-data').seedOne(dbHandle(), name);
}

// Live MongoDB database handle (or null in the dev in-memory mode) — lets feature
// modules (e.g. data-collection.js) own their own collections without re-wiring
// the connection logic that lives here.
async function getDbHandle() {
  if (!process.env.MONGODB_URI) return null;
  await ensureClient();
  return dbHandle();
}

async function close() { if (_client) { await _client.close(); _client = null; _users = null; } }

module.exports = {
  getUsers, getAppData, setAppData,
  getDepartments, ensureDepartmentsSeeded,
  getStaff, getQuality, ensureRendererSeeded, getDbHandle,
  close, usingMongo: () => !!process.env.MONGODB_URI,
};
