/* D1-backed store tests — activity_log + supervisor_reports.
 *
 * The real d1.js talks to Cloudflare over HTTP. Here it is swapped for a genuine
 * in-process SQLite database (node:sqlite), so the SQL these modules emit is
 * really parsed and executed: column names, placeholders, ORDER BY, the JSON
 * `doc` round-trip and the LIKE narrowing are all exercised for real. Only the
 * transport is faked.
 *
 * Run:  node test/d1-store.test.js
 */
const { DatabaseSync } = require('node:sqlite');

/* ---- install the fake D1 transport BEFORE anything requires ./d1 ---- */
const sqlite = new DatabaseSync(':memory:');
const d1Path = require.resolve('../d1.js');
const fake = {
  configured: () => true,
  status: () => ({ provider: 'cloudflare-d1', configured: true, account: 'test…', database: 'test-db' }),
  ping: async () => ({ ok: true }),
  query: async (sql, params) => sqlite.prepare(sql).all(...(params || [])),
  get: async (sql, params) => sqlite.prepare(sql).get(...(params || [])) || null,
  run: async (sql, params) => { sqlite.prepare(sql).run(...(params || [])); return { success: true, meta: {} }; },
};
require.cache[d1Path] = { id: d1Path, filename: d1Path, loaded: true, exports: fake };

process.env.CLOUDFLARE_ACCOUNT_ID = 'test';
process.env.CLOUDFLARE_D1_DATABASE_ID = 'test-db';
process.env.CLOUDFLARE_API_TOKEN = 'test';
process.env.D1_MODULES = 'activity,supervisor';

const d1store = require('../d1-store');
const activity = require('../activity-log');
const sup = require('../supervisor-reports');

let failed = 0, passed = 0;
function ok(cond, label) {
  if (cond) { passed++; console.log('  PASS  ' + label); }
  else { failed++; console.error('  FAIL  ' + label); }
}
function eq(a, b, label) { ok(JSON.stringify(a) === JSON.stringify(b), label + '  (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }

(async () => {
  console.log('\nD1 store tests\n');

  /* ---------- routing ---------- */
  ok(d1store.enabled('activity'), 'activity is routed to D1');
  ok(d1store.enabled('supervisor'), 'supervisor is routed to D1');
  ok(!d1store.enabled('users'), 'users is NOT routed to D1');

  /* ---------- schema self-heals on a missing table ---------- */
  // Nothing has created the tables yet; withSchema() must build them on first use.
  const healed = await d1store.withSchema(() => fake.query('SELECT COUNT(*) AS n FROM activity_log'));
  eq(healed[0].n, 0, 'withSchema() creates the schema when the table is missing');

  /* ---------- activity log ---------- */
  await activity.record({ action: 'login', username: 'admin', name: 'Admin', role: 'Administrator', ip: '1.2.3.4', ts: 1000 });
  await activity.record({ action: 'user_created', username: 'admin', name: 'Admin', role: 'Administrator', target: 'nurse1', ts: 2000 });
  const rows = await fake.query('SELECT ts, action, username, target FROM activity_log ORDER BY ts DESC');
  eq(rows.length, 2, 'record() writes to D1');
  eq(rows[0].action, 'user_created', 'activity is returned newest-first');
  eq(rows[0].target, 'nurse1', 'optional fields round-trip');
  eq(rows[1].username, 'admin', 'actor is stored');

  // record() must never throw into the caller, even when the backend is broken.
  const realRun = fake.run;
  fake.run = async () => { throw new Error('D1 is down'); };
  let threw = false;
  try { await activity.record({ action: 'boom' }); } catch (e) { threw = true; }
  fake.run = realRun;
  ok(!threw, 'record() swallows a backend failure (logging never breaks a request)');

  /* ---------- supervisor reports: create ---------- */
  const r1 = await sup.saveReport({
    date: '2026-08-01', shift: 'Night', supervisorName: 'Sr. Rahima', status: 'draft',
    criticalArea: [{ uhid: 'UH-1001', name: 'Karim', dept: 'ICU', consultant: 'Dr. A', diagnosis: 'MI' }],
    roundObservation: 'All quiet.',
    custom_extra: [{ note: 'keep me' }],
    createdBy: 'admin',
  });
  ok(!!r1.id, 'saveReport() creates a report and returns an id');
  eq(r1.status, 'draft', 'new report defaults to draft');
  eq(r1.supervisorName, 'Sr. Rahima', 'scalar column round-trips');
  eq(r1.criticalArea[0].uhid, 'UH-1001', 'free-form section rows survive the JSON doc column');
  eq(r1.createdBy, 'admin', 'createdBy is recorded');

  const r2 = await sup.saveReport({ date: '2026-08-02', shift: 'Morning', supervisorName: 'Sr. Nadia', status: 'submitted' });
  const r3 = await sup.saveReport({ date: '2026-07-30', shift: 'Evening', supervisorName: 'Sr. Fahim', status: 'draft' });

  /* ---------- read back ---------- */
  const byId = await sup.getReportById(r1.id);
  eq(byId.id, r1.id, 'getReportById() finds the report');
  eq(byId.roundObservation, 'All quiet.', 'long text survives the round-trip');
  eq(await sup.getReportById('nope-does-not-exist'), null, 'getReportById() returns null for an unknown id');

  const all = await sup.getReports({});
  eq(all.length, 3, 'getReports() returns every report');
  eq(all.map((r) => r.date), ['2026-08-02', '2026-08-01', '2026-07-30'], 'getReports() sorts newest date first');

  eq((await sup.getReports({ date: '2026-08-01' })).length, 1, 'getReports() filters by date');
  eq((await sup.getReports({ shift: 'Morning' })).length, 1, 'getReports() filters by shift');
  eq((await sup.getReports({ status: 'draft' })).length, 2, 'getReports() filters by status');
  eq((await sup.getReports({ date: '2026-08-01', status: 'submitted' })).length, 0, 'getReports() combines filters with AND');
  eq((await sup.getReports({ limit: 2 })).length, 2, 'getReports() honours limit');

  /* ---------- update keeps createdAt/createdBy and unrelated custom sections ----------
     The client posts the WHOLE report on save, so the payload carries the section
     rows back with it. */
  const upd = await sup.saveReport({
    id: r1.id, date: '2026-08-01', shift: 'Night', supervisorName: 'Sr. Rahima',
    criticalArea: [{ uhid: 'UH-1001', name: 'Karim', dept: 'ICU', consultant: 'Dr. A', diagnosis: 'MI' }],
    roundObservation: 'Edited.',
  });
  eq(upd.id, r1.id, 'update reuses the same id');
  eq(upd.roundObservation, 'Edited.', 'update applies the new value');
  eq(upd.createdBy, 'admin', 'update preserves createdBy');
  eq(upd.createdAt, r1.createdAt, 'update preserves createdAt');
  eq(upd.custom_extra, [{ note: 'keep me' }], 'update keeps custom_* sections absent from this payload ($set semantics)');
  ok(upd.updatedAt >= r1.updatedAt, 'update advances updatedAt');
  eq((await sup.getReports({})).length, 3, 'update does not create a duplicate row');

  eq(upd.criticalArea[0].uhid, 'UH-1001', 'update round-trips the section rows it was given');

  // A BUILT-IN section left out of the payload is cleared, because normReport()
  // always emits every built-in key — the same thing Mongo's $set does. Only the
  // custom_* sections (which normReport only copies when present) are preserved.
  const partial = await sup.saveReport({ date: '2026-06-01', shift: 'Night', criticalArea: [{ uhid: 'UH-2002' }], custom_extra: [{ note: 'kept' }] });
  const cleared = await sup.saveReport({ id: partial.id, date: '2026-06-01', shift: 'Night' });
  eq(cleared.criticalArea, [], 'a built-in section omitted from the payload is cleared (matches Mongo $set)');
  eq(cleared.custom_extra, [{ note: 'kept' }], 'a custom_* section omitted from the payload is kept (matches Mongo $set)');
  await sup.deleteReport(partial.id);

  let notFound = '';
  try { await sup.saveReport({ id: 'ghost-id', date: '2026-01-01', shift: 'Night' }); }
  catch (e) { notFound = e.message; }
  eq(notFound, 'Report not found.', 'updating an unknown id is rejected');

  /* ---------- status ---------- */
  const app1 = await sup.setStatus(r1.id, 'approved');
  eq(app1.status, 'approved', 'setStatus() updates the status');
  eq((await sup.getReportById(r1.id)).status, 'approved', 'status is persisted');
  eq((await sup.getReports({ status: 'approved' })).length, 1, 'status column stays in sync for filtering');
  eq((await sup.getReportById(r1.id)).roundObservation, 'Edited.', 'setStatus() leaves the document untouched');

  let badStatus = '';
  try { await sup.setStatus(r1.id, 'nonsense'); } catch (e) { badStatus = e.message; }
  eq(badStatus, 'Invalid status.', 'setStatus() rejects an unknown status');

  /* ---------- previous report (carry-forward) ---------- */
  const prev = await sup.getPreviousReport('2026-08-02', 'Morning');
  eq(prev && prev.date, '2026-08-01', 'getPreviousReport() finds the shift before this one');
  eq(await sup.getPreviousReport('2026-07-30', 'Morning'), null, 'getPreviousReport() returns null when nothing is earlier');

  /* ---------- UHID lookup (LIKE narrowing) ---------- */
  const pt = await sup.lookupByUhid('UH-1001');
  eq(pt && pt.name, 'Karim', 'lookupByUhid() finds a patient inside the JSON doc');
  eq(pt.dept, 'ICU', 'lookupByUhid() returns the identifying fields');
  eq(await sup.lookupByUhid('UH-9999'), null, 'lookupByUhid() returns null when unmatched');
  eq(await sup.lookupByUhid(''), null, 'lookupByUhid() ignores an empty UHID');
  // A LIKE wildcard must not match every report; it falls through to the plain scan.
  eq(await sup.lookupByUhid('%'), null, 'lookupByUhid() does not let "%" match everything');
  eq(await sup.lookupByUhid('UH-100_'), null, 'lookupByUhid() does not let "_" match a single character');

  /* ---------- delete ---------- */
  await sup.deleteReport(r3.id);
  eq((await sup.getReports({})).length, 2, 'deleteReport() removes the report');
  eq(await sup.getReportById(r3.id), null, 'deleted report is gone');
  ok((await sup.deleteReport('ghost-id')).ok, 'deleting an unknown id is a no-op, not an error');
  void r2;

  /* ---------- rollback switch ---------- */
  process.env.D1_MODULES = '';
  ok(!d1store.enabled('supervisor'), 'clearing D1_MODULES routes the module back to MongoDB');
  process.env.D1_MODULES = 'activity,supervisor';

  console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('\nTest crashed: ' + (e && e.stack || e)); process.exit(1); });
