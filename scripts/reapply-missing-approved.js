/* Find APPROVED data-collection submissions whose values are NO LONGER present in
 * the live collections (quality indicator months / department month columns) and
 * re-apply them from the stored submission values.
 *
 * Root case this repairs: submissions approved around Aug 4-6 (e.g. Emergency
 * quality Jul-26) whose applied values later vanished from the `quality` docs —
 * the approved submission still holds the data, the live doc lost it.
 *
 *     node scripts/reapply-missing-approved.js            dry run — list what's missing
 *     node scripts/reapply-missing-approved.js --apply    re-apply the missing ones
 *
 * Re-apply mechanism: the submission is flipped back to "pending" and pushed
 * through the server's own approveSubmission() (same applyQuality/applyPatient
 * as the Approve button), which marks it approved again. Reads server/.env.
 */
const path = require('path');
require(path.join(__dirname, '..', 'server', 'node_modules', 'dotenv')).config({ path: path.join(__dirname, '..', 'server', '.env') });
const dc = require(path.join(__dirname, '..', 'server', 'data-collection'));
const { MongoClient } = require(path.join(__dirname, '..', 'server', 'node_modules', 'mongodb'));

const APPLY = process.argv.includes('--apply');

(async () => {
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const h = client.db(process.env.DB_NAME || 'unico');
  const approved = await h.collection('submissions').find({ status: 'approved' }).sort({ submittedAt: 1 }).toArray();
  const departments = await h.collection('departments').find({}).toArray();

  // Live quality data lives EMBEDDED at departments.quality (matched by quality.key)
  // — the standalone `quality` collection is the stale pre-merge copy. Mirror qArea().
  const qByArea = {};
  for (const d of departments) {
    if (d.quality && d.quality.key) { qByArea[d.quality.key] = d.quality; if (d.quality.name) qByArea[d.quality.name] = d.quality; }
  }
  const dById = {};
  for (const d of departments) dById[d.id] = d;

  const missing = [];
  for (const s of approved) {
    if (s.type === 'quality') {
      const q = qByArea[s.area] || qByArea[s.areaName];
      if (!q) { missing.push([s, 'quality area not found: ' + (s.area || s.areaName)]); continue; }
      const ind = (q.indicators || []).find((i) => i.id === s.indicatorId);
      if (!ind) { missing.push([s, 'indicator gone from live doc']); continue; }
      if (!ind.months || !Object.prototype.hasOwnProperty.call(ind.months, s.month)) {
        missing.push([s, 'month value gone from live doc']);
      }
    } else if (s.type === 'patient') {
      const d = dById[s.department];
      if (!d) { missing.push([s, 'department not found: ' + s.department]); continue; }
      const idx = (d.months || []).indexOf(s.month);
      if (idx < 0) { missing.push([s, 'month column gone from live doc']); continue; }
      const row = (d.data || {})[String(idx)];
      if (!row || typeof row !== 'object' || Object.keys(row).length === 0) missing.push([s, 'month row empty in live doc']);
    }
  }

  console.log('approved submissions checked: ' + approved.length);
  console.log('values missing from live data: ' + missing.length + '\n');
  for (const [s, why] of missing) {
    console.log('  ' + [
      new Date(s.submittedAt || 0).toISOString().slice(0, 10),
      s.type,
      (s.departmentName || s.areaName || s.department || s.area || '?'),
      s.month,
      s.indicatorName ? s.indicatorName.slice(0, 45) : '',
    ].filter(Boolean).join(' | ') + '   [' + why + ']');
  }

  if (!APPLY) {
    console.log('\nDry run only. Run again with --apply to re-apply these from the stored submissions.');
    await client.close();
    process.exit(0);
  }

  console.log('\nRe-applying...');
  let ok = 0, fail = 0;
  for (const [s, why] of missing) {
    try {
      await h.collection('submissions').updateOne({ _id: s._id }, { $set: { status: 'pending' } });
      await dc.approveSubmission(String(s._id), (s.reviewedBy || 'admin') + ' (re-applied after data loss)');
      ok++;
      console.log('  RE-APPLIED ' + (s.departmentName || s.areaName || '?') + ' ' + s.month + ' ' + (s.indicatorName || ''));
    } catch (e) {
      fail++;
      // put the status back so a failed re-apply never leaves it falsely pending
      await h.collection('submissions').updateOne({ _id: s._id }, { $set: { status: 'approved' } }).catch(() => {});
      console.log('  FAILED ' + (s.indicatorName || s.department || '') + ' -> ' + String((e && e.message) || e));
    }
  }
  console.log('\nDone: re-applied=' + ok + '  failed=' + fail);
  await client.close();
  process.exit(0);
})().catch((e) => { console.error('ERROR: ' + String((e && e.message) || e)); process.exit(1); });
