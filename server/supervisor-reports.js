/* Shift Supervisor Report module — the "Log Sheet For Night Supervisor" digitised.
 *
 * A supervisor fills a structured report for a shift (Morning / Evening / Night) of
 * a given date. Each report is ONE self-contained document — an authoritative shift
 * log — so we save directly to a dedicated `supervisorReports` collection (no
 * submission -> approve -> apply pipeline; that machinery is for feeding the
 * canonical statistics/quality dashboards, which supervisor logs do NOT mutate).
 *
 * A `status` field (draft | submitted | approved) provides a light digital sign-off:
 * approve locks further editing (enforced client-side; server keeps the audit fields).
 *
 * Collection: `supervisorReports`. Self-contained via db.getDbHandle(); web.js calls
 * mount() once. Falls back to an in-memory array when no MONGODB_URI (dev only).
 */
const { getDbHandle } = require('./db');

const COLL = 'supervisorReports';
const SHIFTS = ['Morning', 'Evening', 'Night'];
const STATUSES = ['draft', 'submitted', 'approved'];

async function col() { const db = await getDbHandle(); return db ? db.collection(COLL) : null; }
function genId(prefix) { return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e8).toString(36); }

// In-memory fallback for dev (no MONGODB_URI). The web app always has Mongo.
const mem = { reports: [] };

const s = (v, max) => String(v == null ? '' : v).slice(0, max || 400);
const arr = (v) => (Array.isArray(v) ? v : []);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
// _id <-> id mapping on read.
const outDoc = (d) => { if (!d) return null; const { _id, ...r } = d; return { id: _id, ...r }; };

// Normalise an incoming report payload into a clean, storable document. We keep the
// section arrays as free-form row objects (the client owns the exact columns per the
// log-sheet), only bounding string sizes and coercing the known scalar blocks.
function normReport(input) {
  const i = obj(input);
  const shift = SHIFTS.indexOf(s(i.shift)) >= 0 ? s(i.shift) : 'Night';
  const status = STATUSES.indexOf(s(i.status)) >= 0 ? s(i.status) : 'draft';
  const rows = (v) => arr(v).map((r) => obj(r)).slice(0, 500);
  const doc = {
    date: s(i.date, 20),                 // 'YYYY-MM-DD'
    shift,
    shiftTime: s(i.shiftTime, 60),
    supervisorName: s(i.supervisorName, 120),
    status,
    newAdmissions: rows(i.newAdmissions),
    criticalArea: rows(i.criticalArea),
    cabinArea: rows(i.cabinArea),
    lama: rows(i.lama),
    discharged: rows(i.discharged),
    otTable: rows(i.otTable),
    surgeries: rows(i.surgeries),
    interventional: rows(i.interventional),
    radiological: rows(i.radiological),
    radiologyCounts: obj(i.radiologyCounts),
    ventilators: rows(i.ventilators),
    erCensus: obj(i.erCensus),
    general: obj(i.general),
    pressureSore: rows(i.pressureSore),
    phlebitis: rows(i.phlebitis),
    absenteeism: s(i.absenteeism, 2000),
    sickLeave: s(i.sickLeave, 2000),
    roundObservation: s(i.roundObservation, 4000),
    census: obj(i.census),
    totals: obj(i.totals),
    sign: obj(i.sign),
  };
  // Preserve user-defined custom sections (keys like custom_xxx) as row arrays so the
  // client's dynamic-fields engine round-trips. Custom COLUMNS inside built-in sections
  // already persist because rows keep every key on each row object.
  Object.keys(i).forEach((k) => { if (/^custom_[a-z0-9_]+$/i.test(k) && Array.isArray(i[k])) doc[k] = rows(i[k]); });
  return doc;
}

async function getReports(query) {
  const q = obj(query);
  const filter = {};
  if (q.date) filter.date = s(q.date, 20);
  if (q.shift) filter.shift = s(q.shift, 20);
  if (q.status) filter.status = s(q.status, 20);
  const limit = Math.min(2000, Math.max(1, parseInt(q.limit, 10) || 500));
  const c = await col();
  if (!c) {
    let list = mem.reports.slice();
    if (filter.date) list = list.filter((r) => r.date === filter.date);
    if (filter.shift) list = list.filter((r) => r.shift === filter.shift);
    if (filter.status) list = list.filter((r) => r.status === filter.status);
    return list.sort(byRecent).slice(0, limit).map(outDoc);
  }
  const docs = await c.find(filter).sort({ date: -1, updatedAt: -1 }).limit(limit).toArray();
  return docs.map(outDoc);
}

// Sort newest shift first: by date, then Night > Evening > Morning within a day.
const SHIFT_ORD = { Morning: 0, Evening: 1, Night: 2 };
function byRecent(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return (SHIFT_ORD[b.shift] || 0) - (SHIFT_ORD[a.shift] || 0);
}

async function getReportById(id) {
  const c = await col();
  if (!c) return outDoc(mem.reports.find((r) => r._id === id));
  return outDoc(await c.findOne({ _id: String(id) }));
}

async function saveReport(input) {
  const i = obj(input);
  const now = Date.now();
  const doc = normReport(i);
  const c = await col();
  // Update in place when an id is supplied; else create.
  const existingId = i.id || i._id;
  if (existingId) {
    if (!c) {
      const idx = mem.reports.findIndex((r) => r._id === existingId);
      if (idx < 0) throw new Error('Report not found.');
      mem.reports[idx] = Object.assign({}, mem.reports[idx], doc, { _id: existingId, updatedAt: now });
      return outDoc(mem.reports[idx]);
    }
    const prev = await c.findOne({ _id: String(existingId) });
    if (!prev) throw new Error('Report not found.');
    const merged = Object.assign({}, doc, {
      createdBy: prev.createdBy || null, createdAt: prev.createdAt || now, updatedAt: now,
    });
    await c.updateOne({ _id: String(existingId) }, { $set: merged });
    return outDoc(Object.assign({ _id: String(existingId) }, prev, merged));
  }
  const _id = genId('rpt');
  const rec = Object.assign({ _id }, doc, { createdBy: i.createdBy || null, createdAt: now, updatedAt: now });
  if (!c) { mem.reports.unshift(rec); return outDoc(rec); }
  await c.insertOne(rec);
  return outDoc(rec);
}

async function setStatus(id, status) {
  if (STATUSES.indexOf(String(status)) < 0) throw new Error('Invalid status.');
  const now = Date.now();
  const c = await col();
  if (!c) {
    const r = mem.reports.find((x) => x._id === id);
    if (!r) throw new Error('Report not found.');
    r.status = String(status); r.updatedAt = now;
    return outDoc(r);
  }
  const r = await c.findOne({ _id: String(id) });
  if (!r) throw new Error('Report not found.');
  await c.updateOne({ _id: String(id) }, { $set: { status: String(status), updatedAt: now } });
  return outDoc(Object.assign({}, r, { status: String(status), updatedAt: now }));
}

async function deleteReport(id) {
  const c = await col();
  if (!c) { mem.reports = mem.reports.filter((r) => r._id !== id); return { ok: true }; }
  await c.deleteOne({ _id: String(id) });
  return { ok: true };
}

// Most recent report strictly BEFORE the given (date, shift) — used to carry forward
// still-relevant rows (critical-area patients, pressure-sore & phlebitis registers)
// into a new shift so the supervisor edits instead of re-typing.
async function getPreviousReport(date, shift) {
  const list = await getReports({ limit: 2000 });
  const key = (r) => r.date + '#' + String(SHIFT_ORD[r.shift] || 0);
  const cur = s(date, 20) + '#' + String(SHIFT_ORD[s(shift)] || 0);
  const before = list.filter((r) => key(r) < cur).sort(byRecent);
  return before[0] || null;
}

// UHID autofill: look across saved reports for a row that carries this UHID and return
// its identifying fields. (Per-patient records are not stored elsewhere in the DB, so
// prior shift entries are the practical source; degrades to null when unmatched.)
async function lookupByUhid(uhid) {
  const needle = s(uhid, 40).trim();
  if (!needle) return null;
  const list = await getReports({ limit: 500 });
  const sections = ['newAdmissions', 'criticalArea', 'lama', 'discharged', 'interventional', 'radiological'];
  for (const rep of list) {
    for (const sec of sections) {
      for (const row of arr(rep[sec])) {
        if (String(row.uhid || '').trim() === needle) {
          return {
            name: row.name || '', age: row.age || '', dept: row.dept || row.deptBed || '',
            consultant: row.consultant || '', diagnosis: row.diagnosis || '',
          };
        }
      }
    }
  }
  return null;
}

/* ---------------- route registration ---------------- */
function mount(app, opts) {
  const guard = (opts && opts.requireApi) || function (req, res, next) { next(); };
  const who = (req) => (req.user && (req.user.name || req.user.sub)) || 'local';
  const adminOnly = (req, res, next) => {
    if (req.user && req.user.role && req.user.role !== 'Administrator') return res.status(403).json({ ok: false, error: 'Administrator access required.' });
    next();
  };

  app.get('/api/supervisor-reports', guard, async (req, res) => {
    try { res.json({ ok: true, reports: await getReports(req.query) }); }
    catch (e) { res.status(500).json({ ok: false, error: String(e.message || e) }); }
  });
  app.get('/api/supervisor-reports/previous', guard, async (req, res) => {
    try { res.json({ ok: true, report: await getPreviousReport(req.query.date, req.query.shift) }); }
    catch (e) { res.status(500).json({ ok: false, error: String(e.message || e) }); }
  });
  app.get('/api/supervisor-reports/lookup', guard, async (req, res) => {
    try { res.json({ ok: true, patient: await lookupByUhid(req.query.uhid) }); }
    catch (e) { res.status(500).json({ ok: false, error: String(e.message || e) }); }
  });
  app.get('/api/supervisor-reports/:id', guard, async (req, res) => {
    try {
      const r = await getReportById(req.params.id);
      if (!r) return res.status(404).json({ ok: false, error: 'Report not found.' });
      res.json({ ok: true, report: r });
    } catch (e) { res.status(500).json({ ok: false, error: String(e.message || e) }); }
  });
  app.post('/api/supervisor-reports', guard, async (req, res) => {
    try {
      const body = Object.assign({}, req.body || {});
      if (!body.id && !body._id) body.createdBy = who(req);
      res.json({ ok: true, report: await saveReport(body) });
    } catch (e) { res.status(400).json({ ok: false, error: String(e.message || e) }); }
  });
  app.post('/api/supervisor-reports/:id/status', guard, async (req, res) => {
    try { res.json({ ok: true, report: await setStatus(req.params.id, (req.body || {}).status) }); }
    catch (e) { res.status(400).json({ ok: false, error: String(e.message || e) }); }
  });
  app.delete('/api/supervisor-reports/:id', guard, adminOnly, async (req, res) => {
    try { res.json(await deleteReport(req.params.id)); }
    catch (e) { res.status(400).json({ ok: false, error: String(e.message || e) }); }
  });
}

module.exports = {
  mount, getReports, getReportById, saveReport, setStatus, deleteReport,
  getPreviousReport, lookupByUhid,
};
