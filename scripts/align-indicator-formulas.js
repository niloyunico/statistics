/* Realign department indicator copies to the qualityFormulas master row.
 *
 * The master (qualityFormulas) is the single source of truth for HOW an indicator is
 * measured. Department copies drift from it — Emergency's "Door to Cath Lab" had become
 * formula=rate1000 unit="per 1000" while the master says count/minutes, so its benchmark
 * rendered as the meaningless "≤ 90 per 1000"; General OT's "Incidence of Cautery Burn"
 * had become rate1000 while the master (and CTVS OT) say count.
 *
 * SAFETY: changing `formula` changes how every stored month is COMPUTED. This script
 * therefore recomputes every reported month both ways and only writes when not one
 * displayed value moves. Anything that would change a number is reported and skipped for
 * a human to decide — a silent revaluation of reported quality data is not acceptable.
 *
 * Compute chain transcribed from renderer/unico/quality-console.jsx:124-147 (qiCompute /
 * monthRaw), the same functions the console and the manuals use.
 *
 * Usage: node scripts/align-indicator-formulas.js           (dry run)
 *        node scripts/align-indicator-formulas.js --apply   (writes)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const fs = require('fs');
const { getDbHandle } = require('../server/db');

/* --- compute, verbatim from quality-console.jsx --- */
function qiCompute(f, n, d) {
  if (n == null || n === '') return null; n = Number(n);
  if (f === 'count' || f === 'direct') return n;
  if (d == null || d === '' || Number(d) === 0) return null; d = Number(d);
  if (f === 'rate1000') return Math.round(n / d * 1000 * 100) / 100;
  if (f === 'avg') return Math.round(n / d * 100) / 100;
  return Math.round(n / d * 100 * 100) / 100;
}
function monthRawWith(ind, mk, formula) {
  const f = formula || ((ind && ind.valueType === '%') ? 'pct' : 'direct');
  if (f === 'direct') { const v = ind.months && ind.months[mk]; return (v == null || v === '') ? null : Number(v); }
  const n = ind.mNum && ind.mNum[mk];
  if (n == null || n === '') { const v = ind.months && ind.months[mk]; return (v == null || v === '') ? null : Number(v); }
  const d = (f !== 'count') ? (ind.mDen && ind.mDen[mk]) : null;
  const r = qiCompute(f, n, d);
  if (r != null) return r;
  const v = ind.months && ind.months[mk];
  return (v == null || v === '') ? null : Number(v);
}

/* Fields the master owns. `name` is deliberately NOT included — department display names
   were unified separately and must not be reverted here. */
const OWNED = ['formula', 'unit', 'numLabel', 'denLabel', 'benchmark', 'benchmarkValue', 'goalDirection'];
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const clean = (v) => (v === undefined || v === 'undefined' || v === null) ? '' : v;

(async () => {
  const apply = process.argv.includes('--apply');
  const db = await getDbHandle();
  if (!db) { console.error('No DB (MONGODB_URI not set).'); process.exit(1); }

  const masters = await db.collection('qualityFormulas').find({}).toArray();
  const byName = new Map();
  masters.forEach((m) => [m.canonicalName].concat(m.aliases || []).forEach((n) => { if (n) byName.set(norm(n), m); }));

  const depCol = db.collection('departments');
  const deps = await depCol.find({ 'quality.key': { $exists: true } }).toArray();

  const willFix = [], blocked = [], noMaster = new Set();
  const backup = { when: new Date().toISOString(), departments: [] };
  let writes = 0;

  for (const dep of deps) {
    const inds = dep.quality.indicators || [];
    let changed = false;
    const next = inds.map((ind) => {
      const m = byName.get(norm(ind.name));
      if (!m) { noMaster.add(ind.name); return ind; }

      const diffs = OWNED.filter((f) => String(clean(ind[f])) !== String(clean(m[f])));
      if (!diffs.length) return ind;

      // Would any reported month change value?
      const keys = new Set([].concat(Object.keys(ind.months || {}), Object.keys(ind.mNum || {})));
      const moved = [];
      keys.forEach((mk) => {
        const before = monthRawWith(ind, mk, ind.formula);
        const after = monthRawWith(ind, mk, m.formula);
        if (String(before) !== String(after)) moved.push(mk + ': ' + before + ' -> ' + after);
      });

      const label = dep.quality.name + ' / ' + ind.name;
      const detail = diffs.map((f) => f + ': "' + clean(ind[f]) + '" -> "' + clean(m[f]) + '"');
      if (moved.length) {
        blocked.push({ where: label, master: m._id, changes: detail, valuesWouldMove: moved });
        return ind;
      }

      willFix.push({ where: label, master: m._id, changes: detail, reportedMonths: keys.size });
      changed = true;
      const out = Object.assign({}, ind);
      OWNED.forEach((f) => { if (clean(m[f]) !== '') out[f] = m[f]; else delete out[f]; });
      // keep valueType consistent with the master's formula
      out.valueType = m.formula === 'pct' ? '%' : m.formula === 'count' ? 'Count' : m.unit || 'Rate';
      return out;
    });

    if (!changed) continue;
    if (apply) {
      backup.departments.push({ _id: dep._id, indicators: inds });
      await depCol.updateOne({ _id: dep._id }, { $set: { 'quality.indicators': next } });
    }
    writes++;
  }

  if (apply && writes) {
    const dir = path.join(__dirname, 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'formula-align-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
    fs.writeFileSync(file, JSON.stringify(backup, null, 2));
    console.log('backup ->', file);
  }

  console.log(JSON.stringify({
    mode: apply ? 'APPLIED' : 'DRY RUN',
    departmentDocsWritten: writes,
    aligned: willFix,
    SKIPPED_would_change_reported_values: blocked.length ? blocked : '(none)',
    indicators_with_no_master_row: [...noMaster],
  }, null, 2));
  process.exit(0);
})().catch((e) => { console.error('failed:', (e && e.stack) || e); process.exit(1); });
