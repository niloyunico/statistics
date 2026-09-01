/* Settings → Database / Media API tests.
 *
 * Real Express, real HTTP, real SQL: d1.js is swapped for an in-process SQLite
 * database (node:sqlite) and storage.js for a fake Cloudinary, so every statement
 * these endpoints build is actually parsed and executed. What is being checked is
 * mostly the guard rails — that an admin can fix a cell, and that nobody can use
 * this panel to reach past the tables it is meant to expose.
 *
 * Run:  node test/d1-admin.test.js
 */
const http = require('http');
const { DatabaseSync } = require('node:sqlite');

/* ---- fake D1 transport ---- */
const sqlite = new DatabaseSync(':memory:');
const d1Path = require.resolve('../d1.js');
require.cache[d1Path] = { id: d1Path, filename: d1Path, loaded: true, exports: {
  configured: () => true,
  status: () => ({ provider: 'cloudflare-d1', configured: true, account: 'test…', database: 'test-db' }),
  ping: async () => ({ ok: true }),
  query: async (sql, p) => sqlite.prepare(sql).all(...(p || [])),
  get: async (sql, p) => sqlite.prepare(sql).get(...(p || [])) || null,
  run: async (sql, p) => { sqlite.prepare(sql).run(...(p || [])); return { success: true, meta: {} }; },
} };

/* ---- fake Cloudinary ---- */
const media = {
  'unico/profiles/admin': { publicId: 'unico/profiles/admin', name: 'admin', bytes: 4210, width: 200, height: 200 },
  'unico/scan-1': { publicId: 'unico/scan-1', name: 'scan-1', bytes: 91234, width: 1200, height: 900 },
};
const storagePath = require.resolve('../storage.js');
require.cache[storagePath] = { id: storagePath, filename: storagePath, loaded: true, exports: {
  status: () => ({ provider: 'cloudinary', configured: true, cloudName: 'unico-test' }),
  ping: async () => ({ ok: true }),
  listFolders: async (p) => (p ? (p === 'unico' ? [{ name: 'profiles', path: 'unico/profiles' }] : []) : [{ name: 'unico', path: 'unico' }]),
  listAssets: async (o) => ({
    assets: Object.values(media).filter((a) => !o.folder || a.publicId.startsWith(o.folder + '/')),
    cursor: '',
  }),
  usage: async () => ({ plan: 'Free', credits: { usage: 0.4, limit: 25 }, storage: { usage: 95444, limit: 0 }, bandwidth: { usage: 0, limit: 0 }, resources: 2, derivedResources: 0 }),
  deleteByPublicId: async (id) => { if (!media[id]) return { ok: false, error: 'not found' }; delete media[id]; return { ok: true }; },
  uploadBuffer: async () => { throw new Error('not used in this test'); },
} };

process.env.CLOUDFLARE_ACCOUNT_ID = 'test';
process.env.CLOUDFLARE_D1_DATABASE_ID = 'test-db';
process.env.CLOUDFLARE_API_TOKEN = 'test';
process.env.D1_MODULES = 'activity,supervisor';

const express = require('express');
const d1store = require('../d1-store');
const sup = require('../supervisor-reports');

let failed = 0, passed = 0;
function ok(cond, label) {
  if (cond) { passed++; console.log('  PASS  ' + label); }
  else { failed++; console.error('  FAIL  ' + label); }
}
function eq(a, b, label) { ok(JSON.stringify(a) === JSON.stringify(b), label + '  (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }

(async () => {
  console.log('\nSettings → Database / Media API tests\n');

  await d1store.ensureSchema();
  const act = require('../activity-log');
  await act.record({ action: 'login', username: 'admin', name: 'Administrator', role: 'Administrator', ip: '10.0.0.1', ts: 1000 });
  const rpt = await sup.saveReport({
    date: '2026-08-30', shift: 'Night', supervisorName: 'Sr. Rahima', status: 'draft', createdBy: 'admin',
    criticalArea: [{ uhid: 'UH-1001', name: 'Karim' }], roundObservation: 'Quiet night.',
  });

  /* ---- server ---- */
  let ROLE = 'Administrator';
  const app = express();
  app.use(express.json());
  const requireApi = (req, res, next) => { req.user = { sub: 'admin', name: 'Administrator', role: ROLE }; next(); };
  require('../d1-admin').mount(app, { requireApi });
  require('../media-admin').mount(app, { requireApi });
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const call = async (method, url, body) => {
    const res = await fetch(base + url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, json: await res.json().catch(() => null) };
  };

  /* ---------- tables ---------- */
  const t = await call('GET', '/api/d1/tables');
  ok(t.json.ok && t.json.configured, 'GET /api/d1/tables reports D1 as live');
  const names = t.json.tables.map((x) => x.name).sort();
  eq(names, ['activity_log', 'supervisor_reports'], 'tables are listed');
  eq(t.json.tables.find((x) => x.name === 'activity_log').rows, 1, 'row counts are real');
  eq(t.json.modules, ['activity', 'supervisor'], 'the modules served from D1 are reported');
  ok(!names.includes('sqlite_sequence'), "SQLite's internal tables are hidden");

  /* ---------- rows ---------- */
  const r = await call('GET', '/api/d1/rows?table=supervisor_reports');
  eq(r.json.rows.length, 1, 'GET /api/d1/rows returns the rows');
  eq(r.json.total, 1, 'the total is reported for paging');
  ok(r.json.columns.some((c) => c.name === 'doc'), 'columns are described');
  eq(r.json.rows[0].supervisor_name, 'Sr. Rahima', 'values come back intact');

  eq((await call('GET', '/api/d1/rows?table=supervisor_reports&q=Rahima')).json.rows.length, 1, 'search matches a text column');
  eq((await call('GET', '/api/d1/rows?table=supervisor_reports&q=Karim')).json.rows.length, 1, 'search reaches inside the JSON document');
  eq((await call('GET', '/api/d1/rows?table=supervisor_reports&q=nobody')).json.rows.length, 0, 'search excludes non-matches');
  eq((await call('GET', '/api/d1/rows?table=supervisor_reports&q=%')).json.rows.length, 0, 'a "%" search is a literal, not a wildcard');
  eq((await call('GET', '/api/d1/rows?table=activity_log&limit=1&offset=5')).json.rows.length, 0, 'offset past the end returns nothing');

  /* ---------- table name cannot escape the allowlist ---------- */
  eq((await call('GET', '/api/d1/rows?table=sqlite_master')).status, 404, 'a hidden table cannot be read');
  eq((await call('GET', '/api/d1/rows?table=nope')).status, 404, 'an unknown table is rejected');
  eq((await call('GET', '/api/d1/rows?table=' + encodeURIComponent('activity_log"; DROP TABLE activity_log; --'))).status, 404, 'an injected table name is rejected');
  eq((await call('GET', '/api/d1/tables')).json.tables.find((x) => x.name === 'activity_log').rows, 1, 'activity_log survived the injection attempt');

  /* ---------- meta ---------- */
  const m = await call('GET', '/api/d1/meta?table=supervisor_reports');
  eq(m.json.primaryKey, 'id', 'the primary key is reported');
  ok(m.json.editable, 'a table with a primary key is editable');

  /* ---------- edit ---------- */
  let e = await call('PATCH', '/api/d1/row?table=supervisor_reports', { key: rpt.id, column: 'supervisor_name', value: 'Sr. Rahima Akter' });
  ok(e.json.ok, 'PATCH updates a cell');
  eq(e.json.row.supervisor_name, 'Sr. Rahima Akter', 'the updated row is returned');
  eq((await sup.getReportById(rpt.id)).supervisorName, 'Sr. Rahima Akter', 'the owning module sees the change');

  e = await call('PATCH', '/api/d1/row?table=supervisor_reports', { key: rpt.id, column: 'updated_at', value: '1790000000000' });
  eq(typeof e.json.row.updated_at, 'number', 'a numeric column stays numeric after an edit');

  e = await call('PATCH', '/api/d1/row?table=supervisor_reports', { key: rpt.id, column: 'updated_at', value: 'not-a-number' });
  eq(e.status, 400, 'a non-number is rejected for a numeric column');

  /* ---------- the guard rails ---------- */
  e = await call('PATCH', '/api/d1/row?table=supervisor_reports', { key: rpt.id, column: 'id', value: 'hijacked' });
  eq(e.status, 400, 'the primary key cannot be edited');
  ok(!!(await sup.getReportById(rpt.id)), 'the row still has its original id');

  e = await call('PATCH', '/api/d1/row?table=supervisor_reports', { key: rpt.id, column: 'doc', value: 'not json at all' });
  eq(e.status, 400, 'a JSON column rejects a non-JSON value');
  eq((await sup.getReportById(rpt.id)).roundObservation, 'Quiet night.', 'the document was left untouched by the rejected edit');

  const goodDoc = JSON.stringify(Object.assign({}, JSON.parse((await call('GET', '/api/d1/rows?table=supervisor_reports')).json.rows[0].doc), { roundObservation: 'Corrected note.' }));
  e = await call('PATCH', '/api/d1/row?table=supervisor_reports', { key: rpt.id, column: 'doc', value: goodDoc });
  ok(e.json.ok, 'a JSON column accepts valid JSON');
  eq((await sup.getReportById(rpt.id)).roundObservation, 'Corrected note.', 'the corrected document is what the module reads back');

  eq((await call('PATCH', '/api/d1/row?table=supervisor_reports', { key: rpt.id, column: 'nope', value: 'x' })).status, 400, 'an unknown column is rejected');
  eq((await call('PATCH', '/api/d1/row?table=supervisor_reports', { key: 'ghost', column: 'status', value: 'draft' })).status, 404, 'an unknown row key is rejected');
  eq((await call('PATCH', '/api/d1/row?table=supervisor_reports', { column: 'status', value: 'draft' })).status, 400, 'a missing row key is rejected');

  /* ---------- edits are audited ---------- */
  const log = await call('GET', '/api/d1/rows?table=activity_log&q=db_row_updated');
  ok(log.json.rows.length >= 1, 'every accepted edit is written to the activity log');
  ok(/was: .*→ now: /.test(log.json.rows[0].detail || ''), 'the log records the old value as well as the new one');

  /* ---------- delete ---------- */
  eq((await call('DELETE', '/api/d1/row?table=supervisor_reports')).status, 400, 'delete without a key is rejected');
  eq((await call('DELETE', '/api/d1/row?table=supervisor_reports&key=ghost')).status, 404, 'deleting an unknown row is rejected');
  ok((await call('DELETE', '/api/d1/row?table=supervisor_reports&key=' + encodeURIComponent(rpt.id))).json.ok, 'DELETE removes the row');
  eq(await sup.getReportById(rpt.id), null, 'the row is really gone');
  ok((await call('GET', '/api/d1/rows?table=activity_log&q=db_row_deleted')).json.rows.length >= 1, 'the deletion is audited');

  /* ---------- non-admins are refused ---------- */
  ROLE = 'User';
  eq((await call('GET', '/api/d1/tables')).status, 403, 'a non-admin cannot list tables');
  eq((await call('GET', '/api/d1/rows?table=activity_log')).status, 403, 'a non-admin cannot read rows');
  eq((await call('PATCH', '/api/d1/row?table=activity_log', { key: 1, column: 'ip', value: 'x' })).status, 403, 'a non-admin cannot edit');
  eq((await call('DELETE', '/api/d1/row?table=activity_log&key=1')).status, 403, 'a non-admin cannot delete');
  eq((await call('GET', '/api/media/assets')).status, 403, 'a non-admin cannot browse media');
  eq((await call('DELETE', '/api/media/asset?publicId=unico/scan-1')).status, 403, 'a non-admin cannot delete media');
  ROLE = 'Administrator';

  /* ---------- media ---------- */
  const f0 = await call('GET', '/api/media/folders');
  eq(f0.json.folders, [{ name: 'unico', path: 'unico' }], 'top-level folders are listed');
  eq((await call('GET', '/api/media/folders?path=unico')).json.folders, [{ name: 'profiles', path: 'unico/profiles' }], 'sub-folders are listed');

  const a0 = await call('GET', '/api/media/assets');
  eq(a0.json.assets.length, 2, 'assets are listed');
  eq((await call('GET', '/api/media/assets?folder=unico/profiles')).json.assets.length, 1, 'assets are filtered by folder');

  const u = await call('GET', '/api/media/usage');
  eq(u.json.usage.resources, 2, 'plan usage is reported');

  eq((await call('DELETE', '/api/media/asset')).status, 400, 'deleting media without a publicId is rejected');
  ok((await call('DELETE', '/api/media/asset?publicId=unico/scan-1')).json.ok, 'DELETE removes a Cloudinary asset');
  eq((await call('GET', '/api/media/assets')).json.assets.length, 1, 'the asset is gone');
  ok((await call('GET', '/api/d1/rows?table=activity_log&q=media_deleted')).json.rows.length >= 1, 'the media deletion is audited');

  server.close();
  console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('\nTest crashed: ' + (e && e.stack || e)); process.exit(1); });
