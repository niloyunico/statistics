const assert = require('node:assert/strict');
const m = require('../monitor');

const register = (rows) => JSON.stringify(rows);
const before = {
  collections: { submissions: 540, users: 23, phoneMessages: 4 },
  staff: m.staffMetrics(register([
    { id: 1, name: 'Rahima', extracurricular: 'Singing', photo: { url: 'x' }, is_active: true },
    { id: 2, name: 'Karim', extracurricular: 'Dancing', licence_expiry: '2029-01-01', is_active: true },
    { id: 3, name: 'Sumi', is_active: false, former: true },
  ])),
  depts: m.deptMetrics([
    { _id: 'micu', name: 'Medical ICU', data: { 0: { a: 3, b: '' }, 1: { a: 0 } }, quality: { indicators: [{ months: { 'Jul-26': 0, 'Aug-26': 1.5 } }] } },
    { _id: 'ot', name: 'General OT', data: { 0: { a: 1 } } },
  ]),
  appdataBytes: { unico_store_v3: 50000, unico_quality_v2: 9000, unico_filter_v1: 300 },
  d1: { activity_log: 400 },
};

// Metrics
assert.equal(before.staff.rows, 3);
assert.equal(before.staff.active, 2);
assert.equal(before.staff.former, 1);
assert.deepEqual(before.staff.filled.extracurricular, ['1', '2']);
assert.deepEqual(before.staff.filled.photo, ['1']);
assert.deepEqual(before.depts.micu, { name: 'Medical ICU', rows: 2, cells: 2, readings: 2 }, 'a zero is a value, a blank is not');
assert.deepEqual(m.staffMetrics('{"not":"a list"}'), { error: 'The staff register is not a list.' });
assert.deepEqual(m.staffMetrics('not json'), { error: 'The staff register could not be read.' });

// Nothing changed -> nothing to report
assert.deepEqual(m.compare(before, before), []);
assert.deepEqual(m.compare(null, before), [], 'the first snapshot has nothing to compare with');

// Everything that should be caught
const after = {
  collections: { submissions: 535, users: 23, phoneMessages: 3 },
  staff: m.staffMetrics(register([
    { id: 1, name: 'Rahima', extracurricular: '', photo: { url: 'x' }, is_active: true },
    { id: 3, name: 'Sumi', is_active: false, former: true },
  ])),
  depts: m.deptMetrics([
    { _id: 'micu', name: 'Medical ICU', data: { 0: { a: 3 } }, quality: { indicators: [{ months: { 'Jul-26': 0 } }] } },
  ]),
  appdataBytes: { unico_store_v3: 30000, unico_quality_v2: 8800 },
  d1: { activity_log: 380 },
};
const f = m.compare(before, after);
const find = (re) => f.find((x) => re.test(x.message));
assert.equal(find(/^submissions: 5 record/).level, 'alert');
assert.equal(find(/^phoneMessages: 1 record/).level, 'notice', 'chat deletions are normal use');
assert.deepEqual(find(/staff record\(s\) removed/).details, ['Karim (#2)'], 'a removed person is named');
assert.deepEqual(find(/Extracurricular activities cleared/).details, ['Rahima (#1)'], 'a cleared field names who lost it');
assert(!find(/Licence expiry cleared/), 'a removed person is not double-reported as a cleared field');
assert(find(/Medical ICU: 1 monthly statistics value/));
assert(find(/Medical ICU: 1 quality reading/));
assert(find(/Department "General OT" is gone/));
assert(find(/shrank by 40%/), 'a large saved key losing 40% is caught');
assert(!f.some((x) => /unico_quality_v2|9000/.test(x.message)), 'a 2% shrink is normal editing');
assert(!f.some((x) => /unico_filter_v1/.test(x.message)), 'a tiny local key disappearing is not an alert');
assert(find(/activity_log: 20 row/));

// Configuration guard
assert.equal(m.configFindings({ MONGODB_URI: 'a' }).length, 0);
assert.equal(m.configFindings({ MONGODB_URIS: 'a,b' })[0].level, 'alert', 'failover coming back is an alert');
assert.equal(m.configFindings({ MONGODB_URIS: 'a' }).length, 0, 'a single entry is not failover');
assert.equal(m.configFindings({ UPSTASH_REDIS_REST_URL: 'x' })[0].level, 'notice');

// Browser events are validated
assert.equal(m.cleanEvent({ kind: 'hack' }), null);
assert.equal(m.cleanEvent(null), null);
const ev = m.cleanEvent({ kind: 'save_failed', detail: 'x'.repeat(900), keys: Array(30).fill('unico_store_v3'), page: '/#staff', at: Date.now() - 1000 });
assert.equal(ev.detail.length, 300);
assert.equal(ev.keys.length, 10);
assert(ev.happenedAt > 0);
assert.equal(m.cleanEvent({ kind: 'save_conflict', at: Date.now() + 864e5 }).happenedAt, null, 'a future time is ignored');

// Panel summary keeps per-person lists server-side
const s = m.summarize(Object.assign({ at: 1, findings: f, alerts: 3 }, after));
assert.equal(s.staff.filled.photo, 1);
assert.equal(s.statisticsValues, 1);
assert.equal(JSON.stringify(s).includes('"ids"'), false);

console.log('MONITOR_TEST_PASS: metrics, drop detection with names, notices vs alerts, config guard, event validation');
