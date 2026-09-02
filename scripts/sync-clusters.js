/* Copy the PRIMARY MongoDB cluster onto the STANDBY, so failover has something
 * real to serve. The app never writes the standby (failover is read-only), so
 * this one-way copy is the only way it stays fresh — run it:
 *   - ONCE before a new standby joins MONGODB_URIS (an empty standby = blank pages
 *     during failover), and
 *   - periodically after (weekly, or after big data entry days). Data served during
 *     a failover is as old as the last sync.
 *
 *     node scripts/sync-clusters.js            dry run — show what would be copied
 *     node scripts/sync-clusters.js --apply    copy for real (drops + recopies each
 *                                              collection on the standby)
 *     node scripts/sync-clusters.js --apply --skip=medBrands,medSourceDims
 *
 *     node scripts/sync-clusters.js --heal     AFTER a write-failover (authority
 *                                              flipped to the standby): copies the
 *                                              REVERSE way (standby -> primary, the
 *                                              standby has the newest data), then
 *                                              hands write authority back to the
 *                                              primary. Run once the primary is
 *                                              reachable again.
 *
 * URIs come from MONGODB_URIS in server/.env.production (primary = first, standby =
 * second), falling back to server/.env. Backup collections (*_bak_*) are skipped.
 */
const path = require('path');
const fs = require('fs');
const dotenv = require(path.join(__dirname, '..', 'server', 'node_modules', 'dotenv'));
const { MongoClient } = require(path.join(__dirname, '..', 'server', 'node_modules', 'mongodb'));

const envProd = path.join(__dirname, '..', 'server', '.env.production');
const envDev = path.join(__dirname, '..', 'server', '.env');
const parsed = Object.assign(
  fs.existsSync(envDev) ? dotenv.parse(fs.readFileSync(envDev)) : {},
  fs.existsSync(envProd) ? dotenv.parse(fs.readFileSync(envProd)) : {}
);

const HEAL = process.argv.includes('--heal');
const APPLY = process.argv.includes('--apply') || HEAL;
const SKIP = ((process.argv.find((a) => a.startsWith('--skip=')) || '').split('=')[1] || '')
  .split(',').map((s) => s.trim()).filter(Boolean);

const uris = String(parsed.MONGODB_URIS || '').split(',').map((s) => s.trim()).filter(Boolean);
if (uris.length < 2) { console.error('MONGODB_URIS needs at least primary,standby (found ' + uris.length + ').'); process.exit(1); }
const DB = parsed.DB_NAME || 'unico';
const host = (u) => u.replace(/^.*@/, '').split('/')[0].split('?')[0];

// --heal copies the REVERSE way: after a write-failover the STANDBY holds the
// newest data, so it is the source and the returning primary is the target.
const SRC_URI = HEAL ? uris[1] : uris[0];
const DST_URI = HEAL ? uris[0] : uris[1];

// Hand write authority back to the primary through the same Redis flag db.js reads.
async function resetAuthority() {
  ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN'].forEach((k) => { if (parsed[k] && !process.env[k]) process.env[k] = parsed[k]; });
  const redis = require(path.join(__dirname, '..', 'server', 'redis'));
  if (!redis.configured()) { console.warn('\n!! Redis credentials missing — could NOT reset write authority. Add UPSTASH_REDIS_REST_URL/TOKEN to server/.env and run --heal again.'); return; }
  await redis.set('unico:db:authority', '0');
  console.log('Write authority handed back to the PRIMARY (Redis unico:db:authority=0).');
}

(async () => {
  console.log((HEAL ? 'HEAL  standby' : 'primary') + ': ' + host(SRC_URI) + '  ->  ' + (HEAL ? 'primary' : 'standby') + ': ' + host(DST_URI) + '  (db: ' + DB + ')');
  const src = new MongoClient(SRC_URI, { serverSelectionTimeoutMS: 15000 });
  const dst = new MongoClient(DST_URI, { serverSelectionTimeoutMS: 15000 });
  await src.connect();
  try { await dst.connect(); }
  catch (e) { console.error('\nStandby unreachable: ' + e.message + '\n(The cluster must exist and allow this IP in Atlas Network Access.)'); process.exit(1); }
  const s = src.db(DB), d = dst.db(DB);

  const colls = (await s.listCollections().toArray()).map((c) => c.name)
    .filter((n) => !/_bak_/.test(n) && !SKIP.includes(n)).sort();
  let totalDocs = 0;
  for (const name of colls) {
    const n = await s.collection(name).countDocuments();
    totalDocs += n;
    console.log('  ' + String(n).padStart(7) + '  ' + name + (APPLY ? '' : '  (would copy)'));
    if (!APPLY || n === 0) {
      if (APPLY && n === 0) { try { await d.collection(name).drop(); } catch (_) { /* absent */ } }
      continue;
    }
    try { await d.collection(name).drop(); } catch (_) { /* didn't exist */ }
    const cur = s.collection(name).find({});
    let batch = [], copied = 0;
    for await (const doc of cur) {
      batch.push(doc);
      if (batch.length >= 500) { await d.collection(name).insertMany(batch, { ordered: false }); copied += batch.length; batch = []; process.stdout.write('\r  ' + String(copied).padStart(7) + '  ' + name); }
    }
    if (batch.length) { await d.collection(name).insertMany(batch, { ordered: false }); copied += batch.length; }
    process.stdout.write('\r  ' + String(copied).padStart(7) + '  ' + name + '  copied\n');
  }
  if (APPLY) {
    await d.collection('sync_meta').updateOne({ _id: 'lastSync' },
      { $set: { at: Date.now(), from: host(SRC_URI), heal: HEAL, collections: colls.length, docs: totalDocs } }, { upsert: true });
    console.log('\nDone — ' + (HEAL ? 'primary restored from the standby' : 'standby now mirrors the primary') + ' (' + colls.length + ' collections, ' + totalDocs + ' docs).');
    if (HEAL) await resetAuthority();
  } else {
    console.log('\nDry run: ' + colls.length + ' collections, ' + totalDocs + ' docs. Run with --apply to copy.');
  }
  await src.close(); await dst.close();
  process.exit(0);
})().catch((e) => { console.error('ERROR: ' + String((e && e.message) || e)); process.exit(1); });
