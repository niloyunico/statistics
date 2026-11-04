// The account ⇄ staff record link, and what the person gets back of their own record.
// Pure: no database, no network.
const assert = require('node:assert/strict');
const AS = require('../account-staff');

const roster = [
  { id: 1, emp_id: 'N-007', name: 'Sultana Akter', notes: [{ text: 'counselled' }], remarks: 'late twice', phone: '017' },
  { id: 2, emp_id: '11104', name: 'Md. Balayet Hossen' },
  { id: 3, emp_id: 'N-050', name: 'Rina Das' },
  { id: 4, emp_id: 'N-050', name: 'Rupa Das' },   // a shared number
];

// Linked by staffId: that record, whatever the number says.
assert.equal(AS.staffOfAccount({ username: 'x', staffId: 1 }, roster).id, 1);
// By an Employee ID only one record holds.
assert.equal(AS.staffOfAccount({ username: 'x', staffEmpId: 'N-007' }, roster).id, 1);
// A shared number alone never picks a colleague.
assert.equal(AS.staffOfAccount({ username: 'x', staffEmpId: 'N-050' }, roster), null);
// ...but the staffId the admin chose among the people who share it does.
assert.equal(AS.staffOfAccount({ username: 'x', staffId: 4, staffEmpId: 'N-050' }, roster).id, 4);

// Own record: internal notes and remarks stripped unless they may edit the register.
const own = AS.ownRecordFor(roster[0], false);
assert.equal(own.notes, undefined, 'notes stripped');
assert.equal(own.remarks, undefined, 'remarks stripped');
assert.equal(own.phone, '017', 'the rest is kept');
assert.ok(Array.isArray(roster[0].notes), 'the stored record is never mutated');
assert.deepEqual(AS.ownRecordFor(roster[0], true).remarks, 'late twice', 'a register editor keeps them');
assert.equal(AS.ownRecordFor(null, false), null);

console.log('account-staff tests: all passed');
