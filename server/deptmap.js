/* UNICO — canonical department identity map.
 *
 * ONE source of truth linking a department's canonical id (er, cathlab, lvl10, ctot…)
 * to its quality-area key (Emergency, Cathlab, Level 10, CT OT…) and back. Built from
 * the `departments.qualityKey` + `quality.deptId` link fields written by the unification
 * migration. Used so a person's quality areas DERIVE from their single department list
 * (killing the old departments[]/qualityAreas[] two-array drift), and injected to the
 * client as window.__UNICO_DEPT_MAP__ so the UI can show ONE canonical name everywhere.
 */
const { getDbHandle } = require('./db');

const HOSPITAL = '__hospital__';

// Pure builder from already-fetched arrays (no DB round-trip) — used by web.js which
// already loads departments + quality for the page inject.
function fromArrays(deps, quals) {
  const byId = {}, idToQk = {}, qkToId = {}, patientDepts = [], allKeys = [];
  (deps || []).forEach((d) => {
    if (!d || !d.id) return;
    byId[d.id] = { id: d.id, name: d.name || d.id, qualityKey: d.qualityKey || null };
    patientDepts.push(d.id);
    if (d.qualityKey) { idToQk[d.id] = d.qualityKey; qkToId[d.qualityKey] = d.id; }
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
  const db = await getDbHandle();
  if (!db) { _cache = fromArrays([], []); _ts = now; return _cache; }
  const [deps, quals] = await Promise.all([
    db.collection('departments').find({}, { projection: { id: 1, name: 1, qualityKey: 1 } }).toArray(),
    db.collection('quality').find({}, { projection: { key: 1, name: 1, deptId: 1 } }).toArray(),
  ]);
  _cache = fromArrays(deps, quals); _ts = now;
  return _cache;
}
function invalidate() { _cache = null; _ts = 0; }

// Quality areas DERIVED from a canonical department-id list (+ hospital-wide flag).
// This is the single rule the whole app uses so "assign a person once" covers both the
// statistics data module and the quality module.
async function deriveQualityAreas(departmentIds, allQualityAreas) {
  const map = await get();
  if (allQualityAreas) return map.allKeys.slice();
  const out = [];
  (departmentIds || []).forEach((id) => { const qk = map.idToQk[id]; if (qk && out.indexOf(qk) < 0) out.push(qk); });
  return out;
}

module.exports = { fromArrays, get, invalidate, deriveQualityAreas, HOSPITAL };
