// Approval / data-integrity regression tests against an in-memory fake Mongo.
// No database, network or file writes. Every fake operation yields to the event loop
// first, so two concurrent approvals genuinely interleave their reads and writes — the
// condition under which the old whole-array writes lost updates.
const assert = require('node:assert/strict');

/* ---------------- a small fake Mongo (only what data-collection.js uses) ---------------- */
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
  Object.entries(u.$inc || {}).forEach(([p, v]) => { doc[p] = (doc[p] || 0) + v; });
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
const dc = require(process.env.DC_MODULE || '../data-collection');

/* ---------------- fixtures + a fake express app ---------------- */
function reset() {
  cols = {};
  colOf('departments').docs.push({
    _id: 'icu', id: 'icu', name: 'ICU', months: ['Jun-26'], data: [{ adm: 5 }], cols: [{ id: 'adm', label: 'Admissions' }, { id: 'dis', label: 'Discharges' }],
    quality: { key: 'ICU', name: 'ICU', indicators: [
      { id: 'falls', name: 'Falls', formula: 'count', months: {} },
      { id: 'nsi', name: 'Needle Stick Injury', formula: 'rate100', denAdminOnly: true, months: {}, mNum: {}, mDen: { 'Jul-26': 138 } },
      { id: 'hh', name: 'Hand Hygiene', formula: 'pct', months: {}, mNum: {}, mDen: {} },
    ] },
  });
}
const dept = () => colOf('departments').docs[0];
const ind = (id) => dept().quality.indicators.find((i) => i.id === id);
const sub = (id) => colOf('submissions').docs.find((s) => s._id === id);
const liveRow = (month) => dept().data[dept().months.indexOf(month)];

const routes = {};
const app = new Proxy({}, { get: (_, verb) => (path, ...hs) => { routes[verb.toUpperCase() + ' ' + path] = hs.flat(); } });
dc.mount(app, { requireApi: [(req, res, next) => next()] });
const ADMIN = { user: { sub: 'admin', role: 'Administrator', name: 'Admin' }, access: { unrestricted: true } };
async function call(route, { params = {}, body = {}, query = {}, as = ADMIN } = {}) {
  const hs = routes[route];
  assert.ok(hs, 'route not mounted: ' + route);
  const out = { status: 200, body: null };
  const res = { status(c) { out.status = c; return res; }, json(b) { out.body = b; return res; }, set() { return res; }, type() { return res; }, send(b) { out.body = b; return res; }, redirect() { return res; } };
  const req = { params, body, query, user: as.user, access: as.access, method: route.split(' ')[0] };
  let i = 0;
  const next = async () => { const h = hs[i++]; if (h) await h(req, res, next); };
  await next();
  return out;
}
const approve = (id) => dc.approveSubmission(id, 'admin');
const patient = async (month, values) => (await dc.submitPatient({ department: 'icu', month, values }, { submittedBy: 'nurse' })).submission;
const quality = async (payload) => (await dc.submitQuality(Object.assign({ area: 'ICU' }, payload), { submittedBy: 'nurse' })).submission;

(async () => {
  // 1. Two patient approvals for one department overlapping in time both land.
  reset();
  { const a = await patient('Jul-26', { adm: 7 }); const b = await patient('Aug-26', { adm: 9 });
    await Promise.all([approve(a.id), approve(b.id)]);
    assert.deepEqual(dept().months, ['Jun-26', 'Jul-26', 'Aug-26'], 'concurrent patient approvals must not erase each other');
    assert.equal(liveRow('Jul-26').adm, 7); assert.equal(liveRow('Aug-26').adm, 9);
    assert.ok(dept().approvedAt['Jul-26'] > 0 && dept().approvedAt['Aug-26'] > 0, 'approval time is stamped per month'); }

  // 2. Two approvals for the SAME indicator, different months, overlapping in time both land.
  reset();
  { const a = await quality({ month: 'Jul-26', indicatorId: 'hh', num: 8, den: 10 }); const b = await quality({ month: 'Aug-26', indicatorId: 'hh', num: 9, den: 10 });
    await Promise.all([approve(a.id), approve(b.id)]);
    assert.equal(ind('hh').months['Jul-26'], 80, 'Jul must survive a concurrent Aug approval');
    assert.equal(ind('hh').months['Aug-26'], 90); }

  // 3. A double click approves once; the second call never re-applies or errors out wrongly.
  reset();
  { const a = await patient('Jul-26', { adm: 7 });
    const rs = await Promise.allSettled([approve(a.id), approve(a.id)]);
    assert.ok(rs.some((r) => r.status === 'fulfilled' && r.value.ok), 'one approval succeeds');
    rs.filter((r) => r.status === 'rejected').forEach((r) => assert.match(r.reason.message, /already being approved/));
    assert.equal(sub(a.id).status, 'approved'); }

  // 4. NSI cases against the admin headcount are not wiped by a placeholder value of 0.
  reset();
  { const a = await quality({ month: 'Jul-26', indicatorId: 'nsi', num: 3 });
    const p = await call('PATCH /api/submissions/:id', { params: { id: a.id }, body: { value: 0, num: 3, note: '' } });
    assert.equal(p.status, 200, JSON.stringify(p.body));
    await approve(a.id);
    assert.equal(ind('nsi').mNum['Jul-26'], 3, 'logged NSI cases must survive approval');
    assert.equal(ind('nsi').months['Jul-26'], 2.17);
    assert.equal(ind('nsi').mDen['Jul-26'], 138, 'admin headcount untouched'); }

  // 5. A count indicator submitted in rate mode stays a count.
  reset();
  { const a = await quality({ month: 'Jul-26', indicatorId: 'falls', entryMode: 'rate', formula: 'rate1000', num: 2, den: 3000 });
    await approve(a.id);
    assert.equal(ind('falls').formula, 'count', 'a submission must not redefine the indicator');
    assert.equal(ind('falls').months['Jul-26'], 2); }

  // 6. Auto-reject removes only OLDER duplicates; a newer correction is never thrown away.
  reset();
  { const a = await dc.createSubmission({ type: 'patient', department: 'icu', departmentName: 'ICU', month: 'Jul-26', values: { adm: 1 } }, {});
    const b = await dc.createSubmission({ type: 'patient', department: 'icu', departmentName: 'ICU', month: 'Jul-26', values: { adm: 2 } }, {});
    sub(a.id).submittedAt = 1000; sub(b.id).submittedAt = 2000;
    await approve(a.id);
    assert.equal(sub(b.id).status, 'pending', 'approving the older row must not reject the newer one');
    await approve(b.id);
    assert.equal(liveRow('Jul-26').adm, 2); }
  reset();
  { const a = await dc.createSubmission({ type: 'patient', department: 'icu', departmentName: 'ICU', month: 'Jul-26', values: { adm: 1 } }, {});
    const b = await dc.createSubmission({ type: 'patient', department: 'icu', departmentName: 'ICU', month: 'Jul-26', values: { adm: 2 } }, {});
    sub(a.id).submittedAt = 1000; sub(b.id).submittedAt = 2000;
    await approve(b.id);
    assert.equal(sub(a.id).status, 'rejected');
    await assert.rejects(approve(a.id), (e) => e.superseded === true, 'superseded rows are a skip');
    assert.equal(liveRow('Jul-26').adm, 2); }

  // 7. A second pending submission for the same target + month is refused.
  reset();
  { await patient('Jul-26', { adm: 7 });
    await assert.rejects(patient('Jul-26', { adm: 8 }), (e) => e.status === 409 && /already waiting/.test(e.message));
    await quality({ month: 'Jul-26', indicatorId: 'falls', value: 1 });
    await assert.rejects(quality({ month: 'Jul-26', indicatorId: 'falls', value: 2 }), /already waiting/);
    await quality({ month: 'Jul-26', indicatorId: 'hh', num: 1, den: 2 }); }

  // 8. Editing an approved submission works when the (unchanged) month is sent; moving it doesn't.
  reset();
  { const a = await patient('Jul-26', { adm: 7, dis: 2 });
    await approve(a.id);
    const ok = await call('PATCH /api/submissions/:id', { params: { id: a.id }, body: { note: '', month: 'Jul-26', values: { adm: 11, dis: 2 } } });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(liveRow('Jul-26').adm, 11, 'approved edit re-applied live');
    const moved = await call('PATCH /api/submissions/:id', { params: { id: a.id }, body: { month: 'Aug-26', values: { adm: 11 } } });
    assert.equal(moved.status, 400); }

  // 9. A numerator edit recomputes the value, so approval does not back-solve the old one.
  reset();
  { const a = await quality({ month: 'Jul-26', indicatorId: 'hh', num: 8, den: 10 });
    const p = await call('PATCH /api/submissions/:id', { params: { id: a.id }, body: { num: 9 } });
    assert.equal(p.body.submission.value, 90);
    await approve(a.id);
    assert.equal(ind('hh').mNum['Jul-26'], 9, 'numerator correction must survive approval');
    assert.equal(ind('hh').months['Jul-26'], 90); }

  // 10. A collector's page is cut AFTER scoping, so their older rows are not lost.
  reset();
  { colOf('users').docs.push({ username: 'c1', name: 'C One', role: 'collector', departments: ['icu'], qualityAreas: [] });
    for (let i = 0; i < 2; i++) await dc.createSubmission({ type: 'patient', department: 'icu', month: 'Jan-26', values: { adm: i } }, { submittedBy: 'someone' });
    for (let i = 0; i < 5; i++) await dc.createSubmission({ type: 'patient', department: 'er', month: 'Jan-26', values: { adm: i } }, { submittedBy: 'someone' });
    colOf('submissions').docs.forEach((s, i) => { s.submittedAt = i; });
    const as = { user: { sub: 'c1', role: 'collector', name: 'C One' }, access: { unrestricted: false, role: 'collector' } };
    const r = await call('GET /api/submissions', { query: { limit: '3', status: 'all' }, as });
    assert.equal(r.body.submissions.length, 2, 'both of the collector\'s rows are on the first page');
    assert.equal(r.body.nextOffset, null); }

  // 11. A collector limited to specific indicators can't report others.
  reset();
  { colOf('users').docs.push({ username: 'c2', name: 'C Two', role: 'collector', departments: [], qualityAreas: ['ICU'], qualityIndicators: { ICU: ['falls'] } });
    const as = { user: { sub: 'c2', role: 'collector', name: 'C Two' }, access: { unrestricted: false, role: 'collector' } };
    const no = await call('POST /api/submissions/quality', { body: { area: 'ICU', month: 'Jul-26', indicatorId: 'hh', num: 1, den: 2 }, as });
    assert.equal(no.status, 403);
    const yes = await call('POST /api/submissions/quality', { body: { area: 'ICU', month: 'Jul-26', indicatorId: 'falls', value: 1 }, as });
    assert.equal(yes.status, 200, JSON.stringify(yes.body)); }

  // 12. Clearing a figure on an approved sheet removes it from the live row.
  reset();
  { const a = await patient('Jul-26', { adm: 7, dis: 2 });
    await approve(a.id);
    const p = await call('PATCH /api/submissions/:id', { params: { id: a.id }, body: { month: 'Jul-26', values: { adm: 7, dis: '' } } });
    assert.equal(p.status, 200, JSON.stringify(p.body));
    assert.equal(liveRow('Jul-26').dis, undefined, 'a cleared figure must not stay live');
    assert.equal(liveRow('Jul-26').adm, 7); }

  // 13. Editing a "Not observed" submission's note keeps it not-observed.
  reset();
  { const a = await quality({ month: 'Jul-26', indicatorId: 'hh', notObserved: true, remark: 'Not observed — audit postponed' });
    const p = await call('PATCH /api/submissions/:id', { params: { id: a.id }, body: { note: 'checked', num: '', den: '', remark: 'Not observed — audit postponed' } });
    assert.equal(p.status, 200, JSON.stringify(p.body));
    assert.equal(sub(a.id).notObserved, true, 'a note edit must not turn Not observed into a reading');
    await approve(a.id);
    assert.equal(ind('hh').mNotObserved['Jul-26'], true);
    assert.equal(ind('hh').months['Jul-26'], undefined); }

  // 14. Collection settings: start month + not measured — admin-only, enforced for collectors.
  reset();
  { colOf('users').docs.push({ username: 'c3', name: 'C Three', role: 'collector', departments: ['icu'], qualityAreas: ['ICU'] });
    const collector = { user: { sub: 'c3', role: 'collector', name: 'C Three' }, access: { unrestricted: false, role: 'collector' } };
    const route = 'PUT /api/departments/:id/collection-settings';
    assert.equal((await call(route, { params: { id: 'icu' }, body: { startMonth: 'Jul-26' }, as: collector })).status, 403, 'collectors cannot change settings');
    assert.equal((await call(route, { params: { id: 'icu' }, body: { notMeasured: { falls: { reason: ' ' } } } })).status, 400, 'a reason is required');
    assert.equal((await call(route, { params: { id: 'icu' }, body: { startMonth: 'Bogus' } })).status, 400, 'start month must be a real month');
    const ok = await call(route, { params: { id: 'icu' }, body: { startMonth: 'Jul-26', notMeasured: { falls: { reason: 'No inpatients in this unit' } } } });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(dept().collection.startMonth, 'Jul-26');
    assert.equal(dept().collection.notMeasured.falls.reason, 'No inpatients in this unit');
    assert.equal((await call('POST /api/submissions/patient', { body: { department: 'icu', month: 'Jun-26', values: { adm: 1 } }, as: collector })).status, 400, 'no collector data before the start month');
    assert.equal((await call('POST /api/submissions/quality', { body: { area: 'ICU', month: 'Aug-26', indicatorId: 'falls', value: 1 }, as: collector })).status, 403, 'not-measured indicators cannot be submitted');
    const fine = await call('POST /api/submissions/patient', { body: { department: 'icu', month: 'Aug-26', values: { adm: 1 } }, as: collector });
    assert.equal(fine.status, 200, JSON.stringify(fine.body));
    assert.ok((await dc.submitPatient({ department: 'icu', month: 'Jun-26', values: { adm: 2 } }, { submittedBy: 'admin' })).ok, 'admin backfill is not restricted');
    const cleared = await call(route, { params: { id: 'icu' }, body: { startMonth: null, notMeasured: { falls: null } } });
    assert.equal(cleared.status, 200, JSON.stringify(cleared.body));
    assert.equal(dept().collection.startMonth, undefined);
    assert.equal(dept().collection.notMeasured.falls, undefined);
    assert.equal(dept().quality.indicators.length, 3, 'settings never touch recorded data');
    const list = await call('GET /api/collection-settings');
    assert.equal(list.body.departments[0].id, 'icu');
  }

  console.log('Approval integrity regression checks passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
