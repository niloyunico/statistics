/* MIGRATION — physically merge Statistics + Quality in MongoDB.
 *
 * Embeds each `quality` area document into its linked `departments` document as
 * `dept.quality`, so one department record now holds BOTH its monthly statistics
 * (months[]/data[]) and its quality indicators. The single quality-only area
 * ("Overall Hospital" hand hygiene) becomes a qualityOnly department (_id=__hospital__)
 * that stats views hide.
 *
 * SAFE: additive + idempotent. The `quality` collection is LEFT INTACT (retire it only
 * after verifying the app). Always run backup-collections first (a *_bak_* clone exists).
 *
 * Run:  cd server && node merge-quality-into-departments.js
 */
require('dotenv').config();
const { getDbHandle, close } = require('./db');
const HOSPITAL = '__hospital__';

(async () => {
  const db = await getDbHandle();
  if (!db) { console.error('No MONGODB_URI — nothing to migrate.'); process.exit(1); }
  const D = db.collection('departments');
  const quals = await db.collection('quality').find({}).toArray();
  if (!quals.length) { console.error('quality collection is empty — aborting.'); process.exit(1); }

  let embedded = 0, hospital = 0; const missing = [];
  for (const q of quals) {
    const key = q.key || q._id;
    const emb = Object.assign({}, q); delete emb._id; emb.key = key; emb.deptId = q.deptId || null;

    if (q.deptId === HOSPITAL || key === 'Overall Hospital') {
      emb.deptId = HOSPITAL;
      await D.updateOne({ _id: HOSPITAL }, { $set: {
        id: HOSPITAL, name: q.name || 'Overall Hospital', short: 'Hospital', group: 'Hospital',
        desc: 'Hospital-wide quality indicators', qualityOnly: true, qualityKey: key,
        order: 9000, months: [], data: [], cols: [], quality: emb,
      } }, { upsert: true });
      hospital++; continue;
    }

    let dep = q.deptId ? await D.findOne({ _id: q.deptId }) : null;
    if (!dep) dep = await D.findOne({ qualityKey: key });
    if (!dep) { missing.push(key); continue; }
    emb.deptId = dep.id || dep._id;
    await D.updateOne({ _id: dep._id }, { $set: { quality: emb } });
    embedded++;
  }

  const deps = await D.find({}).toArray();
  const withQ = deps.filter(d => d.quality && d.quality.key).length;
  console.log(`embedded into departments: ${embedded}`);
  console.log(`hospital pseudo-dept upserted: ${hospital}`);
  console.log(`departments carrying quality: ${withQ}/${deps.length}  (stats depts: ${deps.filter(d => !d.qualityOnly).length})`);
  if (missing.length) console.log('!! quality areas with NO matching department:', missing.join(', '));
  try { await D.createIndex({ 'quality.key': 1 }); console.log('index quality.key ok'); } catch (e) { console.log('index:', e.message); }

  await close();
  console.log(missing.length ? 'DONE with warnings.' : 'DONE.');
  process.exit(missing.length ? 2 : 0);
})().catch(e => { console.error('ERR', e && (e.stack || e)); process.exit(1); });
