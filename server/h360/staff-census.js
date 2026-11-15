/* H360 Nursing Census (Staff Management → H360 Check → Census), the counting rules.
 *
 * Pure: no database, no H360. Given what H360's Employee Search said about Nursing Services
 * people (h360Employees rows) and our register, it counts both sides by group, pairs people
 * by employee code, and lists every mismatch for a person to look at. Nothing is changed.
 *
 *   groups     Manager · In-charge / Team Leader · Nurse · Trainee · PCA · Other — sorted from the
 *              designation text by GROUP_RULES; an administrator can move any designation
 *              (overrides, by the designation's text) and the same groups apply to both sides.
 *   pairing    our ACTIVE record with the same emp ID and a name that is at least similar
 *              (staff-match.compareRecord) — the one rule Bulk Verify uses.
 *   birth date H360's search gives the AGE in whole years only, never the date of birth. Our date
 *              of birth is compared with it (more than one year apart is listed) and, where we
 *              have none, the likely birth year is shown. A date of birth is never made from an age.
 *   department ours is assigned by us; H360's unit is shown and counted, never a mismatch.
 */
const match = require('./staff-match');

const GROUPS = [
  { id: 'manager', label: 'Manager' },
  { id: 'incharge', label: 'In-charge / Team Leader' },
  { id: 'nurse', label: 'Nurse' },
  { id: 'trainee', label: 'Trainee' },
  { id: 'pca', label: 'PCA' },
  { id: 'other', label: 'Other' },
];
const GROUP_IDS = GROUPS.map((g) => g.id);
const LEADERS = new Set(['manager', 'incharge']);

// First rule that fits wins ("Trainee Staff Nurse" is a trainee, "OT Incharge Nurse" an in-charge).
const GROUP_RULES = [
  ['other', /instructor|educator|infection\s*control|coordinator|clinical\s*teacher/],
  ['manager', /manager|matron|director|superintend|\bdns\b|\bcns\b|chief\s*nurs/],
  ['incharge', /in\s*-?\s*charge|team\s*leader|charge\s*nurse|supervisor|ward\s*sister|\bshift\s*lead/],
  ['trainee', /trainee|intern\b|internee|probation/],
  ['pca', /\bpca\b|patient\s*care|care\s*(assistant|attendant|giver)|caregiver|attendant|\baya\b|ward\s*(boy|girl)/],
  ['nurse', /nurs|satff|midwi|sister|\bsn\b/],
];
const desigKey = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

// The designation's group by the rules alone ('' when no rule fits).
function ruleGroup(designation) {
  const s = desigKey(designation);
  if (!s) return '';
  for (const [g, re] of GROUP_RULES) if (re.test(s)) return g;
  return '';
}
// The group of a designation: an administrator's choice first, then the rules, else Other.
function groupOf(designation, overrides) {
  const own = overrides && overrides[desigKey(designation)];
  if (own && GROUP_IDS.includes(own)) return own;
  return ruleGroup(designation) || 'other';
}
// Our record: its designation; when that says nothing, its role (PCA / Nurse).
function ourGroupOf(rec, overrides) {
  const own = overrides && overrides[desigKey(rec && rec.designation)];
  if (own && GROUP_IDS.includes(own)) return own;
  const g = ruleGroup(rec && rec.designation);
  if (g) return g;
  const role = String((rec && rec.role) || '').toLowerCase();
  return role === 'pca' ? 'pca' : role === 'nurse' ? 'nurse' : 'other';
}

/* ---------- age / birth date ---------- */
const DAY = 86400000;
function ageOn(dob, on) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dob || ''));
  if (!m) return null;
  const d = new Date(on || Date.now());
  let age = d.getUTCFullYear() - Number(m[1]);
  const md = (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  if (md < Number(m[2]) * 100 + Number(m[3])) age--;
  return age >= 0 && age < 120 ? age : null;
}
const h360Age = (h) => { const n = parseInt(String((h && h.age) || ''), 10); return Number.isFinite(n) && n > 0 && n < 120 ? n : null; };
// "born about 1988–89": an age in whole years on a day fits two calendar years.
function bornAbout(age, on) {
  if (age == null) return null;
  const y = new Date(on || Date.now()).getUTCFullYear();
  return { from: y - age - 1, to: y - age, text: `${y - age - 1}–${String(y - age).slice(-2)}` };
}

/* ---------- shapes sent to the screen ---------- */
const hOut = (h, overrides) => h && ({
  code: h.code, name: h.name || '', designation: h.designation || '', dept: h.dept || '', joinDate: h.joinDate || '',
  phones: h.phones || [], gender: h.gender || '', age: h.age || '', marital: h.marital || '', service: h.service || '',
  group: groupOf(h.designation, overrides), lastSeenAt: h.lastSeenAt || null, goneSince: h.goneSince || null,
});
const rOut = (r, overrides) => r && ({
  id: r.id, name: r.name || '', empId: String(r.emp_id || '').trim(), designation: r.designation || '', role: r.role || '',
  dept: r.current_department || '', doj: r.doj || '', dob: r.dob || '', phone: r.phone || '', gender: r.gender || '',
  former: Boolean(r.former || r.is_active === false), group: ourGroupOf(r, overrides),
});

const isActive = (r) => r && r.is_active !== false && !r.former;
const nursingRow = (h) => h && (h.nursing === true || (h.nursing == null && match.isNursing(h)));

/* ---------- the census ----------
   h360Rows: h360Employees documents (Nursing Services people, and our codes elsewhere in the
   hospital; `goneSince` = a full sweep no longer met them). register: our rows (active and
   Previous Staff). outside: { [recordId]: compareRecord result } — what H360 said when our
   records that are not in the Nursing Services list were searched one by one. */
function buildCensus(h360Rows, register, outside, overrides, now) {
  const at = now || Date.now();
  const ov = overrides || {};
  const rows = (h360Rows || []).filter(Boolean);
  const nursing = rows.filter((h) => nursingRow(h) && !h.goneSince);
  const gone = rows.filter((h) => nursingRow(h) && h.goneSince);
  const reg = (register || []).filter(Boolean);
  const active = reg.filter(isActive);
  const former = reg.filter((r) => !isActive(r));
  const nursingByCode = new Map(nursing.map((h) => [String(h.code), h]));
  const goneByCode = new Map(gone.map((h) => [String(h.code), h]));
  const out = outside || {};

  const pairs = [];          // { rec, h, cmp }
  const idOther = [];        // our emp ID is another Nursing Services person in H360
  const unpaired = [];       // our active records not paired with a Nursing Services person
  const pairedCodes = new Set();
  for (const rec of active) {
    const code = String(rec.emp_id || '').trim();
    const h = code && nursingByCode.get(code);
    if (!h) { unpaired.push(rec); continue; }
    const cmp = match.compareRecord(rec, [h], []);
    if (cmp.status === 'id_other_person') { idOther.push({ rec, h, cmp }); continue; }
    pairs.push({ rec, h, cmp });
    pairedCodes.add(code);
  }

  /* lists */
  const L = {
    missing: [], formerActive: [], notInNursing: [], goneActive: [], idOther: [], roleMismatch: [], rankMismatch: [],
    designation: [], ageDiff: [], noDob: [], details: [], fills: [], sharedIds: [],
  };
  // In H360 Nursing Services, not in our register at all (or only under another ID / as Previous Staff).
  const formerCodes = new Map();
  for (const r of former) { const c = String(r.emp_id || '').trim(); if (c) formerCodes.set(c, (formerCodes.get(c) || []).concat(r)); }
  for (const m of match.missingFromRegister(nursing, active)) {
    const olds = (formerCodes.get(String(m.code)) || []).filter((r) => match.nameScore(r.name, m.name) >= match.SIMILAR_NAME);
    if (olds.length) { L.formerActive.push({ h: hOut(m, ov), rec: rOut(olds[0], ov) }); continue; }
    L.missing.push({ h: hOut(m, ov), maybe: m.ourMatch || null, idClash: m.idClash || null });
  }
  for (const x of idOther) L.idOther.push({ h: hOut(x.h, ov), rec: rOut(x.rec, ov) });
  // Our active staff H360 does not list in Nursing Services.
  for (const rec of unpaired) {
    const code = String(rec.emp_id || '').trim();
    const left = code && goneByCode.get(code);
    if (left && match.nameScore(rec.name, left.name) >= match.SIMILAR_NAME) { L.goneActive.push({ rec: rOut(rec, ov), h: hOut(left, ov) }); continue; }
    const o = out[rec.id] || out[String(rec.id)] || null;
    let why = 'unchecked';
    if (o) {
      if (o.status === 'no_emp_id') why = 'no_emp_id';
      else if (o.status === 'not_in_h360') why = 'not_found';
      else if (o.status === 'id_other_person') why = 'other_person';
      else if (o.h360 && !match.isNursing(o.h360)) why = 'outside';
      else if (o.h360) why = 'outside';
      else why = 'not_found';
    }
    L.notInNursing.push({ rec: rOut(rec, ov), why, h: o && o.h360 ? hOut(o.h360, ov) : null, suggestions: (o && o.suggestions) || [], checkedAt: (o && o.at) || null });
  }
  // Paired people whose details differ.
  for (const { rec, h, cmp } of pairs) {
    const hg = groupOf(h.designation, ov), og = ourGroupOf(rec, ov);
    const row = { rec: rOut(rec, ov), h: hOut(h, ov), status: cmp.status };
    if (hg !== og) ((hg === 'pca') !== (og === 'pca') ? L.roleMismatch : L.rankMismatch).push(row);
    const desig = cmp.fields.find((f) => f.key === 'designation');
    if (desig && desig.ok === false && !desig.missing) L.designation.push(row);
    const ha = h360Age(h);
    const asOf = h.lastSeenAt ? new Date(h.lastSeenAt).getTime() : at;
    const oa = ageOn(rec.dob, asOf);
    if (ha != null && oa != null && Math.abs(oa - ha) > 1) L.ageDiff.push({ ...row, ourAge: oa, h360Age: ha, born: bornAbout(ha, asOf) });
    if (!rec.dob && ha != null) L.noDob.push({ ...row, h360Age: ha, born: bornAbout(ha, asOf) });
    const diffs = cmp.fields.filter((f) => ['doj', 'gender', 'phone'].includes(f.key) && f.ok === false && !f.missing).map((f) => ({ key: f.key, label: f.label, ours: f.ours, h360: f.h360 }));
    if (diffs.length) L.details.push({ ...row, diffs });
    const fills = cmp.fields.filter((f) => f.missing && !f.fill).map((f) => ({ key: f.key, label: f.label, h360: f.h360 }));
    if (fills.length) L.fills.push({ ...row, fills });
  }
  // One emp ID on two active records.
  const byEmp = new Map();
  for (const r of active) { const c = String(r.emp_id || '').trim(); if (c) byEmp.set(c, (byEmp.get(c) || []).concat(r)); }
  for (const [code, recs] of byEmp) if (recs.length > 1) L.sharedIds.push({ code, recs: recs.map((r) => rOut(r, ov)), h: hOut(nursingByCode.get(code), ov) || null });

  /* counts */
  const zero = () => Object.fromEntries(GROUP_IDS.map((g) => [g, 0]));
  const h360By = zero(), oursBy = zero(), matchedBy = zero();
  nursing.forEach((h) => { h360By[groupOf(h.designation, ov)]++; });
  active.forEach((r) => { oursBy[ourGroupOf(r, ov)]++; });
  const cross = Object.fromEntries(GROUP_IDS.map((g) => [g, { ...zero(), none: 0 }]));   // H360 group → our group
  const notInH360By = zero();
  for (const { rec, h } of pairs) {
    const hg = groupOf(h.designation, ov), og = ourGroupOf(rec, ov);
    cross[hg][og]++;
    if (hg === og) matchedBy[hg]++;
  }
  nursing.forEach((h) => { if (!pairedCodes.has(String(h.code))) cross[groupOf(h.designation, ov)].none++; });
  active.forEach((r) => { if (!pairs.some((p) => p.rec === r)) notInH360By[ourGroupOf(r, ov)]++; });
  const groups = GROUPS.map((g) => ({ ...g, h360: h360By[g.id], ours: oursBy[g.id], matched: matchedBy[g.id], diff: oursBy[g.id] - h360By[g.id] }));

  // Per H360 unit (information: our departments are our own).
  const units = new Map();
  for (const h of nursing) {
    const k = h.dept || '(no unit)';
    const u = units.get(k) || { unit: k, total: 0, withUs: 0, ...zero(), ourDepts: {} };
    u.total++; u[groupOf(h.designation, ov)]++;
    const p = pairs.find((x) => String(x.h.code) === String(h.code));
    if (p) { u.withUs++; const od = p.rec.current_department || '(none)'; u.ourDepts[od] = (u.ourDepts[od] || 0) + 1; }
    units.set(k, u);
  }
  const unitList = [...units.values()].sort((a, b) => b.total - a.total || a.unit.localeCompare(b.unit))
    .map((u) => ({ ...u, ourDepts: Object.entries(u.ourDepts).sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n })) }));

  // Managers and leaders, both sides, side by side.
  const leaders = [];
  for (const h of nursing) {
    const g = groupOf(h.designation, ov);
    const p = pairs.find((x) => String(x.h.code) === String(h.code));
    if (LEADERS.has(g) || (p && LEADERS.has(ourGroupOf(p.rec, ov)))) leaders.push({ h: hOut(h, ov), rec: p ? rOut(p.rec, ov) : null });
  }
  for (const r of active) if (LEADERS.has(ourGroupOf(r, ov)) && !pairs.some((p) => p.rec === r)) leaders.push({ h: null, rec: rOut(r, ov) });
  const rank = (x) => Math.min(...[x.h && GROUP_IDS.indexOf(x.h.group), x.rec && GROUP_IDS.indexOf(x.rec.group)].filter((n) => n != null && n >= 0));
  leaders.sort((a, b) => rank(a) - rank(b) || String((a.h || a.rec).name).localeCompare(String((b.h || b.rec).name)));

  // Every designation either side uses, with its group (for the groups editor).
  const desigs = new Map();
  const addDesig = (text, side) => {
    const k = desigKey(text);
    if (!k) return;
    const d = desigs.get(k) || { key: k, text: String(text).trim(), h360: 0, ours: 0 };
    d[side]++;
    desigs.set(k, d);
  };
  nursing.forEach((h) => addDesig(h.designation, 'h360'));
  active.forEach((r) => addDesig(r.designation, 'ours'));
  const designations = [...desigs.values()].map((d) => ({ ...d, rule: ruleGroup(d.text) || 'other', group: groupOf(d.text, ov), overridden: Boolean(ov[d.key] && GROUP_IDS.includes(ov[d.key])) }))
    .sort((a, b) => GROUP_IDS.indexOf(a.group) - GROUP_IDS.indexOf(b.group) || (b.h360 + b.ours) - (a.h360 + a.ours));

  const counts = {
    h360: nursing.length, ours: active.length, matched: pairs.length, gone: gone.length,
    missing: L.missing.length, formerActive: L.formerActive.length, notInNursing: L.notInNursing.length, goneActive: L.goneActive.length,
    idOther: L.idOther.length, roleMismatch: L.roleMismatch.length, rankMismatch: L.rankMismatch.length, designation: L.designation.length,
    ageDiff: L.ageDiff.length, noDob: L.noDob.length, details: L.details.length, fills: L.fills.length, sharedIds: L.sharedIds.length,
    groups: Object.fromEntries(groups.map((g) => [g.id, { h360: g.h360, ours: g.ours }])),
  };
  return { counts, groups, cross, notInH360By, units: unitList, leaders, lists: L, designations, codes: nursing.map((h) => String(h.code)).sort() };
}

// Who joined / left H360 Nursing Services between two censuses (lists of codes).
function changesSince(prevCodes, nowCodes) {
  if (!Array.isArray(prevCodes)) return null;
  const a = new Set(prevCodes.map(String)), b = new Set((nowCodes || []).map(String));
  return { joined: [...b].filter((c) => !a.has(c)).sort(), left: [...a].filter((c) => !b.has(c)).sort() };
}

// Administrators' group choices, cleaned: { designation text (any case) : group id }.
function cleanOverrides(input) {
  const outp = {};
  if (!input || typeof input !== 'object') return outp;
  for (const [k, v] of Object.entries(input).slice(0, 400)) {
    const key = desigKey(k).slice(0, 120);
    if (key && GROUP_IDS.includes(v)) outp[key] = v;
  }
  return outp;
}

// The searches a full sweep makes: four-digit prefixes from 1000 up to one hundred-block past the
// highest employee code known (5-digit "11xxx" codes → 1000–1299, so the next block is covered too).
function sweepPrefixes(maxCode) {
  const max = Number(maxCode) || 0;
  let upper = 1199;
  if (max >= 10000) upper = Math.max(upper, (Math.floor(max / 1000) + 1) * 100 + 99);
  else if (max >= 1000) upper = Math.max(upper, Math.floor(max / 100) * 10 + 109);
  upper = Math.min(upper, 9999);
  return Array.from({ length: upper - 1000 + 1 }, (_, i) => String(1000 + i));
}

module.exports = { GROUPS, GROUP_IDS, GROUP_RULES, desigKey, ruleGroup, groupOf, ourGroupOf, ageOn, h360Age, bornAbout, buildCensus, changesSince, cleanOverrides, sweepPrefixes, DAY };
