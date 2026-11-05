/* Nursing KPI: cycles, targets and status (kpi-core), the system figures pooled from the quality
   data (kpi-link: Σnum ÷ Σden, the OPD fall excluded, hand hygiene counted once, the NSI headcount
   carried forward, the overlay's newest-wins rule), who may do what, editing and reverting a
   system figure, reports that freeze when final, the monthly auto-draft, and both office files.
   Runs on fakes (no database). */
const assert = require('node:assert/strict');

const logged = [];
const fake = (rel, exports) => { const p = require.resolve(rel); require.cache[p] = { id: p, filename: p, loaded: true, exports }; };

/* ---- quality data the resolver reads (Mongo departments.quality + the overlay) ---- */
const CLABSI = 'ind-central-line-associated-bloodstream-infection';
let AREAS = [];
let OVERLAY = {};
const resetAreas = () => {
  AREAS = [
    { key: 'MICU', name: 'Medical ICU', deptId: 'micu', indicators: [
      { id: CLABSI, name: 'CLABSI Rate', formula: 'rate1000', mNum: { 'Sep-26': 0, 'Oct-26': 1 }, mDen: { 'Sep-26': 400, 'Oct-26': 500 }, mApprovedAt: { 'Sep-26': 4000, 'Oct-26': 5000 } },
      { id: 'ind-hand-hygiene-compliance', name: 'Hand Hygiene Compliance', formula: 'pct', mNum: { 'Oct-26': 40 }, mDen: { 'Oct-26': 50 }, mFromAudit: { 'Oct-26': 1 } },
    ] },
    { key: 'SICU', name: 'Surgical ICU', deptId: 'sicu', indicators: [
      { id: CLABSI, name: 'CLABSI Rate', formula: 'rate1000', mNum: { 'Sep-26': 1, 'Oct-26': 1 }, mDen: { 'Oct-26': 250 } },
    ] },
    // CCU carries CLABSI (it reported in July) but sent nothing for October: a missing unit.
    { key: 'CCU', name: 'Coronary Care Unit', deptId: 'ccu', indicators: [
      { id: CLABSI, name: 'CLABSI Rate', formula: 'rate1000', mNum: { 'Jul-26': 0 }, mDen: { 'Jul-26': 300 } },
    ] },
    { key: 'OPD', name: 'OPD', deptId: 'opd', indicators: [
      { id: 'ind-patient-fall', name: 'Out Patient Fall', formula: 'rate1000', mNum: { 'Oct-26': 5 }, mDen: { 'Oct-26': 100 } },
    ] },
    { key: 'Level 9', name: 'IPD Cabin Level 9', deptId: 'lvl9', indicators: [
      { id: 'ind-patient-fall', name: 'Patient Fall', formula: 'rate1000', mNum: { 'Oct-26': 1 }, mDen: { 'Oct-26': 1000 } },
    ] },
    { key: 'Overall Hospital', name: 'Overall Hospital', deptId: '__hospital__', indicators: [
      { id: 'ind-hand-hygiene-compliance', name: 'Hand Hygiene Compliance (Hospital)', formula: 'pct', mNum: { 'Oct-26': 70 }, mDen: { 'Oct-26': 100 },
        mDeptBreakdown: { 'Oct-26': [{ dept: 'Medical ICU', g: { nurse: { n: 40, d: 50 } } }, { dept: 'Surgical ICU', g: { nurse: { n: 30, d: 50 } } }] } },
      { id: 'ind-needle-stick-injury', name: 'Needle Stick Injury', formula: 'rate100', denAdminOnly: true, mNum: { 'Oct-26': 1 }, mDen: { 'Aug-26': 500 } },
      { id: 'ind-nursing-turnover', name: 'Nursing Turnover Rate', formula: 'pct', mNum: {}, mDen: {} },
    ] },
  ];
  OVERLAY = {};
};
resetAreas();
const CATALOGUE = [{ canonicalName: 'Central Line-Associated Bloodstream Infection (CLABSI) Rate', aliases: ['clabsi rate', 'central line associated bloodstream infection'], formula: 'rate1000' },
  { canonicalName: 'Needle Stick Injury Rate', aliases: ['needle stick injury'], formula: 'rate100', denAdminOnly: true }];
const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

fake('../db', { getDbHandle: async () => null, getQuality: async () => AREAS, getAppData: async () => ({ data: { unico_quality_v2: JSON.stringify(OVERLAY) } }),
  getDepartments: async () => [], getUsers: async () => null });
fake('../deptmap', { get: async () => ({ byId: { micu: { name: 'Medical ICU' }, sicu: { name: 'Surgical ICU' } } }), HOSPITAL: '__hospital__' });
fake('../activity-log', { log: (req, action, opts) => logged.push({ action, opts }) });
fake('../quality-formulas', {
  getFormulas: async () => CATALOGUE,
  buildByNameMap: (fs) => { const m = {}; fs.forEach((f) => { const def = Object.assign({}, f); [...f.aliases, f.canonicalName].forEach((k) => { m[norm(k)] = def; }); }); return m; },
});

const K = require('../../renderer/unico/kpi-core.js');
const link = require('../kpi-link');
const kpi = require('../kpi');
const access = require('../access');
const catalogue = require('../kpi-catalogue');

// Hospital clock: 2026-11-05 12:00 Asia/Dhaka.
const clock = Date.parse('2026-11-05T06:00:00Z');
let tick = 0;
const now = () => clock + (tick++);
const routes = {};
const reg = (m) => (p, g, h) => { routes[m + ' ' + p] = h; };
/* ---- the evidence sources: submissions, Device Days, Department Setup ---- */
const SUBS = [
  { _id: 'sub-micu-oct', area: 'MICU', indicatorId: CLABSI, indicatorName: 'CLABSI Rate', month: 'Oct-26', num: 1, den: 500, status: 'approved', submittedBy: 'Nurse Rina', submittedByUser: 'rina', submittedAt: 4500, reviewedBy: 'Admin Karim', reviewedAt: 5003 },
  { _id: 'sub-micu-oct-old', area: 'MICU', indicatorId: CLABSI, indicatorName: 'CLABSI Rate', month: 'Oct-26', num: 2, den: 500, status: 'approved', submittedBy: 'Nurse Old', submittedAt: 100, reviewedBy: 'Admin Karim', reviewedAt: 200 },
  { _id: 'sub-sicu-oct-new', area: 'SICU', indicatorId: CLABSI, indicatorName: 'CLABSI Rate', month: 'Oct-26', num: 2, den: 260, status: 'pending', submittedBy: 'Nurse Sumi', submittedAt: 7000 },
];
// MICU is tracked in Device Days from 1 October: 31 approved days, 480 central-line days (≠ 500).
const DD_CFG = { depts: { micu: { tracked: true, frequency: 'monthly', startDate: '2026-10-01', cutoff: '10:00' } } };
const DD_ROWS = Array.from({ length: 31 }, (_, i) => ({ deptId: 'micu', date: '2026-10-' + String(i + 1).padStart(2, '0'), status: 'approved', time: '08:00', total: 20, peripheral: 0, central: i === 0 ? 30 : 15, urinary: 0, ventilator: 0 }));
let SETTINGS = [{ id: 'micu', qualityKey: 'MICU', collection: {} }, { id: 'sicu', qualityKey: 'SICU', collection: {} }, { id: 'ccu', qualityKey: 'CCU', collection: {} }];
const deps = { submissions: async () => SUBS, deviceRows: async () => DD_ROWS, deviceCfg: async () => DD_CFG, collectionSettings: async () => SETTINGS };
kpi.mount({ get: reg('GET'), put: reg('PUT'), post: reg('POST'), delete: reg('DELETE') }, { requireApi: [], now, deps });
async function call(route, a, { params = {}, query = {}, body = {} } = {}) {
  const out = { status: 200, body: null, headers: {}, order: [] };
  const res = {
    status(c) { out.status = c; return res; }, json(b) { out.body = b; return res; },
    set(k, v) { out.headers[k] = v; out.order.push('header'); return res; }, end(b) { out.body = b; out.order.push('end'); return res; },
  };
  if (!routes[route]) throw new Error('no route ' + route);
  await routes[route]({ params, query, body, access: a, user: a && { sub: a.username } }, res);
  return out;
}
const user = (username, perms) => ({ unrestricted: false, username, name: username, role: 'User', perms });
const admin = { unrestricted: true, username: 'admin', name: 'Admin', role: 'Administrator' };
const def = (id) => Object.assign({}, catalogue.seedDocs().find((d) => d.id === id));

(async () => {
  /* ---- the shared rule ---- */
  const cfg = { cycleStart: '2026-09', cycleMonths: 6, cycles: 2 };
  assert.deepEqual([K.cycleOf('2026-08', cfg).index, K.cycleOf('2026-09', cfg).index, K.cycleOf('2027-02', cfg).index, K.cycleOf('2027-03', cfg).index, K.cycleOf('2027-09', cfg).index], [0, 1, 1, 2, 3]);
  assert.equal(K.cycleOf('2026-11', cfg).monthNo, 3);
  const falls = { goalDirection: 'lower_is_better', targets: [{ cycle: 1, value: 10 }, { cycle: 2, value: 5 }] };
  assert.equal(K.targetFor(falls, '2026-10', cfg), 10, 'cycle 1 target');
  assert.equal(K.targetFor(falls, '2027-04', cfg), 5, 'cycle 2 target');
  assert.equal(K.targetFor(falls, '2028-01', cfg), 5, 'after the programme: the last target');
  assert.equal(K.targetFor(falls, '2026-01', cfg), 10, 'before the programme: cycle 1');
  assert.equal(K.targetFor({ baseline: { value: 200 }, baselineTargetPct: -5, targets: [] }, '2026-10', cfg), 190, 'target 5% below the baseline');
  assert.equal(K.statusOf(falls, 9, 10, cfg), 'met');
  assert.equal(K.statusOf(falls, 10.8, 10, cfg), 'near', 'within 10% of the target');
  assert.equal(K.statusOf(falls, 12, 10, cfg), 'off');
  assert.equal(K.statusOf({ goalDirection: 'lower_is_better' }, 0.5, 0, cfg), 'off', 'zero-harm target: any event is off');
  assert.equal(K.statusOf({ goalDirection: 'higher_is_better' }, 76, 75, cfg), 'met');
  assert.equal(K.statusOf({}, null, 75, cfg), 'nodata');
  assert.equal(K.statusOf({}, 70, null, cfg), 'notarget');
  assert.equal(K.gapLabel({ unit: '%', goalDirection: 'higher_is_better' }, 69.5, 75), '5.5% to go');
  assert.equal(K.achievement({ goalDirection: 'lower_is_better' }, 0, 0), 100);
  assert.equal(K.achievement({ goalDirection: 'lower_is_better' }, 4, 2), 50);
  assert.equal(K.computeValue('rate1000', 2, 750), 2.67);
  assert.equal(K.computeValue('pct', 3, 0), null, 'no denominator = no value, never 0');
  assert.deepEqual(K.periodValue({ formula: 'rate1000' }, [{ num: 1, den: 500, value: 2 }, { num: 1, den: 250, value: 4 }]), { value: 2.67, num: 2, den: 750, months: 2 }, 'pooled, not a mean of rates');
  assert.equal(K.periodValue({ formula: 'count' }, [{ value: 2 }, { value: 3 }]).value, 5);
  assert.deepEqual(K.presetRange('3m', '2026-10'), { from: '2026-08', to: '2026-10' });
  assert.deepEqual(K.presetRange('cycle2', null, cfg), { from: '2027-03', to: '2027-08' });
  assert.equal(K.presetOf('2026-09', '2027-02', cfg), 'cycle1');
  // a calendar year: January to December, "so far" while it is running
  assert.deepEqual(K.yearRange(2025), { from: '2025-01', to: '2025-12', year: 2025, partial: false });
  assert.deepEqual(K.yearRange(2026, '2026-10'), { from: '2026-01', to: '2026-10', year: 2026, partial: true });
  assert.equal(K.presetOf('2025-01', '2025-12', cfg), 'year', 'a whole year is named a year, not "12 months"');
  assert.equal(K.fmtRange('2025-01', '2025-12'), 'Year 2025');
  assert.equal(K.fmtRange('2026-01', '2026-10'), 'Jan 2026 – Oct 2026');
  assert.deepEqual(K.presetRange('year', '2025-06'), { from: '2025-01', to: '2025-12', year: 2025, partial: false });
  assert.equal(K.toMonKey('2026-11'), 'Nov-26'); assert.equal(K.toYm('Nov-26'), '2026-11');
  assert.equal(K.parseReportId('2026-10_2026-09'), null, 'end before start');
  assert.equal(K.validateEntry({ formula: 'pct', numLabel: 'Accurate records' }, { num: 5, den: 4 }), 'The accurate records cannot be more than the denominator for a percentage.');
  assert.match(K.validateEntry({ formula: 'rate1000', denLabel: 'Patient-days' }, { num: 1 }), /patient-days/);
  assert.equal(K.validateEntry({ formula: 'direct' }, { value: 12 }), null);
  assert.equal(catalogue.seedDocs().length, 17, 'every KPI on the deck (training split nurses / PCAs)');

  /* ---- system figures from the quality data ---- */
  let ctx = await link.loadContext(['2026-09', '2026-10']);
  let m = link.linkedMonthlyFrom(ctx, def('kpi-clabsi'), ['2026-09', '2026-10']);
  assert.equal(m['2026-10'].value, 2.67, 'CLABSI pooled 2 / 750 × 1000 (the mean of the units would be 3)');
  assert.equal(m['2026-10'].areas, 2);
  assert.equal(m['2026-09'].value, 0, 'MICU 0/400; SICU had an event without device days');
  assert.equal(m['2026-09'].incomplete, true, 'flagged incomplete');
  m = link.linkedMonthlyFrom(ctx, def('kpi-patient-falls'), ['2026-10']);
  assert.equal(m['2026-10'].value, 1, 'the out-patient "fall" is not counted (1 / 1000 patient-days)');
  m = link.linkedMonthlyFrom(ctx, def('kpi-hand-hygiene'), ['2026-10']);
  assert.deepEqual([m['2026-10'].num, m['2026-10'].den, m['2026-10'].value, m['2026-10'].source], [70, 100, 70, 'hh-audit'], 'the audit, each observation once');
  m = link.linkedMonthlyFrom(ctx, def('kpi-nsi'), ['2026-10']);
  assert.deepEqual([m['2026-10'].value, m['2026-10'].den, m['2026-10'].carriedFrom], [0.2, 500, 'Aug-26'], 'NSI headcount carried forward');
  assert.deepEqual(link.linkedMonthlyFrom(ctx, def('kpi-turnover'), ['2026-10']), {}, 'no turnover data yet');
  // The overlay: a console edit wins, until an approval newer than it lands in the database.
  OVERLAY = { depts: { MICU: { indPatches: { [CLABSI]: { mNum: { 'Oct-26': 2 }, mEditedAt: { 'Oct-26': 9000 } } } } } };
  ctx = await link.loadContext(['2026-10']);
  assert.equal(link.linkedMonthlyFrom(ctx, def('kpi-clabsi'), ['2026-10'])['2026-10'].value, 4, 'overlay edit: 3 / 750');
  AREAS[0].indicators[0].mApprovedAt = { 'Oct-26': 10000 };
  ctx = await link.loadContext(['2026-10']);
  assert.equal(link.linkedMonthlyFrom(ctx, def('kpi-clabsi'), ['2026-10'])['2026-10'].value, 2.67, 'a newer approval wins over the overlay');
  OVERLAY = { depts: { SICU: { indRemoved: [CLABSI] } } };
  ctx = await link.loadContext(['2026-10']);
  assert.equal(link.linkedMonthlyFrom(ctx, def('kpi-clabsi'), ['2026-10'])['2026-10'].value, 2, 'an indicator removed in the console is left out');
  resetAreas();
  assert.ok(link.indicatorCatalog(await link.loadContext(['2026-10'])).find((i) => i.id === CLABSI && i.areas.length === 3 && i.areaKeys.indexOf('CCU') >= 0));

  /* ---- access ---- */
  const viewer = user('viewer', { kpi: ['view'] });
  const clerk = user('clerk', { kpi: ['view', 'add'] });
  const manager = user('mgr', { kpi: ['view', 'add', 'edit', 'print'] });
  const outsider = user('out', { quality: ['view', 'edit'] });
  assert.equal(access.can(outsider, 'kpi', 'view'), false, 'not implied by Quality');
  assert.equal((await call('GET /api/kpi/meta', outsider)).status, 403);
  let r = await call('GET /api/kpi/meta', viewer);
  assert.equal(r.status, 200);
  assert.equal(r.body.lastClosed, '2026-10');
  assert.deepEqual([r.body.canAdd, r.body.canEdit, r.body.canPrint, r.body.isAdmin], [false, false, false, false]);
  r = await call('GET /api/kpi/defs', viewer);
  assert.equal(r.body.defs.length, 17, 'seeded from the deck on first open');
  assert.equal(r.body.defs[0].id, 'kpi-hand-hygiene');

  /* ---- figures: system values, typed values, edits and reverts ---- */
  r = await call('GET /api/kpi/values', viewer, { query: { from: '2026-09', to: '2026-10' } });
  assert.equal(r.body.values['kpi-clabsi']['2026-10'].value, 2.67);
  assert.equal(r.body.values['kpi-clabsi']['2026-10'].source, 'pooled');
  assert.equal(r.body.values['kpi-turnover']['2026-10'].source, 'missing');
  const put = (a, id, ym, b) => call('PUT /api/kpi/values/:kpi/:month', a, { params: { kpi: id, month: ym }, body: b });
  assert.equal((await put(viewer, 'kpi-turnover', '2026-10', { num: 2, den: 100 })).status, 403, 'view only cannot enter');
  assert.equal((await put(clerk, 'kpi-turnover', '2026-12', { num: 2, den: 100 })).status, 400, 'no future months');
  assert.equal((await put(clerk, 'kpi-turnover', '2026-10', { num: 2 })).status, 400, 'denominator required');
  r = await put(clerk, 'kpi-turnover', '2026-10', { num: 3, den: 100, note: 'HR list' });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.cell.value, r.body.cell.source], [3, 'manual']);
  assert.equal(logged.pop().action, 'kpi_value');
  const v1 = r.body.cell.savedAt;
  assert.equal((await put(clerk, 'kpi-turnover', '2026-10', { num: 2, den: 100, baseUpdatedAt: v1 })).status, 403, 'changing a saved figure needs Edit');
  assert.equal((await put(manager, 'kpi-turnover', '2026-10', { num: 2, den: 100, baseUpdatedAt: v1 - 5 })).status, 409, 'stale save refused');
  r = await put(manager, 'kpi-turnover', '2026-10', { num: 2, den: 100, baseUpdatedAt: v1 });
  assert.equal(r.body.cell.value, 2);
  // Editing a system figure keeps the system figure beside it; removing the edit reverts.
  r = await put(manager, 'kpi-clabsi', '2026-10', { num: 1, den: 750, note: 'one case reclassified' });
  assert.deepEqual([r.body.cell.value, r.body.cell.source, r.body.cell.auto.value], [1.33, 'edited', 2.67]);
  assert.match(logged.pop().opts.detail, /system figure 2\.67/);
  r = await call('DELETE /api/kpi/values/:kpi/:month', clerk, { params: { kpi: 'kpi-clabsi', month: '2026-10' } });
  assert.equal(r.status, 403, 'Add alone cannot revert');
  r = await call('DELETE /api/kpi/values/:kpi/:month', manager, { params: { kpi: 'kpi-clabsi', month: '2026-10' } });
  assert.deepEqual([r.body.cell.value, r.body.cell.source], [2.67, 'pooled'], 'reverted to the system figure');
  assert.ok(kpi._mem.kpiMonths.get('kpi-clabsi:2026-10').removedAt, 'the edit is kept in history, not deleted');

  /* ---- definitions ---- */
  assert.equal((await call('POST /api/kpi/defs', clerk, { body: { name: '' } })).status, 400);
  r = await call('POST /api/kpi/defs', clerk, { body: { name: 'IV Cannula Phlebitis', pillar: 'safety', unit: '%', formula: 'pct', goalDirection: 'lower_is_better', targets: [{ cycle: 1, value: 2 }, { cycle: 9, value: 1 }], actions: [{ text: 'VIP score each shift' }] } });
  assert.equal(r.status, 200);
  const custom = r.body.def;
  assert.equal(custom.id, 'kpi-c-iv-cannula-phlebitis');
  assert.deepEqual(custom.targets, [{ cycle: 1, value: 2 }], 'out-of-range cycle dropped');
  assert.equal((await call('PUT /api/kpi/defs/:id', clerk, { params: { id: custom.id }, body: { name: 'x' } })).status, 403, 'editing needs Edit');
  r = await call('PUT /api/kpi/defs/:id', manager, { params: { id: custom.id }, body: { baseUpdatedAt: custom.updatedAt, actions: [{ id: custom.actions[0].id, text: 'VIP score each shift', owner: 'IC Nurse', due: '2026-12', status: 'progress' }] } });
  assert.equal(r.status, 200);
  assert.equal(r.body.def.actions[0].status, 'progress');
  assert.equal(r.body.def.name, 'IV Cannula Phlebitis', 'fields not sent are kept');
  assert.equal((await call('PUT /api/kpi/defs/:id', manager, { params: { id: custom.id }, body: { baseUpdatedAt: custom.updatedAt, name: 'y' } })).status, 409, 'stale edit refused');
  assert.equal((await call('DELETE /api/kpi/defs/:id', manager, { params: { id: custom.id } })).status, 403, 'archiving needs Delete');
  assert.equal((await call('DELETE /api/kpi/defs/:id', admin, { params: { id: custom.id } })).status, 200);
  assert.equal((await call('GET /api/kpi/defs', viewer)).body.defs.length, 17, 'archived KPI off the list');
  assert.equal((await call('GET /api/kpi/defs', manager, { query: { all: '1' } })).body.defs.length, 18, 'still there for managers');
  // disable / enable: stays on Manage KPIs (all=1) but leaves everything that counts
  assert.equal((await call('POST /api/kpi/defs/:id/enabled', clerk, { params: { id: 'kpi-ssi' }, body: { enabled: false } })).status, 403, 'disabling needs Edit');
  assert.equal((await call('POST /api/kpi/defs/:id/enabled', manager, { params: { id: 'kpi-ssi' }, body: {} })).status, 400);
  r = await call('POST /api/kpi/defs/:id/enabled', manager, { params: { id: 'kpi-ssi' }, body: { enabled: false } });
  assert.equal(r.status, 200); assert.equal(r.body.def.disabled, true);
  assert.equal((await call('GET /api/kpi/defs', viewer)).body.defs.length, 16, 'disabled KPI not counted');
  assert.ok((await call('GET /api/kpi/defs', manager, { query: { all: '1' } })).body.defs.find((d) => d.id === 'kpi-ssi').disabled, 'still on Manage KPIs');
  assert.ok(!(await call('GET /api/kpi/report/:id', viewer, { params: { id: '2026-10_2026-10' } })).body.report.rows.some((x) => x.kpiId === 'kpi-ssi'), 'not in a new report');
  assert.equal((await call('PUT /api/kpi/values/:kpi/:month', manager, { params: { kpi: 'kpi-ssi', month: '2026-10' }, body: { num: 0, den: 10 } })).body.code, 'disabled', 'no figures for a disabled KPI');
  assert.equal((await call('DELETE /api/kpi/defs/:id', admin, { params: { id: 'kpi-ssi' } })).status, 200, 'a disabled KPI can still be archived');
  assert.equal((await call('POST /api/kpi/defs/:id/enabled', manager, { params: { id: 'kpi-ssi' }, body: { enabled: true } })).status, 404, 'archived: restore first');
  assert.equal((await call('POST /api/kpi/defs/:id/restore', manager, { params: { id: 'kpi-ssi' } })).status, 200);
  r = await call('POST /api/kpi/defs/:id/enabled', manager, { params: { id: 'kpi-ssi' }, body: { enabled: true } });
  assert.equal(r.status, 200); assert.equal(r.body.def.disabled, false);
  assert.equal((await call('GET /api/kpi/defs', viewer)).body.defs.length, 17, 'back in');
  assert.equal((await call('POST /api/kpi/seed', manager)).status, 403, 'restoring the deck is admin-only');
  assert.equal((await call('POST /api/kpi/seed', admin)).body.added, 0, 'nothing missing');

  /* ---- reports ---- */
  assert.equal((await call('POST /api/kpi/report', viewer, { body: { from: '2026-10', to: '2026-10' } })).status, 403);
  assert.equal((await call('POST /api/kpi/report', manager, { body: { from: '2026-10', to: '2027-01' } })).status, 400, 'cannot end in the future');
  r = await call('GET /api/kpi/report/:id', viewer, { params: { id: '2026-08_2026-10' } });
  assert.equal(r.body.report.state, 'preview');
  assert.deepEqual(r.body.report.months, ['2026-08', '2026-09', '2026-10']);
  const rowOf = (rep, id) => rep.rows.find((x) => x.kpiId === id);
  assert.equal(rowOf(r.body.report, 'kpi-clabsi').period.value, 1.74, 'three months pooled: 2 / 1150');
  assert.equal(rowOf(r.body.report, 'kpi-clabsi').status, 'off', 'zero target');
  assert.equal(rowOf(r.body.report, 'kpi-hand-hygiene').status, 'near', '70% against 75%: 5 short, inside the 7.5 (10%) band');
  r = await call('POST /api/kpi/report', manager, { body: { from: '2026-10', to: '2026-10' } });
  assert.equal(r.body.report.state, 'draft');
  r = await call('PUT /api/kpi/report/:id', manager, { params: { id: '2026-10_2026-10' }, body: { commentary: { 'kpi-clabsi': 'Two cases, both in ICU.' }, overall: 'Steady month.', signoff: { prepared: 'Nurse Manager' } } });
  assert.equal(r.status, 200);
  // A figure changed after the draft shows in the draft (it is live) …
  await put(manager, 'kpi-turnover', '2026-10', { num: 4, den: 100, baseUpdatedAt: kpi._mem.kpiMonths.get('kpi-turnover:2026-10').updatedAt });
  r = await call('GET /api/kpi/report/:id', viewer, { params: { id: '2026-10_2026-10' } });
  assert.equal(rowOf(r.body.report, 'kpi-turnover').period.value, 4);
  assert.equal(r.body.report.commentary['kpi-clabsi'], 'Two cases, both in ICU.');
  // … until it is final.
  assert.equal((await call('POST /api/kpi/report/:id/finalize', clerk, { params: { id: '2026-10_2026-10' } })).status, 403);
  // Zero tolerance: open data errors block Finalise …
  r = await call('POST /api/kpi/report/:id/finalize', manager, { params: { id: '2026-10_2026-10' } });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'checks');
  const open = r.body.unresolved;
  assert.ok(open.find((x) => x.kpiId === 'kpi-clabsi' && x.code === 'unit-missing' && x.unit === 'CCU'), 'CCU did not report CLABSI');
  assert.ok(open.find((x) => x.kpiId === 'kpi-clabsi' && x.code === 'dd-mismatch' && x.unit === 'MICU'), 'MICU 500 vs 480 device days');
  assert.ok(open.find((x) => x.kpiId === 'kpi-documentation' && x.code === 'no-data'), 'documentation not entered');
  // … an acknowledgement needs a real reason …
  const ack = (x, reason) => call('PUT /api/kpi/report/:id/ack', manager, { params: { id: '2026-10_2026-10' }, body: { kpiId: x.kpiId, ym: x.ym, code: x.code, unit: x.unit, reason } });
  assert.equal((await ack(open[0], 'ok')).status, 400, 'reason too short');
  assert.equal((await call('PUT /api/kpi/report/:id/ack', clerk, { params: { id: '2026-10_2026-10' }, body: Object.assign({ reason: 'Checked with the unit in charge.' }, open[0]) })).status, 403, 'acknowledging needs Edit');
  for (const x of open) assert.equal((await ack(x, 'Checked with the unit in charge — figure confirmed.')).status, 200);
  assert.equal(logged.pop().action, 'kpi_ack');
  // … then it finalises, with the acknowledgements on the record.
  r = await call('POST /api/kpi/report/:id/finalize', manager, { params: { id: '2026-10_2026-10' } });
  assert.equal(r.body.report.state, 'final');
  assert.equal(r.body.report.acks.length, open.length, 'every acknowledgement kept');
  assert.match(r.body.report.dataFingerprint, /^sha256:[0-9a-f]{64}$/);
  assert.match(logged.pop().opts.detail, /acknowledged: /);
  await put(manager, 'kpi-turnover', '2026-10', { num: 9, den: 100, baseUpdatedAt: kpi._mem.kpiMonths.get('kpi-turnover:2026-10').updatedAt });
  r = await call('GET /api/kpi/report/:id', viewer, { params: { id: '2026-10_2026-10' } });
  assert.equal(rowOf(r.body.report, 'kpi-turnover').period.value, 4, 'a final report is frozen');
  assert.equal((await call('PUT /api/kpi/report/:id', manager, { params: { id: '2026-10_2026-10' }, body: { overall: 'x' } })).status, 409, 'final cannot be edited');
  assert.equal((await call('POST /api/kpi/report/:id/reopen', manager, { params: { id: '2026-10_2026-10' } })).status, 403, 're-open is admin-only');
  // The source data moved after finalising: the final report says so (and still shows its own figures).
  r = await call('GET /api/kpi/report/:id', viewer, { params: { id: '2026-10_2026-10' }, query: { calc: '1' } });
  assert.deepEqual(r.body.report.changedSince, [{ kpiId: 'kpi-turnover', ym: '2026-10' }], 'turnover changed to 9 after finalising');
  assert.equal((await call('POST /api/kpi/report/:id/reopen', admin, { params: { id: '2026-10_2026-10' } })).status, 200);
  assert.equal(logged.pop().action, 'kpi_report_reopen');
  // Re-finalising after the change: the turnover acknowledgement no longer matches its data.
  r = await call('POST /api/kpi/report/:id/finalize', manager, { params: { id: '2026-10_2026-10' } });
  assert.equal(r.status, 200, 'turnover now has data, so nothing new is open');

  /* ---- evidence: how a figure was calculated ---- */
  const evOf = async (kpiId, ym) => (await call('GET /api/kpi/evidence/:kpi/:month', viewer, { params: { kpi: kpiId, month: ym } })).body;
  let ev = (await evOf('kpi-clabsi', '2026-10')).evidence;
  const unitOf = (k) => ev.units.find((u) => u.key === k);
  assert.deepEqual([unitOf('MICU').num, unitOf('MICU').den, unitOf('MICU').used], [1, 500, true]);
  assert.equal(unitOf('MICU').submission.by, 'Nurse Rina', 'the newest approval before the stamp, not the older one');
  assert.equal(unitOf('MICU').submission.reviewedBy, 'Admin Karim');
  assert.equal(unitOf('MICU').submission.how, 'approval');
  assert.deepEqual(unitOf('MICU').deviceDays && [unitOf('MICU').deviceDays.field, unitOf('MICU').deviceDays.approved], ['central', 480]);
  assert.equal(unitOf('CCU').source, 'missing');
  assert.equal(unitOf('CCU').expected, true);
  const codes = (u) => ev.checks.filter((c) => c.unit === u).map((c) => c.code).sort();
  assert.deepEqual(codes('MICU'), ['dd-mismatch']);
  assert.deepEqual(codes('SICU'), ['pending-newer', 'sub-unmatched'], 'a newer figure waits; the approved one has no traceable submission');
  assert.deepEqual(codes('CCU'), ['unit-missing']);
  assert.deepEqual([ev.totals.num, ev.totals.den, ev.totals.value], [2, 750, 2.67]);
  const steps = K.evidenceSteps(K.KPI || { formula: 'rate1000', numLabel: 'CLABSIs', denLabel: 'Central line-days' }, ev);
  assert.ok(steps.some((s) => s === '2 ÷ 750 × 1000 = 2.67.'), 'the calculation in words');
  // "Not measured" in Department Setup: CCU is no longer expected.
  SETTINGS = SETTINGS.map((s) => (s.id === 'ccu' ? { id: 'ccu', qualityKey: 'CCU', collection: { notMeasured: { [CLABSI]: { reason: 'No central lines' } } } } : s));
  ev = (await evOf('kpi-clabsi', '2026-10')).evidence;
  assert.ok(!ev.checks.some((c) => c.code === 'unit-missing'), 'not measured = not missing');
  // A start month in Department Setup after October: not owed yet either.
  SETTINGS = SETTINGS.map((s) => (s.id === 'ccu' ? { id: 'ccu', qualityKey: 'CCU', collection: { startMonth: 'Dec-26' } } : s));
  ev = (await evOf('kpi-clabsi', '2026-10')).evidence;
  assert.ok(!ev.checks.some((c) => c.code === 'unit-missing'), 'before the unit’s start month');
  SETTINGS = SETTINGS.map((s) => (s.id === 'ccu' ? { id: 'ccu', qualityKey: 'CCU', collection: {} } : s));
  // A Quality-console edit that won over the approval: shown, with the editor's name.
  OVERLAY = { depts: { MICU: { indPatches: { [CLABSI]: { mNum: { 'Oct-26': 2 }, mEditedAt: { 'Oct-26': 6000 }, mEditedBy: { 'Oct-26': 'Quality Admin' } } } } } };
  ev = (await evOf('kpi-clabsi', '2026-10')).evidence;
  assert.equal(unitOf('MICU').source, 'overlay-edit');
  assert.equal(unitOf('MICU').overlayEdited.by, 'Quality Admin');
  assert.ok(ev.checks.some((c) => c.code === 'overlay-edit' && c.unit === 'MICU'));
  OVERLAY = {};
  // "Units expected" set by hand and different from Department Setup → a drift warning.
  let defNow = (await call('GET /api/kpi/defs', manager, { query: { all: '1' } })).body.defs.find((d) => d.id === 'kpi-clabsi');
  r = await call('PUT /api/kpi/defs/:id', manager, { params: { id: 'kpi-clabsi' }, body: { baseUpdatedAt: defNow.updatedAt, units: ['MICU', 'SICU'] } });
  assert.deepEqual(r.body.def.units, ['MICU', 'SICU']);
  ev = (await evOf('kpi-clabsi', '2026-10')).evidence;
  assert.ok(!ev.checks.some((c) => c.code === 'unit-missing'), 'CCU is not on this KPI’s list');
  assert.ok(ev.checks.some((c) => c.code === 'setup-drift' && /Coronary Care Unit/.test(c.text)), 'Department Setup still expects CCU');
  r = await call('GET /api/kpi/units', manager, { query: { kpi: 'kpi-clabsi', month: '2026-10' } });
  assert.deepEqual(r.body.units.map((u) => u.key).sort(), ['CCU', 'MICU', 'SICU'], 'what Department Setup says');

  /* ---- entry safety ---- */
  assert.equal((await put(manager, 'kpi-documentation', '2026-09', { num: 20.5, den: 40 })).body.code, 'invalid', 'a count must be whole');
  r = await put(manager, 'kpi-clabsi', '2026-09', { num: 0, den: 400 });
  assert.equal(r.body.code, 'note', 'changing the system figure needs a reason');
  for (const m of ['2026-06', '2026-07', '2026-08']) await put(manager, 'kpi-documentation', m, { num: 30, den: 40 });
  r = await put(manager, 'kpi-documentation', '2026-09', { num: 4, den: 40 });
  assert.equal(r.body.code, 'confirm', '10% after three months of 75% is asked about');
  r = await put(manager, 'kpi-documentation', '2026-09', { num: 4, den: 40, confirm: true });
  assert.equal(r.status, 200);
  assert.equal(kpi._mem.kpiMonths.get('kpi-documentation:2026-09').confirmed, true);

  /* ---- a year report, and a year in Data Update with months still to come ---- */
  r = await call('GET /api/kpi/report/:id', viewer, { params: { id: '2026-01_2026-12' } });
  assert.equal(r.body.report.preset, 'year');
  assert.equal(r.body.report.months.length, 12);
  r = await call('GET /api/kpi/values', viewer, { query: { from: '2026-01', to: '2026-12', checks: '1' } });
  assert.ok(Object.keys(r.body.checks).every((k) => !r.body.checks[k]['2026-12'] && !r.body.checks[k]['2026-11']), 'November (still running) and December owe nothing yet');
  assert.ok(Object.keys(r.body.checks).some((k) => r.body.checks[k]['2026-10']), 'October, which has ended, is checked');

  /* ---- auto-fill off ---- */
  defNow = (await call('GET /api/kpi/defs', manager, { query: { all: '1' } })).body.defs.find((d) => d.id === 'kpi-hand-hygiene');
  await call('PUT /api/kpi/defs/:id', manager, { params: { id: 'kpi-hand-hygiene' }, body: { baseUpdatedAt: defNow.updatedAt, autoFill: false } });
  r = await call('GET /api/kpi/values', viewer, { query: { from: '2026-10', to: '2026-10' } });
  assert.equal(r.body.values['kpi-hand-hygiene']['2026-10'].source, 'missing', 'not filled by itself');
  assert.equal(r.body.values['kpi-hand-hygiene']['2026-10'].hint.value, 70, 'the system figure is offered as a hint');
  r = await put(manager, 'kpi-hand-hygiene', '2026-10', { num: 72, den: 100 });
  assert.equal(r.status, 200, 'no reason needed: nothing is being overridden');
  assert.equal(r.body.cell.source, 'manual');

  /* ---- start month, per KPI ---- */
  defNow = (await call('GET /api/kpi/defs', manager, { query: { all: '1' } })).body.defs.find((d) => d.id === 'kpi-turnover');
  r = await call('PUT /api/kpi/defs/:id', manager, { params: { id: 'kpi-turnover' }, body: { baseUpdatedAt: defNow.updatedAt, startMonth: '2026-12' } });
  assert.equal(r.body.def.startMonth, '2026-12');
  r = await call('GET /api/kpi/report/:id', viewer, { params: { id: '2026-08_2026-10' } });
  assert.equal(rowOf(r.body.report, 'kpi-turnover').status, 'notstarted');
  assert.equal(rowOf(r.body.report, 'kpi-turnover').cells['2026-10'].source, 'not-started');
  assert.equal(r.body.report.summary.notstarted, 1);
  r = await call('GET /api/kpi/missing', manager, { query: { month: '2026-10' } });
  assert.ok(!r.body.missing.find((x) => x.id === 'kpi-turnover'), 'not owed before it starts');
  assert.ok(!(await evOf('kpi-turnover', '2026-10')).evidence.checks.length, 'no checks before the start');

  /* ---- the monthly auto-draft ---- */
  assert.equal((await kpi.ensureDraft('2026-09', 'vercel-cron', { now })).created, '2026-09_2026-09');
  assert.equal((await kpi.ensureDraft('2026-09', 'vercel-cron', { now })).skipped, 'exists', 'once per month');
  r = await call('GET /api/kpi/reports', manager);
  assert.ok(r.body.reports.find((x) => x.id === '2026-09_2026-09' && x.generatedBy === 'Prepared automatically'));
  r = await call('GET /api/kpi/missing', manager, { query: { month: '2026-10' } });
  assert.ok(r.body.missing.find((x) => x.id === 'kpi-documentation'), 'documentation not entered for October');
  assert.ok(!r.body.missing.find((x) => x.id === 'kpi-clabsi'), 'CLABSI came from the quality data');
  assert.equal(r.body.reportReady, false, 'October was re-finalised above, so nothing waits');
  assert.equal((await call('GET /api/kpi/missing', viewer, { query: { month: '2026-10' } })).body.total, 0, 'no badge for view-only');

  /* ---- exports ---- */
  assert.equal((await call('GET /api/kpi/report/:id/pptx', viewer, { params: { id: '2026-10_2026-10' } })).status, 403, 'export needs Print');
  for (const style of ['full', 'summary']) {
    r = await call('GET /api/kpi/report/:id/pptx', manager, { params: { id: '2026-08_2026-10' }, query: { style } });
    assert.equal(r.status, 200, style + ' deck builds');
    assert.ok(Buffer.isBuffer(r.body) && r.body.slice(0, 2).toString() === 'PK', 'a zip (pptx)');
    assert.deepEqual(r.order.slice(-1), ['end']);
    assert.match(r.headers['Content-Disposition'], new RegExp('Nursing-KPI-2026-08-to-2026-10-' + style + '\\.pptx'));
    assert.equal(logged.pop().action, 'kpi_export', 'logged before the file is built');
  }
  r = await call('GET /api/kpi/report/:id/xlsx', manager, { params: { id: '2026-10_2026-10' } });
  assert.ok(Buffer.isBuffer(r.body) && r.body.slice(0, 2).toString() === 'PK', 'a zip (xlsx)');
  // the workbook carries the calculation and the data checks
  {
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(r.body);
    assert.deepEqual(wb.worksheets.map((w) => w.name), ['Scorecard', 'Monthly figures', 'Action plans', 'Commentary', 'Calculation', 'Data checks']);
    const calc = wb.getWorksheet('Calculation');
    let micu = null; calc.eachRow((row) => { if (row.getCell(2).value === 'Central Line-Associated Bloodstream Infection (CLABSI)' && row.getCell(4).value === 'Medical ICU') micu = row; });
    assert.ok(micu, 'one row per unit');
    assert.equal(micu.getCell(11).value, 'Nurse Rina', 'submitted by');
    assert.equal(micu.getCell(13).value, 'Admin Karim', 'approved by');
  }
  r = await call('GET /api/kpi/report/:id/pptx', manager, { params: { id: '2026-08_2026-10' }, query: { style: 'calc' } });
  assert.equal(r.status, 200, 'deck with calculations builds');
  assert.match(r.headers['Content-Disposition'], /-calc\.pptx/);
  logged.pop();
  assert.equal((await call('POST /api/kpi/print', manager, { body: { id: '2026-10_2026-10', kind: 'pdf' } })).status, 200);
  assert.equal(logged.pop().action, 'kpi_print');

  /* ---- settings ---- */
  assert.equal((await call('PUT /api/kpi/config', manager, { body: { cycleStart: '2026-10' } })).status, 403);
  assert.equal((await call('PUT /api/kpi/config', admin, { body: { cycleStart: 'Oct' } })).status, 400);
  r = await call('PUT /api/kpi/config', admin, { body: { cycleStart: '2026-10', pillars: [{ id: 'safety', label: 'Safety', color: '#00293A' }, { label: 'Infection Control' }] } });
  assert.equal(r.body.config.cycleStart, '2026-10');
  assert.deepEqual(r.body.config.pillars.map((p) => p.id), ['safety', 'infection-control']);

  console.log('Nursing KPI checks passed.');
})().catch((e) => { console.error(e); process.exit(1); });
