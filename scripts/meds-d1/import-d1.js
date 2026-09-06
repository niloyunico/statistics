/* Import the built medicine artifacts into Cloudflare D1.
 *
 * Tables (created on first run, in the SAME D1 database the app already uses):
 *   meds_brand(id PK, doc TEXT, edited INT)    138,853 rows
 *   meds_generic(id PK, doc TEXT, mono_gz TEXT, edited INT)   18,441 rows
 *   meds_ref(id PK, doc TEXT)                  6,855 rows
 *
 * Docs are stored as JSON text: every read path serves search/browse from the
 * in-memory index (built from index.json.gz), so D1 needs no per-column indexes —
 * it is the durable source of truth plus the per-id detail lookup.
 *
 * RESUMABLE: progress is checkpointed to out/import-state.json after every batch,
 * so a network drop — or hitting the D1 free plan's daily rows-written cap
 * (100k/day) — just means running this again later; it continues where it stopped.
 *
 *   node scripts/meds-d1/import-d1.js            # import / resume
 *   node scripts/meds-d1/import-d1.js --restart  # forget the checkpoint, start over
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', 'server', '.env') });
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const d1 = require(path.join(__dirname, '..', '..', 'server', 'd1'));

const OUT = path.join(__dirname, 'out');
const STATE_F = path.join(OUT, 'import-state.json');
// D1 caps BOUND PARAMETERS at 100 per query, which would force tiny batches — so
// values are inlined as escaped SQL literals instead (JSON text: doubling single
// quotes is a complete escape) and each statement carries a good-sized batch.
const esc = (v) => v == null ? 'NULL' : "'" + String(v).replace(/\u0000/g, '').replace(/'/g, "''") + "'";

const state = (() => {
  if (process.argv.includes('--restart')) return {};
  try { return JSON.parse(fs.readFileSync(STATE_F, 'utf8')); } catch (e) { return {}; }
})();
const save = () => fs.writeFileSync(STATE_F, JSON.stringify(state));

async function ensureTables() {
  await d1.run('CREATE TABLE IF NOT EXISTS meds_brand (id TEXT PRIMARY KEY, doc TEXT NOT NULL, edited INTEGER DEFAULT 0)');
  await d1.run('CREATE TABLE IF NOT EXISTS meds_generic (id TEXT PRIMARY KEY, doc TEXT NOT NULL, mono_gz TEXT, edited INTEGER DEFAULT 0)');
  await d1.run('CREATE TABLE IF NOT EXISTS meds_ref (id TEXT PRIMARY KEY, doc TEXT NOT NULL)');
  // NOTE: interactions + food warnings are NOT in D1 — they ship in the Cloudinary
  // asset index-interactions.json.gz and are held in memory by medicines-d1.js.
  // local brand edits/additions (overlay — the packed base rows are never edited in place)
  await d1.run('CREATE TABLE IF NOT EXISTS meds_over (id TEXT PRIMARY KEY, doc TEXT NOT NULL)');
}

// --wipe: a NEW DATASET VERSION replaces the old one — REPLACE alone would leave
// rows whose ids no longer exist (the 2026-09-05 update de-duplicated ~20k brands).
// Local edits (edited=1) are deliberately wiped too: they were edits OF the old rows.
async function wipe() {
  for (const t of ['meds_brand', 'meds_generic', 'meds_ref', 'meds_interaction', 'meds_food', 'meds_over']) {   // the two interaction tables are dropped if an older import created them
    await d1.run('DROP TABLE IF EXISTS ' + t);   // DROP is DDL — DELETE would count every row against the daily write quota
    console.log('dropped ' + t);
  }
  await ensureTables();
}

async function importFile(file, table, cols, rowOf, perStmt) {
  const done = state[file] || 0;
  const lines = fs.readFileSync(path.join(OUT, file), 'utf8').split('\n').filter(Boolean);
  if (done >= lines.length) { console.log(file + ': already complete (' + lines.length + ')'); return; }
  console.log(file + ': ' + lines.length + ' rows, resuming at ' + done);
  // ADAPTIVE batching: D1 rejects long statements (SQLITE_TOOBIG); on that error
  // the batch is split in half and retried, so any row size finds its own ceiling.
  const send = async (docs) => {
    if (!docs.length) return;
    const values = docs.map((d) => '(' + rowOf(d).map(esc).join(',') + ')').join(',');
    try {
      await d1.run('INSERT OR REPLACE INTO ' + table + ' (' + cols.join(',') + ') VALUES ' + values, []);
    } catch (e) {
      if (/TOOBIG|too long/i.test(String(e.message || e)) && docs.length > 1) {
        const mid = Math.ceil(docs.length / 2);
        await send(docs.slice(0, mid));
        await send(docs.slice(mid));
        return;
      }
      throw e;
    }
  };
  for (let i = done; i < lines.length; i += perStmt) {
    const chunk = lines.slice(i, i + perStmt).map((l) => JSON.parse(l));
    await send(chunk);
    state[file] = i + chunk.length;
    save();
    if (((i / perStmt) | 0) % 20 === 0) console.log('  ' + state[file] + ' / ' + lines.length);
  }
  console.log(file + ': DONE (' + lines.length + ')');
}

// Rows this build expects in D1 — used by --if-needed to skip an already-current
// database, so the scheduled retry can run daily without re-burning write quota.
function expected() {
  const n = (f) => { try { return fs.readFileSync(path.join(OUT, f), 'utf8').split('\n').filter(Boolean).length; } catch (e) { return -1; } };
  return { meds_brand: n('d1-brand-packs.ndjson'), meds_generic: n('d1-generics.ndjson'), meds_ref: n('d1-refs.ndjson') };
}
async function upToDate() {
  const want = expected();
  for (const t of Object.keys(want)) {
    if (want[t] < 0) return false;
    const got = await d1.get('SELECT COUNT(*) n FROM ' + t).catch(() => null);
    if (!got || got.n !== want[t]) return false;
  }
  return true;
}

(async () => {
  console.log(new Date().toISOString() + '  D1: ' + JSON.stringify(d1.status ? d1.status() : 'ok'));
  await ensureTables();
  if (process.argv.includes('--if-needed') && await upToDate()) {
    console.log('already up to date — nothing to import.');
    return;
  }
  // --wipe replaces the whole catalogue, so it must NOT re-fire on a scheduled retry
  // that is only resuming an interrupted run — that would throw away the rows already
  // written and burn the write quota again. Progress in the state file means "resume".
  const inProgress = Object.keys(state).length > 0;
  if (process.argv.includes('--wipe') && !(inProgress && process.argv.includes('--if-needed'))) {
    await wipe(); Object.keys(state).forEach((k) => delete state[k]); save();
  } else if (inProgress) {
    console.log('resuming an interrupted import (no wipe).');
  }
  await importFile('d1-refs.ndjson', 'meds_ref', ['id', 'doc'],
    (d) => [d._id, JSON.stringify(d)], 300);
  await importFile('d1-generics.ndjson', 'meds_generic', ['id', 'doc', 'mono_gz', 'edited'],
    (d) => { const { mono_gz, ...doc } = d; return [d._id, JSON.stringify(doc), mono_gz, 0]; }, 60);
  // brands go in PACKED (24 docs/row) — ~4.9k rows instead of 118k
  await importFile('d1-brand-packs.ndjson', 'meds_brand', ['id', 'doc', 'edited'],
    (d) => [d._id, JSON.stringify(d), 0], 12);
  const out = [];
  for (const t of ['meds_brand', 'meds_generic', 'meds_ref']) {   // interactions/food are CDN-served, not D1
    out.push(t.replace('meds_', '') + ' ' + (await d1.get('SELECT COUNT(*) n FROM ' + t)).n);
  }
  console.log('\nD1 now holds: ' + out.join(' · '));
})().catch((e) => { console.error('\nSTOPPED: ' + (e.message || e) + '\n(progress is saved — run again to resume)'); process.exit(1); });
