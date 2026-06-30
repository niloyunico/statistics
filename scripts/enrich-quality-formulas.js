/* UNICO — enrich quality indicators with VALIDATED formula definitions + references.
 *
 * Adds, for every indicator, formula metadata so the Monthly Entry page can
 * capture data BY FORMULA (numerator / denominator) and compute the value the
 * exact same way the connected store does (window.qiFormulaCompute):
 *     count    : value = numerator
 *     rate1000 : value = (numerator / denominator) * 1000
 *     rate100  : value = (numerator / denominator) * 100
 *     pct      : value = (numerator / denominator) * 100
 *
 * ADDITIVE & NON-DESTRUCTIVE: never touches id, name, valueType, benchmark,
 * benchmarkValue, goalDirection, quarters, quarterRemarks, months, mNum, mDen,
 * remarks, executive or meta. An EXISTING formula (e.g. a rate1000 indicator
 * added via the app) is preserved — only the documentation fields are filled in.
 * Sets/back-fills: formula, numLabel, denLabel, unit, formulaText,
 *                  numeratorDef, denominatorDef, reference.  Idempotent.
 *
 * Reused by scripts/enrich-quality-db.js (live DB) — exports enrichIndicator().
 *
 * Usage:  node scripts/enrich-quality-formulas.js          (writes the seed file)
 *         node scripts/enrich-quality-formulas.js --check  (report only, no write)
 */
const fs = require('fs');
const path = require('path');
const SEED = path.join(__dirname, '..', 'server', 'seed', 'quality.json');
const ALLOWED = new Set(['count', 'rate1000', 'rate100', 'pct']);

// Indicators that exist in the live DB (added via the app) but not in the seed
// file — reconciled IN so seed and live DB stay a consistent superset.
const RECONCILE = {
  Cathlab: [{
    id: 'ind-cauti-rate', name: 'CAUTI Rate (per 1000 cath-days)', valueType: 'Rate (per 1000)',
    formula: 'rate1000', numLabel: 'CAUTI cases', denLabel: 'Urinary catheter days', unit: 'per 1000 cath-days',
    benchmark: '<= 0', benchmarkValue: 0, goalDirection: 'lower_is_better',
    quarters: { Q1: null, Q2: null, Q3: null, Q4: null }, quarterRemarks: {}, remarks: '',
  }],
};

// ---- curated specs for the named rate/percentage indicators (by id) ----------
const PCT = {
  'ind-door-to-balloon': { numLabel: 'PCI cases with door-to-balloon ≤90 min', denLabel: 'Total primary PCI cases', numeratorDef: 'Primary-PCI STEMI cases where balloon inflation occurred within 90 minutes of hospital arrival.', denominatorDef: 'All primary-PCI STEMI cases in the reporting period.', reference: 'ACC/AHA STEMI guideline — door-to-balloon (D2B) ≤90 min for primary PCI.' },
  'ind-ccu-cardiac-arrest-survival': { numLabel: 'Cardiac arrests survived (ROSC sustained / discharged alive)', denLabel: 'Cardiac arrest events', numeratorDef: 'In-unit cardiac arrests with sustained return of spontaneous circulation (ROSC ≥20 min) / survived to discharge.', denominatorDef: 'Total cardiac arrest events in the unit during the period.', reference: 'Utstein resuscitation reporting — ROSC / survival to discharge.' },
  'ind-dial-adequacy': { numLabel: 'Sessions achieving URR ≥65% (or Kt/V ≥1.2)', denLabel: 'Dialysis sessions sampled', numeratorDef: 'Haemodialysis sessions meeting the adequacy target (URR ≥65% or single-pool Kt/V ≥1.2).', denominatorDef: 'Dialysis sessions in which adequacy (URR / Kt/V) was measured.', reference: 'KDOQI Haemodialysis Adequacy — URR ≥65% / spKt/V ≥1.2.' },
  'ind-dial-water-quality': { numLabel: 'Water/dialysate samples within AAMI/ISO limits', denLabel: 'Water/dialysate samples tested', numeratorDef: 'Samples meeting AAMI/ISO chemical & microbiological purity limits.', denominatorDef: 'Total water / dialysate samples tested in the period.', reference: 'AAMI / ISO 23500 — water & dialysate quality for haemodialysis.' },
  'ind-ic-hh-overall': { numLabel: 'Compliant hand-hygiene moments', denLabel: 'Observed hand-hygiene opportunities', numeratorDef: 'Observed moments where hand hygiene was correctly performed (all staff groups).', denominatorDef: 'Total hand-hygiene opportunities observed (WHO 5 Moments).', reference: 'WHO "My 5 Moments for Hand Hygiene" — compliance = actions ÷ opportunities × 100.' },
  'ind-ic-hh-doctors': { numLabel: 'Compliant moments — Doctors', denLabel: 'Observed opportunities — Doctors', numeratorDef: 'Hand-hygiene moments correctly performed by doctors.', denominatorDef: 'Hand-hygiene opportunities observed for doctors.', reference: 'WHO "My 5 Moments for Hand Hygiene" (doctor cohort).' },
  'ind-ic-hh-nurses': { numLabel: 'Compliant moments — Nurses', denLabel: 'Observed opportunities — Nurses', numeratorDef: 'Hand-hygiene moments correctly performed by nurses.', denominatorDef: 'Hand-hygiene opportunities observed for nurses.', reference: 'WHO "My 5 Moments for Hand Hygiene" (nurse cohort).' },
  'ind-ic-hh-others': { numLabel: 'Compliant moments — Others', denLabel: 'Observed opportunities — Others', numeratorDef: 'Hand-hygiene moments correctly performed by paramedics / support staff.', denominatorDef: 'Hand-hygiene opportunities observed for other staff.', reference: 'WHO "My 5 Moments for Hand Hygiene" (other-staff cohort).' },
  'ind-ldr-partograph': { numLabel: 'Deliveries with a correctly completed partograph', denLabel: 'Eligible labouring women', numeratorDef: 'Labours in which the partograph was completed per protocol.', denominatorDef: 'All eligible labouring women in the period.', reference: 'WHO Labour Care Guide / partograph use in labour monitoring.' },
  'ind-ldr-fetal-hr': { numLabel: 'Deliveries with FHR monitored per protocol', denLabel: 'Deliveries requiring FHR monitoring', numeratorDef: 'Labours with fetal heart-rate monitored at the protocol-defined frequency.', denominatorDef: 'All labours requiring fetal heart-rate monitoring.', reference: 'Intrapartum fetal surveillance — FHR monitoring compliance.' },
  'ind-mandatory-training': { numLabel: 'Staff who completed mandatory training', denLabel: 'Staff due for mandatory training', numeratorDef: 'Staff who completed their mandatory training within the cycle.', denominatorDef: 'Staff scheduled/due for mandatory training in the period.', reference: 'NABH HRM — mandatory staff training & education compliance.' },
  'ind-induction-completion': { numLabel: 'New staff completing induction within 30 days', denLabel: 'New staff who joined', numeratorDef: 'New joiners who completed induction/orientation within 30 days of joining.', denominatorDef: 'Total new staff who joined in the period.', reference: 'NABH HRM — induction/orientation of new staff.' },
  'ind-bls-certification': { numLabel: 'Clinical staff with valid BLS certification', denLabel: 'Clinical staff requiring BLS', numeratorDef: 'Clinical staff holding a current/valid Basic Life Support certification.', denominatorDef: 'Clinical staff required to hold BLS certification.', reference: 'AHA BLS — proportion of clinical staff with current certification.' },
  'ind-nicu-ett-removal': { numLabel: 'Accidental / unplanned ETT removals', denLabel: 'Ventilator days', numeratorDef: 'Unplanned (accidental or self-) extubation events in ventilated neonates.', denominatorDef: 'Total ventilator days in the period (value is expressed per 100 ventilator-days).', reference: 'Neonatal ventilation safety — unplanned extubation rate per 100 ventilator-days.' },
};

// ---- family references, matched on name keywords (counts AND named rates) ----
function famRef(name) {
  const n = (name || '').toLowerCase();
  const M = (numeratorDef, reference) => ({ numeratorDef, reference });
  // NOTE: short acronyms are word-bounded (\b…\b) so they cannot match as a
  // substring inside another word (e.g. 'nsi' in hypote-nsi-on, 'ssi' in re-admi-ssi-on).
  if (/\bcauti\b|catheter-associated uti|urinary/.test(n)) return M('Lab-confirmed catheter-associated urinary tract infections.', 'CDC NHSN — CAUTI surveillance definition.');
  if (/\bclabsi\b|central line/.test(n)) return M('Lab-confirmed central-line associated bloodstream infections.', 'CDC NHSN — CLABSI surveillance definition.');
  if (/\bvap\b|\bvae\b|ventilator/.test(n)) return M('Ventilator-associated pneumonia / events.', 'CDC NHSN — VAP / VAE surveillance definition.');
  if (/\bssi\b|surgical site/.test(n)) return M('Surgical site infections following an operative procedure.', 'CDC NHSN — SSI surveillance definition.');
  if (/\bhapu\b|pressure ulcer|pressure injury|bed sore/.test(n)) return M('Hospital-acquired pressure ulcers (stage II+).', 'NPUAP/EPUAP staging · NABH patient-safety indicator.');
  if (/\bfall\b|patient fall/.test(n)) return M('Patient fall events during the in-patient stay.', 'NABH / NDNQI — patient fall events.');
  if (/medication error/.test(n)) return M('Medication errors reported (prescribing/dispensing/administration).', 'NABH MOM · NCC-MERP medication-error taxonomy.');
  if (/phlebitis/.test(n)) return M('Peripheral IV phlebitis events (grade ≥2).', 'INS Infusion Therapy Standards — phlebitis scale.');
  if (/needle.?stick|\bnsi\b/.test(n)) return M('Needle-stick / sharps injuries to staff.', 'CDC sharps-safety · NABH staff-safety indicator.');
  if (/\bdvt\b|deep vein thrombosis/.test(n)) return M('Hospital-acquired deep-vein thrombosis events.', 'NABH VTE prophylaxis & surveillance.');
  if (/re-?intubation/.test(n)) return M('Re-intubations within 48 hours of planned extubation.', 'Critical-care outcome — unplanned re-intubation <48h.');
  if (/re-?admission/.test(n)) return M('ICU re-admissions within 48 hours of discharge from the unit.', 'Critical-care outcome — ICU re-admission <48h.');
  if (/return to icu/.test(n)) return M('Patients returning to ICU during the same admission.', 'Critical-care outcome — return to ICU.');
  if (/catheter (dislodg|removal|de-?lin)|de-?lining|accidental removal of catheter/.test(n)) return M('Accidental / unplanned catheter or line dislodgements.', 'NABH device-management safety indicator.');
  if (/post-pci|puncture site hematoma/.test(n)) return M('Post-procedure cath-lab complications (e.g. access-site haematoma).', 'Cath-lab procedural safety indicator.');
  if (/cardiac arrest event/.test(n)) return M('In-unit cardiac arrest events (denominator for survival rate).', 'Utstein resuscitation reporting.');
  if (/patient volume/.test(n)) return M('Patients admitted/treated in the unit during the period.', 'Informational census (denominator for rate indicators).');
  if (/infection rate/.test(n)) return M('Healthcare-associated infection events in the unit.', 'NABH HAI surveillance (event count).');
  if (/hypotension/.test(n)) return M('Intradialytic hypotension events.', 'Dialysis safety — intradialytic hypotension.');
  if (/vascular access complication/.test(n)) return M('Vascular-access complications (infection, thrombosis, bleeding).', 'Dialysis vascular-access safety.');
  if (/post-procedure complication/.test(n)) return M('Complications following an endoscopic/diagnostic procedure.', 'Procedural safety indicator.');
  return M('Count of events of this type in the reporting period.', 'NABH quality indicator (event count).');
}

function formulaText(formula, numLabel, denLabel) {
  if (formula === 'count') return `value = ${numLabel}`;
  const mult = formula === 'rate1000' ? '× 1000' : '× 100';
  return `(${numLabel} ÷ ${denLabel}) ${mult}`;
}

// Mutate one indicator in place, additively. Returns the indicator.
function enrichIndicator(ind) {
  // 1) resolve the formula (preserve an existing valid one, e.g. rate1000)
  let formula;
  if (ind.formula && ALLOWED.has(ind.formula)) formula = ind.formula;
  else if (ind.valueType === '%' || PCT[ind.id]) formula = 'pct';
  else formula = 'count';

  const needsDen = formula !== 'count';
  let numLabel, denLabel, numeratorDef, denominatorDef, reference;

  if (PCT[ind.id]) {
    const s = PCT[ind.id];
    numLabel = s.numLabel; denLabel = s.denLabel;
    numeratorDef = s.numeratorDef; denominatorDef = s.denominatorDef; reference = s.reference;
  } else if (!needsDen) {
    numLabel = ind.name || 'Events';
    const r = famRef(ind.name); numeratorDef = r.numeratorDef; reference = r.reference;
  } else {
    numLabel = ind.numLabel || ind.name || 'Numerator';
    denLabel = ind.denLabel || 'Denominator';
    const r = famRef(ind.name); numeratorDef = r.numeratorDef; reference = r.reference;
    denominatorDef = ind.denominatorDef || (denLabel + ' in the reporting period.');
  }

  ind.formula = formula;
  ind.numLabel = numLabel;
  if (needsDen) ind.denLabel = denLabel; else delete ind.denLabel;
  ind.unit = ind.unit || (formula === 'pct' ? '%' : formula === 'count' ? 'count' : formula === 'rate1000' ? 'per 1000' : 'per 100');
  ind.formulaText = formulaText(formula, numLabel, needsDen ? denLabel : numLabel);
  ind.numeratorDef = numeratorDef;
  if (needsDen) ind.denominatorDef = denominatorDef; else delete ind.denominatorDef;
  ind.reference = reference;
  return ind;
}

function enrichDataset(data) {
  // reconcile missing indicators first
  Object.keys(RECONCILE).forEach(key => {
    const dept = data.find(d => d.key === key);
    if (!dept) return;
    dept.indicators = dept.indicators || [];
    RECONCILE[key].forEach(def => { if (!dept.indicators.some(i => i.id === def.id)) dept.indicators.push(JSON.parse(JSON.stringify(def))); });
  });
  let count = 0, rate = 0, pct = 0, total = 0;
  data.forEach(dept => (dept.indicators || []).forEach(ind => {
    enrichIndicator(ind); total++;
    if (ind.formula === 'pct') pct++; else if (ind.formula === 'count') count++; else rate++;
  }));
  return { total, count, rate, pct, depts: data.length };
}

// Derive ONLY the documentation fields for an indicator, without mutating it and
// without ever returning data fields (quarters/months/mNum/...). Used for a safe,
// field-level $set on the live DB (arrayFilters) that cannot delete saved data.
const DOC_FIELDS = ['formula', 'numLabel', 'denLabel', 'unit', 'formulaText', 'numeratorDef', 'denominatorDef', 'reference'];
function deriveFields(ind) {
  const clone = JSON.parse(JSON.stringify(ind));
  enrichIndicator(clone);
  const set = {}, unset = {};
  DOC_FIELDS.forEach(k => { if (clone[k] !== undefined) set[k] = clone[k]; else if (ind[k] !== undefined) unset[k] = ''; });
  return { set, unset };
}

module.exports = { enrichIndicator, enrichDataset, deriveFields, DOC_FIELDS, PCT, famRef, ALLOWED };

if (require.main === module) {
  const check = process.argv.includes('--check');
  const data = JSON.parse(fs.readFileSync(SEED, 'utf8'));
  const r = enrichDataset(data);
  console.log(`[enrich] ${r.total} indicators across ${r.depts} departments — ${r.count} count, ${r.rate} rate, ${r.pct} pct.`);
  if (check) { console.log('[enrich] --check: no file written.'); }
  else { fs.writeFileSync(SEED, JSON.stringify(data, null, 2) + '\n', 'utf8'); console.log('[enrich] wrote ' + SEED); }
}
