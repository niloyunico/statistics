/* Verifies the "New month" button opens a month/year picker and sets the
   reporting month to any chosen month/year. */
const electronEntry = require('electron');
if (typeof electronEntry === 'string') {
  const { spawnSync } = require('child_process');
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const r = spawnSync(electronEntry, [__filename, ...process.argv.slice(2)], { stdio: 'inherit', env });
  process.exit(r.status == null ? 1 : r.status);
}
const { app, BrowserWindow, protocol } = electronEntry;
const path=require('path'); const fs=require('fs'); const os=require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(),'unico-nm-')));
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
  await ev(`(function(){var it=[].slice.call(document.querySelectorAll('.sb-item')).filter(function(e){return /^\\s*Data Entry/.test(e.textContent);})[0]; if(it)it.click();})()`); await sleep(1500);
  // click the "New month" BUTTON
  const clicked=await ev(`(function(){var b=[].slice.call(document.querySelectorAll('button')).filter(function(x){return /New month/.test(x.textContent);})[0]; if(b){b.click();return true;} return false;})()`);
  await sleep(500);
  const pickerOpen=await ev(`(function(){var ys=[].slice.call(document.querySelectorAll('select')).filter(function(s){return [].slice.call(s.options).some(function(o){return o.text==='2027';});}); var ms=[].slice.call(document.querySelectorAll('select')).filter(function(s){return s.options[0]&&s.options[0].text==='Jan';}); return {hasYearSel:ys.length>0, hasMonSel:ms.length>0};})()`);
  // set picker to Jan 2027 and click Use
  await ev(`(function(){var setter=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set;
    var ms=[].slice.call(document.querySelectorAll('select')).filter(function(s){return s.options[0]&&s.options[0].text==='Jan';})[0];
    var ys=[].slice.call(document.querySelectorAll('select')).filter(function(s){return [].slice.call(s.options).some(function(o){return o.text==='2027';});})[0];
    if(ms){setter.call(ms,'0');ms.dispatchEvent(new Event('change',{bubbles:true}));}
    if(ys){setter.call(ys,'2027');ys.dispatchEvent(new Event('change',{bubbles:true}));}
  })()`); await sleep(300);
  await ev(`(function(){var b=[].slice.call(document.querySelectorAll('button')).filter(function(x){return x.textContent.trim()==='Use';})[0]; if(b)b.click();})()`); await sleep(700);
  const result=await ev(`(function(){var main=[].slice.call(document.querySelectorAll('select')).filter(function(s){return [].slice.call(s.options).some(function(o){return /^[A-Z][a-z]+ \\d{4}$/.test(o.text);});})[0]; return {monthValue: main?main.options[main.selectedIndex].text:null};})()`);
  const pass = clicked && pickerOpen.hasYearSel && pickerOpen.hasMonSel && result.monthValue==='January 2027' && errors.length===0;
  console.log('CLICKED '+clicked);
  console.log('PICKER '+JSON.stringify(pickerOpen));
  console.log('RESULT '+JSON.stringify(result));
  console.log('ERRORS '+JSON.stringify(errors));
  console.log('NEWMONTH_PASS '+pass);
  try{ if(win&&!win.isDestroyed()) win.destroy(); }catch(_){}
  app.exit(pass?0:1);
}).catch(e=>{console.error(e);app.exit(1);});
