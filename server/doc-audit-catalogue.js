/* Nursing Documentation Audit — the four audit tools as the hospital's policies print them.
 * Seeded ONCE into `docAuditTools` (server/doc-audit.js ensureSeed); after that the tools are the
 * administrator's to edit in Documentation Audit → Audit tools. Criterion wording is copied from
 * the policy documents word for word — do not reword it here.
 *
 *   ipd25   UHP-NSG-QA-001 v2.0  Nursing Documentation Accuracy — 25 points (all in-patient units)
 *   ot20    UHP-NSG-QA-002 v1.0  OT — 18 points (Section D, Cath Lab specific, switched off)
 *   cath20  UHP-NSG-QA-002 v1.0  Cath Lab — 20 points (the same checklist, Section D on)
 *   dial20  UHP-NSG-QA-003 v1.0  Dialysis & Endoscopy — 20 points
 *   ed20    UHP-NSG-QA-004 v1.0  Emergency Department — 20 points
 *
 * Criterion ids ('c1'…) are the data keys of every audit's answers: never renumber or reuse one.
 */
const sec = (id, title, jci) => ({ id, title, jci });
// [no, sectionId, jci, critical, text]
const crit = (rows) => rows.map(([no, sectionId, jci, critical, text]) => ({ id: 'c' + no, no, sectionId, jci: jci.split(/,\s*/), critical: !!critical, text, active: true }));
const kpi = (id, code, name, formula, target, direction, criteria) => Object.assign({ id, code, name, formula, target, direction }, criteria ? { criteria } : {});
const ids = (...n) => n.map((x) => 'c' + x);
const range = (a, b) => { const out = []; for (let i = a; i <= b; i++) out.push('c' + i); return out; };
// The post-operative / recovery record used to be its own OT procedure-area choice; since the user asked
// ("combine with OT") it is part of "OT". Kept for the earlier one-shot migrations.
const POSTOP_AREA = 'Post-operative / Recovery (PACU)';
const POSTOP_GUIDE = { areas: [POSTOP_AREA], never: ['c1', 'c20'], note: 'Post-operative / recovery record: Sections A and E apply; items of the operation itself (Sections B–C) that were not part of this record may be marked N/A.' };
// The Aldrete post-anaesthesia recovery score (criterion 18 checks it is recorded): recorded with the audit, not scored.
// The OT's procedure areas: one "OT" for major, minor and emergency cases and the post-operative /
// recovery record (the user's choice), with day-care and obstetric kept apart. The guide never names item numbers
// (they renumber when a tool changes).
const OT_AREAS_MERGED = ['Major OT', 'Minor OT', 'Emergency OT'];
const OT_GUIDE = [
  { areas: ['OT'], never: ['c1', 'c20'], note: 'All sections apply, including the post-operative / recovery record. Patient identification and authentication are never N/A. For an emergency case: emergency consent per policy, and time-out, counts, medications and specimens are never N/A. Items not relevant to the case (e.g. tourniquet, implants) may be N/A; when only the recovery record is audited, items of the operation itself that were not part of it may be N/A.' },
  { areas: ['Obstetric OT'], note: 'All sections apply.' },
  { areas: ['Day-care OT'], note: 'All sections apply; items not relevant to the case (e.g. tourniquet, implants) may be N/A. The day-care discharge (escort, written instructions, follow-up) must be documented.' },
];
const OT_SAMPLE_NOTE = 'Minimum 10 records per area per month (OT, Day-care OT, Obstetric OT), randomly selected across all shifts and surgeons. Include at least 2 emergency / after-hours cases where available, and at least 1 case with implant or specimen. Each OT nurse is audited at least once per quarter.';
// The Aldrete score as a CHECKLIST item on the OT and Cath Lab tools (was it documented?) — not critical.
const ALDRETE_ITEM = { id: 'c21', no: 0, sectionId: 'E', jci: ['ASC', 'COP'], critical: false, active: true,
  text: "Aldrete score is documented on arrival in recovery and before discharge from recovery (score ≥ 9 to discharge, or the reason and the anaesthetist's approval are recorded)." };
// Kept for the tool editor's "Aldrete scale" field type; no longer on the OT / Cath Lab headers.
const ALDRETE_FIELDS = [
  { id: 'aldreteIn', label: 'Aldrete score — on arrival in recovery', type: 'aldrete' },
  { id: 'aldreteOut', label: 'Aldrete score — at discharge from recovery', type: 'aldrete' },
];
const STD_KPIS = [
  kpi('kpi1', 'KPI-1', 'Documentation Accuracy Rate', 'accuracy', 90, 'higher'),
  kpi('kpi2', 'KPI-2', 'Audit Pass Rate', 'pass', 85, 'higher'),
];

const IPD = {
  id: 'ipd25', code: 'UHP-NSG-QA-001', version: '2.0', order: 10,
  name: 'Nursing Documentation Accuracy Audit (25 points)',
  short: 'IPD 25-point',
  scope: 'All inpatient units: wards, cabins, ICU, CCU, HDU, NICU, Labour Room (Appendix A of UHP-NSG-QA-001).',
  header: {
    areaLabel: 'Ward / unit',
    areas: ['Neonatal ICU (NICU)', 'Medical ICU (MICU)', 'Surgical ICU (SICU)', 'Coronary Care Unit (CCU)', 'Cardiac ICU (CT ICU)', 'Cabin Level 9', 'Cabin Level 10', 'Cabin Level 11', 'Labour, Delivery & Recovery (LDR)'],
    bedLabel: 'Ward / bed no.',
    extra: [{ id: 'highRisk', label: 'High-risk record (sample rule 7.1)', type: 'select', options: ['', 'Procedure with consent', 'Restraint', 'DAMA / LAMA', 'High-alert medication', 'DNAR'] }],
  },
  sample: { minRecords: 10, note: 'Minimum 10 patient records per unit per month, selected randomly from current inpatients and discharges of the month, covering all shifts. Include at least one high-risk record per unit where available (procedure with consent, restraint, DAMA/LAMA, high-alert medication, DNAR). Each nurse should be audited at least once per quarter.' },
  sections: [
    sec('A', 'Patient assessment', 'IPSG, AOP, MMU'),
    sec('B', 'Care planning & evaluation', 'COP'),
    sec('C', 'Progress notes & escalation', 'MOI, COP, IPSG'),
    sec('D', 'Medication documentation', 'MMU, IPSG'),
    sec('E', 'Handover, safety & education', 'IPSG, ACC, COP, PCI, PCC, QPS'),
    sec('F', 'Consent', 'PCC, IPSG, ACC'),
    sec('G', 'High-risk care & patient rights', 'COP, PCC'),
    sec('H', 'Discharge & record standards', 'ACC, MOI'),
  ],
  criteria: crit([
    [1, 'A', 'IPSG', 1, 'Patient is identified using at least two approved identifiers on every page/entry before doing any procedure'],
    [2, 'A', 'AOP, MMU', 1, "Initial nursing assessment is completed within 24 hours of admission, including history, vital signs and allergy status (or 'no known allergy')."],
    [3, 'A', 'AOP, IPSG', 0, 'Pain, fall and pressure-injury, DVT risks are assessed with approved tools, and reassessment after pain intervention, sedation or change in condition is documented with time and response.'],
    [4, 'B', 'COP', 0, "Individualized care plan with goals and interventions is based on the assessment and updated when the patient's condition changes."],
    [5, 'B', 'COP', 0, "Interventions provided and the patient's response are documented."],
    [6, 'C', 'MOI, COP', 0, 'Nursing notes are legible, chronological, dated and timed; condition changes and abnormal findings are documented promptly.'],
    [7, 'C', 'IPSG, COP', 1, 'Physician notification, critical results and escalation are documented (time, person informed, advice received, action taken).'],
    [8, 'C', 'MOI', 1, 'Entries accurately reflect care given; no unauthorised backdating, alteration or falsification.'],
    [9, 'D', 'MMU', 1, 'MAR is complete and authenticated; right patient, medication, dose, route and time are verified and documented.'],
    [10, 'D', 'MMU', 0, 'Omitted, delayed or refused doses (with reasons) and SOS/PRN indication and response are documented.'],
    [11, 'D', 'IPSG, MMU', 1, 'Required high-alert medication double-checks are documented. Narcotic drug policy maintained'],
    [12, 'E', 'IPSG, ACC', 0, 'Shift and transfer handover use ISBAR/SBAR, with receiving nurse/team acknowledgement documented.'],
    [13, 'E', 'IPSG, COP, PCI', 0, 'Infection-prevention measures including Bundle Care are documented for at-risk patients. Fall-prevention, pressure-injury/wound care documentation done'],
    [14, 'E', 'PCC, QPS', 0, 'Patient/family education and understanding are documented, and safety incidents are reported per policy.'],
    [15, 'F', 'PCC', 0, 'General consent for admission/treatment is signed, dated, timed and filed before non-emergency care.'],
    [16, 'F', 'PCC', 1, 'Informed consent records benefits, risks, alternatives and right to refuse in a language the patient understands, plus separate consents where required (transfusion, HIV test, photography, research, organ donation, restraint, information use).'],
    [17, 'F', 'PCC', 1, 'Consent is given by the correct person (patient or authorized surrogate/guardian, identity and authority recorded); capacity is assessed where in doubt, with assent/refusal and reason.'],
    [18, 'F', 'PCC, IPSG', 1, 'Consent form is complete (procedure, site/side, practitioner, signatures, witness, date/time, interpreter ID) and verified at the pre-procedure time-out; any withdrawal or change is documented.'],
    [19, 'F', 'PCC, ACC', 1, "DAMA/LAMA documentation includes the discussion held, potential risks and consequences explained, patient's understanding, required signatures and witness details, and the follow-up or advice provided."],
    [20, 'G', 'COP, PCC', 1, 'Restraint documents indication, type, order/consent, monitoring, reassessment and discontinuation.'],
    [21, 'G', 'COP, PCC', 1, 'End-of-life care, advance directive and DNR or DNI status are documented where applicable.'],
    [22, 'G', 'PCC', 0, 'Patient belongings/valuables are documented on admission, transfer and discharge.'],
    [23, 'H', 'ACC', 0, 'Discharge/transfer condition, instructions and follow-up plan are documented.'],
    [24, 'H', 'MOI', 1, 'Every entry is authenticated with name, signature/approved e-ID, date and time.'],
    [25, 'H', 'MOI', 0, 'Only hospital-approved abbreviations are used; documentation errors are corrected using the approved procedure without erasing or overwriting original entries; and patient information is kept confidential with access restricted to authorized personnel.'],
  ]),
  kpis: STD_KPIS.concat([
    kpi('kpi3', 'KPI-3', 'Fully Compliant Record Rate', 'full', 60, 'higher'),
    kpi('kpi4', 'KPI-4', 'Critical Failure Rate', 'critical', 5, 'lower'),
    kpi('kpi5', 'KPI-5', 'Consent Documentation Compliance', 'subset', 95, 'higher', range(15, 19)),
    kpi('kpi6', 'KPI-6', 'Medication Documentation Compliance', 'subset', 95, 'higher', range(9, 11)),
  ]),
  naGuide: [],
};

const OT = {
  id: 'ot20', code: 'UHP-NSG-QA-002', version: '1.0', order: 20,
  name: 'OT Documentation Accuracy Audit (19 points)',
  short: 'OT 19-point',
  scope: 'Every OT (major, minor, emergency, day-care, obstetric) and the post-operative / recovery record (Appendix A of UHP-NSG-QA-002; the Cath Lab has its own tool).',
  cathSplit: true,
  header: {
    areaLabel: 'Procedure area',
    areas: ['OT', 'Day-care OT', 'Obstetric OT'],
    bedLabel: 'OT / room no.',
    extra: [
      { id: 'procedure', label: 'Procedure', type: 'text' },
      { id: 'anaesthesia', label: 'Anaesthesia type', type: 'select', options: ['', 'GA', 'Regional', 'LA', 'Sedation'] },
      { id: 'caseType', label: 'Case (sample rule 7.1)', type: 'select', options: ['', 'Elective', 'Emergency / after-hours', 'With implant or specimen'] },
    ],
  },
  sample: { minRecords: 10, note: OT_SAMPLE_NOTE },
  sections: [
    sec('A', 'Pre-procedure check', 'IPSG, AOP, ASC, PCC'),
    sec('B', 'Surgical safety checklist', 'IPSG, ASC'),
    sec('C', 'Intra-procedure record', 'ASC, COP, PCI, MMU, MOI'),
    sec('D', 'Cath Lab specific – mark N/A for OT cases', 'ASC, MMU, COP'),
    sec('E', 'Recovery, handover & record standards', 'ASC, IPSG, ACC, MOI'),
  ],
  criteria: crit([
    [1, 'A', 'IPSG', 1, 'Patient is identified using at least two approved identifiers (ID band checked against record) on reception to OT / Cath Lab and on every page/entry.'],
    [2, 'A', 'AOP, ASC', 0, 'Pre-procedure checklist is complete: NPO status, required investigations, blood group/cross-match availability, removal of jewellery/dentures/prosthesis, pre-medication and bladder status.'],
    [3, 'A', 'AOP, ASC', 1, 'Allergy status (incl. latex, iodine/contrast) and pre-anaesthesia / pre-sedation assessment (ASA class, airway) are documented before the procedure.'],
    [4, 'A', 'PCC', 1, 'Procedure consent and anaesthesia/sedation consent (and blood consent where needed) are complete, signed, dated and timed; for emergency cases the emergency-consent justification is documented per policy.'],
    [5, 'A', 'IPSG', 1, 'Procedure site is marked where required (laterality, level, digit) and verified against consent and list.'],
    [6, 'B', 'IPSG, ASC', 0, 'Sign-in is documented before induction / sedation: identity, site, consent, anaesthesia/sedation safety check, pulse oximeter, airway/aspiration and blood-loss risk.'],
    [7, 'B', 'IPSG', 1, 'Time-out is performed and documented immediately before incision/puncture with the whole team present (time and names recorded).'],
    [8, 'B', 'IPSG, ASC', 1, 'Swab, sharps and instrument counts (initial, additional, closing) are recorded and signed by scrub and circulating nurse; any discrepancy and action taken is documented.'],
    [9, 'B', 'IPSG, ASC', 0, 'Sign-out is documented before the patient leaves the room: procedure performed, count confirmation, specimen labelling, equipment problems and key recovery concerns.'],
    [10, 'C', 'ASC, MOI', 0, 'Intra-procedure record includes times (in room, anaesthesia/sedation start, incision/puncture, end, out), team members, procedure, anaesthesia type, vital-sign monitoring, intake/output, blood loss and any adverse event.'],
    [11, 'C', 'COP, ASC', 0, 'Patient positioning, pressure-area protection, diathermy plate site with pre/post skin check, tourniquet time/pressure and warming measures are documented.'],
    [12, 'C', 'PCI', 0, 'Infection prevention is documented: prophylactic antibiotic name and time (before incision), skin preparation agent, hair removal method and wound class.'],
    [13, 'C', 'MMU, IPSG', 1, 'Medications, IV fluids, blood products and local anaesthetic given are recorded (drug, dose, route, time, signature); high-alert medication double-checks are documented.'],
    [14, 'C', 'ASC', 0, 'Implants, prostheses and devices are traceable (name, size, lot/serial number or sticker) and sterilisation indicators are filed.'],
    [15, 'C', 'IPSG, AOP', 1, 'Specimens are labelled with two identifiers, type and site, entered in the specimen register and handed over with signature.'],
    [16, 'D', 'ASC, MMU', 0, 'Contrast type and volume, renal function / pre-hydration, fluoroscopy time and radiation dose (DAP / air kerma) are documented.'],
    [17, 'D', 'COP, MMU', 0, 'Access site (radial/femoral), sheath size, anticoagulation (dose, ACT values), sheath removal time, haemostasis method and post-procedure site and distal-pulse checks are documented.'],
    [18, 'E', 'ASC, COP', 0, 'Recovery record includes recovery score (e.g. Aldrete) on arrival and discharge, pain and nausea scores, and discharge criteria met with nurse signature.'],
    [19, 'E', 'IPSG, ACC', 0, 'Handover OT / Cath Lab → recovery → ward/ICU uses ISBAR with post-procedure orders and receiving nurse acknowledgement; day-care patients have escort, written instructions and follow-up documented.'],
    [20, 'E', 'MOI', 1, 'Every entry is authenticated (name, signature/e-ID, date, time); OT / Cath Lab register is updated; no backdating; correction procedure and approved abbreviations followed.'],
  ]),
  kpis: STD_KPIS.concat([
    kpi('kpi3', 'KPI-3', 'Critical Failure Rate', 'critical', 5, 'lower'),
    kpi('kpi4', 'KPI-4', 'Surgical Safety Checklist Compliance', 'subset', 95, 'higher', range(6, 9)),
  ]),
  naGuide: [
    ...OT_GUIDE.map((g) => Object.assign({}, g)),
  ],
};
// Section D (Cath Lab specific) is the Cath Lab tool's; on the OT tool it is switched off — kept, never deleted.
OT.criteria = OT.criteria.map((c) => (c.id === 'c16' || c.id === 'c17' ? Object.assign({}, c, { active: false }) : c));
// The Aldrete item right after the recovery record (c18).
OT.criteria.splice(OT.criteria.findIndex((c) => c.id === 'c18') + 1, 0, Object.assign({}, ALDRETE_ITEM));
OT.criteria.filter((c) => c.active).forEach((c, i) => { c.no = i + 1; });

// The Cath Lab's one procedure area: the post-procedure / recovery record is part of it (the user's
// choice, as for "OT"). The guide never names item numbers (they renumber when a tool changes).
const CATH_POSTOP_AREA = 'Post-procedure / Recovery';
const CATH_GUIDE = { areas: ['Cardiac Cath Lab'], never: ['c1', 'c20'], note: 'All sections apply, including Section D and the post-procedure / recovery record. Counts cover sharps, guidewires, sheaths and swabs used. Patient identification and authentication are never N/A. When only the recovery record is audited, items of the procedure itself that were not part of it may be N/A.' };

/* The Cath Lab: the same QA-002 checklist, word for word, all 20 criteria including Section D. */
const CATH = {
  id: 'cath20', code: 'UHP-NSG-QA-002 (Cath Lab)', version: '1.0', order: 25,
  name: 'Cath Lab Documentation Accuracy Audit (21 points)',
  short: 'Cath Lab 21-point',
  scope: 'The Cardiac Cath Lab (Appendix A of UHP-NSG-QA-002, all sections including Section D).',
  header: {
    areaLabel: 'Procedure area',
    areas: ['Cardiac Cath Lab'],
    bedLabel: 'Cath Lab / room no.',
    extra: [
      { id: 'procedure', label: 'Procedure', type: 'text' },
      { id: 'anaesthesia', label: 'Sedation / anaesthesia', type: 'select', options: ['', 'LA', 'Sedation', 'GA'] },
      { id: 'caseType', label: 'Case (sample rule 7.1)', type: 'select', options: ['', 'Elective', 'Emergency / after-hours', 'With implant or device'] },
    ],
  },
  sample: { minRecords: 10, note: 'Minimum 10 Cath Lab records per month, randomly selected across all shifts and cardiologists. Include at least 2 emergency / after-hours cases where available, and at least 1 case with an implant or device. Each Cath Lab nurse is audited at least once per quarter.' },
  sections: OT.sections.map((x) => (x.id === 'D' ? Object.assign({}, x, { title: 'Cath Lab specific' }) : Object.assign({}, x))),
  criteria: OT.criteria.map((c, i) => Object.assign({}, c, { active: true, no: i + 1 })),
  kpis: OT.kpis.map((k) => Object.assign({}, k)),
  naGuide: [
    Object.assign({}, CATH_GUIDE),
  ],
};

const DIAL = {
  id: 'dial20', code: 'UHP-NSG-QA-003', version: '1.0', order: 30,
  name: 'Dialysis & Endoscopy Documentation Accuracy Audit (20 points)',
  short: 'Dialysis & Endoscopy 20-point',
  scope: 'Dialysis Unit (maintenance, acute, bedside / ICU, isolation) and the Endoscopy Suite (Appendix A of UHP-NSG-QA-003).',
  header: {
    areaLabel: 'Area',
    areas: ['Dialysis Unit', 'Bedside / ICU dialysis', 'Isolation dialysis', 'Endoscopy Suite', 'Emergency endoscopy'],
    bedLabel: 'Machine no. / Scope serial no.',
    extra: [
      { id: 'procedure', label: 'Session / procedure', type: 'text' },
      { id: 'sedation', label: 'Sedation (endoscopy)', type: 'select', options: ['', 'None', 'Conscious', 'Deep / MAC'] },
    ],
  },
  sample: { minRecords: 15, note: 'Minimum 15 dialysis sessions and 10 endoscopy procedures per month, randomly selected across all shifts, nephrologists and endoscopists. Dialysis sample includes at least 2 acute / emergency or bedside sessions, 2 isolation sessions and 2 patients with a dialysis catheter; endoscopy sample includes at least 2 therapeutic procedures (including ERCP where performed), 2 cases with specimens and 1 emergency / after-hours case, where available. Each nurse is audited at least once per quarter.' },
  sections: [
    sec('A', 'Common – identification, assessment & consent', 'IPSG, AOP, PCC'),
    sec('B', 'Dialysis specific – mark N/A for endoscopy cases', 'COP, AOP, MMU, PCI, FMS'),
    sec('C', 'Endoscopy specific – mark N/A for dialysis cases', 'AOP, ASC, IPSG, PCI, ACC, MOI'),
    sec('D', 'Common – medications, handover & record standards', 'MMU, IPSG, ACC, MOI'),
  ],
  criteria: crit([
    [1, 'A', 'IPSG', 1, 'Patient is identified using at least two approved identifiers (ID band checked against record) on arrival to the dialysis unit / endoscopy suite and on every page/entry.'],
    [2, 'A', 'AOP, IPSG', 1, 'Allergy status (drug, latex, heparin, iodine/contrast) and nursing pre-procedure assessment (vital signs, weight, relevant history, fall risk) are documented before the session / procedure.'],
    [3, 'A', 'PCC', 1, 'Valid consent is complete, signed, dated and timed: dialysis / vascular-access consent renewed per policy, or endoscopy and sedation consent (blood consent where needed); emergency-consent justification documented per policy.'],
    [4, 'B', 'COP, MMU', 1, 'Current dialysis prescription is signed by the nephrologist and verified by the nurse before start: modality, duration, dialyser, blood/dialysate flow, dialysate K/Ca/Na, UF goal and anticoagulation.'],
    [5, 'B', 'AOP, COP', 0, 'Pre-dialysis assessment is documented: pre-weight, dry weight, interdialytic weight gain, BP, pulse, temperature, oedema / breathlessness and calculated UF goal.'],
    [6, 'B', 'PCI', 1, 'Hepatitis B, hepatitis C and HIV status with date of last screen is recorded, and the patient is allocated to the correct (dedicated / isolation) machine and area.'],
    [7, 'B', 'PCI, COP', 0, 'Vascular access is assessed and documented: type (AVF / AVG / tunnelled / non-tunnelled catheter), site, thrill and bruit or exit-site condition, signs of infection, needle gauge / cannulation, and catheter lock solution.'],
    [8, 'B', 'PCI, FMS', 1, 'Machine safety checks are recorded and signed for the machine used: machine number, disinfection completed, residual disinfectant test negative, alarm/conductivity/temperature tests passed, and water-treatment check for the shift.'],
    [9, 'B', 'COP', 0, 'Intra-dialytic monitoring is recorded at least every 30 minutes (BP, pulse, blood flow, arterial / venous pressure, TMP, UF achieved), with any complication (hypotension, cramps, clotting, access problem) and action taken.'],
    [10, 'B', 'COP', 0, 'Post-dialysis record includes post-weight, total UF removed, vital signs, access haemostasis, scheduled bloods (e.g. URR / Kt/V) and patient condition on leaving.'],
    [11, 'C', 'AOP, ASC', 0, 'Pre-procedure preparation is documented: fasting status, bowel preparation and quality (colonoscopy), anticoagulant / antiplatelet and diabetic medicine status, and pre-sedation assessment (ASA class, airway).'],
    [12, 'C', 'IPSG, ASC', 1, 'Procedural safety checklist is documented: sign-in, time-out immediately before scope insertion with the whole team (patient, procedure, sedation plan, anticoagulation, time and names), and sign-out.'],
    [13, 'C', 'ASC', 0, 'Sedation monitoring record shows level of sedation, SpO₂, BP, heart rate (and ETCO₂ where used), oxygen given, at least every 5 minutes, with any adverse event and reversal agent given.'],
    [14, 'C', 'ASC, MOI', 0, 'Procedure record includes scope serial number, procedure, start and end times, therapeutic interventions (e.g. polypectomy, banding, dilatation, stent), diathermy plate site with skin check, complications and, for ERCP, fluoroscopy time and dose.'],
    [15, 'C', 'IPSG, AOP', 1, 'Specimens (biopsy / polyp) are labelled with two identifiers, site and number of pots, entered in the specimen register and handed over with signature.'],
    [16, 'C', 'PCI', 1, 'Scope reprocessing is traceable: scope serial number linked to the patient and to leak test, manual clean, high-level disinfection / AER cycle and storage, each signed.'],
    [17, 'C', 'ASC, ACC', 0, 'Recovery and discharge record includes recovery score (e.g. Aldrete) on arrival and discharge, discharge criteria met, escort, written instructions (no driving for 24 h after sedation, warning signs of bleeding / perforation) and histology follow-up plan.'],
    [18, 'D', 'MMU, IPSG', 1, 'Medications, IV fluids and blood products given are recorded with drug, dose, route, time and signature (e.g. heparin, ESA, IV iron, antibiotics, sedatives, reversal agents); high-alert medication double-checks are documented.'],
    [19, 'D', 'IPSG, ACC', 0, 'Handover to ward / ICU uses ISBAR with post-procedure orders and receiving nurse acknowledgement; outpatients have next session / appointment and home instructions documented.'],
    [20, 'D', 'MOI', 1, 'Every entry is authenticated (name, signature/e-ID, date, time); dialysis / endoscopy register is updated; no backdating; correction procedure and approved abbreviations followed.'],
  ]),
  kpis: STD_KPIS.concat([
    kpi('kpi3', 'KPI-3', 'Critical Failure Rate', 'critical', 5, 'lower'),
    kpi('kpi4', 'KPI-4', 'Dialysis Safety Check Compliance', 'subset', 95, 'higher', ids(4, 6, 8)),
    kpi('kpi5', 'KPI-5', 'Endoscopy Safety & Scope Traceability Compliance', 'subset', 95, 'higher', ids(12, 16)),
  ]),
  naGuide: [
    { areas: ['Dialysis Unit'], na: range(11, 17), note: 'Sections A, B and D apply. Section C (items 11–17) = N/A.' },
    { areas: ['Bedside / ICU dialysis'], na: range(11, 17), note: 'As for the dialysis unit; item 8 includes the portable RO / water check for the machine used. CRRT run by ICU nurses is audited under UHP-NSG-QA-001.' },
    { areas: ['Isolation dialysis'], na: range(11, 17), note: 'As for the dialysis unit; item 6 must show the dedicated machine / area used.' },
    { areas: ['Endoscopy Suite'], na: range(4, 10), note: 'Sections A, C and D apply. Section B (items 4–10) = N/A. For ERCP, item 14 includes fluoroscopy time and radiation dose.' },
    { areas: ['Emergency endoscopy'], na: range(4, 10), never: ids(1, 3, 12, 15, 16, 18, 20), note: 'Sections A, C and D apply; emergency consent per policy (item 3). Identification, consent, time-out, specimens, scope traceability, medications and authentication are never N/A.' },
  ],
};

const ED = {
  id: 'ed20', code: 'UHP-NSG-QA-004', version: '1.0', order: 40,
  name: 'Emergency Department Documentation Accuracy Audit (20 points)',
  short: 'Emergency 20-point',
  scope: 'All Emergency Department zones, triage to disposition (Appendix A of UHP-NSG-QA-004).',
  header: {
    areaLabel: 'ED zone',
    areas: ['Triage', 'Resuscitation', 'Acute / Majors', 'Minor / Fast-track', 'Paediatric', 'Observation'],
    bedLabel: 'Bed / bay no.',
    extra: [
      { id: 'arrival', label: 'Arrival date / time', type: 'text' },
      { id: 'triage', label: 'Triage category', type: 'select', options: ['', '1', '2', '3', '4', '5'] },
      { id: 'mlc', label: 'Medico-legal case (MLC)', type: 'select', options: ['', 'No', 'Yes'] },
    ],
  },
  sample: { minRecords: 30, note: 'Minimum 30 records per month, randomly selected across all shifts (including nights and weekends), all triage categories and all ED zones. Include at least 3 resuscitation or time-critical pathway cases (stroke, STEMI, sepsis, trauma), 2 admissions/transfers, 1 LAMA/DAMA and 1 medico-legal case per month where available. Each ED nurse is audited at least once per quarter.' },
  sections: [
    sec('A', 'Arrival, identification & triage', 'IPSG, ACC, AOP'),
    sec('B', 'Initial nursing assessment & consent', 'AOP, MMU, IPSG, PCI, PCC'),
    sec('C', 'Treatment & time-critical care', 'COP, MMU, IPSG, ASC'),
    sec('D', 'Disposition, handover & record standards', 'IPSG, ACC, PCC, MOI'),
  ],
  criteria: crit([
    [1, 'A', 'IPSG', 1, 'Patient is identified using at least two approved identifiers; ID band applied on arrival and checked on every page/entry (temporary ID protocol used for unknown patients).'],
    [2, 'A', 'ACC, MOI', 0, 'Arrival date and time, mode of arrival (walk-in, ambulance, referral), accompanying person and pre-hospital/ambulance handover are documented.'],
    [3, 'A', 'ACC, AOP', 1, 'Triage category is assigned using the approved 5-level scale and documented with time of triage (within the target time), chief complaint, triage vital signs and triage nurse signature.'],
    [4, 'A', 'AOP, ACC', 0, 'Re-triage / reassessment is documented when the condition changes or the waiting time exceeds the target for the triage category.'],
    [5, 'B', 'AOP, MMU', 1, 'Allergy status (drug, food, latex, contrast) is documented before any medication is given; "no known allergy" is recorded where applicable.'],
    [6, 'B', 'AOP', 0, 'Initial nursing assessment is complete: ABCDE / primary survey, GCS or AVPU, blood glucose where indicated, pain score, weight (children) and pregnancy status for women of childbearing age.'],
    [7, 'B', 'AOP, IPSG, PCI', 0, 'Risk screening is documented: fall risk, pressure injury, suicide/self-harm or violence risk, and infection screening (fever, respiratory/TB) with isolation where required.'],
    [8, 'B', 'PCC', 1, 'Consent for procedures (or emergency implied-consent justification) is documented; for medico-legal cases the MLC register entry and police intimation are recorded.'],
    [9, 'C', 'COP', 1, 'Vital signs and early warning score are recorded at the frequency set for the triage category or by order; abnormal values are escalated to the doctor with time and response documented.'],
    [10, 'C', 'COP', 0, 'When a time-critical pathway is activated (stroke, STEMI, sepsis, trauma), activation time and key milestones (e.g. door-to-ECG, door-to-CT, time to antibiotic) are recorded.'],
    [11, 'C', 'IPSG', 0, 'Verbal/telephone orders are written down, read back, marked "read back" and countersigned by the prescriber within the policy time.'],
    [12, 'C', 'MMU', 1, 'Medications, IV fluids and blood products given are recorded (drug, dose, route, time, signature); STAT doses and high-alert double-checks are documented; children have weight-based dose checks.'],
    [13, 'C', 'COP', 1, 'Resuscitation record is complete for any arrest or major resuscitation: event times, CPR, rhythm and defibrillation, airway, drugs, team leader, outcome and recorder signature.'],
    [14, 'C', 'IPSG, COP', 0, 'ED procedures (IV cannula, urinary catheter, NG tube, intubation, wound care, splint) are documented with time, site, size and performer; time-out is recorded for invasive procedures.'],
    [15, 'C', 'IPSG, AOP', 1, 'Specimens are labelled at the bedside with two identifiers; critical results are received, read back and reported to the doctor, with times and names documented.'],
    [16, 'C', 'COP, ASC', 0, 'Procedural sedation monitoring, or physical restraint order, monitoring and release, is documented as per policy (mark N/A if not used).'],
    [17, 'D', 'IPSG, ACC', 0, 'Handover at shift change and at transfer (ward, ICU, OT, Cath Lab or other facility) uses ISBAR, with condition at transfer, escort/monitoring level, time and receiving nurse acknowledgement.'],
    [18, 'D', 'ACC, PCC', 0, 'Disposition is documented with time (admit, discharge, transfer, LAMA/DAMA, death); LAMA/DAMA form signed with risks explained; discharge instructions given and understanding confirmed.'],
    [19, 'D', 'COP, PCC', 0, 'Pain and response to treatment are reassessed and documented after analgesia or intervention (within 30–60 minutes), and patient/family education is recorded.'],
    [20, 'D', 'MOI', 1, 'Every entry is authenticated (name, signature/e-ID, date, time); ED register is updated; late entries are marked; no backdating; correction procedure and approved abbreviations followed.'],
  ]),
  kpis: STD_KPIS.concat([
    kpi('kpi3', 'KPI-3', 'Critical Failure Rate', 'critical', 5, 'lower'),
    kpi('kpi4', 'KPI-4', 'Triage & Deterioration Documentation Compliance', 'subset', 95, 'higher', ids(3, 4, 9)),
  ]),
  naGuide: [
    { areas: ['Resuscitation'], never: ids(1, 3, 5, 12, 20), note: 'All items apply. Item 13 applies to every arrest or major resuscitation; item 10 applies when a time-critical pathway is activated. Identification, triage, allergy, medications and authentication are never N/A, even when entries are completed after the event.' },
    { areas: ['Acute / Majors', 'Minor / Fast-track', 'Triage'], na: ids(10, 13, 16), note: 'Sections A, B and D apply. In Section C, items 10, 13 and 16 are N/A unless the event occurred; items 9, 12, 14 and 15 apply whenever care was given.' },
    { areas: ['Paediatric'], note: 'All relevant items apply, using the paediatric triage scale and early warning score. Item 6 includes weight; item 12 requires weight-based dose checks; item 8 requires parent/guardian consent.' },
    { areas: ['Observation'], note: 'All items apply. Patients held in the ED for more than 6 hours must also meet the reassessment, care-plan and handover standards of UHP-NSG-QA-001.' },
  ],
};

const TOOLS = [IPD, OT, CATH, DIAL, ED];

/* Which tool a department audits with, guessed from its id / name until an administrator sets
   it in Documentation Audit → Settings. null = not audited (out-patient, quality-only areas). */
function guessTool(dept) {
  const id = String((dept && dept.id) || '').toLowerCase();
  const nm = String((dept && dept.name) || '').toLowerCase();
  const s = id + ' ' + nm;
  if (/\b(opd|homecare)\b|out[\s-]*patient|home\s*care|family medicine|infection|administrative/.test(s)) return null;
  if (id === 'er' || /emergency/.test(nm)) return { toolId: 'ed20', minRecords: 30 };
  if (/cath/.test(s)) return { toolId: 'cath20', minRecords: 10 };
  if (/\b(ot|ctot|ctvs)\b|operation|theatre/.test(s)) return { toolId: 'ot20', minRecords: 10 };
  if (/endoscop/.test(s)) return { toolId: 'dial20', minRecords: 10 };
  if (/dialysis/.test(s)) return { toolId: 'dial20', minRecords: 15 };
  if (/icu|ccu|hdu|nicu|ldr|labou?r|level|lvl|ward|cabin/.test(s)) return { toolId: 'ipd25', minRecords: 10 };
  return null;
}

const clone = (x) => JSON.parse(JSON.stringify(x));
const seedTools = () => TOOLS.map(clone);

module.exports = { TOOLS, seedTools, guessTool, POSTOP_AREA, POSTOP_GUIDE, ALDRETE_FIELDS, ALDRETE_ITEM, OT_AREAS_MERGED, OT_GUIDE, OT_SAMPLE_NOTE, CATH_POSTOP_AREA, CATH_GUIDE };
