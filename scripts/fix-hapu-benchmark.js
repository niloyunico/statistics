/* Fix the stored HAPU benchmark on live quality docs: the indicator is the HAPU
 * INCIDENCE RATE = (patients who developed >=1 HAPU / patient-days) x 1000, so the
 * benchmark is 0.75 per 1,000 PATIENT-DAYS (docs previously said "per 1,000
 * discharges" with benchmarkValue 0). Display already goes through the corrected
 * definition in quality-corrections.js; this aligns the stored fields with it.
 * Field-level $set only — months/values untouched.
 * Usage: node scripts/fix-hapu-benchmark.js [--check]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });
try { require('dns').setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']); } catch (e) {}
const path = require('path');
const { MongoClient } = require(path.join(__dirname, '..', 'server', 'node_modules', 'mongodb'));

(async () => {
  const check = process.argv.includes('--check');
  const c = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 12000 });
  await c.connect();
  const db = c.db(process.env.DB_NAME || 'unico');
  const qcol = db.collection('quality');
  const docs = await qcol.find({}).toArray();
  for (const doc of docs) {
    const sets = {};
    (doc.indicators || []).forEach((ind, i) => {
      if (!/pressure ulcer|hapu|bed sore/i.test(String(ind.name || ''))) return;
      sets[`indicators.${i}.benchmark`] = '≤ 0.75 per 1,000 patient-days';
      sets[`indicators.${i}.benchmarkValue`] = 0.75;
      console.log(`  quality/${doc._id} [${ind.id}] "${ind.benchmark}" (bv ${ind.benchmarkValue}) -> "≤ 0.75 per 1,000 patient-days" (bv 0.75)`);
    });
    if (Object.keys(sets).length && !check) await qcol.updateOne({ _id: doc._id }, { $set: sets });
  }
  console.log(check ? '\n[hapu] dry run — no writes.' : '\n[hapu] applied.');
  await c.close();
})();
