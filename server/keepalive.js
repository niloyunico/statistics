/* UNICO — database keep-alive.
 *
 * MongoDB Atlas pauses an idle cluster. When that happens the app comes back with
 * "database unreachable" until somebody logs into Atlas and resumes it by hand, which
 * is a miserable way to start a shift. One tiny write per day is enough to keep the
 * cluster counted as active.
 *
 * Deliberately ONE round trip per ping — a single findOneAndUpdate upsert on a
 * dedicated `keepalive` collection. It is a real write (a plain `ping` admin command
 * does not always register as cluster activity) and it touches nothing the app uses,
 * so it can never disturb real data. The document doubles as a visible record of when
 * the database was last known to be reachable.
 *
 * Two triggers, because this app runs in two shapes:
 *   - the long-running PC server (npm run web) -> the in-process timer in start()
 *   - the Vercel deployment (serverless: no process stays alive between requests)
 *     -> the daily cron in vercel.json calls GET /api/keepalive
 * Either one alone keeps the cluster awake; running both is harmless.
 *
 * Env:
 *   KEEPALIVE_HOURS   interval for the in-process timer (default 24; 0 disables it)
 *   CRON_SECRET       when set, GET /api/keepalive requires
 *                     `Authorization: Bearer <CRON_SECRET>`. Vercel sends this header
 *                     to its own cron invocations automatically once the variable is
 *                     defined in the project, so setting it is all that is required.
 */
const { getDbHandle, warmCache } = require('./db');

const COLLECTION = 'keepalive';
const DOC_ID = 'heartbeat';

// One query. Returns when the previous ping happened so a missed day is visible.
//
// opts.warm — after the ping, re-read every shared dataset so the Redis copy that has
// to rescue an outage (see cache.js) is itself current. Without this the fallback
// copy would only ever be as fresh as the last real visitor, which is precisely the
// wrong property for something whose whole job is to cover a quiet period.
async function ping(source, opts) {
  const db = await getDbHandle();
  if (!db) return { ok: false, skipped: 'no database configured' };
  const now = new Date();
  const res = await db.collection(COLLECTION).findOneAndUpdate(
    { _id: DOC_ID },
    { $set: { lastPing: now, source: source || 'timer' }, $inc: { pings: 1 } },
    { upsert: true, returnDocument: 'before' }
  );
  // Driver versions differ on whether the document is wrapped in { value }.
  const prev = res && Object.prototype.hasOwnProperty.call(res, 'value') ? res.value : res;
  const previous = prev && prev.lastPing ? new Date(prev.lastPing) : null;
  const out = {
    ok: true,
    at: now.toISOString(),
    previous: previous ? previous.toISOString() : null,
    sinceHours: previous ? Math.round((now - previous) / 36e5) : null,
    pings: (prev && prev.pings ? prev.pings : 0) + 1,
    source: source || 'timer',
  };
  if (!opts || opts.warm !== false) {
    try { out.warmed = await warmCache(); } catch (e) { out.warmed = { error: String(e.message || e) }; }
  }
  return out;
}

// In-process daily timer, for the PC server that stays running. unref()'d so it can
// never be the reason the process refuses to exit; the HTTP listener keeps it alive.
function start(opts) {
  const hours = Number(process.env.KEEPALIVE_HOURS != null ? process.env.KEEPALIVE_HOURS : 24);
  if (!(hours > 0)) return null;                       // KEEPALIVE_HOURS=0 disables it
  if (!process.env.MONGODB_URI) return null;           // dev in-memory mode: nothing to keep alive
  const quiet = !!(opts && opts.quiet);

  const run = (why) => ping(why).then((r) => {
    if (!quiet && r.ok) console.log('[keepalive] database pinged (' + why + ')' + (r.sinceHours != null ? ', ' + r.sinceHours + 'h since the last one' : ''));
  }).catch((e) => {
    console.warn('[keepalive] ping failed: ' + (e && e.message || e));
  });

  // A ping shortly after boot proves the connection works, without racing startup seeding.
  const boot = setTimeout(() => run('startup'), 30000);
  if (boot.unref) boot.unref();
  const iv = setInterval(() => run('timer'), hours * 3600 * 1000);
  if (iv.unref) iv.unref();
  return iv;
}

// GET /api/keepalive — what the Vercel cron (and any external uptime pinger) calls.
// Unauthenticated on purpose when CRON_SECRET is unset: it reveals nothing but a
// timestamp, and a cron request carries no session cookie.
// Warming re-reads every shared dataset, so it is FAR more expensive than the ping it
// accompanies. The endpoint is deliberately open (a cron request carries no cookie), so
// an anonymous caller must not be able to turn it into a full-collection read amplifier
// — one curl loop would hammer Atlas and burn the Redis quota. Warm only for a request
// that is actually the cron, and never more often than this.
const WARM_MIN_GAP_MS = 60000;
let lastWarmAt = 0;

function mount(app) {
  app.get('/api/keepalive', async (req, res) => {
    const secret = process.env.CRON_SECRET;
    const authed = !secret || String(req.headers.authorization || '') === 'Bearer ' + secret;
    if (secret && !authed) return res.status(401).json({ ok: false, error: 'Unauthorized.' });
    const source = req.headers['x-vercel-cron'] ? 'vercel-cron' : 'http';
    const trusted = !!req.headers['x-vercel-cron'] || !!secret;
    const now = Date.now();
    const warm = trusted && (now - lastWarmAt) > WARM_MIN_GAP_MS;
    if (warm) lastWarmAt = now;
    try {
      const r = await ping(source, { warm });
      res.set('Cache-Control', 'no-store');
      res.json(r);
    } catch (e) {
      res.status(503).json({ ok: false, error: 'Database unreachable.' });
    }
  });
}

module.exports = { ping, start, mount, COLLECTION, DOC_ID };

// Run once and exit:  node server/keepalive.js   (or: npm --prefix server run keepalive)
// Use this from Windows Task Scheduler / cron when the app server is not kept running
// and you are not relying on the Vercel cron. Exit code 1 if the database was unreachable,
// so the scheduler can report a real failure instead of silently doing nothing.
if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '.env') });
  if (!process.env.VERCEL) {
    try { require('dns').setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']); } catch (e) { /* ignore */ }
  }
  ping('manual')
    .then((r) => {
      if (!r.ok) { console.log('keepalive: ' + (r.skipped || 'nothing to do')); process.exit(0); }
      console.log('keepalive: database pinged at ' + r.at
        + (r.previous ? ' (previous ' + r.previous + ', ' + r.sinceHours + 'h ago)' : ' (first ping)'));
      return require('./db').closeClient();
    })
    .then(() => process.exit(0))
    .catch((e) => { console.error('keepalive FAILED: ' + (e && e.message || e)); process.exit(1); });
}
