/* Remove DUPLICATE needle-stick indicators WITHIN each department, keeping one.
 * (Same indicator listed twice in a dept — e.g. Level 10 Ward had "Needle Stick
 * Injury" ×2, Cath Lab "Needle Stick / Sharps Injury" ×2.)
 *
 * Keeper per department = the copy with the MOST recorded data (months + mNum +
 * incidents, judged on base doc ∪ overlay indPatches); ties prefer the base-doc
 * copy, then the first. Any month data / incidents only the losers carried is
 * MERGED into the keeper (never overwriting a keeper value) before removal.
 *
 * Cleans every place a loser id could resurrect a duplicate:
 *   - quality collection: doc.indicators array (single $set per doc)
 *   - appdata 'shared' unico_quality_v2 overlay: indAdded entries + indPatches
 *   - users + responsibles: qualityIndicators[area] lists (loser id -> keeper id)
 *   - submissions: PENDING quality submissions re-pointed at the keeper id
 *     (approve re-creates a missing indicator, which would re-add the duplicate)
 *
 * Backs up every modified doc to scripts/backups/ first.
 * Usage: node scripts/dedupe-needle-stick.js          (dry run — prints the plan)
 *        node scripts/dedupe-needle-stick.js --apply  (writes the changes)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });
try { require('dns').setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']); } catch (e) {}
const fs = require('fs');
const path = require('path');
const { MongoClient } = require(path.join(__dirname, '..', 'server', 'node_modules', 'mongodb'));

const isNSI = (name) => /needle\s*stick|sharps\s*injur|\bnsi\b/i.test(String(name || ''));
const MONTH_FIELDS = ['months', 'mNum', 'mDen', 'monthRemarks'];
const nonEmpty = (v) => v != null && v !== '';

function mergedView(ind, patch) {
  const out = {};
  MONTH_FIELDS.concat(['incidents', 'capa']).forEach((f) => {
    out[f] = Object.assign({}, (ind && ind[f]) || {}, (patch && patch[f]) || {});
  });
  return out;
}
function dataScore(view) {
  let s = 0;
  ['months', 'mNum'].forEach((f) => Object.keys(view[f]).forEach((k) => { if (nonEmpty(view[f][k])) s += 2; }));
  Object.keys(view.mDen).forEach((k) => { if (nonEmpty(view.mDen[k])) s += 1; });
  Object.keys(view.incidents).forEach((k) => { if (Array.isArray(view.incidents[k])) s += view.incidents[k].length * 5; });
  return s;
}

(async () => {
  const apply = process.argv.includes('--apply');
  const c = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 12000 });
  await c.connect();
  const db = c.db(process.env.DB_NAME || 'unico');
  const backup = { when: new Date().toISOString(), quality: [], appdata: null, users: [], responsibles: [], submissions: [] };
  const plan = [];

  /* ---------- overlay (appdata shared -> unico_quality_v2) ---------- */
  const appdata = db.collection('appdata');
  const shared = await appdata.findOne({ _id: 'shared' });
  let overlay = null;
  try { overlay = shared && shared.data && shared.data['unico_quality_v2'] ? JSON.parse(shared.data['unico_quality_v2']) : null; } catch (e) { overlay = null; }
  const ovDepts = (overlay && overlay.depts) || {};

  /* ---------- quality collection: find + resolve duplicates ---------- */
  const qcol = db.collection('quality');
  const docs = await qcol.find({}).toArray();
  const loserToKeeper = {}; // loserId -> keeperId (global; ids are unique enough per dedupe)
  let qualityWrites = 0, overlayChanged = false;

  for (const doc of docs) {
    const key = doc._id != null ? String(doc._id) : doc.key;
    const ov = ovDepts[doc.key] || ovDepts[key] || {};
    const patches = ov.indPatches || {};
    const removedSet = new Set(ov.indRemoved || []);

    // candidates = base-doc NSI indicators not already overlay-removed, + overlay-added NSI
    const cands = [];
    (doc.indicators || []).forEach((ind, i) => { if (isNSI(ind.name) && !removedSet.has(ind.id)) cands.push({ src: 'base', i, ind, patch: patches[ind.id] }); });
    (ov.indAdded || []).forEach((ind, i) => { if (isNSI(ind.name)) cands.push({ src: 'overlay', i, ind, patch: patches[ind.id] }); });
    if (cands.length <= 1) continue;

    cands.forEach((cd) => { cd.view = mergedView(cd.ind, cd.patch); cd.score = dataScore(cd.view); });
    cands.sort((a, b) => (b.score - a.score) || ((a.src === 'base' ? 0 : 1) - (b.src === 'base' ? 0 : 1)) || (a.i - b.i));
    const keeper = cands[0], losers = cands.slice(1);

    // merge month data + incidents the keeper lacks (into the BASE copy of the keeper)
    const kView = keeper.view;
    const mergeInto = {};
    losers.forEach((lo) => {
      MONTH_FIELDS.forEach((f) => Object.keys(lo.view[f]).forEach((mk) => {
        if (nonEmpty(lo.view[f][mk]) && !nonEmpty(kView[f][mk])) { (mergeInto[f] = mergeInto[f] || {})[mk] = lo.view[f][mk]; kView[f][mk] = lo.view[f][mk]; }
      }));
      Object.keys(lo.view.incidents).forEach((mk) => {
        const arr = lo.view.incidents[mk];
        if (Array.isArray(arr) && arr.length && !(Array.isArray(kView.incidents[mk]) && kView.incidents[mk].length)) { (mergeInto.incidents = mergeInto.incidents || {})[mk] = arr; kView.incidents[mk] = arr; }
      });
    });

    losers.forEach((lo) => { loserToKeeper[lo.ind.id] = keeper.ind.id; });
    plan.push({
      dept: doc.name || doc._id, area: doc._id,
      keep: { id: keeper.ind.id, name: keeper.ind.name, src: keeper.src, score: keeper.score },
      remove: losers.map((l) => ({ id: l.ind.id, name: l.ind.name, src: l.src, score: l.score })),
      merged: Object.keys(mergeInto).length ? Object.keys(mergeInto).map((f) => f + ':' + Object.keys(mergeInto[f]).join('/')).join(' · ') : '(nothing to merge)',
    });
    if (!apply) continue;

    // ---- write: quality doc (drop base losers, merge keeper data if keeper is base)
    const loserIds = new Set(losers.filter((l) => l.src === 'base').map((l) => l.ind.id));
    if (loserIds.size || (keeper.src === 'base' && Object.keys(mergeInto).length)) {
      backup.quality.push(doc);
      const newInds = (doc.indicators || []).filter((ind) => !loserIds.has(ind.id)).map((ind) => {
        if (ind.id !== keeper.ind.id || keeper.src !== 'base') return ind;
        const merged = Object.assign({}, ind);
        Object.keys(mergeInto).forEach((f) => { merged[f] = Object.assign({}, ind[f] || {}, mergeInto[f]); });
        return merged;
      });
      await qcol.updateOne({ _id: doc._id }, { $set: { indicators: newInds } });
      qualityWrites++;
    }
    // ---- write: overlay (drop overlay-added losers + their patches; keeper-as-overlay gets merged data via its indAdded entry)
    const ovLosers = losers.filter((l) => l.src === 'overlay').map((l) => l.ind.id);
    const ovKey = ovDepts[doc.key] ? doc.key : key;
    if (ovDepts[ovKey] && (ovLosers.length || losers.some((l) => patches[l.ind.id]))) {
      const o = ovDepts[ovKey];
      if (Array.isArray(o.indAdded)) o.indAdded = o.indAdded.filter((x) => !ovLosers.includes(x.id) || x.id === keeper.ind.id);
      losers.forEach((l) => { if (o.indPatches) delete o.indPatches[l.ind.id]; });
      overlayChanged = true;
    }
    if (keeper.src === 'overlay' && Object.keys(mergeInto).length && ovDepts[ovKey] && Array.isArray(ovDepts[ovKey].indAdded)) {
      ovDepts[ovKey].indAdded = ovDepts[ovKey].indAdded.map((x) => {
        if (x.id !== keeper.ind.id) return x;
        const merged = Object.assign({}, x);
        Object.keys(mergeInto).forEach((f) => { merged[f] = Object.assign({}, x[f] || {}, mergeInto[f]); });
        return merged;
      });
      overlayChanged = true;
    }
  }

  const losers = Object.keys(loserToKeeper);

  /* ---------- users + responsibles: remap qualityIndicators lists ---------- */
  const remapQI = (qi) => {
    if (!qi || typeof qi !== 'object' || Array.isArray(qi)) return null;
    let changed = false; const out = {};
    Object.keys(qi).forEach((ak) => {
      const list = Array.isArray(qi[ak]) ? qi[ak] : [];
      const mapped = [...new Set(list.map((id) => loserToKeeper[id] || id))];
      if (mapped.length !== list.length || mapped.some((v, i) => v !== list[i])) changed = true;
      out[ak] = mapped;
    });
    return changed ? out : null;
  };
  for (const colName of ['users', 'responsibles']) {
    const col = db.collection(colName);
    const rows = await col.find({ qualityIndicators: { $exists: true } }).toArray();
    for (const r of rows) {
      const next = remapQI(r.qualityIndicators);
      if (!next) continue;
      plan.push({ dept: '(' + colName + ') ' + (r.name || r.username || r._id), remap: 'qualityIndicators loser→keeper' });
      if (apply) { backup[colName].push(r); await col.updateOne({ _id: r._id }, { $set: { qualityIndicators: next } }); }
    }
  }

  /* ---------- pending quality submissions: re-point at the keeper ---------- */
  if (losers.length) {
    const scol = db.collection('submissions');
    const pend = await scol.find({ type: 'quality', status: 'pending', indicatorId: { $in: losers } }).toArray();
    for (const s of pend) {
      plan.push({ dept: '(submission) ' + s._id, remap: s.indicatorId + ' → ' + loserToKeeper[s.indicatorId] });
      if (apply) { backup.submissions.push(s); await scol.updateOne({ _id: s._id }, { $set: { indicatorId: loserToKeeper[s.indicatorId] } }); }
    }
  }

  /* ---------- persist overlay + backup ---------- */
  if (apply && overlayChanged) {
    backup.appdata = shared;
    await appdata.updateOne({ _id: 'shared' }, { $set: { ['data.unico_quality_v2']: JSON.stringify(overlay), updatedAt: Date.now() } });
  }
  if (apply) {
    const dir = path.join(__dirname, 'backups');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'nsi-dedupe-' + Date.now() + '.json');
    fs.writeFileSync(file, JSON.stringify(backup, null, 2));
    console.log('backup ->', file);
  }

  console.log(JSON.stringify({ mode: apply ? 'APPLIED' : 'DRY RUN', duplicatesFound: plan.filter((p) => p.remove).length, qualityDocsRewritten: qualityWrites, overlayChanged, plan }, null, 2));
  await c.close();
})().catch((e) => { console.error('failed:', e.message); process.exit(1); });
