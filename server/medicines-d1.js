/* Medicine catalogue on Cloudflare D1 + Cloudinary — MongoDB stays untouched.
 *
 * Activated when `medicine` is in D1_MODULES (server/.env). web.js mounts this
 * BEFORE server/medicines.js, so these catalogue routes win the Express match and
 * medicines.js keeps serving only what still belongs in Mongo (prescriptions and
 * Rx templates — clinical records, not catalogue data). Clearing D1_MODULES puts
 * the catalogue back on Mongo without touching this file.
 *
 * WHERE THINGS LIVE
 *   D1  meds_brand    138k light brand docs (JSON text; edited=1 marks local fixes)
 *   D1  meds_generic  18k generic docs + gzip'd monograph blob (mono_gz)
 *   D1  meds_ref      class / manufacturer / form reference rows
 *   Cloudinary  unico/meds/index.json.gz   the search index (raw asset)
 *   Cloudinary  unico/meds/img/<hash>      the dataset's 52k brand photos
 *   Cloudinary  unico/meds/custom/…        photos the pharmacy uploads itself
 *
 * READ MODEL: search / browse / refs / formulary / analytics run from an
 * IN-MEMORY index loaded once per process from the Cloudinary asset (falling back
 * to a full D1 scan), then overlaid with the few D1 rows carrying edited=1 — so a
 * warm instance costs D1 nothing per search, and a detail view costs 1-2 rows.
 * Every write goes to D1 first and patches the memory copy after, never the other
 * way round (single source of truth; see d1-store.js for the no-dual-write rule).
 */
const zlib = require('zlib');
const path = require('path');
const fs = require('fs');
const d1 = require('./d1');
const storage = require('./storage');
const meds = require('./medicines');   // checkInteractions + shared shapes

const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
// The index ships in two raw assets (Cloudinary free caps one file at 10 MB).
const INDEX_BASE = 'https://res.cloudinary.com/' + CLOUD + '/raw/upload/unico/meds/';
const LOCAL_OUT = path.join(__dirname, '..', 'scripts', 'meds-d1', 'out');

const s = (v, max) => String(v == null ? '' : v).slice(0, max || 200);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const arr = (v) => (Array.isArray(v) ? v : []);
const norm = (v) => s(v, 200).toLowerCase().replace(/\s+/g, ' ').trim();
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const who = (req) => (req.user && (req.user.name || req.user.sub)) || 'local';
const plainText = (v) => String(v || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/* ------------------------------- memory index ------------------------------- */
let IDX = null;          // { brands, byId, generics, gById, refs, loadedAt }
let loadingP = null;

// v2 rows are dictionary-encoded: [id,name,generic,genericId,strength, mfrIdx,
// formIdx, classIdx, typeIdx, price, pregCat, abx, img, popRank]; the derivable
// *Lower fields are recomputed here rather than shipped.
function rowToBrand(a, D) {
  const name = a[1], generic = a[2], mfr = D.mfrs[a[5]] || '';
  return {
    id: a[0], name, nameLower: norm(name), generic, genericId: a[3], genericLower: norm(generic),
    strength: a[4], form: D.forms[a[6]] || '', manufacturer: mfr, manufacturerLower: norm(mfr),
    drugClass: D.classes[a[7]] || '', type: D.types[a[8]] || '', priceUnit: a[9],
    pregnancyCategory: a[10] || '', abx: !!a[11], hasImage: !!a[12], img: a[12] || '', popularity: a[13] || 0,
  };
}
function rowToGeneric(a, D) {
  return { id: a[0], name: a[1], nameLower: norm(a[1]), drugClass: D.classes[a[2]] || '', indication: a[3], sections: a[4], pregnancyCategory: a[5] || '', abx: !!a[6], brands: a[7], forms: (a[8] || []).map((i) => D.forms[i] || '') };
}

async function fetchIndexPart(file) {
  try {
    const r = await fetch(INDEX_BASE + file);
    if (r.ok) return Buffer.from(await r.arrayBuffer());
  } catch (e) { /* fall through to local file */ }
  const local = path.join(LOCAL_OUT, file);
  if (fs.existsSync(local)) return fs.readFileSync(local);
  throw new Error('Medicine index part ' + file + ' is not available (Cloudinary asset missing and no local build).');
}

// The few locally edited/added rows overlay the shipped index on every load.
// Brand overrides live in meds_over (the base 118k brands are PACKED 24-per-row in
// meds_brand as 'bpk-N' rows — D1's free tier counts rows written per day, and
// single-row brands burned a whole day's quota on every dataset refresh).
async function applyOverlay(idx) {
  try {
    // meds_over may not exist until the packed import has run once.
    const eb = await d1.query('SELECT doc FROM meds_over LIMIT 5000').catch(() => []);
    eb.forEach((r) => {
      const d = JSON.parse(r.doc);
      const lite = brandLite(d);
      const at = idx.byId.get(lite.id);
      if (at != null) idx.brands[at] = lite; else { idx.byId.set(lite.id, idx.brands.length); idx.brands.push(lite); }
    });
    const eg = await d1.query('SELECT doc FROM meds_generic WHERE edited=1 LIMIT 3000');
    eg.forEach((r) => {
      const d = JSON.parse(r.doc);
      const lite = { id: d._id || d.id, name: d.name, nameLower: d.nameLower, drugClass: d.drugClass, indication: d.indication, sections: d.sections, pregnancyCategory: d.pregnancyCategory, abx: !!d.abx, brands: d.brands, forms: d.forms || [] };
      const at = idx.gById.get(lite.id);
      if (at != null) idx.generics[at] = lite; else { idx.gById.set(lite.id, idx.generics.length); idx.generics.push(lite); }
    });
  } catch (e) { /* overlay unavailable — the shipped index still serves */ }
}

function brandLite(d) {
  return {
    id: d._id || d.id, name: d.name, nameLower: d.nameLower, generic: d.generic, genericId: d.genericId,
    genericLower: d.genericLower, strength: d.strength, form: d.form, manufacturer: d.manufacturer,
    manufacturerLower: d.manufacturerLower, drugClass: d.drugClass, type: d.type,
    priceUnit: d.price ? d.price.unit : null, pregnancyCategory: d.pregnancyCategory, abx: !!d.abx,
    hasImage: !!(d.hasImage || d.customImg), img: d.img || '', popularity: d.popularity || 0,
    stocked: !!d.stocked, preferred: !!d.preferred, formularyNote: d.formularyNote || '',
    discontinued: !!d.discontinued, customImg: d.customImg || null,
  };
}

async function loadIndex() {
  if (IDX) return IDX;
  if (loadingP) return loadingP;
  loadingP = (async () => {
    const [bPart, mPart] = await Promise.all([fetchIndexPart('index-brands.json.gz'), fetchIndexPart('index-meta.json.gz')]);
    const B = JSON.parse(zlib.gunzipSync(bPart).toString('utf8'));
    const D = JSON.parse(zlib.gunzipSync(mPart).toString('utf8'));
    const idx = {
      brands: B.brands.map((a) => rowToBrand(a, D)),
      generics: D.generics.map((a) => rowToGeneric(a, D)),
      refs: D.refs.map((r) => ({ id: r._id, kind: r.kind, name: r.name, count: r.count || 0 })),
      byId: new Map(), gById: new Map(), loadedAt: Date.now(),
    };
    idx.brands.forEach((b, i) => idx.byId.set(b.id, i));
    idx.generics.forEach((g, i) => idx.gById.set(g.id, i));
    idx.baseCount = idx.brands.length;   // positions below this map into 'bpk-N' packs
    await applyOverlay(idx);
    buildSortIndexes(idx);
    IDX = idx;
    loadingP = null;
    console.log('[meds-d1] index loaded: ' + idx.brands.length + ' brands, ' + idx.generics.length + ' generics');
    return idx;
  })();
  return loadingP;
}

const patchMemBrand = (doc) => {
  if (!IDX) return;
  const lite = brandLite(doc);
  const at = IDX.byId.get(lite.id);
  if (at != null) IDX.brands[at] = lite; else { IDX.byId.set(lite.id, IDX.brands.length); IDX.brands.push(lite); }
  buildSortIndexes(IDX);   // a renamed/added brand changes the sort order
  qCache.clear();
};

/* ---- speed: sorted prefix indexes + a small result cache -------------------
 * Typing "napa" used to mean four full linear passes over 118k brands. Names are
 * sorted ONCE at load, so a prefix match is a binary search plus a walk over the
 * matching run — the case that covers almost every real search. The slower
 * word-prefix / mid-word passes only run when the prefix run came up short.
 * Results are memoised per query+filters, which is what makes backspacing and
 * re-typing instant.
 */
function buildSortIndexes(idx) {
  const cmp = (arr, key) => (a, b) => (arr[a][key] < arr[b][key] ? -1 : arr[a][key] > arr[b][key] ? 1 : 0);
  idx.bByName = idx.brands.map((_, i) => i).sort(cmp(idx.brands, 'nameLower'));
  idx.bByGeneric = idx.brands.map((_, i) => i).sort(cmp(idx.brands, 'genericLower'));
  idx.gByName = idx.generics.map((_, i) => i).sort(cmp(idx.generics, 'nameLower'));
}
// Positions in `order` whose key starts with q (binary search for the run start).
function prefixRun(order, rows, key, q, cap) {
  let lo = 0, hi = order.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (rows[order[mid]][key] < q) lo = mid + 1; else hi = mid; }
  const out = [];
  for (let i = lo; i < order.length && out.length < cap; i++) {
    const v = rows[order[i]][key];
    if (!v || !v.startsWith(q)) break;
    out.push(order[i]);
  }
  return out;
}
const qCache = new Map();
const CACHE_MAX = 400;
function cached(key, make) {
  if (qCache.has(key)) { const v = qCache.get(key); qCache.delete(key); qCache.set(key, v); return v; }  // LRU touch
  const v = make();
  qCache.set(key, v);
  if (qCache.size > CACHE_MAX) qCache.delete(qCache.keys().next().value);
  return v;
}

/* ------------------------------ output shapes ------------------------------ */
// BRAND_LIST-equivalent row, exactly what the client's lists render.
function brandOut(b) {
  return {
    id: b.id, name: b.name, strength: b.strength, form: b.form, manufacturer: b.manufacturer,
    generic: b.generic, genericId: b.genericId, type: b.type, drugClass: b.drugClass,
    price: b.priceUnit != null ? { unit: b.priceUnit, unitLabel: 'Unit Price' } : null,
    pregnancyCategory: b.pregnancyCategory, abx: b.abx, stocked: !!b.stocked, preferred: !!b.preferred,
    hasImage: !!b.hasImage,
  };
}
function genOut(g) {
  return { id: g.id, name: g.name, drugClass: g.drugClass, indication: g.indication, brands: g.brands, forms: g.forms, sections: g.sections, pregnancyCategory: g.pregnancyCategory, abx: g.abx };
}
const byPriceThenName = (list) => list.slice().sort((a, b) =>
  ((a.priceUnit == null) - (b.priceUnit == null)) || ((a.priceUnit || 0) - (b.priceUnit || 0)) || a.nameLower.localeCompare(b.nameLower));

/* ------------------------------- D1 documents ------------------------------- */
function unpackMono(row) {
  if (!row) return null;
  const doc = JSON.parse(row.doc);
  if (row.mono_gz) {
    try {
      const heavy = JSON.parse(zlib.gunzipSync(Buffer.from(row.mono_gz, 'base64')).toString('utf8'));
      doc.monograph = heavy.monograph || {};
      doc.brief = heavy.brief || {};
    } catch (e) { doc.monograph = {}; doc.brief = {}; }
  }
  return Object.assign({ id: doc._id }, doc, { _id: undefined });
}
async function d1Brand(id) {
  id = s(id, 40);
  // A local edit/addition always wins; then the packed base row. The overlay table
  // only exists once a packed import (or the first local edit) has created it, so a
  // missing-table error here must not take the whole lookup down.
  const over = await d1.get('SELECT doc FROM meds_over WHERE id=?', [id]).catch(() => null);
  if (over) { const doc = JSON.parse(over.doc); return Object.assign({ id: doc._id }, doc, { _id: undefined }); }
  const idx = await loadIndex();
  const pos = idx.byId.get(id);
  if (pos != null && pos < idx.baseCount) {
    const pack = await d1.get('SELECT doc FROM meds_brand WHERE id=?', ['bpk-' + Math.floor(pos / 24)]);
    if (pack) {
      const doc = (JSON.parse(pack.doc).docs || []).find((d) => d._id === id);
      if (doc) return Object.assign({ id: doc._id }, doc, { _id: undefined });
    }
  }
  // Pre-pack fallback: the previous import stored one row per brand. Kept so a
  // restart between deploying this code and running the packed import can't 404.
  const legacy = await d1.get('SELECT doc FROM meds_brand WHERE id=?', [id]);
  if (legacy) { const doc = JSON.parse(legacy.doc); return Object.assign({ id: doc._id }, doc, { _id: undefined }); }
  return null;
}
/* Documented interactions + food warnings.
 *
 * These live in the CDN asset, not in D1: they are read-only reference data needed
 * on EVERY drug page and every checker run, so an in-memory map costs nothing per
 * lookup, and keeping ~21k rows out of D1 leaves the free tier's daily write budget
 * for the catalogue itself. Loaded once per process, alongside the search index.
 */
let IX = null, ixLoadingP = null;
const SEVS = ['major', 'moderate', 'minor'], CONFS = ['high', 'medium', 'low'];
async function loadInteractions() {
  if (IX) return IX;
  if (ixLoadingP) return ixLoadingP;
  ixLoadingP = (async () => {
    const raw = JSON.parse(zlib.gunzipSync(await fetchIndexPart('index-interactions.json.gz')).toString('utf8'));
    const byGid = new Map(), foodByGid = new Map();
    (raw.ix || []).forEach((a) => {
      const row = { gid: a[0], with: a[1], severity: SEVS[a[2]] || 'moderate', reason: a[3], advice: a[4], confidence: CONFS[a[5]] || 'medium' };
      const l = byGid.get(row.gid) || []; l.push(row); byGid.set(row.gid, l);
    });
    (raw.food || []).forEach((a) => {
      const row = { gid: a[0], warning: a[1], confidence: CONFS[a[2]] || 'medium' };
      const l = foodByGid.get(row.gid) || []; l.push(row); foodByGid.set(row.gid, l);
    });
    IX = { byGid, foodByGid };
    ixLoadingP = null;
    console.log('[meds-d1] interactions loaded: ' + (raw.ix || []).length + ' warnings, ' + (raw.food || []).length + ' food notes');
    return IX;
  })();
  return ixLoadingP;
}
async function interactionRows(gids) {
  if (!gids.length) return [];
  const ix = await loadInteractions();
  const out = [];
  gids.forEach((g) => (ix.byGid.get(g) || []).forEach((r) => out.push(r)));
  return out;
}
async function foodRows(gids) {
  if (!gids.length) return [];
  const ix = await loadInteractions();
  const out = [];
  gids.forEach((g) => (ix.foodByGid.get(g) || []).forEach((r) => out.push(r)));
  return out;
}
async function d1Generic(id) {
  return unpackMono(await d1.get('SELECT doc, mono_gz FROM meds_generic WHERE id=?', [s(id, 40)]));
}
function packGeneric(doc) {
  const { monograph, brief, id, ...rest } = doc;
  const mono_gz = zlib.gzipSync(Buffer.from(JSON.stringify({ monograph: monograph || {}, brief: brief || {} }), 'utf8'), { level: 6 }).toString('base64');
  return { doc: JSON.stringify(Object.assign({ _id: id }, rest)), mono_gz };
}
let _overReady = false;
async function saveBrand(doc) {
  if (!_overReady) { try { await d1.run('CREATE TABLE IF NOT EXISTS meds_over (id TEXT PRIMARY KEY, doc TEXT NOT NULL)'); } catch (e) {} _overReady = true; }
  const { id, ...rest } = doc;
  await d1.run('INSERT OR REPLACE INTO meds_over (id, doc) VALUES (?,?)', [id, JSON.stringify(Object.assign({ _id: id }, rest))]);
  patchMemBrand(Object.assign({ _id: id }, rest));
}

/* ---- structured interaction matching --------------------------------------
 * The 2026-09 dataset ships 19,106 curated warnings per generic: interacts_with
 * (a drug or class NAME in prose), severity, reason, advice, confidence. To decide
 * whether B is "that" drug, B's name/base-name/class are matched against the
 * interacts_with text with the same loose word-join rules the prose checker uses.
 */
const IX_SALTS = new Set(['sodium', 'potassium', 'calcium', 'hydrochloride', 'hcl', 'sulphate', 'sulfate', 'phosphate', 'nitrate', 'acetate', 'citrate', 'tartrate', 'fumarate', 'succinate', 'maleate', 'mesylate', 'besilate', 'besylate', 'trihydrate', 'dihydrate', 'monohydrate', 'axetil', 'proxetil', 'pivoxil', 'disoproxil', 'sodium', 'dipropionate', 'propionate', 'valerate', 'furoate', 'palmitate', 'decanoate']);
const ixStrip = (name) => { let p = String(name || '').trim().split(/\s+/); while (p.length > 1 && IX_SALTS.has(p[p.length - 1].toLowerCase().replace(/[^a-z]/g, ''))) p.pop(); return p.join(' '); };
function ixRe(phrase) {
  const parts = String(phrase || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (!parts.length) return null;
  parts[parts.length - 1] = parts[parts.length - 1].replace(/s$/, '');
  return new RegExp('\\b' + parts.map((c, i) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + (i === parts.length - 1 ? 's?' : '')).join('[-\\s]?') + '\\b', 'i');
}
function ixTargets(g) {
  const out = [];
  String(g.name || '').split(/\s*\+\s*/).forEach((part) => {
    const p = part.trim(); if (p.length >= 5) out.push(p);
    const base = ixStrip(p); if (base.length >= 5 && base !== p) out.push(base);
  });
  const cls = String(g.drugClass || '').split(/[^A-Za-z0-9-]+/).filter((w) => w.length > 3 && !/^(oral|drugs?|agents?|other|used|for|and|the|preparations?|products?)$/i.test(w)).join(' ');
  if (cls.length >= 6) out.push(cls);
  return out;
}
function structuredWarnings(list, ixByGid) {
  const out = [];
  const uniq = []; const seen = new Set();
  list.forEach((g) => { if (!seen.has(g.id)) { seen.add(g.id); uniq.push(g); } });
  for (const a of uniq) {
    const rows = ixByGid.get(a.id) || [];
    for (const b of uniq) {
      if (a.id === b.id) continue;
      const targets = ixTargets(b);
      for (const row of rows) {
        const hit = targets.some((t) => { const re = ixRe(t); return re && re.test(row.with); })
          || targets.some((t) => { const re = ixRe(row.with); return re && re.test(t); });
        if (!hit) continue;
        const key = [a.name, b.name].sort().join('|');
        if (out.some((w) => w.key === key)) continue;
        out.push({
          severity: row.severity === 'major' ? 'high' : 'moderate', kind: 'interaction', key, structured: true,
          title: a.name + ' + ' + b.name,
          detail: row.reason + (row.advice ? ' — ' + row.advice : ''),
          source: 'Interaction database (' + (row.confidence || 'stated') + ' confidence): ' + a.name + ' vs ' + row.with,
          generics: [a.name, b.name],
        });
        break;
      }
    }
  }
  return out;
}

const imgUrl = (b) => b.customImg && b.customImg.url
  ? b.customImg.url
  : b.img ? 'https://res.cloudinary.com/' + CLOUD + '/image/upload/f_auto,q_auto,c_limit,w_640/unico/meds/img/' + b.img.replace(/\.[a-z0-9]+$/i, '')
  : '';

/* --------------------------------- routes --------------------------------- */
function mount(app, opts) {
  const guard = (opts && opts.requireApi) || function (req, res, next) { next(); };
  const adminOnly = (req, res, next) => {
    if (req.access && !req.access.unrestricted) return res.status(403).json({ ok: false, error: 'Administrator access required to edit the drug catalogue.' });
    next();
  };
  const fail = (res, msg) => (e) => { console.error('[meds-d1] ' + msg, e && e.message); res.status(500).json({ ok: false, error: msg }); };

  loadIndex().catch((e) => console.error('[meds-d1] index preload failed: ' + e.message));
  loadInteractions().catch((e) => console.error('[meds-d1] interaction preload failed: ' + e.message));

  /* RANKED search. What you typed is almost always the START of a name or of a
     word inside one — "napa" must surface Napa, Napa Extra and Napa Extend, not
     Sonapata (which merely CONTAINS the letters mid-word). Tiers:
       0 exact name   1 name prefix   2 a word in the name starts with it
       3 generic name matches (same word rules)   5 mid-word substring (last resort)
     Popularity breaks ties, so the drugs a BD prescriber means come first. */
  const tierOf = (nameLower, q) => {
    if (!nameLower) return 99;
    if (nameLower === q) return 0;
    if (nameLower.startsWith(q)) return 1;
    if (nameLower.includes(' ' + q)) return 2;
    if (q.length >= 4 && nameLower.includes(q)) return 5;
    return 99;
  };
  app.get('/api/med/search', guard, async (req, res) => {
    try {
      const q = norm(req.query.q);
      if (!q) return res.json({ ok: true, brands: [], generics: [] });
      const idx = await loadIndex();
      const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
      const kind = s(req.query.kind, 20);
      // field=name searches the BRAND NAME only (the "Brand" search mode); the
      // default also matches a brand through its generic, which is what a mixed
      // "type anything" box should do.
      const nameOnly = s(req.query.field, 10) === 'name';
      const fType = s(req.query.type, 20), fForm = norm(req.query.form), fStock = s(req.query.stocked, 10) === '1';
      // form matches loosely ("Injection" finds "IV Injection or Infusion") so the
      // UI's four route pills cover the dataset's many form spellings.
      const keep = (b) => (!fType || b.type === fType) && (!fForm || norm(b.form).includes(fForm)) && (!fStock || b.stocked);
      const ck = 'S|' + q + '|' + kind + '|' + (nameOnly ? 'n' : 'a') + '|' + fType + '|' + fForm + '|' + fStock + '|' + limit;

      const payload = cached(ck, () => {
        let brands = [];
        if (kind !== 'generic') {
          const seen = new Set(); const hits = [];
          const add = (pos, tier) => { const b = idx.brands[pos]; if (seen.has(pos) || !keep(b)) return; seen.add(pos); hits.push([tier, b]); };
          // exact + name prefix, straight off the sorted index
          prefixRun(idx.bByName, idx.brands, 'nameLower', q, limit * 40).forEach((p) => add(p, idx.brands[p].nameLower === q ? 0 : 1));
          if (!nameOnly) prefixRun(idx.bByGeneric, idx.brands, 'genericLower', q, limit * 40).forEach((p) => add(p, 3));
          // only pay for the scan when the cheap passes came up short
          if (hits.length < limit) {
            for (let i = 0; i < idx.brands.length; i++) {
              if (seen.has(i)) continue;
              const b = idx.brands[i];
              const t = nameOnly ? tierOf(b.nameLower, q) : Math.min(tierOf(b.nameLower, q), tierOf(b.genericLower, q) + 3);
              if (t < 99 && keep(b)) { seen.add(i); hits.push([t, b]); }
            }
          }
          hits.sort((x, y) => (x[0] - y[0]) || ((x[1].popularity || 9e9) - (y[1].popularity || 9e9)) || (x[1].nameLower < y[1].nameLower ? -1 : 1));
          const good = hits.filter((h) => h[0] < 5);
          brands = (good.length >= limit ? good : good.concat(hits.filter((h) => h[0] >= 5)))
            .slice(0, limit).map((h) => brandOut(h[1]));
        }
        let generics = [];
        if (kind !== 'brand') {
          const glim = kind === 'generic' ? limit : Math.min(limit, 12);
          const seen = new Set(); const hits = [];
          const add = (pos, tier) => { if (seen.has(pos)) return; seen.add(pos); hits.push([tier, idx.generics[pos]]); };
          prefixRun(idx.gByName, idx.generics, 'nameLower', q, glim * 40).forEach((p) => add(p, idx.generics[p].nameLower === q ? 0 : 1));
          if (hits.length < glim) {
            for (let i = 0; i < idx.generics.length; i++) {
              if (seen.has(i)) continue;
              const t = tierOf(idx.generics[i].nameLower, q);
              if (t < 99) { seen.add(i); hits.push([t, idx.generics[i]]); }
            }
          }
          hits.sort((x, y) => (x[0] - y[0]) || (y[1].brands - x[1].brands) || (x[1].nameLower < y[1].nameLower ? -1 : 1));
          const good = hits.filter((h) => h[0] < 5);
          let list = (good.length ? good : hits).slice(0, glim);
          if (!list.length && q.length >= 3) {
            // Nothing matched a name — they are probably searching by what it treats.
            list = idx.generics.filter((g) => (g.indication || '').toLowerCase().includes(q))
              .sort((a, b) => b.brands - a.brands).slice(0, glim).map((g) => [9, g]);
          }
          generics = list.map((h) => genOut(h[1]));
        }
        return { ok: true, brands, generics };
      });
      res.json(payload);
    } catch (e) { fail(res, 'Search failed.')(e); }
  });

  app.get('/api/med/browse', guard, async (req, res) => {
    try {
      const idx = await loadIndex();
      const isGen = req.query.kind === 'generic';
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const per = Math.min(parseInt(req.query.per, 10) || 50, 200);
      const letter = norm(req.query.letter).replace(/[^a-z0-9]/g, '');
      const cls = norm(req.query.class), mfr = norm(req.query.mfr), form = norm(req.query.form);
      const type = s(req.query.type, 20), genericId = s(req.query.genericId, 40);
      const stocked = s(req.query.stocked, 10) === '1', abx = s(req.query.abx, 10) === '1', hasImg = s(req.query.hasImage, 10) === '1';
      const indication = norm(req.query.indication);
      // The filtered+sorted set is memoised per filter combination, so paging through
      // it (the common case) never re-scans 118k rows, and a letter the ward browses
      // every day is built once.
      const rows = cached('B|' + (isGen ? 'g' : 'b') + '|' + [letter, cls, mfr, form, type, genericId, indication, stocked, abx, hasImg].join('|'), () => {
        // Walk the ALREADY name-sorted order and filter — the output is sorted by
        // construction, so browsing 118k rows needs no sort at all.
        if (isGen) {
          const src = letter ? prefixRun(idx.gByName, idx.generics, 'nameLower', letter, 1e9) : idx.gByName;
          const out = [];
          for (const p of src) {
            const g = idx.generics[p];
            if ((!cls || norm(g.drugClass) === cls) && (!indication || (g.indication || '').toLowerCase().includes(indication))) out.push(g);
          }
          // generics lead with the most-carried ones; the name order breaks ties
          return out.sort((a, b) => (b.brands - a.brands) || (a.nameLower < b.nameLower ? -1 : 1));
        }
        const src = letter ? prefixRun(idx.bByName, idx.brands, 'nameLower', letter, 1e9) : idx.bByName;
        const out = [];
        for (const p of src) {
          const b = idx.brands[p];
          if ((!cls || norm(b.drugClass) === cls) &&
              (!mfr || b.manufacturerLower === mfr) &&
              (!form || norm(b.form).includes(form)) &&
              (!type || b.type === type) &&
              (!genericId || b.genericId === genericId) &&
              (!stocked || b.stocked) && (!abx || b.abx) && (!hasImg || b.hasImage)) out.push(b);
        }
        return out;
      });
      const total = rows.length;
      const pageRows = rows.slice((page - 1) * per, (page - 1) * per + per).map(isGen ? genOut : brandOut);
      res.json({ ok: true, rows: pageRows, total, page, per, pages: Math.ceil(total / per) });
    } catch (e) { fail(res, 'Could not browse the index.')(e); }
  });

  app.get('/api/med/brand/:id', guard, async (req, res) => {
    try {
      const idx = await loadIndex();
      const brand = await d1Brand(req.params.id);
      if (!brand) return res.status(404).json({ ok: false, error: 'Brand not found.' });
      let generic = null, alternatives = [], interactions = [], foodWarnings = [];
      if (brand.genericId) {
        generic = await d1Generic(brand.genericId);
        alternatives = byPriceThenName(idx.brands.filter((b) => b.genericId === brand.genericId && b.id !== brand.id)).slice(0, 60).map(brandOut);
        try { interactions = await interactionRows([brand.genericId]); foodWarnings = await foodRows([brand.genericId]); } catch (e) { /* pre-import */ }
      }
      res.json({ ok: true, brand, generic, alternatives, interactions, foodWarnings });
    } catch (e) { fail(res, 'Could not load the brand.')(e); }
  });

  app.get('/api/med/generic/:id', guard, async (req, res) => {
    try {
      const idx = await loadIndex();
      const id = s(req.params.id, 40);
      let gid = id;
      if (id.indexOf('gen-') !== 0) {
        const hit = idx.generics.find((g) => g.nameLower === norm(id));
        if (!hit) return res.status(404).json({ ok: false, error: 'Generic not found.' });
        gid = hit.id;
      }
      const generic = await d1Generic(gid);
      if (!generic) return res.status(404).json({ ok: false, error: 'Generic not found.' });
      const brands = byPriceThenName(idx.brands.filter((b) => b.genericId === gid)).slice(0, 300).map(brandOut);
      let interactions = [], foodWarnings = [];
      try { interactions = await interactionRows([gid]); foodWarnings = await foodRows([gid]); } catch (e) { /* pre-import */ }
      res.json({ ok: true, generic, brands, interactions, foodWarnings });
    } catch (e) { fail(res, 'Could not load the generic.')(e); }
  });

  app.get('/api/med/refs', guard, async (req, res) => {
    try {
      const idx = await loadIndex();
      const kind = s(req.query.kind, 20);
      const refs = idx.refs.filter((r) => !kind || r.kind === kind)
        .slice().sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name)).slice(0, 3000);
      res.json({ ok: true, refs });
    } catch (e) { fail(res, 'Could not load reference lists.')(e); }
  });

  app.put('/api/med/brand/:id', guard, adminOnly, async (req, res) => {
    try {
      const brand = await d1Brand(req.params.id);
      if (!brand) return res.status(404).json({ ok: false, error: 'Brand not found.' });
      const b = obj(req.body);
      ['name', 'strength', 'form', 'manufacturer', 'generic', 'type', 'note'].forEach((k) => { if (b[k] != null) brand[k] = s(b[k], 200); });
      if (b.name != null) brand.nameLower = norm(brand.name);
      if (b.manufacturer != null) brand.manufacturerLower = norm(brand.manufacturer);
      if (b.price != null) {
        const p = obj(b.price);
        brand.price = { raw: s(p.raw, 300), unit: num(p.unit), unitLabel: s(p.unitLabel, 80) || 'Unit Price',
          packs: arr(p.packs).slice(0, 10).map((x) => ({ label: s(obj(x).label, 60), price: num(obj(x).price) })), updatedAt: Date.now() };
      }
      if (b.discontinued != null) brand.discontinued = !!b.discontinued;
      brand.edited = true; brand.editedBy = who(req); brand.editedAt = Date.now();
      await saveBrand(brand);
      res.json({ ok: true, brand });
    } catch (e) { fail(res, 'Could not save the brand.')(e); }
  });

  app.put('/api/med/generic/:id', guard, adminOnly, async (req, res) => {
    try {
      const g = await d1Generic(req.params.id);
      if (!g) return res.status(404).json({ ok: false, error: 'Generic not found.' });
      const b = obj(req.body);
      ['name', 'drugClass', 'indication'].forEach((k) => { if (b[k] != null) g[k] = s(b[k], 200); });
      if (b.name != null) g.nameLower = norm(g.name);
      if (b.monograph != null) {
        const m = obj(b.monograph), out = {};
        Object.keys(m).slice(0, 25).forEach((k) => { const v = s(m[k], 20000); if (v) out[s(k, 40)] = v; });
        g.monograph = out;
        g.sections = Object.keys(out).length;
        g.brief = {
          dosage: plainText(out.dosage).slice(0, 1200), interaction: plainText(out.interaction).slice(0, 1200),
          contra: plainText(out.contraindications).slice(0, 1200), pregnancy: plainText(out.pregnancy).slice(0, 600),
        };
      }
      g.edited = true; g.editedBy = who(req); g.editedAt = Date.now();
      const packed = packGeneric(g);
      await d1.run('INSERT OR REPLACE INTO meds_generic (id, doc, mono_gz, edited) VALUES (?,?,?,1)', [g.id, packed.doc, packed.mono_gz]);
      if (IDX) {
        const at = IDX.gById.get(g.id);
        const lite = { id: g.id, name: g.name, nameLower: g.nameLower, drugClass: g.drugClass, indication: g.indication, sections: g.sections, pregnancyCategory: g.pregnancyCategory, abx: !!g.abx, brands: g.brands, forms: g.forms || [] };
        if (at != null) IDX.generics[at] = lite; else { IDX.gById.set(g.id, IDX.generics.length); IDX.generics.push(lite); }
      }
      res.json({ ok: true, generic: g });
    } catch (e) { fail(res, 'Could not save the generic.')(e); }
  });

  app.post('/api/med/brand', guard, adminOnly, async (req, res) => {
    try {
      const idx = await loadIndex();
      const b = obj(req.body);
      const name = s(b.name, 120).trim();
      if (!name) return res.status(400).json({ ok: false, error: 'A brand name is required.' });
      const gen = s(b.genericId, 40) ? idx.generics[idx.gById.get(s(b.genericId, 40))] : null;
      const doc = {
        id: 'local-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
        name, nameLower: norm(name), type: s(b.type, 20) || 'allopathic', form: s(b.form, 60),
        generic: gen ? gen.name : s(b.generic, 200), genericId: gen ? gen.id : '',
        genericLower: norm(gen ? gen.name : b.generic),
        strength: s(b.strength, 80), manufacturer: s(b.manufacturer, 160), manufacturerLower: norm(b.manufacturer),
        drugClass: gen ? gen.drugClass : '',
        price: { raw: '', unit: num(obj(b.price).unit), unitLabel: s(obj(b.price).unitLabel, 80) || 'Unit Price', packs: [] },
        edited: true, source: 'local', createdBy: who(req), createdAt: Date.now(),
      };
      await saveBrand(doc);
      res.json({ ok: true, brand: doc });
    } catch (e) { fail(res, 'Could not add the brand.')(e); }
  });

  app.post('/api/med/check', guard, async (req, res) => {
    try {
      const ids = [...new Set(arr(obj(req.body).genericIds).slice(0, 40).map((x) => s(x, 40)).filter(Boolean))];
      const allergies = s(obj(req.body).allergies, 300);
      const order = arr(obj(req.body).genericIds).slice(0, 40).map((x) => s(x, 40)).filter(Boolean);
      if (!order.length) return res.json({ ok: true, warnings: [] });
      const rows = await d1.query('SELECT id, doc, mono_gz FROM meds_generic WHERE id IN (' + ids.map(() => '?').join(',') + ')', ids);
      const byId = new Map(rows.map((r) => { const g = unpackMono(r); return [g.id, { id: g.id, name: g.name, drugClass: g.drugClass, brief: g.brief || {} }]; }));
      const list = order.map((id) => byId.get(id)).filter(Boolean);
      // Curated pairwise warnings FIRST (severity/reason/advice from the dataset's
      // 19k-row interaction table); the prose scan + duplicate/class/allergy checks
      // then fill in anything the curated table doesn't cover.
      let ixByGid = new Map();
      try {
        const irows = await interactionRows(ids);
        irows.forEach((r) => { const l2 = ixByGid.get(r.gid) || []; l2.push(r); ixByGid.set(r.gid, l2); });
      } catch (e) { /* table not imported yet — prose scan still covers it */ }
      const structured = structuredWarnings(list, ixByGid);
      const covered = new Set(structured.map((w) => w.key));
      const prose = meds.checkInteractions(list, allergies)
        .filter((w) => w.kind !== 'interaction' || !covered.has(w.key));
      const rank = { critical: 0, high: 1, moderate: 1.5, info: 2 };
      const warnings = structured.concat(prose).sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3));
      res.json({ ok: true, warnings });
    } catch (e) { fail(res, 'Could not run the interaction check.')(e); }
  });

  /* --- images: Cloudinary, never database bytes --- */
  const IMG_MAX = 400 * 1024;
  const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  app.get('/api/med/image/:id', guard, async (req, res) => {
    try {
      const idx = await loadIndex();
      const at = idx.byId.get(s(req.params.id, 40));
      const b = at != null ? idx.brands[at] : null;
      const url = b ? imgUrl(b) : '';
      if (!url) return res.status(404).end();
      res.setHeader('Cache-Control', 'private, max-age=86400');
      res.redirect(302, url);
    } catch (e) { res.status(404).end(); }
  });

  app.put('/api/med/brand/:id/image', guard, adminOnly, async (req, res) => {
    try {
      const brand = await d1Brand(req.params.id);
      if (!brand) return res.status(404).json({ ok: false, error: 'Brand not found.' });
      const m = String(obj(req.body).image || '').match(/^data:([a-z/+-]+);base64,([A-Za-z0-9+/=]+)$/i);
      if (!m) return res.status(400).json({ ok: false, error: 'Send the image as a base64 data URI.' });
      if (IMG_TYPES.indexOf(m[1].toLowerCase()) < 0) return res.status(400).json({ ok: false, error: 'JPEG, PNG or WebP only.' });
      const buf = Buffer.from(m[2], 'base64');
      if (!buf.length) return res.status(400).json({ ok: false, error: 'The image is empty.' });
      if (buf.length > IMG_MAX) return res.status(413).json({ ok: false, error: 'Image too large - it must be under ' + Math.round(IMG_MAX / 1024) + ' KB after resizing.' });
      const old = brand.customImg && brand.customImg.publicId;
      const up = await storage.uploadBuffer(buf, { folder: 'unico/meds/custom' });
      brand.customImg = { url: up.url, publicId: up.publicId, caption: s(obj(req.body).caption, 160), updatedAt: Date.now(), updatedBy: who(req) };
      brand.hasImage = true;
      await saveBrand(brand);
      if (old && old !== up.publicId) storage.deleteByPublicId(old).catch(() => {});
      res.json({ ok: true, bytes: buf.length });
    } catch (e) { fail(res, 'Could not save the image.')(e); }
  });

  app.delete('/api/med/brand/:id/image', guard, adminOnly, async (req, res) => {
    try {
      const brand = await d1Brand(req.params.id);
      if (!brand) return res.json({ ok: true });
      if (brand.customImg && brand.customImg.publicId) storage.deleteByPublicId(brand.customImg.publicId).catch(() => {});
      brand.customImg = null;
      brand.img = '';
      brand.hasImage = false;
      await saveBrand(brand);
      res.json({ ok: true });
    } catch (e) { fail(res, 'Could not remove the image.')(e); }
  });

  /* --- hospital formulary --- */
  app.put('/api/med/brand/:id/formulary', guard, adminOnly, async (req, res) => {
    try {
      const brand = await d1Brand(req.params.id);
      if (!brand) return res.status(404).json({ ok: false, error: 'Brand not found.' });
      const b = obj(req.body);
      if (b.stocked != null) brand.stocked = !!b.stocked;
      if (b.preferred != null) brand.preferred = !!b.preferred;
      if (b.formularyNote != null) brand.formularyNote = s(b.formularyNote, 200);
      brand.formularyBy = who(req); brand.formularyAt = Date.now();
      brand.edited = true;
      await saveBrand(brand);
      res.json({ ok: true, brand });
    } catch (e) { fail(res, 'Could not update the formulary.')(e); }
  });

  app.get('/api/med/formulary', guard, async (req, res) => {
    try {
      const idx = await loadIndex();
      const rows = idx.brands.filter((b) => b.stocked)
        .sort((a, b) => a.nameLower.localeCompare(b.nameLower)).slice(0, 2000)
        .map((b) => Object.assign(brandOut(b), { preferred: !!b.preferred, formularyNote: b.formularyNote || '', stocked: true }));
      res.json({ ok: true, rows, total: rows.length });
    } catch (e) { fail(res, 'Could not load the formulary.')(e); }
  });

  /* --- prescribing analytics: Rx stays in Mongo, the abx flag comes from here --- */
  app.get('/api/med/analytics', guard, async (req, res) => {
    try {
      const { getDbHandle } = require('./db');
      const db = await getDbHandle();
      if (!db) return res.status(503).json({ ok: false, error: 'The medicine database is not available.' });
      const c = db.collection(meds.C_RX);
      const where = { status: { $ne: 'cancelled' } };
      if (s(req.query.from, 20) || s(req.query.to, 20)) {
        where.date = {};
        if (s(req.query.from, 20)) where.date.$gte = s(req.query.from, 20);
        if (s(req.query.to, 20)) where.date.$lte = s(req.query.to, 20);
      }
      const [totals, topDrugs, topDx, byDoctor, byMonth] = await Promise.all([
        c.aggregate([{ $match: where }, { $group: { _id: null, rx: { $sum: 1 }, items: { $sum: '$itemCount' }, patients: { $addToSet: '$uhid' } } }]).toArray(),
        c.aggregate([{ $match: where }, { $unwind: '$items' },
          { $group: { _id: { $ifNull: ['$items.generic', '$items.brand'] }, n: { $sum: 1 }, genericId: { $first: '$items.genericId' } } },
          { $sort: { n: -1 } }, { $limit: 20 }]).toArray(),
        c.aggregate([{ $match: Object.assign({ diagnosis: { $nin: ['', null] } }, where) },
          { $group: { _id: '$diagnosis', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 12 }]).toArray(),
        c.aggregate([{ $match: where }, { $group: { _id: '$doctorName', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 12 }]).toArray(),
        c.aggregate([{ $match: where }, { $group: { _id: { $substr: ['$date', 0, 7] }, n: { $sum: 1 } } }, { $sort: { _id: 1 } }, { $limit: 24 }]).toArray(),
      ]);
      const idx = await loadIndex();
      const abxIds = new Set(idx.generics.filter((g) => g.abx).map((g) => g.id));
      const withItems = await c.find(where).project({ 'items.genericId': 1 }).limit(5000).toArray();
      const abxRx = withItems.filter((d) => (d.items || []).some((i) => abxIds.has(i.genericId))).length;
      const t = totals[0] || { rx: 0, items: 0, patients: [] };
      res.json({
        ok: true,
        totals: { prescriptions: t.rx || 0, items: t.items || 0, patients: (t.patients || []).filter(Boolean).length },
        antibiotics: { prescriptions: abxRx, of: withItems.length, pct: withItems.length ? Math.round((abxRx / withItems.length) * 100) : 0 },
        topDrugs: topDrugs.map((r) => ({ name: r._id, n: r.n, genericId: r.genericId })).filter((r) => r.name),
        topDiagnoses: topDx.map((r) => ({ name: r._id, n: r.n })),
        byDoctor: byDoctor.map((r) => ({ name: r._id || '(not recorded)', n: r.n })),
        byMonth: byMonth.map((r) => ({ month: r._id, n: r.n })).filter((r) => r.month),
      });
    } catch (e) { fail(res, 'Could not build the prescribing summary.')(e); }
  });

  app.get('/api/med/status', guard, async (req, res) => {
    try {
      const idx = await loadIndex();
      res.json({ ok: true, ready: idx.brands.length > 0, brands: idx.brands.length, generics: idx.generics.length, sourceDate: '2026-09', store: 'cloudflare-d1' });
    } catch (e) { res.json({ ok: true, ready: false, brands: 0, generics: 0, store: 'cloudflare-d1' }); }
  });
}

module.exports = { mount, loadIndex };
