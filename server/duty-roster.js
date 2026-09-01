/* UNICO — Duty Roster module (the "Duty Roster For …" sheet, digitised).
 *
 * ONE document per (department, year, month) in `dutyRosters`. The document holds the
 * whole month's grid as { empId: { "1": "M3", "2": "OFF", … } }, the staff order shown
 * on the sheet, the per-unit rule settings, the sign-off block and a status.
 *
 * WHY THE WHOLE MONTH IS ONE DOCUMENT
 * A roster is published, printed and signed as one sheet — it is never half-approved.
 * Keeping it as a single document means a save is atomic (nobody can read a roster
 * that is half this week and half last), and the printed sheet always corresponds to
 * exactly one stored record.
 *
 * status: draft -> submitted -> approved. Approving locks the grid; the module keeps
 * `revision` and the sign-off names so a printed copy can be traced to a stored one.
 *
 * Shift codes are NOT validated against a list here on purpose: the legend lives in
 * renderer/unico/roster-spec.js and units do occasionally add a local code. The server
 * bounds the size and shape of what it stores; the renderer owns what the codes mean.
 */
const { getDbHandle } = require('./db');

const COLL = 'dutyRosters';
const STATUSES = ['draft', 'submitted', 'approved'];

async function col() { const db = await getDbHandle(); return db ? db.collection(COLL) : null; }
const mem = [];

const s = (v, max) => String(v == null ? '' : v).slice(0, max || 200);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const outDoc = (d) => { if (!d) return null; const { _id, ...r } = d; return { id: _id, ...r }; };
const who = (req) => (req.user && (req.user.name || req.user.sub)) || 'local';

const rosterId = (dept, year, month) => 'ros-' + s(dept, 40) + '-' + year + '-' + String(month).padStart(2, '0');

// { empId: { day: code } } — bounded on every axis so a malformed payload cannot bloat
// the document: 400 people, 31 days, short codes.
function normGrid(input) {
  const g = obj(input), out = {};
  Object.keys(g).slice(0, 400).forEach((emp) => {
    const row = obj(g[emp]), keep = {};
    Object.keys(row).forEach((d) => {
      const day = parseInt(d, 10);
      if (!(day >= 1 && day <= 31)) return;
      const code = s(row[d], 8).trim().toUpperCase();
      if (code) keep[day] = code;
    });
    if (Object.keys(keep).length) out[s(emp, 40)] = keep;
  });
  return out;
}

function normRoster(input, existing) {
  const i = obj(input), prev = obj(existing);
  const year = parseInt(i.year, 10) || prev.year || new Date().getFullYear();
  const month = Number.isInteger(parseInt(i.month, 10)) ? parseInt(i.month, 10) : (prev.month != null ? prev.month : new Date().getMonth());
  return {
    dept: s(i.dept || prev.dept, 40),
    deptName: s(i.deptName || prev.deptName, 120),
    year, month,
    grid: normGrid(i.grid),
    order: Array.isArray(i.order) ? i.order.map((x) => s(x, 40)).slice(0, 400) : (prev.order || []),
    // empId -> display name, denormalised onto the sheet ON PURPOSE. A published
    // roster is read by people who are not allowed the staff register (a data
    // collector's scope returns no staff records at all), and a grid of bare employee
    // ids is not a roster anyone can read. Bounded like every other field here.
    names: (function () {
      const src = obj(i.names), out = {};
      Object.keys(src).slice(0, 400).forEach((k) => { const v = s(src[k], 120); if (v) out[s(k, 40)] = v; });
      return Object.keys(out).length ? out : (prev.names || {});
    }()),
    rules: obj(i.rules),
    status: STATUSES.indexOf(s(i.status)) >= 0 ? s(i.status) : (prev.status || 'draft'),
    preparedBy: s(i.preparedBy, 120),
    checkedBy: s(i.checkedBy, 120),
    // Falls back to what is stored, like order/names/status above. The approver is
    // stamped by the approve ROUTE, never by a save; without this fallback the very
    // next "Save draft" $set the field to '' and the published sheet lost the name
    // of the person who signed it.
    approvedBy: s(i.approvedBy, 120) || s(prev.approvedBy, 120),
    note: s(i.note, 1000),
  };
}

async function listAll() {
  const c = await col();
  if (!c) return mem.slice();
  const docs = await c.find({}, { projection: { grid: 0 } }).sort({ year: -1, month: -1 }).toArray();
  return docs.map(outDoc);
}
async function getOne(id) {
  const c = await col();
  if (!c) return mem.find((x) => x.id === id) || null;
  return outDoc(await c.findOne({ _id: id }));
}

function mount(app, opts) {
  const guard = (opts && opts.requireApi) || function (req, res, next) { next(); };
  // Reading a PUBLISHED roster is not the same right as editing one. The two GET
  // routes below accept a wider guard so a data collector / nurse in-charge can see
  // the approved sheet for their own unit; `publishedOnly` then strips anything that
  // is still a draft, so an unapproved roster stays invisible to them. Every write
  // route keeps the full `guard`.
  const readGuard = (opts && opts.requireRead) || guard;
  const isCollector = (req) => !!(req.access && require('./access').PORTAL_ROLES.indexOf(req.access.role) >= 0);
  const publishedOnly = (req, docs) => (isCollector(req) ? (docs || []).filter((d) => d && d.status === 'approved') : docs);
  const adminOnly = (req, res, next) => {
    if (req.access && !req.access.unrestricted) return res.status(403).json({ ok: false, error: 'Administrator access required.' });
    next();
  };

  // The index: every roster, WITHOUT its grid. The list screen shows a dozen months
  // across seventeen units; shipping every grid with it would be megabytes for nothing.
  app.get('/api/rosters', readGuard, async (req, res) => {
    try { res.json({ ok: true, rosters: publishedOnly(req, await listAll()) }); }
    catch (e) { res.status(500).json({ ok: false, error: 'Could not load rosters.' }); }
  });

  // One month, with the grid.
  app.get('/api/rosters/:dept/:year/:month', readGuard, async (req, res) => {
    try {
      const id = rosterId(req.params.dept, parseInt(req.params.year, 10), parseInt(req.params.month, 10));
      const doc = await getOne(id);
      res.json({ ok: true, roster: publishedOnly(req, doc ? [doc] : [])[0] || null });   // null when never drafted (or not published, to a collector)
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not load the roster.' }); }
  });

  app.put('/api/rosters', guard, async (req, res) => {
    try {
      const b = obj(req.body);
      if (!s(b.dept)) return res.status(400).json({ ok: false, error: 'A department is required.' });
      const doc = normRoster(b);
      const id = rosterId(doc.dept, doc.year, doc.month);
      const c = await col();
      const existing = c ? outDoc(await c.findOne({ _id: id })) : mem.find((x) => x.id === id);
      if (existing && existing.status === 'approved' && doc.status !== 'draft') {
        return res.status(409).json({ ok: false, error: 'This roster is approved and locked. Reopen it before editing.' });
      }
      doc.revision = ((existing && existing.revision) || 0) + 1;
      doc.updatedAt = Date.now();
      doc.updatedBy = who(req);
      if (!existing) { doc.createdAt = Date.now(); doc.createdBy = who(req); }
      if (c) { await c.updateOne({ _id: id }, { $set: doc }, { upsert: true }); }
      else {
        const idx = mem.findIndex((x) => x.id === id);
        if (idx >= 0) mem[idx] = Object.assign({ id }, doc); else mem.push(Object.assign({ id }, doc));
      }
      res.json({ ok: true, roster: await getOne(id) });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not save the roster.' }); }
  });

  // Approve / reopen. Approval is the moment the sheet becomes the published roster,
  // so it is admin-only and stamps who signed it.
  app.post('/api/rosters/:id/status', guard, adminOnly, async (req, res) => {
    try {
      const id = s(req.params.id, 80);
      const status = s((obj(req.body)).status);
      if (STATUSES.indexOf(status) < 0) return res.status(400).json({ ok: false, error: 'Unknown status.' });
      const patch = { status, statusBy: who(req), statusAt: Date.now() };
      if (status === 'approved') { patch.approvedBy = s((obj(req.body)).approvedBy, 120) || who(req); patch.approvedAt = Date.now(); }
      const c = await col();
      if (c) { const r = await c.updateOne({ _id: id }, { $set: patch }); if (!r.matchedCount) return res.status(404).json({ ok: false, error: 'Roster not found.' }); }
      else { const x = mem.find((m) => m.id === id); if (!x) return res.status(404).json({ ok: false, error: 'Roster not found.' }); Object.assign(x, patch); }
      res.json({ ok: true, roster: await getOne(id) });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not change the status.' }); }
  });

  app.delete('/api/rosters/:id', guard, adminOnly, async (req, res) => {
    try {
      const id = s(req.params.id, 80);
      const c = await col();
      if (c) { const r = await c.deleteOne({ _id: id }); return res.json({ ok: r.deletedCount > 0 }); }
      const n = mem.length;
      const idx = mem.findIndex((x) => x.id === id);
      if (idx >= 0) mem.splice(idx, 1);
      res.json({ ok: n !== mem.length });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not delete the roster.' }); }
  });
}

module.exports = { mount, COLL, STATUSES, rosterId, normGrid };
