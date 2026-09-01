/* Look at what is actually stored in Cloudflare D1, from the terminal.
 *
 *     node d1-rows.js                        row counts for every table
 *     node d1-rows.js activity               the 20 newest activity_log rows
 *     node d1-rows.js activity --limit=100
 *     node d1-rows.js supervisor             the 20 newest supervisor reports
 *     node d1-rows.js supervisor rpt-xxxx    ONE report, full JSON document
 *     node d1-rows.js --sql "SELECT ..."     any read-only query
 *     node d1-rows.js --wide                 do not truncate long cells
 *
 * READ ONLY: --sql accepts SELECT / PRAGMA / EXPLAIN only, so this can never
 * change or delete anything. Use `npx wrangler d1 execute` for writes.
 *
 * Requires CLOUDFLARE_* in server/.env (same credentials the app uses).
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const d1 = require('./d1');
const d1store = require('./d1-store');

const argv = process.argv.slice(2);
const flag = (name) => (argv.find((a) => a.startsWith('--' + name + '=')) || '').split('=').slice(1).join('=');
const has = (name) => argv.indexOf('--' + name) >= 0;
const positional = argv.filter((a) => !a.startsWith('--'));

const LIMIT = Math.min(1000, Math.max(1, parseInt(flag('limit'), 10) || 20));
const WIDE = has('wide');
const MAXW = WIDE ? 10000 : 40;

/* ---- printing ---- */
function cell(v) {
  if (v == null) return '';
  const s = String(v).replace(/\s+/g, ' ');
  return s.length > MAXW ? s.slice(0, MAXW - 1) + '…' : s;
}

function table(rows) {
  if (!rows.length) { console.log('  (no rows)'); return; }
  const cols = Object.keys(rows[0]);
  const body = rows.map((r) => cols.map((c) => cell(r[c])));
  const w = cols.map((c, i) => Math.max(c.length, ...body.map((r) => r[i].length)));
  const line = (parts) => '  ' + parts.map((p, i) => p.padEnd(w[i])).join('  ');
  console.log(line(cols));
  console.log('  ' + w.map((n) => '-'.repeat(n)).join('  '));
  for (const r of body) console.log(line(r));
  console.log('\n  ' + rows.length + ' row(s)');
}

const when = (ms) => (ms ? new Date(Number(ms)).toISOString().replace('T', ' ').slice(0, 19) : '');

/* ---- views ---- */
async function counts() {
  console.log('\nTables in D1 (' + d1.status().database + '):\n');
  const tables = await d1.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  if (!tables.length) { console.log('  (none — run: node d1-migrate.js)\n'); return; }
  const rows = [];
  for (const t of tables) {
    const c = await d1.get('SELECT COUNT(*) AS n FROM "' + t.name + '"');
    rows.push({ table: t.name, rows: (c && c.n) || 0 });
  }
  table(rows);
  const mods = d1store.activeModules();
  console.log('  served from D1: ' + (mods.length ? mods.join(', ') : 'none — set D1_MODULES in .env') + '\n');
}

async function activity() {
  const rows = await d1.query(
    'SELECT ts, action, username, name, role, target, detail, ip FROM activity_log ORDER BY ts DESC LIMIT ?', [LIMIT]);
  console.log('\nactivity_log — newest ' + LIMIT + ':\n');
  table(rows.map((r) => ({ when: when(r.ts), action: r.action, user: r.username || r.name, role: r.role, target: r.target, detail: r.detail, ip: r.ip })));
  console.log('');
}

async function supervisorList() {
  const rows = await d1.query(
    'SELECT id, date, shift, status, supervisor_name, created_by, created_at, updated_at, LENGTH(doc) AS doc_bytes'
    + ' FROM supervisor_reports ORDER BY date DESC, updated_at DESC LIMIT ?', [LIMIT]);
  console.log('\nsupervisor_reports — newest ' + LIMIT + ':\n');
  table(rows.map((r) => ({
    id: r.id, date: r.date, shift: r.shift, status: r.status,
    supervisor: r.supervisor_name, by: r.created_by, updated: when(r.updated_at), bytes: r.doc_bytes,
  })));
  console.log('\n  Full document:  node d1-rows.js supervisor <id>\n');
}

async function supervisorOne(id) {
  const r = await d1.get('SELECT id, date, shift, status, supervisor_name, created_by, created_at, updated_at, doc FROM supervisor_reports WHERE id = ?', [id]);
  if (!r) { console.error('\n  No report with id "' + id + '".\n'); process.exit(1); }
  console.log('\n  ' + r.id + '   ' + r.date + '  ' + r.shift + '  [' + r.status + ']');
  console.log('  supervisor: ' + (r.supervisor_name || '—') + '   created by ' + (r.created_by || '—') + ' at ' + when(r.created_at) + '   updated ' + when(r.updated_at));
  const doc = d1store.parseJson(r.doc, null);
  if (!doc) { console.error('\n  doc column is not valid JSON:\n' + r.doc + '\n'); process.exit(1); }
  // Section row-counts first — the whole document is often thousands of lines.
  const sections = Object.keys(doc).filter((k) => Array.isArray(doc[k]));
  if (sections.length) {
    console.log('\n  sections:');
    for (const k of sections) console.log('    ' + k.padEnd(22) + doc[k].length + ' row(s)');
  }
  console.log('\n' + JSON.stringify(doc, null, 2) + '\n');
}

async function rawSql(sql) {
  if (!/^\s*(select|pragma|explain)\b/i.test(sql)) {
    console.error('\n  Read-only: --sql accepts SELECT / PRAGMA / EXPLAIN only.\n  For writes use:  npx wrangler d1 execute <db> --remote --command "..."\n');
    process.exit(1);
  }
  const rows = await d1.query(sql);
  console.log('');
  table(rows);
  console.log('');
}

(async () => {
  if (!d1.status().configured) {
    console.error('\n  D1 not configured. Set CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_D1_DATABASE_ID / CLOUDFLARE_API_TOKEN in server/.env\n');
    process.exit(1);
  }
  const sql = flag('sql');
  const what = (positional[0] || '').toLowerCase();

  if (sql) await rawSql(sql);
  else if (what === 'activity') await activity();
  else if (what === 'supervisor') { if (positional[1]) await supervisorOne(positional[1]); else await supervisorList(); }
  else if (what) { console.error('\n  Unknown target "' + what + '". Use: activity | supervisor | --sql "..."\n'); process.exit(1); }
  else await counts();

  process.exit(0);
})().catch((e) => { console.error('\n  Query failed: ' + String((e && e.message) || e) + '\n'); process.exit(1); });
