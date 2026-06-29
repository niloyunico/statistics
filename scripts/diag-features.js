/* Verifies: app mounts (no errors), the dept-detail "Edit Data" button navigates
   to Data Entry, and a custom field added in Data Entry shows in the dept's
   statistics table. Self-heals env like smoke.js. */
const electronEntry = require('electron');
if (typeof electronEntry === 'string') {
  const { spawnSync } = require('child_process');
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const r = spawnSync(electronEntry, [__filename, ...process.argv.slice(2)], { stdio: 'inherit', env });
  process.exit(r.status == null ? 1 : r.status);
}
const { app, BrowserWindow, protocol } = electronEntry;
const path=require('path'); const fs=require('fs'); const os=require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(),'unico-feat-')));
const RENDERER=path.join(__dirname,'..','renderer'); const SCHEME='app';
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.png':'image/png','.ico':'image/x-icon'};
protocol.registerSchemesAsPrivileged([{scheme:SCHEME,privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
function rr(u){const url=new URL(u);let rel=decodeURIComponent(url.pathname);if(!rel||rel==='/')rel='/index.html';const t=path.normalize(path.join(RENDERER,rel));return t.startsWith(RENDERER)?t:path.join(RENDERER,'index.html');}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const errors=[];
const clickByText=(sel,re)=>`(function(){var el=[].slice.call(document.querySelectorAll(${JSON.stringify(sel)})).filter(function(e){return ${re}.test((e.textContent||'').trim());})[0]; if(el){el.click();return true;} return false;})()`;
const setInput=(sel,val)=>`(function(){var el=document.querySelector(${JSON.stringify(sel)}); if(!el)return false; var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(el,${JSON.stringify(val)}); el.dispatchEvent(new Event('input',{bubbles:true})); return true;})()`;

app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async()=>{
  protocol.handle(SCHEME,async(req)=>{const fp=rr(req.url);try{const d=await fs.promises.readFile(fp);return new Response(d,{status:200,headers:{'content-type':MIME[path.extname(fp).toLowerCase()]||'application/octet-stream'}});}catch(e){return new Response('NF',{status:404});}});
  const win=new BrowserWindow({show:false,width:1600,height:1000,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.on('console-message',(...a)=>{const m=a.length===1?a[0].message:a[2];if(/SyntaxError|is not defined|Uncaught|TypeError|Cannot read/.test(String(m)))errors.push(String(m).slice(0,200));});
  await win.loadURL(`${SCHEME}://unico/index.html`); await sleep(4200);
  const ev=expr=>win.webContents.executeJavaScript(expr);

  const mount=await ev(`({hasApp:!!document.querySelector('.app'),depts:(window.UNICO&&window.UNICO.DEPARTMENTS||[]).length})`);

  // Reliable nav: click the first sidebar DEPARTMENT item (has a .badge) -> its detail.
  const openFirstDept=`(function(){var it=[].slice.call(document.querySelectorAll('.sb-item')).filter(function(e){return e.querySelector('.badge');})[0]; if(it){it.click();return (it.textContent||'').trim();} return null;})()`;

  // --- Edit Data button navigation ---
  const deptClicked=await ev(openFirstDept); await sleep(1300);
  const hasEditBtn=await ev(`[].slice.call(document.querySelectorAll('button')).some(function(b){return /Edit Data/.test(b.textContent);})`);
  await ev(clickByText('button',/Edit Data/)); await sleep(1300);
  const onDataEntry=await ev(`(function(){var tabs=[].slice.call(document.querySelectorAll('button')).some(function(b){return /Quick Form/.test(b.textContent);}); var nums=document.querySelectorAll('.card-b input[type=number]').length; return {quickFormTab:tabs, numInputs:nums};})()`);

  // --- Custom field add (now on Data Entry for the clicked dept) ---
  await ev(clickByText('button',/Add custom field/)); await sleep(450);
  await ev(setInput('input[placeholder*="Ventilator"]','Vent Days')); await sleep(250);
  await ev(clickByText('button',/^Add$/)); await sleep(1000);
  const afterAdd=await ev(`(function(){
    var chip=[].slice.call(document.querySelectorAll('.col-chip')).some(function(c){return /Vent Days/.test(c.textContent);});
    var nums=document.querySelectorAll('.card-b input[type=number]').length;
    return {chip:chip, numInputs:nums};
  })()`);
  // fill every number field in the form, then Save
  await ev(`(function(){var ins=[].slice.call(document.querySelectorAll('.card-b input[type=number]'));var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;ins.forEach(function(el,i){s.call(el,String(7+i));el.dispatchEvent(new Event('input',{bubbles:true}));});return ins.length;})()`);
  await sleep(350);
  await ev(clickByText('button',/Save Entry/)); await sleep(1100);

  // --- verify the custom column shows in the dept statistics table ---
  await ev(openFirstDept); await sleep(1500);
  const stats=await ev(`(function(){
    var ths=[].slice.call(document.querySelectorAll('.content table th')).map(function(t){return (t.textContent||'').trim();});
    var hasCol=ths.some(function(h){return /Vent Days/i.test(h);});
    return {headers:ths.slice(0,24), hasVentCol:hasCol};
  })()`);

  const pass = mount.hasApp && mount.depts===15 && deptClicked && hasEditBtn && onDataEntry.quickFormTab && onDataEntry.numInputs>0 &&
    afterAdd.chip && stats.hasVentCol && errors.length===0;
  console.log('MOUNT '+JSON.stringify(mount)+' deptClicked='+JSON.stringify(deptClicked));
  console.log('EDIT_DATA hasBtn='+hasEditBtn+' onDataEntry='+JSON.stringify(onDataEntry));
  console.log('CUSTOM_FIELD '+JSON.stringify(afterAdd));
  console.log('STATS '+JSON.stringify(stats));
  console.log('ERRORS '+JSON.stringify(errors));
  console.log('FEATURES_PASS '+pass);
  try{ if(win&&!win.isDestroyed()) win.destroy(); }catch(_){}
  app.exit(pass?0:1);
}).catch(e=>{console.error(e);app.exit(1);});
