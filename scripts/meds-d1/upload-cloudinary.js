/* Upload the medicine assets to Cloudinary.
 *
 *   1. out/index.json.gz                -> raw asset  unico/meds/index.json.gz
 *      (the search index the server loads into memory on cold start)
 *   2. every image referenced by a brand -> image      unico/meds/img/<hash>
 *      (52,743 manifest lines, ~4.2 GB; public id = the file's hash name, so a
 *       re-run or a future re-import maps to the same asset)
 *
 * RESUMABLE: each finished hash is appended to out/upload-done.txt; a re-run
 * skips those, so a network drop or rate-limit pause costs nothing.
 *
 *   node scripts/meds-d1/upload-cloudinary.js            # index + images
 *   node scripts/meds-d1/upload-cloudinary.js --index    # just the index file
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', 'server', '.env') });
const fs = require('fs');
const path = require('path');
const cloudinary = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'cloudinary')).v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const OUT = path.join(__dirname, 'out');
const IMG_DIR = 'C:\\final durg update list\\images';
const DONE_F = path.join(OUT, 'upload-done.txt');
const CONCURRENCY = 5;

async function uploadIndex() {
  // Two parts because Cloudinary free caps a raw file at 10 MB.
  for (const f of ['index-brands.json.gz', 'index-meta.json.gz', 'index-interactions.json.gz']) {
    if (!fs.existsSync(path.join(OUT, f))) continue;
    const r = await cloudinary.uploader.upload(path.join(OUT, f), {
      resource_type: 'raw', public_id: 'unico/meds/' + f,
      overwrite: true, invalidate: true,
    });
    console.log('index uploaded: ' + r.secure_url + '  (' + (r.bytes / 1e6).toFixed(1) + ' MB)');
  }
}

async function uploadImages() {
  const done = new Set(fs.existsSync(DONE_F) ? fs.readFileSync(DONE_F, 'utf8').split('\n').filter(Boolean) : []);
  // manifest may reference the same file from several brands — upload each file once
  const files = [...new Set(fs.readFileSync(path.join(OUT, 'images-manifest.txt'), 'utf8')
    .split('\n').filter(Boolean).map((l) => l.split('\t')[0]))];
  const todo = files.filter((f) => !done.has(f));
  console.log('images: ' + files.length + ' referenced, ' + done.size + ' already uploaded, ' + todo.length + ' to go');
  const log = fs.createWriteStream(DONE_F, { flags: 'a' });
  let ok = 0, missing = 0, failed = 0, inflight = 0, i = 0;
  await new Promise((resolve) => {
    const next = () => {
      while (inflight < CONCURRENCY && i < todo.length) {
        const f = todo[i++]; inflight++;
        const full = path.join(IMG_DIR, f);
        if (!fs.existsSync(full)) { missing++; inflight--; log.write(f + '\n'); continue; }
        cloudinary.uploader.upload(full, {
          public_id: 'unico/meds/img/' + f.replace(/\.[a-z0-9]+$/i, ''),
          overwrite: false, resource_type: 'image',
        }).then(() => { ok++; log.write(f + '\n'); })
          .catch((e) => {
            const msg = String((e && e.message) || e);
            // "already exists"-style responses count as done; real failures retry next run
            if (/exist/i.test(msg)) { ok++; log.write(f + '\n'); } else { failed++; }
          })
          .finally(() => {
            inflight--;
            if ((ok + failed + missing) % 500 === 0) console.log('  ' + (ok + failed + missing) + ' / ' + todo.length + ' (ok ' + ok + ', failed ' + failed + ')');
            if (i >= todo.length && inflight === 0) resolve(); else next();
          });
      }
      if (i >= todo.length && inflight === 0) resolve();
    };
    next();
  });
  log.end();
  console.log('\nimages done: uploaded ' + ok + ' · missing files ' + missing + ' · failed ' + failed + (failed ? '  (run again to retry failures)' : ''));
}

(async () => {
  await uploadIndex();
  if (!process.argv.includes('--index')) await uploadImages();
})().catch((e) => { console.error('STOPPED: ' + (e.message || e)); process.exit(1); });
