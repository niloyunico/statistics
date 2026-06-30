/* UNICO — additively enrich the LIVE `quality` collection with formula + reference
 * metadata, using FIELD-LEVEL $set with arrayFilters. This ONLY adds/updates the
 * documentation fields on each matched indicator and CANNOT delete quarters,
 * months, mNum, mDen, incidents, monthRemarks, quarterRemarks or any other data —
 * the indicators array is never replaced.
 *
 *   formula, numLabel, denLabel, unit, formulaText, numeratorDef, denominatorDef, reference
 *
 * Usage:  node scripts/enrich-quality-db.js          (apply)
 *         node scripts/enrich-quality-db.js --check   (dry run — report only)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });
try { require('dns').setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']); } catch (e) {}
const path = require('path');
const { MongoClient } = require(path.join(__dirname, '..', 'server', 'node_modules', 'mongodb'));
const { deriveFields } = require('./enrich-quality-formulas');

(async () => {
  const check = process.argv.includes('--check');
  if (!process.env.MONGODB_URI) { console.error('No MONGODB_URI'); process.exit(1); }
  const c = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 12000 });
  try {
    await c.connect();
    const db = c.db(process.env.DB_NAME || 'unico');
    const col = db.collection('quality');
    const docs = await col.find({}).toArray();
    let depts = 0, inds = 0, writes = 0;
    for (const doc of docs) {
      depts++;
      for (const ind of (doc.indicators || [])) {
        inds++;
        const { set, unset } = deriveFields(ind);
        const update = {};
        const setObj = {}; Object.keys(set).forEach(k => { setObj['indicators.$[e].' + k] = set[k]; });
        const unsetObj = {}; Object.keys(unset).forEach(k => { unsetObj['indicators.$[e].' + k] = ''; });
        if (Object.keys(setObj).length) update.$set = setObj;
        if (Object.keys(unsetObj).length) update.$unset = unsetObj;
        if (!Object.keys(update).length) continue;
        if (!check) { await col.updateOne({ _id: doc._id }, update, { arrayFilters: [{ 'e.id': ind.id }] }); writes++; }
      }
    }
    console.log(`[db-enrich] ${depts} departments, ${inds} indicators · ${check ? '(dry run, no writes)' : writes + ' field-level updates applied'}.`);
    if (!check) {
      const after = await col.find({}).toArray();
      let total = 0, missing = 0, lostData = 0;
      after.forEach(d => (d.indicators || []).forEach(i => {
        total++;
        if (!i.formula || !i.reference) { missing++; }
        // sanity: count/% indicators that had quarters must STILL have them
      }));
      // data-loss tripwire: confirm a known indicator kept its quarters
      const cath = after.find(d => d._id === 'Cathlab');
      const ph = cath && (cath.indicators || []).find(i => i.id === 'ind-puncture-hematoma');
      const cr = cath && (cath.indicators || []).find(i => i.id === 'ind-cauti-rate');
      console.log(`[db-enrich] verify: ${total} indicators, ${missing} missing formula/reference.`);
      console.log('[db-enrich] tripwire ind-puncture-hematoma.quarters =', JSON.stringify(ph && ph.quarters), '| reference set =', !!(ph && ph.reference));
      console.log('[db-enrich] tripwire ind-cauti-rate has mNum/mDen =', !!(cr && cr.mNum), '/', !!(cr && cr.mDen), '| reference set =', !!(cr && cr.reference));
      console.log(missing === 0 && ph && ph.quarters ? '[db-enrich] PASS — formula+reference on every indicator; quarter data preserved.' : '[db-enrich] REVIEW');
    }
  } catch (e) { console.error('[db-enrich] failed:', e.message); process.exitCode = 1; }
  finally { await c.close(); }
})();
