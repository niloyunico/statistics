/* Rename the Dialysis water indicator to match the master formula library.
 *
 *   "Water Quality Compliance"  ->  "Dialysis Water Quality Compliance"
 *
 * The master row (qualityFormulas/dialysis-water-quality-compliance) has always been
 * called "Dialysis Water Quality Compliance"; only the department copy was short. The
 * short name filed the indicator under W in the manual and said nothing about dialysis or
 * about the RO plant it actually measures, so nobody looking for RO water could find it.
 *
 * NAME ONLY. The indicator id, formula, numerator, denominator, benchmark and every
 * recorded month are untouched — recorded data is keyed by indicator id, not by name, so
 * a rename cannot move a figure. What it measures is deliberately NOT widened: this
 * indicator counts microbiological and endotoxin samples, and the ISO 23500-3 chemical
 * panel and the per-shift chlorine/chloramine test remain outside it.
 *
 * Also registers RO spellings as aliases on the master row so a search for "RO water"
 * reaches it. The previous name is already an alias, so nothing that referred to it by
 * the old name stops resolving.
 *
 * Idempotent. Usage: node scripts/rename-dialysis-water-indicator.js [--dry]
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const { getDbHandle } = require('../server/db');

const IND_ID = 'ind-water-quality-compliance';
const CATALOGUE_ID = 'dialysis-water-quality-compliance';
const NEW_NAME = 'Dialysis Water Quality Compliance';
const RO_ALIASES = ['ro water quality', 'ro water quality compliance', 'ro water compliance',
  'dialysis ro water', 'reverse osmosis water quality', 'dialysis water quality'];

(async () => {
  const dry = process.argv.includes('--dry');
  const db = await getDbHandle();
  if (!db) { console.error('No DB (MONGODB_URI not set).'); process.exit(1); }

  const deps = await db.collection('departments')
    .find({ 'quality.indicators.id': IND_ID }).toArray();
  if (!deps.length) { console.error('No department holds ' + IND_ID); process.exit(1); }

  for (const dep of deps) {
    const inds = dep.quality.indicators;
    const ind = inds.find((i) => i.id === IND_ID);
    const was = ind.name;
    if (was === NEW_NAME) {
      console.log('already named: ' + dep.quality.name + '  "' + NEW_NAME + '"');
    } else {
      ind.name = NEW_NAME;
      if (!dry) {
        await db.collection('departments').updateOne({ _id: dep._id },
          { $set: { 'quality.indicators': inds } });
      }
      console.log('renamed: ' + dep.quality.name + '  "' + was + '"  ->  "' + NEW_NAME + '"'
        + (dry ? '  (DRY RUN)' : ''));
    }
    const months = Object.keys(ind.months || {});
    console.log('  recorded months left untouched: ' + (months.length ? months.join(', ') : 'none'));
  }

  /* An overlay name patch would override the department document and silently undo this. */
  const app = await db.collection('appdata').findOne({ _id: 'shared' });
  let ov = null;
  try { ov = app && app.data && app.data['unico_quality_v2'] ? JSON.parse(app.data['unico_quality_v2']) : null; } catch (e) { ov = null; }
  deps.forEach((dep) => {
    const p = ((ov && ov.depts && ov.depts[dep.quality.key] && ov.depts[dep.quality.key].indPatches) || {})[IND_ID];
    if (p && p.name) console.log('  WARNING: overlay patch also sets name="' + p.name + '" for ' + dep.quality.key + ' and will win over this rename');
  });

  const f = await db.collection('qualityFormulas').findOne({ _id: CATALOGUE_ID });
  if (f) {
    const merged = [...new Set((f.aliases || []).concat(RO_ALIASES))].sort();
    const added = merged.filter((a) => (f.aliases || []).indexOf(a) < 0);
    if (added.length && !dry) {
      await db.collection('qualityFormulas').updateOne({ _id: CATALOGUE_ID },
        { $set: { aliases: merged, updatedAt: Date.now(), updatedBy: 'rename-dialysis-water-indicator' } });
    }
    console.log('formula library aliases: ' + merged.length + ' total'
      + (added.length ? ', added ' + added.join(', ') : ', nothing new')
      + (dry ? '  (DRY RUN)' : ''));
  }
  process.exit(0);
})().catch((e) => { console.error('failed:', (e && e.stack) || e); process.exit(1); });
