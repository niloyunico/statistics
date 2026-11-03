/* Hand-hygiene pooling (renderer/unico/hh-pool.js) — the one rule the Hand Hygiene screen,
   /api/hand-hygiene and the Quality console's report share.
   Run: node test/hh-pool.test.js */
const assert = require('assert');
const HH = require('../../renderer/unico/hh-pool.js');

const g = (nurse, doctor, pca, other) => ({ nurse: { n: nurse[0], d: nurse[1] }, doctor: { n: doctor[0], d: doctor[1] }, pca: { n: pca[0], d: pca[1] }, other: { n: other[0], d: other[1] } });
const hospital = {
  key: 'Overall Hospital', name: 'Overall Hospital', deptId: '__hospital__',
  indicators: [{
    id: 'ind-hand-hygiene-compliance', name: 'Hand Hygiene Compliance (Hospital)', formula: 'pct', benchmarkValue: 80,
    months: { 'May-26': 68.4, 'Jun-26': 70, 'Jul-26': 75 },
    mNum: { 'Jun-26': 14, 'Jul-26': 15 }, mDen: { 'Jun-26': 20, 'Jul-26': 20 },
    mDeptBreakdown: {
      'Jun-26': [{ dept: 'Medical ICU', g: g([4, 5], [2, 3], [1, 1], [0, 1]) }, { dept: 'Emergency Medicine', g: g([3, 4], [2, 3], [1, 2], [1, 1]) }, { dept: 'Family Medicine', g: g([0, 0], [0, 0], [0, 0], [0, 0]) }],
      'Jul-26': [{ dept: 'Medical ICU', g: g([5, 6], [3, 4], [1, 2], [1, 1]) }, { dept: 'Emergency Medicine', g: g([2, 3], [1, 2], [1, 1], [1, 1]) }],
    },
  }],
};
// Department copies the client fills from the audit are TAGGED mFromAudit; Radiology's own
// reading for June is not in the audit at all.
const micu = { key: 'MICU', name: 'Medical ICU', indicators: [{ id: 'ind-hand-hygiene-compliance', name: 'Hand Hygiene Compliance', mNum: { 'Jun-26': 7, 'Jul-26': 10 }, mDen: { 'Jun-26': 10, 'Jul-26': 13 }, mFromAudit: { 'Jun-26': true, 'Jul-26': true } }] };
const er = { key: 'Emergency', name: 'Emergency Room', qualityName: 'Emergency Medicine', indicators: [{ id: 'ind-hand-hygiene-compliance', name: 'Hand Hygiene Compliance' }] };
const radiology = { key: 'Radiology', name: 'Radiology', indicators: [{ id: 'ind-hand-hygiene-compliance', name: 'Hand Hygiene Compliance', mNum: { 'Jun-26': 30 }, mDen: { 'Jun-26': 46 } }] };
const depts = [hospital, micu, er, radiology];
const months = ['May-26', 'Jun-26', 'Jul-26', 'Aug-26'];

let pass = 0; const t = (name, fn) => { fn(); pass++; console.log('  ok', name); };

t('hospital total = the audit, counted once', () => {
  const r = HH.build(depts, months);
  assert.equal(r.source.deptKey, 'Overall Hospital');
  const jun = r.months.find((x) => x.m === 'Jun-26');
  assert.deepEqual([jun.n, jun.d, jun.pct], [14, 20, 70], 'June audit only — the MICU copy is not added again');
  const jul = r.months.find((x) => x.m === 'Jul-26');
  assert.deepEqual([jul.n, jul.d], [15, 20]);
  assert.deepEqual([r.total.n, r.total.d, r.total.pct], [29, 40, 72.5], 'period pooled, not a mean of months');
});
t('a department reading the audit did not cover is added only in totalAll', () => {
  const r = HH.build(depts, months);
  const jun = r.months.find((x) => x.m === 'Jun-26');
  assert.deepEqual([jun.nAll, jun.dAll], [44, 66]);
  assert.equal(jun.selfReported, true);
  assert.deepEqual([r.totalAll.n, r.totalAll.d], [59, 86]);
  const rad = r.rows.find((x) => x.key === 'Radiology');
  assert.equal(rad.selfReported, true);
  assert.equal(rad.cells['Jun-26'].src, 'own');
});
t('audit rows match renamed departments; 0/0 rows are "not audited"', () => {
  const r = HH.build(depts, months);
  const erRow = r.rows.find((x) => x.key === 'Emergency');
  assert.ok(erRow, 'Emergency Medicine audit row lands on the Emergency Room area');
  assert.equal(erRow.name, 'Emergency Room');
  const fm = r.rows.find((x) => x.name === 'Family Medicine');
  assert.equal(fm.cells['Jun-26'].src, 'not-audited');
  assert.equal(fm.total.d, 0);
});
t('percentage-only months stay percentages, never invented counts', () => {
  const may = HH.build(depts, months).months.find((x) => x.m === 'May-26');
  assert.deepEqual([may.n, may.d, may.pct, may.pctOnly], [null, null, 68.4, true]);
});
t('staff groups pool across departments', () => {
  const r = HH.build(depts, months);
  const nurse = r.groups.find((x) => x.key === 'nurse');
  assert.deepEqual([nurse.total.n, nurse.total.d], [14, 18]);
  const sum = r.groups.reduce((a, x) => a + x.total.d, 0);
  assert.equal(sum, r.total.d, 'groups add up to the hospital total');
});
t('narrowed to chosen departments: their audit rows plus their own readings', () => {
  const r = HH.build(depts, months, { only: ['MICU', 'Radiology'] });
  assert.equal(r.restricted, true);
  const s = HH.series(r);
  const jun = s.find((x) => x.m === 'Jun-26');
  assert.deepEqual([jun.n, jun.d], [37, 56], 'MICU audit 7/10 + Radiology own 30/46');
  assert.equal(s.find((x) => x.m === 'May-26').pct, null, 'no hospital fallback inside a narrowed view');
  assert.deepEqual(r.rows.map((x) => x.key).sort(), ['MICU', 'Radiology']);
});
t('choosing Overall Hospital means the whole hospital', () => {
  const r = HH.build(depts, months, { only: ['Overall Hospital', 'MICU'] });
  assert.equal(r.restricted, false);
  assert.equal(r.total.d, 40);
});
t('status bands follow the target', () => {
  assert.equal(HH.status(80, 80).key, 'ok');
  assert.equal(HH.status(76, 80).key, 'warn');
  assert.equal(HH.status(70, 80).key, 'bad');
  assert.equal(HH.status(72, 70).key, 'ok');
  assert.equal(HH.status(69, 70).key, 'bad', 'a target at/under 75 has no middle band');
  assert.equal(HH.improveBand(80), '75–79%');
  assert.equal(HH.improveBand(70), null);
  assert.equal(HH.status(null, 80), null);
});
t('no audit on record → no source, nothing invented', () => {
  const r = HH.build([micu, radiology].map((d) => Object.assign({}, d)), months);
  assert.equal(r.source, null);
  assert.equal(r.months.find((x) => x.m === 'Jun-26').n, null);
  assert.equal(r.bench, 80, 'default hospital target');
});
console.log('hh-pool: ' + pass + ' passed');
