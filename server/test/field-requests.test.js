// Field requests (a unit asks for a custom field, an administrator decides) + portal
// submission guards, against an in-memory fake Mongo. No database, network or file writes.
const assert = require('node:assert/strict');

/* ---------------- a small fake Mongo (same shape as approval-integrity.test.js) ---------------- */
const tick = () => new Promise((r) => setImmediate(r));
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function valuesAt(doc, path) {
  let vals = [doc];
  for (const part of path.split('.')) {
    const next = [];
    vals.forEach((v) => {
      if (Array.isArray(v) && !/^\d+$/.test(part)) v.forEach((el) => { if (el && typeof el === 'object' && part in el) next.push(el[part]); });
      else if (v && typeof v === 'object' && part in v) next.push(v[part]);
    });
    vals = next;
  }
  return vals;
}
function matchValue(vals, cond) {
  const flat = vals.flatMap((v) => (Array.isArray(v) ? [v, ...v] : [v]));
  if (cond && typeof cond === 'object' && !Array.isArray(cond) && Object.keys(cond).some((k) => k[0] === '$')) {
    return Object.keys(cond).every((op) => {
      const x = cond[op];
      if (op === '$exists') return x ? vals.length > 0 : vals.length === 0;
      if (op === '$ne') return !flat.some((v) => same(v, x));
      if (op === '$in') return flat.some((v) => x.some((y) => same(v, y)));
      if (op === '$lt') return flat.some((v) => v < x);
      throw new Error('fake mongo: unsupported operator ' + op);
    });
  }
  return flat.some((v) => same(v, cond));
}
function matches(doc, filter) {
  return Object.keys(filter || {}).every((k) => (k === '$or' ? filter.$or.some((f) => matches(doc, f)) : matchValue(valuesAt(doc, k), filter[k])));
}
function setPath(doc, path, value, arrayFilters) {
  const parts = path.split('.');
  let cur = doc;
  for (let i = 0; i < parts.length - 1; i++) { if (cur[parts[i]] == null) cur[parts[i]] = {}; cur = cur[parts[i]]; }
  const last = parts[parts.length - 1];
  const m = /^\$\[(\w+)\]$/.exec(last);
  if (!m) { cur[last] = clone(value); return; }
  const [fk, fv] = Object.entries(arrayFilters.find((f) => Object.keys(f)[0].split('.')[0] === m[1]))[0];
  const sub = fk.split('.').slice(1).join('.');
  cur.forEach((el, i) => { if (same(valuesAt(el, sub)[0], fv)) cur[i] = clone(value); });
}
function applyUpdate(doc, u, o) {
  Object.entries(u.$set || {}).forEach(([p, v]) => setPath(doc, p, v, (o && o.arrayFilters) || []));
  Object.entries(u.$push || {}).forEach(([p, v]) => { const parts = p.split('.'); let cur = doc; parts.slice(0, -1).forEach((k) => { if (cur[k] == null) cur[k] = {}; cur = cur[k]; }); (cur[parts[parts.length - 1]] = cur[parts[parts.length - 1]] || []).push(clone(v)); });
  Object.keys(u.$unset || {}).forEach((p) => { const parts = p.split('.'); let cur = doc; for (const k of parts.slice(0, -1)) { if (cur == null) return; cur = cur[k]; } if (cur) delete cur[parts[parts.length - 1]]; });
}
function fakeCollection() {
  const docs = [];
  const find = (f) => docs.filter((d) => matches(d, f));
  return {
    docs,
    async findOne(f) { await tick(); const d = find(f)[0]; return d ? clone(d) : null; },
    find(f) {
      let sortSpec = null, skip = 0, lim = Infinity;
      const cur = {
        sort(s) { sortSpec = s; return cur; }, skip(n) { skip = n; return cur; }, limit(n) { lim = n; return cur; },
        async toArray() {
          await tick();
          const r = find(f).map(clone);
          if (sortSpec) r.sort((a, b) => { for (const [k, dir] of Object.entries(sortSpec)) { if (a[k] > b[k]) return dir; if (a[k] < b[k]) return -dir; } return 0; });
          return r.slice(skip, skip + lim);
        },
      };
      return cur;
    },
    async insertOne(d) { await tick(); docs.push(clone(d)); return { insertedId: d._id }; },
    async updateOne(f, u, o) { await tick(); const d = find(f)[0]; if (!d) return { matchedCount: 0, modifiedCount: 0 }; applyUpdate(d, u, o); return { matchedCount: 1, modifiedCount: 1 }; },
    async updateMany(f, u) { await tick(); const ds = find(f); ds.forEach((d) => applyUpdate(d, u)); return { matchedCount: ds.length, modifiedCount: ds.length }; },
    async countDocuments(f) { await tick(); return find(f).length; },
    async deleteOne(f) { await tick(); const i = docs.findIndex((d) => matches(d, f)); if (i >= 0) docs.splice(i, 1); return { deletedCount: i >= 0 ? 1 : 0 }; },
    async replaceOne(f, d, o) { await tick(); const i = docs.findIndex((x) => matches(x, f)); if (i >= 0) docs[i] = clone(d); else if (o && o.upsert) docs.push(clone(d)); return { matchedCount: i >= 0 ? 1 : 0 }; },
  };
}
let cols = {};
const colOf = (name) => (cols[name] = cols[name] || fakeCollection());
const dbPath = require.resolve('../db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {
  getDbHandle: async () => ({ collection: colOf }),
  getUsers: async () => colOf('users'),
  getAppData: async () => ({ data: {} }),
} };
// Capture the activity log instead of writing anywhere.
const logged = [];
const actPath = require.resolve('../activity-log');
require.cache[actPath] = { id: actPath, filename: actPath, loaded: true, exports: {
  log: (req, action, opts) => { logged.push({ action, user: req.user && req.user.sub, target: opts && opts.target, detail: opts && opts.detail }); return Promise.resolve(); },
  record: async () => {}, actorOf: () => ({}), ipOf: () => '',
} };
const dc = require('../data-collection');

/* ---------------- fixtures + a fake express app ---------------- */
function reset() {
  cols = {}; logged.length = 0;
  colOf('departments').docs.push({
    _id: 'icu', id: 'icu', name: 'CCU', months: ['Jun-26'], data: [{ adm: 5 }], cols: [{ id: 'adm', label: 'Admissions' }, { id: 'dis', label: 'Discharges' }, { id: 'old', label: 'Bed Occupancy', hidden: true }],
    quality: { key: 'ICU', name: 'CCU', indicators: [
      { id: 'nsi', name: 'Needle Stick Injury', formula: 'rate100', denAdminOnly: true, months: {}, mNum: {}, mDen: { 'Jul-26': 138 } },
    ] },
  });
  colOf('departments').docs.push({ _id: 'er', id: 'er', name: 'Emergency', months: [], data: [], cols: [{ id: 'adm', label: 'Admissions' }] });
  colOf('users').docs.push({ username: 'zakir', name: 'Md Zakir', role: 'incharge', departments: ['icu'], qualityAreas: ['ICU'], responsibleId: 'resp-zakir' });
  colOf('users').docs.push({ username: 'rina', name: 'Rina', role: 'incharge', departments: ['icu'], qualityAreas: ['ICU'] });
}
const dept = (id) => colOf('departments').docs.find((d) => d._id === (id || 'icu'));
const reqDoc = (id) => colOf('fieldRequests').docs.find((r) => r._id === id);
const sub = (id) => colOf('submissions').docs.find((s) => s._id === id);

const routes = {};
const app = new Proxy({}, { get: (_, verb) => (path, ...hs) => { routes[verb.toUpperCase() + ' ' + path] = hs.flat(); } });
dc.mount(app, { requireApi: [(req, res, next) => next()] });
const ADMIN = { user: { sub: 'admin', role: 'Administrator', name: 'Admin' }, access: { unrestricted: true } };
const portal = (sub, name) => ({ user: { sub, role: 'incharge', name }, access: { unrestricted: false, role: 'incharge' } });
const ZAKIR = portal('zakir', 'Md Zakir');
const RINA = portal('rina', 'Rina');
async function call(route, { params = {}, body = {}, query = {}, as = ADMIN } = {}) {
  const hs = routes[route];
  assert.ok(hs, 'route not mounted: ' + route);
  const out = { status: 200, body: null, headers: {} };
  const res = { status(c) { out.status = c; return res; }, json(b) { out.body = b; return res; }, set(k, v) { out.headers[k] = v; return res; }, type() { return res; }, send(b) { out.body = b; return res; }, redirect() { return res; } };
  const req = { params, body, query, user: as.user, access: as.access, method: route.split(' ')[0] };
  let i = 0;
  const next = async () => { const h = hs[i++]; if (h) await h(req, res, next); };
  await next();
  return out;
}
const ask = (deptId, body, as) => call('POST /api/departments/:id/field-requests', { params: { id: deptId }, body, as });
const decide = (id, body, as) => call('POST /api/field-requests/:id/decide', { params: { id }, body, as });
const list = (query, as) => call('GET /api/field-requests', { query, as });
const norm = (s) => String(s).toLowerCase().replace(/\s+/g, '');

(async () => {
  // 1. An in-charge requests a field for their own department; another department is refused.
  reset();
  { const r = await ask('icu', { label: '  Re-admissions ', pct: true, reason: ' Board wants readmission tracking ' }, ZAKIR);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const q = r.body.request;
    assert.equal(q.label, 'Re-admissions'); assert.equal(q.reason, 'Board wants readmission tracking');
    assert.equal(q.pct, true); assert.equal(q.status, 'pending'); assert.equal(q.deptName, 'CCU');
    assert.equal(q.requestedBy, 'Md Zakir'); assert.equal(q.requestedByUser, 'zakir'); assert.ok(q.createdAt > 0);
    assert.equal(reqDoc(q.id).status, 'pending');
    assert.equal(dept().cols.length, 3, 'a request never adds a column by itself');
    assert.equal(logged[0].action, 'field_requested');
    const other = await ask('er', { label: 'Triage time', reason: 'Needed' }, ZAKIR);
    assert.equal(other.status, 403, 'not their department');
    assert.equal((await call('POST /api/departments/:id/fields', { params: { id: 'icu' }, body: { label: 'X' }, as: ZAKIR })).status, 403, 'adding a field directly stays admin-only');
    assert.equal((await ask('er', { label: 'Triage time', reason: 'Needed' }, ADMIN)).status, 200, 'an admin may file one too'); }

  // 2. Label and reason are required.
  reset();
  { const blank = await ask('icu', { label: 'Re-admissions', reason: '   ' }, ZAKIR);
    assert.equal(blank.status, 400); assert.match(blank.body.error, /why/);
    assert.equal((await ask('icu', { label: '  ', reason: 'x' }, ZAKIR)).status, 400);
    assert.equal(colOf('fieldRequests').docs.length, 0); }

  // 3. A duplicate pending request, or a label that already is a column, is a 409.
  reset();
  { const first = await ask('icu', { label: 'Re-admissions', reason: 'a' }, ZAKIR);
    const dup = await ask('icu', { label: 'RE-ADMISSIONS ', reason: 'b' }, RINA);
    assert.equal(dup.status, 409); assert.equal(dup.body.code, 'pending'); assert.equal(dup.body.pendingId, first.body.request.id);
    const col = await ask('icu', { label: 'ad missions', reason: 'c' }, ZAKIR);
    assert.equal(col.status, 409); assert.equal(col.body.code, 'exists'); assert.match(col.body.error, /Admissions/);
    assert.equal((await ask('icu', { label: 'Bed Occupancy', reason: 'hidden duplicate columns do not count' }, ZAKIR)).status, 200);
    assert.equal((await ask('er', { label: 'Re-admissions', reason: 'another unit may ask for the same' }, ADMIN)).status, 200);
    assert.equal(colOf('fieldRequests').docs.length, 3); }

  // 4. Approve adds exactly one column and stores its id; a second decision is a 409.
  reset();
  { const id = (await ask('icu', { label: 'Re-admissions', pct: true, reason: 'a' }, ZAKIR)).body.request.id;
    assert.equal((await decide(id, { status: 'approved' }, ZAKIR)).status, 403, 'only an administrator decides');
    const [a, b] = await Promise.all([decide(id, { status: 'approved' }), decide(id, { status: 'approved' })]);
    const wins = [a, b].filter((x) => x.status === 200), loses = [a, b].filter((x) => x.status === 409);
    assert.equal(wins.length, 1, JSON.stringify([a.body, b.body])); assert.equal(loses.length, 1);
    const added = dept().cols.filter((c) => norm(c.label) === 're-admissions');
    assert.equal(added.length, 1, 'exactly one column');
    assert.equal(added[0].pct, true); assert.equal(added[0].custom, true);
    const d = reqDoc(id);
    assert.equal(d.status, 'approved'); assert.equal(d.fieldId, added[0].id); assert.equal(d.decidedBy, 'Admin'); assert.ok(d.decidedAt > 0); assert.equal(d.linkedExisting, false);
    assert.equal(wins[0].body.request.fieldId, added[0].id);
    const again = await decide(id, { status: 'approved' });
    assert.equal(again.status, 409); assert.equal(again.body.currentStatus, 'approved');
    const late = await decide(id, { status: 'rejected', reason: 'changed my mind' });
    assert.equal(late.status, 409); assert.equal(reqDoc(id).status, 'approved');
    assert.equal(dept().cols.length, 4);
    assert.ok(logged.some((l) => l.action === 'field_request_approved' && /added field/.test(l.detail))); }

  // 5. Approving when the column was added meanwhile links to it — no duplicate.
  reset();
  { const id = (await ask('icu', { label: 'Bed days', reason: 'a' }, ZAKIR)).body.request.id;
    const manual = await dc.addDepartmentField('icu', { label: 'BED  DAYS' });
    const r = await decide(id, { status: 'approved', reason: 'already there' });
    assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.linked, true);
    assert.equal(reqDoc(id).fieldId, manual.field.id); assert.equal(reqDoc(id).linkedExisting, true); assert.equal(reqDoc(id).status, 'approved');
    assert.equal(dept().cols.filter((c) => norm(c.label) === 'beddays').length, 1, 'no duplicate column'); }
  // Two different requests approved at once both land (the cols write is conditional).
  reset();
  { const a = (await ask('icu', { label: 'Field A', reason: 'a' }, ZAKIR)).body.request.id;
    const b = (await ask('icu', { label: 'Field B', reason: 'b' }, ZAKIR)).body.request.id;
    const rs = await Promise.all([decide(a, { status: 'approved' }), decide(b, { status: 'approved' })]);
    rs.forEach((x) => assert.equal(x.status, 200, JSON.stringify(x.body)));
    assert.deepEqual(dept().cols.map((c) => c.label).slice(-2).sort(), ['Field A', 'Field B']); }
  // A failed apply releases the claim (the request goes back to pending, nothing lost).
  reset();
  { const id = (await ask('icu', { label: 'Gone', reason: 'a' }, ZAKIR)).body.request.id;
    colOf('departments').docs.splice(0, 1);
    const r = await decide(id, { status: 'approved' });
    assert.equal(r.status, 400); assert.equal(reqDoc(id).status, 'pending'); }

  // 6. Decline needs a reason.
  reset();
  { const id = (await ask('icu', { label: 'Re-admissions', reason: 'a' }, ZAKIR)).body.request.id;
    const blank = await decide(id, { status: 'rejected', reason: '  ' });
    assert.equal(blank.status, 400); assert.equal(reqDoc(id).status, 'pending');
    assert.equal((await decide(id, { status: 'maybe' })).status, 400);
    const ok = await decide(id, { status: 'rejected', reason: ' Use the Re-admission indicator instead ' });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(reqDoc(id).status, 'rejected'); assert.equal(reqDoc(id).decisionReason, 'Use the Re-admission indicator instead'); assert.equal(reqDoc(id).fieldId, null);
    assert.equal(dept().cols.length, 3, 'a declined request adds nothing');
    assert.ok(logged.some((l) => l.action === 'field_request_rejected'));
    assert.equal((await ask('icu', { label: 'Re-admissions', reason: 'asking again with more detail' }, ZAKIR)).status, 200, 'a declined request does not block a new one');
    assert.equal(colOf('fieldRequests').docs.length, 2, 'requests are never deleted'); }

  // 7. A portal user's list holds only their own requests; an admin sees all, newest first.
  reset();
  { const z = (await ask('icu', { label: 'Zakir field', reason: 'a' }, ZAKIR)).body.request.id;
    const r = (await ask('icu', { label: 'Rina field', reason: 'b' }, RINA)).body.request.id;
    reqDoc(z).createdAt = 1000; reqDoc(r).createdAt = 2000;
    const mine = await list({ status: 'all' }, ZAKIR);
    assert.equal(mine.status, 200); assert.equal(mine.headers['Cache-Control'], 'no-store');
    assert.deepEqual(mine.body.requests.map((x) => x.id), [z]);
    const all = await list({ status: 'all' });
    assert.deepEqual(all.body.requests.map((x) => x.id), [r, z], 'newest first');
    await decide(r, { status: 'approved' });
    assert.deepEqual((await list({ status: 'pending' })).body.requests.map((x) => x.id), [z]);
    assert.deepEqual((await list({ status: 'pending' }, RINA)).body.requests, []); }

  // 8. A portal account always reports as itself, whatever responsible person the body names.
  reset();
  { const p = await call('POST /api/submissions/patient', { body: { department: 'icu', month: 'Jul-26', values: { adm: 4 }, responsible: { id: 'resp-other', name: 'Someone Else' } }, as: ZAKIR });
    assert.equal(p.status, 200, JSON.stringify(p.body));
    assert.deepEqual(sub(p.body.submission.id).responsible, { id: 'resp-zakir', name: 'Md Zakir', title: '' });
    const q = await call('POST /api/submissions/quality', { body: { area: 'ICU', month: 'Aug-26', indicatorId: 'nsi', num: 1, responsible: { name: 'Someone Else' } }, as: RINA });
    assert.equal(q.status, 200, JSON.stringify(q.body));
    assert.equal(sub(q.body.submission.id).responsible.name, 'Rina');
    const a = await call('POST /api/submissions/patient', { body: { department: 'er', month: 'Jul-26', values: { adm: 4 }, responsible: { name: 'Night Supervisor' } } });
    assert.equal(sub(a.body.submission.id).responsible.name, 'Night Supervisor', 'an admin may still name anyone'); }

  // 9. A portal account cannot set an admin-owned denominator (the NSI headcount).
  reset();
  { const r = await call('POST /api/submissions/quality', { body: { area: 'ICU', month: 'Aug-26', indicatorId: 'nsi', entryMode: 'rate', num: 3, den: 50 }, as: ZAKIR });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const id = r.body.submission.id;
    assert.ok(!(sub(id).den > 0), 'the submitted denominator is dropped (0 = none, as the locked form sends)');
    const p = await call('PATCH /api/submissions/:id', { params: { id }, body: { num: 3, den: 40 }, as: ZAKIR });
    assert.equal(p.status, 200, JSON.stringify(p.body));
    assert.ok(!(sub(id).den > 0), 'an edit cannot set it either');
    await dc.approveSubmission(id, 'admin');
    const nsi = dept().quality.indicators.find((i) => i.id === 'nsi');
    assert.equal(nsi.mDen['Aug-26'], undefined, 'stored denominator unchanged');
    assert.equal(nsi.mDen['Jul-26'], 138);
    assert.equal(nsi.mNum['Aug-26'], 3);
    assert.equal(nsi.months['Aug-26'], 2.17, 'the rate uses the admin headcount'); }

  console.log('Field request + portal guard checks passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
