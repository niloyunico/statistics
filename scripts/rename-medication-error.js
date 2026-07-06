/* Rename the "Medication Error" indicator to "Medication Administration Error"
 * everywhere it is DISPLAYED from live data:
 *   - quality collection: indicators[].name / numLabel / formulaText (field-level $set,
 *     ids like ind-medication-error stay unchanged) + prose mentions in top-level
 *     narrative fields (keyAchievements, recommendations, …) and executive blocks.
 *   - submissions collection: stored indicatorName (used as display fallback and to
 *     re-create a missing indicator on approve).
 *   - appdata 'shared' doc: the mirrored unico_quality_v2 overlay — any indPatches /
 *     indAdded / catalog entry still carrying the old name would override the DB
 *     rename at merge time, so rename those too.
 *
 * Backed up: every modified quality doc is written to scripts/backups/ first.
 * Usage: node scripts/rename-medication-error.js [--check]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });
try { require('dns').setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']); } catch (e) {}
const fs = require('fs');
const path = require('path');
const { MongoClient } = require(path.join(__dirname, '..', 'server', 'node_modules', 'mongodb'));

const OLD = 'Medication Error';
const NEW = 'Medication Administration Error';
const isOldName = (s) => String(s || '').trim().toLowerCase() === OLD.toLowerCase();
const swap = (s) => String(s).split(OLD).join(NEW);

(async () => {
  const check = process.argv.includes('--check');
  const c = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 12000 });
  await c.connect();
  const db = c.db(process.env.DB_NAME || 'unico');

  /* ---------- quality collection ---------- */
  const qcol = db.collection('quality');
  const docs = await qcol.find({}).toArray();
  const backup = [];
  for (const doc of docs) {
    const sets = {};
    (doc.indicators || []).forEach((ind, i) => {
      if (isOldName(ind.name)) sets[`indicators.${i}.name`] = NEW;
      if (ind.numLabel && ind.numLabel.includes(OLD)) sets[`indicators.${i}.numLabel`] = swap(ind.numLabel);
      if (ind.formulaText && ind.formulaText.includes(OLD)) sets[`indicators.${i}.formulaText`] = swap(ind.formulaText);
    });
    // narrative prose: top-level strings + executive block strings
    Object.keys(doc).forEach((k) => {
      if (typeof doc[k] === 'string' && doc[k].includes(OLD)) sets[k] = swap(doc[k]);
    });
    if (doc.executive && typeof doc.executive === 'object') {
      Object.keys(doc.executive).forEach((k) => {
        if (typeof doc.executive[k] === 'string' && doc.executive[k].includes(OLD)) sets[`executive.${k}`] = swap(doc.executive[k]);
      });
    }
    if (!Object.keys(sets).length) continue;
    console.log(`  quality/${doc._id}:`, Object.keys(sets).join(', '));
    backup.push(doc);
    if (!check) await qcol.updateOne({ _id: doc._id }, { $set: sets });
  }

  /* ---------- submissions collection ---------- */
  const scol = db.collection('submissions');
  const subs = await scol.find({ type: 'quality', indicatorName: { $regex: `^\\s*${OLD}\\s*$`, $options: 'i' } }).toArray();
  console.log(`  submissions with old indicatorName: ${subs.length}`);
  if (!check && subs.length) {
    await scol.updateMany({ _id: { $in: subs.map((s) => s._id) } }, { $set: { indicatorName: NEW } });
  }

  /* ---------- appdata overlay mirror (unico_quality_v2) ---------- */
  const acol = db.collection('appdata');
  const shared = await acol.findOne({ _id: 'shared' });
  const raw = shared && shared.data && shared.data['unico_quality_v2'];
  if (raw) {
    let ov = null;
    try { ov = JSON.parse(raw); } catch (e) {}
    let hits = 0;
    const walk = (v) => {
      if (Array.isArray(v)) { v.forEach(walk); return; }
      if (v && typeof v === 'object') {
        if (isOldName(v.name)) { v.name = NEW; hits++; }
        Object.values(v).forEach(walk);
      }
    };
    if (ov) walk(ov);
    console.log(`  overlay (unico_quality_v2) stale name entries: ${hits}`);
    if (!check && hits) {
      await acol.updateOne({ _id: 'shared' }, { $set: { 'data.unico_quality_v2': JSON.stringify(ov) } });
    }
  } else {
    console.log('  overlay (unico_quality_v2): not present');
  }

  if (backup.length && !check) {
    const dir = path.join(__dirname, 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `rename-med-error-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify(backup, null, 2));
    console.log('  backup written:', file);
  }
  console.log(check ? '\n[rename] dry run — no writes.' : '\n[rename] applied.');
  await c.close();
})();
