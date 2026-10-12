/* H360 link (server/h360): a collection end to end against a stand-in H360.
   The stand-in serves the same pages H360 does (sign-in form, Nurse Station page,
   station lists, patient tabs, record pages, IPD Admission) with made-up patients.
   Needs MongoDB on this computer for the two stores; skipped without it.
   Run:  node test/h360.test.js */
const assert = require('assert');
const http = require('http');
const express = require('express');
const { MongoClient } = require('mongodb');

process.env.JWT_SECRET = 'h360-test-secret';
delete process.env.H360_SECRET;
delete process.env.VERCEL;

const h360 = require('../h360');
const storeLib = require('../h360/store');
const sheets = require('../h360/sheets');
const settings = require('../h360/settings');
const register = require('../h360/register');
const views = require('../h360/views');
const httpSession = require('../h360/session-http');
const browserSession = require('../h360/session-browser');

let passed = 0;
const ok = (name) => { passed++; console.log('  ok  ' + name); };
const { standIn, TODAY, daysAgo } = require('./h360-standin');

const listen = (app) => new Promise((resolve) => { const server = http.createServer(app).listen(0, '127.0.0.1', () => resolve(server)); });

(async () => {
  /* ---- pieces that need no database ---- */
  assert.strictEqual(register.stamp('2026-10-11 11:49:22'), '2026-10-11 11:49:22');
  assert.strictEqual(register.stamp('11/10/2026 01:05 PM'), '2026-10-11 13:05:00');
  assert.strictEqual(register.stamp('11-Oct-2026 12:10 AM'), '2026-10-11 00:10:00');
  assert.strictEqual(register.stamp('11-10-2026'), '2026-10-11 00:00:00');
  assert.strictEqual(register.stamp('soon'), '');
  ok('dates of the IPD Admission list are read in every usual form');

  assert.strictEqual(register.outcomeOf({ dischargeType: 'LAMA', discharged: '1' }), 'lama');
  assert.strictEqual(register.outcomeOf({ status: 'Expired' }), 'death');
  assert.strictEqual(register.outcomeOf({ death: '1' }), 'death');
  assert.strictEqual(register.outcomeOf({ dischargedAt: '2026-10-11 10:00:00' }), 'discharged');
  assert.strictEqual(register.outcomeOf({ status: 'Admitted', discharged: '0' }), '');
  ok('how a patient left is told apart: discharged, LAMA, death, still admitted');

  const named = register.parse({ answers: [{ path: '/x', method: 'GET', body: { recordsTotal: 1, data: [{ admission_no_pk: 7, patient_code: 'U7', patient_name: '<b>SEVEN</b>', admission_date: '2026-10-01 10:00:00', dis_ind: 1, dis_datetime: '2026-10-05 09:00:00', dis_reason: 'DORB', action: '<a href="/x">Edit</a>' }] } }] });
  assert.strictEqual(named.rows.length, 1);
  assert.strictEqual(named.rows[0].fields.name, 'SEVEN');
  assert.strictEqual(named.rows[0].fields.outcome, 'lama');
  assert.strictEqual(named.rows[0].key, '7');
  assert.ok(!('action' in named.rows[0].raw));
  assert.strictEqual(register.parse({ answers: [{ path: '/y', method: 'GET', body: { data: [{ id: 1, title: 'not patients' }] } }], html: '' }).shape.found, false);
  ok('the IPD Admission list is recognised by its column names, and other lists are not mistaken for it');

  assert.throws(() => views.assertReadOnly('https://his.example/ipd/discharge-request/5', 'https://his.example'), /Blocked/);
  assert.throws(() => views.assertReadOnly('https://his.example/consultation-note/5?x=1', 'https://his.example'), /Blocked/);
  assert.throws(() => views.assertReadOnly('https://elsewhere.example/consultation-note/5', 'https://his.example'), /Blocked/);
  assert.ok(views.assertReadOnly('https://his.example/consultation-note/5', 'https://his.example'));
  ok('only view-only H360 pages may be requested');

  /* ---- the login is sealed ---- */
  delete process.env.HIS_USER; delete process.env.HIS_PASS;
  await settings.saveLogin(null, 'someone', 'p@ss word', 'admin');
  assert.deepStrictEqual((({ user, pass, source }) => ({ user, pass, source }))(await settings.login(null)), { user: 'someone', pass: 'p@ss word', source: 'saved' });
  process.env.JWT_SECRET = 'another-server';
  const other = await settings.login(null);
  assert.strictEqual(other.pass, '');
  assert.strictEqual(other.elsewhere, true);
  process.env.JWT_SECRET = 'h360-test-secret';
  await settings.forgetLogin(null);
  assert.strictEqual((await settings.login(null)).user, '');
  ok('the H360 login opens only on the server that saved it, and can be removed');

  /* ---- a collection end to end ---- */
  let client;
  try {
    client = new MongoClient('mongodb://127.0.0.1:27017', { serverSelectionTimeoutMS: 2500 });
    await client.connect();
  } catch (err) {
    console.log('  --  MongoDB is not running on this computer: the collection tests were skipped.');
    console.log(`\n${passed} passed (collection tests skipped)`);
    return;
  }
  const stamp = Date.now().toString(36);
  const sharedDb = client.db('h360test_shared_' + stamp);
  const localDb = client.db('h360test_local_' + stamp);
  const mock = standIn();
  const hospital = await listen(mock.app);
  mock.state.base = 'http://127.0.0.1:' + hospital.address().port;
  process.env.HIS_BASE_URL = mock.state.base;
  let appServer;
  try {
    let where = 'pc';
    const service = h360.createService({ sharedDb: async () => sharedDb, localDb: async () => localDb, site: () => where, openSession: (cfg) => httpSession.open(cfg) });
    const sealed = async () => JSON.stringify(await sharedDb.collection('h360Settings').find().toArray());

    await assert.rejects(service.collect('full'), /login is not set/);
    await settings.saveLogin(sharedDb, 'tester', 'wrong', 'admin');
    await assert.rejects(service.collect('full'), /Login failed.*credentials do not match/);
    await settings.saveLogin(sharedDb, 'tester', 'secret-pass', 'admin');
    assert.ok(!(await sealed()).includes('secret-pass'));
    ok('a missing or wrong H360 login stops the collection with the reason; the saved password is not readable in the database');

    const lines = [];
    const first = await service.collect('full', (m) => lines.push(m));
    assert.strictEqual(first.mode, 'full');
    assert.strictEqual(first.rows.length, 3);
    assert.ok(lines.some((m) => /IPD Admission list: 5 rows read/.test(m)), lines.join(' | '));
    const localStore = storeLib.open(localDb, storeLib.LOCAL);
    const sharedStore = storeLib.open(sharedDb, storeLib.SHARED);
    assert.ok((await localDb.collection('modules').countDocuments({ hasData: true })) >= 9);
    assert.strictEqual(await sharedDb.collection('h360Modules').countDocuments(), 0);
    const alpha = await sharedDb.collection('h360Patients').findOne({ uhid: 'U0001' });
    assert.strictEqual(alpha.suggestion.diagnosis, 'Pneumonia\nDM');
    assert.ok(/stable on room air/.test(alpha.suggestion.nursing));
    assert.strictEqual(alpha.data['Attendant Mobile'], undefined);
    assert.strictEqual(alpha.admission.contact_person_mobile, undefined);
    assert.strictEqual(alpha.profile['Contact No'], undefined);
    assert.strictEqual(alpha.profile.Age, '35 Y 0 M 3 D');
    const ownAlpha = await localDb.collection('patients').findOne({ uhid: 'U0001' });
    assert.strictEqual(ownAlpha.data['Attendant Mobile'], '01700000000');
    assert.strictEqual(ownAlpha.alerts.Allergy, 'Penicillin');
    ok('a full collection keeps every record on the PC and only the log sheet content in the app database');

    assert.ok(!mock.state.hits.some((hit) => /discharge|bill/.test(hit)), 'an action page was opened');
    assert.deepStrictEqual([...new Set(mock.state.hits.filter((hit) => !hit.startsWith('GET ')))].sort(), ['POST /login', 'POST /v2/ipd/nurse-station-received-patient']);
    ok('nothing but view-only pages was requested: no discharge, billing or other action link');

    const viewed = await service.patient('1002');
    assert.strictEqual(viewed.records, 'here');
    assert.ok(viewed.modules.some((m) => m.key === 'ot-procedure-note' && m.entries.length));
    const listed = await service.latest();
    assert.strictEqual(listed.records, 'here');
    assert.ok(listed.snapshot.columns.includes('Attendant Mobile'));
    ok('on the PC the patient viewer shows the full records');

    /* the log sheet */
    const sheet = await sheets.create(sharedStore, { date: TODAY, shift: 'Morning' }, 'tester');
    const names = (id) => sheet.data[id].rows.map((row) => row.name);
    assert.deepStrictEqual(names('newAdmissions'), ['TEST ALPHA', 'TEST DELTA']);
    assert.deepStrictEqual(names('critical'), ['TEST BRAVO']);
    assert.deepStrictEqual(names('ward'), ['TEST CHARLIE']);
    assert.deepStrictEqual(names('discharged'), ['TEST ECHO']);
    assert.strictEqual(sheet.data.discharged.rows[0].billing, 'Cleared');
    assert.strictEqual(sheet.data.newAdmissions.rows[0].dept, 'Level-10\n1018/B');
    assert.strictEqual(sheet.data.newAdmissions.rows[0].diagnosis, 'Pneumonia\nDM');
    assert.strictEqual(sheet.data.surgeries.rows[0].surgery, 'Appendectomy');
    assert.strictEqual(sheet.data.pressureSores.rows[0].name, 'TEST BRAVO');
    assert.strictEqual(sheet.data.general.rows.find((row) => row.item === 'Planned Discharges').value, '01');
    assert.strictEqual(sheet.data.census.fields.ipd, '3');
    ok('a new log sheet is filled from the collection, with the IPD Admission list adding an unlisted admission and a discharge');

    /* a list-only refresh from the live site */
    const gone = mock.state.patients.splice(2, 1)[0];
    mock.state.left.charlie = { ...gone, dis_ind: '1', dis_datetime: `${TODAY} 00:55:00`, dis_reason: 'LAMA' };
    where = 'cloud';
    const refreshed = await service.collect('full', () => {});
    assert.strictEqual(refreshed.mode, 'list');
    const charlie = await sharedDb.collection('h360Patients').findOne({ uhid: 'U0003' });
    assert.strictEqual(charlie.active, false);
    const alphaAfter = await sharedDb.collection('h360Patients').findOne({ uhid: 'U0001' });
    assert.strictEqual(alphaAfter.suggestion.diagnosis, 'Pneumonia\nDM');
    assert.strictEqual(alphaAfter.data.Records, alpha.data.Records);
    assert.strictEqual(await localDb.collection('runs').countDocuments(), 1);
    assert.strictEqual((await service.latest()).records, 'pc-only');
    ok('the live site refreshes the lists only: who left is marked, what the records said is kept');

    const typed = await sheets.get(sharedStore, sheet.id);
    typed.data.ward.rows[0].diagnosis = 'Typed by the supervisor';
    const saved = await sheets.update(sharedStore, sheet.id, { ...typed, baseUpdatedAt: typed.updatedAt }, 'tester');
    await assert.rejects(sheets.update(sharedStore, sheet.id, { ...typed, baseUpdatedAt: typed.updatedAt }, 'other'), (err) => err.status === 409);
    const result = await sheets.refresh(sharedStore, sheet.id, {}, 'tester');
    assert.deepStrictEqual(result.moved, ['TEST CHARLIE (LAMA)']);
    assert.strictEqual(result.report.data.ward.rows.length, 0);
    assert.strictEqual(result.report.data.lama.rows[0].diagnosis, 'Typed by the supervisor');
    assert.strictEqual(result.report.data.lama.rows[0].reason, 'LAMA');
    assert.deepStrictEqual(result.report.data.discharged.rows.map((row) => row.name), ['TEST ECHO']);
    assert.ok(saved.updatedAt);
    ok('Update from H360 moves a patient who left against advice to LAMA and keeps what was typed; an older copy cannot overwrite a newer save');

    /* every record in the app database, then back to the log sheet only */
    where = 'pc';
    await settings.saveLevel(sharedDb, 'all', 'admin');
    const quick = await service.collect('quick', () => {});
    assert.strictEqual(quick.mode, 'quick');
    const online = await sharedDb.collection('h360Modules').countDocuments();
    assert.ok(online >= 6, 'records online: ' + online);
    const run = await storeLib.latestRun(sharedStore);
    assert.strictEqual(await sharedDb.collection('h360Modules').countDocuments({ lastRunId: run._id, hasData: true }), (await storeLib.loadRecords(localStore)).length);
    assert.strictEqual((await sharedDb.collection('h360Patients').findOne({ uhid: 'U0001' })).data['Attendant Mobile'], '01700000000');
    where = 'cloud';
    assert.strictEqual((await service.patient('1002')).records, 'shared');
    await settings.saveLevel(sharedDb, 'sheet', 'admin');
    const trimmed = await storeLib.trimToSheet(sharedStore);
    assert.strictEqual(trimmed.records, online);
    assert.strictEqual(await sharedDb.collection('h360Modules').countDocuments(), 0);
    assert.strictEqual((await sharedDb.collection('h360Patients').findOne({ uhid: 'U0001' })).data['Attendant Mobile'], undefined);
    assert.strictEqual((await service.patient('1002')).records, 'pc-only');
    where = 'pc';
    ok('"everything" puts the records in the app database; going back to "log sheet only" takes them out again');

    /* reports of the stand-alone collector */
    const { ObjectId } = require('mongodb');
    const oldId = new ObjectId();
    await localDb.collection('reports').insertOne({ _id: oldId, date: daysAgo(1), shift: 'Night', title: 'Log Sheet for Night Supervisor', data: {}, preparedBy: { role: '', name: 'Old' }, updatedAt: new Date(), createdAt: new Date() });
    assert.strictEqual(await sheets.legacyWaiting(sharedStore, localDb), 1);
    assert.deepStrictEqual(await sheets.importLegacy(sharedStore, localDb), { found: 1, copied: 1 });
    assert.deepStrictEqual(await sheets.importLegacy(sharedStore, localDb), { found: 1, copied: 0 });
    assert.strictEqual((await sheets.get(sharedStore, String(oldId))).data.general.rows.length, 21);
    ok('reports written with the old collector are brought in once and open in the app');

    /* the API */
    const api = express();
    h360.mount(api, { service });
    appServer = await listen(api);
    const base = 'http://127.0.0.1:' + appServer.address().port;
    const get = async (path) => { const r = await fetch(base + path); return { status: r.status, type: r.headers.get('content-type') || '', body: Buffer.from(await r.arrayBuffer()) }; };
    const status = JSON.parse((await get('/api/h360/status')).body);
    assert.strictEqual(status.hasLogin, true);
    assert.strictEqual(status.user, 'tester');
    assert.ok(!JSON.stringify(status).includes('secret-pass'));
    assert.deepStrictEqual(status.modes, ['quick', 'full', 'list']);
    assert.strictEqual(status.lastRun.register.found, true);
    assert.ok(status.lastRun.register.recognised.dischargedAt);
    assert.strictEqual(JSON.parse((await get('/api/h360/patients')).body).rows.length, 2);
    assert.strictEqual(JSON.parse((await get('/api/h360/admissions')).body).rows.length, 5);
    assert.strictEqual(JSON.parse((await get('/api/h360/schema')).body).sections.length, 18);
    assert.strictEqual(JSON.parse((await get('/api/h360/sheets')).body).length, 2);
    const word = await get(`/api/h360/sheets/${sheet.id}/docx`);
    assert.strictEqual(word.body.slice(0, 2).toString(), 'PK');
    const print = (await get(`/api/h360/sheets/${sheet.id}/print`)).body.toString();
    assert.ok(print.includes('Log Sheet for Morning Supervisor') && print.includes('TEST ECHO') && print.includes('data:image/png;base64,'));
    const excel = await get('/api/h360/export.xlsx');
    assert.strictEqual(excel.status, 200);
    assert.strictEqual(excel.body.slice(0, 2).toString(), 'PK');
    assert.strictEqual((await get('/api/h360/patient/9999')).status, 404);
    const started = await fetch(base + '/api/h360/collect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'list' }) });
    assert.strictEqual((await started.json()).ok, true);
    for (let i = 0; i < 100 && service.job.running; i++) await new Promise((r) => setTimeout(r, 100));
    assert.strictEqual(service.job.error, null);
    assert.ok(service.job.log.some((line) => /Done: 2 patients/.test(line.message)));
    ok('the API serves status, patients, the IPD Admission list, log sheets, Word, print and Excel, and never the password');

    /* the same collection through a real browser, with a list the page loads by itself */
    mock.state.registerMode = 'xhr';
    let viaBrowser = null;
    if (browserSession.available()) {
      try {
        viaBrowser = await browserSession.open({ baseUrl: mock.state.base, pageUrl: mock.state.base + '/v2/ipd/nurse-station-receive-request', user: 'tester', pass: 'secret-pass', headless: true, concurrency: 4 });
      } catch (err) {
        console.log('  --  no Chrome or Edge to drive: the browser test was skipped (' + err.message.split('\n')[0] + ')');
      }
    }
    if (viaBrowser) {
      try {
        const stations = await viaBrowser.stations();
        assert.strictEqual(stations.length, 2);
        const lists = await viaBrowser.lists(stations);
        assert.strictEqual(JSON.parse(lists[0].body).data.length, 1);
        const read = register.parse(await viaBrowser.register());
        assert.strictEqual(read.shape.found, true);
        assert.strictEqual(read.shape.source, 'query');
        assert.strictEqual(read.rows.length, 5, 'the whole list, not only its first page');
        assert.strictEqual(read.rows.find((row) => row.fields.uhid === 'U0003').fields.outcome, 'lama');
        const pageHtml = await viaBrowser.get(mock.state.base + '/consultation-note/1001');
        assert.ok(/stable on room air/.test(pageHtml.html));
      } finally {
        await viaBrowser.close();
      }
      ok('through Chrome: sign-in, stations, lists, and the whole IPD Admission list as the page loads it');
    }
    assert.ok(!mock.state.hits.some((hit) => /discharge|bill/.test(hit)), 'an action page was opened');
  } finally {
    if (appServer) appServer.close();
    hospital.close();
    await sharedDb.dropDatabase().catch(() => {});
    await localDb.dropDatabase().catch(() => {});
    await client.close();
  }
  console.log(`\n${passed} passed`);
})().catch((err) => { console.error('\nFAILED:', err.stack || err.message); process.exit(1); });
