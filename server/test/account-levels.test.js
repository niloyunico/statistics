// Account tiers: the admin-defined hierarchy in server/users-admin.js.
//
// A tier is a CEILING, never a grant. `perms` stays the only thing access.js enforces;
// the tier decides which modules a grant may name at all, and the server re-applies that
// on every write so the dialog is not the only thing holding the line.
//
// The asymmetry that separates this from the role templates it replaced: assigning a tier
// grants nothing, widening a tier grants nothing, and only narrowing one reaches a live
// account -- and that can only remove.
//
// In-memory only: db, access, auth, session, throttle and the activity log are stubbed, so
// nothing here touches a database, the network or the file system.
const assert = require('node:assert/strict');

/* ---------------- a small fake Mongo (only what users-admin.js uses) ---------------- */
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
  return {
    docs,
    async findOne(f) { await tick(); const d = find(f)[0]; return d ? clone(d) : null; },
    find(f) {
      let sortSpec = null;
      const cur = { sort(s) { sortSpec = s; return cur; }, async toArray() { await tick(); return find(f).map(clone); } };
      return cur;
    },
    async insertOne(d) { await tick(); docs.push(clone(d)); return { insertedId: d._id }; },
    async updateOne(f, u) {
      await tick();
      const d = find(f)[0]; if (!d) return { matchedCount: 0, modifiedCount: 0 };
      Object.entries(u.$set || {}).forEach(([p, v]) => { d[p] = clone(v); });
      return { matchedCount: 1, modifiedCount: 1 };
    },
    async updateMany() { return { matchedCount: 0, modifiedCount: 0 }; },
    async deleteOne() { return { deletedCount: 0 }; },
    async replaceOne() { return { matchedCount: 0 }; },
  };
}
let cols = {};
const colOf = (name) => (cols[name] = cols[name] || fakeCollection());

const stub = (rel, exports) => { const p = require.resolve(rel); require.cache[p] = { id: p, filename: p, loaded: true, exports }; };
stub('../db', {
  getDbHandle: async () => ({ collection: colOf }),
  getUsers: async () => colOf('users'),
  getAppData: async () => ({ data: {} }),
  usingMongo: () => true,
  dbRead: async (fn) => fn({ collection: colOf }),
});
stub('../access', {
  PORTAL_ROLES: ['collector', 'incharge', 'nurse', 'pca'], ACCESS_MODULES: [],
  cleanStaffScope: (v) => (['all', 'departments', 'self'].indexOf(v) >= 0 ? v : 'all'),
  cleanRosterScope: (v) => (['all', 'departments'].indexOf(v) >= 0 ? v : null),
  forRequest: async () => ({ unrestricted: true }),
  invalidate: () => {},
});
stub('../auth', { hash: async (p) => 'hash:' + p, verify: async () => true, sign: () => 'token' });
stub('../session', { setSession: () => {} });
stub('../login-throttle', { keyOf: () => 'k', blockedFor: async () => 0, noteFail: async () => {}, clear: async () => {} });
stub('../activity-log', { log: () => {}, record: () => {}, mount: () => {}, actorOf: () => null, ipOf: () => null });

const usersAdmin = require('../users-admin');

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
const MODS = ['stats', 'quality', 'supervisor', 'staff', 'datacol', 'reports', 'users', 'perf', 'roster', 'medicine'];
// A seeded database, as production has after the first read: the ladder is stored, not
// served from the code defaults. (The one-shot seed in listTiers() runs per PROCESS, so
// seeding here keeps each case independent of the ones before it.)
const reset = () => {
  cols = {};
  colOf('users').docs.push({ username: 'admin', role: 'Administrator', active: true, name: 'Admin' });
  colOf('accountTiers').docs.push(
    { _id: '__seed', id: '__seed', v: 2, at: 1 },
    { _id: 'admin', id: 'admin', name: 'Administrator', rank: 0, description: 'System administrator.' },
    { _id: 'cns', id: 'cns', name: 'Chief of Nursing Services', rank: 10, modules: MODS },
    { _id: 'nurse-manager', id: 'nurse-manager', name: 'Nurse Manager', rank: 20, modules: MODS.filter((m) => m !== 'users') },
    { _id: 'ward-incharge', id: 'ward-incharge', name: 'Ward In-charge', rank: 30, modules: ['stats', 'quality', 'supervisor', 'staff', 'datacol', 'perf', 'roster'] },
    { _id: 'portal', id: 'portal', name: 'Portal account', rank: 9999, description: 'Portal / staff app login.' },
  );
};
const user = (u) => colOf('users').docs.find((x) => x.username === u);
const create = (body) => call('POST /api/users', { body: Object.assign({ password: 'secret123' }, body) });
const patch = (username, body) => call('PATCH /api/users/:username', { params: { username }, body });
const FULL = { stats: ['view', 'edit', 'add', 'delete'], quality: ['view'], staff: ['view', 'edit'], users: ['view', 'add', 'edit', 'delete'] };

(async () => {
  /* 1. The retired role-template endpoints are gone. Access is granted account by
        account; nothing else may define a permission set. */
  for (const r of ['GET /api/roles', 'POST /api/roles', 'PUT /api/roles/:id', 'DELETE /api/roles/:id', 'POST /api/roles/:id/apply']) {
    assert.ok(!routes[r], r + ' must no longer be mounted');
  }
  for (const r of ['GET /api/tiers', 'POST /api/tiers', 'PUT /api/tiers/:id', 'DELETE /api/tiers/:id', 'POST /api/tiers/reorder']) {
    assert.ok(routes[r], r + ' must be mounted');
  }

  /* 2. A Manager may hold every module, Administration included. */
  reset();
  { const r = await create({ username: 'm.rahman', name: 'M Rahman', level: 'cns', perms: FULL });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(user('m.rahman').level, 'cns');
    assert.deepEqual(user('m.rahman').perms.users, ['view', 'edit', 'add', 'delete'], 'a Manager keeps Administration');
    assert.deepEqual(user('m.rahman').perms.stats, ['view', 'edit', 'add', 'delete']); }

  /* 3. An In-charge may hold anything EXCEPT Administration — and the server strips it,
        so a hand-built request cannot grant what the dialog does not offer. */
  reset();
  { const r = await create({ username: 's.akter', name: 'S Akter', level: 'nurse-manager', perms: FULL });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const u = user('s.akter');
    assert.equal(u.level, 'nurse-manager');
    assert.equal(u.perms.users, 'none', 'Administration must never reach an In-charge');
    assert.deepEqual(u.perms.staff, ['view', 'edit'], 'every other module is granted as ticked');
    assert.equal(r.body.user.level, 'nurse-manager', 'the level is returned to the dialog'); }

  /* 4. Nothing is granted by default: an account created with no perms holds nothing. */
  reset();
  { await create({ username: 'blank', name: 'Blank', level: 'cns' });
    const p = user('blank').perms;
    assert.ok(p && Object.keys(p).length, 'the perms map is written, not left absent');
    assert.ok(Object.values(p).every((v) => v === 'none'), 'a new account starts with no access at all: ' + JSON.stringify(p)); }

  /* 5. Demoting a Manager to In-charge drops Administration in that same save, even when
        the request carries no perms of its own. */
  reset();
  { await create({ username: 'demote', name: 'D', level: 'cns', perms: FULL });
    user('demote').sessionEpoch = 1;   // a known-old stamp: Date.now() can repeat within a ms
    const epoch = 1;
    const r = await patch('demote', { level: 'nurse-manager' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const u = user('demote');
    assert.equal(u.level, 'nurse-manager');
    assert.equal(u.perms.users, 'none', 'the ceiling is re-applied on a level change alone');
    assert.deepEqual(u.perms.staff, ['view', 'edit'], 'the rest of the grant survives');
    assert.ok(u.sessionEpoch > epoch, 'losing a module signs the account out now, not in 12h'); }

  /* 6. A legacy account (no level, perms never assigned => unrestricted) is not revoked by
        a level change. Materialising {} here would take everything from someone working. */
  reset();
  { colOf('users').docs.push({ username: 'legacy', role: 'User', active: true, name: 'Legacy' });
    await patch('legacy', { level: 'nurse-manager' });
    assert.equal(user('legacy').perms, undefined, 'a null perms map is left null');
    assert.equal(user('legacy').level, 'nurse-manager'); }
  // ...and it reads as a Manager until someone sets a level, so listing it cannot narrow it.
  reset();
  { colOf('users').docs.push({ username: 'old', role: 'User', active: true, name: 'Old', perms: { users: ['view'] } });
    const list = await call('GET /api/users');
    assert.equal(list.body.users.find((u) => u.username === 'old').level, null,
      'a row written before the hierarchy existed reports no tier, rather than guessing one');
    // ...and it is held to the WIDEST tier, not the narrowest: re-saving its grant keeps
    // Administration, which only the widest seeded tier allows.
    await patch('old', { perms: { users: ['view'] } });
    assert.deepEqual(user('old').perms.users, ['view'], 'an unplaced account is capped at the widest tier'); }

  /* 7. Administrators and portal accounts take their level from their role, so the two can
        never disagree — and neither carries a perms map. */
  reset();
  { await create({ username: 'boss', name: 'Boss', role: 'Administrator', level: 'nurse-manager', perms: FULL });
    assert.equal(user('boss').level, 'admin', 'an Administrator is always at the admin level');
    assert.equal(user('boss').perms, null);
    await create({ username: 'coll', name: 'Coll', role: 'collector', level: 'cns' });
    assert.equal(user('coll').level, 'portal');
    assert.equal(user('coll').perms, null); }

  /* 8. Promoting an In-charge to Manager does not hand back Administration by itself —
        it only becomes grantable. */
  reset();
  { await create({ username: 'up', name: 'Up', level: 'nurse-manager', perms: FULL });
    await patch('up', { level: 'cns' });
    assert.equal(user('up').level, 'cns');
    assert.equal(user('up').perms.users, 'none', 'a promotion grants nothing on its own');
    const r = await patch('up', { level: 'cns', perms: { users: ['view'] } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(user('up').perms.users, ['view'], 'now it can be granted, explicitly'); }

  /* 9. The retired roleTemplate stamp is cleared as accounts are saved, and never written. */
  reset();
  { colOf('users').docs.push({ username: 'stamped', role: 'User', active: true, name: 'S', roleTemplate: 'ward-incharge', perms: { staff: ['view'] } });
    await patch('stamped', { name: 'S2' });
    assert.equal(user('stamped').roleTemplate, null, 'the template label is dropped');
    const p = user('stamped').perms;
    assert.deepEqual(p.staff, ['view'], 'what it held is untouched');
    assert.ok(Object.keys(p).every((k) => k === 'staff' || p[k] === 'none'), 'and nothing else was granted: ' + JSON.stringify(p));
    await create({ username: 'fresh', name: 'F', level: 'cns', roleTemplate: 'manager', perms: { staff: ['view'] } });
    assert.equal(user('fresh').roleTemplate, undefined, 'a new account never gets one'); }

  /* 10. The ladder seeds itself into an empty database: Administrator on top, Portal at
         the floor, and the two console tiers between them. */
  reset();
  { const r = await call('GET /api/tiers');
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const ids = r.body.tiers.map((t) => t.id);
    assert.deepEqual(ids, ['admin', 'cns', 'nurse-manager', 'ward-incharge', 'portal'], 'seeded in rank order');
    assert.equal(r.body.tiers[0].fixed, true, 'Administrator is built in');
    assert.equal(r.body.tiers[4].fixed, true, 'Portal account is built in');
    assert.deepEqual(r.body.tiers[4].modules, [], 'a portal tier holds no modules');
    assert.ok(r.body.tiers[1].modules.indexOf('users') >= 0, 'the widest tier (CNS) may hold Administration');
    assert.ok(r.body.tiers[2].modules.indexOf('users') < 0, 'the one below it may not'); }

  /* 11. A hospital can add its own tier, and accounts can be placed at it. */
  reset();
  { const r = await call('POST /api/tiers', { body: { name: 'Ward In-charge', description: 'Runs one unit', modules: ['stats', 'datacol', 'roster'] } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.tier.id, 'ward-in-charge');
    assert.deepEqual(r.body.tier.modules, ['stats', 'datacol', 'roster']);
    const c = await create({ username: 'w.lead', name: 'W Lead', level: 'ward-in-charge', perms: FULL });
    assert.equal(c.status, 200, JSON.stringify(c.body));
    const u = user('w.lead');
    assert.equal(u.level, 'ward-in-charge');
    assert.deepEqual(u.perms.stats, ['view', 'edit', 'add', 'delete'], 'a module the tier allows is granted as ticked');
    assert.equal(u.perms.staff, 'none', 'a module the tier does not allow cannot be granted');
    assert.equal(u.perms.users, 'none'); }

  /* 12. Widening a tier grants its members NOTHING -- it only makes more modules tickable.
         This is the property that makes a tier different from a role template. */
  reset();
  { await call('POST /api/tiers', { body: { name: 'Unit Lead', modules: ['stats'] } });
    await create({ username: 'u1', name: 'U1', level: 'unit-lead', perms: { stats: ['view'] } });
    const before = JSON.stringify(user('u1').perms);
    const r = await call('PUT /api/tiers/:id', { params: { id: 'unit-lead' }, body: { modules: ['stats', 'staff', 'roster'] } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.clamped, 0, 'widening touches nobody');
    assert.equal(JSON.stringify(user('u1').perms), before, 'a member gains nothing from a widened tier'); }

  /* 13. Narrowing a tier is the one edit that reaches live accounts -- and it only removes.
         Everyone at the tier loses it at once, and is signed out so it takes effect now. */
  reset();
  { await call('POST /api/tiers', { body: { name: 'Unit Lead', modules: ['stats', 'staff', 'roster'] } });
    await create({ username: 'u1', name: 'U1', level: 'unit-lead', perms: { stats: ['view'], staff: ['view', 'edit'], roster: ['view'] } });
    await create({ username: 'u2', name: 'U2', level: 'unit-lead', perms: { stats: ['view'] } });
    user('u1').sessionEpoch = 1;   // as above
    const epoch = 1;
    const r = await call('PUT /api/tiers/:id', { params: { id: 'unit-lead' }, body: { modules: ['stats'] } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body.removed.sort(), ['roster', 'staff']);
    assert.equal(r.body.clamped, 1, 'only the account that actually held one of them is touched');
    assert.equal(user('u1').perms.staff, 'none', 'the removed module is gone');
    assert.deepEqual(user('u1').perms.stats, ['view'], 'what the tier still allows survives');
    assert.ok(user('u1').sessionEpoch > epoch, 'the loss takes effect now, not in 12h');
    assert.deepEqual(user('u2').perms.stats, ['view'], 'an unaffected member is left alone'); }

  /* 14. A tier in use cannot be deleted, and the built-in top and bottom never can. */
  reset();
  { await call('POST /api/tiers', { body: { name: 'Unit Lead', modules: ['stats'] } });
    await create({ username: 'u1', name: 'U1', level: 'unit-lead', perms: { stats: ['view'] } });
    let r = await call('DELETE /api/tiers/:id', { params: { id: 'unit-lead' } });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /Move its 1 account/);
    for (const id of ['admin', 'portal']) {
      r = await call('DELETE /api/tiers/:id', { params: { id } });
      assert.equal(r.status, 400, id + ' must not be deletable');
    }
    // Move the account off it, and it goes.
    await patch('u1', { level: 'cns' });
    r = await call('DELETE /api/tiers/:id', { params: { id: 'unit-lead' } });
    assert.equal(r.status, 200, JSON.stringify(r.body)); }

  /* 15. Reordering changes seniority only -- no ceiling moves, so nobody's access does. */
  reset();
  { await call('POST /api/tiers', { body: { name: 'Unit Lead', modules: ['stats'] } });
    await create({ username: 'u1', name: 'U1', level: 'unit-lead', perms: { stats: ['view'] } });
    const before = JSON.stringify(user('u1').perms);
    const r = await call('POST /api/tiers/reorder', { body: { order: ['unit-lead', 'nurse-manager', 'cns', 'ward-incharge'] } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body.tiers.map((t) => t.id), ['admin', 'unit-lead', 'nurse-manager', 'cns', 'ward-incharge', 'portal']);
    assert.equal(JSON.stringify(user('u1').perms), before, 'rank is presentation, not permission'); }

  /* 16. A reserved id cannot be taken by a hospital tier. */
  reset();
  { for (const name of ['Admin', 'Portal']) {
      const r = await call('POST /api/tiers', { body: { name } });
      assert.equal(r.status, 400, name + ' must be reserved');
    } }

  /* 17. The sign-off chain lives on the ladder: the ward prepares, the manager checks,
         the Chief of Nursing Services approves. A ladder seeded before the chain existed
         is backfilled, so an existing hospital gets it without re-seeding. */
  reset();
  { const r = await call('GET /api/tiers');
    const by = {}; r.body.tiers.forEach((t) => { by[t.id] = t; });
    assert.equal(by.cns.signoff, 'approve', 'the CNS signs a roster off');
    assert.equal(by['nurse-manager'].signoff, 'check');
    assert.equal(by['ward-incharge'].signoff, 'prepare');
    assert.equal(by.admin.signoff, '', 'a built-in tier takes no part unless told to'); }

  /* 18. The chain is editable — a hospital that checks at a different tier says so. */
  reset();
  { const r = await call('PUT /api/tiers/:id', { params: { id: 'ward-incharge' }, body: { signoff: 'check' } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.tier.signoff, 'check');
    const bad = await call('PUT /api/tiers/:id', { params: { id: 'cns' }, body: { signoff: 'nonsense' } });
    assert.equal(bad.body.tier.signoff, '', 'an unknown place in the chain is dropped, not stored'); }

  /* 19. /api/signatories names who may sign, and needs no Administration rights — the
         ward in-charge filling the boxes in is not an administrator. */
  reset();
  { await create({ username: 'e.jothi', name: 'Elizabeth Jothi', level: 'cns', perms: { roster: ['view', 'edit', 'add', 'delete'] } });
    await create({ username: 's.parvin', name: 'Shahnaz Parvin', level: 'nurse-manager', perms: { roster: ['view'] } });
    await create({ username: 'w.lead', name: 'Ward Lead', level: 'ward-incharge', perms: { roster: ['view', 'edit'] } });
    const r = await call('GET /api/signatories');
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const by = {}; r.body.signatories.forEach((u) => { by[u.name] = u; });
    assert.equal(by['Elizabeth Jothi'].signoff, 'approve');
    assert.equal(by['Elizabeth Jothi'].levelName, 'Chief of Nursing Services');
    assert.equal(by['Shahnaz Parvin'].signoff, 'check');
    assert.equal(by['Ward Lead'].signoff, 'prepare');
    assert.ok(!('email' in by['Elizabeth Jothi']), 'no email is exposed');
    assert.ok(!('perms' in by['Elizabeth Jothi']), 'no permissions are exposed'); }

  console.log('account-levels tests: all passed');
})().catch((e) => { console.error(e); process.exit(1); });
