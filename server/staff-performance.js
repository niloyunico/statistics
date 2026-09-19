/* UNICO — Individual Performance module (Form HR-NUR-PA-01).
 *
 * Three registers, one per collection:
 *
 *   staffAppraisals    ONE document per (employee, appraisal cycle). Holds the 20
 *                      parameter scores, the per-parameter remarks, the assessor's
 *                      comments, the discussion/acknowledgement record and Part H —
 *                      the action taken by the Chief Nursing Superintendent.
 *   staffIncidents     Errors, lapses and disciplinary entries. Each carries a point
 *                      deduction that comes off that cycle's appraisal.
 *   staffAchievements  Recognition, awards and completed training. Each carries a
 *                      bonus point value that is added to that cycle's appraisal.
 *
 * WHY THE POINTS ARE COMPUTED HERE AND NOT IN THE BROWSER
 * The bonus and the deduction change somebody's grade, and the grade drives Part H —
 * increment, counselling, a formal warning. So the caps (5 up, 5 down, per person per
 * cycle) are applied server-side, on the stored register, and the browser is only ever
 * shown the result. A client that miscounts, or is simply out of date, cannot inflate
 * or deflate a score.
 *
 * CONFIDENTIALITY. Appraisals are personal-file records. Every route is gated on the
 * 'perf' access module by web.js, and the verb decides the action needed (see
 * access.requireModule), so a view-only account can read the register but cannot score
 * anybody. Part H is admin-only on top of that: only an unrestricted session (the CNS
 * / administrator) may record the authority's action and lock the form.
 *
 * Collection access is via db.getDbHandle() per call, so every write goes through the
 * instrumented handle and invalidates the shared cache (see server/cache.js).
 */
const { getDbHandle } = require('./db');
const cache = require('./cache');

const APPRAISALS = 'staffAppraisals';
const INCIDENTS = 'staffIncidents';
const ACHIEVEMENTS = 'staffAchievements';
// The separation record. The roster already knows WHO left (staff.former); this holds
// the things HR needs and the roster does not: last working day, separation type, the
// stated reason, the exit-interview note and the clearance checklist. Attrition is
// computed from these, so a leaver with no exit record still counts in the headcount
// maths but contributes no reason/tenure analysis — which is the honest answer.
const EXITS = 'staffExits';
/* The categories an achievement or an incident can be filed under. Shipped with a
   default set (the same list the browser's appraisal-spec.js carries) but EDITABLE BY
   AN ADMINISTRATOR: every hospital classifies conduct a little differently, and a
   category that cannot be added means entries get filed under "Other" and the register
   stops being able to tell anyone what is actually going wrong.

   One document, id 'categories'. Absent (or empty) => the defaults below, so an
   installation that never touches this behaves exactly as it always did. */
const CATEGORIES = 'staffPerfCategories';
const CATEGORY_DOC = 'categories';
const DEFAULT_ACH_CATEGORIES = [
  { id: 'award', label: 'Award / recognition', levels: [['Hospital', 3], ['Department', 2], ['Unit', 1]] },
  { id: 'training', label: 'Training completed', levels: [['International', 3], ['National', 2], ['In-house', 1]] },
  { id: 'presentation', label: 'Presentation / teaching', levels: [['Conference', 3], ['Hospital', 2], ['Unit', 1]] },
  { id: 'improvement', label: 'Quality improvement adopted', levels: [['Hospital-wide', 3], ['Department', 2], ['Unit', 1]] },
  { id: 'appreciation', label: 'Patient / family appreciation', levels: [['Written', 2], ['Verbal', 1]] },
  { id: 'extra', label: 'Extra duty / emergency cover', levels: [['Sustained', 2], ['One-off', 1]] },
];
const DEFAULT_INC_CATEGORIES = [
  { id: 'medication', label: 'Medication error' },
  { id: 'documentation', label: 'Documentation lapse' },
  { id: 'infection', label: 'Infection-control breach' },
  { id: 'attendance', label: 'Attendance / punctuality' },
  { id: 'conduct', label: 'Conduct / communication' },
  { id: 'procedure', label: 'Procedure / protocol deviation' },
];

// Mirrors renderer/unico/appraisal-spec.js. Kept as plain numbers here because the
// server only needs the arithmetic, not the descriptors.
const PARAM_SLS = Array.from({ length: 20 }, (_, i) => i + 1);
const TOTAL_MAX = 100;
const BONUS_CAP = 5;
const PENALTY_CAP = 5;
const STATUSES = ['draft', 'submitted', 'discussed', 'actioned'];

const GRADES = [
  { min: 90, grade: 'A+', rating: 'Outstanding' },
  { min: 80, grade: 'A', rating: 'Very Good' },
  { min: 70, grade: 'B', rating: 'Good' },
  { min: 60, grade: 'C', rating: 'Satisfactory' },
  { min: 50, grade: 'D', rating: 'Needs Improvement' },
  { min: 0, grade: 'E', rating: 'Unsatisfactory' },
];
function gradeFor(pct) {
  const n = Number(pct) || 0;
  for (const g of GRADES) if (n >= g.min) return g;
  return GRADES[GRADES.length - 1];
}

async function col(name) { const db = await getDbHandle(); return db ? db.collection(name) : null; }
function genId(prefix) { return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e8).toString(36); }

// Dev fallback (no MONGODB_URI). The web app always has Mongo.
const mem = { [APPRAISALS]: [], [INCIDENTS]: [], [ACHIEVEMENTS]: [], [EXITS]: [], [CATEGORIES]: [] };

const s = (v, max) => String(v == null ? '' : v).slice(0, max || 400);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const outDoc = (d) => { if (!d) return null; const { _id, ...r } = d; return { id: _id, ...r }; };
const num = (v, lo, hi) => { const n = Number(v); if (!isFinite(n)) return null; return Math.max(lo, Math.min(hi, n)); };
const who = (req) => (req.user && (req.user.name || req.user.sub)) || 'local';

/* ---- scoring ---------------------------------------------------------------- */

// scores: { "1".."20": 1..5 }. Only whole 1-5 values count; a partly-filled draft
// scores what it has, which is what makes the live summary on the form possible.
function tallyScores(scores) {
  const sc = obj(scores);
  let total = 0, rated = 0;
  PARAM_SLS.forEach((sl) => {
    const v = Number(sc[sl] != null ? sc[sl] : sc[String(sl)]);
    if (Number.isInteger(v) && v >= 1 && v <= 5) { total += v; rated++; }
  });
  return { total, rated, complete: rated === PARAM_SLS.length };
}

// The authoritative final mark for one appraisal: parameters + capped bonus - capped
// deduction, clamped to 0..100 so the grade band is always meaningful.
function settle(base, bonus, penalty) {
  const b = Math.min(Math.max(Number(bonus) || 0, 0), BONUS_CAP);
  const p = Math.min(Math.max(Number(penalty) || 0, 0), PENALTY_CAP);
  const score = Math.max(0, Math.min(TOTAL_MAX, (Number(base) || 0) + b - p));
  return { bonus: b, penalty: p, score, ...gradeFor(score) };
}

/* ---- normalisers ------------------------------------------------------------ */

function normAppraisal(input, existing) {
  const i = obj(input);
  const prev = obj(existing);
  const scores = {};
  const inScores = obj(i.scores);
  PARAM_SLS.forEach((sl) => {
    const v = Number(inScores[sl] != null ? inScores[sl] : inScores[String(sl)]);
    if (Number.isInteger(v) && v >= 1 && v <= 5) scores[sl] = v;
  });
  const remarks = {};
  const inRem = obj(i.remarks);
  PARAM_SLS.forEach((sl) => {
    const t = s(inRem[sl] != null ? inRem[sl] : inRem[String(sl)], 600);
    if (t.trim()) remarks[sl] = t;
  });
  const status = STATUSES.indexOf(s(i.status)) >= 0 ? s(i.status) : (prev.status || 'draft');
  return {
    empId: s(i.empId || prev.empId, 40),
    cycleId: s(i.cycleId || prev.cycleId, 40),
    cycleLabel: s(i.cycleLabel || prev.cycleLabel, 80),
    cycleStart: s(i.cycleStart || prev.cycleStart, 20),
    cycleEnd: s(i.cycleEnd || prev.cycleEnd, 20),
    staffName: s(i.staffName || prev.staffName, 120),
    designation: s(i.designation || prev.designation, 120),
    department: s(i.department || prev.department, 120),
    doj: s(i.doj || prev.doj, 20),
    scores,
    remarks,
    status,
    assessorName: s(i.assessorName || prev.assessorName, 120),
    assessorRemarks: s(i.assessorRemarks, 2000),
    strengths: s(i.strengths, 1000),
    development: s(i.development, 1000),
    // Sent by the appraisal form (Part G). Absent from an older client's payload it
    // must keep what is on file rather than silently clearing the meeting date.
    discussedOn: s(i.discussedOn != null ? i.discussedOn : prev.discussedOn, 20),
    acknowledged: !!i.acknowledged,
  };
}

/* WHO THE ENTRY IS ABOUT, recorded so it cannot be lost or mixed up later:
     empId       the employee number - what the appraisal maths matches on
     staffId     the staff RECORD id. Employee numbers are NOT unique in this register
                 (11410 and 11520 each belong to two different people, see
                 staff-roster.js), so the number alone cannot say which colleague an
                 entry belongs to. The record id can, and it is written from the day the
                 entry is filed rather than reconstructed afterwards.
     staffName / department / designation
                 the person AS THEY WERE when it happened. A later transfer or promotion
                 must not rewrite the history of an incident. */
function normIncident(input) {
  const i = obj(input);
  return {
    empId: s(i.empId, 40),
    staffId: s(i.staffId, 40),
    staffName: s(i.staffName, 120),
    department: s(i.department, 120),
    designation: s(i.designation, 120),
    cycleId: s(i.cycleId, 40),
    date: s(i.date, 20),
    category: s(i.category, 80),
    severity: s(i.severity, 40),
    what: s(i.what, 1200),
    action: s(i.action, 400),
    note: s(i.note, 1200),
    points: num(i.points, 0, PENALTY_CAP) || 0,
  };
}

// Same identity block as an incident - see normIncident.
function normAchievement(input) {
  const i = obj(input);
  return {
    empId: s(i.empId, 40),
    staffId: s(i.staffId, 40),
    staffName: s(i.staffName, 120),
    department: s(i.department, 120),
    designation: s(i.designation, 120),
    cycleId: s(i.cycleId, 40),
    date: s(i.date, 20),
    category: s(i.category, 80),
    level: s(i.level, 60),
    what: s(i.what, 1200),
    reward: s(i.reward, 200),
    note: s(i.note, 1200),
    certificate: !!i.certificate,
    points: num(i.points, 0, BONUS_CAP) || 0,
  };
}

/* A saved category list. Deliberately strict: an id that is stable (so entries filed
   under it keep their grouping when the label is reworded), a label, and for an
   achievement the levels that SET THE POINTS. Points are clamped to the cap - a
   category cannot be defined that hands out more than a cycle can carry. */
function slug(v) {
  return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}
function normCategories(input, kind) {
  const cap = kind === 'ach' ? BONUS_CAP : PENALTY_CAP;
  const seen = {};
  return (Array.isArray(input) ? input : []).slice(0, 60).map((raw) => {
    const c = obj(raw);
    const label = s(c.label, 80).trim();
    if (!label) return null;
    // A blank or colliding id would silently merge two categories in the register.
    let id = slug(c.id) || slug(label);
    if (!id) return null;
    while (seen[id]) id += '-2';
    seen[id] = 1;
    const out = { id, label };
    if (kind === 'ach') {
      const levels = (Array.isArray(c.levels) ? c.levels : []).slice(0, 12).map((l) => {
        const arr = Array.isArray(l) ? l : [obj(l).label, obj(l).points];
        const name = s(arr[0], 60).trim();
        const pts = num(arr[1], 0, cap);
        return name ? [name, pts == null ? 1 : Math.round(pts)] : null;
      }).filter(Boolean);
      // Every achievement category must offer at least one level, or it can award nothing.
      out.levels = levels.length ? levels : [['Recorded', 1]];
    }
    return out;
  }).filter(Boolean);
}

// The stored lists, falling back to the shipped defaults. An empty saved list is
// treated as "not configured" rather than "no categories at all", which would leave
// the dialogs with an empty dropdown and no way back.
async function loadCategories() {
  let doc = null;
  try {
    const c = await col(CATEGORIES);
    doc = c ? await c.findOne({ _id: CATEGORY_DOC }) : (mem[CATEGORIES][0] || null);
  } catch (e) { doc = null; }
  const d = obj(doc);
  const ach = normCategories(d.ach, 'ach');
  const inc = normCategories(d.inc, 'inc');
  return {
    ach: ach.length ? ach : DEFAULT_ACH_CATEGORIES,
    inc: inc.length ? inc : DEFAULT_INC_CATEGORIES,
    customised: !!(ach.length || inc.length),
  };
}

const SEPARATION_TYPES = ['Resignation', 'End of contract', 'Retirement', 'Termination', 'Absconded', 'Transfer', 'Other'];

function normExit(input) {
  const i = obj(input);
  const sep = SEPARATION_TYPES.indexOf(s(i.separation)) >= 0 ? s(i.separation) : 'Resignation';
  return {
    empId: s(i.empId, 40),
    staffName: s(i.staffName, 120),
    department: s(i.department, 120),
    designation: s(i.designation, 120),
    doj: s(i.doj, 20),
    noticeDate: s(i.noticeDate, 20),      // when the resignation was received
    lastDay: s(i.lastDay, 20),            // last working day — drives the attrition month
    separation: sep,
    reason: s(i.reason, 200),             // as stated at exit
    interview: s(i.interview, 2000),
    clearance: Array.isArray(i.clearance) ? i.clearance.map((x) => s(x, 60)).slice(0, 20) : [],
    lastGrade: s(i.lastGrade, 4),
    rehire: !!i.rehire,
    note: s(i.note, 1200),
    // The rest of what HR actually files on a separation. All optional: an exit
    // recorded before these existed stays valid and simply carries empty strings.
    handoverTo: s(i.handoverTo, 120),     // who took the work over
    contact: s(i.contact, 120),           // forwarding phone / email
    settlementDate: s(i.settlementDate, 20), // final dues settled on
    noticeServed: s(i.noticeServed, 20),  // 'Full' | 'Partial' | 'None' | ''
  };
}

/* ---- storage ----------------------------------------------------------------- */

async function listAll(name) {
  const c = await col(name);
  if (!c) return mem[name].slice();
  const docs = await c.find({}).sort({ _id: 1 }).toArray();
  return docs.map(outDoc);
}

/* A CACHED read of one register. Opening the module used to mean four full collection
   scans, every single time, for data that changes a few times a day — which is most of
   what "the Performance module is slow to open" was.

   It is VERSION-VALIDATED, not time-based: every write in this file goes through
   getDbHandle(), whose proxy bumps the collection's version before the caller
   continues (server/cache.js). So a saved appraisal, incident or achievement is visible
   on the very next read — a cached copy stamped with an older version is never a hit.
   That is what makes caching safe for a personal-file record.

   Read-modify-write paths pass { fresh: true } and skip the cache on the way in, so an
   edit is never computed from a stale baseline. */
const REGISTER_TTL = 30000;
function listCached(name, opts) {
  if (!process.env.MONGODB_URI) return listAll(name);
  return cache.read(
    'perf:' + name,
    { coll: name, freshMs: REGISTER_TTL, fresh: !!(opts && opts.fresh) },
    () => listAll(name)
  );
}

async function upsert(name, id, doc) {
  const c = await col(name);
  if (!c) {
    const idx = mem[name].findIndex((x) => x.id === id);
    const rec = Object.assign({ id }, doc);
    if (idx >= 0) mem[name][idx] = Object.assign({}, mem[name][idx], rec); else mem[name].push(rec);
    return mem[name].find((x) => x.id === id);
  }
  await c.updateOne({ _id: id }, { $set: doc }, { upsert: true });
  return outDoc(await c.findOne({ _id: id }));
}

async function removeOne(name, id) {
  const c = await col(name);
  if (!c) { const n = mem[name].length; mem[name] = mem[name].filter((x) => x.id !== id); return n !== mem[name].length; }
  const r = await c.deleteOne({ _id: String(id) });
  return r.deletedCount > 0;
}

/* ---- the points a person carries in one cycle ------------------------------- */

// Summed from the REGISTERS, never from anything the client sends, and capped here.
async function findEntry(name, id) {
  const c = await col(name);
  return c ? outDoc(await c.findOne({ _id: String(id) })) : ((mem[name] || []).find((x) => x.id === id) || null);
}
// Has the authority already filed (actioned) this person's appraisal for that window?
async function isFiled(empId, cycleId) {
  if (!empId || !cycleId) return false;
  const a = await findEntry(APPRAISALS, 'apr-' + empId + '-' + cycleId);
  return !!(a && a.status === 'actioned');
}
const FILED_MSG = 'That appraisal window is already filed (Part H recorded). Reopen the appraisal before changing its registers.';

async function pointsFor(empId, cycleId) {
  // Deliberately uncached: this is the arithmetic that sets somebody's grade, and it
  // runs on the write paths, where a stale baseline could file the wrong score.
  const [inc, ach] = await Promise.all([listAll(INCIDENTS), listAll(ACHIEVEMENTS)]);
  const mine = (list) => list.filter((x) => x.empId === empId && (!cycleId || x.cycleId === cycleId));
  const penalty = mine(inc).reduce((t, x) => t + (Number(x.points) || 0), 0);
  const bonus = mine(ach).reduce((t, x) => t + (Number(x.points) || 0), 0);
  return { rawBonus: bonus, rawPenalty: penalty, bonus: Math.min(bonus, BONUS_CAP), penalty: Math.min(penalty, PENALTY_CAP) };
}

// Attach the settled score to an appraisal document for the client.
function decorate(a, pts) {
  const t = tallyScores(a.scores);
  // A FILED (actioned) appraisal shows the score it was filed with. Recomputed from the
  // live incident / achievement registers, a later entry changed the grade on a form
  // whose Part H action had already been taken on the old one.
  const f = a.status === 'actioned' && a.filed && typeof a.filed === 'object' ? a.filed : null;
  if (f) {
    return Object.assign({}, a, {
      base: f.base, rated: t.rated, complete: t.complete, rawBonus: f.rawBonus, rawPenalty: f.rawPenalty,
      bonus: f.bonus, penalty: f.penalty, score: f.score, grade: f.grade, rating: f.rating,
    });
  }
  const settled = settle(t.total, pts.bonus, pts.penalty);
  return Object.assign({}, a, {
    base: t.total,
    rated: t.rated,
    complete: t.complete,
    rawBonus: pts.rawBonus,
    rawPenalty: pts.rawPenalty,
    bonus: settled.bonus,
    penalty: settled.penalty,
    score: settled.score,
    grade: settled.grade,
    rating: settled.rating,
  });
}

/* ---- routes ------------------------------------------------------------------ */

function mount(app, opts) {
  const guard = (opts && opts.requireApi) || function (req, res, next) { next(); };
  // Part H changes somebody's employment standing. Only an unrestricted session (the
  // CNS / administrator) may record it, whatever the module level says.
  const adminOnly = (req, res, next) => {
    if (req.access && !req.access.unrestricted) return res.status(403).json({ ok: false, error: 'Chief Nursing Superintendent access required.' });
    next();
  };

  // Everything the module needs in ONE call: the page opens with a single request
  // rather than three, which matters on a cold serverless instance.
  app.get('/api/performance', guard, async (req, res) => {
    try {
      const [appraisals, incidents, achievements, exits, categories] = await Promise.all([
        listCached(APPRAISALS), listCached(INCIDENTS), listCached(ACHIEVEMENTS), listCached(EXITS), loadCategories(),
      ]);
      // Settle every appraisal against its own cycle's registers.
      const byKey = {};
      incidents.forEach((x) => { const k = x.empId + '|' + x.cycleId; (byKey[k] = byKey[k] || { b: 0, p: 0 }).p += Number(x.points) || 0; });
      achievements.forEach((x) => { const k = x.empId + '|' + x.cycleId; (byKey[k] = byKey[k] || { b: 0, p: 0 }).b += Number(x.points) || 0; });
      const out = appraisals.map((a) => {
        const k = a.empId + '|' + a.cycleId;
        const raw = byKey[k] || { b: 0, p: 0 };
        return decorate(a, { rawBonus: raw.b, rawPenalty: raw.p, bonus: Math.min(raw.b, BONUS_CAP), penalty: Math.min(raw.p, PENALTY_CAP) });
      });
      res.json({ ok: true, appraisals: out, incidents, achievements, exits, categories, caps: { bonus: BONUS_CAP, penalty: PENALTY_CAP }, separationTypes: SEPARATION_TYPES });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not load performance records.' }); }
  });

  // Create or update one appraisal. Keyed by employee + cycle so a second "start
  // appraisal" for the same window edits the existing form instead of producing a
  // duplicate record in somebody's personal file.
  app.put('/api/performance/appraisals', guard, async (req, res) => {
    try {
      const b = obj(req.body);
      const empId = s(b.empId, 40), cycleId = s(b.cycleId, 40);
      if (!empId || !cycleId) return res.status(400).json({ ok: false, error: 'Employee and appraisal cycle are required.' });
      const id = 'apr-' + empId + '-' + cycleId;
      const c = await col(APPRAISALS);
      const existing = c ? outDoc(await c.findOne({ _id: id })) : mem[APPRAISALS].find((x) => x.id === id);
      if (existing && existing.status === 'actioned') {
        return res.status(409).json({ ok: false, error: 'This appraisal is locked: the authority has already recorded its action.' });
      }
      const doc = normAppraisal(b, existing);
      doc.updatedAt = Date.now();
      doc.updatedBy = who(req);
      if (!existing) { doc.createdAt = Date.now(); doc.createdBy = who(req); }
      const saved = await upsert(APPRAISALS, id, doc);
      const pts = await pointsFor(empId, cycleId);
      res.json({ ok: true, appraisal: decorate(saved, pts) });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not save the appraisal.' }); }
  });

  // Part H — the authority's action, and the lock that files the form.
  app.post('/api/performance/appraisals/:id/action', guard, adminOnly, async (req, res) => {
    try {
      const id = s(req.params.id, 80);
      const b = obj(req.body);
      const c = await col(APPRAISALS);
      const existing = c ? outDoc(await c.findOne({ _id: id })) : mem[APPRAISALS].find((x) => x.id === id);
      if (!existing) return res.status(404).json({ ok: false, error: 'Appraisal not found.' });
      const t = tallyScores(existing.scores);
      if (!t.complete) return res.status(400).json({ ok: false, error: 'Every one of the 20 parameters must be rated before the authority can act.' });
      // The score the action is taken on, frozen onto the filed form.
      const snap = decorate(existing, await pointsFor(existing.empId, existing.cycleId));
      const patch = {
        filed: { base: snap.base, rawBonus: snap.rawBonus, rawPenalty: snap.rawPenalty, bonus: snap.bonus,
          penalty: snap.penalty, score: snap.score, grade: snap.grade, rating: snap.rating, at: Date.now() },
        actions: Array.isArray(b.actions) ? b.actions.map((x) => s(x, 60)).slice(0, 12) : [],
        authorityRemarks: s(b.authorityRemarks, 2000),
        nextReview: s(b.nextReview, 20),
        memoNo: s(b.memoNo, 60),
        status: 'actioned',
        actionedBy: who(req),
        actionedAt: Date.now(),
      };
      const saved = await upsert(APPRAISALS, id, patch);
      const pts = await pointsFor(saved.empId, saved.cycleId);
      res.json({ ok: true, appraisal: decorate(saved, pts) });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not record the action.' }); }
  });

  /* Edit the category lists. ADMIN ONLY: these decide how every achievement and every
     incident in the hospital is classified, and a renamed or deleted category changes
     what the register reports. Entries already filed keep the category TEXT they were
     saved with, so removing a category never rewrites history - it only stops the
     category being offered for new entries. */
  app.put('/api/performance/categories', guard, adminOnly, async (req, res) => {
    try {
      const b = obj(req.body);
      const ach = normCategories(b.ach, 'ach');
      const inc = normCategories(b.inc, 'inc');
      if (!ach.length) return res.status(400).json({ ok: false, error: 'Keep at least one achievement category.' });
      if (!inc.length) return res.status(400).json({ ok: false, error: 'Keep at least one incident category.' });
      await upsert(CATEGORIES, CATEGORY_DOC, { ach, inc, updatedBy: who(req), updatedAt: Date.now() });
      res.json({ ok: true, categories: await loadCategories() });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not save the categories.' }); }
  });

  // Reopen a filed appraisal (correcting a mistake after locking). Admin only, and
  // deliberately audited — this un-files a personal-record document.
  app.post('/api/performance/appraisals/:id/reopen', guard, adminOnly, async (req, res) => {
    try {
      const id = s(req.params.id, 80);
      const saved = await upsert(APPRAISALS, id, { status: 'discussed', reopenedBy: who(req), reopenedAt: Date.now() });
      if (!saved) return res.status(404).json({ ok: false, error: 'Appraisal not found.' });
      const pts = await pointsFor(saved.empId, saved.cycleId);
      res.json({ ok: true, appraisal: decorate(saved, pts) });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not reopen the appraisal.' }); }
  });

  // --- incident register ---
  app.post('/api/performance/incidents', guard, async (req, res) => {
    try {
      const doc = normIncident(req.body);
      if (!doc.empId) return res.status(400).json({ ok: false, error: 'A staff member is required.' });
      if (!doc.what.trim()) return res.status(400).json({ ok: false, error: 'Describe what happened.' });
      if (await isFiled(doc.empId, doc.cycleId)) return res.status(409).json({ ok: false, error: FILED_MSG });
      doc.createdAt = Date.now(); doc.createdBy = who(req);
      const saved = await upsert(INCIDENTS, genId('inc'), doc);
      res.json({ ok: true, incident: saved, points: await pointsFor(doc.empId, doc.cycleId) });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not record the incident.' }); }
  });
  app.delete('/api/performance/incidents/:id', guard, async (req, res) => {
    try {
      const entry = await findEntry(INCIDENTS, s(req.params.id, 80));
      if (entry && await isFiled(entry.empId, entry.cycleId)) return res.status(409).json({ ok: false, error: FILED_MSG });
      const ok = await removeOne(INCIDENTS, s(req.params.id, 80));
      res.json({ ok, error: ok ? undefined : 'Entry not found.' });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not remove the entry.' }); }
  });

  // --- achievement register ---
  app.post('/api/performance/achievements', guard, async (req, res) => {
    try {
      const doc = normAchievement(req.body);
      if (!doc.empId) return res.status(400).json({ ok: false, error: 'A staff member is required.' });
      if (!doc.what.trim()) return res.status(400).json({ ok: false, error: 'Describe the achievement.' });
      if (await isFiled(doc.empId, doc.cycleId)) return res.status(409).json({ ok: false, error: FILED_MSG });
      doc.createdAt = Date.now(); doc.createdBy = who(req);
      const saved = await upsert(ACHIEVEMENTS, genId('ach'), doc);
      res.json({ ok: true, achievement: saved, points: await pointsFor(doc.empId, doc.cycleId) });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not record the achievement.' }); }
  });
  app.delete('/api/performance/achievements/:id', guard, async (req, res) => {
    try {
      const entry = await findEntry(ACHIEVEMENTS, s(req.params.id, 80));
      if (entry && await isFiled(entry.empId, entry.cycleId)) return res.status(409).json({ ok: false, error: FILED_MSG });
      const ok = await removeOne(ACHIEVEMENTS, s(req.params.id, 80));
      res.json({ ok, error: ok ? undefined : 'Entry not found.' });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not remove the entry.' }); }
  });
  // --- exit / separation register ---
  app.post('/api/performance/exits', guard, async (req, res) => {
    try {
      const doc = normExit(req.body);
      if (!doc.empId) return res.status(400).json({ ok: false, error: 'A staff member is required.' });
      if (!doc.lastDay) return res.status(400).json({ ok: false, error: 'The last working day is required — the attrition month is taken from it.' });
      doc.createdAt = Date.now(); doc.createdBy = who(req);
      const saved = await upsert(EXITS, 'exit-' + doc.empId, doc);   // one exit record per person
      res.json({ ok: true, exit: saved });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not record the exit.' }); }
  });
  app.delete('/api/performance/exits/:id', guard, async (req, res) => {
    try {
      const ok = await removeOne(EXITS, s(req.params.id, 80));
      res.json({ ok, error: ok ? undefined : 'Record not found.' });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not remove the record.' }); }
  });
}

module.exports = {
  mount, APPRAISALS, INCIDENTS, ACHIEVEMENTS, EXITS, SEPARATION_TYPES,
  tallyScores, settle, gradeFor, pointsFor,
  BONUS_CAP, PENALTY_CAP, TOTAL_MAX, STATUSES,
};
