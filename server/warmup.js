/* UNICO — database warmup protection: a circuit breaker in front of MongoDB.
 *
 * WHAT GOES WRONG WITHOUT IT
 * The driver waits serverSelectionTimeoutMS before admitting it cannot reach Atlas.
 * That is the right behaviour for ONE query on a healthy day and a disaster during a
 * cold or paused cluster: the page shell fires six queries, each waits the full
 * timeout, the function hits its own execution limit, and the user gets a hard error
 * after a very long wait. Worse, every new visitor spawns a new serverless instance
 * that repeats the whole doomed handshake, so a cluster that is merely slow to wake
 * gets hammered by the fleet exactly when it has least capacity.
 *
 * THE STATE MACHINE
 *   CLOSED     normal. Failures are counted.
 *   OPEN       reads are refused instantly (ECIRCUITOPEN) so cache.js can serve the
 *              last known-good copy. Nothing touches Mongo until the cooldown ends.
 *   HALF-OPEN  the cooldown has elapsed. Exactly ONE probe is allowed through, chosen
 *              fleet-wide by a Redis token; everyone else is still refused. If the
 *              probe succeeds the circuit closes; if it fails the cooldown restarts,
 *              longer than before.
 *
 * The half-open state is the part that is easy to leave out and expensive to miss.
 * Without it, the instant a cooldown expires EVERY waiting request across EVERY
 * instance goes to Mongo at once — the precise stampede the breaker exists to
 * prevent, reproduced on a timer once per cooldown against a cluster that is by
 * definition already sick.
 *
 * WHICH ERRORS COUNT
 * Only errors that mean "the cluster is not reachable or not coping". Getting this
 * list wrong in either direction is worse than having no breaker:
 *   - Too narrow and it never opens. The pool-checkout timeout that db.js's own
 *     waitQueueTimeoutMS manufactures is called MongoWaitQueueTimeoutError, and the
 *     error a cluster raises as it goes to sleep is PoolClearedOnNetworkError —
 *     which, uniquely, has no "Mongo" prefix at all. A name test that assumes the
 *     prefix silently misses the two errors a saturated free-tier cluster actually
 *     produces.
 *   - Too wide and it opens on things that are not outages. A duplicate key is not an
 *     outage. Nor is a bad password: MongoServerError "Authentication failed" means
 *     the cluster answered, and treating it as unreachable would leave the app
 *     cheerfully serving day-old cached data while every write failed. Nor are the
 *     API-misuse errors (MongoTopologyClosedError / MongoNotConnectedError) raised by
 *     our OWN shutdown path — counting those would let one instance closing down tell
 *     the entire fleet the database is dead.
 *
 * WRITES ARE NEVER SHORT-CIRCUITED. A read can fall back to a cached copy; a save
 * cannot, so a write always gets to try, and only contributes its verdict to the
 * failure count. Refusing somebody's data entry because of breaker state would be a
 * cure worse than the disease.
 */

const redis = require('./redis');

function intEnv(name, dflt) {
  const n = parseInt(process.env[name], 10);
  return Number.isFinite(n) ? n : dflt;
}

const THRESHOLD = intEnv('DB_CIRCUIT_FAILS', 3);
const COOLDOWN_MS = intEnv('DB_CIRCUIT_COOLDOWN_MS', 15000);
const MAX_COOLDOWN_MS = intEnv('DB_CIRCUIT_MAX_COOLDOWN_MS', 60000);
const PROBE_EVERY_MS = intEnv('DB_CIRCUIT_PROBE_MS', 3000);
const HYDRATE_TIMEOUT_MS = intEnv('DB_CIRCUIT_HYDRATE_MS', 600);
// Concurrent operations sharing ONE connect attempt all reject together. Counting
// each of them separately turns a single DNS hiccup into an instant open (the page
// shell alone issues four), so failures inside this window count as one event.
const FAIL_DEBOUNCE_MS = intEnv('DB_CIRCUIT_DEBOUNCE_MS', 500);

const NS = 'unico:' + (process.env.DB_NAME || 'unico') + ':';
const DOWN_KEY = NS + 'dbdown';
const PROBE_KEY = NS + 'dbprobe';

const CLOSED = 'closed', OPEN = 'open', HALF = 'half-open';

const st = {
  state: CLOSED,
  fails: 0,            // consecutive connectivity FAILURE EVENTS (debounced)
  openUntil: 0,
  probing: false,      // a probe is in flight on this instance
  opens: 0,            // drives the exponential cooldown
  shortCircuited: 0,   // requests answered without touching Mongo
  probes: 0,
  lastFailAt: 0,
  lastError: null,
  lastOpenAt: null,
  prewarmedAt: null,
};

let hydrated = false;
let hydrating = null;

function circuitError() {
  const e = new Error('Database is warming up or unreachable; serving the last known copy.');
  e.name = 'UnicoCircuitOpenError';
  e.code = 'ECIRCUITOPEN';
  return e;
}
const isCircuitError = (e) => !!e && e.code === 'ECIRCUITOPEN';

// Only transport-level trouble counts. See the header for why each entry is here.
function isConnectivityError(e) {
  if (!e || isCircuitError(e)) return false;
  const name = String(e.name || '');
  // Note PoolClearedOnNetworkError carries no "Mongo" prefix — hence the alternation
  // rather than a single anchored prefix test.
  if (/^Mongo(ServerSelection|Network|Pool|WaitQueue|Timeout|Runtime)/.test(name)) return true;
  if (/^PoolCleared/.test(name)) return true;
  const msg = String(e.message || '');
  return /server selection|timed out while checking out a connection|interrupted due to server monitor|connection pool|socket hang up|pool (was )?cleared|connection .*(closed|timed out)|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|querySrv|getaddrinfo/i.test(msg);
}

/* ---- shared (fleet-wide) outage signal --------------------------------------- */

// Read the shared flag ONCE per instance, on the first guarded call. Bounded so a
// slow Redis can never delay the first request by more than HYDRATE_TIMEOUT_MS.
function hydrate() {
  if (hydrated) return Promise.resolve();
  if (hydrating) return hydrating;
  const settle = () => { hydrated = true; hydrating = null; };
  hydrating = Promise.race([
    redis.get(DOWN_KEY).then((v) => {
      // Promise.race does not cancel the loser. If the timeout already won, this
      // instance has moved on — and may since have proved the cluster reachable — so
      // a late answer must not be allowed to re-open a circuit behind its back.
      if (hydrated) return;
      const until = parseInt(v, 10);
      if (Number.isFinite(until) && until > Date.now()) {
        st.state = OPEN;
        st.openUntil = until;
        // Deliberately NOT st.fails = THRESHOLD: inheriting a full failure count would
        // mean the next single error opens the circuit with no threshold at all.
      }
    }).catch(() => {}),
    new Promise((r) => { const t = setTimeout(r, HYDRATE_TIMEOUT_MS); if (t.unref) t.unref(); }),
  ]).then(settle, settle);
  return hydrating;
}

function open(reason) {
  const cool = Math.min(COOLDOWN_MS * Math.pow(2, st.opens), MAX_COOLDOWN_MS);
  st.state = OPEN;
  st.openUntil = Date.now() + cool;
  st.opens++;
  st.lastOpenAt = new Date().toISOString();
  console.warn('[warmup] database circuit OPEN for ' + Math.round(cool / 1000) + 's (' + reason + ') — serving cached copies. Last error: ' + st.lastError);
  redis.set(DOWN_KEY, String(st.openUntil), { px: cool }).catch(() => {});
}

function onSuccess() {
  if (st.state !== CLOSED || st.fails) {
    const wasOpen = st.state !== CLOSED;
    st.state = CLOSED;
    st.fails = 0; st.openUntil = 0; st.opens = 0; st.lastError = null;
    if (wasOpen) {
      console.log('[warmup] database reachable again — circuit closed.');
      redis.del(DOWN_KEY).catch(() => {});
    }
  }
}

function onFailure(e, wasProbe) {
  st.lastError = String((e && e.message) || e).slice(0, 200);
  if (wasProbe) { open('probe failed'); return; }      // half-open probe failed -> straight back to open
  const now = Date.now();
  if (now - st.lastFailAt > FAIL_DEBOUNCE_MS) st.fails++;   // one event, however many callers saw it
  st.lastFailAt = now;
  if (st.fails >= THRESHOLD && st.state === CLOSED) open(st.fails + ' consecutive failures');
}

// Fleet-wide probe token: whichever instance wins it makes the single attempt, so a
// hundred cold instances do not all "probe" a waking cluster at once.
async function takeProbeToken() {
  if (!redis.configured()) return true;              // single process: no coordination needed
  try { return (await redis.set(PROBE_KEY, '1', { px: PROBE_EVERY_MS, nx: true })) === 'OK'; }
  catch (e) { return true; }
}

/* ---- the wrapper every database call goes through ---------------------------- */

// guard(fn, { shortCircuit })
//   shortCircuit: false  => always attempt, only record the verdict (use for WRITES)
async function guard(fn, opts) {
  const shortCircuit = !(opts && opts.shortCircuit === false);
  await hydrate();
  let isProbe = false;

  if (shortCircuit && st.state !== CLOSED) {
    if (st.state === OPEN) {
      if (Date.now() < st.openUntil) { st.shortCircuited++; throw circuitError(); }
      st.state = HALF;                                // cooldown elapsed — NOT wide open
    }
    // HALF-OPEN: exactly one probe, and only if we win the fleet-wide token.
    if (st.probing) { st.shortCircuited++; throw circuitError(); }
    st.probing = true;                                // set before awaiting: no check-then-act gap
    const mine = await takeProbeToken();
    if (!mine) { st.probing = false; st.shortCircuited++; throw circuitError(); }
    isProbe = true;
    st.probes++;
  }

  try {
    const r = await fn();
    onSuccess();
    return r;
  } catch (e) {
    if (isConnectivityError(e)) onFailure(e, isProbe);
    throw e;
  } finally {
    if (isProbe) st.probing = false;
  }
}

/* ---- cold-start prewarm -------------------------------------------------------
   Called at module load (not from a request), so the Atlas handshake overlaps with
   the platform routing the request and parsing the body instead of running after it.
   Its verdict counts BOTH ways: a prewarm that succeeds is real evidence the cluster
   is reachable, and discarding it would leave a stale shared outage flag in force. */
function prewarm(connect) {
  if (typeof connect !== 'function') return;
  st.prewarmedAt = new Date().toISOString();
  try {
    Promise.resolve(connect()).then(
      () => onSuccess(),
      (e) => { if (isConnectivityError(e)) onFailure(e, false); }
    );
  } catch (e) { /* never let a prewarm throw into module load */ }
}

function status() {
  const now = Date.now();
  const live = (st.state === OPEN && now >= st.openUntil) ? HALF : st.state;
  return {
    state: live === CLOSED && st.fails ? 'degraded' : live,
    fails: st.fails,
    openForMs: Math.max(0, st.openUntil - now),
    opens: st.opens,
    probes: st.probes,
    shortCircuited: st.shortCircuited,
    lastError: st.lastError,
    lastOpenAt: st.lastOpenAt,
    prewarmedAt: st.prewarmedAt,
    threshold: THRESHOLD,
  };
}

const isOpen = () => st.state !== CLOSED;

// Tests only.
function _reset() {
  st.state = CLOSED; st.fails = 0; st.openUntil = 0; st.probing = false; st.opens = 0;
  st.shortCircuited = 0; st.probes = 0; st.lastFailAt = 0; st.lastError = null; st.lastOpenAt = null;
  hydrated = true; hydrating = null;
}

module.exports = {
  guard, prewarm, status, isOpen, isCircuitError, isConnectivityError, circuitError,
  _reset, DOWN_KEY, PROBE_KEY,
};
