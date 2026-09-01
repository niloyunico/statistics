/* One-off cleanup: Dialysis "Out Patient Fall" was duplicated into three copies —
 *   DB canonical  ind-out-patient-fall        (Jul-26 data)
 *   DB twin       ind-out-patient-fall-5768   (Jun-26 data)  <- minted by a mismatched submission
 *   overlay twin  ind-out-patient-fall-wtgp   (no data)      <- client indAdded twin
 * Merge the DB twin's monthly data into the canonical (union; canonical wins on
 * conflicting keys), delete the DB twin, and scrub the empty overlay twin.
 * Backs up the affected department + overlay slice first. Idempotent. */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const fs = require('fs');
const { getDbHandle } = require('../server/db');

const CANON = 'ind-out-patient-fall';
const DB_TWIN = 'ind-out-patient-fall-5768';
const NESTED = ['months', 'monthRemarks', 'mNum', 'mDen', 'quarters', 'quarterRemarks', 'qNum', 'qDen', 'incidents', 'mGroups', 'capa'];
const nonEmpty = (v) => v != null && v !== '';

(async () => {
  const db = await getDbHandle();
  if (!db) { console.error('No DB (MONGODB_URI not set).'); process.exit(1); }
  const depCol = db.collection('departments');
  const deps = await depCol.find({ 'quality.key': { $exists: true } }).toArray();
  const dia = deps.find((d) => d.quality && /dialysis/i.test(d.quality.name || d.name || ''));
  if (!dia) { console.error('Dialysis area not found.'); process.exit(1); }
  const inds = dia.quality.indicators || [];
  const canon = inds.find((i) => i.id === CANON);
  const twin = inds.find((i) => i.id === DB_TWIN);

  const appCol = db.collection('appdata');
  const app = await appCol.findOne({ _id: 'shared' });
  const rawKey = 'unico_quality_v2';
  let ov = null; try { ov = app && app.data && app.data[rawKey] ? JSON.parse(app.data[rawKey]) : null; } catch (e) { ov = null; }
  const diaOv = ov && ov.depts && ov.depts['Dialysis'];

  // ---- backup ----
  const stamp = new Date(Number(process.env.STAMP) || 0).toISOString().replace(/[:.]/g, '-'); // deterministic-safe
  const backup = { when: Date.now(), deptId: dia._id, indicators: inds, overlayDialysis: diaOv || null };
  const bdir = path.join(__dirname, 'backups'); try { fs.mkdirSync(bdir, { recursive: true }); } catch (e) {}
  const bfile = path.join(bdir, 'outpatientfall-dedupe-' + backup.when + '.json');
  fs.writeFileSync(bfile, JSON.stringify(backup, null, 2));
  console.log('Backup written:', bfile);

  let changed = false;

  // ---- 1) merge DB twin -> canonical, drop twin ----
  if (twin && canon) {
    NESTED.forEach((f) => {
      const src = twin[f]; if (!src || typeof src !== 'object') return;
      const dst = canon[f] || (canon[f] = {});
      Object.keys(src).forEach((k) => { if (nonEmpty(src[k]) && !nonEmpty(dst[k])) dst[k] = src[k]; }); // canonical wins on conflict
    });
    dia.quality.indicators = inds.filter((i) => i.id !== DB_TWIN);
    await depCol.updateOne({ _id: dia._id }, { $set: { 'quality.indicators': dia.quality.indicators } });
    console.log('DB: merged ' + DB_TWIN + ' into ' + CANON + ' and removed the twin. Months now:', Object.keys(canon.months || {}).join(', '));
    changed = true;
  } else if (!twin) {
    console.log('DB: no twin ' + DB_TWIN + ' (already merged).');
  }

  // ---- 2) scrub overlay twin(s) of Out Patient Fall (keep the canonical id) ----
  if (diaOv) {
    const before = (diaOv.indAdded || []).length;
    const isOpfTwin = (a) => a && a.id !== CANON && /out.?patient.?fall/i.test(a.name || '');
    // move any data an overlay twin carried into the canonical DB indicator before dropping it
    (diaOv.indAdded || []).filter(isOpfTwin).forEach((a) => {
      NESTED.forEach((f) => { const src = a[f]; if (src && typeof src === 'object' && canon) { const dst = canon[f] || (canon[f] = {}); Object.keys(src).forEach((k) => { if (nonEmpty(src[k]) && !nonEmpty(dst[k])) dst[k] = src[k]; }); } });
      if (diaOv.indPatches) delete diaOv.indPatches[a.id];
    });
    diaOv.indAdded = (diaOv.indAdded || []).filter((a) => !isOpfTwin(a));
    if (diaOv.indAdded.length !== before) {
      // if a twin carried data, canonical was mutated — persist it too
      await depCol.updateOne({ _id: dia._id }, { $set: { 'quality.indicators': dia.quality.indicators } });
      app.data[rawKey] = JSON.stringify(ov);
      await appCol.updateOne({ _id: 'shared' }, { $set: { ['data.' + rawKey]: app.data[rawKey] } });
      console.log('Overlay: removed ' + (before - diaOv.indAdded.length) + ' Out-Patient-Fall twin(s) from indAdded.');
      changed = true;
    } else {
      console.log('Overlay: no Out-Patient-Fall twin to remove.');
    }
  } else {
    console.log('Overlay: no Dialysis overlay present.');
  }

  console.log(changed ? '\nDone. Out Patient Fall is now a single indicator in Dialysis.' : '\nNothing to change (already clean).');
  process.exit(0);
})().catch((e) => { console.error('Failed:', e.message || e); process.exit(1); });
