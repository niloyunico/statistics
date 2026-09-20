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
};
const app = express();
app.use(express.json());
const as = (req, res, next) => { req.access = USERS[req.headers['x-user'] || 'admin']; next(); };
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
    assert.equal(r.body.roster.status, 'submitted', 'status kept');
    assert.equal(r.body.roster.names.S2, 'Karim', 'a name no longer on the payload is kept on the sheet');

    // A browser still on revision 1 cannot erase revision 2.
    r = await put({ ...month, grid: { S1: { 1: 'N' } }, baseRevision: 1 });
    assert.equal(r.status, 409); assert.equal(r.body.conflict, true);
    assert.equal((await call('GET', '/api/rosters/MICU/2026/8')).body.roster.grid.S1['1'], 'E', 'the newer cells survive');

    // A save can never approve.
    r = await put({ ...month, grid: { S1: { 1: 'E' } }, status: 'approved', baseRevision: 2 });
    assert.equal(r.body.roster.status, 'submitted');

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
    assert.equal((await call('POST', '/api/rosters/' + ccuOct + '/status', { status: 'draft' }, 'wardLead')).status, 403, 'nor reopen one');
    let sub = await call('POST', '/api/rosters/' + ccuOct + '/status', { status: 'submitted' }, 'wardLead');
    assert.equal(sub.status, 200); assert.equal(sub.body.roster.status, 'submitted', 'submitted for approval');
    assert.equal((await call('POST', '/api/rosters/' + encodeURIComponent('ros-MICU-2026-10') + '/status', { status: 'submitted' }, 'wardLead')).status, 403, 'and only for their own unit');

    // Once an administrator publishes it, it is locked against them like everyone else.
    await call('POST', '/api/rosters/' + ccuOct + '/status', { status: 'approved' });
    assert.equal((await put({ dept: 'CCU', year: 2026, month: 10, grid: {} }, 'wardLead')).status, 409, 'an approved sheet is locked');
    assert.equal((await call('POST', '/api/rosters/' + ccuOct + '/status', { status: 'submitted' }, 'wardLead')).status, 409, 'and cannot be re-submitted');
    assert.equal((await call('GET', '/api/rosters/CCU/2026/10')).body.roster.grid.S9['1'], 'M3', 'the published cells survive');

    console.log('DUTY_ROSTER_TEST_PASS: approved lock, revision guard, kept note/status/names, no approve-by-save, per-unit roster assignment, in-charge build+submit without approve');
  } finally { server.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
