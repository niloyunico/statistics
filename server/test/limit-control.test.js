/* Access limits (Control Centre) — the resolution rules, the server-side enforcement on
   every route shape, the administrator-only API and its input validation, and the
   submission freeze. Run: node test/limit-control.test.js  (exit 0 = pass)

   SAFETY: this test must never reach a live service. dotenv is replaced before anything
   loads (so server/.env is never read, whatever the path casing), every live-service
   variable is removed, and the database module runs in its in-memory mode with a fake
   user collection. Nothing here can write to production. */
const Module = require('module');
const _load = Module._load;
Module._load = function (request) {
  if (request === 'dotenv' || request === 'dotenv/config' || /node_modules[\\/]dotenv[\\/]/i.test(request)) return { config: () => ({ parsed: {} }) };
  return _load.apply(this, arguments);
};
Object.keys(process.env).forEach((k) => {
  if (/^(MONGODB_|D1_|CLOUDFLARE|R2_|IMAGEKIT|CLOUDINARY|GMAIL|HIS_|BLOB_|REDIS|UPSTASH|KV_|VERCEL)/i.test(k)) delete process.env[k];
});
process.env.MONGODB_URI = '';
process.env.REQUIRE_AUTH = 'true';
process.env.JWT_SECRET = 'limit-control-test-' + process.pid + '-' + Date.now();

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  PASS  ' + name); } else { fail++; console.log('  FAIL  ' + name); } }
function eq(name, a, b) { const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) { pass++; console.log('  PASS  ' + name); } else { fail++; console.log('  FAIL  ' + name + '\n        got      ' + A + '\n        expected ' + B); } }

/* ---- fake user collection (patched in BEFORE the modules that destructure getUsers) ---- */
const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const USERS = [
  { username: 'admin', name: 'Admin', role: 'Administrator', active: true },
  { username: 'nurse1', name: 'Nurse One', role: 'User', active: true, responsibleId: 'resp-1',
    perms: { staff: ['view', 'edit'], kpi: ['view', 'edit', 'add'], datasubmit: ['view', 'add', 'edit'], datacol: 'none' } },
  { username: 'nurse2', name: 'Nurse Two', role: 'User', active: true, perms: { staff: ['view', 'edit'], kpi: ['view', 'edit', 'add'] } },
  { username: 'collector1', name: 'Collector', role: 'collector', active: true },
  { username: 'a.b', name: 'Dotted Name', role: 'User', active: true, perms: { staff: ['view'] } },
];
const matchQ = (q) => (u) => Object.keys(q || {}).every((k) => u[k] === q[k]);
const cursor = (rows) => { const c = { sort: () => c, limit: (n) => { rows = rows.slice(0, n); return c; }, toArray: async () => clone(rows) }; return c; };
const fakeUsers = {
  findOne: async (q) => clone(USERS.find(matchQ(q)) || null),
  find: (q) => cursor(USERS.filter(matchQ(q))),
  updateOne: async () => ({ matchedCount: 0 }),
  countDocuments: async () => USERS.length,
};
const db = require('../db');
db.getUsers = async () => fakeUsers;

const activity = require('../activity-log');
const LOGS = [];
activity.log = (req, action, opts) => { LOGS.push({ action, by: req && req.user && req.user.sub, target: opts && opts.target, detail: opts && opts.detail }); return Promise.resolve(); };

const LC = require('../limit-control');
const access = require('../access');
const auth = require('../auth');
const session = require('../session');
const cc = require('../control-centre');
const dataCollection = require('../data-collection');
const app = require('../index');   // /api/me, /api/data and the /api limit gate, exactly as deployed

// Probe routes for each guard shape that exists in the code base.
app.get('/api/probe/self', session.requireApi, (req, res) => res.json({ ok: true }));       // guards itself (kpi, device-days…)
app.post('/api/probe/self', session.requireApi, (req, res) => res.json({ ok: true }));
app.post('/api/kpi/print', session.requireApi, (req, res) => res.json({ ok: true }));       // a print record
app.get('/api/probe/perm', session.requireApi, access.requirePerm('staff', 'view'), (req, res) => res.json({ ok: true }));
app.post('/api/probe/perm', session.requireApi, access.requirePerm('staff', 'edit'), (req, res) => res.json({ ok: true }));
app.post('/api/probe/module', session.requireApi, access.requireModule('kpi'), (req, res) => res.json({ ok: true }));
app.post('/api/probe/attach', session.requireApi, access.attach, (req, res) => res.json({ ok: true }));
cc.mount(app, { requireApi: session.requireApi });
dataCollection.mount(app, { requireApi: [session.requireApi, access.requireModule('datacol')] });

const tok = (username) => { const u = USERS.find((x) => x.username === username); return auth.sign(u); };
let BASE = '';
async function call(method, url, who, body) {
  const headers = {};
  if (who) headers.authorization = 'Bearer ' + tok(who);
  if (body !== undefined) headers['content-type'] = 'application/json';
  const r = await fetch(BASE + url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  let j = null; const text = await r.text();
  try { j = JSON.parse(text); } catch (e) { j = { raw: text.slice(0, 80) }; }
  return { status: r.status, body: j, text };
}
const setCfg = async (changes, unset) => { await LC.writeConfig(changes || {}, unset); LC.invalidate(); access.invalidate(); };
const reset = async () => { LC._resetForTests(); access.invalidate(); };
const E = (level, message) => ({ level, message: message || '', at: 1, by: 'admin' });
const VIEW_ONLY = 'Your access is currently view-only. Changes cannot be saved.';
const PAUSED = 'Data submissions are currently paused for your account.';
const LOCKED = 'Your access is currently limited.';

(async () => {
  /* ====================================================== pure resolution === */
  console.log('\n== resolveLevel: order of the rules ==');
  const R = (cfg, a) => LC.resolveLevel(cfg, a);
  const admin = { username: 'admin', role: 'Administrator' };
  const n1 = { username: 'nurse1', role: 'User' };
  eq('Administrator role -> 0 even with global 4, role 4 and an own entry 4',
    R({ global: E(4), roles: { Administrator: E(4) }, users: { admin: E(4, 'x') } }, admin), { level: 0, message: '', source: 'exempt' });
  eq('unrestricted access object -> 0', R({ global: E(4) }, { unrestricted: true, username: 'x', role: 'User' }).level, 0);
  eq('user entry overrides a stricter role and global', R({ global: E(4), roles: { User: E(3) }, users: { nurse1: E(1, 'hello') } }, n1), { level: 1, message: 'hello', source: 'user' });
  eq('user level 0 = explicit exemption from role/global', R({ global: E(4, 'g'), roles: { User: E(3) }, users: { nurse1: E(0, 'ignored') } }, n1), { level: 0, message: '', source: 'user' });
  eq('no user entry: global stricter wins', R({ global: E(3, 'G'), roles: { User: E(2, 'R') } }, n1), { level: 3, message: 'G', source: 'global' });
  eq('no user entry: role stricter wins', R({ global: E(1, 'G'), roles: { User: E(2, 'R') } }, n1), { level: 2, message: 'R', source: 'role' });
  eq('tie: role wins with its own message', R({ global: E(2, 'G'), roles: { User: E(2, 'R') } }, n1), { level: 2, message: 'R', source: 'role' });
  eq('tie: role without message falls back to the global message', R({ global: E(2, 'G'), roles: { User: E(2, '') } }, n1), { level: 2, message: 'G', source: 'role' });
  eq('a different role setting does not apply', R({ roles: { collector: E(4) } }, n1), { level: 0, message: '', source: 'none' });

  console.log('\n== resolveLevel: missing / malformed configuration is safe ==');
  [null, undefined, 'x', 42, [], {}, { global: null }, { global: 'x' }, { global: { level: '4' } }, { global: { level: 2.5 } },
    { users: 'x', roles: [], global: [] }, { users: { nurse1: null } }].forEach((cfg, i) => {
    eq('malformed config #' + i + ' -> level 0', R(cfg, n1).level, 0);
  });
  eq('malformed user entry is ignored (role/global still apply)', R({ global: E(2), users: { nurse1: { level: 'abc' } } }, n1).level, 2);
  eq('stored out-of-range level clamps to 4', R({ global: { level: 9 } }, n1).level, 4);
  eq('stored negative level clamps to 0', R({ global: { level: -3 } }, n1).level, 0);
  eq('non-string stored message reads as empty', R({ global: { level: 1, message: { $gt: '' } } }, n1).message, '');
  eq('no access object -> 0', R({ global: E(4) }, null).level, 0);

  console.log('\n== usernames as single, inert path segments ==');
  eq('dot is escaped', LC.userKey('A.B'), 'a%2Eb');
  eq('dollar and percent escaped', LC.userKey('$x%y'), '%24x%25y');
  eq('round trip', LC.userFromKey(LC.userKey('a.b%2E$c')), 'a.b%2e$c');
  ok('a dotted username resolves through its encoded key', R({ users: { 'a%2Eb': E(3) } }, { username: 'a.b', role: 'User' }).level === 3);
  ok('safe paths accepted', ['global', 'roles', 'users', 'roles.User', 'users.a%2Eb'].every(LC.isSafePath));
  ok('unsafe paths refused', ['$set', 'users.$where', 'users.a.b', 'roles.', 'other', 'users..x', '', null].every((p) => !LC.isSafePath(p)));
  let threw = false; try { await LC.writeConfig({ 'users.a.b': E(2) }); } catch (e) { threw = true; }
  ok('writeConfig refuses a nested / unsafe path', threw);

  console.log('\n== input validation helpers ==');
  ok('validLevel: integers 0..4 only', [0, 1, 2, 3, 4].every(LC.validLevel) && [-1, 5, 2.5, '2', null, NaN, true].every((v) => !LC.validLevel(v)));
  eq('cleanMessage strips control characters, keeps line breaks', LC.cleanMessage(' a\u0000b\r\nc\u0007 '), 'ab\nc');
  eq('cleanMessage rejects > 500 characters', LC.cleanMessage('x'.repeat(501)), null);
  eq('cleanMessage rejects non-strings', LC.cleanMessage({ $gt: 1 }), null);

  console.log('\n== Clear all touches exactly the three scopes (Mongo-shaped store) ==');
  {
    let stored = { _id: 'config', global: E(3), roles: { User: E(2) }, users: { nurse1: E(4) }, notes: 'keep me', extra: { a: 1 } };
    const fakeHandle = { collection: () => ({
      findOne: async () => clone(stored),
      updateOne: async (q, upd) => {
        Object.entries(upd.$set || {}).forEach(([p, v]) => { const ks = p.split('.'); let at = stored; ks.slice(0, -1).forEach((k) => { at = at[k] = at[k] || {}; }); at[ks[ks.length - 1]] = clone(v); });
        Object.keys(upd.$unset || {}).forEach((p) => { const ks = p.split('.'); let at = stored; ks.slice(0, -1).forEach((k) => { at = at[k] || {}; }); delete at[ks[ks.length - 1]]; });
      },
    }) };
    const changes = cc.clearAllChanges('admin');
    eq('the update names only global, roles and users', Object.keys(changes).sort(), ['global', 'roles', 'users']);
    await LC.writeConfig(changes, null, fakeHandle);
    eq('unrelated fields survive', [stored.notes, stored.extra], ['keep me', { a: 1 }]);
    eq('scopes reset', [stored.global.level, stored.roles, stored.users], [0, {}, {}]);
    await LC.writeConfig({ 'users.a%2Eb': E(2) }, null, fakeHandle);
    ok('a dotted username is stored as ONE key, not a nested path', stored.users['a%2Eb'] && stored.users['a%2Eb'].level === 2 && !stored.users.a);
  }

  console.log('\n== limitDecision (shared by the /api gate and every named guard) ==');
  const L = (level) => ({ unrestricted: false, role: 'User', limit: { level, message: '' } });
  const D = (level, m, p) => access.limitDecision(L(level), m, p);
  ok('level 0 and 1 never refuse', [0, 1].every((l) => !D(l, 'POST', '/api/staff') && !D(l, 'GET', '/api/staff')));
  ok('level 2: reads allowed', !D(2, 'GET', '/api/staff') && !D(2, 'HEAD', '/api/staff') && !D(2, 'OPTIONS', '/api/staff'));
  ok('level 2: every write refused', ['POST', 'PUT', 'PATCH', 'DELETE'].every((m) => D(2, m, '/api/kpi/defs') && D(2, m, '/api/kpi/defs').error === VIEW_ONLY));
  eq('level 2: refusal body', D(2, 'POST', '/api/x'), { ok: false, code: 'limited', level: 2, error: VIEW_ONLY });
  eq('level 2 on a submission endpoint still says view-only', D(2, 'POST', '/api/submissions/patient').error, VIEW_ONLY);
  ok('level 2-3: a print record (POST …/print) is a read', !D(2, 'POST', '/api/kpi/print') && !D(3, 'POST', '/api/rosters/print'));
  eq('level 3: submission endpoint -> submission notice', D(3, 'POST', '/api/submissions/quality').error, PAUSED);
  eq('level 3: PUT /api/data -> submission notice', D(3, 'PUT', '/api/data').error, PAUSED);
  eq('level 3: share-link submit -> submission notice', D(3, 'POST', '/s/abc123/submit').error, PAUSED);
  eq('level 3: other write -> view-only notice', D(3, 'DELETE', '/api/rosters/1').error, VIEW_ONLY);
  ok('level 3: reads allowed', !D(3, 'GET', '/api/submissions'));
  eq('level 4: reads refused', D(4, 'GET', '/api/staff'), { ok: false, code: 'limited', level: 4, error: LOCKED });
  eq('level 4: submission endpoint keeps the submission notice', D(4, 'POST', '/api/submissions/patient').error, PAUSED);
  ok('level 4: print records refused', !!D(4, 'POST', '/api/kpi/print'));
  ok('level 4: identity, sign-in, sign-out, health stay reachable',
    !D(4, 'GET', '/api/me') && !D(4, 'POST', '/api/login') && !D(4, 'POST', '/api/logout') && !D(4, 'GET', '/api/health'));
  ok('level 4: PATCH /api/me (a write) is refused', !!D(4, 'PATCH', '/api/me'));
  ok('an unrestricted access object carrying a forged limit is never refused', !access.limitDecision({ unrestricted: true, limit: { level: 4 } }, 'POST', '/api/x'));
  ok('a malformed limit reads as 0', !access.limitDecision({ unrestricted: false, limit: { level: 'x' } }, 'POST', '/api/x'));

  /* ============================================================== over HTTP === */
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  BASE = 'http://127.0.0.1:' + server.address().port;
  try {
    await reset();
    console.log('\n== the Control Centre API is administrator-only ==');
    let r = await call('GET', '/api/control-centre', null);
    eq('no session -> 401', r.status, 401);
    for (const who of ['nurse1', 'collector1']) {
      r = await call('GET', '/api/control-centre', who);
      ok(who + ': GET -> 403, nothing disclosed', r.status === 403 && !/global|roles|users|level/i.test(r.text));
      r = await call('PUT', '/api/control-centre', who, { scope: 'user', target: who, level: 0 });
      eq(who + ': PUT (even to exempt itself) -> 403', r.status, 403);
      r = await call('PUT', '/api/control-centre', who, { scope: 'global', level: 0, role: 'Administrator', unrestricted: true });
      eq(who + ': PUT claiming to be an administrator in the body -> 403', r.status, 403);
      r = await call('POST', '/api/control-centre/clear', who, { confirm: true });
      eq(who + ': clear -> 403', r.status, 403);
      r = await call('GET', '/api/users/online', who);
      ok(who + ': online presence -> 403', r.status === 403 && !r.body.online);
      r = await call('GET', '/api/control-centre/ui.js', who);
      ok(who + ': the screen script -> 403', r.status === 403 && r.text.indexOf('unicoRegisterAdminView') < 0);
    }
    r = await call('GET', '/api/control-centre/ui.js', null);
    eq('screen script without a session -> 401', r.status, 401);
    r = await call('GET', '/api/users/online', null);
    eq('online presence without a session -> 401', r.status, 401);
    r = await call('GET', '/api/control-centre', 'admin');
    ok('admin: GET -> 200 with accounts, roles and levels', r.status === 200 && r.body.users.length === USERS.length && r.body.levels.length === 5 && r.body.roles.length >= 1);
    ok('admin: the Administrator account is marked always exempt', r.body.users.find((u) => u.username === 'admin').exempt === true);
    ok('admin: Administrator is not an editable role', !r.body.roles.some((x) => x.role === 'Administrator'));
    r = await call('GET', '/api/users/online', 'admin');
    ok('admin: online presence -> 200', r.status === 200 && Array.isArray(r.body.online));

    console.log('\n== PUT validation (scope, level, role, username, message, operators) ==');
    const bad = [
      [{ scope: 'everyone', level: 1 }, 'unknown scope'],
      [{ scope: 'global', level: 5 }, 'level 5'],
      [{ scope: 'global', level: -1 }, 'level -1'],
      [{ scope: 'global', level: '2' }, 'level as a string'],
      [{ scope: 'global', level: 2.5 }, 'fractional level'],
      [{ scope: 'global' }, 'missing level'],
      [{ scope: 'global', level: 1, message: 'x'.repeat(501) }, 'message over 500 characters'],
      [{ scope: 'global', level: 1, message: { $gt: '' } }, 'message that is an object'],
      [{ scope: 'global', level: 1, target: 'x' }, 'global with a target'],
      [{ scope: 'global', remove: true }, 'removing global'],
      [{ scope: 'global', level: 1, $set: { 'users.admin': { level: 4 } } }, 'smuggled $set'],
      [{ scope: 'global', level: 1, path: 'users.admin' }, 'smuggled path'],
      [{ scope: 'role', target: 'Administrator', level: 2 }, 'Administrator role'],
      [{ scope: 'role', target: 'Wizard', level: 2 }, 'unknown role'],
      [{ scope: 'role', target: '$where', level: 2 }, 'operator as role'],
      [{ scope: 'role', target: { $ne: null }, level: 2 }, 'object as role'],
      [{ scope: 'user', target: 'admin', level: 2 }, 'restricting an Administrator account'],
      [{ scope: 'user', target: 'admin', level: 0 }, 'an own entry for an Administrator account'],
      [{ scope: 'user', target: { $ne: null }, level: 2 }, 'object as username'],
      [{ scope: 'user', target: '$where', level: 2 }, 'operator as username'],
      [{ scope: 'user', target: 'users.nurse1', level: 2 }, 'dotted path as username (no such account)'],
      [{ scope: 'user', target: 'ghost', level: 2 }, 'unknown account'],
      [{ scope: 'user', target: 'nurse1', remove: true, level: 2 }, 'remove with a level'],
      [[{ scope: 'global', level: 4 }], 'array body'],
    ];
    for (const [body, label] of bad) {
      r = await call('PUT', '/api/control-centre', 'admin', body);
      ok('rejected: ' + label + ' (' + r.status + ')', r.status >= 400 && r.status < 500 && r.body.ok === false);
    }
    let cfgNow = await LC.readConfig();
    ok('none of the rejected requests changed the configuration', !cfgNow || ((!cfgNow.global || cfgNow.global.level === 0) && !Object.keys(cfgNow.users || {}).length && !Object.keys(cfgNow.roles || {}).length));

    console.log('\n== an administrator sets and the server enforces ==');
    LOGS.length = 0;
    r = await call('PUT', '/api/control-centre', 'admin', { scope: 'user', target: 'nurse1', level: 2, message: 'Audit <b>in</b> progress' });
    ok('admin PUT user nurse1 level 2 -> 200', r.status === 200 && r.body.users.find((u) => u.username === 'nurse1').effective.level === 2);
    ok('activity logged: action, target, old -> new, no message text',
      LOGS.length === 1 && LOGS[0].action === 'limit_control' && LOGS[0].by === 'admin' && /nurse1/.test(LOGS[0].target)
      && /not set -> Read-only \(2\)/.test(LOGS[0].detail) && LOGS[0].detail.indexOf('Audit') < 0);
    cfgNow = await LC.readConfig();
    ok('stored with the server-side actor and time', cfgNow.users.nurse1.by === 'admin' && Number(cfgNow.users.nurse1.at) > 0);
    eq('message stored as plain text (escaped only when shown)', cfgNow.users.nurse1.message, 'Audit <b>in</b> progress');
    access.invalidate();

    r = await call('GET', '/api/me', 'nurse1');
    eq('/api/me: only this person\'s own level + message', r.body.limit, { level: 2, message: 'Audit <b>in</b> progress' });
    ok('/api/me: no configuration, other accounts, actor or rule details', !/"global"|"roles"|"users"|"by"|"source"|nurse2|collector1/.test(r.text));
    r = await call('GET', '/api/me?lite=1', 'nurse1');
    ok('/api/me?lite=1 carries the same limit', r.status === 200 && r.body.limit && r.body.limit.level === 2 && Object.keys(r.body.limit).sort().join() === 'level,message');
    r = await call('GET', '/api/me', 'nurse2');
    ok('/api/me for an unaffected account has no limit', r.status === 200 && r.body.limit === undefined);
    r = await call('GET', '/api/me', 'admin');
    ok('/api/me for an administrator has no limit', r.status === 200 && r.body.limit === undefined);

    console.log('\n== level 2 (read-only) for nurse1 ==');
    r = await call('GET', '/api/probe/self', 'nurse1'); eq('self-guarded GET allowed', r.status, 200);
    r = await call('GET', '/api/probe/perm', 'nurse1'); eq('requirePerm GET allowed', r.status, 200);
    r = await call('POST', '/api/probe/self', 'nurse1', {});
    eq('self-guarded POST refused by the /api gate', [r.status, r.body], [403, { ok: false, code: 'limited', level: 2, error: VIEW_ONLY }]);
    r = await call('POST', '/api/probe/perm', 'nurse1', {}); ok('requirePerm write refused', r.status === 403 && r.body.code === 'limited');
    r = await call('POST', '/api/probe/module', 'nurse1', {}); ok('requireModule write refused (module grant does not bypass it)', r.status === 403 && r.body.code === 'limited');
    r = await call('POST', '/api/probe/attach', 'nurse1', {}); ok('attach write refused', r.status === 403 && r.body.code === 'limited');
    r = await call('PUT', '/api/data', 'nurse1', { data: { unico_staff_v3: '[]' }, partial: true });
    ok('PUT /api/data refused', r.status === 403 && r.body.code === 'limited' && r.body.error === VIEW_ONLY);
    r = await call('POST', '/api/submissions/patient', 'nurse1', { department: 'icu' });
    ok('submission refused (view-only wording at level 2)', r.status === 403 && r.body.error === VIEW_ONLY);
    r = await call('POST', '/api/kpi/print', 'nurse1', {}); eq('a print record still goes through', r.status, 200);
    r = await call('POST', '/api/probe/self', 'nurse2', {}); eq('nurse2 (no restriction) still writes', r.status, 200);

    console.log('\n== level 3 (submissions paused) ==');
    await call('PUT', '/api/control-centre', 'admin', { scope: 'user', target: 'nurse1', level: 3 }); access.invalidate();
    r = await call('POST', '/api/submissions/patient', 'nurse1', { department: 'icu' });
    eq('POST /api/submissions/patient', [r.status, r.body.code, r.body.level, r.body.error], [403, 'limited', 3, PAUSED]);
    r = await call('POST', '/api/submissions/quality', 'nurse1', { area: 'x' }); eq('POST /api/submissions/quality', [r.status, r.body.error], [403, PAUSED]);
    r = await call('PUT', '/api/data', 'nurse1', { data: {}, partial: true }); eq('PUT /api/data', [r.status, r.body.error], [403, PAUSED]);
    r = await call('POST', '/api/probe/self', 'nurse1', {}); eq('other writes: view-only wording', [r.status, r.body.error], [403, VIEW_ONLY]);
    r = await call('GET', '/api/probe/self', 'nurse1'); eq('reads allowed', r.status, 200);
    let e1 = null; try { await dataCollection.createSubmission({ type: 'patient', department: 'icu', month: '2026-11' }, { submittedByUser: 'nurse1' }); } catch (e) { e1 = e; }
    ok('createSubmission refuses a paused sender (every submission path ends here)', e1 && e1.code === 'limited' && e1.status === 403 && e1.message === PAUSED);
    let e2 = null; try { await dataCollection.createSubmission({ type: 'patient', department: 'icu', month: '2026-11' }, { responsible: { id: 'resp-1', name: 'Nurse One' }, source: 'shortlink' }); } catch (e) { e2 = e; }
    ok('a share link whose responsible person is linked to a paused account is refused', e2 && e2.code === 'limited');
    let e3 = null; try { await dataCollection.createSubmission({ type: 'patient', department: 'icu', month: '2026-11' }, { submittedByUser: 'admin' }); } catch (e) { e3 = e; }
    ok('an administrator\'s submission is never refused by a limit', !e3 || e3.code !== 'limited');

    console.log('\n== level 4 (workspace unavailable) ==');
    await call('PUT', '/api/control-centre', 'admin', { scope: 'user', target: 'nurse1', level: 4, message: 'See the nursing office.' }); access.invalidate();
    r = await call('GET', '/api/probe/self', 'nurse1'); eq('reads refused', [r.status, r.body.error], [403, LOCKED]);
    r = await call('GET', '/api/probe/perm', 'nurse1'); eq('requirePerm read refused', r.status, 403);
    r = await call('GET', '/api/data', 'nurse1'); eq('GET /api/data refused', r.status, 403);
    r = await call('GET', '/api/me', 'nurse1'); ok('/api/me still answers, with the notice', r.status === 200 && r.body.limit.level === 4 && r.body.limit.message === 'See the nursing office.');
    r = await call('POST', '/api/login', 'nurse1', { username: 'nurse1', password: 'wrong' }); ok('sign-in endpoint reachable (not limited)', r.body.code !== 'limited');
    r = await call('GET', '/api/health', 'nurse1'); ok('health reachable', r.body.code !== 'limited');
    r = await call('POST', '/api/submissions/quality', 'nurse1', {}); eq('submission endpoint keeps the submission notice', [r.status, r.body.error], [403, PAUSED]);
    r = await call('POST', '/api/kpi/print', 'nurse1', {}); eq('print records refused', r.status, 403);
    r = await call('GET', '/api/control-centre', 'nurse1'); eq('Control Centre still 403', r.status, 403);

    console.log('\n== role + global, explicit exemption, administrators ==');
    await call('PUT', '/api/control-centre', 'admin', { scope: 'user', target: 'nurse1', remove: true });
    await call('PUT', '/api/control-centre', 'admin', { scope: 'global', level: 3, message: 'Month-end audit' });
    await call('PUT', '/api/control-centre', 'admin', { scope: 'role', target: 'collector', level: 4 });
    r = await call('PUT', '/api/control-centre', 'admin', { scope: 'user', target: 'nurse2', level: 0 }); access.invalidate();
    const st = r.body;
    eq('state: nurse1 inherits global 3', [st.users.find((u) => u.username === 'nurse1').effective.level, st.users.find((u) => u.username === 'nurse1').effective.source], [3, 'global']);
    eq('state: collector1 gets the stricter role level', st.users.find((u) => u.username === 'collector1').effective.level, 4);
    eq('state: nurse2 explicitly exempt', [st.users.find((u) => u.username === 'nurse2').effective.level, st.users.find((u) => u.username === 'nurse2').effective.source], [0, 'user']);
    r = await call('POST', '/api/probe/self', 'nurse1', {}); eq('nurse1 refused by the everyone level', r.status, 403);
    r = await call('POST', '/api/probe/self', 'nurse2', {}); eq('nurse2 (own level 0) writes despite everyone = 3', r.status, 200);
    r = await call('GET', '/api/probe/self', 'collector1'); eq('collector1 (role 4) refused even for reads', r.status, 403);
    await setCfg({ 'users.admin': { level: 4, message: 'x' }, 'roles.Administrator': { level: 4 } });
    r = await call('POST', '/api/probe/self', 'admin', {}); eq('admin writes under global 3 + a stored admin entry 4 + an Administrator role entry', r.status, 200);
    r = await call('GET', '/api/me', 'admin'); ok('admin /api/me shows no limit', r.body.limit === undefined);
    await setCfg({ 'users.nurse1': { level: 'garbage' } });
    r = await call('POST', '/api/probe/self', 'nurse1', {}); ok('a malformed own entry is ignored (the everyone level still applies)', r.status === 403);
    await setCfg({}, { 'users.nurse1': '' });
    r = await call('PUT', '/api/control-centre', 'admin', { scope: 'user', target: 'a.b', level: 2 }); access.invalidate();
    ok('a dotted username can be restricted', r.status === 200 && r.body.users.find((u) => u.username === 'a.b').effective.level === 2);
    r = await call('POST', '/api/probe/self', 'a.b', {}); eq('…and is enforced', r.status, 403);

    console.log('\n== Clear all ==');
    r = await call('POST', '/api/control-centre/clear', 'admin', {});
    eq('clear without confirm -> 400', r.status, 400);
    r = await call('POST', '/api/control-centre/clear', 'admin', { confirm: true, $set: {} });
    eq('clear with extra fields -> 400', r.status, 400);
    LOGS.length = 0;
    r = await call('POST', '/api/control-centre/clear', 'admin', { confirm: true }); access.invalidate();
    ok('clear -> 200, every account back to 0', r.status === 200 && r.body.users.every((u) => u.effective.level === 0) && r.body.global.level === 0);
    cfgNow = await LC.readConfig();
    ok('roles and users emptied (no explicit exemptions left behind)', !Object.keys(cfgNow.roles).length && !Object.keys(cfgNow.users).length);
    ok('clear logged once', LOGS.length === 1 && LOGS[0].action === 'limit_control' && /cleared/.test(LOGS[0].detail));
    for (const who of ['nurse1', 'collector1', 'a.b']) { r = await call('POST', '/api/probe/self', who, {}); eq(who + ' writes again', r.status, 200); }

    console.log('\n== fail open: an unreadable setting never invents a restriction ==');
    await setCfg({ global: E(4) });
    const realHandle = db.getDbHandle;
    db.getDbHandle = async () => { throw new Error('cluster unreachable'); };
    LC.invalidate();
    eq('read failure -> level 0', await LC.limitFor({ username: 'nurse1', role: 'User' }), { level: 0, message: '' });
    db.getDbHandle = () => new Promise(() => {});   // hangs forever
    LC.invalidate();
    const t0 = Date.now();
    eq('hanging read -> level 0 after the timeout', await LC.limitFor({ username: 'nurse1', role: 'User' }), { level: 0, message: '' });
    ok('…and quickly (' + (Date.now() - t0) + ' ms)', Date.now() - t0 < 3000);
    db.getDbHandle = realHandle;
    LC.invalidate();
    eq('degraded access object -> level 0 without a lookup', await LC.limitFor({ degraded: true, username: 'nurse1', role: 'User' }), { level: 0, message: '' });
    eq('readable again -> level 4 back', (await LC.limitFor({ username: 'nurse1', role: 'User' })).level, 4);
    await reset();
  } finally {
    server.close();
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
