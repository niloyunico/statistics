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
// Skip on Vercel/AWS: the platform resolver is faster and always SRV-capable.
if (!process.env.VERCEL) {
  try { require('dns').setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']); } catch (e) { /* ignore */ }
}

// Read cache (Redis-backed, with a stale copy kept for outages) and the circuit
// breaker that makes a cold/unreachable cluster fail in milliseconds instead of
// eight seconds per query. See cache.js and warmup.js for the reasoning.
const cache = require('./cache');
const warmup = require('./warmup');
const lb = require('./loadbalancer');

// How long each dataset may be served without re-reading Mongo. Reference data that
// only changes when somebody edits it gets a generous window (a write invalidates it
// immediately anyway — see cache.instrument). The app-state blob gets a short one
// because it is the busiest write target in the app.
const REF_TTL = cache.FRESH_MS;
const APPDATA_TTL = cache.APPDATA_MS;

/* ---- automatic cluster failover (reads AND writes) -------------------------
   MONGODB_URIS=primary,standby enables it (falls back to the single MONGODB_URI).

   AUTHORITY. Exactly ONE cluster is written at any moment — which one is a
   fleet-wide fact stored in Redis ('0' = primary, '1' = standby), so every
   serverless instance agrees. Normally it is the primary, and every write is
   also MIRRORED to the standby in the background so the standby stays current.
   The moment the primary is unreachable for a write, the write is re-run on the
   standby and AUTHORITY FLIPS to it: from then on the standby serves reads and
   writes — users notice nothing.

   Authority does NOT flip back by itself: while flipped, the primary is BEHIND
   (it missed the failover-window writes), and pointing reads/writes back at it
   would resurrect old data. Restore it deliberately, when the primary is back:

       node scripts/sync-clusters.js --heal      (copies standby -> primary,
                                                  then hands authority back)

   Seed / freshen the standby the other way:  node scripts/sync-clusters.js --apply */
const redisKV = require('./redis');
const URI_LIST = String(process.env.MONGODB_URIS || process.env.MONGODB_URI || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
const PROBE_MS = 15000;
const AUTH_KEY = 'unico:db:authority';
const AUTH_CACHE_MS = 3000;

let _client = null, _clientPromise = null, _users = null, _db = null;
let _activeIdx = 0, _failedOverAt = 0, _lastProbeAt = 0, _lastPrimaryError = '';
let _standbyClient = null, _standbyPromise = null;
let _auth = { idx: 0, at: 0, flippedAt: 0 };
let _mirrorFails = 0, _lastMirrorError = '';

// Which cluster holds write authority right now — Redis-backed so the whole fleet
// agrees; cached briefly; Redis unreachable -> last known local answer.
async function authorityIdx() {
  if (URI_LIST.length < 2) return 0;
  const now = Date.now();
  if (now - _auth.at < AUTH_CACHE_MS) return _auth.idx;
  _auth.at = now;
  try {
    const v = await redisKV.get(AUTH_KEY);
    _auth.idx = v === '1' ? 1 : 0;
  } catch (e) { /* keep last known */ }
  return _auth.idx;
}
async function flipAuthority(idx, cause) {
  _auth = { idx, at: Date.now(), flippedAt: Date.now() };
  try { await redisKV.set(AUTH_KEY, String(idx)); } catch (e) { /* local-only flip; logged below */ }
  console.error('[db] WRITE AUTHORITY -> cluster #' + idx + (cause ? ' (' + String(cause).slice(0, 140) + ')' : '')
    + (idx === 1 ? ' — the standby now serves reads AND writes. When the primary is back, run: node scripts/sync-clusters.js --heal' : ''));
}
// Bumped by closeClient()/close(). A connect that is still in flight when the client
// is closed must NOT install itself afterwards: it would resurrect a live, unclosed
// MongoClient after "close" returned — holding pool connections against the Atlas cap
// forever, and (in the self-test) answering later queries from the OLD connection
// string, which turns a deterministic assertion into a timing-dependent one.
let _gen = 0;
let _memUsers = null, _memApp = { data: {}, updatedAt: 0 };

// Connect ONCE, and remember the in-flight promise rather than the half-built client.
//
// The previous version assigned `_client` before awaiting connect(), so:
//   - a failed connect (SRV/DNS hiccup, network down at boot, Atlas paused) left a DEAD
//     client cached forever. Every later request took the `if (_client) return` fast path
//     and failed against it, so one transient blip meant "database error" on every save
//     until somebody restarted the server. That is the failure people see as
//     "sometimes it just stops saving".
//   - concurrent first requests each built their own MongoClient; the extra ones were
//     orphaned with their sockets still open, quietly eating the Atlas connection cap.
// Memoising the PROMISE fixes both: everyone awaits the same connect, and a failure
// clears the cache so the very next request retries cleanly.
// One raw connect to ONE uri, with the pool sizing this runtime needs.
// Pool size MUST differ by runtime. On Vercel (serverless) every warm function instance
// keeps its OWN pool and there can be many instances at once — a big pool multiplies out
// and exhausts Atlas's connection cap (free tier = 500), which surfaces to users as
// "database unreachable". So serverless uses a tiny pool with no idle sockets; a
// persistent local server can afford a large warm pool for concurrency.
function rawConnect(uri) {
  const { MongoClient } = require('mongodb');
  const serverless = !!process.env.VERCEL;
  const client = new MongoClient(uri, {
    // Tunable, because the default is what decides whether a merely SLOW primary
    // counts as a dead one. A free-tier cluster reached from a cold serverless
    // instance can take several seconds to select a server; at 6000 ms that read
    // as "primary unreachable" and moved write authority to the standby, which
    // then needs a manual heal. Raise DB_SELECT_TIMEOUT_MS to trade a slower first
    // request for fewer spurious failovers.
    serverSelectionTimeoutMS: Number(process.env.DB_SELECT_TIMEOUT_MS) || (serverless ? 6000 : 8000),
    connectTimeoutMS: 8000,
    socketTimeoutMS: 30000,
    maxPoolSize: serverless ? 5 : 25,
    minPoolSize: serverless ? 0 : 2,       // serverless: hold no idle connections
    maxIdleTimeMS: serverless ? 10000 : 60000,
    // Do not let a request sit in the pool queue forever when the cluster is slow:
    // fail fast, let the circuit breaker notice, and answer from cache instead.
    waitQueueTimeoutMS: serverless ? 5000 : 10000,
    // Transparently retry a read/write that fails on a transient network blip
    // (Atlas socket drop, primary step-down) instead of surfacing "failed database".
    retryWrites: true,
    retryReads: true,
    // Shows up in the Atlas metrics/profiler, so a spike can be traced to the
    // deployment that caused it rather than to "some client".
    appName: 'unico-' + (serverless ? 'vercel' : 'server'),
  });
  return client.connect();
}

// A RAW (un-instrumented) handle on the standby cluster, for write mirroring and
// write-failover. Un-instrumented on purpose: the cache bump for a write already
// happens once in the instrumented wrapper — mirroring must not double it.
async function standbyDbRaw() {
  if (URI_LIST.length < 2) return null;
  if (_standbyClient) return _standbyClient.db(process.env.DB_NAME || 'unico');
  if (!_standbyPromise) {
    _standbyPromise = rawConnect(URI_LIST[1]).then((c) => { _standbyClient = c; _standbyPromise = null; return c; })
      .catch((e) => { _standbyPromise = null; throw e; });
  }
  const c = await _standbyPromise;
  return c.db(process.env.DB_NAME || 'unico');
}

// Fire-and-forget copy of a just-committed primary write onto the standby, so the
// standby tracks the primary in near-real-time and a failover loses ~nothing.
function mirrorWrite(name, op, args) {
  standbyDbRaw().then((sdb) => sdb.collection(name)[op](...args))
    .catch((e) => { _mirrorFails++; _lastMirrorError = String((e && e.message) || e); });
}

// Runs around EVERY collection write made through the instrumented handle
// (cache.instrument -> wrapCollection). This is where write availability lives:
//   authority=primary & healthy  -> write primary, mirror to standby
//   primary dies mid-write       -> re-run the SAME op on the standby, flip
//                                   authority to it, and report SUCCESS
//   authority=standby            -> the active client IS the standby; just write
async function writeHook(name, op, args, exec) {
  if (URI_LIST.length < 2) return exec();
  const desired = await authorityIdx();
  if (desired === 1) {
    // Authority is the standby. If the active connection is still the primary
    // (stale instance that hasn't probed yet), route the write to the standby
    // DIRECTLY — writing the primary now would fork the data.
    if (_activeIdx === 1) return exec();
    const sdb = await standbyDbRaw();
    return sdb.collection(name)[op](...args);
  }
  // Authority is the primary. On the standby via connect-time read-failover?
  // Then this write is the moment failover becomes real: take authority, write here.
  if (_activeIdx > 0) { await flipAuthority(1, 'primary unreachable at write time: ' + _lastPrimaryError); return exec(); }
  try {
    const res = await exec();
    mirrorWrite(name, op, args);
    return res;
  } catch (e) {
    if (warmup.isConnectivityError(e)) {
      const sdb = await standbyDbRaw();          // throws if the standby is down too
      const res = await sdb.collection(name)[op](...args);
      await flipAuthority(1, (e && e.message) || e);
      return res;
    }
    throw e;
  }
}

// While the active connection is NOT the authority cluster, re-try the authority
// every PROBE_MS in the background and swap the moment it answers.
function maybeProbeAuthority() {
  if (_clientPromise || URI_LIST.length < 2) return;
  const now = Date.now();
  if (now - _lastProbeAt < PROBE_MS) return;
  _lastProbeAt = now;
  authorityIdx().then((desired) => {
    if (_activeIdx === desired) return;
    const myGen = _gen;
    return rawConnect(URI_LIST[desired]).then((c) => {
      if (myGen !== _gen || _activeIdx === desired) { try { c.close(); } catch (_) { /* superseded */ } return; }
      const old = _client;
      _client = c; _activeIdx = desired; _db = null; _users = null;
      _failedOverAt = desired === 0 ? 0 : _failedOverAt; _lastPrimaryError = desired === 0 ? '' : _lastPrimaryError;
      console.warn('[db] switched to authority cluster #' + desired + '.');
      if (old) { try { old.close(); } catch (_) { /* draining */ } }
    });
  }).catch((e) => { _lastPrimaryError = String((e && e.message) || e); });
}

async function ensureClient() {
  if (_client) { maybeProbeAuthority(); return _client; }
  if (_clientPromise) return _clientPromise;
  const myGen = _gen;
  _clientPromise = (async () => {
    // Connect to the AUTHORITY cluster first (normally the primary; the standby
    // after a write-failover flip), then fall through the rest of the list.
    const desired = await authorityIdx();
    const order = [...new Set([desired, ...URI_LIST.map((_, n) => n)])];
    let lastErr = null;
    for (const i of order) {
      let client = null;
      try {
        client = await rawConnect(URI_LIST[i]);
      } catch (e) {
        lastErr = e;
        if (i === 0) _lastPrimaryError = String((e && e.message) || e);
        continue;                            // try the next cluster in the list
      }
      if (myGen !== _gen) {                  // closed while we were connecting
        try { client.close(); } catch (_) { /* nothing to do */ }
        const e = new Error('Database connection was closed while connecting.');
        e.name = 'MongoConnectionSupersededError';   // deliberately not a connectivity error
        throw e;
      }
      _client = client; _clientPromise = null; _activeIdx = i;
      if (i !== desired) {
        if (!_failedOverAt) _failedOverAt = Date.now();
        _lastProbeAt = Date.now();
        console.warn('[db] FAILOVER: authority cluster #' + desired + ' unreachable (' + _lastPrimaryError + ') — serving from cluster #' + i + '; the first write will move authority here.');
      } else if (i === 0) { _failedOverAt = 0; _lastPrimaryError = ''; }
      return client;
    }
    // Every cluster failed — don't cache a broken connection; the next request retries.
    if (myGen === _gen) { _clientPromise = null; _client = null; _users = null; _db = null; }
    throw lastErr || new Error('No database URI configured.');
  })();
  return _clientPromise;
}

// The live database handle, wrapped by cache.instrument() so that EVERY write made
// through it — by this file or by any feature module that took getDbHandle() — bumps
// the version of the collection it touched and invalidates the cached reads derived
// from it. That is what keeps caching invisible: nobody has to remember to clear it.
// Memoised per connection; reset wherever _client is.
function dbHandle() {
  // writeHook: every write through this handle (dbWrite AND every feature module
  // holding getDbHandle()) is mirrored to the standby and fails over to it with
  // an authority flip if the primary dies — see writeHook above.
  if (!_db) _db = cache.instrument(_client.db(process.env.DB_NAME || 'unico'), { writeHook });
  return _db;
}

// For /api/cache/stats and the Settings panel: which cluster is live right now.
function clusterStatus() {
  return {
    clusters: URI_LIST.length,
    active: _activeIdx,
    authority: _auth.idx,
    authorityFlippedAt: _auth.flippedAt || null,
    failedOver: _auth.idx > 0 || _activeIdx !== _auth.idx,
    failedOverAt: _failedOverAt || null,
    lastPrimaryError: _lastPrimaryError || null,
    mirrorFails: _mirrorFails,
    lastMirrorError: _lastMirrorError || null,
  };
}

// One guarded read: connect if needed, take a slot from the fleet's shared database
// budget, run the query, and let the circuit breaker judge the outcome.
//
// Layering matters. The breaker is OUTSIDE: a cluster already known to be unreachable
// should be refused in microseconds, not queued for. The limiter is INSIDE, and
// ensureClient() sits between them on purpose — a cold connect is not database
// contention, and timing it as though it were would make every cold start look like
// congestion and shrink the limit for no reason.
function dbRead(fn) {
  return warmup.guard(async () => {
    await ensureClient();
    return lb.run(() => fn(dbHandle()), { kind: 'read' });
  });
}
// Same, for writes — but NEVER short-circuited and never shed. Somebody's data entry
// always gets to try; the breaker and the limiter only record what happened.
function dbWrite(fn) {
  return warmup.guard(async () => {
    await ensureClient();
    return lb.run(() => fn(dbHandle()), { kind: 'write' });
  }, { shortCircuit: false });
}

// Drop the pooled connection (graceful shutdown, and lets tests re-point the URI).
async function closeClient() {
  _gen++;                                   // disown any connect still in flight
  const c = _client, s = _standbyClient;
  _client = null; _clientPromise = null; _users = null; _db = null;
  _standbyClient = null; _standbyPromise = null;
  if (c) { try { await c.close(); } catch (e) { /* already gone */ } }
  if (s) { try { await s.close(); } catch (e) { /* already gone */ } }
}

/* ---- users ---- */
async function usersCollection() {
  if (_users) return _users;
  // Guarded (never short-circuited — login must always be allowed to try) so that the
  // busiest endpoints in the app finally REPORT to the circuit breaker. /api/health
  // does a real round trip here, which makes it the natural thing to close a circuit
  // that has been sitting open; before this it could neither open nor close one.
  return warmup.guard(async () => {
    await ensureClient();
    _users = dbHandle().collection('users');
    try { await _users.createIndex({ username: 1 }, { unique: true }); } catch (e) { /* ignore */ }
    return _users;
  }, { shortCircuit: false });
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

/* ---- app data (single shared snapshot document) ----
   IMPORTANT for every caller of the read functions below: the value you get back may
   be a SHARED cached object. Treat it as immutable — copy before you change anything
   (access.js already does: it rebuilds rather than edits in place). */

// opts.fresh — skip the cache on the way in. Pass it on read-modify-write paths:
// PUT /api/data reads the current document to compute the field-level diff, and a
// baseline that is even a few seconds old could quietly drop somebody else's edit.
// The stale copy is still kept as an outage rescue either way.
async function getAppData(opts) {
  if (process.env.MONGODB_URI) {
    return cache.read(
      'appdata',
      { coll: 'appdata', freshMs: APPDATA_TTL, fresh: !!(opts && opts.fresh), noRescue: !!(opts && opts.noRescue) },
      () => dbRead(async (d) => {
        const doc = await d.collection('appdata').findOne({ _id: 'shared' });
        return doc ? { data: doc.data || {}, updatedAt: doc.updatedAt || 0 } : { data: {}, updatedAt: 0 };
      })
    );
  }
  return _memApp;
}
// Overlay keys that were retired by the quality rebuild; strip them on every write so a
// client mirroring its (still-stale) localStorage can't resurrect them into the shared blob.
const STALE_OVERLAY_KEYS = ['unico_quality_v1', 'unico_qentries_v1'];
// A key is only safe as a dotted update path if it cannot be read as one.
const dottablePath = (k) => k.indexOf('.') < 0 && k.indexOf('$') !== 0 && k.length > 0;

// `previous` is the document as it was read a moment ago. When it is supplied, only the
// keys that actually CHANGED are written.
//
// The old behaviour replaced `data` wholesale on every call, which caused two real
// problems: every keystroke rewrote the entire 130 KB blob (staff alone is 98 KB), and
// with two tabs or two people open at once, whoever saved last silently overwrote the
// other's work — edits "disappeared" with no error anywhere. A field-level $set means
// two people editing different modules no longer collide at all.
async function setAppData(data, previous) {
  const updatedAt = Date.now();
  if (data && typeof data === 'object') { STALE_OVERLAY_KEYS.forEach((k) => { if (k in data) delete data[k]; }); }
  if (!process.env.MONGODB_URI) { _memApp = { data, updatedAt }; return { updatedAt }; }

  // Writes go through dbWrite: always attempted (never refused because the circuit is
  // open), and the collection proxy invalidates the cached copy as soon as it lands.
  return dbWrite(async (d) => {
  const coll = d.collection('appdata');
  const keys = Object.keys(data || {});
  const prevKeys = previous && typeof previous === 'object' ? Object.keys(previous) : null;

  if (prevKeys && keys.every(dottablePath) && prevKeys.every(dottablePath)) {
    const $set = { updatedAt };
    const $unset = {};
    keys.forEach((k) => { if (data[k] !== previous[k]) $set['data.' + k] = data[k]; });
    // hasOwnProperty, not `in`: `in` walks the prototype chain, so a stored overlay
    // key called "toString" or "constructor" would read as present on every object and
    // could never be deleted — an asymmetry with the own-keys loop above.
    prevKeys.forEach((k) => { if (!Object.prototype.hasOwnProperty.call(data, k)) $unset['data.' + k] = ''; });
    const update = { $set };
    if (Object.keys($unset).length) update.$unset = $unset;
    await coll.updateOne({ _id: 'shared' }, update, { upsert: true });
    // `changedKeys` names WHAT was written, not just how many. The activity log needs
    // it to say "saved the staff register" instead of "PUT /api/data" — the caller is
    // the only place that still holds the previous values to describe the change.
    return { updatedAt,
      changed: Object.keys($set).length - 1, removed: Object.keys($unset).length,
      changedKeys: Object.keys($set).filter((k) => k !== 'updatedAt').map((k) => k.slice(5)),
      removedKeys: Object.keys($unset).map((k) => k.slice(5)) };
  }

  // No baseline (or a key we cannot express as a path) -> the original whole-doc write.
  await coll.updateOne({ _id: 'shared' }, { $set: { data, updatedAt } }, { upsert: true });
  return { updatedAt };
  });
}

/* ---- departments (the monthly statistics, moved out of the renderer) ---- */
// Returns the canonical department definitions (metadata + months[] + data[]),
// ordered, with the Mongo _id stripped (the renderer keys off `id`).
async function getDepartments(opts) {
  if (process.env.MONGODB_URI) {
    return cache.read(
      'departments',
      { coll: 'departments', freshMs: REF_TTL, fresh: !!(opts && opts.fresh) },
      () => dbRead(async (d) => {
        const docs = await d.collection('departments').find({}).sort({ order: 1, _id: 1 }).toArray();
        // Statistics + Quality are now ONE record (dept.quality embedded). For the stats
        // inject, hide qualityOnly pseudo-depts (Overall Hospital) and strip the embedded
        // quality blob — it is served separately by getQuality() as __UNICO_QUALITY__.
        return docs.filter((x) => !x.qualityOnly).map((x) => { const { _id, quality, ...rest } = x; return rest; });
      })
    );
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
async function getRendererData(name, opts) {
  if (process.env.MONGODB_URI) {
    return cache.read(
      name,
      { coll: name, freshMs: REF_TTL, fresh: !!(opts && opts.fresh) },
      () => dbRead((d) => require('./seed-data').getCollection(d, name))
    );
  }
  try { return require('./seed-data').loadSeed(name); } catch (e) { return []; }
}
async function getStaff(opts) { return getRendererData('staff', opts); }
// Quality now lives EMBEDDED in each department doc (dept.quality) after the
// Statistics+Quality merge. Derive the quality-area list from departments so the
// renderer's __UNICO_QUALITY__ keeps the exact shape it had as its own collection.
async function getQuality(opts) {
  if (process.env.MONGODB_URI) {
    // Derived from `departments`, so it is keyed to THAT collection's version: an edit
    // to any department (which is where quality now lives) invalidates this too.
    return cache.read(
      'quality',
      { coll: 'departments', freshMs: REF_TTL, fresh: !!(opts && opts.fresh) },
      () => dbRead(async (db) => {
        const deps = await db.collection('departments').find({}).sort({ order: 1, _id: 1 }).toArray();
        return deps.filter((d) => d.quality && d.quality.key).map((d) => {
          const q = Object.assign({}, d.quality);
          q.deptId = q.deptId || d.id;
          if (q.key == null) q.key = d.qualityKey;
          return q;
        });
      })
    );
  }
  try { return require('./seed-data').loadSeed('quality'); } catch (e) { return []; }
}
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
  // Guarded so the large amount of traffic that takes a raw handle — data collection,
  // supervisor reports, the activity log, user admin — at least REPORTS its verdict to
  // the circuit breaker instead of being invisible to it. shortCircuit:false because
  // this is the entry point for writes too, and a write is never refused on breaker
  // state. Read paths that want fail-fast should use dbRead().
  return warmup.guard(async () => { await ensureClient(); return dbHandle(); }, { shortCircuit: false });
}

async function close() { return closeClient(); }

/* ---- warmup -----------------------------------------------------------------
   Re-read every shared dataset and refresh its cached copy. Called by the keep-alive
   (timer and cron) so the copy that has to rescue an outage is never itself stale,
   and so a cluster that has just been resumed is exercised before a real user
   arrives. Never throws: a warm that fails simply leaves the previous copy in place. */
async function warmCache() {
  if (!process.env.MONGODB_URI) return { warmed: [], failed: [] };
  const jobs = [
    ['departments', () => getDepartments({ fresh: true })],
    ['quality', () => getQuality({ fresh: true })],
    ['staff', () => getStaff({ fresh: true })],
    ['appdata', () => getAppData({ fresh: true })],
  ];
  const warmed = [], failed = [];
  const results = await Promise.all(jobs.map(([n, f]) => f().then(() => n).catch(() => { failed.push(n); return null; })));
  results.forEach((n) => { if (n) warmed.push(n); });
  return { warmed, failed };
}

// Start the Atlas handshake at module load rather than inside the first request, so
// on a serverless cold start the TLS + auth round trips overlap with the platform
// routing that request instead of running after it.
if (process.env.MONGODB_URI) warmup.prewarm(ensureClient);

module.exports = {
  getUsers, getAppData, setAppData, closeClient,
  getDepartments, ensureDepartmentsSeeded,
  getStaff, getQuality, ensureRendererSeeded, getDbHandle,
  warmCache, dbRead, dbWrite,
  close, usingMongo: () => !!process.env.MONGODB_URI, clusterStatus, standbyDbRaw,
};
