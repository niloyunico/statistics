/* Duty roster workflow — the transition table and the rights matrix, with no database.
   Run: node server/test/roster-workflow.test.js   (exit 0 = pass)

   What these pin down:
     - a legacy 'submitted' sheet reads as pending_cns and still matches on write,
     - every hand-over is allowed from exactly the states the chain draws,
     - a manager checks and forwards but never approves; only the CNS (or an
       administrator) approves; the CNS cannot sign a sheet they sent themselves,
     - the names stamped on the sheet come from the setup, not from whoever pressed Send. */
const assert = require('node:assert/strict');
const W = require('../roster-workflow');

let pass = 0;
const ok = (name, cond) => { assert.ok(cond, name); pass++; };

const cfg = { dept: { incharge: { username: 'rahima', name: 'Rahima Akter' }, manager: { username: 'farida', name: 'Farida Begum' } }, cns: { username: 'nasrin', name: 'Nasrin Sultana' } };
const noCfg = { dept: {}, cns: null };
const actor = (o) => Object.assign({ unrestricted: false, username: 'x', name: 'X', rosterRole: '', canEdit: false, inScope: false }, o);
const admin = actor({ unrestricted: true, username: 'admin', name: 'Administrator' });
const incharge = actor({ username: 'rahima', name: 'Rahima Akter', rosterRole: 'incharge', canEdit: true, inScope: true });
const editorNoRole = actor({ username: 'mate', name: 'Mate', canEdit: true, inScope: true });
const manager = actor({ username: 'farida', name: 'Farida Begum', rosterRole: 'manager' });              // named in the setup, no unit assignment
const scopedManager = actor({ username: 'other.mgr', name: 'Other Manager', rosterRole: 'manager', inScope: true }); // assigned the unit, not named
const foreignManager = actor({ username: 'other.mgr', name: 'Other Manager', rosterRole: 'manager' });
const cns = actor({ username: 'nasrin', name: 'Nasrin Sultana', rosterRole: 'cns' });
const viewer = actor({ username: 'view', name: 'Viewer', inScope: true });
const sheet = (status, extra) => Object.assign({ id: 'ros-MICU-2026-10', dept: 'MICU', status, revision: 3, grid: { S1: { 1: 'M' } } }, extra || {});

/* ---- reading the store ---- */
assert.equal(W.effStatus({ status: 'submitted' }), 'pending_cns', 'legacy submitted reads as pending_cns');
assert.equal(W.effStatus({ status: 'pending_manager' }), 'pending_manager');
assert.equal(W.effStatus({}), 'draft'); assert.equal(W.effStatus(null), 'draft'); assert.equal(W.effStatus({ status: 'weird' }), 'draft');
assert.deepEqual(W.rawStatuses('pending_cns'), ['pending_cns', 'submitted'], 'a conditional write matches both spellings');
assert.deepEqual(W.rawStatuses('draft'), ['draft']);
assert.equal(W.cleanRosterRole('CNS'), 'cns'); assert.equal(W.cleanRosterRole('boss'), ''); assert.equal(W.cleanRosterRole(null), '');
pass += 7;

/* ---- the transition table: which hand-over from which state ---- */
const allowedFrom = {
  send_manager: ['draft', 'returned'], send_cns: ['draft', 'returned'], forward: ['pending_manager'],
  approve: ['pending_cns'], return: ['pending_manager', 'pending_cns'], reopen: ['approved'],
};
W.STATUSES.forEach((st) => W.ACTIONS.forEach((action) => {
  const r = W.transition(sheet(st), action, admin, cfg, { now: 1000 });
  if (allowedFrom[action].indexOf(st) >= 0) ok(action + ' from ' + st + ' (admin)', r.ok);
  else ok(action + ' from ' + st + ' is bad_state', !r.ok && r.status === 409 && r.code === 'bad_state');
}));
ok('legacy submitted approves like pending_cns', W.transition(sheet('submitted'), 'approve', cns, cfg).ok);
ok('an unknown action is 400', W.transition(sheet('draft'), 'publish', admin, cfg).code === 'unknown_action');

/* ---- the rights matrix ---- */
const can = (a, st, c, extra) => W.rights(a, sheet(st, extra), (c || cfg).dept, (c || cfg).cns);
// In-charge / any editor in scope
ok('in-charge sends a draft', can(incharge, 'draft').send);
ok('in-charge sends a returned sheet again', can(incharge, 'returned').send);
ok('in-charge cannot send a sheet already with the manager', !can(incharge, 'pending_manager').send);
ok('in-charge cannot edit while pending', !can(incharge, 'pending_cns').edit);
ok('an editor without a roster role still sends (no one is locked out by the new field)', can(editorNoRole, 'draft').send);
ok('an editor never forwards, approves or reopens', !can(incharge, 'pending_manager').forward && !can(incharge, 'pending_cns').approve && !can(incharge, 'approved').reopen);
ok('a view-only account sends nothing', !can(viewer, 'draft').send && !can(viewer, 'draft').edit);
// Manager
ok('the set manager forwards', can(manager, 'pending_manager').forward);
ok('the set manager returns at the manager stage', can(manager, 'pending_manager').return);
ok('the set manager never approves', !can(manager, 'pending_cns').approve);
ok('the set manager cannot return a sheet already with the CNS', !can(manager, 'pending_cns').return);
ok('a manager assigned the unit (not yet in the setup) also forwards', can(scopedManager, 'pending_manager').forward);
ok('a manager of another unit cannot forward', !can(foreignManager, 'pending_manager').forward && !can(foreignManager, 'pending_manager').return);
ok('the set manager sees the sheet beyond unit scope', can(manager, 'draft').view && !can(foreignManager, 'draft').view);
// CNS
ok('the CNS approves', can(cns, 'pending_cns').approve);
ok('the CNS returns at the CNS stage', can(cns, 'pending_cns').return);
ok('the CNS does not act at the manager stage', !can(cns, 'pending_manager').forward && !can(cns, 'pending_manager').return);
ok('the CNS cannot sign a sheet they sent themselves', !can(cns, 'pending_cns', cfg, { sentBy: 'nasrin' }).approve);
ok('an administrator may (self-approval is an admin exception)', can(admin, 'pending_cns', cfg, { sentBy: 'admin' }).approve);
ok('the CNS cannot reopen', !can(cns, 'approved').reopen);
ok('the CNS sees every unit', can(cns, 'draft').view);
// Admin
ok('an administrator holds every right in its state', can(admin, 'draft').send && can(admin, 'pending_manager').forward && can(admin, 'pending_cns').approve && can(admin, 'approved').reopen);
ok('an administrator may still edit a pending sheet, never an approved one', can(admin, 'pending_cns').edit && !can(admin, 'approved').edit);

/* ---- what a hand-over stamps ---- */
let r = W.transition(sheet('draft'), 'send_manager', admin, cfg, { now: 5000 });
assert.equal(r.set.status, 'pending_manager'); assert.equal(r.set.stage, 'manager');
assert.equal(r.set.preparedBy, 'Rahima Akter', 'Prepared by is the set in-charge, not the administrator who pressed Send');
assert.equal(r.set.sentBy, 'admin'); assert.equal(r.set.sentAt, 5000);
assert.equal(r.set.returnNote, '', 'a resend clears the old return note');
assert.deepEqual([r.entry.action, r.entry.from, r.entry.to, r.entry.revision, r.entry.at], ['send_manager', 'draft', 'pending_manager', 3, 5000]);
ok('a send snapshots the grid', r.snapshot); ok('and logs roster_sent', r.activity === 'roster_sent');
pass += 7;

r = W.transition(sheet('draft'), 'send_cns', incharge, noCfg, { now: 1 });
assert.equal(r.set.preparedBy, 'Rahima Akter', 'with no setup, the sender is the preparer'); assert.equal(r.set.stage, 'cns'); pass += 2;

r = W.transition(sheet('pending_manager'), 'forward', manager, cfg, { now: 2 });
assert.equal(r.set.checkedBy, 'Farida Begum'); assert.equal(r.set.checkedByUser, 'farida'); assert.equal(r.set.status, 'pending_cns'); assert.equal(r.activity, 'roster_forwarded'); pass += 4;

r = W.transition(sheet('pending_cns'), 'approve', admin, cfg, { now: 3 });
assert.equal(r.set.approvedBy, 'Nasrin Sultana', 'Approved by is the set CNS even when an administrator signs'); assert.equal(r.set.approvedAt, 3); pass += 2;
r = W.transition(sheet('pending_cns'), 'approve', cns, noCfg, { now: 3 });
assert.equal(r.set.approvedBy, 'Nasrin Sultana', 'with no setup, the signer'); pass += 1;

r = W.transition(sheet('pending_manager'), 'return', manager, cfg, { now: 4, note: 'x'.repeat(900) });
assert.equal(r.set.status, 'returned'); assert.equal(r.set.returnStage, 'manager'); assert.equal(r.set.stage, 'manager');
assert.equal(r.set.returnNote.length, W.NOTE_MAX, 'the note is capped'); assert.equal(r.entry.note.length, W.NOTE_MAX);
assert.equal(r.set.returnedByName, 'Farida Begum'); pass += 5;
r = W.transition(sheet('pending_cns'), 'return', cns, cfg, { now: 4 });
assert.equal(r.set.returnStage, 'cns'); assert.equal(r.set.returnNote, '', 'a note is optional'); pass += 2;

r = W.transition(sheet('approved'), 'reopen', admin, cfg, { now: 6 });
assert.equal(r.set.status, 'draft'); assert.equal(r.set.stage, null); ok('a reopen does not snapshot', !r.snapshot); assert.equal(r.activity, 'roster_reopened'); pass += 3;

r = W.transition(sheet('pending_cns', { sentBy: 'nasrin' }), 'approve', cns, cfg);
assert.equal(r.status, 403); assert.equal(r.code, 'forbidden'); assert.match(r.error, /yourself/); pass += 3;
r = W.transition(sheet('pending_manager'), 'forward', incharge, cfg);
assert.equal(r.code, 'forbidden'); assert.match(r.error, /manager/); pass += 2;

const rs = W.resumeOnEdit(sheet('returned'), incharge, 9);
assert.deepEqual(rs.set, { status: 'draft', stage: null }); assert.equal(rs.entry.action, 'resume'); assert.equal(rs.entry.revision, 3); pass += 3;

console.log('ROSTER_WORKFLOW_TEST_PASS: ' + pass + ' checks — legacy mapping, transition table, rights matrix, stamps, caps');
