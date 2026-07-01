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
const auth = require('./auth');
const session = require('./session');

const app = express();
// gzip/brotli every response. Registered FIRST so it wraps the inlined index.html
// (~157 KB of DB-snapshot JSON), the app bundle, and every /api payload. Transparent
// Accept-Encoding negotiation; the default 1 KB threshold skips tiny health/login JSON.
app.use(compression());
app.use(express.json({ limit: '12mb' })); // app-state snapshots can be sizable

const origins = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.includes('*') ? true : origins }));

// Health/diagnostic — lets the app show "server reachable" and which store is active.
app.get('/api/health', async (req, res) => {
  let db = 'unknown';
  try { const u = await getUsers(); await u.countDocuments(); db = usingMongo() ? 'mongodb' : 'in-memory (dev)'; }
  catch (e) { return res.status(500).json({ ok: false, db: 'error', error: String(e.message || e) }); }
  res.json({ ok: true, db });
});

// Login: returns a signed token + safe user info on success.
app.post('/api/login', async (req, res) => {
  const username = String((req.body && req.body.username) || '').trim().toLowerCase();
  const password = String((req.body && req.body.password) || '');
  if (!username || !password) return res.status(400).json({ ok: false, error: 'Username and password are required.' });
  try {
    const users = await getUsers();
    const user = await users.findOne({ username });
    const valid = user && user.active !== false && await auth.verify(password, user.passwordHash);
    if (!valid) return res.status(401).json({ ok: false, error: 'Invalid username or password.' });
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
app.get('/api/me', (req, res) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const claims = auth.check(token);
  if (!claims) return res.status(401).json({ ok: false });
  res.json({ ok: true, user: { username: claims.sub, name: claims.name, role: claims.role } });
});

// --- app data sync (the whole app state as one shared document) ---
// REQUIRE_AUTH=false (default) = local "PC software" mode: the data endpoints are
// open so the web shim can sync without a login wall. Set REQUIRE_AUTH=true to
// require a signed-in user (the admin login portal — see web.js / session.js).
// The gate accepts either the session cookie (browser portal) or a Bearer token
// (desktop builds).
const requireAuth = session.requireApi;

app.get('/api/data', requireAuth, async (req, res) => {
  try { const d = await getAppData(); res.json({ ok: true, data: d.data, updatedAt: d.updatedAt }); }
  catch (e) { res.status(500).json({ ok: false, error: 'Server error.' }); }
});

app.put('/api/data', requireAuth, async (req, res) => {
  const data = req.body && req.body.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return res.status(400).json({ ok: false, error: 'A data object is required.' });
  // The app state is a mirror of localStorage: a flat map of string->string. Enforce
  // that shape so a malformed/abusive payload can't bloat or corrupt the shared doc.
  const keys = Object.keys(data);
  if (keys.length > 5000) return res.status(413).json({ ok: false, error: 'Too many keys.' });
  for (const k of keys) {
    if (typeof data[k] !== 'string') return res.status(400).json({ ok: false, error: 'All values must be strings (localStorage snapshot).' });
  }
  try { const r = await setAppData(data); res.json({ ok: true, updatedAt: r.updatedAt }); }
  catch (e) { res.status(500).json({ ok: false, error: 'Server error.' }); }
});

if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`[unico-auth] listening on http://localhost:${PORT}  (store: ${usingMongo() ? 'mongodb' : 'in-memory dev'})`);
  });
}

module.exports = app;
