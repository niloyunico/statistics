/* UNICO — Staff requests (a nurse in-charge asking for a new nurse or PCA).
 *
 * A ward that is short-staffed does not get to create employees. It raises a REQUEST,
 * an administrator reviews it, and only then does anyone appear on the register. This
 * module is that request queue and nothing more: it never writes to `staff`.
 *
 * WHY IT IS A SEPARATE COLLECTION
 * A request is not a draft staff record. It has its own life — raised, sent back for
 * changes, approved or rejected, each with a reason — and it stays on file after the
 * person is hired so the unit can show what it asked for and when. Storing it inside
 * `staff` would mean a half-real employee sitting in the register, which is exactly
 * what the register must never contain.
 *
 * status: pending -> changes | approved | rejected
 *   pending    with the administrator
 *   changes    sent back; the requester may edit and re-submit (status returns to pending)
 *   approved   accepted; `staffEmpId` records who they became, if the admin filled it in
 *   rejected   declined, with a reason
 *
 * Scoping: a portal account sees and edits ONLY its own requests. Deciding one is
 * administrator-only. Both rules are enforced here, not in the renderer.
 */
const { getDbHandle } = require('./db');

const COLL = 'staffRequests';
const STATUSES = ['pending', 'changes', 'approved', 'rejected'];
const ROLES = ['Nurse', 'PCA'];

async function col() { const db = await getDbHandle(); return db ? db.collection(COLL) : null; }
const mem = [];

const s = (v, max) => String(v == null ? '' : v).slice(0, max || 200).trim();
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const outDoc = (d) => { if (!d) return null; const { _id, ...r } = d; return { id: _id, ...r }; };
const who = (req) => (req.user && (req.user.sub || req.user.name)) || 'local';
const whoName = (req) => (req.user && (req.user.name || req.user.sub)) || 'local';
const isAdmin = (req) => !!(req.access && req.access.unrestricted);

// A short, sortable, human-quotable reference: SR-0001. Generated from the current
// count rather than a random id so a ward can read it out over the phone.
async function nextRef() {
  const c = await col();
  const n = c ? await c.countDocuments({}) : mem.length;
  return 'SR-' + String(n + 1).padStart(4, '0');
}

function normRequest(input) {
  const i = obj(input);
  return {
    role: ROLES.indexOf(s(i.role)) >= 0 ? s(i.role) : 'Nurse',
    name: s(i.name, 120),
    designation: s(i.designation, 120),
    department: s(i.department, 120),
    joiningDate: s(i.joiningDate, 20),
    experience: s(i.experience, 60),
    qualification: s(i.qualification, 120),
    phone: s(i.phone, 40),
    hepB: s(i.hepB, 40),
    note: s(i.note, 1000),
  };
}

function mount(app, opts) {
  const guard = (opts && opts.requireApi) || function (req, res, next) { next(); };
  const scopeOf = (opts && opts.scopeOf) || (async () => null);

  const adminOnly = (req, res, next) => {
    if (!isAdmin(req)) return res.status(403).json({ ok: false, error: 'Administrator access required.' });
    next();
  };

  async function listFor(req) {
    const scope = await scopeOf(req);
    const c = await col();
    const all = c ? (await c.find({}).sort({ createdAt: -1 }).toArray()).map(outDoc) : mem.slice();
    // A portal account only ever sees what it raised itself. Filtering here rather
    // than in the query keeps the in-memory fallback honest too.
    if (!scope) return all;
    return all.filter((x) => x.createdBy === who(req));
  }

  app.get('/api/staff-requests', guard, async (req, res) => {
    try { res.json({ ok: true, requests: await listFor(req), roles: ROLES, statuses: STATUSES }); }
    catch (e) { res.status(500).json({ ok: false, error: 'Could not load staff requests.' }); }
  });

  app.post('/api/staff-requests', guard, async (req, res) => {
    try {
      const doc = normRequest(req.body);
      if (!doc.name) return res.status(400).json({ ok: false, error: 'A name is required.' });
      if (!doc.department) return res.status(400).json({ ok: false, error: 'A department is required.' });
      doc.ref = await nextRef();
      doc.status = 'pending';
      doc.createdAt = Date.now();
      doc.createdBy = who(req);
      doc.createdByName = whoName(req);
      const id = 'sr-' + doc.createdAt.toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
      const c = await col();
      if (c) await c.insertOne(Object.assign({ _id: id }, doc));
      else mem.unshift(Object.assign({ id }, doc));
      res.json({ ok: true, request: Object.assign({ id }, doc) });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not raise the request.' }); }
  });

  // Edit. A requester may only correct their OWN request, and only while it is theirs
  // to correct — pending, or sent back for changes. Re-submitting returns it to the
  // queue, because an edit the administrator never sees is not a resubmission.
  app.patch('/api/staff-requests/:id', guard, async (req, res) => {
    try {
      const id = s(req.params.id, 80);
      const c = await col();
      const cur = c ? outDoc(await c.findOne({ _id: id })) : mem.find((x) => x.id === id);
      if (!cur) return res.status(404).json({ ok: false, error: 'Request not found.' });
      if (!isAdmin(req)) {
        if (cur.createdBy !== who(req)) return res.status(403).json({ ok: false, error: 'That is not your request.' });
        if (cur.status !== 'pending' && cur.status !== 'changes') {
          return res.status(409).json({ ok: false, error: 'This request has already been decided.' });
        }
      }
      const patch = normRequest(Object.assign({}, cur, req.body));
      patch.updatedAt = Date.now();
      patch.updatedBy = who(req);
      if (!isAdmin(req) && cur.status === 'changes') { patch.status = 'pending'; patch.decidedAt = null; }
      if (c) await c.updateOne({ _id: id }, { $set: patch });
      else Object.assign(cur, patch);
      const after = c ? outDoc(await c.findOne({ _id: id })) : cur;
      res.json({ ok: true, request: after });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not save the request.' }); }
  });

  // Decide. Administrator only — this is the moment a ward's ask becomes a hiring
  // decision, and the reason is stored with it so the unit is told why.
  app.post('/api/staff-requests/:id/decide', guard, adminOnly, async (req, res) => {
    try {
      const id = s(req.params.id, 80);
      const b = obj(req.body);
      const status = s(b.status);
      if (['changes', 'approved', 'rejected'].indexOf(status) < 0) {
        return res.status(400).json({ ok: false, error: 'Unknown decision.' });
      }
      const reason = s(b.reason, 1000);
      if ((status === 'rejected' || status === 'changes') && !reason) {
        return res.status(400).json({ ok: false, error: 'Please say why, so the unit knows what to do next.' });
      }
      const patch = { status, reason, decidedAt: Date.now(), decidedBy: whoName(req) };
      if (status === 'approved') patch.staffEmpId = s(b.staffEmpId, 40);
      const c = await col();
      if (c) {
        const r = await c.updateOne({ _id: id }, { $set: patch });
        if (!r.matchedCount) return res.status(404).json({ ok: false, error: 'Request not found.' });
      } else {
        const x = mem.find((m) => m.id === id);
        if (!x) return res.status(404).json({ ok: false, error: 'Request not found.' });
        Object.assign(x, patch);
      }
      const after = c ? outDoc(await c.findOne({ _id: id })) : mem.find((m) => m.id === id);
      res.json({ ok: true, request: after });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not record the decision.' }); }
  });

  // Withdraw. Only your own, and only while nobody has acted on it.
  app.delete('/api/staff-requests/:id', guard, async (req, res) => {
    try {
      const id = s(req.params.id, 80);
      const c = await col();
      const cur = c ? outDoc(await c.findOne({ _id: id })) : mem.find((x) => x.id === id);
      if (!cur) return res.json({ ok: true });
      if (!isAdmin(req)) {
        if (cur.createdBy !== who(req)) return res.status(403).json({ ok: false, error: 'That is not your request.' });
        if (cur.status !== 'pending' && cur.status !== 'changes') {
          return res.status(409).json({ ok: false, error: 'This request has already been decided.' });
        }
      }
      if (c) await c.deleteOne({ _id: id });
      else { const i = mem.findIndex((x) => x.id === id); if (i >= 0) mem.splice(i, 1); }
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not withdraw the request.' }); }
  });
}

module.exports = { mount, COLL, STATUSES, ROLES, normRequest };
