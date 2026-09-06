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
  // PUT /api/data records itself (see index.js): only that route still holds the
  // previous values, so only it can say WHICH records changed. Logging here as well
  // would file a vague duplicate beside every useful entry.
  /^\/api\/data$/,
];

// Record ids in the path made every entry unique -- "patch /api/submissions/sub-mtk0..."
// -- which both read as noise and defeated the repeat collapsing below. The id belongs
// in the detail (which keeps the full route), not in the name of the action.
const ID_SEG = /^(?:[0-9]+|[0-9a-f]{8,}|[a-z]+-[a-z0-9]{6,}.*|[A-Za-z0-9_-]{18,})$/;
function nameFor(method, path) {
  const key = method + ' ' + path;
  for (const [re, n] of NAMES) if (re.test(key)) return n;
  const generic = path.split('/').map((seg) => (ID_SEG.test(seg) ? ':id' : seg)).join('/');
  return method.toLowerCase() + ' ' + generic;
}

/* What actually changed inside one app-state key, in words.

   The browser mirrors whole localStorage values, so the raw diff is "a 98 KB string
   became a different 98 KB string" -- useless in an audit trail. These overlays are
   either a LIST of records (staff) or a MAP of them, so parse both sides and report
   the records that appeared, vanished or differ, by name. Bounded on purpose: parsing
   is skipped above ~1.5 MB and at most three names are quoted, because this runs on
   the save path and must never become the expensive part of it. */
const MAX_PARSE = 1.5 * 1024 * 1024;
function labelOf(rec, id) {
  if (!rec || typeof rec !== 'object') return String(id);
  return String(rec.name || rec.title || rec.label || rec.staffName || rec.emp_id || id);
}
function describeChange(prevStr, nextStr) {
  try {
    if (typeof nextStr !== 'string' || nextStr.length > MAX_PARSE) return '';
    if (typeof prevStr !== 'string') return 'first save';
    if (prevStr.length > MAX_PARSE) return '';
    const a = JSON.parse(prevStr), b = JSON.parse(nextStr);
    const idx = (v) => {
      const m = new Map();
      if (Array.isArray(v)) v.forEach((x, i) => m.set(String((x && (x.id != null ? x.id : x.emp_id)) != null ? (x.id != null ? x.id : x.emp_id) : i), x));
      else if (v && typeof v === 'object') Object.keys(v).forEach((k) => m.set(k, v[k]));
      else return null;
      return m;
    };
    const ma = idx(a), mb = idx(b);
    if (!ma || !mb) return 'updated';
    const added = [], removed = [], changed = [];
    mb.forEach((v, k) => {
      if (!ma.has(k)) added.push(labelOf(v, k));
      else if (JSON.stringify(ma.get(k)) !== JSON.stringify(v)) changed.push(labelOf(v, k));
    });
    ma.forEach((v, k) => { if (!mb.has(k)) removed.push(labelOf(v, k)); });
    const part = (verb, list) => (list.length
      ? verb + ' ' + list.slice(0, 3).join(', ') + (list.length > 3 ? ' +' + (list.length - 3) + ' more' : '')
      : null);
    const bits = [part('added', added), part('edited', changed), part('removed', removed)].filter(Boolean);
    return bits.join('; ') || 'no visible change';
  } catch (e) { return ''; }
}

// What each app-state key actually holds — so an app_data_saved entry reads
// "Saved: staff register" instead of "PUT /api/data (unico_staff_v3)".
// Mirrors KEY_MODULE in server/access.js; unknown keys fall through verbatim.
const KEY_LABELS = {
  unico_store_v3: 'department statistics workspace',
  unico_quality_v2: 'quality indicators',
  unico_capa_v1: 'quality CAPA statuses',
  unico_lock_v1: 'quality locks',
  unico_manual_meta: 'quality manual metadata',
  unico_staff_v3: 'staff register (nurses / PCA)',
  unico_staff_customfields_v1: 'staff custom fields',
  unico_staff_fieldopts_v1: 'staff field options',
  unico_qc_report_presets_v1: 'quality report presets',
  unico_report_builder_v1: 'report builder layouts',
  unico_report_sig_v1: 'report sign-off names',
  unico_users_v1: 'legacy user list',
  unico_med_fav_v1: 'saved medicines',
  unico_med_recent_v1: 'recently viewed medicines',
};

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
      // The one body field worth keeping: WHICH app-state key a save touched —
      // named in plain words, since "unico_staff_v3" means nothing to an auditor.
      let detail = method + ' ' + path;
      if (path === '/api/data' && req.body && typeof req.body === 'object') {
        const keys = Object.keys(req.body.data || req.body).filter((x) => x !== 'ts').slice(0, 4);
        if (keys.length) detail = 'Saved: ' + keys.map((x) => KEY_LABELS[x] || x).join(', ') + ' · ' + method + ' ' + path;
      }
      // Dedupe on the full detail, not just the action: a staff save and a quality
      // save minutes apart are DIFFERENT activity, only true repeats collapse.
      const k = (who.username || 'local') + '|' + action + '|' + detail;
      const now = Date.now();
      const last = recent.get(k) || 0;
      if (now - last < QUIET_MS) return;
      recent.set(k, now);
      if (recent.size > 2000) {                                   // never grow unbounded
        for (const [key, ts] of recent) if (now - ts > QUIET_MS) recent.delete(key);
      }
      activity.record(Object.assign({}, who, { action, detail, ip: activity.ipOf(req) }));
    } catch (e) { /* auditing must never break the request path */ }
  });
  next();
}

module.exports = { middleware, describeChange, KEY_LABELS };
