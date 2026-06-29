/* Backend self-test (no real database needed — uses the in-memory dev store).
   Run: npm test   (exit 0 = pass) */
process.env.MONGODB_URI = '';            // force in-memory store
process.env.SEED_ADMIN_USER = 'admin';
process.env.SEED_ADMIN_PASSWORD = 'test-pass-123';
process.env.JWT_SECRET = 'test-secret-please-change';
process.env.PORT = '4099';

const assert = require('assert');
const auth = require('../auth');

(async () => {
  // unit: hashing + token round-trip
  const h = await auth.hash('secret');
  assert(await auth.verify('secret', h), 'verify accepts correct password');
  assert(!(await auth.verify('wrong', h)), 'verify rejects wrong password');
  const tok = auth.sign({ username: 'x', role: 'Administrator', name: 'X' });
  const claims = auth.check(tok);
  assert(claims && claims.sub === 'x' && claims.role === 'Administrator', 'token round-trips');
  assert(!auth.check('not-a-token'), 'bad token rejected');

  // integration: run the real express app against the in-memory store
  const app = require('../index');
  const srv = app.listen(4099, async () => {
    let pass = false;
    try {
      const base = 'http://127.0.0.1:4099';
      const health = await (await fetch(base + '/api/health')).json();
      const badRes = await fetch(base + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'nope' }) });
      const good = await (await fetch(base + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'test-pass-123' }) })).json();
      const me = await (await fetch(base + '/api/me', { headers: { authorization: 'Bearer ' + (good.token || '') } })).json();

      // data sync endpoints
      const dataNoAuth = await fetch(base + '/api/data'); // must be 401
      const auth = { 'content-type': 'application/json', authorization: 'Bearer ' + good.token };
      const putRes = await (await fetch(base + '/api/data', { method: 'PUT', headers: auth, body: JSON.stringify({ data: { unico_store_v3: '{"hello":1}', unico_staff_v3: '[]' } }) })).json();
      const getRes = await (await fetch(base + '/api/data', { headers: { authorization: 'Bearer ' + good.token } })).json();

      pass = health.ok === true && health.db === 'in-memory (dev)' &&
        badRes.status === 401 &&
        good.ok === true && !!good.token && good.user.username === 'admin' && good.user.role === 'Administrator' &&
        me.ok === true && me.user.username === 'admin' &&
        dataNoAuth.status === 401 && putRes.ok === true &&
        getRes.ok === true && getRes.data && getRes.data.unico_store_v3 === '{"hello":1}';

      console.log('HEALTH ' + JSON.stringify(health));
      console.log('BAD_LOGIN_STATUS ' + badRes.status);
      console.log('GOOD_LOGIN ' + JSON.stringify({ ok: good.ok, hasToken: !!good.token, user: good.user }));
      console.log('ME ' + JSON.stringify(me));
      console.log('DATA ' + JSON.stringify({ noAuthStatus: dataNoAuth.status, put: putRes.ok, getKeys: getRes.data ? Object.keys(getRes.data) : null }));
      console.log('AUTH_TEST_PASS ' + pass);
    } catch (e) { console.error('ERROR', e); }
    srv.close();
    process.exit(pass ? 0 : 1);
  });
})();
