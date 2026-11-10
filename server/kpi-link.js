/* Nursing KPI — the figures the system already holds, month by month, for a KPI linked to a
 * quality indicator (kpiDefs.source.indId). Nobody re-types a number the hospital already has:
 *
 *   hh        Hand hygiene — the Infection Control audit on Overall Hospital, pooled by the one
 *             hand-hygiene rule (renderer/unico/hh-pool.js), each observation counted once.
 *   pool      A clinical indicator reported by the units (HAPU, VAP, CAUTI, CLABSI, SSI): the
 *             hospital figure is Σ numerators ÷ Σ denominators over every unit that reported the
 *             month — never a mean of the units' rates. The device-day denominators are already in
 *             the indicator's mDen (copied from Device Days when the quality form is sent).
 *   fall      As pool, without the Out-Patient "fall" that shares the id (an OPD visit is not a
 *             patient-day).
 *   hospital  An indicator reported once, on Overall Hospital (NSI, the nursing-service KPIs).
 *             An administrator-only denominator (the NSI headcount) carries forward from the last
 *             month that has one, as the quality forms do.
 *
 * Readings are the quality console's: the database, with the unico_quality_v2 overlay on top
 * (newest wins, my-department.js mergeLayers) and the master formula catalogue applied.
 * A month with events but no denominator is reported as 'partial' — never as a rate of 0.
 */
const { getQuality } = require('./db');
const deptmap = require('./deptmap');
const qf = require('./quality-formulas');
const md = require('./my-department');
const HH = require('../renderer/unico/hh-pool.js');
const K = require('../renderer/unico/kpi-core.js');

const HH_MAPS = md.Q_MAPS.concat(['mDeptBreakdown', 'mFromAudit', 'mCovered', 'mGroups', 'mGroupsDen']);
const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const has = K.has;
const RULES = ['hh', 'pool', 'fall', 'hospital'];
const CARRY_BACK = 24; // months an admin-only denominator may be carried forward from

/* Where each month's figure came from, for the calculation evidence (server/kpi-evidence.js):
   when it was approved (base.mApprovedAt, the database), whether a Quality-console edit won over
   it (the same "newest wins" test my-department mergeLayers applies), and who made that edit. */
const PROV_MAPS = ['mNum', 'mDen', 'months'];
function provenance(base, layers, monKeys) {
  const b = base || {};
  const appr = b.mApprovedAt || {};
  const out = { approvedAt: {}, editedAt: {}, editedBy: {}, overlay: { mNum: {}, mDen: {}, months: {} } };
  monKeys.forEach((m) => { if (has(appr[m])) out.approvedAt[m] = Number(appr[m]); });
  layers.forEach((l) => {
    const edited = l.mEditedAt || {};
    monKeys.forEach((m) => {
      PROV_MAPS.forEach((k) => {
        if (!l[k] || !Object.prototype.hasOwnProperty.call(l[k], m)) return;
        if (Number(appr[m]) > (Number(edited[m]) || 0) && b[k] && Object.prototype.hasOwnProperty.call(b[k], m)) return; // superseded by a newer approval
        out.overlay[k][m] = true;
        if (has(edited[m])) out.editedAt[m] = Number(edited[m]);
        if (l.mEditedBy && has(l.mEditedBy[m])) out.editedBy[m] = String(l.mEditedBy[m]);
      });
    });
  });
  return out;
}

function mergeInd(base, layers, monKeys, byName) {
  const L = (layers || []).filter(Boolean);
  const pick = md.mergeLayers(base, L, monKeys, HH_MAPS);
  const last = (k) => L.reduce((a, l) => (has(l[k]) ? l[k] : a), null);
  const name = last('name') || base.name || base.id;
  const cat = byName[norm(name)] || byName[norm(base.name)] || {};
  return Object.assign({
    id: base.id, name, canonicalName: cat.canonicalName || name,
    formula: last('formula') || cat.formula || base.formula || null,
    unit: last('unit') || cat.unit || base.unit || '',
    denAdminOnly: !!(last('denAdminOnly') || cat.denAdminOnly || base.denAdminOnly),
    startMonth: last('startMonth') || base.startMonth || null,
    _meta: provenance(base, L, monKeys),
  }, pick);
}

/* Everything one request needs, read once: the quality areas (DB + overlay, canonical names)
   and the formula catalogue. `yms` = the months asked for ('YYYY-MM'); the context also holds
   the CARRY_BACK months before them so a carried denominator can be found. */
async function loadContext(yms, deps) {
  const d = deps || {};
  const months = (yms || []).filter(K.isMonth).sort();
  const first = months[0] || K.thisMonth();
  const wide = K.monthsBetween(K.addMonth(first, -CARRY_BACK), K.addMonth(first, -1)).concat(months);
  const monKeys = wide.map(K.toMonKey);
  const [quality, ov, formulas, map] = await Promise.all([
    (d.getQuality || getQuality)().catch(() => []),
    (d.overlays || md.overlays)().catch(() => ({ quality: {} })),
    (d.getFormulas || qf.getFormulas)().catch(() => []),
    (d.deptmap || deptmap).get().catch(() => null),
  ]);
  const byName = qf.buildByNameMap(formulas || []);
  const qov = (ov && ov.quality && ov.quality.depts) || {};
  const areas = (quality || []).filter((q) => q && q.key).map((q) => {
    const o = qov[q.key] || {};
    const removed = new Set((o.indRemoved || []).map(String));
    const patches = o.indPatches || {};
    const added = Array.isArray(o.indAdded) ? o.indAdded : [];
    const seen = new Set();
    const inds = [];
    (q.indicators || []).forEach((i) => {
      if (!i || removed.has(String(i.id))) return;
      seen.add(String(i.id));
      inds.push(mergeInd(i, [added.find((a) => a && String(a.id) === String(i.id)), patches[i.id]], monKeys, byName));
    });
    added.forEach((a) => { if (a && !seen.has(String(a.id)) && !removed.has(String(a.id))) inds.push(mergeInd(a, [patches[a.id]], monKeys, byName)); });
    // One canonical name per area (as /api/hand-hygiene does); the audit rows were filed under
    // the area's own name, which stays as qualityName so hh-pool can still match them.
    const nm = map && q.deptId && map.byId && map.byId[q.deptId] && map.byId[q.deptId].name;
    return { key: q.key, name: nm || q.name || q.key, qualityName: nm && nm !== q.name ? q.name : undefined, deptId: q.deptId, indicators: inds };
  });
  return { areas, byName, months, wide, monKeys };
}

const isOpd = (area, ind) => norm(area.key) === 'opd' || area.deptId === 'opd' || /^out[\s-]*patient/i.test((ind && ind.name) || '');
function findInd(area, def, ctx) {
  const s = def.source || {};
  const want = s.indName && ((ctx.byName[norm(s.indName)] || {}).canonicalName || s.indName);
  return (area.indicators || []).find((i) => s.indId && String(i.id) === String(s.indId))
    || (want ? (area.indicators || []).find((i) => norm(i.canonicalName) === norm(want) || norm(i.name) === norm(want)) : null) || null;
}
const ruleOf = (def) => {
  const s = def.source || {};
  if (RULES.indexOf(s.rule) >= 0) return s.rule;
  if (s.indId === 'ind-hand-hygiene-compliance') return 'hh';
  if (s.indId === 'ind-patient-fall') return 'fall';
  if (s.indId === 'ind-needle-stick-injury') return 'hospital';
  return 'pool';
};
const formulaOf = (def, ind) => (ind && ind.formula) || def.formula || 'pct';

// The most recent denominator at or before `mk` (an administrator's headcount carries forward).
function carriedDen(ind, mk, ctx) {
  const at = ctx.monKeys.indexOf(mk);
  for (let i = at; i >= 0; i--) { const v = ind.mDen && ind.mDen[ctx.monKeys[i]]; if (has(v) && Number(v) > 0) return { den: Number(v), from: ctx.monKeys[i] }; }
  return null;
}

/* One month across the given areas. Returns {num, den, value, source, areas, incomplete} or null. */
function poolMonth(def, mk, list, ctx, opts) {
  let n = 0, d = 0, used = 0, partial = 0, f = null, carried = null;
  const vals = [];
  list.forEach(({ area, ind }) => {
    if (ind.mNotObserved && ind.mNotObserved[mk]) return;
    f = f || formulaOf(def, ind);
    const nn = ind.mNum && ind.mNum[mk], v = ind.months && ind.months[mk];
    let dd = ind.mDen && ind.mDen[mk];
    if ((!has(dd) || !(Number(dd) > 0)) && opts && opts.carry && ind.denAdminOnly) { const c = carriedDen(ind, mk, ctx); if (c) { dd = c.den; carried = c.from; } }
    if (f === 'count' || f === 'direct') {
      if (has(nn)) { n += Number(nn); used++; } else if (has(v)) { n += Number(v); used++; }
      return;
    }
    if (has(nn) && Number(dd) > 0) { n += Number(nn); d += Number(dd); used++; }
    else if (has(nn)) partial++;
    else if (has(v)) vals.push(Number(v));
  });
  if (!f) return null;
  const src = opts && opts.source;
  if (f === 'count' || f === 'direct') return used ? { num: n, den: null, value: n, source: src, areas: used } : null;
  if (d > 0) return { num: K.round(n, 4), den: K.round(d, 4), value: K.computeValue(f, n, d), source: src, areas: used, incomplete: partial > 0 || undefined, carriedFrom: carried || undefined };
  if (partial) return { num: n, den: null, value: null, source: 'partial', areas: partial };
  if (vals.length) return { num: null, den: null, value: K.round(vals.reduce((a, x) => a + x, 0) / vals.length), source: src, areas: vals.length, valueOnly: true };
  return null;
}

/* { 'YYYY-MM': {num, den, value, source, areas} } for one KPI over ctx.months. Pure. */
function linkedMonthlyFrom(ctx, def, yms) {
  const out = {};
  const s = def && def.source;
  if (!s || !s.indId) return out;
  const months = (yms || ctx.months).filter(K.isMonth);
  const rule = ruleOf(def);

  if (rule === 'hh') {
    const res = HH.build(ctx.areas, months.map(K.toMonKey));
    res.months.forEach((x, i) => {
      if (x.pct == null && !(x.d > 0)) return;
      out[months[i]] = { num: x.d > 0 ? x.n : null, den: x.d > 0 ? x.d : null, value: x.pct, source: 'hh-audit', areas: (x.coveredKeys || []).length || null };
    });
    return out;
  }

  const hospital = ctx.areas.filter((a) => HH.isHospital(a));
  const units = ctx.areas.filter((a) => !HH.isHospital(a));
  const pairs = (areas) => areas.map((area) => ({ area, ind: findInd(area, def, ctx) }))
    .filter((p) => p.ind && !(rule === 'fall' && isOpd(p.area, p.ind)));
  const hosp = pairs(hospital), unitPairs = rule === 'hospital' ? [] : pairs(units);
  months.forEach((ym) => {
    const mk = K.toMonKey(ym);
    let cell = null;
    if (rule === 'hospital') cell = poolMonth(def, mk, hosp, ctx, { carry: true, source: 'hospital' });
    else {
      cell = poolMonth(def, mk, unitPairs, ctx, { source: 'pooled' });
      // No unit reported it: a hospital-level reading (if one exists) stands in.
      if (!cell) cell = poolMonth(def, mk, hosp, ctx, { carry: true, source: 'hospital' });
    }
    if (cell) out[ym] = cell;
  });
  return out;
}

/* The system figure of one measuring period of a KPI measured every N months, at its due month:
   the period's months pooled Σnum ÷ Σden (kpi-core periodCell). `monthly` = the KPI's monthly
   system figures when already worked out. ctx must hold the period's months. */
function periodSystem(ctx, def, dueYm, cfg, monthly) {
  const pm = K.periodMonths(def, dueYm, cfg);
  if (!pm.length) return null;
  const m = monthly || linkedMonthlyFrom(ctx, def, pm);
  const p = K.periodOf(def, dueYm, cfg);
  return K.periodCell(def, pm.map((x) => m[x]), p && p.label);
}

async function linkedMonthly(def, yms, deps) {
  const ctx = await loadContext(yms, deps);
  return linkedMonthlyFrom(ctx, def, yms);
}
async function linkedMonthlyAll(defs, yms, deps) {
  const ctx = await loadContext(yms, deps);
  const out = {};
  (defs || []).forEach((d) => { out[d.id] = linkedMonthlyFrom(ctx, d, yms); });
  return out;
}

// The indicators a custom KPI may be linked to: one row per indicator id, with where it is reported.
function indicatorCatalog(ctx) {
  const by = new Map();
  ctx.areas.forEach((a) => (a.indicators || []).forEach((i) => {
    if (!i || !i.id) return;
    const k = String(i.id);
    if (!by.has(k)) by.set(k, { id: k, name: i.canonicalName || i.name, formula: i.formula || null, unit: i.unit || '', areas: [], areaKeys: [], hospital: false });
    const row = by.get(k);
    if (HH.isHospital(a)) row.hospital = true;
    else if (row.areaKeys.indexOf(a.key) < 0) { row.areas.push(a.name); row.areaKeys.push(a.key); }
  }));
  return [...by.values()].sort((x, y) => String(x.name).localeCompare(String(y.name)));
}
// Every quality area (unit), for the "Units expected" picker.
const areaList = (ctx) => ctx.areas.map((a) => ({ key: a.key, name: a.name, deptId: a.deptId || null, hospital: HH.isHospital(a) }))
  .sort((x, y) => (x.hospital - y.hospital) || String(x.name).localeCompare(String(y.name)));

module.exports = { loadContext, linkedMonthlyFrom, periodSystem, linkedMonthly, linkedMonthlyAll, indicatorCatalog, areaList, ruleOf, RULES, mergeInd, findInd, isOpd, poolMonth, carriedDen, formulaOf, norm };
