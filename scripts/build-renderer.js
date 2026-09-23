/* UNICO renderer build — pre-transpile the JSX so the BROWSER never has to.
 *
 * The app used to ship `vendor/babel.min.js` (3.14 MB) and 33 `<script
 * type="text/babel">` tags, so every page load downloaded the Babel compiler and
 * transpiled ~690 KB of JSX ON THE MAIN THREAD before React could mount. That is
 * the single biggest reason the app felt slow after login.
 *
 * This script transpiles every JSX file ahead of time (using @babel/standalone,
 * the SAME compiler that ran in the browser, so the output is byte-for-byte what
 * the browser produced) and concatenates the whole app — the 9 plain head scripts
 * plus the 33 transpiled JSX files, IN THE EXACT ORDER index.html loaded them —
 * into ONE classic <script> bundle: renderer/dist/app.bundle.js.
 *
 * Scoping is reproduced faithfully:
 *   - The 9 head files were plain classic <script>s sharing ONE global scope, so
 *     they are concatenated VERBATIM (they already coexist in that scope today).
 *   - The 33 JSX files were `type="text/babel"` scripts, which Babel ran in
 *     ISOLATED per-file scopes (proof: 13 of them each redeclare
 *     `const {useState}=React` with no collision). Cross-file sharing is therefore
 *     entirely explicit via `window.*` / `Object.assign(window,{...})`. To preserve
 *     that isolation, each transpiled JSX file is wrapped in its own IIFE — the
 *     window.* publish/consume calls work identically from inside one.
 * No import/export exists anywhere, so there is no module graph to resolve.
 *
 * The bundle is content-hashed; the hash is written into index.html's
 * `dist/app.bundle.js?v=<hash>` tag so a new build busts the browser cache while
 * letting an unchanged build stay a permanent cache hit.
 *
 * Run:  node scripts/build-renderer.js   (wired into `npm run web` via prestart)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
// Loaded lazily so a missing dev dependency degrades to "serve the existing
// committed bundle" instead of crashing the server start that runs this first.
let Babel = null;
try { Babel = require('@babel/standalone'); } catch (e) { /* handled in main() */ }

const RENDERER = path.join(__dirname, '..', 'renderer');
const SRC = path.join(RENDERER, 'unico');
// UNICO_DIST=<dir> builds somewhere else and leaves the pages' ?v= tokens alone — a
// dry run for measuring a change (e.g. the code split) without publishing bundles the
// app's routing is not ready for. renderer/dist is force-tracked, so a stray build
// there is a commit waiting to happen.
const DRY = !!process.env.UNICO_DIST;
const DIST = DRY ? path.resolve(process.env.UNICO_DIST) : path.join(RENDERER, 'dist');
const INDEX = path.join(RENDERER, 'index.html');

// The app's scripts, in the EXACT order index.html loaded them. This is the
// source of truth for bundle order — add new modules here when you create them.
// (jsx:false = already plain JS, concatenated verbatim; jsx:true = transpiled.)
const MANIFEST = [
  // --- head data/stores (plain JS) — must run before the components ---
  { file: 'config.js', jsx: false },
  { file: 'deptmap.js', jsx: false },
  { file: 'departments-seed.js', jsx: false },
  { file: 'data.js', jsx: false },
  { file: 'store.js', jsx: false },
  { file: 'staff-seed.js', jsx: false },
  { file: 'staff-data.js', jsx: false },
  { file: 'quality-seed.js', jsx: false },
  { file: 'quality-data.js', jsx: false },
  // The indicator manual text (~116 KB) — read only by the quality console and the
  // data-collection forms, so it rides in its own chunk that both of them depend on.
  { file: 'quality-guide.js', jsx: false, chunk: 'qualityguide' },
  { file: 'quality-corrections.js', jsx: false },
  { file: 'quality-corrections-apply.js', jsx: false }, // DB master overrides the static one (must run after corrections, before store)
  { file: 'quality-store.js', jsx: false },
  { file: 'appraisal-spec.js', jsx: false },   // Form HR-NUR-PA-01 as data (window.UNICO_APPRAISAL)
  { file: 'roster-spec.js', jsx: false },      // duty-roster shift codes (window.UNICO_ROSTER)
  { file: 'mockup-ui.js', jsx: false },        // the approved mockup's design tokens (window.MK)
  // --- components (JSX) — app.jsx LAST: it calls ReactDOM.render() ---
  { file: 'charts.jsx', jsx: true },
  { file: 'charts3d.jsx', jsx: true },
  { file: 'charts-extra.jsx', jsx: true },
  { file: 'ui.jsx', jsx: true },
  { file: 'photo-picker.jsx', jsx: true },     // window.PhotoPicker — Cloudinary uploads (staff photos + account avatars)
  { file: 'profile.jsx', jsx: true },          // window.ProfileView — self-service 'My Profile' page (every role)
  { file: 'home.jsx', jsx: true },             // window.HomeView — the personal Home dashboard (every role)
  { file: 'feedback.jsx', jsx: true },
  { file: 'dashboard.jsx', jsx: true },
  { file: 'department.jsx', jsx: true },
  { file: 'comparison.jsx', jsx: true },
  { file: 'manage.jsx', jsx: true },
  { file: 'staff.jsx', jsx: true },
  { file: 'staff-profile.jsx', jsx: true, chunk: 'staffprofile' },
  { file: 'input.jsx', jsx: true },
  { file: 'reports.jsx', jsx: true, chunk: 'reports' },
  { file: 'quality-console.jsx', jsx: true, chunk: 'quality' },
  { file: 'quality-dept-manage.jsx', jsx: true, chunk: 'quality' },
  { file: 'charts-gallery.jsx', jsx: true, chunk: 'quality' },
  { file: 'login.jsx', jsx: true },
  { file: 'auth-login.jsx', jsx: true },
  { file: 'search.jsx', jsx: true },
  { file: 'data-collection.jsx', jsx: true, chunk: 'datacollection' },
  { file: 'supervisor.jsx', jsx: true, chunk: 'supervisor' },
  { file: 'user-admin.jsx', jsx: true, chunk: 'reports' },
  // Access Control (route 'users') — per-person access. Rides the reports chunk because it
  // shares the account editor (window.UserModal) with reports.jsx.
  { file: 'access-control.jsx', jsx: true, chunk: 'reports' },
  { file: 'data-fields.jsx', jsx: true, chunk: 'datacollection' },
  { file: 'performance.jsx', jsx: true, chunk: 'performance' },      // publishes window.PerfUI (shared helpers) first
  { file: 'performance-hr.jsx', jsx: true, chunk: 'performance' },   // attrition / retention risk / recognition board
  { file: 'roster.jsx', jsx: true, chunk: 'roster' },
  // After roster.jsx: the full-review screens read the same domain helpers, and
  // every file is IIFE-wrapped, so load order is what makes window.RosterReviewFull
  // available to the shell.
  { file: 'roster-review.jsx', jsx: true, chunk: 'roster' },
  // Manpower Overview — the live staffing command view (window.ManpowerOverview),
  // ported from the approved "Manpower Overview v2" design canvas.
  { file: 'manpower.jsx', jsx: true, chunk: 'manpower' },
  // Medicine Info v2 — the three-pane drug reference (window.MedicineInfoV2),
  // ported from the approved "Medicine Info v2" design canvas. Must load before
  // medicine.jsx? No — medicine.jsx only reads window.MedicineInfoV2 at render time.
  { file: 'medicine-info.jsx', jsx: true, chunk: 'medicine' },
  { file: 'medicine.jsx', jsx: true, chunk: 'medicine' },   // drug index + prescription pad (window.MedicineView)
  // System Monitor panel (window.SystemMonitor) + the save-failure reporter every browser
  // runs. Before app.jsx; wraps window.unicoNative.persist at load.
  { file: 'monitor.jsx', jsx: true },
  { file: 'app.jsx', jsx: true },
];

// The two phone apps ported from the Claude Design canvases (docs/design). Each is
// its own page + bundle: the runtime helpers, the design data, the GENERATED view
// (scripts/dc-to-jsx.js) and the hand-written logic, in that order. They share the
// vendored React and fonts with the console but nothing from its bundle.
const NURSE_MANIFEST = [
  { file: 'dc-runtime.jsx', jsx: true },        // window.DC — S(), ix(), AndroidDevice, api()
  { file: 'roster-spec.js', jsx: false },     // window.UNICO_ROSTER — the hospital's real duty codes
  { file: 'appraisal-spec.js', jsx: false },  // window.UNICO_APPRAISAL — appraisal sections, to label real scores
  { file: 'nurse-app-data.js', jsx: false },   // window.NURSE_APP_DATA — design seed/fallback data
  { file: 'nurse-app-view.jsx', jsx: true },   // window.NurseAppView — GENERATED, do not edit
  { file: 'nurse-app.jsx', jsx: true },        // state + view-model + mount
];
const ADMIN_MANIFEST = [
  { file: 'dc-runtime.jsx', jsx: true },
  { file: 'admin-app-data.js', jsx: false },
  { file: 'admin-app-view.jsx', jsx: true },   // GENERATED, do not edit
  { file: 'admin-app.jsx', jsx: true },
];
// out = bundle file under renderer/dist; html = the page whose ?v= token tracks it.
// chunked: split the manifest entries carrying `chunk:` into their own files.
const BUNDLES = [
  { out: 'app.bundle.js', html: 'index.html', manifest: MANIFEST, chunked: true },
  { out: 'nurse-app.bundle.js', html: 'nurse-app.html', manifest: NURSE_MANIFEST },
  { out: 'admin-app.bundle.js', html: 'admin-app.html', manifest: ADMIN_MANIFEST },
];

/* ---- code splitting -----------------------------------------------------------
   The whole console used to ship as ONE ~700 KB (brotli) script that every visitor
   downloaded before anything rendered — on a hospital link that was ~8 s of waiting
   for modules most people never open that session. Entries marked `chunk:` above are
   built into their own content-hashed file instead, and the core bundle carries a
   small loader.

   TWO RULES decide what may be chunked, both learned from this app:
     1. Anything the SHELL reads must stay in core — stores (store.js, quality-store.js,
        quality-data.js, data.js and the seeds they read) and any global the sidebar or
        dashboard touches on first render. A chunk-owned global read by core reads as
        "no data" rather than failing, which is worse than slow.
     2. A chunk holds VIEW code only: components mounted by a route. Every unico:*
        listener in the chunked files is inside a component's useEffect, so a module
        that is not loaded has no listeners today either.

   Chunks are also PRELOADED in the background once the page is idle, one at a time so
   they never compete with the shell's own first API calls. So the end state matches
   today's (everything in memory a second or two after paint); only the critical path
   changes. `unico:chunk-loaded` lets the shell recompute anything it derives from a
   chunk (e.g. the Quality breach badge). */
const CHUNK_DEPS = {
  quality: ['qualityguide'],
  datacollection: ['qualityguide'],
};
// Background preload order: what a signed-in admin is likeliest to open first. Portal
// accounts reorder this at runtime (data collection is their whole app).
const PRELOAD_ORDER = ['datacollection', 'qualityguide', 'quality', 'reports',
  'staffprofile', 'roster', 'performance', 'supervisor', 'medicine', 'manpower'];

/* What a file publishes to the global scope: `window.X = …` and
   `Object.assign(window, { X, Y })`. Used to place PLACEHOLDERS for chunk-owned
   components (below) — the reason this has to be derived rather than hand-listed is
   that missing one is a runtime crash on one screen, which no test would catch. */
function publishedGlobals(code) {
  const names = new Set();
  const re = /window\.([A-Za-z_$][\w$]*)\s*=(?!=)/g;
  let m;
  while ((m = re.exec(code))) names.add(m[1]);
  const oa = /Object\.assign\(\s*window\s*,\s*\{([\s\S]*?)\}\s*\)/g;
  while ((m = oa.exec(code))) {
    m[1].split(',').forEach((part) => {
      const k = part.split(':')[0].trim().replace(/[^\w$]/g, '');
      if (k) names.add(k);
    });
  }
  return names;
}

/* Placeholders for chunk-owned COMPONENTS.
   Every renderer file is IIFE-wrapped and shares code through globals, so core files
   reference chunked components by BARE NAME — app.jsx has `<DataPatientForm …/>`,
   which in one bundle resolved to the global that data-collection.jsx published. Split,
   that name does not exist until its chunk lands, and a bare reference to a missing
   binding is a ReferenceError: React unmounts the whole view into the error boundary,
   and it does NOT recover when the chunk arrives a moment later.
   So the core bundle defines a placeholder component for each chunk-owned name, which
   renders the same "Loading this screen…" line the router shows. The real module
   overwrites it on load. Only Capitalised names (components) are stubbed — data and
   flag globals are left alone, because a stub for one of those would be a lie the app
   might store. Names core itself publishes are never stubbed. */
function componentStubs(byChunk, coreNames, coreSource) {
  // Exactly the crash sites: a name core RENDERS. After transpile that is
  // React.createElement(Name, …). Data globals (HQI_GUIDE, UNICO_Q, PerfUI…) are
  // deliberately NOT stubbed — a function standing in for a lookup table reads as
  // "empty data", which is a wrong answer rather than a visible wait.
  const rendered = new Set();
  const re = /React\.createElement\(\s*([A-Z][\w$]*)/g;
  let m;
  while ((m = re.exec(coreSource))) rendered.add(m[1]);
  const stubbed = [];
  Object.keys(byChunk).forEach((chunk) => {
    byChunk[chunk].forEach((name) => {
      if (!rendered.has(name)) return;             // core never renders it
      if (coreNames.has(name)) return;             // core owns it; never shadow
      if (stubbed.indexOf(name) < 0) stubbed.push(name);
    });
  });
  if (!stubbed.length) return '';
  return '/* ===== placeholders for code-split components ===== */\n'
    + '(function(){var N=' + JSON.stringify(stubbed) + ';\n'
    + 'function ph(){return (window.React&&window.React.createElement)'
    + '?window.React.createElement("div",{style:{display:"grid",placeItems:"center",height:"50vh",'
    + 'color:"var(--muted)",fontSize:13}},"Loading this screen\\u2026"):null;}\n'
    + 'for(var i=0;i<N.length;i++){if(typeof window[N[i]]==="undefined"){window[N[i]]=ph;window[N[i]].__unicoPlaceholder=true;}}\n'
    + '})();\n';
}

// The loader, generated into the top of the core bundle so it exists before any
// module runs. Deliberately ES5 and dependency-free: it must parse in anything that
// can run the app at all, and it is on the critical path of every page load.
function chunkPrelude(map) {
  const names = Object.keys(map);
  const order = PRELOAD_ORDER.filter((n) => names.indexOf(n) >= 0)
    .concat(names.filter((n) => PRELOAD_ORDER.indexOf(n) < 0));
  return '/* ===== generated chunk loader ===== */\n'
    + 'window.__UNICO_CHUNKS__=' + JSON.stringify(map) + ';\n'
    + 'window.__UNICO_CHUNK_DEPS__=' + JSON.stringify(CHUNK_DEPS) + ';\n'
    + '(function(){\n'
    + 'var M=window.__UNICO_CHUNKS__,D=window.__UNICO_CHUNK_DEPS__,PENDING={},READY={};\n'
    + 'function inject(src){return new Promise(function(res,rej){var s=document.createElement("script");'
    + 's.src=src;s.async=false;s.onload=function(){res(true);};'
    + 's.onerror=function(){rej(new Error("Could not load "+src));};'
    + '(document.head||document.documentElement).appendChild(s);});}\n'
    // A failed load clears its promise so a later attempt (a click, or the next
    // preload pass) can retry instead of being stuck with a rejected cache entry.
    // A tab open across a rebuild holds the OLD core, so it asks for chunk URLs from
    // the old map. If one of those is gone the screen would sit empty with nothing to
    // explain it, so reload ONCE (flagged in sessionStorage, so a genuinely broken
    // deploy cannot loop) to pick up the current core and map.
    + 'function staleReload(){try{if(sessionStorage.getItem("unico:chunk-reload"))return false;'
    + 'sessionStorage.setItem("unico:chunk-reload","1");location.reload();return true;}catch(e){return false;}}\n'
    + 'function load(n){if(!M[n])return Promise.resolve(false);if(READY[n])return Promise.resolve(true);'
    + 'if(PENDING[n])return PENDING[n];'
    + 'PENDING[n]=Promise.all((D[n]||[]).map(load)).then(function(){return inject(M[n]);})'
    + '.then(function(){READY[n]=true;PENDING[n]=null;'
    + 'try{sessionStorage.removeItem("unico:chunk-reload");}catch(e){}'
    + 'try{window.dispatchEvent(new CustomEvent("unico:chunk-loaded",{detail:n}));}catch(e){}return true;},'
    + 'function(e){PENDING[n]=null;staleReload();throw e;});return PENDING[n];}\n'
    + 'window.unicoLoadChunk=load;\n'
    + 'window.unicoChunkReady=function(n){return !!READY[n];};\n'
    + 'window.unicoChunkNames=function(){var a=[];for(var k in M){if(Object.prototype.hasOwnProperty.call(M,k))a.push(k);}return a;};\n'
    + 'var ORDER=' + JSON.stringify(order) + ';\n'
    + 'function preload(){var q=ORDER.slice();\n'
    + 'try{var u=window.__UNICO_USER__;if(u&&["collector","incharge","nurse","pca"].indexOf(u.role)>=0){'
    + 'q=["datacollection"].concat(q.filter(function(n){return n!=="datacollection";}));}}catch(e){}\n'
    // One at a time, with a breath between: the shell is still fetching appdata,
    // permissions and staff, and those are what make the page usable.
    + 'function next(){if(!q.length)return;var n=q.shift();'
    + 'load(n)["catch"](function(){})["then"](function(){setTimeout(next,150);});}\n'
    + 'next();}\n'
    + 'function start(){var idle=window.requestIdleCallback||function(f){return setTimeout(f,1200);};'
    + 'idle(function(){setTimeout(preload,600);});}\n'
    + 'if(document.readyState==="complete")start();else window.addEventListener("load",start);\n'
    + '})();\n';
}

function buildBundle(manifest) {
  const parts = [];
  let transpiled = 0;
  for (const mod of manifest) {
    const full = path.join(SRC, mod.file);
    let code;
    try {
      code = fs.readFileSync(full, 'utf8');
    } catch (e) {
      throw new Error('Missing renderer source: ' + mod.file + ' (' + e.message + ')');
    }
    if (mod.jsx) {
      // preset 'react' only rewrites JSX -> React.createElement; it does NOT
      // downlevel ES syntax, so the output runs identically to the old in-browser
      // transpile on any modern browser.
      const out = Babel.transform(code, {
        presets: ['react'],
        sourceType: 'script',
        filename: mod.file,
        compact: false,
        comments: false,
      });
      // Wrap in an IIFE to reproduce the per-file isolation the text/babel scripts
      // had (so the 13 repeated `const {useState}=React` don't collide). window.*
      // publishes still escape the IIFE; bare references to head-script globals
      // still resolve up the scope chain. "\n" padding keeps it ASI-safe.
      code = '(function(){\n' + out.code + '\n})();';
      transpiled++;
    }
    // Banner aids debugging in DevTools; "\n;\n" separators are ASI-safe between
    // two complete top-level programs (head .js stay verbatim in global scope).
    parts.push('/* ===== ' + mod.file + ' ===== */\n' + code);
  }
  return { source: parts.join('\n;\n') + '\n', transpiled };
}

function main() {
  if (!Babel) {
    const msg = '[build-renderer] @babel/standalone not found — ';
    const missing = BUNDLES.filter((b) => !fs.existsSync(path.join(DIST, b.out)));
    if (!missing.length) { console.warn(msg + 'using the existing bundles in renderer/dist'); return; }
    console.error(msg + 'and no prebuilt bundle exists for ' + missing.map((b) => b.out).join(', ') + '. Run `npm install` in the app root.');
    process.exit(1);
  }
  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });
  let failed = false;
  for (const b of BUNDLES) {
    const bundlePath = path.join(DIST, b.out);
    const haveBundle = fs.existsSync(bundlePath);
    let source, transpiled, hash, chunkInfo = [];
    // Degrade gracefully: if a build throws, keep serving the existing committed
    // bundle rather than blocking `npm run web`. Only hard-fail when there is no
    // bundle at all to fall back to.
    try {
      if (b.chunked) {
        // Chunks are built FIRST: their content hashes go into the loader map that
        // the core bundle carries, so a changed chunk busts only its own cache.
        const groups = new Map();
        b.manifest.forEach((m) => {
          if (!m.chunk) return;
          if (!groups.has(m.chunk)) groups.set(m.chunk, []);
          groups.get(m.chunk).push(m);
        });
        // Drop chunk files from a previous build (a renamed chunk would otherwise
        // linger in renderer/dist, which is force-tracked, and get committed).
        fs.readdirSync(DIST).filter((f) => /\.chunk\.js$/.test(f)).forEach((f) => {
          if (!groups.has(f.replace(/\.chunk\.js$/, ''))) { try { fs.unlinkSync(path.join(DIST, f)); } catch (e) { /* ignore */ } }
        });
        const map = {};
        const byChunk = {};
        for (const [name, mods] of groups) {
          const built = buildBundle(mods);
          byChunk[name] = [...publishedGlobals(built.source)];
          const h = crypto.createHash('sha1').update(built.source).digest('hex').slice(0, 10);
          const file = name + '.chunk.js';
          fs.writeFileSync(path.join(DIST, file), built.source, 'utf8');
          // Absolute so it resolves the same from /, /collect and any deeper route.
          map[name] = '/dist/' + file + '?v=' + h;
          chunkInfo.push({ name, files: mods.length, kb: (Buffer.byteLength(built.source) / 1024).toFixed(0), hash: h });
        }
        const core = buildBundle(b.manifest.filter((m) => !m.chunk));
        // Placeholders BEFORE the core code: app.jsx and friends reference chunk-owned
        // components by bare name, and a missing binding throws rather than rendering
        // nothing (see componentStubs).
        source = chunkPrelude(map) + componentStubs(byChunk, publishedGlobals(core.source), core.source) + core.source;
        transpiled = core.transpiled;
      } else {
        ({ source, transpiled } = buildBundle(b.manifest));
      }
      hash = crypto.createHash('sha1').update(source).digest('hex').slice(0, 10);
    } catch (e) {
      if (haveBundle) { console.warn('[build-renderer] ' + b.out + ' build failed (' + e.message + ') — keeping existing bundle'); continue; }
      console.error('[build-renderer] ' + b.out + ' build failed and no prebuilt bundle exists: ' + e.message);
      failed = true; continue;
    }
    fs.writeFileSync(bundlePath, source, 'utf8');

    // Sync the cache-busting token in the page so a changed bundle is re-fetched
    // and an unchanged one stays a cache hit. No-op (with a note) if the tag isn't
    // present yet.
    let updatedIndex = false;
    try {
      if (DRY) throw new Error('dry run: pages untouched');
      const htmlPath = path.join(RENDERER, b.html);
      const html = fs.readFileSync(htmlPath, 'utf8');
      const re = new RegExp('dist/' + b.out.replace(/[.]/g, '[.]') + '[?]v=[A-Za-z0-9]+', 'g');
      if (re.test(html)) {
        fs.writeFileSync(htmlPath, html.replace(re, 'dist/' + b.out + '?v=' + hash), 'utf8');
        updatedIndex = true;
      }
    } catch (e) { /* page missing — ignore */ }

    const kb = (Buffer.byteLength(source) / 1024).toFixed(0);
    const coreFiles = b.manifest.filter((m) => !m.chunk).length;
    console.log('[build-renderer] bundled ' + coreFiles + ' files ('
      + transpiled + ' JSX transpiled) -> ' + (DRY ? DIST : 'renderer/dist') + '/' + b.out + '  '
      + kb + ' KB  v=' + hash + (updatedIndex ? '  (' + b.html + ' updated)' : '  (' + b.html + ' tag not found yet)'));
    chunkInfo.forEach((c) => console.log('[build-renderer]   chunk ' + c.name.padEnd(15)
      + c.files + ' file(s)  ' + c.kb + ' KB  v=' + c.hash));
  }
  if (failed) process.exit(1);
}

main();
