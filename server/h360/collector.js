// One collection from H360: the patients of every nurse station, their
// Nurse's Tab and Doctors Tab records, and the IPD Admission list. How H360 is
// reached (a browser on the hospital PC, or plain requests from the live
// server) is the session's business; what is read is decided here.
const crypto = require('crypto');
const views = require('./views');
const register = require('./register');

const STATION_COLUMN = 'Nurse Station';
const COLUMNS = [
  STATION_COLUMN, 'Bed No', 'Patient Name', 'UHID', 'IP No', 'IP Date', 'Age', 'Gender', 'Patient Type',
  'Blood Group', 'Consultant', 'Department', 'Bed Category', 'Allergies Alert', 'Vulnerability Alert',
  'Clinical Alert', 'Contact No', 'Address', 'Accompanied By', 'Relation', 'Attendant Mobile', 'Records',
];

const text = (value) => (value === null || value === undefined ? '' : String(value).trim());
const yesNo = (value) => (String(value) === '1' ? 'Yes' : 'No');

// "2026-10-11 11:49:22" -> "11/10/2026 11:49"
function displayDate(value) {
  const match = text(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}:\d{2}))?/);
  return match ? `${match[3]}/${match[2]}/${match[1]}${match[4] ? ' ' + match[4] : ''}` : text(value);
}

function limiter(max) {
  let active = 0;
  const waiting = [];
  const next = () => {
    if (active >= max || !waiting.length) return;
    active++;
    const { task, resolve, reject } = waiting.shift();
    task().then(resolve, reject).finally(() => {
      active--;
      next();
    });
  };
  return (task) =>
    new Promise((resolve, reject) => {
      waiting.push({ task, resolve, reject });
      next();
    });
}

function slotReader(session, cfg) {
  const slot = limiter(cfg.concurrency);
  // Opens one view-only page as the fragment H360 serves to its own scripts.
  return (url) =>
    slot(async () => {
      const target = views.assertReadOnly(url, cfg.baseUrl);
      let lastError;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          return await session.get(target.href);
        } catch (err) {
          lastError = err;
          if (/signed us out/.test(err.message)) throw err;
        }
      }
      return { status: 0, html: '', error: lastError.message.split('\n')[0] };
    });
}

const pad2 = (n) => String(n).padStart(2, '0');
const dayString = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());

// How long a stored record stays good enough in a quick update. Notes, vital
// signs and handovers change through the day and are read every time; the rest
// is read again only when it has become old. A full collection ignores all this.
const HOUR = 60 * 60 * 1000;
const EVERY_RUN = new Set([
  'consultation-note', 'progress-note', 'nurse-special-note', 'ipd-vital-entry', 'intake-output-chart',
  'ipd-doctor-handover-sheet-bundle', 'ipd-doctor-shift-handover-edit', 'ot-procedure-note',
]);
const EVERY_TWO_HOURS = new Set([
  'v2-ipd-patient-medicine', 'v2-ipd-patient-investigation', 'ipd-in-patient-investigation-profile',
  'glucose-monitoring-chart', 'problem-list',
]);
// Raised when the way pages are read changes, so that records stored by an
// older reader are read once more instead of waiting to become old.
const READER = 2;
const GOOD_FOR = { twoHourly: 2 * HOUR, withData: 8 * HOUR, empty: 24 * HOUR, menus: 12 * HOUR };
const DATED = /-(\d{4}-\d{2}-\d{2})$/;

// Spreads the re-reads of one kind of record over time, so that they do not
// all fall due in the same run.
function spread(admissionNo, key) {
  let sum = 0;
  for (const ch of admissionNo + key) sum += ch.charCodeAt(0);
  return 0.75 + (sum % 50) / 100;
}

function isStale(doc, admissionNo, now) {
  if (EVERY_RUN.has(doc.key) || !doc.fetchedAt) return true;
  if (doc.hasData && (doc.reader || 1) < READER) return true;
  const goodFor = EVERY_TWO_HOURS.has(doc.key) ? GOOD_FOR.twoHourly : doc.hasData ? GOOD_FOR.withData : GOOD_FOR.empty;
  return now - new Date(doc.fetchedAt).getTime() > goodFor * spread(admissionNo, doc.key);
}

// known: what the last collection stored for this patient ({ docs, profile, menusAt }), or null.
// mode: 'full' reads everything, 'quick' reads what has gone stale, 'list' reads no records at all.
async function collectPatient(read, cfg, patient, { known, mode }) {
  const was = new Map((known ? known.docs : []).map((doc) => [doc.key, doc]));
  const quick = mode !== 'full' && was.size > 0;
  const now = Date.now();
  const fill = (pattern) => cfg.baseUrl + pattern.replace('{admission}', patient.admissionNo);
  // Records left unread this time; what was stored for them stays current.
  const kept = [];
  const finish = (modules) => {
    patient.modules = modules;
    patient.kept = kept;
    patient.keptWithData = kept.filter((key) => was.get(key).hasData).length;
  };

  if (mode === 'list') {
    if (known) patient.profile = known.profile;
    kept.push(...was.keys());
    return finish([]);
  }

  // The menu pages only say which records a patient has, which rarely changes.
  const readMenus = !quick || !known.menusAt || now - new Date(known.menusAt).getTime() > GOOD_FOR.menus;
  let modules;
  if (readMenus) {
    const [tabPage, notePage, doctorPage] = await Promise.all([
      read(fill(views.PATIENT_PAGES.nursesTab)),
      read(fill(views.PATIENT_PAGES.note)),
      read(fill(views.PATIENT_PAGES.doctorsTab)),
    ]);
    if (tabPage.status !== 200) {
      patient.error = "Nurse's Tab could not be opened (" + (tabPage.error || 'status ' + tabPage.status) + ').';
      if (known) patient.profile = known.profile;
      kept.push(...was.keys());
      return finish([]);
    }
    const tab = views.parseMenu(tabPage.html, cfg.baseUrl);
    const doctor = doctorPage.status === 200 ? views.parseMenu(doctorPage.html, cfg.baseUrl) : { modules: [], skipped: [] };
    if (doctorPage.status !== 200) patient.error = 'Doctors Tab could not be opened (' + (doctorPage.error || 'status ' + doctorPage.status) + ').';
    patient.profile = tab.profile;
    patient.alerts = notePage.status === 200 ? views.parseAlerts(notePage.html) : {};
    patient.menusAt = new Date(now).toISOString();
    patient.skipped = [...new Set([...tab.skipped, ...doctor.skipped])];

    // A record that both tabs link to (EMR, follow-up notes ...) is read once.
    modules = tab.modules.map((module) => ({ ...module, tab: "Nurse's Tab" }));
    for (const module of doctor.modules) {
      if (!modules.some((seen) => seen.key === module.key)) modules.push({ ...module, tab: 'Doctors Tab' });
    }
    modules.forEach((module, seq) => { module.seq = seq; });
  } else {
    patient.profile = known.profile;
    modules = known.docs.filter((doc) => !doc.group).map(({ key, label, url, tab, seq }) => ({ key, label, url, tab, seq }));
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const cutoff = dayString(yesterday);
  const fetchedAt = new Date(now).toISOString();
  const open = async (page) => {
    const result = await read(page.url);
    const parsed = result.status === 200 ? views.extract(result.html, { rows: page.rows }) : null;
    return { ...page, ...result, parsed };
  };
  const pages = (
    await Promise.all(
      modules.map(async (module) => {
        const stored = was.get(module.key);
        let page = null;
        let linked;
        if (!quick || !stored || isStale(stored, patient.admissionNo, now)) {
          page = await open({ ...module, rows: 'filled' });
          if (page.status !== 200) return [page];
          // The medication lists, the daily intake-output charts and saved forms hang off their record page.
          linked = views.parseSubPages(page.html, cfg.baseUrl);
        } else {
          kept.push(module.key);
          // Not opened, so its linked pages are the ones stored last time.
          linked = known.docs
            .filter((doc) => doc.group === module.label)
            .map((doc) => ({ ...views.subPage(new URL(doc.url).pathname), url: doc.url }))
            .filter((sub) => sub.key);
        }
        const subPages = await Promise.all(
          linked.map((sub) => {
            const before = was.get(sub.key);
            const day = sub.key.match(DATED);
            // A chart of a day that is over does not change any more.
            const fresh = day ? day[1] < cutoff : !isStale(before || {}, patient.admissionNo, now);
            if (quick && before && fresh) {
              kept.push(sub.key);
              return null;
            }
            return open({ key: sub.key, label: sub.label, url: sub.url, group: module.label, tab: module.tab, seq: module.seq, rows: sub.form ? 'filled' : 'all' });
          })
        );
        return [...(page ? [page] : []), ...subPages.filter(Boolean)];
      })
    )
  ).flat();
  finish(pages.map(({ key, label, group, tab, seq, url, status, error, parsed }) => ({
    key, label, group: group || null, tab, seq, url, status, error, fetchedAt, reader: READER,
    entries: parsed ? parsed.entries.map(({ title, columns, rows }) => ({ title, columns, rows })) : [],
    values: parsed ? parsed.values : [],
  })));
}

const hasData = (module) => module.entries.length > 0 || module.values.length > 0;

// A table that is word for word the same for most patients is part of the
// page itself (a legend, a blank chart), not something recorded for a patient.
// Once recognised it is remembered, so quick updates that read a record for
// only a few patients still leave it out.
function dropTemplates(patients, remembered) {
  const base = (module) => module.key.replace(/-\d{4}-\d{2}-\d{2}$/, '');
  const signature = (module, entry) => crypto.createHash('sha1').update(base(module) + JSON.stringify(entry)).digest('hex');
  const seen = new Map();
  const readFor = new Map();
  for (const patient of patients) {
    const own = new Map();
    for (const module of patient.modules || []) {
      for (const entry of module.entries) own.set(signature(module, entry), base(module));
    }
    for (const [sig, key] of own) seen.set(sig, { key, count: ((seen.get(sig) || {}).count || 0) + 1 });
    for (const key of new Set((patient.modules || []).map(base))) readFor.set(key, (readFor.get(key) || 0) + 1);
  }
  const learned = [...seen].filter(([, { key, count }]) => count >= Math.max(5, readFor.get(key) / 2)).map(([sig]) => sig);
  const templates = new Set([...remembered, ...learned]);
  for (const patient of patients) {
    for (const module of patient.modules || []) {
      module.entries = module.entries.filter((entry) => !templates.has(signature(module, entry)));
    }
  }
  return learned;
}

function toRow(patient) {
  const a = patient.admission;
  const p = patient.profile || {};
  return {
    [STATION_COLUMN]: patient.station,
    'Bed No': text(a.bed_name),
    'Patient Name': text(a.patient_name),
    UHID: text(a.patient_code),
    'IP No': text(a.admission_uid),
    'IP Date': displayDate(a.admission_date),
    Age: text(p.Age),
    Gender: text(p.Gender),
    'Patient Type': text(p['Patient Type']),
    'Blood Group': text(p['Blood Group']),
    Consultant: text(a.primary_doctor_name),
    Department: text(a.doc_department),
    'Bed Category': text(a.ward_name),
    'Allergies Alert': yesNo(a.allergy_alert),
    'Vulnerability Alert': yesNo(a.vulnerability_alert),
    'Clinical Alert': yesNo(a.clinial_alert),
    'Contact No': text(p['Contact No']),
    Address: text(p.Address),
    'Accompanied By': text(a.accompanied_by),
    Relation: text(a.contact_relaion),
    'Attendant Mobile': text(a.contact_person_mobile),
    Records: patient.modules ? String(patient.modules.filter(hasData).length + (patient.keptWithData || 0)) : '',
  };
}

// memory: what earlier collections left behind ({ known, templates, stationList })
// and the wanted mode: 'full' reads every record again, 'quick' only what has
// gone stale, 'list' only the patient lists.
// openSession: signs in and returns the session (see session-browser.js, session-http.js).
async function collectAll(cfg, log = () => {}, memory = {}, openSession) {
  const known = memory.known || new Map();
  const mode = memory.mode === 'list' ? 'list' : memory.mode !== 'full' && [...known.values()].some((p) => p.docs.length) ? 'quick' : 'full';
  if (!cfg.user || !cfg.pass) {
    throw new Error('The H360 login is not set. Enter it in the page first.');
  }

  const startedAt = Date.now();
  const seconds = () => Math.round((Date.now() - startedAt) / 1000);
  // Where the collection has got to, for whoever is watching it (see index.js).
  const tell = typeof log.progress === 'function' ? log.progress : () => {};
  tell({ stage: 'signin', mode });
  log('Signing in to H360...');
  const session = await openSession(cfg);
  try {
    tell({ stage: 'lists' });
    log('Opening the Nurse Station page...');
    let stations = await session.stations();
    if (!stations.length && (memory.stationList || []).length) {
      // The station list did not come with the page this time: the stations of the last collection are asked for.
      stations = memory.stationList;
      log('The station list was not on the page; using the stations of the last collection.');
    }
    if (!stations.length) throw new Error('No nurse stations were found on the Nurse Station page.');

    const warnings = [];
    const lists = await session.lists(stations);
    const patients = [];
    const summary = [];
    const failedStations = [];
    const seen = new Set();
    lists.forEach((list, i) => {
      const station = stations[i];
      let records = [];
      try {
        if (list.status !== 200) throw new Error(list.error || `status ${list.status}`);
        records = JSON.parse(list.body).data || [];
      } catch (err) {
        failedStations.push(station.text);
        warnings.push(`${station.text}: the patient list could not be read (${err.message}).`);
      }
      let count = 0;
      for (const admission of records) {
        const admissionNo = text(admission.admission_no_pk);
        if (!admissionNo || seen.has(admissionNo)) continue;
        seen.add(admissionNo);
        count++;
        patients.push({ admissionNo, patientNo: text(admission.patient_no_fk), station: station.text, admission });
      }
      summary.push({ station: station.text, count });
    });
    if (failedStations.length === stations.length) throw new Error('None of the nurse station lists could be read. ' + warnings[0]);
    log(`Found ${patients.length} patients in ${stations.length} stations (${seconds()} seconds).`);

    tell({ stage: 'register', patients: patients.length, stations: summary.map((item) => ({ station: item.station, total: item.count, done: 0 })) });
    // The IPD Admission list: who was admitted, who has left and how. Its failure never stops a collection.
    let admissions = { rows: [], shape: { found: false } };
    try {
      admissions = register.parse(await session.register());
      if (admissions.shape.found) log(`IPD Admission list: ${admissions.rows.length} rows read.`);
      else log(session.kind === 'http'
        ? 'IPD Admission list: it is loaded by the page after opening, so it is read by the hospital PC collection.'
        : 'IPD Admission list: no patient list was recognised on the page.');
    } catch (err) {
      admissions.shape.error = err.message.split('\n')[0];
      warnings.push('The IPD Admission list could not be read (' + admissions.shape.error + ').');
    }

    log({
      list: 'List only: updating the patient lists; no records are read.',
      quick: 'Quick update: reading notes, vital signs and handovers of every patient, new patients in full, and other records only when they have become old.',
      full: "Full collection: reading every Nurse's Tab and Doctors Tab record of every patient.",
    }[mode]);
    tell({ stage: 'records' });
    const readPage = slotReader(session, cfg);
    let pagesRead = 0;
    const read = async (url) => {
      const result = await readPage(url);
      pagesRead++;
      tell({ pages: pagesRead });
      if (pagesRead % 150 === 0) log(pagesRead + ' pages read (' + seconds() + ' seconds)...');
      return result;
    };
    await Promise.all(
      patients.map(async (patient) => {
        await collectPatient(read, cfg, patient, { known: known.get(patient.admissionNo) || null, mode });
        if (patient.error) warnings.push(`${text(patient.admission.patient_name)}: ${patient.error}`);
        tell({ finished: { station: patient.station, name: text(patient.admission.patient_name), bed: text(patient.admission.bed_name) } });
      })
    );

    const templates = dropTemplates(patients, memory.templates || new Set());
    const failed = patients.flatMap((p) => (p.modules || []).filter((m) => m.status !== 200));
    if (failed.length) {
      const names = [...new Set(failed.map((m) => m.label))].slice(0, 8).join(', ');
      warnings.push(`${failed.length} record pages could not be opened (${names}).`);
    }
    const skipped = [...new Set(patients.flatMap((p) => p.skipped || []))];
    const keptPages = patients.reduce((n, p) => n + (p.kept || []).length, 0);
    if (mode !== 'list') log(pagesRead + ' pages read in ' + seconds() + ' seconds' + (keptPages ? '; ' + keptPages + ' unchanged or empty pages were not read again.' : '.'));

    return {
      collectedAt: new Date().toISOString(),
      source: cfg.pageUrl,
      columns: COLUMNS,
      stations: summary,
      stationList: stations,
      failedStations,
      rows: patients.map(toRow),
      patients,
      templates,
      mode,
      skipped,
      warnings,
      register: admissions,
    };
  } finally {
    await session.close();
  }
}

module.exports = { collectAll, STATION_COLUMN, COLUMNS };
