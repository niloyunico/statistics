/* UNICO — canonical Quality Formula catalogue (ONE row per indicator formula).
 *
 * The single source of truth for every quality indicator's DEFINITION (formula
 * type, units, numerator/denominator labels + definitions, benchmark, goal
 * direction, reference). Historically these lived per-department inside each
 * `quality` doc's indicators[] (155 copies, many divergent) and, in code, as
 * window.QI_CORRECTIONS (renderer/unico/quality-corrections.js). This module
 * moves that master into a Mongo collection so an admin edits ONE row and it
 * applies to every department.
 *
 * Wiring (see web.js): the collection is serialized to window.QI_CORRECTIONS
 * (by indicator name, via buildByNameMap) and injected into the page BEFORE the
 * bundle, so renderer/unico/quality-corrections-apply.js swaps it in over the
 * static fallback. quality-store.js `correctedBase` then fans it out to every
 * department at render time — unchanged. Per-department overlay edits still win
 * (patch precedence in mergeIndicator), so explicit overrides are preserved.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { getDbHandle, dbRead, usingMongo } = require('./db');
const cache = require('./cache');

const COLLECTION = 'qualityFormulas';

// Definition fields governed by the master (mirrors CORRECT_FIELDS in quality-store.js).
// VALUE fields (months/mNum/mDen/quarters/...) are NEVER part of a formula row.
const DEF_FIELDS = ['formula', 'unit', 'numLabel', 'denLabel', 'numeratorDef', 'denominatorDef',
  'benchmark', 'benchmarkValue', 'benchmarkNote', 'goalDirection', 'reference', 'referenceUrl',
  'denAdminOnly', 'victimField'];

// Allowed formula/measure types (union of what the store computes + 'direct').
const FORMULAS = ['direct', 'count', 'pct', 'rate100', 'rate1000', 'avg'];

// Same normalization the renderer uses to key QI_CORRECTIONS by indicator name.
const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const isEmpty = (v) => v === undefined || v === null || v === '';

// ---- Load the static (code) master as the seed source -----------------------
function extractStaticCorrections() {
  try {
    const file = path.join(__dirname, '..', 'renderer', 'unico', 'quality-corrections.js');
    const code = fs.readFileSync(file, 'utf8');
    const sandbox = { window: {}, console: { log() {}, warn() {}, error() {} }, document: {} };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { timeout: 5000 });
    return {
      QI_CORRECTIONS: sandbox.window.QI_CORRECTIONS || {},
      QI_CORRECTIONS_BY_DEFID: sandbox.window.QI_CORRECTIONS_BY_DEFID || {},
    };
  } catch (e) { return { QI_CORRECTIONS: {}, QI_CORRECTIONS_BY_DEFID: {} }; }
}

// Merge non-empty def fields from src into g.def (first non-empty wins).
function mergeDef(g, src) {
  DEF_FIELDS.forEach((f) => { if (isEmpty(g.def[f]) && !isEmpty(src[f])) g.def[f] = src[f]; });
}

// Of several per-department copies of the same indicator, pick the most complete
// one: most non-empty def fields, preferring a real formula/unit over the
// unconfigured "direct/count" default.
function pickBestCopy(copies) {
  let best = copies[0], bestScore = -1;
  copies.forEach((c) => {
    let s = 0;
    DEF_FIELDS.forEach((f) => { if (!isEmpty(c[f])) s++; });
    if (c.formula && c.formula !== 'direct') s += 2;
    if (c.unit && c.unit !== 'count') s += 1;
    if (s > bestScore) { bestScore = s; best = c; }
  });
  return best;
}

// Build the full catalogue (array of formula docs) = static QI_CORRECTIONS
// (grouped by canonicalName -> aliases) UNION every distinct indicator name in
// the `quality` collection not already covered, so coverage is 100%.
async function buildSeed(db) {
  const { QI_CORRECTIONS } = extractStaticCorrections();
  const groups = new Map();       // canonKey -> { canonicalName, def, aliases:Set }
  const aliasToCanon = new Map(); // normName -> canonKey

  const ensureGroup = (canonicalName) => {
    const canonKey = norm(canonicalName);
    let g = groups.get(canonKey);
    if (!g) { g = { canonicalName: String(canonicalName).trim(), def: {}, aliases: new Set() }; groups.set(canonKey, g); }
    return { g, canonKey };
  };

  // 1) static corrections
  Object.keys(QI_CORRECTIONS).forEach((name) => {
    const def = QI_CORRECTIONS[name] || {};
    const { g, canonKey } = ensureGroup(def.canonicalName || name);
    g.aliases.add(norm(name));
    aliasToCanon.set(norm(name), canonKey);
    mergeDef(g, def);
  });

  // 2) union with the live quality data — now EMBEDDED in each department (dept.quality)
  // after the Statistics+Quality merge (was its own `quality` collection).
  const deps = await db.collection('departments').find({}, { projection: { quality: 1 } }).toArray();
  const quals = deps.filter((d) => d.quality).map((d) => d.quality);
  const byName = new Map(); // normName -> [copies]
  quals.forEach((q) => (q.indicators || []).forEach((ind) => {
    const k = norm(ind.name);
    if (!k) return;
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(ind);
  }));
  byName.forEach((copies, k) => {
    if (aliasToCanon.has(k)) return; // already covered by a static correction
    const best = pickBestCopy(copies);
    const { g, canonKey } = ensureGroup(best.name || k);
    g.aliases.add(k);
    aliasToCanon.set(k, canonKey);
    mergeDef(g, best);
  });

  // 3) materialize ordered docs with stable unique ids
  const usedIds = new Set();
  const sorted = [...groups.values()].sort((a, b) => a.canonicalName.localeCompare(b.canonicalName));
  return sorted.map((g, i) => {
    let id = slug(g.canonicalName) || 'formula';
    let base = id, n = 2;
    while (usedIds.has(id)) id = base + '-' + (n++);
    usedIds.add(id);
    const doc = { _id: id, canonicalName: g.canonicalName, aliases: [...g.aliases].sort(), order: i };
    DEF_FIELDS.forEach((f) => { if (!isEmpty(g.def[f])) doc[f] = g.def[f]; });
    return doc;
  });
}

// Idempotent bootstrap: insert only when the collection is empty. Writes a JSON
// snapshot fallback the first time (parity with seed-data.js).
async function ensureSeeded(db) {
  const col = db.collection(COLLECTION);
  const existing = await col.countDocuments();
  if (existing > 0) return { name: COLLECTION, seeded: 0, existing };
  const docs = await buildSeed(db);
  try {
    const p = path.join(__dirname, 'seed', 'quality-formulas.json');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(docs, null, 2), 'utf8');
  } catch (e) { /* snapshot is best-effort */ }
  if (docs.length) {
    await col.bulkWrite(docs.map((d) => ({ replaceOne: { filter: { _id: d._id }, replacement: d, upsert: true } })));
  }
  return { name: COLLECTION, seeded: docs.length, existing: 0 };
}

// Ordered catalogue as plain objects (id = _id) for the API + page inject.
// Read on EVERY page load (it is injected as window.QI_CORRECTIONS before the bundle),
// but written only when an admin edits a formula — so it is cached, keyed to this
// collection's version. The admin PUT below goes through the instrumented handle, so
// an edit invalidates it across the whole fleet the moment it lands.
// Takes no handle: it resolves one itself through dbRead, so the circuit breaker and
// the load limiter both apply. Callers used to await getDbHandle() first and hand the
// result in — which meant they had already paid the full server-selection timeout on a
// dead cluster before this guarded read was reached, defeating the breaker on the
// app's main render path.
async function getFormulas(opts) {
  if (!usingMongo()) return [];
  return cache.read(
    'formulas',
    { coll: COLLECTION, fresh: !!(opts && opts.fresh) },
    () => dbRead(async (db) => {
      const docs = await db.collection(COLLECTION).find({}).sort({ order: 1, _id: 1 }).toArray();
      return docs.map((d) => { const { _id, ...rest } = d; return Object.assign({ id: _id }, rest); });
    })
  );
}

// Expand the catalogue into the window.QI_CORRECTIONS shape: { <normName>: {def} }
// keyed by every alias AND the normalized canonicalName, so all name variants of
// an indicator resolve to the one definition.
function buildByNameMap(formulas) {
  const map = {};
  (formulas || []).forEach((f) => {
    const def = { canonicalName: f.canonicalName };
    DEF_FIELDS.forEach((k) => { if (!isEmpty(f[k])) def[k] = f[k]; });
    const keys = new Set([...(f.aliases || []).map(norm), norm(f.canonicalName)].filter(Boolean));
    keys.forEach((k) => { map[k] = def; });
  });
  return map;
}

// --- Admin API ---------------------------------------------------------------
function mount(app, opts) {
  const guard = (opts && opts.requireApi) || function (req, res, next) { next(); };
  // Prefer the RESOLVED authority (req.access, read from the live user document by
  // server/access.js) over req.user.role, which is only a claim inside the token — a
  // snapshot of who the caller was when they signed in, not who they are now.
  const adminOnly = (req, res, next) => {
    if (req.access) {
      if (req.access.unrestricted) return next();
      return res.status(403).json({ ok: false, error: 'Administrator access required.' });
    }
    if (req.user && req.user.role && req.user.role !== 'Administrator') {
      return res.status(403).json({ ok: false, error: 'Administrator access required.' });
    }
    next();
  };

  app.get('/api/quality-formulas', guard, async (req, res) => {
    try {
      res.json({ ok: true, formulas: await getFormulas() }); // [] in dev: the static fallback drives the app
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not load quality formulas.' }); }
  });

  app.put('/api/quality-formulas/:id', guard, adminOnly, async (req, res) => {
    try {
      const db = await getDbHandle();
      if (!db) return res.status(503).json({ ok: false, error: 'Database unavailable.' });
      const id = String(req.params.id || '');
      const b = req.body || {};
      const set = {};
      if (b.formula !== undefined) {
        if (!FORMULAS.includes(String(b.formula))) return res.status(400).json({ ok: false, error: 'Invalid formula type.' });
        set.formula = String(b.formula);
      }
      ['unit', 'numLabel', 'denLabel', 'numeratorDef', 'denominatorDef', 'benchmark', 'benchmarkNote', 'goalDirection', 'reference', 'referenceUrl', 'canonicalName']
        .forEach((k) => { if (b[k] !== undefined) set[k] = String(b[k]); });
      if (b.benchmarkValue !== undefined) set.benchmarkValue = isEmpty(b.benchmarkValue) ? null : Number(b.benchmarkValue);
      if (Array.isArray(b.aliases)) set.aliases = [...new Set(b.aliases.map(norm).filter(Boolean))];
      if (!Object.keys(set).length) return res.status(400).json({ ok: false, error: 'No editable fields provided.' });
      set.updatedAt = Date.now();
      set.updatedBy = (req.user && (req.user.name || req.user.sub)) || 'local';
      const r = await db.collection(COLLECTION).findOneAndUpdate({ _id: id }, { $set: set }, { returnDocument: 'after' });
      const doc = (r && r.value !== undefined) ? r.value : r; // driver v5 (.value) vs v6 (direct)
      if (!doc) return res.status(404).json({ ok: false, error: 'Formula not found.' });
      const { _id, ...rest } = doc;
      res.json({ ok: true, formula: Object.assign({ id: _id }, rest) });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not update formula.' }); }
  });
}

module.exports = { COLLECTION, DEF_FIELDS, FORMULAS, norm, buildSeed, ensureSeeded, getFormulas, buildByNameMap, extractStaticCorrections, mount };
