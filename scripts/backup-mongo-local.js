/* Full, lossless LOCAL backup of the production Mongo database — READ-ONLY against the DB.
 *
 * Every collection is exported as Extended JSON (canonical EJSON keeps ObjectId / Date /
 * Long / Decimal types exactly), one file per collection, plus a manifest with document
 * counts and a SHA-256 per file. Nothing is written to the database.
 *
 *   node scripts/backup-mongo-local.js [label]
 *   → %USERPROFILE%\Documents\UNICO-db-backups\<date>-<label>\<collection>.ejson + manifest.json
 *
 * Restore is a deliberate, separate step (scripts/restore-mongo-local.js) — never automatic.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const serverRequire = require('module').createRequire(path.join(__dirname, '..', 'server', 'index.js'));
serverRequire('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const { EJSON } = serverRequire('bson');
const db = serverRequire('./db');

(async () => {
  const label = (process.argv[2] || 'manual').replace(/[^a-z0-9._-]+/gi, '-');
  const stamp = new Date().toISOString().replace(/[:]/g, '-').replace(/\..+$/, '');
  const dir = path.join(os.homedir(), 'Documents', 'UNICO-db-backups', stamp + '-' + label);
  fs.mkdirSync(dir, { recursive: true });

  const h = await db.getDbHandle(); const d = h && h.db ? h.db : h;
  if (!d) throw new Error('No database connection (MONGODB_URI not set?)');
  const names = (await d.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).sort();
  const manifest = { database: d.databaseName, startedAt: new Date().toISOString(), collections: {} };

  for (const name of names) {
    const file = path.join(dir, name + '.ejson');
    const out = fs.createWriteStream(file);
    const hash = crypto.createHash('sha256');
    let n = 0;
    let streamError = null; out.on('error', (e) => { streamError = e; });
    const write = (s) => new Promise((res, rej) => { if (streamError) return rej(streamError); hash.update(s); if (out.write(s)) res(); else out.once('drain', res); });
    await write('[\n');
    const cursor = d.collection(name).find({}).sort({ _id: 1 });
    for await (const doc of cursor) {
      await write((n ? ',\n' : '') + EJSON.stringify(doc, { relaxed: false }));
      n++;
    }
    await write('\n]\n');
    await new Promise((res) => out.end(res));
    const live = await d.collection(name).countDocuments({});
    manifest.collections[name] = { documents: n, liveCountAfter: live, bytes: fs.statSync(file).size, sha256: hash.digest('hex') };
    console.log(name.padEnd(40) + String(n).padStart(7) + ' docs' + (live !== n ? '   ⚠ live count now ' + live + ' (changed during backup)' : ''));
  }

  // Verify: every file re-reads and parses to the same number of documents.
  let bad = 0;
  for (const name of names) {
    const arr = EJSON.parse(fs.readFileSync(path.join(dir, name + '.ejson'), 'utf8'), { relaxed: false });
    if (!Array.isArray(arr) || arr.length !== manifest.collections[name].documents) { bad++; console.log('VERIFY FAILED: ' + name); }
  }
  manifest.finishedAt = new Date().toISOString();
  manifest.verified = bad === 0;
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  const total = Object.values(manifest.collections).reduce((s, c) => s + c.documents, 0);
  console.log('\n' + names.length + ' collections, ' + total + ' documents → ' + dir + '\nverified: ' + (bad === 0 ? 'yes (all files re-read with matching counts)' : 'NO — ' + bad + ' failed'));
})().then(() => process.exit(0)).catch((e) => { console.error('BACKUP FAILED:', e.stack || e.message); process.exit(1); });
