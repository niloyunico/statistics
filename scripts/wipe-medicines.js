/* EMPTY the Medicine & Rx drug index.
 *
 * Deletes every document from the drug-catalog collections so the hospital can
 * start from a clean, empty index:
 *
 *   medBrands     - brand rows (the imported BD index and any local additions)
 *   medGenerics   - generic/monograph rows
 *   medRefs       - reference rows the index shipped with
 *   medImages     - brand photos (stored as bytes IN Mongo, so nothing orphans)
 *
 * DELIBERATELY UNTOUCHED: `prescriptions` and `rxTemplates` - those are the
 * hospital's own clinical records, not catalog data. Wipe them only on an
 * explicit, separate decision.
 *
 * The wiped catalog is recoverable at any time: the CC0 dataset is committed in
 * scripts/data/bdmed/ and the importer re-loads it fully offline.
 *
 * Usage:
 *   node scripts/wipe-medicines.js          # dry run - counts only, deletes nothing
 *   node scripts/wipe-medicines.js --yes    # actually delete
 *
 * After a real run, flush the server read-cache so the app doesn't keep serving
 * the cached index:  npm --prefix server run cache:flush
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });
try { require('dns').setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']); } catch (e) {}
const path = require('path');
const { MongoClient } = require(path.join(__dirname, '..', 'server', 'node_modules', 'mongodb'));

const COLLS = ['medBrands', 'medGenerics', 'medRefs', 'medImages'];
const APPLY = process.argv.includes('--yes');

(async () => {
  const c = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await c.connect();
  const db = c.db(process.env.DB_NAME || 'unico');   // same resolution as server/db.js
  console.log((APPLY ? 'DELETING' : 'DRY RUN (nothing deleted - re-run with --yes)') + ' on db "' + db.databaseName + '"\n');
  for (const name of COLLS) {
    const col = db.collection(name);
    const n = await col.countDocuments();
    if (!APPLY) { console.log('  ' + name.padEnd(12) + n + ' docs'); continue; }
    const r = await col.deleteMany({});
    console.log('  ' + name.padEnd(12) + r.deletedCount + ' deleted (was ' + n + ')');
  }
  const rx = await db.collection('prescriptions').countDocuments();
  const tpl = await db.collection('rxTemplates').countDocuments();
  console.log('\n  kept: prescriptions ' + rx + ' · rxTemplates ' + tpl + ' (clinical records - not touched)');
  await c.close();
  console.log(APPLY ? '\nDone. Now run: npm --prefix server run cache:flush' : '');
})().catch((e) => { console.error('FAILED:', e.message || e); process.exit(1); });
