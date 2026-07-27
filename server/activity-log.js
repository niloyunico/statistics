/* Admin ACTIVITY LOG — records authentication + user-management events for the
   Settings → Activity Log view.

   Best-effort by design: recording NEVER throws into the caller (a logging failure
   must not break a login or an admin action), and it falls back to an in-memory ring
   buffer when no database is configured (dev / open local mode). With MongoDB it
   writes to the `activity_log` collection. */
const db = require('./db');

const COLL = 'activity_log';
const MEM = [];            // dev fallback, newest last
const MEM_CAP = 1000;

// Who performed the action — from the verified JWT claims (req.user) when signed in,
// or the open local-PC session otherwise.
function actorOf(req) {
  const u = req && req.user;
  if (u && (u.sub || u.name)) return { username: u.sub || '', name: u.name || u.sub || '', role: u.role || '' };
  return { username: '', name: 'Local session', role: 'Administrator' };
}
function ipOf(req) {
  if (!req) return '';
  const xf = (req.headers && req.headers['x-forwarded-for']) || '';
  return String(xf).split(',')[0].trim() || req.ip || (req.socket && req.socket.remoteAddress) || '';
}

async function record(entry) {
  try {
    const row = {
      ts: entry.ts || Date.now(),
      action: String(entry.action || 'event'),
      username: String(entry.username || ''),
      name: String(entry.name || ''),
      role: String(entry.role || ''),
      target: entry.target != null ? String(entry.target) : '',
      detail: entry.detail != null ? String(entry.detail) : '',
      ip: String(entry.ip || ''),
    };
    const h = await db.getDbHandle().catch(() => null);
    if (h) { await h.collection(COLL).insertOne(row); }
    else { MEM.push(row); if (MEM.length > MEM_CAP) MEM.splice(0, MEM.length - MEM_CAP); }
  } catch (e) { /* logging must never break the request path */ }
}

// Convenience: derive actor + IP from a request and record an action.
function log(req, action, opts) {
  const a = actorOf(req);
  return record({ action, username: a.username, name: a.name, role: a.role, ip: ipOf(req),
    target: opts && opts.target, detail: opts && opts.detail });
}

function mount(app, o) {
  const requireApi = (o && o.requireApi) || ((req, res, next) => { req.user = null; next(); });
  const adminOnly = (req, res, next) => {
    if (req.user && req.user.role && req.user.role !== 'Administrator') {
      return res.status(403).json({ ok: false, error: 'Administrator access required.' });
    }
    next();
  };
  const guard = [requireApi, adminOnly];

  // Recent activity, newest first.
  app.get('/api/activity', guard, async (req, res) => {
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 250));
    try {
      const h = await db.getDbHandle().catch(() => null);
      let rows;
      if (h) rows = await h.collection(COLL).find({}).sort({ ts: -1 }).limit(limit).toArray();
      else rows = MEM.slice(-limit).reverse();
      res.json({ ok: true, entries: rows.map((r) => ({ ts: r.ts, action: r.action, username: r.username, name: r.name, role: r.role, target: r.target, detail: r.detail, ip: r.ip })) });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not load the activity log.' }); }
  });

  // Clear the log (admin only).
  app.delete('/api/activity', guard, async (req, res) => {
    try {
      const h = await db.getDbHandle().catch(() => null);
      if (h) await h.collection(COLL).deleteMany({}); else MEM.length = 0;
      log(req, 'activity_cleared', {});
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not clear the activity log.' }); }
  });
}

module.exports = { record, log, mount, actorOf, ipOf };
