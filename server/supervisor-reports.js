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
 * STORE: Cloudflare D1 when it is configured and `supervisor` is in D1_MODULES
 * (see d1-store.js). These reports are a large, steadily growing, self-contained
 * set that nothing else joins against, and the module is not on a hot path — so
 * it is the second-best candidate after the activity log for taking storage and
 * write load off the Atlas free tier. The free-form section rows and custom_*
 * sections live in a JSON `doc` column; only the fields actually filtered and
 * sorted on (date / shift / status) are real columns.
 *
 * Never both stores at once: whichever backend is selected is the ONLY one
 * written, so the copies cannot drift. A D1 failure is surfaced to the caller as
 * a normal error — it is deliberately NOT retried against Mongo, because a
 * silent fallback write is exactly what would create a divergence.
 *
 * Collection: `supervisorReports`. Self-contained via db.getDbHandle(); web.js calls
 * mount() once. Falls back to an in-memory array when no MONGODB_URI (dev only).
 */
const { getDbHandle } = require('./db');
const d1 = require('./d1');
const d1store = require('./d1-store');

const COLL = 'supervisorReports';
const D1_MOD = 'supervisor';
const d1On = () => d1store.enabled(D1_MOD);
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

/* ---- D1 row <-> report document ----
   The scalar COLUMNS are authoritative on read (setStatus only touches the
   column), so a doc/column mismatch can never change what the user sees. */
const D1_COLS = 'id, date, shift, status, supervisor_name, created_by, created_at, updated_at, doc';
function rowToDoc(r) {
  if (!r) return null;
  const doc = d1store.parseJson(r.doc, {}) || {};
  return Object.assign({}, doc, {
    id: r.id,
    date: r.date,
    shift: r.shift,
    status: r.status,
    supervisorName: r.supervisor_name || doc.supervisorName || '',
    createdBy: r.created_by == null ? null : r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
}

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
  if (d1On()) {
    const where = [], params = [];
    if (filter.date) { where.push('date = ?'); params.push(filter.date); }
    if (filter.shift) { where.push('shift = ?'); params.push(filter.shift); }
    if (filter.status) { where.push('status = ?'); params.push(filter.status); }
    params.push(limit);
    const sql = 'SELECT ' + D1_COLS + ' FROM supervisor_reports'
      + (where.length ? ' WHERE ' + where.join(' AND ') : '')
      + ' ORDER BY date DESC, updated_at DESC LIMIT ?';
    const rows = await d1store.withSchema(() => d1.query(sql, params));
    return rows.map(rowToDoc);
  }
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
  if (d1On()) {
    const r = await d1store.withSchema(() => d1.get('SELECT ' + D1_COLS + ' FROM supervisor_reports WHERE id = ?', [String(id)]));
    return rowToDoc(r);
  }
  const c = await col();
  if (!c) return outDoc(mem.reports.find((r) => r._id === id));
  return outDoc(await c.findOne({ _id: String(id) }));
}

async function saveReport(input) {
  const i = obj(input);
  const now = Date.now();
  const doc = normReport(i);
  // Update in place when an id is supplied; else create.
  const existingId = i.id || i._id;
  if (d1On()) {
    if (existingId) {
      const prev = await d1store.withSchema(() => d1.get('SELECT ' + D1_COLS + ' FROM supervisor_reports WHERE id = ?', [String(existingId)]));
      if (!prev) throw new Error('Report not found.');
      // Merge OVER the stored doc rather than replacing it, to match Mongo's $set
      // semantics: custom_* sections absent from THIS payload are kept, not dropped.
      const merged = Object.assign({}, d1store.parseJson(prev.doc, {}) || {}, doc);
      const createdBy = prev.created_by == null ? null : prev.created_by;
      const createdAt = prev.created_at || now;
      await d1.run(
        'UPDATE supervisor_reports SET date = ?, shift = ?, status = ?, supervisor_name = ?, created_by = ?, created_at = ?, updated_at = ?, doc = ? WHERE id = ?',
        [merged.date, merged.shift, merged.status, merged.supervisorName, createdBy, createdAt, now, JSON.stringify(merged), String(existingId)]);
      return rowToDoc({ id: String(existingId), date: merged.date, shift: merged.shift, status: merged.status,
        supervisor_name: merged.supervisorName, created_by: createdBy, created_at: createdAt, updated_at: now,
        doc: JSON.stringify(merged) });
    }
    const newId = genId('rpt');
    const createdBy = i.createdBy || null;
    await d1store.withSchema(() => d1.run(
      'INSERT INTO supervisor_reports (id, date, shift, status, supervisor_name, created_by, created_at, updated_at, doc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [newId, doc.date, doc.shift, doc.status, doc.supervisorName, createdBy, now, now, JSON.stringify(doc)]));
    return rowToDoc({ id: newId, date: doc.date, shift: doc.shift, status: doc.status,
      supervisor_name: doc.supervisorName, created_by: createdBy, created_at: now, updated_at: now,
      doc: JSON.stringify(doc) });
  }
  const c = await col();
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
  if (d1On()) {
    const prev = await d1store.withSchema(() => d1.get('SELECT ' + D1_COLS + ' FROM supervisor_reports WHERE id = ?', [String(id)]));
    if (!prev) throw new Error('Report not found.');
    await d1.run('UPDATE supervisor_reports SET status = ?, updated_at = ? WHERE id = ?', [String(status), now, String(id)]);
    return rowToDoc(Object.assign({}, prev, { status: String(status), updated_at: now }));
  }
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
  if (d1On()) {
    await d1store.withSchema(() => d1.run('DELETE FROM supervisor_reports WHERE id = ?', [String(id)]));
    return { ok: true };
  }
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
  let list;
  if (d1On() && !/[%_]/.test(needle)) {
    // Let SQLite discard the reports that cannot contain this UHID, so only real
    // candidates cross the wire. `%` / `_` are LIKE wildcards — a needle carrying
    // one falls through to the unfiltered scan rather than over-matching.
    const rows = await d1store.withSchema(() => d1.query(
      'SELECT ' + D1_COLS + ' FROM supervisor_reports WHERE doc LIKE ? ORDER BY date DESC, updated_at DESC LIMIT 500',
      ['%' + needle + '%']));
    list = rows.map(rowToDoc);
  } else {
    list = await getReports({ limit: 500 });
  }
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
  // Prefer the RESOLVED authority (req.access, read from the live user document by
  // server/access.js) over req.user.role, which is only a claim inside the token — a
  // snapshot of who the caller was when they signed in, not who they are now.
  const adminOnly = (req, res, next) => {
    if (req.access) {
      if (req.access.unrestricted) return next();
      return res.status(403).json({ ok: false, error: 'Administrator access required.' });
    }
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
