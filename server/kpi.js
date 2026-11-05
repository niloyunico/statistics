/* Nursing KPI — the Nursing Department's KPI programme, online (module 'kpi').
 *
 *   kpiDefs     one document per KPI: pillar, objective, unit, formula, direction, baseline,
 *               a target per six-month cycle, the action plan (owner / due / status), remarks, and
 *               source.indId — the quality indicator whose months fill it automatically.
 *               Seeded once from the deck (server/kpi-catalogue.js); custom KPIs are added here.
 *   kpiMonths   one document per KPI per month (_id '<kpiId>:<YYYY-MM>'): a figure typed by a KPI
 *               manager. For a linked KPI it is an EDIT of the system figure, which stays visible
 *               beside it (autoAt); removing the row reverts to the system figure.
 *   kpiReports  a report per period (_id '<from>_<to>'): live while a draft, frozen when final,
 *               with commentary per KPI, an overall summary and the sign-off names.
 *   kpiConfig   _id 'config': cycle start and length, pillars, report title.
 *
 * Access is module 'kpi': View = dashboard, data and reports; Add = type a month that has no
 * figure yet and generate a report; Edit = change figures, KPIs and action plans, comment on and
 * finalise reports; Delete = archive a KPI, clear a month, remove a draft report; Print = print,
 * PDF, PowerPoint and Excel — every export is logged before the file is built. Settings and
 * re-opening a final report are administrator-only. Nothing is ever hard-deleted.
 * The rules (cycles, targets, status, period values) are renderer/unico/kpi-core.js, shared
 * with the browser; the system figures are server/kpi-link.js.
 */
const access = require('./access');
const activity = require('./activity-log');
const { getDbHandle } = require('./db');
const K = require('../renderer/unico/kpi-core.js');
const link = require('./kpi-link');
const E = require('./kpi-evidence');
const catalogue = require('./kpi-catalogue');

const DEFS = 'kpiDefs', MONTHS = 'kpiMonths', REPORTS = 'kpiReports', CFG = 'kpiConfig';
const mem = { [DEFS]: new Map(), [MONTHS]: new Map(), [REPORTS]: new Map(), cfg: null };
const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));

async function db() { try { return await getDbHandle(); } catch (e) { return null; } }
let indexed = false;
async function coll(name) {
  const d = await db();
  if (!d) return null;
  if (!indexed) {
    indexed = true;
    d.collection(MONTHS).createIndex({ month: 1, kpiId: 1 }).catch(() => {});
    d.collection(REPORTS).createIndex({ to: -1 }).catch(() => {});
  }
  return d.collection(name);
}

/* ---------------------------------------------------------------- storage --- */

async function getDoc(name, id) {
  const c = await coll(name);
  if (!c) return clone(mem[name].get(id)) || null;
  return c.findOne({ _id: id });
}
async function allDocs(name) {
  const c = await coll(name);
  if (!c) return [...mem[name].values()].map(clone);
  return c.find({}).toArray();
}
async function monthRows(from, to) {
  const c = await coll(MONTHS);
  if (!c) return [...mem[MONTHS].values()].filter((r) => !r.removedAt && r.month >= from && r.month <= to).map(clone);
  return c.find({ month: { $gte: from, $lte: to }, removedAt: null }).toArray();
}
// Write `doc` only if the stored copy still carries `expect` (null = must not exist yet).
async function putDoc(name, doc, expect) {
  const c = await coll(name);
  if (!c) {
    const cur = mem[name].get(doc._id);
    if ((cur ? cur.updatedAt : null) !== (expect == null ? null : expect)) return false;
    mem[name].set(doc._id, clone(doc));
    return true;
  }
  if (expect == null) {
    try { await c.insertOne(doc); return true; } catch (e) { if (e && e.code === 11000) return false; throw e; }
  }
  const { _id, ...rest } = doc;
  const r = await c.replaceOne({ _id, updatedAt: expect }, rest);
  return r.matchedCount === 1;
}
async function getConfig() {
  const d = await db();
  if (!d) return mem.cfg || { _id: 'config' };
  return (await d.collection(CFG).findOne({ _id: 'config' })) || { _id: 'config' };
}
async function patchConfig(set) {
  const d = await db();
  if (!d) { mem.cfg = Object.assign({ _id: 'config' }, mem.cfg || {}, set); return; }
  await d.collection(CFG).updateOne({ _id: 'config' }, { $set: set }, { upsert: true });
}

/* The deck's 17 KPIs, once. After that the catalogue is the administrator's: archiving every KPI
   must not bring them back, so the marker lives in the config, not in "the collection is empty". */
async function ensureSeed(now) {
  const cfg = await getConfig();
  if (cfg.seededAt) return 0;
  const have = new Set((await allDocs(DEFS)).map((d) => d._id));
  let n = 0;
  for (const s of catalogue.seedDocs()) {
    if (have.has(s.id)) continue;
    const { id, ...rest } = s;
    if (await putDoc(DEFS, Object.assign({ _id: id }, rest, { createdAt: now, createdBy: 'seed', updatedAt: now, updatedBy: 'seed', history: [{ at: now, by: 'seed', action: 'seeded from the KPI deck' }] }), null)) n++;
  }
  await patchConfig({ seededAt: now });
  return n;
}

/* ---------------------------------------------------------------- helpers --- */

const cleanDef = (d) => { if (!d) return null; const { _id, history, ...rest } = d; return Object.assign({ id: _id }, rest, { history: (history || []).slice(-15) }); };
const activeDefs = (defs) => defs.filter(K.isLive).sort((a, b) => (a.order || 0) - (b.order || 0));
const actor = (req, a) => (a && a.username) || (req.user && req.user.sub) || 'local';
const nameOf = (req, a) => (a && a.name) || (req.user && req.user.name) || actor(req, a);
const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const numOrNull = (v) => (K.has(v) && isFinite(Number(v)) ? Number(v) : null);
const stamp = (now) => now; // updatedAt is the epoch ms of the write — the lost-update token

/* A KPI definition from a request body. Unknown keys are dropped; every string is capped. */
function pickDef(b, cfg, cur) {
  const c = K.cfgOf(cfg);
  const out = {};
  const pillarIds = c.pillars.map((p) => p.id);
  out.name = str(b.name, 140);
  out.code = str(b.code, 8);
  out.pillar = pillarIds.indexOf(b.pillar) >= 0 ? b.pillar : (cur && cur.pillar) || pillarIds[0];
  out.objective = str(b.objective, 800);
  out.unit = str(b.unit, 48) || '%';
  out.formula = K.FORMULAS.indexOf(b.formula) >= 0 ? b.formula : 'pct';
  out.goalDirection = K.DIRECTIONS.indexOf(b.goalDirection) >= 0 ? b.goalDirection : 'higher_is_better';
  out.decimals = K.has(b.decimals) && Number.isInteger(+b.decimals) && +b.decimals >= 0 && +b.decimals <= 4 ? +b.decimals : null;
  out.formulaText = str(b.formulaText, 500);
  out.numLabel = str(b.numLabel, 140);
  out.denLabel = str(b.denLabel, 140);
  out.frequency = str(b.frequency, 140) || catalogue.TRACKING;
  out.remarks = str(b.remarks, 4000);
  const bl = (b.baseline && typeof b.baseline === 'object') ? b.baseline : {};
  out.baseline = { value: numOrNull(bl.value), note: str(bl.note, 240) };
  out.targets = (Array.isArray(b.targets) ? b.targets : []).filter((t) => t && Number.isInteger(+t.cycle) && +t.cycle >= 1 && +t.cycle <= 6 && numOrNull(t.value) != null)
    .map((t) => ({ cycle: +t.cycle, value: Number(t.value) })).filter((t, i, a) => a.findIndex((x) => x.cycle === t.cycle) === i).sort((x, y) => x.cycle - y.cycle);
  const pct = numOrNull(b.baselineTargetPct);
  out.baselineTargetPct = pct != null && pct >= -100 && pct <= 100 ? pct : null;
  const s = (b.source && typeof b.source === 'object') ? b.source : {};
  out.source = s.indId ? { indId: str(s.indId, 100), indName: str(s.indName, 200), rule: link.RULES.indexOf(s.rule) >= 0 ? s.rule : null } : { indId: null };
  // Fill from the quality data by itself (default on); off = typed monthly, system figure as a hint.
  out.autoFill = b.autoFill !== false;
  // This KPI's own start month (null = the programme's "All KPIs start on").
  out.startMonth = K.isMonth(b.startMonth) ? b.startMonth : null;
  // The units this KPI expects a figure from (quality area keys; empty = Department Setup decides).
  out.units = (Array.isArray(b.units) ? b.units : []).map((k) => str(k, 80)).filter(Boolean).filter((k, i, a) => a.indexOf(k) === i).slice(0, 80);
  let n = 0;
  out.actions = (Array.isArray(b.actions) ? b.actions : []).slice(0, 60).filter((x) => x && str(x.text, 600)).map((x) => {
    const id = /^[a-z0-9_-]{1,24}$/i.test(String(x.id || '')) ? String(x.id) : 'n' + Date.now().toString(36) + (n++);
    return { id, text: str(x.text, 600), owner: str(x.owner, 100), due: K.isMonth(x.due) ? x.due : '', status: K.ACTION_STATUSES.indexOf(x.status) >= 0 ? x.status : 'open', note: str(x.note, 400) };
  });
  return out;
}
const DEF_LOG_FIELDS = ['name', 'code', 'pillar', 'unit', 'formula', 'goalDirection', 'baseline', 'targets', 'baselineTargetPct', 'source', 'objective', 'formulaText', 'remarks', 'autoFill', 'startMonth', 'units'];
function defChanges(a, b) {
  const out = DEF_LOG_FIELDS.filter((k) => JSON.stringify(a ? a[k] : null) !== JSON.stringify(b[k]));
  if (JSON.stringify((a && a.actions) || []) !== JSON.stringify(b.actions || [])) out.push('action plan');
  return out;
}

/* Every active KPI × month, resolved (saved figure ▸ system figure ▸ nothing — or, with
   auto-fill off, saved figure ▸ nothing). Returns the cells, the saved rows (by 'kpiId:YYYY-MM')
   and the quality context, so the evidence can be built from the very same reads. */
async function valuesFor(defs, months, deps, cfg) {
  if (!months.length) return { cells: {}, savedById: {}, ctx: null };
  const [ctx, saved] = await Promise.all([link.loadContext(months, deps), monthRows(months[0], months[months.length - 1])]);
  const savedById = {};
  saved.forEach((r) => { savedById[r._id] = r; });
  const masterOn = K.cfgOf(cfg).autoFill !== false;
  const cells = {};
  defs.forEach((d) => {
    const auto = d.source && d.source.indId ? link.linkedMonthlyFrom(ctx, d, months) : {};
    const autoFill = masterOn && d.autoFill !== false;
    cells[d.id] = {};
    months.forEach((m) => {
      const c = K.resolveCell(auto[m], savedById[d.id + ':' + m], { autoFill });
      if (!K.isStarted(d, m, cfg)) c.notStarted = true;
      cells[d.id][m] = c;
    });
  });
  return { cells, savedById, ctx };
}
const defsAsPlain = (docs) => activeDefs(docs).map((d) => Object.assign({ id: d._id }, d));

/* A report's live body: rows for the period, plus 12 months of trend ending with it. With
   `calc`, every row also carries the evidence for each month of the period (how the figure
   was calculated, from which units, approved by whom) and the data checks. */
async function computeReport(from, to, cfg, deps, opts) {
  const months = K.monthsBetween(from, to);
  const trendMonths = months.length >= 12 ? months : K.monthsBetween(K.addMonth(to, -11), to);
  const all = [...new Set(trendMonths.concat(months))].sort();
  const defs = defsAsPlain(await allDocs(DEFS));
  const v = await valuesFor(defs, all, deps, cfg);
  const rows = K.buildRows(defs, v.cells, months, trendMonths, cfg);
  const out = { months, trendMonths, rows, summary: K.summarize(rows) };
  if (opts && opts.calc && v.ctx) {
    await E.loadSources(v.ctx, { now: opts.now }, deps);
    const all2 = E.evidenceAll(v.ctx, defs, months, v.savedById, cfg);
    rows.forEach((r) => { r.evidence = all2[r.kpiId] || {}; });
    out.evidence = all2;
    out.dataFingerprint = E.dataFingerprint(all2);
  }
  return out;
}
const evidenceOfRows = (rows) => (rows || []).reduce((o, r) => { if (r.evidence) o[r.kpiId] = r.evidence; return o; }, {});
function qualityOf(rows, acks) {
  const all = evidenceOfRows(rows);
  if (!Object.keys(all).length) return null;
  const list = E.checkList(all, acks);
  const un = E.unresolved(all, acks);
  return { checks: list, unresolved: un, errors: list.filter((c) => c.level === 'error').length, warns: list.filter((c) => c.level === 'warn').length,
    acknowledged: list.filter((c) => c.level === 'error' && c.ack && c.ack.current).length };
}
function reportOut(doc, live, cfg, extra) {
  const base = doc || {};
  const body = (base.state === 'final') ? base : Object.assign({}, base, live);
  const acks = (base.acks || []).filter((a) => a && !a.revokedAt);
  return Object.assign({
    id: K.reportId(body.from, body.to), from: body.from, to: body.to, preset: K.presetOf(body.from, body.to, cfg),
    state: base.state || 'preview', stored: !!doc, cycle: K.cycleOf(body.to, cfg),
    months: body.months, trendMonths: body.trendMonths, rows: body.rows, summary: body.summary,
    commentary: base.commentary || {}, overall: base.overall || '', signoff: base.signoff || {},
    generatedAt: base.generatedAt || null, generatedBy: base.generatedByName || base.generatedBy || null,
    finalizedAt: base.finalizedAt || null, finalizedBy: base.finalizedByName || base.finalizedBy || null,
    updatedAt: base.updatedAt || null, title: K.cfgOf(cfg).reportTitle, hospitalName: K.cfgOf(cfg).hospitalName,
    pillars: K.cfgOf(cfg).pillars, history: (base.history || []).slice(-20),
    acks, quality: qualityOf(body.rows, acks), dataFingerprint: body.dataFingerprint || null,
  }, extra || {});
}
/* A report by id. A final one is the stored snapshot; with `calc`, its source data is checked
   again and every KPI-month whose figures have moved since is listed in `changedSince`. */
async function loadReport(id, cfg, deps, opts) {
  const p = K.parseReportId(id);
  if (!p) return null;
  let doc = await getDoc(REPORTS, id);
  if (doc && doc.removedAt) doc = null;
  const calc = !!(opts && opts.calc);
  if (doc && doc.state === 'final') {
    let extra = {};
    if (calc) {
      const stored = evidenceOfRows(doc.rows);
      if (Object.keys(stored).length) {
        const now = await computeReport(p.from, p.to, cfg, deps, { calc: true, now: opts.now });
        const changed = [];
        Object.keys(stored).forEach((k) => Object.keys(stored[k]).forEach((m) => {
          const a = stored[k][m], b = now.evidence && now.evidence[k] && now.evidence[k][m];
          if (b && a.fingerprint !== b.fingerprint) changed.push({ kpiId: k, ym: m });
        }));
        extra = { changedSince: changed };
      } else extra = { changedSince: null, evidenceMissing: true };
    }
    return { doc, report: reportOut(doc, null, cfg, extra) };
  }
  const live = Object.assign({ from: p.from, to: p.to }, await computeReport(p.from, p.to, cfg, deps, { calc, now: opts && opts.now }));
  return { doc, report: reportOut(doc || Object.assign({ from: p.from, to: p.to }), live, cfg) };
}

/* The month that just ended gets a draft report on its own — from the daily keep-alive cron and
   whenever someone opens Reports. The report's _id is the once-per-month gate. */
async function ensureDraft(ym, source, opts) {
  const now = (opts && opts.now) ? opts.now() : Date.now();
  if (!K.isMonth(ym)) return { ok: false, skipped: 'bad-month' };
  const id = K.reportId(ym, ym);
  if (await getDoc(REPORTS, id)) return { ok: true, skipped: 'exists', id };
  await ensureSeed(now);
  const cfg = await getConfig();
  const live = await computeReport(ym, ym, cfg, opts && opts.deps);
  const doc = Object.assign({ _id: id, from: ym, to: ym, state: 'draft' }, live, {
    commentary: {}, overall: '', signoff: {}, generatedAt: now, generatedBy: source || 'auto', generatedByName: 'Prepared automatically',
    updatedAt: stamp(now), history: [{ at: now, by: source || 'auto', action: 'draft prepared automatically' }],
  });
  const ok = await putDoc(REPORTS, doc, null);
  const result = ok ? { ok: true, created: id } : { ok: true, skipped: 'raced', id };
  await patchConfig({ automation: { lastMonth: ym, lastAt: now, lastResult: ok ? 'created' : 'raced', source: source || 'auto' } }).catch(() => {});
  return result;
}

/* ------------------------------------------------------------------ mount --- */

function mount(app, opts) {
  const guard = (opts && opts.requireApi) || [];
  const now = (opts && opts.now) || (() => Date.now());
  const deps = opts && opts.deps; // tests: fake quality / formulas / deptmap

  const resolve = async (req, res, action) => {
    const a = req.access || await access.forRequest(req);
    if (!a) { res.status(401).json({ ok: false, error: 'Not authenticated.' }); return null; }
    req.access = a;
    if (action && !access.can(a, 'kpi', action)) {
      const what = { add: 'add KPI figures', edit: 'change the Nursing KPIs', delete: 'remove KPI records', print: 'print or export the Nursing KPI reports' }[action] || 'open Nursing KPI';
      res.status(403).json({ ok: false, error: 'You do not have permission to ' + what + '.' });
      return null;
    }
    return a;
  };
  const can = (a, act) => access.can(a, 'kpi', act);
  const adminOnly = (a, res, what) => { if (a.unrestricted) return true; res.status(403).json({ ok: false, error: 'Only an administrator can ' + what + '.' }); return false; };
  const fail = (res, e, msg) => { console.error('[kpi]', e && e.message); res.status(500).json({ ok: false, error: msg }); };
  const body = (req) => ((req.body && typeof req.body === 'object') ? req.body : {});
  const rights = (a) => ({ canAdd: can(a, 'add'), canEdit: can(a, 'edit'), canDelete: can(a, 'delete'), canPrint: can(a, 'print'), isAdmin: !!a.unrestricted });

  app.get('/api/kpi/meta', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      await ensureSeed(now());
      const cfgDoc = await getConfig();
      const cfg = K.cfgOf(cfgDoc);
      const last = K.lastClosedMonth(now());
      res.json({ ok: true, config: cfg, thisMonth: K.thisMonth(now()), lastClosed: last, cycle: K.cycleOf(last, cfg),
        automation: cfgDoc.automation || null, user: actor(req, a), ...rights(a) });
    } catch (e) { fail(res, e, 'Could not load Nursing KPI.'); }
  });

  /* ------------------------------------------------------------- definitions */
  app.get('/api/kpi/defs', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      await ensureSeed(now());
      const docs = await allDocs(DEFS);
      const all = req.query.all === '1' && can(a, 'edit');
      res.json({ ok: true, defs: (all ? docs.slice().sort((x, y) => (x.order || 0) - (y.order || 0)) : activeDefs(docs)).map(cleanDef) });
    } catch (e) { fail(res, e, 'Could not load the KPIs.'); }
  });

  app.post('/api/kpi/defs', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'add'); if (!a) return;
      const cfg = await getConfig();
      const b = body(req);
      const d = pickDef(b, cfg, null);
      if (!d.name) return res.status(400).json({ ok: false, error: 'Give the KPI a name.' });
      const docs = await allDocs(DEFS);
      const id = K.newKpiId(d.name, docs.map((x) => x._id));
      const t = now();
      const doc = Object.assign({ _id: id }, d, { order: docs.reduce((m, x) => Math.max(m, x.order || 0), 0) + 10, active: true, custom: true,
        createdAt: t, createdBy: actor(req, a), updatedAt: stamp(t), updatedBy: actor(req, a), updatedByName: nameOf(req, a), history: [{ at: t, by: actor(req, a), action: 'created' }] });
      if (!(await putDoc(DEFS, doc, null))) return res.status(409).json({ ok: false, error: 'A KPI with this name was just added. Reload and try again.' });
      activity.log(req, 'kpi_def', { target: d.name, detail: 'added · ' + (d.source.indId ? 'linked to ' + (d.source.indName || d.source.indId) : 'typed monthly') });
      res.json({ ok: true, def: cleanDef(doc) });
    } catch (e) { fail(res, e, 'Could not add the KPI.'); }
  });

  app.put('/api/kpi/defs/:id', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'edit'); if (!a) return;
      const id = String(req.params.id || '');
      const cur = await getDoc(DEFS, id);
      if (!cur) return res.status(404).json({ ok: false, error: 'This KPI no longer exists.' });
      const b = body(req);
      if (b.baseUpdatedAt !== undefined && b.baseUpdatedAt !== cur.updatedAt) return res.status(409).json({ ok: false, code: 'stale', error: 'Someone else changed this KPI while you were editing. Reload it to see their changes.', current: cleanDef(cur) });
      const cfg = await getConfig();
      const d = pickDef(Object.assign({}, cleanDef(cur), b), cfg, cur);
      if (!d.name) return res.status(400).json({ ok: false, error: 'The KPI needs a name.' });
      const changed = defChanges(cur, d);
      const t = now();
      const doc = Object.assign({}, cur, d, { updatedAt: stamp(t), updatedBy: actor(req, a), updatedByName: nameOf(req, a),
        history: (cur.history || []).concat([{ at: t, by: actor(req, a), action: 'edited', changes: changed }]).slice(-100) });
      if (!(await putDoc(DEFS, doc, cur.updatedAt))) return res.status(409).json({ ok: false, code: 'stale', error: 'Someone else changed this KPI at the same moment. Reload and try again.' });
      if (changed.length) activity.log(req, 'kpi_def', { target: d.name, detail: 'edited · ' + changed.join(', ') });
      res.json({ ok: true, def: cleanDef(doc) });
    } catch (e) { fail(res, e, 'Could not save the KPI.'); }
  });

  // Archive (soft): the KPI leaves the dashboard and new reports; its months and old reports stay.
  app.delete('/api/kpi/defs/:id', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'delete'); if (!a) return;
      const cur = await getDoc(DEFS, String(req.params.id || ''));
      if (!cur) return res.status(404).json({ ok: false, error: 'This KPI no longer exists.' });
      const t = now();
      const doc = Object.assign({}, cur, { active: false, removedAt: t, removedBy: actor(req, a), updatedAt: stamp(t), updatedBy: actor(req, a),
        history: (cur.history || []).concat([{ at: t, by: actor(req, a), action: 'archived' }]).slice(-100) });
      if (!(await putDoc(DEFS, doc, cur.updatedAt))) return res.status(409).json({ ok: false, error: 'Someone changed this KPI at the same moment. Try again.' });
      activity.log(req, 'kpi_def_archive', { target: cur.name, detail: 'archived' });
      res.json({ ok: true });
    } catch (e) { fail(res, e, 'Could not archive the KPI.'); }
  });

  app.post('/api/kpi/defs/:id/restore', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'edit'); if (!a) return;
      const cur = await getDoc(DEFS, String(req.params.id || ''));
      if (!cur) return res.status(404).json({ ok: false, error: 'This KPI no longer exists.' });
      const t = now();
      const doc = Object.assign({}, cur, { active: true, removedAt: null, removedBy: null, updatedAt: stamp(t), updatedBy: actor(req, a),
        history: (cur.history || []).concat([{ at: t, by: actor(req, a), action: 'restored' }]).slice(-100) });
      if (!(await putDoc(DEFS, doc, cur.updatedAt))) return res.status(409).json({ ok: false, error: 'Someone changed this KPI at the same moment. Try again.' });
      activity.log(req, 'kpi_def', { target: cur.name, detail: 'restored' });
      res.json({ ok: true, def: cleanDef(doc) });
    } catch (e) { fail(res, e, 'Could not restore the KPI.'); }
  });

  // Enable / disable: a switched-off KPI stays on Manage KPIs but leaves the dashboard, Data Update,
  // new reports, exports and the missing-data badge. Nothing is deleted; final reports keep it.
  app.post('/api/kpi/defs/:id/enabled', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'edit'); if (!a) return;
      const b = body(req);
      if (typeof b.enabled !== 'boolean') return res.status(400).json({ ok: false, error: 'Say whether the KPI is enabled.' });
      const cur = await getDoc(DEFS, String(req.params.id || ''));
      if (!cur || cur.active === false || cur.removedAt) return res.status(404).json({ ok: false, error: 'This KPI no longer exists or is archived.' });
      if (!cur.disabled === b.enabled) return res.json({ ok: true, def: cleanDef(cur), unchanged: true });
      const t = now(), what = b.enabled ? 'enabled' : 'disabled';
      const doc = Object.assign({}, cur, { disabled: !b.enabled, disabledAt: b.enabled ? null : t, disabledBy: b.enabled ? null : actor(req, a),
        updatedAt: stamp(t), updatedBy: actor(req, a), updatedByName: nameOf(req, a),
        history: (cur.history || []).concat([{ at: t, by: actor(req, a), action: what }]).slice(-100) });
      if (!(await putDoc(DEFS, doc, cur.updatedAt))) return res.status(409).json({ ok: false, code: 'stale', error: 'Someone changed this KPI at the same moment. Try again.' });
      activity.log(req, 'kpi_def', { target: cur.name, detail: what });
      res.json({ ok: true, def: cleanDef(doc) });
    } catch (e) { fail(res, e, 'Could not change the KPI.'); }
  });

  app.post('/api/kpi/defs-order', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'edit'); if (!a) return;
      const ids = (Array.isArray(body(req).ids) ? body(req).ids : []).map(String).slice(0, 200);
      if (!ids.length) return res.status(400).json({ ok: false, error: 'Nothing to reorder.' });
      const t = now();
      let n = 0;
      for (let i = 0; i < ids.length; i++) {
        const cur = await getDoc(DEFS, ids[i]);
        if (!cur || cur.order === (i + 1) * 10) continue;
        if (await putDoc(DEFS, Object.assign({}, cur, { order: (i + 1) * 10, updatedAt: stamp(t) + i }), cur.updatedAt)) n++;
      }
      if (n) activity.log(req, 'kpi_def', { target: 'KPI order', detail: n + ' moved' });
      res.json({ ok: true, moved: n });
    } catch (e) { fail(res, e, 'Could not reorder the KPIs.'); }
  });

  // Put back any deck KPI that is missing (never overwrites one that exists, archived or not).
  app.post('/api/kpi/seed', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      if (!adminOnly(a, res, 'restore the deck KPIs')) return;
      const have = new Set((await allDocs(DEFS)).map((d) => d._id));
      const t = now();
      let n = 0;
      for (const s of catalogue.seedDocs()) {
        if (have.has(s.id)) continue;
        const { id, ...rest } = s;
        if (await putDoc(DEFS, Object.assign({ _id: id }, rest, { createdAt: t, createdBy: actor(req, a), updatedAt: stamp(t), updatedBy: actor(req, a), history: [{ at: t, by: actor(req, a), action: 'restored from the KPI deck' }] }), null)) n++;
      }
      await patchConfig({ seededAt: (await getConfig()).seededAt || t });
      if (n) activity.log(req, 'kpi_def', { target: 'KPI deck', detail: n + ' KPI(s) restored from the deck' });
      res.json({ ok: true, added: n });
    } catch (e) { fail(res, e, 'Could not restore the deck KPIs.'); }
  });

  // The quality indicators a KPI may be linked to (for "Add KPI" / "Link to quality data").
  app.get('/api/kpi/indicators', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      const ctx = await link.loadContext([K.lastClosedMonth(now())], deps);
      res.json({ ok: true, indicators: link.indicatorCatalog(ctx), areas: link.areaList(ctx) });
    } catch (e) { fail(res, e, 'Could not load the quality indicators.'); }
  });

  /* The units Department Setup says report a KPI's indicator in a month (for "Units expected"
     → "Fill from Department Setup"). Works for an unsaved KPI too: pass indId / indName / rule. */
  app.get('/api/kpi/units', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      const ym = K.isMonth(req.query.month) ? req.query.month : K.lastClosedMonth(now());
      let def = null;
      if (req.query.kpi) { const d = await getDoc(DEFS, String(req.query.kpi)); if (d) def = Object.assign({ id: d._id }, d, { units: [] }); }
      if (!def && req.query.indId) def = { id: 'preview', source: { indId: str(req.query.indId, 100), indName: str(req.query.indName, 200), rule: link.RULES.indexOf(req.query.rule) >= 0 ? req.query.rule : null } };
      if (!def || !def.source || !def.source.indId) return res.json({ ok: true, month: ym, units: [] });
      const ctx = await link.loadContext([ym], deps);
      await E.loadSources(ctx, { now: now() }, deps);
      res.json({ ok: true, month: ym, units: E.derivedUnits(ctx, def, ym) });
    } catch (e) { fail(res, e, 'Could not work out the reporting units.'); }
  });

  /* ------------------------------------------------------------------ values */
  app.get('/api/kpi/values', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      const to = K.isMonth(req.query.to) ? req.query.to : K.lastClosedMonth(now());
      const from = K.isMonth(req.query.from) && req.query.from <= to ? req.query.from : K.addMonth(to, -5);
      const months = K.monthsBetween(from, to);
      await ensureSeed(now());
      const cfg = await getConfig();
      const defs = defsAsPlain(await allDocs(DEFS));
      const v = await valuesFor(defs, months, deps, cfg);
      // Data checks per cell (error / warn marks on the grid) — only when asked: they read the
      // submissions and Device Days too.
      let checks = null;
      if (req.query.checks === '1' && v.ctx) {
        await E.loadSources(v.ctx, { now: now() }, deps);
        const all = E.evidenceAll(v.ctx, defs, months, v.savedById, cfg);
        checks = {};
        const closed = K.lastClosedMonth(now());
        Object.keys(all).forEach((k) => { checks[k] = {}; Object.keys(all[k]).forEach((m) => {
          if (m > closed) return; // the running month and later ones owe nothing yet
          const cs = all[k][m].checks.filter((c) => c.level !== 'info');
          if (cs.length) checks[k][m] = { level: cs.some((c) => c.level === 'error') ? 'error' : 'warn', items: cs.map((c) => ({ code: c.code, level: c.level, text: c.text })) };
        }); });
      }
      res.json({ ok: true, from: months[0], to: months[months.length - 1], months, values: v.cells, checks });
    } catch (e) { fail(res, e, 'Could not load the KPI figures.'); }
  });

  // How one KPI's month was calculated: units, submissions, approvals, Device Days, checks.
  app.get('/api/kpi/evidence/:kpi/:month', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      const ym = String(req.params.month || '');
      if (!K.isMonth(ym)) return res.status(400).json({ ok: false, error: 'Invalid month.' });
      const doc = await getDoc(DEFS, String(req.params.kpi || ''));
      if (!doc) return res.status(404).json({ ok: false, error: 'This KPI no longer exists.' });
      const def = Object.assign({ id: doc._id }, doc);
      const cfg = await getConfig();
      const months = K.monthsBetween(K.addMonth(ym, -6), ym);
      const v = await valuesFor([def], months, deps, cfg);
      await E.loadSources(v.ctx, { now: now() }, deps);
      const all = E.evidenceAll(v.ctx, [def], [ym], v.savedById, cfg);
      res.json({ ok: true, evidence: all[def.id][ym], steps: K.evidenceSteps(def, all[def.id][ym]) });
    } catch (e) { fail(res, e, 'Could not work out how this figure was calculated.'); }
  });

  app.put('/api/kpi/values/:kpi/:month', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, null); if (!a) return;
      const kpiId = String(req.params.kpi || ''), ym = String(req.params.month || '');
      if (!K.isMonth(ym)) return res.status(400).json({ ok: false, error: 'Invalid month.' });
      if (ym > K.thisMonth(now())) return res.status(400).json({ ok: false, error: 'You cannot enter a month that has not come yet.' });
      const def = await getDoc(DEFS, kpiId);
      if (!def || def.active === false || def.removedAt) return res.status(404).json({ ok: false, error: 'This KPI is not active.' });
      if (def.disabled) return res.status(409).json({ ok: false, code: 'disabled', error: 'This KPI is disabled. Enable it in Manage KPIs to enter figures.' });
      const id = kpiId + ':' + ym;
      const cur = await getDoc(MONTHS, id);
      const live = cur && !cur.removedAt;
      const need = live ? 'edit' : 'add';
      if (!can(a, need) && !(need === 'add' && can(a, 'edit'))) return res.status(403).json({ ok: false, error: live ? 'Changing a saved figure needs the Nursing KPI “Edit” permission.' : 'Entering figures needs the Nursing KPI “Add” permission.' });
      const b = body(req);
      if (live && b.baseUpdatedAt !== undefined && b.baseUpdatedAt !== cur.updatedAt) {
        return res.status(409).json({ ok: false, code: 'stale', error: 'Someone else saved this month while you were typing. Their figure is shown now — check it before saving again.', current: { num: cur.num, den: cur.den, value: cur.value, note: cur.note, updatedAt: cur.updatedAt, updatedBy: cur.updatedByName || cur.updatedBy } });
      }
      const dd = Object.assign({ id: def._id }, def);
      const e = { num: numOrNull(b.num), den: numOrNull(b.den), value: numOrNull(b.value) };
      const err = K.validateEntry(dd, e);
      if (err) return res.status(400).json({ ok: false, code: 'invalid', error: err });
      const value = dd.formula === 'direct' ? e.value : K.computeValue(dd.formula, e.num, dd.formula === 'count' ? null : e.den);
      const cfg = await getConfig();
      const autoFill = K.cfgOf(cfg).autoFill !== false && dd.autoFill !== false;
      // The system figure for this month and the three before it (the latter for the deviation check).
      const prev = K.monthsBetween(K.addMonth(ym, -3), K.addMonth(ym, -1));
      const [sys, prevSaved] = await Promise.all([link.linkedMonthly(dd, prev.concat([ym]), deps), monthRows(prev[0], prev[prev.length - 1])]);
      const auto = sys[ym] || null;
      const replacing = autoFill && auto && K.has(auto.value) ? auto : null;
      const note = str(b.note, 500);
      // Changing a figure the hospital's own data produced must say why.
      if (replacing && !note) return res.status(400).json({ ok: false, code: 'note', error: 'Say why the system figure (' + K.fmt(dd, auto.value) + ') is being changed — the reason is printed on the report.' });
      // A figure far from the KPI's recent months is asked about once, before it is saved.
      const byId = new Map(prevSaved.map((r) => [r._id, r]));
      // Earlier figures count as comparison data even before the KPI's start month.
      const priors = prev.map((m) => K.resolveCell(sys[m], byId.get(kpiId + ':' + m), { autoFill }).value);
      const dev = K.deviates(value, priors);
      if (dev && b.confirm !== true) {
        return res.status(400).json({ ok: false, code: 'confirm', median: dev.median, ratio: dev.ratio,
          error: K.fmt(dd, value) + ' is ' + dev.ratio + '× the recent figure (' + K.fmt(dd, dev.median) + '). Check the numbers — save again to confirm it is right.' });
      }
      const t = now();
      const doc = {
        _id: id, kpiId, month: ym, num: dd.formula === 'direct' ? null : e.num, den: (dd.formula === 'direct' || dd.formula === 'count') ? null : e.den, value, note,
        override: !!replacing, autoAt: replacing ? { num: auto.num, den: auto.den, value: auto.value, source: auto.source } : null,
        confirmed: !!dev, deviation: dev || null,
        enteredAt: (cur && cur.enteredAt) || t, enteredBy: (cur && cur.enteredBy) || actor(req, a),
        updatedAt: stamp(t), updatedBy: actor(req, a), updatedByName: nameOf(req, a), removedAt: null, removedBy: null,
        history: ((cur && cur.history) || []).concat([{ at: t, by: actor(req, a), action: live ? 'changed' : 'entered', num: e.num, den: e.den, value, note, auto: replacing ? auto.value : undefined, confirmed: dev ? true : undefined }]).slice(-50),
      };
      if (!(await putDoc(MONTHS, doc, cur ? cur.updatedAt : null))) return res.status(409).json({ ok: false, code: 'stale', error: 'Someone else saved this month at the same moment. Reload and check before saving again.' });
      activity.log(req, 'kpi_value', { target: def.name + ' · ' + K.fmtMonth(ym), detail: (live ? 'changed to ' : 'entered ') + K.fmt(dd, value) + (replacing ? ' (system figure ' + K.fmt(dd, auto.value) + ')' : '') + (dev ? ' · confirmed ' + dev.ratio + '× the recent figure' : '') + (note ? ' · ' + note.slice(0, 120) : '') });
      res.json({ ok: true, cell: K.resolveCell(auto, doc, { autoFill }) });
    } catch (e) { fail(res, e, 'Could not save the figure.'); }
  });

  // Clear a typed month — for a linked KPI this is "revert to the system figure".
  app.delete('/api/kpi/values/:kpi/:month', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, null); if (!a) return;
      if (!can(a, 'edit') && !can(a, 'delete')) return res.status(403).json({ ok: false, error: 'Clearing a figure needs the Nursing KPI “Edit” or “Delete” permission.' });
      const kpiId = String(req.params.kpi || ''), ym = String(req.params.month || '');
      const cur = await getDoc(MONTHS, kpiId + ':' + ym);
      if (!cur || cur.removedAt) return res.json({ ok: true, unchanged: true });
      const def = await getDoc(DEFS, kpiId);
      const t = now();
      const doc = Object.assign({}, cur, { removedAt: t, removedBy: actor(req, a), updatedAt: stamp(t), updatedBy: actor(req, a), updatedByName: nameOf(req, a),
        history: (cur.history || []).concat([{ at: t, by: actor(req, a), action: cur.override ? 'reverted to the system figure' : 'cleared' }]).slice(-50) });
      if (!(await putDoc(MONTHS, doc, cur.updatedAt))) return res.status(409).json({ ok: false, error: 'Someone else saved this month at the same moment. Reload and try again.' });
      activity.log(req, 'kpi_value', { target: ((def && def.name) || kpiId) + ' · ' + K.fmtMonth(ym), detail: cur.override ? 'reverted to the system figure' : 'cleared' });
      const auto = def ? (await link.linkedMonthly(Object.assign({ id: def._id }, def), [ym], deps))[ym] : null;
      const autoFill = K.cfgOf(await getConfig()).autoFill !== false && !(def && def.autoFill === false);
      res.json({ ok: true, cell: K.resolveCell(auto, null, { autoFill }) });
    } catch (e) { fail(res, e, 'Could not clear the figure.'); }
  });

  /* ----------------------------------------------------------------- reports */
  app.get('/api/kpi/reports', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      // Opening Reports also prepares last month's draft if the cron has not yet.
      if (can(a, 'add') || can(a, 'edit')) await ensureDraft(K.lastClosedMonth(now()), 'on-open', { now, deps }).catch(() => {});
      const cfg = await getConfig();
      const list = (await allDocs(REPORTS)).filter((r) => !r.removedAt).sort((x, y) => (y.to + y.from).localeCompare(x.to + x.from))
        .map((r) => ({ id: r._id, from: r.from, to: r.to, preset: K.presetOf(r.from, r.to, cfg), state: r.state, summary: r.summary,
          generatedAt: r.generatedAt, generatedBy: r.generatedByName || r.generatedBy, finalizedAt: r.finalizedAt || null, finalizedBy: r.finalizedByName || r.finalizedBy || null, updatedAt: r.updatedAt }));
      res.json({ ok: true, reports: list });
    } catch (e) { fail(res, e, 'Could not load the reports.'); }
  });

  app.get('/api/kpi/report/:id', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      const cfg = await getConfig();
      const r = await loadReport(String(req.params.id || ''), cfg, deps, { calc: req.query.calc === '1', now: now() });
      if (!r) return res.status(400).json({ ok: false, error: 'Choose a period of up to ' + K.MAX_MONTHS + ' months.' });
      res.json({ ok: true, report: r.report });
    } catch (e) { fail(res, e, 'Could not prepare the report.'); }
  });

  /* Acknowledge an error-level data check with a reason (printed on the report), or withdraw
     the acknowledgement. Tied to the check's fingerprint: if the data changes, it lapses. */
  app.put('/api/kpi/report/:id/ack', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'edit'); if (!a) return;
      const id = String(req.params.id || '');
      const p = K.parseReportId(id);
      if (!p) return res.status(400).json({ ok: false, error: 'Invalid report.' });
      const b = body(req);
      const kpiId = str(b.kpiId, 80), ym = String(b.ym || ''), code = str(b.code, 40), unit = str(b.unit, 80);
      if (!kpiId || !K.isMonth(ym) || ym < p.from || ym > p.to || !code) return res.status(400).json({ ok: false, error: 'Which check?' });
      const cfg = await getConfig();
      let cur = await getDoc(REPORTS, id);
      if (cur && cur.removedAt) cur = null;
      if (cur && cur.state === 'final') return res.status(409).json({ ok: false, code: 'final', error: 'This report is final. An administrator can re-open it.' });
      const key = E.ackKey(kpiId, ym, code, unit);
      const t = now();
      let acks = ((cur && cur.acks) || []).filter((x) => x && x.key !== key);
      let detail;
      if (b.revoke === true) detail = 'withdrawn';
      else {
        const reason = str(b.reason, 600);
        if (reason.length < 10) return res.status(400).json({ ok: false, code: 'reason', error: 'Write the reason in a sentence (at least 10 characters) — it is printed on the report.' });
        // The check must exist now, as an error, and the acknowledgement takes its current fingerprint.
        const docDef = await getDoc(DEFS, kpiId);
        if (!docDef) return res.status(404).json({ ok: false, error: 'This KPI no longer exists.' });
        const def = Object.assign({ id: docDef._id }, docDef);
        const v = await valuesFor([def], K.monthsBetween(K.addMonth(ym, -6), ym), deps, cfg);
        await E.loadSources(v.ctx, { now: t }, deps);
        const ev = E.evidenceAll(v.ctx, [def], [ym], v.savedById, cfg)[def.id][ym];
        const check = ev.checks.find((c) => c.code === code && (c.unit || '') === unit);
        if (!check) return res.status(409).json({ ok: false, code: 'gone', error: 'This check no longer applies — the data has changed. Reload the report.' });
        if (check.level !== 'error') return res.status(400).json({ ok: false, error: 'Only errors need an acknowledgement.' });
        acks = acks.concat([{ key, kpiId, ym, code, unit, by: actor(req, a), byName: nameOf(req, a), at: t, reason, fingerprint: check.fingerprint, text: check.text }]);
        detail = code + (unit ? ' · ' + unit : '') + ' · ' + reason.slice(0, 160);
      }
      const live = cur ? {} : await computeReport(p.from, p.to, cfg, deps);
      const doc = Object.assign({ _id: id, from: p.from, to: p.to, state: 'draft', commentary: {}, overall: '', signoff: {}, generatedAt: t, generatedBy: actor(req, a), generatedByName: nameOf(req, a) }, live, cur || {}, {
        acks, removedAt: null, updatedAt: stamp(t), updatedBy: actor(req, a),
        history: ((cur && cur.history) || []).concat([{ at: t, by: actor(req, a), action: 'check ' + (b.revoke === true ? 'acknowledgement withdrawn' : 'acknowledged') + ': ' + key }]).slice(-60),
      });
      if (!(await putDoc(REPORTS, doc, cur ? cur.updatedAt : null))) return res.status(409).json({ ok: false, code: 'stale', error: 'Someone else saved this report at the same moment. Reload and try again.' });
      activity.log(req, 'kpi_ack', { target: K.fmtRange(p.from, p.to), detail: (b.revoke === true ? 'withdrawn · ' : '') + detail });
      res.json({ ok: true, acks: doc.acks, updatedAt: doc.updatedAt });
    } catch (e) { fail(res, e, 'Could not save the acknowledgement.'); }
  });

  // Generate (save) a report for a period; on an existing draft this refreshes its figures.
  app.post('/api/kpi/report', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, null); if (!a) return;
      if (!can(a, 'add') && !can(a, 'edit')) return res.status(403).json({ ok: false, error: 'Generating a report needs the Nursing KPI “Add” or “Edit” permission.' });
      const b = body(req);
      const id = K.reportId(b.from, b.to);
      const p = K.parseReportId(id);
      if (!p) return res.status(400).json({ ok: false, error: 'Choose a period of up to ' + K.MAX_MONTHS + ' months, ending no later than this month.' });
      if (p.to > K.thisMonth(now())) return res.status(400).json({ ok: false, error: 'A report cannot end after this month.' });
      const cfg = await getConfig();
      const cur = await getDoc(REPORTS, id);
      if (cur && !cur.removedAt && cur.state === 'final') return res.json({ ok: true, report: reportOut(cur, null, cfg), existed: true });
      const t = now();
      const live = await computeReport(p.from, p.to, cfg, deps);
      const keep = cur && !cur.removedAt ? cur : null;
      const doc = Object.assign({ _id: id, from: p.from, to: p.to, state: 'draft', commentary: keep ? keep.commentary : {}, overall: keep ? keep.overall : '', signoff: keep ? keep.signoff : {} }, live, {
        generatedAt: keep ? keep.generatedAt : t, generatedBy: keep ? keep.generatedBy : actor(req, a), generatedByName: keep ? keep.generatedByName : nameOf(req, a),
        refreshedAt: t, updatedAt: stamp(t), updatedBy: actor(req, a), removedAt: null,
        history: ((cur && cur.history) || []).concat([{ at: t, by: actor(req, a), action: keep ? 'figures refreshed' : 'generated' }]).slice(-60),
      });
      if (!(await putDoc(REPORTS, doc, cur ? cur.updatedAt : null))) return res.status(409).json({ ok: false, error: 'Someone else saved this report at the same moment. Reload and try again.' });
      activity.log(req, 'kpi_report', { target: K.fmtRange(p.from, p.to), detail: keep ? 'figures refreshed' : 'generated' });
      res.json({ ok: true, report: reportOut(doc, null, cfg) });
    } catch (e) { fail(res, e, 'Could not generate the report.'); }
  });

  // Commentary, overall summary and sign-off names on a draft.
  app.put('/api/kpi/report/:id', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'edit'); if (!a) return;
      const id = String(req.params.id || '');
      const p = K.parseReportId(id);
      if (!p) return res.status(400).json({ ok: false, error: 'Invalid report.' });
      const cfg = await getConfig();
      let cur = await getDoc(REPORTS, id);
      if (cur && cur.removedAt) cur = Object.assign({}, cur, { state: 'draft' });
      if (cur && cur.state === 'final') return res.status(409).json({ ok: false, code: 'final', error: 'This report is final. An administrator can re-open it.' });
      const b = body(req);
      if (cur && b.baseUpdatedAt !== undefined && b.baseUpdatedAt !== cur.updatedAt) return res.status(409).json({ ok: false, code: 'stale', error: 'Someone else changed this report while you were writing. Reload to see their changes — copy your text first.' });
      const t = now();
      const comm = Object.assign({}, (cur && cur.commentary) || {});
      if (b.commentary && typeof b.commentary === 'object') Object.keys(b.commentary).slice(0, 200).forEach((k) => { const v = str(b.commentary[k], 3000); if (v) comm[String(k).slice(0, 80)] = v; else delete comm[k]; });
      const sig = Object.assign({}, (cur && cur.signoff) || {});
      if (b.signoff && typeof b.signoff === 'object') ['prepared', 'reviewed', 'recommended', 'approved'].forEach((k) => { if (b.signoff[k] !== undefined) sig[k] = str(b.signoff[k], 120); });
      const live = cur ? {} : await computeReport(p.from, p.to, cfg, deps);
      const doc = Object.assign({ _id: id, from: p.from, to: p.to, state: 'draft', generatedAt: t, generatedBy: actor(req, a), generatedByName: nameOf(req, a) }, live, cur || {}, {
        commentary: comm, overall: b.overall !== undefined ? str(b.overall, 6000) : ((cur && cur.overall) || ''), signoff: sig, removedAt: null,
        updatedAt: stamp(t), updatedBy: actor(req, a), history: ((cur && cur.history) || []).concat([{ at: t, by: actor(req, a), action: 'commentary saved' }]).slice(-60),
      });
      if (!(await putDoc(REPORTS, doc, cur ? cur.updatedAt : null))) return res.status(409).json({ ok: false, code: 'stale', error: 'Someone else saved this report at the same moment. Reload — copy your text first.' });
      res.json({ ok: true, updatedAt: doc.updatedAt });
    } catch (e) { fail(res, e, 'Could not save the commentary.'); }
  });

  // Final: the figures are frozen as they stand now. Later edits do not change a final report.
  app.post('/api/kpi/report/:id/finalize', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'edit'); if (!a) return;
      const id = String(req.params.id || '');
      const p = K.parseReportId(id);
      if (!p) return res.status(400).json({ ok: false, error: 'Invalid report.' });
      const cfg = await getConfig();
      const cur = await getDoc(REPORTS, id);
      if (cur && !cur.removedAt && cur.state === 'final') return res.json({ ok: true, report: reportOut(cur, null, cfg), unchanged: true });
      const t = now();
      // Zero tolerance: every error-level data check must be fixed or acknowledged with a
      // reason (for exactly the data it looked at) before the figures can be frozen.
      const live = await computeReport(p.from, p.to, cfg, deps, { calc: true, now: t });
      const keep = cur && !cur.removedAt ? cur : {};
      const acks = (keep.acks || []).filter((x) => x && !x.revokedAt);
      const open = E.unresolved(live.evidence || {}, acks);
      if (open.length) {
        return res.status(409).json({ ok: false, code: 'checks', unresolved: open,
          error: open.length + ' data check' + (open.length > 1 ? 's' : '') + ' must be fixed or acknowledged with a reason before this report can be finalised.' });
      }
      // Acknowledgements that no longer match their data are dropped from the final record.
      const live2 = evidenceOfRows(live.rows);
      const usedAcks = acks.filter((x) => (((live2[x.kpiId] || {})[x.ym] || {}).checks || []).some((c) => E.ackKey(x.kpiId, x.ym, c.code, c.unit) === x.key && c.fingerprint === x.fingerprint));
      delete live.evidence;
      const doc = Object.assign({ _id: id, from: p.from, to: p.to, commentary: {}, overall: '', signoff: {}, generatedAt: t, generatedBy: actor(req, a), generatedByName: nameOf(req, a) }, keep, live, {
        acks: usedAcks, state: 'final', finalizedAt: t, finalizedBy: actor(req, a), finalizedByName: nameOf(req, a), removedAt: null,
        updatedAt: stamp(t), updatedBy: actor(req, a), history: ((cur && cur.history) || []).concat([{ at: t, by: actor(req, a), action: 'finalised' + (usedAcks.length ? ' with ' + usedAcks.length + ' acknowledged check(s)' : '') }]).slice(-60),
      });
      if (!(await putDoc(REPORTS, doc, cur ? cur.updatedAt : null))) return res.status(409).json({ ok: false, error: 'Someone else saved this report at the same moment. Reload and try again.' });
      activity.log(req, 'kpi_report_final', { target: K.fmtRange(p.from, p.to), detail: 'finalised · ' + live.summary.met + ' on target, ' + live.summary.off + ' need action, ' + live.summary.nodata + ' no data'
        + (usedAcks.length ? ' · acknowledged: ' + usedAcks.map((x) => x.code + (x.unit ? ' ' + x.unit : '') + ' (' + x.byName + ')').join('; ').slice(0, 500) : '') + ' · data ' + String(live.dataFingerprint || '').slice(7, 15) });
      res.json({ ok: true, report: reportOut(doc, null, cfg) });
    } catch (e) { fail(res, e, 'Could not finalise the report.'); }
  });

  app.post('/api/kpi/report/:id/reopen', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      if (!adminOnly(a, res, 're-open a final report')) return;
      const id = String(req.params.id || '');
      const cur = await getDoc(REPORTS, id);
      if (!cur || cur.removedAt || cur.state !== 'final') return res.status(404).json({ ok: false, error: 'There is no final report for this period.' });
      const t = now();
      const doc = Object.assign({}, cur, { state: 'draft', reopenedAt: t, reopenedBy: actor(req, a), updatedAt: stamp(t), updatedBy: actor(req, a),
        history: (cur.history || []).concat([{ at: t, by: actor(req, a), action: 're-opened (was final ' + new Date(cur.finalizedAt || t).toISOString().slice(0, 10) + ')' }]).slice(-60) });
      if (!(await putDoc(REPORTS, doc, cur.updatedAt))) return res.status(409).json({ ok: false, error: 'Someone else changed this report at the same moment. Try again.' });
      activity.log(req, 'kpi_report_reopen', { target: K.fmtRange(cur.from, cur.to), detail: 're-opened for changes' });
      res.json({ ok: true });
    } catch (e) { fail(res, e, 'Could not re-open the report.'); }
  });

  app.delete('/api/kpi/report/:id', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'delete'); if (!a) return;
      const id = String(req.params.id || '');
      const cur = await getDoc(REPORTS, id);
      if (!cur || cur.removedAt) return res.json({ ok: true, unchanged: true });
      if (cur.state === 'final' && !a.unrestricted) return res.status(403).json({ ok: false, error: 'Only an administrator can remove a final report.' });
      const t = now();
      const doc = Object.assign({}, cur, { removedAt: t, removedBy: actor(req, a), updatedAt: stamp(t), history: (cur.history || []).concat([{ at: t, by: actor(req, a), action: 'removed' }]).slice(-60) });
      if (!(await putDoc(REPORTS, doc, cur.updatedAt))) return res.status(409).json({ ok: false, error: 'Someone changed this report at the same moment. Try again.' });
      activity.log(req, 'kpi_report', { target: K.fmtRange(cur.from, cur.to), detail: 'removed (' + cur.state + ')' });
      res.json({ ok: true });
    } catch (e) { fail(res, e, 'Could not remove the report.'); }
  });

  /* ----------------------------------------------------------------- exports */
  const exportFile = (kind) => async (req, res) => {
    try {
      const a = await resolve(req, res, 'print'); if (!a) return;
      const cfg = await getConfig();
      const style = ['summary', 'calc'].indexOf(req.query.style) >= 0 ? req.query.style : 'full';
      // Excel and the "with calculations" deck carry the evidence; the other decks do not need it.
      const r = await loadReport(String(req.params.id || ''), cfg, deps, { calc: kind === 'xlsx' || style === 'calc', now: now() });
      if (!r) return res.status(400).json({ ok: false, error: 'Invalid report period.' });
      activity.log(req, 'kpi_export', { target: K.fmtRange(r.report.from, r.report.to), detail: kind === 'pptx' ? 'PowerPoint (' + style + ')' : 'Excel' });
      // Build the whole file BEFORE any header: an error after the headers would hand the
      // browser an unreadable attachment instead of a message.
      const buf = kind === 'pptx'
        ? await require('./kpi-pptx').build(r.report, { style, cfg: K.cfgOf(cfg), by: nameOf(req, a), now: now() })
        : await require('./kpi-xlsx').build(r.report, { cfg: K.cfgOf(cfg), by: nameOf(req, a), now: now() });
      const name = 'Nursing-KPI-' + (r.report.from === r.report.to ? r.report.from : r.report.from + '-to-' + r.report.to) + (kind === 'pptx' ? '-' + style + '.pptx' : '.xlsx');
      res.set('Cache-Control', 'no-store');
      res.set('Content-Type', kind === 'pptx' ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.set('Content-Disposition', 'attachment; filename="' + name + '"');
      res.end(buf);
    } catch (e) { fail(res, e, kind === 'pptx' ? 'Could not build the PowerPoint file.' : 'Could not build the Excel file.'); }
  };
  app.get('/api/kpi/report/:id/pptx', guard, exportFile('pptx'));
  app.get('/api/kpi/report/:id/xlsx', guard, exportFile('xlsx'));

  // Print and PDF are made in the browser; they are recorded here first.
  app.post('/api/kpi/print', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'print'); if (!a) return;
      const b = body(req);
      const p = K.parseReportId(b.id);
      const kind = b.kind === 'pdf' ? 'PDF' : 'print';
      activity.log(req, 'kpi_print', { target: p ? K.fmtRange(p.from, p.to) : 'Nursing KPI', detail: kind + (b.what ? ' · ' + str(b.what, 60) : '') });
      res.json({ ok: true });
    } catch (e) { fail(res, e, 'Could not record the print.'); }
  });

  /* ------------------------------------------------------------ badge / gaps */
  app.get('/api/kpi/missing', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      const ym = K.isMonth(req.query.month) ? req.query.month : K.lastClosedMonth(now());
      const docs = await allDocs(DEFS);
      const cfg = await getConfig();
      const defs = defsAsPlain(docs);
      const cells = (await valuesFor(defs, [ym], deps, cfg)).cells;
      const missing = [], partial = [];
      defs.forEach((d) => {
        const c = cells[d.id][ym];
        if (c.notStarted) return; // a KPI that has not started yet owes nothing
        if (c.source === 'partial') partial.push({ id: d.id, code: d.code, name: d.name });
        else if (!K.has(c.value)) missing.push({ id: d.id, code: d.code, name: d.name, linked: !!(d.source && d.source.indId) });
      });
      const rep = await getDoc(REPORTS, K.reportId(ym, ym));
      const report = rep && !rep.removedAt ? { id: rep._id, state: rep.state } : null;
      const canAct = can(a, 'add') || can(a, 'edit');
      const reportReady = !!(report && report.state === 'draft' && can(a, 'edit'));
      res.json({ ok: true, month: ym, missing, partial, report, reportReady, total: canAct ? missing.length + (reportReady ? 1 : 0) : 0 });
    } catch (e) { fail(res, e, 'Could not check the KPI figures.'); }
  });

  /* ---------------------------------------------------------------- settings */
  app.get('/api/kpi/config', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      const cfgDoc = await getConfig();
      res.json({ ok: true, config: K.cfgOf(cfgDoc), automation: cfgDoc.automation || null, seededAt: cfgDoc.seededAt || null });
    } catch (e) { fail(res, e, 'Could not load the settings.'); }
  });

  app.put('/api/kpi/config', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      if (!adminOnly(a, res, 'change the Nursing KPI settings')) return;
      const b = body(req);
      const cur = K.cfgOf(await getConfig());
      const set = {};
      if (b.cycleStart !== undefined) { if (!K.isMonth(b.cycleStart)) return res.status(400).json({ ok: false, error: 'Choose the month the first cycle starts.' }); set.cycleStart = b.cycleStart; }
      if (b.cycleMonths !== undefined) set.cycleMonths = Math.min(Math.max(parseInt(b.cycleMonths, 10) || 6, 1), 24);
      if (b.cycles !== undefined) set.cycles = Math.min(Math.max(parseInt(b.cycles, 10) || 2, 1), 6);
      if (b.nearBand !== undefined) set.nearBand = Math.min(Math.max(Number(b.nearBand) || 0, 0), 50);
      if (b.reportTitle !== undefined) set.reportTitle = str(b.reportTitle, 120) || K.DEFAULT_CFG.reportTitle;
      if (b.hospitalName !== undefined) set.hospitalName = str(b.hospitalName, 120) || K.DEFAULT_CFG.hospitalName;
      // Master switch: fill linked KPIs from the quality data by themselves (each KPI can still be off).
      if (b.autoFill !== undefined) set.autoFill = b.autoFill !== false;
      if (Array.isArray(b.pillars)) {
        const ids = new Set();
        // Pillar ids are the KPIs' keys: kept as they are, a new one gets a slug of its label.
        set.pillars = b.pillars.slice(0, 12).filter((p) => p && str(p.label, 80)).map((p, i) => {
          let id = /^[a-z0-9-]{1,32}$/.test(String(p.id || '')) ? p.id : (K.slug(p.label) || 'pillar');
          while (ids.has(id)) id += '-2';
          ids.add(id);
          return { id, label: str(p.label, 80), color: /^#[0-9a-f]{6}$/i.test(String(p.color || '')) ? p.color : '#5b6878', order: i + 1 };
        });
        if (!set.pillars.length) return res.status(400).json({ ok: false, error: 'Keep at least one pillar.' });
      }
      const changed = Object.keys(set).filter((k) => JSON.stringify(cur[k]) !== JSON.stringify(set[k]));
      if (!changed.length) return res.json({ ok: true, changed: 0, config: cur });
      set.updatedAt = now(); set.updatedBy = actor(req, a);
      await patchConfig(set);
      activity.log(req, 'kpi_config', { target: 'Nursing KPI settings', detail: changed.map((k) => k + (typeof set[k] !== 'object' ? ' → ' + set[k] : '')).join(', ').slice(0, 600) });
      res.json({ ok: true, changed: changed.length, config: K.cfgOf(await getConfig()) });
    } catch (e) { fail(res, e, 'Could not save the settings.'); }
  });
}

module.exports = { mount, ensureDraft, ensureSeed, computeReport, _mem: mem };
