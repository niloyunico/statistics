/* UNICO — the phone apps' backend (Nurse App + Admin App).
 *
 * Everything the two phone apps show that the console had no store for lives here:
 * notices, chat rooms and messages, swap/leave requests, shift handover, incident
 * reports, shift reports, medicine requests, per-user app state, and the ONE settings
 * document an administrator edits in the Admin App (which phone features each role
 * may open, department / user overrides, approval chains, clusters, custom modules).
 *
 * SECURITY MODEL — decided here, never in the renderer
 *   - Every route sits behind session.requireApi + access.attach, so req.access is the
 *     LIVE user document (deactivated / revoked accounts die at the door).
 *   - A portal account (nurse, pca, collector, incharge) is scoped to the departments on
 *     its account. It only ever reads its own unit's rooms, handover, requests and shift
 *     reports; hospital-wide rooms and notices reach everyone by design.
 *   - Deciding a request, approving a shift report, closing an incident, answering a
 *     medicine request and editing the settings need the matching authority: the unit's
 *     in-charge, a console user with the module permission, or an administrator.
 *   - The feature matrix (settings.features + overrides) is enforced on the server for
 *     every action it names, not merely hidden in menus: a role whose "Post
 *     announcements" is off gets 403 from POST /api/phone/notices.
 *   - Inputs are length-capped and whitelisted; ids are generated server-side; who did
 *     what is stamped from the session, never taken from the body; writes are recorded
 *     in the activity log.
 *
 * STORE: MongoDB collections (phone*), with the same in-memory fallback the other
 * modules use when no MONGODB_URI is configured (local development only).
 */
'use strict';
const { getDbHandle, getUsers, getDepartments, getQuality } = require('./db');
// Staff come from the saved register, not the `staff` collection: that collection is the
// July import, so it lacks everyone added since and every edit made on the console.
const { loadRoster } = require('./staff-roster');
const staffRegister = () => loadRoster({ cached: true });
const access = require('./access');
const activity = require('./activity-log');
const deptmap = require('./deptmap');
const rosterMod = require('./duty-roster');

/* ------------------------------------------------------------------ store --- */
const COLLS = { notices: 'phoneNotices', rooms: 'phoneRooms', messages: 'phoneMessages', requests: 'phoneRequests', handover: 'phoneHandover', incidents: 'phoneIncidents', shiftReports: 'phoneShiftReports', medRequests: 'phoneMedRequests', settings: 'phoneSettings', userState: 'phoneUserState' };
const mem = {};
const memList = (n) => (mem[n] = mem[n] || []);
async function col(n) { const db = await getDbHandle().catch(() => null); return db ? db.collection(COLLS[n]) : null; }
const genId = (p) => p + '-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e8).toString(36);
const outDoc = (d) => { if (!d) return null; const { _id, ...r } = d; return Object.assign({ id: _id }, r); };
// The in-memory fallback understands the few filter shapes this module uses.
function matches(f) {
  return (x) => Object.keys(f || {}).every((k) => {
    const want = f[k], have = x[k];
    if (want && typeof want === 'object' && !Array.isArray(want)) {
      if ('$in' in want) return want.$in.indexOf(have) >= 0 || (Array.isArray(have) && have.some((h) => want.$in.indexOf(h) >= 0));
      if ('$gt' in want) return have > want.$gt;
      if ('$gte' in want) return have >= want.$gte;
      if ('$lte' in want) return have <= want.$lte;
      if ('$elemMatch' in want) return Array.isArray(have) && have.some(matches(want.$elemMatch));
      return false;
    }
    return Array.isArray(have) ? have.indexOf(want) >= 0 : have === want;
  });
}
async function list(n, filter, sort, limit) {
  const c = await col(n);
  if (c) { let cur = c.find(filter || {}); if (sort) cur = cur.sort(sort); if (limit) cur = cur.limit(limit); return (await cur.toArray()).map(outDoc); }
  let rows = memList(n).filter(matches(filter));
  if (sort) { const [k, dir] = Object.entries(sort)[0]; rows = rows.slice().sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * (dir < 0 ? -1 : 1)); }
  return limit ? rows.slice(0, limit) : rows;
}
async function getOne(n, id) { const c = await col(n); if (c) return outDoc(await c.findOne({ _id: id })); return memList(n).find((x) => x.id === id) || null; }
async function insert(n, doc) {
  const id = doc.id || genId(n); const { id: _omit, ...rest } = doc;
  const c = await col(n);
  if (c) await c.insertOne(Object.assign({ _id: id }, rest)); else memList(n).unshift(Object.assign({ id }, rest));
  return Object.assign({ id }, rest);
}
async function update(n, id, patch) {
  const c = await col(n);
  if (c) { await c.updateOne({ _id: id }, { $set: patch }); return outDoc(await c.findOne({ _id: id })); }
  const x = memList(n).find((y) => y.id === id); if (x) Object.assign(x, patch); return x || null;
}
async function upsert(n, id, doc) {
  const c = await col(n);
  if (c) { await c.updateOne({ _id: id }, { $set: doc }, { upsert: true }); return outDoc(await c.findOne({ _id: id })); }
  const cur = memList(n).find((y) => y.id === id); if (cur) { Object.assign(cur, doc); return cur; }
  const rec = Object.assign({ id }, doc); memList(n).unshift(rec); return rec;
}
async function remove(n, id) { const c = await col(n); if (c) await c.deleteOne({ _id: id }); else { const i = memList(n).findIndex((y) => y.id === id); if (i >= 0) memList(n).splice(i, 1); } }

/* -------------------------------------------------------------- helpers --- */
const s = (v, max) => String(v == null ? '' : v).slice(0, max || 200).trim();
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const arr = (v) => (Array.isArray(v) ? v : []);
const bool = (v) => v === true || v === 'true' || v === 1;
const num = (v, lo, hi) => { const n = Number(v); if (!isFinite(n)) return 0; return Math.min(hi == null ? Infinity : hi, Math.max(lo == null ? -Infinity : lo, n)); };
const pick = (o, keys) => keys.reduce((a, k) => { if (o[k] !== undefined) a[k] = o[k]; return a; }, {});
const nowMs = () => Date.now();
const dateOK = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);
// A simple per-user write limiter: a phone that sends 40 chat messages a minute is
// not a nurse typing; it is a script.
const rate = {};
function limited(username, key, max, windowMs) {
  const k = username + '|' + key, now = nowMs();
  const r = rate[k] = (rate[k] || []).filter((t) => now - t < windowMs);
  if (r.length >= max) return true;
  r.push(now); return false;
}

/* --------------------------------------------------------- feature matrix --- */
// The same table the Admin App shows. Role order: nurse, incharge, collector, pca.
const FEATURES = [
  ['home', [1, 1, 1, 1]], ['roster', [1, 1, 1, 1]], ['requests', [1, 1, 1, 1]], ['approvals', [0, 1, 0, 0]], ['handover', [1, 1, 0, 1]],
  ['chatDept', [1, 1, 1, 1]], ['chatHosp', [1, 1, 1, 0]], ['notices', [1, 1, 1, 1]], ['compose', [0, 1, 0, 0]], ['staffDir', [1, 1, 1, 1]], ['phones', [1, 1, 0, 0]],
  ['meds', [1, 1, 1, 0]], ['medReq', [1, 1, 0, 0]], ['incident', [1, 1, 1, 1]], ['performance', [1, 1, 1, 1]],
  ['reports', [0, 1, 0, 0]], ['shiftReport', [0, 1, 0, 0]], ['datacol', [0, 1, 1, 0]], ['datacolHist', [0, 1, 1, 0]], ['rosterEdit', [0, 1, 0, 0]], ['unitStaff', [0, 1, 0, 0]],
];
const FEATURE_IDS = FEATURES.map((f) => f[0]);
const ROLE_ORDER = ['nurse', 'incharge', 'collector', 'pca'];
const DEFAULT_SETTINGS = {
  features: {}, deptOverrides: {}, userOverrides: {},
  rules: { swap: ['incharge'], leave3: ['incharge'], leave7: ['incharge', 'Nurse Manager'], leave8: ['incharge', 'Nurse Manager', 'CNS'], roster: ['Nurse Manager'], shiftrep: ['Nurse Manager'], datacol: ['Quality Officer'], incident: ['Quality Officer', 'CNS'], medreq: ['Nurse Manager'], appraisal: ['incharge', 'Nurse Manager'] },
  escHours: 48, clusters: [], customMods: [],
  hospital: { name: 'Hands of Care Hospitals', app: 'UNICO Nurse', version: '2.1.0' },
  // Ward phonebook shown in the Nurse App directory. [section, label, sub, number]
  phonebook: [
    ['Emergency', 'Code Blue / Rapid Response', 'Dial from any ward phone', '2222'], ['Emergency', 'Fire & security control', '24 h', '2999'], ['Emergency', 'Ambulance desk', 'Transfers and referrals', '+880 1713 000 911'],
    ['Clinical support', 'Blood bank', 'Ground floor · 24 h', '2310'], ['Clinical support', 'Laboratory', 'Sample collection & reports', '2320'], ['Clinical support', 'Radiology', 'X-ray · CT · USG', '2330'], ['Clinical support', 'Pharmacy', 'Ward supply · 8 AM – 10 PM', '2340'],
    ['Administration', 'Nursing office', 'Nurse Manager · Mon – Sat', '1001'], ['Administration', 'Duty roster desk', 'Swaps and leave', '1004'], ['Administration', 'IT & app support', '9 AM – 6 PM', '1090'], ['Administration', 'Housekeeping', 'Linen · cleaning', '1120'],
  ],
  policy: { pinLock: true, portalPhones: true, offline: true, minAppVersion: '2.1.0' },
};
async function settingsDoc() {
  const d = await getOne('settings', 'settings');
  const out = Object.assign({}, DEFAULT_SETTINGS, d || {});
  ['features', 'deptOverrides', 'userOverrides', 'rules', 'hospital', 'policy'].forEach((k) => { out[k] = Object.assign({}, DEFAULT_SETTINGS[k], obj(out[k])); });
  out.clusters = arr(out.clusters); out.customMods = arr(out.customMods); out.phonebook = Array.isArray(out.phonebook) && out.phonebook.length ? out.phonebook : DEFAULT_SETTINGS.phonebook;
  return out;
}
function cleanSettings(b) {
  const i = obj(b), out = {};
  const feats = {}; Object.keys(obj(i.features)).slice(0, 400).forEach((k) => { const [fid, role] = String(k).split(':'); if (FEATURE_IDS.indexOf(fid) >= 0 && ROLE_ORDER.indexOf(role) >= 0) feats[k] = bool(i.features[k]); }); out.features = feats;
  const tri = (m) => { const o = {}; Object.keys(obj(m)).slice(0, 400).forEach((k) => { const v = {}; Object.keys(obj(m[k])).forEach((fid) => { if (FEATURE_IDS.indexOf(fid) >= 0 && ['on', 'off'].indexOf(m[k][fid]) >= 0) v[fid] = m[k][fid]; }); if (Object.keys(v).length) o[s(k, 80)] = v; }); return o; };
  out.deptOverrides = tri(i.deptOverrides); out.userOverrides = tri(i.userOverrides);
  const roleId = (x) => s(x, 60).replace(/[^A-Za-z0-9 &()/-]/g, '').trim();
  const rules = {}; Object.keys(obj(i.rules)).slice(0, 40).forEach((k) => { const key = roleId(k); if (key) rules[key] = arr(i.rules[k]).slice(0, 8).map(roleId).filter(Boolean); }); out.rules = Object.assign({}, DEFAULT_SETTINGS.rules, rules);
  out.escHours = [0, 24, 48, 72].indexOf(Number(i.escHours)) >= 0 ? Number(i.escHours) : 48;
  out.clusters = arr(i.clusters).slice(0, 40).map((c) => ({ id: s(obj(c).id, 40) || genId('cl'), name: s(obj(c).name, 80), manager: s(obj(c).manager, 40), depts: arr(obj(c).depts).slice(0, 60).map((x) => s(x, 80)) })).filter((c) => c.name);
  out.customMods = arr(i.customMods).slice(0, 60).map((m) => { const o = obj(m); return { id: s(o.id, 40) || genId('cm'), name: s(o.name, 80), type: ['checklist', 'form', 'register', 'audit'].indexOf(o.type) >= 0 ? o.type : 'checklist', fields: arr(o.fields).slice(0, 60).map((x) => s(x, 120)).filter(Boolean), roles: arr(o.roles).slice(0, 8).map((x) => s(x, 40)), depts: arr(o.depts).slice(0, 60).map((x) => s(x, 80)), sched: s(o.sched, 40) || 'Every shift', active: o.active !== false }; }).filter((m) => m.name);
  out.phonebook = Array.isArray(i.phonebook) ? i.phonebook.slice(0, 80).map((r) => arr(r).slice(0, 4).map((x) => s(x, 80))).filter((r) => r.length === 4 && r[1] && r[3]) : DEFAULT_SETTINGS.phonebook;
  out.hospital = { name: s(obj(i.hospital).name, 120) || DEFAULT_SETTINGS.hospital.name, app: s(obj(i.hospital).app, 60) || 'UNICO Nurse', version: s(obj(i.hospital).version, 20) || '2.1.0' };
  out.policy = { pinLock: obj(i.policy).pinLock !== false, portalPhones: obj(i.policy).portalPhones !== false, offline: obj(i.policy).offline !== false, minAppVersion: s(obj(i.policy).minAppVersion, 20) || '2.1.0' };
  return out;
}
// The console roles map onto the in-charge feature set on the phone; administrators
// get everything. Portal roles use their own column.
function roleKeyOf(ctx) { if (ctx.isAdmin) return 'admin'; if (ctx.isPortal) return ctx.role; return 'incharge'; }
function effectiveFeatures(ctx, settings) {
  const out = {}; const rk = roleKeyOf(ctx);
  FEATURES.forEach(([fid, defs]) => {
    let v;
    if (rk === 'admin') v = true;
    else {
      const ov = settings.features[fid + ':' + rk];
      v = ov !== undefined ? !!ov : !!defs[ROLE_ORDER.indexOf(rk)];
      ctx.depts.forEach((d) => { const o = settings.deptOverrides[d] && settings.deptOverrides[d][fid]; if (o === 'on') v = true; if (o === 'off') v = false; });
      const uo = settings.userOverrides[ctx.username] && settings.userOverrides[ctx.username][fid];
      if (uo === 'on') v = true; if (uo === 'off') v = false;
    }
    out[fid] = v;
  });
  // A console user without the module cannot be handed a phone feature that reads it.
  if (!ctx.isAdmin && !ctx.isPortal) { out.datacol = out.datacol && ctx.can('datacol', 'view'); out.datacolHist = out.datacolHist && ctx.can('datacol', 'view'); out.reports = out.reports && ctx.can('stats', 'view'); }
  return out;
}

/* --------------------------------------------------------------- context --- */
async function ctxOf(req) {
  const a = req.access || {};
  const map = await deptmap.get().catch(() => null);
  let byId = (map && map.byId) || {};
  // Last resort: read the department list directly. An empty map would leave an
  // administrator with no units at all, and every unit-scoped screen would go blank.
  if (!Object.keys(byId).length) {
    try { const rows = await getDepartments(); byId = {}; (Array.isArray(rows) ? rows : []).forEach((d) => { const id = String(d.id || d._id); if (id) byId[id] = { id, name: d.name || id, short: d.short || null }; }); } catch (e) { byId = {}; }
  }
  // The feature column: a legacy portal role, or read from a normal account's MODULES
  // (access.phoneRoleOf) -- a unit lead is an in-charge, a Data Submission holder a
  // collector, a Staff app holder a nurse / PCA, anyone with a console module 'console'.
  const phoneRole = a.unrestricted ? 'admin' : access.phoneRoleOf(a);
  const isPortal = ROLE_ORDER.indexOf(phoneRole) >= 0;
  const role = a.unrestricted ? 'Administrator' : (isPortal ? phoneRole : (a.role || 'User'));
  const own = arr(a.departments).map(String);
  const allIds = Object.keys(byId).filter((id) => id !== deptmap.HOSPITAL);
  const allDepts = !!a.unrestricted || (!isPortal && own.length === 0);
  const username = a.username || (req.user && req.user.sub) || 'local';
  return {
    a, username, name: a.name || (req.user && req.user.name) || username, role, isAdmin: !!a.unrestricted, isPortal,
    isIncharge: phoneRole === 'incharge', isConsole: phoneRole === 'console', depts: allDepts ? allIds : own, own, allDepts, byId,
    deptName: (id) => (byId[id] && byId[id].name) || id,
    // A legacy portal role holds no perms map; a normal account keeps every module it holds.
    can: (m, act) => !!a.unrestricted || (!access.isPortal(a) && access.can(a, m, act || 'view')),
    inDept: (id) => allDepts || own.indexOf(String(id)) >= 0,
  };
}
const log = (req, action, target, detail) => activity.log(req, action, { target, detail }).catch(() => {});

/* -------------------------------------------------------------- accounts --- */
// The app accounts that belong to a department (membership for rooms, reach for
// notices). Read from the users collection, never sent with password hashes.
async function accountList() {
  try {
    const users = await getUsers();
    const rows = typeof users.find === 'function' ? await users.find({ active: { $ne: false } }).toArray() : [];
    return rows.map((u) => ({ username: u.username, name: u.name || u.username, role: u.role || 'User', departments: arr(u.departments).map(String),
      // Runs a unit: the old in-charge role, or a Data Submission holder marked unit lead.
      unitLead: u.role === 'incharge' || ((u.role || 'User') === 'User' && u.unitLead === true && Array.isArray((u.perms || {}).datasubmit) && u.perms.datasubmit.length > 0), designation: u.designation || u.title || null, photo: u.photo || null, staffEmpId: u.staffEmpId || null }));
  } catch (e) { return []; }
}
const roleLabel = (r) => ({ Administrator: 'Administrator', User: 'Manager', incharge: 'Nurse in-charge', collector: 'Data collector', nurse: 'Staff nurse', pca: 'PCA' }[r] || r);

/* ----------------------------------------------------------------- mount --- */
function mount(app, opts) {
  const guard = [].concat((opts && opts.requireApi) || function (req, res, next) { next(); });
  const withCtx = async (req, res, next) => { try { req.ctx = await ctxOf(req); next(); } catch (e) { res.status(500).json({ ok: false, error: 'Server error.' }); } };
  const G = [...guard, withCtx];
  const fail = (res, code, msg) => res.status(code).json({ ok: false, error: msg });
  const requireFeature = (fid) => async (req, res, next) => {
    try { const f = effectiveFeatures(req.ctx, await settingsDoc()); if (f[fid]) return next(); return fail(res, 403, 'This feature is switched off for your role.'); }
    catch (e) { return fail(res, 500, 'Server error.'); }
  };
  const P = '/api/phone';
  // Branding is public on purpose: the login screen shows the hospital name and the
  // minimum app version before anyone has signed in. Nothing else leaves this route.
  app.get(P + '/branding', async (req, res) => { try { const st = await settingsDoc(); res.json({ ok: true, hospital: st.hospital, minAppVersion: st.policy.minAppVersion }); } catch (e) { res.json({ ok: true, hospital: DEFAULT_SETTINGS.hospital, minAppVersion: DEFAULT_SETTINGS.policy.minAppVersion }); } });

  /* ---- bootstrap: who am I on the phone, what may I open ---- */
  app.get(P + '/bootstrap', G, async (req, res) => {
    try {
      const ctx = req.ctx, settings = await settingsDoc();
      const features = effectiveFeatures(ctx, settings);
      const state = (await getOne('userState', ctx.username)) || {};
      const units = ctx.depts.map((id) => ({ id, name: ctx.deptName(id), short: (ctx.byId[id] && ctx.byId[id].short) || null }));
      // A portal account lives in its own unit(s); an administrator or manager has none of
      // their own and picks one (?unit=) — nothing is assumed for them.
      const pick = s(req.query.unit, 80);
      const unit = ctx.own.length ? (pick && ctx.own.indexOf(pick) >= 0 ? { id: pick, name: ctx.deptName(pick) } : { id: ctx.own[0], name: ctx.deptName(ctx.own[0]) }) : (pick && ctx.inDept(pick) ? { id: pick, name: ctx.deptName(pick) } : null);
      // Presence: seen now.
      await upsert('userState', ctx.username, { lastSeen: nowMs() }).catch(() => {});
      const notices = await visibleNotices(ctx).catch(() => []);
      const unread = notices.filter((n) => !(state.read || {})[n.id]).length;
      const needsAck = notices.filter((n) => n.needsAck && arr(n.acks).indexOf(ctx.username) < 0).length;
      const pending = ctx.isIncharge || ctx.isAdmin || ctx.isConsole ? (await list('requests', { status: 'pending', dept: { $in: ctx.depts } }).catch(() => [])).length : 0;
      const accounts = await accountList().catch(() => []);
      const incharge = unit ? accounts.find((u) => u.unitLead && u.departments.indexOf(String(unit.id)) >= 0) : null;
      res.json({ ok: true, user: { username: ctx.username, name: ctx.name, role: ctx.role, roleLabel: roleLabel(ctx.role), isAdmin: ctx.isAdmin, isIncharge: ctx.isIncharge, canManage: ctx.isAdmin || ctx.isConsole }, unit: unit ? Object.assign(unit, { incharge: incharge ? incharge.name : null }) : null, units, features, hospital: settings.hospital, policy: settings.policy, phonebook: settings.phonebook, prefs: state.prefs || {}, favs: arr(state.favs), counts: { unreadNotices: unread, needsAck, pendingRequests: pending } });
    } catch (e) { console.error('[phone] bootstrap failed for', req.ctx && req.ctx.username, e && e.message); fail(res, 500, 'Could not load the app profile.'); }
  });
  app.get(P + '/features', G, async (req, res) => { try { res.json({ ok: true, features: effectiveFeatures(req.ctx, await settingsDoc()) }); } catch (e) { fail(res, 500, 'Server error.'); } });

  /* ---- per-user app state (read markers, saved notices, favourites, prefs) ---- */
  app.get(P + '/me/state', G, async (req, res) => { try { res.json({ ok: true, state: (await getOne('userState', req.ctx.username)) || {} }); } catch (e) { fail(res, 500, 'Server error.'); } });
  app.patch(P + '/me/state', G, async (req, res) => {
    try {
      const b = obj(req.body), patch = {};
      if (b.prefs) patch.prefs = pick(obj(b.prefs), ['notifOn', 'biometric', 'wakeOnShift']);
      if (b.favs) patch.favs = arr(b.favs).slice(0, 200).map((x) => s(x, 80));
      if (b.muted) patch.muted = Object.fromEntries(Object.keys(obj(b.muted)).slice(0, 200).map((k) => [s(k, 80), !!b.muted[k]]));
      res.json({ ok: true, state: await upsert('userState', req.ctx.username, patch) });
    } catch (e) { fail(res, 500, 'Could not save.'); }
  });

  /* ---- notices ---- */
  async function visibleNotices(ctx) {
    const now = nowMs();
    const all = await list('notices', {}, { createdAt: -1 }, 300);
    return all.filter((n) => {
      if (n.publishAt && n.publishAt > now && !(ctx.isAdmin || (n.author && n.author.username === ctx.username))) return false;
      if (n.audience === 'all') return true;
      if (n.audience === 'incharges') return ctx.isIncharge || ctx.isAdmin || ctx.isConsole;
      return ctx.allDepts || arr(n.depts).some((d) => ctx.own.indexOf(String(d)) >= 0) || (n.author && n.author.username === ctx.username);
    });
  }
  async function reachOf(n) {
    const accounts = await accountList();
    if (n.audience === 'all') return accounts.length;
    if (n.audience === 'incharges') return accounts.filter((u) => u.unitLead).length;
    return accounts.filter((u) => u.departments.some((d) => arr(n.depts).indexOf(d) >= 0)).length;
  }
  const noticeOut = (n, ctx, state) => Object.assign({}, n, {
    acked: arr(n.acks).indexOf(ctx.username) >= 0, ackCount: arr(n.acks).length,
    read: !!(state.read || {})[n.id], saved: !!(state.saved || {})[n.id],
    myVote: n.votes && n.votes[ctx.username] != null ? n.votes[ctx.username] : null,
    votes: n.poll ? n.poll.opts.map((_, i) => Object.values(obj(n.votes)).filter((v) => v === i).length) : [],
    acks: undefined, ackPending: (ctx.isIncharge || ctx.isAdmin || ctx.isConsole) ? arr(n.ackPendingNames) : undefined,
  });
  app.get(P + '/notices', G, requireFeature('notices'), async (req, res) => {
    try {
      const ctx = req.ctx, state = (await getOne('userState', ctx.username)) || {};
      const rows = await visibleNotices(ctx);
      res.json({ ok: true, notices: rows.map((n) => noticeOut(n, ctx, state)) });
    } catch (e) { fail(res, 500, 'Could not load notices.'); }
  });
  app.post(P + '/notices', G, requireFeature('compose'), async (req, res) => {
    try {
      const ctx = req.ctx, b = obj(req.body);
      if (!(ctx.isAdmin || ctx.isIncharge || ctx.isConsole)) return fail(res, 403, 'Only an in-charge, a manager or an administrator can publish.');
      const title = s(b.title, 160), body = s(b.body, 6000);
      if (!title || !body) return fail(res, 400, 'A title and a message are required.');
      let audience = ['all', 'incharges', 'depts'].indexOf(b.audience) >= 0 ? b.audience : 'depts';
      let depts = arr(b.depts).map((x) => s(x, 80)).filter(Boolean).slice(0, 60);
      // An in-charge may only address their own units; hospital-wide is a manager's call.
      if (ctx.isIncharge) { audience = 'depts'; depts = depts.filter((d) => ctx.own.indexOf(d) >= 0); if (!depts.length) depts = ctx.own.slice(); }
      if (audience === 'depts' && !depts.length) return fail(res, 400, 'Pick at least one department.');
      const when = ['now', 'tonight', 'tomorrow'].indexOf(b.when) >= 0 ? b.when : 'now';
      const t = new Date(); let publishAt = nowMs();
      if (when === 'tonight') { t.setHours(20, 0, 0, 0); if (t.getTime() < nowMs()) t.setDate(t.getDate() + 1); publishAt = t.getTime(); }
      if (when === 'tomorrow') { t.setDate(t.getDate() + 1); t.setHours(8, 0, 0, 0); publishAt = t.getTime(); }
      const poll = b.poll && s(obj(b.poll).q, 200) ? { q: s(obj(b.poll).q, 200), opts: arr(obj(b.poll).opts).map((x) => s(x, 80)).filter(Boolean).slice(0, 6) } : null;
      if (poll && poll.opts.length < 2) return fail(res, 400, 'A poll needs at least two options.');
      const doc = {
        title, body, cat: ['Policy', 'Training', 'Roster', 'Urgent', 'General'].indexOf(b.cat) >= 0 ? b.cat : 'General',
        audience, depts: audience === 'depts' ? depts : [], needsAck: bool(b.needsAck), pinned: bool(b.pinned), allowComments: b.allowComments !== false,
        attachments: arr(b.attachments).slice(0, 5).map((a) => ({ name: s(obj(a).name, 120), ext: s(obj(a).ext, 8).toUpperCase(), size: s(obj(a).size, 20), url: /^https?:\/\//.test(String(obj(a).url || '')) ? s(obj(a).url, 500) : null })),
        poll, author: { username: ctx.username, name: ctx.name, role: ctx.role, roleLabel: roleLabel(ctx.role), dept: ctx.own[0] ? ctx.deptName(ctx.own[0]) : 'Administration' },
        createdAt: nowMs(), publishAt, acks: [], comments: [], votes: {},
      };
      doc.reach = await reachOf(doc);
      const rec = await insert('notices', doc);
      log(req, 'notice_published', title, `${audience === 'all' ? 'hospital-wide' : audience === 'incharges' ? 'all in-charges' : depts.map(ctx.deptName).join(', ')}${needsAckText(doc)}`);
      res.json({ ok: true, notice: rec });
    } catch (e) { fail(res, 500, 'Could not publish.'); }
  });
  const needsAckText = (n) => (n.needsAck ? ' · acknowledgement required' : '');
  async function noticeFor(req, res, id) {
    const n = await getOne('notices', s(id, 80));
    if (!n) { fail(res, 404, 'Notice not found.'); return null; }
    const vis = await visibleNotices(req.ctx);
    if (!vis.some((v) => v.id === n.id)) { fail(res, 403, 'You cannot see this notice.'); return null; }
    return n;
  }
  app.post(P + '/notices/:id/read', G, async (req, res) => { try { const n = await noticeFor(req, res, req.params.id); if (!n) return; const st = (await getOne('userState', req.ctx.username)) || {}; const read = Object.assign({}, st.read, { [n.id]: nowMs() }); await upsert('userState', req.ctx.username, { read }); res.json({ ok: true }); } catch (e) { fail(res, 500, 'Server error.'); } });
  app.post(P + '/notices/read-all', G, async (req, res) => { try { const vis = await visibleNotices(req.ctx); const st = (await getOne('userState', req.ctx.username)) || {}; const read = Object.assign({}, st.read); vis.forEach((n) => { read[n.id] = read[n.id] || nowMs(); }); await upsert('userState', req.ctx.username, { read }); res.json({ ok: true }); } catch (e) { fail(res, 500, 'Server error.'); } });
  app.post(P + '/notices/:id/save', G, async (req, res) => { try { const n = await noticeFor(req, res, req.params.id); if (!n) return; const st = (await getOne('userState', req.ctx.username)) || {}; const saved = Object.assign({}, st.saved); if (saved[n.id]) delete saved[n.id]; else saved[n.id] = true; await upsert('userState', req.ctx.username, { saved }); res.json({ ok: true, saved: !!saved[n.id] }); } catch (e) { fail(res, 500, 'Server error.'); } });
  app.post(P + '/notices/:id/ack', G, async (req, res) => { try { const n = await noticeFor(req, res, req.params.id); if (!n) return; const acks = arr(n.acks); if (acks.indexOf(req.ctx.username) < 0) acks.push(req.ctx.username); await update('notices', n.id, { acks }); log(req, 'notice_acknowledged', n.title); res.json({ ok: true, ackCount: acks.length }); } catch (e) { fail(res, 500, 'Server error.'); } });
  app.post(P + '/notices/:id/vote', G, async (req, res) => { try { const n = await noticeFor(req, res, req.params.id); if (!n) return; if (!n.poll) return fail(res, 400, 'This notice has no poll.'); const i = Number(obj(req.body).opt); if (!(i >= 0 && i < n.poll.opts.length)) return fail(res, 400, 'Unknown option.'); const votes = Object.assign({}, n.votes, { [req.ctx.username]: i }); await update('notices', n.id, { votes }); res.json({ ok: true }); } catch (e) { fail(res, 500, 'Server error.'); } });
  app.post(P + '/notices/:id/comments', G, async (req, res) => {
    try {
      const n = await noticeFor(req, res, req.params.id); if (!n) return;
      if (n.allowComments === false) return fail(res, 403, 'Comments are closed on this notice.');
      const text = s(obj(req.body).text, 1000); if (!text) return fail(res, 400, 'Write something first.');
      if (limited(req.ctx.username, 'comment', 20, 60000)) return fail(res, 429, 'Slow down a little.');
      const comments = arr(n.comments).concat([{ by: req.ctx.username, name: req.ctx.name, text, ts: nowMs() }]).slice(-200);
      await update('notices', n.id, { comments }); res.json({ ok: true, comments });
    } catch (e) { fail(res, 500, 'Server error.'); }
  });
  app.post(P + '/notices/:id/remind', G, async (req, res) => {
    try {
      const n = await noticeFor(req, res, req.params.id); if (!n) return;
      if (!(req.ctx.isAdmin || req.ctx.isConsole || (n.author && n.author.username === req.ctx.username))) return fail(res, 403, 'Only the author or a manager can send reminders.');
      await update('notices', n.id, { remindedAt: nowMs(), remindedBy: req.ctx.username });
      log(req, 'notice_reminder', n.title); res.json({ ok: true });
    } catch (e) { fail(res, 500, 'Server error.'); }
  });
  app.delete(P + '/notices/:id', G, async (req, res) => { try { const n = await noticeFor(req, res, req.params.id); if (!n) return; if (!(req.ctx.isAdmin || (n.author && n.author.username === req.ctx.username))) return fail(res, 403, 'Only the author or an administrator can remove a notice.'); await remove('notices', n.id); log(req, 'notice_removed', n.title); res.json({ ok: true }); } catch (e) { fail(res, 500, 'Server error.'); } });

  /* ---- chat ---- */
  // Auto rooms exist for every department and for the whole hospital; they are
  // materialised on first use so a new unit gets its room without anyone creating it.
  async function ensureAutoRooms(ctx, features) {
    const rooms = [];
    for (const id of ctx.depts) {
      const rid = 'dept:' + id;
      rooms.push((await getOne('rooms', rid)) || await upsert('rooms', rid, { name: ctx.deptName(id) + ' Nurses', scope: 'dept', dept: id, auto: true, createdAt: nowMs(), pinned: null }));
    }
    if (features.chatHosp) {
      rooms.push((await getOne('rooms', 'hosp:all')) || await upsert('rooms', 'hosp:all', { name: 'All Nursing Staff', scope: 'hosp', auto: true, createdAt: nowMs(), pinned: null }));
      rooms.push((await getOne('rooms', 'hosp:support')) || await upsert('rooms', 'hosp:support', { name: 'IT & App Support', scope: 'hosp', auto: true, createdAt: nowMs(), pinned: null, sub: 'Support · 9 AM – 6 PM' }));
    }
    return rooms;
  }
  async function roomMembers(room, accounts) {
    if (room.scope === 'dm' || Array.isArray(room.members)) return accounts.filter((u) => arr(room.members).indexOf(u.username) >= 0);
    if (room.scope === 'dept') return accounts.filter((u) => u.departments.indexOf(String(room.dept)) >= 0 || u.role === 'Administrator');
    return accounts;
  }
  function canSeeRoom(room, ctx, features) {
    if (room.scope === 'hosp') return !!features.chatHosp;
    if (room.scope === 'dm' || Array.isArray(room.members)) return arr(room.members).indexOf(ctx.username) >= 0 || (room.scope === 'dept' && ctx.inDept(room.dept));
    return ctx.inDept(room.dept);
  }
  const presence = async () => { const rows = await list('userState', { lastSeen: { $gt: nowMs() - 5 * 60000 } }); return new Set(rows.map((r) => r.id)); };
  app.get(P + '/rooms', G, requireFeature('chatDept'), async (req, res) => {
    try {
      const ctx = req.ctx, settings = await settingsDoc(), features = effectiveFeatures(ctx, settings);
      const auto = await ensureAutoRooms(ctx, features);
      const custom = (await list('rooms', { auto: { $ne: true } })).filter((r) => canSeeRoom(r, ctx, features));
      const accounts = await accountList(), online = await presence();
      const st = (await getOne('userState', ctx.username)) || {};
      const out = [];
      for (const r of [...auto, ...custom]) {
        const members = await roomMembers(r, accounts);
        const last = (await list('messages', { room: r.id }, { ts: -1 }, 1))[0] || null;
        const lastRead = (st.lastRead || {})[r.id] || 0;
        const unread = last && last.ts > lastRead ? (await list('messages', { room: r.id, ts: { $gt: lastRead } })).filter((m) => m.from.username !== ctx.username).length : 0;
        const other = r.scope === 'dm' ? members.find((m) => m.username !== ctx.username) : null;
        out.push({ id: r.id, name: r.scope === 'dm' ? (other ? other.name : r.name) : r.name, scope: r.scope === 'dm' ? 'dept' : r.scope, dept: r.dept ? ctx.deptName(r.dept) : null, deptId: r.dept || null, group: r.scope !== 'dm', members: members.length, online: members.some((m) => online.has(m.username) && m.username !== ctx.username), sub: r.sub || (r.scope === 'dm' ? (other ? [other.designation || roleLabel(other.role), online.has(other.username) ? 'online' : 'offline'].join(' · ') : '') : `${members.length} members · ${members.filter((m) => online.has(m.username)).length} online`), unread, last: last ? { text: last.text || (last.attach && last.attach.name) || '', from: last.from.name, mine: last.from.username === ctx.username, urgent: !!last.urgent, ts: last.ts } : null, when: last ? last.ts : r.createdAt, muted: !!(st.muted || {})[r.id], pinned: r.pinned || null, readOnly: !!r.readOnly, role: other ? (other.designation || roleLabel(other.role)) : null });
      }
      out.sort((a, b) => (b.when || 0) - (a.when || 0));
      res.json({ ok: true, rooms: out });
    } catch (e) { fail(res, 500, 'Could not load rooms.'); }
  });
  app.post(P + '/rooms', G, requireFeature('chatDept'), async (req, res) => {
    try {
      const ctx = req.ctx, b = obj(req.body);
      const name = s(b.name, 80); if (!name) return fail(res, 400, 'Give the room a name.');
      const scope = b.scope === 'hosp' ? 'hosp' : 'dept';
      if (scope === 'hosp' && !(ctx.isAdmin || ctx.isConsole)) return fail(res, 403, 'Hospital-wide rooms are created by administration.');
      const accounts = await accountList();
      const members = Array.from(new Set([ctx.username, ...arr(b.members).map((x) => s(x, 40))])).filter((u) => accounts.some((a) => a.username === u)).slice(0, 200);
      const rec = await insert('rooms', { name, scope, dept: scope === 'dept' ? (ctx.own[0] || null) : null, members, admins: [ctx.username], createdBy: ctx.username, createdAt: nowMs(), pinned: null });
      await insert('messages', { room: rec.id, from: { username: ctx.username, name: ctx.name, role: roleLabel(ctx.role) }, text: `Created the room "${name}".`, ts: nowMs(), system: true });
      log(req, 'chat_room_created', name, members.length + ' members');
      res.json({ ok: true, room: rec });
    } catch (e) { fail(res, 500, 'Could not create the room.'); }
  });
  app.post(P + '/dm', G, requireFeature('chatDept'), async (req, res) => {
    try {
      const ctx = req.ctx, other = s(obj(req.body).username, 40).toLowerCase();
      const accounts = await accountList(); const o = accounts.find((a) => a.username === other);
      if (!o || other === ctx.username) return fail(res, 404, 'That person has no app account yet.');
      // A direct message needs a shared unit unless a manager starts it.
      if (!(ctx.isAdmin || ctx.isConsole || o.role === 'Administrator' || o.departments.some((d) => ctx.own.indexOf(d) >= 0))) return fail(res, 403, 'You can only message colleagues in your own unit.');
      const id = 'dm:' + [ctx.username, other].sort().join('|');
      const rec = (await getOne('rooms', id)) || await upsert('rooms', id, { name: o.name, scope: 'dm', members: [ctx.username, other], createdAt: nowMs(), pinned: null });
      res.json({ ok: true, room: Object.assign({}, rec, { name: o.name }) });
    } catch (e) { fail(res, 500, 'Could not open the conversation.'); }
  });
  async function roomFor(req, res, id) {
    const r = await getOne('rooms', s(id, 120)); if (!r) { fail(res, 404, 'Room not found.'); return null; }
    const features = effectiveFeatures(req.ctx, await settingsDoc());
    if (!features.chatDept || !canSeeRoom(r, req.ctx, features)) { fail(res, 403, 'You are not in this room.'); return null; }
    return r;
  }
  const msgOut = (m, ctx) => Object.assign({}, m, { mine: m.from.username === ctx.username, reactions: Object.entries(obj(m.reactions)).map(([label, users]) => ({ label, n: arr(users).length, mine: arr(users).indexOf(ctx.username) >= 0 })) });
  app.get(P + '/rooms/:id/messages', G, async (req, res) => {
    try {
      const ctx = req.ctx, r = await roomFor(req, res, req.params.id); if (!r) return;
      const since = Number(req.query.since) || 0;
      const rows = await list('messages', since ? { room: r.id, ts: { $gt: since } } : { room: r.id }, { ts: 1 }, since ? 500 : 200);
      const accounts = await accountList(), online = await presence();
      const members = (await roomMembers(r, accounts)).map((m) => ({ username: m.username, name: m.name, role: m.designation || roleLabel(m.role), online: online.has(m.username), admin: m.role === 'incharge' || m.role === 'Administrator' || arr(r.admins).indexOf(m.username) >= 0 }));
      const st = (await getOne('userState', ctx.username)) || {};
      await upsert('userState', ctx.username, { lastRead: Object.assign({}, st.lastRead, { [r.id]: nowMs() }), lastSeen: nowMs() });
      const other = r.scope === 'dm' ? members.find((m) => m.username !== ctx.username) : null;
      res.json({ ok: true, room: { id: r.id, name: other ? other.name : r.name, scope: r.scope, group: r.scope !== 'dm', pinned: r.pinned || null, readOnly: !!r.readOnly, sub: other ? [other.role, other.online ? 'online' : 'offline'].join(' · ') : `${members.length} members · ${members.filter((m) => m.online).length} online`, other: other ? other.username : null }, members, messages: rows.map((m) => msgOut(m, ctx)), now: nowMs() });
    } catch (e) { fail(res, 500, 'Could not load messages.'); }
  });
  app.post(P + '/rooms/:id/messages', G, async (req, res) => {
    try {
      const ctx = req.ctx, r = await roomFor(req, res, req.params.id); if (!r) return;
      if (r.readOnly && !(ctx.isAdmin || ctx.isConsole)) return fail(res, 403, 'This room is read-only.');
      const b = obj(req.body), text = s(b.text, 2000);
      const attach = b.attach && s(obj(b.attach).name, 120) ? { name: s(obj(b.attach).name, 120), type: ['photo', 'pdf', 'handover'].indexOf(obj(b.attach).type) >= 0 ? obj(b.attach).type : 'pdf', url: /^https?:\/\//.test(String(obj(b.attach).url || '')) ? s(obj(b.attach).url, 500) : null } : null;
      if (!text && !attach) return fail(res, 400, 'Nothing to send.');
      if (limited(ctx.username, 'msg', 40, 60000)) return fail(res, 429, 'Too many messages — wait a moment.');
      let replyTo = null;
      if (b.replyTo) { const orig = await getOne('messages', s(b.replyTo, 80)); if (orig && orig.room === r.id) replyTo = { id: orig.id, from: orig.from.name, text: s(orig.text, 140) }; }
      const rec = await insert('messages', { room: r.id, from: { username: ctx.username, name: ctx.name, role: roleLabel(ctx.role) }, text, urgent: bool(b.urgent), attach, replyTo, reactions: {}, ts: nowMs() });
      const st = (await getOne('userState', ctx.username)) || {};
      await upsert('userState', ctx.username, { lastRead: Object.assign({}, st.lastRead, { [r.id]: rec.ts }), lastSeen: rec.ts });
      res.json({ ok: true, message: msgOut(rec, ctx) });
    } catch (e) { fail(res, 500, 'Could not send.'); }
  });
  app.post(P + '/rooms/:id/messages/:mid/react', G, async (req, res) => {
    try {
      const ctx = req.ctx, r = await roomFor(req, res, req.params.id); if (!r) return;
      const m = await getOne('messages', s(req.params.mid, 80)); if (!m || m.room !== r.id) return fail(res, 404, 'Message not found.');
      const label = s(obj(req.body).label, 24); if (!label) return fail(res, 400, 'Which reaction?');
      const reactions = Object.assign({}, m.reactions); const users = arr(reactions[label]).slice();
      const i = users.indexOf(ctx.username); if (i >= 0) users.splice(i, 1); else users.push(ctx.username);
      if (users.length) reactions[label] = users; else delete reactions[label];
      await update('messages', m.id, { reactions }); res.json({ ok: true, reactions });
    } catch (e) { fail(res, 500, 'Server error.'); }
  });
  app.delete(P + '/rooms/:id/messages/:mid', G, async (req, res) => {
    try {
      const ctx = req.ctx, r = await roomFor(req, res, req.params.id); if (!r) return;
      const m = await getOne('messages', s(req.params.mid, 80)); if (!m || m.room !== r.id) return fail(res, 404, 'Message not found.');
      const own = m.from.username === ctx.username && nowMs() - m.ts < 10 * 60000;
      if (!(own || ctx.isAdmin || ctx.isIncharge || arr(r.admins).indexOf(ctx.username) >= 0)) return fail(res, 403, 'You can only take back your own message within 10 minutes.');
      await remove('messages', m.id);
      if (r.pinned && r.pinned.id === m.id) await update('rooms', r.id, { pinned: null });
      res.json({ ok: true });
    } catch (e) { fail(res, 500, 'Server error.'); }
  });
  app.post(P + '/rooms/:id/pin', G, async (req, res) => {
    try {
      const ctx = req.ctx, r = await roomFor(req, res, req.params.id); if (!r) return;
      if (!(ctx.isAdmin || ctx.isIncharge || ctx.isConsole || arr(r.admins).indexOf(ctx.username) >= 0 || r.scope === 'dm')) return fail(res, 403, 'Only the in-charge or the room admin can pin.');
      const mid = obj(req.body).mid ? s(obj(req.body).mid, 80) : null;
      let pinned = null;
      if (mid) { const m = await getOne('messages', mid); if (!m || m.room !== r.id) return fail(res, 404, 'Message not found.'); pinned = { id: m.id, text: s(m.text || (m.attach && m.attach.name), 200), from: m.from.name }; }
      await update('rooms', r.id, { pinned }); res.json({ ok: true, pinned });
    } catch (e) { fail(res, 500, 'Server error.'); }
  });
  app.post(P + '/rooms/:id/leave', G, async (req, res) => {
    try {
      const ctx = req.ctx, r = await roomFor(req, res, req.params.id); if (!r) return;
      if (!Array.isArray(r.members)) return fail(res, 400, 'Department and hospital rooms cannot be left; mute them instead.');
      await update('rooms', r.id, { members: r.members.filter((u) => u !== ctx.username) }); res.json({ ok: true });
    } catch (e) { fail(res, 500, 'Server error.'); }
  });

  /* ---- swap & leave requests ---- */
  const canDecide = (ctx, dept) => ctx.isAdmin || (ctx.isConsole && ctx.can('roster', 'edit') && ctx.inDept(dept)) || (ctx.isIncharge && ctx.own.indexOf(String(dept)) >= 0);
  app.get(P + '/requests', G, requireFeature('requests'), async (req, res) => {
    try {
      const ctx = req.ctx;
      const mine = await list('requests', { 'by.username': ctx.username }, { createdAt: -1 }, 100);
      const team = (ctx.isIncharge || ctx.isAdmin || ctx.isConsole) ? (await list('requests', ctx.allDepts ? {} : { dept: { $in: ctx.depts } }, { createdAt: -1 }, 200)).filter((r) => r.by.username !== ctx.username && canDecide(ctx, r.dept)) : [];
      res.json({ ok: true, mine: mine.map((r) => Object.assign(r, { deptName: ctx.deptName(r.dept) })), team: team.map((r) => Object.assign(r, { deptName: ctx.deptName(r.dept) })) });
    } catch (e) { fail(res, 500, 'Could not load requests.'); }
  });
  app.post(P + '/requests', G, requireFeature('requests'), async (req, res) => {
    try {
      const ctx = req.ctx, b = obj(req.body);
      const type = b.type === 'leave' ? 'leave' : 'swap';
      const date = s(b.date, 10); if (!dateOK(date)) return fail(res, 400, 'A date is required (YYYY-MM-DD).');
      const dept = ctx.own[0] || s(b.dept, 80); if (!dept) return fail(res, 400, 'Your account has no department.');
      if (limited(ctx.username, 'req', 10, 3600000)) return fail(res, 429, 'Too many requests in one hour.');
      const doc = { type, dept, date, code: s(b.code, 10), leaveType: type === 'leave' ? (['Casual', 'Sick', 'Annual', 'Study'].indexOf(b.leaveType) >= 0 ? b.leaveType : 'Casual') : null, withUsername: type === 'swap' ? s(b.withUsername, 40) : null, withName: type === 'swap' ? s(b.withName, 120) : null, reason: s(b.reason, 1000), status: 'pending', by: { username: ctx.username, name: ctx.name, role: roleLabel(ctx.role) }, createdAt: nowMs() };
      const rec = await insert('requests', doc);
      log(req, 'shift_request_created', type + ' · ' + date, doc.reason);
      res.json({ ok: true, request: rec });
    } catch (e) { fail(res, 500, 'Could not send the request.'); }
  });
  app.post(P + '/requests/:id/decide', G, async (req, res) => {
    try {
      const ctx = req.ctx, r = await getOne('requests', s(req.params.id, 80)); if (!r) return fail(res, 404, 'Request not found.');
      if (!canDecide(ctx, r.dept)) return fail(res, 403, 'Only the unit in-charge or a manager can decide this.');
      if (r.status !== 'pending') return fail(res, 409, 'Already decided.');
      const status = obj(req.body).status === 'approved' ? 'approved' : 'declined';
      const rec = await update('requests', r.id, { status, decidedBy: { username: ctx.username, name: ctx.name }, decidedAt: nowMs(), decisionReason: s(obj(req.body).reason, 500) });
      log(req, 'shift_request_' + status, r.type + ' · ' + r.date + ' · ' + r.by.name);
      res.json({ ok: true, request: rec });
    } catch (e) { fail(res, 500, 'Server error.'); }
  });
  app.delete(P + '/requests/:id', G, async (req, res) => { try { const r = await getOne('requests', s(req.params.id, 80)); if (!r) return res.json({ ok: true }); if (r.by.username !== req.ctx.username && !req.ctx.isAdmin) return fail(res, 403, 'Not your request.'); if (r.status !== 'pending') return fail(res, 409, 'Already decided.'); await remove('requests', r.id); res.json({ ok: true }); } catch (e) { fail(res, 500, 'Server error.'); } });

  /* ---- shift handover ---- */
  const deptParam = (req) => { const d = s(req.query.dept || obj(req.body).dept, 80) || req.ctx.own[0] || (req.ctx.depts.length === 1 ? req.ctx.depts[0] : null); return d && req.ctx.inDept(d) ? d : null; };
  app.get(P + '/handover', G, requireFeature('handover'), async (req, res) => { try { const dept = deptParam(req); if (!dept) return fail(res, 403, 'Not your unit.'); const items = await list('handover', { dept, archived: { $ne: true } }, { createdAt: 1 }, 200); res.json({ ok: true, dept, deptName: req.ctx.deptName(dept), items }); } catch (e) { fail(res, 500, 'Could not load the handover.'); } });
  app.post(P + '/handover', G, requireFeature('handover'), async (req, res) => {
    try {
      const ctx = req.ctx, dept = deptParam(req); if (!dept) return fail(res, 403, 'Not your unit.');
      const b = obj(req.body), note = s(b.note, 2000); if (!note) return fail(res, 400, 'Write the handover note.');
      const rec = await insert('handover', { dept, bed: s(b.bed, 12) || '—', patient: s(b.patient, 120), prio: ['Critical', 'Watch', 'Routine'].indexOf(b.prio) >= 0 ? b.prio : 'Routine', note, done: false, by: { username: ctx.username, name: ctx.name }, createdAt: nowMs() });
      res.json({ ok: true, item: rec });
    } catch (e) { fail(res, 500, 'Could not add the note.'); }
  });
  app.post(P + '/handover/:id/toggle', G, requireFeature('handover'), async (req, res) => { try { const it = await getOne('handover', s(req.params.id, 80)); if (!it || !req.ctx.inDept(it.dept)) return fail(res, 404, 'Item not found.'); const rec = await update('handover', it.id, { done: !it.done, doneBy: it.done ? null : { username: req.ctx.username, name: req.ctx.name }, doneAt: it.done ? null : nowMs() }); res.json({ ok: true, item: rec }); } catch (e) { fail(res, 500, 'Server error.'); } });
  app.delete(P + '/handover/:id', G, async (req, res) => { try { const it = await getOne('handover', s(req.params.id, 80)); if (!it || !req.ctx.inDept(it.dept)) return res.json({ ok: true }); if (!(req.ctx.isAdmin || req.ctx.isIncharge || it.by.username === req.ctx.username)) return fail(res, 403, 'Not yours to remove.'); await update('handover', it.id, { archived: true, archivedBy: req.ctx.username, archivedAt: nowMs() }); res.json({ ok: true }); } catch (e) { fail(res, 500, 'Server error.'); } });

  /* ---- incident reports ---- */
  async function nextRef(prefix, n) { const rows = await list(n, {}, null, 0); return prefix + '-' + new Date().getFullYear() + '-' + String(rows.length + 1).padStart(4, '0'); }
  app.post(P + '/incidents', G, requireFeature('incident'), async (req, res) => {
    try {
      const ctx = req.ctx, b = obj(req.body), description = s(b.description, 4000);
      if (!description) return fail(res, 400, 'Describe what happened.');
      if (limited(ctx.username, 'incident', 10, 3600000)) return fail(res, 429, 'Too many reports in one hour.');
      const anonymous = bool(b.anonymous);
      const dept = ctx.own[0] || s(b.dept, 80) || null;
      const rec = await insert('incidents', { ref: await nextRef('IR', 'incidents'), dept, deptName: dept ? ctx.deptName(dept) : null, type: ['Medication', 'Fall', 'Needle-stick', 'Equipment', 'Near miss', 'Other'].indexOf(b.type) >= 0 ? b.type : 'Other', severity: ['Near miss', 'Minor', 'Moderate', 'Severe'].indexOf(b.severity) >= 0 ? b.severity : 'Minor', time: s(b.time, 20), description, anonymous, by: anonymous ? null : { username: ctx.username, name: ctx.name }, status: 'Open', createdAt: nowMs() });
      log(req, 'incident_reported', rec.ref, rec.type + ' · ' + rec.severity + (anonymous ? ' · anonymous' : ''));
      res.json({ ok: true, incident: { id: rec.id, ref: rec.ref, status: rec.status } });
    } catch (e) { fail(res, 500, 'Could not submit the report.'); }
  });
  const canReviewIncidents = (ctx) => ctx.isAdmin || ctx.can('quality', 'view');
  app.get(P + '/incidents', G, async (req, res) => {
    try {
      const ctx = req.ctx;
      if (req.query.mine === '1' || !canReviewIncidents(ctx)) { const rows = await list('incidents', { 'by.username': ctx.username }, { createdAt: -1 }, 100); return res.json({ ok: true, incidents: rows, mine: true }); }
      const rows = await list('incidents', ctx.allDepts ? {} : { dept: { $in: ctx.depts } }, { createdAt: -1 }, 300);
      res.json({ ok: true, incidents: rows });
    } catch (e) { fail(res, 500, 'Could not load incidents.'); }
  });
  app.post(P + '/incidents/:id/status', G, async (req, res) => {
    try {
      const ctx = req.ctx; if (!(ctx.isAdmin || ctx.can('quality', 'edit'))) return fail(res, 403, 'Quality or administrator access required.');
      const it = await getOne('incidents', s(req.params.id, 80)); if (!it) return fail(res, 404, 'Incident not found.');
      const status = ['Open', 'Under review', 'Closed'].indexOf(obj(req.body).status) >= 0 ? obj(req.body).status : 'Under review';
      const rec = await update('incidents', it.id, { status, statusBy: { username: ctx.username, name: ctx.name }, statusAt: nowMs(), statusNote: s(obj(req.body).note, 500) });
      log(req, 'incident_' + status.toLowerCase().replace(/\s+/g, '_'), it.ref); res.json({ ok: true, incident: rec });
    } catch (e) { fail(res, 500, 'Server error.'); }
  });

  /* ---- shift reports (in-charge) ---- */
  const COUNT_KEYS = ['adm', 'dis', 'tin', 'tout', 'deaths', 'census', 'nvd', 'cs', 'assisted', 'stillbirth', 'nicu', 'falls', 'mederr', 'needle', 'code', 'complaint', 'pph', 'planned', 'actual', 'sick', 'ot', 'pca'];
  const canSubmitShift = (ctx, dept) => ctx.isAdmin || (ctx.isIncharge && ctx.own.indexOf(String(dept)) >= 0) || (ctx.isConsole && ctx.can('supervisor', 'add') && ctx.inDept(dept));
  const canApproveShift = (ctx) => ctx.isAdmin || (ctx.isConsole && ctx.can('supervisor', 'edit'));
  app.get(P + '/shift-reports', G, async (req, res) => {
    try {
      const ctx = req.ctx;
      const rows = ctx.isAdmin || (ctx.isConsole && ctx.can('supervisor', 'view')) ? await list('shiftReports', ctx.allDepts ? {} : { dept: { $in: ctx.depts } }, { createdAt: -1 }, 300) : await list('shiftReports', { dept: { $in: ctx.depts } }, { createdAt: -1 }, 100);
      res.json({ ok: true, reports: rows.map((r) => Object.assign(r, { deptName: ctx.deptName(r.dept) })), canApprove: canApproveShift(ctx) });
    } catch (e) { fail(res, 500, 'Could not load shift reports.'); }
  });
  app.post(P + '/shift-reports', G, requireFeature('shiftReport'), async (req, res) => {
    try {
      const ctx = req.ctx, b = obj(req.body), dept = s(b.dept, 80) || ctx.own[0];
      if (!dept || !canSubmitShift(ctx, dept)) return fail(res, 403, 'Only the unit in-charge can submit its shift report.');
      const date = s(b.date, 10); if (!dateOK(date)) return fail(res, 400, 'A date is required.');
      const counts = {}; COUNT_KEYS.forEach((k) => { counts[k] = num(obj(b.counts)[k], 0, 100000); });
      const notes = { obs: s(obj(b.notes).obs, 2000), issues: s(obj(b.notes).issues, 2000), handover: s(obj(b.notes).handover, 2000) };
      const rec = await insert('shiftReports', { dept, date, shift: s(b.shift, 10) || 'M4', counts, notes, by: { username: ctx.username, name: ctx.name, role: roleLabel(ctx.role) }, status: 'Submitted', createdAt: nowMs() });
      log(req, 'shift_report_submitted', ctx.deptName(dept) + ' · ' + date + ' · ' + rec.shift, `${counts.adm} adm · ${counts.nvd + counts.cs} deliveries`);
      res.json({ ok: true, report: rec });
    } catch (e) { fail(res, 500, 'Could not submit the report.'); }
  });
  app.post(P + '/shift-reports/:id/status', G, async (req, res) => {
    try {
      const ctx = req.ctx; if (!canApproveShift(ctx)) return fail(res, 403, 'Manager or administrator access required.');
      const r = await getOne('shiftReports', s(req.params.id, 80)); if (!r) return fail(res, 404, 'Report not found.');
      const status = obj(req.body).status === 'Returned' ? 'Returned' : 'Approved';
      const rec = await update('shiftReports', r.id, { status, decidedBy: { username: ctx.username, name: ctx.name }, decidedAt: nowMs(), reason: s(obj(req.body).reason, 500) });
      log(req, 'shift_report_' + status.toLowerCase(), ctx.deptName(r.dept) + ' · ' + r.date + ' · ' + r.shift); res.json({ ok: true, report: rec });
    } catch (e) { fail(res, 500, 'Server error.'); }
  });

  /* ---- medicine requests ---- */
  const canDecideMed = (ctx) => ctx.isAdmin || ctx.can('medicine', 'edit');
  app.get(P + '/med-requests', G, async (req, res) => {
    try {
      const ctx = req.ctx;
      const rows = (req.query.all === '1' && canDecideMed(ctx)) ? await list('medRequests', {}, { createdAt: -1 }, 300) : await list('medRequests', { 'by.username': ctx.username }, { createdAt: -1 }, 100);
      res.json({ ok: true, requests: rows, canDecide: canDecideMed(ctx) });
    } catch (e) { fail(res, 500, 'Could not load requests.'); }
  });
  app.post(P + '/med-requests', G, requireFeature('medReq'), async (req, res) => {
    try {
      const ctx = req.ctx, b = obj(req.body), name = s(b.name, 120); if (!name) return fail(res, 400, 'Which medicine?');
      if (limited(ctx.username, 'medreq', 10, 3600000)) return fail(res, 429, 'Too many requests in one hour.');
      const rec = await insert('medRequests', { name, strength: s(b.strength, 60), mfr: s(b.mfr, 120), form: ['Tablet', 'Capsule', 'Injection', 'Syrup', 'Other'].indexOf(b.form) >= 0 ? b.form : 'Other', reason: s(b.reason, 200), note: s(b.note, 2000), urgent: bool(b.urgent), highAlert: bool(b.highAlert), by: { username: ctx.username, name: ctx.name }, dept: ctx.own[0] || null, deptName: ctx.own[0] ? ctx.deptName(ctx.own[0]) : null, status: bool(b.urgent) ? 'Urgent · paged' : 'In review', createdAt: nowMs() });
      log(req, 'medicine_requested', name, (rec.urgent ? 'URGENT · ' : '') + rec.reason);
      res.json({ ok: true, request: rec });
    } catch (e) { fail(res, 500, 'Could not send the request.'); }
  });
  app.post(P + '/med-requests/:id/decide', G, async (req, res) => {
    try {
      const ctx = req.ctx; if (!canDecideMed(ctx)) return fail(res, 403, 'Medicine module access required.');
      const r = await getOne('medRequests', s(req.params.id, 80)); if (!r) return fail(res, 404, 'Request not found.');
      const status = obj(req.body).status === 'Approved' ? 'Approved' : 'Declined';
      const rec = await update('medRequests', r.id, { status, reply: s(obj(req.body).reply, 1000), decidedBy: { username: ctx.username, name: ctx.name }, decidedAt: nowMs(), openId: s(obj(req.body).openId, 80) || null });
      log(req, 'medicine_request_' + status.toLowerCase(), r.name); res.json({ ok: true, request: rec });
    } catch (e) { fail(res, 500, 'Server error.'); }
  });

  /* ---- unit report: the in-charge dashboard, from the registers the console keeps ---- */
  app.get(P + '/unit-report', G, requireFeature('reports'), async (req, res) => {
    try {
      const ctx = req.ctx, dept = deptParam(req); if (!dept) return fail(res, 403, 'Not your unit.');
      const [depts, quality, staff] = await Promise.all([getDepartments().catch(() => []), getQuality().catch(() => []), staffRegister().catch(() => [])]);
      const d = arr(depts).find((x) => String(x.id || x._id) === String(dept)) || null;
      const months = d ? arr(d.months).slice(-7) : [];
      const offset = d ? Math.max(0, arr(d.months).length - months.length) : 0;
      const series = {};
      if (d) arr(d.cols).forEach((c) => { series[c.id] = months.map((_, i) => { const row = obj(obj(d.data)[String(offset + i)]); const v = Number(row[c.id]); return isFinite(v) ? v : null; }); });
      const area = arr(quality).find((q) => String(q.deptId) === String(dept)) || null;
      const indicators = area ? arr(area.indicators).slice(0, 40).map((i) => {
        const mv = obj(i.months); const keys = Object.keys(mv).sort();
        const trend = keys.slice(-6).map((k) => { const x = mv[k]; const v = Number(x && typeof x === 'object' ? x.value : x); return { month: k, value: isFinite(v) ? v : null }; });
        const latest = trend.slice().reverse().find((t) => t.value != null) || null;
        return { id: i.id, name: i.name, unit: i.unit || '', benchmark: i.benchmark || '', benchmarkValue: i.benchmarkValue != null ? Number(i.benchmarkValue) : null, goalDirection: i.goalDirection || 'lower_is_better', formula: i.formula || '', numLabel: i.numLabel || '', denLabel: i.denLabel || '', latest, trend, status: i.status || null };
      }) : [];
      const norm = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
      const unitStaff = arr(staff).filter((p) => !p.former && p.is_active !== false && String(p.current_department || '').split(',').some((x) => norm(x) === norm(ctx.deptName(dept)) || norm(x) === norm(dept)));
      res.json({ ok: true, dept, deptName: ctx.deptName(dept), cols: d ? arr(d.cols) : [], months, series, indicators, staffing: { nurses: unitStaff.filter((p) => p.role !== 'PCA').length, pcas: unitStaff.filter((p) => p.role === 'PCA').length, beds: d && d.beds ? Number(d.beds) : null }, updatedAt: nowMs() });
    } catch (e) { fail(res, 500, 'Could not build the unit report.'); }
  });

  /* ---- my appraisal ---- */
  app.get(P + '/my-performance', G, requireFeature('performance'), async (req, res) => {
    try {
      const ctx = req.ctx;
      const staff = await staffRegister().catch(() => []);
      const norm = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
      const me = arr(staff).find((p) => (ctx.a.staffEmpId && norm(p.emp_id) === norm(ctx.a.staffEmpId)) || (ctx.a.staffId != null && String(p.id) === String(ctx.a.staffId)) || norm(p.name) === norm(ctx.name)) || null;
      const db = await getDbHandle().catch(() => null);
      let appraisal = null;
      if (db && me) { const rows = await db.collection('staffAppraisals').find({ empId: String(me.emp_id || me.id) }).sort({ cycleEnd: -1 }).limit(1).toArray().catch(() => []); appraisal = rows[0] || null; }
      if (!appraisal) return res.json({ ok: true, staff: me ? { name: me.name, designation: me.designation, empId: me.emp_id, doj: me.doj } : null, appraisal: null });
      const sc = obj(appraisal.scores); const vals = Object.values(sc).map(Number).filter((v) => Number.isInteger(v) && v >= 1 && v <= 5);
      const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : null;
      res.json({ ok: true, staff: { name: me.name, designation: me.designation, empId: me.emp_id, doj: me.doj }, appraisal: { cycleLabel: appraisal.cycleLabel, cycleStart: appraisal.cycleStart, cycleEnd: appraisal.cycleEnd, status: appraisal.status || null, assessorName: appraisal.assessorName || null, assessorRemarks: appraisal.assessorRemarks || null, score: avg, rated: vals.length, scores: sc, signedOff: !!(appraisal.status && /sign|lock|action/i.test(String(appraisal.status))) } });
    } catch (e) { fail(res, 500, 'Could not load the appraisal.'); }
  });

  /* ---- settings (Admin App) ---- */
  const canReadSettings = (ctx) => ctx.isAdmin || ctx.can('users', 'view');
  app.get(P + '/settings', G, async (req, res) => { try { if (!canReadSettings(req.ctx)) return fail(res, 403, 'Administration access required.'); res.json({ ok: true, settings: await settingsDoc(), features: FEATURES.map(([id, defs]) => ({ id, defaults: defs })), roles: ROLE_ORDER }); } catch (e) { fail(res, 500, 'Server error.'); } });
  app.put(P + '/settings', G, async (req, res) => {
    try {
      if (!req.ctx.isAdmin) return fail(res, 403, 'Administrator access required.');
      const clean = cleanSettings(req.body);
      const rec = await upsert('settings', 'settings', Object.assign(clean, { updatedAt: nowMs(), updatedBy: req.ctx.username }));
      log(req, 'phone_settings_updated', 'app access & policy', Object.keys(clean.features).length + ' feature overrides · ' + clean.customMods.length + ' custom modules');
      res.json({ ok: true, settings: await settingsDoc() });
    } catch (e) { fail(res, 500, 'Could not save settings.'); }
  });

  /* ---- in-charge: the unit's roster (draft -> submitted; approval stays with administration) ---- */
  const rosterCol = async () => { const db = await getDbHandle().catch(() => null); return db ? db.collection(rosterMod.COLL) : null; };
  const rosterOut = (d) => { if (!d) return null; const { _id, ...r } = d; return Object.assign({ id: _id }, r); };
  // The roster sheet is keyed by the unit NAME (as the console does); the phone names units by id.
  const unitOf = (req) => { const id = s(req.query.dept || obj(req.body).dept, 80) || req.ctx.own[0] || (req.ctx.depts.length === 1 ? req.ctx.depts[0] : null); return id && req.ctx.inDept(id) ? { id, name: req.ctx.deptName(id) } : null; };
  const canEditRoster = (ctx, unitId) => ctx.isAdmin || (ctx.isIncharge && ctx.own.indexOf(String(unitId)) >= 0) || (ctx.isConsole && ctx.can('roster', 'edit') && ctx.inDept(unitId));
  app.get(P + '/roster', G, requireFeature('roster'), async (req, res) => {
    try {
      const unit = unitOf(req); if (!unit) return fail(res, 403, 'Not your unit.');
      const year = parseInt(req.query.year, 10) || new Date().getFullYear(); const month = Number.isInteger(parseInt(req.query.month, 10)) ? parseInt(req.query.month, 10) : new Date().getMonth();
      const c = await rosterCol(); if (!c) return res.json({ ok: true, roster: null, unit, canEdit: canEditRoster(req.ctx, unit.id) });
      const doc = rosterOut(await c.findOne({ _id: rosterMod.rosterId(unit.name, year, month) }));
      // A nurse sees only the published sheet; the in-charge / administration also see the draft.
      const editor = canEditRoster(req.ctx, unit.id);
      res.json({ ok: true, unit, year, month, canEdit: editor, roster: doc && (doc.status === 'approved' || editor) ? doc : null });
    } catch (e) { fail(res, 500, 'Could not load the roster.'); }
  });
  app.put(P + '/roster', G, requireFeature('rosterEdit'), async (req, res) => {
    try {
      const ctx = req.ctx, unit = unitOf(req); if (!unit) return fail(res, 403, 'Not your unit.');
      if (!canEditRoster(ctx, unit.id)) return fail(res, 403, 'Only the unit in-charge can prepare its roster.');
      const b = obj(req.body);
      const year = parseInt(b.year, 10) || new Date().getFullYear(); const month = Number.isInteger(parseInt(b.month, 10)) ? parseInt(b.month, 10) : new Date().getMonth();
      if (limited(ctx.username, 'roster', 60, 3600000)) return fail(res, 429, 'Too many saves in one hour.');
      const c = await rosterCol(); if (!c) return fail(res, 503, 'Database unavailable.');
      const id = rosterMod.rosterId(unit.name, year, month);
      const existing = rosterOut(await c.findOne({ _id: id }));
      if (existing && existing.status === 'approved' && !ctx.isAdmin) return fail(res, 409, 'This roster is approved and locked. Ask administration to reopen it.');
      // An in-charge may save a draft or submit it; approving is administration's signature.
      const status = b.status === 'submitted' ? 'submitted' : 'draft';
      const names = {}; Object.keys(obj(b.names)).slice(0, 400).forEach((k) => { const v = s(b.names[k], 120); if (v) names[s(k, 40)] = v; });
      const doc = { dept: unit.name, deptName: unit.name, year, month, grid: rosterMod.normGrid(b.grid), order: arr(b.order).map((x) => s(x, 40)).slice(0, 400), names: Object.keys(names).length ? names : ((existing && existing.names) || {}), rules: obj(existing && existing.rules), status, preparedBy: ctx.name, checkedBy: s((existing && existing.checkedBy) || '', 120), approvedBy: s((existing && existing.approvedBy) || '', 120), note: s(b.note, 1000), revision: ((existing && existing.revision) || 0) + 1, updatedAt: nowMs(), updatedBy: ctx.name, unitId: unit.id };
      if (!existing) { doc.createdAt = nowMs(); doc.createdBy = ctx.name; }
      // Conditional on the revision read above: the console saves the same document, and
      // an unconditional $set let whichever save landed second erase the other's cells.
      const raced = () => fail(res, 409, 'Someone else saved this roster at the same moment. Reload it and try again.');
      if (existing) {
        const wr = await c.updateOne({ _id: id, revision: existing.revision == null ? null : existing.revision, status: existing.status }, { $set: doc });
        if (!wr.matchedCount) return raced();
      } else {
        try { await c.insertOne(Object.assign({ _id: id }, doc)); }
        catch (e) { if (e && e.code === 11000) return raced(); throw e; }
      }
      log(req, status === 'submitted' ? 'roster_submitted' : 'roster_saved', unit.name + ' · ' + (month + 1) + '/' + year, doc.order.length + ' staff · rev ' + doc.revision);
      res.json({ ok: true, roster: rosterOut(await c.findOne({ _id: id })) });
    } catch (e) { fail(res, 500, 'Could not save the roster.'); }
  });

  /* ---- in-charge: my unit's staff register (photo, id, joining date, birthday, anniversary) ---- */
  app.get(P + '/unit-staff', G, requireFeature('unitStaff'), async (req, res) => {
    try {
      const ctx = req.ctx, unit = unitOf(req); if (!unit) return fail(res, 403, 'Not your unit.');
      if (!(ctx.isAdmin || ctx.isIncharge || ctx.can('staff', 'view'))) return fail(res, 403, 'Staff register access required.');
      const norm = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
      const short = (ctx.byId[unit.id] && ctx.byId[unit.id].short) || '';
      const staff = (await staffRegister().catch(() => [])).filter((p) => !p.former && p.is_active !== false && String(p.current_department || '').split(',').some((x) => norm(x) === norm(unit.name) || norm(x) === norm(unit.id) || (short && norm(x) === norm(short))));
      const accounts = await accountList(); const online = await presence();
      const photoOf = (p) => { const x = p.photo || p.photo_url; return x ? (typeof x === 'string' ? x : x.url || null) : null; };
      const rows = staff.map((p) => { const a = accounts.find((u) => (u.staffEmpId && p.emp_id && norm(u.staffEmpId) === norm(p.emp_id)) || norm(u.name) === norm(p.name)) || null; return { id: p.id, name: p.name, designation: p.designation || (p.role === 'PCA' ? 'Patient Care Assistant' : 'Staff Nurse'), role: p.role === 'PCA' ? 'PCA' : 'Nurse', empId: p.emp_id || null, doj: p.doj || null, dob: p.dob || p.date_of_birth || p.birthday || null, phone: p.phone || null, photo: photoOf(p), qualification: p.qualification || null, experience: p.total_experience_text || null, training: p.special_training || null, hepB: p.hepatitis_b_vaccination || null, account: a ? { username: a.username, role: a.role, roleLabel: roleLabel(a.role), online: online.has(a.username) } : null }; });
      res.json({ ok: true, unit, staff: rows });
    } catch (e) { fail(res, 500, 'Could not load the unit staff.'); }
  });

  /* ---- directory: app accounts in my units (who I can message), with presence ---- */
  app.get(P + '/directory', G, requireFeature('staffDir'), async (req, res) => {
    try {
      const ctx = req.ctx, accounts = await accountList(), online = await presence();
      const rows = accounts.filter((u) => u.username !== ctx.username && (ctx.allDepts || u.role === 'Administrator' || u.departments.some((x) => ctx.own.indexOf(x) >= 0)))
        .map((u) => ({ username: u.username, name: u.name, role: u.unitLead ? 'incharge' : u.role, roleLabel: u.designation || roleLabel(u.unitLead ? 'incharge' : u.role), departments: u.departments.map((x) => ctx.deptName(x)), online: online.has(u.username), photo: u.photo || null, staffEmpId: u.staffEmpId || null }));
      res.json({ ok: true, accounts: rows });
    } catch (e) { fail(res, 500, 'Could not load the directory.'); }
  });
  /* ---- directory presence (who is online) ---- */
  app.get(P + '/presence', G, async (req, res) => { try { res.json({ ok: true, online: Array.from(await presence()) }); } catch (e) { fail(res, 500, 'Server error.'); } });
}

module.exports = { mount, FEATURES, DEFAULT_SETTINGS, effectiveFeatures, cleanSettings };
