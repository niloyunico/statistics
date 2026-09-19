/* Self-test for the read cache WITHOUT Redis — cache-mongo.js, cache.js 'mongo' mode.

   Values live in each server process; per-collection version counters live in ONE
   shared MongoDB document. This needs no database: a fake store stands in for that
   document, and a freshly loaded copy of cache.js plays another server instance sharing
   it. The property that matters most is cross-instance: a save made through one
   instance must stop every other instance from serving its old copy.

   Run: node server/test/cache-mongo.test.js
*/
['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN',
  'REDIS_REST_URL', 'REDIS_REST_TOKEN', 'CACHE_DISABLED', 'VERCEL', 'CACHE_LOCAL_MS', 'CACHE_APPDATA_MS',
  'CACHE_VERSION_CHECK_MS'].forEach((k) => { delete process.env[k]; });
process.env.CACHE_TTL_MS = '60000';
process.env.CACHE_REVALIDATE_MS = '0';        // keep background refresh out of these assertions
process.env.CACHE_BUMP_TIMEOUT_MS = '300';

const path = require('path');
const SERVER = path.join(__dirname, '..');

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('  PASS  ' + name); } else { fail++; console.log('  FAIL  ' + name); } };
const eq = (name, a, b) => {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A === B) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + '\n        got      ' + A + '\n        expected ' + B); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A fresh copy of the cache modules = another server instance with its own memory.
// `env` applies only while the copy loads (the tunables are read at module load).
function instance(env) {
  const saved = {};
  Object.entries(env || {}).forEach(([k, v]) => { saved[k] = process.env[k]; if (v == null) delete process.env[k]; else process.env[k] = v; });
  ['cache.js', 'cache-mongo.js', 'redis.js'].forEach((f) => { delete require.cache[require.resolve(path.join(SERVER, f))]; });
  const mod = require(path.join(SERVER, 'cache.js'));
  Object.entries(saved).forEach(([k, v]) => { if (v === undefined) delete process.env[k]; else process.env[k] = v; });
  return mod;
}

// The `cacheMeta` versions document, shared by every instance.
function fakeStore() {
  const doc = { _id: 'versions' };
  const s = {
    doc, reads: 0, incrs: 0, failRead: 0, failIncr: 0, readDelay: 0,
    async read() {
      s.reads++;
      const snap = Object.assign({}, doc);       // what the document held when the query ran
      if (s.readDelay) await sleep(s.readDelay);
      if (s.failRead > 0) { s.failRead--; throw new Error('server selection timed out'); }
      return snap;
    },
    async incr(colls) {
      s.incrs++;
      if (s.failIncr > 0) { s.failIncr--; throw new Error('connection reset'); }
      colls.forEach((c) => { doc[c] = (doc[c] || 0) + 1; });
      return Object.assign({}, doc);
    },
  };
  return s;
}

// A Db whose writes go through the real invalidation proxy of that instance.
const dbOf = (cache) => cache.instrument({
  collection: () => ({ updateOne: async () => ({ acknowledged: true, modifiedCount: 1 }) }),
});

(async () => {
  console.log('\n== which cache runs ==');
  const store = fakeStore();
  const A = instance();
  eq('no Redis and no version store: memory mode', A.mode(), 'memory');
  A.useVersionStore(store);
  eq('with the MongoDB version store: mongo mode', A.mode(), 'mongo');
  const off = instance({ CACHE_DISABLED: 'true' });
  off.useVersionStore(store);
  eq('CACHE_DISABLED=true is still the kill switch', off.mode(), 'off');
  process.env.VERCEL = '1';
  eq('on Vercel with no shared store at all: off', instance().mode(), 'off');
  const onVercel = instance();
  onVercel.useVersionStore(store);
  eq('on Vercel with the version store: mongo', onVercel.mode(), 'mongo');
  delete process.env.VERCEL;

  console.log('\n== a dataset is loaded once, then served from memory ==');
  let depts = 'd1', deptLoads = 0;
  const readDepts = (c, opts) => c.read('departments', Object.assign({ coll: 'departments' }, opts), async () => { deptLoads++; return depts; });
  eq('first read loads', await readDepts(A), 'd1');
  eq('second read is served from memory', await readDepts(A), 'd1');
  eq('the database was read once', deptLoads, 1);
  ok('each lookup checked the tiny version document instead', store.reads >= 2);

  console.log('\n== a save on one instance invalidates the other ==');
  const B = instance();
  B.useVersionStore(store);
  eq('instance B loads its own copy', await readDepts(B), 'd1');
  eq('and serves it from memory after that', await readDepts(B), 'd1');
  const loadsBeforeSave = deptLoads;
  depts = 'd2';
  await dbOf(A).collection('departments').updateOne({ _id: 'er' }, { $set: { name: 'x' } });
  eq('the save moved the shared counter', store.doc.departments, 1);
  eq('instance B reloads on its very next read', await readDepts(B), 'd2');
  eq('instance A reloads too', await readDepts(A), 'd2');
  eq('exactly one reload each', deptLoads - loadsBeforeSave, 2);

  console.log('\n== collections outside the tracked list are never cached ==');
  let subLoads = 0;
  const readSubs = () => A.read('submissions', { coll: 'submissions' }, async () => { subLoads++; return subLoads; });
  await readSubs(); await readSubs();
  eq('every read went to the database', subLoads, 2);
  const incrsBefore = store.incrs;
  await dbOf(A).collection('submissions').updateOne({}, {});
  eq('and writing one costs no shared bump', store.incrs, incrsBefore);

  console.log('\n== a burst of readers shares one load and one version check ==');
  const C = instance();
  C.useVersionStore(store);
  let staffLoads = 0;
  store.readDelay = 40;
  const readsBefore = store.reads;
  const burst = await Promise.all(Array.from({ length: 20 }, () =>
    C.read('staff', { coll: 'staff' }, async () => { staffLoads++; await sleep(60); return 'roster'; })));
  store.readDelay = 0;
  eq('twenty simultaneous readers: one load', staffLoads, 1);
  eq('and one version read', store.reads - readsBefore, 1);
  ok('everyone got the data', burst.every((r) => r === 'roster'));

  console.log('\n== a reload right after a save never reuses a version check from before it ==');
  let formulas = 'q1';
  const readQ = () => A.read('formulas', { coll: 'qualityFormulas' }, async () => formulas);
  eq('seeded', await readQ(), 'q1');
  store.readDelay = 80;
  const early = readQ();                            // its version check sees the pre-save counter
  await sleep(15);
  formulas = 'q2';
  await dbOf(A).collection('qualityFormulas').updateOne({}, {});
  const reload = await readQ();
  store.readDelay = 0;
  eq('the reload after the save shows the save', reload, 'q2');
  await early;

  console.log('\n== a load that started before a save is not handed to a reader after it ==');
  const D = instance();
  D.useVersionStore(store);
  let blob = 'r1', blobLoads = 0;
  const readBlob = () => D.read('appdata', { coll: 'appdata' }, async () => { blobLoads++; const atQuery = blob; await sleep(120); return atQuery; });
  const slow = readBlob();                          // loading r1
  await sleep(30);
  blob = 'r2';
  await dbOf(D).collection('appdata').updateOne({}, {});
  const afterSave = await readBlob();
  eq('the reader after the save gets the saved value', afterSave, 'r2');
  eq('the early reader still gets what it read', await slow, 'r1');
  eq('they did not share one load', blobLoads, 2);
  eq('and the older load did not overwrite the newer copy', await readBlob(), 'r2');
  eq('(served from memory)', blobLoads, 2);

  console.log('\n== the database unreachable ==');
  store.failRead = 1;
  let reached = 0;
  eq('a version that cannot be read is never trusted: the loader runs',
    await A.read('departments', { coll: 'departments' }, async () => { reached++; return 'd3'; }), 'd3');
  eq('(it really ran)', reached, 1);
  store.failRead = 10;
  const boom = async () => { throw new Error('server selection timed out'); };
  eq('reference data: the last good copy rides out the outage', await A.read('departments', { coll: 'departments' }, boom), 'd3');
  let threw = null;
  try { await A.read('departments', { coll: 'departments', noRescue: true }, boom); } catch (e) { threw = e; }
  ok('a noRescue read (a save baseline) fails loudly instead', threw && /server selection/.test(threw.message));
  threw = null;
  try { await D.read('appdata', { coll: 'appdata', staleMs: 0 }, boom); } catch (e) { threw = e; }
  ok('staleMs 0 (the app-state blob) is never rescued', threw && /server selection/.test(threw.message));
  await A.read('appdata-shell', { coll: 'appdata' }, async () => ({ data: { k: 'v' }, updatedAt: 1 }));
  const tagged = await A.read('appdata-shell', { coll: 'appdata', staleMs: 60000, markRescue: true }, boom);
  ok('markRescue: an outage copy comes back tagged, so the page shell can mark it non-authoritative',
    !!tagged && tagged.rescued === true && !!tagged.data && tagged.data.k === 'v');
  const untagged = await A.read('appdata-shell', { coll: 'appdata', staleMs: 60000, markRescue: true }, async () => ({ data: { k: 'v2' }, updatedAt: 2 }));
  ok('and a real read is never tagged', !!untagged && !untagged.rescued && untagged.data.k === 'v2');
  store.failRead = 0;

  console.log('\n== a bump that never reached the shared counter is replayed ==');
  let roster = 's1';
  const readRoster = (c) => c.read('staff', { coll: 'staff' }, async () => roster);
  await readRoster(A); await readRoster(B);
  const staffVerBefore = store.doc.staff || 0;
  store.failIncr = 1;
  roster = 's2';
  await dbOf(A).collection('staff').updateOne({}, {});
  ok('the lost bump was recorded', A.snapshot().lostBumps >= 1 && A.snapshot().pendingBumps >= 1);
  eq('the instance that saved does not serve its old copy', await readRoster(A), 's2');
  ok('its next lookup replayed the bump', (store.doc.staff || 0) > staffVerBefore && A.snapshot().pendingBumps === 0);
  eq('so the other instance reloads too', await readRoster(B), 's2');

  console.log('\n== fresh, flush and dropLocal ==');
  let n = 0;
  const readN = (opts) => A.read('departments', Object.assign({ coll: 'departments' }, opts), async () => ++n);
  await readN();
  const n1 = n;
  await readN({ fresh: true });
  eq('fresh: true always goes to the database', n, n1 + 1);

  await readDepts(B); await readDepts(B);
  const beforeFlush = deptLoads;
  const flushed = await A.flush(['departments', 'staff', 'submissions']);
  ok('flush reached the shared store for every collection', flushed.every((r) => r.shared));
  await readDepts(B);
  eq('after a flush the other instance reloads', deptLoads, beforeFlush + 1);

  const usersVer = store.doc.users || 0;
  let userLoads = 0;
  const readUser = () => A.read('user:nasif', { coll: 'users' }, async () => { userLoads++; return { username: 'nasif' }; });
  await readUser(); await readUser();
  eq('a user record is cached', userLoads, 1);
  A.dropLocal('users');
  await readUser();
  eq('dropLocal reloads it here', userLoads, 2);
  eq('without moving the shared counter', store.doc.users || 0, usersVer);

  console.log('\n== CACHE_DISABLED=true reads straight through ==');
  let direct = 0;
  await off.read('departments', { coll: 'departments' }, async () => ++direct);
  await off.read('departments', { coll: 'departments' }, async () => ++direct);
  eq('every read went to the database', direct, 2);

  console.log('\n' + (fail ? 'FAILED: ' + fail + ' of ' + (pass + fail) : 'ALL ' + pass + ' PASSED'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('\ncache-mongo.test crashed: ' + (e && e.stack || e)); process.exit(1); });
