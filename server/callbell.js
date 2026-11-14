/* Call Bell Response Time from the nurse-call system's PDFs → Nursing KPI 3B (module 'kpi').
 *
 *   callBellCalls    one document per alarm: _id '<wing>|<time>|<room>' — the same alarm in two
 *                    overlapping exports (each export holds at most 1,000 calls) is ONE document;
 *                    `uploads` lists every upload that carried it.
 *   callBellUploads  one per uploaded PDF: file name, wing, first / last alarm, rows, new, already
 *                    on file. Removing an upload is soft (removedAt): an alarm counts while any of
 *                    its uploads is live. Nothing is hard-deleted.
 *   callBellConfig   _id 'config': wing → department overrides, target minutes, slow-call minutes,
 *                    and `sent` — what was last written to the quality indicator per unit + month.
 *
 * After every upload (or removal) the months it touched are worked out again and, where the figure
 * changed, written to the quality indicator 'ind-call-bell-response' of each unit's quality area and
 * of Overall Hospital (pooled: Σ minutes ÷ Σ calls) — through data-collection's applyQuality, the
 * same conflict-safe path an approved monthly submission takes. KPI 3B reads Overall Hospital.
 * The KPI counts nurse calls only; pull-cord and Code Blue alarms are counted apart. The rule is
 * renderer/unico/callbell-core.js, shared with the browser.
 */
const crypto = require('crypto');
const access = require('./access');
const deptmap = require('./deptmap');
const activity = require('./activity-log');
const { getDbHandle, getQuality } = require('./db');
const CB = require('../renderer/unico/callbell-core.js');
const DA = require('../renderer/unico/doc-audit-core.js');

const CALLS = 'callBellCalls', UPLOADS = 'callBellUploads', CFG = 'callBellConfig';
const IND_ID = 'ind-call-bell-response', IND_NAME = 'Call Bell Response Time';
const mem = { [CALLS]: new Map(), [UPLOADS]: new Map(), cfg: null };
const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
let DEPS = {};   // tests: depts(), apply(spec), hasIndicator(area), parsePdf(buf)

async function db() { try { return await getDbHandle(); } catch (e) { return null; } }
let indexed = false;
async function coll(name) {
  const d = await db();
  if (!d) return null;
  if (!indexed) { indexed = true; d.collection(CALLS).createIndex({ month: 1 }).catch(() => {}); }
  return d.collection(name);
}

/* ------------------------------------------------------------ config ---- */
async function getConfig() {
  const d = await db();
  const c = !d ? mem.cfg : await d.collection(CFG).findOne({ _id: 'config' });
  return Object.assign({ _id: 'config', wings: {}, target: 2, slowMin: 5, sent: {} }, c || {});
}
async function patchConfig(set) {
  const d = await db();
  if (!d) { mem.cfg = Object.assign({ _id: 'config' }, mem.cfg || {}, set); return; }
  await d.collection(CFG).updateOne({ _id: 'config' }, { $set: set }, { upsert: true });
}

/* -------------------------------------------------------- departments ---- */
async function units() {
  if (DEPS.depts) return DEPS.depts();
  const m = await deptmap.get();
  return Object.values(m.byId || {}).filter((d) => d && d.id && !d.qualityOnly).map((d) => ({ id: d.id, name: d.name, qualityKey: d.qualityKey || null }));
}
async function hospitalArea() {
  if (DEPS.depts) return 'Overall Hospital';
  const m = await deptmap.get();
  return (m.byId[deptmap.HOSPITAL] && m.byId[deptmap.HOSPITAL].qualityKey) || 'Overall Hospital';
}
/* Which department a wing ("9th Floor A") is: the administrator's choice, else the unit whose name
   carries the same floor number ("IPD Cabin Level 9", "IPD Cabin 11" — the cabinN key the
   documentation audit uses to match wards to departments). */
function deptOfWing(wing, cfg, list) {
  const own = (cfg.wings || {})[wing];
  if (own === '') return null;               // set to "not counted under a unit"
  if (own) return list.find((d) => d.id === own) || null;
  const m = /^(\d{1,2})/.exec(String(wing || ''));
  if (!m) return null;
  const key = 'cabin' + Number(m[1]);
  const hit = list.filter((d) => DA.unitKeys(d.name).has(key) || DA.unitKeys(d.id).has(key));
  return hit.length === 1 ? hit[0] : null;
}

/* ------------------------------------------------------------ storage ---- */
async function liveUploadIds() {
  const c = await coll(UPLOADS);
  const all = c ? await c.find({}, { projection: { removedAt: 1 } }).toArray() : [...mem[UPLOADS].values()];
  return new Set(all.filter((u) => !u.removedAt).map((u) => u._id));
}
async function callsOf(months) {
  const c = await coll(CALLS);
  const live = await liveUploadIds();
  const list = c ? await c.find({ month: { $in: months } }).toArray() : [...mem[CALLS].values()].filter((r) => months.indexOf(r.month) >= 0).map(clone);
  return list.filter((r) => (r.uploads || []).some((u) => live.has(u)));
}
/* Store the rows of one upload; an alarm already on file only gets this upload added. → added */
async function storeRows(uploadId, wing, rows, t) {
  const c = await coll(CALLS);
  const docs = rows.map((r) => ({ _id: CB.keyOf(wing, r), wing, room: r.room, call: r.call, pull: r.pull, care: r.care, blue: r.blue, clear: r.clear,
    attendSec: r.attendSec, clearSec: r.clearSec, kind: r.kind, at: r.first, month: CB.monthOf(r), day: CB.dayOf(r), createdAt: t }));
  if (!c) {
    let added = 0;
    docs.forEach((d) => { const cur = mem[CALLS].get(d._id); if (cur) { if (cur.uploads.indexOf(uploadId) < 0) cur.uploads.push(uploadId); } else { mem[CALLS].set(d._id, Object.assign(d, { uploads: [uploadId] })); added++; } });
    return added;
  }
  let added = 0;
  for (let i = 0; i < docs.length; i += 500) {
    const ops = docs.slice(i, i + 500).map((d) => { const { _id, ...rest } = d; return { updateOne: { filter: { _id }, update: { $setOnInsert: rest, $addToSet: { uploads: uploadId } }, upsert: true } }; });
    const r = await c.bulkWrite(ops, { ordered: false });
    added += r.upsertedCount || 0;
  }
  return added;
}

/* ------------------------------------------------------- calculation ---- */
/* One month: per unit (with its wings) and the hospital pool, plus the days each wing has data. */
async function monthFigures(ym, cfg) {
  const list = await units();
  const rows = await callsOf([ym]);
  const opt = { target: cfg.target };
  const byWing = {};
  rows.forEach((r) => { (byWing[r.wing] = byWing[r.wing] || []).push(r); });
  const wings = Object.keys(byWing).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((w) => {
    const d = deptOfWing(w, cfg, list);
    return Object.assign({ wing: w, deptId: d ? d.id : null, deptName: d ? d.name : null, dayList: [...new Set(byWing[w].map((r) => r.day))].sort() }, CB.summarize(byWing[w], opt));
  });
  const byDept = {};
  wings.forEach((w) => { if (w.deptId) (byDept[w.deptId] = byDept[w.deptId] || []).push(w.wing); });
  const unitsOut = Object.keys(byDept).map((id) => {
    const d = list.find((x) => x.id === id);
    const mine = rows.filter((r) => byDept[id].indexOf(r.wing) >= 0);
    return Object.assign({ deptId: id, deptName: d ? d.name : id, area: d ? d.qualityKey : null, wings: byDept[id], sent: cfg.sent[id + '|' + ym] || null }, CB.summarize(mine, opt));
  }).sort((a, b) => String(a.deptName).localeCompare(String(b.deptName), undefined, { numeric: true }));
  const hospital = Object.assign({ deptId: '__hospital__', deptName: 'Overall Hospital', area: await hospitalArea(), sent: cfg.sent['__hospital__|' + ym] || null }, CB.summarize(rows, opt));
  return { month: ym, daysInMonth: CB.daysIn(ym), wings, units: unitsOut, hospital };
}

/* Write the month's figures to the quality indicator where they changed since the last send. */
async function sendMonth(ym, by) {
  const cfg = await getConfig();
  const f = await monthFigures(ym, cfg);
  const apply = DEPS.apply || require('./data-collection').applyQuality;
  const out = [];
  const sent = Object.assign({}, cfg.sent);
  const todo = f.units.concat([f.hospital]);
  // A unit sent earlier that has no alarms left this month (its uploads removed) is cleared too.
  const list = await units();
  Object.keys(cfg.sent || {}).filter((k) => k.endsWith('|' + ym)).map((k) => k.slice(0, -(ym.length + 1)))
    .filter((id) => !todo.some((u) => u.deptId === id))
    .forEach((id) => { const d = list.find((x) => x.id === id); todo.push({ deptId: id, area: d ? d.qualityKey : null, calls: 0 }); });
  // The indicator must be visible where its figures go (the user's choice: uploads restore a
  // Quality-console removal). Logged so the change is never silent.
  const areasOut = [...new Set(todo.filter((u) => u.area && u.calls).map((u) => u.area))];
  try { const back = await unhideIndicator(areasOut); if (back.length) {
    out.push({ restored: back });
    const entry = { action: 'callbell_indicator_restored', username: 'system', name: by || 'system', target: IND_NAME, detail: 'restored in Quality on ' + back.join(', ') + ' (it had been removed there)' };
    if (activity.record) activity.record(entry).catch(() => {}); else activity.log(null, entry.action, entry);
  } }
  catch (e) { out.push({ error: 'could not restore the indicator in Quality: ' + ((e && e.message) || e) }); }
  for (const u of todo) {
    const key = u.deptId + '|' + ym;
    if (!u.area) { out.push({ deptId: u.deptId, skipped: 'no quality area' }); continue; }
    const prev = cfg.sent[key];
    if (!u.calls) {
      // Every upload behind a figure sent earlier was removed: the month stops showing that figure.
      if (prev && prev.calls) {
        try {
          await (DEPS.apply || require('./data-collection').applyQuality)({ type: 'quality', area: u.area, indicatorId: IND_ID, indicatorName: IND_NAME, month: CB.qualityMonth(ym), notObserved: true, remark: 'No nurse-call data on file for this month (the uploads were removed).' });
          sent[key] = { calls: 0, sumMin: 0, avg: null, at: Date.now(), by: by || 'system' };
          out.push({ deptId: u.deptId, area: u.area, cleared: true });
        } catch (e) { out.push({ deptId: u.deptId, area: u.area, error: String((e && e.message) || e) }); }
      }
      continue;
    }
    if (prev && prev.calls === u.calls && prev.sumMin === u.sumMin) continue;
    const has = DEPS.hasIndicator ? await DEPS.hasIndicator(u.area) : await hasIndicator(u.area);
    const spec = { type: 'quality', area: u.area, indicatorId: IND_ID, indicatorName: IND_NAME, month: CB.qualityMonth(ym),
      entryMode: 'rate', num: u.sumMin, den: u.calls, mult: 1, remark: CB.remarkOf(u, ym, { target: cfg.target }) };
    // A unit without the indicator gets it with the KPI's definition; an existing one keeps its own.
    if (!has) Object.assign(spec, { formula: 'avg', unit: 'minutes', valueType: 'Average', goalDirection: 'lower_is_better',
      benchmark: '≤ ' + cfg.target + ' min', benchmarkValue: cfg.target, numLabel: 'Total call bell response minutes', denLabel: 'Number of call bell calls' });
    try {
      await apply(spec);
      sent[key] = { calls: u.calls, sumMin: u.sumMin, avg: u.avg, at: Date.now(), by: by || 'system' };
      out.push({ deptId: u.deptId, area: u.area, avg: u.avg, calls: u.calls });
    } catch (e) { out.push({ deptId: u.deptId, area: u.area, error: String((e && e.message) || e) }); }
  }
  await patchConfig({ sent });
  return out;
}
/* Un-hide the Call Bell indicator where the Quality console removed it (overlay unico_quality_v2
   depts[area].indRemoved) — the same thing the console's own restoreIndicator does. A removed
   indicator is hidden everywhere, KPI 3B included, so figures sent to it would never show.
   Conditional on the overlay being unchanged since it was read (an open tab's save is never
   overwritten); written through the database handle, which refreshes the cached copy. → [areas] */
async function unhideIndicator(areas) {
  if (DEPS.unhide) return DEPS.unhide(areas);
  const d = await db();
  if (!d || !areas.length) return [];
  const c = d.collection('appdata');
  for (let attempt = 0; attempt < 5; attempt++) {
    const doc = await c.findOne({ _id: 'shared' }, { projection: { 'data.unico_quality_v2': 1 } });
    const raw = doc && doc.data && doc.data.unico_quality_v2;
    if (raw == null) return [];
    let q;
    try { q = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(JSON.stringify(raw)); } catch (e) { return []; }
    const changed = [];
    areas.forEach((k) => {
      const o = q && q.depts && q.depts[k];
      if (o && Array.isArray(o.indRemoved) && o.indRemoved.some((x) => String(x) === IND_ID)) { o.indRemoved = o.indRemoved.filter((x) => String(x) !== IND_ID); changed.push(k); }
    });
    if (!changed.length) return [];
    const next = typeof raw === 'string' ? JSON.stringify(q) : q;
    const r = await c.updateOne({ _id: 'shared', 'data.unico_quality_v2': raw }, { $set: { 'data.unico_quality_v2': next, updatedAt: Date.now() } });
    if (r.matchedCount) return changed;
  }
  return [];
}
async function hasIndicator(area) {
  try { const q = await getQuality(); const a = (q || []).find((x) => x && x.key === area); return !!(a && (a.indicators || []).some((i) => i.id === IND_ID)); } catch (e) { return true; }
}

/* ------------------------------------------------------------- routes ---- */
function mount(app, opts) {
  const guard = (opts && opts.requireApi) || [];
  const now = (opts && opts.now) || (() => Date.now());
  if (opts && opts.deps) DEPS = opts.deps;
  const resolve = async (req, res, action) => {
    const a = req.access || await access.forRequest(req);
    if (!a) { res.status(401).json({ ok: false, error: 'Not authenticated.' }); return null; }
    req.access = a;
    if (action && !access.can(a, 'kpi', action)) {
      res.status(403).json({ ok: false, error: { add: 'You do not have permission to upload call bell reports.', delete: 'You do not have permission to remove call bell uploads.' }[action] || 'You do not have access to Nursing KPI.' });
      return null;
    }
    return a;
  };
  const fail = (res, e, msg) => { console.error('[callbell]', e && e.message); res.status(500).json({ ok: false, error: msg }); };
  const actor = (req, a) => (a && a.username) || (req.user && req.user.sub) || 'local';
  const nameOf = (req, a) => (a && a.name) || (req.user && req.user.name) || actor(req, a);
  const isMonth = (s) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(s || ''));

  app.get('/api/callbell/meta', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      const cfg = await getConfig();
      const c = await coll(UPLOADS);
      const ups = (c ? await c.find({}).toArray() : [...mem[UPLOADS].values()].map(clone)).sort((x, y) => y.at - x.at).slice(0, 60);
      const calls = await coll(CALLS);
      const months = calls ? await calls.distinct('month') : [...new Set([...mem[CALLS].values()].map((r) => r.month))];
      const list = await units();
      const wings = [...new Set(ups.map((u) => u.wing))].sort((x, y) => x.localeCompare(y, undefined, { numeric: true }))
        .map((w) => { const d = deptOfWing(w, cfg, list); return { wing: w, deptId: d ? d.id : null, deptName: d ? d.name : null, own: Object.prototype.hasOwnProperty.call(cfg.wings || {}, w) }; });
      res.json({ ok: true, config: { target: cfg.target, slowMin: cfg.slowMin, wings: cfg.wings || {} }, uploads: ups.map(({ _id, ...u }) => Object.assign({ id: _id }, u)),
        months: months.filter(isMonth).sort().reverse(), wings, depts: list.map((d) => ({ id: d.id, name: d.name })),
        canAdd: access.can(a, 'kpi', 'add'), canDelete: access.can(a, 'kpi', 'delete'), isAdmin: !!a.unrestricted });
    } catch (e) { fail(res, e, 'Could not load the call bell data.'); }
  });

  /* One PDF per request: { name, data: base64 }. */
  app.post('/api/callbell/upload', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'add'); if (!a) return;
      const b = (req.body && typeof req.body === 'object') ? req.body : {};
      const name = String(b.name || 'report.pdf').slice(0, 160);
      const buf = Buffer.from(String(b.data || '').replace(/^data:[^,]*,/, ''), 'base64');
      if (!buf.length || buf.length > 8 * 1024 * 1024) return res.status(400).json({ ok: false, error: 'Choose a PDF of up to 8 MB.' });
      if (buf.slice(0, 5).toString() !== '%PDF-') return res.status(400).json({ ok: false, error: name + ' is not a PDF.' });
      let text;
      try { text = DEPS.parsePdf ? await DEPS.parsePdf(buf) : (await require('pdf-parse/lib/pdf-parse.js')(buf)).text; }
      catch (e) { return res.status(400).json({ ok: false, error: name + ' could not be read as a PDF.' }); }
      const p = CB.parseText(text);
      if (!p.wing || !p.rows.length) return res.status(400).json({ ok: false, error: name + ' is not a Nurse Call Status Report (no floor / no calls found).' });
      // A changed report layout must not be half-read in silence.
      if (p.unparsed.length > Math.max(3, p.rows.length * 0.02)) return res.status(400).json({ ok: false, error: name + ': ' + p.unparsed.length + ' lines could not be read — has the report layout changed?', sample: p.unparsed.slice(0, 5) });
      // Duplicates are taken out BEFORE anything is counted: the same alarm twice in this file
      // (wing|time|room) is kept once, and an alarm already on file from an earlier upload is not
      // added again (storeRows). Both are reported.
      const seenKeys = new Set();
      const uniq = p.rows.filter((r) => { const k = CB.keyOf(p.wing, r); if (seenKeys.has(k)) return false; seenKeys.add(k); return true; });
      const dupInFile = p.rows.length - uniq.length;
      p.rows = uniq;
      const t = now();
      const id = 'cbu_' + crypto.randomBytes(6).toString('hex');
      const added = await storeRows(id, p.wing, p.rows, t);
      const at = p.rows.map((r) => r.first).sort();
      const months = [...new Set(p.rows.map(CB.monthOf))].filter(isMonth).sort();
      const up = { _id: id, name, wing: p.wing, from: at[0], to: at[at.length - 1], rows: p.rows.length, added, already: p.rows.length - added, dupInFile,
        calls: p.rows.filter((r) => r.kind === 'call').length, unparsed: p.unparsed.length, months, by: actor(req, a), byName: nameOf(req, a), at: t, removedAt: null };
      const c = await coll(UPLOADS);
      if (c) await c.insertOne(up); else mem[UPLOADS].set(id, clone(up));
      // `send: false` (both screens since 2026-11-14 — the user updates the KPI per selected month
      // by hand): stored only; the figure goes to quality on "Update KPI 3B" / the 3B box's Save
      // (POST /api/callbell/send). Without the flag (scripts, tests) it still sends.
      const sent = [];
      if (b.send !== false) for (const ym of months) sent.push.apply(sent, (await sendMonth(ym, nameOf(req, a))).map((x) => Object.assign({ month: ym }, x)));
      activity.log(req, 'callbell_upload', { target: p.wing, detail: name + ' · ' + p.rows.length + ' alarms (' + added + ' new) · ' + up.from + ' → ' + up.to });
      const { _id, ...rest } = up;
      res.json({ ok: true, upload: Object.assign({ id: _id }, rest), sent });
    } catch (e) { fail(res, e, 'Could not read the report.'); }
  });

  /* Send the months' figures to the quality indicator now (the KPI 3B box's Save, the Call bell
     page's "Send to KPI"). Writes only where the figure changed. */
  app.post('/api/callbell/send', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, null); if (!a) return;
      if (!access.can(a, 'kpi', 'add') && !access.can(a, 'kpi', 'edit')) return res.status(403).json({ ok: false, error: 'Sending figures to the KPI needs the Nursing KPI “Add” or “Edit” permission.' });
      const b = (req.body && typeof req.body === 'object') ? req.body : {};
      const months = [...new Set((Array.isArray(b.months) ? b.months : [b.month]).map(String))].filter(isMonth).slice(0, 24);
      if (!months.length) return res.status(400).json({ ok: false, error: 'Which month?' });
      // force (the page's "Update KPI 3B" button): write every unit again, even if unchanged since the
      // last send — e.g. after someone changed the quality figure by hand.
      if (b.force === true) {
        const cfg = await getConfig();
        const keep = {}; Object.keys(cfg.sent || {}).forEach((k) => { if (!months.some((m) => k.endsWith('|' + m))) keep[k] = cfg.sent[k]; });
        await patchConfig({ sent: keep });
      }
      const out = [];
      for (const ym of months) out.push.apply(out, (await sendMonth(ym, nameOf(req, a))).map((x) => Object.assign({ month: ym }, x)));
      activity.log(req, 'callbell_send', { target: 'Call Bell Response Time', detail: (b.force === true ? 're-sent ' : '') + months.join(', ') + ' · ' + out.filter((x) => !x.error && !x.skipped).length + ' figure(s) written' });
      res.json({ ok: true, sent: out });
    } catch (e) { fail(res, e, 'Could not send the figures.'); }
  });

  app.get('/api/callbell/summary', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      const ym = String(req.query.month || '');
      if (!isMonth(ym)) return res.status(400).json({ ok: false, error: 'Which month?' });
      const cfg = await getConfig();
      res.json(Object.assign({ ok: true, target: cfg.target, slowMin: cfg.slowMin }, await monthFigures(ym, cfg)));
    } catch (e) { fail(res, e, 'Could not work out the month.'); }
  });

  /* The calls behind a figure: slow nurse calls (over the slow-call minutes), or pull-cord / Code Blue. */
  app.get('/api/callbell/calls', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      const ym = String(req.query.month || '');
      if (!isMonth(ym)) return res.status(400).json({ ok: false, error: 'Which month?' });
      const cfg = await getConfig();
      const list = await units();
      const kind = ['call', 'pull', 'blue'].indexOf(req.query.kind) >= 0 ? req.query.kind : 'call';
      let rows = (await callsOf([ym])).filter((r) => r.kind === kind);
      if (req.query.dept) rows = rows.filter((r) => { const d = deptOfWing(r.wing, cfg, list); return d && d.id === req.query.dept; });
      if (kind === 'call') rows = rows.filter((r) => r.attendSec > (Number(cfg.slowMin) || 5) * 60);
      rows.sort((x, y) => (kind === 'call' ? y.attendSec - x.attendSec : String(x.at).localeCompare(String(y.at))));
      res.json({ ok: true, calls: rows.slice(0, 300).map((r) => ({ wing: r.wing, room: r.room, at: r.at, call: r.call, pull: r.pull, care: r.care, min: CB.round(r.attendSec / 60, 2) })), total: rows.length, slowMin: cfg.slowMin });
    } catch (e) { fail(res, e, 'Could not list the calls.'); }
  });

  app.put('/api/callbell/config', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      if (!a.unrestricted) return res.status(403).json({ ok: false, error: 'Only an administrator can change the call bell settings.' });
      const b = (req.body && typeof req.body === 'object') ? req.body : {};
      const set = {};
      if (b.target != null) { const n = Number(b.target); if (!(n > 0 && n <= 30)) return res.status(400).json({ ok: false, error: 'Target: 0–30 minutes.' }); set.target = n; }
      if (b.slowMin != null) { const n = Number(b.slowMin); if (!(n > 0 && n <= 120)) return res.status(400).json({ ok: false, error: 'Slow call: 0–120 minutes.' }); set.slowMin = n; }
      if (b.wings && typeof b.wings === 'object') { const w = {}; Object.keys(b.wings).slice(0, 60).forEach((k) => { const v = b.wings[k]; if (v === null) return; w[String(k).slice(0, 60)] = String(v).slice(0, 80); }); set.wings = w; }
      await patchConfig(set);
      activity.log(req, 'callbell_config', { target: 'Call bell', detail: JSON.stringify(set).slice(0, 300) });
      // A changed mapping or target changes what each unit's figure is: send the months on file again.
      const cfg = await getConfig();
      const calls = await coll(CALLS);
      const months = (calls ? await calls.distinct('month') : [...new Set([...mem[CALLS].values()].map((r) => r.month))]).filter(isMonth);
      if (set.wings || set.target) { await patchConfig({ sent: {} }); for (const ym of months) await sendMonth(ym, nameOf(req, a)); }
      res.json({ ok: true, config: { target: cfg.target, slowMin: cfg.slowMin, wings: cfg.wings } });
    } catch (e) { fail(res, e, 'Could not save the settings.'); }
  });

  /* Remove an upload (soft): its alarms stop counting unless another upload carries them too. */
  app.delete('/api/callbell/uploads/:id', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'delete'); if (!a) return;
      const id = String(req.params.id || '');
      const c = await coll(UPLOADS);
      const up = c ? await c.findOne({ _id: id }) : clone(mem[UPLOADS].get(id));
      if (!up || up.removedAt) return res.status(404).json({ ok: false, error: 'This upload does not exist.' });
      const t = now();
      if (c) await c.updateOne({ _id: id }, { $set: { removedAt: t, removedBy: actor(req, a) } });
      else mem[UPLOADS].set(id, Object.assign(up, { removedAt: t, removedBy: actor(req, a) }));
      for (const ym of up.months || []) await sendMonth(ym, nameOf(req, a));
      activity.log(req, 'callbell_upload_removed', { target: up.wing, detail: up.name });
      res.json({ ok: true });
    } catch (e) { fail(res, e, 'Could not remove the upload.'); }
  });
}

module.exports = { mount, monthFigures, sendMonth, deptOfWing, getConfig, unhideIndicator, _mem: mem };
