/* Verifies the breadcrumb department dropdown switches departments. */
const electronEntry = require('electron');
if (typeof electronEntry === 'string') {
  const { spawnSync } = require('child_process');
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const r = spawnSync(electronEntry, [__filename, ...process.argv.slice(2)], { stdio: 'inherit', env });
  process.exit(r.status == null ? 1 : r.status);
}
const { app, BrowserWindow, protocol } = electronEntry;
const path=require('path'); const fs=require('fs'); const os=require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(),'unico-dd-')));
const RENDERER=path.join(__dirname,'..','renderer'); const SCHEME='app';
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.png':'image/png','.ico':'image/x-icon'};
protocol.registerSchemesAsPrivileged([{scheme:SCHEME,privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
function rr(u){const url=new URL(u);let rel=decodeURIComponent(url.pathname);if(!rel||rel==='/')rel='/index.html';const t=path.normalize(path.join(RENDERER,rel));return t.startsWith(RENDERER)?t:path.join(RENDERER,'index.html');}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const errors=[];
app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async()=>{
  protocol.handle(SCHEME,async(req)=>{const fp=rr(req.url);try{const d=await fs.promises.readFile(fp);return new Response(d,{status:200,headers:{'content-type':MIME[path.extname(fp).toLowerCase()]||'application/octet-stream'}});}catch(e){return new Response('NF',{status:404});}});
  const win=new BrowserWindow({show:false,width:1600,height:1000,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.on('console-message',(...a)=>{const m=a.length===1?a[0].message:a[2];if(/SyntaxError|is not defined|Uncaught|TypeError|Cannot read/.test(String(m)))errors.push(String(m).slice(0,200));});
  await win.loadURL(`${SCHEME}://unico/index.html`); await sleep(4200);
  const ev=e=>win.webContents.executeJavaScript(e);
  await ev(`(function(){var it=[].slice.call(document.querySelectorAll('.sb-item')).filter(function(e){return e.querySelector('.badge');})[0]; if(it)it.click();})()`); await sleep(1300);
  const before=await ev(`(function(){var s=document.querySelector('.crumb select'); var h2=document.querySelector('.content h2'); return {hasSelect:!!s, options:s?s.options.length:0, selected:s?s.options[s.selectedIndex].text:null, header:h2?h2.textContent.trim():null};})()`);
  // switch to a different option
  await ev(`(function(){var s=document.querySelector('.crumb select'); if(!s)return; var other=[].slice.call(s.options).find(function(o){return o.value!==s.value;}); var setter=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set; setter.call(s,other.value); s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await sleep(1300);
  const after=await ev(`(function(){var s=document.querySelector('.crumb select'); var h2=document.querySelector('.content h2'); return {selected:s?s.options[s.selectedIndex].text:null, header:h2?h2.textContent.trim():null};})()`);
  const pass = before.hasSelect && before.options===15 && after.header && after.header!==before.header && errors.length===0;
  console.log('BEFORE '+JSON.stringify(before));
  console.log('AFTER  '+JSON.stringify(after));
  console.log('ERRORS '+JSON.stringify(errors));
  console.log('DROPDOWN_PASS '+pass);
  try{ if(win&&!win.isDestroyed()) win.destroy(); }catch(_){}
  app.exit(pass?0:1);
}).catch(e=>{console.error(e);app.exit(1);});
