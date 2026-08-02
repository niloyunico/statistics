/* UNICO — admin-only User Management API.
 *
 * Powers the "Users & Roles" panel (UserManagement in renderer/unico/reports.jsx):
 * list/create/edit accounts, reset passwords, activate/deactivate, delete — all
 * against the same MongoDB `users` collection used for login (server/db.js getUsers()).
 *
 * Auth: each route runs requireApi (sets req.user) then need(action), which resolves the
 * caller's access to THIS module. In the default open local mode (REQUIRE_AUTH=false)
 * req.user is null and the gate is a no-op, so the local PC admin manages users without a
 * login wall. With REQUIRE_AUTH=true: Administrators are unrestricted, and a 'User' granted
 * the Administration module gets exactly the actions in its perms map — view to list, add
 * to create, edit to update/reset passwords, delete to remove. A delegated user MAY assign
 * the Administrator role (deliberate: full delegation), so grant Administration only to
 * people you would make administrators anyway.
 *
 * Mounted by web.js:  require('./users-admin').mount(app, { requireApi })
 */
const db = require('./db');
const auth = require('./auth');
const deptmap = require('./deptmap');
const activity = require('./activity-log');

const ROLES = ['Administrator', 'collector', 'User'];

// Grantable workspaces (per-module access for the standard 'User' role). Ids match
// the renderer's unicoAccessModuleOf() output so a user's `perms` map keys 1:1 to
// sidebar destinations. Administrators are unrestricted; collectors use their own
// portal; a 'User' gets exactly the access levels in `perms`.
const ACCESS_MODULES = ['stats', 'quality', 'staff', 'datacol', 'reports', 'users'];

// Per-module access level, ESCALATING: each level includes every one before it.
//   none   → module hidden
//   view   → read-only
//   edit   → may modify existing records
//   add    → may modify + create new
//   delete → full control (modify + create + delete)
const PERM_LEVELS = ['none', 'view', 'edit', 'add', 'delete'];
const PERM_ACTIONS = ['view', 'edit', 'add', 'delete'];
const fullPerms = () => ACCESS_MODULES.reduce((m, k) => (m[k] = 'delete', m), {});
const nonePerms = () => ACCESS_MODULES.reduce((m, k) => (m[k] = 'none', m), {});
// Normalise an incoming perms object to a complete map over the known modules. Each
// module value is either an ARRAY of independently-granted actions (new model, e.g.
// ['view','edit','delete']) or a legacy escalating LEVEL string. Unknown module keys
// are dropped; invalid entries => 'none'. Any granted action forces 'view' (a user
// must be able to open a module to edit/add/delete in it), and actions are stored in
// canonical order.
function cleanPerms(v) {
  const out = nonePerms();
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    ACCESS_MODULES.forEach((k) => {
      const val = v[k];
      if (Array.isArray(val)) {
        let acts = val.filter((a) => PERM_ACTIONS.includes(a));
        if (acts.some((a) => a !== 'view') && acts.indexOf('view') < 0) acts.push('view');
        acts = PERM_ACTIONS.filter((a) => acts.indexOf(a) >= 0);   // canonical order + dedupe
        out[k] = acts.length ? acts : 'none';
      } else {
        const lv = String(val || 'none'); if (PERM_LEVELS.includes(lv)) out[k] = lv;
      }
    });
  }
  return out;
}

// Public projection — never leak passwordHash.
function safe(u) {
  const role = u.role || 'User';
  return {
    username: u.username,
    name: u.name || u.username,
    email: u.email || null,
    title: u.title || null,           // display label / access template (e.g. "Manager")
    role,
    active: u.active !== false,
    departments: Array.isArray(u.departments) ? u.departments : [],
    qualityAreas: Array.isArray(u.qualityAreas) ? u.qualityAreas : [],
    allQualityAreas: !!u.allQualityAreas,
    qualityIndicators: (u.qualityIndicators && typeof u.qualityIndicators === 'object' && !Array.isArray(u.qualityIndicators)) ? u.qualityIndicators : {},
    // Per-module access levels. Administrators are always full; a 'User' carries its
    // own map; null = unrestricted (legacy account predating this feature => full access
    // until an admin assigns levels).
    perms: role === 'Administrator' ? fullPerms()
      : (u.perms && typeof u.perms === 'object' && !Array.isArray(u.perms)) ? cleanPerms(u.perms)
      : null,
    createdAt: u.createdAt || null,
    updatedAt: u.updatedAt || null,
  };
}
const norm = (s) => String(s || '').trim().toLowerCase();
const cleanList = (v) => Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean) : [];
// Specific-indicator access map: { areaKey: [indicatorId,...] } — empty lists dropped.
const cleanQI = (qi) => { const out = {}; if (!qi || typeof qi !== 'object' || Array.isArray(qi)) return out; Object.keys(qi).forEach(k => { const list = Array.isArray(qi[k]) ? qi[k].map(x => String(x).trim()).filter(Boolean) : []; if (list.length) out[String(k)] = list; }); return out; };

async function storedCustomAreas(user) {
  const map = await deptmap.get();
  if (user && user.allQualityAreas) return [];
  const auto = new Set();
  (Array.isArray(user && user.departments) ? user.departments : []).forEach((id) => {
    const ak = map.idToQk && map.idToQk[id];
    if (ak) auto.add(ak);
  });
  return (Array.isArray(user && user.qualityAreas) ? user.qualityAreas : []).filter((ak) => !auto.has(ak));
}

// Count active administrators (so we never strand the system without one).
async function activeAdminCount(users) {
  if (typeof users.find !== 'function') return 1; // dev shim: assume the seed admin
  const admins = await users.find({ role: 'Administrator', active: { $ne: false } }).toArray();
  return admins.length;
}

// Actions this session holds on the 'users' (Administration) module, or null when
// unrestricted. Granting that module used to be meaningless — every endpoint here demanded
// role === 'Administrator', so a User with Administration could open the panel and then got
// "Administrator access required" on every call. A delegated User now gets exactly the
// actions their perms map grants (view / add / edit / delete), including assigning the
// Administrator role. The login JWT carries only sub/role/name, so perms come from the DB.
async function usersModuleActions(req) {
  const claims = req.user;
  if (!claims) return null;                          // open local mode -> unrestricted
  if (claims.role === 'Administrator') return null;  // administrators -> unrestricted
  if (claims.role === 'collector') return [];        // collectors never manage accounts
  const users = await db.getUsers();
  if (typeof users.findOne !== 'function') return [];
  const me = await users.findOne({ username: norm(claims.sub || claims.username) });
  if (!me || me.active === false) return [];
  const p = (me.perms && typeof me.perms === 'object' && !Array.isArray(me.perms)) ? me.perms : {};
  const val = p.users;
  if (Array.isArray(val)) return PERM_ACTIONS.filter((a) => val.indexOf(a) >= 0);
  const i = PERM_LEVELS.indexOf(String(val || 'none'));   // legacy escalating level string
  return i <= 0 ? [] : PERM_ACTIONS.slice(0, i);
}

function mount(app, opts) {
  const requireApi = (opts && opts.requireApi) || ((req, res, next) => { req.user = null; next(); });
  const VERB = { view: 'view', add: 'create', edit: 'modify', delete: 'delete' };
  // Any granted action implies the module can be opened (matches unicoCan() in the renderer).
  const need = (action) => async (req, res, next) => {
    try {
      const acts = await usersModuleActions(req);
      if (acts === null) return next();
      const allowed = action === 'view' ? acts.length > 0 : acts.indexOf(action) >= 0;
      if (allowed) return next();
      return res.status(403).json({ ok: false, error: acts.length
        ? 'Your account cannot ' + VERB[action] + ' user accounts.'
        : 'Administrator access required.' });
    } catch (e) { return res.status(500).json({ ok: false, error: 'Could not verify permissions.' }); }
  };
  const guard = (action) => [requireApi, need(action)];

  // List every account.
  app.get('/api/users', guard('view'), async (req, res) => {
    try {
      const users = await db.getUsers();
      let list = [];
      if (typeof users.find === 'function') list = await users.find({}).sort({ role: 1, username: 1 }).toArray();
      res.json({ ok: true, users: list.map(safe), roles: ROLES });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not load users.' }); }
  });

  // Create an account.
  app.post('/api/users', guard('add'), async (req, res) => {
    const b = req.body || {};
    const username = norm(b.username);
    const password = String(b.password || '');
    if (!username) return res.status(400).json({ ok: false, error: 'Username is required.' });
    if (!/^[a-z0-9._-]{2,40}$/.test(username)) return res.status(400).json({ ok: false, error: 'Username may use letters, numbers, dot, dash, underscore (2–40 chars).' });
    if (password.length < 6) return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters.' });
    const role = ROLES.includes(b.role) ? b.role : 'User';
    try {
      const users = await db.getUsers();
      if (await users.findOne({ username })) return res.status(409).json({ ok: false, error: 'That username already exists.' });
      const departments = role === 'collector' ? cleanList(b.departments) : [];
      const allQualityAreas = role === 'collector' ? !!b.allQualityAreas : false;
      const doc = {
        username, name: String(b.name || username).trim(), role,
        email: String(b.email || '').trim().toLowerCase() || null,
        title: String(b.title || '').trim() || null,
        active: b.active !== false,
        departments,
        allQualityAreas,
        // Quality areas = departments' auto areas UNION custom/extra areas (b.qualityAreas), or
        // ALL when hospital-wide. Assign once + optional custom access on top.
        qualityAreas: role === 'collector' ? await deptmap.deriveQualityAreas(departments, allQualityAreas, cleanList(b.qualityAreas)) : [],
        qualityIndicators: role === 'collector' ? cleanQI(b.qualityIndicators) : {}, // specific-indicator access
        // Per-module access levels — only meaningful for the 'User' role. Admins are
        // full (null => resolved to full in safe()); collectors use the collector portal.
        perms: role === 'User' ? cleanPerms(b.perms) : null,
        passwordHash: await auth.hash(password),
        createdAt: Date.now(), updatedAt: Date.now(),
      };
      await users.insertOne(doc);
      activity.log(req, 'user_created', { target: username, detail: 'role: ' + role });
      res.json({ ok: true, user: safe(doc) });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not create user.' }); }
  });

  // Update name / role / active / scope.
  app.patch('/api/users/:username', guard('edit'), async (req, res) => {
    const username = norm(req.params.username);
    const b = req.body || {};
    try {
      const users = await db.getUsers();
      const u = await users.findOne({ username });
      if (!u) return res.status(404).json({ ok: false, error: 'User not found.' });

      const set = { updatedAt: Date.now() };
      if (b.name != null) set.name = String(b.name).trim();
      if (b.email != null) set.email = String(b.email).trim().toLowerCase() || null;
      if (b.title != null) set.title = String(b.title).trim() || null;
      if (b.role != null && ROLES.includes(b.role)) set.role = b.role;
      if (b.active != null) set.active = !!b.active;
      const role = set.role || u.role;
      if (role === 'collector') {
        const departments = (b.departments != null) ? cleanList(b.departments) : (Array.isArray(u.departments) ? u.departments : []);
        const allQualityAreas = (b.allQualityAreas != null) ? !!b.allQualityAreas : !!u.allQualityAreas;
        const customAreas = (b.qualityAreas != null) ? cleanList(b.qualityAreas) : await storedCustomAreas(u);
        if (b.departments != null) set.departments = departments;
        set.allQualityAreas = allQualityAreas;
        // Departments' auto areas UNION custom/extra areas (assign-once + custom access on top).
        set.qualityAreas = await deptmap.deriveQualityAreas(departments, allQualityAreas, customAreas);
        if (b.qualityIndicators != null) set.qualityIndicators = cleanQI(b.qualityIndicators);
      } else if (set.role && set.role !== 'collector') {
        set.departments = []; set.qualityAreas = []; set.allQualityAreas = false; set.qualityIndicators = {};
      }

      // Per-module access levels. Only the 'User' role carries a perms map; Administrators
      // and collectors are cleared to null (full / portal). Absent leaves it untouched.
      if (role === 'User') {
        if (b.perms !== undefined) set.perms = cleanPerms(b.perms);
      } else {
        set.perms = null;
      }

      // Never strand the system without an active administrator.
      // Only an ACTIVE administrator counts toward the total, so only demoting/deactivating
      // one can strand the system. Without the u.active check an already-inactive admin
      // could not be demoted at all while a single active admin existed.
      const demoting = u.role === 'Administrator' && u.active !== false
        && ((set.role && set.role !== 'Administrator') || set.active === false);
      if (demoting && (await activeAdminCount(users)) <= 1) {
        return res.status(400).json({ ok: false, error: 'Cannot demote or deactivate the last active administrator.' });
      }
      await users.updateOne({ username }, { $set: set });
      activity.log(req, 'user_updated', { target: username, detail: Object.keys(set).filter((k) => k !== 'updatedAt').join(', ') || 'no changes' });
      res.json({ ok: true, user: safe(Object.assign({}, u, set)) });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not update user.' }); }
  });

  // Reset password.
  app.post('/api/users/:username/password', guard('edit'), async (req, res) => {
    const username = norm(req.params.username);
    const password = String((req.body && req.body.password) || '');
    if (password.length < 6) return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters.' });
    try {
      const users = await db.getUsers();
      if (!await users.findOne({ username })) return res.status(404).json({ ok: false, error: 'User not found.' });
      await users.updateOne({ username }, { $set: { passwordHash: await auth.hash(password), updatedAt: Date.now() } });
      activity.log(req, 'password_reset', { target: username });
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not reset password.' }); }
  });

  // Delete an account.
  app.delete('/api/users/:username', guard('delete'), async (req, res) => {
    const username = norm(req.params.username);
    try {
      const users = await db.getUsers();
      const u = await users.findOne({ username });
      if (!u) return res.status(404).json({ ok: false, error: 'User not found.' });
      if (typeof users.deleteOne !== 'function') return res.status(400).json({ ok: false, error: 'Delete is unavailable in dev (no database) mode.' });
      // Deleting an INACTIVE admin cannot strand the system (they are not counted), so it
      // only needs blocking when the target is the last ACTIVE administrator.
      if (u.role === 'Administrator' && u.active !== false && (await activeAdminCount(users)) <= 1) {
        return res.status(400).json({ ok: false, error: 'Cannot delete the last active administrator.' });
      }
      await users.deleteOne({ username });
      activity.log(req, 'user_deleted', { target: username, detail: 'role: ' + (u.role || 'User') });
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not delete user.' }); }
  });

  /* ---- self-service: the signed-in user manages their OWN account (ANY role, no
     Administration permission needed) — used by the "My Account" screen. ---- */
  const meOf = (req) => (req.user && (req.user.sub || req.user.username)) || null;

  // Change my own password — requires the current password.
  app.post('/api/me/password', requireApi, async (req, res) => {
    const who = meOf(req);
    if (!who) return res.status(401).json({ ok: false, error: 'Sign in to change your password.' });
    const cur = String((req.body && req.body.currentPassword) || '');
    const nw = String((req.body && req.body.newPassword) || '');
    if (nw.length < 6) return res.status(400).json({ ok: false, error: 'New password must be at least 6 characters.' });
    try {
      const users = await db.getUsers();
      const uname = norm(who);
      const u = await users.findOne({ username: uname });
      if (!u) return res.status(404).json({ ok: false, error: 'Account not found.' });
      if (!(await auth.verify(cur, u.passwordHash))) return res.status(400).json({ ok: false, error: 'Your current password is incorrect.' });
      await users.updateOne({ username: uname }, { $set: { passwordHash: await auth.hash(nw), updatedAt: Date.now() } });
      activity.log(req, 'password_changed_self', { target: uname });
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not change your password.' }); }
  });

  // Update my own name / email.
  app.patch('/api/me', requireApi, async (req, res) => {
    const who = meOf(req);
    if (!who) return res.status(401).json({ ok: false, error: 'Sign in.' });
    try {
      const users = await db.getUsers();
      const uname = norm(who);
      const u = await users.findOne({ username: uname });
      if (!u) return res.status(404).json({ ok: false, error: 'Account not found.' });
      const b = req.body || {};
      const set = { updatedAt: Date.now() };
      if (b.name != null) set.name = String(b.name).trim() || u.username;
      if (b.email != null) set.email = String(b.email).trim().toLowerCase() || null;
      await users.updateOne({ username: uname }, { $set: set });
      res.json({ ok: true, user: safe(Object.assign({}, u, set)) });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not update your profile.' }); }
  });
}

module.exports = { mount };
