/* Staff Management → H360 Check (server/h360/staff.js + staff-match.js) against a stand-in H360.
   Proves: only the Employee Roster page and its Employee Search query are ever requested,
   the comparison statuses are right, bulk verify and the sweep finish in steps, and the
   register is never written. The collection parts need MongoDB on this computer.
   Run:  node test/h360-staff.test.js */
const assert = require('assert');
const http = require('http');
const express = require('express');
const { MongoClient } = require('mongodb');

process.env.JWT_SECRET = 'h360-staff-test-secret';
delete process.env.H360_SECRET;
delete process.env.HIS_USER;
delete process.env.HIS_PASS;
delete process.env.VERCEL;
delete process.env.CRON_SECRET;

const views = require('../h360/views');
const match = require('../h360/staff-match');
const staff = require('../h360/staff');
const settings = require('../h360/settings');
const { standIn } = require('./h360-standin');

let passed = 0;
const ok = (name) => { passed++; console.log('  ok  ' + name); };
const listen = (app) => new Promise((resolve) => { const s = http.createServer(app).listen(0, '127.0.0.1', () => resolve(s)); });

(async () => {
  /* ---- pieces without H360 or a database ---- */
  assert.ok(match.nameScore('Afroza Akter', 'Afroja Akter') >= match.SAME_NAME);
  assert.ok(match.nameScore('Ashraf Ali', 'Md. Ashraf Ali Munna') >= match.SAME_NAME);
  assert.ok(match.nameScore('Nahida Akter Dipa', 'Mst. Nahida Akter') >= match.SAME_NAME);
  assert.ok(match.nameScore('Runa Akter', 'Mishu Akter') < match.SIMILAR_NAME, 'a shared "Akter" is not the same person');
  assert.ok(match.nameScore('Rina Akter', 'Runa Akter') < match.SIMILAR_NAME, 'one letter of the given name makes another person');
  assert.ok(match.nameScore('Bipasa Maitra', 'Akram Hossain') < 0.2);
  ok('names: Mst./Md., Afroza/Afroja and a missing middle name are the same person; a shared family name is not');

  assert.deepStrictEqual(match.phoneKeys('01700000001, 01800000002'), ['1700000001', '1800000002']);
  assert.deepStrictEqual(match.phoneKeys(['+8801613068260']), ['1613068260']);
  assert.strictEqual(match.deptAgrees('MICU', 'Nursing Services - MICU'), true);
  assert.strictEqual(match.deptAgrees('SICU', 'Nursing Services - MICU'), false);
  assert.strictEqual(match.desigAgrees('ICU PCA', 'Patient Care Assistant'), true);
  assert.strictEqual(match.desigAgrees('Staff Nurse', 'Patient Care Assistant'), false);
  assert.strictEqual(views.isoOfDmy('01-10-2026'), '2026-10-01');
  ok('phones (two in one field, +880), departments "Nursing Services - X", designations and dd-mm-yyyy dates compare loosely');

  const rows = views.employeeRows(JSON.stringify([{ doctor_id: '1', person_code: '11809', full_name: ' Khadija  Akter ', phone_mobile: '01613068260, 01711111111', su_name: 'Nursing Services - MICU', designation: 'Staff Nurse', join_date: '01-10-2026', doctor_signature: 'data:image/png;base64,xx', gender_txt: 'Female' }, { person_code: '' }]));
  assert.strictEqual(rows.length, 1);
  assert.deepStrictEqual([rows[0].code, rows[0].name, rows[0].joinDate, rows[0].phones.length], ['11809', 'Khadija Akter', '2026-10-01', 2]);
  assert.ok(!('doctor_signature' in rows[0]));
  assert.strictEqual(views.employeeRows('<html>login</html>'), null);
  ok('an H360 answer becomes plain people (signature image dropped); a non-list answer is refused');

  const form = views.employeeSearchForm(`<input type="hidden" name="personnel_ind_name" value="employee"><script>x({ personnel_ind: $('#pi').val(), designation_code: '' })</script><input id="pi" value="1">`);
  assert.deepStrictEqual(form.params, { personnel_ind_name: 'employee', personnel_ind: '1', designation_code: '' });
  ok('the search box\'s hidden values are read from the page (input, script literal, $("#id").val())');

  const reg = [
    { id: 1, emp_id: '11809', name: 'Khadija Akter Happy', phone: '01613068260', gender: 'Female', doj: '2026-10-01', designation: 'Staff Nurse', current_department: 'MICU', role: 'Nurse', is_active: true },
    { id: 2, emp_id: '11410', name: 'Ashraf Ali', phone: '01305084466', designation: 'Patient Care Assistant', current_department: 'SICU', doj: '2025-09-15', role: 'PCA', is_active: true },
    { id: 3, emp_id: '11410', name: 'Md. Ashraf Ali Munna', phone: '01305084466', designation: 'ICU PCA', current_department: 'SICU', doj: '2025-09-15', role: 'PCA', is_active: true },
    { id: 4, emp_id: '11391', name: 'Bipasa Maitra', phone: '01753536065', designation: 'Staff Nurse', current_department: 'OT', role: 'Nurse', is_active: true },
    { id: 5, emp_id: '', name: 'Akram Hossain', phone: '01717138266', designation: 'PCA', current_department: 'OT', role: 'PCA', is_active: true },
    { id: 6, emp_id: '19999', name: 'Ghost Person', phone: '01999999999', role: 'Nurse', is_active: true },
    { id: 7, emp_id: '11809', name: 'Old Copy', is_active: false, former: true },
  ];
  const H = (code) => views.employeeRows(JSON.stringify(standIn().state.employees)).filter((r) => r.code === code);
  assert.strictEqual(match.compareRecord(reg[0], H('11809'), []).status, 'match');
  // Valid first: emp ID + name + designation. Joining date / phone / gender are details.
  assert.strictEqual(match.compareRecord({ ...reg[0], doj: '2026-10-02' }, H('11809'), []).status, 'valid_diff');
  // Department is ours (assigned by us): never a difference, even when H360's is another unit.
  const ownDept = match.compareRecord({ ...reg[0], current_department: 'OPD' }, H('11809'), []);
  assert.strictEqual(ownDept.status, 'match');
  assert.strictEqual(ownDept.fields.find((f) => f.key === 'current_department').ok, null);
  // Aklima's case: same name, ID and designation; own department; different joining date.
  assert.strictEqual(match.compareRecord({ ...reg[1], id: 9, emp_id: '11410', name: 'Md. Ashraf Ali Munna', current_department: 'OPD', doj: '2025-07-06' }, H('11410'), []).status, 'valid_diff');
  assert.strictEqual(match.compareRecord({ ...reg[0], designation: 'Patient Care Assistant' }, H('11809'), []).status, 'field_diff');
  assert.deepStrictEqual(match.compareRecord(reg[0], H('11809'), []).fields.filter((f) => f.copyable).map((f) => f.key).sort(), ['designation', 'doj', 'gender', 'phone']);
  // Missing on our side, present in H360: offered as a fill; still valid.
  const blank = match.compareRecord({ ...reg[0], doj: '', current_department: 'Unassigned' }, H('11809'), []);
  assert.strictEqual(blank.status, 'valid_diff');
  const doj = blank.fields.find((f) => f.key === 'doj');
  assert.deepStrictEqual([doj.missing, doj.ok, doj.copyable], [true, false, true]);
  const dept = blank.fields.find((f) => f.key === 'current_department');
  assert.deepStrictEqual([dept.missing, dept.fill, dept.ok, dept.copyable], [true, true, null, false]);
  assert.strictEqual(match.compareRecord({ ...reg[0], designation: '' }, H('11809'), []).status, 'valid_diff');
  // Spelling, not another person: same emp ID + same phone / joining date ("Armicka" vs "Arnika").
  const arnika = { code: '11696', name: 'Arnika Barai', phones: ['01724641388', '01568982140'], joinDate: '2026-07-15', designation: 'Staff Nurse - IPD', dept: 'Nursing Services - Cabin (L-9)', gender: 'Female' };
  const armicka = { id: 50, emp_id: '11696', name: 'Armicka Barai', phone: '01724641388', doj: '2026-07-15', designation: 'Staff Nurse', gender: 'Female', current_department: 'Level-10' };
  const sp = match.compareRecord(armicka, [arnika], []);
  assert.strictEqual(sp.status, 'field_diff');
  assert.deepStrictEqual(sp.nameSuggestion, { name: 'Arnika Barai', evidence: ['same phone', 'same joining date'], kind: 'spelling' });
  assert.strictEqual(match.compareRecord({ ...armicka, h360_name_accepted: 'Arnika Barai' }, [arnika], []).status, 'match');
  assert.strictEqual(match.compareRecord({ ...armicka, phone: '01999999999', doj: '2020-01-01' }, [arnika], []).status, 'id_other_person');
  assert.strictEqual(match.compareRecord({ ...armicka, name: 'Somebody Else Entirely' }, [arnika], []).status, 'id_other_person', 'a wholly different name is never a spelling mistake');
  // Same person, name written differently ("Arpana" / "Arpana Rani Das"): valid, H360's name offered.
  const arpH = { code: '11476', name: 'Arpana Rani Das', phones: ['01608087556'], joinDate: '2025-11-01', designation: 'Staff Nurse', dept: 'Nursing Services - Cabin (L-10)', gender: 'Female' };
  const arp = { id: 51, emp_id: '11476', name: 'Arpana', phone: '01608087556', doj: '2025-11-01', designation: 'Staff Nurse', gender: 'Female' };
  const wr = match.compareRecord(arp, [arpH], []);
  assert.deepStrictEqual([wr.status, wr.nameSuggestion && wr.nameSuggestion.kind, wr.nameSuggestion && wr.nameSuggestion.name], ['valid_diff', 'written', 'Arpana Rani Das']);
  assert.strictEqual(match.compareRecord({ ...arp, name: 'arpana  rani das ' }, [arpH], []).status, 'match');
  assert.strictEqual(match.compareRecord({ ...arp, h360_name_accepted: 'Arpana Rani Das' }, [arpH], []).status, 'match');
  // Phones: our main AND alternative number count; numbers H360 has that we hold nowhere are offered.
  const two = { ...arpH, name: 'Arpana', phones: ['01608087556', '01859877095'] };
  const phoneOf = (r) => match.compareRecord(r, [two], []).fields.find((f) => f.key === 'phone');
  assert.deepStrictEqual([phoneOf(arp).ok, phoneOf(arp).extraPhones], [true, ['01859877095']]);
  assert.deepStrictEqual([phoneOf({ ...arp, phone: '01711111111' }).ok, phoneOf({ ...arp, phone: '01711111111' }).extraPhones.length], [false, 2]);
  const viaAlt = phoneOf({ ...arp, phone: '01711111111', custom: { cf_alternative_phone_number: '01859877095' } });
  assert.deepStrictEqual([viaAlt.ok, viaAlt.alt, viaAlt.extraPhones], [true, '01859877095', ['01608087556']]);
  assert.strictEqual(phoneOf({ ...arp, custom: { cf_alternative_phone_number: '01859877095' } }).extraPhones, undefined);
  ok('a spelling difference with the same emp ID and phone / joining date is the same person (name suggested), not "another person"; "keep our spelling" makes it valid');
  ok('valid first: emp ID + name + designation = valid; other details only add a note; department is never compared; name and department are never copyable');
  const other = match.compareRecord(reg[3], H('11391'), []);
  assert.strictEqual(other.status, 'id_other_person');
  assert.strictEqual(other.h360.name, 'Akram Hossain');
  const noId = match.compareRecord(reg[4], [], H('11391'));
  assert.strictEqual(noId.status, 'no_emp_id');
  assert.strictEqual(noId.suggestions[0].code, '11391');
  assert.strictEqual(match.compareRecord(reg[5], [], []).status, 'not_in_h360');
  const dup = match.markDuplicates([match.compareRecord(reg[1], H('11410'), []), match.compareRecord(reg[2], H('11410'), [])], reg);
  assert.deepStrictEqual(dup.map((r) => [r.status, r.duplicateOf]), [['duplicate_id', [3]], ['duplicate_id', [2]]]);
  ok('statuses: match, field_diff, id_other_person (with H360\'s name), no_emp_id (with suggestion), not_in_h360, duplicate_id; Previous Staff never counts as a duplicate');

  const miss = match.missingFromRegister(views.employeeRows(JSON.stringify(standIn().state.employees)), reg);
  assert.deepStrictEqual(miss.map((m) => m.code).sort(), ['11391', '11843']);
  assert.strictEqual(miss.find((m) => m.code === '11843').ourMatch, null);
  assert.strictEqual(miss.find((m) => m.code === '11391').ourMatch.id, 5);
  ok('not in register: Nursing Services only (the doctor is left out); a person we hold without the ID points at our record');

  /* ---- against the stand-in H360, with MongoDB ---- */
  let client;
  try {
    client = new MongoClient('mongodb://127.0.0.1:27017', { serverSelectionTimeoutMS: 2500 });
    await client.connect();
  } catch (err) {
    console.log('  --  MongoDB is not running on this computer: the H360 tests were skipped.');
    console.log(`\n${passed} passed (H360 tests skipped)`);
    return;
  }
  const db = client.db('h360stafftest_' + Date.now().toString(36));
  const mock = standIn();
  const hospital = await listen(mock.app);
  mock.state.base = 'http://127.0.0.1:' + hospital.address().port;
  process.env.HIS_BASE_URL = mock.state.base;
  let server;
  try {
    const register = JSON.parse(JSON.stringify(reg));
    const before = JSON.stringify(register);
    const service = staff.createStaffService({ sharedDb: async () => db, loadRegister: async () => register, stepMs: 1500 });

    await assert.rejects(service.lookup('11809'), (err) => err.status === 409 && /No H360 login/.test(err.message));
    await settings.saveLogin(db, 'tester', 'secret-pass', 'admin');
    ok('without a saved H360 login the lookup says so (409) instead of asking for one');

    const found = await service.lookup('11809');
    assert.strictEqual(found.people.length, 1);
    assert.strictEqual(found.people[0].name, 'Khadija Akter Happy');
    // The Previous Staff copy holding the same ID is shown too, marked former.
    assert.deepStrictEqual(found.people[0].records.map((r) => [r.id, r.status, r.former]), [[1, 'match', false], [7, 'id_other_person', true]]);
    const byName = await service.lookup('Akter');
    assert.deepStrictEqual(byName.people.map((p) => p.code).sort(), ['11809', '11843']);
    ok('live lookup by emp ID and by name: H360\'s people with our matching record and its comparison');

    const one = await service.verifyOne(4);
    assert.strictEqual(one.status, 'id_other_person');
    ok('one record: Bipasa under 11391 is reported as "emp ID belongs to another person" (Akram Hossain)');

    const kept1 = await db.collection('staff').findOne({ id: 4 });
    assert.strictEqual(kept1.h360_verified.status, 'id_other_person');
    assert.strictEqual(kept1.h360_verified.other.name, 'Akram Hossain');
    assert.ok(!kept1.h360_verified.name, "the other person's details are not stored on our record");
    await service.verifyOne(1);
    const kept2 = await db.collection('staff').findOne({ id: 1 });
    assert.deepStrictEqual([kept2.h360_verified.code, kept2.h360_verified.dept, kept2.h360_verified.marital, kept2.h360_verified.age], ['11809', 'Nursing Services - MICU', 'Single', '24']);
    // The profile opens from what was saved — register changed since, judged as it is now.
    register[0].h360_verified = kept2.h360_verified;
    register[0].current_department = 'OPD';
    const view = await service.saved(1);
    assert.deepStrictEqual([view.saved, view.status, view.h360.dept], [true, 'match', 'Nursing Services - MICU']);
    delete register[0].h360_verified;
    register[0].current_department = 'MICU';
    const roster = require('../staff-roster').resolveRoster({ unico_staff_v3: JSON.stringify([{ id: 1, name: 'x' }]) }, [kept2]);
    assert.strictEqual(roster[0].h360_verified.code, '11809');
    const merge = require('../staff-merge');
    const baseRow = JSON.stringify([{ id: 1, name: 'x', h360_verified: kept2.h360_verified }]);
    assert.doesNotThrow(() => merge.mergeStaffChanges(baseRow, JSON.stringify([{ id: 1, name: 'y', h360_verified: kept2.h360_verified }]), JSON.stringify([{ id: 1, name: 'x' }])));
    ok('every check keeps the H360 values on the record (staff document, by record id); the profile view comes from that, with no H360 request; register saves never 409 on it');

    let state = { run: await service.verifyStart({ by: 'tester' }) };
    assert.strictEqual(state.run.total, 6);
    for (let i = 0; state.run && i < 30; i++) state = await service.verifyStep(state.run.id);
    assert.strictEqual(state.run, null);
    const res = await service.results();
    const st = Object.fromEntries(res.list.map((r) => [r.id, r.status]));
    assert.deepStrictEqual(st, { 1: 'match', 2: 'duplicate_id', 3: 'duplicate_id', 4: 'id_other_person', 5: 'no_emp_id', 6: 'not_in_h360' });
    assert.strictEqual(res.list.find((r) => r.id === 5).suggestions[0].code, '11391');
    ok('bulk verify runs in steps to the end; every status lands on the right record');

    let sweep = { run: await service.sweepStart('tester') };
    for (let i = 0; sweep.run && i < 200; i++) sweep = await service.sweepStep(sweep.run.id);
    assert.strictEqual(sweep.run, null);
    const missing = await service.missing();
    assert.deepStrictEqual(missing.list.map((m) => m.code).sort(), ['11391', '11843']);
    const kept = await db.collection('h360Employees').find().toArray();
    assert.ok(!kept.some((k) => k.code === '10123'), 'other hospital staff are not stored');
    ok('sweep: H360 Nursing Services people missing from the register are found; the doctor is not stored');

    assert.deepStrictEqual(await service.daily(2000), ['daily check is off']);
    assert.strictEqual((await service.setOptions({ daily: true }, 'tester')).daily, true);
    assert.ok((await service.daily(3000)).some((x) => /verify/.test(x)));
    await service.setOptions({ daily: false }, 'tester');
    ok('the daily check is off until someone turns it on, and runs once it is');

    // ONE sign-in for the whole app, reused by every process until H360 ends it.
    const count = (what) => mock.state.hits.filter((h) => h === what).length;
    const fresh = () => staff.createStaffService({ sharedDb: async () => db, loadRegister: async () => register, stepMs: 1500 });
    await fresh().signOut();
    mock.state.hits.length = 0;
    const first = fresh();
    const t0 = Date.now();
    await first.lookup('11809');
    assert.strictEqual(first.signedInSince(t0), true);
    assert.deepStrictEqual([count('POST /login'), count('GET /roster/employee-roster')], [1, 2]);
    for (const q of ['11410', '11391', '11843', 'Akter', 'Khadija']) await fresh().lookup(q);
    assert.deepStrictEqual([count('POST /login'), count('GET /roster/employee-roster'), count('GET /login')], [1, 2, 1], 'new processes resume the kept session without asking H360');
    ok('first click signs in once and checks in the same go; later clicks from new processes reuse it (no sign-in, no roster page)');

    await fresh().signOut();
    mock.state.hits.length = 0;
    const cold = fresh();
    await Promise.all(['11809', '11410', '11391', '11843'].map((q) => cold.lookup(q)));
    assert.strictEqual(count('POST /login'), 1, 'four searches at once share one sign-in');
    mock.state.expired = true;
    mock.state.hits.length = 0;
    const later = fresh();
    const t1 = Date.now();
    const again = await later.lookup('11809');
    assert.strictEqual(again.people[0].name, 'Khadija Akter Happy');
    assert.deepStrictEqual([count('POST /login'), later.signedInSince(t1)], [1, true]);
    ok('when H360 ends the session the click signs in again by itself, once, and still answers');

    await fresh().signOut();
    await settings.saveLogin(db, 'tester', 'wrong-pass', 'admin');
    mock.state.hits.length = 0;
    await assert.rejects(fresh().lookup('11809'), /Login failed/);
    assert.strictEqual(count('POST /login'), 1, 'a wrong password is tried once, never looped');
    await settings.saveLogin(db, 'tester', 'secret-pass', 'admin');
    const info = await fresh().sessionInfo();
    assert.strictEqual(info.active, false);
    await fresh().lookup('11809');
    assert.strictEqual((await fresh().sessionInfo()).active, true);
    ok('a wrong H360 password fails once with the reason; sign-out clears the session and the next click signs in');

    const wb = await service.workbook(new Set(register.map((r) => r.id)));
    assert.deepStrictEqual(wb.worksheets.map((w) => w.name), ['Verify', 'Not in register', 'Duplicates & IDs']);
    assert.strictEqual(wb.getWorksheet('Verify').rowCount, 7);
    ok('Excel: Verify / Not in register / Duplicates & IDs');

    const app = express();
    staff.mount(app, { service, loadRegister: async () => register });
    server = await listen(app);
    const base = 'http://127.0.0.1:' + server.address().port;
    assert.strictEqual((await fetch(base + '/api/h360-staff/cron')).status, 401);
    assert.strictEqual((await fetch(base + '/api/h360-staff/search?q=ab')).status, 400);
    const status = await (await fetch(base + '/api/h360-staff/status')).json();
    assert.strictEqual(status.byId[4].s, 'id_other_person');

    // Opt-in permission: staff access alone is not enough; admins and the "H360 Check" tick are.
    const gated = express();
    let who = null;
    gated.use((req, res, next) => { req.access = who; next(); });
    staff.mount(gated, { service, loadRegister: async () => register });
    const gServer = await listen(gated);
    const gBase = 'http://127.0.0.1:' + gServer.address().port;
    const codeFor = async (acc, path) => { who = acc; return (await fetch(gBase + path)).status; };
    const viewer = { unrestricted: false, role: 'User', perms: { staff: ['view'] }, staffScope: 'all', subMenus: null };
    assert.strictEqual(await codeFor({ unrestricted: true }, '/api/h360-staff/status'), 200);
    assert.strictEqual(await codeFor(viewer, '/api/h360-staff/status'), 403);
    assert.strictEqual(await codeFor(viewer, '/api/h360-staff/search?q=11809'), 403);
    assert.strictEqual(await codeFor(viewer, '/api/h360-staff/saved/1'), 403);
    assert.strictEqual(await codeFor({ ...viewer, subMenus: { staff: ['staffAll', 'staffH360'] } }, '/api/h360-staff/status'), 200);
    assert.strictEqual(await codeFor({ ...viewer, perms: { staff: [] }, subMenus: { staff: ['staffH360'] } }, '/api/h360-staff/status'), 403);
    gServer.close();
    ok('H360 data is admin-only unless the "H360 Check" tick is given (staff view access alone gets 403)');
    ok('routes: the cron refuses a caller that is not the cron; short searches refused; badges come from the last check');

    const allowed = new Set(['GET /login', 'POST /login', 'GET /dashboard', 'GET /roster/employee-roster', 'POST /doctor-info-autocomplete']);
    const strange = [...new Set(mock.state.hits)].filter((h) => !allowed.has(h));
    assert.deepStrictEqual(strange, []);
    assert.strictEqual(JSON.stringify(register), before);
    ok('only the sign-in, the Employee Roster page and its Employee Search were ever requested; our register was not changed');
  } finally {
    if (server) server.close();
    hospital.close();
    await db.dropDatabase().catch(() => {});
    await client.close();
  }
  console.log(`\n${passed} passed`);
  process.exit(0);
})().catch((err) => { console.error(err); process.exit(1); });
