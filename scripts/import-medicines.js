/* UNICO — Bangladesh medicine index importer.
 *
 * Builds the drug database that the Medicine module (drug index + prescription
 * writer) reads: every brand sold in Bangladesh, the generic behind it, and the
 * generic's clinical monograph.
 *
 * SOURCE AND WHY THIS ONE
 * MedEx and DIMS are the familiar indexes, but their content is copyrighted and
 * cannot be copied into this app. The data here comes from the "Assorted Medicine
 * Dataset of Bangladesh" (ahmedshahriarsakib on Kaggle, produced by the open
 * bd-medicine-scraper project), which is published under CC0 — public domain, so
 * it may be redistributed inside a hospital system without restriction.
 *   dataset : https://www.kaggle.com/datasets/ahmedshahriarsakib/assorted-medicine-dataset-of-bangladesh
 *   scraper : https://github.com/ahmedshahriar/bd-medicine-scraper
 *
 * THE SNAPSHOT IS DATED. It was captured 2022-07-24, so PRICES ARE INDICATIVE, NOT
 * CURRENT, and brands registered since then are missing. Every imported document
 * carries `source` and `sourceDate` so the UI can say so out loud, and every field
 * stays editable in the app — a pharmacist correcting a price must never be
 * overwritten by a re-import, which is why re-running this script skips documents
 * marked `edited` (see --force).
 *
 * COLLECTIONS WRITTEN
 *   medGenerics  ~1.7k   generic + 15-section monograph (the "medicine info")
 *   medBrands    ~21.7k  brand -> generic, strength, form, manufacturer, pack price
 *   medRefs      ~0.8k   drug classes / indications / manufacturers / dosage forms
 *
 * FULLY OFFLINE
 * The six source CSVs are VENDORED in scripts/data/bdmed/ and committed, so rebuilding
 * the drug database needs no internet at all — which matters for a hospital PC that
 * may have none. Nothing in the running app ever calls out either: the server reads
 * only MongoDB, and the renderer only this server. The one network path in the whole
 * module is --download, and it must be asked for explicitly.
 *
 * RUN
 *   node scripts/import-medicines.js            # import the vendored CSVs (offline)
 *   node scripts/import-medicines.js --dry      # parse and report, write nothing
 *   node scripts/import-medicines.js --verify   # check the CSVs against MANIFEST.md
 *   node scripts/import-medicines.js --dir <p>  # use CSVs from somewhere else
 *   node scripts/import-medicines.js --force    # also overwrite locally edited docs
 *   node scripts/import-medicines.js --download # re-fetch the snapshot (NEEDS INTERNET)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execFileSync } = require('child_process');

require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });

const ARGV = process.argv.slice(2);
const has = (f) => ARGV.indexOf(f) >= 0;
const argOf = (f) => { const i = ARGV.indexOf(f); return i >= 0 ? ARGV[i + 1] : null; };

const DRY = has('--dry');
const FORCE = has('--force');
const DATA_DIR = argOf('--dir') || path.join(__dirname, 'data', 'bdmed');
const ZIP_URL = 'https://www.kaggle.com/api/v1/datasets/download/ahmedshahriarsakib/assorted-medicine-dataset-of-bangladesh';
const SOURCE = 'kaggle:assorted-medicine-dataset-of-bangladesh (CC0)';
const SOURCE_DATE = '2022-07-24';

const FILES = ['medicine.csv', 'generic.csv', 'drug class.csv', 'indication.csv', 'manufacturer.csv', 'dosage form.csv'];

/* ---- CSV ---------------------------------------------------------------------
 * The monograph columns are multi-line HTML with embedded commas and doubled
 * quotes, so line-splitting is not an option: this is a real quoted-field parser.
 */
function parseCSV(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); cur = ''; rows.push(row); row = []; }
    else if (c !== '\r') cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
function readCsv(file) {
  const rows = parseCSV(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
  const head = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.length > 1).map((r) => {
    const o = {};
    head.forEach((h, i) => { o[h] = (r[i] == null ? '' : r[i]); });
    return o;
  });
}

/* ---- HTML sanitiser ----------------------------------------------------------
 * The scraped monographs are MedEx page fragments: a <div class="ac-body"> wrapper
 * around otherwise plain formatting. We keep the formatting (a dosage section is
 * unreadable as one run-on paragraph) but drop every tag outside the whitelist and
 * EVERY attribute — no class, no style, no src, no event handlers. That both
 * strips the source site's styling hooks and makes the HTML safe to render.
 * The single <img> in the whole dataset points at the source site, so it goes too.
 */
const KEEP = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'sup', 'sub', 'h4', 'h5', 'table', 'thead', 'tbody', 'tr', 'td', 'th'];
function sanitize(html) {
  let s = String(html == null ? '' : html);
  if (!s.trim()) return '';
  s = s.replace(/<\s*(script|style|svg|iframe)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  s = s.replace(/<\s*img[^>]*>/gi, '');
  // <div> carried the styling hooks and nested up to three deep; a line break reads
  // the same and cannot re-introduce a layout.
  s = s.replace(/<\s*div[^>]*>/gi, '').replace(/<\s*\/\s*div\s*>/gi, '<br>');
  s = s.replace(/<\s*(\/?)\s*([a-zA-Z0-9]+)(\s[^>]*)?\/?\s*>/g, (m, slash, tag) => {
    const t = tag.toLowerCase();
    if (KEEP.indexOf(t) < 0) return '';
    if (t === 'br') return '<br>';
    return slash ? '</' + t + '>' : '<' + t + '>';
  });
  s = s.replace(/(<br>\s*){3,}/gi, '<br><br>');
  s = s.replace(/^(?:\s|<br>)+/i, '').replace(/(?:\s|<br>)+$/i, '');
  return s.replace(/[ \t]+/g, ' ').trim();
}
// Plain text of a monograph section — what the prescription screen's drug notes
// use, where markup would be noise.
const plain = (html) => sanitize(html)
  .replace(/<\/(p|li|h4|h5|tr)>/gi, ' ')
  .replace(/<br>/gi, ' ')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  .replace(/\s+/g, ' ').trim();

const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();
const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

/* ---- fields derived from the prose ------------------------------------------
 * The source has no structured pregnancy or antibiotic field, but both are stated
 * plainly enough in the text to lift out — and both are things a prescriber wants as
 * a glanceable flag rather than a paragraph to read.
 */

// "Pregnancy Category B according to USFDA" -> "B". Stated in 463 of 1711 monographs;
// the rest get NO category rather than a guessed one, because a wrong pregnancy
// category is worse than an absent one.
function pregnancyCategory(html) {
  const t = plain(html);
  const m = t.match(/pregnancy\s*categor(?:y|ies)\s*[:\-]?\s*([ABCDX])\b/i);
  if (m) return m[1].toUpperCase();
  // The other phrasing the source uses: "US FDA pregnancy category: C".
  const m2 = t.match(/\bcategory\s+([ABCDX])\b(?=[^.]*\bpregnan)/i);
  return m2 ? m2[1].toUpperCase() : '';
}

// Antibiotic stewardship is a standing hospital quality concern, so antibacterials are
// flagged from their drug class. Deliberately EXCLUDES antivirals, antifungals and
// antiprotozoals — "antimicrobial" is not "antibiotic", and a stewardship count that
// silently folds them in is a wrong number.
const ABX_CLASS = /antibiotic|antibacterial|penicillin|cephalosporin|quinolone|macrolide|aminoglycoside|tetracycline|carbapenem|sulfonamide|sulphonamide|glycopeptide|lincosamide|oxazolidinone|monobactam|nitroimidazole|chloramphenicol/i;
const isAntibiotic = (drugClass) => ABX_CLASS.test(String(drugClass || ''));

/* ---- prices ------------------------------------------------------------------
 * "package container" is one string holding the unit price and any pack prices:
 *   "Unit Price: Tk 5.98,(100's pack: Tk 598.00),"
 *   "100 ml bottle: Tk 40.12"
 *   "500 mg vial: Tk 28.43,(5's pack: Tk 142.15),"
 * The first segment is the unit (its label doubles as the container description);
 * every parenthesised segment is a pack. The raw text is kept alongside so nothing
 * an unusual format holds is silently lost.
 */
const TAKA = /[৳৲]|BDT|Tk\.?/gi;
function parsePrice(container, sizeCol) {
  const raw = clean(container);
  const out = { raw, unit: null, unitLabel: '', packs: [] };
  if (!raw) return out;
  const num = (s) => { const m = String(s).replace(/,/g, '').match(/(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : null; };
  const packRe = /\(([^)]*?):\s*([^)]*?)\)/g;
  let m;
  while ((m = packRe.exec(raw))) {
    const label = clean(m[1]).replace(TAKA, '').trim();
    const price = num(m[2]);
    if (label && price != null) out.packs.push({ label, price });
  }
  const first = raw.split('(')[0];
  const parts = first.split(':');
  if (parts.length >= 2) {
    out.unitLabel = clean(parts[0]).replace(/^unit price$/i, 'Unit price');
    out.unit = num(parts.slice(1).join(':'));
  } else {
    out.unit = num(first);
  }
  if (out.unit == null && out.packs.length) { out.unit = out.packs[0].price; out.unitLabel = out.packs[0].label; }
  if (clean(sizeCol)) out.sizeText = clean(sizeCol);
  return out;
}

/* ---- source files ------------------------------------------------------------ */
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const go = (u, depth) => {
      if (depth > 5) return reject(new Error('too many redirects'));
      https.get(u, { headers: { 'user-agent': 'unico-medicine-import' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return go(new URL(res.headers.location, u).toString(), depth + 1);
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode + ' from ' + u)); }
        const f = fs.createWriteStream(dest);
        res.pipe(f);
        f.on('finish', () => f.close(() => resolve(dest)));
        f.on('error', reject);
      }).on('error', reject);
    };
    go(url, 0);
  });
}
async function ensureData() {
  const missing = FILES.filter((f) => !fs.existsSync(path.join(DATA_DIR, f)));
  if (!missing.length) return;
  if (argOf('--dir')) throw new Error('Missing in --dir ' + DATA_DIR + ': ' + missing.join(', '));
  // OFFLINE BY DEFAULT. The six CSVs are vendored in the repo precisely so that a
  // hospital PC with no internet can still rebuild the drug database, so a missing
  // file is treated as a fault to report — not as a reason to quietly reach out to
  // the network. --download is the explicit opt-in for refreshing the snapshot.
  if (!has('--download')) {
    throw new Error(
      'Missing CSVs in ' + DATA_DIR + ': ' + missing.join(', ')
      + '\n  These files ship with the repository so the import works offline.'
      + '\n  Restore them from version control, or pass --download to fetch the CC0'
      + '\n  dataset again (needs internet).');
  }
  console.log('--download given: fetching the CC0 dataset (~3 MB)...');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const zip = path.join(DATA_DIR, 'dataset.zip');
  await download(ZIP_URL, zip);
  const size = fs.statSync(zip).size;
  if (size < 100000) throw new Error('Download looks wrong (' + size + ' bytes). Fetch it manually and pass --dir.');
  console.log('  downloaded ' + (size / 1048576).toFixed(1) + ' MB, extracting...');
  // PowerShell's Expand-Archive is present on every supported Windows; unzip covers
  // the rest. Extraction is one-shot at import time, so shelling out beats adding a
  // zip dependency to a server that never otherwise needs one.
  try {
    execFileSync('powershell', ['-NoProfile', '-Command', 'Expand-Archive -LiteralPath "' + zip + '" -DestinationPath "' + DATA_DIR + '" -Force'], { stdio: 'ignore' });
  } catch (e) {
    execFileSync('unzip', ['-o', zip, '-d', DATA_DIR], { stdio: 'ignore' });
  }
  const still = FILES.filter((f) => !fs.existsSync(path.join(DATA_DIR, f)));
  if (still.length) throw new Error('Extracted archive is missing: ' + still.join(', '));
}

/* ---- integrity ----------------------------------------------------------------
 * The CSVs are committed rather than downloaded, so the thing that can go wrong is no
 * longer "the site is down" but "a file got mangled in transit". MANIFEST.md carries a
 * SHA-256 per file; --verify checks them, and the import prints any mismatch rather
 * than silently loading half a file.
 */
function checksums() {
  const crypto = require('crypto');
  const out = {};
  FILES.forEach((f) => {
    const full = path.join(DATA_DIR, f);
    if (!fs.existsSync(full)) { out[f] = null; return; }
    out[f] = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
  });
  return out;
}
const NEWLINE = new RegExp(String.fromCharCode(13) + '?' + String.fromCharCode(10));
function manifestExpected() {
  const mf = path.join(DATA_DIR, 'MANIFEST.md');
  if (!fs.existsSync(mf)) return null;
  const want = {};
  fs.readFileSync(mf, 'utf8').split(NEWLINE).forEach((line) => {
    const m = line.match(/^\s*([0-9a-f]{64})\s+\*?(.+?)\s*$/i);
    if (m) want[m[2]] = m[1].toLowerCase();
  });
  return Object.keys(want).length ? want : null;
}
function verifyData(loud) {
  const want = manifestExpected();
  if (!want) { if (loud) console.log('  (no MANIFEST.md — skipping the integrity check)'); return true; }
  const got = checksums();
  let ok = true;
  FILES.forEach((f) => {
    if (!want[f]) return;
    if (got[f] !== want[f]) { ok = false; console.warn('  CHECKSUM MISMATCH: ' + f); }
    else if (loud) console.log('  ok  ' + f);
  });
  if (ok && loud) console.log('  all ' + FILES.length + ' files match MANIFEST.md');
  return ok;
}

/* ---- build -------------------------------------------------------------------- */
const MONO = [
  ['indication', 'indication description'],
  ['therapeuticClass', 'therapeutic class description'],
  ['pharmacology', 'pharmacology description'],
  ['dosage', 'dosage description'],
  ['administration', 'administration description'],
  ['interaction', 'interaction description'],
  ['contraindications', 'contraindications description'],
  ['sideEffects', 'side effects description'],
  ['pregnancy', 'pregnancy and lactation description'],
  ['precautions', 'precautions description'],
  ['pediatric', 'pediatric usage description'],
  ['overdose', 'overdose effects description'],
  ['duration', 'duration of treatment description'],
  ['reconstitution', 'reconstitution description'],
  ['storage', 'storage conditions description'],
];

function build() {
  const gRows = readCsv('generic.csv');
  const mRows = readCsv('medicine.csv');

  const generics = gRows.map((g) => {
    const monograph = {};
    MONO.forEach((pair) => { const v = sanitize(g[pair[1]]); if (v) monograph[pair[0]] = v; });
    return {
      _id: 'gen-' + clean(g['generic id']),
      name: clean(g['generic name']),
      nameLower: norm(g['generic name']),
      slug: clean(g.slug),
      drugClass: clean(g['drug class']),
      indication: clean(g.indication),
      monographLink: clean(g['monograph link']),
      monograph,
      sections: Object.keys(monograph).length,
      // Pre-computed plain text of the sections a prescriber checks at the point of
      // writing, so the Rx screen never has to strip HTML in the browser.
      brief: {
        dosage: plain(g['dosage description']).slice(0, 1200),
        interaction: plain(g['interaction description']).slice(0, 1200),
        contra: plain(g['contraindications description']).slice(0, 1200),
        pregnancy: plain(g['pregnancy and lactation description']).slice(0, 600),
      },
      pregnancyCategory: pregnancyCategory(g['pregnancy and lactation description']),
      abx: isAntibiotic(g['drug class']),
      brands: 0, forms: [], manufacturers: 0,
      source: SOURCE, sourceDate: SOURCE_DATE,
    };
  }).filter((g) => g.name);

  const byName = new Map();
  generics.forEach((g) => { if (!byName.has(g.nameLower)) byName.set(g.nameLower, g); });

  const seenMfr = new Map();
  const brands = mRows.map((m) => {
    const gName = clean(m.generic);
    const g = byName.get(norm(gName)) || null;
    const form = clean(m['dosage form']);
    const mfr = clean(m.manufacturer);
    if (g) {
      g.brands++;
      if (form && g.forms.indexOf(form) < 0) g.forms.push(form);
      if (!seenMfr.has(g._id)) seenMfr.set(g._id, new Set());
      if (mfr) seenMfr.get(g._id).add(mfr);
    }
    return {
      _id: 'brand-' + clean(m['brand id']),
      name: clean(m['brand name']),
      nameLower: norm(m['brand name']),
      type: clean(m.type) || 'allopathic',
      slug: clean(m.slug),
      form,
      generic: gName,
      genericId: g ? g._id : '',
      genericLower: norm(gName),
      strength: clean(m.strength),
      manufacturer: mfr,
      manufacturerLower: norm(mfr),
      drugClass: g ? g.drugClass : '',
      pregnancyCategory: g ? g.pregnancyCategory : '',
      abx: g ? g.abx : false,
      price: parsePrice(m['package container'], m['Package Size']),
      source: SOURCE, sourceDate: SOURCE_DATE,
    };
  }).filter((b) => b.name);

  generics.forEach((g) => { g.manufacturers = (seenMfr.get(g._id) || new Set()).size; g.forms.sort(); });

  const refs = [];
  const ref = (kind, rows, idCol, nameCol, countCol) => rows.forEach((r) => {
    const name = clean(r[nameCol]);
    if (!name) return;
    refs.push({
      _id: kind + '-' + clean(r[idCol]),
      kind: kind, name: name, nameLower: norm(name),
      slug: clean(r.slug),
      count: parseInt(clean(r[countCol]), 10) || 0,
      source: SOURCE, sourceDate: SOURCE_DATE,
    });
  });
  ref('class', readCsv('drug class.csv'), 'drug class id', 'drug class name', 'generics count');
  ref('indication', readCsv('indication.csv'), 'indication id', 'indication name', 'generics count');
  ref('mfr', readCsv('manufacturer.csv'), 'manufacturer id', 'manufacturer name', 'brand names count');
  ref('form', readCsv('dosage form.csv'), 'dosage form id', 'dosage form name', 'brand names count');

  return { generics: generics, brands: brands, refs: refs };
}

/* ---- write -------------------------------------------------------------------- */
async function write(data) {
  const { getDbHandle, close } = require('../server/db');
  const db = await getDbHandle();
  if (!db) throw new Error('No database. Set MONGODB_URI in server/.env.');

  const upsert = async (name, docs) => {
    const col = db.collection(name);
    // Documents a pharmacist has corrected in the app carry edited:true. Re-import
    // must never quietly undo a local clinical correction, so those are skipped
    // unless --force.
    let keep = new Set();
    if (!FORCE) {
      const edited = await col.find({ edited: true }, { projection: { _id: 1 } }).toArray();
      keep = new Set(edited.map((d) => d._id));
    }
    const todo = docs.filter((d) => !keep.has(d._id));
    for (let i = 0; i < todo.length; i += 500) {
      const ops = todo.slice(i, i + 500).map((d) => {
        const id = d._id;
        const rest = Object.assign({}, d);
        delete rest._id;
        return { updateOne: { filter: { _id: id }, update: { $set: rest, $setOnInsert: { importedAt: Date.now() } }, upsert: true } };
      });
      await col.bulkWrite(ops, { ordered: false });
      process.stdout.write('  ' + name + ': ' + Math.min(i + 500, todo.length) + '/' + todo.length + '\r');
    }
    console.log('  ' + name + ': ' + todo.length + ' written' + (keep.size ? ', ' + keep.size + ' locally edited kept' : '') + '          ');
  };

  await upsert('medGenerics', data.generics);
  await upsert('medBrands', data.brands);
  await upsert('medRefs', data.refs);

  console.log('Creating indexes...');
  // Anchored-prefix regex on the *Lower fields is what the type-ahead runs, and it
  // uses these indexes; the text index backs the "search anywhere" fallback.
  await db.collection('medBrands').createIndexes([
    { key: { nameLower: 1 } }, { key: { genericLower: 1 } }, { key: { genericId: 1 } },
    { key: { stocked: 1 } }, { key: { abx: 1 } },
    { key: { manufacturerLower: 1 } }, { key: { form: 1 } }, { key: { type: 1 } },
    { key: { name: 'text', generic: 'text', manufacturer: 'text' }, name: 'brand_text', weights: { name: 10, generic: 5, manufacturer: 1 } },
  ]).catch((e) => console.warn('  brand index: ' + e.message));
  await db.collection('medGenerics').createIndexes([
    { key: { nameLower: 1 } }, { key: { drugClass: 1 } },
    { key: { name: 'text', drugClass: 'text', indication: 'text' }, name: 'generic_text', weights: { name: 10, indication: 3, drugClass: 2 } },
  ]).catch((e) => console.warn('  generic index: ' + e.message));
  await db.collection('medRefs').createIndexes([{ key: { kind: 1, nameLower: 1 } }])
    .catch((e) => console.warn('  ref index: ' + e.message));
  await db.collection('prescriptions').createIndexes([
    { key: { uhid: 1, date: -1 } }, { key: { date: -1 } }, { key: { doctorId: 1, date: -1 } },
  ]).catch((e) => console.warn('  rx index: ' + e.message));

  await close();
}

(async function main() {
  try {
    await ensureData();
    if (has('--verify')) { console.log('Verifying ' + DATA_DIR + ' ...'); process.exitCode = verifyData(true) ? 0 : 1; return; }
    if (!verifyData(false)) console.warn('  WARNING: a source CSV does not match MANIFEST.md — import continuing, but check the file.');
    console.log('Parsing ' + DATA_DIR + ' ...');
    const data = build();
    const linked = data.brands.filter((b) => b.genericId).length;
    const priced = data.brands.filter((b) => b.price && b.price.unit != null).length;
    const withMono = data.generics.filter((g) => g.sections > 0).length;
    console.log('  generics    : ' + data.generics.length + ' (' + withMono + ' with a monograph)');
    console.log('  brands      : ' + data.brands.length + ' (' + linked + ' linked to a generic, ' + priced + ' priced)');
    console.log('  reference   : ' + data.refs.length + ' (classes / indications / manufacturers / forms)');
    console.log('  derived     : ' + data.generics.filter((g) => g.pregnancyCategory).length + ' pregnancy categories, '
      + data.generics.filter((g) => g.abx).length + ' antibiotics');
    if (DRY) {
      const g = data.generics.find((x) => x.name === 'Paracetamol') || data.generics[0];
      console.log('\nSample generic - ' + g.name + ' [' + g.drugClass + '] ' + g.brands + ' brands, ' + g.sections + ' sections');
      console.log('  dosage: ' + (g.brief.dosage || '(none)').slice(0, 260) + '...');
      console.log('  html  : ' + (g.monograph.dosage || '').slice(0, 200) + '...');
      const b = data.brands.find((x) => x.genericId === g._id) || data.brands[0];
      console.log('\nSample brand - ' + b.name + ' ' + b.strength + ' ' + b.form + ' (' + b.manufacturer + ')');
      console.log('  price: ' + JSON.stringify(b.price));
      console.log('\n--dry: nothing written.');
      return;
    }
    console.log('Writing to MongoDB...');
    await write(data);
    console.log('Done. Prices are from ' + SOURCE_DATE + ' and are indicative only.');
  } catch (e) {
    console.error('Import failed: ' + (e && e.message ? e.message : e));
    process.exitCode = 1;
  }
})();
