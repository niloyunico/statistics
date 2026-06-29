/* Launches the BUILT app (dist/win-unpacked) and verifies it renders from the
   packaged asar, via the Chrome DevTools Protocol. Exit 0 = pass.

   Run:  node scripts/verify-packaged.js   (or: npm run verify)

   The app is launched under a throwaway --user-data-dir. That matters for two
   reasons that used to make this check flaky:
     1. Electron's single-instance lock is keyed on the user-data-dir. With the
        real (shared) dir, if you already had the app open the spawned instance
        would lose the lock, call app.quit(), and never bind the debug port —
        surfacing as the confusing "no debug target — app did not start".
     2. It keeps the check from reading/writing your real localStorage profile.
   On failure we now also print the child's stderr and exit status so the reason
   is never a mystery. */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const os = require('os');
const fs = require('fs');

const EXE = path.join(__dirname, '..', 'dist', 'win-unpacked', 'UNICO Statistics Suite.exe');
const PORT = Number(process.env.UNICO_VERIFY_PORT) || 9222;
const USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'unico-verify-'));

function cleanup() {
  try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (_) {}
}

function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE; // packaged app must run as Electron, not Node
  const child = spawn(EXE, [
    `--remote-debugging-port=${PORT}`,
    '--no-sandbox',
    `--user-data-dir=${USER_DATA}`,
  ], { env });

  let childErr = '';
  let exited = null;
  child.stderr.on('data', (d) => { childErr += d.toString(); });
  child.on('exit', (code, signal) => { exited = { code, signal }; });

  let page = null;
  for (let i = 0; i < 60 && !page; i++) {
    if (exited) break; // app died before exposing a debug target — stop waiting
    await sleep(500);
    try {
      const targets = await getJSON(`http://127.0.0.1:${PORT}/json`);
      page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    } catch (_) {}
  }
  if (!page) {
    const why = exited
      ? `app exited early (code=${exited.code}${exited.signal ? ', signal=' + exited.signal : ''})`
      : `no debug target appeared within timeout on port ${PORT}`;
    console.log(`VERIFY_PASS false  (${why})`);
    if (childErr.trim()) console.log('CHILD_STDERR:\n' + childErr.trim());
    try { child.kill(); } catch (_) {}
    cleanup();
    process.exit(1);
  }

  await sleep(4500); // let Babel compile + React mount

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  const expr = `(function(){
    const out={
      url: location.href,
      title: document.title,
      rootChildren: (document.getElementById('root')||{children:[]}).children.length,
      hasApp: !!document.querySelector('.app'),
      hasSidebar: !!document.querySelector('.sb'),
      depts: (window.UNICO&&window.UNICO.DEPARTMENTS)?window.UNICO.DEPARTMENTS.length:-1,
      logoLoaded: (function(){var i=document.querySelector('.sb-logo-img');return !!i&&i.complete&&i.naturalWidth>0;})(),
      fontFamily: getComputedStyle(document.body).fontFamily
    };
    try{ localStorage.setItem('__vp','ok'); out.ls=localStorage.getItem('__vp'); }catch(e){ out.lsErr=String(e); }
    return JSON.stringify(out);
  })()`;

  const result = await new Promise((resolve) => {
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id === 1) resolve(msg.result && msg.result.result && msg.result.result.value);
    };
    ws.onerror = () => resolve(null);
    setTimeout(() => resolve(null), 8000);
  });

  try { ws.close(); } catch (_) {}
  child.kill();
  await sleep(500);
  cleanup();

  let r = {};
  try { r = JSON.parse(result); } catch (_) {}
  const pass = r.hasApp && r.hasSidebar && r.rootChildren > 0 && r.depts === 15 && r.logoLoaded === true && r.ls === 'ok' && /UNICO/.test(r.title || '');
  console.log('VERIFY_RESULT ' + JSON.stringify(r));
  console.log('VERIFY_PASS ' + !!pass);
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error(e); cleanup(); process.exit(1); });
