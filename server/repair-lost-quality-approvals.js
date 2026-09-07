/* Re-apply approved quality submissions whose reading never reached the canonical
 * department record.
 *
 * They were lost to the whole-array $set race fixed in data-collection.js
 * (qSetIndicator). This replays each affected submission through the SAME
 * applyQuality path, one at a time, so the repair cannot re-create the race.
 *
 *   node repair-lost-quality-approvals.js          # report only
 *   node repair-lost-quality-approvals.js --apply  # write
 */
require('dotenv').config({ path: __dirname + '/.env' });
const db = require('./db');
const dc = require('./data-collection');

const APPLY = process.argv.includes('--apply');

(async () => {
  const h = await db.getDbHandle(); const dbh = h && h.db ? h.db : h;
  const subs = await dbh.collection('submissions').find({ type: 'quality', status: 'approved' }).toArray();
  const areas = await db.getQuality({ fresh: true });
  const byKey = {}; areas.forEach((d) => { byKey[d.key || d.id] = d; });

  const landed = (s) => {
    const d = byKey[s.area]; if (!d) return null;                 // unknown area -> report
    const ind = (d.indicators || []).find((i) => i.id === s.indicatorId);
    if (!ind) return false;
    return (ind.months && ind.months[s.month] !== undefined)
      || (ind.mNum && ind.mNum[s.month] !== undefined)
      || !!(ind.mNotObserved && ind.mNotObserved[s.month]);
  };

  const missing = subs.filter((s) => landed(s) === false);
  console.log('approved quality submissions: ' + subs.length + ' | missing from canonical: ' + missing.length);
  missing.forEach((s) => console.log('   ' + (s.areaName || s.area) + ' | ' + s.month + ' | ' + s.indicatorId + ' = ' + JSON.stringify(s.value)));
  if (!missing.length) { console.log('nothing to repair.'); return; }
  if (!APPLY) { console.log('\n(dry run — pass --apply to write)'); return; }

  let ok = 0; const failed = [];
  for (const s of missing) {                       // strictly sequential, on purpose
    try { await dc.applyQuality(s); ok++; }
    catch (e) { failed.push((s.areaName || s.area) + '/' + s.indicatorId + ': ' + e.message); }
  }
  console.log('\nre-applied: ' + ok + ' | failed: ' + failed.length);
  failed.forEach((f) => console.log('   ' + f));

  // Verify against a FRESH read, not the copy we started from.
  const after = await db.getQuality({ fresh: true });
  const byKey2 = {}; after.forEach((d) => { byKey2[d.key || d.id] = d; });
  let still = 0;
  missing.forEach((s) => {
    const d = byKey2[s.area]; const ind = d && (d.indicators || []).find((i) => i.id === s.indicatorId);
    const has = ind && ((ind.months && ind.months[s.month] !== undefined) || (ind.mNum && ind.mNum[s.month] !== undefined) || !!(ind.mNotObserved && ind.mNotObserved[s.month]));
    if (!has) { still++; console.log('   STILL MISSING: ' + (s.areaName || s.area) + ' ' + s.month + ' ' + s.indicatorId); }
  });
  console.log('verified: ' + (missing.length - still) + '/' + missing.length + ' now present');
})().then(() => process.exit(0)).catch((e) => { console.error('ERR', e.message); process.exit(1); });
