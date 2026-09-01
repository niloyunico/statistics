/* Cloudflare D1 as the STORE for latency-tolerant modules.
 *
 * WHY: MongoDB Atlas free/shared tiers are limited on storage (512 MB) and on
 * connections — and on Vercel every warm serverless instance holds its own pool.
 * The two modules below are append-heavy, never joined against the statistics
 * core, and nobody notices a ~100 ms round-trip on them, so moving them to D1
 * takes real storage + write load off Mongo without touching the hot paths
 * (departments / quality / appdata / users stay on Mongo exactly as before).
 *
 *   activity_log        audit trail — grows forever, written fire-and-forget
 *   supervisor_reports  one document per shift — read a screenful at a time
 *
 * NO DUAL WRITES. When a module is routed here, D1 is the ONLY store for it and
 * Mongo is not written at all. Writing to both would let the copies drift apart
 * the moment one backend blips, which is exactly the class of bug that is
 * impossible to debug later. Migrate existing rows once with `d1-import.js`.
 *
 * Configure in server/.env:
 *   CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_D1_DATABASE_ID / CLOUDFLARE_API_TOKEN
 *   D1_MODULES=activity,supervisor   (default when D1 is configured; set to an
 *                                     empty value to route everything back to
 *                                     Mongo without removing the credentials)
 *
 * GRACEFUL DEGRADATION: with D1 unconfigured every enabled() call returns false
 * and each module keeps its original Mongo/in-memory behaviour untouched.
 */
const d1 = require('./d1');

const DEFAULT_MODULES = 'activity,supervisor';

function moduleSet() {
  const raw = process.env.D1_MODULES == null ? DEFAULT_MODULES : String(process.env.D1_MODULES);
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

// Is this module backed by D1 right now? Cheap and synchronous — safe to call on
// the request path.
function enabled(mod) {
  return d1.configured() && moduleSet().indexOf(String(mod).toLowerCase()) >= 0;
}

// Which modules are live on D1 (for the startup banner / health output).
function activeModules() { return d1.configured() ? moduleSet() : []; }

/* ---- schema ----
   Created once by `node server/d1-migrate.js`. It is NOT created eagerly on the
   request path: on serverless each cold instance would pay ~6 extra HTTP
   round-trips before serving its first request. Instead withSchema() below
   repairs a missing table lazily, so a fresh D1 database still self-heals. */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS activity_log (
     id       INTEGER PRIMARY KEY AUTOINCREMENT,
     ts       INTEGER NOT NULL,
     action   TEXT    NOT NULL,
     username TEXT,
     name     TEXT,
     role     TEXT,
     target   TEXT,
     detail   TEXT,
     ip       TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS idx_activity_ts ON activity_log (ts DESC)`,

  // The log sheet carries free-form section rows and user-defined custom_* sections,
  // so the document itself lives in `doc` as JSON. Only the fields the queries
  // actually filter and sort on are promoted to real columns — those columns are
  // authoritative on read, so doc/column drift cannot change what a user sees.
  `CREATE TABLE IF NOT EXISTS supervisor_reports (
     id              TEXT PRIMARY KEY,
     date            TEXT NOT NULL,
     shift           TEXT NOT NULL,
     status          TEXT NOT NULL,
     supervisor_name TEXT,
     created_by      TEXT,
     created_at      INTEGER,
     updated_at      INTEGER,
     doc             TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_sr_recent ON supervisor_reports (date DESC, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_sr_shift  ON supervisor_reports (shift)`,
  `CREATE INDEX IF NOT EXISTS idx_sr_status ON supervisor_reports (status)`,
];

let _schemaOnce = null;
async function ensureSchema() {
  if (_schemaOnce) return _schemaOnce;
  _schemaOnce = (async () => {
    for (const sql of SCHEMA) await d1.run(sql);
    return true;
  })();
  // A failed bootstrap must not be cached, or every later request inherits it.
  _schemaOnce.catch(() => { _schemaOnce = null; });
  return _schemaOnce;
}

const MISSING_TABLE = /no such table|no such index|not found: table/i;

// Run a D1 operation, creating the schema and retrying ONCE if the table is not
// there yet (first deploy against an empty D1 database).
async function withSchema(fn) {
  try {
    return await fn();
  } catch (e) {
    if (!MISSING_TABLE.test(String((e && e.message) || e))) throw e;
    await ensureSchema();
    return fn();
  }
}

/* ---- helpers ---- */
function parseJson(text, fallback) {
  try { return JSON.parse(text); } catch (e) { return fallback; }
}

module.exports = { enabled, activeModules, ensureSchema, withSchema, parseJson, SCHEMA };
