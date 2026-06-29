/* Verifies PDF fixes: (1) bar fills are SOLID (not white gradient gaps),
   (2) the footer is pinned to the bottom of each page. Renders page 1 to a PNG
   and probes footer position under print-media emulation. */
const electronEntry = require('electron');
if (typeof electronEntry === 'string') {
  const { spawnSync } = require('child_process');
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const r = spawnSync(electronEntry, [__filename, ...process.argv.slice(2)], { stdio: 'inherit', env });
  process.exit(r.status == null ? 1 : r.status);
}
const { app, BrowserWindow, protocol } = electronEntry;
const path=require('path'); const fs=require('fs'); const os=require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(),'unico-pf-')));
const RENDERER=path.join(__dirname,'..','renderer'); const OUT=path.join(__dirname,'..','pdf-fix.png'); const TMP=path.join(os.tmpdir(),'unico-rep.pdf'); const SCHEME='app';
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.png':'image/png','.ico':'image/x-icon'};
protocol.registerSchemesAsPrivileged([{scheme:SCHEME,privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
function rr(u){const url=new URL(u);let rel=decodeURIComponent(url.pathname);if(!rel||rel==='/')rel='/index.html';const t=path.normalize(path.join(RENDERER,rel));return t.startsWith(RENDERER)?t:path.join(RENDERER,'index.html');}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async()=>{
  protocol.handle(SCHEME,async(req)=>{const fp=rr(req.url);try{const d=await fs.promises.readFile(fp);return new Response(d,{status:200,headers:{'content-type':MIME[path.extname(fp).toLowerCase()]||'application/octet-stream'}});}catch(e){return new Response('NF',{status:404});}});
  const win=new BrowserWindow({show:false,width:1500,height:1000,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
  await win.loadURL(`${SCHEME}://unico/index.html`); await sleep(4000);
  const ev=e=>win.webContents.executeJavaScript(e);
  await ev(`(function(){var it=[].slice.call(document.querySelectorAll('.sb-item')).filter(function(e){return /^\\s*Reports/.test(e.textContent);})[0]; if(it)it.click();})()`); await sleep(2500);

  // (1) bar fill solid? — sample a Bar3D front rect's computed fill in #pdf-root
  const fillCheck=await ev(`(function(){var rects=[].slice.call(document.querySelectorAll('#pdf-root svg rect')).filter(function(r){return +r.getAttribute('height')>4;}); var fills=rects.slice(0,6).map(function(r){return getComputedStyle(r).fill;}); var solid=fills.filter(function(f){return /^rgb/.test(f);}).length; var grad=fills.filter(function(f){return /url\\(/.test(f);}).length; return {sample:fills.slice(0,4), solid:solid, grad:grad};})()`);

  // (2) footer pinned to bottom? — under print emulation, measure footer vs page
  let footer={};
  try{
    win.webContents.debugger.attach('1.3');
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{media:'print'});
    await sleep(500);
    footer=await ev(`(function(){
      var pages=[].slice.call(document.querySelectorAll('#pdf-root .pdf-page'));
      var res=pages.slice(0,3).map(function(p){var pr=p.getBoundingClientRect(); var f=p.querySelector('.pdf-foot'); var fr=f?f.getBoundingClientRect():null; var content=p.querySelector('table'); var cr=content?content.getBoundingClientRect():null; return {pageH:Math.round(pr.height), gapToBottom: fr?Math.round(pr.bottom-fr.bottom):null, gapAboveFooter: (fr&&cr)?Math.round(fr.top-cr.bottom):null};});
      return res;
    })()`);
  }catch(e){ footer={error:String(e)}; }

  // render page 1 to PNG for visual confirmation of solid bars
  try{ await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{media:'screen'}); }catch(_){}
  const pdf=await win.webContents.printToPDF({pageSize:'A4',printBackground:true,margins:{top:0,bottom:0,left:0,right:0}});
  fs.writeFileSync(TMP,pdf);
  const pv=new BrowserWindow({show:false,width:900,height:1320,webPreferences:{plugins:true,contextIsolation:true,sandbox:true}});
  try{ await pv.loadURL('file://'+TMP.replace(/\\/g,'/')+'#page=1&zoom=page-fit'); await sleep(3000); const img=await pv.webContents.capturePage(); fs.writeFileSync(OUT,img.toPNG()); }catch(e){ console.log('RENDER_ERR '+e); }

  console.log('FILL '+JSON.stringify(fillCheck));
  console.log('FOOTER '+JSON.stringify(footer));
  console.log('PNG '+OUT);
  try{ if(win&&!win.isDestroyed())win.destroy(); if(pv&&!pv.isDestroyed())pv.destroy(); }catch(_){}
  app.exit(0);
}).catch(e=>{console.error(e);app.exit(1);});
