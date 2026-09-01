/* Close the gap between the Nursing Department KPI deck and the quality database.
 *
 * "KPI for Nursing Department.pptx" sets out 16 KPIs in four domains. Domain 1 (Patient
 * Care and Safety) was already covered indicator-for-indicator and formula-for-formula —
 * hand hygiene, falls, HAPU, VAP, CAUTI, CLABSI, SSI and NSI all matched the deck exactly,
 * so nothing there is touched. Domains 2, 3 and 4 had NO representation at all. This adds
 * the eight indicators that were missing:
 *
 *   2 Staffing and workforce   Nursing Turnover Rate
 *                              Nursing Training Hours Compliance (Nurses)
 *                              Nursing Training Hours Compliance (PCAs)
 *                              Nursing Documentation Accuracy
 *                              Nursing Staff Satisfaction
 *   3 Patient experience       Patient Complaints Relating to Nursing Care
 *                              Call Bell Response Time
 *                              Patient Satisfaction (Nursing Services)
 *   4 Financial performance    Consumable Cost per Patient-Day
 *
 * WHERE THEY ARE ASSIGNED. The deck carries ONE hospital figure per KPI (69.5% hand
 * hygiene, 3% turnover, 60% documentation, 4 minutes call bell) — these are nursing-SERVICE
 * measures, not unit measures, so their home is the Overall Hospital area, which until now
 * held only the hospital hand-hygiene roll-up. Call Bell Response Time is additionally
 * assigned to IPD Cabin Level 9 and Level 10: it is the only KPI in the deck whose action
 * plan names a ward-level intervention ("utilise PCAs to attend call bells"), and a call
 * bell physically exists in a cabin, not in a theatre or a cath lab.
 *
 * Training is split Nurses / PCAs because the deck sets two different targets for them
 * (90% and 70%) and one indicator cannot carry two. This follows the existing
 * Hand Hygiene - Doctors / Nurses / Others pattern already in the formula library.
 *
 * NOT the same as the library's existing Mandatory Training Compliance, which measures
 * completion of statutory training within its cycle. These measure CPD/CNE HOURS against
 * the department's 72-hours-per-year standard. Both can be reported.
 *
 * Writes to BOTH places a definition has to exist to be real:
 *   departments.<dept>.quality.indicators   the department's reported set
 *   qualityFormulas                         the hospital master catalogue
 *
 * Idempotent: re-running merges over the existing entries rather than duplicating them,
 * so anything already recorded against them survives. No months are seeded.
 *
 * Usage: node scripts/add-nursing-kpi-indicators.js [--dry]
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const { getDbHandle } = require('../server/db');

const NABH = 'NABH Accreditation Standards for Hospitals, 6th edition (effective 1 January 2025)';

/* Each entry: the indicator itself, the departments it is assigned to, and the master
   catalogue row it registers under. Deck figures are recorded in the benchmark notes so
   the target in the database can always be traced back to the slide it came from. */
const ADDITIONS = [
  {
    catalogueId: 'nursing-turnover-rate',
    depts: ['__hospital__'],
    aliases: ['nursing turnover', 'nurse turnover rate', 'nursing attrition',
      'nursing attrition rate', 'staff turnover (nursing)', 'nursing turnover rate'],
    ind: {
      name: 'Nursing Turnover Rate',
      id: 'ind-nursing-turnover',
      valueType: '%',
      unit: '%',
      formula: 'pct',
      goalDirection: 'lower_is_better',
      benchmarkValue: 2,
      benchmark: '≤ 2%',
      numLabel: 'Nurses who left during the period',
      denLabel: 'Average number of nurses during the period',
      numeratorDef: 'Number of nurses whose employment ended during the month, for any reason — resignation, non-renewal, dismissal, retirement or transfer out of the nursing service. Count each person once, on the date their employment ended. Internal moves between wards are NOT departures and are excluded; staff on maternity, study or long leave are still employed and are excluded.',
      denominatorDef: 'Average number of nurses employed during the same month = (headcount at the start of the month + headcount at the end of the month) ÷ 2. Using an average rather than an opening or closing headcount stops a month of heavy recruitment or heavy loss from distorting the rate.',
      benchmarkNote: 'Lower is better. The Nursing Department KPI sets a target of 2% against a current 3% (KPI deck, domain 2A). Note that this is a MONTHLY rate: 2% sustained every month is roughly 24% annualised, which is in the range of published hospital RN turnover, so the annual figure should be reported alongside the monthly one and the period always stated with the number. Turnover is conventionally benchmarked annually, not monthly.',
      reference: 'NSI Nursing Solutions, Inc. National Health Care Retention & RN Staffing Report (published annually) — the standard reference series for hospital registered-nurse turnover rates. American Nurses Credentialing Center, Magnet Recognition Program — nurse turnover as a required nurse-sensitive workforce measure. ' + NABH + ' — Human Resource Management (HRM) chapter, which requires the hospital to monitor staff attrition. Internal source: UNICO Nursing Department KPI deck, domain 2A (Nursing Turnover).',
      referenceUrl: 'https://www.nsinursingsolutions.com/',
      formulaText: '(nurses who left / average number of nurses) x 100',
      status: 'n-a',
    },
  },
  {
    catalogueId: 'nursing-training-hours-compliance-nurses',
    depts: ['__hospital__'],
    aliases: ['nursing training hours compliance', 'training and professional development (nurses)',
      'nurse cpd compliance', 'nurse training compliance', 'cne compliance (nurses)',
      'nursing training hours compliance (nurses)'],
    ind: {
      name: 'Nursing Training Hours Compliance (Nurses)',
      id: 'ind-nursing-training-hours-nurses',
      valueType: '%',
      unit: '%',
      formula: 'pct',
      goalDirection: 'higher_is_better',
      benchmarkValue: 90,
      benchmark: '≥ 90%',
      numLabel: 'Nurses meeting the required training hours',
      denLabel: 'Total nurses',
      numeratorDef: 'Number of nurses who completed the required continuing-education hours for the period — 6 hours of Continuing Professional Development per nurse per month, equivalent to the department standard of 72 hours per nurse per year, including the six-monthly Continuing Nursing Education workshop and ward-based case and clinical presentations. Count a nurse only where the hours are evidenced in their individual training record, not where attendance was merely expected.',
      denominatorDef: 'Total number of nurses in post during the period and therefore required to complete the training. Nurses who joined part-way through the period are counted against a pro-rata requirement; nurses on long leave for the whole period are excluded and the exclusion recorded.',
      benchmarkNote: 'Higher is better. The Nursing Department KPI sets a target of 90% against a current 82% (KPI deck, domain 2B). The underlying individual standard is 72 training hours per nurse per year. This is not the same measure as Mandatory Training Compliance, which asks whether statutory training was completed within its cycle; a nurse can be fully compliant on mandatory training and still short of their CPD hours. Both can be reported.',
      reference: NABH + ' — Human Resource Management (HRM) chapter, which requires a training needs assessment, a training calendar, and an individual training record for every member of staff. World Health Organization, Global Strategic Directions for Nursing and Midwifery — continuing professional development as a core workforce requirement. Internal source: UNICO Nursing Department KPI deck, domain 2B (Training and professional career development), which sets 6 CPD hours per nurse per month / 72 hours per year.',
      formulaText: '(nurses completing required training hours / total nurses) x 100',
      status: 'n-a',
    },
  },
  {
    catalogueId: 'nursing-training-hours-compliance-pca',
    depts: ['__hospital__'],
    aliases: ['pca training compliance', 'training and professional development (pca)',
      'pca cpd compliance', 'nursing training hours compliance (pcas)',
      'patient care assistant training compliance'],
    ind: {
      name: 'Nursing Training Hours Compliance (PCAs)',
      id: 'ind-nursing-training-hours-pca',
      valueType: '%',
      unit: '%',
      formula: 'pct',
      goalDirection: 'higher_is_better',
      benchmarkValue: 70,
      benchmark: '≥ 70%',
      numLabel: 'PCAs meeting the required training sessions',
      denLabel: 'Total PCAs',
      numeratorDef: 'Number of Patient Care Assistants who completed the required continuing-education sessions for the period — the department standard of 12 Continuing Professional Development classes per month — evidenced in the individual training record. Weekly departmental training sessions count towards this where attendance is recorded.',
      denominatorDef: 'Total number of Patient Care Assistants in post during the period and therefore required to complete the training. PCAs who joined part-way through the period are counted against a pro-rata requirement; those on long leave for the whole period are excluded and the exclusion recorded.',
      benchmarkNote: 'Higher is better. The Nursing Department KPI sets a target of 70% against a current 52% (KPI deck, domain 2B). It is reported separately from the nurse figure because the deck sets a different target and a different training requirement for each group, and a single combined percentage would hide the much larger gap on the PCA side.',
      reference: NABH + ' — Human Resource Management (HRM) chapter, which requires training and an individual training record for every member of staff, including non-nursing care staff. Internal source: UNICO Nursing Department KPI deck, domain 2B (Training and professional career development), which sets 12 CPD classes per PCA per month.',
      formulaText: '(PCAs completing required training sessions / total PCAs) x 100',
      status: 'n-a',
    },
  },
  {
    catalogueId: 'nursing-documentation-accuracy',
    depts: ['__hospital__'],
    aliases: ['documentation accuracy', 'nursing documentation accuracy',
      'nursing record accuracy', 'documentation audit compliance',
      'nursing documentation compliance'],
    ind: {
      name: 'Nursing Documentation Accuracy',
      id: 'ind-nursing-documentation-accuracy',
      valueType: '%',
      unit: '%',
      formula: 'pct',
      goalDirection: 'higher_is_better',
      benchmarkValue: 85,
      benchmark: '≥ 85%',
      numLabel: 'Nursing records passing the documentation audit',
      denLabel: 'Nursing records audited',
      numeratorDef: 'Number of audited nursing records that met every criterion on the documentation audit checklist — entries complete for the shift, timed and dated, signed and identifiable, legible, free of unapproved abbreviations, corrections made properly rather than obliterated, and assessments and care plans present where required. A record failing any single criterion is not counted, so this is an all-or-nothing pass, not a partial score.',
      denominatorDef: 'Number of nursing records audited during the period. The audit sample, how it is selected and the checklist used must be the same from month to month, or the trend measures the audit rather than the documentation. Report the sample size with the result.',
      benchmarkNote: 'Higher is better. The Nursing Department KPI sets a target of 85% against a current 60% (KPI deck, domain 2C), on the way to paperless documentation. The figure is only as good as the audit behind it: state the sample size, and keep the checklist stable, because tightening or loosening a criterion moves this number without anything changing at the bedside.',
      reference: 'American Nurses Association. Principles for Nursing Documentation: Guidance for Registered Nurses. Silver Spring, MD: ANA, 2010. ' + NABH + ' — Information Management System (IMS) chapter, which requires patient clinical records to be complete, accurate, legible, dated, timed and attributable. The Joint Commission, Record of Care, Treatment, and Services (RC) standards. Internal source: UNICO Nursing Department KPI deck, domain 2C (Documentation Accuracy).',
      formulaText: '(accurate nursing records / total nursing records audited) x 100',
      status: 'n-a',
    },
  },
  {
    catalogueId: 'nursing-staff-satisfaction',
    depts: ['__hospital__'],
    aliases: ['nursing satisfaction', 'nurse satisfaction', 'nursing staff satisfaction',
      'staff satisfaction (nursing)', 'nursing job satisfaction'],
    ind: {
      name: 'Nursing Staff Satisfaction',
      id: 'ind-nursing-staff-satisfaction',
      valueType: '%',
      unit: '%',
      formula: 'pct',
      goalDirection: 'higher_is_better',
      benchmarkValue: 97,
      benchmark: '≥ 97%',
      numLabel: 'Nursing staff recorded as satisfied',
      denLabel: 'Nursing staff surveyed',
      numeratorDef: 'Number of nursing staff whose response to the nursing satisfaction survey falls in the satisfied band on the agreed scale. The threshold that counts as "satisfied" must be fixed before the survey is run and kept the same between rounds, or the trend measures the threshold rather than the satisfaction.',
      denominatorDef: 'Number of nursing staff who returned a completed survey. Report the response rate alongside the result: a 97% satisfaction score from a third of the workforce says something quite different from the same score from nearly all of it, because the staff least satisfied are the least likely to respond.',
      benchmarkNote: 'Higher is better. The Nursing Department KPI sets a target of 97% against a current 95% from the satisfaction survey already conducted (KPI deck, domain 2D). Read this together with Nursing Turnover Rate — the two should move in opposite directions, and a high satisfaction score alongside rising turnover means the survey is not reaching the staff who are leaving.',
      reference: NABH + ' — Human Resource Management (HRM) chapter, which requires the hospital to assess employee satisfaction and act on the findings. Lake ET. Development of the Practice Environment Scale of the Nursing Work Index. Research in Nursing & Health. 2002;25(3):176–188 — the validated instrument underlying most nursing work-environment surveys. American Nurses Credentialing Center, Magnet Recognition Program. Internal source: UNICO Nursing Department KPI deck, domain 2D (Nursing Satisfaction).',
      formulaText: '(satisfied nursing staff / total nurses surveyed) x 100',
      status: 'n-a',
    },
  },
  {
    catalogueId: 'patient-complaints-relating-to-nursing-care',
    depts: ['__hospital__'],
    aliases: ['patient complaints', 'nursing complaints', 'patient complaints (nursing)',
      'complaints pertaining to nursing care', 'patient complaints relating to nursing care'],
    ind: {
      name: 'Patient Complaints Relating to Nursing Care',
      id: 'ind-nursing-complaints',
      valueType: 'Count',
      unit: 'per 1000 patient-days',
      formula: 'rate1000',
      goalDirection: 'lower_is_better',
      benchmarkValue: 1,
      benchmark: '≤ 1 per 1000 patient-days',
      numLabel: 'Complaints relating to nursing care',
      denLabel: 'Patient-days',
      numeratorDef: 'Number of complaints received during the month whose substance concerns nursing care — attitude or communication of nursing staff, delay in attending to the patient, pain or hygiene needs not met, medication or treatment not given as ordered, or inadequate information given to the patient or family. Count each complaint once, on the date it was received, whether it arrived verbally, in writing, through the feedback form or through the complaint-redressal process. Complaints about food, billing, housekeeping or medical decisions are recorded but are not counted here.',
      denominatorDef: 'Total inpatient-days during the same month — the same denominator used for falls and pressure ulcers, so that a ward with longer stays is not penalised for having more opportunity to be complained about.',
      benchmarkNote: 'Lower is better. The Nursing Department KPI deck (domain 3A) sets no current figure and no target for this indicator, so ≤ 1 per 1000 patient-days is entered here as a starting local target and MUST be ratified by the Nursing Department once a baseline exists. Treat a falling count with unchanged practice as under-reporting rather than improvement — a complaints measure only works where complaining is easy and recording is honest. NOTE: the formula printed on slide 3A of the deck, "(positive patient experience responses ÷ total responses) × 100", measures satisfaction, not complaints, and is the same formula printed on slide 3C; it appears to be a slide error. This indicator is defined as a complaints rate, which is what the objective on that slide actually asks for.',
      reference: NABH + ' — Patient Rights and Education (PRE) chapter, which requires a complaint-redressal mechanism and the monitoring and analysis of complaints received. Reader TW, Gillespie A, Roberts J. Patient complaints in healthcare systems: a systematic review and coding taxonomy. BMJ Quality & Safety. 2014;23(8):678–689 — the standard taxonomy for classifying what a complaint is actually about. Internal source: UNICO Nursing Department KPI deck, domain 3A (Patient Complaints Pertaining to Nursing Care).',
      formulaText: '(complaints relating to nursing care / patient-days) x 1000',
      status: 'n-a',
    },
  },
  {
    catalogueId: 'call-bell-response-time',
    depts: ['__hospital__', 'lvl9', 'lvl10'],
    aliases: ['call bell response', 'call bell response time', 'call light response time',
      'nurse call response time', 'average call bell response time'],
    ind: {
      name: 'Call Bell Response Time',
      id: 'ind-call-bell-response',
      valueType: 'minutes',
      unit: 'minutes',
      formula: 'avg',
      goalDirection: 'lower_is_better',
      benchmarkValue: 2,
      benchmark: '≤ 2 minutes',
      numLabel: 'Total call bell response minutes',
      denLabel: 'Number of call bell calls',
      numeratorDef: 'Sum of the response time of every call bell call during the month = Σ (time a member of staff attends the patient − time the call bell was pressed), expressed in minutes. The clock stops when someone reaches the patient, not when the bell is cancelled at the console — silencing a bell from the nurses\' station and attending the patient are different events, and only the second one answers the patient. A call attended by a Patient Care Assistant counts the same as one attended by a nurse.',
      denominatorDef: 'Total number of call bell calls placed during the same month — the same calls whose response times are summed in the numerator. Where the nurse-call system does not log times, this is the number of calls in the sample that was timed by hand, and the sample size and method must be reported with the result.',
      benchmarkNote: 'Lower is better. The Nursing Department KPI sets a target of 2 minutes against a current average of 4 minutes (KPI deck, domain 3B), expressed there as responding by the second reminder. Report the mean with the number of calls; because a handful of very long waits are what patients and families remember, the longest response in the month is worth reporting alongside the average.',
      reference: 'Meade CM, Bursell AL, Ketelsen L. Effects of nursing rounds on patients\' call light use, satisfaction, and safety. American Journal of Nursing. 2006;106(9):58–70 — the study underlying the hourly-rounding response to call-light demand. ' + NABH + ' — Patient Rights and Education (PRE) and Care of Patients (COP) chapters on responsiveness to patient needs. Internal source: UNICO Nursing Department KPI deck, domain 3B (Call bell response), which sets a 2-minute standard and links it to the hourly rounding programme.',
      formulaText: 'value = total call bell response minutes / number of call bell calls',
      status: 'n-a',
    },
  },
  {
    catalogueId: 'patient-satisfaction-nursing-services',
    depts: ['__hospital__'],
    aliases: ['patient satisfaction', 'patient satisfaction (nursing)',
      'patient satisfaction nursing services', 'nursing service patient satisfaction',
      'patient satisfaction (nursing services)'],
    ind: {
      name: 'Patient Satisfaction (Nursing Services)',
      id: 'ind-patient-satisfaction-nursing',
      valueType: '%',
      unit: '%',
      formula: 'pct',
      goalDirection: 'higher_is_better',
      benchmarkValue: 90,
      benchmark: '≥ 90%',
      numLabel: 'Patients recorded as satisfied with nursing care',
      denLabel: 'Patients surveyed',
      numeratorDef: 'Number of surveyed patients whose rating of the nursing care they received falls in the satisfied band on the agreed scale. Only the nursing items of the survey are counted — courtesy and respect of nurses, whether nurses listened carefully, whether explanations were clear, and responsiveness to requests for help. Items about doctors, food, cleanliness or billing are recorded but do not belong to this indicator.',
      denominatorDef: 'Number of patients who returned a completed survey during the period. Report the response rate with the result. Where the survey is given at discharge, patients who left against medical advice or died are outside the survey and are not counted in either part.',
      benchmarkNote: 'Higher is better. The Nursing Department KPI deck (domain 3C) records this as not yet calculated and sets no target, so ≥ 90% is entered here as a starting target and MUST be ratified by the Nursing Department once the first survey round is complete. The international comparator for the same construct is the "Communication with Nurses" composite of the HCAHPS survey, which is worth using as the wording model so the hospital\'s result means something outside it.',
      reference: 'Centers for Medicare & Medicaid Services and Agency for Healthcare Research and Quality. HCAHPS — Hospital Consumer Assessment of Healthcare Providers and Systems survey, "Communication with Nurses" composite: the standard instrument for nursing-specific patient experience. ' + NABH + ' — Patient Rights and Education (PRE) chapter, which requires patient satisfaction to be assessed and acted upon. Internal source: UNICO Nursing Department KPI deck, domain 3C (Patient\'s Satisfaction — Nursing Services).',
      referenceUrl: 'https://hcahpsonline.org/',
      formulaText: '(satisfied patients / total patients surveyed) x 100',
      status: 'n-a',
    },
  },
  {
    catalogueId: 'consumable-cost-per-patient-day',
    depts: ['__hospital__'],
    aliases: ['consumable cost', 'consumable cost per patient day',
      'cost per patient day', 'ward consumable cost', 'supply cost per patient-day'],
    ind: {
      name: 'Consumable Cost per Patient-Day',
      id: 'ind-consumable-cost-per-patient-day',
      valueType: 'cost',
      unit: 'cost per patient-day',
      formula: 'avg',
      goalDirection: 'lower_is_better',
      benchmarkValue: null,
      benchmark: '5% below the established baseline',
      numLabel: 'Total consumable cost for the month',
      denLabel: 'Patient-days',
      numeratorDef: 'Total cost of consumables issued to the ward during the month at the price the store charges — clinical consumables, stationery and printing, and general ward supplies. Capital items, equipment, drugs dispensed against a patient bill, and anything recharged directly to a patient are excluded, because those are not what ward practice controls. State the currency and keep the cost basis the same from month to month.',
      denominatorDef: 'Total inpatient-days during the same month. Dividing by patient-days rather than comparing month against month is what separates a genuine reduction in consumption from a quiet month — a falling total cost during a fall in occupancy is not an efficiency.',
      benchmarkNote: 'Lower is better. The Nursing Department KPI (deck, domain 4) sets the target as a 5% reduction from existing cost, with the current figure not yet calculated. A relative target cannot be a fixed threshold until a baseline exists, so no numeric benchmark is set here and the indicator will not show a pass or breach status; enter the baseline as a numeric benchmark once three to six months of cost per patient-day have been recorded, then set the benchmark at 95% of it.',
      reference: NABH + ' — Patient Safety and Quality Improvement (PSQ) chapter, which requires the hospital to monitor managerial indicators including resource utilisation and the cost of care. Healthcare Financial Management Association — supply expense per patient-day as a standard hospital operating metric. Internal source: UNICO Nursing Department KPI deck, domain 4 (Financial Performance).',
      formulaText: 'value = total consumable cost for the month / total patient-days',
      status: 'n-a',
    },
  },
];

const CATALOGUE_FIELDS = ['formula', 'unit', 'numLabel', 'denLabel', 'numeratorDef',
  'denominatorDef', 'benchmark', 'benchmarkValue', 'benchmarkNote', 'goalDirection',
  'reference', 'referenceUrl'];

/* Replace in place if already present, otherwise append — a re-run updates the wording
   instead of leaving two entries carrying the same id. Merge OVER the existing entry so
   any recorded months/quarters survive. */
function upsertIndicator(list, ind) {
  const at = list.findIndex((i) => i.id === ind.id);
  if (at < 0) { list.push(ind); return 'added  '; }
  list[at] = Object.assign({}, list[at], ind);
  return 'updated';
}

(async () => {
  const dry = process.argv.includes('--dry');
  const db = await getDbHandle();
  if (!db) { console.error('No DB (MONGODB_URI not set).'); process.exit(1); }

  const app = await db.collection('appdata').findOne({ _id: 'shared' });
  let ov = null;
  try { ov = app && app.data && app.data['unico_quality_v2'] ? JSON.parse(app.data['unico_quality_v2']) : null; } catch (e) { ov = null; }

  /* Group by department so each one is read and written once, however many indicators
     it gains — writing the whole indicators array per indicator would let two writes to
     the same department overwrite each other. */
  const byDept = new Map();
  ADDITIONS.forEach((a) => a.depts.forEach((d) => {
    if (!byDept.has(d)) byDept.set(d, []);
    byDept.get(d).push(a.ind);
  }));

  for (const [deptId, inds] of byDept) {
    const dep = await db.collection('departments').findOne({ id: deptId });
    if (!dep) { console.error('Department not found: ' + deptId); process.exit(1); }
    const list = (dep.quality && dep.quality.indicators) || [];
    const o = (ov && ov.depts && ov.depts[dep.quality.key]) || {};
    console.log('\n' + dep.quality.name + '  (' + deptId + ')');
    inds.forEach((ind) => {
      console.log('  ' + upsertIndicator(list, ind) + '  ' + ind.name);
      if ((o.indRemoved || []).indexOf(ind.id) >= 0) {
        console.log('    WARNING: overlay indRemoved still hides ' + ind.id + ' in ' + dep.quality.key);
      }
    });
    if (!dry) {
      await db.collection('departments').updateOne({ _id: dep._id },
        { $set: { 'quality.indicators': list } });
    }
    console.log('  -> ' + list.length + ' indicators' + (dry ? '  (DRY RUN)' : ''));
  }

  console.log('');
  for (const a of ADDITIONS) {
    const doc = Object.assign({
      canonicalName: a.ind.name,
      aliases: a.aliases,
      order: 0,
      updatedAt: Date.now(),
      updatedBy: 'add-nursing-kpi-indicators',
    }, CATALOGUE_FIELDS.reduce((o, k) => { if (a.ind[k] !== undefined) o[k] = a.ind[k]; return o; }, {}));
    if (!dry) await db.collection('qualityFormulas').replaceOne({ _id: a.catalogueId }, doc, { upsert: true });
    console.log('formula library: ' + a.catalogueId + (dry ? ' (DRY RUN)' : ' written'));
  }

  const total = await db.collection('qualityFormulas').countDocuments();
  console.log('\nqualityFormulas holds ' + total + ' definitions.');
  process.exit(0);
})().catch((e) => { console.error('failed:', (e && e.stack) || e); process.exit(1); });
