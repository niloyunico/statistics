/* Nursing KPI — how each figure was calculated, and whether it can be trusted.
 *
 * For one KPI and one month this builds an EVIDENCE record: the formula, every unit (quality
 * area) the figure is made of with its numerator / denominator / value, who sent it and who
 * approved it and when (from the `submissions` collection — the indicator itself only keeps an
 * approval timestamp), whether a Quality-console edit replaced the approved figure, the Device
 * Days the denominator should match, a hand-typed override with its reason, and the DATA CHECKS.
 *
 * The screen ("Show calculation"), the report's calculation pages, the print, the PDF, the
 * PowerPoint appendix and the Excel "Calculation" sheet all render this one object. An
 * error-level check blocks Finalise until the data is fixed or the error is acknowledged with a
 * reason; each check carries a fingerprint of exactly the data it looked at, so an acknowledgement
 * lapses the moment that data changes. The check wording is renderer/unico/kpi-core.js CHECK_META.
 *
 * Nothing here writes anything. Sources are read once per request (loadSources); tests inject
 * them through `deps` (submissions, deviceRows, deviceCfg, collectionSettings).
 */
const crypto = require('crypto');
const K = require('../renderer/unico/kpi-core.js');
const HH = require('../renderer/unico/hh-pool.js');
const DD = require('../renderer/unico/device-days-core.js');
const link = require('./kpi-link');

const MATCH_MS = 2000;           // approve stamps the indicator a few ms before the submission's reviewedAt
const STALE_DEN_MONTHS = 3;      // NSI headcount older than this is flagged
const PD_TOLERANCE = 0.05;       // patient-days vs Device Days total patients
const SUB_FIELDS = { area: 1, indicatorId: 1, indicatorName: 1, month: 1, num: 1, den: 1, value: 1, status: 1, submittedBy: 1, submittedByUser: 1, submittedAt: 1, reviewedBy: 1, reviewedAt: 1, editedBy: 1, editedAt: 1, correctionFor: 1, notObserved: 1 };

const has = K.has;
const norm = link.norm;
const r4 = (v) => (has(v) && isFinite(Number(v)) ? K.round(Number(v), 4) : null);

/* ------------------------------------------------------------- fingerprint --- */
// Canonical JSON (sorted keys, numbers to 4 dp) → sha256. No timestamps or names go in, so a
// re-approval of the same figures is not a change; any figure that moves is.
function canon(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number') return r4(v);
  if (Array.isArray(v)) return v.map(canon);
  if (typeof v === 'object') { const o = {}; Object.keys(v).sort().forEach((k) => { if (v[k] !== undefined) o[k] = canon(v[k]); }); return o; }
  return v;
}
const fingerprint = (obj) => 'sha256:' + crypto.createHash('sha256').update(JSON.stringify(canon(obj))).digest('hex');
const ackKey = (kpiId, ym, code, unit) => [kpiId, ym, code, unit || ''].join('|');

/* ----------------------------------------------------------------- sources --- */
let indexed = false;
async function readSubmissions(monKeys) {
  const { getDbHandle } = require('./db');
  const db = await getDbHandle().catch(() => null);
  if (!db) return [];
  const c = db.collection('submissions');
  if (!indexed) { indexed = true; c.createIndex({ type: 1, month: 1, status: 1 }).catch(() => {}); }
  return c.find({ type: 'quality', status: { $in: ['approved', 'pending', 'approving'] }, month: { $in: monKeys } }, { projection: SUB_FIELDS }).toArray();
}

/* Everything the evidence needs beyond the quality data, read once. Attached to ctx.sources. */
async function loadSources(ctx, opts, deps) {
  const d = deps || {};
  const now = (opts && opts.now) || Date.now();
  const months = ctx.months;
  const monKeys = months.map(K.toMonKey);
  const dev = () => require('./device-days');
  const [subs, ddCfg, settings, daDepts] = await Promise.all([
    (d.submissions ? d.submissions({ months: monKeys }) : readSubmissions(monKeys)).catch(() => null),
    (d.deviceCfg ? d.deviceCfg() : dev().getConfig()).catch(() => null),
    (d.collectionSettings ? d.collectionSettings() : require('./data-collection').getCollectionSettings()).catch(() => []),
    // Documentation Audit: the departments expected to audit (rule 'docaudit', KPI 2C).
    Promise.resolve().then(() => (d.docAuditDepts ? d.docAuditDepts() : require('./doc-audit').enabledDepts())).catch(() => []),
  ]);
  // submissions, grouped by area | indicator | month (also by indicator name: a stale id falls back to it)
  const subMap = new Map();
  const put = (k, s) => { if (!subMap.has(k)) subMap.set(k, []); subMap.get(k).push(s); };
  (subs || []).forEach((s) => {
    if (!s || !s.area || !s.month) return;
    if (s.indicatorId) put(s.area + '|' + s.indicatorId + '|' + s.month, s);
    if (s.indicatorName) put(s.area + '|n:' + norm(s.indicatorName) + '|' + s.month, s);
  });
  // Device Days: approved month totals per tracked unit
  const ddView = new Map();
  const cfgDoc = ddCfg || { depts: {} };
  const tracked = Object.keys(cfgDoc.depts || {}).filter((id) => DD.cfgOf(cfgDoc.depts[id]).tracked);
  const unitDepts = new Set(ctx.areas.map((a) => a.deptId).filter(Boolean));
  const want = tracked.filter((id) => unitDepts.has(id));
  if (want.length && months.length) {
    const q = { depts: want, from: months[0] + '-01', to: months[months.length - 1] + '-31' };
    const rows = await (d.deviceRows ? d.deviceRows(q) : dev().findRows(q)).catch(() => []);
    const fields = DD.fieldsOf(cfgDoc);
    const monthView = d.monthView || dev().monthView;
    want.forEach((deptId) => {
      const cfg = DD.cfgOf(cfgDoc.depts[deptId]);
      const per = new Map();
      months.forEach((ym) => {
        const mine = (rows || []).filter((r) => r && r.deptId === deptId && String(r.date || '').slice(0, 7) === ym);
        const v = monthView(ym, mine, cfg, now, fields);
        const count = (s) => v.days.filter((x) => x.state === s).length;
        const due = v.days.filter((x) => x.state !== 'not-due' && x.state !== 'future').length;
        per.set(ym, { approved: v.approved, due, missing: count('missing'), waiting: count('submitted') + count('returned') + count('open') });
      });
      ddView.set(deptId, per);
    });
  }
  // Department Setup: start month and "not measured", by quality key and by department id
  const setByKey = new Map(), setById = new Map();
  (settings || []).forEach((s) => {
    const c = (s && s.collection) || {};
    const row = { deptId: s.id, startMonth: c.startMonth || null, notMeasured: c.notMeasured || {} };
    if (s.qualityKey) setByKey.set(String(s.qualityKey), row);
    if (s.id) setById.set(String(s.id), row);
  });
  ctx.sources = { subs: subMap, subsLoaded: Array.isArray(subs), dd: ddView, ddCfg: cfgDoc, setByKey, setById, da: Array.isArray(daDepts) ? daDepts : [], now };
  return ctx.sources;
}

/* ------------------------------------------------------------- unit rules --- */
const settingOf = (ctx, area) => (ctx.sources && (ctx.sources.setByKey.get(String(area.key)) || (area.deptId && ctx.sources.setById.get(String(area.deptId))))) || { startMonth: null, notMeasured: {} };
const monYm = (s) => (s ? K.toYm(s) : null);
/* When a unit starts owing an indicator — the server port of the collectors' rule (dcIndDue,
   data-collection.jsx): the later of the department's start month and the indicator's own;
   with neither set, the earlier of its first reading and January of that year. */
function unitStart(ctx, area, ind, ym) {
  const set = settingOf(ctx, area);
  const a = monYm(set.startMonth), b = monYm(ind && ind.startMonth);
  if (a || b) return [a, b].filter(Boolean).sort().pop();
  let first = null;
  for (const mk of ctx.monKeys) { if ((ind.mNum && has(ind.mNum[mk])) || (ind.months && has(ind.months[mk]))) { first = K.toYm(mk); break; } }
  const jan = ym.slice(0, 4) + '-01';
  return first && first < jan ? first : jan;
}
const notMeasured = (ctx, area, ind) => !!(ind && settingOf(ctx, area).notMeasured[ind.id]);

/* The units a KPI expects a figure from in a month. A list set on the KPI ("Units expected")
   wins; otherwise Department Setup decides (the same rule the collectors' Missing-data page uses). */
function derivedUnits(ctx, def, ym) {
  const rule = link.ruleOf(def);
  // Documentation audits: every department switched on in Documentation Audit → Settings.
  if (rule === 'docaudit') return ((ctx.sources && ctx.sources.da) || []).filter((d) => !d.since || ym >= d.since).map((d) => ({ key: String(d.deptId), name: d.name, deptId: d.deptId }));
  const hosp = (a) => HH.isHospital(a);
  const out = [];
  ctx.areas.forEach((a) => {
    let ind;
    if (rule === 'hh') { if (hosp(a)) return; ind = (a.indicators || []).find(HH.isHHInd); }
    else if (rule === 'hospital') { if (!hosp(a)) return; ind = link.findInd(a, def, ctx); }
    else { if (hosp(a)) return; ind = link.findInd(a, def, ctx); if (ind && rule === 'fall' && link.isOpd(a, ind)) return; }
    if (!ind || notMeasured(ctx, a, ind)) return;
    if (ym < unitStart(ctx, a, ind, ym)) return;
    out.push({ key: String(a.key), name: a.name, deptId: a.deptId || null });
  });
  return out;
}
function expectedUnits(ctx, def, ym) {
  if (Array.isArray(def.units) && def.units.length) {
    return def.units.map((k) => { const a = ctx.areas.find((x) => String(x.key) === String(k)); return { key: String(k), name: a ? a.name : String(k), deptId: a ? a.deptId : null }; });
  }
  return derivedUnits(ctx, def, ym);
}

/* The submission that produced a stored month value: the newest approved one whose review
   is no later than the approval stamp (+2 s), else one re-applied by an administrator at that
   moment, else the newest approved one with the same figures. Never guessed beyond that. */
function matchSubmission(list, approvedAt, num, den) {
  const approved = (list || []).filter((s) => s.status === 'approved').sort((a, b) => (Number(b.reviewedAt) || 0) - (Number(a.reviewedAt) || 0));
  const same = (s) => String(r4(s.num)) === String(r4(num)) && String(r4(s.den)) === String(r4(den));
  let hit = null, how = null;
  if (has(approvedAt)) {
    hit = approved.find((s) => has(s.reviewedAt) && Number(s.reviewedAt) <= Number(approvedAt) + MATCH_MS);
    if (hit) how = 'approval';
    if (!hit) { hit = approved.find((s) => has(s.editedAt) && Math.abs(Number(s.editedAt) - Number(approvedAt)) <= MATCH_MS); if (hit) how = 're-applied'; }
  }
  if (!hit) { hit = approved.find(same); if (hit) how = 'figures'; }
  if (!hit) return null;
  return { id: String(hit._id || hit.id || ''), by: hit.submittedBy || '', byUser: hit.submittedByUser || '', at: hit.submittedAt || null,
    reviewedBy: hit.reviewedBy || '', reviewedAt: hit.reviewedAt || null, editedBy: hit.editedBy || '', editedAt: hit.editedAt || null,
    correction: !!hit.correctionFor, figuresMatch: same(hit), how };
}
function subsFor(ctx, area, ind, mk) {
  if (!ctx.sources) return [];
  const a = ctx.sources.subs.get(area.key + '|' + ind.id + '|' + mk) || [];
  const b = ctx.sources.subs.get(area.key + '|n:' + norm(ind.name) + '|' + mk) || [];
  const seen = new Set(); return a.concat(b).filter((s) => { const k = String(s._id || s.id || JSON.stringify(s)); if (seen.has(k)) return false; seen.add(k); return true; });
}
function deviceDaysFor(ctx, area, ind, ym, wantPatientDays) {
  if (!ctx.sources || !area.deptId) return null;
  const per = ctx.sources.dd.get(String(area.deptId));
  const v = per && per.get(ym);
  if (!v || !v.due) return null;
  const field = DD.fieldForIndicator(ind.canonicalName || ind.name, ctx.byName) || (wantPatientDays ? 'total' : null);
  if (!field) return null;
  return { field, approved: Number(v.approved[field]) || 0, days: v.approved.days, due: v.due, missing: v.missing, waiting: v.waiting };
}

/* -------------------------------------------------------------- evidence --- */
const isPatientDays = (def) => /patient[\s-]*days?/i.test(String((def && def.denLabel) || '')) && ['fall', 'pool'].indexOf(link.ruleOf(def)) >= 0;

/* A KPI measured every N months: the due month's evidence is its whole period — each month's
   evidence (the same evidenceFor, month by month), pooled per unit. A unit "did not report" when
   it has no figure anywhere in the period. Months that are not due owe nothing and check nothing. */
function periodEvidence(ctx, def, ym, saved, cfg, o) {
  const p = K.periodOf(def, ym, cfg);
  const linked = !!(def.source && def.source.indId);
  const autoFill = def.autoFill !== false && K.cfgOf(cfg).autoFill !== false;
  const base = { kpiId: def.id, ym, formula: def.formula, formulaText: def.formulaText || '', rule: linked ? link.ruleOf(def) : 'manual', linked, autoFill,
    started: !!p, startMonth: K.startOf(def, cfg), freqMonths: K.freqOf(def), period: p ? { from: p.from, to: p.to, label: p.label } : null };
  if (!p || p.to !== ym) {
    return Object.assign(base, { notDue: !!p, units: [], totals: { num: null, den: null, value: null, source: p ? 'not-due' : 'not-started' }, system: null, override: null,
      sourceRecord: null, checks: [], fingerprint: fingerprint({ kpiId: def.id, notDue: ym }) });
  }
  const pm = K.monthsBetween(p.from, p.to);
  const mono = Object.assign({}, def, { freqMonths: 1 });
  const subs = pm.map((m) => evidenceFor(ctx, mono, m, null, cfg, { sub: true }));
  const byKey = new Map();
  subs.forEach((s, i) => s.units.forEach((u) => {
    let a = byKey.get(u.key);
    if (!a) { a = { key: u.key, name: u.name, deptId: u.deptId || null, indicator: u.indicator, num: null, den: null, used: false, expected: false, months: [] }; byKey.set(u.key, a); }
    a.months.push({ ym: pm[i], num: u.num, den: u.den, value: u.value, source: u.source, used: !!u.used, approvedAt: u.approvedAt || null, submission: u.submission || null,
      overlayEdited: u.overlayEdited || null, deviceDays: u.deviceDays || null, pending: u.pending || [] });
    if (u.expected) a.expected = true;
    if (u.used) { a.used = true; if (has(u.num)) a.num = (a.num || 0) + Number(u.num); if (has(u.den)) a.den = (a.den || 0) + Number(u.den); }
  }));
  const f = def.formula;
  const units = [...byKey.values()].map((u) => {
    const usedM = u.months.filter((x) => x.used);
    const last = usedM[usedM.length - 1] || null;
    const value = !usedM.length ? null : f === 'count' ? r4(u.num)
      : f === 'direct' ? r4(usedM.reduce((s2, x) => s2 + Number(x.value || 0), 0) / usedM.length)
      : (has(u.num) && Number(u.den) > 0 ? K.computeValue(f, u.num, u.den) : null);
    const source = usedM.length ? (usedM.some((x) => x.source === 'overlay-edit') ? 'overlay-edit' : last.source)
      : ((u.months.find((x) => x.source !== 'missing' && x.source !== 'not-observed') || u.months.find((x) => x.source === 'not-observed') || { source: 'missing' }).source);
    return { key: u.key, name: u.name, deptId: u.deptId, indicator: u.indicator, num: r4(u.num), den: r4(u.den), value, source, used: u.used, expected: u.expected,
      approvedAt: last ? last.approvedAt : null, submission: last ? last.submission : null, overlayEdited: (usedM.find((x) => x.overlayEdited) || {}).overlayEdited || null,
      pending: [].concat(...u.months.map((x) => x.pending)), months: u.months, monthsUsed: usedM.length };
  });
  const system = linked ? link.periodSystem(ctx, def, ym, cfg) : null;
  const live = saved && !saved.removedAt ? saved : null;
  const cell = K.resolveCell(system, live, { autoFill });
  const totals = { num: r4(cell.num), den: r4(cell.den), value: r4(cell.value), source: cell.source };
  const override = live ? { by: live.updatedByName || live.updatedBy || '', at: live.updatedAt || null, note: live.note || '', autoValue: system && autoFill ? r4(system.value) : null, confirmed: !!live.confirmed } : null;
  if (!linked && live) units.push({ key: 'entered', name: 'Entered in the KPI module', num: r4(live.num), den: r4(live.den), value: r4(live.value), source: 'manual', used: true, entered: override });
  if (!autoFill || live) units.forEach((u) => { if (u.key !== 'entered') u.used = false; });

  const checks = [];
  const unitSubject = (u) => ({ key: u.key, num: r4(u.num), den: r4(u.den), value: r4(u.value), source: u.source });
  const add = (code, text, u, subject) => checks.push({ code, level: K.checkLevel(code), text, unit: u ? u.key : '', unitName: u ? u.name : '',
    fingerprint: fingerprint({ code, kpiId: def.id, ym, s: subject || (u ? unitSubject(u) : totals) }) });
  if (linked && autoFill && !live) {
    // each month's own unit checks, named by month (an acknowledgement belongs to that month)
    subs.forEach((s, i) => s.checks.forEach((c) => checks.push(Object.assign({}, c, { unit: (c.unit || '') + '@' + pm[i], text: K.fmtMonth(pm[i]) + ' · ' + c.text }))));
    units.forEach((u) => {
      if (u.expected && !u.used && !(u.months.length && u.months.every((x) => x.source === 'not-observed'))) {
        add('unit-missing', u.name + ' has no ' + (def.name || 'figure') + ' for ' + p.label + (u.pending.length ? ' — a figure from ' + (u.pending[0].by || 'the unit') + ' is waiting for approval.' : '.'), u);
      }
    });
  }
  if (linked && live && autoFill && system && has(system.value)) {
    if (!String(live.note || '').trim()) add('override-no-note', 'The system figure for ' + p.label + ' was changed by ' + (override.by || 'a KPI manager') + ' without a reason.', null);
    else add('override', 'Figure entered by ' + (override.by || 'a KPI manager') + ' instead of the system figure' + (override.autoValue != null ? ' (' + K.fmt(def, override.autoValue) + ')' : '') + ': “' + live.note + '”.', null);
  }
  if (!has(totals.value) && !checks.some((c) => c.level === 'error') && !(units.length && units.every((u) => u.source === 'not-observed'))) add('no-data', 'No ' + (def.name || 'figure') + ' for ' + p.label + '.', null);
  if (has(totals.value) && def.formula === 'pct' && Number(totals.value) > 100) add('impossible', 'The period’s value is over 100%.', null);
  if (has(totals.value) && o && o.priors) {
    const pr = o.priors.filter(has).map(Number);
    const med = K.medianOf(pr);
    if (pr.length >= 3 && med > 0 && Number(totals.value) > 3 * med) add('outlier', K.fmt(def, totals.value) + ' is ' + K.round(Number(totals.value) / med, 1) + '× the usual (' + K.fmt(def, med) + ').', null, { totals, med: r4(med) });
  }
  const ev = Object.assign(base, { months: pm, units, totals, system: system ? { num: r4(system.num), den: r4(system.den), value: r4(system.value), source: system.source } : null,
    override, sourceRecord: null, checks });
  ev.fingerprint = fingerprint({ units: units.map(unitSubject), totals });
  return ev;
}

function evidenceFor(ctx, def, ym, saved, cfg, opts) {
  const o = opts || {};
  if (K.freqOf(def) > 1 && !o.sub) return periodEvidence(ctx, def, ym, saved, cfg, o);
  const mk = K.toMonKey(ym);
  const linked = !!(def.source && def.source.indId);
  const autoFill = def.autoFill !== false && K.cfgOf(cfg).autoFill !== false;
  const rule = linked ? link.ruleOf(def) : 'manual';
  const started = K.isStarted(def, ym, cfg);
  const live = saved && !saved.removedAt ? saved : null;
  const units = [];
  let system = null, sourceRecord = null;

  if (linked) {
    system = (link.linkedMonthlyFrom(ctx, def, [ym]) || {})[ym] || null;
    if (rule === 'hh') {
      ctx._hh = ctx._hh || {};
      const res = ctx._hh[mk] || (ctx._hh[mk] = HH.build(ctx.areas, [mk]));
      const m0 = res.months[0] || {};
      (res.rows || []).forEach((row) => {
        const c = row.cells[mk];
        if (!c) return;
        const src = c.src === 'audit' ? 'audit' : c.src === 'own' || c.src === 'own-pct' ? 'own' : c.src === 'covered' ? 'covered' : 'not-audited';
        units.push({ key: String(row.deptKey || row.key), name: row.name, num: c.n, den: c.d, value: c.pct, source: src, used: src === 'audit' && m0.d > 0, groups: row.groups[mk] || null });
      });
      // the audit itself — who entered it and who approved it
      const hosp = ctx.areas.find((a) => HH.isHospital(a));
      const sInd = hosp && (hosp.indicators || []).find(HH.isHHInd);
      if (hosp && sInd) {
        const sub = matchSubmission(subsFor(ctx, hosp, sInd, mk), sInd._meta && sInd._meta.approvedAt[mk], sInd.mNum && sInd.mNum[mk], sInd.mDen && sInd.mDen[mk]);
        sourceRecord = { name: 'Hand hygiene audit · ' + hosp.name, num: m0.n, den: m0.d, value: m0.pct, submission: sub, approvedAt: (sInd._meta && sInd._meta.approvedAt[mk]) || null,
          overlayEdited: sInd._meta && (sInd._meta.overlay.mNum[mk] || sInd._meta.overlay.mDen[mk]) ? { at: sInd._meta.editedAt[mk] || null, by: sInd._meta.editedBy[mk] || '' } : null,
          pending: subsFor(ctx, hosp, sInd, mk).some((s) => s.status !== 'approved') };
        if (!units.some((u) => u.used) && has(m0.pct)) units.push({ key: String(hosp.key), name: hosp.name + ' (audit total)', num: m0.n, den: m0.d, value: m0.pct, source: 'audit', used: true });
      }
    } else if (rule === 'docaudit') {
      // One row per department that audited: its Σ Yes ÷ Σ (Yes + No) and how many records.
      const c = (ctx.docAudit || {})[ym];
      const minOf = {}; ((ctx.sources && ctx.sources.da) || []).forEach((d) => { minOf[d.deptId] = d.minRecords; });
      ((c && c.byDept) || []).forEach((d) => units.push({ key: String(d.deptId), name: d.name, deptId: d.deptId, indicator: 'Documentation audits',
        num: d.yes, den: d.yes + d.no, value: d.value, source: 'doc-audit', used: d.yes + d.no > 0, records: d.records, minRecords: minOf[d.deptId] == null ? null : minOf[d.deptId] }));
    } else {
      const hosp = ctx.areas.filter((a) => HH.isHospital(a));
      const unitAreas = ctx.areas.filter((a) => !HH.isHospital(a));
      const pairs = (areas) => areas.map((area) => ({ area, ind: link.findInd(area, def, ctx) })).filter((p) => p.ind && !(rule === 'fall' && link.isOpd(p.area, p.ind)));
      const hospPairs = pairs(hosp);
      const list = rule === 'hospital' ? hospPairs : pairs(unitAreas).concat(system && system.source === 'hospital' ? hospPairs : []);
      list.forEach(({ area, ind }) => {
        const meta = ind._meta || { approvedAt: {}, editedAt: {}, editedBy: {}, overlay: { mNum: {}, mDen: {}, months: {} } };
        const rawNum = ind.mNum && ind.mNum[mk], rawDen = ind.mDen && ind.mDen[mk];
        const cell = link.poolMonth(def, mk, [{ area, ind }], ctx, { carry: rule === 'hospital' || HH.isHospital(area), source: 'unit' });
        const subs = subsFor(ctx, area, ind, mk);
        const notObs = !!(ind.mNotObserved && ind.mNotObserved[mk]);
        const overlay = !!(meta.overlay.mNum[mk] || meta.overlay.mDen[mk] || meta.overlay.months[mk]);
        let source = 'approved';
        if (notObs) source = 'not-observed';
        else if (!cell) source = 'missing';
        else if (cell.source === 'partial') source = has(rawDen) && Number(rawDen) === 0 ? 'den-zero' : 'partial';
        else if (overlay) source = 'overlay-edit';
        else if (cell.carriedFrom) source = 'carried-den';
        const usable = !!cell && cell.source !== 'partial' && has(cell.value);
        const row = {
          key: String(area.key), name: area.name, deptId: area.deptId || null, indicator: ind.canonicalName || ind.name,
          num: cell ? cell.num : (has(rawNum) ? Number(rawNum) : null), den: cell ? cell.den : (has(rawDen) ? Number(rawDen) : null), value: cell ? cell.value : null,
          source, used: usable && (rule === 'hospital' || !HH.isHospital(area) || (system && system.source === 'hospital')),
          approvedAt: meta.approvedAt[mk] || null,
          submission: usable && !overlay ? matchSubmission(subs, meta.approvedAt[mk], rawNum, rawDen) : null,
          overlayEdited: overlay ? { at: meta.editedAt[mk] || null, by: meta.editedBy[mk] || '' } : null,
          pending: subs.filter((s) => s.status !== 'approved').map((s) => ({ id: String(s._id || s.id || ''), by: s.submittedBy || '', at: s.submittedAt || null, num: s.num, den: s.den })),
          carriedFrom: cell && cell.carriedFrom ? cell.carriedFrom : null,
          deviceDays: deviceDaysFor(ctx, area, ind, ym, isPatientDays(def)),
          start: unitStart(ctx, area, ind, ym), notMeasured: notMeasured(ctx, area, ind),
        };
        units.push(row);
      });
    }
  }

  // the figure the KPI uses for the month (kpi-core resolveCell: typed ▸ system ▸ nothing)
  const cell = K.resolveCell(system, live, { autoFill });
  const totals = { num: r4(cell.num), den: r4(cell.den), value: r4(cell.value), source: cell.source };
  const override = live ? { by: live.updatedByName || live.updatedBy || '', at: live.updatedAt || null, note: live.note || '', autoValue: system && autoFill ? r4(system.value) : null, confirmed: !!live.confirmed } : null;
  if (!linked && live) units.push({ key: 'entered', name: 'Entered in the KPI module', num: r4(live.num), den: r4(live.den), value: r4(live.value), source: 'manual', used: true, entered: override });
  if (!autoFill || live) units.forEach((u) => { if (u.key !== 'entered') u.used = false; });

  // expected units the quality data has nothing for at all
  const expected = linked && started ? expectedUnits(ctx, def, ym) : [];
  const expKeys = new Set(expected.map((u) => u.key));
  units.forEach((u) => { u.expected = expKeys.has(u.key); });
  expected.forEach((e) => { if (!units.some((u) => u.key === e.key)) units.push({ key: e.key, name: e.name, deptId: e.deptId, num: null, den: null, value: null, source: 'missing', used: false, expected: true }); });

  /* ---- checks ---- */
  const checks = [];
  const unitSubject = (u) => ({ key: u.key, num: r4(u.num), den: r4(u.den), value: r4(u.value), source: u.source });
  const add = (code, text, u, subject) => {
    const level = K.checkLevel(code);
    checks.push({ code, level, text, unit: u ? u.key : '', unitName: u ? u.name : '', fingerprint: fingerprint({ code, kpiId: def.id, ym, s: subject || (u ? unitSubject(u) : totals) }) });
  };
  const month = K.fmtMonthLong(ym);
  if (started) {
    const systemInUse = linked && autoFill && !live;
    if (systemInUse) {
      units.forEach((u) => {
        if (u.key === 'entered') return;
        const nm = u.name;
        if (u.expected && !o.sub && (u.source === 'missing' || (rule === 'hh' && (u.source === 'not-audited')))) {
          add('unit-missing', nm + ' has no ' + (def.name || 'figure') + ' for ' + month + (u.pending && u.pending.length ? ' — a figure from ' + (u.pending[0].by || 'the unit') + ' is waiting for approval.' : '.'), u);
          return;
        }
        if (u.source === 'not-observed') { add('not-observed', nm + ' marked ' + month + ' as not observed.', u); return; }
        if (u.source === 'partial') add('partial', nm + ': ' + u.num + ' ' + (def.numLabel || 'events').toLowerCase() + ' but no ' + (def.denLabel || 'denominator').toLowerCase() + ' for ' + month + '.', u);
        if (u.source === 'den-zero') add('den-zero', nm + ': ' + u.num + ' ' + (def.numLabel || 'events').toLowerCase() + ' against a ' + (def.denLabel || 'denominator').toLowerCase() + ' of 0.', u);
        const f = def.formula;
        if ((has(u.num) && Number(u.num) < 0) || (has(u.den) && Number(u.den) < 0) || (f === 'pct' && has(u.num) && has(u.den) && Number(u.num) > Number(u.den)) || (f === 'pct' && has(u.value) && Number(u.value) > 100)) {
          add('impossible', nm + ': ' + u.num + ' ÷ ' + u.den + ' cannot be right for ' + (def.name || 'this KPI') + '.', u);
        }
        if (rule === 'docaudit' && u.used && u.minRecords > 0 && u.records < u.minRecords) add('docaudit-sample', nm + ': ' + u.records + ' record(s) audited in ' + month + ' — the minimum is ' + u.minRecords + '.', u, Object.assign(unitSubject(u), { r: u.records, m: u.minRecords }));
        if (u.source === 'overlay-edit') add('overlay-edit', nm + ': the figure was changed in the Quality console' + (u.overlayEdited && u.overlayEdited.by ? ' by ' + u.overlayEdited.by : '') + ' and is not the approved submission.', u);
        if (u.pending && u.pending.length && u.used) add('pending-newer', nm + ': a newer figure (' + u.pending[0].num + (has(u.pending[0].den) ? ' ÷ ' + u.pending[0].den : '') + ') from ' + (u.pending[0].by || 'the unit') + ' is waiting for approval.', u);
        if (u.carriedFrom && K.monthDiff(K.toYm(u.carriedFrom), ym) > STALE_DEN_MONTHS) add('stale-den', nm + ': the ' + (def.denLabel || 'denominator').toLowerCase() + ' (' + u.den + ') was entered for ' + K.fmtMonth(K.toYm(u.carriedFrom)) + ' and carried forward.', u);
        const dd = u.deviceDays;
        if (dd && u.used && dd.field !== 'total' && has(u.den) && Number(u.den) !== dd.approved) {
          add('dd-mismatch', nm + ': ' + (def.denLabel || 'denominator') + ' ' + u.den + ' but Device Days shows ' + dd.approved + ' approved ' + dd.field + ' days for ' + month + '.', u, Object.assign(unitSubject(u), { dd: dd.approved }));
        }
        if (dd && u.used && (dd.missing || dd.waiting)) add('dd-incomplete', nm + ': Device Days has ' + [dd.missing ? dd.missing + ' missed' : '', dd.waiting ? dd.waiting + ' not yet approved' : ''].filter(Boolean).join(', ') + ' day(s) in ' + month + '.', u, Object.assign(unitSubject(u), { ddm: dd.missing, ddw: dd.waiting }));
        if (dd && u.used && dd.field === 'total' && dd.approved > 0 && has(u.den) && Math.abs(Number(u.den) - dd.approved) / dd.approved > PD_TOLERANCE) {
          add('patient-days-mismatch', nm + ': patient-days ' + u.den + ' vs ' + dd.approved + ' total patients in approved Device Days.', u, Object.assign(unitSubject(u), { dd: dd.approved }));
        }
        if (u.used && ctx.sources && ctx.sources.subsLoaded && !u.submission && !u.overlayEdited && u.source === 'approved') add('sub-unmatched', nm + ': the approved figure could not be traced to its submission.', u);
      });
      if (sourceRecord) {
        if (sourceRecord.overlayEdited) add('overlay-edit', 'The hand hygiene audit figure was changed in the Quality console' + (sourceRecord.overlayEdited.by ? ' by ' + sourceRecord.overlayEdited.by : '') + '.', null);
        if (sourceRecord.pending) add('pending-newer', 'A newer hand hygiene audit for ' + month + ' is waiting for approval.', null);
      }
    }
    // Only a REAL override: the quality data has a figure and a typed one replaced it.
    if (linked && live && autoFill && system && has(system.value)) {
      if (!String(live.note || '').trim()) add('override-no-note', 'The system figure for ' + month + ' was changed by ' + (override.by || 'a KPI manager') + ' without a reason.', null);
      else add('override', 'Figure entered by ' + (override.by || 'a KPI manager') + ' instead of the system figure' + (override.autoValue != null ? ' (' + K.fmt(def, override.autoValue) + ')' : '') + ': “' + live.note + '”.', null);
    }
    if (!o.sub && !has(totals.value) && !checks.some((c) => c.level === 'error') && !(units.length && units.every((u) => u.source === 'not-observed'))) {
      add('no-data', 'No ' + (def.name || 'figure') + ' for ' + month + '.', null);
    }
    if (!o.sub && has(totals.value) && def.formula === 'pct' && Number(totals.value) > 100) add('impossible', 'The month’s value is over 100%.', null);
    // an unusual month, against the KPI's own previous six
    if (has(totals.value) && o.priors) {
      const p = o.priors.filter(has).map(Number);
      const med = K.medianOf(p);
      if (p.length >= 3 && med > 0 && Number(totals.value) > 3 * med) add('outlier', K.fmt(def, totals.value) + ' is ' + K.round(Number(totals.value) / med, 1) + '× the usual (' + K.fmt(def, med) + ').', null, { totals, med: r4(med) });
    }
  }

  const ev = {
    kpiId: def.id, ym, formula: def.formula, formulaText: def.formulaText || '', rule, linked, autoFill, started, startMonth: K.startOf(def, cfg),
    units, totals, system: system ? { num: r4(system.num), den: r4(system.den), value: r4(system.value), source: system.source } : null,
    override, sourceRecord, checks,
  };
  ev.fingerprint = fingerprint({ units: units.map(unitSubject), totals });
  return ev;
}

/* Evidence for every KPI × month of a period. `savedById` = { 'kpiId:YYYY-MM': kpiMonths row }.
   The KPI's previous six months (system or typed) feed the "unusual figure" check. */
function evidenceAll(ctx, defs, yms, savedById, cfg) {
  const out = {};
  (defs || []).forEach((def) => {
    out[def.id] = {};
    const autoFill = def.autoFill !== false && K.cfgOf(cfg).autoFill !== false;
    const prevAll = K.monthsBetween(K.addMonth(yms[0], -6), K.addMonth(yms[0], -1));
    const sys = def.source && def.source.indId ? link.linkedMonthlyFrom(ctx, def, prevAll.concat(yms)) : {};
    const valueAt = (m) => { const s = savedById[def.id + ':' + m]; return K.resolveCell(sys[m], s && !s.removedAt ? s : null, { autoFill }).value; };
    const fq = K.freqOf(def);
    const valueAtP = (m) => { const s = savedById[def.id + ':' + m]; return K.resolveCell(def.source && def.source.indId ? link.periodSystem(ctx, def, m, cfg) : null, s && !s.removedAt ? s : null, { autoFill }).value; };
    yms.forEach((ym) => {
      const prior = fq === 1 ? K.monthsBetween(K.addMonth(ym, -6), K.addMonth(ym, -1)).map(valueAt)
        : K.isDue(def, ym, cfg) ? [4, 3, 2, 1].map((i) => K.addMonth(ym, -i * fq)).filter((m) => K.isDue(def, m, cfg)).map(valueAtP) : null;
      out[def.id][ym] = evidenceFor(ctx, def, ym, savedById[def.id + ':' + ym] || null, cfg, { priors: prior });
    });
    // "Units expected" set by hand, but Department Setup says otherwise — once per KPI (on its last due month)
    const last = yms.slice().reverse().find((m) => !out[def.id][m].notDue) || yms[yms.length - 1];
    if (Array.isArray(def.units) && def.units.length && def.source && def.source.indId && K.isStarted(def, last, cfg)) {
      const mine = new Set(def.units.map(String)), setup = derivedUnits(ctx, def, last);
      const setupKeys = new Set(setup.map((u) => u.key));
      const extra = [...mine].filter((k) => !setupKeys.has(k)), missing = setup.filter((u) => !mine.has(u.key));
      if (extra.length || missing.length) {
        const nameOf = (k) => { const a = ctx.areas.find((x) => String(x.key) === k); return a ? a.name : k; };
        const ev = out[def.id][last];
        ev.checks.push({ code: 'setup-drift', level: K.checkLevel('setup-drift'), unit: '', unitName: '',
          text: (missing.length ? 'Department Setup also expects: ' + missing.map((u) => u.name).join(', ') + '. ' : '') + (extra.length ? 'On this KPI’s list but not due per Department Setup: ' + extra.map(nameOf).join(', ') + '.' : ''),
          fingerprint: fingerprint({ code: 'setup-drift', kpiId: def.id, mine: [...mine].sort(), setup: [...setupKeys].sort() }) });
      }
    }
  });
  return out;
}

/* Error-level checks that have no acknowledgement for exactly the data they looked at. */
function unresolved(all, acks) {
  const ok = new Map((acks || []).filter((a) => a && !a.revokedAt).map((a) => [a.key, a.fingerprint]));
  const out = [];
  Object.keys(all || {}).forEach((kpiId) => Object.keys(all[kpiId]).forEach((ym) => (all[kpiId][ym].checks || []).forEach((c) => {
    if (c.level !== 'error') return;
    const key = ackKey(kpiId, ym, c.code, c.unit);
    if (ok.get(key) === c.fingerprint) return;
    out.push({ key, kpiId, ym, code: c.code, unit: c.unit, unitName: c.unitName, text: c.text, fingerprint: c.fingerprint });
  })));
  return out;
}
// Every check of a period with its acknowledgement (if any) — the "Data quality" page.
function checkList(all, acks) {
  const by = new Map((acks || []).filter((a) => a && !a.revokedAt).map((a) => [a.key, a]));
  const out = [];
  Object.keys(all || {}).forEach((kpiId) => Object.keys(all[kpiId]).sort().forEach((ym) => (all[kpiId][ym].checks || []).forEach((c) => {
    const key = ackKey(kpiId, ym, c.code, c.unit);
    const a = by.get(key);
    out.push(Object.assign({ key, kpiId, ym }, c, { ack: a ? { by: a.byName || a.by, at: a.at, reason: a.reason, current: a.fingerprint === c.fingerprint } : null }));
  })));
  return out;
}
// One fingerprint for the whole period's data (printed on every page of a final report).
const dataFingerprint = (all) => fingerprint(Object.keys(all || {}).sort().map((k) => Object.keys(all[k]).sort().map((m) => all[k][m].fingerprint)));

module.exports = { loadSources, expectedUnits, derivedUnits, evidenceFor, evidenceAll, unresolved, checkList, ackKey, fingerprint, dataFingerprint, matchSubmission, unitStart };
