/* One-off data fix, 2026-09-23 (user decisions in the Access Control session).

   1. NEEDLE STICK INJURY becomes ONE hospital-wide indicator.
      · NSI (id ind-needle-stick-injury) is added to Overall Hospital (definition only, no
        months) if it is not there already.
      · Every department that carries NSI gets it marked "not measured" in Department
        Setup (departments.collection.notMeasured) — so it is no longer owed per department.
        The department NSI history is NOT touched: every stored month stays.

   2. The "July 2024" entries that are really July 2026 (sent 1 Aug 2026, identical values):
      · each affected indicator month Jul-24 is removed ONLY when it is identical to that
        indicator's Jul-26 value (the duplicate check), from months / mNum / mDen;
      · CCU and MICU get Department Setup start month Sep-25, CT ICU Apr-26 (their first
        real month), unless a start month is already set.

   Dry run by default. `--apply` writes. Either way the affected department documents are
   first saved to scripts/backups/nsi-jul24-<timestamp>.json.

   Run:  node scripts/fix-nsi-hospital-and-jul24.js [--apply]                          */
const path = require('path');
const fs = require('fs');
const SERVER = path.join(__dirname, '..', 'server');
process.chdir(SERVER);
require(path.join(SERVER, 'node_modules', 'dotenv')).config({ path: path.join(SERVER, '.env') });
const db = require(path.join(SERVER, 'db'));

const APPLY = process.argv.includes('--apply');
const NSI = 'ind-needle-stick-injury';
const HOSPITAL_KEY = 'Overall Hospital';
const START = { CCU: 'Sep-25', MICU: 'Sep-25', 'CT ICU': 'Apr-26' };
const BAD = 'Jul-24', GOOD = 'Jul-26';
// Definition fields copied onto the hospital NSI — never a department's recorded months.
const DEF_FIELDS = ['name', 'id', 'valueType', 'unit', 'goalDirection', 'benchmarkValue', 'benchmark', 'reference',
  'formula', 'numeratorDef', 'numLabel', 'denLabel', 'denominatorDef', 'referenceUrl', 'benchmarkNote'];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  const h = await db.getDbHandle();
  if (!h) throw new Error('No database (MONGODB_URI not set).');
  const deps = h.collection('departments');
  const all = await deps.find({ 'quality.key': { $exists: true } }).toArray();
  const hospital = all.find((d) => d.quality && d.quality.key === HOSPITAL_KEY);
  if (!hospital) throw new Error('Overall Hospital department not found.');
  const withNsi = all.filter((d) => d !== hospital && (d.quality.indicators || []).some((i) => i.id === NSI));

  // Backup first, dry run or not.
  const touched = [hospital, ...withNsi, ...all.filter((d) => START[d.quality.key])];
  const uniq = [...new Map(touched.map((d) => [String(d._id), d])).values()];
  const dir = path.join(__dirname, 'backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'nsi-jul24-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
  fs.writeFileSync(file, JSON.stringify(uniq, null, 1));
  console.log('backup:', file, '(' + uniq.length + ' department docs)');

  const ops = [];
  // 1a. NSI onto Overall Hospital.
  if (!(hospital.quality.indicators || []).some((i) => i.id === NSI)) {
    const src = withNsi[0].quality.indicators.find((i) => i.id === NSI);
    const def = {}; DEF_FIELDS.forEach((k) => { if (src[k] !== undefined) def[k] = src[k]; });
    def.months = {};
    ops.push({ what: 'add NSI to Overall Hospital', filter: { _id: hospital._id }, update: { $push: { 'quality.indicators': def } } });
  } else console.log('Overall Hospital already has NSI');
  // 1b. NSI not measured in every department that carries it.
  const now = Date.now();
  withNsi.forEach((d) => {
    if (d.collection && d.collection.notMeasured && d.collection.notMeasured[NSI]) return;
    ops.push({ what: 'NSI not measured: ' + d.quality.key, filter: { _id: d._id }, update: { $set: {
      ['collection.notMeasured.' + NSI]: { reason: 'Reported once for the whole hospital (Overall Hospital).', by: 'Administrator', at: now },
      'collection.updatedAt': now, 'collection.updatedBy': 'Administrator' } } });
  });
  // 2a. Duplicate Jul-24 values (only when identical to Jul-26).
  all.filter((d) => START[d.quality.key]).forEach((d) => {
    (d.quality.indicators || []).forEach((ind, idx) => {
      const m = ind.months || {};
      if (m[BAD] === undefined) return;
      if (!same(m[BAD], m[GOOD])) { console.log('SKIP (not a duplicate):', d.quality.key, ind.id); return; }
      const unset = { ['quality.indicators.' + idx + '.months.' + BAD]: '' };
      if (ind.mNum && ind.mNum[BAD] !== undefined) unset['quality.indicators.' + idx + '.mNum.' + BAD] = '';
      if (ind.mDen && ind.mDen[BAD] !== undefined) unset['quality.indicators.' + idx + '.mDen.' + BAD] = '';
      ops.push({ what: 'remove duplicate ' + BAD + ': ' + d.quality.key + ' / ' + ind.id, filter: { _id: d._id, ['quality.indicators.' + idx + '.id']: ind.id }, update: { $unset: unset } });
    });
    // 2b. Start month.
    if (!(d.collection && d.collection.startMonth)) {
      ops.push({ what: 'start month ' + START[d.quality.key] + ': ' + d.quality.key, filter: { _id: d._id }, update: { $set: {
        'collection.startMonth': START[d.quality.key], 'collection.updatedAt': now, 'collection.updatedBy': 'Administrator' } } });
    }
  });

  ops.forEach((o) => console.log((APPLY ? 'APPLY ' : 'would ') + o.what));
  if (!APPLY) { console.log('\nDry run: ' + ops.length + ' change(s). Re-run with --apply to write.'); process.exit(0); }
  let n = 0;
  for (const o of ops) { const r = await deps.updateOne(o.filter, o.update); if (r.matchedCount) n++; else console.log('NOT MATCHED:', o.what); }
  console.log('\nApplied ' + n + ' of ' + ops.length + ' change(s).');
  process.exit(0);
})().catch((e) => { console.error('failed:', e.message); process.exit(1); });
