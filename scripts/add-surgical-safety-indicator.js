/* Assign the NABH surgical-safety compliance indicator to every OT quality area
 * (General OT + CT OT): "Percentage of Compliance with the Organization's Surgical
 * Safety Protocol (Prevention of Wrong Patient, Wrong Site, and Wrong Surgery)".
 * Percentage indicator, higher-is-better, benchmark 100%. Skips an area that already
 * has it (normalized-name match). $push only — existing indicators/data untouched.
 * Usage: node scripts/add-surgical-safety-indicator.js [--check]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });
try { require('dns').setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']); } catch (e) {}
const path = require('path');
const { MongoClient } = require(path.join(__dirname, '..', 'server', 'node_modules', 'mongodb'));

const AREAS = ['OT', 'CTVS'];
const IND = {
  id: 'ind-surgical-safety-protocol-compliance',
  name: "Percentage of Compliance with the Organization's Surgical Safety Protocol (Prevention of Wrong Patient, Wrong Site, and Wrong Surgery)",
  valueType: '%',
  unit: '%',
  formula: 'pct',
  numLabel: 'Surgeries fully compliant with the surgical safety protocol',
  denLabel: 'Surgeries performed / audited',
  numeratorDef: 'Number of surgeries during the month in which the organization\'s surgical safety protocol was FULLY followed — correct patient, correct site and correct procedure verified at every required step (pre-operative verification, surgical site marking, and time-out before incision per the WHO Surgical Safety Checklist / JCI IPSG.4).',
  denominatorDef: 'Total number of surgeries performed (or audited) in the same month. Compliance % = (fully compliant surgeries / total surgeries) x 100.',
  benchmark: '100%',
  benchmarkValue: 100,
  goalDirection: 'higher_is_better',
  reference: 'NABH MOM · WHO Surgical Safety Checklist (2009) · JCI IPSG.4 (Universal Protocol)',
  months: {},
  monthRemarks: {},
};
const norm = (s) => String(s || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

(async () => {
  const check = process.argv.includes('--check');
  const c = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 12000 });
  await c.connect();
  const db = c.db(process.env.DB_NAME || 'unico');
  const qcol = db.collection('quality');
  for (const key of AREAS) {
    const doc = await qcol.findOne({ _id: key });
    if (!doc) { console.log(`  ${key}: area not found — skipped`); continue; }
    const inds = doc.indicators || [];
    const dup = inds.find((i) => i.id === IND.id || norm(i.name) === norm(IND.name) || /surgical safety/.test(norm(i.name)));
    if (dup) { console.log(`  ${key}: already has "${dup.name}" — skipped`); continue; }
    console.log(`  ${key} (${doc.name}): adding "${IND.name}" (${inds.length} -> ${inds.length + 1} indicators)`);
    if (!check) await qcol.updateOne({ _id: key }, { $push: { indicators: Object.assign({}, IND) } });
  }
  console.log(check ? '\n[assign] dry run — no writes.' : '\n[assign] applied.');
  await c.close();
})();
