// User dialog ⇄ Indicator Access matrix: ONE scope write for portal accounts.
// In-memory only: db, access, auth, session, throttle and the activity log are stubbed, so
// nothing here touches a database, the network or the file system.
const assert = require('node:assert/strict');

/* ---------------- a small fake Mongo (only what these modules use) ---------------- */
const tick = () => new Promise((r) => setImmediate(r));
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function matches(doc, filter) {
  return Object.keys(filter || {}).every((k) => {
    const cond = filter[k]; const v = doc[k];
    if (cond && typeof cond === 'object' && !Array.isArray(cond) && '$ne' in cond) return !same(v, cond.$ne);
    return same(v, cond);
  });
}
function fakeCollection() {
  const docs = [];
  const find = (f) => docs.filter((d) => matches(d, f));
  const c = {
    docs, failUpdate: false,
    async findOne(f) { await tick(); const d = find(f)[0]; return d ? clone(d) : null; },
    find(f) {
      let sortSpec = null;
      const cur = {
        sort(s) { sortSpec = s; return cur; },
        async toArray() {
          await tick();
          const r = find(f).map(clone);
          if (sortSpec) r.sort((a, b) => { for (const [k, dir] of Object.entries(sortSpec)) { if (a[k] > b[k]) return dir; if (a[k] < b[k]) return -dir; } return 0; });
          return r;
        },
      };
      return cur;
    },
    // Like Mongo: a second insert with the same _id fails with a duplicate-key error (code 11000).
    async insertOne(d) {
      await tick();
      if (d._id !== undefined && docs.some((x) => same(x._id, d._id))) throw Object.assign(new Error('E11000 duplicate key error dup key: { _id: "' + d._id + '" }'), { code: 11000 });
      docs.push(clone(d)); return { insertedId: d._id };
    },
    async updateOne(f, u) {
      await tick();
      if (c.failUpdate) throw (c.failUpdate instanceof Error ? c.failUpdate : new Error('simulated write failure'));
      const d = find(f)[0]; if (!d) return { matchedCount: 0, modifiedCount: 0 };
      Object.entries(u.$set || {}).forEach(([p, v]) => { d[p] = clone(v); });
      Object.keys(u.$unset || {}).forEach((p) => { delete d[p]; });
      return { matchedCount: 1, modifiedCount: 1 };
    },
    async updateMany() { return { matchedCount: 0, modifiedCount: 0 }; },
    async deleteOne(f) { await tick(); const i = docs.findIndex((d) => matches(d, f)); if (i >= 0) docs.splice(i, 1); return { deletedCount: i >= 0 ? 1 : 0 }; },
    async replaceOne(f, d, o) { await tick(); const i = docs.findIndex((x) => matches(x, f)); const next = Object.assign(clone(d), f._id ? { _id: f._id } : {}); if (i >= 0) docs[i] = next; else if (o && o.upsert) docs.push(next); return { matchedCount: i >= 0 ? 1 : 0 }; },
  };
  return c;
}
let cols = {};
const colOf = (name) => (cols[name] = cols[name] || fakeCollection());
let NO_DB = false;   // true = data-collection.js falls back to its in-memory store

const stub = (rel, exports) => { const p = require.resolve(rel); require.cache[p] = { id: p, filename: p, loaded: true, exports }; };
stub('../db', {
  getDbHandle: async () => (NO_DB ? null : { collection: colOf }),
  getUsers: async () => colOf('users'),
  getAppData: async () => ({ data: {} }),
  usingMongo: () => true,
  dbRead: async (fn) => fn({ collection: colOf }),
});
const PORTAL_ROLES = ['collector', 'incharge', 'nurse', 'pca'];
stub('../access', {
  PORTAL_ROLES, ACCESS_MODULES: [],
  cleanStaffScope: (v) => (['all', 'departments', 'self'].indexOf(v) >= 0 ? v : 'all'),
  forRequest: async () => ({ unrestricted: true }),
  invalidate: () => {},
});
stub('../auth', { hash: async (p) => 'hash:' + p, verify: async () => true, sign: () => 'token' });
stub('../session', { setSession: () => {} });
stub('../login-throttle', { keyOf: () => 'k', blockedFor: async () => 0, noteFail: async () => {}, clear: async () => {} });
stub('../activity-log', { log: () => {}, record: () => {}, mount: () => {}, actorOf: () => null, ipOf: () => null });

const dc = require('../data-collection');
const usersAdmin = require('../users-admin');

/* ---------------- fixtures + a fake express app ---------------- */
function reset() {
  cols = {};
  colOf('departments').docs.push(
    { _id: 'icu', id: 'icu', name: 'ICU', qualityKey: 'ICU', quality: { key: 'ICU', name: 'ICU', deptId: 'icu', indicators: [] } },
    { _id: 'ccu', id: 'ccu', name: 'CCU', qualityKey: 'CCU', quality: { key: 'CCU', name: 'CCU', deptId: 'ccu', indicators: [] } },
    { _id: 'er', id: 'er', name: 'Emergency', qualityKey: 'Emergency', quality: { key: 'Emergency', name: 'Emergency', deptId: 'er', indicators: [] } },
  );
  colOf('users').docs.push({ username: 'admin', role: 'Administrator', active: true, name: 'Admin' });
}
const user = (username) => colOf('users').docs.find((u) => u.username === username);
const resps = () => colOf('responsibles').docs;
const respById = (id) => resps().find((r) => r._id === id);
const NURSE_MSG = 'Nurse/PCA accounts cannot submit data. Change the role to Data collector or In-charge in Settings → Users & Roles.';
const USER_ROLE_MSG = 'That ID belongs to a User account. Change its role in Settings → Users & Roles first.';

const routes = {};
const app = new Proxy({}, { get: (_, verb) => (path, ...hs) => { routes[verb.toUpperCase() + ' ' + path] = hs.flat(); } });
usersAdmin.mount(app, { requireApi: (req, res, next) => { req.user = null; return next(); } });
async function call(route, { params = {}, body = {} } = {}) {
  const hs = routes[route];
  assert.ok(hs, 'route not mounted: ' + route);
  const out = { status: 200, body: null };
  const res = { status(c) { out.status = c; return res; }, json(b) { out.body = b; return res; }, set() { return res; } };
  const req = { params, body, query: {}, headers: {}, user: null };
  let i = 0;
  const next = async () => { const h = hs[i++]; if (h) await h(req, res, next); };
  await next();
  return out;
}

(async () => {
  // 1. Saving an in-charge through Responsible Persons / the matrix keeps role 'incharge'.
  reset();
  { colOf('users').docs.push({ username: '11223', role: 'incharge', active: true, name: 'Ward Lead', departments: ['icu'], qualityAreas: ['ICU'] });
    await dc.saveResponsible({ name: 'Ward Lead', empId: '11223', departments: ['icu', 'ccu'], qualityAreas: ['ICU', 'CCU'] });
    assert.equal(user('11223').role, 'incharge', 'an in-charge must not be demoted to collector');
    assert.deepEqual(user('11223').qualityAreas, ['ICU', 'CCU']);
    assert.deepEqual(user('11223').customQualityAreas, [], 'department-derived areas are not custom'); }
  // 1b. Every portal role is kept; a role-less legacy account (or a new login) becomes a collector;
  //     any other existing role is refused, never converted.
  reset();
  { for (const role of PORTAL_ROLES) {
      colOf('users').docs.push({ username: 'p-' + role, role, active: true });
      await dc.upsertCollectorUser({ empId: 'p-' + role, name: 'X', departments: [] });
      assert.equal(user('p-' + role).role, role, role + ' keeps its role');
    }
    colOf('users').docs.push({ username: 'plain', role: 'User', active: true, perms: { staff: 'edit' } });
    await assert.rejects(dc.upsertCollectorUser({ empId: 'plain', name: 'Plain', departments: [] }), { message: USER_ROLE_MSG });
    assert.equal(user('plain').role, 'User', 'a User account is not turned into a collector');
    assert.deepEqual(user('plain').perms, { staff: 'edit' });
    colOf('users').docs.push({ username: 'legacy', active: true });
    await dc.upsertCollectorUser({ empId: 'legacy', name: 'Legacy', departments: [] });
    assert.equal(user('legacy').role, 'collector', 'a role-less legacy account is made a collector');
    await dc.upsertCollectorUser({ empId: 'newbie', password: 'secret1', name: 'New' });
    assert.equal(user('newbie').role, 'collector', 'a new login is a collector'); }

  // 2. An Administrator id is still refused by the collector upsert (and by saveResponsible).
  reset();
  { await assert.rejects(dc.upsertCollectorUser({ empId: 'admin', name: 'Admin', departments: ['icu'] }), /administrator/);
    await assert.rejects(dc.saveResponsible({ name: 'Admin', empId: 'admin', departments: ['icu'] }), /administrator/);
    assert.equal(user('admin').role, 'Administrator');
    assert.equal(resps().length, 0, 'a refused save leaves no responsible behind'); }

  // 3. Create a portal account WITH scope in one step: derived areas on the user + a new mirror.
  reset();
  { const r = await call('POST /api/users', { body: { username: 'rabbi.miah', password: 'secret1', name: 'Rabbi Miah', role: 'collector',
      departments: ['icu'], allQualityAreas: false, customQualityAreas: ['Emergency', 'ICU'], qualityIndicators: { ICU: ['falls'], Emergency: [] } } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const u = user('rabbi.miah');
    assert.deepEqual(u.qualityAreas, ['ICU', 'Emergency'], 'derived ∪ custom');
    assert.deepEqual(u.customQualityAreas, ['Emergency'], 'a department-derived area is never stored as custom');
    assert.deepEqual(u.qualityIndicators, { ICU: ['falls'] }, 'empty restriction lists are dropped');
    assert.equal(resps().length, 1, 'a responsible record is created');
    const rec = resps()[0];
    assert.equal(rec._id, 'resp-u-rabbi.miah', 'a record minted for an account gets the fixed per-account id');
    assert.equal(u.responsibleId, rec._id, 'the account links to its record');
    assert.equal(r.body.user.responsibleId, rec._id, 'the API exposes the link');
    assert.equal(rec.empId, 'rabbi.miah'); assert.equal(rec.name, 'Rabbi Miah'); assert.equal(rec.active, true);
    assert.deepEqual(rec.departments, ['icu']);
    assert.deepEqual(rec.qualityAreas, ['ICU', 'Emergency']);
    assert.deepEqual(rec.customQualityAreas, ['Emergency']);
    assert.deepEqual(rec.qualityIndicators, { ICU: ['falls'] }); }

  // 4. Update an in-charge with an existing record (found by empId): merged, phone/title kept.
  reset();
  { colOf('users').docs.push({ username: '11393', role: 'incharge', active: true, name: 'Old Name', departments: ['icu'], qualityAreas: ['ICU', 'CCU'], customQualityAreas: ['CCU'] });
    colOf('responsibles').docs.push({ _id: 'resp-1', name: 'Old Name', title: 'Charge Nurse', phone: '01700000000', staffId: 42, empId: '11393', departments: ['icu'], qualityAreas: ['ICU', 'CCU'], allQualityAreas: false, qualityIndicators: {}, active: true, createdAt: 1 });
    const r = await call('PATCH /api/users/:username', { params: { username: '11393' }, body: { name: 'New Name', departments: ['er'], allQualityAreas: false, customQualityAreas: [], qualityIndicators: { Emergency: ['door-to-ct'] } } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const u = user('11393');
    assert.equal(u.role, 'incharge');
    assert.deepEqual(u.qualityAreas, ['Emergency'], 'the removed custom area is really removed');
    assert.equal(u.responsibleId, 'resp-1', 'the found record is linked');
    assert.equal(resps().length, 1, 'no duplicate record');
    const rec = resps()[0];
    assert.equal(rec.phone, '01700000000', 'phone kept'); assert.equal(rec.staffId, 42, 'staffId kept'); assert.equal(rec.title, 'Charge Nurse', 'title kept');
    assert.equal(rec.name, 'New Name'); assert.equal(rec.createdAt, 1);
    assert.deepEqual(rec.departments, ['er']); assert.deepEqual(rec.qualityAreas, ['Emergency']);
    assert.deepEqual(rec.qualityIndicators, { Emergency: ['door-to-ct'] });
    // Hospital-wide from the dialog: every area; the directly-granted extras are KEPT underneath.
    const h = await call('PATCH /api/users/:username', { params: { username: '11393' }, body: { allQualityAreas: true, customQualityAreas: ['CCU'] } });
    assert.equal(h.status, 200, JSON.stringify(h.body));
    assert.deepEqual(user('11393').qualityAreas, ['ICU', 'CCU', 'Emergency']);
    assert.deepEqual(resps()[0].qualityAreas, ['ICU', 'CCU', 'Emergency']);
    assert.deepEqual(user('11393').customQualityAreas, ['CCU'], 'extras are kept while hospital-wide');
    assert.deepEqual(resps()[0].customQualityAreas, ['CCU']);
    // 6a. ...so switching hospital-wide OFF brings the extras back instead of dropping them.
    const off = await call('PATCH /api/users/:username', { params: { username: '11393' }, body: { allQualityAreas: false } });
    assert.equal(off.status, 200, JSON.stringify(off.body));
    assert.deepEqual(user('11393').qualityAreas, ['Emergency', 'CCU'], 'on → off keeps the extra area');
    assert.deepEqual(resps()[0].qualityAreas, ['Emergency', 'CCU']);
    assert.deepEqual(resps()[0].customQualityAreas, ['CCU']);
    // ...and the matrix path afterwards still keeps the role and the same derive.
    await dc.saveResponsible({ ...resps()[0], id: 'resp-1', allQualityAreas: false, departments: ['icu'], customQualityAreas: ['CCU'], qualityAreas: ['ICU', 'CCU'] });
    assert.equal(user('11393').role, 'incharge');
    assert.deepEqual(user('11393').customQualityAreas, ['CCU']);
    assert.equal(resps()[0].phone, '01700000000'); }
  // 6a. The derive itself, and a legacy matrix body (effective qualityAreas, no custom list) while hospital-wide.
  reset();
  { const s = await dc.deriveAssignment({ departments: ['icu'], allQualityAreas: true, customQualityAreas: ['CCU', 'ICU'] });
    assert.deepEqual(s.customQualityAreas, ['CCU'], 'custom kept, derived area still excluded');
    assert.deepEqual(s.qualityAreas, ['ICU', 'CCU', 'Emergency']);
    colOf('users').docs.push({ username: 'hw1', role: 'collector', active: true, name: 'HW', departments: ['icu'], allQualityAreas: true, customQualityAreas: ['Emergency'], qualityAreas: ['ICU', 'CCU', 'Emergency'] });
    colOf('responsibles').docs.push({ _id: 'resp-hw', name: 'HW', empId: 'hw1', departments: ['icu'], allQualityAreas: true, customQualityAreas: ['Emergency'], qualityAreas: ['ICU', 'CCU', 'Emergency'], qualityIndicators: {}, active: true });
    await dc.saveResponsible({ id: 'resp-hw', name: 'HW', empId: 'hw1', departments: ['icu'], qualityAreas: ['ICU', 'CCU', 'Emergency'] });
    assert.deepEqual(respById('resp-hw').customQualityAreas, ['Emergency'], 'the posted "every area" is not read as extras');
    assert.deepEqual(user('hw1').customQualityAreas, ['Emergency']); }

  // 5. A non-portal user update never touches responsibles.
  reset();
  { colOf('users').docs.push({ username: 'mgr', role: 'User', active: true, name: 'Manager', perms: {} });
    colOf('responsibles').docs.push({ _id: 'resp-x', name: 'Someone', empId: 'mgr', phone: '1', departments: ['icu'], qualityAreas: ['ICU'] });
    const before = clone(resps());
    const r = await call('PATCH /api/users/:username', { params: { username: 'mgr' }, body: { name: 'Manager 2', departments: ['ccu'], staffScope: 'departments', qualityIndicators: { ICU: ['a'] } } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(resps(), before, 'responsibles untouched');
    assert.equal(user('mgr').responsibleId, undefined); }

  // 6. A portal rename without scope fields refreshes nothing it would have to create.
  reset();
  { colOf('users').docs.push({ username: 'rabbi', role: 'incharge', active: true, name: 'Rabbi', departments: ['icu'], qualityAreas: ['ICU'] });
    const r = await call('PATCH /api/users/:username', { params: { username: 'rabbi' }, body: { active: false } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(resps().length, 0, 'no record is minted for a plain (de)activation'); }

  // 7. A mirror failure is reported, not swallowed.
  reset();
  { colOf('users').docs.push({ username: 'c1', role: 'collector', active: true, name: 'C1', departments: [], qualityAreas: [] });
    colOf('responsibles').docs.push({ _id: 'resp-c1', name: 'C1', empId: 'c1', phone: '9', departments: [], qualityAreas: [] });
    colOf('responsibles').failUpdate = true;
    const r = await call('PATCH /api/users/:username', { params: { username: 'c1' }, body: { departments: ['icu'] } });
    assert.equal(r.status, 500);
    assert.match(r.body.error, /data-collection record could not be updated/); }

  // 8. Finding 1: a record the matrix moved to another login is never taken back through a stale link.
  reset();
  { colOf('users').docs.push({ username: 'aaa', role: 'collector', active: true, name: 'Rina', departments: ['icu'], qualityAreas: ['ICU'], customQualityAreas: [], responsibleId: 'resp-1' });
    colOf('responsibles').docs.push({ _id: 'resp-1', name: 'Rina', empId: 'aaa', phone: '017', departments: ['icu'], qualityAreas: ['ICU'], customQualityAreas: [], qualityIndicators: {}, active: true });
    await dc.saveResponsible({ ...clone(resps()[0]), id: 'resp-1', empId: 'bbb', password: 'secret1', departments: ['ccu'], customQualityAreas: [] });
    assert.equal(user('aaa').responsibleId, undefined, 'the old login is unlinked from the moved record');
    assert.equal(user('bbb').responsibleId, 'resp-1', 'the new login is linked');
    const moved = clone(respById('resp-1'));
    assert.equal(moved.empId, 'bbb');
    const r = await call('PATCH /api/users/:username', { params: { username: 'aaa' }, body: { active: false, departments: ['er'], customQualityAreas: [] } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(respById('resp-1'), moved, 'saving the old login does not modify the moved record');
    assert.equal(user('aaa').responsibleId, 'resp-u-aaa', 'the old login gets a record of its own');
    assert.equal(respById('resp-u-aaa').empId, 'aaa');
    assert.deepEqual(respById('resp-u-aaa').departments, ['er']);
    // A stale link left by older code (never unset) is ignored the same way.
    user('aaa').responsibleId = 'resp-1';
    const r2 = await call('PATCH /api/users/:username', { params: { username: 'aaa' }, body: { departments: ['icu'] } });
    assert.equal(r2.status, 200, JSON.stringify(r2.body));
    assert.deepEqual(respById('resp-1'), moved, 'a stale responsibleId cannot hijack the record');
    assert.equal(user('aaa').responsibleId, 'resp-u-aaa', 'the link is repaired to the account\'s own record');
    // A stale link with no record of its own and no scope: cleared, nothing created, nothing touched.
    colOf('users').docs.push({ username: 'ccc', role: 'collector', active: true, name: 'C', departments: [], responsibleId: 'resp-1' });
    const count = resps().length;
    const r3 = await call('PATCH /api/users/:username', { params: { username: 'ccc' }, body: { name: 'C2' } });
    assert.equal(r3.status, 200, JSON.stringify(r3.body));
    assert.equal(resps().length, count);
    assert.deepEqual(respById('resp-1'), moved);
    assert.equal(user('ccc').responsibleId, null, 'the dead link is cleared'); }

  // 9. Finding 2: concurrent saves for an account without a record produce exactly ONE record.
  reset();
  { colOf('users').docs.push({ username: 'c9', role: 'collector', active: true, name: 'C9', departments: [], qualityAreas: [], customQualityAreas: [] });
    const body = { departments: ['icu'], customQualityAreas: [], qualityIndicators: {} };
    const [a, b] = await Promise.all([
      call('PATCH /api/users/:username', { params: { username: 'c9' }, body }),
      call('PATCH /api/users/:username', { params: { username: 'c9' }, body }),
    ]);
    assert.equal(a.status, 200, JSON.stringify(a.body)); assert.equal(b.status, 200, JSON.stringify(b.body));
    assert.deepEqual(resps().filter((x) => x.empId === 'c9').map((x) => x._id), ['resp-u-c9'], 'one record, not two');
    assert.equal(user('c9').responsibleId, 'resp-u-c9');
    assert.deepEqual(respById('resp-u-c9').departments, ['icu']); }
  // 9b. Deterministically: two create plans, the second insert hits the duplicate key and becomes an update.
  reset();
  { const p1 = await dc.planResponsibleSync({ username: 'dup1' }, { create: true });
    const p2 = await dc.planResponsibleSync({ username: 'dup1' }, { create: true });
    assert.equal(p1.responsibleId, 'resp-u-dup1'); assert.equal(p2.create, true);
    await dc.applyResponsibleSync(p1, { username: 'dup1', name: 'First' }, { departments: ['icu'], allQualityAreas: false, customQualityAreas: [], qualityAreas: ['ICU'], qualityIndicators: {} });
    await dc.applyResponsibleSync(p2, { username: 'dup1', name: 'Second' }, { departments: ['ccu'], allQualityAreas: false, customQualityAreas: [], qualityAreas: ['CCU'], qualityIndicators: {} });
    assert.equal(resps().length, 1);
    assert.equal(resps()[0].name, 'Second'); assert.deepEqual(resps()[0].departments, ['ccu']); }
  // 9c. The fixed id already given to someone else: a random id is used and that record is untouched.
  reset();
  { colOf('users').docs.push({ username: 'zed', role: 'collector', active: true, name: 'Zed', departments: [] });
    colOf('responsibles').docs.push({ _id: 'resp-u-zed', name: 'Other', empId: 'other', departments: ['ccu'], qualityAreas: ['CCU'], active: true });
    const before = clone(respById('resp-u-zed'));
    const r = await call('PATCH /api/users/:username', { params: { username: 'zed' }, body: { departments: ['icu'] } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(respById('resp-u-zed'), before);
    const mine = resps().filter((x) => x.empId === 'zed');
    assert.equal(mine.length, 1); assert.notEqual(mine[0]._id, 'resp-u-zed');
    assert.equal(user('zed').responsibleId, mine[0]._id); }
  // 9d. The in-memory store (no database) converges the same way.
  NO_DB = true;
  try {
    const scope = { departments: ['icu'], allQualityAreas: false, customQualityAreas: [], qualityAreas: ['ICU'], qualityIndicators: {} };
    const plans = await Promise.all([dc.planResponsibleSync({ username: 'memuser' }, { create: true }), dc.planResponsibleSync({ username: 'memuser' }, { create: true })]);
    await Promise.all(plans.map((p) => dc.applyResponsibleSync(p, { username: 'memuser', name: 'Mem' }, scope)));
    assert.deepEqual((await dc.getResponsibles()).filter((x) => x.empId === 'memuser').map((x) => x.id), ['resp-u-memuser']);
  } finally { NO_DB = false; }

  // 10. Finding 3: leaving the portal roles marks the record inactive; the matrix then refuses that login.
  reset();
  { colOf('users').docs.push({ username: 'mgr1', role: 'incharge', active: true, name: 'Mgr', departments: ['icu'], qualityAreas: ['ICU'], customQualityAreas: [], responsibleId: 'resp-m' });
    colOf('responsibles').docs.push({ _id: 'resp-m', name: 'Mgr', empId: 'mgr1', phone: '5', departments: ['icu'], qualityAreas: ['ICU'], customQualityAreas: [], qualityIndicators: { ICU: ['falls'] }, active: true });
    const r = await call('PATCH /api/users/:username', { params: { username: 'mgr1' }, body: { role: 'User', perms: { staff: 'edit', roster: 'add' }, departments: ['icu'] } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(user('mgr1').role, 'User');
    const rec = clone(respById('resp-m'));
    assert.equal(rec.active, false, 'the matrix shows the record inactive');
    assert.deepEqual(rec.departments, ['icu'], 'scope kept'); assert.deepEqual(rec.qualityAreas, ['ICU']);
    assert.deepEqual(rec.qualityIndicators, { ICU: ['falls'] }); assert.equal(rec.phone, '5');
    assert.equal(resps().length, 1, 'nothing deleted or created');
    const perms = clone(user('mgr1').perms);
    // The matrix toggle on that row: refused (POST /api/responsibles maps this throw to 400).
    await assert.rejects(dc.saveResponsible({ ...rec, id: 'resp-m', customQualityAreas: ['CCU'] }), { message: USER_ROLE_MSG });
    assert.equal(user('mgr1').role, 'User', 'not re-promoted to collector');
    assert.deepEqual(user('mgr1').perms, perms, 'perms untouched');
    assert.deepEqual(user('mgr1').qualityAreas, [], 'no scope written to the account');
    assert.deepEqual(respById('resp-m'), rec, 'the refused save writes nothing to the record'); }
  // 10b. Portal → Administrator also deactivates; a portal → portal change does not.
  reset();
  { colOf('users').docs.push({ username: 'boss', role: 'collector', active: true, name: 'Boss', departments: ['icu'], responsibleId: 'resp-b' });
    colOf('users').docs.push({ username: 'ward', role: 'collector', active: true, name: 'Ward', departments: ['icu'], responsibleId: 'resp-w' });
    colOf('responsibles').docs.push({ _id: 'resp-b', name: 'Boss', empId: 'boss', departments: ['icu'], qualityAreas: ['ICU'], active: true },
      { _id: 'resp-w', name: 'Ward', empId: 'ward', departments: ['icu'], qualityAreas: ['ICU'], active: true });
    assert.equal((await call('PATCH /api/users/:username', { params: { username: 'boss' }, body: { role: 'Administrator' } })).status, 200);
    assert.equal(respById('resp-b').active, false);
    assert.equal((await call('PATCH /api/users/:username', { params: { username: 'ward' }, body: { role: 'incharge' } })).status, 200);
    assert.equal(respById('resp-w').active, true); }

  // 11. Finding 4: a 2-character username works end to end (dialog create → matrix save).
  reset();
  { const r = await call('POST /api/users', { body: { username: 'ab', password: 'secret1', role: 'collector', departments: ['icu'], customQualityAreas: [] } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const rec = clone(resps()[0]);
    assert.equal(rec.empId, 'ab');
    await dc.saveResponsible({ ...rec, id: rec._id, customQualityAreas: ['CCU'] });
    assert.deepEqual(user('ab').qualityAreas, ['ICU', 'CCU']);
    assert.equal(user('ab').role, 'collector');
    assert.equal(resps().length, 1);
    await assert.rejects(dc.registerCollector({ name: 'Short', empId: 'xy', password: 'secret1' }), /3-40/, 'public sign-up keeps its 3-40 rule'); }

  // 12. Finding 5 + B: nurse/PCA accounts cannot be given a NON-EMPTY data-collection scope.
  reset();
  { colOf('users').docs.push({ username: 'n1', role: 'nurse', active: true, name: 'Nurse', departments: [], qualityAreas: [] });
    // matrix path
    await assert.rejects(dc.saveResponsible({ name: 'Nurse', empId: 'n1', departments: ['icu'] }), { message: NURSE_MSG });
    await assert.rejects(dc.saveResponsible({ name: 'Nurse', empId: 'n1', departments: [], customQualityAreas: ['CCU'] }), { message: NURSE_MSG });
    assert.equal(resps().length, 0, 'a refused save leaves no record');
    assert.deepEqual(user('n1').departments, []);
    await dc.saveResponsible({ name: 'Nurse One', empId: 'n1', departments: [], customQualityAreas: [] });
    assert.equal(user('n1').role, 'nurse'); assert.equal(user('n1').name, 'Nurse One');
    // user dialog: create
    const p1 = await call('POST /api/users', { body: { username: 'p1', password: 'secret1', role: 'pca', departments: ['icu'] } });
    assert.equal(p1.status, 400); assert.equal(p1.body.error, NURSE_MSG);
    assert.equal(user('p1'), undefined, 'nothing created');
    const p2 = await call('POST /api/users', { body: { username: 'p2', password: 'secret1', role: 'pca', departments: [], customQualityAreas: [], allQualityAreas: false, qualityIndicators: {} } });
    assert.equal(p2.status, 200, JSON.stringify(p2.body));
    assert.equal(resps().some((x) => x.empId === 'p2'), false, 'an empty scope mints no record');
    // user dialog: update
    for (const body of [{ departments: ['icu'] }, { qualityIndicators: { ICU: ['falls'] } }, { allQualityAreas: true }, { customQualityAreas: ['CCU'] }]) {
      const r = await call('PATCH /api/users/:username', { params: { username: 'n1' }, body });
      assert.equal(r.status, 400, JSON.stringify(body)); assert.equal(r.body.error, NURSE_MSG);
    }
    assert.deepEqual(user('n1').departments, []);
    const empty = await call('PATCH /api/users/:username', { params: { username: 'n1' }, body: { name: 'N', departments: [], customQualityAreas: [], allQualityAreas: false, qualityIndicators: { ICU: [] } } });
    assert.equal(empty.status, 200, JSON.stringify(empty.body));
    const plain = await call('PATCH /api/users/:username', { params: { username: 'n1' }, body: { active: false } });
    assert.equal(plain.status, 200, JSON.stringify(plain.body));
    // Making the nurse a collector WITH scope in the same save is allowed.
    const promote = await call('PATCH /api/users/:username', { params: { username: 'n1' }, body: { role: 'collector', departments: ['icu'] } });
    assert.equal(promote.status, 200, JSON.stringify(promote.body));
    assert.deepEqual(user('n1').qualityAreas, ['ICU']); }

  // 13. A: an empty scope never CREATES a record, but still clears an existing linked one.
  reset();
  { colOf('users').docs.push({ username: 'e1', role: 'collector', active: true, name: 'E1', departments: [] });
    const r = await call('PATCH /api/users/:username', { params: { username: 'e1' }, body: { departments: [], customQualityAreas: [], allQualityAreas: false, qualityIndicators: {} } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(resps().length, 0); assert.equal(user('e1').responsibleId, undefined);
    const c = await call('POST /api/users', { body: { username: 'e2', password: 'secret1', role: 'incharge', departments: [], customQualityAreas: [] } });
    assert.equal(c.status, 200, JSON.stringify(c.body));
    assert.equal(resps().length, 0); assert.equal(user('e2').responsibleId, undefined);
    colOf('users').docs.push({ username: 'e3', role: 'collector', active: true, name: 'E3', departments: ['icu'], qualityAreas: ['ICU'], responsibleId: 'resp-e3' });
    colOf('responsibles').docs.push({ _id: 'resp-e3', name: 'E3', empId: 'e3', departments: ['icu'], qualityAreas: ['ICU'], customQualityAreas: [], qualityIndicators: { ICU: ['falls'] }, active: true });
    const clr = await call('PATCH /api/users/:username', { params: { username: 'e3' }, body: { departments: [], customQualityAreas: [], qualityIndicators: {} } });
    assert.equal(clr.status, 200, JSON.stringify(clr.body));
    assert.deepEqual(respById('resp-e3').departments, []); assert.deepEqual(respById('resp-e3').qualityAreas, []);
    assert.deepEqual(respById('resp-e3').qualityIndicators, {}); }

  // 14. C: deleting an account marks its record inactive (never deletes it).
  reset();
  { colOf('users').docs.push({ username: 'd1', role: 'collector', active: true, name: 'D1', departments: ['icu'], responsibleId: 'resp-d1' });
    colOf('responsibles').docs.push({ _id: 'resp-d1', name: 'D1', empId: 'd1', departments: ['icu'], qualityAreas: ['ICU'], active: true });
    const r = await call('DELETE /api/users/:username', { params: { username: 'd1' } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(user('d1'), undefined);
    const rec = respById('resp-d1');
    assert.ok(rec, 'the record is kept'); assert.equal(rec.active, false);
    assert.equal(typeof rec.deactivatedAt, 'number'); assert.deepEqual(rec.departments, ['icu']);
    // A link to someone else's record is ignored; the account's own record is found by empId.
    colOf('users').docs.push({ username: 'd2', role: 'collector', active: true, name: 'D2', responsibleId: 'resp-x' });
    colOf('responsibles').docs.push({ _id: 'resp-x', name: 'X', empId: 'other', active: true }, { _id: 'resp-d2', name: 'D2', empId: 'd2', active: true });
    assert.equal((await call('DELETE /api/users/:username', { params: { username: 'd2' } })).status, 200);
    assert.equal(respById('resp-x').active, true); assert.equal(respById('resp-x').deactivatedAt, undefined);
    assert.equal(respById('resp-d2').active, false);
    // No record at all: the delete still succeeds.
    colOf('users').docs.push({ username: 'd3', role: 'User', active: true, name: 'D3' });
    assert.equal((await call('DELETE /api/users/:username', { params: { username: 'd3' } })).status, 200);
    assert.equal(resps().length, 3); }

  // 15. 6b: 500s carry no driver internals; a duplicate key gets a friendly message.
  reset();
  { const logged = []; const origErr = console.error; console.error = (...a) => logged.push(a);
    try {
      colOf('users').docs.push({ username: 'q1', role: 'collector', active: true, name: 'Q1', departments: [] });
      colOf('users').failUpdate = new Error('connection to mongodb+srv://secret@cluster0 closed');
      const r = await call('PATCH /api/users/:username', { params: { username: 'q1' }, body: { name: 'Q' } });
      assert.equal(r.status, 500); assert.equal(r.body.error, 'Could not update user.');
      assert.equal(logged.length, 1, 'the real error is logged server-side');
      colOf('users').failUpdate = Object.assign(new Error('E11000 duplicate key error collection: users index: username_1'), { code: 11000 });
      const d = await call('PATCH /api/users/:username', { params: { username: 'q1' }, body: { name: 'Q' } });
      assert.equal(d.status, 409); assert.equal(d.body.error, 'That record already exists — refresh and try again.');
      colOf('users').failUpdate = false;
      colOf('users').insertOne = async () => { throw Object.assign(new Error('E11000 duplicate key error'), { code: 11000 }); };
      const c1 = await call('POST /api/users', { body: { username: 'q2', password: 'secret1', role: 'User' } });
      assert.equal(c1.status, 409); assert.match(c1.body.error, /already exists — refresh and try again/);
      colOf('users').insertOne = async () => { throw new Error('topology was destroyed at 10.0.0.1:27017'); };
      const c2 = await call('POST /api/users', { body: { username: 'q3', password: 'secret1', role: 'User' } });
      assert.equal(c2.status, 500); assert.equal(c2.body.error, 'Could not create user.');
    } finally { console.error = origErr; } }

  console.log('user-scope tests: all passed');
})().catch((e) => { console.error(e); process.exit(1); });
