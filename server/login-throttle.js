/* UNICO — brute-force throttle for every credential-checking endpoint.
 *
 * Lifted out of web.js so the browser portal (POST /login) and the API
 * (POST /api/login, used by the desktop builds and by anything with curl) share
 * ONE counter. They previously did not: /login was throttled, /api/login was not,
 * so the same password could be guessed without limit through the API while the
 * portal locked out after 8 tries. A signed JWT is only as safe as the password
 * behind it.
 *
 * WHY THE COUNTER IS NOW SHARED THROUGH REDIS
 * An in-process Map is a real throttle on the PC server, where one process sees every
 * attempt. On Vercel it is barely a speed bump: each serverless instance keeps its own
 * Map, the platform spreads requests across as many instances as the traffic warrants,
 * and an attacker who simply keeps sending guesses gets a fresh allowance every time a
 * new instance is created. Eight attempts per instance, unlimited instances.
 *
 * So the count lives in Redis when Redis is configured, keyed by client IP + username,
 * and the local Map is kept as a fast path and as the fallback. The behaviour is
 * unchanged when no Redis is set up (PC server, dev, tests) — it is exactly the old
 * per-process throttle.
 *
 * Redis is never allowed to make the situation worse: a failure or timeout falls back
 * to the local decision, so a Redis outage can neither lock everyone out nor throw.
 *
 * Sliding window + temporary lockout; a successful login clears the counter.
 * The three lookup functions are ASYNC (they may consult Redis) — await them.
 */
const redis = require('./redis');

const MAX_FAILS = parseInt(process.env.LOGIN_MAX_FAILS || '8', 10);                    // failures before lockout
const WINDOW_MS = (parseInt(process.env.LOGIN_WINDOW_MIN || '15', 10)) * 60 * 1000;    // rolling window
const LOCK_MS = (parseInt(process.env.LOGIN_LOCK_MIN || '15', 10)) * 60 * 1000;        // lockout duration

const NS = 'unico:' + (process.env.DB_NAME || 'unico') + ':login:';
const countKey = (key) => NS + 'n:' + key;
// The lock stores the absolute moment it ends, so "how much longer?" needs no TTL call.
const lockKey = (key) => NS + 'x:' + key;

const fails = new Map(); // key -> { count, first, until }

// The throttle key must be something the CLIENT CANNOT CHOOSE. Trusting
// x-forwarded-for unconditionally breaks the throttle in both directions, and making
// the counter shared and durable made the second one much worse:
//   - bypass: send a random X-Forwarded-For per attempt and every guess lands on a
//     fresh key, so the limit is never reached;
//   - lockout: send a VICTIM's IP with their username and 8 bad passwords, and now
//     that lock is written to Redis and refuses them on EVERY instance in the fleet
//     for the full lockout, instead of evaporating with one process.
// So: on Vercel use the headers the platform sets itself (it overwrites these, a
// client cannot forge them); elsewhere use the socket address unless an operator has
// explicitly said there is a trusted proxy in front.
const TRUST_PROXY = String(process.env.TRUST_PROXY || '').toLowerCase() === 'true';

function ipOf(req) {
  const first = (v) => String(v || '').split(',')[0].trim();
  if (process.env.VERCEL) {
    const v = first(req.headers['x-vercel-forwarded-for']) || first(req.headers['x-real-ip']);
    if (v) return v;
  }
  if (TRUST_PROXY) {
    const f = first(req.headers['x-forwarded-for']);
    if (f) return f;
  }
  return (req.socket && req.socket.remoteAddress) || req.ip || 'ip';
}
function keyOf(req, username) { return ipOf(req) + '|' + (username || ''); }

// Local-only view of the lockout, in seconds. 0 = may try now.
function localBlockedFor(key) {
  const rec = fails.get(key);
  if (!rec) return 0;
  if (rec.until && rec.until > Date.now()) return Math.ceil((rec.until - Date.now()) / 1000);
  if (rec.first && Date.now() - rec.first > WINDOW_MS) { fails.delete(key); return 0; } // window expired
  return 0;
}

function localNoteFail(key) {
  const now = Date.now();
  const rec = fails.get(key) || { count: 0, first: now, until: 0 };
  if (now - rec.first > WINDOW_MS) { rec.count = 0; rec.first = now; } // reset the rolling window
  rec.count += 1;
  if (rec.count >= MAX_FAILS) rec.until = now + LOCK_MS;
  fails.set(key, rec);
  return rec;
}

/* ---- public API (async: may consult the shared counter) ---------------------- */

// Seconds the caller must wait, or 0 when they may try now.
async function blockedFor(key) {
  const local = localBlockedFor(key);
  if (local > 0) return local;                 // already locked here — no need to ask
  if (!redis.configured()) return 0;
  try {
    const until = parseInt(await redis.get(lockKey(key)), 10);
    if (!Number.isFinite(until) || until <= Date.now()) return 0;
    // Mirror ONLY the lock, never a synthetic failure count.
    //
    // Mirroring `count: MAX_FAILS` looks harmless and is not: clear() runs on the one
    // instance that handled the successful login, so every OTHER instance keeps the
    // fabricated count. The user signs in fine, and then a single typo minutes later
    // lands on one of those instances, takes the count from MAX_FAILS to MAX_FAILS+1
    // and re-locks them for the full lockout — on some instances but not others, so
    // refreshing sometimes works. Keeping count at 0 makes the mirror expire cleanly.
    const rec = fails.get(key) || { count: 0, first: Date.now(), until: 0 };
    rec.until = until;
    fails.set(key, rec);
    return Math.ceil((until - Date.now()) / 1000);
  } catch (e) { return 0; }                    // Redis trouble -> the local verdict stands
}

// Record one failed attempt.
async function noteFail(key) {
  const rec = localNoteFail(key);
  if (!redis.configured()) return;
  try {
    // INCR and the expiry in ONE pipeline, and the expiry EVERY time.
    //
    // The obvious shape — INCR, then `if (n === 1) SET key 1 PX window` — has two
    // real defects. It rewrites the counter back to 1, discarding any failure whose
    // INCR landed in between (a parallel guesser loses count for free). And INCR on a
    // missing key creates it with NO expiry, so if that one follow-up command is ever
    // dropped — a timeout, a 429, another request tripping the mute in between — the
    // key becomes immortal and monotonic, and once it passes the limit EVERY later
    // failed attempt re-arms a fresh lockout, permanently, for a legitimate user.
    // PEXPIRE on each failure is one round trip, cannot lose a count, and makes the
    // window slide — which for brute-force protection is the behaviour you want.
    const out = await redis.pipeline([
      ['INCR', countKey(key)],
      ['PEXPIRE', countKey(key), WINDOW_MS],
    ]);
    const n = Number(out && out[0]);
    if (Number.isFinite(n) && n >= MAX_FAILS) {
      const until = Date.now() + LOCK_MS;
      await redis.set(lockKey(key), String(until), { px: LOCK_MS });
      rec.until = until;
      fails.set(key, rec);
    }
  } catch (e) { /* the local counter still applies */ }
}

// A successful login clears both counters.
async function clear(key) {
  fails.delete(key);
  if (!redis.configured()) return;
  // One round trip, not two: this sits on the SUCCESSFUL login path, in front of the
  // session cookie, so every avoidable millisecond here is felt by every user.
  try { await redis.pipeline([['DEL', countKey(key)], ['DEL', lockKey(key)]]); } catch (e) { /* expires anyway */ }
}

// Occasional cleanup so the map can't grow unbounded on a long-lived server.
const _sweep = setInterval(() => {
  const now = Date.now();
  for (const [k, r] of fails) if ((!r.until || r.until < now) && (now - r.first) > WINDOW_MS) fails.delete(k);
}, 10 * 60 * 1000);
if (_sweep.unref) _sweep.unref(); // don't keep the process alive just for the sweep

module.exports = { ipOf, keyOf, blockedFor, noteFail, clear, MAX_FAILS, WINDOW_MS, LOCK_MS };
