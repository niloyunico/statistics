/* Cookie-based session for the WEB edition's admin login portal.
 *
 * The desktop builds authenticate with a Bearer token (see /api/login in
 * index.js). The browser portal instead stores that same signed JWT in an
 * httpOnly cookie so the SERVER can gate the app shell ("/") and the data API
 * before any HTML is sent — a real login wall, not a client-side cosmetic gate.
 *
 * Because the cookie is same-origin, browser fetch() sends it automatically, so
 * the existing web-native.js persistence (PUT /api/data) keeps working with no
 * change once the user is signed in.
 *
 * The whole gate is a no-op unless REQUIRE_AUTH=true, preserving the default
 * "open local PC mode".
 */
const auth = require('./auth');

const COOKIE = 'unico_session';

function authRequired() {
  return String(process.env.REQUIRE_AUTH || '').toLowerCase() === 'true';
}

// Minimal Cookie-header parser (avoids pulling in cookie-parser for one cookie).
function parseCookies(req) {
  const out = {};
  const header = req.headers && req.headers.cookie;
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const i = pair.indexOf('=');
    if (i < 0) return;
    const k = pair.slice(0, i).trim();
    const v = pair.slice(i + 1).trim();
    if (k) { try { out[k] = decodeURIComponent(v); } catch (e) { out[k] = v; } }
  });
  return out;
}

// The login JWT, taken from the session cookie OR an Authorization: Bearer
// header (so the same gate serves both the browser portal and desktop clients).
function tokenFromReq(req) {
  const cookies = parseCookies(req);
  if (cookies[COOKIE]) return cookies[COOKIE];
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}

// Verified claims for the current request, or null if not signed in.
function userFromReq(req) {
  return auth.check(tokenFromReq(req));
}

// Parse TOKEN_TTL (e.g. '12h', '30m', '7d', or a bare number of seconds) to milliseconds so
// the cookie lifetime tracks the JWT expiry instead of a hardcoded 12h that could drift.
function ttlMs() {
  const raw = String(process.env.TOKEN_TTL || '12h').trim();
  const m = raw.match(/^(\d+)\s*([smhd]?)$/i);
  if (!m) return 12 * 60 * 60 * 1000;
  const n = parseInt(m[1], 10);
  const unit = (m[2] || 's').toLowerCase();
  const mult = unit === 'd' ? 86400 : unit === 'h' ? 3600 : unit === 'm' ? 60 : 1;
  return n * mult * 1000;
}

function setSession(res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true',
    maxAge: ttlMs(), // track the configured token TTL (default 12h)
    path: '/',
  });
}

function clearSession(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

/* SLIDING RENEWAL — keep an ACTIVE user signed in.
 *
 * The token was issued once at login with a fixed TTL (default 12h) and never
 * refreshed, so the session died a fixed number of hours after sign-in no matter how
 * hard someone was working. Mid-shift that shows up as the red "your session has
 * expired — recent changes are not being saved" banner, which is alarming and, for
 * someone who has been typing all morning, arrives without warning.
 *
 * So: once a request arrives in the SECOND HALF of the token's life, re-issue it. An
 * account in daily use is never signed out; only real inactivity (a full TTL with no
 * request) ends the session, which is what an idle timeout should mean.
 *
 * Two things this deliberately does NOT change:
 *   - `ep` is carried across verbatim, so a revoked account (password reset, role or
 *     permission change, deactivation) stays revoked. access.forRequest() compares it
 *     against the live user document and will reject the renewed token exactly as it
 *     rejected the old one.
 *   - Bearer clients are left alone; they hold their own token and renew by logging in.
 */
const RENEW_AFTER = 0.5;      // past halfway through the token's life

function maybeRenew(req, res, claims) {
  try {
    if (!claims || !claims.exp || !claims.iat) return;
    // Cookie sessions only — a Bearer caller has no cookie to update.
    if (!parseCookies(req)[COOKIE]) return;
    const life = Number(claims.exp) - Number(claims.iat);
    if (!(life > 0)) return;
    const age = Math.floor(Date.now() / 1000) - Number(claims.iat);
    if (age < life * RENEW_AFTER) return;                 // still fresh, leave it be
    if (res.headersSent) return;
    setSession(res, auth.sign({
      username: claims.sub, role: claims.role, name: claims.name, sessionEpoch: claims.ep,
    }));
  } catch (e) { /* a failed renewal must never break the request */ }
}

// API gate: 401 JSON when login is required and the request isn't authenticated.
function requireApi(req, res, next) {
  if (!authRequired()) { req.user = null; return next(); }
  const claims = userFromReq(req);
  if (!claims) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  maybeRenew(req, res, claims);
  req.user = claims;
  next();
}

// Page gate: redirect unauthenticated browsers to the login portal.
function requirePage(req, res, next) {
  if (!authRequired()) { req.user = null; return next(); }
  const claims = userFromReq(req);
  if (!claims) return res.redirect(302, '/login');
  maybeRenew(req, res, claims);
  req.user = claims;
  next();
}

module.exports = {
  COOKIE, authRequired, tokenFromReq, userFromReq,
  setSession, clearSession, requireApi, requirePage, maybeRenew,
};
