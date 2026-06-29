/* Verifies: new chart globals, dept-detail new styles render, charts gallery,
   reports multi-style + header editor, and renders a report PDF (with combo +
   custom header) to a PNG for visual confirmation. */
const electronEntry = require('electron');
if (typeof electronEntry === 'string') {
  const { spawnSync } = require('child_process');
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const r = spawnSync(electronEntry, [__filename, ...process.argv.slice(2)], { stdio: 'inherit', env });
  process.exit(r.status == null ? 1 : r.status);
}
const { app, BrowserWindow, protocol } = electronEntry;
const path=require('path'); const fs=require('fs'); const os=require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(),'unico-ch-')));
const RENDERER=path.join(__dirname,'..','renderer'); const OUT=path.join(__dirname,'..','charts-report.png'); const TMP=path.join(os.tmpdir(),'unico-charts-rep.pdf'); const SCHEME='app';
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.png':'image/png','.ico':'image/x-icon'};
protocol.registerSchemesAsPrivileged([{scheme:SCHEME,privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
function rr(u){const url=new URL(u);let rel=decodeURIComponent(url.pathname);if(!rel||rel==='/')rel='/index.html';const t=path.normalize(path.join(RENDERER,rel));return t.startsWith(RENDERER)?t:path.join(RENDERER,'index.html');}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const errors=[];
app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async()=>{
  protocol.handle(SCHEME,async(req)=>{const fp=rr(req.url);try{const d=await fs.promises.readFile(fp);return new Response(d,{status:200,headers:{'content-type':MIME[path.extname(fp).toLowerCase()]||'application/octet-stream'}});}catch(e){return new Response('NF',{status:404});}});
  const win=new BrowserWindow({show:false,width:1700,height:1050,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.on('console-message',(...a)=>{const m=a.length===1?a[0].message:a[2];if(/SyntaxError|is not defined|Uncaught|TypeError|Cannot read/.test(String(m)))errors.push(String(m).slice(0,220));});
  await win.loadURL(`${SCHEME}://unico/index.html`); await sleep(4300);
  const ev=e=>win.webContents.executeJavaScript(e);
  const globals=await ev(`['ComboChart','HBarChart','StackedPctBar','AreaTargetChart','ChartsGallery'].filter(n=>typeof window[n]==='function')`);

  // dept detail: open a multi-metric dept (ER) and try new chart styles
  await ev(`(function(){var it=[].slice.call(document.querySelectorAll('.sb-item')).filter(function(e){return e.querySelector('.badge')&&/^\\s*ER/.test(e.textContent);})[0]||[].slice.call(document.querySelectorAll('.sb-item')).filter(function(e){return e.querySelector('.badge');})[0]; if(it)it.click();})()`); await sleep(1200);
  const deptStyles={};
  for(const label of ['Bar+Line','Area','Horiz']){
    await ev(`(function(){var b=[].slice.call(document.querySelectorAll('.seg button')).filter(function(x){return x.textContent.trim()===${JSON.stringify(label)};})[0]; if(b)b.click();})()`); await sleep(700);
    deptStyles[label]=await ev(`!!document.querySelector('.card-b svg')`);
  }
  // gallery
  await ev(`(function(){var b=[].slice.call(document.querySelectorAll('button')).filter(function(x){return /All Charts/.test(x.textContent);})[0]; if(b)b.click();})()`); await sleep(1800);
  const gallery=await ev(`(function(){var svgs=document.querySelectorAll('.content .card svg').length; var png=[].slice.call(document.querySelectorAll('button')).filter(function(b){return b.textContent.trim()==='PNG';}).length; var exp=[].slice.call(document.querySelectorAll('button')).some(function(b){return /Export all to PDF/.test(b.textContent);}); return {chartSvgs:svgs, pngButtons:png, hasExportAll:exp};})()`);

  // reports: multi-style + header editor
  await ev(`(function(){var it=[].slice.call(document.querySelectorAll('.sb-item')).filter(function(e){return /^\\s*Reports/.test(e.textContent);})[0]; if(it)it.click();})()`); await sleep(1500);
  await ev(`(function(){var b=[].slice.call(document.querySelectorAll('button')).filter(function(x){return x.textContent.trim()==='Bar+Line';})[0]; if(b)b.click();})()`); await sleep(400); // add combo style
  await ev(`(function(){var i=document.querySelector('input[placeholder="Report title (header)"]'); if(i){var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(i,'BOARD QUALITY REVIEW'); i.dispatchEvent(new Event('input',{bubbles:true}));}})()`); await sleep(900);
  const reports=await ev(`(function(){var prev=document.querySelector('.content'); var hasTitle=/BOARD QUALITY REVIEW/.test(prev?prev.innerText:''); var chartCount=(prev?prev.querySelectorAll('svg').length:0); return {hasCustomTitle:hasTitle, previewSvgs:chartCount};})()`);

  // render report PDF -> PNG (reflects current chartStyles incl combo + custom header)
  const pdf=await win.webContents.printToPDF({pageSize:'A4',printBackground:true,margins:{top:0,bottom:0,left:0,right:0}});
  fs.writeFileSync(TMP,pdf);
  const pv=new BrowserWindow({show:false,width:900,height:1320,webPreferences:{plugins:true,contextIsolation:true,sandbox:true}});
  try{ await pv.loadURL('file://'+TMP.replace(/\\/g,'/')+'#page=1&zoom=page-fit'); await sleep(3000); fs.writeFileSync(OUT, (await pv.webContents.capturePage()).toPNG()); }catch(e){ console.log('RENDER_ERR '+e); }

  const pass = globals.length===5 && Object.values(deptStyles).every(Boolean) && gallery.chartSvgs>=4 && gallery.pngButtons>0 && gallery.hasExportAll && reports.hasCustomTitle && reports.previewSvgs>0 && errors.length===0;
  console.log('GLOBALS '+JSON.stringify(globals));
  console.log('DEPT_STYLES '+JSON.stringify(deptStyles));
  console.log('GALLERY '+JSON.stringify(gallery));
  console.log('REPORTS '+JSON.stringify(reports));
  console.log('ERRORS '+JSON.stringify(errors));
  console.log('CHARTS_PASS '+pass+'  PNG='+OUT);
  try{ if(win&&!win.isDestroyed())win.destroy(); if(pv&&!pv.isDestroyed())pv.destroy(); }catch(_){}
  app.exit(pass?0:1);
}).catch(e=>{console.error(e);app.exit(1);});
