const assert = require('node:assert/strict');
const { mergeStaffChanges } = require('../staff-merge');
const stringify = JSON.stringify;
const merge = (base, next, current) => JSON.parse(mergeStaffChanges(stringify(base), stringify(next), stringify(current)));
const old = [{id:1,name:'Nurse',extracurricular:'Singing',is_active:true}];
const live = [{...old[0],extracurricular:'Singing, Gardening'}, {id:2,name:'New nurse',is_active:true}];
const stale = [{...old[0],name:'Correct name'}];
assert.deepEqual(merge(old, stale, live), [{...live[0],name:'Correct name'}, live[1]]);
assert.throws(() => merge(old, [{...old[0],extracurricular:'Dancing'}], live), error => error.status === 409);
assert.throws(() => merge(old, [], live), error => error.status === 409);
assert.deepEqual(merge(old, old, live), live);
assert.deepEqual(merge(live, [{...live[0],extracurricular:''},live[1]], live)[0].extracurricular, '');
assert.throws(() => merge([], [{id:2,name:'Other'}], live), error => error.status === 409);
assert.throws(() => merge(old, stale, []), error => error.status === 409);
// Fields the server restores from the staff document (photo, BNMC licence) are not
// somebody else's edit: they made every delete / photo change / re-verification a 409.
const stored = [{id:5,name:'Chelcia',is_active:true}];
const resolved = [{...stored[0],photo:{url:'p'},licence_verified:{at:'2026-09-07'},licence_no:'7749'}];
assert.deepEqual(merge(resolved, [], stored), [], 'deleting a person whose photo/licence came from the server is not a conflict');
assert.deepEqual(merge(resolved, [{...resolved[0],photo:{url:'new'}}], stored)[0].photo, {url:'new'}, 'changing that photo is not a conflict');
assert.equal(merge(resolved, [{...resolved[0],licence_verified:{at:'2026-09-14'}}], [{...stored[0],licence_verified:{at:'2026-01-01'}}])[0].licence_verified.at, '2026-09-14', 're-verifying over an older stored verification is not a conflict');
assert.throws(() => merge(resolved, [{...resolved[0],photo:{url:'new'}}], [{...stored[0],photo:{url:'someone else'}}]), error => error.status === 409, 'a real competing photo change still conflicts');
assert.throws(() => merge(old, [], [{...old[0],extracurricular:'Changed'}]), error => error.status === 409, 'deleting a record someone else edited still conflicts');
// Server-written photo/licence fields match the record id only, never the employee number.
const { staffIdFilter } = require('../staff-roster');
assert.deepEqual(staffIdFilter(120), {$or:[{id:120},{_id:'120'}]});
assert.deepEqual(staffIdFilter('S-9'), {$or:[{_id:'S-9'}]});
assert.equal(staffIdFilter(''), null, 'no record id means no server write');
assert.equal(staffIdFilter(null), null);
process.env.MONGODB_URI='';
const db=require('../db');
(async()=>{
  const previous=(await db.getAppData()).data;
  await db.setAppData({unico_staff_v3:stringify(live)},previous);
  await assert.rejects(db.setAppData({unico_staff_v3:stringify(stale)},previous),error=>error.status===409);
  assert.equal(JSON.parse((await db.getAppData()).data.unico_staff_v3)[0].extracurricular,'Singing, Gardening');
  console.log('Staff merge and concurrent write checks passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
