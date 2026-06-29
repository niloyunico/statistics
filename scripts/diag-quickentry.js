/* Verifies the dept-detail "Quick Entry" button opens Data Entry preselected to
   that department. */
const electronEntry = require('electron');
if (typeof electronEntry === 'string') {
  const { spawnSync } = require('child_process');
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const r = spawnSync(electronEntry, [__filename, ...process.argv.slice(2)], { stdio: 'inherit', env });
  process.exit(r.status == null ? 1 : r.status);
}
const { app, BrowserWindow, protocol } = electronEntry;
const path=require('path'); const fs=require('fs'); const os=require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(),'unico-qe-')));
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
  // open a specific dept (CCU if present, else first)
  await ev(`(function(){var items=[].slice.call(document.querySelectorAll('.sb-item')).filter(function(e){return e.querySelector('.badge');}); var ccu=items.filter(function(e){return /CCU/i.test(e.textContent);})[0]; (ccu||items[0]).click();})()`); await sleep(1300);
  const deptName=await ev(`(function(){var h=document.querySelector('.content h2'); return h?h.textContent.trim():null;})()`);
  const hasQuick=await ev(`[].slice.call(document.querySelectorAll('button')).some(function(b){return /Quick Entry/.test(b.textContent);})`);
  await ev(`(function(){var b=[].slice.call(document.querySelectorAll('button')).filter(function(x){return /Quick Entry/.test(x.textContent);})[0]; if(b)b.click();})()`); await sleep(1300);
  const onEntry=await ev(`(function(){
    var quick=[].slice.call(document.querySelectorAll('button')).some(function(b){return /Quick Form/.test(b.textContent);});
    var sel=[].slice.call(document.querySelectorAll('select')).filter(function(s){return [].slice.call(s.options).some(function(o){return /\\(/.test(o.text);});})[0];
    var deptSel=sel?sel.options[sel.selectedIndex].text:null;
    return {quickForm:quick, deptSel:deptSel};
  })()`);
  const pass = !!deptName && hasQuick && onEntry.quickForm && onEntry.deptSel && onEntry.deptSel.indexOf(deptName)>=0 && errors.length===0;
  console.log('DEPT '+JSON.stringify(deptName)+' hasQuickBtn='+hasQuick);
  console.log('ON_ENTRY '+JSON.stringify(onEntry));
  console.log('ERRORS '+JSON.stringify(errors));
  console.log('QUICKENTRY_PASS '+pass);
  try{ if(win&&!win.isDestroyed())win.destroy(); }catch(_){}
  app.exit(pass?0:1);
}).catch(e=>{console.error(e);app.exit(1);});
