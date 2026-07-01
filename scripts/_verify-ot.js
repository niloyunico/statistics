/* Exact screenshot scenario: area "CT OT", indicator "OT Utilization Rate".
   Expect: NO mode switch (.seg), NO Nurse group breakdown, just the direct entry. */
const electronEntry = require('electron');
if (typeof electronEntry === 'string') {
  const { spawnSync } = require('child_process');
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const r = spawnSync(electronEntry, [__filename, ...process.argv.slice(2)], { stdio: 'inherit', env });
  process.exit(r.status == null ? 1 : r.status);
}
const { app, BrowserWindow } = electronEntry;
const errors = [];
app.commandLine.appendSwitch('disable-gpu');
const wait = (ms) => new Promise(r => setTimeout(r, ms));

const setSel = (labelRe, optRe) => `(function(){
  function setV(el,v){var s=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set;s.call(el,v);el.dispatchEvent(new Event('change',{bubbles:true}));}
  var root=document.getElementById('hh'); var sels=[].slice.call(root.querySelectorAll('select'));
  var sel=sels.filter(function(s){return [].slice.call(s.options).some(function(o){return ${optRe}.test(o.textContent);});})[0];
  if(!sel) return null;
  var o=[].slice.call(sel.options).filter(function(x){return ${optRe}.test(x.textContent);})[0];
  setV(sel,o.value); return o.textContent.trim();
})()`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1400, height: 1400, webPreferences: { contextIsolation: true, nodeIntegration: false } });
  win.webContents.on('console-message', (e, l, m) => { if (/SyntaxError|is not defined|Uncaught|TypeError|Cannot read/.test(String(m))) errors.push(String(m).slice(0, 200)); });
  await win.loadURL('http://localhost:8099/');
  await wait(3000);
  await win.webContents.executeJavaScript(`(function(){var div=document.createElement('div'); div.id='hh'; document.body.appendChild(div); ReactDOM.createRoot(div).render(React.createElement(window.DataQualityForm, {}));})()`);
  await wait(900);

  const gotArea = await win.webContents.executeJavaScript(setSel('area', '/^\\s*CT OT\\s*$/'));
  await wait(600);
  const gotInd = await win.webContents.executeJavaScript(setSel('ind', '/OT Utilization Rate/i'));
  await wait(800);
  const probe = await win.webContents.executeJavaScript(`(function(){
    var root=document.getElementById('hh');
    return {
      area: (function(){var s=[].slice.call(root.querySelectorAll('select'))[0]; return s?s.options[s.selectedIndex].textContent.trim():'';})(),
      hasSeg: !!root.querySelector('.seg'),
      hasNurse: [].slice.call(root.querySelectorAll('div')).some(function(d){return d.childElementCount===0 && d.textContent.trim()==='Nurse';}),
      hasDirect: /\\(enter the number directly\\)/.test(root.innerHTML)
    };
  })()`);
  console.log('GOT_AREA', JSON.stringify(gotArea));
  console.log('GOT_IND', JSON.stringify(gotInd));
  console.log('PROBE', JSON.stringify(probe));
  console.log('ERRORS', JSON.stringify(errors));
  const pass = gotInd && !probe.hasSeg && !probe.hasNurse && probe.hasDirect && errors.length === 0;
  console.log('RESULT', JSON.stringify({ pass }));
  win.destroy(); app.quit(); process.exit(pass ? 0 : 2);
}).catch(e => { console.error('HARNESS_ERR', e); process.exit(3); });
