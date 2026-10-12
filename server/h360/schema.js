// The supervisor log sheet, section by section, following the final format
// ("Log Sheet For Night Supervisor"). The editor page is drawn from this
// description; the Word file and the print view use it for columns and widths.
// Column widths are parts of 120 across the page: each section's widths
// (with its serial number column) add up to 120, except where noted.
// "{n}" in a title is replaced by the number of filled rows.

const SHIFTS = ['Morning', 'Evening', 'Night'];

const patientColumns = () => [
  { key: 'dept', label: 'Dept & Bed', width: 9 },
  { key: 'name', label: 'Name of Patient', width: 16 },
  { key: 'age', label: 'Age', width: 6 },
  { key: 'uhid', label: 'UHID', width: 10 },
  { key: 'consultant', label: 'Consultant', width: 15 },
  { key: 'diagnosis', label: 'Diagnosis', width: 18 },
  { key: 'doa', label: 'DOA', width: 9 },
  { key: 'remarks', label: 'Remarks', width: 34 },
];

const GENERAL_ITEMS = [
  { item: 'Pick Up' },
  { item: 'Drop' },
  { item: 'Birth – Mode of Delivery', sub: 'NVD' },
  { item: 'Birth – Mode of Delivery', sub: 'CS' },
  { item: 'Death' },
  { item: 'Brought Dead' },
  { item: 'Code Blue' },
  { item: '(Patient Complaint)' },
  { item: 'Med. Error' },
  { item: 'Doctors’ complaint' },
  { item: 'Near Miss & Incident' },
  { item: 'H/O & T/O Error' },
  { item: 'Sample Error' },
  { item: 'No of Patient Fall' },
  { item: 'Blood Transfusion (Bed No)' },
  { item: 'ADR' },
  { item: 'Planned Discharges' },
  { item: '', value: '' }, // the spare line (17) of the sheet
  { item: 'VIP Admitted' },
  { item: 'VIP Visits' },
  { item: 'Hospital Employee Admitted' },
].map((row) => ({ sub: '', value: '0', ...row }));

const SECTIONS = [
  { id: 'newAdmissions', title: 'New Admission:{n}', count: 'rows', patients: true, serial: { label: 'S/N', width: 3 }, columns: patientColumns() },
  // The two lists below continue under the New Admission column headings, as on the sheet.
  { id: 'critical', title: 'Patient in Critical Areas: Total -{n}', count: 'rows', patients: true, noHeader: true, serial: { label: 'S/N', width: 3 }, columns: patientColumns() },
  { id: 'ward', title: 'Patient in Cabin Areas: Total {n}', count: 'rows', patients: true, noHeader: true, serial: { label: 'S/N', width: 3 }, columns: patientColumns() },
  {
    id: 'lama', title: 'LAMA :{n}', count: 'rows', patients: true, minRows: 2, serial: { label: 'S/N', width: 3 },
    columns: [
      { key: 'dept', label: 'Dept', width: 9 },
      { key: 'name', label: 'Name of Patient', width: 16 },
      { key: 'age', label: 'Age', width: 6 },
      { key: 'uhid', label: 'UHID', width: 10 },
      { key: 'consultant', label: 'Consultant', width: 15 },
      { key: 'diagnosis', label: 'Diagnosis', width: 16 },
      { key: 'doa', label: 'DOA', width: 11 },
      { key: 'reason', label: 'Reason for LAMA', width: 16 },
      { key: 'billing', label: 'Billing Clearance', width: 18 },
    ],
  },
  {
    id: 'discharged', title: 'Discharged:{n}', count: 'rows', patients: true, serial: { label: 'S/N', width: 3 },
    columns: [
      { key: 'dept', label: 'Dept.', width: 9 },
      { key: 'name', label: 'Name of Patient', width: 15 },
      { key: 'age', label: 'Age', width: 7 },
      { key: 'uhid', label: 'UHID', width: 10 },
      { key: 'consultant', label: 'Consultant', width: 18 },
      { key: 'diagnosis', label: 'Diagnosis', width: 19 },
      { key: 'doa', label: 'DOA', width: 10 },
      { key: 'billing', label: 'Billing Clearance', width: 29 },
    ],
  },
  {
    id: 'surgeryList', title: 'Surgery List:', minRows: 1, serial: { label: 'S/N', width: 5 },
    columns: [
      { key: 'ot', label: 'OT', width: 10 },
      { key: 'planned', label: 'Planned Cases', width: 13 },
      { key: 'added', label: 'Added/Emergency Cases', width: 38 },
      { key: 'cancelled', label: 'Reason of Cancelled Cases', width: 14 },
      { key: 'total', label: 'Total Cases', width: 11 },
      { key: 'billing', label: 'Billing Status', width: 29 },
    ],
  },
  {
    id: 'surgeries', title: 'Surgery Details:{n}', count: 'rows', serial: { label: 'S/N', width: 5 },
    columns: [
      { key: 'name', label: 'Name of Patient', width: 22 },
      { key: 'surgery', label: 'Name of Surgery', width: 17, align: 'left' },
      { key: 'surgeon', label: 'Name of Surgeon', width: 14 },
      { key: 'anesthesiologist', label: 'Name of Anesthesiologist', width: 16 },
      { key: 'anesthesia', label: 'Type of Anesthesia', width: 16, align: 'left' },
      { key: 'note', label: 'Special Note', width: 30 },
    ],
  },
  {
    id: 'procedures', title: 'Interventional Procedure:(Cath Lab, Endoscopy, Dialysis etc.)-{n}', count: 'rows', serial: { label: 'S/N', width: 5 },
    columns: [
      { key: 'dept', label: 'Dept.', width: 10 },
      { key: 'name', label: 'Name of Patient', width: 19 },
      { key: 'age', label: 'Age', width: 5 },
      { key: 'uhid', label: 'UHID', width: 10 },
      { key: 'consultant', label: 'Consultant', width: 20, align: 'left' },
      { key: 'procedure', label: 'Name of Procedure', width: 21 },
      { key: 'bed', label: 'Location', width: 8 },
      { key: 'remarks', label: 'Remarks', width: 22 },
    ],
  },
  {
    id: 'radProcedures', title: 'Radiological Interventional Procedure:', minRows: 1, serial: { label: 'S/N', width: 5 },
    columns: [
      { key: 'dept', label: 'Department', width: 10 },
      { key: 'name', label: 'Name of Patient', width: 13 },
      { key: 'age', label: 'Age', width: 16 },
      { key: 'uhid', label: 'UHID', width: 14 },
      { key: 'procedure', label: 'Name of Procedure', width: 22 },
      { key: 'bed', label: 'Bed No', width: 40 },
    ],
  },
  {
    // One row of "name | number" boxes.
    id: 'radCounts', title: 'Radiological Diagnostic Procedure:', layout: 'pairs', single: true,
    columns: [
      { key: 'xray', label: 'X-ray-', width: 7, valueWidth: 8 },
      { key: 'usg', label: 'USG', width: 7, valueWidth: 6 },
      { key: 'ct', label: 'CT-Scan', width: 8, valueWidth: 8 },
      { key: 'mri', label: 'MRI', width: 10, valueWidth: 6 },
      { key: 'bmd', label: 'BMD', width: 11, valueWidth: 6 },
      { key: 'mammogram', label: 'Mammogram', width: 13, valueWidth: 6 },
      { key: 'others', label: 'Others (ECG, Echo ...)', width: 0, valueWidth: 24, align: 'left' },
    ],
  },
  {
    id: 'ventilator', title: 'Ventilator Status:', fixedRows: true, readOnly: ['type'],
    defaults: [{ type: 'Invasive' }, { type: 'Non-Invasive (CPAP/BiPAP)' }],
    columns: [
      { key: 'type', label: 'Type of Ventilation', width: 23, align: 'left' },
      { key: 'adult', label: 'Adult', width: 11, align: 'left' },
      { key: 'pediatric', label: 'Pediatric', width: 13, align: 'left' },
      { key: 'total', label: 'Total', width: 10, align: 'left' },
      { key: 'department', label: 'Department', width: 12, align: 'left' },
      { key: 'inUse', label: 'In Use', width: 11 },
      { key: 'standBy', label: 'Stand By', width: 12 },
      { key: 'remarks', label: 'Remarks', width: 28 },
    ],
  },
  {
    id: 'er', title: 'ER Census:', single: true,
    columns: [
      { key: 'total', label: 'Total Patient', width: 12 },
      { key: 'admission', label: 'Admission', width: 12 },
      { key: 'discharged', label: 'Discharged', width: 10 },
      { key: 'lama', label: 'LAMA', width: 7 },
      { key: 'daycare', label: 'Daycare', width: 12 },
      { key: 'bid', label: 'BID', width: 7 },
      { key: 'present', label: 'Present Patient', width: 15 },
      { key: 'refused', label: 'Refused', width: 15 },
      { key: 'death', label: 'Death', width: 30 },
    ],
  },
  {
    // Numbered 1 to 20 on the sheet. Pressure Sore (21), Phlebitis (23),
    // Absenteeism (24) and Sick Leave (25) follow in the same numbered list.
    id: 'general', title: 'General Information:', fixedRows: true, readOnly: ['item', 'sub'], defaults: GENERAL_ITEMS,
    columns: [
      { key: 'item', label: 'Item', width: 30, align: 'left' },
      { key: 'sub', label: 'Type', width: 12, align: 'left' },
      { key: 'value', label: 'Number / details', width: 78, align: 'left' },
    ],
  },
  {
    id: 'pressureSores', title: 'No. of Patient with Pressure Sore- {n}', count: 'rows', minRows: 2, inGeneral: true, serial: { label: 'S/N', width: 4 },
    columns: [
      { key: 'name', label: 'Name of Patient', width: 12 },
      { key: 'age', label: 'Age', width: 5 },
      { key: 'bed', label: 'Bed No.', width: 9 },
      { key: 'diagnosis', label: 'Diagnosis', width: 22 },
      { key: 'consultant', label: 'Consultant', width: 17 },
      { key: 'stage', label: 'Stage of Ulceration', width: 9 },
      { key: 'remarks', label: 'Remarks', width: 18 },
    ],
  },
  {
    id: 'phlebitis', title: 'No. of patient with Phlebitis', minRows: 1, inGeneral: true, serial: { label: 'S/N', width: 4 },
    columns: [
      { key: 'name', label: 'Name of Patient', width: 12 },
      { key: 'age', label: 'Age', width: 5 },
      { key: 'bed', label: 'Bed No.', width: 9 },
      { key: 'diagnosis', label: 'Diagnosis', width: 22 },
      { key: 'consultant', label: 'Consultant', width: 17 },
      { key: 'vip', label: 'VIP Score', width: 9 },
      { key: 'remarks', label: 'Remarks', width: 18 },
    ],
  },
  {
    id: 'staffing', title: 'Absenteeism and Sick Leave', fixedRows: true, readOnly: ['item'], inGeneral: true,
    defaults: [{ item: 'Absenteeism', count: '0' }, { item: 'Sick Leave', count: '0' }],
    columns: [
      { key: 'item', label: 'Item', width: 14, align: 'left' },
      { key: 'count', label: 'Number', width: 4 },
      { key: 'details', label: 'Name / details', width: 92, align: 'left' },
    ],
  },
  {
    id: 'round', title: 'ROUND OBSERVATION',
    fields: [
      { key: 'observation', label: 'Round observation', long: true },
      { key: 'time', label: 'Time', placeholder: '08:00 PM TO 8:00 AM' },
    ],
  },
  {
    // Drawn sideways on the sheet: OPD first, then each unit, then TOTAL.
    id: 'census', title: 'Total 24 hours',
    columns: [
      { key: 'unit', label: 'Unit', width: 60, align: 'left' },
      { key: 'patients', label: 'Patients', width: 60 },
    ],
    fields: [
      { key: 'ipd', label: 'Total IPD Patient' },
      { key: 'opd', label: 'Total OPD patient' },
      { key: 'newAdmission', label: 'Total New Admission', placeholder: 'counted from New Admission when left empty' },
      { key: 'discharge', label: 'Total Discharge', placeholder: 'counted from Discharged when left empty' },
      { key: 'death', label: 'Total Death', placeholder: 'taken from General Information when left empty' },
    ],
  },
];

// The box beside the logo and at the end of the sheet.
const SIGNATURE = [
  { key: 'role', label: 'Title in the box', fallback: 'Name of Nursing Manager' },
  { key: 'name', label: 'Name' },
];

// Sections whose rows are patients and can be moved from one to another.
const PATIENT_SECTIONS = SECTIONS.filter((section) => section.patients).map((section) => section.id);

const titleFor = (shift) => `Log Sheet for ${shift} Supervisor`;

module.exports = { SHIFTS, SECTIONS, SIGNATURE, PATIENT_SECTIONS, GENERAL_ITEMS, titleFor };
