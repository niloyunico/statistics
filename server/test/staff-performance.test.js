/* Self-test for the achievement / incident registers — server/staff-performance.js.

   These are personal-file records: an entry filed against a nurse changes the bonus or
   the penalty on their appraisal, and the appraisal drives Part H (increment,
   counselling, a warning). So the thing worth asserting is not "the route answered 200"
   but that NOTHING THE BROWSER SENT WAS DROPPED on the way to storage, and that an
   entry which cannot be attributed to a person is refused outright.

   Needs no database: with no MONGODB_URI the module keeps its own in-memory store, and
   a minimal fake Express collects the route handlers.

   Run: node server/test/staff-performance.test.js
*/
delete process.env.MONGODB_URI;

let pass = 0, fail = 0;
const ok = (name, cond, got) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (got === undefined ? '' : '   got: ' + JSON.stringify(got))); }
};

// --- a fake Express that just remembers the handlers -------------------------
const routes = [];
const app = {
  get: (p, ...h) => routes.push({ m: 'GET', p, h }),
  post: (p, ...h) => routes.push({ m: 'POST', p, h }),
  put: (p, ...h) => routes.push({ m: 'PUT', p, h }),
  delete: (p, ...h) => routes.push({ m: 'DELETE', p, h }),
};
require('../staff-performance.js').mount(app, {});

// An unrestricted session, which is what the CNS / administrator carries.
function call(method, path, body, params) {
  const r = routes.find((x) => x.m === method && x.p === path);
  if (!r) return Promise.reject(new Error('no route ' + method + ' ' + path));
  const req = { body: body || {}, params: params || {}, method, user: { name: 'Test Admin' }, access: { unrestricted: true } };
  return new Promise((resolve, reject) => {
    const res = {
      _code: 200,
      status(c) { this._code = c; return this; },
      json(v) { resolve({ code: this._code, body: v }); },
      set() { return this; },
    };
    const chain = r.h.slice();
    const next = () => {
      const h = chain.shift();
      if (!h) return reject(new Error('handlers exhausted'));
      Promise.resolve(h(req, res, next)).catch(reject);
    };
    next();
  });
}

/* The exact payloads the two screens send: the Performance module's register
   (renderer/unico/performance.jsx EntryModal) and the staff profile's Recognition &
   conduct card (renderer/unico/staff-profile.jsx ConductDialog). They must agree — an
   entry filed from one place has to be indistinguishable from the other. */
const INCIDENT = {
  empId: '11376', staffId: '482', staffName: 'Adory Lakra',
  department: 'Medical ICU', designation: 'Staff Nurse',
  cycleId: 'c-2025-09-20', date: '2026-09-19',
  category: 'Attendance / punctuality', severity: 'Minor',
  what: 'Late for the morning handover twice in one week.',
  action: 'Counselled, retraining scheduled', note: 'First occurrence on file.',
  points: 1,
};
const ACHIEVEMENT = {
  empId: '11376', staffId: '482', staffName: 'Adory Lakra',
  department: 'Medical ICU', designation: 'Staff Nurse',
  cycleId: 'c-2025-09-20', date: '2026-09-18',
  category: 'Training completed', level: 'National',
  what: 'Completed the national infection-control course.',
  reward: 'Certificate of appreciation', note: 'Certificate on file.',
  points: 2,
};

(async () => {
  console.log('\nstaff-performance — registers');

  // ---- the save round trip --------------------------------------------------
  const i = await call('POST', '/api/performance/incidents', INCIDENT);
  ok('an incident saves', i.code === 200 && i.body.ok, i.body);
  const a = await call('POST', '/api/performance/achievements', ACHIEVEMENT);
  ok('an achievement saves', a.code === 200 && a.body.ok, a.body);

  const g = await call('GET', '/api/performance');
  ok('the module loads', g.code === 200 && g.body.ok);
  const inc = (g.body.incidents || [])[0] || {};
  const ach = (g.body.achievements || [])[0] || {};
  ok('the incident is on file', !!inc.id, g.body.incidents);
  ok('the achievement is on file', !!ach.id, g.body.achievements);

  // NOTHING the browser sent may be lost between the dialog and storage.
  Object.keys(INCIDENT).forEach((k) => ok('incident keeps ' + k, String(inc[k]) === String(INCIDENT[k]), inc[k]));
  Object.keys(ACHIEVEMENT).forEach((k) => ok('achievement keeps ' + k, String(ach[k]) === String(ACHIEVEMENT[k]), ach[k]));

  /* staffId matters more than it looks: employee numbers are NOT unique in this
     register (11410 and 11520 each belong to two different people — see
     staff-roster.js), so the number alone cannot say whose record an entry is. */
  ok('the entry records WHICH person, not just the number', inc.staffId === '482' && ach.staffId === '482', [inc.staffId, ach.staffId]);

  // Who filed it and when — an appraisal deduction with no author is not a record.
  ok('incident is stamped with an author', inc.createdBy === 'Test Admin', inc.createdBy);
  ok('incident is stamped with a time', typeof inc.createdAt === 'number' && inc.createdAt > 0, inc.createdAt);
  ok('achievement is stamped with an author', ach.createdBy === 'Test Admin', ach.createdBy);
  ok('achievement is stamped with a time', typeof ach.createdAt === 'number' && ach.createdAt > 0, ach.createdAt);

  // The points must reach the appraisal maths.
  ok('the deduction is reported back', i.body.points && i.body.points.rawPenalty === 1, i.body.points);
  ok('the bonus is reported back', a.body.points && a.body.points.rawBonus === 2, a.body.points);

  // ---- refusals -------------------------------------------------------------
  const noEmp = await call('POST', '/api/performance/incidents', Object.assign({}, INCIDENT, { empId: '' }));
  ok('refuses an entry with no staff member', noEmp.code === 400, noEmp.body);
  const noWhat = await call('POST', '/api/performance/achievements', Object.assign({}, ACHIEVEMENT, { what: '   ' }));
  ok('refuses an entry with nothing described', noWhat.code === 400, noWhat.body);

  // ---- removing one filed by mistake ---------------------------------------
  const del = await call('DELETE', '/api/performance/incidents/:id', null, { id: inc.id });
  ok('a mistaken incident can be removed', del.code === 200 && del.body.ok, del.body);
  const g2 = await call('GET', '/api/performance');
  ok('and it is gone from the register', (g2.body.incidents || []).length === 0, g2.body.incidents);
  const gone = await call('DELETE', '/api/performance/incidents/:id', null, { id: inc.id });
  ok('removing it twice reports not-found rather than pretending', gone.body.ok === false, gone.body);

  // ---- the categories an entry can be filed under ---------------------------
  ok('defaults are shipped', (g.body.categories.ach || []).length === 6 && (g.body.categories.inc || []).length === 6,
    g.body.categories && { ach: g.body.categories.ach.length, inc: g.body.categories.inc.length });
  ok('untouched defaults are not reported as customised', g.body.categories.customised === false, g.body.categories.customised);

  const put = await call('PUT', '/api/performance/categories', {
    ach: [{ id: 'award', label: 'Award / recognition', levels: [['Hospital', 3], ['Unit', 1]] },
      { label: 'Research published', levels: [['International', 3]] }],
    inc: [{ id: 'medication', label: 'Medication error' }, { label: 'Handover lapse' }],
  });
  ok('an administrator can save the lists', put.code === 200 && put.body.ok, put.body);
  const cats = (put.body || {}).categories || {};
  ok('a new achievement category is kept', (cats.ach || []).some((c) => c.label === 'Research published'), cats.ach);
  ok('a new category gets a stable id', ((cats.ach || []).find((c) => c.label === 'Research published') || {}).id === 'research-published', cats.ach);
  ok('a new incident category is kept', (cats.inc || []).some((c) => c.label === 'Handover lapse'), cats.inc);
  ok('customised lists are reported as such', cats.customised === true, cats.customised);

  const g3 = await call('GET', '/api/performance');
  ok('the saved lists come back on the next load', (g3.body.categories.ach || []).length === 2, g3.body.categories.ach);

  /* Editing the list must never rewrite what is already filed: an entry stores the
     category TEXT it was saved with, so a renamed or deleted category leaves last
     year's register reading exactly as it did. */
  ok('an entry filed earlier keeps its own category',
    (g3.body.achievements[0] || {}).category === 'Training completed', (g3.body.achievements[0] || {}).category);

  const empty = await call('PUT', '/api/performance/categories', { ach: [], inc: [] });
  ok('refuses to leave a list empty', empty.code === 400, empty.body);

  const over = await call('PUT', '/api/performance/categories', {
    ach: [{ label: 'Huge', levels: [['Everything', 99]] }], inc: [{ label: 'Something' }],
  });
  const huge = ((over.body.categories || {}).ach || []).find((c) => c.label === 'Huge');
  ok('a category cannot award more than the per-cycle cap', huge && huge.levels[0][1] === 5, huge && huge.levels);

  console.log('\n  ' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('  ERROR', e); process.exit(2); });
