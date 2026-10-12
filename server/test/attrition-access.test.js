/* Attrition & Exits as its own permission (server/staff-performance.js mountAttrition,
   server/access.js can()).

   - Reading the register needs Attrition (view); a Performance-only account no longer sees exits.
   - Filing an exit needs Attrition (add) OR Staff Management (edit): discontinuing a person on
     their staff record files their exit, and a staff editor used to be refused half-way.
   - Removing an exit needs Attrition (delete).
   - An account whose access was saved before the module existed (no 'attrition' key) keeps
     what Performance gave it; an explicit setting stands on its own.

   Run: node server/test/attrition-access.test.js */
delete process.env.MONGODB_URI;
const assert = require('node:assert/strict');
const access = require('../access');
const perfMod = require('../staff-performance');

const routes = [];
const app = { get: (p, ...h) => routes.push({ m: 'GET', p, h }), post: (p, ...h) => routes.push({ m: 'POST', p, h }),
  put: (p, ...h) => routes.push({ m: 'PUT', p, h }), delete: (p, ...h) => routes.push({ m: 'DELETE', p, h }) };
perfMod.mount(app, {});
perfMod.mountAttrition(app, { roster: async () => [] });
const call = (method, path, who, body, params) => new Promise((resolve, reject) => {
  const r = routes.find((x) => x.m === method && x.p === path);
  if (!r) return reject(new Error('no route ' + method + ' ' + path));
  const req = { method, body: body || {}, params: params || {}, user: { name: 'T' }, access: who };
  const res = { _c: 200, status(c) { this._c = c; return this; }, json(v) { resolve({ code: this._c, body: v }); }, set() { return this; } };
  const chain = r.h.slice(); const next = () => { const h = chain.shift(); Promise.resolve(h(req, res, next)).catch(reject); }; next();
});
const user = (perms) => ({ unrestricted: false, role: 'User', username: 'u', perms });

(async () => {
  // the inheritance rule
  assert.equal(access.can(user({ perf: ['view', 'add'] }), 'attrition', 'add'), true, 'an older account keeps Performance\'s grant for attrition');
  assert.equal(access.can(user({ perf: ['view', 'add'], attrition: [] }), 'attrition', 'view'), false, 'an explicit "none" stands on its own');
  assert.equal(access.can(user({ attrition: ['view'] }), 'attrition', 'view'), true, 'attrition can be granted without Performance');
  assert.equal(access.can(user({ attrition: ['view'] }), 'perf', 'view'), false, '...and does not open Performance');

  const admin = { unrestricted: true };
  const staffEditor = user({ staff: ['view', 'edit'], attrition: [] });
  const staffViewer = user({ staff: ['view'], attrition: [] });
  const attrViewer = user({ attrition: ['view'] });
  const perfOnly = user({ perf: ['view', 'edit', 'add'], attrition: [] });

  let r = await call('POST', '/api/attrition/exits', staffEditor, { empId: '11111', staffId: '41', staffName: 'Discontinued Nurse', lastDay: '2026-10-01', separation: 'Resignation', reason: 'Relocation' });
  assert.equal(r.body.ok, true, 'a Staff editor can file the exit of a person they discontinue: ' + JSON.stringify(r.body));
  r = await call('POST', '/api/attrition/exits', staffViewer, { empId: '22222', staffName: 'X', lastDay: '2026-10-01' });
  assert.equal(r.code, 403, 'a Staff viewer cannot');
  r = await call('POST', '/api/attrition/exits', perfOnly, { empId: '22222', staffName: 'X', lastDay: '2026-10-01' });
  assert.equal(r.code, 403, 'nor can Performance alone once Attrition is set separately');

  r = await call('GET', '/api/attrition', attrViewer);
  assert.equal(r.body.ok, true); assert.ok(r.body.exits.some((x) => x.staffName === 'Discontinued Nurse'), 'an Attrition viewer reads the register');
  r = await call('GET', '/api/attrition', staffEditor);
  assert.equal(r.code, 403, 'filing an exit does not open the register to read');
  r = await call('GET', '/api/performance', perfOnly);
  assert.deepEqual(r.body.exits, [], 'a Performance-only account no longer receives the exit register');
  r = await call('GET', '/api/performance', admin);
  assert.ok(r.body.exits.length >= 1, 'an administrator still does');

  const id = (await call('GET', '/api/attrition', admin)).body.exits[0].id;
  r = await call('DELETE', '/api/attrition/exits/:id', attrViewer, null, { id });
  assert.equal(r.code, 403, 'removing needs Attrition delete');
  r = await call('DELETE', '/api/attrition/exits/:id', user({ attrition: ['view', 'delete'] }), null, { id });
  assert.equal(r.body.ok, true, 'and works with it');

  console.log('ATTRITION_ACCESS_TEST_PASS: own permission, staff editors file exits on discontinue, older accounts inherit');
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
