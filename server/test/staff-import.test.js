/* Staff Management → Paste & Update: the reader / matcher / plan (renderer/unico/staff-import-core.js).
   Made-up people only, in the two layouts the screen accepts: the run-together text the user copies
   today ("1. Name Staff Role: … Phone: …") and the AI-prompt layout ("### STAFF 1 / Label: value"). */
const assert = require('node:assert/strict');
const SI = require('../../renderer/unico/staff-import-core.js');

const COPIED = '1. Rupa XyzbinStaff Role: Nurse (Staff Nurse)   Form Number: UF-AAAA00000001-001   Employee ID: Not assigned   Date Received: 10/11/2026   Phone: 01700000001   Date of Birth: 12/01/1999 (Age: 27)   Gender: Female   Qualifications: Diploma in Nursing, Post Basic B.Sc in Nursing (Running)   Extracurricular Activities: Cooking, Teamwork   Previous Experience:Alpha Medical College & Hospital (Gynae ward) – 01/09/2025 to 08/11/2026 (1 yr)   Beta Network (Gynae ward) – 01/05/2023 to 31/8/2025 (2 yrs 3 mos)   Total Previous Experience: 3 years 3 months   Date of Joining UNICO: 10/11/2026   Compliance & Registration:Special Training: BLS, Hygiene & Bed Care, Infection Control   Hepatitis-B Vaccination: Completed 3rd Dose   Additional Details: Blood Group: O+; Emergency Contact: 01700000099 (Mother)   Signature: Sabina   '
  + '2. Mina RaniStaff Role: Nurse (Staff Nurse)   Form Number: UF-AAAA00000001-001   Employee ID: Not assigned   Date Received: Not specified   Phone: 01700000002   Date of Birth: 26.11.1998   Gender: Female   Qualifications: Diploma in Nursing   Extracurricular Activities: Debate/Public Speaking, Volunteering/Social Work   Previous Experience:Gamma Hospital Limited (Prev) – 09.10.2023 to 07.11.2026 (3 yrs 1 mo)   Date of Joining UNICO: 08.11.2026   Compliance & Registration:Special Training: CPR, IV Cannulation   BNMC Registration / Licence No.: 64000 (Expiry: 06.11.2026)   Hepatitis-B Vaccination: 1st Dose   Additional Details: NID/Passport: 465 5412000; Blood Group: O+; Emergency Contact: 01700000098 (Brother)   Signature: Mina   '
  + '3. Lipi AkterStaff Role: Nurse   Form Number: UF-BBBB00000002-006   Employee ID: 11999   Phone: 017000-00003   Date of Birth: 02/03/1992 (Age: 34 years)   Gender: Female   Qualifications: Diploma in Nursing, Post Basic B.Sc in Nursing   Extracurricular Activities: None ticked   Previous Experience:Delta Bank Hospital (IPD + Emergency unit) – April 2016 to June 2018 (2 yrs 2 mos)   Epsilon Hospital (Cabin site - in-charge) – January 2024 to June 2025 (1 yr 5 mos)   Date of Joining UNICO: 07/4/2026 (Total Experience: 10 years 1 month)   Compliance & Registration:Special Training: First Aid, ICU/Critical Care   BNMC Registration / Licence No.: Diploma 35000, Post Basic 29000 (Expiry: 03/09/2036)   Hepatitis-B Vaccination: Completed 3rd Dose   Additional Details: Blood Group: O+   Signature: Lipi Akter   '
  + '4. Rina DasStaff Role: Patient Care Assistant (PCA) / ICU PCA   Form Number: UF-CCCC00000003-006   Employee ID: 11400   Phone: 019110000000   Date of Birth: 15/05/2000 (Age: 26)   Gender: Female   Qualifications: SSC, HSC, Care Giving Course   Previous Experience:Zeta Hospital (Neurology) – 15/01/24 to 15/02/25 (1 yr 1 mo)   Eta Cancer Hospital (Emergency) – Home Care – (6 mos)   Theta Specialized Hospital (CT/MRI P.C.A) – 2021 to 2023 (2 yrs 1 mo)   Date of Joining UNICO: 01/11/25   Hepatitis-B Vaccination: Not specified   Additional Details: NID/Passport: 3766860000; Languages: Bangla / English; Blood Group: B+; Emergency Contact: 01910000000 / 01779000000 (Brother)   Signature: Rina';

const AI = `Here are the forms.

### STAFF 1
Name: Mina Rani
Role: Nurse
Designation: Staff Nurse
Form Number: UF-AAAA00000001-001
Employee ID: -
Phone: 01700000002
Alternative Phone: -
Date of Birth: 26/11/1998
Gender: Female
Qualifications: Diploma in Nursing
Department: -
Date of Joining UNICO: 08/11/2026
Previous Experience:
- Gamma Hospital Limited | - | From 09/10/2023 | To 07/11/2026 | (3 yrs 1 mo)
Total Previous Experience: 3 years 1 month
Special Training: CPR; IV Cannulation
Extracurricular Activities: Debate/Public Speaking; Volunteering/Social Work
Languages: Bangla; English
BNMC Licence No: 64000
BNMC Licence Expiry: 06/11/2026
Hepatitis-B Vaccination: 1st Dose
NID / Passport: 4655412000
Blood Group: O+
Emergency Contact: 01700000098 (Brother)
Signature name: Mina
Unclear: -
`;

let n = 0; const ok = (m) => { n++; if (process.env.VERBOSE) console.log('  ok', m); };

/* ---- reading the copied style ---- */
const ps = SI.parseText(COPIED);
assert.equal(ps.length, 4, 'four people'); ok('split');
const [a, b, c, d] = ps.map((p) => p.fields);
assert.equal(a.name, 'Rupa Xyzbin', 'a label glued to the name is cut off');
assert.deepEqual([a.role, a.designation], ['Nurse', 'Staff Nurse']);
assert.equal(a.emp_id, '', '"Not assigned" is empty');
assert.equal(a.dob, '1999-01-12', 'day first'); assert.equal(a.doj, '2026-11-10');
assert.equal(a.hepatitis_b_vaccination, 'Completed');
assert.deepEqual([a.blood_group, a.emergency_contact, a.emergency_relation], ['O+', '01700000099', 'Mother'], 'Additional Details split');
assert.equal(a.prior_experience_entries.length, 2);
assert.deepEqual(a.prior_experience_entries[1], { org: 'Beta Network', dept: 'Gynae ward', mode: 'dates', fromDate: '2023-05-01', toDate: '2025-08-31', years: '', months: '' });
assert.ok(ps[0].warnings.some((w) => /does not match the signature/.test(w)), 'a misread name is flagged against the signature');
ok('person 1');
assert.equal(b.nid, '4655412000', 'spaces in the NID dropped'); assert.equal(b.licence_no, '64000'); assert.equal(b.licence_expiry, '2026-11-06');
assert.ok(ps[1].warnings.some((w) => /expired/.test(w)), 'an expired licence is flagged');
assert.equal(b.extracurricular, 'Debate / Public Speaking, Volunteering / Social Work', 'a slash inside an item stays inside it');
assert.equal(b.prior_experience_entries[0].org, 'Gamma Hospital Limited', '"(Prev)" is not a unit');
assert.ok(ps[0].warnings.some((w) => /Same form number/.test(w)) && ps[1].warnings.some((w) => /Same form number/.test(w)), 'one form number on two forms is flagged on both');
ok('person 2');
assert.equal(c.doj, '2026-04-07', '"(Total Experience: …)" inside the joining date is not a field');
assert.equal(c.phone, '01700000003', 'dashes in a phone dropped');
assert.equal(c.extracurricular, '', '"None ticked" is empty');
assert.equal(c.licence_no, '35000'); assert.ok(ps[2].warnings.some((w) => /More than one BNMC number/.test(w)));
assert.deepEqual(c.prior_experience_entries.map((e) => [e.org, e.dept, e.fromDate, e.toDate]), [['Delta Bank Hospital', 'IPD + Emergency unit', '2016-04-01', '2018-06-01'], ['Epsilon Hospital', 'Cabin site - in-charge', '2024-01-01', '2025-06-01']], 'a dash inside brackets stays in the unit');
assert.ok(ps[2].warnings.some((w) => /no day on the form/.test(w)), 'a month-only date says the 1st was used');
ok('person 3');
assert.deepEqual([d.role, d.designation], ['PCA', 'ICU PCA']);
assert.equal(d.phone, '', 'a 12-digit phone is not used'); assert.ok(ps[3].warnings.some((w) => /019110000000/.test(w)), '...and is reported');
assert.equal(d.emergency_contact, '01910000000'); assert.ok(ps[3].warnings.some((w) => /Two emergency numbers/.test(w)));
assert.equal(d.languages, 'Bangla, English');
assert.equal(d.hepatitis_b_vaccination, '', '"Not specified" is empty');
assert.deepEqual(d.prior_experience_entries.map((e) => [e.mode, e.years, e.months, e.dept]), [['dates', '', '', 'Neurology'], ['duration', '0', '6', 'Emergency · Home Care'], ['duration', '2', '1', 'CT/MRI P.C.A']], 'home care with a length only; year-only dates keep the stated length');
assert.equal(d.doj, '2025-11-01', 'DD/MM/YY');
ok('person 4');

/* ---- the AI-prompt layout reads to the same fields ---- */
const ai = SI.parseText(AI);
assert.equal(ai.length, 1, 'the text before "### STAFF 1" is not a person');
const x = ai[0].fields;
['name', 'role', 'designation', 'form_no', 'phone', 'dob', 'doj', 'licence_no', 'licence_expiry', 'nid', 'blood_group', 'emergency_contact', 'emergency_relation', 'hepatitis_b_vaccination', 'extracurricular'].forEach((k) => assert.equal(x[k], b[k], 'AI layout ' + k));
assert.equal(x.special_training, 'CPR, IV Cannulation'); assert.equal(x.languages, 'Bangla, English');
assert.deepEqual(x.prior_experience_entries, b.prior_experience_entries.map((e) => Object.assign({}, e)), 'pipe-separated experience');
assert.equal(x.emp_id, '', '"-" is empty');
ok('AI layout');
assert.ok(/### STAFF 1/.test(SI.AI_PROMPT) && /never guess/i.test(SI.AI_PROMPT), 'the prompt carries the layout and the no-guessing rule');

/* ---- matching ---- */
const ROSTER = [
  { id: 1, name: 'Mst. Lipi Aktar', role: 'Nurse', gender: 'Female', emp_id: '11999', phone: '01700000003', dob: '1992-03-02', doj: '2026-04-07', qualification: 'Diploma in Nursing', special_training: 'First Aid, CPR', hepatitis_b_vaccination: 'Not Completed', blood_group: '', prior_experience_entries: [{ org: 'Old Place', years: '1', months: '0' }] },
  { id: 2, name: 'Rina Das', emp_id: '11400', phone: '01800000000', dob: '2000-05-15', doj: '2025-01-11', nid: '3766860000', blood_group: 'A+', languages: 'Bangla', prior_experience_entries: [], custom: { cf_hr_form_reference: 'UF-CCCC0000O003-006' } },
  { id: 3, name: 'Someone Else', emp_id: '11400', phone: '01811111111' },        // shares Rina's number (it happens)
  { id: 4, name: 'Mina Rani', phone: '01822222222', dob: '1990-01-01' },          // same name, nothing else
  { id: 5, name: 'Mina Rani', phone: '01833333333', dob: '1998-11-26', former: true },
];
let m = SI.matchPerson(ps[2], ROSTER);
assert.equal(m.decision, 'match'); assert.equal(m.best.id, 1, 'by phone + employee ID, another spelling of the name'); ok('match by phone');
m = SI.matchPerson(ps[3], ROSTER);
assert.equal(m.decision, 'match'); assert.equal(m.best.id, 2, 'by NID + ID + name, the phone on the form being unreadable');
assert.ok(!m.candidates.some((cd) => cd.id === 3 && cd.strong), 'an employee number alone is not a match'); ok('match by NID');
m = SI.matchPerson(ps[1], ROSTER);
assert.equal(m.decision, 'match', 'same name + same birth date'); assert.equal(m.best.id, 5);
assert.ok(m.best.why.some((w) => /Previous Staff/.test(w)), 'an archived record is said to be archived');
assert.ok(m.candidates.some((cd) => cd.id === 4 && !cd.strong), 'a name alone is only a suggestion'); ok('former staff');
m = SI.matchPerson(ps[0], ROSTER);
assert.equal(m.decision, 'new'); ok('no match → new');
m = SI.matchPerson(ps[1], ROSTER.concat([{ id: 6, name: 'Mina Rani', phone: '01700000002' }]));
assert.equal(m.decision, 'choose', 'two strong candidates → the administrator picks'); ok('ambiguous');

/* ---- the plan: blanks fill, lists add, differences wait for a tick ---- */
const plan = SI.planUpdate(ps[2], ROSTER[0]);
const row = (k) => plan.rows.find((r) => r.key === k);
assert.equal(row('blood_group').kind, 'fill'); assert.equal(row('licence_no').kind, 'fill');
assert.equal(row('qualification').kind, 'diff', 'a different qualification is listed, not merged');
assert.equal(row('hepatitis_b_vaccination').kind, 'diff', 'a stored vaccination status is never replaced on its own');
assert.equal(row('special_training').kind, 'fill'); assert.deepEqual(row('special_training').added, ['ICU / Critical Care']);
assert.equal(row('special_training').value, 'First Aid, CPR, ICU / Critical Care', 'lists are added to');
assert.equal(row('prior_experience_entries').kind, 'diff', 'existing experience rows are not replaced on their own');
assert.equal(row('name').kind, 'diff'); assert.equal(row('phone').kind, 'same'); assert.equal(row('doj').kind, 'same');
ok('plan');
const fillsOnly = plan.rows.filter((r) => r.kind === 'fill').map((r) => r.key);
let bp = SI.buildPatch(ps[2], ROSTER[0], plan, fillsOnly, { at: '2026-11-14T08:00:00.000Z', by: 'Admin' });
assert.deepEqual(Object.keys(bp.patch).sort(), ['blood_group', 'custom', 'import_source', 'import_source_history', 'licence_expiry', 'licence_no', 'special_training'].sort());
assert.equal(bp.patch.custom.cf_hr_form_reference, 'UF-BBBB00000002-006', 'the form number goes on the HR form reference');
assert.ok(!('qualification' in bp.patch) && !('name' in bp.patch), 'unticked differences are not written');
assert.deepEqual(bp.patch.import_source.not_changed.sort(), ['hepatitis_b_vaccination', 'name', 'prior_experience_entries', 'qualification'].sort(), 'and are recorded as left');
assert.equal(bp.patch.import_source.by, 'Admin'); assert.equal(bp.patch.import_source_history.length, 1);
bp = SI.buildPatch(ps[2], ROSTER[0], plan, fillsOnly.concat(['hepatitis_b_vaccination', 'prior_experience_entries']), { at: '2026-11-14T08:00:00.000Z' });
assert.equal(bp.patch.hepatitis_b_vaccination, 'Completed');
assert.deepEqual(bp.replaced.hepatitis_b_vaccination, { old: 'Not Completed', new: 'Completed' }, 'a replaced value keeps the old one');
assert.equal(bp.patch.prior_experience_entries.length, 2);
assert.ok(bp.patch.prior_experience_years > 3.5 && bp.patch.prior_experience_years < 3.8, 'experience totals recomputed: ' + bp.patch.prior_experience_years);
assert.ok(/Delta Bank Hospital — IPD \+ Emergency unit/.test(bp.patch.previous_experience));
assert.equal(typeof bp.patch.total_experience_text, 'string');
ok('patch');
// Nothing on the form that is not already there → nothing written.
const same = SI.planUpdate({ fields: { name: 'Rina Das', phone: '' } }, ROSTER[1]);
assert.equal(SI.buildPatch({ fields: {} }, ROSTER[1], same, [], {}).changed, false);
// A new person: every field, ready for store.create.
const np = SI.planUpdate(ps[0], null);
assert.ok(np.rows.every((r) => r.kind === 'new'));
const rec = SI.newRecord(ps[0], np, np.rows.map((r) => r.key), { at: '2026-11-14T08:00:00.000Z' });
assert.equal(rec.name, 'Rupa Xyzbin'); assert.equal(rec.role, 'Nurse'); assert.equal(rec.prior_experience_entries.length, 2);
assert.ok(rec.total_experience_years > 0 && rec.import_source && rec.import_source.form_no === 'UF-AAAA00000001-001');
ok('new record');

/* ---- dates ---- */
assert.equal(SI.parseDate('October 30, 2020').iso, '2020-10-30');
assert.equal(SI.parseDate('15-10-26').iso, '2026-10-15');
assert.equal(SI.parseDate('31/13/2020'), null, 'an impossible date is not guessed');
assert.equal(SI.parseDate('2026-04-07').iso, '2026-04-07');
ok('dates');

console.log('staff-import: all assertions passed (' + n + ' groups)');
