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

// API gate: 401 JSON when login is required and the request isn't authenticated.
function requireApi(req, res, next) {
  if (!authRequired()) { req.user = null; return next(); }
  const claims = userFromReq(req);
  if (!claims) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  req.user = claims;
  next();
}

// Page gate: redirect unauthenticated browsers to the login portal.
function requirePage(req, res, next) {
  if (!authRequired()) { req.user = null; return next(); }
  const claims = userFromReq(req);
  if (!claims) return res.redirect(302, '/login');
  req.user = claims;
  next();
}

module.exports = {
  COOKIE, authRequired, tokenFromReq, userFromReq,
  setSession, clearSession, requireApi, requirePage,
};
