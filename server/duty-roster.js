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
 * THE REVIEW CHAIN (rules in server/roster-workflow.js — read that first)
 *   draft -> pending_manager -> pending_cns -> approved, with `returned` from either
 *   review stage. Every hand-over appends to `history[]` on the sheet and snapshots the
 *   grid into `rosterVersions`, so a printed copy can be traced to a stored revision
 *   and an earlier version can be opened again. Legacy 'submitted' sheets are READ as
 *   pending_cns; nothing stored is rewritten.
 *
 * WHO SIGNS
 *   `rosterConfig` (one document) names the in-charge and manager of each canonical
 *   department and the one CNS. Those names are stamped on Prepared / Checked /
 *   Approved by the hand-over itself — a sheet never carries a name somebody typed.
 *
 * Shift codes are NOT validated against a list here on purpose: the legend lives in
 * renderer/unico/roster-spec.js and units do occasionally add a local code. The server
 * bounds the size and shape of what it stores; the renderer owns what the codes mean.
 */
const { getDbHandle } = require('./db');
const W = require('./roster-workflow');

const COLL = 'dutyRosters';
const VER_COLL = 'rosterVersions';
const CFG_COLL = 'rosterConfig';
// Every status the store may hold, legacy spelling included (the old STATUSES export).
const STATUSES = W.STATUSES.concat(Object.keys(W.LEGACY));

let indexed = false;
async function col() {
  const db = await getDbHandle(); if (!db) return null;
  const c = db.collection(COLL);
  if (!indexed) {
    indexed = true;
    c.createIndex({ year: 1, month: 1 }).catch(() => {});
    c.createIndex({ status: 1 }).catch(() => {});
    c.createIndex({ staffIds: 1, year: -1, month: -1 }).catch(() => {});
    db.collection(VER_COLL).createIndex({ rosterId: 1, revision: 1 }, { unique: true }).catch(() => {});
    db.collection(VER_COLL).createIndex({ rosterId: 1, at: -1 }).catch(() => {});
  }
  return c;
}
async function verCol() { const db = await getDbHandle(); return db ? db.collection(VER_COLL) : null; }
async function cfgCol() { const db = await getDbHandle(); return db ? db.collection(CFG_COLL) : null; }
// In-memory fallback when there is no database (the local seed preview and the tests).
const mem = [];
const memVersions = [];
let memCfg = { _id: 'config', cns: null, depts: {} };

const s = (v, max) => String(v == null ? '' : v).slice(0, max || 200);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
// Out of the store: the effective status (legacy 'submitted' read as pending_cns), with the
// stored spelling kept beside it so a conditional write can still match the row.
const outDoc = (d) => {
  if (!d) return null;
  const { _id, ...r } = d;
  const eff = W.effStatus(r);
  if (r.status && r.status !== eff) r.legacyStatus = r.status;
  r.status = eff;
  return { id: _id, ...r };
};
const memOut = (x) => { if (!x) return null; const { id, ...r } = x; return outDoc(Object.assign({ _id: id }, JSON.parse(JSON.stringify(r)))); };
const rawStatus = (d) => (d && (d.legacyStatus || d.status)) || 'draft';
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

/* Staff from another unit put on this sheet ("guests"): `both` = also on their home roster
   (floating / borrowed duty), `move` = on this roster only, for this month. Keyed like grid
   rows ('S' + staff id); bounded. */
function normGuests(v) {
  const src = obj(v), out = {};
  Object.keys(src).slice(0, 100).forEach((k) => {
    const key = s(k, 40); if (!/^S\S+$/.test(key)) return;
    const g = obj(src[k]);
    out[key] = { from: s(g.from, 120), mode: g.mode === 'move' ? 'move' : 'both', name: s(g.name, 120), desig: s(g.desig, 120), emp: s(g.emp, 40) };
  });
  return out;
}
/* What a cell can carry beside its code: an on-call mark on top of a shift, and the date an
   Alternative Leave stands in for (+ an optional reason). Each is kept only where the cell
   still holds a matching code, so changing a cell never leaves a stale mark behind. */
function cellExtras(doc, i, prev) {
  const src = (k) => obj(has(i, k) ? i[k] : prev[k]);
  const each = (m, fn) => Object.keys(m).slice(0, 400).forEach((emp) => {
    const row = obj(m[emp]);
    Object.keys(row).forEach((d) => { const day = parseInt(d, 10); if (day >= 1 && day <= 31) fn(s(emp, 40), day, row[d]); });
  });
  const oc = {}, al = {};
  // The mark rides on a duty shift only — on call on a day off is the OC code itself.
  // (Off / leave / OC codes as in renderer/unico/roster-spec.js.)
  const NOT_DUTY = ['OC', 'DO', 'OFF', 'AL', 'CL', 'EL', 'ML', 'FL', 'PH'];
  each(src('oncall'), (emp, day, v) => {
    const c = (doc.grid[emp] || {})[day];
    if (v && c && NOT_DUTY.indexOf(c) < 0) (oc[emp] || (oc[emp] = {}))[day] = 1;
  });
  each(src('altLeave'), (emp, day, v) => {
    if ((doc.grid[emp] || {})[day] !== 'AL') return;
    const x = obj(v), f = s(x.for, 10).trim(), note = s(x.note, 120).trim();
    const okDate = /^\d{4}-\d{2}-\d{2}$/.test(f) && !isNaN(Date.parse(f + 'T00:00:00Z'));
    if (!okDate && !note) return;
    (al[emp] || (al[emp] = {}))[day] = { for: okDate ? f : '', note };
  });
  doc.oncall = oc; doc.altLeave = al;
  return doc;
}
function normRoster(input, existing) {
  const i = obj(input), prev = obj(existing);
  const year = parseInt(i.year, 10) || prev.year || new Date().getFullYear();
  const month = Number.isInteger(parseInt(i.month, 10)) ? parseInt(i.month, 10) : (prev.month != null ? prev.month : new Date().getMonth());
  const editable = W.EDITABLE.indexOf(W.effStatus(prev)) >= 0 || !existing;
  return cellExtras({
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
    guests: has(i, 'guests') ? normGuests(i.guests) : normGuests(prev.guests),
    // Review marks are written only by POST /api/rosters/:id/marks — a save keeps the stored ones.
    marks: obj(prev.marks),
    // A SAVE never changes the status: every hand-over is a transition (applyTransition),
    // which is what stamps the names and writes the history. The stored spelling is kept
    // as-is so a legacy 'submitted' row is not silently rewritten by an autosave.
    status: existing ? rawStatus(prev) : 'draft',
    // Prepared / Checked / Approved are stamped by the hand-overs. The one payload field
    // still honoured is "Checked by" on a sheet nobody has sent yet (the old footer).
    preparedBy: s(prev.preparedBy, 120),
    checkedBy: (editable && has(i, 'checkedBy')) ? s(i.checkedBy, 120) : s(prev.checkedBy, 120),
    approvedBy: s(prev.approvedBy, 120),
    note: has(i, 'note') ? s(i.note, 1000) : s(prev.note, 1000),
  }, i, prev);
}

/* ------------------------------------------------------------- access helpers --- */

// Which units' rosters this request may touch. The account's OWN roster assignment
// (rosterScope / rosterDepartments on the users row) decides — see rosterDeptNames()
// in server/access.js, which also holds the fallback for accounts assigned none yet.
// Rosters are keyed on the department string, matched with the same vocabulary as
// staff scoping, so "Level 10", "Level-10" and "IPD Cabin Level 10" are one unit.
/* The units Duty Roster -> Setup names this account for: In-charge of / Manager of. */
async function rosterPlaceOf(req) {
  const me = String((req.access && req.access.username) || '').toLowerCase();
  const out = { incharge: new Set(), manager: new Set(), any: false };
  if (!me) return out;
  try {
    const cfg = await getConfig();
    Object.keys(cfg.depts || {}).forEach((k) => {
      const d = cfg.depts[k] || {};
      if (d.incharge && String(d.incharge.username || '').toLowerCase() === me) out.incharge.add(k);
      if (d.manager && String(d.manager.username || '').toLowerCase() === me) out.manager.add(k);
    });
  } catch (e) { /* no setup yet */ }
  out.any = out.incharge.size > 0 || out.manager.size > 0;
  return out;
}

/* Someone with a PLACE in the roster chain (an In-charge or a Manager — by role or by Setup)
   sees exactly the units that place gives them, plus any units an administrator listed on
   their account explicitly. The account-wide "all units" default that ticking Duty Roster
   leaves behind must NOT open every unit to them: an instructor made In-charge of Trainee
   Nurses saw — and could edit — every ward's roster. Their Setup units arrive through
   reviewVisible / isUnitIncharge; this matcher only answers for the rest. The CNS and
   administrators keep the whole hospital. */
async function holdsRosterPlace(req) {
  const a = req.access;
  if (!a || a.unrestricted || a.rosterRole === 'cns') return false;
  if (a.rosterRole === 'incharge' || a.rosterRole === 'manager') return true;
  return (await rosterPlaceOf(req)).any;
}
async function deptMatcher(req) {
  const a = req.access;
  if (!a || a.unrestricted) return () => true;
  const acc = require('./access');
  const keys = await acc.rosterDeptNames(a);
  if (keys === null && await holdsRosterPlace(req)) return () => false;
  return (dept) => acc.rosterVisible(keys, dept);
}

// A legacy portal account, or a Data Submission holder reading rosters WITHOUT the Duty
// Roster module (let in by requireRead's allowCollector): both see published sheets only.
const isCollector = (req) => {
  const acc = require('./access'); const a = req.access;
  if (!a || a.unrestricted) return false;
  return acc.isPortal(a) || (acc.submitsData(a) && !acc.can(a, 'roster', 'view'));
};
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
// Account-level place in the chain: 'admin' | 'cns' | 'manager' | 'incharge' | ''.
const roleOf = (req) => { const a = req.access; if (!a || a.unrestricted) return 'admin'; return a.rosterRole || ''; };

/* The actor the workflow decides for. canEdit is the SAME formula /scope answers for
   `can.edit`; inScope is the unit assignment — so a hand-over is refused exactly when the
   editor would have been. */
async function actorOf(req, doc) {
  const acc = require('./access');
  const a = req.access || { unrestricted: true };
  const username = a.username || (req.user && req.user.sub) || 'local';
  const name = a.name || (req.user && req.user.name) || username;
  const canEdit = !!(a.unrestricted || acc.portalMayEditRoster(a) || (!isCollector(req) && acc.can(a, 'roster', 'edit')));
  const inScope = doc && doc.dept ? (await deptMatcher(req))(doc.dept) : true;
  return { unrestricted: a.unrestricted === true, username, name, rosterRole: a.rosterRole || '', canEdit, inScope };
}

/* ------------------------------------------------------------- the department index --- */

/* Sheets are filed under the free text typed on a staff record ("Medical ICU", "MICU",
   "M.I.C.U"), while the setup screen, the review inbox and the account assignments speak
   canonical department ids (micu). This index resolves one to the other with the same
   vocabulary the access check uses — ids, register names, quality keys, the alias table
   and the Level-N rule — so a unit spelled four ways is still one row. Cached briefly:
   it reads the department map, and the inbox asks for it on every refresh. */
let _idx = null, _idxTs = 0;
const IDX_TTL = 30000;
/* Trainee nurses are rostered as one unit, "Trainee Nurses", by their instructor — not on the
   ward their record names. The same rule as renderer/unico/roster-spec.js (isTrainee / unitOf);
   kept here too because the server bundle does not ship the renderer files. */
const TRAINEE_UNIT = 'Trainee Nurses', TRAINEE_ID = 'trainee';
const MANAGER_UNIT = 'Nurse Managers', MANAGER_ID = 'manager';
const SUPERVISOR_UNIT = 'Nursing Supervisors', SUPERVISOR_ID = 'supervisor';
// Nurse Manager / Assistant Nurse Manager (never Senior Manager) — roster-spec.js isNurseManager.
const isNurseManager = (p) => !!p && /\b(assistant\s+)?nurse\s*manager\b/i.test(String(p.designation || ''));
function isTraineeNurse(p) {
  if (!p) return false;
  const role = String(p.role || 'Nurse').trim().toLowerCase();
  const des = String(p.designation || '').toLowerCase().replace(/[^a-z]+/g, ' ').trim();
  return (role === 'nurse' && /\btrainee\b/.test(des) && /\bnurs(?:e|ing)\b/.test(des)) || /^(trainee nurse|nurse trainee)$/.test(role);
}
const rosterUnitOf = (p) => (isTraineeNurse(p) ? TRAINEE_UNIT : isNurseManager(p) ? MANAGER_UNIT : ((p && p.current_department) || 'Unassigned'));
// Supervisors are picked in Setup and ALSO stay on their ward: membership, not a unit of their own.
const isSupervisorUnit = (dept) => String(dept || '').trim().toLowerCase() === SUPERVISOR_UNIT.toLowerCase();

async function deptIndex() {
  if (_idx && Date.now() - _idxTs < IDX_TTL) return _idx;
  const acc = require('./access');
  let byId = {};
  try { const map = await require('./deptmap').get(); byId = (map && map.byId) || {}; } catch (e) { byId = {}; }
  const out = [];
  for (const id of Object.keys(byId)) {
    if (byId[id].qualityOnly) continue;
    const keys = await acc.scopedDeptNames({ departments: [id] }, { departmentsOnly: true });
    out.push({ id, name: byId[id].name || id, keys });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  // Not a statistics department, but a roster unit with its own In-charge (the instructor):
  // listed in Setup, the review inbox and the per-person department checklist like any other.
  [[MANAGER_ID, MANAGER_UNIT], [SUPERVISOR_ID, SUPERVISOR_UNIT], [TRAINEE_ID, TRAINEE_UNIT]].forEach(([id, name]) => {
    out.push({ id, name, keys: new Set(acc.deptsOfStaff({ current_department: name })) });
  });
  _idx = out; _idxTs = Date.now();
  return out;
}
const deptKeyOf = (index, dept) => {
  if (!dept) return null;
  const acc = require('./access');
  const hit = (index || []).find((d) => acc.rosterVisible(d.keys, dept));
  return hit ? hit.id : null;
};

/* ------------------------------------------------------------------ the config --- */

const person = (p) => (p && p.username) ? { username: s(p.username, 80), name: s(p.name || p.username, 120) } : null;
async function getConfig() {
  const c = await cfgCol();
  const raw = c ? (await c.findOne({ _id: 'config' })) : memCfg;
  const d = obj(raw);
  const depts = {};
  Object.keys(obj(d.depts)).forEach((k) => { const v = obj(d.depts[k]); depts[k] = { incharge: person(v.incharge), manager: person(v.manager) }; });
  return { cns: person(d.cns), depts, supervisors: cleanIds(d.supervisors), updatedAt: d.updatedAt || null, updatedBy: d.updatedBy || null };
}
function cleanIds(v) {
  const seen = new Set(); const out = [];
  (Array.isArray(v) ? v : []).forEach((x) => { const k = s(x, 40).trim(); if (k && !seen.has(k)) { seen.add(k); out.push(k); } });
  return out.slice(0, 300);
}
// The supervisor members as people (Setup shows names); an id no longer on the register is
// left out of the answer but kept in storage, so a returning staff member is not dropped.
async function supervisorPeople(ids) {
  if (!ids || !ids.length) return [];
  let reg = [];
  try { reg = await require('./staff-roster').loadRoster({ cached: true }); } catch (e) { reg = []; }
  const by = {}; (reg || []).forEach((p) => { if (p && p.id != null && !p.former) by[String(p.id)] = p; });
  return ids.filter((id) => by[id]).map((id) => ({ id, name: by[id].name || '', emp_id: by[id].emp_id || '', current_department: by[id].current_department || '' }));
}
async function saveConfig(doc) {
  const c = await cfgCol();
  if (c) await c.replaceOne({ _id: 'config' }, Object.assign({ _id: 'config' }, doc), { upsert: true });
  else memCfg = Object.assign({ _id: 'config' }, doc);
}
const signersFor = (cfg, key) => {
  const d = (key && cfg.depts[key]) || {};
  return { incharge: d.incharge || null, manager: d.manager || null, cns: cfg.cns || null };
};

/* ------------------------------------------------------------------- storage --- */

async function listAll() {
  const c = await col();
  if (!c) return mem.map(memOut).sort((a, b) => (b.year - a.year) || (b.month - a.month));
  const docs = await c.find({}, { projection: { grid: 0, history: 0 } }).sort({ year: -1, month: -1 }).toArray();
  return docs.map(outDoc);
}
// This unit's people who were MOVED onto another unit's sheet for the same month — the home
// sheet leaves them off (a guest added with "keep on both" stays on both).
async function movedOutOf(dept, year, month) {
  const home = String(dept || '').trim().toLowerCase();
  const out = new Set();
  try {
    (await listAll()).forEach((d) => {
      if (!d || d.year !== year || d.month !== month || String(d.dept || '').trim().toLowerCase() === home) return;
      const g = obj(d.guests);
      Object.keys(g).forEach((k) => { if (g[k] && g[k].mode === 'move' && String(g[k].from || '').trim().toLowerCase() === home) out.add(k); });
    });
  } catch (e) { /* no sheets */ }
  return [...out];
}
async function getOne(id) {
  const c = await col();
  if (!c) return memOut(mem.find((x) => x.id === id));
  return outDoc(await c.findOne({ _id: id }));
}

// One grid snapshot per revision: a return-without-edit followed by a resend lands on
// the same revision and just refreshes the stamps. Bounded per sheet.
async function snapshot(doc, r) {
  const v = { rosterId: doc.id, revision: doc.revision || 0, status: r.to, action: r.entry.action, at: r.entry.at, by: r.entry.by, byName: r.entry.byName, note: r.entry.note,
    grid: doc.grid || {}, order: doc.order || [], names: doc.names || {}, rules: doc.rules || {} };
  const c = await verCol();
  if (c) {
    await c.replaceOne({ rosterId: v.rosterId, revision: v.revision }, Object.assign({ _id: v.rosterId + '@' + v.revision }, v), { upsert: true });
    const n = await c.countDocuments({ rosterId: v.rosterId });
    if (n > W.VERSION_CAP) {
      const old = await c.find({ rosterId: v.rosterId }, { projection: { _id: 1 } }).sort({ revision: 1 }).limit(n - W.VERSION_CAP).toArray();
      if (old.length) await c.deleteMany({ _id: { $in: old.map((x) => x._id) } });
    }
  } else {
    const i = memVersions.findIndex((x) => x.rosterId === v.rosterId && x.revision === v.revision);
    if (i >= 0) memVersions[i] = v; else memVersions.push(v);
    const mine = memVersions.filter((x) => x.rosterId === v.rosterId).sort((a, b) => a.revision - b.revision);
    while (mine.length > W.VERSION_CAP) { const drop = mine.shift(); memVersions.splice(memVersions.indexOf(drop), 1); }
  }
}

/* The one way a sheet changes status. Resolves the config and the actor, asks the
   workflow, then writes CONDITIONALLY on the status and revision it decided against —
   two reviewers deciding the same sheet at the same moment cannot both land. */
async function applyTransition(req, id, action, note) {
  const doc = await getOne(id);
  if (!doc) return { status: 404, body: { ok: false, error: 'Roster not found.' } };
  const cfg = await getConfig();
  const key = deptKeyOf(await deptIndex(), doc.dept);
  const actor = await actorOf(req, doc);
  const r = W.transition(doc, action, actor, { dept: cfg.depts[key] || {}, cns: cfg.cns }, { now: Date.now(), note });
  if (!r.ok) return { status: r.status, body: { ok: false, code: r.code, error: r.error } };
  // A published roster carries no open review notes.
  if (action === 'approve') r.set.marks = {};
  const c = await col();
  const conflict = { status: 409, body: { ok: false, code: 'conflict', conflict: true, error: 'This roster changed while you were deciding. Reload the month and look again.' } };
  if (c) {
    const w = await c.updateOne(
      { _id: id, status: { $in: W.rawStatuses(r.from) }, revision: doc.revision == null ? null : doc.revision },
      { $set: r.set, $push: { history: { $each: [r.entry], $slice: -W.HISTORY_CAP } } });
    if (!w.matchedCount) return conflict;
  } else {
    const x = mem.find((m) => m.id === id);
    if (!x || W.rawStatuses(r.from).indexOf(x.status) < 0 || (x.revision || 0) !== (doc.revision || 0)) return conflict;
    Object.assign(x, r.set);
    x.history = (Array.isArray(x.history) ? x.history : []).concat([r.entry]).slice(-W.HISTORY_CAP);
  }
  if (r.snapshot) { try { await snapshot(doc, r); } catch (e) { /* the hand-over stands; a missing snapshot is not a reason to refuse it */ } }
  try {
    require('./activity-log').log(req, r.activity, { target: doc.deptName || doc.dept, detail: (doc.month + 1) + '/' + doc.year + ' · rev ' + (doc.revision || 0) + (r.entry.note ? ' · ' + r.entry.note : '') });
  } catch (e) { /* logging never breaks the request */ }
  // The In-charge who sends to the Manager IS that unit's Manager (Setup names the same person
  // in both places): the check is theirs to give, so it goes straight on to the CNS — history
  // shows both steps, "Checked by" is them.
  const cfgDept = cfg.depts[key] || {};
  if (action === 'send_manager' && cfgDept.manager && actor.username && cfgDept.manager.username === actor.username) {
    return applyTransition(req, id, 'forward', '');
  }
  return { status: 200, body: { ok: true, roster: await decorate(req, await getOne(id)) } };
}

// This request's rights on one sheet — the same answer decorate() hands the renderer.
async function rightsFor(req, doc) {
  const cfg = await getConfig();
  const key = deptKeyOf(await deptIndex(), doc && doc.dept);
  const actor = await actorOf(req, doc);
  return { can: W.rights(actor, doc, cfg.depts[key] || {}, cfg.cns), actor };
}
/* One guarded write outside a save: only lands while the sheet is still in the status (and,
   when given, at the revision) it was read in — the same guard the hand-overs use. */
async function guardedSet(id, doc, set, entry, atRevision) {
  const c = await col();
  if (c) {
    const filter = { _id: id, status: { $in: W.rawStatuses(W.effStatus(doc)) } };
    if (atRevision) filter.revision = doc.revision == null ? null : doc.revision;
    const upd = { $set: set }; if (entry) upd.$push = { history: { $each: [entry], $slice: -W.HISTORY_CAP } };
    const w = await c.updateOne(filter, upd);
    return w.matchedCount > 0;
  }
  const x = mem.find((m) => m.id === id);
  if (!x || W.rawStatuses(W.effStatus(doc)).indexOf(x.status) < 0) return false;
  if (atRevision && (x.revision || 0) !== (doc.revision || 0)) return false;
  Object.assign(x, JSON.parse(JSON.stringify(set)));
  if (entry) x.history = (Array.isArray(x.history) ? x.history : []).concat([entry]).slice(-W.HISTORY_CAP);
  return true;
}

// What the renderer needs beside the sheet: per-sheet rights and the names to print.
async function decorate(req, doc, stub) {
  const cfg = await getConfig();
  const target = doc || stub;
  const key = deptKeyOf(await deptIndex(), target && target.dept);
  const actor = await actorOf(req, target);
  const can = W.rights(actor, target, cfg.depts[key] || {}, cfg.cns);
  const signers = signersFor(cfg, key);
  // The supervisor sheet's people are a list from Setup, not a department on their records.
  const members = target && isSupervisorUnit(target.dept) ? (cfg.supervisors || []) : undefined;
  if (!doc) return { roster: null, signers, can, members };
  const out = Object.assign({}, doc, { can, signers, deptId: key }, members ? { members } : {});
  if (Array.isArray(out.history)) out.history = out.history.slice(-50);
  return out;
}

// May this request SEE a sheet of this unit through the review chain, beyond its own
// unit assignment? The CNS and administration see every unit; a manager the units the
// setup names them for.
async function reviewVisible(req, cfg, index, dept) {
  const role = roleOf(req);
  if (role === 'admin' || role === 'cns') return true;
  const key = deptKeyOf(index, dept);
  const d = key && cfg.depts[key];
  const me = (req.access && req.access.username) || '';
  // The unit's own In-charge or Manager (Setup) sees its sheets whatever their unit list says.
  if (me && d && d.incharge && d.incharge.username === me) return true;
  return !!(me && d && d.manager && d.manager.username === me);
}

/* Is this account the In-charge Duty Roster -> Setup names for the unit `dept`? Then it may
   prepare (save, send) that unit's roster without the Duty Roster Edit permission: naming
   someone the In-charge is the grant. Read by the save route and its write guard (web.js). */
async function isUnitIncharge(req, dept) {
  const me = String((req.access && req.access.username) || '').toLowerCase();
  if (!me || !dept) return false;
  try {
    const cfg = await getConfig(); const index = await deptIndex();
    const key = deptKeyOf(index, dept); const d = key && cfg.depts[key];
    return !!(d && d.incharge && String(d.incharge.username || '').toLowerCase() === me);
  } catch (e) { return false; }
}

const monthKey = (y, m) => y * 12 + m;
function parseYm(v, fallback) {
  const m = /^(\d{4})-(\d{1,2})$/.exec(String(v || ''));
  if (!m) return fallback;
  const mo = parseInt(m[2], 10) - 1;
  return (mo >= 0 && mo <= 11) ? monthKey(parseInt(m[1], 10), mo) : fallback;
}

function mount(app, opts) {
  const guard = (opts && opts.requireApi) || function (req, res, next) { next(); };
  // Reading a PUBLISHED roster is not the same right as editing one. The GET routes
  // accept a wider guard so a data collector / nurse in-charge can see the approved
  // sheet for their own unit; `publishedOnly` then strips anything that is still a
  // draft, so an unapproved roster stays invisible to them.
  // The hand-over routes ALSO sit on this guard: who may decide is settled by the
  // workflow's rights(), not by the HTTP verb -> module action mapping (which wanted
  // 'add' for every POST and so refused a CNS holding view+edit).
  const readGuard = (opts && opts.requireRead) || guard;
  // Writing is a THIRD right, between the two above. A console account reaches it through
  // the `roster` module permission (the default `guard`); a ward in-charge reaches it only
  // when an administrator granted `rosterEdit`, and web.js passes a guard that admits both.
  const writeGuard = (opts && opts.requireWrite) || guard;
  const adminOnly = (req, res, next) => {
    if (req.access && !req.access.unrestricted) return res.status(403).json({ ok: false, error: 'Administrator access required.' });
    next();
  };
  // Account-level flags for the screen (per-sheet rights ride on the sheet itself).
  // `place` = rosterPlaceOf(req): a Manager slot in Setup counts as the Manager role.
  const accountCan = (req, place) => {
    const role = roleOf(req);
    const admin = role === 'admin', mgr = role === 'manager' || !!(place && place.manager && place.manager.size), cns = role === 'cns';
    return { forward: admin || mgr, approve: admin || cns, return: admin || mgr || cns, reopen: admin, review: admin || mgr || cns, setup: admin, role };
  };

  // The index: every roster, WITHOUT its grid. The list screen shows a dozen months
  // across seventeen units; shipping every grid with it would be megabytes for nothing.
  app.get('/api/rosters', readGuard, async (req, res) => {
    try {
      const allowed = await deptMatcher(req);
      const cfg = await getConfig(); const index = await deptIndex();
      const out = [];
      for (const d of await listAll()) { if (d && (allowed(d.dept) || await reviewVisible(req, cfg, index, d.dept))) out.push(d); }
      res.json({ ok: true, rosters: publishedOnly(req, out) });
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
          .forEach((p) => { if (p && p.is_active !== false && !p.former) names.add(s(rosterUnitOf(p), 120)); });
      } catch (e) { /* register unreadable -> fall back to the rosters' own departments */ }
      (await listAll()).forEach((d) => { if (d && d.dept) names.add(d.dept); });
      // Plus the units Setup names this account the In-charge of — they prepare those rosters.
      let icKeys = new Set(), icIndex = null;
      try {
        const me = (a && a.username) || '';
        const cfg0 = await getConfig(); icIndex = await deptIndex();
        Object.keys(cfg0.depts || {}).forEach((k) => {
          const d = cfg0.depts[k];
          if (me && d && ((d.incharge && d.incharge.username === me) || (d.manager && d.manager.username === me))) icKeys.add(k);
        });
        // A Setup unit nobody is on yet (no staff, no sheet) still belongs on their list.
        icIndex.forEach((d) => { if (icKeys.has(d.id)) names.add(d.name); });
      } catch (e) { icKeys = new Set(); }
      const placeBound = await holdsRosterPlace(req) && (await acc.rosterDeptNames(a)) === null;
      try { const c0 = await getConfig(); if ((c0.supervisors || []).length) names.add(SUPERVISOR_UNIT); } catch (e) { /* no setup yet */ }
      const units = [...names].filter((n) => n && (allowed(n) || (icKeys.size && icIndex && icKeys.has(deptKeyOf(icIndex, n))))).sort((x, y) => x.localeCompare(y));
      const may = (act) => !a || a.unrestricted || acc.can(a, 'roster', act);
      const pe = acc.portalMayEditRoster(a);
      const console_ = !isCollector(req);
      const edit = pe || (console_ && may('edit'));
      res.json({
        ok: true,
        // Someone with a place in the chain is bound to their units, whatever the account default says.
        scope: placeBound ? 'departments' : ((a && !a.unrestricted && a.rosterScope) || 'all'),
        units,
        // Collectors and in-charges only ever receive APPROVED sheets (publishedOnly),
        // so the renderer must not offer them an editor for a unit they can only read.
        // A ward in-charge granted `rosterEdit` may build and send their own unit's
        // sheet; checking, approving and reopening follow the person's roster role.
        can: Object.assign({
          view: may('view'),
          edit,
          add: pe || (console_ && may('add')),
          delete: console_ && may('delete'),
          submit: edit,
          send: edit,
        }, accountCan(req, await rosterPlaceOf(req))),
      });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not load your roster access.' }); }
  });

  /* The oversight view: every unit, who may roster it, and whether it actually has a
     sheet this month. Open to whoever reviews rosters (manager, CNS, administration) —
     the person accountable for the rosters being done is the person who should see
     where they are not.

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
    if (!accountCan(req, await rosterPlaceOf(req)).review) return res.status(403).json({ ok: false, error: 'Reviewing every unit needs a roster review role (manager, CNS or administrator).' });
    try {
      const acc = require('./access');
      const depts = (await deptIndex()).map((d) => ({ id: d.id, name: d.name }));

      // Only the fields this view shows. A projection, not a filter applied afterwards:
      // password hashes must never be read into the process in the first place.
      let accounts = [];
      try {
        const users = await require('./db').getUsers();
        if (users && typeof users.find === 'function') accounts = await users.find({}, { projection: { username: 1, name: 1, role: 1, active: 1, perms: 1, rosterScope: 1, rosterDepartments: 1, rosterRole: 1, staffScope: 1, departments: 1 } }).toArray();
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
          rosterRole: u.role === 'Administrator' ? 'admin' : W.cleanRosterRole(u.rosterRole),
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
          holders: holders.map((p) => ({ username: p.username, name: p.name, actions: p.actions, scope: p.scope, inherited: p.inherited, rosterRole: p.rosterRole })),
          editors: holders.filter((p) => p.actions.indexOf('edit') >= 0 || p.actions.indexOf('add') >= 0).length,
          sheets: mine.length,
          current: thisMonth ? { status: thisMonth.status || 'draft', stage: thisMonth.stage || null, revision: thisMonth.revision || 1, updatedAt: thisMonth.updatedAt || null, updatedBy: thisMonth.updatedBy || null } : null,
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
      const cfg = await getConfig(); const index = await deptIndex();
      const all = await require('./staff-roster').loadRoster({ cached: true });
      const supSet = new Set(cfg.supervisors || []);
      const supVisible = supSet.size > 0 && (allowed(SUPERVISOR_UNIT) || await reviewVisible(req, cfg, index, SUPERVISOR_UNIT));
      const out = [];
      for (const p of (all || [])) {
        if (!p || p.is_active === false || p.former) continue;
        const dept = rosterUnitOf(p);   // a trainee belongs to the Trainee Nurses unit
        const supMember = supSet.has(String(p.id));
        if (!(allowed(dept) || await reviewVisible(req, cfg, index, dept) || (supMember && supVisible))) continue;
        const o = {}; ROSTER_STAFF_FIELDS.forEach((k) => { if (p[k] !== undefined) o[k] = p[k]; });
        // The face on the roster row — the URL only, never the storage id behind it.
        const ph = p.photo || p.photo_url;
        const url = ph ? (typeof ph === 'string' ? ph : (ph.url || '')) : '';
        if (url) o.photo = url;
        out.push(o);
      }
      res.json({ ok: true, staff: out });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not load the unit staff.' }); }
  });

  /* ------------------------------------------------------------- the review inbox --- */

  /* One row per canonical department for a month, for whoever reviews rosters. A unit
     with NO sheet is a row too ("not submitted") — the inbox exists to show what is
     missing as much as what is waiting. Each row carries the per-sheet rights so the
     screen renders exactly the buttons the server would honour. */
  async function reviewRows(req, year, month) {
    const cfg = await getConfig(); const index = await deptIndex();
    const allowed = await deptMatcher(req);
    const role = roleOf(req);
    const me = (req.access && req.access.username) || '';
    const sheets = (await listAll()).filter((d) => d && d.year === year && d.month === month);
    const byKey = {};
    const unmapped = [];
    sheets.forEach((sh) => {
      const key = deptKeyOf(index, sh.dept);
      if (!key) { unmapped.push(sh); return; }
      // Two spellings of one unit in one month: the most recently saved one is the row.
      if (!byKey[key] || (sh.updatedAt || 0) > (byKey[key].updatedAt || 0)) byKey[key] = sh;
    });
    const rows = [];
    const rowOf = async (key, name, sh) => {
      const cfgDept = (key && cfg.depts[key]) || {};
      const target = sh || { dept: name, status: 'draft', revision: 0 };
      const actor = await actorOf(req, target);
      const can = W.rights(actor, target, cfgDept, cfg.cns);
      const st = sh ? sh.status : null;
      const pendingForMe = st === 'pending_manager' ? (can.forward || can.return) : st === 'pending_cns' ? (can.approve || can.return) : false;
      return {
        dept: key, deptName: name, sheetDept: sh ? sh.dept : name,
        id: sh ? sh.id : null, hasSheet: !!sh, status: st, stage: sh ? (sh.stage || null) : null, revision: sh ? (sh.revision || 0) : 0,
        sentAt: sh ? (sh.sentAt || null) : null, sentBy: sh ? (sh.sentBy || null) : null, sentByName: sh ? (sh.sentByName || null) : null,
        returnNote: sh ? (sh.returnNote || '') : '', returnedByName: sh ? (sh.returnedByName || null) : null, returnStage: sh ? (sh.returnStage || null) : null,
        approvedBy: sh ? (sh.approvedBy || null) : null, approvedAt: sh ? (sh.approvedAt || null) : null,
        updatedAt: sh ? (sh.updatedAt || null) : null, updatedBy: sh ? (sh.updatedBy || null) : null,
        staffCount: sh ? (Array.isArray(sh.order) ? sh.order.length : 0) : 0,
        incharge: cfgDept.incharge || null, manager: cfgDept.manager || null,
        pendingForMe, can,
      };
    };
    for (const d of index) {
      const mine = role === 'admin' || role === 'cns'
        || (cfg.depts[d.id] && cfg.depts[d.id].manager && cfg.depts[d.id].manager.username === me)
        || (role === 'manager' && (allowed(d.id) || allowed(d.name)));
      if (!mine) continue;
      rows.push(await rowOf(d.id, d.name, byKey[d.id] || null));
    }
    for (const sh of unmapped) {
      if (!(role === 'admin' || role === 'cns' || allowed(sh.dept))) continue;
      rows.push(await rowOf(null, sh.deptName || sh.dept, sh));
    }
    return { rows, cfg };
  }
  const ymOf = (req) => {
    const now = new Date();
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const m = parseInt(req.query.month, 10);
    return { year, month: (m >= 0 && m <= 11) ? m : now.getMonth() };
  };
  app.get('/api/rosters/review', readGuard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      if (!accountCan(req, await rosterPlaceOf(req)).review) return res.status(403).json({ ok: false, error: 'The review inbox is for managers, the CNS and administrators.' });
      const { year, month } = ymOf(req);
      const { rows, cfg } = await reviewRows(req, year, month);
      res.json({ ok: true, year, month, me: (req.access && req.access.username) || null, role: roleOf(req), cns: cfg.cns, rows });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not load the review inbox.' }); }
  });
  // The sidebar badge: sheets waiting on ME, and my own units' sheets sent back to me.
  app.get('/api/rosters/review/count', readGuard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const { year, month } = ymOf(req);
      let pending = 0, returned = 0;
      if (accountCan(req, await rosterPlaceOf(req)).review) pending = (await reviewRows(req, year, month)).rows.filter((r) => r.pendingForMe).length;
      const allowed = await deptMatcher(req);
      const actor = await actorOf(req, null);
      if (actor.canEdit) returned = (await listAll()).filter((d) => d && d.year === year && d.month === month && d.status === 'returned' && allowed(d.dept)).length;
      res.json({ ok: true, year, month, pending, returned });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not count the roster queue.' }); }
  });

  /* ------------------------------------------------------------ staff-wise history --- */

  // One person's row across months. Rows are keyed 'S<staff.id>' on the sheet; sheets
  // saved since this shipped carry `staffIds` for the index, older ones are matched on
  // the grid key itself.
  app.get('/api/rosters/staff/:staffId', readGuard, async (req, res) => {
    try {
      const digits = String(req.params.staffId || '').replace(/^S/i, '');
      if (!/^\d+$/.test(digits)) return res.status(400).json({ ok: false, error: 'A staff id is needed.' });
      const key = 'S' + digits;
      const now = new Date();
      const to = parseYm(req.query.to, monthKey(now.getFullYear(), now.getMonth()));
      let from = parseYm(req.query.from, to - 11);
      if (from > to) from = to;
      if (to - from > 23) from = to - 23;
      const allowed = await deptMatcher(req);
      const cfg = await getConfig(); const index = await deptIndex();
      const c = await col();
      let docs;
      if (c) {
        docs = (await c.find({ $or: [{ staffIds: key }, { ['grid.' + key]: { $exists: true } }] },
          { projection: { ['grid.' + key]: 1, dept: 1, deptName: 1, year: 1, month: 1, status: 1, revision: 1, approvedAt: 1 } }).toArray()).map(outDoc);
      } else {
        docs = mem.filter((x) => x.grid && x.grid[key]).map(memOut);
      }
      const out = [];
      for (const d of docs) {
        const k = monthKey(d.year, d.month);
        if (k < from || k > to) continue;
        if (!(allowed(d.dept) || await reviewVisible(req, cfg, index, d.dept))) continue;
        if (!publishedOnly(req, [d]).length) continue;
        out.push({ id: d.id, dept: d.dept, deptName: d.deptName || d.dept, year: d.year, month: d.month, status: d.status, revision: d.revision || 0, cells: (d.grid && d.grid[key]) || {} });
      }
      out.sort((a, b) => monthKey(a.year, a.month) - monthKey(b.year, b.month));
      res.json({ ok: true, staffKey: key, from: { year: Math.floor(from / 12), month: from % 12 }, to: { year: Math.floor(to / 12), month: to % 12 }, months: out });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not load this person\'s rosters.' }); }
  });

  /* ------------------------------------------------------------------- the config --- */

  // Who prepares, checks and approves: names only, readable by anyone who opens a sheet
  // (they are printed on it). Every canonical department is listed so the setup screen
  // and the sign-off block never have to resolve a unit themselves.
  app.get('/api/rosters/config', readGuard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const cfg = await getConfig();
      const depts = (await deptIndex()).map((d) => { const v = cfg.depts[d.id] || {}; return { id: d.id, name: d.name, incharge: v.incharge || null, manager: v.manager || null }; });
      res.json({ ok: true, cns: cfg.cns, depts, supervisors: await supervisorPeople(cfg.supervisors), updatedAt: cfg.updatedAt, updatedBy: cfg.updatedBy });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not load the roster setup.' }); }
  });
  app.put('/api/rosters/config', readGuard, adminOnly, async (req, res) => {
    try {
      const b = obj(req.body);
      const index = await deptIndex();
      const ids = new Set(index.map((d) => d.id));
      const users = await require('./db').getUsers();
      // A slot names an ACCOUNT, never free text: the manager and CNS must be able to sign
      // in and decide, and a renamed person must keep their place. Looked up one by one
      // (the in-memory dev store has no find()); it is a handful of names.
      const lookup = async (p) => {
        if (p == null || p === '' || (typeof p === 'object' && !p.username)) return null;
        const username = s(typeof p === 'object' ? p.username : p, 80).trim().toLowerCase();
        if (!username) return null;
        const u = users ? await users.findOne({ username }) : null;
        if (!u || u.active === false) throw new Error('No active account is called "' + username + '".');
        return { username: u.username, name: u.name || u.username };
      };
      const cfg = await getConfig();
      const next = { cns: cfg.cns, depts: Object.assign({}, cfg.depts) };
      const changed = [];
      if (has(b, 'cns')) { const v = await lookup(b.cns); if (JSON.stringify(v) !== JSON.stringify(cfg.cns)) { changed.push('CNS: ' + (v ? v.name : '—')); } next.cns = v; }
      const depts = obj(b.depts);
      for (const id of Object.keys(depts).slice(0, 300)) {
        if (!ids.has(id)) return res.status(400).json({ ok: false, error: 'Unknown department "' + s(id, 60) + '".' });
        const v = obj(depts[id]);
        const cur = cfg.depts[id] || { incharge: null, manager: null };
        const row = { incharge: has(v, 'incharge') ? await lookup(v.incharge) : cur.incharge, manager: has(v, 'manager') ? await lookup(v.manager) : cur.manager };
        if (JSON.stringify(row) !== JSON.stringify(cur)) { changed.push(id + ': ' + (row.incharge ? row.incharge.name : '—') + ' / ' + (row.manager ? row.manager.name : '—')); }
        next.depts[id] = row;
      }
      // The supervisor members ride on the same document: sent = replaced, absent = kept.
      next.supervisors = cfg.supervisors;
      if (has(b, 'supervisors')) {
        const want = cleanIds(b.supervisors);
        if (JSON.stringify(want) !== JSON.stringify(cfg.supervisors)) changed.push('Nursing Supervisors: ' + want.length + ' member' + (want.length === 1 ? '' : 's'));
        next.supervisors = want;
      }
      await saveConfig({ cns: next.cns, depts: next.depts, supervisors: next.supervisors, updatedAt: Date.now(), updatedBy: who(req) });
      if (changed.length) { try { require('./activity-log').log(req, 'roster_config', { target: 'Duty Roster', detail: changed.join(', ').slice(0, 900) }); } catch (e) { /* never breaks the save */ } }
      const saved = await getConfig();
      res.json({ ok: true, changed: changed.length, cns: saved.cns, depts: index.map((d) => { const v = saved.depts[d.id] || {}; return { id: d.id, name: d.name, incharge: v.incharge || null, manager: v.manager || null }; }), supervisors: await supervisorPeople(saved.supervisors), updatedAt: saved.updatedAt, updatedBy: saved.updatedBy });
    } catch (e) {
      if (e && /No active account/.test(e.message)) return res.status(400).json({ ok: false, error: e.message });
      res.status(500).json({ ok: false, error: 'Could not save the roster setup.' });
    }
  });

  // The accounts the setup pickers offer: everyone with a place in the chain, plus the
  // administrators (who may stand in for any slot). Names and roster fields only.
  app.get('/api/rosters/reviewers', readGuard, async (req, res) => {
    try {
      let list = [];
      try {
        const users = await require('./db').getUsers();
        if (users && typeof users.find === 'function') list = await users.find({ active: { $ne: false } }, { projection: { username: 1, name: 1, title: 1, role: 1, rosterRole: 1, rosterScope: 1, rosterDepartments: 1, staffId: 1, staffEmpId: 1 } }).toArray();
      } catch (e) { list = []; }
      // The label beside a name is the person's DESIGNATION from the staff register (linked
      // record, else employee no., else a unique name match) — the account's free-text title
      // read like a job ("Nurse Manager" beside an Instructor) and is only the last resort.
      let staffAll = [];
      try { staffAll = (await require('./staff-roster').loadRoster({ cached: true })) || []; } catch (e) { staffAll = []; }
      const nameKey = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const desigOf = (u) => {
        let p = null;
        if (u.staffId != null && u.staffId !== '') p = staffAll.find((e) => e && String(e.id) === String(u.staffId));
        if (!p && u.staffEmpId) p = staffAll.find((e) => e && e.emp_id && String(e.emp_id) === String(u.staffEmpId));
        if (!p && u.name) { const m = staffAll.filter((e) => e && !e.former && nameKey(e.name) === nameKey(u.name)); if (m.length === 1) p = m[0]; }
        return (p && p.designation) || '';
      };
      // A portal login can only be an In-charge (it has no review inbox); a Manager / CNS
      // place saved on one before that rule is not offered.
      const PORTAL = require('./access').PORTAL_ROLES || [];
      const roleOf = (u) => {
        if (u.role === 'Administrator') return 'admin';
        const r = W.cleanRosterRole(u.rosterRole);
        return PORTAL.indexOf(u.role) >= 0 && r !== 'incharge' ? '' : r;
      };
      const out = list
        .filter((u) => roleOf(u))
        .map((u) => ({ username: u.username, name: u.name || u.username, title: u.title || '', desig: desigOf(u), rosterRole: roleOf(u), rosterScope: u.rosterScope || null, rosterDepartments: Array.isArray(u.rosterDepartments) ? u.rosterDepartments : [] }))
        .sort((x, y) => String(x.name).localeCompare(String(y.name)));
      res.json({ ok: true, reviewers: out });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not load the reviewers.' }); }
  });

  // A printout is logged, like My Department's and Device Days' are.
  app.post('/api/rosters/print', readGuard, async (req, res) => {
    const b = obj(req.body);
    try { await require('./activity-log').log(req, 'roster_print', { target: s(b.target || b.kind || 'Duty Roster', 160), detail: s(b.detail, 400) }); } catch (e) { /* never fails the print */ }
    res.json({ ok: true });
  });

  /* ------------------------------------------------------------------- versions --- */

  const sheetVisible = async (req, doc) => {
    if (!doc) return false;
    const allowed = await deptMatcher(req);
    if (!(allowed(doc.dept) || await reviewVisible(req, await getConfig(), await deptIndex(), doc.dept))) return false;
    return publishedOnly(req, [doc]).length > 0;
  };
  app.get('/api/rosters/:id/versions', readGuard, async (req, res) => {
    try {
      const id = s(req.params.id, 80);
      if (!(await sheetVisible(req, await getOne(id)))) return res.status(403).json({ ok: false, error: 'This roster is outside your departments.' });
      const c = await verCol();
      const list = c ? await c.find({ rosterId: id }, { projection: { grid: 0, order: 0, names: 0, rules: 0 } }).sort({ revision: -1 }).toArray()
        : memVersions.filter((v) => v.rosterId === id).sort((a, b) => b.revision - a.revision);
      res.json({ ok: true, versions: list.map((v) => ({ revision: v.revision, status: v.status, action: v.action, at: v.at, by: v.by, byName: v.byName, note: v.note || '' })) });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not load the roster versions.' }); }
  });
  app.get('/api/rosters/:id/versions/:revision', readGuard, async (req, res) => {
    try {
      const id = s(req.params.id, 80); const rev = parseInt(req.params.revision, 10);
      if (!(await sheetVisible(req, await getOne(id)))) return res.status(403).json({ ok: false, error: 'This roster is outside your departments.' });
      const c = await verCol();
      const v = c ? await c.findOne({ rosterId: id, revision: rev }) : memVersions.find((x) => x.rosterId === id && x.revision === rev);
      if (!v) return res.status(404).json({ ok: false, error: 'That version is no longer kept.' });
      const { _id, ...rest } = v;
      res.json({ ok: true, version: rest });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not load that roster version.' }); }
  });

  /* ---------------------------------------------------------------- hand-overs --- */

  /* Review marks: the reviewer pins a note to one person's day ("no night after leave") for
     the in-charge to fix; the in-charge marks it done once the sheet is back with them. */
  app.post('/api/rosters/:id/marks', readGuard, async (req, res) => {
    try {
      const id = s(req.params.id, 80); const b = obj(req.body);
      const doc = await getOne(id);
      if (!doc) return res.status(404).json({ ok: false, error: 'Roster not found.' });
      const { can, actor } = await rightsFor(req, doc);
      const emp = s(b.empId, 40), day = parseInt(b.day, 10);
      if (!emp || !(day >= 1 && day <= 31)) return res.status(400).json({ ok: false, error: 'Which cell?' });
      const marks = JSON.parse(JSON.stringify(obj(doc.marks)));
      if (b.remove) {
        if (!can.markDone) return res.status(403).json({ ok: false, error: 'Only the reviewer or the in-charge can clear a review note.' });
        if (marks[emp]) { delete marks[emp][day]; if (!Object.keys(marks[emp]).length) delete marks[emp]; }
      } else {
        if (!can.mark) return res.status(403).json({ ok: false, error: 'Only the reviewer this roster is waiting on can mark it.' });
        const note = s(b.note, 200).trim();
        if (!note) return res.status(400).json({ ok: false, error: 'Write what needs changing.' });
        const count = Object.keys(marks).reduce((a, k) => a + Object.keys(obj(marks[k])).length, 0);
        if (count >= 200 && !(marks[emp] && marks[emp][day])) return res.status(400).json({ ok: false, error: 'This sheet already has 200 notes.' });
        (marks[emp] || (marks[emp] = {}))[day] = { note, code: s((obj(doc.grid)[emp] || {})[day], 8), by: actor.username, byName: actor.name, at: Date.now() };
      }
      if (!(await guardedSet(id, doc, { marks }, null, false))) return res.status(409).json({ ok: false, conflict: true, error: 'This roster changed meanwhile. Reload it and try again.' });
      res.json({ ok: true, roster: await decorate(req, await getOne(id)) });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not save the note.' }); }
  });

  /* The reviewer changes one shift directly instead of returning the whole sheet. Every
     change is a history row ("Rahima · 12 Nov: N2 → OFF") the in-charge sees. */
  app.post('/api/rosters/:id/review-edit', readGuard, async (req, res) => {
    try {
      const id = s(req.params.id, 80); const b = obj(req.body);
      const doc = await getOne(id);
      if (!doc) return res.status(404).json({ ok: false, error: 'Roster not found.' });
      const { can, actor } = await rightsFor(req, doc);
      if (!can.reviewEdit) return res.status(403).json({ ok: false, error: 'Only the reviewer this roster is waiting on can change a shift on it.' });
      const current = doc.revision || 0;
      if (b.baseRevision != null && Number(b.baseRevision) !== current) return res.status(409).json({ ok: false, conflict: true, revision: current, error: 'This roster changed since you opened it. Reload it and look again.' });
      const emp = s(b.empId, 40), day = parseInt(b.day, 10);
      if (!emp || !(day >= 1 && day <= 31)) return res.status(400).json({ ok: false, error: 'Which cell?' });
      const code = s(b.code, 8).trim().toUpperCase();
      const grid = JSON.parse(JSON.stringify(obj(doc.grid)));
      const before = (grid[emp] || {})[day] || '';
      if (before === code) return res.json({ ok: true, roster: await decorate(req, doc) });
      const row = Object.assign({}, grid[emp] || {});
      if (code) row[day] = code; else delete row[day];
      if (Object.keys(row).length) grid[emp] = row; else delete grid[emp];
      const extras = cellExtras({ grid }, {}, doc);
      const now = Date.now();
      const who_ = (obj(doc.names)[emp]) || emp;
      const lbl = new Date(doc.year, doc.month, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const entry = { at: now, by: actor.username, byName: actor.name, action: 'edit', from: W.effStatus(doc), to: W.effStatus(doc), note: who_ + ' · ' + lbl + ': ' + (before || '—') + ' → ' + (code || '—'), revision: current + 1 };
      const set = { grid, staffIds: Object.keys(grid), oncall: extras.oncall, altLeave: extras.altLeave, revision: current + 1, updatedAt: now, updatedBy: who(req) };
      if (!(await guardedSet(id, doc, set, entry, true))) return res.status(409).json({ ok: false, conflict: true, error: 'This roster changed meanwhile. Reload it and try again.' });
      try { require('./activity-log').log(req, 'roster_review_edit', { target: doc.deptName || doc.dept, detail: (doc.month + 1) + '/' + doc.year + ' · ' + entry.note }); } catch (e) { /* never breaks the request */ }
      res.json({ ok: true, roster: await decorate(req, await getOne(id)) });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not change that shift.' }); }
  });

  // The one decision route. Body: { action: send_manager | send_cns | forward | approve | return | reopen, note? }.
  app.post('/api/rosters/:id/transition', readGuard, async (req, res) => {
    try {
      const b = obj(req.body);
      const r = await applyTransition(req, s(req.params.id, 80), s(b.action, 40), b.note);
      res.status(r.status).json(r.body);
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not change the status.' }); }
  });

  // The status route older clients still call, mapped onto the hand-overs. The caller's
  // `approvedBy` is ignored: names come from the setup, never from the payload.
  app.post('/api/rosters/:id/status', readGuard, async (req, res) => {
    try {
      const id = s(req.params.id, 80);
      const status = s(obj(req.body).status);
      const cur = await getOne(id);
      if (!cur) return res.status(404).json({ ok: false, error: 'Roster not found.' });
      const eff = cur.status;
      // The final step decides whether the whole move is allowed: a caller who cannot
      // approve must not get the sheet sent to the CNS as a side effect of trying.
      if (status === 'approved' && !accountCan(req, await rosterPlaceOf(req)).approve) return res.status(403).json({ ok: false, code: 'forbidden', error: 'Only the CNS can approve a roster.' });
      let steps = [];
      if (status === 'submitted') steps = ['send_cns'];
      else if (status === 'approved') steps = (W.EDITABLE.indexOf(eff) >= 0 ? ['send_cns'] : eff === 'pending_manager' ? ['forward'] : []).concat(['approve']);
      else if (status === 'draft') steps = eff === 'approved' ? ['reopen'] : ['return'];
      else return res.status(400).json({ ok: false, error: 'Unknown status.' });
      let r = null;
      for (const step of steps) { r = await applyTransition(req, id, step, obj(req.body).note); if (r.status !== 200) break; }
      // The old route said `locked` on a published sheet; keep that flag for its callers.
      if (r.status === 409 && eff === 'approved') r.body.locked = true;
      res.status(r.status).json(r.body);
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not change the status.' }); }
  });

  /* ------------------------------------------------------------------- the sheet --- */

  // One month, with the grid — plus the names to print and what this account may do with
  // it. A unit that has no sheet yet still answers with the names, so a brand-new sheet
  // opens with its sign-off block filled in.
  /* Find anyone on the register to add to a roster from another unit. Administrators only;
     minimal fields, at most 20, so it is not a way to read the register. */
  app.get('/api/rosters/staff-search', readGuard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = req.access || {};
      // Putting someone from another unit on a sheet is an administrator's call.
      if (!a.unrestricted) return res.status(403).json({ ok: false, error: 'Adding staff from another unit is for administrators.' });
      const q = s(req.query.q, 60).trim().toLowerCase();
      if (q.length < 2) return res.json({ ok: true, staff: [] });
      const all = await require('./staff-roster').loadRoster({ cached: true });
      const out = [];
      for (const p of (all || [])) {
        if (!p || p.is_active === false || p.former || p.id == null) continue;
        const hay = [p.name, p.emp_id, p.designation, p.current_department].join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) continue;
        const ph = p.photo || p.photo_url;
        out.push({ id: p.id, name: p.name || '', emp_id: p.emp_id || '', designation: p.designation || '', current_department: p.current_department || '', role: p.role || '', unit: rosterUnitOf(p), photo: ph ? (typeof ph === 'string' ? ph : (ph.url || '')) : '' });
        if (out.length >= 20) break;
      }
      res.json({ ok: true, staff: out });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not search the staff.' }); }
  });

  app.get('/api/rosters/:dept/:year/:month', readGuard, async (req, res) => {
    try {
      const dept = s(req.params.dept, 40);
      const allowed = await deptMatcher(req);
      if (!(allowed(dept) || await reviewVisible(req, await getConfig(), await deptIndex(), dept))) return res.status(403).json({ ok: false, error: 'This roster belongs to a unit outside your departments.' });
      const id = rosterId(dept, parseInt(req.params.year, 10), parseInt(req.params.month, 10));
      const doc = publishedOnly(req, [await getOne(id)].filter(Boolean))[0] || null;   // null when never drafted (or not published, to a collector)
      const d = await decorate(req, doc, { dept, status: 'draft', revision: 0 });
      const movedOut = await movedOutOf(dept, parseInt(req.params.year, 10), parseInt(req.params.month, 10));
      if (!doc) return res.json({ ok: true, roster: null, signers: d.signers, can: d.can, members: d.members, movedOut });
      res.json({ ok: true, roster: d, signers: d.signers, can: d.can, members: d.members, movedOut });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not load the roster.' }); }
  });

  app.put('/api/rosters', writeGuard, async (req, res) => {
    try {
      const b = obj(req.body);
      if (!s(b.dept)) return res.status(400).json({ ok: false, error: 'A department is required.' });
      if (!(await deptMatcher(req))(b.dept) && !(await isUnitIncharge(req, b.dept))) return res.status(403).json({ ok: false, error: 'This roster belongs to a unit outside your departments.' });
      const head = normRoster(b);
      const id = rosterId(head.dept, head.year, head.month);
      const c = await col();
      const existing = await getOne(id);
      const eff = existing ? existing.status : 'draft';
      const admin = !!(req.access && req.access.unrestricted);
      // An approved roster is the published, signed sheet. NO save may overwrite it or
      // move it back to draft — the old check let any save labelled "draft" through, so
      // a pending autosave un-published a roster seconds after it was approved.
      // Reopening is a hand-over (admin only). A sheet WITH A REVIEWER is locked the same
      // way for its author: what the manager is reading must be what they decide on.
      if (eff === 'approved') {
        return res.status(409).json({ ok: false, locked: true, error: 'This roster is approved and locked. Reopen it before editing.' });
      }
      if (W.PENDING.indexOf(eff) >= 0 && !admin) {
        return res.status(409).json({ ok: false, locked: true, pending: true, error: 'This roster is ' + (eff === 'pending_manager' ? 'with the manager' : 'with the CNS') + ' for review. Ask them to return it if it needs changes.' });
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
      // Who is on the sheet from another unit is an administrator's call: anyone else's save keeps
      // the stored list as it is — nobody added, nobody taken off — whatever the request carries.
      if (!admin) doc.guests = normGuests(existing ? existing.guests : {});
      // Keys a legacy client still sends that a save no longer honours — reported, not refused.
      const ignored = [];
      if (has(b, 'status') && s(b.status) !== doc.status && s(b.status) !== 'submitted') ignored.push('status');
      if (has(b, 'approvedBy')) ignored.push('approvedBy');
      doc.staffIds = Object.keys(doc.grid);
      doc.revision = current + 1;
      doc.updatedAt = Date.now();
      doc.updatedBy = who(req);
      // Editing a returned sheet: the correction has started, it is a draft again.
      let push = null;
      if (eff === 'returned') { const rs = W.resumeOnEdit(existing, await actorOf(req, existing), doc.updatedAt); Object.assign(doc, rs.set); push = rs.entry; }
      const raced = () => res.status(409).json({ ok: false, conflict: true,
        error: 'Someone else saved this roster at the same moment. Reload the month and try again.' });
      if (c) {
        if (existing) {
          // Conditional on the revision just checked, so two saves can never interleave;
          // and on the status, so a hand-over landing meanwhile is not overwritten.
          const filter = { _id: id, revision: existing.revision == null ? null : existing.revision, status: { $in: W.rawStatuses(eff) } };
          const upd = { $set: doc }; if (push) upd.$push = { history: { $each: [push], $slice: -W.HISTORY_CAP } };
          const r = await c.updateOne(filter, upd);
          if (!r.matchedCount) return raced();
        } else {
          doc.createdAt = Date.now(); doc.createdBy = who(req); doc.history = [];
          try { await c.insertOne(Object.assign({ _id: id }, doc)); }
          catch (e) { if (e && e.code === 11000) return raced(); throw e; }
        }
      } else {
        const idx = mem.findIndex((x) => x.id === id);
        if (idx >= 0) {
          const x = mem[idx];
          if ((x.revision || 0) !== current || W.rawStatuses(eff).indexOf(x.status) < 0) return raced();
          Object.assign(x, doc);
          if (push) x.history = (Array.isArray(x.history) ? x.history : []).concat([push]).slice(-W.HISTORY_CAP);
        } else {
          doc.createdAt = Date.now(); doc.createdBy = who(req); doc.history = [];
          mem.push(Object.assign({ id }, doc));
        }
      }
      // Older clients hand a sheet in by saving it with status 'submitted'.
      if (s(b.status) === 'submitted' && W.EDITABLE.indexOf(doc.status) >= 0) {
        const t = await applyTransition(req, id, 'send_cns');
        if (t.status === 200) return res.json(Object.assign({}, t.body, ignored.length ? { ignored } : {}));
      }
      const out = { ok: true, roster: await decorate(req, await getOne(id)) };
      if (ignored.length) out.ignored = ignored;
      res.json(out);
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not save the roster.' }); }
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

module.exports = {
  mount, COLL, VER_COLL, CFG_COLL, STATUSES, rosterId, normGrid,
  effStatus: W.effStatus, rawStatuses: W.rawStatuses, resumeOnEdit: W.resumeOnEdit, PENDING: W.PENDING, EDITABLE: W.EDITABLE, HISTORY_CAP: W.HISTORY_CAP,
  applyTransition, getConfig, deptIndex, deptKeyOf, getOne, decorate, actorOf, isUnitIncharge,
  TRAINEE_UNIT, TRAINEE_ID, MANAGER_UNIT, SUPERVISOR_UNIT, isTraineeNurse, isNurseManager, rosterUnitOf, movedOutOf, normGuests,
  // The in-memory store, for the tests to plant a legacy row in.
  __mem: () => mem,
};
