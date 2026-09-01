/* UNICO — Medicine module: the drug index and the prescription store.
 *
 * Two halves that share one vocabulary:
 *   1. THE INDEX (read-mostly reference data, imported by scripts/import-medicines.js)
 *        medGenerics  generic + clinical monograph  — the "medicine info"
 *        medBrands    brand -> generic, strength, form, manufacturer, price
 *        medRefs      drug classes / indications / manufacturers / dosage forms
 *   2. THE PRESCRIPTIONS a clinician writes from it
 *        prescriptions  one document per Rx
 *        rxTemplates    saved drug sets ("URTI adult", "post-op day 1")
 *
 * WHY SEARCH IS BUILT THE WAY IT IS
 * 21.7k brands is far too many to ship to the browser, so every lookup is a server
 * query. The type-ahead runs an ANCHORED regex (/^napa/) against the pre-lowercased
 * nameLower field, which MongoDB can serve straight from the index — an unanchored
 * /napa/ would be a collection scan on every keystroke and is exactly the thing that
 * makes a free-tier cluster fall over. A slower "contains" pass runs only when the
 * prefix pass finds nothing, and the text index backs searching by indication.
 *
 * THE DATA IS A 2022 SNAPSHOT (see the importer). Prices are indicative. Anything a
 * clinician corrects here is stamped edited:true, which is the flag the importer
 * honours so a re-import never overwrites a local correction.
 *
 * CLINICAL SAFETY POSITION
 * checkInteractions() below reports what the monographs say — it is a prompt to look,
 * not a decision. The prescriber remains responsible; the UI says so and the printed
 * Rx carries the source and date.
 */
const { getDbHandle } = require('./db');

const C_GEN = 'medGenerics';
const C_BRAND = 'medBrands';
const C_REF = 'medRefs';
const C_RX = 'prescriptions';
const C_TPL = 'rxTemplates';

async function col(name) { const db = await getDbHandle(); return db ? db.collection(name) : null; }

const s = (v, max) => String(v == null ? '' : v).slice(0, max || 200);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const arr = (v) => (Array.isArray(v) ? v : []);
const norm = (v) => s(v, 200).toLowerCase().replace(/\s+/g, ' ').trim();
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const outDoc = (d) => { if (!d) return null; const { _id, ...r } = d; return Object.assign({ id: _id }, r); };
const who = (req) => (req.user && (req.user.name || req.user.sub)) || 'local';
// A regex built from user input must be escaped, or a stray "(" in the search box
// becomes a syntax error and a ".*" becomes a scan of the whole catalogue.
const rx = (v) => new RegExp('^' + norm(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const rxAny = (v) => new RegExp(norm(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

// The flags travel with every brand row because they are what the UI chips off: a
// stocked/preferred badge, a pregnancy letter, an antibiotic marker, and whether a
// photograph exists. All are tiny scalars — the image BYTES live in medImages.
const BRAND_LIST = { name: 1, strength: 1, form: 1, manufacturer: 1, generic: 1, genericId: 1, type: 1, drugClass: 1, 'price.unit': 1, 'price.unitLabel': 1, pregnancyCategory: 1, abx: 1, stocked: 1, preferred: 1, hasImage: 1 };
const GEN_LIST = { name: 1, drugClass: 1, indication: 1, brands: 1, forms: 1, sections: 1, pregnancyCategory: 1, abx: 1 };

// "Cheapest first", for the 106 brands the source left unpriced.
//
// A plain sort on price.unit puts them at the TOP, because MongoDB orders null before
// every number — so a list captioned "cheapest first" opened with a row reading "—".
// This sorts the priced brands by price and pushes the unpriced ones to the end, where
// "price unknown" belongs.
function byPriceThenName(coll, where, limit) {
  return coll.aggregate([
    { $match: where },
    { $addFields: { _unpriced: { $cond: [{ $in: [{ $type: '$price.unit' }, ['double', 'int', 'long', 'decimal']] }, 0, 1] } } },
    { $sort: { _unpriced: 1, 'price.unit': 1, nameLower: 1 } },
    { $limit: limit },
    { $project: BRAND_LIST },   // inclusion projection, so the _unpriced helper is dropped
  ]).toArray();
}

/* ---- search ------------------------------------------------------------------
 * Prefix first (index-backed, what the user almost always means), then a contains
 * pass, then the text index. Each stage only runs if the previous came up short, so
 * the common case costs one indexed lookup.
 */
async function searchBrands(q, limit, filter) {
  const c = await col(C_BRAND);
  if (!c) return [];
  const base = Object.assign({}, filter || {});
  const run = (where) => c.find(Object.assign({}, base, where)).project(BRAND_LIST).limit(limit).toArray();
  let out = await run({ nameLower: rx(q) });
  if (out.length < limit) {
    const have = new Set(out.map((d) => d._id));
    const more = await run({ genericLower: rx(q) });
    more.forEach((d) => { if (!have.has(d._id) && out.length < limit) { have.add(d._id); out.push(d); } });
  }
  if (out.length < limit && norm(q).length >= 3) {
    const have = new Set(out.map((d) => d._id));
    const more = await run({ nameLower: rxAny(q) });
    more.forEach((d) => { if (!have.has(d._id) && out.length < limit) { have.add(d._id); out.push(d); } });
  }
  return out.map(outDoc);
}

async function searchGenerics(q, limit) {
  const c = await col(C_GEN);
  if (!c) return [];
  let out = await c.find({ nameLower: rx(q) }).project(GEN_LIST).sort({ brands: -1 }).limit(limit).toArray();
  if (out.length < limit && norm(q).length >= 3) {
    const have = new Set(out.map((d) => d._id));
    const more = await c.find({ nameLower: rxAny(q) }).project(GEN_LIST).sort({ brands: -1 }).limit(limit).toArray();
    more.forEach((d) => { if (!have.has(d._id) && out.length < limit) { have.add(d._id); out.push(d); } });
  }
  if (!out.length && norm(q).length >= 3) {
    // Nothing matched a name — the user is probably searching by what it treats
    // ("diabetes", "hypertension"), which is what the text index covers.
    out = await c.find({ $text: { $search: s(q, 80) } }, { projection: Object.assign({ score: { $meta: 'textScore' } }, GEN_LIST) })
      .sort({ score: { $meta: 'textScore' } }).limit(limit).toArray();
  }
  return out.map(outDoc);
}

/* ---- interaction / duplication check -----------------------------------------
 * There is no pairwise interaction table in the source data — what there IS, for
 * 76% of generics, is a monograph "interaction" section naming the drugs and classes
 * it interacts with. So the check is done honestly: for every ordered pair of
 * prescribed generics, look for B's name (or B's drug class) inside A's interaction
 * prose, and quote the sentence that matched so the prescriber can judge it.
 *
 * Short names are excluded from the name scan — "Iron" or "Zinc" appear inside
 * ordinary sentences and would fire on almost every prescription, and a warning
 * that always fires is a warning nobody reads.
 */
const MIN_NAME = 5;

// Bangladeshi generic names carry the salt — "Warfarin Sodium", "Amlodipine Besilate",
// "Cefuroxime Axetil" — but monograph prose names the base drug ("...prolong the
// elimination of diazepam, warfarin and phenytoin"). Matching on the full registered
// name therefore misses the interaction it was written to describe, so the salt is
// stripped before searching. Multi-part esters are stripped repeatedly
// ("Tenofovir Disoproxil Fumarate" -> "Tenofovir").
const SALTS = new Set(['sodium', 'potassium', 'calcium', 'magnesium', 'zinc', 'hydrochloride', 'hydrobromide',
  'hcl', 'sulphate', 'sulfate', 'phosphate', 'nitrate', 'mononitrate', 'dinitrate', 'acetate', 'citrate',
  'tartrate', 'bitartrate', 'fumarate', 'succinate', 'maleate', 'mesylate', 'besilate', 'besylate', 'tosylate',
  'oxalate', 'malate', 'lactate', 'gluconate', 'carbonate', 'bicarbonate', 'chloride', 'bromide', 'iodide',
  'trihydrate', 'dihydrate', 'monohydrate', 'hemihydrate', 'anhydrous', 'base', 'dipropionate', 'propionate',
  'valerate', 'furoate', 'butyrate', 'palmitate', 'stearate', 'pamoate', 'embonate', 'decanoate', 'enanthate',
  'undecanoate', 'axetil', 'proxetil', 'pivoxil', 'disoproxil', 'etexilate', 'aspartate', 'meglumine',
  'monosodium', 'disodium', 'edisylate', 'xinafoate', 'nicotinate', 'orotate', 'trometamol', 'arginine']);
// Words that make a drug-class name specific to nothing. "Oral Anti-coagulants" must
// match prose that says "anticoagulants"; "Drugs used for ..." must not match on "drugs".
const CLASS_NOISE = new Set(['oral', 'topical', 'systemic', 'other', 'others', 'drug', 'drugs', 'agent', 'agents',
  'used', 'for', 'and', 'the', 'in', 'of', 'therapy', 'preparation', 'preparations', 'product', 'products',
  'miscellaneous', 'combination', 'combinations', 'group', 'class', 'related', 'medicine', 'medicines']);

const stripSalt = (name) => {
  let parts = String(name || '').trim().split(/\s+/);
  while (parts.length > 1 && SALTS.has(parts[parts.length - 1].toLowerCase().replace(/[^a-z]/g, ''))) parts.pop();
  return parts.join(' ');
};

// A needle is matched loosely on word joins, because the source writes the same term
// three ways: "Anti-coagulants", "anti coagulants" and "anticoagulants" must all match
// each other, and a trailing plural must not decide whether a warning fires.
function needleRe(phrase) {
  const chunks = String(phrase || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (!chunks.length) return null;
  const last = chunks.length - 1;
  chunks[last] = chunks[last].replace(/s$/, '');
  const body = chunks.map((c, i) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + (i === last ? 's?' : '')).join('[-\\s]?');
  return new RegExp('\\b' + body + '\\b', 'i');
}

// Every term that means "this drug", for searching another drug's interaction prose:
// the registered name, its salt-stripped base, and each component of a combination
// ("Aspirin + Dipyridamole" interacts as Aspirin AND as Dipyridamole).
function nameAliases(name) {
  const out = new Set();
  String(name || '').split(/\s*\+\s*/).forEach((part) => {
    const p = part.trim();
    if (p.length >= MIN_NAME) out.add(p);
    const base = stripSalt(p);
    if (base.length >= MIN_NAME) out.add(base);
  });
  return [...out];
}
function classAliases(cls) {
  const words = String(cls || '').split(/[^A-Za-z0-9-]+/).filter((w) => w && !CLASS_NOISE.has(w.toLowerCase()));
  if (!words.length) return [];
  const phrase = words.join(' ');
  const out = new Set();
  if (phrase.length >= 6) out.add(phrase);
  // The head noun alone ("blockers" out of "Calcium-channel blockers") is too generic,
  // but the full de-noised phrase misses prose that drops a qualifier, so the last two
  // words are kept as a second, still-specific alias.
  if (words.length > 2) { const tail = words.slice(-2).join(' '); if (tail.length >= 8) out.add(tail); }
  return [...out];
}

function sentenceAround(text, re) {
  const m = re.exec(text);
  if (!m) return '';
  const i = m.index;
  let a = text.lastIndexOf('.', i), b = text.indexOf('.', i + m[0].length);
  a = a < 0 ? 0 : a + 1;
  b = b < 0 ? text.length : b + 1;
  return text.slice(a, b).trim().slice(0, 300);
}
// Allergy text is whatever the clerk typed — "Penicillin", "penicillin/sulpha",
// "allergic to NSAIDs". Split it into terms and match each against the drug's name,
// its base name, and its class, using the same loose join rules as the interaction
// scan. This is the check a prescription most needs and the one this data supports
// best: an allergy is a property of the patient, not a claim about the literature.
function checkAllergies(list, allergyText) {
  const raw = String(allergyText || '');
  if (!raw.trim()) return [];
  const NOISE = new Set(['allergic', 'allergy', 'allergies', 'to', 'and', 'or', 'none', 'nil', 'nkda',
    'known', 'drug', 'drugs', 'reaction', 'rash', 'history', 'of', 'patient', 'no', 'not']);
  const terms = raw.split(/[,;/|]+|and|or/i)
    .map((t) => t.replace(/[^A-Za-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim())
    .map((t) => t.split(' ').filter((w) => !NOISE.has(w.toLowerCase())).join(' ').trim())
    .filter((t) => t.length >= 4);
  if (!terms.length) return [];

  const out = [];
  const seen = new Set();
  list.forEach((g) => {
    terms.forEach((term) => {
      const re = needleRe(term);
      if (!re) return;
      // Does the allergy term name this drug, its base, or its class?
      const targets = nameAliases(g.name).concat(g.drugClass ? [g.drugClass] : []);
      const hitTarget = targets.some((t) => re.test(t));
      // ...or does the drug's own contraindications section name it?
      const contra = (g.brief && g.brief.contra) || '';
      const hitContra = !hitTarget && contra && re.test(contra);
      if (!hitTarget && !hitContra) return;
      const key = g.name + '|' + term.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        severity: 'critical', kind: 'allergy',
        title: g.name + ' vs recorded allergy "' + term + '"',
        detail: hitTarget
          ? 'The patient is recorded as allergic to "' + term + '", and ' + g.name
            + (nameAliases(g.name).some((t) => re.test(t)) ? ' is that drug.' : ' belongs to that group (' + g.drugClass + ').')
          : g.name + ' lists "' + term + '" in its contraindications, and the patient is recorded as allergic to it.',
        source: hitContra ? g.name + ' contraindications' : 'patient allergy record',
        generics: [g.name],
      });
    });
  });
  return out;
}

function checkInteractions(generics, allergyText) {
  const warnings = [];
  const list = generics.filter(Boolean);

  // An allergy outranks everything else on the pad, so it is collected first and
  // sorted to the top.
  checkAllergies(list, allergyText).forEach((w) => warnings.push(w));

  // Same generic twice, under any brand — the single most common prescribing slip,
  // and the one this data can detect with certainty.
  const byGeneric = new Map();
  list.forEach((g) => {
    const k = g.id || g._id;
    if (!byGeneric.has(k)) byGeneric.set(k, []);
    byGeneric.get(k).push(g);
  });
  byGeneric.forEach((group, k) => {
    if (group.length > 1) {
      warnings.push({
        severity: 'high', kind: 'duplicate',
        title: 'Same generic prescribed ' + group.length + ' times',
        detail: group[0].name + ' appears ' + group.length + ' times in this prescription. Check this is intentional and that the total daily dose is safe.',
        generics: [group[0].name],
      });
    }
  });

  // Two different generics of the same class is legitimate often enough (two
  // antibiotics, two analgesics by design) that it is flagged as information, not
  // as a warning to be overridden.
  const byClass = new Map();
  [...byGeneric.values()].map((g) => g[0]).forEach((g) => {
    const k = norm(g.drugClass);
    if (!k) return;
    if (!byClass.has(k)) byClass.set(k, []);
    byClass.get(k).push(g.name);
  });
  byClass.forEach((names, k) => {
    if (names.length > 1) {
      warnings.push({
        severity: 'info', kind: 'class',
        title: 'Two drugs of the same class',
        detail: names.join(' and ') + ' are both ' + (byGeneric.size ? '' : '') + k + '. Additive effect — confirm this is intended.',
        generics: names,
      });
    }
  });

  const uniq = [...byGeneric.values()].map((g) => g[0]);
  for (let i = 0; i < uniq.length; i++) {
    for (let j = 0; j < uniq.length; j++) {
      if (i === j) continue;
      const a = uniq[i], b = uniq[j];
      const text = (a.brief && a.brief.interaction) || '';
      if (!text) continue;
      // A name match is the drug itself being named; a class match is the group it
      // belongs to being named. The first is specific, so it is tried first and is
      // what the warning quotes when both would fire.
      let re = null, byName = false;
      for (const alias of nameAliases(b.name)) {
        const r = needleRe(alias);
        if (r && r.test(text)) { re = r; byName = true; break; }
      }
      if (!re) {
        for (const alias of classAliases(b.drugClass)) {
          const r = needleRe(alias);
          if (r && r.test(text)) { re = r; break; }
        }
      }
      if (!re) continue;
      // Both directions of the same pair describe one interaction; keep the first, but
      // let a later name-level match replace an earlier class-level one.
      const key = [a.name, b.name].sort().join('|');
      const prior = warnings.findIndex((w) => w.kind === 'interaction' && w.key === key);
      if (prior >= 0 && !(byName && !warnings[prior].byName)) continue;
      const entry = {
        severity: 'high', kind: 'interaction', key, byName,
        title: a.name + ' + ' + b.name,
        detail: sentenceAround(text, re) || (a.name + ' lists ' + b.name + ' among its interactions.'),
        source: a.name + ' monograph' + (byName ? '' : ' (matched on drug class “' + b.drugClass + '”)'),
        generics: [a.name, b.name],
      };
      if (prior >= 0) warnings[prior] = entry; else warnings.push(entry);
    }
  }
  const rank = { critical: 0, high: 1, info: 2 };
  return warnings.sort((x, y) => rank[x.severity] - rank[y.severity]);
}

/* ---- prescriptions ------------------------------------------------------------ */
const RX_STATUS = ['draft', 'issued', 'cancelled'];

// One prescribed line. Bounded on every axis: a prescription is printed on one page
// and a payload that does not fit that is a bug or an attack, not a prescription.
function normItem(it) {
  const i = obj(it);
  return {
    brandId: s(i.brandId, 40),
    brand: s(i.brand, 120),
    genericId: s(i.genericId, 40),
    generic: s(i.generic, 200),
    strength: s(i.strength, 80),
    form: s(i.form, 60),
    dose: s(i.dose, 60),          // "1 tab", "5 ml"
    frequency: s(i.frequency, 60), // "1+0+1", "TDS"
    timing: s(i.timing, 60),       // "After meal"
    duration: s(i.duration, 60),   // "7 days"
    quantity: s(i.quantity, 40),
    instruction: s(i.instruction, 300),
  };
}

function normRx(input, prev0) {
  const i = obj(input), prev = obj(prev0);
  const status = RX_STATUS.indexOf(s(i.status)) >= 0 ? s(i.status) : (prev.status || 'draft');
  return {
    // patient
    uhid: s(i.uhid, 40),
    patientName: s(i.patientName, 120),
    age: s(i.age, 30),
    sex: s(i.sex, 20),
    weight: s(i.weight, 20),
    phone: s(i.phone, 30),
    address: s(i.address, 200),
    allergies: s(i.allergies, 300),
    // clinical
    date: s(i.date, 20) || prev.date || new Date().toISOString().slice(0, 10),
    dept: s(i.dept, 60),
    deptName: s(i.deptName, 120),
    complaints: s(i.complaints, 1500),
    findings: s(i.findings, 1500),
    diagnosis: s(i.diagnosis, 1000),
    investigations: s(i.investigations, 1500),
    advice: s(i.advice, 1500),
    followUp: s(i.followUp, 120),
    items: arr(i.items).slice(0, 40).map(normItem).filter((x) => x.brand || x.generic),
    // prescriber
    doctorId: s(i.doctorId, 40),
    doctorName: s(i.doctorName, 120),
    doctorQualification: s(i.doctorQualification, 200),
    doctorDesignation: s(i.doctorDesignation, 120),
    doctorReg: s(i.doctorReg, 60),
    status,
    // The warnings shown at the moment of signing are stored with the Rx: a later
    // monograph edit must not change what the prescriber was actually told.
    warnings: arr(i.warnings).slice(0, 30).map((w) => ({
      severity: s(obj(w).severity, 10), kind: s(obj(w).kind, 20),
      title: s(obj(w).title, 200), detail: s(obj(w).detail, 400),
    })),
    acknowledged: !!i.acknowledged,
  };
}

const rxId = () => 'rx-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

/* ---- routes -------------------------------------------------------------------- */
function mount(app, opts) {
  const guard = (opts && opts.requireApi) || function (req, res, next) { next(); };
  const noDb = (res) => res.status(503).json({ ok: false, error: 'The medicine database is not available.' });
  // Correcting the shared drug catalogue is a different act from writing a
  // prescription: one clinician's edit is seen by everyone, so it is admin-only.
  const adminOnly = (req, res, next) => {
    if (req.access && !req.access.unrestricted) return res.status(403).json({ ok: false, error: 'Administrator access required to edit the drug catalogue.' });
    next();
  };
  const fail = (res, msg) => (e) => res.status(500).json({ ok: false, error: msg });

  /* --- index ------------------------------------------------------------------ */

  // Type-ahead. Returns brands and generics together because a prescriber types
  // whichever they happen to know ("Napa" or "Paracetamol").
  app.get('/api/med/search', guard, async (req, res) => {
    try {
      const q = s(req.query.q, 80).trim();
      if (!q) return res.json({ ok: true, brands: [], generics: [] });
      const limit = Math.min(parseInt(req.query.limit, 10) || 15, 50);
      const kind = s(req.query.kind, 20);
      const filter = {};
      if (s(req.query.type, 20)) filter.type = s(req.query.type, 20);
      if (s(req.query.form, 60)) filter.form = s(req.query.form, 60);
      // "Only what we stock" — the single most useful narrowing when prescribing, and
      // the reason the formulary flag exists at all.
      if (s(req.query.stocked, 10) === '1') filter.stocked = true;
      const [brands, generics] = await Promise.all([
        kind === 'generic' ? [] : searchBrands(q, limit, filter),
        kind === 'brand' ? [] : searchGenerics(q, Math.min(limit, 12)),
      ]);
      res.json({ ok: true, brands, generics });
    } catch (e) { fail(res, 'Search failed.')(e); }
  });

  // Browse the index: by first letter, class, indication, manufacturer or form.
  // This is the "flip through DIMS" view, so it pages rather than truncating.
  app.get('/api/med/browse', guard, async (req, res) => {
    try {
      const c = await col(req.query.kind === 'generic' ? C_GEN : C_BRAND);
      if (!c) return noDb(res);
      const isGen = req.query.kind === 'generic';
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const per = Math.min(parseInt(req.query.per, 10) || 50, 200);
      const where = {};
      const letter = s(req.query.letter, 2).toLowerCase();
      if (letter) where.nameLower = new RegExp('^' + letter.replace(/[^a-z0-9]/g, ''));
      if (s(req.query.class, 120)) where.drugClass = s(req.query.class, 120);
      if (!isGen) {
        if (s(req.query.mfr, 160)) where.manufacturerLower = norm(req.query.mfr);
        if (s(req.query.form, 60)) where.form = s(req.query.form, 60);
        if (s(req.query.type, 20)) where.type = s(req.query.type, 20);
        if (s(req.query.genericId, 40)) where.genericId = s(req.query.genericId, 40);
        // Formulary narrowing. This lives here as well as on /search because browsing
        // is how the pharmacy reviews the stocked list, and without it the filter
        // silently returned the whole 21.7k index.
        if (s(req.query.stocked, 10) === '1') where.stocked = true;
        if (s(req.query.abx, 10) === '1') where.abx = true;
        if (s(req.query.hasImage, 10) === '1') where.hasImage = true;
      } else if (s(req.query.indication, 160)) {
        where.indication = s(req.query.indication, 160);
      }
      const [rows, total] = await Promise.all([
        c.find(where).project(isGen ? GEN_LIST : BRAND_LIST)
          .sort(isGen ? { brands: -1, nameLower: 1 } : { nameLower: 1 })
          .skip((page - 1) * per).limit(per).toArray(),
        c.countDocuments(where),
      ]);
      res.json({ ok: true, rows: rows.map(outDoc), total, page, per, pages: Math.ceil(total / per) });
    } catch (e) { fail(res, 'Could not browse the index.')(e); }
  });

  // One brand, with the generic's monograph attached — a brand page IS its generic's
  // clinical information, which is the whole point of a drug index.
  app.get('/api/med/brand/:id', guard, async (req, res) => {
    try {
      const c = await col(C_BRAND);
      if (!c) return noDb(res);
      const brand = await c.findOne({ _id: s(req.params.id, 40) });
      if (!brand) return res.status(404).json({ ok: false, error: 'Brand not found.' });
      let generic = null, alternatives = [];
      if (brand.genericId) {
        const gc = await col(C_GEN);
        generic = await gc.findOne({ _id: brand.genericId });
        alternatives = await byPriceThenName(c, { genericId: brand.genericId, _id: { $ne: brand._id } }, 60);
      }
      res.json({ ok: true, brand: outDoc(brand), generic: outDoc(generic), alternatives: alternatives.map(outDoc) });
    } catch (e) { fail(res, 'Could not load the brand.')(e); }
  });

  // One generic: the full monograph plus the brands that carry it, cheapest first
  // (the substitution list a prescriber actually needs).
  app.get('/api/med/generic/:id', guard, async (req, res) => {
    try {
      const gc = await col(C_GEN);
      if (!gc) return noDb(res);
      const id = s(req.params.id, 40);
      const generic = await gc.findOne(id.indexOf('gen-') === 0 ? { _id: id } : { nameLower: norm(id) });
      if (!generic) return res.status(404).json({ ok: false, error: 'Generic not found.' });
      const bc = await col(C_BRAND);
      const brands = await byPriceThenName(bc, { genericId: generic._id }, 300);
      res.json({ ok: true, generic: outDoc(generic), brands: brands.map(outDoc) });
    } catch (e) { fail(res, 'Could not load the generic.')(e); }
  });

  // Reference lists for the browse filters. Small and static, so the client caches it.
  app.get('/api/med/refs', guard, async (req, res) => {
    try {
      const c = await col(C_REF);
      if (!c) return noDb(res);
      const kind = s(req.query.kind, 20);
      const where = kind ? { kind } : {};
      const rows = await c.find(where).project({ kind: 1, name: 1, count: 1 })
        .sort({ count: -1, nameLower: 1 }).limit(3000).toArray();
      // The source lists 453 drug classes but only 421 distinct NAMES — 20 names carry
      // several ids ("Proton Pump Inhibitor" appears five times). Browsing filters by
      // name, so every copy returns the identical result set; merged here, the filter
      // dropdown stops showing the same class five times over.
      const merged = new Map();
      rows.forEach((r) => {
        const key = r.kind + '|' + norm(r.name);
        const hit = merged.get(key);
        if (hit) hit.count += (r.count || 0);
        else merged.set(key, { id: r._id, kind: r.kind, name: r.name, count: r.count || 0 });
      });
      res.json({ ok: true, refs: [...merged.values()].sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name)) });
    } catch (e) { fail(res, 'Could not load reference lists.')(e); }
  });

  // Correct a brand (price, strength, availability) or a generic's monograph. The
  // edited:true stamp is what stops the next import overwriting the correction.
  app.put('/api/med/brand/:id', guard, adminOnly, async (req, res) => {
    try {
      const c = await col(C_BRAND);
      if (!c) return noDb(res);
      const b = obj(req.body);
      const patch = { edited: true, editedBy: who(req), editedAt: Date.now() };
      ['name', 'strength', 'form', 'manufacturer', 'generic', 'type', 'note'].forEach((k) => {
        if (b[k] != null) patch[k] = s(b[k], 200);
      });
      if (patch.name) patch.nameLower = norm(patch.name);
      if (patch.manufacturer) patch.manufacturerLower = norm(patch.manufacturer);
      if (b.price != null) {
        const p = obj(b.price);
        patch.price = {
          raw: s(p.raw, 300), unit: num(p.unit), unitLabel: s(p.unitLabel, 80),
          packs: arr(p.packs).slice(0, 10).map((x) => ({ label: s(obj(x).label, 60), price: num(obj(x).price) })),
          updatedAt: Date.now(),
        };
      }
      if (b.discontinued != null) patch.discontinued = !!b.discontinued;
      const r = await c.updateOne({ _id: s(req.params.id, 40) }, { $set: patch });
      if (!r.matchedCount) return res.status(404).json({ ok: false, error: 'Brand not found.' });
      res.json({ ok: true, brand: outDoc(await c.findOne({ _id: s(req.params.id, 40) })) });
    } catch (e) { fail(res, 'Could not save the brand.')(e); }
  });

  app.put('/api/med/generic/:id', guard, adminOnly, async (req, res) => {
    try {
      const c = await col(C_GEN);
      if (!c) return noDb(res);
      const b = obj(req.body);
      const patch = { edited: true, editedBy: who(req), editedAt: Date.now() };
      ['name', 'drugClass', 'indication'].forEach((k) => { if (b[k] != null) patch[k] = s(b[k], 200); });
      if (patch.name) patch.nameLower = norm(patch.name);
      if (b.monograph != null) {
        const m = obj(b.monograph), out = {};
        Object.keys(m).slice(0, 25).forEach((k) => { const v = s(m[k], 20000); if (v) out[s(k, 40)] = v; });
        patch.monograph = out;
        patch.sections = Object.keys(out).length;
      }
      const r = await c.updateOne({ _id: s(req.params.id, 40) }, { $set: patch });
      if (!r.matchedCount) return res.status(404).json({ ok: false, error: 'Generic not found.' });
      res.json({ ok: true, generic: outDoc(await c.findOne({ _id: s(req.params.id, 40) })) });
    } catch (e) { fail(res, 'Could not save the generic.')(e); }
  });

  // Add a brand the 2022 snapshot never had. Kept separate from the import id space
  // so a later re-import cannot collide with it.
  app.post('/api/med/brand', guard, adminOnly, async (req, res) => {
    try {
      const c = await col(C_BRAND);
      if (!c) return noDb(res);
      const b = obj(req.body);
      const name = s(b.name, 120).trim();
      if (!name) return res.status(400).json({ ok: false, error: 'A brand name is required.' });
      const gc = await col(C_GEN);
      const gen = s(b.genericId, 40) ? await gc.findOne({ _id: s(b.genericId, 40) }) : null;
      const doc = {
        _id: 'local-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
        name, nameLower: norm(name),
        type: s(b.type, 20) || 'allopathic',
        form: s(b.form, 60),
        generic: gen ? gen.name : s(b.generic, 200),
        genericId: gen ? gen._id : '',
        genericLower: norm(gen ? gen.name : b.generic),
        strength: s(b.strength, 80),
        manufacturer: s(b.manufacturer, 160), manufacturerLower: norm(b.manufacturer),
        drugClass: gen ? gen.drugClass : '',
        price: { raw: '', unit: num(obj(b.price).unit), unitLabel: s(obj(b.price).unitLabel, 80), packs: [] },
        edited: true, source: 'local', createdBy: who(req), createdAt: Date.now(),
      };
      await c.insertOne(doc);
      res.json({ ok: true, brand: outDoc(doc) });
    } catch (e) { fail(res, 'Could not add the brand.')(e); }
  });

  /* --- safety check ------------------------------------------------------------ */

  // Given the generic ids on the pad, return what the monographs say about mixing
  // them. Called as the prescription is built, and again before it is issued.
  app.post('/api/med/check', guard, async (req, res) => {
    try {
      const ids = arr(obj(req.body).genericIds).slice(0, 40).map((x) => s(x, 40)).filter(Boolean);
      const allergies = s(obj(req.body).allergies, 300);
      if (!ids.length) return res.json({ ok: true, warnings: [] });
      const c = await col(C_GEN);
      if (!c) return noDb(res);
      const rows = await c.find({ _id: { $in: [...new Set(ids)] } })
        .project({ name: 1, drugClass: 1, 'brief.interaction': 1, 'brief.contra': 1, 'brief.pregnancy': 1 }).toArray();
      const byId = new Map(rows.map((r) => [r._id, outDoc(r)]));
      // Rebuild in the order given, repeats included, so duplicates are detectable.
      const list = ids.map((id) => byId.get(id)).filter(Boolean);
      res.json({ ok: true, warnings: checkInteractions(list, allergies) });
    } catch (e) { fail(res, 'Could not run the interaction check.')(e); }
  });

  /* --- brand images --------------------------------------------------------------
   * There is NO open-licensed photograph set for Bangladeshi brands: the CC0 index
   * carries no image column, MedEx's pack photos are copyrighted, and the public-domain
   * NLM pill images are US products matched by NDC — showing a US tablet next to a
   * Beximco strip would be worse than showing nothing, because the whole point of a
   * drug photograph is identification.
   *
   * So images are the hospital's OWN: the pharmacy photographs the strip or pack and
   * uploads it. The browser resizes to a bounded JPEG before sending, so what arrives
   * is tens of kilobytes, and it is kept in its own collection — a brand list query
   * must never drag image bytes along with it.
   */
  const IMG_MAX = 400 * 1024;   // after the client-side resize; a generous ceiling
  const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  app.put('/api/med/brand/:id/image', guard, adminOnly, async (req, res) => {
    try {
      const db = await getDbHandle();
      if (!db) return noDb(res);
      const id = s(req.params.id, 40);
      const brand = await db.collection(C_BRAND).findOne({ _id: id }, { projection: { name: 1 } });
      if (!brand) return res.status(404).json({ ok: false, error: 'Brand not found.' });

      const dataUri = String(obj(req.body).image || '');
      const m = dataUri.match(/^data:([a-z/+-]+);base64,([A-Za-z0-9+/=]+)$/i);
      if (!m) return res.status(400).json({ ok: false, error: 'Send the image as a base64 data URI.' });
      if (IMG_TYPES.indexOf(m[1].toLowerCase()) < 0) return res.status(400).json({ ok: false, error: 'JPEG, PNG or WebP only.' });
      const buf = Buffer.from(m[2], 'base64');
      if (!buf.length) return res.status(400).json({ ok: false, error: 'The image is empty.' });
      if (buf.length > IMG_MAX) return res.status(413).json({ ok: false, error: 'Image too large - it must be under ' + Math.round(IMG_MAX / 1024) + ' KB after resizing.' });

      await db.collection('medImages').updateOne({ _id: id }, {
        $set: {
          brandId: id, brandName: brand.name, mime: m[1].toLowerCase(),
          bytes: buf.length, data: buf,
          caption: s(obj(req.body).caption, 160),
          updatedAt: Date.now(), updatedBy: who(req),
        },
      }, { upsert: true });
      // A flag on the brand, so a list can show which rows have a photo without
      // reading the image collection at all.
      await db.collection(C_BRAND).updateOne({ _id: id }, { $set: { hasImage: true } });
      res.json({ ok: true, bytes: buf.length });
    } catch (e) { fail(res, 'Could not save the image.')(e); }
  });

  app.delete('/api/med/brand/:id/image', guard, adminOnly, async (req, res) => {
    try {
      const db = await getDbHandle();
      if (!db) return noDb(res);
      const id = s(req.params.id, 40);
      await db.collection('medImages').deleteOne({ _id: id });
      await db.collection(C_BRAND).updateOne({ _id: id }, { $unset: { hasImage: '' } });
      res.json({ ok: true });
    } catch (e) { fail(res, 'Could not remove the image.')(e); }
  });

  // Served as real image bytes, not JSON, so an <img src> can point straight at it and
  // the browser caches it like any other picture.
  app.get('/api/med/image/:id', guard, async (req, res) => {
    try {
      const db = await getDbHandle();
      if (!db) return res.status(404).end();
      const doc = await db.collection('medImages').findOne({ _id: s(req.params.id, 40) });
      if (!doc || !doc.data) return res.status(404).end();
      const buf = doc.data.buffer ? Buffer.from(doc.data.buffer) : Buffer.from(doc.data);
      const tag = '"' + (doc.updatedAt || 0) + '"';
      res.setHeader('Content-Type', doc.mime || 'image/jpeg');
      res.setHeader('Cache-Control', 'private, max-age=86400');
      res.setHeader('ETag', tag);
      if (req.headers['if-none-match'] === tag) return res.status(304).end();
      res.send(buf);
    } catch (e) { res.status(404).end(); }
  });

  /* --- hospital formulary ---------------------------------------------------------
   * Which of the 21.7k brands this hospital actually stocks, and which is the agreed
   * first choice. Kept as its own fields (never touched by the importer) because it is
   * a local operational decision, not catalogue data.
   */
  app.put('/api/med/brand/:id/formulary', guard, adminOnly, async (req, res) => {
    try {
      const c = await col(C_BRAND);
      if (!c) return noDb(res);
      const b = obj(req.body);
      const patch = { formularyBy: who(req), formularyAt: Date.now() };
      if (b.stocked != null) patch.stocked = !!b.stocked;
      if (b.preferred != null) patch.preferred = !!b.preferred;
      if (b.formularyNote != null) patch.formularyNote = s(b.formularyNote, 200);
      const r = await c.updateOne({ _id: s(req.params.id, 40) }, { $set: patch });
      if (!r.matchedCount) return res.status(404).json({ ok: false, error: 'Brand not found.' });
      res.json({ ok: true, brand: outDoc(await c.findOne({ _id: s(req.params.id, 40) })) });
    } catch (e) { fail(res, 'Could not update the formulary.')(e); }
  });

  app.get('/api/med/formulary', guard, async (req, res) => {
    try {
      const c = await col(C_BRAND);
      if (!c) return noDb(res);
      const proj = Object.assign({ preferred: 1, formularyNote: 1, stocked: 1, hasImage: 1 }, BRAND_LIST);
      const rows = await c.find({ stocked: true }).project(proj).sort({ nameLower: 1 }).limit(2000).toArray();
      res.json({ ok: true, rows: rows.map(outDoc), total: rows.length });
    } catch (e) { fail(res, 'Could not load the formulary.')(e); }
  });

  /* --- prescribing analytics -------------------------------------------------------
   * This app is a statistics suite, so what it should say about prescribing is what it
   * says about everything else: counts, over a period, that somebody can act on.
   * Antibiotic share is here because it is the standing stewardship question.
   */
  app.get('/api/med/analytics', guard, async (req, res) => {
    try {
      const c = await col(C_RX);
      if (!c) return noDb(res);
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

      // Antibiotic share: how many prescriptions contain at least one antibiotic. The
      // flag lives on the generic, so the prescribed generic ids are looked up rather
      // than guessed from the drug name.
      const gc = await col(C_GEN);
      const abxIds = new Set((await gc.find({ abx: true }).project({ _id: 1 }).toArray()).map((d) => d._id));
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

  /* --- prescriptions ------------------------------------------------------------ */

  app.get('/api/prescriptions', guard, async (req, res) => {
    try {
      const c = await col(C_RX);
      if (!c) return noDb(res);
      const where = {};
      if (s(req.query.uhid, 40)) where.uhid = s(req.query.uhid, 40);
      if (s(req.query.doctorId, 40)) where.doctorId = s(req.query.doctorId, 40);
      if (s(req.query.status, 20)) where.status = s(req.query.status, 20);
      if (s(req.query.from, 20) || s(req.query.to, 20)) {
        where.date = {};
        if (s(req.query.from, 20)) where.date.$gte = s(req.query.from, 20);
        if (s(req.query.to, 20)) where.date.$lte = s(req.query.to, 20);
      }
      const q = s(req.query.q, 80).trim();
      if (q) where.$or = [{ patientName: rxAny(q) }, { uhid: rxAny(q) }, { diagnosis: rxAny(q) }];
      const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
      // The list screen shows who/when/what-for; the items are only needed when one
      // is opened, and 40 lines per Rx across 500 rows is a payload nobody reads.
      const rows = await c.find(where)
        .project({ uhid: 1, patientName: 1, age: 1, sex: 1, date: 1, diagnosis: 1, status: 1, doctorName: 1, deptName: 1, items: { $slice: 3 }, itemCount: 1, updatedAt: 1 })
        .sort({ date: -1, updatedAt: -1 }).limit(limit).toArray();
      res.json({ ok: true, prescriptions: rows.map(outDoc) });
    } catch (e) { fail(res, 'Could not load prescriptions.')(e); }
  });

  app.get('/api/prescriptions/:id', guard, async (req, res) => {
    try {
      const c = await col(C_RX);
      if (!c) return noDb(res);
      const doc = await c.findOne({ _id: s(req.params.id, 60) });
      if (!doc) return res.status(404).json({ ok: false, error: 'Prescription not found.' });
      res.json({ ok: true, prescription: outDoc(doc) });
    } catch (e) { fail(res, 'Could not load the prescription.')(e); }
  });

  app.put('/api/prescriptions', guard, async (req, res) => {
    try {
      const c = await col(C_RX);
      if (!c) return noDb(res);
      const b = obj(req.body);
      const id = s(b.id, 60);
      const existing = id ? await c.findOne({ _id: id }) : null;
      if (id && !existing) return res.status(404).json({ ok: false, error: 'Prescription not found.' });
      // An issued prescription is a clinical record that has left the building — it
      // is cancelled and rewritten, never silently edited.
      if (existing && existing.status === 'issued' && s(b.status) !== 'cancelled') {
        return res.status(409).json({ ok: false, error: 'This prescription has been issued. Cancel it and write a new one instead of editing it.' });
      }
      if (!s(b.patientName).trim()) return res.status(400).json({ ok: false, error: 'A patient name is required.' });
      const doc = normRx(b, existing);
      doc.itemCount = doc.items.length;
      doc.updatedAt = Date.now();
      doc.updatedBy = who(req);
      doc.revision = ((existing && existing.revision) || 0) + 1;
      if (doc.status === 'issued' && (!existing || existing.status !== 'issued')) {
        doc.issuedAt = Date.now();
        doc.issuedBy = who(req);
      }
      const key = id || rxId();
      if (!existing) { doc.createdAt = Date.now(); doc.createdBy = who(req); }
      await c.updateOne({ _id: key }, { $set: doc }, { upsert: true });
      res.json({ ok: true, prescription: outDoc(await c.findOne({ _id: key })) });
    } catch (e) { fail(res, 'Could not save the prescription.')(e); }
  });

  app.delete('/api/prescriptions/:id', guard, adminOnly, async (req, res) => {
    try {
      const c = await col(C_RX);
      if (!c) return noDb(res);
      const r = await c.deleteOne({ _id: s(req.params.id, 60) });
      res.json({ ok: r.deletedCount > 0 });
    } catch (e) { fail(res, 'Could not delete the prescription.')(e); }
  });

  /* --- templates ---------------------------------------------------------------- */

  app.get('/api/rx-templates', guard, async (req, res) => {
    try {
      const c = await col(C_TPL);
      if (!c) return noDb(res);
      const rows = await c.find({}).sort({ name: 1 }).limit(300).toArray();
      res.json({ ok: true, templates: rows.map(outDoc) });
    } catch (e) { fail(res, 'Could not load templates.')(e); }
  });

  app.put('/api/rx-templates', guard, async (req, res) => {
    try {
      const c = await col(C_TPL);
      if (!c) return noDb(res);
      const b = obj(req.body);
      const name = s(b.name, 120).trim();
      if (!name) return res.status(400).json({ ok: false, error: 'A template name is required.' });
      const id = s(b.id, 60) || 'tpl-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
      const doc = {
        name,
        note: s(b.note, 300),
        diagnosis: s(b.diagnosis, 300),
        advice: s(b.advice, 1500),
        investigations: s(b.investigations, 1500),
        items: arr(b.items).slice(0, 40).map(normItem),
        updatedAt: Date.now(), updatedBy: who(req),
      };
      await c.updateOne({ _id: id }, { $set: doc, $setOnInsert: { createdAt: Date.now(), createdBy: who(req) } }, { upsert: true });
      res.json({ ok: true, template: outDoc(await c.findOne({ _id: id })) });
    } catch (e) { fail(res, 'Could not save the template.')(e); }
  });

  app.delete('/api/rx-templates/:id', guard, async (req, res) => {
    try {
      const c = await col(C_TPL);
      if (!c) return noDb(res);
      const r = await c.deleteOne({ _id: s(req.params.id, 60) });
      res.json({ ok: r.deletedCount > 0 });
    } catch (e) { fail(res, 'Could not delete the template.')(e); }
  });

  // Whether the index has actually been imported. The UI uses this to show the
  // "run the importer" message instead of an empty search box that looks broken.
  app.get('/api/med/status', guard, async (req, res) => {
    try {
      const c = await col(C_BRAND);
      if (!c) return res.json({ ok: true, ready: false, brands: 0, generics: 0 });
      const [brands, generics] = await Promise.all([
        c.estimatedDocumentCount(),
        (await col(C_GEN)).estimatedDocumentCount(),
      ]);
      res.json({ ok: true, ready: brands > 0, brands, generics, sourceDate: '2022-07-24' });
    } catch (e) { res.json({ ok: true, ready: false, brands: 0, generics: 0 }); }
  });
}

module.exports = { mount, checkInteractions, checkAllergies, normRx, normItem, C_GEN, C_BRAND, C_REF, C_RX, C_TPL };
