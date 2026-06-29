/* Staff export verification. Drives the app to the Nurse workforce dashboard,
   opens the (previously dead) Export menu, and proves:
     1) the dashboard now shows a working Export menu
     2) the menu offers a PDF option
     3) choosing PDF renders the roster into #pdf-root + pdf-export-mode and
        printToPDF produces a valid, non-trivial, sensibly-named PDF
     4) #pdf-root / pdf-export-mode are cleaned up afterwards
   Run: node_modules/.bin/electron scripts/verify-staff-export.js  (exit 0 = pass)
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
let lastPdf = null;

app.whenReady().then(async () => {
  ipcMain.on('db:loadSync', (e) => { e.returnValue = {}; });
  ipcMain.handle('db:persist', () => ({ ok: true }));
  ipcMain.handle('db:path', () => 'memory');
  ipcMain.handle('pdf:export', async (e, opts = {}) => {
    try {
      const data = await e.sender.printToPDF({ pageSize: opts.pageSize || 'A4', landscape: !!opts.landscape, printBackground: true, margins: { top: 0, bottom: 0, left: 0, right: 0 } });
      lastPdf = { bytes: data.length, head: data.slice(0, 5).toString('latin1'), name: opts.defaultName };
      return { ok: true, path: 'C:/tmp/staff.pdf' };
    } catch (err) { lastPdf = { error: String(err) }; return { ok: false, error: String(err) }; }
  });
  protocol.handle(SCHEME, async (req) => {
    const fp = resolveRequest(req.url);
    try { const data = await fs.promises.readFile(fp); return new Response(data, { status: 200, headers: { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' } }); }
    catch (e) { return new Response('Not found', { status: 404 }); }
  });

  const win = new BrowserWindow({ show: false, width: 1500, height: 950, webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.on('console-message', (...a) => { const m = a.length === 1 ? a[0].message : a[2]; if (/SyntaxError|is not defined|Uncaught|TypeError/.test(String(m))) errors.push(String(m).slice(0, 200)); });
  win.webContents.on('render-process-gone', (e, d) => errors.push('render-process-gone ' + JSON.stringify(d)));
  const exec = (js) => win.webContents.executeJavaScript(js);

  await win.loadURL(`${SCHEME}://unico/index.html`);
  await sleep(4500);

  // Nurse Management -> Directory (the staff roster screen with Export)
  await exec(`(function(){ var d=[].slice.call(document.querySelectorAll('.sb-item')).find(function(e){return e.textContent.trim()==='Directory';}); if(d) d.click(); })()`);
  await sleep(1000);

  const hasExport = await exec(`[].slice.call(document.querySelectorAll('button')).some(function(b){return /^Export/.test(b.textContent.trim());})`);
  // open the menu
  await exec(`(function(){ var b=[].slice.call(document.querySelectorAll('button')).find(function(x){return /^Export/.test(x.textContent.trim());}); if(b) b.click(); })()`);
  await sleep(400);
  const hasPdfOpt = await exec(`[].slice.call(document.querySelectorAll('div')).some(function(d){return d.textContent.trim()==='PDF document (.pdf)';})`);
  // choose PDF
  await exec(`(function(){ var d=[].slice.call(document.querySelectorAll('div')).find(function(x){return x.textContent.trim()==='PDF document (.pdf)';}); if(d) d.click(); })()`);
  await sleep(1500);

  const after = await exec(`({ htmlLen: document.getElementById('pdf-root').innerHTML.length, mode: document.body.classList.contains('pdf-export-mode') })`);

  const pass =
    hasExport === true && hasPdfOpt === true &&
    lastPdf && lastPdf.head === '%PDF-' && lastPdf.bytes > 5000 &&
    /roster|Nurse/i.test(lastPdf.name || '') &&
    after.htmlLen === 0 && after.mode === false &&
    errors.length === 0;

  console.log('HAS_EXPORT ' + hasExport + ' HAS_PDF_OPT ' + hasPdfOpt);
  console.log('PDF ' + JSON.stringify(lastPdf));
  console.log('AFTER ' + JSON.stringify(after));
  console.log('ERRORS ' + JSON.stringify(errors));
  console.log('VERIFY_STAFF_EXPORT_PASS ' + pass);
  app.exit(pass ? 0 : 1);
}).catch((e) => { console.error(e); app.exit(1); });
