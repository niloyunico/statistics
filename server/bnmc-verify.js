/* BNMC REGISTRATION VERIFICATION — live lookup against the Bangladesh Nursing and
 * Midwifery Council's public register (https://bncdb.bnmc.gov.bd/verify/).
 *
 * WHY THIS IS A SERVER ROUTE AND NOT A BROWSER FETCH
 * Three separate reasons, any one of which is fatal to calling BNMC from the page:
 *   1. It is a cross-origin POST and their server sends no CORS headers.
 *   2. The form is Django-CSRF protected — you must GET the page first, keep the
 *      session cookie, and echo the `csrfmiddlewaretoken` back. A browser cannot read
 *      either off a cross-origin response.
 *   3. The portrait is served over plain http://, which a page on the https Vercel
 *      deployment refuses to load as mixed content. /api/bnmc/photo re-serves it.
 *
 * ===================================================================
 * THE THING THAT SHAPES THIS WHOLE FILE: NUMBERS ARE NOT UNIQUE
 * ===================================================================
 * A BNMC registration number identifies a registration, NOT a person, and the number
 * series restarts per course. Measured on the live register, 2026-09-06:
 *
 *     number 7749 → Chelcia Bani Baroi  under B. Sc in Nursing (4 Year)
 *                 → Nilima Mondol       under Diploma in Midwifery (1 Year)
 *                 → OPI AKTER           under Diploma in Midwifery (3 Year)
 *                 → Aklima Khatun       under Diploma in Nursing (3 Year)
 *
 * Four different people, one number. So "search every course until something matches"
 * would cheerfully staple a stranger's registration onto a staff file. detect() below
 * therefore returns EVERY match and never picks one — choosing is the operator's job,
 * and the UI makes them do it whenever more than one comes back.
 *
 * The same fact bites inside a single result: a person's table lists ALL of their
 * registrations, with DIFFERENT numbers (Aklima Khatun holds 6292, 6592 and 7749). The
 * row that matters is the one whose number was searched for — see primaryOf().
 *
 * WHAT WE ASK FOR AND WHAT COMES BACK
 * POST verify/ with {csrfmiddlewaretoken, number, program}. `program` is the numeric
 * course id and is REQUIRED — posting 0 ("Select Registration Type") makes their
 * server answer 500. A hit renders a profile block plus a <table> of registrations; a
 * miss renders "no registration information not found" and NO table.
 *
 * BEING A GOOD CITIZEN
 * A public page, no API, no published quota — so their server is treated as scarce.
 * One CSRF session is reused for a whole sweep (verified: the cookie stays valid for
 * many POSTs), every answer is cached, identical in-flight lookups share one call, and
 * requests are paced. A sweep also runs the courses implied by the staff member's
 * recorded education FIRST and stops there when it finds something, so the common case
 * costs one or two requests rather than thirty-nine.
 *
 * THE ANSWER IS A SNAPSHOT, NOT A LIVE FEED
 * The renderer stores what came back onto the staff record (licence_verified). BNMC is
 * often slow and sometimes down, and a staff file must still show what the council
 * said, and when, on a day their site is unreachable.
 */
const express = require('express');
const activity = require('./activity-log');
const redis = require('./redis');
const access = require('./access');
const { getDbHandle } = require('./db');
const cache = require('./cache');

const BASE = 'https://bncdb.bnmc.gov.bd/verify/';
const HOST = 'bncdb.bnmc.gov.bd';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
/* TIMEOUTS ARE SIZED FOR A SERVERLESS FUNCTION, NOT A PATIENT LOCAL SERVER.
   On Vercel a @vercel/node function is killed at 10s (Hobby default), and vercel.json
   uses the legacy `builds` config so there is no maxDuration to raise. Every budget
   below is therefore chosen so the WORST case — the remaining budget, plus one more
   upstream request that runs to its full timeout — still lands under that ceiling:
       one-off verify : session GET + POST, 2 x 9s worst case, and the UI shows the
                        "BNMC did not respond in time" message if it really is that slow
       sweep batch    : 3.5s budget + one 6s request = 9.5s, then the cursor comes back
   Measured reality is ~500ms for the session GET and 100-250ms per POST, so these
   ceilings are only ever reached when BNMC is genuinely unwell. */
const TIMEOUT_MS = 9000;                   // one-off lookups (session GET + single POST)
const SWEEP_REQ_MS = 6000;                 // a single POST inside a sweep
const MIN_GAP_MS = 700;                    // floor between two one-off lookups
const SWEEP_GAP_MS = 120;                  // inside one sweep, where the session is already open
const SWEEP_BUDGET_MS = 3500;              // stop starting new requests past this
const SWEEP_MAX_BATCH = 12;                // …and never more than this many courses per request
const TTL_HIT_MS = 7 * 24 * 3600 * 1000;   // a found record barely ever changes
const TTL_MISS_MS = 60 * 60 * 1000;        // a miss might just be the wrong course
const CACHE_VER = 'v2';                    // v1 lacked `primary`

// ---------------------------------------------------------------- html helpers
const decodeEntities = (s) => String(s || '')
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&');

// Strip tags to plain text. The exam-date cell wraps its value in <p>, and several
// cells carry stray newlines, so collapse whitespace rather than trust the markup.
const text = (html) => decodeEntities(String(html || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------- pacing
let lastCallAt = 0;
async function pace(gap) {
  const wait = lastCallAt + (gap == null ? MIN_GAP_MS : gap) - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

// fetch() with a hard deadline. Named `hit` because every caller below is an Express
// handler that already owns the name `req`.
async function hit(url, init, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs || TIMEOUT_MS);
  try {
    return await fetch(url, Object.assign({ signal: ctl.signal, redirect: 'follow' }, init));
  } finally { clearTimeout(timer); }
}

// One GET to obtain the CSRF token and the session cookie that token is bound to. Both
// halves are required: Django rejects a token presented without its cookie. The
// returned session is reusable — a whole sweep runs on one of these.
async function openSession(gap, timeoutMs) {
  await pace(gap);
  const r = await hit(BASE, { headers: { 'User-Agent': UA, Accept: 'text/html' } }, timeoutMs);
  if (!r.ok) throw new Error('BNMC returned HTTP ' + r.status);
  const html = await r.text();
  const m = html.match(/name=['"]csrfmiddlewaretoken['"]\s+value=['"]([^'"]+)/);
  if (!m) throw new Error('BNMC changed its form — no CSRF token found.');
  // getSetCookie() keeps multiple Set-Cookie headers separate; the folded-header
  // fallback is for runtimes that do not expose it.
  const jar = (typeof r.headers.getSetCookie === 'function'
    ? r.headers.getSetCookie()
    : [r.headers.get('set-cookie') || ''])
    .filter(Boolean).map((c) => String(c).split(';')[0]).join('; ');
  return { token: m[1], cookie: jar, html };
}

// ------------------------------------------------------------------ the parser
// A registration row. `exam` is deliberately a STRING: that column holds a date for
// some registrants and the literal word "Passed" for others (reg 7749), so parsing it
// as a date would silently blank it.
function parseRows(html) {
  const table = String(html || '').match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!table) return [];
  const rows = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let tr;
  while ((tr = trRe.exec(table[1]))) {
    const cells = [];
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let td;
    while ((td = tdRe.exec(tr[1]))) cells.push(text(td[1]));
    if (cells.length < 8) continue;            // the <th> header row has no <td>
    rows.push({
      regNo: cells[0], course: cells[1], institution: cells[2], exam: cells[3],
      registered: cells[4], renewIssued: cells[5], renewUpto: cells[6], status: cells[7],
      // Their markup colours an expired row red inline; keep the machine-readable form
      // so the UI badge never has to string-match a human label.
      expired: /expired/i.test(cells[7]),
    });
  }
  return rows;
}

function parsePerson(html) {
  const block = String(html || '').match(/<div class="profile-info">([\s\S]*?)<\/div>/i);
  const b = block ? block[1] : '';
  const pick = (re) => { const m = b.match(re); return m ? text(m[1]) : ''; };
  const img = String(html || '').match(/<img[^>]+alt=["']Profile Picture["'][^>]*>/i);
  const src = img ? ((img[0].match(/src=["']([^"']+)["']/i) || [])[1] || '') : '';
  return {
    name: pick(/<h2[^>]*>([\s\S]*?)<\/h2>/i),
    father: pick(/Father's Name:\s*([\s\S]*?)<\/p>/i),
    mother: pick(/Mother's Name:\s*([\s\S]*?)<\/p>/i),
    address: pick(/Address:\s*([\s\S]*?)<\/p>/i),
    // These two wrap the LABEL inside <strong>, so the label is stripped after the
    // capture rather than excluded by it.
    workplace: pick(/Working Place:<\/strong>\s*([\s\S]*?)<\/p>/i),
    position: pick(/<p><strong>Position:\s*([\s\S]*?)<\/strong>/i),
    // BNMC emits a doubled slash (…gov.bd//media/…). Harmless to them, normalised here
    // so the proxied url is stable.
    photo: src ? src.replace(/([^:])\/\/+/g, '$1/') : '',
  };
}

// THE row this lookup is about: the one carrying the number that was searched for. A
// person's table lists every registration they hold, under different numbers, so
// picking "the newest" or "the one that renews longest" can describe a different
// qualification than the licence being verified. Falls back to the longest-renewing
// row only if the searched number somehow is not in the table.
function primaryOf(rows, number) {
  const n = String(number || '').replace(/^0+/, '');
  const exact = rows.find((r) => String(r.regNo || '').replace(/^0+/, '') === n);
  if (exact) return exact;
  return rows.slice().sort((a, b) => String(b.renewUpto || '').localeCompare(String(a.renewUpto || '')))[0] || null;
}

// The council's own wording for a miss. Checked as well as "no table", because an
// empty table would otherwise read as a silent success.
const NOT_FOUND_RE = /no registration information not found/i;

function parseResult(html, number) {
  const rows = parseRows(html);
  if (!rows.length || NOT_FOUND_RE.test(String(html || ''))) return { found: false };
  return { found: true, person: parsePerson(html), registrations: rows, primary: primaryOf(rows, number) };
}

// ------------------------------------------------------------ upstream lookup
async function postLookup(session, number, program, gap, timeoutMs) {
  await pace(gap);
  const r = await hit(BASE, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'text/html',
      Referer: BASE,
      Origin: 'https://' + HOST,
      Cookie: session.cookie,
    },
    body: new URLSearchParams({
      csrfmiddlewaretoken: session.token, number: String(number), program: String(program),
    }),
  }, timeoutMs);
  // 500 is exactly what BNMC answers for program=0. The UI prevents that, so name the
  // offending input instead of reporting a generic upstream failure.
  if (r.status === 500) throw new Error('BNMC rejected the request — pick a registration type.');
  if (!r.ok) throw new Error('BNMC returned HTTP ' + r.status);
  return parseResult(await r.text(), number);
}

const keyOf = (number, program) => 'unico:bnmc:' + CACHE_VER + ':' + program + ':' + number;

async function readCache(number, program) {
  try {
    const raw = await redis.get(keyOf(number, program));
    if (raw) { const v = JSON.parse(raw); v.cached = true; return v; }
  } catch (e) { /* the cache is an optimisation; a miss must never fail the lookup */ }
  return null;
}

async function writeCache(out) {
  try {
    await redis.set(keyOf(out.number, out.program), JSON.stringify(out),
      { px: out.found ? TTL_HIT_MS : TTL_MISS_MS });
  } catch (e) { /* not being cacheable is not a failure */ }
}

// Identical concurrent lookups (two people opening the same nurse, or a double-click)
// collapse onto one upstream call.
const inflight = new Map();

async function lookup(number, program, opts) {
  const o = opts || {};
  if (!o.fresh) { const c = await readCache(number, program); if (c) return c; }
  const key = keyOf(number, program);
  if (!o.session && inflight.has(key)) return inflight.get(key);
  const run = (async () => {
    const session = o.session || await openSession(o.gap, o.timeoutMs);
    const out = await postLookup(session, number, program, o.gap, o.timeoutMs);
    out.number = String(number);
    out.program = String(program);
    out.fetchedAt = new Date().toISOString();
    out.cached = false;
    await writeCache(out);
    return out;
  })();
  if (o.session) return run;                 // sweeps manage their own sequencing
  inflight.set(key, run);
  run.catch(() => {}).then(() => inflight.delete(key));
  return run;
}

// -------------------------------------------------------------- program list
// The course dropdown, scraped from the live form so a course BNMC adds appears
// without a code change. PROGRAMS_FALLBACK is what the UI gets when their site is down
// — captured 2026-09-06; the ids are stable primary keys, not positions.
const PROGRAMS_FALLBACK = [
  { id: '1', name: 'Diploma in Nursing Science and Midwifery (3 Year)' },
  { id: '2', name: 'Community Based Skilled Birth Attendants' },
  { id: '3', name: 'Diploma in Pediatric Nursing' },
  { id: '4', name: 'B. Sc in Nursing (4 Year)' },
  { id: '5', name: 'Family Welfare Visitors' },
  { id: '6', name: 'Community Paramedic' },
  { id: '7', name: 'B. Sc in Public Health Nursing-Post Basic' },
  { id: '8', name: 'Junior Midwifery' },
  { id: '9', name: 'Diploma in Midwifery (3 Year)' },
  { id: '10', name: 'B. Sc in Nursing (Post Basic)' },
  { id: '11', name: 'Diploma in Cardiac Nursing' },
  { id: '12', name: 'Master of Science in Nursing (Nursing Management)' },
  { id: '13', name: 'Master of Science in Nursing (Adult and Elderly Health Nursing)' },
  { id: '14', name: 'Master of Science in Nursing (Women’s Health and Midwifery Nursing)' },
  { id: '15', name: 'Master of Science in Nursing (Child Health Nursing)' },
  { id: '16', name: 'Master of Science in Nursing (Community Health Nursing)' },
  { id: '17', name: 'Master of Science in Nursing (Mental Health and Psychiatric Nursing)' },
  { id: '18', name: 'Diploma in Nursing (3 Year)' },
  { id: '19', name: 'Diploma in Midwifery (1 Year)' },
  { id: '20', name: 'Diploma in Nursing Science and Orthopeadic Nursing' },
  { id: '21', name: 'Diploma in Orthopeadic Nursing (1 Year)' },
  { id: '22', name: 'Diploma in Nursing Science and Midwifery (4 Year)' },
  { id: '23', name: 'Assistant Nurse' },
  { id: '25', name: 'Diploma in Rehabilitation Nursing' },
  { id: '26', name: 'Diploma in Intensive Care Nursing' },
  { id: '27', name: 'Diploma in Midwifery (14 Months)' },
  { id: '28', name: 'Senior Certificate in Nursing' },
  { id: '29', name: 'Diploma in Psychiatric Nursing' },
  { id: '30', name: 'Senior Certificate in Midwifery' },
  { id: '31', name: 'Diploma in Ophthalmic Nursing' },
  { id: '32', name: 'Diploma in Chest Disease Nursing' },
  { id: '33', name: 'Diploma in Renal Nursing (1 Year)' },
  { id: '34', name: 'Diploma in Critical Care Nursing' },
  { id: '35', name: 'Diploma in Trauma Nursing' },
  { id: '36', name: 'Diploma in Oncology Nursing' },
  { id: '37', name: 'Bachelor of Science in Midwifery (Post Basic)' },
  { id: '38', name: 'Diploma in Patient Care Technology-3 Year (Equivalent of Diploma in Nursing Science and Midwifery)' },
  { id: '39', name: 'Diploma in Nursing Technology-4 Year (Equivalent of Diploma in Nursing Science and Midwifery)' },
  { id: '40', name: 'Master of Science in Nursing (Nursing Education)' },
];

function parsePrograms(html) {
  const sel = String(html || '').match(/<select[^>]*name="program"[\s\S]*?<\/select>/i);
  if (!sel) return [];
  const out = [];
  const re = /<option value="(\d+)"[^>]*>([\s\S]*?)<\/option>/gi;
  let m;
  while ((m = re.exec(sel[0]))) {
    if (m[1] === '0') continue;                    // "Select Registration Type"
    const name = text(m[2]);
    if (!name || name === 'N/A') continue;         // id 24 is a placeholder row
    out.push({ id: m[1], name });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

let programCache = null;    // { at, list }
async function programs(session) {
  if (programCache && Date.now() - programCache.at < 24 * 3600 * 1000) return programCache.list;
  try {
    const s = session || await openSession();
    const list = parsePrograms(s.html);
    if (list.length) { programCache = { at: Date.now(), list }; return list; }
  } catch (e) { /* fall through to the baked-in list */ }
  return PROGRAMS_FALLBACK.slice().sort((a, b) => a.name.localeCompare(b.name));
}

// ------------------------------------------- education -> candidate courses
// The staff record's Qualification field is a comma-separated multi-select of the
// app's own chip names ("Diploma in Nursing, B.Sc in Nursing"). Each maps to one or
// more BNMC courses, matched here by pattern rather than by an exhaustive name table,
// so a course BNMC renames or adds still lands in the right bucket.
const EDU_RULES = [
  { when: /public health/i, want: [/public health nursing/i] },
  { when: /post\s*basic/i, want: [/post basic/i] },
  { when: /b\.?\s*sc/i, want: [/^b\.?\s*sc in nursing \(4 year\)/i, /^b\.?\s*sc in nursing \(post basic\)/i] },
  { when: /m\.?\s*sc|master|m\.?phil|ph\.?d/i, want: [/^master of science in nursing/i] },
  { when: /midwifery/i, want: [/^diploma in midwifery/i, /nursing science and midwifery/i, /^bachelor of science in midwifery/i] },
  { when: /renal/i, want: [/renal/i] },
  { when: /cardiac/i, want: [/cardiac/i] },
  { when: /critical care|intensive care/i, want: [/critical care/i, /intensive care/i] },
  { when: /orthop/i, want: [/orthop/i] },
  { when: /psychiatric|mental health/i, want: [/psychiatric/i, /mental health/i] },
  { when: /paediatric|pediatric|child/i, want: [/pediatric/i, /child health/i] },
  { when: /oncology/i, want: [/oncology/i] },
  { when: /community/i, want: [/community/i] },
  { when: /trauma/i, want: [/trauma/i] },
  { when: /ophthalmic/i, want: [/ophthalmic/i] },
  { when: /anaesthesia|operating room|\bot\b/i, want: [/intensive care/i] },
  // Plain "Diploma in Nursing" is the ambiguous one — BD nurses hold it under three
  // different council course names, so all three are candidates.
  { when: /diploma in nursing/i, want: [/nursing science and midwifery \(3 year\)/i, /^diploma in nursing \(3 year\)/i, /nursing science and midwifery \(4 year\)/i] },
];

// What to try when the education field says nothing useful: the courses the great
// majority of Bangladeshi hospital nurses are actually registered under, most common
// first, so a blind search usually still finishes in one or two requests.
const COMMON_FIRST = [
  /nursing science and midwifery \(3 year\)/i,
  /^diploma in nursing \(3 year\)/i,
  /^b\.?\s*sc in nursing \(4 year\)/i,
  /^b\.?\s*sc in nursing \(post basic\)/i,
  /^diploma in midwifery \(3 year\)/i,
  /nursing science and midwifery \(4 year\)/i,
];

// Program ids implied by an education string, in the order they should be tried.
function programsForEducation(hint, list) {
  const chips = String(hint || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!chips.length) return [];
  const ids = [];
  const push = (p) => { if (p && ids.indexOf(p.id) < 0) ids.push(p.id); };
  chips.forEach((chip) => {
    EDU_RULES.forEach((rule) => {
      if (!rule.when.test(chip)) return;
      rule.want.forEach((re) => list.filter((p) => re.test(p.name)).forEach(push));
    });
  });
  return ids;
}

// Full try-order: education first, then the common courses, then everything else.
function candidateOrder(hint, list) {
  const edu = programsForEducation(hint, list);
  const ids = edu.slice();
  const push = (id) => { if (ids.indexOf(id) < 0) ids.push(id); };
  COMMON_FIRST.forEach((re) => list.filter((p) => re.test(p.name)).forEach((p) => push(p.id)));
  list.forEach((p) => push(p.id));
  return { order: ids, eduIds: edu };
}

// ---------------------------------------------------------------- the sweep
/* Try candidate courses one after another on a single CSRF session and return EVERY
 * match — never a single "best" one, for the reason in the file header.
 *
 * Batched on purpose: the caller gets back `next`, and calls again to continue. A full
 * 39-course sweep takes ~3-8s against BNMC, which is uncomfortably close to a
 * serverless timeout, so each request stops at SWEEP_BUDGET_MS or SWEEP_MAX_BATCH and
 * hands the cursor back. It also lets the UI show progress and matches as they land
 * instead of freezing on one long request.
 */
async function detect(number, opts) {
  const o = opts || {};
  const list = await programs();
  const byId = {};
  list.forEach((p) => { byId[p.id] = p.name; });
  const { order, eduIds } = candidateOrder(o.hint, list);
  // scope 'edu' checks only what the recorded education implies; 'all' walks the lot.
  const ids = o.scope === 'edu' ? eduIds : order;
  const from = Math.max(0, parseInt(o.from, 10) || 0);
  const started = Date.now();
  const matches = [];
  let i = from;
  let session = null;

  while (i < ids.length) {
    const program = ids[i];
    let out = await readCache(number, program);
    if (!out) {
      if (!session) session = await openSession(SWEEP_GAP_MS, SWEEP_REQ_MS);
      out = await lookup(number, program, { session, gap: SWEEP_GAP_MS, timeoutMs: SWEEP_REQ_MS });
    }
    i++;
    if (out.found) {
      matches.push({
        program, programName: byId[program] || '',
        fromEducation: eduIds.indexOf(program) >= 0,
        person: out.person, registrations: out.registrations, primary: out.primary,
        fetchedAt: out.fetchedAt || null,
      });
    }
    // Budget applies only to work we actually sent upstream; a run of cache hits should
    // not be cut short.
    if (i < ids.length && (i - from >= SWEEP_MAX_BATCH || (session && Date.now() - started > SWEEP_BUDGET_MS))) break;
  }

  return {
    number: String(number), scope: o.scope === 'edu' ? 'edu' : 'all',
    matches, tried: i - from, from, next: i < ids.length ? i : null,
    total: ids.length, eduCount: eduIds.length,
    eduCourses: eduIds.map((id) => byId[id]).filter(Boolean),
  };
}

/* ------------------------------------------- storing a verification for good ---
 * WHERE A VERIFICATION LIVES, AND WHY IT IS NOT THE OVERLAY
 * The rest of a staff record travels in the `unico_staff_v3` app-state blob: the
 * browser holds it in localStorage and mirrors the whole array back with PUT /api/data.
 * That is fine for fields a person retypes if they go missing. It is NOT fine for a
 * verification — that is evidence, obtained once from an outside authority, and a
 * cleared browser or an unlucky hydration must never be able to erase it.
 *
 * So the snapshot is written straight onto the staff document in MongoDB, through
 * getDbHandle() so the read cache is invalidated fleet-wide. It rides back to every
 * browser inside __UNICO_STAFF__ and is merged OVER the overlay copy client-side, which
 * means the overlay can neither mask it nor lose it.
 *
 * Note the cache TTLs at the top of this file are about not re-asking BNMC for the same
 * number within a week. They have nothing to do with how long a verification is kept:
 * what is stored here is kept until someone verifies that licence again.
 */
async function storeVerification(staffId, empId, payload) {
  const h = await getDbHandle();
  const dbh = h && h.db ? h.db : h;
  if (!dbh) throw new Error('Database not available.');
  // By record id only — see staffIdFilter: emp ids are shared by different people, and
  // a verification written onto the wrong nurse is worse than one kept only on the row.
  const filter = require('./staff-roster').staffIdFilter(staffId);
  if (!filter && !empId) throw new Error('No staff member identified.');
  if (!filter) return false;
  const set = { licence_verified: payload.verification };
  if (payload.licence_no) set.licence_no = String(payload.licence_no);
  if (payload.licence_program) set.licence_program = String(payload.licence_program);
  if (payload.licence_expiry) set.licence_expiry = String(payload.licence_expiry);
  const r = await dbh.collection('staff').updateOne(filter, { $set: set });
  // Same reason as server/photos.js: a verification the cached roster does not carry
  // never reaches the browser, and the client merge cannot restore what it is not sent.
  try { await cache.bump('staff'); } catch (e) { /* best effort */ }
  return r.matchedCount > 0;
}

// -------------------------------------------------------------------- routes
function mount(app, opts) {
  const requireApi = (opts && opts.requireApi) || ((req, res, next) => { req.user = null; next(); });

  const numOk = (n) => /^\d{1,12}$/.test(n);
  const fail = (res, e) => {
    const msg = String((e && e.message) || 'Lookup failed.');
    // A timeout is BNMC being slow, not a bad request — 504 lets the UI say "try
    // again" rather than "no such registration".
    const gateway = /abort|timeout|fetch failed|ENOTFOUND|ECONNRESET|HTTP 5/i.test(msg);
    res.status(gateway ? 504 : 502).json({
      ok: false,
      error: gateway ? 'BNMC did not respond in time. Try again in a moment.' : msg,
    });
  };

  // The course dropdown, for the manual override.
  app.get('/api/bnmc/programs', requireApi, async (req, res) => {
    try { res.json({ ok: true, programs: await programs() }); }
    catch (e) { res.json({ ok: true, programs: PROGRAMS_FALLBACK }); }
  });

  // Live detection: number + the staff member's recorded education, no course picked.
  // Returns all matching people, which the UI makes the operator choose between.
  app.get('/api/bnmc/detect', requireApi, async (req, res) => {
    const number = String(req.query.number || '').trim();
    if (!numOk(number)) return res.status(400).json({ ok: false, error: 'Enter the BNMC registration number (digits only).' });
    try {
      const out = await detect(number, {
        hint: String(req.query.hint || ''),
        scope: req.query.scope === 'edu' ? 'edu' : 'all',
        from: req.query.from,
      });
      // Only log the end of a sweep, or it writes one row per batch.
      if (out.next == null) {
        activity.record(Object.assign({}, activity.actorOf(req), {
          action: 'bnmc_verify', ip: activity.ipOf(req),
          detail: number + ' (' + out.scope + ' sweep) -> ' + out.matches.length + ' match(es)',
        }));
      }
      res.json(Object.assign({ ok: true }, out));
    } catch (e) { fail(res, e); }
  });

  // Single-course lookup, for the manual override and for re-checking.
  app.get('/api/bnmc/verify', requireApi, async (req, res) => {
    const number = String(req.query.number || '').trim();
    const program = String(req.query.program || '').trim();
    if (!numOk(number)) return res.status(400).json({ ok: false, error: 'Enter the BNMC registration number (digits only).' });
    if (!/^[1-9]\d*$/.test(program)) return res.status(400).json({ ok: false, error: 'Choose the registration type — BNMC will not search without one.' });
    try {
      const out = await lookup(number, program, { fresh: req.query.fresh === '1' });
      activity.record(Object.assign({}, activity.actorOf(req), {
        action: 'bnmc_verify', ip: activity.ipOf(req),
        detail: number + ' / program ' + program + ' -> ' + (out.found ? 'found' : 'not found'),
      }));
      res.json(Object.assign({ ok: true }, out));
    } catch (e) { fail(res, e); }
  });

  /* Persist a verification onto the staff record itself. Needs EDIT on staff: this
     writes to a personnel file, unlike the lookups above which only read a public
     register. */
  app.post('/api/bnmc/record', requireApi, express.json({ limit: '1mb' }), async (req, res) => {
    try {
      const a = await access.forRequest(req);
      if (!a) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
      if (!a.unrestricted && !access.can(a, 'staff', 'edit')) {
        return res.status(403).json({ ok: false, error: 'You do not have permission to edit staff records.' });
      }
      const b = req.body || {};
      if (!b.verification || typeof b.verification !== 'object') {
        return res.status(400).json({ ok: false, error: 'Nothing to store.' });
      }
      const saved = await storeVerification(b.staffId, b.empId, b);
      if (!saved) return res.status(404).json({ ok: false, error: 'That staff member is not in the register yet — save the record first.' });
      activity.record(Object.assign({}, activity.actorOf(req), {
        action: 'bnmc_verify', ip: activity.ipOf(req),
        detail: 'stored verification for staff ' + (b.empId || b.staffId) + ' (reg ' + (b.licence_no || '?') + ')',
      }));
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: String((e && e.message) || 'Could not store the verification.') });
    }
  });

  // Portrait proxy. BNMC serves photos over plain http, which the https app cannot
  // embed. The host is pinned so this parameter can never be aimed at an internal
  // address, and only image content types are passed back.
  app.get('/api/bnmc/photo', requireApi, async (req, res) => {
    let u;
    try { u = new URL(String(req.query.u || '')); } catch (e) { return res.status(400).end(); }
    if (u.hostname !== HOST) return res.status(403).end();
    try {
      await pace();
      const r = await hit(u.href, { headers: { 'User-Agent': UA, Referer: BASE } });
      if (!r.ok) return res.status(502).end();
      const type = r.headers.get('content-type') || 'image/jpeg';
      if (!/^image\//i.test(type)) return res.status(415).end();
      res.set('Content-Type', type);
      res.set('Cache-Control', 'public, max-age=86400');
      res.end(Buffer.from(await r.arrayBuffer()));
    } catch (e) { res.status(504).end(); }
  });
}

module.exports = {
  mount, lookup, detect, programs, storeVerification,
  parseResult, parseRows, parsePerson, parsePrograms, primaryOf,
  programsForEducation, candidateOrder, PROGRAMS_FALLBACK,
};
