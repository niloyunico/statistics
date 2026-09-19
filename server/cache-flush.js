/* UNICO — invalidate the shared read cache by hand.
 *
 * WHEN YOU NEED THIS
 * Invalidation is normally automatic: every write through db.getDbHandle() bumps the
 * version of the collection it touched (see cache.js instrument()), and the whole
 * fleet notices on its next lookup. That covers the app itself completely.
 *
 * It does NOT cover writes the app never saw:
 *   - a maintenance script in scripts/ that opens its own MongoClient;
 *   - an edit made by hand in the Atlas web UI;
 *   - a restore from backup, or a mongorestore / mongoimport.
 *
 * After any of those, the database is right and the deployment keeps serving the copy
 * it already had until each entry's fresh window lapses. That is the "I ran the fix
 * and nothing changed" report. Run this and it is corrected everywhere at once.
 *
 * Usage:
 *   npm --prefix server run cache:flush                 # every cached collection
 *   npm --prefix server run cache:flush -- departments  # just one or a few
 *
 * WHERE THE COUNTERS LIVE
 * Without Redis (the normal setup now) the cache keeps its version counters in the
 * `cacheMeta` document of the SAME MongoDB database the deployment uses, so this must
 * run with that MONGODB_URI. With Redis configured it must use the same Redis
 * credentials. If neither is available it says so plainly and exits 1, so a scheduled
 * job cannot fail silently.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// db.js registers the MongoDB version store the cache uses without Redis ('mongo'
// mode), so it has to be loaded before the mode is decided.
const db = require('./db');
const cache = require('./cache');

(async () => {
  const asked = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const mode = cache.mode();

  if (mode === 'off') {
    console.log('cache-flush: the read cache is disabled (CACHE_DISABLED=true) — every read goes straight to the database. Nothing to flush.');
    process.exit(0);
  }
  if (mode === 'memory') {
    console.error('cache-flush: this process has no shared store to invalidate.');
    console.error('');
    console.error('  Nothing was flushed. Set MONGODB_URI in server/.env to the database the');
    console.error('  deployment uses (the cache keeps its version counters there), or the Redis');
    console.error('  REST credentials if the deployment uses Redis. A bump written here would');
    console.error('  otherwise go nowhere and the live site would keep serving what it has.');
    process.exit(1);
  }
  if (mode === 'mongo') await db.getDbHandle();   // connect before moving the counters

  const results = await cache.flush(asked);
  const lost = results.filter((r) => !r.shared);

  results.forEach((r) => {
    console.log('  ' + (r.shared ? 'flushed ' : 'FAILED  ') + r.coll
      + (r.shared && r.version != null ? '   (version now ' + r.version + ')' : '')
      + (r.error ? '   (' + r.error + ')' : ''));
  });

  try { await db.close(); } catch (e) { /* exiting anyway */ }
  if (lost.length) {
    console.error('\ncache-flush: ' + lost.length + ' of ' + results.length
      + ' did not reach the shared store — those collections are still being served from cache.');
    process.exit(1);
  }
  console.log('\ncache-flush: ' + results.length + ' collection(s) invalidated fleet-wide (' + mode + ').');
  process.exit(0);
})().catch((e) => {
  console.error('cache-flush FAILED: ' + (e && e.stack || e));
  process.exit(1);
});
