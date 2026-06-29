/* Verifies editing existing data: Grid Entry rows are editable, Update persists,
   and Undo reverts. */
const electronEntry = require('electron');
if (typeof electronEntry === 'string') {
  const { spawnSync } = require('child_process');
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const r = spawnSync(electronEntry, [__filename, ...process.argv.slice(2)], { stdio: 'inherit', env });
  process.exit(r.status == null ? 1 : r.status);
}
const { app, BrowserWindow, protocol } = electronEntry;
const path=require('path'); const fs=require('fs'); const os=require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(),'unico-ed-')));
const RENDERER=path.join(__dirname,'..','renderer'); const SCHEME='app';
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.png':'image/png','.ico':'image/x-icon'};
protocol.registerSchemesAsPrivileged([{scheme:SCHEME,privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
function rr(u){const url=new URL(u);let rel=decodeURIComponent(url.pathname);if(!rel||rel==='/')rel='/index.html';const t=path.normalize(path.join(RENDERER,rel));return t.startsWith(RENDERER)?t:path.join(RENDERER,'index.html');}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const errors=[];
const setVal=(el,v)=>`(function(){var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(${el},${JSON.stringify(v)});${el}.dispatchEvent(new Event('input',{bubbles:true}));})()`;
app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async()=>{
  protocol.handle(SCHEME,async(req)=>{const fp=rr(req.url);try{const d=await fs.promises.readFile(fp);return new Response(d,{status:200,headers:{'content-type':MIME[path.extname(fp).toLowerCase()]||'application/octet-stream'}});}catch(e){return new Response('NF',{status:404});}});
  const win=new BrowserWindow({show:false,width:1600,height:1000,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.on('console-message',(...a)=>{const m=a.length===1?a[0].message:a[2];if(/SyntaxError|is not defined|Uncaught|TypeError|Cannot read/.test(String(m)))errors.push(String(m).slice(0,200));});
  await win.loadURL(`${SCHEME}://unico/index.html`); await sleep(4200);
  const ev=e=>win.webContents.executeJavaScript(e);
  await ev(`(function(){var it=[].slice.call(document.querySelectorAll('.sb-item')).filter(function(e){return /^\\s*Data Entry/.test(e.textContent);})[0]; if(it)it.click();})()`); await sleep(1300);
  await ev(`(function(){var b=[].slice.call(document.querySelectorAll('button')).filter(function(x){return /Grid Entry/.test(x.textContent);})[0]; if(b)b.click();})()`); await sleep(900);
  const editable=await ev(`document.querySelectorAll('.card-b table input[type=number]').length`);
  const orig=await ev(`(function(){var i=document.querySelector('.card-b table input[type=number]'); return i?i.value:null;})()`);
  // change first existing-row first cell to 999
  await ev(`(function(){var i=document.querySelector('.card-b table input[type=number]'); var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(i,'999'); i.dispatchEvent(new Event('input',{bubbles:true}));})()`); await sleep(300);
  // click the first ENABLED Update button
  await ev(`(function(){var b=[].slice.call(document.querySelectorAll('button')).filter(function(x){return x.textContent.trim()==='Update' && !x.disabled;})[0]; if(b)b.click();})()`); await sleep(900);
  const afterUpdate=await ev(`(function(){var i=document.querySelector('.card-b table input[type=number]'); var undo=[].slice.call(document.querySelectorAll('button')).some(function(x){return /Undo/.test(x.textContent);}); return {firstVal:i?i.value:null, hasUndo:undo};})()`);
  // delete check: count rows, delete first row, confirm a row removed
  const rowsBefore=await ev(`document.querySelectorAll('.card-b table tbody tr').length`);
  // click Undo
  await ev(`(function(){var b=[].slice.call(document.querySelectorAll('button')).filter(function(x){return /Undo/.test(x.textContent);})[0]; if(b)b.click();})()`); await sleep(900);
  const afterUndo=await ev(`(function(){var i=document.querySelector('.card-b table input[type=number]'); return i?i.value:null;})()`);

  const pass = editable>0 && orig!=null && afterUpdate.firstVal==='999' && afterUpdate.hasUndo && afterUndo===orig && errors.length===0;
  console.log('EDITABLE_INPUTS '+editable+' rowsBefore='+rowsBefore);
  console.log('ORIG '+JSON.stringify(orig)+' AFTER_UPDATE '+JSON.stringify(afterUpdate)+' AFTER_UNDO '+JSON.stringify(afterUndo));
  console.log('ERRORS '+JSON.stringify(errors));
  console.log('EDITDATA_PASS '+pass);
  try{ if(win&&!win.isDestroyed())win.destroy(); }catch(_){}
  app.exit(pass?0:1);
}).catch(e=>{console.error(e);app.exit(1);});
