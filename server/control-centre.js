/* CONTROL CENTRE — administrator-only API for access restriction levels.

   Every route here is for a REAL administrator only: authority is the server-resolved
   access object (access.forRequest -> unrestricted), never a role, username or flag in the
   request. 401 without a session, 403 for anyone else signed in — with a plain refusal that
   says nothing about what is behind it.

     GET  /api/control-centre          configuration + every account's effective level
     PUT  /api/control-centre          change ONE scope: global | role | user
     POST /api/control-centre/clear    reset every restriction (one atomic update)
     GET  /api/users/online            who was seen in the last five minutes
     GET  /api/control-centre/ui.js    the screen itself (built to server/admin-ui/, never
                                       served from the public renderer folder)

   Storage and resolution live in server/limit-control.js; enforcement in server/access.js. */
const fs = require('fs');
const path = require('path');
const access = require('./access');
const activity = require('./activity-log');
const LC = require('./limit-control');
const { getUsers } = require('./db');

const ADMIN_ROLE = 'Administrator';
// Roles a restriction may target: every backend role except Administrator (always exempt).
// Read from users-admin so a role added there is restrictable here without a second list.
function restrictableRoles() {
  let roles = ['User', 'collector', 'incharge', 'nurse', 'pca'];
  try { const ua = require('./users-admin'); if (Array.isArray(ua.ROLES)) roles = ua.ROLES.filter((r) => r !== ADMIN_ROLE); } catch (e) { /* default list */ }
  return roles;
}
const ROLE_LABELS = {
  User: 'Console accounts',
  collector: 'Data collectors (portal)',
  incharge: 'Ward in-charges (portal)',
  nurse: 'Nurse app accounts',
  pca: 'PCA app accounts',
};
const PUT_KEYS = ['scope', 'target', 'level', 'message', 'remove'];
const USERNAME_RE = /^[a-z0-9][a-z0-9._@+-]{0,79}$/;
const UI_FILE = path.join(__dirname, 'admin-ui', 'control-centre.js');

const bad = (res, error, status) => res.status(status || 400).json({ ok: false, error });

// Strict administrator gate. Open local mode (REQUIRE_AUTH=false) is unrestricted by design
// (one person at one PC) — the same rule every admin-only route in this app follows.
async function strictAdmin(req, res, next) {
  try {
    const a = await access.forRequest(req);
    if (!a) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
    req.access = a;
    if (!a.unrestricted) return res.status(403).json({ ok: false, error: 'You do not have access to this.' });
    next();
  } catch (e) { res.status(500).json({ ok: false, error: 'Server error.' }); }
}

async function allAccounts() {
  const users = await getUsers();
  if (!users || typeof users.find !== 'function') return [];   // in-memory dev shim: no listing
  const list = await users.find({}).sort({ role: 1, username: 1 }).toArray();
  const { safe } = require('./users-admin');
  return list.map((u) => safe(u));
}
async function findAccount(username) {
  const users = await getUsers();
  return users.findOne({ username });
}

const entryOut = (e, raw) => (e ? { level: e.level, message: e.message, at: (raw && raw.at) || null, by: (raw && raw.by) || null } : null);

async function buildState() {
  const cfg = (await LC.readConfig()) || LC.emptyConfig();
  const accounts = await allAccounts();
  let seen = {}, signIns = {};
  try { seen = await require('./phone-app').presenceMap(); } catch (e) { seen = {}; }
  try { signIns = await require('./users-admin').lastSignIns(); } catch (e) { signIns = {}; }
  const now = Date.now();
  const onlineMs = require('./phone-app').ONLINE_MS || 300000;
  const cfgUsers = (cfg.users && typeof cfg.users === 'object') ? cfg.users : {};
  const cfgRoles = (cfg.roles && typeof cfg.roles === 'object') ? cfg.roles : {};
  const known = new Set();
  const users = accounts.map((u) => {
    const exempt = u.role === ADMIN_ROLE;
    const key = LC.userKey(u.username);
    known.add(key);
    const raw = cfgUsers[key];
    const eff = LC.resolveLevel(cfg, { username: u.username, role: u.role, unrestricted: exempt });
    const s = Number(seen[String(u.username).toLowerCase()]) || 0;
    const li = Number(signIns[String(u.username).toLowerCase()]) || 0;
    return {
      username: u.username, name: u.name, role: u.role, active: u.active, title: u.title || null,
      exempt,
      entry: exempt ? null : entryOut(LC.entryOf(raw), raw),
      effective: exempt ? { level: 0, source: 'exempt', message: '' } : eff,
      online: !!s && now - s < onlineMs,
      lastSeen: Math.max(s, li) || null,
    };
  });
  const roles = restrictableRoles().map((r) => ({
    role: r, label: ROLE_LABELS[r] || r,
    accounts: users.filter((u) => u.role === r).length,
    entry: entryOut(LC.entryOf(cfgRoles[r]), cfgRoles[r]),
  }));
  // Entries for accounts that no longer exist: still counted, cleared by "Clear all".
  const orphans = Object.keys(cfgUsers).filter((k) => !known.has(k)).map(LC.userFromKey);
  return {
    ok: true,
    levels: LC.LEVELS.map((l) => ({ level: l, name: LC.LEVEL_NAMES[l], notice: LC.NOTICES[l] })),
    maxMessage: LC.MAX_MESSAGE,
    cacheSeconds: Math.round(LC.CACHE_MS / 1000),
    onlineMinutes: Math.round(onlineMs / 60000),
    global: entryOut(LC.entryOf(cfg.global), cfg.global) || { level: 0, message: '', at: null, by: null },
    roles,
    adminRole: { role: ADMIN_ROLE, accounts: users.filter((u) => u.exempt).length },
    users,
    orphans,
  };
}

// Validate a PUT body into { path, scopeLabel, remove, level, message } or { error, status }.
async function parseChange(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Send one change as a JSON object.' };
  const keys = Object.keys(body);
  // No operators, no dotted paths, no extra fields: the database path is built here.
  if (keys.some((k) => PUT_KEYS.indexOf(k) < 0)) return { error: 'Unexpected field in the request.' };
  const { scope, target, remove } = body;
  if (typeof scope !== 'string' || ['global', 'role', 'user'].indexOf(scope) < 0) return { error: 'Scope must be global, role or user.' };
  if (remove !== undefined && remove !== true && remove !== false) return { error: 'remove must be true or false.' };
  const removing = remove === true;
  let level = null, message = '';
  if (!removing) {
    if (!LC.validLevel(body.level)) return { error: 'Level must be a whole number from 0 to 4.' };
    level = body.level;
    message = LC.cleanMessage(body.message);
    if (message === null) return { error: 'The message must be plain text of at most ' + LC.MAX_MESSAGE + ' characters.' };
  } else if (body.level !== undefined || body.message !== undefined) {
    return { error: 'A removal carries no level or message.' };
  }
  if (scope === 'global') {
    if (target !== undefined && target !== null && target !== '') return { error: 'The everyone scope takes no target.' };
    if (removing) return { error: 'The everyone setting cannot be removed; set it to level 0 instead.' };
    return { path: 'global', label: 'Everyone', level, message, removing };
  }
  if (typeof target !== 'string' || !target.trim() || target.length > 80) return { error: 'Choose who this applies to.' };
  if (scope === 'role') {
    const role = target.trim();
    if (role === ADMIN_ROLE) return { error: 'Administrators are always exempt and cannot be restricted.' };
    if (restrictableRoles().indexOf(role) < 0) return { error: 'Unknown role.' };
    return { path: 'roles.' + role, label: 'Role: ' + role, level, message, removing };
  }
  // scope === 'user'
  const username = LC.normUsername(target);
  if (!USERNAME_RE.test(username)) return { error: 'Invalid username.' };
  let acct = null;
  try { acct = await findAccount(username); } catch (e) { return { error: 'Accounts could not be read just now. Nothing was changed.', status: 503 }; }
  if (!acct) return { error: 'No such account.', status: 404 };
  const key = LC.userKey(username);
  if ((acct.role || 'User') === ADMIN_ROLE && !removing) return { error: 'Administrator accounts are always exempt and cannot be restricted.' };
  return { path: 'users.' + key, label: 'User: ' + username, level, message, removing };
}

// The ONE update "Clear all" makes: exactly the three restriction scopes, nothing else.
function clearAllChanges(by) {
  return { global: { level: 0, message: '', at: Date.now(), by: by || 'local' }, roles: {}, users: {} };
}

const levelText = (e) => (e ? LC.LEVEL_NAMES[e.level] + ' (' + e.level + ')' : 'not set');

function mount(app, opts) {
  const requireApi = (opts && opts.requireApi) || ((req, res, next) => next());
  const guard = [requireApi, strictAdmin];

  app.get('/api/control-centre', guard, async (req, res) => {
    try { res.json(await buildState()); }
    catch (e) { res.status(500).json({ ok: false, error: 'The Control Centre could not be loaded.' }); }
  });

  app.put('/api/control-centre', guard, async (req, res) => {
    try {
      const ch = await parseChange(req.body);
      if (ch.error) return bad(res, ch.error, ch.status);
      if (!LC.isSafePath(ch.path)) return bad(res, 'Invalid target.');
      const cfg = (await LC.readConfig()) || {};
      const [head, seg] = ch.path.split('.');
      const prevRaw = seg ? ((cfg[head] || {})[seg]) : cfg.global;
      const prev = LC.entryOf(prevRaw);
      if (ch.removing) {
        await LC.writeConfig({}, { [ch.path]: '' });
      } else {
        await LC.writeConfig({ [ch.path]: { level: ch.level, message: ch.message, at: Date.now(), by: (req.access && req.access.username) || 'local' } });
      }
      // The message itself is not logged (it is shown to the person; the log records that one was set).
      const next = ch.removing ? null : { level: ch.level };
      await activity.log(req, 'limit_control', {
        target: ch.label,
        detail: (ch.removing ? 'override removed' : 'set') + ': ' + levelText(prev) + ' -> ' + levelText(next)
          + (!ch.removing && ch.message ? ' · with a message' : ''),
      });
      res.json(await buildState());
    } catch (e) {
      res.status(e && /unsafe/.test(e.message || '') ? 400 : 500).json({ ok: false, error: 'The change could not be saved.' });
    }
  });

  // Clear all: global back to 0 and every role / user entry removed, in ONE update, so it
  // either happens completely or not at all. Other top-level fields are left untouched.
  // Removing (rather than writing explicit zeros) matters: an explicit user 0 is an
  // exemption, and "clear" must not leave everybody exempt from the next restriction.
  app.post('/api/control-centre/clear', guard, async (req, res) => {
    try {
      const b = req.body;
      if (!b || typeof b !== 'object' || Array.isArray(b) || b.confirm !== true || Object.keys(b).some((k) => k !== 'confirm')) {
        return bad(res, 'Confirm clearing every restriction.');
      }
      const cfg = (await LC.readConfig()) || {};
      const roleCount = Object.keys((cfg.roles && typeof cfg.roles === 'object') ? cfg.roles : {}).length;
      const userCount = Object.keys((cfg.users && typeof cfg.users === 'object') ? cfg.users : {}).length;
      await LC.writeConfig(clearAllChanges((req.access && req.access.username) || 'local'));
      await activity.log(req, 'limit_control', {
        target: 'All restrictions',
        detail: 'cleared: everyone was ' + levelText(LC.entryOf(cfg.global)) + '; ' + roleCount + ' role and ' + userCount + ' user setting(s) removed',
      });
      res.json(await buildState());
    } catch (e) { res.status(500).json({ ok: false, error: 'Clearing failed. Nothing may have changed — reload to check.' }); }
  });

  app.get('/api/users/online', guard, async (req, res) => {
    try {
      const pa = require('./phone-app');
      const seen = await pa.presenceMap(pa.ONLINE_MS);
      res.json({ ok: true, online: Object.keys(seen), withinMinutes: Math.round(pa.ONLINE_MS / 60000) });
    } catch (e) { res.json({ ok: true, online: [], degraded: true }); }
  });

  // The screen's script. Built by scripts/build-renderer.js into server/admin-ui/ — outside
  // the public renderer folder — so the code, its wording and its endpoints reach nobody else.
  app.get('/api/control-centre/ui.js', guard, (req, res) => {
    fs.readFile(UI_FILE, 'utf8', (err, code) => {
      if (err) return res.status(404).type('text').send('// not built');
      res.set('Cache-Control', 'private, no-cache');
      res.type('application/javascript').send(code);
    });
  });
}

// The URL the console loads the screen from (with a content hash), or null when not built.
function uiScriptUrl() {
  try {
    const code = fs.readFileSync(UI_FILE);
    const h = require('crypto').createHash('sha1').update(code).digest('hex').slice(0, 10);
    return '/api/control-centre/ui.js?v=' + h;
  } catch (e) { return null; }
}

module.exports = { mount, strictAdmin, parseChange, buildState, uiScriptUrl, restrictableRoles, clearAllChanges, UI_FILE };
