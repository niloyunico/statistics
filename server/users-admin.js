/* UNICO — admin-only User Management API.
 *
 * Powers the "Users" workspace (renderer/unico/user-admin.jsx): list/create/edit
 * accounts, reset passwords, activate/deactivate, delete — all against the same
 * MongoDB `users` collection used for login (server/db.js getUsers()).
 *
 * Auth: each route runs requireApi (sets req.user) then adminOnly. In the default
 * open local mode (REQUIRE_AUTH=false) req.user is null and adminOnly is a no-op,
 * so the local PC admin can manage users without a login wall; with
 * REQUIRE_AUTH=true an Administrator session is required.
 *
 * Mounted by web.js:  require('./users-admin').mount(app, { requireApi })
 */
const db = require('./db');
const auth = require('./auth');
const deptmap = require('./deptmap');

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
const fullPerms = () => ACCESS_MODULES.reduce((m, k) => (m[k] = 'delete', m), {});
const nonePerms = () => ACCESS_MODULES.reduce((m, k) => (m[k] = 'none', m), {});
// Normalise an incoming perms object to a complete {module: level} map over the known
// modules (unknown keys dropped, invalid/absent levels => 'none').
function cleanPerms(v) {
  const out = nonePerms();
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    ACCESS_MODULES.forEach((k) => { const lv = String(v[k] || 'none'); if (PERM_LEVELS.includes(lv)) out[k] = lv; });
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

function mount(app, opts) {
  const requireApi = (opts && opts.requireApi) || ((req, res, next) => { req.user = null; next(); });
  const adminOnly = (req, res, next) => {
    if (req.user && req.user.role && req.user.role !== 'Administrator') {
      return res.status(403).json({ ok: false, error: 'Administrator access required.' });
    }
    next();
  };
  const guard = [requireApi, adminOnly];

  // List every account.
  app.get('/api/users', guard, async (req, res) => {
    try {
      const users = await db.getUsers();
      let list = [];
      if (typeof users.find === 'function') list = await users.find({}).sort({ role: 1, username: 1 }).toArray();
      res.json({ ok: true, users: list.map(safe), roles: ROLES });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not load users.' }); }
  });

  // Create an account.
  app.post('/api/users', guard, async (req, res) => {
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
      res.json({ ok: true, user: safe(doc) });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not create user.' }); }
  });

  // Update name / role / active / scope.
  app.patch('/api/users/:username', guard, async (req, res) => {
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
      const demoting = u.role === 'Administrator' && ((set.role && set.role !== 'Administrator') || set.active === false);
      if (demoting && (await activeAdminCount(users)) <= 1) {
        return res.status(400).json({ ok: false, error: 'Cannot demote or deactivate the last active administrator.' });
      }
      await users.updateOne({ username }, { $set: set });
      res.json({ ok: true, user: safe(Object.assign({}, u, set)) });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not update user.' }); }
  });

  // Reset password.
  app.post('/api/users/:username/password', guard, async (req, res) => {
    const username = norm(req.params.username);
    const password = String((req.body && req.body.password) || '');
    if (password.length < 6) return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters.' });
    try {
      const users = await db.getUsers();
      if (!await users.findOne({ username })) return res.status(404).json({ ok: false, error: 'User not found.' });
      await users.updateOne({ username }, { $set: { passwordHash: await auth.hash(password), updatedAt: Date.now() } });
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not reset password.' }); }
  });

  // Delete an account.
  app.delete('/api/users/:username', guard, async (req, res) => {
    const username = norm(req.params.username);
    try {
      const users = await db.getUsers();
      const u = await users.findOne({ username });
      if (!u) return res.status(404).json({ ok: false, error: 'User not found.' });
      if (typeof users.deleteOne !== 'function') return res.status(400).json({ ok: false, error: 'Delete is unavailable in dev (no database) mode.' });
      if (u.role === 'Administrator' && (await activeAdminCount(users)) <= 1) {
        return res.status(400).json({ ok: false, error: 'Cannot delete the last active administrator.' });
      }
      await users.deleteOne({ username });
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not delete user.' }); }
  });
}

module.exports = { mount };
