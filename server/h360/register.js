// The IPD Admission list of H360 (/ipd/ipd-admission), turned into plain rows.
// The page is only opened and read: what it loads by itself is taken as it
// comes, either from the data query the page makes or from the table it draws.
// Nothing here knows the page's columns in advance; a column is recognised by
// its name, and what was recognised is kept with the run so it can be checked.
const crypto = require('crypto');
const views = require('./views');

const text = (value) => (value === null || value === undefined ? '' : String(value).trim());
const keyName = (value) => text(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

// What each log sheet field may be called, most exact name first. The first
// group are the names H360 itself uses in its admission records.
const FIELDS = {
  admissionNo: [/^admission_no_pk$/, /^admission_(no|id)$/],
  ipNo: [/^admission_uid$/, /^ip_?(d_)?(no|number|id)$/, /^admission_(code|number|uid)$/],
  uhid: [/^patient_code$/, /^uhid$/, /^mrn?(_no)?$/, /^(hospital|patient)_(id|uid|no|reg_no)$/],
  name: [/^patient_name$/, /^name(_of_patient)?$/, /^patient$/],
  age: [/^age$/, /^patient_age$/],
  gender: [/^gender$/, /^sex$/],
  bed: [/^bed_name$/, /^bed(_no|_number)?$/, /bed(?!_category)/],
  ward: [/^ward_name$/, /^nurse_station$/, /^(ward|bed_category|station|unit)$/, /ward|station/],
  consultant: [/^primary_doctor_name$/, /^consultant(_name)?$/, /^doctor(_name)?$/, /consultant|doctor/],
  department: [/^doc_department$/, /^department(_name)?$/, /department/],
  admittedAt: [/^admission_date$/, /^admission_(date_?time|time)$/, /^(doa|ip_date|admit(ted)?_(at|on|date))$/, /admission.*date|date.*admission/],
  dischargedAt: [/^dis_datetime$/, /^dis_date$/, /^discharged?_(date_?time|date|at|on|time)$/, /^dod$/, /discharge.*(date|time)/],
  discharged: [/^dis_ind$/, /^(is_)?discharged?(_ind)?$/],
  dischargeType: [/^dis_reason$/, /^discharged?_(type|reason|mode|status)$/, /^(type_of_discharge|outcome)$/, /discharge.*(type|reason|mode)/],
  status: [/^status$/, /^(admission|patient|current)_status$/, /status/],
  death: [/^death_ind$/, /^(is_)?(dead|death|expired)$/],
  billing: [/^bill(ing)?_(status|clearance|clear)$/, /bill.*(status|clear)|clearance/],
  diagnosis: [/^dis_diagnosis$/, /^(final_|provisional_)?diagnosis$/, /diagnos/],
  emergency: [/^emergency_ind$/],
};

// "2026-10-11 11:49:22", "11/10/2026 11:49 AM", "11-10-2026", "11-Oct-2026 13:05" -> "2026-10-11 11:49:22"
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function stamp(value) {
  const s = text(value);
  const pad = (n) => String(n).padStart(2, '0');
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return `${m[1]}-${m[2]}-${m[3]} ${pad(m[4] || 0)}:${m[5] || '00'}:${m[6] || '00'}`;
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2}|[A-Za-z]{3,9})[\/.-](\d{4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?/);
  if (!m) return '';
  const month = /^\d+$/.test(m[2]) ? Number(m[2]) : MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
  if (month < 1 || month > 12) return '';
  let hour = Number(m[4] || 0);
  if (m[7]) hour = (hour % 12) + (/p/i.test(m[7]) ? 12 : 0);
  return `${m[3]}-${pad(month)}-${pad(m[1])} ${pad(hour)}:${m[5] || '00'}:${m[6] || '00'}`;
}

const yes = (value) => /^(1|y|yes|true)$/i.test(text(value));

const DEATH = /death|expired|died|deceased|\bdead\b/i;
const LAMA = /\blama\b|\bdama\b|\bdorb\b|risk bond|against medical|abscond/i;

// How a patient left, as far as the row says: 'death', 'lama', 'discharged' or ''.
function outcomeOf(fields) {
  const said = [fields.dischargeType, fields.status].join(' ');
  if (yes(fields.death) || DEATH.test(said)) return 'death';
  if (LAMA.test(said)) return 'lama';
  if (yes(fields.discharged) || fields.dischargedAt || /discharg/i.test(said)) return 'discharged';
  return '';
}

// Which column answers which field, for one set of column names.
function recognise(names) {
  const byKey = names.map((name) => [name, keyName(name)]);
  const found = {};
  const taken = new Set();
  // Exact names first, for every field, before any looser match: 'bill_status' is the
  // billing column even though it also contains 'status'.
  const most = Math.max(...Object.values(FIELDS).map((patterns) => patterns.length));
  for (let rank = 0; rank < most; rank++) {
    for (const [field, patterns] of Object.entries(FIELDS)) {
      if (found[field] || !patterns[rank]) continue;
      const hit = byKey.find(([name, key]) => !taken.has(name) && patterns[rank].test(key));
      if (hit) {
        found[field] = hit[0];
        taken.add(hit[0]);
      }
    }
  }
  return found;
}

// The rows of one answer of the page: { data: [...] }, { aaData: [...] }, a paginator, or a bare list.
function rowsIn(body) {
  if (Array.isArray(body)) return { rows: body, total: body.length };
  if (!body || typeof body !== 'object') return null;
  for (const key of ['data', 'aaData', 'rows', 'result', 'records']) {
    const value = body[key];
    if (Array.isArray(value)) return { rows: value, total: Number(body.recordsFiltered || body.recordsTotal || body.total) || value.length };
    if (value && Array.isArray(value.data)) return { rows: value.data, total: Number(value.total) || value.data.length };
  }
  return null;
}

const UNWANTED = /^(action|actions|photo|patient_photo|button|buttons|dt_rowindex|dt_row_index)$/;

// answers: the JSON the page loaded by itself ({ path, method, body }); html: the page as drawn.
function parse({ answers = [], html = '' } = {}) {
  const tables = html ? views.plainTables(html) : [];
  const candidates = [];
  for (const answer of answers) {
    const found = rowsIn(answer.body);
    if (!found || !found.rows.length) continue;
    const first = found.rows[0];
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      const names = [...new Set(found.rows.slice(0, 20).flatMap((row) => Object.keys(row || {})))].filter((name) => !UNWANTED.test(keyName(name)));
      candidates.push({ source: 'query', path: answer.path, names, total: found.total, objects: found.rows.map((row) => row || {}) });
    } else if (Array.isArray(first)) {
      // Rows without names: the headings of the drawn table with as many columns name them.
      const table = tables.find((t) => t.headers.length === first.length);
      if (table) {
        candidates.push({
          source: 'query', path: answer.path, names: table.headers, total: found.total,
          objects: found.rows.map((row) => Object.fromEntries(table.headers.map((name, i) => [name, row[i]]))),
        });
      }
    }
  }
  for (const table of tables) {
    if (!table.rows.length) continue;
    candidates.push({
      source: 'table', path: views.REGISTER_PATH, names: table.headers, total: table.rows.length,
      objects: table.rows.map((row) => Object.fromEntries(table.headers.map((name, i) => [name, row[i]]))),
    });
  }

  // The list of patients is the one where a patient's name or number was recognised; the longest wins.
  let best = null;
  for (const candidate of candidates) {
    candidate.columns = recognise(candidate.names);
    const score = (candidate.columns.name ? 2 : 0) + (candidate.columns.uhid ? 2 : 0) + (candidate.columns.ipNo ? 1 : 0) + (candidate.columns.admittedAt ? 1 : 0);
    if (score < 2) continue;
    candidate.score = score * 10000 + candidate.objects.length + (candidate.source === 'query' ? 0.5 : 0);
    if (!best || candidate.score > best.score) best = candidate;
  }
  if (!best) {
    return {
      rows: [],
      shape: { found: false, tables: tables.map((t) => t.headers), queries: answers.map((a) => a.path) },
    };
  }

  const rows = best.objects.slice(0, 2000).map((object) => {
    const raw = {};
    for (const name of best.names) {
      const value = object[name];
      if (value === null || value === undefined || typeof value === 'object') continue;
      const plain = views.plainText(value).slice(0, 600);
      // Dots and dollar signs cannot be part of a stored field name.
      if (plain) raw[name.replace(/[.$]/g, ' ').trim() || 'column'] = plain;
    }
    const fields = {};
    for (const [field, name] of Object.entries(best.columns)) fields[field] = raw[name.replace(/[.$]/g, ' ').trim()] || '';
    fields.admittedAt = stamp(fields.admittedAt);
    fields.dischargedAt = stamp(fields.dischargedAt);
    fields.outcome = outcomeOf(fields);
    const key = fields.admissionNo || [fields.uhid, fields.ipNo].join('|');
    return {
      key: key !== '|' && key ? key : crypto.createHash('sha1').update(JSON.stringify(raw)).digest('hex'),
      fields,
      raw,
    };
  });
  return {
    rows,
    shape: {
      found: true, source: best.source, path: best.path, total: best.total, read: rows.length,
      columns: best.names.slice(0, 200), recognised: best.columns,
      missing: Object.keys(FIELDS).filter((field) => !best.columns[field]),
    },
  };
}

module.exports = { parse, stamp, outcomeOf, recognise, FIELDS };
