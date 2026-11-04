/* Device Days: the due / missed rule for each frequency, who may enter, send, review and
   remove, the row checks, lost-update refusal and soft delete. Runs on fakes (no database). */
const assert = require('node:assert/strict');

const logged = [];
const fake = (rel, exports) => { const p = require.resolve(rel); require.cache[p] = { id: p, filename: p, loaded: true, exports }; };
const USERS = [
  { username: 'resp1', name: 'Resp One', role: 'User', perms: { stats: ['view'] } },
  { username: 'hand', name: 'Hand Granted', role: 'User', perms: { devdays: ['view', 'add', 'print'] }, deviceDepartments: ['micu'] },
  { username: 'boss', name: 'Admin', role: 'Administrator', perms: null },
  { username: 'allx', name: 'All Depts', role: 'User', perms: { devdays: ['view', 'add'] }, deviceDepartments: ['*'] },
];
const usersCol = { find: () => ({ toArray: async () => USERS }), updateOne: async (q, u) => { const x = USERS.find((y) => y.username === q.username); if (x) Object.assign(x, u.$set); return { matchedCount: x ? 1 : 0 }; } };
fake('../db', { getDbHandle: async () => null, getDepartments: async () => [{ id: 'sicu', name: 'Surgical ICU' }, { id: 'micu', name: 'Medical ICU' }], getUsers: async () => usersCol });
fake('../deptmap', { get: async () => ({ byId: {} }) });
fake('../activity-log', { log: (req, action, opts) => logged.push({ action, opts }) });

const DD = require('../../renderer/unico/device-days-core.js');
const dd = require('../device-days');
const access = require('../access');

// Hospital clock: 2026-11-04 (a Wednesday) 12:00 Asia/Dhaka = 06:00 UTC.
let clock = Date.parse('2026-11-04T06:00:00Z');
const routes = {};
const reg = (m) => (p, g, h) => { routes[m + ' ' + p] = h; };
dd.mount({ get: reg('GET'), put: reg('PUT'), post: reg('POST'), delete: reg('DELETE') }, { requireApi: [], now: () => clock });
async function call(route, a, { params = {}, query = {}, body = {} } = {}) {
  const out = { status: 200, body: null };
  const res = { status(c) { out.status = c; return res; }, json(b) { out.body = b; return res; }, set() { return res; } };
  await routes[route]({ params, query, body, access: a, user: a && { sub: a.username } }, res);
  return out;
}
const user = (username, perms, depts) => ({ unrestricted: false, username, role: 'User', perms, deviceDepartments: depts });
const admin = { unrestricted: true, username: 'admin', role: 'Administrator' };
const row = (o) => Object.assign({ time: '08:00', total: 10, peripheral: 6, central: 2, urinary: 3, ventilator: 1 }, o || {});

(async () => {
  /* ---- the shared rule ---- */
  const daily = { tracked: true, frequency: 'daily', cutoff: '10:00' };
  assert.equal(DD.hospitalNow(clock).date, '2026-11-04');
  assert.equal(DD.dayState('2026-11-03', null, daily, clock), 'missing', 'yesterday unsent = missed');
  assert.equal(DD.dayState('2026-11-04', null, daily, clock), 'missing', 'today after the 10:00 cut-off = missed');
  assert.equal(DD.dayState('2026-11-04', null, daily, Date.parse('2026-11-04T03:00:00Z')), 'open', 'today 09:00 = still open');
  assert.equal(DD.dayState('2026-11-05', null, daily, clock), 'future');
  assert.equal(DD.dayState('2026-11-03', { status: 'submitted' }, daily, clock), 'submitted');
  assert.equal(DD.dayState('2026-11-03', { status: 'draft' }, daily, clock), 'missing', 'a saved but unsent draft is still missed');
  assert.equal(DD.dayState('2026-11-03', null, Object.assign({}, daily, { startDate: '2026-11-04' }), clock), 'not-due', 'before the start date');
  assert.equal(DD.dayState('2026-11-03', null, { tracked: false }, clock), 'not-due', 'untracked department');
  const weekly = { tracked: true, frequency: 'weekly', cutoff: '10:00', weekStart: 6 };
  assert.deepEqual(DD.periodOf('2026-11-04', weekly), { key: 'W2026-10-31', from: '2026-10-31', to: '2026-11-06', label: '31 Oct – 6 Nov' }, 'weeks run Saturday–Friday');
  assert.equal(DD.dayState('2026-11-02', null, weekly, clock), 'open', 'current week not due yet');
  assert.equal(DD.dayState('2026-10-30', null, weekly, clock), 'missing', 'last week ended on Friday 30 Oct');
  const monthly = { tracked: true, frequency: 'monthly', cutoff: '10:00' };
  assert.equal(DD.dayState('2026-11-01', null, monthly, clock), 'open');
  assert.equal(DD.dayState('2026-10-31', null, monthly, clock), 'missing', 'October was due on 1 Nov');
  assert.equal(DD.monthKey('Nov-26'), '2026-11'); assert.equal(DD.monthKey('2026-11'), '2026-11'); assert.equal(DD.monthKey('x'), null);
  assert.equal(DD.validateRow(row()), null);
  assert.match(DD.validateRow(row({ central: 11 })), /cannot be more than Total/);
  assert.match(DD.validateRow(row({ urinary: 1.5 })), /whole number/);
  assert.match(DD.validateRow(row({ ventilator: '' })), /required/);
  assert.equal(DD.fieldForIndicator('CLABSI rate', { 'clabsi rate': { canonicalName: 'Central Line-Associated Bloodstream Infection (CLABSI) Rate' } }), 'central');
  assert.equal(DD.fieldForIndicator('Ventilator-Associated Pneumonia (VAP) Rate', {}), 'ventilator');
  assert.equal(DD.fieldForIndicator('Patient falls', {}), null);

  /* ---- access ---- */
  assert.equal(access.can(user('x', { mydept: ['view'] }, ['*']), 'devdays', 'view'), false, 'not implied by other modules');
  assert.deepEqual(access.deviceDeptIds(user('x', { devdays: ['view'] }, ['sicu'])), ['sicu']);
  assert.equal(access.deviceDeptIds(user('x', { devdays: ['view'] }, ['*'])), null, "'*' = every department");
  assert.deepEqual(access.deviceDeptIds(user('x', {}, ['sicu'])), [], 'no module = no departments');

  const nurse = user('nurse', { devdays: ['view', 'add'] }, ['sicu']);
  const viewer = user('viewer', { devdays: ['view'] }, ['sicu']);
  const reviewer = user('rev', { devdays: ['view', 'edit', 'print'] }, ['*']);
  const outsider = user('out', { devdays: ['view', 'add'] }, ['micu']);

  // Nothing tracked yet: the module is empty and nothing can be entered.
  assert.equal((await call('GET /api/device-days/meta', nurse)).body.departments.length, 0);
  assert.equal((await call('PUT /api/device-days/:dept/:date', nurse, { params: { dept: 'sicu', date: '2026-11-03' }, body: row() })).status, 400);
  assert.equal((await call('PUT /api/device-days/config', nurse, { body: { depts: { sicu: { tracked: true } } } })).status, 403, 'settings are admin-only');
  let r = await call('PUT /api/device-days/config', admin, { body: { depts: { sicu: { tracked: true, frequency: 'daily', cutoff: '10:00', startDate: '2026-11-01' } } } });
  assert.equal(r.body.changed, 1);
  assert.equal(logged.pop().action, 'devdays_config');
  assert.deepEqual((await call('GET /api/device-days/meta', nurse)).body.departments.map((d) => d.id), ['sicu']);
  assert.equal((await call('GET /api/device-days/meta', outsider)).body.departments.length, 0, 'micu is not tracked');

  // Entering.
  const put = (a, date, body) => call('PUT /api/device-days/:dept/:date', a, { params: { dept: 'sicu', date }, body });
  assert.equal((await put(viewer, '2026-11-03', row())).status, 403, 'view only cannot enter');
  assert.equal((await put(outsider, '2026-11-03', row())).status, 403, 'not their department');
  assert.equal((await put(nurse, '2026-11-05', row())).status, 400, 'future day refused');
  assert.equal((await put(nurse, '2026-11-03', row({ central: 99 }))).status, 400, 'device > total refused');
  r = await put(nurse, '2026-11-03', row());
  assert.equal(r.status, 200); assert.equal(r.body.row.status, 'draft');
  const v1 = r.body.row.updatedAt;
  clock += 1000;
  r = await put(nurse, '2026-11-03', row({ total: 12, baseUpdatedAt: v1 }));
  assert.equal(r.status, 200);
  assert.equal((await put(nurse, '2026-11-03', row({ total: 13, baseUpdatedAt: v1 }))).status, 409, 'stale save refused');

  // Missed days: 1, 2, 4 Nov (3 Nov is a draft — still missed until sent).
  let m = await call('GET /api/device-days/missing', nurse);
  assert.deepEqual(m.body.departments[0].missing, ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']);
  assert.equal(m.body.total, 4, 'daily: one per missed day');
  assert.equal(m.body.departments[0].missedPeriods.length, 4);

  // Sending.
  assert.equal((await call('POST /api/device-days/submit', viewer, { body: { dept: 'sicu', from: '2026-11-03', to: '2026-11-03' } })).status, 403);
  r = await call('POST /api/device-days/submit', nurse, { body: { dept: 'sicu', from: '2026-11-03', to: '2026-11-03' } });
  assert.equal(r.body.sent, 1);
  assert.equal(logged.pop().action, 'devdays_submit');
  assert.equal((await call('POST /api/device-days/submit', nurse, { body: { dept: 'sicu', from: '2026-11-03', to: '2026-11-03' } })).status, 400, 'nothing new to send');
  assert.equal((await put(nurse, '2026-11-03', row({ total: 20 }))).status, 403, 'a sent day is locked for the sender');
  let month = await call('GET /api/device-days', nurse, { query: { dept: 'sicu', month: '2026-11' } });
  const d3 = month.body.days.find((d) => d.date === '2026-11-03');
  assert.equal(d3.state, 'submitted'); assert.equal(d3.row.late, true, 'sent after its cut-off');

  // Review.
  assert.equal((await call('POST /api/device-days/review', nurse, { body: { ids: ['sicu:2026-11-03'], action: 'approve' } })).status, 403, 'add cannot approve');
  assert.equal((await call('POST /api/device-days/review', reviewer, { body: { ids: ['sicu:2026-11-03'], action: 'return' } })).status, 400, 'return needs a reason');
  r = await call('POST /api/device-days/review', reviewer, { body: { ids: ['sicu:2026-11-03'], action: 'return', reason: 'Ventilator count looks wrong' } });
  assert.equal(r.body.done, 1);
  m = await call('GET /api/device-days/missing', nurse);
  assert.deepEqual(m.body.departments[0].returned, ['2026-11-03'], 'returned days ask for attention');
  r = await put(nurse, '2026-11-03', row({ ventilator: 2 }));
  assert.equal(r.body.row.status, 'returned', 'fixing keeps it returned until resent');
  await call('POST /api/device-days/submit', nurse, { body: { dept: 'sicu', from: '2026-11-01', to: '2026-11-30' } });
  assert.equal((await call('GET /api/device-days/missing', reviewer)).body.pendingReview, 1);

  // Self-approval refused (a reviewer who also sent it).
  const both = user('both', { devdays: ['view', 'add', 'edit'] }, ['sicu']);
  await put(both, '2026-11-02', row());
  await call('POST /api/device-days/submit', both, { body: { dept: 'sicu', from: '2026-11-02', to: '2026-11-02' } });
  r = await call('POST /api/device-days/review', both, { body: { ids: ['sicu:2026-11-02'], action: 'approve' } });
  assert.equal(r.body.done, 0); assert.match(r.body.skipped[0], /yourself/);

  r = await call('POST /api/device-days/review', reviewer, { body: { ids: ['sicu:2026-11-03', 'sicu:2026-11-02'], action: 'approve' } });
  assert.equal(r.body.done, 2);

  // Summary + quality suggestion count approved rows only.
  const s = await call('GET /api/device-days/summary', viewer, { query: { from: '2026-11', to: '2026-11' } });
  const nov = s.body.departments[0].months[0];
  assert.equal(nov.approved.days, 2); assert.equal(nov.approved.total, 20); assert.equal(nov.approved.ventilator, 3);
  assert.equal(nov.missing, 2, '1 and 4 Nov still missed');
  const sug = await call('GET /api/device-days/suggest', user('q', { quality: ['view'] }, []), { query: { dept: 'sicu', month: 'Nov-26' } });
  assert.equal(sug.body.approved.central, 4); assert.equal(sug.body.missing, 2);
  assert.equal((await call('GET /api/device-days/suggest', user('z', { staff: ['view'] }, []), { query: { dept: 'sicu', month: 'Nov-26' } })).status, 403);

  // A reviewer's correction of an approved day sends it back to review and is logged.
  r = await put(reviewer, '2026-11-02', row({ peripheral: 7 }));
  assert.equal(r.body.row.status, 'submitted');
  assert.equal(logged.pop().action, 'devdays_edit');

  // Soft delete keeps the document; saving the day again restores it.
  assert.equal((await call('DELETE /api/device-days/:dept/:date', nurse, { params: { dept: 'sicu', date: '2026-11-02' } })).status, 403);
  const deleter = user('del', { devdays: ['view', 'delete'] }, ['sicu']);
  assert.equal((await call('DELETE /api/device-days/:dept/:date', deleter, { params: { dept: 'sicu', date: '2026-11-02' } })).status, 200);
  assert.ok(dd._mem.rows.get('sicu:2026-11-02').removedAt, 'kept, flagged removed');
  month = await call('GET /api/device-days', nurse, { query: { dept: 'sicu', month: '2026-11' } });
  assert.equal(month.body.days.find((d) => d.date === '2026-11-02').state, 'missing');
  r = await put(nurse, '2026-11-02', row());
  assert.equal(r.body.row.status, 'draft'); assert.equal(r.body.row.history.slice(-1)[0].action, 'restore');

  // Printing is its own grant and is logged first.
  assert.equal((await call('POST /api/device-days/print', nurse, { body: { dept: 'sicu', month: '2026-11' } })).status, 403);
  assert.equal((await call('POST /api/device-days/print', reviewer, { body: { dept: 'sicu', month: '2026-11' } })).status, 200);
  assert.equal(logged.pop().action, 'devdays_print');

  /* ---- round 2: admin entry ---- */
  assert.equal((await put(nurse, '2026-11-01', row({ approve: true }))).status, 403, 'only an administrator saves as approved');
  r = await put(admin, '2026-11-01', row({ approve: true }));
  assert.equal(r.body.row.status, 'approved', 'admin entry is final');
  assert.equal(r.body.row.reviewedBy, 'admin'); assert.equal(r.body.row.history.slice(-1)[0].action, 'admin-entry');
  assert.equal(logged.pop().action, 'devdays_edit');
  r = await put(admin, '2026-11-01', row({ approve: true, peripheral: 9 }));
  assert.equal(r.body.row.status, 'approved', 'admin correction stays approved'); assert.equal(r.body.row.history.slice(-1)[0].action, 'admin-correct');
  logged.pop();

  /* ---- custom columns ---- */
  r = await call('PUT /api/device-days/config', admin, { body: { fields: [{ label: 'Patients with NG tube', short: 'NG tube' }] } });
  let cfgR = await call('GET /api/device-days/config', admin);
  const ng = cfgR.body.fields.find((f) => f.custom);
  assert.equal(ng.id, 'c_patients_with_ng_tube'); assert.equal(cfgR.body.fields.length, 6);
  assert.equal(cfgR.body.departments.find((d) => d.id === 'sicu').cfg.tracked, true, 'saving columns keeps department settings');
  assert.equal((await put(nurse, '2026-11-04', row())).status, 400, 'a new column is required on new entries');
  assert.equal((await put(nurse, '2026-11-04', row({ [ng.id]: 11 }))).status, 400, 'a new column cannot exceed total');
  r = await put(nurse, '2026-11-04', row({ [ng.id]: 4 }));
  assert.equal(r.body.row[ng.id], 4);
  month = await call('GET /api/device-days', nurse, { query: { dept: 'sicu', month: '2026-11' } });
  assert.ok(month.body.fields.some((f) => f.id === ng.id)); assert.equal(month.body.all[ng.id], 4, 'custom column is summed');
  await call('PUT /api/device-days/config', admin, { body: { fields: [{ id: ng.id, label: 'Patients with NG tube', short: 'NG tube', active: false }] } });
  cfgR = await call('GET /api/device-days/config', admin);
  assert.equal(cfgR.body.fields.find((f) => f.id === ng.id).active, false, 'hidden, not deleted');
  assert.equal((await call('GET /api/device-days/meta', nurse)).body.fields.length, 5, 'hidden column leaves the form');
  assert.equal(dd._mem.rows.get('sicu:2026-11-04')[ng.id], 4, 'its saved value is kept');
  r = await call('PUT /api/device-days/config', admin, { body: { fields: [] } });
  assert.equal((await call('GET /api/device-days/config', admin)).body.fields.length, 6, 'a column left out of a save is kept');

  /* ---- responsible persons ---- */
  logged.length = 0;
  r = await call('PUT /api/device-days/config', admin, { body: { responsibles: { sicu: ['resp1', 'hand', 'boss', 'allx', 'ghost'] } } });
  assert.equal(r.body.responsibles.granted, 2, 'resp1 + hand');
  assert.ok(r.body.responsibles.skipped.length >= 3, 'admin, all-departments holder and unknown names are skipped');
  const u = (n) => USERS.find((x) => x.username === n);
  assert.deepEqual(u('resp1').perms.devdays, ['view', 'add']); assert.deepEqual(u('resp1').deviceDepartments, ['sicu']); assert.equal(u('resp1').devdaysAuto, true);
  assert.deepEqual(u('resp1').perms.stats, ['view'], 'other modules untouched');
  assert.deepEqual(u('hand').perms.devdays, ['view', 'add', 'print'], 'hand-granted rights kept'); assert.deepEqual(u('hand').deviceDepartments, ['micu', 'sicu']);
  assert.equal(u('boss').perms, null, 'administrator untouched'); assert.deepEqual(u('allx').deviceDepartments, ['*']);
  assert.ok(logged.filter((x) => x.action === 'devdays_access').length === 2);
  cfgR = await call('GET /api/device-days/config', admin);
  assert.deepEqual(cfgR.body.departments.find((d) => d.id === 'sicu').responsibles.sort(), ['hand', 'resp1']);
  assert.ok(cfgR.body.people.some((p) => p.username === 'resp1') && !cfgR.body.people.some((p) => p.username === 'boss'));
  r = await call('PUT /api/device-days/config', admin, { body: { responsibles: { sicu: [] } } });
  assert.equal(r.body.responsibles.removed, 2);
  assert.equal(u('resp1').perms.devdays, 'none', 'auto-granted account loses the module with its last department'); assert.equal(u('resp1').devdaysAuto, false);
  assert.deepEqual(u('hand').perms.devdays, ['view', 'add', 'print'], 'hand-granted account keeps its rights'); assert.deepEqual(u('hand').deviceDepartments, ['micu']);
  assert.equal((await call('PUT /api/device-days/config', nurse, { body: { responsibles: { sicu: ['resp1'] } } })).status, 403, 'only an administrator assigns');

  /* ---- bulk approve (Review → Approve all): one call, everything waiting approved, the rest skipped ---- */
  r = await call('POST /api/device-days/submit', nurse, { body: { dept: 'sicu', from: '2026-11-01', to: '2026-11-30' } });
  assert.equal(r.body.sent, 2, '2 and 4 Nov sent');
  assert.equal((await call('GET /api/device-days/review', reviewer)).body.rows.length, 2);
  r = await call('POST /api/device-days/review', reviewer, { body: { ids: ['sicu:2026-11-02', 'sicu:2026-11-04', 'sicu:2026-11-03', 'micu:2026-11-01'], action: 'approve' } });
  assert.equal(r.body.done, 2); assert.equal(r.body.skipped.length, 2, 'already approved / unknown rows are skipped, not failed');
  assert.equal((await call('GET /api/device-days/review', reviewer)).body.rows.length, 0, 'queue empty');
  assert.equal(logged.pop().action, 'devdays_approve');

  console.log('device-days: all assertions passed');
})().catch((e) => { console.error(e); process.exit(1); });
