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

    console.log('DUTY_ROSTER_TEST_PASS: approved lock, revision guard, kept note/status/names, no approve-by-save, department scoping');
  } finally { server.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
