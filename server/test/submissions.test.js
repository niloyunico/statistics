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
  for (const inputs of [{}, { num: '', den: '' }, { den: 400 }]) {
    await assert.rejects(buildQualitySpec({ ...quality, formula: 'pct', value: undefined, ...inputs }), /Enter the numerator/);
  }
  assert.equal((await buildQualitySpec({ ...quality, formula: 'pct', value: undefined, num: 0 })).value, 0);
  assert.equal((await buildQualitySpec({ ...quality, formula: 'pct', value: 12.5 })).value, 12.5);
  for (const invalid of [-1, Infinity, 'abc', true, ' ']) {
    await assert.rejects(buildQualitySpec({ ...quality, groups: { nurse: invalid } }), /finite, non-negative/);
    await assert.rejects(buildQualitySpec({ ...quality, groupsDen: { nurse: invalid } }), /finite, non-negative/);
    await assert.rejects(buildQualitySpec({ ...quality, deptBreakdown: [{ dept: 'ICU', g: { nurse: { n: 0, d: invalid } } }] }), /finite, non-negative/);
  }
  const blankGroups = await buildQualitySpec({ ...quality, groups: { nurse: '', doctor: 0 } });
  assert.deepEqual(blankGroups.groups, { nurse: 0, doctor: 0 });
  for (const field of ['age', 'gender', 'admissionDate', 'procedureDate']) {
    const incident = await buildQualitySpec({ ...quality, value: undefined, incidents: [{ [field]: 'test' }, { details: '  ' }] });
    assert.equal(incident.value, 1);
    assert.equal(incident.incidents.length, 1);
    assert.equal(incident.incidents[0][field], 'test');
  }
  await assert.rejects(buildQualitySpec({ ...quality, value: undefined, incidents: [{ unknownField: 'test' }] }), /Enter the value/);
  console.log('Submission validation regression checks passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
