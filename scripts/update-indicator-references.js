/* Replace every quality-indicator reference with a properly-formed, current citation.
 *
 * The references carried in the database were uneven: 24 of 39 indicators had no
 * reference at all, no URL, no edition/year, or a one-line fragment such as
 * "Electrosurgical safety (AORN)" that tells a reader nothing they could look up. Some
 * were also stale — Phlebitis cited the INS Standards 8th ed. (2021) while the catheter
 * indicators already cited the 2024 revision of the same document.
 *
 * Every citation below was checked against the issuing body in August 2026: the naming
 * body, the document title, its CURRENT edition and year, the specific chapter/standard,
 * and a URL that resolves. Where a claim could not be verified it is not made — the
 * out-patient fall entry says plainly that no national measure exists for that setting
 * rather than borrowing the inpatient one's authority.
 *
 * Notable currency corrections:
 *   CDC/NHSN  -> Patient Safety Component Manual 2026 edition (effective 1 Jan 2026);
 *                SSI now cites Chapter 9 rather than a landing page.
 *   INS       -> Infusion Therapy Standards of Practice 9th ed. (2024), J Infus Nurs
 *                47(1S). Phlebitis was two editions behind.
 *   AORN      -> the Electrosurgery guideline is now "Safe Use of Surgical Energy
 *                Devices"; the 2026 update adds mandatory adverse-event tracking.
 *   ACC/AHA   -> the 2013 STEMI guideline is superseded by the 2025 ACS guideline, which
 *                frames the target as first-medical-contact-to-device <=90 min.
 *   NABH      -> 6th edition, effective 1 January 2025.
 *
 * Writes to the qualityFormulas master, every departments.quality indicator copy, AND
 * the appdata overlay — an overlay patch carrying an old reference would otherwise mask
 * the corrected one, which is the trap that has bitten this data before.
 *
 * Usage: node scripts/update-indicator-references.js           (dry run)
 *        node scripts/update-indicator-references.js --apply   (writes)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const fs = require('fs');
const { getDbHandle } = require('../server/db');

const NHSN = 'CDC/NHSN Patient Safety Component Manual, 2026 edition (effective 1 January 2026)';
const INS9 = 'Infusion Nurses Society. Infusion Therapy Standards of Practice, 9th edition (2024). J Infus Nurs. 2024;47(1S):S1–S285';
const NABH6 = 'NABH Accreditation Standards for Hospitals, 6th edition (effective 1 January 2025)';
const OT_LIT = 'Comparative study of key quality performance indicators in anaesthesia and surgery in an operation theatre at a tertiary care hospital, J Anaesthesiol Clin Pharmacol (2024)';
const U_INS = 'https://pubmed.ncbi.nlm.nih.gov/38211609/';
const U_OTLIT = 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11042104/';
const U_ACS = 'https://doi.org/10.1161/CIR.0000000000001309';

/* key = normalised indicator name -> { ref, url } */
const REFS = {
  'catheter associated uti cauti': {
    ref: NHSN + ', Chapter 7: Urinary Tract Infection (CAUTI) Events — SUTI/ABUTI surveillance definitions and the indwelling-catheter day denominator. Standardised Infection Ratio methodology per the NHSN SIR Guide.',
    url: 'https://www.cdc.gov/nhsn/pdfs/pscmanual/7psccauticurrent.pdf',
  },
  'central line associated bloodstream infection clabsi': {
    ref: NHSN + ', Chapter 4: Bloodstream Infection Event (CLABSI and non-central-line-associated BSI) — LCBI criteria and the central-line day denominator.',
    url: 'https://www.cdc.gov/nhsn/pdfs/pscmanual/4psc_clabscurrent.pdf',
  },
  'ventilator associated pneumonia vap': {
    ref: NHSN + ', Chapter 6: Pneumonia (Ventilator-associated [VAP] and non-ventilator-associated [PNEU]) Event — PNU1–PNU3 criteria and the ventilator-day denominator.',
    url: 'https://www.cdc.gov/nhsn/pdfs/pscmanual/6pscvapcurrent.pdf',
  },
  'surgical site infection ssi': {
    ref: NHSN + ', Chapter 9: Surgical Site Infection (SSI) Event — superficial/deep incisional and organ-space criteria, with the 30- or 90-day surveillance window by procedure category. WHO Global Guidelines for the Prevention of Surgical Site Infection, 2nd edition (2018).',
    url: 'https://www.cdc.gov/nhsn/pdfs/pscmanual/9pscssicurrent.pdf',
  },
  'infection rate': {
    ref: NHSN + ', Chapter 2: Identifying Healthcare-associated Infections (present-on-admission vs healthcare-associated), together with the NHSN Dialysis Event Protocol for outpatient haemodialysis surveillance. WHO Guidelines on Core Components of Infection Prevention and Control Programmes (2016).',
    url: 'https://www.cdc.gov/nhsn/pdfs/pscmanual/2psc_identifyinghais_nhsncurrent.pdf',
  },
  'phlebitis': {
    ref: INS9 + ', Standard 46: Phlebitis — grading scale and the revised post-infusion phlebitis window of 48–96 hours after catheter removal (previously 48 hours in the 8th edition).',
    url: U_INS,
  },
  'accidental catheter dislodgement': {
    ref: INS9 + ', Standard 39 (Vascular Access Device Securement) and Standard 45 (Vascular Access Device Removal). Incidence-density method per Lorente L, et al. Accidental catheter removal in critically ill patients: a prospective and observational study. Crit Care. 2004;8(4):R229–R233.',
    url: U_INS,
  },
  'accidental de lining of catheter': {
    ref: INS9 + ', Standard 39 (Vascular Access Device Securement) and Standard 45 (Vascular Access Device Removal). Incidence-density method per Lorente L, et al. Accidental catheter removal in critically ill patients: a prospective and observational study. Crit Care. 2004;8(4):R229–R233.',
    url: U_INS,
  },
  'accidental removal of catheter': {
    ref: INS9 + ', Standard 39 (Vascular Access Device Securement) and Standard 45 (Vascular Access Device Removal). Incidence-density method per Lorente L, et al. Accidental catheter removal in critically ill patients: a prospective and observational study. Crit Care. 2004;8(4):R229–R233.',
    url: U_INS,
  },
  'accidental removal of ett tube': {
    ref: "Children's Hospitals' Solutions for Patient Safety (SPS). Unplanned Extubation prevention bundle — operational definition and network goal of ≤0.95 unplanned extubations per 100 ventilator-days (introduced May 2018). Rate expressed per 100 ventilator-days per the established ICU/NICU/PICU surveillance convention.",
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10753604/',
  },
  'hospital acquired pressure ulcer hapu': {
    ref: 'European Pressure Ulcer Advisory Panel, National Pressure Injury Advisory Panel and Pan Pacific Pressure Injury Alliance. Prevention and Treatment of Pressure Ulcers/Injuries: Clinical Practice Guideline, 3rd edition (2019) — international staging system and incidence measurement. AHRQ. Preventing Pressure Ulcers in Hospitals: A Toolkit for Improving Quality of Care, Tool 5: How Do We Measure Our Pressure Ulcer Rates?',
    url: 'https://www.ahrq.gov/patient-safety/settings/hospital/resource/pressureulcer/tool/put5.html',
  },
  'deep vein thrombosis dvt': {
    ref: 'AHRQ Quality Indicators. Patient Safety Indicator 12 (PSI-12): Perioperative Pulmonary Embolism or Deep Vein Thrombosis Rate — Technical Specifications, version 2025 (CBE/NQF #0450).',
    url: 'https://qualityindicators.ahrq.gov/Downloads/Modules/PSI/V2025/TechSpecs/PSI_12_Perioperative_Pulmonary_Embolism_or_Deep_Vein_Thrombosis_Rate.pdf',
  },
  'in patient fall': {
    ref: 'Patient Fall Rate (CBE/NQF #0141) — all documented falls per 1 000 patient-days on eligible inpatient units; developed for the National Database of Nursing Quality Indicators (NDNQI), measure copyright American Nurses Association, now maintained under the Partnership for Quality Measurement. Related current electronic measure: CMS Hospital Harm – Falls with Injury (CMS1017v2, 2026 reporting period).',
    url: 'https://ecqi.healthit.gov/ecqm/hosp-inpt/2026/cms1017v2',
  },
  'out patient fall': {
    ref: 'Adapted from Patient Fall Rate (CBE/NQF #0141). Note: that national measure is specified for INPATIENT units with a patient-day denominator, and no national out-patient equivalent exists — out-patient falls are therefore expressed per 1 000 out-patient visits and the target is set locally by the organisation. Prevention context: AHRQ PSNet Falls patient-safety primer; ' + NABH6 + '.',
    url: 'https://psnet.ahrq.gov/primer/falls',
  },
  'needle stick injury nsi': {
    ref: 'International Safety Center. EPINet Sharps Injury and Blood/Body Fluid Exposure surveillance reports (annual) — per-100-full-time-equivalent rate method. AOHP EXPO-S.T.O.P. national sharps-injury survey (Grimmond T, Good L). Regulatory basis: OSHA Bloodborne Pathogens Standard, 29 CFR 1910.1030; WHO/ILO guidance on health-worker protection from sharps injury.',
    url: 'https://internationalsafetycenter.org/exposure-data-network-epinet/',
  },
  'hand hygiene compliance': {
    ref: 'World Health Organization. WHO Guidelines on Hand Hygiene in Health Care (2009) — "My 5 Moments for Hand Hygiene"; WHO Hand Hygiene Technical Reference Manual (2009) for the direct-observation method and the opportunity/action denominator. The compliance target is an organisational one: The Joint Commission does not mandate a fixed numeric percentage.',
    url: 'https://www.who.int/publications/i/item/9789241597906',
  },
  'hand hygiene compliance hospital': {
    ref: 'World Health Organization. WHO Guidelines on Hand Hygiene in Health Care (2009) — "My 5 Moments for Hand Hygiene"; WHO Hand Hygiene Technical Reference Manual (2009) for the direct-observation method and the opportunity/action denominator. Hospital-wide roll-up of the departmental observations.',
    url: 'https://www.who.int/publications/i/item/9789241597906',
  },
  'incidence of cautery burn': {
    ref: 'AORN. Guidelines for Perioperative Practice, 2026 edition — Guideline for Safe Use of Surgical Energy Devices (the former Electrosurgery guideline). The 2026 update adds an explicit requirement for a quality-management plan tracking adverse events and near misses involving energy devices, which is what this indicator records. Equipment basis: IEC 60601-2-2 for high-frequency surgical equipment.',
    url: 'https://www.aorn.org/article/whats-new-in-aorns-guideline-for-the-safe-use-of-surgical-energy-devices-2026-update',
  },
  'ot utilization rate': {
    ref: 'Operating-theatre efficiency indicator: utilised theatre time as a percentage of allocated/staffed theatre time. ' + NABH6 + ' — operation-theatre quality indicators; method and reported benchmarks per ' + OT_LIT + '.',
    url: U_OTLIT,
  },
  'percentage of unplanned return to the operating theatre ot': {
    ref: 'Unplanned return to the operating theatre — any unplanned secondary procedure required for a complication arising directly from the index operation during the same admission. ' + NABH6 + ' — operation-theatre quality indicators; definition and reported rates per ' + OT_LIT + '.',
    url: U_OTLIT,
  },
  'percentage of cases with intraoperative change in the planned surgery': {
    ref: 'Proportion of cases in which the surgery actually performed differed from the surgery planned and consented, decided intraoperatively. ' + NABH6 + ' — operation-theatre quality indicators; method and reported rates per ' + OT_LIT + '.',
    url: U_OTLIT,
  },
  'percentage of rescheduled surgeries': {
    ref: 'Proportion of scheduled operations postponed or cancelled and re-listed, against total operations scheduled. ' + NABH6 + ' — operation-theatre quality indicators; method and reported rates per ' + OT_LIT + '.',
    url: U_OTLIT,
  },
  "percentage of compliance with the organization s surgical safety protocol prevention of wrong patient wrong site and wrong surgery": {
    ref: 'World Health Organization. WHO Surgical Safety Checklist and Guidelines for Safe Surgery (2009) — sign-in, time-out and sign-out. Joint Commission International Accreditation Standards for Hospitals, International Patient Safety Goal 4 (correct-site, correct-procedure, correct-patient surgery) and the Universal Protocol. ' + NABH6 + '.',
    url: 'https://www.who.int/teams/integrated-health-services/patient-safety/research/safe-surgery',
  },
  'door to balloon compliance 90 min': {
    ref: '2025 ACC/AHA/ACEP/NAEMSP/SCAI Guideline for the Management of Patients With Acute Coronary Syndromes. Circulation. 2025 — the current guideline frames the target as first-medical-contact-to-device time ≤90 minutes, superseding the 2013 ACCF/AHA STEMI door-to-balloon framing. Legacy accountability measure: CMS/Joint Commission AMI-8a (CMS53v7), Primary PCI Received Within 90 Minutes of Hospital Arrival, CBE/NQF #0163.',
    url: U_ACS,
  },
  'door to cath lab': {
    ref: '2025 ACC/AHA/ACEP/NAEMSP/SCAI Guideline for the Management of Patients With Acute Coronary Syndromes. Circulation. 2025 — STEMI reperfusion pathway; the guideline target is first-medical-contact-to-device time ≤90 minutes, of which the ED door-to-cath-lab interval is the in-hospital component.',
    url: U_ACS,
  },
  'post pci complication': {
    ref: 'American College of Cardiology. NCDR CathPCI Registry data dictionary and outcome definitions — periprocedural complications (bleeding, vascular access, acute kidney injury, stroke, emergency CABG). Society for Cardiovascular Angiography and Interventions (SCAI) consensus definitions for periprocedural myocardial infarction and bleeding.',
    url: 'https://cvquality.acc.org/NCDR-Home/registries/hospital-registries/cathpci-registry',
  },
  'puncture site hematoma': {
    ref: 'American College of Cardiology. NCDR CathPCI Registry — access-site and vascular complication definitions (haematoma, retroperitoneal bleed, pseudoaneurysm, AV fistula). SCAI best-practice consensus on transradial access and femoral access-site bleeding reduction.',
    url: 'https://cvquality.acc.org/NCDR-Home/registries/hospital-registries/cathpci-registry',
  },
  'post procedure complication': {
    ref: 'ACG/ASGE Task Force on Quality in Endoscopy. Quality indicators common to all GI endoscopic procedures. Gastrointest Endosc. 2024 (19 indicators across pre-, intra- and post-procedure domains). Adverse event defined per the ASGE lexicon as an event preventing completion of the planned procedure and/or causing admission, prolonged stay, another procedure requiring sedation, or subsequent medical consultation — classified by timing, attribution and severity.',
    url: 'https://www.giejournal.org/article/S0016-5107(24)03183-3/fulltext',
  },
  'cardiac arrest survival rate': {
    ref: 'American Heart Association. Get With The Guidelines–Resuscitation, the national in-hospital cardiac arrest registry — survival-to-hospital-discharge definition following a pulseless event requiring chest compressions and/or defibrillation. 2025 AHA Guidelines for Cardiopulmonary Resuscitation and Emergency Cardiovascular Care.',
    url: 'https://doi.org/10.1161/CIR.0000000000001372',
  },
  're admission within 48 hours icu': {
    ref: 'Society of Critical Care Medicine, Quality Indicators Committee — unplanned ICU readmission within 48 hours of discharge, listed as an ICU performance indicator. Supporting appraisal: Woldhek AL, et al. Readmission of ICU patients: A quality indicator? J Crit Care. 2017;38:328–334.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/27939901/',
  },
  're intubation within 48 hours icu': {
    ref: 'Epstein SK. What is the optimal rate of failed extubation? Crit Care. 2012;16(1):111 — extubation failure defined as reintubation within 48–72 hours. Supported by the ATS/CHEST Clinical Practice Guideline on Liberation from Mechanical Ventilation in Critically Ill Adults.',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3396264/',
  },
  'dialysis adequacy urr': {
    ref: 'National Kidney Foundation. KDOQI Clinical Practice Guideline for Hemodialysis Adequacy: 2015 Update. Am J Kidney Dis. 2015;66(5):884–930 — urea reduction ratio and spKt/V targets for thrice-weekly haemodialysis.',
    url: 'https://www.ajkd.org/article/S0272-6386(15)01019-7/fulltext',
  },
  'vascular access complication': {
    ref: 'National Kidney Foundation. KDOQI Clinical Practice Guideline for Vascular Access: 2019 Update. Am J Kidney Dis. 2020;75(4)(suppl 2):S1–S164 — access complication definitions (thrombosis, stenosis, infection, aneurysm, steal syndrome).',
    url: 'https://www.ajkd.org/article/S0272-6386(19)31137-0/fulltext',
  },
  'intradialytic hypotension': {
    ref: 'National Kidney Foundation. KDOQI Clinical Practice Guidelines for Cardiovascular Disease in Dialysis Patients (2005), Guideline 13: intradialytic hypotension. Working definition: a fall in systolic blood pressure of ≥20 mmHg or in mean arterial pressure of ≥10 mmHg accompanied by symptoms requiring intervention, per the European Best Practice Guideline on haemodynamic instability in haemodialysis.',
    url: 'https://kidneyfoundation.cachefly.net/professionals/KDOQI/guidelines_cvd/intradialytic.htm',
  },
  'water quality compliance': {
    ref: 'ANSI/AAMI/ISO 23500 series — Preparation and quality management of fluids for haemodialysis and related therapies: ISO 23500-3:2024, Water for haemodialysis and related therapies (superseding the 2019 edition and the former ISO 13959), and ANSI/AAMI/ISO 23500-5:2019, Quality of dialysis fluid (formerly ISO 11663), setting the chemical and microbiological limits and the monitoring frequency. CDC recommendations for water use and testing in dialysis; CMS ESRD Conditions for Coverage, 42 CFR Part 494.',
    url: 'https://www.cdc.gov/dialysis-safety/hcp/recommendations-resources/water-use-in-dialysis.html',
  },
  'partograph compliance': {
    ref: 'World Health Organization. WHO Labour Care Guide: User\'s Manual (2020, ISBN 9789240017566), which replaces the earlier partograph; WHO recommendations: intrapartum care for a positive childbirth experience (2018, ISBN 9789241550215). ' + NABH6 + '.',
    url: 'https://www.who.int/publications/i/item/9789240017566',
  },
  'fetal heart rate monitoring compliance': {
    ref: 'ACOG Clinical Practice Guideline No. 10: Intrapartum Fetal Heart Rate Monitoring — Interpretation and Management (October 2025), which replaces the retired Practice Bulletins No. 106 (2009) and No. 116 (2010). NICE NG229: Fetal monitoring in labour (2022). FIGO consensus guidelines on intrapartum fetal monitoring (2015).',
    url: 'https://www.nice.org.uk/guidance/ng229/chapter/Recommendations',
  },
  'average length of stay at the emergency department': {
    ref: 'Centers for Medicare & Medicaid Services. Hospital Outpatient Quality Reporting Program — ED-Throughput measure OP-18: Median Time from Emergency Department Arrival to ED Departure for Discharged ED Patients. Contextual targets: NHS England four-hour A&E standard; American College of Emergency Physicians policy resources on ED crowding and boarding.',
    url: 'https://www.cms.gov/medicare/quality/hospital-outpatient-quality-reporting-program',
  },
  /* Currently hidden by the overlay in every department, so they do not appear in the
     manual — cited anyway so that re-enabling one does not reintroduce a blank reference. */
  'medication administration error': {
    ref: 'National Coordinating Council for Medication Error Reporting and Prevention (NCC MERP) — definition of a medication error and the NCC MERP Index for Categorizing Medication Errors (categories A–I, from circumstances with capacity to cause error through to error contributing to death). Institute for Safe Medication Practices (ISMP) Targeted Medication Safety Best Practices for Hospitals. ' + NABH6 + '.',
    url: 'https://www.nccmerp.org/about-medication-errors',
  },
  'cardiac arrest events': {
    ref: 'American Heart Association. Get With The Guidelines–Resuscitation, the national in-hospital cardiac arrest registry — an event is pulselessness requiring chest compressions and/or defibrillation (a resuscitation/code-blue activation), excluding patients with a do-not-resuscitate order who did not receive CPR. 2025 AHA Guidelines for CPR and Emergency Cardiovascular Care.',
    url: 'https://doi.org/10.1161/CIR.0000000000001372',
  },
  'return of patient within 72 hours same complaint excl lama': {
    ref: 'Unscheduled return visit to the emergency department within 72 hours for the same complaint — an established ED care-quality and safety-net indicator used to detect missed diagnosis and premature discharge. American College of Emergency Physicians resources on ED quality measurement; ' + NABH6 + ' emergency-services quality indicators. Patients who left against medical advice (LAMA/DAMA) are excluded from the numerator.',
    url: 'https://www.acep.org/administration/quality',
  },
};

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

(async () => {
  const apply = process.argv.includes('--apply');
  const db = await getDbHandle();
  if (!db) { console.error('No DB (MONGODB_URI not set).'); process.exit(1); }

  const depCol = db.collection('departments');
  const appCol = db.collection('appdata');
  const fmlCol = db.collection('qualityFormulas');
  const RAW = 'unico_quality_v2';

  const backup = { when: new Date().toISOString(), departments: [], qualityFormulas: [], appdata: null };
  const unmatched = new Set(); const touched = {}; let deptWrites = 0, fmlWrites = 0;

  /* ---------- department indicator copies ---------- */
  const deps = await depCol.find({ 'quality.key': { $exists: true } }).toArray();
  for (const dep of deps) {
    const inds = dep.quality.indicators || [];
    let changed = false;
    const next = inds.map((ind) => {
      const hit = REFS[norm(ind.name)];
      if (!hit) { unmatched.add(ind.name); return ind; }
      if (ind.reference === hit.ref && ind.referenceUrl === hit.url) return ind;
      changed = true;
      touched[ind.name] = (touched[ind.name] || 0) + 1;
      return Object.assign({}, ind, { reference: hit.ref, referenceUrl: hit.url });
    });
    if (!changed) continue;
    if (apply) {
      backup.departments.push({ _id: dep._id, indicators: inds });
      await depCol.updateOne({ _id: dep._id }, { $set: { 'quality.indicators': next } });
    }
    deptWrites++;
  }

  /* ---------- qualityFormulas master ---------- */
  const formulas = await fmlCol.find({}).toArray();
  for (const f of formulas) {
    const names = [f.canonicalName].concat(f.aliases || []).map(norm);
    const key = names.find((n) => REFS[n]);
    if (!key) continue;
    const hit = REFS[key];
    if (f.reference === hit.ref && f.referenceUrl === hit.url) continue;
    if (apply) {
      backup.qualityFormulas.push(f);
      await fmlCol.updateOne({ _id: f._id }, { $set: { reference: hit.ref, referenceUrl: hit.url, updatedAt: Date.now(), updatedBy: 'reference refresh 2026-08' } });
    }
    fmlWrites++;
  }

  /* ---------- overlay: an old reference in a patch/added copy would mask the fix ---------- */
  const shared = await appCol.findOne({ _id: 'shared' });
  let overlay = null;
  try { overlay = shared && shared.data && shared.data[RAW] ? JSON.parse(shared.data[RAW]) : null; } catch (e) { overlay = null; }
  let ovChanged = 0;
  if (overlay && overlay.depts) {
    Object.keys(overlay.depts).forEach((k) => {
      const o = overlay.depts[k] || {};
      (o.indAdded || []).forEach((a) => {
        const hit = REFS[norm(a.name)];
        if (hit && (a.reference !== hit.ref || a.referenceUrl !== hit.url)) { a.reference = hit.ref; a.referenceUrl = hit.url; ovChanged++; }
      });
      Object.keys(o.indPatches || {}).forEach((id) => {
        const p = o.indPatches[id];
        if (p && (p.reference !== undefined || p.referenceUrl !== undefined)) { delete p.reference; delete p.referenceUrl; ovChanged++; }
      });
    });
  }
  if (apply && ovChanged) {
    backup.appdata = shared;
    await appCol.updateOne({ _id: 'shared' }, { $set: { ['data.' + RAW]: JSON.stringify(overlay), updatedAt: Date.now() } });
  }

  if (apply) {
    const dir = path.join(__dirname, 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'refs-update-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
    fs.writeFileSync(file, JSON.stringify(backup, null, 2));
    console.log('backup ->', file);
  }

  console.log(JSON.stringify({
    mode: apply ? 'APPLIED' : 'DRY RUN',
    citationsDefined: Object.keys(REFS).length,
    departmentDocsUpdated: deptWrites,
    masterFormulaRowsUpdated: fmlWrites,
    overlayEntriesCleaned: ovChanged,
    indicatorsUpdated: Object.keys(touched).length,
    perIndicatorCopies: touched,
    NO_CITATION_DEFINED: [...unmatched],
  }, null, 2));
  process.exit(0);
})().catch((e) => { console.error('failed:', (e && e.stack) || e); process.exit(1); });
