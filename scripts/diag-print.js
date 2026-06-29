/* Verifies print scoping: general print (top-bar) prints current content (not
   blank); report export (body.pdf-export-mode) isolates #pdf-root. Renders the
   report PDF (export mode) to a PNG to confirm it still produces the report. */
const electronEntry = require('electron');
if (typeof electronEntry === 'string') {
  const { spawnSync } = require('child_process');
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const r = spawnSync(electronEntry, [__filename, ...process.argv.slice(2)], { stdio: 'inherit', env });
  process.exit(r.status == null ? 1 : r.status);
}
const { app, BrowserWindow, protocol } = electronEntry;
const path=require('path'); const fs=require('fs'); const os=require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(),'unico-pr-')));
const RENDERER=path.join(__dirname,'..','renderer'); const OUT=path.join(__dirname,'..','print-report.png'); const TMP=path.join(os.tmpdir(),'unico-pr.pdf'); const SCHEME='app';
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.png':'image/png','.ico':'image/x-icon'};
protocol.registerSchemesAsPrivileged([{scheme:SCHEME,privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
function rr(u){const url=new URL(u);let rel=decodeURIComponent(url.pathname);if(!rel||rel==='/')rel='/index.html';const t=path.normalize(path.join(RENDERER,rel));return t.startsWith(RENDERER)?t:path.join(RENDERER,'index.html');}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async()=>{
  protocol.handle(SCHEME,async(req)=>{const fp=rr(req.url);try{const d=await fs.promises.readFile(fp);return new Response(d,{status:200,headers:{'content-type':MIME[path.extname(fp).toLowerCase()]||'application/octet-stream'}});}catch(e){return new Response('NF',{status:404});}});
  const win=new BrowserWindow({show:false,width:1600,height:1000,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
  await win.loadURL(`${SCHEME}://unico/index.html`); await sleep(4200);
  const ev=e=>win.webContents.executeJavaScript(e);
  // Phase 1+2 on the Dashboard (default view): probe computed display under print emulation
  let probe={};
  try{
    win.webContents.debugger.attach('1.3');
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{media:'print'});
    await sleep(400);
    const disp=`(function(){function g(s){var e=document.querySelector(s);return e?getComputedStyle(e).display:'none';} return {root:g('#root'),pdf:g('#pdf-root'),sb:g('.sb'),topbar:g('.topbar'),content:g('.content')};})()`;
    const general=JSON.parse(await ev(`JSON.stringify(${disp})`));
    await ev(`document.body.classList.add('pdf-export-mode')`); await sleep(300);
    const exportMode=JSON.parse(await ev(`JSON.stringify(${disp})`));
    await ev(`document.body.classList.remove('pdf-export-mode')`);
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{media:'screen'});
    win.webContents.debugger.detach();
    probe={general,exportMode};
  }catch(e){ probe={error:String(e)}; }

  // Phase 3: go to Reports, set export mode, printToPDF -> render -> confirm it's the report
  await ev(`(function(){var it=[].slice.call(document.querySelectorAll('.sb-item')).filter(function(e){return /^\\s*Reports/.test(e.textContent);})[0]; if(it)it.click();})()`); await sleep(2000);
  await ev(`document.body.classList.add('pdf-export-mode')`); await sleep(200);
  const pdf=await win.webContents.printToPDF({pageSize:'A4',printBackground:true,margins:{top:0,bottom:0,left:0,right:0}});
  await ev(`document.body.classList.remove('pdf-export-mode')`);
  fs.writeFileSync(TMP,pdf);
  const pv=new BrowserWindow({show:false,width:900,height:1320,webPreferences:{plugins:true,contextIsolation:true,sandbox:true}});
  try{ await pv.loadURL('file://'+TMP.replace(/\\/g,'/')+'#page=1&zoom=page-fit'); await sleep(2800); fs.writeFileSync(OUT,(await pv.webContents.capturePage()).toPNG()); }catch(e){ console.log('RENDER_ERR '+e); }

  const g=probe.general||{}, x=probe.exportMode||{};
  const generalOk = g.root!=='none' && g.sb==='none' && g.topbar==='none' && g.pdf==='none';   // top-bar print = current content
  const exportOk  = x.root==='none' && x.pdf!=='none';                                         // report export = #pdf-root only
  console.log('GENERAL_PRINT '+JSON.stringify(g)+' ok='+generalOk);
  console.log('EXPORT_MODE   '+JSON.stringify(x)+' ok='+exportOk);
  console.log('PRINT_PASS '+(generalOk&&exportOk)+'  PNG='+OUT);
  try{ if(win&&!win.isDestroyed())win.destroy(); if(pv&&!pv.isDestroyed())pv.destroy(); }catch(_){}
  app.exit(generalOk&&exportOk?0:1);
}).catch(e=>{console.error(e);app.exit(1);});
