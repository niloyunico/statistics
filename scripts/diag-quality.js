/* Verifies the 4 new Quality screens render with the imported data, no errors. */
const electronEntry = require('electron');
if (typeof electronEntry === 'string') {
  const { spawnSync } = require('child_process');
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const r = spawnSync(electronEntry, [__filename, ...process.argv.slice(2)], { stdio: 'inherit', env });
  process.exit(r.status == null ? 1 : r.status);
}
const { app, BrowserWindow, protocol } = electronEntry;
const path=require('path'); const fs=require('fs'); const os=require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(),'unico-q-')));
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
  win.webContents.on('console-message',(...a)=>{const m=a.length===1?a[0].message:a[2];if(/SyntaxError|is not defined|Uncaught|TypeError|Cannot read/.test(String(m)))errors.push(String(m).slice(0,220));});
  await win.loadURL(`${SCHEME}://unico/index.html`); await sleep(4300);
  const ev=e=>win.webContents.executeJavaScript(e);
  const base=await ev(`({
    globals:['QualityScorecard','QualityTrends','QualityCatalog','QualityCAPA'].filter(n=>typeof window[n]==='function'),
    depts:(window.QUALITY_SEED||[]).length,
    indicators:(window.QUALITY_SEED||[]).reduce((s,d)=>s+((d.indicators||[]).length),0)
  })`);
  const screens=[['Scorecard',/^Scorecard/],['Trends',/^Trends/],['Catalog',/^Catalog/],['Action Plans',/^Action Plans/]];
  const results={};
  for(const [label,re] of screens){
    const clicked=await ev(`(function(){var it=[].slice.call(document.querySelectorAll('.sb-item')).filter(function(e){return ${re}.test(e.textContent.trim());})[0]; if(it){it.click();return true;} return false;})()`);
    await sleep(1400);
    const r=await ev(`(function(){var c=document.querySelector('.content'); return {children:c?c.children.length:0, text:(c?c.innerText:'').replace(/\\n+/g,' | ').slice(0,90)};})()`);
    results[label]={clicked, children:r.children, text:r.text};
  }
  const allRender=Object.values(results).every(r=>r.clicked&&r.children>0);
  const pass = base.globals.length===4 && base.depts===14 && base.indicators===86 && allRender && errors.length===0;
  console.log('BASE '+JSON.stringify(base));
  Object.keys(results).forEach(k=>console.log('  '+k+': '+JSON.stringify(results[k])));
  console.log('ERRORS '+JSON.stringify(errors));
  console.log('QUALITY_PASS '+pass);
  try{ if(win&&!win.isDestroyed())win.destroy(); }catch(_){}
  app.exit(pass?0:1);
}).catch(e=>{console.error(e);app.exit(1);});
