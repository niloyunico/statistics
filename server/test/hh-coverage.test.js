/* Hand hygiene "Overall hospital" entry: the departments a hospital audit covered.
   No database or network: the departments collection is an in-memory stub.
   Run: node test/hh-coverage.test.js */
const assert = require('node:assert/strict');
const HH = require('../../renderer/unico/hh-pool.js');

const hhInd = () => ({ id: 'ind-hand-hygiene-compliance', name: 'Hand Hygiene Compliance (Hospital)', formula: 'pct', months: { 'Apr-26': 79 } });
const departments = [
  { _id: '__hospital__', id: '__hospital__', name: 'Overall Hospital', quality: { key: 'Overall Hospital', name: 'Overall Hospital', indicators: [hhInd()] } },
  { _id: 'cathlab', id: 'cathlab', name: 'Cath Lab', quality: { key: 'Cathlab', name: 'Cath Lab', indicators: [{ id: 'ind-hand-hygiene-compliance', name: 'Hand Hygiene Compliance', formula: 'pct' }] } },
  { _id: 'micu', id: 'micu', name: 'Medical ICU', quality: { key: 'MICU', name: 'Medical ICU', indicators: [{ id: 'ind-hand-hygiene-compliance', name: 'Hand Hygiene Compliance', formula: 'pct' }] } },
];
const dbPath = require.resolve('../db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {
  getDbHandle: async () => ({ collection: () => ({
    findOne: async (q) => departments.find((d) => d.quality.key === q['quality.key']) || null,
    find: () => ({ toArray: async () => departments }),
  }) }),
} };
const DC = require('../data-collection');

let pass = 0;
const t = async (name, fn) => { await fn(); pass++; console.log('  ok', name); };
const base = { area: 'Overall Hospital', month: 'Oct-26', indicatorId: 'ind-hand-hygiene-compliance', formula: 'pct', entryMode: 'rate', mult: 100, value: undefined, num: 30, den: 40,
  groups: { nurse: 20, doctor: 10 }, groupsDen: { nurse: 25, doctor: 15 } };

(async () => {
  await t('an overall-hospital audit carries the ticked departments', async () => {
    const spec = await DC.buildQualitySpec({ ...base, coveredDepts: ['Cathlab', 'MICU', 'MICU', ' '] });
    assert.deepEqual(spec.coveredDepts, ['Cathlab', 'MICU']);
    assert.equal(spec.value, 75);
  });
  await t('an unknown department, or the hospital itself, is refused', async () => {
    await assert.rejects(DC.buildQualitySpec({ ...base, coveredDepts: ['Nowhere'] }), /Unknown department/);
    await assert.rejects(DC.buildQualitySpec({ ...base, coveredDepts: ['Overall Hospital'] }), /Unknown department/);
  });
  await t('coverage is only for the hospital hand hygiene audit', async () => {
    await assert.rejects(DC.buildQualitySpec({ ...base, area: 'Cathlab', coveredDepts: ['MICU'] }), /hospital hand hygiene audit/);
  });
  await t('a not-observed month carries no coverage', async () => {
    const spec = await DC.buildQualitySpec({ ...base, notObserved: true, coveredDepts: ['Cathlab'] });
    assert.equal(spec.coveredDepts, null);
  });

  await t('approval stores mCovered and replaces that month\'s department breakdown', () => {
    const orig = Object.assign(hhInd(), { mDeptBreakdown: { 'Oct-26': [{ dept: 'Cath Lab', g: { nurse: { n: 1, d: 2 } } }], 'Sep-26': [{ dept: 'Cath Lab', g: { nurse: { n: 3, d: 4 } } }] } });
    const ind = DC.mergeQuality(orig, { month: 'Oct-26', entryMode: 'rate', mult: 100, num: 30, den: 40, groups: { nurse: 20 }, groupsDen: { nurse: 25 }, coveredDepts: ['Cathlab'] });
    assert.deepEqual(ind.mCovered['Oct-26'], ['Cathlab']);
    assert.equal(ind.mDeptBreakdown['Oct-26'], undefined);
    assert.ok(ind.mDeptBreakdown['Sep-26'], 'other months untouched');
    assert.equal(ind.mNum['Oct-26'], 30);
    const back = DC.mergeQuality(ind, { month: 'Oct-26', entryMode: 'rate', mult: 100, num: 1, den: 2, deptBreakdown: [{ dept: 'Cath Lab', g: { nurse: { n: 1, d: 2 } } }] });
    assert.equal(back.mCovered['Oct-26'], undefined);
    const nob = DC.mergeQuality(ind, { month: 'Oct-26', notObserved: true });
    assert.equal(nob.mCovered['Oct-26'], undefined);
  });

  await t('the pending cover list matches the hospital indicator and reads ticked departments', () => {
    const cover = DC.hhAuditCover([
      { type: 'quality', status: 'pending', month: 'Oct-26', indicatorName: 'Hand Hygiene Compliance (Hospital)', coveredDepts: ['Cathlab'] },
      { type: 'quality', status: 'pending', month: 'Sep-26', indicatorName: 'Hand Hygiene Compliance (Hospital)', deptBreakdown: [{ dept: 'Medical ICU', g: { nurse: { n: 1, d: 2 } } }, { dept: 'Cath Lab', g: {} }] },
      { type: 'quality', status: 'approved', month: 'Aug-26', indicatorName: 'Hand Hygiene Compliance (Hospital)', coveredDepts: ['Cathlab'] },
    ]);
    assert.deepEqual(cover.find((c) => c.month === 'Oct-26'), { month: 'Oct-26', depts: ['Cathlab'], state: 'pending' });
    assert.deepEqual(cover.find((c) => c.month === 'Sep-26').depts, ['Medical ICU']);
    assert.equal(cover.find((c) => c.month === 'Aug-26'), undefined);
  });

  await t('the admin coverage edit sets an existing month only, figures untouched', async () => {
    departments[0].quality.indicators = [hhInd()];
    await assert.rejects(DC.setHandHygieneCoverage('May-26', ['Cathlab']), /No hospital hand hygiene figure/);
  });

  await t('shared rule: covered departments without figures never enter the totals', () => {
    const areas = departments.map((d) => Object.assign({ deptId: d.id }, d.quality));
    const src = Object.assign(hhInd(), { mNum: { 'Oct-26': 30 }, mDen: { 'Oct-26': 40 }, mCovered: { 'Oct-26': ['Cathlab', 'MICU'] } });
    areas[0] = Object.assign({}, areas[0], { indicators: [src] });
    assert.deepEqual([...HH.coveredKeys(src, 'Oct-26', areas)].sort(), ['Cathlab', 'MICU']);
    const res = HH.build(areas, ['Oct-26']);
    assert.equal(res.months[0].n, 30);
    assert.equal(res.months[0].d, 40);
    assert.deepEqual(res.months[0].coveredKeys.sort(), ['Cathlab', 'MICU']);
    assert.equal(res.rows.find((r) => r.deptKey === 'Cathlab').cells['Oct-26'].src, 'covered');
    assert.equal(res.total.d, 40);
  });

  console.log('hh-coverage: ' + pass + ' checks passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
