/* Make hand-hygiene compliance ONE indicator, with ONE id, in every department.
 *
 * Before this script Hand Hygiene existed under 15 different ids. Only Overall
 * Hospital and Radiology carried the canonical `ind-hand-hygiene-compliance` on the
 * department document; the other 14 departments each had their own overlay-added
 * twin with a random 4-char suffix (-3iqv, -kqzf, -pq6o, ...), so the indicator drifted
 * per department and none of them could ever share a definition or a benchmark.
 *
 * After: every department that reports hand hygiene carries exactly one indicator
 *     id   = ind-hand-hygiene-compliance
 * on the DEPARTMENT document (departments.quality.indicators), with definition fields
 * taken from the qualityFormulas master row (hand-hygiene-compliance-overall), so the
 * formula and the benchmark read alike everywhere. The added twins said "> 90%"; the
 * master row says ">= 80%" and wins — change it once in the Formula Library if the
 * hospital wants 90%.
 *
 * DATA IS MERGED, NEVER DROPPED. Overlay indPatches apply to overlay-ADDED indicators
 * as well as to base ones (Home Care's whole Jul-26 reading lives in a patch on an
 * added indicator, Radiology's Jun-26 reading in a patch on a base one), so every copy
 * is flattened patch-over-base before merging. The copy with more recorded data wins a
 * month present in two copies; the dry run prints the merge so it can be reviewed.
 *
 * The overlay entries are then removed, because the department document becomes the
 * single source for this indicator — leaving them behind is what lets a drifted copy
 * keep masking the corrected one.
 *
 * ASSIGNMENTS ARE KEPT: users/responsibles qualityIndicators and quality submissions
 * are repointed onto the canonical id.
 *
 * Backs up every modified doc to scripts/backups/ before writing.
 * Usage: node scripts/unify-hand-hygiene.js           (dry run — prints the plan)
 *        node scripts/unify-hand-hygiene.js --apply   (writes the changes)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const fs = require('fs');
const { getDbHandle } = require('../server/db');

const CANON_ID = 'ind-hand-hygiene-compliance';
const CANON_NAME = 'Hand Hygiene Compliance';
const HOSPITAL_NAME = 'Hand Hygiene Compliance (Hospital)'; // Overall Hospital keeps its distinct title
const MASTER_ID = 'hand-hygiene-compliance-overall';

const isHHName = (n) => /hand\s*-?\s*hygiene/i.test(String(n || ''));
const isHHId = (id) => /hand-hygiene/i.test(String(id || ''));
const isHH = (ind) => !!ind && (isHHName(ind.name) || isHHId(ind.id));

/* Month/quarter-keyed value fields that must survive the merge (quality-store's NESTED). */
const NESTED = ['months', 'monthRemarks', 'mNum', 'mDen', 'quarters', 'quarterRemarks', 'qNum', 'qDen', 'incidents', 'mGroups', 'capa'];
/* Definition fields taken from the formula master so every department reads alike. */
const DEF_FIELDS = ['formula', 'unit', 'numLabel', 'denLabel', 'numeratorDef', 'denominatorDef',
  'benchmark', 'benchmarkValue', 'benchmarkNote', 'goalDirection', 'reference', 'referenceUrl',
  'denAdminOnly', 'victimField'];

const nonEmpty = (v) => v != null && v !== '' && !(Array.isArray(v) && !v.length);

/* Flatten a copy: its own nested maps with the overlay patch laid over the top. */
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
const loadOf = (maps) => NESTED
  .map((f) => { const n = Object.keys(maps[f] || {}).filter((k) => nonEmpty(maps[f][k])).length; return n ? f + '=' + n : null; })
  .filter(Boolean).join(' ') || 'no data';

(async () => {
  const apply = process.argv.includes('--apply');
  const db = await getDbHandle();
  if (!db) { console.error('No DB (MONGODB_URI not set).'); process.exit(1); }

  const depCol = db.collection('departments');
  const appCol = db.collection('appdata');
  const RAW = 'unico_quality_v2';

  const backup = { when: new Date().toISOString(), departments: [], appdata: null, users: [], responsibles: [], submissions: [] };
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
  const shared = await appCol.findOne({ _id: 'shared' });
  let overlay = null;
  try { overlay = shared && shared.data && shared.data[RAW] ? JSON.parse(shared.data[RAW]) : null; } catch (e) { overlay = null; }
  const ovDepts = (overlay && overlay.depts) || {};
  let overlayChanged = false;

  /* ---------- departments ---------- */
  const deps = await depCol.find({ 'quality.key': { $exists: true } }).toArray();
  let deptWrites = 0;

  for (const dep of deps) {
    const q = dep.quality;
    const ovKey = ovDepts[q.key] ? q.key : String(dep._id);
    const ov = ovDepts[ovKey] || null;
    const patches = (ov && ov.indPatches) || {};
    const removed = new Set((ov && ov.indRemoved) || []);

    const cands = [];
    (q.indicators || []).forEach((ind, i) => {
      if (isHH(ind)) cands.push({ src: 'base', idx: i, ind, patch: patches[ind.id], hidden: removed.has(ind.id) });
    });
    ((ov && ov.indAdded) || []).forEach((ind) => {
      if (isHH(ind)) cands.push({ src: 'overlay', idx: 999, ind, patch: patches[ind.id], hidden: removed.has(ind.id) });
    });
    if (!cands.length) { plan.push({ dept: q.name, note: 'no hand-hygiene indicator — left alone (not added silently)' }); continue; }

    cands.forEach((cd) => { cd.view = view(cd.ind, cd.patch); cd.score = score(cd.view); });
    // Highest priority FIRST: visible before hidden, then more data, then the base copy.
    cands.sort((a, b) => (a.hidden - b.hidden) || (b.score - a.score) || ((a.src === 'base' ? 0 : 1) - (b.src === 'base' ? 0 : 1)) || (a.idx - b.idx));

    // Fold lowest priority first so the highest-priority copy overwrites it.
    const merged = {}; const origin = {};
    NESTED.forEach((f) => { merged[f] = {}; });
    cands.slice().reverse().forEach((cd) => {
      NESTED.forEach((f) => Object.keys(cd.view[f]).forEach((mk) => {
        const val = cd.view[f][mk];
        if (!nonEmpty(val)) return;
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
    const name = String(dep._id) === '__hospital__' ? HOSPITAL_NAME : CANON_NAME;
    const canonical = Object.assign({}, keeper.ind, def, merged, { id: CANON_ID, name });
    canonical.valueType = '%'; // hand hygiene is a percentage in the master row
    delete canonical.formulaText; // recomputed downstream from the corrected labels
    NESTED.forEach((f) => { if (!Object.keys(canonical[f]).length) delete canonical[f]; });

    // Department doc: drop every HH copy, put the canonical one where the first base copy was.
    const baseAt = cands.filter((x) => x.src === 'base').map((x) => x.idx).sort((a, b) => a - b)[0];
    const kept = (q.indicators || []).filter((ind) => !isHH(ind));
    const at = baseAt == null ? kept.length : Math.min(baseAt, kept.length);
    const newInds = kept.slice(0, at).concat([canonical], kept.slice(at));

    const benchChanges = cands
      .filter((x) => String(x.ind.benchmark || '') !== String(canonical.benchmark || ''))
      .map((x) => x.ind.id + ': "' + x.ind.benchmark + '" -> "' + canonical.benchmark + '"');

    plan.push({
      dept: q.name,
      area: q.key,
      copies: cands.map((x) => x.src + (x.hidden ? '(hidden)' : '') + ' ' + x.ind.id + ' [' + loadOf(x.view) + ']'),
      into: CANON_ID + ' "' + name + '"',
      data: loadOf(merged),
      benchmark: benchChanges.length ? benchChanges : '(unchanged)',
      restored: restored.length ? restored : '(none — nothing on screen changes)',
    });

    if (apply) {
      backup.departments.push({ _id: dep._id, indicators: q.indicators });
      await depCol.updateOne({ _id: dep._id }, { $set: { 'quality.indicators': newInds } });
      deptWrites++;
    }

    // Overlay: the department doc is now the single source for this indicator.
    if (ov) {
      const before = JSON.stringify([ov.indAdded || [], ov.indRemoved || [], Object.keys(ov.indPatches || {}).filter(isHHId)]);
      if (Array.isArray(ov.indAdded)) ov.indAdded = ov.indAdded.filter((x) => !isHH(x));
      if (Array.isArray(ov.indRemoved)) ov.indRemoved = ov.indRemoved.filter((id) => !isHHId(id));
      if (ov.indPatches) Object.keys(ov.indPatches).forEach((id) => { if (isHHId(id)) delete ov.indPatches[id]; });
      const after = JSON.stringify([ov.indAdded || [], ov.indRemoved || [], []]);
      if (before !== after) overlayChanged = true;
    }
  }

  /* ---------- orphan overlay key: depts.undefined (never renders; strip its HH copy) ---------- */
  const orphan = ovDepts['undefined'];
  if (orphan && Array.isArray(orphan.indAdded)) {
    const hit = orphan.indAdded.filter(isHH);
    if (hit.length) {
      orphan.indAdded = orphan.indAdded.filter((x) => !isHH(x));
      overlayChanged = true;
      plan.push({ dept: '(orphan overlay key "undefined")', removed: hit.map((x) => x.id), note: 'inert key — never rendered' });
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
        const mapped = [...new Set(list.map((id) => (isHHId(id) ? CANON_ID : id)))];
        list.forEach((id) => { if (isHHId(id) && id !== CANON_ID) detail.push(area + ': ' + id + ' -> ' + CANON_ID); });
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
  const stale = subs.filter((s) => (isHHId(s.indicatorId) || isHHName(s.indicatorName)) && s.indicatorId !== CANON_ID);
  if (stale.length) {
    const byShape = {};
    stale.forEach((s) => { const k = s.status + ' | ' + s.area + ' | ' + s.indicatorId; byShape[k] = (byShape[k] || 0) + 1; });
    plan.push({ dept: '(submissions)', repointed: byShape });
    if (apply) {
      stale.forEach((s) => backup.submissions.push(s));
      await scol.updateMany({ _id: { $in: stale.map((s) => s._id) } }, { $set: { indicatorId: CANON_ID } });
    }
  }

  /* ---------- persist ---------- */
  if (apply && overlayChanged) {
    backup.appdata = shared;
    await appCol.updateOne({ _id: 'shared' }, { $set: { ['data.' + RAW]: JSON.stringify(overlay), updatedAt: Date.now() } });
  }
  if (apply) {
    const dir = path.join(__dirname, 'backups');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'hh-unify-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
    fs.writeFileSync(file, JSON.stringify(backup, null, 2));
    console.log('backup ->', file);
  }

  console.log(JSON.stringify({
    mode: apply ? 'APPLIED' : 'DRY RUN',
    canonical: { id: CANON_ID, name: CANON_NAME, hospital: HOSPITAL_NAME, master: MASTER_ID },
    departmentsTouched: plan.filter((p) => p.copies).length, deptDocsRewritten: deptWrites, overlayChanged, plan,
  }, null, 2));
  process.exit(0);
})().catch((e) => { console.error('failed:', e.message || e); process.exit(1); });
