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
  async function collect(wanted, log = () => {}) {
    const mode = site() === 'cloud' ? 'list' : ['full', 'list'].includes(wanted) ? wanted : 'quick';
    const sharedStore = await shared();
    const level = await settings.level(sharedStore.db);
    // Checked first so a collected list is never lost to a stopped database.
    const localStore = await local(mode !== 'list');
    const cfg = await config();

    const memory = await storeLib.loadMemory(localStore || sharedStore);
    if (!memory.stationList.length && localStore) memory.stationList = (await storeLib.loadMemory(sharedStore)).stationList;
    // Loaded when a collection starts: the page readers are of no use to any other request.
    const snapshot = await require('./collector').collectAll(cfg, log, { ...memory, mode }, openSession);

    const tell = typeof log.progress === 'function' ? log.progress : () => {};
    tell({ stage: 'saving' });
    let records = null;
    let suggestions = null;
    if (localStore) {
      await storeLib.save(localStore, snapshot, { level: 'full', site: site() });
      // What the records say about each patient goes with the patient; the records follow only under 'all'.
      records = await storeLib.loadRecords(localStore);
      suggestions = sheets.suggestionsFrom(records);
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
      modes: site() === 'cloud' ? ['list'] : ['quick', 'full', 'list'],
      // The user name is shown so it is clear whose login is in use; the password never leaves the server.
      hasLogin: Boolean(login.user && login.pass),
      user: login.user,
      loginSource: login.source,
      loginElsewhere: Boolean(login.elsewhere),
      cloudData: await settings.level(db),
      lastRun: null,
      lastPcRun: null,
      localStore: null,
      legacyReports: 0,
    };
    if (db) {
      const sharedStore = storeLib.open(db, storeLib.SHARED);
      const lastRun = await storeLib.latestRun(sharedStore);
      if (lastRun) value.lastRun = { collectedAt: lastRun.collectedAt, mode: lastRun.mode, total: lastRun.total, site: lastRun.site || '', level: lastRun.level || '', register: lastRun.register || null };
      // The newest collection that read the records (only the hospital PC does).
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

  return { job, site, shared, local, localDb, sharedDb, collect, run, facts, latest, patient, admissions, forget: () => { statusCache = null; } };
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
    res.json({ ...service.job, ...(await service.facts()), canManage: isAdmin(req) });
  }));

  app.post('/api/h360/collect', guard, json, route(async (req, res) => {
    if (service.job.running) return res.status(409).json({ error: 'A collection is already running.' });
    const mode = (req.body || {}).mode;
    if (service.site() === 'cloud') {
      // No background work on the live site: the lists are refreshed while the request waits.
      await service.run('list');
      return res.json({ ok: !service.job.error, error: service.job.error, log: service.job.log });
    }
    service.run(mode);
    res.json({ ok: true });
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

  app.get('/api/h360/export.xlsx', guard, route(async (req, res) => {
    const { snapshot, store } = await service.latest();
    if (!snapshot) return res.status(404).send('Nothing collected yet.');
    const workbook = storeLib.buildWorkbook(snapshot, await storeLib.loadRecords(store), await service.admissions());
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${storeLib.excelName(snapshot)}"`);
    await workbook.xlsx.write(res);
    res.end();
  }));

  /* ---- the H360 log sheets ---- */

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
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${render.fileName(report, 'docx')}"`);
    res.end(await render.toDocx(report));
  }));

  app.get('/api/h360/sheets/:id/print', guard, route(async (req, res) => {
    const render = require('./render');
    res.type('html').send(render.toHtml(await sheets.get(await service.shared(), req.params.id)));
  }));

  return service;
}

module.exports = { mount, createService };
