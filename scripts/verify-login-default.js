/* Verifies the login page now appears OUT OF THE BOX thanks to the baked-in
   UNICO_DEFAULT_API (config.js) — no per-device setup, no server needed for this
   check (we only confirm the Sign-in gate shows and the app is hidden behind it).
   Run: node_modules/.bin/electron scripts/verify-login-default.js  (exit 0 = pass)
   (Clear ELECTRON_RUN_AS_NODE first.) */
const { app, BrowserWindow, protocol, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const RENDERER = path.join(__dirname, '..', 'renderer');
const PRELOAD = path.join(__dirname, '..', 'preload.js');
const SCHEME = 'app';
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.ico': 'image/x-icon' };

protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
function resolveRequest(u) { const url = new URL(u); let rel = decodeURIComponent(url.pathname); if (!rel || rel === '/') rel = '/index.html'; const t = path.normalize(path.join(RENDERER, rel)); return t.startsWith(RENDERER) ? t : path.join(RENDERER, 'index.html'); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.commandLine.appendSwitch('disable-gpu');
const errors = [];

app.whenReady().then(async () => {
  ipcMain.on('db:loadSync', (e) => { e.returnValue = {}; });
  ipcMain.handle('db:persist', () => ({ ok: true }));
  ipcMain.handle('db:path', () => 'memory');
  protocol.handle(SCHEME, async (req) => {
    const fp = resolveRequest(req.url);
    try { const data = await fs.promises.readFile(fp); return new Response(data, { status: 200, headers: { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' } }); }
    catch (e) { return new Response('Not found', { status: 404 }); }
  });

  const win = new BrowserWindow({ show: false, width: 1400, height: 900, webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.on('console-message', (...a) => { const m = a.length === 1 ? a[0].message : a[2]; if (/SyntaxError|is not defined|Uncaught|TypeError/.test(String(m))) errors.push(String(m).slice(0, 200)); });
  win.webContents.on('render-process-gone', (e, d) => errors.push('render-process-gone ' + JSON.stringify(d)));
  const exec = (js) => win.webContents.executeJavaScript(js);

  await win.loadURL(`${SCHEME}://unico/index.html`);
  await sleep(4500);
  // ensure NOTHING is configured on the device — rely purely on the baked default
  await exec(`localStorage.removeItem('unico_api_base'); localStorage.removeItem('unico_session_token'); localStorage.removeItem('unico_session_user'); true`);
  await win.webContents.reload();
  await sleep(4500);

  const r = await exec(`({
    defaultApi: (window.UNICO_DEFAULT_API||''),
    configured: !!(window.unicoSession && window.unicoSession.configured()),
    serverUrl: window.unicoSession ? window.unicoSession.serverUrl() : null,
    hasLogin: /Sign in/i.test(document.body.textContent),
    hasApp: !!document.querySelector('.app')
  })`);

  const pass =
    r.defaultApi === 'http://localhost:4100' &&
    r.configured === true && r.serverUrl === 'http://localhost:4100' &&
    r.hasLogin === true && r.hasApp === false &&
    errors.length === 0;

  console.log('RESULT ' + JSON.stringify(r));
  console.log('ERRORS ' + JSON.stringify(errors));
  console.log('VERIFY_LOGIN_DEFAULT_PASS ' + pass);
  app.exit(pass ? 0 : 1);
}).catch((e) => { console.error(e); app.exit(1); });
