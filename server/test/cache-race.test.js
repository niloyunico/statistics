/* Regression tests for the concurrency bugs found reviewing the cache.
 *
 * Each block below corresponds to a defect that a plain "does it cache?" test cannot
 * catch, because every one of them needs a write and a read to be IN FLIGHT AT THE SAME
 * TIME. They are the bugs that show up in production as "I saved it and it went back",
 * so they are pinned here explicitly.
 *
 * Run: npm --prefix server run test:race
 */
const fake = require('./fake-redis');

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('  PASS  ' + name); } else { fail++; console.log('  FAIL  ' + name); } };
const eq = (name, a, b) => {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A === B) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + '\n        got      ' + A + '\n        expected ' + B); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const R = fake.create();
  const url = await R.listen();

  process.env.UPSTASH_REDIS_REST_URL = url;
  process.env.UPSTASH_REDIS_REST_TOKEN = 't';
  process.env.DB_NAME = 'unico_racetest';
  process.env.CACHE_TTL_MS = '60000';
  process.env.CACHE_LOCAL_MS = '2000';        // L1 ENABLED — several of these bugs live in it
  process.env.CACHE_LOCK_MS = '300';          // short lease, so expiry is testable
  process.env.CACHE_WAIT_MS = '1200';
  process.env.CACHE_REVALIDATE_MS = '0';      // keep background refresh out of these assertions

  const cache = require('../cache');
  const redis = require('../redis');

  // A fake Db whose writes go through the real invalidation Proxy.
  const makeDb = () => cache.instrument({
    collection: (name) => ({
      updateOne: async () => ({ acknowledged: true, modifiedCount: 1 }),
      bulkWrite: async () => { throw new Error('bulk write partially applied then failed'); },
    }),
  });

  console.log('\n== a write during an in-flight read is NOT masked by the local copy ==');
  // The loader reads Mongo, a write lands while it is still running, and the loader
  // then returns its PRE-write result. Stamping that result with the CURRENT local
  // version would make it a valid in-process cache hit, so the admin who just saved
  // would be shown their own edit undone for up to CACHE_LOCAL_MS.
  cache._reset();
  let served = 'v1';
  let loads = 0;
  const slowRead = () => cache.read('departments', { coll: 'departments' }, async () => {
    loads++;
    const snapshotAtReadTime = served;     // what the database held when this query ran
    await sleep(200);
    return snapshotAtReadTime;
  });
  const inFlight = slowRead();                       // starts reading "v1"
  await sleep(40);
  served = 'v2';                                     // Mongo now holds v2...
  await makeDb().collection('departments').updateOne({}, {});   // ...and the write bumps
  eq('the in-flight read still returns what it read', await inFlight, 'v1');
  eq('but the very next read goes back to the database', await slowRead(), 'v2');
  eq('it really re-queried (not an L1 hit)', loads, 2);

  console.log('\n== a waiter is not handed a copy built before the write it is waiting past ==');
  // Loser-of-the-lock path. A holder that started before the invalidating write stores
  // a pre-write snapshot, correctly stamped with the OLD version. Accepting it on
  // timestamp alone hands stale data to a caller that had already PROVEN it invalid.
  cache._reset();
  let holderValue = 'pre-write';
  let waiterLoads = 0;
  const holder = cache.read('quality', { coll: 'departments' }, async () => {
    const snapshotAtReadTime = holderValue;
    await sleep(250);
    return snapshotAtReadTime;
  });
  await sleep(30);
  await makeDb().collection('departments').updateOne({}, {});   // bump: version moves on
  holderValue = 'post-write';
  const waiter = cache.read('quality', { coll: 'departments' }, async () => {
    waiterLoads++; await sleep(20); return 'post-write';
  });
  const [h, w] = await Promise.all([holder, waiter]);
  eq('the holder returns its own (pre-write) read', h, 'pre-write');
  eq('the waiter does NOT accept it', w, 'post-write');
  ok('the waiter loaded for itself instead', waiterLoads === 1);

  console.log('\n== a slow holder does not delete a lock it no longer owns ==');
  // CACHE_LOCK_MS is 300ms here and the loader takes ~500ms, so the lease expires
  // mid-load. Releasing it anyway would evict whoever legitimately holds it next and
  // collapse single flight into a stampede — exactly when the cluster is slowest.
  cache._reset();
  R.store.clear();
  const lockKey = 'unico:unico_racetest:v1:e:slow:lock';
  const slow = cache.read('slow', { coll: 'slow' }, async () => { await sleep(500); return 'done'; });
  await sleep(380);                                  // the lease has now expired
  R.store.set(lockKey, { v: 'SOMEONE-ELSE', exp: Date.now() + 5000 });
  await slow;
  await sleep(30);
  eq("the next owner's lock survives", R.raw(lockKey), 'SOMEONE-ELSE');

  console.log('\n== an invalidation that never reached Redis is retried, not lost ==');
  // While Redis is unreachable a bump lands in the in-process stand-in and LOOKS
  // successful, so every other instance keeps serving pre-write data and nothing
  // notices. It must be remembered and replayed.
  cache._reset();
  R.store.clear();
  await cache.read('staff', { coll: 'staff' }, async () => 'roster-v1');   // seed + version
  const verKey = 'unico:unico_racetest:v1:ver:staff';
  const before = parseInt(R.raw(verKey) || '0', 10);

  // The read above releases its lock WITHOUT awaiting it (deliberately — a released
  // lock is bookkeeping and the caller already has their answer), so let that trailing
  // request land before inducing a failure, or it swallows the one we aimed at the bump.
  await sleep(50);
  R.failFor(1);                                      // ONE failed request: the bump's INCR
  await makeDb().collection('staff').updateOne({}, {});
  ok('the lost bump was recorded', cache.snapshot().pendingBumps >= 1);
  ok('and counted', cache.snapshot().lostBumps >= 1);

  // Redis comes back; the next lookup replays it in the same pipeline, for free.
  await sleep(10);
  await cache.read('staff', { coll: 'staff' }, async () => 'roster-v2');
  const after = parseInt(R.raw(verKey) || '0', 10);
  ok('the version advanced once Redis returned', after > before);
  eq('and nothing is left pending', cache.snapshot().pendingBumps, 0);

  console.log('\n== a write that fails PART WAY still invalidates ==');
  // bulkWrite / insertMany can apply some documents and then reject. Bumping only on
  // success would leave the database changed and every cached copy still "current".
  cache._reset();
  const bumpsBefore = cache.snapshot().bumps;
  try { await makeDb().collection('departments').bulkWrite([]); } catch (e) { /* expected */ }
  ok('the rejection still reached the caller', true);
  ok('and the collection was invalidated anyway', cache.snapshot().bumps > bumpsBefore);

  console.log('\n== noRescue: a write baseline is never served from an outage copy ==');
  // Merging somebody's save against a copy read during an outage is how an edit turns
  // into a silent no-op. A visible failure is the correct answer.
  cache._reset();
  R.store.clear();
  await cache.read('appdata', { coll: 'appdata', freshMs: 5000 }, async () => ({ data: { a: '1' } }));
  const boom = async () => { throw new Error('server selection timed out'); };

  const rescued = await cache.read('appdata', { coll: 'appdata', fresh: true }, boom);
  eq('an ordinary read is still rescued', rescued, { data: { a: '1' } });

  let refused = null;
  try { await cache.read('appdata', { coll: 'appdata', fresh: true, noRescue: true }, boom); }
  catch (e) { refused = e; }
  ok('but a noRescue read fails loudly', refused && /server selection/.test(refused.message));

  console.log('\n== compression keeps a large dataset cacheable ==');
  cache._reset();
  redis._resetMemory();                              // clear any mute left by the section above
  R.store.clear();
  const big = Array.from({ length: 4000 }, (_, i) => ({ id: i, name: 'Indicator ' + i, unit: 'percentage' }));
  const out = await cache.read('bigset', { coll: 'bigset' }, async () => big);
  eq('the value round-trips intact', out.length, 4000);
  const stored = R.raw('unico:unico_racetest:v1:e:bigset');
  ok('it was stored compressed', typeof stored === 'string' && stored.slice(0, 2) === 'z:');
  ok('and much smaller than the JSON', stored.length < JSON.stringify(big).length / 3);
  const readBack = await cache.read('bigset', { coll: 'bigset' }, async () => { throw new Error('should not reload'); });
  eq('and decompresses to exactly the same data', readBack.length, 4000);
  eq('...including the last element', readBack[3999].name, 'Indicator 3999');

  console.log('\n== with NO Redis at all, the in-process store must still work ==');
  // The PC server and every maintenance script run with no Redis configured, so the
  // in-process stand-in is the ONLY store — which means a lock taken there must also be
  // RELEASED there. Treating "did not reach Redis" as "not mine to release" strands the
  // lock for its whole lease; the next read loses it, waits the wait out, and serves a
  // superseded copy. That is a silent wrong-data bug, and no test that configures Redis
  // can see it.
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  cache._reset();
  redis._resetMemory();
  ok('the memory driver is in use', !redis.configured());

  let rowValue = 'row-v1';
  const readIt = () => cache.read('nodedb', { coll: 'nodedb', freshMs: 5000 }, async () => rowValue);
  eq('first read', await readIt(), 'row-v1');
  rowValue = 'row-v2';
  await makeDb().collection('nodedb').updateOne({}, {});
  eq('a write is visible on the very next read', await readIt(), 'row-v2');
  rowValue = 'row-v3';
  await makeDb().collection('nodedb').updateOne({}, {});
  eq('and on the one after that', await readIt(), 'row-v3');
  eq('nothing was recorded as a lost invalidation', cache.snapshot().lostBumps, 0);
  eq('and nothing is pending retry', cache.snapshot().pendingBumps, 0);

  await R.close();
  console.log('\n' + (fail ? 'FAILED: ' + fail + ' of ' + (pass + fail) : 'ALL ' + pass + ' PASSED'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('\ncache-race.test crashed: ' + (e && e.stack || e)); process.exit(1); });
