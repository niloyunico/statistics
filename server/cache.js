/* UNICO — the read cache in front of MongoDB.
 *
 * THE PROBLEM THIS SOLVES
 * On Vercel every request may land on a brand-new function instance with an empty
 * MongoDB pool. Opening that pool means DNS + TCP + TLS + SCRAM auth against Atlas
 * before the first document is read, and on the free (M0) shared tier that can take
 * seconds — longer while the cluster is waking up. Twenty people opening the app at
 * 8am therefore produced twenty cold instances, twenty pools and twenty identical
 * "read every department" queries against one small shared cluster, and whoever
 * arrived first watched a blank page for eight seconds. If the cluster was actually
 * unreachable, everybody got "database unreachable" instead of the numbers they had
 * been looking at a minute earlier.
 *
 * FIVE MECHANISMS, all of them needed:
 *
 *   1. SHARED CACHE. The datasets the app reads on every page load (departments,
 *      quality, staff, the formula catalogue, the app-state blob) are reference data
 *      that changes a few times a day. Holding them in Redis means a cold instance
 *      answers from one ~20ms HTTPS call instead of a cold Mongo handshake.
 *
 *   2. ONE ROUND TRIP FOR THE WHOLE PAGE. readMany() looks up every dataset the page
 *      shell needs in a SINGLE pipelined request — values and version counters
 *      together. Six independent lookups became one, which matters twice over: it is
 *      one network hop instead of six, and it is a sixth of the commands against a
 *      free Redis quota.
 *
 *   3. SINGLE FLIGHT (request coalescing). This is the part that actually behaves
 *      like a load balancer for the database. When an entry expires, the first caller
 *      across the WHOLE fleet takes a short Redis lock and refreshes it; everyone else
 *      is served the previous copy immediately. One Mongo query per expiry, not one
 *      per visitor — which is what keeps an M0 cluster inside its connection and
 *      operation limits no matter how many instances Vercel spins up.
 *
 *   4. BACKGROUND REVALIDATION. Once an entry passes its freshness window it is still
 *      handed to the user INSTANTLY while the refresh happens behind the response.
 *      Nobody waits on a database read for reference data — not even the unlucky
 *      visitor who happened to arrive at the moment it expired. Only entries whose
 *      version still matches qualify, so this can never delay somebody's own edit
 *      from appearing: a write makes the entry non-current, and non-current entries
 *      are always reloaded synchronously.
 *
 *   5. STALE-WHILE-BROKEN (the warmup protection). Entries keep a long "stale"
 *      horizon after their short "fresh" one. If the loader throws — cold cluster,
 *      Atlas resuming, network blip, circuit breaker open, load shed — the last good
 *      copy is served instead of an error. The app stays usable through a database
 *      outage and repairs itself the moment Mongo answers again.
 *
 * CORRECTNESS: WHY THIS CANNOT SERVE OLD DATA AFTER AN EDIT
 * Time-based expiry alone would show an admin their own edit "not saving" for a
 * minute. So every cached entry is stamped with the version counter of the Mongo
 * COLLECTION it was built from, and instrument() wraps the live Db handle so that
 * ANY write through it (insert/update/delete/bulkWrite, from any module, including
 * ones written later) increments that counter. A stamp that no longer matches is not
 * a cache hit — no matter how young it is, and it is never background-revalidated.
 * Invalidation is therefore automatic and fleet-wide, not a list of call sites
 * somebody has to remember to update.
 *
 * COMPRESSION: the quality dataset alone is ~350 KB of JSON. Anything past
 * CACHE_COMPRESS_BYTES is gzipped before it is stored, which takes the usual payload
 * to a small fraction of that — far less to push over the wire on every cold start,
 * and it keeps large datasets under the value-size limit instead of silently
 * refusing to cache them.
 *
 * Env (all optional):
 *   CACHE_DISABLED=true       bypass everything (straight to Mongo) — the escape hatch
 *   CACHE_TTL_MS              fresh window for reference data       (default 60000)
 *   CACHE_APPDATA_MS          fresh window for the app-state blob   (default 5000)
 *   CACHE_REVALIDATE_MS       how long past fresh an entry may still be served while
 *                             it refreshes in the background        (default 300000)
 *   CACHE_STALE_MS            how long a copy may rescue an outage  (default 86400000)
 *   CACHE_LOCAL_MS            in-process re-use window              (default 2000)
 *   CACHE_COMPRESS_BYTES      gzip payloads larger than this        (default 8192)
 *   CACHE_VERSION             bump by hand if a cached SHAPE changes across a deploy
 */

const zlib = require('zlib');
const redis = require('./redis');

// A mistyped number must never silently disable a safety feature. parseInt('1h') is
// NaN and EVERY comparison against NaN is false, so CACHE_STALE_MS=1h would quietly
// kill the entire outage-rescue path and turn an Atlas blip back into an error page.
function intEnv(name, dflt) {
  const n = parseInt(process.env[name], 10);
  return Number.isFinite(n) ? n : dflt;
}

const DISABLED = String(process.env.CACHE_DISABLED || '').toLowerCase() === 'true';
const FRESH_MS = intEnv('CACHE_TTL_MS', 60000);
const APPDATA_MS = intEnv('CACHE_APPDATA_MS', 5000);
const REVALIDATE_MS = intEnv('CACHE_REVALIDATE_MS', 300000);
const STALE_MS = intEnv('CACHE_STALE_MS', 24 * 3600 * 1000);
const LOCAL_MS = intEnv('CACHE_LOCAL_MS', 2000);
const LOCK_MS = intEnv('CACHE_LOCK_MS', 8000);
// Must be comparable to LOCK_MS, not a fraction of it. A waiter that gives up after
// 1.5s while the holder legitimately has 8s to finish does not avoid the stampede —
// it CAUSES it, and precisely when the cluster is slowest and it matters most.
const WAIT_MS = intEnv('CACHE_WAIT_MS', 5000);
const COMPRESS_OVER = intEnv('CACHE_COMPRESS_BYTES', 8192);
// A write must never wait on cache bookkeeping. The local bump is instant and already
// covers read-after-write on this instance; the shared one gets a short grace period.
const BUMP_TIMEOUT_MS = intEnv('CACHE_BUMP_TIMEOUT_MS', 500);
// Redis rejects oversized values. Past this a dataset is simply not cached remotely
// (the in-process copy still applies). Never let it turn into a request failure.
const MAX_BYTES = intEnv('CACHE_MAX_BYTES', 900000);

// Namespace: database + a manual version. DB_NAME keeps the self-test database from
// colliding with live data; CACHE_VERSION is the manual kill switch for a shape change.
const NS = 'unico:' + (process.env.DB_NAME || 'unico') + ':v' + (process.env.CACHE_VERSION || '1') + ':';
const key = (name) => NS + 'e:' + name;
const verKey = (coll) => NS + 'ver:' + coll;
const lockKey = (name) => NS + 'e:' + name + ':lock';

const stats = {
  hits: 0, l1Hits: 0, misses: 0, loads: 0, stale: 0, rescues: 0, bumps: 0,
  swr: 0, revalidated: 0, revalidateFails: 0, compressed: 0, oversized: 0,
  lostBumps: 0, takeovers: 0,
  lastRescue: null, lastLostBump: null,
};

// Collections whose invalidation never reached the SHARED store (Redis absent, muted
// or timing out). Until it does, every OTHER instance keeps serving pre-write data
// and nothing detects it — so they are retried, free of charge, on the next lookup
// pipeline this instance performs.
const pendingBumps = new Set();

/* ---- L1: the in-process copy -------------------------------------------------
   Saves the Redis round trip when the same warm instance serves several requests in
   a row. Deliberately tiny — LOCAL_MS is two seconds — and dropped instantly when
   this instance performs a write. */
const L1 = new Map();          // name -> { val, at, coll, lv }
const localVers = new Map();   // coll -> local bump counter

const localVer = (coll) => localVers.get(coll) || 0;
// `lv` is the local bump counter AS IT WAS WHEN THE VALUE WAS READ, not now. Stamping
// it at store time is a real bug: a write that lands while a read is in flight bumps
// the counter, and the loader then publishes its pre-write result carrying the POST-
// write stamp — so the L1 check passes and this instance serves the admin their own
// save as if it had not happened, for up to LOCAL_MS. Callers that ran a loader must
// pass the value they captured before awaiting it.
function setL1(name, coll, val, at, lv) {
  L1.set(name, { val, at, coll, lv: lv === undefined ? localVer(coll) : lv });
}
function dropL1(coll) { for (const [n, e] of L1) if (e.coll === coll) L1.delete(n); }

const toInt = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; };
const numOr = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const collOf = (spec) => spec.coll || spec.name;

/* ---- codec ------------------------------------------------------------------- */
// JSON never begins with "z:", so the marker is unambiguous.
function encode(obj) {
  const json = JSON.stringify(obj);
  if (json.length < COMPRESS_OVER) return json;
  try {
    // level 1: this runs on the request path, and the win is almost all in the first
    // pass anyway — reference data is extremely repetitive JSON.
    const out = 'z:' + zlib.gzipSync(Buffer.from(json, 'utf8'), { level: 1 }).toString('base64');
    stats.compressed++;
    return out;
  } catch (e) { return json; }
}
function decode(raw) {
  if (raw == null) return null;
  let s = String(raw);
  if (s.slice(0, 2) === 'z:') {
    try { s = zlib.gunzipSync(Buffer.from(s.slice(2), 'base64')).toString('utf8'); }
    catch (e) { return null; }                 // corrupt/truncated -> treat as absent
  }
  try {
    const e = JSON.parse(s);
    return (e && typeof e === 'object' && typeof e.at === 'number') ? e : null;
  } catch (e) { return null; }
}

async function store(name, val, ver, staleMs) {
  let body;
  try { body = encode({ ver, at: Date.now(), val }); }
  catch (e) { return; }                        // not serializable -> simply not cached
  // byteLength, not .length: String#length counts UTF-16 units, so a payload with
  // non-ASCII content can be well past the server's limit while looking compliant —
  // and a rejected oversized write counts as a transport failure, which would mute
  // the client for EVERY key.
  if (Buffer.byteLength(body, 'utf8') > MAX_BYTES) { stats.oversized++; return; }
  // Expire at the stale horizon so Redis reclaims the memory on its own; nothing in
  // this cache is ever meant to outlive it.
  await redis.set(key(name), body, { px: staleMs });
}

// Wait for whichever caller holds the lock to publish a usable copy.
//
// Returns { entry } when one appears, { won: true } if the holder's lease expired and
// we took over, or {} if neither happened before the deadline.
//
// TWO things here are load-bearing:
//   - The version check. A holder that started BEFORE the write that invalidated us
//     will publish a pre-write snapshot, correctly stamped with the old version.
//     Accepting it on the strength of its timestamp alone would hand back exactly the
//     stale data the version stamp exists to reject — to a caller that had already
//     PROVEN the entry invalid moments earlier.
//   - Re-attempting the lock. If the holder was frozen or killed mid-load its lease
//     expires; without a takeover attempt every waiter would sit out the full
//     deadline and then stampede the cluster together.
// Polls back off so a long wait costs a handful of commands, not dozens.
async function waitForHolder(name, sinceAt, ver) {
  const deadline = Date.now() + WAIT_MS;
  let delay = 100;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, Math.min(delay, Math.max(0, deadline - Date.now()))));
    delay = Math.min(1000, Math.round(delay * 1.5));
    const e = decode(await redis.get(key(name)));
    if (e && e.at > sinceAt && e.ver === ver) return { entry: e };
    const got = await redis.set(lockKey(name), String(Date.now()), { px: LOCK_MS, nx: true });
    if (got === 'OK') { stats.takeovers++; return { won: true, at: Date.now() }; }
  }
  return {};
}

/* ---- background revalidation --------------------------------------------------
   Refresh an entry that is past its freshness window WITHOUT making anybody wait for
   it. Fleet-coordinated through the same single-flight lock, so one instance does the
   work. Never awaited, never allowed to reject: if the instance is frozen before it
   finishes, the entry simply stays as it was and the next request tries again. */
const revalidating = new Set();

function revalidate(spec, ver) {
  const name = spec.name;
  if (revalidating.has(name)) return;
  revalidating.add(name);
  const done = () => revalidating.delete(name);
  const lvAtStart = localVer(collOf(spec));    // see setL1: stamp what was true at READ time

  redis.set(lockKey(name), 'swr', { px: LOCK_MS, nx: true })
    .then((won) => {
      if (won !== 'OK') return null;           // another instance is already on it
      return Promise.resolve()
        .then(() => spec.loader())
        .then((val) => store(name, val, ver, numOr(spec.staleMs, STALE_MS)).then(() => {
          stats.revalidated++;
          setL1(name, collOf(spec), val, Date.now(), lvAtStart);
        }))
        .catch(() => { stats.revalidateFails++; })
        .then(() => redis.del(lockKey(name)).catch(() => {}));
    })
    .catch(() => {})
    .then(done, done);
}

function rescue(name, coll, entry, lv) {
  stats.rescues++;
  stats.lastRescue = new Date().toISOString();
  // Hold the rescued copy locally for a moment: during an outage a burst of requests
  // should not each re-attempt a database that has already said no.
  setL1(name, coll, entry.val, Date.now(), lv);
  return entry.val;
}

/* ---- lookup: values and versions for many datasets, in ONE round trip --------- */
async function lookup(specs) {
  // Retry any invalidation that never reached the shared store, at zero extra cost:
  // it rides along in this pipeline. The INCRs go FIRST so the version reads below
  // already reflect them.
  const retry = [...pendingBumps];
  const entryKeys = specs.map((s) => key(s.name));
  const colls = [...new Set(specs.map(collOf))];
  const cmds = retry.map((c) => ['INCR', verKey(c)])
    .concat(entryKeys.map((k) => ['GET', k]))
    .concat(colls.map((c) => ['GET', verKey(c)]));

  const { shared, results } = await redis.pipelineExec(cmds);
  if (shared) retry.forEach((c) => pendingBumps.delete(c));

  const base = retry.length;
  const vers = {};
  colls.forEach((c, i) => { vers[c] = toInt(results[base + entryKeys.length + i]); });

  const found = new Map();
  specs.forEach((s, i) => found.set(s.name, { entry: decode(results[base + i]), ver: vers[collOf(s)] }));
  return found;
}

/* ---- resolve one dataset, given what the lookup found ------------------------ */
async function resolve(spec, found) {
  const name = spec.name;
  const coll = collOf(spec);
  const freshMs = numOr(spec.freshMs, FRESH_MS);
  const staleMs = numOr(spec.staleMs, STALE_MS);
  const now = Date.now();

  const entry = found ? found.entry : null;
  const ver = found ? found.ver : 0;
  // A stamp that does not match the collection's current version means somebody has
  // written since; the copy is not a hit, though it may still rescue an outage.
  const current = !!entry && entry.ver === ver;
  const age = entry ? now - entry.at : Infinity;
  const rescuable = !!entry && age < staleMs;

  if (!spec.fresh && current && freshMs > 0) {
    if (age < freshMs) { stats.hits++; setL1(name, coll, entry.val, entry.at); return entry.val; }
    if (age < freshMs + REVALIDATE_MS) {
      // Past its freshness but still the current version: answer NOW, refresh behind
      // the response. Nobody waits on Mongo for reference data.
      stats.swr++;
      setL1(name, coll, entry.val, now);
      revalidate(spec, ver);
      return entry.val;
    }
  }
  stats.misses++;

  // The local bump counter as it is RIGHT NOW, captured before any await. Everything
  // below hands it to setL1 so that a write landing mid-load correctly invalidates the
  // in-process copy instead of being masked by it. See setL1.
  const lv = localVer(coll);

  // What to do when the loader fails. `noRescue` callers would rather fail loudly than
  // proceed on old data — a read-modify-write baseline is the case that matters:
  // merging somebody's save against a copy from an outage can silently no-op their
  // edit or drop a key, and a visible "save failed" is far better than either.
  const onLoaderError = (e) => {
    if (rescuable && !spec.noRescue) return rescue(name, coll, entry, lv);
    throw e;
  };

  // A caller that demanded a guaranteed-fresh read must never be handed a copy that
  // some other request loaded — that is the whole point of `fresh`, and it is what
  // read-modify-write paths (PUT /api/data) depend on to not lose an edit. So: no
  // lock, no waiting on anybody else, straight to the loader.
  if (spec.fresh || freshMs <= 0) {
    try {
      const val = await spec.loader();
      await store(name, val, ver, staleMs);
      stats.loads++;
      setL1(name, coll, val, Date.now(), lv);
      return val;
    } catch (e) { return onLoaderError(e); }
  }

  // Single flight: exactly one caller in the fleet refreshes this key.
  let heldSince = Date.now();
  const acquired = await redis.exec(['SET', lockKey(name), String(heldSince), 'PX', LOCK_MS, 'NX']);
  let won = acquired.result === 'OK';
  // WHICH STORE answered — not "was it Redis". A lock taken while Redis was muted lives
  // only in this process, and releasing it against the real Redis once the mute lifts
  // would delete a lock a DIFFERENT instance legitimately holds. But when Redis is not
  // configured at all, the in-process store IS the only store, so the release is both
  // correct and REQUIRED: treating that as "not mine to release" strands the lock for
  // its full lease, and the next reader waits it out and then serves a stale copy.
  let wonOn = acquired.shared;

  if (!won) {
    // Another instance is already asking Mongo. Do NOT queue up behind it.
    if (current && rescuable) { stats.stale++; return entry.val; }
    const waited = await waitForHolder(name, entry ? entry.at : 0, ver);
    if (waited.entry) {
      stats.hits++;
      setL1(name, coll, waited.entry.val, waited.entry.at, lv);
      return waited.entry.val;
    }
    if (waited.won) { won = true; wonOn = redis.live(); heldSince = waited.at; }
    // Deliberately no "return the stale copy" fallback here. Reaching this point means
    // the entry's version stamp says a write has superseded it (a version-CURRENT copy
    // was already returned further up), so handing it back would be serving data we
    // have positively established is out of date — the one thing this cache promises
    // never to do. Nobody is coming; load it ourselves.
  }

  try {
    const val = await spec.loader();
    // Stamped with the version read BEFORE the loader ran: a write that lands while
    // we were reading bumps past this stamp, so the entry is correctly rejected next
    // time instead of pinning a value that is already out of date.
    await store(name, val, ver, staleMs);
    stats.loads++;
    setL1(name, coll, val, Date.now(), lv);
    return val;
  } catch (e) { return onLoaderError(e); }
  finally {
    // Release only a lease we still actually hold. If the loader outran LOCK_MS our
    // lock has already expired and somebody else may now own the key — deleting it
    // would evict the new owner and collapse single flight into a stampede, exactly
    // when the cluster is slowest. An expired lease needs no release anyway.
    // Not awaited: a released lock is bookkeeping, and the caller has their answer.
    // redis.live() is where a DEL would go NOW; wonOn is where the SET actually went.
    // Equal means same store, so the release lands on the lock we took. They differ
    // only when Redis flapped mid-load, and then the lease simply expires on its own.
    if (won && wonOn === redis.live() && (Date.now() - heldSince) < LOCK_MS) {
      redis.del(lockKey(name)).catch(() => {});
    }
  }
}

/* ---- what callers use --------------------------------------------------------- */

// Try the in-process copy. Returns { hit, val }.
function fromL1(spec, now) {
  if (spec.fresh) return { hit: false };
  const freshMs = numOr(spec.freshMs, FRESH_MS);
  if (freshMs <= 0) return { hit: false };
  const l = L1.get(spec.name);
  if (l && (now - l.at) < Math.min(LOCAL_MS, freshMs) && l.lv === localVer(collOf(spec))) {
    stats.l1Hits++;
    return { hit: true, val: l.val };
  }
  return { hit: false };
}

// Read SEVERAL datasets with a single Redis round trip.
//   specs: [{ name, coll, freshMs, staleMs, fresh, loader }]
// Returns their values in the same order.
async function readMany(specs) {
  if (DISABLED) return Promise.all(specs.map((s) => s.loader()));
  const now = Date.now();
  const out = new Array(specs.length);
  const need = [];
  specs.forEach((s, i) => {
    const l1 = fromL1(s, now);
    if (l1.hit) out[i] = l1.val; else need.push({ i, s });
  });
  if (!need.length) return out;

  const found = await lookup(need.map((n) => n.s));
  await Promise.all(need.map(async (n) => { out[n.i] = await resolve(n.s, found.get(n.s.name)); }));
  return out;
}

// read(name, opts, loader) — one dataset. opts: { coll, freshMs, staleMs, fresh }.
//   fresh: skip every cache layer on the way IN (the stale copy is still available as
//   an outage rescue). Use it on read-modify-write paths, where a slightly old
//   baseline could lose someone's edit.
async function read(name, opts, loader) {
  const spec = Object.assign({}, opts || {}, { name, loader });
  const vals = await readMany([spec]);
  return vals[0];
}

// Force a refresh and keep the result (used by the keep-alive so the shared copy is
// never the thing that has gone cold).
function warm(name, opts, loader) { return read(name, Object.assign({}, opts, { fresh: true }), loader); }

// Mark a collection changed. Every cached entry derived from it stops being a hit,
// on this instance immediately and everywhere else on their next lookup.
async function bump(coll) {
  localVers.set(coll, localVer(coll) + 1);
  dropL1(coll);
  stats.bumps++;
  if (DISABLED) return;
  // Bounded so a slow Redis can never add its full timeout to every save.
  const timedOut = Symbol('timeout');
  const outcome = await Promise.race([
    redis.exec(['INCR', verKey(coll)]).catch(() => ({ shared: false })),
    new Promise((r) => { const t = setTimeout(() => r(timedOut), BUMP_TIMEOUT_MS); if (t.unref) t.unref(); }),
  ]);
  // If the counter never reached the SHARED store, every OTHER instance is still
  // serving pre-write data and — because redis.cmd() answers from the in-process
  // stand-in and looks successful — nothing would ever notice. Record it and retry it
  // on the next lookup pipeline instead of silently losing the invalidation.
  if (redis.configured() && (outcome === timedOut || !outcome || outcome.shared !== true)) {
    pendingBumps.add(coll);
    stats.lostBumps++;
    stats.lastLostBump = new Date().toISOString();
  }
}

// Every collection the app caches something from. Used by the flush CLI.
const CACHED_COLLECTIONS = ['departments', 'staff', 'appdata', 'qualityFormulas'];

// Invalidate collections explicitly, reporting whether each bump actually reached the
// SHARED store. This is the escape hatch for writes the Proxy cannot see: a maintenance
// script that opens its own MongoClient, an edit made by hand in the Atlas UI, a restore
// from backup. Without it those changes sit in Mongo while the fleet keeps serving the
// copy it had — the "I ran the fix and nothing changed" report.
async function flush(colls) {
  const list = (colls && colls.length) ? colls : CACHED_COLLECTIONS;
  const out = [];
  for (const c of list) {
    localVers.set(c, localVer(c) + 1);
    dropL1(c);
    let r;
    try { r = await redis.exec(['INCR', verKey(c)]); } catch (e) { r = { shared: false }; }
    out.push({ coll: c, shared: r.shared === true, version: r.result });
  }
  return out;
}

/* ---- automatic invalidation ---------------------------------------------------
   Wrap the live Db handle so every write bumps its collection, whoever performed it.
   This is why no module needs to know the cache exists: data-collection.js,
   users-admin.js, supervisor-reports.js and anything added later all go through
   db.getDbHandle(), so their writes invalidate correctly for free.

   Methods are bound to the REAL target rather than the proxy: the MongoDB driver
   uses private class fields, and calling one with the proxy as `this` would throw. */
const WRITE_OPS = new Set([
  'insertOne', 'insertMany', 'updateOne', 'updateMany', 'replaceOne',
  'deleteOne', 'deleteMany', 'findOneAndUpdate', 'findOneAndReplace', 'findOneAndDelete',
  'bulkWrite', 'drop', 'rename', 'findOneAndModify',
]);

function wrapCollection(coll, name) {
  return new Proxy(coll, {
    get(target, prop) {
      const v = target[prop];
      if (typeof v !== 'function') return v;
      if (!WRITE_OPS.has(prop)) return v.bind(target);
      return function (...args) {
        // `rename` moves documents to a DIFFERENT collection, so both sides change.
        const also = (prop === 'rename' && args[0]) ? String(args[0]) : null;
        const invalidate = () => (also ? bump(name).then(() => bump(also)) : bump(name));
        const out = v.apply(target, args);
        // Bump BEFORE the caller continues, so a save followed by a re-read never
        // sees the old copy — and bump on FAILURE too: bulkWrite/insertMany/updateMany
        // can apply some documents and then reject, which would otherwise leave the
        // database changed and every cached copy of it still counted as current.
        return Promise.resolve(out).then(
          (res) => invalidate().then(() => res),
          (err) => invalidate().then(() => { throw err; })
        );
      };
    },
  });
}

// Db-level operations that change a collection without going through collection().
const DB_WRITE_OPS = new Set(['dropCollection', 'renameCollection', 'createCollection']);

function instrument(db) {
  if (!db || db.__unicoInstrumented) return db;
  return new Proxy(db, {
    get(target, prop) {
      if (prop === '__unicoInstrumented') return true;
      const v = target[prop];
      if (typeof v !== 'function') return v;
      if (prop === 'collection') {
        return function (name, ...rest) { return wrapCollection(v.call(target, name, ...rest), String(name)); };
      }
      if (DB_WRITE_OPS.has(prop)) {
        // createCollection hands back a Collection — wrap it, or every write made
        // through that reference would escape invalidation entirely.
        return function (name, ...rest) {
          const out = v.call(target, name, ...rest);
          return Promise.resolve(out).then((res) => bump(String(name)).then(
            () => (prop === 'createCollection' && res ? wrapCollection(res, String(name)) : res)
          ));
        };
      }
      return v.bind(target);
    },
  });
}

function snapshot() {
  return Object.assign({
    enabled: !DISABLED,
    pendingBumps: pendingBumps.size,
    freshMs: FRESH_MS, appdataMs: APPDATA_MS, revalidateMs: REVALIDATE_MS,
    staleMs: STALE_MS, localMs: LOCAL_MS,
  }, stats);
}

// Tests only.
function _reset() {
  L1.clear(); localVers.clear(); revalidating.clear(); pendingBumps.clear();
  Object.keys(stats).forEach((k) => { if (typeof stats[k] === 'number') stats[k] = 0; });
  stats.lastRescue = null;
}

module.exports = {
  read, readMany, warm, bump, flush, instrument, snapshot, _reset, CACHED_COLLECTIONS,
  FRESH_MS, APPDATA_MS, REVALIDATE_MS, STALE_MS, DISABLED,
};
