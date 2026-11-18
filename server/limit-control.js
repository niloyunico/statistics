/* ACCESS LIMITS — the administrator's restriction levels (Control Centre).

   ONE configuration document, `limitControl` / _id "config":
     { global: { level, message, at, by },
       roles:  { "<role>":     { level, message, at, by } },
       users:  { "<username>": { level, message, at, by } } }

   Levels (each includes everything below it):
     0 Normal            existing permissions, no notice
     1 Notice            existing permissions, a notice is shown
     2 Read-only         every write is refused, reads stay available
     3 Submissions paused  read-only, and data submissions are refused explicitly
     4 Workspace unavailable  everything is refused except identity / sign-out

   Resolution (resolveLevel) — in this exact order:
     1. role Administrator (or an unrestricted access object) -> 0, config never consulted
     2. a VALID user entry is authoritative, even at 0 (an explicit exemption)
     3. otherwise max(role level, global level)
     4. missing or malformed entries count as 0 (a malformed user entry is ignored, so it
        neither restricts nor exempts anybody)
   Ties between role and global at the same level: the ROLE entry wins (it is the more
   specific one), and its message is used; when the role entry has no message, the global
   entry's message is used instead.

   Usernames are stored as map KEYS, so they are encoded (userKey) — a username holding a
   '.' or a leading '$' would otherwise become a nested path or an operator in the dotted
   update. Callers never pass a raw path: writeConfig() is internal-facing and the admin API
   (server/control-centre.js) builds every path itself from validated parts.

   Storage follows server/h360/settings.js: Mongo when configured, an in-memory document
   otherwise (development / tests), dotted $set / $unset keys so one change never
   overwrites another. */
const COLL = 'limitControl';
const DOC_ID = 'config';
const LEVELS = [0, 1, 2, 3, 4];
const MAX_MESSAGE = 500;
const CACHE_MS = 15000;          // how long a read is trusted (per server instance)
const READ_TIMEOUT_MS = 1500;    // a slow database must never hold up every request

// What each level is called (admin screen) and the exact words the affected person sees.
const LEVEL_NAMES = ['Normal', 'Notice', 'Read-only', 'Submissions paused', 'Workspace unavailable'];
const NOTICES = {
  0: '',
  1: 'Your account has an administrator notice.',
  2: 'Your access is currently view-only. Changes cannot be saved.',
  3: 'Data submissions are currently paused for your account.',
  4: 'Your access is currently limited',
};

const memory = new Map(); // without a database (development only)

async function handleOf(db) {
  if (db !== undefined) return db;
  try { return await require('./db').getDbHandle(); } catch (e) { throw e; }
}

function emptyConfig() { return { _id: DOC_ID, global: { level: 0, message: '', at: null, by: null }, roles: {}, users: {} }; }

async function readConfig(db) {
  const h = await handleOf(db);
  if (!h) { const m = memory.get(DOC_ID); return m ? JSON.parse(JSON.stringify(m)) : null; }
  return h.collection(COLL).findOne({ _id: DOC_ID });
}

// changes: { dottedPath: value }, unset: { dottedPath: '' }. Paths are built by the caller
// from validated components (see buildPath); this function refuses anything else.
async function writeConfig(changes, unset, db) {
  const set = changes || {};
  const del = unset || {};
  [...Object.keys(set), ...Object.keys(del)].forEach((p) => { if (!isSafePath(p)) throw new Error('Refused an unsafe configuration path.'); });
  const h = await handleOf(db);
  if (!h) {
    const next = memory.get(DOC_ID) ? JSON.parse(JSON.stringify(memory.get(DOC_ID))) : { _id: DOC_ID };
    for (const [path, value] of Object.entries(set)) {
      const keys = path.split('.');
      let at = next;
      for (const key of keys.slice(0, -1)) at = at[key] = (at[key] && typeof at[key] === 'object') ? { ...at[key] } : {};
      at[keys[keys.length - 1]] = JSON.parse(JSON.stringify(value));
    }
    for (const path of Object.keys(del)) {
      const keys = path.split('.');
      let at = next;
      for (const key of keys.slice(0, -1)) at = (at && at[key]) || {};
      if (at) delete at[keys[keys.length - 1]];
    }
    memory.set(DOC_ID, next);
    invalidate();
    return;
  }
  const update = {};
  if (Object.keys(set).length) update.$set = set;
  if (Object.keys(del).length) update.$unset = del;
  if (!Object.keys(update).length) return;
  await h.collection(COLL).updateOne({ _id: DOC_ID }, update, { upsert: true });
  invalidate();
}

/* ---- keys and paths ---- */

// A username as a map key: lower-cased, with '%', '.' and '$' escaped so it is always ONE
// path segment and never an operator. Decoded with userFromKey.
function normUsername(v) { return String(v == null ? '' : v).trim().toLowerCase(); }
function userKey(username) {
  return normUsername(username).replace(/%/g, '%25').replace(/\./g, '%2E').replace(/\$/g, '%24');
}
function userFromKey(key) {
  // One pass, so a decoded '%' can never combine with what follows into another escape.
  return String(key || '').replace(/%(25|2E|2e|24)/g, (m, c) => (c === '25' ? '%' : c === '24' ? '$' : '.'));
}
// global | roles.<seg> | users.<seg>, where <seg> has no '.', does not start with '$',
// and is not empty. Anything else is refused before it reaches the database.
function isSafePath(p) {
  if (typeof p !== 'string') return false;
  if (p === 'global' || p === 'roles' || p === 'users') return true;
  const m = /^(roles|users)\.([^.]+)$/.exec(p);
  if (!m) return false;
  const seg = m[2];
  return seg.length > 0 && seg.length <= 120 && seg.charAt(0) !== '$' && !/[\u0000-\u001f]/.test(seg);
}

/* ---- validation ---- */

// A stored level: an integer is clamped into 0..4; anything else is malformed (null).
function storedLevel(v) {
  if (typeof v !== 'number' || !Number.isInteger(v)) return null;
  return Math.max(0, Math.min(4, v));
}
// An administrator's input: must already be an integer 0..4. Never coerced.
function validLevel(v) { return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 4; }

// Plain text only: control characters removed (line breaks kept), trimmed. Returns null when
// the value is not a string or is longer than MAX_MESSAGE — the caller rejects it.
function cleanMessage(v) {
  if (v == null) return '';
  if (typeof v !== 'string') return null;
  const s = v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim();
  if (s.length > MAX_MESSAGE) return null;
  return s;
}
function storedMessage(v) { return typeof v === 'string' ? v.slice(0, MAX_MESSAGE) : ''; }

// One stored entry -> { level, message } or null when malformed / absent.
function entryOf(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
  const level = storedLevel(e.level);
  if (level == null) return null;
  return { level, message: storedMessage(e.message) };
}

/* ---- resolution (pure) ---- */

function isAdministrator(access) {
  return !!access && (access.unrestricted === true || access.role === 'Administrator');
}

// { level, message, source } for this access. source: 'exempt' (an administrator),
// 'user', 'role', 'global' or 'none'.
function resolveLevel(cfg, access) {
  if (!access || isAdministrator(access)) return { level: 0, message: '', source: access ? 'exempt' : 'none' };
  const c = (cfg && typeof cfg === 'object' && !Array.isArray(cfg)) ? cfg : {};
  const users = (c.users && typeof c.users === 'object' && !Array.isArray(c.users)) ? c.users : {};
  const roles = (c.roles && typeof c.roles === 'object' && !Array.isArray(c.roles)) ? c.roles : {};
  const key = userKey(access.username);
  if (key && Object.prototype.hasOwnProperty.call(users, key)) {
    const u = entryOf(users[key]);
    if (u) return { level: u.level, message: u.level > 0 ? u.message : '', source: 'user' };
  }
  const role = String(access.role || '');
  const r = (role && Object.prototype.hasOwnProperty.call(roles, role)) ? entryOf(roles[role]) : null;
  const g = entryOf(c.global);
  const rl = r ? r.level : 0, gl = g ? g.level : 0;
  if (rl === 0 && gl === 0) return { level: 0, message: '', source: 'none' };
  if (rl >= gl) {
    // Role wins ties; fall back to the global message when the role entry carries none.
    const message = (r && r.message) || (rl === gl && g ? g.message : '') || '';
    return { level: rl, message, source: 'role' };
  }
  return { level: gl, message: (g && g.message) || '', source: 'global' };
}

/* ---- cached read for the request path ---- */

let _cache = null;         // { cfg, ts }
let _inflight = null;
let _lastErrLog = 0;
function invalidate() { _cache = null; }

function logReadFailure(e) {
  const now = Date.now();
  if (now - _lastErrLog < 60000) return;
  _lastErrLog = now;
  console.warn('[limit-control] restriction settings could not be read; treating everyone as unrestricted for now (' + String((e && e.message) || e) + ')');
}

// The config for the request path, or null when it cannot be read safely. Never throws:
// an unreadable config FAILS OPEN (null -> level 0), it never invents a restriction.
async function cachedConfig() {
  if (_cache && Date.now() - _cache.ts < CACHE_MS) return _cache.cfg;
  if (!_inflight) {
    _inflight = (async () => {
      let timer;
      try {
        const cfg = await Promise.race([
          readConfig(),
          new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('timed out')), READ_TIMEOUT_MS); }),
        ]);
        _cache = { cfg: cfg || null, ts: Date.now() };
        return _cache.cfg;
      } catch (e) {
        logReadFailure(e);
        return null;
      } finally {
        clearTimeout(timer);
        _inflight = null;
      }
    })();
  }
  return _inflight;
}

// The resolved limit for an access object, from the cache. Administrators skip the lookup.
async function limitFor(access) {
  if (!access || isAdministrator(access)) return { level: 0, message: '' };
  // The account itself could not be read: its stand-in access is not evidence of anything.
  if (access.degraded) return { level: 0, message: '' };
  const cfg = await cachedConfig();
  if (!cfg) return { level: 0, message: '' };
  const r = resolveLevel(cfg, access);
  return { level: r.level, message: r.message };
}

function _resetForTests() { memory.clear(); invalidate(); _inflight = null; }

module.exports = {
  COLL, DOC_ID, LEVELS, LEVEL_NAMES, NOTICES, MAX_MESSAGE, CACHE_MS,
  readConfig, writeConfig, resolveLevel, cachedConfig, limitFor, invalidate,
  userKey, userFromKey, normUsername, isSafePath, validLevel, storedLevel, cleanMessage, entryOf,
  emptyConfig, isAdministrator, _resetForTests,
};
