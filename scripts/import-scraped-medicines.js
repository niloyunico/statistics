/* Import completed scraper outputs without overwriting locally edited medicine docs. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });

const DIMS = path.join(__dirname, 'data', 'dims-current', 'catalogue.csv');
const MEDEX = path.join(__dirname, 'data', 'medex-current', 'medicine-details.jsonl');
const BACKUPS = path.join(__dirname, 'data', 'db-backups');
const norm = (v) => String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const keyOf = (d) => [d.name || d.brand_name, d.form || d.dosage_form, d.strength,
  d.generic || d.generic_name, d.manufacturer].map(norm).join('|');

function parseCSV(src) {
  const rows = []; let row = [], cur = '', quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') { if (src[i + 1] === '"') { cur += '"'; i++; } else quoted = false; }
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const head = rows.shift().map((x) => x.replace(/^\ufeff/, '').trim());
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] || ''])));
}

async function backup(db, names) {
  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(BACKUPS, stamp);
  fs.mkdirSync(dir, { recursive: true });
  for (const name of names) {
    const file = fs.createWriteStream(path.join(dir, name + '.jsonl'), { encoding: 'utf8' });
    for await (const doc of db.collection(name).find({})) file.write(JSON.stringify(doc) + '\n');
    await new Promise((resolve, reject) => { file.end(resolve); file.on('error', reject); });
  }
  return dir;
}

async function batches(collection, operations) {
  let written = 0;
  for (let i = 0; i < operations.length; i += 500) {
    const chunk = operations.slice(i, i + 500);
    if (chunk.length) await collection.bulkWrite(chunk, { ordered: false });
    written += chunk.length;
  }
  return written;
}

(async () => {
  const { getDbHandle, close } = require('../server/db');
  try {
    if (!fs.existsSync(DIMS)) throw new Error('Missing DIMS output: ' + DIMS);
    if (!fs.existsSync(MEDEX)) throw new Error('Missing MedEx output: ' + MEDEX);
    const db = await getDbHandle();
    if (!db) throw new Error('Database unavailable');

    console.log('Backing up medicine collections...');
    const backupDir = await backup(db, ['medBrands', 'medGenerics', 'medRefs', 'medSourceDims', 'medSourceMedex']);
    console.log('  backup: ' + backupDir);

    const existing = await db.collection('medBrands').find({}, { projection: {
      _id: 1, name: 1, form: 1, strength: 1, generic: 1, manufacturer: 1, edited: 1,
    } }).toArray();
    const byKey = new Map();
    existing.forEach((doc) => { const k = keyOf(doc); if (k && !byKey.has(k)) byKey.set(k, doc); });

    const dimsRows = parseCSV(fs.readFileSync(DIMS, 'utf8'));
    const dimsSourceOps = [];
    const brandOps = [];
    let dimsMatched = 0, dimsAdded = 0;
    for (const row of dimsRows) {
      const sourceId = 'dims-' + crypto.createHash('sha1').update(row.source_url).digest('hex');
      dimsSourceOps.push({ updateOne: { filter: { _id: sourceId }, update: { $set: {
        ...row, source: 'dimsbd.com', importedAt: Date.now(), factualIndexOnly: true,
      } }, upsert: true } });
      const matched = byKey.get(keyOf(row));
      if (matched) {
        dimsMatched++;
        brandOps.push({ updateOne: { filter: { _id: matched._id }, update: { $set: {
          'sourceLinks.dims': row.source_url, dimsIndexedAt: row.indexed_at || '',
        } } } });
      } else {
        dimsAdded++;
        const doc = {
          _id: sourceId, name: row.brand_name, nameLower: norm(row.brand_name), type: 'allopathic',
          form: row.dosage_form, strength: row.strength, generic: row.generic_name,
          genericLower: norm(row.generic_name), genericId: '', manufacturer: row.manufacturer,
          manufacturerLower: norm(row.manufacturer), source: 'dimsbd.com factual index',
          sourceDate: String(row.indexed_at || '').slice(0, 10), sourceLinks: { dims: row.source_url },
          importedAt: Date.now(), factualIndexOnly: true,
        };
        brandOps.push({ updateOne: { filter: { _id: sourceId }, update: { $set: doc }, upsert: true } });
        byKey.set(keyOf(doc), doc);
      }
    }

    const medexRows = fs.readFileSync(MEDEX, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    const medexSourceOps = [];
    const medexBrandOps = [];
    for (const row of medexRows) {
      const id = 'brand-' + row.brand_id;
      const sourceRow = { ...row };
      delete sourceRow._id;
      medexSourceOps.push({ updateOne: { filter: { _id: id }, update: { $set: {
        ...sourceRow, source: 'medex.com.bd', importedAt: Date.now(),
      } }, upsert: true } });
      const existingBrand = existing.find((b) => b._id === id);
      if (!existingBrand || existingBrand.edited) continue;
      medexBrandOps.push({ updateOne: { filter: { _id: id, edited: { $ne: true } }, update: { $set: {
        'sourceLinks.medex': row.source_url, medexScrapedAt: row.scraped_at,
        unavailable: Boolean(row.unavailable), currentPackages: row.packages || [],
        productImageUrl: row.product_image_url || '', dosageIconUrl: row.dosage_icon_url || '',
      } } } });
    }

    console.log('Writing source and application collections...');
    console.log('  medSourceDims: ' + await batches(db.collection('medSourceDims'), dimsSourceOps));
    console.log('  medBrands DIMS merge: ' + await batches(db.collection('medBrands'), brandOps));
    console.log('  medSourceMedex: ' + await batches(db.collection('medSourceMedex'), medexSourceOps));
    console.log('  medBrands MedEx enrichment: ' + await batches(db.collection('medBrands'), medexBrandOps));
    await db.collection('medSourceDims').createIndex({ source_url: 1 }, { unique: true });
    await db.collection('medSourceMedex').createIndex({ brand_id: 1 });
    await db.collection('medBrands').createIndex({ nameLower: 1 });

    const counts = {};
    for (const name of ['medBrands', 'medGenerics', 'medRefs', 'medSourceDims', 'medSourceMedex']) {
      counts[name] = await db.collection(name).countDocuments();
    }
    console.log(JSON.stringify({ dimsRows: dimsRows.length, dimsMatched, dimsAdded, medexRows: medexRows.length, counts }, null, 2));
    await close();
  } catch (error) {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
    try { await close(); } catch (_) {}
  }
})();
