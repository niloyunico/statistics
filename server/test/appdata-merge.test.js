// Three-way merge of shared app-state keys: concurrent edits from stale tabs must not erase each other.
const assert = require('node:assert/strict');
const { mergeKey } = require('../appdata-merge');
const S = JSON.stringify;
const m = (base, theirs, mine) => JSON.parse(mergeKey(S(base), S(theirs), S(mine)));

// Statistics Data Entry: admin B saved an ICU entry; stale tab A adds an OPD entry → both kept, ts order.
{
  const base = { custom: [], renames: {}, deleted: [], entries: [{ dept: 'micu', month: 'Jul-26', row: { a: 1 }, ts: 1 }], order: [] };
  const theirs = { ...base, entries: [...base.entries, { dept: 'icu', month: 'Aug-26', row: { a: 5 }, ts: 3 }] };
  const mine = { ...base, entries: [...base.entries, { dept: 'opd', month: 'Aug-26', row: { a: 9 }, ts: 2 }] };
  const out = m(base, theirs, mine);
  assert.deepEqual(out.entries.map((e) => e.dept), ['micu', 'opd', 'icu'], 'both new entries kept, ordered by ts');
}
// Quality overlay: different indicators / different months of the same indicator → both kept.
{
  const base = { depts: { ICU: { indPatches: { a: { months: { 'Jul-26': 1 } } } } } };
  const theirs = { depts: { ICU: { indPatches: { a: { months: { 'Jul-26': 1, 'Aug-26': 2 } }, b: { months: { 'Aug-26': 7 } } } } } };
  const mine = { depts: { ICU: { indPatches: { a: { months: { 'Jul-26': 1, 'Sep-26': 3 } } } }, OPD: { indRemoved: ['x'] } } };
  const out = m(base, theirs, mine);
  assert.deepEqual(out.depts.ICU.indPatches.a.months, { 'Jul-26': 1, 'Aug-26': 2, 'Sep-26': 3 });
  assert.deepEqual(out.depts.ICU.indPatches.b.months, { 'Aug-26': 7 });
  assert.deepEqual(out.depts.OPD.indRemoved, ['x']);
}
// A side that did not change a value takes the other side's change; a true clash → the latest save.
{
  assert.deepEqual(m({ v: 1, w: 1 }, { v: 2, w: 1 }, { v: 1, w: 3 }), { v: 2, w: 3 });
  assert.deepEqual(m({ v: 1 }, { v: 2 }, { v: 3 }), { v: 3 });
}
// Deletions are honoured, but a modification beats a deletion.
{
  assert.deepEqual(m({ a: 1, b: 1 }, { a: 1, b: 1 }, { a: 1 }), { a: 1 }, 'my deletion applies when they left it alone');
  assert.deepEqual(m({ a: 1, b: 1 }, { a: 1, b: 2 }, { a: 1 }), { a: 1, b: 2 }, 'their edit survives my deletion');
  assert.deepEqual(m({ list: ['x', 'y'] }, { list: ['x'] }, { list: ['x', 'y', 'z'] }), { list: ['x', 'z'] }, 'their removal + my addition');
}
// Not JSON → latest save wins; unchanged baseline → plain write.
{
  assert.equal(mergeKey('a', 'b', 'c'), 'c');
  assert.equal(mergeKey(S({ x: 1 }), S({ x: 1 }), S({ x: 2 })), S({ x: 2 }));
}
console.log('App-state three-way merge checks passed.');
