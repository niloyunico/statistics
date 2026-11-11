/* UNICO — the daily, VERIFIED backup of all saved data to Cloudflare R2.
 *
 * What is kept (one "run" per day, plus any run an administrator starts):
 *   - every MongoDB collection → canonical Extended JSON (types preserved), gzip
 *     EXCEPT Supervisor Reports and the H360 patient data collected for them (user 2026-11-11:
 *     re-readable from H360), and pure caches / the backup's own bookkeeping (EXCLUDED below)
 *   - every Cloudflare D1 table → JSON rows + the CREATE statement, gzip, in parts of 5,000 rows
 *   - every file in Vercel Blob (staff photos, uploads) → copied once to files/<pathname>
 *     (Blob files never change, so a file is never copied twice)
 *
 * Layout in the bucket:
 *   unico-backups/<YYYY>/<MM>/<DD>/<HHMMSS>Z-<reason>/manifest.json
 *   unico-backups/<run>/mongo/<collection>.ejson.gz
 *   unico-backups/<run>/d1/<table>/part-<n>.json.gz
 *   unico-backups/files/<blob pathname>
 *   unico-backups/latest.json   → the newest VERIFIED manifest
 * A dataset byte-identical to the last run is not uploaded again — its manifest entry points at
 * the earlier object (same SHA-256) — so every manifest still describes the COMPLETE database.
 *
 * A run goes through phases, each resumable, so it finishes even though one Vercel request
 * may only run 60 s:  mongo → d1 → files → verify → done.
 *   verify: everything written in this run is downloaded again, unzipped and its SHA-256
 *   compared; everything reused is checked to exist with the right size; on Sundays (and on
 *   the very first run) EVERY dataset is downloaded and checked, Mongo document counts too.
 *   Only a verified run becomes latest.json.
 * Triggers: Vercel crons at 03:00 / 03:30 / 04:00 / 05:00 Dhaka (each continues today's run,
 * so a failed call is retried by the next), "Back up now" in Settings (browser-driven steps),
 * and an hourly check on the long-running PC server.
 *
 * Safety: read-only against the databases (writes only backupRuns / backupStats / backupFiles);
 * append-only in R2 (server/r2.js has no delete); restore is a separate, additive script
 * (scripts/restore-from-r2.js).
 */
const zlib = require('zlib');
const crypto = require('crypto');
const { EJSON } = require('bson');

const ROOT = 'unico-backups';
const RUNS = 'backupRuns';
const STATS = 'backupStats';
const FILES = 'backupFiles';
const LIMIT_BYTES = 10 * 1024 * 1024 * 1024;          // the Cloudflare R2 free storage
const WARN_BYTES = 8 * 1024 * 1024 * 1024;
const EXCLUDED = [
  // Supervisor Reports and the H360 patient data collected for them (re-readable from H360)
  'supervisorReports', 'h360Patients', 'h360Modules', 'h360Runs', 'h360Opd', 'h360Register', 'h360Sheets',
  // caches and the backup's own bookkeeping (backupConfig holds the sealed R2 key itself)
  'cacheMeta', 'keepalive', 'loginThrottle', 'bnmcPhotos', RUNS, STATS, FILES, 'backupConfig',
];
const EXCLUDED_D1 = /supervisor/i;
const STATIC_D1 = /^meds_/;          // the rebuildable medicine catalogue: carried forward on weekdays
const D1_PAGE = 500, D1_PART = 5000;
const LOCK_MS = 75000;

const sha256hex = (b) => crypto.createHash('sha256').update(b).digest('hex');
const pad = (n, w) => String(n).padStart(w || 2, '0');
const dhakaDay = (t) => new Date((t == null ? Date.now() : t) + 6 * 3600 * 1000).toISOString().slice(0, 10);
const isSunday = (t) => new Date((t == null ? Date.now() : t) + 6 * 3600 * 1000).getUTCDay() === 0;

function createBackup(deps = {}) {
  const r2 = deps.r2 || require('./r2');
  const getDb = deps.getDb || (async () => { const h = await require('./db').getDbHandle(); return h && h.db ? h.db : h; });
  const d1 = deps.d1 || require('./d1');
  const blobStore = () => {
    if (deps.blob !== undefined) return deps.blob;
    try { const b = require('./storage-blob'); return b.configured() ? b : null; } catch (e) { return null; }
  };
  const now = deps.now || (() => Date.now());

  async function db() { const d = await getDb(); if (!d) throw new Error('The database is not connected.'); return d; }

  async function readLatestManifest() {
    try {
      const ptr = JSON.parse((await r2.getObject(ROOT + '/latest.json')).toString('utf8'));
      return ptr && ptr.manifestKey ? JSON.parse((await r2.getObject(ptr.manifestKey)).toString('utf8')) : null;
    } catch (e) { if (e.status === 404) return null; throw e; }
  }

  // Upload (or reuse) one dataset. `text` is the full uncompressed serialization.
  async function store(key, text, count, prevEntry) {
    const sha = sha256hex(text);
    if (prevEntry && prevEntry.sha256 === sha && prevEntry.count === count && prevEntry.key) {
      const still = await r2.headObject(prevEntry.key);
      if (still && still.bytes === prevEntry.bytes) return { key: prevEntry.key, count, sha256: sha, rawBytes: prevEntry.rawBytes, bytes: prevEntry.bytes, reused: true };
    }
    const gz = zlib.gzipSync(Buffer.from(text, 'utf8'), { level: 9 });
    await r2.putObject(key, gz, 'application/gzip', { sha256: sha, count });
    const head = await r2.headObject(key);
    if (!head || head.bytes !== gz.length) throw new Error('Upload check failed for ' + key + ' (expected ' + gz.length + ' bytes, got ' + (head && head.bytes) + ')');
    return { key, count, sha256: sha, rawBytes: Buffer.byteLength(text, 'utf8'), bytes: gz.length, reused: false };
  }

  /* ---------- the run document ---------- */
  const runs = async () => (await db()).collection(RUNS);
  const save = async (id, set, extra) => (await runs()).updateOne({ _id: id }, { ...(set ? { $set: { ...set, updatedAt: now() } } : {}), ...(extra || {}) });

  async function newRun(reason, by) {
    const t = now();
    const d = new Date(t);
    const why = String(reason || 'manual').replace(/[^a-z0-9-]+/gi, '-').slice(0, 30);
    const prefix = ROOT + '/' + d.getUTCFullYear() + '/' + pad(d.getUTCMonth() + 1) + '/' + pad(d.getUTCDate()) + '/'
      + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z-' + why + '/';
    const run = {
      _id: 'bk-' + t.toString(36), v: 2, day: dhakaDay(t), reason: why, by: by || null, startedAt: t, updatedAt: t,
      phase: 'mongo', prefix, attempts: 0, error: null, lockedAt: null, ok: false,
      mongo: { names: null, cursor: 0, list: [] }, d1: { tables: null, cursor: { t: 0, offset: 0, part: 0 }, parts: [] },
      files: { cursor: '', index: 0, copied: 0, known: 0, bytes: 0 }, verify: { cursor: 0, checked: 0, full: isSunday(t) }, uploadedBytes: 0,
    };
    // The very first verified backup is checked in full too (nothing before it was).
    if (!(await (await runs()).findOne({ ok: true }, { projection: { _id: 1 } }))) run.verify.full = true;
    // An unfinished run of an earlier day is left as it is, marked so.
    await (await runs()).updateMany({ v: 2, ok: false, phase: { $nin: ['done', 'abandoned'] }, day: { $lt: run.day } }, { $set: { phase: 'abandoned', updatedAt: t } });
    await (await runs()).insertOne(run);
    return run;
  }

  /* ---------- phases ---------- */
  async function phaseMongo(run, until, prev) {
    const d = await db();
    if (!run.mongo.names) {
      run.mongo.names = (await d.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name)
        .filter((n) => !n.startsWith('system.') && !EXCLUDED.includes(n)).sort();
      await save(run._id, { 'mongo.names': run.mongo.names });
    }
    const prevCols = (prev && prev.mongo && prev.mongo.collections) || {};
    while (run.mongo.cursor < run.mongo.names.length && now() < until) {
      const name = run.mongo.names[run.mongo.cursor];
      const docs = await d.collection(name).find({}).sort({ _id: 1 }).toArray();
      const text = EJSON.stringify(docs, { relaxed: false });
      const entry = await store(run.prefix + 'mongo/' + name + '.ejson.gz', text, docs.length, prevCols[name]);
      run.mongo.cursor++;
      if (!entry.reused) run.uploadedBytes += entry.bytes;
      await save(run._id, { 'mongo.cursor': run.mongo.cursor, uploadedBytes: run.uploadedBytes }, { $push: { 'mongo.list': { name, ...entry } } });
      run.mongo.list.push({ name, ...entry });
    }
    return run.mongo.cursor >= run.mongo.names.length;
  }

  async function phaseD1(run, until, prev) {
    if (!d1.configured()) { await save(run._id, { 'd1.skipped': 'D1 not configured' }); return true; }
    if (!run.d1.tables) {
      run.d1.tables = (await d1.query("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' AND name <> 'sqlite_sequence' ORDER BY name"))
        .filter((t) => !EXCLUDED_D1.test(t.name)).map((t) => ({ name: t.name, sql: t.sql }));
      await save(run._id, { 'd1.tables': run.d1.tables });
    }
    const prevTables = (prev && prev.d1 && prev.d1.tables) || {};
    const light = !run.verify.full && /^daily/.test(run.reason);
    const c = run.d1.cursor;
    while (c.t < run.d1.tables.length && now() < until) {
      const t = run.d1.tables[c.t];
      const before = prevTables[t.name];
      if (light && STATIC_D1.test(t.name) && before && (before.parts || before.key) && c.offset === 0) {
        // The medicine catalogue: its last verified copy is carried forward on weekdays.
        const parts = before.parts || [{ ...before, part: 0 }];
        for (const p of parts) run.d1.parts.push({ table: t.name, part: p.part || 0, key: p.key, count: p.count, sha256: p.sha256, rawBytes: p.rawBytes, bytes: p.bytes, reused: true, carriedForward: true });
        await save(run._id, null, { $push: { 'd1.parts': { $each: run.d1.parts.slice(-parts.length) } } });
        c.t++; c.offset = 0; c.part = 0;
        await save(run._id, { 'd1.cursor': c });
        continue;
      }
      const rows = [];
      let end = false;
      while (rows.length < D1_PART) {
        const page = await d1.query('SELECT * FROM "' + String(t.name).replace(/"/g, '""') + '" ORDER BY rowid LIMIT ' + D1_PAGE + ' OFFSET ' + (c.offset + rows.length));
        rows.push(...page);
        if (page.length < D1_PAGE) { end = true; break; }
      }
      const text = JSON.stringify({ table: t.name, schema: c.part === 0 ? t.sql : undefined, offset: c.offset, rows });
      const prevPart = before && before.parts ? before.parts.find((p) => p.part === c.part) : null;
      const entry = await store(run.prefix + 'd1/' + t.name + '/part-' + pad(c.part, 4) + '.json.gz', text, rows.length, prevPart);
      const rec = { table: t.name, part: c.part, ...entry };
      run.d1.parts.push(rec);
      if (!entry.reused) run.uploadedBytes += entry.bytes;
      if (end) { c.t++; c.offset = 0; c.part = 0; } else { c.offset += rows.length; c.part++; }
      await save(run._id, { 'd1.cursor': c, uploadedBytes: run.uploadedBytes }, { $push: { 'd1.parts': rec } });
    }
    return c.t >= run.d1.tables.length;
  }

  async function phaseFiles(run, until) {
    const blob = blobStore();
    if (!blob) { await save(run._id, { 'files.skipped': 'Vercel Blob not configured here' }); return true; }
    const d = await db();
    const known = d.collection(FILES);
    const f = run.files;
    for (;;) {
      if (now() >= until) return false;
      const page = await blob.listPage('unico/', f.cursor || undefined);
      for (; f.index < page.files.length; f.index++) {
        if (now() >= until) { await save(run._id, { files: f }); return false; }
        const file = page.files[f.index];
        const have = await known.findOne({ _id: file.pathname });
        if (have && have.size === file.size) { f.known++; continue; }
        const got = await blob.readBuffer(file.pathname);
        if (!got || !got.data) continue;
        const key = ROOT + '/files/' + file.pathname;
        await r2.putObject(key, got.data, got.contentType || 'application/octet-stream', { sha256: sha256hex(got.data) });
        const head = await r2.headObject(key);
        if (!head || head.bytes !== got.data.length) throw new Error('Upload check failed for ' + key);
        await known.updateOne({ _id: file.pathname }, { $set: { size: file.size, key, sha256: sha256hex(got.data), bytes: got.data.length, at: new Date(now()) } }, { upsert: true });
        f.copied++; f.bytes += got.data.length; run.uploadedBytes += got.data.length;
      }
      if (!page.cursor) { await save(run._id, { files: f, uploadedBytes: run.uploadedBytes }); return true; }
      f.cursor = page.cursor; f.index = 0;
      await save(run._id, { files: f, uploadedBytes: run.uploadedBytes });
    }
  }

  // Every dataset this run points at, in one list (Mongo collections, then D1 parts).
  const datasets = (run) => run.mongo.list.map((e) => ({ kind: 'mongo', ...e })).concat(run.d1.parts.map((e) => ({ kind: 'd1', ...e })));

  async function phaseVerify(run, until) {
    const list = datasets(run);
    while (run.verify.cursor < list.length && now() < until) {
      const e = list[run.verify.cursor];
      if (e.reused && !run.verify.full) {
        const head = await r2.headObject(e.key);
        if (!head || head.bytes !== e.bytes) throw new Error('Verification failed: ' + e.key + ' is missing or changed in R2.');
      } else {
        const text = zlib.gunzipSync(await r2.getObject(e.key)).toString('utf8');
        if (sha256hex(text) !== e.sha256) throw new Error('Verification failed: ' + e.key + ' does not match its checksum.');
        if (e.kind === 'mongo' && run.verify.full && EJSON.parse(text, { relaxed: false }).length !== e.count) throw new Error('Verification failed: ' + e.key + ' has the wrong number of documents.');
      }
      run.verify.cursor++; run.verify.checked++;
      if (run.verify.cursor % 10 === 0) await save(run._id, { verify: run.verify });
    }
    await save(run._id, { verify: run.verify });
    return run.verify.cursor >= list.length;
  }

  async function finish(run) {
    const t = now();
    const collections = {};
    for (const e of run.mongo.list) { const { name, ...rest } = e; collections[name] = rest; }
    const tables = {};
    for (const p of run.d1.parts) {
      const tb = tables[p.table] || (tables[p.table] = { schema: ((run.d1.tables || []).find((x) => x.name === p.table) || {}).sql || '', count: 0, parts: [] });
      const { table, ...rest } = p; tb.parts.push(rest); tb.count += p.count;
    }
    const sum = (list) => list.reduce((a, x) => { a.items++; a.records += x.count; if (!x.reused) { a.uploaded++; a.bytes += x.bytes; } return a; }, { items: 0, records: 0, uploaded: 0, bytes: 0 });
    const manifest = {
      version: 2, reason: run.reason, by: run.by, startedAt: new Date(run.startedAt).toISOString(), finishedAt: new Date(t).toISOString(),
      verifiedAt: new Date(t).toISOString(), verification: run.verify.full ? 'full (every dataset downloaded and checked)' : 'new data downloaded and checked; unchanged data checked present',
      excluded: EXCLUDED, mongo: { database: (await db()).databaseName, collections }, d1: { tables },
      files: { prefix: ROOT + '/files/', copiedThisRun: run.files.copied, bytesThisRun: run.files.bytes },
      totals: { mongo: sum(run.mongo.list), d1: sum(run.d1.parts) },
    };
    const manifestKey = run.prefix + 'manifest.json';
    await r2.putObject(manifestKey, JSON.stringify(manifest, null, 2), 'application/json');
    const head = await r2.headObject(manifestKey);
    if (!head) throw new Error('The manifest could not be stored.');
    await r2.putObject(ROOT + '/latest.json', JSON.stringify({ manifestKey, finishedAt: manifest.finishedAt, verifiedAt: manifest.verifiedAt }), 'application/json');
    const d = await db();
    await d.collection(STATS).updateOne({ _id: 'usage' }, { $inc: { uploadedBytes: run.uploadedBytes + head.bytes } }, { upsert: true });
    if (run.verify.full) {
      // Sundays: the bucket's real size, counted.
      try { const all = await r2.list(ROOT + '/'); await d.collection(STATS).updateOne({ _id: 'usage' }, { $set: { listedBytes: all.reduce((a, o) => a + (o.bytes || 0), 0), objects: all.length, listedAt: new Date(t) } }, { upsert: true }); } catch (e) { /* the next Sunday counts again */ }
    }
    await save(run._id, { phase: 'done', ok: true, finishedAt: t, verifiedAt: t, manifestKey, totals: manifest.totals, error: null, lockedAt: null });
    return manifestKey;
  }

  /* ---------- one step: carry a run forward as far as the time allows ---------- */
  async function step(run, budgetMs) {
    const until = now() + (budgetMs || 25000);
    const r = await runs();
    const lock = await r.updateOne({ _id: run._id, $or: [{ lockedAt: null }, { lockedAt: { $lt: now() - LOCK_MS } }] }, { $set: { lockedAt: now() } });
    if (!lock.modifiedCount) return { busy: true, run: await r.findOne({ _id: run._id }) };
    try {
      if (!r2.configured()) throw new Error('Cloudflare R2 is not set up — enter the R2 keys in Settings → System & Data → Cloud backup.');
      const prev = (run.phase === 'mongo' || run.phase === 'd1') ? await readLatestManifest() : null;
      while (now() < until && run.phase !== 'done') {
        if (run.phase === 'mongo') { if (await phaseMongo(run, until, prev)) { run.phase = 'd1'; await save(run._id, { phase: 'd1' }); } else break; }
        else if (run.phase === 'd1') { if (await phaseD1(run, until, prev)) { run.phase = 'files'; await save(run._id, { phase: 'files' }); } else break; }
        else if (run.phase === 'files') { if (await phaseFiles(run, until)) { run.phase = 'verify'; await save(run._id, { phase: 'verify' }); } else break; }
        else if (run.phase === 'verify') { if (await phaseVerify(run, until)) { await finish(run); run.phase = 'done'; run.ok = true; } else break; }
        else break;
      }
      await save(run._id, { lockedAt: null, error: null });
    } catch (e) {
      // Kept where it stopped: the next call (the next cron slot, or "Back up now") retries it.
      await save(run._id, { lockedAt: null, error: String((e && e.message) || e), lastErrorAt: now() }, { $inc: { attempts: 1 } });
    }
    return { run: await r.findOne({ _id: run._id }) };
  }

  // Today's run, started if there is none (or the last one of today failed for good).
  async function today(reason, by) {
    const r = await runs();
    const day = dhakaDay(now());
    const last = await r.find({ v: 2, day }).sort({ startedAt: -1 }).limit(1).next();
    if (last && (last.ok || last.attempts < 8)) return last;
    return newRun(reason, by);
  }

  // The scheduled call: continue (or start) today's backup until it is verified.
  async function daily(budgetMs, by) {
    await r2.load(false);
    const run = await today('daily', by || 'schedule');
    if (run.ok) return { run, already: true };
    return step(run, budgetMs);
  }

  async function start(reason, by) { await r2.load(false); return newRun(reason || 'manual', by); }
  async function continueRun(id, budgetMs) {
    await r2.load(false);
    const run = await (await runs()).findOne({ _id: id });
    if (!run) { const e = new Error('No such backup run.'); e.status = 404; throw e; }
    if (run.ok || run.phase === 'abandoned') return { run };
    return step(run, budgetMs);
  }

  const brief = (x) => !x ? null : ({
    id: x._id, day: x.day || dhakaDay(x.at), reason: x.reason, by: x.by, startedAt: x.startedAt || x.at, finishedAt: x.finishedAt || null,
    verifiedAt: x.verifiedAt || null, ok: Boolean(x.ok), phase: x.phase || (x.ok ? 'done' : 'failed'), error: x.error || null, attempts: x.attempts || 0,
    progress: x.v === 2 ? {
      collections: (x.mongo && x.mongo.cursor) || 0, collectionsTotal: (x.mongo && x.mongo.names && x.mongo.names.length) || 0,
      d1Parts: (x.d1 && x.d1.parts && x.d1.parts.length) || 0, filesCopied: (x.files && x.files.copied) || 0, filesKnown: (x.files && x.files.known) || 0,
      verified: (x.verify && x.verify.checked) || 0, fullCheck: Boolean(x.verify && x.verify.full),
    } : null,
    uploadedBytes: x.uploadedBytes || 0, totals: x.totals || null, manifestKey: x.manifestKey || null,
  });

  async function status() {
    await r2.load(false);
    const r = await runs();
    const list = await r.find({}, { projection: { 'mongo.list': 0, 'd1.parts': 0, 'mongo.names': 0, 'd1.tables': 0 } }).sort({ updatedAt: -1, at: -1 }).limit(30).toArray();
    const lastGood = await r.find({ ok: true }, { projection: { 'mongo.list': 0, 'd1.parts': 0, 'mongo.names': 0, 'd1.tables': 0 } }).sort({ finishedAt: -1 }).limit(1).next();
    const todayRun = list.find((x) => x.v === 2 && x.day === dhakaDay(now())) || null;
    const usage = (await (await db()).collection(STATS).findOne({ _id: 'usage' })) || {};
    const files = await (await db()).collection(FILES).estimatedDocumentCount().catch(() => 0);
    const used = Math.max(usage.listedBytes || 0, usage.uploadedBytes || 0);
    const t = now();
    const goodAt = lastGood ? (lastGood.verifiedAt || lastGood.finishedAt || lastGood.at) : 0;
    let state, message;
    if (!r2.configured()) { state = 'off'; message = 'Cloud backup is not set up — enter the Cloudflare R2 keys.'; }
    else if (goodAt && t - goodAt < 26 * 3600 * 1000) { state = 'ok'; message = 'Backed up and verified ' + new Date(goodAt).toISOString(); }
    else if (todayRun && !todayRun.ok && !todayRun.error) { state = 'running'; message = 'Today\'s backup is in progress.'; }
    else if (!goodAt && !todayRun && !list.some((x) => x.v === 2)) { state = 'pending'; message = 'Set up. The first backup runs at the next scheduled time (03:00 Bangladesh time) — or press "Back up now".'; }
    else if (goodAt && t - goodAt < 50 * 3600 * 1000) { state = 'stale'; message = 'The last verified backup is more than a day old.' + (todayRun && todayRun.error ? ' Today: ' + todayRun.error : ''); }
    else { state = 'failed'; message = (todayRun && todayRun.error) || (list[0] && list[0].error) || 'No verified backup yet.'; }
    return {
      configured: r2.configured(), config: r2.publicConfig(), state, message,
      lastGood: brief(lastGood), today: brief(todayRun), runs: list.map(brief),
      usage: { bytes: used, limit: LIMIT_BYTES, warn: used >= WARN_BYTES, listedAt: usage.listedAt || null, objects: usage.objects || null, files },
      excluded: EXCLUDED, schedule: '03:00, 03:30, 04:00 and 05:00 Bangladesh time, every day',
    };
  }

  // Write and read back a small file, to prove the keys and the bucket work.
  async function test() {
    await r2.load(true);
    if (!r2.configured()) throw new Error('Enter the R2 settings first.');
    const key = ROOT + '/_probe.json';
    const body = JSON.stringify({ probe: true, at: new Date(now()).toISOString() });
    await r2.putObject(key, body, 'application/json');
    const back = (await r2.getObject(key)).toString('utf8');
    if (back !== body) throw new Error('R2 answered, but the file read back was different.');
    return { ok: true, bucket: r2.publicConfig().bucket };
  }

  return { readLatestManifest, start, continueRun, daily, status, test, step, newRun, EXCLUDED };
}

const service = createBackup();

function mount(app, opts) {
  const guard = (opts && opts.requireApi) || [];
  const svc = (opts && opts.service) || service;
  const r2 = (opts && opts.r2) || require('./r2');
  const adminOnly = (req, res, next) => (req.access && req.access.unrestricted) ? next() : res.status(403).json({ ok: false, error: 'Administrator access required.' });
  const who = (req) => (req.user && (req.user.name || req.user.sub)) || 'admin';
  const route = (fn) => async (req, res) => {
    try { res.set('Cache-Control', 'no-store'); res.json({ ok: true, ...(await fn(req)) }); }
    catch (e) { res.status(e.status || 500).json({ ok: false, error: String((e && e.message) || e) }); }
  };

  // Vercel cron (several a day: each continues today's run). Refuses to run without CRON_SECRET:
  // a backup reads the whole database, so an open endpoint would be a free full-read amplifier.
  app.get('/api/backup/cron', async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(503).json({ ok: false, error: 'CRON_SECRET is not set; scheduled backups are disabled.' });
    if (String(req.headers.authorization || '') !== 'Bearer ' + secret) return res.status(401).json({ ok: false, error: 'Unauthorized.' });
    try { const out = await svc.daily(50000, 'vercel-cron'); res.json({ ok: true, phase: out.run && out.run.phase, done: Boolean(out.run && out.run.ok), error: out.run && out.run.error }); }
    catch (e) { res.status(500).json({ ok: false, error: String(e.message || e) }); }
  });
  // "Back up now": start a run, then the page calls /step until it is done.
  app.post('/api/backup/run', guard, adminOnly, route(async (req) => ({ run: { id: (await svc.start('manual', who(req)))._id } })));
  app.post('/api/backup/step', guard, adminOnly, require('express').json({ limit: '10kb' }), route(async (req) => {
    const out = await svc.continueRun(String((req.body || {}).id || ''), 25000);
    return { busy: Boolean(out.busy), phase: out.run && out.run.phase, done: Boolean(out.run && out.run.ok), error: (out.run && out.run.error) || null };
  }));
  app.get('/api/backup/status', guard, adminOnly, route(async () => svc.status()));
  // The R2 settings an administrator enters (the secret is sealed and never sent back).
  app.get('/api/backup/config', guard, adminOnly, route(async () => { await r2.load(true); return { config: r2.publicConfig() }; }));
  app.post('/api/backup/config', guard, adminOnly, require('express').json({ limit: '10kb' }), route(async (req) => {
    const b = req.body || {};
    const h = await require('./db').getDbHandle(); const d = h && h.db ? h.db : h;
    if (!d) { const e = new Error('The database is not connected.'); e.status = 503; throw e; }
    const config = await r2.save(d, { accountId: b.accountId, endpoint: b.endpoint, bucket: b.bucket, keyId: b.keyId, secret: b.secret }, who(req));
    return { config };
  }));
  app.post('/api/backup/test', guard, adminOnly, route(async () => svc.test()));
}

// The long-running PC server: once an hour, continue today's backup if it is not done yet.
function start() {
  if (process.env.VERCEL || String(process.env.BACKUP_HOURS) === '0') return null;
  const tick = () => service.daily(10 * 60 * 1000, 'pc-timer').then((o) => { if (o && o.run && o.run.ok && !o.already) console.log('[backup] verified backup saved to R2: ' + o.run.manifestKey); }).catch(() => {});
  const boot = setTimeout(tick, 5 * 60 * 1000); if (boot.unref) boot.unref();
  const iv = setInterval(tick, 3600 * 1000); if (iv.unref) iv.unref();
  return iv;
}

// The System Monitor's view (monitor.js): the newest runs, oldest shape kept.
async function recentRuns(limit) {
  const h = await require('./db').getDbHandle(); const d = h && h.db ? h.db : h;
  if (!d) return [];
  const list = await d.collection(RUNS).find({}, { projection: { 'mongo.list': 0, 'd1.parts': 0 } }).sort({ updatedAt: -1, at: -1 }).limit(limit || 20).toArray();
  return list.map((x) => ({ ...x, at: x.finishedAt || x.startedAt || x.at, ok: Boolean(x.ok) }));
}

module.exports = { mount, start, createBackup, recentRuns, readLatestManifest: service.readLatestManifest, ROOT, EXCLUDED };

// node server/backup.js → run one complete backup now and print the result.
if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '.env') });
  (async () => {
    const run = await service.start('manual-cli', 'cli');
    let out = { run };
    for (let i = 0; i < 200 && !(out.run && (out.run.ok || out.run.phase === 'abandoned')); i++) out = await service.continueRun(run._id, 60000);
    console.log(JSON.stringify({ ok: out.run.ok, phase: out.run.phase, error: out.run.error, manifestKey: out.run.manifestKey }, null, 2));
    await require('./db').closeClient();
    process.exit(out.run.ok ? 0 : 1);
  })().catch((e) => { console.error('BACKUP FAILED: ' + (e && e.message || e)); process.exit(1); });
}
