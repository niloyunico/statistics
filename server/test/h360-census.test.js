/* H360 Nursing Census (server/h360/staff-census.js): groups, counts, pairing and every list.
   Pure — no H360, no database. Synthetic people only.
   Run:  node test/h360-census.test.js */
const assert = require('assert');
const C = require('../h360/staff-census');

let passed = 0;
const ok = (name) => { passed++; console.log('  ok  ' + name); };

// Groups from the designation text (H360's and ours), administrators' choices first.
const g = (d) => C.groupOf(d);
assert.deepStrictEqual(['Nurse Manager', 'Assistant Manager', 'Sr. Nurse Manager - Quality & Training'].map(g), ['manager', 'manager', 'manager']);
assert.deepStrictEqual(['In-charge', 'Incharge- MICU', 'In-Charge - CTVS', 'Team Leader (Cath-Lab)', 'Charge Nurse', 'Acting Charge Nurse', 'OT Incharge Nurse'].map(g), Array(7).fill('incharge'));
assert.deepStrictEqual(['Staff Nurse', 'Senior Staff Nurse- MICU', 'Satff Nurse', 'Staff Nurse - MICU/NICU'].map(g), Array(4).fill('nurse'));
assert.deepStrictEqual(['Trainee Staff Nurse', 'Trainee Nurse'].map(g), ['trainee', 'trainee']);
assert.deepStrictEqual(['Patient Care Attendant', 'Patient Care Assistant', 'ICU PCA', 'Senior PCA'].map(g), Array(4).fill('pca'));
assert.deepStrictEqual(['Instructor- Quality & Training', 'Infection Control Nurse', 'Driver', ''].map(g), Array(4).fill('other'));
assert.strictEqual(C.groupOf('Instructor- Quality & Training', { 'instructor- quality & training': 'manager' }), 'manager');
assert.strictEqual(C.groupOf('Staff Nurse', { 'staff nurse': 'bogus' }), 'nurse', 'an unknown group is ignored');
assert.strictEqual(C.ourGroupOf({ designation: '', role: 'PCA' }), 'pca');
assert.strictEqual(C.ourGroupOf({ designation: 'Something', role: 'Nurse' }), 'nurse');
assert.deepStrictEqual(C.cleanOverrides({ '  Staff  NURSE ': 'pca', x: 'nope', '': 'nurse' }), { 'staff nurse': 'pca' });
ok('six groups from the designation text (managers, in-charge/team leaders, nurses, trainees, PCAs, other); admin choices by text win');

// Age and birth date: H360 gives whole years only.
const on = Date.UTC(2026, 10, 15);
assert.strictEqual(C.ageOn('1990-11-15', on), 36);
assert.strictEqual(C.ageOn('1990-11-16', on), 35);
assert.strictEqual(C.ageOn('nonsense', on), null);
assert.deepStrictEqual(C.bornAbout(37, on), { from: 1988, to: 1989, text: '1988–89' });
assert.strictEqual(C.h360Age({ age: '37' }), 37);
assert.strictEqual(C.h360Age({ age: '' }), null);
ok('age from our date of birth on a day; H360 age 37 → born about 1988–89');

// Sweep prefixes follow the highest code known.
assert.strictEqual(C.sweepPrefixes(0).length, 200);
assert.deepStrictEqual([C.sweepPrefixes(11843)[0], C.sweepPrefixes(11843).slice(-1)[0]], ['1000', '1299']);
assert.strictEqual(C.sweepPrefixes(12050).slice(-1)[0], '1399');
assert.ok(C.sweepPrefixes(99999999).length <= 9000);
ok('sweep prefixes: 1000–1199 by default, a block past the highest employee code (11843 → up to 1299)');

const H = (code, name, designation, dept, extra) => ({ code, name, designation, dept: dept || 'Nursing Services - MICU', nursing: true, phones: [], gender: 'Female', joinDate: '2024-01-01', age: '30', lastSeenAt: new Date(on), ...extra });
const h360 = [
  H('11001', 'Rahima Khatun', 'Nurse Manager', 'Nursing Services', { age: '46' }),
  H('11002', 'Salma Begum', 'Incharge- MICU'),
  H('11003', 'Nasrin Akter', 'Staff Nurse- MICU', 'Nursing Services - MICU', { age: '30' }),
  H('11004', 'Jesmin Ara', 'Patient Care Attendant', 'Nursing Services - CCU'),
  H('11005', 'Mitu Rani Das', 'Staff Nurse', 'Nursing Services - CCU'),          // ours says PCA
  H('11006', 'Ruma Akter', 'Senior Staff Nurse', 'Nursing Services - CCU'),      // ours says Staff Nurse (same group)
  H('11007', 'Lipi Sarkar', 'Trainee Staff Nurse', 'Nursing Services - NICU'),   // missing from us
  H('11008', 'Old Hand', 'Staff Nurse', 'Nursing Services - NICU'),              // Previous Staff with us
  H('11009', 'Someone Else', 'Staff Nurse', 'Nursing Services - SICU'),          // our 11009 is another person
  H('11010', 'Left Already', 'Staff Nurse', 'Nursing Services - SICU', { goneSince: new Date(on) }),
  H('11011', 'Kakoli Paul', 'Staff Nurse', 'Nursing Services - SICU', { gender: 'Female', joinDate: '2023-05-01' }),
  H('11012', 'Dr. Not Nursing', 'Consultant', 'Medicine', { nursing: false }),
];
const R = (id, emp_id, name, designation, role, extra) => ({ id, emp_id, name, designation, role, current_department: 'MICU', is_active: true, doj: '2024-01-01', gender: 'Female', ...extra });
const register = [
  R(1, '11001', 'Rahima Khatun', 'Nurse Manager', 'Nurse', { dob: '1980-01-01', current_department: 'Nursing Admin' }),
  R(2, '11002', 'Salma Begum', 'Charge Nurse', 'Nurse', { dob: '1996-11-15' }),        // H360 age 30, ours 30
  R(3, '11003', 'Nasrin Akter', 'Staff Nurse', 'Nurse', { dob: '1990-01-01' }),       // ours 36, H360 30 → age differs
  R(4, '11004', 'Jesmin Ara', 'ICU PCA', 'PCA', { current_department: 'CCU' }),       // no dob → born about
  R(5, '11005', 'Mitu Rani Das', 'Patient Care Assistant', 'PCA'),                    // H360 Nurse, ours PCA
  R(6, '11006', 'Ruma Akter', 'Staff Nurse', 'Nurse'),
  R(8, '11008', 'Old Hand', 'Staff Nurse', 'Nurse', { former: true, is_active: false }),
  R(9, '11009', 'Bipasa Maitra', 'Staff Nurse', 'Nurse'),
  R(10, '11010', 'Left Already', 'Staff Nurse', 'Nurse'),
  R(11, '11011', 'Kakoli Paul', 'Staff Nurse', 'Nurse', { doj: '2023-06-01', gender: '' }),
  R(12, '11500', 'Works In Lab', 'Staff Nurse', 'Nurse'),                              // H360: elsewhere
  R(13, '', 'No Id Yet', 'PCA', 'PCA'),
  R(14, '11600', 'Twin One', 'Staff Nurse', 'Nurse'),
  R(15, '11600', 'Twin Two', 'Staff Nurse', 'Nurse'),
];
const outside = {
  12: { id: 12, status: 'match', h360: { code: '11500', name: 'Works In Lab', designation: 'Staff Nurse', dept: 'Laboratory', phones: [] }, suggestions: [], at: 'x' },
  13: { id: 13, status: 'no_emp_id', h360: null, suggestions: [{ code: '11004', name: 'Jesmin Ara', why: 'same name' }] },
  14: { id: 14, status: 'not_in_h360', h360: null, suggestions: [] },
};
const c = C.buildCensus(h360, register, outside, {}, on);

assert.deepStrictEqual([c.counts.h360, c.counts.ours, c.counts.matched, c.counts.gone], [10, 13, 7, 1]);
const grp = Object.fromEntries(c.groups.map((x) => [x.id, [x.h360, x.ours]]));
assert.deepStrictEqual(grp, { manager: [1, 1], incharge: [1, 1], nurse: [6, 8], trainee: [1, 0], pca: [1, 3], other: [0, 0] });
assert.strictEqual(c.cross.nurse.pca, 1, 'H360 nurse, ours PCA');
assert.strictEqual(c.cross.nurse.nurse, 3);
assert.strictEqual(c.cross.trainee.none, 1, 'a trainee H360 holds and we do not');
ok('counts: H360 Nursing Services (gone + doctors left out) vs our active staff, by group, with the H360 × ours cross-table');

const L = c.lists;
assert.deepStrictEqual(L.missing.map((x) => x.h.code).sort(), ['11007', '11009']);
assert.strictEqual(L.missing.find((x) => x.h.code === '11009').idClash.id, 9, 'our #9 uses that ID');
assert.ok(L.missing.some((x) => x.h.code === '11007' && !x.maybe));
assert.deepStrictEqual(L.formerActive.map((x) => [x.h.code, x.rec.id]), [['11008', 8]]);
assert.deepStrictEqual(L.idOther.map((x) => [x.rec.id, x.h.name]), [[9, 'Someone Else']]);
assert.deepStrictEqual(L.goneActive.map((x) => x.rec.id), [10]);
const why = Object.fromEntries(L.notInNursing.map((x) => [x.rec.id, x.why]));
assert.deepStrictEqual(why, { 12: 'outside', 13: 'no_emp_id', 14: 'not_found', 15: 'unchecked' });
assert.strictEqual(L.notInNursing.find((x) => x.rec.id === 12).h.dept, 'Laboratory');
ok('lists: missing from us, Previous Staff still active in H360, ID of another person, gone from H360, ours outside Nursing Services / not found / no emp ID');

assert.deepStrictEqual(L.roleMismatch.map((x) => x.rec.id), [5]);
assert.deepStrictEqual(L.rankMismatch.map((x) => x.rec.id), []);
assert.ok(!L.rankMismatch.some((x) => x.rec.id === 2), 'Charge Nurse / Incharge- MICU are both in-charge');
assert.ok(!L.rankMismatch.some((x) => x.rec.id === 6), 'Senior Staff Nurse / Staff Nurse are both nurses');
assert.deepStrictEqual(L.ageDiff.map((x) => [x.rec.id, x.ourAge, x.h360Age]), [[3, 36, 30]]);
assert.ok(L.noDob.some((x) => x.rec.id === 4 && x.born.text === '1995–96'));
assert.ok(!L.noDob.some((x) => x.rec.id === 2));
const d11 = L.details.find((x) => x.rec.id === 11);
assert.deepStrictEqual(d11.diffs.map((f) => f.key), ['doj']);
assert.ok(L.fills.find((x) => x.rec.id === 11).fills.some((f) => f.key === 'gender'), 'blank gender with us, H360 has it → a fill, not a difference');
assert.deepStrictEqual(L.sharedIds.map((x) => [x.code, x.recs.map((r) => r.id)]), [['11600', [14, 15]]]);
ok('mismatches: Nurse/PCA, rank, age vs our birth date (>1 year), no birth date (H360 age → born about), joining date, blanks H360 can fill, one ID twice');

const unitMicu = c.units.find((u) => u.unit === 'Nursing Services - MICU');
assert.deepStrictEqual([unitMicu.total, unitMicu.withUs, unitMicu.incharge, unitMicu.nurse], [2, 2, 1, 1]);
assert.ok(c.leaders.some((x) => x.h && x.h.code === '11001' && x.rec && x.rec.id === 1));
assert.ok(c.designations.some((d) => d.key === 'icu pca' && d.ours === 1 && d.group === 'pca'));
ok('per H360 unit counts, managers & leaders side by side, every designation with its group');

const moved = C.buildCensus(h360, register, outside, { 'patient care assistant': 'nurse' }, on);
assert.deepStrictEqual(moved.lists.roleMismatch.map((x) => x.rec.id), [], 'moving a designation to another group changes the census');
assert.strictEqual(moved.designations.find((d) => d.key === 'patient care assistant').overridden, true);
ok('an administrator moving a designation to another group changes the counts and mismatches');

assert.deepStrictEqual(C.changesSince(['1', '2', '3'], ['2', '3', '4']), { joined: ['4'], left: ['1'] });
assert.strictEqual(C.changesSince(null, ['1']), null);
ok('since the last census: who joined and who left H360 Nursing Services');

// Nothing in the input was changed.
assert.strictEqual(register[2].dob, '1990-01-01');
assert.strictEqual(h360.length, 12);
console.log(`\n${passed} passed`);
