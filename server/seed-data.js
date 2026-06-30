/* Move the remaining hardcoded renderer datasets into MongoDB:
 *   - staff   (nurse + PCA records)  <- renderer/unico/staff-seed.js  window.STAFF_SEED
 *   - quality (quality indicators)   <- renderer/unico/quality-data.js window.QUALITY_SEED
 *
 * Same approach as seed-departments.js: on first run the per-collection JSON in
 * server/seed/ is BOOTSTRAPPED by extracting the (legacy, soon-to-be-removed)
 * hardcoded global from the renderer file; afterwards the database is the source
 * of truth and the JSON is only a re-seed fallback.
 *
 * Usage:
 *   npm --prefix server run seed-data                 # seed staff + quality if empty
 *   npm --prefix server run seed-data -- staff        # one collection
 *   npm --prefix server run seed-data -- --force      # overwrite all
 *
 * Exports seedOne()/getCollection()/loadSeed() for the web server to use.
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
try { require('dns').setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']); } catch (e) { /* ignore */ }
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { MongoClient } = require('mongodb');

const SEED_DIR = path.join(__dirname, 'seed');
const RENDERER = path.join(__dirname, '..', 'renderer', 'unico');

// collection name -> { json fallback file, source renderer file, window global, id field }
const SOURCES = {
  staff: { file: 'staff.json', js: path.join(RENDERER, 'staff-seed.js'), global: 'STAFF_SEED', id: 'id' },
  quality: { file: 'quality.json', js: path.join(RENDERER, 'quality-data.js'), global: 'QUALITY_SEED', id: 'key' },
};

// Run a renderer data file in a sandbox and pull out window[<global>] (an array).
function extractGlobal(jsFile, globalName) {
  const code = fs.readFileSync(jsFile, 'utf8');
  const sandbox = { window: {}, console, document: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { timeout: 5000 });
  const v = sandbox.window[globalName];
  return Array.isArray(v) ? v : [];
}

function seedJsonPath(name) { return path.join(SEED_DIR, SOURCES[name].file); }

// Canonical seed for a collection: prefer the JSON; bootstrap it from the renderer
// file the first time (so the data moves from code into the DB exactly once).
function loadSeed(name) {
  const p = seedJsonPath(name);
  if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  const arr = extractGlobal(SOURCES[name].js, SOURCES[name].global);
  fs.mkdirSync(SEED_DIR, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(arr, null, 2), 'utf8');
  console.log('[seed-data] bootstrapped ' + p + ' (' + arr.length + ' ' + name + ' records).');
  return arr;
}

// Seed one collection. Inserts only when empty unless force. Preserves original
// array order via an `order` field so the UI keeps its ordering.
async function seedOne(db, name, opts) {
  if (!SOURCES[name]) throw new Error('Unknown dataset: ' + name);
  const force = !!(opts && opts.force);
  const col = db.collection(name);
  const existing = await col.countDocuments();
  if (existing > 0 && !force) return { name, seeded: 0, existing };
  const arr = loadSeed(name);
  const idf = SOURCES[name].id;
  const docs = arr.map((r, i) => ({
    _id: String(r && r[idf] != null ? r[idf] : i),
    ...r,
    order: r && r.order != null ? r.order : i,
  }));
  if (force) await col.deleteMany({});
  if (docs.length) {
    const ops = docs.map((doc) => ({ replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } }));
    await col.bulkWrite(ops);
  }
  return { name, seeded: docs.length, existing };
}

// Read a collection back as a plain array (ordered, _id stripped).
async function getCollection(db, name) {
  const docs = await db.collection(name).find({}).sort({ order: 1, _id: 1 }).toArray();
  return docs.map((d) => { const { _id, order, ...rest } = d; return rest; });
}

module.exports = { seedOne, getCollection, loadSeed, SOURCES };

if (require.main === module) {
  (async () => {
    if (!process.env.MONGODB_URI) { console.error('No MONGODB_URI set in server/.env'); process.exit(1); }
    const force = process.argv.includes('--force');
    const named = process.argv.slice(2).filter((a) => !a.startsWith('--'));
    const names = named.length ? named : Object.keys(SOURCES);
    const c = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 12000 });
    try {
      await c.connect();
      const db = c.db(process.env.DB_NAME || 'unico');
      for (const name of names) {
        const r = await seedOne(db, name, { force });
        console.log('[seed-data] ' + name + ': inserted/replaced ' + r.seeded + ' | existing before ' + r.existing + (force ? ' (forced)' : ''));
      }
    } catch (e) {
      console.error('[seed-data] failed:', e.message);
      process.exitCode = 1;
    } finally {
      await c.close();
    }
  })();
}
