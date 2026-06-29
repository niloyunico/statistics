/* Data-entry partial-save verification — loads the real app, opens Data Entry,
   and proves the new "save with missing data after a warning" behavior:
     1) filling one field + leaving the rest empty and clicking Save shows a
        confirmation warning (window.UI.confirm) instead of hard-blocking
     2) clicking "Save anyway" stores the entry, with the filled field as a
        number and every missing field as null (blank — not a fake 0)
     3) a hard error (negative number) still blocks with NO dialog and NO save
   Run: node_modules/.bin/electron scripts/verify-input.js   (exit 0 = pass)
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

  const win = new BrowserWindow({ show: false, width: 1500, height: 950, webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.on('console-message', (...a) => { const m = a.length === 1 ? a[0].message : a[2]; if (/SyntaxError|is not defined|Uncaught|TypeError/.test(String(m))) errors.push(String(m).slice(0, 200)); });
  win.webContents.on('render-process-gone', (e, d) => errors.push('render-process-gone ' + JSON.stringify(d)));
  const exec = (js) => win.webContents.executeJavaScript(js);

  await win.loadURL(`${SCHEME}://unico/index.html`);
  await sleep(4500);
  // start from a clean store so the entry count is deterministic
  await exec(`localStorage.removeItem('unico_store_v3');true`);
  await win.webContents.reload();
  await sleep(4500);

  // navigate to Data Entry (Quick Form is the default tab)
  await exec(`(function(){ var it=[].slice.call(document.querySelectorAll('.sb-item')).find(function(e){return /data entry/i.test(e.textContent||'');}); if(it) it.click(); })()`);
  await sleep(1200);

  const readEntries = () => exec(`(function(){
    var raw=localStorage.getItem('unico_store_v3'); var s=raw?JSON.parse(raw):null; var ents=(s&&s.entries)||[];
    var last=ents[ents.length-1]||null; var nNull=0,nNum=0;
    if(last&&last.row){ for(var k in last.row){ if(last.row[k]===null) nNull++; else if(typeof last.row[k]==='number') nNum++; } }
    return { count: ents.length, lastNulls:nNull, lastNums:nNum };
  })()`);

  const base = await readEntries();

  // fill only the first metric field, leave the rest empty
  const pre = await exec(`(function(){
    function rset(el,v){var p=Object.getPrototypeOf(el);var d=Object.getOwnPropertyDescriptor(p,'value');d.set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));}
    var ins=[].slice.call(document.querySelectorAll('input[type="number"]'));
    if(ins.length) rset(ins[0],'5');
    var dlg=[].slice.call(document.querySelectorAll('button')).some(function(b){return /save anyway/i.test(b.textContent);});
    return { numInputs: ins.length, dialogBefore: dlg };
  })()`);
  await sleep(200);
  await exec(`(function(){ var b=[].slice.call(document.querySelectorAll('button')).find(function(x){return /save entry/i.test(x.textContent);}); if(b) b.click(); })()`);
  await sleep(500);
  const confirmShown = await exec(`[].slice.call(document.querySelectorAll('button')).some(function(b){return /save anyway/i.test(b.textContent);})`);
  await exec(`(function(){ var b=[].slice.call(document.querySelectorAll('button')).find(function(x){return /save anyway/i.test(x.textContent);}); if(b) b.click(); })()`);
  await sleep(700);
  const after = await readEntries();

  // ---- hard error must still block (negative number, no dialog, no save) ----
  await exec(`(function(){
    function rset(el,v){var p=Object.getPrototypeOf(el);var d=Object.getOwnPropertyDescriptor(p,'value');d.set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));}
    var ins=[].slice.call(document.querySelectorAll('input[type="number"]')); if(ins.length) rset(ins[0],'-2');
  })()`);
  await sleep(150);
  await exec(`(function(){ var b=[].slice.call(document.querySelectorAll('button')).find(function(x){return /save entry/i.test(x.textContent);}); if(b) b.click(); })()`);
  await sleep(450);
  const hard = await exec(`(function(){
    var dlg=[].slice.call(document.querySelectorAll('button')).some(function(b){return /save anyway/i.test(b.textContent);});
    var raw=localStorage.getItem('unico_store_v3'); var s=raw?JSON.parse(raw):null; var ents=(s&&s.entries)||[];
    return { confirmShown: dlg, count: ents.length };
  })()`);

  const pass =
    pre.numInputs >= 3 && pre.dialogBefore === false &&
    confirmShown === true &&                          // warning appeared for missing data
    after.count === base.count + 1 &&                 // saved exactly one entry
    after.lastNums >= 1 && after.lastNulls >= 1 &&    // filled field numeric, missing field(s) null
    hard.confirmShown === false &&                    // negative value: no confirm
    hard.count === after.count &&                     // negative value: nothing saved
    errors.length === 0;

  console.log('BASE ' + JSON.stringify(base));
  console.log('PRE ' + JSON.stringify(pre));
  console.log('CONFIRM_SHOWN ' + confirmShown);
  console.log('AFTER ' + JSON.stringify(after));
  console.log('HARD_ERROR ' + JSON.stringify(hard));
  console.log('ERRORS ' + JSON.stringify(errors));
  console.log('VERIFY_INPUT_PASS ' + pass);
  app.exit(pass ? 0 : 1);
}).catch((e) => { console.error(e); app.exit(1); });
