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
const opdList = require('../h360/opd');

let passed = 0;
const ok = (name) => { passed++; console.log('  ok  ' + name); };
const { standIn, TODAY, daysAgo, shiftNow, inShift } = require('./h360-standin');
const SHIFT = shiftNow();

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

  /* ---- the period a report covers ---- */
  assert.deepStrictEqual(sheets.shiftHours('8:00 PM - 8:00 AM'), ['20:00', '08:00']);
  assert.deepStrictEqual(sheets.shiftHours('07:00-15:00'), ['07:00', '15:00']);
  assert.strictEqual(sheets.shiftHours('M1'), null);
  const night = sheets.period('2026-10-13', 'Night', '');
  assert.deepStrictEqual([night.from, night.to, night.days], ['2026-10-13 20:00:00', '2026-10-14 08:00:00', ['2026-10-13', '2026-10-14']]);
  const morning = sheets.period('2026-10-14', 'Morning', '');
  const evening = sheets.period('2026-10-14', 'Evening', '');
  assert.ok(night.to <= morning.from && morning.to <= evening.from, 'the three shifts of a day must not overlap');
  assert.strictEqual(sheets.period('2026-10-14', 'Morning', '7:00 AM - 3:00 PM').to, '2026-10-14 15:00:00');
  ok('a report covers its own shift hours, and the three shifts of a day do not overlap');

  /* ---- the diagnosis read out of a clinical summary ---- */
  assert.deepStrictEqual(sheets.diagnosisInSummary('Admission issue:\n1. Fever, weakness\n2. Anorexia, vomiting\nDx\n1. Dengue fever\n2. DM\nPlan:\nIV fluid'), ['Dengue fever', 'DM']);
  assert.deepStrictEqual(sheets.diagnosisInSummary('Admission Issues:\n1. Fever 3 days\nDx: DF, HTN, ?UTI\nHBSAG+\nPlan: CBC'), ['DF, HTN, ?UTI', 'HBSAG+']);
  assert.deepStrictEqual(sheets.diagnosisInSummary('Issues and Progress:\n1. Fever for 4 days (NS1 positive)\n2. Cough for 2 days.'), []);
  assert.deepStrictEqual(sheets.diagnosisInSummary('Pneumonia\nDM'), ['Pneumonia', 'DM']);
  assert.strictEqual(sheets.ventilationOf({ breathing: '', diagnosis: 'Septic shock • Type-2 RF requiring MV D5', summary: '', progress: '' }), 'Invasive');
  assert.strictEqual(sheets.ventilationOf({ breathing: '', diagnosis: 'S/P Extubation D2 (On MV from 2.10.26 -5.10.26)', summary: '', progress: '' }), null);
  assert.strictEqual(sheets.ventilationOf({ breathing: 'BiPAP 2 hourly', diagnosis: '', summary: '', progress: '' }), 'Non-Invasive (CPAP/BiPAP)');
  ok('the diagnosis is taken from under a "Dx" heading and never from the headings themselves; ventilation is read from the notes when the oxygen box is empty');

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

    assert.ok(!mock.state.hits.some((hit) => /discharge|bill|vitals-entry|opd-emr/.test(hit)), 'an action page was opened');
    assert.deepStrictEqual([...new Set(mock.state.hits.filter((hit) => !hit.startsWith('GET ')))].sort(), ['POST /login', 'POST /v2/ipd/nurse-station-received-patient']);
    ok('nothing but view-only pages was requested: no discharge, billing or other action link');

/* the OPD Nurse Station list */
    assert.ok(lines.some((m) => /OPD list: 4 out-patients, 2 with vitals taken, 2 seen by the doctor/.test(m)), lines.join(' | '));
    const opdShared = await sharedDb.collection('h360Opd').findOne({ _id: SHIFT.date });
    assert.deepStrictEqual(opdShared.counts, { all: 4, appointed: 2, prescribed: 2, vitals: 2, attended: 3 });
    assert.strictEqual(opdShared.rows, undefined);
    assert.deepStrictEqual(opdShared.departments.map((d) => [d.department, d.total, d.vitals]).sort(), [['Family medicine', 2, 0], ['General Surgery', 2, 2]]);
    const opdOwn = await localDb.collection('opd').findOne({ _id: SHIFT.date });
    assert.deepStrictEqual(opdOwn.rows.map((row) => [row.name, row.serial, row.status, row.vitals]).sort(), [
      ['OPD ANNA', '24', 'Appointed (Vitals Taken)', true], ['OPD BEN', '10', 'Appointed', false], ['OPD CARA', '2', 'Prescribed', false], ['OPD DAN', '', 'Prescribed (Vitals Taken)', true]]);
    assert.strictEqual(opdOwn.rows[0].department.length > 0 && opdOwn.rows[0].doctor.startsWith('Dr.'), true);
    assert.strictEqual((await service.outPatients()).rows.length, 4);
    ok('the OPD list is read: every out-patient of the day, who has had vitals taken, who has been seen; the app database keeps the counts only');

    const viewed = await service.patient('1002');
    assert.strictEqual(viewed.records, 'here');
    assert.ok(viewed.modules.some((m) => m.key === 'ot-procedure-note' && m.entries.length));
    const listed = await service.latest();
    assert.strictEqual(listed.records, 'here');
    assert.ok(listed.snapshot.columns.includes('Attendant Mobile'));
    ok('on the PC the patient viewer shows the full records');

    /* the log sheet */
    const sheet = await sheets.create(sharedStore, { date: SHIFT.date, shift: SHIFT.shift }, 'tester');
    const names = (id) => sheet.data[id].rows.map((row) => row.name);
    assert.deepStrictEqual(names('newAdmissions'), ['TEST DELTA']);
    assert.deepStrictEqual(names('critical'), ['TEST BRAVO']);
    assert.deepStrictEqual(names('ward'), ['TEST CHARLIE']);
    // ALPHA has a discharge request in H360 (a pink row there): Discharged, not New Admission
    assert.deepStrictEqual(names('discharged'), ['TEST ALPHA', 'TEST ECHO']);
    assert.strictEqual(sheet.data.discharged.rows[1].billing, 'Cleared');
    assert.strictEqual(sheet.data.discharged.rows[0].dept, 'Level-10\n1018/B');
    assert.strictEqual(sheet.data.discharged.rows[0].diagnosis, 'Pneumonia\nDM');
    assert.strictEqual(sheet.data.discharged.rows[0].remarks, undefined);
    assert.ok(/^Yes/.test(first.rows[0]['Discharge Request']) && first.rows[1]['Discharge Request'] === 'No');
    assert.strictEqual(sheet.data.surgeries.rows[0].surgery, 'Appendectomy');
    assert.strictEqual(sheet.data.pressureSores.rows[0].name, 'TEST BRAVO');
    assert.strictEqual(sheet.data.general.rows.find((row) => row.item === 'Planned Discharges').value, '01');
    assert.strictEqual(sheet.data.census.fields.ipd, '3');
    assert.strictEqual(sheet.data.census.fields.opd, '2');
    ok('a new log sheet is filled from the collection: a discharge request goes to Discharged, and the IPD Admission list adds an unlisted admission and a discharge');

    /* a list-only refresh from the live site */
    const gone = mock.state.patients.splice(2, 1)[0];
    mock.state.left.charlie = { ...gone, dis_ind: '1', dis_datetime: `${inShift(25)}`, dis_reason: 'LAMA' };
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
    assert.deepStrictEqual(result.report.data.discharged.rows.map((row) => row.name), ['TEST ALPHA', 'TEST ECHO']);
    assert.ok(saved.updatedAt);
    ok('Update from H360 moves a patient who left against advice to LAMA and keeps what was typed; an older copy cannot overwrite a newer save');

    /* a patient gone from the lists whose shift nobody can tell: offered, not placed */
    const dayBefore = new Date(Date.now() - 12 * 3600 * 1000); // before this shift began, inside the last day
    await sharedDb.collection('h360Patients').insertOne({ key: 'U0009|IP-9', uhid: 'U0009', ipNo: 'IP-9', admissionNo: '1009', patientNo: '509', active: false, station: 'Nurse Station L-9',
      lastSeenAt: dayBefore, inactiveSince: new Date(), seq: 9, admission: { patient_name: 'TEST INDIA', patient_code: 'U0009', admission_uid: 'IP-9', bed_name: '905', primary_doctor_name: 'Dr. Nine', admission_date: daysAgo(2) + ' 10:00:00', death_ind: '0' }, profile: { Age: '40 Y 0 M 0 D' } });
    const bridgeLib = require('../h360/bridge');
    const offered = await sheets.fill(sharedStore, bridgeLib.toSheet({ date: SHIFT.date, shift: SHIFT.shift }), {}, new Map());
    assert.deepStrictEqual(offered.unsure.map((item) => [item.name, item.row.name, item.row.dept]), [['TEST INDIA', 'TEST INDIA', 'Level-09\n905']]);
    assert.ok(!offered.data.discharged.rows.some((row) => row.name === 'TEST INDIA'));
    assert.deepStrictEqual(offered.moved, ['TEST CHARLIE (LAMA)', 'TEST ECHO (Discharged)']);
    // last seen three days ago: left on an earlier day, not offered at all
    await sharedDb.collection('h360Patients').updateOne({ uhid: 'U0009' }, { $set: { lastSeenAt: new Date(Date.now() - 72 * 3600 * 1000) } });
    const older = await sheets.fill(sharedStore, bridgeLib.toSheet({ date: SHIFT.date, shift: SHIFT.shift }), {}, new Map());
    assert.deepStrictEqual(older.unsure, []);
    assert.ok(!older.data.discharged.rows.some((row) => row.name === 'TEST INDIA'));
    await sharedDb.collection('h360Patients').deleteOne({ uhid: 'U0009' });
    ok('a patient who left between two collections a day apart is offered to the supervisor, not written into a shift they may not have left in');

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

/* the real Nurse Station page fills its station list in by script: without a browser it is not there */
    mock.state.stationsMode = 'script';
    assert.strictEqual((await settings.stations(sharedDb)).guessed, false);
    await sharedDb.collection('h360Settings').deleteOne({ _id: 'stations' });
    await sharedDb.collection('h360Runs').updateMany({}, { $set: { stationList: [] } });
    await localDb.collection('runs').updateMany({}, { $set: { stationList: [] } });
    where = 'cloud';
    await assert.rejects(service.collect('list'), /No nurse stations were found.*hospital PC first/);
    const noted = await sharedDb.collection('h360Settings').findOne({ _id: 'diagnostics' });
    assert.strictEqual(noted.notes.stations.selects[0].id, 'nurse_station_received');
    assert.ok(noted.notes.stations.addresses.includes('/v2/ipd/get-nurse-station-list'));
    assert.ok(!mock.state.hits.includes('GET /v2/ipd/get-nurse-station-list'), 'an address found in a script was requested');
    // on the PC the stations of the patients it already holds are used, and passed on to the live site
    where = 'pc';
    const lines2 = [];
    await service.collect('list', (m) => lines2.push(m));
    assert.ok(lines2.some((m) => /using the 2 stations already known/.test(m)), lines2.join(' | '));
    const guessed = await settings.stations(sharedDb);
    assert.strictEqual(guessed.guessed, true);
    assert.deepStrictEqual(guessed.map((item) => item.value).sort(), ['11', '12']);
    where = 'cloud';
    assert.strictEqual((await service.collect('list')).rows.length, 2);
    // station numbers that H360 does not know give no patients: nothing is saved, nobody is marked as gone
    await sharedDb.collection('h360Settings').updateOne({ _id: 'stations' }, { $set: { list: [{ value: '98', text: 'Wrong' }] } });
    await sharedDb.collection('h360Runs').updateMany({}, { $set: { stationList: [] } });
    const activeBefore = await sharedDb.collection('h360Patients').countDocuments({ active: true });
    await assert.rejects(service.collect('list'), /no patients for any nurse station, so nothing was changed/);
    assert.strictEqual(await sharedDb.collection('h360Patients').countDocuments({ active: true }), activeBefore);
    // a list really read by a browser replaces the guess, and a later guess does not replace it
    await settings.saveStations(sharedDb, [{ value: '11', text: 'Nurse Station L-10' }, { value: '12', text: 'Nursing Services - MICU' }], { site: 'pc' });
    await settings.saveStations(sharedDb, [{ value: '98', text: 'Wrong' }], { guessed: true });
    assert.strictEqual((await settings.stations(sharedDb)).length, 2);
    assert.strictEqual((await service.collect('list')).rows.length, 2);
    mock.state.stationsMode = '';
    where = 'pc';
    ok('a Nurse Station page that fills its list by script: known stations are used, an empty answer changes nothing, and no address from a script is ever requested');

/* H360 as it really answers: an empty frame first, the page itself to a second request */
    mock.state.shell = true;
    await sharedDb.collection('h360Settings').deleteOne({ _id: 'stations' });
    await sharedDb.collection('h360Runs').updateMany({}, { $set: { stationList: [] } });
    where = 'cloud';
    const framed = [];
    const viaFrame = await service.collect('list', (m) => framed.push(m));
    assert.strictEqual(viaFrame.rows.length, 2);
    assert.ok(!framed.some((m) => /already known/.test(m)), framed.join(' | '));
    assert.ok(framed.some((m) => /IPD Admission list: 5 rows read/.test(m)), framed.join(' | '));
    assert.ok(framed.some((m) => /OPD list: 4 out-patients, 2 with vitals taken/.test(m)), framed.join(' | '));
    const readStations = await settings.stations(sharedDb);
    assert.strictEqual(readStations.guessed, false);
    assert.deepStrictEqual(readStations.map((item) => item.value), ['11', '12']);
    mock.state.shell = false;
    where = 'pc';
    ok('a page that is an empty frame is read the way its own script reads it: stations, IPD Admission and OPD without a browser');

    /* the live site reads the records too: the lists first, then a few patients per step */
    process.env.H360_STEP_MS = '1';
    const live = h360.createService({ sharedDb: async () => sharedDb, localDb: async () => localDb, site: () => 'cloud', openSession: (cfg) => httpSession.open(cfg) });
    delete process.env.H360_STEP_MS;
    await sharedDb.collection('h360Patients').updateMany({}, { $unset: { suggestion: '', recordsAt: '' }, $set: { profile: {}, 'data.Age': '' } });
    const loginsBefore = mock.state.hits.filter((hit) => hit === 'POST /login').length;
    let going = await live.cloudStart('quick', 'tester');
    assert.strictEqual(going.resumable, true);
    assert.deepStrictEqual([going.progress.patients, going.progress.done, going.progress.stage], [2, 0, 'records']);
    assert.ok(!JSON.stringify(going).includes('cookies'));
    await assert.rejects(live.cloudStep('not-this-one'), (err) => err.status === 409);
    let steps = 0;
    while (going.resumable && steps < 10) { going = await live.cloudStep(going.id); steps++; }
    assert.ok(steps >= 1 && steps <= 2, 'steps: ' + steps);
    assert.deepStrictEqual([going.progress.done, going.progress.stage, going.resumable], [2, 'done', false]);
    assert.ok(going.progress.pages >= 14, 'pages: ' + going.progress.pages);
    assert.deepStrictEqual(going.progress.stations.map((item) => [item.total, item.done]), [[1, 1], [1, 1]]);
    assert.ok(going.log.some((line) => /Done: the records of 2 patients were read/.test(line.message)));
    assert.strictEqual(mock.state.hits.filter((hit) => hit === 'POST /login').length, loginsBefore + 1, 'one sign-in for the lists and all the steps');
    const bravoLive = await sharedDb.collection('h360Patients').findOne({ uhid: 'U0002' });
    assert.strictEqual(bravoLive.suggestion.diagnosis, 'Pneumonia\nDM');
    assert.strictEqual(bravoLive.suggestion.surgeries[0].surgery, 'Appendectomy');
    assert.deepStrictEqual([bravoLive.profile.Age, bravoLive.data.Age, bravoLive.profile['Contact No']], ['9 Y 2 M 0 D', '9 Y 2 M 0 D', undefined]);
    assert.ok(bravoLive.recordsAt && Number(bravoLive.data.Records) >= 4);
    assert.strictEqual(await sharedDb.collection('h360Modules').countDocuments(), 0);
    assert.strictEqual((await live.cloudState()).resumable, false);
    // straight afterwards there is nothing left for a quick update; a full collection reads everyone again
    const nothing = await live.cloudStart('quick', 'tester');
    assert.deepStrictEqual([nothing.resumable, nothing.progress.patients], [false, 0]);
    await settings.saveLevel(sharedDb, 'all', 'admin');
    let whole = await live.cloudStart('full', 'tester');
    assert.strictEqual(whole.progress.patients, 2);
    for (let i = 0; whole.resumable && i < 10; i++) whole = await live.cloudStep(whole.id);
    assert.ok((await sharedDb.collection('h360Modules').countDocuments({ hasData: true })) >= 6);
    assert.strictEqual((await live.patient('1002')).records, 'shared');
    assert.strictEqual((await sharedDb.collection('h360Patients').findOne({ uhid: 'U0002' })).profile['Contact No'], '01711111111');
    await settings.saveLevel(sharedDb, 'sheet', 'admin');
    await storeLib.trimToSheet(sharedStore);
    assert.ok(!mock.state.hits.some((hit) => /discharge|bill|vitals-entry|opd-emr/.test(hit)), 'an action page was opened');
    ok('the live site reads the records in steps: one sign-in, progress kept in the database, nothing stored under "log sheet only", everything under "everything"');

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
    assert.strictEqual(JSON.parse((await get('/api/h360/opd')).body).counts.vitals, 2);
    const onBoard = JSON.parse((await get('/api/h360/board')).body);
    assert.deepStrictEqual(onBoard.patients.map((p) => [p.name, p.dept, p.bed, p.critical, p.dischargeRequested, p.diagnosis]), [
      ['TEST ALPHA', 'Level-10', '1018/B', false, true, 'Pneumonia\nDM'], ['TEST BRAVO', 'MICU', 'MICU-3', true, false, 'Pneumonia\nDM']]);
    assert.ok(onBoard.collectedAt);
    assert.strictEqual(JSON.parse((await get('/api/h360/sheets')).body).length, 2);
    const word = await get(`/api/h360/sheets/${sheet.id}/docx`);
    assert.strictEqual(word.body.slice(0, 2).toString(), 'PK');
    const print = (await get(`/api/h360/sheets/${sheet.id}/print`)).body.toString();
    assert.ok(print.includes('Log Sheet for ' + SHIFT.shift + ' Supervisor') && print.includes('TEST ECHO') && print.includes('data:image/png;base64,'));
    const excel = await get('/api/h360/export.xlsx');
    assert.strictEqual(excel.status, 200);
    assert.strictEqual(excel.body.slice(0, 2).toString(), 'PK');
    assert.strictEqual((await get('/api/h360/patient/9999')).status, 404);
/* the shift supervisor report, filled in from H360 (New Report) */
    const post = async (path, body) => { const r = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) }); return { status: r.status, body: await r.json() }; };
    const mine = {
      date: SHIFT.date, shift: SHIFT.shift, supervisorName: 'Test Supervisor', shiftTime: '',
      cabinArea: [{ dept: 'IPD Cabin Level 10', bed: '1020/A', name: 'TEST CHARLIE', uhid: 'U0003', diagnosis: 'Typed by hand', remarks: 'Keep me', c_custom: 'a custom column' }],
      criticalArea: [{ dept: 'Medical ICU', bed: 'MICU-9', name: 'TEST BRAVO', uhid: 'U0002', diagnosis: '', remarks: '' }],
      newAdmissions: [{ dept: 'IPD Cabin Level 10', bed: '1018/B', name: 'TEST ALPHA', uhid: 'U0001', diagnosis: 'Fever', remarks: 'typed' }],
      general: { codeBlue: '2' }, census: { 'OPD Total': '40' },
    };
    const filledIn = await post('/api/h360/fill', { report: mine, options: {} });
    assert.strictEqual(filledIn.status, 200, JSON.stringify(filledIn.body));
    const got = filledIn.body.report;
    assert.deepStrictEqual(got.cabinArea, []);
    assert.strictEqual(got.lama.length, 1);
    assert.deepStrictEqual((({ dept, bed, name, diagnosis, remarks, c_custom, reasonDama }) => ({ dept, bed, name, diagnosis, remarks, c_custom, reasonDama }))(got.lama[0]),
      { dept: 'IPD Cabin Level 10', bed: '1020/A', name: 'TEST CHARLIE', diagnosis: 'Typed by hand', remarks: 'Keep me', c_custom: 'a custom column', reasonDama: 'LAMA' });
    const bravo = got.criticalArea[0];
    assert.strictEqual(bravo.diagnosis, 'Pneumonia\nDM');
    assert.strictEqual(bravo.bed, 'MICU-3');
    assert.strictEqual(bravo.dept, 'MICU');
    assert.strictEqual(bravo.h360Dept, true);
    assert.deepStrictEqual(got.newAdmissions.map((row) => [row.name, row.dept, row.bed]), [['TEST DELTA', 'Level-11', '1101/A']]);
    assert.strictEqual(got.newAdmissions[0].h360, true);
    // ALPHA was typed under New Admission; H360 now shows a discharge request, so the row moves as it is
    assert.deepStrictEqual(got.discharged.map((row) => [row.name, row.dept, row.diagnosis, row.billing || '']), [['TEST ALPHA', 'IPD Cabin Level 10', 'Fever', ''], ['TEST ECHO', 'Level-9', '', 'Cleared']]);
    assert.deepStrictEqual(filledIn.body.requested, ['TEST ALPHA']);
    assert.deepStrictEqual(filledIn.body.opd.counts, { all: 4, appointed: 2, prescribed: 2, vitals: 2, attended: 3 });
    assert.deepStrictEqual((({ name, surgery, anaesthetist, anaesthesia }) => ({ name, surgery, anaesthetist, anaesthesia }))(got.surgeries[0]), { name: 'TEST BRAVO', surgery: 'Appendectomy', anaesthetist: 'Dr. Sleep', anaesthesia: 'GA' });
    assert.strictEqual(got.pressureSore[0].name, 'TEST BRAVO');
    assert.deepStrictEqual(got.general, { plannedDischarge: '01' });
    assert.deepStrictEqual(filledIn.body.census, [{ unit: 'Level-10', patients: '01' }, { unit: 'MICU', patients: '01' }]);
    assert.deepStrictEqual(filledIn.body.moved, ['TEST CHARLIE (LAMA)', 'TEST ECHO (Discharged)']);
    // filling the same report again adds nothing twice
    const again = await post('/api/h360/fill', { report: { ...mine, ...got, general: { ...mine.general, ...got.general } }, options: {} });
    assert.strictEqual(again.body.report.newAdmissions.length, 1);
    assert.strictEqual(again.body.report.discharged.length, 2);
    assert.deepStrictEqual(again.body.requested, []);
    assert.strictEqual(again.body.report.lama.length, 1);
    assert.strictEqual(again.body.report.surgeries.length, 1);
    assert.deepStrictEqual(again.body.added, []);
    ok('New Report is filled in from H360: patients go to their lists, a discharge request moves the row to Discharged, typed text and custom columns are kept, and a second fill adds nothing twice');

    const supervisor = require('../supervisor-reports');
    const kept = await supervisor.saveReport({ ...mine, ...got, general: { ...mine.general, ...got.general }, createdBy: 'tester' });
    const logSheet = await get('/api/h360/report/' + kept.id + '/docx');
    assert.strictEqual(logSheet.body.slice(0, 2).toString(), 'PK');
    const page = (await get('/api/h360/report/' + kept.id + '/print')).body.toString();
    assert.ok(page.includes('Log Sheet for ' + SHIFT.shift + ' Supervisor') && page.includes('TEST CHARLIE') && page.includes('Level-10<br>1018/B') && page.includes('Test Supervisor'), 'the print page of a supervisor report');
    assert.strictEqual((await get('/api/h360/report/nope/docx')).status, 404);
    // Print & Export sends the headings and tables it is showing: its Word file is that page, not the log sheet
    const shown = {
      header: { hospital: 'Test Hospital', title: 'Log Sheet For Morning Supervisor', lines: [['Supervisor:', 'Test Supervisor']] },
      blocks: [{ type: 'heading', text: 'New Admission : 1' }, { type: 'table', kind: 'rows', head: 1, widths: [0.2, 0.8], rows: [[{ t: 'S/N', h: 1 }, { t: 'Name of Patient', h: 1 }], [{ t: '1' }, { t: 'TEST DELTA' }]] }],
      footer: ['Test Hospital', 'Generated today'],
    };
    const asShown = await fetch(base + '/api/h360/report/word', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(shown) });
    assert.strictEqual(asShown.status, 200);
    assert.strictEqual(Buffer.from(await asShown.arrayBuffer()).slice(0, 2).toString(), 'PK');
    assert.strictEqual((await post('/api/h360/report/word', { blocks: [] })).status, 400);
    const waitingBefore = JSON.parse((await get('/api/h360/status')).body).sheetsWaiting;
    assert.strictEqual(waitingBefore, 2);
    const converted = await post('/api/h360/sheets/convert');
    assert.strictEqual(converted.body.converted, 2);
    assert.strictEqual((await post('/api/h360/sheets/convert')).body.converted, 0);
    const all = await supervisor.getReports({});
    const fromSheet = all.find((r) => r.date === SHIFT.date && r.id !== kept.id);
    assert.ok(fromSheet && fromSheet.status === 'draft' && fromSheet.lama.some((row) => row.name === 'TEST CHARLIE' && row.dept === 'Level-10' && row.bed === '1020/A'));
    assert.strictEqual(all.length, 3);
    ok('a supervisor report prints as the Word log sheet, and the log sheets written before become draft reports once');

    const started = await fetch(base + '/api/h360/collect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'list' }) });
    assert.strictEqual((await started.json()).ok, true);
    for (let i = 0; i < 100 && service.job.running; i++) await new Promise((r) => setTimeout(r, 100));
    assert.strictEqual(service.job.error, null);
    assert.ok(service.job.log.some((line) => /Done: 2 patients/.test(line.message)));
    ok('the API serves status, patients, the IPD Admission list, log sheets, Word, print and Excel, and never the password');

    /* the same collection through a real browser, with a list the page loads by itself */
    mock.state.registerMode = 'xhr';
    mock.state.shell = true;
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
        const outPatients = opdList.parse(await viaBrowser.opd());
        assert.deepStrictEqual(outPatients.counts, { all: 4, appointed: 2, prescribed: 2, vitals: 2, attended: 3 });
        assert.strictEqual(outPatients.date, SHIFT.date);
        const pageHtml = await viaBrowser.get(mock.state.base + '/consultation-note/1001');
        assert.ok(/stable on room air/.test(pageHtml.html));
      } finally {
        await viaBrowser.close();
      }
      ok('through Chrome, with pages that arrive as an empty frame: sign-in, stations, lists, the whole IPD Admission list as the page loads it, and the three OPD lists');
    }
    assert.ok(!mock.state.hits.some((hit) => /discharge|bill|vitals-entry|opd-emr/.test(hit)), 'an action page was opened');
  } finally {
    if (appServer) appServer.close();
    hospital.close();
    await sharedDb.dropDatabase().catch(() => {});
    await localDb.dropDatabase().catch(() => {});
    await client.close();
  }
  console.log(`\n${passed} passed`);
})().catch((err) => { console.error('\nFAILED:', err.stack || err.message); process.exit(1); });
