/* UNICO — server-side ACCESS CONTROL (authorization).
 *
 * session.js answers one question: "is this request signed in?".
 * This module answers the other half — "is this user ALLOWED to see or change
 * this?" — and it is the ONLY place that decides.
 *
 * Why it exists: the per-module access levels (none < view < edit < add < delete)
 * were enforced only in the renderer (window.unicoCan in ui.jsx), so any signed-in
 * account could still read and overwrite EVERY module by calling the API directly
 * with curl or the browser console. The sidebar hid the buttons; the data itself
 * was never protected. A permission that is not checked on the server is a label,
 * not a permission.
 *
 * Three layers, all enforced here:
 *   1. MODULE — may this user touch the staff / quality / stats / … module at all?
 *   2. KEY    — which keys of the shared app-state blob may they read
 *               (GET /api/data) and write (PUT /api/data)?
 *   3. ROW    — inside the staff module, WHICH people: everyone, only their own
 *               department(s), or only their own personnel record.
 *
 * Reads are FILTERED; writes are MERGED against the server's own copy. The merge is
 * not an optimisation — it is a safety requirement. The renderer mirrors localStorage
 * back wholesale (PUT /api/data, and `unico_staff_v3` is the entire staff array), so
 * a department-scoped user whose browser only ever held 12 of 192 staff would
 * otherwise push back a 12-record array and DELETE the other 180. Nothing a session
 * could not read may ever be removed by that session.
 */
const deptmap = require('./deptmap');
const { getUsers } = require('./db');

/* ---------------------------------------------------------------- modules --- */

// Grantable workspaces. Must stay in sync with UNICO_ACCESS_MODULES in
// renderer/unico/ui.jsx and ACCESS_MODULES in server/users-admin.js — the three
// lists are the same list, and 'supervisor' was previously missing from the two
// server-side ones, so Shift Supervisor Reports could never actually be granted.
const ACCESS_MODULES = ['stats', 'quality', 'supervisor', 'staff', 'datacol', 'reports', 'users', 'perf', 'roster', 'medicine'];

// Escalating legacy level strings. The newer model stores an ARRAY of independently
// granted actions (e.g. ['view','delete'] = delete without add); both are supported,
// exactly as unicoCan() does in the renderer, so the two gates never disagree.
const PERM_RANK = { none: 0, view: 1, edit: 2, add: 3, delete: 4 };
const ACTIONS = ['view', 'edit', 'add', 'delete'];

// Which module owns each key of the shared app-state blob (the localStorage mirror).
// A key that is not listed is DENIED to restricted users and preserved untouched on
// write — deny-by-default, so a module added later cannot silently leak before
// someone registers it here. registerUnknownKey() logs it once so that is obvious.
const KEY_MODULE = {
  unico_store_v3: 'stats',

  unico_quality_v2: 'quality',
  unico_capa_v1: 'quality',
  unico_lock_v1: 'quality',
  unico_manual_meta: 'quality',        // Quality Indicator Manual build metadata

  unico_staff_v3: 'staff',
  unico_staff_customfields_v1: 'staff',
  unico_staff_fieldopts_v1: 'staff',

  unico_qc_report_presets_v1: 'reports',
  unico_report_builder_v1: 'reports',
  unico_report_sig_v1: 'reports',

  unico_users_v1: 'users',             // retired localStorage account mockup, still stored

  unico_med_fav_v1: 'medicine',        // saved drugs (per browser, mirrored)
  unico_med_recent_v1: 'medicine',     // recently viewed drugs

  unico_sup_fields_v1: 'supervisor',
  unico_sup_rowclip_v1: 'supervisor',
  unico_sup_suggestions_v1: 'supervisor',
};
// Per-shift supervisor drafts are keyed unico_sup_draft_<id>, so match by prefix too.
const KEY_PREFIX_MODULE = [['unico_sup_draft_', 'supervisor']];

const _warnedKeys = new Set();
const WARN_CAP = 100; // a developer aid, not an audit log — never let a caller grow it
function moduleOfKey(key) {
  if (Object.prototype.hasOwnProperty.call(KEY_MODULE, key)) return KEY_MODULE[key];
  for (const [prefix, mod] of KEY_PREFIX_MODULE) if (key.indexOf(prefix) === 0) return mod;
  if (!_warnedKeys.has(key) && _warnedKeys.size < WARN_CAP) {
    _warnedKeys.add(key);
    console.warn('[unico-access] unregistered app-state key "' + key + '" — withheld from restricted users. Add it to KEY_MODULE in server/access.js.');
  }
  return null; // unknown -> deny to restricted users, never delete
}

/* ------------------------------------------------------------ staff scope --- */

// How much of the personnel register one account may see.
//   all         — every staff record (the historical behaviour; still the default so
//                 upgrading does not silently blank an existing user's roster)
//   departments — only staff whose department is in the account's department list
//   self        — only the account holder's OWN personnel record
const STAFF_SCOPES = ['all', 'departments', 'self'];
function cleanStaffScope(v) {
  const s = String(v || '').trim().toLowerCase();
  return STAFF_SCOPES.indexOf(s) >= 0 ? s : 'all';
}

/* ----------------------------------------------------------------- access --- */

// Resolved authority for one request. `unrestricted` covers open local-PC mode
// (REQUIRE_AUTH=false) and the Administrator role — both may do anything.
function unrestricted(user) {
  return { unrestricted: true, username: (user && user.sub) || null, role: (user && user.role) || null, staffScope: 'all' };
}

// Permissions come from the DATABASE, never from the JWT. The token carries only
// sub/role/name, and a token minted before an admin revoked access would otherwise
// keep its old rights for the rest of its 12h life.
const _cache = new Map();
const CACHE_TTL = 15000; // short: a revoked permission takes effect within 15s
function invalidate(username) {
  if (username) _cache.delete(String(username).toLowerCase());
  else _cache.clear();
}

const DB_UNREACHABLE = Symbol('db-unreachable');
async function loadUser(username) {
  const key = String(username || '').toLowerCase();
  if (!key) return null;
  const hit = _cache.get(key);
  if (hit && (Date.now() - hit.ts) < CACHE_TTL) return hit.user;
  let user = null;
  try {
    const users = await getUsers();
    user = await users.findOne({ username: key });
  } catch (e) {
    // Reuse the last known answer if we have one; otherwise say so explicitly rather
    // than reporting "no such user", which reads as a revoked session.
    return hit ? hit.user : DB_UNREACHABLE;
  }
  _cache.set(key, { user, ts: Date.now() });
  return user;
}

// The authority for req. Returns null when the account is gone / deactivated /
// its session was revoked — callers turn that into 401.
async function forRequest(req) {
  const session = require('./session');
  if (!session.authRequired()) return unrestricted(null); // open local-PC mode
  const claims = req.user || session.userFromReq(req);
  if (!claims) return null;

  const u = await loadUser(claims.sub);
  // Database unreachable: keep the session alive but grant nothing. Signing the user
  // out here would bounce them to a /login that cannot reach the database either, so a
  // brief outage became a lockout. An empty perms map is the safe reading of "unknown".
  if (u === DB_UNREACHABLE) {
    return { unrestricted: false, degraded: true, username: claims.sub, name: claims.name, role: 'User', perms: {}, departments: [], qualityAreas: [], staffScope: 'self', staffId: null, staffEmpId: '' };
  }
  if (!u || u.active === false) return null;              // deactivated -> session dies now
  // Session revocation: bumping sessionEpoch on the user doc invalidates every token
  // already issued to them (password reset, role change, "sign out everywhere").
  const epoch = Number(u.sessionEpoch || 0);
  if (epoch && Number(claims.ep || 0) !== epoch) return null;

  const role = u.role || 'User';
  if (role === 'Administrator') return unrestricted(claims);

  const perms = (u.perms && typeof u.perms === 'object' && !Array.isArray(u.perms)) ? u.perms : {};
  return {
    unrestricted: false,
    username: u.username,
    name: u.name || u.username,
    role,
    perms,
    departments: Array.isArray(u.departments) ? u.departments : [],
    qualityAreas: Array.isArray(u.qualityAreas) ? u.qualityAreas : [],
    staffScope: cleanStaffScope(u.staffScope),
    staffId: (u.staffId === 0 || u.staffId) ? u.staffId : null,
    staffEmpId: u.staffEmpId ? String(u.staffEmpId).trim() : '',
  };
}

/* The two PORTAL roles. Neither carries a perms map: they do not open the admin
   application at all, they get their own scoped portal, and every route they may
   reach opts them in explicitly with `allowCollector`. An in-charge is a collector
   with a ward to run -- same data scoping, more of the ward's own screens. */
const PORTAL_ROLES = ['collector', 'incharge'];
function isPortal(access) { return !!access && PORTAL_ROLES.indexOf(access.role) >= 0; }

/* The unit's own staff, for a portal account.

   `filterStaff` answers "which staff may this ADMIN account see". This answers a
   different question -- "who works on the ward this person runs" -- and returns a
   deliberately thin record: a nurse in-charge needs to know who is on their unit and
   what they are, but has no business with a colleague's phone number, national ID,
   salary or personal remarks, so those fields never leave the server.

   `deptKeys` holds every spelling of the unit the caller knows -- the statistics id
   AND the canonical name -- because a staff record's `current_department` is typed by
   hand and holds either. Matching is exact after normalising away case and
   punctuation; substring matching was tried and is wrong ("ICU" would swallow every
   intensive-care unit in the hospital). */
/* What a ward lead may see about their own staff. Deliberately a whitelist, and
   deliberately WORK facts only: qualification, training, experience and Hep-B status
   are the things a nurse in charge is accountable for and rosters around. Personal
   contact details (phone), identity documents, salary, remarks and private notes are
   NOT here and must not be added without the same decision being taken again. */
const PORTAL_STAFF_FIELDS = [
  'id', 'emp_id', 'name', 'designation', 'current_department', 'role', 'active',
  'doj', 'qualification',
  'total_experience_text', 'total_experience_years',
  'special_training', 'hepatitis_b_vaccination',
];
function portalStaff(deptKeys, staff) {
  const norm = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const want = new Set((deptKeys || []).map(norm).filter(Boolean));
  if (!want.size) return [];
  return (staff || []).filter((p) => {
    if (!p || p.former) return false;
    // A staff record may list several departments, comma separated.
    return String(p.current_department || '').split(',').some((d) => want.has(norm(d)));
  }).map((p) => {
    const out = {};
    PORTAL_STAFF_FIELDS.forEach((k) => { if (p[k] !== undefined) out[k] = p[k]; });
    return out;
  });
}

// Can this access perform `action` on module `mid`? Mirrors unicoCan() in ui.jsx.
function can(access, mid, action) {
  if (!access) return false;
  if (access.unrestricted) return true;
  if (isPortal(access)) return false; // portal roles use their own scoped portal, not this map
  const val = access.perms ? access.perms[mid] : undefined;
  const act = ACTIONS.indexOf(action) >= 0 ? action : 'view';
  if (Array.isArray(val)) {
    if (act === 'view') return val.length > 0; // any granted action implies "may open it"
    return val.indexOf(act) >= 0;
  }
  return (PERM_RANK[val || 'none'] || 0) >= (PERM_RANK[act] || PERM_RANK.view);
}
// May they change anything at all in this module?
function canWrite(access, mid) {
  return can(access, mid, 'edit') || can(access, mid, 'add') || can(access, mid, 'delete');
}

/* ------------------------------------------------------------- middleware --- */

// Route guard: 401 when the session is invalid, 403 when it lacks the permission.
// Sets req.access so the handler can apply row-level scoping without reloading.
//
// opts.allowCollector lets a data COLLECTOR through to a route that does its own
// collector scoping (/api/departments and /api/quality narrow to the collector's
// assigned departments/areas inside the handler). Collectors carry no perms map, so
// without this they would be refused outright and the collection portal's live
// refresh would break.
function requirePerm(mid, action, opts) {
  const allowCollector = !!(opts && opts.allowCollector);
  return async function (req, res, next) {
    try {
      const access = await forRequest(req);
      if (!access) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
      req.access = access;
      if (allowCollector && isPortal(access)) return next();
      if (!can(access, mid, action || 'view')) {
        return res.status(403).json({ ok: false, error: 'You do not have access to this.' });
      }
      next();
    } catch (e) { res.status(500).json({ ok: false, error: 'Server error.' }); }
  };
}

// The CRUD action an HTTP method represents, so a whole module's routes can be
// guarded with one rule instead of hand-labelling every endpoint (and forgetting one).
function actionForMethod(method) {
  switch (String(method || '').toUpperCase()) {
    case 'GET': case 'HEAD': case 'OPTIONS': return 'view';
    case 'POST': return 'add';
    case 'PUT': case 'PATCH': return 'edit';
    case 'DELETE': return 'delete';
    default: return 'edit';
  }
}

// Modules a data COLLECTOR may reach. Collectors carry no perms map — their access is
// row-scoped by data-collection.js (assigned departments / quality areas / indicators),
// which is a different and already-working mechanism. They must not be evaluated
// against perms (they would all come out 'none' and the portal would break), but they
// must still be locked out of every module their portal does not use.
const COLLECTOR_MODULES = ['datacol'];

// Guard an entire mounted module. The required action is derived from the HTTP verb,
// so a read-only account can list submissions but not post one.
function requireModule(mid) {
  return async function (req, res, next) {
    try {
      const a = await forRequest(req);
      if (!a) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
      req.access = a;
      if (a.unrestricted) return next();
      if (isPortal(a)) {
        if (COLLECTOR_MODULES.indexOf(mid) >= 0) return next();
        return res.status(403).json({ ok: false, error: 'You do not have access to this.' });
      }
      if (!can(a, mid, actionForMethod(req.method))) {
        return res.status(403).json({ ok: false, error: 'You do not have access to this.' });
      }
      next();
    } catch (e) { res.status(500).json({ ok: false, error: 'Server error.' }); }
  };
}

// Attach req.access without demanding a specific permission (for routes that scope
// their own payload, e.g. /api/data).
async function attach(req, res, next) {
  try {
    const access = await forRequest(req);
    if (!access) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
    req.access = access;
    next();
  } catch (e) { res.status(500).json({ ok: false, error: 'Server error.' }); }
}

/* ---------------------------------------------------- staff row filtering --- */

const norm = (s) => String(s == null ? '' : s).trim().toLowerCase();

// Comparison key for a department string. Staff records carry FREE TEXT typed by
// whoever entered them, not canonical ids: the register says "IPD Cabin Level 10"
// while the roster says "Level-10", "Level 10", "Level - 10" and "Level- 10". Squashing
// away case, spacing, punctuation and &/and collapses those into one value, so an exact
// string compare stops throwing away a third of the roster.
function squash(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '');
}

// Local spellings that squashing alone cannot reconcile, mapped to the canonical
// department id. Measured against the live roster — before this, 62 of 198 staff sat
// under a value matching no department at all and were invisible to every
// department-scoped account. scripts/check-staff-dept-scope.js re-checks this.
// The register's own names are listed here as well as being read from deptmap. Two
// reasons: matching must not silently narrow when the deptmap cache is cold or the
// database is briefly unreachable, and a department that gets RENAMED keeps matching
// the staff records still carrying its old name (several were renamed in July 2026).
const DEPT_ALIASES = {
  lvl9: ['ipd cabin level 9', 'level 9', 'cabin level 9', 'ipd level 9', 'l9'],
  lvl10: ['ipd cabin level 10', 'level 10', 'cabin level 10', 'ipd level 10', 'l10'],
  ctvs: ['ctvs ot', 'ct ot', 'cardiac ot', 'cvts ot', 'cardiac theatre'],
  cticu: ['ctvs icu', 'ct icu', 'cardiac icu', 'cvts icu'],
  er: ['emergency medicine', 'emergency', 'emergency room', 'accident and emergency', 'casualty'],
  opd: ['out-patient department', 'out patient', 'outpatient', 'out patient department'],
  ccu: ['coronary care unit', 'coronary care', 'cardiac care unit'],
  micu: ['medical icu'],
  sicu: ['surgical icu'],
  nicu: ['neonatal icu', 'scbu'],
  ldr: ['labour , delivery & recovery room', 'labour room', 'labor room', 'delivery room', 'labour and delivery'],
  ot: ['general ot', 'operation theatre', 'operating theatre', 'main ot'],
  endoscopy: ['endoscopic suite'],
  homecare: ['family medicine', 'home care'],
  dialysis: ['daycare and dialysis', 'day care and dialysis', 'haemodialysis', 'hemodialysis'],
  cathlab: ['cath lab', 'catheterization lab', 'cath laboratory'],
  radiology: ['imaging', 'radiology and imaging'],
};
// "Level 10" / "Level-10" / "Level - 10" all squash to "level10" -> department id lvl10.
// A rule rather than an alias list so a future Level 11 needs no code change.
function levelRule(key) { const m = /^level(\d+)$/.exec(key); return m ? 'lvl' + m[1] : null; }

// Every comparison key a single staff record answers to. current_department can hold
// several units ("Medical ICU, CCU"), which the roster already treats as multi-valued.
function deptsOfStaff(rec) {
  const raw = [rec && rec.current_department, rec && rec.department, rec && rec.unit];
  const out = [];
  raw.forEach((v) => {
    if (!v) return;
    String(v).split(/[,;/]/).forEach((part) => {
      const k = squash(part);
      if (!k) return;
      out.push(k);
      const lv = levelRule(k);
      if (lv) out.push(squash(lv));
    });
  });
  return out;
}

// Every comparison key the departments this account is scoped to answer to: the
// canonical id, the register name, the quality key, and the local spellings above.
async function scopedDeptNames(access) {
  const keys = new Set();
  let map = null;
  try { map = await deptmap.get(); } catch (e) { map = null; }
  const addDept = (id) => {
    if (!id) return;
    keys.add(squash(id));
    const d = map && map.byId && map.byId[id];
    if (d) { if (d.name) keys.add(squash(d.name)); if (d.qualityKey) keys.add(squash(d.qualityKey)); }
    (DEPT_ALIASES[id] || []).forEach((a) => keys.add(squash(a)));
  };
  (access.departments || []).forEach(addDept);
  // A person assigned purely through quality areas still belongs to that unit.
  (access.qualityAreas || []).forEach((k) => {
    keys.add(squash(k));
    addDept(map && map.qkToId && map.qkToId[k]);
  });
  keys.delete('');
  return keys;
}

// Is one staff record visible to this access?
function staffVisible(access, rec, deptNames) {
  if (!access || access.unrestricted) return true;
  const scope = access.staffScope || 'all';
  if (scope === 'all') return true;
  if (scope === 'self') {
    if (access.staffId != null && rec && String(rec.id) === String(access.staffId)) return true;
    // emp_id is a weaker link: 39 records carry a blank one and two ids are duplicated,
    // so it only ever confirms a match, never stands in for a missing staffId.
    if (access.staffEmpId && rec && norm(rec.emp_id) && norm(rec.emp_id) === norm(access.staffEmpId)) return true;
    return false;
  }
  // 'departments'
  if (!deptNames || !deptNames.size) return false; // scoped to departments but assigned none
  return deptsOfStaff(rec).some((d) => deptNames.has(d));
}

// Filter a staff array for this access. Returns [] when the module itself is denied.
async function filterStaff(access, staff) {
  if (!access) return [];
  if (access.unrestricted) return staff || [];
  if (!can(access, 'staff', 'view')) return [];
  const scope = access.staffScope || 'all';
  if (scope === 'all') return staff || [];
  const deptNames = scope === 'departments' ? await scopedDeptNames(access) : null;
  return (staff || []).filter((r) => staffVisible(access, r, deptNames));
}

/* ------------------------------------------- app-state blob read filtering --- */

function mayReadKey(access, key) {
  if (access.unrestricted) return true;
  const mod = moduleOfKey(key);
  if (!mod) return false;              // unregistered key -> withheld
  return can(access, mod, 'view');
}
function mayWriteKey(access, key) {
  if (access.unrestricted) return true;
  const mod = moduleOfKey(key);
  if (!mod) return false;              // unregistered key -> never writable, never deleted
  return canWrite(access, mod);
}

// GET /api/data — hand back only the keys this session may see, with the staff
// register narrowed to the rows it may see.
async function scopeSnapshot(access, data) {
  if (!access) return {};
  if (access.unrestricted) return data || {};
  const out = {};
  const src = data || {};
  for (const key of Object.keys(src)) {
    if (!mayReadKey(access, key)) continue;
    if (key === 'unico_staff_v3') {
      out[key] = await scopeStaffOverlay(access, src[key]);
      continue;
    }
    out[key] = src[key];
  }
  return out;
}

// The staff overlay is the whole roster as one JSON array — narrow it in place so a
// scoped account never receives a colleague's record even inside the blob.
async function scopeStaffOverlay(access, raw) {
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    // Not the shape we can filter -> reveal nothing rather than passing it through.
    if (!Array.isArray(arr)) return JSON.stringify([]);
    return JSON.stringify(await filterStaff(access, arr));
  } catch (e) { return JSON.stringify([]); } // unparseable -> reveal nothing
}

/* ------------------------------------------ app-state blob write filtering --- */

// PUT /api/data — build the doc to store from the SERVER's current copy, letting the
// session overwrite only what it is allowed to write. Everything else survives
// untouched, including keys the session never received.
async function mergeAppData(access, incoming, current) {
  const cur = current || {};
  const inc = incoming || {};
  if (access && access.unrestricted) return inc; // admin / local mode: full mirror, unchanged

  const out = Object.assign({}, cur);
  for (const key of Object.keys(inc)) {
    if (!mayWriteKey(access, key)) continue;
    if (key === 'unico_staff_v3') {
      out[key] = await mergeStaffOverlay(access, inc[key], cur[key]);
      continue;
    }
    out[key] = inc[key];
  }
  // A key the session MAY write and deliberately dropped is a real deletion.
  for (const key of Object.keys(cur)) {
    if (key === 'unico_staff_v3') continue; // handled by the row merge above
    if (mayWriteKey(access, key) && !(key in inc)) delete out[key];
  }
  return out;
}

// Row-level merge of the staff roster: the session may add, edit and remove records
// inside its own scope; every record outside it is carried over from the server copy
// exactly as it was. This is what stops a department-scoped save from wiping the
// other 180 people the browser never held.
async function mergeStaffOverlay(access, rawIncoming, rawCurrent) {
  let incoming, currentArr;
  try { incoming = typeof rawIncoming === 'string' ? JSON.parse(rawIncoming) : rawIncoming; } catch (e) { incoming = null; }
  try { currentArr = typeof rawCurrent === 'string' ? JSON.parse(rawCurrent) : rawCurrent; } catch (e) { currentArr = null; }
  if (!Array.isArray(incoming)) return rawCurrent; // malformed -> keep the server copy
  if (!Array.isArray(currentArr)) currentArr = [];

  const scope = (access && access.staffScope) || 'all';
  if (access && access.unrestricted) return JSON.stringify(incoming);
  const deptNames = scope === 'departments' ? await scopedDeptNames(access) : null;

  const incomingById = new Map();
  incoming.forEach((r) => { if (r && r.id != null) incomingById.set(String(r.id), r); });

  const out = [];
  const seen = new Set();
  currentArr.forEach((rec) => {
    const id = rec && rec.id != null ? String(rec.id) : null;
    if (id) seen.add(id);
    const mine = staffVisible(access, rec, deptNames);
    if (!mine) { out.push(rec); return; }             // out of scope -> preserved verbatim
    const next = id ? incomingById.get(id) : null;
    if (next) out.push(next);                          // in scope + still present -> edited
    // in scope + absent from the payload -> a genuine delete by this session
  });
  // New records this session created. A scoped session may only create records that
  // land inside its own scope, so it cannot mint a person into another department.
  incoming.forEach((rec) => {
    const id = rec && rec.id != null ? String(rec.id) : null;
    if (id && seen.has(id)) return;
    if (scope === 'self') return;                      // self-view accounts never add staff
    if (staffVisible(access, rec, deptNames)) out.push(rec);
  });
  return JSON.stringify(out);
}

module.exports = {
  PORTAL_ROLES, isPortal, portalStaff,
  ACCESS_MODULES, ACTIONS, PERM_RANK, STAFF_SCOPES, cleanStaffScope,
  KEY_MODULE, moduleOfKey,
  forRequest, attach, requirePerm, requireModule, actionForMethod, can, canWrite, invalidate,
  filterStaff, staffVisible, scopedDeptNames,
  scopeSnapshot, mergeAppData, mergeStaffOverlay, mayReadKey, mayWriteKey,
};
