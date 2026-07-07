/* Detailed-report table fit verification — loads the real app, opens Reports,
   switches to the "Detailed" report type, and proves the wide ER data table no
   longer overflows the report sheet horizontally (the columns used to clip).
   Run: node_modules/.bin/electron scripts/verify-table.js   (exit 0 = pass)
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

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
try {
  const tmpProfile = path.join(__dirname, '.tmp-electron', path.basename(__filename, '.js'));
  fs.mkdirSync(tmpProfile, { recursive: true });
  app.setPath('userData', tmpProfile);
  app.setPath('sessionData', tmpProfile);
} catch (_) {}
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
  await sleep(4500);

  // go to Reports
  await win.webContents.executeJavaScript(`(function(){
    var mod=[].slice.call(document.querySelectorAll('.modswitch button')).find(function(e){return /reports/i.test(e.textContent||'');});
    if(mod){ mod.click(); return; }
    var it=[].slice.call(document.querySelectorAll('.sb-item')).find(function(e){return /reports/i.test(e.textContent||'');});
    if(it) it.click();
  })()`);
  await sleep(1200);

  // switch to the Detailed report type
  const switched = await win.webContents.executeJavaScript(
    `(function(){ var b=[].slice.call(document.querySelectorAll('.seg button')).find(function(e){return e.textContent.trim()==='Detailed';}); if(b){ b.click(); return true; } return false; })()`);
  await sleep(1200);

  // measure the visible (preview) detailed table for horizontal overflow
  const m = await win.webContents.executeJavaScript(`(function(){
    var tables=[].slice.call(document.querySelectorAll('#pdf-root table, #root table'));
    var t=tables.find(function(x){ return x.querySelectorAll('thead th').length>=9; });
    if(!t) return { hasTable:false, tableCount:tables.length, thCounts:tables.map(function(x){return x.querySelectorAll('thead th').length;}), text:(document.body.textContent||'').slice(0,500) };
    var cols=t.querySelectorAll('thead th').length;
    var sheet=t.closest('div[style*="background: rgb(255, 255, 255)"]') || t.parentElement;
    var tr=t.getBoundingClientRect(), sr=sheet?sheet.getBoundingClientRect():tr;
    return { hasTable:true, cols:cols, scrollW:t.scrollWidth, clientW:t.clientWidth,
             overflow:t.scrollWidth-t.clientWidth, spillPastSheet:Math.round(tr.right-sr.right) };
  })()`);

  const pass =
    switched === true && m.hasTable === true &&
    m.cols >= 9 &&                 // ER detailed = Month + ~9 metric columns
    m.overflow <= 2 &&             // table content fits its own box (no internal scroll)
    m.spillPastSheet <= 2 &&       // table doesn't extend past the report sheet edge
    errors.length === 0;

  console.log('SWITCHED_DETAILED ' + switched);
  console.log('TABLE ' + JSON.stringify(m));
  console.log('ERRORS ' + JSON.stringify(errors));
  console.log('VERIFY_TABLE_PASS ' + pass);
  app.exit(pass ? 0 : 1);
}).catch((e) => { console.error(e); app.exit(1); });
