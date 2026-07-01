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
const DIST = path.join(RENDERER, 'dist');
const INDEX = path.join(RENDERER, 'index.html');

// The app's scripts, in the EXACT order index.html loaded them. This is the
// source of truth for bundle order — add new modules here when you create them.
// (jsx:false = already plain JS, concatenated verbatim; jsx:true = transpiled.)
const MANIFEST = [
  // --- head data/stores (plain JS) — must run before the components ---
  { file: 'config.js', jsx: false },
  { file: 'data.js', jsx: false },
  { file: 'store.js', jsx: false },
  { file: 'staff-seed.js', jsx: false },
  { file: 'staff-data.js', jsx: false },
  { file: 'quality-data.js', jsx: false },
  { file: 'quality-guide.js', jsx: false },
  { file: 'quality-corrections.js', jsx: false },
  { file: 'quality-store.js', jsx: false },
  // --- components (JSX) — app.jsx LAST: it calls ReactDOM.render() ---
  { file: 'charts.jsx', jsx: true },
  { file: 'charts3d.jsx', jsx: true },
  { file: 'charts-extra.jsx', jsx: true },
  { file: 'ui.jsx', jsx: true },
  { file: 'feedback.jsx', jsx: true },
  { file: 'dashboard.jsx', jsx: true },
  { file: 'department.jsx', jsx: true },
  { file: 'comparison.jsx', jsx: true },
  { file: 'manage.jsx', jsx: true },
  { file: 'staff.jsx', jsx: true },
  { file: 'staff-profile.jsx', jsx: true },
  { file: 'input.jsx', jsx: true },
  { file: 'reports.jsx', jsx: true },
  { file: 'quality-console.jsx', jsx: true },
  { file: 'quality-dept-manage.jsx', jsx: true },
  { file: 'charts-gallery.jsx', jsx: true },
  { file: 'login.jsx', jsx: true },
  { file: 'auth-login.jsx', jsx: true },
  { file: 'search.jsx', jsx: true },
  { file: 'data-collection.jsx', jsx: true },
  { file: 'user-admin.jsx', jsx: true },
  { file: 'data-fields.jsx', jsx: true },
  { file: 'app.jsx', jsx: true },
];

function buildBundle() {
  const parts = [];
  let transpiled = 0;
  for (const mod of MANIFEST) {
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
  const bundlePath = path.join(DIST, 'app.bundle.js');
  const haveBundle = fs.existsSync(bundlePath);

  // Degrade gracefully: if Babel isn't installed or the build throws, keep serving
  // the existing committed bundle rather than blocking `npm run web`. Only hard-fail
  // when there is no bundle at all to fall back to.
  if (!Babel) {
    const msg = '[build-renderer] @babel/standalone not found — ';
    if (haveBundle) { console.warn(msg + 'using existing renderer/dist/app.bundle.js'); return; }
    console.error(msg + 'and no prebuilt bundle exists. Run `npm install` in the app root.');
    process.exit(1);
  }

  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });
  let source, transpiled, hash;
  try {
    ({ source, transpiled } = buildBundle());
    hash = crypto.createHash('sha1').update(source).digest('hex').slice(0, 10);
  } catch (e) {
    if (haveBundle) { console.warn('[build-renderer] build failed (' + e.message + ') — keeping existing bundle'); return; }
    console.error('[build-renderer] build failed and no prebuilt bundle exists: ' + e.message);
    process.exit(1);
  }
  fs.writeFileSync(bundlePath, source, 'utf8');

  // Sync the cache-busting token in index.html so a changed bundle is re-fetched
  // and an unchanged one stays a cache hit. No-op (with a warning) if the tag isn't
  // present yet — lets the very first build run before index.html is switched over.
  let updatedIndex = false;
  try {
    const html = fs.readFileSync(INDEX, 'utf8');
    const re = /dist\/app\.bundle\.js\?v=[A-Za-z0-9]+/g;
    if (re.test(html)) {
      fs.writeFileSync(INDEX, html.replace(re, 'dist/app.bundle.js?v=' + hash), 'utf8');
      updatedIndex = true;
    }
  } catch (e) { /* index.html missing — ignore */ }

  const kb = (Buffer.byteLength(source) / 1024).toFixed(0);
  console.log('[build-renderer] bundled ' + MANIFEST.length + ' files ('
    + transpiled + ' JSX transpiled) -> renderer/dist/app.bundle.js  '
    + kb + ' KB  v=' + hash + (updatedIndex ? '  (index.html updated)' : '  (index.html tag not found yet)'));
}

main();
