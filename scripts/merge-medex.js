/* UNICO — merge the scraped MedEx snapshot into the medicine database.
 *
 * WHY THIS IS SEPARATE FROM import-medicines.js
 * import-medicines.js builds the catalogue from the CC0 Kaggle dataset, which may be
 * redistributed inside this app without restriction. That dataset was captured
 * 2022-07-24, so after four years its PRICES ARE STALE and brands registered since
 * are missing. scrape-medex.py closes that gap from the live MedEx site.
 *
 * WHAT THIS SCRIPT WILL AND WILL NOT COPY — READ BEFORE USING THE FLAGS
 * MedEx's clinical monographs and pack photographs are copyrighted; the CC0 dataset
 * was chosen for the shipped catalogue precisely so none of that had to be. So this
 * script defaults to merging only FACTS — brand name, generic, strength, dosage form,
 * manufacturer, pack price, availability. A product's price is not a protected
 * expression, and the stale-price problem is the whole reason the scrape exists.
 *
 * The copyrighted parts are behind explicit, off-by-default opt-ins:
 *   --with-monograph  writes MedEx section prose over the CC0 monographs
 *   --with-images     loads MedEx pack photographs into medImages
 * Those are defensible for internal reference inside one hospital and are NOT safe to
 * redistribute. If this app is ever shipped, sold, or hosted for another site, run it
 * without those two flags and the shipped database stays clean.
 *
 * RUN
 *   node scripts/merge-medex.js --dry              # report what would change
 *   node scripts/merge-medex.js                    # merge facts (prices, availability, new brands)
 *   node scripts/merge-medex.js --with-images      # also load pack photographs
 *   node scripts/merge-medex.js --with-monograph   # also overwrite monograph prose
 *   node scripts/merge-medex.js --force            # include docs a pharmacist edited
 */
'use strict';
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });

const ARGV = process.argv.slice(2);
const has = (f) => ARGV.indexOf(f) >= 0;
const argOf = (f) => { const i = ARGV.indexOf(f); return i >= 0 ? ARGV[i + 1] : null; };

const DRY = has('--dry');
const FORCE = has('--force');
const WITH_IMAGES = has('--with-images');
const WITH_MONO = has('--with-monograph');
const SRC_DIR = argOf('--dir') || path.join(__dirname, 'data', 'medex-current');
const SOURCE = 'medex.com.bd (scraped; facts only unless flagged)';
const IMG_MAX = 400 * 1024;
const MIME = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };

const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const norm = (s) => clean(s).toLowerCase();

/* ---- read the shard checkpoints ----------------------------------------------
 * Every worker wrote its own file; the newest record for a brand wins, so a re-scrape
 * of the same brand supersedes the earlier one rather than being merged on top of it.
 */
function readScrape() {
  if (!fs.existsSync(SRC_DIR)) throw new Error('No scrape at ' + SRC_DIR + ' — run scripts/scrape-medex.py first.');
  const files = fs.readdirSync(SRC_DIR).filter((f) => /^medicine-details.*\.jsonl$/.test(f));
  if (!files.length) throw new Error('No medicine-details*.jsonl in ' + SRC_DIR);
  const byId = new Map();
  let lines = 0, bad = 0;
  files.forEach((f) => {
    const text = fs.readFileSync(path.join(SRC_DIR, f), 'utf8');
    text.split('\n').forEach((line) => {
      if (!line.trim()) return;
      lines++;
      let d;
      try { d = JSON.parse(line); } catch (e) { bad++; return; }
      if (d.status !== 'ok' || !d.brand_id) return;
      const prev = byId.get(String(d.brand_id));
      if (!prev || String(d.scraped_at || '') >= String(prev.scraped_at || '')) byId.set(String(d.brand_id), d);
    });
  });
  return { rows: byId, files: files.length, lines, bad };
}

/* ---- prices -------------------------------------------------------------------
 * MedEx renders one package line holding several labelled prices:
 *   "Unit Price: BDT 6.00 (3 x 10: BDT 180.00) Strip Price: BDT 60.00"
 * Parenthesised segments are packs. The rest is a run of "label: price" pairs, the
 * first of which is the unit. Currency marks vary, so they are stripped, not matched.
 */
const CURRENCY = /[৳৲]|BDT|Tk\.?/gi;
function parsePrice(packages) {
  const raw = clean((packages || []).join(' '));
  const out = { raw, unit: null, unitLabel: '', packs: [] };
  if (!raw) return out;
  const num = (s) => { const m = String(s).replace(/,/g, '').match(/(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : null; };

  const packRe = /\(([^)]*?):\s*([^)]*?)\)/g;
  let m;
  while ((m = packRe.exec(raw))) {
    const label = clean(m[1]).replace(CURRENCY, '').trim();
    const price = num(m[2]);
    if (label && price != null) out.packs.push({ label, price });
  }
  const rest = raw.replace(/\([^)]*\)/g, ' ');

  const pairRe = /([^:()]+?):\s*(?:[৳৲]|BDT|Tk\.?)?\s*([\d,]+(?:\.\d+)?)/g;
  const pairs = [];
  while ((m = pairRe.exec(rest))) {
    const label = clean(m[1]).replace(CURRENCY, '').trim();
    const price = num(m[2]);
    if (price != null) pairs.push({ label: label || 'Unit price', price });
  }
  if (pairs.length) {
    out.unit = pairs[0].price;
    out.unitLabel = pairs[0].label;
    pairs.slice(1).forEach((p) => out.packs.push(p));
  } else if (out.packs.length) {
    out.unit = out.packs[0].price;
    out.unitLabel = out.packs[0].label;
  }
  return out;
}

/* ---- monograph sections (only reached with --with-monograph) ------------------ */
const SECTION_KEY = {
  'indications': 'indication', 'indication': 'indication',
  'pharmacology': 'pharmacology',
  'dosage & administration': 'dosage', 'dosage and administration': 'dosage', 'dosage': 'dosage',
  'administration': 'administration',
  'interaction': 'interaction', 'interactions': 'interaction',
  'contraindications': 'contraindications',
  'side effects': 'sideEffects',
  'pregnancy & lactation': 'pregnancy', 'pregnancy and lactation': 'pregnancy',
  'precautions & warnings': 'precautions', 'precautions and warnings': 'precautions',
  'pediatric uses': 'pediatric', 'paediatric uses': 'pediatric', 'use in children': 'pediatric',
  'overdose effects': 'overdose',
  'therapeutic class': 'therapeuticClass',
  'storage conditions': 'storage',
  'duration of treatment': 'duration',
  'reconstitution': 'reconstitution',
};
const KEEP = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'sup', 'sub', 'h4', 'h5', 'table', 'thead', 'tbody', 'tr', 'td', 'th'];
function sanitize(html) {
  let s = String(html == null ? '' : html);
  if (!s.trim()) return '';
  s = s.replace(/<\s*(script|style|svg|iframe)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  s = s.replace(/<\s*img[^>]*>/gi, '');
  s = s.replace(/<\s*div[^>]*>/gi, '').replace(/<\s*\/\s*div\s*>/gi, '<br>');
  s = s.replace(/<\s*(\/?)\s*([a-zA-Z0-9]+)(\s[^>]*)?\/?\s*>/g, (mm, slash, tag) => {
    const t = tag.toLowerCase();
    if (KEEP.indexOf(t) < 0) return '';
    if (t === 'br') return '<br>';
    return slash ? '</' + t + '>' : '<' + t + '>';
  });
  s = s.replace(/(<br>\s*){3,}/gi, '<br><br>');
  return s.replace(/^(?:\s|<br>)+/i, '').replace(/(?:\s|<br>)+$/i, '').replace(/[ \t]+/g, ' ').trim();
}

/* ---- main --------------------------------------------------------------------- */
async function main() {
  const { rows, files, lines, bad } = readScrape();
  console.log('MedEx scrape: ' + rows.size + ' brands from ' + files + ' shard file(s), ' + lines + ' lines' + (bad ? ', ' + bad + ' unreadable' : ''));
  if (WITH_MONO) console.log('  ! --with-monograph: copyrighted MedEx prose WILL be written. Do not redistribute.');
  if (WITH_IMAGES) console.log('  ! --with-images: copyrighted MedEx photographs WILL be written. Do not redistribute.');
  if (!WITH_MONO && !WITH_IMAGES) console.log('  facts only (prices, availability, new brands) — monographs and photos untouched.');

  const { getDbHandle, close } = require('../server/db');
  const db = await getDbHandle();
  if (!db) throw new Error('No database. Set MONGODB_URI in server/.env.');

  const brands = db.collection('medBrands');
  const generics = db.collection('medGenerics');

  let protectedIds = new Set();
  if (!FORCE) {
    const edited = await brands.find({ edited: true }, { projection: { _id: 1 } }).toArray();
    protectedIds = new Set(edited.map((d) => d._id));
    if (protectedIds.size) console.log('  ' + protectedIds.size + ' locally edited brand(s) will be skipped (--force to include).');
  }

  const existing = new Map();
  await brands.find({}, { projection: { _id: 1, 'price.unit': 1, generic: 1, genericId: 1, drugClass: 1, pregnancyCategory: 1, abx: 1 } })
    .forEach((d) => existing.set(d._id, d));
  const genByName = new Map();
  await generics.find({}, { projection: { _id: 1, nameLower: 1, drugClass: 1, pregnancyCategory: 1, abx: 1 } })
    .forEach((d) => { if (d.nameLower) genByName.set(d.nameLower, d); });
  console.log('  database has ' + existing.size + ' brands, ' + genByName.size + ' generics.');

  const ops = [];
  const stat = { updated: 0, inserted: 0, skipped: 0, priceChanged: 0, unavailable: 0, noPrice: 0 };

  rows.forEach((d, brandId) => {
    const id = 'brand-' + brandId;
    if (protectedIds.has(id)) { stat.skipped++; return; }
    const price = parsePrice(d.packages);
    if (price.unit == null) stat.noPrice++;
    if (d.unavailable) stat.unavailable++;

    const prev = existing.get(id);
    const gName = clean(d.generic_name);
    const g = genByName.get(norm(gName)) || null;

    const set = {
      name: clean(d.brand_name),
      nameLower: norm(d.brand_name),
      form: clean(d.dosage_form),
      generic: gName,
      genericLower: norm(gName),
      strength: clean(d.strength),
      manufacturer: clean(d.manufacturer),
      manufacturerLower: norm(d.manufacturer),
      unavailable: !!d.unavailable,
      medexUrl: clean(d.source_url),
      medexCheckedAt: clean(d.scraped_at),
    };
    if (price.unit != null || !prev) set.price = price;
    if (prev && price.unit != null && prev.price && prev.price.unit != null && prev.price.unit !== price.unit) stat.priceChanged++;

    if (!prev) {
      // A brand registered after the 2022 CC0 snapshot: insert it with the same shape
      // the CC0 importer produces, so the Rx screen treats it identically.
      set.type = 'allopathic';
      set.slug = clean((d.source_url || '').split('/').pop());
      set.genericId = g ? g._id : '';
      set.drugClass = g ? g.drugClass : '';
      set.pregnancyCategory = g ? g.pregnancyCategory : '';
      set.abx = g ? !!g.abx : false;
      set.source = SOURCE;
      set.sourceDate = clean(d.scraped_at).slice(0, 10);
      stat.inserted++;
    } else {
      // Do not clobber the CC0 clinical links on an existing row; only fill blanks.
      if (g && !prev.genericId) { set.genericId = g._id; set.drugClass = g.drugClass; set.pregnancyCategory = g.pregnancyCategory; set.abx = !!g.abx; }
      stat.updated++;
    }
    ops.push({ updateOne: { filter: { _id: id }, update: { $set: set, $setOnInsert: { importedAt: Date.now() } }, upsert: true } });
  });

  console.log('\nBrands: ' + stat.updated + ' to update, ' + stat.inserted + ' new, ' + stat.skipped + ' skipped (edited)');
  console.log('  ' + stat.priceChanged + ' price change(s), ' + stat.unavailable + ' marked unavailable, ' + stat.noPrice + ' with no price on the page');

  if (DRY) { console.log('\n--dry: nothing written.'); await close(); return; }

  for (let i = 0; i < ops.length; i += 500) {
    await brands.bulkWrite(ops.slice(i, i + 500), { ordered: false });
    process.stdout.write('  wrote ' + Math.min(i + 500, ops.length) + '/' + ops.length + '\r');
  }
  console.log('\n  brands written.');

  if (WITH_MONO) await mergeMonographs(rows, generics, genByName);
  if (WITH_IMAGES) await mergeImages(rows, db, brands);

  await close();
  console.log('\nDone.');
}

/* ---- opt-in: monograph prose --------------------------------------------------- */
async function mergeMonographs(rows, generics, genByName) {
  const byGeneric = new Map();
  rows.forEach((d) => {
    const key = norm(d.generic_name);
    if (!key || byGeneric.has(key)) return;
    if (d.sections && Object.keys(d.sections).length) byGeneric.set(key, d.sections);
  });
  let done = 0, missing = 0;
  const ops = [];
  byGeneric.forEach((sections, key) => {
    const g = genByName.get(key);
    if (!g) { missing++; return; }
    const monograph = {};
    Object.keys(sections).forEach((title) => {
      const field = SECTION_KEY[norm(title)];
      if (!field) return;
      const html = sanitize(sections[title].html || sections[title].text || '');
      if (html) monograph[field] = html;
    });
    if (!Object.keys(monograph).length) return;
    done++;
    ops.push({ updateOne: { filter: { _id: g._id }, update: { $set: { monograph, sections: Object.keys(monograph).length, monographSource: SOURCE } } } });
  });
  console.log('\nMonographs: ' + done + ' generic(s) to update, ' + missing + ' scraped generic(s) not in the database');
  for (let i = 0; i < ops.length; i += 500) await generics.bulkWrite(ops.slice(i, i + 500), { ordered: false });
  console.log('  monographs written.');
}

/* ---- opt-in: pack photographs -------------------------------------------------- */
async function mergeImages(rows, db, brands) {
  const images = db.collection('medImages');
  let saved = 0, tooBig = 0, absent = 0, badType = 0;
  const flag = [];
  const all = Array.from(rows.entries());
  for (let n = 0; n < all.length; n++) {
    const brandId = all[n][0], d = all[n][1];
    const file = (d.pack_image_files || [])[0];
    if (!file) continue;
    if (!fs.existsSync(file)) { absent++; continue; }
    const mime = MIME[path.extname(file).toLowerCase()];
    if (!mime) { badType++; continue; }
    const buf = fs.readFileSync(file);
    // The upload endpoint caps at 400 KB after a client-side resize; honour the same
    // ceiling here so a scraped photo can never be larger than one a user could add.
    if (!buf.length || buf.length > IMG_MAX) { tooBig++; continue; }
    const id = 'brand-' + brandId;
    await images.updateOne({ _id: id }, {
      $set: {
        brandId: id, brandName: clean(d.brand_name), mime, bytes: buf.length, data: buf,
        caption: clean(d.brand_name) + ' pack', source: SOURCE,
        updatedAt: Date.now(), updatedBy: 'merge-medex',
      },
    }, { upsert: true });
    flag.push({ updateOne: { filter: { _id: id }, update: { $set: { hasImage: true } } } });
    saved++;
    if (saved % 200 === 0) process.stdout.write('  images ' + saved + '\r');
  }
  for (let i = 0; i < flag.length; i += 500) await brands.bulkWrite(flag.slice(i, i + 500), { ordered: false });
  console.log('\nImages: ' + saved + ' saved, ' + tooBig + ' over the 400 KB cap, ' + absent + ' file missing, ' + badType + ' unsupported type');
}

main().catch((e) => { console.error('\n' + (e && e.message ? e.message : e)); process.exit(1); });
