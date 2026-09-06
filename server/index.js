/* UNICO auth server.
   The desktop app sends { username, password } here; this server verifies it
   against the (bcrypt-hashed) users in MongoDB and returns a short-lived token.
   The MongoDB connection string lives ONLY on this server (in .env), never in
   the distributed app. */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const { getUsers, getAppData, setAppData, usingMongo } = require('./db');
const activity = require('./activity-log');
const audit = require('./audit');
// Recently-logged save descriptions, so a debounced form does not file the same
// sentence twice a second. Key: "<user>|<detail>" -> timestamp.
const SAVE_SEEN = new Map();
const auth = require('./auth');
const session = require('./session');
const access = require('./access');
const throttle = require('./login-throttle');
const redis = require('./redis');
const cache = require('./cache');
const warmup = require('./warmup');
const lb = require('./loadbalancer');

const app = express();
// gzip/brotli every response. Registered FIRST so it wraps the inlined index.html
// (~157 KB of DB-snapshot JSON), the app bundle, and every /api payload. Transparent
// Accept-Encoding negotiation; the default 1 KB threshold skips tiny health/login JSON.
app.use(compression());

// --- Security headers ---------------------------------------------------------
// Hand-rolled rather than pulling in helmet: it is a dozen static headers and this
// server ships to Vercel, where a smaller dependency tree is worth more than the
// abstraction. Every asset the app loads is same-origin (React, jsPDF, fonts and the
// bundle are all vendored locally), so a tight CSP costs nothing. 'unsafe-inline' for
// scripts is unavoidable: serveIndex() injects window.__UNICO_SNAPSHOT__ inline.
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');       // no MIME sniffing
  res.set('X-Frame-Options', 'DENY');                 // legacy clickjacking guard
  res.set('Referrer-Policy', 'no-referrer');          // never leak patient URLs outward
  res.set('Cross-Origin-Opener-Policy', 'same-origin');
  res.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=()');
  res.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",              // inline snapshot inject
    "style-src 'self' 'unsafe-inline'",
    // Photos live on the Cloudinary CDN (server/storage.js uploads them there and the
    // database only stores the url), so the CDN host MUST be allowed here or every
    // staff photo and account avatar is blocked by the browser while curl fetches it
    // happily — and a blocked <img> silently renders its alt text, which reads as
    // "the wrong picture is showing" rather than "the image was refused".
    // res.cloudinary.com only: no wildcard, so this opens nothing else.
    "img-src 'self' data: blob: https://res.cloudinary.com",   // + charts / PDF rasterisation
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self' blob:",                        // html2canvas / jsPDF
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",                         // the modern clickjacking guard
  ].join('; '));
  // HSTS only where the site is actually served over TLS, so it can't strand a
  // plain-http://localhost install (COOKIE_SECURE tracks the same fact).
  if (String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true') {
    res.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
});

app.use(express.json({ limit: '12mb' })); // app-state snapshots can be sizable

// Record every successful WRITE on /api/* to the Activity Log (see server/audit.js:
// reads are skipped, bodies are never stored, repeats collapse). Registered before
// any route so nothing can slip in underneath it; it reads req.user at response
// time, after the route's own session guard has resolved the caller.
app.use(audit.middleware);

// Cross-origin access. The default was '*' — with a Bearer token that let any site's
// script call this API on a user's behalf. When login is required, default to
// same-origin only (no CORS header at all) unless ALLOWED_ORIGINS names real origins.
const origins = String(process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const openCors = origins.includes('*');
if (openCors && String(process.env.REQUIRE_AUTH || '').toLowerCase() === 'true') {
  console.warn('[unico] ALLOWED_ORIGINS=* with REQUIRE_AUTH=true — any website could call this API with a stolen token. Set it to your real origin(s).');
}
if (origins.length) {
  // credentials stays OFF: the session cookie must never be readable cross-origin.
  app.use(cors({ origin: openCors ? true : origins, credentials: false }));
}

// Health/diagnostic — lets the app show "server reachable" and which store is active.
//
// Also the endpoint to point an external uptime pinger at (see DEPLOY.md): it performs
// a real database round trip, so a ping every few minutes keeps BOTH the serverless
// instance and the Atlas cluster warm, and the numbers below make a slow morning
// diagnosable instead of a mystery — dbMs is the actual query latency, `warmup` says
// whether the circuit breaker has had to step in, and `cache` shows how many requests
// were answered without touching Mongo at all (and how many outages it papered over).
app.get('/api/health', async (req, res) => {
  const t0 = Date.now();
  let db = 'unknown', dbMs = null, error = null;
  try {
    const u = await getUsers();
    await u.countDocuments();
    db = usingMongo() ? 'mongodb' : 'in-memory (dev)';
    dbMs = Date.now() - t0;
  } catch (e) {
    db = 'error';
    error = String(e.message || e);
  }
  const body = {
    ok: db !== 'error', db, dbMs,
    redis: redis.status(), warmup: warmup.status(), cache: cache.snapshot(), load: lb.status(),
  };
  if (error) body.error = error;
  res.set('Cache-Control', 'no-store');
  // Still 500 on a database failure, exactly as before, so existing checks keep working.
  res.status(body.ok ? 200 : 500).json(body);
});

// Login: returns a signed token + safe user info on success.
app.post('/api/login', async (req, res) => {
  const username = String((req.body && req.body.username) || '').trim().toLowerCase();
  const password = String((req.body && req.body.password) || '');
  if (!username || !password) return res.status(400).json({ ok: false, error: 'Username and password are required.' });
  // Same brute-force counter as the browser portal (see login-throttle.js): this
  // endpoint used to be unthrottled, so passwords could be guessed here without limit.
  const key = throttle.keyOf(req, username);
  const wait = await throttle.blockedFor(key);
  if (wait > 0) {
    res.set('Retry-After', String(wait));
    return res.status(429).json({ ok: false, error: 'Too many failed attempts. Try again in about ' + Math.ceil(wait / 60) + ' minute(s).' });
  }
  try {
    const users = await getUsers();
    const user = await users.findOne({ username });
    const valid = user && user.active !== false && await auth.verify(password, user.passwordHash);
    if (!valid) {
      await throttle.noteFail(key);
      return res.status(401).json({ ok: false, error: 'Invalid username or password.' });
    }
    await throttle.clear(key); // success clears the counter
    const token = auth.sign(user);
    // Also drop an httpOnly session cookie so the browser portal is signed in
    // (desktop/Bearer clients simply ignore it and keep using the token).
    session.setSession(res, token);
    res.json({ ok: true, token, user: { username: user.username, name: user.name || user.username, role: user.role || 'User' } });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Server error. Is the database reachable?' });
  }
});

// Verify a stored token (the app calls this on startup to resume a session).
app.get('/api/me', async (req, res) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const claims = auth.check(token);
  if (!claims) return res.status(401).json({ ok: false });
  // A valid signature is no longer enough: the account may have been deactivated or
  // had its sessions revoked since the token was minted. access.forRequest() checks
  // the live user document, so a resumed desktop session dies with the permission.
  req.user = claims;
  const a = await access.forRequest(req).catch(() => null);
  if (!a) return res.status(401).json({ ok: false });
  res.json({
    ok: true,
    user: { username: claims.sub, name: claims.name, role: claims.role },
    // The client mirrors these into window.__UNICO_USER__ so the UI hides what the
    // server would refuse anyway (the server stays the authority either way).
    perms: a.unrestricted ? null : a.perms,
    staffScope: a.staffScope || 'all',
  });
});

// --- app data sync (the whole app state as one shared document) ---
// REQUIRE_AUTH=false (default) = local "PC software" mode: the data endpoints are
// open so the web shim can sync without a login wall. Set REQUIRE_AUTH=true to
// require a signed-in user (the admin login portal — see web.js / session.js).
// The gate accepts either the session cookie (browser portal) or a Bearer token
// (desktop builds).
const requireAuth = session.requireApi;

app.get('/api/data', requireAuth, access.attach, async (req, res) => {
  // Collectors never receive the shared app-state blob (it holds every department's
  // overlay incl. recorded values) — they get a scoped snapshot injected at "/".
  // No portal account receives the shared app-state blob — it is the whole hospital's
  // overlay. Naming one role here meant an in-charge was handed all of it.
  if (req.user && access.PORTAL_ROLES.indexOf(req.user.role) >= 0) return res.json({ ok: true, data: {}, updatedAt: 0 });
  try {
    const d = await getAppData();
    // Everyone else used to receive the ENTIRE blob — every module's overlay in one
    // response — regardless of their per-module access. Hand back only the keys this
    // session may read, with the staff roster narrowed to its own rows.
    const data = await access.scopeSnapshot(req.access, d.data);
    res.json({ ok: true, data, updatedAt: d.updatedAt });
  }
  catch (e) { res.status(500).json({ ok: false, error: 'Server error.' }); }
});

app.put('/api/data', requireAuth, access.attach, async (req, res) => {
  // Data COLLECTORS must never write the shared app-state doc. Their session carries
  // only a scoped, value-stripped copy of the quality overlay (see web.js), so
  // mirroring their localStorage back here would clobber the admin's full overlay.
  // Collectors persist real data through /api/submissions — accept and no-op here.
  if (req.user && access.PORTAL_ROLES.indexOf(req.user.role) >= 0) return res.json({ ok: true, skipped: true });
  const data = req.body && req.body.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return res.status(400).json({ ok: false, error: 'A data object is required.' });
  // The app state is a mirror of localStorage: a flat map of string->string. Enforce
  // that shape so a malformed/abusive payload can't bloat or corrupt the shared doc.
  const keys = Object.keys(data);
  if (keys.length > 5000) return res.status(413).json({ ok: false, error: 'Too many keys.' });
  for (const k of keys) {
    if (typeof data[k] !== 'string') return res.status(400).json({ ok: false, error: 'All values must be strings (localStorage snapshot).' });
  }
  try {
    // MERGE, never replace. A restricted session only ever received the modules it
    // may read, so mirroring its localStorage back verbatim would delete everything
    // else — and a department-scoped roster save would drop every other department's
    // staff. access.mergeAppData() starts from the stored document and lets this
    // session overwrite only what it is permitted to write.
    // Read-modify-write, so this needs BOTH flags:
    //   fresh    — skip the cache on the way in. A baseline even a few seconds out of
    //              date could silently discard an edit somebody else just saved.
    //   noRescue — and if the database cannot be read, do NOT fall back to the cached
    //              copy either. Merging a save against an outage-era snapshot is how
    //              an edit becomes a silent no-op (the field-level diff sees the stale
    //              value and writes nothing) or how a key gets dropped. Refusing is the
    //              honest answer: the browser keeps its copy and retries.
    let current;
    try {
      current = await getAppData({ fresh: true, noRescue: true });
    } catch (e) {
      res.set('Retry-After', '5');
      return res.status(503).json({ ok: false, error: 'The database is unavailable right now — nothing was saved. Your work is still in this browser; it will be saved automatically when the connection returns.' });
    }

    // A PARTIAL save carries only the keys that changed — the closing-tab flush sends
    // one of these, because a full 130 KB body cannot be delivered by a page that is
    // already going away. Absence must NOT read as deletion here (it does for a full
    // mirror), so rebuild the complete map first and let the normal merge run on it:
    // permission checks and row-level staff scoping apply exactly as they always do.
    let incoming = data;
    if (req.body && req.body.partial) {
      const removed = Array.isArray(req.body.removed) ? req.body.removed : [];
      incoming = Object.assign({}, (current && current.data) || {}, data);
      removed.forEach((k) => { if (typeof k === 'string') delete incoming[k]; });
    }

    const merged = await access.mergeAppData(req.access, incoming, current && current.data);
    // Pass the baseline we just read so only the keys that changed are written — see
    // setAppData(). Without it every save rewrote the whole blob and the last writer won.
    const r = await setAppData(merged, current && current.data);
    res.json({ ok: true, updatedAt: r.updatedAt });

    // Activity log. This is where almost every edit in the app lands -- staff records,
    // department statistics, quality indicators, roster rules -- so a bare
    // "app_data_saved" told an auditor nothing. Log one entry PER overlay key, naming
    // the records that were added, edited or removed. Done after the response so a slow
    // diff can never delay the save, and it is skipped when nothing actually changed
    // (the browser re-mirrors its whole localStorage on a debounce, so most calls write
    // nothing at all -- those used to fill the log with entries for non-events).
    try {
      const prev = (current && current.data) || {};
      const now = Date.now();
      const touched = [...(r.changedKeys || []), ...(r.removedKeys || [])];
      touched.slice(0, 8).forEach((k) => {
        const what = audit.describeChange(prev[k], merged[k]);
        if (what === 'no visible change') return;
        const label = audit.KEY_LABELS[k] || k;
        // The row prints "<target> — <detail>", so the label must not appear in both.
        const detail = what || 'updated';
        // Typing into a form saves on a debounce, so the same record can be written
        // several times a minute. Collapse an identical description from the same
        // person inside a minute; anything genuinely different is still its own entry.
        const dk = (req.user && req.user.sub ? req.user.sub : 'local') + '|' + detail;
        if (now - (SAVE_SEEN.get(dk) || 0) < 60000) return;
        SAVE_SEEN.set(dk, now);
        if (SAVE_SEEN.size > 500) SAVE_SEEN.forEach((ts, key) => { if (now - ts > 60000) SAVE_SEEN.delete(key); });
        activity.log(req, 'app_data_saved', { target: label, detail });
      });
    } catch (e) { /* the save already succeeded; logging is best-effort */ }
  }
  catch (e) { res.status(500).json({ ok: false, error: 'Server error.' }); }
});

if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`[unico-auth] listening on http://localhost:${PORT}  (store: ${usingMongo() ? 'mongodb' : 'in-memory dev'})`);
  });
}

module.exports = app;
