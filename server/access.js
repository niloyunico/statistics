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
// 'datasubmit' (Data Submission) and 'staffapp' (the phone staff app) replace the old
// PORTAL roles: submitting data for chosen departments, and signing in to the staff app,
// are modules a normal account is given, not separate kinds of account.
const ACCESS_MODULES = ['stats', 'quality', 'supervisor', 'staff', 'datacol', 'reports', 'users', 'perf', 'roster', 'medicine', 'datasubmit', 'staffapp'];

// Escalating legacy level strings. The newer model stores an ARRAY of independently
// granted actions (e.g. ['view','delete'] = delete without add); both are supported,
// exactly as unicoCan() does in the renderer, so the two gates never disagree.
const PERM_RANK = { none: 0, view: 1, edit: 2, add: 3, delete: 4 };
/* 'print' IS NOT ON THE LADDER. view<edit<add<delete is an escalation of how much harm
   you can do to the record; printing is a different axis entirely — it takes the record
   OUT of the system, onto paper that leaves the building. Somebody may be trusted to
   correct a phone number and not to walk out with an appraisal file, and the reverse is
   just as common. So it is an independent action, granted on its own, and a legacy
   escalating LEVEL STRING never implies it: no level ever meant "may print", so reading
   one as though it did would hand out a permission nobody was given.

   ⚠️ THAT IS A SILENT CAPABILITY REMOVAL for one shape of account, and the diff that
   introduced it reads as purely additive. An account whose perms[mid] is the STRING
   'edit' / 'add' / 'delete' passed a print check before this existed and fails it now.
   Measured against the live register when it shipped (2026-09-19) that was nobody:
   administrators are unrestricted, portal roles are refused by can() anyway, and no
   remaining account held staff or perf at edit or above. The exposure is future-facing —
   an account CREATED LATER, or RESTORED FROM A BACKUP taken before the action existed,
   can arrive carrying a legacy level string and will have no Print button with nothing
   on screen to explain why. The fix in that case is to open the account in Users & Roles
   and tick Print; do NOT "repair" it by making a level imply print, which would hand
   printing to every legacy account at once. */
const ACTIONS = ['view', 'edit', 'add', 'delete', 'print'];

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
  unico_privilege_custom_v1: 'staff',
  unico_dept_privileges_v1: 'staff',
  unico_dept_privilege_groups_v1: 'staff',

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

/* ----------------------------------------------------------- roster scope --- */

// Which units' duty rosters one account may open, and write to once the `roster`
// module permission lets it write at all.
//
// Deliberately its OWN assignment rather than a reuse of staffScope. "Run the duty
// roster for MICU and CCU" and "see MICU and CCU personnel files" are different
// grants: tying them together meant a roster could only be scoped by ALSO narrowing
// the staff register, and every account left on the default staffScope 'all' — which
// is most of them — silently held every unit's roster.
//   all         — every unit
//   departments — only the units listed in rosterDepartments
// null (the field absent) = NOT SET: the account predates this field, so it keeps the
// behaviour it had before — see rosterDeptNames(). Nothing an existing account could
// reach yesterday disappears because this shipped.
const ROSTER_SCOPES = ['all', 'departments'];
function cleanRosterScope(v) {
  const s = String(v == null ? '' : v).trim().toLowerCase();
  return ROSTER_SCOPES.indexOf(s) >= 0 ? s : null;
}

/* ----------------------------------------------------------------- access --- */

// Resolved authority for one request. `unrestricted` covers open local-PC mode
// (REQUIRE_AUTH=false) and the Administrator role — both may do anything.
function unrestricted(user) {
  return { unrestricted: true, username: (user && user.sub) || null, role: (user && user.role) || null, staffScope: 'all', rosterScope: 'all', rosterDepartments: [], rosterEdit: true };
}

// Permissions come from the DATABASE, never from the JWT. The token carries only
// sub/role/name, and a token minted before an admin revoked access would otherwise
// keep its old rights for the rest of its 12h life.
const _cache = new Map();
// Short, because it is PER INSTANCE: invalidate() only reaches the instance that saved
// the change, so on Vercel a revoked permission lasts this long on every other one.
const CACHE_TTL = 3000;
// How old a remembered user may be and still stand in when the lookup FAILS.
const STALE_USER_MS = 60000;
// With the version-validated read cache: how long a record is trusted with no write to
// `users` anywhere — the backstop for an edit made outside the app (Atlas UI, a script).
const USER_FRESH_MS = 15000;
function invalidate(username) {
  if (username) _cache.delete(String(username).toLowerCase());
  else _cache.clear();
  try { const cache = require('./cache'); if (typeof cache.dropLocal === 'function') cache.dropLocal('users'); } catch (e) { /* best effort */ }
}

const DB_UNREACHABLE = Symbol('db-unreachable');
// opts.allowStale — a failed lookup may fall back to a recent copy. Only for READS: a
// write judged by a remembered (possibly revoked) record would apply rights the user no
// longer has; without it the request degrades and a save is refused with 503.
async function loadUser(username, opts) {
  const key = String(username || '').toLowerCase();
  if (!key) return null;
  // Read cache in 'mongo' mode: the record is re-read only when `users` actually changed
  // somewhere in the fleet (every write through the app's Db handle bumps it) or after
  // USER_FRESH_MS. revalidateMs 0: past the fresh window the lookup waits for the
  // database rather than serving a possibly revoked record. Not in 'redis' mode — that
  // would copy password hashes into Redis.
  const cache = require('./cache');
  if (typeof cache.mode === 'function' && cache.mode() === 'mongo') {
    try {
      return await cache.read('user:' + key,
        { coll: 'users', freshMs: USER_FRESH_MS, revalidateMs: 0, staleMs: STALE_USER_MS, noRescue: !(opts && opts.allowStale) },
        async () => (await getUsers()).findOne({ username: key }));
    } catch (e) {
      return DB_UNREACHABLE;
    }
  }
  const hit = _cache.get(key);
  if (hit && (Date.now() - hit.ts) < CACHE_TTL) return hit.user;
  let user = null;
  try {
    const users = await getUsers();
    user = await users.findOne({ username: key });
  } catch (e) {
    // Reuse a RECENT answer if we have one; otherwise say so explicitly rather than
    // reporting "no such user", which reads as a revoked session. Only recent: a user
    // deactivated or stripped of access on another instance must not keep the old
    // rights here for as long as this lookup keeps failing.
    return opts && opts.allowStale && hit && (Date.now() - hit.ts) < STALE_USER_MS ? hit.user : DB_UNREACHABLE;
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

  const u = await loadUser(claims.sub, { allowStale: /^(GET|HEAD|OPTIONS)$/i.test(String((req && req.method) || '')) });
  // Database unreachable: keep the session alive but grant nothing. Signing the user
  // out here would bounce them to a /login that cannot reach the database either, so a
  // brief outage became a lockout. An empty perms map is the safe reading of "unknown".
  if (u === DB_UNREACHABLE) {
    return { unrestricted: false, degraded: true, username: claims.sub, name: claims.name, role: 'User', perms: {}, departments: [], qualityAreas: [], staffScope: 'self', staffId: null, staffEmpId: '', rosterScope: 'departments', rosterDepartments: [], rosterEdit: false };
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
    // Duty-roster assignment, independent of the staff-register scope above.
    // null = never assigned, which rosterDeptNames() reads as "keep the old rule".
    rosterScope: cleanRosterScope(u.rosterScope),
    rosterDepartments: Array.isArray(u.rosterDepartments) ? u.rosterDepartments : [],
    // May a WARD IN-CHARGE build their own unit's roster in the portal? Off unless an
    // administrator grants it, and meaningless for every other role: a console account
    // is governed by the `roster` module permission, not by this flag.
    rosterEdit: u.rosterEdit === true,
    // Data Submission extras, set per person: runs a unit (its staff list, staff requests,
    // unit dashboard). Meaningful only alongside the 'datasubmit' module.
    unitLead: u.unitLead === true,
    // Staff app holders: which phone feature set they get ('nurse' | 'pca').
    appRole: u.appRole === 'pca' ? 'pca' : 'nurse',
    // Data Submission: WHICH kinds this person may send. Absent = both (every account
    // written before the choice existed keeps what it could do).
    submitKinds: cleanSubmitKinds(u.submitKinds),
    dsScreens: cleanDsScreens(u.dsScreens),
  };
}

/* The two PORTAL roles. Neither carries a perms map: they do not open the admin
   application at all, they get their own scoped portal, and every route they may
   reach opts them in explicitly with `allowCollector`. An in-charge is a collector
   with a ward to run -- same data scoping, more of the ward's own screens. */
const PORTAL_ROLES = ['collector', 'incharge', 'nurse', 'pca'];
function isPortal(access) { return !!access && PORTAL_ROLES.indexOf(access.role) >= 0; }

/* May this PORTAL account build a duty roster for its own unit?

   A portal account holds no perms map -- can() denies it every module by design -- so
   without this it could never write a roster at all, which is why roster editing has
   lived only in the nurse app. The grant is deliberately narrow:
     - the in-charge role only: a collector, nurse or PCA never edits a sheet;
     - `rosterEdit` explicitly granted by an administrator, never a role default;
     - and the unit scoping (rosterDeptNames) still applies on top, so this says WHETHER
       they may edit, never WHICH units.
   Approval is NOT included: publishing the sheet stays with an administrator. */
function portalMayEditRoster(access) {
  // The legacy in-charge portal role only. A normal account builds rosters through the Duty
  // Roster module permission, like anyone else.
  return !!access && !access.unrestricted && access.role === 'incharge' && access.rosterEdit === true;
}

/* ---- Data Submission, as a MODULE on a normal account ----
   The portal roles are being retired: "submits data for these departments" is the
   'datasubmit' module plus the account's own department / area / indicator selection,
   the same fields a collector always carried. The legacy roles keep working until every
   account is converted (scripts/convert-portal-accounts.js), so each check below answers
   for both shapes. */
const LEGACY_SUBMIT_ROLES = ['collector', 'incharge'];
/* The two kinds of data a Data Submission holder may send: monthly patient statistics
   and quality-indicator data. Set per person; absent means both. */
const SUBMIT_KINDS = ['patient', 'quality'];
function cleanSubmitKinds(v) {
  const o = (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  return { patient: o.patient !== false, quality: o.quality !== false };
}
/* The screens of the Data Submission module, each grantable on its own (Access Control →
   a person → Data Submission → "Screens they can open"). Only DATA screens: the roster,
   the unit's staff and staff requests are the Duty Roster and Staff Management modules.
   `dsScreens` absent = the defaults below, so an account saved before the checklist
   existed keeps what it had. */
const DS_SCREENS = ['missing', 'status', 'quality', 'patient', 'history'];   // 'quick' (Quick entry) removed 2026-09-23
function cleanDsScreens(v) {
  if (!Array.isArray(v)) return null;
  return DS_SCREENS.filter((s) => v.indexOf(s) >= 0);
}
// The screens this account may open (legacy portal and administrators: all of them).
function dsScreensOf(access) {
  if (!access || access.unrestricted || isPortal(access)) return DS_SCREENS.slice();
  const kinds = cleanSubmitKinds(access.submitKinds);
  return cleanDsScreens(access.dsScreens) || DS_SCREENS.filter((s) =>
    (s !== 'patient' || kinds.patient) && (s !== 'quality' && s !== 'status' || kinds.quality));
}
const mayOpenDsScreen = (access, screen) => dsScreensOf(access).indexOf(screen) >= 0;
// May this account send data of this kind ('patient' | 'quality')? Administrators, the Data
// Collection module and legacy portal accounts always may; a Data Submission holder only
// the kinds ticked for it.
function maySubmitKind(access, kind) {
  if (!access || access.unrestricted) return true;
  if (isPortal(access)) return true;
  if (can(access, 'datacol', 'add')) return true;
  if (!submitsData(access)) return false;
  if (cleanSubmitKinds(access.submitKinds)[kind] === false) return false;
  // With a screen checklist, the kind also needs one of its screens.
  const screens = cleanDsScreens(access.dsScreens);
  if (!screens) return true;
  return kind === 'patient' ? screens.indexOf('patient') >= 0
    : (screens.indexOf('quality') >= 0 || screens.indexOf('status') >= 0);
}
// May this account submit data at all?
function submitsData(access) {
  if (!access) return false;
  if (access.unrestricted) return true;
  if (LEGACY_SUBMIT_ROLES.indexOf(access.role) >= 0) return true;
  return access.role === 'User' && can(access, 'datasubmit', 'view');
}
/* Is this account held to its OWN departments / areas / indicators when it submits and
   reads submissions? Every legacy portal account is. A normal account is when it holds Data
   Submission but NOT Data Collection -- Data Collection is the reviewer's module and sees
   the whole hospital, exactly as before. */
function dataScoped(access) {
  if (!access || access.unrestricted) return false;
  if (isPortal(access)) return true;
  if (access.role !== 'User') return false;
  if (can(access, 'datacol', 'view')) return false;
  return can(access, 'datasubmit', 'view');
}
// Runs a unit: the old in-charge role, or a Data Submission holder marked unit lead.
function isUnitLead(access) {
  if (!access || access.unrestricted) return false;
  if (access.role === 'incharge') return true;
  return access.role === 'User' && access.unitLead === true && can(access, 'datasubmit', 'view');
}
/* Which column of the phone app's feature table a person uses: 'admin', 'console' (the
   in-charge feature set, the rule for console accounts since the app shipped), or one of
   the old portal columns. A normal account reads it from its MODULES: runs a unit ->
   'incharge'; any console module -> 'console'; only Data Submission -> 'collector'; only the
   Staff app -> 'nurse' or 'pca' (appRole, set with the module). */
const CONSOLE_MODULES = ACCESS_MODULES.filter((m) => m !== 'datasubmit' && m !== 'staffapp');
function phoneRoleOf(access) {
  if (!access) return 'nurse';
  if (access.unrestricted) return 'admin';
  if (isPortal(access)) return access.role;
  if (isUnitLead(access)) return 'incharge';
  if (CONSOLE_MODULES.some((m) => can(access, m, 'view'))) return 'console';
  if (can(access, 'datasubmit', 'view')) return 'collector';
  if (can(access, 'staffapp', 'view')) return access.appRole === 'pca' ? 'pca' : 'nurse';
  return 'console';
}

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
   NOT here and must not be added without the same decision being taken again.
   2026-09-15 (user request, in-charge staff profile pop-up): blood group, gender,
   extracurricular activities and the licence number/expiry were added, plus a TRIMMED
   BNMC verification summary (see portalStaff) -- never nid, phone, dob, address or the
   council's person/registrations snapshot. */
const PORTAL_STAFF_FIELDS = [
  'id', 'emp_id', 'name', 'designation', 'current_department', 'role', 'active',
  'doj', 'qualification',
  'total_experience_text', 'total_experience_years',
  'special_training', 'hepatitis_b_vaccination',
  'blood_group', 'gender', 'extracurricular', 'licence_no', 'licence_expiry',
];
// The "verified" badge needs when, which number and what the council said about it --
// not the stored council snapshot, whose person/registrations carry personal details.
function portalVerification(v) {
  if (!v || typeof v !== 'object') return null;
  const p = v.primary && typeof v.primary === 'object' ? v.primary : null;
  return {
    at: v.at || null,
    number: v.number || null,
    primary: p ? { regNo: p.regNo || null, course: p.course || null, institution: p.institution || null,
      status: p.status || null, renewUpto: p.renewUpto || null, expired: !!p.expired } : null,
  };
}
function portalStaff(deptKeys, staff) {
  // The same vocabulary department scoping uses (scopedDeptNames/deptsOfStaff): ids,
  // names, the local spellings in DEPT_ALIASES and the Level-N rule. A plain normaliser
  // hid "Level-10", "Level 10" and "Emergency" from the in-charges of those units.
  const want = new Set();
  (deptKeys || []).forEach((k) => {
    const s = squash(k);
    if (!s) return;
    want.add(s);
    const lv = levelRule(s);
    if (lv) want.add(squash(lv));
    (DEPT_ALIASES[k] || DEPT_ALIASES[s] || []).forEach((a) => want.add(squash(a)));
  });
  if (!want.size) return [];
  return (staff || []).filter((p) => p && !p.former && deptsOfStaff(p).some((d) => want.has(d))).map((p) => {
    const out = {};
    PORTAL_STAFF_FIELDS.forEach((k) => { if (p[k] !== undefined) out[k] = p[k]; });
    // The register photo, as a bare { url } -- the same picture the phone app's unit
    // staff screen already shows an in-charge. Stored as a string or a { url, ... }
    // upload record; only the URL leaves the server.
    const ph = p.photo || p.photo_url;
    const url = ph ? (typeof ph === 'string' ? ph : ph.url) : null;
    if (url) out.photo = { url };
    const ver = portalVerification(p.licence_verified);
    if (ver) out.licence_verified = ver;
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
  // Legacy level string: printing was never one of its rungs, so it is not granted.
  if (act === 'print') return false;
  return (PERM_RANK[val || 'none'] || 0) >= (PERM_RANK[act] || PERM_RANK.view);
}
// May they change anything at all in this module?
function canWrite(access, mid) {
  // Printing is not writing: it changes nothing in the record.
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
      // The handler scopes these callers itself (web.js collectorScope). A Data Submission
      // holder is let through the same way a portal account always was.
      if (allowCollector && (isPortal(access) || (submitsData(access) && !can(access, mid, action || 'view')))) return next();
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
// Which modules each PORTAL role may enter. A staff nurse or PCA on the phone app has
// no data-collection assignment, so they never reach the submissions API at all.
const PORTAL_MODULES = { collector: COLLECTOR_MODULES, incharge: COLLECTOR_MODULES, nurse: [], pca: [] };
// Read-only catalogue lookups every phone user needs (the formulary). GET only.
const PORTAL_READ_MODULES = ['medicine'];

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
        if ((PORTAL_MODULES[a.role] || []).indexOf(mid) >= 0) return next();
        if (PORTAL_READ_MODULES.indexOf(mid) >= 0 && actionForMethod(req.method) === 'view') return next();
        return res.status(403).json({ ok: false, error: 'You do not have access to this.' });
      }
      if (!can(a, mid, actionForMethod(req.method))) {
        // The submissions API (mounted on 'datacol') is also the Data Submission module's:
        // its holder reads and sends its own, row-scoped inside data-collection.js, and
        // every admin-only route there still checks adminOnly on top.
        if (mid === 'datacol' && submitsData(a)) return next();
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
// opts.departmentsOnly — only the units the account is ASSIGNED to, ignoring quality
// areas (used by rosters: quality access to many areas must not unlock their rosters).
async function scopedDeptNames(access, opts) {
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
  if (!(opts && opts.departmentsOnly)) (access.qualityAreas || []).forEach((k) => {
    keys.add(squash(k));
    addDept(map && map.qkToId && map.qkToId[k]);
  });
  keys.delete('');
  return keys;
}

/* The units whose duty rosters this access may open, as comparison keys.
   `null` means EVERY unit — deliberately distinct from an empty Set, which means the
   account is scoped to departments and has been assigned none (so: no rosters at all).

   The three readings of rosterScope:
     'all'          — every unit.
     'departments'  — exactly rosterDepartments, and nothing derived from anywhere
                      else. Quality areas do NOT unlock a roster: a hospital-wide
                      infection-control role holds every area, which used to hand it
                      every ward's roster.
     null (not set) — the account predates the field, so it keeps the rule that was in
                      force before: a portal account is held to its own ward, a console
                      account narrowed to departments for the staff register is held to
                      the same units, and anything else sees every roster. */
async function rosterDeptNames(access) {
  if (!access || access.unrestricted) return null;
  const scope = access.rosterScope;
  if (scope === 'all') return null;
  if (scope === 'departments') {
    return scopedDeptNames({ departments: access.rosterDepartments || [] }, { departmentsOnly: true });
  }
  if (dataScoped(access) || (access.staffScope || 'all') === 'departments') {
    return scopedDeptNames(access, { departmentsOnly: true });
  }
  return null;
}

// Is one roster's department string inside `deptKeys` (from rosterDeptNames)? The
// department is free text typed on the sheet, matched with the same vocabulary — ids,
// canonical names, aliases, the Level-N rule — that staff scoping uses.
function rosterVisible(deptKeys, dept) {
  if (!deptKeys) return true;          // null = every unit
  if (!deptKeys.size) return false;    // scoped to departments, assigned none
  return deptsOfStaff({ current_department: dept }).some((k) => deptKeys.has(k));
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
    // ...and only when the account has no staffId at all: with one set, a colleague who
    // shares the employee number (11410, 11520) was visible, editable and deletable.
    if (access.staffId == null && access.staffEmpId && rec && norm(rec.emp_id) && norm(rec.emp_id) === norm(access.staffEmpId)) return true;
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
  // The user record could not be read, so this session holds NO permissions right now.
  // Merging would keep the stored copy and the handler would answer ok:true for an edit
  // it had thrown away — the browser would then clear it as saved. Refuse instead; the
  // browser keeps the edit and retries.
  if (access && access.degraded) {
    const e = new Error('Your permissions could not be checked just now, so nothing was saved. It will be retried automatically.');
    e.status = 503;
    throw e;
  }
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

  // A refused staff change is REPORTED (409, so the browser parks only the staff key and
  // shows why). Dropping it silently let the form say "saved" for a record that the next
  // refresh then took away.
  const refuse = (message) => { const e = new Error(message); e.status = 409; throw e; };
  const canDelete = can(access, 'staff', 'delete');
  const canAdd = can(access, 'staff', 'add');
  const out = [];
  const seen = new Set();
  currentArr.forEach((rec) => {
    const id = rec && rec.id != null ? String(rec.id) : null;
    if (id) seen.add(id);
    const next = id ? incomingById.get(id) : null;
    if (!staffVisible(access, rec, deptNames)) {
      // Out of scope -> preserved verbatim. A DIFFERENT record arriving under its id can
      // only be a new person this session numbered from its own narrowed list.
      if (next && JSON.stringify(next) !== JSON.stringify(rec)) {
        refuse('That staff ID is already used by a record outside your departments. Reload the staff list and add the person again.');
      }
      out.push(rec);
      return;
    }
    if (next) {                                        // in scope + still present -> edited
      if (!staffVisible(access, next, deptNames)) refuse('You can only assign staff to your own departments. The change was not saved.');
      out.push(next);
      return;
    }
    // In scope + absent from the payload -> a delete, which needs the delete permission.
    if (!canDelete) out.push(rec);
  });
  // New records this session created. A scoped session may only create records that
  // land inside its own scope, so it cannot mint a person into another department.
  incoming.forEach((rec) => {
    const id = rec && rec.id != null ? String(rec.id) : null;
    if (id && seen.has(id)) return;
    if (scope === 'self') return;                      // self-view accounts never add staff
    if (!canAdd) refuse('Your account cannot add staff records. The new record was not saved.');
    if (!staffVisible(access, rec, deptNames)) refuse('New staff can only be added to your own departments. The record was not saved.');
    out.push(rec);
  });
  return JSON.stringify(out);
}

module.exports = {
  PORTAL_ROLES, isPortal, portalStaff, portalMayEditRoster,
  LEGACY_SUBMIT_ROLES, submitsData, dataScoped, isUnitLead, phoneRoleOf, CONSOLE_MODULES,
  SUBMIT_KINDS, cleanSubmitKinds, maySubmitKind,
  DS_SCREENS, cleanDsScreens, dsScreensOf, mayOpenDsScreen,
  ACCESS_MODULES, ACTIONS, PERM_RANK, STAFF_SCOPES, cleanStaffScope,
  ROSTER_SCOPES, cleanRosterScope, rosterDeptNames, rosterVisible,
  KEY_MODULE, moduleOfKey,
  forRequest, attach, requirePerm, requireModule, actionForMethod, can, canWrite, invalidate,
  filterStaff, staffVisible, scopedDeptNames, deptsOfStaff,
  scopeSnapshot, mergeAppData, mergeStaffOverlay, mayReadKey, mayWriteKey,
};
