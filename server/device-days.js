/* Device Days — the daily "Record of Device Insertion Days", sent online per department.
 *
 * One document per department per day in `deviceDays` (_id = '<deptId>:<YYYY-MM-DD>'):
 * time, total patients and the four device counts, a review status
 * (draft → submitted → approved | returned) and an append-only history.
 * The administrator decides per department in `deviceDaysConfig` whether it is tracked
 * and how often its rows are sent (daily / weekly / monthly); the due/missed rule is
 * renderer/unico/device-days-core.js, shared with the browser.
 *
 * Access is module 'devdays', per person: View = see the sheet and summary, Add = enter and
 * send, Edit = review (approve / return) and correct, Delete = remove a day (soft), Print.
 * Which departments: users.deviceDepartments ('*' = all; access.deviceDeptIds). Nobody
 * approves their own submission except an Administrator. Nothing is ever hard-deleted.
 */
const access = require('./access');
const deptmap = require('./deptmap');
const activity = require('./activity-log');
const { getDbHandle, getDepartments } = require('./db');
const DD = require('../renderer/unico/device-days-core.js');

const COLL = 'deviceDays';
const CFG_COLL = 'deviceDaysConfig';
const STATUSES = ['draft', 'submitted', 'approved', 'returned'];
const MISSING_LOOKBACK = 62; // days the badge looks back over

// In-memory fallback when there is no database (the local seed preview only).
const mem = { rows: new Map(), cfg: { _id: 'config', depts: {} } };

async function db() { try { return await getDbHandle(); } catch (e) { return null; } }
let indexed = false;
async function col() {
  const d = await db();
  if (!d) return null;
  const c = d.collection(COLL);
  if (!indexed) {
    indexed = true;
    c.createIndex({ deptId: 1, date: 1 }).catch(() => {});
    c.createIndex({ status: 1, date: 1 }).catch(() => {});
  }
  return c;
}

/* ---------------------------------------------------------------- storage --- */

// Rows matching { depts (null = all), from, to, statuses }, never the removed ones.
async function findRows(q) {
  const c = await col();
  if (!c) {
    return [...mem.rows.values()].filter((r) => !r.removedAt
      && (!q.depts || q.depts.indexOf(r.deptId) >= 0)
      && (!q.from || r.date >= q.from) && (!q.to || r.date <= q.to)
      && (!q.statuses || q.statuses.indexOf(r.status) >= 0)).map((r) => Object.assign({}, r));
  }
  const m = { removedAt: null };
  if (q.depts) m.deptId = { $in: q.depts };
  if (q.from || q.to) { m.date = {}; if (q.from) m.date.$gte = q.from; if (q.to) m.date.$lte = q.to; }
  if (q.statuses) m.status = { $in: q.statuses };
  return c.find(m).sort({ deptId: 1, date: 1 }).toArray();
}
async function getRow(id) {
  const c = await col();
  if (!c) { const r = mem.rows.get(id); return r ? Object.assign({}, r) : null; }
  return c.findOne({ _id: id });
}
// Write `doc` only if the stored copy still carries `expectUpdatedAt` (null = must not exist).
async function putRow(doc, expectUpdatedAt) {
  const c = await col();
  if (!c) {
    const cur = mem.rows.get(doc._id);
    if ((cur ? cur.updatedAt : null) !== (expectUpdatedAt == null ? null : expectUpdatedAt)) return false;
    mem.rows.set(doc._id, Object.assign({}, doc));
    return true;
  }
  if (expectUpdatedAt == null) {
    try { await c.insertOne(doc); return true; } catch (e) { if (e && e.code === 11000) return false; throw e; }
  }
  const { _id, ...rest } = doc;
  const r = await c.replaceOne({ _id, updatedAt: expectUpdatedAt }, rest);
  return r.matchedCount === 1;
}

async function getConfig() {
  const d = await db();
  if (!d) return mem.cfg;
  return (await d.collection(CFG_COLL).findOne({ _id: 'config' })) || { _id: 'config', depts: {} };
}
async function saveConfig(cfg) {
  const d = await db();
  if (!d) { mem.cfg = cfg; return; }
  await d.collection(CFG_COLL).replaceOne({ _id: 'config' }, cfg, { upsert: true });
}
const cfgFor = (cfg, deptId) => DD.cfgOf((cfg.depts || {})[deptId]);

/* ------------------------------------------------------------ departments --- */

async function allDepts() {
  const [map, depts] = await Promise.all([deptmap.get().catch(() => null), getDepartments().catch(() => [])]);
  const byId = Object.assign({}, ...(depts || []).filter((d) => d && d.id).map((d) => ({ [d.id]: { id: d.id, name: d.name } })), (map && map.byId) || {});
  return Object.values(byId).map((d) => ({ id: String(d.id), name: d.name || d.id, qualityOnly: !!d.qualityOnly }))
    .sort((x, y) => String(x.name).localeCompare(String(y.name)));
}
// The tracked departments this person works with, with their settings.
async function myDepts(a, cfg) {
  const ids = access.deviceDeptIds(a);
  const list = await allDepts();
  return list.filter((d) => cfgFor(cfg, d.id).tracked && (ids === null || ids.indexOf(d.id) >= 0))
    .map((d) => Object.assign({ id: d.id, name: d.name }, { cfg: cfgFor(cfg, d.id) }));
}

/* ---------------------------------------------------------------- helpers --- */

const clean = (r) => { if (!r) return null; const { _id, history, ...rest } = r; return Object.assign({ id: _id }, rest, { history: (history || []).slice(-20) }); };
const actor = (req, a) => (a && a.username) || (req.user && req.user.sub) || 'local';
const nameOf = (req, a) => (a && a.name) || (req.user && req.user.name) || actor(req, a);
const num = (v) => (v === '' || v == null ? v : Number(v));
const pickRow = (b) => {
  const out = { time: String(b.time || '').slice(0, 5) };
  DD.FIELDS.forEach((f) => { out[f.id] = num(b[f.id]); });
  return out;
};
const changesOf = (before, after) => DD.FIELDS.concat([{ id: 'time' }]).filter((f) => before && String(before[f.id]) !== String(after[f.id]))
  .map((f) => f.id + ': ' + before[f.id] + ' → ' + after[f.id]).join(', ');

// Day states for every day of a month, plus totals.
function monthView(ym, rows, cfg, now) {
  const byDate = {};
  rows.forEach((r) => { byDate[r.date] = r; });
  const days = DD.monthDays(ym).map((date) => {
    const r = byDate[date] || null;
    return { date, state: DD.dayState(date, r, cfg, now), period: DD.periodOf(date, cfg), due: DD.dueOf(date, cfg), row: clean(r) };
  });
  return { days, all: DD.totals(rows), approved: DD.totals(rows, ['approved']) };
}

/* ------------------------------------------------------------------ mount --- */

function mount(app, opts) {
  const guard = (opts && opts.requireApi) || [];
  const now = (opts && opts.now) || (() => Date.now());

  const resolve = async (req, res, action) => {
    const a = req.access || await access.forRequest(req);
    if (!a) { res.status(401).json({ ok: false, error: 'Not authenticated.' }); return null; }
    req.access = a;
    if (action && !access.can(a, 'devdays', action)) {
      const what = { add: 'enter or send device days', edit: 'review or correct device days', delete: 'remove device days', print: 'print device days' }[action] || 'open Device Days';
      res.status(403).json({ ok: false, error: 'You do not have permission to ' + what + '.' });
      return null;
    }
    return a;
  };
  const inScope = (a, deptId) => { const ids = access.deviceDeptIds(a); return ids === null || ids.indexOf(String(deptId)) >= 0; };
  const fail = (res, e, msg) => { console.error('[device-days]', e && e.message); res.status(500).json({ ok: false, error: msg }); };
  const rights = (a) => ({
    canAdd: access.can(a, 'devdays', 'add'), canReview: access.can(a, 'devdays', 'edit'),
    canDelete: access.can(a, 'devdays', 'delete'), canPrint: access.can(a, 'devdays', 'print'),
    isAdmin: !!a.unrestricted,
  });

  app.get('/api/device-days/meta', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      const cfg = await getConfig();
      res.json({ ok: true, departments: await myDepts(a, cfg), today: DD.hospitalNow(now()).date, user: actor(req, a), ...rights(a) });
    } catch (e) { fail(res, e, 'Could not load Device Days.'); }
  });

  // One department's month: every day with its state, the rows and the totals.
  app.get('/api/device-days', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      const deptId = String(req.query.dept || '');
      const ym = DD.isMonth(req.query.month) ? req.query.month : DD.hospitalNow(now()).date.slice(0, 7);
      if (!inScope(a, deptId)) return res.status(403).json({ ok: false, error: 'This department is not one of yours.' });
      const cfg = cfgFor(await getConfig(), deptId);
      const rows = await findRows({ depts: [deptId], from: ym + '-01', to: ym + '-31' });
      res.json({ ok: true, dept: deptId, month: ym, cfg, today: DD.hospitalNow(now()).date, ...monthView(ym, rows, cfg, now()) });
    } catch (e) { fail(res, e, 'Could not load the month.'); }
  });

  // Save one day (a draft, a returned row being fixed, or a reviewer's correction).
  app.put('/api/device-days/:dept/:date', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, null); if (!a) return;
      const deptId = String(req.params.dept || ''), date = String(req.params.date || '');
      if (!DD.isDate(date)) return res.status(400).json({ ok: false, error: 'Invalid date.' });
      if (!inScope(a, deptId)) return res.status(403).json({ ok: false, error: 'This department is not one of yours.' });
      const cfg = cfgFor(await getConfig(), deptId);
      if (!cfg.tracked) return res.status(400).json({ ok: false, error: 'This department is not set up for Device Days.' });
      if (date > DD.hospitalNow(now()).date) return res.status(400).json({ ok: false, error: 'You cannot enter a day that has not come yet.' });
      const b = (req.body && typeof req.body === 'object') ? req.body : {};
      const vals = pickRow(b);
      if (!vals.time) vals.time = cfg.census || '08:00';
      const err = DD.validateRow(vals);
      if (err) return res.status(400).json({ ok: false, error: err });

      const id = deptId + ':' + date;
      const cur = await getRow(id);
      const live = cur && !cur.removedAt ? cur : null;
      const locked = live && (live.status === 'submitted' || live.status === 'approved');
      const need = locked ? 'edit' : 'add';
      if (!access.can(a, 'devdays', need) && !(need === 'add' && access.can(a, 'devdays', 'edit'))) {
        return res.status(403).json({ ok: false, error: locked ? 'This day has been sent. Only a reviewer can correct it.' : 'You do not have permission to enter device days.' });
      }
      const base = b.baseUpdatedAt == null ? null : Number(b.baseUpdatedAt);
      if (live && base != null && live.updatedAt !== base) return res.status(409).json({ ok: false, error: 'Someone else changed this day. Reload to see their version.', row: clean(live) });

      const t = now(), who = actor(req, a);
      const changes = changesOf(live, vals);
      if (live && !changes) return res.json({ ok: true, row: clean(live), unchanged: true });
      const doc = Object.assign({}, cur || {}, vals, {
        _id: id, deptId, date,
        status: locked ? 'submitted' : (live && live.status === 'returned' ? 'returned' : 'draft'),
        enteredBy: (live && live.enteredBy) || who, enteredAt: (live && live.enteredAt) || t,
        updatedBy: who, updatedAt: t,
      });
      delete doc.removedAt; delete doc.removedBy;
      if (locked) { doc.reviewedBy = null; doc.reviewedAt = null; }
      doc.history = ((cur && cur.history) || []).concat([{ at: t, by: who, action: !live ? (cur ? 'restore' : 'create') : (locked ? 'correct' : 'edit'), changes: changes || 'new' }]).slice(-100);
      const ok = await putRow(doc, cur ? cur.updatedAt : null);
      if (!ok) return res.status(409).json({ ok: false, error: 'Someone else changed this day. Reload to see their version.' });
      if (locked) activity.log(req, 'devdays_edit', { target: id, detail: (live.status === 'approved' ? 'approved row corrected, back to review · ' : '') + changes });
      res.json({ ok: true, row: clean(doc) });
    } catch (e) { fail(res, e, 'Could not save the day.'); }
  });

  // Send every saved, unsent row between from..to (one department).
  app.post('/api/device-days/submit', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'add'); if (!a) return;
      const b = (req.body && typeof req.body === 'object') ? req.body : {};
      const deptId = String(b.dept || ''), from = String(b.from || ''), to = String(b.to || '');
      if (!DD.isDate(from) || !DD.isDate(to) || from > to) return res.status(400).json({ ok: false, error: 'Choose the days to send.' });
      if (!inScope(a, deptId)) return res.status(403).json({ ok: false, error: 'This department is not one of yours.' });
      const cfg = cfgFor(await getConfig(), deptId);
      if (!cfg.tracked) return res.status(400).json({ ok: false, error: 'This department is not set up for Device Days.' });
      const today = DD.hospitalNow(now()).date;
      const rows = (await findRows({ depts: [deptId], from, to: to > today ? today : to, statuses: ['draft', 'returned'] }));
      if (!rows.length) return res.status(400).json({ ok: false, error: 'There is nothing new to send for these days.' });
      const t = now(), who = actor(req, a);
      let sent = 0;
      for (const r of rows) {
        const late = DD.dayState(r.date, Object.assign({}, r, { status: 'draft' }), cfg, t) === 'missing';
        const doc = Object.assign({}, r, {
          status: 'submitted', periodKey: DD.periodOf(r.date, cfg).key, late,
          submittedBy: who, submittedName: nameOf(req, a), submittedAt: t, returnReason: r.status === 'returned' ? r.returnReason : null,
          reviewedBy: null, reviewedAt: null, updatedAt: t, updatedBy: who,
          history: (r.history || []).concat([{ at: t, by: who, action: r.status === 'returned' ? 'resend' : 'submit' }]).slice(-100),
        });
        if (await putRow(doc, r.updatedAt)) sent++;
      }
      activity.log(req, 'devdays_submit', { target: deptId, detail: sent + ' day(s) · ' + (from === to ? from : from + ' → ' + to) });
      res.json({ ok: true, sent, skipped: rows.length - sent });
    } catch (e) { fail(res, e, 'Could not send the days.'); }
  });

  // Review queue: submitted rows in my departments.
  app.get('/api/device-days/review', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'edit'); if (!a) return;
      const cfg = await getConfig();
      const depts = await myDepts(a, cfg);
      const rows = await findRows({ depts: depts.map((d) => d.id), statuses: ['submitted'] });
      res.json({ ok: true, departments: depts, rows: rows.map(clean), me: actor(req, a), isAdmin: !!a.unrestricted });
    } catch (e) { fail(res, e, 'Could not load the review queue.'); }
  });

  app.post('/api/device-days/review', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'edit'); if (!a) return;
      const b = (req.body && typeof req.body === 'object') ? req.body : {};
      const action = b.action === 'return' ? 'return' : b.action === 'approve' ? 'approve' : null;
      const ids = Array.isArray(b.ids) ? b.ids.map(String).slice(0, 400) : [];
      const reason = String(b.reason || '').trim().slice(0, 500);
      if (!action || !ids.length) return res.status(400).json({ ok: false, error: 'Choose the days and an action.' });
      if (action === 'return' && !reason) return res.status(400).json({ ok: false, error: 'Write why the days are returned.' });
      const t = now(), who = actor(req, a);
      let done = 0; const skipped = [];
      for (const id of ids) {
        const r = await getRow(id);
        if (!r || r.removedAt || r.status !== 'submitted') { skipped.push(id + ': not waiting for review'); continue; }
        if (!inScope(a, r.deptId)) { skipped.push(id + ': not your department'); continue; }
        if (action === 'approve' && !a.unrestricted && r.submittedBy === who) { skipped.push(id + ': you sent it yourself'); continue; }
        const doc = Object.assign({}, r, {
          status: action === 'approve' ? 'approved' : 'returned',
          returnReason: action === 'return' ? reason : null,
          reviewedBy: who, reviewedName: nameOf(req, a), reviewedAt: t, updatedAt: t, updatedBy: who,
          history: (r.history || []).concat([{ at: t, by: who, action, changes: action === 'return' ? reason : '' }]).slice(-100),
        });
        if (await putRow(doc, r.updatedAt)) done++; else skipped.push(id + ': changed meanwhile');
      }
      if (done) activity.log(req, action === 'approve' ? 'devdays_approve' : 'devdays_return', { target: [...new Set(ids.map((x) => x.split(':')[0]))].join(', '), detail: done + ' day(s)' + (reason ? ' · ' + reason : '') });
      res.json({ ok: true, done, skipped });
    } catch (e) { fail(res, e, 'Could not record the review.'); }
  });

  // Remove a day (soft: the document stays with removedAt, and saving the day again restores it).
  app.delete('/api/device-days/:dept/:date', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'delete'); if (!a) return;
      const deptId = String(req.params.dept || ''), date = String(req.params.date || '');
      if (!inScope(a, deptId)) return res.status(403).json({ ok: false, error: 'This department is not one of yours.' });
      const id = deptId + ':' + date;
      const r = await getRow(id);
      if (!r || r.removedAt) return res.status(404).json({ ok: false, error: 'Nothing to remove for this day.' });
      const t = now(), who = actor(req, a);
      const doc = Object.assign({}, r, { removedAt: t, removedBy: who, updatedAt: t, history: (r.history || []).concat([{ at: t, by: who, action: 'remove', changes: r.status }]).slice(-100) });
      if (!(await putRow(doc, r.updatedAt))) return res.status(409).json({ ok: false, error: 'Someone else changed this day. Reload and try again.' });
      activity.log(req, 'devdays_delete', { target: id, detail: 'was ' + r.status });
      res.json({ ok: true });
    } catch (e) { fail(res, e, 'Could not remove the day.'); }
  });

  // Approved totals per department per month, with the days still missing / waiting.
  app.get('/api/device-days/summary', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      const today = DD.hospitalNow(now()).date;
      const to = DD.isMonth(req.query.to) ? req.query.to : today.slice(0, 7);
      let from = DD.isMonth(req.query.from) ? req.query.from : to.slice(0, 4) + '-01';
      if (from > to) from = to;
      const months = [];
      for (let m = from; m <= to && months.length < 36;) { months.push(m); const y = +m.slice(0, 4), mo = +m.slice(5, 7); m = mo === 12 ? (y + 1) + '-01' : y + '-' + String(mo + 1).padStart(2, '0'); }
      const cfg = await getConfig();
      let depts = await myDepts(a, cfg);
      if (req.query.dept) depts = depts.filter((d) => d.id === String(req.query.dept));
      const rows = await findRows({ depts: depts.map((d) => d.id), from: from + '-01', to: to + '-31' });
      const out = depts.map((d) => {
        const mine = rows.filter((r) => r.deptId === d.id);
        return {
          id: d.id, name: d.name, frequency: d.cfg.frequency,
          months: months.map((ym) => {
            const mr = mine.filter((r) => r.date.slice(0, 7) === ym);
            const v = monthView(ym, mr, d.cfg, now());
            const count = (s) => v.days.filter((x) => x.state === s).length;
            return { month: ym, approved: v.approved, missing: count('missing'), submitted: count('submitted'), returned: count('returned'), open: count('open'),
              due: v.days.filter((x) => x.state !== 'future' && x.state !== 'not-due').length,
              strip: v.days.map((x) => x.state) };
          }),
        };
      });
      res.json({ ok: true, from, to, months, departments: out });
    } catch (e) { fail(res, e, 'Could not build the summary.'); }
  });

  // What needs attention: missed / returned days in my departments, and (reviewers) days waiting.
  app.get('/api/device-days/missing', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      const cfg = await getConfig();
      const depts = await myDepts(a, cfg);
      if (!depts.length) return res.json({ ok: true, total: 0, departments: [], pendingReview: 0 });
      const t = now(), today = DD.hospitalNow(t).date, from = DD.addDays(today, -MISSING_LOOKBACK);
      const rows = await findRows({ depts: depts.map((d) => d.id), from, to: today });
      const byKey = {}; rows.forEach((r) => { byKey[r.deptId + ':' + r.date] = r; });
      const canAct = access.can(a, 'devdays', 'add');
      const out = depts.map((d) => {
        const missing = [], returned = [];
        for (let day = d.cfg.startDate && d.cfg.startDate > from ? d.cfg.startDate : from; day <= today; day = DD.addDays(day, 1)) {
          const s = DD.dayState(day, byKey[d.id + ':' + day], d.cfg, t);
          if (s === 'missing') missing.push(day); else if (s === 'returned') returned.push(day);
        }
        // Weekly / monthly departments owe one sending per period: count those, not each day.
        const periods = [];
        missing.forEach((day) => { const p = DD.periodOf(day, d.cfg); if (!periods.some((x) => x.key === p.key)) periods.push({ key: p.key, label: p.label }); });
        return { id: d.id, name: d.name, frequency: d.cfg.frequency, missing, missedPeriods: periods, returned };
      }).filter((d) => d.missing.length || d.returned.length);
      let pendingReview = 0;
      if (access.can(a, 'devdays', 'edit')) {
        const me = actor(req, a);
        pendingReview = (await findRows({ depts: depts.map((d) => d.id), statuses: ['submitted'] })).filter((r) => a.unrestricted || r.submittedBy !== me).length;
      }
      const total = canAct ? out.reduce((s, d) => s + d.missedPeriods.length + d.returned.length, 0) : 0;
      res.json({ ok: true, total, departments: out, pendingReview });
    } catch (e) { fail(res, e, 'Could not check for missed days.'); }
  });

  // Settings: which departments are tracked, how often they send, from when, cut-off time.
  app.get('/api/device-days/config', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      if (!a.unrestricted) return res.status(403).json({ ok: false, error: 'Only an administrator can change Device Days settings.' });
      const cfg = await getConfig();
      const list = await allDepts();
      res.json({ ok: true, departments: list.map((d) => ({ id: d.id, name: d.name, cfg: cfgFor(cfg, d.id) })) });
    } catch (e) { fail(res, e, 'Could not load the settings.'); }
  });

  app.put('/api/device-days/config', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      if (!a.unrestricted) return res.status(403).json({ ok: false, error: 'Only an administrator can change Device Days settings.' });
      const b = (req.body && typeof req.body === 'object' && req.body.depts && typeof req.body.depts === 'object') ? req.body.depts : null;
      if (!b) return res.status(400).json({ ok: false, error: 'Nothing to save.' });
      const cfg = await getConfig();
      const depts = Object.assign({}, cfg.depts || {});
      const changed = [];
      Object.keys(b).slice(0, 300).forEach((id) => {
        const v = b[id] || {};
        const next = {
          tracked: v.tracked === true,
          frequency: DD.FREQS.indexOf(v.frequency) >= 0 ? v.frequency : 'daily',
          startDate: DD.isDate(v.startDate) ? v.startDate : '',
          cutoff: /^([01]\d|2[0-3]):[0-5]\d$/.test(v.cutoff || '') ? v.cutoff : '10:00',
          census: /^([01]\d|2[0-3]):[0-5]\d$/.test(v.census || '') ? v.census : '08:00',
          weekStart: Number.isInteger(+v.weekStart) && +v.weekStart >= 0 && +v.weekStart <= 6 ? +v.weekStart : 6,
        };
        if (JSON.stringify(depts[id] || null) !== JSON.stringify(next)) { changed.push(id + (next.tracked ? ' ' + next.frequency : ' off')); depts[String(id).slice(0, 60)] = next; }
      });
      await saveConfig({ _id: 'config', depts, updatedAt: now(), updatedBy: actor(req, a) });
      if (changed.length) activity.log(req, 'devdays_config', { target: 'Device Days', detail: changed.join(', ').slice(0, 900) });
      res.json({ ok: true, changed: changed.length });
    } catch (e) { fail(res, e, 'Could not save the settings.'); }
  });

  // Approved device days for one department-month — the quality form's suggested denominator.
  // Anyone who may enter quality data may ask (it is one number, the department's own).
  app.get('/api/device-days/suggest', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, null); if (!a) return;
      const ok = access.can(a, 'devdays', 'view') || access.can(a, 'quality', 'view') || access.can(a, 'datasubmit', 'view') || access.can(a, 'datacol', 'view');
      if (!ok) return res.status(403).json({ ok: false, error: 'No access.' });
      const deptId = String(req.query.dept || '');
      const ym = DD.monthKey(req.query.month);
      if (!deptId || !ym) return res.status(400).json({ ok: false, error: 'Department and month are required.' });
      const cfg = cfgFor(await getConfig(), deptId);
      if (!cfg.tracked) return res.json({ ok: true, tracked: false });
      const rows = await findRows({ depts: [deptId], from: ym + '-01', to: ym + '-31' });
      const v = monthView(ym, rows, cfg, now());
      const count = (s) => v.days.filter((x) => x.state === s).length;
      res.json({ ok: true, tracked: true, month: ym, approved: v.approved, daysInMonth: v.days.length,
        missing: count('missing'), waiting: count('submitted') + count('returned') + count('open') });
    } catch (e) { fail(res, e, 'Could not load device days.'); }
  });

  // Printing takes the record out of the system: its own grant, logged before the page prints.
  app.post('/api/device-days/print', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'print'); if (!a) return;
      const b = (req.body && typeof req.body === 'object') ? req.body : {};
      const what = b.kind === 'summary' ? 'summary' : 'sheet';
      const deptId = String(b.dept || '');
      if (what === 'sheet' && (!deptId || !inScope(a, deptId))) return res.status(403).json({ ok: false, error: 'This department is not one of yours.' });
      activity.log(req, 'devdays_print', { target: deptId || 'all departments', detail: what + ' · ' + String(b.month || b.from || '') + (b.to ? ' → ' + b.to : '') });
      res.json({ ok: true });
    } catch (e) { fail(res, e, 'Could not record the print.'); }
  });
}

module.exports = { mount, monthView, STATUSES, _mem: mem };
