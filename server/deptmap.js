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

// DB-backed map for the API write paths.
// With the read cache ON (cache.js 'mongo' or 'redis' mode) it is built from a
// version-validated read of `departments`: a department edit made on ANY instance
// invalidates it on the very next call, and an outage is bridged by the cached copy for
// up to LAST_GOOD_MAX_MS. With the cache OFF it keeps the old short per-instance TTL —
// never invalidated across instances, so kept short: a department's quality key changed
// on one instance must not be read stale for long elsewhere (a user saved meanwhile
// would store qualityAreas derived from the old map).
let _cache = null, _ts = 0, _lastGood = null, _lastGoodTs = 0, _src = null, _forceNext = false;
const TTL = 10000;
const LAST_GOOD_MAX_MS = 10 * 60 * 1000;   // an outage stand-in, not a permanent copy
const PROJECTION = { id: 1, name: 1, qualityKey: 1, qualityOnly: 1, quality: 1 };
function build(deps) {
  const quals = deps.filter((d) => d.quality && d.quality.key).map((d) => ({ key: d.quality.key, name: d.quality.name || d.name, deptId: d.id }));
  return fromArrays(deps, quals);
}
async function get(force) {
  const now = Date.now();
  // usingMongo() is a config check, NOT a connect. Awaiting a handle here would pay
  // the full server-selection timeout before the guarded read below ever ran, which
  // is exactly the wait the circuit breaker exists to avoid.
  if (!usingMongo()) { _cache = fromArrays([], []); _ts = now; return _cache; }
  const cache = require('./cache');
  if (cache.mode && cache.mode() !== 'off') {
    const fresh = !!force || _forceNext;
    _forceNext = false;
    const deps = await cache.read('deptmap-departments',
      { coll: 'departments', fresh, staleMs: LAST_GOOD_MAX_MS },
      () => dbRead((db) => db.collection('departments').find({}, { projection: PROJECTION }).toArray()));
    // The cache hands back the same array until it reloads, so the map is rebuilt once
    // per version, not once per call.
    if (deps !== _src || !_cache) { _cache = build(deps); _src = deps; _ts = now; }
    return _cache;
  }
  if (!force && _cache && (now - _ts) < TTL) return _cache;
  // Quality lives EMBEDDED in departments (dept.quality) after the Statistics+Quality
  // merge — derive the quality-area link list from departments (single source of truth).
  // Through dbRead so the circuit breaker applies: during an outage this fails in
  // milliseconds instead of waiting out the full server-selection timeout.
  let deps;
  try {
    deps = await dbRead((db) => db.collection('departments').find({}, { projection: { id: 1, name: 1, qualityKey: 1, qualityOnly: 1, quality: 1 } }).toArray());
  } catch (e) {
    // The department list changes about once a year; the circuit breaker opens for
    // seconds. Serving the last good map keeps every department-scoped screen working
    // through a blip instead of showing an account "no departments" (which reads as a
    // permission change to the person holding the phone). A cold start still throws.
    if (_lastGood && (now - _lastGoodTs) < LAST_GOOD_MAX_MS) return _lastGood;
    throw e;
  }
  const quals = deps.filter((d) => d.quality && d.quality.key).map((d) => ({ key: d.quality.key, name: d.quality.name || d.name, deptId: d.id }));
  _cache = fromArrays(deps, quals); _ts = now; _lastGood = _cache; _lastGoodTs = now;
  return _cache;
}
function invalidate() { _cache = null; _ts = 0; _src = null; _forceNext = true; }

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
