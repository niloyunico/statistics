/* Make needle-stick injury ONE indicator, with ONE name, in every department.
 *
 * Before this script the same indicator existed under 3 display names
 * ("Needle Stick Injury (NSI)", "Needle Stick / Sharps Injury", "Needle Stick
 * Injury") and 4 id shapes (ind-needle-stick-injury, ind-needle-stick,
 * ind-needle-stick-sharps-injury-XXXX, ind-needle-stick-injury-nsi-XXXX), split
 * between the `quality` collection and the appdata overlay. Cath Lab and General
 * OT had gone further: their seed copy was overlay-REMOVED and replaced by an
 * overlay-added copy under the other name, so their older NSI history was hidden.
 *
 * After: every department carries exactly one indicator
 *     id   = ind-needle-stick-injury
 *     name = Needle Stick Injury (NSI)
 * with the definition fields taken from the qualityFormulas master row
 * (needle-stick-sharps-injury-rate), so the formula/benchmark is identical too.
 *
 * DATA IS MERGED, NEVER DROPPED. Every month / incident from every copy is folded
 * into the single indicator. On a month present in more than one copy, the copy
 * that is VISIBLE today wins over a hidden (overlay-removed) one, and among those
 * the copy with more recorded data wins — so nothing on screen today changes
 * value. Months that only a HIDDEN copy carried become visible again; the dry run
 * lists these per department under "restored" so they can be reviewed first.
 *
 * ASSIGNMENTS ARE KEPT. users.qualityIndicators and responsibles.qualityIndicators
 * are remapped onto the canonical id (this also clears the dead ids left behind by
 * the earlier dedupe, e.g. ind-needle-stick-injury-9036), so every responsible
 * person keeps the departments they were assigned.
 *
 * Also cleaned: quality submissions (indicatorId + indicatorName) so approving an
 * old pending submission cannot re-create a differently-named copy, and the NSI
 * entry in the orphan `depts.undefined` overlay key.
 *
 * Backs up every modified doc to scripts/backups/ before writing.
 * Usage: node scripts/unify-needle-stick.js           (dry run — prints the plan)
 *        node scripts/unify-needle-stick.js --apply   (writes the changes)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });
try { require('dns').setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']); } catch (e) {}
const fs = require('fs');
const path = require('path');
const { MongoClient } = require(path.join(__dirname, '..', 'server', 'node_modules', 'mongodb'));

const CANON_ID = 'ind-needle-stick-injury';
const CANON_NAME = 'Needle Stick Injury (NSI)';
const MASTER_ID = 'needle-stick-sharps-injury-rate';

/* Every live id contains "needle"; keep the id test to that so nothing unrelated
 * (e.g. ind-intradialytic-hypotension) is ever swept in. */
const isNSIName = (n) => /needle\s*stick|needlestick|sharps\s*injur|\bnsi\b/i.test(String(n || ''));
const isNSIId = (id) => /needle/i.test(String(id || ''));
const isNSI = (ind) => !!ind && (isNSIName(ind.name) || isNSIId(ind.id));

/* Month/quarter-keyed value fields that must survive the merge (quality-store's NESTED). */
const NESTED = ['quarters', 'quarterRemarks', 'months', 'monthRemarks', 'qNum', 'qDen', 'mNum', 'mDen', 'incidents', 'capa', 'mGroups'];
/* Definition fields taken from the formula master so all departments read alike. */
const DEF_FIELDS = ['formula', 'unit', 'numLabel', 'denLabel', 'numeratorDef', 'denominatorDef',
  'benchmark', 'benchmarkValue', 'benchmarkNote', 'goalDirection', 'reference', 'referenceUrl',
  'denAdminOnly', 'victimField'];

const nonEmpty = (v) => v != null && v !== '';
const view = (ind, patch) => {
  const out = {};
  NESTED.forEach((f) => { out[f] = Object.assign({}, (ind && ind[f]) || {}, (patch && patch[f]) || {}); });
  return out;
};
const score = (v) => {
  let s = 0;
  ['months', 'mNum'].forEach((f) => Object.keys(v[f]).forEach((k) => { if (nonEmpty(v[f][k])) s += 2; }));
  Object.keys(v.mDen).forEach((k) => { if (nonEmpty(v.mDen[k])) s += 1; });
  Object.keys(v.incidents).forEach((k) => { if (Array.isArray(v.incidents[k])) s += v.incidents[k].length * 5; });
  return s;
};

(async () => {
  const apply = process.argv.includes('--apply');
  const c = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await c.connect();
  const db = c.db(process.env.DB_NAME || 'unico');
  const backup = { when: new Date().toISOString(), quality: [], appdata: null, users: [], responsibles: [], submissions: [] };
  const plan = [];

  /* ---------- definition fields from the qualityFormulas master ---------- */
  let master = await db.collection('qualityFormulas').findOne({ _id: MASTER_ID });
  if (!master) {
    const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'server', 'seed', 'quality-formulas.json'), 'utf8'));
    master = seed.find((f) => f._id === MASTER_ID) || {};
    console.log('  (qualityFormulas row absent — using the seed file for definition fields)');
  }
  const def = {};
  DEF_FIELDS.forEach((k) => { if (nonEmpty(master[k])) def[k] = master[k]; });

  /* ---------- overlay ---------- */
  const appdata = db.collection('appdata');
  const shared = await appdata.findOne({ _id: 'shared' });
  let overlay = null;
  try { overlay = shared && shared.data && shared.data['unico_quality_v2'] ? JSON.parse(shared.data['unico_quality_v2']) : null; } catch (e) { overlay = null; }
  const ovDepts = (overlay && overlay.depts) || {};
  let overlayChanged = false;

  /* ---------- quality collection ---------- */
  const qcol = db.collection('quality');
  const docs = await qcol.find({}).toArray();
  let qualityWrites = 0;

  for (const doc of docs) {
    const key = doc.key || String(doc._id);
    const ovKey = ovDepts[doc.key] ? doc.key : String(doc._id);
    const ov = ovDepts[ovKey] || null;
    const patches = (ov && ov.indPatches) || {};
    const removed = new Set((ov && ov.indRemoved) || []);

    const cands = [];
    (doc.indicators || []).forEach((ind, i) => {
      if (isNSI(ind)) cands.push({ src: 'base', idx: i, ind, patch: patches[ind.id], hidden: removed.has(ind.id) });
    });
    ((ov && ov.indAdded) || []).forEach((ind) => {
      if (isNSI(ind)) cands.push({ src: 'overlay', idx: 999, ind, patch: patches[ind.id], hidden: removed.has(ind.id) });
    });
    if (!cands.length) continue;

    cands.forEach((cd) => { cd.view = view(cd.ind, cd.patch); cd.score = score(cd.view); });
    // Highest priority FIRST: visible before hidden, then more data, then the base copy.
    cands.sort((a, b) => (a.hidden - b.hidden) || (b.score - a.score) || ((a.src === 'base' ? 0 : 1) - (b.src === 'base' ? 0 : 1)) || (a.idx - b.idx));

    // Fold lowest priority first so the highest-priority copy overwrites it.
    const merged = {}; const origin = {};
    NESTED.forEach((f) => { merged[f] = {}; });
    cands.slice().reverse().forEach((cd) => {
      NESTED.forEach((f) => Object.keys(cd.view[f]).forEach((mk) => {
        const val = cd.view[f][mk];
        if (!nonEmpty(val) && !(Array.isArray(val) && val.length)) return;
        merged[f][mk] = val;
        origin[f + '/' + mk] = cd;
      }));
    });
    // Months only a HIDDEN copy carried — these become visible again.
    const restored = [];
    ['months', 'mNum', 'incidents'].forEach((f) => Object.keys(merged[f]).forEach((mk) => {
      const src = origin[f + '/' + mk];
      if (src && src.hidden) restored.push(f + ' ' + mk + '=' + JSON.stringify(merged[f][mk]).slice(0, 40));
    }));

    const keeper = cands[0];
    const canonical = Object.assign({}, keeper.ind, def, merged, { id: CANON_ID, name: CANON_NAME });
    canonical.valueType = def.formula === 'pct' ? '%' : (def.formula === 'count' ? 'Count' : 'Rate');
    delete canonical.formulaText; // recomputed downstream from the corrected labels
    NESTED.forEach((f) => { if (!Object.keys(canonical[f]).length) delete canonical[f]; });

    // Base doc: drop every NSI copy, put the canonical one where the first base copy was.
    const baseAt = cands.filter((x) => x.src === 'base').map((x) => x.idx).sort((a, b) => a - b)[0];
    const kept = (doc.indicators || []).filter((ind) => !isNSI(ind));
    const at = baseAt == null ? kept.length : Math.min(baseAt, kept.length);
    const newInds = kept.slice(0, at).concat([canonical], kept.slice(at));

    plan.push({
      dept: doc.name || key, area: String(doc._id),
      copies: cands.map((x) => x.src + (x.hidden ? '(hidden)' : '') + ' ' + x.ind.id + ' "' + x.ind.name + '" score=' + x.score),
      into: CANON_ID + ' "' + CANON_NAME + '"',
      months: Object.keys(merged.months || {}).length + ' months, ' + Object.keys(merged.mNum || {}).length + ' mNum, '
        + Object.values(merged.incidents || {}).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0) + ' incidents',
      restored: restored.length ? restored : '(none — nothing on screen changes)',
    });

    if (apply) {
      backup.quality.push(doc);
      await qcol.updateOne({ _id: doc._id }, { $set: { indicators: newInds } });
      qualityWrites++;
    }

    // Overlay: the base doc is now the single source for this indicator.
    if (ov) {
      const before = JSON.stringify([ov.indAdded || [], ov.indRemoved || [], Object.keys(ov.indPatches || {}).filter(isNSIId)]);
      if (Array.isArray(ov.indAdded)) ov.indAdded = ov.indAdded.filter((x) => !isNSI(x));
      if (Array.isArray(ov.indRemoved)) ov.indRemoved = ov.indRemoved.filter((id) => !isNSIId(id));
      if (ov.indPatches) Object.keys(ov.indPatches).forEach((id) => { if (isNSIId(id)) delete ov.indPatches[id]; });
      const after = JSON.stringify([ov.indAdded || [], ov.indRemoved || [], []]);
      if (before !== after) overlayChanged = true;
    }
  }

  /* ---------- orphan overlay key: depts.undefined (never renders; strip its NSI copy) ---------- */
  const orphan = ovDepts['undefined'];
  if (orphan && Array.isArray(orphan.indAdded)) {
    const hit = orphan.indAdded.filter(isNSI);
    if (hit.length) {
      orphan.indAdded = orphan.indAdded.filter((x) => !isNSI(x));
      overlayChanged = true;
      plan.push({ dept: '(orphan overlay key "undefined")', removed: hit.map((x) => x.id + ' "' + x.name + '"'),
        note: 'inert key — depts are built from the department list, so it never rendered. ' + orphan.indAdded.length + ' non-NSI entries left in place.' });
    }
  }

  /* ---------- assignments: keep every responsible person, point them at the canonical id ---------- */
  for (const colName of ['users', 'responsibles']) {
    const col = db.collection(colName);
    const rows = await col.find({ qualityIndicators: { $exists: true } }).toArray();
    for (const r of rows) {
      const qi = r.qualityIndicators;
      if (!qi || typeof qi !== 'object' || Array.isArray(qi)) continue;
      let changed = false; const out = {}; const detail = [];
      Object.keys(qi).forEach((area) => {
        const list = Array.isArray(qi[area]) ? qi[area] : [];
        const mapped = [...new Set(list.map((id) => (isNSIId(id) ? CANON_ID : id)))];
        list.forEach((id) => { if (isNSIId(id) && id !== CANON_ID) detail.push(area + ': ' + id + ' → ' + CANON_ID); });
        if (mapped.length !== list.length || mapped.some((v, i) => v !== list[i])) changed = true;
        out[area] = mapped;
      });
      if (!changed) continue;
      plan.push({ dept: '(' + colName + ') ' + (r.name || r.username || String(r._id)), remap: detail });
      if (apply) { backup[colName].push(r); await col.updateOne({ _id: r._id }, { $set: { qualityIndicators: out } }); }
    }
  }

  /* ---------- submissions: an old one must not re-create a differently named copy ---------- */
  const scol = db.collection('submissions');
  const subs = await scol.find({ type: 'quality' }).toArray();
  const stale = subs.filter((s) => (isNSIId(s.indicatorId) || isNSIName(s.indicatorName))
    && (s.indicatorId !== CANON_ID || s.indicatorName !== CANON_NAME));
  if (stale.length) {
    const byShape = {};
    stale.forEach((s) => { const k = s.status + ' | ' + s.area + ' | ' + s.indicatorId + ' | ' + s.indicatorName; byShape[k] = (byShape[k] || 0) + 1; });
    plan.push({ dept: '(submissions)', repointed: byShape });
    if (apply) {
      stale.forEach((s) => backup.submissions.push(s));
      await scol.updateMany({ _id: { $in: stale.map((s) => s._id) } },
        { $set: { indicatorId: CANON_ID, indicatorName: CANON_NAME } });
    }
  }

  /* ---------- persist ---------- */
  if (apply && overlayChanged) {
    backup.appdata = shared;
    await appdata.updateOne({ _id: 'shared' }, { $set: { 'data.unico_quality_v2': JSON.stringify(overlay), updatedAt: Date.now() } });
  }
  if (apply) {
    const dir = path.join(__dirname, 'backups');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'nsi-unify-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
    fs.writeFileSync(file, JSON.stringify(backup, null, 2));
    console.log('backup ->', file);
  }

  console.log(JSON.stringify({
    mode: apply ? 'APPLIED' : 'DRY RUN', canonical: { id: CANON_ID, name: CANON_NAME },
    departments: plan.filter((p) => p.copies).length, qualityDocsRewritten: qualityWrites, overlayChanged, plan,
  }, null, 2));
  await c.close();
})().catch((e) => { console.error('failed:', e.message); process.exit(1); });
