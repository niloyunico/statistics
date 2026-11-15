/* H360 staff lookup + verification (Staff Management → H360 Check).
 *
 * Reads H360's employee list through the one thing a person may do on its Employee
 * Roster page without changing anything: type into the Employee Search box. The page is
 * opened for its form token; the box's own query (views.EMPLOYEE_SEARCH_PATH) is the only
 * other address used. No H360 button is ever pressed, and nothing on H360 is written.
 *
 * Our register is never changed here either. Every answer is a comparison
 * (staff-match.js); a Staff editor copies one H360 value at a time in the browser,
 * through the normal staff save.
 *
 *   - live lookup by emp ID / name / phone                 GET  /api/h360-staff/search?q=
 *   - one record                                           GET  /api/h360-staff/verify/:id
 *   - all active records, in short steps (Vercel 60 s)     POST /api/h360-staff/verify-bulk[/step]
 *   - Nursing Services people missing from our register    POST /api/h360-staff/sweep[/step], GET /missing
 *   - directory badges                                     GET  /api/h360-staff/status
 *   - Excel                                                GET  /api/h360-staff/export.xlsx
 *   - daily re-check, OFF unless turned on                 GET  /api/h360-staff/cron (Vercel cron), POST /options
 *
 * Signs in with the H360 login an administrator saved for the H360 link (settings.js);
 * the sign-in cookies are kept sealed so a lookup does not sign in every time.
 * What H360 says about Nursing Services people (and anyone matching our register) is kept
 * in `h360Employees`, one document per H360 employee code, so the finder and the badges
 * work without asking H360 again. Other hospital staff are not stored.
 */
const express = require('express');
const settings = require('./settings');
const match = require('./staff-match');
const census = require('./staff-census');

const COLL = 'h360Employees';
const baseUrl = () => (process.env.HIS_BASE_URL || 'https://his.unicohospitals.com').replace(/\/+$/, '');
const CONCURRENCY = 4;            // H360 searches at the same time
const SEARCH_CACHE_MS = 60 * 1000;
const SPLIT_AT = 50;              // a sweep prefix answering this many people is searched again in tenths

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
const dhakaDay = (d = new Date()) => new Date(d.getTime() + 6 * 3600 * 1000).toISOString().slice(0, 10);
// The census sweep is gentle on H360 (the hospital's live system): 2 searches at a time, a pause between.
const SWEEP_CONCURRENCY = 2;
const SWEEP_SHORT = 0.9;          // a sweep meeting fewer than this share of the people known before marks nobody gone
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const activeOf = (rows) => (rows || []).filter((r) => r && r.is_active !== false && !r.former);
const slim = (res) => ({ ...res, at: res.at || new Date().toISOString() });

// Run fn over items, CONCURRENCY at a time, until the list or the time runs out. Returns how many were taken.
async function pool(items, until, fn, stop = () => false, n = CONCURRENCY, pause = 0) {
  let next = 0;
  let begun = false;
  const worker = async () => {
    while (next < items.length && (!begun || Date.now() < until) && !stop()) {
      begun = true;
      const item = items[next++];
      await fn(item);
      if (pause) await sleep(pause);
    }
  };
  await Promise.all(Array.from({ length: n }, worker));
  return next;
}

function createStaffService(deps = {}) {
  const sharedDb = deps.sharedDb || (() => require('../db').getDbHandle());
  const openSession = deps.openSession || ((cfg, cookies, resume) => require('./session-http').open(cfg, { cookies, resume: resume || undefined }));
  const loadRegister = deps.loadRegister || (() => require('../staff-roster').loadRoster({ cached: true }));
  const STEP_MS = deps.stepMs || Number(process.env.H360_STAFF_STEP_MS) || 20000;
  const PAUSE_MS = deps.pauseMs != null ? deps.pauseMs : (Number(process.env.H360_SWEEP_PAUSE_MS) || 150);
  const cache = new Map();
  let live = null;

  async function db() {
    const d = await sharedDb();
    if (!d) throw fail(503, 'The database is not connected.');
    return d;
  }

  async function cfgOf(d) {
    const login = await settings.login(d);
    if (!login.user || !login.pass) {
      throw fail(409, login.elsewhere
        ? 'The H360 login was saved on another server and cannot be opened here. An administrator saves it again in Supervisor Reports → H360 Scan.'
        : 'No H360 login is saved yet. An administrator saves it once in Supervisor Reports → H360 Scan.');
    }
    return { baseUrl: baseUrl(), pageUrl: baseUrl() + '/roster/employee-roster', user: login.user, pass: login.pass };
  }

  /* ---------- ONE H360 sign-in for the whole app ----------
     Signed in once; every later search — any user, any server process — reuses it until H360
     ends it. The session (cookies + the search box's token and hidden values) is kept sealed in
     h360Settings 'staffSession', so a new Vercel process resumes WITHOUT asking H360 anything.
     When H360 has ended it ("signed us out" / 419 / 401) the search signs in again ONCE and is
     repeated; a second failure is reported, never looped. Concurrent searches share one opening. */
  let opening = null;
  let lastSave = 0;
  let lastSignInAt = 0;
  const SAFETY_MS = 12 * 3600 * 1000;   // reopen a session this old even if H360 still accepts it

  async function readKept(d) {
    try {
      const k = await settings.read(d, 'staffSession');
      if (!k || !k.cookies) return null;
      return { cookies: JSON.parse(settings.unseal(k.cookies)), token: k.token ? settings.unseal(k.token) : '', form: k.form || null, doc: k };
    } catch (err) { return null; }
  }
  async function keep(d, s, signedIn) {
    const st = s.session.state ? s.session.state() : { cookies: s.session.cookies(), token: '', form: null };
    const set = { cookies: settings.seal(JSON.stringify(st.cookies || [])), lastUsedAt: new Date() };
    if (st.token) set.token = settings.seal(st.token);
    if (st.form) set.form = st.form;
    if (signedIn) {
      const doc = (await settings.read(d, 'staffSession')) || {};
      set.signedInAt = new Date();
      set.signIns = (Array.isArray(doc.signIns) ? doc.signIns : []).concat([new Date()]).slice(-20);
    }
    await settings.write(d, 'staffSession', set);
  }

  // The live session. `after`: a search failed with "signed out" at this time — a session opened
  // after it (by another search) is good; otherwise sign in afresh.
  async function session(d, after) {
    if (live && (!after ? Date.now() - live.at < SAFETY_MS : live.at > after)) return live;
    if (opening) return opening;
    opening = (async () => {
      const cfg = await cfgOf(d);
      let opened = null;
      if (!after) {
        const kept = await readKept(d);
        if (kept && kept.token && kept.form) opened = await openSession(cfg, kept.cookies, { token: kept.token, form: kept.form });
        else if (kept) opened = await openSession(cfg, kept.cookies, null);   // older copy: H360 is asked once
      }
      if (!opened) opened = await openSession(cfg, null, null);
      const signedIn = opened.signedInNow ? opened.signedInNow() : !after;
      if (signedIn) lastSignInAt = Date.now();
      live = { session: opened, at: Date.now(), used: 0, signedIn, kept: false };
      return live;
    })().finally(() => { opening = null; });
    return opening;
  }

  // H360's people for one search, from a 60-second memory when the same text was just asked.
  // fresh: a sweep always asks H360 (a minute-old answer could hide a new person or a leaver).
  async function search(d, term, fresh) {
    const text = String(term || '').trim();
    if (text.length < 3) return [];
    const key = text.toLowerCase();
    const hit = cache.get(key);
    if (!fresh && hit && Date.now() - hit.at < SEARCH_CACHE_MS) return hit.rows;
    let rows;
    let failedAt = 0;
    for (let attempt = 0; ; attempt++) {
      const s = await session(d, failedAt || 0);
      const started = Date.now();
      try {
        s.used++;
        rows = await s.session.employees(text);
        if (s.used === 1 && s.session.searchFormInfo) {
          settings.write(d, 'staffDiagnostics', { form: s.session.searchFormInfo(), notes: s.session.notes || {}, at: new Date() }).catch(() => {});
        }
        // Keep the newest cookies for every other process: at once after a sign-in, then once a minute.
        if (!s.kept || Date.now() - lastSave > 60000) {
          lastSave = Date.now();
          const first = !s.kept;
          s.kept = true;
          // The first save (right after opening) is waited for, so another process never misses it.
          if (first) await keep(d, s, s.signedIn).catch(() => {});
          else keep(d, s, false).catch(() => {});
        }
        break;
      } catch (err) {
        if (live === s) live = null;
        if (attempt === 0 && /signed us out|token expired|status 419|status 401/i.test(err.message)) {
          // H360 ended the session: forget it and sign in once more, then repeat this search.
          failedAt = started;
          await settings.write(d, 'staffSession', {}, { cookies: '', token: '' }).catch(() => {});
          continue;
        }
        throw fail(502, 'H360: ' + err.message);
      }
    }
    cache.set(key, { at: Date.now(), rows });
    if (cache.size > 2000) cache.delete(cache.keys().next().value);
    return rows;
  }

  // Did this process sign in to H360 since `t`? (shown as "Signed in to H360")
  const signedInSince = (t) => lastSignInAt >= t;
  async function sessionInfo() {
    const d = await db();
    const k = (await settings.read(d, 'staffSession')) || {};
    const today = dhakaDay();
    return {
      active: Boolean(k.cookies), signedInAt: k.signedInAt || null, lastUsedAt: k.lastUsedAt || null,
      signInsToday: (k.signIns || []).filter((t) => dhakaDay(new Date(t)) === today).length,
    };
  }
  async function signOut() {
    const d = await db();
    live = null;
    cache.clear();
    await settings.write(d, 'staffSession', {}, { cookies: '', token: '' });
    return sessionInfo();
  }

  // Keep what H360 said about Nursing Services people and anyone our register names.
  async function remember(d, rows, keepCodes, sweepId) {
    const now = new Date();
    const ops = [];
    const seen = new Set();
    for (const r of rows || []) {
      if (!r || seen.has(r.code) || !(match.isNursing(r) || (keepCodes && keepCodes.has(r.code)))) continue;
      seen.add(r.code);
      const set = { ...r, lastSeenAt: now, nursing: match.isNursing(r) };
      if (sweepId) set.sweepId = sweepId;
      ops.push({ updateOne: { filter: { _id: r.code }, update: { $set: set, $setOnInsert: { firstSeenAt: now }, $unset: { goneSince: '' } }, upsert: true } });
    }
    if (ops.length) await d.collection(COLL).bulkWrite(ops, { ordered: false });
  }

  const codesOf = (register) => new Set((register || []).map((r) => String(r.emp_id || '').trim()).filter(Boolean));

  // One of our records against H360: by its emp ID, then by phone / name when that fails.
  async function checkRecord(d, rec, register) {
    const empId = String(rec.emp_id || '').trim();
    const byId = empId.length >= 3 ? await search(d, empId) : [];
    let res = match.compareRecord(rec, byId, []);
    if (['no_emp_id', 'not_in_h360', 'id_other_person'].includes(res.status)) {
      const extra = [];
      const phone = match.phoneKeys(rec.phone)[0];
      if (phone) extra.push(...(await search(d, '0' + phone)));
      const tokens = match.nameTokens(rec.name).filter((t) => t.length >= 4).sort((a, b) => b.length - a.length);
      if (tokens[0]) extra.push(...(await search(d, tokens.slice(0, 2).join(' '))));
      if (!extra.length && tokens[0]) extra.push(...(await search(d, tokens[0])));
      res = match.compareRecord(rec, byId, extra);
      await remember(d, extra.filter((r) => res.suggestions.some((s) => s.code === r.code)), codesOf(register));
    }
    await remember(d, byId.filter((r) => r.code === empId), codesOf(register));
    return slim(res);
  }

  /* ---------- H360's values kept on our records (staff document `h360_verified`) ----------
     Like a BNMC verification: evidence from outside, written by RECORD ID onto the staff
     document (never by emp ID — those are shared), restored onto the row by resolveRoster and
     merged over the browser copy by staff-data.js. None of our own fields are touched. */
  const bumpStaff = deps.bumpStaff || (async () => { try { await require('../cache').bump('staff'); } catch (err) { /* best effort */ } });
  const idFilter = (id) => { const or = [{ _id: String(id) }]; const n = Number(id); if (Number.isFinite(n)) or.unshift({ id: n }); return { $or: or }; };
  async function keepOnRecords(d, list) {
    const col = d.collection('staff');
    let n = 0;
    for (const res of list || []) {
      if (!res || res.id == null || res.status === 'error') continue;
      const at = res.at || new Date().toISOString();
      // An ID that is somebody else's in H360: only that fact is kept, never the other person's details.
      const snap = res.status === 'id_other_person'
        ? { code: '', status: res.status, at, other: res.h360 ? { code: res.h360.code, name: res.h360.name } : null }
        : match.snapshotOf(res) || { code: '', status: res.status, at };
      const r = await col.updateOne(idFilter(res.id), { $set: { h360_verified: snap } });
      if (!r.matchedCount) await col.updateOne({ id: res.id }, { $set: { h360_verified: snap } }, { upsert: true });
      n++;
    }
    if (n) await bumpStaff();
    return n;
  }

  /* ---------- one record / live lookup ---------- */
  async function verifyOne(recordId) {
    const d = await db();
    const register = await loadRegister();
    const rec = register.find((r) => String(r.id) === String(recordId));
    if (!rec) throw fail(404, 'No such staff record.');
    const res = match.markDuplicates([await checkRecord(d, rec, register)], register)[0];
    await settings.write(d, 'staffVerifyOne', { ['byId.' + rec.id]: res });
    await keepOnRecords(d, [res]);
    return res;
  }

  // The profile's H360 view from what the last check saved on the record — no H360 request.
  // Judged against the record as it is now, so an update shows at once.
  async function saved(recordId) {
    const register = await loadRegister();
    const rec = register.find((r) => String(r.id) === String(recordId));
    if (!rec) throw fail(404, 'No such staff record.');
    const snap = rec.h360_verified;
    if (!snap) return null;
    if (!snap.code || snap.status === 'id_other_person') {
      return { id: rec.id, empId: rec.emp_id || '', name: rec.name, status: snap.status, at: snap.at, h360: null, other: snap.other || null, fields: [], suggestions: [], saved: true };
    }
    const res = match.compareRecord(rec, [snap], []);
    return { ...match.markDuplicates([res], register)[0], at: snap.at, saved: true, idChanged: String(rec.emp_id || '').trim() !== snap.code };
  }

  async function lookup(q, visible) {
    const d = await db();
    const register = await loadRegister();
    const rows = await search(d, q);
    await remember(d, rows, codesOf(register));
    const mine = visible || register;
    const kept = [];
    const people = rows.slice(0, 80).map((h) => {
      const byCode = mine.filter((r) => String(r.emp_id || '').trim() === h.code);
      const phones = match.phoneKeys(h.phones);
      const possible = mine.filter((r) => !byCode.includes(r) && ((phones.length && match.phoneKeys(r.phone).some((p) => phones.includes(p))) || match.nameScore(r.name, h.name) >= match.SAME_NAME));
      const checks = match.markDuplicates(byCode.map((r) => slim(match.compareRecord(r, [h], []))), register);
      kept.push(...checks.filter((c) => !mine.find((r) => r.id === c.id && r.former)));
      return {
        ...h,
        nursing: match.isNursing(h),
        records: checks.map((c) => ({ ...c, former: Boolean((mine.find((r) => r.id === c.id) || {}).former) })),
        possible: possible.slice(0, 5).map((r) => ({ id: r.id, name: r.name, empId: r.emp_id || '', dept: r.current_department || '', former: Boolean(r.former || r.is_active === false) })),
      };
    });
    await keepOnRecords(d, kept).catch(() => 0);
    return { q, count: rows.length, people };
  }

  /* ---------- all records, in steps ---------- */
  const publicRun = (run) => (!run ? null : {
    id: run.id, startedAt: run.startedAt, by: run.by || '', dept: run.dept || '', total: run.total,
    done: run.total - (run.queue || []).length, remaining: (run.queue || []).length, error: run.error || null,
  });

  async function verifyStart(opts = {}) {
    const d = await db();
    const doc = (await settings.read(d, 'staffVerify')) || {};
    if (doc.run && doc.run.lockedAt && Date.now() - new Date(doc.run.lockedAt).getTime() < 75000) return publicRun(doc.run);
    const register = await loadRegister();
    const dept = String(opts.dept || '').trim();
    const ids = activeOf(register).filter((r) => !dept || r.current_department === dept).map((r) => r.id);
    const run = { id: require('crypto').randomBytes(6).toString('hex'), startedAt: new Date().toISOString(), by: opts.by || '', dept, total: ids.length, queue: ids, results: {}, lockedAt: null };
    await settings.write(d, 'staffVerify', { run });
    return publicRun(run);
  }

  async function verifyStep(id, budgetMs) {
    const d = await db();
    const doc = (await settings.read(d, 'staffVerify')) || {};
    const run = doc.run;
    if (!run || (id && run.id !== id)) return { run: null, last: lastInfo(doc) };
    if (run.lockedAt && Date.now() - new Date(run.lockedAt).getTime() < 75000) throw fail(423, 'This check is being run from another window.');
    await settings.write(d, 'staffVerify', { 'run.lockedAt': new Date() });
    const register = await loadRegister();
    const byId = new Map(register.map((r) => [r.id, r]));
    const queue = run.queue.slice();
    const until = Date.now() + (budgetMs || STEP_MS);
    let error = null;
    const results = { ...(run.results || {}) };
    const answered = new Set();
    const fresh = [];
    await pool(queue, until, async (rid) => {
      const rec = byId.get(rid);
      if (!rec) { answered.add(rid); return; }
      try {
        results[rid] = await checkRecord(d, rec, register);
        fresh.push(results[rid]);
        answered.add(rid);
      } catch (err) {
        // No login / no database: stop here and say so; anything else is this record's own problem.
        if (err.status === 409 || err.status === 503) { error = err.message; return; }
        results[rid] = slim({ id: rec.id, empId: rec.emp_id || '', name: rec.name, role: rec.role, dept: rec.current_department || '', status: 'error', error: err.message, fields: [], suggestions: [] });
        answered.add(rid);
      }
    }, () => Boolean(error));
    const rest = queue.filter((rid) => !answered.has(rid));
    await keepOnRecords(d, fresh).catch(() => 0);
    if (rest.length) {
      await settings.write(d, 'staffVerify', { 'run.queue': rest, 'run.results': results, 'run.lockedAt': null, 'run.error': error });
      return { run: publicRun({ ...run, queue: rest, error }), last: lastInfo(doc) };
    }
    // Finished: duplicates are worked out across the whole register, and the run becomes "last".
    const all = match.markDuplicates(Object.values(results), register);
    const previous = doc.last ? { finishedAt: doc.last.finishedAt, statusById: Object.fromEntries((doc.last.results || []).map((r) => [r.id, r.status])) } : doc.previous || null;
    const last = { finishedAt: new Date().toISOString(), startedAt: run.startedAt, by: run.by, dept: run.dept || '', results: all, summary: match.summary(all) };
    await settings.write(d, 'staffVerify', { last, previous }, { run: '' });
    // A whole-register check replaces the single checks made before it.
    if (!run.dept) await settings.write(d, 'staffVerifyOne', { byId: {} });
    return { run: null, last: lastInfo({ last }) };
  }

  const lastInfo = (doc) => (doc && doc.last ? { finishedAt: doc.last.finishedAt, startedAt: doc.last.startedAt, by: doc.last.by, dept: doc.last.dept, summary: doc.last.summary } : null);

  async function results() {
    const d = await db();
    const doc = (await settings.read(d, 'staffVerify')) || {};
    const one = ((await settings.read(d, 'staffVerifyOne')) || {}).byId || {};
    const list = (doc.last && doc.last.results ? doc.last.results : []).map((r) => (one[r.id] && one[r.id].at > (r.at || '') ? one[r.id] : r));
    for (const [rid, r] of Object.entries(one)) if (!list.some((x) => String(x.id) === rid)) list.push(r);
    // Re-judged against the register as it is NOW (an "Update from H360" shows at once) and by
    // the current rule, from the H360 person the check found. A record whose emp ID changed
    // since keeps its old answer until it is checked again.
    const register = await loadRegister();
    const byId = new Map(register.map((r) => [String(r.id), r]));
    const now = list.map((r) => {
      const rec = byId.get(String(r.id));
      if (!rec || !r.h360 || r.status === 'error' || String(rec.emp_id || '').trim() !== r.h360.code) return { ...r, duplicateOf: undefined };
      const c = match.compareRecord(rec, [r.h360], []);
      return { ...c, at: r.at, suggestions: c.suggestions.length ? c.suggestions : r.suggestions || [] };
    });
    const judged = match.markDuplicates(now, register).map((r) => { if (!r.duplicateOf) delete r.duplicateOf; return r; });
    return { list: judged, summary: match.summary(judged), last: lastInfo(doc), previous: doc.previous ? { finishedAt: doc.previous.finishedAt, statusById: doc.previous.statusById } : null, run: publicRun(doc.run) };
  }

  /* ---------- sweep: who is in H360 Nursing Services (used by "Not in register" and the Census) ----------
     Four-digit prefix searches from 1000 up to a block past the highest employee code known, 2 at a
     time with a pause (H360 is the hospital's live system). A prefix answering many people is searched
     again in tenths. Nobody is ever removed: a Nursing Services person the sweep did not meet gets
     `goneSince` only when the sweep had no errors AND met at least 90% of the people known before it
     started — otherwise H360 may simply have answered short, and nobody is marked. */
  async function maxKnownCode(d) {
    let max = 0;
    const top = await d.collection(COLL).find({}, { projection: { code: 1 } }).toArray();
    for (const r of top) { const n = Number(r.code); if (Number.isFinite(n) && n < 1e6 && n > max) max = n; }
    for (const r of (await loadRegister()) || []) { const n = Number(String(r.emp_id || '').trim()); if (Number.isFinite(n) && n < 1e6 && n > max) max = n; }
    return max;
  }
  const knownNursing = (d) => d.collection(COLL).countDocuments({ nursing: true, goneSince: { $exists: false } });

  async function newSweep(d, by) {
    const queue = census.sweepPrefixes(await maxKnownCode(d));
    return { id: require('crypto').randomBytes(6).toString('hex'), startedAt: new Date().toISOString(), by: by || '', total: queue.length, queue, seen: 0, errors: 0, knownBefore: await knownNursing(d), lockedAt: null };
  }

  // One time-boxed slice of a sweep. Returns the run's new state (queue left, totals) and a fatal error.
  async function sweepWork(d, run, until) {
    const keep = codesOf(await loadRegister());
    const queue = run.queue.slice();
    const added = [];
    let seen = run.seen || 0, errors = run.errors || 0, fatal = null;
    const answered = new Set();
    await pool(queue, until, async (prefix) => {
      try {
        const rows = await search(d, prefix, true);
        seen += rows.length;
        await remember(d, rows, keep, run.id);
        if (rows.length >= SPLIT_AT && prefix.length < 5) for (let k = 0; k < 10; k++) added.push(prefix + k);
        answered.add(prefix);
      } catch (err) {
        if (err.status === 409 || err.status === 503) { fatal = err.message; return; }
        errors++;
        answered.add(prefix);
      }
    }, () => Boolean(fatal), SWEEP_CONCURRENCY, PAUSE_MS);
    return { ...run, queue: queue.filter((p) => !answered.has(p)).concat(added), total: run.total + added.length, seen, errors, error: fatal };
  }

  // A finished sweep: mark (never remove) the people it did not meet, when it is safe to.
  async function finishSweep(d, run) {
    const col = d.collection(COLL);
    const start = new Date(run.startedAt);
    const met = await col.countDocuments({ nursing: true, lastSeenAt: { $gte: start } });
    const before = run.knownBefore || 0;
    const short = before > 0 && met < Math.ceil(before * SWEEP_SHORT);
    let marked = 0;
    let held = '';
    if (run.errors) held = `${run.errors} H360 search(es) failed`;
    else if (short) held = `H360 answered ${met} Nursing Services people, fewer than the ${before} known before`;
    if (!held) {
      const r = await col.updateMany({ nursing: true, lastSeenAt: { $lt: start }, goneSince: { $exists: false } }, { $set: { goneSince: new Date() } });
      marked = r.modifiedCount || 0;
    }
    const count = await knownNursing(d);
    const last = { finishedAt: new Date().toISOString(), startedAt: run.startedAt, by: run.by, nursing: count, met, knownBefore: before, searches: run.total, errors: run.errors || 0, marked, held };
    await settings.write(d, 'staffSweep', { last }, { run: '' });
    return last;
  }

  async function sweepStart(by) {
    const d = await db();
    const doc = (await settings.read(d, 'staffSweep')) || {};
    if (doc.run && doc.run.lockedAt && Date.now() - new Date(doc.run.lockedAt).getTime() < 75000) return publicRun(doc.run);
    const run = await newSweep(d, by);
    await settings.write(d, 'staffSweep', { run });
    return publicRun(run);
  }

  async function sweepStep(id, budgetMs) {
    const d = await db();
    const doc = (await settings.read(d, 'staffSweep')) || {};
    const run = doc.run;
    if (!run || (id && run.id !== id)) return { run: null, last: doc.last || null };
    if (run.lockedAt && Date.now() - new Date(run.lockedAt).getTime() < 75000) throw fail(423, 'The H360 sweep is being run from another window.');
    await settings.write(d, 'staffSweep', { 'run.lockedAt': new Date() });
    const next = await sweepWork(d, run, Date.now() + (budgetMs || STEP_MS));
    if (next.queue.length) {
      await settings.write(d, 'staffSweep', { 'run.queue': next.queue, 'run.total': next.total, 'run.seen': next.seen, 'run.errors': next.errors, 'run.lockedAt': null, 'run.error': next.error });
      return { run: publicRun(next), last: doc.last || null };
    }
    return { run: null, last: await finishSweep(d, next) };
  }

  /* ---------- Census: H360 Nursing Services against our register (administrators) ----------
     Phase 1 the sweep above. Phase 2 our active records whose emp ID is not in the Nursing Services
     list are searched one by one (emp ID, then phone / name — the Bulk Verify search) to say whether
     they work elsewhere in the hospital, are not in H360, or hold someone else's ID. The lists are
     worked out again on every opening from what is kept and the register AS IT IS NOW. */
  const CENSUS = 'staffCensus';
  const publicCensusRun = (run) => (!run ? null : {
    id: run.id, phase: run.phase, startedAt: run.startedAt, by: run.by || '', error: run.error || null,
    total: run.total + (run.outsideTotal || 0), done: (run.total - (run.queue || []).length) + ((run.outsideTotal || 0) - (run.outsideQueue || []).length),
    remaining: (run.queue || []).length + (run.outsideQueue || []).length,
  });
  async function groupOverrides(d) {
    const g = (await settings.read(d, 'staffCensusGroups')) || {};
    return census.cleanOverrides(g.map || {});
  }
  async function setGroups(map, by) {
    const d = await db();
    const clean = census.cleanOverrides(map);
    await settings.write(d, 'staffCensusGroups', { map: clean, by: by || '', at: new Date() });
    return clean;
  }

  async function censusStart(by) {
    const d = await db();
    await cfgOf(d);   // no H360 login: say so now, not half-way
    const doc = (await settings.read(d, CENSUS)) || {};
    if (doc.run && doc.run.lockedAt && Date.now() - new Date(doc.run.lockedAt).getTime() < 75000) return publicCensusRun(doc.run);
    const run = { ...(await newSweep(d, by)), phase: 'sweep', outsideQueue: [], outsideTotal: 0, outside: {} };
    await settings.write(d, CENSUS, { run });
    return publicCensusRun(run);
  }

  async function censusStep(id, budgetMs) {
    const d = await db();
    const doc = (await settings.read(d, CENSUS)) || {};
    const run = doc.run;
    if (!run || (id && run.id !== id)) return { run: null, last: censusLastInfo(doc) };
    if (run.lockedAt && Date.now() - new Date(run.lockedAt).getTime() < 75000) throw fail(423, 'The H360 census is being run from another window.');
    await settings.write(d, CENSUS, { 'run.lockedAt': new Date() });
    const until = Date.now() + (budgetMs || STEP_MS);
    if (run.phase === 'sweep') {
      const next = await sweepWork(d, run, until);
      if (next.error || next.queue.length) {
        await settings.write(d, CENSUS, { 'run.queue': next.queue, 'run.total': next.total, 'run.seen': next.seen, 'run.errors': next.errors, 'run.lockedAt': null, 'run.error': next.error });
        return { run: publicCensusRun(next) };
      }
      const sweep = await finishSweep(d, next);
      // Phase 2: our active records the Nursing Services list does not hold.
      const codes = new Set((await snapshot()).filter((h) => h.nursing).map((h) => String(h.code)));
      const ids = activeOf(await loadRegister()).filter((r) => !codes.has(String(r.emp_id || '').trim())).map((r) => r.id);
      const set = { 'run.queue': [], 'run.total': next.total, 'run.seen': next.seen, 'run.errors': next.errors, 'run.phase': 'outside', 'run.sweep': sweep, 'run.outsideQueue': ids, 'run.outsideTotal': ids.length, 'run.lockedAt': null, 'run.error': null };
      await settings.write(d, CENSUS, set);
      return { run: publicCensusRun({ ...next, phase: 'outside', outsideQueue: ids, outsideTotal: ids.length }) };
    }
    // phase 'outside'
    const register = await loadRegister();
    const byId = new Map(register.map((r) => [String(r.id), r]));
    const queue = (run.outsideQueue || []).slice();
    const outside = { ...(run.outside || {}) };
    const answered = new Set();
    const fresh = [];
    let fatal = null;
    await pool(queue, until, async (rid) => {
      const rec = byId.get(String(rid));
      if (!rec) { answered.add(rid); return; }
      try {
        const res = await checkRecord(d, rec, register);
        outside[rid] = res;
        fresh.push(res);
      } catch (err) {
        if (err.status === 409 || err.status === 503) { fatal = err.message; return; }
        outside[rid] = slim({ id: rec.id, empId: rec.emp_id || '', name: rec.name, status: 'error', error: err.message, fields: [], suggestions: [] });
      }
      answered.add(rid);
    }, () => Boolean(fatal), SWEEP_CONCURRENCY, PAUSE_MS);
    await keepOnRecords(d, fresh).catch(() => 0);
    const rest = queue.filter((rid) => !answered.has(rid));
    if (rest.length || fatal) {
      await settings.write(d, CENSUS, { 'run.outsideQueue': rest, 'run.outside': outside, 'run.lockedAt': null, 'run.error': fatal });
      return { run: publicCensusRun({ ...run, outsideQueue: rest, error: fatal }) };
    }
    // Finished: keep the counts (history) and what phase 2 found; the lists are rebuilt on opening.
    const built = census.buildCensus(await snapshot({ all: true }), register, outside, await groupOverrides(d));
    const last = { finishedAt: new Date().toISOString(), startedAt: run.startedAt, by: run.by, sweep: run.sweep || null, outside, codes: built.codes, counts: built.counts };
    const previous = doc.last ? { finishedAt: doc.last.finishedAt, codes: doc.last.codes || [], counts: doc.last.counts || null } : doc.previous || null;
    const history = (Array.isArray(doc.history) ? doc.history : []).concat([{ at: last.finishedAt, by: run.by, counts: built.counts }]).slice(-24);
    await settings.write(d, CENSUS, { last, previous, history }, { run: '' });
    return { run: null, last: censusLastInfo({ last }) };
  }

  const censusLastInfo = (doc) => (doc && doc.last ? { finishedAt: doc.last.finishedAt, startedAt: doc.last.startedAt, by: doc.last.by, sweep: doc.last.sweep || null } : null);

  // The census as it stands now (no H360 request).
  async function censusView() {
    const d = await db();
    const doc = (await settings.read(d, CENSUS)) || {};
    const overrides = await groupOverrides(d);
    const rows = await snapshot({ all: true });
    const built = census.buildCensus(rows, await loadRegister(), (doc.last && doc.last.outside) || {}, overrides);
    const ch = doc.previous ? census.changesSince(doc.previous.codes, doc.last ? doc.last.codes : built.codes) : null;
    const byCode = new Map(rows.map((h) => [String(h.code), h]));
    const name = (c) => { const h = byCode.get(c); return { code: c, name: h ? h.name : '', designation: h ? h.designation : '', dept: h ? h.dept : '' }; };
    const sweep = (await settings.read(d, 'staffSweep')) || {};
    return {
      ...built, codes: undefined,
      groupsDef: census.GROUPS, overrides,
      last: censusLastInfo(doc), previous: doc.previous ? { finishedAt: doc.previous.finishedAt, counts: doc.previous.counts } : null,
      history: (doc.history || []).map((h) => ({ at: h.at, by: h.by, h360: h.counts && h.counts.h360, ours: h.counts && h.counts.ours, matched: h.counts && h.counts.matched, missing: h.counts && h.counts.missing, notInNursing: h.counts && h.counts.notInNursing })),
      changes: ch ? { joined: ch.joined.map(name), left: ch.left.map(name) } : null,
      sweep: sweep.last || null,
      run: publicCensusRun(doc.run),
    };
  }

  async function censusWorkbook() {
    const ExcelJS = require('exceljs');
    const c = await censusView();
    const wb = new ExcelJS.Workbook();
    wb.creator = 'UNICO';
    const sheet = (name, columns, rows) => {
      const ws = wb.addWorksheet(name.slice(0, 31));
      ws.columns = columns.map(([header, key, width]) => ({ header, key, width: width || 18 }));
      ws.getRow(1).font = { bold: true };
      rows.forEach((r) => ws.addRow(r));
      ws.views = [{ state: 'frozen', ySplit: 1 }];
    };
    const G = Object.fromEntries(census.GROUPS.map((g) => [g.id, g.label]));
    const H = (h) => (h ? { hCode: h.code, hName: h.name, hDesig: h.designation, hGroup: G[h.group], hUnit: h.dept, hJoin: h.joinDate, hPhone: (h.phones || []).join(', '), hGender: h.gender, hAge: h.age, hMarital: h.marital, hService: h.service } : {});
    const R = (r) => (r ? { id: r.id, rName: r.name, empId: r.empId, rDesig: r.designation, rGroup: G[r.group], rDept: r.dept, rDoj: r.doj, rDob: r.dob, rPhone: r.phone, rGender: r.gender } : {});
    const HC = [['H360 ID', 'hCode', 10], ['H360 name', 'hName', 28], ['H360 designation', 'hDesig', 24], ['H360 group', 'hGroup', 16], ['H360 unit', 'hUnit', 30], ['H360 joined', 'hJoin', 12], ['H360 phone', 'hPhone', 24], ['H360 gender', 'hGender', 10], ['H360 age', 'hAge', 8], ['H360 marital', 'hMarital', 10], ['H360 service', 'hService', 12]];
    const RC = [['Our record #', 'id', 10], ['Our name', 'rName', 28], ['Our emp ID', 'empId', 10], ['Our designation', 'rDesig', 24], ['Our group', 'rGroup', 16], ['Our department', 'rDept', 20], ['Our joining date', 'rDoj', 12], ['Our date of birth', 'rDob', 12], ['Our phone', 'rPhone', 16], ['Our gender', 'rGender', 10]];
    sheet('Summary', [['', 'k', 44], ['', 'v', 30]], [
      { k: 'H360 Nursing Services people', v: c.counts.h360 }, { k: 'Our active staff', v: c.counts.ours }, { k: 'Paired by emp ID', v: c.counts.matched },
      { k: 'In H360, not in our register', v: c.counts.missing }, { k: 'Previous Staff still active in H360', v: c.counts.formerActive },
      { k: 'Ours, not in H360 Nursing Services', v: c.counts.notInNursing }, { k: 'Gone from H360, active with us', v: c.counts.goneActive },
      { k: 'Our emp ID is another person in H360', v: c.counts.idOther }, { k: 'Nurse / PCA differs', v: c.counts.roleMismatch }, { k: 'Rank differs', v: c.counts.rankMismatch },
      { k: 'Designation differs', v: c.counts.designation }, { k: 'Age vs our date of birth differs', v: c.counts.ageDiff }, { k: 'No date of birth with us (H360 age known)', v: c.counts.noDob },
      { k: 'Joining date / gender / phone differs', v: c.counts.details }, { k: 'Blank with us, H360 has it', v: c.counts.fills }, { k: 'One emp ID on two records', v: c.counts.sharedIds },
      { k: 'Census finished', v: c.last ? String(c.last.finishedAt).replace('T', ' ').slice(0, 16) + ' UTC' + (c.last.by ? ' by ' + c.last.by : '') : 'not run yet' },
      { k: 'Note', v: 'H360 gives age in whole years, not the date of birth.' },
    ]);
    sheet('Groups', [['Group', 'label', 24], ['H360', 'h360', 10], ['Ours', 'ours', 10], ['Paired, same group', 'matched', 18], ['Ours − H360', 'diff', 12]], c.groups);
    sheet('Units', [['H360 unit', 'unit', 40], ['People', 'total', 10], ['With us', 'withUs', 10], ...census.GROUPS.map((g) => [g.label, g.id, 12]), ['Our departments (paired)', 'od', 50]],
      c.units.map((u) => ({ ...u, od: u.ourDepts.map((x) => `${x.name} ${x.n}`).join(', ') })));
    sheet('Managers & leaders', [...HC.slice(0, 5), ...RC.slice(0, 6)], c.leaders.map((x) => ({ ...H(x.h), ...R(x.rec) })));
    const L = c.lists;
    sheet('In H360 not ours', [...HC, ['Maybe our record', 'maybe', 40]], L.missing.map((x) => ({ ...H(x.h), maybe: x.maybe ? `#${x.maybe.id} ${x.maybe.name} (${x.maybe.empId || 'no emp ID'}; ${x.maybe.why})` : x.idClash ? `ID used by our #${x.idClash.id} ${x.idClash.name}` : '' })));
    sheet('Previous Staff active H360', [...HC, ...RC], L.formerActive.map((x) => ({ ...H(x.h), ...R(x.rec) })));
    const WHY = { outside: 'In H360, outside Nursing Services', not_found: 'Emp ID not in H360', other_person: 'Emp ID is another person', no_emp_id: 'No emp ID', unchecked: 'Not checked yet', error: 'Could not check' };
    sheet('Ours not in H360 Nursing', [['Why', 'why', 30], ...RC, ...HC, ['H360 may know as', 'sug', 40]], L.notInNursing.map((x) => ({ why: WHY[x.why] || x.why, ...R(x.rec), ...H(x.h), sug: (x.suggestions || []).map((s) => `${s.code} ${s.name} (${s.why})`).join('; ') })));
    sheet('Gone from H360', [...RC, ...HC], L.goneActive.map((x) => ({ ...R(x.rec), ...H(x.h) })));
    sheet('ID is another person', [...RC, ...HC], L.idOther.map((x) => ({ ...R(x.rec), ...H(x.h) })));
    sheet('Nurse-PCA differs', [...RC, ...HC], L.roleMismatch.map((x) => ({ ...R(x.rec), ...H(x.h) })));
    sheet('Rank differs', [...RC, ...HC], L.rankMismatch.map((x) => ({ ...R(x.rec), ...H(x.h) })));
    sheet('Designation differs', [...RC, ...HC], L.designation.map((x) => ({ ...R(x.rec), ...H(x.h) })));
    sheet('Age vs birth date', [...RC, ['Our age', 'oa', 8], ['H360 age', 'ha', 8], ...HC], L.ageDiff.map((x) => ({ ...R(x.rec), oa: x.ourAge, ha: x.h360Age, ...H(x.h) })));
    sheet('No birth date', [...RC, ['H360 age', 'ha', 8], ['Born about', 'born', 12], ...HC], L.noDob.map((x) => ({ ...R(x.rec), ha: x.h360Age, born: x.born ? x.born.text : '', ...H(x.h) })));
    sheet('Details differ', [...RC, ['Differences', 'd', 70], ...HC], L.details.map((x) => ({ ...R(x.rec), d: x.diffs.map((f) => `${f.label}: ours "${f.ours}" / H360 "${f.h360}"`).join('; '), ...H(x.h) })));
    sheet('Blank with us', [...RC, ['H360 has', 'f', 60], ...HC], L.fills.map((x) => ({ ...R(x.rec), f: x.fills.map((f) => `${f.label}: ${f.h360}`).join('; '), ...H(x.h) })));
    sheet('Emp ID twice', [['Emp ID', 'code', 10], ['Our records', 'recs', 60], ['H360 says', 'h', 40]], L.sharedIds.map((x) => ({ code: x.code, recs: x.recs.map((r) => `#${r.id} ${r.name}`).join('; '), h: x.h ? `${x.h.name} (${x.h.designation})` : '' })));
    return wb;
  }

  // What is kept about H360 people; opts.all includes those a full sweep no longer met (goneSince).
  async function snapshot(opts) {
    const d = await db();
    return d.collection(COLL).find(opts && opts.all ? {} : { goneSince: { $exists: false } }).toArray();
  }

  async function missing() {
    const d = await db();
    const register = await loadRegister();
    const rows = await snapshot();
    const sweep = (await settings.read(d, 'staffSweep')) || {};
    return { list: match.missingFromRegister(rows, register), known: rows.filter((r) => r.nursing).length, sweep: sweep.last || null, run: publicRun(sweep.run) };
  }

  // The daily automatic check is OFF unless someone with staff edit access turns it on
  // (user 2026-11-10: the register hardly changes from day to day).
  async function options() {
    const d = await db();
    const doc = (await settings.read(d, 'staffOptions')) || {};
    return { daily: doc.daily === true, dailyBy: doc.dailyBy || '', dailyAt: doc.dailyAt || null };
  }
  async function setOptions(changes, by) {
    const d = await db();
    if (typeof changes.daily === 'boolean') await settings.write(d, 'staffOptions', { daily: changes.daily, dailyBy: by || '', dailyAt: new Date() });
    return options();
  }

  async function info() {
    const d = await db();
    const login = await settings.login(d);
    const verify = (await settings.read(d, 'staffVerify')) || {};
    const sweep = (await settings.read(d, 'staffSweep')) || {};
    const diag = await settings.read(d, 'staffDiagnostics');
    return {
      login: Boolean(login.user && login.pass), loginElsewhere: Boolean(login.elsewhere),
      // For administrators only (the route drops these for everyone else). Never the password.
      loginUser: login.user || '', loginSource: login.source || '', loginSavedAt: login.savedAt || null, loginSavedBy: login.savedBy || '',
      verify: { last: lastInfo(verify), run: publicRun(verify.run) },
      sweep: { last: sweep.last || null, run: publicRun(sweep.run) },
      searchForm: diag && diag.form ? diag.form : null,
      options: await options(),
      session: await sessionInfo(),
    };
  }

  // The daily check: finish or start today's whole-register verify, then the weekly sweep.
  async function daily(budgetMs = 45000) {
    if (!(await options()).daily) return ['daily check is off'];
    const until = Date.now() + budgetMs;
    const d = await db();
    const verify = (await settings.read(d, 'staffVerify')) || {};
    const done = [];
    if (!verify.run && (!verify.last || dhakaDay(new Date(verify.last.finishedAt)) !== dhakaDay())) { await verifyStart({ by: 'daily check' }); done.push('verify started'); }
    let state = await verifyStep(null, Math.max(5000, until - Date.now() - 5000)).catch((err) => ({ error: err.message }));
    done.push(state && state.run ? `verify ${state.run.done}/${state.run.total}` : 'verify finished');
    if (state && !state.run && Date.now() < until - 15000) {
      const sweep = (await settings.read(d, 'staffSweep')) || {};
      const old = !sweep.last || Date.now() - new Date(sweep.last.finishedAt).getTime() > 7 * 86400000;
      if (sweep.run || old) {
        if (!sweep.run) await sweepStart('daily check');
        state = await sweepStep(null, Math.max(5000, until - Date.now() - 5000)).catch((err) => ({ error: err.message }));
        done.push(state && state.run ? `sweep ${state.run.done}/${state.run.total}` : 'sweep finished');
      }
    }
    return done;
  }

  async function workbook(visibleIds) {
    const ExcelJS = require('exceljs');
    const res = await results();
    const miss = await missing();
    const wb = new ExcelJS.Workbook();
    wb.creator = 'UNICO';
    const sheet = (name, columns, rows) => {
      const ws = wb.addWorksheet(name);
      ws.columns = columns.map(([header, key, width]) => ({ header, key, width: width || 18 }));
      ws.getRow(1).font = { bold: true };
      rows.forEach((r) => ws.addRow(r));
      ws.views = [{ state: 'frozen', ySplit: 1 }];
    };
    const mine = res.list.filter((r) => !visibleIds || visibleIds.has(r.id));
    const diffs = (r) => (r.fields || []).filter((f) => f.ok === false).map((f) => `${f.label}: ours "${f.ours}" / H360 "${f.h360}"`).join('; ');
    sheet('Verify', [['Status', 'status', 34], ['Emp ID', 'empId', 10], ['Name (ours)', 'name', 28], ['Name (H360)', 'h360Name', 28], ['Department (ours)', 'dept', 20], ['Department (H360)', 'h360Dept', 28], ['Designation (H360)', 'h360Desig', 24], ['Joined (H360)', 'h360Join', 12], ['Phone (H360)', 'h360Phone', 24], ['Gender (H360)', 'h360Gender', 10], ['Marital (H360)', 'h360Marital', 10], ['Age (H360)', 'h360Age', 8], ['Service (H360)', 'h360Service', 14], ['Differences', 'diffs', 70], ['Suggested H360 ID', 'suggest', 30], ['Checked', 'at', 20]],
      mine.sort((a, b) => match.STATUS_ORDER.indexOf(a.status) - match.STATUS_ORDER.indexOf(b.status)).map((r) => ({
        status: match.STATUS_LABEL[r.status] || r.status, empId: r.empId, name: r.name, h360Name: r.h360 ? r.h360.name : '', dept: r.dept, h360Dept: r.h360 ? r.h360.dept : '',
        h360Desig: r.h360 ? r.h360.designation : '', h360Join: r.h360 ? r.h360.joinDate : '', h360Phone: r.h360 ? (r.h360.phones || []).join(', ') : '',
        h360Gender: r.h360 ? r.h360.gender : '', h360Marital: r.h360 ? r.h360.marital : '', h360Age: r.h360 ? r.h360.age : '', h360Service: r.h360 ? r.h360.service : '',
        diffs: [diffs(r), r.duplicateOf ? 'also on record(s) ' + r.duplicateOf.join(', ') : '', r.error || ''].filter(Boolean).join('; '),
        suggest: (r.suggestions || []).map((s) => `${s.code} ${s.name} (${s.why})`).join('; '), at: String(r.at || '').replace('T', ' ').slice(0, 16),
      })));
    sheet('Not in register', [['H360 ID', 'code', 10], ['Name', 'name', 30], ['Designation', 'designation', 22], ['Department', 'dept', 30], ['Joined', 'joinDate', 12], ['Phone', 'phone', 26], ['Our record (maybe)', 'ours', 40]],
      miss.list.map((h) => ({ code: h.code, name: h.name, designation: h.designation, dept: h.dept, joinDate: h.joinDate, phone: (h.phones || []).join(', '), ours: h.ourMatch ? `#${h.ourMatch.id} ${h.ourMatch.name} (${h.ourMatch.empId || 'no emp ID'}; ${h.ourMatch.why}${h.ourMatch.former ? '; Previous Staff' : ''})` : '' })));
    sheet('Duplicates & IDs', [['Problem', 'status', 34], ['Emp ID', 'empId', 10], ['Name (ours)', 'name', 28], ['Other record(s)', 'others', 20], ['H360 says', 'h360', 40]],
      mine.filter((r) => r.status === 'duplicate_id' || r.status === 'id_other_person').map((r) => ({ status: match.STATUS_LABEL[r.status], empId: r.empId, name: r.name, others: (r.duplicateOf || []).join(', '), h360: r.h360 ? `${r.h360.code} ${r.h360.name}` : '' })));
    return wb;
  }

  return { signedInSince, sessionInfo, signOut, saved, options, setOptions, search, lookup, verifyOne, verifyStart, verifyStep, results, sweepStart, sweepStep, missing, info, daily, workbook, snapshot, censusStart, censusStep, censusView, censusWorkbook, setGroups };
}

/* ---------------- routes ---------------- */
function mount(app, opts = {}) {
  const access = require('../access');
  // Administrators, and anyone given the "H360 Check" sub-menu tick (opt-in; staff access alone is not enough).
  const h360Only = (req, res, next) => (!req.access || access.h360StaffOk(req.access) ? next() : res.status(403).json({ error: 'H360 staff data needs the "H360 Check" permission (Access Control → Staff Management).' }));
  const guard = [].concat(opts.requireApi || ((req, res, next) => next()), h360Only);
  const service = opts.service || createStaffService(opts.deps);
  const json = express.json({ limit: '100kb' });
  const who = (req) => (req.user && (req.user.name || req.user.sub)) || '';
  const canEdit = (req) => !req.access || access.can(req.access, 'staff', 'edit');
  const editOnly = (req, res, next) => (canEdit(req) ? next() : res.status(403).json({ error: 'Staff edit access is needed for this.' }));
  const route = (handler) => (req, res) => Promise.resolve().then(() => handler(req, res)).catch((err) => {
    if (!res.headersSent) res.status(err.status || 500).json({ error: err.message });
    else res.end();
  });
  // The records this person may see (department-scoped staff access sees only theirs).
  const visible = async (req) => {
    const all = await (opts.loadRegister || (() => require('../staff-roster').loadRoster({ cached: true })))();
    return req.access ? access.filterStaff(req.access, all) : all;
  };
  const P = '/api/h360-staff';

  app.get(P + '/info', guard, route(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const out = await service.info();
    const admin = !req.access || req.access.unrestricted;
    if (!admin) { delete out.loginUser; delete out.loginSource; delete out.loginSavedAt; delete out.loginSavedBy; }
    res.json({ ...out, canEdit: canEdit(req), isAdmin: admin });
  }));

  app.post(P + '/options', guard, editOnly, json, route(async (req, res) => {
    res.json(await service.setOptions({ daily: (req.body || {}).daily }, who(req)));
  }));

  // Answers that needed a fresh H360 sign-in say so (the screen shows "Signed in to H360").
  const withSignIn = (t0, body) => ({ ...body, signedIn: service.signedInSince(t0) });

  app.delete(P + '/session', guard, route(async (req, res) => {
    if (req.access && !req.access.unrestricted) return res.status(403).json({ error: 'Administrator access required.' });
    res.json({ session: await service.signOut() });
  }));

  app.get(P + '/search', guard, route(async (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 60);
    if (q.length < 3) return res.status(400).json({ error: 'Type at least 3 letters or digits.' });
    const t0 = Date.now();
    res.json(withSignIn(t0, await service.lookup(q, await visible(req))));
  }));

  app.get(P + '/verify/:id', guard, route(async (req, res) => {
    const mine = await visible(req);
    if (!mine.some((r) => String(r.id) === String(req.params.id))) return res.status(404).json({ error: 'No such staff record.' });
    const t0 = Date.now();
    res.json(withSignIn(t0, await service.verifyOne(req.params.id)));
  }));

  app.get(P + '/saved/:id', guard, route(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const mine = await visible(req);
    if (!mine.some((r) => String(r.id) === String(req.params.id))) return res.status(404).json({ error: 'No such staff record.' });
    res.json({ result: await service.saved(req.params.id) });
  }));

  app.post(P + '/verify-bulk', guard, json, route(async (req, res) => {
    res.json({ run: await service.verifyStart({ dept: (req.body || {}).dept, by: who(req) }) });
  }));
  app.post(P + '/verify-bulk/step', guard, json, route(async (req, res) => {
    const t0 = Date.now();
    res.json(withSignIn(t0, await service.verifyStep(String((req.body || {}).id || ''))));
  }));

  app.get(P + '/results', guard, route(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const ids = new Set((await visible(req)).map((r) => r.id));
    const out = await service.results();
    res.json({ ...out, list: out.list.filter((r) => ids.has(r.id)) });
  }));

  app.get(P + '/status', guard, route(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const ids = new Set((await visible(req)).map((r) => r.id));
    const out = await service.results();
    const byId = {};
    for (const r of out.list) if (ids.has(r.id)) byId[r.id] = { s: r.status, at: r.at, why: match.STATUS_LABEL[r.status] || '', h: r.h360 ? r.h360.name : '' };
    res.json({ byId, at: out.last ? out.last.finishedAt : null });
  }));

  app.post(P + '/sweep', guard, editOnly, json, route(async (req, res) => {
    res.json({ run: await service.sweepStart(who(req)) });
  }));
  app.post(P + '/sweep/step', guard, editOnly, json, route(async (req, res) => {
    const t0 = Date.now();
    res.json(withSignIn(t0, await service.sweepStep(String((req.body || {}).id || ''))));
  }));

  app.get(P + '/missing', guard, route(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await service.missing());
  }));

  /* Census — administrators only (user 2026-11-15: "for staff management admin only"). */
  const adminOnly = (req, res, next) => (!req.access || req.access.unrestricted ? next() : res.status(403).json({ error: 'The H360 census is for administrators.' }));
  const note = (req, action, detail) => { try { require('../activity-log').log(req, action, { target: 'H360 census', detail }); } catch (err) { /* best effort */ } };
  app.get(P + '/census', guard, adminOnly, route(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await service.censusView());
  }));
  app.post(P + '/census', guard, adminOnly, json, route(async (req, res) => {
    const run = await service.censusStart(who(req));
    note(req, 'h360_census_start', 'census started (' + run.total + ' H360 searches)');
    res.json({ run });
  }));
  app.post(P + '/census/step', guard, adminOnly, json, route(async (req, res) => {
    const t0 = Date.now();
    const out = await service.censusStep(String((req.body || {}).id || ''));
    if (!out.run && out.last) note(req, 'h360_census_done', 'census finished' + (out.last.sweep && out.last.sweep.held ? ' · nobody marked gone: ' + out.last.sweep.held : ''));
    res.json(withSignIn(t0, out));
  }));
  app.put(P + '/census/groups', guard, adminOnly, json, route(async (req, res) => {
    const map = await service.setGroups((req.body || {}).map, who(req));
    note(req, 'h360_census_groups', Object.keys(map).length + ' designation(s) moved by hand');
    res.json({ overrides: map });
  }));
  app.post(P + '/census/print', guard, adminOnly, json, route(async (req, res) => {
    note(req, 'h360_census_print', String((req.body || {}).what || 'printed').slice(0, 80));
    res.json({ ok: true });
  }));
  app.get(P + '/census.xlsx', guard, adminOnly, route(async (req, res) => {
    const wb = await service.censusWorkbook();
    note(req, 'h360_census_export', 'Excel downloaded');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="H360-nursing-census-${dhakaDay()}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  }));

  app.get(P + '/export.xlsx', guard, route(async (req, res) => {
    const ids = new Set((await visible(req)).map((r) => r.id));
    const wb = await service.workbook(ids);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="H360-staff-check-${dhakaDay()}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  }));

  // Vercel cron (no session cookie). CRON_SECRET, when set, is required as a bearer token.
  app.get(P + '/cron', route(async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (secret && String(req.headers.authorization || '') !== 'Bearer ' + secret) return res.status(401).json({ ok: false, error: 'Unauthorized.' });
    if (!secret && !req.headers['x-vercel-cron']) return res.status(401).json({ ok: false, error: 'Only the daily cron may call this.' });
    res.json({ ok: true, done: await service.daily() });
  }));

  return service;
}

module.exports = { mount, createStaffService };
