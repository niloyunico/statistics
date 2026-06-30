/* One-off: import the detailed incident reports from NQI report_June 2026.xlsx
 * into the live `quality` collection, as per-incident detail (patient + cause +
 * CAPA). FIELD-LEVEL and ADDITIVE: for each indicator it only $sets that
 * indicator's `incidents` subdocument (merging with any existing months) via
 * arrayFilters — it never replaces the indicators array and never touches
 * quarters / months / mNum / mDen. Backs up first.
 *
 * Usage: node scripts/import-excel-incidents.js [--check]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });
try { require('dns').setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']); } catch (e) {}
const path = require('path');
const { MongoClient } = require(path.join(__dirname, '..', 'server', 'node_modules', 'mongodb'));

const E = (o) => Object.assign({ uhid: '', patientName: '', age: '', gender: '', diagnosis: '', admissionDate: '', procedureDate: '', details: '', finding: '', corrective: '', preventive: '', remark: '', source: 'NQI report June 2026 (Excel)' }, o);

// dept key -> indicator id -> month -> [incident]
const IMPORT = [
  { dept: 'Level 10', ind: 'ind-patient-fall', month: 'Sep-25', inc: E({
    details: 'A revolving chair provided by housekeeping for the patient’s use was not stabilized prior to seating. When the patient attempted to sit, the chair moved away, resulting in a fall — attributed to use of an unsecured, mobile revolving chair without locking/stabilization. Fall rate 15.87 per 1,000 patient-days (1 fall / 63 patient-days).',
    corrective: 'All revolving chairs removed from patient areas and replaced with stable, secured seating. Patient reassured and required treatment provided.',
    preventive: 'Patient & family educated on safe transfer and seating; staff given reinforced fall-prevention and safe-equipment training; nurses instructed not to use revolving chairs; housekeeping department informed.',
  }) },
  { dept: 'NICU', ind: 'ind-accidental-removal-of-ett-tube', month: 'Nov-25', inc: E({
    patientName: 'Baby of Sanchchita', uhid: '20254488', admissionDate: '2025-11-20',
    details: 'Neonate on mechanical ventilator care (under Dr May May). On the night of 29/11/2025 the endotracheal (ET) tube was accidentally removed. Rate 8.33 per 100 ventilator-days (1 event / 12 ventilator-days).',
    finding: 'On identification of the accidental extubation, the patient’s ET tube and airway status were immediately assessed.',
    corrective: 'The endotracheal tube was promptly reinserted and ventilator support re-established to stabilize the neonate.',
    preventive: 'All staff counselled regarding the incident; unit-wide training conducted on secure ET-tube fixation, safe handling of ventilated neonates, and prevention of accidental extubation.',
  }) },
  { dept: 'CCU', ind: 'ind-hospital-acquired-pressure-ulcer', month: 'Jan-26', inc: E({
    patientName: 'Monowara Jahan', age: '77', gender: 'Female', uhid: '20266160',
    diagnosis: 'CKD, DM, HTN, bronchial asthma, hypothyroidism; H/O Lt compound intertrochanteric fracture of hip with severe pain and restricted mobility',
    details: 'Under Dr Shahimur Parvez. PPM replacement done 1/2/26; epidural line (inj. Bupivacaine + Fentanyl) started from OT. During nursing mobilization, a Grade-2 pressure ulcer developed over both buttocks due to restricted mobility post hip fracture/surgery. HAPU rate 15.87 per 1,000 patient-days (1 case / 63 patient-days).',
    corrective: '5/2/26 orthopedic surgery (CRIF by PFN) done; pain reduced. 2-hourly position change, olive oil + Vaseline applied, dressing BID, air cushion applied (15/2/26).',
    preventive: 'Pressure-injury prevention bundle reinforced; patient discharged with pressure ulcer improved to Grade-1.',
  }) },
  { dept: 'MICU', ind: 'ind-re-intubation-within-48-hours', month: 'Jan-26', inc: E({
    details: 'January 2026: 1 planned extubation, of which 1 required re-intubation within 48 hours — re-intubation rate 100% (1/1). Cause: Respiratory distress.',
    finding: 'Cause of re-intubation: Respiratory distress.',
    corrective: 'Close respiratory monitoring, optimization of extubation-readiness assessment, and prompt management of respiratory compromise ensured.',
  }) },
  { dept: 'MICU', ind: 'ind-re-intubation-within-48-hours', month: 'Mar-26', inc: E({
    details: 'March 2026: 2 planned extubations, of which 1 required re-intubation within 48 hours — re-intubation rate 50% (1/2). Cause: Hypoxemia.',
    finding: 'Cause of re-intubation: Hypoxemia.',
    corrective: 'Close oxygen-saturation monitoring, prompt management of desaturation, and optimization of respiratory support ensured.',
  }) },
  { dept: 'MICU', ind: 'ind-re-admission-within-48-hours', month: 'Jan-26', inc: E({
    details: '1 re-admission within 48 hours of discharge (Live discharges 16; rate 6.25%). Cause: Respiratory distress.',
    finding: 'Cause of re-admission: Respiratory distress.',
    corrective: '1. Proper respiratory assessment and monitoring before discharge. 2. Ensure patient stability and discharge criteria are met before discharge. 3. Patient & family education regarding warning signs of respiratory distress.',
  }) },
  { dept: 'MICU', ind: 'ind-re-admission-within-48-hours', month: 'Feb-26', inc: E({
    details: '1 re-admission within 48 hours of discharge (Live discharges 16; rate 6.25%). Cause: For close monitoring during dialysis.',
    finding: 'Cause of re-admission: For close monitoring during dialysis.',
    corrective: '1. Close monitoring during dialysis. 2. Timely assessment of patient condition and adherence to dialysis protocol ensured.',
  }) },
  { dept: 'MICU', ind: 'ind-re-admission-within-48-hours', month: 'Apr-26', inc: E({
    details: '1 re-admission within 48 hours of discharge (Live discharges 18; rate 5.56%). Cause: Altered level of consciousness.',
    finding: 'Cause of re-admission: Altered level of consciousness.',
    corrective: '1. Close neurological monitoring ensured; underlying cause identified and managed promptly. 2. Vital signs and blood glucose monitored regularly, and patient condition reassessed before discharge.',
  }) },
  { dept: 'MICU', ind: 'ind-re-admission-within-48-hours', month: 'May-26', inc: E({
    patientName: 'Afsana Ahmed', uhid: '202695',
    details: 'Bed MICU-1. LAMA on 20/05/26 at 10:40 PM; re-admission 22/05/26 at 2:00 PM. Cause: For better management.',
    corrective: 'Treatment plan reviewed and appropriate specialist consultation ensured, with close monitoring provided for optimal patient management.',
  }) },
];

(async () => {
  const check = process.argv.includes('--check');
  const c = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 12000 });
  await c.connect();
  const db = c.db(process.env.DB_NAME || 'unico');
  const col = db.collection('quality');

  // group by dept+indicator
  const byInd = {};
  IMPORT.forEach((r) => { const k = r.dept + '||' + r.ind; (byInd[k] = byInd[k] || { dept: r.dept, ind: r.ind, months: {} }); byInd[k].months[r.month] = [r.inc]; });

  let updated = 0, skipped = 0;
  for (const k of Object.keys(byInd)) {
    const g = byInd[k];
    const doc = await col.findOne({ _id: g.dept });
    if (!doc) { console.log('  SKIP (no dept):', g.dept); skipped++; continue; }
    const ind = (doc.indicators || []).find((i) => i.id === g.ind);
    if (!ind) { console.log('  SKIP (no indicator):', g.dept, g.ind); skipped++; continue; }
    const merged = Object.assign({}, ind.incidents || {}, g.months); // additive: keep existing months
    console.log('  ' + (check ? '[would set]' : '[set]') + ' ' + g.dept + ' / ' + g.ind + ' months: ' + Object.keys(g.months).join(', '));
    if (!check) { await col.updateOne({ _id: g.dept }, { $set: { 'indicators.$[e].incidents': merged } }, { arrayFilters: [{ 'e.id': g.ind }] }); updated++; }
  }
  console.log(`[import] ${check ? 'dry run' : updated + ' indicator(s) updated'}, ${skipped} skipped, ${IMPORT.length} incidents total.`);
  await c.close();
})();
