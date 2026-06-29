/* Focused view check: mounts the app, confirms new globals exist, clicks the
   Compare nav item and confirms the Compare view renders with no errors.
   Self-heals ELECTRON_RUN_AS_NODE + uses a throwaway profile (like smoke.js). */
const electronEntry = require('electron');
if (typeof electronEntry === 'string') {
  const { spawnSync } = require('child_process');
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const r = spawnSync(electronEntry, [__filename, ...process.argv.slice(2)], { stdio: 'inherit', env });
  process.exit(r.status == null ? 1 : r.status);
}
const { app, BrowserWindow, protocol } = electronEntry;
const path = require('path'); const fs = require('fs'); const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'unico-cv-')));
const RENDERER = path.join(__dirname, '..', 'renderer');
const SCHEME = 'app';
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.ico': 'image/x-icon' };
protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
function resolveRequest(u){ const url=new URL(u); let rel=decodeURIComponent(url.pathname); if(!rel||rel==='/')rel='/index.html'; const t=path.normalize(path.join(RENDERER,rel)); return t.startsWith(RENDERER)?t:path.join(RENDERER,'index.html'); }
const errors = [];
app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async () => {
  protocol.handle(SCHEME, async (req) => { const fp=resolveRequest(req.url); try{ const d=await fs.promises.readFile(fp); return new Response(d,{status:200,headers:{'content-type':MIME[path.extname(fp).toLowerCase()]||'application/octet-stream'}}); }catch(e){ return new Response('Not found',{status:404}); } });
  const win = new BrowserWindow({ show:false, width:1500, height:950, webPreferences:{ contextIsolation:true, nodeIntegration:false, sandbox:true } });
  win.webContents.on('console-message', (...a)=>{ const m = a.length===1?a[0].message:a[2]; if(/SyntaxError|is not defined|Uncaught|TypeError|Cannot read/.test(String(m))) errors.push(String(m).slice(0,260)); });
  await win.loadURL(`${SCHEME}://unico/index.html`);
  await new Promise(r=>setTimeout(r,4500));
  const globals = await win.webContents.executeJavaScript(`({ UI: typeof window.UI, toast: typeof (window.UI&&window.UI.toast), confirm: typeof (window.UI&&window.UI.confirm), DeptCompare: typeof window.DeptCompare, LockScreen: typeof window.LockScreen, unicoLock: typeof window.unicoLock, GlobalSearch: typeof window.GlobalSearch })`);
  // click the Compare nav item
  const clicked = await win.webContents.executeJavaScript(`(function(){ var items=[].slice.call(document.querySelectorAll('.sb-item')); var c=items.filter(function(e){return /^\\s*Compare/.test(e.textContent)})[0]; if(c){ c.click(); return true; } return false; })()`);
  await new Promise(r=>setTimeout(r,1200));
  const view = await win.webContents.executeJavaScript(`(function(){ var content=document.querySelector('.content'); return { contentChildren: content?content.children.length:0, text:(content?content.innerText:'').replace(/\\n+/g,' | ').slice(0,160) }; })()`);
  // exercise a toast (should not throw) — wait a beat for React 18's async render
  await win.webContents.executeJavaScript(`(function(){ try{ window.UI.toast('test','success'); return true; }catch(e){ return 'ERR:'+e.message; } })()`);
  await new Promise(r=>setTimeout(r,500));
  const toastOk = await win.webContents.executeJavaScript(`!!document.querySelector('.uni-toast')`);
  // open the global search palette via the documented event
  await win.webContents.executeJavaScript(`window.dispatchEvent(new Event('unico:open-search'));true`);
  await new Promise(r=>setTimeout(r,500));
  const search = await win.webContents.executeJavaScript(`(function(){ var p=document.querySelector('.gs-palette'); return { open: !!p, hasInput: !!(p&&p.querySelector('input')) }; })()`);
  const pass = globals.UI==='object' && globals.toast==='function' && globals.confirm==='function' &&
    globals.DeptCompare==='function' && globals.LockScreen==='function' && globals.unicoLock==='object' && globals.GlobalSearch==='function' &&
    clicked && view.contentChildren>0 && toastOk===true && search.open===true && search.hasInput===true && errors.length===0;
  console.log('GLOBALS '+JSON.stringify(globals));
  console.log('COMPARE_CLICKED '+clicked);
  console.log('COMPARE_VIEW '+JSON.stringify(view));
  console.log('TOAST '+JSON.stringify(toastOk));
  console.log('SEARCH '+JSON.stringify(search));
  console.log('ERRORS '+JSON.stringify(errors));
  console.log('CHECK_PASS '+pass);
  try{ if(win&&!win.isDestroyed()) win.destroy(); }catch(_){}
  app.exit(pass?0:1);
}).catch(e=>{ console.error(e); app.exit(1); });
