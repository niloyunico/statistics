/* Data Collection module — responsible persons + Google-form-style submissions
 * with an ADMIN REVIEW step.
 *
 * Flow:
 *   1. A form (or a shared short link) creates a submission with status "pending".
 *      Nothing in the live dashboard changes yet.
 *   2. The "Review & History" module shows every submission (time, data, stats).
 *   3. An admin Approves a pending submission -> it is APPLIED to the canonical
 *      collection (`departments` monthly stats / `quality` indicators) and marked
 *      "approved" (so it now shows in the live dashboard). Reject marks it rejected.
 *
 * Collections: `responsibles`, `submissions`. Self-contained via db.getDbHandle();
 * the actively edited web.js only calls mount() once.
 */
const { getDbHandle, getUsers } = require('./db');
const auth = require('./auth');
const session = require('./session');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

function monthRank(key) {
  const p = String(key || '').split('-');
  const idx = MONTHS.indexOf(p[0]);
  const yy = parseInt(p[1], 10);
  if (idx < 0 || isNaN(yy)) return Number.POSITIVE_INFINITY;
  return (2000 + yy) * 12 + idx;
}
function genId(prefix) { return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e8).toString(36); }
function normResp(r) {
  if (!r) return null;
  if (typeof r === 'string') return { name: r.trim() };
  return { id: r.id || null, name: String(r.name || '').trim(), title: r.title || '' };
}
async function col(name) { const db = await getDbHandle(); return db ? db.collection(name) : null; }

// In-memory fallback for dev (no MONGODB_URI). The web app always has Mongo.
const mem = { responsibles: [], submissions: [] };

/* ---------------- responsible persons ---------------- */
async function getResponsibles() {
  const c = await col('responsibles');
  if (!c) return mem.responsibles.slice();
  const docs = await c.find({}).sort({ name: 1 }).toArray();
  return docs.map((d) => { const { _id, ...r } = d; return { id: _id, ...r }; });
}
async function saveResponsible(input) {
  const now = Date.now();
  const empId = String((input && input.empId) || '').trim().toLowerCase();
  const doc = {
    name: String((input && input.name) || '').trim(),
    title: String((input && input.title) || '').trim(),
    phone: String((input && input.phone) || '').trim(),
    staffId: input && input.staffId != null ? input.staffId : null,
    empId: empId || null,
    departments: Array.isArray(input && input.departments) ? input.departments.map(String) : [],
    qualityAreas: Array.isArray(input && input.qualityAreas) ? input.qualityAreas.map(String) : [],
    active: !(input && input.active === false),
  };
  if (!doc.name) throw new Error('Name is required.');
  if (empId && !/^[a-z0-9._-]{3,40}$/.test(empId)) throw new Error('Emp ID must be 3-40 chars: letters, numbers, . _ -');
  const id = input && input.id ? String(input.id) : genId('resp');
  const c = await col('responsibles');
  let rec;
  if (!c) {
    const i = mem.responsibles.findIndex((r) => r.id === id);
    rec = { id, ...doc, createdAt: i >= 0 ? mem.responsibles[i].createdAt : now, updatedAt: now };
    if (i >= 0) mem.responsibles[i] = rec; else mem.responsibles.push(rec);
  } else {
    const existing = await c.findOne({ _id: id });
    const base = { ...doc, createdAt: existing ? existing.createdAt : now, updatedAt: now };
    await c.replaceOne({ _id: id }, base, { upsert: true });
    rec = { id, ...base };
  }
  // When an emp ID is set, keep a matching collector LOGIN account in sync so the
  // person can sign in and get a data-limited, per-user view of their departments.
  if (empId) {
    await upsertCollectorUser({ empId, password: input && input.password, name: doc.name, departments: doc.departments, qualityAreas: doc.qualityAreas, active: doc.active, responsibleId: id });
  }
  return { ...rec, hasLogin: !!empId };
}

// Create/update a role:"collector" account in the users collection (the same one
// the login portal authenticates against). Assignments are mirrored here so the
// session scope is available at login without a second lookup table.
async function upsertCollectorUser(opts) {
  const empId = String(opts.empId).toLowerCase();
  const users = await getUsers();
  const set = { name: opts.name || empId, role: 'collector', active: opts.active !== false, departments: opts.departments || [], qualityAreas: opts.qualityAreas || [] };
  if (opts.responsibleId) set.responsibleId = opts.responsibleId;
  if (opts.password) set.passwordHash = await auth.hash(String(opts.password));
  const existing = await users.findOne({ username: empId });
  if (existing) {
    if (existing.role === 'Administrator') throw new Error('That ID belongs to an administrator.');
    await users.updateOne({ username: empId }, { $set: set });
  } else {
    if (!opts.password) throw new Error('A password is required to create the login for "' + empId + '".');
    await users.insertOne({ username: empId, ...set, created_at: Date.now() });
  }
  return { username: empId };
}

// Public self-registration of a collector account (no department assignments yet —
// an admin assigns those afterwards from Responsible Persons).
async function registerCollector(input) {
  const empId = String((input && input.empId) || '').trim().toLowerCase();
  const name = String((input && input.name) || '').trim();
  const password = String((input && input.password) || '');
  if (!name) throw new Error('Your name is required.');
  if (!/^[a-z0-9._-]{3,40}$/.test(empId)) throw new Error('Emp ID must be 3-40 chars: letters, numbers, . _ -');
  if (password.length < 4) throw new Error('Password must be at least 4 characters.');
  const users = await getUsers();
  const existing = await users.findOne({ username: empId });
  if (existing) throw new Error('That Emp ID is already registered. Try signing in.');
  const resp = await saveResponsible({ name, empId, password, departments: [], qualityAreas: [] });
  return { ok: true, username: empId, responsibleId: resp.id };
}

// Verified login scope for a username (role + assigned departments/areas).
async function getUserScope(username) {
  if (!username) return null;
  const users = await getUsers();
  const u = await users.findOne({ username: String(username).toLowerCase() });
  if (!u) return null;
  return { username: u.username, name: u.name || u.username, role: u.role || 'User', departments: u.departments || [], qualityAreas: u.qualityAreas || [] };
}

async function deleteResponsible(id) {
  const c = await col('responsibles');
  if (!c) { mem.responsibles = mem.responsibles.filter((r) => r.id !== String(id)); return { ok: true }; }
  await c.deleteOne({ _id: String(id) });
  return { ok: true };
}

/* ---------------- build (validate, don't apply) ---------------- */
async function buildPatientSpec(payload) {
  const deptId = String((payload && payload.department) || '').trim();
  const month = String((payload && payload.month) || '').trim();
  const rawValues = (payload && payload.values && typeof payload.values === 'object') ? payload.values : {};
  if (!deptId) throw new Error('Department is required.');
  if (!month) throw new Error('Month is required.');
  const c = await col('departments');
  if (!c) throw new Error('Database not available.');
  const dept = await c.findOne({ _id: deptId });
  if (!dept) throw new Error('Unknown department: ' + deptId);
  const row = {};
  Object.keys(rawValues).forEach((k) => {
    const v = rawValues[k];
    if (v === '' || v == null) return;
    const n = Number(v);
    row[k] = isNaN(n) ? v : n;
  });
  return { type: 'patient', department: deptId, departmentName: dept.name || deptId, month, values: row };
}

async function buildQualitySpec(payload) {
  const area = String((payload && payload.area) || '').trim();
  const month = String((payload && payload.month) || '').trim();
  if (!area) throw new Error('Quality area is required.');
  if (!month) throw new Error('Reporting month is required.');
  const c = await col('quality');
  if (!c) throw new Error('Database not available.');
  const doc = await c.findOne({ _id: area });
  if (!doc) throw new Error('Unknown quality area: ' + area);
  const indicators = Array.isArray(doc.indicators) ? doc.indicators : [];
  let indId = payload && payload.indicatorId ? String(payload.indicatorId) : '';
  let indName = '';
  let isNew = false;
  const found = indId ? indicators.find((i) => i.id === indId) : null;
  if (found) { indName = found.name; }
  else {
    const name = String((payload && payload.indicatorName) || '').trim();
    if (!name) throw new Error('Select an existing indicator or provide a new indicator name.');
    isNew = true; indName = name;
    indId = 'ind-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) + '-' + Math.floor(1000 + Math.random() * 9000);
  }
  // Single-month entry; the SYSTEM computes the result (the collector never pre-computes):
  //   count  -> the entered value;  rate/% -> numerator / denominator * multiplier
  const formulaIn = (payload && payload.formula) || (found && found.formula) || null;
  const entryMode = ((payload && payload.entryMode === 'rate') || formulaIn === 'pct' || formulaIn === 'rate1000') ? 'rate' : 'count';
  const mult = (formulaIn === 'rate1000' || Number(payload && payload.mult) === 1000) ? 1000 : 100;
  let value = null, num = null, den = null;
  if (entryMode === 'rate') {
    num = Number(payload && payload.num) || 0;
    den = Number(payload && payload.den) || 0;
    value = den > 0 ? Math.round((num / den) * mult * 100) / 100 : 0;
  } else {
    const rawVal = payload && payload.value;
    value = (rawVal === '' || rawVal == null) ? 0 : (Number(rawVal) || 0);
  }
  // Optional incident / CAPA block (filled when an incident occurred this month).
  const capaIn = payload && payload.capa;
  const capa = (capaIn && typeof capaIn === 'object' && (capaIn.incidentDetails || capaIn.finding || capaIn.corrective || capaIn.preventive))
    ? { incidentDetails: String(capaIn.incidentDetails || ''), finding: String(capaIn.finding || ''), corrective: String(capaIn.corrective || ''), preventive: String(capaIn.preventive || '') }
    : null;
  // Per-month incidents (each with its own CAPA). The count/numerator auto-derives
  // from how many are logged; the full list is stored on the indicator's month.
  const S = (v) => String((v == null ? '' : v)).slice(0, 4000);
  const incidents = Array.isArray(payload && payload.incidents)
    ? payload.incidents.map((x) => ({
        // patient & incident demographics (per-incident report fields)
        uhid: S(x && x.uhid), patientName: S(x && x.patientName), age: S(x && x.age), gender: S(x && x.gender),
        diagnosis: S(x && x.diagnosis), admissionDate: S(x && x.admissionDate), procedureDate: S(x && x.procedureDate),
        // narrative + CAPA
        details: S(x && x.details), finding: S(x && x.finding), corrective: S(x && x.corrective), preventive: S(x && x.preventive),
        remark: S(x && x.remark),
      })).filter((x) => x.details || x.finding || x.corrective || x.preventive || x.uhid || x.patientName || x.diagnosis || x.remark)
    : null;
  return {
    type: 'quality', area, areaName: doc.name || area, indicatorId: indId, indicatorName: indName, capa, incidents,
    isNewIndicator: isNew, valueType: (payload && payload.valueType) || (found && found.valueType) || 'Count',
    benchmark: (payload && payload.benchmark) || (found && found.benchmark) || '',
    goalDirection: (payload && payload.goalDirection) || (found && found.goalDirection) || 'lower_is_better',
    // calculation definition (named inputs + unit) so the rich entry form persists
    formula: entryMode === 'rate' ? (mult === 1000 ? 'rate1000' : 'pct') : 'count',
    numLabel: (payload && payload.numLabel) || (found && found.numLabel) || '',
    denLabel: (payload && payload.denLabel) || (found && found.denLabel) || '',
    unit: (payload && payload.unit) || (found && found.unit) || '',
    month, entryMode, mult, value, num, den, remark: String((payload && payload.remark) || ''),
  };
}

/* ---------------- apply (write to canonical collections) ---------------- */
async function applyPatient(spec) {
  const c = await col('departments');
  if (!c) throw new Error('Database not available.');
  const dept = await c.findOne({ _id: spec.department });
  if (!dept) throw new Error('Department no longer exists: ' + spec.department);
  const months = Array.isArray(dept.months) ? dept.months.slice() : [];
  const data = Array.isArray(dept.data) ? dept.data.map((r) => Object.assign({}, r)) : [];
  const idx = months.indexOf(spec.month);
  if (idx >= 0) data[idx] = Object.assign({}, data[idx], spec.values);
  else { months.push(spec.month); data.push(Object.assign({}, spec.values)); }
  const zipped = months.map((m, i) => ({ m, r: data[i], rank: monthRank(m) })).sort((a, b) => a.rank - b.rank);
  await c.updateOne({ _id: spec.department }, { $set: { months: zipped.map((z) => z.m), data: zipped.map((z) => z.r) } });
}

async function applyQuality(spec) {
  const c = await col('quality');
  if (!c) throw new Error('Database not available.');
  const doc = await c.findOne({ _id: spec.area });
  if (!doc) throw new Error('Quality area no longer exists: ' + spec.area);
  const indicators = Array.isArray(doc.indicators) ? doc.indicators.map((i) => Object.assign({}, i)) : [];
  let ind = indicators.find((i) => i.id === spec.indicatorId);
  if (!ind) {
    ind = { id: spec.indicatorId, name: spec.indicatorName, valueType: spec.valueType || 'Count', benchmark: spec.benchmark || '', goalDirection: spec.goalDirection || 'lower_is_better', months: {}, monthRemarks: {} };
    indicators.push(ind);
  }
  // Persist the calculation definition so the rich entry form re-renders on reselect.
  if (spec.formula) ind.formula = spec.formula;
  if (spec.numLabel) ind.numLabel = spec.numLabel;
  if (spec.denLabel) ind.denLabel = spec.denLabel;
  if (spec.unit) ind.unit = spec.unit;
  if (Array.isArray(spec.incidents)) ind.incidents = Object.assign({}, ind.incidents || {}, { [spec.month]: spec.incidents });
  // Monthly storage (no quarters). For rate/%, keep numerator/denominator per month.
  if (spec.entryMode === 'rate') {
    ind.mNum = Object.assign({}, ind.mNum || {}, { [spec.month]: spec.num });
    ind.mDen = Object.assign({}, ind.mDen || {}, { [spec.month]: spec.den });
  }
  ind.months = Object.assign({}, ind.months || {}, { [spec.month]: spec.value });
  if (spec.remark) ind.monthRemarks = Object.assign({}, ind.monthRemarks || {}, { [spec.month]: spec.remark });
  // Incident / CAPA (Corrective & Preventive Action) for the month, when provided.
  if (spec.capa) ind.capa = Object.assign({}, ind.capa || {}, { [spec.month]: Object.assign({ value: spec.value, recordedAt: Date.now() }, spec.capa) });
  await c.updateOne({ _id: spec.area }, { $set: { indicators } });
}

/* ---------------- admin: custom fields on the patient form ---------------- */
// Admins can add/remove custom columns on a department's data-entry form. Custom
// columns are tagged {custom:true} so built-in census columns can't be deleted.
async function addDepartmentField(deptId, field) {
  const c = await col('departments');
  if (!c) throw new Error('Database not available.');
  const dept = await c.findOne({ _id: String(deptId) });
  if (!dept) throw new Error('Unknown department.');
  const label = String((field && field.label) || '').trim();
  if (!label) throw new Error('Field label is required.');
  let id = String((field && field.id) || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (!id) id = 'cf' + label.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 14) + Math.floor(100 + Math.random() * 900);
  const cols = Array.isArray(dept.cols) ? dept.cols.slice() : [];
  if (cols.some((co) => co.id === id)) throw new Error('A field with that id already exists.');
  const newCol = { id, label, custom: true };
  if (field && field.pct) newCol.pct = true;
  cols.push(newCol);
  await c.updateOne({ _id: String(deptId) }, { $set: { cols } });
  return { ok: true, field: newCol, cols };
}
async function removeDepartmentField(deptId, fieldId) {
  const c = await col('departments');
  if (!c) throw new Error('Database not available.');
  const dept = await c.findOne({ _id: String(deptId) });
  if (!dept) throw new Error('Unknown department.');
  const cols = Array.isArray(dept.cols) ? dept.cols : [];
  const target = cols.find((co) => co.id === String(fieldId));
  if (!target) throw new Error('Field not found.');
  if (!target.custom) throw new Error('Only custom fields can be removed (built-in columns are protected).');
  await c.updateOne({ _id: String(deptId) }, { $set: { cols: cols.filter((co) => co.id !== String(fieldId)) } });
  return { ok: true, cols: cols.filter((co) => co.id !== String(fieldId)) };
}

/* ---------------- submissions (pending -> approve/reject) ---------------- */
async function createSubmission(spec, meta) {
  const rec = Object.assign({}, spec, {
    status: 'pending',
    responsible: normResp(meta && meta.responsible),
    note: String((meta && meta.note) || ''),
    submittedBy: (meta && meta.submittedBy) || 'local',
    source: (meta && meta.source) || 'app',
    submittedAt: Date.now(),
  });
  const c = await col('submissions');
  if (!c) { const out = Object.assign({ id: genId('sub') }, rec); mem.submissions.unshift(out); return out; }
  const _id = genId('sub');
  await c.insertOne(Object.assign({ _id }, rec));
  return Object.assign({ id: _id }, rec);
}
async function submitPatient(payload, meta) { return { ok: true, submission: await createSubmission(await buildPatientSpec(payload), Object.assign({}, payload, meta)) }; }
async function submitQuality(payload, meta) { return { ok: true, submission: await createSubmission(await buildQualitySpec(payload), Object.assign({}, payload, meta)) }; }

async function getSubmissionById(id) {
  const c = await col('submissions');
  if (!c) return mem.submissions.find((s) => s.id === String(id)) || null;
  const d = await c.findOne({ _id: String(id) });
  if (!d) return null;
  const { _id, ...r } = d; return { id: _id, ...r };
}
async function setSubmissionStatus(id, patch) {
  const c = await col('submissions');
  if (!c) { const s = mem.submissions.find((x) => x.id === String(id)); if (s) Object.assign(s, patch); return s; }
  await c.updateOne({ _id: String(id) }, { $set: patch });
  return getSubmissionById(id);
}

async function approveSubmission(id, by) {
  const s = await getSubmissionById(id);
  if (!s) throw new Error('Submission not found.');
  if (s.status === 'approved') return { ok: true, submission: s, already: true };
  if (s.type === 'patient') await applyPatient(s);
  else if (s.type === 'quality') await applyQuality(s);
  else throw new Error('Unknown submission type.');
  const upd = await setSubmissionStatus(id, { status: 'approved', reviewedBy: by || 'admin', reviewedAt: Date.now() });
  return { ok: true, submission: upd };
}
async function rejectSubmission(id, by, reason) {
  const s = await getSubmissionById(id);
  if (!s) throw new Error('Submission not found.');
  const upd = await setSubmissionStatus(id, { status: 'rejected', reviewedBy: by || 'admin', reviewedAt: Date.now(), rejectReason: String(reason || '') });
  return { ok: true, submission: upd };
}

async function getSubmissions(query) {
  const status = query && query.status && query.status !== 'all' ? String(query.status) : null;
  const n = Math.min(Math.max(parseInt(query && query.limit, 10) || 200, 1), 1000);
  const c = await col('submissions');
  if (!c) {
    let arr = mem.submissions.slice();
    if (status) arr = arr.filter((s) => s.status === status);
    return arr.slice(0, n);
  }
  const filter = status ? { status } : {};
  const docs = await c.find(filter).sort({ submittedAt: -1 }).limit(n).toArray();
  return docs.map((d) => { const { _id, ...r } = d; return { id: _id, ...r }; });
}

async function getStats() {
  const c = await col('submissions');
  if (!c) {
    const by = (f) => mem.submissions.filter(f).length;
    return { total: mem.submissions.length, pending: by((s) => s.status === 'pending'), approved: by((s) => s.status === 'approved'), rejected: by((s) => s.status === 'rejected'), patient: by((s) => s.type === 'patient'), quality: by((s) => s.type === 'quality'), lastSubmittedAt: mem.submissions[0] ? mem.submissions[0].submittedAt : null };
  }
  const [total, pending, approved, rejected, patient, quality] = await Promise.all([
    c.countDocuments({}), c.countDocuments({ status: 'pending' }), c.countDocuments({ status: 'approved' }),
    c.countDocuments({ status: 'rejected' }), c.countDocuments({ type: 'patient' }), c.countDocuments({ type: 'quality' }),
  ]);
  const lastArr = await c.find({}).sort({ submittedAt: -1 }).limit(1).toArray();
  return { total, pending, approved, rejected, patient, quality, lastSubmittedAt: lastArr[0] ? lastArr[0].submittedAt : null };
}

/* ---------------- shareable short links ---------------- */
const memLinks = [];
function shortCode() { return Math.random().toString(36).slice(2, 8); }
function nextMonthSuggestion(dept) {
  const months = (dept && dept.months) || [];
  if (!months.length) return '';
  const p = String(months[months.length - 1]).split('-');
  const idx = MONTHS.indexOf(p[0]); let yy = parseInt(p[1], 10);
  if (idx < 0 || isNaN(yy)) return months[months.length - 1];
  let n = idx + 1; if (n > 11) { n = 0; yy++; }
  return MONTHS[n] + '-' + String(yy).padStart(2, '0');
}
async function createShortlink(input, by) {
  const type = input && input.type === 'quality' ? 'quality' : 'patient';
  const rec = {
    type,
    department: type === 'patient' ? String((input && input.department) || '').trim() : null,
    area: type === 'quality' ? String((input && input.area) || '').trim() : null,
    responsible: normResp(input && input.responsible),
    label: String((input && input.label) || '').trim(),
    createdBy: by || 'admin', createdAt: Date.now(), hits: 0,
  };
  if (type === 'patient' && !rec.department) throw new Error('Department is required for a patient link.');
  if (type === 'quality' && !rec.area) throw new Error('Quality area is required for a quality link.');
  const code = (input && input.code) ? String(input.code) : shortCode();
  const c = await col('shortlinks');
  if (!c) { const out = { code, ...rec }; memLinks.unshift(out); return out; }
  await c.insertOne({ _id: code, ...rec });
  return { code, ...rec };
}
async function getShortlinks() {
  const c = await col('shortlinks');
  if (!c) return memLinks.slice();
  const docs = await c.find({}).sort({ createdAt: -1 }).toArray();
  return docs.map((d) => { const { _id, ...r } = d; return { code: _id, ...r }; });
}
async function getShortlink(code) {
  const c = await col('shortlinks');
  if (!c) return memLinks.find((l) => l.code === String(code)) || null;
  const d = await c.findOne({ _id: String(code) });
  if (!d) return null; const { _id, ...r } = d; return { code: _id, ...r };
}
async function deleteShortlink(code) {
  const c = await col('shortlinks');
  if (!c) { const i = memLinks.findIndex((l) => l.code === String(code)); if (i >= 0) memLinks.splice(i, 1); return { ok: true }; }
  await c.deleteOne({ _id: String(code) }); return { ok: true };
}
async function bumpHit(code) {
  const c = await col('shortlinks');
  if (!c) { const l = memLinks.find((x) => x.code === String(code)); if (l) l.hits = (l.hits || 0) + 1; return; }
  await c.updateOne({ _id: String(code) }, { $inc: { hits: 1 } });
}
async function shortlinkMeta(code) {
  const link = await getShortlink(code);
  if (!link) return null;
  if (link.type === 'patient') {
    const c = await col('departments'); const dept = c ? await c.findOne({ _id: link.department }) : null;
    if (!dept) return { ok: false, error: 'Department not found.' };
    return {
      ok: true, type: 'patient', label: link.label, responsible: link.responsible,
      department: { id: dept._id, name: dept.name },
      cols: (dept.cols || []).map((co) => ({ id: co.id, label: co.label, pct: !!co.pct })),
      suggestedMonth: nextMonthSuggestion(dept),
    };
  }
  const c = await col('quality'); const area = c ? await c.findOne({ _id: link.area }) : null;
  if (!area) return { ok: false, error: 'Quality area not found.' };
  return {
    ok: true, type: 'quality', label: link.label, responsible: link.responsible,
    area: { key: area._id, name: area.name },
    indicators: (area.indicators || []).map((i) => ({ id: i.id, name: i.name, valueType: i.valueType })),
    months: (function () { const out = []; [25, 26, 27].forEach((yy) => { MONTHS.forEach((m) => out.push({ key: m + '-' + yy, label: m + ' 20' + yy })); }); return out; })(),
  };
}
async function shortlinkSubmit(code, body) {
  const link = await getShortlink(code);
  if (!link) throw new Error('Invalid or expired link.');
  const meta = { responsible: link.responsible, submittedBy: (link.responsible && link.responsible.name) || 'shared-link', source: 'shortlink' };
  if (link.type === 'patient') {
    const spec = await buildPatientSpec({ department: link.department, month: body && body.month, values: body && body.values });
    return { ok: true, submission: await createSubmission(spec, meta) };
  }
  const spec = await buildQualitySpec({ area: link.area, indicatorId: body && body.indicatorId, indicatorName: body && body.indicatorName, quarter: body && body.quarter, year: body && body.year, value: body && body.value, remark: body && body.remark });
  return { ok: true, submission: await createSubmission(spec, meta) };
}

// Self-contained public form page served at /s/:code (no admin login needed).
function shortlinkPage(code) {
  const C = JSON.stringify(String(code));
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>'
    + '<title>UNICO — Data Submission</title>'
    + '<link rel="stylesheet" href="/vendor/fonts/ibm-plex.css"/>'
    + '<style>'
    + '*{box-sizing:border-box}body{margin:0;font-family:"IBM Plex Sans",system-ui,Segoe UI,sans-serif;background:#0d1b2e;'
    + 'background-image:radial-gradient(1100px 700px at 18% -10%,rgba(39,168,219,.16),transparent 60%);min-height:100vh;padding:24px;color:#16202e}'
    + '.wrap{max-width:560px;margin:0 auto}.card{background:#fff;border:1px solid #e3e9f1;border-radius:16px;padding:24px 26px;box-shadow:0 20px 50px rgba(5,12,24,.45)}'
    + '.logo{height:32px;margin-bottom:8px}h1{font-size:18px;margin:6px 0 2px}.muted{color:#6c7a8c;font-size:12.5px;margin:0 0 16px}'
    + '.who{font-size:12.5px;color:#3c4858;background:#f1f6fb;border:1px solid #e3e9f1;border-radius:8px;padding:8px 11px;margin-bottom:14px}'
    + '.grp{display:flex;flex-direction:column;gap:5px;margin-bottom:12px}label{font-size:12px;font-weight:600;color:#3c4858}'
    + 'input,select{width:100%;padding:10px 12px;border:1px solid #dde3ec;border-radius:8px;font-family:inherit;font-size:14px;background:#f7f9fc;outline:none}'
    + 'input:focus,select:focus{border-color:#27a8db;background:#fff}'
    + '.btn{width:100%;margin-top:6px;padding:11px;border:0;border-radius:9px;cursor:pointer;font-weight:700;font-size:14px;color:#fff;background:linear-gradient(135deg,#27a8db,#0072a3)}'
    + '.btn:disabled{opacity:.6}.err{color:#b4232f;font-size:12.5px;font-weight:600;display:block;margin-top:8px}'
    + '.done{text-align:center;padding:14px 0}.done h2{margin:10px 0 4px;color:#1f9d57}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}'
    + '</style></head><body><div class="wrap"><div class="card">'
    + '<img class="logo" src="/unico/logo.svg" alt="UNICO Healthcare"/>'
    + '<h1 id="ttl">Data Submission</h1><p class="muted" id="sub">Loading form…</p>'
    + '<div id="form-root"></div></div>'
    + '<p style="text-align:center;color:#9aa6b4;font-size:10.5px;margin-top:14px;letter-spacing:.4px">UNICO Healthcare — Statistics Suite</p>'
    + '</div><script>(function(){'
    + 'var code=' + C + ';var root=document.getElementById("form-root");'
    + 'function esc(s){return String(s==null?"":s).replace(/[&<>\\"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c];});}'
    + 'function field(l,ctrl){return \'<div class="grp"><label>\'+esc(l)+\'</label>\'+ctrl+\'</div>\';}'
    + 'fetch("/s/"+code+"/meta").then(function(r){return r.json();}).then(function(m){'
    + 'if(!m||!m.ok){document.getElementById("sub").innerHTML="";root.innerHTML=\'<span class="err">\'+esc((m&&m.error)||"This link is invalid or expired.")+\'</span>\';return;}'
    + 'var ttl=m.type==="patient"?("Patient Statistics — "+m.department.name):("Quality Data — "+m.area.name);'
    + 'document.getElementById("ttl").textContent=ttl;'
    + 'document.getElementById("sub").textContent=m.label||"Please fill in the fields below and submit.";'
    + 'var html=\'<div class="who">Submitting as: <b>\'+esc((m.responsible&&m.responsible.name)||"—")+\'</b></div>\';'
    + 'if(m.type==="patient"){html+=field("Reporting month (e.g. Jun-26)",\'<input id="f_month" value="\'+esc(m.suggestedMonth||"")+\'"/>\');'
    + 'html+=\'<div class="grid2">\';m.cols.forEach(function(c){html+=field(c.label+(c.pct?" (%)":""),\'<input type="number" step="any" data-col="\'+esc(c.id)+\'"/>\');});html+=\'</div>\';}'
    + 'else{var opts=m.indicators.map(function(i){return \'<option value="\'+esc(i.id)+\'">\'+esc(i.name)+\'</option>\';}).join("");'
    + 'html+=field("Indicator",\'<select id="f_ind">\'+opts+\'</select>\');'
    + 'html+=\'<div class="grid2">\'+field("Quarter",\'<select id="f_q">\'+m.quarters.map(function(q){return \'<option>\'+q+\'</option>\';}).join("")+\'</select>\')+field("Year",\'<input id="f_year" value="2025-2026"/>\')+\'</div>\';'
    + 'html+=field("Value",\'<input id="f_val" type="number" step="any"/>\');html+=field("Remark (optional)",\'<input id="f_remark"/>\');}'
    + 'html+=\'<button id="sb" class="btn">Submit</button><div id="msg"></div>\';root.innerHTML=html;'
    + 'document.getElementById("sb").onclick=function(){submit(m);};'
    + '}).catch(function(){document.getElementById("sub").innerHTML="";root.innerHTML=\'<span class="err">Could not load the form.</span>\';});'
    + 'function submit(m){var btn=document.getElementById("sb"),msg=document.getElementById("msg");var body;'
    + 'if(m.type==="patient"){var mo=(document.getElementById("f_month").value||"").trim();if(!mo){msg.innerHTML=\'<span class="err">Enter the reporting month.</span>\';return;}'
    + 'var values={};root.querySelectorAll("[data-col]").forEach(function(inp){if(inp.value!=="")values[inp.getAttribute("data-col")]=inp.value;});body={month:mo,values:values};}'
    + 'else{body={indicatorId:document.getElementById("f_ind").value,quarter:document.getElementById("f_q").value,year:document.getElementById("f_year").value,value:document.getElementById("f_val").value,remark:document.getElementById("f_remark").value};}'
    + 'btn.disabled=true;btn.textContent="Submitting…";msg.innerHTML="";'
    + 'fetch("/s/"+code+"/submit",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)}).then(function(r){return r.json();}).then(function(r){'
    + 'if(r&&r.ok){root.innerHTML=\'<div class="done"><svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#1f9d57" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/></svg><h2>Thank you!</h2><p class="muted">Your submission was recorded and sent for review.</p><button class="btn" onclick="location.reload()">Submit another</button></div>\';}'
    + 'else{btn.disabled=false;btn.textContent="Submit";msg.innerHTML=\'<span class="err">\'+esc((r&&r.error)||"Submission failed.")+\'</span>\';}'
    + '}).catch(function(){btn.disabled=false;btn.textContent="Submit";msg.innerHTML=\'<span class="err">Submission failed.</span>\';});}'
    + '})();</script></body></html>';
}

// Self sign-up page for data collectors (active only in login mode).
function signupPage(opts) {
  const o = opts || {};
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const err = o.error ? '<div class="err">' + esc(o.error) + '</div>' : '';
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>'
    + '<title>Create account - UNICO Data Collection</title>'
    + '<link rel="stylesheet" href="/vendor/fonts/ibm-plex.css"/>'
    + '<style>*{box-sizing:border-box}body{margin:0;font-family:"IBM Plex Sans",system-ui,Segoe UI,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px;'
    + 'background:#0d1b2e;background-image:radial-gradient(1100px 700px at 18% -10%,rgba(39,168,219,.16),transparent 60%)}'
    + '.card{width:min(390px,94vw);background:#fff;border-radius:18px;padding:28px;box-shadow:0 24px 60px rgba(5,12,24,.55)}'
    + '.logo{height:34px;margin-bottom:10px}h1{font-size:18px;margin:4px 0;color:#16202e}.sub{font-size:12.5px;color:#6c7a8c;margin:0 0 16px}'
    + '.grp{display:flex;flex-direction:column;gap:5px;margin-bottom:12px}label{font-size:11.5px;font-weight:600;color:#3c4858}'
    + 'input{width:100%;padding:11px 13px;border:1px solid #dde3ec;border-radius:9px;font-family:inherit;font-size:14px;background:#f7f9fc;color:#16202e}'
    + 'input:focus{border-color:#27a8db;background:#fff;outline:none}.btn{width:100%;margin-top:6px;padding:11px;border:0;border-radius:9px;cursor:pointer;font-family:inherit;font-weight:700;font-size:13.5px;color:#fff;background:linear-gradient(135deg,#27a8db,#0072a3)}'
    + '.err{font-size:12px;font-weight:600;color:#b4232f;background:rgba(210,58,82,.1);border:1px solid rgba(210,58,82,.3);border-radius:8px;padding:7px 10px;margin-bottom:10px}'
    + '.alt{margin-top:14px;font-size:12px;text-align:center;color:#6c7a8c}.alt a{color:#0072a3;font-weight:600;text-decoration:none}</style></head><body>'
    + '<form class="card" method="POST" action="/signup">'
    + '<img class="logo" src="/unico/logo.svg" alt="UNICO"/>'
    + '<h1>Create data-collection account</h1>'
    + '<p class="sub">Register to submit your department statistics. An administrator assigns your departments after sign-up.</p>'
    + err
    + '<div class="grp"><label>Full name</label><input name="name" value="' + esc(o.name) + '" autofocus/></div>'
    + '<div class="grp"><label>Emp ID (your login)</label><input name="empId" value="' + esc(o.empId) + '" placeholder="e.g. rabbi.miah"/></div>'
    + '<div class="grp"><label>Password</label><input name="password" type="password" placeholder="min 4 characters"/></div>'
    + '<button class="btn" type="submit">Create account</button>'
    + '<div class="alt">Already have an account? <a href="/login">Sign in</a></div>'
    + '</form></body></html>';
}

/* ---------------- route registration ---------------- */
function mount(app, opts) {
  const guard = (opts && opts.requireApi) || function (req, res, next) { next(); };
  const who = (req) => (req.user && (req.user.name || req.user.sub)) || 'local';
  // approve/reject require an Administrator when login is on; open local mode allows it.
  const adminOnly = (req, res, next) => {
    if (req.user && req.user.role && req.user.role !== 'Administrator') return res.status(403).json({ ok: false, error: 'Administrator access required.' });
    next();
  };

  app.get('/api/responsibles', guard, async (req, res) => {
    try { res.json({ ok: true, responsibles: await getResponsibles() }); } catch (e) { res.status(500).json({ ok: false, error: String(e.message || e) }); }
  });
  app.post('/api/responsibles', guard, async (req, res) => {
    try { res.json({ ok: true, responsible: await saveResponsible(req.body || {}) }); } catch (e) { res.status(400).json({ ok: false, error: String(e.message || e) }); }
  });
  app.delete('/api/responsibles/:id', guard, async (req, res) => {
    try { await deleteResponsible(req.params.id); res.json({ ok: true }); } catch (e) { res.status(400).json({ ok: false, error: String(e.message || e) }); }
  });

  app.get('/api/submissions', guard, async (req, res) => {
    try {
      let subs = await getSubmissions(req.query);
      // Collectors only see submissions they made or that touch their assignments.
      if (req.user && req.user.role === 'collector') {
        const scope = await getUserScope(req.user.sub);
        const names = [req.user.name, req.user.sub, scope && scope.name].filter(Boolean);
        const depts = (scope && scope.departments) || [];
        const areas = (scope && scope.qualityAreas) || [];
        subs = subs.filter((s) => names.includes(s.submittedBy)
          || (s.responsible && names.includes(s.responsible.name))
          || (s.type === 'patient' && depts.includes(s.department))
          || (s.type === 'quality' && areas.includes(s.area)));
      }
      res.json({ ok: true, submissions: subs });
    } catch (e) { res.status(500).json({ ok: false, error: String(e.message || e) }); }
  });
  app.get('/api/submissions/stats', guard, async (req, res) => {
    try { res.json({ ok: true, stats: await getStats() }); } catch (e) { res.status(500).json({ ok: false, error: String(e.message || e) }); }
  });
  app.post('/api/submissions/patient', guard, async (req, res) => {
    try { res.json(await submitPatient(req.body || {}, { submittedBy: who(req), source: 'app' })); } catch (e) { res.status(400).json({ ok: false, error: String(e.message || e) }); }
  });
  app.post('/api/submissions/quality', guard, async (req, res) => {
    try { res.json(await submitQuality(req.body || {}, { submittedBy: who(req), source: 'app' })); } catch (e) { res.status(400).json({ ok: false, error: String(e.message || e) }); }
  });
  // Admin: manage custom fields on a department's data-collection form.
  app.post('/api/departments/:id/fields', guard, adminOnly, async (req, res) => {
    try { res.json(await addDepartmentField(req.params.id, req.body || {})); } catch (e) { res.status(400).json({ ok: false, error: String(e.message || e) }); }
  });
  app.delete('/api/departments/:id/fields/:fieldId', guard, adminOnly, async (req, res) => {
    try { res.json(await removeDepartmentField(req.params.id, req.params.fieldId)); } catch (e) { res.status(400).json({ ok: false, error: String(e.message || e) }); }
  });

  app.post('/api/submissions/:id/approve', guard, adminOnly, async (req, res) => {
    try { res.json(await approveSubmission(req.params.id, who(req))); } catch (e) { res.status(400).json({ ok: false, error: String(e.message || e) }); }
  });
  app.post('/api/submissions/:id/reject', guard, adminOnly, async (req, res) => {
    try { res.json(await rejectSubmission(req.params.id, who(req), req.body && req.body.reason)); } catch (e) { res.status(400).json({ ok: false, error: String(e.message || e) }); }
  });
  // Admin: correct a PENDING submission's values/note before approving it.
  app.patch('/api/submissions/:id', guard, adminOnly, async (req, res) => {
    try {
      const s = await getSubmissionById(req.params.id);
      if (!s) return res.status(404).json({ ok: false, error: 'Submission not found.' });
      if (s.status !== 'pending') return res.status(400).json({ ok: false, error: 'Only pending submissions can be edited.' });
      const b = req.body || {};
      const patch = { editedBy: who(req), editedAt: Date.now() };
      if (b.note != null) patch.note = String(b.note);
      if (s.type === 'patient') {
        if (b.values && typeof b.values === 'object') {
          const out = {};
          Object.keys(b.values).forEach((k) => { const v = b.values[k]; if (v !== '' && v != null && !isNaN(Number(v))) out[k] = Number(v); });
          patch.values = out;
        }
        if (b.month) patch.month = String(b.month).trim();
      } else if (s.type === 'quality') {
        if (b.value != null && b.value !== '' && !isNaN(Number(b.value))) patch.value = Number(b.value);
        if (b.remark != null) patch.remark = String(b.remark);
      }
      res.json({ ok: true, submission: await setSubmissionStatus(req.params.id, patch) });
    } catch (e) { res.status(400).json({ ok: false, error: String(e.message || e) }); }
  });

  // Shareable short links — management (admin) ...
  app.get('/api/shortlinks', guard, async (req, res) => {
    try { res.json({ ok: true, links: await getShortlinks() }); } catch (e) { res.status(500).json({ ok: false, error: String(e.message || e) }); }
  });
  app.post('/api/shortlinks', guard, async (req, res) => {
    try { res.json({ ok: true, link: await createShortlink(req.body || {}, who(req)) }); } catch (e) { res.status(400).json({ ok: false, error: String(e.message || e) }); }
  });
  app.delete('/api/shortlinks/:code', guard, async (req, res) => {
    try { await deleteShortlink(req.params.code); res.json({ ok: true }); } catch (e) { res.status(400).json({ ok: false, error: String(e.message || e) }); }
  });

  // ... and the PUBLIC landing + submit (no login: the code is the capability,
  // it only ever exposes/accepts that one scoped form, and submissions are pending).
  app.get('/s/:code', async (req, res) => {
    try { const link = await getShortlink(req.params.code); if (link) bumpHit(req.params.code).catch(() => {}); }
    catch (e) { /* ignore hit-count errors */ }
    res.set('Cache-Control', 'no-store').type('html').send(shortlinkPage(req.params.code));
  });
  app.get('/s/:code/meta', async (req, res) => {
    try { const m = await shortlinkMeta(req.params.code); if (!m) return res.status(404).json({ ok: false, error: 'Invalid or expired link.' }); res.json(m); }
    catch (e) { res.status(500).json({ ok: false, error: String(e.message || e) }); }
  });
  app.post('/s/:code/submit', async (req, res) => {
    try { res.json(await shortlinkSubmit(req.params.code, req.body || {})); } catch (e) { res.status(400).json({ ok: false, error: String(e.message || e) }); }
  });

  // Public self sign-up for data collectors. DISABLED by default — collector
  // accounts are admin-controlled (created in Responsible Persons / User
  // Management). Set ALLOW_SIGNUP=true in server/.env to re-enable self-registration.
  const signupAllowed = () => String(process.env.ALLOW_SIGNUP || '').toLowerCase() === 'true';
  app.get('/signup', (req, res) => {
    if (!session.authRequired()) return res.redirect(302, '/');
    if (!signupAllowed()) return res.redirect(302, '/login'); // self sign-up disabled
    if (session.userFromReq(req)) return res.redirect(302, '/collect');
    res.set('Cache-Control', 'no-store').type('html').send(signupPage({}));
  });
  app.post('/signup', async (req, res) => {
    if (!session.authRequired()) return res.redirect(302, '/');
    if (!signupAllowed()) return res.status(403).type('html').send(signupPage({ error: 'Self sign-up is disabled. Ask an administrator to create your account.' }));
    try {
      const r = await registerCollector({ name: req.body && req.body.name, empId: req.body && req.body.empId, password: req.body && req.body.password });
      session.setSession(res, auth.sign({ username: r.username, role: 'collector', name: (req.body && req.body.name) || r.username }));
      res.redirect(302, '/collect');
    } catch (e) {
      res.status(400).type('html').send(signupPage({ error: String(e.message || e), name: req.body && req.body.name, empId: req.body && req.body.empId }));
    }
  });
}

module.exports = {
  mount, getResponsibles, saveResponsible, getSubmissions, getStats,
  submitPatient, submitQuality, approveSubmission, rejectSubmission,
  buildPatientSpec, buildQualitySpec, createSubmission,
  createShortlink, getShortlinks, deleteShortlink, shortlinkMeta, shortlinkSubmit,
  registerCollector, upsertCollectorUser, getUserScope,
  addDepartmentField, removeDepartmentField,
};
