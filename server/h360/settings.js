// What the administrator sets for the H360 link: the login collections run
// under, and how much of what is collected goes into the shared database.
//
// The login is kept in the database so it is entered once, but never readable
// there: it is sealed with a key made from this server's own secret
// (H360_SECRET, or JWT_SECRET). A server with a different secret cannot open
// it, so each one (the hospital PC, the live site) keeps its own sealed copy.
// HIS_USER / HIS_PASS in the environment are used instead when both are set.
const crypto = require('crypto');

const COLL = 'h360Settings';
const LEVELS = ['sheet', 'all'];
const memory = new Map(); // without a database (development only)

const secret = () => process.env.H360_SECRET || process.env.JWT_SECRET || '';
const sealKey = () => crypto.createHash('sha256').update('unico-h360-login|' + secret()).digest();
// Which secret a copy was sealed with, without giving the secret away.
const sealName = () => crypto.createHash('sha256').update('unico-h360-copy|' + secret()).digest('hex').slice(0, 12);

function seal(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', sealKey(), iv);
  const data = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
}

function unseal(sealed) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', sealKey(), Buffer.from(sealed.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(sealed.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(sealed.data, 'base64')), decipher.final()]).toString('utf8');
}

async function read(db, id) {
  if (!db) return memory.get(id) || null;
  return db.collection(COLL).findOne({ _id: id });
}

async function write(db, id, changes, unset) {
  if (!db) {
    const next = { ...(memory.get(id) || {}), _id: id };
    for (const [path, value] of Object.entries(changes)) {
      const keys = path.split('.');
      let at = next;
      for (const key of keys.slice(0, -1)) at = at[key] = { ...(at[key] || {}) };
      at[keys[keys.length - 1]] = value;
    }
    for (const path of Object.keys(unset || {})) {
      const keys = path.split('.');
      let at = next;
      for (const key of keys.slice(0, -1)) at = at[key] || {};
      delete at[keys[keys.length - 1]];
    }
    memory.set(id, next);
    return;
  }
  await db.collection(COLL).updateOne({ _id: id }, { ...(Object.keys(changes).length ? { $set: changes } : {}), ...(unset ? { $unset: unset } : {}) }, { upsert: true });
}

// { user, pass, source } for this server, or { user: '', pass: '' } with a reason.
async function login(db) {
  const user = String(process.env.HIS_USER || '').trim();
  const pass = String(process.env.HIS_PASS || '');
  if (user && pass) return { user, pass, source: 'environment' };
  const doc = await read(db, 'login');
  const copies = (doc && doc.copies) || {};
  const copy = copies[sealName()];
  if (copy) {
    try {
      return { user: copy.user, pass: unseal(copy.pass), source: 'saved', savedAt: copy.savedAt || null, savedBy: copy.savedBy || '' };
    } catch (err) {
      // Sealed with a secret this server no longer has.
    }
  }
  // Saved from another server (the hospital PC or the live site), which this one cannot open.
  return { user: '', pass: '', source: '', elsewhere: Object.keys(copies).length > 0 };
}

async function saveLogin(db, user, pass, by) {
  if (!secret()) throw new Error('This server has no secret to protect the login with. Set H360_SECRET (or JWT_SECRET) first.');
  await write(db, 'login', { ['copies.' + sealName()]: { user, pass: seal(pass), savedAt: new Date(), savedBy: by || '' } });
}

async function forgetLogin(db) {
  await write(db, 'login', {}, { ['copies.' + sealName()]: '' });
}

// 'sheet': only what the log sheet prints goes into the shared database. 'all': every record does.
async function level(db) {
  const doc = await read(db, 'options');
  return doc && LEVELS.includes(doc.cloudData) ? doc.cloudData : 'sheet';
}

async function saveLevel(db, value, by) {
  if (!LEVELS.includes(value)) throw new Error('Choose what is kept in the shared database.');
  await write(db, 'options', { cloudData: value, updatedAt: new Date(), updatedBy: by || '' });
}

module.exports = { login, saveLogin, forgetLogin, level, saveLevel, LEVELS };
