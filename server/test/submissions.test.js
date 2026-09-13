// Isolated submission validation tests: no database or network writes.
const assert = require('node:assert/strict');
const dbPath = require.resolve('../db');
const department = { _id: 'icu', name: 'ICU', quality: { key: 'icu', name: 'ICU', indicators: [{ id: 'falls', name: 'Falls', formula: 'count' }] } };
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {
  getDbHandle: async () => ({ collection: () => ({ findOne: async () => department }) }),
} };
const { buildPatientSpec, buildQualitySpec } = require('../data-collection');

(async () => {
  const patient = { department: 'icu', month: 'Sep-26', values: { admissions: '0' } };
  const quality = { area: 'icu', month: 'Sep-26', indicatorId: 'falls', value: '0' };
  assert.deepEqual((await buildPatientSpec(patient)).values, { admissions: 0 });
  assert.equal((await buildQualitySpec(quality)).value, 0);
  for (const month of ['2026-09', 'Sep-2026', 'Q1', 'Bogus-26']) {
    await assert.rejects(buildPatientSpec({ ...patient, month }), /valid reporting month/);
    await assert.rejects(buildQualitySpec({ ...quality, month }), /valid reporting month/);
  }
  for (const value of ['abc', 'Infinity', Infinity, -1, ' ', true, [], {}]) {
    await assert.rejects(buildPatientSpec({ ...patient, values: { admissions: value } }), /finite, non-negative/);
    await assert.rejects(buildQualitySpec({ ...quality, value }), /finite, non-negative/);
  }
  await assert.rejects(buildPatientSpec({ ...patient, values: {} }), /at least one statistic/);
  await assert.rejects(buildPatientSpec({ ...patient, values: { admissions: '' } }), /at least one statistic/);
  const rate = await buildQualitySpec({ ...quality, formula: 'rate1000', value: undefined, num: 2, den: 400 });
  assert.equal(rate.value, 5);
  const unobserved = await buildQualitySpec({ ...quality, notObserved: true });
  assert.equal(unobserved.value, null);
  console.log('Submission validation regression checks passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
