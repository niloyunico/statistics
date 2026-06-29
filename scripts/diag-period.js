/* Tests whether the Reports "Reporting period" control actually filters the
   report. Opens Reports, reads the preview month count, changes the period
   select, and re-reads. Self-heals env like smoke.js. */
const electronEntry = require('electron');
if (typeof electronEntry === 'string') {
  const { spawnSync } = require('child_process');
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const r = spawnSync(electronEntry, [__filename, ...process.argv.slice(2)], { stdio: 'inherit', env });
  process.exit(r.status == null ? 1 : r.status);
}
const { app, BrowserWindow, protocol } = electronEntry;
const path = require('path'); const fs = require('fs'); const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'unico-per-')));
const RENDERER = path.join(__dirname, '..', 'renderer'); const SCHEME='app';
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.png':'image/png','.ico':'image/x-icon'};
protocol.registerSchemesAsPrivileged([{scheme:SCHEME,privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
function rr(u){const url=new URL(u);let rel=decodeURIComponent(url.pathname);if(!rel||rel==='/')rel='/index.html';const t=path.normalize(path.join(RENDERER,rel));return t.startsWith(RENDERER)?t:path.join(RENDERER,'index.html');}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// Read a snapshot of the report preview: header range, config-summary text,
// preview table row count, and chart x-axis labels.
const SNAP = `(function(){
  function txt(sel){var e=document.querySelector(sel);return e?e.textContent.trim():null;}
  var preview=document.querySelector('.content');
  var rows=preview?preview.querySelectorAll('table.tbl tbody tr').length:0;
  var xlabels=[].slice.call(preview?preview.querySelectorAll('svg text'):[]).map(t=>(t.textContent||'').trim()).filter(t=>/^[A-Za-z]{3}/.test(t));
  // grab the config summary box text (contains "N months")
  var summary=null;
  [].slice.call(document.querySelectorAll('.content div')).forEach(function(d){ if(/month/.test(d.textContent)&&/departments?·|·/.test(d.textContent)&&d.children.length<=6&&!summary&&d.textContent.length<120) summary=d.textContent.trim(); });
  return JSON.stringify({rows:rows, xlabels:xlabels.slice(0,20), header:txt('.content img')?null:null});
})()`;

app.whenReady().then(async () => {
  protocol.handle(SCHEME, async (req)=>{const fp=rr(req.url);try{const d=await fs.promises.readFile(fp);return new Response(d,{status:200,headers:{'content-type':MIME[path.extname(fp).toLowerCase()]||'application/octet-stream'}});}catch(e){return new Response('NF',{status:404});}});
  const win=new BrowserWindow({show:false,width:1600,height:1000,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
  await win.loadURL(`${SCHEME}://unico/index.html`);
  await sleep(4000);
  await win.webContents.executeJavaScript(`(function(){var it=[].slice.call(document.querySelectorAll('.sb-item')).filter(function(e){return /^\\s*Reports/.test(e.textContent)})[0]; if(it) it.click(); return !!it;})()`);
  await sleep(2000);

  const before = JSON.parse(await win.webContents.executeJavaScript(SNAP));
  // find the reporting-period <select> (the one with an 'apr' option) and set it to 'apr'
  const changed = await win.webContents.executeJavaScript(`(function(){
    var sel=[].slice.call(document.querySelectorAll('select')).filter(function(s){return [].slice.call(s.options).some(function(o){return o.value==='apr';});})[0];
    if(!sel) return 'NO_SELECT';
    var setter=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set;
    setter.call(sel,'apr'); sel.dispatchEvent(new Event('change',{bubbles:true}));
    return 'OK';
  })()`);
  await sleep(900);
  const afterApr = JSON.parse(await win.webContents.executeJavaScript(SNAP));
  // now set to 'q1' (3 months)
  await win.webContents.executeJavaScript(`(function(){var sel=[].slice.call(document.querySelectorAll('select')).filter(function(s){return [].slice.call(s.options).some(function(o){return o.value==='apr';});})[0];if(sel){var setter=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set;setter.call(sel,'q1');sel.dispatchEvent(new Event('change',{bubbles:true}));}return 1;})()`);
  await sleep(900);
  const afterQ1 = JSON.parse(await win.webContents.executeJavaScript(SNAP));

  console.log('CHANGED '+changed);
  console.log('BEFORE(all) rows='+before.rows+' xlabels='+JSON.stringify(before.xlabels));
  console.log('AFTER(apr) rows='+afterApr.rows+' xlabels='+JSON.stringify(afterApr.xlabels));
  console.log('AFTER(q1)  rows='+afterQ1.rows+' xlabels='+JSON.stringify(afterQ1.xlabels));
  const periodWorks = changed==='OK' && (before.rows!==afterApr.rows || JSON.stringify(before.xlabels)!==JSON.stringify(afterApr.xlabels));
  console.log('REPORT_PERIOD_WORKS '+periodWorks);
  try{ if(win&&!win.isDestroyed()) win.destroy(); }catch(_){}
  app.exit(0);
}).catch(e=>{ console.error(e); app.exit(1); });
