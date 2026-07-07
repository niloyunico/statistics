/* PDF export verification — loads the REAL app (preload.js + index.html),
   navigates to Reports, and proves the Export PDF feature actually works:
     1) preload exposes window.unicoNative.exportPDF (the renderer bridge)
     2) the FULL report renders into #pdf-root — one .pdf-page per selected dept
        (not just the single page visible in the live preview)
     3) under print media, #root is hidden and only #pdf-root is shown, so the
        output is the clean report and never the dark app chrome
     4) webContents.printToPDF() returns a valid, non-trivial PDF
   Run: node_modules/.bin/electron scripts/verify-pdf.js   (exit 0 = pass)
   (Clear ELECTRON_RUN_AS_NODE first, or require('electron') yields a path.) */
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
  // Stub the DB ipc so the real preload hydrates cleanly (no real user data touched).
  ipcMain.on('db:loadSync', (e) => { e.returnValue = {}; });
  ipcMain.handle('db:persist', () => ({ ok: true }));
  ipcMain.handle('db:path', () => 'memory');
  protocol.handle(SCHEME, async (req) => {
    const fp = resolveRequest(req.url);
    try { const data = await fs.promises.readFile(fp); return new Response(data, { status: 200, headers: { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' } }); }
    catch (e) { return new Response('Not found', { status: 404 }); }
  });

  const win = new BrowserWindow({ show: false, width: 1440, height: 900, webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.on('console-message', (...a) => {
    const m = a.length === 1 ? a[0].message : a[2];
    const line = a.length > 3 ? a[3] : '';
    const src = a.length > 4 ? a[4] : '';
    if (/SyntaxError|is not defined|Uncaught|TypeError/.test(String(m))) errors.push((String(m) + (src ? ' @ ' + src + ':' + line : '')).slice(0, 400));
  });
  win.webContents.on('render-process-gone', (e, d) => errors.push('render-process-gone ' + JSON.stringify(d)));

  await win.loadURL(`${SCHEME}://unico/index.html`);
  await sleep(4500); // Babel compiles the jsx + React mounts

  // (1) renderer bridge present
  const bridge = await win.webContents.executeJavaScript(
    `({ hasNative: !!window.unicoNative,
        hasExport: !!(window.unicoNative && typeof window.unicoNative.exportPDF === 'function'),
        hasApp: !!document.querySelector('.app'),
        bodyText: (document.body.textContent||'').slice(0,500) })`);

  // navigate to the Reports screen so the #pdf-root portal mounts
  const navigated = await win.webContents.executeJavaScript(
    `(function(){
      var mod=[].slice.call(document.querySelectorAll('.modswitch button')).find(function(e){return /reports/i.test(e.textContent||'');});
      if(mod){ mod.click(); return true; }
      var it=[].slice.call(document.querySelectorAll('.sb-item')).find(function(e){return /reports/i.test(e.textContent||'');});
      if(it){ it.click(); return true; }
      return false;
    })()`);
  await sleep(1500); // Reports mounts, portal renders, chart bars settle (useMounted)

  // (2) full report rendered into #pdf-root — pages match the report's page count
  const dom = await win.webContents.executeJavaScript(`(function(){
    var pr=document.getElementById('pdf-root');
    var pages=pr?pr.querySelectorAll('.pdf-page').length:-1;
    var m=(document.body.textContent.match(/Page\\s+\\d+\\s+of\\s+(\\d+)/)||[]);
    return { pages: pages, reportPages: m[1]?Number(m[1]):-1, onReports: /Report Builder/.test(document.body.textContent) };
  })()`);

  // (3) print-media isolation: #root hidden, #pdf-root shown
  let media = {};
  try {
    const dbg = win.webContents.debugger;
    if (!dbg.isAttached()) dbg.attach('1.3');
    await win.webContents.executeJavaScript(`document.body.classList.add('pdf-export-mode')`);
    await dbg.sendCommand('Emulation.setEmulatedMedia', { media: 'print' });
    media = await win.webContents.executeJavaScript(
      `({ root: getComputedStyle(document.getElementById('root')).display,
          pdf: getComputedStyle(document.getElementById('pdf-root')).display })`);
    await dbg.sendCommand('Emulation.setEmulatedMedia', { media: '' });
    await win.webContents.executeJavaScript(`document.body.classList.remove('pdf-export-mode')`);
    dbg.detach();
  } catch (e) { media = { error: String(e) }; }

  // (4) real PDF generation (same call the ipc handler makes)
  let pdf = {};
  try {
    await win.webContents.executeJavaScript(`document.body.classList.add('pdf-export-mode')`);
    const data = await win.webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    await win.webContents.executeJavaScript(`document.body.classList.remove('pdf-export-mode')`);
    const head = data.slice(0, 8).toString('latin1');
    const body = data.toString('latin1');
    const pageObjs = (body.match(/\/Type\s*\/Page[^s]/g) || []).length;
    const outDir = path.join(__dirname, '.tmp'); try { fs.mkdirSync(outDir, { recursive: true }); } catch (_) {}
    const outFile = path.join(outDir, 'verify-report.pdf');
    fs.writeFileSync(outFile, data);
    pdf = { isPdf: head.startsWith('%PDF-'), hasEOF: /%%EOF\s*$/.test(body.slice(-1024)), bytes: data.length, pageObjs: pageObjs, file: outFile };
  } catch (e) { pdf = { error: String(e) }; }

  const pass =
    bridge.hasExport === true && bridge.hasApp === true &&
    navigated === true && dom.onReports === true &&
    dom.pages >= 1 && dom.pages === dom.reportPages &&
    media.root === 'none' && !!media.pdf && media.pdf !== 'none' &&
    pdf.isPdf === true && pdf.hasEOF === true && pdf.bytes > 15000 &&
    errors.length === 0;

  console.log('BRIDGE ' + JSON.stringify(bridge));
  console.log('NAVIGATED ' + navigated);
  console.log('DOM ' + JSON.stringify(dom));
  console.log('MEDIA ' + JSON.stringify(media));
  console.log('PDF ' + JSON.stringify(pdf));
  console.log('ERRORS ' + JSON.stringify(errors));
  console.log('VERIFY_PDF_PASS ' + pass);
  app.exit(pass ? 0 : 1);
}).catch((e) => { console.error(e); app.exit(1); });
