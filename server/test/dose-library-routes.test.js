/* Dose-library routes (server/medicines.js → /api/med/dose-library*) against an in-memory
   collection: hospital edits are normalised, a review is hashed from the MERGED entry so
   a later edit shows "Changed since review", built-in drugs cannot be deleted, and only
   administrators can change anything.
   Run: node test/dose-library-routes.test.js */
const assert = require('assert');
const path = require('path');

// In-memory stand-in for the one collection these routes touch.
const docs = new Map();
const match = (d, q) => Object.keys(q).every((k) => (q[k] && q[k].$ne !== undefined ? d[k] !== q[k].$ne : d[k] === q[k]));
const fakeCol = {
  find: () => ({ limit: () => ({ toArray: async () => Array.from(docs.values()).map((d) => Object.assign({}, d)) }) }),
  findOne: async (q) => { const d = docs.get(q._id); return d ? Object.assign({}, d) : null; },
  updateOne: async (q, u, o) => {
    let d = docs.get(q._id);
    if (!d) { if (!(o && o.upsert)) return { matchedCount: 0 }; d = { _id: q._id }; Object.assign(d, u.$setOnInsert || {}); }
    Object.assign(d, u.$set || {});
    docs.set(q._id, d);
    return { matchedCount: 1 };
  },
  deleteOne: async (q) => { const d = docs.get(q._id); if (d && match(d, q)) { docs.delete(q._id); return { deletedCount: 1 }; } return { deletedCount: 0 }; },
};
require.cache[path.join(__dirname, '..', 'db.js')] = { id: 'db', filename: 'db', loaded: true, exports: { getDbHandle: async () => ({ collection: () => fakeCol }) } };
const med = require('../medicines');
const D = require('../../renderer/unico/dose-math.js');
const LIB = require('../../renderer/unico/dose-library.js');

const routes = {};
const app = {};
['get', 'put', 'post', 'delete'].forEach((m) => { app[m] = (p, ...h) => { routes[m.toUpperCase() + ' ' + p] = h; }; });
med.mount(app, {});

function call(method, p, params, body, admin) {
  const h = routes[method + ' ' + p];
  assert.ok(h, 'route ' + method + ' ' + p);
  return new Promise((resolve) => {
    const req = { params: params || {}, body: body || {}, user: { name: 'Pharmacist Rina' }, access: { unrestricted: admin !== false } };
    const res = { code: 200, status(c) { this.code = c; return this; }, json(j) { resolve({ code: this.code, body: j }); } };
    let i = 0;
    const next = () => { const fn = h[i++]; if (fn) fn(req, res, next); };
    next();
  });
}

let pass = 0;
const t = async (name, fn) => { await fn(); pass++; console.log('  ok', name); };

(async () => {
  await t('non-admins cannot edit, review or delete', async () => {
    const r = await call('PUT', '/api/med/dose-library/:id', { id: 'inf-dopamine' }, { kind: 'infusion', data: { hard: 20 } }, false);
    assert.strictEqual(r.code, 403);
    assert.strictEqual((await call('POST', '/api/med/dose-library/:id/review', { id: 'inf-dopamine' }, {}, false)).code, 403);
    assert.strictEqual(docs.size, 0);
  });

  await t('an edit is normalised: unknown fields dropped, numbers bounded, blanks keep the default', async () => {
    const r = await call('PUT', '/api/med/dose-library/:id', { id: 'inf-dopamine' }, { kind: 'infusion', data: { hard: '25', start: '', evil: '<script>', soft: [2, 'x'], conc: [{ label: 'A', amount: '200', unit: 'mg', ml: '50' }, { amount: 0, ml: 50 }] } });
    assert.strictEqual(r.code, 200);
    const d = docs.get('inf-dopamine');
    assert.strictEqual(d.data.hard, 25);
    assert.ok(!('start' in d.data) && !('evil' in d.data) && !('soft' in d.data), 'blank / bad / unknown fields left out');
    assert.strictEqual(d.data.conc.length, 1, 'a zero-amount concentration is dropped');
    assert.strictEqual(d.builtIn, true);
  });

  await t('review is hashed from the merged entry and goes stale after an edit', async () => {
    const r = await call('POST', '/api/med/dose-library/:id/review', { id: 'inf-dopamine' }, {});
    assert.strictEqual(r.code, 200);
    assert.strictEqual(r.body.override.review.by, 'Pharmacist Rina');
    const list = (await call('GET', '/api/med/dose-library')).body.overrides;
    let e = D.mergeLibrary(LIB, list).infusion.find((x) => x.id === 'inf-dopamine');
    assert.strictEqual(e.reviewed.state, 'ok');
    assert.strictEqual(e.hard, 25);
    await call('PUT', '/api/med/dose-library/:id', { id: 'inf-dopamine' }, { kind: 'infusion', data: { hard: 28 } });
    e = D.mergeLibrary(LIB, (await call('GET', '/api/med/dose-library')).body.overrides).infusion.find((x) => x.id === 'inf-dopamine');
    assert.strictEqual(e.reviewed.state, 'stale');
  });

  await t('a hospital drug can be added and deleted; a built-in one cannot be deleted', async () => {
    const noName = await call('PUT', '/api/med/dose-library/:id', { id: 'h-inf-test1' }, { kind: 'infusion', data: { unit: 'mg/h' } });
    assert.strictEqual(noName.code, 400);
    const add = await call('PUT', '/api/med/dose-library/:id', { id: 'h-inf-test1' }, { kind: 'infusion', data: { name: 'Local drug', group: 'Other', unit: 'mg/h', conc: [{ amount: 10, unit: 'mg', ml: 50 }], soft: [1, 2], hard: 3, start: 1, step: 0.5 } });
    assert.strictEqual(add.code, 200);
    assert.strictEqual(D.mergeLibrary(LIB, (await call('GET', '/api/med/dose-library')).body.overrides).infusion.filter((x) => x.custom).length, 1);
    assert.strictEqual((await call('DELETE', '/api/med/dose-library/:id', { id: 'inf-dopamine' })).code, 409);
    assert.ok(docs.has('inf-dopamine'));
    assert.strictEqual((await call('DELETE', '/api/med/dose-library/:id', { id: 'h-inf-test1' })).body.ok, true);
    assert.ok(!docs.has('h-inf-test1'));
  });

  await t('switching a drug off and the hospital order are stored', async () => {
    await call('PUT', '/api/med/dose-library/:id', { id: 'inf-milrinone' }, { kind: 'infusion', data: {}, disabled: true });
    assert.strictEqual(docs.get('inf-milrinone').disabled, true);
    await call('PUT', '/api/med/dose-library/:id', { id: '_layout' }, { layout: { infusion: ['inf-dopamine', 'inf-noradrenaline'], tabs: ['calcs', 'infusion'], groups: { infusion: ['Sedation & analgesia'] } } });
    const lay = docs.get('_layout').layout;
    assert.deepStrictEqual(lay.infusion, ['inf-dopamine', 'inf-noradrenaline']);
    assert.deepStrictEqual(lay.tabs, ['calcs', 'infusion']);
    const merged = D.mergeLibrary(LIB, (await call('GET', '/api/med/dose-library')).body.overrides);
    assert.strictEqual(merged.infusion.length, LIB.INFUSIONS.length, '_layout is not mistaken for a drug');
  });

  await t('bad ids and unknown sections are refused', async () => {
    assert.strictEqual((await call('PUT', '/api/med/dose-library/:id', { id: '../x' }, { kind: 'infusion', data: { name: 'x' } })).code, 400);
    assert.strictEqual((await call('PUT', '/api/med/dose-library/:id', { id: 'h-x-1' }, { kind: 'nope', data: { name: 'x' } })).code, 400);
    assert.strictEqual((await call('POST', '/api/med/dose-library/:id/review', { id: 'no-such-drug' }, {})).code, 404);
    const r = await call('PUT', '/api/med/dose-library/:id', { id: 'inf-noradrenaline' }, { kind: 'infusion', data: { hard: 0.5 } });
    assert.strictEqual(r.code, 400, 'a hard limit below the usual range (0.01–1) is refused');
    assert.ok(!docs.has('inf-noradrenaline'));
  });

  console.log('dose-library-routes: ' + pass + ' passed');
})().catch((e) => { console.error(e); process.exit(1); });
