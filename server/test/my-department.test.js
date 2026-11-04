/* My Department: who may open it, what leaves the server, and that printing is its own,
   logged grant. Runs on fakes (no database): db, deptmap, the staff register, the activity log. */
const assert = require('node:assert/strict');

const DEPTS = [{ id: 'sicu', name: 'Surgical ICU', months: ['Jul-26', 'Aug-26'], data: [{ adm: 10 }, { adm: 7 }], cols: [{ id: 'adm', label: 'Admissions' }, { id: 'old', label: 'Old', hidden: true }], approvedAt: {} },
  { id: 'micu', name: 'Medical ICU', months: ['Jul-26'], data: [{ adm: 3 }], cols: [{ id: 'adm', label: 'Admissions' }] }];
const QUALITY = { sicu: { key: 'SICU', name: 'SICU', indicators: [{ id: 'ssi', name: 'Surgical Site Infection', formula: 'count', benchmarkValue: 0, goalDirection: 'lower_is_better', months: { 'Jul-26': 1 } }] } };
const ROSTERS = [
  { _id: 'r1', dept: 'Surgical ICU', year: 2026, month: 7, status: 'approved', grid: { E1: { 1: 'M1' } }, order: ['E1'], names: { E1: 'Nurse One' } },
  { _id: 'r2', dept: 'Surgical ICU', year: 2026, month: 8, status: 'draft', grid: { E1: { 1: 'N1' } }, order: ['E1'], names: { E1: 'Nurse One' } },
];
const STAFF = [
  { id: 1, emp_id: 'E1', name: 'Nurse One', designation: 'Staff Nurse', role: 'Nurse', doj: '2024-01-02', current_department: 'Surgical ICU', phone: '0170000', licence_no: 'L1', blood_group: 'O+', salary: 9, remarks: 'x', performance: { score: 3 } },
  { id: 2, emp_id: 'E2', name: 'Nurse Two', designation: 'Staff Nurse', role: 'Nurse', current_department: 'Medical ICU' },
  { id: 3, emp_id: 'E3', name: 'Gone', current_department: 'Surgical ICU', former: true },
];
let overlay = {};
const logged = [];

const fake = (rel, exports) => { const p = require.resolve(rel); require.cache[p] = { id: p, filename: p, loaded: true, exports }; };
const matches = (doc, q) => Object.keys(q).every((k) => (k === 'quality.key' ? doc.quality && doc.quality.key === q[k] : doc[k] === q[k]));
const collection = (name) => {
  const docs = name === 'dutyRosters' ? ROSTERS : name === 'departments' ? Object.values(QUALITY).map((quality) => ({ quality })) : [];
  return { findOne: async (q) => docs.find((d) => matches(d, q)) || null, find: (q) => ({ toArray: async () => docs.filter((d) => matches(d, q || {})) }) };
};
fake('../db', { getDbHandle: async () => ({ collection }), getUsers: async () => null, getDepartments: async () => DEPTS, getAppData: async () => ({ data: overlay }), getStaff: async () => STAFF });
fake('../deptmap', { get: async () => ({ byId: { sicu: { id: 'sicu', name: 'Surgical ICU', qualityKey: 'SICU' }, micu: { id: 'micu', name: 'Medical ICU', qualityKey: 'MICU' } } }) });
fake('../activity-log', { log: (req, action, opts) => logged.push({ action, opts }) });
fake('../staff-roster', { loadRoster: async () => STAFF });

const md = require('../my-department');
const access = require('../access');
const routes = {};
md.mount({ get: (p, g, h) => { routes['GET ' + p] = h; }, post: (p, g, h) => { routes['POST ' + p] = h; } }, { requireApi: [] });
async function call(route, a, { params = {}, query = {}, body = {} } = {}) {
  const out = { status: 200, body: null };
  const res = { status(c) { out.status = c; return res; }, json(b) { out.body = b; return res; }, set() { return res; } };
  await routes[route]({ params, query, body, access: a, user: a && { sub: a.username } }, res);
  return out;
}
const user = (perms, myDepartments) => ({ unrestricted: false, username: 'zakir', role: 'User', perms, myDepartments });

(async () => {
  // No module, no departments: nothing.
  assert.equal((await call('GET /api/my-department', user({}, ['sicu']))).status, 403, 'no grant -> refused');
  assert.equal((await call('GET /api/my-department/:dept', user({ stats: ['view'] }, ['sicu']), { params: { dept: 'sicu' } })).status, 403, 'other modules do not open it');
  const viewer = user({ mydept: ['view'] }, ['sicu']);
  assert.deepEqual((await call('GET /api/my-department', viewer)).body.departments, [{ id: 'sicu', name: 'Surgical ICU' }]);
  assert.equal((await call('GET /api/my-department/:dept', viewer, { params: { dept: 'micu' } })).status, 403, 'a department not picked for them');
  assert.equal(access.myDeptIds({ unrestricted: true }), null, 'an administrator opens every department');
  assert.deepEqual(access.myDeptIds(user({}, ['sicu'])), [], 'the list means nothing without the module');
  assert.equal(access.can(user({ stats: ['view'], staff: ['view', 'print'] }, ['sicu']), 'mydept', 'view'), false, 'not implied by other modules');

  // What they receive.
  overlay = { unico_store_v3: JSON.stringify({ entries: [{ dept: 'sicu', month: 'Sep-26', row: { adm: 4 }, ts: 1 }] }),
    unico_quality_v2: JSON.stringify({ depts: { SICU: { indPatches: { ssi: { months: { 'Aug-26': 2 } } } } } }) };
  const r = await call('GET /api/my-department/:dept', viewer, { params: { dept: 'sicu' }, query: { year: '2026', month: '7' } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.patient.cols.map((c) => c.id), ['adm'], 'hidden columns are not offered');
  assert.equal(r.body.patient.rows['Jul-26'].adm, 10);
  assert.equal(r.body.patient.rows['Sep-26'].adm, 4, 'a month the administrator typed in is shown');
  const ssi = r.body.quality.indicators[0];
  assert.equal(ssi.months['Jul-26'], 1); assert.equal(ssi.months['Aug-26'], 2, 'a Quality console month is shown');
  assert.equal(r.body.roster.names.E1, 'Nurse One', 'the approved roster');
  assert.equal((await call('GET /api/my-department/:dept', viewer, { params: { dept: 'sicu' }, query: { year: '2026', month: '8' } })).body.roster, null, 'a draft is never sent');
  assert.deepEqual(r.body.staff.map((s) => s.name), ['Nurse One'], 'current staff of this department only');
  const fields = Object.keys(r.body.staff[0]).sort();
  assert.deepEqual(fields, ['current_department', 'designation', 'doj', 'emp_id', 'id', 'name', 'role'], 'the thin staff record only');
  assert.ok(!/0170000|licence|blood|salary|performance/i.test(JSON.stringify(r.body)), 'no contact, licence, health, pay or performance data');
  assert.equal(r.body.canPrint, false);

  // Printing: its own grant, recorded before anything prints.
  assert.equal((await call('POST /api/my-department/print', viewer, { body: { dept: 'sicu', sections: ['staff'] } })).status, 403, 'view only -> no print');
  const printer = user({ mydept: ['view', 'print'] }, ['sicu']);
  assert.equal((await call('POST /api/my-department/print', printer, { body: { dept: 'micu', sections: ['staff'] } })).status, 403, 'only their own department');
  assert.equal((await call('POST /api/my-department/print', printer, { body: { dept: 'sicu', sections: [] } })).status, 400);
  const before = logged.length;
  assert.equal((await call('POST /api/my-department/print', printer, { body: { dept: 'sicu', year: 2026, month: 7, sections: ['patient', 'roster', 'bogus'] } })).status, 200);
  assert.equal(logged.length, before + 1); assert.equal(logged[before].action, 'mydept_print');
  assert.match(logged[before].opts.detail, /patient, roster/); assert.doesNotMatch(logged[before].opts.detail, /bogus/);

  console.log('My Department checks passed.');
})().catch((e) => { console.error(e); process.exitCode = 1; });
