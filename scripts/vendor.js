/* Copies runtime libraries + IBM Plex fonts into renderer/vendor so the app
   runs fully offline (no CDN / Google Fonts). Re-run with `npm run vendor`. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const NM = path.join(ROOT, 'node_modules');
const VENDOR = path.join(ROOT, 'renderer', 'vendor');
const FONTS = path.join(VENDOR, 'fonts');
const FONT_FILES = path.join(FONTS, 'files');

fs.mkdirSync(FONT_FILES, { recursive: true });

function copy(from, to) {
  fs.copyFileSync(from, to);
  console.log('  ✓', path.relative(ROOT, to));
}

// --- libraries ---
console.log('Libraries:');
copy(path.join(NM, 'react/umd/react.production.min.js'), path.join(VENDOR, 'react.production.min.js'));
copy(path.join(NM, 'react-dom/umd/react-dom.production.min.js'), path.join(VENDOR, 'react-dom.production.min.js'));
copy(path.join(NM, '@babel/standalone/babel.min.js'), path.join(VENDOR, 'babel.min.js'));

// --- fonts ---
const FACES = [
  { family: 'IBM Plex Sans', pkg: 'ibm-plex-sans', weights: [400, 500, 600, 700] },
  { family: 'IBM Plex Mono', pkg: 'ibm-plex-mono', weights: [400, 500, 600] },
];

console.log('Fonts:');
let css = '/* IBM Plex — vendored from @fontsource for offline use */\n';
for (const f of FACES) {
  for (const w of f.weights) {
    const base = `${f.pkg}-latin-${w}-normal`;
    for (const ext of ['woff2', 'woff']) {
      copy(path.join(NM, `@fontsource/${f.pkg}/files/${base}.${ext}`), path.join(FONT_FILES, `${base}.${ext}`));
    }
    css +=
      `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${w};font-display:swap;` +
      `src:url('./files/${base}.woff2') format('woff2'),url('./files/${base}.woff') format('woff');}\n`;
  }
}
fs.writeFileSync(path.join(FONTS, 'ibm-plex.css'), css);
console.log('  ✓', path.relative(ROOT, path.join(FONTS, 'ibm-plex.css')));
console.log('\nVendoring complete.');
