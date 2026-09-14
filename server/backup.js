/* UNICO — automatic, verified backups of ALL saved data to Cloudflare R2.
 *
 * What is copied on every run:
 *   - every MongoDB collection  → canonical Extended JSON (types preserved), gzip
 *   - every Cloudflare D1 table → JSON rows + the table's CREATE statement, gzip
 * Layout in the bucket:
 *   unico-backups/<YYYY>/<MM>/<DD>/<HHMMSS>Z-<reason>/manifest.json
 *   unico-backups/<...run...>/mongo/<collection>.ejson.gz
 *   unico-backups/<...run...>/d1/<table>.json.gz
 *   unico-backups/latest.json   (pointer to the newest manifest)
 * A collection whose content is byte-identical to the previous run is not uploaded again —
 * its manifest entry points at the earlier object (same SHA-256), so a large static dataset
 * costs nothing per day while every run's manifest still describes the COMPLETE database.
 *
 * Safety properties:
 *   - Read-only against the databases; the only DB write is one summary row in `backupRuns`.
 *   - Append-only in R2 (server/r2.js has no delete) — history can never be wiped by the app.
 *   - Every upload is verified with a HEAD (size) and recorded with the SHA-256 of the content.
 *   - Restoring is a separate, deliberate, additive script (scripts/restore-from-r2.js).
 *
 * Triggers: Vercel cron GET /api/backup/cron (needs CRON_SECRET), admin POST /api/backup/run,
 * and — on the long-running PC server — an in-process daily timer (BACKUP_HOURS, default 24).
 */
const zlib = require('zlib');
const crypto = require('crypto');
const { EJSON } = require('bson');
const r2 = require('./r2');
const d1 = require('./d1');
const { getDbHandle } = require('./db');

const ROOT = 'unico-backups';
const RUNS = 'backupRuns';
const sha256hex = (b) => crypto.createHash('sha256').update(b).digest('hex');
const pad = (n, w) => String(n).padStart(w || 2, '0');

async function readLatestManifest() {
  try {
    const ptr = JSON.parse((await r2.getObject(ROOT + '/latest.json')).toString('utf8'));
    return ptr && ptr.manifestKey ? JSON.parse((await r2.getObject(ptr.manifestKey)).toString('utf8')) : null;
  } catch (e) { if (e.status === 404) return null; throw e; }
}

// Upload (or reuse) one dataset. `text` is the full uncompressed serialization.
async function store(runPrefix, kind, name, ext, text, count, prevEntry) {
  const sha = sha256hex(text);
  if (prevEntry && prevEntry.sha256 === sha && prevEntry.count === count && prevEntry.key) {
    const still = await r2.headObject(prevEntry.key);
    if (still && still.bytes === prevEntry.bytes) return Object.assign({}, prevEntry, { reused: true });
  }
  const gz = zlib.gzipSync(Buffer.from(text, 'utf8'), { level: 9 });
  const key = runPrefix + kind + '/' + name + ext + '.gz';
  await r2.putObject(key, gz, 'application/gzip', { sha256: sha, count });
  const head = await r2.headObject(key);
  if (!head || head.bytes !== gz.length) throw new Error('Upload verification failed for ' + key + ' (expected ' + gz.length + ' bytes, got ' + (head && head.bytes) + ')');
  return { key, count, sha256: sha, rawBytes: Buffer.byteLength(text, 'utf8'), bytes: gz.length, reused: false };
}

async function backupMongo(runPrefix, prev) {
  const h = await getDbHandle(); const db = h && h.db ? h.db : h;
  if (!db) return { skipped: 'no MongoDB configured' };
  const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).filter((n) => !n.startsWith('system.')).sort();
  const out = {};
  for (const name of names) {
    const docs = await db.collection(name).find({}).sort({ _id: 1 }).toArray();
    const text = EJSON.stringify(docs, { relaxed: false });
    out[name] = await store(runPrefix, 'mongo', name, '.ejson', text, docs.length, prev && prev[name]);
  }
  return { database: db.databaseName, collections: out };
}

// The medicine catalogue tables are a large REBUILDABLE dataset (scripts/meds-d1) that only
// changes when the catalogue is re-imported. Paging them through the D1 REST API every day
// would push the daily serverless run past its time limit, so the DAILY run carries their
// last verified copy forward (the manifest still lists every table); manual and Sunday runs
// read them fresh.
const STATIC_D1 = /^meds_/;

async function backupD1(runPrefix, prev, reason) {
  if (!d1.configured()) return { skipped: 'D1 not configured' };
  const tables = await d1.query("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' AND name <> 'sqlite_sequence' ORDER BY name");
  const lightRun = reason === 'daily' && new Date().getUTCDay() !== 0;
  const out = {};
  for (const t of tables) {
    const before = prev && prev[t.name];
    if (lightRun && STATIC_D1.test(t.name) && before && before.key) { out[t.name] = Object.assign({}, before, { reused: true, carriedForward: true }); continue; }
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const page = await d1.query('SELECT * FROM "' + String(t.name).replace(/"/g, '""') + '" ORDER BY rowid LIMIT 500 OFFSET ' + offset);
      rows.push(...page);
      if (page.length < 500) break;
    }
    const text = JSON.stringify({ table: t.name, schema: t.sql, rows });
    out[t.name] = await store(runPrefix, 'd1', t.name, '.json', text, rows.length, prev && prev[t.name]);
  }
  return { tables: out };
}

let running = null;
async function runBackup(reason, by) {
  if (running) return running;                       // one run at a time per process
  running = (async () => {
    if (!r2.configured()) throw new Error('Cloudflare R2 is not configured — set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and R2_ENDPOINT.');
    const started = new Date();
    const why = String(reason || 'manual').replace(/[^a-z0-9-]+/gi, '-').slice(0, 30);
    const runPrefix = ROOT + '/' + started.getUTCFullYear() + '/' + pad(started.getUTCMonth() + 1) + '/' + pad(started.getUTCDate()) + '/'
      + pad(started.getUTCHours()) + pad(started.getUTCMinutes()) + pad(started.getUTCSeconds()) + 'Z-' + why + '/';
    const prev = await readLatestManifest();
    const mongo = await backupMongo(runPrefix, prev && prev.mongo && prev.mongo.collections);
    const cloudflareD1 = await backupD1(runPrefix, prev && prev.d1 && prev.d1.tables);
    const sum = (m) => Object.values(m || {}).reduce((a, x) => { a.items++; a.records += x.count; if (!x.reused) { a.uploaded++; a.bytes += x.bytes; } return a; }, { items: 0, records: 0, uploaded: 0, bytes: 0 });
    const manifest = {
      version: 1, reason: why, by: by || null,
      startedAt: started.toISOString(), finishedAt: new Date().toISOString(),
      mongo, d1: cloudflareD1,
      totals: { mongo: sum(mongo.collections), d1: sum(cloudflareD1.tables) },
    };
    const manifestKey = runPrefix + 'manifest.json';
    await r2.putObject(manifestKey, JSON.stringify(manifest, null, 2), 'application/json');
    await r2.putObject(ROOT + '/latest.json', JSON.stringify({ manifestKey, finishedAt: manifest.finishedAt }), 'application/json');
    const summary = { _id: 'bk-' + started.getTime().toString(36), at: started.getTime(), finishedAt: Date.now(), ok: true, reason: why, by: by || null, manifestKey, totals: manifest.totals };
    try { const h = await getDbHandle(); const db = h && h.db ? h.db : h; if (db) await db.collection(RUNS).insertOne(summary); } catch (e) { summary.logError = String(e.message || e); }
    return summary;
  })();
  try { return await running; }
  catch (e) {
    try { const h = await getDbHandle(); const db = h && h.db ? h.db : h; if (db) await db.collection(RUNS).insertOne({ _id: 'bk-' + Date.now().toString(36), at: Date.now(), ok: false, reason: String(reason || 'manual'), by: by || null, error: String(e.message || e) }); } catch (_) { /* best effort */ }
    throw e;
  } finally { running = null; }
}

async function recentRuns(limit) {
  const h = await getDbHandle(); const db = h && h.db ? h.db : h;
  if (!db) return [];
  return db.collection(RUNS).find({}).sort({ at: -1 }).limit(limit || 20).toArray();
}

function mount(app, opts) {
  const guard = (opts && opts.requireApi) || [];
  const adminOnly = (req, res, next) => (req.access && req.access.unrestricted) ? next() : res.status(403).json({ ok: false, error: 'Administrator access required.' });

  // Vercel cron. Refuses to run without CRON_SECRET: a backup reads the whole database, so an
  // open endpoint would be a free full-read amplifier for anyone who finds the URL.
  app.get('/api/backup/cron', async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(503).json({ ok: false, error: 'CRON_SECRET is not set; scheduled backups are disabled.' });
    if (String(req.headers.authorization || '') !== 'Bearer ' + secret) return res.status(401).json({ ok: false, error: 'Unauthorized.' });
    try { res.json({ ok: true, run: await runBackup('daily', 'vercel-cron') }); }
    catch (e) { res.status(500).json({ ok: false, error: String(e.message || e) }); }
  });
  app.post('/api/backup/run', guard, adminOnly, async (req, res) => {
    try { res.json({ ok: true, run: await runBackup('manual', (req.user && (req.user.name || req.user.sub)) || 'admin') }); }
    catch (e) { res.status(500).json({ ok: false, error: String(e.message || e) }); }
  });
  app.get('/api/backup/status', guard, adminOnly, async (req, res) => {
    try { res.set('Cache-Control', 'no-store').json({ ok: true, configured: r2.configured(), runs: await recentRuns(20) }); }
    catch (e) { res.status(500).json({ ok: false, error: String(e.message || e) }); }
  });
}

// Daily in-process timer for the always-on PC server (Vercel uses the cron instead).
function start() {
  const hours = Number(process.env.BACKUP_HOURS != null ? process.env.BACKUP_HOURS : 24);
  if (!(hours > 0) || process.env.VERCEL || !r2.configured()) return null;
  const run = (why) => runBackup(why, 'pc-timer').then((r) => console.log('[backup] ' + why + ' backup saved to R2: ' + r.manifestKey))
    .catch((e) => console.warn('[backup] ' + why + ' backup FAILED: ' + (e && e.message || e)));
  const boot = setTimeout(() => run('startup'), 5 * 60 * 1000); if (boot.unref) boot.unref();
  const iv = setInterval(() => run('daily'), hours * 3600 * 1000); if (iv.unref) iv.unref();
  return iv;
}

module.exports = { runBackup, recentRuns, readLatestManifest, mount, start, ROOT };

// node server/backup.js  → run one backup now and print the summary.
if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '.env') });
  runBackup('manual-cli', 'cli')
    .then((r) => { console.log(JSON.stringify(r, null, 2)); return require('./db').closeClient(); })
    .then(() => process.exit(0))
    .catch((e) => { console.error('BACKUP FAILED: ' + (e && e.message || e)); process.exit(1); });
}
