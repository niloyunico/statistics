/* AUDIT — every WRITE by every signed-in person lands in the Activity Log.
 *
 * Until now only sign-in/sign-out (and a handful of hand-instrumented actions like
 * photo uploads and media deletes) were recorded, so the Activity Log answered
 * "who logged in" but not "who changed what". This middleware closes that gap in
 * one place: every successful mutating call on /api/* is recorded with the actor
 * from the live session, a readable action name, and the route it hit — instead
 * of hoping every future endpoint remembers to log itself.
 *
 * WHAT IS DELIBERATELY NOT RECORDED
 *   - GET/HEAD/OPTIONS: reads are not activity, and logging them would bury the
 *     writes under thousands of page loads.
 *   - Request bodies: a body can carry a password or a whole staff register.
 *     Only the route (and a body-free hint like the app-state key) is stored.
 *   - Failures (4xx/5xx): a rejected request changed nothing. The one exception
 *     is already handled elsewhere — login_failed has its own richer record.
 *   - /api/login and /login: recorded by the login handler with more context.
 *
 * FLOOD CONTROL
 * The app mirrors state with PUT /api/data on a debounce, so one editing session
 * can fire dozens of identical writes. Repeats of the same (user, action) within
 * QUIET_MS collapse into the first record — the log stays a log, not a seismograph.
 */
const activity = require('./activity-log');

const QUIET_MS = 2 * 60 * 1000;
const recent = new Map();   // "user|action" -> last recorded ts

// Readable names for the routes people actually use; anything unlisted falls back
// to "<verb> <route>" so a new endpoint is never invisible, just less pretty.
const NAMES = [
  [/^PUT \/api\/data$/, 'app_data_saved'],
  [/^PATCH \/api\/me$/, 'profile_updated'],
  [/^POST \/api\/me\/password$/, 'password_changed'],
  [/^POST \/api\/upload$/, 'photo_upload'],          // photos.js records richer detail; throttle dedupes
  [/^DELETE \/api\/upload$/, 'photo_delete'],
  [/^(POST|PUT) \/api\/rosters/, 'roster_saved'],
  [/^DELETE \/api\/rosters/, 'roster_deleted'],
  [/^POST \/api\/submissions/, 'submission_sent'],
  [/^(POST|PATCH) \/api\/staff-requests/, 'staff_request'],
  [/^POST \/api\/performance/, 'performance_saved'],
  [/^PUT \/api\/performance/, 'performance_saved'],
  [/^(POST|PUT|PATCH) \/api\/users/, 'user_account_changed'],
  [/^DELETE \/api\/users/, 'user_account_deleted'],
  [/^(POST|PUT) \/api\/quality/, 'quality_saved'],
  [/^(POST|PUT|DELETE) \/api\/departments/, 'departments_changed'],
  [/^(POST|PUT|DELETE) \/api\/med/, 'medicine_changed'],
  [/^(POST|PUT|DELETE) \/api\/supervisor/, 'supervisor_report_saved'],
];
const SKIP = [
  /^\/api\/login$/,          // the login handler records success AND failure itself
  /^\/api\/report-pdf$/,     // rendering a PDF mutates nothing
  /^\/api\/keepalive/,       // the cron ping is not a person
];

function nameFor(method, path) {
  const key = method + ' ' + path;
  for (const [re, n] of NAMES) if (re.test(key)) return n;
  return method.toLowerCase() + ' ' + path;
}

function middleware(req, res, next) {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();
  const path = (req.originalUrl || req.url || '').split('?')[0];
  if (!path.startsWith('/api/') || SKIP.some((re) => re.test(path))) return next();

  res.on('finish', () => {
    try {
      if (res.statusCode < 200 || res.statusCode >= 300) return;   // nothing changed
      const who = activity.actorOf(req);
      const action = nameFor(method, path);
      const k = (who.username || 'local') + '|' + action;
      const now = Date.now();
      const last = recent.get(k) || 0;
      if (now - last < QUIET_MS) return;
      recent.set(k, now);
      if (recent.size > 2000) {                                   // never grow unbounded
        for (const [key, ts] of recent) if (now - ts > QUIET_MS) recent.delete(key);
      }
      // The one body field worth keeping: WHICH app-state key a save touched —
      // "unico_staff_v3" tells an auditor far more than "PUT /api/data".
      let detail = method + ' ' + path;
      if (path === '/api/data' && req.body && typeof req.body === 'object') {
        const keys = Object.keys(req.body.data || req.body).filter((x) => x !== 'ts').slice(0, 4);
        if (keys.length) detail += ' (' + keys.join(', ') + ')';
      }
      activity.record(Object.assign({}, who, { action, detail, ip: activity.ipOf(req) }));
    } catch (e) { /* auditing must never break the request path */ }
  });
  next();
}

module.exports = { middleware };
