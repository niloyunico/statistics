/* End-to-end cloud-login verification. Requires the auth server running on
   http://localhost:4000 (in-memory admin: admin / test123). Proves:
     1) once a server URL is configured, the app shows the Sign-in gate (the app
        shell is hidden until authenticated)
     2) entering valid credentials calls the server, stores a session token, and
        unlocks the app
   Run (with the server up): node_modules/.bin/electron scripts/verify-login.js
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

  // configure a server URL + clear any session, then reload so the gate engages
  await exec(`localStorage.setItem('unico_api_base','http://localhost:4100'); localStorage.removeItem('unico_session_token'); localStorage.removeItem('unico_session_user'); true`);
  await win.webContents.reload();
  await sleep(4500);

  const gate = await exec(`({ hasLogin:/Sign in/i.test(document.body.textContent), hasApp:!!document.querySelector('.app'), pw: document.querySelectorAll('input[type="password"]').length })`);

  // fill credentials + submit
  await exec(`(function(){
    function rset(el,v){var p=Object.getPrototypeOf(el);var d=Object.getOwnPropertyDescriptor(p,'value');d.set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));}
    var ins=[].slice.call(document.querySelectorAll('input'));
    var user=ins.find(function(i){return i.type!=='password';});
    var pass=ins.find(function(i){return i.type==='password';});
    if(user) rset(user,'admin'); if(pass) rset(pass,'test123');
  })()`);
  await sleep(200);
  await exec(`(function(){ var b=[].slice.call(document.querySelectorAll('button')).find(function(x){return /^Sign in/.test(x.textContent.trim());}); if(b) b.click(); })()`);
  await sleep(2000); // network login + render

  const after = await exec(`({ token:!!localStorage.getItem('unico_session_token'), user:localStorage.getItem('unico_session_user'), hasApp:!!document.querySelector('.app'), stillLogin:/Sign in/i.test(document.body.textContent) })`);

  const pass =
    gate.hasLogin === true && gate.hasApp === false && gate.pw >= 1 &&
    after.token === true && after.hasApp === true && after.stillLogin === false &&
    /admin/.test(after.user || '') &&
    errors.length === 0;

  console.log('GATE ' + JSON.stringify(gate));
  console.log('AFTER ' + JSON.stringify(after));
  console.log('ERRORS ' + JSON.stringify(errors));
  console.log('VERIFY_LOGIN_PASS ' + pass);
  app.exit(pass ? 0 : 1);
}).catch((e) => { console.error(e); app.exit(1); });
