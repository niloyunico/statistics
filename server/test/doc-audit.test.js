/* Documentation Audit: the scoring rule (doc-audit-core: N/A excluded, critical = FAIL, grade
   bands), the four tools exactly as the policies print them, who may do what (departments, the
   own-documentation rule, own sign-off), the sign-off chain and its lock, tool revisions that never
   change an old score, the monthly KPIs and the CAP trigger, the figures that feed Nursing KPI 2C,
   the nurse's own acknowledgement, and the Excel workbook. Runs on fakes (no database). */
const assert = require('node:assert/strict');

const logged = [];
const fake = (rel, exports) => { const p = require.resolve(rel); require.cache[p] = { id: p, filename: p, loaded: true, exports }; };
const DEPTS = [{ id: 'lvl9', name: 'Level 9 Ward' }, { id: 'er', name: 'Emergency Medicine' }, { id: 'opd', name: 'OPD' }, { id: 'dialysis', name: 'Dialysis' }];
fake('../db', { getDbHandle: async () => null, getDepartments: async () => DEPTS, getUsers: async () => null, getQuality: async () => [] });
fake('../deptmap', { get: async () => ({ byId: {} }), HOSPITAL: '__hospital__' });
fake('../activity-log', { log: (req, action, opts) => logged.push({ action, opts }) });

const DA = require('../../renderer/unico/doc-audit-core.js');
const catalogue = require('../doc-audit-catalogue');
const docAudit = require('../doc-audit');
const link = require('../kpi-link');

const ROSTER = [
  { id: 1, name: 'Rina Akter', emp_id: '11001', designation: 'Staff Nurse', current_department: 'Level 9', role: 'Nurse' },
  { id: 2, name: 'Mitu Das', emp_id: '11002', designation: 'Staff Nurse', current_department: 'Emergency', role: 'Nurse' },
  { id: 3, name: 'Auditor Nurse', emp_id: '11003', designation: 'Senior Staff Nurse', current_department: 'Level 9', role: 'Nurse' },
  { id: 4, name: 'Former Nurse', emp_id: '11004', current_department: 'Level 9', former: true },
  { id: 5, name: 'Shapla Khatun', emp_id: '11005', designation: 'Staff Nurse', current_department: 'Level 9', role: 'Nurse' },
  { id: 6, name: 'Moni PCA', emp_id: '11006', designation: 'Patient Care Assistant', current_department: 'Level 9', role: 'PCA' },
];
// Hospital clock: 2026-11-11 12:00 Asia/Dhaka.
const clock = Date.parse('2026-11-11T06:00:00Z');
let tick = 0;
const now = () => clock + (tick++);
const routes = {};
const reg = (m) => (p, g, h) => { routes[m + ' ' + p] = h; };
docAudit.mount({ get: reg('GET'), put: reg('PUT'), post: reg('POST'), delete: reg('DELETE') }, { requireApi: [], now, deps: { roster: async () => ROSTER } });
async function call(route, a, { params = {}, query = {}, body = {} } = {}) {
  const out = { status: 200, body: null, headers: {} };
  const res = { status(c) { out.status = c; return res; }, json(b) { out.body = b; return res; }, set(k, v) { out.headers[k] = v; return res; }, end(b) { out.body = b; return res; } };
  if (!routes[route]) throw new Error('no route ' + route);
  await routes[route]({ params, query, body, access: a, user: a && { sub: a.username } }, res);
  return out;
}
const person = (username, acts, depts, staffId) => ({ unrestricted: false, username, name: username, role: 'User', perms: { docaudit: acts }, auditDepartments: depts, staffId: staffId == null ? null : staffId });
const auditor = person('auditor', ['view', 'add'], ['lvl9'], 3);
const incharge = Object.assign(person('incharge', ['view', 'add', 'edit', 'delete'], ['lvl9'], null), { auditProfileView: true });
const incharge2 = person('incharge2', ['view', 'add', 'edit'], ['lvl9'], null);
const outsider = person('outsider', ['view', 'add'], ['er'], null);
const viewer = person('viewer', ['view'], ['lvl9'], null);
const nurseAcct = { unrestricted: false, username: 'rina', name: 'Rina Akter', role: 'User', perms: {}, staffId: 1 };
const admin = { unrestricted: true, username: 'admin', name: 'Admin', role: 'Administrator' };
const IPD = catalogue.TOOLS.find((t) => t.id === 'ipd25');
const allYes = (tool) => { const a = {}; tool.criteria.forEach((c) => { a[c.id] = 'Y'; }); return a; };

(async () => {
  /* ---- the four tools are the policies' ---- */
  const crit = (id) => catalogue.TOOLS.find((t) => t.id === id).criteria.filter((c) => c.critical).map((c) => c.no);
  assert.deepEqual(catalogue.TOOLS.map((t) => [t.id, t.criteria.filter((c) => c.active).length]), [['ipd25', 25], ['ot20', 18], ['cath20', 20], ['dial20', 20], ['ed20', 20]], 'OT 18 (Section D off), Cath Lab 20');
  assert.deepEqual(crit('ipd25'), [1, 2, 7, 8, 9, 11, 16, 17, 18, 19, 20, 21, 24], 'QA-001 §8.3: 13 critical');
  assert.deepEqual(crit('cath20'), [1, 3, 4, 5, 7, 8, 13, 15, 20], 'QA-002: 9 critical (Cath Lab, all 20)');
  assert.deepEqual(catalogue.TOOLS.find((t) => t.id === 'ot20').criteria.filter((c) => c.active && c.critical).map((c) => c.id), ['c1', 'c3', 'c4', 'c5', 'c7', 'c8', 'c13', 'c15', 'c20'], 'OT: the same 9 critical (ids kept, renumbered)');
  assert.ok(catalogue.TOOLS.find((t) => t.id === 'ot20').header.areas.indexOf('Post-operative / Recovery (PACU)') >= 0, 'OT has the post-operative area');
  assert.equal(catalogue.guessTool({ id: 'cathlab', name: 'Cath Lab' }).toolId, 'cath20');
  assert.equal(DA.aldreteText({ a: 2, r: 2, c: 1, co: 1, o: 2 }), '8/10 (A2 R2 C1 Co1 O2)');
  assert.deepEqual(DA.cleanAldrete({ a: 9, r: '2' }), { r: 2, total: 2, complete: false }, 'each sign 0–2; total worked out');
  assert.deepEqual(crit('dial20'), [1, 2, 3, 4, 6, 8, 12, 15, 16, 18, 20], 'QA-003: 11 critical');
  assert.deepEqual(crit('ed20'), [1, 3, 5, 8, 9, 12, 13, 15, 20], 'QA-004: 9 critical');
  const sub = (tid, k) => catalogue.TOOLS.find((t) => t.id === tid).kpis.find((x) => x.id === k).criteria;
  assert.deepEqual(sub('ipd25', 'kpi5'), ['c15', 'c16', 'c17', 'c18', 'c19'], 'KPI-5 consent = 15–19');
  assert.deepEqual(sub('ipd25', 'kpi6'), ['c9', 'c10', 'c11'], 'KPI-6 medication = 9–11');
  assert.deepEqual(sub('ot20', 'kpi4'), ['c6', 'c7', 'c8', 'c9']);
  assert.deepEqual(sub('dial20', 'kpi4'), ['c4', 'c6', 'c8']);
  assert.deepEqual(sub('dial20', 'kpi5'), ['c12', 'c16']);
  assert.deepEqual(sub('ed20', 'kpi4'), ['c3', 'c4', 'c9']);
  assert.equal(catalogue.guessTool({ id: 'er', name: 'Emergency Medicine' }).toolId, 'ed20');
  assert.equal(catalogue.guessTool({ id: 'opd', name: 'OPD' }), null, 'out-patients are not audited by default');

  /* ---- scoring ---- */
  let a = allYes(IPD); a.c3 = 'N'; a.c20 = 'NA';
  let r = DA.score(a, IPD.criteria);
  assert.deepEqual([r.yes, r.no, r.na, r.applicable, r.pct, r.grade, r.result], [23, 1, 1, 24, 95.8, 'excellent', 'PASS'], 'N/A is excluded from the denominator');
  a = allYes(IPD); a.c1 = 'N';
  r = DA.score(a, IPD.criteria);
  assert.equal(r.pct, 96); assert.equal(r.result, 'FAIL', 'one critical No fails the record at 96%'); assert.deepEqual(r.criticalFails, ['c1']);
  const band = (yes, no) => { const crs = Array.from({ length: yes + no }, (_, i) => ({ id: 'x' + i, no: i + 1, text: 't' })); const ans = {}; crs.forEach((c, i) => { ans[c.id] = i < yes ? 'Y' : 'N'; }); return DA.score(ans, crs); };
  assert.equal(band(19, 1).grade, 'excellent'); assert.equal(band(18, 2).grade, 'good'); assert.equal(band(18, 2).result, 'PASS', '90.0% passes');
  assert.equal(band(17, 3).grade, 'improve'); assert.equal(band(8, 2).grade, 'improve', '80% = Needs improvement'); assert.equal(band(7, 3).grade, 'unsat');
  assert.equal(band(899, 101).pct, 89.9); assert.equal(band(899, 101).result, 'FAIL');
  assert.equal(DA.score({ c1: 'NA' }, [{ id: 'c1', no: 1 }]).pct, null, 'nothing applicable = no score');
  assert.equal(DA.score({}, IPD.criteria).blank, 25, 'unreviewed items stay blank — never N/A');
  let probs = DA.validate({ deptId: 'lvl9', date: '2026-11-10', uhid: 'U1', nurse: { staffId: '1' }, answers: Object.assign(allYes(IPD), { c4: 'N' }), evidence: {} }, IPD.criteria, { today: '2026-11-11' });
  assert.equal(probs.length, 0, "evidence for a 'No' is optional");
  probs = DA.validate({ deptId: 'er', date: '2026-11-10', uhid: 'U1', nurse: { staffId: '1' }, area: 'Emergency OT', answers: Object.assign({}, allYes(catalogue.TOOLS[1]), { c7: 'NA' }) }, catalogue.TOOLS[1].criteria, { tool: catalogue.TOOLS[1] });
  assert.ok(probs.some((p) => p.criterion === 'c7'), 'time-out is never N/A in an emergency OT (QA-002 §7.3)');

  /* ---- who may do what ---- */
  let res = await call('GET /api/doc-audit/meta', auditor);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.departments.map((d) => d.id), ['lvl9'], 'only my departments');
  assert.equal(res.body.tools.length, 5, 'the five tools are seeded');
  assert.equal(res.body.staffId, '3');
  res = await call('GET /api/doc-audit/staff', auditor, { query: { dept: 'lvl9' } });
  assert.deepEqual(res.body.staff.map((p) => p.id), [3, 1, 5, 6], 'Level 9 staff, nurses first and the PCA last — never a former one');
  res = await call('GET /api/doc-audit/staff', auditor, { query: { all: '1', q: 'mitu' } });
  assert.deepEqual(res.body.staff.map((p) => p.id), [2], 'a search reaches nurses of other departments');
  res = await call('GET /api/doc-audit/staff', auditor, { query: { all: '1', q: '11002' } });
  assert.deepEqual(res.body.staff.map((p) => p.id), [2], '… by employee ID too');
  res = await call('GET /api/doc-audit/staff', auditor, { query: { all: '1' } });
  assert.equal(res.body.all, false, 'without a search, a one-department auditor gets their own list only');
  assert.ok(!('phone' in res.body.staff[0]), 'thin records');
  assert.equal((await call('GET /api/doc-audit/staff', auditor, { query: { dept: 'er' } })).status, 403);
  assert.equal((await call('GET /api/doc-audit/meta', person('nobody', [], ['lvl9']))).status, 403);

  const base = { deptId: 'lvl9', date: '2026-11-10', shift: 'Morning', uhid: 'UH-100', bed: '9-12', area: 'Cabin Level 9' };
  res = await call('POST /api/doc-audit/audits', auditor, { body: Object.assign({}, base, { nurse: { staffId: 3 }, answers: allYes(IPD), complete: true }) });
  assert.equal(res.status, 409); assert.equal(res.body.code, 'self', 'nobody audits their own documentation');
  res = await call('POST /api/doc-audit/audits', auditor, { body: Object.assign({}, base, { nurses: [{ staffId: 2, fromOtherDept: false, assignment: 'Relief / cover' }, { staffId: 1, fromOtherDept: true }], answers: allYes(IPD) }) });
  assert.equal(res.status, 200, 'a nurse from another department can be audited here');
  assert.deepEqual([res.body.audit.nurses[0].fromOtherDept, res.body.audit.nurses[0].homeDept, res.body.audit.nurses[0].assignment], [true, 'Emergency', 'Relief / cover'], 'marked from another department — worked out by the server');
  assert.equal(res.body.audit.nurses[1].fromOtherDept, false, 'a sent fromOtherDept is ignored');
  assert.equal(res.body.audit.nurses[1].assignment, undefined);
  res = await call('PUT /api/doc-audit/audits/:id', auditor, { params: { id: res.body.audit.id }, body: { nurses: [{ staffId: 2, assignment: 'bogus' }, { staffId: 1 }] } });
  assert.equal(res.body.audit.nurses[0].assignment, 'Relief / cover', 'an unknown reason keeps the saved one');
  res = await call('PUT /api/doc-audit/audits/:id', auditor, { params: { id: res.body.audit.id }, body: { nurses: [{ staffId: 2, assignment: 'Overtime' }, { staffId: 1 }] } });
  assert.equal(res.body.audit.nurses[0].assignment, 'Overtime');
  assert.ok(/Mitu Das \(from Emergency, overtime\)/.test(res.body.audit.history[res.body.audit.history.length - 1].changes), 'the history names it');
  await call('DELETE /api/doc-audit/audits/:id', admin, { params: { id: res.body.audit.id } });
  res = await call('POST /api/doc-audit/audits', auditor, { body: Object.assign({}, base, { nurses: [{ staffId: 2 }], answers: allYes(IPD) }) });
  assert.equal(res.body.audit.nurses[0].assignment, 'Deployed', 'default reason: deployed');
  await call('DELETE /api/doc-audit/audits/:id', admin, { params: { id: res.body.audit.id } });
  res = await call('POST /api/doc-audit/audits', outsider, { body: Object.assign({}, base, { nurse: { staffId: 1 } }) });
  assert.equal(res.status, 403, 'not my department');
  res = await call('POST /api/doc-audit/audits', viewer, { body: Object.assign({}, base, { nurse: { staffId: 1 } }) });
  assert.equal(res.status, 403, 'View cannot fill');

  // a draft, then the completed audit
  res = await call('POST /api/doc-audit/audits', auditor, { body: Object.assign({}, base, { nurse: { staffId: 1 }, answers: { c1: 'Y', c2: 'Y' } }) });
  assert.equal(res.status, 200); assert.equal(res.body.audit.status, 'draft');
  const draftId = res.body.audit.id;
  assert.equal(res.body.audit.nurse.name, 'Rina Akter'); assert.equal(res.body.audit.nurse.staffId, '1', 'linked by the record id');
  assert.equal(res.body.audit.criteria.length, 25); assert.equal(res.body.audit.toolId, 'ipd25', 'the department’s tool');
  a = allYes(IPD); a.c3 = 'N'; a.c20 = 'NA';
  res = await call('PUT /api/doc-audit/audits/:id', auditor, { params: { id: draftId }, body: { answers: Object.assign({}, a, { c4: undefined }), evidence: {}, complete: true } });
  assert.equal(res.status, 400); assert.equal(res.body.code, 'incomplete', 'every criterion must still be answered');
  res = await call('PUT /api/doc-audit/audits/:id', auditor, { params: { id: draftId }, body: { answers: a, evidence: { c3: 'No fall reassessment after sedation on 9 Nov 22:00' }, complete: true, result: { pct: 1, result: 'PASS' } } });
  assert.equal(res.status, 200);
  const A1 = res.body.audit;
  assert.equal(A1.status, 'completed'); assert.equal(A1.result.pct, 95.8, 'the server computes the score; a sent result is ignored'); assert.equal(A1.result.result, 'PASS');
  assert.equal(A1.uhid, 'UH-100', 'a field the request does not send is kept');
  assert.ok(logged.some((l) => l.action === 'docaudit_audit' && /completed/.test(l.opts.detail)));

  // a FAIL: a critical criterion marked No
  a = allYes(IPD); a.c9 = 'N';
  res = await call('POST /api/doc-audit/audits', auditor, { body: Object.assign({}, base, { uhid: 'UH-101', nurse: { staffId: 1 }, answers: a, evidence: { c9: 'MAR not signed for 08:00 dose' }, complete: true }) });
  const A2 = res.body.audit;
  assert.equal(A2.result.result, 'FAIL'); assert.deepEqual(A2.result.criticalFails, ['c9']);
  // a nurse not in the register: typed, not linked
  res = await call('POST /api/doc-audit/audits', incharge, { body: Object.assign({}, base, { uhid: 'UH-102', nurse: { name: 'Agency Nurse', empId: '' }, answers: allYes(IPD), complete: true }) });
  assert.equal(res.status, 200); assert.equal(res.body.audit.nurse.linked, false);
  const A3 = res.body.audit;
  // a 'No' without evidence completes; an administrator may name the auditor, nobody else can
  res = await call('POST /api/doc-audit/audits', auditor, { body: Object.assign({}, base, { uhid: 'UH-104', nurse: { staffId: 1 }, answers: Object.assign(allYes(IPD), { c6: 'N' }), complete: true, auditorName: 'Somebody Else' }) });
  assert.equal(res.status, 200, "a 'No' without evidence completes"); assert.equal(res.body.audit.auditor.name, 'auditor', "a non-admin's auditorName is ignored");
  await call('DELETE /api/doc-audit/audits/:id', admin, { params: { id: res.body.audit.id } });
  res = await call('POST /api/doc-audit/audits', admin, { body: Object.assign({}, base, { uhid: 'UH-105', nurse: { staffId: 1 }, answers: allYes(IPD), complete: true, auditorName: 'Sr. Nurse Shirin' }) });
  assert.equal(res.body.audit.auditor.name, 'Sr. Nurse Shirin'); assert.equal(res.body.audit.auditor.enteredBy, 'admin');
  res = await call('PUT /api/doc-audit/audits/:id', admin, { params: { id: res.body.audit.id }, body: { auditorName: 'Sr. Nurse Rokeya' } });
  assert.equal(res.body.audit.auditor.name, 'Sr. Nurse Rokeya', 'an admin can correct the auditor');
  assert.ok(/auditor set to Sr. Nurse Rokeya/.test(res.body.audit.history[res.body.audit.history.length - 1].changes));
  await call('DELETE /api/doc-audit/audits/:id', admin, { params: { id: res.body.audit.id } });
  // picked from the register (searched by employee ID in the form): the record's real name and id
  res = await call('POST /api/doc-audit/audits', admin, { body: Object.assign({}, base, { uhid: 'UH-106', nurse: { staffId: 1 }, answers: allYes(IPD), complete: true, auditorName: '11003', auditorStaffId: 3 }) });
  assert.equal(res.status, 200); assert.equal(res.body.audit.auditor.name, 'Auditor Nurse'); assert.equal(res.body.audit.auditor.staffId, '3'); assert.equal(res.body.audit.auditor.empId, '11003');
  await call('DELETE /api/doc-audit/audits/:id', admin, { params: { id: res.body.audit.id } });
  res = await call('POST /api/doc-audit/audits', admin, { body: Object.assign({}, base, { uhid: 'UH-107', nurse: { staffId: 1 }, answers: allYes(IPD), complete: true, auditorStaffId: 1 }) });
  assert.equal(res.status, 409, 'the picked auditor cannot be the nurse audited');
  res = await call('POST /api/doc-audit/audits', auditor, { body: Object.assign({}, base, { uhid: 'UH-108', nurse: { staffId: 1 }, answers: allYes(IPD), complete: true, auditorStaffId: 1 }) });
  assert.equal(res.status, 200); assert.equal(res.body.audit.auditor.name, 'auditor', "a non-admin's auditorStaffId is ignored");
  await call('DELETE /api/doc-audit/audits/:id', admin, { params: { id: res.body.audit.id } });

  /* ---- evidence: optional unless the administrator requires it ---- */
  await call('PUT /api/doc-audit/config', admin, { body: { evidenceRequired: true } });
  assert.equal((await call('GET /api/doc-audit/meta', auditor)).body.config.evidenceRequired, true);
  res = await call('POST /api/doc-audit/audits', auditor, { body: Object.assign({}, base, { uhid: 'UH-E1', nurse: { staffId: 1 }, answers: Object.assign(allYes(IPD), { c6: 'N' }), complete: true }) });
  assert.equal(res.status, 400); assert.equal(res.body.code, 'incomplete', "switched on: a 'No' needs its evidence");
  await call('PUT /api/doc-audit/config', admin, { body: { evidenceRequired: false } });
  assert.equal((await call('GET /api/doc-audit/meta', auditor)).body.config.evidenceRequired, false, 'off by default / switched back');

  /* ---- publishing (the In-charge's sign-off) ---- */
  assert.equal((await call('GET /api/doc-audit/meta', auditor)).body.config.ackRequired, false, 'acknowledgement optional by default');
  await call('PUT /api/doc-audit/config', admin, { body: { ackRequired: true } });
  res = await call('POST /api/doc-audit/audits/:id/sign', incharge, { params: { id: A1.id } });
  assert.equal(res.status, 409); assert.equal(res.body.code, 'ack', 'switched on: the nurse acknowledges first');
  res = await call('POST /api/doc-audit/audits/:id/ack', auditor, { params: { id: A1.id }, body: { note: 'Feedback given at the station' } });
  assert.equal(res.body.audit.status, 'acknowledged'); assert.equal(res.body.audit.ack.method, 'in-person');
  assert.equal((await call('POST /api/doc-audit/audits/:id/sign', auditor, { params: { id: A1.id } })).status, 403, 'publishing needs Edit');
  await call('POST /api/doc-audit/audits/:id/ack', incharge, { params: { id: A3.id } });
  res = await call('POST /api/doc-audit/audits/:id/sign', incharge, { params: { id: A3.id } });
  assert.equal(res.body.code, 'own', 'nobody publishes their own audit');
  res = await call('POST /api/doc-audit/audits/:id/sign', incharge, { params: { id: A1.id }, body: { note: 'Reviewed' } });
  assert.equal(res.body.audit.status, 'signed'); assert.equal(DA.STATUS_LABEL.signed, 'Published'); assert.equal(res.body.audit.signoff.name, 'incharge');
  await call('PUT /api/doc-audit/config', admin, { body: { ackRequired: false } });
  // switched off (the default): published without any acknowledgement
  res = await call('POST /api/doc-audit/audits/:id/sign', incharge, { params: { id: A2.id } });
  assert.equal(res.status, 200); assert.equal(res.body.audit.status, 'signed', 'published without acknowledgement');
  res = await call('PUT /api/doc-audit/audits/:id', incharge, { params: { id: A1.id }, body: { remarks: 'x' } });
  assert.equal(res.status, 409); assert.equal(res.body.code, 'locked', 'signed = locked');
  assert.equal((await call('DELETE /api/doc-audit/audits/:id', incharge, { params: { id: A1.id } })).status, 409, 'only an admin removes a published audit');
  assert.equal((await call('POST /api/doc-audit/audits/:id/reopen', incharge, { params: { id: A1.id }, body: { reason: 'wrong date' } })).status, 403);
  res = await call('POST /api/doc-audit/audits/:id/reopen', admin, { params: { id: A1.id }, body: { reason: 'Wrong patient UHID' } });
  assert.equal(res.body.audit.status, 'acknowledged'); assert.equal(res.body.audit.reopened.length, 1);
  // correcting an acknowledged audit's answers clears the acknowledgement
  res = await call('PUT /api/doc-audit/audits/:id', incharge, { params: { id: A1.id }, body: { answers: Object.assign({}, A1.answers, { c5: 'N' }), evidence: Object.assign({}, A1.evidence, { c5: 'No response documented after PRN' }), baseUpdatedAt: res.body.audit.updatedAt } });
  assert.equal(res.status, 200); assert.equal(res.body.audit.status, 'completed'); assert.equal(res.body.audit.ack, null);
  assert.equal(res.body.audit.result.no, 2);
  const A1b = res.body.audit;
  res = await call('PUT /api/doc-audit/audits/:id', incharge, { params: { id: A1.id }, body: { remarks: 'stale', baseUpdatedAt: A1.updatedAt } });
  assert.equal(res.body.code, 'stale', 'lost update refused');

  /* ---- the nurse's own audits ---- */
  res = await call('GET /api/doc-audit/mine', nurseAcct);
  assert.equal(res.body.linked, true); assert.deepEqual(res.body.audits.map((x) => x.id), [A2.id], 'only PUBLISHED audits reach the nurse');
  assert.ok(res.body.audits[0].gaps.some((g) => g.no === 9 && g.critical)); assert.equal(res.body.audits[0].myPending, true);
  res = await call('POST /api/doc-audit/mine/:id/ack', nurseAcct, { params: { id: A2.id } });
  assert.equal(res.body.audit.ack.method, 'account'); assert.equal(res.body.audit.status, 'signed', 'acknowledging keeps it published');
  assert.equal((await call('POST /api/doc-audit/mine/:id/ack', nurseAcct, { params: { id: A1.id } })).status, 409, 'an unpublished audit is not hers to acknowledge yet');
  assert.equal((await call('POST /api/doc-audit/mine/:id/ack', nurseAcct, { params: { id: A3.id } })).status, 403, 'not her audit');

  /* ---- a tool edit is a new revision; old audits keep their criteria ---- */
  res = await call('GET /api/doc-audit/tools', admin, { query: { all: '1' } });
  const ipd = res.body.tools.find((t) => t.id === 'ipd25');
  const crits = ipd.criteria.map((c) => (c.id === 'c3' ? Object.assign({}, c, { critical: true }) : c)).filter((c) => c.id !== 'c22');
  assert.equal((await call('PUT /api/doc-audit/tools/:id', auditor, { params: { id: 'ipd25' }, body: { criteria: crits } })).status, 403, 'tools are the administrator’s');
  res = await call('PUT /api/doc-audit/tools/:id', admin, { params: { id: 'ipd25' }, body: Object.assign({}, ipd, { criteria: crits, baseUpdatedAt: ipd.updatedAt }) });
  assert.equal(res.status, 200); assert.equal(res.body.tool.revision, 2);
  assert.equal(res.body.tool.criteria.find((c) => c.id === 'c22').active, false, 'a criterion left out is switched off, never lost');
  assert.equal(res.body.tool.criteria.filter((c) => c.active).length, 24);
  res = await call('GET /api/doc-audit/audits/:id', incharge, { params: { id: A1.id } });
  assert.equal(res.body.audit.criteria.find((c) => c.id === 'c3').critical, false, 'the old audit keeps its frozen criteria');
  assert.equal(res.body.audit.result.result, 'PASS');
  res = await call('POST /api/doc-audit/audits', auditor, { body: Object.assign({}, base, { uhid: 'UH-103', nurse: { staffId: 1 }, answers: Object.assign(allYes(IPD), { c3: 'N' }), evidence: { c3: 'Pain not reassessed' }, complete: true }) });
  assert.equal(res.body.audit.toolRevision, 2); assert.equal(res.body.audit.criteria.length, 24); assert.equal(res.body.audit.result.result, 'FAIL', 'c3 is critical in revision 2');
  const A4 = res.body.audit;

  /* ---- reports, the CAP trigger, the KPI feed ---- */
  res = await call('GET /api/doc-audit/summary', incharge, { query: { from: '2026-11', to: '2026-11', by: 'nurse' } });
  const row = res.body.rows.find((x) => x.deptId === 'lvl9');
  const nov = row.months['2026-11'];
  assert.equal(nov.records, 4, 'A1, A2, A3, A4 (the draft is not a result)');
  const exp = [A1b, A2, A3, A4].reduce((s, x) => ({ y: s.y + x.result.yes, n: s.n + x.result.no }), { y: 0, n: 0 });
  assert.equal(nov.kpis.find((k) => k.id === 'kpi1').value, DA.round1(exp.y / (exp.y + exp.n) * 100), 'KPI-1 = Σ Yes ÷ Σ (Yes + No)');
  assert.equal(nov.kpis.find((k) => k.id === 'kpi4').value, 50, 'KPI-4: 2 of 4 records with a critical failure');
  assert.equal(nov.kpis.find((k) => k.id === 'kpi4').met, false);
  assert.equal(nov.kpis.find((k) => k.id === 'kpi6').value, DA.round1(11 / 12 * 100), 'KPI-6 over criteria 9–11 only');
  assert.equal(nov.topFailing[0].id, 'c3', 'the most failed criterion first');
  assert.ok(res.body.breakdown.find((b) => b.label === 'Rina Akter').summary.records === 3);
  assert.equal(res.body.rows.some((x) => x.deptId === 'er'), false, 'other departments are not mine');
  const prev = DA.summarize([{ result: DA.score(Object.assign(allYes(IPD), { c1: 'N' }), IPD.criteria), answers: {}, criteria: IPD.criteria }], IPD.kpis);
  assert.deepEqual(DA.capDue(prev, nov).sort(), ['kpi2', 'kpi3', 'kpi4'], 'the same KPIs below target two months running (KPI-3: 0% then 25% fully compliant)');

  const figs = await docAudit.monthlyFigures(['2026-10', '2026-11']);
  assert.equal(figs['2026-10'], undefined);
  assert.equal(figs['2026-11'].num, exp.y); assert.equal(figs['2026-11'].den, exp.y + exp.n); assert.equal(figs['2026-11'].source, 'doc-audit');
  assert.equal(figs['2026-11'].byDept[0].records, 4);
  const def2C = { id: 'kpi-documentation', formula: 'pct', source: { indId: 'ind-nursing-documentation-accuracy', rule: null } };
  assert.equal(link.ruleOf(def2C), 'docaudit', 'KPI 2C reads the audits');
  const cell = link.linkedMonthlyFrom({ areas: [], months: ['2026-11'], docAudit: figs }, def2C, ['2026-11'])['2026-11'];
  assert.deepEqual([cell.num, cell.den, cell.value, cell.source], [exp.y, exp.y + exp.n, figs['2026-11'].value, 'doc-audit']);
  const ctx = await link.loadContext(['2026-11'], { getQuality: async () => [], overlays: async () => ({ quality: {} }), getFormulas: async () => [], deptmap: { get: async () => null } });
  assert.equal(ctx.docAudit['2026-11'].num, exp.y, 'the KPI context loads the audit figures');
  const exp2 = await docAudit.enabledDepts();
  assert.deepEqual(exp2.map((d) => d.deptId).sort(), ['dialysis', 'er', 'lvl9'], 'expected departments: the enabled ones (OPD is not audited)');
  assert.equal(exp2[0].since, '2026-11', 'expected only from the month the module was set up');

  /* ---- settings ---- */
  assert.equal((await call('PUT /api/doc-audit/config', incharge, { body: { kpiLink: false } })).status, 403);
  res = await call('PUT /api/doc-audit/config', admin, { body: { depts: { opd: { toolId: 'ipd25', enabled: true, minRecords: 5 } }, kpiLink: false } });
  assert.equal(res.body.changed, 2);
  assert.deepEqual(await docAudit.monthlyFigures(['2026-11']), {}, 'the KPI link can be switched off');
  await call('PUT /api/doc-audit/config', admin, { body: { kpiLink: true } });
  res = await call('GET /api/doc-audit/config', admin);
  assert.equal(res.body.departments.find((d) => d.id === 'opd').cfg.toolId, 'ipd25');

  /* ---- the staff profile card, print, Excel ---- */
  res = await call('GET /api/doc-audit/staff/:staffId', incharge, { params: { staffId: '1' } });
  assert.equal(res.body.audits.length, 3); assert.equal(res.body.thisQuarter, 3);
  assert.ok(!('uhid' in res.body.audits[0]), 'the profile card carries no patient identifier');
  assert.equal((await call('GET /api/doc-audit/staff/:staffId', outsider, { params: { staffId: '1' } })).status, 403, 'the profile card needs its own grant');
  assert.equal((await call('GET /api/doc-audit/staff/:staffId', admin, { params: { staffId: '1' } })).status, 200, 'administrators always');
  assert.equal((await call('GET /api/doc-audit/staff/:staffId', { unrestricted: false, username: 'hr', name: 'HR', role: 'User', perms: {}, auditProfileView: true }, { params: { staffId: '1' } })).body.audits.length, 3, 'given it, no module needed');
  assert.equal((await call('POST /api/doc-audit/print', auditor, { body: { kind: 'audit', id: A2.id } })).status, 403, 'Print is its own grant');
  res = await call('POST /api/doc-audit/print', admin, { body: { kind: 'audit', id: A2.id } });
  assert.equal(res.status, 200); assert.equal(logged[logged.length - 1].action, 'docaudit_print');
  res = await call('GET /api/doc-audit/xlsx', admin, { query: { from: '2026-11', to: '2026-11' } });
  assert.equal(Buffer.isBuffer(res.body) && res.body.slice(0, 2).toString(), 'PK', 'an xlsx file');
  assert.equal(logged[logged.length - 1].action, 'docaudit_export');
  res = await call('GET /api/doc-audit/missing', incharge);
  assert.equal(res.body.awaitingAck, 0, 'no acknowledgement queue while it is optional');
  assert.ok(res.body.awaitingSign >= 1, 'completed audits are ready to publish');
  res = await call('DELETE /api/doc-audit/audits/:id', incharge, { params: { id: A3.id }, body: { reason: 'duplicate' } });
  assert.equal(res.status, 200);
  assert.equal((await call('GET /api/doc-audit/audits/:id', incharge, { params: { id: A3.id } })).status, 404, 'removed = gone from the register, kept in the store');
  assert.ok(docAudit._mem.docAudits.get(A3.id).removedAt, 'never hard-deleted');

  /* ---- several nurses on one audit (1 record : 3 nurses) ---- */
  const shapla = { unrestricted: false, username: 'shapla', name: 'Shapla Khatun', role: 'User', perms: {}, staffId: 5 };
  const before = (await docAudit.monthlyFigures(['2026-11']))['2026-11'].records;
  res = await call('POST /api/doc-audit/audits', incharge, { body: Object.assign({}, base, { uhid: 'UH-300', nurses: [{ staffId: 1 }, { staffId: 5 }, { staffId: '5' }, { name: 'Agency Nurse B', empId: 'X9' }], answers: Object.assign(allYes(IPD), { c4: 'N' }), complete: true }) });
  assert.equal(res.status, 200);
  const M = res.body.audit;
  assert.deepEqual(M.nurses.map((n) => n.name), ['Rina Akter', 'Shapla Khatun', 'Agency Nurse B'], 'three nurses, the duplicate dropped');
  assert.equal(M.nurse.staffId, '1', 'nurse = the first, for older readers'); assert.equal(M.nurses[2].linked, false);
  assert.equal(M.result.pct, DA.score(Object.assign(allYes(IPD), { c4: 'N' }), M.criteria).pct, 'one shared checklist, one score');
  assert.equal((await call('POST /api/doc-audit/audits', auditor, { body: Object.assign({}, base, { nurses: [{ staffId: 1 }, { staffId: 3 }], answers: allYes(IPD), complete: true }) })).body.code, 'self', 'the auditor cannot be one of the nurses');
  res = await call('POST /api/doc-audit/audits', auditor, { body: Object.assign({}, base, { nurses: [{ staffId: 1 }, { staffId: 2 }], answers: allYes(IPD), complete: true }) });
  assert.equal(res.status, 200, 'a shared record with a nurse from another department'); assert.equal(res.body.audit.nurses[1].fromOtherDept, true);
  await call('DELETE /api/doc-audit/audits/:id', admin, { params: { id: res.body.audit.id } });
  assert.equal((await call('POST /api/doc-audit/audits', auditor, { body: Object.assign({}, base, { nurses: Array.from({ length: 7 }, (_, i) => ({ name: 'N' + i })), answers: allYes(IPD), complete: true }) })).status, 400, 'at most 6');
  assert.equal((await docAudit.monthlyFigures(['2026-11']))['2026-11'].records, before + 1, 'the record counts once in the KPI');
  for (const id of ['1', '5']) assert.ok((await call('GET /api/doc-audit/staff/:staffId', incharge, { params: { staffId: id } })).body.audits.some((x) => x.id === M.id), 'on nurse ' + id + '’s record');
  res = await call('GET /api/doc-audit/summary', incharge, { query: { from: '2026-11', to: '2026-11', by: 'nurse' } });
  assert.equal(res.body.breakdown.find((b) => b.label === 'Shapla Khatun').summary.records, 1, 'counted under each nurse');
  assert.ok(res.body.breakdown.find((b) => b.label === 'Agency Nurse B'));
  assert.ok(!(await call('GET /api/doc-audit/mine', shapla)).body.audits.some((x) => x.id === M.id), 'not released before it is published');
  // two of three acknowledge in person; with the switch on, publishing waits and names who is missing
  res = await call('POST /api/doc-audit/audits/:id/ack', incharge, { params: { id: M.id }, body: { keys: ['s:1', 'n:agency nurse b'] } });
  assert.equal(res.body.audit.status, 'completed'); assert.equal(Object.keys(res.body.audit.acks).length, 2);
  await call('PUT /api/doc-audit/config', admin, { body: { ackRequired: true } });
  res = await call('POST /api/doc-audit/audits/:id/sign', incharge2, { params: { id: M.id } });
  assert.equal(res.status, 409); assert.equal(res.body.code, 'ack'); assert.ok(/Shapla/.test(res.body.error), 'names who is missing');
  await call('PUT /api/doc-audit/config', admin, { body: { ackRequired: false } });
  res = await call('POST /api/doc-audit/audits/:id/sign', incharge2, { params: { id: M.id } });
  assert.equal(res.body.audit.status, 'signed', 'published with one acknowledgement outstanding');
  let mine = (await call('GET /api/doc-audit/mine', shapla)).body.audits.find((x) => x.id === M.id);
  assert.deepEqual([mine.myPending, mine.othersPending], [true, 0]);
  res = await call('POST /api/doc-audit/mine/:id/ack', shapla, { params: { id: M.id } });
  assert.equal(res.body.audit.status, 'signed'); assert.equal(res.body.audit.ack.complete, true); assert.equal(res.body.audit.acks['s:5'].method, 'account');
  assert.equal((await call('POST /api/doc-audit/mine/:id/ack', shapla, { params: { id: M.id } })).status, 409, 'once');
  // an older single-nurse audit reads as a list of one
  res = await call('GET /api/doc-audit/audits/:id', incharge, { params: { id: A2.id } });
  assert.equal(res.body.audit.nurses.length, 1); assert.equal(res.body.audit.nurses[0].name, 'Rina Akter');
  res = await call('GET /api/doc-audit/xlsx', admin, { query: { from: '2026-11', to: '2026-11' } });
  assert.equal(res.body.slice(0, 2).toString(), 'PK');

  /* ---- bulk on the Register ---- */
  const mk = async (who, uhid, ans, complete) => (await call('POST /api/doc-audit/audits', who, { body: Object.assign({}, base, { uhid, nurse: { staffId: 1 }, answers: ans, complete: !!complete }) })).body.audit;
  const d1 = await mk(auditor, 'UH-B1', allYes(IPD)), d2 = await mk(auditor, 'UH-B2', allYes(IPD)), d3 = await mk(auditor, 'UH-B3', { c1: 'Y' });
  const own = await mk(incharge, 'UH-B4', allYes(IPD), true);
  res = await call('POST /api/doc-audit/bulk', auditor, { body: { action: 'complete', ids: [d1.id, d2.id, d3.id] } });
  assert.equal(res.body.done, 2); assert.equal(res.body.skipped.length, 1); assert.ok(/not answered/.test(res.body.skipped[0].why), 'an unfinished draft is skipped with why');
  assert.equal((await call('POST /api/doc-audit/bulk', auditor, { body: { action: 'publish', ids: [d1.id] } })).status, 403, 'bulk publish needs Edit');
  res = await call('POST /api/doc-audit/bulk', incharge, { body: { action: 'publish', ids: [d1.id, d2.id, own.id, 'nope'] } });
  assert.equal(res.body.done, 2); assert.deepEqual(res.body.skipped.map((x) => x.why).sort(), ['You filled this audit, so another person must publish it.', 'not found'].sort());
  assert.equal((await call('GET /api/doc-audit/audits/:id', incharge, { params: { id: d1.id } })).body.audit.status, 'signed');
  res = await call('POST /api/doc-audit/bulk', outsider, { body: { action: 'complete', ids: [d3.id] } });
  assert.equal(res.body.skipped[0].why, 'This department is not one of yours.');
  res = await call('POST /api/doc-audit/bulk', incharge, { body: { action: 'remove', ids: [d1.id, d3.id], reason: 'test' } });
  assert.equal(res.body.done, 1); assert.ok(/administrator/.test(res.body.skipped[0].why), 'a published audit is removed only by an administrator');
  res = await call('GET /api/doc-audit/xlsx', admin, { query: { ids: [d1.id, d2.id, d3.id].join(',') } });
  assert.equal(res.body.slice(0, 2).toString(), 'PK', 'Excel of the ticked audits (the removed one left out)');
  assert.ok(/2 audit/.test(logged[logged.length - 1].opts.detail));
  assert.equal((await call('POST /api/doc-audit/print', outsider, { body: { kind: 'bulk', ids: [d2.id] } })).status, 403);
  assert.equal((await call('POST /api/doc-audit/print', admin, { body: { kind: 'bulk', ids: [d1.id, d2.id] } })).status, 200);
  assert.ok(logged.some((l) => l.action === 'docaudit_audit' && /published \(/.test(l.opts.detail)), 'each audit logged');

  /* ---- Aldrete on an OT audit; the one-shot OT / Cath Lab split of an older install ---- */
  res = await call('POST /api/doc-audit/audits', admin, { body: { deptId: 'lvl9', toolId: 'ot20', date: '2026-11-10', uhid: 'UH-OT1', area: 'Post-operative / Recovery (PACU)', nurse: { staffId: 1 }, extra: { aldreteIn: { a: 2, r: 2, c: 1, co: 1, o: 2, total: 99 }, aldreteOut: { a: 'x' } }, answers: {} } });
  assert.deepEqual(res.body.audit.extra.aldreteIn, { a: 2, r: 2, c: 1, co: 1, o: 2, total: 8, complete: true }, 'Aldrete kept, total recomputed');
  assert.equal(res.body.audit.extra.aldreteOut, undefined, 'nothing scored = nothing kept');
  assert.equal(res.body.audit.criteria.length, 18, 'a new OT audit has 18 criteria');
  await call('DELETE /api/doc-audit/audits/:id', admin, { params: { id: res.body.audit.id } });
  // an install from before the split: one shared tool, the Cath Lab department set to it
  const old = catalogue.seedTools().find((t) => t.id === 'ot20');
  old.criteria = old.criteria.map((c) => Object.assign({}, c, { active: true, no: +c.id.slice(1) }));
  delete old.cathSplit; old.name = 'OT & Cath Lab Documentation Accuracy Audit (20 points)'; old.short = 'OT & Cath Lab 20-point';
  old.header.areas = ['Major OT', 'Minor OT', 'Emergency OT', 'Day-care OT', 'Obstetric OT', 'Cath Lab']; old.header.extra = old.header.extra.filter((f) => f.type !== 'aldrete');
  old.naGuide = [{ areas: ['Major OT', 'Obstetric OT'], na: ['c16', 'c17'], note: 'D = N/A' }, { areas: ['Cath Lab'], note: 'All apply' }];
  const { id: oldId, ...oldRest } = old;
  docAudit._mem.docAuditTools.set('ot20', Object.assign({ _id: 'ot20' }, oldRest, { revision: 1, updatedAt: 1 }));
  docAudit._mem.docAuditTools.delete('cath20');
  docAudit._mem.cfg = Object.assign({}, docAudit._mem.cfg, { cathSplitAt: undefined, depts: { cathlab: { toolId: 'ot20', enabled: true, minRecords: 10 }, ot: { toolId: 'ot20', enabled: true, minRecords: 10 } } });
  assert.equal(await docAudit.ensureCathSplit(5000), true);
  const ot20 = docAudit._mem.docAuditTools.get('ot20');
  assert.equal(ot20.criteria.filter((c) => c.active !== false).length, 18); assert.equal(ot20.revision, 2); assert.equal(ot20.name, 'OT Documentation Accuracy Audit (18 points)');
  assert.ok(ot20.header.areas.indexOf('Cath Lab') < 0 && ot20.header.areas.indexOf('Post-operative / Recovery (PACU)') >= 0);
  assert.equal(ot20.header.extra.filter((f) => f.type === 'aldrete').length, 2);
  assert.deepEqual(ot20.naGuide.map((g) => g.areas.join()), ['Major OT,Obstetric OT', 'Post-operative / Recovery (PACU)']);
  assert.ok(docAudit._mem.docAuditTools.get('cath20'), 'the Cath Lab tool is created');
  assert.deepEqual([docAudit._mem.cfg.depts.cathlab.toolId, docAudit._mem.cfg.depts.ot.toolId], ['cath20', 'ot20'], 'the Cath Lab department moves to its own tool');
  assert.equal(await docAudit.ensureCathSplit(6000), false, 'once only');

  console.log('doc-audit: all assertions passed');
})().catch((e) => { console.error(e); process.exit(1); });
