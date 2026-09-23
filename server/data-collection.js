/* Data Collection module — responsible persons + Google-form-style submissions
 * with an ADMIN REVIEW step.
 *
 * Flow:
 *   1. A form (or a shared short link) creates a submission with status "pending".
 *      Nothing in the live dashboard changes yet.
 *   2. The "Review & History" module shows every submission (time, data, stats).
 *   3. An admin Approves a pending submission -> it is APPLIED to the canonical
 *      collection (`departments` monthly stats / `quality` indicators) and marked
 *      "approved" (so it now shows in the live dashboard). Reject marks it rejected.
 *
 * Collections: `responsibles`, `submissions`. Self-contained via db.getDbHandle();
 * the actively edited web.js only calls mount() once.
 */
const { getDbHandle, getUsers, getAppData } = require('./db');
const accessRoles = require('./access');   // PORTAL_ROLES: collector + incharge
const auth = require('./auth');
const session = require('./session');
const deptmap = require('./deptmap');
const activity = require('./activity-log');   // best-effort audit trail (never throws)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

// Server-side copy of quality-store.js QUARTER_MONTHS (lines 17-22) so the DB holds
// authoritative computed quarters that always agree with the client's rollup.
const QUARTER_MONTHS = { Q1: ['Jun-25', 'Jul-25', 'Aug-25'], Q2: ['Sep-25', 'Oct-25', 'Nov-25'], Q3: ['Dec-25', 'Jan-26', 'Feb-26'], Q4: ['Mar-26', 'Apr-26', 'May-26'] };
// Fiscal-year (Jun–May) helpers so quarters roll up PER YEAR, not just 2025-26. A month's
// quarter depends only on its month name, so any year works.
// Per-year rollups follow the CALENDAR reporting year (Jan–Dec, Q1 = Jan–Mar), matching
// quality-store.js and the console's year picker.
const FY_MONS_S = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fyOfKeyS(key) { const p = String(key || '').split('-'); const mi = FY_MONS_S.indexOf(p[0]); const yy = parseInt(p[1], 10); if (mi < 0 || isNaN(yy)) return null; return 2000 + yy; }
function fyQuarterMonths(startYear) { const yy = String(startYear % 100).padStart(2, '0'); return { Q1: ['Jan-' + yy, 'Feb-' + yy, 'Mar-' + yy], Q2: ['Apr-' + yy, 'May-' + yy, 'Jun-' + yy], Q3: ['Jul-' + yy, 'Aug-' + yy, 'Sep-' + yy], Q4: ['Oct-' + yy, 'Nov-' + yy, 'Dec-' + yy] }; }
function fysInInd(ind) { const set = new Set(); ['months', 'mNum', 'mDen'].forEach((f) => { const o = ind && ind[f]; if (o) Object.keys(o).forEach((k) => { if (o[k] != null && o[k] !== '') { const fy = fyOfKeyS(k); if (fy != null) set.add(fy); } }); }); return [...set]; }
function avgVals(vals) { return Math.round((vals.reduce((s, x) => s + x, 0) / vals.length) * 100) / 100; }
function computeFallbackFormulaQuarter(formula, vals) {
  if (!vals.length) return null;
  return formula === 'count' ? vals.reduce((s, x) => s + x, 0) : avgVals(vals);
}
function computeQuartersFor(ind, QM) {
  const f = ind.formula;
  const out = {};
  if (f && f !== 'direct') {
    const needDen = f !== 'count';
    Object.keys(QM).forEach((q) => {
      const ms = QM[q] || [];
      const have = ms.some((m) => ind.mNum && ind.mNum[m] != null && ind.mNum[m] !== '' && (!needDen || (ind.mDen && ind.mDen[m] != null && ind.mDen[m] !== '')));
      let v = null;
      if (have) {
        const num = ms.reduce((s, m) => s + (Number((ind.mNum || {})[m]) || 0), 0);
        const den = ms.reduce((s, m) => s + (Number((ind.mDen || {})[m]) || 0), 0);
        v = (needDen && !den) ? null : qiFormulaCompute(f, num, den);
      }
      if (v == null) {
        const vals = ms.map((m) => (ind.months || {})[m]).filter((x) => x != null && x !== '').map(Number);
        v = computeFallbackFormulaQuarter(f, vals);
      }
      if (v != null) out[q] = v;
    });
  } else {
    const months = ind.months || {};
    Object.keys(QM).forEach((q) => {
      const vals = (QM[q] || []).map((m) => months[m]).filter((v) => v != null && v !== '').map(Number);
      if (!vals.length) return;
      out[q] = indIsPct(ind) ? avgVals(vals) : vals.reduce((s, x) => s + x, 0);
    });
  }
  return out;
}
// Mirrors quality-store.js qiFormulaCompute (count=num; rate1000/rate100/pct = num/den*mult).
function qiFormulaCompute(formula, num, den) { const n = Number(num) || 0, d = Number(den) || 0; if (formula === 'count') return n; if (!d) return 0; if (formula === 'rate1000') return Math.round((n / d) * 1000 * 100) / 100; if (formula === 'avg') return Math.round((n / d) * 100) / 100; return Math.round((n / d) * 100 * 100) / 100; }
function indIsPct(ind) { const t = ((ind && ind.valueType) || '').toString().toLowerCase(); return t.indexOf('%') >= 0 || t.startsWith('per'); }
// Benchmark status for one quarter value, per CONTRACT: null/'' benchmark => 'n-a';
// higher_is_better => value>=bench 'ok' else 'breach'; else value<=bench 'ok' else 'breach'.
function indStatus(ind, value) { const braw = (ind && ind.benchmarkValue != null && ind.benchmarkValue !== '') ? ind.benchmarkValue : (ind && ind.benchmark); const bn = Number(braw); if (braw == null || braw === '' || isNaN(bn)) return 'n-a'; if (value == null || value === '') return 'n-a'; const higher = String((ind && ind.goalDirection) || '') === 'higher_is_better'; const ok = higher ? Number(value) >= bn : Number(value) <= bn; return ok ? 'ok' : 'breach'; }
// Pure: recompute ind.quarters + ind.quarterStatus + ind.status from monthly data.
// Mirrors quality-store.js mergeIndicator rollup so server/client never disagree.
function recomputeQuarters(ind) {
  if (!ind || typeof ind !== 'object') return ind;
  const f = ind.formula;
  const quarters = Object.assign({}, ind.quarters || {});
  const quarterStatus = {};
  Object.keys(QUARTER_MONTHS).forEach((q) => {
    const ms = QUARTER_MONTHS[q];
    let val = null;
    if (f && f !== 'direct') {
      const needDen = f !== 'count';
      const haveMonths = ms.some((m) => ind.mNum && ind.mNum[m] != null && ind.mNum[m] !== '' && (!needDen || (ind.mDen && ind.mDen[m] != null && ind.mDen[m] !== '')));
      if (haveMonths) {
        const num = ms.reduce((s, m) => s + (Number((ind.mNum || {})[m]) || 0), 0);
        const den = ms.reduce((s, m) => s + (Number((ind.mDen || {})[m]) || 0), 0);
        val = (needDen && !den) ? null : qiFormulaCompute(f, num, den);
      } else {
        const n = (ind.qNum || {})[q];
        const d = (ind.qDen || {})[q];
        if (n != null && n !== '' && (!needDen || (d != null && d !== ''))) val = qiFormulaCompute(f, n, d);
      }
      if (val == null) {
        const vals = ms.map((m) => (ind.months || {})[m]).filter((v) => v != null && v !== '').map(Number);
        val = computeFallbackFormulaQuarter(f, vals);
      }
    } else {
      const months = ind.months || {};
      const vals = ms.map((m) => months[m]).filter((v) => v != null && v !== '').map(Number);
      if (!vals.length) return;
      val = indIsPct(ind) ? avgVals(vals) : vals.reduce((s, x) => s + x, 0);
    }
    if (val == null) return;
    quarters[q] = val;
    quarterStatus[q] = indStatus(ind, val);
  });
  ind.quarters = quarters;
  ind.quarterStatus = quarterStatus;
  const present = Object.keys(quarterStatus);
  ind.status = present.some((q) => quarterStatus[q] === 'breach') ? 'breach' : (present.some((q) => quarterStatus[q] === 'ok') ? 'ok' : 'n-a');
  const fys = fysInInd(ind);
  if (fys.length) {
    const byFy = {};
    fys.forEach((fy) => { byFy[fy] = computeQuartersFor(ind, fyQuarterMonths(fy)); });
    ind.quartersByFy = byFy;
  }
  return ind;
}

function monthRank(key) {
  const p = String(key || '').split('-');
  const idx = MONTHS.indexOf(p[0]);
  const yy = parseInt(p[1], 10);
  if (idx < 0 || isNaN(yy)) return Number.POSITIVE_INFINITY;
  return (2000 + yy) * 12 + idx;
}
function genId(prefix) { return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e8).toString(36); }
// Per-collector "specific indicator" access map (CONTRACT): areaKey -> [indicatorId,...].
// Empty/non-array entries are DROPPED so a present-but-empty map == no scoping; only a
// non-empty array scopes an area, preserving BACKWARD-COMPAT full-area access.
function normQualityIndicators(qi) { const out = {}; if (!qi || typeof qi !== 'object' || Array.isArray(qi)) return out; Object.keys(qi).forEach((k) => { const key = String(k); const list = qi[k]; if (!Array.isArray(list)) return; const ids = list.map((x) => String(x == null ? '' : x).trim()).filter(Boolean); if (ids.length) out[key] = ids; }); return out; }
// Sanitize a per-staff-group breakdown (e.g. { nurse, doctor, pca, other }) to numbers.
function sanitizeGroupMap(g) { if (!g || typeof g !== 'object' || Array.isArray(g)) return null; const out = {}; let any = false; Object.keys(g).forEach((k) => { const n = Number(g[k]); out[String(k)] = isNaN(n) ? 0 : n; any = true; }); return any ? out : null; }
// Sanitize a department × staff-group matrix: [{ dept, g:{ group:{n,d} } }].
function sanitizeDeptBreakdown(arr) {
  if (!Array.isArray(arr)) return null;
  const out = arr.map((r) => {
    const g = (r && r.g && typeof r.g === 'object' && !Array.isArray(r.g)) ? r.g : {};
    const gg = {};
    Object.keys(g).forEach((k) => { const c = g[k] || {}; gg[String(k)] = { n: Number(c.n) || 0, d: Number(c.d) || 0 }; });
    return { dept: String((r && r.dept) || '').slice(0, 80), g: gg };
  }).filter((r) => r.dept || Object.keys(r.g).some((k) => r.g[k].n || r.g[k].d));
  return out.length ? out : null;
}
function normResp(r) {
  if (!r) return null;
  if (typeof r === 'string') return { name: r.trim() };
  return { id: r.id || null, name: String(r.name || '').trim(), title: r.title || '' };
}
async function col(name) { const db = await getDbHandle(); return db ? db.collection(name) : null; }

// ---- Quality is now EMBEDDED in each department doc as `dept.quality` (Statistics +
// Quality merged into ONE collection). These helpers read/write a quality "area" by its
// key against the department that carries it, returning the same {_id,key,name,deptId,
// indicators,...} shape the old standalone `quality` collection exposed, so every caller
// keeps working unchanged. ----
async function qArea(key) {
  const c = await col('departments'); if (!c) return null;
  const dep = await c.findOne({ 'quality.key': String(key) });
  if (!dep || !dep.quality) return null;
  return Object.assign({ _id: dep.quality.key, deptId: dep.id }, dep.quality);
}
async function qAllAreas() {
  const c = await col('departments'); if (!c) return [];
  const deps = await c.find({}).toArray();
  return deps.filter((d) => d.quality && d.quality.key)
    .map((d) => Object.assign({ _id: d.quality.key, deptId: d.id }, d.quality))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}
/* Write ONE indicator, never the whole array.
 *
 * WHY THIS IS NOT `$set: {'quality.indicators': indicators}`
 * That is what it used to be, and it silently destroyed approved data. applyQuality
 * reads the department, copies its indicator array, edits one entry and writes the
 * WHOLE array back. Two approvals that overlap in time each read the array before the
 * other had written, so the second write restored its own stale copy over the first —
 * a textbook lost update. It only shows up when several submissions are approved in
 * quick succession, which is exactly what the normal "approve everything for August"
 * pass looks like: CTVS ICU had 7 Aug-26 approvals ~1s apart and kept the last 2.
 *
 * Scoping the $set to the matched array element means two approvals for DIFFERENT
 * indicators no longer touch the same field at all, so neither can erase the other.
 */
async function qSetIndicator(key, ind) {
  const c = await col('departments'); if (!c) return { matchedCount: 0 };
  const r = await c.updateOne(
    { 'quality.key': String(key), 'quality.indicators.id': ind.id },
    { $set: { 'quality.indicators.$[el]': ind } },
    { arrayFilters: [{ 'el.id': ind.id }] },
  );
  if (r.matchedCount) return r;
  // Indicator not on the department yet — append it. $push is atomic too, so adding a
  // new indicator cannot wipe a sibling that landed a moment earlier.
  return c.updateOne({ 'quality.key': String(key) }, { $push: { 'quality.indicators': ind } });
}
async function qSetArea(key, setObj) {
  const c = await col('departments'); if (!c) return { matchedCount: 0 };
  const set = {}; Object.keys(setObj || {}).forEach((k) => { set['quality.' + k] = setObj[k]; });
  return c.updateOne({ 'quality.key': String(key) }, { $set: set });
}
async function qCreateArea(name) {
  const c = await col('departments'); if (!c) throw new Error('Database not available.');
  const base = 'area-' + (String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'dept');
  let key = base, n = 1; while (await c.findOne({ 'quality.key': key })) key = base + '-' + (++n);
  const _id = '__q_' + key; // quality-only pseudo-department (hidden from stats views)
  await c.insertOne({ _id, id: _id, name, short: name, group: 'Quality', qualityOnly: true, qualityKey: key, order: 9500, months: [], data: [], cols: [], quality: { key, name, indicators: [], deptId: _id, createdAt: Date.now() } });
  return { key, name };
}
async function qDeleteArea(key) {
  const c = await col('departments'); if (!c) throw new Error('Database not available.');
  const dep = await c.findOne({ 'quality.key': String(key) });
  if (!dep) return { deletedCount: 0 };
  if (dep.qualityOnly) { const r = await c.deleteOne({ _id: dep._id }); return { deletedCount: r.deletedCount }; }
  const r = await c.updateOne({ _id: dep._id }, { $unset: { quality: '' } });
  return { deletedCount: r.matchedCount };
}

// In-memory fallback for dev (no MONGODB_URI). The web app always has Mongo.
const mem = { responsibles: [], submissions: [], fieldRequests: [] };

/* ---------------- responsible persons ---------------- */
async function getResponsibles() {
  const c = await col('responsibles');
  if (!c) return mem.responsibles.slice();
  const docs = await c.find({}).sort({ name: 1 }).toArray();
  return docs.map((d) => { const { _id, ...r } = d; return { id: _id, ...r }; });
}
async function saveResponsible(input) {
  const now = Date.now();
  const empId = String((input && input.empId) || '').trim().toLowerCase();
  const doc = {
    name: String((input && input.name) || '').trim(),
    title: String((input && input.title) || '').trim(),
    phone: String((input && input.phone) || '').trim(),
    staffId: input && input.staffId != null ? input.staffId : null,
    empId: empId || null,
    departments: Array.isArray(input && input.departments) ? input.departments.map(String) : [],
    qualityAreas: Array.isArray(input && input.qualityAreas) ? input.qualityAreas.map(String) : [],
    qualityIndicators: normQualityIndicators(input && input.qualityIndicators),
    active: !(input && input.active === false),
  };
  if (!doc.name) throw new Error('Name is required.');
  // 2-40 like the user dialog (users-admin.js), so a login created there can always be saved from
  // the matrix. The public sign-up (registerCollector) keeps its own 3-40 rule.
  if (empId && !/^[a-z0-9._-]{2,40}$/.test(empId)) throw new Error('Emp ID must be 2-40 chars: letters, numbers, . _ -');
  const id = input && input.id ? String(input.id) : genId('resp');
  const c = await col('responsibles');
  const existing = c ? await c.findOne({ _id: id }) : (mem.responsibles.find((r) => r.id === id) || null);
  // UNIFIED ASSIGNMENT: quality areas DERIVE from the single department list (or ALL areas
  // for a hospital-wide role), so assigning a person once covers BOTH the statistics data
  // module and quality — there is no second hand-maintained qualityAreas array to drift.
  // allQualityAreas is preserved across saves (the legacy UI doesn't send it) so a
  // hospital-wide infection-control role isn't silently downgraded on an unrelated edit.
  const allQA = (input && input.allQualityAreas != null) ? !!input.allQualityAreas : !!(existing && existing.allQualityAreas);
  // Effective areas = departments' auto areas UNION any custom/extra areas the admin picked.
  // Custom access rides on top of the assign-once default. The derive is shared with the
  // user dialog (users-admin.js → deriveAssignment) so both write paths store the same areas.
  // A caller that sends no customQualityAreas (registerCollector, older clients) posts the
  // effective union in qualityAreas; subtracting the derived set gives the same result as before.
  // While hospital-wide, a posted qualityAreas is EVERY area: reading it as custom would turn every
  // area into an extra once hospital-wide is switched off, so the stored extras are kept instead.
  const customIn = Array.isArray(input && input.customQualityAreas) ? input.customQualityAreas
    : !allQA ? doc.qualityAreas
    : (existing && Array.isArray(existing.customQualityAreas)) ? existing.customQualityAreas : [];
  const scope = await deriveAssignment({
    departments: doc.departments,
    allQualityAreas: allQA,
    customQualityAreas: customIn,
    qualityIndicators: doc.qualityIndicators,
  });
  doc.allQualityAreas = scope.allQualityAreas;
  doc.customQualityAreas = scope.customQualityAreas;
  doc.qualityAreas = scope.qualityAreas;
  // Pre-validate the login side BEFORE any write, so a predictable user-sync failure (admin or
  // non-portal id, nurse/PCA given scope, missing password) leaves nothing half-saved that a
  // client retry would then DUPLICATE (a retry without input.id mints a new genId).
  if (empId) {
    const usersPre = await getUsers();
    const exPre = await usersPre.findOne({ username: empId });
    const refusal = portalLoginRefusal(exPre);
    if (refusal) throw new Error(refusal);
    if (exPre && NO_DATA_ROLES.indexOf(exPre.role) >= 0 && scopeIsNonEmpty(scope)) throw new Error(NURSE_PCA_SCOPE_ERROR);
    if (!exPre && !(input && input.password)) throw new Error('A password is required to create the login for "' + empId + '".');
  }
  // Users doc FIRST, then the record: the same order as the user dialog (users-admin.js), and the
  // users doc is the authority, so a failure part-way never leaves the matrix ahead of the account.
  // When an emp ID is set, keep a matching collector LOGIN account in sync so the
  // person can sign in and get a data-limited, per-user view of their departments.
  if (empId) {
    await upsertCollectorUser({ empId, password: input && input.password, name: doc.name, departments: doc.departments, qualityAreas: doc.qualityAreas, customQualityAreas: doc.customQualityAreas, allQualityAreas: doc.allQualityAreas, qualityIndicators: doc.qualityIndicators, active: doc.active, responsibleId: id });
  }
  let rec;
  if (!c) {
    const i = mem.responsibles.findIndex((r) => r.id === id);
    rec = { id, ...doc, createdAt: i >= 0 ? mem.responsibles[i].createdAt : now, updatedAt: now };
    if (i >= 0) mem.responsibles[i] = rec; else mem.responsibles.push(rec);
  } else {
    const base = { ...doc, createdAt: existing ? existing.createdAt : now, updatedAt: now };
    await c.replaceOne({ _id: id }, base, { upsert: true });
    rec = { id, ...base };
  }
  // The record moved to another login (emp ID changed or cleared): drop the OLD login's link to it,
  // or saving that old account in the user dialog would take this record back and overwrite it.
  const prevEmp = existing && existing.empId ? String(existing.empId).trim().toLowerCase() : '';
  if (prevEmp && prevEmp !== empId) {
    const users = await getUsers();
    await users.updateOne({ username: prevEmp, responsibleId: id }, { $unset: { responsibleId: '' } });
  }
  return { ...rec, hasLogin: !!empId };
}

// Nurse / PCA are portal roles WITHOUT the datacol module (access.js), so they cannot submit data.
const NO_DATA_ROLES = ['nurse', 'pca'];
const NURSE_PCA_SCOPE_ERROR = 'Nurse/PCA accounts cannot submit data. Change the role to Data collector or In-charge in Settings → Users & Roles.';
// True when a scope (a derived one, or a request body) actually grants something. An empty
// departments list etc. is "no scope": it must not mint a record or trip the nurse/PCA refusal.
function scopeIsNonEmpty(s) {
  if (!s) return false;
  const filled = (v) => Array.isArray(v) && v.some((x) => String(x == null ? '' : x).trim());
  const qi = s.qualityIndicators;
  return s.allQualityAreas === true || filled(s.departments) || filled(s.customQualityAreas) || filled(s.qualityAreas)
    || !!(qi && typeof qi === 'object' && !Array.isArray(qi) && Object.keys(qi).some((k) => filled(qi[k])));
}
// Why an EXISTING account may not be (re)written as a portal login from the matrix, or null.
// A non-portal role is refused rather than turned into a collector: an in-charge demoted to a
// 'User' was otherwise silently re-promoted (and its perms dropped) by the next matrix toggle.
// A normal account ('User') is accepted since Data Submission became a module: assigning
// it departments here gives it the module too (upsertCollectorUser), never a role change.
function portalLoginRefusal(u) {
  if (!u) return null;
  if (u.role === 'Administrator') return 'That ID belongs to an administrator.';
  if (u.role && u.role !== 'User' && accessRoles.PORTAL_ROLES.indexOf(u.role) < 0) return 'That ID belongs to a ' + u.role + ' account. Change it in Access Control first.';
  return null;
}
// Data Submission as a module: the actions a person needs to report their own data.
const SUBMIT_ACTIONS = ['view', 'edit', 'add'];
// A normal account given a data-collection assignment also gets the Data Submission
// module, or the assignment would do nothing. Everything else it holds is kept.
function withSubmitModule(perms) {
  const p = (perms && typeof perms === 'object' && !Array.isArray(perms)) ? Object.assign({}, perms) : {};
  const cur = Array.isArray(p.datasubmit) ? p.datasubmit : [];
  if (!cur.length) p.datasubmit = SUBMIT_ACTIONS.slice();
  return p;
}
const isDupKey = (e) => !!e && (e.code === 11000 || /E11000/.test(String(e.message || '')));
// Records minted FOR an account use this fixed id, so concurrent creates converge on one doc.
const RESP_USER_PREFIX = 'resp-u-';

/* ONE derive for a portal account's data-collection scope, used by BOTH write paths:
   the Indicator Access matrix (saveResponsible above) and the user dialog
   (users-admin.js create/update). Returns the normalised scope with
     customQualityAreas = only the areas granted directly (never the ones a department
                          derives, or unticking that department could not remove them;
                          kept while hospital-wide),
     qualityAreas       = derived ∪ custom (or every area when hospital-wide).
   The deptmap is force-refreshed first: these areas are STORED, and the per-instance map is
   never invalidated across instances, so a stale one would persist the wrong access. */
async function deriveAssignment(input, opts) {
  const inp = input || {};
  const clean = (v) => (Array.isArray(v) ? v.map((x) => String(x == null ? '' : x).trim()).filter(Boolean) : []);
  const departments = [...new Set(clean(inp.departments))];
  const allQualityAreas = !!inp.allQualityAreas;
  if (!(opts && opts.mapFresh)) await deptmap.get(true).catch(() => null);   // mapFresh: caller refreshed it moments ago
  const derived = await deptmap.deriveQualityAreas(departments, false, []);
  // Kept even while hospital-wide (the effective areas are all of them anyway), so switching
  // hospital-wide off brings the directly-granted extras back instead of dropping them for good.
  const customQualityAreas = [...new Set(clean(inp.customQualityAreas))].filter((ak) => derived.indexOf(ak) < 0);
  const qualityAreas = await deptmap.deriveQualityAreas(departments, allQualityAreas, customQualityAreas);
  return { departments, allQualityAreas, customQualityAreas, qualityAreas, qualityIndicators: normQualityIndicators(inp.qualityIndicators) };
}

/* Mirror a portal ACCOUNT's scope into `responsibles`, so the Indicator Access matrix, the
   "assigned" hints on the forms and the account itself never disagree.

   The users doc is the authority (getUserScope reads it at sign-in); this keeps the
   responsible record in step with it. Resolution: the doc linked by user.responsibleId,
   else the one whose empId is the username, else a NEW one is minted (only when
   `create` is set). The existing doc is MERGED — phone, staffId, title and anything else
   only the responsibles side holds are left alone.

   Split in two so a caller can resolve (and fail) BEFORE it writes the account:
     const plan = await planResponsibleSync(user, { create: true });   // read only
     ...write the user with plan.responsibleId...
     await applyResponsibleSync(plan, user, scope);                    // throws on failure */
async function planResponsibleSync(user, opts) {
  const username = String((user && user.username) || '').trim().toLowerCase();
  if (!username) throw new Error('Cannot link a data-collection record without a username.');
  const c = await col('responsibles');
  const byId = (id) => (c ? c.findOne({ _id: String(id) }) : Promise.resolve(mem.responsibles.find((r) => r.id === String(id)) || null));
  const byEmp = () => (c ? c.findOne({ empId: username }) : Promise.resolve(mem.responsibles.find((r) => r.empId === username) || null));
  // A record belongs to this account only while its empId is this username (or unset). The matrix
  // can move a record to another login; a stale users.responsibleId must not take it back.
  const owned = (r) => !!r && (!r.empId || String(r.empId).trim().toLowerCase() === username);
  let existing = null;
  if (user.responsibleId) { const linked = await byId(user.responsibleId); if (owned(linked)) existing = linked; }
  if (!existing) existing = await byEmp();
  if (existing) return { username, existing, responsibleId: String(c ? existing._id : existing.id), create: false };
  if (!(opts && opts.create)) return { username, existing: null, responsibleId: null, create: false };
  const detId = RESP_USER_PREFIX + username;
  const taken = await byId(detId);
  if (taken && owned(taken)) return { username, existing: taken, responsibleId: detId, create: false };
  // The fixed id was moved to another person by the matrix: fall back to a random id.
  return { username, existing: null, responsibleId: taken ? genId('resp') : detId, create: true };
}

/* Mark the record behind a login inactive (the account left the portal roles, or was deleted) so
   the matrix stops listing that person as an assignee. Only the active flag and stamps are
   written: the scope stays, and the document is never deleted. Found by responsibleId when that
   record's empId is this username, else by empId. Returns the record id, or null when none. */
async function deactivateResponsibleFor(user, opts) {
  const username = String((user && user.username) || '').trim().toLowerCase();
  if (!username) return null;
  const c = await col('responsibles');
  const mine = (r) => !!r && String(r.empId || '').trim().toLowerCase() === username;
  let rec = null;
  if (user.responsibleId) {
    const linked = c ? await c.findOne({ _id: String(user.responsibleId) }) : (mem.responsibles.find((r) => r.id === String(user.responsibleId)) || null);
    if (mine(linked)) rec = linked;
  }
  if (!rec) rec = c ? await c.findOne({ empId: username }) : (mem.responsibles.find((r) => r.empId === username) || null);
  if (!rec) return null;
  const now = Date.now();
  const set = { active: false, updatedAt: now };
  if (opts && opts.deactivatedAt) set.deactivatedAt = now;
  const rid = String(c ? rec._id : rec.id);
  if (!c) {
    const i = mem.responsibles.findIndex((r) => r.id === rid);
    if (i >= 0) mem.responsibles[i] = { ...mem.responsibles[i], ...set };
    return rid;
  }
  await c.updateOne({ _id: rid }, { $set: set });
  return rid;
}
async function applyResponsibleSync(plan, user, scope) {
  if (!plan || !plan.responsibleId) return null;   // nothing linked and nothing to create
  const now = Date.now();
  const set = { name: String((user && user.name) || plan.username).trim() || plan.username, empId: plan.username, active: !(user && user.active === false), updatedAt: now };
  if (scope) {
    set.departments = scope.departments;
    set.allQualityAreas = scope.allQualityAreas;
    set.customQualityAreas = scope.customQualityAreas;
    set.qualityAreas = scope.qualityAreas;
    set.qualityIndicators = scope.qualityIndicators;
  }
  const c = await col('responsibles');
  if (plan.create) {
    const doc = { name: set.name, title: String((user && (user.title || user.designation)) || '').trim(), phone: '', staffId: null, empId: plan.username,
      departments: [], qualityAreas: [], customQualityAreas: [], allQualityAreas: false, qualityIndicators: {}, active: set.active, ...set, createdAt: now };
    if (!c) {
      if (!mem.responsibles.some((r) => r.id === plan.responsibleId)) { mem.responsibles.push({ id: plan.responsibleId, ...doc }); return { id: plan.responsibleId, created: true }; }
    } else {
      try { await c.insertOne({ _id: plan.responsibleId, ...doc }); return { id: plan.responsibleId, created: true }; }
      catch (e) { if (!isDupKey(e)) throw e; }
    }
    // A concurrent save for the same account created it first: update that record instead,
    // unless the matrix handed the id to someone else in the meantime.
    const cur = c ? await c.findOne({ _id: plan.responsibleId }) : mem.responsibles.find((r) => r.id === plan.responsibleId);
    if (cur && cur.empId && String(cur.empId).trim().toLowerCase() !== plan.username) throw new Error('That data-collection record now belongs to someone else. Refresh and save again.');
  }
  if (!c) {
    const i = mem.responsibles.findIndex((r) => r.id === plan.responsibleId);
    if (i < 0) throw new Error('The linked data-collection record no longer exists.');
    mem.responsibles[i] = { ...mem.responsibles[i], ...set };
    return { id: plan.responsibleId, created: false };
  }
  const r = await c.updateOne({ _id: plan.responsibleId }, { $set: set });
  if (!r || !r.matchedCount) throw new Error('The linked data-collection record no longer exists.');
  return { id: plan.responsibleId, created: false };
}

// Create/update the LOGIN account behind a responsible person in the users collection (the
// same one the login portal authenticates against). Assignments are mirrored here so the
// session scope is available at login without a second lookup table.
// ROLE: a new account (or a legacy one with no role) becomes 'collector'. An existing
// in-charge / nurse / PCA / collector KEEPS its role — this used to force 'collector' on
// every save, so editing an in-charge's indicators from Responsible Persons or the Indicator
// Access matrix silently demoted them and took their ward screens away. Any other existing
// role (Administrator, User) is refused: see portalLoginRefusal.
async function upsertCollectorUser(opts) {
  const empId = String(opts.empId).toLowerCase();
  const users = await getUsers();
  const set = { name: opts.name || empId, active: opts.active !== false, departments: opts.departments || [], qualityAreas: opts.qualityAreas || [], allQualityAreas: !!opts.allQualityAreas, qualityIndicators: normQualityIndicators(opts.qualityIndicators) };
  // Keep the account's stored custom/derived split in step, or the user dialog would read a
  // stale customQualityAreas and re-grant an area the matrix just removed.
  if (Array.isArray(opts.customQualityAreas)) set.customQualityAreas = opts.customQualityAreas;
  if (opts.responsibleId) set.responsibleId = opts.responsibleId;
  if (opts.password) set.passwordHash = await auth.hash(String(opts.password));
  const existing = await users.findOne({ username: empId });
  if (existing) {
    const refusal = portalLoginRefusal(existing);
    if (refusal) throw new Error(refusal);
    // A legacy row with no role, or a normal account: a normal account holding Data
    // Submission. An existing legacy portal role is left as it is until it is converted.
    if (!existing.role || existing.role === 'User') {
      set.role = 'User';
      // A record's "active" is its place in the Indicator Access matrix, not the person's
      // sign-in: a normal account is switched on and off in Access Control only.
      if (existing.role === 'User') delete set.active;
      if (!existing.role || !(Array.isArray((existing.perms || {}).datasubmit) && existing.perms.datasubmit.length)) {
        set.perms = withSubmitModule(existing.perms);
        // No session revocation: permissions are read from the live account on every request,
        // so the grant takes effect at once without signing the person out of an open session.
      }
    }
    await users.updateOne({ username: empId }, { $set: set });
  } else {
    if (!opts.password) throw new Error('A password is required to create the login for "' + empId + '".');
    // New people are normal accounts holding Data Submission -- no portal role any more.
    await users.insertOne({ username: empId, ...set, role: 'User', perms: withSubmitModule(null),
      // rosterScope left unset: rosterDeptNames then holds them to their own departments.
      staffScope: 'self', sessionEpoch: Date.now(), created_at: Date.now() });
  }
  return { username: empId };
}

// Public self-registration of a collector account (no department assignments yet —
// an admin assigns those afterwards from Responsible Persons).
async function registerCollector(input) {
  const empId = String((input && input.empId) || '').trim().toLowerCase();
  const name = String((input && input.name) || '').trim();
  const password = String((input && input.password) || '');
  if (!name) throw new Error('Your name is required.');
  if (!/^[a-z0-9._-]{3,40}$/.test(empId)) throw new Error('Emp ID must be 3-40 chars: letters, numbers, . _ -');
  if (password.length < 4) throw new Error('Password must be at least 4 characters.');
  const users = await getUsers();
  const existing = await users.findOne({ username: empId });
  if (existing) throw new Error('That Emp ID is already registered. Try signing in.');
  const resp = await saveResponsible({ name, empId, password, departments: [], qualityAreas: [] });
  return { ok: true, username: empId, responsibleId: resp.id };
}

// Verified login scope for a username (role + assigned departments/areas).
async function getUserScope(username) {
  if (!username) return null;
  const users = await getUsers();
  const u = await users.findOne({ username: String(username).toLowerCase() });
  if (!u) return null;
  const perms = (u.perms && typeof u.perms === 'object' && !Array.isArray(u.perms)) ? u.perms : null;
  const unitLead = u.role === 'incharge' || ((u.role || 'User') === 'User' && u.unitLead === true && !!perms && Array.isArray(perms.datasubmit) && perms.datasubmit.length > 0);
  return { username: u.username, name: u.name || u.username, role: u.role || 'User', inCharge: unitLead, unitLead, rosterEdit: u.rosterEdit === true, enterDen: u.enterDen === true, submitKinds: accessRoles.cleanSubmitKinds(u.submitKinds), dsScreens: accessRoles.cleanDsScreens ? accessRoles.cleanDsScreens(u.dsScreens) : null, responsibleId: u.responsibleId || null, departments: u.departments || [], qualityAreas: u.qualityAreas || [], allQualityAreas: !!u.allQualityAreas, qualityIndicators: (u.qualityIndicators && typeof u.qualityIndicators === 'object' && !Array.isArray(u.qualityIndicators)) ? u.qualityIndicators : {}, perms: (u.perms && typeof u.perms === 'object' && !Array.isArray(u.perms)) ? u.perms : null, photo: u.photo || null, email: u.email || null, phone: u.phone || null, designation: u.designation || null, title: u.title || null };
}

async function deleteResponsible(id) {
  const c = await col('responsibles');
  if (!c) { mem.responsibles = mem.responsibles.filter((r) => r.id !== String(id)); return { ok: true }; }
  await c.deleteOne({ _id: String(id) });
  return { ok: true };
}

/* ---------------- build (validate, don't apply) ---------------- */
function validateReportingMonth(month) {
  if (!/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2}$/.test(month)) {
    throw new Error('Select a valid reporting month (for example, Sep-26).');
  }
}
function numericReading(value, label) {
  if (!['string', 'number'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value) < 0) {
    throw new Error(label + ' must be a finite, non-negative number.');
  }
  return Number(value);
}
async function buildPatientSpec(payload) {
  const deptId = String((payload && payload.department) || '').trim();
  const month = String((payload && payload.month) || '').trim();
  const rawValues = (payload && payload.values && typeof payload.values === 'object') ? payload.values : {};
  if (!deptId) throw new Error('Department is required.');
  if (!month) throw new Error('Month is required.');
  validateReportingMonth(month);
  const c = await col('departments');
  if (!c) throw new Error('Database not available.');
  const dept = await c.findOne({ _id: deptId });
  if (!dept) throw new Error('Unknown department: ' + deptId);
  const row = {};
  Object.keys(rawValues).forEach((k) => {
    const v = rawValues[k];
    if (v === '' || v == null) return;
    row[k] = numericReading(v, k);
  });
  if (!Object.keys(row).length) throw new Error('Enter at least one statistic (use 0 for a measured zero).');
  return { type: 'patient', department: deptId, departmentName: dept.name || deptId, month, values: row };
}

async function buildQualitySpec(payload) {
  const area = String((payload && payload.area) || '').trim();
  const month = String((payload && payload.month) || '').trim();
  if (!area) throw new Error('Quality area is required.');
  if (!month) throw new Error('Reporting month is required.');
  validateReportingMonth(month);
  const doc = await qArea(area);
  if (!doc) throw new Error('Unknown quality area: ' + area);
  const indicators = Array.isArray(doc.indicators) ? doc.indicators : [];
  let indId = payload && payload.indicatorId ? String(payload.indicatorId) : '';
  let indName = '';
  let isNew = false;
  // "Patient Fall Rate" / "Patient Fall" / "Needle Stick Injury (NSI)" all name the SAME
  // indicator. Match an existing one by NORMALIZED name before minting a new id, or every
  // free-typed submission spawns a duplicate indicator on the area doc (fragmenting the
  // dashboard and hiding the applied data from the canonical indicator's history).
  const normIndName = (s) => String(s || '').toLowerCase()
    .replace(/\([^)]*\)/g, ' ')            // drop "(NSI)"-style abbreviations
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(rate|rates|ratio)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
  let found = indId ? indicators.find((i) => i.id === indId) : null;
  if (found) { indName = found.name; }
  else {
    const name = String((payload && payload.indicatorName) || '').trim();
    if (!name) throw new Error('Select an existing indicator or provide a new indicator name.');
    found = indicators.find((i) => normIndName(i.name) === normIndName(name)) || null;
    if (found) { indId = found.id; indName = found.name; }
    else {
      isNew = true; indName = name;
      // DERIVE the id from the name instead of appending Math.random(): a random suffix
      // meant the same new indicator submitted for two areas got two unrelated ids, so it
      // could never be recognised as one indicator across departments (this is where the
      // stray ind-needle-stick-sharps-injury-6040 / -4594 / -3893 ids came from). Ids only
      // need to be unique WITHIN this area, so only a real clash gets a numeric suffix.
      const baseId = 'ind-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
      const taken = new Set(indicators.map((i) => String(i.id)));
      indId = baseId;
      for (let n = 2; taken.has(indId); n++) indId = baseId + '-' + n;
    }
  }
  // Single-month entry; the SYSTEM computes the result (the collector never pre-computes):
  //   count  -> the entered value;  rate/% -> numerator / denominator * multiplier
  const formulaIn = (payload && payload.formula) || (found && found.formula) || null;
  const rateFormulas = ['pct', 'rate100', 'rate1000', 'avg'];
  const entryMode = ((payload && payload.entryMode === 'rate') || rateFormulas.includes(formulaIn)) ? 'rate' : 'count';
  const mult = (formulaIn === 'rate1000' || Number(payload && payload.mult) === 1000) ? 1000 : (formulaIn === 'avg' ? 1 : 100);
  // "Not observed" = an explicit no-observation record for the month. Nothing is
  // computed or stored as a value — the flag itself is the datum, so a skipped
  // observation can never be mistaken for a real 0.
  const notObserved = !!(payload && payload.notObserved);
  if (!notObserved) {
    ['value', 'num', 'den'].forEach((key) => {
      if (payload && payload[key] != null && payload[key] !== '') numericReading(payload[key], key);
    });
  }
  let value = null, num = null, den = null;
  if (notObserved) {
    // value/num/den stay null on purpose
  } else if (entryMode === 'rate') {
    const hasNum = payload && payload.num != null && payload.num !== '' && !isNaN(Number(payload.num));
    const hasDen = payload && payload.den != null && payload.den !== '' && !isNaN(Number(payload.den));
    const hasDirectValue = payload && payload.value != null && payload.value !== '' && !isNaN(Number(payload.value));
    if (!hasNum && !hasDen && hasDirectValue) {
      // Shared/public links may submit an already-computed rate/average value only.
      // Keep it as the month value; applyQuality will use months{} fallback for rollups.
      value = Number(payload.value);
    } else {
      num = Number(payload && payload.num) || 0;
      den = Number(payload && payload.den) || 0;
      // No denominator: 0 events is a true 0, but events WITHOUT a denominator have no
      // computable rate — storing 0 would show a real incident as "on benchmark".
      value = den > 0 ? Math.round((num / den) * mult * 100) / 100 : (num > 0 ? null : 0);
    }
  } else {
    const rawVal = payload && payload.value;
    value = (rawVal === '' || rawVal == null) ? 0 : (Number(rawVal) || 0);
  }
  // Optional incident / CAPA block (filled when an incident occurred this month).
  const capaIn = payload && payload.capa;
  const capa = (capaIn && typeof capaIn === 'object' && (capaIn.incidentDetails || capaIn.finding || capaIn.corrective || capaIn.preventive))
    ? { incidentDetails: String(capaIn.incidentDetails || ''), finding: String(capaIn.finding || ''), corrective: String(capaIn.corrective || ''), preventive: String(capaIn.preventive || '') }
    : null;
  // Per-month incidents (each with its own CAPA). The count/numerator auto-derives
  // from how many are logged; the full list is stored on the indicator's month.
  const S = (v) => String((v == null ? '' : v)).slice(0, 4000);
  const incidents = Array.isArray(payload && payload.incidents)
    ? payload.incidents.map((x) => ({
        // patient & incident demographics (per-incident report fields)
        uhid: S(x && x.uhid), patientName: S(x && x.patientName), age: S(x && x.age), gender: S(x && x.gender),
        diagnosis: S(x && x.diagnosis), incidentDate: S(x && x.incidentDate), admissionDate: S(x && x.admissionDate), procedureDate: S(x && x.procedureDate),
        // NSI (needle-stick) also records the injured staff member (victim) + their emp id.
        victimName: S(x && x.victimName), victimId: S(x && x.victimId),
        // Hospital-wide incidents (e.g. NSI on Overall Hospital): the department it happened in.
        department: S(x && x.department),
        // narrative + CAPA
        details: S(x && x.details), finding: S(x && x.finding), corrective: S(x && x.corrective), preventive: S(x && x.preventive),
        remark: S(x && x.remark),
      })).filter((x) => x.details || x.finding || x.corrective || x.preventive || x.uhid || x.patientName || x.diagnosis || x.remark || x.victimName || x.victimId || x.incidentDate || x.department)
    : null;
  // Derive a NUMERIC benchmark threshold (dashboards/scorecard flag breaches from
  // benchmarkValue; a display string like "≤ 5%" is not enough). Prefer explicit
  // payload/found values, else parse the first number out of the benchmark text.
  const benchStr = (payload && payload.benchmark) || (found && found.benchmark) || '';
  let benchmarkValue = (payload && payload.benchmarkValue);
  if (benchmarkValue == null || benchmarkValue === '') benchmarkValue = (found && found.benchmarkValue != null) ? found.benchmarkValue : null;
  if ((benchmarkValue == null || benchmarkValue === '') && benchStr) { const bm = String(benchStr).match(/-?\d+(?:\.\d+)?/); if (bm) benchmarkValue = Number(bm[0]); }
  benchmarkValue = (benchmarkValue == null || benchmarkValue === '' || isNaN(Number(benchmarkValue))) ? null : Number(benchmarkValue);
  return {
    type: 'quality', area, areaName: doc.name || area, indicatorId: indId, indicatorName: indName, capa, incidents,
    // Optional numerator breakdown by staff group (Nurse / Doctor / Other).
    groups: sanitizeGroupMap(payload && payload.groups),
    groupsDen: sanitizeGroupMap(payload && payload.groupsDen),
    deptBreakdown: sanitizeDeptBreakdown(payload && payload.deptBreakdown),
    isNewIndicator: isNew, valueType: (payload && payload.valueType) || (found && found.valueType) || 'Count',
    benchmark: benchStr, benchmarkValue: benchmarkValue,
    goalDirection: (payload && payload.goalDirection) || (found && found.goalDirection) || 'lower_is_better',
    // calculation definition (named inputs + unit) so the rich entry form persists
    formula: entryMode === 'rate'
      ? (rateFormulas.includes(formulaIn) ? formulaIn : (mult === 1000 ? 'rate1000' : (mult === 1 ? 'avg' : 'pct')))
      : 'count',
    numLabel: (payload && payload.numLabel) || (found && found.numLabel) || '',
    denLabel: (payload && payload.denLabel) || (found && found.denLabel) || '',
    unit: (payload && payload.unit) || (found && found.unit) || '',
    month, entryMode, mult, value, num, den, remark: String((payload && payload.remark) || ''),
    notObserved: notObserved || undefined,
  };
}

/* ---------------- apply (write to canonical collections) ---------------- */
/* Same lost-update hazard qSetIndicator documents, on the statistics side: this rewrites
 * the department's whole months[]/data[] arrays, so two approvals for one department that
 * overlap in time (an "approve all of August" pass, or Jul + Aug for the same ward) each
 * read the arrays before the other wrote, and the second write erased the first. The
 * write is now conditional on the arrays still being exactly what was read; on a clash
 * it re-reads and re-merges, so both approvals land. */
async function applyPatient(spec) {
  const c = await col('departments');
  if (!c) throw new Error('Database not available.');
  for (let attempt = 0; attempt < 8; attempt++) {
    const dept = await c.findOne({ _id: spec.department });
    if (!dept) throw new Error('Department no longer exists: ' + spec.department);
    const set = await mergePatient(dept, spec);
    const unchanged = (f) => (dept[f] === undefined ? { $exists: false } : dept[f]);
    const filter = { _id: spec.department, months: unchanged('months'), data: unchanged('data') };
    if (set.cols) filter.cols = unchanged('cols');
    const r = await c.updateOne(filter, { $set: set });
    if (r.matchedCount) return;
  }
  throw new Error('The department was being updated by someone else — please approve again.');
}
async function mergePatient(dept, spec) {
  const months = Array.isArray(dept.months) ? dept.months.slice() : [];
  const data = Array.isArray(dept.data) ? dept.data.map((r) => Object.assign({}, r)) : [];
  const idx = months.indexOf(spec.month);
  if (idx >= 0) data[idx] = Object.assign({}, data[idx], spec.values);
  else { months.push(spec.month); data.push(Object.assign({}, spec.values)); }
  // An admin CLEARED a figure on an approved sheet: the merge above can only add or overwrite,
  // so the wrongly entered number used to stay live. Only keys this submission itself set.
  (spec.removeKeys || []).forEach((k) => { const i = months.indexOf(spec.month); if (i >= 0 && data[i]) delete data[i][k]; });
  const zipped = months.map((m, i) => ({ m, r: data[i], rank: monthRank(m) })).sort((a, b) => a.rank - b.rank);
  // Auto-register any submitted metric the column catalog doesn't know. Custom fields
  // are defined in the CLIENT overlay (unico_store_v3 renames[dept].cols), which drifts
  // per-browser — a value applied without a canonical column silently disappears from
  // every table/report/export (Endoscopy Jun-26 c_evl bug class). Labels come from the
  // overlay definition when one exists, else are prettified from the key.
  const cols = Array.isArray(dept.cols) ? dept.cols.slice() : [];
  const known = new Set(cols.map((co) => co.id));
  const unknown = Object.keys(spec.values || {}).filter((k) => !known.has(k));
  if (unknown.length) {
    let ovCols = [];
    try {
      const snap = await getAppData();
      let ov = snap && snap.data && snap.data.unico_store_v3;
      if (typeof ov === 'string') ov = JSON.parse(ov);
      ovCols = (((ov && ov.renames) || {})[spec.department] || {}).cols || [];
    } catch (e) { /* overlay unavailable -> prettified labels */ }
    const pretty = (k) => String(k).replace(/^c_/, '').replace(/_/g, ' ').trim().replace(/\b\w/g, (ch) => ch.toUpperCase()) || k;
    unknown.forEach((k) => {
      const oc = ovCols.find((co) => co && co.id === k);
      const nc = { id: k, label: (oc && oc.label) || pretty(k), custom: true };
      if (oc && oc.pct) nc.pct = true;
      cols.push(nc);
    });
  }
  const set = { months: zipped.map((z) => z.m), data: zipped.map((z) => z.r) };
  if (unknown.length) set.cols = cols;
  // WHEN this month was last approved — store.js lets it outrank an OLDER Data Entry overlay
  // value or month deletion (the overlay used to win on screen regardless of age).
  set['approvedAt.' + spec.month] = Date.now();
  return set;
}

/* qSetIndicator stopped approvals for DIFFERENT indicators erasing each other, but it still
 * writes the WHOLE indicator: two approvals for the SAME indicator and different months
 * (Jul + Aug CAUTI in one "approve all" pass) each merged into their own stale copy, and
 * the later write dropped the earlier month. The write is now conditional on the indicator
 * still being exactly what was read; on a clash it re-reads and re-merges. */
async function applyQuality(spec) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const doc = await qArea(spec.area);
    if (!doc) throw new Error('Quality area no longer exists: ' + spec.area);
    const orig = (Array.isArray(doc.indicators) ? doc.indicators : []).find((i) => i.id === spec.indicatorId) || null;
    // A fresh spec copy per attempt: the merge rewrites spec.value, and a retry must start
    // from what was submitted, not from the previous attempt's computed value.
    const ind = mergeQuality(orig, Object.assign({}, spec));
    if (await qSetIndicatorIf(spec.area, orig, ind)) return;
  }
  throw new Error('This indicator was being updated by someone else — please approve again.');
}
async function qSetIndicatorIf(key, orig, ind) {
  const c = await col('departments'); if (!c) return true;
  const r = orig
    ? await c.updateOne({ 'quality.key': String(key), 'quality.indicators': orig }, { $set: { 'quality.indicators.$[el]': ind } }, { arrayFilters: [{ 'el.id': ind.id }] })
    : await c.updateOne({ 'quality.key': String(key), 'quality.indicators.id': { $ne: ind.id } }, { $push: { 'quality.indicators': ind } });
  if (r.matchedCount) return true;
  // Nothing changed since the read, yet the equality filter missed (a stored value that
  // doesn't round-trip byte-identically): write as before rather than failing every retry.
  const now = await qArea(key);
  const cur = now && (now.indicators || []).find((i) => i.id === ind.id);
  if (JSON.stringify(cur || null) === JSON.stringify(orig)) { await qSetIndicator(key, ind); return true; }
  return false;
}
// The indicator ON RECORD decides how a reading is stored. A count indicator (falls, NSI
// cases) submitted in rate mode — an optional denominator typed on the desktop form, or the
// phone app sending every entry as a rate — used to be stored as num/den×mult AND to rewrite
// the indicator's formula, turning every month of it into a rate for good.
function alignToIndicator(spec, ind) {
  if (!(ind && ind.formula === 'count' && spec.entryMode === 'rate')) return;
  const n = (spec.num != null && spec.num !== '') ? spec.num : spec.value;
  Object.assign(spec, { entryMode: 'count', formula: 'count', value: (n == null || n === '') ? null : Number(n), num: null, den: null });
}
function mergeQuality(orig, spec) {
  let ind = orig ? Object.assign({}, orig) : null;
  if (!ind) {
    ind = { id: spec.indicatorId, name: spec.indicatorName, valueType: spec.valueType || 'Count', benchmark: spec.benchmark || '', benchmarkValue: (spec.benchmarkValue != null ? spec.benchmarkValue : null), goalDirection: spec.goalDirection || 'lower_is_better', months: {}, monthRemarks: {} };
  }
  alignToIndicator(spec, orig);
  // WHEN this month was last approved. Manual console edits live in the shared overlay, which
  // always used to win on screen — so a month cleared or typed there earlier hid every later
  // approved reading for good ("data missing after approval"). The client compares this stamp
  // with the overlay edit's own stamp (mEditedAt) and shows whichever is newer.
  ind.mApprovedAt = Object.assign({}, ind.mApprovedAt || {}, { [spec.month]: Date.now() });
  // Persist the calculation definition so the rich entry form re-renders on reselect — but
  // only where the indicator has none; a submission never redefines an existing indicator.
  if (spec.formula && !ind.formula) ind.formula = spec.formula;
  if (spec.benchmark) ind.benchmark = spec.benchmark;
  if (spec.benchmarkValue != null) ind.benchmarkValue = spec.benchmarkValue;
  if (spec.numLabel) ind.numLabel = spec.numLabel;
  if (spec.denLabel) ind.denLabel = spec.denLabel;
  if (spec.unit) ind.unit = spec.unit;
  // "Not observed" month: no observation was done, so there is no value. Record the
  // explicit flag and REMOVE any stored value/breakdown for that month — a withdrawn
  // reading must not linger and read as real data. The month's legacy quarter is
  // dropped before recompute so it rebuilds from the months that remain (quartersByFy
  // is rebuilt wholesale inside recomputeQuarters).
  if (spec.notObserved) {
    const mo = spec.month;
    ind.mNotObserved = Object.assign({}, ind.mNotObserved || {}, { [mo]: true });
    ['months', 'mNum', 'mGroups', 'mGroupsDen', 'mDeptBreakdown', 'incidents', 'capa'].forEach((k) => {
      if (ind[k] && Object.prototype.hasOwnProperty.call(ind[k], mo)) { ind[k] = Object.assign({}, ind[k]); delete ind[k][mo]; }
    });
    ind.monthRemarks = Object.assign({}, ind.monthRemarks || {}, { [mo]: spec.remark || 'Not observed' });
    const q = Object.keys(QUARTER_MONTHS).find((k) => (QUARTER_MONTHS[k] || []).includes(mo));
    if (q && ind.quarters) { ind.quarters = Object.assign({}, ind.quarters); delete ind.quarters[q]; }
    recomputeQuarters(ind);
    return ind;
  }
  // A real reading supersedes any earlier "Not observed" mark for the month.
  if (ind.mNotObserved && ind.mNotObserved[spec.month]) { ind.mNotObserved = Object.assign({}, ind.mNotObserved); delete ind.mNotObserved[spec.month]; }
  if (Array.isArray(spec.incidents)) ind.incidents = Object.assign({}, ind.incidents || {}, { [spec.month]: spec.incidents });
  if (spec.groups) ind.mGroups = Object.assign({}, ind.mGroups || {}, { [spec.month]: spec.groups });
  if (spec.groupsDen) ind.mGroupsDen = Object.assign({}, ind.mGroupsDen || {}, { [spec.month]: spec.groupsDen });
  if (spec.deptBreakdown) ind.mDeptBreakdown = Object.assign({}, ind.mDeptBreakdown || {}, { [spec.month]: spec.deptBreakdown });
  // Monthly storage (no quarters). For rate/%, keep numerator/denominator per month.
  if (spec.entryMode === 'rate') {
    let num = spec.num;
    const mlt = Number(spec.mult) || 100;
    if ((num == null || num === '') && spec.value != null && spec.value !== '') {
      ind.months = Object.assign({}, ind.months || {}, { [spec.month]: spec.value });
      if (spec.remark) ind.monthRemarks = Object.assign({}, ind.monthRemarks || {}, { [spec.month]: spec.remark });
      if (spec.capa) ind.capa = Object.assign({}, ind.capa || {}, { [spec.month]: Object.assign({ value: spec.value, recordedAt: Date.now() }, spec.capa) });
      recomputeQuarters(ind);
      return ind;
    }
    // A submission with no real denominator (e.g. a collector logging NSI cases against the
    // ADMIN-owned staff headcount) must NOT overwrite the stored denominator. Fall back to the
    // month's own mDen, else the last non-empty mDen, so the rate still computes.
    const submittedDen = (spec.den != null && spec.den !== '' && Number(spec.den) > 0) ? Number(spec.den) : null;
    const monthDen = (ind.mDen && ind.mDen[spec.month] != null && ind.mDen[spec.month] !== '') ? Number(ind.mDen[spec.month]) : null;
    const carryDen = ind.mDen ? Object.keys(ind.mDen).map(k => ind.mDen[k]).filter(v => v != null && v !== '').map(Number).filter(v => v > 0).pop() : null;
    const den = submittedDen != null ? submittedDen : (monthDen != null ? monthDen : (carryDen != null ? carryDen : 0));
    // den 0 with events logged -> rate is UNKNOWN (null), never a false on-benchmark 0.
    const computed = den > 0 ? Math.round((Number(num) / den) * mlt * 100) / 100 : (Number(num) > 0 ? null : 0);
    // Admin value-only correction while pending: back-solve the numerator from the edited value.
    // Only when the submission carried its OWN denominator — a value is only meaningful against
    // the base it was computed on. Without one (NSI cases against the admin headcount) a stored
    // value of 0 is a placeholder, and back-solving from it erased every logged case to 0.
    if (submittedDen != null && spec.value != null && spec.value !== '' && Number(spec.value) !== computed) {
      num = Math.round((Number(spec.value) / mlt) * den * 100) / 100;
    }
    ind.mNum = Object.assign({}, ind.mNum || {}, { [spec.month]: num });
    if (submittedDen != null) ind.mDen = Object.assign({}, ind.mDen || {}, { [spec.month]: submittedDen });
    spec.value = computed; // store the correctly computed monthly value (not a false 0)
  }
  ind.months = Object.assign({}, ind.months || {}, { [spec.month]: spec.value });
  if (spec.remark) ind.monthRemarks = Object.assign({}, ind.monthRemarks || {}, { [spec.month]: spec.remark });
  // Incident / CAPA (Corrective & Preventive Action) for the month, when provided.
  if (spec.capa) ind.capa = Object.assign({}, ind.capa || {}, { [spec.month]: Object.assign({ value: spec.value, recordedAt: Date.now() }, spec.capa) });
  // Recompute authoritative quarter rollups + benchmark status from the just-written
  // monthly data. `ind` is the same reference held in `indicators`, so the in-place
  // mutation is persisted by the $set below.
  recomputeQuarters(ind);
  return ind;
}

/* ---------------- admin: custom fields on the patient form ---------------- */
// Admins can add/remove custom columns on a department's data-entry form. Custom
// columns are tagged {custom:true} so built-in census columns can't be deleted.
// The cols write is conditional on the array still being what was read (as in applyPatient):
// two fields added at once (two field requests approved together) each rewrote the whole
// array from their own stale copy, and the second erased the first.
async function addDepartmentField(deptId, field) {
  const c = await col('departments');
  if (!c) throw new Error('Database not available.');
  const label = String((field && field.label) || '').trim();
  if (!label) throw new Error('Field label is required.');
  for (let attempt = 0; attempt < 8; attempt++) {
    const dept = await c.findOne({ _id: String(deptId) });
    if (!dept) throw new Error('Unknown department.');
    let id = String((field && field.id) || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (!id) id = 'cf' + label.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 14) + Math.floor(100 + Math.random() * 900);
    const cols = Array.isArray(dept.cols) ? dept.cols.slice() : [];
    if (cols.some((co) => co.id === id)) throw new Error('A field with that id already exists.');
    const newCol = { id, label, custom: true };
    if (field && field.pct) newCol.pct = true;
    cols.push(newCol);
    const r = await c.updateOne({ _id: String(deptId), cols: dept.cols === undefined ? { $exists: false } : dept.cols }, { $set: { cols } });
    if (r.matchedCount) return { ok: true, field: newCol, cols };
  }
  throw new Error('The department was being updated by someone else — please try again.');
}
async function removeDepartmentField(deptId, fieldId) {
  const c = await col('departments');
  if (!c) throw new Error('Database not available.');
  const dept = await c.findOne({ _id: String(deptId) });
  if (!dept) throw new Error('Unknown department.');
  const cols = Array.isArray(dept.cols) ? dept.cols : [];
  const target = cols.find((co) => co.id === String(fieldId));
  if (!target) throw new Error('Field not found.');
  if (!target.custom) throw new Error('Only custom fields can be removed (built-in columns are protected).');
  await c.updateOne({ _id: String(deptId) }, { $set: { cols: cols.filter((co) => co.id !== String(fieldId)) } });
  return { ok: true, cols: cols.filter((co) => co.id !== String(fieldId)) };
}

/* ---------------- field requests: a unit ASKS for a custom field, an administrator decides ----------------
 * Adding a column changes the form for everyone who reports that unit, so it stays admin-only;
 * an in-charge / collector files a request instead. Collection `fieldRequests` — never deleted:
 *   { _id, deptId, deptName, label, pct, reason, status: 'pending'|'approved'|'rejected',
 *     requestedBy, requestedByUser, createdAt, decidedBy, decidedAt, decisionReason, fieldId, linkedExisting }
 * An approval first CLAIMS the row (pending -> 'approving', like submissions), so a double click or
 * two admins can never add the column twice; a claim older than APPROVE_CLAIM_MS is reclaimable. */
const normFieldLabel = (s) => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, '');
function httpError(status, message, extra) { const e = new Error(message); e.status = status; return Object.assign(e, extra || {}); }
function frOut(d) { if (!d) return null; const { _id, ...r } = d; return Object.assign({ id: _id != null ? _id : r.id }, r); }
// A visible column on the department whose label matches (case- and space-insensitive).
// Hidden duplicate columns are never offered for entry, so they don't count as "already there".
async function frColumnByLabel(deptId, label) {
  const c = await col('departments'); if (!c) return null;
  const dept = await c.findOne({ _id: String(deptId) });
  const key = normFieldLabel(label);
  return ((dept && dept.cols) || []).find((co) => co && !co.hidden && normFieldLabel(co.label) === key) || null;
}
async function getFieldRequest(id) {
  const c = await col('fieldRequests');
  if (!c) return frOut(mem.fieldRequests.find((r) => r.id === String(id)) || null);
  return frOut(await c.findOne({ _id: String(id) }));
}
// query: { status ('all' = any; 'pending' includes an in-flight approval), user, deptId }. Newest first.
async function listFieldRequests(query) {
  const q = query || {};
  const status = q.status && q.status !== 'all' ? String(q.status) : null;
  const statuses = status === 'pending' ? ['pending', 'approving'] : (status ? [status] : null);
  const c = await col('fieldRequests');
  let rows;
  if (!c) rows = mem.fieldRequests.filter((r) => (!statuses || statuses.includes(r.status)) && (!q.user || r.requestedByUser === q.user) && (!q.deptId || r.deptId === q.deptId));
  else {
    const f = {};
    if (statuses) f.status = { $in: statuses };
    if (q.user) f.requestedByUser = q.user;
    if (q.deptId) f.deptId = q.deptId;
    rows = await c.find(f).sort({ createdAt: -1, _id: -1 }).toArray();
  }
  return rows.map(frOut).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
// Conditional write: cond = { q: Mongo filter, ok: same test for the in-memory store }.
async function frUpdateIf(id, cond, set) {
  const c = await col('fieldRequests');
  if (!c) { const r = mem.fieldRequests.find((x) => x.id === String(id)); if (!r || !cond.ok(r)) return null; Object.assign(r, set); return frOut(Object.assign({}, r)); }
  const res = await c.updateOne(Object.assign({ _id: String(id) }, cond.q), { $set: set });
  return res.matchedCount ? getFieldRequest(id) : null;
}
const FR_PENDING = { q: { status: 'pending' }, ok: (r) => r.status === 'pending' };
const frClaimable = (now) => ({ q: { $or: [{ status: 'pending' }, { status: 'approving', approvingAt: { $lt: now - APPROVE_CLAIM_MS } }] }, ok: (r) => r.status === 'pending' || (r.status === 'approving' && r.approvingAt < now - APPROVE_CLAIM_MS) });
const frHeldClaim = (at) => ({ q: { status: 'approving', approvingAt: at }, ok: (r) => r.status === 'approving' && r.approvingAt === at });
async function frRefuseDecided(id) {
  const cur = await getFieldRequest(id);
  if (!cur) return httpError(404, 'Field request not found.');
  const msg = { approving: 'This request is being approved right now.', approved: 'This request was already approved.', rejected: 'This request was already declined.' }[cur.status] || 'This request is no longer pending.';
  return httpError(409, msg, { code: 'decided', currentStatus: cur.status, request: cur });
}
async function createFieldRequest(deptId, body, by) {
  const b = body || {};
  const label = String(b.label == null ? '' : b.label).trim().slice(0, 80);
  const reason = String(b.reason == null ? '' : b.reason).trim().slice(0, 500);
  if (!label) throw httpError(400, 'Enter the name of the field you need.');
  if (!reason) throw httpError(400, 'Say why this field is needed.');
  const c = await col('departments'); if (!c) throw httpError(503, 'Database not available.');
  const dept = await c.findOne({ _id: String(deptId) });
  if (!dept) throw httpError(404, 'Unknown department.');
  const deptName = dept.name || String(deptId);
  const have = await frColumnByLabel(deptId, label);
  if (have) throw httpError(409, '"' + have.label + '" is already a field on ' + deptName + '.', { code: 'exists', fieldId: have.id });
  const key = normFieldLabel(label);
  const open = (await listFieldRequests({ status: 'pending', deptId: String(deptId) })).find((r) => normFieldLabel(r.label) === key);
  if (open) throw httpError(409, 'A request for "' + open.label + '" on ' + deptName + ' is already waiting for an administrator.', { code: 'pending', pendingId: open.id });
  const doc = { deptId: String(deptId), deptName, label, pct: !!b.pct, reason, status: 'pending', requestedBy: (by && by.name) || 'local', requestedByUser: (by && by.user) || null, createdAt: Date.now(), decidedBy: null, decidedAt: null, decisionReason: '', fieldId: null };
  const id = genId('freq');
  const fc = await col('fieldRequests');
  if (!fc) { const rec = Object.assign({ id }, doc); mem.fieldRequests.unshift(rec); return frOut(Object.assign({}, rec)); }
  await fc.insertOne(Object.assign({ _id: id }, doc));
  return Object.assign({ id }, doc);
}
async function decideFieldRequest(id, body, by) {
  const b = body || {};
  const status = String(b.status || '');
  if (status !== 'approved' && status !== 'rejected') throw httpError(400, 'Choose approve or decline.');
  const reason = String(b.reason == null ? '' : b.reason).trim().slice(0, 500);
  if (!(await getFieldRequest(id))) throw httpError(404, 'Field request not found.');
  if (status === 'rejected') {
    if (!reason) throw httpError(400, 'Give a reason so the requester knows why it was declined.');
    const upd = await frUpdateIf(id, FR_PENDING, { status: 'rejected', decidedBy: by || 'admin', decidedAt: Date.now(), decisionReason: reason });
    if (!upd) throw await frRefuseDecided(id);
    return { ok: true, request: upd };
  }
  const at = Date.now();
  const claimed = await frUpdateIf(id, frClaimable(at), { status: 'approving', approvingAt: at });
  if (!claimed) throw await frRefuseDecided(id);
  try {
    // The column may have been added meanwhile (by hand, or an earlier request for the same
    // label): link to it rather than adding a duplicate.
    const existing = await frColumnByLabel(claimed.deptId, claimed.label);
    const fieldId = existing ? existing.id : (await addDepartmentField(claimed.deptId, { label: claimed.label, pct: claimed.pct })).field.id;
    const done = await frUpdateIf(id, frHeldClaim(at), { status: 'approved', approvingAt: null, decidedBy: by || 'admin', decidedAt: Date.now(), decisionReason: reason, fieldId, linkedExisting: !!existing });
    if (!done) throw await frRefuseDecided(id);
    return { ok: true, request: done, linked: !!existing };
  } catch (e) {
    if (e.code !== 'decided') await frUpdateIf(id, frHeldClaim(at), { status: 'pending', approvingAt: null }).catch(() => {});
    throw e;
  }
}
// Is this submission's indicator one whose denominator only an administrator sets (NSI headcount)?
async function denIsAdminOnly(spec) {
  const a = spec && spec.area ? await qArea(spec.area) : null;
  const ind = a && (a.indicators || []).find((i) => i.id === spec.indicatorId);
  return !!(ind && ind.denAdminOnly);
}

/* ---------------- submissions (pending -> approve/reject) ---------------- */
async function createSubmission(spec, meta) {
  const rec = Object.assign({}, spec, {
    status: 'pending',
    responsible: normResp(meta && meta.responsible),
    note: String((meta && meta.note) || ''),
    submittedBy: (meta && meta.submittedBy) || 'local',
    // The LOGIN (username) of whoever sent it. Ownership ("my submissions", edit-own-pending)
    // used to match on the display NAME only, which broke on a rename and let two people with
    // the same name see each other's rows. Clients prefer this field; old rows fall back to name.
    submittedByUser: (meta && meta.submittedByUser) || null,
    source: (meta && meta.source) || 'app',
    submittedAt: Date.now(),
    // Correction / edit-request markers (absent/false for a normal new submission).
    isCorrection: !!(meta && meta.isCorrection),
    correctionReason: String((meta && meta.correctionReason) || ''),
    correctionFor: (meta && meta.correctionFor) || null,
    priorValues: (meta && meta.priorValues) || null,
  });
  const c = await col('submissions');
  if (!c) { const out = Object.assign({ id: genId('sub') }, rec); mem.submissions.unshift(out); return out; }
  const _id = genId('sub');
  await c.insertOne(Object.assign({ _id }, rec));
  return Object.assign({ id: _id }, rec);
}
// Server-authoritative "old value" snapshot for a correction (never trust the client's old value).
async function snapshotPatientPrior(spec) {
  try {
    const c = await col('departments'); if (!c) return null;
    const d = await c.findOne({ _id: String(spec.department) }); if (!d) return null;
    const idx = (d.months || []).indexOf(spec.month); if (idx < 0) return null;
    return { values: Object.assign({}, (d.data || [])[idx] || {}) };
  } catch (e) { return null; }
}
async function snapshotQualityPrior(spec) {
  try {
    const d = await qArea(spec.area); if (!d) return null;
    const ind = (d.indicators || []).find((i) => i.id === spec.indicatorId); if (!ind) return null;
    const m = spec.month;
    // remark + CAPA too: an edit request that only changes the note or the incident / CAPA text
    // is a real change, and the comparison pop-up needs what is on record to show it.
    return { value: (ind.months || {})[m], num: (ind.mNum || {})[m], den: (ind.mDen || {})[m], notObserved: !!(ind.mNotObserved || {})[m], incidents: (ind.incidents || {})[m] || null, remark: (ind.monthRemarks || {})[m] || '', capa: (ind.capa || {})[m] || null };
  } catch (e) { return null; }
}
// Is there already data ON RECORD for this exact target + month? Returns the server's prior
// snapshot (what the collector's new figures would replace), or null. A plain second report
// for such a month silently overwrote approved data at approval; it must be an edit request.
async function onRecordPrior(spec) {
  const filled = (v) => v != null && v !== '';
  if (spec.type === 'patient') {
    const c = await col('departments'); if (!c) return null;
    const d = await c.findOne({ _id: String(spec.department) }); if (!d) return null;
    const idx = (d.months || []).indexOf(spec.month); const row = idx >= 0 ? (d.data || [])[idx] : null;
    if (!row || !Object.keys(row).some((k) => k !== 'month' && k !== 'full' && filled(row[k]))) return null;
    return { values: Object.assign({}, row) };
  }
  if (spec.isNewIndicator) return null;
  const m = spec.month;
  const area = await qArea(spec.area);
  const ind = area && (area.indicators || []).find((i) => i.id === spec.indicatorId);
  if (ind && (filled((ind.months || {})[m]) || filled((ind.mNum || {})[m]) || (ind.mNotObserved || {})[m])) return snapshotQualityPrior(spec);
  // An approved report counts even when the stored reading was later cleared or changed.
  const key = dupKeyOf(spec);
  const c = await col('submissions');
  const approved = c
    ? (await c.find({ status: 'approved', type: 'quality', area: spec.area, month: m }).toArray()).find((x) => dupKeyOf(x) === key)
    : mem.submissions.find((x) => x.status === 'approved' && dupKeyOf(x) === key);
  if (!approved) return null;
  return (await snapshotQualityPrior(spec)) || { value: approved.value, num: approved.num, den: approved.den, notObserved: !!approved.notObserved, incidents: approved.incidents || null, remark: approved.remark || '', capa: approved.capa || null };
}
function refuseExists(spec, prior) {
  const what = spec.type === 'patient' ? (spec.departmentName || spec.department) : (spec.indicatorName || spec.indicatorId);
  const e = new Error('Data for ' + what + ' — ' + spec.month + ' is already on record. Send it as an edit request with a reason for the change.');
  e.status = 409; e.code = 'exists'; e.prior = prior; throw e;
}
function requireCorrectionReason(m) {
  m.correctionReason = String(m.correctionReason || '').trim();
  if (!m.correctionReason) { const e = new Error('Give a reason for the change.'); e.status = 400; throw e; }
}
// One pending row per target + month. A second one (a double Save, a resubmit after the
// success popup, a phone double-tap) sat beside the first until an admin approved ONE of
// them — and approving the emptier copy auto-rejected the real data. Edit the pending one.
// 'withdrawn' / 'rejected' / 'approved' rows are not open. `excludeId` = the row being resent.
async function refuseIfPending(spec, excludeId) {
  const key = dupKeyOf(spec);
  const c = await col('submissions');
  const open = ['pending', 'approving'];
  let cands;
  if (!c) cands = mem.submissions.filter((x) => open.includes(x.status) && x.type === spec.type && x.month === spec.month);
  else {
    const q = { status: { $in: open }, type: spec.type, month: spec.month };
    if (spec.type === 'patient') q.department = spec.department; else q.area = spec.area;
    cands = await c.find(q).toArray();
  }
  const hit = cands.find((x) => String(x._id || x.id) !== String(excludeId || '') && dupKeyOf(x) === key);
  if (hit) {
    const what = spec.type === 'patient' ? (spec.departmentName || spec.department) : (spec.indicatorName || spec.indicatorId);
    const e = new Error('A submission for ' + what + ' — ' + spec.month + ' is already waiting for review. Open it and edit it instead of sending another.');
    e.status = 409; e.code = 'pending'; e.pendingId = String(hit._id || hit.id); throw e;
  }
}
async function submitPatient(payload, meta) {
  const spec = await buildPatientSpec(payload);
  if (meta && meta.enforceCollection) await refuseOutsideCollection(spec);
  await refuseIfPending(spec);
  const m = Object.assign({}, payload, meta);
  if (m.isCorrection) { requireCorrectionReason(m); m.priorValues = await snapshotPatientPrior(spec); }
  else { const prior = await onRecordPrior(spec); if (prior) refuseExists(spec, prior); }
  return { ok: true, submission: await createSubmission(spec, m) };
}
async function submitQuality(payload, meta, indicatorAllowed) {
  let spec = await buildQualitySpec(payload);
  // A portal account never sets an ADMIN-OWNED denominator (NSI's total healthcare workers):
  // the form only hid it for 'collector', and at approval a submitted denominator overwrites the
  // stored headcount. Rebuild without it, so the rate computes against the admin's figure.
  if (meta && meta.lockAdminDen && !spec.isNewIndicator && ((payload && payload.den != null && payload.den !== '') || (payload && payload.groupsDen)) && (await denIsAdminOnly(spec))) {
    spec = await buildQualitySpec(Object.assign({}, payload, { indicatorId: spec.indicatorId, den: undefined, groupsDen: undefined }));
  }
  if (meta && meta.enforceCollection) await refuseOutsideCollection(spec);
  // Checked on the RESOLVED indicator (buildQualitySpec maps a typed name onto an existing
  // id), so a collector limited to specific indicators can't report one outside the list.
  if (indicatorAllowed && !spec.isNewIndicator && !indicatorAllowed(spec.area, spec.indicatorId)) {
    const err = new Error('You are not assigned to report "' + spec.indicatorName + '".'); err.status = 403; throw err;
  }
  await refuseIfPending(spec);
  const m = Object.assign({}, payload, meta);
  if (m.isCorrection) { requireCorrectionReason(m); m.priorValues = await snapshotQualityPrior(spec); }
  else { const prior = await onRecordPrior(spec); if (prior) refuseExists(spec, prior); }
  return { ok: true, submission: await createSubmission(spec, m) };
}

async function getSubmissionById(id) {
  const c = await col('submissions');
  if (!c) return mem.submissions.find((s) => s.id === String(id)) || null;
  const d = await c.findOne({ _id: String(id) });
  if (!d) return null;
  const { _id, ...r } = d; return { id: _id, ...r };
}
async function setSubmissionStatus(id, patch) {
  const c = await col('submissions');
  if (!c) { const s = mem.submissions.find((x) => x.id === String(id)); if (s) Object.assign(s, patch); return s; }
  await c.updateOne({ _id: String(id) }, { $set: patch });
  return getSubmissionById(id);
}
// Conditional write: applies ONLY while the row is still `status` (one atomic filter), so a
// withdraw / reject / resend can never land on a row an approval claimed a moment earlier.
// Returns the updated row, or null when the status had already moved on.
async function updateSubmissionIf(id, status, set, push) {
  const c = await col('submissions');
  if (!c) {
    const s = mem.submissions.find((x) => x.id === String(id));
    if (!s || s.status !== status) return null;
    Object.keys(push || {}).forEach((k) => { s[k] = (Array.isArray(s[k]) ? s[k] : []).concat([push[k]]); });
    Object.assign(s, set); return s;
  }
  const u = { $set: set }; if (push) u.$push = push;
  const r = await c.updateOne({ _id: String(id), status }, u);
  return r.matchedCount ? getSubmissionById(id) : null;
}
const NOT_PENDING_MSG = { approving: 'This submission is being approved right now.', approved: 'This submission is already approved — send an edit request instead.', rejected: 'This submission was returned — fix and resend it instead.', withdrawn: 'This submission was already withdrawn.' };
// "Delete before approval" is a soft status: nothing stored is ever removed.
async function withdrawSubmission(id, by) {
  const upd = await updateSubmissionIf(id, 'pending', { status: 'withdrawn', withdrawnAt: Date.now(), withdrawnBy: by || 'local' });
  if (upd) return { ok: true, submission: upd };
  const now = await getSubmissionById(id);
  const e = new Error(now ? ((NOT_PENDING_MSG[now.status] || 'Only pending submissions can be withdrawn.') + ' It was not withdrawn.') : 'Submission not found.');
  e.status = now ? 409 : 404; throw e;
}

// Identity of a "duplicate" — mirrors the client's dupKey (data-collection.jsx): same
// type, same target (quality: area + indicator; patient: department), same month.
function dupKeyOf(s) {
  return s.type + '|' + (s.type === 'quality' ? ((s.area || '') + '|' + (s.indicatorId || s.indicatorName || '')) : (s.department || '')) + '|' + s.month;
}
// When a submission is approved, auto-reject any OTHER still-pending submissions for the
// exact same target + month (they are duplicates of the one now on record).
async function autoRejectDuplicates(s, by) {
  const key = dupKeyOf(s);
  const patch = { status: 'rejected', reviewedBy: by || 'admin', reviewedAt: Date.now(), rejectReason: 'Duplicate — superseded by an approved submission', autoRejected: true };
  // OLDER duplicates only. Rejecting every other pending row let approval ORDER decide which
  // data survived: approving the original first auto-rejected the collector's later
  // correction, and the stale figures went live. A NEWER pending row stays for review.
  const older = (x) => (x.submittedAt || 0) <= (s.submittedAt || 0);
  const c = await col('submissions');
  if (!c) {
    let n = 0;
    mem.submissions.forEach((x) => { if (x.id !== s.id && x.status === 'pending' && dupKeyOf(x) === key && older(x)) { Object.assign(x, patch); n++; } });
    return n;
  }
  const q = { _id: { $ne: String(s.id) }, status: 'pending', type: s.type, month: s.month };
  if (s.type === 'patient') q.department = s.department; else q.area = s.area;
  const cands = await c.find(q).toArray();
  const ids = cands.filter((x) => dupKeyOf(x) === key && older(x)).map((x) => x._id);
  if (!ids.length) return 0;
  const r = await c.updateMany({ _id: { $in: ids } }, { $set: patch });
  return (r && r.modifiedCount) || ids.length;
}

// An approval must be CLAIMED before it is applied. Checking `status === 'pending'` and then
// writing later let a double click, a bulk pass overlapping a detail-modal approve, or two
// admins each pass the check and apply the same submission twice — and let a reject/edit
// land between the check and the write. The claim is one atomic pending -> approving flip;
// a claim older than APPROVE_CLAIM_MS (a serverless function killed mid-apply) is reclaimable.
const APPROVE_CLAIM_MS = 2 * 60 * 1000;
async function claimForApproval(id) {
  const c = await col('submissions');
  const now = Date.now();
  if (!c) {
    const s = mem.submissions.find((x) => x.id === String(id));
    if (!s || !(s.status === 'pending' || (s.status === 'approving' && s.approvingAt < now - APPROVE_CLAIM_MS))) return false;
    Object.assign(s, { status: 'approving', approvingAt: now });
    return true;
  }
  const r = await c.updateOne(
    { _id: String(id), $or: [{ status: 'pending' }, { status: 'approving', approvingAt: { $lt: now - APPROVE_CLAIM_MS } }] },
    { $set: { status: 'approving', approvingAt: now } },
  );
  return !!r.modifiedCount;
}
async function approveSubmission(id, by) {
  const s = await getSubmissionById(id);
  if (!s) throw new Error('Submission not found.');
  if (s.status === 'approved') return { ok: true, submission: s, already: true };
  // Auto-rejected as an older duplicate while a bulk pass was running: a skip, not a failure.
  if (s.status === 'rejected' && s.autoRejected) { const e = new Error('Skipped — a newer submission for the same target and month was approved.'); e.superseded = true; throw e; }
  // Only a PENDING submission may be applied — never re-apply a rejected one to live data.
  if (s.status !== 'pending' && s.status !== 'approving') throw new Error('Only pending submissions can be approved (this one is "' + s.status + '").');
  if (!(await claimForApproval(id))) {
    const now = await getSubmissionById(id);
    if (now && now.status === 'approved') return { ok: true, submission: now, already: true };
    if (now && now.status === 'approving') throw new Error('This submission is already being approved — refresh in a moment.');
    throw new Error('Only pending submissions can be approved (this one is "' + (now ? now.status : 'deleted') + '").');
  }
  // Apply what is on record NOW (an edit may have landed after the first read).
  const cur = (await getSubmissionById(id)) || s;
  try {
    if (cur.type === 'patient') await applyPatient(cur);
    else if (cur.type === 'quality') await applyQuality(cur);
    else throw new Error('Unknown submission type.');
  } catch (e) {
    await setSubmissionStatus(id, { status: 'pending', approvingAt: null });
    throw e;
  }
  const upd = await setSubmissionStatus(id, { status: 'approved', reviewedBy: by || 'admin', reviewedAt: Date.now(), approvingAt: null });
  // Keep only one on record: reject any remaining pending duplicates for this target+month.
  const autoRejected = await autoRejectDuplicates(cur, by);
  return { ok: true, submission: upd, autoRejected };
}
async function rejectSubmission(id, by, reason) {
  const s = await getSubmissionById(id);
  if (!s) throw new Error('Submission not found.');
  if (s.status !== 'pending') throw new Error('Only pending submissions can be rejected (this one is "' + s.status + '").');
  const why = String(reason == null ? '' : reason).trim();
  if (!why) { const e = new Error('Give a reason so the collector knows what to fix.'); e.status = 400; throw e; }
  const upd = await updateSubmissionIf(id, 'pending', { status: 'rejected', reviewedBy: by || 'admin', reviewedAt: Date.now(), rejectReason: why });
  if (!upd) { const now = await getSubmissionById(id); const e = new Error('Only pending submissions can be rejected (this one is "' + (now ? now.status : 'deleted') + '").'); e.status = 409; throw e; }
  return { ok: true, submission: upd };
}

async function getSubmissions(query) {
  const status = query && query.status && query.status !== 'all' ? String(query.status) : null;
  const n = Math.min(Math.max(parseInt(query && query.limit, 10) || 200, 1), 1000);
  const offset = Math.max(0, parseInt(query && query.offset, 10) || 0);
  const c = await col('submissions');
  if (!c) {
    let arr = mem.submissions.slice();
    if (status) arr = arr.filter((s) => s.status === status);
    return arr.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0) || String(b.id).localeCompare(String(a.id))).slice(offset, offset + n);
  }
  const filter = status ? { status } : {};
  const docs = await c.find(filter).sort({ submittedAt: -1, _id: -1 }).skip(offset).limit(n).toArray();
  return docs.map((d) => { const { _id, ...r } = d; return { id: _id, ...r }; });
}

async function getStats() {
  const c = await col('submissions');
  if (!c) {
    const by = (f) => mem.submissions.filter(f).length;
    return { total: mem.submissions.length, pending: by((s) => s.status === 'pending'), approved: by((s) => s.status === 'approved'), rejected: by((s) => s.status === 'rejected'), withdrawn: by((s) => s.status === 'withdrawn'), patient: by((s) => s.type === 'patient'), quality: by((s) => s.type === 'quality'), lastSubmittedAt: mem.submissions[0] ? mem.submissions[0].submittedAt : null };
  }
  const [total, pending, approved, rejected, withdrawn, patient, quality] = await Promise.all([
    c.countDocuments({}), c.countDocuments({ status: 'pending' }), c.countDocuments({ status: 'approved' }),
    c.countDocuments({ status: 'rejected' }), c.countDocuments({ status: 'withdrawn' }), c.countDocuments({ type: 'patient' }), c.countDocuments({ type: 'quality' }),
  ]);
  const lastArr = await c.find({}).sort({ submittedAt: -1 }).limit(1).toArray();
  return { total, pending, approved, rejected, withdrawn, patient, quality, lastSubmittedAt: lastArr[0] ? lastArr[0].submittedAt : null };
}

/* ---------------- shareable short links ---------------- */
const memLinks = [];
function shortCode() { return Math.random().toString(36).slice(2, 8); }
function nextMonthSuggestion(dept) {
  const months = (dept && dept.months) || [];
  if (!months.length) return '';
  const p = String(months[months.length - 1]).split('-');
  const idx = MONTHS.indexOf(p[0]); let yy = parseInt(p[1], 10);
  if (idx < 0 || isNaN(yy)) return months[months.length - 1];
  let n = idx + 1; if (n > 11) { n = 0; yy++; }
  return MONTHS[n] + '-' + String(yy).padStart(2, '0');
}
async function createShortlink(input, by) {
  const type = input && input.type === 'quality' ? 'quality' : 'patient';
  const rec = {
    type,
    department: type === 'patient' ? String((input && input.department) || '').trim() : null,
    area: type === 'quality' ? String((input && input.area) || '').trim() : null,
    responsible: normResp(input && input.responsible),
    label: String((input && input.label) || '').trim(),
    createdBy: by || 'admin', createdAt: Date.now(), hits: 0,
  };
  if (type === 'patient' && !rec.department) throw new Error('Department is required for a patient link.');
  if (type === 'quality' && !rec.area) throw new Error('Quality area is required for a quality link.');
  const code = (input && input.code) ? String(input.code) : shortCode();
  const c = await col('shortlinks');
  if (!c) { const out = { code, ...rec }; memLinks.unshift(out); return out; }
  await c.insertOne({ _id: code, ...rec });
  return { code, ...rec };
}
async function getShortlinks() {
  const c = await col('shortlinks');
  if (!c) return memLinks.slice();
  const docs = await c.find({}).sort({ createdAt: -1 }).toArray();
  return docs.map((d) => { const { _id, ...r } = d; return { code: _id, ...r }; });
}
async function getShortlink(code) {
  const c = await col('shortlinks');
  if (!c) return memLinks.find((l) => l.code === String(code)) || null;
  const d = await c.findOne({ _id: String(code) });
  if (!d) return null; const { _id, ...r } = d; return { code: _id, ...r };
}
async function deleteShortlink(code) {
  const c = await col('shortlinks');
  if (!c) { const i = memLinks.findIndex((l) => l.code === String(code)); if (i >= 0) memLinks.splice(i, 1); return { ok: true }; }
  await c.deleteOne({ _id: String(code) }); return { ok: true };
}
async function bumpHit(code) {
  const c = await col('shortlinks');
  if (!c) { const l = memLinks.find((x) => x.code === String(code)); if (l) l.hits = (l.hits || 0) + 1; return; }
  await c.updateOne({ _id: String(code) }, { $inc: { hits: 1 } });
}
async function shortlinkMeta(code) {
  const link = await getShortlink(code);
  if (!link) return null;
  if (link.type === 'patient') {
    const c = await col('departments'); const dept = c ? await c.findOne({ _id: link.department }) : null;
    if (!dept) return { ok: false, error: 'Department not found.' };
    return {
      ok: true, type: 'patient', label: link.label, responsible: link.responsible,
      department: { id: dept._id, name: dept.name },
      // Hidden duplicate columns (an empty twin of another column) are kept on the record but
      // never offered for entry, so values cannot be split between two ids again.
      cols: (dept.cols || []).filter((co) => !co.hidden).map((co) => ({ id: co.id, label: co.label, pct: !!co.pct })),
      suggestedMonth: nextMonthSuggestion(dept),
    };
  }
  const area = await qArea(link.area);
  if (!area) return { ok: false, error: 'Quality area not found.' };
  return {
    ok: true, type: 'quality', label: link.label, responsible: link.responsible,
    area: { key: area._id, name: area.name },
    indicators: (area.indicators || []).map((i) => ({ id: i.id, name: i.name, valueType: i.valueType })),
    months: (function () { const out = []; const yy = new Date().getFullYear() % 100; [yy - 1, yy, yy + 1].forEach((y) => { MONTHS.forEach((m) => out.push({ key: m + '-' + y, label: m + ' 20' + y })); }); return out; })(),
  };
}
async function shortlinkSubmit(code, body) {
  const link = await getShortlink(code);
  if (!link) throw new Error('Invalid or expired link.');
  const meta = { responsible: link.responsible, submittedBy: (link.responsible && link.responsible.name) || 'shared-link', source: 'shortlink' };
  const b = body || {};
  // The SAME guards as the signed-in forms (submitPatient / submitQuality): one pending row per
  // target + month (409 'pending'), no plain second report for a month on record (409 'exists'
  // with the prior), and an edit request needs a reason. It used to call createSubmission
  // directly, so a link could stack duplicates and overwrite approved data. Only whitelisted
  // fields pass: the link itself fixes the department / area and the responsible person.
  const corr = { isCorrection: !!b.isCorrection, correctionReason: b.correctionReason };
  if (link.type === 'patient') {
    return submitPatient(Object.assign({ department: link.department, month: b.month, values: b.values }, corr), meta);
  }
  return submitQuality(Object.assign({ area: link.area, indicatorId: b.indicatorId, indicatorName: b.indicatorName, month: b.month, value: b.value, remark: b.remark }, corr), meta);
}

// Self-contained public form page served at /s/:code (no admin login needed).
function shortlinkPage(code) {
  const C = JSON.stringify(String(code));
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>'
    + '<title>UNICO — Data Submission</title>'
    + '<link rel="stylesheet" href="/vendor/fonts/ibm-plex.css"/>'
    + '<style>'
    + '*{box-sizing:border-box}body{margin:0;font-family:"IBM Plex Sans",system-ui,Segoe UI,sans-serif;background:#0d1b2e;'
    + 'background-image:radial-gradient(1100px 700px at 18% -10%,rgba(39,168,219,.16),transparent 60%);min-height:100vh;padding:24px;color:#16202e}'
    + '.wrap{max-width:560px;margin:0 auto}.card{background:#fff;border:1px solid #e3e9f1;border-radius:16px;padding:24px 26px;box-shadow:0 20px 50px rgba(5,12,24,.45)}'
    + '.logo{height:32px;margin-bottom:8px}h1{font-size:18px;margin:6px 0 2px}.muted{color:#6c7a8c;font-size:12.5px;margin:0 0 16px}'
    + '.who{font-size:12.5px;color:#3c4858;background:#f1f6fb;border:1px solid #e3e9f1;border-radius:8px;padding:8px 11px;margin-bottom:14px}'
    + '.grp{display:flex;flex-direction:column;gap:5px;margin-bottom:12px}label{font-size:12px;font-weight:600;color:#3c4858}'
    + 'input,select,textarea{width:100%;padding:10px 12px;border:1px solid #dde3ec;border-radius:8px;font-family:inherit;font-size:14px;background:#f7f9fc;outline:none}'
    + 'textarea{min-height:58px;resize:vertical}input:focus,select:focus,textarea:focus{border-color:#27a8db;background:#fff}'
    + '.cmp{margin-top:14px;border:1px solid #efd08a;background:#fffaf0;border-radius:10px;padding:12px 14px;font-size:12.5px}'
    + '.cmp table{width:100%;border-collapse:collapse;margin:4px 0 10px}.cmp th,.cmp td{padding:6px 8px;border-bottom:1px solid #f0e3c4;text-align:left}'
    + '.cmp th{font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;color:#6c7a8c}.cmp tr.chg td{background:#fff4e0;font-weight:700;color:#7a5400}'
    + '.btn.btn2{background:#eef2f7;color:#3c4858}'
    + '.btn{width:100%;margin-top:6px;padding:11px;border:0;border-radius:9px;cursor:pointer;font-weight:700;font-size:14px;color:#fff;background:linear-gradient(135deg,#27a8db,#0072a3)}'
    + '.btn:disabled{opacity:.6}.err{color:#b4232f;font-size:12.5px;font-weight:600;display:block;margin-top:8px}'
    + '.done{text-align:center;padding:14px 0}.done h2{margin:10px 0 4px;color:#1f9d57}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}'
    + '</style></head><body><div class="wrap"><div class="card">'
    + '<img class="logo" src="/unico/logo.svg" alt="UNICO Healthcare"/>'
    + '<h1 id="ttl">Data Submission</h1><p class="muted" id="sub">Loading form…</p>'
    + '<div id="form-root"></div></div>'
    + '<p style="text-align:center;color:#9aa6b4;font-size:10.5px;margin-top:14px;letter-spacing:.4px">UNICO Healthcare — Statistics Suite</p>'
    + '</div><script>(function(){'
    + 'var code=' + C + ';var root=document.getElementById("form-root");'
    + 'function esc(s){return String(s==null?"":s).replace(/[&<>\\"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c];});}'
    + 'function field(l,ctrl){return \'<div class="grp"><label>\'+esc(l)+\'</label>\'+ctrl+\'</div>\';}'
    + 'fetch("/s/"+code+"/meta").then(function(r){return r.json();}).then(function(m){'
    + 'if(!m||!m.ok){document.getElementById("sub").innerHTML="";root.innerHTML=\'<span class="err">\'+esc((m&&m.error)||"This link is invalid or expired.")+\'</span>\';return;}'
    + 'var ttl=m.type==="patient"?("Patient Statistics — "+m.department.name):("Quality Data — "+m.area.name);'
    + 'document.getElementById("ttl").textContent=ttl;'
    + 'document.getElementById("sub").textContent=m.label||"Please fill in the fields below and submit.";'
    + 'var html=\'<div class="who">Submitting as: <b>\'+esc((m.responsible&&m.responsible.name)||"—")+\'</b></div>\';'
    + 'if(m.type==="patient"){html+=field("Reporting month (e.g. Jun-26)",\'<input id="f_month" value="\'+esc(m.suggestedMonth||"")+\'"/>\');'
    + 'html+=\'<div class="grid2">\';m.cols.forEach(function(c){html+=field(c.label+(c.pct?" (%)":""),\'<input type="number" step="any" data-col="\'+esc(c.id)+\'"/>\');});html+=\'</div>\';}'
    + 'else{var opts=m.indicators.map(function(i){return \'<option value="\'+esc(i.id)+\'">\'+esc(i.name)+\'</option>\';}).join("");'
    + 'html+=field("Indicator",\'<select id="f_ind">\'+opts+\'</select>\');'
    + 'html+=field("Reporting month",\'<select id="f_month">\'+(m.months||[]).map(function(mm){return \'<option value="\'+esc(mm.key)+\'">\'+esc(mm.label)+\'</option>\';}).join("")+\'</select>\');'
    + 'html+=field("Value",\'<input id="f_val" type="number" step="any"/>\');html+=field("Remark (optional)",\'<input id="f_remark"/>\');}'
    + 'html+=\'<button id="sb" class="btn">Submit</button><div id="msg"></div>\';root.innerHTML=html;'
    + 'document.getElementById("sb").onclick=function(){submit(m);};'
    + '}).catch(function(){document.getElementById("sub").innerHTML="";root.innerHTML=\'<span class="err">Could not load the form.</span>\';});'
    + 'function submit(m){var btn=document.getElementById("sb"),msg=document.getElementById("msg");var body;'
    + 'if(m.type==="patient"){var mo=(document.getElementById("f_month").value||"").trim();if(!mo){msg.innerHTML=\'<span class="err">Enter the reporting month.</span>\';return;}'
    + 'var values={};root.querySelectorAll("[data-col]").forEach(function(inp){if(inp.value!=="")values[inp.getAttribute("data-col")]=inp.value;});body={month:mo,values:values};}'
    + 'else{body={indicatorId:document.getElementById("f_ind").value,month:document.getElementById("f_month").value,value:document.getElementById("f_val").value,remark:document.getElementById("f_remark").value};}'
    + 'msg.innerHTML="";send(m,body);}'
    // Same 409 answers as the app forms: 'exists' opens an on-record vs new comparison with a
    // required reason and resends as an edit request; 'pending' says one is already waiting (a
    // public link cannot open it, so it says who can).
    + `function norm(v){if(v==null)return "";if(typeof v==="boolean")return v?"Yes":"";var t=String(v).trim();if(!t)return "";var n=Number(t);return isNaN(n)?t:String(n);}
function show(v){return norm(v)===""?"—":String(v);}
function crow(label,old,now){var blank=norm(now)==="";return {label:label,old:old,now:blank?null:now,kept:blank&&norm(old)!=="",changed:!blank&&norm(old)!==norm(now)};}
function cmpRows(m,body,prior){var rows=[],keep=function(r){if(norm(r.old)!==""||r.now!=null)rows.push(r);};
if(m.type==="patient"){var pv=prior.values||{},nv=body.values||{},lbl={},keys=m.cols.map(function(c){lbl[c.id]=c.label;return c.id;});
Object.keys(pv).concat(Object.keys(nv)).forEach(function(k){if(k!=="month"&&k!=="full"&&keys.indexOf(k)<0)keys.push(k);});
keys.forEach(function(k){keep(crow(lbl[k]||k,pv[k],nv[k]));});}
else{rows.push(crow("Not observed",prior.notObserved?"Yes":"No","No"));rows.push(crow("Value",prior.value,body.value));keep(crow("Remark",prior.remark,body.remark));}
return rows;}
function compare(m,body,prior){var msg=document.getElementById("msg"),rows=cmpRows(m,body,prior),none=!rows.some(function(r){return r.changed;});
var h='<div class="cmp"><b>Data already recorded for this month</b><p class="muted" style="margin:4px 0 8px">It is already on record, so your figures go to an administrator as an <b>edit request</b>. Nothing on record changes until it is approved.</p><table><tr><th>Field</th><th>On record</th><th>Your new value</th></tr>';
rows.forEach(function(r){h+='<tr'+(r.changed?' class="chg"':'')+'><td>'+esc(r.label)+'</td><td>'+esc(show(r.old))+'</td><td>'+esc(r.kept?show(r.old)+" (kept)":show(r.now))+'</td></tr>';});
h+='</table>'+(none?'<span class="err" style="margin:0 0 8px">No changes from what is on record.</span>':'')+field("Reason for the change (required)",'<textarea id="f_reason" placeholder="e.g. wrong count entered — should be Y not X"></textarea>')+'<div class="grid2"><button class="btn btn2" id="ce">Edit my values</button><button class="btn" id="cs" disabled>Send edit request</button></div></div>';
msg.innerHTML=h;var ta=document.getElementById("f_reason"),cs=document.getElementById("cs");
ta.oninput=function(){cs.disabled=none||!ta.value.trim();};
document.getElementById("ce").onclick=function(){msg.innerHTML="";};
cs.onclick=function(){if(none||!ta.value.trim())return;send(m,Object.assign({},body,{isCorrection:true,correctionReason:ta.value.trim()}));};
ta.focus();}
function send(m,body){var btn=document.getElementById("sb"),msg=document.getElementById("msg"),cs=document.getElementById("cs");
btn.disabled=true;btn.textContent="Submitting…";if(cs){cs.disabled=true;cs.textContent="Sending…";}
var reset=function(){btn.disabled=false;btn.textContent="Submit";};
fetch("/s/"+code+"/submit",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)}).then(function(r){return r.json();}).then(function(r){
if(r&&r.ok){var c=!!body.isCorrection;root.innerHTML='<div class="done"><svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#1f9d57" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/></svg><h2>'+(c?"Edit request sent":"Thank you!")+'</h2><p class="muted">'+(c?"An administrator reviews it. Nothing on record changes until it is approved.":"Your submission was recorded and sent for review.")+'</p><button class="btn" onclick="location.reload()">Submit another</button></div>';return;}
reset();
if(r&&r.code==="exists"){compare(m,body,r.prior||{});return;}
if(r&&r.code==="pending"){msg.innerHTML='<div class="cmp"><b>A submission for this is already waiting for review</b><p class="muted" style="margin:4px 0 0">'+esc(r.error||"")+' It cannot be opened from this link: ask the administrator to edit the waiting one instead of sending another.</p></div>';return;}
msg.innerHTML='<span class="err">'+esc((r&&r.error)||"Submission failed.")+'</span>';
}).catch(function(){reset();if(cs){cs.disabled=false;cs.textContent="Send edit request";}msg.innerHTML+='<span class="err">Submission failed.</span>';});}`
    + '})();</script></body></html>';
}

// Self sign-up page for data collectors (active only in login mode).
function signupPage(opts) {
  const o = opts || {};
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const err = o.error ? '<div class="err">' + esc(o.error) + '</div>' : '';
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>'
    + '<title>Create account - UNICO Data Collection</title>'
    + '<link rel="stylesheet" href="/vendor/fonts/ibm-plex.css"/>'
    + '<style>*{box-sizing:border-box}body{margin:0;font-family:"IBM Plex Sans",system-ui,Segoe UI,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px;'
    + 'background:#0d1b2e;background-image:radial-gradient(1100px 700px at 18% -10%,rgba(39,168,219,.16),transparent 60%)}'
    + '.card{width:min(390px,94vw);background:#fff;border-radius:18px;padding:28px;box-shadow:0 24px 60px rgba(5,12,24,.55)}'
    + '.logo{height:34px;margin-bottom:10px}h1{font-size:18px;margin:4px 0;color:#16202e}.sub{font-size:12.5px;color:#6c7a8c;margin:0 0 16px}'
    + '.grp{display:flex;flex-direction:column;gap:5px;margin-bottom:12px}label{font-size:11.5px;font-weight:600;color:#3c4858}'
    + 'input{width:100%;padding:11px 13px;border:1px solid #dde3ec;border-radius:9px;font-family:inherit;font-size:14px;background:#f7f9fc;color:#16202e}'
    + 'input:focus{border-color:#27a8db;background:#fff;outline:none}.btn{width:100%;margin-top:6px;padding:11px;border:0;border-radius:9px;cursor:pointer;font-family:inherit;font-weight:700;font-size:13.5px;color:#fff;background:linear-gradient(135deg,#27a8db,#0072a3)}'
    + '.err{font-size:12px;font-weight:600;color:#b4232f;background:rgba(210,58,82,.1);border:1px solid rgba(210,58,82,.3);border-radius:8px;padding:7px 10px;margin-bottom:10px}'
    + '.alt{margin-top:14px;font-size:12px;text-align:center;color:#6c7a8c}.alt a{color:#0072a3;font-weight:600;text-decoration:none}</style></head><body>'
    + '<form class="card" method="POST" action="/signup">'
    + '<img class="logo" src="/unico/logo.svg" alt="UNICO"/>'
    + '<h1>Create data-collection account</h1>'
    + '<p class="sub">Register to submit your department statistics. An administrator assigns your departments after sign-up.</p>'
    + err
    + '<div class="grp"><label>Full name</label><input name="name" value="' + esc(o.name) + '" autofocus/></div>'
    + '<div class="grp"><label>Emp ID (your login)</label><input name="empId" value="' + esc(o.empId) + '" placeholder="e.g. rabbi.miah"/></div>'
    + '<div class="grp"><label>Password</label><input name="password" type="password" placeholder="min 4 characters"/></div>'
    + '<button class="btn" type="submit">Create account</button>'
    + '<div class="alt">Already have an account? <a href="/login">Sign in</a></div>'
    + '</form></body></html>';
}

/* ---------------- per-department collection settings (admin) ---------------- */
// Stored ON the department document — never in the shared browser overlay blobs, whose
// last-writer-wins saves lost data:
//   departments.collection = { startMonth, notMeasured: { [indicatorId]: { reason, by, at } }, updatedAt, updatedBy }
//   startMonth  — the department began reporting this month; earlier months are never "missing".
//   notMeasured — quality indicators this department does not measure: never "missing", and a
//                 collector cannot submit them. Only an administrator changes either (PUT route).
const SAFE_FIELD_KEY = /^[A-Za-z0-9_\-:@+~]+$/;   // becomes a Mongo field path: no '.' or '$'
async function getCollectionSettings() {
  const c = await col('departments'); if (!c) return [];
  const deps = await c.find({}, { projection: { id: 1, name: 1, qualityKey: 1, 'quality.key': 1, qualityOnly: 1, collection: 1 } }).toArray();
  return deps.map((d) => ({ id: d._id, name: d.name || d._id, qualityKey: (d.quality && d.quality.key) || d.qualityKey || null, qualityOnly: !!d.qualityOnly, collection: d.collection || {} }));
}
async function saveCollectionSettings(deptId, body, by) {
  const c = await col('departments'); if (!c) throw new Error('Database not available.');
  const b = body || {}; const now = Date.now();
  const $set = { 'collection.updatedAt': now, 'collection.updatedBy': by || 'admin' }, $unset = {};
  if (Object.prototype.hasOwnProperty.call(b, 'startMonth')) {
    const m = b.startMonth == null ? '' : String(b.startMonth).trim();
    if (m) { validateReportingMonth(m); $set['collection.startMonth'] = m; } else $unset['collection.startMonth'] = '';
  }
  if (b.notMeasured != null) {
    if (typeof b.notMeasured !== 'object' || Array.isArray(b.notMeasured)) throw new Error('notMeasured must map an indicator id to { reason } or null.');
    Object.keys(b.notMeasured).forEach((id) => {
      if (!SAFE_FIELD_KEY.test(id)) throw new Error('Invalid indicator id: ' + id);
      const v = b.notMeasured[id];
      if (v === null || v === false) { $unset['collection.notMeasured.' + id] = ''; return; }
      const reason = String((v && v.reason) || '').trim().slice(0, 300);
      if (!reason) throw new Error('Give a reason for marking an indicator as not measured.');
      $set['collection.notMeasured.' + id] = { reason, by: by || 'admin', at: now };
    });
  }
  const update = { $set };
  if (Object.keys($unset).length) update.$unset = $unset;
  const r = await c.updateOne({ _id: String(deptId) }, update);
  if (!r.matchedCount) { const e = new Error('Department not found.'); e.status = 404; throw e; }
  const d = await c.findOne({ _id: String(deptId) }, { projection: { collection: 1 } });
  return (d && d.collection) || {};
}
// A collector may not report a month before the department's start, or an indicator the
// administrator marked not measured for that department. (Admins can still backfill.)
async function refuseOutsideCollection(spec) {
  const c = await col('departments'); if (!c) return;
  const d = spec.type === 'patient' ? await c.findOne({ _id: String(spec.department) }) : await c.findOne({ 'quality.key': String(spec.area) });
  const set = (d && d.collection) || {};
  if (set.startMonth && monthRank(spec.month) < monthRank(set.startMonth)) {
    const e = new Error((d.name || 'This department') + ' reports data from ' + set.startMonth + ' — ' + spec.month + ' is before that.'); e.status = 400; throw e;
  }
  if (spec.type === 'quality' && set.notMeasured && set.notMeasured[spec.indicatorId]) {
    const e = new Error('"' + (spec.indicatorName || spec.indicatorId) + '" is marked not measured for this department by an administrator.'); e.status = 403; throw e;
  }
}

/* ---------------- quality departments / areas (admin CRUD) ---------------- */
async function getQualityAreas() {
  const docs = await qAllAreas();
  return docs.map((d) => ({ key: d.key, name: d.name || d.key, indicatorCount: Array.isArray(d.indicators) ? d.indicators.length : 0 }));
}
async function createQualityArea(input) {
  const name = String((input && input.name) || '').trim();
  if (!name) throw new Error('Department / area name is required.');
  const created = await qCreateArea(name);
  return { ok: true, area: { key: created.key, name: created.name, indicatorCount: 0 } };
}
async function renameQualityArea(key, input) {
  const name = String((input && input.name) || '').trim();
  if (!name) throw new Error('Name is required.');
  const r = await qSetArea(key, { name });
  if (!r.matchedCount) throw new Error('Department not found.');
  return { ok: true };
}
async function deleteQualityArea(key) {
  const r = await qDeleteArea(key);
  if (!r.deletedCount) throw new Error('Department not found.');
  return { ok: true };
}

/* ---------------- route registration ---------------- */
function mount(app, opts) {
  const guard = (opts && opts.requireApi) || function (req, res, next) { next(); };
  const who = (req) => (req.user && (req.user.name || req.user.sub)) || 'local';
  // approve/reject require an Administrator when login is on; open local mode allows it.
  // Prefer the RESOLVED authority (req.access, read from the live user document by
  // server/access.js) over req.user.role, which is only a claim inside the token — a
  // snapshot of who the caller was when they signed in, not who they are now.
  const adminOnly = (req, res, next) => {
    if (req.access) {
      if (req.access.unrestricted) return next();
      return res.status(403).json({ ok: false, error: 'Administrator access required.' });
    }
    if (req.user && req.user.role && req.user.role !== 'Administrator') return res.status(403).json({ ok: false, error: 'Administrator access required.' });
    next();
  };
  // Same authority as adminOnly: the RESOLVED live account (req.access), not the role claim
  // frozen into the token — a demoted admin's old token must not keep "edit anything".
  const isAdminReq = (req) => (req.access ? !!req.access.unrestricted : !(req.user && req.user.role && req.user.role !== 'Administrator'));
  // ONE ownership rule for acting on "my own" submission (edit / withdraw / resend). The login
  // stamped at submit (submittedByUser) wins — two staff can share a display name. The name /
  // responsible match is only for legacy rows sent before that field existed.
  const ownsSubmission = async (req, s) => {
    if (!req.user || !s) return false;
    const me = String(req.user.sub || '').toLowerCase();
    if (s.submittedByUser) return !!me && String(s.submittedByUser).toLowerCase() === me;
    const scope = await getUserScope(req.user.sub);
    const mine = [req.user.name, req.user.sub, scope && scope.name].filter(Boolean);
    return mine.includes(s.submittedBy) || !!(s.responsible && mine.includes(s.responsible.name));
  };
  const sendErr = (res, e, fallback) => res.status(e.status || fallback || 400).json({ ok: false, error: String(e.message || e), code: e.code, prior: e.prior, pendingId: e.pendingId });
  /* Is this caller held to its own departments / areas / indicators? Every legacy portal
     account is, and so is a normal account holding Data Submission without Data Collection
     (access.dataScoped). Judged on the RESOLVED live account (req.access, set by
     requireModule), falling back to the token's role claim only where no resolution ran. */
  const scopedReq = (req) => (req.access
    ? accessRoles.dataScoped(req.access)
    : !!(req.user && accessRoles.PORTAL_ROLES.indexOf(req.user.role) >= 0));
  const filterSubmissionsForUser = async (req, subs) => {
    // EVERY scoped submitter, not just 'collector'. When this named one role, adding a
    // second (incharge) silently handed that account the whole hospital's submissions.
    if (!req.user || !scopedReq(req)) return subs;
    const scope = await getUserScope(req.user.sub);
    const names = [req.user.name, req.user.sub, scope && scope.name].filter(Boolean);
    // Patient statistics: the ASSIGNED departments only — quality areas (even hospital-wide)
    // give quality data, never a department's statistics (web.js effectiveDeptIds).
    const depts = (scope && scope.departments) || [];
    const areas = (scope && scope.qualityAreas) || [];
    const me = String(req.user.sub || '').toLowerCase();
    // Rows stamped with the account (submittedByUser) match on THAT only; the name fallback is
    // for older rows, so a namesake's submissions are not shown as this person's.
    return (subs || []).filter((s) => (s.submittedByUser ? String(s.submittedByUser).toLowerCase() === me : (names.includes(s.submittedBy) || (s.responsible && names.includes(s.responsible.name))))
      || (s.type === 'patient' && depts.includes(s.department))
      || (s.type === 'quality' && ((scope && scope.allQualityAreas) || areas.includes(s.area))));
  };
  const statsFromSubmissions = (subs) => {
    const arr = subs || [];
    const by = (f) => arr.filter(f).length;
    return {
      total: arr.length,
      pending: by((s) => s.status === 'pending'),
      approved: by((s) => s.status === 'approved'),
      rejected: by((s) => s.status === 'rejected'),
      withdrawn: by((s) => s.status === 'withdrawn'),
      patient: by((s) => s.type === 'patient'),
      quality: by((s) => s.type === 'quality'),
      lastSubmittedAt: arr[0] ? arr[0].submittedAt : null,
    };
  };
  // Collectors may only submit for departments/quality areas they are assigned to. Admins
  // and open local mode (no req.user) are unrestricted. Returns an error string, or null.
  const denyIfOutOfScope = async (req, kind, target) => {
    // scopedReq = reads are narrowed; submitScoped = sends are (also a Data Collection VIEWER who submits).
    if (!req.user || !(scopedReq(req) || (req.access && accessRoles.submitScoped && accessRoles.submitScoped(req.access)))) return null;
    const scope = await getUserScope(req.user.sub);
    const what = kind === 'patient' ? 'department' : 'quality area';
    if (!target) return 'A ' + what + ' is required.';
    // Patient statistics: the assigned departments only; quality: the assigned areas.
    const allowed = kind === 'patient' ? ((scope && scope.departments) || []) : ((scope && scope.qualityAreas) || []);
    if (!allowed.includes(target)) return 'You are not assigned to that ' + what + '.';
    return null;
  };

  app.get('/api/responsibles', session.requireApi, accessRoles.attach, async (req, res) => {
    try {
      const a = req.access;
      if (!a) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
      const list = await getResponsibles();
      // Reviewers (Data Collection) and Access Control editors need the whole matrix.
      if (a.unrestricted || accessRoles.can(a, 'datacol', 'view') || accessRoles.can(a, 'users', 'edit')) return res.json({ ok: true, responsibles: list });
      // A submitter (or legacy portal login) sees its OWN record only — never colleagues'
      // phone numbers and assignments.
      if (accessRoles.submitsData(a)) {
        const scope = await getUserScope(req.user.sub);
        const me = String(req.user.sub || '').toLowerCase();
        const mine = (list || []).filter((r) => (scope && scope.responsibleId && String(r.id) === String(scope.responsibleId)) || (r.empId && String(r.empId).toLowerCase() === me));
        return res.json({ ok: true, responsibles: mine, own: true });
      }
      res.status(403).json({ ok: false, error: 'You do not have access to this.' });
    } catch (e) { res.status(500).json({ ok: false, error: String(e.message || e) }); }
  });
  app.post('/api/responsibles', guard, adminOnly, async (req, res) => {
    try { res.json({ ok: true, responsible: await saveResponsible(req.body || {}) }); } catch (e) { res.status(400).json({ ok: false, error: String(e.message || e) }); }
  });
  app.delete('/api/responsibles/:id', guard, adminOnly, async (req, res) => {
    try { await deleteResponsible(req.params.id); res.json({ ok: true }); } catch (e) { res.status(400).json({ ok: false, error: String(e.message || e) }); }
  });

  const isPortalReq = (req) => !!req.user && scopedReq(req);
  // A portal account reports as ITSELF. The client locked the responsible person for 'collector'
  // only, so an in-charge could file a report under anyone's name — the server now stamps the
  // signed-in person whatever the body says. Admins may still name any responsible person.
  const portalResponsible = async (req) => {
    if (!isPortalReq(req)) return null;
    const scope = await getUserScope(req.user.sub);
    return { id: (scope && scope.responsibleId) || null, name: (scope && scope.name) || req.user.name || req.user.sub, title: '' };
  };
  const everySubmission = async (status) => {
    const all = []; let page, offset = 0;
    do { page = await getSubmissions({ status, limit: 1000, offset }); all.push(...page); offset += page.length; } while (page.length === 1000);
    return all;
  };
  app.get('/api/submissions', guard, async (req, res) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 1000);
      const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
      let subs, nextOffset;
      if (isPortalReq(req)) {
        // Collectors only see submissions they made or that touch their assignments — and the
        // scope filter must run BEFORE the page is cut. Paging the hospital-wide list first
        // meant a phone asking for "the newest 300" got the newest 300 of EVERYONE's, so a
        // collector's own July rows fell off the page and showed as "Not submitted".
        const scoped = await filterSubmissionsForUser(req, await everySubmission(req.query.status));
        subs = scoped.slice(offset, offset + limit);
        nextOffset = offset + limit < scoped.length ? offset + limit : null;
      } else {
        subs = await getSubmissions(req.query);
        nextOffset = subs.length === limit ? offset + limit : null;
      }
      res.set('Cache-Control', 'no-store');
      res.json({ ok: true, submissions: subs, nextOffset });
    } catch (e) { res.status(500).json({ ok: false, error: String(e.message || e) }); }
  });
  app.get('/api/submissions/stats', guard, async (req, res) => {
    try {
      if (isPortalReq(req)) {
        let all = [], page, offset = 0;
        do { page = await getSubmissions({ limit: 1000, offset }); all.push(...page); offset += page.length; } while (page.length === 1000);
        const subs = await filterSubmissionsForUser(req, all);
        return res.json({ ok: true, stats: statsFromSubmissions(subs) });
      }
      res.json({ ok: true, stats: await getStats() });
    } catch (e) { res.status(500).json({ ok: false, error: String(e.message || e) }); }
  });
  app.post('/api/submissions/patient', guard, async (req, res) => {
    try {
      if (req.access && !accessRoles.maySubmitKind(req.access, 'patient')) return res.status(403).json({ ok: false, error: 'Your account is not set up to submit patient statistics.' });
      const deny = await denyIfOutOfScope(req, 'patient', String((req.body && req.body.department) || '').trim());
      if (deny) return res.status(403).json({ ok: false, error: deny });
      const meta ={ submittedBy: who(req), submittedByUser: (req.user && req.user.sub) || null, source: 'app', enforceCollection: isPortalReq(req) };
      const own = await portalResponsible(req); if (own) meta.responsible = own;
      res.json(await submitPatient(req.body || {}, meta));
    } catch (e) { sendErr(res, e); }
  });
  app.post('/api/submissions/quality', guard, async (req, res) => {
    try {
      if (req.access && !accessRoles.maySubmitKind(req.access, 'quality')) return res.status(403).json({ ok: false, error: 'Your account is not set up to submit quality indicator data.' });
      const deny = await denyIfOutOfScope(req, 'quality', String((req.body && req.body.area) || '').trim());
      if (deny) return res.status(403).json({ ok: false, error: deny });
      // Area access alone isn't the whole scope: a collector limited to specific indicators
      // (qualityIndicators[area] non-empty) may report only those. Empty/absent = all.
      let indicatorAllowed = null;
      if (isPortalReq(req)) {
        const scope = await getUserScope(req.user.sub);
        const qi = (scope && scope.qualityIndicators) || {};
        indicatorAllowed = (area, id) => !(Array.isArray(qi[area]) && qi[area].length) || qi[area].map(String).includes(String(id));
      }
      // Admin-owned denominators stay locked for a submitter unless an admin allowed THIS person (enterDen).
      const lockDen = isPortalReq(req) && !(((await getUserScope(req.user.sub)) || {}).enterDen);
      const meta = { submittedBy: who(req), submittedByUser: (req.user && req.user.sub) || null, source: 'app', enforceCollection: isPortalReq(req), lockAdminDen: lockDen };
      const own = await portalResponsible(req); if (own) meta.responsible = own;
      res.json(await submitQuality(req.body || {}, meta, indicatorAllowed));
    } catch (e) { sendErr(res, e); }
  });
  // Admin: manage quality departments / areas (create / rename / delete).
  // Per-department collection settings: start month + not-measured quality indicators.
  app.get('/api/collection-settings', guard, async (req, res) => {
    try { res.set('Cache-Control', 'no-store').json({ ok: true, departments: await getCollectionSettings() }); }
    catch (e) { res.status(500).json({ ok: false, error: String(e.message || e) }); }
  });
  app.put('/api/departments/:id/collection-settings', guard, adminOnly, async (req, res) => {
    try { res.json({ ok: true, collection: await saveCollectionSettings(req.params.id, req.body || {}, who(req)) }); }
    catch (e) { res.status(e.status || 400).json({ ok: false, error: String(e.message || e) }); }
  });
  app.get('/api/quality/areas', guard, async (req, res) => {
    try { res.json({ ok: true, areas: await getQualityAreas() }); } catch (e) { res.status(400).json({ ok: false, error: String(e.message || e) }); }
  });
  app.post('/api/quality/areas', guard, adminOnly, async (req, res) => {
    try { res.json(await createQualityArea(req.body || {})); } catch (e) { res.status(400).json({ ok: false, error: String(e.message || e) }); }
  });
  app.patch('/api/quality/areas/:key', guard, adminOnly, async (req, res) => {
    try { res.json(await renameQualityArea(req.params.key, req.body || {})); } catch (e) { res.status(400).json({ ok: false, error: String(e.message || e) }); }
  });
  app.delete('/api/quality/areas/:key', guard, adminOnly, async (req, res) => {
    try { res.json(await deleteQualityArea(req.params.key)); } catch (e) { res.status(400).json({ ok: false, error: String(e.message || e) }); }
  });
  // Admin: manage custom fields on a department's data-collection form.
  app.post('/api/departments/:id/fields', guard, adminOnly, async (req, res) => {
    try { res.json(await addDepartmentField(req.params.id, req.body || {})); } catch (e) { res.status(400).json({ ok: false, error: String(e.message || e) }); }
  });
  app.delete('/api/departments/:id/fields/:fieldId', guard, adminOnly, async (req, res) => {
    try { res.json(await removeDepartmentField(req.params.id, req.params.fieldId)); } catch (e) { res.status(400).json({ ok: false, error: String(e.message || e) }); }
  });
  // Field requests: a unit asks for a custom field (own departments only); an administrator decides.
  app.post('/api/departments/:id/field-requests', guard, async (req, res) => {
    try {
      const deny = await denyIfOutOfScope(req, 'patient', String(req.params.id || '').trim());
      if (deny) return res.status(403).json({ ok: false, error: deny });
      const request = await createFieldRequest(req.params.id, req.body, { name: who(req), user: (req.user && req.user.sub) || null });
      activity.log(req, 'field_requested', { target: request.deptName + ' · ' + request.label + (request.pct ? ' (%)' : ''), detail: request.reason });
      res.json({ ok: true, request });
    } catch (e) { sendErr(res, e); }
  });
  app.get('/api/field-requests', guard, async (req, res) => {
    try {
      const q = { status: req.query && req.query.status };
      if (!isAdminReq(req)) q.user = (req.user && req.user.sub) || ' ';   // everyone else: their own only
      res.set('Cache-Control', 'no-store');
      res.json({ ok: true, requests: await listFieldRequests(q) });
    } catch (e) { res.status(500).json({ ok: false, error: String(e.message || e) }); }
  });
  app.post('/api/field-requests/:id/decide', guard, adminOnly, async (req, res) => {
    try {
      const out = await decideFieldRequest(req.params.id, req.body, who(req));
      const r = out.request;
      activity.log(req, r.status === 'approved' ? 'field_request_approved' : 'field_request_rejected', {
        target: r.deptName + ' · ' + r.label + (r.pct ? ' (%)' : ''),
        detail: (r.status === 'approved' ? (out.linked ? 'linked to existing field ' : 'added field ') + r.fieldId : 'declined') + ' · requested by ' + r.requestedBy + (r.decisionReason ? ' · ' + r.decisionReason : ''),
      });
      res.json(out);
    } catch (e) { res.status(e.status || 400).json({ ok: false, error: String(e.message || e), code: e.code, currentStatus: e.currentStatus }); }
  });

  app.post('/api/submissions/:id/approve', guard, adminOnly, async (req, res) => {
    try { res.json(await approveSubmission(req.params.id, who(req))); } catch (e) { res.status(400).json({ ok: false, error: String(e.message || e), superseded: !!e.superseded || undefined }); }
  });
  app.post('/api/submissions/:id/reject', guard, adminOnly, async (req, res) => {
    try { res.json(await rejectSubmission(req.params.id, who(req), req.body && req.body.reason)); } catch (e) { sendErr(res, e); }
  });
  // Owner (or admin) withdraws a still-PENDING submission: a soft status, never a delete.
  app.post('/api/submissions/:id/withdraw', guard, async (req, res) => {
    try {
      const s = await getSubmissionById(req.params.id);
      if (!s) return res.status(404).json({ ok: false, error: 'Submission not found.' });
      if (!isAdminReq(req) && !(await ownsSubmission(req, s))) return res.status(403).json({ ok: false, error: 'You can only withdraw your own submissions.' });
      res.json(await withdrawSubmission(req.params.id, who(req)));
    } catch (e) { sendErr(res, e); }
  });
  // Admin: correct a PENDING submission's values/note before approving it.
  app.patch('/api/submissions/:id', guard, async (req, res) => {
    try {
      const s = await getSubmissionById(req.params.id);
      if (!s) return res.status(404).json({ ok: false, error: 'Submission not found.' });
      // Admins edit anything AT ANY TIME (incl. approved — the change re-applies to live data
      // below); a collector may edit only their OWN still-pending submission (values only, no
      // re-assign to a different department/area/month) — or fix and RESEND their own returned one.
      const isAdmin = isAdminReq(req);
      if (s.status === 'approving') return res.status(409).json({ ok: false, error: 'This submission is being approved right now — refresh and try again.' });
      if (s.status === 'withdrawn' && !isAdmin) return res.status(400).json({ ok: false, error: 'This submission was withdrawn — send a new one instead.' });
      // The collector's own REJECTED row is fixed and sent back as the SAME record (history kept).
      const resend = !isAdmin && s.status === 'rejected';
      if (s.status !== 'pending' && !resend && !isAdmin) return res.status(400).json({ ok: false, error: 'Only pending submissions can be edited.' });
      if (resend && s.autoRejected) return res.status(400).json({ ok: false, error: 'This copy was superseded by another approved submission — submit a new one or request an edit instead.' });
      // Compare against the record, not mere presence: the editor always sends the (unchanged)
      // month, so a presence check refused EVERY save on an approved submission.
      const moved = (k) => req.body && req.body[k] != null && req.body[k] !== '' && String(req.body[k]).trim() !== String(s[k] == null ? '' : s[k]);
      if (isAdmin && s.status === 'approved' && (moved('month') || moved('department') || moved('area'))) {
        return res.status(400).json({ ok: false, error: 'Approved submissions can only have their values/details edited. Create a new correction to change department, area, or month.' });
      }
      if (!isAdmin && !(await ownsSubmission(req, s))) return res.status(403).json({ ok: false, error: 'You can only edit your own submissions.' });
      if (resend) {
        if (isPortalReq(req)) await refuseOutsideCollection(s);
        await refuseIfPending(s, s.id);
      }
      const b = req.body || {};
      const patch = { editedBy: who(req), editedAt: Date.now() };
      if (b.note != null) patch.note = String(b.note);
      if (isAdmin && b.month) { validateReportingMonth(String(b.month).trim()); patch.month = String(b.month).trim(); }
      if (s.type === 'patient') {
        if (b.values && typeof b.values === 'object') {
          const out = {};
          Object.keys(b.values).forEach((k) => { const v = b.values[k]; if (v !== '' && v != null) out[k] = numericReading(v, k); });
          if (!Object.keys(out).length) throw new Error('Enter at least one statistic (use 0 for a measured zero).');
          patch.values = out;
        }
        // Re-assign to a different department (admin only).
        if (isAdmin && b.department) { patch.department = String(b.department).trim(); if (b.departmentName) patch.departmentName = String(b.departmentName).trim(); }
      } else if (s.type === 'quality') {
        // Same rule as the submit route: a portal account's edit cannot set an admin-owned denominator.
        if (isPortalReq(req) && (b.den != null || b.groupsDen != null) && !(((await getUserScope(req.user.sub)) || {}).enterDen) && (await denIsAdminOnly(s))) { delete b.den; delete b.groupsDen; }
        ['value', 'num', 'den'].forEach((key) => { if (b[key] != null && b[key] !== '') numericReading(b[key], key); });
        if (b.value != null && b.value !== '' && !isNaN(Number(b.value))) patch.value = Number(b.value);
        if (b.num != null && b.num !== '' && !isNaN(Number(b.num))) patch.num = Number(b.num);   // rate numerator
        if (b.den != null && b.den !== '' && !isNaN(Number(b.den))) patch.den = Number(b.den);   // rate denominator
        // Rate submissions: the stored value must follow the numerator/denominator. Keeping the
        // OLD value after a num/den edit made applyQuality back-solve the numerator from it at
        // approve, silently reverting the correction. The server computes it; a client value is
        // honoured only as a value-only correction (num/den unchanged, real denominator).
        const rateSub = s.entryMode === 'rate' || ['pct', 'rate100', 'rate1000', 'avg'].includes(s.formula);
        const effNum = patch.num != null ? patch.num : s.num;
        if (rateSub && effNum != null && effNum !== '' && (patch.num != null || patch.den != null || patch.value != null)) {
          const effDen = Number(patch.den != null ? patch.den : s.den) || 0;
          const mlt = Number(s.mult) || 100;
          const computed = effDen > 0 ? Math.round((Number(effNum) / effDen) * mlt * 100) / 100 : (Number(effNum) > 0 ? null : 0);
          const numDenChanged = (patch.num != null && patch.num !== Number(s.num)) || (patch.den != null && patch.den !== Number(s.den));
          if (!(effDen > 0) || numDenChanged || patch.value == null) patch.value = computed;
        }
        // Typing a real value onto a "Not observed" submission converts it back to a
        // normal reading — otherwise the flag would discard the edited value at apply.
        if (s.notObserved && (patch.value != null || patch.num != null)) patch.notObserved = false;
        // Full breakdown edits: department × staff-group matrix, and/or staff-group totals.
        if (Array.isArray(b.deptBreakdown)) { const bd = sanitizeDeptBreakdown(b.deptBreakdown); if (bd) patch.deptBreakdown = bd; }
        if (b.groups) { const g = sanitizeGroupMap(b.groups); if (g) patch.groups = g; }
        if (b.groupsDen) { const gd = sanitizeGroupMap(b.groupsDen); if (gd) patch.groupsDen = gd; }
        if (b.remark != null) patch.remark = String(b.remark);
        // Re-assign to a different quality area (admin only).
        if (isAdmin && b.area) { patch.area = String(b.area).trim(); if (b.areaName) patch.areaName = String(b.areaName).trim(); }
        // Edit the incident/patient/CAPA details attached to this quality submission.
        if (Array.isArray(b.incidents)) {
          const IF = ['uhid', 'patientName', 'age', 'gender', 'diagnosis', 'incidentDate', 'admissionDate', 'procedureDate', 'victimName', 'victimId', 'department', 'details', 'finding', 'corrective', 'preventive', 'remark'];
          patch.incidents = b.incidents.map((x) => { const o = {}; IF.forEach((k) => { if (x && x[k] != null && x[k] !== '') o[k] = String(x[k]); }); return o; }).filter((o) => Object.keys(o).length);
        }
      }
      let updated;
      if (resend) {
        const now = patch.editedAt;
        // Data may have gone ON RECORD for this target + month after the row was returned (another
        // report approved, a console edit). Reopening it as a plain report let its approval overwrite
        // that data blind — so, like the forms, it reopens as an EDIT REQUEST with a reason and the
        // server's snapshot of what it would replace. No reason yet -> 409 'exists' with the prior.
        if (!s.isCorrection) {
          const spec = Object.assign({}, s, patch);
          const prior = await onRecordPrior(spec);
          if (prior) {
            const why = String(b.correctionReason == null ? '' : b.correctionReason).trim();
            if (!why) refuseExists(spec, prior);
            Object.assign(patch, { isCorrection: true, correctionReason: why, priorValues: prior });
          }
        }
        Object.assign(patch, { status: 'pending', resubmittedAt: now, lastRejectReason: s.rejectReason || '', rejectReason: '', reviewedBy: null, reviewedAt: null });
        updated = await updateSubmissionIf(req.params.id, 'rejected', patch, { history: { status: 'rejected', rejectReason: s.rejectReason || '', reviewedBy: s.reviewedBy || null, reviewedAt: s.reviewedAt || null, at: now } });
        if (!updated) return res.status(409).json({ ok: false, error: 'This submission changed while you were fixing it — refresh and try again.' });
        return res.json({ ok: true, submission: updated, resent: true });
      }
      // A collector's pending edit is conditional too: it must not land on a row an admin just
      // approved, rejected or the collector withdrew in another tab.
      if (!isAdmin) {
        updated = await updateSubmissionIf(req.params.id, 'pending', patch);
        if (!updated) { const cur = await getSubmissionById(req.params.id); return res.status(409).json({ ok: false, error: (NOT_PENDING_MSG[cur && cur.status] || 'This submission is no longer pending.') + ' Your edit was not saved.' }); }
      } else updated = await setSubmissionStatus(req.params.id, patch);
      // An APPROVED submission was already written to the canonical (live) collections at approve
      // time; an admin editing it later must RE-APPLY so the dashboard reflects the correction.
      if (updated && updated.status === 'approved') {
        try {
          // Figures the admin cleared on this already-live sheet come off the live row too.
          const removeKeys = (s.status === 'approved' && patch.values) ? Object.keys(s.values || {}).filter((k) => !Object.prototype.hasOwnProperty.call(patch.values, k)) : [];
          if (updated.type === 'patient') await applyPatient(Object.assign({}, updated, { removeKeys }));
          else if (updated.type === 'quality') await applyQuality(updated);
        } catch (e) { return res.status(400).json({ ok: false, error: 'Saved, but re-applying to live data failed: ' + String(e.message || e) }); }
      }
      res.json({ ok: true, submission: updated });
    } catch (e) { sendErr(res, e); }
  });

  // Shareable short links — management (admin) ...
  app.get('/api/shortlinks', guard, async (req, res) => {
    if (req.user && req.user.role && req.user.role !== 'Administrator') return res.status(403).json({ ok: false, error: 'Administrator access required.' });
    try { res.json({ ok: true, links: await getShortlinks() }); } catch (e) { res.status(500).json({ ok: false, error: String(e.message || e) }); }
  });
  app.post('/api/shortlinks', guard, async (req, res) => {
    if (req.user && req.user.role && req.user.role !== 'Administrator') return res.status(403).json({ ok: false, error: 'Administrator access required.' });
    try { res.json({ ok: true, link: await createShortlink(req.body || {}, who(req)) }); } catch (e) { res.status(400).json({ ok: false, error: String(e.message || e) }); }
  });
  app.delete('/api/shortlinks/:code', guard, async (req, res) => {
    if (req.user && req.user.role && req.user.role !== 'Administrator') return res.status(403).json({ ok: false, error: 'Administrator access required.' });
    try { await deleteShortlink(req.params.code); res.json({ ok: true }); } catch (e) { res.status(400).json({ ok: false, error: String(e.message || e) }); }
  });

  // ... and the PUBLIC landing + submit (no login: the code is the capability,
  // it only ever exposes/accepts that one scoped form, and submissions are pending).
  app.get('/s/:code', async (req, res) => {
    try { const link = await getShortlink(req.params.code); if (link) bumpHit(req.params.code).catch(() => {}); }
    catch (e) { /* ignore hit-count errors */ }
    res.set('Cache-Control', 'no-store').type('html').send(shortlinkPage(req.params.code));
  });
  app.get('/s/:code/meta', async (req, res) => {
    try { const m = await shortlinkMeta(req.params.code); if (!m) return res.status(404).json({ ok: false, error: 'Invalid or expired link.' }); res.json(m); }
    catch (e) { res.status(500).json({ ok: false, error: String(e.message || e) }); }
  });
  app.post('/s/:code/submit', async (req, res) => {
    // sendErr: the 409s carry code / prior / pendingId so the public page can react like the app.
    try { res.json(await shortlinkSubmit(req.params.code, req.body || {})); } catch (e) { sendErr(res, e); }
  });

  // Public self sign-up for data collectors. DISABLED by default — collector
  // accounts are admin-controlled (created in Responsible Persons / User
  // Management). Set ALLOW_SIGNUP=true in server/.env to re-enable self-registration.
  const signupAllowed = () => String(process.env.ALLOW_SIGNUP || '').toLowerCase() === 'true';
  app.get('/signup', (req, res) => {
    if (!session.authRequired()) return res.redirect(302, '/');
    if (!signupAllowed()) return res.redirect(302, '/login'); // self sign-up disabled
    if (session.userFromReq(req)) return res.redirect(302, '/collect');
    res.set('Cache-Control', 'no-store').type('html').send(signupPage({}));
  });
  app.post('/signup', async (req, res) => {
    if (!session.authRequired()) return res.redirect(302, '/');
    if (!signupAllowed()) return res.status(403).type('html').send(signupPage({ error: 'Self sign-up is disabled. Ask an administrator to create your account.' }));
    try {
      const r = await registerCollector({ name: req.body && req.body.name, empId: req.body && req.body.empId, password: req.body && req.body.password });
      // Signed from the STORED account, so the token carries its role and sessionEpoch.
      const fresh = await (await getUsers()).findOne({ username: r.username });
      session.setSession(res, auth.sign(fresh || { username: r.username, role: 'User', name: (req.body && req.body.name) || r.username }));
      res.redirect(302, '/collect');
    } catch (e) {
      res.status(400).type('html').send(signupPage({ error: String(e.message || e), name: req.body && req.body.name, empId: req.body && req.body.empId }));
    }
  });
}

module.exports = {
  mount, getResponsibles, saveResponsible, getSubmissions, getStats,
  submitPatient, submitQuality, approveSubmission, rejectSubmission, withdrawSubmission,
  buildPatientSpec, buildQualitySpec, createSubmission,
  createShortlink, getShortlinks, deleteShortlink, shortlinkMeta, shortlinkSubmit,
  registerCollector, upsertCollectorUser, getUserScope, recomputeQuarters,
  deriveAssignment, planResponsibleSync, applyResponsibleSync, deactivateResponsibleFor,
  scopeIsNonEmpty, NO_DATA_ROLES, NURSE_PCA_SCOPE_ERROR,
  addDepartmentField, removeDepartmentField, getCollectionSettings, saveCollectionSettings,
  createFieldRequest, listFieldRequests, decideFieldRequest,
  // exported so a repair script can re-apply an approval through the SAME code path
  applyQuality,
};
