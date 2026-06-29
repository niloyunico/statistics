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
const { getAppData, usingMongo } = require('./db');

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

  let snap = {};
  try { const d = await getAppData(); snap = (d && d.data) || {}; }
  catch (e) { /* DB unreachable -> empty snapshot; app still loads on built-in seed */ }

  const inject =
    '<script>window.__UNICO_SNAPSHOT__=' + safeJSON(snap) + ';</script>\n' +
    '<script src="unico/web-native.js"></script>\n';

  // Must run BEFORE the vendored libs + the inline db-bridge so window.unicoNative
  // exists when that bridge runs. Anchor on the comment that precedes them.
  if (html.includes('<!-- Vendored libraries')) {
    html = html.replace('<!-- Vendored libraries', inject + '<!-- Vendored libraries');
  } else {
    html = html.replace('</head>', inject + '</head>');
  }
  res.set('Cache-Control', 'no-store'); // snapshot is per-request; never cache the shell
  res.type('html').send(html);
}

app.get('/', serveIndex);
app.get('/index.html', serveIndex);

// All other renderer assets (jsx/js/css/svg/fonts) are static. index:false so our
// handler owns "/". The /api/* routes were registered by ./index before this.
app.use(express.static(RENDERER, { index: false }));

const PORT = process.env.WEB_PORT || process.env.PORT || 8080;
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

module.exports = app;
