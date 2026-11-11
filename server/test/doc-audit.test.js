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
const incharge = person('incharge', ['view', 'add', 'edit', 'delete'], ['lvl9'], null);
const outsider = person('outsider', ['view', 'add'], ['er'], null);
const viewer = person('viewer', ['view'], ['lvl9'], null);
const nurseAcct = { unrestricted: false, username: 'rina', name: 'Rina Akter', role: 'User', perms: {}, staffId: 1 };
const admin = { unrestricted: true, username: 'admin', name: 'Admin', role: 'Administrator' };
const IPD = catalogue.TOOLS.find((t) => t.id === 'ipd25');
const allYes = (tool) => { const a = {}; tool.criteria.forEach((c) => { a[c.id] = 'Y'; }); return a; };

(async () => {
  /* ---- the four tools are the policies' ---- */
  const crit = (id) => catalogue.TOOLS.find((t) => t.id === id).criteria.filter((c) => c.critical).map((c) => c.no);
  assert.deepEqual(catalogue.TOOLS.map((t) => [t.id, t.criteria.length]), [['ipd25', 25], ['ot20', 20], ['dial20', 20], ['ed20', 20]]);
  assert.deepEqual(crit('ipd25'), [1, 2, 7, 8, 9, 11, 16, 17, 18, 19, 20, 21, 24], 'QA-001 §8.3: 13 critical');
  assert.deepEqual(crit('ot20'), [1, 3, 4, 5, 7, 8, 13, 15, 20], 'QA-002: 9 critical');
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
  assert.equal(res.body.tools.length, 4, 'the four tools are seeded');
  assert.equal(res.body.staffId, '3');
  res = await call('GET /api/doc-audit/staff', auditor, { query: { dept: 'lvl9' } });
  assert.deepEqual(res.body.staff.map((p) => p.id).sort(), [1, 3], 'Level 9 staff only, never a former one');
  assert.ok(!('phone' in res.body.staff[0]), 'thin records');
  assert.equal((await call('GET /api/doc-audit/staff', auditor, { query: { dept: 'er' } })).status, 403);
  assert.equal((await call('GET /api/doc-audit/meta', person('nobody', [], ['lvl9']))).status, 403);

  const base = { deptId: 'lvl9', date: '2026-11-10', shift: 'Morning', uhid: 'UH-100', bed: '9-12', area: 'Cabin Level 9' };
  res = await call('POST /api/doc-audit/audits', auditor, { body: Object.assign({}, base, { nurse: { staffId: 3 }, answers: allYes(IPD), complete: true }) });
  assert.equal(res.status, 409); assert.equal(res.body.code, 'self', 'nobody audits their own documentation');
  res = await call('POST /api/doc-audit/audits', auditor, { body: Object.assign({}, base, { nurse: { staffId: 2 }, answers: allYes(IPD) }) });
  assert.equal(res.status, 403, 'a nurse outside my departments cannot be picked');
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

  /* ---- the sign-off chain ---- */
  res = await call('POST /api/doc-audit/audits/:id/sign', incharge, { params: { id: A1.id } });
  assert.equal(res.status, 409); assert.equal(res.body.code, 'ack', 'the nurse acknowledges first');
  res = await call('POST /api/doc-audit/audits/:id/ack', auditor, { params: { id: A1.id }, body: { note: 'Feedback given at the station' } });
  assert.equal(res.body.audit.status, 'acknowledged'); assert.equal(res.body.audit.ack.method, 'in-person');
  assert.equal((await call('POST /api/doc-audit/audits/:id/sign', auditor, { params: { id: A1.id } })).status, 403, 'sign-off needs Edit');
  await call('POST /api/doc-audit/audits/:id/ack', incharge, { params: { id: A3.id } });
  res = await call('POST /api/doc-audit/audits/:id/sign', incharge, { params: { id: A3.id } });
  assert.equal(res.body.code, 'own', 'nobody signs off their own audit');
  res = await call('POST /api/doc-audit/audits/:id/sign', incharge, { params: { id: A1.id }, body: { note: 'Reviewed' } });
  assert.equal(res.body.audit.status, 'signed');
  res = await call('PUT /api/doc-audit/audits/:id', incharge, { params: { id: A1.id }, body: { remarks: 'x' } });
  assert.equal(res.status, 409); assert.equal(res.body.code, 'locked', 'signed = locked');
  assert.equal((await call('DELETE /api/doc-audit/audits/:id', incharge, { params: { id: A1.id } })).status, 409, 'only an admin removes a signed audit');
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
  assert.equal(res.body.linked, true); assert.equal(res.body.audits.length, 2, 'drafts are not shown');
  assert.ok(res.body.audits.find((x) => x.id === A2.id).gaps.some((g) => g.no === 9 && g.critical));
  assert.equal((await call('POST /api/doc-audit/mine/:id/ack', nurseAcct, { params: { id: A2.id } })).body.audit.ack.method, 'account');
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
  assert.equal((await call('GET /api/doc-audit/staff/:staffId', outsider, { params: { staffId: '1' } })).body.audits.length, 0, 'only audits of my departments');
  assert.equal((await call('POST /api/doc-audit/print', auditor, { body: { kind: 'audit', id: A2.id } })).status, 403, 'Print is its own grant');
  res = await call('POST /api/doc-audit/print', admin, { body: { kind: 'audit', id: A2.id } });
  assert.equal(res.status, 200); assert.equal(logged[logged.length - 1].action, 'docaudit_print');
  res = await call('GET /api/doc-audit/xlsx', admin, { query: { from: '2026-11', to: '2026-11' } });
  assert.equal(Buffer.isBuffer(res.body) && res.body.slice(0, 2).toString(), 'PK', 'an xlsx file');
  assert.equal(logged[logged.length - 1].action, 'docaudit_export');
  res = await call('GET /api/doc-audit/missing', incharge);
  assert.ok(res.body.awaitingAck >= 1, 'completed audits wait for the nurse');
  res = await call('DELETE /api/doc-audit/audits/:id', incharge, { params: { id: A3.id }, body: { reason: 'duplicate' } });
  assert.equal(res.status, 200);
  assert.equal((await call('GET /api/doc-audit/audits/:id', incharge, { params: { id: A3.id } })).status, 404, 'removed = gone from the register, kept in the store');
  assert.ok(docAudit._mem.docAudits.get(A3.id).removedAt, 'never hard-deleted');

  console.log('doc-audit: all assertions passed');
})().catch((e) => { console.error(e); process.exit(1); });
