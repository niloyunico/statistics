// Where a collection is kept. There are two places, written by the same code:
//
//   the hospital PC's own MongoDB  - everything that was read, as the
//       stand-alone collector kept it (same database, same collections), and
//   the app's shared database      - what the live site works from. How much
//       goes there is the administrator's choice: 'sheet' keeps only what the
//       supervisor log sheet prints, 'all' also keeps every record.
const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const STATION_COLUMN = 'Nurse Station';

const LOCAL = { patients: 'patients', modules: 'modules', runs: 'runs', templates: 'templates', register: 'register' };
const SHARED = { patients: 'h360Patients', modules: 'h360Modules', runs: 'h360Runs', templates: 'h360Templates', register: 'h360Register' };

// What the log sheet needs of a patient; the rest (contact numbers, address,
// attendants, alerts) stays on the hospital PC under 'sheet'.
const SHEET_COLUMNS = [STATION_COLUMN, 'Bed No', 'Patient Name', 'UHID', 'IP No', 'IP Date', 'Age', 'Gender', 'Consultant', 'Department', 'Bed Category', 'Records'];
const SHEET_ADMISSION = [
  'admission_no_pk', 'admission_uid', 'admission_date', 'bed_name', 'ward_name', 'nurse_station', 'patient_name', 'patient_code',
  'primary_doctor_name', 'doc_department', 'dis_req_ind', 'dis_ind', 'dis_datetime', 'dis_reason', 'death_ind', 'death_declared_time',
  'status', 'emergency_ind', 'baby_born_ind',
];
const SHEET_PROFILE = ['Age', 'Gender'];
const only = (object, keys) => Object.fromEntries(keys.filter((key) => object && object[key] !== undefined && object[key] !== null).map((key) => [key, object[key]]));

const ready = new WeakMap();

// A store: one database and the names its collections go by there.
function open(db, names) {
  const store = { db, names, col: (name) => db.collection(names[name]) };
  if (!ready.has(db)) ready.set(db, new Map());
  const made = ready.get(db);
  if (!made.has(names)) {
    made.set(names, (async () => {
      await store.col('patients').createIndex({ key: 1 }, { unique: true });
      await store.col('patients').createIndex({ lastRunId: 1, seq: 1 });
      await store.col('patients').createIndex({ active: 1, station: 1 });
      await store.col('patients').createIndex({ admissionNo: 1 });
      await store.col('modules').createIndex({ admissionNo: 1, key: 1 }, { unique: true });
      await store.col('modules').createIndex({ lastRunId: 1 });
      await store.col('runs').createIndex({ collectedAt: -1 });
      await store.col('register').createIndex({ key: 1 }, { unique: true });
      await store.col('register').createIndex({ 'fields.uhid': 1 });
    })().catch((err) => {
      made.delete(names);
      throw err;
    }));
  }
  store.ready = made.get(names);
  return store;
}

const findColumn = (columns, pattern) => columns.find((name) => pattern.test(name));

// One document per admission: the same patient collected again updates the
// existing document instead of adding a copy.
function identify(row, columns) {
  const uhid = row[findColumn(columns, /^uhid$/i)] || '';
  const ipNo = row[findColumn(columns, /^ip\s*no$/i)] || '';
  if (uhid || ipNo) return { key: `${uhid}|${ipNo}`, uhid, ipNo };
  const key = crypto.createHash('sha1').update(JSON.stringify(row)).digest('hex');
  return { key, uhid, ipNo };
}

const chunks = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));
async function writeAll(collection, operations) {
  for (const part of chunks(operations, 500)) await collection.bulkWrite(part, { ordered: false });
}

// Saves one collection.
//   level       'full' (the PC's own store), 'all' or 'sheet' (the shared database)
//   suggestions what the records say about each patient (see sheets.js), kept on the patient
//   records     every record with data of the latest collection, to bring the shared database up to date ('all')
//   site        'pc' or 'cloud': where the collection ran
async function save(store, snapshot, { level = 'full', suggestions = null, records = null, site = '' } = {}) {
  await store.ready;
  const patients = store.col('patients');
  const runId = new ObjectId();
  const collectedAt = new Date(snapshot.collectedAt);
  const sheet = level === 'sheet';
  const columns = sheet ? SHEET_COLUMNS : snapshot.columns;

  // A list-only refresh from the live site has read no records, so it leaves the count of records as it was.
  const keepCount = level !== 'full' && !records && snapshot.mode === 'list';
  const dataOf = (row) => (keepCount
    ? Object.fromEntries(Object.entries(row).filter(([name]) => name !== 'Records').map(([name, value]) => ['data.' + name, value]))
    : { data: row });
  const operations = snapshot.rows.map((row, seq) => {
    const { key, uhid, ipNo } = identify(row, snapshot.columns);
    const detail = snapshot.patients[seq];
    const suggestion = suggestions && suggestions.get(detail.admissionNo);
    return {
      updateOne: {
        filter: { key },
        update: {
          $set: {
            uhid, ipNo, station: row[STATION_COLUMN], ...dataOf(sheet ? only(row, SHEET_COLUMNS) : row), seq, lastSeenAt: collectedAt, lastRunId: runId, active: true,
            admissionNo: detail.admissionNo, patientNo: detail.patientNo,
            admission: sheet ? only(detail.admission, SHEET_ADMISSION) : detail.admission,
            // The header, alerts and menu time are only replaced when the menu pages were read this time.
            ...(detail.profile ? { profile: sheet ? only(detail.profile, SHEET_PROFILE) : detail.profile } : {}),
            ...(detail.alerts ? { alerts: sheet ? {} : detail.alerts } : {}),
            ...(detail.menusAt ? { menusAt: new Date(detail.menusAt) } : {}),
            ...(suggestion ? { suggestion } : {}),
          },
          $unset: { inactiveSince: '' },
          $setOnInsert: { firstSeenAt: collectedAt, ...(detail.profile ? {} : { profile: {} }), ...(detail.alerts ? {} : { alerts: {} }) },
        },
        upsert: true,
      },
    };
  });
  await writeAll(patients, operations);

  if (level === 'full') {
    // One document per patient per record, replaced on every run.
    const moduleOperations = snapshot.patients.flatMap((detail, seq) =>
      (detail.modules || []).map((module) => ({
        replaceOne: {
          filter: { admissionNo: detail.admissionNo, key: module.key },
          replacement: {
            ...module,
            admissionNo: detail.admissionNo,
            patientNo: detail.patientNo,
            patientName: snapshot.rows[seq]['Patient Name'],
            uhid: snapshot.rows[seq].UHID,
            hasData: module.entries.length > 0 || module.values.length > 0,
            fetchedAt: new Date(module.fetchedAt),
            lastRunId: runId,
          },
          upsert: true,
        },
      }))
    );
    // Records a quick update did not read again stay part of the latest collection as they are.
    for (const detail of snapshot.patients) {
      if (detail.kept && detail.kept.length) {
        moduleOperations.push({
          updateMany: { filter: { admissionNo: detail.admissionNo, key: { $in: detail.kept } }, update: { $set: { lastRunId: runId } } },
        });
      }
    }
    await writeAll(store.col('modules'), moduleOperations);
    if (snapshot.templates && snapshot.templates.length) {
      await store.col('templates').bulkWrite(
        snapshot.templates.map((_id) => ({ updateOne: { filter: { _id }, update: { $setOnInsert: { learnedAt: collectedAt } }, upsert: true } })),
        { ordered: false }
      );
    }
  } else if (level === 'all') {
    await syncRecords(store, runId, snapshot, records);
  }

  // The IPD Admission list: one document per admission, kept from run to run.
  const register = snapshot.register || { rows: [], shape: { found: false } };
  await writeAll(store.col('register'), register.rows.map((row) => ({
    updateOne: {
      filter: { key: row.key },
      update: {
        $set: { fields: row.fields, ...(sheet ? {} : { raw: row.raw }), lastSeenAt: collectedAt, lastRunId: runId },
        ...(sheet ? { $unset: { raw: '' } } : {}),
        $setOnInsert: { firstSeenAt: collectedAt },
      },
      upsert: true,
    },
  })));

  // Patients missing from this run have left the stations (discharged or moved).
  // Those of a station whose list could not be read are left as they were.
  await patients.updateMany(
    { active: true, lastRunId: { $ne: runId }, ...((snapshot.failedStations || []).length ? { station: { $nin: snapshot.failedStations } } : {}) },
    { $set: { active: false, inactiveSince: collectedAt } }
  );

  await store.col('runs').insertOne({
    _id: runId,
    collectedAt,
    source: snapshot.source,
    columns,
    stations: snapshot.stations,
    stationList: snapshot.stationList || [],
    warnings: snapshot.warnings,
    skipped: snapshot.skipped,
    mode: snapshot.mode,
    total: snapshot.rows.length,
    site,
    level,
    register: { ...register.shape, rows: register.rows.length },
  });
  return runId;
}

// Brings the records in the shared database in line with the latest collection:
// records read again are replaced, the others are only marked as current.
async function syncRecords(store, runId, snapshot, records) {
  const modules = store.col('modules');
  const active = snapshot.patients.map((detail) => detail.admissionNo);
  if (!records) {
    // A list-only refresh: every record already there stays current.
    if (active.length) await modules.updateMany({ admissionNo: { $in: active } }, { $set: { lastRunId: runId } });
    return;
  }
  const have = new Map();
  for await (const doc of modules.find({ admissionNo: { $in: active } }, { projection: { admissionNo: 1, key: 1, fetchedAt: 1 } })) {
    have.set(doc.admissionNo + '|' + doc.key, doc.fetchedAt ? new Date(doc.fetchedAt).getTime() : 0);
  }
  const operations = [];
  const current = new Map();
  for (const record of records) {
    if (!active.includes(record.admissionNo)) continue;
    if (!current.has(record.admissionNo)) current.set(record.admissionNo, []);
    current.get(record.admissionNo).push(record.key);
    if (have.get(record.admissionNo + '|' + record.key) === new Date(record.fetchedAt).getTime()) continue;
    const { _id, ...rest } = record;
    operations.push({ replaceOne: { filter: { admissionNo: record.admissionNo, key: record.key }, replacement: { ...rest, lastRunId: runId }, upsert: true } });
  }
  await writeAll(modules, operations);
  await writeAll(modules, [...current].map(([admissionNo, keys]) => ({
    updateMany: { filter: { admissionNo, key: { $in: keys } }, update: { $set: { lastRunId: runId } } },
  })));
}

const latestRun = async (store) => {
  await store.ready;
  return store.col('runs').find().sort({ collectedAt: -1 }).limit(1).next();
};

// What the next collection needs to know about the last one: which records
// each patient has and whether they held data, the page furniture already
// recognised, and the stations that were asked for.
async function loadMemory(store) {
  const run = await latestRun(store);
  const known = new Map();
  if (run) {
    const patients = store.col('patients').find({ lastRunId: run._id }, { projection: { admissionNo: 1, profile: 1, menusAt: 1 } });
    for await (const patient of patients) {
      known.set(patient.admissionNo, { docs: [], profile: patient.profile || {}, menusAt: patient.menusAt || null });
    }
    const wanted = { admissionNo: 1, key: 1, group: 1, hasData: 1, fetchedAt: 1, reader: 1, url: 1, label: 1, tab: 1, seq: 1 };
    for await (const doc of store.col('modules').find({ lastRunId: run._id }, { projection: wanted })) {
      const patient = known.get(doc.admissionNo);
      if (patient) patient.docs.push({ ...doc, hasData: Boolean(doc.hasData) });
    }
  }
  const templates = new Set((await store.col('templates').find().project({ _id: 1 }).toArray()).map((doc) => doc._id));
  const withStations = await store.col('runs').find({ 'stationList.0': { $exists: true } }).sort({ collectedAt: -1 }).limit(1).next();
  return { known, templates, stationList: withStations ? withStations.stationList : [] };
}

async function loadLatest(store) {
  const run = await latestRun(store);
  if (!run) return null;
  const docs = await store.col('patients').find({ lastRunId: run._id }).sort({ seq: 1 }).toArray();
  return {
    collectedAt: run.collectedAt.toISOString(),
    source: run.source,
    columns: run.columns,
    stations: run.stations,
    warnings: run.warnings,
    skipped: run.skipped || [],
    mode: run.mode,
    site: run.site || '',
    register: run.register || null,
    // _adm links a row to its full record; it is not a column.
    rows: docs.map((doc) => ({ ...doc.data, _adm: doc.admissionNo })),
  };
}

async function loadPatient(store, admissionNo) {
  await store.ready;
  const patient = await store.col('patients').findOne({ admissionNo }, { sort: { lastSeenAt: -1 } });
  if (!patient) return null;
  const modules = await store
    .col('modules')
    .find({ admissionNo, lastRunId: patient.lastRunId }, { projection: { _id: 0, lastRunId: 0 } })
    .sort({ seq: 1, group: 1, key: 1 })
    .toArray();
  return {
    row: patient.data,
    profile: patient.profile || {},
    alerts: patient.alerts || {},
    admission: patient.admission || {},
    lastSeenAt: patient.lastSeenAt,
    modules,
  };
}

// Every record with saved data from the latest collection.
async function loadRecords(store) {
  const run = await latestRun(store);
  if (!run) return [];
  return store
    .col('modules')
    .find({ lastRunId: run._id, hasData: true }, { projection: { _id: 0, lastRunId: 0 } })
    .sort({ seq: 1, group: 1, key: 1 })
    .toArray();
}

// The IPD Admission list as last read, newest admissions first.
async function loadRegister(store, limit = 1000) {
  await store.ready;
  const run = await store.col('runs').find({ 'register.found': true }).sort({ collectedAt: -1 }).limit(1).next();
  if (!run) return { collectedAt: null, shape: null, rows: [] };
  const docs = await store.col('register').find({ lastRunId: run._id }).sort({ 'fields.admittedAt': -1 }).limit(limit).toArray();
  return { collectedAt: run.collectedAt.toISOString(), shape: run.register, rows: docs.map(({ fields, raw }) => ({ fields, raw: raw || null })) };
}

// Takes the full records and the extra patient details out of the shared database,
// for when it is to hold the log sheet content only.
async function trimToSheet(store) {
  await store.ready;
  const removed = await store.col('modules').deleteMany({});
  const operations = [];
  for await (const doc of store.col('patients').find({}, { projection: { data: 1, admission: 1, profile: 1 } })) {
    operations.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { data: only(doc.data, SHEET_COLUMNS), admission: only(doc.admission, SHEET_ADMISSION), profile: only(doc.profile, SHEET_PROFILE), alerts: {} } },
      },
    });
  }
  await writeAll(store.col('patients'), operations);
  await store.col('register').updateMany({}, { $unset: { raw: '' } });
  await store.col('runs').updateMany({}, { $set: { columns: SHEET_COLUMNS } });
  return { records: removed.deletedCount, patients: operations.length };
}

const pad = (n) => String(n).padStart(2, '0');

function excelName(snapshot) {
  const d = new Date(snapshot.collectedAt);
  return `unico-patients-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.xlsx`;
}

function buildWorkbook(snapshot, records = [], admissions = null) {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet('Patients', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = snapshot.columns.map((name) => {
    const longest = snapshot.rows.reduce((max, row) => Math.max(max, String(row[name] || '').length), name.length);
    return { header: name, key: name, width: Math.min(Math.max(longest + 2, 10), 45) };
  });
  // Values stay text so IDs such as UHID keep their exact digits.
  for (const row of snapshot.rows) sheet.addRow(snapshot.columns.map((name) => row[name] || ''));
  sheet.getRow(1).font = { bold: true };
  if (snapshot.columns.length) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: snapshot.columns.length } };
  }

  const summary = workbook.addWorksheet('Summary');
  summary.columns = [
    { header: 'Nurse Station', key: 'station', width: 32 },
    { header: 'Patients', key: 'count', width: 12 },
  ];
  for (const item of snapshot.stations) summary.addRow(item);
  summary.addRow({ station: 'Total', count: snapshot.rows.length });
  summary.addRow({});
  summary.addRow({ station: 'Collected at', count: new Date(snapshot.collectedAt).toLocaleString() });
  summary.getRow(1).font = { bold: true };
  summary.getRow(snapshot.stations.length + 2).font = { bold: true };

  if (admissions && admissions.rows.length) {
    const names = admissions.rows.some((row) => row.raw)
      ? [...new Set(admissions.rows.flatMap((row) => Object.keys(row.raw || {})))]
      : [...new Set(admissions.rows.flatMap((row) => Object.keys(row.fields || {})))];
    const from = (row) => row.raw || row.fields || {};
    const list = workbook.addWorksheet('IPD Admission', { views: [{ state: 'frozen', ySplit: 1 }] });
    list.addRow(names);
    for (const row of admissions.rows) list.addRow(names.map((name) => from(row)[name] || ''));
    list.getRow(1).font = { bold: true };
    list.columns.forEach((column, i) => {
      column.width = Math.min(Math.max(admissions.rows.reduce((max, row) => Math.max(max, String(from(row)[names[i]] || '').length), names[i].length) + 2, 10), 45);
    });
  }

  addRecordSheets(workbook, snapshot, records);
  return workbook;
}

const WHO = ['Nurse Station', 'Bed No', 'Patient Name', 'UHID', 'IP No'];

// One sheet per kind of record (Vital Sign, Follow-up Notes, ...) holding
// every patient's entries, plus one sheet with all assessment form values.
function addRecordSheets(workbook, snapshot, records) {
  const rowOf = new Map(snapshot.rows.map((row) => [row._adm, row]));
  const who = (record) => WHO.map((name) => (rowOf.get(record.admissionNo) || {})[name] || '');
  const used = new Set(workbook.worksheets.map((sheet) => sheet.name.toLowerCase()));
  const sheetName = (wanted) => {
    // Excel sheet names: 31 characters at most, none of [ ] : * ? / \
    const base = wanted.replace(/[\[\]:*?\/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 28) || 'Records';
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base} ${n}`;
    used.add(name.toLowerCase());
    return name;
  };
  const finish = (sheet, widths) => {
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.columns.forEach((column, i) => { column.width = Math.min(Math.max(widths[i] + 2, 10), 60); });
  };

  const sheets = new Map();
  const formValues = [];
  for (const record of records) {
    const name = record.group || record.label;
    for (const entry of record.entries) {
      const width = Math.max(entry.columns.length, ...entry.rows.map((row) => row.length));
      const columns = Array.from({ length: width }, (_, i) => entry.columns[i] || `Column ${i + 1}`);
      // Tables with the same columns share a sheet; the Record column says which chart or day a row is from.
      const id = JSON.stringify([name, columns]);
      if (!sheets.has(id)) sheets.set(id, { title: !record.group && entry.title && entry.title !== name ? `${name} - ${entry.title}` : name, columns, rows: [] });
      const from = [record.group ? record.label : '', record.group || sheets.get(id).title.endsWith(entry.title) ? '' : entry.title].filter(Boolean).join(' - ');
      for (const row of entry.rows) sheets.get(id).rows.push([...who(record), from, ...row]);
    }
    for (const value of record.values) {
      formValues.push([...who(record), record.group ? `${record.group} - ${record.label}` : record.label, value.section, value.label, value.value]);
    }
  }

  const write = (title, header, rows) => {
    const sheet = workbook.addWorksheet(sheetName(title));
    sheet.addRow(header);
    for (const row of rows) sheet.addRow(row);
    finish(sheet, header.map((name, i) => rows.reduce((max, row) => Math.max(max, String(row[i] || '').length), name.length)));
  };
  for (const { title, columns, rows } of sheets.values()) {
    const dated = rows.some((row) => row[WHO.length]);
    const header = [...WHO, ...(dated ? ['Record'] : []), ...columns];
    write(title, header, rows.map((row) => (dated ? row : [...row.slice(0, WHO.length), ...row.slice(WHO.length + 1)])));
  }
  if (formValues.length) write('Assessment values', [...WHO, 'Record', 'Section', 'Field', 'Value'], formValues);
}

module.exports = {
  LOCAL, SHARED, SHEET_COLUMNS, open, save, latestRun, loadMemory, loadLatest, loadPatient, loadRecords, loadRegister, trimToSheet,
  buildWorkbook, excelName,
};
