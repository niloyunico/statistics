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

// A field the payload does not carry keeps its stored value. (The PUT route used to call
// this WITHOUT the stored document, so every fallback below was dead: a save that did not
// send `note` or `status` wiped the note and moved a submitted roster back to draft.)
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined;

function normRoster(input, existing) {
  const i = obj(input), prev = obj(existing);
  const year = parseInt(i.year, 10) || prev.year || new Date().getFullYear();
  const month = Number.isInteger(parseInt(i.month, 10)) ? parseInt(i.month, 10) : (prev.month != null ? prev.month : new Date().getMonth());
  return {
    dept: s(i.dept || prev.dept, 40),
    deptName: s(i.deptName || prev.deptName, 120),
    year, month,
    grid: has(i, 'grid') ? normGrid(i.grid) : (prev.grid || {}),
    order: Array.isArray(i.order) ? i.order.map((x) => s(x, 40)).slice(0, 400) : (prev.order || []),
    // empId -> display name, denormalised onto the sheet ON PURPOSE. A published
    // roster is read by people who are not allowed the staff register (a data
    // collector's scope returns no staff records at all), and a grid of bare employee
    // ids is not a roster anyone can read. Bounded like every other field here.
    // MERGED over the stored names: a nurse transferred or archived since still has
    // her cells on the sheet, and must keep her name there.
    names: (function () {
      const src = obj(i.names), out = Object.assign({}, obj(prev.names));
      Object.keys(src).slice(0, 400).forEach((k) => { const v = s(src[k], 120); if (v) out[s(k, 40)] = v; });
      return out;
    }()),
    rules: has(i, 'rules') ? obj(i.rules) : obj(prev.rules),
    status: STATUSES.indexOf(s(i.status)) >= 0 ? s(i.status) : (prev.status || 'draft'),
    preparedBy: has(i, 'preparedBy') ? s(i.preparedBy, 120) : s(prev.preparedBy, 120),
    checkedBy: has(i, 'checkedBy') ? s(i.checkedBy, 120) : s(prev.checkedBy, 120),
    // The approver is stamped by the approve ROUTE, never by a save; without this
    // fallback the very next "Save draft" $set the field to '' and the published sheet
    // lost the name of the person who signed it.
    approvedBy: s(i.approvedBy, 120) || s(prev.approvedBy, 120),
    note: has(i, 'note') ? s(i.note, 1000) : s(prev.note, 1000),
  };
}

// Which units' rosters this request may touch. The account's OWN roster assignment
// (rosterScope / rosterDepartments on the users row) decides — see rosterDeptNames()
// in server/access.js, which also holds the fallback for accounts assigned none yet.
// Rosters are keyed on the department string, matched with the same vocabulary as
// staff scoping, so "Level 10", "Level-10" and "IPD Cabin Level 10" are one unit.
async function deptMatcher(req) {
  const a = req.access;
  if (!a || a.unrestricted) return () => true;
  const acc = require('./access');
  const keys = await acc.rosterDeptNames(a);
  return (dept) => acc.rosterVisible(keys, dept);
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
  // Writing is a THIRD right, between the two above. A console account reaches it through
  // the `roster` module permission (the default `guard`); a ward in-charge reaches it only
  // when an administrator granted `rosterEdit`, and web.js passes a guard that admits both.
  // Approving is NOT part of it -- see the status route.
  const writeGuard = (opts && opts.requireWrite) || guard;
  const isCollector = (req) => !!(req.access && require('./access').PORTAL_ROLES.indexOf(req.access.role) >= 0);
  /* A portal account sees PUBLISHED sheets only -- unless it is the in-charge who builds
     them. Granting `rosterEdit` without this made the editor useless: the moment a draft
     was saved it vanished from its own author's screen, because every unapproved sheet was
     filtered out of both the index and the month read.

     READ THIS BEFORE REUSING THE IDEA ELSEWHERE. "Unapproved" is no longer a synonym for
     "invisible to a portal account": it is invisible to every portal account EXCEPT a
     rosterEdit holder, and then only for the units deptMatcher already allows them --
     this exemption widens WHICH STATUSES they see, never which units. It is scoped to
     this module's own sheets and must not be generalised to other portal data. */
  const mayEdit = (req) => require('./access').portalMayEditRoster(req.access);
  const publishedOnly = (req, docs) => ((isCollector(req) && !mayEdit(req)) ? (docs || []).filter((d) => d && d.status === 'approved') : docs);
  /* Who may publish a roster, and therefore who may review every unit's access.
     NOT the Administrator role: the tier that signs a roster off is a nursing one
     (the Chief of Nursing Services), so it is the top Duty Roster action that decides.
     Defined once here because the scope route was still answering `unrestricted` while
     the status route had already moved to this rule -- the screen and the API disagreed
     about whether the Publish button would work. */
  const mayApprove = (req) => !!(req.access && (req.access.unrestricted || require('./access').can(req.access, 'roster', 'delete')));
  const adminOnly = (req, res, next) => {
    if (req.access && !req.access.unrestricted) return res.status(403).json({ ok: false, error: 'Administrator access required.' });
    next();
  };

  // The index: every roster, WITHOUT its grid. The list screen shows a dozen months
  // across seventeen units; shipping every grid with it would be megabytes for nothing.
  app.get('/api/rosters', readGuard, async (req, res) => {
    try {
      const allowed = await deptMatcher(req);
      res.json({ ok: true, rosters: publishedOnly(req, (await listAll()).filter((d) => d && allowed(d.dept))) });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not load rosters.' }); }
  });

  /* What this account may do in the module, and in which units.
     The renderer cannot work this out for itself: the unit a roster is filed under is
     the free text typed on a staff record (`current_department`), and deciding which of
     those strings falls inside an assignment needs the alias table, the Level-N rule and
     the department map — all of which live on the server and must stay there, or the two
     gates drift apart. So the server answers with the literal unit strings, and the
     renderer only has to compare them. */
  app.get('/api/rosters/scope', readGuard, async (req, res) => {
    try {
      const acc = require('./access');
      const a = req.access || null;
      const allowed = await deptMatcher(req);
      // Every unit the register knows, plus any unit that already has a sheet — a ward
      // whose staff have all been archived must not lose access to its own past rosters.
      const names = new Set();
      try {
        (await require('./staff-roster').loadRoster({ cached: true }))
          .forEach((p) => { if (p && p.is_active !== false && !p.former) names.add(s(p.current_department || 'Unassigned', 120)); });
      } catch (e) { /* register unreadable -> fall back to the rosters' own departments */ }
      (await listAll()).forEach((d) => { if (d && d.dept) names.add(d.dept); });
      const units = [...names].filter((n) => n && allowed(n)).sort((x, y) => x.localeCompare(y));
      const may = (act) => !a || a.unrestricted || acc.can(a, 'roster', act);
      res.json({
        ok: true,
        scope: (a && !a.unrestricted && a.rosterScope) || 'all',
        units,
        // Collectors and in-charges only ever receive APPROVED sheets (publishedOnly),
        // so the renderer must not offer them an editor for a unit they can only read.
        // A ward in-charge granted `rosterEdit` may build and submit their own unit's
        // sheet, but never approve or delete one -- publishing stays with an administrator.
        can: (function () {
          const pe = acc.portalMayEditRoster(a);
          const console_ = !isCollector(req);
          return {
            view: may('view'),
            edit: pe || (console_ && may('edit')),
            add: pe || (console_ && may('add')),
            delete: console_ && may('delete'),
            submit: pe || (console_ && may('edit')),
            approve: mayApprove(req),
            // The oversight view below is the same right as publishing.
            review: mayApprove(req),
          };
        }()),
      });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not load your roster access.' }); }
  });

  /* The oversight view: every unit, who may roster it, and whether it actually has a
     sheet this month. Same right as publishing (mayApprove) — the person accountable
     for the rosters being done is the person who should see where they are not.

     WHY IT IS A SERVER ROUTE AND NOT A CLIENT JOIN
     The renderer could in principle read /api/users and join it itself, but that needs
     the `users` module permission — so a Chief of Nursing Services with full Duty Roster
     access and no Administration rights could not have seen it. Shaping it here keeps the
     account list out of the browser: only a name, the granted actions and the units come
     back, never an email, a password hash or any other module's permissions.

     Rows are the CANONICAL departments, because that is what an assignment is made of.
     Sheets are filed under the free text typed on a staff record, so they are matched onto
     those rows with the same vocabulary the access check uses (rosterVisible) — which is
     also how a unit spelled four ways in the register still reviews as one row. */
  app.get('/api/rosters/access', readGuard, async (req, res) => {
    if (!mayApprove(req)) return res.status(403).json({ ok: false, error: 'Full Duty Roster access is needed to review every unit.' });
    try {
      const acc = require('./access');
      const deptmap = require('./deptmap');
      const map = await deptmap.get().catch(() => null);
      const byId = (map && map.byId) || {};
      const depts = Object.keys(byId).filter((id) => !byId[id].qualityOnly).map((id) => ({ id, name: byId[id].name || id }));

      // Only the fields this view shows. A projection, not a filter applied afterwards:
      // password hashes must never be read into the process in the first place.
      let accounts = [];
      try {
        const users = await require('./db').getUsers();
        accounts = await users.find({}, { projection: { username: 1, name: 1, role: 1, active: 1, perms: 1, rosterScope: 1, rosterDepartments: 1, staffScope: 1, departments: 1 } }).toArray();
      } catch (e) { accounts = []; }

      const actionsOf = (u) => {
        if (u.role === 'Administrator') return ['view', 'edit', 'add', 'delete'];
        const a = { unrestricted: false, role: u.role || 'User', perms: u.perms || {} };
        return acc.ACTIONS.filter((act) => acc.can(a, 'roster', act));
      };
      // Everyone who can open the module at all, with the units they hold resolved the
      // same way the guard resolves them (so an unassigned legacy account shows the reach
      // it actually has, not an empty list that would read as "no access").
      const people = [];
      for (const u of accounts) {
        if (u.active === false) continue;
        const acts = actionsOf(u);
        if (!acts.length) continue;
        const a = {
          unrestricted: u.role === 'Administrator', role: u.role || 'User', perms: u.perms || {},
          departments: u.departments || [], qualityAreas: [], staffScope: u.staffScope || 'all',
          rosterScope: u.rosterScope || null, rosterDepartments: u.rosterDepartments || [],
        };
        const keys = await acc.rosterDeptNames(a);
        people.push({
          username: u.username, name: u.name || u.username, role: u.role || 'User',
          actions: acts,
          // null = every unit. Kept distinct from [] (assigned none) on purpose.
          scope: keys === null ? 'all' : 'departments',
          covers: keys === null ? null : depts.filter((d) => acc.rosterVisible(keys, d.id) || acc.rosterVisible(keys, d.name)).map((d) => d.id),
          // An account that predates the field is reaching units nobody chose for it.
          inherited: !u.rosterScope && u.role !== 'Administrator',
        });
      }

      const sheets = await listAll();
      const now = new Date();
      const curY = now.getFullYear(), curM = now.getMonth();
      const rows = depts.map((d) => {
        const keys = new Set([acc.deptsOfStaff({ current_department: d.id }), acc.deptsOfStaff({ current_department: d.name })].flat());
        const mine = sheets.filter((r) => r && acc.deptsOfStaff({ current_department: r.dept }).some((k) => keys.has(k)));
        const thisMonth = mine.find((r) => r.year === curY && r.month === curM) || null;
        const holders = people.filter((p) => p.covers === null || p.covers.indexOf(d.id) >= 0);
        return {
          id: d.id, name: d.name,
          holders: holders.map((p) => ({ username: p.username, name: p.name, actions: p.actions, scope: p.scope, inherited: p.inherited })),
          editors: holders.filter((p) => p.actions.indexOf('edit') >= 0 || p.actions.indexOf('add') >= 0).length,
          sheets: mine.length,
          current: thisMonth ? { status: thisMonth.status || 'draft', revision: thisMonth.revision || 1, updatedAt: thisMonth.updatedAt || null, updatedBy: thisMonth.updatedBy || null } : null,
        };
      }).sort((a, b) => a.name.localeCompare(b.name));

      /* Sheets filed under a unit no canonical department matches. Not a cosmetic detail:
         a roster here is invisible to every department-scoped account, so it can only be
         opened by someone holding every unit — worth naming rather than silently dropping. */
      const matched = new Set();
      rows.forEach((r) => { const keys = new Set([acc.deptsOfStaff({ current_department: r.id }), acc.deptsOfStaff({ current_department: r.name })].flat());
        sheets.forEach((sh) => { if (sh && acc.deptsOfStaff({ current_department: sh.dept }).some((k) => keys.has(k))) matched.add(sh.id); }); });
      const orphans = sheets.filter((sh) => sh && !matched.has(sh.id))
        .map((sh) => ({ id: sh.id, dept: sh.dept, year: sh.year, month: sh.month, status: sh.status || 'draft' }));

      res.json({ ok: true, year: curY, month: curM, departments: rows, people, orphans });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not load the roster access review.' }); }
  });

  /* The people on the sheet, for an account that holds the roster but NOT the staff
     register. Without this the grid came up empty for exactly the person meant to fill
     it in — the unit list is built from staff records, and /api/staff refuses an account
     with no 'staff' permission.

     A deliberately thin record: the roster needs a name, a number and a designation, and
     nothing else about a colleague. Same principle as portalStaff() in access.js — phone,
     national ID, salary, address and remarks never leave the server through this route,
     and must not be added here without that decision being taken again. */
  const ROSTER_STAFF_FIELDS = ['id', 'emp_id', 'name', 'designation', 'current_department', 'role', 'is_active', 'former'];
  app.get('/api/rosters/staff', readGuard, async (req, res) => {
    try {
      const allowed = await deptMatcher(req);
      const all = await require('./staff-roster').loadRoster({ cached: true });
      const out = (all || []).filter((p) => p && p.is_active !== false && !p.former && allowed(p.current_department || 'Unassigned'))
        .map((p) => { const o = {}; ROSTER_STAFF_FIELDS.forEach((k) => { if (p[k] !== undefined) o[k] = p[k]; }); return o; });
      res.json({ ok: true, staff: out });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not load the unit staff.' }); }
  });

  // One month, with the grid.
  app.get('/api/rosters/:dept/:year/:month', readGuard, async (req, res) => {
    try {
      if (!(await deptMatcher(req))(req.params.dept)) return res.status(403).json({ ok: false, error: 'This roster belongs to a unit outside your departments.' });
      const id = rosterId(req.params.dept, parseInt(req.params.year, 10), parseInt(req.params.month, 10));
      const doc = await getOne(id);
      res.json({ ok: true, roster: publishedOnly(req, doc ? [doc] : [])[0] || null });   // null when never drafted (or not published, to a collector)
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not load the roster.' }); }
  });

  app.put('/api/rosters', writeGuard, async (req, res) => {
    try {
      const b = obj(req.body);
      if (!s(b.dept)) return res.status(400).json({ ok: false, error: 'A department is required.' });
      if (!(await deptMatcher(req))(b.dept)) return res.status(403).json({ ok: false, error: 'This roster belongs to a unit outside your departments.' });
      const head = normRoster(b);
      const id = rosterId(head.dept, head.year, head.month);
      const c = await col();
      const existing = c ? outDoc(await c.findOne({ _id: id })) : mem.find((x) => x.id === id);
      // An approved roster is the published, signed sheet. NO save may overwrite it or
      // move it back to draft — the old check let any save labelled "draft" through, so
      // a pending autosave un-published a roster seconds after it was approved.
      // Reopening is the admin-only status route.
      if (existing && existing.status === 'approved') {
        return res.status(409).json({ ok: false, locked: true, error: 'This roster is approved and locked. Reopen it before editing.' });
      }
      // Lost-update guard. The grid is saved whole, so a browser that edited an older
      // revision would erase every cell somebody else saved since. It says which
      // revision it edited; a mismatch is refused instead of overwriting.
      const current = (existing && existing.revision) || 0;
      if (b.baseRevision != null && Number(b.baseRevision) !== current) {
        return res.status(409).json({ ok: false, conflict: true, revision: current,
          error: 'Someone else saved this roster since you opened it. Reload the month to see their changes, then make yours again.' });
      }
      const doc = normRoster(b, existing);
      // Approval only ever happens through the status route, which stamps who signed.
      if (doc.status === 'approved') doc.status = (existing && existing.status) || 'draft';
      doc.revision = current + 1;
      doc.updatedAt = Date.now();
      doc.updatedBy = who(req);
      const raced = () => res.status(409).json({ ok: false, conflict: true,
        error: 'Someone else saved this roster at the same moment. Reload the month and try again.' });
      if (c) {
        if (existing) {
          // Conditional on the revision just checked, so two saves can never interleave.
          const r = await c.updateOne({ _id: id, revision: existing.revision == null ? null : existing.revision, status: { $ne: 'approved' } }, { $set: doc });
          if (!r.matchedCount) return raced();
        } else {
          doc.createdAt = Date.now(); doc.createdBy = who(req);
          try { await c.insertOne(Object.assign({ _id: id }, doc)); }
          catch (e) { if (e && e.code === 11000) return raced(); throw e; }
        }
      } else {
        if (!existing) { doc.createdAt = Date.now(); doc.createdBy = who(req); }
        const idx = mem.findIndex((x) => x.id === id);
        if (idx >= 0) mem[idx] = Object.assign({ id }, doc); else mem.push(Object.assign({ id }, doc));
      }
      res.json({ ok: true, roster: await getOne(id) });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not save the roster.' }); }
  });

  // Approve / reopen. Approval is the moment the sheet becomes the published roster,
  // so it is admin-only and stamps who signed it.
  app.post('/api/rosters/:id/status', writeGuard, async (req, res) => {
    try {
      const id = s(req.params.id, 80);
      const status = s((obj(req.body)).status);
      if (STATUSES.indexOf(status) < 0) return res.status(400).json({ ok: false, error: 'Unknown status.' });
      // APPROVING is the moment the sheet becomes the published roster, and REOPENING
      // unpublishes one people may already be working to. Both need FULL control of the
      // roster module ('delete' -- the top action), not the Administrator role: the tier
      // that signs a roster off is a nursing one, and gating on the backend role locked the
      // Chief of Nursing Services out of the approval she is accountable for. Everyone else
      // who may write a roster may still move it exactly one step: hand it in.
      if (!mayApprove(req)) {
        if (status !== 'submitted') return res.status(403).json({ ok: false, error: 'You can submit this roster for approval. Approving and reopening need full Duty Roster access.' });
        const cur = await getOne(id);
        if (!cur) return res.status(404).json({ ok: false, error: 'Roster not found.' });
        if (!(await deptMatcher(req))(cur.dept)) return res.status(403).json({ ok: false, error: 'This roster belongs to a unit outside your departments.' });
        if (cur.status === 'approved') return res.status(409).json({ ok: false, locked: true, error: 'This roster is approved and locked. Ask someone with full Duty Roster access to reopen it.' });
      }
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
