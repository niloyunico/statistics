/* Diagnostic for the "PDF chart bars missing" bug. Opens Reports, inspects the
   #pdf-root chart bars' computed transform/size in normal DOM and under print
   media emulation (via the in-process debugger). Self-heals env like smoke.js. */
const electronEntry = require('electron');
if (typeof electronEntry === 'string') {
  const { spawnSync } = require('child_process');
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const r = spawnSync(electronEntry, [__filename, ...process.argv.slice(2)], { stdio: 'inherit', env });
  process.exit(r.status == null ? 1 : r.status);
}
const { app, BrowserWindow, protocol } = electronEntry;
const path = require('path'); const fs = require('fs'); const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'unico-diag-')));
const RENDERER = path.join(__dirname, '..', 'renderer');
const SCHEME = 'app';
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.ico': 'image/x-icon' };
protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
function resolveRequest(u){ const url=new URL(u); let rel=decodeURIComponent(url.pathname); if(!rel||rel==='/')rel='/index.html'; const t=path.normalize(path.join(RENDERER,rel)); return t.startsWith(RENDERER)?t:path.join(RENDERER,'index.html'); }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const PROBE = `(function(){
  var root=document.getElementById('pdf-root');
  if(!root) return {pdfRoot:false};
  var gs=[].slice.call(root.querySelectorAll('g'));
  var scaled=gs.filter(function(g){return (g.getAttribute('style')||'').indexOf('scaleY')>=0 || /scaleY/.test(g.style.transform||'');});
  var sample=scaled.slice(0,4).map(function(g){
    var cs=getComputedStyle(g); var bb=g.getBoundingClientRect();
    return { transform: cs.transform, h: Math.round(bb.height) };
  });
  var rects=[].slice.call(root.querySelectorAll('svg rect')).filter(function(r){return +r.getAttribute('height')>2;});
  var texts=[].slice.call(root.querySelectorAll('svg text'));
  var valueLabels=texts.filter(function(t){return /^[0-9,]+$/.test((t.textContent||'').trim());});
  return {
    pdfRoot:true,
    pages: root.querySelectorAll('.pdf-page').length,
    scaledGroups: scaled.length,
    sampleTransforms: sample,
    barRectsWithHeight: rects.length,
    valueLabelTexts: valueLabels.length
  };
})()`;

app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async () => {
  protocol.handle(SCHEME, async (req)=>{ const fp=resolveRequest(req.url); try{ const d=await fs.promises.readFile(fp); return new Response(d,{status:200,headers:{'content-type':MIME[path.extname(fp).toLowerCase()]||'application/octet-stream'}});}catch(e){return new Response('NF',{status:404});}});
  const win=new BrowserWindow({show:false,width:1500,height:950,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
  await win.loadURL(`${SCHEME}://unico/index.html`);
  await sleep(4000);
  // navigate to Reports
  await win.webContents.executeJavaScript(`(function(){var it=[].slice.call(document.querySelectorAll('.sb-item')).filter(function(e){return /^\\s*Reports/.test(e.textContent)})[0]; if(it) it.click(); return !!it;})()`);
  await sleep(2500); // well past the 60ms mount + 0.8s entrance animation
  const normal = await win.webContents.executeJavaScript(PROBE);

  // Emulate print media (what printToPDF / window.print render under)
  let printed = {};
  try {
    win.webContents.debugger.attach('1.3');
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { media: 'print' });
    await sleep(600);
    printed = await win.webContents.executeJavaScript(PROBE);
  } catch (e) { printed = { error: String(e) }; }

  console.log('NORMAL '+JSON.stringify(normal));
  console.log('PRINT  '+JSON.stringify(printed));
  try{ if(win&&!win.isDestroyed()) win.destroy(); }catch(_){}
  app.exit(0);
}).catch(e=>{ console.error(e); app.exit(1); });
