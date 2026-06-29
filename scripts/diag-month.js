/* Verifies lifetime month handling: Data Entry defaults to the next NEW month
   (not an existing one) and offers future months with proper labels. */
const electronEntry = require('electron');
if (typeof electronEntry === 'string') {
  const { spawnSync } = require('child_process');
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const r = spawnSync(electronEntry, [__filename, ...process.argv.slice(2)], { stdio: 'inherit', env });
  process.exit(r.status == null ? 1 : r.status);
}
const { app, BrowserWindow, protocol } = electronEntry;
const path=require('path'); const fs=require('fs'); const os=require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(),'unico-mo-')));
const RENDERER=path.join(__dirname,'..','renderer'); const SCHEME='app';
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.png':'image/png','.ico':'image/x-icon'};
protocol.registerSchemesAsPrivileged([{scheme:SCHEME,privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
function rr(u){const url=new URL(u);let rel=decodeURIComponent(url.pathname);if(!rel||rel==='/')rel='/index.html';const t=path.normalize(path.join(RENDERER,rel));return t.startsWith(RENDERER)?t:path.join(RENDERER,'index.html');}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const errors=[];
app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async()=>{
  protocol.handle(SCHEME,async(req)=>{const fp=rr(req.url);try{const d=await fs.promises.readFile(fp);return new Response(d,{status:200,headers:{'content-type':MIME[path.extname(fp).toLowerCase()]||'application/octet-stream'}});}catch(e){return new Response('NF',{status:404});}});
  const win=new BrowserWindow({show:false,width:1500,height:1000,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.on('console-message',(...a)=>{const m=a.length===1?a[0].message:a[2];if(/SyntaxError|is not defined|Uncaught|TypeError|Cannot read/.test(String(m)))errors.push(String(m).slice(0,200));});
  await win.loadURL(`${SCHEME}://unico/index.html`); await sleep(4200);
  const ev=e=>win.webContents.executeJavaScript(e);
  const mount=await ev(`({hasApp:!!document.querySelector('.app'),depts:(window.UNICO&&window.UNICO.DEPARTMENTS||[]).length, monthCatalog:(window.UNICO.MONTH_ORDER||[]).length})`);
  // go to Data Entry
  await ev(`(function(){var it=[].slice.call(document.querySelectorAll('.sb-item')).filter(function(e){return /^\\s*Data Entry/.test(e.textContent);})[0]; if(it)it.click();})()`); await sleep(1500);
  const m=await ev(`(function(){
    var sels=[].slice.call(document.querySelectorAll('select'));
    var ms=sels.filter(function(s){return [].slice.call(s.options).some(function(o){return /\\d{4}$/.test(o.text);});})[0];
    if(!ms) return {found:false};
    var opts=[].slice.call(ms.options).map(function(o){return o.text;});
    var hint=(document.querySelector('.card-b label span:last-child, .card-b .field')||{});
    var hintText=''; [].slice.call(document.querySelectorAll('.card-b span')).forEach(function(s){ if(/New month|Already entered/.test(s.textContent)) hintText=s.textContent.trim(); });
    return {found:true, selected:ms.options[ms.selectedIndex].text, optionCount:opts.length, hasFuture2027:opts.some(function(t){return /2027/.test(t);}), hasFuture2028:opts.some(function(t){return /2028/.test(t);}), hint:hintText, sampleTail:opts.slice(-3)};
  })()`);
  // Select the FIRST option (an existing/earliest month) -> hint must flip to "Already entered".
  await ev(`(function(){var sels=[].slice.call(document.querySelectorAll('select'));var ms=sels.filter(function(s){return [].slice.call(s.options).some(function(o){return /\\d{4}$/.test(o.text);});})[0]; if(!ms)return; var setter=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set; setter.call(ms,ms.options[0].value); ms.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await sleep(500);
  const existingHint=await ev(`(function(){var h='';[].slice.call(document.querySelectorAll('.card-b span')).forEach(function(s){if(/New month|Already entered/.test(s.textContent))h=s.textContent.trim();});return h;})()`);
  const pass = mount.hasApp && mount.depts===15 && mount.monthCatalog>=200 && m.found && /New month/.test(m.hint) && m.hasFuture2027 && /Already entered/.test(existingHint) && errors.length===0;
  console.log('MOUNT '+JSON.stringify(mount));
  console.log('MONTH(default) '+JSON.stringify(m));
  console.log('EXISTING_HINT '+JSON.stringify(existingHint));
  console.log('ERRORS '+JSON.stringify(errors));
  console.log('MONTH_PASS '+pass);
  try{ if(win&&!win.isDestroyed()) win.destroy(); }catch(_){}
  app.exit(pass?0:1);
}).catch(e=>{console.error(e);app.exit(1);});
