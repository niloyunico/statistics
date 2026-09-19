/* UNICO — the read cache WITHOUT Redis ("mongo" mode of cache.js).
 *
 * WHY THIS EXISTS
 * Redis was removed (its authority flag caused split-brain writes), and with it the only
 * shared place the cache kept its version counters. The cache was then switched off
 * everywhere (CACHE_DISABLED=true), so every request re-read whole datasets from Atlas:
 * the ~280 KB app-state blob alone was read three or four times per page load and again
 * on every 30-second staff poll. From the hospital PC one such read costs 180-390 ms, and
 * the page shell waited ~1.6 s for its first byte.
 *
 * HOW IT STAYS CORRECT WITHOUT A SHARED VALUE STORE
 *   - VALUES live in this process only: a Map of the loaded objects, no encoding.
 *   - VERSIONS live in ONE tiny MongoDB document ({ _id: 'versions', appdata: n, ... })
 *     in the same database every instance already talks to — each Vercel function AND
 *     the PC server. A cached value is served only while the version it was built from
 *     is still the version in that document.
 *   - Every write through the instrumented Db handle (cache.instrument) $incs its
 *     collection's counter AFTER the write lands and BEFORE the caller continues, so the
 *     next lookup anywhere sees the new number and reloads.
 * A lookup therefore costs one read of a few dozen bytes instead of the dataset itself.
 * Concurrent lookups share one in-flight version read — but never one that started
 * before a write made by this process (bumpSeq), so "save, then reload" always reloads.
 *
 * ONLY TRACKED COLLECTIONS ARE CACHED. The list is fixed in code so every instance bumps
 * the same set: a collection some instance never happened to read must still be bumped
 * when it writes it, or the instances that did read it would keep serving the old copy.
 * A read of anything else goes straight to its loader.
 *
 * WHAT IT CANNOT SEE: writes that bypass the instrumented handle — a script with its own
 * MongoClient, an edit in the Atlas UI, a restore. Run `npm --prefix server run
 * cache:flush` after those; the fresh window (CACHE_TTL_MS) is the backstop.
 */
'use strict';

/* Only these are cached, and the list is FIXED IN CODE so every instance bumps the same
   set: an instance that never read a collection must still bump it when it writes, or
   the instances that did read it keep serving the old copy. A read of anything else goes
   straight to its loader — which is why adding a cache.read() elsewhere silently does
   nothing until its collection is named here (staff-performance.js's registers were
   exactly that case). */
const DEFAULT_TRACKED = ['appdata', 'departments', 'staff', 'qualityFormulas', 'users',
  // Personal-file registers (server/staff-performance.js). Safe to cache because every
  // write there goes through getDbHandle(), whose proxy bumps the version before the
  // caller continues, and read-modify-write paths pass { fresh: true }.
  'staffAppraisals', 'staffIncidents', 'staffAchievements', 'staffExits', 'staffPerfCategories'];

const toInt = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; };
const numOr = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const collOf = (spec) => spec.coll || spec.name;

// ctx: { stats, pendingBumps, FRESH_MS, STALE_MS, REVALIDATE_MS, BUMP_TIMEOUT_MS,
//        versionCheckMs?, tracked? } — shared with cache.js so /api/health reports one
// set of counters whichever mode is running.
function create(ctx) {
  const stats = ctx.stats;
  const pendingBumps = ctx.pendingBumps;
  const TRACKED = new Set(ctx.tracked || DEFAULT_TRACKED);
  // Optional reuse window for a version read. 0 (the default) means every lookup that
  // is not joining an in-flight read asks the database: on Vercel that is ~10 ms, and
  // any window is a window in which another instance's save is invisible here.
  const VERSION_CHECK_MS = Math.max(0, numOr(ctx.versionCheckMs, 0));

  let store = null;                 // { read(): Promise<doc>, incr(colls): Promise<doc> }
  const entries = new Map();        // name -> { val, ver, at, coll }
  const loading = new Map();        // name -> { ver, promise }
  const revalidating = new Set();
  const floor = new Map();          // coll -> highest version this process has seen
  let bumpSeq = 0;                  // local writes so far; an in-flight read older than one is not reused
  let inflight = null;              // { seq, promise }
  let last = null;                  // { seq, at, doc }

  function noteVersions(doc) {
    if (doc && typeof doc === 'object') {
      TRACKED.forEach((c) => { const n = toInt(doc[c]); if (n > (floor.get(c) || 0)) floor.set(c, n); });
    }
    return doc || {};
  }
  // Never below what this process has already seen: an $inc it performed must not be
  // undone by a version read that happened to start just before it.
  const verOf = (doc, coll) => Math.max(toInt(doc && doc[coll]), floor.get(coll) || 0);

  function readVersions() {
    const now = Date.now();
    if (VERSION_CHECK_MS > 0 && last && last.seq === bumpSeq && (now - last.at) < VERSION_CHECK_MS) {
      return Promise.resolve(last.doc);
    }
    if (inflight && inflight.seq === bumpSeq) return inflight.promise;
    const seq = bumpSeq;
    const promise = Promise.resolve().then(() => store.read()).then((doc) => {
      stats.versionReads++;
      noteVersions(doc);
      last = { seq, at: Date.now(), doc: doc || {} };
      return doc || {};
    });
    inflight = { seq, promise };
    const clear = () => { if (inflight && inflight.promise === promise) inflight = null; };
    promise.then(clear, clear);
    return promise;
  }

  // Versions for a set of datasets, plus whatever this process holds for them. A version
  // that could not be read is NaN, which equals nothing: the entry cannot be proven
  // current, so it is never a hit — though it may still rescue an outage.
  async function lookup(specs) {
    let doc = null;
    try {
      const retry = [...pendingBumps].filter((c) => TRACKED.has(c));
      if (retry.length) {
        noteVersions(await store.incr(retry));
        retry.forEach((c) => pendingBumps.delete(c));
      }
      doc = await readVersions();
    } catch (e) {
      stats.versionFails++;
      stats.lastVersionError = String((e && e.message) || e).slice(0, 200);
      doc = null;
    }
    const found = new Map();
    specs.forEach((s) => found.set(s.name, { entry: entries.get(s.name) || null, ver: doc ? verOf(doc, collOf(s)) : NaN }));
    return found;
  }

  function put(name, coll, val, ver) {
    const cur = entries.get(name);
    // A load that started earlier must not overwrite one built from a newer version.
    if (cur && Number.isFinite(cur.ver) && Number.isFinite(ver) && cur.ver > ver) return;
    entries.set(name, { val, ver, at: Date.now(), coll });
  }

  function rescue(entry) {
    stats.rescues++;
    stats.lastRescue = new Date().toISOString();
    return entry.val;
  }

  // Refresh a version-current entry past its fresh window without making anyone wait.
  function revalidate(spec, ver) {
    const name = spec.name;
    if (revalidating.has(name)) return;
    revalidating.add(name);
    Promise.resolve()
      .then(() => spec.loader())
      .then((val) => { put(name, collOf(spec), val, ver); stats.revalidated++; })
      .catch(() => { stats.revalidateFails++; })
      .then(() => { revalidating.delete(name); });
  }

  async function resolve(spec, found) {
    const name = spec.name;
    const coll = collOf(spec);
    const freshMs = numOr(spec.freshMs, ctx.FRESH_MS);
    const staleMs = numOr(spec.staleMs, ctx.STALE_MS);
    const revalidateMs = numOr(spec.revalidateMs, ctx.REVALIDATE_MS);
    const now = Date.now();
    const entry = found.entry;
    const ver = found.ver;
    const current = !!entry && entry.ver === ver;
    const age = entry ? now - entry.at : Infinity;
    const rescuable = !!entry && age < staleMs;

    if (!spec.fresh && current && freshMs > 0) {
      if (age < freshMs) { stats.hits++; return entry.val; }
      if (age < freshMs + revalidateMs) { stats.swr++; revalidate(spec, ver); return entry.val; }
    }
    stats.misses++;

    // noRescue callers (a read-modify-write baseline) would rather fail loudly than
    // merge somebody's save into a copy from an outage.
    // markRescue: hand back a tagged shallow copy, so a caller that treats its data as
    // authoritative (the page shell) can tell an outage copy from a real read.
    const onError = (e) => {
      if (rescuable && !spec.noRescue) {
        const v = rescue(entry);
        return spec.markRescue && v && typeof v === 'object' && !Array.isArray(v)
          ? Object.assign({}, v, { rescued: true, rescuedFromAt: entry.at }) : v;
      }
      throw e;
    };

    // Single flight inside this process: join a load already running for the SAME
    // version. A load for an older version is not joined — a write has superseded it.
    // A `fresh` caller never joins anybody: guaranteeing its own read is its purpose.
    if (!spec.fresh && Number.isFinite(ver)) {
      const running = loading.get(name);
      if (running && running.ver === ver) {
        try { const val = await running.promise; stats.hits++; return val; }
        catch (e) { return onError(e); }
      }
    }

    const promise = Promise.resolve().then(() => spec.loader());
    const mine = { ver, promise };
    if (Number.isFinite(ver)) loading.set(name, mine);
    try {
      const val = await promise;
      // Stamped with the version read BEFORE the loader ran: a write landing meanwhile
      // bumps past it, so the next lookup rejects this copy instead of pinning it.
      put(name, coll, val, ver);
      stats.loads++;
      return val;
    } catch (e) {
      return onError(e);
    } finally {
      if (loading.get(name) === mine) loading.delete(name);
    }
  }

  async function readMany(specs) {
    const out = new Array(specs.length);
    const need = [];
    const direct = [];
    specs.forEach((s, i) => {
      if (TRACKED.has(collOf(s))) need.push({ i, s });
      else direct.push(Promise.resolve().then(() => s.loader()).then((v) => { out[i] = v; }));
    });
    const cached = need.length
      ? lookup(need.map((n) => n.s)).then((found) => Promise.all(need.map(async (n) => {
        out[n.i] = await resolve(n.s, found.get(n.s.name));
      })))
      : null;
    await Promise.all(cached ? direct.concat([cached]) : direct);
    return out;
  }

  function invalidateLocal(coll) {
    for (const e of entries.values()) if (e.coll === coll) e.ver = NaN;
  }

  // A write to `coll` has landed. Invalidate here at once, then move the shared counter
  // so every other instance reloads on its next lookup. Bounded: a save never waits long
  // on bookkeeping. A counter that did not move is remembered and replayed.
  async function bump(coll) {
    if (!store || !TRACKED.has(coll)) return;
    bumpSeq++;
    invalidateLocal(coll);
    const timedOut = Symbol('timeout');
    let timer = null;
    const job = Promise.resolve()
      .then(() => store.incr([coll]))
      .then((doc) => { noteVersions(doc); return true; },
        (e) => { stats.lastVersionError = String((e && e.message) || e).slice(0, 200); return false; });
    const outcome = await Promise.race([
      job,
      new Promise((r) => { timer = setTimeout(() => r(timedOut), ctx.BUMP_TIMEOUT_MS); if (timer.unref) timer.unref(); }),
    ]);
    clearTimeout(timer);
    // A slow $inc that lands after the timeout makes the replay a harmless extra bump.
    if (outcome !== true) {
      pendingBumps.add(coll);
      stats.lostBumps++;
      stats.lastLostBump = new Date().toISOString();
    }
  }

  // Manual invalidation (cache-flush CLI, after writes the proxy could not see).
  async function flush(list) {
    const colls = list.filter((c) => TRACKED.has(c));
    bumpSeq++;
    colls.forEach(invalidateLocal);
    if (!colls.length) return list.map((c) => ({ coll: c, shared: true, version: null }));
    try {
      const doc = noteVersions(await store.incr(colls));
      return list.map((c) => ({ coll: c, shared: true, version: TRACKED.has(c) ? toInt(doc[c]) : null }));
    } catch (e) {
      return list.map((c) => ({ coll: c, shared: false, error: String((e && e.message) || e).slice(0, 200) }));
    }
  }

  // Forget this process's copies of `coll` without touching the shared counter.
  function dropLocal(coll) {
    bumpSeq++;
    invalidateLocal(coll);
  }

  function snapshot() {
    const versions = {};
    floor.forEach((v, k) => { versions[k] = v; });
    return { tracked: [...TRACKED], entries: entries.size, versions, versionCheckMs: VERSION_CHECK_MS };
  }

  function reset() {
    entries.clear(); loading.clear(); revalidating.clear(); floor.clear();
    bumpSeq = 0; inflight = null; last = null;
  }

  return {
    setStore: (s) => { store = s || null; },
    hasStore: () => !!store,
    isTracked: (c) => TRACKED.has(c),
    readMany, bump, flush, dropLocal, snapshot, reset,
  };
}

module.exports = { create, DEFAULT_TRACKED };
