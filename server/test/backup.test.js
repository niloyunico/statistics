/* The daily verified backup (server/backup.js) against a stand-in Cloudflare R2, D1 and Vercel
   Blob, with a local MongoDB test database. Run: node test/backup.test.js (skipped without MongoDB) */
const assert = require('assert');
const zlib = require('zlib');
const { MongoClient } = require('mongodb');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'backup-test-secret';
for (const k of Object.keys(process.env)) if (/^R2_/.test(k)) delete process.env[k];
const DB_NAME = 'backuptest_' + Date.now().toString(36);
let passed = 0;
const ok = (m) => { passed++; console.log('  ok  ' + m); };

// ---- stand-ins ----
function fakeR2() {
  const objects = new Map();
  return {
    objects,
    configured: () => true, load: async () => {}, publicConfig: () => ({ configured: true, bucket: 'unico-backups' }),
    async putObject(key, body) { const b = Buffer.isBuffer(body) ? body : Buffer.from(body); objects.set(key, b); return { key, bytes: b.length }; },
    damage: null,   // (key) => true: that object reads back damaged
    async getObject(key) { if (!objects.has(key)) { const e = new Error('404'); e.status = 404; throw e; } return this.damage && this.damage(key) ? zlib.gzipSync('[]') : objects.get(key); },
    async headObject(key) { return objects.has(key) ? { bytes: objects.get(key).length } : null; },
    async list(prefix) { return [...objects.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ key: k, bytes: objects.get(k).length })); },
  };
}
function fakeD1(rowsActivity) {
  const tables = [{ name: 'activity_log', sql: 'CREATE TABLE activity_log (id INTEGER)' }, { name: 'meds_brands', sql: 'CREATE TABLE meds_brands (id INTEGER)' }, { name: 'supervisor_reports', sql: 'CREATE TABLE supervisor_reports (id INTEGER)' }];
  const data = { activity_log: Array.from({ length: rowsActivity }, (_, i) => ({ id: i })), meds_brands: Array.from({ length: 30 }, (_, i) => ({ id: i })), supervisor_reports: [{ id: 1 }] };
  return {
    data,
    configured: () => true,
    async query(sql) {
      if (/sqlite_master/.test(sql)) return tables;
      const t = sql.match(/FROM "([^"]+)"/)[1]; const lim = Number(sql.match(/LIMIT (\d+)/)[1]); const off = Number(sql.match(/OFFSET (\d+)/)[1]);
      return data[t].slice(off, off + lim);
    },
  };
}
function fakeBlob(files) {
  return {
    files,
    async listPage(prefix, cursor) { const start = cursor ? Number(cursor) : 0; const page = files.slice(start, start + 2); return { files: page.map((f) => ({ pathname: f.pathname, size: f.data.length })), cursor: start + 2 < files.length ? String(start + 2) : '' }; },
    async readBuffer(p) { const f = files.find((x) => x.pathname === p); return f ? { data: f.data, contentType: 'image/avif' } : null; },
  };
}

(async () => {
  let client;
  try { client = await MongoClient.connect('mongodb://127.0.0.1:27017', { serverSelectionTimeoutMS: 2500 }); }
  catch (e) { console.log('  --  MongoDB is not running on this computer: skipped.'); return; }
  const db = client.db(DB_NAME);
  try {
    await db.collection('staff').insertMany([{ _id: 1, name: 'A' }, { _id: 2, name: 'B' }, { _id: 3, name: 'C' }]);
    await db.collection('appdata').insertOne({ _id: 'shared', data: { unico_staff_v3: '[]' } });
    await db.collection('supervisorReports').insertMany([{ _id: 's1' }, { _id: 's2' }]);
    await db.collection('h360Patients').insertOne({ _id: 'p1' });
    await db.collection('bnmcPhotos').insertOne({ _id: 'x' });
    await db.collection('h360Employees').insertOne({ _id: '11809' });

    const r2 = fakeR2();
    const d1 = fakeD1(12000);
    const blob = fakeBlob([{ pathname: 'unico/staff/blob_a.avif', data: Buffer.from('AAAA') }, { pathname: 'unico/staff/blob_b.avif', data: Buffer.from('BBBBBB') }, { pathname: 'unico/staff/blob_c.avif', data: Buffer.from('CC') }]);
    let clock = Date.UTC(2026, 10, 11, 21, 0, 0);   // a Wednesday (Thursday 03:00 Dhaka)
    const { createBackup } = require('../backup');
    const svc = createBackup({ r2, d1, blob, getDb: async () => db, now: () => (clock += 200) });

    // ---- 1. first daily backup, in many small steps (as several cron calls would) ----
    let out, calls = 0;
    do { out = await svc.daily(3000, 'test'); calls++; } while (!out.run.ok && calls < 200);
    assert.ok(out.run.ok, 'the run completes');
    assert.ok(calls > 3, 'it took several calls (resumable)');
    const latest = JSON.parse(r2.objects.get('unico-backups/latest.json').toString());
    const m1 = JSON.parse(r2.objects.get(latest.manifestKey).toString());
    const cols = Object.keys(m1.mongo.collections);
    assert.ok(cols.includes('staff') && cols.includes('appdata') && cols.includes('h360Employees'));
    for (const x of ['supervisorReports', 'h360Patients', 'bnmcPhotos', 'backupRuns']) assert.ok(!cols.includes(x), x + ' is excluded');
    assert.strictEqual(m1.mongo.collections.staff.count, 3);
    assert.deepStrictEqual(Object.keys(m1.d1.tables).sort(), ['activity_log', 'meds_brands']);
    assert.strictEqual(m1.d1.tables.activity_log.count, 12000);
    assert.strictEqual(m1.d1.tables.activity_log.parts.length, 3, '12,000 rows in parts of 5,000');
    assert.ok(/full/.test(m1.verification), 'the first backup is checked in full');
    assert.deepStrictEqual(['unico/staff/blob_a.avif', 'unico/staff/blob_b.avif', 'unico/staff/blob_c.avif'].map((p) => r2.objects.has('unico-backups/files/' + p)), [true, true, true]);
    const staffText = zlib.gunzipSync(r2.objects.get(m1.mongo.collections.staff.key)).toString();
    assert.ok(staffText.includes('"name":"B"'));
    ok('first backup: every collection except Supervisor Reports / H360 patients / caches, D1 in parts, all Blob files; resumable; fully checked');

    // ---- 2. the same day again: nothing to do ----
    const again = await svc.daily(3000, 'test');
    assert.ok(again.already);
    ok('a second call the same day finds the verified backup and does nothing');

    // ---- 3. next day, nothing changed: nothing new uploaded, manifest still complete ----
    clock += 24 * 3600 * 1000;
    const before = r2.objects.size;
    calls = 0;
    do { out = await svc.daily(3000, 'test'); calls++; } while (!out.run.ok && calls < 200);
    const m2 = JSON.parse(r2.objects.get(JSON.parse(r2.objects.get('unico-backups/latest.json').toString()).manifestKey).toString());
    assert.strictEqual(r2.objects.size - before, 1, 'only the new manifest (latest.json is rewritten in place) — no data re-uploaded');
    assert.deepStrictEqual(Object.keys(m2.mongo.collections).sort(), cols.sort());
    assert.ok(Object.values(m2.mongo.collections).every((e) => e.reused));
    ok('next day, unchanged data: nothing uploaded again, the manifest still lists everything');

    // ---- 4. an object of today's run reads back damaged: verification fails, latest.json does not move,
    //         the next call retries and completes. (A reused object found missing or changed is uploaded
    //         again before it is relied on — that is the step before.)
    clock += 24 * 3600 * 1000;
    await db.collection('staff').insertOne({ _id: 4, name: 'D' });
    r2.damage = (k) => k.endsWith('mongo/staff.ejson.gz') && k !== m1.mongo.collections.staff.key;
    const latestBefore = r2.objects.get('unico-backups/latest.json').toString();
    calls = 0;
    do { out = await svc.daily(3000, 'test'); calls++; } while (!out.run.error && !out.run.ok && calls < 200);
    assert.ok(!out.run.ok && /does not match its checksum/.test(out.run.error || ''), 'verification catches it: ' + out.run.error);
    assert.strictEqual(r2.objects.get('unico-backups/latest.json').toString(), latestBefore, 'latest.json still points at the last verified backup');
    let st = await svc.status();
    assert.ok(['ok', 'stale'].includes(st.state) && st.today && st.today.error, 'the indicator still shows the last good backup, with the error of today');
    r2.damage = null;
    calls = 0;
    do { out = await svc.daily(3000, 'test'); calls++; } while (!out.run.ok && calls < 200);
    assert.ok(out.run.ok, 'the next call retries and completes');
    const m3 = JSON.parse(r2.objects.get(JSON.parse(r2.objects.get('unico-backups/latest.json').toString()).manifestKey).toString());
    assert.strictEqual(m3.mongo.collections.staff.count, 4);
    ok('a backup object that reads back damaged fails verification, latest.json stays on the good backup, the next scheduled call retries and succeeds');

    // ---- 5. status for the indicator ----
    st = await svc.status();
    assert.strictEqual(st.state, 'ok');
    assert.ok(st.lastGood && st.lastGood.verifiedAt && st.usage.bytes > 0 && st.usage.limit === 10 * 1024 * 1024 * 1024);
    assert.ok(st.excluded.includes('supervisorReports'));
    ok('status: state ok, last verified backup, storage used of 10 GB, what is excluded');

    // ---- 6. the R2 settings: sealed, never shown ----
    const r2real = require('../r2');
    const cfg = await r2real.save(db, { accountId: 'abc123', bucket: 'unico-backups', keyId: 'AKIDEXAMPLE12345', secret: 'super-secret-value' }, 'tester');
    const stored = await db.collection('backupConfig').findOne({ _id: 'r2' });
    assert.ok(!JSON.stringify(stored).includes('super-secret-value'), 'the secret is sealed in the database');
    assert.ok(!JSON.stringify(cfg).includes('super-secret-value') && cfg.keyId === 'AKID…2345' && cfg.endpoint === 'https://abc123.r2.cloudflarestorage.com');
    assert.strictEqual(r2real.configured(), true);
    ok('R2 settings from the admin panel: saved sealed, the secret never shown, configured from the database');
  } finally {
    await db.dropDatabase().catch(() => {});
    await client.close();
  }
  console.log('\n' + passed + ' passed');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
