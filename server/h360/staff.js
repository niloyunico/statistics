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
const sweepPrefixes = () => Array.from({ length: 200 }, (_, i) => String(1000 + i));
const activeOf = (rows) => (rows || []).filter((r) => r && r.is_active !== false && !r.former);
const slim = (res) => ({ ...res, at: res.at || new Date().toISOString() });

// Run fn over items, CONCURRENCY at a time, until the list or the time runs out. Returns how many were taken.
async function pool(items, until, fn, stop = () => false, n = CONCURRENCY) {
  let next = 0;
  let begun = false;
  const worker = async () => {
    while (next < items.length && (!begun || Date.now() < until) && !stop()) {
      begun = true;
      const item = items[next++];
      await fn(item);
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
  async function search(d, term) {
    const text = String(term || '').trim();
    if (text.length < 3) return [];
    const key = text.toLowerCase();
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < SEARCH_CACHE_MS) return hit.rows;
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

  /* ---------- sweep: who is in H360 but not in our register ---------- */
  async function sweepStart(by) {
    const d = await db();
    const doc = (await settings.read(d, 'staffSweep')) || {};
    if (doc.run && doc.run.lockedAt && Date.now() - new Date(doc.run.lockedAt).getTime() < 75000) return publicRun(doc.run);
    const queue = sweepPrefixes();
    const run = { id: require('crypto').randomBytes(6).toString('hex'), startedAt: new Date().toISOString(), by: by || '', total: queue.length, queue, seen: 0, errors: 0, lockedAt: null };
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
    const register = await loadRegister();
    const keep = codesOf(register);
    const queue = run.queue.slice();
    const added = [];
    let seen = run.seen || 0, errors = run.errors || 0, fatal = null;
    const until = Date.now() + (budgetMs || STEP_MS);
    const answered = new Set();
    await pool(queue, until, async (prefix) => {
      try {
        const rows = await search(d, prefix);
        seen += rows.length;
        await remember(d, rows, keep, run.id);
        if (rows.length >= SPLIT_AT && prefix.length < 5) for (let k = 0; k < 10; k++) added.push(prefix + k);
        answered.add(prefix);
      } catch (err) {
        if (err.status === 409 || err.status === 503) { fatal = err.message; return; }
        errors++;
        answered.add(prefix);
      }
    }, () => Boolean(fatal));
    const rest = queue.filter((p) => !answered.has(p)).concat(added);
    if (rest.length) {
      await settings.write(d, 'staffSweep', { 'run.queue': rest, 'run.total': run.total + added.length, 'run.seen': seen, 'run.errors': errors, 'run.lockedAt': null, 'run.error': fatal });
      return { run: publicRun({ ...run, total: run.total + added.length, queue: rest, error: fatal }), last: doc.last || null };
    }
    // Finished. Nursing people this sweep did not meet are marked, never removed.
    const col = d.collection(COLL);
    if (!errors) await col.updateMany({ nursing: true, sweepId: { $ne: run.id }, goneSince: { $exists: false } }, { $set: { goneSince: new Date() } });
    const count = await col.countDocuments({ nursing: true, goneSince: { $exists: false } });
    const last = { finishedAt: new Date().toISOString(), startedAt: run.startedAt, by: run.by, nursing: count, searches: run.total, errors };
    await settings.write(d, 'staffSweep', { last }, { run: '' });
    return { run: null, last };
  }

  async function snapshot() {
    const d = await db();
    return d.collection(COLL).find({ goneSince: { $exists: false } }).toArray();
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

  return { signedInSince, sessionInfo, signOut, saved, options, setOptions, search, lookup, verifyOne, verifyStart, verifyStep, results, sweepStart, sweepStep, missing, info, daily, workbook, snapshot };
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
    res.json({ ...(await service.info()), canEdit: canEdit(req) });
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
