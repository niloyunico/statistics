/* How one of our staff records compares with H360's employee list (server/h360/staff.js).
 *
 * Pure: no database, no H360. Given our record and the people H360's Employee Search
 * returned, it says whether the employee ID really is this person and which fields differ.
 * Nothing here ever changes a record — the screens show the answer and a person decides.
 *
 * Statuses, worst first (STATUS_ORDER):
 *   id_other_person  our emp ID belongs to someone else in H360            red
 *   not_in_h360      our emp ID is not in H360 at all                       red
 *   duplicate_id     two of our active records share the emp ID /
 *                    one H360 person is matched by two of our records       red
 *   no_emp_id        we have no emp ID (H360's suggestion shown)            amber
 *   field_diff       right person, but some fields differ                   amber
 *   match            everything compared agrees                             green
 */

const STATUS_ORDER = ['id_other_person', 'not_in_h360', 'duplicate_id', 'no_emp_id', 'field_diff', 'match', 'error'];
const STATUS_LABEL = {
  id_other_person: 'Emp ID belongs to another person in H360',
  not_in_h360: 'Emp ID not found in H360',
  duplicate_id: 'Emp ID used twice',
  no_emp_id: 'No emp ID in our record',
  field_diff: 'Same person — some details differ',
  match: 'Matches H360',
  error: 'Could not check',
};
const STATUS_LEVEL = { id_other_person: 'red', not_in_h360: 'red', duplicate_id: 'red', no_emp_id: 'amber', field_diff: 'amber', match: 'green', error: 'grey' };
const worst = (a, b) => (STATUS_ORDER.indexOf(a) <= STATUS_ORDER.indexOf(b) ? a : b);

/* ---------- names ---------- */
// Honorifics and spellings that differ between the two systems without being a different name.
const DROP = new Set(['md', 'mst', 'most', 'mosammat', 'mosammad', 'mossammat', 'mosa', 'mohammad', 'mohammed', 'muhammad', 'mohd', 'sk', 'sheikh', 'shaikh', 'mrs', 'mr', 'miss', 'ms', 'dr']);
const SOUND = [[/ph/g, 'f'], [/z/g, 'j'], [/w/g, 'o'], [/ee/g, 'i'], [/oo/g, 'u'], [/th/g, 't'], [/kh/g, 'k'], [/gh/g, 'g'], [/sh/g, 's'], [/y/g, 'i'], [/(.)\1+/g, '$1']];
function nameTokens(name) {
  return String(name || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((t) => t && !DROP.has(t));
}
const sound = (token) => SOUND.reduce((t, [re, to]) => t.replace(re, to), token);

function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
const ratio = (a, b) => (!a && !b ? 1 : 1 - lev(a, b) / Math.max(a.length, b.length));

// Family names half the staff share: agreeing on "Akter" says little about being the same person.
const COMMON = new Set(['akter', 'aktar', 'akhter', 'akther', 'khatun', 'khatoon', 'begum', 'islam', 'hossain', 'hosen', 'hossen', 'hussain', 'rahman', 'sultana', 'khan', 'das', 'roy', 'sarkar', 'sorkar', 'mondal', 'mia', 'miah', 'uddin', 'ahmed', 'ahmad', 'nesa', 'nessa', 'jahan', 'parvin', 'parveen', 'bibi', 'chowdhury', 'biswas', 'haque', 'hoque', 'alam', 'kabir', 'rani', 'bala', 'kumar']
  .map(sound));
const weight = (t) => (COMMON.has(t) ? 0.3 : 1);
// A word counts as the same word only when it is spelt nearly the same ("Rina" is not "Runa").
const sameWord = (t, u) => { const r = ratio(t, u); return r >= 0.8 ? r : 0; };

// 0..1: how likely the two names are the same person's. Word by word (order and a
// missing middle name matter little), sound-alike spellings folded, common family
// names weighted down.
function nameScore(a, b) {
  const A = nameTokens(a).map(sound), B = nameTokens(b).map(sound);
  if (!A.length || !B.length) return 0;
  const side = (X, Y) => {
    let got = 0, of = 0;
    for (const t of X) { const w = weight(t); of += w; got += w * Math.max(...Y.map((u) => sameWord(t, u))); }
    return of ? got / of : 0;
  };
  const fromA = side(A, B), fromB = side(B, A);
  // The shorter name wholly inside the longer one ("Ashraf Ali" / "Md. Ashraf Ali Munna"),
  // provided it has a given name of its own, not just "Akter".
  const [short, long] = A.length <= B.length ? [A, B] : [B, A];
  const shortFits = short.some((t) => !COMMON.has(t)) && side(short, long) >= 0.9;
  return Math.max((fromA + fromB) / 2, shortFits ? 0.86 : 0);
}
const SAME_NAME = 0.84;     // the same name, perhaps spelt differently
const SIMILAR_NAME = 0.55;  // under this: a different person

/* ---------- other fields ---------- */
const phoneKeys = (value) => (Array.isArray(value) ? value : String(value || '').split(/[,/;]+/))
  .map((p) => String(p).replace(/\D/g, '')).filter((d) => d.length >= 10).map((d) => d.slice(-10));
const normGender = (g) => { const s = String(g || '').trim().toLowerCase(); return s.startsWith('f') ? 'Female' : s.startsWith('m') ? 'Male' : s ? 'Other' : ''; };
const words = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// "Nursing Services - MICU" -> "micu"; our "MICU" / "Medical ICU" compared loosely.
const deptCore = (s) => words(String(s || '').replace(/^\s*nursing\s+services?\s*[-–:]\s*/i, ''));
function deptAgrees(ours, theirs) {
  const a = deptCore(ours), b = deptCore(theirs);
  if (!a || !b) return null;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const ta = a.split(' '), tb = b.split(' ');
  return ta.some((t) => t.length >= 2 && tb.includes(t)) ? true : false;
}
const DESIG_KIND = (s) => {
  const w = words(s);
  if (!w) return '';
  if (/patient care|pca|care assistant|caregiver|care giver|aya|ward (boy|girl)/.test(w)) return 'pca';
  if (/trainee|intern/.test(w)) return 'trainee';
  if (/nurs|midwi|matron|sister|in ?charge|supervisor|cns|nm\b/.test(w)) return 'nurse';
  return w;
};
function desigAgrees(ours, theirs) {
  const a = words(ours), b = words(theirs);
  if (!a || !b) return null;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  return DESIG_KIND(a) === DESIG_KIND(b);
}
// Nursing Services people (nurses, PCAs, midwives …) — the ones the register should hold.
const isNursing = (row) => /nurs|patient care|pca|care assistant|midwi|ward (boy|girl)|aya\b/i.test(`${row.dept || ''} ${row.designation || ''}`);

/* ---------- one record ---------- */
// rec: our staff row. byId: H360 rows found for rec.emp_id. others: H360 rows found by the
// record's phone / name (to suggest the right ID when ours is missing or wrong).
function compareRecord(rec, byId, others) {
  const empId = String(rec.emp_id || '').trim();
  const exact = (byId || []).filter((r) => r.code === empId);
  const suggestions = suggest(rec, [...(others || []), ...(byId || [])], empId);
  const base = { id: rec.id, empId, name: rec.name || '', role: rec.role || '', dept: rec.current_department || '' };
  if (!empId) return { ...base, status: 'no_emp_id', h360: null, fields: [], suggestions };
  if (!exact.length) return { ...base, status: 'not_in_h360', h360: null, fields: [], suggestions };
  // Two H360 people with one code would be H360's own problem; the closer name is used.
  const h = exact.slice().sort((x, y) => nameScore(rec.name, y.name) - nameScore(rec.name, x.name))[0];
  const score = nameScore(rec.name, h.name);
  if (score < SIMILAR_NAME) {
    return { ...base, status: 'id_other_person', h360: h, nameScore: round(score), fields: fieldsOf(rec, h, score), suggestions: suggestions.filter((s) => s.code !== empId) };
  }
  const fields = fieldsOf(rec, h, score);
  const differs = fields.some((f) => f.ok === false);
  return { ...base, status: differs ? 'field_diff' : 'match', h360: h, nameScore: round(score), fields, suggestions: [] };
}
const round = (n) => Math.round(n * 100) / 100;

function fieldsOf(rec, h, score) {
  const out = [];
  const add = (key, label, ours, theirs, ok, copyable) => out.push({ key, label, ours: ours || '', h360: theirs || '', ok, copyable: Boolean(copyable) });
  add('name', 'Name', rec.name, h.name, score >= SAME_NAME, true);
  const ourPhones = phoneKeys(rec.phone), theirPhones = phoneKeys(h.phones);
  add('phone', 'Phone', rec.phone, (h.phones || []).join(', '), !ourPhones.length || !theirPhones.length ? null : ourPhones.some((p) => theirPhones.includes(p)), theirPhones.length > 0);
  const g1 = normGender(rec.gender), g2 = normGender(h.gender);
  add('gender', 'Gender', g1, g2, !g1 || !g2 ? null : g1 === g2, Boolean(g2));
  add('doj', 'Joining date', rec.doj, h.joinDate, !rec.doj || !h.joinDate ? null : String(rec.doj).slice(0, 10) === h.joinDate, Boolean(h.joinDate));
  add('designation', 'Designation', rec.designation, h.designation, desigAgrees(rec.designation, h.designation), Boolean(h.designation));
  add('current_department', 'Department', rec.current_department, h.dept, deptAgrees(rec.current_department, h.dept), false);
  return out;
}

// H360 people who may be this record: same phone, or a close name.
function suggest(rec, rows, notCode) {
  const phones = phoneKeys(rec.phone);
  const seen = new Set();
  const out = [];
  for (const r of rows || []) {
    if (!r || seen.has(r.code) || r.code === notCode) continue;
    seen.add(r.code);
    const phone = phones.length && phoneKeys(r.phones).some((p) => phones.includes(p));
    const score = nameScore(rec.name, r.name);
    if (phone || score >= SAME_NAME) out.push({ code: r.code, name: r.name, dept: r.dept, designation: r.designation, joinDate: r.joinDate, why: [phone && 'same phone', score >= SAME_NAME && 'same name'].filter(Boolean).join(' + '), score: round(score + (phone ? 1 : 0)) });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}

/* ---------- across the register ---------- */
// Marks duplicate_id on results whose emp ID two active records share, or whose H360
// person another active record also matched. results: compareRecord outputs.
function markDuplicates(results, register) {
  const active = (register || []).filter((r) => r && r.is_active !== false && !r.former);
  const byEmp = new Map();
  for (const r of active) {
    const id = String(r.emp_id || '').trim();
    if (id) byEmp.set(id, (byEmp.get(id) || []).concat(r.id));
  }
  const byPerson = new Map();
  for (const res of results) if (res.h360 && res.status !== 'id_other_person') byPerson.set(res.h360.code, (byPerson.get(res.h360.code) || []).concat(res.id));
  for (const res of results) {
    const shared = (byEmp.get(res.empId) || []).filter((id) => id !== res.id);
    const samePerson = res.h360 ? (byPerson.get(res.h360.code) || []).filter((id) => id !== res.id) : [];
    const others = [...new Set([...shared, ...samePerson])];
    if (others.length) {
      res.duplicateOf = others;
      res.status = worst(res.status, 'duplicate_id');
    }
  }
  return results;
}

// H360 Nursing Services people with no record in our register (active or Previous Staff).
function missingFromRegister(h360Rows, register) {
  const rows = (register || []).filter(Boolean);
  // One emp ID can sit on several of our rows (a Previous Staff copy, a duplicate): all are looked at.
  const byEmp = new Map();
  for (const r of rows) { const id = String(r.emp_id || '').trim(); if (id) byEmp.set(id, (byEmp.get(id) || []).concat(r)); }
  const phoneMap = new Map();
  for (const r of rows) for (const p of phoneKeys(r.phone)) phoneMap.set(p, r);
  const out = [];
  for (const h of h360Rows || []) {
    if (!isNursing(h)) continue;
    const holders = byEmp.get(h.code) || [];
    if (holders.some((r) => nameScore(r.name, h.name) >= SIMILAR_NAME)) continue;
    const viaId = holders[0] || null;
    const viaPhone = phoneKeys(h.phones).map((p) => phoneMap.get(p)).find(Boolean);
    const viaName = rows.map((r) => ({ r, s: nameScore(r.name, h.name) })).sort((a, b) => b.s - a.s)[0];
    const closest = viaPhone ? { r: viaPhone, why: 'same phone' } : viaName && viaName.s >= SAME_NAME ? { r: viaName.r, why: 'same name' } : null;
    out.push({
      ...h,
      ourMatch: closest ? { id: closest.r.id, name: closest.r.name, empId: closest.r.emp_id || '', former: Boolean(closest.r.former || closest.r.is_active === false), why: closest.why } : null,
      idClash: viaId ? { id: viaId.id, name: viaId.name } : null,
    });
  }
  // Truly absent first, then the ones we hold under another ID.
  return out.sort((a, b) => (a.ourMatch ? 1 : 0) - (b.ourMatch ? 1 : 0) || String(b.code).localeCompare(String(a.code)));
}

function summary(results) {
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0]));
  for (const r of results || []) counts[r.status] = (counts[r.status] || 0) + 1;
  return counts;
}

module.exports = {
  STATUS_ORDER, STATUS_LABEL, STATUS_LEVEL, SAME_NAME, SIMILAR_NAME,
  nameScore, nameTokens, phoneKeys, normGender, deptAgrees, desigAgrees, isNursing,
  compareRecord, markDuplicates, missingFromRegister, summary, worst,
};
