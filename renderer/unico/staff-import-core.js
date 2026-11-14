/* UNICO — Staff Management → Paste & Update: the ONE rule that reads pasted registration-form text,
   finds the person in the staff register and works out what to fill in.
   Shared by the screen (staff-paste.jsx, window.UNICO_SI) and the tests / admin scripts (require()).

   parseText(text)            → [{ n, fields, experience[], raw{label:value}, warnings[] }]
   matchPerson(p, roster)     → { decision:'match'|'choose'|'new', best, candidates[{id,score,strong,why[]}] }
   planUpdate(p, rec)         → { rows:[{ key,label,kind:'fill'|'diff'|'same'|'new', stored, form, value }] }
   buildPatch(p, rec, plan, ticked, meta) → the fields to write (+ import_source) — only the ticked rows
   AI_PROMPT                  → the instruction an administrator gives ChatGPT / Gemini with the form photos

   Rules (the user's): blanks are filled; a stored value is NEVER replaced unless the administrator
   ticks it; anything unreadable is a warning, never a guessed value; nothing is written here. */
(function (root) {
'use strict';
const NM = (typeof module !== 'undefined' && module.exports) ? require('./name-match.js') : (root.UNICO_NAME || null);

/* ---------------------------------------------------------------- labels --- */
// [field key, label shown, every spelling accepted in pasted text]. Longest spellings win.
const LABELS = [
  ['name', 'Name', ['Full Name', 'Name of Staff', 'Staff Name', 'Name']],
  ['role', 'Role', ['Staff Role', 'Role']],
  ['designation', 'Designation', ['Designation', 'Post']],
  ['form_no', 'Form Number', ['Form Number', 'Form No.', 'Form No', 'Form Code']],
  ['emp_id', 'Employee ID', ['Employee ID', 'Employee No.', 'Employee No', 'Employee Number', 'Emp ID', 'Emp. ID']],
  ['date_received', 'Date Received', ['Date Received']],
  ['phone', 'Phone', ['Phone Number', 'Mobile Number', 'Mobile', 'Phone', 'Contact No.', 'Contact No', 'Contact Number']],
  ['alt_phone', 'Alternative Phone', ['Alternative Phone', 'Alternate Phone', 'Alt. Phone', 'Alt Phone', 'Other Phone']],
  ['dob', 'Date of Birth', ['Date of Birth', 'DOB', 'Birth Date']],
  ['gender', 'Gender', ['Gender', 'Sex']],
  ['qualification', 'Qualifications', ['Qualifications', 'Qualification', 'Educational Qualification', 'Education']],
  ['current_department', 'Department', ['Department Assigned (Office Use)', 'Department Assigned', 'Department', 'Unit / Ward', 'Unit']],
  ['extracurricular', 'Extracurricular Activities', ['Extracurricular Activities', 'Extra-curricular Activities', 'Extracurricular']],
  ['experience', 'Previous Experience', ['Previous Experience', 'Work Experience', 'Job Experience']],
  ['total_prev', 'Total Previous Experience', ['Total Previous Experience', 'Total Prior Experience']],
  ['doj', 'Date of Joining UNICO', ['Date of Joining UNICO', 'Date of Joining Unico', 'Date of Joining', 'Joining Date', 'DOJ']],
  ['compliance', 'Compliance & Registration', ['Compliance & Registration', 'Compliance and Registration']],
  ['special_training', 'Special Training', ['Special Training', 'Special Trainings', 'Trainings', 'Training']],
  ['licence', 'BNMC Licence No', ['BNMC Registration / Licence No.', 'BNMC Registration / Licence No', 'BNMC Registration/Licence No.', 'BNMC Registration No.', 'BNMC Registration No', 'BNMC Licence No.', 'BNMC Licence No', 'BNMC License No', 'Licence No.', 'Licence No', 'License No', 'BNMC No']],
  ['licence_expiry', 'BNMC Licence Expiry', ['BNMC Licence Expiry', 'BNMC License Expiry', 'Licence Expiry Date', 'Licence Expiry', 'License Expiry']],
  ['hepatitis_b_vaccination', 'Hepatitis-B Vaccination', ['Hepatitis-B Vaccination', 'Hepatitis B Vaccination', 'Hepatitis-B', 'Hepatitis B', 'Hep-B', 'Hep B']],
  ['additional', 'Additional Details', ['Additional Details', 'Other Details']],
  ['nid', 'NID / Passport', ['NID / Passport No.', 'NID / Passport No', 'NID/Passport No.', 'NID/Passport No', 'NID / Passport', 'NID/Passport', 'NID No.', 'NID No', 'NID', 'Passport No', 'Passport']],
  ['blood_group', 'Blood Group', ['Blood Group', 'Blood group']],
  ['emergency', 'Emergency Contact', ['Emergency Contact', 'Emergency Contact No.', 'Emergency No']],
  ['languages', 'Languages', ['Languages Spoken', 'Languages', 'Language']],
  ['signature', 'Signature name', ['Signature of Staff', 'Signature name', 'Signature Name', 'Signature']],
  ['unclear', 'Unclear', ['Unclear', 'Could not read']],
  ['age', 'Age', ['Age / Gender', 'Age']],
];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SPELLINGS = [];
LABELS.forEach(([key, , list]) => list.forEach((sp) => SPELLINGS.push([sp, key])));
SPELLINGS.sort((a, b) => b[0].length - a[0].length);
const KEY_OF = {}; SPELLINGS.forEach(([sp, key]) => { KEY_OF[sp.toLowerCase().replace(/\s+/g, ' ')] = key; });
// "Label:" — spaces inside the label may vary; a label may be glued to the text before it
// (the copied style runs "…XecesminStaff Role: Nurse"), so no word boundary in front.
const LABEL_RE = new RegExp('(' + SPELLINGS.map(([sp]) => esc(sp).replace(/\\ |\s+/g, '\\s*')).join('|') + ')\\s*[:：]', 'gi');
const keyOfLabel = (txt) => KEY_OF[String(txt).toLowerCase().replace(/\s+/g, ' ')] || KEY_OF[String(txt).toLowerCase().replace(/\s+/g, '')] || null;
function labelKey(txt) {
  const k = keyOfLabel(txt); if (k) return k;
  const flat = String(txt).toLowerCase().replace(/\s+/g, '');
  const hit = SPELLINGS.find(([sp]) => sp.toLowerCase().replace(/\s+/g, '') === flat);
  return hit ? hit[1] : null;
}

/* --------------------------------------------------------------- helpers --- */
const EMPTY_RE = /^(?:-+|—|–|n\/?a|nil|null|none(?: (?:ticked|listed|given|mentioned|specified))?(?:\s*\(.*\))?|not (?:assigned|specified|given|available|applicable|mentioned|provided|listed|written|readable|legible)(?:\s*\(.*\))?|blank|empty|\?+)\.?$/i;
const clean = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').replace(/^[\s;,|:.\-–—]+|[\s;,|]+$/g, '').trim();
const isEmpty = (v) => !clean(v) || EMPTY_RE.test(clean(v));
const val = (v) => (isEmpty(v) ? '' : clean(v));
const key = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const pad = (n) => String(n).padStart(2, '0');

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const monIdx = (w) => { const k = String(w || '').toLowerCase().slice(0, 3); return MONTHS.findIndex((m) => m.slice(0, 3) === k); };
const THIS_YEAR = new Date().getFullYear();
const yy = (y) => { const n = parseInt(y, 10); if (String(y).length > 2) return n; return n <= (THIS_YEAR % 100) + 1 ? 2000 + n : 1900 + n; };
const okDate = (y, m, d) => { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d && y > 1930 && y < 2100; };

/* A date as written on the form → { iso:'YYYY-MM-DD', approx, note } or null. Day first (Bangladesh);
   a month-only date takes the 1st and says so; nothing is invented beyond that. */
function parseDate(raw) {
  const s = val(raw).replace(/\(.*?\)/g, ' ').replace(/(\d)(st|nd|rd|th)\b/gi, '$1').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m && okDate(+m[1], +m[2], +m[3])) return { iso: m[1] + '-' + pad(m[2]) + '-' + pad(m[3]) };
  m = s.match(/(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{2,4})/);
  if (m) {
    let d = +m[1], mo = +m[2]; const y = yy(m[3]);
    let note = '';
    if (mo > 12 && d <= 12) { const t = d; d = mo; mo = t; note = 'read as month/day: ' + m[0]; }
    if (okDate(y, mo, d)) return { iso: y + '-' + pad(mo) + '-' + pad(d), note };
    return null;
  }
  m = s.match(/([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/);            // October 30, 2020
  if (m && monIdx(m[1]) >= 0 && okDate(+m[3], monIdx(m[1]) + 1, +m[2])) return { iso: m[3] + '-' + pad(monIdx(m[1]) + 1) + '-' + pad(m[2]) };
  m = s.match(/(\d{1,2})\s+([A-Za-z]{3,})\.?,?\s+(\d{4})/);            // 30 October 2020
  if (m && monIdx(m[2]) >= 0 && okDate(+m[3], monIdx(m[2]) + 1, +m[1])) return { iso: m[3] + '-' + pad(monIdx(m[2]) + 1) + '-' + pad(m[1]) };
  m = s.match(/([A-Za-z]{3,})\.?[\s,'-]+(\d{2,4})$/);                  // April 2016
  if (m && monIdx(m[1]) >= 0) return { iso: yy(m[2]) + '-' + pad(monIdx(m[1]) + 1) + '-01', approx: true, note: 'no day on the form — the 1st was used' };
  m = s.match(/^(\d{1,2})[-/.](\d{4})$/);                               // 04/2016
  if (m && +m[1] >= 1 && +m[1] <= 12) return { iso: m[2] + '-' + pad(m[1]) + '-01', approx: true, note: 'no day on the form — the 1st was used' };
  m = s.match(/^(\d{4})$/);
  if (m) return { iso: m[1] + '-01-01', approx: true, yearOnly: true, note: 'only the year on the form' };
  return null;
}

// Bangladeshi mobile numbers: 01XXXXXXXXX. A number of the wrong length is reported, not repaired.
function parsePhone(raw) {
  const s = val(raw); if (!s) return { phone: '' };
  let d = s.replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (/^8801\d{9}$/.test(d)) d = d.slice(2);
  if (/^1\d{9}$/.test(d)) d = '0' + d;
  if (/^01\d{9}$/.test(d)) return { phone: d };
  return { phone: '', bad: s };
}
function phonesIn(raw) { return (String(raw || '').match(/(?:\+?88)?0?1[\d\s-]{8,13}\d/g) || []).map((x) => parsePhone(x)); }

const BLOOD_RE = /\b(AB|A|B|O)\s*(?:\(?\s*(\+|-|−|positive|negative|pos|neg|ve\+|ve-|\+ve|-ve)\s*\)?)/i;
function parseBlood(raw) {
  const m = String(raw || '').match(BLOOD_RE);
  if (!m) return '';
  const sign = /^(\+|positive|pos|ve\+|\+ve)$/i.test(m[2]) ? '+' : '-';
  return m[1].toUpperCase() + sign;
}

function parseHepB(raw) {
  const s = val(raw).toLowerCase();
  if (!s) return '';
  if (/booster|complete(?!\s*\/)|all three|3 doses|third|3rd/.test(s) && !/not\s*complete|incomplete/.test(s)) return 'Completed';
  if (/2nd|second|two doses/.test(s)) return '2nd Dose';
  if (/1st|first|one dose/.test(s)) return '1st Dose';
  if (/unknown|don'?t know/.test(s)) return 'Unknown';
  if (/not\s*(complete|started|taken|done|vaccinated)|incomplete|^no$|none/.test(s)) return 'Not Completed';
  return '';
}

// Role + designation from "Nurse (Staff Nurse)", "Patient Care Assistant (PCA) / ICU PCA", "Trainee Nurse"…
function parseRole(raw) {
  const s = val(raw); if (!s) return { role: '', designation: '' };
  const low = s.toLowerCase();
  if (/trainee/.test(low)) return { role: 'Nurse', designation: 'Trainee Nurse' };
  if (/\bpca\b|patient care|care assistant|care attendant/.test(low)) {
    const designation = /icu\s*pca/.test(low) ? 'ICU PCA' : /senior/.test(low) ? 'Senior PCA' : /attendant/.test(low) ? 'Patient Care Attendant' : 'Patient Care Assistant';
    return { role: 'PCA', designation };
  }
  if (/nurse|nursing|midwi/.test(low)) {
    const inner = (s.match(/\(([^)]+)\)/) || [])[1] || '';
    const tail = (s.split('/').slice(1).join('/') || '').trim();
    const designation = clean(inner || tail || (/(staff|charge|senior|in-?charge|team leader)/i.test(s) ? s : ''));
    return { role: 'Nurse', designation: /^nurse$/i.test(designation) ? '' : designation };
  }
  return { role: '', designation: '' };
}

// "a, b; c" → ['a','b','c']. Slashes INSIDE an item stay ("Debate/Public Speaking"); vocab spells them.
function parseList(raw, opts) {
  const s = val(raw); if (!s) return [];
  const re = opts && opts.slash ? /\s*(?:[,;]|\/|&|\band\b)\s*/i : /\s*[,;]\s*/;
  return s.split(re).map((x) => val(x.replace(/\s*\/\s*/g, ' / '))).filter(Boolean)
    .map((x) => canonItem(x, opts && opts.vocab));
}
function canonItem(item, vocab) {
  if (!vocab || !vocab.length) return item;
  const k = key(item);
  const hit = vocab.find((v) => key(v) === k);
  return hit || item;
}
const listStr = (a) => a.join(', ');
function unionList(stored, add) {
  const have = String(stored || '').split(/\s*[,;]\s*/).map(clean).filter(Boolean);
  const keys = new Set(have.map(key));
  const added = add.filter((x) => { const k = key(x); if (!k || keys.has(k)) return false; keys.add(k); return true; });
  return { value: have.concat(added).join(', '), added };
}

/* "(2 yrs 3 mos)", "(1 yr)", "(11 mos)", "5 years 1 month" → { years, months } */
function parseDur(raw) {
  const s = String(raw || '').toLowerCase();
  const y = s.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?|y)\b/), m = s.match(/(\d+)\s*(?:months?|mos?|mo|m)\b/);
  if (!y && !m) return null;
  return { years: y ? String(Math.floor(+y[1])) : '0', months: m ? String(+m[1]) : (y && +y[1] % 1 ? String(Math.round((+y[1] % 1) * 12)) : '0') };
}
const ymYears = (ym) => (ym ? (+ym.years || 0) + (+ym.months || 0) / 12 : 0);
function monthsBetween(a, b) {
  const x = new Date(a + 'T00:00:00Z'), y = new Date(b + 'T00:00:00Z');
  if (isNaN(x) || isNaN(y) || y < x) return 0;
  let n = (y.getUTCFullYear() - x.getUTCFullYear()) * 12 + y.getUTCMonth() - x.getUTCMonth();
  if (y.getUTCDate() < x.getUTCDate()) n--;
  return Math.max(0, n);
}
function fmtYM(years) {
  const t = Math.max(0, Math.round((years || 0) * 12)); const yr = Math.floor(t / 12), mo = t % 12;
  if (yr && mo) return yr + ' yr' + (yr > 1 ? 's' : '') + ' ' + mo + ' mo';
  if (yr) return yr + ' yr' + (yr > 1 ? 's' : '');
  return mo + ' mo';
}
// The register's own rule (staff-data.js experienceYearsOf): dates when the row uses dates, else years + months.
function entryYears(e) {
  if (e.mode === 'dates' && e.fromDate && e.toDate) return monthsBetween(e.fromDate, e.toDate) / 12;
  return Math.max(0, parseFloat(e.years) || 0) + Math.max(0, parseFloat(e.months) || 0) / 12;
}

/* One previous-experience line, in either layout:
     "Org | Unit | 01/09/2025 | 08/11/2026"
     "Org (Unit) – 01/09/2025 to 08/11/2026 (1 yr)"   "Org (Unit) – April 2016 to June 2018 (2 yrs 2 mos)"
     "Org (Unit) – Home Care – (6 mos)"               "Org (Unit) – 2021 to 2026 (5 yrs 1 mo)"  */
function parseExpLine(line, warn) {
  let s = clean(String(line).replace(/^\s*[-•*\d.)]+\s+/, ''));
  if (!s || isEmpty(s)) return null;
  let org = '', dept = '', from = '', to = '', durTxt = '';
  if (s.indexOf('|') >= 0) {
    const p = s.split('|').map(clean);
    [org, dept, from, to] = [p[0] || '', p[1] || '', (p[2] || '').replace(/^from\s*/i, ''), (p[3] || '').replace(/^to\s*/i, '')];
    durTxt = p.slice(4).join(' ');
  } else {
    // The first " – " / " - " OUTSIDE brackets separates the place from its dates ("Al-Manara (Obs & Gyn. - POW) – 12.03.24 to …").
    let cut = -1, cutLen = 0, depth = 0;
    for (let i = 0; i < s.length && cut < 0; i++) {
      const c = s[i];
      if (c === '(') depth++; else if (c === ')' && depth > 0) depth--;
      else if (!depth && (c === '–' || c === '—' || (c === '-' && s[i - 1] === ' ' && s[i + 1] === ' '))) { cut = i; cutLen = 1; }
    }
    let head = cut < 0 ? s : s.slice(0, cut).trim();
    const rest = cut < 0 ? '' : s.slice(cut + cutLen).trim();
    const pm = head.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
    if (pm) { head = pm[1]; dept = pm[2]; }
    org = head;
    const dm = rest.match(/\(([^()]*\d[^()]*)\)\s*$/); if (dm) durTxt = dm[1];
    const span = rest.replace(/\(([^()]*)\)\s*$/, '').trim();
    const tm = span.match(/^(.*?)\s+(?:to|till|until|-|–)\s+(.*)$/i);
    if (tm) { from = tm[1]; to = tm[2]; }
    else if (span && !parseDate(span)) dept = [dept, span.replace(/[–—-]\s*$/, '').trim()].filter(Boolean).join(' · ');
  }
  org = clean(org.replace(/\((?:prev|previous)\)/i, '')); dept = clean(dept.replace(/^(?:prev|previous)$/i, ''));
  if (/^(?:prev|previous)$/i.test(dept)) dept = '';
  if (!org && !dept) return null;
  const f = parseDate(from), t = /^(?:present|now|current|till date|continuing|running)$/i.test(clean(to)) ? null : parseDate(to);
  const dur = parseDur(durTxt);
  const e = { org, dept, mode: 'duration', fromDate: '', toDate: '', years: '', months: '' };
  if (f && t && !f.yearOnly && !t.yearOnly) {
    e.mode = 'dates'; e.fromDate = f.iso; e.toDate = t.iso;
    [f, t].forEach((x) => { if (x.note) warn('Experience at ' + org + ': ' + x.note); });
    if (e.toDate < e.fromDate) { warn('Experience at ' + org + ': the To date is before the From date — dates left out, check the form'); e.mode = 'duration'; e.fromDate = ''; e.toDate = ''; }
  }
  if (e.mode === 'duration') {
    if (dur) { e.years = dur.years; e.months = dur.months; }
    else if (f && t) { const n = monthsBetween(f.iso, t.iso); e.years = String(Math.floor(n / 12)); e.months = String(n % 12); warn('Experience at ' + org + ': only years on the form (' + clean(from) + ' to ' + clean(to) + ') — length taken as ' + fmtYM(n / 12)); }
    else if (from || to) warn('Experience at ' + org + ': dates not readable ("' + clean(from + ' ' + to) + '") — no length recorded');
  } else if (dur) {
    const stated = ymYears(dur), byDates = entryYears(e);
    if (Math.abs(stated - byDates) > 0.17) warn('Experience at ' + org + ': the form says ' + fmtYM(stated) + ' but the dates span ' + fmtYM(byDates) + ' (the dates are kept)');
  }
  return e;
}
function parseExperience(raw, warn) {
  const s = String(raw || '').trim();
  if (!s || isEmpty(s) || /^(?:none|fresher|no experience|nil)\b/i.test(s)) return { entries: [], fresher: /fresher|no experience/i.test(s) };
  // One entry per line, or (the copied style) per run of 3+ spaces.
  const lines = s.split(/\n+|\s{3,}|;\s+(?=[A-Z])/).map((x) => x.trim()).filter(Boolean);
  return { entries: lines.map((l) => parseExpLine(l, warn)).filter(Boolean), fresher: false };
}

/* ---------------------------------------------------------- parseText --- */
// Split the paste into one block per person: "### STAFF 3", "STAFF 3:", or "3. Name …".
function splitPeople(text) {
  const t = String(text || '').replace(/\r/g, '').replace(/ /g, ' ');
  const marks = [];
  const re = /(^|\n|\s{2,})\s*(?:#{1,4}\s*)?(?:staff|form|person)\s*(?:no\.?\s*)?#?\s*(\d{1,3})\s*[:.)-]?\s*(?=\n|$|[A-Z])|(^|\n|\s{3,})\s*(\d{1,3})[.)]\s+(?=[A-Z])/gi;
  let m;
  while ((m = re.exec(t))) {
    const at = m.index + (m[1] || m[3] || '').length;
    marks.push({ at, n: +(m[2] || m[4]), end: re.lastIndex });
  }
  if (!marks.length) return t.trim() ? [{ n: 1, text: t.trim() }] : [];
  return marks.map((mk, i) => ({ n: mk.n, text: t.slice(mk.end, i + 1 < marks.length ? marks[i + 1].at : t.length).trim() }))
    .filter((b) => b.text);
}

function readLabels(block) {
  const hits = []; let m; LABEL_RE.lastIndex = 0;
  // A label inside brackets ("(Expiry: …)", "(Total Experience: …)") is part of that value, not a field.
  const depthAt = (i) => { let d = 0; for (let j = 0; j < i; j++) { const c = block[j]; if (c === '(') d++; else if (c === ')' && d > 0) d--; } return d; };
  while ((m = LABEL_RE.exec(block))) { if (!depthAt(m.index)) hits.push({ at: m.index, end: LABEL_RE.lastIndex, key: labelKey(m[1].replace(/\s+/g, ' ')), label: m[1].replace(/\s+/g, ' ') }); }
  const out = { pre: block.slice(0, hits.length ? hits[0].at : block.length), raw: {}, rawLabel: {} };
  hits.forEach((h, i) => {
    const v = block.slice(h.end, i + 1 < hits.length ? hits[i + 1].at : block.length);
    if (!h.key) return;
    const prev = out.raw[h.key];
    out.raw[h.key] = prev == null ? v : prev + '; ' + v;      // a label repeated → both kept
    out.rawLabel[h.key] = out.rawLabel[h.key] || h.label;
  });
  return out;
}

function parsePerson(block, n, opts) {
  const o = opts || {};
  const warnings = [];
  const warn = (w) => { if (warnings.indexOf(w) < 0) warnings.push(w); };
  const L = readLabels(block);
  const R = L.raw;
  const f = {};
  // Name: the "Name:" field, else the text before the first label ("Sebince XecesminStaff Role:").
  f.name = val(R.name) || val(L.pre.replace(/^\s*(?:#+\s*)?/, ''));
  f.name = f.name.replace(/\s+/g, ' ').replace(/^(?:md|mst|mrs|ms|mr)\.?\s+/i, (x) => x.replace(/\s+$/, ' '));
  if (!f.name) warn('No name found');
  const r = parseRole(R.role); f.role = r.role; f.designation = val(R.designation) || r.designation;
  if (R.role && !f.role) warn('Role not understood: "' + clean(R.role) + '"');
  f.form_no = val(R.form_no);
  f.emp_id = val(R.emp_id).replace(/^(?:id|emp)\s*[:#-]?\s*/i, '');
  if (f.emp_id && !/^[A-Za-z]{0,4}-?\d{3,}$/.test(f.emp_id)) { warn('Employee ID "' + f.emp_id + '" does not look like an employee number — left out'); f.emp_id = ''; }
  const ph = parsePhone(R.phone); f.phone = ph.phone;
  if (ph.bad) warn('Phone "' + ph.bad + '" is not an 11-digit 01… number — left out, check the form');
  // Additional Details hold more numbers: an alternative phone may also sit there.
  const alt = parsePhone(R.alt_phone); f.alt_phone = alt.phone;
  if (alt.bad) warn('Alternative phone "' + alt.bad + '" is not an 11-digit number — left out');
  const dob = parseDate(R.dob); f.dob = dob ? dob.iso : '';
  if (val(R.dob) && !dob) warn('Date of birth "' + clean(R.dob) + '" not readable — left out');
  if (dob && (dob.approx || dob.note)) warn('Date of birth: ' + (dob.note || 'approximate'));
  const g = val(R.gender) || val((String(R.age || '').match(/(male|female)/i) || [])[1]);
  f.gender = /^f|woman|female/i.test(g) ? 'Female' : /^m|man|male/i.test(g) ? 'Male' : '';
  if (g && !f.gender) warn('Gender "' + g + '" not understood');
  f.qualification = listStr(parseList(R.qualification, { vocab: o.vocab && o.vocab.qualification }));
  f.current_department = val(R.current_department);
  f.extracurricular = listStr(parseList(R.extracurricular, { vocab: o.vocab && o.vocab.extracurricular }));
  f.special_training = listStr(parseList(R.special_training, { vocab: o.vocab && o.vocab.special_training }));
  if (/none ticked|not specified/i.test(String(R.special_training || ''))) f.special_training = '';
  f.languages = listStr(parseList(R.languages, { slash: true, vocab: ['Bangla', 'English', 'Hindi', 'Urdu', 'Arabic'] }));
  const doj = parseDate(R.doj); f.doj = doj ? doj.iso : '';
  if (val(R.doj) && !doj) warn('Date of joining "' + clean(R.doj) + '" not readable — left out');
  if (doj && (doj.approx || doj.note)) warn('Date of joining: ' + (doj.note || 'approximate'));
  // BNMC: "64708 (Expiry: 06.11.2026)", "Diploma 35383, Post Basic 29586 (Expiry: 03/09/2036)".
  const lic = String(R.licence || '');
  const expTxt = val(R.licence_expiry) || (lic.match(/expir\w*\s*(?:date)?\s*[:：]?\s*([^)]+)/i) || [])[1] || '';
  const nums = (lic.replace(/\(.*?\)/g, ' ').match(/\d{3,}/g) || []);
  f.licence_no = nums[0] || '';
  if (nums.length > 1) warn('More than one BNMC number on the form (' + clean(lic.replace(/\(.*?\)/g, '')) + ') — the first, ' + nums[0] + ', was used');
  const le = parseDate(expTxt); f.licence_expiry = le ? le.iso : '';
  if (val(expTxt) && !le) warn('Licence expiry "' + clean(expTxt) + '" not readable — left out');
  if (le && le.iso < new Date().toISOString().slice(0, 10)) warn('BNMC licence expired on ' + le.iso);
  f.hepatitis_b_vaccination = parseHepB(R.hepatitis_b_vaccination);
  if (val(R.hepatitis_b_vaccination) && !f.hepatitis_b_vaccination && !/not specified/i.test(R.hepatitis_b_vaccination)) warn('Hepatitis-B "' + clean(R.hepatitis_b_vaccination) + '" not understood — left out');
  f.nid = val(R.nid).replace(/[^\dA-Za-z]/g, '');
  if (f.nid && !/^(\d{10}|\d{13}|\d{17}|[A-Za-z]{1,2}\d{6,9})$/.test(f.nid)) warn('NID "' + clean(R.nid) + '" has an unusual length (' + f.nid.length + ' characters) — check it');
  f.blood_group = parseBlood(R.blood_group);
  if (val(R.blood_group) && !f.blood_group) warn('Blood group "' + clean(R.blood_group) + '" not understood');
  // "01886615034 (Mother)", "01910219232 / 01779081893 (Brother)", "Rahim, 017…, Father"
  const em = String(R.emergency || '');
  const emPh = phonesIn(em);
  f.emergency_contact = (emPh.find((x) => x.phone) || {}).phone || '';
  if (emPh.length > 1) warn('Two emergency numbers on the form (' + clean(em) + ') — the first valid one was used');
  if (emPh.some((x) => x.bad)) warn('Emergency number "' + emPh.filter((x) => x.bad).map((x) => x.bad).join(', ') + '" is not 11 digits — check it');
  const rel = (em.match(/\(([^)]*[A-Za-z][^)]*)\)/) || [])[1] || clean(em.replace(/(?:\+?88)?0?1[\d\s-]{8,13}\d/g, ' ').replace(/[/,;]|relation\s*:?/gi, ' '));
  f.emergency_relation = val(rel);
  const ex = parseExperience(R.experience, warn);
  f.prior_experience_entries = ex.entries;
  f.fresher = ex.fresher;
  const tp = parseDur(R.total_prev); f.total_prev_years = tp ? ymYears(tp) : null;
  if (f.total_prev_years != null && ex.entries.length) {
    const sum = ex.entries.reduce((s, e) => s + entryYears(e), 0);
    if (Math.abs(sum - f.total_prev_years) > 0.25) warn('Total previous experience on the form is ' + fmtYM(f.total_prev_years) + '; the rows add up to ' + fmtYM(sum));
  }
  f.signature = val(R.signature);
  // OCR misreads names ("Sebince Xecesmin" signed "Sabina"): say so when the two do not agree at all.
  if (f.name && f.signature && NM && NM.nameScore) {
    const sig = NM.nameScore(f.name, f.signature);
    const part = NM.nameTokens(f.signature).some((t) => NM.nameTokens(f.name).some((u) => NM.nameScore(t, u) >= SAME));
    if (sig < SIMILAR && !part) warn('The name "' + f.name + '" does not match the signature "' + f.signature + '" — check the spelling before applying');
  }
  if (val(R.unclear)) warn('Marked unclear by the reader: ' + clean(R.unclear));
  // Anything else in the paste that the reader does not keep is shown, never silently lost.
  const raw = {};
  Object.keys(R).forEach((k) => { const v = clean(R[k]); if (v) raw[(LABELS.find((x) => x[0] === k) || [k, k])[1]] = v; });
  return { n, fields: f, raw, warnings };
}

function parseText(text, opts) {
  const blocks = splitPeople(text);
  const people = blocks.map((b, i) => parsePerson(b.text, b.n || i + 1, opts)).filter((p) => p.fields.name || p.fields.phone || p.fields.emp_id);
  // The same form number (or phone) on two forms in one paste: at least one is misread.
  [['form_no', 'form number'], ['phone', 'phone'], ['emp_id', 'employee ID']].forEach(([k, what]) => {
    const by = {};
    people.forEach((p) => { const v = key(p.fields[k]); if (v) (by[v] = by[v] || []).push(p); });
    Object.keys(by).forEach((v) => { if (by[v].length > 1) by[v].forEach((p) => p.warnings.push('Same ' + what + ' (' + p.fields[k] + ') as ' + by[v].filter((q) => q !== p).map((q) => '#' + q.n + ' ' + q.fields.name).join(', ') + ' in this paste — one of them is misread')); });
  });
  return people;
}

/* ---------------------------------------------------------- matching --- */
const digits = (s) => String(s || '').replace(/\D/g, '');
function recPhones(r) {
  const out = [digits(r.phone)];
  if (r.h360_verified && Array.isArray(r.h360_verified.phones)) r.h360_verified.phones.forEach((x) => out.push(digits(x)));
  return out.filter((x) => x.length >= 10).map((x) => x.slice(-10));
}
function nameScore(a, b) {
  if (NM && NM.nameScore) return NM.nameScore(a, b);
  return key(a) === key(b) ? 1 : 0;
}
const SAME = (NM && NM.SAME_NAME) || 0.84, SIMILAR = (NM && NM.SIMILAR_NAME) || 0.6;

/* Every register row that may be this person, best first. Strong = same employee ID, same phone,
   same NID, or the same name with the same joining date or birth date. Names alone and employee
   numbers alone are NOT trusted (two pairs of serving staff share one number) — see the reasons. */
function matchPerson(p, roster) {
  const f = p.fields || {};
  const cands = [];
  (roster || []).forEach((r) => {
    if (!r || r.id == null) return;
    const why = []; let score = 0; let strong = false;
    const emp = digits(f.emp_id), remp = digits(r.emp_id);
    if (emp && remp && emp === remp) { score += 60; why.push('same employee ID ' + r.emp_id); }
    const phones = [f.phone, f.alt_phone].map(digits).filter((x) => x.length >= 10).map((x) => x.slice(-10));
    const rp = recPhones(r);
    if (phones.some((x) => rp.indexOf(x) >= 0)) { score += 70; strong = true; why.push('same phone'); }
    const nid = key(f.nid);
    if (nid && nid.length >= 10 && key(r.nid) === nid) { score += 70; strong = true; why.push('same NID'); }
    const ns = f.name && r.name ? nameScore(f.name, r.name) : 0;
    if (ns >= SAME) { score += 40; why.push(ns >= 0.99 ? 'same name' : 'same name, spelt differently (' + r.name + ')'); }
    else if (ns >= SIMILAR) { score += 15; why.push('similar name (' + r.name + ')'); }
    if (f.doj && r.doj === f.doj) { score += 25; why.push('same joining date'); }
    if (f.dob && r.dob === f.dob) { score += 25; why.push('same date of birth'); }
    if (emp && remp && emp === remp && (ns >= SIMILAR || (f.doj && r.doj === f.doj) || (f.dob && r.dob === f.dob))) strong = true;
    if (ns >= SAME && ((f.doj && r.doj === f.doj) || (f.dob && r.dob === f.dob))) strong = true;
    if (emp && remp && emp !== remp) { score -= 40; why.push('different employee ID on the register (' + r.emp_id + ')'); }
    if (f.dob && r.dob && r.dob !== f.dob && ns < SAME) score -= 10;
    if (score < 40 && !strong) return;
    if (r.former || r.is_active === false) why.push('in Previous Staff (archived)');
    cands.push({ id: r.id, name: r.name, emp_id: r.emp_id || '', score, strong, why, former: !!(r.former || r.is_active === false) });
  });
  cands.sort((a, b) => (b.strong - a.strong) || (b.score - a.score));
  const strongs = cands.filter((c) => c.strong);
  let decision = 'new', best = null;
  // Two records that each fit strongly (two people, or a duplicate record) → the administrator picks.
  if (strongs.length === 1) { decision = 'match'; best = strongs[0]; }
  else if (cands.length) { decision = 'choose'; best = strongs[0] || null; }
  return { decision, best, candidates: cands.slice(0, 6) };
}

/* ---------------------------------------------------------- the plan --- */
// [key, label, kind] — kind: 'text' compares loosely, 'list' unions, 'date', 'phone', 'code'.
const FIELDS = [
  ['name', 'Name', 'text'], ['role', 'Role', 'text'], ['designation', 'Designation', 'text'],
  ['emp_id', 'Employee ID', 'code'], ['phone', 'Phone', 'phone'], ['dob', 'Date of birth', 'date'],
  ['gender', 'Gender', 'text'], ['qualification', 'Qualifications', 'text'], ['current_department', 'Department', 'text'],
  ['doj', 'Date of joining', 'date'], ['licence_no', 'BNMC licence no.', 'code'], ['licence_expiry', 'Licence expiry', 'date'],
  ['hepatitis_b_vaccination', 'Hepatitis-B', 'text'], ['nid', 'NID / Passport', 'code'], ['blood_group', 'Blood group', 'code'],
  ['emergency_contact', 'Emergency contact', 'phone'], ['emergency_relation', 'Emergency relation', 'text'],
  ['special_training', 'Special training', 'list'], ['extracurricular', 'Extracurricular', 'list'], ['languages', 'Languages', 'list'],
  ['form_no', 'HR form reference', 'code'], ['prior_experience_entries', 'Previous experience', 'exp'],
];
const FIELD_LABEL = {}; FIELDS.forEach(([k, l]) => { FIELD_LABEL[k] = l; });
const same = (kind, a, b) => {
  if (kind === 'phone') return digits(a).slice(-10) === digits(b).slice(-10);
  if (kind === 'code' || kind === 'date') return key(a) === key(b);
  return key(a) === key(b);
};
const expStr = (list) => (list || []).map((e) => [e.org, e.dept].filter(Boolean).join(' — ') + ' (' + (e.mode === 'dates' && e.fromDate && e.toDate ? e.fromDate + ' to ' + e.toDate + ' · ' : '') + fmtYM(entryYears(e)) + ')').join('; ');
const storedOf = (rec, k) => (k === 'form_no' ? ((rec.custom && rec.custom.cf_hr_form_reference) || '') : rec[k]);
// A Vaccination value means the same thing in both spellings ("3rd Dose" on the register = "Completed").
const hepSame = (a, b) => { const n = (x) => (/^(completed|3rd dose)$/i.test(String(x || '').trim()) ? 'c' : key(x)); return n(a) === n(b); };

function planUpdate(p, rec) {
  const f = p.fields || {};
  const rows = [];
  FIELDS.forEach(([k, label, kind]) => {
    if (k === 'prior_experience_entries') {
      const add = f.prior_experience_entries || [];
      if (!add.length) return;
      const have = rec && Array.isArray(rec.prior_experience_entries) ? rec.prior_experience_entries.filter((e) => e && (e.org || e.dept || entryYears(e) > 0)) : [];
      const form = expStr(add);
      if (!rec) return rows.push({ key: k, label, kind: 'new', stored: '', form, value: add });
      if (!have.length) {
        if (/fresher/i.test(String(rec.previous_experience || ''))) return rows.push({ key: k, label, kind: 'diff', stored: rec.previous_experience, form, value: add });
        return rows.push({ key: k, label, kind: 'fill', stored: '', form, value: add });
      }
      if (key(expStr(have)) === key(form)) return rows.push({ key: k, label, kind: 'same', stored: expStr(have), form, value: add });
      return rows.push({ key: k, label, kind: 'diff', stored: expStr(have), form, value: add });
    }
    const v = f[k];
    if (!v) return;
    if (!rec) return rows.push({ key: k, label, kind: 'new', stored: '', form: v, value: v });
    const s = storedOf(rec, k);
    if (kind === 'list') {
      const u = unionList(s, String(v).split(/\s*,\s*/).filter(Boolean));
      if (!clean(s)) return rows.push({ key: k, label, kind: 'fill', stored: '', form: v, value: u.value });
      if (!u.added.length) return rows.push({ key: k, label, kind: 'same', stored: s, form: v, value: s });
      return rows.push({ key: k, label, kind: 'fill', stored: s, form: v, value: u.value, added: u.added });
    }
    if (s == null || !clean(s)) return rows.push({ key: k, label, kind: 'fill', stored: '', form: v, value: v });
    if (k === 'hepatitis_b_vaccination' ? hepSame(s, v) : same(kind, s, v)) return rows.push({ key: k, label, kind: 'same', stored: s, form: v, value: s });
    rows.push({ key: k, label, kind: 'diff', stored: s, form: v, value: v });
  });
  return { rows };
}

/* The fields to write for the rows the administrator ticked (fill rows start ticked, diff rows not).
   `ticked` = Set/array of row keys. meta = { at:ISO, by, via }. Returns { patch, filled[], replaced{}, skipped[] }. */
function buildPatch(p, rec, plan, ticked, meta) {
  const on = new Set(Array.isArray(ticked) ? ticked : ticked ? Array.from(ticked) : []);
  const f = p.fields || {};
  const m = meta || {};
  const patch = {}; const filled = []; const replaced = {}; const skipped = [];
  (plan.rows || []).forEach((r) => {
    if (r.kind === 'same') return;
    if (!on.has(r.key)) { if (r.kind === 'diff') skipped.push(r.key); return; }
    if (r.key === 'form_no') { patch.custom = Object.assign({}, (rec && rec.custom) || {}, { cf_hr_form_reference: r.value }); }
    else patch[r.key] = r.value;
    if (r.kind === 'diff') replaced[r.key] = { old: r.stored, new: r.key === 'prior_experience_entries' ? r.form : r.value };
    else filled.push(r.key);
  });
  // Experience rows (or a new joining date) → the derived totals, the way the staff form saves them.
  const entries = patch.prior_experience_entries || (rec && rec.prior_experience_entries) || [];
  if (patch.prior_experience_entries || patch.doj) {
    const rowsHave = entries.some((e) => entryYears(e) > 0);
    const prior = rowsHave ? entries.reduce((s, e) => s + entryYears(e), 0) : (f.total_prev_years != null ? f.total_prev_years : (rec && +rec.prior_experience_years) || 0);
    const doj = patch.doj || (rec && rec.doj) || '';
    const now = (m.at || new Date().toISOString()).slice(0, 10);
    const unico = doj && doj <= now ? monthsBetween(doj, now) / 12 : 0;
    if (patch.prior_experience_entries) {
      patch.prior_experience_years = Math.round(prior * 100) / 100;
      patch.previous_experience = rowsHave ? expStr(entries) : ((rec && rec.previous_experience) || '');
    }
    patch.total_experience_years = Math.round((prior + unico) * 10) / 10;
    patch.total_experience_text = fmtYM(patch.total_experience_years);
  }
  const src = {
    type: 'Staff registration form', via: m.via || 'Staff Management → Paste & Update', imported_at: m.at || new Date().toISOString(),
    by: m.by || '', form_no: f.form_no || '', name_on_form: f.name || '', signature: f.signature || '',
    fields: p.raw || {}, filled, replaced, not_changed: skipped, warnings: p.warnings || [],
  };
  const changed = Object.keys(patch).length > 0;
  if (changed || !rec) {
    patch.import_source = src;
    const hist = rec && Array.isArray(rec.import_source_history) ? rec.import_source_history.slice(-19) : [];
    patch.import_source_history = hist.concat([src]);
  }
  return { patch, filled, replaced, skipped, changed };
}

// A brand-new register row from the form (the caller adds id / is_active / created_at, as store.create does).
function newRecord(p, plan, ticked, meta) {
  const b = buildPatch(p, null, plan, ticked, meta);
  const r = Object.assign({ name: p.fields.name || '', role: p.fields.role || 'Nurse', designation: p.fields.designation || '', current_department: p.fields.current_department || '', remarks: '', notes: [], former: false }, b.patch);
  if (!r.prior_experience_entries) r.prior_experience_entries = [];
  if (r.previous_experience == null) r.previous_experience = '';
  if (r.prior_experience_years == null) r.prior_experience_years = 0;
  if (r.total_experience_years == null) { r.total_experience_years = 0; r.total_experience_text = '0 mo'; }
  return r;
}

const AI_PROMPT = [
  'You are reading UNICO Hospitals staff registration forms (Nurse / PCA). The photos or scans are attached.',
  'For EACH form write one block exactly like the template below, in English, one field per line.',
  'Rules:',
  '- Write "-" when a box is empty, not ticked or cannot be read. NEVER guess or fill in a value that is not on the form.',
  '- Dates as DD/MM/YYYY (write the month name if the form has no day, e.g. April 2016).',
  '- Phone numbers exactly as written, digits only (11 digits, starting 01).',
  '- Lists (qualifications, trainings, activities, languages) separated by "; ".',
  '- Previous experience: one line per job, starting with "- ", fields separated by " | ".',
  '- Hepatitis-B: write exactly one of Not started | 1st Dose | 2nd Dose | 3rd Dose | Booster | Unknown.',
  '- If a box is hard to read, write your best reading AND list the box under "Unclear".',
  '- Do not add any other text, headings or notes outside the blocks.',
  '',
  '### STAFF 1',
  'Name:',
  'Role: Nurse | PCA | Trainee Nurse',
  'Designation:',
  'Form Number:',
  'Employee ID:',
  'Phone:',
  'Alternative Phone:',
  'Date of Birth:',
  'Gender:',
  'Qualifications:',
  'Department:',
  'Date of Joining UNICO:',
  'Previous Experience:',
  '- Organisation | Unit/Ward | From DD/MM/YYYY | To DD/MM/YYYY | (x yrs y mos)',
  'Total Previous Experience:',
  'Special Training:',
  'Extracurricular Activities:',
  'Languages:',
  'BNMC Licence No:',
  'BNMC Licence Expiry:',
  'Hepatitis-B Vaccination:',
  'NID / Passport:',
  'Blood Group:',
  'Emergency Contact: number (relation)',
  'Signature name:',
  'Unclear:',
  '',
  '### STAFF 2',
  '(same fields for the next form)',
].join('\n');

const API = { parseText, parsePerson, splitPeople, matchPerson, planUpdate, buildPatch, newRecord, parseDate, parsePhone, parseHepB, parseRole, parseExperience, fmtYM, entryYears, FIELDS, FIELD_LABEL, LABELS, AI_PROMPT };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else root.UNICO_SI = API;
})(typeof window !== 'undefined' ? window : globalThis);
