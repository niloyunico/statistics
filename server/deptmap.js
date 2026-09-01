/* UNICO — canonical department identity map.
 *
 * ONE source of truth linking a department's canonical id (er, cathlab, lvl10, ctot…)
 * to its quality-area key (Emergency, Cathlab, Level 10, CT OT…) and back. Built from
 * the `departments.qualityKey` + `quality.deptId` link fields written by the unification
 * migration. Used so a person's quality areas DERIVE from their single department list
 * (killing the old departments[]/qualityAreas[] two-array drift), and injected to the
 * client as window.__UNICO_DEPT_MAP__ so the UI can show ONE canonical name everywhere.
 */
const { dbRead, usingMongo } = require('./db');

const HOSPITAL = '__hospital__';

// Pure builder from already-fetched arrays (no DB round-trip) — used by web.js which
// already loads departments + quality for the page inject.
function fromArrays(deps, quals) {
  const byId = {}, idToQk = {}, qkToId = {}, patientDepts = [], allKeys = [];
  (deps || []).forEach((d) => {
    const id = d && (d.id || d._id);
    if (!id) return;
    byId[id] = { id, name: d.name || id, qualityKey: d.qualityKey || null };
    if (d.qualityOnly) byId[id].qualityOnly = true; else patientDepts.push(id);
    if (d.qualityKey) { idToQk[id] = d.qualityKey; qkToId[d.qualityKey] = id; }
  });
  (quals || []).forEach((q) => {
    if (!q) return;
    const key = q.key || q._id;
    if (key) allKeys.push(key);
    const id = q.deptId || qkToId[key];
    if (key && id) { qkToId[key] = id; if (!idToQk[id]) idToQk[id] = key; }
    if (q.deptId === HOSPITAL || key === 'Overall Hospital') {
      byId[HOSPITAL] = { id: HOSPITAL, name: q.name || 'Overall Hospital', qualityKey: key, qualityOnly: true };
    }
  });
  return { byId, idToQk, qkToId, patientDepts, allKeys: [...new Set(allKeys)] };
}

// Cached DB-backed map for the API write paths (short TTL — assignment saves are rare).
let _cache = null, _ts = 0;
const TTL = 30000;
async function get(force) {
  const now = Date.now();
  if (!force && _cache && (now - _ts) < TTL) return _cache;
  // usingMongo() is a config check, NOT a connect. Awaiting a handle here would pay
  // the full server-selection timeout before the guarded read below ever ran, which
  // is exactly the wait the circuit breaker exists to avoid.
  if (!usingMongo()) { _cache = fromArrays([], []); _ts = now; return _cache; }
  // Quality lives EMBEDDED in departments (dept.quality) after the Statistics+Quality
  // merge — derive the quality-area link list from departments (single source of truth).
  // Through dbRead so the circuit breaker applies: during an outage this fails in
  // milliseconds instead of waiting out the full server-selection timeout.
  const deps = await dbRead((db) => db.collection('departments').find({}, { projection: { id: 1, name: 1, qualityKey: 1, qualityOnly: 1, quality: 1 } }).toArray());
  const quals = deps.filter((d) => d.quality && d.quality.key).map((d) => ({ key: d.quality.key, name: d.quality.name || d.name, deptId: d.id }));
  _cache = fromArrays(deps, quals); _ts = now;
  return _cache;
}
function invalidate() { _cache = null; _ts = 0; }

// Quality areas DERIVED from a canonical department-id list (+ hospital-wide flag).
// This is the single rule the whole app uses so "assign a person once" covers both the
// statistics data module and the quality module.
// customAreas = extra quality-area keys assigned directly (custom access beyond departments).
async function deriveQualityAreas(departmentIds, allQualityAreas, customAreas) {
  const map = await get();
  if (allQualityAreas) return map.allKeys.slice();
  const out = [];
  (departmentIds || []).forEach((id) => { const qk = map.idToQk[id]; if (qk && out.indexOf(qk) < 0) out.push(qk); });
  (customAreas || []).forEach((k) => { const key = String(k); if (key && out.indexOf(key) < 0) out.push(key); });
  return out;
}

module.exports = { fromArrays, get, invalidate, deriveQualityAreas, HOSPITAL };
