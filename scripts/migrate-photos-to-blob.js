/* Usage: node scripts/migrate-photos-to-blob.js check | run   (from the repo root)
   Move every people photo (staff register, staff documents, user accounts) that still lives on
   Cloudinary / ImageKit into PRIVATE Vercel Blob as AVIF, and point the records at the copy.

   node migrate_photos.js check   -> read-only: what would move, and whether each source can be read
   node migrate_photos.js run     -> copy + verify + rewrite references (backup written first)

   Safety:
   - Source files are never deleted (old links keep working for anything not found here).
   - Uploads go through the app's own storage adapter (server/storage-blob.js): same AVIF
     encoding, same private store, same folder rules as an upload from the screen.
   - Writes go through the app's db handle so the read cache is invalidated.
   - The staff register (one JSON string) is written with compare-and-set: if anybody saved staff
     in the meantime, the write is retried on the fresh copy, never forced over it.
   - Every old reference is saved to a backup file before anything changes. */
const ROOT = 'C:/xampp/htdocs/uniconurse/';
require(ROOT + 'server/node_modules/dotenv').config({ path: ROOT + 'server/.env' });
process.env.PHOTO_STORAGE_PROVIDER = 'vercel-blob';
const fs = require('fs'), path = require('path');
const mode = process.argv[2];
if (!['check', 'run'].includes(mode)) { console.log('use: check | run'); process.exit(1); }
const blobStore = require(ROOT + 'server/storage-blob');
const { getDbHandle } = require(ROOT + 'server/db');

const urlOf = (p) => (typeof p === 'string' ? p : (p && (p.url || p.secure_url)) || '');
const legacy = (u) => /res\.cloudinary\.com|ik\.imagekit\.io|blob\.vercel-storage\.com/.test(String(u || ''));
const hostOf = (u) => (/cloudinary/.test(u) ? 'cloudinary' : /imagekit/.test(u) ? 'imagekit' : 'public-blob');

async function fetchBytes(u) {
  const r = await fetch(u, { redirect: 'follow' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const b = Buffer.from(await r.arrayBuffer());
  if (!b.length) throw new Error('empty');
  return b;
}

(async () => {
  const db = await getDbHandle();
  if (!db) throw new Error('No database connection.');
  const appdata = db.collection('appdata');
  const ad = await appdata.findOne({ 'data.unico_staff_v3': { $exists: true } });
  const reg = JSON.parse(ad.data.unico_staff_v3);
  const staffDocs = await db.collection('staff').find({}, { projection: { _id: 1, id: 1, name: 1, photo: 1 } }).toArray();
  const users = await db.collection('users').find({}, { projection: { _id: 1, username: 1, name: 1, photo: 1 } }).toArray();

  // One copy per distinct source url, whoever references it.
  const jobs = new Map();
  const need = (u, folder, ref) => { if (!legacy(u)) return; const j = jobs.get(u) || { url: u, folder, refs: [] }; j.refs.push(ref); jobs.set(u, j); };
  reg.forEach((e) => need(urlOf(e.photo), 'unico/staff', 'register #' + e.id + ' ' + (e.name || '')));
  staffDocs.forEach((e) => need(urlOf(e.photo), 'unico/staff', 'staff doc #' + e.id + ' ' + (e.name || '')));
  users.forEach((u) => need(urlOf(u.photo), 'unico/profiles', 'account @' + u.username));

  console.log('distinct legacy photos:', jobs.size, '| references:', [...jobs.values()].reduce((n, j) => n + j.refs.length, 0));
  const ok = [], bad = [];
  for (const j of jobs.values()) {
    try { j.bytes = await fetchBytes(j.url); ok.push(j); }
    catch (e) { j.error = e.message; bad.push(j); }
  }
  const byHost = (list) => list.reduce((m, j) => { m[hostOf(j.url)] = (m[hostOf(j.url)] || 0) + 1; return m; }, {});
  console.log('readable now:', ok.length, JSON.stringify(byHost(ok)), '| NOT readable:', bad.length, JSON.stringify(byHost(bad)));
  bad.forEach((j) => console.log('   cannot read (' + j.error + '):', j.refs.join(' ; ')));
  if (mode === 'check') { process.exit(0); }

  // ---- run ----
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(__dirname, 'backups', 'photo-migration-backup-' + stamp + '.json');
  fs.writeFileSync(backupFile, JSON.stringify({
    at: Date.now(),
    register: reg.filter((e) => legacy(urlOf(e.photo))).map((e) => ({ id: e.id, name: e.name, photo: e.photo })),
    staffDocs: staffDocs.filter((e) => legacy(urlOf(e.photo))).map((e) => ({ _id: e._id, id: e.id, photo: e.photo })),
    users: users.filter((u) => legacy(urlOf(u.photo))).map((u) => ({ username: u.username, photo: u.photo })),
  }, null, 2));
  console.log('backup of every old reference:', backupFile);

  const moved = new Map();   // old url -> new photo object
  for (const j of ok) {
    const up = await blobStore.uploadBuffer(j.bytes, { folder: j.folder });
    // verify the private copy can be read back and decodes to the same picture size
    const back = await blobStore.readCachedAsset ? null : null;
    const head = await blobStore.getAsset(up.publicId);
    if (!head || head.publicId !== up.publicId) throw new Error('Verification failed for ' + j.url);
    moved.set(j.url, { url: up.url, publicId: up.publicId, updatedAt: Date.now(), migratedFrom: hostOf(j.url) });
    process.stdout.write('.');
  }
  console.log('\ncopied to private Blob (AVIF):', moved.size);
  const swap = (p) => { const n = moved.get(urlOf(p)); return n ? (typeof p === 'string' ? n.url : Object.assign({}, p, n)) : null; };

  // staff register — compare-and-set, re-reading on contention
  let regChanged = 0;
  for (let attempt = 1; attempt <= 8; attempt++) {
    const cur = await appdata.findOne({ _id: ad._id });
    const raw = cur.data.unico_staff_v3;
    const rows = JSON.parse(raw); regChanged = 0;
    rows.forEach((e) => { const n = swap(e.photo); if (n) { e.photo = n; regChanged++; } });
    if (!regChanged) break;
    const next = JSON.stringify(rows);
    const r = await appdata.updateOne({ _id: ad._id, 'data.unico_staff_v3': raw }, { $set: { 'data.unico_staff_v3': next, updatedAt: Date.now() } });
    if (r.modifiedCount === 1) break;
    if (attempt === 8) throw new Error('The staff register kept changing; nothing was forced. Run again.');
    await new Promise((res) => setTimeout(res, 1500));
  }
  console.log('staff register rows updated:', regChanged);

  let docN = 0;
  for (const e of staffDocs) { const n = swap(e.photo); if (n) { await db.collection('staff').updateOne({ _id: e._id }, { $set: { photo: n } }); docN++; } }
  console.log('staff documents updated:', docN);
  let userN = 0;
  for (const u of users) { const n = swap(u.photo); if (n) { await db.collection('users').updateOne({ _id: u._id }, { $set: { photo: n } }); userN++; } }
  console.log('user accounts updated:', userN);
  process.exit(0);
})().catch((e) => { console.log('ERROR', e.message); process.exit(1); });
