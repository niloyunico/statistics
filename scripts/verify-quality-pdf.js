/* Quality-report PDF export verification. Drives the app to a department quality
   report and clicks the new "PDF" button. A dialog-less pdf:export handler does
   the real printToPDF, proving:
     1) the PDF button exists on the department report
     2) clicking it renders the report into #pdf-root + sets pdf-export-mode, so
        printToPDF captures a valid, non-trivial PDF of the clean report
     3) it requests a sensibly-named PDF
     4) afterwards #pdf-root is cleared and pdf-export-mode removed (no leakage)
   Run: node_modules/.bin/electron scripts/verify-quality-pdf.js   (exit 0 = pass)
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
  // dialog-less PDF handler — does the real capture so we can validate output
  ipcMain.handle('pdf:export', async (e, opts = {}) => {
    try {
      const data = await e.sender.printToPDF({ pageSize: opts.pageSize || 'A4', landscape: !!opts.landscape, printBackground: true, margins: { top: 0, bottom: 0, left: 0, right: 0 } });
      lastPdf = { bytes: data.length, head: data.slice(0, 5).toString('latin1'), name: opts.defaultName };
      return { ok: true, path: 'C:/tmp/quality.pdf' };
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
  await exec(`localStorage.removeItem('unico_quality_v1');true`);

  // Quality dashboard (disambiguated by section) -> first department row
  await exec(`(function(){
    var nodes=[].slice.call(document.querySelectorAll('.sb-sec, .sb-item'));
    for(var i=0;i<nodes.length;i++){ if(nodes[i].classList.contains('sb-sec') && /quality indicators/i.test(nodes[i].textContent||'')){
      for(var j=i+1;j<nodes.length;j++){ if(nodes[j].classList.contains('sb-item')){ nodes[j].click(); return; } } } }
  })()`);
  await sleep(900);
  await exec(`(function(){ var r=document.querySelector('table.tbl tbody tr'); if(r) r.click(); })()`);
  await sleep(900);

  const hasBtn = await exec(`[].slice.call(document.querySelectorAll('button')).some(function(b){return b.textContent.trim()==='PDF';})`);
  await exec(`(function(){ var b=[].slice.call(document.querySelectorAll('button')).find(function(x){return x.textContent.trim()==='PDF';}); if(b) b.click(); })()`);
  await sleep(1500); // printToPDF + cleanup

  const after = await exec(`({ htmlLen: document.getElementById('pdf-root').innerHTML.length, mode: document.body.classList.contains('pdf-export-mode') })`);

  const pass =
    hasBtn === true &&
    lastPdf && lastPdf.head === '%PDF-' && lastPdf.bytes > 5000 &&
    /Quality/i.test(lastPdf.name || '') &&
    after.htmlLen === 0 && after.mode === false &&
    errors.length === 0;

  console.log('HAS_PDF_BTN ' + hasBtn);
  console.log('PDF ' + JSON.stringify(lastPdf));
  console.log('AFTER ' + JSON.stringify(after));
  console.log('ERRORS ' + JSON.stringify(errors));
  console.log('VERIFY_QUALITY_PDF_PASS ' + pass);
  app.exit(pass ? 0 : 1);
}).catch((e) => { console.error(e); app.exit(1); });
