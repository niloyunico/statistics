/* Merge DUPLICATE quality indicators created by approve (buildQualitySpec used to mint
 * a new "ind-<slug>-<rand>" id whenever the submitted name didn't match an existing id,
 * so "Patient Fall Rate" duplicated the canonical "Patient Fall", fragmenting the data).
 *
 * For every quality doc: group indicators by NORMALIZED name; a group with one clean-id
 * canonical + random-suffix dup(s) is merged:
 *   - month-keyed data (months/mNum/mDen/incidents/monthRemarks/capa/mGroups/mGroupsDen/
 *     mDeptBreakdown) copied onto the canonical — the dup's months WIN (they're the newer
 *     approved submissions; the canonical's same-month value predates them).
 *   - false-0 guard: a rate dup month with events (mNum>0) but no denominator stores the
 *     EVENT COUNT when the canonical is count/direct, else null — never a fake 0 rate.
 *   - def upgrade: dup carrying real rate data (positive mDen) upgrades a direct canonical
 *     to its formula/labels/unit/benchmark.
 *   - dup removed from the doc; submissions pointing at the dup id are repointed to the
 *     canonical (count-style submissions also flipped from rate to count semantics).
 * Ambiguous groups (no clean id / several clean ids) are only REPORTED.
 *
 * Usage: node scripts/merge-duplicate-indicators.js [--check]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });
try { require('dns').setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']); } catch (e) {}
const fs = require('fs');
const path = require('path');
const { MongoClient } = require(path.join(__dirname, '..', 'server', 'node_modules', 'mongodb'));

const norm = (s) => String(s || '').toLowerCase()
  .replace(/\([^)]*\)/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\b(rate|rates|ratio)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();
const isRandomId = (id) => /-\d{4}$/.test(String(id || ''));
const MAPS = ['months', 'mNum', 'mDen', 'incidents', 'monthRemarks', 'capa', 'mGroups', 'mGroupsDen', 'mDeptBreakdown'];

(async () => {
  const check = process.argv.includes('--check');
  const c = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 12000 });
  await c.connect();
  const db = c.db(process.env.DB_NAME || 'unico');
  const qcol = db.collection('quality');
  const scol = db.collection('submissions');
  const docs = await qcol.find({}).toArray();
  const backup = [];

  for (const doc of docs) {
    const inds = Array.isArray(doc.indicators) ? doc.indicators : [];
    const orig = JSON.parse(JSON.stringify(inds)); // pre-merge snapshot for the backup
    const groups = {};
    inds.forEach((i) => { const k = norm(i.name); (groups[k] = groups[k] || []).push(i); });
    let changed = false;
    for (const k of Object.keys(groups)) {
      const g = groups[k];
      if (g.length < 2) continue;
      const clean = g.filter((i) => !isRandomId(i.id));
      const dups = g.filter((i) => isRandomId(i.id));
      if (clean.length !== 1 || !dups.length) {
        console.log(`  ?? ${doc._id}: ambiguous group "${k}" [${g.map((i) => i.id).join(', ')}] — skipped, review manually`);
        continue;
      }
      const canon = clean[0];
      for (const dup of dups) {
        console.log(`  ${doc._id}: merging ${dup.id} ("${dup.name}") -> ${canon.id} ("${canon.name}")`);
        // def upgrade when the dup carries real rate data and the canonical is direct
        const dupHasDen = dup.mDen && Object.values(dup.mDen).some((v) => Number(v) > 0);
        if (dupHasDen && (!canon.formula || canon.formula === 'direct' || canon.formula === 'count')) {
          ['formula', 'numLabel', 'denLabel', 'unit', 'benchmark', 'benchmarkValue', 'goalDirection', 'valueType'].forEach((f) => {
            if (dup[f] != null && dup[f] !== '') canon[f] = dup[f];
          });
        }
        MAPS.forEach((f) => {
          if (dup[f] && typeof dup[f] === 'object' && Object.keys(dup[f]).length) {
            canon[f] = Object.assign({}, canon[f] || {}, dup[f]);
          }
        });
        // false-0 guard per dup month: events without a denominator
        Object.keys(dup.mNum || {}).forEach((m) => {
          const n = Number((dup.mNum || {})[m]) || 0;
          const d = Number((dup.mDen || {})[m]) || 0;
          if (n > 0 && d <= 0) {
            const canonIsCount = !canon.formula || canon.formula === 'direct' || canon.formula === 'count';
            canon.months = Object.assign({}, canon.months || {}, { [m]: canonIsCount ? n : null });
          }
        });
        // repoint submissions at the canonical indicator
        const subs = await scol.find({ type: 'quality', indicatorId: dup.id }).toArray();
        for (const s of subs) {
          const upd = { indicatorId: canon.id, indicatorName: canon.name };
          const canonIsCount = !canon.formula || canon.formula === 'direct' || canon.formula === 'count';
          if (s.entryMode === 'rate' && !(Number(s.den) > 0) && Number(s.num) > 0 && canonIsCount) {
            upd.entryMode = 'count'; upd.formula = 'count'; upd.value = Number(s.num); upd.den = null;
          }
          console.log(`    submission ${s.id}: -> ${canon.id}${upd.entryMode ? ' (rate->count, value ' + upd.value + ')' : ''}`);
          if (!check) await scol.updateOne({ _id: s._id }, { $set: upd });
        }
        changed = true;
      }
      doc.indicators = doc.indicators.filter((i) => !dups.includes(i));
    }
    if (changed) {
      backup.push({ _id: doc._id, indicators: orig });
      if (!check) await qcol.updateOne({ _id: doc._id }, { $set: { indicators: doc.indicators } });
    }
  }

  if (backup.length && !check) {
    const dir = path.join(__dirname, 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `merge-dup-indicators-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify(backup, null, 2));
    console.log('  backup written:', file);
  }
  console.log(check ? '\n[merge] dry run — no writes.' : '\n[merge] applied.');
  await c.close();
})();
