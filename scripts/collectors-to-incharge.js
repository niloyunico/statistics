/* Promote data-collector accounts to IN-CHARGE.
 *
 * WHAT CHANGES, AND WHAT DOES NOT
 * Only `users.role`: 'collector' -> 'incharge'. Both are PORTAL_ROLES (server/access.js),
 * so these people keep signing in at the same place and keep exactly the same department
 * and quality-area scoping. What they gain is the in-charge portal: the unit dashboard,
 * "My unit's staff", and the add-nurse/PCA request screen, each of which is re-checked
 * server-side against the role.
 *
 * WHY IT IS WRITTEN AS A SCRIPT AND NOT A ONE-LINER
 * It is a permission change on real accounts. So: it prints what it would do and
 * changes nothing unless you pass --apply, it writes a rollback file naming exactly
 * which usernames it touched, and --rollback puts those same accounts back to
 * 'collector'. An account that was already 'incharge' before the run is never listed
 * in the rollback file, so a rollback cannot demote someone it did not promote.
 *
 * Usage:
 *   node scripts/collectors-to-incharge.js                 # dry run — show the list
 *   node scripts/collectors-to-incharge.js --apply         # promote them
 *   node scripts/collectors-to-incharge.js --rollback      # undo the last --apply
 *   node scripts/collectors-to-incharge.js --apply --only alice,bob
 */
const path = require('path');
const fs = require('fs');
require(path.join(__dirname, '..', 'server', 'node_modules', 'dotenv')).config({ path: path.join(__dirname, '..', 'server', '.env') });
// mongodb is a SERVER dependency; scripts/ has no node_modules of its own.
const { MongoClient } = require(path.join(__dirname, '..', 'server', 'node_modules', 'mongodb'));

const ROLLBACK = path.join(__dirname, '.collectors-to-incharge.rollback.json');
const argv = process.argv.slice(2);
const has = (f) => argv.indexOf(f) >= 0;
const valueOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const APPLY = has('--apply');
const ROLLBACK_MODE = has('--rollback');
const ONLY = (valueOf('--only') || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI is not set (server/.env).'); process.exit(1); }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 20000 });
  await client.connect();
  const users = client.db(process.env.DB_NAME || 'unico').collection('users');

  if (ROLLBACK_MODE) {
    if (!fs.existsSync(ROLLBACK)) { console.error('No rollback file — nothing to undo.'); process.exit(1); }
    const names = JSON.parse(fs.readFileSync(ROLLBACK, 'utf8')).usernames || [];
    if (!names.length) { console.log('Rollback file is empty; nothing to do.'); await client.close(); return; }
    const r = await users.updateMany({ username: { $in: names }, role: 'incharge' }, { $set: { role: 'collector', updatedAt: Date.now() } });
    console.log('Rolled back ' + r.modifiedCount + ' of ' + names.length + ' account(s) to collector.');
    fs.unlinkSync(ROLLBACK);
    await client.close();
    return;
  }

  const q = ONLY.length ? { role: 'collector', username: { $in: ONLY } } : { role: 'collector' };
  const targets = await users.find(q, { projection: { username: 1, name: 1, departments: 1, _id: 0 } }).toArray();

  if (!targets.length) { console.log('No collector accounts match. Nothing to do.'); await client.close(); return; }

  console.log((APPLY ? 'Promoting' : 'WOULD promote') + ' ' + targets.length + ' account(s) to in-charge:\n');
  targets.forEach((u, i) => {
    const dep = (u.departments || []).join(', ') || 'no department assigned';
    console.log('  ' + String(i + 1).padStart(2) + '. ' + String(u.username).padEnd(16) + (u.name || '').padEnd(26) + dep);
  });

  if (!APPLY) {
    console.log('\nDry run — nothing was changed. Re-run with --apply to make it so.');
    await client.close();
    return;
  }

  const names = targets.map((u) => u.username);
  // Written BEFORE the update: if the process dies mid-write, the rollback list still
  // names everyone who might have been promoted.
  fs.writeFileSync(ROLLBACK, JSON.stringify({ at: new Date().toISOString(), usernames: names }, null, 2));

  const res = await users.updateMany({ username: { $in: names }, role: 'collector' }, { $set: { role: 'incharge', updatedAt: Date.now() } });
  console.log('\nPromoted ' + res.modifiedCount + ' account(s).');
  console.log('Rollback list written to ' + path.relative(process.cwd(), ROLLBACK));
  console.log('Undo at any time with:  node scripts/collectors-to-incharge.js --rollback');

  const after = await users.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }]).toArray();
  console.log('\nRoles now: ' + after.map((x) => x._id + '=' + x.n).join('  '));
  await client.close();
}

main().catch((e) => { console.error('FAILED: ' + e.message); process.exit(1); });
