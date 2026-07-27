/* Seed the real "Log Sheet For Night Supervisor 26.07.2026" into the supervisorReports
   collection so the module can be tested end-to-end with realistic data.
   Run: node scripts/seed-supervisor-report.js   (from pc apps/unico-n) */
const path = require('path');
try { require(path.join(__dirname, '..', 'server', 'node_modules', 'dotenv')).config({ path: path.join(__dirname, '..', 'server', '.env') }); } catch (e) { try { require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') }); } catch (_) {} }
const sr = require(path.join(__dirname, '..', 'server', 'supervisor-reports.js'));

const na = (dept, bed, name, age, uhid, consultant, diagnosis, doa, remarks) => ({ dept, bed, name, age, uhid, consultant, diagnosis, doa, remarks });

const report = {
  date: '2026-07-26', shift: 'Night', shiftTime: '8:00 PM - 8:00 AM', supervisorName: 'Zakir Hossain', status: 'submitted',
  newAdmissions: [
    na('Level-10', '1017-A', 'JURAIJ IMAM', '5 Y 2 M 22 D', '202610129', 'Dr. Md. Azizur Rahman Muyaz', 'Post Urethral valve', '26/07/2026 10:30:53 am', '1st POD of Fulguration of PUV and BNI Urethro cystoscopy under GA. Peripheral IV line and urinary catheter in situ. Vitals stable. Today plan for discharge.'),
    na('Level-10', '1011 (birthing suite)', 'B/O: AYESHA SIDDIQUA', '0 D', '202613512', 'Dr. May May', 'P0G1, 38+3 weeks pregnancy, leaking membrane, Hb E trait, mild anemia', '27/07/2026 06:30 am', 'Male baby delivered, wt 2700g. Stool passed, sucking well.'),
    na('Level-10', '1006 (birthing suite)', 'B/O TASMA HALIMA', '0 D', '202613511', 'Dr. May May', '38+ weeks pregnancy with hypothyroidism, Rh-ve for safe confinement', '26/07/2026 11:17 pm', 'Baby alert, sucking well. Urine and stool passed. Female, wt 2500g.'),
    na('Level-10', '1003 (birthing)', 'B/O Tasnim Islam Sanjana', '0 D', '202613510', 'Dr. May May', 'P0G1, 40+1 weeks pregnancy, fibroid uterus', '26/07/2026 11:13 pm', 'Female baby alert, sucking well. Urine and stool passed. Wt 2.710g.'),
    na('Level-9', '910-B', 'MD RAKIB HOSSAIN', '22 Y 6 M 29 D', '20253925', 'Dr. Md. Azizur Rahman Muyaz', 'Varicocele of right Testis G-III', '26/07/2026 10:59:18 am', "1st POD of right subinguinal varicocelectomy with Jaboulay's procedure under SAB. Inf. H/S 100 ml/hr. Stable."),
    na('Level-9', '917-A', 'SINTHIA ISLAM', '34 Y 7 M 18 D', '20269918', 'Dr. Fatema Yasmin', '3rd gravida 39+ weeks with P/H/O 1 C/S with PIH, mild anaemia', '26/07/2026 12:33:11 pm', '1st POD of LUCS. Clinically stable. Vaginal bleeding within normal limit. Dressing clean, dry, intact.'),
    na('Birthing Suit', '1016', 'B/O: SINTHIA ISLAM', '0 Y 0 M 1 D', '202613503', 'Dr. May May Hla Marma', 'Term 39 weeks, AGA 3535 gm female baby', '26/07/2026 04:27:39 pm', 'Pink, reflexes good, temp normal, RR 35, HR 140. APGAR 8/10 & 9/10.'),
    na('Level-9', '917-B', 'REBA AKTER', '36 Y 8 M 2 D', '20253063', 'Dr. Sanjida Rahman', 'Fibroid uterus with P/H/O 1 C/S', '26/07/2026 12:18:21 pm', '1st POD of Total Abdominal Hysterectomy. Conscious, stable. IVF H/S 120 ml/hr.'),
    na('Level-9', '914', 'SURAIYA PARVIN SAYMA', '23 Y 11 M 9 D', '202613041', 'Dr. Fatema Yasmin', 'Term 38 weeks pregnancy', '26/07/2026 07:00:35 pm', 'Admitted for planned LUCS. Clinically stable. Pre-op preparation ongoing.'),
    na('Level-9', '912', 'NYEEM UDDIN SIDDIQUE ADNAN', '39 Y 1 M 17 D', '202613491', 'Dr. Ishtiaq Ahmad', 'Polysomnography', '26/07/2026 09:24:00 pm', 'Admitted for sleep study. Equipment attached 11:30 pm, to be removed 7 am.'),
  ],
  criticalArea: [
    na('CCU', '4', 'DR. SHAH ALI', '61 Y 0 M 14 D', '202613282', 'Prof. Dr. Moeen Uddin Ahmed', 'NSTEMI, newly detected DM', '22/07/2026 04:32:36 pm', 'Conscious, alert, hemodynamically stable. S/P PCI. Puncture site healthy. Plan discharge.'),
    na('C-HDU', '2', 'SUFIA BEGUM', '76 Y 0 M 2 D', '202613314', 'Dr. Tunaggina Afrin Khan', 'NSTEMI with ALVF with cardiogenic shock, anaemia', '23/07/2026 02:21:14 am', 'Conscious, oriented, improving. On room air, SpO2 target 90-92%.'),
    na('HDU', '2', 'Md Momtaz Ali Sheikh', '73 Y', '202610522', 'Dr. Umme Kulsum Chy', 'Metastatic apocrine cancer with bone & lung mets, respiratory distress', '15/07/2026 11:00 pm', 'Awake, stable. On BiPAP 2 hourly alternating with O2. SpO2 91% on 5 L/min. Grade II pressure ulcer over buttock.'),
    na('CCU', '2', 'HASINA FERDOUSI', '62 Y 11 M 19 D', '20266832', 'Dr. Tunaggina Afrin Khan', 'AGE, septicemia, AKI on CKD, HTN, ITP, hypothyroidism', '24/07/2026 07:07:37 pm', 'Shifted from MICU to cabin then back to CCU after chest pain (Troponin I positive 377). GTN infusion ongoing.'),
    na('HDU', '1', 'MD ABDUL MALEQUE', '83 Y 1 M 23 D', '202612181', 'Dr. Umme Kulsum Chy', 'PVD - dry gangrene of left toes (S/P amputation), AKI on CKD, DM, HTN, dementia', '29/06/2026 08:24:06 pm', 'On BiPAP + O2. ~600 mL hemorrhagic pleural fluid aspirated. DNR consent obtained. Today H/D plan.'),
    na('MICU', 'Isolation-1', 'SHAHIDA ARIF', '58 Y', '20268784', 'Dr. Umme Kulsum Chy', 'Pneumonia, tracheobronchitis, ESRD on MHD, UTI, bed sore Stage-2', '15/04/2026', 'Critical. On tracheostomy filter with O2 + CPAP. Hemodialysis done 4 hrs today. Grade II pressure injury over back.'),
    na('MICU', '', 'AFSANA AHMED', '53 Y', '20269579', 'Dr. Mustofa Kamal Chowdhury (Adil)', 'Pancytopenia, urosepsis with aspiration pneumonia, AKI on CKD, S/P tracheostomy', '22/05/2026', 'Conscious. NG feeding reduced. ~7:20 am shifted to MICU for low saturation and CV line.'),
    na('CT-ICU', '3', 'MST. KHADIZA KHATUN', '9 Y', '202611983', 'Prof. Dr. Md. Faizus Sazzad', 'Known case of TOF, unable to walk due to SOBE ~1 year', '18/07/2026 09:11:06 am', 'Critical, on T-piece O2 5 L. CVC, S/C, RT & peritoneal catheter in situ. Grade III pressure sore over buttock.'),
    na('CT-ICU', '3', 'SIRAJUL ISLAM', '57 Y', '202613168', 'Prof. Dr. Md. Faizus Sazzad', 'CAD with TVD', '25/07/2026 10:56:18 am', '1st POD of CABG (3 grafts). Extubated 8 pm, now O2 6 L via face mask. Noradrenaline/Adrenaline/Dopamine ongoing.'),
  ],
  cabinArea: [
    na('Level-10', '1001', 'MOHABBAT ALI SUMON', '45 Y', '202613274', 'Dr. Md. Masudar Rahman', 'Recurrent cholecystitis, DM', '22/07/2026 01:45 am', '1st POD of laparoscopic cholecystectomy. SpO2 93% with O2 2 L. Liquid to soft diet.'),
    na('Level-10', '1004', 'NURUN NAHAR BAGUM', '64 Y', '202611373', 'Dr. Md. Azizur Rahman Muyaz', 'Incisional hernia', '25/07/2026', '2nd POD of hernioplasty. Conscious, stable, tolerating normal diet. Plan discharge today.'),
    na('Level-10', '1005', 'TANZILA AKTER', '28 Y', '202610936', 'Dr. Fatema Yasmin', '2nd gravida, 40+1 weeks with GDM, P/H/O 1 CS', '25/07/2026 03:57 pm', 'VBAC trial ongoing. FM positive, FHR 148-156. RBS 5.2. On diabetic diet.'),
    na('Level-10', '1007', 'SHYAMOLI HALDER', '65 Y 5 M 20 D', '202613385', 'Dr. Ishtiaq Ahmad', 'Generalized weakness', '24/07/2026 06:18 pm', 'Alert, oriented. On renal diet. Plan nephrology review after S. creatinine then discharge.'),
    na('Level-10', '1006', 'TASMA HALIMA', '36 Y 10 M 18 D', '202613383', 'Dr. Fatema Yasmin', '38+ weeks with hypothyroidism, Rh-ve', '24/07/2026', 'NVD done 9:43 pm. Female baby 2500 g, alert, sucking well.'),
    na('Level-10', '1018/B', 'MAHADI HASAN', '3 Y 2 M 4 D', '202611863', 'Prof. Dr. Md. Faizus Sazzad', 'Elective surgical closure (ASD)', '21/07/2026 12:00 pm', '4th POD of surgical closure of ASD by Dacron patch. Stable. CV line removed.'),
    na('Level-10', '1012', 'ULFAT QUADER', '70 Y', '20254570', 'Prof. Dr. Golam Rabbani', 'BPD, DM, HTN, DLP', '27/06/2026 (re-admission)', 'Hemodynamically stable. Physiotherapy done, walked around the floor.'),
    na('Level-10', '1013', 'ANJUMAN ARA', '71 Y 6 M', '202613382', 'Prof. Dr. Mohammad Omar Faruq', 'Hospital acquired pneumonia, AGE, generalised oedema, DM, HTN', '24/07/2026 04:33 pm', 'Shifted from MICU to cabin. Conscious, stable. O2 via nasal cannula 2 L.'),
    na('Level-10', '1016', 'Md Motiur Rahman', '62 Y', '202613347', 'Prof. Dr. Omar Faruq', 'B/L pneumonia with AKI', '23/07/2026 05:00 pm', 'Shifted from MICU. Conscious, stable. SpO2 95% on O2 4 L. Echo done today.'),
    na('Level-10', '1014', 'NILA RANI BISWAS', '60 Y 11 M 14 D', '202613246', 'Dr. Mostofa Kamal Chowdhury (Adil)', 'Rt arm shoulder fracture, DM, HTN', '21/07/2026 04:19 pm', 'Conscious, clinically stable. Inf. Normal Saline at 50 mL/hr.'),
  ],
  lama: [
    { dept: 'Level-05 NICU-1B', name: 'B/O Tahera Akter Tania', age: '1 D', uhid: '202613356', consultant: 'Prof. Dr. Nurunnahar Begum', diagnosis: 'Neonatal jaundice with RH incompatibility', doa: '23/07/2026 05:05 pm', reasonDama: 'Party took the baby home as LAMA (bilirubin 12.0 mg/dL after phototherapy)', billing: 'OK' },
  ],
  discharged: [
    { dept: 'C-HDU', name: 'HABIBUR RAHMAN', age: '25 Y', uhid: '202613468', consultant: 'Prof. Dr. Moeen Uddin Ahmed', diagnosis: '?Chest tightness under evaluation', doa: '25/07/2026 05:42 pm', billing: 'OK' },
    { dept: 'Level-13 Pre-Cath', name: 'MD. MILTON ALI MILU', age: '47 Y 6 M 15 D', uhid: '202612909', consultant: 'Dr. Tunaggina Afrin Khan', diagnosis: 'Recent MI (Ant-Septal), S/P thrombolysed with STK', doa: '24/07/2026 06:48 pm', billing: 'OK' },
    { dept: 'Level-10', name: 'MD OBAIDUL ISLAM', age: '73 Y 7 M 23 D', uhid: '202612749', consultant: 'Dr. Shovon Sayeed', diagnosis: 'Hernia inguinal uncomplicated bilateral', doa: '23/07/2026 11:21 am', billing: 'OK' },
    { dept: 'Level-9', name: 'SHASHATTYA SAHA', age: '12 Y', uhid: '202613449', consultant: 'Brig. Gen. Prof. Shams-ud-Din Elias Khan (Retd)', diagnosis: 'Abdominal pain and vomiting', doa: '25/07/2026 04:08 pm', billing: 'OK' },
  ],
  otTable: [],
  surgeries: [
    { name: 'Sirajul Islam', surgery: 'CABG', surgeon: 'Prof. Dr. Faizus Sazzad', anaesthetist: 'Dr. Masud & Dr. Javed', anaesthesia: 'G/A', note: 'Nothing Special' },
    { name: 'Mohabbat Ali Sumon', surgery: 'Lap Chole', surgeon: 'Dr. Md. Masudar Rahman', anaesthetist: 'Dr. Hasan Murshed', anaesthesia: 'G/A', note: 'Nothing Special' },
    { name: 'Juraij Imam', surgery: 'PUV urethrocystoscopy', surgeon: 'Dr. Md. Azizur Rahman Muyaz', anaesthetist: 'Dr. Hasan Murshed, Dr. Ariful Haque', anaesthesia: 'G/A', note: 'Nothing Special' },
    { name: 'Reba Akter', surgery: 'Total Abdominal Hysterectomy', surgeon: 'Dr. Sanjida Rahman', anaesthetist: 'Dr. Hasan Murshed', anaesthesia: 'SAB', note: 'Nothing Special' },
    { name: 'Sinthia Islam', surgery: 'LUCS', surgeon: 'Dr. Fatema Yasmin', anaesthetist: 'Dr. Hasan Murshed', anaesthesia: 'SAB', note: 'Nothing Special' },
  ],
  interventional: [
    { dept: 'Cath Lab', name: 'Md. Milton Ali Milu', age: '47 Y', uhid: '202612909', consultant: 'Dr. Tunaggina Afrin Khan', procedure: 'Coronary Angiography (CAG)', bed: 'OPD', remarks: 'Nothing Special' },
    { dept: 'Dialysis', name: 'Shahida Arif', age: '58 Y', uhid: '20268784', consultant: 'Brig. Gen. (Retd) Dr. AKM Mijanur Rahman', procedure: 'Hemodialysis', bed: 'MICU', remarks: 'Nothing Special' },
    { dept: 'Dialysis', name: 'Dr. Monir Hossain', age: '61 Y', uhid: '202613113', consultant: 'Brig. Gen. (Retd) Dr. AKM Mijanur Rahman', procedure: 'Hemodialysis', bed: '903', remarks: 'Nothing Special' },
    { dept: 'Dialysis', name: 'MA Majid', age: '81 Y', uhid: '20254847', consultant: 'Brig. Gen. (Retd) Dr. AKM Mijanur Rahman', procedure: 'Hemodialysis', bed: '903', remarks: 'Nothing Special' },
    { dept: 'Dialysis', name: 'Rita Alexander', age: '64 Y', uhid: '202611974', consultant: 'Brig. Gen. (Retd) Dr. AKM Mijanur Rahman', procedure: 'Hemodialysis', bed: '903', remarks: 'Nothing Special' },
    { dept: 'Dialysis', name: 'Rina Begum', age: '60 Y', uhid: '20268750', consultant: 'Brig. Gen. (Retd) Dr. AKM Mijanur Rahman', procedure: 'Hemodialysis', bed: '903', remarks: 'Nothing Special' },
  ],
  radiological: [],
  radiologyCounts: { xray: 20, usg: 11, ct: 3, mri: 6, bmd: 0, mammogram: 0, ecg: 1, echo: 5, uroflow: 1 },
  ventilators: [
    { type: 'Invasive', adult: 1, ped: 0, total: 1, dept: 'MICU', inUse: 1, standby: 0, remarks: '' },
    { type: 'Non-Invasive (CPAP/BiPAP)', adult: 2, ped: 0, total: 2, dept: 'MICU', inUse: 2, standby: 0, remarks: '' },
  ],
  erCensus: { total: 2, admission: 1, discharged: 0, lama: 1, daycare: 0, bid: 0, present: 0, refused: 0, death: 0 },
  general: {
    pickUp: '', drop: '', nvd: 2, cs: 2, death: 0, broughtDead: 0, codeBlue: 0, patientComplaint: 0, medError: 0, doctorComplaint: 0,
    nearMiss: 0, hoToError: 0, sampleError: 0, patientFall: 0, bloodTransfusion: 'MICU Isolation-01', adr: 0,
    plannedDischarge: 5, vipAdmitted: '01 (1003) — Daughter of MD Sir', vipVisits: 0, employeeAdmitted: '',
  },
  pressureSore: [
    { name: 'SHAHIDA ARIF', age: '58 Y', bed: 'MICU Isolation-1', diagnosis: 'Pneumonia, tracheobronchitis; ESRD on MHD', consultant: 'Dr. Umme Kulsum Chy', stage: 'Stage-2 (outside)', remarks: 'Proper care of pressure ulcer continuing.' },
    { name: 'SHABNAM GHANI', age: '72 Y 9 M 16 D', bed: 'Level-09 Bed-913', diagnosis: 'SOB, ascites with oedema', consultant: 'Dr. Masudur Rahman', stage: 'Stage-2 (outside)', remarks: 'Proper care of pressure ulcer continuing.' },
    { name: 'Md Momtaz Ali Sheikh', age: '73 Y', bed: 'Level-13 HDU-2', diagnosis: 'Metastatic apocrine cancer with bone & lung mets', consultant: 'Dr. Umme Kulsum Chy', stage: 'Stage-2 (outside)', remarks: 'Proper care of pressure ulcer continuing.' },
  ],
  phlebitis: [],
  absenteeism: '', sickLeave: '',
  roundObservation: 'During round there is no complaint; all patients and their parties are satisfactory.',
  census: { 'OPD Total': 97, 'NICU': 0, 'CTVS ICU': 2, 'Level-9': 13, 'Level-10': 19, 'SICU': 0, 'CCU': 3, 'MICU': 4, TOTAL: 138 },
  totals: { newAdmission: 10, discharge: 5, death: 0 },
  sign: { prepared: 'Zakir Hossain', reviewed: '', recommended: '', approved: '' },
};

(async () => {
  try {
    // Update in place if a report for this date+shift already exists (idempotent).
    const existing = (await sr.getReports({ date: report.date, shift: report.shift }))[0];
    if (existing) report.id = existing.id;
    const saved = await sr.saveReport(report);
    console.log((existing ? 'Updated' : 'Seeded') + ' supervisor report:', saved.id, '(' + saved.date + ' ' + saved.shift + ')');
    console.log('New admissions:', saved.newAdmissions.length, '| Critical:', saved.criticalArea.length, '| Cabin:', saved.cabinArea.length, '| Surgeries:', saved.surgeries.length);
  } catch (e) { console.error('Seed failed:', e.message || e); process.exitCode = 1; }
  process.exit();
})();
