/* DB round-trip test using the REAL preload.js + index.html, driven from the
   Electron main process (like smoke.js — no debug port, no external kill).
   Window 1 writes + auto-mirrors to disk; Window 2 re-runs preload and must
   load the value back from the on-disk database (proves hydration).
   Run: node_modules/.bin/electron scripts/smoke-db.js   (exit 0 = pass) */
const { app, BrowserWindow, protocol, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const RENDERER = path.join(__dirname, '..', 'renderer');
const PRELOAD = path.join(__dirname, '..', 'preload.js');
const SCHEME = 'app';
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.ico': 'image/x-icon' };
const KEY = '__dbtest', VAL = 'DBVAL_777';

protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
function resolveRequest(u) { const url = new URL(u); let rel = decodeURIComponent(url.pathname); if (!rel || rel === '/') rel = '/index.html'; const t = path.normalize(path.join(RENDERER, rel)); return t.startsWith(RENDERER) ? t : path.join(RENDERER, 'index.html'); }

// Dedicated temp DB file so we never touch the user's real data.
const DB = path.join(app.getPath('temp'), 'unico-db-smoke.json');
function readDB() { try { const o = JSON.parse(fs.readFileSync(DB, 'utf8')); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
function writeDB(d) { const tmp = DB + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(d)); fs.renameSync(tmp, DB); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function makeWindow() {
  const w = new BrowserWindow({ show: false, width: 1440, height: 900, webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true } });
  return w;
}

app.commandLine.appendSwitch('disable-gpu');
const errors = [];

app.whenReady().then(async () => {
  try { fs.unlinkSync(DB); } catch (_) {}
  ipcMain.on('db:loadSync', (e) => { e.returnValue = readDB(); });
  ipcMain.handle('db:persist', (e, data) => { try { writeDB(data); return { ok: true }; } catch (err) { return { ok: false, error: String(err) }; } });
  ipcMain.handle('db:path', () => DB);
  protocol.handle(SCHEME, async (req) => { const fp = resolveRequest(req.url); try { const data = await fs.promises.readFile(fp); return new Response(data, { status: 200, headers: { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' } }); } catch (e) { return new Response('Not found', { status: 404 }); } });

  // ---- Window 1: write a value, rely on the auto-mirror to persist it ----
  const w1 = makeWindow();
  w1.webContents.on('console-message', (...a) => { const m = a.length === 1 ? a[0].message : a[2]; if (/SyntaxError|is not defined|Uncaught|TypeError/.test(String(m))) errors.push(String(m).slice(0, 200)); });
  await w1.loadURL(`${SCHEME}://unico/index.html`);
  await sleep(4500);
  const w1res = await w1.webContents.executeJavaScript(`(function(){
    var out={hasNative:!!window.unicoNative, depts:(window.UNICO&&window.UNICO.DEPARTMENTS)?window.UNICO.DEPARTMENTS.length:-1, hasApp:!!document.querySelector('.app')};
    try{ localStorage.setItem('${KEY}','${VAL}'); out.set=localStorage.getItem('${KEY}'); }catch(e){ out.err=String(e); }
    return out;
  })()`);
  await sleep(700); // let the debounced mirror write to disk
  const onDiskAfterAutoMirror = readDB()[KEY];

  // ---- Window 2: fresh preload run must hydrate from the on-disk DB ----
  const w2 = makeWindow();
  await w2.loadURL(`${SCHEME}://unico/index.html`);
  await sleep(4500);
  const w2res = await w2.webContents.executeJavaScript(`(function(){
    return {
      snapKey: (window.unicoNative&&window.unicoNative.snapshot)?window.unicoNative.snapshot['${KEY}']:null,
      lsKey: localStorage.getItem('${KEY}'),
      hasApp: !!document.querySelector('.app'),
      depts: (window.UNICO&&window.UNICO.DEPARTMENTS)?window.UNICO.DEPARTMENTS.length:-1
    };
  })()`);

  const pass = w1res.hasNative && w1res.set === VAL && w1res.depts === 15 && w1res.hasApp &&
    onDiskAfterAutoMirror === VAL && w2res.snapKey === VAL && w2res.lsKey === VAL && w2res.hasApp && w2res.depts === 15 && errors.length === 0;
  console.log('W1 ' + JSON.stringify(w1res));
  console.log('AUTO_MIRROR_ON_DISK ' + JSON.stringify(onDiskAfterAutoMirror));
  console.log('W2 ' + JSON.stringify(w2res));
  console.log('ERRORS ' + JSON.stringify(errors));
  console.log('SMOKE_DB_PASS ' + pass);
  try { fs.unlinkSync(DB); } catch (_) {}
  app.exit(pass ? 0 : 1);
}).catch((e) => { console.error(e); app.exit(1); });
