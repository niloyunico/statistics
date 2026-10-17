/* H360 link for the Supervisor Reports module.
 *
 * What used to be the stand-alone "Unico Patient Collector": signs in to H360,
 * reads the patients of every nurse station, their records and the IPD
 * Admission list, and builds the supervisor log sheet from them.
 *
 * WHERE IT RUNS. The same code serves two places:
 *   - the hospital PC (this app started on a computer with Chrome or Edge):
 *     every kind of collection. Everything read is kept in the PC's own
 *     MongoDB (the collector's database, `unicoreport`), then what the
 *     administrator allows is saved to the app's database.
 *   - the live site: it has no browser and little time per request, so it only
 *     refreshes the patient lists (who is admitted, in which bed, who left).
 *
 * WHAT GOES INTO THE APP'S DATABASE is the administrator's choice (settings.js):
 * the log sheet content only, or every record. The log sheets themselves are
 * always saved there (`h360Sheets`), so they open on both.
 *
 * Everything is gated on the 'supervisor' module by web.js; the H360 login and
 * the storage choice are for administrators only.
 */
const express = require('express');
const { MongoClient } = require('mongodb');
const storeLib = require('./store');
const sheets = require('./sheets');
const settings = require('./settings');
const schema = require('./schema');

const baseUrl = () => (process.env.HIS_BASE_URL || 'https://his.unicohospitals.com').replace(/\/+$/, '');

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// The PC's own MongoDB: where the stand-alone collector kept (and this keeps) everything it reads.
let localPromise = null;
function defaultLocalDb() {
  if (process.env.VERCEL || String(process.env.H360_LOCAL_STORE || '').toLowerCase() === 'off') return Promise.resolve(null);
  if (!localPromise) {
    const uri = process.env.H360_LOCAL_MONGODB_URI || 'mongodb://127.0.0.1:27017';
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
    localPromise = client
      .connect()
      .then(() => client.db(process.env.H360_LOCAL_DB || 'unicoreport'))
      .catch((err) => {
        localPromise = null;
        client.close().catch(() => {});
        throw new Error(`MongoDB on this computer (${uri.replace(/\/\/[^@/]+@/, '//***@')}) is not running, so the records have nowhere to be kept. Start it, then collect again. (${err.message})`);
      });
  }
  return localPromise;
}

function createService(deps = {}) {
  const sharedDb = deps.sharedDb || (() => require('../db').getDbHandle());
  const localDb = deps.localDb || defaultLocalDb;
  const site = deps.site || (() => (process.env.VERCEL ? 'cloud' : 'pc'));
  const job = { running: false, log: [], error: null, startedAt: null, finishedAt: null, mode: null, progress: null };
  let statusCache = null;

  async function shared() {
    const db = await sharedDb();
    if (!db) throw fail(503, 'The database is not connected, so H360 data cannot be saved or shown.');
    return storeLib.open(db, storeLib.SHARED);
  }

  // The PC's own store, or null where there is none (the live site, or MongoDB not running here).
  async function local(strict) {
    if (site() !== 'pc') return null;
    try {
      const db = await localDb();
      return db ? storeLib.open(db, storeLib.LOCAL) : null;
    } catch (err) {
      if (strict) throw err;
      return null;
    }
  }

  function transport() {
    const wanted = String(process.env.H360_TRANSPORT || '').toLowerCase();
    if (site() === 'cloud' || wanted === 'http') return 'http';
    return require('./session-browser').available() ? 'browser' : 'http';
  }

  const openSession = deps.openSession || ((cfg) => (transport() === 'browser' ? require('./session-browser').open(cfg) : require('./session-http').open(cfg)));

  async function config() {
    const login = await settings.login(await sharedDb());
    const base = baseUrl();
    return {
      baseUrl: base,
      pageUrl: base + (process.env.HIS_PAGE_PATH || '/v2/ipd/nurse-station-receive-request'),
      user: login.user,
      pass: login.pass,
      headless: String(process.env.H360_HEADLESS || process.env.HEADLESS || 'true').toLowerCase() !== 'false',
      // How many H360 pages are read at the same time.
      concurrency: Math.min(Math.max(Number(process.env.HIS_CONCURRENCY) || 12, 1), 16),
    };
  }

  // One collection, start to finish. The live site only ever refreshes the lists.
  async function collect(wanted, log = () => {}, extra = {}) {
    const mode = site() === 'cloud' ? 'list' : ['full', 'list'].includes(wanted) ? wanted : 'quick';
    const sharedStore = await shared();
    const level = await settings.level(sharedStore.db);
    // Checked first so a collected list is never lost to a stopped database.
    const localStore = await local(mode !== 'list');
    const cfg = await config();

    const memory = await storeLib.loadMemory(localStore || sharedStore);
    if (!memory.stationList.length && localStore) memory.stationList = (await storeLib.loadMemory(sharedStore)).stationList;
    // The stations, when the page does not carry them: the list last read by a browser,
    // then what an earlier run asked for, then the stations of the patients already held.
    const kept = await settings.stations(sharedStore.db);
    if (kept.length && (!kept.guessed || !memory.stationList.length)) memory.stationList = kept;
    if (!memory.stationList.length && localStore) {
      memory.stationList = await storeLib.stationsOfPatients(localStore);
      await settings.saveStations(sharedStore.db, memory.stationList, { guessed: true, site: site() });
    }
    memory.onStations = (list) => settings.saveStations(sharedStore.db, list, { site: site() });
    memory.onNotes = (notes) => settings.saveNotes(sharedStore.db, notes, site());
    // Loaded when a collection starts: the page readers are of no use to any other request.
    const snapshot = await require('./collector').collectAll(cfg, log, { ...memory, mode }, extra.opener || openSession);

    const tell = typeof log.progress === 'function' ? log.progress : () => {};
    tell({ stage: 'saving' });
    let records = null;
    let suggestions = null;
    if (localStore) {
      await storeLib.save(localStore, snapshot, { level: 'full', site: site() });
      // What the records say about each patient goes with the patient; the records follow only under 'all'.
      records = await storeLib.loadRecords(localStore);
      suggestions = sheets.suggestionsFrom(records);
      snapshot.knownTemplates = [...(await storeLib.loadMemory(localStore)).templates];
    }
    await storeLib.save(sharedStore, snapshot, { level, suggestions, records: level === 'all' ? records : null, site: site() });
    statusCache = null;
    tell({ stage: 'done' });

    for (const warning of snapshot.warnings) log('Warning: ' + warning);
    if (snapshot.skipped.length && snapshot.mode === 'full') log(`Not opened (billing, transfer, discharge and other action buttons): ${snapshot.skipped.join(', ')}.`);
    log(`Done: ${snapshot.rows.length} patients from ${snapshot.stations.length} stations saved.`
      + (localStore ? (level === 'all' ? ' Every record was also saved to the app database.' : ' The records stay on this computer; the app database holds the log sheet content only.') : ''));
    return snapshot;
  }

/* ---- on the live site: the records, a few patients at a time ----
     The live site has no process that outlives a request, so a collection there is a list
     refresh followed by short steps, each asked for by the open page: a step signs in with
     the sign-in the last one left, reads as many patients as fit in its time, saves them and
     says how far it has got. Where it stands is kept in the database, so a closed tab or a
     failed step loses nothing; the page (or another one) carries on from there.
     Under 'log sheet content only' the records are read to work out diagnosis, remarks,
     surgery and the rest, and are not stored. */
  const STEP_MS = Number(process.env.H360_STEP_MS) || 18000;
  const FRESH_MS = 2 * 60 * 60 * 1000;
  const openPlain = deps.openStep || ((cfg, cookies) => require('./session-http').open(cfg, { cookies }));
  const sealed = (session) => (session && session.cookies ? settings.seal(JSON.stringify(session.cookies())) : null);
  const publicRun = (state) => (!state ? null : {
    id: state.id, running: false, resumable: !state.finishedAt, startedAt: state.startedAt, finishedAt: state.finishedAt || null,
    error: state.error || null, log: state.log || [], mode: state.mode, remaining: (state.queue || []).length,
    progress: { stage: state.finishedAt ? 'done' : 'records', mode: state.mode, patients: state.total, done: state.done, pages: state.pages, stations: state.stations || [], last: state.last || '' },
  });

  async function cloudState() {
    const db = await sharedDb();
    return db ? publicRun(await settings.read(db, 'cloudRun')) : null;
  }

  async function cloudStart(wanted, by) {
    const mode = wanted === 'full' ? 'full' : 'quick';
    const lines = [];
    const log = (message) => lines.push({ at: new Date().toISOString(), message });
    let kept = null;
    const opener = async (cfg) => { kept = await (deps.openSession ? deps.openSession(cfg) : require('./session-http').open(cfg)); return kept; };
    await collect('list', log, { opener });
    const sharedStore = await shared();
    const latestRun = await storeLib.latestRun(sharedStore);
    const docs = await sharedStore.col('patients').find({ lastRunId: latestRun._id }).sort({ seq: 1 }).project({ admissionNo: 1, station: 1, recordsAt: 1 }).toArray();
    const old = Date.now() - FRESH_MS;
    const todo = docs.filter((doc) => mode === 'full' || !doc.recordsAt || new Date(doc.recordsAt).getTime() < old);
    const perStation = new Map();
    for (const doc of todo) perStation.set(doc.station, (perStation.get(doc.station) || 0) + 1);
    log(mode === 'full'
      ? `Reading the records of all ${todo.length} patients.`
      : `Reading the records of ${todo.length} patients${docs.length - todo.length ? '; ' + (docs.length - todo.length) + ' were read less than two hours ago' : ''}.`);
    const now = new Date().toISOString();
    const state = {
      id: require('crypto').randomBytes(8).toString('hex'), mode, by: by || '', startedAt: lines.length ? lines[0].at : now, updatedAt: now,
      finishedAt: todo.length ? null : now, error: null, total: todo.length, done: 0, pages: 0, queue: todo.map((doc) => doc.admissionNo),
      stations: [...perStation].map(([station, total]) => ({ station, total, done: 0 })), last: '', log: lines, cookies: sealed(kept), lockedAt: null,
    };
    if (!todo.length) log('Done: every patient was read less than two hours ago. Use Full collection to read them all again.');
    await settings.write(await sharedDb(), 'cloudRun', state);
    statusCache = null;
    return publicRun(state);
  }

  async function cloudStep(id) {
    const db = await sharedDb();
    const state = await settings.read(db, 'cloudRun');
    if (!state || state.id !== id) throw fail(409, 'This collection was replaced by a newer one. Start it again.');
    if (state.finishedAt) return publicRun(state);
    if (state.lockedAt && Date.now() - new Date(state.lockedAt).getTime() < 75000) throw fail(423, 'This collection is being run from another window.');
    await settings.write(db, 'cloudRun', { lockedAt: new Date() });
    const lines = [];
    const log = (message) => lines.push({ at: new Date().toISOString(), message });
    const queue = (state.queue || []).slice();
    const finished = [];
    let pages = 0;
    let cookies = state.cookies;
    try {
      const sharedStore = await shared();
      const level = await settings.level(db);
      const cfg = await config();
      let earlier = null;
      try { earlier = state.cookies ? JSON.parse(settings.unseal(state.cookies)) : null; } catch (err) { earlier = null; }
      const session = await openPlain(cfg, earlier);
      const collector = require('./collector');
      const templates = new Set((await sharedStore.col('templates').find().project({ _id: 1 }).toArray()).map((doc) => doc._id));
      const readPage = collector.slotReader(session, cfg);
      const read = async (url) => { const result = await readPage(url); pages++; return result; };
      const started = Date.now();
      let begun = false;
      const worker = async () => {
        // A step always reads at least one patient, so a collection cannot stand still.
        while (queue.length && (!begun || Date.now() - started < STEP_MS)) {
          begun = true;
          const admissionNo = queue.shift();
          const doc = await sharedStore.col('patients').findOne({ admissionNo });
          if (!doc || !doc.active) { finished.push({ station: doc ? doc.station : '', name: '' }); continue; }
          const patient = { admissionNo, patientNo: doc.patientNo, station: doc.station, admission: doc.admission || {} };
          const name = [(doc.admission || {}).patient_name, (doc.admission || {}).bed_name].filter(Boolean).join(' \u00b7 ');
          try {
            await collector.collectPatient(read, cfg, patient, { known: null, mode: 'full' });
          } catch (err) {
            if (/signed us out/.test(err.message)) { queue.unshift(admissionNo); throw err; }
            patient.error = err.message.split('\n')[0];
          }
          if (patient.error && !(patient.modules || []).length) log('Warning: ' + ((doc.admission || {}).patient_name || admissionNo) + ': ' + patient.error);
          else {
            collector.dropTemplates([patient], templates);
            const suggestion = sheets.suggestionsFrom(patient.modules.filter(collector.hasData).map((module) => ({ ...module, admissionNo }))).get(admissionNo) || null;
            await storeLib.savePatientRecords(sharedStore, doc, patient, { level, suggestion });
          }
          finished.push({ station: doc.station, name });
        }
      };
      try {
        await Promise.all([worker(), worker(), worker()]);
        cookies = sealed(session);
      } catch (err) {
        if (!/signed us out/.test(err.message)) throw err;
        // The next step signs in afresh.
        cookies = null;
        log('H360 ended the sign-in; signing in again.');
      }
    } catch (err) {
      // What was read is kept; the step is reported and the collection can be carried on.
      log('Stopped: ' + err.message.split('\n')[0]);
      state.error = err.message.split('\n')[0];
      await settings.write(db, 'cloudRun', { lockedAt: null, error: state.error, queue, done: state.done + finished.length, pages: state.pages + pages, log: [...(state.log || []), ...lines].slice(-300), updatedAt: new Date().toISOString() });
      statusCache = null;
      throw fail(502, state.error);
    }
    const done = state.done + finished.length;
    const over = queue.length === 0;
    if (over) log(`Done: the records of ${done} patients were read (${state.pages + pages} pages).`);
    const next = {
      queue, done, pages: state.pages + pages, cookies, lockedAt: null, error: null, updatedAt: new Date().toISOString(),
      finishedAt: over ? new Date().toISOString() : null,
      last: (finished.filter((item) => item.name).pop() || {}).name || state.last || '',
      stations: (state.stations || []).map((item) => ({ ...item, done: item.done + finished.filter((f) => f.station === item.station).length })),
      log: [...(state.log || []), ...lines].slice(-300),
    };
    await settings.write(db, 'cloudRun', next);
    statusCache = null;
    return publicRun({ ...state, ...next });
  }

  async function run(wanted) {
    // What the screen shows while it runs: the step, how many patients are done (in all and per station), pages read.
    const progress = { stage: 'signin', mode: wanted, patients: 0, done: 0, pages: 0, stations: [], last: '' };
    Object.assign(job, { running: true, log: [], error: null, startedAt: new Date().toISOString(), finishedAt: null, mode: wanted, progress });
    const log = (message) => job.log.push({ at: new Date().toISOString(), message });
    log.progress = (update) => {
      if (update.stage) progress.stage = update.stage;
      if (update.mode) progress.mode = update.mode;
      if (update.patients !== undefined) progress.patients = update.patients;
      if (update.stations) progress.stations = update.stations;
      if (update.pages) progress.pages = update.pages;
      if (update.finished) {
        progress.done++;
        progress.last = [update.finished.name, update.finished.bed].filter(Boolean).join(' · ');
        const at = progress.stations.find((item) => item.station === update.finished.station);
        if (at) at.done++;
      }
    };
    try {
      await collect(wanted, log);
    } catch (err) {
      job.error = err.message;
      progress.failedAt = progress.stage;
      log('Failed: ' + err.message);
    } finally {
      job.running = false;
      job.finishedAt = new Date().toISOString();
    }
  }

  async function facts() {
    if (statusCache && Date.now() - statusCache.at < 5000) return statusCache.value;
    const db = await sharedDb();
    const login = await settings.login(db);
    const value = {
      site: site(),
      modes: ['quick', 'full', 'list'],
      // The user name is shown so it is clear whose login is in use; the password never leaves the server.
      hasLogin: Boolean(login.user && login.pass),
      user: login.user,
      loginSource: login.source,
      loginElsewhere: Boolean(login.elsewhere),
      cloudData: await settings.level(db),
      lastRun: null,
      lastPcRun: null,
      sheetsWaiting: 0,
      localStore: null,
      legacyReports: 0,
    };
    if (db) {
      const sharedStore = storeLib.open(db, storeLib.SHARED);
      const lastRun = await storeLib.latestRun(sharedStore);
      if (lastRun) value.lastRun = { collectedAt: lastRun.collectedAt, mode: lastRun.mode, total: lastRun.total, site: lastRun.site || '', level: lastRun.level || '', register: lastRun.register || null, opd: lastRun.opd || null };
      // The newest collection that read the records (only the hospital PC does).
      // Log sheets that have not been turned into supervisor reports yet.
      value.sheetsWaiting = await db.collection(sheets.SHEETS).countDocuments({ convertedTo: { $exists: false } });
      const pcRun = await sharedStore.col('runs').find({ site: 'pc' }).sort({ collectedAt: -1 }).limit(1).next();
      value.lastPcRun = pcRun ? pcRun.collectedAt : null;
      if (site() === 'pc') {
        try {
          const own = await localDb();
          value.localStore = own ? { ok: true } : null;
          if (own) value.legacyReports = await sheets.legacyWaiting(sharedStore, own);
        } catch (err) {
          value.localStore = { ok: false, error: err.message };
        }
      }
    }
    statusCache = { at: Date.now(), value };
    return value;
  }

  // The store a screen reads from: the PC's own (every column and record) unless the shared list is newer.
  async function latest() {
    const sharedStore = await shared();
    const localStore = await local(false);
    const fromShared = await storeLib.loadLatest(sharedStore);
    const fromLocal = localStore ? await storeLib.loadLatest(localStore) : null;
    if (fromLocal && (!fromShared || fromLocal.collectedAt >= fromShared.collectedAt)) return { snapshot: fromLocal, store: localStore, records: 'here' };
    if (!fromShared) return { snapshot: null, store: sharedStore, records: 'none' };
    return { snapshot: fromShared, store: sharedStore, records: (await settings.level(sharedStore.db)) === 'all' ? 'shared' : 'pc-only' };
  }

  async function patient(admissionNo) {
    const sharedStore = await shared();
    const localStore = await local(false);
    const own = localStore ? await storeLib.loadPatient(localStore, admissionNo) : null;
    if (own) return { ...own, records: 'here' };
    const found = await storeLib.loadPatient(sharedStore, admissionNo);
    return found ? { ...found, records: found.modules.length ? 'shared' : 'pc-only' } : null;
  }

  async function admissions() {
    const localStore = await local(false);
    const own = localStore ? await storeLib.loadRegister(localStore) : null;
    return own && own.shape ? own : storeLib.loadRegister(await shared());
  }

  // The OPD list as last read: with the patients where they are kept, the counts everywhere.
  async function outPatients() {
    const localStore = await local(false);
    const own = localStore ? await storeLib.loadOpd(localStore) : null;
    const kept = await storeLib.loadOpd(await shared());
    return own && (!kept || own.collectedAt >= kept.collectedAt) ? own : kept;
  }

  return { job, site, shared, local, localDb, sharedDb, collect, run, facts, latest, patient, admissions, outPatients, cloudStart, cloudStep, cloudState, forget: () => { statusCache = null; } };
}

/* ---------------- route registration ---------------- */
function mount(app, opts = {}) {
  const guard = opts.requireApi || ((req, res, next) => next());
  const service = opts.service || createService(opts.deps);
  const json = express.json({ limit: '4mb' });
  const who = (req) => (req.user && (req.user.name || req.user.sub)) || 'local';
  const isAdmin = (req) => (req.access ? Boolean(req.access.unrestricted) : !(req.user && req.user.role && req.user.role !== 'Administrator'));
  const adminOnly = (req, res, next) => (isAdmin(req) ? next() : res.status(403).json({ error: 'Administrator access required.' }));
  const route = (handler) => (req, res) =>
    Promise.resolve()
      .then(() => handler(req, res))
      .catch((err) => {
        if (!res.headersSent) res.status(err.status || 500).json({ error: err.message });
        else res.end();
      });

app.get('/api/h360/status', guard, route(async (req, res) => {
    const out = { ...service.job, ...(await service.facts()), canManage: isAdmin(req) };
    // On the live site a collection lives in the database, not in this process.
    if (service.site() === 'cloud') {
      const kept = await service.cloudState();
      if (kept && (!out.startedAt || kept.startedAt >= out.startedAt)) Object.assign(out, kept);
    }
    res.json(out);
  }));

  app.post('/api/h360/collect', guard, json, route(async (req, res) => {
    if (service.job.running) return res.status(409).json({ error: 'A collection is already running.' });
    const mode = (req.body || {}).mode;
if (service.site() === 'cloud') {
      if (mode === 'quick' || mode === 'full') {
        // The lists now, then the records in steps the page asks for one after another.
        return res.json({ ok: true, state: await service.cloudStart(mode, who(req)) });
      }
      // No background work on the live site: the lists are refreshed while the request waits.
      await service.run('list');
      return res.json({ ok: !service.job.error, error: service.job.error, log: service.job.log });
    }
    service.run(mode);
    res.json({ ok: true });
  }));

  // The next few patients of a collection running on the live site.
  app.post('/api/h360/collect/step', guard, json, route(async (req, res) => {
    res.json({ ok: true, state: await service.cloudStep(String((req.body || {}).id || '')) });
  }));

  app.post('/api/h360/login', guard, adminOnly, json, route(async (req, res) => {
    const user = String((req.body && req.body.user) || '').trim();
    const pass = String((req.body && req.body.pass) || '');
    if (!user || !pass) return res.status(400).json({ error: 'Enter both the user name and the password.' });
    if (/[\r\n]/.test(user + pass)) return res.status(400).json({ error: 'The login cannot contain line breaks.' });
    await settings.saveLogin(await service.sharedDb(), user, pass, who(req));
    service.forget();
    res.json({ ok: true });
  }));

  app.delete('/api/h360/login', guard, adminOnly, route(async (req, res) => {
    if (service.job.running) return res.status(409).json({ error: 'Wait for the collection to finish first.' });
    await settings.forgetLogin(await service.sharedDb());
    service.forget();
    res.json({ ok: true });
  }));

  // What goes into the app database: 'sheet' (log sheet content only) or 'all' (every record).
  app.post('/api/h360/options', guard, adminOnly, json, route(async (req, res) => {
    const body = req.body || {};
    await settings.saveLevel(await service.sharedDb(), body.cloudData, who(req));
    let removed = null;
    if (body.cloudData === 'sheet' && body.removeOnline) removed = await storeLib.trimToSheet(await service.shared());
    service.forget();
    res.json({ ok: true, cloudData: body.cloudData, removed });
  }));

  app.get('/api/h360/patients', guard, route(async (req, res) => {
    const { snapshot, records } = await service.latest();
    res.json(snapshot ? { ...snapshot, records } : null);
  }));

  app.get('/api/h360/patient/:admissionNo', guard, route(async (req, res) => {
    const patient = await service.patient(String(req.params.admissionNo));
    if (!patient) return res.status(404).json({ error: 'This patient has not been collected yet.' });
    res.json(patient);
  }));

  app.get('/api/h360/admissions', guard, route(async (req, res) => {
    res.json(await service.admissions());
  }));

  // The in-patients for the Patient Board, each with the unit as H360 names it.
  app.get('/api/h360/board', guard, route(async (req, res) => {
    const bridge = require('./bridge');
    const found = await sheets.board(await service.shared());
    res.json({ ...found, patients: found.patients.map((patient) => ({ ...patient, dept: bridge.deptOf(patient.station) })) });
  }));

  app.get('/api/h360/opd', guard, route(async (req, res) => {
    res.json((await service.outPatients()) || null);
  }));

  app.get('/api/h360/export.xlsx', guard, route(async (req, res) => {
    const { snapshot, store } = await service.latest();
    if (!snapshot) return res.status(404).send('Nothing collected yet.');
    const workbook = storeLib.buildWorkbook(snapshot, await storeLib.loadRecords(store), await service.admissions());
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${storeLib.excelName(snapshot)}"`);
    await workbook.xlsx.write(res);
    res.end();
  }));

  /* ---- the shift supervisor report, filled in from H360 ---- */

  // The patient lists are brought up to date before a report is filled, when the last
  // collection is older than a few minutes. Who has left is only known once a collection
  // has looked, and a leaver is placed in the shift in which the lists were seen to change:
  // filled from yesterday's lists, a whole day's discharges landed in one shift's report.
  // On the live site this is a few seconds; on the hospital PC the browser takes longer.
  const REFRESH_AFTER_MS = Number(process.env.H360_REFRESH_AFTER_MS) || 5 * 60 * 1000;
  async function freshenLists() {
    if (service.job.running) return { skipped: 'A collection is running.' };
    const known = await service.facts();
    if (!known.hasLogin) return { skipped: 'No H360 login is saved here.' };
    const last = known.lastRun && known.lastRun.collectedAt ? new Date(known.lastRun.collectedAt).getTime() : 0;
    if (Date.now() - last < REFRESH_AFTER_MS) return { at: known.lastRun.collectedAt, fresh: true };
    await service.run('list');
    service.forget();
    return service.job.error ? { error: service.job.error, at: known.lastRun ? known.lastRun.collectedAt : null } : { at: service.job.finishedAt };
  }

  // The report as it is on the screen comes in; the same report with what H360 knows worked
  // in goes back. Nothing is saved here: the editor saves it the way it saves everything else.
  app.post('/api/h360/fill', guard, json, route(async (req, res) => {
    const bridge = require('./bridge');
    const supervisor = require('../supervisor-reports');
    const body = req.body || {};
    const report = body.report || {};
    const refreshed = await freshenLists().catch((err) => ({ error: err.message }));
    const before = bridge.toSheet(report);
    const previous = await supervisor.getPreviousReport(report.date, report.shift).catch(() => null);
    const result = await sheets.fill(await service.shared(), bridge.toSheet(report), body.options || {}, bridge.carriedFrom(previous));
    // A leaver whose shift nobody can tell is offered with the row they would get, in the report's own columns.
    const unsure = (result.unsure || []).map((item) => ({ ...item, row: bridge.fromSheet({ data: { [item.outcome === 'lama' ? 'lama' : 'discharged']: { rows: [item.row] } } }, null)[item.outcome === 'lama' ? 'lama' : 'discharged'][0] }));
    res.json({
      report: bridge.fromSheet({ data: result.data }, before),
      census: result.census, opd: result.opd, sourceCollectedAt: result.sourceCollectedAt, refreshed, span: result.span,
      added: result.added, gone: result.gone, moved: result.moved, died: result.died, requested: result.requested, unsure, duplicates: result.duplicates, changed: result.changed,
      updateDefaults: sheets.UPDATE_DEFAULTS,
    });
  }));

  // The report on the screen, saved or not, as the Word log sheet: what the editor shows is
  // what is printed, so a report that has not reached the database yet prints the same.
  app.post('/api/h360/report/docx', guard, json, route(async (req, res) => {
    const render = require('./render');
    const sheet = require('./bridge').toSheet((req.body || {}).report || {});
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sheet.date) || !schema.SHIFTS.includes(sheet.shift)) throw fail(400, 'The report needs a date and a shift before it can be printed.');
    for (const id of Object.keys(sheet.data)) sheet.data[id].rows = (sheet.data[id].rows || []).slice(0, 500);
    const file = await render.toDocx(sheet);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${render.fileName(sheet, 'docx')}"`);
    res.end(file);
  }));

  // A saved supervisor report as the Word log sheet, and as its print page.
  const asSheet = async (id) => {
    const report = await require('../supervisor-reports').getReportById(String(id));
    if (!report) throw fail(404, 'Report not found.');
    return require('./bridge').toSheet(report);
  };
  app.get('/api/h360/report/:id/docx', guard, route(async (req, res) => {
    const render = require('./render');
    const sheet = await asSheet(req.params.id);
    // Built BEFORE the download headers: an error answered as an attachment is shown by the
    // browser as "This site can't be reached", with nothing to say what went wrong.
    const file = await render.toDocx(sheet);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${render.fileName(sheet, 'docx')}"`);
    res.end(file);
  }));
  // The report as Print & Export shows it, as a Word file: the page posts its headings and
  // tables (report-docx.js). Not the log sheet above, which is the hospital's paper form.
  app.post('/api/h360/report/word', guard, json, route(async (req, res) => {
    const file = await require('./report-docx').toDocx(req.body || {});
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.end(file);
  }));
  app.get('/api/h360/report/:id/print', guard, route(async (req, res) => {
    res.type('html').send(require('./render').toHtml(await asSheet(req.params.id)));
  }));

  // The log sheets written before the two reports became one (and, on the hospital PC, the
  // ones of the old collector): each becomes a draft supervisor report, once.
  app.post('/api/h360/sheets/convert', guard, route(async (req, res) => {
    const bridge = require('./bridge');
    const supervisor = require('../supervisor-reports');
    const store = await service.shared();
    const own = service.site() === 'pc' ? await service.localDb().catch(() => null) : null;
    if (own) await sheets.importLegacy(store, own);
    const waiting = await store.db.collection(sheets.SHEETS).find({ convertedTo: { $exists: false } }).sort({ date: 1, updatedAt: 1 }).toArray();
    let made = 0;
    for (const sheet of waiting) {
      const fields = bridge.fromSheet({ ...sheet, data: sheet.data || {} }, null);
      const saved = await supervisor.saveReport({ ...fields, supervisorName: fields.supervisorName || who(req), status: 'draft', createdBy: who(req) });
      await store.db.collection(sheets.SHEETS).updateOne({ _id: sheet._id }, { $set: { convertedTo: saved.id, convertedAt: new Date() } });
      made++;
    }
    service.forget();
    res.json({ ok: true, converted: made });
  }));

  /* ---- the H360 log sheets (kept for the sheets already written; new work is done in the report above) ---- */

  app.get('/api/h360/schema', guard, (req, res) => {
    res.json({
      shifts: schema.SHIFTS,
      sections: schema.SECTIONS,
      signature: schema.SIGNATURE,
      patientSections: schema.PATIENT_SECTIONS,
      updateDefaults: sheets.UPDATE_DEFAULTS,
    });
  });

  app.get('/api/h360/sheets', guard, route(async (req, res) => {
    res.json(await sheets.list(await service.shared()));
  }));

  app.post('/api/h360/sheets', guard, json, route(async (req, res) => {
    res.json(await sheets.create(await service.shared(), req.body || {}, who(req)));
  }));

  // The reports written with the stand-alone collector on this computer, brought into the app.
  app.post('/api/h360/sheets/import-local', guard, route(async (req, res) => {
    const own = service.site() === 'pc' ? await service.localDb() : null;
    if (!own) return res.status(400).json({ error: 'The old collector’s reports are on the hospital PC; open the app there to bring them in.' });
    const result = await sheets.importLegacy(await service.shared(), own);
    service.forget();
    res.json(result);
  }));

  app.get('/api/h360/sheets/:id', guard, route(async (req, res) => {
    res.json(await sheets.get(await service.shared(), req.params.id));
  }));

  app.put('/api/h360/sheets/:id', guard, json, route(async (req, res) => {
    res.json(await sheets.update(await service.shared(), req.params.id, req.body || {}, who(req)));
  }));

  app.delete('/api/h360/sheets/:id', guard, route(async (req, res) => {
    await sheets.remove(await service.shared(), req.params.id);
    res.json({ ok: true });
  }));

  app.post('/api/h360/sheets/:id/refresh', guard, json, route(async (req, res) => {
    res.json(await sheets.refresh(await service.shared(), req.params.id, req.body || {}, who(req)));
  }));

  app.get('/api/h360/sheets/:id/docx', guard, route(async (req, res) => {
    const render = require('./render');
    const report = await sheets.get(await service.shared(), req.params.id);
    const file = await render.toDocx(report);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${render.fileName(report, 'docx')}"`);
    res.end(file);
  }));

  app.get('/api/h360/sheets/:id/print', guard, route(async (req, res) => {
    const render = require('./render');
    res.type('html').send(render.toHtml(await sheets.get(await service.shared(), req.params.id)));
  }));

  return service;
}

module.exports = { mount, createService };
