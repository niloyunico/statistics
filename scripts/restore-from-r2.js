/* Inspect / restore a Cloudflare R2 backup made by server/backup.js.
 *
 * SAFE BY DEFAULT. Without --apply nothing is written anywhere except optional local files.
 * With --apply it only INSERTS documents whose _id is missing from the live collection —
 * it never overwrites, updates or deletes existing data.
 *
 *   node scripts/restore-from-r2.js                      # latest backup: verify + compare with live
 *   node scripts/restore-from-r2.js <manifestKey>        # a specific run
 *   node scripts/restore-from-r2.js --list               # list backup runs in the bucket
 *   node scripts/restore-from-r2.js --collection staff   # limit to one collection
 *   node scripts/restore-from-r2.js --to-dir C:\restore  # also write verified .ejson / .json files
 *   node scripts/restore-from-r2.js --apply              # insert MISSING documents only (Mongo)
 */
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');
const serverRequire = require('module').createRequire(path.join(__dirname, '..', 'server', 'index.js'));
serverRequire('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const { EJSON } = serverRequire('bson');
const r2 = serverRequire('./r2');
const backup = serverRequire('./backup');
const db = serverRequire('./db');

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const APPLY = flag('--apply');
const ONLY = opt('--collection');
const TO_DIR = opt('--to-dir');
const manifestArg = args.find((a) => a.endsWith('manifest.json'));

(async () => {
  if (flag('--list')) {
    const runs = (await r2.list(backup.ROOT + '/')).filter((o) => o.key.endsWith('/manifest.json')).sort((a, b) => a.key.localeCompare(b.key));
    runs.forEach((o) => console.log(o.lastModified + '  ' + o.key));
    console.log(runs.length + ' backup runs');
    return;
  }
  const manifest = manifestArg ? JSON.parse((await r2.getObject(manifestArg)).toString('utf8')) : await backup.readLatestManifest();
  if (!manifest) throw new Error('No backup found in R2.');
  console.log('backup: ' + manifest.startedAt + ' (' + manifest.reason + ')');
  const h = await db.getDbHandle(); const live = h && h.db ? h.db : h;
  if (TO_DIR) fs.mkdirSync(TO_DIR, { recursive: true });

  let problems = 0, inserted = 0;
  for (const [name, entry] of Object.entries((manifest.mongo && manifest.mongo.collections) || {})) {
    if (ONLY && name !== ONLY) continue;
    const text = zlib.gunzipSync(await r2.getObject(entry.key)).toString('utf8');
    const okHash = crypto.createHash('sha256').update(text).digest('hex') === entry.sha256;
    const docs = EJSON.parse(text, { relaxed: false });
    if (!okHash || docs.length !== entry.count) { problems++; console.log('  ✗ ' + name + ': checksum/count mismatch — backup object is corrupt'); continue; }
    if (TO_DIR) fs.writeFileSync(path.join(TO_DIR, name + '.ejson'), text);
    let missing = [];
    if (live) {
      const ids = new Set((await live.collection(name).find({}, { projection: { _id: 1 } }).toArray()).map((d) => EJSON.stringify(d._id)));
      missing = docs.filter((d) => !ids.has(EJSON.stringify(d._id)));
    }
    console.log('  ✓ ' + name.padEnd(36) + String(docs.length).padStart(7) + ' in backup, ' + missing.length + ' missing from live');
    if (APPLY && missing.length) {
      const r = await live.collection(name).insertMany(missing, { ordered: false });
      inserted += r.insertedCount; console.log('      inserted ' + r.insertedCount + ' missing documents (nothing overwritten)');
    }
  }
  for (const [name, entry] of Object.entries((manifest.d1 && manifest.d1.tables) || {})) {
    if (ONLY && name !== ONLY) continue;
    const text = zlib.gunzipSync(await r2.getObject(entry.key)).toString('utf8');
    const okHash = crypto.createHash('sha256').update(text).digest('hex') === entry.sha256;
    const body = JSON.parse(text);
    if (!okHash || body.rows.length !== entry.count) { problems++; console.log('  ✗ D1 ' + name + ': checksum/count mismatch'); continue; }
    if (TO_DIR) fs.writeFileSync(path.join(TO_DIR, 'd1-' + name + '.json'), text);
    console.log('  ✓ D1 ' + name.padEnd(33) + String(body.rows.length).padStart(7) + ' rows verified' + (APPLY ? ' (D1 restore is manual: use the saved JSON + schema)' : ''));
  }
  console.log(problems ? '\n' + problems + ' dataset(s) FAILED verification' : '\nall datasets verified' + (APPLY ? ' · inserted ' + inserted + ' missing documents' : ' (dry run — nothing written to the database)'));
})().then(() => process.exit(0)).catch((e) => { console.error('RESTORE FAILED:', e.message); process.exit(1); });
