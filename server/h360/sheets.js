// The H360 log sheets: saved in MongoDB ("h360Sheets" in the app's database),
// filled in from the latest H360 collection and from the previous sheet.
// Everything here works from the shared database, so it is the same on the
// hospital PC and on the live site: each patient carries what the records say
// about them (see suggestionsFrom), worked out when the records were collected.
const { ObjectId } = require('mongodb');
const { SECTIONS, SHIFTS, SIGNATURE, PATIENT_SECTIONS, GENERAL_ITEMS, titleFor } = require('./schema');

const SHEETS = 'h360Sheets';
// H360 writes its times as the hospital's clock shows them.
const HOSPITAL_ZONE = process.env.H360_TZ_OFFSET || '+06:00';
const instant = (stamp) => new Date(stamp.replace(' ', 'T') + HOSPITAL_ZONE);

const CRITICAL_UNIT = /ICU|HDU|CCU|CATH|CTVS|CRITICAL/i;
const ACTIVE_LISTS = ['newAdmissions', 'critical', 'ward'];
const pad2 = (n) => String(n).padStart(2, '0');
const text = (value) => (value === null || value === undefined ? '' : String(value).trim());

// How "Update from H360" treats a report. Diagnosis and remarks each take
// 'empty' (fill only where nothing is written), 'all' (replace) or 'none'.
const UPDATE_DEFAULTS = {
  addNew: true,
  updateDetails: true,
  diagnosis: 'empty',
  remarks: 'empty',
  // The doctor's newest progress note (the nursing note when there is none): what the
  // sheet's Remarks column has always carried. 'nursing' | 'progress' | 'both' | 'handover'
  remarksFrom: 'progress',
  useComplaint: false,
  // Surgery, procedures, pressure sore, ventilator and the counts that H360 records can answer.
  sections: true,
  // The IPD Admission list: who was discharged, left against advice or died, and admissions not on a station list yet.
  register: true,
  // A patient whose discharge has been requested in H360 (the pink rows) goes to Discharged.
  dischargeRequests: true,
};

function updateOptions(sent = {}) {
  const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
  return {
    addNew: sent.addNew === undefined ? UPDATE_DEFAULTS.addNew : Boolean(sent.addNew),
    updateDetails: sent.updateDetails === undefined ? UPDATE_DEFAULTS.updateDetails : Boolean(sent.updateDetails),
    diagnosis: pick(sent.diagnosis, ['empty', 'all', 'none'], UPDATE_DEFAULTS.diagnosis),
    remarks: pick(sent.remarks, ['empty', 'all', 'none'], UPDATE_DEFAULTS.remarks),
    remarksFrom: pick(sent.remarksFrom, ['nursing', 'progress', 'both', 'handover'], UPDATE_DEFAULTS.remarksFrom),
    useComplaint: Boolean(sent.useComplaint),
    sections: sent.sections === undefined ? UPDATE_DEFAULTS.sections : Boolean(sent.sections),
    register: sent.register === undefined ? UPDATE_DEFAULTS.register : Boolean(sent.register),
    dischargeRequests: sent.dischargeRequests === undefined ? UPDATE_DEFAULTS.dischargeRequests : Boolean(sent.dischargeRequests),
  };
}

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function blankData() {
  const data = {};
  for (const section of SECTIONS) {
    data[section.id] = {
      rows: section.defaults ? section.defaults.map((row) => ({ ...row })) : section.single ? [{}] : [],
      fields: {},
    };
  }
  return data;
}

const nextDay = (date) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

// The hours of a shift when the report does not say. A Night report is dated by the
// evening it starts and runs into the next morning. The three must not overlap: every
// shift's period used to start at midnight, so one day's admissions and leavers were
// counted again in every shift report of that day.
const SHIFT_HOURS = { Morning: ['06:00', '14:00'], Evening: ['14:00', '20:00'], Night: ['20:00', '06:00'] };

// "8:00 PM - 8:00 AM", "07:00-15:00", "7am to 3pm" -> ['20:00', '08:00']; null when unreadable.
function shiftHours(shiftTime) {
  const found = [];
  for (const m of text(shiftTime).matchAll(/(\d{1,2})(?::(\d{2}))?\s*([ap])(?:\.?m\b|\.?m\.)?|(\d{1,2}):(\d{2})/gi)) {
    let hour = Number(m[1] !== undefined ? m[1] : m[4]);
    const minute = m[1] !== undefined ? m[2] || '00' : m[5];
    if (m[3]) hour = (hour % 12) + (/p/i.test(m[3]) ? 12 : 0);
    if (hour > 23 || Number(minute) > 59) continue;
    found.push(`${pad2(hour)}:${minute}`);
    if (found.length === 2) break;
  }
  return found.length === 2 && found[0] !== found[1] ? found : null;
}

// The period a report covers: its own shift time when one is written, else the shift's usual hours.
function period(date, shift, shiftTime) {
  const [start, end] = shiftHours(shiftTime) || SHIFT_HOURS[shift] || SHIFT_HOURS.Morning;
  const from = `${date} ${start}:00`;
  const to = `${end <= start ? nextDay(date) : date} ${end}:00`;
  return { from, to, days: [...new Set([from.slice(0, 10), to.slice(0, 10)])] };
}

// The floor of the units whose station name does not say it.
const UNIT_LEVEL = [[/MICU|HDU|CCU|CATH/i, '13'], [/SICU|CT-?ICU|CTVS/i, '07']];
const letters = (value) => text(value).toLowerCase().replace(/[^a-z0-9]/g, '');

// "Nurse Station L-10" + bed "1018/B" -> "Level-10\n1018/B"; "SICU L-7" + "SICU-1" -> "Level-07\nSICU-1"
function deptAndBed(station, bed) {
  const unit = text(station).replace(/Nurse Station|Nursing Services|\bL-?\s?\d+\b/gi, '').replace(/[\s–-]+/g, ' ').trim();
  const named = text(station).match(/\bL-?\s?(\d+)\b/i);
  const known = UNIT_LEVEL.find(([pattern]) => pattern.test(`${unit} ${bed}`));
  const level = named ? pad2(named[1]) : known ? known[1] : '';
  // The sheet writes the floor and the bed ("Level-13 / C-HDU 1"); the unit is
  // only written when there is no floor and the bed's own name does not say it.
  const showUnit = !level && unit && !letters(bed).includes(letters(unit));
  return [level ? `Level-${level}` : '', showUnit ? unit : '', text(bed)].filter(Boolean).join('\n');
}

// "35 Y 0 M 3 D" -> "35Y 0M 3D"
const compactAge = (value) => text(value).replace(/(\d+)\s+([YMD])\b/gi, '$1$2');

// "2026-06-28 23:00:48" -> "28/06/2026 11:00:48 pm"
function admittedAt(value) {
  const match = text(value).match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}):(\d{2}))?/);
  if (!match) return text(value);
  const [, year, month, day, hour, minute, second] = match;
  if (hour === undefined) return `${day}/${month}/${year}`;
  const h = Number(hour);
  return `${day}/${month}/${year} ${pad2(h % 12 || 12)}:${minute}:${second} ${h < 12 ? 'am' : 'pm'}`;
}

// ---- what H360 says about each patient ----

// The newest row of a history table: the text in the first column whose name matches.
function newestCell(doc, pattern) {
  for (const entry of doc.entries) {
    const at = entry.columns.findIndex((name) => pattern.test(name));
    if (at >= 0 && entry.rows[0] && text(entry.rows[0][at])) return text(entry.rows[0][at]);
  }
  return '';
}

const fieldsNamed = (doc, pattern) => doc.values.filter((value) => pattern.test(value.label)).map((value) => text(value.value)).filter(Boolean);

// Per admission: the recorded diagnosis, the presenting complaint, and the
// newest nursing and doctor notes. Later sources only fill what is missing.
function suggestionsFrom(docs) {
  const found = new Map();
  const of = (doc) => {
    if (!found.has(doc.admissionNo)) {
      found.set(doc.admissionNo, {
        diagnosis: '', problemList: '', provisional: '', known: [], complaint: '', nursing: '', progress: '', summary: '', plan: '', breathing: '',
        pressure: '', surgeries: [], cathLab: [], dialysis: [], transfusions: 0,
      });
    }
    return found.get(doc.admissionNo);
  };
  const byKey = (key) => docs.filter((doc) => doc.key === key);
  const doctorDocs = docs.filter((doc) => doc.tab === 'Doctors Tab');

  for (const doc of byKey('problem-list')) of(doc).problemList = newestCell(doc, /problem|diagnos/i);
  // The Doctor Initial Assessment: provisional diagnosis and the pre-existing illness boxes.
  for (const doc of byKey('v2-ipd-patient-assessment')) {
    const entry = of(doc);
    entry.provisional = fieldsNamed(doc, /diagnos/i).join('\n');
    entry.known = preExisting(doc);
  }
  for (const doc of [...byKey('ipd-doctor-shift-handover-edit'), ...byKey('v2-ipd-patient-assessment'), ...doctorDocs]) {
    const entry = of(doc);
    if (!entry.provisional) entry.provisional = fieldsNamed(doc, /diagnos/i).join('\n') || newestCell(doc, /diagnos/i);
    if (!entry.complaint) entry.complaint = fieldsNamed(doc, /complain/i).join('\n');
  }
  for (const doc of [...byKey('v2-ipd-nurse-assessment-adult'), ...byKey('emr-patient-emr')]) {
    const entry = of(doc);
    if (!entry.complaint) entry.complaint = fieldsNamed(doc, /complain/i).join('\n') || newestCell(doc, /complain/i);
  }
  for (const doc of byKey('consultation-note')) of(doc).nursing = newestCell(doc, /^notes?$/i) || newestCell(doc, /note/i);
  for (const doc of byKey('progress-note')) of(doc).progress = newestCell(doc, /detail|note/i);

  // The doctors' latest handover: the clinical summary, what is planned, and oxygen or ventilator support.
  for (const doc of byKey('ipd-doctor-shift-handover-edit')) {
    const entry = of(doc);
    entry.summary = fieldsNamed(doc, /clinical summary/i).join('\n');
    entry.plan = fieldsNamed(doc, /planned intervention/i).join('\n');
    entry.breathing = fieldsNamed(doc, /oxygen/i).join(', ');
  }
  for (const doc of byKey('v2-ipd-nurse-assessment-adult')) {
    const entry = of(doc);
    if (!entry.breathing) entry.breathing = fieldsNamed(doc, /respiratory support/i).join(', ');
    if (fieldsNamed(doc, /pressure injury currently/i).some((value) => /^yes/i.test(value))) entry.pressure = 'Pressure injury noted in the nursing assessment.';
  }
  for (const doc of byKey('skin-care-plan')) {
    const skin = newestCell(doc, /skin condition/i);
    if (skin && !/^intact$/i.test(skin)) of(doc).pressure = `Skin condition: ${skin}.`;
  }

  // Dated events: operations, cath lab sheets, dialysis sessions, transfusions.
  const column = (entry, pattern) => entry.columns.findIndex((name) => pattern.test(name));
  for (const doc of byKey('ot-procedure-note')) {
    for (const entry of doc.entries) {
      const at = (pattern) => column(entry, pattern);
      for (const row of entry.rows) {
        const cell = (pattern) => text(row[at(pattern)]).replace(/^-$/, '');
        of(doc).surgeries.push({
          day: dayOf(cell(/ot date/i)), time: cell(/ot time/i), surgery: cell(/operation name/i) || cell(/ot procedure/i),
          surgeon: cell(/ot surgeon/i), anesthesiologist: cell(/anaesthetist/i), anesthesia: cell(/ot anaesthesia/i),
        });
      }
    }
  }
  const createdDays = (doc) => doc.entries.flatMap((entry) => entry.rows.map((row) => dayOf(row[column(entry, /created/i)])).filter(Boolean));
  for (const doc of byKey('ipd-procedure-sheet-without-sedation-cathlab-list')) of(doc).cathLab = createdDays(doc);
  for (const doc of byKey('ipd-hemodialysis-record-bundle')) of(doc).dialysis = createdDays(doc);
  for (const doc of byKey('ipd-blood-products-transfusion-monitorig-record')) of(doc).transfusions = 1;
  // Only what the log sheet uses is kept with the patient; the records themselves are not.
  const cut = (value, max) => text(value).slice(0, max);
  for (const [admissionNo, entry] of found) {
    found.set(admissionNo, {
      diagnosis: composeDiagnosis(entry), complaint: cut(entry.complaint, 1500), nursing: cut(entry.nursing, 3000), progress: cut(entry.progress, 3000),
      summary: cut(entry.summary, 3000), plan: cut(entry.plan, 1500), breathing: cut(entry.breathing, 300), pressure: entry.pressure,
      surgeries: entry.surgeries.slice(0, 20), cathLab: entry.cathLab.slice(0, 40), dialysis: entry.dialysis.slice(0, 40), transfusions: entry.transfusions,
    });
  }
  return found;
}

// ---- putting the diagnosis together ----

// "1. A 2. B" written on one line, or a bulleted list -> one item per line, without the numbers and bullets.
function listItems(value) {
  return text(value)
    .replace(/\s+(?=\d{1,2}[.)]\s)/g, '\n')
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[•●▪◦*-]+|\d{1,2}[.)])\s*/, '').trim())
    .filter(Boolean);
}

const words = (value) => new Set(text(value).toLowerCase().match(/[a-z0-9]+/g) || []);

// Two lines saying the same thing in slightly different words count as one.
function alreadySaid(lines, candidate) {
  const wanted = words(candidate);
  if (!wanted.size) return true;
  return lines.some((line) => {
    const have = words(line);
    const shared = [...wanted].filter((word) => have.has(word)).length;
    return shared === wanted.size || shared / new Set([...wanted, ...have]).size >= 0.7;
  });
}

// The illnesses ticked under "Pre existing illness / past medical & surgical history".
function preExisting(doc) {
  const items = [];
  for (const value of doc.values) {
    if (/\bind$/i.test(value.label)) {
      if (/diabet/i.test(value.value)) items.push('DM');
      else if (/blood pressure|hypertens/i.test(value.value)) items.push('HTN');
      else if (/heart/i.test(value.value)) items.push('Heart Disease');
      else if (/tubercul/i.test(value.value)) items.push('TB');
    } else if (/others? specify/i.test(value.label)) {
      items.push(...listItems(value.value));
    }
  }
  return items;
}

const MENTIONS = {
  DM: /\bdm\b|diabet/i,
  HTN: /\bhtn\b|hypertens|high blood pressure/i,
  'Heart Disease': /heart disease|\bihd\b|\bcad\b|\bccs\b|\bacs\b|\bmi\b|stemi|cardi|coronary/i,
  TB: /\btb\b|tubercul/i,
  DL: /\bdlp?\b|dyslipid/i,
};

// A Clinical Summary is used as diagnosis when it says so ("Dx: ...", or a "Dx" heading
// with the diagnoses on the lines under it) or when it is a plain list; a summary that
// tells the story of the admission is not, and its headings ("Admission issues:") never are.
const STORY = /\b(admitted|complain|presented|came|history|h\/o|c\/c|since|for \d+ ?(?:day|week|month|hour|yr|year)s?)\b/i;
const HEADING = /^(?:admission issues?|issues?(?: and| &)? progress|past(?: medical)? history|history|plan(?:ned intervention)?|investigations?|inv|treatment|advice|c\/c|chief complaints?|complaints?|o\/e|on examination|progress)\b[^:]{0,40}:?\s*$/i;
const DX_HEAD = /^(?:dx|d\/x|(?:provisional |final |working )?diagnosis)\s*[:–-]?\s*$/i;
const DX_INLINE = /^(?:dx|d\/x|(?:provisional |final |working )?diagnosis)\s*[:–-]\s*(.+)$/i;
// "Plan: CBC" is a heading with its text on the same line; "Fever: 3 days" is not.
const HEADING_START = /^(?:plan(?:ned intervention)?|inv|investigations?|advice|treatment|admission issues?|past(?: medical)? history|history|c\/c|chief complaints?|o\/e|on examination|progress|follow.?up|f\/u)\s*:/i;
const isHeading = (line) => HEADING.test(line) || HEADING_START.test(line) || /:\s*$/.test(line);
function diagnosisInSummary(summary) {
  const lines = listItems(summary);
  const marked = [];
  for (let i = 0; i < lines.length; i++) {
    const inline = lines[i].match(DX_INLINE);
    if (!inline && !DX_HEAD.test(lines[i])) continue;
    if (inline) marked.push(inline[1].split(/\s+(?:admission issue|plan|inv)\b/i)[0].trim().slice(0, 240));
    // The lines under the heading, up to the next heading, are the rest of the diagnosis.
    for (let j = i + 1; j < lines.length && !isHeading(lines[j]) && !DX_HEAD.test(lines[j]) && !DX_INLINE.test(lines[j]); j++) {
      if (lines[j].length <= 120 && !STORY.test(lines[j])) marked.push(lines[j].slice(0, 240));
      else break;
    }
  }
  if (marked.length) return marked;
  const plain = lines.filter((line) => !isHeading(line));
  return plain.length && plain.every((line) => line.length <= 80 && !STORY.test(line)) ? plain : [];
}

// The doctors' Problem List when there is one; otherwise the newest handover's
// Clinical Summary plus the provisional diagnosis. Pre-existing illnesses not
// already mentioned are added at the end.
function composeDiagnosis(entry) {
  const lines = listItems(entry.problemList);
  if (!lines.length) {
    for (const item of [...diagnosisInSummary(entry.summary), ...listItems(entry.provisional)]) {
      if (!alreadySaid(lines, item)) lines.push(item);
    }
  }
  const soFar = lines.join(' ');
  for (const item of entry.known) {
    const name = /^dlp?$/i.test(item) ? 'DL' : item; // "DL" typed under Others means dyslipidaemia
    const said = MENTIONS[name] ? MENTIONS[name].test(soFar) : alreadySaid(lines, item);
    if (!said && !lines.includes(item)) lines.push(item);
  }
  return lines.join('\n').slice(0, 1500);
}

// "05/10/2026" or "11-10-2026 01:49 PM" -> "2026-10-05"
function dayOf(value) {
  const match = text(value).match(/(\d{2})[\/-](\d{2})[\/-](\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
}

function suggestedText(suggestion, options) {
  const s = suggestion || {};
  const diagnosis = (s.diagnosis || (options.useComplaint && s.complaint ? `C/C: ${s.complaint}` : '')).slice(0, 1500);
  const remarks = {
    nursing: s.nursing,
    progress: s.progress || s.nursing,
    both: [s.progress && `Doctor: ${s.progress}`, s.nursing && `Nurse: ${s.nursing}`].filter(Boolean).join('\n'),
    // Falls back to the nursing note for patients without a handover form.
    handover: [s.summary, s.plan && `Plan: ${s.plan}`].filter(Boolean).join('\n') || s.nursing,
  }[options.remarksFrom];
  return { diagnosis, remarks: (remarks || '').slice(0, 3000) };
}

function patientRow(patient, carried, picture, options) {
  const admission = patient.admission || {};
  const old = carried.get(patient.uhid) || {};
  const suggestion = picture.suggestions.get(patient.admissionNo);
  const fresh = suggestedText(suggestion, options);
  const row = {
    dept: deptAndBed(patient.station, admission.bed_name),
    name: text(admission.patient_name),
    age: compactAge((patient.profile || {}).Age),
    uhid: text(patient.uhid),
    consultant: text(admission.primary_doctor_name),
    diagnosis: old.diagnosis || (options.diagnosis === 'none' ? '' : fresh.diagnosis),
    doa: admittedAt(admission.admission_date),
    remarks: old.remarks || (options.remarks === 'none' ? '' : fresh.remarks),
  };
  // Shown in the editor as a suggestion; never printed.
  if (suggestion && suggestion.nursing) row._note = suggestion.nursing;
  // The station as H360 names it, for a report that keeps its department apart from the bed.
  if (patient.station) row._station = text(patient.station);
  return row;
}

// What H360 currently knows, shaped for the report. `span` is the report's period (see period()).
async function hospitalPicture(store, date, shift, shiftTime) {
  await store.ready;
  const span = period(date, shift, shiftTime);
  const run = await store.col('runs').find().sort({ collectedAt: -1 }).limit(1).next();
  if (!run) return { collectedAt: null, patients: [], left: [], register: [], suggestions: new Map(), opd: null, span };
  const patients = await store.col('patients').find({ lastRunId: run._id }).sort({ seq: 1 }).toArray();

  const { from, to } = span;
  const left = await store
    .col('patients')
    .find({ active: false, inactiveSince: { $gte: instant(from), $lte: instant(to) } })
    .toArray();
  // The IPD Admission list, as far as it concerns this shift: admitted or discharged in it, or one of those who left.
  const leftIds = left.map((patient) => text(patient.uhid)).filter(Boolean);
  const register = await store
    .col('register')
    .find({ $or: [
      { 'fields.dischargedAt': { $gte: from, $lte: to } },
      { 'fields.admittedAt': { $gte: from, $lte: to } },
      ...(leftIds.length ? [{ 'fields.uhid': { $in: leftIds } }] : []),
    ] })
    .sort({ 'fields.admittedAt': -1 })
    .limit(2000)
    .toArray();
  const suggestions = new Map([...patients, ...left].filter((patient) => patient.suggestion).map((patient) => [patient.admissionNo, patient.suggestion]));
  // The OPD list of the report's own day, when it was read.
  const opd = await store.col('opd').findOne({ _id: date }, { projection: { rows: 0 } });
  return { collectedAt: run.collectedAt, patients, left, register, suggestions, opd, span };
}

// A row of the IPD Admission list, shaped like a patient of a station list.
function fromRegister(row) {
  const f = row.fields;
  return {
    uhid: text(f.uhid), admissionNo: text(f.admissionNo), station: text(f.ward),
    admission: { bed_name: f.bed, patient_name: f.name, primary_doctor_name: f.consultant, admission_date: f.admittedAt, death_ind: f.outcome === 'death' ? '1' : '0' },
    profile: { Age: f.age },
  };
}

// A patient gone from the station lists left some time between the last collection that
// saw them and the first that did not. That is this shift's leaver when the window begins
// in the shift (or just before it: the previous shift's collection is usually made at the
// hand-over). When the window began long before the shift, nobody can say which shift
// they left in: such a leaver is handed back as "unsure" for the supervisor to place.
const GRACE_MS = 2 * 60 * 60 * 1000;
function leftInShift(patient, span) {
  const seen = patient.lastSeenAt ? new Date(patient.lastSeenAt).getTime() : NaN;
  return !Number.isFinite(seen) || seen >= instant(span.from).getTime() - GRACE_MS;
}

// Everyone who left during the shift and how: gone from the station lists, or
// shown as discharged by the IPD Admission list (which also says who left
// against advice and who died). A patient still on a station list has not left.
// Each leaver carries `sure` (left in this shift) and, when not, the window they left in.
function leavers(picture, date, shift, shiftTime) {
  const span = picture.span || period(date, shift, shiftTime);
  const { from, to } = span;
  const present = new Set(picture.patients.map((patient) => text(patient.uhid)));
  const listed = new Map();
  for (const row of picture.register || []) if (text(row.fields.uhid) && !listed.has(text(row.fields.uhid))) listed.set(text(row.fields.uhid), row);
  const out = new Map();
  for (const patient of picture.left) {
    const row = listed.get(text(patient.uhid));
    const said = row ? row.fields : {};
    const outcome = said.outcome || (String((patient.admission || {}).death_ind) === '1' ? 'death' : 'discharged');
    // The IPD Admission list, when it has the time, settles which shift it was.
    const sure = said.dischargedAt ? said.dischargedAt >= from && said.dischargedAt <= to : leftInShift(patient, span);
    out.set(text(patient.uhid) || patient.admissionNo, {
      patient, outcome, reason: text(said.dischargeType), billing: text(said.billing), sure,
      window: { since: patient.lastSeenAt || null, until: patient.inactiveSince || null },
    });
  }
  for (const row of picture.register || []) {
    const f = row.fields;
    const uhid = text(f.uhid);
    if (!uhid || !f.outcome || !f.dischargedAt || f.dischargedAt < from || f.dischargedAt > to) continue;
    if (present.has(uhid) || out.has(uhid)) continue;
    out.set(uhid, { patient: fromRegister(row), outcome: f.outcome, reason: text(f.dischargeType), billing: text(f.billing), sure: true, window: null });
  }
  return [...out.values()];
}

// Admitted during the shift according to the IPD Admission list, but on no station list (yet, or any more).
function unlistedAdmissions(picture, date, shift, shiftTime) {
  const { from, to } = picture.span || period(date, shift, shiftTime);
  const present = new Set(picture.patients.map((patient) => text(patient.uhid)));
  const seen = new Set();
  return (picture.register || [])
    .filter((row) => {
      const f = row.fields;
      const uhid = text(f.uhid);
      if (!uhid || !text(f.name) || !f.admittedAt || f.admittedAt < from || f.admittedAt > to || present.has(uhid) || seen.has(uhid)) return false;
      seen.add(uhid);
      return true;
    })
    .map(fromRegister);
}

// The row a leaver gets in LAMA or Discharged.
function leaverRow(leaver, row) {
  const { remarks, _note, ...kept } = row;
  return leaver.outcome === 'lama'
    ? { ...kept, reason: leaver.reason, billing: leaver.billing }
    : { ...kept, ...(leaver.billing ? { billing: leaver.billing } : {}) };
}

const INVASIVE = /ventilat|intubat|\bett\b|tracheost|\bmv\b|\bsimv\b|\bimv\b/i;
const NON_INVASIVE = /bipap|bpap|cpap|\bniv\b|non.?invasive|hi.?flow|hfnc/i;
// The handover's oxygen box is often left empty while the notes say "requiring MV D5" or
// "S/P ET tube intubation D2". Only what is said to be CURRENT counts, and not once the
// notes say the tube is out.
const VENTED_NOW = /\b(?:on|requiring|under|needs?|continu(?:e|ed|ing)|still on)\s+(?:mv|mechanical ventilat\w*|invasive ventilat\w*|ventilator(?:y support)?)\b|\b(?:re-?)?intubated\b|\bventilated\b|\bmv\s*d(?:ay)?\s*\d+\b|\b(?:et|ett|endotracheal)\s*tube\b/i;
const NIV_NOW = /\b(?:on|requiring|under|needs?|continu(?:e|ed|ing)|still on)\s+(?:bipap|bpap|cpap|niv|hfnc|hi.?flow|non.?invasive)/i;
const OFF_VENT = /\b(?:s\/p|post|after|following)\s*extubat|\bextubated\b|weaned (?:off|from)|off (?:the )?(?:mv|ventilator)|tube (?:out|removed)/i;
function ventilationOf(s) {
  if (NON_INVASIVE.test(s.breathing)) return 'Non-Invasive (CPAP/BiPAP)';
  if (INVASIVE.test(s.breathing)) return 'Invasive';
  // A box that is filled in ("O2", "Room air", "Nasal cannula") is the answer; only an empty one is read from the notes.
  if (text(s.breathing)) return null;
  const said = [s.diagnosis, s.summary, s.progress].join('\n');
  if (OFF_VENT.test(said)) return null;
  if (VENTED_NOW.test(said)) return 'Invasive';
  if (NIV_NOW.test(said)) return 'Non-Invasive (CPAP/BiPAP)';
  return null;
}

// Fills the sections H360 records can answer, without touching rows that are
// already there. Returns how many rows or numbers were written.
function importSections(report, picture, options) {
  const days = new Set((picture.span || period(report.date, report.shift, report.shiftTime)).days);
  const same = (a, b) => text(a).toLowerCase() === text(b).toLowerCase();
  let written = 0;
  const addRow = (sectionId, row, isSame) => {
    const rows = report.data[sectionId].rows;
    if (rows.some(isSame)) return;
    rows.push(row);
    written++;
  };

  const vent = { Invasive: { adult: 0, child: 0, units: new Set(), names: [] }, 'Non-Invasive (CPAP/BiPAP)': { adult: 0, child: 0, units: new Set(), names: [] } };
  let transfusions = 0;
  for (const patient of picture.patients) {
    const s = picture.suggestions.get(patient.admissionNo);
    const row = patientRow(patient, new Map(), picture, options);
    const unit = unitName(patient.station);
    const bed = row.dept.split('\n').pop();
    if (!s) continue;
    transfusions += s.transfusions;

    for (const op of s.surgeries.filter((item) => days.has(item.day))) {
      addRow('surgeries', {
        name: row.name, surgery: op.surgery, surgeon: op.surgeon, anesthesiologist: op.anesthesiologist, anesthesia: op.anesthesia,
        note: op.time ? `Operation Time: ${op.time}` : '',
      }, (existing) => same(existing.name, row.name) && same(existing.surgery, op.surgery));
    }
    const procedure = (dept, name) => addRow('procedures', {
      dept, name: row.name, age: row.age, uhid: row.uhid, consultant: row.consultant, procedure: name, bed, remarks: '',
    }, (existing) => same(existing.dept, dept) && (existing.uhid === row.uhid || same(existing.name, row.name)));
    if (s.dialysis.some((day) => days.has(day))) procedure('Dialysis', 'Haemodialysis');
    if (s.cathLab.some((day) => days.has(day))) procedure('CATH LAB', '');
    if (s.pressure) {
      addRow('pressureSores', {
        name: row.name, age: row.age, bed: row.dept, diagnosis: row.diagnosis, consultant: row.consultant, stage: '', remarks: s.pressure,
      }, (existing) => same(existing.name, row.name));
    }
    const kind = ventilationOf(s);
    if (kind) {
      const child = /^(\d+)\s*y/i.test(row.age) && Number(row.age.match(/^(\d+)/)[1]) < 18;
      vent[kind][child ? 'child' : 'adult']++;
      vent[kind].units.add(unit);
      vent[kind].names.push(s.breathing ? `${row.name} (${s.breathing})` : `${row.name} (from the notes)`);
    }
  }

  // Ventilator rows and counts are written only where nothing has been typed yet.
  for (const row of report.data.ventilator.rows) {
    const found = vent[row.type];
    if (!found || ['adult', 'pediatric', 'total', 'department', 'inUse', 'remarks'].some((key) => text(row[key]))) continue;
    const total = found.adult + found.child;
    Object.assign(row, {
      adult: pad2(found.adult), pediatric: pad2(found.child), total: pad2(total),
      department: [...found.units].join(', '), inUse: pad2(total), remarks: found.names.join('\n'),
    });
    if (total) written++;
  }
  const count = (item, value) => {
    const row = report.data.general.rows.find((entry) => entry.item === item);
    if (row && value > 0 && ['', '0', '00'].includes(text(row.value))) {
      row.value = pad2(value);
      written++;
    }
  };
  count('Planned Discharges', picture.patients.filter((patient) => String((patient.admission || {}).dis_req_ind) === '1').length);
  const died = leavers(picture, report.date, report.shift, report.shiftTime).filter((leaver) => leaver.sure && leaver.outcome === 'death').length;
  count('Death', picture.patients.filter((patient) => String((patient.admission || {}).death_ind) === '1').length + died);
  count('Blood Transfusion (Bed No)', transfusions);
  return written;
}

const dischargeRequested = (patient) => String((patient.admission || {}).dis_req_ind) === '1';

// The row of a patient who is leaving: Discharged has no Remarks column.
function leavingRow(row) {
  const { remarks, _note, ...kept } = row;
  return kept;
}

function listFor(patient, span, options) {
  if (options && options.dischargeRequests && dischargeRequested(patient)) return 'discharged';
  const admitted = text((patient.admission || {}).admission_date);
  const { from, to } = span;
  if (admitted >= from && admitted <= to) return 'newAdmissions';
  return CRITICAL_UNIT.test(patient.station) ? 'critical' : 'ward';
}

// "Nursing Services - MICU" -> "MICU"; "Nurse Station L-10" -> "Level-10"
function unitName(station) {
  const unit = text(station).replace(/Nurse Station|Nursing Services|\bL-?\s?\d+\b/gi, '').replace(/[\s–-]+/g, ' ').trim();
  const level = text(station).match(/\bL-?\s?(\d+)\b/i);
  // Critical units are counted under their own name ("CTVS (ICU)" -> "CTVS"), wards and cabins under their floor.
  if (CRITICAL_UNIT.test(unit)) return unit.replace(/\(.*?\)/g, '').trim() || unit;
  return level ? `Level-${Number(level[1])}` : unit || text(station);
}

function censusRows(patients) {
  const units = new Map();
  for (const patient of patients) {
    const unit = unitName(patient.station);
    units.set(unit, (units.get(unit) || 0) + 1);
  }
  // In the order of the sheet: NICU, CTVS, the floors, then SICU, CCU, MICU.
  const place = (unit) => {
    const floor = unit.match(/^Level-(\d+)$/);
    if (floor) return 10 + Number(floor[1]);
    const at = ['NICU', 'CTVS', 'SICU', 'CCU', 'MICU'].indexOf(unit.toUpperCase());
    return at < 0 ? 200 : at < 2 ? at : 100 + at;
  };
  return [...units].sort((a, b) => place(a[0]) - place(b[0])).map(([unit, count]) => ({ unit, patients: pad2(count) }));
}

// Diagnosis and remarks typed in the most recent earlier report, by UHID.
async function carriedText(db, date, exceptId) {
  const previous = await db
    .collection(SHEETS)
    .find({ date: { $lte: date }, ...(exceptId ? { _id: { $ne: exceptId } } : {}) })
    .sort({ date: -1, updatedAt: -1 })
    .limit(1)
    .next();
  const carried = new Map();
  if (previous) {
    for (const id of PATIENT_SECTIONS) {
      for (const row of ((previous.data || {})[id] || {}).rows || []) {
        // The remarks of an earlier shift are that shift's; only the diagnosis carries over.
        if (row.uhid && !carried.has(row.uhid)) carried.set(row.uhid, { diagnosis: row.diagnosis });
      }
    }
  }
  return { carried, previous };
}

// The General Information list of the final sheet, keeping the numbers typed under the earlier wording.
const EARLIER_NAMES = { 'Patient Complaint': '(Patient Complaint)', 'Planned Discharged': 'Planned Discharges', 'Blood Transfusion': 'Blood Transfusion (Bed No)' };
function upgrade(report) {
  for (const section of SECTIONS) {
    if (!report.data[section.id]) report.data[section.id] = { rows: [], fields: {} };
    report.data[section.id].fields = report.data[section.id].fields || {};
  }
  const general = report.data.general;
  if (!general.rows.some((row) => text(row.sub))) {
    const typed = new Map(general.rows.map((row) => [EARLIER_NAMES[row.item] || row.item, row.value]));
    general.rows = GENERAL_ITEMS.map((row) => ({ ...row, value: !row.sub && row.item && typed.has(row.item) ? typed.get(row.item) : row.value }));
  }
  return report;
}

function clean(report) {
  const { _id, ...rest } = upgrade(report);
  return { id: String(_id), ...rest };
}

function objectId(id) {
  if (!ObjectId.isValid(id)) throw fail(404, 'Report not found.');
  return new ObjectId(id);
}

function checkDateAndShift(date, shift) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(date)) || Number.isNaN(new Date(`${date}T00:00:00`).getTime())) throw fail(400, 'Choose a valid date.');
  if (!SHIFTS.includes(shift)) throw fail(400, 'Choose a shift.');
}

// A new report, filled in but not saved yet.
async function draft(store, { date, shift }) {
  checkDateAndShift(date, shift);
  const { carried, previous } = await carriedText(store.db, date);
  const picture = await hospitalPicture(store, date, shift);
  const options = updateOptions();

  const data = blankData();
  for (const patient of picture.patients) {
    const to = listFor(patient, picture.span, options);
    const row = patientRow(patient, carried, picture, options);
    data[to].rows.push(to === 'discharged' ? leavingRow(row) : row);
  }
  for (const patient of unlistedAdmissions(picture, date, shift)) data.newAdmissions.rows.push(patientRow(patient, carried, picture, options));
  for (const leaver of leavers(picture, date, shift)) {
    // A death is counted in General Information; it is neither a discharge nor a LAMA.
    if (leaver.outcome === 'death' || !leaver.sure) continue;
    data[leaver.outcome === 'lama' ? 'lama' : 'discharged'].rows.push(leaverRow(leaver, patientRow(leaver.patient, carried, picture, options)));
  }
  data.census.rows = censusRows(picture.patients);
  data.census.fields.ipd = picture.patients.length ? String(picture.patients.length) : '';
  if (picture.opd && picture.opd.counts) data.census.fields.opd = String(picture.opd.counts.attended);
  importSections({ date, shift, data }, picture, options);

  return {
    date,
    shift,
    title: titleFor(shift),
    data,
    preparedBy: previous && previous.preparedBy ? previous.preparedBy : Object.fromEntries(SIGNATURE.map((item) => [item.key, ''])),
    sourceCollectedAt: picture.collectedAt,
  };
}

async function create(store, wanted, by) {
  const now = new Date();
  const report = { ...(await draft(store, wanted)), createdAt: now, updatedAt: now, createdBy: by || '', updatedBy: by || '' };
  const { insertedId } = await store.db.collection(SHEETS).insertOne(report);
  return clean({ _id: insertedId, ...report });
}

async function get(store, id) {
  const report = await store.db.collection(SHEETS).findOne({ _id: objectId(id) });
  if (!report) throw fail(404, 'Report not found.');
  return clean(report);
}

async function list(store) {
  const reports = await store.db.collection(SHEETS).find().sort({ date: -1, updatedAt: -1 }).limit(500).toArray();
  return reports.map(upgrade).map((report) => ({
    id: String(report._id),
    date: report.date,
    shift: report.shift,
    title: report.title,
    updatedAt: report.updatedAt,
    preparedBy: text((report.preparedBy || {}).name),
    counts: Object.fromEntries(ACTIVE_LISTS.concat('lama', 'discharged').map((id) => [id, report.data[id].rows.length])),
  }));
}

const short = (value, max) => (typeof value === 'string' || typeof value === 'number' ? String(value).slice(0, max) : '');

// Keeps only what the report description allows, whatever the browser sent.
function tidy(body) {
  checkDateAndShift(body.date, body.shift);
  const data = blankData();
  for (const section of SECTIONS) {
    const sent = (body.data && body.data[section.id]) || {};
    const keys = (section.columns || []).map((column) => column.key).concat(section.patients ? ['_note'] : []);
    if (Array.isArray(sent.rows)) {
      data[section.id].rows = sent.rows.slice(0, 300).map((row) =>
        Object.fromEntries(keys.filter((key) => row && short(row[key], 1) !== '').map((key) => [key, short(row[key], 6000)]))
      );
    }
    if (section.fixedRows) {
      // The lines of a fixed list keep their own wording; only what is written beside them is taken.
      const sentRows = Array.isArray(sent.rows) ? sent.rows : [];
      data[section.id].rows = section.defaults.map((row, i) => {
        const out = { ...row };
        if (!sentRows[i]) return out;
        for (const column of section.columns) {
          const printed = (section.readOnly || []).includes(column.key) && text(row[column.key]);
          if (!printed) out[column.key] = short(sentRows[i][column.key], 6000);
        }
        return out;
      });
    }
    for (const field of section.fields || []) data[section.id].fields[field.key] = short((sent.fields || {})[field.key], 6000);
  }
  return {
    date: body.date,
    shift: body.shift,
    title: short(body.title, 200) || titleFor(body.shift),
    data,
    preparedBy: Object.fromEntries(SIGNATURE.map((item) => [item.key, short((body.preparedBy || {})[item.key], 200)])),
  };
}

// base: the "last saved" time of the copy that was edited. A save made from an
// older copy is refused instead of wiping what somebody else wrote since.
async function update(store, id, body, by) {
  const changes = { ...tidy(body), updatedAt: new Date(), updatedBy: by || '' };
  const filter = { _id: objectId(id) };
  const base = body.baseUpdatedAt ? new Date(body.baseUpdatedAt) : null;
  if (base && !Number.isNaN(base.getTime())) filter.updatedAt = base;
  const result = await store.db.collection(SHEETS).findOneAndUpdate(filter, { $set: changes }, { returnDocument: 'after' });
  if (!result) {
    if (filter.updatedAt && (await store.db.collection(SHEETS).findOne({ _id: filter._id }, { projection: { _id: 1 } }))) {
      throw fail(409, 'Someone else changed this report since you opened it. Reload it to see their changes, then make yours again.');
    }
    throw fail(404, 'Report not found.');
  }
  return clean(result);
}

async function remove(store, id) {
  const result = await store.db.collection(SHEETS).deleteOne({ _id: objectId(id) });
  if (!result.deletedCount) throw fail(404, 'Report not found.');
}

// Brings a report (in the log sheet's shape) up to date with what H360 knows, as
// far as the chosen options allow, and says what it did. Nothing is saved here.
// Patients who have left H360's lists and are not accounted for are only
// reported back, so they can be moved to Discharged or LAMA by hand.
function applyPicture(report, picture, carried, options) {
  const known = new Map();
  for (const sectionId of PATIENT_SECTIONS) for (const row of report.data[sectionId].rows) if (row.uhid) known.set(row.uhid, row);

  const added = [];
  // Moved to Discharged because H360 now shows a discharge request for them.
  const requested = [];
  const span = picture.span || period(report.date, report.shift, report.shiftTime);
  const changed = { diagnosis: 0, remarks: 0, details: 0, sections: 0 };
  const write = (row, key, value, mode) => {
    if (!value || mode === 'none' || value === row[key] || (mode === 'empty' && text(row[key]))) return;
    row[key] = value;
    changed[key]++;
  };
  for (const patient of picture.patients) {
    const fresh = patientRow(patient, new Map(), picture, options);
    const row = known.get(fresh.uhid);
    if (!row) {
      if (options.addNew) {
        const to = listFor(patient, span, options);
        const made = patientRow(patient, carried, picture, options);
        report.data[to].rows.push(to === 'discharged' ? leavingRow(made) : made);
        added.push(fresh.name);
        if (to === 'discharged') requested.push(fresh.name);
      }
      continue;
    }
    if (options.dischargeRequests && dischargeRequested(patient)) {
      // Still in a bed, but on the way out: the row goes from its list to Discharged as it is.
      const from = ACTIVE_LISTS.find((sectionId) => report.data[sectionId].rows.includes(row));
      if (from) {
        report.data[from].rows.splice(report.data[from].rows.indexOf(row), 1);
        report.data.discharged.rows.push(row);
        requested.push(fresh.name);
      }
    }
    if (fresh._note) row._note = fresh._note;
    if (options.updateDetails) {
      const before = `${row.dept}|${row.age}|${row.consultant}`;
      for (const key of ['dept', 'age', 'consultant']) if (fresh[key]) row[key] = fresh[key];
      if (fresh._station) row._station = fresh._station;
      if (before !== `${row.dept}|${row.age}|${row.consultant}`) changed.details++;
    }
    write(row, 'diagnosis', fresh.diagnosis, options.diagnosis);
    write(row, 'remarks', fresh.remarks, options.remarks);
  }
  // Where those who left belong, and what the IPD Admission list adds: admissions that
  // are on no station list. A row already written is moved, never rewritten.
  const moved = [];
  const died = [];
  const unsure = [];
  if (options.register && options.addNew) {
    for (const patient of unlistedAdmissions(picture, report.date, report.shift)) {
      if (known.has(text(patient.uhid))) continue;
      const row = patientRow(patient, carried, picture, options);
      report.data.newAdmissions.rows.push(row);
      known.set(row.uhid, row);
      added.push(row.name);
    }
  }
  {
    const seen = options.register ? picture : { ...picture, register: [] };
    for (const leaver of leavers(seen, report.date, report.shift)) {
      const uhid = text(leaver.patient.uhid);
      const name = text((leaver.patient.admission || {}).patient_name);
      const inReport = ['lama', 'discharged', ...ACTIVE_LISTS].some((sectionId) => report.data[sectionId].rows.some((row) => uhid && row.uhid === uhid));
      if (!leaver.sure) {
        // Left since the last collection, but in which shift nobody can say: offered, not placed.
        if (!inReport) unsure.push({ name, uhid, since: leaver.window.since, until: leaver.window.until, outcome: leaver.outcome, row: leaverRow(leaver, patientRow(leaver.patient, carried, picture, options)) });
        continue;
      }
      if (leaver.outcome === 'death') {
        died.push(name);
        continue;
      }
      const target = leaver.outcome === 'lama' ? 'lama' : 'discharged';
      const where = target === 'lama' ? 'LAMA' : 'Discharged';
      const from = ACTIVE_LISTS.find((sectionId) => report.data[sectionId].rows.some((row) => row.uhid && row.uhid === uhid));
      const already = ['lama', 'discharged'].some((sectionId) => report.data[sectionId].rows.some((row) => (uhid && row.uhid === uhid) || (!row.uhid && text(row.name).toLowerCase() === name.toLowerCase())));
      if (from) {
        const rows = report.data[from].rows;
        const [row] = rows.splice(rows.findIndex((entry) => entry.uhid === uhid), 1);
        if (!already) report.data[target].rows.push(leaverRow(leaver, row));
        moved.push(row.name + ' (' + where + ')');
      } else if (!already && uhid) {
        report.data[target].rows.push(leaverRow(leaver, patientRow(leaver.patient, carried, picture, options)));
        moved.push(name + ' (' + where + ')');
      }
    }
  }
  const present = new Set(picture.patients.map((patient) => text(patient.uhid)));
  const gone = ACTIVE_LISTS.flatMap((sectionId) => report.data[sectionId].rows)
    // Someone the IPD Admission list still shows as admitted is only waiting for a station to receive them.
    .filter((row) => row.uhid && !present.has(row.uhid) && !(picture.register || []).some((entry) => text(entry.fields.uhid) === row.uhid && !entry.fields.outcome))
    .map((row) => row.name);
  report.data.census.rows = censusRows(picture.patients);
  report.data.census.fields.ipd = String(picture.patients.length);
  if (options.sections) changed.sections = importSections(report, picture, options);
  // OPD patients who have come (vitals taken, or seen by the doctor), where nothing is written yet.
  if (picture.opd && picture.opd.counts && !text(report.data.census.fields.opd)) report.data.census.fields.opd = String(picture.opd.counts.attended);
  return { added, gone, moved, died, requested, unsure, changed, span };
}

// Brings a report up to date with the latest collection, as far as the chosen
// options allow. Patients who have left H360's lists are only reported back,
// so they can be moved to Discharged or LAMA by hand.
async function refresh(store, id, sent, by) {
  const options = updateOptions(sent);
  const db = store.db;
  const report = await db.collection(SHEETS).findOne({ _id: objectId(id) });
  if (!report) throw fail(404, 'Report not found.');
  upgrade(report);
  const { carried } = await carriedText(db, report.date, report._id);
  report.shiftTime = text(((report.data.round || {}).fields || {}).time);
  const picture = await hospitalPicture(store, report.date, report.shift, report.shiftTime);
  if (!picture.collectedAt) throw fail(409, 'Nothing has been collected from H360 yet. Collect the patients first.');

  const { added, gone, moved, died, requested, changed } = applyPicture(report, picture, carried, options);
  delete report.shiftTime;

  const updatedAt = new Date();
  await db.collection(SHEETS).updateOne(
    { _id: report._id },
    { $set: { data: report.data, sourceCollectedAt: picture.collectedAt, updatedAt, updatedBy: by || '' } }
  );
  return { report: clean({ ...report, sourceCollectedAt: picture.collectedAt, updatedAt }), added, gone, moved, died, requested, changed };
}

// The reports written with the stand-alone collector on this computer, copied
// into the app once. A report already copied is left alone, so what was
// changed in the app since is never overwritten.
async function importLegacy(store, localDb) {
  const legacy = await localDb.collection('reports').find().toArray();
  if (!legacy.length) return { found: 0, copied: 0 };
  const result = await store.db.collection(SHEETS).bulkWrite(
    legacy.map((report) => ({ updateOne: { filter: { _id: report._id }, update: { $setOnInsert: { ...report, importedAt: new Date() } }, upsert: true } })),
    { ordered: false }
  );
  return { found: legacy.length, copied: result.upsertedCount };
}

async function legacyWaiting(store, localDb) {
  const ids = (await localDb.collection('reports').find({}, { projection: { _id: 1 } }).toArray()).map((report) => report._id);
  if (!ids.length) return 0;
  return ids.length - (await store.db.collection(SHEETS).countDocuments({ _id: { $in: ids } }));
}

// Everyone H360 has in a bed now, as the Patient Board shows a patient: who, where, under
// whom, with what, and what the newest note says.
async function board(store) {
  await store.ready;
  const run = await store.col('runs').find().sort({ collectedAt: -1 }).limit(1).next();
  if (!run) return { collectedAt: null, site: '', patients: [] };
  const patients = await store.col('patients').find({ lastRunId: run._id }).sort({ seq: 1 }).toArray();
  const picture = { suggestions: new Map(patients.filter((patient) => patient.suggestion).map((patient) => [patient.admissionNo, patient.suggestion])) };
  const options = updateOptions();
  return {
    collectedAt: run.collectedAt,
    site: run.site || '',
    patients: patients.map((patient) => {
      const row = patientRow(patient, new Map(), picture, options);
      return {
        uhid: row.uhid, name: row.name, age: row.age, station: text(patient.station), bed: text((patient.admission || {}).bed_name),
        consultant: row.consultant, diagnosis: row.diagnosis, remarks: row.remarks, doa: row.doa,
        critical: CRITICAL_UNIT.test(patient.station), dischargeRequested: dischargeRequested(patient), recordsAt: patient.recordsAt || null,
      };
    }),
  };
}

// The same update for a report that is kept somewhere else (the shift supervisor report,
// see bridge.js): works on the copy it is given and hands it back, saving nothing.
//   sheet    { date, shift, shiftTime, data } in the log sheet's shape
//   carried  the diagnosis typed in the previous report, by UHID
async function fill(store, sheet, sent, carried) {
  const options = updateOptions(sent);
  checkDateAndShift(sheet.date, sheet.shift);
  const picture = await hospitalPicture(store, sheet.date, sheet.shift, sheet.shiftTime);
  if (!picture.collectedAt) throw fail(409, 'Nothing has been collected from H360 yet. Collect the patients first (H360 Scan).');
  const report = upgrade({ date: sheet.date, shift: sheet.shift, shiftTime: text(sheet.shiftTime), data: { ...blankData(), ...(sheet.data || {}) } });
  const result = applyPicture(report, picture, carried || new Map(), options);
  const opd = picture.opd && picture.opd.counts ? { date: picture.opd.date, collectedAt: picture.opd.collectedAt, counts: picture.opd.counts } : null;
  return { data: report.data, sourceCollectedAt: picture.collectedAt, census: report.data.census.rows, opd, duplicates: sameDiagnosis(picture), ...result };
}

// Two patients whose newest H360 diagnosis is the same long text: a problem list pasted
// into the wrong patient's record (seen on the live site). Named, so the supervisor checks.
function sameDiagnosis(picture) {
  const byText = new Map();
  for (const patient of picture.patients) {
    const s = picture.suggestions.get(patient.admissionNo);
    const said = text(s && s.diagnosis).replace(/\s+/g, ' ');
    if (said.length < 60) continue;
    byText.set(said, [...(byText.get(said) || []), text((patient.admission || {}).patient_name)]);
  }
  return [...byText.values()].filter((names) => names.length > 1).map((names) => ({ names, diagnosis: [...byText.keys()].find((key) => byText.get(key) === names).slice(0, 120) }));
}

module.exports = {
  draft, create, get, list, update, remove, refresh, fill, board, importLegacy, legacyWaiting, suggestionsFrom, composeDiagnosis, diagnosisInSummary, hospitalPicture, leavers,
  period, shiftHours, ventilationOf, UPDATE_DEFAULTS, SHEETS,
};
