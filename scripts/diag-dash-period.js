/* Drives the dashboard top-bar period pill and confirms KPI values change.
   Self-heals env like smoke.js. */
const electronEntry = require('electron');
if (typeof electronEntry === 'string') {
  const { spawnSync } = require('child_process');
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const r = spawnSync(electronEntry, [__filename, ...process.argv.slice(2)], { stdio: 'inherit', env });
  process.exit(r.status == null ? 1 : r.status);
}
const { app, BrowserWindow, protocol } = electronEntry;
const path=require('path'); const fs=require('fs'); const os=require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(),'unico-dp-')));
const RENDERER=path.join(__dirname,'..','renderer'); const SCHEME='app';
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.png':'image/png','.ico':'image/x-icon'};
protocol.registerSchemesAsPrivileged([{scheme:SCHEME,privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
function rr(u){const url=new URL(u);let rel=decodeURIComponent(url.pathname);if(!rel||rel==='/')rel='/index.html';const t=path.normalize(path.join(RENDERER,rel));return t.startsWith(RENDERER)?t:path.join(RENDERER,'index.html');}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const KPIS=`JSON.stringify([].slice.call(document.querySelectorAll('.kpi .val')).map(e=>e.textContent.trim()))`;
app.whenReady().then(async()=>{
  protocol.handle(SCHEME,async(req)=>{const fp=rr(req.url);try{const d=await fs.promises.readFile(fp);return new Response(d,{status:200,headers:{'content-type':MIME[path.extname(fp).toLowerCase()]||'application/octet-stream'}});}catch(e){return new Response('NF',{status:404});}});
  const win=new BrowserWindow({show:false,width:1600,height:1000,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
  await win.loadURL(`${SCHEME}://unico/index.html`); await sleep(4200);
  const before=JSON.parse(await win.webContents.executeJavaScript(KPIS));
  const pillLabelBefore=await win.webContents.executeJavaScript(`(document.querySelector('.tb-pill .num')||{}).textContent||''`);
  // open the pill, click "Latest month"
  const opened=await win.webContents.executeJavaScript(`(function(){var p=document.querySelector('.tb-pill'); if(!p)return 'NO_PILL'; p.click(); return 'OPENED';})()`);
  await sleep(400);
  const picked=await win.webContents.executeJavaScript(`(function(){var rows=[].slice.call(document.querySelectorAll('div')).filter(function(d){return d.children.length<=2 && /Latest month/.test(d.textContent) && d.textContent.length<24;}); if(!rows.length)return 'NO_PRESET'; rows[0].click(); return 'PICKED';})()`);
  await sleep(900);
  const after=JSON.parse(await win.webContents.executeJavaScript(KPIS));
  const pillLabelAfter=await win.webContents.executeJavaScript(`(document.querySelector('.tb-pill .num')||{}).textContent||''`);
  console.log('PILL '+opened+' / '+picked);
  console.log('LABEL before='+JSON.stringify(pillLabelBefore)+' after='+JSON.stringify(pillLabelAfter));
  console.log('KPIS before='+JSON.stringify(before));
  console.log('KPIS after ='+JSON.stringify(after));
  const changed = opened==='OPENED' && picked==='PICKED' && JSON.stringify(before)!==JSON.stringify(after);
  console.log('DASH_PERIOD_WORKS '+changed);
  try{ if(win&&!win.isDestroyed()) win.destroy(); }catch(_){}
  app.exit(0);
}).catch(e=>{console.error(e);app.exit(1);});
