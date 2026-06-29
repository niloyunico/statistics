/* Period-filter verification — loads the real app, then drives the top-bar
   period pill and proves it actually filters the Dashboard:
     1) the pill renders on the dashboard with an "all time" range label
     2) selecting "Latest month" changes the pill label
     3) the sum-based KPIs (Procedures, Critical Care Vol.) shrink to the
        single-month figures — i.e. the KPIs really recompute for the period
   Run: node_modules/.bin/electron scripts/verify-period.js   (exit 0 = pass)
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
const numify = (s) => Number(String(s).replace(/[^0-9.]/g, '')) || 0;

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

  const win = new BrowserWindow({ show: false, width: 1500, height: 950, webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.on('console-message', (...a) => { const m = a.length === 1 ? a[0].message : a[2]; if (/SyntaxError|is not defined|Uncaught|TypeError/.test(String(m))) errors.push(String(m).slice(0, 200)); });
  win.webContents.on('render-process-gone', (e, d) => errors.push('render-process-gone ' + JSON.stringify(d)));

  await win.loadURL(`${SCHEME}://unico/index.html`);
  await sleep(4500); // Babel compile + mount; dashboard is the default route

  const read = () => win.webContents.executeJavaScript(`(function(){
    var pill=document.querySelector('.tb-pill');
    var vals=[].slice.call(document.querySelectorAll('.kpi .val')).map(function(e){return e.textContent.trim();});
    return { pillLabel: pill?(pill.querySelector('.num')||{}).textContent||'' : null, hasPill: !!pill, kpis: vals };
  })()`);

  const before = await read(); // default = All time

  // open the pill, then pick "Latest month"
  await win.webContents.executeJavaScript(`(function(){ var b=document.querySelector('.tb-pill'); if(b) b.click(); return !!b; })()`);
  await sleep(350); // dropdown renders
  const picked = await win.webContents.executeJavaScript(
    `(function(){ var o=[].slice.call(document.querySelectorAll('div')).find(function(e){return e.textContent.trim()==='Latest month' && e.querySelectorAll('div').length===0;}); if(o){ o.click(); return true; } return false; })()`);
  await sleep(700); // dashboard recomputes for the period

  const after = await read();

  // KPI order: [ED Patients, OPD Footfall, Procedures, Critical Care Vol.]
  const procBefore = numify(before.kpis[2]), procAfter = numify(after.kpis[2]);
  const ccBefore = numify(before.kpis[3]), ccAfter = numify(after.kpis[3]);

  const pass =
    before.hasPill === true &&
    /–/.test(before.pillLabel || '') &&
    picked === true &&
    after.pillLabel && after.pillLabel !== before.pillLabel &&
    procAfter > 0 && procAfter < procBefore &&   // sum over 1 month < sum over all months
    ccAfter > 0 && ccAfter < ccBefore &&
    errors.length === 0;

  console.log('BEFORE ' + JSON.stringify(before));
  console.log('PICKED_LATEST ' + picked);
  console.log('AFTER  ' + JSON.stringify(after));
  console.log('PROC ' + procBefore + ' -> ' + procAfter + ' | CRITCARE ' + ccBefore + ' -> ' + ccAfter);
  console.log('ERRORS ' + JSON.stringify(errors));
  console.log('VERIFY_PERIOD_PASS ' + pass);
  app.exit(pass ? 0 : 1);
}).catch((e) => { console.error(e); app.exit(1); });
