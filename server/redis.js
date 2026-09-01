/* UNICO — minimal Redis client over the Upstash / Vercel-KV REST API.
 *
 * WHY REST AND NOT A NORMAL REDIS CLIENT
 * A serverless function instance is created and destroyed constantly. A TCP Redis
 * client would open a socket on every cold start (handshake + AUTH before the first
 * command) and leak it when the instance is frozen, so a busy deploy would sit on
 * hundreds of half-dead connections — exactly the failure mode we already fight with
 * MongoDB's pool. The REST API is a plain HTTPS POST: no connection state, nothing to
 * leak, and it works identically on Vercel, on the PC server and in tests.
 *
 * WHY NO npm PACKAGE
 * @upstash/redis would be one more dependency to keep in sync in server/package.json
 * and in the Vercel build. The wire format is three lines of JSON, so this file speaks
 * it directly and stays dependency-free. It also lets the SAME module fall back to an
 * in-process store when no Redis is configured, so every caller can be written once
 * and still run on a laptop with nothing installed.
 *
 * Configure with EITHER naming (both are accepted, first match wins):
 *   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN   (Upstash console)
 *   KV_REST_API_URL        / KV_REST_API_TOKEN          (Vercel Marketplace / KV)
 *   REDIS_REST_URL         / REDIS_REST_TOKEN           (anything else REST-compatible)
 * Unset => the in-memory fallback. Nothing breaks; the cache is simply per-instance.
 *
 * NOTHING HERE MAY EVER BLOCK THE APP. Every call is bounded by REDIS_TIMEOUT_MS and
 * every failure resolves to a fallback value, never a rejection: a Redis outage must
 * degrade the app to "reads MongoDB directly", never to an error page.
 */

// A mistyped number in the environment must not silently disable a safety feature:
// parseInt('1h') is NaN, and every comparison against NaN is false. Fall back instead.
function intEnv(name, dflt) {
  const n = parseInt(process.env[name], 10);
  return Number.isFinite(n) ? n : dflt;
}

// Upstash in the same region answers in ~5-20ms. 700ms is already enormously
// generous, and it bounds how much a degraded Redis can add to a request: this
// timeout is paid on each step of a cache miss, so a large value is a latency bug.
const TIMEOUT_MS = intEnv('REDIS_TIMEOUT_MS', 700);
// Consecutive transport failures before we stop trying for a while. Without this a
// dead Redis endpoint would add its full timeout to EVERY request.
const FAIL_LIMIT = intEnv('REDIS_FAIL_LIMIT', 3);
const FAIL_COOLDOWN_MS = intEnv('REDIS_FAIL_COOLDOWN_MS', 30000);
const MEM_MAX_KEYS = 2000;

const stats = { calls: 0, errors: 0, fails: 0, mutedUntil: 0, lastError: null };

function creds() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || process.env.REDIS_REST_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || process.env.REDIS_REST_TOKEN || '';
  if (!url || !token) return null;
  return { url: String(url).replace(/\/+$/, ''), token: String(token) };
}

// Is a real Redis configured (as opposed to the in-memory stand-in)?
function configured() { return !!creds(); }
// Are we actually talking to it right now? False while muted after repeated failures.
function live() { return configured() && Date.now() >= stats.mutedUntil; }

/* ---- in-memory stand-in ------------------------------------------------------
   Implements the same command subset so cache.js never needs to know which driver is
   behind it. Per-process, so on Vercel it only helps a warm instance — which is still
   worth having: it removes the Redis round trip from repeat requests on that instance. */
const mem = new Map();

function memReap() {
  const now = Date.now();
  for (const [k, e] of mem) if (e.exp && e.exp <= now) mem.delete(k);
  // Hard cap so a long-running PC server can never grow this without bound.
  while (mem.size > MEM_MAX_KEYS) mem.delete(mem.keys().next().value);
}
function memGet(k) {
  const e = mem.get(k);
  if (!e) return null;
  if (e.exp && e.exp <= Date.now()) { mem.delete(k); return null; }
  return e.v;
}
function memSet(k, v, exp) {
  mem.delete(k);
  mem.set(k, { v: String(v), exp: exp || 0 });
  if (mem.size > MEM_MAX_KEYS) memReap();
}

// Execute one command against the in-memory store. Mirrors real Redis return values
// (null for a missing key, "OK" for SET, the new number for INCR) so the two drivers
// are interchangeable from the caller's point of view.
function memExec(args) {
  const op = String(args[0] || '').toUpperCase();
  const now = Date.now();
  switch (op) {
    case 'PING': return 'PONG';
    case 'GET': return memGet(args[1]);
    case 'MGET': return args.slice(1).map(memGet);
    case 'DEL': { let n = 0; args.slice(1).forEach((k) => { if (mem.delete(k)) n++; }); return n; }
    case 'EXISTS': return memGet(args[1]) == null ? 0 : 1;
    case 'EXPIRE': case 'PEXPIRE': {
      const e = mem.get(args[1]);
      if (!e) return 0;
      const ms = (parseInt(args[2], 10) || 0) * (op === 'EXPIRE' ? 1000 : 1);
      e.exp = now + ms;
      return 1;
    }
    case 'TTL': {
      const e = mem.get(args[1]);
      if (!e) return -2;
      return e.exp ? Math.ceil((e.exp - now) / 1000) : -1;
    }
    case 'INCR': {
      const cur = parseInt(memGet(args[1]) || '0', 10) || 0;
      const e = mem.get(args[1]);
      memSet(args[1], cur + 1, e && e.exp);
      return cur + 1;
    }
    case 'SET': {
      let px = 0, nx = false, xx = false;
      for (let i = 3; i < args.length; i++) {
        const o = String(args[i]).toUpperCase();
        if (o === 'PX') { px = parseInt(args[++i], 10) || 0; }
        else if (o === 'EX') { px = (parseInt(args[++i], 10) || 0) * 1000; }
        else if (o === 'NX') nx = true;
        else if (o === 'XX') xx = true;
      }
      const existing = memGet(args[1]);
      if (nx && existing != null) return null;     // NX: refuse when the key is taken
      if (xx && existing == null) return null;
      memSet(args[1], args[2], px ? now + px : 0);
      return 'OK';
    }
    default: return null;
  }
}

/* ---- REST transport ---------------------------------------------------------- */

function noteOk() { stats.fails = 0; stats.mutedUntil = 0; }
function noteFail(e) {
  stats.errors++; stats.fails++;
  stats.lastError = String((e && e.message) || e).slice(0, 200);
  if (stats.fails >= FAIL_LIMIT) stats.mutedUntil = Date.now() + FAIL_COOLDOWN_MS;
}

async function post(pathPart, body) {
  const c = creds();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(c.url + pathPart, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + c.token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      cache: 'no-store',   // never let a CDN or the platform cache a Redis response
    });
    if (!r.ok) throw new Error('redis http ' + r.status);
    return await r.json();
  } finally { clearTimeout(timer); }
}

/* ---- public API --------------------------------------------------------------
   Every function resolves; none reject. A caller that gets null simply treats it as
   "no cached answer" and goes to the database. */

// One command, reporting WHERE it ran.
//   { shared: true }  the real Redis every instance sees
//   { shared: false } the per-process stand-in, because Redis is absent or muted
//
// This distinction matters for mutations. cmd() below keeps the lenient "never
// reject" contract, which is right for reads — a failed GET is just a cache miss.
// But a failed INCR of an invalidation counter is NOT a cache miss: it means every
// OTHER instance will keep serving pre-write data and nobody would ever know.
// cache.js uses exec() so it can notice that and retry.
async function exec(args) {
  stats.calls++;
  if (!live()) return { shared: false, result: memExec(args) };
  try {
    const out = await post('', args.map(String));
    if (out && out.error) throw new Error(out.error);
    noteOk();
    return { shared: true, result: out ? out.result : null };
  } catch (e) { noteFail(e); return { shared: false, result: memExec(args) }; }
}

// One command. args e.g. ['GET','k'] or ['SET','k','v','PX',30000,'NX'].
async function cmd(args) { return (await exec(args)).result; }

// Several commands in ONE HTTP round trip; returns their results positionally.
// This is what keeps a cache lookup to a single network hop: value + version together.
async function pipelineExec(cmds) {
  if (!cmds || !cmds.length) return { shared: true, results: [] };
  stats.calls++;
  if (!live()) return { shared: false, results: cmds.map(memExec) };
  try {
    const out = await post('/pipeline', cmds.map((a) => a.map(String)));
    if (!Array.isArray(out)) throw new Error((out && out.error) || 'bad pipeline response');
    noteOk();
    return { shared: true, results: out.map((o) => (o && o.error ? null : (o ? o.result : null))) };
  } catch (e) { noteFail(e); return { shared: false, results: cmds.map(memExec) }; }
}

async function pipeline(cmds) { return (await pipelineExec(cmds)).results; }

const get = (k) => cmd(['GET', k]);
const del = (k) => cmd(['DEL', k]);
const incr = (k) => cmd(['INCR', k]);
const mget = (keys) => (keys && keys.length ? cmd(['MGET'].concat(keys)) : Promise.resolve([]));

// opts: { px: <ms>, nx: true }. Resolves to 'OK', or null when NX lost the race.
function set(k, v, opts) {
  const a = ['SET', k, v];
  if (opts && opts.px) a.push('PX', opts.px);
  if (opts && opts.nx) a.push('NX');
  return cmd(a);
}

function status() {
  return {
    driver: configured() ? 'rest' : 'memory',
    live: live(),
    calls: stats.calls,
    errors: stats.errors,
    mutedForMs: Math.max(0, stats.mutedUntil - Date.now()),
    lastError: stats.lastError,
  };
}

// Tests only: forget everything the in-memory driver holds.
function _resetMemory() { mem.clear(); stats.fails = 0; stats.mutedUntil = 0; }

module.exports = { cmd, exec, pipeline, pipelineExec, get, mget, set, del, incr, configured, live, status, _resetMemory };
