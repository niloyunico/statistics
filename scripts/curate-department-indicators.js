/* Curate each department's quality-indicator set (per user-approved mapping):
 *   - KEEP the applicable common indicators (verbatim — all months/incidents/data preserved)
 *   - DROP the ones that don't apply to that unit
 *   - ADD unit-specific indicators (same shape: formula 'direct', value entered per month)
 *
 * Field-aware & backed up. Writes `indicators` per department via $set; kept
 * indicators keep every field, so no data is lost for them. Removed indicators
 * (all zero-defect months) are intentionally dropped.
 *
 * Usage: node scripts/curate-department-indicators.js [--check]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });
try { require('dns').setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']); } catch (e) {}
const path = require('path');
const { MongoClient } = require(path.join(__dirname, '..', 'server', 'node_modules', 'mongodb'));

// common indicator ids
const C = {
  cauti: 'ind-catheter-associated-uti', clabsi: 'ind-central-line-associated-bloodstream-infection',
  nsi: 'ind-needle-stick-injury', vap: 'ind-ventilator-associated-pneumonia', ssi: 'ind-surgical-site-infection',
  hapu: 'ind-hospital-acquired-pressure-ulcer', phleb: 'ind-phlebitis', dvt: 'ind-deep-vein-thrombosis',
  med: 'ind-medication-error', ett: 'ind-accidental-removal-of-ett-tube', fall: 'ind-patient-fall',
  readm: 'ind-re-admission-within-48-hours', reint: 'ind-re-intubation-within-48-hours',
};
const ALL13 = Object.values(C);

// per-department KEEP list (ordered)
const KEEP = {
  'OPD': [C.nsi, C.med, C.fall],
  'Emergency': [C.nsi, C.med, C.fall, C.phleb],
  'Level 9': [C.cauti, C.clabsi, C.nsi, C.ssi, C.hapu, C.phleb, C.dvt, C.med, C.fall],
  'Level 10': [C.cauti, C.clabsi, C.nsi, C.ssi, C.hapu, C.phleb, C.dvt, C.med, C.fall],
  'MICU': ALL13,
  'SICU': ALL13,
  'CCU': [C.cauti, C.clabsi, C.nsi, C.vap, C.hapu, C.phleb, C.dvt, C.med, C.fall, C.ett, C.readm, C.reint],
  'NICU': [C.clabsi, C.nsi, C.vap, C.hapu, C.phleb, C.med, C.ett, C.readm, C.reint],
  'Cathlab': [C.nsi, C.med, C.phleb, C.ssi],
  'Endoscopy': [C.nsi, C.med, C.fall, C.phleb],
  'OT': [C.ssi, C.nsi, C.med],
  'Dialysis': [C.clabsi, C.nsi, C.med, C.fall, C.phleb],
  'LDR': [C.cauti, C.nsi, C.ssi, C.med, C.fall, C.phleb, C.dvt],
  // 'Overall Hospital' intentionally omitted -> left unchanged
};

// indicator factory (matches the rebuilt-dataset shape)
function mk(name, id, valueType, goalDirection, benchmarkValue, benchmark, reference, numeratorDef) {
  return { name, id, valueType, unit: valueType === '%' ? '%' : 'count', goalDirection, benchmarkValue, benchmark, reference, formula: 'direct', numeratorDef, months: {} };
}
const pct = (n, id, bv, bm, ref, nd) => mk(n, id, '%', 'higher_is_better', bv, bm, ref, nd);
const cnt = (n, id, ref, nd) => mk(n, id, 'Count', 'lower_is_better', 0, '0 (zero defect)', ref, nd);

// per-department ADD list (unit-specific)
const ADD = {
  'CCU': [pct('Cardiac Arrest Survival Rate', 'ind-cardiac-arrest-survival-rate', 25, '>= 25% (ROSC sustained / discharged)', 'Utstein resuscitation reporting', 'Cardiac arrests survived (ROSC/discharge) / cardiac arrest events x 100.')],
  'Cathlab': [
    pct('Door-to-Balloon Compliance (<=90 min)', 'ind-door-to-balloon-compliance', 90, '>= 90% within 90 min', 'ACC/AHA STEMI guideline', 'Primary-PCI cases with door-to-balloon <=90 min / total primary-PCI cases x 100.'),
    cnt('Puncture Site Hematoma', 'ind-puncture-site-hematoma', 'Cath-lab procedural safety', 'Access-site haematoma events after cardiac catheterisation/PCI.'),
    cnt('Post-PCI Complication', 'ind-post-pci-complication', 'Cath-lab procedural safety', 'Post-PCI complications (vascular / access-site / other).'),
  ],
  'Endoscopy': [cnt('Post-Procedure Complication', 'ind-post-procedure-complication', 'Procedural safety indicator', 'Complications following an endoscopic / diagnostic procedure.')],
  'Dialysis': [
    pct('Dialysis Adequacy (URR)', 'ind-dialysis-adequacy-urr', 65, '>= 65% URR', 'KDOQI Haemodialysis Adequacy', 'Sessions achieving URR >=65% (or Kt/V >=1.2) / sessions sampled x 100.'),
    pct('Water Quality Compliance', 'ind-water-quality-compliance', 100, '100% AAMI/ISO compliance', 'AAMI / ISO 23500', 'Water/dialysate samples within AAMI/ISO limits / samples tested x 100.'),
    cnt('Intradialytic Hypotension', 'ind-intradialytic-hypotension', 'Dialysis safety', 'Intradialytic hypotension events.'),
    cnt('Vascular Access Complication', 'ind-vascular-access-complication', 'Dialysis vascular-access safety', 'Vascular-access complications (infection / thrombosis / bleeding).'),
    cnt('Accidental De-lining of Catheter', 'ind-accidental-de-lining-of-catheter', 'NABH device-management safety', 'Accidental / unplanned dialysis-catheter de-lining events.'),
  ],
  'LDR': [
    pct('Partograph Compliance', 'ind-partograph-compliance', 100, '100%', 'WHO Labour Care Guide', 'Deliveries with a correctly completed partograph / eligible labours x 100.'),
    pct('Fetal Heart Rate Monitoring Compliance', 'ind-fetal-heart-rate-monitoring', 100, '100%', 'Intrapartum fetal surveillance', 'Labours with FHR monitored per protocol / labours requiring it x 100.'),
  ],
};

(async () => {
  const check = process.argv.includes('--check');
  const c = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 12000 });
  await c.connect();
  const db = c.db(process.env.DB_NAME || 'unico');
  const col = db.collection('quality');

  for (const deptKey of Object.keys(KEEP)) {
    const doc = await col.findOne({ _id: deptKey });
    if (!doc) { console.log('  SKIP (no dept):', deptKey); continue; }
    const byId = {}; (doc.indicators || []).forEach((i) => { byId[i.id] = i; });
    // kept (verbatim), in KEEP order
    const kept = KEEP[deptKey].map((id) => byId[id]).filter(Boolean);
    // month coverage from kept indicators (to give new COUNT indicators matching zero-defect months)
    const monthKeys = new Set();
    kept.forEach((i) => Object.keys(i.months || {}).forEach((m) => monthKeys.add(m)));
    const zeroMonths = {}; [...monthKeys].forEach((m) => { zeroMonths[m] = 0; });
    // added (skip if already present), count indicators get zero-defect months, % stay empty
    const have = new Set(kept.map((i) => i.id));
    const added = (ADD[deptKey] || []).filter((a) => !have.has(a.id)).map((a) => a.valueType === 'Count' ? Object.assign({}, a, { months: Object.assign({}, zeroMonths) }) : a);
    const next = kept.concat(added);
    const droppedIds = (doc.indicators || []).map((i) => i.id).filter((id) => !next.some((n) => n.id === id));
    console.log(`  ${deptKey.padEnd(16)} ${(doc.indicators || []).length} -> ${next.length}  (kept ${kept.length}, +add ${added.length}: ${added.map(a => a.name).join(', ') || '—'}; dropped ${droppedIds.length})`);
    if (!check) await col.updateOne({ _id: deptKey }, { $set: { indicators: next } });
  }
  console.log(check ? '\n[curate] dry run — no writes.' : '\n[curate] applied.');
  await c.close();
})();
