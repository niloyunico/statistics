/* One-time copy of the D1-backed collections OUT of MongoDB and INTO Cloudflare D1.
 *
 * Run this ONCE, after `node d1-migrate.js`, before the app starts serving these
 * modules from D1 — otherwise the existing history simply stops being visible
 * (it is not lost: it stays in Mongo untouched, and clearing D1_MODULES puts the
 * app straight back on Mongo).
 *
 *     node d1-import.js            copy anything not already in D1
 *     node d1-import.js --verify   copy, then compare Mongo vs D1 row counts
 *     node d1-import.js --replace  wipe the D1 tables first, then copy
 *     node d1-import.js --only=activity      (or --only=supervisor)
 *
 * Nothing is deleted from MongoDB. Keep those collections as the rollback copy
 * until you are satisfied D1 is serving correctly.
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const d1 = require('./d1');
const d1store = require('./d1-store');
const db = require('./db');

const argv = process.argv.slice(2);
const has = (f) => argv.indexOf(f) >= 0;
const only = (argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || '';

// D1 caps how many bound parameters one statement may carry, so rows are sent in
// multi-row INSERTs sized to stay comfortably under it.
const MAX_PARAMS = 96;

function chunkRows(rows, colCount) {
  const per = Math.max(1, Math.floor(MAX_PARAMS / colCount));
  const out = [];
  for (let i = 0; i < rows.length; i += per) out.push(rows.slice(i, i + per));
  return out;
}

async function insertAll(table, cols, rows, verb) {
  if (!rows.length) return 0;
  const placeholders = '(' + cols.map(() => '?').join(', ') + ')';
  let done = 0;
  for (const chunk of chunkRows(rows, cols.length)) {
    const sql = verb + ' INTO ' + table + ' (' + cols.join(', ') + ') VALUES '
      + chunk.map(() => placeholders).join(', ');
    const params = [];
    for (const r of chunk) for (const c of cols) params.push(r[c]);
    await d1.run(sql, params);
    done += chunk.length;
    process.stdout.write('\r  ' + table + ': ' + done + '/' + rows.length + ' rows');
  }
  process.stdout.write('\n');
  return done;
}

async function count(table) {
  const r = await d1.get('SELECT COUNT(*) AS n FROM ' + table);
  return (r && r.n) || 0;
}

/* ---- activity_log ----
   No natural key (Mongo _id is an ObjectId, D1 uses AUTOINCREMENT), so this
   cannot be de-duplicated on re-run. It refuses to append to a non-empty table
   unless --replace is given. */
async function importActivity(h) {
  const existing = await count('activity_log');
  if (existing && !has('--replace')) {
    console.log('  activity_log: SKIPPED — D1 already holds ' + existing + ' rows (use --replace to overwrite).');
    return { mongo: await h.collection('activity_log').countDocuments(), d1: existing, skipped: true };
  }
  if (has('--replace')) await d1.run('DELETE FROM activity_log');

  const docs = await h.collection('activity_log').find({}).sort({ ts: 1 }).toArray();
  const rows = docs.map((d) => ({
    ts: Number(d.ts) || 0,
    action: String(d.action || 'event'),
    username: String(d.username || ''),
    name: String(d.name || ''),
    role: String(d.role || ''),
    target: String(d.target || ''),
    detail: String(d.detail || ''),
    ip: String(d.ip || ''),
  }));
  await insertAll('activity_log', ['ts', 'action', 'username', 'name', 'role', 'target', 'detail', 'ip'], rows, 'INSERT');
  return { mongo: docs.length, d1: await count('activity_log') };
}

/* ---- supervisor_reports ----
   Keyed by the report's own string _id, so INSERT OR REPLACE makes re-running
   safe and idempotent. */
async function importSupervisor(h) {
  if (has('--replace')) await d1.run('DELETE FROM supervisor_reports');

  const docs = await h.collection('supervisorReports').find({}).toArray();
  const rows = docs.map((d) => {
    const { _id, createdBy, createdAt, updatedAt, ...doc } = d;
    return {
      id: String(_id),
      date: String(doc.date || ''),
      shift: String(doc.shift || 'Night'),
      status: String(doc.status || 'draft'),
      supervisor_name: String(doc.supervisorName || ''),
      created_by: createdBy == null ? null : String(createdBy),
      created_at: Number(createdAt) || 0,
      updated_at: Number(updatedAt) || Number(createdAt) || 0,
      doc: JSON.stringify(doc),
    };
  });
  await insertAll('supervisor_reports',
    ['id', 'date', 'shift', 'status', 'supervisor_name', 'created_by', 'created_at', 'updated_at', 'doc'],
    rows, 'INSERT OR REPLACE');
  return { mongo: docs.length, d1: await count('supervisor_reports') };
}

(async () => {
  if (!d1.status().configured) {
    console.error('D1 not configured. Set CLOUDFLARE_* in server/.env, then run: node d1-migrate.js');
    process.exit(1);
  }
  const h = await db.getDbHandle().catch(() => null);
  if (!h) {
    console.error('MongoDB not reachable — nothing to import from. Set MONGODB_URI in server/.env.');
    process.exit(1);
  }
  await d1store.ensureSchema();

  const results = {};
  if (!only || only === 'activity') results.activity_log = await importActivity(h);
  if (!only || only === 'supervisor') results.supervisor_reports = await importSupervisor(h);

  console.log('');
  for (const [table, r] of Object.entries(results)) {
    const mark = r.skipped ? 'skipped' : (r.mongo === r.d1 ? 'match' : 'MISMATCH');
    console.log('  ' + table.padEnd(20) + 'mongo=' + r.mongo + '  d1=' + r.d1 + '  [' + mark + ']');
  }

  if (has('--verify')) {
    const bad = Object.values(results).filter((r) => !r.skipped && r.mongo !== r.d1);
    if (bad.length) { console.error('\nVerification FAILED — counts differ. D1 is NOT ready to serve; leave D1_MODULES empty.'); process.exit(1); }
    console.log('\nVerified: every row copied. Safe to serve these modules from D1.');
  }

  await db.close().catch(() => {});
  process.exit(0);
})().catch((e) => { console.error('\nImport failed: ' + String((e && e.message) || e)); process.exit(1); });
