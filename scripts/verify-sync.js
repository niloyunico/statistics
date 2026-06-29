/* End-to-end data-sync verification. Requires the auth server on
   http://localhost:4100 (in-memory admin: admin / test123). Proves the round-trip:
     1) configure server + a known marker value, then sign in
     2) signing in pushes this device's app state to the server (cloud was empty)
     3) after wiping the marker locally, pullData() restores it FROM THE SERVER
        -> the data really lives on the server, not just locally
   Run (server up on 4100): node_modules/.bin/electron scripts/verify-sync.js
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

  // configure server + clear session + plant a marker that should sync
  await exec(`localStorage.setItem('unico_api_base','http://localhost:4100');
             localStorage.removeItem('unico_session_token'); localStorage.removeItem('unico_session_user');
             localStorage.setItem('unico_synctest','MARKER-123'); true`);
  await win.webContents.reload();
  await sleep(4500);

  // sign in (this pushes local -> cloud, then reloads)
  await exec(`(function(){
    function rset(el,v){var p=Object.getPrototypeOf(el);var d=Object.getOwnPropertyDescriptor(p,'value');d.set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));}
    var ins=[].slice.call(document.querySelectorAll('input'));
    var user=ins.find(function(i){return i.type!=='password';}); var pass=ins.find(function(i){return i.type==='password';});
    if(user) rset(user,'admin'); if(pass) rset(pass,'test123');
  })()`);
  await sleep(200);
  await exec(`(function(){ var b=[].slice.call(document.querySelectorAll('button')).find(function(x){return /^Sign in/.test(x.textContent.trim());}); if(b) b.click(); })()`);
  await sleep(7000); // login -> pull/push -> reload -> babel recompile

  const authed = await exec(`({ hasApp:!!document.querySelector('.app'), token:!!localStorage.getItem('unico_session_token') })`);

  // wipe the marker locally, then pull it back FROM THE SERVER
  const roundtrip = await exec(`(async function(){
    localStorage.removeItem('unico_synctest');
    var before = localStorage.getItem('unico_synctest');
    var r = await window.unicoSession.pullData();
    return { pullOk:r&&r.ok, pullCount:r&&r.count, before:before, after:localStorage.getItem('unico_synctest') };
  })()`);

  const pass =
    authed.hasApp === true && authed.token === true &&
    roundtrip.pullOk === true && roundtrip.pullCount > 0 &&
    roundtrip.before === null && roundtrip.after === 'MARKER-123' &&
    errors.length === 0;

  console.log('AUTHED ' + JSON.stringify(authed));
  console.log('ROUNDTRIP ' + JSON.stringify(roundtrip));
  console.log('ERRORS ' + JSON.stringify(errors));
  console.log('VERIFY_SYNC_PASS ' + pass);
  app.exit(pass ? 0 : 1);
}).catch((e) => { console.error(e); app.exit(1); });
