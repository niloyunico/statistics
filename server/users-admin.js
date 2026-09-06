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
const access = require('./access');
const session = require('./session');
const throttle = require('./login-throttle');

// 'incharge' is a data collector who also runs a ward: same scoping, more screens.
const ROLES = ['Administrator', 'incharge', 'collector', 'User'];
/* The roles that get the scoped PORTAL rather than the admin application. Their
   assignment fields (departments, quality areas, per-indicator access) must be saved
   and enforced the same way — an in-charge created without them would be an account
   with a ward's screens and nobody's scope. */
const ROLES_PORTAL = ['collector', 'incharge'];

// Grantable workspaces (per-module access for the standard 'User' role). Ids match
// the renderer's unicoAccessModuleOf() output so a user's `perms` map keys 1:1 to
// sidebar destinations. Administrators are unrestricted; collectors use their own
// portal; a 'User' gets exactly the access levels in `perms`.
// 'supervisor' was missing here while the renderer listed it, so Shift Supervisor
// Reports could never be granted to anyone: the panel offered no switch for it and
// cleanPerms() dropped the key. Kept in step with access.ACCESS_MODULES.
const ACCESS_MODULES = ['stats', 'quality', 'supervisor', 'staff', 'datacol', 'reports', 'users', 'perf', 'roster', 'medicine'];

// How much of the personnel register this account may see. Row-level scope, applied
// on the server by access.filterStaff(); see server/access.js.
const cleanStaffScope = access.cleanStaffScope;

// Changing any of these must invalidate every token the account already holds —
// otherwise a revoked permission stays live for the rest of the 12h token TTL.
const SECURITY_FIELDS = ['role', 'active', 'perms', 'roleTemplate', 'departments', 'qualityAreas', 'allQualityAreas', 'qualityIndicators', 'staffScope', 'staffId', 'staffEmpId'];
// Compare only what actually CHANGED. The update object always carries a few scope
// fields (qualityAreas, allQualityAreas...) whether or not they differ, so testing for
// mere presence signed a user out every time an admin fixed a typo in their name.
const sameVal = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
function stampRevocation(set, before) {
  const changed = SECURITY_FIELDS.some((k) => (k in set) && !sameVal(set[k], before && before[k]));
  if (changed) set.sessionEpoch = Date.now();
  return set;
}

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
    // Row-level staff scope: 'all' | 'departments' | 'self'. Meaningful once the
    // account has staff access at all; 'all' keeps existing accounts as they were.
    staffScope: role === 'Administrator' ? 'all' : cleanStaffScope(u.staffScope),
    staffId: (u.staffId === 0 || u.staffId) ? u.staffId : null,
    staffEmpId: u.staffEmpId || null,
    // Which admin-defined role template this account was granted from. A LABEL only:
    // `perms` above is what the server actually enforces, so a template that is later
    // edited or deleted cannot change what this account may do until an administrator
    // explicitly re-applies it.
    roleTemplate: u.roleTemplate || null,
    // Profile picture (set by the account owner via /api/upload kind=profile).
    // Only the CDN url is exposed — publicId stays server-side.
    photo: (u.photo && u.photo.url) ? { url: u.photo.url } : null,
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
  // Authority is resolved by access.forRequest(), which reads the LIVE user document.
  // This used to branch on req.user.role — the JWT claim — and return "unrestricted"
  // for anyone whose token SAID Administrator. So demoting or deactivating an
  // administrator left them with full account-management power (including promoting
  // themselves back) until their 12h token expired. The claim is a snapshot of who
  // they were when they signed in; only the database knows who they are now.
  const a = await access.forRequest(req);
  if (!a) return [];                                 // deactivated / revoked / unknown
  if (a.unrestricted) return null;                   // open local mode or a real Administrator
  if (ROLES_PORTAL.indexOf(a.role) >= 0) return [];  // portal accounts never manage accounts
  const p = (a.perms && typeof a.perms === 'object' && !Array.isArray(a.perms)) ? a.perms : {};
  const val = p.users;
  if (Array.isArray(val)) return PERM_ACTIONS.filter((x) => val.indexOf(x) >= 0);
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

  /* ---------------- Role templates (custom, admin-defined) -----------------
     A role template is a NAMED set of per-module actions -- "Nurse Manager",
     "Ward In-charge", "Acting In-charge" -- that an administrator can create,
     edit and delete without a code change. Assigning one to an account COPIES
     its perms onto that account.

     The copy is deliberate. `users.perms` stays the single authority the server
     enforces (access.js), so a template is a convenience for granting, never a
     second place where permission is decided -- a template that was edited or
     deleted could otherwise silently change what a live session may do. Editing
     a template therefore does nothing on its own; "Apply to members" re-pushes
     it to the accounts stamped with it, which is explicit and logged.

     Built-ins are editable but NOT deletable, so the dropdown can never end up
     empty. Nothing here removes an account or its permissions: deleting a
     template only clears the `roleTemplate` label. */
  const BUILTIN_TEMPLATES = [
    { id: 'nurse-manager', name: 'Nurse Manager', description: 'Runs the nursing service - full roster and staffing control, appraisals, and read access to the hospital numbers.',
      perms: { stats: 'view', quality: 'add', supervisor: 'add', staff: 'add', datacol: 'add', reports: 'view', users: 'none', perf: 'delete', roster: 'delete', medicine: 'view' } },
    { id: 'ward-incharge', name: 'Ward In-charge', description: 'Runs one unit: builds and maintains its duty roster, submits its data, records its supervision.',
      perms: { stats: 'view', quality: 'add', supervisor: 'add', staff: 'edit', datacol: 'add', reports: 'view', users: 'none', perf: 'edit', roster: 'add', medicine: 'view' } },
    { id: 'acting-incharge', name: 'Acting In-charge', description: 'Covering an in-charge: the same day-to-day screens, but cannot delete a published roster.',
      perms: { stats: 'view', quality: 'edit', supervisor: 'add', staff: 'view', datacol: 'add', reports: 'view', users: 'none', perf: 'view', roster: 'edit', medicine: 'view' } },
    { id: 'manager', name: 'Manager', description: 'Cross-department oversight - may edit most registers, may not administer accounts.',
      perms: { stats: 'edit', quality: 'edit', supervisor: 'edit', staff: 'edit', datacol: 'edit', reports: 'edit', users: 'view', perf: 'edit', roster: 'edit', medicine: 'view' } },
    { id: 'department-head', name: 'Department Head', description: 'Owns one department, its indicators and its people.',
      perms: { stats: 'view', quality: 'add', supervisor: 'add', staff: 'edit', datacol: 'add', reports: 'view', users: 'none', perf: 'edit', roster: 'view', medicine: 'view' } },
    { id: 'data-entry', name: 'Data Entry', description: 'Submits the monthly numbers and nothing else.',
      perms: { stats: 'view', quality: 'add', supervisor: 'add', staff: 'none', datacol: 'add', reports: 'view', users: 'none', perf: 'none', roster: 'none', medicine: 'none' } },
    { id: 'read-only', name: 'Read-only', description: 'Can look at everything it is scoped to, can change nothing.',
      perms: { stats: 'view', quality: 'view', supervisor: 'view', staff: 'view', datacol: 'view', reports: 'view', users: 'none', perf: 'view', roster: 'view', medicine: 'view' } },
  ];
  const TEMPLATES = 'roleTemplates';
  const tmplCol = async () => { const d = await db.getDbHandle(); return d ? d.collection(TEMPLATES) : null; };
  const slugId = (v) => String(v || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const shapeTemplate = (t) => ({
    id: t.id, name: t.name, description: String(t.description || ''),
    perms: cleanPerms(t.perms), builtin: !!t.builtin,
    updatedAt: t.updatedAt || 0, updatedBy: t.updatedBy || null,
  });
  // A stored row wins over the built-in default (a built-in may be re-tuned), and any
  // built-in with no stored row is served from code -- so a fresh database already has
  // a usable set of roles, with no seeding step that could half-fail.
  async function listTemplates() {
    let stored = [];
    try { const c = await tmplCol(); if (c) stored = await c.find({}).toArray(); } catch (e) { stored = []; }
    const byId = new Map(stored.map((t) => [t.id, t]));
    const out = BUILTIN_TEMPLATES.map((b) => shapeTemplate(Object.assign({}, b, byId.get(b.id) || {}, { builtin: true })));
    stored.filter((t) => !BUILTIN_TEMPLATES.some((b) => b.id === t.id))
      .forEach((t) => out.push(shapeTemplate(Object.assign({}, t, { builtin: false }))));
    return out;
  }
  // How many accounts carry each template -- shown in the panel so an administrator can
  // see what an edit is about to affect BEFORE applying it.
  async function templateCounts() {
    const counts = {};
    try {
      const users = await db.getUsers();
      if (typeof users.find === 'function') {
        (await users.find({}).toArray()).forEach((u) => { if (u && u.roleTemplate) counts[u.roleTemplate] = (counts[u.roleTemplate] || 0) + 1; });
      }
    } catch (e) { /* counts are informational only */ }
    return counts;
  }

  app.get('/api/roles', guard('view'), async (req, res) => {
    try { res.json({ ok: true, templates: await listTemplates(), counts: await templateCounts(), modules: ACCESS_MODULES, actions: PERM_ACTIONS }); }
    catch (e) { res.status(500).json({ ok: false, error: 'Could not load role templates.' }); }
  });

  app.post('/api/roles', guard('add'), async (req, res) => {
    const b = req.body || {};
    const name = String(b.name || '').trim().slice(0, 60);
    if (!name) return res.status(400).json({ ok: false, error: 'Role name is required.' });
    const id = slugId(b.id || name);
    if (!id) return res.status(400).json({ ok: false, error: 'The role name must contain a letter or a number.' });
    try {
      const c = await tmplCol();
      if (!c) return res.status(503).json({ ok: false, error: 'Database unavailable - cannot save role templates.' });
      if ((await listTemplates()).some((t) => t.id === id)) return res.status(409).json({ ok: false, error: 'A role called "' + name + '" already exists.' });
      const doc = { id, name, description: String(b.description || '').trim().slice(0, 300), perms: cleanPerms(b.perms), builtin: false, createdAt: Date.now(), updatedAt: Date.now(), updatedBy: meOf(req) };
      await c.insertOne(doc);
      activity.log(req, 'role_template_created', { target: id, name });
      res.json({ ok: true, template: shapeTemplate(doc) });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not create the role template.' }); }
  });

  app.put('/api/roles/:id', guard('edit'), async (req, res) => {
    const id = slugId(req.params.id);
    const b = req.body || {};
    try {
      const c = await tmplCol();
      if (!c) return res.status(503).json({ ok: false, error: 'Database unavailable - cannot save role templates.' });
      const builtin = BUILTIN_TEMPLATES.find((t) => t.id === id);
      const cur = await c.findOne({ id });
      if (!builtin && !cur) return res.status(404).json({ ok: false, error: 'That role template no longer exists.' });
      const base = Object.assign({}, builtin || {}, cur || {});
      const set = {
        id,
        name: b.name != null ? (String(b.name).trim().slice(0, 60) || base.name) : base.name,
        description: b.description != null ? String(b.description).trim().slice(0, 300) : (base.description || ''),
        perms: cleanPerms(b.perms != null ? b.perms : base.perms),
        builtin: !!builtin,
        updatedAt: Date.now(), updatedBy: meOf(req),
      };
      await c.updateOne({ id }, { $set: set, $setOnInsert: { createdAt: Date.now() } }, { upsert: true });
      activity.log(req, 'role_template_updated', { target: id, name: set.name });
      res.json({ ok: true, template: shapeTemplate(set) });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not update the role template.' }); }
  });

  app.delete('/api/roles/:id', guard('delete'), async (req, res) => {
    const id = slugId(req.params.id);
    if (BUILTIN_TEMPLATES.some((t) => t.id === id)) return res.status(400).json({ ok: false, error: 'Built-in roles cannot be deleted. Edit their permissions instead.' });
    try {
      const c = await tmplCol();
      if (!c) return res.status(503).json({ ok: false, error: 'Database unavailable.' });
      const r = await c.deleteOne({ id });
      if (!r.deletedCount) return res.status(404).json({ ok: false, error: 'That role template no longer exists.' });
      // Accounts keep every permission they already hold; they simply stop being
      // labelled with a template that no longer exists. Deleting a role must never
      // take access away from a person who is working today.
      let unstamped = 0;
      try {
        const users = await db.getUsers();
        if (typeof users.updateMany === 'function') unstamped = (await users.updateMany({ roleTemplate: id }, { $set: { roleTemplate: null } })).modifiedCount || 0;
      } catch (e) { /* the label is cosmetic */ }
      activity.log(req, 'role_template_deleted', { target: id, unstamped });
      res.json({ ok: true, unstamped });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not delete the role template.' }); }
  });

  // Push a template's permissions onto every account stamped with it. Explicit and
  // logged, because it CHANGES what live sessions may do -- hence the epoch bump.
  app.post('/api/roles/:id/apply', guard('edit'), async (req, res) => {
    const id = slugId(req.params.id);
    try {
      const t = (await listTemplates()).find((x) => x.id === id);
      if (!t) return res.status(404).json({ ok: false, error: 'That role template no longer exists.' });
      const users = await db.getUsers();
      if (typeof users.find !== 'function') return res.status(503).json({ ok: false, error: 'Database unavailable.' });
      const targets = await users.find({ roleTemplate: id, role: 'User' }).toArray();
      let n = 0;
      for (const u of targets) {
        await users.updateOne({ username: u.username }, { $set: { perms: cleanPerms(t.perms), sessionEpoch: Date.now(), updatedAt: Date.now() } });
        access.invalidate(u.username);
        n++;
      }
      activity.log(req, 'role_template_applied', { target: id, users: n });
      res.json({ ok: true, updated: n });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not apply the role template.' }); }
  });

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
      // Collectors: their data-collection assignment. Plain Users: the row-level scope
      // for the staff register (staffScope 'departments'). Administrators: neither.
      const departments = (ROLES_PORTAL.indexOf(role) >= 0 || role === 'User') ? cleanList(b.departments) : [];
      const allQualityAreas = ROLES_PORTAL.indexOf(role) >= 0 ? !!b.allQualityAreas : false;
      const doc = {
        username, name: String(b.name || username).trim(), role,
        email: String(b.email || '').trim().toLowerCase() || null,
        title: String(b.title || '').trim() || null,
        active: b.active !== false,
        departments,
        allQualityAreas,
        // Quality areas = departments' auto areas UNION custom/extra areas (b.qualityAreas), or
        // ALL when hospital-wide. Assign once + optional custom access on top.
        qualityAreas: ROLES_PORTAL.indexOf(role) >= 0 ? await deptmap.deriveQualityAreas(departments, allQualityAreas, cleanList(b.qualityAreas)) : [],
        qualityIndicators: ROLES_PORTAL.indexOf(role) >= 0 ? cleanQI(b.qualityIndicators) : {}, // specific-indicator access
        // Per-module access levels — only meaningful for the 'User' role. Admins are
        // full (null => resolved to full in safe()); collectors use the collector portal.
        perms: role === 'User' ? cleanPerms(b.perms) : null,
        roleTemplate: role === 'User' ? (String(b.roleTemplate || '').trim() || null) : null,
        // Row-level staff scope + the personnel record this login belongs to (needed
        // for scope 'self', where the account may see only its own file).
        staffScope: role === 'Administrator' ? 'all' : cleanStaffScope(b.staffScope),
        staffId: (b.staffId === 0 || b.staffId) ? b.staffId : null,
        staffEmpId: String(b.staffEmpId || '').trim() || null,
        passwordHash: await auth.hash(password),
        // Bumped whenever access changes; every issued token carries the value it was
        // signed with, so raising it signs the account out everywhere.
        sessionEpoch: Date.now(),
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
      if (ROLES_PORTAL.indexOf(role) >= 0) {
        const departments = (b.departments != null) ? cleanList(b.departments) : (Array.isArray(u.departments) ? u.departments : []);
        const allQualityAreas = (b.allQualityAreas != null) ? !!b.allQualityAreas : !!u.allQualityAreas;
        const customAreas = (b.qualityAreas != null) ? cleanList(b.qualityAreas) : await storedCustomAreas(u);
        if (b.departments != null) set.departments = departments;
        set.allQualityAreas = allQualityAreas;
        // Departments' auto areas UNION custom/extra areas (assign-once + custom access on top).
        set.qualityAreas = await deptmap.deriveQualityAreas(departments, allQualityAreas, customAreas);
        if (b.qualityIndicators != null) set.qualityIndicators = cleanQI(b.qualityIndicators);
      } else if (role === 'User') {
        // A 'User' keeps a department list too — not for data-collection assignment
        // (that is the collector mechanism) but as the row-level scope for the staff
        // register: "this in-charge sees Medical ICU staff and no one else". The
        // quality-area/indicator assignment stays collector-only.
        if (b.departments != null) set.departments = cleanList(b.departments);
        set.qualityAreas = []; set.allQualityAreas = false; set.qualityIndicators = {};
      } else if (set.role && ROLES_PORTAL.indexOf(set.role) < 0) {
        // Demoted out of a portal role: the assignment fields go with it. Testing a
        // single role here would have wiped an in-charge's own ward on any edit.
        set.departments = []; set.qualityAreas = []; set.allQualityAreas = false; set.qualityIndicators = {};
      }

      // Row-level staff scope. Administrators are always unrestricted.
      if (role === 'Administrator') {
        set.staffScope = 'all';
      } else {
        if (b.staffScope !== undefined) set.staffScope = cleanStaffScope(b.staffScope);
        if (b.staffId !== undefined) set.staffId = (b.staffId === 0 || b.staffId) ? b.staffId : null;
        if (b.staffEmpId !== undefined) set.staffEmpId = String(b.staffEmpId || '').trim() || null;
      }

      // Per-module access levels. Only the 'User' role carries a perms map; Administrators
      // and collectors are cleared to null (full / portal). Absent leaves it untouched.
      if (role === 'User') {
        if (b.perms !== undefined) set.perms = cleanPerms(b.perms);
        if (b.roleTemplate !== undefined) set.roleTemplate = String(b.roleTemplate || '').trim() || null;
      } else {
        set.perms = null;
        set.roleTemplate = null;
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
      stampRevocation(set, u); // a real access change takes effect now, not in 12h
      await users.updateOne({ username }, { $set: set });
      access.invalidate(username); // drop the 15s permission cache for this account
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
      // A password reset must end every session opened with the OLD password —
      // otherwise resetting a compromised account leaves the intruder signed in.
      await users.updateOne({ username }, { $set: { passwordHash: await auth.hash(password), sessionEpoch: Date.now(), updatedAt: Date.now() } });
      access.invalidate(username);
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
      access.invalidate(username); // a deleted account's token must stop working now
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
    // This endpoint verifies a password, so it is a credential-checking endpoint and
    // belongs behind the same counter as the two login doors. It was not: somebody with
    // a stolen session cookie (but not the password) could guess `currentPassword` at
    // unlimited rate against a clean oracle — "incorrect" versus success — and burn a
    // bcrypt per guess while doing it.
    const tkey = throttle.keyOf(req, 'pwchange:' + norm(who));
    const wait = await throttle.blockedFor(tkey);
    if (wait > 0) {
      res.set('Retry-After', String(wait));
      return res.status(429).json({ ok: false, error: 'Too many attempts. Try again in about ' + Math.ceil(wait / 60) + ' minute(s).' });
    }
    try {
      const users = await db.getUsers();
      const uname = norm(who);
      const u = await users.findOne({ username: uname });
      if (!u) return res.status(404).json({ ok: false, error: 'Account not found.' });
      if (!(await auth.verify(cur, u.passwordHash))) {
        await throttle.noteFail(tkey);
        return res.status(400).json({ ok: false, error: 'Your current password is incorrect.' });
      }
      await throttle.clear(tkey);
      // Changing your own password must end every OTHER session on the account —
      // that is the whole point of changing it after a suspected compromise. Bump the
      // epoch (killing all existing tokens) and immediately re-issue a cookie for THIS
      // browser, so the person who just changed it stays signed in and nobody else does.
      const epoch = Date.now();
      await users.updateOne({ username: uname }, { $set: { passwordHash: await auth.hash(nw), sessionEpoch: epoch, updatedAt: Date.now() } });
      access.invalidate(uname);
      try { session.setSession(res, auth.sign(Object.assign({}, u, { sessionEpoch: epoch }))); } catch (e) { /* Bearer clients just re-login */ }
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
      // Contact details are the account holder's own to maintain. Role, permissions,
      // department scope and `title` are deliberately NOT here: those are an admin's
      // decision, and accepting them from this route would let any account promote
      // itself. Only ever add self-descriptive fields below.
      if (b.phone != null) set.phone = String(b.phone).trim().slice(0, 40) || null;
      if (b.designation != null) set.designation = String(b.designation).trim().slice(0, 80) || null;
      await users.updateOne({ username: uname }, { $set: set });
      res.json({ ok: true, user: safe(Object.assign({}, u, set)) });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not update your profile.' }); }
  });
}

module.exports = { mount };
