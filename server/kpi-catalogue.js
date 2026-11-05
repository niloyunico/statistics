/* Nursing KPI — the starting catalogue, taken slide by slide from
 * "KPI for Nursing Department.pptx" (UNICO Nursing Department, Aug 2026).
 *
 * Each KPI keeps the deck's own wording: Objective, the "Current %" as the baseline, the Target
 * (per six-month cycle where the deck stages it — Falls: 10 in cycle 1, then 5), the Formula and
 * every Action Plan bullet as an action item. `source.indId` links a KPI to the quality indicator
 * that already holds its monthly figures, so those months fill themselves; the nine Workforce /
 * Experience / Financial KPIs link to the Overall Hospital indicators added by
 * scripts/add-nursing-kpi-indicators.js and are typed in this module until data exists there.
 *
 * Only used to SEED kpiDefs (server/kpi.js ensureSeed / POST /api/kpi/seed). A KPI an
 * administrator has edited is never overwritten by a re-seed; a missing one is added back.
 */
const act = (text) => ({ text });

// One line per point: the screen, the print and the deck's notes slide each show it as a list.
const HOURLY_ROUNDS = [
  'Hourly rounds — a proactive nursing practice to address patients\' needs and improve patient safety, thereby increasing patient satisfaction. Main points focused are the 5 Ps:',
  'Pain — check for pain.',
  'Position — change position.',
  'Personal needs ("potty") — offer bedpan, urinal & water if needed.',
  'Placements — check the infusion & syringe pumps and their function, IV lines and site, O2 cylinder, air mattress etc.',
  'Periphery — check lights, A/C; keep phones, glasses, hearing aids and tissues within reach of the patient.',
].join('\n');
const TRACKING = 'Monthly for 6 months & later for another 6 months';

const KPIS = [
  /* ---------------------------------------------------------- 1. Patient Care and Safety */
  {
    id: 'kpi-hand-hygiene', code: '1A', pillar: 'safety', name: 'Hand Hygiene Compliance',
    objective: 'To improve hand hygiene compliance and prevent hospital-acquired infections.',
    source: { indId: 'ind-hand-hygiene-compliance', indName: 'Hand Hygiene Compliance (Hospital)', rule: 'hh' },
    unit: '%', formula: 'pct', goalDirection: 'higher_is_better', decimals: 1,
    formulaText: '(Hand hygiene actions performed ÷ Hand hygiene opportunities observed) × 100',
    numLabel: 'Hand hygiene actions performed', denLabel: 'Hand hygiene opportunities observed',
    baseline: { value: 69.5, note: 'KPI deck, slide 1A' },
    targets: [{ cycle: 1, value: 75 }, { cycle: 2, value: 75 }],
    actions: [
      act('Conduct hand hygiene audits every month and reward wards with the highest compliance.'),
      act('Provide regular staff training.'),
      act('Identify low-performing units and implement corrective action plans.'),
      act('Include hand hygiene compliance in staff performance evaluations and quality improvement programs.'),
    ],
  },
  {
    id: 'kpi-patient-falls', code: '1B', pillar: 'safety', name: 'Patient Falls',
    objective: 'To reduce patient falls and provide a safe environment for patients.',
    source: { indId: 'ind-patient-fall', indName: 'Patient Fall', rule: 'fall' },
    unit: 'per 1000 patient-days', formula: 'rate1000', goalDirection: 'lower_is_better', decimals: 2,
    formulaText: '(Number of patient falls ÷ Patient-days) × 1000',
    numLabel: 'Number of patient falls', denLabel: 'Patient-days',
    baseline: { value: 18, note: 'KPI deck, slide 1B ("18%")' },
    targets: [{ cycle: 1, value: 10 }, { cycle: 2, value: 5 }],
    actions: [
      act('Perform timely fall risk assessments on admission.'),
      act('Implement fall prevention precautions.'),
      act('Conduct hourly rounding (5 Ps).'),
      act('Ensure the use of side rails whenever required.'),
    ],
    remarks: 'Target: reduce to 10 within the first 6 months and subsequently to 5.\n' + HOURLY_ROUNDS,
  },
  {
    id: 'kpi-hapu', code: '1C', pillar: 'safety', name: 'Hospital-Acquired Pressure Ulcer (HAPU)',
    objective: 'To prevent hospital-acquired pressure ulcers among all inpatients.',
    source: { indId: 'ind-hospital-acquired-pressure-ulcer', indName: 'Hospital Acquired Pressure Ulcer', rule: 'pool' },
    unit: 'per 1000 patient-days', formula: 'rate1000', goalDirection: 'lower_is_better', decimals: 2,
    formulaText: '(Patients who developed ≥ 1 HAPU (Stage 2+) ÷ Patient-days) × 1000',
    numLabel: 'Patients who developed ≥ 1 HAPU (stage 2+)', denLabel: 'Patient-days',
    baseline: { value: 1.5, note: 'KPI deck, slide 1C' },
    targets: [{ cycle: 1, value: 0 }, { cycle: 2, value: 0 }],
    actions: [
      act('Ensure compulsory repositioning every 2 hours.'),
      act('Provide pressure ulcer prevention training for all new staff members.'),
      act('Reward wards with zero pressure ulcer incidence annually.'),
    ],
  },
  {
    id: 'kpi-vap', code: '1D', pillar: 'safety', name: 'Ventilator-Associated Pneumonia (VAP)',
    objective: 'To reduce ventilator-associated pneumonia among patients receiving mechanical ventilation.',
    source: { indId: 'ind-ventilator-associated-pneumonia', indName: 'Ventilator Associated Pneumonia', rule: 'pool' },
    unit: 'per 1000 ventilator-days', formula: 'rate1000', goalDirection: 'lower_is_better', decimals: 2,
    formulaText: '(VAP events ÷ Ventilator-days) × 1000',
    numLabel: 'VAP events', denLabel: 'Ventilator-days',
    baseline: { value: 0, note: 'KPI deck, slide 1D' },
    targets: [{ cycle: 1, value: 0 }, { cycle: 2, value: 0 }],
    actions: [
      act('Conduct monthly VAP bundle compliance audits and provide regular training.'),
      act('Maintain head-of-bed elevation at 30–45°.'),
      act('Provide regular oral care with chlorhexidine for all patients on ventilators Q4h.'),
      act('Share compliance reports and recognize high-performing ICUs & wards.'),
    ],
  },
  {
    id: 'kpi-cauti', code: '1E', pillar: 'safety', name: 'Catheter-Associated UTI (CAUTI)',
    objective: 'To reduce catheter-associated urinary tract infections among patients with urinary catheters.',
    source: { indId: 'ind-catheter-associated-uti', indName: 'Catheter Associated Urinary Tract Infection', rule: 'pool' },
    unit: 'per 1000 catheter-days', formula: 'rate1000', goalDirection: 'lower_is_better', decimals: 2,
    formulaText: '(CAUTIs ÷ Urinary catheter-days) × 1000',
    numLabel: 'CAUTIs', denLabel: 'Urinary catheter-days',
    baseline: { value: 0, note: 'KPI deck, slide 1E' },
    targets: [{ cycle: 1, value: 0 }, { cycle: 2, value: 0 }],
    actions: [
      act('Conduct monthly CAUTI bundle audits.'),
      act('Ensure aseptic catheter insertion techniques.'),
      act('Maintain a closed urinary drainage system.'),
      act('Provide staff education on catheter care.'),
      act('Emphasize 12-hourly catheter care using Betadine for all patients on urinary catheter.'),
    ],
  },
  {
    id: 'kpi-clabsi', code: '1F', pillar: 'safety', name: 'Central Line-Associated Bloodstream Infection (CLABSI)',
    objective: 'To reduce central line-associated bloodstream infections among patients with central lines.',
    source: { indId: 'ind-central-line-associated-bloodstream-infection', indName: 'Central Line Associated Bloodstream Infection', rule: 'pool' },
    unit: 'per 1000 central line-days', formula: 'rate1000', goalDirection: 'lower_is_better', decimals: 2,
    formulaText: '(CLABSIs ÷ Central line-days) × 1000',
    numLabel: 'CLABSIs', denLabel: 'Central line-days',
    baseline: { value: 0, note: 'KPI deck, slide 1F' },
    targets: [{ cycle: 1, value: 0 }, { cycle: 2, value: 0 }],
    actions: [
      act('Conduct monthly central line bundle audits.'),
      act('Use maximum sterile barrier precautions during insertion.'),
      act('Ensure proper line dressing and hub disinfection.'),
      act('Provide regular staff training and feedback.'),
      act('Emphasize hand disinfection before touching the central line area.'),
    ],
  },
  {
    id: 'kpi-ssi', code: '1G', pillar: 'safety', name: 'Surgical Site Infection (SSI)',
    objective: 'To reduce surgical site infections among patients undergoing surgery.',
    source: { indId: 'ind-surgical-site-infection', indName: 'Surgical Site Infection', rule: 'pool' },
    unit: '%', formula: 'pct', goalDirection: 'lower_is_better', decimals: 2,
    formulaText: '(Number of SSIs ÷ Number of operative procedures) × 100',
    numLabel: 'Number of SSIs', denLabel: 'Number of operative procedures',
    baseline: { value: 0, note: 'KPI deck, slide 1G' },
    targets: [{ cycle: 1, value: 0 }, { cycle: 2, value: 0 }],
    actions: [
      act('Monitor SSI rates monthly.'),
      act('Administer prophylactic antibiotics at the appropriate time.'),
      act('Ensure proper preoperative skin preparation.'),
      act('Maintain strict sterile techniques during surgery.'),
      act('Provide feedback to surgical teams regarding SSI trends.'),
      act('Introduce follow-up calls to surgical patients after one month to assess the surgical site (Infection Control Nurse).'),
    ],
  },
  {
    id: 'kpi-nsi', code: '1H', pillar: 'safety', name: 'Needle Stick Injury (NSI)',
    objective: 'To reduce needle stick injuries among healthcare workers.',
    source: { indId: 'ind-needle-stick-injury', indName: 'Needle Stick Injury', rule: 'hospital' },
    unit: 'per 100 healthcare workers', formula: 'rate100', goalDirection: 'lower_is_better', decimals: 2,
    formulaText: '(Number of NSI cases ÷ Total healthcare workers) × 100',
    numLabel: 'Number of NSI cases', denLabel: 'Total healthcare workers',
    baseline: { value: 0.2, note: 'KPI deck, slide 1H' },
    targets: [{ cycle: 1, value: 0 }, { cycle: 2, value: 0 }],
    actions: [
      act('Conduct regular training on safe sharps handling.'),
      act('Ensure immediate disposal of needles into sharps containers.'),
      act('Avoid needle recapping and educate nursing staff on safe recapping procedures when required.'),
      act('Report and investigate all needle stick injuries promptly.'),
      act('Monitor NSI incidents monthly and implement corrective actions.'),
      act('Emphasize notification of needle stick injuries.'),
    ],
  },

  /* ------------------------------------------------ 2. Staffing and workforce management */
  {
    id: 'kpi-turnover', code: '2A', pillar: 'workforce', name: 'Nursing Turnover',
    objective: 'To reduce nursing attrition caused by work-related stress and improve staff retention.',
    source: { indId: 'ind-nursing-turnover', indName: 'Nursing Turnover Rate', rule: 'hospital' },
    unit: '%', formula: 'pct', goalDirection: 'lower_is_better', decimals: 2,
    formulaText: '(Number of nurses who left during the period ÷ Average number of nurses during the same period) × 100',
    numLabel: 'Nurses who left during the month', denLabel: 'Average number of nurses during the month',
    baseline: { value: 3, note: 'KPI deck, slide 2A' },
    targets: [{ cycle: 1, value: 2 }, { cycle: 2, value: 2 }],
    actions: [
      act('Celebrate nurses’ birthdays.'),
      act('Conduct ward meetings every fortnight.'),
      act('Introduce a Best Performer Award.'),
      act('Recognize and celebrate patient compliments.'),
      act('Conduct exit interviews.'),
      act('Perform regular nursing audits.'),
      act('Implement additional staff retention strategies.'),
      act('Strengthen orientation and mentorship programs.'),
      act('Ensure adequate staffing levels.'),
      act('Celebrate Nurses’ Day and organize staff recognition events to reduce stress and improve morale.'),
    ],
  },
  {
    id: 'kpi-training-nurses', code: '2B', pillar: 'workforce', name: 'Training & Professional Development (Nurses)',
    objective: 'To increase the theoretical and practical knowledge of nurses and PCAs to provide better patient care.',
    source: { indId: 'ind-nursing-training-hours-nurses', indName: 'Nursing Training Hours Compliance (Nurses)', rule: 'hospital' },
    unit: '%', formula: 'pct', goalDirection: 'higher_is_better', decimals: 1,
    formulaText: '(Number of nurses completing required training hours ÷ Total number of nurses) × 100',
    numLabel: 'Nurses completing the required training hours', denLabel: 'Total number of nurses',
    baseline: { value: 82, note: 'KPI deck, slide 2B' },
    targets: [{ cycle: 1, value: 90 }, { cycle: 2, value: 90 }],
    actions: [
      act('Provide training books to all staff nurses to maintain individual training records.'),
      act('Conduct CNE workshops once every six months and CPD monthly — 6 hours per nurse per month.'),
      act('Introduce clinical and case study presentations in the ward.'),
      act('Conduct annual examinations based on the topics covered during training.'),
      act('Use training performance results as one component of the staff evaluation form.'),
      act('Benchmark 72 training hours per nurse per year and appraise against it.'),
      act('Evaluate training effectiveness through pre- & post-training assessments.'),
      act('Recognize staff members for outstanding learning achievements.'),
      act('Weekly departmental training on the topics already prepared for nurses.'),
    ],
  },
  {
    id: 'kpi-training-pca', code: '2B', pillar: 'workforce', name: 'Training & Professional Development (PCAs)',
    objective: 'To increase the theoretical and practical knowledge of nurses and PCAs to provide better patient care.',
    source: { indId: 'ind-nursing-training-hours-pca', indName: 'Nursing Training Hours Compliance (PCAs)', rule: 'hospital' },
    unit: '%', formula: 'pct', goalDirection: 'higher_is_better', decimals: 1,
    formulaText: '(Number of PCAs completing required training sessions ÷ Total number of PCAs) × 100',
    numLabel: 'PCAs completing the required training sessions', denLabel: 'Total number of PCAs',
    baseline: { value: 52, note: 'KPI deck, slide 2B' },
    targets: [{ cycle: 1, value: 70 }, { cycle: 2, value: 70 }],
    actions: [
      act('Provide training books to all PCAs to maintain individual training records.'),
      act('PCA CPD: 12 classes in a month.'),
      act('Weekly departmental training on the topics already prepared for PCAs.'),
      act('Evaluate training effectiveness through pre- & post-training assessments.'),
    ],
  },
  {
    id: 'kpi-documentation', code: '2C', pillar: 'workforce', name: 'Documentation Accuracy',
    objective: 'To move towards paperless documentation and improve accuracy in nursing records.',
    source: { indId: 'ind-nursing-documentation-accuracy', indName: 'Nursing Documentation Accuracy', rule: 'hospital' },
    unit: '%', formula: 'pct', goalDirection: 'higher_is_better', decimals: 1,
    formulaText: '(Number of accurate nursing records ÷ Total nursing records audited) × 100',
    numLabel: 'Accurate nursing records', denLabel: 'Nursing records audited',
    baseline: { value: 60, note: 'KPI deck, slide 2C' },
    targets: [{ cycle: 1, value: 85 }, { cycle: 2, value: 85 }],
    actions: [
      act('Encourage communication in English to improve documentation accuracy.'),
      act('Review documentation during each shift and correct grammatical errors (Charge Nurse).'),
      act('Conduct regular documentation audits.'),
      act('Recognize staff members with excellent documentation practices.'),
    ],
  },
  {
    id: 'kpi-nurse-satisfaction', code: '2D', pillar: 'workforce', name: 'Nursing Satisfaction',
    objective: 'To retain trained and experienced nurses by improving job satisfaction and engagement.',
    source: { indId: 'ind-nursing-staff-satisfaction', indName: 'Nursing Staff Satisfaction', rule: 'hospital' },
    unit: '%', formula: 'pct', goalDirection: 'higher_is_better', decimals: 1,
    formulaText: '(Number of satisfied nursing staff ÷ Total nurses surveyed) × 100',
    numLabel: 'Satisfied nursing staff', denLabel: 'Nurses surveyed',
    baseline: { value: 95, note: 'KPI deck, slide 2D (nursing satisfaction survey)' },
    targets: [{ cycle: 1, value: 97 }, { cycle: 2, value: 97 }],
    actions: [
      act('Empower nurses to participate in decision-making related to patient care.'),
      act('Provide a safe and supportive working environment for staff.'),
      act('Conduct fair and transparent performance appraisals.'),
      act('Provide opportunities for professional and career growth.'),
      act('Recognize and reward staff achievements annually.'),
      act('Conduct regular departmental meetings to obtain feedback from staff.'),
    ],
  },

  /* ------------------------------------------------------------- 3. Patient's Experience */
  {
    id: 'kpi-complaints', code: '3A', pillar: 'experience', name: 'Patient Complaints Pertaining to Nursing Care',
    objective: 'To reduce patient complaints related to nursing care and improve the overall patient experience.',
    source: { indId: 'ind-nursing-complaints', indName: 'Patient Complaints Relating to Nursing Care', rule: 'hospital' },
    unit: 'per 1000 patient-days', formula: 'rate1000', goalDirection: 'lower_is_better', decimals: 2,
    formulaText: '(Complaints relating to nursing care ÷ Patient-days) × 1000',
    numLabel: 'Complaints relating to nursing care', denLabel: 'Patient-days',
    baseline: { value: null, note: 'KPI deck, slide 3A: not yet measured' },
    targets: [],
    actions: [
      act('Introduce hourly rounds during daytime & Q4h during night.'),
      act('Check vital signs within 5 minutes of patient admission.'),
      act('Provide complete orientation on room facilities, food and beverage, call bell, hot water, light switches and other amenities.'),
      act('Complete nursing orders within one hour of receiving the order (help needed from pharmacy & supportive departments).'),
      act('Ensure appropriate handover and takeover during shift changes using the ISBAR communication tool.'),
      act('Aim to provide a memorable and positive experience for all patients during their stay.'),
      act('Monitor patients for IV fluid extravasation during each shift (checked during hourly rounds).'),
    ],
    remarks: 'The deck prints "(positive patient experience responses ÷ total responses) × 100" on this slide — the same formula as 3C (satisfaction). This KPI is measured as a complaints rate, which is what its objective asks for. Set a target once a baseline exists.',
  },
  {
    id: 'kpi-call-bell', code: '3B', pillar: 'experience', name: 'Call Bell Response Time',
    objective: 'To improve the response time to patient call bells.',
    source: { indId: 'ind-call-bell-response', indName: 'Call Bell Response Time', rule: 'hospital' },
    unit: 'minutes', formula: 'avg', goalDirection: 'lower_is_better', decimals: 1,
    formulaText: 'Total call bell response time ÷ Total number of call bell calls',
    numLabel: 'Total call bell response minutes', denLabel: 'Number of call bell calls',
    baseline: { value: 4, note: 'KPI deck, slide 3B (average)' },
    targets: [{ cycle: 1, value: 2 }, { cycle: 2, value: 2 }],
    actions: [
      act('Nurses respond to call bells by the second reminder (within 2 minutes).'),
      act('Utilize PCAs to attend call bells when nurses are engaged with other patient care activities.'),
    ],
  },
  {
    id: 'kpi-patient-satisfaction', code: '3C', pillar: 'experience', name: 'Patient Satisfaction (Nursing Services)',
    objective: 'To increase overall patient satisfaction during hospitalization.',
    source: { indId: 'ind-patient-satisfaction-nursing', indName: 'Patient Satisfaction (Nursing Services)', rule: 'hospital' },
    unit: '%', formula: 'pct', goalDirection: 'higher_is_better', decimals: 1,
    formulaText: '(Number of satisfied patients ÷ Total patients surveyed) × 100',
    numLabel: 'Satisfied patients', denLabel: 'Patients surveyed',
    baseline: { value: null, note: 'KPI deck, slide 3C: not calculated yet' },
    targets: [],
    actions: [
      act('Conduct regular patient satisfaction surveys.'),
      act('Analyze feedback and implement improvement actions.'),
      act('Recognize areas requiring improvement and provide staff feedback.'),
      act('Promote patient-centered nursing care practices.'),
    ],
  },

  /* ------------------------------------------------------------ 4. Financial Performance */
  {
    id: 'kpi-consumable-cost', code: '4A', pillar: 'financial', name: 'Consumable Cost per Patient-Day',
    objective: 'To reduce the cost of consumables used in the ward.',
    source: { indId: 'ind-consumable-cost-per-patient-day', indName: 'Consumable Cost per Patient-Day', rule: 'hospital' },
    unit: 'BDT per patient-day', formula: 'avg', goalDirection: 'lower_is_better', decimals: 0,
    formulaText: 'Total consumable cost for the month ÷ Total patient-days',
    numLabel: 'Total consumable cost for the month (BDT)', denLabel: 'Patient-days',
    baseline: { value: null, note: 'KPI deck, slide 4: not calculated yet' },
    targets: [], baselineTargetPct: -5,
    actions: [
      act('Scrutinize ward indents for excess consumables, such as papers and stationery.'),
      act('Move to maximum documentation in the system to reduce paper usage.'),
      act('Review and control excess consumable indents.'),
      act('Monitor ward supply usage regularly.'),
      act('Switch off unused lights and equipment.'),
      act('Prevent wastage of supplies.'),
      act('Encourage cost-effective practices among staff.'),
      act('Conduct monthly consumption audits.'),
      act('Maintain optimum stock levels.'),
      act('Reuse supplies where appropriate as per policy.'),
      act('Conduct paid CNE.'),
    ],
    remarks: 'Target: 5% below the existing cost. Enter the baseline once 3–6 months of cost per patient-day are recorded; the target then follows it automatically.',
  },
];

// The catalogue as stored documents (order, ids on action items, the deck's tracking line).
function seedDocs() {
  return KPIS.map((k, i) => Object.assign({ frequency: TRACKING, remarks: '', decimals: null, baselineTargetPct: null }, k, {
    order: (i + 1) * 10,
    actions: k.actions.map((a, j) => ({ id: 'a' + (j + 1), text: a.text, owner: '', due: '', status: 'open', note: '' })),
    active: true,
  }));
}

module.exports = { KPIS, seedDocs, HOURLY_ROUNDS, TRACKING };
