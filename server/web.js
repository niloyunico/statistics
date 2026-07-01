/* UNICO Statistics Suite — Express WEB server ("PC software" edition).
 *
 * Turns the offline Electron desktop app into a plain web application you run on
 * your PC: it serves the exact same React renderer the desktop app used, but in
 * any browser, and persists ALL app state to MongoDB Atlas instead of a local
 * JSON file.
 *
 * How it stays a drop-in for the desktop build:
 *   - At "/" it injects window.__UNICO_SNAPSHOT__ (the app state, read from
 *     MongoDB) straight into index.html, so the page hydrates localStorage
 *     synchronously at startup — exactly like the desktop app did from its
 *     on-disk file (db:loadSync).
 *   - It also injects unico/web-native.js, a browser stand-in for the Electron
 *     "unicoNative" bridge. The renderer's existing db-mirror code then persists
 *     every change back to MongoDB through PUT /api/data — unchanged.
 *
 * Run:   npm --prefix server run web        (or:  node server/web.js)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
// Many home/ISP routers can't resolve mongodb+srv:// SRV records; force public DNS.
try { require('dns').setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']); } catch (e) { /* ignore */ }

const express = require('express');
const fs = require('fs');
const app = require('./index'); // the existing API app (login / me / data / health)
const {
  getAppData, getDepartments, getStaff, getQuality, getUsers,
  ensureDepartmentsSeeded, ensureRendererSeeded, usingMongo, getDbHandle,
} = require('./db');
const auth = require('./auth');
const session = require('./session');
const dataCollection = require('./data-collection');

// Parse login-form posts (the portal uses a plain HTML form, no JS required).
app.use(express.urlencoded({ extended: false }));

const RENDERER = path.join(__dirname, '..', 'renderer');
const INDEX_FILE = path.join(RENDERER, 'index.html');

// U+2028 / U+2029 are legal in JSON strings but illegal raw in JS string literals;
// built via fromCharCode so this source file stays pure ASCII.
const LS = new RegExp(String.fromCharCode(0x2028), 'g');
const PS = new RegExp(String.fromCharCode(0x2029), 'g');

// Escape a value for safe inline-<script> embedding (stops "</script>" breakout).
function safeJSON(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(LS, '\\u2028')
    .replace(PS, '\\u2029');
}

// Serve "/" and "/index.html" with the live DB snapshot + web bridge injected.
async function serveIndex(req, res) {
  let html;
  try { html = fs.readFileSync(INDEX_FILE, 'utf8'); }
  catch (e) { return res.status(500).type('text').send('renderer/index.html not found'); }

  // Fetch all four datasets CONCURRENTLY — one wall-clock round-trip instead of four
  // serial ones, so the shell starts streaming sooner. Each query falls back
  // independently (.catch), preserving the per-dataset failure tolerance the previous
  // sequential try/catches had: a slow/unreachable query blanks only its own data.
  const [appRes, deptRes, staffRes, qualRes] = await Promise.all([
    getAppData().catch(() => null),           // DB unreachable -> empty snapshot
    getDepartments().catch(() => []),         // /api/departments reports the error
    getStaff().catch(() => []),
    getQuality().catch(() => []),
  ]);
  let snap = (appRes && appRes.data) || {};
  let depts = deptRes || [], staff = staffRes || [], quality = qualRes || [];

  // Resolve the signed-in user's scope. A "collector" gets a DATA-LIMITED view:
  // only their assigned departments + quality areas are injected (no staff / shared
  // app-state blob), so the SAME app shows each user only their own data.
  let scopeUser = null;
  try { if (req.user && req.user.sub) scopeUser = await dataCollection.getUserScope(req.user.sub); } catch (e) {}
  if (scopeUser && scopeUser.role === 'collector') {
    const da = scopeUser.departments || [], qa = scopeUser.qualityAreas || [];
    depts = depts.filter((d) => da.includes(d.id));
    quality = quality.filter((q) => qa.includes(q.key));
    staff = [];
    snap = {};
  }
  const userInject = scopeUser
    ? { username: scopeUser.username, name: scopeUser.name, role: scopeUser.role, departments: scopeUser.departments, qualityAreas: scopeUser.qualityAreas }
    : (req.user ? { username: req.user.sub, name: req.user.name, role: req.user.role } : null);

  // Inject the saved state + DB-backed datasets (scoped per user above). __UNICO_USER__
  // tells the app who is signed in; __UNICO_INITIAL_ROUTE__ lets /collect open the app
  // straight on the Data Collection section.
  const inject =
    '<script>window.__UNICO_SNAPSHOT__=' + safeJSON(snap) + ';' +
    'window.__UNICO_DEPARTMENTS__=' + safeJSON(depts) + ';' +
    'window.__UNICO_STAFF__=' + safeJSON(staff) + ';' +
    'window.__UNICO_QUALITY__=' + safeJSON(quality) + ';' +
    'window.__UNICO_USER__=' + safeJSON(userInject) + ';' +
    (req.unicoLanding ? 'window.__UNICO_INITIAL_ROUTE__=' + safeJSON(req.unicoLanding) + ';' : '') +
    '</script>\n' +
    '<script src="unico/web-native.js"></script>\n';

  // Inject BEFORE the vendored libs + inline db-bridge so window.unicoNative exists
  // when that bridge runs. Use a FUNCTION replacer: when the replacement is a
  // function, its return value is inserted verbatim, so "$" sequences ($&, $`, $',
  // $<name>) in the (DB-sourced, untrusted) snapshot are NOT interpreted as
  // String.replace patterns — which would otherwise splice unescaped page HTML into
  // the inline script and enable stored XSS.
  const anchor = html.includes('<!-- Vendored libraries') ? '<!-- Vendored libraries' : '</head>';
  html = html.replace(anchor, function () { return inject + anchor; });

  // When the login portal is active, add a small "Sign out" control so the
  // signed-in admin can end the session (clears the cookie via /logout).
  if (session.authRequired() && req.user) {
    const signOut = '<a href="/logout" title="Sign out" style="position:fixed;right:14px;bottom:12px;z-index:4000;'
      + 'font:600 11px/1 system-ui,Segoe UI,sans-serif;color:#5b6b80;background:rgba(255,255,255,.94);'
      + 'border:1px solid #e3e9f1;border-radius:8px;padding:7px 11px;text-decoration:none;'
      + 'box-shadow:0 2px 10px rgba(5,12,24,.12)">Sign out</a>\n';
    html = html.replace('</body>', function () { return signOut + '</body>'; });
  }
  res.set('Cache-Control', 'no-store'); // snapshot is per-request; never cache the shell
  res.type('html').send(html);
}

// --- Admin login portal (active only when REQUIRE_AUTH=true) -----------------
// A server-side gate: unauthenticated browsers are redirected to /login before
// any app HTML or data is sent. Login stores a signed JWT in an httpOnly cookie
// (see session.js); same-origin requests then carry it automatically.

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Branded, self-contained login page (no JS required; pure HTML form post).
function loginPage(opts) {
  const o = opts || {};
  const err = o.error
    ? '<div class="err">' + escapeHtml(o.error) + '</div>'
    : '<div class="err-spacer"></div>';
  const username = escapeHtml(o.username || '');
  const collect = o.portal === 'collect';
  const nextField = o.next ? '<input type="hidden" name="next" value="' + escapeHtml(o.next) + '"/>' : '';
  return '<!DOCTYPE html>\n'
    + '<html lang="en"><head>\n'
    + '<meta charset="UTF-8"/>\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>\n'
    + '<title>Sign in - UNICO Statistics Suite</title>\n'
    + '<link rel="stylesheet" href="/vendor/fonts/ibm-plex.css"/>\n'
    + '<style>\n'
    + '*{box-sizing:border-box}\n'
    + 'body{margin:0;font-family:"IBM Plex Sans",system-ui,Segoe UI,sans-serif;'
    + 'min-height:100vh;display:grid;place-items:center;padding:24px;'
    + 'background:#0d1b2e;background-image:radial-gradient(1100px 700px at 18% -10%,rgba(39,168,219,.16),transparent 60%),'
    + 'radial-gradient(900px 600px at 110% 120%,rgba(58,181,167,.14),transparent 55%);overflow:auto}\n'
    + '.card{position:relative;width:min(380px,94vw);background:#fff;border:1px solid #e3e9f1;'
    + 'border-radius:18px;padding:30px 30px 24px;box-shadow:0 24px 60px rgba(5,12,24,.55);'
    + 'display:flex;flex-direction:column;align-items:center;text-align:center}\n'
    + '.logo{height:38px;margin-bottom:16px}\n'
    + '.badge{width:52px;height:52px;border-radius:14px;display:grid;place-items:center;'
    + 'background:linear-gradient(135deg,#27a8db,#0072a3);box-shadow:0 8px 20px rgba(0,144,202,.45);margin-bottom:14px}\n'
    + 'h1{margin:0 0 6px;font-size:18px;font-weight:700;color:#16202e}\n'
    + '.sub{margin:0 0 18px;font-size:12.5px;line-height:1.5;color:#6c7a8c;max-width:300px}\n'
    + '.grp{width:100%;display:flex;flex-direction:column;gap:5px;margin-bottom:11px;text-align:left}\n'
    + 'label{font-size:11.5px;font-weight:600;color:#3c4858}\n'
    + 'input{width:100%;padding:11px 13px;border:1px solid #dde3ec;border-radius:9px;'
    + 'font-family:inherit;font-size:14px;background:#f7f9fc;color:#16202e;outline:none}\n'
    + 'input:focus{border-color:#27a8db;background:#fff}\n'
    + '.btn{width:100%;margin-top:6px;padding:11px 13px;border:0;border-radius:9px;cursor:pointer;'
    + 'font-family:inherit;font-size:13.5px;font-weight:700;color:#fff;'
    + 'background:linear-gradient(135deg,#27a8db,#0072a3);box-shadow:0 8px 20px rgba(0,144,202,.35)}\n'
    + '.btn:hover{filter:brightness(1.05)}\n'
    + '.err{width:100%;min-height:18px;margin:2px 0 8px;font-size:12px;font-weight:600;color:#b4232f;'
    + 'background:rgba(210,58,82,.10);border:1px solid rgba(210,58,82,.3);border-radius:8px;padding:7px 10px}\n'
    + '.err-spacer{min-height:18px;margin:2px 0 8px}\n'
    + '.legal{margin-top:18px;font-size:10.5px;letter-spacing:.4px;color:#9aa6b4}\n'
    + '</style></head><body>\n'
    + '<form class="card" method="POST" action="/login" autocomplete="on">\n'
    + '<img class="logo" src="/unico/logo.svg" alt="UNICO Healthcare"/>\n'
    + '<div class="badge"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" '
    + 'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M12 12a4 4 0 100-8 4 4 0 000 8z"/><path d="M4 21a8 8 0 0116 0"/></svg></div>\n'
    + '<h1>' + (collect ? 'Data Collection sign in' : 'Sign in') + '</h1>\n'
    + '<p class="sub">' + (collect ? 'Sign in with your Emp ID and password to submit your department&#39;s data.' : 'Sign in to the UNICO Statistics Suite.') + '</p>\n'
    + err + '\n'
    + nextField
    + '<div class="grp"><label for="u">' + (collect ? 'Emp ID' : 'Username') + '</label>'
    + '<input id="u" name="username" value="' + username + '" autocomplete="username" placeholder="' + (collect ? 'e.g. rabbi.miah' : 'Your username') + '" autofocus/></div>\n'
    + '<div class="grp"><label for="p">Password</label>'
    + '<input id="p" name="password" type="password" autocomplete="current-password" placeholder="Enter your password"/></div>\n'
    + '<button class="btn" type="submit">Sign in</button>\n'
    + '<div class="legal">UNICO Healthcare - Statistics Suite - Secure sign-in</div>\n'
    + '</form></body></html>';
}

// Only allow same-origin relative redirect targets (no open-redirects).
function safeNext(n) { return (typeof n === 'string' && /^\/[A-Za-z0-9/_-]*$/.test(n)) ? n : ''; }

app.get('/login', function (req, res) {
  if (!session.authRequired()) return res.redirect(302, '/'); // portal disabled -> open mode
  const next = safeNext(req.query && req.query.next);
  if (session.userFromReq(req)) return res.redirect(302, next || '/'); // already signed in
  res.set('Cache-Control', 'no-store');
  res.type('html').send(loginPage({ portal: req.query && req.query.portal, next }));
});

app.post('/login', async function (req, res) {
  if (!session.authRequired()) return res.redirect(302, '/');
  const username = String((req.body && req.body.username) || '').trim().toLowerCase();
  const password = String((req.body && req.body.password) || '');
  const next = safeNext(req.body && req.body.next);
  const portal = next === '/collect' ? 'collect' : undefined;
  if (!username || !password) {
    return res.status(400).type('html').send(loginPage({ error: 'Enter your username and password.', username, next, portal }));
  }
  try {
    const users = await getUsers();
    const user = await users.findOne({ username });
    const valid = user && user.active !== false && await auth.verify(password, user.passwordHash);
    if (!valid) return res.status(401).type('html').send(loginPage({ error: 'Invalid username or password.', username, next, portal }));
    session.setSession(res, auth.sign(user));
    // Honor an explicit return target; else collectors land on /collect, admins on the app.
    res.redirect(302, next || ((user.role === 'collector') ? '/collect' : '/'));
  } catch (e) {
    res.status(500).type('html').send(loginPage({ error: 'Server error. Is the database reachable?', username, next, portal }));
  }
});

app.get('/logout', function (req, res) {
  session.clearSession(res);
  res.redirect(302, '/login');
});

app.get('/', session.requirePage, serveIndex);
app.get('/index.html', session.requirePage, serveIndex);
// One shareable data-collection link: same URL for everyone, lands each signed-in
// user on the Data Collection section scoped to their own assignments.
app.get('/collect', function (req, res) {
  // Logged-out visitors get the collector-branded sign-in and return here after.
  if (session.authRequired() && !session.userFromReq(req)) return res.redirect(302, '/login?portal=collect&next=%2Fcollect');
  req.user = session.authRequired() ? session.userFromReq(req) : null;
  req.unicoLanding = { view: 'dcPatient' };
  return serveIndex(req, res);
});

// Read the DB-backed datasets as JSON — for external tools or a future client-side
// fetch. The renderer itself uses the injected globals.
app.get('/api/departments', session.requireApi, async (req, res) => {
  try { res.json({ ok: true, departments: await getDepartments() }); }
  catch (e) { res.status(500).json({ ok: false, error: 'Could not load departments.' }); }
});
app.get('/api/staff', session.requireApi, async (req, res) => {
  try { res.json({ ok: true, staff: await getStaff() }); }
  catch (e) { res.status(500).json({ ok: false, error: 'Could not load staff.' }); }
});
app.get('/api/quality', session.requireApi, async (req, res) => {
  try { res.json({ ok: true, quality: await getQuality() }); }
  catch (e) { res.status(500).json({ ok: false, error: 'Could not load quality indicators.' }); }
});

// Data Collection module: responsible persons + Google-form-style submissions
// (responsibles / submissions APIs). Self-contained; honors the same auth gate.
require('./data-collection').mount(app, { requireApi: session.requireApi });

// User Management module: admin-only account CRUD over the `users` collection.
require('./users-admin').mount(app, { requireApi: session.requireApi });

// All other renderer assets (jsx/js/css/svg/fonts) are static. index:false so our
// handler owns "/". The /api/* routes were registered by ./index before this.
// The app's own source (jsx/js/css) is transpiled in-browser by Babel, so it MUST
// NOT be cached — otherwise edits don't show until a manual hard-refresh. Mark those
// no-store (revalidated every load); large immutable vendor libs may still cache.
app.use(express.static(RENDERER, {
  index: false,
  setHeaders: function (res, filePath) {
    // The content-hashed app bundle (dist/app.bundle.js?v=<hash>) is immutable: any
    // change produces a new hash -> new URL, so cache it hard for a year. THIS is
    // what makes repeat loads instant (no re-download, and never any re-transpile).
    if (/[\\/]dist[\\/]/i.test(filePath)) {
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      return;
    }
    // Vendored libs (react/react-dom) and fonts are stable across deploys -> a week.
    if (/[\\/]vendor[\\/]/i.test(filePath)) {
      res.set('Cache-Control', 'public, max-age=604800');
      return;
    }
    // Everything else app-authored (theme.css, any unbundled .js/.jsx, html) carries
    // no version token, so keep it revalidated so edits show without a hard refresh.
    if (/\.(jsx|css|html|js)$/i.test(filePath)) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
  },
}));

// Fail fast: in login mode a missing/insecure JWT secret would let anyone forge
// tokens. (No-op in the default open local mode.)
if (String(process.env.REQUIRE_AUTH || '').toLowerCase() === 'true') {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'dev-secret-change-me') {
    console.error('\n  x REQUIRE_AUTH=true but JWT_SECRET is missing or the insecure default.');
    console.error('    Set a strong JWT_SECRET in server/.env before enabling login mode.\n');
    process.exit(1);
  }
}

const PORT = process.env.WEB_PORT || process.env.PORT || 8080;

function start() {
  // Warm the Mongo connection pool now so the first visitor doesn't pay the
  // SRV+TLS+topology handshake on the request path. Fire-and-forget: never blocks
  // listen, and is a harmless no-op in dev in-memory mode (getDbHandle -> null).
  getDbHandle().catch(() => { /* first real request will surface any DB error */ });
  const server = app.listen(PORT, () => {
    const authMode = String(process.env.REQUIRE_AUTH || '').toLowerCase() === 'true' ? 'login required' : 'open (local PC mode)';
    console.log('');
    console.log('  +---------------------------------------------------------+');
    console.log('  |   UNICO Statistics Suite - web edition is running       |');
    console.log('  +---------------------------------------------------------+');
    console.log('     Open:   http://localhost:' + PORT);
    console.log('     Store:  ' + (usingMongo() ? 'MongoDB Atlas (cloud)' : 'in-memory (DEV - NOT saved)'));
    console.log('     Auth:   ' + authMode);
    console.log('     Stop:   press Ctrl+C in this window');
    console.log('');
  });
  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error('\n  x Port ' + PORT + ' is already in use. Set WEB_PORT in server/.env to a free port and retry.\n');
    } else {
      console.error('\n  x Server error:', err && err.message ? err.message : err, '\n');
    }
    process.exit(1);
  });
}

// Auto-seed the DB-backed datasets on first boot (idempotent: each only inserts
// when its collection is empty), then start the server. Guarded by require.main so
// importing this module (e.g. as a Vercel serverless function) registers all routes
// and exports the app WITHOUT binding a port or re-seeding on every cold start.
if (require.main === module) {
Promise.allSettled([
  ensureDepartmentsSeeded(),
  ensureRendererSeeded('staff'),
  ensureRendererSeeded('quality'),
])
  .then((results) => {
    results.forEach((r) => {
      if (r.status === 'fulfilled' && r.value && r.value.seeded) {
        const what = r.value.name || 'departments';
        console.log('\n  Seeded ' + r.value.seeded + ' ' + what + ' records into MongoDB (first run).');
      } else if (r.status === 'rejected') {
        console.warn('\n  (auto-seed skipped: ' + (r.reason && r.reason.message ? r.reason.message : r.reason) + ')');
      }
    });
  })
  .finally(start);
}

module.exports = app;
