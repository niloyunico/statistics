/* COMPLETELY remove an indicator (by exact normalized name) from the live system:
 *   - quality collection: drop it from every department's indicators array
 *   - appdata 'shared' unico_quality_v2 overlay: drop indAdded entries + indPatches
 *     (and stale indRemoved ids pointing at it)
 *   - users + responsibles: strip its ids from qualityIndicators[area] lists
 *   - submissions: PENDING quality submissions for it are REJECTED with a note
 *     (approving one would silently re-create the indicator); history is kept.
 *
 * The HQI Formula Library catalog is untouched — the indicator can be re-assigned
 * later from Assign by Department if ever needed again.
 *
 * Backs up every modified doc to scripts/backups/ first.
 * Usage: node scripts/remove-indicator.js --name "Return to ICU"           (dry run)
 *        node scripts/remove-indicator.js --name "Return to ICU" --apply   (write)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });
try { require('dns').setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']); } catch (e) {}
const fs = require('fs');
const path = require('path');
const { MongoClient } = require(path.join(__dirname, '..', 'server', 'node_modules', 'mongodb'));

const argName = (() => { const i = process.argv.indexOf('--name'); return i >= 0 ? process.argv[i + 1] : null; })();
if (!argName) { console.error('Usage: node scripts/remove-indicator.js --name "<indicator name>" [--apply]'); process.exit(1); }
const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const TARGET = norm(argName);
const hits = (ind) => norm(ind && ind.name) === TARGET;
const dataCount = (ind) => {
  let n = 0;
  ['months', 'mNum', 'mDen'].forEach((f) => Object.keys((ind && ind[f]) || {}).forEach((k) => { if (ind[f][k] != null && ind[f][k] !== '') n++; }));
  Object.keys((ind && ind.incidents) || {}).forEach((k) => { if (Array.isArray(ind.incidents[k])) n += ind.incidents[k].length; });
  return n;
};

(async () => {
  const apply = process.argv.includes('--apply');
  const c = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 12000 });
  await c.connect();
  const db = c.db(process.env.DB_NAME || 'unico');
  const backup = { when: new Date().toISOString(), target: argName, quality: [], appdata: null, users: [], responsibles: [], submissions: [] };
  const plan = [];
  const removedIds = new Set();

  /* ---------- quality collection ---------- */
  const qcol = db.collection('quality');
  const docs = await qcol.find({}).toArray();
  for (const doc of docs) {
    const found = (doc.indicators || []).filter(hits);
    if (!found.length) continue;
    found.forEach((ind) => removedIds.add(ind.id));
    plan.push({ where: 'quality/' + (doc.name || doc._id), remove: found.map((i) => i.id + (dataCount(i) ? ' ⚠ ' + dataCount(i) + ' data entries' : ' (empty)')) });
    if (!apply) continue;
    backup.quality.push(doc);
    await qcol.updateOne({ _id: doc._id }, { $set: { indicators: (doc.indicators || []).filter((i) => !hits(i)) } });
  }

  /* ---------- overlay (appdata shared -> unico_quality_v2) ---------- */
  const appdata = db.collection('appdata');
  const shared = await appdata.findOne({ _id: 'shared' });
  let overlay = null;
  try { overlay = shared && shared.data && shared.data['unico_quality_v2'] ? JSON.parse(shared.data['unico_quality_v2']) : null; } catch (e) { overlay = null; }
  let overlayChanged = false;
  if (overlay && overlay.depts) {
    Object.keys(overlay.depts).forEach((dk) => {
      const o = overlay.depts[dk]; if (!o) return;
      const added = (o.indAdded || []).filter(hits);
      added.forEach((ind) => removedIds.add(ind.id));
      const patchIds = Object.keys(o.indPatches || {}).filter((id) => removedIds.has(id) || hits(Object.assign({ name: (o.indPatches[id] || {}).name }, {})));
      if (added.length || patchIds.length) {
        plan.push({ where: 'overlay/' + dk, remove: added.map((i) => i.id + ' (indAdded)').concat(patchIds.map((id) => id + ' (patch)')) });
        if (apply) {
          if (o.indAdded) o.indAdded = o.indAdded.filter((i) => !hits(i));
          patchIds.forEach((id) => { if (o.indPatches) delete o.indPatches[id]; });
          overlayChanged = true;
        }
      }
    });
    // stale catalog entry with this name too
    if (Array.isArray(overlay.catalog) && overlay.catalog.some(hits)) {
      plan.push({ where: 'overlay/catalog', remove: ['catalog entry'] });
      if (apply) { overlay.catalog = overlay.catalog.filter((x) => !hits(x)); overlayChanged = true; }
    }
  }

  const ids = [...removedIds];

  /* ---------- users + responsibles: strip the ids from qualityIndicators ---------- */
  for (const colName of ['users', 'responsibles']) {
    const col = db.collection(colName);
    const rows = await col.find({ qualityIndicators: { $exists: true } }).toArray();
    for (const r of rows) {
      const qi = r.qualityIndicators; if (!qi || typeof qi !== 'object' || Array.isArray(qi)) continue;
      let changed = false; const next = {};
      Object.keys(qi).forEach((ak) => {
        const list = Array.isArray(qi[ak]) ? qi[ak] : [];
        const kept = list.filter((id) => !removedIds.has(id));
        if (kept.length !== list.length) changed = true;
        next[ak] = kept;
      });
      if (!changed) continue;
      plan.push({ where: colName + '/' + (r.name || r.username || r._id), remove: ['access-list ids'] });
      if (apply) { backup[colName].push(r); await col.updateOne({ _id: r._id }, { $set: { qualityIndicators: next } }); }
    }
  }

  /* ---------- pending submissions -> rejected (approve would re-create it) ---------- */
  const scol = db.collection('submissions');
  const pend = await scol.find({ type: 'quality', status: 'pending', $or: [{ indicatorId: { $in: ids.length ? ids : ['__none__'] } }, { indicatorName: { $regex: '^\\s*' + argName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', $options: 'i' } }] }).toArray();
  for (const s of pend) {
    plan.push({ where: 'submission/' + s._id, remove: ['pending → rejected'] });
    if (apply) { backup.submissions.push(s); await scol.updateOne({ _id: s._id }, { $set: { status: 'rejected', reviewNote: 'Indicator "' + argName + '" was removed from the system.' } }); }
  }

  if (apply && overlayChanged) {
    backup.appdata = shared;
    await appdata.updateOne({ _id: 'shared' }, { $set: { ['data.unico_quality_v2']: JSON.stringify(overlay), updatedAt: Date.now() } });
  }
  if (apply) {
    const dir = path.join(__dirname, 'backups');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'remove-' + TARGET.replace(/[^a-z0-9]+/g, '-') + '-' + Date.now() + '.json');
    fs.writeFileSync(file, JSON.stringify(backup, null, 2));
    console.log('backup ->', file);
  }
  console.log(JSON.stringify({ mode: apply ? 'APPLIED' : 'DRY RUN', target: argName, removedIds: ids, plan }, null, 2));
  await c.close();
})().catch((e) => { console.error('failed:', e.message); process.exit(1); });
