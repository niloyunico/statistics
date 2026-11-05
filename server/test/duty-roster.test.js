/* Duty roster save guards — no database (in-memory store in duty-roster.js).
   The failures these pin down all overwrote a real month's roster without an error:
     - a "draft" autosave landing after approval un-published and overwrote the sheet,
     - a browser that edited an older revision erased cells somebody else had saved,
     - a save without `note`/`status` wiped the note and reverted a submitted roster,
     - a nurse transferred away lost her name from a sheet that still holds her shifts,
     - a department-scoped account could read and write any unit's roster. */
process.env.MONGODB_URI = '';
const assert = require('node:assert/strict');
const express = require('express');

/* Fakes, installed before anything loads them: the department map names the canonical
   units the review inbox and the setup are rowed by; the users store feeds the setup
   pickers; the activity log is captured so the hand-overs can be checked for logging. */
const logged = [];
const fake = (rel, exports) => { const p = require.resolve(rel); require.cache[p] = { id: p, filename: p, loaded: true, exports }; };
const ACCOUNTS = [
  { username: 'admin', name: 'Administrator', role: 'Administrator', active: true },
  { username: 'rahima', name: 'Rahima Akter', role: 'User', active: true, rosterRole: 'incharge', rosterScope: 'departments', rosterDepartments: ['micu'] },
  { username: 'farida', name: 'Farida Begum', role: 'User', active: true, rosterRole: 'manager', rosterScope: 'departments', rosterDepartments: [] },
  { username: 'nasrin', name: 'Nasrin Sultana', role: 'User', active: true, rosterRole: 'cns' },
  { username: 'gone', name: 'Left Already', role: 'User', active: false, rosterRole: 'manager' },
  { username: 'shirin', name: 'Shirin Akter', role: 'User', active: true, rosterRole: 'incharge', rosterScope: 'departments', rosterDepartments: [] },
  { username: 'chelcia', name: 'Chelcia Bani Baroi', role: 'User', active: true, rosterRole: 'incharge', rosterScope: 'all' },
  { username: 'plain', name: 'No Role', role: 'User', active: true },
];
const fakeUsers = {
  findOne: async (q) => ACCOUNTS.find((u) => u.username === q.username) || null,
  find: (q) => ({ toArray: async () => ACCOUNTS.filter((u) => !(q && q.active && q.active.$ne === false) || u.active !== false), sort() { return this; } }),
};
fake('../db', { getDbHandle: async () => null, getUsers: async () => fakeUsers, getDepartments: async () => [], getAppData: async () => ({}), getStaff: async () => [] });
fake('../deptmap', { get: async () => ({ byId: { micu: { id: 'micu', name: 'Medical ICU' }, ccu: { id: 'ccu', name: 'CCU' }, nicu: { id: 'nicu', name: 'NICU' }, __hospital__: { id: '__hospital__', name: 'Overall Hospital', qualityOnly: true } }, qkToId: {}, idToQk: {} }), HOSPITAL: '__hospital__' });
fake('../activity-log', { log: async (req, action, opts) => { logged.push({ action, by: req.access && req.access.username, opts }); } });
const roster = require('../duty-roster');

const USERS = {
  admin: { unrestricted: true, role: 'Administrator', staffScope: 'all' },
  icu: { unrestricted: false, role: 'User', perms: { roster: ['view', 'edit'] }, departments: ['micu'], qualityAreas: [], staffScope: 'departments' },
  // A ward in-charge who also holds hospital-wide quality areas.
  incharge: { unrestricted: false, role: 'incharge', perms: {}, departments: ['micu'], qualityAreas: ['CCU', 'Overall Hospital'] },
  /* The roster assignment proper: a person who rosters CCU and nothing else, while
     their STAFF access is wide open. Before rosterScope existed this account fell
     through to staffScope 'all' and quietly held every unit's roster — the exact hole
     that made a per-unit roster grant impossible to express. */
  ccuLead: { unrestricted: false, role: 'User', perms: { roster: ['view', 'edit'] }, departments: [], qualityAreas: [], staffScope: 'all', rosterScope: 'departments', rosterDepartments: ['ccu'] },
  // Assigned the module but no units: an empty list means NO rosters, never all of them.
  noUnits: { unrestricted: false, role: 'User', perms: { roster: ['view', 'edit'] }, departments: [], qualityAreas: [], staffScope: 'all', rosterScope: 'departments', rosterDepartments: [] },
  // Two people on the SAME unit — the point of the feature: both work one sheet.
  ccuMate: { unrestricted: false, role: 'User', perms: { roster: ['view', 'edit'] }, departments: [], qualityAreas: [], staffScope: 'all', rosterScope: 'departments', rosterDepartments: ['ccu', 'micu'] },
  /* The ward in-charge an administrator TRUSTED with their own sheet: same portal role
     as `incharge` above, plus rosterEdit. They build and hand in one unit's roster and
     nothing more — no approving, no other unit, no delete. */
  wardLead: { unrestricted: false, role: 'incharge', perms: {}, departments: ['ccu'], qualityAreas: ['Overall Hospital'], rosterEdit: true },
  // Never assigned (no rosterScope at all) + unrestricted staff scope = the old reach.
  legacy: { unrestricted: false, role: 'User', perms: { roster: ['view', 'edit'] }, departments: [], qualityAreas: [], staffScope: 'all' },
  /* The review chain. The in-charge builds MICU; the manager is named for MICU on the
     setup screen and holds no unit assignment at all (review reach comes from the setup);
     the CNS holds the module view-only — approving is her ROLE, not a module action. */
  rahima: { unrestricted: false, username: 'rahima', name: 'Rahima Akter', role: 'User', rosterRole: 'incharge', perms: { roster: ['view', 'edit'] }, departments: [], qualityAreas: [], staffScope: 'all', rosterScope: 'departments', rosterDepartments: ['micu'] },
  farida: { unrestricted: false, username: 'farida', name: 'Farida Begum', role: 'User', rosterRole: 'manager', perms: { roster: ['view'] }, departments: [], qualityAreas: [], staffScope: 'all', rosterScope: 'departments', rosterDepartments: [] },
  nasrin: { unrestricted: false, username: 'nasrin', name: 'Nasrin Sultana', role: 'User', rosterRole: 'cns', perms: { roster: ['view'] }, departments: [], qualityAreas: [], staffScope: 'all', rosterScope: 'all' },
  // Named NICU's In-charge in Setup, but holds Duty Roster VIEW only and no units: the
  // setup alone must let her prepare NICU's roster — and nothing else.
  shirin: { unrestricted: false, username: 'shirin', name: 'Shirin Akter', role: 'User', rosterRole: 'incharge', perms: { roster: ['view'] }, departments: [], qualityAreas: [], staffScope: 'all', rosterScope: 'departments', rosterDepartments: [] },
  // The live case: Duty Roster V/E/A/D/P with the account-wide "all units" default, In-charge
  // of Trainee Nurses only — she must see that unit and nothing else.
  chelcia: { unrestricted: false, username: 'chelcia', name: 'Chelcia Bani Baroi', role: 'User', rosterRole: 'incharge', perms: { roster: ['view', 'edit', 'add', 'delete', 'print'] }, departments: [], qualityAreas: [], staffScope: 'all', rosterScope: 'all' },
  // A second CNS-role holder who prepares a unit too: must not sign what she sent.
  dual: { unrestricted: false, username: 'dual', name: 'Dual Role', role: 'User', rosterRole: 'cns', perms: { roster: ['view', 'edit'] }, departments: [], qualityAreas: [], staffScope: 'all', rosterScope: 'all' },
};
const app = express();
app.use(express.json());
const as = (req, res, next) => { const u = USERS[req.headers['x-user'] || 'admin']; req.access = u; req.user = { sub: u.username || req.headers['x-user'] || 'admin', name: u.name || 'Administrator' }; next(); };
roster.mount(app, { requireApi: as, requireRead: as });

(async () => {
  const server = app.listen(0);
  const base = 'http://127.0.0.1:' + server.address().port;
  const call = (method, path, body, user) => fetch(base + path, {
    method, headers: { 'content-type': 'application/json', 'x-user': user || 'admin' }, body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const put = (body, user) => call('PUT', '/api/rosters', body, user);
  const month = { dept: 'MICU', year: 2026, month: 8 };
  try {
    // First save creates revision 1.
    let r = await put({ ...month, grid: { S1: { 1: 'M' } }, names: { S1: 'Rahima', S2: 'Karim' }, note: 'Eid week', status: 'submitted', baseRevision: 0 });
    assert.equal(r.status, 200); assert.equal(r.body.roster.revision, 1);

    // A save that does not carry note/status keeps them.
    r = await put({ ...month, grid: { S1: { 1: 'E' } }, names: { S1: 'Rahima' }, baseRevision: 1 });
    assert.equal(r.status, 200);
    assert.equal(r.body.roster.note, 'Eid week', 'note kept');
    assert.equal(r.body.roster.status, 'pending_cns', 'status kept (a legacy submit lands as pending_cns; an administrator may still save while pending)');
    assert.equal(r.body.roster.names.S2, 'Karim', 'a name no longer on the payload is kept on the sheet');

    // A browser still on revision 1 cannot erase revision 2.
    r = await put({ ...month, grid: { S1: { 1: 'N' } }, baseRevision: 1 });
    assert.equal(r.status, 409); assert.equal(r.body.conflict, true);
    assert.equal((await call('GET', '/api/rosters/MICU/2026/8')).body.roster.grid.S1['1'], 'E', 'the newer cells survive');

    // A save can never approve — and says which keys it ignored.
    r = await put({ ...month, grid: { S1: { 1: 'E' } }, status: 'approved', approvedBy: 'Somebody', baseRevision: 2 });
    assert.equal(r.body.roster.status, 'pending_cns');
    assert.deepEqual(r.body.ignored, ['status', 'approvedBy'], 'the save reports what it did not honour');
    assert.equal(r.body.roster.approvedBy, '', 'a payload never names the approver');

    // Approve, then a pending "draft" autosave lands: refused, sheet untouched.
    r = await call('POST', '/api/rosters/' + encodeURIComponent('ros-MICU-2026-08') + '/status', { status: 'approved' });
    assert.equal(r.body.roster.status, 'approved');
    r = await put({ ...month, grid: {}, status: 'draft', baseRevision: 3 });
    assert.equal(r.status, 409); assert.equal(r.body.locked, true);
    const after = (await call('GET', '/api/rosters/MICU/2026/8')).body.roster;
    assert.equal(after.status, 'approved'); assert.equal(after.grid.S1['1'], 'E');

    // Department scoping.
    await put({ dept: 'CCU', year: 2026, month: 8, grid: { S9: { 2: 'M' } } });
    assert.equal((await call('GET', '/api/rosters/CCU/2026/8', null, 'icu')).status, 403, 'another unit cannot be read');
    assert.equal((await put({ dept: 'CCU', year: 2026, month: 8, grid: {} }, 'icu')).status, 403, 'another unit cannot be written');
    assert.equal((await call('GET', '/api/rosters/MICU/2026/8', null, 'icu')).status, 200, 'own unit is readable');
    const listed = (await call('GET', '/api/rosters', null, 'icu')).body.rosters.map((x) => x.dept);
    assert.deepEqual(listed, ['MICU'], 'the index lists only own units');

    // Quality-area access does not unlock other units' rosters, even published ones.
    await call('POST', '/api/rosters/' + encodeURIComponent('ros-CCU-2026-08') + '/status', { status: 'approved' });
    assert.equal((await call('GET', '/api/rosters/CCU/2026/8', null, 'incharge')).status, 403, 'quality-area access does not unlock another unit');
    assert.deepEqual((await call('GET', '/api/rosters', null, 'incharge')).body.rosters.map((x) => x.dept), ['MICU'], 'an in-charge lists only own unit');

    /* ---- the roster's OWN department assignment ---- */
    // Scoped to CCU while holding every staff record: the roster grant decides, not staffScope.
    assert.equal((await call('GET', '/api/rosters/CCU/2026/8', null, 'ccuLead')).status, 200, 'an assigned unit is readable');
    assert.equal((await call('GET', '/api/rosters/MICU/2026/8', null, 'ccuLead')).status, 403, 'an unassigned unit is refused even with full staff access');
    assert.deepEqual((await call('GET', '/api/rosters', null, 'ccuLead')).body.rosters.map((x) => x.dept), ['CCU'], 'the index lists only assigned units');

    // Several people may hold the same unit — that is the whole point of the assignment.
    const mate = (await call('GET', '/api/rosters', null, 'ccuMate')).body.rosters.map((x) => x.dept).sort();
    assert.deepEqual(mate, ['CCU', 'MICU'], 'a second account holds the same unit, plus its own');
    assert.equal((await put({ dept: 'CCU', year: 2026, month: 9, grid: { S9: { 3: 'M' } } }, 'ccuMate')).status, 200, 'both accounts write the same unit');

    // Assigned the module but no units: nothing, rather than everything.
    assert.deepEqual((await call('GET', '/api/rosters', null, 'noUnits')).body.rosters, [], 'no units assigned means no rosters');
    assert.equal((await call('GET', '/api/rosters/CCU/2026/8', null, 'noUnits')).status, 403, 'no units assigned refuses every unit');

    // An account that predates the field keeps exactly the reach it had.
    assert.equal((await call('GET', '/api/rosters/CCU/2026/8', null, 'legacy')).status, 200, 'an unassigned legacy account is not narrowed');
    assert.equal((await call('GET', '/api/rosters/MICU/2026/8', null, 'legacy')).status, 200);

    /* ---- the scope route the renderer builds its unit list from ---- */
    let sc = (await call('GET', '/api/rosters/scope', null, 'ccuLead')).body;
    assert.equal(sc.scope, 'departments');
    assert.deepEqual(sc.units, ['CCU'], 'the scope route names the assigned units');
    assert.equal(sc.can.edit, true); assert.equal(sc.can.approve, false, 'approval stays administrator-only');
    sc = (await call('GET', '/api/rosters/scope', null, 'admin')).body;
    assert.equal(sc.scope, 'all'); assert.equal(sc.can.approve, true);
    assert.deepEqual((await call('GET', '/api/rosters/scope', null, 'noUnits')).body.units, [], 'no units assigned lists none');
    // A collector only ever receives published sheets, so it must not be offered an editor.
    assert.equal((await call('GET', '/api/rosters/scope', null, 'incharge')).body.can.edit, false, 'a portal account is read-only here');

    /* ---- the ward in-charge who may build their own unit's sheet ---- */
    sc = (await call('GET', '/api/rosters/scope', null, 'wardLead')).body;
    assert.equal(sc.can.edit, true, 'a granted in-charge is offered the editor');
    assert.equal(sc.can.submit, true, 'and may hand the sheet in');
    assert.equal(sc.can.approve, false, 'but never approves it');
    assert.equal(sc.can.delete, false, 'and never deletes one');
    assert.deepEqual(sc.units, ['CCU'], 'only their own unit');

    // An UNPUBLISHED sheet: hidden from a plain portal account, visible to the person
    // whose job is to write it (otherwise a draft vanished the moment it was saved).
    await put({ dept: 'MICU', year: 2026, month: 10, grid: { S1: { 1: 'M' } }, status: 'draft' });
    assert.equal((await call('GET', '/api/rosters/MICU/2026/10', null, 'incharge')).body.roster, null, 'an ungranted in-charge sees no draft');
    assert.equal((await call('GET', '/api/rosters/CCU/2026/9', null, 'wardLead')).body.roster.status, 'draft', 'the roster builder sees their own draft');
    assert.deepEqual((await call('GET', '/api/rosters', null, 'incharge')).body.rosters.map((x) => x.status), ['approved'], 'the ungranted index is published sheets only');

    // Writing: own unit yes, any other unit no.
    assert.equal((await put({ dept: 'CCU', year: 2026, month: 10, grid: { S9: { 1: 'M3' } } }, 'wardLead')).status, 200, 'own unit is writable');
    assert.equal((await put({ dept: 'MICU', year: 2026, month: 10, grid: {} }, 'wardLead')).status, 403, 'another unit is refused');

    // The one status move they hold is "hand it in".
    const ccuOct = encodeURIComponent('ros-CCU-2026-10');
    assert.equal((await call('POST', '/api/rosters/' + ccuOct + '/status', { status: 'approved' }, 'wardLead')).status, 403, 'an in-charge cannot approve their own roster');
    assert.equal((await call('GET', '/api/rosters/CCU/2026/10')).body.roster.status, 'draft', '...and the refused attempt did not hand the sheet in as a side effect');
    assert.notEqual((await call('POST', '/api/rosters/' + ccuOct + '/status', { status: 'draft' }, 'wardLead')).status, 200, 'nor reopen one');
    let sub = await call('POST', '/api/rosters/' + ccuOct + '/status', { status: 'submitted' }, 'wardLead');
    assert.equal(sub.status, 200); assert.equal(sub.body.roster.status, 'pending_cns', 'submitted for approval (the legacy route sends straight to the CNS)');
    assert.equal((await call('POST', '/api/rosters/' + encodeURIComponent('ros-MICU-2026-10') + '/status', { status: 'submitted' }, 'wardLead')).status, 403, 'and only for their own unit');

    // Once an administrator publishes it, it is locked against them like everyone else.
    await call('POST', '/api/rosters/' + ccuOct + '/status', { status: 'approved' });
    assert.equal((await put({ dept: 'CCU', year: 2026, month: 10, grid: {} }, 'wardLead')).status, 409, 'an approved sheet is locked');
    assert.equal((await call('POST', '/api/rosters/' + ccuOct + '/status', { status: 'submitted' }, 'wardLead')).status, 409, 'and cannot be re-submitted');
    assert.equal((await call('GET', '/api/rosters/CCU/2026/10')).body.roster.grid.S9['1'], 'M3', 'the published cells survive');


    /* ================= the review chain ================= */
    const T = (id, action, note, user) => call('POST', '/api/rosters/' + encodeURIComponent(id) + '/transition', { action, note }, user);
    const micuNov = 'ros-MICU-2026-10';
    const sheetOf = async (dept, y, m, user) => (await call('GET', '/api/rosters/' + dept + '/' + y + '/' + m, null, user)).body;

    // Setup: who prepares, checks and approves. Administrator only; accounts must exist and be active.
    assert.equal((await call('PUT', '/api/rosters/config', { cns: { username: 'nasrin' } }, 'icu')).status, 403, 'setup is administrator-only');
    assert.equal((await call('PUT', '/api/rosters/config', { depts: { nowhere: { manager: { username: 'farida' } } } })).status, 400, 'an unknown department is refused');
    assert.equal((await call('PUT', '/api/rosters/config', { depts: { micu: { manager: { username: 'gone' } } } })).status, 400, 'an inactive account is refused');
    assert.equal((await call('PUT', '/api/rosters/config', { depts: { micu: { manager: { username: 'nobody' } } } })).status, 400, 'an unknown account is refused');
    let cfgR = await call('PUT', '/api/rosters/config', { cns: { username: 'nasrin' }, depts: { micu: { incharge: { username: 'rahima' }, manager: { username: 'farida' } }, ccu: { incharge: { username: 'rahima' } } } });
    assert.equal(cfgR.status, 200); assert.equal(cfgR.body.cns.name, 'Nasrin Sultana');
    assert.ok(logged.some((l) => l.action === 'roster_config'), 'the setup change is logged');
    const cfgGet = (await call('GET', '/api/rosters/config', null, 'icu')).body;
    assert.deepEqual(cfgGet.depts.map((d) => d.id), ['ccu', 'micu', 'nicu', 'manager', 'supervisor', 'trainee'], 'every canonical unit is listed, named or not, plus the Nurse Managers, Nursing Supervisors and Trainee Nurses roster units');
    assert.equal(cfgGet.depts.find((d) => d.id === 'trainee').name, 'Trainee Nurses');
    assert.equal(cfgGet.depts.find((d) => d.id === 'micu').manager.username, 'farida');
    assert.equal(cfgGet.depts.find((d) => d.id === 'nicu').manager, null);
    const reviewers = (await call('GET', '/api/rosters/reviewers')).body.reviewers;
    assert.deepEqual(reviewers.map((r) => r.username + ':' + r.rosterRole).sort(), ['admin:admin', 'chelcia:incharge', 'farida:manager', 'nasrin:cns', 'rahima:incharge', 'shirin:incharge'], 'active role holders plus administrators, nobody else');
    assert.ok(reviewers.every((r) => r.perms === undefined && r.passwordHash === undefined), 'names and roster fields only');
    assert.ok(reviewers.every((r) => typeof r.desig === 'string'), 'each carries the staff-register designation (blank when unlinked) for the picker label');

    // The account-level flags the screens are built from.
    let can = (await call('GET', '/api/rosters/scope', null, 'farida')).body.can;
    assert.ok(can.forward && can.return && can.review && !can.approve && !can.reopen && !can.setup && !can.edit, 'a manager checks, returns and reviews; never approves, edits or sets up');
    can = (await call('GET', '/api/rosters/scope', null, 'nasrin')).body.can;
    assert.ok(can.approve && can.return && can.review && !can.forward && !can.reopen && can.role === 'cns', 'the CNS approves and returns');
    can = (await call('GET', '/api/rosters/scope', null, 'rahima')).body.can;
    assert.ok(can.send && can.edit && !can.review && can.role === 'incharge', 'the in-charge sends');
    assert.equal((await call('GET', '/api/rosters/scope', null, 'admin')).body.can.setup, true);

    // A unit with no sheet yet still answers with the names to print.
    let empty = await sheetOf('NICU', 2026, 10, 'admin');
    assert.equal(empty.roster, null); assert.equal(empty.signers.incharge, null, 'nobody set for NICU yet'); assert.equal(empty.signers.cns.name, 'Nasrin Sultana');
    assert.equal(empty.can.send, true, 'a brand-new sheet may be sent once saved');

    // draft -> send to manager -> forward -> approve
    r = await put({ dept: 'MICU', year: 2026, month: 10, grid: { S1: { 1: 'M3', 2: 'E4' }, S2: { 1: 'N1' } }, names: { S1: 'Rahima', S2: 'Karim' }, baseRevision: 1 }, 'rahima');
    assert.equal(r.status, 200); assert.deepEqual(r.body.roster.staffIds.sort(), ['S1', 'S2'], 'the staff index is kept on the sheet');
    assert.equal(r.body.roster.can.send, true); assert.equal(r.body.roster.signers.manager.name, 'Farida Begum');
    assert.equal((await T(micuNov, 'forward', '', 'rahima')).status, 409, 'a draft cannot be forwarded (bad state)');
    assert.equal((await T(micuNov, 'approve', '', 'nasrin')).body.code, 'bad_state');
    assert.equal((await T(micuNov, 'send_manager', '', 'farida')).status, 403, 'the manager does not send');
    r = await T(micuNov, 'send_manager', '', 'rahima');
    assert.equal(r.status, 200); assert.equal(r.body.roster.status, 'pending_manager'); assert.equal(r.body.roster.stage, 'manager');
    assert.equal(r.body.roster.preparedBy, 'Rahima Akter'); assert.equal(r.body.roster.sentBy, 'rahima');
    assert.equal((await put({ dept: 'MICU', year: 2026, month: 10, grid: { S1: { 1: 'M3' } }, baseRevision: 2 }, 'rahima')).status, 409, 'the author cannot edit a sheet with the manager');
    assert.equal((await put({ dept: 'MICU', year: 2026, month: 10, grid: { S1: { 1: 'M3', 2: 'E4' }, S2: { 1: 'N1' } }, baseRevision: 2 }, 'admin')).status, 200, 'an administrator may still save it');
    assert.equal((await sheetOf('MICU', 2026, 10, 'admin')).roster.status, 'pending_manager', 'without changing its status');
    assert.equal((await T(micuNov, 'approve', '', 'nasrin')).status, 409, 'the CNS cannot approve what is still with the manager');
    assert.equal((await T(micuNov, 'forward', '', 'icu')).status, 403, 'a unit editor cannot forward');
    // The manager sees the sheet through the setup, with no unit assignment of her own.
    assert.equal((await sheetOf('MICU', 2026, 10, 'farida')).roster.status, 'pending_manager', 'the named manager reads the sheet');
    assert.equal((await call('GET', '/api/rosters/CCU/2026/10', null, 'farida')).status, 403, 'but not a unit she is not named for');
    r = await T(micuNov, 'forward', '', 'farida');
    assert.equal(r.status, 200); assert.equal(r.body.roster.status, 'pending_cns'); assert.equal(r.body.roster.checkedBy, 'Farida Begum'); assert.equal(r.body.roster.checkedByUser, 'farida');
    assert.equal((await T(micuNov, 'forward', '', 'farida')).status, 409, 'cannot forward twice');
    assert.equal((await T(micuNov, 'approve', '', 'farida')).status, 403, 'a manager never approves');
    assert.equal((await T(micuNov, 'approve', '', 'rahima')).status, 403, 'nor does the in-charge');
    r = await T(micuNov, 'approve', '', 'nasrin');
    assert.equal(r.status, 200); assert.equal(r.body.roster.status, 'approved'); assert.equal(r.body.roster.approvedBy, 'Nasrin Sultana'); assert.ok(r.body.roster.approvedAt);
    assert.deepEqual(r.body.roster.history.map((h) => h.action), ['send_manager', 'forward', 'approve'], 'three history rows');
    assert.equal(r.body.roster.history[0].byName, 'Rahima Akter');
    assert.equal((await put({ dept: 'MICU', year: 2026, month: 10, grid: {}, baseRevision: 3 }, 'rahima')).body.locked, true, 'approved = locked');
    assert.equal((await T(micuNov, 'reopen', '', 'nasrin')).status, 403, 'the CNS cannot reopen');
    assert.equal((await sheetOf('MICU', 2026, 10, 'icu')).roster.status, 'approved', 'a unit editor reads the published sheet');
    assert.deepEqual(logged.filter((l) => /^roster_(sent|forwarded|approved)$/.test(l.action)).map((l) => l.action).slice(-3), ['roster_sent', 'roster_forwarded', 'roster_approved'], 'each hand-over is logged');

    // Versions: one snapshot per revision, the grid as it was when sent.
    let vs = (await call('GET', '/api/rosters/' + micuNov + '/versions', null, 'farida')).body.versions;
    assert.deepEqual(vs.map((v) => v.revision + ':' + v.action), ['3:approve', '2:send_manager'], 'the send (rev 2) and, after the admin save, the forward+approve (rev 3) share one snapshot per revision');
    assert.equal(vs[0].grid, undefined, 'the list carries no grid');
    const v2 = (await call('GET', '/api/rosters/' + micuNov + '/versions/2', null, 'rahima')).body.version;
    assert.equal(v2.grid.S1['2'], 'E4'); assert.equal(v2.status, 'pending_manager');
    assert.equal((await call('GET', '/api/rosters/' + micuNov + '/versions/9', null, 'rahima')).status, 404);
    assert.equal((await call('GET', '/api/rosters/' + micuNov + '/versions', null, 'noUnits')).status, 403, 'versions follow the sheet visibility');

    r = await T(micuNov, 'reopen', '', 'admin');
    assert.equal(r.status, 200); assert.equal(r.body.roster.status, 'draft'); assert.equal(r.body.roster.history.length, 4);

    // return -> edit resumes as draft -> resend straight to the CNS
    await T(micuNov, 'send_manager', '', 'rahima');
    r = await T(micuNov, 'return', 'Night cover on 14-16 is short.', 'farida');
    assert.equal(r.status, 200); assert.equal(r.body.roster.status, 'returned'); assert.equal(r.body.roster.returnStage, 'manager');
    assert.equal(r.body.roster.returnNote, 'Night cover on 14-16 is short.'); assert.equal(r.body.roster.returnedByName, 'Farida Begum');
    assert.equal((await T(micuNov, 'return', '', 'farida')).status, 409, 'cannot return a returned sheet');
    r = await put({ dept: 'MICU', year: 2026, month: 10, grid: { S1: { 1: 'M3', 14: 'N1' } }, baseRevision: 3 }, 'rahima');
    assert.equal(r.status, 200); assert.equal(r.body.roster.status, 'draft', 'editing a returned sheet makes it a draft again');
    assert.equal(r.body.roster.history.slice(-1)[0].action, 'resume');
    assert.equal(r.body.roster.returnNote, 'Night cover on 14-16 is short.', 'the note stays until it is resent');
    r = await T(micuNov, 'send_cns', '', 'rahima');
    assert.equal(r.status, 200); assert.equal(r.body.roster.status, 'pending_cns'); assert.equal(r.body.roster.returnNote, '', 'a resend clears the note (history keeps it)');
    assert.equal((await T(micuNov, 'forward', '', 'farida')).body.code, 'bad_state', 'the manager was skipped; nothing for her to forward');
    r = await T(micuNov, 'return', '', 'nasrin');
    assert.equal(r.status, 200); assert.equal(r.body.roster.returnStage, 'cns'); assert.equal(r.body.roster.returnNote, '', 'a note is optional');
    assert.ok(logged.filter((l) => l.action === 'roster_returned').length === 2);

    // The CNS cannot sign a sheet she sent herself; an administrator can.
    await put({ dept: 'CCU', year: 2026, month: 11, grid: { S9: { 1: 'M' } }, baseRevision: 0 }, 'dual');
    assert.equal((await T('ros-CCU-2026-11', 'send_cns', '', 'dual')).status, 200);
    r = await T('ros-CCU-2026-11', 'approve', '', 'dual');
    assert.equal(r.status, 403); assert.match(r.body.error, /yourself/);
    assert.equal((await T('ros-CCU-2026-11', 'approve', '', 'nasrin')).status, 200, 'another CNS may');

    // A legacy 'submitted' row: read as pending_cns, approvable, never rewritten by a read.
    assert.equal((await put({ dept: 'NICU', year: 2026, month: 10, grid: { S5: { 1: 'M' } }, status: 'submitted', baseRevision: 0 })).body.roster.status, 'pending_cns');
    const nicuLegacy = roster.__mem().find((x) => x.id === 'ros-NICU-2026-10'); nicuLegacy.status = 'submitted';   // what an old deployment stored
    let got = await sheetOf('NICU', 2026, 10, 'nasrin');
    assert.equal(got.roster.status, 'pending_cns'); assert.equal(got.roster.legacyStatus, 'submitted');
    assert.equal(nicuLegacy.status, 'submitted', 'reading did not rewrite the stored row');
    assert.equal((await T('ros-NICU-2026-10', 'approve', '', 'nasrin')).status, 200, 'the conditional write matches the legacy spelling');

    // The review inbox: every canonical unit, sheet or not, with what is waiting on ME.
    await put({ dept: 'MICU', year: 2026, month: 11, grid: { S1: { 1: 'M' } }, baseRevision: 0 }, 'rahima');
    await T('ros-MICU-2026-11', 'send_manager', '', 'rahima');
    assert.equal((await call('GET', '/api/rosters/review?year=2026&month=11', null, 'rahima')).status, 403, 'the inbox is for reviewers');
    let inbox = (await call('GET', '/api/rosters/review?year=2026&month=11', null, 'farida')).body;
    assert.deepEqual(inbox.rows.map((x) => x.dept), ['micu'], 'a manager sees only the units she is named for');
    assert.equal(inbox.rows[0].pendingForMe, true); assert.equal(inbox.rows[0].status, 'pending_manager'); assert.equal(inbox.rows[0].incharge.name, 'Rahima Akter'); assert.equal(inbox.rows[0].can.forward, true);
    inbox = (await call('GET', '/api/rosters/review?year=2026&month=11', null, 'nasrin')).body;
    assert.deepEqual(inbox.rows.map((x) => x.dept + ':' + (x.hasSheet ? x.status : 'none') + ':' + x.pendingForMe), ['ccu:approved:false', 'micu:pending_manager:false', 'nicu:none:false', 'manager:none:false', 'supervisor:none:false', 'trainee:none:false'], 'the CNS sees every unit, including the one with no sheet, and nothing waits on her yet');
    assert.equal(inbox.rows.find((x) => x.dept === 'nicu').sheetDept, 'NICU', 'a unit with no sheet still names where to open one');
    assert.equal(inbox.rows.find((x) => x.dept === 'ccu').approvedBy, 'Nasrin Sultana');
    let cnt = (await call('GET', '/api/rosters/review/count?year=2026&month=11', null, 'farida')).body;
    assert.deepEqual([cnt.pending, cnt.returned], [1, 0]);
    await T('ros-MICU-2026-11', 'forward', '', 'farida');
    cnt = (await call('GET', '/api/rosters/review/count?year=2026&month=11', null, 'nasrin')).body;
    assert.equal(cnt.pending, 1, 'now it waits on the CNS');
    assert.equal((await call('GET', '/api/rosters/review/count?year=2026&month=11', null, 'farida')).body.pending, 0);
    await T('ros-MICU-2026-11', 'return', 'see me', 'nasrin');
    cnt = (await call('GET', '/api/rosters/review/count?year=2026&month=11', null, 'rahima')).body;
    assert.deepEqual([cnt.pending, cnt.returned], [0, 1], 'the author is told a sheet came back');
    assert.equal((await call('GET', '/api/rosters', null, 'farida')).body.rosters.every((x) => x.dept === 'MICU'), true, 'the index follows the same reach');

    // Staff-wise history across months, within scope, published-only for a collector.
    let hist = (await call('GET', '/api/rosters/staff/1?from=2026-09&to=2026-12', null, 'rahima')).body;
    assert.deepEqual(hist.months.map((m) => m.year + '-' + m.month + ':' + m.status), ['2026-8:approved', '2026-10:returned', '2026-11:returned'], 'S1 appears in every MICU month in range (from/to are calendar months), oldest first');
    assert.equal(hist.months[1].cells['14'], 'N1');
    hist = (await call('GET', '/api/rosters/staff/S1?from=2026-11&to=2026-11', null, 'rahima')).body;
    assert.equal(hist.months.length, 1, 'the range is honoured, and S-prefixed ids work');
    assert.deepEqual((await call('GET', '/api/rosters/staff/1?from=2026-09&to=2026-12', null, 'incharge')).body.months.map((m) => m.status), ['approved'], 'a plain portal account sees its own ward published sheets only');
    assert.equal((await call('GET', '/api/rosters/staff/9?from=2026-09&to=2026-12', null, 'incharge')).body.months.length, 0, 'and nothing of another ward');
    assert.equal((await call('GET', '/api/rosters/staff/9?from=2026-09&to=2026-12', null, 'wardLead')).body.months.length, 4, 'the granted in-charge sees every CCU month, drafts included');
    assert.equal((await call('GET', '/api/rosters/staff/abc', null)).status, 400);

    // The legacy status route still works, mapped onto the chain, and ignores the caller's name.
    await T('ros-MICU-2026-11', 'send_cns', '', 'rahima');   // from returned, straight to the CNS
    r = await call('POST', '/api/rosters/' + encodeURIComponent('ros-MICU-2026-11') + '/status', { status: 'approved', approvedBy: 'Imposter' }, 'nasrin');
    assert.equal(r.status, 200); assert.equal(r.body.roster.approvedBy, 'Nasrin Sultana', 'the payload name is ignored');
    r = await call('POST', '/api/rosters/' + encodeURIComponent('ros-MICU-2026-11') + '/status', { status: 'draft' }, 'nasrin');
    assert.equal(r.status, 403, 'draft on an approved sheet is a reopen, administrator only');
    assert.equal((await call('POST', '/api/rosters/' + encodeURIComponent('ros-MICU-2026-11') + '/status', { status: 'draft' }, 'admin')).body.roster.status, 'draft');
    r = await call('POST', '/api/rosters/' + encodeURIComponent('ros-MICU-2026-11') + '/status', { status: 'approved' }, 'admin');
    assert.equal(r.body.roster.status, 'approved'); assert.deepEqual(r.body.roster.history.slice(-2).map((h) => h.action), ['send_cns', 'approve'], 'approving a draft through the old route sends then approves');

    // The In-charge named in Setup prepares that unit's roster without the Edit permission.
    assert.equal((await call('PUT', '/api/rosters', { dept: 'NICU', year: 2026, month: 9, grid: { S5: { 1: 'M4' } }, baseRevision: 0 }, 'shirin')).status, 403, 'not named yet: refused');
    assert.equal((await call('PUT', '/api/rosters/config', { depts: { nicu: { incharge: { username: 'shirin' } } } })).status, 200);
    let ic = await call('PUT', '/api/rosters', { dept: 'NICU', year: 2026, month: 9, grid: { S5: { 1: 'M4' } }, baseRevision: 0 }, 'shirin');
    assert.equal(ic.status, 200, 'named In-charge saves her unit: ' + JSON.stringify(ic.body));
    const icSheet = (await call('GET', '/api/rosters/NICU/2026/9', null, 'shirin')).body;
    assert.ok(icSheet.roster.can.edit && icSheet.roster.can.send && !icSheet.roster.can.approve, 'she may edit and send, never approve');
    assert.ok((await call('GET', '/api/rosters/scope', null, 'shirin')).body.units.indexOf('NICU') >= 0, 'her unit is in her roster scope');
    ic = await call('POST', '/api/rosters/' + encodeURIComponent('ros-NICU-2026-09') + '/transition', { action: 'send_manager' }, 'shirin');
    assert.equal(ic.status, 200, 'she sends it to the Manager');
    assert.equal((await call('PUT', '/api/rosters', { dept: 'MICU', year: 2026, month: 9, grid: {}, baseRevision: 0 }, 'shirin')).status, 403, 'another unit is still refused');

    // The Trainee Nurses unit: an instructor named its In-charge in Setup prepares it.
    assert.equal((await call('PUT', '/api/rosters/config', { depts: { trainee: { incharge: { username: 'shirin' } } } })).status, 200, 'the trainee unit takes an In-charge');
    ic = await call('PUT', '/api/rosters', { dept: 'Trainee Nurses', year: 2026, month: 9, grid: { S9: { 1: 'G1' } }, baseRevision: 0 }, 'shirin');
    assert.equal(ic.status, 200, 'the instructor saves the trainee roster: ' + JSON.stringify(ic.body));
    assert.equal((await call('GET', '/api/rosters/Trainee%20Nurses/2026/9', null, 'shirin')).body.signers.incharge.username, 'shirin', 'the trainee sheet resolves to its Setup entry');
    assert.equal(roster.rosterUnitOf({ role: 'Nurse', designation: 'Trainee Nurse', current_department: 'MICU' }), 'Trainee Nurses', 'a trainee is rostered on the trainee unit, not the ward');
    assert.equal(roster.rosterUnitOf({ role: 'Nurse', designation: 'Staff Nurse', current_department: 'MICU' }), 'MICU');
    assert.equal(roster.rosterUnitOf({ role: 'Nurse', designation: 'Assistant Nurse Manager', current_department: 'LDR' }), 'Nurse Managers', 'an assistant nurse manager is on the managers roster');
    assert.equal(roster.rosterUnitOf({ role: 'Nurse', designation: 'Nurse Manager ER , OT & CSSD', current_department: 'Management' }), 'Nurse Managers');
    assert.equal(roster.rosterUnitOf({ role: 'Nurse', designation: 'Senior Manager (Quality & Training)', current_department: 'Management' }), 'Management', 'a senior manager is not');

    // Nursing Supervisors: members picked in Setup, kept on the config, shown with names.
    assert.equal((await call('PUT', '/api/rosters/config', { supervisors: ['5'] }, 'icu')).status, 403, 'only an administrator picks supervisors');
    let sup = await call('PUT', '/api/rosters/config', { supervisors: ['5', '5', '9'] });
    assert.equal(sup.status, 200);
    assert.deepEqual((await call('GET', '/api/rosters/config')).body.supervisors.map((x) => x.id), sup.body.supervisors.map((x) => x.id), 'the members round-trip');
    await call('PUT', '/api/rosters/config', { depts: { micu: { manager: { username: 'farida' } } } });
    assert.ok(roster.getConfig && (await roster.getConfig()).supervisors.join(',') === '5,9', 'a Setup save that does not send the list keeps it (and de-duplicates)');
    const supSheet = (await call('GET', '/api/rosters/Nursing%20Supervisors/2026/9')).body;
    assert.deepEqual(supSheet.members, ['5', '9'], 'the supervisor sheet knows who is on it before it is saved');

    // SECURITY: an In-charge with full Duty Roster rights and the "all units" default sees only
    // the unit Setup gives her.
    assert.equal((await call('PUT', '/api/rosters/config', { depts: { trainee: { incharge: { username: 'chelcia' } } } })).status, 200);
    const chScope = (await call('GET', '/api/rosters/scope', null, 'chelcia')).body;
    assert.equal(chScope.scope, 'departments', 'she is bound to her units, not "all"');
    assert.deepEqual(chScope.units, ['Trainee Nurses'], 'her only unit is Trainee Nurses');
    assert.equal((await call('GET', '/api/rosters/MICU/2026/10', null, 'chelcia')).status, 403, 'MICU is closed to her');
    assert.equal((await call('PUT', '/api/rosters', { dept: 'MICU', year: 2026, month: 8, grid: {}, baseRevision: 0 }, 'chelcia')).status, 403, 'and she cannot write it');
    const chList = (await call('GET', '/api/rosters', null, 'chelcia')).body.rosters;
    assert.ok(chList.length > 0 && chList.every((r) => r.dept === 'Trainee Nurses'), 'the roster list holds only Trainee Nurses sheets: ' + chList.map((r) => r.dept).join(','));
    assert.equal((await call('PUT', '/api/rosters', { dept: 'Trainee Nurses', year: 2026, month: 8, grid: { S9: { 2: 'G1' } }, baseRevision: 0 }, 'chelcia')).status, 200, 'she prepares her own unit');
    assert.equal((await call('GET', '/api/rosters/review', null, 'chelcia')).status, 403, 'no review inbox for an In-charge');

    // One person as In-charge AND Manager of a unit: sending goes straight on to the CNS.
    assert.equal((await call('PUT', '/api/rosters/config', { depts: { trainee: { incharge: { username: 'chelcia' }, manager: { username: 'chelcia' } } } })).status, 200);
    let dual = await call('POST', '/api/rosters/' + encodeURIComponent('ros-Trainee Nurses-2026-08') + '/transition', { action: 'send_manager' }, 'chelcia');
    assert.equal(dual.status, 200, JSON.stringify(dual.body));
    assert.equal(dual.body.roster.status, 'pending_cns', 'the check was hers to give: straight to the CNS');
    assert.deepEqual(dual.body.roster.history.slice(-2).map((h) => h.action), ['send_manager', 'forward'], 'history shows both steps');
    assert.equal(dual.body.roster.checkedBy, 'Chelcia Bani Baroi', 'checked by her');
    // A Manager slot in Setup is a grant without the Manager role: Farida-like account with role '' would
    // still forward — covered by roster-workflow isMgr; here the inbox opens for a slot-only manager.
    assert.equal((await call('GET', '/api/rosters/review', null, 'chelcia')).status, 200, 'managing a unit opens the review inbox');

    // Guest staff: someone from another unit on this sheet — "move" takes them off home for that month.
    let g = await call('PUT', '/api/rosters', { dept: 'NICU', year: 2026, month: 6, grid: { S5: { 1: 'M4' } }, order: ['S5'], guests: { S5: { from: 'MICU', mode: 'move', name: 'Guest Five', desig: 'Staff Nurse' }, bad: { from: 'x' } }, baseRevision: 0 });
    assert.equal(g.status, 200, JSON.stringify(g.body));
    assert.deepEqual(Object.keys(g.body.roster.guests), ['S5'], 'guests are kept, malformed keys dropped');
    assert.equal(g.body.roster.guests.S5.mode, 'move');
    assert.deepEqual((await call('GET', '/api/rosters/MICU/2026/6')).body.movedOut, ['S5'], 'a moved guest is left off the home sheet that month');
    assert.deepEqual((await call('GET', '/api/rosters/MICU/2026/5')).body.movedOut, [], 'and only that month');
    assert.deepEqual((await call('GET', '/api/rosters/CCU/2026/6')).body.movedOut, [], 'and only their home unit');
    // On call + Alternative-leave details travel with the sheet — only where the cell still matches.
    let ex = await call('PUT', '/api/rosters', { dept: 'CCU', year: 2027, month: 4, grid: { S1: { 1: 'G1', 2: 'OC', 3: 'AL', 4: 'AL', 5: 'M4' } }, order: ['S1'],
      oncall: { S1: { 1: 1, 2: 1, 9: 1 } }, altLeave: { S1: { 3: { for: '2027-03-16', note: 'Holiday duty' }, 4: { for: 'nonsense' }, 5: { for: '2027-03-20' } } }, baseRevision: 0 });
    assert.equal(ex.status, 200, JSON.stringify(ex.body));
    assert.deepEqual(ex.body.roster.oncall, { S1: { 1: 1 } }, 'an on-call mark sits on a shift only (not on OC, not on an empty day)');
    assert.deepEqual(ex.body.roster.altLeave, { S1: { 3: { for: '2027-03-16', note: 'Holiday duty' } } }, 'AL details only on AL cells, with a real date or a reason');
    ex = await call('PUT', '/api/rosters', { dept: 'CCU', year: 2027, month: 4, grid: { S1: { 1: 'G1', 2: 'OC', 3: 'AL', 4: 'AL', 5: 'M4' } }, order: ['S1'], baseRevision: 1 });
    assert.equal(ex.body.roster.altLeave.S1[3].for, '2027-03-16', 'a save without the fields keeps them');
    assert.deepEqual(ex.body.roster.oncall, { S1: { 1: 1 } });
    ex = await call('PUT', '/api/rosters', { dept: 'CCU', year: 2027, month: 4, grid: { S1: { 1: 'OFF', 3: 'CL' } }, order: ['S1'], baseRevision: 2 });
    assert.deepEqual([ex.body.roster.oncall, ex.body.roster.altLeave], [{}, {}], 'changing the cells drops their extras');
    // Search for staff to add: administrators only; minimal fields.
    assert.equal((await call('GET', '/api/rosters/staff-search?q=ra', null, 'nasrin')).status, 403, 'the CNS prepares no roster: no search');
    assert.equal((await call('GET', '/api/rosters/staff-search?q=ra', null, 'rahima')).status, 403, 'an in-charge may not add staff from another unit');
    // …and an in-charge's save neither adds nor removes guests, whatever the request carries.
    let ig = await call('PUT', '/api/rosters', { dept: 'MICU', year: 2027, month: 2, grid: { S7: { 1: 'M4' } }, order: ['S7'], guests: { S7: { from: 'CCU', mode: 'both', name: 'Guest Seven' } }, baseRevision: 0 }, 'rahima');
    assert.equal(ig.status, 200, JSON.stringify(ig.body));
    assert.deepEqual(ig.body.roster.guests, {}, 'an in-charge cannot put a guest on the sheet');
    ig = await call('PUT', '/api/rosters', { dept: 'MICU', year: 2027, month: 3, grid: {}, order: [], guests: { S7: { from: 'CCU', mode: 'both', name: 'Guest Seven' } }, baseRevision: 0 });
    assert.deepEqual(Object.keys(ig.body.roster.guests), ['S7'], 'an administrator can');
    ig = await call('PUT', '/api/rosters', { dept: 'MICU', year: 2027, month: 3, grid: {}, order: [], guests: {}, baseRevision: 1 }, 'rahima');
    assert.equal(ig.status, 200, JSON.stringify(ig.body));
    assert.deepEqual(Object.keys(ig.body.roster.guests), ['S7'], 'and an in-charge save cannot take them off');
    const found = (await call('GET', '/api/rosters/staff-search?q=a', null, 'admin')).body;
    assert.ok(found.ok && Array.isArray(found.staff) && found.staff.length <= 20);
    found.staff.forEach((p) => assert.deepEqual(Object.keys(p).sort(), ['current_department', 'designation', 'emp_id', 'id', 'name', 'photo', 'role', 'unit'], 'only the fields needed to pick someone'));

    // The print log.
    assert.equal((await call('POST', '/api/rosters/print', { kind: 'staff', target: 'Rahima', detail: 'May-Nov 2026' }, 'rahima')).body.ok, true);
    assert.ok(logged.some((l) => l.action === 'roster_print' && l.opts.target === 'Rahima'));

    console.log('DUTY_ROSTER_CHAIN_PASS: setup, roles, send/forward/approve/return/resume/reopen, versions, legacy rows, inbox + badge, staff history, compat route');
    console.log('DUTY_ROSTER_TEST_PASS: approved lock, revision guard, kept note/status/names, no approve-by-save, per-unit roster assignment, in-charge build+submit without approve');
  } finally { server.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
