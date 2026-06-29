/* Generates a REAL PDF of the Report via printToPDF, then renders that PDF back
   to a PNG (Chromium's built-in PDF viewer + capturePage) so we can SEE whether
   the chart bars actually rasterize. Self-heals env like smoke.js.
   Usage: node scripts/diag-pdf2.js [outPngPath] */
const electronEntry = require('electron');
if (typeof electronEntry === 'string') {
  const { spawnSync } = require('child_process');
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const r = spawnSync(electronEntry, [__filename, ...process.argv.slice(2)], { stdio: 'inherit', env });
  process.exit(r.status == null ? 1 : r.status);
}
const { app, BrowserWindow, protocol } = electronEntry;
const path = require('path'); const fs = require('fs'); const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'unico-pdf2-')));
const RENDERER = path.join(__dirname, '..', 'renderer');
const OUT_PNG = process.argv[2] || path.join(__dirname, '..', 'pdf-preview.png');
const TMP_PDF = path.join(os.tmpdir(), 'unico-report-test.pdf');
const SCHEME = 'app';
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.ico': 'image/x-icon' };
protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
function resolveRequest(u){ const url=new URL(u); let rel=decodeURIComponent(url.pathname); if(!rel||rel==='/')rel='/index.html'; const t=path.normalize(path.join(RENDERER,rel)); return t.startsWith(RENDERER)?t:path.join(RENDERER,'index.html'); }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

app.whenReady().then(async () => {
  protocol.handle(SCHEME, async (req)=>{ const fp=resolveRequest(req.url); try{ const d=await fs.promises.readFile(fp); return new Response(d,{status:200,headers:{'content-type':MIME[path.extname(fp).toLowerCase()]||'application/octet-stream'}});}catch(e){return new Response('NF',{status:404});}});
  const win=new BrowserWindow({show:false,width:1500,height:950,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
  await win.loadURL(`${SCHEME}://unico/index.html`);
  await sleep(4000);
  await win.webContents.executeJavaScript(`(function(){var it=[].slice.call(document.querySelectorAll('.sb-item')).filter(function(e){return /^\\s*Reports/.test(e.textContent)})[0]; if(it) it.click(); return !!it;})()`);
  await sleep(2500);

  const pdf = await win.webContents.printToPDF({ pageSize:'A4', landscape:false, printBackground:true, margins:{top:0,bottom:0,left:0,right:0} });
  fs.writeFileSync(TMP_PDF, pdf);
  console.log('PDF_BYTES '+pdf.length);

  // Render the produced PDF back to an image via Chromium's PDF viewer.
  const pv = new BrowserWindow({ show:false, width:900, height:1320, webPreferences:{ plugins:true, contextIsolation:true, sandbox:true } });
  try {
    await pv.loadURL('file://' + TMP_PDF.replace(/\\/g,'/') + '#page=1&zoom=page-fit');
    await sleep(3500);
    const img = await pv.webContents.capturePage();
    fs.writeFileSync(OUT_PNG, img.toPNG());
    console.log('PNG_WRITTEN '+OUT_PNG+' bytes='+img.toPNG().length);
  } catch (e) { console.log('RENDER_ERR '+String(e)); }

  try{ if(win&&!win.isDestroyed()) win.destroy(); }catch(_){}
  try{ if(pv&&!pv.isDestroyed()) pv.destroy(); }catch(_){}
  app.exit(0);
}).catch(e=>{ console.error(e); app.exit(1); });
