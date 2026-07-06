/* End-to-end proof of the Report Builder's WEB PDF export: loads the renderer with a
   department fixture (no server, no auth, window.unicoNative absent -> web path),
   navigates to Reports, clicks "Export PDF", and verifies a real PDF file is written.
   Run: node scripts/diag-export.js   exit 0 = pass. Self-heals env like smoke.js. */
const electronEntry = require('electron');
if (typeof electronEntry === 'string') {
  const { spawnSync } = require('child_process');
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const r = spawnSync(electronEntry, [__filename, ...process.argv.slice(2)], { stdio: 'inherit', env });
  process.exit(r.status == null ? 1 : r.status);
}
const { app, BrowserWindow, protocol } = electronEntry;
const path = require('path'); const fs = require('fs'); const os = require('os');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'unico-export-'));
app.setPath('userData', TMP);
const RENDERER = path.join(__dirname, '..', 'renderer'); const SCHEME = 'app';
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.ico': 'image/x-icon' };
protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
function rr(u) { const url = new URL(u); let rel = decodeURIComponent(url.pathname); if (!rel || rel === '/') rel = '/index.html'; const t = path.normalize(path.join(RENDERER, rel)); return t.startsWith(RENDERER) ? t : path.join(RENDERER, 'index.html'); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errors = [];

// Minimal but realistic department fixture (6-col + 1-col) injected as the
// server-provided global BEFORE the deferred bundle runs.
const FIX = [
  { id: 'er', name: 'Emergency Medicine', short: 'ER', group: 'Critical & Emergency', desc: 'ER flow', primary: 'reg', primaryLabel: 'ER Reg Cases', order: 1,
    cols: [{ id: 'reg', label: 'ER Reg Cases' }, { id: 'adm', label: 'Admission' }, { id: 'conv', label: 'Conversion' }, { id: 'lama', label: 'LAMA' }, { id: 'daycare', label: 'Day Care' }, { id: 'proc', label: 'Procedure' }],
    months: ['Jan-26', 'Feb-26', 'Mar-26'],
    data: [{ reg: 100, adm: 40, conv: 30, lama: 5, daycare: 20, proc: 10 }, { reg: 120, adm: 45, conv: 33, lama: 4, daycare: 25, proc: 12 }, { reg: 95, adm: 38, conv: 28, lama: 6, daycare: 18, proc: 9 }] },
  { id: 'opd', name: 'Out-Patient Department', short: 'OPD', group: 'Ambulatory', desc: 'OPD visits', primary: 'opd', primaryLabel: 'OPD Patients', order: 2,
    cols: [{ id: 'opd', label: 'OPD Patients' }],
    months: ['Jan-26', 'Feb-26', 'Mar-26'], data: [{ opd: 2000 }, { opd: 2200 }, { opd: 2100 }] },
];
const INJECT = '<script>window.__UNICO_DEPARTMENTS__=' + JSON.stringify(FIX) + ';window.__UNICO_QUALITY__=[];</script>';

app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async () => {
  protocol.handle(SCHEME, async (req) => {
    const fp = rr(req.url);
    try {
      let d = await fs.promises.readFile(fp);
      if (fp.endsWith('index.html')) d = Buffer.from(d.toString('utf8').replace('</head>', INJECT + '</head>'));
      return new Response(d, { status: 200, headers: { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' } });
    } catch (e) { return new Response('NF', { status: 404 }); }
  });
  const win = new BrowserWindow({ show: false, width: 1700, height: 1050, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.on('console-message', (...a) => { const m = a.length === 1 ? a[0].message : a[2]; if (/SyntaxError|is not defined|Uncaught|TypeError|Cannot read/.test(String(m))) errors.push(String(m).slice(0, 250)); });

  // capture the jsPDF blob download to a known file
  const outPdf = path.join(TMP, 'export-test.pdf');
  let dlState = 'none';
  win.webContents.session.on('will-download', (e, item) => {
    item.setSavePath(outPdf);
    item.once('done', (_, state) => { dlState = state; });
  });

  await win.loadURL(`${SCHEME}://unico/index.html`); await sleep(4500);
  const ev = expr => win.webContents.executeJavaScript(expr);

  const mount = await ev(`({hasApp:!!document.querySelector('.app'),depts:(window.UNICO&&window.UNICO.DEPARTMENTS||[]).length,h2c:typeof window.html2canvas,jspdf:!!(window.jspdf&&window.jspdf.jsPDF)})`);

  // Navigate: workspace switcher "Reports" -> Report Builder
  await ev(`(function(){var b=[].slice.call(document.querySelectorAll('.modswitch button')).filter(function(x){return /Reports/.test(x.textContent);})[0]; if(b){b.click();return true;} return false;})()`);
  await sleep(1800);
  const onReports = await ev(`(function(){var pages=document.querySelectorAll('#pdf-root .pdf-page').length; var btn=[].slice.call(document.querySelectorAll('button')).some(function(b){return /Export PDF/.test(b.textContent);}); return {pages:pages, exportBtn:btn};})()`);

  // Click Export PDF and wait for the note / download
  await ev(`(function(){var b=[].slice.call(document.querySelectorAll('button')).filter(function(x){return /Export PDF/.test(x.textContent);})[0]; if(b){b.click();return true;} return false;})()`);
  let note = '';
  for (let i = 0; i < 60; i++) { // up to 30 s
    await sleep(500);
    note = await ev(`(function(){var els=[].slice.call(document.querySelectorAll('.content div')).filter(function(d){return /PDF downloaded|Direct PDF failed|only available|Export failed/.test(d.textContent||'');}); return els.length?els[els.length-1].textContent.slice(0,160):'';})()`);
    if (note || dlState !== 'none') { if (dlState !== 'none' && !note) continue; if (note) break; }
  }
  await sleep(1200); // let the download finish writing
  const pdfOk = fs.existsSync(outPdf) && fs.statSync(outPdf).size > 20000;
  const pdfKb = fs.existsSync(outPdf) ? Math.round(fs.statSync(outPdf).size / 1024) : 0;

  const pass = mount.hasApp && mount.depts === 2 && onReports.pages > 0 && onReports.exportBtn && /PDF downloaded/.test(note) && dlState === 'completed' && pdfOk && errors.length === 0;
  console.log('MOUNT ' + JSON.stringify(mount));
  console.log('REPORTS ' + JSON.stringify(onReports));
  console.log('NOTE ' + JSON.stringify(note) + ' download=' + dlState + ' pdf=' + pdfKb + 'KB');
  console.log('ERRORS ' + JSON.stringify(errors));
  console.log('EXPORT_PASS ' + pass);
  try { if (win && !win.isDestroyed()) win.destroy(); } catch (_) { }
  app.exit(pass ? 0 : 1);
}).catch(e => { console.error(e); app.exit(1); });
