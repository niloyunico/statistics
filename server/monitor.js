/* UNICO — data-integrity monitor: "did anything go missing?"
 *
 * WHY
 * Data went missing several times in September 2026 for reasons nobody could see at
 * the time: writes split across two database clusters, a stale browser tab saving an
 * old staff roster over a new one, saves that failed only in one person's browser.
 * Each was discovered days later, by a user noticing a blank. This module makes a loss
 * visible the day it happens, and says WHAT went missing and WHOSE record it was.
 *
 * WHAT IT DOES
 *   1. collect(): counts what the hospital has entered — documents per collection,
 *      staff-register rows and filled key fields (with the ids, so a cleared field can
 *      be named), statistics values and quality readings per department, submissions by
 *      status, the size of every saved app-state key, and the D1 tables.
 *   2. compare(prev, cur): anything that went DOWN since the previous snapshot becomes a
 *      finding. Deletions are sometimes deliberate — the finding says what changed; the
 *      Activity Log says who did it.
 *   3. Browser save failures: renderer/unico/monitor.jsx reports every save the database
 *      refused or never received (POST /api/monitor/event -> `monitorEvents`), so an
 *      administrator hears "Rahima's save failed at 10:42" the same day.
 *   4. Configuration guard: flags a second database (MONGODB_URIS) or Redis coming back,
 *      because that is exactly the setup that split the data.
 *
 * Snapshots are stored in `monitorSnapshots` (one small document per run) and events in
 * `monitorEvents`. Nothing here ever deletes or edits hospital data.
 *
 * Runs daily inside the existing /api/keepalive cron (Vercel Hobby allows two crons and
 * both are taken), on the PC server's keep-alive timer, and on demand from
 * Settings -> System Monitor.
 */
const { getDbHandle, getAppData } = require('./db');

const COLL_SNAP = 'monitorSnapshots';
const COLL_EVENTS = 'monitorEvents';
// Not hospital data: backups of old migrations, this module's own records, heartbeats.
// loginThrottle expires by design (TTL index) — its drops are not lost data.
const SKIP_COLLECTIONS = /_bak_|^monitor|^keepalive$|^sync_meta$|^backupRuns$|^loginThrottle$|^system\./;
// Records removed here as part of normal use (a chat message deleted, a request
// withdrawn). A drop is still reported, as a notice rather than an alert.
const EXPECTED_DELETES = new Set(['phoneMessages', 'phoneRooms', 'phoneUserState', 'phoneNotices',
  'phoneRequests', 'phoneHandover', 'shortlinks', 'staffRequests']);
// Staff fields whose loss people have actually reported, or that are costly to re-enter.
const STAFF_FIELDS = {
  extracurricular: 'Extracurricular activities', photo: 'Photo', licence_verified: 'BNMC verification',
  licence_expiry: 'Licence expiry', emp_id: 'Employee ID', phone: 'Phone', qualification: 'Qualification',
  doj: 'Date of joining', dob: 'Date of birth', special_training: 'Special training',
  hepatitis_b_vaccination: 'Hepatitis B vaccination',
};
const SCHEDULE_GAP_MS = 20 * 3600 * 1000;   // the daily cron and the PC timer never double up
const EVENT_KINDS = ['save_failed', 'save_conflict', 'save_forbidden', 'save_unconfirmed'];

const blank = (v) => v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length)
  || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);

function keyLabel(k) {
  try { return require('./audit').KEY_LABELS[k] || k; } catch (e) { return k; }
}

/* ---- metrics (pure) ------------------------------------------------------------ */

function staffMetrics(raw) {
  let rows;
  try { rows = typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw || []); } catch (e) { return { error: 'The staff register could not be read.' }; }
  if (!Array.isArray(rows)) return { error: 'The staff register is not a list.' };
  const out = { rows: rows.length, active: 0, former: 0, ids: {}, filled: {} };
  Object.keys(STAFF_FIELDS).forEach((f) => { out.filled[f] = []; });
  rows.forEach((r) => {
    if (!r || r.id == null) return;
    const id = String(r.id);
    out.ids[id] = String(r.name || '').slice(0, 60);
    if (r.former) out.former++; else if (r.is_active !== false) out.active++;
    Object.keys(STAFF_FIELDS).forEach((f) => {
      const v = f === 'photo' ? (r.photo || r.photo_url) : r[f];
      if (!blank(v)) out.filled[f].push(id);
    });
  });
  return out;
}

function deptMetrics(depts) {
  const out = {};
  (depts || []).forEach((d) => {
    if (!d) return;
    const id = String(d._id != null ? d._id : d.id);
    let rows = 0, cells = 0, readings = 0;
    const data = d.data && typeof d.data === 'object' ? d.data : {};
    Object.keys(data).forEach((k) => {
      const row = data[k] && typeof data[k] === 'object' ? data[k] : {};
      const n = Object.keys(row).filter((c) => !blank(row[c])).length;
      if (n) { rows++; cells += n; }
    });
    ((d.quality && d.quality.indicators) || []).forEach((ind) => {
      const m = (ind && ind.months) || {};
      readings += Object.keys(m).filter((k) => m[k] !== null && m[k] !== undefined && m[k] !== '').length;
    });
    out[id] = { name: String(d.name || id).slice(0, 60), rows, cells, readings };
  });
  return out;
}

function appdataBytes(data) {
  const out = {};
  Object.keys(data || {}).forEach((k) => { if (typeof data[k] === 'string') out[k] = data[k].length; });
  return out;
}

function configFindings(env) {
  const e = env || process.env;
  const f = [];
  const uris = String(e.MONGODB_URIS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (uris.length > 1) {
    f.push({ level: 'alert', area: 'configuration', message: 'MONGODB_URIS lists ' + uris.length + ' databases — automatic failover is switched on again. That is the setup that split the data in September 2026. Remove MONGODB_URIS and keep only MONGODB_URI.' });
  }
  if (e.UPSTASH_REDIS_REST_URL || e.KV_REST_API_URL || e.REDIS_REST_URL) {
    f.push({ level: 'notice', area: 'configuration', message: 'Redis credentials are configured again. The app now runs without Redis; make sure nothing decides where data is written through it.' });
  }
  return f;
}

/* ---- comparison (pure) --------------------------------------------------------- */

function compare(prev, cur) {
  const f = [];
  if (!prev || !cur) return f;
  const add = (level, area, message, details) => f.push({ level, area, message, details: details && details.length ? details.slice(0, 50) : null });
  const who = (ids, id) => (ids && ids[id] ? ids[id] : 'Unnamed') + ' (#' + id + ')';

  const pc = prev.collections || {}, cc = cur.collections || {};
  Object.keys(pc).forEach((n) => {
    const a = pc[n], b = cc[n];
    const level = EXPECTED_DELETES.has(n) ? 'notice' : 'alert';
    if (b === undefined) add(level, 'database', 'Collection "' + n + '" is gone (it had ' + a + ' records).');
    else if (b < a) add(level, 'database', n + ': ' + (a - b) + ' record(s) removed (' + a + ' → ' + b + ').');
  });

  const ps = prev.staff || {}, cs = cur.staff || {};
  if (cs.error) add('alert', 'staff', cs.error);
  if (ps.ids && cs.ids) {
    const gone = Object.keys(ps.ids).filter((id) => !(id in cs.ids));
    if (gone.length) add('alert', 'staff', gone.length + ' staff record(s) removed from the register.', gone.map((id) => who(ps.ids, id)));
    Object.keys(STAFF_FIELDS).forEach((field) => {
      const now = new Set((cs.filled || {})[field] || []);
      const cleared = ((ps.filled || {})[field] || []).filter((id) => !now.has(id) && (id in cs.ids));
      if (cleared.length) add('alert', 'staff', STAFF_FIELDS[field] + ' cleared for ' + cleared.length + ' staff.', cleared.map((id) => who(cs.ids, id)));
    });
  }

  const pd = prev.depts || {}, cd = cur.depts || {};
  Object.keys(pd).forEach((id) => {
    const a = pd[id], b = cd[id];
    if (!b) { add('alert', 'statistics', 'Department "' + a.name + '" is gone.'); return; }
    if (b.cells < a.cells) add('alert', 'statistics', a.name + ': ' + (a.cells - b.cells) + ' monthly statistics value(s) removed (' + a.cells + ' → ' + b.cells + ').');
    if (b.readings < a.readings) add('alert', 'quality', a.name + ': ' + (a.readings - b.readings) + ' quality reading(s) removed (' + a.readings + ' → ' + b.readings + ').');
  });

  const pa = prev.appdataBytes || {}, ca = cur.appdataBytes || {};
  Object.keys(pa).forEach((k) => {
    const a = pa[k], b = ca[k];
    // Same size floor as a shrink: a small key (a remembered filter, a draft) comes and goes.
    if (b === undefined) { if (a > 2000) add('alert', 'saved data', 'Saved data "' + keyLabel(k) + '" disappeared (' + a + ' bytes).'); return; }
    // Small keys (a remembered filter, a draft) legitimately shrink. A large one losing a
    // fifth of its size overnight is how a stale-tab overwrite looks from the outside.
    if (a > 2000 && b < a * 0.8) add('alert', 'saved data', 'Saved data "' + keyLabel(k) + '" shrank by ' + Math.round((1 - b / a) * 100) + '% (' + a + ' → ' + b + ' bytes).');
  });

  const p1 = prev.d1 || {}, c1 = cur.d1 || {};
  Object.keys(p1).forEach((t) => {
    if (typeof p1[t] === 'number' && typeof c1[t] === 'number' && c1[t] < p1[t]) add('alert', 'database', t + ': ' + (p1[t] - c1[t]) + ' row(s) removed (' + p1[t] + ' → ' + c1[t] + ').');
  });
  return f;
}

/* ---- browser events (pure validation) ----------------------------------------- */

function cleanEvent(body) {
  const b = body && typeof body === 'object' ? body : {};
  const kind = EVENT_KINDS.indexOf(b.kind) >= 0 ? b.kind : null;
  if (!kind) return null;
  const str = (v, n) => String(v == null ? '' : v).replace(/[ -]/g, ' ').slice(0, n).trim();
  const keys = Array.isArray(b.keys) ? b.keys.slice(0, 10).map((k) => str(k, 60)).filter(Boolean) : [];
  const at = Number(b.at);
  return {
    kind, keys, detail: str(b.detail, 300), page: str(b.page, 120),
    // When the browser could not report at once (offline), it sends the original time.
    happenedAt: at > 0 && at <= Date.now() && at > Date.now() - 7 * 864e5 ? at : null,
  };
}

/* ---- database side ---------------------------------------------------------------- */

async function rawDb() {
  const h = await getDbHandle();
  return h && h.db ? h.db : h;
}

// Read-only: gathers the metrics. Safe to run against production at any time.
async function collect() {
  const db = await rawDb();
  if (!db) throw new Error('Database not available.');
  const names = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((c) => c.name).filter((n) => !SKIP_COLLECTIONS.test(n)).sort();
  const collections = {};
  // A few at a time: the free Atlas tier caps operations per second.
  for (let i = 0; i < names.length; i += 6) {
    const part = names.slice(i, i + 6);
    const counts = await Promise.all(part.map((n) => db.collection(n).countDocuments({})));
    part.forEach((n, j) => { collections[n] = counts[j]; });
  }
  const app = await getAppData({ fresh: true, noRescue: true });
  const depts = await db.collection('departments')
    .find({}, { projection: { name: 1, data: 1, 'quality.indicators.months': 1 } }).toArray();
  const statuses = await db.collection('submissions').aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]).toArray();
  const submissions = { total: 0, byStatus: {} };
  statuses.forEach((s) => { submissions.byStatus[String(s._id)] = s.n; submissions.total += s.n; });

  const d1 = {};
  try {
    const d1store = require('./d1-store'), d1c = require('./d1');
    const tables = [['activity', 'activity_log'], ['supervisor', 'supervisor_reports']];
    for (const [mod, table] of tables) {
      if (!d1store.enabled(mod)) continue;
      const row = await d1c.get('SELECT COUNT(*) AS n FROM ' + table);
      if (row && row.n != null) d1[table] = Number(row.n);
    }
  } catch (e) { d1.error = String((e && e.message) || e).slice(0, 120); }

  return {
    collections,
    staff: staffMetrics((app.data || {}).unico_staff_v3),
    depts: deptMetrics(depts),
    appdataBytes: appdataBytes(app.data),
    submissions,
    d1,
  };
}

let running = null;

// Collect, compare with the last snapshot, store. Returns the stored snapshot.
async function snapshot(source) {
  if (running) return running;
  running = (async () => {
    const db = await rawDb();
    if (!db) throw new Error('Database not available.');
    const at = Date.now();
    const metrics = await collect();
    const prev = (await db.collection(COLL_SNAP).find({}).sort({ at: -1 }).limit(1).toArray())[0] || null;
    const findings = configFindings().concat(compare(prev, metrics));
    const doc = Object.assign({
      _id: 'snap-' + new Date(at).toISOString(),
      at, source: String(source || 'manual').slice(0, 60),
      version: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 12) || null,
      previousAt: prev ? prev.at : null,
      findings,
      alerts: findings.filter((x) => x.level === 'alert').length,
    }, metrics);
    await db.collection(COLL_SNAP).insertOne(doc);
    return doc;
  })();
  try { return await running; } finally { running = null; }
}

// For the daily cron / PC timer: at most one snapshot per SCHEDULE_GAP_MS.
async function runScheduled(source) {
  const db = await rawDb();
  if (!db) return { ok: false, skipped: 'no database' };
  const last = (await db.collection(COLL_SNAP).find({}, { projection: { at: 1 } }).sort({ at: -1 }).limit(1).toArray())[0];
  if (last && Date.now() - last.at < SCHEDULE_GAP_MS) return { ok: true, skipped: 'checked recently', lastAt: last.at };
  const s = await snapshot(source);
  return { ok: true, at: s.at, alerts: s.alerts, findings: s.findings.length };
}

// Summary for the panel. Heavy per-person lists stay in the database.
function summarize(s) {
  if (!s) return null;
  const staff = s.staff || {};
  const filled = {};
  Object.keys(staff.filled || {}).forEach((f) => { filled[f] = staff.filled[f].length; });
  const depts = s.depts || {};
  const sum = (k) => Object.keys(depts).reduce((t, id) => t + (depts[id][k] || 0), 0);
  return {
    at: s.at, source: s.source, version: s.version, alerts: s.alerts || 0, findings: s.findings || [],
    collections: s.collections || {}, submissions: s.submissions || {}, d1: s.d1 || {},
    staff: { rows: staff.rows, active: staff.active, former: staff.former, filled, error: staff.error || null },
    statisticsValues: sum('cells'), qualityReadings: sum('readings'),
    departments: Object.keys(depts).map((id) => Object.assign({ id }, depts[id])).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

async function status() {
  const db = await rawDb();
  if (!db) throw new Error('Database not available.');
  const t0 = Date.now();
  const heartbeat = await db.collection('keepalive').findOne({ _id: 'heartbeat' });
  const dbMs = Date.now() - t0;
  const snaps = await db.collection(COLL_SNAP).find({}).sort({ at: -1 }).limit(14).toArray();
  const events = await db.collection(COLL_EVENTS).find({ at: { $gte: Date.now() - 30 * 864e5 } }).sort({ at: -1 }).limit(300).toArray();
  let backup;
  try {
    const runs = await require('./backup').recentRuns(1);
    backup = runs && runs[0] ? { at: runs[0].at, ok: runs[0].ok !== false, error: runs[0].error || null } : null;
  } catch (e) { backup = undefined; }   // backup module not installed in this deployment
  const redis = require('./redis');
  return {
    ok: true,
    health: {
      dbMs, lastKeepalive: heartbeat && heartbeat.lastPing ? new Date(heartbeat.lastPing).getTime() : null,
      singleDatabase: String(process.env.MONGODB_URIS || '').split(',').filter((x) => x.trim()).length < 2,
      redisConfigured: redis.configured(),
      cacheDisabled: String(process.env.CACHE_DISABLED || '').toLowerCase() === 'true',
      version: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 12) || null,
      backup,
    },
    config: configFindings(),
    latest: summarize(snaps[0]),
    history: snaps.map((s) => {
      const x = summarize(s);
      return { at: x.at, alerts: x.alerts, findings: x.findings, staffRows: x.staff.rows, activities: x.staff.filled.extracurricular || 0,
        submissions: x.submissions.total || 0, statisticsValues: x.statisticsValues, qualityReadings: x.qualityReadings };
    }),
    events: events.map((e) => ({ at: e.at, happenedAt: e.happenedAt || null, kind: e.kind, name: e.name, username: e.username, role: e.role, keys: e.keys, detail: e.detail, page: e.page })),
  };
}

const eventRate = new Map();   // username -> recent report times (per instance; a courtesy limit)

async function recordEvent(req, body) {
  const ev = cleanEvent(body);
  if (!ev) return { ok: false, status: 400, error: 'Unknown event.' };
  const u = req.user || {};
  const username = String(u.sub || (req.access && req.access.username) || 'local');
  const now = Date.now();
  const recent = (eventRate.get(username) || []).filter((t) => now - t < 600000);
  if (recent.length >= 20) return { ok: true, throttled: true };
  recent.push(now); eventRate.set(username, recent);
  const db = await rawDb();
  if (!db) return { ok: false, status: 503, error: 'Database not available.' };
  await db.collection(COLL_EVENTS).insertOne(Object.assign({
    _id: 'ev-' + now.toString(36) + '-' + Math.floor(Math.random() * 1e8).toString(36),
    at: now, username, name: String(u.name || username).slice(0, 80), role: String(u.role || '').slice(0, 40),
  }, ev));
  return { ok: true };
}

function mount(app, opts) {
  const guard = (opts && opts.requireApi) || [];
  const adminOnly = (req, res, next) => (req.access && req.access.unrestricted)
    ? next() : res.status(403).json({ ok: false, error: 'Administrator access required.' });

  app.get('/api/monitor/status', guard, adminOnly, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try { res.json(await status()); }
    catch (e) { res.status(503).json({ ok: false, error: 'The monitor could not reach the database.' }); }
  });
  app.post('/api/monitor/run', guard, adminOnly, async (req, res) => {
    try {
      const s = await snapshot('manual: ' + ((req.user && (req.user.name || req.user.sub)) || 'admin'));
      res.json({ ok: true, snapshot: summarize(s) });
    } catch (e) { res.status(503).json({ ok: false, error: 'The check could not complete: ' + String((e && e.message) || e).slice(0, 160) }); }
  });
  // Any signed-in person: their own browser reporting that one of their saves failed.
  app.post('/api/monitor/event', guard, async (req, res) => {
    try {
      const r = await recordEvent(req, req.body);
      if (!r.ok) return res.status(r.status || 400).json({ ok: false, error: r.error });
      res.json(r);
    } catch (e) { res.status(503).json({ ok: false, error: 'Not recorded.' }); }
  });
}

module.exports = {
  mount, snapshot, runScheduled, status, collect, recordEvent,
  // pure helpers, exported for tests
  compare, staffMetrics, deptMetrics, appdataBytes, configFindings, cleanEvent, summarize,
  COLL_SNAP, COLL_EVENTS, STAFF_FIELDS,
};
