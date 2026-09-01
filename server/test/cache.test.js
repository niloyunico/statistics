/* Warmup-protection self-test — the cache, the circuit breaker and the shared
   login throttle.

   Needs NO MongoDB and NO Redis account. It starts a tiny local HTTP server that
   speaks the Upstash REST protocol, so redis.js is exercised over the real wire
   format (single command AND pipeline), not just through its in-memory stand-in.

   Run: npm --prefix server run test:cache
*/
const http = require('http');

/* ---- a fake Upstash-compatible REST endpoint --------------------------------- */
const store = new Map();          // key -> { v, exp }
let commandCount = 0;

function get(k) {
  const e = store.get(k);
  if (!e) return null;
  if (e.exp && e.exp <= Date.now()) { store.delete(k); return null; }
  return e.v;
}
function exec(args) {
  commandCount++;
  const op = String(args[0] || '').toUpperCase();
  switch (op) {
    case 'GET': return get(args[1]);
    case 'DEL': return store.delete(args[1]) ? 1 : 0;
    case 'INCR': {
      const n = (parseInt(get(args[1]) || '0', 10) || 0) + 1;
      const e = store.get(args[1]);
      store.set(args[1], { v: String(n), exp: e && e.exp });
      return n;
    }
    case 'SET': {
      let px = 0, nx = false;
      for (let i = 3; i < args.length; i++) {
        const o = String(args[i]).toUpperCase();
        if (o === 'PX') px = parseInt(args[++i], 10) || 0;
        else if (o === 'NX') nx = true;
      }
      if (nx && get(args[1]) != null) return null;
      store.set(args[1], { v: String(args[2]), exp: px ? Date.now() + px : 0 });
      return 'OK';
    }
    default: return null;
  }
}
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let payload;
    try { payload = JSON.parse(body || '[]'); } catch (e) { payload = []; }
    const out = req.url === '/pipeline'
      ? payload.map((c) => ({ result: exec(c) }))
      : { result: exec(payload) };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(out));
  });
});

/* ---- harness ----------------------------------------------------------------- */
let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('  PASS  ' + name); } else { fail++; console.log('  FAIL  ' + name); } };
const eq = (name, a, b) => {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A === B) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + '\n        got      ' + A + '\n        expected ' + B); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + server.address().port;

  // Point every module at the fake endpoint BEFORE requiring them: the tunables are
  // read at module load. Isolated namespace so nothing here can touch live keys.
  process.env.UPSTASH_REDIS_REST_URL = url;
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  process.env.DB_NAME = 'unico_cachetest';
  process.env.CACHE_TTL_MS = '60000';
  process.env.CACHE_LOCAL_MS = '0';          // exercise the SHARED layer, not the L1 copy
  process.env.DB_CIRCUIT_PROBE_MS = '60';    // so the probe path is testable in-process
  process.env.DB_CIRCUIT_COOLDOWN_MS = '300';// short cooldown: recovery observable in-process
  process.env.DB_CIRCUIT_DEBOUNCE_MS = '20'; // distinct failure EVENTS are 20ms apart here
  process.env.LOGIN_MAX_FAILS = '3';

  const redis = require('../redis');
  const cache = require('../cache');
  const warmup = require('../warmup');
  const throttle = require('../login-throttle');

  console.log('\n== the REST driver speaks the real wire format ==');
  ok('a real endpoint is configured', redis.configured() && redis.live());
  eq('SET/GET round trip', await redis.set('k', 'v1').then(() => redis.get('k')), 'v1');
  eq('SET NX refuses an existing key', await redis.set('k', 'v2', { nx: true }), null);
  eq('...and left the value alone', await redis.get('k'), 'v1');
  eq('INCR from nothing', await redis.incr('n'), 1);
  eq('one pipeline, several answers', await redis.pipeline([['GET', 'k'], ['GET', 'n'], ['GET', 'missing']]), ['v1', '1', null]);
  eq('DEL', await redis.del('k'), 1);
  const px = await redis.set('t', 'x', { px: 40 }).then(() => redis.get('t'));
  await sleep(70);
  ok('PX expiry is honoured', px === 'x' && (await redis.get('t')) === null);

  console.log('\n== a cached dataset is read once, not once per request ==');
  let loads = 0;
  const loader = async () => { loads++; return { rows: ['a', 'b'], n: loads }; };
  const readDepts = (opts) => cache.read('departments', Object.assign({ coll: 'departments' }, opts), loader);
  eq('first read loads', (await readDepts()).n, 1);
  eq('second read is served from the cache', (await readDepts()).n, 1);
  eq('third read too', (await readDepts()).n, 1);
  eq('the database was consulted exactly once', loads, 1);

  console.log('\n== a write invalidates it automatically, wherever it came from ==');
  // No module tells the cache anything. instrument() wraps the Db handle, so ANY
  // write through it — including from code written long after this file — bumps the
  // version of the collection it touched.
  let wrote = null;
  const fakeDb = {
    collection: (name) => ({
      updateOne: async (f, u) => { wrote = { name, f, u }; return { acknowledged: true, modifiedCount: 1 }; },
      find: () => ({ toArray: async () => [] }),
    }),
  };
  const db = cache.instrument(fakeDb);
  const r = await db.collection('departments').updateOne({ _id: 'x' }, { $set: { a: 1 } });
  ok('the write itself still returns the driver result', r && r.modifiedCount === 1);
  ok('the write actually reached the collection', wrote && wrote.name === 'departments');
  eq('the next read goes back to the database', (await readDepts()).n, 2);
  eq('and is cached again afterwards', (await readDepts()).n, 2);

  console.log('\n== an untouched collection is NOT invalidated ==');
  let staffLoads = 0;
  const readStaff = () => cache.read('staff', { coll: 'staff' }, async () => { staffLoads++; return [staffLoads]; });
  await readStaff();
  await db.collection('departments').updateOne({ _id: 'y' }, { $set: { b: 2 } });
  await readStaff();
  eq('a departments write left the staff cache alone', staffLoads, 1);

  console.log('\n== twenty visitors at once produce ONE database query ==');
  // The stampede this prevents is the whole reason a shared cache is worth having on
  // a free-tier cluster: twenty cold serverless instances would otherwise open twenty
  // pools and run the same query twenty times, at the worst possible moment.
  let slowLoads = 0;
  const slow = async () => { slowLoads++; await sleep(150); return { at: slowLoads }; };
  const many = await Promise.all(Array.from({ length: 20 }, () => cache.read('burst', { coll: 'burst' }, slow)));
  eq('the database was queried once', slowLoads, 1);
  ok('all twenty callers got an answer', many.length === 20 && many.every((m) => m && m.at === 1));

  console.log('\n== the warmup guarantee: a broken database serves the last good copy ==');
  const before = cache.snapshot().rescues;
  const boom = async () => { throw new Error('server selection timed out'); };
  const rescued = await cache.read('departments', { coll: 'departments', fresh: true }, boom);
  eq('the previous copy was served instead of an error', rescued.n, 2);
  eq('and it was counted as a rescue', cache.snapshot().rescues, before + 1);

  console.log('\n== but a failure with nothing cached is still a failure ==');
  let threw = null;
  try { await cache.read('never-seen', { coll: 'never-seen' }, boom); } catch (e) { threw = e; }
  ok('the error is not swallowed', threw && /server selection/.test(threw.message));

  console.log('\n== the circuit breaker: cold cluster fails fast, not slowly ==');
  warmup._reset();
  const netErr = () => { const e = new Error('connection timed out'); e.name = 'MongoNetworkTimeoutError'; return e; };
  const failOnce = async () => { try { await warmup.guard(async () => { throw netErr(); }); } catch (e) { /* expected */ } };
  for (let i = 0; i < 3; i++) { await failOnce(); await sleep(30); }   // three DISTINCT events
  ok('three connectivity failures open the circuit', warmup.isOpen());
  let calls = 0, err = null;
  try { await warmup.guard(async () => { calls++; return 1; }); } catch (e) { err = e; }
  ok('a read is refused instantly', warmup.isCircuitError(err));
  eq('...without touching the database at all', calls, 0);

  console.log('\n== ...but ONE blip seen by many callers is one failure, not many ==');
  // The page shell fires several reads at once and they all await the SAME connect, so
  // a single DNS hiccup rejects every one of them. Counting each rejection separately
  // opens the circuit on the first blip — and a cold instance that then inherits the
  // shared outage flag renders the app completely empty, with no error anywhere.
  warmup._reset();
  await Promise.all(Array.from({ length: 8 }, () => failOnce()));
  eq('eight simultaneous rejections counted as one event', warmup.status().fails, 1);
  ok('so the circuit stayed closed', !warmup.isOpen());

  console.log('\n== ...but a save is never refused because of it ==');
  warmup._reset();
  for (let i = 0; i < 3; i++) { await failOnce(); await sleep(30); }
  ok('the circuit is open', warmup.isOpen());
  const saved = await warmup.guard(async () => 'stored', { shortCircuit: false });
  eq('the write went through while the circuit was open', saved, 'stored');

  console.log('\n== the errors a saturated free-tier cluster ACTUALLY produces ==');
  // Getting this list wrong in either direction is worse than having no breaker.
  const named = (n, m) => { const e = new Error(m || 'x'); e.name = n; return e; };
  ok('pool checkout timeout counts (this is what waitQueueTimeoutMS raises)',
    warmup.isConnectivityError(named('MongoWaitQueueTimeoutError', 'Timed out while checking out a connection from connection pool')));
  ok('a cluster going to sleep counts (note: no "Mongo" prefix)',
    warmup.isConnectivityError(named('PoolClearedOnNetworkError', 'Connection to x interrupted due to server monitor timeout')));
  ok('server selection counts', warmup.isConnectivityError(named('MongoServerSelectionError', 'server selection timed out')));
  ok('a duplicate key does NOT', !warmup.isConnectivityError(named('MongoServerError', 'E11000 duplicate key error')));
  ok('a bad password does NOT (the cluster answered - it just said no)',
    !warmup.isConnectivityError(named('MongoServerError', 'Authentication failed.')));
  ok('our own shutdown does NOT tell the fleet the database is dead',
    !warmup.isConnectivityError(named('MongoTopologyClosedError', 'Topology is closed')));

  console.log('\n== ordinary errors must not trip it ==');
  warmup._reset();
  for (let i = 0; i < 5; i++) {
    try { await warmup.guard(async () => { throw new Error('E11000 duplicate key error'); }); } catch (e) { /* expected */ }
    await sleep(25);
  }
  ok('a duplicate-key rejection is not an outage', !warmup.isOpen());

  console.log('\n== and it heals itself, one probe at a time ==');
  warmup._reset();
  for (let i = 0; i < 3; i++) { await failOnce(); await sleep(30); }
  ok('open', warmup.isOpen());
  // Nothing touches the database until the cooldown has fully elapsed — a breaker that
  // keeps probing THROUGH its own cooldown is not really open.
  let duringCooldown = 0;
  try { await warmup.guard(async () => { duringCooldown++; return 1; }); } catch (e) { /* expected */ }
  eq('no probe escapes during the cooldown', duringCooldown, 0);
  await sleep(340);                                  // DB_CIRCUIT_COOLDOWN_MS = 300

  // The cooldown expiring must NOT open the gates to everybody: that reproduces the
  // stampede the breaker exists to prevent, on a timer, against a cluster that is by
  // definition still sick. Exactly one caller may test the water.
  let admitted = 0;
  const attempts = await Promise.all(Array.from({ length: 6 }, () =>
    warmup.guard(async () => { admitted++; await sleep(20); return 'alive'; }).catch((e) => e)));
  eq('exactly one probe was let through', admitted, 1);
  eq('the other five were still refused', attempts.filter((a) => warmup.isCircuitError(a)).length, 5);
  ok('a successful probe closes the circuit', !warmup.isOpen());
  eq('and normal service resumes', await warmup.guard(async () => 'alive'), 'alive');

  console.log('\n== the login throttle is shared, not per-instance ==');
  const key = '203.0.113.9|admin';
  await throttle.clear(key);
  eq('a fresh key is not blocked', await throttle.blockedFor(key), 0);
  await throttle.noteFail(key);
  await throttle.noteFail(key);
  eq('below the limit, still allowed', await throttle.blockedFor(key), 0);
  await throttle.noteFail(key);                      // LOGIN_MAX_FAILS = 3
  ok('the limit locks the account out', (await throttle.blockedFor(key)) > 0);
  // The lock lives in the shared store, so an instance that has never seen this key
  // — which on Vercel is most of them — still refuses the attempt.
  const lockKey = 'unico:unico_cachetest:login:x:' + key;
  ok('the lockout was written to the shared store', get(lockKey) != null);
  await throttle.clear(key);
  eq('a successful login clears it', await throttle.blockedFor(key), 0);
  ok('and clears it in the shared store too', get(lockKey) == null);

  console.log('\n== Redis going down must not take the app with it ==');
  const reachedDb = [];
  await new Promise((r) => server.close(r));         // the endpoint disappears mid-flight
  const survived = await cache.read('after-outage', { coll: 'after-outage' }, async () => { reachedDb.push(1); return 'from-mongo'; });
  eq('the read still succeeded, straight from the database', survived, 'from-mongo');
  eq('the loader really ran', reachedDb.length, 1);
  // Pin the REAL behaviour when the shared counter cannot be reached: it fails OPEN.
  // A key locked in Redis stops being refused once Redis is unreachable. That is a
  // deliberate trade (a Redis outage must not lock the whole hospital out) and the
  // per-instance counter still applies. The earlier version of this assertion used a
  // key that had never been locked, so it could not have failed either way.
  await throttle.noteFail(key); await throttle.noteFail(key); await throttle.noteFail(key);
  ok('with the shared store gone, the LOCAL count still governs', (await throttle.blockedFor(key)) > 0);
  eq('and an unrelated user is unaffected', await throttle.blockedFor('someone-else|x'), 0);

  console.log('\n' + (fail ? 'FAILED: ' + fail + ' of ' + (pass + fail) : 'ALL ' + pass + ' PASSED')
    + '   (' + commandCount + ' redis commands served)');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('\ncache.test crashed: ' + (e && e.stack || e)); process.exit(1); });
