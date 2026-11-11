/* Nursing Documentation Audit — the policy UHP-NSG-QA-001 (and its OT / Dialysis & Endoscopy /
 * Emergency companions QA-002…004), online (module 'docaudit').
 *
 *   docAuditTools   one document per audit tool: sections, criteria (critical flag, JCI chapters),
 *                   the tool's KPIs, the form header (areas / zones, extra fields), the N/A guide and
 *                   the sample rule. Seeded once from server/doc-audit-catalogue.js; after that the
 *                   administrator's. `revision` goes up whenever something that scores changes.
 *   docAudits       one document per audited patient record: department, area, date, shift, UHID,
 *                   the nurse audited (snapshot of the staff record, linked by the RECORD id — never
 *                   the employee number), the auditor, Yes / No / N/A + evidence per criterion, the
 *                   result (computed HERE, never taken from the browser), and the sign-off chain
 *                   draft → completed → acknowledged (by the nurse) → signed (Nurse In-charge).
 *                   Each audit keeps a frozen copy of its criteria, so editing a tool later never
 *                   changes an old score.
 *   docAuditConfig  _id 'config': which tool each department audits with, minimum records a month,
 *                   whether the audits feed Nursing KPI 2C, whether acknowledgement is required.
 *   docAuditCaps    _id '<deptId>:<YYYY-MM>': the department's Corrective Action Plan (Appendix B).
 *
 * Access is module 'docaudit', per person: View = register, reports, dashboards for their
 * departments; Add = fill audits and record the nurse's acknowledgement; Edit = correct completed
 * audits, In-charge sign-off, action plans; Delete = remove an audit (soft); Print = print, PDF,
 * Excel — logged first. Which departments: users.auditDepartments ('*' = all; access.auditDeptIds).
 * Nobody audits their own documentation (policy 7.3) and nobody signs off their own audit, except an
 * administrator. Tools and Settings are administrator-only. Nothing is ever hard-deleted.
 * The scoring rule is renderer/unico/doc-audit-core.js, shared with the browser.
 */
const crypto = require('crypto');
const access = require('./access');
const deptmap = require('./deptmap');
const activity = require('./activity-log');
const { getDbHandle, getDepartments, getUsers } = require('./db');
const DA = require('../renderer/unico/doc-audit-core.js');
const catalogue = require('./doc-audit-catalogue');

const TOOLS = 'docAuditTools', AUDITS = 'docAudits', CFG = 'docAuditConfig', CAPS = 'docAuditCaps';
const mem = { [TOOLS]: new Map(), [AUDITS]: new Map(), [CAPS]: new Map(), cfg: null };
const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
let DEPS = {};   // test hooks: roster(), depts(), users()

async function db() { try { return await getDbHandle(); } catch (e) { return null; } }
let indexed = false;
async function coll(name) {
  const d = await db();
  if (!d) return null;
  if (!indexed) {
    indexed = true;
    d.collection(AUDITS).createIndex({ deptId: 1, month: 1 }).catch(() => {});
    d.collection(AUDITS).createIndex({ 'nurse.staffId': 1, date: -1 }).catch(() => {});
    d.collection(AUDITS).createIndex({ status: 1, month: 1 }).catch(() => {});
  }
  return d.collection(name);
}

/* ---------------------------------------------------------------- storage --- */
async function getDoc(name, id) {
  const c = await coll(name);
  if (!c) return clone(mem[name].get(id)) || null;
  return c.findOne({ _id: id });
}
async function allDocs(name) {
  const c = await coll(name);
  if (!c) return [...mem[name].values()].map(clone);
  return c.find({}).toArray();
}
// Write `doc` only if the stored copy still carries `expect` (null = must not exist yet).
async function putDoc(name, doc, expect) {
  const c = await coll(name);
  if (!c) {
    const cur = mem[name].get(doc._id);
    if ((cur ? cur.updatedAt : null) !== (expect == null ? null : expect)) return false;
    mem[name].set(doc._id, clone(doc));
    return true;
  }
  if (expect == null) {
    try { await c.insertOne(doc); return true; } catch (e) { if (e && e.code === 11000) return false; throw e; }
  }
  const { _id, ...rest } = doc;
  const r = await c.replaceOne({ _id, updatedAt: expect }, rest);
  return r.matchedCount === 1;
}
/* Audits matching { depts (null = all), months, from/to (dates), statuses, staffId, toolId, drafts }.
   Removed audits never; drafts only when asked (they are not results yet). */
async function findAudits(q) {
  const c = await coll(AUDITS);
  const ok = (a) => !a.removedAt
    && (!q.depts || q.depts.indexOf(a.deptId) >= 0)
    && (!q.months || q.months.indexOf(a.month) >= 0)
    && (!q.from || a.date >= q.from) && (!q.to || a.date <= q.to)
    && (!q.statuses || q.statuses.indexOf(a.status) >= 0)
    && (q.drafts || a.status !== 'draft')
    && (q.staffId == null || (a.nurse && String(a.nurse.staffId) === String(q.staffId)))
    && (!q.toolId || a.toolId === q.toolId);
  let list;
  if (!c) list = [...mem[AUDITS].values()].map(clone).filter(ok);
  else {
    const m = { removedAt: null };
    if (q.depts) m.deptId = { $in: q.depts };
    if (q.months) m.month = { $in: q.months };
    if (q.from || q.to) { m.date = {}; if (q.from) m.date.$gte = q.from; if (q.to) m.date.$lte = q.to; }
    if (q.statuses) m.status = { $in: q.statuses };
    else if (!q.drafts) m.status = { $ne: 'draft' };
    if (q.staffId != null) m['nurse.staffId'] = String(q.staffId);
    if (q.toolId) m.toolId = q.toolId;
    list = (await c.find(m).limit(q.limit || 5000).toArray()).filter(ok);
  }
  return list.sort((x, y) => (y.date || '').localeCompare(x.date || '') || (y.createdAt || 0) - (x.createdAt || 0)).slice(0, q.limit || 5000);
}
async function getConfig() {
  const d = await db();
  if (!d) return mem.cfg || { _id: 'config' };
  return (await d.collection(CFG).findOne({ _id: 'config' })) || { _id: 'config' };
}
async function patchConfig(set) {
  const d = await db();
  if (!d) { mem.cfg = Object.assign({ _id: 'config' }, mem.cfg || {}, set); return; }
  await d.collection(CFG).updateOne({ _id: 'config' }, { $set: set }, { upsert: true });
}

/* The four policy tools, once. After that the tools are the administrator's: archiving one must
   not bring it back, so the marker lives in the config, not in "the collection is empty". */
async function ensureSeed(now) {
  const cfg = await getConfig();
  if (cfg.seededAt) return 0;
  const have = new Set((await allDocs(TOOLS)).map((d) => d._id));
  let n = 0;
  for (const t of catalogue.seedTools()) {
    if (have.has(t.id)) continue;
    const { id, ...rest } = t;
    if (await putDoc(TOOLS, Object.assign({ _id: id }, rest, { revision: 1, createdAt: now, createdBy: 'seed', updatedAt: now, updatedBy: 'seed', history: [{ at: now, by: 'seed', action: 'seeded from ' + t.code + ' v' + t.version }] }), null)) n++;
  }
  await patchConfig({ seededAt: now });
  return n;
}
async function liveTools() { return (await allDocs(TOOLS)).filter(DA.isLiveTool).sort((a, b) => (a.order || 0) - (b.order || 0)); }

/* ------------------------------------------------------------ departments --- */
async function allDepts() {
  const [map, depts] = await Promise.all([deptmap.get().catch(() => null), (DEPS.depts ? DEPS.depts() : getDepartments()).catch(() => [])]);
  const byId = Object.assign({}, ...(depts || []).filter((d) => d && d.id).map((d) => ({ [d.id]: { id: d.id, name: d.name } })), (map && map.byId) || {});
  return Object.values(byId)
    .filter((d) => d && d.id && String(d.id) !== '__hospital__' && !d.qualityOnly)
    .map((d) => ({ id: String(d.id), name: d.name || d.id }))
    .sort((x, y) => String(x.name).localeCompare(String(y.name)));
}
// A department's audit settings: what the administrator saved, else the guess from its name.
function cfgFor(cfg, dept) {
  const saved = ((cfg && cfg.depts) || {})[dept.id];
  if (saved) return { toolId: saved.toolId || null, enabled: saved.enabled !== false && !!saved.toolId, minRecords: Number.isInteger(saved.minRecords) ? saved.minRecords : 10, saved: true };
  const g = catalogue.guessTool(dept);
  return g ? { toolId: g.toolId, enabled: true, minRecords: g.minRecords, saved: false } : { toolId: null, enabled: false, minRecords: 10, saved: false };
}
async function myDepts(a, cfg) {
  const ids = access.auditDeptIds(a);
  return (await allDepts()).filter((d) => ids === null || ids.indexOf(d.id) >= 0)
    .map((d) => Object.assign({}, d, { cfg: cfgFor(cfg, d) })).filter((d) => d.cfg.enabled);
}

/* ------------------------------------------------------------------ staff --- */
async function loadRoster() {
  const list = DEPS.roster ? await DEPS.roster() : await require('./staff-roster').loadRoster({ cached: true });
  return (list || []).filter((r) => r && !r.former);
}
// The staff record of the signed-in account: { id, sure } — sure = linked on the account itself.
async function myStaffId(a) {
  if (!a) return null;
  if (a.staffId != null && a.staffId !== '') return { id: String(a.staffId), sure: true };
  try {
    const roster = await loadRoster();
    let doc = null;
    const col = DEPS.users ? null : await getUsers().catch(() => null);
    if (col && typeof col.findOne === 'function') doc = await col.findOne({ username: String(a.username || '').toLowerCase() });
    const acct = Object.assign({ username: a.username, name: a.name, staffId: a.staffId, staffEmpId: a.staffEmpId }, doc || {});
    if (!acct.staffEmpId && doc) acct.staffEmpId = doc.empId || doc.emp_id || '';
    const rec = require('./account-staff').staffOfAccount(acct, roster);
    return rec ? { id: String(rec.id), sure: false } : null;
  } catch (e) { return null; }
}
// The register records an auditor may pick: the staff of their departments (portalStaff matches
// ids, names, local spellings and the Level-N rule), thin. `null` scope = the whole register.
function thinStaff(roster, deptsInScope, all) {
  if (all) return roster.map((p) => { const o = {}; access.MYDEPT_STAFF_FIELDS.forEach((k) => { if (p[k] !== undefined) o[k] = p[k]; }); return o; });
  const keys = [];
  deptsInScope.forEach((d) => { keys.push(d.id); if (d.name) keys.push(d.name); });
  return access.portalStaff(keys, roster, access.MYDEPT_STAFF_FIELDS);
}
const nurseSnap = (p) => ({ staffId: String(p.id), empId: String(p.emp_id || ''), name: String(p.name || ''), designation: String(p.designation || ''), department: String(p.current_department || ''), role: String(p.role || ''), linked: true });

/* ---------------------------------------------------------------- helpers --- */
const actor = (req, a) => (a && a.username) || (req.user && req.user.sub) || 'local';
const nameOf = (req, a) => (a && a.name) || (req.user && req.user.name) || actor(req, a);
const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const newId = () => 'da' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
const clean = (x) => { if (!x) return null; const { _id, history, ...rest } = x; return Object.assign({ id: _id }, rest, { history: (history || []).slice(-25) }); };
const cleanTool = (t) => { if (!t) return null; const { _id, history, ...rest } = t; return Object.assign({ id: _id }, rest, { history: (history || []).slice(-15) }); };
// What leaves the server about an audit outside its own screen (profile card, the nurse's list).
const thinAudit = (x) => ({
  id: x._id, toolId: x.toolId, toolName: x.toolName || '', deptId: x.deptId, deptName: x.deptName, area: x.area || '', date: x.date, month: x.month, shift: x.shift || '',
  status: x.status, result: x.result ? { pct: x.result.pct, grade: x.result.grade, gradeLabel: x.result.gradeLabel, result: x.result.result, criticalFails: (x.result.criticalFails || []).length, yes: x.result.yes, no: x.result.no, na: x.result.na } : null,
  auditor: x.auditor ? { name: x.auditor.name } : null, ack: x.ack || null, signoff: x.signoff ? { name: x.signoff.name, at: x.signoff.at } : null,
});

// The fields of an audit a person may set. `tool` decides which extra fields exist.
function pickAudit(b, tool, criteria) {
  const ids = new Set(DA.activeCriteria(criteria).map((c) => c.id));
  const answers = {}, evidence = {}, extra = {};
  const ba = (b.answers && typeof b.answers === 'object') ? b.answers : {};
  const be = (b.evidence && typeof b.evidence === 'object') ? b.evidence : {};
  Object.keys(ba).forEach((k) => { if (ids.has(k) && DA.ANSWERS.indexOf(ba[k]) >= 0) answers[k] = ba[k]; });
  Object.keys(be).forEach((k) => { const v = str(be[k], 800); if (ids.has(k) && v) evidence[k] = v; });
  const xs = ((tool && tool.header && tool.header.extra) || []);
  const bx = (b.extra && typeof b.extra === 'object') ? b.extra : {};
  xs.forEach((f) => { const v = str(bx[f.id], 200); if (v) extra[f.id] = v; });
  return {
    area: str(b.area, 120), date: DA.isDate(b.date) ? b.date : '', shift: DA.SHIFTS.indexOf(b.shift) >= 0 ? b.shift : '',
    uhid: str(b.uhid, 40), bed: str(b.bed, 60), extra, answers, evidence, remarks: str(b.remarks, 2000),
  };
}
const SCORED = ['answers', 'evidence', 'nurse', 'area', 'date', 'uhid'];
function changesOf(cur, next) {
  if (!cur) return [];
  const out = [];
  ['area', 'date', 'shift', 'uhid', 'bed', 'remarks'].forEach((k) => { if (String(cur[k] || '') !== String(next[k] || '')) out.push(k); });
  if (JSON.stringify(cur.extra || {}) !== JSON.stringify(next.extra || {})) out.push('header');
  const ca = cur.answers || {}, na = next.answers || {};
  const changed = [...new Set(Object.keys(ca).concat(Object.keys(na)))].filter((k) => ca[k] !== na[k]);
  if (changed.length) out.push('answers ' + changed.map((k) => k.replace('c', '#') + ' ' + (ca[k] || '—') + '→' + (na[k] || '—')).join(' '));
  if (JSON.stringify(cur.evidence || {}) !== JSON.stringify(next.evidence || {})) out.push('evidence');
  if (String((cur.nurse || {}).staffId || (cur.nurse || {}).name) !== String((next.nurse || {}).staffId || (next.nurse || {}).name)) out.push('nurse');
  return out;
}
const SLUG = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);

/* A tool from a request body. Ids already used stay exactly as they are (an id is a data key);
   a criterion left out of the request is KEPT, switched off — removing one never loses the answers
   old audits hold for it. New criteria get fresh ids. */
function pickTool(b, cur) {
  const c = cur || {};
  const out = {
    name: str(b.name, 160) || c.name || 'New audit tool', short: str(b.short, 60) || c.short || '', code: str(b.code, 40), version: str(b.version, 20) || '1.0',
    scope: str(b.scope, 600),
  };
  const secIn = Array.isArray(b.sections) ? b.sections.slice(0, 20) : (c.sections || []);
  const secs = [];
  secIn.forEach((s, i) => {
    if (!s || !str(s.title, 120)) return;
    let id = str(s.id, 6).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!id || secs.some((x) => x.id === id)) { let k = 0; do { id = String.fromCharCode(65 + ((secs.length + k) % 26)) + (secs.length + k >= 26 ? String(secs.length + k) : ''); k++; } while (secs.some((x) => x.id === id)); }
    secs.push({ id, title: str(s.title, 120), jci: str(s.jci, 80) });
  });
  if (!secs.length) secs.push({ id: 'A', title: 'Section A', jci: '' });
  out.sections = secs;
  const curCrit = c.criteria || [];
  const used = new Set(curCrit.map((x) => x.id));
  let maxN = curCrit.reduce((m, x) => Math.max(m, +String(x.id).replace(/\D/g, '') || 0), 0);
  const crIn = Array.isArray(b.criteria) ? b.criteria.slice(0, 80) : curCrit;
  const seen = new Set();
  const crits = [];
  crIn.forEach((x) => {
    if (!x || !str(x.text, 1000)) return;
    let id = used.has(x.id) && !seen.has(x.id) ? x.id : null;
    if (!id) { maxN++; id = 'c' + maxN; }
    seen.add(id);
    crits.push({ id, no: 0, sectionId: secs.some((s) => s.id === x.sectionId) ? x.sectionId : secs[0].id, text: str(x.text, 1000),
      jci: (Array.isArray(x.jci) ? x.jci : String(x.jci || '').split(/[,\s]+/)).map((j) => str(j, 10).toUpperCase()).filter(Boolean).slice(0, 8),
      critical: x.critical === true, active: x.active !== false });
  });
  // Criteria the request left out stay on the tool, switched off.
  curCrit.forEach((x) => { if (!seen.has(x.id)) crits.push(Object.assign({}, x, { active: false })); });
  // Number the live criteria 1…n in the order given (section order first); switched-off ones keep their old number.
  const order = secs.map((s) => s.id);
  const live = crits.filter((x) => x.active).sort((p, q) => order.indexOf(p.sectionId) - order.indexOf(q.sectionId) || crits.indexOf(p) - crits.indexOf(q));
  live.forEach((x, i) => { x.no = i + 1; });
  crits.forEach((x) => { if (!x.active) x.no = (curCrit.find((y) => y.id === x.id) || {}).no || 0; });
  out.criteria = live.concat(crits.filter((x) => !x.active));
  const liveIds = new Set(live.map((x) => x.id));
  const kIn = Array.isArray(b.kpis) ? b.kpis.slice(0, 12) : (c.kpis || []);
  const kpis = [];
  kIn.forEach((k, i) => {
    if (!k || !str(k.name, 120) || DA.KPI_FORMULAS.indexOf(k.formula) < 0) return;
    let id = SLUG(k.id) || 'kpi' + (i + 1);
    while (kpis.some((x) => x.id === id)) id += 'x';
    const row = { id, code: str(k.code, 20) || 'KPI-' + (kpis.length + 1), name: str(k.name, 120), formula: k.formula,
      target: DA.has(k.target) && isFinite(Number(k.target)) ? Math.max(0, Math.min(100, Number(k.target))) : null, direction: k.direction === 'lower' ? 'lower' : 'higher' };
    if (k.formula === 'subset') row.criteria = (Array.isArray(k.criteria) ? k.criteria : []).filter((x) => liveIds.has(x));
    kpis.push(row);
  });
  if (!kpis.some((k) => k.formula === 'accuracy')) kpis.unshift({ id: 'kpi1', code: 'KPI-1', name: 'Documentation Accuracy Rate', formula: 'accuracy', target: 90, direction: 'higher' });
  out.kpis = kpis;
  const h = (b.header && typeof b.header === 'object') ? b.header : (c.header || {});
  const extra = [];
  (Array.isArray(h.extra) ? h.extra.slice(0, 8) : []).forEach((f) => {
    if (!f || !str(f.label, 80)) return;
    let id = SLUG(f.id) || SLUG(f.label);
    if (!id || extra.some((x) => x.id === id) || ['area', 'date', 'shift', 'uhid', 'bed'].indexOf(id) >= 0) id = 'f' + (extra.length + 1);
    const type = f.type === 'select' ? 'select' : 'text';
    const row = { id, label: str(f.label, 80), type };
    if (type === 'select') { const opts = (Array.isArray(f.options) ? f.options : String(f.options || '').split(/\n|;/)).map((o) => str(o, 80)).filter((o, j, arr) => arr.indexOf(o) === j).slice(0, 20); row.options = [''].concat(opts.filter(Boolean)); }
    extra.push(row);
  });
  out.header = {
    areaLabel: str(h.areaLabel, 40) || 'Area', bedLabel: str(h.bedLabel, 60) || 'Ward / bed no.',
    areas: (Array.isArray(h.areas) ? h.areas : String(h.areas || '').split(/\n|;/)).map((x) => str(x, 120)).filter(Boolean).filter((x, j, arr) => arr.indexOf(x) === j).slice(0, 30),
    extra,
  };
  const nIn = Array.isArray(b.naGuide) ? b.naGuide.slice(0, 20) : (c.naGuide || []);
  out.naGuide = nIn.map((g) => ({
    areas: (Array.isArray(g && g.areas) ? g.areas : []).map((x) => str(x, 120)).filter((x) => out.header.areas.indexOf(x) >= 0),
    na: (Array.isArray(g && g.na) ? g.na : []).filter((x) => liveIds.has(x)),
    never: (Array.isArray(g && g.never) ? g.never : []).filter((x) => liveIds.has(x)),
    note: str(g && g.note, 600),
  })).filter((g) => g.areas.length && (g.na.length || g.never.length || g.note));
  const s = (b.sample && typeof b.sample === 'object') ? b.sample : (c.sample || {});
  out.sample = { minRecords: Number.isInteger(+s.minRecords) ? Math.max(0, Math.min(500, +s.minRecords)) : 10, note: str(s.note, 1000) };
  return out;
}
// Did something that changes a score change? Then the tool's revision goes up.
const scoringOf = (t) => JSON.stringify({ c: (t.criteria || []).map((x) => [x.id, x.text, !!x.critical, x.active !== false, x.sectionId]), k: t.kpis || [] });

/* ----------------------------------------------------------- KPI feeding --- */
/* Σ Yes ÷ Σ (Yes + No) per month over every audit that is a result (not a draft, not removed),
   for Nursing KPI 2C (server/kpi-link.js rule 'docaudit'). { 'YYYY-MM': {num, den, value, …} }. */
async function monthlyFigures(yms) {
  const months = (yms || []).filter(DA.isMonth);
  if (!months.length) return {};
  const cfg = await getConfig();
  if (cfg.kpiLink === false) return {};
  const list = (await findAudits({ months })).filter(DA.countsInKpi);
  const out = {};
  months.forEach((ym) => {
    const mine = list.filter((x) => x.month === ym);
    if (!mine.length) return;
    const byDept = {};
    mine.forEach((x) => {
      const d = byDept[x.deptId] || (byDept[x.deptId] = { deptId: x.deptId, name: x.deptName || x.deptId, records: 0, yes: 0, no: 0 });
      d.records++; d.yes += x.result.yes; d.no += x.result.no;
    });
    const rows = Object.values(byDept).map((d) => Object.assign(d, { value: d.yes + d.no > 0 ? DA.round1((d.yes / (d.yes + d.no)) * 100) : null }));
    const num = rows.reduce((s, d) => s + d.yes, 0), den = rows.reduce((s, d) => s + d.yes + d.no, 0);
    out[ym] = { num, den: den || null, value: den > 0 ? DA.round1((num / den) * 100) : null, source: 'doc-audit', areas: rows.length, records: mine.length, byDept: rows };
  });
  return out;
}
/* The departments expected to audit each month (enabled), for the KPI's "units expected" —
   from the month the module was set up (`since`): no department owes an audit for a month before
   Documentation Audit existed. */
async function enabledDepts() {
  const cfg = await getConfig();
  if (cfg.kpiLink === false) return [];
  const since = cfg.seededAt ? DA.hospitalNow(cfg.seededAt).month : null;
  return (await allDepts()).map((d) => Object.assign({}, d, { cfg: cfgFor(cfg, d) })).filter((d) => d.cfg.enabled)
    .map((d) => ({ deptId: d.id, name: d.name, toolId: d.cfg.toolId, minRecords: d.cfg.minRecords, since }));
}

/* --------------------------------------------------------------- summary --- */
/* Per department × tool × month: counts, every KPI of the tool, the failing criteria, and the
   CAP trigger (the same KPI below target two months running). Plus the hospital total per tool. */
function buildSummary(audits, tools, months, depts, opts) {
  const o = opts || {};
  const toolById = {}; tools.forEach((t) => { toolById[t._id || t.id] = t; });
  const kpisOf = (tid) => (toolById[tid] && toolById[tid].kpis) || [{ id: 'kpi1', code: 'KPI-1', name: 'Documentation Accuracy Rate', formula: 'accuracy', target: 90, direction: 'higher' }];
  const rows = [];
  const groups = DA.groupBy(audits, (x) => x.deptId + '|' + x.toolId);
  const keys = new Set(Object.keys(groups));
  depts.forEach((d) => { if (d.cfg && d.cfg.toolId && (!o.toolId || d.cfg.toolId === o.toolId)) keys.add(d.id + '|' + d.cfg.toolId); });
  [...keys].forEach((k) => {
    const [deptId, toolId] = k.split('|');
    if (o.toolId && toolId !== o.toolId) return;
    const mine = groups[k] || [];
    const d = depts.find((x) => x.id === deptId);
    const kpis = kpisOf(toolId);
    const per = {};
    months.forEach((ym) => { per[ym] = DA.summarize(mine.filter((x) => x.month === ym), kpis); });
    const caps = [];
    months.forEach((ym, i) => { if (i > 0) { const due = DA.capDue(per[months[i - 1]], per[ym]); if (due.length) caps.push({ month: ym, kpis: due }); } });
    rows.push({ deptId, name: (d && d.name) || (mine[0] && mine[0].deptName) || deptId, toolId, minRecords: d && d.cfg ? d.cfg.minRecords : null, months: per, total: DA.summarize(mine, kpis), caps });
  });
  rows.sort((x, y) => String(x.name).localeCompare(String(y.name)));
  const hospital = {};
  Object.entries(DA.groupBy(audits, (x) => x.toolId)).forEach(([tid, list]) => {
    const kpis = kpisOf(tid);
    const per = {}; months.forEach((ym) => { per[ym] = DA.summarize(list.filter((x) => x.month === ym), kpis); });
    hospital[tid] = { months: per, total: DA.summarize(list, kpis) };
  });
  const overall = { months: {}, total: DA.summarize(audits, []) };
  months.forEach((ym) => { overall.months[ym] = DA.summarize(audits.filter((x) => x.month === ym), []); });
  return { rows, hospital, overall };
}
function breakdown(audits, tools, by) {
  const toolById = {}; tools.forEach((t) => { toolById[t._id || t.id] = t; });
  const keyOf = { area: (x) => x.area || '—', shift: (x) => x.shift || '—', nurse: (x) => (x.nurse && (x.nurse.staffId ? 's' + x.nurse.staffId : 'n' + x.nurse.name)) || '—', auditor: (x) => (x.auditor && x.auditor.username) || '—' }[by];
  if (!keyOf) return [];
  return Object.entries(DA.groupBy(audits, keyOf)).map(([key, list]) => {
    const first = list[0];
    const label = by === 'nurse' ? (first.nurse && first.nurse.name) || '—' : by === 'auditor' ? (first.auditor && first.auditor.name) || '—' : key;
    const sub = by === 'nurse' && first.nurse ? [first.nurse.empId, first.nurse.designation].filter(Boolean).join(' · ') : '';
    const kpis = list.every((x) => x.toolId === first.toolId) && toolById[first.toolId] ? toolById[first.toolId].kpis : [];
    return { key, label, sub, staffId: by === 'nurse' && first.nurse ? first.nurse.staffId || null : null, summary: DA.summarize(list, kpis) };
  }).sort((x, y) => (y.summary.records - x.summary.records) || String(x.label).localeCompare(String(y.label)));
}

/* ------------------------------------------------------------------ mount --- */
function mount(app, opts) {
  const guard = (opts && opts.requireApi) || [];
  const now = (opts && opts.now) || (() => Date.now());
  if (opts && opts.deps) DEPS = opts.deps;

  const resolve = async (req, res, action) => {
    const a = req.access || await access.forRequest(req);
    if (!a) { res.status(401).json({ ok: false, error: 'Not authenticated.' }); return null; }
    req.access = a;
    if (action && !access.can(a, 'docaudit', action)) {
      const what = { add: 'fill documentation audits', edit: 'correct or sign off documentation audits', delete: 'remove documentation audits', print: 'print or export documentation audits' }[action] || 'open Documentation Audit';
      res.status(403).json({ ok: false, error: 'You do not have permission to ' + what + '.' });
      return null;
    }
    await ensureSeed(now());
    return a;
  };
  const admin = (res, a) => { if (a.unrestricted) return true; res.status(403).json({ ok: false, error: 'Only an administrator can do this.' }); return false; };
  const inScope = (a, deptId) => { const ids = access.auditDeptIds(a); return ids === null || ids.indexOf(String(deptId)) >= 0; };
  const fail = (res, e, msg) => { console.error('[doc-audit]', e && e.message); res.status(500).json({ ok: false, error: msg }); };
  const rights = (a) => ({
    canAdd: access.can(a, 'docaudit', 'add'), canEdit: access.can(a, 'docaudit', 'edit'),
    canDelete: access.can(a, 'docaudit', 'delete'), canPrint: access.can(a, 'docaudit', 'print'), isAdmin: !!a.unrestricted,
  });
  const notMine = (res) => res.status(403).json({ ok: false, error: 'This department is not one of yours.' });
  const body = (req) => ((req.body && typeof req.body === 'object') ? req.body : {});
  const today = () => DA.hospitalNow(now()).date;
  const logAudit = (req, x, what) => activity.log(req, 'docaudit_audit', { target: (x.deptName || x.deptId) + ' · ' + ((x.nurse && x.nurse.name) || '—') + ' · ' + x.date, detail: what + (x.result && x.result.pct != null ? ' · ' + x.result.pct + '% ' + x.result.result : '') });
  const monthsOf = (q) => {
    const cur = DA.hospitalNow(now()).month;
    const to = DA.isMonth(q.to) ? q.to : cur;
    let from = DA.isMonth(q.from) ? q.from : DA.addMonth(to, -5);
    if (from > to) from = to;
    return DA.monthsBetween(from, to, 36);
  };

  app.get('/api/doc-audit/meta', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      const cfg = await getConfig();
      const tools = await liveTools();
      const me = await myStaffId(a);
      res.json({ ok: true, departments: await myDepts(a, cfg), tools: tools.map(cleanTool), today: today(), month: DA.hospitalNow(now()).month,
        config: { kpiLink: cfg.kpiLink !== false, ackRequired: cfg.ackRequired !== false }, user: actor(req, a), name: nameOf(req, a),
        staffId: me ? me.id : null, allStaff: access.auditDeptIds(a) === null, ...rights(a) });
    } catch (e) { fail(res, e, 'Could not load Documentation Audit.'); }
  });

  // The nurses an auditor may pick: their departments' staff, thin. `all=1` = the whole register,
  // only for someone who audits every department. Literal route, declared before staff/:staffId.
  app.get('/api/doc-audit/staff', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      const cfg = await getConfig();
      let depts = await myDepts(a, cfg);
      const deptId = String(req.query.dept || '');
      if (deptId) { if (!inScope(a, deptId)) return notMine(res); depts = (await allDepts()).filter((d) => d.id === deptId); }
      const everyone = req.query.all === '1' && access.auditDeptIds(a) === null;
      const roster = await loadRoster();
      const q = String(req.query.q || '').trim().toLowerCase();
      // Policy scope: registered nurses, in-charges and supervisors who document — not the PCAs.
      let list = thinStaff(roster, depts, everyone).filter((p) => String(p.role || '').toUpperCase() !== 'PCA');
      if (q) list = list.filter((p) => String(p.name || '').toLowerCase().indexOf(q) >= 0 || String(p.emp_id || '').toLowerCase().indexOf(q) >= 0);
      list.sort((x, y) => String(x.name || '').localeCompare(String(y.name || '')));
      res.json({ ok: true, staff: list.slice(0, 400), all: everyone });
    } catch (e) { fail(res, e, 'Could not load the staff list.'); }
  });

  // One nurse's audits — the "Documentation audits" card on the staff profile. Only the audits
  // of departments this person may see.
  app.get('/api/doc-audit/staff/:staffId', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      const ids = access.auditDeptIds(a);
      const list = (await findAudits({ staffId: String(req.params.staffId), depts: ids, limit: 300 }));
      const q = DA.quarterOf(today());
      res.json({ ok: true, audits: list.map(thinAudit), thisQuarter: list.filter((x) => DA.quarterOf(x.date) === q).length, quarter: q,
        summary: DA.summarize(list.filter(DA.countsInKpi), []) });
    } catch (e) { fail(res, e, 'Could not load this nurse’s audits.'); }
  });

  app.get('/api/doc-audit/audits', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      const cfg = await getConfig();
      const depts = await myDepts(a, cfg);
      const ids = access.auditDeptIds(a);
      let scope = ids;
      if (req.query.dept) { if (!inScope(a, req.query.dept)) return notMine(res); scope = [String(req.query.dept)]; }
      const q = { depts: scope, drafts: true, limit: 800 };
      if (DA.isDate(req.query.from)) q.from = req.query.from;
      if (DA.isDate(req.query.to)) q.to = req.query.to;
      if (req.query.status && DA.STATUSES.indexOf(req.query.status) >= 0) q.statuses = [req.query.status];
      if (req.query.tool) q.toolId = String(req.query.tool);
      if (req.query.nurse) q.staffId = String(req.query.nurse);
      const me = actor(req, a);
      // Drafts are the auditor's work in progress: theirs, or an editor's to see.
      let list = (await findAudits(q)).filter((x) => x.status !== 'draft' || x.auditor.username === me || access.can(a, 'docaudit', 'edit'));
      if (req.query.result === 'pass') list = list.filter((x) => x.result && x.result.pass);
      if (req.query.result === 'fail') list = list.filter((x) => x.result && x.result.result === 'FAIL');
      if (req.query.result === 'critical') list = list.filter((x) => x.result && (x.result.criticalFails || []).length);
      res.json({ ok: true, departments: depts, audits: list.slice(0, 500).map((x) => { const c = clean(x); delete c.history; return c; }), more: list.length > 500, me, ...rights(a) });
    } catch (e) { fail(res, e, 'Could not load the audits.'); }
  });

  app.get('/api/doc-audit/audits/:id', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      const x = await getDoc(AUDITS, String(req.params.id));
      if (!x || x.removedAt) return res.status(404).json({ ok: false, error: 'This audit does not exist.' });
      if (!inScope(a, x.deptId)) return notMine(res);
      const tool = await getDoc(TOOLS, x.toolId);
      res.json({ ok: true, audit: clean(x), tool: cleanTool(tool), me: actor(req, a), ...rights(a) });
    } catch (e) { fail(res, e, 'Could not load the audit.'); }
  });

  /* Save an audit (create, or update by id). `complete:true` checks it is fully answered and
     every 'No' has its evidence, then makes it a result. The score is worked out here. */
  async function saveAudit(req, res, id) {
    const a = await resolve(req, res, null); if (!a) return;
    const b = body(req);
    const cur = id ? await getDoc(AUDITS, id) : null;
    if (id && (!cur || cur.removedAt)) return res.status(404).json({ ok: false, error: 'This audit does not exist.' });
    const deptId = cur ? cur.deptId : str(b.deptId, 60);
    if (!deptId) return res.status(400).json({ ok: false, error: 'Choose the department.' });
    if (!inScope(a, deptId)) return notMine(res);
    const me = actor(req, a);
    // Who may write: a draft — the Add right; a completed audit — Edit, or its own auditor with
    // Add before the nurse has acknowledged it; acknowledged — Edit; signed — nobody (reopen first).
    if (cur && cur.status === 'signed') return res.status(409).json({ ok: false, code: 'locked', error: 'This audit is signed off and locked. An administrator can reopen it.' });
    const canAdd = access.can(a, 'docaudit', 'add'), canEdit = access.can(a, 'docaudit', 'edit');
    const own = cur && cur.auditor && cur.auditor.username === me;
    const mayWrite = !cur ? canAdd : cur.status === 'draft' ? (canAdd || canEdit) : cur.status === 'completed' ? (canEdit || (own && canAdd)) : canEdit;
    if (!mayWrite) return res.status(403).json({ ok: false, error: cur ? 'Correcting a completed audit needs the Documentation Audit “Edit” permission.' : 'You do not have permission to fill documentation audits.' });
    const base = b.baseUpdatedAt == null ? null : Number(b.baseUpdatedAt);
    if (cur && base != null && cur.updatedAt !== base) return res.status(409).json({ ok: false, code: 'stale', error: 'Someone else changed this audit. Reload to see their version.', audit: clean(cur) });

    const depts = await allDepts();
    const dept = depts.find((d) => d.id === deptId) || { id: deptId, name: (cur && cur.deptName) || deptId };
    const cfg = await getConfig();
    let tool;
    if (cur) tool = await getDoc(TOOLS, cur.toolId);
    else {
      const want = str(b.toolId, 40) || cfgFor(cfg, dept).toolId;
      tool = want ? await getDoc(TOOLS, want) : null;
      if (!DA.isLiveTool(tool)) return res.status(400).json({ ok: false, error: 'No audit tool is set for this department. Ask the administrator (Documentation Audit → Settings).' });
    }
    const criteria = cur ? cur.criteria : DA.freezeCriteria(tool);
    const vals = pickAudit(b, tool, criteria);
    // A field the request does not send keeps what is stored (a partial update never blanks answers).
    if (cur) Object.keys(vals).forEach((k) => { if (b[k] === undefined) vals[k] = cur[k] == null ? vals[k] : cur[k]; });
    if (!vals.date) vals.date = cur ? cur.date : today();

    // The nurse audited: a register record (linked by its id) or, for someone not in the register, a typed name.
    let nurse = cur ? cur.nurse : null;
    const bn = (b.nurse && typeof b.nurse === 'object') ? b.nurse : null;
    if (bn) {
      if (bn.staffId != null && bn.staffId !== '') {
        if (!cur || !cur.nurse || String(cur.nurse.staffId) !== String(bn.staffId)) {
          const roster = await loadRoster();
          const rec = roster.find((p) => String(p.id) === String(bn.staffId));
          if (!rec) return res.status(400).json({ ok: false, error: 'That nurse is not in the staff register.' });
          const ids = access.auditDeptIds(a);
          if (ids !== null && !thinStaff([rec], depts.filter((d) => ids.indexOf(d.id) >= 0), false).length) {
            return res.status(403).json({ ok: false, error: 'That nurse is not on the staff list of your departments. Pick “Not in the register” and type the name, or ask the administrator.' });
          }
          nurse = nurseSnap(rec);
        }
      } else if (str(bn.name, 120)) nurse = { staffId: null, empId: str(bn.empId, 30), name: str(bn.name, 120), designation: str(bn.designation, 80), department: '', role: '', linked: false };
      else nurse = null;
    }
    // Policy 7.3: nurses do not audit their own documentation.
    const mine = await myStaffId(a);
    if (nurse && nurse.staffId && mine && mine.id === String(nurse.staffId)) return res.status(409).json({ ok: false, code: 'self', error: 'You cannot audit your own documentation (policy 7.3). Ask another auditor.' });

    const t = now();
    const next = Object.assign({}, cur || {}, vals, {
      _id: cur ? cur._id : newId(), toolId: cur ? cur.toolId : tool._id, toolName: (tool && (tool.short || tool.name)) || (cur && cur.toolName) || '', toolCode: (tool && tool.code) || (cur && cur.toolCode) || '',
      toolRevision: cur ? cur.toolRevision : (tool.revision || 1), criteria,
      deptId, deptName: dept.name, month: vals.date.slice(0, 7), nurse,
      auditor: cur ? cur.auditor : { username: me, name: nameOf(req, a), staffId: mine ? mine.id : null },
      selfCheck: mine ? (mine.sure ? 'linked' : 'matched') : 'unknown',
      createdAt: cur ? cur.createdAt : t, createdBy: cur ? cur.createdBy : me, updatedAt: t, updatedBy: me,
    });
    next.result = DA.score(next.answers, criteria);
    const wantComplete = b.complete === true;
    if (wantComplete || (cur && cur.status !== 'draft')) {
      const problems = DA.validate(next, criteria, { today: today(), tool });
      if (problems.length) return res.status(400).json({ ok: false, code: 'incomplete', error: problems[0].message, problems });
    } else if (next.date > today()) return res.status(400).json({ ok: false, error: 'The audit date cannot be in the future.' });
    const changes = changesOf(cur, next);
    if (cur && !changes.length && !(wantComplete && cur.status === 'draft')) return res.json({ ok: true, audit: clean(cur), unchanged: true });
    let action = !cur ? (wantComplete ? 'created & completed' : 'draft saved') : cur.status === 'draft' ? (wantComplete ? 'completed' : 'draft edited') : 'corrected';
    next.status = !cur ? (wantComplete ? 'completed' : 'draft') : cur.status === 'draft' ? (wantComplete ? 'completed' : 'draft') : cur.status;
    if (next.status === 'completed' && (!cur || cur.status === 'draft')) { next.completedAt = t; next.completedBy = me; }
    // The nurse acknowledged what the audit said; if what it says changes, that no longer holds.
    if (cur && cur.status === 'acknowledged' && changes.some((c) => SCORED.some((k) => c.indexOf(k) === 0))) {
      next.status = 'completed'; next.ackPrevious = cur.ack; next.ack = null; action += ' — acknowledgement cleared, the nurse must acknowledge again';
    }
    next.history = ((cur && cur.history) || []).concat([{ at: t, by: me, action, changes: changes.join('; ').slice(0, 900) || 'new' }]).slice(-100);
    if (!(await putDoc(AUDITS, next, cur ? cur.updatedAt : null))) return res.status(409).json({ ok: false, code: 'stale', error: 'Someone else changed this audit. Reload to see their version.' });
    if (next.status !== 'draft' || !cur) logAudit(req, next, action);
    res.json({ ok: true, audit: clean(next) });
  }
  app.post('/api/doc-audit/audits', guard, async (req, res) => { try { await saveAudit(req, res, null); } catch (e) { fail(res, e, 'Could not save the audit.'); } });
  app.put('/api/doc-audit/audits/:id', guard, async (req, res) => { try { await saveAudit(req, res, String(req.params.id)); } catch (e) { fail(res, e, 'Could not save the audit.'); } });

  // A step in the sign-off chain on one audit.
  async function step(req, res, fn) {
    const x = await getDoc(AUDITS, String(req.params.id));
    if (!x || x.removedAt) return res.status(404).json({ ok: false, error: 'This audit does not exist.' });
    const out = await fn(x);
    if (!out) return;
    const t = now();
    const doc = Object.assign({}, x, out.set, { updatedAt: t, updatedBy: out.by, history: (x.history || []).concat([{ at: t, by: out.by, action: out.action, changes: out.note || '' }]).slice(-100) });
    if (!(await putDoc(AUDITS, doc, x.updatedAt))) return res.status(409).json({ ok: false, code: 'stale', error: 'Someone else changed this audit. Reload and try again.' });
    logAudit(req, doc, out.action + (out.note ? ' · ' + out.note : ''));
    res.json({ ok: true, audit: clean(doc) });
  }
  // The nurse's acknowledgement, recorded by the auditor at the same-day feedback (policy 7.2).
  app.post('/api/doc-audit/audits/:id/ack', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'add'); if (!a) return;
      await step(req, res, async (x) => {
        if (!inScope(a, x.deptId)) { notMine(res); return null; }
        if (x.status !== 'completed') { res.status(409).json({ ok: false, code: 'state', error: x.status === 'draft' ? 'Complete the audit first.' : 'This audit has already been acknowledged.' }); return null; }
        const b = body(req);
        const t = now(), me = actor(req, a);
        return { by: me, action: 'acknowledged (in person)', note: str(b.note, 300),
          set: { status: 'acknowledged', ack: { at: t, by: me, byName: nameOf(req, a), method: 'in-person', name: (x.nurse && x.nurse.name) || '', note: str(b.note, 300) } } };
      });
    } catch (e) { fail(res, e, 'Could not record the acknowledgement.'); }
  });
  // Nurse In-charge sign-off: the end of the chain; the audit is locked after it.
  app.post('/api/doc-audit/audits/:id/sign', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'edit'); if (!a) return;
      const cfg = await getConfig();
      await step(req, res, async (x) => {
        if (!inScope(a, x.deptId)) { notMine(res); return null; }
        const me = actor(req, a);
        const ackNeeded = cfg.ackRequired !== false && !a.unrestricted;
        if (x.status === 'draft') { res.status(409).json({ ok: false, code: 'state', error: 'Complete the audit first.' }); return null; }
        if (x.status === 'signed') { res.status(409).json({ ok: false, code: 'state', error: 'This audit is already signed off.' }); return null; }
        if (x.status === 'completed' && ackNeeded) { res.status(409).json({ ok: false, code: 'ack', error: 'The nurse has not acknowledged this audit yet.' }); return null; }
        if (!a.unrestricted && x.auditor && x.auditor.username === me) { res.status(409).json({ ok: false, code: 'own', error: 'You filled this audit, so another person must sign it off.' }); return null; }
        const mine = await myStaffId(a);
        if (!a.unrestricted && mine && x.nurse && String(x.nurse.staffId) === mine.id) { res.status(409).json({ ok: false, code: 'self', error: 'This audit is of your own documentation.' }); return null; }
        const t = now();
        return { by: me, action: 'signed off' + (x.status === 'completed' ? ' (without the nurse’s acknowledgement)' : ''), note: str(body(req).note, 300),
          set: { status: 'signed', signoff: { at: t, by: me, name: nameOf(req, a), note: str(body(req).note, 300) } } };
      });
    } catch (e) { fail(res, e, 'Could not sign off the audit.'); }
  });
  app.post('/api/doc-audit/audits/:id/reopen', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      if (!admin(res, a)) return;
      const reason = str(body(req).reason, 400);
      if (reason.length < 5) return res.status(400).json({ ok: false, error: 'Write why the audit is reopened.' });
      await step(req, res, async (x) => {
        if (x.status !== 'signed' && x.status !== 'acknowledged') { res.status(409).json({ ok: false, code: 'state', error: 'Only an acknowledged or signed-off audit can be reopened.' }); return null; }
        const me = actor(req, a), t = now();
        return { by: me, action: 'reopened', note: reason,
          set: { status: x.ack ? 'acknowledged' : 'completed', signoff: null, reopened: (x.reopened || []).concat([{ at: t, by: me, reason, signoff: x.signoff || null }]) } };
      });
    } catch (e) { fail(res, e, 'Could not reopen the audit.'); }
  });
  app.delete('/api/doc-audit/audits/:id', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'delete'); if (!a) return;
      const x = await getDoc(AUDITS, String(req.params.id));
      if (!x || x.removedAt) return res.status(404).json({ ok: false, error: 'This audit does not exist.' });
      if (!inScope(a, x.deptId)) return notMine(res);
      if (x.status === 'signed' && !a.unrestricted) return res.status(409).json({ ok: false, code: 'locked', error: 'A signed-off audit can only be removed by an administrator.' });
      const reason = str(body(req).reason || req.query.reason, 300);
      const t = now(), me = actor(req, a);
      const doc = Object.assign({}, x, { removedAt: t, removedBy: me, updatedAt: t, history: (x.history || []).concat([{ at: t, by: me, action: 'removed', changes: reason || x.status }]).slice(-100) });
      if (!(await putDoc(AUDITS, doc, x.updatedAt))) return res.status(409).json({ ok: false, error: 'Someone else changed this audit. Reload and try again.' });
      logAudit(req, x, 'removed (was ' + x.status + ')' + (reason ? ' · ' + reason : ''));
      res.json({ ok: true });
    } catch (e) { fail(res, e, 'Could not remove the audit.'); }
  });

  /* The signed-in nurse's own audits (any account linked to a staff record — no module needed):
     their feedback, and their own acknowledgement. */
  app.get('/api/doc-audit/mine', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, null); if (!a) return;
      const me = await myStaffId(a);
      if (!me) return res.json({ ok: true, linked: false, audits: [] });
      const list = await findAudits({ staffId: me.id, limit: 60 });
      res.json({ ok: true, linked: true, audits: list.map((x) => Object.assign(thinAudit(x), { gaps: (x.criteria || []).filter((c) => (x.answers || {})[c.id] === 'N').map((c) => ({ no: c.no, text: c.text, critical: c.critical, evidence: (x.evidence || {})[c.id] || '' })), action: x.result ? x.result.action : '' })) });
    } catch (e) { fail(res, e, 'Could not load your audits.'); }
  });
  app.post('/api/doc-audit/mine/:id/ack', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, null); if (!a) return;
      const me = await myStaffId(a);
      await step(req, res, async (x) => {
        if (!me || !x.nurse || String(x.nurse.staffId) !== me.id) { res.status(403).json({ ok: false, error: 'This audit is not of your documentation.' }); return null; }
        if (x.status !== 'completed') { res.status(409).json({ ok: false, code: 'state', error: 'This audit is not waiting for your acknowledgement.' }); return null; }
        const t = now(), who = actor(req, a);
        return { by: who, action: 'acknowledged by the nurse', note: str(body(req).note, 300),
          set: { status: 'acknowledged', ack: { at: t, by: who, byName: nameOf(req, a), method: 'account', name: nameOf(req, a), note: str(body(req).note, 300) } } };
      });
    } catch (e) { fail(res, e, 'Could not record your acknowledgement.'); }
  });

  // Reports: per department × tool × month, the hospital per tool, and optional breakdowns.
  app.get('/api/doc-audit/summary', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      const months = monthsOf(req.query);
      const cfg = await getConfig();
      let depts = await myDepts(a, cfg);
      const ids = access.auditDeptIds(a);
      let scope = ids;
      if (req.query.dept) { if (!inScope(a, req.query.dept)) return notMine(res); scope = [String(req.query.dept)]; depts = depts.filter((d) => d.id === String(req.query.dept)); }
      const toolId = req.query.tool ? String(req.query.tool) : null;
      const audits = (await findAudits({ depts: scope, months, toolId })).filter(DA.countsInKpi);
      const tools = (await allDocs(TOOLS)).filter((t) => !t.removedAt);
      const out = buildSummary(audits, tools, months, depts, { toolId });
      const by = ['area', 'shift', 'nurse', 'auditor'].indexOf(req.query.by) >= 0 ? req.query.by : null;
      res.json({ ok: true, months, tools: tools.map((t) => ({ id: t._id, name: t.name, short: t.short, code: t.code, kpis: t.kpis, sample: t.sample, disabled: !!t.disabled })),
        ...out, breakdown: by ? breakdown(audits, tools, by) : null, by, today: today() });
    } catch (e) { fail(res, e, 'Could not build the report.'); }
  });

  // Corrective Action Plan (Appendix B) for a department-month.
  app.get('/api/doc-audit/caps/:dept/:month', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      const deptId = String(req.params.dept), ym = String(req.params.month);
      if (!inScope(a, deptId)) return notMine(res);
      if (!DA.isMonth(ym)) return res.status(400).json({ ok: false, error: 'Invalid month.' });
      const c = await getDoc(CAPS, deptId + ':' + ym);
      res.json({ ok: true, cap: c && !c.removedAt ? clean(c) : null });
    } catch (e) { fail(res, e, 'Could not load the action plan.'); }
  });
  app.put('/api/doc-audit/caps/:dept/:month', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'edit'); if (!a) return;
      const deptId = String(req.params.dept), ym = String(req.params.month);
      if (!inScope(a, deptId)) return notMine(res);
      if (!DA.isMonth(ym)) return res.status(400).json({ ok: false, error: 'Invalid month.' });
      const b = body(req);
      const id = deptId + ':' + ym;
      const cur = await getDoc(CAPS, id);
      const base = b.baseUpdatedAt == null ? null : Number(b.baseUpdatedAt);
      if (cur && base != null && cur.updatedAt !== base) return res.status(409).json({ ok: false, code: 'stale', error: 'Someone else changed this action plan. Reload to see their version.' });
      const STATES = ['open', 'progress', 'done'];
      const items = (Array.isArray(b.items) ? b.items : []).slice(0, 20).map((x, i) => ({
        n: i + 1, critId: str(x && x.critId, 10), gap: str(x && x.gap, 600), rootCause: str(x && x.rootCause, 400), action: str(x && x.action, 600),
        owner: str(x && x.owner, 120), due: DA.isDate(x && x.due) ? x.due : '', status: STATES.indexOf(x && x.status) >= 0 ? x.status : 'open', reaudit: str(x && x.reaudit, 300),
      })).filter((x) => x.gap || x.action);
      const depts = await allDepts();
      const t = now(), me = actor(req, a);
      const doc = Object.assign({}, cur || {}, { _id: id, deptId, deptName: (depts.find((d) => d.id === deptId) || {}).name || deptId, month: ym, items,
        preparedBy: str(b.preparedBy, 120) || (cur && cur.preparedBy) || nameOf(req, a), submittedAt: b.submit === true ? t : (cur && cur.submittedAt) || null,
        updatedAt: t, updatedBy: me, history: ((cur && cur.history) || []).concat([{ at: t, by: me, action: cur ? 'edited' : 'created', changes: items.length + ' item(s)' }]).slice(-50) });
      delete doc.removedAt;
      if (!(await putDoc(CAPS, doc, cur ? cur.updatedAt : null))) return res.status(409).json({ ok: false, code: 'stale', error: 'Someone else changed this action plan. Reload to see their version.' });
      activity.log(req, 'docaudit_cap', { target: doc.deptName + ' · ' + ym, detail: items.length + ' action(s)' + (b.submit === true ? ' · submitted' : '') });
      res.json({ ok: true, cap: clean(doc) });
    } catch (e) { fail(res, e, 'Could not save the action plan.'); }
  });

  /* ---- tools (administrator) ---- */
  app.get('/api/doc-audit/tools', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      const all = req.query.all === '1' && a.unrestricted;
      const list = (await allDocs(TOOLS)).filter((t) => all ? true : DA.isLiveTool(t)).sort((x, y) => (x.order || 0) - (y.order || 0));
      res.json({ ok: true, tools: list.map(cleanTool) });
    } catch (e) { fail(res, e, 'Could not load the audit tools.'); }
  });
  app.post('/api/doc-audit/tools', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      if (!admin(res, a)) return;
      const b = body(req);
      const from = b.from ? await getDoc(TOOLS, String(b.from)) : null;
      const src = from ? Object.assign({}, from, { name: (from.name || '') + ' (copy)', code: '' }) : b;
      const t = now(), me = actor(req, a);
      const tools = await allDocs(TOOLS);
      let id = SLUG(b.id || src.short || src.name) || 'tool';
      while (tools.some((x) => x._id === id)) id += '-2';
      const picked = pickTool(src, from ? { criteria: from.criteria } : null);
      const doc = Object.assign({ _id: id }, picked, { order: tools.reduce((m, x) => Math.max(m, x.order || 0), 0) + 10, revision: 1, createdAt: t, createdBy: me, updatedAt: t, updatedBy: me,
        history: [{ at: t, by: me, action: from ? 'created as a copy of ' + from.name : 'created' }] });
      if (!(await putDoc(TOOLS, doc, null))) return res.status(409).json({ ok: false, error: 'Could not create the tool. Try again.' });
      activity.log(req, 'docaudit_tool', { target: doc.name, detail: from ? 'copied from ' + from.name : 'created' });
      res.json({ ok: true, tool: cleanTool(doc) });
    } catch (e) { fail(res, e, 'Could not create the tool.'); }
  });
  app.put('/api/doc-audit/tools/:id', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      if (!admin(res, a)) return;
      const cur = await getDoc(TOOLS, String(req.params.id));
      if (!cur) return res.status(404).json({ ok: false, error: 'This tool does not exist.' });
      const b = body(req);
      const base = b.baseUpdatedAt == null ? null : Number(b.baseUpdatedAt);
      if (base != null && cur.updatedAt !== base) return res.status(409).json({ ok: false, code: 'stale', error: 'Someone else changed this tool. Reload to see their version.' });
      const picked = pickTool(b, cur);
      const bumped = scoringOf(picked) !== scoringOf(cur);
      const t = now(), me = actor(req, a);
      const changed = ['name', 'short', 'code', 'version', 'scope', 'sections', 'criteria', 'kpis', 'header', 'naGuide', 'sample'].filter((k) => JSON.stringify(picked[k]) !== JSON.stringify(cur[k]));
      if (!changed.length) return res.json({ ok: true, tool: cleanTool(cur), unchanged: true });
      const doc = Object.assign({}, cur, picked, { revision: (cur.revision || 1) + (bumped ? 1 : 0), updatedAt: t, updatedBy: me,
        history: (cur.history || []).concat([{ at: t, by: me, action: bumped ? 'edited — revision ' + ((cur.revision || 1) + 1) : 'edited', changes: changed.join(', ') }]).slice(-100) });
      if (!(await putDoc(TOOLS, doc, cur.updatedAt))) return res.status(409).json({ ok: false, code: 'stale', error: 'Someone else changed this tool. Reload to see their version.' });
      activity.log(req, 'docaudit_tool', { target: doc.name, detail: 'edited · ' + changed.join(', ') + (bumped ? ' · revision ' + doc.revision + ' (audits already filled keep their own criteria)' : '') });
      res.json({ ok: true, tool: cleanTool(doc) });
    } catch (e) { fail(res, e, 'Could not save the tool.'); }
  });
  async function toolFlag(req, res, set, action) {
    const a = await resolve(req, res, 'view'); if (!a) return;
    if (!admin(res, a)) return;
    const cur = await getDoc(TOOLS, String(req.params.id));
    if (!cur) return res.status(404).json({ ok: false, error: 'This tool does not exist.' });
    const t = now(), me = actor(req, a);
    const doc = Object.assign({}, cur, set(t, me), { updatedAt: t, updatedBy: me, history: (cur.history || []).concat([{ at: t, by: me, action }]).slice(-100) });
    if (!(await putDoc(TOOLS, doc, cur.updatedAt))) return res.status(409).json({ ok: false, code: 'stale', error: 'Someone else changed this tool. Reload and try again.' });
    activity.log(req, 'docaudit_tool', { target: doc.name, detail: action });
    res.json({ ok: true, tool: cleanTool(doc) });
  }
  app.post('/api/doc-audit/tools/:id/enabled', guard, async (req, res) => {
    try { const on = body(req).enabled === true; await toolFlag(req, res, () => ({ disabled: !on }), on ? 'enabled' : 'disabled'); } catch (e) { fail(res, e, 'Could not change the tool.'); }
  });
  app.delete('/api/doc-audit/tools/:id', guard, async (req, res) => {
    try { await toolFlag(req, res, (t, me) => ({ removedAt: t, removedBy: me }), 'archived'); } catch (e) { fail(res, e, 'Could not archive the tool.'); }
  });
  app.post('/api/doc-audit/tools/:id/restore', guard, async (req, res) => {
    try { await toolFlag(req, res, () => ({ removedAt: null, removedBy: null }), 'restored'); } catch (e) { fail(res, e, 'Could not restore the tool.'); }
  });

  /* ---- settings (administrator) ---- */
  const eligible = (u) => u && u.username && u.active !== false && (u.role || 'User') === 'User' && u.perms && typeof u.perms === 'object';
  app.get('/api/doc-audit/config', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      if (!admin(res, a)) return;
      const cfg = await getConfig();
      const depts = await allDepts();
      let people = null;
      try {
        const col = DEPS.users ? null : await getUsers();
        const users = DEPS.users ? await DEPS.users() : (col && typeof col.find === 'function' ? await col.find({}).toArray() : null);
        if (users) people = users.filter(eligible).filter((u) => access.can({ perms: u.perms, role: u.role || 'User' }, 'docaudit', 'view'))
          .map((u) => { const p = u.perms.docaudit; return { username: u.username, name: u.name || u.username, rights: Array.isArray(p) ? p : [String(p)], auditDepartments: Array.isArray(u.auditDepartments) ? u.auditDepartments.map(String) : [] }; });
      } catch (e) { people = null; }
      res.json({ ok: true, departments: depts.map((d) => Object.assign({}, d, { cfg: cfgFor(cfg, d), guess: catalogue.guessTool(d) })),
        tools: (await liveTools()).map((t) => ({ id: t._id, name: t.name, short: t.short })),
        kpiLink: cfg.kpiLink !== false, ackRequired: cfg.ackRequired !== false, people, peopleAvailable: !!people });
    } catch (e) { fail(res, e, 'Could not load the settings.'); }
  });
  app.put('/api/doc-audit/config', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      if (!admin(res, a)) return;
      const b = body(req);
      const cfg = await getConfig();
      const tools = new Set((await allDocs(TOOLS)).filter((t) => !t.removedAt).map((t) => t._id));
      const depts = Object.assign({}, cfg.depts || {});
      const changed = [];
      const want = (b.depts && typeof b.depts === 'object') ? b.depts : {};
      Object.keys(want).slice(0, 300).forEach((id) => {
        const v = want[id] || {};
        const next = { toolId: tools.has(v.toolId) ? v.toolId : null, enabled: v.enabled === true && tools.has(v.toolId), minRecords: Number.isInteger(+v.minRecords) ? Math.max(0, Math.min(500, +v.minRecords)) : 10 };
        if (JSON.stringify(depts[id] || null) !== JSON.stringify(next)) { depts[String(id).slice(0, 60)] = next; changed.push(id + (next.enabled ? ' ' + next.toolId + ' min ' + next.minRecords : ' off')); }
      });
      const set = { depts, updatedAt: now(), updatedBy: actor(req, a) };
      if (typeof b.kpiLink === 'boolean' && b.kpiLink !== (cfg.kpiLink !== false)) { set.kpiLink = b.kpiLink; changed.push('Nursing KPI link ' + (b.kpiLink ? 'on' : 'off')); }
      if (typeof b.ackRequired === 'boolean' && b.ackRequired !== (cfg.ackRequired !== false)) { set.ackRequired = b.ackRequired; changed.push('acknowledgement ' + (b.ackRequired ? 'required' : 'optional')); }
      await patchConfig(set);
      if (changed.length) activity.log(req, 'docaudit_config', { target: 'Documentation Audit', detail: changed.join(', ').slice(0, 900) });
      res.json({ ok: true, changed: changed.length });
    } catch (e) { fail(res, e, 'Could not save the settings.'); }
  });

  /* ---- print & export (logged first) ---- */
  app.post('/api/doc-audit/print', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'print'); if (!a) return;
      const b = body(req);
      const kind = ['audit', 'report', 'blank', 'cap'].indexOf(b.kind) >= 0 ? b.kind : 'audit';
      let target = 'Documentation Audit';
      if (kind === 'audit') {
        const x = await getDoc(AUDITS, String(b.id || ''));
        if (!x || x.removedAt) return res.status(404).json({ ok: false, error: 'This audit does not exist.' });
        if (!inScope(a, x.deptId)) return notMine(res);
        target = x.deptName + ' · ' + ((x.nurse && x.nurse.name) || '—') + ' · ' + x.date;
      } else if (b.dept) { if (!inScope(a, b.dept)) return notMine(res); target = String(b.dept); }
      activity.log(req, 'docaudit_print', { target, detail: kind + (b.from ? ' · ' + b.from + (b.to ? ' → ' + b.to : '') : '') + (b.pdf ? ' · PDF' : '') });
      res.json({ ok: true });
    } catch (e) { fail(res, e, 'Could not record the print.'); }
  });
  app.get('/api/doc-audit/xlsx', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'print'); if (!a) return;
      const months = monthsOf(req.query);
      const cfg = await getConfig();
      let depts = await myDepts(a, cfg);
      let scope = access.auditDeptIds(a);
      if (req.query.dept) { if (!inScope(a, req.query.dept)) return notMine(res); scope = [String(req.query.dept)]; depts = depts.filter((d) => d.id === String(req.query.dept)); }
      const audits = (await findAudits({ depts: scope, months })).filter(DA.countsInKpi);
      const tools = (await allDocs(TOOLS)).filter((t) => !t.removedAt);
      const sum = buildSummary(audits, tools, months, depts, {});
      const caps = [];
      for (const r of sum.rows) for (const ym of months) { const c = await getDoc(CAPS, r.deptId + ':' + ym); if (c && !c.removedAt) caps.push(c); }
      const buf = await require('./doc-audit-xlsx').build({ months, audits, tools, summary: sum, caps });
      activity.log(req, 'docaudit_export', { target: req.query.dept ? String(req.query.dept) : 'all my departments', detail: 'Excel · ' + months[0] + ' → ' + months[months.length - 1] + ' · ' + audits.length + ' audit(s)' });
      const name = 'Documentation-Audit_' + months[0] + (months.length > 1 ? '_to_' + months[months.length - 1] : '') + '.xlsx';
      res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.set('Content-Disposition', 'attachment; filename="' + name + '"');
      res.set('Cache-Control', 'no-store');
      res.end(buf);
    } catch (e) { fail(res, e, 'Could not build the Excel file.'); }
  });

  // What needs attention, for the sidebar badge.
  app.get('/api/doc-audit/missing', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      const cfg = await getConfig();
      const depts = await myDepts(a, cfg);
      if (!depts.length) return res.json({ ok: true, total: 0, awaitingAck: 0, awaitingSign: 0, drafts: 0, lowSample: [] });
      const ym = DA.hospitalNow(now()).month, day = +today().slice(8, 10);
      const ids = depts.map((d) => d.id);
      const list = await findAudits({ depts: ids, from: DA.addMonth(ym, -2) + '-01', drafts: true });
      const me = actor(req, a);
      const canAdd = access.can(a, 'docaudit', 'add'), canEdit = access.can(a, 'docaudit', 'edit');
      const awaitingAck = canAdd ? list.filter((x) => x.status === 'completed').length : 0;
      const awaitingSign = canEdit ? list.filter((x) => x.status === 'acknowledged' && (a.unrestricted || !x.auditor || x.auditor.username !== me)).length : 0;
      const drafts = canAdd ? list.filter((x) => x.status === 'draft' && x.auditor && x.auditor.username === me).length : 0;
      const criticalOpen = list.filter((x) => x.status !== 'draft' && x.status !== 'signed' && x.result && (x.result.criticalFails || []).length).length;
      // After the 20th, a department that has not reached its minimum sample for the month.
      const lowSample = day >= 20 && canAdd ? depts.map((d) => ({ id: d.id, name: d.name, have: list.filter((x) => x.deptId === d.id && x.month === ym && x.status !== 'draft').length, need: d.cfg.minRecords }))
        .filter((d) => d.need > 0 && d.have < d.need) : [];
      res.json({ ok: true, total: awaitingAck + awaitingSign + drafts + lowSample.length, awaitingAck, awaitingSign, drafts, criticalOpen, lowSample, month: ym });
    } catch (e) { fail(res, e, 'Could not check Documentation Audit.'); }
  });
}

module.exports = { mount, monthlyFigures, enabledDepts, ensureSeed, cfgFor, _mem: mem };
