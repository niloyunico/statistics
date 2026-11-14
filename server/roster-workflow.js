/* UNICO — Duty Roster workflow: the ONE place that says which hand-over a sheet may
 * make next, who may make it, and what gets stamped on the sheet when they do.
 *
 * Pure on purpose: no database, no request object. Every write path (the console PUT,
 * the phone PUT, the transition route and the legacy status route) builds an `actor`
 * from its own guard and asks this module — so the sheet, the review inbox and the
 * phone can never disagree about whether a button will work.
 *
 * THE CHAIN
 *   draft ──send_manager──▶ pending_manager ──forward──▶ pending_cns ──approve──▶ approved
 *     │                            │                         │                       │
 *     └──────send_cns──────────────┼─────────────────────────┘                       │
 *                                  └──return──▶ returned ◀──return──┘    reopen (admin) ┘
 *   returned ──(any save)──▶ draft, then the in-charge sends again.
 *
 * Only the CNS (or an administrator) approves. A manager checks and forwards, or returns.
 * The in-charge may send straight to the CNS — the renderer warns that this skips the
 * manager; the server allows it, because some units have no manager at all.
 *
 * LEGACY
 * Sheets written before this module carry status 'submitted'. They are READ as
 * pending_cns (effStatus) and matched on write with both spellings (rawStatuses); nothing
 * stored is rewritten — the hard rule for every deployment here.
 */

const STATUSES = ['draft', 'pending_manager', 'pending_cns', 'approved', 'returned'];
const LEGACY = { submitted: 'pending_cns' };
const EDITABLE = ['draft', 'returned'];
const PENDING = ['pending_manager', 'pending_cns'];
const ROSTER_ROLES = ['', 'incharge', 'manager', 'cns'];
const HISTORY_CAP = 200;
const VERSION_CAP = 40;
const NOTE_MAX = 500;

const LABEL = { draft: 'a draft', pending_manager: 'with the manager for review', pending_cns: 'with the CNS for approval', approved: 'approved and locked', returned: 'returned for correction' };

const s = (v, max) => String(v == null ? '' : v).slice(0, max || 200);

function effStatus(doc) {
  const st = doc && doc.status;
  if (LEGACY[st]) return LEGACY[st];
  return STATUSES.indexOf(st) >= 0 ? st : 'draft';
}
// Every stored spelling of one effective status — for the conditional write filter.
function rawStatuses(eff) { return eff === 'pending_cns' ? ['pending_cns', 'submitted'] : [eff]; }

// Which stage a sheet waits at (or was returned from).
const TRANSITIONS = {
  send_manager: { from: EDITABLE, to: 'pending_manager', stage: 'manager', right: 'send', verb: 'send' },
  send_cns: { from: EDITABLE, to: 'pending_cns', stage: 'cns', right: 'send', verb: 'send' },
  forward: { from: ['pending_manager'], to: 'pending_cns', stage: 'cns', right: 'forward', verb: 'forward' },
  approve: { from: ['pending_cns'], to: 'approved', stage: null, right: 'approve', verb: 'approve' },
  return: { from: PENDING, to: 'returned', stage: 'same', right: 'return', verb: 'return' },
  reopen: { from: ['approved'], to: 'draft', stage: null, right: 'reopen', verb: 'reopen' },
};
const ACTIONS = Object.keys(TRANSITIONS);

// Activity-log action names, one per hand-over.
const ACTIVITY = { send_manager: 'roster_sent', send_cns: 'roster_sent', forward: 'roster_forwarded', approve: 'roster_approved', return: 'roster_returned', reopen: 'roster_reopened' };

const FORBIDDEN = {
  send: 'Only someone who builds this unit\'s roster can send it for review.',
  forward: 'Only the unit\'s manager can check and forward this roster.',
  approve: 'Only the CNS can approve a roster.',
  return: 'Only the reviewer this roster is waiting on can return it.',
  reopen: 'Only an administrator can reopen an approved roster.',
};

/* What ONE actor may do with ONE sheet right now.
     actor = { unrestricted, username, name, rosterRole, canEdit, inScope }
       canEdit — holds the roster write right at all (module 'edit' or portal rosterEdit)
       inScope — the sheet's unit is inside their roster assignment
     cfgDept  = { incharge:{username,name}|null, manager:{...}|null } for the sheet's unit
   A manager counts for a unit when the setup names them for it OR their own roster
   assignment covers it — so a manager whose units were assigned on the account but not
   yet in the setup screen is not locked out of the queue. A CNS counts everywhere. */
function rights(actor, doc, cfgDept, cfgCns) {
  const a = actor || {};
  const st = effStatus(doc);
  const me = a.username || '';
  const admin = a.unrestricted === true;
  const mgrOfUnit = !!(cfgDept && cfgDept.manager && cfgDept.manager.username && cfgDept.manager.username === me);
  // The person Duty Roster -> Setup names as this unit's In-charge prepares its roster: the
  // setup IS the grant, so they need no separate Duty Roster Edit permission for it.
  const inchOfUnit = !!(me && cfgDept && cfgDept.incharge && cfgDept.incharge.username && cfgDept.incharge.username === me);
  // Named the unit's Manager in Setup = the grant (the role is not needed); a Manager-role
  // account also checks the units on its own list.
  const isMgr = mgrOfUnit || (a.rosterRole === 'manager' && a.inScope === true);
  const isCns = a.rosterRole === 'cns';
  const editor = (a.inScope === true && a.canEdit === true) || inchOfUnit;
  const editable = EDITABLE.indexOf(st) >= 0;
  // Self-approval: the person who sent a sheet to the CNS must not also be the one signing it.
  const sentByMe = !!(doc && doc.sentBy && doc.sentBy === me);
  // The reviewer the sheet is waiting on (or an administrator).
  const reviewer = (st === 'pending_manager' && (admin || isMgr)) || (st === 'pending_cns' && (admin || isCns));
  // A sheet still being prepared (draft / returned) is the preparers' work in progress: only the
  // people who prepare THIS unit's roster (its Setup In-charge, anyone with Duty Roster Edit for
  // the unit — two preparers both see it) and administrators. The Manager, the CNS and view-only
  // accounts see it once it is sent to them.
  const viewDraft = admin || editor;
  const seeAny = admin || a.inScope === true || isCns || mgrOfUnit || inchOfUnit;
  return {
    view: editable ? viewDraft : seeAny,
    viewDraft,
    edit: admin ? st !== 'approved' : (editor && editable),
    send: (admin || editor) && editable,
    forward: st === 'pending_manager' && (admin || isMgr),
    return: reviewer,
    // While it waits on them, the reviewer may change one shift directly (logged in the
    // history) or pin a note to a person's day for the in-charge; the in-charge may mark a
    // pinned note done once the sheet is back with them.
    reviewEdit: reviewer,
    mark: reviewer,
    markDone: reviewer || ((admin || editor) && editable),
    approve: st === 'pending_cns' && (admin || (isCns && !sentByMe)),
    reopen: admin && st === 'approved',
    selfSent: sentByMe,
  };
}

/* One hand-over. Returns what to $set and the history row to $push — never writes.
   cfg = { dept: cfgDept, cns: {username,name}|null }
   opts = { now, note } */
function transition(doc, action, actor, cfg, opts) {
  const t = TRANSITIONS[action];
  if (!t) return { ok: false, status: 400, code: 'unknown_action', error: 'Unknown roster action.' };
  const from = effStatus(doc);
  if (t.from.indexOf(from) < 0) {
    return { ok: false, status: 409, code: 'bad_state', error: 'This roster is ' + (LABEL[from] || from) + ', so it cannot be ' + pastOf(t.verb) + ' from here. Reload the month to see its current state.' };
  }
  const c = cfg || {};
  const r = rights(actor, doc, c.dept, c.cns);
  if (!r[t.right]) {
    const err = (action === 'approve' && r.selfSent) ? 'You sent this roster for approval yourself; another approver must sign it.' : FORBIDDEN[t.right];
    return { ok: false, status: 403, code: 'forbidden', error: err };
  }
  const o = opts || {};
  const now = Number.isFinite(o.now) ? o.now : Date.now();
  const note = s(o.note, NOTE_MAX).trim();
  const me = (actor && actor.username) || 'local';
  const myName = (actor && actor.name) || me;
  const d = c.dept || {};
  const stage = t.stage === 'same' ? (from === 'pending_manager' ? 'manager' : 'cns') : t.stage;
  // statusBy/statusAt are the stamps the old route wrote; kept so nothing reading them breaks.
  const set = { status: t.to, stage, statusBy: myName, statusAt: now };
  if (action === 'send_manager' || action === 'send_cns') {
    Object.assign(set, {
      sentAt: now, sentBy: me, sentByName: myName,
      // The name on the "Prepared by" line is the unit's set in-charge, not whoever pressed
      // Send — an administrator sending on a unit's behalf must not become its preparer.
      preparedBy: (d.incharge && d.incharge.name) || myName, preparedByUser: (d.incharge && d.incharge.username) || me,
      returnNote: '', returnedAt: null, returnedBy: null, returnedByName: null, returnStage: null,
    });
  } else if (action === 'forward') {
    Object.assign(set, { checkedBy: (d.manager && d.manager.name) || myName, checkedByUser: (d.manager && d.manager.username) || me, checkedAt: now });
  } else if (action === 'approve') {
    Object.assign(set, { approvedBy: (c.cns && c.cns.name) || myName, approvedByUser: (c.cns && c.cns.username) || me, approvedAt: now });
  } else if (action === 'return') {
    Object.assign(set, { returnedAt: now, returnedBy: me, returnedByName: myName, returnNote: note, returnStage: stage });
  } else if (action === 'reopen') {
    Object.assign(set, { reopenedAt: now, reopenedBy: me, reopenedByName: myName });
  }
  const entry = { at: now, by: me, byName: myName, action, from, to: t.to, note, revision: (doc && doc.revision) || 0 };
  return { ok: true, from, to: t.to, set, entry, snapshot: action !== 'reopen', activity: ACTIVITY[action] };
}

// A returned sheet becomes a draft again the moment its author saves — the correction
// has started, and the review queue must stop showing it as "returned".
function resumeOnEdit(doc, actor, now) {
  const at = Number.isFinite(now) ? now : Date.now();
  const me = (actor && actor.username) || 'local';
  return {
    set: { status: 'draft', stage: null },
    entry: { at, by: me, byName: (actor && actor.name) || me, action: 'resume', from: 'returned', to: 'draft', note: '', revision: (doc && doc.revision) || 0 },
  };
}

function pastOf(verb) { return { send: 'sent', forward: 'forwarded', approve: 'approved', return: 'returned', reopen: 'reopened' }[verb] || verb + 'ed'; }

function cleanRosterRole(v) {
  const x = String(v == null ? '' : v).trim().toLowerCase();
  return ROSTER_ROLES.indexOf(x) >= 0 ? x : '';
}

module.exports = {
  STATUSES, LEGACY, EDITABLE, PENDING, ROSTER_ROLES, ACTIONS, TRANSITIONS, ACTIVITY,
  HISTORY_CAP, VERSION_CAP, NOTE_MAX,
  effStatus, rawStatuses, rights, transition, resumeOnEdit, cleanRosterRole,
};
