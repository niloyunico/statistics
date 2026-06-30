/* Move the MONTHLY STATISTICS into MongoDB.
 *
 * Seeds/refreshes the `departments` collection from the canonical department
 * definitions in server/seed/departments.json. On first run that JSON does not
 * exist yet, so it is BOOTSTRAPPED by extracting the (legacy, soon-to-be-removed)
 * hardcoded definitions out of renderer/unico/data.js — i.e. the monthly numbers
 * move from code into the database exactly once. After that the database is the
 * source of truth and the JSON is only a re-seed fallback.
 *
 * Usage:
 *   npm --prefix server run seed-departments            # insert only if empty
 *   npm --prefix server run seed-departments -- --force # overwrite all docs
 *
 * Also exports seedDepartments() so the web server can auto-seed on first boot.
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
try { require('dns').setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']); } catch (e) { /* ignore */ }
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { MongoClient } = require('mongodb');

const SEED_JSON = path.join(__dirname, 'seed', 'departments.json');
const DATA_JS = path.join(__dirname, '..', 'renderer', 'unico', 'data.js');
// Fields data.js computes at runtime — never store these; the renderer recomputes them.
const COMPUTED = ['fullMonths', 'series', 'total', 'latest', 'prev', 'delta', 'peak'];

// Run the legacy data.js in a sandbox and pull out the raw department definitions.
function extractFromDataJs() {
  const code = fs.readFileSync(DATA_JS, 'utf8');
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { timeout: 5000 });
  const list = (sandbox.window.UNICO && sandbox.window.UNICO.DEPARTMENTS) || [];
  return list.map((d, i) => {
    const clean = {};
    Object.keys(d).forEach((k) => { if (!COMPUTED.includes(k)) clean[k] = d[k]; });
    if (clean.order == null) clean.order = i;
    return clean;
  });
}

// The canonical seed: prefer the JSON; bootstrap it from data.js the first time.
function loadSeed() {
  if (fs.existsSync(SEED_JSON)) {
    return JSON.parse(fs.readFileSync(SEED_JSON, 'utf8'));
  }
  const depts = extractFromDataJs();
  fs.mkdirSync(path.dirname(SEED_JSON), { recursive: true });
  fs.writeFileSync(SEED_JSON, JSON.stringify(depts, null, 2), 'utf8');
  console.log('[seed-departments] bootstrapped ' + SEED_JSON + ' from data.js (' + depts.length + ' departments).');
  return depts;
}

// Reusable seeding routine. Inserts only when the collection is empty, unless force.
async function seedDepartments(db, opts) {
  const force = !!(opts && opts.force);
  const col = db.collection('departments');
  const existing = await col.countDocuments();
  if (existing > 0 && !force) return { seeded: 0, existing };
  const depts = loadSeed();
  const docs = depts.map((d) => ({ _id: d.id, ...d }));
  if (force) await col.deleteMany({});
  if (docs.length) {
    const ops = docs.map((doc) => ({ replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } }));
    await col.bulkWrite(ops);
  }
  return { seeded: docs.length, existing };
}

module.exports = { seedDepartments, loadSeed, extractFromDataJs, SEED_JSON };

if (require.main === module) {
  (async () => {
    if (!process.env.MONGODB_URI) { console.error('No MONGODB_URI set in server/.env'); process.exit(1); }
    const force = process.argv.includes('--force');
    const c = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 12000 });
    try {
      await c.connect();
      const db = c.db(process.env.DB_NAME || 'unico');
      const r = await seedDepartments(db, { force });
      console.log('[seed-departments] done. inserted/replaced:', r.seeded, '| existing before:', r.existing, force ? '(forced)' : '');
    } catch (e) {
      console.error('[seed-departments] failed:', e.message);
      process.exitCode = 1;
    } finally {
      await c.close();
    }
  })();
}
