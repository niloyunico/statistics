/* Account photos set from Access Control (server/photos.js profileTarget).

   An account photo belongs to the account document, and the upload route used to write it to
   the SIGNED-IN person only — so an administrator managing accounts had no way to give
   anybody a picture. The exception must stay narrow: Edit on Access Control (or a full
   administrator) to name another account, a full administrator for an administrator's
   photo, and nobody else may touch a colleague's picture.

   Run: node server/test/account-photo.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

(async () => {
  const accounts = {
    nurse: { username: 'nurse', role: 'User' },
    '11223': { username: '11223', role: 'User', photo: { url: 'u-old', publicId: 'unico/profiles/old' } },
    boss: { username: 'boss', role: 'Administrator' },
  };
  const writes = [], deleted = [], routes = {};
  const users = {
    findOne: async (f) => accounts[f.username] || null,
    updateOne: async (f, u) => { writes.push({ who: f.username, u }); return { matchedCount: accounts[f.username] ? 1 : 0 }; },
  };
  const deps = {
    './storage': { status: () => ({ configured: true }), uploadBuffer: async () => ({ url: 'https://example.test/p.jpg', publicId: 'unico/profiles/new', bytes: 10 }),
      deleteByPublicId: async (id) => { deleted.push(id); }, isImageKitId: () => false, isBlobId: () => false },
    './activity-log': { record() {}, actorOf: () => ({}), ipOf: () => '' },
    './access': { forRequest: async (req) => req.fakeAccess, can: (a, m, act) => !!(a && a.perms && (a.perms[m] || []).indexOf(act) >= 0) },
    './cache': { bump: async () => {} },
    './db': { getDbHandle: async () => null, getUsers: async () => users, getAppData: async () => ({ data: {} }) },
    './staff-roster': { staffIdFilter: () => null, loadRoster: async () => [] },
  };
  const ctx = { require: (n) => deps[n], module: { exports: {} }, Buffer, Date, String, Promise };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../photos.js'), 'utf8'), ctx);
  ctx.module.exports.mount({ post: (p, ...f) => { routes['POST ' + p] = f.at(-1); }, delete: (p, ...f) => { routes['DELETE ' + p] = f.at(-1); }, get() {} });
  const call = async (method, who, access, body) => {
    const res = { code: 200, status(n) { this.code = n; return this; }, json(j) { this.body = j; return this; }, set() { return this; } };
    await routes[method + ' /api/upload']({ user: { sub: who }, fakeAccess: access, body: Object.assign({ kind: 'profile', image: 'data:image/jpeg;base64,YQ==' }, body) }, res);
    return res;
  };
  const admin = { unrestricted: true }, manager = { perms: { users: ['view', 'edit'] } }, plain = { perms: { datasubmit: ['view'] } };

  let r = await call('POST', 'nurse', plain, {});
  assert.equal(r.body.ok, true); assert.equal(writes.at(-1).who, 'nurse', 'own photo still goes to the signed-in account');

  r = await call('POST', 'nurse', plain, { username: '11223' });
  assert.equal(r.code, 403, 'an ordinary account cannot change a colleague\'s photo');

  r = await call('POST', 'boss', admin, { username: '11223' });
  assert.equal(r.body.ok, true); assert.equal(writes.at(-1).who, '11223', 'an administrator sets the photo on the named account');
  assert.ok(deleted.includes('unico/profiles/old'), 'the replaced picture is removed from storage');

  r = await call('POST', 'nurse', manager, { username: 'boss' });
  assert.equal(r.code, 403, 'only a full administrator may change an administrator\'s photo');

  r = await call('POST', 'boss', admin, { username: 'ghost' });
  assert.equal(r.code, 404, 'an unknown account is refused before anything is stored');

  accounts['11223'].photo = { url: 'u2', publicId: 'unico/profiles/p2' };
  r = await call('DELETE', 'boss', admin, { username: '11223', publicId: '' });
  assert.equal(r.body.ok, true, r.body && r.body.error);
  assert.ok(deleted.includes('unico/profiles/p2'), 'removal finds the stored file itself (the url is all the page has)');
  assert.ok(writes.some((w) => w.who === '11223' && w.u.$unset), 'and clears it from the account');

  console.log('ACCOUNT_PHOTO_TEST_PASS: own photo, colleague refused, admin sets and removes, admin-only for administrators');
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
