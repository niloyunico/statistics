/* Verifies the on-disk database round-trip using the REAL main.js + preload.js:
   Phase 1: launch app, write a key, confirm it reaches unico-database.json on disk.
   Phase 2: relaunch, confirm the key is loaded back FROM disk (hydration).
   Run: node scripts/verify-db.js   (exit 0 = pass) */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ELECTRON = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const PORT = 9223;
const KEY = '__dbtest';
const VAL = 'DBVAL_777';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } }); }).on('error', reject);
  });
}

function launch() {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  return spawn(ELECTRON, ['.', `--remote-debugging-port=${PORT}`, '--no-sandbox'], { cwd: ROOT, env, stdio: 'ignore' });
}

async function waitForPage() {
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    try { const t = await getJSON(`http://127.0.0.1:${PORT}/json`); const p = t.find((x) => x.type === 'page' && x.webSocketDebuggerUrl); if (p) return p; } catch (_) {}
  }
  return null;
}

function evaluate(page, expression, awaitPromise) {
  return new Promise((resolve) => {
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: !!awaitPromise } }));
    ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id === 1) { try { ws.close(); } catch (_) {} resolve(msg.result && msg.result.result && msg.result.result.value); } };
    ws.onerror = () => resolve(null);
    setTimeout(() => resolve(null), 9000);
  });
}

(async () => {
  // Phase 1 — write and persist to disk.
  let child = launch();
  let page = await waitForPage();
  if (!page) { console.log('VERIFY_DB_PASS false  (app did not start - phase 1)'); child.kill(); process.exit(1); }
  await sleep(4500);
  const p1 = JSON.parse(await evaluate(page, `(async function(){
    var out={hasNative:!!window.unicoNative};
    try{ localStorage.setItem('${KEY}','${VAL}'); out.dbPath=await window.unicoNative.dbPath(); await window.unicoFlushNow(); out.set=localStorage.getItem('${KEY}'); }catch(e){ out.err=String(e); }
    return JSON.stringify(out);
  })()`, true) || '{}');
  await sleep(400);
  child.kill();
  await sleep(1500);

  let onDisk = null;
  try { onDisk = JSON.parse(fs.readFileSync(p1.dbPath, 'utf8'))[KEY]; } catch (e) { onDisk = 'READ_ERR:' + e.message; }

  // Phase 2 — relaunch and confirm hydration from disk.
  child = launch();
  page = await waitForPage();
  if (!page) { console.log('VERIFY_DB_PASS false  (app did not start - phase 2)'); child.kill(); process.exit(1); }
  await sleep(4500);
  const p2 = JSON.parse(await evaluate(page, `(function(){
    return JSON.stringify({
      hasNative:!!window.unicoNative,
      snapKey:(window.unicoNative&&window.unicoNative.snapshot)?window.unicoNative.snapshot['${KEY}']:null,
      lsKey:localStorage.getItem('${KEY}'),
      hasApp:!!document.querySelector('.app'),
      depts:(window.UNICO&&window.UNICO.DEPARTMENTS)?window.UNICO.DEPARTMENTS.length:-1
    });
  })()`, false) || '{}');
  // cleanup test key from disk + ls
  await evaluate(page, `(async function(){try{localStorage.removeItem('${KEY}');await window.unicoFlushNow();}catch(e){}return '1';})()`, true);
  await sleep(400);
  child.kill();

  const pass = p1.hasNative && p1.set === VAL && onDisk === VAL && p2.hasNative && p2.snapKey === VAL && p2.lsKey === VAL && p2.hasApp && p2.depts === 15;
  console.log('PHASE1 ' + JSON.stringify(p1));
  console.log('ON_DISK ' + JSON.stringify(onDisk));
  console.log('PHASE2 ' + JSON.stringify(p2));
  console.log('VERIFY_DB_PASS ' + !!pass);
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
