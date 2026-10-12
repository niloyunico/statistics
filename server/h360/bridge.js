// The shift supervisor report (server/supervisor-reports.js, what New Report
// edits) and the H360 log sheet are the same paper sheet in two shapes. This
// turns one into the other, so that a supervisor report can be filled in from
// H360 with the log sheet's own logic and printed as the Word log sheet.
//
// toSheet keeps each original row with its copy (_r), and fromSheet lays the
// changes back over it: a column the log sheet does not know (custom fields,
// the department chosen from the app's list) is never lost on the way.
const { SECTIONS, GENERAL_ITEMS, titleFor } = require('./schema');

const text = (value) => (value === null || value === undefined ? '' : String(value).trim());
const pad2 = (n) => String(n).padStart(2, '0');
const filled = (row) => Object.entries(row || {}).some(([key, value]) => key.charAt(0) !== '_' && typeof value !== 'object' && text(value));

// report key, sheet section, and the columns that are named differently: [report, sheet]
const LISTS = [
  { key: 'newAdmissions', id: 'newAdmissions', patient: true },
  { key: 'criticalArea', id: 'critical', patient: true },
  { key: 'cabinArea', id: 'ward', patient: true },
  { key: 'lama', id: 'lama', patient: true, renamed: [['reasonDama', 'reason']] },
  { key: 'discharged', id: 'discharged', patient: true },
  { key: 'otTable', id: 'surgeryList', renamed: [['cancelledReason', 'cancelled']] },
  { key: 'surgeries', id: 'surgeries', renamed: [['anaesthetist', 'anesthesiologist'], ['anaesthesia', 'anesthesia']] },
  { key: 'interventional', id: 'procedures' },
  { key: 'radiological', id: 'radProcedures' },
  { key: 'pressureSore', id: 'pressureSores' },
  { key: 'phlebitis', id: 'phlebitis', renamed: [['vipScore', 'vip']] },
];
const BY_ID = Object.fromEntries(SECTIONS.map((section) => [section.id, section]));

// The lines of General Information, in the order of the sheet (null: its spare line).
const GENERAL_KEYS = [
  'pickUp', 'drop', 'nvd', 'cs', 'death', 'broughtDead', 'codeBlue', 'patientComplaint', 'medError', 'doctorComplaint', 'nearMiss',
  'hoToError', 'sampleError', 'patientFall', 'bloodTransfusion', 'adr', 'plannedDischarge', null, 'vipAdmitted', 'vipVisits', 'employeeAdmitted',
];
const ER_KEYS = ['total', 'admission', 'discharged', 'lama', 'daycare', 'bid', 'present', 'refused', 'death'];
const VENTILATOR = [['adult', 'adult'], ['ped', 'pediatric'], ['total', 'total'], ['dept', 'department'], ['inUse', 'inUse'], ['standby', 'standBy'], ['remarks', 'remarks']];

// "Nurse Station L-10" -> "Level-10"; "Nursing Services - MICU" -> "MICU"; "Nurse Station L-10(Birthing Suite)" -> "Level-10 (Birthing Suite)"
function deptOf(station) {
  return text(station)
    .replace(/^(Nurse Station|Nursing Services)\s*[-–]?\s*/i, '')
    .replace(/\bL-?\s?(\d+)\b/gi, (_, n) => 'Level-' + Number(n))
    .replace(/\(/g, ' (').replace(/\s+/g, ' ').trim();
}

// "IPD Cabin Level 10" -> "Level-10", as the sheet writes a floor.
const floorOf = (dept) => { const m = text(dept).match(/level[\s-]*(\d+)/i); return m ? 'Level-' + pad2(m[1]) : text(dept); };

function sheetRow(list, row) {
  const section = BY_ID[list.id];
  const renamed = new Map((list.renamed || []).map(([mine, theirs]) => [theirs, mine]));
  const out = {};
  for (const column of section.columns) out[column.key] = text(row[renamed.get(column.key) || column.key]);
  // The sheet writes the floor and the bed in one box.
  if (list.patient) out.dept = [floorOf(row.dept), text(row.bed)].filter(Boolean).join('\n');
  return out;
}

// A supervisor report as a log sheet: { date, shift, title, data, preparedBy }.
function toSheet(report) {
  const data = {};
  for (const section of SECTIONS) data[section.id] = { rows: section.defaults ? section.defaults.map((row) => ({ ...row })) : section.single ? [{}] : [], fields: {} };

  for (const list of LISTS) {
    data[list.id].rows = (Array.isArray(report[list.key]) ? report[list.key] : []).map((row) => {
      const copy = sheetRow(list, row || {});
      return { ...copy, _r: row || {}, _was: { ...copy } };
    });
  }

  const counts = report.radiologyCounts || {};
  const others = [['ecg', 'ECG'], ['echo', 'Echo'], ['uroflow', 'Uroflometry']].filter(([key]) => text(counts[key])).map(([key, label]) => `${label}-${text(counts[key])}`);
  data.radCounts.rows = [{ ...Object.fromEntries(['xray', 'usg', 'ct', 'mri', 'bmd', 'mammogram'].map((key) => [key, text(counts[key])])), others: [text(counts.others), ...others].filter(Boolean).join(', ') }];

  const machines = Array.isArray(report.ventilators) ? report.ventilators : [];
  const nonInvasive = machines.find((row) => /non/i.test(text(row && row.type)));
  const invasive = machines.find((row) => row !== nonInvasive && text(row && row.type)) || machines.find((row) => row !== nonInvasive);
  data.ventilator.rows = data.ventilator.rows.map((row, i) => {
    const mine = (i === 0 ? invasive : nonInvasive) || {};
    return { ...row, ...Object.fromEntries(VENTILATOR.map(([key, theirs]) => [theirs, text(mine[key])])) };
  });

  data.er.rows = [Object.fromEntries(ER_KEYS.map((key) => [key, text((report.erCensus || {})[key])]))];

  const general = report.general || {};
  data.general.rows = GENERAL_ITEMS.map((row, i) => {
    const key = GENERAL_KEYS[i];
    if (!key) return { ...row, item: text(general.otherItem), value: text(general.otherValue) };
    return { ...row, value: text(general[key]) || row.value };
  });

  const count = (value) => (/^\d+$/.test(text(value)) ? text(value) : text(value) ? '' : '0');
  data.staffing.rows = [
    { item: 'Absenteeism', count: count(report.absenteeism), details: /^\d+$/.test(text(report.absenteeism)) ? '' : text(report.absenteeism) },
    { item: 'Sick Leave', count: count(report.sickLeave), details: /^\d+$/.test(text(report.sickLeave)) ? '' : text(report.sickLeave) },
  ];
  data.round.fields = { observation: text(report.roundObservation), time: text(report.shiftTime) };

  const census = report.census || {};
  const units = Object.keys(census).filter((name) => name !== 'OPD Total' && name !== 'TOTAL' && text(census[name]) && text(census[name]) !== '0');
  data.census.rows = units.map((name) => ({ unit: floorOf(name), patients: text(census[name]) }));
  const inPatients = units.reduce((n, name) => n + (Number(census[name]) || 0), 0);
  data.census.fields = { ipd: inPatients ? String(inPatients) : '', opd: text(census['OPD Total']), newAdmission: '', discharge: '', death: '' };

  return {
    date: text(report.date),
    shift: text(report.shift),
    title: titleFor(text(report.shift) || 'Night'),
    data,
    preparedBy: { role: 'Name of Nursing Supervisor', name: text(report.supervisorName) },
  };
}

// The same row in the report's own columns.
function reportRow(list, row) {
  const section = BY_ID[list.id];
  const renamed = new Map((list.renamed || []).map(([mine, theirs]) => [theirs, mine]));
  const was = row._was || null;
  const out = { ...(row._r || {}) };
  for (const column of section.columns) {
    // Only what changed is laid back over a row that was already there.
    if (was && text(row[column.key]) === text(was[column.key])) continue;
    if (list.patient && column.key === 'dept') continue;
    out[renamed.get(column.key) || column.key] = text(row[column.key]);
  }
  if (list.patient && (!was || text(row.dept) !== text(was.dept))) {
    const lines = text(row.dept).split('\n').map(text).filter(Boolean);
    const bed = lines.length > 1 ? lines.pop() : '';
    // From H360: the unit as H360 names it, to be matched to the app's own department list by the screen.
    out.dept = row._station ? deptOf(row._station) : lines.join(' ');
    out.bed = row._station ? text(row.dept).split('\n').pop() : bed;
    if (row._station) out.h360Dept = true;
  }
  if (!row._r) out.h360 = true;
  return out;
}

// What a log sheet says, in the fields of a supervisor report. `before` is the
// sheet as toSheet made it: the numbers are only taken where they changed.
function fromSheet(sheet, before) {
  const data = sheet.data || {};
  const part = (id) => ({ rows: [], fields: {}, ...(data[id] || {}) });
  const old = (id) => ({ rows: [], fields: {}, ...(((before || {}).data || {})[id] || {}) });
  const out = {};

  for (const list of LISTS) out[list.key] = part(list.id).rows.filter((row) => row._r || filled(row)).map((row) => reportRow(list, row));

  const changedCells = (id, index, keys) => {
    const now = part(id).rows[index] || {};
    const was = old(id).rows[index] || {};
    return keys.filter(([, theirs]) => text(now[theirs]) !== text(was[theirs])).map(([mine, theirs]) => [mine, text(now[theirs])]);
  };

  out.general = {};
  part('general').rows.forEach((row, i) => {
    const key = GENERAL_KEYS[i];
    const was = old('general').rows[i] || {};
    if (before && text(row.value) === text(was.value) && text(row.item) === text(was.item)) return;
    if (key) { if (text(row.value) && text(row.value) !== '0') out.general[key] = text(row.value); }
    else if (text(row.item) || (text(row.value) && text(row.value) !== '0')) { out.general.otherItem = text(row.item); out.general.otherValue = text(row.value); }
  });

  out.ventilators = [];
  part('ventilator').rows.forEach((row, i) => {
    const cells = before ? changedCells('ventilator', i, VENTILATOR) : VENTILATOR.map(([mine, theirs]) => [mine, text(row[theirs])]).filter(([, value]) => value);
    if (cells.length) out.ventilators.push({ type: text(row.type), ...Object.fromEntries(cells) });
  });

  if (!before) {
    const counts = part('radCounts').rows[0] || {};
    out.radiologyCounts = Object.fromEntries(['xray', 'usg', 'ct', 'mri', 'bmd', 'mammogram', 'others'].filter((key) => text(counts[key])).map((key) => [key, text(counts[key])]));
    const er = part('er').rows[0] || {};
    out.erCensus = Object.fromEntries(ER_KEYS.filter((key) => text(er[key])).map((key) => [key, text(er[key])]));
    const staff = part('staffing').rows;
    const line = (row) => [text((row || {}).count) === '0' ? '' : text((row || {}).count), text((row || {}).details)].filter(Boolean).join(' - ');
    out.absenteeism = line(staff[0]);
    out.sickLeave = line(staff[1]);
    out.roundObservation = text(part('round').fields.observation);
    out.shiftTime = text(part('round').fields.time);
    out.census = Object.fromEntries(part('census').rows.filter((row) => text(row.unit)).map((row) => [text(row.unit), text(row.patients)]));
    if (text(part('census').fields.opd)) out.census['OPD Total'] = text(part('census').fields.opd);
    out.supervisorName = text((sheet.preparedBy || {}).name);
    out.date = text(sheet.date);
    out.shift = text(sheet.shift);
  }
  return out;
}

// Diagnosis and remarks typed in an earlier supervisor report, by UHID.
function carriedFrom(report) {
  const carried = new Map();
  if (!report) return carried;
  for (const list of LISTS.filter((item) => item.patient)) {
    for (const row of Array.isArray(report[list.key]) ? report[list.key] : []) {
      const uhid = text(row && row.uhid);
      if (uhid && !carried.has(uhid)) carried.set(uhid, { diagnosis: text(row.diagnosis), remarks: text(row.remarks) });
    }
  }
  return carried;
}

module.exports = { toSheet, fromSheet, carriedFrom, deptOf, LISTS };
