/* Collapse duplicated / fragmented quality indicators onto one id per indicator.
 *
 * Two things happen, in one pass, per department:
 *
 *  1. ALIAS RE-KEY. Ids that drifted a random suffix are mapped back onto the
 *     canonical id via the explicit ALIASES table below. The table is deliberately
 *     explicit rather than name-derived: "In Patient Fall" and "Out Patient Fall"
 *     normalise too closely for automatic name matching to be safe.
 *
 *  2. MERGE. Once re-keyed, two copies of the same indicator can land on the same id
 *     inside one department (this is the real duplication: Endoscopy's Out Patient
 *     Fall x2, General OT's Cautery Burn x2 and OT Utilization x2, Cath Lab's two
 *     needle-stick copies). Every month/quarter map is merged; the copy carrying more
 *     data wins the indicator's definition fields and its name.
 *
 * DATA IS MERGED, NEVER DROPPED, and a month present in two copies with DIFFERENT
 * values is never guessed at: the conflict is printed and that department is skipped
 * whole, for a human to settle.
 *
 * Overlay indPatches are folded in before merging (they hold real readings, including
 * on overlay-ADDED indicators), then the overlay entries for the merged-away ids are
 * removed so the department document is the single source.
 *
 * NOT TOUCHED ON PURPOSE: OPD's "Out Patient Fall", which stores 12 months of data
 * under the id `ind-patient-fall` — an id whose canonical meaning is *In* Patient
 * Fall. Re-keying it would risk the data-loss trap, so it is only reported.
 *
 * Usage: node scripts/dedupe-quality-duplicates.js           (dry run — prints the plan)
 *        node scripts/dedupe-quality-duplicates.js --apply   (writes the changes)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const fs = require('fs');
const { getDbHandle } = require('../server/db');

/* Explicit id families. Each entry: [test, canonical id]. First match wins. */
const ALIASES = [
  [/^ind-out-patient-fall-/, 'ind-out-patient-fall'],
  [/^ind-incidence-of-cautery-burn/, 'ind-cautery-burn'],
  [/^ind-ot-utilization-rate-/, 'ind-ot-utilization-rate'],
  [/^ind-patient-fall-rate-/, 'ind-patient-fall'],
  [/^ind-needle-stick-sharps-injury-/, 'ind-needle-stick-injury'],
];
const canonIdOf = (id) => { const hit = ALIASES.find(([re]) => re.test(String(id || ''))); return hit ? hit[1] : String(id || ''); };

/* Reported, never rewritten — see header. */
const LEAVE_ALONE = [{ area: 'OPD', id: 'ind-patient-fall', why: '12 months of Out-Patient-Fall data stored under the In-Patient-Fall id' }];

const NESTED = ['months', 'monthRemarks', 'mNum', 'mDen', 'quarters', 'quarterRemarks', 'qNum', 'qDen', 'incidents', 'mGroups', 'capa'];
/* Only these carry readings; a difference here is a real conflict. Remarks/CAPA are free text. */
const VALUE_FIELDS = ['months', 'mNum', 'mDen', 'quarters', 'qNum', 'qDen'];

const nonEmpty = (v) => v != null && v !== '' && !(Array.isArray(v) && !v.length);
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

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
  const plan = []; const conflicts = []; const notes = [];
  const idRemap = new Map(); // old id -> canonical id, for the assignment sweep

  const shared = await appCol.findOne({ _id: 'shared' });
  let overlay = null;
  try { overlay = shared && shared.data && shared.data[RAW] ? JSON.parse(shared.data[RAW]) : null; } catch (e) { overlay = null; }
  const ovDepts = (overlay && overlay.depts) || {};
  let overlayChanged = false;

  const deps = await depCol.find({ 'quality.key': { $exists: true } }).toArray();
  let deptWrites = 0;

  for (const dep of deps) {
    const q = dep.quality;
    const ovKey = ovDepts[q.key] ? q.key : String(dep._id);
    const ov = ovDepts[ovKey] || null;
    const patches = (ov && ov.indPatches) || {};
    const removed = new Set((ov && ov.indRemoved) || []);

    LEAVE_ALONE.filter((x) => x.area === q.key && (q.indicators || []).some((i) => i.id === x.id))
      .forEach((x) => notes.push({ dept: q.name, id: x.id, action: 'LEFT ALONE — ' + x.why }));

    const cands = [];
    (q.indicators || []).forEach((ind, i) => {
      if (removed.has(ind.id)) return; // overlay-removed: not part of the effective list
      cands.push({ src: 'base', idx: i, ind, patch: patches[ind.id], canon: canonIdOf(ind.id) });
    });
    ((ov && ov.indAdded) || []).forEach((ind) => {
      if (removed.has(ind.id)) return;
      cands.push({ src: 'overlay', idx: 999, ind, patch: patches[ind.id], canon: canonIdOf(ind.id) });
    });
    cands.forEach((cd) => { cd.view = view(cd.ind, cd.patch); cd.score = score(cd.view); });

    // Group by the canonical id. A group of 2+ is a duplicate to merge.
    const groups = new Map();
    cands.forEach((cd) => { if (!groups.has(cd.canon)) groups.set(cd.canon, []); groups.get(cd.canon).push(cd); });

    const work = [...groups.entries()].filter(([canon, g]) => g.length > 1 || g[0].ind.id !== canon);
    if (!work.length) {
      // still surface any same-name pairs the alias table does not cover
      const byName = new Map();
      cands.forEach((cd) => { const k = norm(cd.ind.name); byName.set(k, (byName.get(k) || 0) + 1); });
      [...byName].filter(([, n]) => n > 1).forEach(([k]) => notes.push({ dept: q.name, action: 'UNHANDLED duplicate name "' + k + '" — no alias rule covers it' }));
      continue;
    }

    /* ---- conflict scan before touching anything ----
     * Scoped to the indicator, not the department: one irreconcilable indicator must
     * not block the clean merges next to it. A blocked group is left exactly as it is. */
    const blocked = new Set();
    for (const [canon, g] of work) {
      if (g.length < 2) continue;
      for (const f of VALUE_FIELDS) {
        const seen = {};
        g.forEach((cd) => Object.keys(cd.view[f]).forEach((mk) => {
          const val = cd.view[f][mk]; if (!nonEmpty(val)) return;
          if (seen[mk] !== undefined && String(seen[mk].v) !== String(val)) {
            blocked.add(canon);
            conflicts.push({ dept: q.name, indicator: canon, field: f, month: mk,
              a: seen[mk].id + '=' + seen[mk].v, b: cd.ind.id + '=' + val });
          } else if (seen[mk] === undefined) seen[mk] = { v: val, id: cd.ind.id };
        }));
      }
    }
    blocked.forEach((canon) => plan.push({ dept: q.name, action: 'SKIPPED indicator ' + canon + ' — conflicting values, see conflicts[]' }));

    // ---- merge ----
    const newInds = []; const done = new Set(); const deptPlan = [];
    (q.indicators || []).forEach((ind) => {
      if (removed.has(ind.id)) { newInds.push(ind); return; } // untouched hidden copy stays put
      const canon = canonIdOf(ind.id);
      if (blocked.has(canon)) { newInds.push(ind); return; }  // conflicting group: left exactly as found
      if (done.has(canon)) return; // already emitted by an earlier member of this group
      const g = groups.get(canon) || [];
      done.add(canon);
      newInds.push(buildMerged(canon, g, deptPlan));
    });
    // overlay-added indicators whose group had no base member
    ((ov && ov.indAdded) || []).forEach((ind) => {
      if (removed.has(ind.id)) return;
      const canon = canonIdOf(ind.id);
      if (blocked.has(canon) || done.has(canon)) return;
      done.add(canon);
      newInds.push(buildMerged(canon, groups.get(canon) || [], deptPlan));
    });

    function buildMerged(canon, g, out) {
      const sorted = g.slice().sort((a, b) => (b.score - a.score) || ((a.src === 'base' ? 0 : 1) - (b.src === 'base' ? 0 : 1)) || (a.idx - b.idx));
      const merged = {}; NESTED.forEach((f) => { merged[f] = {}; });
      sorted.slice().reverse().forEach((cd) => {
        NESTED.forEach((f) => Object.keys(cd.view[f]).forEach((mk) => {
          const val = cd.view[f][mk]; if (!nonEmpty(val)) return; merged[f][mk] = val;
        }));
      });
      const keeper = sorted[0];
      const res = Object.assign({}, keeper.ind, merged, { id: canon, name: keeper.ind.name });
      NESTED.forEach((f) => { if (!Object.keys(res[f]).length) delete res[f]; });
      if (g.length > 1 || keeper.ind.id !== canon) {
        g.forEach((cd) => { if (cd.ind.id !== canon) idRemap.set(cd.ind.id, canon); });
        out.push({
          into: canon + ' "' + res.name + '"',
          from: g.map((cd) => cd.src + ' ' + cd.ind.id + ' [' + loadOf(cd.view) + ']'),
          result: loadOf(merged),
        });
      }
      return res;
    }

    if (deptPlan.length) {
      plan.push({ dept: q.name, area: q.key, before: (q.indicators || []).length + ' base + ' + ((ov && ov.indAdded) || []).length + ' overlay', after: newInds.length + ' on the department doc', merges: deptPlan });
      if (apply) {
        backup.departments.push({ _id: dep._id, indicators: q.indicators });
        await depCol.updateOne({ _id: dep._id }, { $set: { 'quality.indicators': newInds } });
        deptWrites++;
      }
    }

    // Overlay: everything merged now lives on the department doc.
    if (ov) {
      const touched = new Set([...groups.keys()].filter((c) => !blocked.has(c)
        && ((groups.get(c) || []).length > 1 || (groups.get(c) || [])[0].ind.id !== c)));
      const isTouched = (id) => touched.has(canonIdOf(id));
      const before = JSON.stringify([ov.indAdded || [], Object.keys(ov.indPatches || {})]);
      if (Array.isArray(ov.indAdded)) ov.indAdded = ov.indAdded.filter((x) => !isTouched(x.id));
      if (ov.indPatches) Object.keys(ov.indPatches).forEach((id) => { if (isTouched(id)) delete ov.indPatches[id]; });
      if (before !== JSON.stringify([ov.indAdded || [], Object.keys(ov.indPatches || {})])) overlayChanged = true;
    }
  }

  /* ---------- assignments + submissions follow the re-keyed ids ---------- */
  if (idRemap.size) {
    for (const colName of ['users', 'responsibles']) {
      const col = db.collection(colName);
      const rows = await col.find({ qualityIndicators: { $exists: true } }).toArray();
      for (const r of rows) {
        const qi = r.qualityIndicators;
        if (!qi || typeof qi !== 'object' || Array.isArray(qi)) continue;
        let changed = false; const out = {}; const detail = [];
        Object.keys(qi).forEach((area) => {
          const list = Array.isArray(qi[area]) ? qi[area] : [];
          const mapped = [...new Set(list.map((id) => idRemap.get(id) || id))];
          list.forEach((id) => { if (idRemap.has(id)) detail.push(area + ': ' + id + ' -> ' + idRemap.get(id)); });
          if (mapped.length !== list.length || mapped.some((v, i) => v !== list[i])) changed = true;
          out[area] = mapped;
        });
        if (!changed) continue;
        plan.push({ dept: '(' + colName + ') ' + (r.name || r.username || String(r._id)), remap: detail });
        if (apply) { backup[colName].push(r); await col.updateOne({ _id: r._id }, { $set: { qualityIndicators: out } }); }
      }
    }
    const scol = db.collection('submissions');
    const subs = await scol.find({ type: 'quality' }).toArray();
    const stale = subs.filter((s) => idRemap.has(s.indicatorId));
    if (stale.length) {
      const byShape = {};
      stale.forEach((s) => { const k = s.status + ' | ' + s.area + ' | ' + s.indicatorId + ' -> ' + idRemap.get(s.indicatorId); byShape[k] = (byShape[k] || 0) + 1; });
      plan.push({ dept: '(submissions)', repointed: byShape });
      if (apply) {
        for (const s of stale) { backup.submissions.push(s); await scol.updateOne({ _id: s._id }, { $set: { indicatorId: idRemap.get(s.indicatorId) } }); }
      }
    }
  }

  if (apply && overlayChanged) {
    backup.appdata = shared;
    await appCol.updateOne({ _id: 'shared' }, { $set: { ['data.' + RAW]: JSON.stringify(overlay), updatedAt: Date.now() } });
  }
  if (apply) {
    const dir = path.join(__dirname, 'backups');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'dedupe-quality-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
    fs.writeFileSync(file, JSON.stringify(backup, null, 2));
    console.log('backup ->', file);
  }

  console.log(JSON.stringify({
    mode: apply ? 'APPLIED' : 'DRY RUN',
    deptDocsRewritten: deptWrites, overlayChanged,
    idsRemapped: Object.fromEntries(idRemap),
    conflicts: conflicts.length ? conflicts : '(none)',
    notes, plan,
  }, null, 2));
  process.exit(0);
})().catch((e) => { console.error('failed:', e.message || e); process.exit(1); });
