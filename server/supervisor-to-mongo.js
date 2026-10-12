/* Supervisor reports: Cloudflare D1 -> MongoDB.
 *
 * The shift supervisor reports were kept in D1 (`supervisor_reports`). They now
 * live in MongoDB (`supervisorReports`) with the rest of the supervisor data.
 * This copies them across. It only ever ADDS to MongoDB or brings an older
 * copy there up to date: nothing is removed from D1, and a report that is
 * newer in MongoDB is left alone. It can be run as often as needed.
 *
 *   node server/supervisor-to-mongo.js           what would be copied (changes nothing)
 *   node server/supervisor-to-mongo.js --run     copy
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const d1 = require('./d1');
const d1store = require('./d1-store');
const { getDbHandle } = require('./db');

const COLS = 'id, date, shift, status, supervisor_name, created_by, created_at, updated_at, doc';

// The same shape supervisor-reports.js gives a report read from D1.
function toDoc(row) {
  const doc = d1store.parseJson(row.doc, {}) || {};
  const { id, _id, ...rest } = doc;
  return Object.assign({}, rest, {
    _id: String(row.id),
    date: row.date,
    shift: row.shift,
    status: row.status,
    supervisorName: row.supervisor_name || doc.supervisorName || '',
    createdBy: row.created_by == null ? null : row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

async function copy({ run }) {
  if (!d1.configured()) return { d1: 0, note: 'Cloudflare D1 is not configured here, so there is nothing to copy.' };
  const db = await getDbHandle();
  if (!db) throw new Error('MongoDB is not connected (MONGODB_URI).');
  const rows = await d1.query('SELECT ' + COLS + ' FROM supervisor_reports ORDER BY date, updated_at');
  const col = db.collection('supervisorReports');
  const have = new Map((await col.find({}, { projection: { updatedAt: 1 } }).toArray()).map((doc) => [String(doc._id), Number(doc.updatedAt) || 0]));
  const result = { d1: rows.length, mongoBefore: have.size, added: 0, updated: 0, same: 0, newerInMongo: 0 };
  for (const row of rows) {
    const doc = toDoc(row);
    const at = have.get(doc._id);
    if (at === undefined) {
      result.added++;
      if (run) await col.updateOne({ _id: doc._id }, { $setOnInsert: doc }, { upsert: true });
    } else if (at < Number(doc.updatedAt)) {
      result.updated++;
      const { _id, ...rest } = doc;
      // Only if it is still the older copy: a save that landed in between wins.
      if (run) await col.updateOne({ _id, updatedAt: { $lt: doc.updatedAt } }, { $set: rest });
    } else if (at === Number(doc.updatedAt)) result.same++;
    else result.newerInMongo++;
  }
  result.mongoAfter = run ? await col.countDocuments() : have.size + result.added;
  return result;
}

module.exports = { copy, toDoc };

if (require.main === module) {
  const run = process.argv.includes('--run');
  copy({ run })
    .then((result) => {
      console.log((run ? 'Copied' : 'Would copy (nothing changed; add --run to copy)') + ':', JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((err) => { console.error('Failed: ' + err.message); process.exit(1); });
}
