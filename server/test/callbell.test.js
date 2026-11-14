/* Call bell: the nurse-call PDF text → rows → monthly figures → the quality indicator (KPI 3B). */
const assert = require('assert');
const fake = (rel, exports) => { const p = require.resolve(rel); require.cache[p] = { id: p, filename: p, loaded: true, exports }; };
fake('../db', { getDbHandle: async () => null, getQuality: async () => [] });
fake('../deptmap', { get: async () => ({ byId: {} }), HOSPITAL: '__hospital__' });
const logged = [];
fake('../activity-log', { log: (req, action, o) => logged.push({ action, o }) });

const CB = require('../../renderer/unico/callbell-core.js');
const cb = require('../callbell');

// The report text as pdf-parse gives it (cells joined, one row per line).
const page = (wing, lines) => ['', 'UNICO', wing, 'NURSE CALL STATUS REPORT', 'RoomNurse CallPull ChordCareCode BlueClear TimeAttend TATClear TAT'].concat(lines, ['Page 1/1']).join('\n');
const A1 = page('9th Floor A', [
  '9062026-10-09 08:55:42----2026-10-09 08:56:16----2026-10-09 08:56:160:34Min0:0 Min',          // call 34 s
  '9022026-10-09 08:05:35----2026-10-09 08:08:05----2026-10-09 08:08:052:30Min0:0 Min',          // call 2.5 min
  '9062026-10-10 14:22:182026-10-10 13:28:192026-10-10 14:22:33----2026-10-10 14:22:3354:14Min0:0 Min', // pull cord
  '902----2026-10-10 15:27:012026-10-11 11:17:07----2026-10-11 11:17:1150:6Min0:4 Min',            // pull, no nurse call
  '9022026-10-11 12:09:09----2026-10-11 12:21:162026-10-11 12:21:202026-10-11 12:21:2812:7Min0:12 Min', // code blue
  '1113 2026-10-12 00:51:28 2024-12-31 11:18:21 2026-10-12 00:51:46 ---- 2026-10-12 00:51:46 33:25Min 0:0 Min', // stale pull, spaced
  '09ISORM2026-11-01 13:46:54----2026-11-01 13:47:39----2026-11-01 13:47:390:45Min0:0 Min',      // November
]);
const B1 = page('9th Floor B', ['910A2026-10-09 21:15:31----2026-10-09 21:15:47----2026-10-09 21:15:470:16Min0:0 Min']);
const L11 = page('11th Floor A', ['11072026-10-20 10:00:00----2026-10-20 10:01:00----2026-10-20 10:01:001:0Min0:0 Min']);

(async () => {
  /* ---- parser ---- */
  const p = CB.parseText(A1);
  assert.equal(p.wing, '9th Floor A'); assert.equal(p.floor, 9);
  assert.equal(p.rows.length, 7); assert.deepEqual(p.unparsed, []);
  assert.deepEqual(p.rows.map((r) => r.kind), ['call', 'call', 'pull', 'pull', 'blue', 'pull', 'call']);
  assert.equal(p.rows[0].room, '906'); assert.equal(p.rows[0].attendSec, 34); assert.equal(p.rows[1].attendSec, 150);
  assert.equal(p.rows[6].room, '09ISORM', 'letters in a room id');
  assert.equal(p.rows[3].call, null); assert.equal(p.rows[3].first, '2026-10-10 15:27:01', 'no nurse call: the pull time');
  assert.equal(p.rows[5].first, '2026-10-12 00:51:28', 'a stale pull-cord time (2024) never dates the alarm');
  assert.equal(CB.monthOf(p.rows[5]), '2026-10');
  assert.equal(CB.parseText(page('9th Floor A', ['this is not a row'])).unparsed.length, 1, 'an unreadable line is reported');
  assert.equal(CB.qualityMonth('2026-10'), 'Oct-26');

  /* ---- summary: nurse calls only ---- */
  const oct = p.rows.filter((r) => CB.monthOf(r) === '2026-10');
  const s = CB.summarize(oct, { target: 2 });
  assert.equal(s.calls, 2, 'pull cord and Code Blue are not nurse calls');
  assert.equal(s.sumMin, 3.07); assert.equal(s.avg, 1.53); assert.equal(s.withinPct, 50); assert.equal(s.longest, 2.5);
  assert.equal(s.pull.count, 3); assert.equal(s.blue.count, 1); assert.equal(s.days, 4);
  assert.ok(/2 nurse calls, data on 4 of 31 days/.test(CB.remarkOf(s, '2026-10')) && /pull-cord alarms 3 \(not counted\)/.test(CB.remarkOf(s, '2026-10')));

  /* ---- server: upload → store (no double counting) → quality ---- */
  const applied = [];
  const quality = { 'Level 9': true, 'Overall Hospital': true, 'Level 11': false };
  const routes = {};
  const reg = (m) => (path, g, h) => { routes[m + ' ' + path] = h; };
  let tick = 1000;
  cb.mount({ get: reg('GET'), post: reg('POST'), put: reg('PUT'), delete: reg('DELETE') }, { requireApi: [], now: () => tick++, deps: {
    depts: async () => [{ id: 'lvl9', name: 'IPD Cabin Level 9', qualityKey: 'Level 9' }, { id: 'lvl10', name: 'IPD Cabin Level 10', qualityKey: 'Level 10' }, { id: 'cust_x', name: 'IPD Cabin 11', qualityKey: 'Level 11' }, { id: 'er', name: 'Emergency Room', qualityKey: 'ER' }],
    apply: async (spec) => { applied.push(spec); quality[spec.area] = true; },
    hasIndicator: async (area) => !!quality[area],
    parsePdf: async (buf) => buf.slice(5).toString(),
  } });
  const admin = { unrestricted: true, username: 'admin', name: 'Admin', perms: null };
  const viewer = { unrestricted: false, username: 'v', perms: { kpi: ['view'] } };
  async function call(route, a, { params = {}, query = {}, body = {} } = {}) {
    const out = { status: 200, body: null };
    const res = { status(c) { out.status = c; return res; }, json(b) { out.body = b; return res; }, set() { return res; } };
    await routes[route]({ access: a, params, query, body, user: {} }, res);
    return out;
  }
  const pdf = (txt) => Buffer.concat([Buffer.from('%PDF-'), Buffer.from(txt)]).toString('base64');

  let res = await call('POST /api/callbell/upload', viewer, { body: { name: 'a.pdf', data: pdf(A1) } });
  assert.equal(res.status, 403, 'uploading needs the Nursing KPI Add right');
  res = await call('POST /api/callbell/upload', admin, { body: { name: 'x.pdf', data: Buffer.from('hello').toString('base64') } });
  assert.equal(res.status, 400, 'not a PDF');
  res = await call('POST /api/callbell/upload', admin, { body: { name: 'odd.pdf', data: pdf(page('9th Floor A', ['x', 'y', 'z', 'w'])) } });
  assert.equal(res.status, 400, 'no calls / changed layout is refused, not half-read');

  res = await call('POST /api/callbell/upload', admin, { body: { name: 'L9-nS.pdf', data: pdf(A1) } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.upload.wing, '9th Floor A'); assert.equal(res.body.upload.added, 7); assert.deepEqual(res.body.upload.months, ['2026-10', '2026-11']);
  const oct9 = applied.filter((x) => x.area === 'Level 9' && x.month === 'Oct-26');
  assert.equal(oct9.length, 1); assert.equal(oct9[0].num, 3.07); assert.equal(oct9[0].den, 2); assert.equal(oct9[0].entryMode, 'rate'); assert.equal(oct9[0].mult, 1);
  assert.equal(oct9[0].indicatorId, 'ind-call-bell-response'); assert.equal(oct9[0].formula, undefined, 'an existing indicator keeps its own definition');
  assert.ok(applied.some((x) => x.area === 'Overall Hospital' && x.month === 'Oct-26' && x.den === 2));

  // the same export again: nothing new, nothing re-sent
  const n = applied.length;
  res = await call('POST /api/callbell/upload', admin, { body: { name: 'L9-nS (again).pdf', data: pdf(A1) } });
  assert.equal(res.body.upload.added, 0); assert.equal(res.body.upload.already, 7);
  assert.equal(applied.length, n, 'unchanged figures are not written again');

  // wing B joins Level 9; Overall pools Σ minutes ÷ Σ calls
  await call('POST /api/callbell/upload', admin, { body: { name: 'L9-nS-B.pdf', data: pdf(B1) } });
  const last = (area, m) => applied.filter((x) => x.area === area && x.month === m).pop();
  assert.equal(last('Level 9', 'Oct-26').den, 3); assert.equal(last('Level 9', 'Oct-26').num, 3.33);
  res = await call('POST /api/callbell/upload', admin, { body: { name: 'L11-nS.pdf', data: pdf(L11) } });
  const l11 = last('Level 11', 'Oct-26');
  assert.equal(l11.den, 1); assert.equal(l11.formula, 'avg', 'Level 11 gets the indicator with the KPI definition');
  assert.equal(last('Overall Hospital', 'Oct-26').den, 4); assert.equal(last('Overall Hospital', 'Oct-26').num, 4.33);

  res = await call('GET /api/callbell/summary', viewer, { query: { month: '2026-10' } });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.units.map((u) => u.deptId + ':' + u.calls), ['cust_x:1', 'lvl9:3'], 'sorted by unit name');
  assert.deepEqual(res.body.units[1].wings, ['9th Floor A', '9th Floor B']);
  assert.equal(res.body.hospital.calls, 4); assert.equal(res.body.daysInMonth, 31);
  assert.ok(res.body.units[1].sent && res.body.units[1].sent.calls === 3, 'what was sent is shown');
  res = await call('GET /api/callbell/calls', viewer, { query: { month: '2026-10', kind: 'pull' } });
  assert.equal(res.body.total, 3);

  // removing the 11th-floor upload clears its month (marked not observed), the pool follows
  const meta = await call('GET /api/callbell/meta', admin);
  assert.deepEqual(meta.body.wings.map((w) => w.wing + '=' + w.deptId), ['9th Floor A=lvl9', '9th Floor B=lvl9', '11th Floor A=cust_x']);
  const up11 = meta.body.uploads.find((u) => u.wing === '11th Floor A');
  assert.equal((await call('DELETE /api/callbell/uploads/:id', viewer, { params: { id: up11.id } })).status, 403);
  await call('DELETE /api/callbell/uploads/:id', admin, { params: { id: up11.id } });
  assert.equal(last('Level 11', 'Oct-26').notObserved, true);
  assert.equal(last('Overall Hospital', 'Oct-26').den, 3);
  // removing ONE of two uploads that carry the same alarms keeps them counted
  const ups9a = meta.body.uploads.filter((u) => u.wing === '9th Floor A');
  await call('DELETE /api/callbell/uploads/:id', admin, { params: { id: ups9a[0].id } });
  res = await call('GET /api/callbell/summary', viewer, { query: { month: '2026-10' } });
  assert.equal(res.body.units[0].calls, 3, 'still carried by the other upload');

  // an administrator maps a wing elsewhere: figures are sent again under the new unit
  res = await call('PUT /api/callbell/config', admin, { body: { wings: { '9th Floor B': 'lvl10' }, target: 2 } });
  assert.equal(res.status, 200);
  assert.equal(last('Level 10', 'Oct-26').den, 1); assert.equal(last('Level 9', 'Oct-26').den, 2);
  assert.equal((await call('PUT /api/callbell/config', viewer, { body: { target: 3 } })).status, 403);
  assert.ok(logged.some((l) => l.action === 'callbell_upload'));

  // the KPI 3B entry box: upload without sending, then Save sends the touched months
  const before = applied.length;
  const T10 = page('10th Floor A', ['10012026-12-03 10:00:00----2026-12-03 10:00:30----2026-12-03 10:00:300:30Min0:0 Min', '10022026-12-04 11:00:00----2026-12-04 11:01:30----2026-12-04 11:01:301:30Min0:0 Min']);
  res = await call('POST /api/callbell/upload', admin, { body: { name: 'L10-dec.pdf', data: pdf(T10), send: false } });
  assert.equal(res.status, 200); assert.deepEqual(res.body.sent, []); assert.equal(applied.length, before, 'send:false writes nothing to quality');
  res = await call('GET /api/callbell/summary', viewer, { query: { month: '2026-12' } });
  assert.equal(res.body.hospital.calls, 2); assert.equal(res.body.hospital.sumMin, 2); assert.equal(res.body.hospital.sent, null, 'not sent yet');
  assert.equal((await call('POST /api/callbell/send', viewer, { body: { months: ['2026-12'] } })).status, 403, 'sending needs Add or Edit');
  assert.equal((await call('POST /api/callbell/send', admin, { body: { months: ['bogus'] } })).status, 400);
  res = await call('POST /api/callbell/send', admin, { body: { months: ['2026-12'] } });
  assert.equal(res.status, 200);
  assert.equal(last('Overall Hospital', 'Dec-26').den, 2); assert.equal(last('Level 10', 'Dec-26').num, 2);
  res = await call('GET /api/callbell/summary', viewer, { query: { month: '2026-12' } });
  assert.ok(res.body.hospital.sent && res.body.hospital.sent.calls === 2);

  console.log('callbell: all assertions passed');
})().catch((e) => { console.error(e); process.exit(1); });
