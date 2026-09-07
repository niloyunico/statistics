/* Copy staff portrait urls out of the `unico_staff_v3` overlay onto the staff
 * documents, where server/photos.js now writes them.
 *
 * Portraits used to live ONLY in that overlay — the browser's copy of the roster,
 * mirrored back as one array — so a stale tab or an unlucky hydration dropped them.
 * On production that left 23 of 51 uploaded images orphaned in Cloudinary: the picture
 * kept, the link gone. This puts the surviving links somewhere durable.
 *
 *   node backfill-staff-photos.js          # report only
 *   node backfill-staff-photos.js --apply  # write
 */
require('dotenv').config({ path: __dirname + '/.env' });
const db = require('./db');
const photos = require('./photos');

const APPLY = process.argv.includes('--apply');

(async () => {
  const h = await db.getDbHandle(); const dbh = h && h.db ? h.db : h;
  const doc = await dbh.collection('appdata').findOne({});
  let ov = (doc.data || {})['unico_staff_v3'];
  if (typeof ov === 'string') { try { ov = JSON.parse(ov); } catch (e) { ov = []; } }
  if (!Array.isArray(ov)) { console.log('no staff overlay found'); return; }

  const photoOf = (e) => { const p = e && (e.photo || e.photo_url); return p ? (typeof p === 'string' ? { url: p } : p) : null; };
  const rows = ov.map((e) => ({ e, p: photoOf(e) })).filter((x) => x.p && x.p.url);
  console.log('overlay rows with a portrait: ' + rows.length);

  const col = await dbh.collection('staff').find({}).toArray();
  const has = new Set(col.filter((d) => d.photo && d.photo.url).map((d) => String(d.emp_id || d.id)));
  const todo = rows.filter((x) => !has.has(String(x.e.emp_id || x.e.id)));
  console.log('already on the staff document: ' + (rows.length - todo.length) + ' | to copy: ' + todo.length);
  todo.forEach((x) => console.log('   ' + String(x.e.emp_id || x.e.id).padEnd(8) + String(x.e.name || '').slice(0, 30)));
  if (!todo.length) { console.log('nothing to do.'); return; }
  if (!APPLY) { console.log('\n(dry run — pass --apply to write)'); return; }

  let ok = 0; const missed = [];
  for (const x of todo) {
    const p = x.p;
    const done = await photos.setStaffPhoto(x.e.id, x.e.emp_id,
      { url: p.url, publicId: p.publicId || '', updatedAt: p.updatedAt || Date.now() });
    if (done) ok++; else missed.push(String(x.e.emp_id || x.e.id) + ' ' + (x.e.name || ''));
  }
  console.log('\ncopied: ' + ok + ' | no matching staff document: ' + missed.length);
  missed.forEach((m) => console.log('   ' + m));

  const after = (await db.getStaff({ fresh: true })).filter((d) => d.photo && d.photo.url).length;
  console.log('staff documents now carrying a portrait: ' + after);
})().then(() => process.exit(0)).catch((e) => { console.error('ERR', e.message); process.exit(1); });
