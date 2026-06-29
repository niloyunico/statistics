/* Generates build/icon.ico (multi-size) and build/icon.png from the UNICO
   logo mark, for the window + portable .exe icon. Run with `npm run icon`. */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIcoModule = require('png-to-ico');
const pngToIco = pngToIcoModule.default || pngToIcoModule;

const ROOT = path.join(__dirname, '..');
const SVG = path.join(ROOT, 'renderer', 'unico', 'logo-mark.svg');
const BUILD = path.join(ROOT, 'build');
const SIZES = [256, 128, 64, 48, 32, 16];

(async () => {
  fs.mkdirSync(BUILD, { recursive: true });
  const svg = fs.readFileSync(SVG);
  const pngPaths = [];
  for (const s of SIZES) {
    const pad = Math.round(s * 0.14); // breathing room around the mark
    const inner = s - pad * 2;
    const mark = await sharp(svg, { density: 512 })
      .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    const out = path.join(BUILD, `icon-${s}.png`);
    await sharp({ create: { width: s, height: s, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: mark, gravity: 'center' }])
      .png()
      .toFile(out);
    pngPaths.push(out);
  }
  const ico = await pngToIco(pngPaths);
  fs.writeFileSync(path.join(BUILD, 'icon.ico'), ico);
  fs.copyFileSync(path.join(BUILD, 'icon-256.png'), path.join(BUILD, 'icon.png'));
  for (const p of pngPaths) if (p !== path.join(BUILD, 'icon-256.png')) fs.unlinkSync(p);
  fs.unlinkSync(path.join(BUILD, 'icon-256.png'));
  console.log('Wrote build/icon.ico and build/icon.png');
})().catch((e) => { console.error(e); process.exit(1); });
