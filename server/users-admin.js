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
 * Per-person access (Access Control, 2026-09): an account holds exactly what an
 * administrator ticked for it -- no role, no template, no tier ceiling. `perms` is the
 * only thing access.js enforces. The old tier ladder (`level`, /api/tiers) is still
 * stored and still served so nothing written before is lost, but it no longer caps or
 * clamps anybody's grant. Report sign-off (prepare / check / approve) is set on the
 * person too; an account never given one still reads its old tier's (signoffOf).
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
const ROLES = ['Administrator', 'incharge', 'collector', 'nurse', 'pca', 'User'];
/* The roles that get the scoped PORTAL rather than the admin application. Their
   assignment fields (departments, quality areas, per-indicator access) must be saved
   and enforced the same way — an in-charge created without them would be an account
   with a ward's screens and nobody's scope. */
const ROLES_PORTAL = access.PORTAL_ROLES;   // one list app-wide, so a new portal role cannot drift
// The data-collection scope derive + the `responsibles` mirror live in data-collection.js, so the
// user dialog and the Indicator Access matrix share ONE write rule. Required lazily: that module
// is large and only needed when a portal account is saved.
const dc = () => require('./data-collection');
// A save "carries scope" when it posts any assignment field; an already-linked record is then
// refreshed (so a real clear still syncs). The mirror CREATES a record only when that scope is
// non-empty (hasScope): every portal save posts departments: [], even a password change.
const SCOPE_FIELDS = ['departments', 'allQualityAreas', 'customQualityAreas', 'qualityAreas', 'qualityIndicators'];
const carriesScope = (b) => SCOPE_FIELDS.some((k) => b[k] !== undefined && b[k] !== null);
const hasScope = (b) => dc().scopeIsNonEmpty(b);
const isDupKey = (e) => !!e && (e.code === 11000 || /E11000/.test(String(e.message || '')));
const DUP_MSG = 'That record already exists — refresh and try again.';
// The driver's own text (index names, hosts) stays in the server log, not in the browser.
const mirrorFailed = (e) => { try { console.error('[users] responsible mirror failed:', e); } catch (_) { } return 'The account was saved, but its data-collection record could not be updated. Open Manage and save again.'; };

// Grantable workspaces (per-module access for the standard 'User' role). Ids match
// the renderer's unicoAccessModuleOf() output so a user's `perms` map keys 1:1 to
// sidebar destinations. Administrators are unrestricted; collectors use their own
// portal; a 'User' gets exactly the access levels in `perms`.
// 'supervisor' was missing here while the renderer listed it, so Shift Supervisor
// Reports could never be granted to anyone: the panel offered no switch for it and
// cleanPerms() dropped the key. Kept in step with access.ACCESS_MODULES.
// 'datasubmit' + 'staffapp': submitting data for chosen departments and signing in to the
// phone staff app are MODULES on a normal account now, not portal roles (access.js).
const ACCESS_MODULES = ['stats', 'quality', 'supervisor', 'staff', 'datacol', 'reports', 'users', 'perf', 'roster', 'medicine', 'datasubmit', 'staffapp'];
// Does a perms map grant Data Submission? Such an account carries a data-collection scope
// (departments / areas / indicators), mirrored into `responsibles` like a collector's was.
const holdsSubmit = (perms) => { const v = perms && perms.datasubmit; return Array.isArray(v) ? v.length > 0 : (!!v && v !== 'none'); };

/* ---- Account tiers: the hospital's own hierarchy ----
   A tier is a named RANK with a module CEILING, defined by an administrator in
   Settings -> Users & Roles -> Hierarchy. Two of them are fixed because they are backend
   roles rather than choices: 'admin' (the Administrator role, unrestricted) and 'portal'
   (collector / in-charge / nurse / PCA, who hold no modules at all and carry a
   data-collection scope instead). Everything between them is the hospital's own ladder --
   CNS, Nurse Manager, Ward In-charge, whatever they call it.

   A tier CAPS access. It never grants it. That asymmetry is the whole difference between
   this and the role templates it replaced:
     · assigning a tier to an account grants nothing -- every action is still ticked by
       hand, per account, and an account starts with none;
     · WIDENING a tier grants its members nothing, it only makes more modules tickable;
     · NARROWING a tier is the one edit that reaches existing accounts, and it can only
       ever remove -- so no edit here can escalate anybody.
   That is why there is no "apply to members": there is nothing to push. */
const TIERS = 'accountTiers';
const TIER_ADMIN = 'admin';
const TIER_PORTAL = 'portal';
const ADMIN_RANK = 0;
const PORTAL_RANK = 9999;   // always the floor of the ladder, whatever is added above it
// Seeded on first use into an empty collection, so a fresh database already has a working
// ladder and there is no separate migration step that could half-fail. The two fixed tiers
// are also re-supplied from here if the collection somehow loses them.
const BUILTIN_TIERS = [
  { id: TIER_ADMIN, name: 'Administrator', rank: ADMIN_RANK, fixed: true,
    description: 'System administrator. Every module, nothing to tick.' },
  { id: 'cns', name: 'Chief of Nursing Services', rank: 10, fixed: false,
    description: 'Head of the nursing department — the main HOD, and the final approver.',
    modules: ACCESS_MODULES, signoff: 'approve' },
  { id: 'nurse-manager', name: 'Nurse Manager', rank: 20, fixed: false,
    description: 'Runs a cluster of wards: their people, rosters, appraisals and numbers.',
    modules: ACCESS_MODULES.filter((m) => m !== 'users'), signoff: 'check' },
  { id: 'ward-incharge', name: 'Ward In-charge', rank: 30, fixed: false,
    description: 'Runs one unit: its roster, its submissions and its supervision.',
    modules: ['stats', 'quality', 'supervisor', 'staff', 'datacol', 'perf', 'roster'], signoff: 'prepare' },
  { id: TIER_PORTAL, name: 'Portal account', rank: PORTAL_RANK, fixed: true,
    description: 'Signs in to the collection portal or the staff app. Created and scoped in Data Collection.' },
];
/* The seed is versioned so a database seeded with an earlier ladder still receives the
   tiers added since. It is ADDITIVE: a tier that already exists is never overwritten, so
   an administrator's own edits and their own tiers always survive. */
const TIER_SEED_VERSION = 3;
const SEED_DOC = '__seed';
// The v1 placeholders, replaced by the nursing ladder above. Cleared on the upgrade ONLY
// while still untouched and unoccupied — an edited or occupied tier is somebody's
// decision, not ours, and it stays.
const RETIRED_SEED_TIERS = ['manager', 'incharge'];
const tierKind = (id) => (id === TIER_ADMIN ? 'admin' : id === TIER_PORTAL ? 'portal' : 'console');
/* Where a tier sits in a document's sign-off chain: who drafts it, who checks it, who
   signs it off. Naming the chain on the LADDER rather than in each module means the
   roster, and anything else that needs three signatures, asks the same question --
   "which tier approves?" -- instead of hard-coding a job title it cannot keep in step
   when the hospital renames one. '' = takes no part. */
const SIGNOFF_ROLES = ['prepare', 'check', 'approve'];
const cleanSignoff = (v) => (SIGNOFF_ROLES.indexOf(String(v || '')) >= 0 ? String(v) : '');
/* A person's place in the sign-off chain. Set on the account itself now; an account that
   was never given one (null / absent -- every row written before per-person access) keeps
   what its old tier said, so rosters already in flight still find their signatories. */
const hasOwnSignoff = (u) => !!u && typeof u.signoff === 'string';
function signoffOf(u, tiers) {
  if (hasOwnSignoff(u)) return cleanSignoff(u.signoff);
  const id = levelOf(u) || ((widestTier(tiers || []) || {}).id || null);
  const t = (tiers || []).find((x) => x.id === id);
  return t ? t.signoff : '';
}
const cleanModules = (v) => (Array.isArray(v) ? ACCESS_MODULES.filter((m) => v.indexOf(m) >= 0) : []);
const tierRank = (t) => (t.id === TIER_ADMIN ? ADMIN_RANK : t.id === TIER_PORTAL ? PORTAL_RANK
  : Math.max(1, Math.min(PORTAL_RANK - 1, Number(t.rank) || 10)));
function shapeTier(t) {
  const kind = tierKind(t.id);
  return {
    id: t.id,
    name: String(t.name || t.id).slice(0, 60),
    description: String(t.description || '').slice(0, 300),
    rank: tierRank(t),
    kind,
    // Fixed tiers cannot be deleted or renumbered: they ARE the Administrator role and the
    // portal roles, so the ladder can never end up without a top or a bottom.
    fixed: kind !== 'console',
    // The ceiling. An Administrator holds everything and a portal account holds nothing, so
    // neither carries a meaningful list of its own.
    modules: kind === 'admin' ? ACCESS_MODULES.slice() : kind === 'portal' ? [] : cleanModules(t.modules),
    signoff: cleanSignoff(t.signoff),
  };
}
const tierSort = (a, b) => a.rank - b.rank || String(a.name).localeCompare(String(b.name));
async function tierCol() { const d = await db.getDbHandle(); return d ? d.collection(TIERS) : null; }
// How many accounts sit AT a tier id (not counting the ones the fallback covers) — used to
// decide whether a retired placeholder is safe to clear.
async function usersAtTier(id) {
  try {
    const users = await db.getUsers();
    if (typeof users.find !== 'function') return 1;   // unknown: assume occupied, change nothing
    return (await users.find({ level: id }).toArray()).length;
  } catch (e) { return 1; }
}
/* Bring the stored ladder up to TIER_SEED_VERSION. Adds what is missing, never replaces
   what is there, and returns the rows to carry on with. A failure here is not fatal: the
   caller still serves the code defaults, so the ladder is never empty. */
async function seedTiers(c, stored) {
  const marker = stored.find((d) => d._id === SEED_DOC);
  if (marker && Number(marker.v || 0) >= TIER_SEED_VERSION) return stored;
  const have = new Set(stored.filter((d) => d._id !== SEED_DOC).map((d) => d.id));
  for (const t of BUILTIN_TIERS) {
    if (have.has(t.id)) continue;
    await c.insertOne(Object.assign({ _id: t.id, createdAt: Date.now(), updatedAt: Date.now() }, shapeTier(t)));
  }
  // A ladder seeded before the sign-off chain existed has the tiers but not their place
  // in it. Fill that in where the field is simply ABSENT — that adds information the row
  // never carried, and never overrides a choice an administrator has made.
  for (const t of BUILTIN_TIERS) {
    const row = stored.find((d) => d._id === t.id);
    if (!row || row.signoff !== undefined || !t.signoff) continue;
    await c.updateOne({ id: t.id }, { $set: { signoff: t.signoff, updatedAt: Date.now() } });
  }
  for (const id of RETIRED_SEED_TIERS) {
    const row = stored.find((d) => d._id === id);
    if (!row || row.updatedBy) continue;      // edited by an administrator: theirs now
    if (await usersAtTier(id)) continue;      // somebody is placed there: leave it alone
    await c.deleteOne({ id });
  }
  const stamp = { _id: SEED_DOC, id: SEED_DOC, v: TIER_SEED_VERSION, at: Date.now() };
  if (marker) await c.updateOne({ _id: SEED_DOC }, { $set: stamp });
  else await c.insertOne(stamp);
  return c.find({}).toArray();
}
async function listTiers() {
  let stored = [];
  try {
    const c = await tierCol();
    if (c) {
      stored = await c.find({}).toArray();
      try { stored = await seedTiers(c, stored); } catch (e) { /* defaults below still apply */ }
    }
  } catch (e) { stored = []; }
  stored = stored.filter((d) => d && d._id !== SEED_DOC);
  const out = stored.map(shapeTier);
  // No console tier stored at all -- a fresh database, or a seed that could not be written.
  // Serve the defaults so the ladder is never empty and nobody is left unplaceable. (Once
  // ANY console tier is stored the defaults stay out of it: an administrator who deleted
  // them meant it, and they must not reappear.)
  if (!out.some((t) => t.kind === 'console')) {
    BUILTIN_TIERS.filter((t) => tierKind(t.id) === 'console').forEach((t) => out.push(shapeTier(t)));
  }
  // The two backend-role tiers ARE the Administrator role and the portal roles, so they
  // always exist whatever the collection holds.
  BUILTIN_TIERS.filter((t) => tierKind(t.id) !== 'console')
    .forEach((t) => { if (!out.some((x) => x.id === t.id)) out.push(shapeTier(t)); });
  return out.sort(tierSort);
}
// The widest console tier: the one a legacy account, or a save that names no tier, lands
// on. WIDEST, never narrowest -- introducing or reshaping the ladder must not take a
// module away from an account that is in use today.
function widestTier(tiers) {
  const con = tiers.filter((t) => t.kind === 'console');
  if (!con.length) return null;
  return con.reduce((a, b) => (b.modules.length > a.modules.length ? b : a));
}
// The tier a stored account reads as. null = never assigned (a row written before the
// hierarchy existed); readers resolve that to the widest console tier.
function levelOf(u) {
  const role = (u && u.role) || 'User';
  if (role === 'Administrator') return TIER_ADMIN;
  if (ROLES_PORTAL.indexOf(role) >= 0) return TIER_PORTAL;
  return String((u && u.level) || '') || null;
}
// The tier a save lands on. Administrators and portal accounts take theirs from their
// role, so the two can never disagree; only a console account is a real choice. An
// unknown id falls back to the widest console tier, never the narrowest.
function cleanLevel(v, role, tiers) {
  if (role === 'Administrator') return TIER_ADMIN;
  if (ROLES_PORTAL.indexOf(role) >= 0) return TIER_PORTAL;
  const hit = tiers.find((t) => t.id === String(v || '') && t.kind === 'console');
  if (hit) return hit.id;
  const w = widestTier(tiers);
  return w ? w.id : null;
}
// How much of the personnel register this account may see. Row-level scope, applied
// on the server by access.filterStaff(); see server/access.js.
const cleanStaffScope = access.cleanStaffScope;
const cleanRosterScope = access.cleanRosterScope;

// Changing any of these must invalidate every token the account already holds —
// otherwise a revoked permission stays live for the rest of the 12h token TTL.
const SECURITY_FIELDS = ['role', 'active', 'perms', 'departments', 'qualityAreas', 'allQualityAreas', 'qualityIndicators', 'staffScope', 'staffId', 'staffEmpId', 'rosterScope', 'rosterDepartments', 'rosterEdit', 'unitLead', 'submitKinds', 'dsScreens', 'enterDen'];
// Compare only what actually CHANGED. The update object always carries a few scope
// fields (qualityAreas, allQualityAreas...) whether or not they differ, so testing for
// mere presence signed a user out every time an admin fixed a typo in their name.
const sameVal = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
/* Only a ROLE or ACTIVE change signs the person out. Everything else in SECURITY_FIELDS
   (permissions, departments, areas, screens, scopes) is re-read from the live account on
   EVERY request (access.forRequest) and the open tab re-reads it too (unicoRefreshPerms),
   so a new grant already takes effect at once. Revoking the token for those changes only
   made the person's open session die on their next reload — an admin saving Mithila's
   access while she was signed in logged her out each time. The token's role claim,
   however, IS trusted in a few places (portal-role gates), so a role change must still
   invalidate it; and a deactivated account must stop at once. */
const REVOKE_FIELDS = ['role', 'active'];
function stampRevocation(set, before) {
  const changed = REVOKE_FIELDS.some((k) => (k in set) && !sameVal(set[k], before && before[k]));
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
// Kept in step with access.ACTIONS. 'print' is independent — see the note there; it is
// never produced from a legacy level string, so no existing account is silently granted
// it and an administrator has to tick it deliberately.
const PERM_ACTIONS = ['view', 'edit', 'add', 'delete', 'print'];
const PERM_LEVEL_ACTIONS = ['view', 'edit', 'add', 'delete'];
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
    // Areas granted directly, beyond the departments' own. null = legacy account whose
    // split has not been stored yet (the server derives it on the next save).
    customQualityAreas: Array.isArray(u.customQualityAreas) ? u.customQualityAreas : null,
    qualityIndicators: (u.qualityIndicators && typeof u.qualityIndicators === 'object' && !Array.isArray(u.qualityIndicators)) ? u.qualityIndicators : {},
    // The `responsibles` record mirroring this account's scope (Indicator Access matrix), if any.
    responsibleId: u.responsibleId || null,
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
    // Duty-roster assignment: which units' sheets this account may open and edit. Its
    // own grant, NOT a reuse of staffScope (see server/access.js). null = never
    // assigned, which the server reads as "keep what this account could already reach".
    rosterScope: role === 'Administrator' ? 'all' : cleanRosterScope(u.rosterScope),
    rosterDepartments: Array.isArray(u.rosterDepartments) ? u.rosterDepartments : [],
    // May a ward in-charge BUILD their unit's roster in the portal (never approve it)?
    // Off unless granted; an administrator needs no grant.
    rosterEdit: role === 'Administrator' ? true : u.rosterEdit === true,
    // Data Submission holder who runs a unit (its staff list, staff requests, dashboard).
    unitLead: u.unitLead === true,
    enterDen: u.enterDen === true,
    appRole: u.appRole === 'pca' ? 'pca' : 'nurse',
    submitKinds: access.cleanSubmitKinds(u.submitKinds),
    dsScreens: access.cleanDsScreens(u.dsScreens),
    // Which tier of the hierarchy this account sits at (see BUILTIN_TIERS). A ceiling,
    // not a grant: `perms` above is what the server enforces. null = a row written before
    // the hierarchy existed; readers resolve it to the widest console tier.
    level: levelOf(u),
    // Report sign-off set on this person. null = never set; GET /api/users fills in what
    // their old tier said (signoffOf) and flags it signoffInherited.
    signoff: hasOwnSignoff(u) ? cleanSignoff(u.signoff) : null,
    // Profile picture (set by the account owner via /api/upload kind=profile).
    // Only the CDN url is exposed — publicId stays server-side.
    photo: (u.photo && u.photo.url) ? { url: u.photo.url } : null,
    // 20 of 23 accounts were created by seed-admin.js, which stored `created_at`; reading only
    // `createdAt` showed them with no creation date. Read both (no stored data is changed).
    createdAt: u.createdAt || u.created_at || null,
    updatedAt: u.updatedAt || null,
  };
}
const norm = (s) => String(s || '').trim().toLowerCase();
const cleanList = (v) => Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean) : [];
// Specific-indicator access map: { areaKey: [indicatorId,...] } — empty lists dropped.
const cleanQI = (qi) => { const out = {}; if (!qi || typeof qi !== 'object' || Array.isArray(qi)) return out; Object.keys(qi).forEach(k => { const list = Array.isArray(qi[k]) ? qi[k].map(x => String(x).trim()).filter(Boolean) : []; if (list.length) out[String(k)] = list; }); return out; };

/* Quality areas granted DIRECTLY (customQualityAreas), as opposed to the ones an
   account's departments derive. qualityAreas stays the stored effective union so every
   reader keeps working; this is only the "extras" half, kept separately.

   Why: the editor used to post the effective union back as "custom" areas, so an area
   that came from a department survived that department being unticked (or hospital-wide
   being switched off) — the access could never be removed. Same rule as data-collection.js. */
async function derivedAreaSet(departments) {
  const map = await deptmap.get();
  const auto = new Set();
  (Array.isArray(departments) ? departments : []).forEach((id) => {
    const ak = map.idToQk && map.idToQk[id];
    if (ak) auto.add(ak);
  });
  return auto;
}
// What the stored doc holds as custom. Legacy docs (no field): hospital-wide => none,
// else whatever of qualityAreas its departments do not explain.
async function storedCustomAreas(user) {
  if (!user) return [];
  if (Array.isArray(user.customQualityAreas)) return cleanList(user.customQualityAreas);
  if (user.allQualityAreas) return [];
  const auto = await derivedAreaSet(user.departments);
  return (Array.isArray(user.qualityAreas) ? user.qualityAreas : []).filter((ak) => !auto.has(ak));
}
// Custom areas for a save. An explicit customQualityAreas wins; a posted qualityAreas is
// read as effective, so the areas the account's EXISTING (pre-edit) departments derive
// are subtracted; with neither, the stored split is kept. `baseDepartments` is only used
// on create, where there is no existing doc to subtract against.
async function resolveCustomAreas(b, existing, baseDepartments) {
  if (Array.isArray(b.customQualityAreas)) return cleanList(b.customQualityAreas);
  if (b.qualityAreas != null) {
    if (existing && existing.allQualityAreas) return [];
    const auto = await derivedAreaSet(existing ? existing.departments : baseDepartments);
    return cleanList(b.qualityAreas).filter((ak) => !auto.has(ak));
  }
  return storedCustomAreas(existing);
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
  return i <= 0 ? [] : PERM_LEVEL_ACTIONS.slice(0, i);   // a level never grants 'print'
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

  /* ---------------- The hierarchy: admin-defined account tiers ----------------
     Role templates are gone: nothing here defines a permission SET that gets copied onto
     people. A tier is a rank and a ceiling. Assigning one grants nothing, widening one
     grants nothing, and the only edit that reaches a live account is a narrowing -- which
     can only remove. So no change on this screen can escalate anybody, which is exactly
     what the old "apply this template to its members" button could do.

     The stored `roleTemplates` collection from that feature is left alone; nothing reads
     it (deployments never delete live data). */
  const slugId = (v) => String(v || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  // How many accounts sit at each tier. A row with no tier assigned counts toward the
  // widest console tier, which is the one that actually applies to it.
  async function tierCounts(tiers) {
    const counts = {};
    const fallback = (widestTier(tiers) || {}).id || null;
    try {
      const users = await db.getUsers();
      if (typeof users.find === 'function') {
        (await users.find({}).toArray()).forEach((u) => {
          const id = levelOf(u) || fallback;
          if (id) counts[id] = (counts[id] || 0) + 1;
        });
      }
    } catch (e) { /* counts are informational only */ }
    return counts;
  }

  app.get('/api/tiers', guard('view'), async (req, res) => {
    try { const tiers = await listTiers(); res.json({ ok: true, tiers, counts: await tierCounts(tiers), modules: ACCESS_MODULES }); }
    catch (e) { res.status(500).json({ ok: false, error: 'Could not load the hierarchy.' }); }
  });

  app.post('/api/tiers', guard('add'), async (req, res) => {
    const b = req.body || {};
    const name = String(b.name || '').trim().slice(0, 60);
    if (!name) return res.status(400).json({ ok: false, error: 'A tier name is required.' });
    const id = slugId(b.id || name);
    if (!id) return res.status(400).json({ ok: false, error: 'The tier name must contain a letter or a number.' });
    if (tierKind(id) !== 'console') return res.status(400).json({ ok: false, error: 'That name is reserved. Pick another.' });
    try {
      const c = await tierCol();
      if (!c) return res.status(503).json({ ok: false, error: 'Database unavailable - cannot save the hierarchy.' });
      const tiers = await listTiers();
      if (tiers.some((t) => t.id === id)) return res.status(409).json({ ok: false, error: 'A tier called "' + name + '" already exists.' });
      // New tiers land at the bottom of the console ladder unless a rank is given, so
      // adding one never silently reorders the tiers above it.
      const below = tiers.filter((t) => t.kind === 'console').reduce((m, t) => Math.max(m, t.rank), 0);
      const doc = shapeTier({ id, name, description: b.description, rank: b.rank != null ? b.rank : below + 10, modules: b.modules, signoff: b.signoff });
      await c.insertOne(Object.assign({ _id: id, createdAt: Date.now(), updatedAt: Date.now(), updatedBy: meOf(req) }, doc));
      activity.log(req, 'tier_created', { target: id, detail: name + ' · ' + doc.modules.length + ' modules' });
      res.json({ ok: true, tier: doc });
    } catch (e) {
      if (isDupKey(e)) return res.status(409).json({ ok: false, error: 'A tier with that name already exists.' });
      res.status(500).json({ ok: false, error: 'Could not create the tier.' });
    }
  });

  /* Update a tier. Widening its ceiling changes nothing for anybody -- it only makes more
     modules tickable on the next edit. NARROWING it is the one thing that reaches live
     accounts: everyone at the tier loses what the tier may no longer hold, immediately and
     with a forced sign-out, because leaving them holding it would make the ceiling a
     fiction. The response says how many were affected so the panel can report it. */
  app.put('/api/tiers/:id', guard('edit'), async (req, res) => {
    const id = slugId(req.params.id);
    const b = req.body || {};
    try {
      const c = await tierCol();
      if (!c) return res.status(503).json({ ok: false, error: 'Database unavailable - cannot save the hierarchy.' });
      const tiers = await listTiers();
      const cur = tiers.find((t) => t.id === id);
      if (!cur) return res.status(404).json({ ok: false, error: 'That tier no longer exists.' });
      const next = shapeTier({
        id,
        name: b.name != null ? b.name : cur.name,
        description: b.description != null ? b.description : cur.description,
        // A fixed tier keeps its place at the top or the bottom of the ladder.
        rank: cur.fixed ? cur.rank : (b.rank != null ? b.rank : cur.rank),
        modules: cur.fixed ? cur.modules : (b.modules != null ? b.modules : cur.modules),
        signoff: b.signoff !== undefined ? b.signoff : cur.signoff,
      });
      await c.updateOne({ id }, { $set: Object.assign({}, next, { updatedAt: Date.now(), updatedBy: meOf(req) }), $setOnInsert: { _id: id, createdAt: Date.now() } }, { upsert: true });
      // Access is per person now: a tier is a stored label, not a ceiling, so editing one
      // never reaches an account's grant. (It used to strip members on a narrowing.)
      const clamped = 0;
      const lost = cur.modules.filter((m) => next.modules.indexOf(m) < 0);
      activity.log(req, 'tier_updated', { target: id, detail: next.name });
      res.json({ ok: true, tier: next, clamped, removed: lost });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not update the tier.' }); }
  });

  /* Delete a tier. Refused while anyone is at it: a tier is the ceiling its members are
     held to, so dropping it would leave those accounts capped by nothing in particular.
     Move them first -- that is an explicit decision about each person. */
  app.delete('/api/tiers/:id', guard('delete'), async (req, res) => {
    const id = slugId(req.params.id);
    try {
      const tiers = await listTiers();
      const cur = tiers.find((t) => t.id === id);
      if (!cur) return res.status(404).json({ ok: false, error: 'That tier no longer exists.' });
      if (cur.fixed) return res.status(400).json({ ok: false, error: 'Administrator and Portal account are built in and cannot be removed.' });
      if (tiers.filter((t) => t.kind === 'console').length <= 1) return res.status(400).json({ ok: false, error: 'This is the last tier between Administrator and Portal — add another before removing it.' });
      const counts = await tierCounts(tiers);
      if (counts[id]) return res.status(400).json({ ok: false, error: 'Move its ' + counts[id] + ' account' + (counts[id] === 1 ? '' : 's') + ' to another tier first.' });
      const c = await tierCol();
      if (!c) return res.status(503).json({ ok: false, error: 'Database unavailable.' });
      await c.deleteOne({ id });
      activity.log(req, 'tier_deleted', { target: id, detail: cur.name });
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not delete the tier.' }); }
  });

  /* Reorder the console ladder. Rank is presentation and seniority only -- it changes no
     ceiling, so nobody's access moves. */
  app.post('/api/tiers/reorder', guard('edit'), async (req, res) => {
    const order = Array.isArray((req.body || {}).order) ? req.body.order.map(slugId) : [];
    if (!order.length) return res.status(400).json({ ok: false, error: 'No order was sent.' });
    try {
      const c = await tierCol();
      if (!c) return res.status(503).json({ ok: false, error: 'Database unavailable.' });
      const tiers = await listTiers();
      let rank = 10;
      for (const id of order) {
        const t = tiers.find((x) => x.id === id && x.kind === 'console');
        if (!t) continue;
        await c.updateOne({ id }, { $set: Object.assign({}, t, { rank, updatedAt: Date.now(), updatedBy: meOf(req) }), $setOnInsert: { _id: id, createdAt: Date.now() } }, { upsert: true });
        rank += 10;
      }
      activity.log(req, 'tier_reordered', { detail: order.join(' > ') });
      res.json({ ok: true, tiers: await listTiers() });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not reorder the hierarchy.' }); }
  });

  app.get('/api/signatories', requireApi, async (req, res) => {
    try {
      const a = await access.forRequest(req);
      if (!a) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
      const tiers = await listTiers();
      const fallback = (widestTier(tiers) || {}).id || null;
      const byId = {}; tiers.forEach((t) => { byId[t.id] = t; });
      const users = await db.getUsers();
      let list = [];
      if (typeof users.find === 'function') list = await users.find({ active: { $ne: false } }).toArray();
      const out = list
        .filter((u) => (u.role || 'User') === 'User' || u.role === 'Administrator')
        .map((u) => {
          const id = levelOf(u) || fallback;
          const t = byId[id] || null;
          return { name: u.name || u.username, title: u.title || (t ? t.name : ''), level: id, levelName: t ? t.name : '', signoff: signoffOf(u, tiers) };
        })
        .filter((x) => x.name)
        .sort((x, y) => String(x.name).localeCompare(String(y.name)));
      res.json({ ok: true, signatories: out, tiers: tiers.map((t) => ({ id: t.id, name: t.name, rank: t.rank, signoff: t.signoff })) });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not load signatories.' }); }
  });

  // List every account.
  app.get('/api/users', guard('view'), async (req, res) => {
    try {
      const users = await db.getUsers();
      let list = [];
      if (typeof users.find === 'function') list = await users.find({}).sort({ role: 1, username: 1 }).toArray();
      const tiers = await listTiers();
      // The staff record each account belongs to (same rule as /api/me/staff), for its
      // photo, employee no. and designation in Access Control. A lookup failure only drops these.
      let roster = [];
      try { roster = await require('./staff-roster').loadRoster({ cached: true }); } catch (e) { roster = []; }
      const { staffOfAccount } = require('./account-staff');
      const staffBits = (u) => {
        const r = staffOfAccount(u, roster); if (!r) return { staffMatch: null };
        const p = r.photo || r.photo_url; const url = p ? (typeof p === 'string' ? p : (p.url || '')) : '';
        return { staffMatch: { id: r.id, empId: r.emp_id || '', name: r.name || '', designation: r.designation || '', photo: url || null } };
      };
      const out = list.map((u) => Object.assign(safe(u), { signoff: signoffOf(u, tiers), signoffInherited: !hasOwnSignoff(u) }, staffBits(u)));
      res.json({ ok: true, users: out, roles: ROLES });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not load users.' }); }
  });

  /* Last sign-in per account, read from the activity log's `login` rows (no field on the
     account is written for it). Informational: a trimmed or cleared log just means
     "unknown", never "never". */
  app.get('/api/users/last-seen', guard('view'), async (req, res) => {
    try {
      const out = {};
      const h = await db.getDbHandle().catch(() => null);
      let rows = [];
      const d1store = (() => { try { return require('./d1-store'); } catch (e) { return null; } })();
      if (d1store && d1store.enabled('activity')) {
        const d1 = require('./d1');
        rows = await d1store.withSchema(() => d1.query("SELECT username, MAX(ts) AS ts FROM activity_log WHERE action = 'login' GROUP BY username", []));
      } else if (h) {
        rows = await h.collection('activity_log').aggregate([
          { $match: { action: 'login' } },
          { $group: { _id: '$username', ts: { $max: '$ts' } } },
        ]).toArray();
        rows = rows.map((r) => ({ username: r._id, ts: r.ts }));
      }
      rows.forEach((r) => { const k = norm(r.username); if (k && r.ts) out[k] = Number(r.ts); });
      res.json({ ok: true, lastSeen: out });
    } catch (e) { res.json({ ok: true, lastSeen: {}, degraded: true }); }
  });

  /* Retire the PORTAL roles: every collector / in-charge / nurse / PCA login becomes a normal
     account whose old role is now a MODULE —
       collector -> Data Submission            incharge -> Data Submission + runs a unit
       nurse     -> Staff app (nurse)          pca      -> Staff app (PCA)
     Additive only: departments, areas, indicators, the linked matrix record, rosterEdit and
     everything else on the account stay as they are; the old role is kept in
     `convertedFrom`. Each converted account is signed out once (its token names the old
     role). `apply: false` (the default) only reports what WOULD change. */
  const convertPlan = (u) => {
    const r = u.role;
    const perms = nonePerms();
    const set = { role: 'User', convertedFrom: r, convertedAt: Date.now(), staffScope: 'self', updatedAt: Date.now(), sessionEpoch: Date.now() };
    if (r === 'collector' || r === 'incharge') perms.datasubmit = ['view', 'edit', 'add'];
    if (r === 'incharge') set.unitLead = true;
    // An in-charge trusted to build its unit's roster keeps that: the Duty Roster module,
    // scoped to the same departments (portalMayEditRoster only knew the old role).
    if (r === 'incharge' && u.rosterEdit === true) { perms.roster = ['view', 'edit', 'add']; set.rosterScope = 'departments'; set.rosterDepartments = Array.isArray(u.departments) ? u.departments : []; }
    if (r === 'nurse' || r === 'pca') { perms.staffapp = ['view']; set.appRole = r; }
    set.perms = perms;
    return set;
  };
  app.post('/api/users/convert-portal', guard('edit'), async (req, res) => {
    const apply = !!(req.body && req.body.apply === true);
    try {
      const users = await db.getUsers();
      const list = typeof users.find === 'function' ? await users.find({}).toArray() : [];
      const legacy = list.filter((u) => ROLES_PORTAL.indexOf(u.role) >= 0);
      const plan = legacy.map((u) => ({ username: u.username, name: u.name || u.username, from: u.role,
        becomes: u.role === 'nurse' || u.role === 'pca' ? 'Staff app (' + u.role + ')' : 'Data Submission' + (u.role === 'incharge' ? ' · runs a unit' : ''),
        departments: Array.isArray(u.departments) ? u.departments.length : 0 }));
      if (!apply) return res.json({ ok: true, apply: false, count: plan.length, accounts: plan });
      let done = 0; const failed = [];
      for (const u of legacy) {
        try {
          // Conditional on the role still being the legacy one, so a second run (or an edit
          // made meanwhile) never converts anything twice.
          const r = await users.updateOne({ username: u.username, role: u.role }, { $set: convertPlan(u) });
          if (r && r.matchedCount) { done++; access.invalidate(u.username); }
        } catch (e) { failed.push(u.username); }
      }
      activity.log(req, 'users_converted', { detail: done + ' portal login(s) converted to normal accounts' + (failed.length ? ' · failed: ' + failed.join(', ') : '') });
      res.json({ ok: true, apply: true, converted: done, failed, accounts: plan });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not convert the portal logins.' }); }
  });

  // Sign one account out of every device: bump its epoch so every token it holds dies.
  app.post('/api/users/:username/signout', guard('edit'), async (req, res) => {
    const username = norm(req.params.username);
    try {
      const users = await db.getUsers();
      if (!await users.findOne({ username })) return res.status(404).json({ ok: false, error: 'User not found.' });
      await users.updateOne({ username }, { $set: { sessionEpoch: Date.now(), updatedAt: Date.now() } });
      access.invalidate(username);
      activity.log(req, 'user_signed_out', { target: username });
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not sign the account out.' }); }
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
    const tiers = await listTiers();
    const level = cleanLevel(b.level, role, tiers);
    try {
      if (dc().NO_DATA_ROLES.indexOf(role) >= 0 && hasScope(b)) return res.status(400).json({ ok: false, error: dc().NURSE_PCA_SCOPE_ERROR });
      const users = await db.getUsers();
      if (await users.findOne({ username })) return res.status(409).json({ ok: false, error: 'That username already exists.' });
      // Collectors: their data-collection assignment. Plain Users: the row-level scope
      // for the staff register (staffScope 'departments'). Administrators: neither.
      const departments = (ROLES_PORTAL.indexOf(role) >= 0 || role === 'User') ? cleanList(b.departments) : [];
      // deptmap caches per instance and nothing invalidates it across instances: derive the
      // areas stored below from a FRESH map (a blip falls back to the cached one inside get()).
      // A legacy portal role, or a normal account holding Data Submission: both carry a
      // data-collection scope.
      const isPortal = ROLES_PORTAL.indexOf(role) >= 0 || (role === 'User' && holdsSubmit(cleanPerms(b.perms)));
      if (isPortal) await deptmap.get(true).catch(() => null);
      // Portal scope through the SAME derive the Indicator Access matrix uses (data-collection.js).
      // Quality areas = departments' auto areas UNION custom/extra areas, or ALL when hospital-wide.
      const scope = isPortal
        ? await dc().deriveAssignment({ departments, allQualityAreas: !!b.allQualityAreas, customQualityAreas: await resolveCustomAreas(b, null, departments), qualityIndicators: b.qualityIndicators }, { mapFresh: true })
        : null;
      // Resolve the responsibles record BEFORE the account exists, so a lookup failure refuses
      // the save instead of leaving an account whose scope the matrix cannot see.
      const plan = (isPortal && carriesScope(b)) ? await dc().planResponsibleSync({ username, responsibleId: null }, { create: hasScope(b) }) : null;
      // Only an account that holds Duty Roster defaults to every unit; anyone else stays
      // "never assigned" (null), which rosterDeptNames reads as their own departments.
      const rp0 = role === 'User' ? ((cleanPerms(b.perms) || {}).roster) : null;
      const rosterHeld = Array.isArray(rp0) ? rp0.length > 0 : (typeof rp0 === 'string' && rp0 !== 'none');
      const doc = {
        username, name: String(b.name || username).trim(), role,
        email: String(b.email || '').trim().toLowerCase() || null,
        title: String(b.title || '').trim() || null,
        active: b.active !== false,
        departments: scope ? scope.departments : departments,
        allQualityAreas: scope ? scope.allQualityAreas : false,
        customQualityAreas: scope ? scope.customQualityAreas : [],
        qualityAreas: scope ? scope.qualityAreas : [],
        qualityIndicators: scope ? scope.qualityIndicators : {}, // specific-indicator access
        // Per-module access — only meaningful for the 'User' role. Admins are full
        // (null => resolved to full in safe()); collectors use the collector portal.
        // Stored exactly as ticked: there is no tier ceiling any more.
        perms: role === 'User' ? cleanPerms(b.perms) : null,
        level,
        // Row-level staff scope + the personnel record this login belongs to (needed
        // for scope 'self', where the account may see only its own file).
        staffScope: role === 'Administrator' ? 'all' : cleanStaffScope(b.staffScope),
        staffId: (b.staffId === 0 || b.staffId) ? b.staffId : null,
        staffEmpId: String(b.staffEmpId || '').trim() || null,
        // Duty-roster units. A NEW account gets 'all' when the dialog sends nothing:
        // the `roster` module permission is what decides whether they reach the module
        // at all, and a blank field here would otherwise read as "assigned no units".
        rosterScope: role === 'Administrator' ? 'all' : (cleanRosterScope(b.rosterScope) || (rosterHeld ? 'all' : null)),
        rosterDepartments: cleanList(b.rosterDepartments),
        rosterEdit: role === 'Administrator' ? true : b.rosterEdit === true,
        unitLead: role === 'User' && b.unitLead === true,
        enterDen: role === 'User' && b.enterDen === true,
        // Staff app holders: the phone feature set they get.
        appRole: b.appRole === 'pca' ? 'pca' : 'nurse',
        // Data Submission: which kinds they may send (patient statistics / quality data).
        submitKinds: access.cleanSubmitKinds(b.submitKinds),
        // Data Submission: which of its screens they may open (null = the defaults).
        dsScreens: access.cleanDsScreens(b.dsScreens),
        passwordHash: await auth.hash(password),
        // Bumped whenever access changes; every issued token carries the value it was
        // signed with, so raising it signs the account out everywhere.
        sessionEpoch: Date.now(),
        createdAt: Date.now(), updatedAt: Date.now(),
      };
      if (plan && plan.responsibleId) doc.responsibleId = plan.responsibleId;
      // Place in the report sign-off chain, set per person ('' = takes no part). Only
      // stored when sent: a caller that never sends one (the phone Admin App) leaves the
      // account reading its tier's, as before.
      if (b.signoff !== undefined && (role === 'User' || role === 'Administrator')) doc.signoff = cleanSignoff(b.signoff);
      await users.insertOne(doc);
      activity.log(req, 'user_created', { target: username, detail: 'role: ' + role + ' · level: ' + level });
      if (plan) {
        try { await dc().applyResponsibleSync(plan, doc, scope); }
        catch (e) { return res.status(500).json({ ok: false, error: mirrorFailed(e), user: safe(doc) }); }
      }
      res.json({ ok: true, user: safe(doc) });
    } catch (e) {
      if (isDupKey(e)) return res.status(409).json({ ok: false, error: DUP_MSG });
      console.error('[users-admin] create user failed:', e);   // driver detail stays in the server log
      res.status(500).json({ ok: false, error: 'Could not create user.' });
    }
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
      // Absent role = unchanged. (An unknown role string is ignored the same way.)
      if (b.role != null && ROLES.includes(b.role)) set.role = b.role;
      if (b.active != null) set.active = !!b.active;
      const role = set.role || u.role;
      if (dc().NO_DATA_ROLES.indexOf(role) >= 0 && hasScope(b)) return res.status(400).json({ ok: false, error: dc().NURSE_PCA_SCOPE_ERROR });
      // Leaving the portal roles: the account keeps no data-collection scope, so its record must stop
      // showing as an assignee. Marked inactive after the write below; its scope is left as it was.
      // Data Submission on a normal account carries a scope exactly like a portal role did.
      const nextPerms = role === 'User' ? (b.perms !== undefined ? cleanPerms(b.perms) : u.perms) : null;
      const submitter = role === 'User' && holdsSubmit(nextPerms);
      const wasSubmitter = ROLES_PORTAL.indexOf(u.role) >= 0 || ((u.role || 'User') === 'User' && holdsSubmit(u.perms));
      // Losing the ability to submit (a portal role left, or Data Submission unticked): the record
      // stops showing as an assignee. Marked inactive after the write; its scope is left as it was.
      const leavingPortal = wasSubmitter && !(ROLES_PORTAL.indexOf(role) >= 0 || submitter);
      let scope = null;
      if (ROLES_PORTAL.indexOf(role) >= 0 || submitter) {
        await deptmap.get(true).catch(() => null); // stored qualityAreas must not come from a stale per-instance map
        let departments = (b.departments != null) ? cleanList(b.departments) : (Array.isArray(u.departments) ? u.departments : []);
        // Just gaining Data Submission with nothing picked yet: keep the departments the account
        // already had (its staff-register scope) rather than storing an empty list.
        if (!wasSubmitter && submitter && !departments.length && Array.isArray(u.departments) && u.departments.length) departments = u.departments;
        const allQualityAreas = (b.allQualityAreas != null) ? !!b.allQualityAreas : !!u.allQualityAreas;
        // Custom = ONLY the directly-granted extras (see resolveCustomAreas) — never the
        // posted union, or a removed department's area would be re-saved as "custom".
        const customAreas = await resolveCustomAreas(b, u);
        const qualityIndicators = (b.qualityIndicators != null) ? b.qualityIndicators : u.qualityIndicators;
        // Departments' auto areas UNION custom/extra areas — the same derive as the matrix.
        scope = await dc().deriveAssignment({ departments, allQualityAreas, customQualityAreas: customAreas, qualityIndicators }, { mapFresh: true });
        if (b.departments != null) set.departments = scope.departments;
        set.allQualityAreas = scope.allQualityAreas;
        set.customQualityAreas = scope.customQualityAreas;
        set.qualityAreas = scope.qualityAreas;
        if (b.qualityIndicators != null) set.qualityIndicators = scope.qualityIndicators;
      } else if (role === 'User') {
       // A 'User' keeps a department list too — not for data-collection assignment
        // (that is the collector mechanism) but as the row-level scope for the staff
        // register: "this in-charge sees Medical ICU staff and no one else". The
        // quality-area/indicator assignment stays portal-only. Reached only when the
        // account IS (or is explicitly being made) a 'User' — a body without `role`
        // keeps a portal account in the branch above, ward and areas intact.
        if (b.departments != null) set.departments = cleanList(b.departments);
        set.qualityAreas = []; set.allQualityAreas = false; set.qualityIndicators = {}; set.customQualityAreas = [];
      } else if (set.role && ROLES_PORTAL.indexOf(set.role) < 0) {
        // Demoted out of a portal role: the assignment fields go with it. Testing a
        // single role here would have wiped an in-charge's own ward on any edit.
        set.departments = []; set.qualityAreas = []; set.allQualityAreas = false; set.qualityIndicators = {}; set.customQualityAreas = [];
      }

      // Row-level staff scope. Administrators are always unrestricted.
      if (role === 'Administrator') {
        set.staffScope = 'all';
        set.rosterScope = 'all'; set.rosterDepartments = []; set.rosterEdit = true;
      } else {
        if (b.staffScope !== undefined) set.staffScope = cleanStaffScope(b.staffScope);
        if (b.staffId !== undefined) set.staffId = (b.staffId === 0 || b.staffId) ? b.staffId : null;
        if (b.staffEmpId !== undefined) set.staffEmpId = String(b.staffEmpId || '').trim() || null;
        // Duty-roster units. Absent = untouched, so an edit that does not carry the
        // field (an older dialog, a password reset) never widens or clears the grant.
        // An unrecognised value falls back to 'all' rather than to null, which would
        // silently revert a deliberate assignment to the legacy staffScope rule.
        if (b.rosterScope !== undefined) set.rosterScope = cleanRosterScope(b.rosterScope) || 'all';
        if (b.rosterDepartments !== undefined) set.rosterDepartments = cleanList(b.rosterDepartments);
        if (b.rosterEdit !== undefined) set.rosterEdit = b.rosterEdit === true;
        if (b.unitLead !== undefined) set.unitLead = role === 'User' && b.unitLead === true;
        if (b.enterDen !== undefined) set.enterDen = role === 'User' && b.enterDen === true;
        if (b.appRole !== undefined) set.appRole = b.appRole === 'pca' ? 'pca' : 'nurse';
        if (b.submitKinds !== undefined) set.submitKinds = access.cleanSubmitKinds(b.submitKinds);
        if (b.dsScreens !== undefined) set.dsScreens = access.cleanDsScreens(b.dsScreens);
      }

      // Per-module access levels. Only the 'User' role carries a perms map; Administrators
      // and collectors are cleared to null (full / portal). Absent leaves it untouched.
      const tiers = await listTiers();
      const level = cleanLevel(b.level !== undefined ? b.level : u.level, role, tiers);
      set.level = level;
      if (role === 'User') {
        // Stored exactly as ticked -- per-person access, no tier ceiling. Absent leaves the
        // stored grant untouched (a legacy null map stays null).
        if (b.perms !== undefined) set.perms = cleanPerms(b.perms);
      } else {
        set.perms = null;
      }
      if (b.signoff !== undefined) set.signoff = cleanSignoff(b.signoff);
      if (u.roleTemplate) set.roleTemplate = null;   // retired label, cleared on the next save

      // Never strand the system without an active administrator.
      // Only an ACTIVE administrator counts toward the total, so only demoting/deactivating
      // one can strand the system. Without the u.active check an already-inactive admin
      // could not be demoted at all while a single active admin existed.
      const demoting = u.role === 'Administrator' && u.active !== false
        && ((set.role && set.role !== 'Administrator') || set.active === false);
      if (demoting && (await activeAdminCount(users)) <= 1) {
        return res.status(400).json({ ok: false, error: 'Cannot demote or deactivate the last active administrator.' });
      }
      // Portal account: keep its `responsibles` record in step (Indicator Access matrix, form
      // hints). Resolved BEFORE the write so a lookup failure refuses the save. A save that
      // carries scope creates the record when none exists; a rename / (de)activation only
      // refreshes one that is already linked.
      let plan = null;
      if (scope) {
        plan = await dc().planResponsibleSync(Object.assign({}, u, set), { create: hasScope(b) });
        if (plan.responsibleId && plan.responsibleId !== u.responsibleId) set.responsibleId = plan.responsibleId;
        else if (!plan.responsibleId && u.responsibleId) set.responsibleId = null;   // dead or someone else's record
      }
      stampRevocation(set, u); // a real access change takes effect now, not in 12h
      await users.updateOne({ username }, { $set: set });
      access.invalidate(username); // drop the 15s permission cache for this account
      activity.log(req, 'user_updated', { target: username, detail: Object.keys(set).filter((k) => k !== 'updatedAt').join(', ') || 'no changes' });
      const after = Object.assign({}, u, set);
      if (plan && plan.responsibleId) {
        try { await dc().applyResponsibleSync(plan, after, scope); }
        catch (e) { return res.status(500).json({ ok: false, error: mirrorFailed(e), user: safe(after) }); }
      }
      if (leavingPortal) {
        try { await dc().deactivateResponsibleFor(u); }
        catch (e) { return res.status(500).json({ ok: false, error: mirrorFailed(e), user: safe(after) }); }
      }
      res.json({ ok: true, user: safe(after) });
    } catch (e) {
      if (isDupKey(e)) return res.status(409).json({ ok: false, error: DUP_MSG });
      console.error('[users-admin] update user failed:', e);   // driver detail stays in the server log
      res.status(500).json({ ok: false, error: 'Could not update user.' });
    }
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
      // The person's `responsibles` record is kept (history) but must stop listing them as an
      // assignee in the Indicator Access matrix: marked inactive, never deleted.
      try { await dc().deactivateResponsibleFor(u, { deactivatedAt: true }); }
      catch (e) {
        console.error('[users-admin] deactivate responsible after delete failed:', e);
        return res.status(500).json({ ok: false, error: 'The account was deleted, but its data-collection record could not be marked inactive. Open Manage and set it inactive.' });
      }
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
      // Where they work, as they describe it (e.g. "Nursing Service"). A display label only:
      // the departments an account may SEE or SUBMIT for stay in `departments`, set by an admin.
      if (b.workDepartment != null) set.workDepartment = String(b.workDepartment).trim().slice(0, 80) || null;
      await users.updateOne({ username: uname }, { $set: set });
      res.json({ ok: true, user: safe(Object.assign({}, u, set)) });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not update your profile.' }); }
  });
}

module.exports = { mount };
