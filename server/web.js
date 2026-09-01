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
// Skip on Vercel/AWS: the platform resolver is faster and always SRV-capable.
if (!process.env.VERCEL) {
  try { require('dns').setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']); } catch (e) { /* ignore */ }
}

const express = require('express');
const fs = require('fs');
const app = require('./index'); // the existing API app (login / me / data / health)
const {
  getAppData, getDepartments, getStaff, getQuality, getUsers,
  ensureDepartmentsSeeded, ensureRendererSeeded, usingMongo, getDbHandle,
} = require('./db');
const auth = require('./auth');
const session = require('./session');
const activity = require('./activity-log');
const access = require('./access');
const dataCollection = require('./data-collection');
const deptmap = require('./deptmap');
const qualityFormulas = require('./quality-formulas');
const keepalive = require('./keepalive');

// Parse login-form posts (the portal uses a plain HTML form, no JS required).
app.use(express.urlencoded({ extended: false }));

// ---- Local Python PDF bridge (localhost only) --------------------------------
// On Vercel the PDF is served by the @vercel/python function (api/report_pdf.py).
// Locally (`npm run web`) there is no Vercel router, so this route spawns the SAME
// Python script to generate the PDF, giving the localhost app real Python output
// instead of falling back to the in-browser JS exporter. Needs Python on PATH with
// `pip install reportlab` (and pymongo only if you POST Mongo-reading params).
// Set PYTHON_BIN to override the interpreter; the browser posts a resolved model so
// no MongoDB access is required for this path.
if (!process.env.VERCEL) {
  const { spawn } = require('child_process');
  const PY_SCRIPT = path.join(__dirname, '..', 'api', 'report_pdf.py');
  // Prefer the project venv (created with `python -m venv .pyenv` + reportlab) so the
  // bridge works out of the box; else PYTHON_BIN; else the system `python`.
  const VENV_PY = process.platform === 'win32'
    ? path.join(__dirname, '..', '.pyenv', 'Scripts', 'python.exe')
    : path.join(__dirname, '..', '.pyenv', 'bin', 'python');
  const PY_BIN = process.env.PYTHON_BIN || (fs.existsSync(VENV_PY) ? VENV_PY : 'python');
  console.log('[pdf] Python bridge active at POST /api/report-pdf  (python: ' + PY_BIN + ')');
  // Health probe — visit http://localhost:8080/api/report-pdf in a browser to confirm
  // the bridge loaded. If you see the app HTML instead of this JSON, restart the server.
  app.get('/api/report-pdf', (req, res) => {
    res.json({ ok: true, engine: 'python-bridge', python: PY_BIN, ready: PY_BIN === 'python' || fs.existsSync(PY_BIN) });
  });
  app.post('/api/report-pdf', express.json({ limit: '48mb' }), (req, res) => {
    const bin = PY_BIN;
    let cp;
    try { cp = spawn(bin, [PY_SCRIPT], { cwd: path.join(__dirname, '..') }); }
    catch (e) { return res.status(500).json({ error: 'python spawn failed: ' + e.message }); }
    const chunks = []; let err = '';
    cp.stdout.on('data', (d) => chunks.push(d));
    cp.stderr.on('data', (d) => { err += d.toString(); });
    cp.on('error', (e) => { if (!res.headersSent) res.status(500).json({ error: 'python not found (set PYTHON_BIN): ' + e.message }); });
    cp.on('close', (code) => {
      const buf = Buffer.concat(chunks);
      if (code === 0 && buf.slice(0, 5).toString() === '%PDF-') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="UNICO-report.pdf"');
        return res.send(buf);
      }
      res.status(500).json({ error: 'python exited ' + code, stderr: err.slice(-1200) });
    });
    try { cp.stdin.write(JSON.stringify(req.body || {})); cp.stdin.end(); }
    catch (e) { /* stream closed */ }
  });
}

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
// Collectors are served an EMPTY app-state blob (no shared admin state), but they
// still need the admin's quality DEFINITION edits so their Data Collection form
// shows the correct measurement type / benchmark / labels an admin configured in
// the Quality console. Build a minimal `unico_quality_v2` overlay for the snapshot:
// only the collector's own areas, and only DEFINITION fields (value fields like
// months/incidents are stripped so recorded data and the entry lock are untouched).
function scopeQualityOverlay(raw, qualityAreas, qualityIndicators) {
  try {
    const ov = typeof raw === 'string' ? JSON.parse(raw) : (raw && typeof raw === 'object' ? raw : null);
    if (!ov || !ov.depts) return {};
    const VALUE_FIELDS = ['months', 'monthRemarks', 'mNum', 'mDen', 'quarters', 'quarterRemarks', 'qNum', 'qDen', 'incidents'];
    const stripValues = (o) => {
      if (!o || typeof o !== 'object') return o;
      const c = {}; Object.keys(o).forEach((k) => { if (VALUE_FIELDS.indexOf(k) < 0) c[k] = o[k]; }); return c;
    };
    const qi = (qualityIndicators && typeof qualityIndicators === 'object') ? qualityIndicators : {};
    const depts = {};
    (qualityAreas || []).forEach((k) => {
      const d = ov.depts[k]; if (!d) return;
      const nd = {};
      // Per-indicator scope: when qualityIndicators[area] is a non-empty list, the
      // OVERLAY-added indicators must be narrowed too (they live here, not in the seed
      // `quality` collection that web.js filters below) — otherwise the restriction
      // leaks every admin-assigned indicator to the collector.
      const allow = (Array.isArray(qi[k]) && qi[k].length) ? new Set(qi[k].map(String)) : null;
      if (d.indPatches) { nd.indPatches = {}; Object.keys(d.indPatches).forEach((id) => { if (!allow || allow.has(String(id))) nd.indPatches[id] = stripValues(d.indPatches[id]); }); }
      if (Array.isArray(d.indAdded)) nd.indAdded = d.indAdded.map(stripValues).filter((a) => !allow || allow.has(String(a && a.id)));
      if (Array.isArray(d.indRemoved)) nd.indRemoved = d.indRemoved;
      depts[k] = nd;
    });
    if (!Object.keys(depts).length) return {};
    return { 'unico_quality_v2': JSON.stringify({ depts: depts }) };
  } catch (e) { return {}; }
}

// Same idea for Patient Statistics: admin edits to a department's metric columns /
// config live in the `unico_store_v3` overlay, which collectors also never received.
// Give collectors ONLY the config parts (custom depts, renames/col overrides, order,
// deletions) scoped to their assigned departments — never the stat VALUE overlay
// (entries/removed), which they submit via /api/submissions and read from the DB.
function scopeDeptOverlay(raw, deptIds) {
  try {
    const ov = typeof raw === 'string' ? JSON.parse(raw) : (raw && typeof raw === 'object' ? raw : null);
    if (!ov) return null;
    const ids = deptIds || [];
    const inScope = (id) => ids.indexOf(id) >= 0;
    const out = {};
    if (Array.isArray(ov.custom)) out.custom = ov.custom.filter((d) => d && inScope(d.id));
    if (ov.renames && typeof ov.renames === 'object') { out.renames = {}; Object.keys(ov.renames).forEach((id) => { if (inScope(id)) out.renames[id] = ov.renames[id]; }); }
    if (Array.isArray(ov.order)) out.order = ov.order.filter(inScope);
    if (Array.isArray(ov.deleted)) out.deleted = ov.deleted.filter(inScope);
    const has = Object.keys(out).some((k) => (Array.isArray(out[k]) ? out[k].length : Object.keys(out[k]).length));
    return has ? out : null;
  } catch (e) { return null; }
}

// The patient-statistics departments a collector can access = their explicit department
// list UNION the departments their quality areas map BACK to (an area and a department are
// two sides of ONE assignment) UNION every department when hospital-wide. Departments only
// ever derived quality areas, never the reverse — so a person assigned purely via quality
// (or hospital-wide) was left with an empty `departments` and saw NO patient-statistics
// departments at all. Returns a Set of canonical department ids.
function effectiveDeptIds(scope, deptMap) {
  const out = new Set(scope && Array.isArray(scope.departments) ? scope.departments : []);
  const qk = (deptMap && deptMap.qkToId) || {};
  (scope && scope.qualityAreas || []).forEach((k) => { const id = qk[k]; if (id && id !== deptmap.HOSPITAL) out.add(id); });
  if (scope && scope.allQualityAreas && deptMap && Array.isArray(deptMap.patientDepts)) {
    deptMap.patientDepts.forEach((id) => out.add(id));
  }
  return out;
}

// Shown only when the database is unreachable AND no cached copy exists to stand in
// for it — a cold start against a paused cluster. Deliberately self-contained and
// self-refreshing: the circuit breaker probes every few seconds, so this normally
// clears without anybody doing anything.
function warmingPage() {
  return '<!DOCTYPE html>'
    + '<html lang="en"><head><meta charset="UTF-8"/>'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>'
    + '<title>Starting up - UNICO Statistics Suite</title>'
    + '<meta http-equiv="refresh" content="5"/>'
    + '<link rel="icon" type="image/svg+xml" href="/unico/logo-mark.svg"/>'
    + '<style>'
    + 'body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;'
    + 'font-family:system-ui,Segoe UI,sans-serif;background:#0d1b2e;color:#e8eef7}'
    + '.card{max-width:420px;text-align:center;background:#132741;border:1px solid #1e3a5c;'
    + 'border-radius:16px;padding:32px}'
    + 'h1{margin:0 0 10px;font-size:19px}p{margin:0 0 6px;font-size:13.5px;line-height:1.6;color:#a8bdd6}'
    + '.dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#27a8db;'
    + 'margin-right:7px;animation:p 1.2s ease-in-out infinite}'
    + '@keyframes p{0%,100%{opacity:.35}50%{opacity:1}}'
    + '</style></head><body><div class="card">'
    + '<h1><span class="dot"></span>Starting up</h1>'
    + '<p>The database is waking up. Your data is safe &mdash; this page refreshes itself '
    + 'every few seconds and will continue automatically.</p>'
    + '<p style="margin-top:14px;font-size:12px;color:#7d94b0">If this persists for more than '
    + 'a minute or two, check the cluster status.</p>'
    + '</div></body></html>';
}

async function serveIndex(req, res) {
  let html;
  try { html = fs.readFileSync(INDEX_FILE, 'utf8'); }
  catch (e) { return res.status(500).type('text').send('renderer/index.html not found'); }

  // Fetch all five queries CONCURRENTLY — one wall-clock round-trip instead of
  // serial ones, so the shell starts streaming sooner. Each query falls back
  // independently (.catch), preserving the per-dataset failure tolerance the previous
  // sequential try/catches had: a slow/unreachable query blanks only its own data.
  // Each query falls back independently, preserving the per-dataset failure tolerance
  // the original sequential try/catches had. null means FAILED (as distinct from an
  // empty result, which is legitimate for a scoped collector) — the difference decides
  // whether we render the app or the warming-up page below.
  const [appRes, deptRes, staffRes, qualRes, scopeRes, formulaRes] = await Promise.all([
    getAppData().catch(() => null),           // DB unreachable -> empty snapshot
    getDepartments().catch(() => null),       // /api/departments reports the error
    getStaff().catch(() => null),
    getQuality().catch(() => null),
    (req.user && req.user.sub) ? dataCollection.getUserScope(req.user.sub).catch(() => null) : null,
    // Canonical quality-formula catalogue (one row per formula). Reference data —
    // injected for every role so the by-name master drives all departments.
    // getFormulas() resolves its own guarded handle: awaiting getDbHandle() here would
    // have paid the full server-selection timeout on a dead cluster BEFORE the circuit
    // breaker was ever consulted, making the breaker useless on this, the main render
    // path — the one page load that matters most.
    qualityFormulas.getFormulas().catch(() => []),
  ]);

  // Every dataset failed AND there was nothing cached to rescue them with. Rendering
  // the app now would produce a page with zero departments, zero staff and zero
  // indicators and NO error — which reads as "all my data is gone" and is the worst
  // possible answer to a database that is merely still waking up. Say so instead, and
  // come back by itself.
  if (appRes === null && deptRes === null && qualRes === null) {
    res.set('Cache-Control', 'no-store');
    res.set('Retry-After', '5');
    return res.status(503).type('html').send(warmingPage());
  }
  let snap = (appRes && appRes.data) || {};
  let depts = deptRes || [], staff = staffRes || [], quality = qualRes || [];
  // Canonical department identity map (id <-> quality key <-> canonical name), built from
  // the FULL (unscoped) datasets so the client can resolve ANY department/quality key to
  // ONE canonical name everywhere. Reference data only — safe for every role.
  const deptMap = deptmap.fromArrays(deptRes || [], qualRes || []);

  // Resolve the signed-in user's scope (fetched above, in parallel with the data).
  // A "collector" gets a DATA-LIMITED view: only their assigned departments +
  // quality areas are injected (no staff / shared app-state blob), so the SAME app
  // shows each user only their own data.
  let scopeUser = scopeRes || null;
  if (scopeUser && access.PORTAL_ROLES.indexOf(scopeUser.role) >= 0) {
    const qa = scopeUser.qualityAreas || [];
    // departments the collector can report = explicit list ∪ areas-mapped-back-to-depts
    // ∪ all (hospital-wide), so a quality-only / hospital-wide person still gets depts.
    const daSet = effectiveDeptIds(scopeUser, deptMap);
    const da = [...daSet];
    depts = depts.filter((d) => daSet.has(d.id));
    // Area scoping (qa) is preserved exactly; when qualityIndicators[area] is a
    // non-empty array, additionally narrow that area's indicators to those ids.
    // Empty/absent entry => keep ALL indicators (BACKWARD-COMPAT). The area object is
    // shallow-cloned so the shared getQuality() result is never mutated.
    const qi = (scopeUser.qualityIndicators && typeof scopeUser.qualityIndicators === 'object') ? scopeUser.qualityIndicators : {};
    quality = quality.filter((q) => qa.includes(q.key)).map((q) => {
      const allow = qi[q.key];
      if (!Array.isArray(allow) || !allow.length) return q; // no per-indicator scope -> all indicators
      const allowSet = new Set(allow.map(String));
      return Object.assign({}, q, { indicators: (q.indicators || []).filter((i) => allowSet.has(String(i.id))) });
    });
    staff = [];
    // Not the full shared blob — only the DEFINITION/CONFIG overlays a collector needs,
    // scoped to their own areas/departments, so BOTH Data Collection forms reflect the
    // admin's edits (quality measurement type / assignment; patient metric columns).
    snap = {};
    const qov = scopeQualityOverlay(appRes && appRes.data && appRes.data['unico_quality_v2'], qa, qi);
    if (qov && qov['unico_quality_v2']) snap['unico_quality_v2'] = qov['unico_quality_v2'];
    const dov = scopeDeptOverlay(appRes && appRes.data && appRes.data['unico_store_v3'], da);
    if (dov) snap['unico_store_v3'] = JSON.stringify(dov);
  }

  // Everyone who is NOT a collector used to be handed the entire database in this
  // inject — the full app-state blob, all 192 staff records, every department and
  // every quality area — no matter what their per-module access said. The sidebar
  // then hid the workspaces they lacked, but the data was already in the page and
  // one devtools glance away. Apply the same authority the API now applies, so a
  // restricted account is never SENT what it may not see.
  let restricted = null;
  if (!(scopeUser && access.PORTAL_ROLES.indexOf(scopeUser.role) >= 0)) {
    const a = await access.forRequest(req).catch(() => null);
    if (req.user && !a) {
      // Signed in with a token whose account is gone, deactivated, or whose sessions
      // were revoked since it was issued. Kill the cookie and make them sign in again,
      // returning them to the page they asked for (a collector bounced off /collect
      // should land back on /collect, not the admin app).
      session.clearSession(res);
      const back = req.unicoLanding ? '/collect' : '/';
      const portal = back === '/collect' ? '?portal=collect&next=%2Fcollect' : '';
      return res.redirect(302, '/login' + portal);
    }
    if (a && !a.unrestricted) {
      restricted = a;
      snap = await access.scopeSnapshot(a, snap);
      staff = access.can(a, 'staff', 'view') ? await access.filterStaff(a, staff) : [];
      if (!access.can(a, 'stats', 'view')) depts = [];
      if (!access.can(a, 'quality', 'view')) quality = [];
    }
  }

  const userInject = scopeUser
    ? { username: scopeUser.username, name: scopeUser.name, role: scopeUser.role, departments: scopeUser.departments, qualityAreas: scopeUser.qualityAreas, perms: scopeUser.perms,
        staffScope: restricted ? restricted.staffScope : 'all', staffId: restricted ? restricted.staffId : null,
        photo: scopeUser.photo || null, email: scopeUser.email || null,
        phone: scopeUser.phone || null, designation: scopeUser.designation || null, title: scopeUser.title || null }
    : (req.user ? { username: req.user.sub, name: req.user.name, role: req.user.role } : null);

  // Canonical quality-formula master: the DB catalogue expanded to the
  // window.QI_CORRECTIONS shape (by indicator name). Injected BEFORE the bundle so
  // quality-corrections-apply.js swaps it in over the static fallback, and the raw
  // catalogue array feeds the Formula Library editor. Empty in dev/in-memory mode
  // (no DB) -> the bundled static QI_CORRECTIONS keeps driving the app.
  const formulas = formulaRes || [];
  const qiByName = qualityFormulas.buildByNameMap(formulas);

  // Inject the saved state + DB-backed datasets (scoped per user above). __UNICO_USER__
  // tells the app who is signed in; __UNICO_INITIAL_ROUTE__ lets /collect open the app
  // straight on the Data Collection section.
  // Tells the hydration bridge in index.html that this snapshot is the COMPLETE set of
  // app-state keys this session may hold, so it can purge anything left in localStorage
  // by a previous (possibly higher-privileged) user of the same browser. Only claimed
  // when the app-state read actually succeeded and access resolution was not degraded —
  // otherwise an empty snapshot from a database blip would wipe the browser's copy and
  // then mirror that emptiness back.
  const authoritative = !!appRes && !(restricted && restricted.degraded);

  const inject =
    '<script>window.__UNICO_SNAPSHOT_AUTHORITATIVE__=' + (authoritative ? 'true' : 'false') + ';' +
    'window.__UNICO_SNAPSHOT__=' + safeJSON(snap) + ';' +
    'window.__UNICO_DEPARTMENTS__=' + safeJSON(depts) + ';' +
    'window.__UNICO_STAFF__=' + safeJSON(staff) + ';' +
    'window.__UNICO_QUALITY__=' + safeJSON(quality) + ';' +
    'window.__UNICO_DEPT_MAP__=' + safeJSON(deptMap) + ';' +
    'window.__UNICO_USER__=' + safeJSON(userInject) + ';' +
    (formulas.length ? 'window.__UNICO_QI_CORRECTIONS__=' + safeJSON(qiByName) + ';window.__UNICO_QI_FORMULAS__=' + safeJSON(formulas) + ';' : '') +
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

  // No floating "Sign out" pill: it overlapped page content at the bottom-right.
  // Signing out lives in the sidebar (next to the signed-in user) and the
  // collector portal header — both link to /logout.
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

// Branded, self-contained sign-in page, matching the approved Login mockup.
//
// ONE markup, two layouts, decided by CSS alone:
//   >= 900px  the SPLIT PANEL — dark brand panel beside the form
//   <  900px  the CENTERED card — brand panel drops away and the logo/title move
//             inside the card, which is the mockup's centred variant
// No JS is involved in choosing between them, so the right layout is painted on the
// first frame and there is nothing to flash or re-lay-out. The only script on the page
// is the password reveal toggle, and sign-in works with scripting disabled.
function loginPage(opts) {
  const o = opts || {};
  const err = o.error ? '<div class="err">' + escapeHtml(o.error) + '</div>' : '';
  const username = escapeHtml(o.username || '');
  const collect = o.portal === 'collect';
  const idLabel = collect ? 'Staff ID' : 'Username';
  const idHint = collect ? 'e.g. 11111' : 'Your username';
  const blurb = collect
    ? 'Sign in with your Staff ID to submit your unit&#39;s data.'
    : 'Welcome back. Please sign in to continue to your workspace.';
  const nextField = o.next ? '<input type="hidden" name="next" value="' + escapeHtml(o.next) + '"/>' : '';
  const credit = 'Design &amp; Developed by <a href="https://nasifahammedniloy.com" target="_blank" rel="noopener">Nasif Ahammed Niloy</a>';
  const wa = '<span class="help">'
    + '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18a8 8 0 01-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1112 20zm4.4-5.8c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.6 6.6 0 01-3.2-2.8c-.1-.2 0-.4.1-.5l.4-.5c.1-.2.1-.3 0-.5l-.7-1.6c-.2-.4-.4-.4-.5-.4h-.5a1 1 0 00-.7.3c-.3.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.8 2.8 4.4 3.8 1.6.6 2.2.7 3 .5.5-.1 1.4-.6 1.6-1.2.2-.6.2-1.1.1-1.2z"/></svg>'
    + 'Help line 01947527775</span> <span class="wa">(WhatsApp)</span>';

  return '<!DOCTYPE html>'
    + '<html lang="en"><head>'
    + '<meta charset="UTF-8"/>'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>'
    + '<title>Sign in - UNICO Nursing Management System</title>'
    + '<link rel="icon" type="image/svg+xml" href="/unico/logo-mark.svg"/>'
    + '<link rel="stylesheet" href="/vendor/fonts/ibm-plex.css"/>'
    + '<style>'
    + '*{box-sizing:border-box}'
    + 'body{margin:0;font-family:"IBM Plex Sans",system-ui,Segoe UI,sans-serif;color:#16202e;'
    + 'min-height:100vh;display:grid;place-items:center;padding:22px;background:#eef3fb}'
    + 'body::before{content:"";position:fixed;inset:0;z-index:-2;pointer-events:none;'
    + 'background:radial-gradient(900px 620px at 10% -10%,rgba(0,144,202,.20),transparent 62%),'
    + 'radial-gradient(820px 560px at 92% 8%,rgba(58,181,167,.18),transparent 62%),'
    + 'radial-gradient(950px 720px at 80% 100%,rgba(106,82,212,.18),transparent 62%),'
    + 'linear-gradient(160deg,#f4f8fd,#e9eefb 55%,#eae9f7)}'
    + 'body::after{content:"";position:fixed;z-index:-1;pointer-events:none;width:620px;height:620px;'
    + 'left:12%;top:-210px;border-radius:50%;filter:blur(56px);'
    + 'background:radial-gradient(circle,rgba(39,168,219,.20),rgba(58,181,167,.10) 52%,transparent 72%);'
    + 'animation:orb 20s ease-in-out infinite alternate}'
    + '@keyframes orb{from{transform:translate(0,0) scale(1)}to{transform:translate(150px,120px) scale(1.16)}}'

    // --- the shell: split on desktop, single column on mobile ---
    + '.shell{width:min(920px,96vw);display:grid;grid-template-columns:1fr 1fr;border-radius:20px;overflow:hidden;'
    + 'box-shadow:0 26px 70px rgba(31,59,90,.18),0 8px 24px rgba(0,144,202,.10);'
    + 'border:1px solid rgba(255,255,255,.9)}'

    // --- brand panel (desktop only) ---
    + '.brand{position:relative;padding:30px 32px;display:flex;flex-direction:column;color:#fff;'
    + 'background:linear-gradient(160deg,#1b2c45,#0d1b2e 60%,#102138);min-height:490px}'
    + '.brand::after{content:"";position:absolute;inset:0;pointer-events:none;'
    + 'background:radial-gradient(520px 380px at 78% 34%,rgba(0,144,202,.30),transparent 66%),'
    + 'radial-gradient(420px 300px at 12% 92%,rgba(58,181,167,.20),transparent 64%)}'
    + '.brand>*{position:relative;z-index:1}'
    + '.brand .mid{margin-top:auto}'
    + '.eyebrow{font-size:10.5px;font-weight:700;letter-spacing:2px;color:#6fc7ec;margin-bottom:12px}'
    + '.brand h1{margin:0;font-size:31px;line-height:1.18;font-weight:700;letter-spacing:-.5px}'
    + '.rule{width:56px;height:3px;border-radius:3px;background:linear-gradient(90deg,#3ab5a7,#27a8db);margin:16px 0 14px}'
    + '.brand p{margin:0;font-size:13px;line-height:1.6;color:#a8bdd6;max-width:290px}'
    + '.brand .foot{margin-top:auto;padding-top:18px;border-top:1px solid rgba(255,255,255,.14);'
    + 'font-family:"IBM Plex Mono",monospace;font-size:10.5px;color:#7e93ab;letter-spacing:.3px}'

    // --- form pane ---
    + '.pane{padding:34px 34px 26px;background:linear-gradient(152deg,rgba(255,255,255,.92),rgba(240,247,255,.78));'
    + 'backdrop-filter:blur(24px) saturate(1.6);-webkit-backdrop-filter:blur(24px) saturate(1.6);'
    + 'display:flex;flex-direction:column;justify-content:center}'
    + '.pane h2{margin:0 0 6px;font-size:22px;font-weight:700;letter-spacing:-.3px}'
    + '.pane .lead{margin:0 0 20px;font-size:12.8px;color:#6c7a8c;line-height:1.55}'
    // the centred header, shown only on small screens
    + '.mhead{display:none;text-align:center;margin-bottom:20px}'
    + '.mhead img{height:38px;margin-bottom:14px}'
    + '.mhead h2{font-size:21px;margin-bottom:7px}'

    + '.grp{display:flex;flex-direction:column;gap:6px;margin-bottom:13px}'
    + 'label{font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#9aa6b4}'
    + '.wrap{position:relative;display:flex;align-items:center}'
    + 'input[type=text],input[type=password]{width:100%;padding:12px 14px;border:1px solid rgba(125,145,180,.3);'
    + 'border-radius:11px;font-family:inherit;font-size:14px;background:rgba(255,255,255,.9);color:#16202e;outline:none;'
    + 'transition:border-color .15s,box-shadow .15s}'
    + 'input:focus{border-color:#27a8db;background:#fff;box-shadow:0 0 0 3px rgba(39,168,219,.14)}'
    + '.eye{position:absolute;right:6px;display:grid;place-items:center;width:34px;height:34px;border:0;'
    + 'background:transparent;cursor:pointer;color:#9aa6b4;border-radius:8px}'
    + '.eye:hover{color:#0090ca;background:rgba(0,144,202,.08)}'
    + '.btn{width:100%;margin-top:8px;padding:13px;border:0;border-radius:11px;cursor:pointer;'
    + 'font-family:inherit;font-size:14px;font-weight:700;color:#fff;'
    + 'display:inline-flex;align-items:center;justify-content:center;gap:9px;'
    + 'background:linear-gradient(135deg,#27a8db,#0072a3);box-shadow:0 10px 24px rgba(0,144,202,.32);'
    + 'transition:filter .15s,transform .12s}'
    + '.btn:hover{filter:brightness(1.06)}.btn:active{transform:translateY(1px)}'
    + '.note{margin:12px 0 0;font-size:11px;color:#9aa6b4;line-height:1.55;text-align:center}'
    + '.err{margin:0 0 13px;font-size:12px;font-weight:600;color:#b4232f;'
    + 'background:rgba(210,58,82,.10);border:1px solid rgba(210,58,82,.28);border-radius:10px;padding:9px 12px}'
    + '.foot2{margin-top:17px;padding-top:14px;border-top:1px solid rgba(125,145,180,.2);'
    + 'font-size:11px;color:#9aa6b4;line-height:1.9;text-align:center}'
    + '.foot2 a{color:#0072a3;text-decoration:none;font-weight:700}'
    + '.foot2 a:hover{text-decoration:underline}'
    + '.help{display:inline-flex;align-items:center;gap:6px;font-weight:700;color:#1f9d57}'
    + '.wa{color:#b9c6d6}'

    // --- MOBILE: centred card ---
    + '@media (max-width:899px){'
    + '.shell{grid-template-columns:1fr;width:min(420px,96vw)}'
    + '.brand{display:none}'
    + '.pane{padding:32px 28px 24px}'
    + '.mhead{display:block}'
    + '.pane>h2.desk,.pane>p.lead.desk{display:none}'
    + '}'
    + '</style></head><body>'

    + '<form class="shell" method="POST" action="/login" autocomplete="on">'
    // brand panel — desktop
    + '<aside class="brand">'
    + '<img src="/unico/logo.svg" alt="UNICO Healthcare" style="height:34px;align-self:flex-start;filter:brightness(0) invert(1);opacity:.95"/>'
    + '<div class="mid">'
    + '<div class="eyebrow">UNICO HOSPITALS</div>'
    + '<h1>Nursing Management System</h1>'
    + '<div class="rule"></div>'
    + '<p>' + blurb + '</p>'
    + '</div>'
    + '<div class="foot">UNICO Hospitals PLC &middot; Nursing Services</div>'
    + '</aside>'
    // form pane
    + '<div class="pane">'
    + '<div class="mhead">'
    + '<img src="/unico/logo.svg" alt="UNICO Healthcare"/>'
    + '<h2>Nursing Management System</h2>'
    + '<p class="lead">' + blurb + '</p>'
    + '</div>'
    + '<h2 class="desk">Welcome back</h2>'
    + '<p class="lead desk">Sign in with your hospital staff account to continue.</p>'
    + err
    + nextField
    + '<div class="grp"><label for="u">' + idLabel + '</label>'
    + '<input id="u" type="text" name="username" value="' + username + '" autocomplete="username" placeholder="' + idHint + '" autofocus/></div>'
    + '<div class="grp"><label for="p">Password</label>'
    + '<div class="wrap"><input id="p" name="password" type="password" autocomplete="current-password" placeholder="Enter your password"/>'
    + '<button class="eye" type="button" id="eye" aria-label="Show password" title="Show password">'
    + '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
    + '</button></div></div>'
    + '<button class="btn" type="submit">Sign in <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>'
    + '<p class="note">Access is limited to authorised UNICO staff. For account issues, contact the help line below.</p>'
    + '<div class="foot2">' + credit + '<br/>' + wa + '</div>'
    + '</div>'
    + '</form>'

    + '<script>(function(){var e=document.getElementById("eye"),p=document.getElementById("p");'
    + 'if(!e||!p)return;e.addEventListener("click",function(){'
    + 'var show=p.type==="password";p.type=show?"text":"password";'
    + 'e.setAttribute("aria-label",show?"Hide password":"Show password");'
    + 'e.setAttribute("title",show?"Hide password":"Show password");p.focus();});})();<\/script>'
    + '</body></html>';
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

// --- Brute-force throttle -----------------------------------------------------
// Shared with POST /api/login through server/login-throttle.js, so the two doors into
// the same account cannot be attacked independently: 8 failures at either one locks
// both. Previously only this portal counted, and the API accepted unlimited guesses.
const throttle = require('./login-throttle');
const loginKey = throttle.keyOf;
const loginBlockedFor = throttle.blockedFor;
const noteLoginFail = throttle.noteFail;
const loginFails = { delete: throttle.clear };

app.post('/login', async function (req, res) {
  if (!session.authRequired()) return res.redirect(302, '/');
  const username = String((req.body && req.body.username) || '').trim().toLowerCase();
  const password = String((req.body && req.body.password) || '');
  const next = safeNext(req.body && req.body.next);
  const portal = next === '/collect' ? 'collect' : undefined;
  if (!username || !password) {
    return res.status(400).type('html').send(loginPage({ error: 'Enter your username and password.', username, next, portal }));
  }
  const key = loginKey(req, username);
  const wait = await loginBlockedFor(key);
  if (wait > 0) {
    res.set('Retry-After', String(wait));
    const mins = Math.ceil(wait / 60);
    return res.status(429).type('html').send(loginPage({ error: `Too many failed attempts. Try again in about ${mins} minute${mins !== 1 ? 's' : ''}.`, username, next, portal }));
  }
  try {
    const users = await getUsers();
    const user = await users.findOne({ username });
    const valid = user && user.active !== false && await auth.verify(password, user.passwordHash);
    if (!valid) {
      await noteLoginFail(key);
      activity.record({ action: 'login_failed', username, ip: activity.ipOf(req), detail: 'invalid credentials' });
      return res.status(401).type('html').send(loginPage({ error: 'Invalid username or password.', username, next, portal }));
    }
    await loginFails.delete(key); // success clears the counter
    activity.record({ action: 'login', username: user.username, name: user.name || user.username, role: user.role, ip: activity.ipOf(req), detail: portal ? ('portal: ' + portal) : '' });
    session.setSession(res, auth.sign(user));
    // Honor an explicit return target; else collectors land on /collect, admins on the app.
    res.redirect(302, next || (access.PORTAL_ROLES.indexOf(user.role) >= 0 ? '/collect' : '/'));
  } catch (e) {
    res.status(500).type('html').send(loginPage({ error: 'Server error. Is the database reachable?', username, next, portal }));
  }
});

app.get('/logout', function (req, res) {
  const who = session.userFromReq(req);
  if (who) activity.record({ action: 'logout', username: who.sub, name: who.name, role: who.role, ip: activity.ipOf(req) });
  session.clearSession(res);
  res.redirect(302, '/login');
});

// Some browsers/tools still request /favicon.ico blindly; point them at the logo
// (both pages also declare it via <link rel="icon">) instead of 404ing.
app.get('/favicon.ico', function (req, res) {
  res.set('Cache-Control', 'public, max-age=604800');
  res.redirect(302, '/unico/logo-mark.svg');
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

// Read the DB-backed datasets as JSON — used by the live refetch (approval / tab
// refocus) and external tools. MUST apply the SAME collector scoping as the "/"
// snapshot: the unscoped lists leaked every department/indicator (incl. unassigned
// ones and their recorded values) back into collector portals on refresh.
async function collectorScope(req) {
  try {
    if (!(req.user && req.user.sub)) return null;
    const s = await dataCollection.getUserScope(req.user.sub);
    return (s && access.PORTAL_ROLES.indexOf(s.role) >= 0) ? s : null;
  } catch (e) { return null; }
}
// Area + per-indicator narrowing — same rules as serveIndex's snapshot scoping.
function scopeQualityList(quality, scope) {
  const qa = scope.qualityAreas || [];
  const qi = (scope.qualityIndicators && typeof scope.qualityIndicators === 'object') ? scope.qualityIndicators : {};
  return (quality || []).filter((q) => qa.includes(q.key)).map((q) => {
    const allow = qi[q.key];
    if (!Array.isArray(allow) || !allow.length) return q; // empty/absent => all indicators
    const allowSet = new Set(allow.map(String));
    return Object.assign({}, q, { indicators: (q.indicators || []).filter((i) => allowSet.has(String(i.id))) });
  });
}
app.get('/api/departments', session.requireApi, access.requirePerm('stats', 'view', { allowCollector: true }), async (req, res) => {
  try {
    let depts = await getDepartments();
    const scope = await collectorScope(req);
    const out = { ok: true };
    if (scope) {
      const daSet = effectiveDeptIds(scope, await deptmap.get());
      const da = [...daSet];
      depts = depts.filter((d) => daSet.has(d.id));
      // re-scoped config overlay so an open collector portal picks up admin edits
      // (custom columns / renames) on live refresh, not only at page load
      try { const dov = scopeDeptOverlay((await getAppData()).data['unico_store_v3'], da); if (dov) out.overlay = { unico_store_v3: JSON.stringify(dov) }; } catch (e) { }
    }
    out.departments = depts;
    res.json(out);
  }
  catch (e) { res.status(500).json({ ok: false, error: 'Could not load departments.' }); }
});
// The personnel register is the most sensitive dataset in the app, and this route
// used to hand all 192 records to ANY signed-in account. It is now gated on the
// staff module AND filtered row by row to the caller's staff scope (all / their own
// departments / their own record only).
app.get('/api/staff', session.requireApi, access.requirePerm('staff', 'view', { allowCollector: true }), async (req, res) => {
  try {
    // A portal account receives its OWN UNIT's staff, and a thin record at that
    // (access.portalStaff). Its department list is in statistics ids, while a staff
    // record stores the department NAME, so the ids are resolved through the
    // canonical map before matching.
    const scope = await collectorScope(req);
    if (scope) {
      const map = await deptmap.get();
      // Match on BOTH vocabularies. A staff record's `current_department` is written by
      // hand and in practice holds either the unit's short code ("MICU", "CT ICU") or
      // its full name ("Medical ICU"); the account stores the statistics id ("micu").
      // Feeding in id AND name catches both without a data migration.
      const keys = [];
      (scope.departments || []).forEach((id) => { keys.push(id); const n = map.byId[id] && map.byId[id].name; if (n) keys.push(n); });
      return res.json({ ok: true, staff: access.portalStaff(keys, await getStaff()), scoped: true });
    }
    res.json({ ok: true, staff: await access.filterStaff(req.access, await getStaff()) });
  }
  catch (e) { res.status(500).json({ ok: false, error: 'Could not load staff.' }); }
});
app.get('/api/quality', session.requireApi, access.requirePerm('quality', 'view', { allowCollector: true }), async (req, res) => {
  try {
    let quality = await getQuality();
    const scope = await collectorScope(req);
    const out = { ok: true };
    if (scope) {
      quality = scopeQualityList(quality, scope);
      // re-scoped definition overlay (incl. indicator assign/unassign = indRemoved)
      // so an open collector portal reflects admin changes on live refresh
      try {
        const qi = (scope.qualityIndicators && typeof scope.qualityIndicators === 'object') ? scope.qualityIndicators : {};
        const qov = scopeQualityOverlay((await getAppData()).data['unico_quality_v2'], scope.qualityAreas || [], qi);
        if (qov && qov['unico_quality_v2']) out.overlay = { unico_quality_v2: qov['unico_quality_v2'] };
      } catch (e) { }
    }
    out.quality = quality;
    res.json(out);
  }
  catch (e) { res.status(500).json({ ok: false, error: 'Could not load quality indicators.' }); }
});

// Database keep-alive: one tiny write per day so Atlas does not pause the cluster for
// inactivity. Deliberately NOT behind the login gate — the Vercel cron that calls it
// carries no session cookie, and the response is only a timestamp. Set CRON_SECRET to
// require a bearer token (Vercel then sends it automatically).
keepalive.mount(app);

// Data Collection module: responsible persons + Google-form-style submissions
// (responsibles / submissions APIs). Self-contained; honors the same auth gate.
// Guarded on the 'datacol' module. Collectors keep their own row-level scoping
// (assigned departments / areas / indicators) inside the module; every other role is
// checked against its per-module access, with the verb deciding the action needed.
require('./data-collection').mount(app, { requireApi: [session.requireApi, access.requireModule('datacol')] });

// User Management module: admin-only account CRUD over the `users` collection.
require('./users-admin').mount(app, { requireApi: session.requireApi });

// Admin activity log: read/clear the auth + user-management audit trail.
// The audit trail names who signed in, from which IP, and what they changed — it was
// readable by ANY signed-in account. It belongs to the Administration module.
activity.mount(app, { requireApi: [session.requireApi, access.requireModule('users')] });

// Quality Formula catalogue: list (all roles) + admin-only edit of the ONE
// canonical formula row per indicator; changes fan out to every department.
// Reference data (formula definitions), readable by any signed-in role including
// collectors, so it is not module-gated. access.attach still resolves the live
// authority — it rejects revoked/deactivated sessions and gives adminOnly a real
// answer for the write route instead of a token claim.
qualityFormulas.mount(app, { requireApi: [session.requireApi, access.attach] });

// Shift Supervisor Reports module: the "Night Supervisor Log Sheet" digitised —
// one document per shift, stored in its own `supervisorReports` collection.
// Shift Supervisor Reports carry patient names and UHIDs — gated on the 'supervisor'
// module (which, until now, could not be granted at all: see users-admin.js).
require('./supervisor-reports').mount(app, { requireApi: [session.requireApi, access.requireModule('supervisor')] });

// Settings -> Database: browse and repair the Cloudflare D1 tables (admin only).
require('./d1-admin').mount(app, { requireApi: [session.requireApi, access.attach] });

// Settings -> Media: browse the Cloudinary asset store folder by folder (admin only).
require('./media-admin').mount(app, { requireApi: [session.requireApi, access.attach] });

// Photo uploads: staff record photos (needs EDIT on staff) and the caller's own
// account picture. Bytes go to Cloudinary; only the CDN url is ever stored.
require('./photos').mount(app, { requireApi: [session.requireApi, access.attach] });

// Individual Performance module: the 6-monthly appraisal (Form HR-NUR-PA-01) plus the
// achievement and incident registers whose points feed into it. Appraisals are
// personal-file records, so the whole module is gated on 'perf' and the verb decides
// the action needed; Part H is admin-only inside the module itself.
require('./staff-performance').mount(app, { requireApi: [session.requireApi, access.requireModule('perf')] });

// Staff requests: a nurse in-charge asking for a new nurse or PCA. A portal account
// may raise and correct its OWN request; only an administrator decides one. Guarded
// on 'staff' with the portal roles let through, because the request queue is the one
// staff-shaped thing a ward IS allowed to touch.
require('./staff-requests').mount(app, {
  requireApi: [session.requireApi, access.requirePerm('staff', 'view', { allowCollector: true })],
  scopeOf: collectorScope,
});

// Duty Roster module: one sheet per unit per month, with shift codes, coverage and the
// sign-off block. Gated on the 'roster' module; approval is admin-only inside it.
require('./duty-roster').mount(app, {
  requireApi: [session.requireApi, access.requireModule('roster')],
  // Reads also open to a data collector, who then only ever receives APPROVED
  // rosters (server/duty-roster.js publishedOnly). Writes stay on requireApi.
  requireRead: [session.requireApi, access.requirePerm('roster', 'view', { allowCollector: true })],
});

// Medicine module: the Bangladesh drug index (21.7k brands / 1.7k generic monographs)
// and the prescriptions written from it. Prescriptions carry patient names, UHIDs and
// diagnoses, so the whole module is gated on 'medicine'; editing the shared drug
// catalogue is admin-only inside it.
require('./medicines').mount(app, { requireApi: [session.requireApi, access.requireModule('medicine')] });

// All other renderer assets (jsx/js/css/svg/fonts) are static. index:false so our
// handler owns "/". The /api/* routes were registered by ./index before this.
// The app's own source (jsx/js/css) is transpiled in-browser by Babel, so it MUST
// NOT be cached — otherwise edits don't show until a manual hard-refresh. Mark those
// no-store (revalidated every load); large immutable vendor libs may still cache.
app.use(express.static(RENDERER, {
  index: false,
  setHeaders: function (res, filePath) {
    // The app bundle is a FIXED path (dist/app.bundle.js) whose content changes on
    // every build; only a ?v=<hash> query distinguishes versions. `immutable` is
    // therefore wrong here: it tells the browser never to revalidate this URL for a
    // year, so any request that reaches the path without the newest query — a
    // bookmarked/restored tab, a proxy or security suite that normalises the query,
    // a stale HTML from a back/forward restore — is served a year-old bundle and the
    // browser will not even ask. That is the "I rebuilt and nothing changed" trap,
    // and it cost real debugging time.
    //
    // `no-cache` does NOT mean "do not cache": the copy is kept and revalidated with
    // its ETag, so an unchanged bundle costs one 304 and no re-download. Repeat loads
    // stay fast; a rebuilt one can never be missed.
    if (/[\\/]dist[\\/]/i.test(filePath)) {
      res.set('Cache-Control', 'public, no-cache');
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
    const d1st = require('./d1').status(), d1Mods = require('./d1-store').activeModules(), stSt = require('./storage').status();
    console.log('     SQL:    ' + (d1st.configured
      ? 'Cloudflare D1 (' + d1st.database + ') - '
        + (d1Mods.length ? 'serving: ' + d1Mods.join(', ') : 'configured but no module routed (set D1_MODULES)')
      : 'Cloudflare D1 (not configured - set CLOUDFLARE_* in .env)'));
    console.log('     Files:  ' + (stSt.configured
      ? 'Cloudinary (' + stSt.cloudName + ')'
      : 'Cloudinary (not configured - set CLOUDINARY_* in .env)'));
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
  // Quality is no longer its own collection — it lives embedded in departments
  // (dept.quality) after the Statistics+Quality merge, so nothing to seed here.
  Promise.resolve({ name: 'quality', seeded: 0, note: 'merged into departments.quality' }),
  // Canonical formula catalogue: seeded once from the static QI_CORRECTIONS + the
  // quality collection (needs a DB handle; harmless no-op in dev in-memory mode).
  (async () => { const db = await getDbHandle(); return db ? qualityFormulas.ensureSeeded(db) : { name: 'qualityFormulas', seeded: 0 }; })(),
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
  // Long-running PC server: keep the cluster awake from here. On Vercel this block
  // never runs (no require.main) and the daily cron in vercel.json does it instead.
  keepalive.start();
}

module.exports = app;
