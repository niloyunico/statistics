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
 *   - a restore from backup, or a mongorestore / mongoimport;
 *   - a script run from a machine whose .env has no Redis credentials — the bump is
 *     then written to that process's own in-memory stand-in and dies with it, which
 *     looks exactly like success and is the trap worth knowing about.
 *
 * After any of those, the database is right and the deployment keeps serving the copy
 * it already had until each entry's fresh window lapses. That is the "I ran the fix
 * and nothing changed" report. Run this and it is corrected everywhere at once.
 *
 * Usage:
 *   npm --prefix server run cache:flush                 # every cached collection
 *   npm --prefix server run cache:flush -- departments  # just one or a few
 *
 * IMPORTANT: it must run with the SAME Redis credentials the deployment uses, or it
 * has nothing to talk to. It says so plainly if that is not the case, and exits 1 —
 * so a scheduled job cannot fail silently.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const redis = require('./redis');
const cache = require('./cache');

(async () => {
  const asked = process.argv.slice(2).filter((a) => !a.startsWith('-'));

  if (!redis.configured()) {
    console.error('cache-flush: no Redis is configured for this process.');
    console.error('');
    console.error('  Nothing was flushed. The deployment reads its invalidation counters from');
    console.error('  Redis, so a bump written here would go nowhere and the live site would keep');
    console.error('  serving the data it already has.');
    console.error('');
    console.error('  Fix: copy UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or the');
    console.error('  KV_REST_API_* pair) from the Vercel project into server/.env, so scripts run');
    console.error('  here invalidate the same cache the fleet reads.');
    process.exit(1);
  }

  const results = await cache.flush(asked);
  const lost = results.filter((r) => !r.shared);

  results.forEach((r) => {
    console.log('  ' + (r.shared ? 'flushed ' : 'FAILED  ') + r.coll
      + (r.shared && r.version != null ? '   (version now ' + r.version + ')' : ''));
  });

  if (lost.length) {
    console.error('\ncache-flush: ' + lost.length + ' of ' + results.length
      + ' did not reach the shared store — those collections are still being served from cache.');
    process.exit(1);
  }
  console.log('\ncache-flush: ' + results.length + ' collection(s) invalidated fleet-wide.');
  process.exit(0);
})().catch((e) => {
  console.error('cache-flush FAILED: ' + (e && e.stack || e));
  process.exit(1);
});
