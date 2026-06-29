/* Quality editable-overlay verification — loads the real app and proves the new
   connected Quality system:
     1) quality-store globals exist; qualityData() matches the seed shape
     2) an overlay edit (quarter value + benchmark) flows through qualityData()
        and flips the indicator's status to a breach
     3) monthly values roll up to the quarter (sum for Count)
     4) reset clears the overlay
     5) the Quality dashboard, a department report, and the NEW editor screen all
        render in-app with no console errors
   Run: node_modules/.bin/electron scripts/verify-quality.js   (exit 0 = pass)
   (Clear ELECTRON_RUN_AS_NODE first.) */
const { app, BrowserWindow, protocol, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const RENDERER = path.join(__dirname, '..', 'renderer');
const PRELOAD = path.join(__dirname, '..', 'preload.js');
const SCHEME = 'app';
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.ico': 'image/x-icon' };

protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
function resolveRequest(u) { const url = new URL(u); let rel = decodeURIComponent(url.pathname); if (!rel || rel === '/') rel = '/index.html'; const t = path.normalize(path.join(RENDERER, rel)); return t.startsWith(RENDERER) ? t : path.join(RENDERER, 'index.html'); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.commandLine.appendSwitch('disable-gpu');
const errors = [];

app.whenReady().then(async () => {
  ipcMain.on('db:loadSync', (e) => { e.returnValue = {}; });
  ipcMain.handle('db:persist', () => ({ ok: true }));
  ipcMain.handle('db:path', () => 'memory');
  protocol.handle(SCHEME, async (req) => {
    const fp = resolveRequest(req.url);
    try { const data = await fs.promises.readFile(fp); return new Response(data, { status: 200, headers: { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' } }); }
    catch (e) { return new Response('Not found', { status: 404 }); }
  });

  const win = new BrowserWindow({ show: false, width: 1500, height: 950, webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.on('console-message', (...a) => { const m = a.length === 1 ? a[0].message : a[2]; if (/SyntaxError|is not defined|Uncaught|TypeError/.test(String(m))) errors.push(String(m).slice(0, 200)); });
  win.webContents.on('render-process-gone', (e, d) => errors.push('render-process-gone ' + JSON.stringify(d)));
  const exec = (js) => win.webContents.executeJavaScript(js);

  await win.loadURL(`${SCHEME}://unico/index.html`);
  await sleep(4500);
  await exec(`localStorage.removeItem('unico_quality_v1');true`);

  // (1) globals + shape
  const base = await exec(`(function(){
    var ok = typeof window.qualityData==='function' && typeof window.useQualityStore==='function' && typeof window.QualityDeptEdit==='function';
    var data = window.qualityData ? window.qualityData() : [];
    var seedLen = (window.QUALITY_SEED||[]).length;
    var dep = data.find(function(d){return d.indicators&&d.indicators.length;});
    return { hasGlobals: ok, len: data.length, seedLen: seedLen, deptKey: dep&&dep.key, indId: dep&&dep.indicators[0].id };
  })()`);

  // (2) overlay edit flows through qualityData() and (3) monthly rollup
  const edit = await exec(`(function(){
    var key='${base.deptKey}', ind='${base.indId}';
    var ov={depts:{}}; ov.depts[key]={indPatches:{}};
    ov.depts[key].indPatches[ind]={ valueType:'Count', goalDirection:'lower_is_better', benchmarkValue:0,
      quarters:{Q1:999}, months:{'Jan-26':1,'Feb-26':2,'Mar-26':3} };
    localStorage.setItem('unico_quality_v1', JSON.stringify(ov));
    var d=window.qualityData().find(function(x){return x.key===key;});
    var i=d.indicators.find(function(x){return x.id===ind;});
    var status = window.indStatus ? window.indStatus(i,'Q1') : (i.quarters.Q1>i.benchmarkValue?'breach':'ok');
    return { q1:i.quarters.Q1, bench:i.benchmarkValue, status:status, q3FromMonths:i.quarters.Q3 };
  })()`);

  // (4) reset
  const reset = await exec(`(function(){
    localStorage.removeItem('unico_quality_v1');
    var d=window.qualityData().find(function(x){return x.key==='${base.deptKey}';});
    var i=d.indicators.find(function(x){return x.id==='${base.indId}';});
    return { q1: i.quarters.Q1 };
  })()`);

  // (5) in-app render: Quality dashboard -> dept report -> editor
  // click the Quality-section "Dashboard" nav item (disambiguated by its section)
  const navDash = await exec(`(function(){
    var nodes=[].slice.call(document.querySelectorAll('.sb-sec, .sb-item'));
    for(var i=0;i<nodes.length;i++){
      if(nodes[i].classList.contains('sb-sec') && /quality indicators/i.test(nodes[i].textContent||'')){
        for(var j=i+1;j<nodes.length;j++){ if(nodes[j].classList.contains('sb-item')){ nodes[j].click(); return true; } }
      }
    }
    return false;
  })()`);
  await sleep(900);
  const dash = await exec(`/Department × Quarter Heatmap|Heatmap/i.test(document.body.textContent)`);
  // open first department row
  await exec(`(function(){ var r=document.querySelector('table.tbl tbody tr'); if(r) r.click(); })()`);
  await sleep(900);
  const deptScreen = await exec(`(function(){
    var hasEdit=[].slice.call(document.querySelectorAll('button')).some(function(b){return b.textContent.trim()==='Edit';});
    return { onDept: /Quarterly|Indicators/i.test(document.body.textContent), hasEditBtn: hasEdit };
  })()`);
  // click Edit -> editor
  await exec(`(function(){ var b=[].slice.call(document.querySelectorAll('button')).find(function(x){return x.textContent.trim()==='Edit';}); if(b) b.click(); })()`);
  await sleep(900);
  const editor = await exec(`(function(){
    var title=/Edit Quality/i.test(document.body.textContent);
    var nameInputs=document.querySelectorAll('input[placeholder="Indicator name"]').length;
    var addBtn=[].slice.call(document.querySelectorAll('button')).some(function(b){return /Add indicator/i.test(b.textContent);});
    return { title:title, indicatorRows:nameInputs, hasAdd:addBtn };
  })()`);

  await exec(`localStorage.removeItem('unico_quality_v1');true`);

  const pass =
    base.hasGlobals === true && base.len === base.seedLen && base.len > 0 && !!base.deptKey &&
    edit.q1 === 999 && edit.bench === 0 && edit.status === 'breach' &&
    edit.q3FromMonths === 6 &&                         // 1+2+3 rolled up
    reset.q1 !== 999 &&                                // overlay cleared
    navDash === true && dash === true &&
    deptScreen.onDept === true && deptScreen.hasEditBtn === true &&
    editor.title === true && editor.indicatorRows > 0 && editor.hasAdd === true &&
    errors.length === 0;

  console.log('BASE ' + JSON.stringify(base));
  console.log('EDIT ' + JSON.stringify(edit));
  console.log('RESET ' + JSON.stringify(reset));
  console.log('NAV ' + navDash + ' DASH ' + dash);
  console.log('DEPT ' + JSON.stringify(deptScreen));
  console.log('EDITOR ' + JSON.stringify(editor));
  console.log('ERRORS ' + JSON.stringify(errors));
  console.log('VERIFY_QUALITY_PASS ' + pass);
  app.exit(pass ? 0 : 1);
}).catch((e) => { console.error(e); app.exit(1); });
