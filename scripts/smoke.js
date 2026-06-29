/* Headless smoke test: loads the renderer exactly as the app does, verifies
   the React app mounts, fonts + data load, and localStorage persists.
   Run: node scripts/smoke.js   (or: npm run smoke)   exit code 0 = pass

   Self-heals the environment: if launched as plain Node, or via the electron
   binary with ELECTRON_RUN_AS_NODE=1 set (this dev machine sets it globally),
   require('electron') yields the binary PATH instead of the module. We detect
   that and re-exec ourselves as real Electron with the var cleared, so the test
   "just works" however it's invoked. */
const electronEntry = require('electron');
if (typeof electronEntry === 'string') {
  const { spawnSync } = require('child_process');
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const r = spawnSync(electronEntry, [__filename, ...process.argv.slice(2)], { stdio: 'inherit', env });
  process.exit(r.status == null ? 1 : r.status);
}

const { app, BrowserWindow, protocol } = electronEntry;
const path = require('path');
const fs = require('fs');
const os = require('os');

// Run under a throwaway profile so the smoke test never reads or pollutes the
// real localStorage. (Must be set before app is ready.)
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'unico-smoke-')));

const RENDERER = path.join(__dirname, '..', 'renderer');
const SCHEME = 'app';
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.ico': 'image/x-icon' };
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);
function resolveRequest(reqUrl) {
  const u = new URL(reqUrl);
  let rel = decodeURIComponent(u.pathname);
  if (!rel || rel === '/') rel = '/index.html';
  const t = path.normalize(path.join(RENDERER, rel));
  return t.startsWith(RENDERER) ? t : path.join(RENDERER, 'index.html');
}

const errors = [];
const logs = [];

app.commandLine.appendSwitch('disable-gpu');

app.whenReady().then(async () => {
  protocol.handle(SCHEME, async (req) => {
    const fp = resolveRequest(req.url);
    try {
      const data = await fs.promises.readFile(fp);
      return new Response(data, { status: 200, headers: { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' } });
    } catch (e) { return new Response('Not found', { status: 404 }); }
  });
  const win = new BrowserWindow({
    show: false, width: 1440, height: 900,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.webContents.on('console-message', (...args) => {
    let level, message, source, line;
    if (args.length === 1 && typeof args[0] === 'object') {
      const e = args[0]; level = e.level; message = e.message; source = e.sourceId; line = e.lineNumber;
    } else { level = args[1]; message = args[2]; line = args[3]; source = args[4]; }
    logs.push({ level, message: String(message).slice(0, 300), source, line });
    const s = String(message);
    if (s.includes('SyntaxError') || s.includes('is not defined') || s.includes('Uncaught') || /TypeError/.test(s)) errors.push(s.slice(0, 300));
  });
  win.webContents.on('did-fail-load', (e, code, desc, url) => { if (code !== -3) errors.push(`did-fail-load ${code} ${desc} ${url}`); });
  win.webContents.on('render-process-gone', (e, d) => errors.push('render-process-gone ' + JSON.stringify(d)));

  try {
    await win.loadURL(`${SCHEME}://unico/index.html`);
  } catch (e) { errors.push('loadURL ' + String(e)); }

  await new Promise((r) => setTimeout(r, 4500)); // let Babel compile all jsx + React mount

  // Write a persistence marker, then reload and confirm it survives.
  try {
    await win.webContents.executeJavaScript(`localStorage.setItem('__smoke_persist','42');true`);
    await win.webContents.reload();
    await new Promise((r) => setTimeout(r, 4500));
  } catch (e) { errors.push('reload ' + String(e)); }

  let result = {};
  try {
    result = await win.webContents.executeJavaScript(`(function(){
      const out={
        rootChildren: (document.getElementById('root')||{}).children?document.getElementById('root').children.length:0,
        hasApp: !!document.querySelector('.app'),
        hasSidebar: !!document.querySelector('.sb'),
        navText: (document.querySelector('.sb')?.innerText||'').replace(/\\n+/g,' | ').slice(0,200),
        fontFamily: getComputedStyle(document.body).fontFamily,
        depts: (window.UNICO&&window.UNICO.DEPARTMENTS)?window.UNICO.DEPARTMENTS.length:-1,
        components: ['Dashboard','ManageStaff','QualityModule','Reports','DataEntry'].filter(n=>typeof window[n]==='function'),
        logoLoaded: (function(){var i=document.querySelector('.sb-logo-img');return !!i&&i.complete&&i.naturalWidth>0;})(),
        persisted: localStorage.getItem('__smoke_persist')
      };
      try{ localStorage.setItem('__smoke','ok'); out.lsWrite=localStorage.getItem('__smoke'); }catch(e){ out.lsError=String(e); }
      return out;
    })()`);
  } catch (e) { errors.push('executeJavaScript ' + String(e)); }

  const pass = result.rootChildren > 0 && result.hasApp && result.hasSidebar &&
    result.depts === 15 && result.lsWrite === 'ok' && result.persisted === '42' &&
    result.logoLoaded === true && (result.components || []).length === 5 && errors.length === 0;
  console.log('SMOKE_RESULT ' + JSON.stringify(result));
  console.log('SMOKE_ERRORS ' + JSON.stringify(errors));
  console.log('SMOKE_PASS ' + pass);
  // Tear the window down before exiting so we don't leave orphaned child processes.
  try { if (win && !win.isDestroyed()) win.destroy(); } catch (_) {}
  app.exit(pass ? 0 : 1);
});
