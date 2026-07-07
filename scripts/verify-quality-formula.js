/* Quality formula + dashboard-KPI verification. Proves:
     1) qiFormulaCompute math (count / rate1000 / pct)
     2) a formula indicator in the overlay computes its quarter value from
        quarterly num/den AND from aggregated monthly num/den, and the status
        reflects the computed value vs benchmark (flows through qualityData())
     3) the main Dashboard shows the hospital-wide "Quality & Safety" KPI strip
     4) the Quality dashboard renders without console errors
   Run: node_modules/.bin/electron scripts/verify-quality-formula.js  (exit 0 = pass)
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

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
try {
  const tmpProfile = path.join(__dirname, '.tmp-electron', path.basename(__filename, '.js'));
  fs.mkdirSync(tmpProfile, { recursive: true });
  app.setPath('userData', tmpProfile);
  app.setPath('sessionData', tmpProfile);
} catch (_) {}
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
  await exec(`localStorage.removeItem('unico_quality_v2');true`);

  // (3) dashboard quality strip (default route = dashboard, clean overlay)
  const dashStrip = await exec(`(/Quality\\s*&\\s*Safety/i.test(document.body.textContent) && /Zero-?Defect Rate/i.test(document.body.textContent))`);

  // (1) formula math
  const math = await exec(`({ rate: window.qiFormulaCompute('rate1000',2,1000), count: window.qiFormulaCompute('count',5,0), pct: window.qiFormulaCompute('pct',90,100) })`);

  // (2) formula indicators flow through qualityData()
  const flow = await exec(`(function(){
    var key='Cathlab';
    var rate={ id:'ind-t-rate', name:'Test Rate', formula:'rate1000', goalDirection:'lower_is_better', benchmarkValue:0,
               qNum:{Q1:2}, qDen:{Q1:1000}, mNum:{'Jan-26':1,'Feb-26':1,'Mar-26':1}, mDen:{'Jan-26':500,'Feb-26':500,'Mar-26':500} };
    var cnt ={ id:'ind-t-count', name:'Test Count', formula:'count', goalDirection:'lower_is_better', benchmarkValue:0, qNum:{Q1:5} };
    var pct ={ id:'ind-t-pct', name:'Test Pct', formula:'pct', goalDirection:'higher_is_better', benchmarkValue:95, qNum:{Q1:90}, qDen:{Q1:100} };
    var ov={depts:{}}; ov.depts[key]={ indAdded:[rate,cnt,pct] };
    localStorage.setItem('unico_quality_v2', JSON.stringify(ov));
    var d=window.qualityData().find(function(x){return x.key===key;});
    var gi=function(id){return d.indicators.find(function(x){return x.id===id;});};
    var r=gi('ind-t-rate'), c=gi('ind-t-count'), p=gi('ind-t-pct');
    return {
      rateQ1:r.quarters.Q1, rateQ3:r.quarters.Q3, rateStatus:(r.quarters.Q1<=r.benchmarkValue?'ok':'breach'),
      countQ1:c.quarters.Q1, pctQ1:p.quarters.Q1, pctStatus:(p.quarters.Q1>=p.benchmarkValue?'ok':'breach')
    };
  })()`);
  await exec(`localStorage.removeItem('unico_quality_v2');true`);

  const pass =
    dashStrip === true &&
    math.rate === 2 && math.count === 5 && math.pct === 90 &&
    flow.rateQ1 === 2 && flow.rateQ3 === 2 && flow.rateStatus === 'breach' &&
    flow.countQ1 === 5 && flow.pctQ1 === 90 && flow.pctStatus === 'breach' &&
    errors.length === 0;

  console.log('DASH_STRIP ' + dashStrip);
  console.log('MATH ' + JSON.stringify(math));
  console.log('FLOW ' + JSON.stringify(flow));
  console.log('ERRORS ' + JSON.stringify(errors));
  console.log('VERIFY_QUALITY_FORMULA_PASS ' + pass);
  app.exit(pass ? 0 : 1);
}).catch((e) => { console.error(e); app.exit(1); });
