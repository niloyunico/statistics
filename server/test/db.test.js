/* Data-layer self-test — the save path that people experience as
   "sometimes it doesn't submit".

   Needs a real MongoDB (it uses a THROWAWAY database, `unico_selftest`, and drops it
   at the end — it never touches the live `unico` data). Skips itself when MONGODB_URI
   is not configured, so it is safe to run anywhere.

   Run: npm run test:db
*/
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

if (!process.env.MONGODB_URI) {
  console.log('[db.test] no MONGODB_URI configured — skipping (this test needs a real database).');
  process.exit(0);
}
if (!process.env.VERCEL) {
  try { require('dns').setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']); } catch (e) { /* ignore */ }
}

const LIVE_URI = process.env.MONGODB_URI;
process.env.DB_NAME = 'unico_selftest';    // never the real database
const db = require('../db');

let pass = 0, fail = 0;
const eq = (name, a, b) => {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A === B) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + '\n        got      ' + A + '\n        expected ' + B); }
};
const ok = (name, cond) => { if (cond) { pass++; console.log('  PASS  ' + name); } else { fail++; console.log('  FAIL  ' + name); } };

(async () => {
  console.log('\n== two people saving at once ==');
  // Whole-document writes made this a lost-update machine: both tabs mirror their ENTIRE
  // localStorage, so whoever saved last silently discarded the other's work — with no
  // error shown anywhere. Field-level writes mean edits to different modules coexist.
  await db.setAppData({ unico_store_v3: 'stats-v1', unico_staff_v3: 'staff-v1', unico_quality_v2: 'qual-v1' });
  const base = (await db.getAppData()).data;
  eq('baseline stored', Object.keys(base).sort(), ['unico_quality_v2', 'unico_staff_v3', 'unico_store_v3']);

  const tabA = Object.assign({}, base, { unico_store_v3: 'stats-EDITED-BY-A' });
  const tabB = Object.assign({}, base, { unico_quality_v2: 'qual-EDITED-BY-B' });
  await db.setAppData(tabA, base);   // A saves
  await db.setAppData(tabB, base);   // B saves from the SAME baseline moments later

  const after = (await db.getAppData()).data;
  eq("A's edit survived B's save", after.unico_store_v3, 'stats-EDITED-BY-A');
  eq("B's edit was stored", after.unico_quality_v2, 'qual-EDITED-BY-B');
  eq('the module neither touched is intact', after.unico_staff_v3, 'staff-v1');

  console.log('\n== deletions still apply ==');
  await db.setAppData({ unico_store_v3: after.unico_store_v3, unico_quality_v2: after.unico_quality_v2 }, after);
  eq('a key the client dropped is removed', Object.keys((await db.getAppData()).data).sort(), ['unico_quality_v2', 'unico_store_v3']);

  console.log('\n== no baseline falls back to a whole-document write ==');
  await db.setAppData({ only: 'this' });
  eq('whole-document replace still works', Object.keys((await db.getAppData()).data), ['only']);

  console.log('\n== a failed connection must not poison the process ==');
  // One bad connect used to cache a dead client, so every later request failed until
  // somebody restarted the server. That is "it stopped saving and only a restart fixed it".
  //
  // Checked through db.dbRead() — the UNCACHED path. getAppData() is now covered by the
  // warmup cache (server/cache.js) and answers an unreachable database from the last
  // known-good copy, which is exactly what that cache is for but would hide the thing
  // this check is actually about. Both properties are asserted below.
  const readRaw = () => db.dbRead((d) => d.collection('appdata').findOne({ _id: 'shared' }));
  const handle = await db.getDbHandle();
  if (handle) await handle.dropDatabase();
  await db.closeClient();
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=2000';
  let broke = false;
  try { await readRaw(); } catch (e) { broke = true; }
  ok('an unreachable database reports an error', broke);

  // ...and the app itself keeps working, because the cached copy stands in for it.
  let rescued = null;
  try { rescued = await db.getAppData({ fresh: true }); } catch (e) { /* nothing held */ }
  ok('the cached copy covers for an unreachable database', !!(rescued && rescued.data && rescued.data.only === 'this'));

  process.env.MONGODB_URI = LIVE_URI;
  let recovered = false;
  try { await readRaw(); recovered = true; } catch (e) { /* still broken */ }
  ok('the very next request reconnects — no restart needed', recovered);

  const h2 = await db.getDbHandle();
  if (h2) await h2.dropDatabase();
  await db.closeClient();

  console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' + (pass + fail) : 'ALL ' + pass + ' PASSED'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERROR: ' + (e && e.message || e)); process.exit(1); });
