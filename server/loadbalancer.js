/* UNICO — database load balancer: fleet-aware admission control for MongoDB.
 *
 * READ THIS FIRST, because the name promises something the platform cannot give.
 *
 * There is no HTTP load balancer to add on Vercel. Its edge already anycasts every
 * request and scales the function horizontally on its own; there is no origin pool to
 * distribute across and no knob to configure one. Requests are ALREADY balanced.
 *
 * What is NOT balanced — and what actually falls over on the free tiers — is the load
 * those instances put on ONE small Atlas cluster. Every instance has its own pool and
 * no idea the others exist, so the fleet's total pressure on M0 is however many
 * instances Vercel happened to create, times whatever each one felt like doing. Nobody
 * is in charge. That is the imbalance worth fixing, and it is what this file fixes.
 *
 * THREE MECHANISMS
 *
 *   1. FLEET-AWARE FAIR SHARE. Each instance registers itself in a per-minute Redis
 *      counter (one INCR per instance per minute — no per-query round trip, which
 *      would cost more latency than it saves). The previous minute's count is a good
 *      estimate of how many instances are live, so each one can compute its own fair
 *      slice of a single global concurrency budget:
 *
 *          local limit = clamp(DB_MAX_CONCURRENCY / fleet size, min, pool size)
 *
 *      One instance awake gets the whole budget. Forty instances at 8am each get a
 *      fortieth. The cluster sees roughly DB_MAX_CONCURRENCY concurrent operations
 *      either way, instead of forty uncoordinated pools all deciding they are alone.
 *
 *   2. AIMD CONGESTION CONTROL. A fixed limit is a guess, and the right number differs
 *      between a quiet Sunday and a shared-tier cluster that is being throttled. So the
 *      limit also moves with observed reality — additive increase while queries are
 *      fast, multiplicative decrease the moment they slow down or time out. This is the
 *      same control law TCP uses, for the same reason: it finds the capacity that
 *      actually exists rather than the one somebody wrote in a config file.
 *
 *   3. LOAD SHEDDING, NOT COLLAPSE. When the fleet is genuinely over capacity, queueing
 *      every reader just converts a fast failure into a slow one and then a function
 *      timeout. Instead a read that cannot get a slot in time is SHED: it throws
 *      ELOADSHED, and cache.js treats that exactly like any other loader failure and
 *      serves the last known-good copy. The user gets data, instantly, and the cluster
 *      gets the breathing room to recover.
 *
 * WRITES ARE NOT SHED. Same rule as the circuit breaker: a read can fall back to a
 * cached copy, somebody's data entry cannot. Writes jump the queue, get a much longer
 * deadline, and are only ever refused when the queue is so far gone that the function
 * would time out anyway.
 *
 * ORDER OF OPERATIONS (see db.js): circuit breaker OUTSIDE, limiter INSIDE. A dead
 * cluster should be refused in microseconds, before it is ever worth queueing for.
 *
 * Env (all optional):
 *   DB_MAX_CONCURRENCY=50        total simultaneous operations across the WHOLE fleet
 *   DB_MIN_LOCAL_CONCURRENCY=2   never starve an instance, however crowded it gets
 *   DB_MAX_LOCAL_CONCURRENCY     ceiling per instance (defaults to the pool size)
 *   DB_QUEUE_MAX=64              queued readers before shedding starts
 *   DB_READ_WAIT_MS=2500         how long a read may wait for a slot before it is shed
 *   DB_WRITE_WAIT_MS=9000        the same for a write (long: writes are not shed lightly)
 *   DB_SLOW_MS=750               above this a query counts as congestion
 *   LB_DISABLED=true             bypass entirely (straight through, no limiting)
 */

const redis = require('./redis');

const SERVERLESS = !!process.env.VERCEL;
const DISABLED = String(process.env.LB_DISABLED || '').toLowerCase() === 'true';

const MAX_GLOBAL = parseInt(process.env.DB_MAX_CONCURRENCY || '50', 10);
const MIN_LOCAL = Math.max(1, parseInt(process.env.DB_MIN_LOCAL_CONCURRENCY || '2', 10));
// Never admit more than the connection pool can actually serve — past that point the
// requests only queue somewhere less visible. Mirrors maxPoolSize in db.js.
const MAX_LOCAL = Math.max(MIN_LOCAL, parseInt(process.env.DB_MAX_LOCAL_CONCURRENCY || (SERVERLESS ? '5' : '25'), 10));
const QUEUE_MAX = parseInt(process.env.DB_QUEUE_MAX || '64', 10);
const READ_WAIT_MS = parseInt(process.env.DB_READ_WAIT_MS || '2500', 10);
const WRITE_WAIT_MS = parseInt(process.env.DB_WRITE_WAIT_MS || '9000', 10);
const SLOW_MS = parseInt(process.env.DB_SLOW_MS || '750', 10);
const FLEET_KEY = 'unico:' + (process.env.DB_NAME || 'unico') + ':fleet:';
const BUCKET_MS = 60000;
const FLEET_TTL_S = 180;          // three minutes: enough to read the previous bucket

let inFlight = 0;
let limit = MAX_LOCAL;            // adaptive; starts optimistic and backs off on evidence
let fleetSize = 1;
let myBucket = null;              // the minute this instance has already registered in
let fleetReadAt = 0;
let lastDecreaseAt = 0;

const queue = [];                 // { resolve, reject, kind, timer }
const stats = {
  admitted: 0, queued: 0, shed: 0, refusedWrites: 0,
  slow: 0, errors: 0, peakQueue: 0, maxInFlight: 0, decreases: 0, increases: 0,
  lastShedAt: null,
};

function shedError(why) {
  const e = new Error('Database is at capacity (' + why + '); served from the cached copy.');
  e.name = 'UnicoLoadShedError';
  e.code = 'ELOADSHED';
  return e;
}
const isShedError = (e) => !!e && e.code === 'ELOADSHED';

/* ---- fair share -------------------------------------------------------------- */

// The ceiling this instance may raise its limit to, given how many others are awake.
function fairShare() {
  const share = Math.round(MAX_GLOBAL / Math.max(1, fleetSize));
  return Math.max(MIN_LOCAL, Math.min(MAX_LOCAL, share));
}

// Cheap, synchronous, and never awaited from the request path: it only kicks off
// background Redis work. A request must never wait on bookkeeping.
function touchFleet() {
  if (!redis.configured()) return;               // single process: fleet size is 1
  const now = Date.now();
  const bucket = Math.floor(now / BUCKET_MS);

  // Register this instance in the current minute, exactly once per minute. The count
  // in a completed bucket is therefore the number of instances that served traffic.
  if (myBucket !== bucket) {
    myBucket = bucket;
    const key = FLEET_KEY + bucket;
    redis.cmd(['INCR', key]).then((n) => {
      // Only the instance that created the bucket needs to set its lifetime.
      if (n === 1) return redis.cmd(['EXPIRE', key, FLEET_TTL_S]);
    }).catch(() => { /* bookkeeping is best effort */ });
  }

  // Read the PREVIOUS (complete) bucket — the current one is still filling up.
  if (now - fleetReadAt > BUCKET_MS) {
    fleetReadAt = now;
    redis.get(FLEET_KEY + (bucket - 1)).then((v) => {
      const n = parseInt(v, 10);
      if (Number.isFinite(n) && n > 0) {
        fleetSize = n;
        // Growing the fleet lowers everyone's share immediately; shrinking it lets the
        // AIMD climb back up gradually rather than all at once.
        if (limit > fairShare()) { limit = fairShare(); }
      }
    }).catch(() => { /* keep the previous estimate */ });
  }
}

/* ---- AIMD: let the cluster tell us what it can take -------------------------- */

function decrease(why) {
  const next = Math.max(MIN_LOCAL, Math.floor(limit * 0.7));
  if (next < limit) {
    limit = next;
    lastDecreaseAt = Date.now();
    stats.decreases++;
  }
}
function increase() {
  // Do not climb straight back into congestion we just backed away from.
  if (Date.now() - lastDecreaseAt < 2000) return;
  const ceiling = fairShare();
  if (limit < ceiling) { limit += 1; stats.increases++; pump(); }
}

function observe(ms, ok, err) {
  if (!ok) {
    stats.errors++;
    // A timeout is congestion; a duplicate-key rejection says nothing about capacity.
    if (/timed out|timeout|pool|queue|ECONNRESET|socket/i.test(String((err && err.message) || ''))) decrease('error');
    return;
  }
  if (ms > SLOW_MS) { stats.slow++; decrease('slow'); }
  else if (ms < SLOW_MS / 2) increase();
}

/* ---- the semaphore ----------------------------------------------------------- */

function remove(item) {
  const i = queue.indexOf(item);
  if (i >= 0) queue.splice(i, 1);
}

function pump() {
  while (queue.length && inFlight < limit) {
    const item = queue.shift();
    if (item.timer) clearTimeout(item.timer);
    inFlight++;
    if (inFlight > stats.maxInFlight) stats.maxInFlight = inFlight;
    item.resolve();
  }
}

function acquire(kind) {
  return new Promise((resolve, reject) => {
    // Fast path: capacity available and nobody already waiting (FIFO fairness).
    if (inFlight < limit && queue.length === 0) {
      inFlight++;
      if (inFlight > stats.maxInFlight) stats.maxInFlight = inFlight;
      stats.admitted++;
      return resolve();
    }

    const write = kind === 'write';
    const waiting = queue.length;
    if (waiting >= (write ? QUEUE_MAX * 2 : QUEUE_MAX)) {
      // Past this point queueing only converts a fast failure into a slow one.
      if (write) { stats.refusedWrites++; return reject(shedError('write queue exhausted')); }
      stats.shed++; stats.lastShedAt = new Date().toISOString();
      return reject(shedError('queue full'));
    }

    const item = { resolve, reject, kind, timer: null };
    item.timer = setTimeout(() => {
      remove(item);
      if (write) { stats.refusedWrites++; return reject(shedError('waited too long for a write slot')); }
      stats.shed++; stats.lastShedAt = new Date().toISOString();
      reject(shedError('waited too long'));
    }, write ? WRITE_WAIT_MS : READ_WAIT_MS);

    stats.queued++;
    // Writes jump the queue: they cannot fall back to a cached copy, readers can.
    if (write) queue.unshift(item); else queue.push(item);
    if (queue.length > stats.peakQueue) stats.peakQueue = queue.length;
  });
}

function release() {
  inFlight = Math.max(0, inFlight - 1);
  pump();
}

/* ---- what callers use -------------------------------------------------------- */

// run(fn, { kind: 'read' | 'write' })
// Resolves with fn()'s value. Rejects with ELOADSHED if this operation was shed —
// which cache.js turns into "serve the last known-good copy".
async function run(fn, opts) {
  if (DISABLED) return fn();
  const kind = (opts && opts.kind) === 'write' ? 'write' : 'read';
  touchFleet();
  await acquire(kind);
  const t0 = Date.now();
  try {
    const r = await fn();
    observe(Date.now() - t0, true);
    return r;
  } catch (e) {
    observe(Date.now() - t0, false, e);
    throw e;
  } finally {
    release();
  }
}

function status() {
  return {
    enabled: !DISABLED,
    inFlight,
    limit,
    fairShare: fairShare(),
    fleetSize,
    globalBudget: MAX_GLOBAL,
    queued: queue.length,
    admitted: stats.admitted,
    queuedTotal: stats.queued,
    shed: stats.shed,
    refusedWrites: stats.refusedWrites,
    slow: stats.slow,
    peakQueue: stats.peakQueue,
    maxInFlight: stats.maxInFlight,
    adjustments: { up: stats.increases, down: stats.decreases },
    lastShedAt: stats.lastShedAt,
  };
}

// Tests only.
function _reset(opts) {
  while (queue.length) { const i = queue.shift(); if (i.timer) clearTimeout(i.timer); }
  inFlight = 0;
  limit = (opts && opts.limit) || MAX_LOCAL;
  fleetSize = 1; myBucket = null; fleetReadAt = 0; lastDecreaseAt = 0;
  Object.keys(stats).forEach((k) => { if (typeof stats[k] === 'number') stats[k] = 0; });
  stats.lastShedAt = null;
}
function _setLimit(n) { limit = n; pump(); }

module.exports = { run, status, isShedError, shedError, _reset, _setLimit, MAX_GLOBAL, MIN_LOCAL, MAX_LOCAL };
