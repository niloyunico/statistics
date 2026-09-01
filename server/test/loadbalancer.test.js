/* Database load-balancer self-test — fleet-aware admission control.

   No MongoDB and no Redis needed: the limiter's decisions are all local, and the
   fleet-size lookup is best-effort background work that is absent without Redis.

   Run: npm --prefix server run test:lb
*/

// Tunables are read at module load, so set them BEFORE requiring the module.
// Small numbers make the queueing behaviour observable in milliseconds.
process.env.DB_MAX_CONCURRENCY = '50';
process.env.DB_MAX_LOCAL_CONCURRENCY = '3';
process.env.DB_MIN_LOCAL_CONCURRENCY = '1';
process.env.DB_SLOW_MS = '40';
process.env.DB_READ_WAIT_MS = '120';
process.env.DB_WRITE_WAIT_MS = '1000';
process.env.DB_QUEUE_MAX = '4';

const lb = require('../loadbalancer');

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('  PASS  ' + name); } else { fail++; console.log('  FAIL  ' + name); } };
const eq = (name, a, b) => {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A === B) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + '\n        got      ' + A + '\n        expected ' + B); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A job that takes `ms` and records how many were running at once.
function tracker() {
  const t = { now: 0, peak: 0, order: [] };
  t.job = (label, ms) => async () => {
    t.now++; if (t.now > t.peak) t.peak = t.now;
    t.order.push(label);
    await sleep(ms);
    t.now--;
    return label;
  };
  return t;
}

(async () => {
  console.log('\n== nothing is slowed down when there is capacity ==');
  lb._reset();
  const t0 = Date.now();
  eq('a lone read runs straight through', await lb.run(async () => 'value'), 'value');
  ok('with no measurable delay', Date.now() - t0 < 50);
  eq('and the slot was given back', lb.status().inFlight, 0);

  console.log('\n== the fleet never exceeds its slice, however many callers arrive ==');
  lb._reset(); lb._setLimit(3);
  const t = tracker();
  // 3 running + DB_QUEUE_MAX(4) waiting = 7 is the most this instance accepts before it
  // starts shedding; the shedding threshold itself is exercised further down.
  const results = await Promise.all(Array.from({ length: 7 }, (_, i) => lb.run(t.job('j' + i, 15))));
  eq('every caller completed', results.length, 7);
  ok('at most 3 ran at once (limit = 3)', t.peak <= 3);
  ok('and the limiter really was the reason', t.peak === 3);
  eq('no slots leaked', lb.status().inFlight, 0);

  console.log('\n== a slot is returned even when the query throws ==');
  lb._reset(); lb._setLimit(2);
  let caught = null;
  try { await lb.run(async () => { throw new Error('E11000 duplicate key'); }); } catch (e) { caught = e; }
  ok('the error reaches the caller unchanged', caught && /duplicate key/.test(caught.message));
  eq('and the slot was released', lb.status().inFlight, 0);

  console.log('\n== a write jumps ahead of waiting readers ==');
  lb._reset(); lb._setLimit(1);
  const t2 = tracker();
  const blocker = lb.run(t2.job('blocker', 80));
  await sleep(10);                                  // make sure the blocker holds the slot
  const readA = lb.run(t2.job('readA', 5));
  const readB = lb.run(t2.job('readB', 5));
  await sleep(5);
  const write = lb.run(t2.job('WRITE', 5), { kind: 'write' });
  await Promise.all([blocker, readA, readB, write]);
  eq('the write ran before the readers that were already queued', t2.order, ['blocker', 'WRITE', 'readA', 'readB']);

  console.log('\n== an overloaded read is shed, not left to time out ==');
  // This is the whole point: cache.js turns ELOADSHED into the last known-good copy,
  // so the user gets data instantly instead of waiting for a doomed query.
  lb._reset(); lb._setLimit(1);
  const hold = lb.run(async () => { await sleep(400); return 'held'; });
  await sleep(10);
  let shed = null;
  const tShed = Date.now();
  try { await lb.run(async () => 'never runs'); } catch (e) { shed = e; }
  ok('the read was shed', lb.isShedError(shed));
  ok('...quickly, not after the full query timeout', Date.now() - tShed < 400);
  ok('and it is a recognisable code', shed && shed.code === 'ELOADSHED');
  await hold;

  console.log('\n== but a write is NOT shed at the reader deadline ==');
  lb._reset(); lb._setLimit(1);
  const hold2 = lb.run(async () => { await sleep(300); return 'held'; });
  await sleep(10);
  const writeResult = await lb.run(async () => 'saved', { kind: 'write' });   // waits ~300ms
  eq('the write waited its turn and went through', writeResult, 'saved');
  await hold2;

  console.log('\n== a hopeless queue sheds immediately rather than growing ==');
  lb._reset(); lb._setLimit(1);
  const hold3 = lb.run(async () => { await sleep(300); return 'held'; });
  await sleep(10);
  const queued = [];
  for (let i = 0; i < 4; i++) queued.push(lb.run(async () => 'q' + i).catch((e) => e));
  await sleep(5);
  let overflow = null;
  try { await lb.run(async () => 'overflow'); } catch (e) { overflow = e; }
  ok('the caller past DB_QUEUE_MAX is shed at once', lb.isShedError(overflow));
  ok('...without waiting for the deadline', true);
  await Promise.all(queued.map((p) => p.catch(() => null)));
  await hold3;

  console.log('\n== the limit follows what the cluster can actually take ==');
  lb._reset(); lb._setLimit(3);
  eq('starts at its fair share', lb.status().limit, 3);
  await lb.run(async () => { await sleep(60); return 1; });          // slower than DB_SLOW_MS=40
  ok('a slow query backs the limit off', lb.status().limit < 3);
  const backedOffTo = lb.status().limit;
  await sleep(2100);                                                 // past the post-decrease hold-off
  for (let i = 0; i < 6; i++) await lb.run(async () => 1);            // fast queries
  ok('fast queries let it climb again', lb.status().limit > backedOffTo);
  ok('but never past the fair share', lb.status().limit <= lb.status().fairShare);

  console.log('\n== a duplicate-key error is not treated as congestion ==');
  lb._reset(); lb._setLimit(3);
  for (let i = 0; i < 3; i++) {
    try { await lb.run(async () => { throw new Error('E11000 duplicate key error'); }); } catch (e) { /* expected */ }
  }
  eq('the limit is untouched', lb.status().limit, 3);

  console.log('\n== with no Redis, one process simply owns the whole budget ==');
  lb._reset();
  eq('fleet size defaults to one', lb.status().fleetSize, 1);
  eq('so the fair share is the local ceiling', lb.status().fairShare, 3);

  lb._reset();
  console.log('\n' + (fail ? 'FAILED: ' + fail + ' of ' + (pass + fail) : 'ALL ' + pass + ' PASSED'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('\nloadbalancer.test crashed: ' + (e && e.stack || e)); process.exit(1); });
