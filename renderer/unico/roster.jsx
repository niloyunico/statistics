/* UNICO — Duty Roster module (renderer).
 *
 * A 1:1 port of the approved design (`ui/.../Roster.dc.html`): one screen with nine
 * views behind a pill row — monthly grid (the editor), weekly board, day view, staff
 * timeline, calendar, leave calendar, tree view, shift swaps and rules & policy — plus
 * the rule-checks / float-pool / sign-off footer the design shows under the grid and
 * the rules views. Every style below is the mockup's own, transcribed verbatim.
 *
 * What the mockup fakes with sample STAFF, this wires to the real thing:
 *   data     server/duty-roster.js (`dutyRosters`, one document per unit-month)
 *   staff    window.useStaffStore(), filtered to the unit
 *   codes    window.UNICO_ROSTER (roster-spec.js) — the printed sheet's own legend
 *   rules    the design's rule engine (cfg / toggles / custom rules), persisted on
 *            the sheet under rules.cfg / rules.off / rules.custom, with the legacy
 *            minMorning/minNight keys mirrored so roster-review.jsx keeps reading
 *
 * Editing model, exactly as designed: click a cell to pick from the anchored popover,
 * paint with a brush, drag a shift onto another cell to queue a swap/move (the queue
 * drawer confirms, warns about rule breaches, and logs cross-nurse swaps), undo,
 * repeat-last-week, fill-blanks, per-row tools, auto-draft. Saving is automatic
 * (debounced) so nothing typed is lost; Publish approves the sheet and locks it.
 */

const { useState, useEffect, useMemo, useRef } = React;
const Ic = window.Ic, I = window.I;
const R = window.UNICO_ROSTER;
const MK = window.MK;

const rosApi = {
  get: (u) => fetch(u, { headers: { accept: 'application/json' } }).then((r) => r.json()),
  put: (u, b) => fetch(u, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b || {}) }).then((r) => r.json()),
  post: (u, b) => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b || {}) }).then((r) => r.json()),
  del: (u) => fetch(u, { method: 'DELETE' }).then((r) => r.json()),
};
const rosToast = (m, t) => { try { window.UI && window.UI.toast && window.UI.toast(m, t || 'success'); } catch (e) {} };
const rosCan = (a) => { try { return window.unicoCan ? window.unicoCan('roster', a) : true; } catch (e) { return true; } };
/* The key a roster row is stored under.
   NOT the employee number: two pairs of serving staff share one, and 39 people have
   none at all. The staff record's own id is unique; the employee number is display. */
const rosKey = (e) => 'S' + String(e.id);
// One staff row, as every roster screen draws it. `photo` is the face on the avatar: the grid
// passes the ROW to MK.Av, because the row key ('S'+id) is not what the photo lookup is keyed on.
/* Seniority, the way a ward lists its roster: the unit's own In-charge (Duty Roster → Setup)
   first, then by designation, then by name. Order of the tests matters ("Assistant Nurse
   Manager" before "Nurse Manager", "Senior Staff Nurse" before "Staff Nurse"). */
const ROS_RANK = [
  [/chief|\bcns\b|nursing services/i, 0],
  [/assistant\s*nurse\s*manager|asst\.?\s*nurse\s*manager/i, 2],
  [/manager/i, 1],
  [/in\s*-?\s*charge|charge\s*nurse/i, 3],
  [/team\s*leader/i, 4],
  [/supervisor|instructor|infection/i, 5],
  [/senior\s*staff\s*nurse/i, 6],
  [/trainee|intern/i, 8],
  [/patient\s*care|\bpca\b|assistant/i, 9],
  [/nurse/i, 7],
];
const rosRankOf = (desig) => { const s = String(desig || ''); for (let i = 0; i < ROS_RANK.length; i++) if (ROS_RANK[i][0].test(s)) return ROS_RANK[i][1]; return 10; };
/* Patient Care Assistants are rostered on the same sheet but are NOT nurses: they get their
   own section (grid and print) and never count toward the nurse cover rules. A staff record
   says so in `role`; older records only in the designation. */
const rosIsPca = (e) => !!e && (String(e.role || '').toUpperCase() === 'PCA' || /patient\s*care|\bpca\b/i.test(String(e.designation || e.desig || '')));
// Nurses first, then PCAs — the order inside each group is kept (stable).
const rosByGroup = (list) => list.filter((r) => !r.pca).concat(list.filter((r) => r.pca));
const rosNameKey = (n) => String(n || '').toLowerCase().replace(/^(md\.?|mst\.?|mrs\.?|mr\.?)\s+/, '').replace(/[^a-z]/g, '');
const rosSeniorSort = (list, inchargeName) => {
  const ic = rosNameKey(inchargeName);
  const key = (r) => (ic && rosNameKey(r.name) === ic ? -1 : (r.offRegister ? 99 : rosRankOf(r.desig)));
  return list.slice().sort((a, b) => (key(a) - key(b)) || String(a.name).localeCompare(String(b.name)));
};
const rosRowOf = (e) => ({ empId: rosKey(e), empIdShown: e.emp_id || '', name: e.name, desig: e.designation, pca: rosIsPca(e), photo: (MK && MK.photoUrlOf && MK.photoUrlOf(e)) || '' });
// Someone added from another unit who is not in this account's staff list: the sheet's copy.
const rosGuestRow = (id, g) => ({ empId: id, empIdShown: g.emp || '', name: g.name || id, desig: g.desig || '', pca: rosIsPca({ designation: g.desig }), photo: '' });

/* Rosters saved before rows were keyed on the staff id hold their grid under employee
   NUMBERS. Remap those on load so an existing sheet still opens. */
const rosMigrateGrid = (grid, rows) => {
  const g = grid || {};
  const keys = Object.keys(g);
  if (!keys.length) return g;
  const current = new Set(rows.map((r) => r.empId));
  if (keys.every((k) => current.has(k))) return g;
  const byEmpNo = {};
  rows.forEach((r) => { if (r.empIdShown) byEmpNo[String(r.empIdShown)] = r.empId; });
  const out = {};
  keys.forEach((k) => { out[byEmpNo[k] || k] = g[k]; });
  return out;
};

/* ---------------- design tokens, verbatim from Roster.dc.html ---------------- */
const ROS_MONO = "'IBM Plex Mono',monospace";
// bColor() — the bucket colour table the whole mockup paints with.
const ROS_BCOLOR = { G: '#6a52d4', M: '#e08a1e', E: '#0090ca', N: '#5b45c4', O: '#8b98ab' };
const rosBColor = (b) => ROS_BCOLOR[b] || '#8b98ab';
// BUCKETS — [id, label, colour, icon path] (calendar / sun / dusk / moon).
const ROS_BUCKETS = [
  ['G', 'General', '#6a52d4', 'M3 5h18v16H3zM3 9h18'],
  ['M', 'Morning', '#e08a1e', 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z'],
  ['E', 'Evening', '#0090ca', 'M12 3a9 9 0 109 9 7 7 0 01-9-9z'],
  ['N', 'Night', '#5b45c4', 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z'],
];
// The order the code-summary block lists codes in.
const ROS_CODE_ORDER = ['G1', 'G2', 'G3', 'G4', 'M1', 'M2', 'M3', 'M4', 'M6', 'M7', 'M8', 'M11', 'E1', 'E2', 'E3', 'E4', 'E6', 'E10', 'E11', 'N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N11', 'DN1', 'OFF', 'DO', 'PH', 'AL', 'CL', 'EL', 'ML', 'FL'];
// The one-click brushes.
const ROS_QUICK_BRUSH = ['M4', 'E4', 'N2', 'G1', 'OFF', 'DO', 'AL', 'CL'];
// The bucket duty windows the day view / day popup state on their face.
const ROS_WINDOWS = { G: '8 AM – 5 PM', M: '6 AM – 3 PM', E: '12 PM – 10 PM', N: '7 PM – 8 AM' };
// Deeper, text-safe tones for bucket headings (pick popover groups, day popup).
const ROS_TONE = { G: '#6a52d4', M: '#b5670a', E: '#0072a3', N: '#5b45c4', O: '#7d8ea8' };
// Leave-grid colour per code — grey rest, amber paid leave, blue casual, violet
// parental, green public holiday.
const ROS_LEAVE_TONE = { OFF: '#8b98ab', DO: '#8b98ab', AL: '#b5670a', EL: '#b5670a', CL: '#0072a3', ML: '#5b45c4', FL: '#5b45c4', PH: '#157a43' };
const ROS_LEAVE_CODES = ['AL', 'CL', 'EL', 'ML', 'FL'];

/* The rotations a nurse in-charge writes out by hand, as one-click row tools. */
const ROS_PATTERNS = [
  ['p_mmeenno', '2M · 2E · 2N · 1 off', ['M4', 'M4', 'E4', 'E4', 'N2', 'N2', 'OFF']],
  ['p_mmmoff', '3 mornings · 1 off', ['M4', 'M4', 'M4', 'OFF']],
  ['p_nnnoff', '3 nights · 2 off', ['N2', 'N2', 'N2', 'OFF', 'DO']],
  ['p_gen', 'General duty · Fri off', ['G1', 'G1', 'G1', 'G1', 'OFF', 'G1', 'DO']],
];

const ROS_METRIC_LABEL = { onDuty: 'staff on duty', morning: 'morning staff', evening: 'evening staff', night: 'night staff', general: 'general-duty staff', onLeave: 'staff on leave', nights: 'night shifts', hours: 'total hours', offDays: 'rest days', shifts: 'shifts worked', fridaysWorked: 'Fridays worked' };

// The design's default rule thresholds + toggle set.
const ROS_DEF_CFG = { minM: 2, minE: 2, minN: 2, maxNights: 3, minOff: 4, maxLeavePerDay: 1, minOnDuty: 3, ratio: '1 : 2', fridayOff: true };
const ROS_DEF_OFF = { min: true, nm: true, nights: true, offdays: true, senior: true, leave: true, ratio: true, friday: true };

// The view pill row — [id, label, icon].
const ROS_VIEW_TABS = [
  ['month', 'Monthly grid', 'M3 5h18v16H3zM3 9h18M8 3v4M16 3v4'],
  ['week', 'Weekly board', 'M4 4h16v16H4zM9 4v16M15 4v16'],
  ['day', 'Day view', 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M2 12h2M20 12h2'],
  ['staff', 'Staff timeline', 'M4 6h16M4 12h10M4 18h7'],
  ['calendar', 'Calendar', 'M3 5h18v16H3zM3 9h18M8 3v4M16 3v4'],
  ['leave', 'Leave calendar', 'M8 2v4M16 2v4M3 8h18M5 8v13h14V8'],
  ['tree', 'Tree view', 'M4 12h5M14 6h6M14 12h6M14 18h6M9 6v12M9 6h5M9 18h5'],
  ['swap', 'Shift swaps', 'M7 16H3l4-4M17 8h4l-4 4M3 16h14M21 8H7'],
  ['rules', 'Rules & policy', 'M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6zM9 12l2 2 4-4'],
];

// tab() — active pill treatment.
const rosTab = (on) => ({ display: 'inline-flex', alignItems: 'center', gap: 6, border: 0, background: on ? 'linear-gradient(135deg,#27a8db,#0072a3)' : 'transparent', color: on ? '#fff' : '#6c7a8c', padding: '7px 13px', borderRadius: 9, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s', boxShadow: on ? '0 5px 14px rgba(0,144,202,.35)' : 'none' });
// chipS() — the small status chip.
const rosChipS = (c, bg) => ({ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 10, color: c, background: bg, whiteSpace: 'nowrap' });
// av() — the rounded-square avatar; MK.Av carries the real photo, this shapes it.
const rosAvRadius = (s) => Math.round(s / 3);

// The glass card the design wraps every block in.
const ROS_CARD = { background: 'linear-gradient(152deg,rgba(255,255,255,.78),rgba(236,247,255,.48))', backdropFilter: 'blur(24px) saturate(1.7)', WebkitBackdropFilter: 'blur(24px) saturate(1.7)', border: '1px solid rgba(255,255,255,.92)', borderRadius: 16, boxShadow: '0 14px 40px rgba(31,59,90,.13),inset 0 1px 0 rgba(255,255,255,.95)', overflow: 'hidden' };
const ROS_CARD15 = { ...ROS_CARD, borderRadius: 15, boxShadow: '0 12px 36px rgba(31,59,90,.12),inset 0 1px 0 rgba(255,255,255,.95)' };
const ROS_CARD_HEAD = { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid rgba(125,145,180,.18)' };
const ROS_H3 = { margin: 0, fontSize: 13.5, fontWeight: 700, color: '#16202e' };
const rosBadge = (bg, c, n, r) => ({ display: 'inline-grid', placeItems: 'center', width: n, height: n, borderRadius: r == null ? 8 : r, background: bg, color: c, flexShrink: 0 });

const rosDow = (y, m, d) => R.DOW[new Date(y, m, d).getDay()];
const rosIsFri = (y, m, d) => new Date(y, m, d).getDay() === 5;
// Column of a date in the Saturday-first week (getDay(): Sun 0 … Sat 6).
const rosCol = (y, m, d) => (new Date(y, m, d).getDay() + 1) % 7;

/* The design's keyframes + style-hover states, injected once. */
function rosInjectCss() {
  if (typeof document === 'undefined' || document.getElementById('ros-style')) return;
  const el = document.createElement('style');
  el.id = 'ros-style';
  el.textContent = [
    '@keyframes rosPop{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
    '@keyframes rosOrbFloat{from{transform:translate(0,0) scale(1)}to{transform:translate(160px,110px) scale(1.18)}}',
    '@keyframes rosGrowW{from{width:0}}',
    '@keyframes rosSlideIn{from{opacity:0;transform:translateX(26px)}to{opacity:1;transform:none}}',
    '@keyframes rosSlideInY{from{opacity:0;transform:translate(26px,-50%)}to{opacity:1;transform:translate(0,-50%)}}',
    '@keyframes rosPopCard{0%{opacity:0;transform:scale(.9) translateY(10px)}100%{opacity:1;transform:none}}',
    '.ros-kpi:hover{transform:translateY(-3px)!important;box-shadow:0 20px 46px rgba(31,59,90,.18)!important}',
    '.ros-trow:hover{background:rgba(39,168,219,.07)!important}',
    '.ros-vio:hover{background:rgba(210,58,82,.2)!important}',
    '.ros-auto:hover{background:rgba(106,82,212,.18)!important}',
    '.ros-treerow:hover{background:rgba(0,144,202,.08)!important}',
    '.ros-navbtn:hover{background:#fff!important}',
    '.ros-goday:hover{background:rgba(0,144,202,.18)!important}',
    '.ros-lift:hover{transform:translateY(-1px)}',
    '.ros-x:hover{background:rgba(125,145,180,.16)!important;color:#16202e!important}',
    '.ros-xred:hover{background:rgba(210,58,82,.12)!important;color:#a92c42!important}',
    '.ros-decl:hover{background:rgba(210,58,82,.1)!important}',
  ].join('\n');
  document.head.appendChild(el);
}

/* ---------------- the rule engine, exactly as designed ----------------
   Thresholds come from cfg, toggles from `en` (the design's state.off), plus the
   user-defined custom rules. Returns the built-in + custom rule rows the footer and
   the rules view read, and the flat violation lists per category. */
function rosEval(grid, rows, days, year, month, cfg, en, custom) {
  const N = rows.length;
  // Cover (how many are on each shift, closed days) counts NURSES: a PCA on night is not a
  // nurse on night. Personal rules below still run on everyone. A unit with no nurse on the
  // sheet (PCA-only) counts its PCAs, rather than reporting every day empty.
  const CI = (() => { const a = []; for (let i = 0; i < N; i++) if (!rows[i].pca) a.push(i); return a.length ? a : rows.map((_, i) => i); })();
  const code = (i, d) => (grid[rows[i].empId] || {})[d] || '';
  const bOf = (c) => R.bucketOf(c) || '';
  const dayBucketCount = (d, b) => { let n = 0; for (const i of CI) if (bOf(code(i, d)) === b) n++; return n; };
  const dayMetric = (d, m) => {
    if (m === 'onDuty') { let n = 0; for (const i of CI) { const b = bOf(code(i, d)); if (b && b !== 'O') n++; } return n; }
    if (m === 'onLeave') { let n = 0; for (const i of CI) if (ROS_LEAVE_CODES.indexOf(code(i, d)) >= 0) n++; return n; }
    return dayBucketCount(d, { general: 'G', morning: 'M', evening: 'E', night: 'N' }[m] || 'M');
  };
  const staffMetric = (i, m) => {
    let nights = 0, hours = 0, offs = 0, shifts = 0, friWork = 0;
    for (let d = 1; d <= days; d++) {
      const c = code(i, d), b = bOf(c);
      if (b === 'N') nights++;
      if (b === 'O') offs++; else if (b) shifts++;
      hours += R.hoursOf(c);
      if (rosIsFri(year, month, d) && b && b !== 'O') friWork++;
    }
    return { nights, hours, offDays: offs, shifts, fridaysWorked: friWork }[m] || 0;
  };
  /* A CLOSED day: every nurse has a code written and every one of them is off/leave —
     the unit is deliberately shut (the Friday holiday, Eid, …). Coverage rules must
     not flag it: "0 on duty" on a planned unit holiday is the roster working, not
     failing. A BLANK day (codes missing) still warns — that roster is unfinished. */
  const closedDays = {};
  for (let d = 1; d <= days; d++) {
    let written = 0, on = 0;
    for (const i of CI) { const b = bOf(code(i, d)); if (b) { written++; if (b !== 'O') on++; } }
    if (CI.length > 0 && written === CI.length && on === 0) closedDays[d] = true;
  }
  const viol = { ratio: [], min: [], nm: [], nights: [], off: [], senior: [], leave: [], friday: [] };
  for (let d = 1; d <= days; d++) {
    if (!closedDays[d]) {
      if (en.min !== false) [['M', cfg.minM], ['E', cfg.minE], ['N', cfg.minN]].forEach(([b, mn]) => { const n = dayBucketCount(d, b); if (n < mn) viol.min.push('Day ' + d + ' ' + b + ' has ' + n); });
      // Senior-on-nights flags a night SOMEONE is holding without a senior — a day
      // with no night shift at all is the minimum-staff rule's business, not this one's.
      if (en.senior !== false) { let night = 0, sen = false; for (const i of CI) { if (bOf(code(i, d)) === 'N') { night++; if (/Senior|Team|Charge/.test(rows[i].desig || '')) sen = true; } } if (night && !sen) viol.senior.push('Day ' + d + ' night'); }
      if (en.ratio !== false) { const on = dayMetric(d, 'onDuty'); if (on < cfg.minOnDuty) viol.ratio.push('Day ' + d + ' only ' + on + ' on duty'); }
    }
    if (en.leave !== false) { const away = []; for (let i = 0; i < N; i++) if (ROS_LEAVE_CODES.indexOf(code(i, d)) >= 0) away.push(rows[i].name); if (away.length > cfg.maxLeavePerDay) viol.leave.push('Day ' + d + ': ' + away.join(', ')); }
  }
  for (let i = 0; i < N; i++) {
    let run = 0, offs = 0, fri = 0;
    for (let d = 1; d <= days; d++) {
      const c = code(i, d), b = bOf(c);
      if (b === 'N') { run++; if (en.nights !== false && run > cfg.maxNights) viol.nights.push(rows[i].name + ' day ' + d); } else run = 0;
      if (b === 'O') offs++;
      if (en.nm !== false && d > 1 && bOf(code(i, d - 1)) === 'N' && b === 'M') viol.nm.push(rows[i].name + ' day ' + d);
      if (rosIsFri(year, month, d) && b === 'O') fri++;
    }
    if (en.offdays !== false && offs < cfg.minOff) viol.off.push(rows[i].name + ' has ' + offs + ' rest days');
    if (en.friday !== false && cfg.fridayOff && fri === 0) viol.friday.push(rows[i].name + ' worked every Friday');
  }
  const customResults = (custom || []).map((r) => {
    const hits = [];
    const bad = (v) => (r.op === '<' ? v < r.val : r.op === '>' ? v > r.val : v === r.val);
    if (r.scope === 'day') { for (let d = 1; d <= days; d++) { const v = dayMetric(d, r.metric); if (bad(v)) hits.push('Day ' + d + ' = ' + v); } }
    else { for (let i = 0; i < N; i++) { const v = staffMetric(i, r.metric); if (bad(v)) hits.push(rows[i].name + ' = ' + v); } }
    return { rule: r, hits };
  });
  const rules = [
    ['Nurse-to-patient ratio per shift', cfg.ratio + ' · at least ' + cfg.minOnDuty + ' on duty', viol.ratio, 'ratio'],
    ['Minimum staff per shift', 'M ≥ ' + cfg.minM + ' · E ≥ ' + cfg.minE + ' · N ≥ ' + cfg.minN, viol.min, 'min'],
    ['No night → morning back-to-back', 'at least one rest between', viol.nm, 'nm'],
    ['Max consecutive nights', 'no more than ' + cfg.maxNights + ' in a row', viol.nights, 'nights'],
    ['Weekly off entitlement', cfg.minOff + ' rest days per month minimum', viol.off, 'offdays'],
    ['Senior nurse on every shift', 'senior / team leader / charge on nights', viol.senior, 'senior'],
    ['Leave clash warnings', 'no more than ' + cfg.maxLeavePerDay + ' on leave per day', viol.leave, 'leave'],
    ['Friday off entitlement (BD)', 'every nurse gets at least one Friday off', viol.friday, 'friday'],
  ].filter((r) => en[r[3]] !== false).concat(customResults.map((cr) => [cr.rule.name, 'custom · ' + cr.rule.scope + ' ' + cr.rule.metric + ' ' + cr.rule.op + ' ' + cr.rule.val, cr.hits, 'custom']));
  const totalViol = rules.reduce((a, r) => a + r[2].length, 0);
  const okRules = rules.filter((r) => !r[2].length).length;
  return { viol, customResults, rules, totalViol, okRules, dayMetric, staffMetric, dayBucketCount, closedDays };
}

/* ---------------- store ---------------- */
function useRosterIndex() {
  const [state, setState] = useState({ rosters: [], loading: true, error: null });
  const load = React.useCallback(() => rosApi.get('/api/rosters').then((r) => {
    if (r && r.ok) setState({ rosters: r.rosters || [], loading: false, error: null });
    else setState((s) => ({ ...s, loading: false, error: (r && r.error) || 'Could not load rosters.' }));
  }).catch(() => setState((s) => ({ ...s, loading: false, error: 'Could not reach the server.' }))), []);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

/* What this account may do in the module, and in which units.

   The unit a roster is filed under is the free text on a staff record, so deciding
   which of those strings falls inside someone's assignment needs the department map,
   the alias table and the Level-N rule — all server-side, and they must stay there or
   the screen and the API would disagree about who may open what. So the server answers
   with the literal unit strings (/api/rosters/scope) and this only compares them.

   `units === null` means "not answered yet / every unit" — never render a narrowed
   list from it, or an older server (no such route) would show an empty module. */
function useRosterScope() {
  const [state, setState] = useState({ units: null, scope: 'all', can: null, loading: true });
  useEffect(() => {
    let live = true;
    rosApi.get('/api/rosters/scope').then((r) => {
      if (!live) return;
      if (r && r.ok) setState({ units: Array.isArray(r.units) ? r.units : null, scope: r.scope || 'all', can: r.can || null, loading: false });
      else setState((s) => ({ ...s, loading: false }));
    }).catch(() => { if (live) setState((s) => ({ ...s, loading: false })); });
    return () => { live = false; };
  }, []);
  // A Set only when the account is actually narrowed — 'all' must never build one, or a
  // unit the register spells slightly differently would drop off its own roster list.
  const allowed = useMemo(() => (state.scope === 'departments' && state.units ? new Set(state.units) : null), [state.scope, state.units]);
  return { ...state, allowed, inScope: (d) => !allowed || allowed.has(d) };
}

/* The people the sheet is built from.

   Normally the shared staff register (window.useStaffStore), which is live, shared with
   every other module and already mirrored in the browser. But the roster can be granted
   WITHOUT the staff register — that is the whole point of a separate assignment — and in
   that case the store is useless here: its refresh bails out on unicoCan('staff','view')
   and its empty-state falls back to the DEMO SEED, so the in-charge meant to fill the
   roster in would have seen a grid of fictional nurses.

   So: no staff permission -> take the unit's people from the roster module's own thin
   feed (/api/rosters/staff), which carries a name, a number and a designation and
   nothing else about a colleague. */
function useRosterStaff() {
  const store = window.useStaffStore();
  const mayStaff = (() => { try { return window.unicoCan ? window.unicoCan('staff', 'view') : true; } catch (e) { return true; } })();
  const [own, setOwn] = useState(null);
  useEffect(() => {
    if (mayStaff) return undefined;
    let live = true;
    rosApi.get('/api/rosters/staff').then((r) => { if (live && r && r.ok && Array.isArray(r.staff)) setOwn(r.staff); })
      .catch(() => {});
    return () => { live = false; };
  }, [mayStaff]);
  return useMemo(() => (mayStaff ? store : { ...store, staff: own || [] }), [mayStaff, store, own]);
}

/* ---------------- the shift legend, exactly as designed ----------------
   legendRows: one card per bucket — 3px colour spine, uppercase bucket label with a
   square dot, then every code the bucket owns with its printed time string. */
function RosLegendPanel() {
  return (
    <div style={{ padding: '10px 16px 12px', borderBottom: '1px solid rgba(125,145,180,.18)', background: 'rgba(247,251,255,.6)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 9 }}>
      {[['G', 'General', '#6a52d4'], ['M', 'Morning', '#e08a1e'], ['E', 'Evening', '#0090ca'], ['N', 'Night', '#5b45c4'], ['O', 'Leave / off', '#8b98ab']].map(([b, label, c]) => (
        <div key={b} style={{ background: 'rgba(255,255,255,.7)', border: '1px solid ' + c + '2e', borderLeft: '3px solid ' + c, borderRadius: 10, padding: '9px 11px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: c, flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: .7, textTransform: 'uppercase', color: c }}>{label}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {R.SHIFTS.filter((s) => s.bucket === b).map((s) => (
              <div key={s.code} style={{ display: 'flex', alignItems: 'baseline', gap: 7, fontSize: 10.5, color: '#6c7a8c', lineHeight: 1.5 }}>
                <b style={{ fontFamily: ROS_MONO, fontSize: 10, fontWeight: 700, color: c, minWidth: 26, flexShrink: 0 }}>{s.code}</b>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// The compact text legend the printable sheet keeps (1:1 with the workbook footer).
function ShiftLegend({ compact }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {R.BUCKETS.map((b) => {
        const codes = R.SHIFTS.filter((s) => s.bucket === b.id);
        return (
          <div key={b.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: compact ? 10.4 : 11.4 }}>
            <span style={{ minWidth: 62, fontWeight: 700, color: b.color }}>{b.label}</span>
            <span className="sub" style={{ flex: 1, lineHeight: 1.6 }}>
              {codes.map((c) => c.code + ': ' + c.label).join('  |  ')}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Putting someone from another unit on a sheet (or taking them off) is an administrator's call;
// the server holds the same line (staff-search 403, a non-admin save keeps the stored guests).
// No signed-in user = open local-PC mode, which the server also treats as administrator.
const rosIsAdmin = () => { try { const u = window.__UNICO_USER__; return !u || u.role === 'Administrator'; } catch (e) { return false; } };
// Corner marks on a grid cell: on call on top of the shift, and an AL whose worked date is not set.
const ROS_OC_BADGE = { position: 'absolute', top: -5, right: -6, fontStyle: 'normal', fontSize: 7, fontWeight: 800, lineHeight: '11px', padding: '0 3px', borderRadius: 5, background: '#0d3a5c', color: '#fff', letterSpacing: .3, boxShadow: '0 1px 3px rgba(0,0,0,.25)', pointerEvents: 'none' };
const ROS_MARK_CORNER = { position: 'absolute', top: 0, left: 0, width: 0, height: 0, borderTop: '9px solid #d23a52', borderRight: '9px solid transparent', borderTopLeftRadius: 5, pointerEvents: 'none' };
const ROS_AL_DOT = { position: 'absolute', top: 2, right: 2, width: 6, height: 6, borderRadius: '50%', background: '#e08a1e', boxShadow: '0 0 0 1.5px #fff', pointerEvents: 'none' };
// "Show who entered": a small square in the cell's lower-left corner, one colour per person.
const ROS_WHO_TAG = { position: 'absolute', left: 1, bottom: 1, width: 7, height: 7, borderRadius: 2, boxShadow: '0 0 0 1.5px #fff', pointerEvents: 'none' };
const ROS_WHO_COLORS = ['#0090ca', '#d4572a', '#1f9d57', '#8e44ad', '#c0392b', '#b5670a', '#2c3e50', '#16a085', '#d63384', '#5b6b00'];
const rosPortal = (n) => (window.ReactDOM && window.ReactDOM.createPortal && typeof document !== 'undefined') ? window.ReactDOM.createPortal(n, document.body) : n;   // a .card (backdrop-filter) would trap position:fixed

/* ---- THE REVIEW CHAIN ----
   The in-charge drafts the sheet and sends it to the unit's Manager (or straight to the
   CNS, with a warning). The Manager forwards it to the CNS or returns it; the CNS approves
   it or returns it. A return may carry a note and always flags the sheet red.

   The SERVER decides every step (server/roster-workflow.js) and says, per sheet, which
   steps this account may take (`roster.can`). The screen only offers those — it never
   works out a right of its own, so the button shown and the API answer cannot disagree.
   Who is the In-charge / Manager / CNS is set once by an administrator (Duty Roster →
   Setup) and arrives with the sheet as `signers`. */
const ROS_STATUS = {
  draft: { label: 'Draft', color: '#b5670a', bg: 'rgba(224,138,30,.14)' },
  pending_manager: { label: 'Pending Manager', color: '#0072a3', bg: 'rgba(0,144,202,.12)' },
  pending_cns: { label: 'Pending CNS', color: '#5b45c4', bg: 'rgba(106,82,212,.13)' },
  approved: { label: 'Approved', color: '#157a43', bg: 'rgba(31,157,87,.13)' },
  returned: { label: 'Returned', color: '#b4232f', bg: 'rgba(210,58,82,.12)' },
  none: { label: 'Not submitted', color: '#7d8ea8', bg: 'rgba(125,145,180,.14)' },
};
// Sheets handed in before the chain existed say 'submitted' — they were waiting for the CNS.
const rosStatusNorm = (st) => (st === 'submitted' ? 'pending_cns' : ROS_STATUS[st] ? st : (st ? 'draft' : 'none'));
const ROS_EDITABLE = ['draft', 'returned'];
const ROS_SEND_ICON = 'M22 2L11 13M22 2l-7 20-4-9-9-4z';
const ROS_ACTIONS = {
  send_manager: { label: 'Send to Manager', done: 'Sent to the Manager for checking.', tone: 'pri', icon: ROS_SEND_ICON },
  send_cns: { label: 'Send to CNS', done: 'Sent straight to the CNS for approval.', tone: 'ghost', icon: ROS_SEND_ICON },
  forward: { label: 'Forward to CNS', done: 'Forwarded to the CNS for approval.', tone: 'pri', icon: 'M5 12h14M13 6l6 6-6 6' },
  approve: { label: 'Approve', done: 'Roster approved and locked.', tone: 'ok', icon: 'M4 12l5 5L20 6' },
  return: { label: 'Return', done: 'Roster returned to the in-charge.', tone: 'danger', icon: 'M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3' },
  reopen: { label: 'Reopen', done: 'Roster reopened for editing.', tone: 'ghost', icon: 'M1 4v6h6M3.5 15a9 9 0 102.1-9.4L1 10' },
};
const ROS_HIST_LABEL = { send_manager: 'Sent to Manager', send_cns: 'Sent straight to CNS', forward: 'Forwarded to CNS', approve: 'Approved', return: 'Returned', reopen: 'Reopened', resume: 'Edited after return', edit: 'Edited during review', create: 'Created' };
const rosWhen = (t) => {
  if (!t) return '';
  const d = new Date(t);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};
// Same id the server builds (rosterId cuts the department to 40 characters). Only a
// fallback: a loaded sheet carries its own id.
const rosSheetId = (dept, year, month) => 'ros-' + String(dept).slice(0, 40) + '-' + year + '-' + String(month).padStart(2, '0');

/* Who sits where in the chain, per department (Duty Roster → Setup). Names only — every
   roster viewer may read it, only an administrator may change it. Cached for the session;
   the setup screen reloads it after a save. */
let ROS_CFG = null, ROS_CFG_REQ = null;
function rosLoadConfig(force) {
  if (ROS_CFG && !force) return Promise.resolve(ROS_CFG);
  if (ROS_CFG_REQ && !force) return ROS_CFG_REQ;
  ROS_CFG_REQ = rosApi.get('/api/rosters/config')
    .then((j) => { ROS_CFG = (j && j.ok) ? j : { cns: null, depts: [] }; ROS_CFG_REQ = null; return ROS_CFG; })
    .catch(() => { ROS_CFG_REQ = null; return ROS_CFG || { cns: null, depts: [] }; });
  return ROS_CFG_REQ;
}
function useRosterConfig() {
  const [v, setV] = useState(ROS_CFG);
  useEffect(() => { let live = true; rosLoadConfig().then((x) => { if (live) setV(x); }); return () => { live = false; }; }, []);
  const reload = React.useCallback(() => rosLoadConfig(true).then((x) => { setV(x); return x; }), []);
  return { cns: (v && v.cns) || null, depts: (v && v.depts) || [], supervisors: (v && v.supervisors) || [], updatedAt: v && v.updatedAt, loading: !v, reload };
}

/* The rule set a stored sheet carries, in the shape rosEval wants. New sheets store the
   design's cfg/off/custom; older ones only the legacy minMorning/... keys. */
const rosRulesOf = (ru) => {
  ru = ru || {};
  let cfg = { ...ROS_DEF_CFG, ...(ru.cfg || {}) };
  if (!ru.cfg && ru.minMorning) {
    cfg = {
      ...cfg,
      minM: (ru.minMorning && ru.minMorning.value) || cfg.minM,
      minE: (ru.minEvening && ru.minEvening.value) || cfg.minE,
      minN: (ru.minNight && ru.minNight.value) || cfg.minN,
      maxNights: (ru.maxConsecNight && ru.maxConsecNight.value) || cfg.maxNights,
      maxLeavePerDay: (ru.leaveClash && ru.leaveClash.value) || cfg.maxLeavePerDay,
    };
  }
  return { cfg, en: { ...ROS_DEF_OFF, ...(ru.off || {}) }, custom: Array.isArray(ru.custom) ? ru.custom : [] };
};
// One rule engine for the editor AND every review screen, so the count the in-charge saw
// when sending is the count the Manager and the CNS see when deciding.
const rosFindingsOf = (grid, rows, year, month, rules) => {
  const r = rosRulesOf(rules);
  return rosEval(grid || {}, rows || [], R.daysIn(year, month), year, month, r.cfg, r.en, r.custom);
};

/* The rows a stored sheet shows outside the editor (review preview, versions).
   Order as saved; people no longer on the register keep the name stored with the sheet. */
const rosRowsFrom = (doc, staff, dept, withRegister, inchargeName) => {
  const all = {};
  (staff || []).forEach((e) => { all[rosKey(e)] = e; });
  const supIds = R.SUPERVISOR_UNIT === dept ? new Set(((ROS_CFG && ROS_CFG.supervisors) || []).map((x) => String(x.id))) : null;
  // Staff added from another unit sit on this sheet; this unit's people MOVED onto another
  // unit's sheet that month (`movedOut`, from the month GET) are left off unless they have shifts here.
  const guests = (doc && doc.guests) || {};
  const moved = new Set((doc && doc.movedOut) || []);
  const reg = withRegister === false ? [] : (staff || [])
    .filter((e) => e.is_active !== false && !e.former && (supIds ? supIds.has(String(e.id)) : R.unitOf(e) === dept))
    .map((e) => rosRowOf(e))
    .filter((r) => !moved.has(r.empId) || Object.keys((doc && doc.grid && doc.grid[r.empId]) || {}).length);
  const known = Object.keys(all).map((k) => ({ empId: k, empIdShown: all[k].emp_id || '' }));
  const grid = rosMigrateGrid(doc && doc.grid, known);
  const names = (doc && doc.names) || {};
  const seen = {}, out = [];
  const add = (id) => {
    if (!id || seen[id]) return; seen[id] = 1;
    const e = all[id];
    const g = guests[id];
    out.push(e ? rosRowOf(e)
      : g ? rosGuestRow(id, g)
      : { empId: id, empIdShown: '', name: names[id] || id, desig: '' });
  };
  ((doc && doc.order) || []).forEach((id) => { if (grid[id] || guests[id] || reg.some((r) => r.empId === id)) add(id); });
  Object.keys(grid).forEach(add);
  reg.forEach((r) => add(r.empId));
  Object.keys(guests).forEach(add);
  // A sequence someone arranged by hand is kept as saved; otherwise seniority.
  const manual = !!(doc && doc.rules && doc.rules.orderManual);
  return { rows: rosByGroup(manual ? out : rosSeniorSort(out, inchargeName)), grid };
};

function RosStatusChip({ st, stage, big }) {
  const s = ROS_STATUS[rosStatusNorm(st)];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: big ? 11.5 : 10.5, fontWeight: 700, padding: big ? '6px 12px' : '3px 9px', borderRadius: 14, whiteSpace: 'nowrap', color: s.color, background: s.bg, border: '1px solid ' + s.color + '33' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color }} />{s.label}{stage ? ' · ' + stage : ''}
    </span>
  );
}

/* The steps this account may take on one sheet, in the order a reviewer reads them:
   the soft way out first (Return / Send to CNS), the main step last. */
function RosDecisionButtons({ status, can, onAction, busy, compact, hasManager, selfManager }) {
  const c = can || {};
  const resend = rosStatusNorm(status) === 'returned';
  const tones = {
    pri: { background: 'linear-gradient(135deg,#27a8db,#0072a3)', color: '#fff', border: '1px solid transparent', boxShadow: '0 6px 16px rgba(0,144,202,.28)' },
    ok: { background: 'linear-gradient(135deg,#2fbf7f,#157a43)', color: '#fff', border: '1px solid transparent', boxShadow: '0 6px 16px rgba(31,157,87,.28)' },
    danger: { background: 'rgba(210,58,82,.07)', color: '#b4232f', border: '1px solid rgba(210,58,82,.35)' },
    ghost: { background: 'rgba(255,255,255,.9)', color: '#0072a3', border: '1px solid rgba(0,114,163,.3)' },
  };
  const btn = (a, label) => {
    const m = ROS_ACTIONS[a];
    const noMgr = a === 'send_manager' && hasManager === false;
    const dis = busy || noMgr;
    return (
      <button key={a} type="button" disabled={dis} onClick={(e) => { e.stopPropagation(); onAction(a); }}
        title={noMgr ? 'No Manager is set for this unit — an administrator sets one under Duty Roster → Setup.' : ''}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: compact ? '5px 10px' : '8px 14px', borderRadius: 9, fontSize: compact ? 11 : 12, fontWeight: 700, fontFamily: 'inherit', cursor: dis ? 'default' : 'pointer', opacity: dis ? .5 : 1, whiteSpace: 'nowrap', ...tones[m.tone] }}>
        <Ic d={m.icon} s={compact ? 12 : 13} sw={2.2} />{label || m.label}
      </button>
    );
  };
  const out = [];
  // The sender is also this unit's Manager: their check is part of sending — one button, and the
  // server forwards it on to the CNS (applyTransition).
  if (c.send && selfManager) out.push(btn('send_manager', 'Check & send to CNS'));
  else if (c.send) { out.push(btn('send_cns', resend ? 'Resend to CNS' : null)); out.push(btn('send_manager', resend ? 'Resend to Manager' : null)); }
  if (c.return) out.push(btn('return'));
  if (c.forward) out.push(btn('forward'));
  if (c.approve) out.push(btn('approve'));
  if (c.reopen) out.push(btn('reopen'));
  if (!out.length) return null;
  return <div style={{ display: 'inline-flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>{out}</div>;
}

// Return note. Optional by design: a reviewer may send a sheet back with or without a
// reason, and the return is red-flagged on the sheet either way.
function RosNoteModal({ what, busy, onCancel, onConfirm, initial }) {
  const [note, setNote] = useState(initial || '');
  const presets = ['Night cover is below the minimum', 'Rule warnings are not resolved', 'Wrong staff on the sheet', 'Leave clash', 'Too many consecutive nights'];
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  return rosPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(16,32,46,.42)', display: 'grid', placeItems: 'center', padding: 16 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={{ width: 'min(520px,100%)', background: 'var(--panel,#fff)', borderRadius: 14, boxShadow: '0 24px 60px rgba(16,32,46,.3)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(125,145,180,.18)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'inline-grid', placeItems: 'center', width: 30, height: 30, borderRadius: 9, background: 'rgba(210,58,82,.12)', color: '#b4232f' }}><Ic d={ROS_ACTIONS.return.icon} s={15} sw={2.2} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 14.5, color: '#16202e' }}>Return this roster</div>
            <div style={{ fontSize: 11.5, color: '#6c7a8c' }}>{what} goes back to the in-charge, flagged red.</div>
          </div>
        </div>
        <div style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6c7a8c', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>Reason <span style={{ textTransform: 'none', fontWeight: 500 }}>(optional)</span></div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {presets.map((p) => (
              <button key={p} type="button" onClick={() => setNote((n) => ((n ? n.replace(/\s*$/, '') + '\n' : '') + p).slice(0, 500))}
                style={{ border: '1px solid rgba(125,145,180,.35)', background: 'rgba(125,145,180,.08)', color: '#3c4858', borderRadius: 14, padding: '4px 10px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer' }}>{p}</button>
            ))}
          </div>
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={4} autoFocus
            placeholder="What should the in-charge fix? Leave blank to return without a note."
            style={{ width: '100%', boxSizing: 'border-box', borderRadius: 9, border: '1px solid rgba(125,145,180,.4)', padding: '9px 11px', fontFamily: 'inherit', fontSize: 12.5, resize: 'vertical', outline: 'none' }} />
          <div style={{ fontSize: 10.5, color: '#9aa6b4', textAlign: 'right' }}>{note.length}/500</div>
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(125,145,180,.18)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" disabled={busy} onClick={() => onConfirm(note.trim())}
            style={{ border: 0, borderRadius: 9, padding: '8px 16px', fontWeight: 700, fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer', color: '#fff', background: 'linear-gradient(135deg,#e8697f,#b4232f)' }}>
            {note.trim() ? 'Return with note' : 'Return without note'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Runs one step of the chain: asks first (every step changes who holds the sheet), then
   posts it. Returns the server's answer; `modal` must be rendered by the caller. */
function useRosDecide() {
  const [ask, setAsk] = useState(null);
  const [busy, setBusy] = useState(false);
  const post = (id, action, note) => {
    setBusy(true);
    return rosApi.post('/api/rosters/' + encodeURIComponent(id) + '/transition', { action, note: note || '' }).then((r) => {
      setBusy(false);
      if (r && r.ok) {
        rosToast(ROS_ACTIONS[action].done);
        try { window.dispatchEvent(new Event('unico:ros-refresh')); } catch (e) { /* old browser */ }
        return r;
      }
      rosToast((r && r.error) || 'Could not complete that step.', 'error');
      return r || { ok: false };
    }).catch(() => { setBusy(false); rosToast('Could not reach the server.', 'error'); return { ok: false }; });
  };
  const run = async ({ id, action, unit, period, warnings, selfManager, note: initialNote }) => {
    const what = unit + ' · ' + period;
    if (action === 'return') {
      const note = await new Promise((resolve) => setAsk({ what, resolve, initial: initialNote || '' }));
      if (note === null) return { ok: false, cancelled: true };
      return post(id, action, note);
    }
    const warn = warnings ? ' It still has ' + warnings + ' rule warning' + (warnings === 1 ? '' : 's') + '.' : '';
    const msgs = {
      send_manager: selfManager
        ? ['Check and send to the CNS?', 'You are also this unit’s Manager, so your check is part of sending: ' + what + ' goes straight to the CNS for approval.' + warn]
        : ['Send to the Manager?', what + ' goes to the unit Manager for checking. It is locked while it is with them.' + warn],
      send_cns: ['Send straight to the CNS?', 'This skips the Manager check. ' + what + ' goes directly to the CNS for approval.' + warn, true],
      forward: ['Forward to the CNS?', 'You have checked ' + what + '. It goes to the CNS for final approval.'],
      approve: ['Approve this roster?', what + ' becomes the published roster and is locked.' + warn],
      reopen: ['Reopen this roster?', what + ' goes back to draft so it can be edited. It has to be sent for review again.', true],
    };
    const m = msgs[action];
    if (m) {
      const UI = window.UI || {};
      const yes = UI.confirm ? await UI.confirm({ title: m[0], message: m[1], confirmLabel: ROS_ACTIONS[action].label, danger: !!m[2] }) : true;
      if (!yes) return { ok: false, cancelled: true };
    }
    return post(id, action, '');
  };
  const modal = ask ? <RosNoteModal what={ask.what} initial={ask.initial} busy={busy} onCancel={() => { ask.resolve(null); setAsk(null); }} onConfirm={(n) => { ask.resolve(n); setAsk(null); }} /> : null;
  return { run, modal, busy };
}

// The sheet's own story, newest first: every send, forward, return and approval.
function RosHistoryTimeline({ history, empty }) {
  const list = (history || []).slice().reverse();
  if (!list.length) return <div style={{ padding: '10px 2px', fontSize: 12, color: '#8a97a8' }}>{empty || 'Nothing yet — the history starts the first time this sheet is sent for review.'}</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {list.map((h, i) => {
        const c = h.action === 'return' ? '#b4232f' : h.action === 'approve' ? '#157a43' : ROS_STATUS[rosStatusNorm(h.to)].color;
        return (
          <div key={i} style={{ display: 'flex', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 12, flexShrink: 0 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: c, marginTop: 4, boxShadow: '0 0 0 3px ' + c + '22' }} />
              {i < list.length - 1 && <span style={{ flex: 1, width: 2, background: 'rgba(125,145,180,.25)', marginTop: 3 }} />}
            </div>
            <div style={{ minWidth: 0, flex: 1, paddingBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#16202e' }}>{ROS_HIST_LABEL[h.action] || h.action} <span style={{ fontWeight: 500, color: '#6c7a8c' }}>· {h.byName || h.by || '—'}</span></div>
              <div style={{ fontSize: 10.5, color: '#8a97a8' }}>{rosWhen(h.at)}{h.revision != null ? ' · rev ' + h.revision : ''}</div>
              {h.action === 'return' && !h.note && <div style={{ marginTop: 4, fontSize: 11, color: '#8c1d2a', fontStyle: 'italic' }}>No reason given</div>}
              {h.note && <div style={{ marginTop: 4, fontSize: 11.5, color: h.action === 'return' ? '#8c1d2a' : '#3c4858', background: h.action === 'return' ? 'rgba(210,58,82,.08)' : 'rgba(125,145,180,.1)', borderLeft: '3px solid ' + c, padding: '5px 8px', borderRadius: 6, whiteSpace: 'pre-wrap' }}>{h.note}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// The red flag a returned sheet carries until it is sent again.
/* The notes a reviewer pinned to cells ("Rahima · 12 Nov — no night after leave"), listed under
   the returned banner. Clicking one opens that cell; Done clears it (POST …/marks remove). */
function RosMarkList({ marks, rows, year, month, canDone, onDone, onOpen }) {
  const nameOf = {}; (rows || []).forEach((r) => { nameOf[r.empId] = r.name; });
  const list = [];
  Object.keys(marks || {}).forEach((emp) => Object.keys(marks[emp] || {}).forEach((d) => list.push({ emp, d: Number(d), ...marks[emp][d] })));
  if (!list.length) return null;
  list.sort((a, b) => a.d - b.d || String(nameOf[a.emp] || '').localeCompare(String(nameOf[b.emp] || '')));
  const day = (d) => new Date(year, month, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(210,58,82,.28)', borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#8c1d2a', marginBottom: 6 }}>Review notes · {list.length} cell{list.length === 1 ? '' : 's'} to fix</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {list.map((m) => (
          <div key={m.emp + '|' + m.d} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 8px', borderRadius: 8, background: 'rgba(210,58,82,.05)' }}>
            <span onClick={() => onOpen && onOpen(m.emp, m.d)} style={{ cursor: onOpen ? 'pointer' : 'default', flex: 1, minWidth: 0, fontSize: 12, color: '#16202e' }}>
              <b>{nameOf[m.emp] || m.emp}</b> · {day(m.d)}{m.code ? <span style={{ fontFamily: ROS_MONO, fontWeight: 700, color: '#6c7a8c' }}> ({m.code})</span> : null} — {m.note}
              <span style={{ color: '#8a97a8', fontSize: 10.5 }}> · {m.byName || m.by || 'reviewer'}</span>
            </span>
            {canDone && <button type="button" className="btn sm" onClick={() => onDone(m.emp, m.d)}>Done</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

function RosReturnedBanner({ meta }) {
  const m = meta || {};
  const by = m.returnedByName || m.returnedBy || 'the reviewer';
  const stage = m.returnStage === 'manager' ? 'Manager' : m.returnStage === 'cns' ? 'CNS' : '';
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'rgba(210,58,82,.07)', border: '1px solid rgba(210,58,82,.3)', borderLeft: '4px solid #b4232f', borderRadius: 12, padding: '11px 15px', marginBottom: 14 }}>
      <span style={{ display: 'inline-grid', placeItems: 'center', width: 28, height: 28, borderRadius: 8, background: 'rgba(210,58,82,.14)', color: '#b4232f', flexShrink: 0 }}><Ic d={ROS_ACTIONS.return.icon} s={14} sw={2.2} /></span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: '#8c1d2a' }}>Returned by {by}{stage ? ' (' + stage + ')' : ''}{m.returnedAt ? ' · ' + rosWhen(m.returnedAt) : ''}</div>
        <div style={{ fontSize: 12, color: m.returnNote ? '#5a1620' : '#9a5a63', marginTop: 3, whiteSpace: 'pre-wrap', fontStyle: m.returnNote ? 'normal' : 'italic' }}>{m.returnNote || 'No reason given.'}</div>
        <div style={{ fontSize: 10.5, color: '#9a5a63', marginTop: 4 }}>Fix the sheet, then send it again. The return stays in the sheet's history.</div>
      </div>
    </div>
  );
}

// A side drawer (history, versions). Portalled: the glass cards trap position:fixed.
function RosDrawer({ title, sub, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  return rosPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 8500, background: 'rgba(16,32,46,.32)', display: 'flex', justifyContent: 'flex-end' }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: wide ? 'min(1180px,100%)' : 'min(420px,100%)', height: '100%', background: 'var(--panel,#fff)', boxShadow: '-18px 0 50px rgba(16,32,46,.22)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(125,145,180,.18)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 14.5, color: '#16202e' }}>{title}</div>
            {sub && <div style={{ fontSize: 11.5, color: '#6c7a8c' }}>{sub}</div>}
          </div>
          <button className="btn sm" type="button" onClick={onClose}>Close</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '14px 18px' }}>{children}</div>
      </div>
    </div>
  );
}

/* A stored sheet, read-only: the codes coloured by bucket, the per-person totals.
   Used wherever a roster is LOOKED AT rather than edited — review, versions, staff view. */
function RosSheetTable({ rows, grid, year, month, maxHeight }) {
  const days = R.daysIn(year, month);
  const ds = Array.from({ length: days }, (_, i) => i + 1);
  const th = { position: 'sticky', top: 0, background: '#f2f6fb', fontSize: 9.5, fontWeight: 700, color: '#6c7a8c', padding: '5px 2px', borderBottom: '1px solid rgba(125,145,180,.3)', textAlign: 'center', zIndex: 1 };
  const td = { fontFamily: ROS_MONO, fontSize: 9.4, fontWeight: 700, textAlign: 'center', padding: '3px 1px', borderBottom: '1px solid rgba(125,145,180,.12)', minWidth: 25 };
  const g = grid || {};
  if (!rows || !rows.length) return <div style={{ padding: 24, textAlign: 'center', color: '#8a97a8', fontSize: 12 }}>No one is on this sheet.</div>;
  return (
    <div style={{ overflow: 'auto', maxHeight: maxHeight || '62vh', border: '1px solid rgba(125,145,180,.22)', borderRadius: 10, background: '#fff' }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left', left: 0, zIndex: 2, minWidth: 160, paddingLeft: 10 }}>Staff</th>
            {ds.map((d) => {
              const fri = new Date(year, month, d).getDay() === 5;
              return <th key={d} style={{ ...th, background: fri ? '#e3edf8' : th.background }}>{d}<div style={{ fontWeight: 500, fontSize: 8.5 }}>{String(rosDow(year, month, d)).slice(0, 2)}</div></th>;
            })}
            {['G', 'M', 'E', 'N', 'O'].map((b) => <th key={b} style={{ ...th, color: rosBColor(b) }}>{b}</th>)}
            <th style={th}>Hrs</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => {
            const row = g[r.empId] || {};
            const t = R.totalsFor(row, days);
            const hasPca = rows.some((x) => x.pca);
            const head = hasPca && (ri === 0 || !!rows[ri - 1].pca !== !!r.pca);
            return (
              <React.Fragment key={r.empId}>
              {head && <tr><td colSpan={days + 7} style={{ position: 'sticky', left: 0, padding: '6px 10px', fontSize: 9.5, fontWeight: 800, letterSpacing: .6, textTransform: 'uppercase', color: r.pca ? '#5b45c4' : '#0072a3', background: r.pca ? 'rgba(106,82,212,.08)' : 'rgba(0,144,202,.08)' }}>{r.pca ? 'Patient care assistants · ' + rows.filter((x) => x.pca).length : 'Nursing staff · ' + rows.filter((x) => !x.pca).length}</td></tr>}
              <tr>
                <td style={{ position: 'sticky', left: 0, background: '#fff', padding: '4px 10px', borderBottom: '1px solid rgba(125,145,180,.12)', fontSize: 11.5, whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', zIndex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#16202e', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                  <div style={{ fontSize: 9.5, color: '#8a97a8' }}>{[r.empIdShown, r.desig].filter(Boolean).join(' · ') || ' '}</div>
                </td>
                {ds.map((d) => {
                  const c = row[d] || '';
                  const col = c ? rosBColor(R.bucketOf(c)) : null;
                  return <td key={d} style={{ ...td, color: col || '#ccd3dc', background: c ? col + '14' : 'transparent' }}>{c || '·'}</td>;
                })}
                {['G', 'M', 'E', 'N', 'O'].map((b) => <td key={b} style={{ ...td, color: '#3c4858' }}>{t[b] || ''}</td>)}
                <td style={{ ...td, color: '#16202e' }}>{t.hours || ''}</td>
              </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* Prepared / Checked / Approved — filled from Duty Roster → Setup, never typed per sheet.
   Before a step happens the box shows who WILL sign; after it, who did and when. */
function RosSignOff({ signers, meta, dept }) {
  const sg = signers || {}, m = meta || {};
  const h = m.history || [];
  const lastOf = (acts) => { for (let i = h.length - 1; i >= 0; i--) if (acts.indexOf(h[i].action) >= 0) return { e: h[i], i }; return null; };
  const st = rosStatusNorm(m.status);
  const inChain = st === 'pending_manager' || st === 'pending_cns' || st === 'approved';
  const sent = inChain ? lastOf(['send_manager', 'send_cns']) : null;
  const fwd0 = lastOf(['forward']);
  const fwd = fwd0 && sent && fwd0.i > sent.i ? fwd0 : null;
  const ok = st === 'approved' ? lastOf(['approve']) : null;
  const skipped = sent && sent.e.action === 'send_cns';
  const boxes = [
    ['Prepared by', (sent && m.preparedBy) || (sg.incharge && sg.incharge.name), 'In-charge · ' + dept, sent ? 'sent ' + rosWhen(sent.e.at) : 'not sent yet', !!sent, !sg.incharge, 'In-charge'],
    ['Checked by', (fwd && m.checkedBy) || (sg.manager && sg.manager.name), 'Manager · ' + dept, fwd ? 'forwarded ' + rosWhen(fwd.e.at) : skipped ? 'skipped — sent straight to the CNS' : 'not checked yet', !!fwd, !sg.manager, 'Manager'],
    ['Approved by', (ok && m.approvedBy) || (sg.cns && sg.cns.name), 'Chief of Nursing Services', ok ? 'approved ' + rosWhen(ok.e.at) : 'not approved yet', !!ok, !sg.cns, 'CNS'],
  ];
  const missing = boxes.filter((b) => b[5]).map((b) => b[6]);
  return (
    <div style={{ background: 'linear-gradient(152deg,rgba(255,255,255,.78),rgba(236,247,255,.48))', border: '1px solid rgba(255,255,255,.92)', borderRadius: 16, boxShadow: '0 14px 40px rgba(31,59,90,.13),inset 0 1px 0 rgba(255,255,255,.95)', padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
        <span style={rosBadge('rgba(0,144,202,.12)', '#0072a3', 24, 7)}><Ic d="M4 20h16M6 16l10-10 3 3-10 10H6z" s={13} sw={1.9} /></span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#16202e' }}>Sign-off</span>
        <span style={{ fontSize: 10.5, color: '#9aa6b4' }}>names come from Duty Roster → Setup</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}>
        {boxes.map(([role, name, caption, stamp, done]) => (
          <div key={role} style={{ borderTop: '2px solid ' + (done ? '#1f9d57' : 'rgba(125,145,180,.3)'), paddingTop: 8 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: .6, textTransform: 'uppercase', color: '#7d8ea8' }}>{role}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: name ? '#16202e' : '#b6c0cc', marginTop: 3 }}>{name || 'Not set'}</div>
            <div style={{ fontSize: 10.5, color: '#9aa6b4' }}>{caption}</div>
            <span style={{ display: 'inline-block', marginTop: 5, fontSize: 9, fontWeight: 700, letterSpacing: .4, textTransform: 'uppercase', color: done ? '#157a43' : '#9aa6b4', background: done ? 'rgba(31,157,87,.13)' : 'rgba(125,145,180,.12)', padding: '2px 7px', borderRadius: 8 }}>{stamp}</span>
          </div>
        ))}
      </div>
      {missing.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 11, color: '#b5670a', background: 'rgba(224,138,30,.1)', borderRadius: 8, padding: '6px 10px' }}>
          {missing.join(' and ')} not set for this unit — an administrator sets it once under <b>Duty Roster → Setup</b>.
        </div>
      )}
    </div>
  );
}

/* Every saved revision that was sent, returned or approved is kept as a snapshot, so the
   sheet as it stood at each step can be looked at again. Read-only. */
function RosVersions({ sheetId, staff, dept, year, month, onClose }) {
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);     // { revision, snap }
  const [err, setErr] = useState('');
  useEffect(() => {
    rosApi.get('/api/rosters/' + encodeURIComponent(sheetId) + '/versions')
      .then((r) => { if (r && r.ok) setList(r.versions || []); else { setErr((r && r.error) || 'Could not load the versions.'); setList([]); } })
      .catch(() => { setErr('Could not reach the server.'); setList([]); });
  }, [sheetId]);
  const show = (v) => rosApi.get('/api/rosters/' + encodeURIComponent(sheetId) + '/versions/' + v.revision)
    .then((r) => { if (r && r.ok && r.version) setOpen({ v, snap: r.version }); else rosToast((r && r.error) || 'Could not open that version.', 'error'); })
    .catch(() => rosToast('Could not reach the server.', 'error'));
  const view = open ? rosRowsFrom(open.snap, staff, dept, false) : null;
  return (
    <RosDrawer wide={!!open} onClose={onClose}
      title={open ? 'Version rev ' + open.v.revision : 'Versions'}
      sub={open ? (ROS_HIST_LABEL[open.v.action] || open.v.action || 'Saved') + ' · ' + (open.v.byName || open.v.by || '—') + ' · ' + rosWhen(open.v.at) : 'The sheet as it stood each time it was sent, returned or approved'}>
      {open ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(106,82,212,.08)', border: '1px solid rgba(106,82,212,.25)', borderRadius: 10, padding: '8px 12px', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#5b45c4', flex: 1 }}>Viewing an earlier version — read only. The current sheet is unchanged.</span>
            <button className="btn sm" type="button" onClick={() => setOpen(null)}>‹ All versions</button>
          </div>
          {open.v.note && <div style={{ fontSize: 12, color: '#3c4858', marginBottom: 10, whiteSpace: 'pre-wrap' }}><b>Note:</b> {open.v.note}</div>}
          <RosSheetTable rows={view.rows} grid={view.grid} year={year} month={month} maxHeight="72vh" />
        </div>
      ) : list === null ? <div style={{ color: '#8a97a8', fontSize: 12 }}>Loading…</div>
        : !list.length ? <div style={{ color: '#8a97a8', fontSize: 12 }}>{err || 'No versions yet — a snapshot is kept each time the sheet is sent for review.'}</div>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {list.map((v) => (
              <button key={v.revision} type="button" onClick={() => show(v)}
                style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, border: '1px solid rgba(125,145,180,.25)', background: '#fff', borderRadius: 10, padding: '9px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                <span style={{ fontFamily: ROS_MONO, fontWeight: 700, fontSize: 12, color: '#0072a3', minWidth: 52 }}>rev {v.revision}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#16202e' }}>{ROS_HIST_LABEL[v.action] || v.action || 'Saved'}</span>
                  <span style={{ display: 'block', fontSize: 10.5, color: '#8a97a8' }}>{(v.byName || v.by || '—') + ' · ' + rosWhen(v.at)}</span>
                </span>
                <RosStatusChip st={v.status} />
              </button>
            ))}
          </div>
        )}
    </RosDrawer>
  );
}

/* ================= 1. HOME / INDEX ================= */
function RosterHome({ index, staffStore, scope, setRoute }) {
  const rcfg = useRosterConfig();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const sc = scope || { inScope: () => true, scope: 'all', loading: false, units: null };
  /* Two views. "My units" is the working one and stays the default for everyone,
     including an administrator — the oversight screen is for reviewing, not for the
     daily job of building a sheet, and defaulting to it would put a wall of other
     people's units in front of someone who just wants to open their own. */
  const mayReview = !!(sc.can && sc.can.review);
  const [tab, setTab] = useState('mine');

  // Every hook runs on every render. These two used to sit below the "Access & coverage"
  // early return, so switching to that tab rendered two hooks fewer and React threw #300
  // ("Rendered fewer hooks than expected") — the whole app went to the error screen.
  const depts = useMemo(() => {
    const m = {};
    (staffStore.staff || []).filter((e) => e.is_active !== false && !e.former)
      .forEach((e) => { const d = R.unitOf(e); m[d] = (m[d] || 0) + 1; });
    // The server lists the units this account is assigned; a unit it names but whose
    // staff are all archived still belongs on the list, so it gets a row with no count
    // rather than vanishing along with the last nurse on it.
    if (sc.scope === 'departments' && sc.units) sc.units.forEach((u) => { if (!(u in m)) m[u] = 0; });
    // Supervisors stay on their wards; the supervisor roster is a list picked in Setup.
    const supN = (rcfg.supervisors || []).length;
    if (supN) m[R.SUPERVISOR_UNIT] = supN;
    return Object.entries(m).filter(([d]) => sc.inScope(d)).sort((a, b) => b[1] - a[1]);
  }, [staffStore.staff, sc.units, sc.scope, rcfg.supervisors]);   // eslint-disable-line react-hooks/exhaustive-deps

  const byKey = useMemo(() => {
    const m = {};
    (index.rosters || []).forEach((r) => { m[r.dept + '|' + r.year + '|' + r.month] = r; });
    return m;
  }, [index.rosters]);

  const recent = (index.rosters || []).slice(0, 12);

  if (mayReview && tab === 'access') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <RosterViewSwitch tab={tab} setTab={setTab} />
      <RosterAccessReview setRoute={setRoute} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {mayReview && <RosterViewSwitch tab={tab} setTab={setTab} />}
      <div className="card">
        <div className="card-h" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={MK.iconBadge('teal', 32)}><Ic d={I.grid} s={16} /></div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 600, fontSize: 15.5, color: MK.INK }}>Duty roster</div>
            <div className="sub">One sheet per unit per month · shift codes, coverage and rule checks in one place</div>
          </div>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {R.MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="card-b">
          <div className="sub" style={{ marginBottom: 9 }}>
            {sc.scope === 'departments'
              ? 'The units your account is assigned. Pick one to open or start its ' + R.MONTHS[month] + ' ' + year + ' roster.'
              : 'Pick a unit to open or start its ' + R.MONTHS[month] + ' ' + year + ' roster.'}
          </div>
          {!depts.length && !sc.loading && (
            <div style={{ display: 'grid', placeItems: 'center', padding: 30, textAlign: 'center', gap: 6 }}>
              <div style={{ opacity: .35 }}><Ic d={I.grid} s={30} /></div>
              <div style={{ fontWeight: 600 }}>No units assigned to you</div>
              <div className="sub" style={{ maxWidth: 420 }}>An administrator assigns the units you roster under <b>Users &amp; Roles → Manage → Duty roster units</b>.</div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
            {depts.map(([d, n]) => {
              const ex = byKey[d + '|' + year + '|' + month];
              return (
                <div key={d} className="card" style={{ padding: 12, cursor: 'pointer', borderLeft: '3px solid ' + (ex ? ROS_STATUS[rosStatusNorm(ex.status)].color : 'transparent') }}
                  onClick={() => setRoute({ view: 'rosterGrid', dept: d, year, month })}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 12.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d}</div>
                      <div className="sub" style={{ fontSize: 11 }}>{n} staff</div>
                    </div>
                    {ex ? <RosStatusChip st={ex.status} /> : <span className="tag" style={{ opacity: .6 }}>not drafted</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h3>Recent rosters</h3><div className="sub">most recent month first</div></div>
        <div className="card-b" style={{ overflow: 'auto' }}>
          {index.loading ? <div className="sub" style={{ padding: 16, textAlign: 'center' }}>Loading…</div>
            : recent.length === 0 ? (
              <div style={{ display: 'grid', placeItems: 'center', padding: 34, textAlign: 'center', gap: 6 }}>
                <div style={{ opacity: .35 }}><Ic d={I.grid} s={32} /></div>
                <div style={{ fontWeight: 600 }}>No rosters drafted yet</div>
                <div className="sub" style={{ maxWidth: 400 }}>Pick a unit above to start one. The grid opens with every nurse in that unit already on a row.</div>
              </div>
            ) : (
              <table className="tbl" style={{ width: '100%' }}>
                <thead><tr><th>Unit</th><th>Month</th><th>Status</th><th>Revision</th><th>Last saved</th><th></th></tr></thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.deptName || r.dept}</td>
                      <td>{R.MONTHS[r.month]} {r.year}</td>
                      <td><RosStatusChip st={r.status} /></td>
                      <td className="num">v{r.revision || 1}</td>
                      <td className="sub">{r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : '—'}{r.updatedBy ? ' · ' + r.updatedBy : ''}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button className="btn" onClick={() => setRoute({ view: 'rosterPrint', dept: r.dept, year: r.year, month: r.month })}>Print</button>{' '}
                        <button className="btn pri" onClick={() => setRoute({ view: 'rosterGrid', dept: r.dept, year: r.year, month: r.month })}>Open</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h3>Shift legend</h3><div className="sub">the unit's own codes — used everywhere in this module</div></div>
        <RosLegendPanel />
      </div>
    </div>
  );
}

// The module's two views. Only rendered for an account that may review them all, so a
// ward lead never sees a tab that would only ever refuse them.
function RosterViewSwitch({ tab, setTab }) {
  return (
    <div style={{ display: 'inline-flex', gap: 3, padding: 3, borderRadius: 9, background: 'rgba(125,145,180,.16)', alignSelf: 'flex-start' }}>
      {[['mine', 'My units', 'Build and open the rosters you are assigned'],
        ['access', 'Access & coverage', 'Every unit, who may roster it, and what is missing']].map(([v, l, tip]) => {
        const on = tab === v;
        return <button key={v} type="button" title={tip} onClick={() => setTab(v)}
          style={{ border: 0, cursor: 'pointer', font: 'inherit', fontSize: 12, fontWeight: 700, padding: '7px 16px', borderRadius: 7,
            color: on ? '#fff' : '#6c7a8c', background: on ? 'linear-gradient(135deg,#27a8db,#0072a3)' : 'transparent' }}>{l}</button>;
      })}
    </div>
  );
}

/* ================= 1b. ACCESS & COVERAGE (oversight) =================
   The second view of the module. "My units" is where a roster gets built; this is where
   the person accountable for the rosters being done at all can see the whole hospital at
   once — who may roster each unit, and which units nobody is looking after.

   Gated on the same right as publishing (can.review), not on the Administrator role: the
   tier that signs rosters off is a nursing one.

   The two failures it is built to surface, in this order:
     · a unit with NO ONE who may edit it — nobody will build that sheet, and the gap is
       invisible from every other screen in the app,
     · a unit with no sheet for the current month.
   Everything else on the screen is supporting detail. */
function RosterAccessReview({ setRoute }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(true);
  const [q, setQ] = useState('');
  const [only, setOnly] = useState('all');   // 'all' | 'nobody' | 'nosheet'

  const load = React.useCallback(() => {
    setBusy(true); setErr('');
    return rosApi.get('/api/rosters/access').then((r) => {
      if (r && r.ok) setData(r); else setErr((r && r.error) || 'Could not load the review.');
    }).catch(() => setErr('Could not reach the server.')).finally(() => setBusy(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const rows = (data && data.departments) || [];
  const people = (data && data.people) || [];
  const orphans = (data && data.orphans) || [];
  const noEditor = rows.filter((r) => !r.editors);
  const noSheet = rows.filter((r) => !r.current);
  const qn = q.trim().toLowerCase();
  const shown = rows.filter((r) => {
    if (only === 'nobody' && r.editors) return false;
    if (only === 'nosheet' && r.current) return false;
    if (!qn) return true;
    return String(r.name).toLowerCase().includes(qn) || (r.holders || []).some((h) => String(h.name).toLowerCase().includes(qn));
  });

  const tile = (n, label, tone, active, onClick) => (
    <div onClick={onClick} style={{ flex: '1 1 150px', cursor: onClick ? 'pointer' : 'default', padding: '11px 13px', borderRadius: 10, background: '#fff',
      border: '1px solid ' + (active ? tone : 'rgba(125,145,180,.22)'), borderLeft: '3px solid ' + tone, boxShadow: active ? '0 0 0 2px ' + tone + '22' : 'none' }}>
      <div className="num" style={{ fontSize: 21, fontWeight: 800, color: n ? tone : '#8b98ab', lineHeight: 1.1 }}>{n}</div>
      <div style={{ fontSize: 10.5, color: '#6c7a8c', marginTop: 2, lineHeight: 1.4 }}>{label}</div>
    </div>
  );
  const actionDot = (h) => {
    const may = (a) => (h.actions || []).indexOf(a) >= 0;
    return may('delete') ? ['Full', '#1f9d63'] : may('add') || may('edit') ? ['Edits', '#0090ca'] : ['Reads', '#8b98ab'];
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card">
        <div className="card-h" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={MK.iconBadge('teal', 32)}><Ic d={I.users || I.user} s={16} /></div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 600, fontSize: 15.5, color: MK.INK }}>Access &amp; coverage</div>
            <div className="sub">Every unit, who may roster it, and where {data ? R.MONTHS[data.month] + ' ' + data.year : 'this month'} has no sheet yet</div>
          </div>
          <button className="btn" onClick={load} disabled={busy}>{busy ? 'Loading…' : 'Refresh'}</button>
        </div>
        <div className="card-b">
          {err && <div style={{ fontSize: 12.5, color: '#b3261e', background: '#fdecea', border: '1px solid #f5c6c2', borderRadius: 8, padding: '9px 11px', marginBottom: 11 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 12 }}>
            {tile(rows.length, 'Units in the hospital', '#27a8db', only === 'all', () => setOnly('all'))}
            {tile(noEditor.length, 'Nobody can edit the roster', '#d23a52', only === 'nobody', () => setOnly('nobody'))}
            {tile(noSheet.length, 'No sheet this month', '#e0a12a', only === 'nosheet', () => setOnly('nosheet'))}
            {tile(people.length, 'Accounts with roster access', '#1f9d63')}
          </div>
          {noEditor.length > 0 && only !== 'nobody' && (
            <div style={{ fontSize: 11.5, color: '#8a2733', background: '#fdecea', border: '1px solid #f5c6c2', borderRadius: 8, padding: '9px 11px', marginBottom: 11 }}>
              <b>{noEditor.length} unit{noEditor.length === 1 ? '' : 's'} have nobody who may edit the roster</b> — {noEditor.slice(0, 5).map((r) => r.name).join(', ')}{noEditor.length > 5 ? ' and ' + (noEditor.length - 5) + ' more' : ''}. Assign someone in Users &amp; Roles → Manage → Duty roster access.
            </div>
          )}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a unit or a person…"
            style={{ width: '100%', padding: '8px 11px', border: '1px solid rgba(125,145,180,.3)', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', outline: 'none', marginBottom: 10 }} />
          <div style={{ overflow: 'auto' }}>
            <table className="tbl" style={{ width: '100%' }}>
              <thead><tr><th>Unit</th><th>This month</th><th>Sheets</th><th>Who may roster it</th><th></th></tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{r.name}</td>
                    <td>{r.current ? <RosStatusChip st={r.current.status} /> : <span className="tag" style={{ opacity: .6 }}>not drafted</span>}</td>
                    <td className="num">{r.sheets || 0}</td>
                    <td>
                      {!r.holders.length
                        ? <span style={{ fontSize: 11.5, fontWeight: 700, color: '#d23a52' }}>Nobody</span>
                        : <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            {r.holders.map((h) => { const [lbl, c] = actionDot(h); return (
                              <span key={h.username} title={h.name + ' · ' + lbl.toLowerCase() + (h.scope === 'all' ? ' · holds every unit' : '') + (h.inherited ? ' · never assigned units, so it inherits this reach' : '')}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#fff', border: '1px solid ' + c + '55', color: '#4a5768' }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, flexShrink: 0 }} />
                                {h.name}{h.scope === 'all' && <span style={{ fontSize: 9, opacity: .6 }}>ALL</span>}{h.inherited && <span title="Never assigned any units — it still reaches this one" style={{ fontSize: 9, color: '#e0a12a' }}>!</span>}
                              </span>
                            ); })}
                          </div>}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn" onClick={() => setRoute({ view: 'rosterGrid', dept: r.name, year: data.year, month: data.month })}>Open</button>
                    </td>
                  </tr>
                ))}
                {!shown.length && !busy && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24 }} className="sub">Nothing matches that filter.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="sub" style={{ fontSize: 10.5, marginTop: 9, lineHeight: 1.6 }}>
            <b style={{ color: '#1f9d63' }}>●</b> full access (may publish) · <b style={{ color: '#0090ca' }}>●</b> may build and submit · <b style={{ color: '#8b98ab' }}>●</b> read only.
            <b>ALL</b> = the account holds every unit. <b style={{ color: '#e0a12a' }}>!</b> = never assigned any units, so it still reaches this one — set it explicitly in Users &amp; Roles.
          </div>
        </div>
      </div>

      {orphans.length > 0 && (
        <div className="card">
          <div className="card-h"><h3>Sheets outside any unit</h3><div className="sub">filed under a name no department matches</div></div>
          <div className="card-b">
            <div className="sub" style={{ marginBottom: 9 }}>Only an account holding <i>every</i> unit can open these — a unit-scoped account cannot, however it is assigned. Usually a department renamed after the sheet was written.</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {orphans.map((o) => (
                <span key={o.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: '#fff8e9', border: '1px solid #f1d49a', color: '#8a5a00' }}>
                  {o.dept} <span style={{ opacity: .7, fontWeight: 500 }}>{R.MONTHS[o.month]} {o.year}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-h"><h3>Accounts with roster access</h3><div className="sub">{people.length} sign-in{people.length === 1 ? '' : 's'} that can open the module</div></div>
        <div className="card-b" style={{ overflow: 'auto' }}>
          <table className="tbl" style={{ width: '100%' }}>
            <thead><tr><th>Person</th><th>Can</th><th>Units</th></tr></thead>
            <tbody>
              {people.map((p) => { const [lbl, c] = actionDot(p); return (
                <tr key={p.username}>
                  <td style={{ fontWeight: 600 }}>{p.name}<span className="sub" style={{ fontWeight: 400 }}> · {p.username}</span></td>
                  <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: '#4a5768' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />{lbl}</span></td>
                  <td className="sub">
                    {p.covers === null
                      ? <b style={{ color: MK.INK }}>Every unit{p.inherited ? ' (never assigned — inherited)' : ''}</b>
                      : !p.covers.length ? <b style={{ color: '#d23a52' }}>None — the module opens empty</b>
                      : p.covers.map((id) => (rows.find((r) => r.id === id) || {}).name || id).join(', ')}
                  </td>
                </tr>
              ); })}
              {!people.length && !busy && <tr><td colSpan={3} style={{ textAlign: 'center', padding: 22 }} className="sub">No account has Duty Roster access yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ================= 2. THE ROSTER SCREEN =================
   One component, nine views — exactly the design's Component. The monthly grid is the
   editor; every other view reads the SAME live grid, so an edit shows everywhere at
   once, before it is even saved. */
/* Put someone from another unit on this sheet. "Keep on both" = they stay on their own
   unit's roster too (borrowed / floating duty); "Only on this roster" = moved here for this
   month. Administrators only. Names come from /api/rosters/staff-search (minimal fields). */
function RosAddStaff({ dept, year, month, onClose, onAdd, onRoster }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [pick, setPick] = useState(null);
  const [mode, setMode] = useState('both');
  useEffect(() => {
    const n = q.trim();
    if (n.length < 2) { setHits([]); setErr(''); return undefined; }
    let live = true;
    const t = setTimeout(() => {
      setBusy(true);
      rosApi.get('/api/rosters/staff-search?q=' + encodeURIComponent(n)).then((r) => {
        if (!live) return;
        setBusy(false);
        if (r && r.ok) { setHits(r.staff || []); setErr(''); } else { setHits([]); setErr((r && r.error) || 'Could not search the staff.'); }
      }).catch(() => { if (live) { setBusy(false); setErr('Could not reach the server.'); } });
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [q]);
  const monthName = new Date(year, month, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  const pill = (v, title, sub) => (
    <label key={v} style={{ flex: 1, minWidth: 180, display: 'flex', gap: 8, alignItems: 'flex-start', padding: '9px 11px', borderRadius: 10, cursor: 'pointer', border: '1px solid ' + (mode === v ? 'rgba(0,144,202,.5)' : 'rgba(125,145,180,.3)'), background: mode === v ? 'rgba(0,144,202,.07)' : '#fff' }}>
      <input type="radio" checked={mode === v} onChange={() => setMode(v)} style={{ marginTop: 2 }} />
      <span><b style={{ display: 'block', fontSize: 12, color: '#16202e' }}>{title}</b><span style={{ fontSize: 10.5, color: '#6c7a8c' }}>{sub}</span></span>
    </label>
  );
  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(16,28,46,.38)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '8vh 16px 16px' }}>
      <div style={{ width: 'min(560px,100%)', background: '#fff', borderRadius: 16, boxShadow: '0 24px 60px rgba(16,28,46,.28)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(125,145,180,.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <h3 style={ROS_H3}>Add staff from another unit</h3>
            <div style={{ fontSize: 11, color: '#8a97a8', marginTop: 2 }}>{dept} · {monthName}</div>
          </div>
          <button type="button" className="btn sm" onClick={onClose}>Close</button>
        </div>
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setPick(null); }} placeholder="Search by name, employee no., designation or unit…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(125,145,180,.4)', fontFamily: 'inherit', fontSize: 12.5 }} />
          {!pick && q.trim().length >= 2 && (
            <div style={{ maxHeight: 280, overflow: 'auto', border: '1px solid rgba(125,145,180,.25)', borderRadius: 10 }}>
              {busy && !hits.length && <div style={{ padding: 12, fontSize: 11.5, color: '#8a97a8' }}>Searching…</div>}
              {err && <div style={{ padding: 12, fontSize: 11.5, color: '#a92c42' }}>{err}</div>}
              {!busy && !err && !hits.length && <div style={{ padding: 12, fontSize: 11.5, color: '#8a97a8' }}>No one matches.</div>}
              {hits.map((p) => {
                const here = onRoster('S' + String(p.id));
                return (
                  <div key={p.id} onClick={() => { if (!here) setPick(p); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: here ? 'default' : 'pointer', opacity: here ? 0.55 : 1, borderBottom: '1px solid rgba(125,145,180,.12)' }}>
                    <MK.Av name={p.name} emp={p} empId={p.emp_id} size={30} radius={rosAvRadius(30)} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#16202e' }}>{p.name}</span>
                      <span style={{ display: 'block', fontSize: 10.5, color: '#8a97a8' }}>{[p.emp_id, p.designation, p.unit || p.current_department].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: here ? '#8a97a8' : '#0072a3', whiteSpace: 'nowrap' }}>{here ? 'On this roster' : 'Select'}</span>
                  </div>
                );
              })}
            </div>
          )}
          {pick && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: 'rgba(0,144,202,.06)', border: '1px solid rgba(0,144,202,.2)' }}>
                <MK.Av name={pick.name} emp={pick} empId={pick.emp_id} size={34} radius={rosAvRadius(34)} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: 'block', fontSize: 13, color: '#16202e' }}>{pick.name}</b>
                  <span style={{ fontSize: 10.5, color: '#6c7a8c' }}>{[pick.emp_id, pick.designation, pick.unit || pick.current_department].filter(Boolean).join(' · ')}</span>
                </span>
                <button type="button" className="btn sm" onClick={() => setPick(null)}>Change</button>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {pill('both', 'Keep on both rosters', 'Also stays on the ' + (pick.unit || 'home') + ' roster')}
                {pill('move', 'Only on this roster', 'Off the ' + (pick.unit || 'home') + ' roster from ' + monthName + ' on')}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn sm" onClick={onClose}>Cancel</button>
                <button type="button" className="btn sm primary" onClick={() => onAdd(pick, mode)}>Add to {dept}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RosterGrid({ staffStore, scope, dept, year, month, setRoute, onSaved, initialView }) {
  rosInjectCss();
  const days = R.daysIn(year, month);
  const [view, setView] = useState(initialView || 'month');
  const [grid, setGrid] = useState({});
  const [order, setOrder] = useState([]);
  // true once someone arranged the rows by hand (drag / move); saved as rules.orderManual.
  // Until then the sheet lists by seniority, so a new or old sheet puts the In-charge first.
  const [orderManual, setOrderManual] = useState(false);
  const [rowDrag, setRowDrag] = useState(null);   // { id, over, after } — drawing only
  const rowDragId = useRef(null);                  // the row being dragged, read by dragover/drop at once
  const [status, setStatus] = useState('draft');
  const [rev, setRev] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  // The month could NOT be loaded (500, timeout, no network) — distinct from "never
  // drafted". A failed load used to show an empty, editable grid, and the first
  // autosave replaced the real month with it.
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  // The server refused a save because someone else saved a newer revision.
  const [conflict, setConflict] = useState('');
  // Names stored with the sheet, for people no longer on this unit.
  const [storedNames, setStoredNames] = useState({});
  const [retryTick, setRetryTick] = useState(0);

  // editor state, named as the design names it
  const [brush, setBrush] = useState('');
  const [brushAll, setBrushAll] = useState(false);   // full shift-code palette open?
  const [painting, setPainting] = useState(false);
  const [drag, setDrag] = useState(null);          // { empId, d }
  const [dragOver, setDragOver] = useState(null);  // 'empId|d'
  const [dragMode, setDragMode] = useState('swap');
  const [pick, setPick] = useState(null);          // { empId, name, d, x, cellTop, cellBottom }
  const [legendOpen, setLegendOpen] = useState(false);
  const [queue, setQueue] = useState([]);
  const [savedBatch, setSavedBatch] = useState(null);
  const [swapLog, setSwapLog] = useState([]);
  const [week, setWeek] = useState(0);
  const now = new Date();
  const [day, setDay] = useState(() => (now.getFullYear() === year && now.getMonth() === month ? now.getDate() : 1));
  const [treeDay, setTreeDay] = useState(null);
  const [treeB, setTreeB] = useState(null);
  const [treeD, setTreeD] = useState(null);
  const [dayPop, setDayPop] = useState(null);

  // the rule set — the design's cfg / off / custom, persisted with the sheet
  const [cfg, setCfg] = useState(ROS_DEF_CFG);
  const [en, setEn] = useState(ROS_DEF_OFF);
  const [custom, setCustom] = useState([]);
  const [draft, setDraft] = useState({ name: '', scope: 'day', metric: 'onDuty', op: '<', val: 4, sev: 'warning' });

  // the review chain — what the server says about this sheet
  const [meta, setMeta] = useState({});           // history, sent / returned / approved stamps, id
  const [sheetCan, setSheetCan] = useState(null); // the steps THIS account may take (server/roster-workflow.js)
  const [signers, setSigners] = useState({});     // { incharge, manager, cns } from Duty Roster → Setup
  const [panel, setPanel] = useState(null);       // 'history' | 'versions' | null
  const decider = useRosDecide();

  const history = useRef([]);
  const saveTimer = useRef(null);
  const toastTimer = useRef(null);

  // Who the supervisor sheet is for comes from Setup (`members`, with the month); every other
  // unit is the people whose roster unit it is (trainees and nurse managers have their own).
  const [members, setMembers] = useState(null);
  // Staff added from another unit ({ 'S<id>': { from, mode, name, desig, emp } }), and this
  // unit's people moved onto another unit's sheet this month (left off here unless they have shifts).
  const [guests, setGuests] = useState({});
  // Added on an earlier month and still on this unit (server: carriedGuests), and the ones this
  // sheet takes off (from this month on). On the sheet = carried − taken off + this sheet's own.
  const [carried, setCarried] = useState({});
  const [guestsOff, setGuestsOff] = useState([]);
  const allGuests = useMemo(() => {
    const out = {};
    Object.keys(carried).forEach((k) => { if (guestsOff.indexOf(k) < 0) out[k] = carried[k]; });
    return Object.assign(out, guests);
  }, [carried, guestsOff, guests]);
  // Beside the codes: on-call marks on top of a duty shift ({ empId: { day: 1 } }) and the date
  // each Alternative Leave stands in for ({ empId: { day: { for: 'YYYY-MM-DD', note } } }).
  const [oncall, setOncall] = useState({});
  const [altLeave, setAltLeave] = useState({});
  // Review notes pinned to cells by the Manager / CNS — written only through POST …/marks.
  const [marks, setMarks] = useState({});
  const [movedOut, setMovedOut] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  // A draft this account does not prepare: the server sends only who is preparing it (no cells),
  // so nothing here can start a second sheet over it.
  const [hiddenDraft, setHiddenDraft] = useState(null);
  // "Show who entered": each cell tagged with the person who last entered it (server: cellBy).
  const [showWho, setShowWho] = useState(false);
  const staff = useMemo(() => {
    const mem = members ? new Set(members.map(String)) : null;
    const moved = new Set(movedOut);
    const byKey = {}; (staffStore.staff || []).forEach((e) => { if (e && e.id != null) byKey[rosKey(e)] = e; });
    const home = (staffStore.staff || [])
      .filter((e) => e.is_active !== false && !e.former && (dept === R.SUPERVISOR_UNIT ? !!(mem && mem.has(String(e.id))) : R.unitOf(e) === dept))
      .map((e) => rosRowOf(e))
      .filter((r) => !moved.has(r.empId) || Object.keys(grid[r.empId] || {}).length);
    const have = new Set(home.map((r) => r.empId));
    return home.concat(Object.keys(allGuests).filter((k) => !have.has(k)).map((k) => (byKey[k] ? rosRowOf(byKey[k]) : rosGuestRow(k, allGuests[k]))));
  }, [staffStore.staff, dept, members, allGuests, movedOut, grid]);

  const rows = useMemo(() => {
    const byId = {}; staff.forEach((x) => { byId[x.empId] = x; });
    const seen = {}; const out = [];
    // Someone no longer on this unit (transferred or archived) whose shifts are still on
    // this month's sheet keeps a row, under the name stored with the sheet. Without it a
    // past roster lost her from the grid, totals and print, and the next save stripped
    // her from the published sheet for good.
    const ghost = (id) => ({ empId: id, empIdShown: '', name: storedNames[id] || id, desig: 'No longer on this unit', offRegister: true });
    const hasCells = (id) => Object.keys(grid[id] || {}).length > 0;
    order.forEach((id) => {
      if (seen[id]) return;
      if (byId[id]) out.push(byId[id]);
      else if (hasCells(id)) out.push(ghost(id));
      else return;
      seen[id] = 1;
    });
    // Newcomers not yet in a hand-made sequence join at their place by seniority, after it.
    rosSeniorSort(staff.filter((x) => !seen[x.empId]), signers.incharge && signers.incharge.name).forEach((x) => { out.push(x); seen[x.empId] = 1; });
    Object.keys(grid).forEach((id) => { if (!seen[id] && hasCells(id)) { out.push(ghost(id)); seen[id] = 1; } });
    return rosByGroup(orderManual ? out : rosSeniorSort(out, signers.incharge && signers.incharge.name));
  }, [staff, order, grid, storedNames, orderManual, signers]);
  const pcaN = rows.filter((r) => r.pca).length;
  const nurseN = rows.length - pcaN;

  // The unit switcher offers only units this account is assigned — picking one it is
  // not would open an editor whose every save comes back 403.
  const inScope = (scope && scope.inScope) || (() => true);
  const depts = useMemo(() => [...new Set((staffStore.staff || [])
    .filter((e) => e.is_active !== false && !e.former)
    .map((e) => R.unitOf(e)).concat([dept]))]
    // The unit being viewed always stays in the list, even if nobody is on it right
    // now — dropping it would leave the switcher showing a different unit than the grid.
    .filter((d) => d === dept || inScope(d)).sort(), [staffStore.staff, dept, inScope]);

  const monthUrl = '/api/rosters/' + encodeURIComponent(dept) + '/' + year + '/' + month;
  const applyMeta = (r) => {
    const d = r.roster;
    setMeta(d ? { ...d, grid: undefined } : {});
    setSheetCan((d && d.can) || r.can || null);
    setSigners(r.signers || {});
    setMembers(Array.isArray(r.members) ? r.members : (d && Array.isArray(d.members) ? d.members : null));
  };
  useEffect(() => {
    setLoading(true); setLoadError(''); setConflict('');
    rosApi.get(monthUrl).then((r) => {
      if (!r || !r.ok) {
        setLoadError((r && r.error) || 'The server did not return the roster.');
        setHiddenDraft(null);
        setLoading(false); setDirty(false);
        return;
      }
      setHiddenDraft(r.hiddenDraft || null);
      const d = r.roster;                       // null = never drafted, a real empty month
      setGrid(rosMigrateGrid(d && d.grid, staff));
      setOrder((d && d.order) || []);
      setOrderManual(!!(d && d.rules && d.rules.orderManual));
      setStoredNames((d && d.names) || {});
      setGuests((d && d.guests) || {});
      setCarried((r.guestsCarried && typeof r.guestsCarried === 'object') ? r.guestsCarried : {});
      setGuestsOff((d && Array.isArray(d.guestsRemoved)) ? d.guestsRemoved : []);
      setOncall((d && d.oncall) || {});
      setMarks((d && d.marks) || {});
      setAltLeave((d && d.altLeave) || {});
      setMovedOut(Array.isArray(r.movedOut) ? r.movedOut : []);
      setStatus((d && d.status) || 'draft');
      setRev((d && d.revision) || 0);
      // New sheets store the design's shape; older ones stored the legacy keys.
      const ru = rosRulesOf(d && d.rules);
      setCfg(ru.cfg); setEn(ru.en); setCustom(ru.custom);
      applyMeta(r);
      setLoading(false); setDirty(false);
      setQueue([]); history.current = [];
    }).catch(() => { setLoadError('Could not reach the server.'); setLoading(false); setDirty(false); });
  }, [dept, year, month, reloadKey]);

  // the design's window mouseup — stop painting / dragging wherever the button lifts
  useEffect(() => {
    const up = () => { setPainting(false); setDrag(null); setDragOver(null); };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  /* Editable only while the sheet is with the in-charge (draft, or returned to them).
     Once sent it is the reviewer's to return, and an approved sheet is locked until an
     administrator reopens it. The server answers per sheet (`can.edit`); the fallback is
     only for an older server that does not send it. */
  const stNorm = rosStatusNorm(status);
  const locked = ROS_EDITABLE.indexOf(stNorm) < 0;
  const canEdit = !loadError && !conflict && !hiddenDraft && (sheetCan ? !!sheetCan.edit : (!locked && rosCan('edit')));
  // Said once, not once per click: painting across a locked row used to stack a toast per cell.
  const blockedAt = useRef(0);
  const editBlocked = () => {
    const now = Date.now();
    if (now - blockedAt.current < 4000) return;
    blockedAt.current = now;
    rosToast(conflict ? 'Someone else saved this roster. Reload the month before editing.'
      : stNorm === 'approved' ? 'Approved and locked — an administrator can reopen it for editing.'
      : stNorm === 'pending_manager' ? 'This roster is with the Manager for checking — ask them to return it if it needs changes.'
      : stNorm === 'pending_cns' ? 'This roster is with the CNS for approval — ask them to return it if it needs changes.'
      : 'You do not have edit rights on this roster.', 'info');
  };

  // push() — one history entry per gesture, so a whole paint stroke is ONE undo.
  const push = () => { history.current.push(JSON.stringify(grid)); if (history.current.length > 25) history.current.shift(); };
  const undo = () => {
    if (!canEdit) return editBlocked();
    const p = history.current.pop(); if (p == null) return;
    setGrid(JSON.parse(p)); setDirty(true);
  };

  const cellCode = (empId, d) => (grid[empId] || {})[d] || '';
  const markDone = (empId, d) => rosApi.post('/api/rosters/' + encodeURIComponent(meta.id || rosSheetId(dept, year, month)) + '/marks', { empId, day: d, remove: true })
    .then((r) => { if (r && r.ok) { setMarks((r.roster && r.roster.marks) || {}); rosToast('Review note marked done.'); } else rosToast((r && r.error) || 'Could not clear the note.', 'error'); });
  const ocMarked = (empId, d) => !!((oncall[empId] || {})[d]) && R.isDuty(cellCode(empId, d));
  const alOf = (empId, d) => (cellCode(empId, d) === 'AL' && (altLeave[empId] || {})[d]) || null;
  // Clicking an AL cell opens straight on its "in lieu of" details.
  const alPrefill = (empId, d) => { if (cellCode(empId, d) !== 'AL') return {}; const a = alOf(empId, d) || {}; return { alStep: true, alFor: a.for || '', alNote: a.note || '' }; };
  const setCells = (fn) => { setGrid((g) => fn(g)); setDirty(true); };
  const writeCell = (g, empId, d, code) => {
    const row = { ...(g[empId] || {}) };
    if (code) row[d] = code; else delete row[d];
    return { ...g, [empId]: row };
  };

  const setCell = (empId, d, code) => { if (!canEdit) return editBlocked(); push(); setCells((g) => writeCell(g, empId, d, code)); };

  // Repeat last week — copy each day from seven days earlier, rolling forward.
  const copyWeek = () => {
    if (!canEdit) return editBlocked();
    push();
    const snap = grid;
    setCells((g) => {
      let out = { ...g };
      rows.forEach((x) => {
        const row = { ...(out[x.empId] || {}) };
        for (let d = 8; d <= days; d++) {
          const src = (snap[x.empId] || {})[d - 7];
          if (src) row[d] = src; else delete row[d];
        }
        out[x.empId] = row;
      });
      return out;
    });
  };

  const fillBlanks = () => {
    if (!canEdit) return editBlocked();
    push();
    setCells((g) => {
      let out = { ...g };
      rows.forEach((x) => {
        const row = { ...(out[x.empId] || {}) };
        for (let d = 1; d <= days; d++) if (!row[d]) row[d] = 'OFF';
        out[x.empId] = row;
      });
      return out;
    });
  };

  // Arrange the rows by hand. The new sequence is saved with the sheet and used by every
  // view, the print and the review screens.
  const moveRow = (id, toIdx) => {
    if (!canEdit) { editBlocked(); return; }
    const byId = {}; rows.forEach((r) => { byId[r.empId] = r; });
    const ids = rows.map((r) => r.empId).filter((x) => x !== id);
    const i = Math.max(0, Math.min(ids.length, toIdx));
    ids.splice(i, 0, id);
    // A nurse never lands among the PCAs or the other way round: each stays in its section.
    setOrder(rosByGroup(ids.map((k) => byId[k]).filter(Boolean)).map((r) => r.empId)); setOrderManual(true); setDirty(true);
  };
  const sortBySeniority = () => {
    if (!canEdit) { editBlocked(); return; }
    setOrder(rosSeniorSort(rows, signers.incharge && signers.incharge.name).map((r) => r.empId)); setOrderManual(false); setDirty(true);
    rosToast('Rows sorted by seniority — In-charge and Team Leader first.');
  };
  const rowTool = (empId, v) => {
    if (v === 'up' || v === 'down' || v === 'top') {
      const at = rows.findIndex((r) => r.empId === empId);
      // "Top" = top of their own section (nurses, or PCAs).
      const first = rows.findIndex((r) => !!r.pca === !!(rows[at] && rows[at].pca));
      moveRow(empId, v === 'top' ? Math.max(0, first) : v === 'up' ? at - 1 : at + 1);
      return;
    }
    if (!canEdit || !v) { if (v) editBlocked(); return; }
    if (v === 'unguest') {
      const g = allGuests[empId]; if (!g || !rosIsAdmin()) return;
      if (!window.confirm('Take ' + (g.name || 'this person') + ' off this roster from this month on? Their shifts on this sheet are cleared' + (g.mode === 'move' ? ' and they go back on the ' + (g.from || 'home') + ' roster.' : '.') + ' Earlier months keep them.')) return;
      setGuests((m) => { const n = { ...m }; delete n[empId]; return n; });
      // Added on an earlier month: taken off from this month on (earlier months keep them).
      if (carried[empId]) setGuestsOff((l) => (l.indexOf(empId) >= 0 ? l : l.concat([empId])));
      setOrder((o) => o.filter((k) => k !== empId));
      setCells((gr) => { const n = { ...gr }; delete n[empId]; return n; });
      /* This month's sheet saves itself (above). The unit's LATER months that already have a sheet
         listing them are taken off on the server now — before, a removal reached only the month on
         screen, so a later draft (and its in-charge) kept showing them. A later month where they
         already have shifts is left alone and named here. */
      const who = g.name || 'This person';
      rosApi.post('/api/rosters/guests/remove', { dept, year, month, keys: [empId] }).then((r) => {
        if (!r || !r.ok) { rosToast((r && r.error) || 'Could not take them off the later months.', 'error'); return; }
        const other = (x) => !(x.year === year && x.m === month);
        const later = (r.removed || []).filter(other).map((x) => x.month);
        const kept = (r.kept || []).filter(other).map((x) => x.month);
        const failed = r.failed || [];
        rosToast(who + ' taken off ' + dept + ' from ' + monthLabel + ' on' + (later.length ? ' (also taken off ' + later.join(', ') + ')' : '') + '.'
          + (kept.length ? ' Still rostered with shifts on ' + kept.join(', ') + ' — open that month to take them off there.' : '')
          + (failed.length ? ' ' + failed.join(', ') + ' was being saved at the same moment — open it and remove them again.' : ''), (kept.length || failed.length) ? 'info' : undefined);
      }).catch(() => rosToast('Could not reach the server for the later months — this month still takes them off when it saves.', 'error'));
      return;
    }
    const pat = ROS_PATTERNS.find((p) => p[0] === v);
    push();
    setCells((g) => {
      const row = { ...(g[empId] || {}) };
      for (let d = 1; d <= days; d++) {
        if (pat) row[d] = pat[2][(d - 1) % pat[2].length];
        else if (v === 'clear') delete row[d];
        else if (v === 'blanks' && !row[d]) row[d] = 'OFF';
      }
      return { ...g, [empId]: row };
    });
  };

  // Auto-draft — the first pattern across the whole unit, staggered two days per row.
  const autoFill = () => {
    if (!canEdit) return editBlocked();
    const anything = rows.some((x) => Object.keys(grid[x.empId] || {}).length);
    if (anything && !window.confirm('Auto-draft replaces every shift already typed in ' + R.MONTHS[month] + '. Continue?')) return;
    push();
    const pat = ['M4', 'M4', 'E4', 'E4', 'N2', 'N2', 'OFF'];
    setCells((g) => {
      let out = { ...g };
      rows.forEach((x, i) => {
        const row = {};
        for (let d = 1; d <= days; d++) row[d] = pat[((d - 1) + i * 2) % 7];
        out[x.empId] = row;
      });
      return out;
    });
  };

  // Click a day heading with a brush active — paint the whole column.
  const fillCol = (d) => {
    if (!canEdit) return editBlocked();
    if (!brush) { rosToast('Pick a brush code first — then click a day heading to fill that column.', 'info'); return; }
    push();
    setCells((g) => {
      let out = { ...g };
      rows.forEach((x) => { out[x.empId] = { ...(out[x.empId] || {}), [d]: brush }; });
      return out;
    });
  };

  /* ---- the pending-changes queue -------------------------------------------
     A drag never lands straight on the sheet: it queues, the drawer states what
     changes and which rules it would break, and Confirm & save applies the lot. */
  const saveQueue = () => {
    const q = queue;
    if (!q.length) return;
    push();
    setCells((g) => {
      let out = { ...g };
      q.forEach((x) => {
        out = writeCell(out, x.bId, x.bDi, x.aCode);
        out = writeCell(out, x.aId, x.aDi, x.mode === 'swap' ? x.bCode : '');
      });
      return out;
    });
    const nameOf = (id) => (rows.find((r) => r.empId === id) || {}).name || id;
    setSwapLog((log) => q.filter((x) => x.aId !== x.bId).map((x, i) => ({
      id: 'SW-' + (900 + log.length + i), aName: nameOf(x.aId), aDay: x.aDi, aCode: x.aCode,
      bName: nameOf(x.bId), bDay: x.bDi, bCode: x.bCode, mode: x.mode,
    })).concat(log));
    setQueue([]);
    setSavedBatch(q.length + (q.length === 1 ? ' change saved' : ' changes saved'));
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setSavedBatch(null), 4200);
  };

  /* ---- saving --------------------------------------------------------------
     The design has no Save button, so the sheet saves itself: debounced after every
     edit, silently. Publish still chains an explicit save so approval never races. */
  const save = (nextStatus, quiet) => {
    setBusy(true);
    return rosApi.put('/api/rosters', {
      dept, deptName: dept, year, month, grid, order: rows.map((r) => r.empId), guests, guestsRemoved: guestsOff, oncall, altLeave,
      // Which revision these edits were made on: the server refuses the save if someone
      // saved since, instead of this whole grid erasing their cells.
      baseRevision: rev,
      rules: {
        cfg, off: en, custom, orderManual,
        // legacy mirror — roster-review.jsx and the print sheet read these keys
        minMorning: { on: en.min !== false, value: cfg.minM, label: 'Minimum staff on morning duty', unit: 'per day' },
        minEvening: { on: en.min !== false, value: cfg.minE, label: 'Minimum staff on evening duty', unit: 'per day' },
        minNight: { on: en.min !== false, value: cfg.minN, label: 'Minimum staff on night duty', unit: 'per day' },
        maxConsecNight: { on: en.nights !== false, value: cfg.maxNights, label: 'Maximum consecutive night shifts', unit: 'per person' },
        leaveClash: { on: en.leave !== false, value: cfg.maxLeavePerDay, label: 'Maximum staff away on the same day', unit: 'per day' },
      },
      names: rows.reduce((m, r) => { if (r.empId) m[r.empId] = r.name || ''; return m; }, {}),
      // No status and no signer names: a save never moves the sheet along the chain (that
      // is the transition route), and the names come from Duty Roster → Setup. Saving a
      // RETURNED sheet puts it back to draft on the server.
    }).then((r) => {
      setBusy(false);
      if (r && r.ok) {
        setRev((r.roster && r.roster.revision) || rev + 1);
        if (r.roster) {
          setStatus(r.roster.status || status);
          setMeta((m) => ({ ...m, ...r.roster, grid: undefined }));
          if (r.roster.can) setSheetCan(r.roster.can);
        }
        setDirty(false);
        if (!quiet) rosToast('Roster saved.');
        if (onSaved) onSaved();
        return true;
      }
      // Refused for a reason retrying cannot fix: stop editing (which also stops the
      // autosave) and say why, instead of re-sending the same refused grid forever.
      if (r && r.conflict) setConflict(r.error || 'Someone else saved this roster.');
      if (r && r.locked) refreshMeta();
      rosToast((r && r.error) || 'Could not save.', 'error');
      return false;
    }).catch(() => {
      setBusy(false);
      rosToast('Could not reach the server — your changes are kept on this screen and will be retried.', 'error');
      if (quiet) setTimeout(() => setRetryTick((n) => n + 1), 5000);   // network failure: try again
      return false;
    });
  };

  // The debounced autosave. Guarded on canEdit so a read-only viewer never writes.
  useEffect(() => {
    if (!dirty || loading || !canEdit) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { saveTimer.current = null; save(null, true); }, 1600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [grid, oncall, altLeave, cfg, en, custom, order, orderManual, dirty, retryTick]);   // eslint-disable-line

  // Leaving the sheet — another month or unit remounts it, or the person opens another
  // module — must not drop edits still waiting for the 1.6 s autosave. The refs carry
  // the latest state into the unmount; closing the tab with unsaved edits asks first.
  const saveRef = useRef(null); saveRef.current = save;
  const pendingRef = useRef(false); pendingRef.current = dirty && !loading && canEdit;
  useEffect(() => {
    const warn = (e) => { if (pendingRef.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      if (pendingRef.current) { if (saveTimer.current) clearTimeout(saveTimer.current); saveRef.current(null, true); }
    };
  }, []);

  // Re-read the sheet's status, rights and history after a step, without reloading the grid.
  const refreshMeta = () => rosApi.get(monthUrl).then((r) => {
    if (!r || !r.ok) return;
    applyMeta(r);
    if (r.roster) { setStatus(r.roster.status || 'draft'); setRev(r.roster.revision || 0); }
  }).catch(() => {});

  // One step of the review chain (send / forward / approve / return / reopen).
  const act = async (action) => {
    // A pending autosave firing after the step would hit the lock — cancel it, and send
    // what is on screen: unsaved edits (or a sheet never saved at all) are saved first.
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    if (canEdit && (dirty || !rev)) { const ok = await save(null, true); if (ok === false) return; }
    const selfManager = !!(signers.manager && window.__UNICO_USER__ && String(window.__UNICO_USER__.username || '').toLowerCase() === String(signers.manager.username || '').toLowerCase());
    const r = await decider.run({ id: meta.id || rosSheetId(dept, year, month), action, unit: dept, period: monthLabel, warnings: totalViol, selfManager });
    if (r && r.ok) { await refreshMeta(); if (onSaved) onSaved(); }
    else if (r && r.code === 'conflict') refreshMeta();
  };

  /* ---- derived ---- */
  const ev = useMemo(() => rosEval(grid, rows, days, year, month, cfg, en, custom), [grid, rows, days, year, month, cfg, en, custom]);
  /* Who entered each cell — the server records it on every save (cellBy: who, when, from → to).
     A cell counts for that person only while it still holds what they entered; a cell with a
     code and no record was entered before tracking began (or is not saved yet). */
  const cellBy = (meta && meta.cellBy) || {};
  const whoOf = (empId, d, c) => { if (!c) return null; const e = (cellBy[empId] || {})[d]; return e && e.to === c ? e : null; };
  const whoInfo = useMemo(() => {
    const by = {}; let before = 0;
    rows.forEach((x) => {
      const g = grid[x.empId] || {};
      Object.keys(g).forEach((d) => {
        if (!g[d]) return;
        const e = whoOf(x.empId, d, g[d]);
        if (!e) { before++; return; }
        const k = e.by || e.name || '?';
        (by[k] || (by[k] = { key: k, name: e.name || e.by || 'Unknown', n: 0 })).n++;
      });
    });
    const people = Object.values(by).sort((a, b) => b.n - a.n);
    const color = {}; people.forEach((p, i) => { color[p.key] = ROS_WHO_COLORS[i % ROS_WHO_COLORS.length]; });
    return { people, before, color };
  }, [rows, grid, meta && meta.cellBy]);   // eslint-disable-line
  const whoTxt = (empId, d, c) => {
    if (!c) return '';
    const e = whoOf(empId, d, c);
    return e ? '\nEntered by ' + (e.name || e.by) + ' · ' + rosWhen(e.at) + (e.from ? ' (was ' + e.from + ')' : ' (was blank)') : '\nEntered before tracking began (or not saved yet)';
  };
  const totalViol = ev.totalViol;
  const monthLabel = R.MONTHS[month] + ' ' + year;
  const monShort = R.MONTHS[month].slice(0, 3);
  const dowOf = (d) => rosDow(year, month, d);

  const kpiVals = useMemo(() => {
    let shifts = 0, hours = 0, leave = 0;
    rows.forEach((x) => {
      const row = grid[x.empId] || {};
      for (let d = 1; d <= days; d++) {
        const c = row[d]; if (!c) continue;
        const b = R.bucketOf(c);
        if (b && b !== 'O') shifts++;
        hours += R.hoursOf(c);
        if (ROS_LEAVE_CODES.indexOf(c) >= 0 || c === 'PH') leave++;
      }
    });
    return { shifts, hours, leave };
  }, [grid, rows, days]);

  // every code actually used this month, in the legend's own order
  const usedCodes = useMemo(() => {
    const set = {};
    rows.forEach((x) => { const row = grid[x.empId] || {}; for (let d = 1; d <= days; d++) if (row[d]) set[row[d]] = 1; });
    const known = ROS_CODE_ORDER.filter((c) => set[c]);
    Object.keys(set).forEach((c) => { if (ROS_CODE_ORDER.indexOf(c) < 0) known.push(c); });
    return known;
  }, [grid, rows, days]);

  const onDutyOf = (d, pca) => { let on = 0; rows.forEach((x) => { if (!!x.pca !== !!pca) return; const b = R.bucketOf(cellCode(x.empId, d)); if (b && b !== 'O') on++; }); return on; };

  /* ---- cell interactions, as designed ---- */
  const cellDown = (empId, d) => (evn) => {
    if (!canEdit) { if (brush) { evn.preventDefault(); editBlocked(); } return; }
    if (brush) { evn.preventDefault(); push(); setPainting(true); setCells((g) => writeCell(g, empId, d, brush)); return; }
    evn.preventDefault();
    setDrag({ empId, d }); setDragOver(null);
  };
  const cellOver = (empId, d) => () => {
    if (painting && brush) { setCells((g) => writeCell(g, empId, d, brush)); return; }
    if (drag) { const k = empId + '|' + d; if (dragOver !== k) setDragOver(k); }
  };
  const cellUp = (empId, name, d) => (evn) => {
    if (brush) return;
    if (!canEdit) { editBlocked(); return; }
    if (drag && (drag.empId !== empId || drag.d !== d)) {
      const a = cellCode(drag.empId, drag.d), b2 = cellCode(empId, d);
      const src = drag;
      setQueue((q) => [...q, { key: src.empId + '|' + src.d + '>' + empId + '|' + d + '|' + q.length, aId: src.empId, aDi: src.d, aCode: a, bId: empId, bDi: d, bCode: b2, mode: dragMode }]);
      setDrag(null); setDragOver(null);
      return;
    }
    const r = evn.currentTarget.getBoundingClientRect();
    setDrag(null); setDragOver(null);
    setPick({ empId, name, d, x: r.left + r.width / 2, cellTop: r.top, cellBottom: r.bottom, ...alPrefill(empId, d) });
  };
  const paintStyle = (empId, d, c) => {
    const b = R.bucketOf(c) || '', col = rosBColor(b);
    const queued = queue.some((q) => (q.aId === empId && q.aDi === d) || (q.bId === empId && q.bDi === d));
    return {
      display: 'inline-grid', placeItems: 'center', width: 40, minWidth: 40, padding: '4px 2px', borderRadius: 6, position: 'relative',
      cursor: brush ? 'crosshair' : 'pointer', userSelect: 'none',
      border: '1px solid ' + (c ? (b === 'O' ? 'rgba(125,145,180,.3)' : col) : 'rgba(125,145,180,.22)'),
      fontFamily: ROS_MONO, fontSize: 10, fontWeight: 700,
      color: c ? (b === 'O' ? '#6c7a8c' : '#fff') : '#c4ccd6',
      background: c ? (b === 'O' ? 'rgba(125,145,180,.16)' : 'linear-gradient(140deg,' + col + ',' + col + 'c4)') : 'rgba(255,255,255,.55)',
      outline: queued ? '2px dashed #0090ca' : 'none', outlineOffset: 1,
      boxShadow: dragOver === empId + '|' + d ? '0 0 0 2px #0090ca, 0 4px 14px rgba(0,144,202,.5)' : (c && b !== 'O' ? '0 2px 7px ' + col + '4d, inset 0 1px 0 rgba(255,255,255,.28)' : 'none'),
      opacity: drag && drag.empId === empId && drag.d === d ? .4 : 1, letterSpacing: .2,
    };
  };

  const goRules = () => {
    if (view === 'month' || view === 'rules') {
      const el = document.querySelector('[data-rules]');
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else setView('rules');
  };

  if (loading) return <div style={{ display: 'grid', placeItems: 'center', height: '40vh', color: '#6c7a8c' }}>Loading the roster…</div>;
  // A failed load shows NO grid: an empty one could be edited and saved over the real month.
  const retryBox = (title, detail, label, onClick) => (
    <div style={{ display: 'grid', placeItems: 'center', height: '40vh', color: '#6c7a8c', textAlign: 'center', padding: 16 }}>
      <div>
        <div style={{ fontWeight: 700, color: '#b4232f', marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 12.5, marginBottom: 12, maxWidth: 520 }}>{detail}</div>
        <button className="btn pri sm" onClick={onClick}>{label}</button>
      </div>
    </div>
  );
  if (loadError) return retryBox('The roster for ' + R.MONTHS[month] + ' ' + year + ' did not load.',
    loadError + ' Nothing is shown, so nothing can be saved over the stored roster.', 'Try again', () => setReloadKey((k) => k + 1));
  if (conflict) return retryBox('Someone else saved this roster while you were editing.',
    conflict + ' Your last changes were not saved. Reload to see the current roster, then make them again.', 'Reload the month', () => setReloadKey((k) => k + 1));
  // Being prepared by the unit's own roster preparers: not shown to anyone else until it is sent.
  if (hiddenDraft) {
    const hd = hiddenDraft;
    return (
      <div style={{ maxWidth: 760, margin: '40px auto', padding: '0 16px' }}>
        <div style={{ background: 'rgba(255,255,255,.88)', border: '1px solid rgba(255,255,255,.95)', borderLeft: '4px solid #8b98ab', borderRadius: 14, boxShadow: '0 10px 28px rgba(31,59,90,.1)', padding: '18px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <span style={{ display: 'inline-grid', placeItems: 'center', width: 40, height: 40, borderRadius: 12, background: 'rgba(125,145,180,.14)', color: '#3c4858', flexShrink: 0 }}>
            <Ic d={I.lock || 'M5 11h14v10H5zM8 11V7a4 4 0 018 0v4'} s={18} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: '#16202e' }}>{dept} · {monthLabel} is being prepared</div>
            <div style={{ fontSize: 12.5, color: '#3c4858', marginTop: 6, lineHeight: 1.55 }}>
              {(rosStatusNorm(hd.status) === 'returned' ? 'It was returned for correction and is with ' : 'The draft is with ') + (hd.preparedBy || "the unit's in-charge")}
              {hd.updatedAt ? ' (last saved ' + rosWhen(hd.updatedAt) + ')' : ''}. A draft is shown only to the people who prepare this unit's roster and to administrators — you will see it here once it is sent for review.
            </div>
            {depts.length > 1 && (
              <div style={{ marginTop: 12 }}>
                <select value={dept} onChange={(e) => setRoute({ view: 'rosterGrid', dept: e.target.value, year, month })}
                  style={{ padding: '7px 10px', borderRadius: 9, border: '1px solid rgba(125,145,180,.35)', background: 'rgba(255,255,255,.8)', fontFamily: 'inherit', fontSize: 12 }}>
                  {depts.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const showGrid = view === 'month' || view === 'swap';
  const showFooter = view === 'month' || view === 'rules';
  const toolBtnStyle = { display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(255,255,255,.9)', background: 'rgba(255,255,255,.78)', color: '#3c4858', padding: '6px 12px', borderRadius: 9, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0, boxShadow: '0 3px 10px rgba(31,59,90,.08)' };
  // One brush pill, the design's own treatment — shared by the quick row and the
  // full-catalog panel so a code looks identical wherever it is picked from.
  const brushPill = (code) => {
    const on = brush === code, col = rosBColor(R.bucketOf(code));
    return (
      <button key={code} onClick={() => { if (!canEdit) { editBlocked(); return; } setBrush(brush === code ? '' : code); }} title={code + ((R.BY_CODE[code] || {}).label ? ' — ' + R.BY_CODE[code].label : '')}
        style={{ fontFamily: ROS_MONO, fontSize: 10.5, fontWeight: 700, padding: '5px 12px', borderRadius: 9, cursor: 'pointer', border: '1px solid ' + (on ? col : col + '40'), color: on ? '#fff' : col, background: on ? 'linear-gradient(135deg,' + col + ',' + col + 'cc)' : col + '14', boxShadow: on ? '0 6px 16px ' + col + '66, inset 0 1px 0 rgba(255,255,255,.3)' : 'none', transform: on ? 'translateY(-1px)' : 'none', transition: 'all .18s' }}>{code}</button>
    );
  };

  /* ================= THE SCREEN ================= */
  return (
    <div style={{ maxWidth: 1440, margin: '0 auto' }}>

      {/* hero */}
      <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(140deg,rgba(255,255,255,.8),rgba(230,244,253,.52))', backdropFilter: 'blur(24px) saturate(1.7)', WebkitBackdropFilter: 'blur(24px) saturate(1.7)', border: '1px solid rgba(255,255,255,.92)', borderRadius: 18, boxShadow: '0 16px 44px rgba(31,59,90,.15),0 5px 18px rgba(0,144,202,.12),inset 0 1px 0 rgba(255,255,255,.95)', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ position: 'absolute', right: -70, top: -80, width: 250, height: 230, borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,144,202,.2),transparent 70%)', filter: 'blur(12px)', pointerEvents: 'none', animation: 'rosOrbFloat 18s ease-in-out infinite alternate' }} />
        <span style={{ position: 'relative', display: 'inline-grid', placeItems: 'center', width: 44, height: 44, borderRadius: 13, background: 'rgba(0,144,202,.16)', color: '#0072a3', flexShrink: 0, boxShadow: '0 0 20px rgba(0,144,202,.28)' }}>
          <Ic d="M3 5h18v16H3zM3 9h18M8 3v4M16 3v4M8 13h3M13 13h3M8 17h3M13 17h3" s={21} sw={1.9} />
        </span>
        <div style={{ position: 'relative', minWidth: 210 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#16202e', letterSpacing: -.2 }}>Duty roster — {dept}</div>
          <div style={{ fontSize: 12, color: '#6c7a8c', marginTop: 2 }}>{monthLabel} · {days} days · {rows.length} staff · prepared by the in-charge, checked by the Manager, approved by the CNS</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
          <select value={dept} onChange={(e) => setRoute({ view: 'rosterGrid', dept: e.target.value, year, month })}
            style={{ boxSizing: 'border-box', padding: '8px 11px', borderRadius: 9, border: '1px solid rgba(125,145,180,.35)', background: 'rgba(255,255,255,.8)', fontFamily: 'inherit', fontSize: 12, color: '#16202e', outline: 'none' }}>
            {depts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <button className="ros-auto" onClick={autoFill} title={'Lay ' + ROS_PATTERNS[0][1] + ' across the whole month, staggered nurse by nurse'} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid rgba(106,82,212,.32)', background: 'rgba(106,82,212,.1)', color: '#5b45c4', padding: '9px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Ic d="M13 2L4 14h7l-1 8 9-12h-7z" s={14} sw={2} />Auto-draft
          </button>
          <RosStatusChip st={status} big />
        </div>
      </div>

      {/* review chain — where the sheet is, who has it, and the steps this account may take */}
      {(() => {
        const s = ROS_STATUS[stNorm];
        const sentBy = meta.sentByName || meta.sentBy;
        const sent = meta.sentAt ? ' · sent ' + rosWhen(meta.sentAt) + (sentBy ? ' by ' + sentBy : '') : '';
        const line = stNorm === 'pending_manager' ? 'With ' + ((signers.manager && signers.manager.name) || 'the Manager') + ' for checking' + sent
          : stNorm === 'pending_cns' ? 'With ' + ((signers.cns && signers.cns.name) || 'the CNS') + ' for approval' + sent
          : stNorm === 'approved' ? 'Approved by ' + (meta.approvedBy || '—') + (meta.approvedAt ? ' · ' + rosWhen(meta.approvedAt) : '') + ' — published and locked'
          : stNorm === 'returned' ? 'Returned to the in-charge — fix the sheet and send it again'
          : 'Draft with the in-charge — send it to the Manager (or straight to the CNS) when it is ready';
        const histN = (meta.history || []).length;
        return (
          <div style={{ background: 'rgba(255,255,255,.84)', border: '1px solid rgba(255,255,255,.95)', borderLeft: '4px solid ' + s.color, borderRadius: 14, boxShadow: '0 10px 28px rgba(31,59,90,.1)', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{ minWidth: 220, flex: 1 }}>
              <div style={{ fontSize: 12.8, fontWeight: 700, color: '#16202e' }}>{line}</div>
              <div style={{ fontSize: 11, color: '#6c7a8c', marginTop: 2 }}>
                {rev ? 'Saved · rev ' + rev + (meta.updatedBy ? ' · by ' + meta.updatedBy : '') + (meta.updatedAt ? ' · ' + rosWhen(meta.updatedAt) : '') : 'Not saved yet'}
                {dirty ? ' · saving…' : ''}
              </div>
            </div>
            <button className="btn sm" type="button" onClick={() => setPanel('history')}>History{histN ? ' · ' + histN : ''}</button>
            <button className="btn sm" type="button" disabled={!rev} onClick={() => setPanel('versions')}>Versions</button>
            <button className="btn sm" type="button" onClick={() => setRoute({ view: 'rosterPrint', dept, year, month })}>Print</button>
            {canEdit && <button className="btn sm" type="button" disabled={busy || !dirty} onClick={() => { if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; } save(null, false); }}>Save draft</button>}
            {sheetCan && sheetCan.send && totalViol > 0 && (
              <span onClick={goRules} title="Sending is still allowed — the reviewer sees the same warnings" style={{ fontSize: 11, fontWeight: 700, color: '#a92c42', cursor: 'pointer' }}>{totalViol} rule warning{totalViol === 1 ? '' : 's'}</span>
            )}
            <RosDecisionButtons status={status} can={sheetCan} onAction={act} busy={busy || decider.busy} hasManager={!!signers.manager}
              selfManager={!!(signers.manager && window.__UNICO_USER__ && String(window.__UNICO_USER__.username || '').toLowerCase() === String(signers.manager.username || '').toLowerCase())} />
          </div>
        );
      })()}
      {stNorm === 'returned' && <RosReturnedBanner meta={meta} />}
      <RosMarkList marks={marks} rows={rows} year={year} month={month} canDone={canEdit} onDone={markDone} />
      {!canEdit && !loadError && !conflict && ROS_EDITABLE.indexOf(stNorm) >= 0 && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(125,145,180,.1)', border: '1px solid rgba(125,145,180,.3)', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#3c4858' }}>
          <Ic d={I.lock || 'M5 11h14v10H5zM8 11V7a4 4 0 018 0v4'} s={15} />
          <span><b>View only.</b> Your account can open this roster but not change it, so the brushes and cells are locked. To prepare it, an administrator gives you <b>Duty Roster — Edit and Add</b> for {dept} (Access Control → Manage → Module access).</span>
        </div>
      )}
      {decider.modal}
      {panel === 'history' && (
        <RosDrawer title="History" sub={dept + ' · ' + monthLabel} onClose={() => setPanel(null)}>
          <RosHistoryTimeline history={meta.history} />
        </RosDrawer>
      )}
      {panel === 'versions' && <RosVersions sheetId={meta.id || rosSheetId(dept, year, month)} staff={staffStore.staff} dept={dept} year={year} month={month} onClose={() => setPanel(null)} />}

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 14 }}>
        {[
          { lbl: pcaN ? 'Staff · ' + nurseN + ' nurses · ' + pcaN + ' PCAs' : 'Staff rostered', val: String(rows.length), icd: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z', bg: 'rgba(0,144,202,.1)', c: '#0090ca' },
          { lbl: 'Shifts assigned', val: String(kpiVals.shifts), icd: 'M3 5h18v16H3zM3 9h18', bg: 'rgba(58,181,167,.14)', c: '#2b9488' },
          { lbl: 'Total hours', val: String(kpiVals.hours), icd: 'M12 8v4l3 3M12 2a10 10 0 100 20 10 10 0 000-20z', bg: 'rgba(106,82,212,.12)', c: '#5b45c4' },
          { lbl: 'Leave days', val: String(kpiVals.leave), icd: 'M8 2v4M16 2v4M3 8h18M5 8v13h14V8', bg: 'rgba(224,138,30,.14)', c: '#b5670a' },
          { lbl: 'Rule warnings', val: String(totalViol), icd: 'M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0zM12 9v4M12 17h.01', bg: totalViol ? 'rgba(210,58,82,.12)' : 'rgba(31,157,87,.13)', c: totalViol ? '#d23a52' : '#1f9d57' },
        ].map((k) => (
          <div key={k.lbl} className="ros-kpi" style={{ background: 'linear-gradient(152deg,rgba(255,255,255,.76),rgba(236,247,255,.46))', backdropFilter: 'blur(26px) saturate(1.75)', WebkitBackdropFilter: 'blur(26px) saturate(1.75)', border: '1px solid rgba(255,255,255,.92)', borderRadius: 15, boxShadow: '0 12px 36px rgba(31,59,90,.12),inset 0 1px 0 rgba(255,255,255,.95)', padding: '13px 15px', transition: 'transform .2s,box-shadow .25s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ display: 'inline-grid', placeItems: 'center', width: 34, height: 34, borderRadius: 10, background: k.bg, color: k.c, flexShrink: 0 }}><Ic d={k.icd} s={16} sw={1.9} /></span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: ROS_MONO, fontSize: 19, fontWeight: 700, color: '#16202e', lineHeight: 1.15 }}>{k.val}</div>
                <div style={{ fontSize: 10.5, color: '#6c7a8c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.lbl}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* view tabs + the rule-warning chip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,.55)', border: '1px solid rgba(255,255,255,.9)', borderRadius: 11, padding: 3, gap: 2, boxShadow: '0 6px 18px rgba(31,59,90,.1)', flexWrap: 'wrap' }}>
          {ROS_VIEW_TABS.map(([v, label, icd]) => (
            <button key={v} onClick={() => setView(v)} style={rosTab(view === v)}>
              <Ic d={icd} s={13} sw={2} />{label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {totalViol > 0 && (
          <span className="ros-vio" onClick={goRules} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: '#a92c42', background: 'rgba(210,58,82,.12)', border: '1px solid rgba(210,58,82,.28)', padding: '6px 12px', borderRadius: 16, cursor: 'pointer' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#d23a52' }} />{totalViol} rule warnings
          </span>
        )}
      </div>

      {/* ---- monthly grid ---- */}
      {showGrid && (
        <div style={{ background: 'linear-gradient(152deg,rgba(255,255,255,.78),rgba(236,247,255,.48))', backdropFilter: 'blur(26px) saturate(1.75)', WebkitBackdropFilter: 'blur(26px) saturate(1.75)', border: '1px solid rgba(255,255,255,.92)', borderRadius: 16, boxShadow: '0 14px 42px rgba(31,59,90,.14),inset 0 1px 0 rgba(255,255,255,.95)', overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 16px', borderBottom: '1px solid rgba(125,145,180,.18)', flexWrap: 'wrap' }}>
            <h3 style={ROS_H3}>Monthly grid</h3>
            <span style={{ fontSize: 11, color: '#9aa6b4' }}>click a cell to pick · drag a shift onto another to swap · paint with a brush</span>
            <span style={{ flex: 1 }} />
            <button type="button" onClick={() => setShowWho((v) => !v)} title="Tag every cell with the person who entered it (saved changes since tracking began)"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid ' + (showWho ? 'rgba(0,144,202,.4)' : 'rgba(125,145,180,.3)'), background: showWho ? 'rgba(0,144,202,.12)' : 'rgba(255,255,255,.65)', color: showWho ? '#0072a3' : '#3c4858', padding: '5px 11px', borderRadius: 9, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              <Ic d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z" s={12} sw={2} />{showWho ? 'Hide who entered' : 'Show who entered'}
            </button>
            {canEdit && rosIsAdmin() && (
              <button type="button" onClick={() => setAddOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(0,144,202,.35)', background: 'rgba(0,144,202,.08)', color: '#0072a3', padding: '5px 11px', borderRadius: 9, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                <Ic d="M12 5v14M5 12h14" s={12} sw={2.4} />Add staff from another unit
              </button>
            )}
            {addOpen && (
              <RosAddStaff dept={dept} year={year} month={month} onClose={() => setAddOpen(false)}
                onRoster={(k) => rows.some((r) => r.empId === k)}
                onAdd={(p, mode) => {
                  const k = 'S' + String(p.id);
                  setGuests((m) => ({ ...m, [k]: { from: p.unit || p.current_department || '', mode, name: p.name || '', desig: p.designation || '', emp: p.emp_id || '' } }));
                  setGuestsOff((l) => l.filter((x) => x !== k));
                  setOrder((o) => (o.indexOf(k) >= 0 ? o : o.concat([k])));
                  setDirty(true); setAddOpen(false);
                  rosToast((p.name || 'Staff') + ' added to ' + dept + ' from this month on' + (mode === 'move' ? ' — off the ' + (p.unit || 'home') + ' roster.' : '.'));
                }} />
            )}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {ROS_BUCKETS.concat([['O', 'Leave / off', '#8b98ab', '']]).map(([b, label, c]) => (
                <span key={b} style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 10, color: c, background: c + '18', whiteSpace: 'nowrap' }}>{label}</span>
              ))}
              <button onClick={() => setLegendOpen((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid ' + (legendOpen ? 'rgba(0,144,202,.35)' : 'rgba(125,145,180,.3)'), background: legendOpen ? 'rgba(0,144,202,.1)' : 'rgba(255,255,255,.65)', color: legendOpen ? '#0072a3' : '#3c4858', padding: '5px 11px', borderRadius: 9, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all .2s' }}>
                <Ic d="M4 19V5a2 2 0 012-2h13v18H6a2 2 0 01-2-2zM8 7h8M8 11h8" s={12} sw={2} />{legendOpen ? 'Hide legend' : 'Shift legend'}
              </button>
            </div>
          </div>

          {/* the brush / drag toolbar */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(125,145,180,.18)', background: 'linear-gradient(180deg,rgba(233,243,252,.7),rgba(255,255,255,.45))', display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 9.5, fontWeight: 800, letterSpacing: .8, textTransform: 'uppercase', color: '#7d8ea8', flexShrink: 0 }}>
              <Ic d="M18 3l3 3-9 9-3-3zM6 15l-3 6 6-3M9 12l3 3" s={13} sw={1.9} />Brush
            </span>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {ROS_QUICK_BRUSH.map(brushPill)}
              {/* a code picked from the full palette still shows as the active pill here */}
              {brush && ROS_QUICK_BRUSH.indexOf(brush) < 0 && brushPill(brush)}
            </div>
            <button onClick={() => setBrushAll((v) => !v)} title="Every shift & leave code in the legend, grouped by shift type"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid ' + (brushAll ? 'rgba(0,144,202,.35)' : 'rgba(125,145,180,.3)'), background: brushAll ? 'rgba(0,144,202,.1)' : 'rgba(255,255,255,.65)', color: brushAll ? '#0072a3' : '#3c4858', padding: '5px 11px', borderRadius: 9, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all .2s' }}>
              All codes {brushAll ? '▴' : '▾'}
            </button>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: brush ? '#0072a3' : '#9aa6b4', background: brush ? 'rgba(0,144,202,.1)' : 'transparent', border: '1px solid ' + (brush ? 'rgba(0,144,202,.24)' : 'transparent'), padding: brush ? '4px 11px' : 0, borderRadius: 12, whiteSpace: 'nowrap' }}>
              {brush ? 'Click or drag across cells to paint ' + brush : 'Pick a code to paint, or click a cell to choose'}
            </span>
            <span style={{ flex: 1 }} />
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: .8, textTransform: 'uppercase', color: '#7d8ea8' }}>Drag</span>
              <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,.65)', border: '1px solid rgba(255,255,255,.95)', borderRadius: 9, padding: 3, gap: 2 }}>
                {[['swap', 'Swap', 'Exchange the two shifts'], ['move', 'Move', 'Move the shift and clear the original']].map(([v, label, title]) => {
                  const on = dragMode === v;
                  return <button key={v} onClick={() => setDragMode(v)} title={title} style={{ border: 0, background: on ? 'linear-gradient(135deg,#27a8db,#0072a3)' : 'transparent', color: on ? '#fff' : '#6c7a8c', padding: '5px 12px', borderRadius: 7, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .18s', boxShadow: on ? '0 4px 11px rgba(0,144,202,.35)' : 'none' }}>{label}</button>;
                })}
              </div>
            </div>
            <button onClick={sortBySeniority} title="In-charge first, then Team Leader, Senior Staff Nurse, Staff Nurse, PCA — drag a row's ⋮⋮ handle to set your own order" style={toolBtnStyle}><Ic d="M3 6h13M3 12h9M3 18h5M17 8V20M14 17l3 3 3-3" s={12} sw={2} />{orderManual ? 'Sort by seniority' : 'By seniority ✓'}</button>
            <button onClick={copyWeek} title="Copy the previous week into this one" style={toolBtnStyle}><Ic d="M8 4h10v12M4 8h10v12H4z" s={12} sw={2} />Repeat last week</button>
            <button onClick={fillBlanks} title="Fill every empty cell with OFF" style={toolBtnStyle}><Ic d="M4 12l5 5L20 6" s={12} sw={2} />Fill blanks OFF</button>
            <button onClick={undo} title="Undo last change" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid ' + (history.current.length ? 'rgba(0,144,202,.32)' : 'rgba(125,145,180,.24)'), background: history.current.length ? 'rgba(0,144,202,.1)' : 'rgba(255,255,255,.5)', color: history.current.length ? '#0072a3' : '#b6c0cc', padding: '6px 12px', borderRadius: 9, fontSize: 10.5, fontWeight: 700, cursor: history.current.length ? 'pointer' : 'default', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}><Ic d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" s={12} sw={2.2} />Undo</button>
          </div>

          {/* the FULL brush palette — every duty & leave code in the legend, grouped
              by bucket, each one a paintable brush */}
          {brushAll && (
            <div style={{ padding: '10px 16px 12px', borderBottom: '1px solid rgba(125,145,180,.18)', background: 'rgba(247,251,255,.6)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[['G', 'General', '#6a52d4'], ['M', 'Morning', '#e08a1e'], ['E', 'Evening', '#0090ca'], ['N', 'Night', '#5b45c4'], ['O', 'Leave / off', '#8b98ab']].map(([b, label, c]) => {
                const codes = R.SHIFTS.filter((s) => s.bucket === b).map((s) => s.code);
                if (!codes.length) return null;
                return (
                  <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: .8, textTransform: 'uppercase', color: c, width: 78, flexShrink: 0 }}>{label}</span>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{codes.map(brushPill)}</div>
                  </div>
                );
              })}
              <div style={{ fontSize: 10.5, color: '#9aa6b4' }}>Hover a code for its hours · picking one makes it the active brush — then click or drag across cells, or click a day heading to paint the whole column.</div>
            </div>
          )}

          {legendOpen && <RosLegendPanel />}

          {showWho && (() => {
            const recent = (Array.isArray(meta.edits) ? meta.edits : []).slice(-6).reverse();
            const chip = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 10, background: 'rgba(255,255,255,.85)', border: '1px solid rgba(125,145,180,.25)', color: '#3c4858', whiteSpace: 'nowrap' };
            return (
              <div style={{ padding: '9px 16px', borderBottom: '1px solid rgba(125,145,180,.18)', background: 'rgba(247,251,255,.7)', display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: .8, textTransform: 'uppercase', color: '#7d8ea8' }}>Entered by</span>
                  {whoInfo.people.map((p) => (
                    <span key={p.key} style={chip}><i style={{ width: 9, height: 9, borderRadius: 2, background: whoInfo.color[p.key], display: 'inline-block' }} />{p.name} · {p.n} cell{p.n === 1 ? '' : 's'}</span>
                  ))}
                  {whoInfo.before > 0 && <span style={{ ...chip, color: '#7d8ea8' }}><i style={{ width: 9, height: 9, borderRadius: 2, border: '1px dashed #9aa6b4', display: 'inline-block', boxSizing: 'border-box' }} />Before tracking began · {whoInfo.before} cell{whoInfo.before === 1 ? '' : 's'}</span>}
                  {!whoInfo.people.length && <span style={{ fontSize: 11, color: '#6c7a8c' }}>No cell on this sheet has been entered since tracking began — every change saved from now on shows who made it.</span>}
                </div>
                {recent.length > 0 && (
                  <div style={{ fontSize: 10.5, color: '#6c7a8c', lineHeight: 1.6 }}>
                    <b style={{ color: '#3c4858' }}>Recent entries: </b>
                    {recent.map((e, i) => <span key={i}>{i ? '  ·  ' : ''}{rosWhen(e.at)} — {e.name || e.by} ({e.count} cell{e.count === 1 ? '' : 's'})</span>)}
                  </div>
                )}
              </div>
            );
          })()}

          <div style={{ overflowX: 'auto' }}>
            {rows.length === 0 ? (
              <div style={{ padding: 34, textAlign: 'center', color: '#6c7a8c' }}>No active staff are assigned to {dept}.</div>
            ) : (
              <table style={{ borderCollapse: 'collapse', fontSize: 11.5, minWidth: 1180 }}>
                <thead>
                  <tr>
                    <th style={{ position: 'sticky', left: 0, zIndex: 2, background: 'linear-gradient(180deg,#f6fafe,#e9f1fa)', textAlign: 'left', padding: '8px 10px', fontSize: 9.5, letterSpacing: .5, textTransform: 'uppercase', color: '#7d8ea8', borderBottom: '1px solid rgba(125,145,180,.28)', borderRight: '1px solid rgba(125,145,180,.2)', minWidth: 190 }}>S/N · Emp-ID · Staff name · Designation</th>
                    {Array.from({ length: days }, (_, k) => k + 1).map((d) => {
                      const fri = rosIsFri(year, month, d);
                      return (
                        <th key={d} onClick={() => fillCol(d)}
                          title={canEdit ? (brush ? 'Fill ' + R.MONTHS[month] + ' ' + d + ' with ' + brush + ' for every nurse' : 'Pick a brush code, then click a day heading to fill that whole column') : ''}
                          style={{ padding: '6px 3px', textAlign: 'center', minWidth: 42, borderBottom: '1px solid rgba(125,145,180,.28)', background: fri ? 'rgba(0,144,202,.07)' : 'rgba(240,246,252,.9)', cursor: canEdit ? 'pointer' : 'default' }}>
                          <div style={{ fontSize: 8.5, color: '#9aa6b4' }}>{dowOf(d)}</div>
                          <div style={{ fontFamily: ROS_MONO, fontSize: 10.5, fontWeight: 700, color: '#3c4858' }}>{d}-{monShort}</div>
                        </th>
                      );
                    })}
                    {[['G', 26], ['M', 26], ['E', 26], ['N', 26], ['O', 26], ['Hours', 44]].map(([label, w], i, arr) => {
                      const right = arr.slice(i + 1).reduce((a, x) => a + x[1], 0);
                      return <th key={label} style={{ position: 'sticky', right, zIndex: 3, width: w, minWidth: w, padding: '5px 2px', textAlign: 'center', fontSize: 9, fontWeight: 800, color: '#7d8ea8', borderBottom: '1px solid rgba(125,145,180,.28)', borderLeft: label === 'G' ? '1px solid rgba(125,145,180,.25)' : 'none', background: 'linear-gradient(180deg,#f6fafe,#e9f1fa)', whiteSpace: 'nowrap' }}>{label}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((x, si) => {
                    const rowG = grid[x.empId] || {};
                    // Section heading before the first nurse and the first PCA (only when the unit has PCAs).
                    const head = pcaN && (si === 0 || !!rows[si - 1].pca !== !!x.pca)
                      ? <tr key={'h-' + (x.pca ? 'p' : 'n')}><td colSpan={99} style={{ position: 'sticky', left: 0, padding: '7px 12px', fontSize: 10, fontWeight: 800, letterSpacing: .7, textTransform: 'uppercase', color: x.pca ? '#5b45c4' : '#0072a3', background: x.pca ? 'linear-gradient(90deg,rgba(106,82,212,.12),rgba(106,82,212,.03))' : 'linear-gradient(90deg,rgba(0,144,202,.12),rgba(0,144,202,.03))', borderTop: si ? '2px solid rgba(106,82,212,.3)' : 'none', borderBottom: '1px solid rgba(125,145,180,.2)' }}>{x.pca ? 'Patient care assistants · ' + pcaN : 'Nursing staff · ' + nurseN}</td></tr>
                      : null;
                    const counts = { G: 0, M: 0, E: 0, N: 0, O: 0 }; let hrs = 0;
                    for (let d = 1; d <= days; d++) { const c = rowG[d]; const b = R.bucketOf(c); if (b) counts[b]++; hrs += R.hoursOf(c); }
                    return (
                      <React.Fragment key={x.empId}>
                      {head}
                      <tr className="ros-trow"
                        onDragOver={(e) => { const id = rowDragId.current; if (!id || id === x.empId) return; e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); const after = e.clientY > r.top + r.height / 2; if (!rowDrag || rowDrag.over !== x.empId || rowDrag.after !== after) setRowDrag({ id, over: x.empId, after }); }}
                        onDrop={(e) => { e.preventDefault(); const id = rowDragId.current; rowDragId.current = null; setRowDrag(null); if (!id || id === x.empId) return; const r = e.currentTarget.getBoundingClientRect(); const after = e.clientY > r.top + r.height / 2; const ids = rows.map((k) => k.empId).filter((k) => k !== id); moveRow(id, ids.indexOf(x.empId) + (after ? 1 : 0)); }}
                        style={{ background: rowDrag && rowDrag.id === x.empId ? 'rgba(0,144,202,.08)' : si % 2 ? 'rgba(244,249,254,.5)' : 'transparent', transition: 'background .15s',
                          boxShadow: rowDrag && rowDrag.over === x.empId ? (rowDrag.after ? 'inset 0 -3px 0 #0090ca' : 'inset 0 3px 0 #0090ca') : 'none' }}>
                        <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'rgba(250,252,255,.98)', padding: '4px 9px 4px 4px', borderBottom: '1px solid rgba(125,145,180,.14)', borderRight: '1px solid rgba(125,145,180,.2)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span draggable={canEdit} title={canEdit ? 'Drag to move this person up or down' : ''}
                              onDragStart={(e) => { if (!canEdit) { e.preventDefault(); return; } try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', x.empId); } catch (er) { /* old browser */ } rowDragId.current = x.empId; setRowDrag({ id: x.empId, over: null, after: false }); }}
                              onDragEnd={() => { rowDragId.current = null; setRowDrag(null); }}
                              style={{ cursor: canEdit ? 'grab' : 'default', color: canEdit ? '#9aa6b4' : '#d6dce4', fontSize: 12, lineHeight: 1, letterSpacing: -2, padding: '6px 2px', userSelect: 'none', flexShrink: 0 }}>⋮⋮</span>
                            <MK.Av name={x.name} emp={x} empId={x.empIdShown} size={28} radius={rosAvRadius(28)} />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#16202e', whiteSpace: 'nowrap' }}>{x.name}</div>
                              <div style={{ fontSize: 9.5, color: '#9aa6b4', whiteSpace: 'nowrap' }}><span style={{ fontFamily: ROS_MONO }}>{x.empIdShown || '—'}</span> · {x.desig || '—'}</div>
                            </div>
                            <select value="" title="Row tools" onChange={(e) => { const v = e.target.value; e.target.value = ''; rowTool(x.empId, v); }}
                              style={{ width: 26, height: 24, flexShrink: 0, boxSizing: 'border-box', padding: '0 2px', borderRadius: 7, border: '1px solid rgba(125,145,180,.28)', background: 'rgba(255,255,255,.7)', fontFamily: 'inherit', fontSize: 10, color: '#6c7a8c', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', textAlign: 'center', textAlignLast: 'center' }}>
                              <option value="">⋯</option>
                              <optgroup label="Position">
                                <option value="top">Move to top</option>
                                <option value="up">Move up</option>
                                <option value="down">Move down</option>
                              </optgroup>
                              {ROS_PATTERNS.map((p) => <option key={p[0]} value={p[0]}>{p[1]}</option>)}
                              <option value="blanks">Fill blanks OFF</option>
                              <option value="clear">Clear row</option>
                              {allGuests[x.empId] && rosIsAdmin() && <option value="unguest">Remove from this roster</option>}
                            </select>
                          </div>
                        </td>
                        {Array.from({ length: days }, (_, k) => k + 1).map((d) => {
                          const c = rowG[d] || '';
                          const sh = R.BY_CODE[c];
                          const oc = ocMarked(x.empId, d), al = c === 'AL' ? alOf(x.empId, d) : null;
                          const mk = (marks[x.empId] || {})[d];
                          const alTxt = c !== 'AL' ? '' : (al && al.for ? ' · in lieu of ' + rosDate(al.for) : ' · in-lieu date not set — click to add') + (al && al.note ? ' · ' + al.note : '');
                          return (
                            <td key={d} style={{ padding: 2, textAlign: 'center', borderBottom: '1px solid rgba(125,145,180,.14)', background: rosIsFri(year, month, d) ? 'rgba(224,138,30,.09)' : 'transparent' }}>
                              <span onMouseDown={cellDown(x.empId, d)} onMouseEnter={cellOver(x.empId, d)} onMouseUp={cellUp(x.empId, x.name, d)}
                                title={c ? (c + ' — ' + (sh ? sh.label : '') + (sh && sh.hours ? ' · ' + sh.hours + ' h' : '') + (oc ? ' · + on call' : '') + alTxt + (mk ? '\nReview note: ' + mk.note : '') + (showWho ? whoTxt(x.empId, d, c) : '')) : (mk ? 'Review note: ' + mk.note : 'Click to assign a shift')}
                                style={paintStyle(x.empId, d, c)}>{c || '·'}
                                {mk && <i style={ROS_MARK_CORNER} />}
                                {showWho && (() => { const e = whoOf(x.empId, d, c); return e ? <i style={{ ...ROS_WHO_TAG, background: whoInfo.color[e.by || e.name || '?'] }} /> : null; })()}
                                {oc && <i style={ROS_OC_BADGE}>OC</i>}
                                {c === 'AL' && !(al && al.for) && <i style={ROS_AL_DOT} />}</span>
                            </td>
                          );
                        })}
                        {['G', 'M', 'E', 'N', 'O'].map((b, i) => (
                          <td key={b} style={{ position: 'sticky', right: (4 - i) * 26 + 44, zIndex: 1, width: 26, minWidth: 26, padding: '3px 2px', textAlign: 'center', fontFamily: ROS_MONO, fontSize: 10.5, fontWeight: 700, color: counts[b] ? rosBColor(b) : '#c4ccd6', borderBottom: '1px solid rgba(125,145,180,.14)', borderLeft: b === 'G' ? '1px solid rgba(125,145,180,.25)' : 'none', background: 'rgba(247,250,254,.98)' }}>{counts[b]}</td>
                        ))}
                        <td style={{ position: 'sticky', right: 0, zIndex: 1, width: 44, minWidth: 44, padding: '3px 6px', textAlign: 'right', fontFamily: ROS_MONO, fontSize: 10.5, fontWeight: 800, color: hrs > 200 ? '#a92c42' : '#16202e', borderBottom: '1px solid rgba(125,145,180,.14)', background: 'rgba(247,250,254,.98)', whiteSpace: 'nowrap' }}>{hrs}</td>
                      </tr>
                      </React.Fragment>
                    );
                  })}

                  {/* staff on each shift, per day */}
                  <tr>
                    <td colSpan={99} style={{ padding: '8px 12px', background: 'linear-gradient(90deg,rgba(0,144,202,.12),rgba(58,181,167,.06))', borderTop: '2px solid rgba(0,144,202,.28)', borderBottom: '1px solid rgba(125,145,180,.2)', fontSize: 9.5, fontWeight: 800, letterSpacing: .7, textTransform: 'uppercase', color: '#7d8ea8' }}>Staff on each shift, per day</td>
                  </tr>
                  {usedCodes.map((code) => {
                    const b = R.bucketOf(code), col = rosBColor(b);
                    let tot = 0;
                    const cells = Array.from({ length: days }, (_, k) => {
                      const d = k + 1;
                      let n = 0; rows.forEach((x) => { if ((grid[x.empId] || {})[d] === code) n++; });
                      tot += n;
                      return { d, n };
                    });
                    const sh = R.BY_CODE[code];
                    return (
                      <tr key={code}>
                        <td style={{ position: 'sticky', left: 0, zIndex: 1, whiteSpace: 'nowrap', padding: '5px 10px', textAlign: 'right', fontSize: 10.5, fontWeight: 700, color: col, background: '#f2f7fc', borderRight: '1px solid rgba(125,145,180,.2)', borderBottom: '1px solid rgba(125,145,180,.1)' }}>
                          {code}{sh ? ' (' + sh.label.replace(/:00/g, '').replace(/ - /g, '-').replace(/ /g, '') + ')' : ''}
                        </td>
                        {cells.map((c2) => (
                          <td key={c2.d} style={{ padding: '5px 3px', textAlign: 'center', fontFamily: ROS_MONO, fontSize: 10.5, fontWeight: 700, color: c2.n ? col : '#dbe2ea', background: c2.n ? col + '14' : 'transparent', borderBottom: '1px solid rgba(125,145,180,.1)' }}>{c2.n || ''}</td>
                        ))}
                        <td colSpan={6} style={{ position: 'sticky', right: 0, zIndex: 2, width: 174, minWidth: 174, padding: '5px 8px', textAlign: 'right', fontFamily: ROS_MONO, fontSize: 10.5, fontWeight: 800, color: col, background: '#f2f7fc', borderLeft: '1px solid rgba(125,145,180,.25)', borderBottom: '1px solid rgba(125,145,180,.1)' }}>{tot}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: 'linear-gradient(90deg,rgba(13,28,50,.06),rgba(13,28,50,.03))' }}>
                    <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'rgba(238,243,250,.98)', padding: '8px 10px', fontSize: 9.5, fontWeight: 800, letterSpacing: .5, textTransform: 'uppercase', color: '#7d8ea8', borderRight: '1px solid rgba(125,145,180,.2)' }}>{pcaN ? 'Nurses on duty / day' : 'On duty / day'}</td>
                    {Array.from({ length: days }, (_, k) => k + 1).map((d) => {
                      const on = onDutyOf(d, false);
                      const closed = !!ev.closedDays[d];
                      const c = closed ? '#8b98ab' : on >= 5 ? '#157a43' : on >= 4 ? '#0072a3' : on >= 3 ? '#b5670a' : '#a92c42';
                      return <td key={d} title={closed ? 'Unit off day — everyone rostered off' : on + ' on duty on day ' + d} style={{ padding: '7px 3px', textAlign: 'center', fontFamily: ROS_MONO, fontSize: 11, fontWeight: 800, color: c, background: c + '1f' }}>{closed ? 'off' : on}</td>;
                    })}
                    <td colSpan={6} style={{ position: 'sticky', right: 0, zIndex: 2, width: 174, minWidth: 174, padding: '5px 6px', fontSize: 9, color: '#9aa6b4', textAlign: 'right', background: 'rgba(238,243,250,.98)', borderLeft: '1px solid rgba(125,145,180,.25)' }}>low = red</td>
                  </tr>
                  {pcaN > 0 && (
                    <tr style={{ background: 'rgba(106,82,212,.04)' }}>
                      <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'rgba(243,240,252,.98)', padding: '8px 10px', fontSize: 9.5, fontWeight: 800, letterSpacing: .5, textTransform: 'uppercase', color: '#5b45c4', borderRight: '1px solid rgba(125,145,180,.2)' }}>PCAs on duty / day</td>
                      {Array.from({ length: days }, (_, k) => k + 1).map((d) => {
                        const on = onDutyOf(d, true);
                        return <td key={d} title={on + ' PCA on duty on day ' + d} style={{ padding: '7px 3px', textAlign: 'center', fontFamily: ROS_MONO, fontSize: 11, fontWeight: 800, color: on ? '#5b45c4' : '#c4ccd6', borderBottom: '1px solid rgba(125,145,180,.14)' }}>{on}</td>;
                      })}
                      <td colSpan={6} style={{ position: 'sticky', right: 0, zIndex: 2, width: 174, minWidth: 174, padding: '5px 6px', fontSize: 9, color: '#9aa6b4', textAlign: 'right', background: 'rgba(243,240,252,.98)', borderLeft: '1px solid rgba(125,145,180,.2)' }}>not counted as nurses</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ---- weekly board ---- */}
      {view === 'week' && (() => {
        const weeks = Math.max(1, Math.ceil(days / 7));
        const w = Math.min(week, weeks - 1);
        const first = w * 7 + 1, last = Math.min(days, first + 6);
        return (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,.55)', border: '1px solid rgba(255,255,255,.9)', borderRadius: 10, padding: 3, gap: 2 }}>
                {Array.from({ length: weeks }, (_, i) => (
                  <button key={i} onClick={() => setWeek(i)} style={rosTab(i === w)}>Week {i + 1}</button>
                ))}
              </div>
              <span style={{ fontSize: 11.5, color: '#6c7a8c' }}>Days {first}–{last} of {monthLabel}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
              {Array.from({ length: last - first + 1 }, (_, i) => first + i).map((d) => {
                const fri = rosIsFri(year, month, d);
                return (
                  <div key={d} style={{ background: 'linear-gradient(152deg,rgba(255,255,255,.78),rgba(236,247,255,.48))', backdropFilter: 'blur(24px) saturate(1.7)', WebkitBackdropFilter: 'blur(24px) saturate(1.7)', border: '1px solid rgba(255,255,255,.92)', borderRadius: 14, boxShadow: '0 12px 34px rgba(31,59,90,.12),inset 0 1px 0 rgba(255,255,255,.95)', overflow: 'hidden' }}>
                    <div style={{ padding: '9px 11px', background: fri ? 'linear-gradient(135deg,#27a8db,#0072a3)' : 'linear-gradient(135deg,rgba(13,28,50,.92),rgba(8,17,32,.88))', color: '#fff' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: .6, textTransform: 'uppercase', opacity: .85 }}>{dowOf(d)}</div>
                      <div style={{ fontFamily: ROS_MONO, fontSize: 16, fontWeight: 800 }}>{d}</div>
                    </div>
                    <div style={{ padding: '9px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {ROS_BUCKETS.map(([b, label, col]) => {
                        const people = [];
                        rows.forEach((x) => { const c = cellCode(x.empId, d); if (R.bucketOf(c) === b) people.push({ name: x.name, code: c }); });
                        const short = people.length < 2 && b !== 'G';
                        return (
                          <div key={b}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <span style={{ width: 8, height: 8, borderRadius: 3, background: col, flexShrink: 0 }} />
                              <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: .5, textTransform: 'uppercase', color: '#7d8ea8' }}>{label}</span>
                              <span style={{ flex: 1 }} />
                              <span style={{ fontFamily: ROS_MONO, fontSize: 9.5, fontWeight: 700, color: short ? '#a92c42' : '#6c7a8c', background: short ? 'rgba(210,58,82,.12)' : 'rgba(125,145,180,.14)', padding: '1px 6px', borderRadius: 8 }}>{people.length}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              {people.map((p, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#3c4858' }}>
                                  <span style={{ fontFamily: ROS_MONO, fontSize: 9.5, fontWeight: 700, color: '#fff', background: col, padding: '1px 5px', borderRadius: 5, flexShrink: 0 }}>{p.code}</span>
                                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ---- day view ---- */}
      {view === 'day' && (() => {
        const d = Math.min(Math.max(1, day), days);
        const on = onDutyOf(d);
        const covC = on >= 4 ? '#157a43' : '#a92c42';
        const arrow = { width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(125,145,180,.3)', background: 'rgba(255,255,255,.7)', color: '#3c4858', cursor: 'pointer', display: 'grid', placeItems: 'center' };
        return (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12, flexWrap: 'wrap' }}>
              <button className="ros-navbtn" onClick={() => setDay(Math.max(1, d - 1))} style={arrow}><Ic d="M9 6l6 6-6 6" s={14} sw={2.2} style={{ transform: 'rotate(180deg)' }} /></button>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#16202e' }}>Day {d} · {dowOf(d)} · {monthLabel}</div>
              <button className="ros-navbtn" onClick={() => setDay(Math.min(days, d + 1))} style={arrow}><Ic d="M9 6l6 6-6 6" s={14} sw={2.2} /></button>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: covC, background: covC + '16', padding: '6px 12px', borderRadius: 16, whiteSpace: 'nowrap' }}>{on} of {rows.length} on duty</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 13 }}>
              {ROS_BUCKETS.map(([b, label, col, icd]) => {
                const people = [];
                rows.forEach((x) => { const c = cellCode(x.empId, d); if (R.bucketOf(c) === b) people.push({ x, c }); });
                return (
                  <div key={b} style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(152deg,rgba(255,255,255,.78),rgba(236,247,255,.48))', backdropFilter: 'blur(24px) saturate(1.7)', WebkitBackdropFilter: 'blur(24px) saturate(1.7)', border: '1px solid rgba(255,255,255,.92)', borderRadius: 15, boxShadow: '0 12px 36px rgba(31,59,90,.12),inset 0 1px 0 rgba(255,255,255,.95)' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: 'linear-gradient(180deg,' + col + ',' + col + '55)' }} />
                    <div style={{ padding: '13px 15px 13px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
                        <span style={{ display: 'inline-grid', placeItems: 'center', width: 30, height: 30, borderRadius: 9, background: col + '18', color: col, flexShrink: 0 }}><Ic d={icd} s={15} sw={1.9} /></span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#16202e' }}>{label}</div>
                          <div style={{ fontSize: 10.5, color: '#9aa6b4' }}>{ROS_WINDOWS[b]}</div>
                        </div>
                        <span style={{ flex: 1 }} />
                        <span style={{ fontFamily: ROS_MONO, fontSize: 12, fontWeight: 800, color: people.length ? col : '#a92c42', background: people.length ? col + '16' : 'rgba(210,58,82,.12)', padding: '2px 9px', borderRadius: 10 }}>{people.length}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {people.map((p) => (
                          <div key={p.x.empId} style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.9)', borderRadius: 10, padding: '7px 10px' }}>
                            <MK.Av name={p.x.name} emp={p.x} empId={p.x.empIdShown} size={30} radius={rosAvRadius(30)} />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#16202e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.x.name}</div>
                              <div style={{ fontSize: 10, color: '#9aa6b4' }}>{p.x.desig || '—'}</div>
                            </div>
                            <span style={{ fontFamily: ROS_MONO, fontSize: 10, fontWeight: 700, color: '#fff', background: col, padding: '2px 7px', borderRadius: 6, flexShrink: 0 }}>{p.c}</span>
                          </div>
                        ))}
                        {people.length === 0 && (
                          <div style={{ fontSize: 11.5, color: '#a92c42', background: 'rgba(210,58,82,.09)', borderRadius: 9, padding: '8px 10px' }}>No one rostered — this shift is uncovered.</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ---- staff timeline ---- */}
      {view === 'staff' && (
        <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((x) => {
            const rowG = grid[x.empId] || {};
            const counts = { G: 0, M: 0, E: 0, N: 0, O: 0 }; let hrs = 0;
            for (let d = 1; d <= days; d++) { const c = rowG[d]; const b = R.bucketOf(c); if (b) counts[b]++; hrs += R.hoursOf(c); }
            const chips = [['G ' + counts.G, '#6a52d4'], ['M ' + counts.M, '#e08a1e'], ['E ' + counts.E, '#0090ca'], ['N ' + counts.N, '#5b45c4'], ['Off ' + counts.O, '#8b98ab'], [hrs + ' h', hrs > 200 ? '#a92c42' : '#157a43']];
            return (
              <div key={x.empId} style={{ background: 'linear-gradient(152deg,rgba(255,255,255,.78),rgba(236,247,255,.48))', backdropFilter: 'blur(24px) saturate(1.7)', WebkitBackdropFilter: 'blur(24px) saturate(1.7)', border: '1px solid rgba(255,255,255,.92)', borderRadius: 15, boxShadow: '0 12px 36px rgba(31,59,90,.12),inset 0 1px 0 rgba(255,255,255,.95)', padding: '13px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                  <MK.Av name={x.name} emp={x} empId={x.empIdShown} size={34} radius={rosAvRadius(34)} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#16202e' }}>{x.name}</div>
                    <div style={{ fontSize: 10.5, color: '#9aa6b4' }}><span style={{ fontFamily: ROS_MONO }}>{x.empIdShown || '—'}</span> · {x.desig || '—'}</div>
                  </div>
                  <span style={{ flex: 1 }} />
                  {chips.map(([label, c]) => (
                    <span key={label} style={{ fontFamily: ROS_MONO, fontSize: 10, fontWeight: 700, color: c, background: c + '16', padding: '3px 9px', borderRadius: 10, whiteSpace: 'nowrap' }}>{label}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {Array.from({ length: days }, (_, k) => k + 1).map((d) => {
                    const c = rowG[d] || '';
                    const b = R.bucketOf(c), col = rosBColor(b);
                    return (
                      <span key={d} title={'Day ' + d + ' · ' + (c || 'not assigned')} style={{ display: 'inline-grid', placeItems: 'center', width: 22, height: 24, borderRadius: 5, fontFamily: ROS_MONO, fontSize: 9.5, fontWeight: 700, color: b === 'O' ? '#6c7a8c' : '#fff', background: b === 'O' ? 'rgba(125,145,180,.2)' : col, opacity: b ? 1 : .3 }}>
                        {c ? (c.replace(/[^A-Z]/g, '').slice(0, 1) || c[0]) : '·'}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {rows.length === 0 && <div style={{ ...ROS_CARD15, padding: 30, textAlign: 'center', color: '#6c7a8c' }}>No active staff are assigned to {dept}.</div>}
        </div>
      )}

      {/* ---- leave calendar ---- */}
      {view === 'leave' && (() => {
        let off = 0, paid = 0, ph = 0; const perNurse = [];
        rows.forEach((x) => {
          let n = 0;
          for (let d = 1; d <= days; d++) {
            const c = cellCode(x.empId, d);
            if (c === 'OFF' || c === 'DO') { off++; n++; }
            else if (ROS_LEAVE_CODES.indexOf(c) >= 0) { paid++; n++; }
            else if (c === 'PH') { ph++; n++; }
          }
          perNurse.push(n);
        });
        const lowest = perNurse.length ? Math.min.apply(null, perNurse) : 0;
        let leaveTotal = 0;
        rows.forEach((x) => { for (let d = 1; d <= days; d++) if (R.bucketOf(cellCode(x.empId, d)) === 'O') leaveTotal++; });
        const ic = (bg, c) => ({ display: 'inline-grid', placeItems: 'center', width: 32, height: 32, borderRadius: 10, background: bg, color: c, flexShrink: 0 });
        const kpis = [
          { lbl: 'rest days (OFF/DO)', val: String(off), icd: 'M8 2v4M16 2v4M3 8h18M5 8v13h14V8', icStyle: ic('rgba(125,145,180,.16)', '#6c7a8c'), glow: 'rgba(125,145,180,.2)' },
          { lbl: 'paid leave days', val: String(paid), icd: 'M20 6L9 17l-5-5', icStyle: ic('rgba(224,138,30,.14)', '#b5670a'), glow: 'rgba(224,138,30,.25)' },
          { lbl: 'public holidays', val: String(ph), icd: 'M12 2l2.9 6.3 6.9.8-5 4.8 1.3 6.9L12 17.5 5.9 20.8 7.2 13.9 2.2 9.1l6.9-.8z', icStyle: ic('rgba(106,82,212,.12)', '#5b45c4'), glow: 'rgba(106,82,212,.22)' },
          { lbl: 'fewest days off', val: String(lowest), icd: 'M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0zM12 9v4M12 17h.01', icStyle: ic(lowest < cfg.minOff ? 'rgba(210,58,82,.12)' : 'rgba(31,157,87,.13)', lowest < cfg.minOff ? '#a92c42' : '#157a43'), glow: lowest < cfg.minOff ? 'rgba(210,58,82,.2)' : 'rgba(31,157,87,.2)' },
        ];
        return (
          <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
              {kpis.map((k) => (
                <div key={k.lbl} style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(152deg,rgba(255,255,255,.8),rgba(236,247,255,.5))', backdropFilter: 'blur(24px) saturate(1.7)', WebkitBackdropFilter: 'blur(24px) saturate(1.7)', border: '1px solid rgba(255,255,255,.92)', borderRadius: 15, boxShadow: '0 12px 36px rgba(31,59,90,.12),inset 0 1px 0 rgba(255,255,255,.95)', padding: '13px 15px' }}>
                  <div style={{ position: 'absolute', right: -26, top: -30, width: 96, height: 88, borderRadius: '50%', background: 'radial-gradient(circle,' + k.glow + ',transparent 70%)', filter: 'blur(8px)', pointerEvents: 'none' }} />
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={k.icStyle}><Ic d={k.icd} s={15} sw={1.9} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: ROS_MONO, fontSize: 19, fontWeight: 800, color: '#16202e', lineHeight: 1.15 }}>{k.val}</div>
                      <div style={{ fontSize: 10.5, color: '#6c7a8c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.lbl}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: 'linear-gradient(152deg,rgba(255,255,255,.8),rgba(236,247,255,.5))', backdropFilter: 'blur(24px) saturate(1.7)', WebkitBackdropFilter: 'blur(24px) saturate(1.7)', border: '1px solid rgba(255,255,255,.92)', borderRadius: 16, boxShadow: '0 14px 40px rgba(31,59,90,.13),inset 0 1px 0 rgba(255,255,255,.95)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 16px', borderBottom: '1px solid rgba(125,145,180,.18)', flexWrap: 'wrap' }}>
                <span style={rosBadge('rgba(224,138,30,.14)', '#b5670a', 26)}><Ic d="M3 5h18v16H3zM3 9h18M8 3v4M16 3v4" s={14} sw={1.9} /></span>
                <h3 style={ROS_H3}>Who is away — {monthLabel}</h3>
                <span style={{ flex: 1 }} />
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {[['OFF / DO', '#8b98ab'], ['AL / EL', '#b5670a'], ['CL', '#0072a3'], ['ML / FL', '#5b45c4'], ['PH', '#157a43']].map(([label, c]) => (
                    <span key={label} style={{ fontSize: 9.5, fontWeight: 700, color: c, background: c + '16', border: '1px solid ' + c + '2e', padding: '2px 8px', borderRadius: 8, whiteSpace: 'nowrap' }}>{label}</span>
                  ))}
                </div>
              </div>
              <div style={{ overflowX: 'auto', padding: '12px 16px 14px' }}>
                <table style={{ borderCollapse: 'separate', borderSpacing: 2, fontSize: 10.5, minWidth: 820 }}>
                  <thead><tr>
                    <th style={{ textAlign: 'left', padding: '3px 8px 3px 2px', fontSize: 9, letterSpacing: .5, textTransform: 'uppercase', color: '#7d8ea8', minWidth: 150 }}>Nurse</th>
                    {Array.from({ length: days }, (_, k) => k + 1).map((d) => (
                      <th key={d} style={{ padding: '3px 0', textAlign: 'center', minWidth: 19, fontFamily: ROS_MONO, fontSize: 9, fontWeight: 700, color: rosIsFri(year, month, d) ? '#b5670a' : '#9aa6b4' }}>{d}</th>
                    ))}
                    <th style={{ padding: '3px 4px', fontSize: 9, letterSpacing: .5, textTransform: 'uppercase', color: '#7d8ea8' }}>Off</th>
                  </tr></thead>
                  <tbody>
                    {rows.map((x) => {
                      let offN = 0;
                      const cells = Array.from({ length: days }, (_, k) => {
                        const d = k + 1, c = cellCode(x.empId, d);
                        const col = ROS_LEAVE_TONE[c] || '';
                        if (col) offN++;
                        return { d, c, col };
                      });
                      return (
                        <tr key={x.empId}>
                          <td style={{ padding: '2px 8px 2px 2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <MK.Av name={x.name} emp={x} empId={x.empIdShown} size={22} radius={rosAvRadius(22)} />
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#16202e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.name}</span>
                            </div>
                          </td>
                          {cells.map((c2) => (
                            <td key={c2.d} style={{ padding: 0 }}>
                              <span title={'Day ' + c2.d + ' · ' + (c2.c || 'on duty')} style={c2.col
                                ? { display: 'grid', placeItems: 'center', width: 19, height: 19, borderRadius: 5, fontFamily: ROS_MONO, fontSize: 7.5, fontWeight: 800, color: '#fff', background: 'linear-gradient(140deg,' + c2.col + ',' + c2.col + 'c4)', boxShadow: '0 1px 4px ' + c2.col + '55' }
                                : { display: 'grid', placeItems: 'center', width: 19, height: 19, borderRadius: 5, background: rosIsFri(year, month, c2.d) ? 'rgba(224,138,30,.1)' : 'rgba(125,145,180,.09)' }}>{c2.col ? c2.c.slice(0, 2) : ''}</span>
                            </td>
                          ))}
                          <td style={{ padding: '2px 4px', textAlign: 'center', fontFamily: ROS_MONO, fontSize: 11, fontWeight: 800, color: offN < cfg.minOff ? '#a92c42' : '#157a43' }}>{offN}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14 }}>
              <div style={{ background: 'linear-gradient(152deg,rgba(255,255,255,.8),rgba(236,247,255,.5))', backdropFilter: 'blur(24px) saturate(1.7)', WebkitBackdropFilter: 'blur(24px) saturate(1.7)', border: '1px solid rgba(255,255,255,.92)', borderRadius: 16, boxShadow: '0 14px 40px rgba(31,59,90,.13),inset 0 1px 0 rgba(255,255,255,.95)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid rgba(125,145,180,.18)' }}>
                  <h3 style={ROS_H3}>Leave mix</h3>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: '#9aa6b4' }}>{leaveTotal} days total</span>
                </div>
                <div style={{ padding: '13px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[['OFF', 'Off day'], ['DO', 'Day off'], ['AL', 'Alternative leave'], ['CL', 'Casual leave'], ['EL', 'Earned leave'], ['ML', 'Maternity leave'], ['PH', 'Public holiday']].map(([code, label]) => {
                    let n = 0;
                    rows.forEach((x) => { for (let d = 1; d <= days; d++) if (cellCode(x.empId, d) === code) n++; });
                    const c = code === 'OFF' || code === 'DO' ? '#8b98ab' : '#b5670a';
                    return (
                      <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontFamily: ROS_MONO, fontSize: 10, fontWeight: 700, color: '#fff', background: c, padding: '2px 7px', borderRadius: 6, flexShrink: 0, minWidth: 30, textAlign: 'center' }}>{code}</span>
                        <span style={{ fontSize: 11.5, color: '#3c4858', width: 104, flexShrink: 0 }}>{label}</span>
                        <div style={{ flex: 1, height: 10, borderRadius: 6, background: 'rgba(125,145,180,.14)', overflow: 'hidden' }}>
                          <div style={{ width: Math.min(100, n / Math.max(1, rows.length * 2) * 100) + '%', height: '100%', borderRadius: 5, background: 'linear-gradient(90deg,' + c + ',' + c + '99)', animation: 'rosGrowW .7s cubic-bezier(.2,.7,.3,1)' }} />
                        </div>
                        <span style={{ fontFamily: ROS_MONO, fontSize: 11.5, fontWeight: 800, color: '#3c4858', width: 26, textAlign: 'right' }}>{n}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ background: 'linear-gradient(152deg,rgba(255,255,255,.8),rgba(236,247,255,.5))', backdropFilter: 'blur(24px) saturate(1.7)', WebkitBackdropFilter: 'blur(24px) saturate(1.7)', border: '1px solid rgba(255,255,255,.92)', borderRadius: 16, boxShadow: '0 14px 40px rgba(31,59,90,.13),inset 0 1px 0 rgba(255,255,255,.95)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid rgba(125,145,180,.18)' }}>
                  <span style={rosBadge('rgba(210,58,82,.12)', '#a92c42', 26)}><Ic d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0zM12 9v4M12 17h.01" s={14} sw={2} /></span>
                  <h3 style={ROS_H3}>Clash days</h3>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: '#9aa6b4' }}>more than {cfg.maxLeavePerDay} away</span>
                </div>
                <div>
                  {ev.viol.leave.slice(0, 8).map((t, i) => {
                    const dayN = t.split(':')[0].replace('Day ', '');
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid rgba(125,145,180,.12)' }}>
                        <span style={{ fontFamily: ROS_MONO, fontSize: 11, fontWeight: 800, color: '#a92c42', background: 'rgba(210,58,82,.12)', padding: '4px 9px', borderRadius: 8, flexShrink: 0, minWidth: 26, textAlign: 'center' }}>{dayN}</span>
                        <div style={{ minWidth: 0, flex: 1, fontSize: 11.5, color: '#3c4858' }}>{t.split(': ')[1] || ''}</div>
                        <span style={rosChipS('#a92c42', 'rgba(210,58,82,.12)')}>clash</span>
                      </div>
                    );
                  })}
                  {ev.viol.leave.length === 0 && (
                    <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={rosBadge('rgba(31,157,87,.14)', '#157a43', 30, '50%')}><Ic d="M4 12l5 5L20 6" s={15} sw={3} /></span>
                      <div style={{ fontSize: 12, color: '#3c4858', lineHeight: 1.5 }}>Leave is spread evenly — no day has more than {cfg.maxLeavePerDay} nurse away.</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ---- month calendar ---- */}
      {view === 'calendar' && (() => {
        const cells = [];
        for (let i = 0; i < rosCol(year, month, 1); i++) cells.push(null);
        for (let d = 1; d <= days; d++) cells.push(d);
        while (cells.length % 7) cells.push(null);
        return (
          <div style={{ marginBottom: 14, background: 'linear-gradient(152deg,rgba(255,255,255,.78),rgba(236,247,255,.48))', backdropFilter: 'blur(24px) saturate(1.7)', WebkitBackdropFilter: 'blur(24px) saturate(1.7)', border: '1px solid rgba(255,255,255,.92)', borderRadius: 16, boxShadow: '0 14px 40px rgba(31,59,90,.13),inset 0 1px 0 rgba(255,255,255,.95)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 16px', borderBottom: '1px solid rgba(125,145,180,.18)', flexWrap: 'wrap' }}>
              <h3 style={ROS_H3}>{monthLabel}</h3>
              <span style={{ fontSize: 11, color: '#9aa6b4' }}>week starts Saturday · Friday is the weekly holiday</span>
              <span style={{ flex: 1 }} />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 700, color: '#b5670a', background: 'rgba(224,138,30,.14)', border: '1px solid rgba(224,138,30,.28)', padding: '4px 11px', borderRadius: 12 }}>Friday off</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 1, background: 'rgba(125,145,180,.16)', padding: 1 }}>
              {['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((label) => (
                <div key={label} style={{ padding: '8px 6px', textAlign: 'center', fontSize: 9.5, fontWeight: 800, letterSpacing: .7, textTransform: 'uppercase', color: label === 'Fri' ? '#b5670a' : '#7d8ea8', background: label === 'Fri' ? 'rgba(224,138,30,.14)' : 'linear-gradient(180deg,#f6fafe,#e9f1fa)' }}>{label}</div>
              ))}
              {cells.map((d, k) => {
                if (!d) return <div key={'b' + k} style={{ minHeight: 92, background: 'rgba(244,248,252,.5)' }} />;
                const isFri = rosIsFri(year, month, d);
                let on = 0; const offNames = [];
                rows.forEach((x) => { const b = R.bucketOf(cellCode(x.empId, d)); if (b && b !== 'O') on++; else if (b === 'O') offNames.push(String(x.name).split(' ')[0]); });
                const closed = !!ev.closedDays[d];
                const cc = closed ? '#8b98ab' : on >= 5 ? '#157a43' : on >= 4 ? '#0072a3' : on >= 3 ? '#b5670a' : '#a92c42';
                return (
                  <div key={d} onClick={() => setDayPop(d)} style={{ minHeight: 92, padding: '8px 9px', cursor: 'pointer', background: isFri ? 'linear-gradient(160deg,rgba(255,247,235,.95),rgba(255,241,222,.8))' : 'rgba(255,255,255,.82)', transition: 'background .15s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ fontFamily: ROS_MONO, fontSize: 13, fontWeight: 800, color: isFri ? '#b5670a' : '#16202e' }}>{d}</span>
                      <span style={{ flex: 1 }} />
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: cc, background: cc + '18', padding: '1px 7px', borderRadius: 9, whiteSpace: 'nowrap' }}>{closed ? 'off' : on + ' on'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {[['M', '#e08a1e'], ['E', '#0090ca'], ['N', '#5b45c4'], ['G', '#6a52d4']].map(([b, col]) => {
                        const n = ev.dayBucketCount(d, b);
                        return (
                          <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ fontFamily: ROS_MONO, fontSize: 8.5, fontWeight: 800, color: col, width: 9, flexShrink: 0 }}>{b}</span>
                            <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(125,145,180,.14)', overflow: 'hidden' }}>
                              <div style={{ width: Math.min(100, n / Math.max(1, rows.length) * 100) + '%', height: '100%', borderRadius: 3, background: col }} />
                            </div>
                            <span style={{ fontFamily: ROS_MONO, fontSize: 9, fontWeight: 700, color: '#6c7a8c', width: 9, textAlign: 'right' }}>{n}</span>
                          </div>
                        );
                      })}
                    </div>
                    {offNames.length > 0 && (
                      <div style={{ marginTop: 6, fontSize: 9, color: '#9aa6b4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>off: {offNames.slice(0, 3).join(', ')}{offNames.length > 3 ? ' +' + (offNames.length - 3) : ''}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ---- tree view ---- */}
      {view === 'tree' && (() => {
        const tDay = Math.min(Math.max(1, treeDay == null ? day : treeDay), days);
        const GROUPS = [['M', 'MORNING'], ['E', 'EVENING'], ['N', 'NIGHT'], ['G', 'GENERAL DUTY'], ['O', 'OFF / LEAVE']];
        const tierRank = (desig) => {
          const S = window.STAFF || {};
          const nurse = S.DESIGNATIONS || [], pca = S.PCA_DESIGNATIONS || [];
          const i = nurse.indexOf(desig);
          if (i >= 0) return nurse.length - i;
          const j = pca.indexOf(desig);
          if (j >= 0) return 1000 + (pca.length - j);
          return 9000;
        };
        const people = rows.map((x) => ({ x, c: cellCode(x.empId, tDay), b: R.bucketOf(cellCode(x.empId, tDay)) || '', tier: x.desig || 'No designation recorded' }));
        const inB = (b) => people.filter((p) => p.b === b);
        const present = GROUPS.filter(([b]) => inB(b).length);
        const selB = (treeB && present.some(([b]) => b === treeB)) ? treeB : (present[0] ? present[0][0] : 'M');
        const tiersIn = [...new Set(inB(selB).map((p) => p.tier))].sort((a, b) => tierRank(a) - tierRank(b) || a.localeCompare(b));
        const selD = (treeD && tiersIn.indexOf(treeD) >= 0) ? treeD : (tiersIn[0] || null);
        const selColor = rosBColor(selB);
        const X = [190, 470, 730, 1000], W = 1360, PITCH = 30, LEAF_PITCH = 30;
        const paths = [], L1 = [], L2 = [], L3 = [];
        const h1 = present.length * PITCH;
        let y1 = 0;
        const rootY0 = h1 / 2;
        present.forEach(([b, label]) => {
          const n = inB(b).length, color = rosBColor(b), on = b === selB;
          const y = y1 + PITCH / 2; y1 += PITCH;
          L1.push({ b, label, y, color, on, sub: n + (n === 1 ? ' nurse' : ' nurses') });
          const mx = (X[0] + X[1]) / 2;
          paths.push({ d: 'M' + (X[0] + 6) + ',' + rootY0 + ' C' + mx + ',' + rootY0 + ' ' + mx + ',' + y + ' ' + (X[1] - 6) + ',' + y, stroke: on ? color + 'b0' : 'rgba(125,145,180,.4)', w: on ? 1.7 : 1 });
        });
        const bNode = L1.find((n) => n.on) || { y: rootY0 };
        const h2 = tiersIn.length * PITCH;
        let y2 = bNode.y - h2 / 2;
        tiersIn.forEach((t) => {
          const n = inB(selB).filter((p) => p.tier === t).length, on = t === selD;
          const y = y2 + PITCH / 2; y2 += PITCH;
          L2.push({ t, y, on, sub: String(n) });
          const mx = (X[1] + X[2]) / 2;
          paths.push({ d: 'M' + (X[1] + 6) + ',' + bNode.y + ' C' + mx + ',' + bNode.y + ' ' + mx + ',' + y + ' ' + (X[2] - 6) + ',' + y, stroke: on ? selColor + 'b0' : 'rgba(125,145,180,.4)', w: on ? 1.7 : 1 });
        });
        const dNode = L2.find((n) => n.on) || bNode;
        const leafRows = inB(selB).filter((p) => p.tier === selD);
        let y3 = dNode.y - (leafRows.length * LEAF_PITCH) / 2;
        leafRows.forEach((p) => {
          const y = y3 + LEAF_PITCH / 2; y3 += LEAF_PITCH;
          const sh = R.BY_CODE[p.c] || {};
          L3.push({ p, y, time: sh.label || '' });
          const mx = (X[2] + X[3]) / 2;
          paths.push({ d: 'M' + (X[2] + 6) + ',' + dNode.y + ' C' + mx + ',' + dNode.y + ' ' + mx + ',' + y + ' ' + (X[3] - 5) + ',' + y, stroke: 'rgba(125,145,180,.5)', w: 1 });
        });
        const allY = [rootY0].concat(L1.map((n) => n.y), L2.map((n) => n.y), L3.map((n) => n.y));
        const shift = 34 - Math.min.apply(null, allY);
        const H = Math.max.apply(null, allY) + shift + 34;
        L1.forEach((n) => { n.y += shift; }); L2.forEach((n) => { n.y += shift; }); L3.forEach((n) => { n.y += shift; });
        paths.forEach((p) => { p.d = p.d.replace(/,(-?[\d.]+)/g, (m, v) => ',' + (Number(v) + shift).toFixed(1)); });
        const rY = rootY0 + shift;
        const onDuty = people.filter((p) => p.b && p.b !== 'O').length;
        const navBtn = { display: 'inline-grid', placeItems: 'center', width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(125,145,180,.35)', background: 'rgba(255,255,255,.7)', color: '#3c4858', cursor: 'pointer', flexShrink: 0 };
        const crumb = [[dept + ' roster', true], [(GROUPS.find((g) => g[0] === selB) || ['', ''])[1], true], [selD || '', !!selD]].filter((c) => c[1] && c[0]);
        return (
          <div style={{ background: 'linear-gradient(152deg,rgba(255,255,255,.78),rgba(236,247,255,.48))', backdropFilter: 'blur(26px) saturate(1.75)', WebkitBackdropFilter: 'blur(26px) saturate(1.75)', border: '1px solid rgba(255,255,255,.92)', borderRadius: 16, boxShadow: '0 14px 42px rgba(31,59,90,.14),inset 0 1px 0 rgba(255,255,255,.95)', overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 16px', borderBottom: '1px solid rgba(125,145,180,.18)', flexWrap: 'wrap' }}>
              <span style={rosBadge('rgba(0,144,202,.12)', '#0072a3', 32, 10)}><Ic d="M4 12h5M14 6h6M14 12h6M14 18h6M9 6v12M9 6h5M9 18h5" s={16} sw={1.9} /></span>
              <div style={{ minWidth: 0 }}>
                <h3 style={ROS_H3}>Tree view — {tDay} {monthLabel} · {dowOf(tDay)}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#6c7a8c', flexWrap: 'wrap' }}>
                  {crumb.map(([label], i) => (
                    <React.Fragment key={label + i}>
                      <span>{label}</span>
                      {i < crumb.length - 1 && <span style={{ color: '#b6c0cc' }}>›</span>}
                    </React.Fragment>
                  ))}
                </div>
              </div>
              <span style={{ flex: 1 }} />
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <button style={navBtn} title="Previous day" onClick={() => setTreeDay(((tDay - 2 + days) % days) + 1)}><Ic d="M15 6l-6 6 6 6" s={13} sw={2.2} /></button>
                <select value={String(tDay)} onChange={(e) => setTreeDay(Number(e.target.value))} style={{ boxSizing: 'border-box', padding: '7px 10px', borderRadius: 9, border: '1px solid rgba(125,145,180,.35)', background: 'rgba(255,255,255,.8)', fontFamily: 'inherit', fontSize: 12, color: '#16202e', outline: 'none' }}>
                  {Array.from({ length: days }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>{n} {monShort} · {dowOf(n)}</option>
                  ))}
                </select>
                <button style={navBtn} title="Next day" onClick={() => setTreeDay((tDay % days) + 1)}><Ic d="M9 6l6 6-6 6" s={13} sw={2.2} /></button>
                <button onClick={() => { setTreeB(null); setTreeD(null); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid rgba(125,145,180,.35)', background: 'rgba(255,255,255,.7)', color: '#3c4858', padding: '6px 11px', borderRadius: 9, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Reset branch</button>
              </div>
            </div>
            {present.length === 0 ? (
              <div style={{ display: 'grid', placeItems: 'center', padding: 34, textAlign: 'center', gap: 6 }}>
                <div style={{ opacity: .35 }}><Ic d="M3 5h18v16H3zM3 9h18M8 3v4M16 3v4" s={30} /></div>
                <div style={{ fontWeight: 600 }}>Nothing is written against {tDay} {R.MONTHS[month]}</div>
                <div style={{ fontSize: 11.5, color: '#6c7a8c', maxWidth: 400 }}>No shift code is recorded for anyone in {dept} on this day, so the tree has no branches to draw. Pick another day, or fill the column in on the monthly grid.</div>
              </div>
            ) : (
              <div style={{ padding: '8px 12px 16px', overflowX: 'auto', display: 'flex' }}>
                <div style={{ position: 'relative', width: W, height: H, flexShrink: 0 }}>
                  <svg viewBox={'0 0 ' + W + ' ' + H} style={{ position: 'absolute', inset: 0, width: W, height: H, pointerEvents: 'none' }}>
                    {paths.map((p, i) => <path key={i} d={p.d} fill="none" stroke={p.stroke} strokeWidth={p.w} />)}
                  </svg>
                  <div style={{ position: 'absolute', left: 0, top: (rY - 20) + 'px', width: (X[0] - 16) + 'px', height: 40, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '0 10px', boxSizing: 'border-box' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: '#16202e', whiteSpace: 'nowrap' }}>{dept}</div>
                      <div style={{ fontFamily: ROS_MONO, fontSize: 10, color: '#8a97a8', whiteSpace: 'nowrap' }}>{onDuty} / {people.length} on duty</div>
                    </div>
                  </div>
                  <div style={{ position: 'absolute', left: (X[0] - 7) + 'px', top: (rY - 7) + 'px', width: 14, height: 14, borderRadius: '50%', background: '#0072a3', border: '2px solid #fff', boxShadow: '0 0 0 4px rgba(0,114,163,.18)', boxSizing: 'border-box' }} />
                  {L1.map((n) => (
                    <React.Fragment key={n.b}>
                      <div className="ros-treerow" onClick={() => { setTreeB(n.b); setTreeD(null); }} style={{ position: 'absolute', left: 0, top: (n.y - 17) + 'px', width: (X[1] - 16) + 'px', height: 34, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '0 12px', boxSizing: 'border-box', borderRadius: 10, cursor: 'pointer', background: n.on ? 'linear-gradient(90deg,transparent,' + n.color + '1f)' : 'transparent', border: '1px solid ' + (n.on ? n.color + '3d' : 'transparent'), transition: 'all .15s' }}>
                        <span style={{ fontSize: 12.5, fontWeight: n.on ? 800 : 600, color: n.on ? n.color : '#3c4858', letterSpacing: .4, whiteSpace: 'nowrap' }}>{n.label}</span>
                        <span style={{ fontFamily: ROS_MONO, fontSize: 10, fontWeight: 700, color: n.color, background: n.color + '1a', padding: '2px 7px', borderRadius: 10, whiteSpace: 'nowrap' }}>{n.sub}</span>
                      </div>
                      <div style={{ position: 'absolute', left: (X[1] - 6) + 'px', top: (n.y - 6) + 'px', width: 12, height: 12, borderRadius: '50%', background: n.on ? n.color : '#fff', border: '2px solid ' + n.color, boxShadow: n.on ? '0 0 0 4px ' + n.color + '24' : 'none', boxSizing: 'border-box' }} />
                    </React.Fragment>
                  ))}
                  {L2.map((n) => (
                    <React.Fragment key={n.t}>
                      <div className="ros-treerow" onClick={() => setTreeD(n.t)} style={{ position: 'absolute', left: (X[1] + 20) + 'px', top: (n.y - 17) + 'px', width: (X[2] - X[1] - 36) + 'px', height: 34, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '0 12px', boxSizing: 'border-box', borderRadius: 10, cursor: 'pointer', background: n.on ? 'linear-gradient(90deg,transparent,' + selColor + '1f)' : 'transparent', border: '1px solid ' + (n.on ? selColor + '3d' : 'transparent'), transition: 'all .15s' }}>
                        <span style={{ fontSize: 12, fontWeight: n.on ? 800 : 600, color: n.on ? selColor : '#3c4858', whiteSpace: 'nowrap' }}>{n.t}</span>
                        <span style={{ fontFamily: ROS_MONO, fontSize: 10, fontWeight: 700, color: selColor, background: selColor + '1a', padding: '2px 7px', borderRadius: 10 }}>{n.sub}</span>
                      </div>
                      <div style={{ position: 'absolute', left: (X[2] - 6) + 'px', top: (n.y - 6) + 'px', width: 12, height: 12, borderRadius: '50%', background: n.on ? selColor : '#fff', border: '2px solid ' + selColor, boxShadow: n.on ? '0 0 0 4px ' + selColor + '24' : 'none', boxSizing: 'border-box' }} />
                    </React.Fragment>
                  ))}
                  {L3.map((n) => (
                    <React.Fragment key={n.p.x.empId}>
                      <div style={{ position: 'absolute', left: (X[3] + 16) + 'px', top: (n.y - 15) + 'px', display: 'flex', alignItems: 'center', gap: 9, padding: '5px 12px', borderRadius: 10, background: 'rgba(255,255,255,.72)', border: '1px solid ' + selColor + '2e', boxShadow: '0 3px 10px rgba(31,59,90,.07)', whiteSpace: 'nowrap' }}>
                        <MK.Av name={n.p.x.name} emp={n.p.x} empId={n.p.x.empIdShown} size={22} radius={rosAvRadius(22)} />
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#16202e' }}>{n.p.x.name}</span>
                        <span style={{ fontFamily: ROS_MONO, fontSize: 10, color: '#0072a3' }}>{n.p.x.empIdShown ? 'ID ' + n.p.x.empIdShown : 'no Emp-ID'}</span>
                        <span style={{ fontFamily: ROS_MONO, fontSize: 10.5, fontWeight: 700, color: '#fff', background: selColor, padding: '2px 8px', borderRadius: 7 }}>{n.p.c}</span>
                        <span style={{ fontFamily: ROS_MONO, fontSize: 10.5, color: '#6c7a8c' }}>{n.time}</span>
                      </div>
                      <div style={{ position: 'absolute', left: (X[3] - 5) + 'px', top: (n.y - 5) + 'px', width: 10, height: 10, borderRadius: '50%', background: '#fff', border: '2px solid ' + selColor, boxSizing: 'border-box' }} />
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
            <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(125,145,180,.18)', display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', background: 'rgba(247,251,255,.55)' }}>
              {ROS_BUCKETS.concat([['O', 'Off / leave', '#8b98ab', '']]).map(([b, label, c]) => (
                <span key={b} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 700, color: c, background: c + '18', border: '1px solid ' + c + '33', padding: '4px 10px', borderRadius: 12, whiteSpace: 'nowrap' }}>{label}</span>
              ))}
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 10.5, color: '#8a97a8' }}>Click a shift, then a designation — the branch drills down one level at a time.</span>
            </div>
          </div>
        );
      })()}

      {/* ---- shift swaps ---- */}
      {view === 'swap' && (
        <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'linear-gradient(152deg,rgba(255,255,255,.8),rgba(236,247,255,.5))', backdropFilter: 'blur(24px) saturate(1.7)', WebkitBackdropFilter: 'blur(24px) saturate(1.7)', border: '1px solid rgba(255,255,255,.92)', borderRadius: 15, boxShadow: '0 12px 36px rgba(31,59,90,.12),inset 0 1px 0 rgba(255,255,255,.95)', padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 13, flexWrap: 'wrap' }}>
            <span style={rosBadge('rgba(0,144,202,.12)', '#0072a3', 32, 10)}><Ic d="M7 16H3l4-4M17 8h4l-4 4M3 16h14M21 8H7" s={16} sw={1.9} /></span>
            <div style={{ minWidth: 200, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#16202e' }}>Drag shifts in the grid above to swap</div>
              <div style={{ fontSize: 11, color: '#6c7a8c', lineHeight: 1.5 }}>Drop onto another cell — same nurse or a different one. Cross-nurse drops are logged below.</div>
            </div>
          </div>
          {swapLog.map((l) => (
            <div key={l.id} style={{ background: 'linear-gradient(152deg,rgba(255,255,255,.78),rgba(236,247,255,.48))', backdropFilter: 'blur(24px) saturate(1.7)', WebkitBackdropFilter: 'blur(24px) saturate(1.7)', border: '1px solid rgba(255,255,255,.92)', borderRadius: 15, boxShadow: '0 12px 36px rgba(31,59,90,.12),inset 0 1px 0 rgba(255,255,255,.95)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 13, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: ROS_MONO, fontSize: 11, color: '#9aa6b4' }}>{l.id}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 250, flex: 1 }}>
                <MK.Av name={l.aName} size={30} radius={rosAvRadius(30)} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#16202e' }}>{l.aName}</div>
                  <div style={{ fontSize: 10.5, color: '#9aa6b4' }}>Day {l.aDay} · <span style={{ fontFamily: ROS_MONO }}>{l.aCode || '—'}</span></div>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0090ca" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M7 16H3l4-4M17 8h4l-4 4M3 16h14M21 8H7" /></svg>
                <MK.Av name={l.bName} size={30} radius={rosAvRadius(30)} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#16202e' }}>{l.bName}</div>
                  <div style={{ fontSize: 10.5, color: '#9aa6b4' }}>Day {l.bDay} · <span style={{ fontFamily: ROS_MONO }}>{l.bCode || '—'}</span></div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#6c7a8c', maxWidth: 230, lineHeight: 1.5 }}>{l.mode === 'swap' ? 'Created by drag — shifts exchanged in the grid.' : 'Created by drag — shift moved across.'}</div>
              <span style={rosChipS('#0072a3', 'rgba(0,144,202,.12)')}>Applied</span>
            </div>
          ))}
          {swapLog.length === 0 && (
            <div style={{ ...ROS_CARD15, padding: '16px 18px', fontSize: 12, color: '#9aa6b4' }}>No swaps logged yet this session — drag one shift onto another in the grid, then confirm the change.</div>
          )}
        </div>
      )}

      {/* ---- rules & policy ---- */}
      {view === 'rules' && (() => {
        const selStyle = { width: '100%', boxSizing: 'border-box', padding: '9px 10px', borderRadius: 9, border: '1px solid rgba(125,145,180,.35)', background: 'rgba(255,255,255,.85)', fontFamily: 'inherit', fontSize: 12, color: '#16202e', outline: 'none' };
        const stepStyle = { width: 22, height: 22, borderRadius: 7, border: '1px solid rgba(125,145,180,.3)', background: 'rgba(255,255,255,.8)', color: '#3c4858', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1, display: 'grid', placeItems: 'center' };
        const metricOpts = draft.scope === 'day'
          ? [['onDuty', 'staff on duty'], ['morning', 'morning staff'], ['evening', 'evening staff'], ['night', 'night staff'], ['general', 'general-duty staff'], ['onLeave', 'staff on leave']]
          : [['nights', 'night shifts'], ['hours', 'total hours'], ['offDays', 'rest days'], ['shifts', 'shifts worked'], ['fridaysWorked', 'Fridays worked']];
        const canAdd = !!draft.name.trim();
        return (
          <div style={{ marginBottom: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(330px,1fr))', gap: 14, alignItems: 'start' }}>
            <div style={{ background: 'linear-gradient(152deg,rgba(255,255,255,.78),rgba(236,247,255,.48))', backdropFilter: 'blur(24px) saturate(1.7)', WebkitBackdropFilter: 'blur(24px) saturate(1.7)', border: '1px solid rgba(255,255,255,.92)', borderRadius: 16, boxShadow: '0 14px 40px rgba(31,59,90,.13),inset 0 1px 0 rgba(255,255,255,.95)', overflow: 'hidden' }}>
              <div style={ROS_CARD_HEAD}>
                <span style={rosBadge('rgba(0,144,202,.12)', '#0072a3', 26)}><Ic d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6zM9 12l2 2 4-4" s={14} sw={1.9} /></span>
                <h3 style={ROS_H3}>Rule set</h3>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: '#9aa6b4' }}>switch off or retune any rule</span>
              </div>
              <div>
                {[
                  ['ratio', 'Nurse-to-patient ratio', 'minimum on duty per day', 'minOnDuty'],
                  ['min', 'Minimum morning staff', 'M shift floor', 'minM'],
                  ['min2', 'Minimum evening staff', 'E shift floor', 'minE'],
                  ['min3', 'Minimum night staff', 'N shift floor', 'minN'],
                  ['nights', 'Max consecutive nights', 'nights in a row before a warning', 'maxNights'],
                  ['offdays', 'Weekly off entitlement', 'rest days per month', 'minOff'],
                  ['leave', 'Leave clash limit', 'staff allowed on leave per day', 'maxLeavePerDay'],
                  ['nm', 'No night → morning', 'block back-to-back turnaround', ''],
                  ['senior', 'Senior nurse on nights', 'senior / team leader / charge', ''],
                  ['friday', 'Friday off entitlement (BD)', 'at least one Friday off per nurse', ''],
                ].map(([key, label, hint, num]) => {
                  const enKey = key === 'min2' || key === 'min3' ? 'min' : key;
                  const on = en[enKey] !== false;
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 16px', borderBottom: '1px solid rgba(125,145,180,.12)', background: on ? 'transparent' : 'rgba(244,246,249,.6)', opacity: on ? 1 : .62 }}>
                      <span onClick={() => { setEn((s) => ({ ...s, [enKey]: s[enKey] === false })); setDirty(true); }} style={{ width: 34, height: 19, borderRadius: 12, flexShrink: 0, cursor: 'pointer', padding: 2, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: on ? 'flex-end' : 'flex-start', background: on ? 'linear-gradient(135deg,#3ab5a7,#0090ca)' : 'rgba(125,145,180,.35)', transition: 'all .2s' }}>
                        <span style={{ width: 15, height: 15, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#16202e' }}>{label}</div>
                        <div style={{ fontSize: 10.5, color: '#9aa6b4', lineHeight: 1.45 }}>{hint}</div>
                      </div>
                      {!!num && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                          <button onClick={() => { setCfg((c) => ({ ...c, [num]: Math.max(0, c[num] - 1) })); setDirty(true); }} style={stepStyle}>−</button>
                          <span style={{ fontFamily: ROS_MONO, fontSize: 12.5, fontWeight: 800, color: '#16202e', minWidth: 20, textAlign: 'center' }}>{cfg[num]}</span>
                          <button onClick={() => { setCfg((c) => ({ ...c, [num]: c[num] + 1 })); setDirty(true); }} style={stepStyle}>+</button>
                        </div>
                      )}
                      <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: .5, textTransform: 'uppercase', color: on ? '#157a43' : '#9aa6b4', background: on ? 'rgba(31,157,87,.13)' : 'rgba(125,145,180,.14)', padding: '2px 8px', borderRadius: 9, flexShrink: 0, minWidth: 26, textAlign: 'center' }}>{on ? 'on' : 'off'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: 'linear-gradient(152deg,rgba(255,255,255,.78),rgba(236,247,255,.48))', backdropFilter: 'blur(24px) saturate(1.7)', WebkitBackdropFilter: 'blur(24px) saturate(1.7)', border: '1px solid rgba(255,255,255,.92)', borderRadius: 16, boxShadow: '0 14px 40px rgba(31,59,90,.13),inset 0 1px 0 rgba(255,255,255,.95)', overflow: 'hidden' }}>
                <div style={ROS_CARD_HEAD}>
                  <span style={rosBadge('rgba(106,82,212,.12)', '#5b45c4', 26)}><Ic d="M12 5v14M5 12h14" s={14} sw={2} /></span>
                  <h3 style={ROS_H3}>Create a custom rule</h3>
                </div>
                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 11 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: .5, textTransform: 'uppercase', color: '#7d8ea8' }}>Rule name</label>
                    <input value={draft.name} onChange={(e) => { const v = e.target.value; setDraft((s) => ({ ...s, name: v })); }} placeholder="e.g. At least 2 seniors on every evening"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 9, border: '1px solid rgba(125,145,180,.35)', background: 'rgba(255,255,255,.85)', fontFamily: 'inherit', fontSize: 12.5, color: '#16202e', outline: 'none' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 9 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: .5, textTransform: 'uppercase', color: '#7d8ea8' }}>Applies to</label>
                      <select value={draft.scope} onChange={(e) => { const v = e.target.value; setDraft((s) => ({ ...s, scope: v, metric: v === 'day' ? 'onDuty' : 'nights' })); }} style={selStyle}>
                        {[['day', 'Each day'], ['staff', 'Each nurse']].map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: .5, textTransform: 'uppercase', color: '#7d8ea8' }}>Count of</label>
                      <select value={draft.metric} onChange={(e) => { const v = e.target.value; setDraft((s) => ({ ...s, metric: v })); }} style={selStyle}>
                        {metricOpts.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: .5, textTransform: 'uppercase', color: '#7d8ea8' }}>Flag when</label>
                      <select value={draft.op} onChange={(e) => { const v = e.target.value; setDraft((s) => ({ ...s, op: v })); }} style={selStyle}>
                        {[['<', 'is below'], ['>', 'is above'], ['=', 'equals']].map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: .5, textTransform: 'uppercase', color: '#7d8ea8' }}>Value</label>
                      <input value={String(draft.val)} onChange={(e) => { const v = parseInt(e.target.value.replace(/[^0-9]/g, '') || '0', 10); setDraft((s) => ({ ...s, val: v })); }} style={selStyle} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                    <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.9)', borderRadius: 9, padding: 3, gap: 2 }}>
                      {[['warning', 'Warning'], ['blocker', 'Blocker']].map(([v, label]) => (
                        <button key={v} onClick={() => setDraft((s) => ({ ...s, sev: v }))} style={{ border: 0, background: draft.sev === v ? (v === 'blocker' ? 'linear-gradient(135deg,#e8697f,#a92c42)' : 'linear-gradient(135deg,#f0a94a,#b5670a)') : 'transparent', color: draft.sev === v ? '#fff' : '#6c7a8c', padding: '6px 13px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s' }}>{label}</button>
                      ))}
                    </div>
                    <span style={{ flex: 1 }} />
                    <button onClick={() => { if (!canAdd) return; setCustom((s) => [...s, { ...draft, id: 'c' + Date.now() }]); setDraft({ name: '', scope: 'day', metric: 'onDuty', op: '<', val: 4, sev: 'warning' }); setDirty(true); }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(255,255,255,.4)', background: canAdd ? 'linear-gradient(135deg,#27a8db,#0072a3)' : 'linear-gradient(135deg,#9fb3c8,#7d8ea8)', color: '#fff', padding: '8px 14px', borderRadius: 9, fontSize: 11.5, fontWeight: 700, cursor: canAdd ? 'pointer' : 'default', fontFamily: 'inherit', boxShadow: canAdd ? '0 7px 18px rgba(0,144,202,.35)' : 'none', flexShrink: 0 }}>
                      <Ic d="M12 5v14M5 12h14" s={13} sw={2.4} />Add rule
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: '#6c7a8c', lineHeight: 1.55, background: 'rgba(0,144,202,.08)', borderRadius: 9, padding: '9px 11px' }}>
                    <b>Preview:</b> Flag every {draft.scope === 'day' ? 'day' : 'nurse'} where {ROS_METRIC_LABEL[draft.metric] || draft.metric} {{ '<': 'is below', '>': 'is above', '=': 'equals' }[draft.op]} {draft.val} — as a {draft.sev}.
                  </div>
                </div>
              </div>
              <div style={{ background: 'linear-gradient(152deg,rgba(255,255,255,.78),rgba(236,247,255,.48))', backdropFilter: 'blur(24px) saturate(1.7)', WebkitBackdropFilter: 'blur(24px) saturate(1.7)', border: '1px solid rgba(255,255,255,.92)', borderRadius: 16, boxShadow: '0 14px 40px rgba(31,59,90,.13),inset 0 1px 0 rgba(255,255,255,.95)', overflow: 'hidden' }}>
                <div style={ROS_CARD_HEAD}>
                  <h3 style={ROS_H3}>Custom rules</h3>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: '#9aa6b4' }}>{custom.length} active</span>
                </div>
                <div>
                  {ev.customResults.map((cr) => (
                    <div key={cr.rule.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid rgba(125,145,180,.12)' }}>
                      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: .5, color: '#fff', background: cr.rule.sev === 'blocker' ? 'linear-gradient(135deg,#e8697f,#a92c42)' : 'linear-gradient(135deg,#f0a94a,#b5670a)', padding: '3px 7px', borderRadius: 6, flexShrink: 0 }}>{cr.rule.sev === 'blocker' ? 'BLOCK' : 'WARN'}</span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#16202e' }}>{cr.rule.name}</div>
                        <div style={{ fontSize: 10.5, color: '#9aa6b4', fontFamily: ROS_MONO }}>{cr.rule.scope} · {(ROS_METRIC_LABEL[cr.rule.metric] || cr.rule.metric)} {cr.rule.op} {cr.rule.val}</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: cr.hits.length ? '#a92c42' : '#157a43', background: cr.hits.length ? 'rgba(210,58,82,.12)' : 'rgba(31,157,87,.13)', padding: '2px 8px', borderRadius: 9, whiteSpace: 'nowrap', flexShrink: 0 }}>{cr.hits.length ? cr.hits.length + ' hits' : 'clear'}</span>
                      <button onClick={() => { setCustom((s) => s.filter((x) => x.id !== cr.rule.id)); setDirty(true); }} title="Delete rule" className="ros-decl" style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid rgba(210,58,82,.3)', background: 'rgba(255,255,255,.7)', color: '#a92c42', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Ic d="M18 6L6 18M6 6l12 12" s={12} sw={2.4} /></button>
                    </div>
                  ))}
                  {custom.length === 0 && <div style={{ padding: '14px 16px', fontSize: 12, color: '#9aa6b4' }}>No custom rules yet — build one above.</div>}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ---- footer: rule checks · sign-off ---- */}
      {showFooter && (() => {
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14 }}>
            <div data-rules="1" style={{ background: 'linear-gradient(152deg,rgba(255,255,255,.78),rgba(236,247,255,.48))', backdropFilter: 'blur(24px) saturate(1.7)', WebkitBackdropFilter: 'blur(24px) saturate(1.7)', border: '1px solid rgba(255,255,255,.92)', borderRadius: 16, boxShadow: '0 14px 40px rgba(31,59,90,.13),inset 0 1px 0 rgba(255,255,255,.95)', overflow: 'hidden' }}>
              <div style={ROS_CARD_HEAD}>
                <span style={rosBadge('rgba(210,58,82,.12)', '#a92c42', 26)}><Ic d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6zM12 8v4M12 16h.01" s={14} sw={2} /></span>
                <h3 style={ROS_H3}>Rule checks</h3>
                <span style={{ flex: 1 }} />
                <span style={rosChipS(ev.okRules === ev.rules.length ? '#157a43' : '#b5670a', ev.okRules === ev.rules.length ? 'rgba(31,157,87,.13)' : 'rgba(224,138,30,.14)')}>{ev.okRules} of {ev.rules.length} clear</span>
              </div>
              <div>
                {ev.rules.map(([rule, base, list], i) => (
                  <div key={rule + i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 16px', borderBottom: '1px solid rgba(125,145,180,.12)' }}>
                    <span style={{ display: 'inline-grid', placeItems: 'center', width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1, color: '#fff', background: list.length ? 'linear-gradient(135deg,#e8697f,#a92c42)' : 'linear-gradient(135deg,#2fbf7f,#157a43)' }}>
                      <Ic d={list.length ? 'M18 6L6 18M6 6l12 12' : 'M4 12l5 5L20 6'} s={10} sw={3.4} />
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#16202e' }}>{rule}</div>
                      <div style={{ fontSize: 11, color: '#6c7a8c', lineHeight: 1.5 }}>{list.length ? list.slice(0, 3).join(' · ') + (list.length > 3 ? ' +' + (list.length - 3) + ' more' : '') : base}</div>
                    </div>
                    <span style={rosChipS(list.length ? '#a92c42' : '#157a43', list.length ? 'rgba(210,58,82,.12)' : 'rgba(31,157,87,.13)')}>{list.length ? String(list.length) : 'ok'}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <RosSignOff signers={signers} meta={{ ...meta, status }} dept={dept} />
            </div>
          </div>
        );
      })()}

      {/* ---- the anchored cell picker ---- */}
      {pick && (() => {
        const vh = window.innerHeight, vw = window.innerWidth;
        const below = vh - pick.cellBottom - 14, above = pick.cellTop - 14;
        const flip = below < 260 && above > below;
        const room = Math.max(180, Math.min(Math.round(vh * 0.7), flip ? above : below));
        const pickStyle = {
          position: 'fixed', left: Math.min(Math.max(124, pick.x), vw - 130), transform: 'translateX(-50%)',
          top: flip ? 'auto' : pick.cellBottom + 6, bottom: flip ? (vh - pick.cellTop + 6) : 'auto',
          maxHeight: room, overflowY: 'auto', zIndex: 4000, width: 240,
          background: 'linear-gradient(158deg,rgba(255,255,255,.99),rgba(240,247,254,.97))', border: '1px solid rgba(125,145,180,.28)',
          borderRadius: 13, boxShadow: '0 22px 56px rgba(31,59,90,.28)', animation: 'rosPop .16s cubic-bezier(.2,.7,.3,1) both',
        };
        const current = cellCode(pick.empId, pick.d);
        const doPick = (k) => {
          push(); setCells((g) => writeCell(g, pick.empId, pick.d, k));
          // AL asks which worked day it stands in for — Skip leaves it without.
          if (k === 'AL') { const a = (altLeave[pick.empId] || {})[pick.d] || {}; setPick((p) => ({ ...p, alStep: true, alFor: a.for || '', alNote: a.note || '' })); return; }
          setPick(null);
        };
        const ocOn = !!((oncall[pick.empId] || {})[pick.d]);
        const ocOk = R.isDuty(current);
        const toggleOc = () => {
          if (!canEdit) return editBlocked();
          if (!ocOk) return;
          setOncall((m) => { const row = { ...(m[pick.empId] || {}) }; if (row[pick.d]) delete row[pick.d]; else row[pick.d] = 1; return { ...m, [pick.empId]: row }; });
          setDirty(true);
        };
        const saveAl = () => {
          if (!canEdit) return editBlocked();
          setAltLeave((m) => ({ ...m, [pick.empId]: { ...(m[pick.empId] || {}), [pick.d]: { for: pick.alFor || '', note: String(pick.alNote || '').trim() } } }));
          setDirty(true); setPick(null);
        };
        const alInp = { width: '100%', boxSizing: 'border-box', padding: '6px 9px', borderRadius: 8, border: '1px solid rgba(125,145,180,.4)', fontFamily: 'inherit', fontSize: 11.5, color: '#16202e', background: '#fff' };
        return (
          <React.Fragment>
            <div onClick={() => setPick(null)} style={{ position: 'fixed', inset: 0, zIndex: 3900 }} />
            <div style={pickStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderBottom: '1px solid rgba(125,145,180,.2)', background: 'rgba(233,243,252,.6)' }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#16202e', whiteSpace: 'nowrap' }}>{pick.name}</span>
                <span style={{ fontSize: 10.5, color: '#6c7a8c', whiteSpace: 'nowrap' }}>Day {pick.d} · {dowOf(pick.d)}</span>
                <span style={{ flex: 1 }} />
                <span className="ros-x" onClick={() => setPick(null)} style={{ cursor: 'pointer', color: '#9aa6b4', display: 'grid', placeItems: 'center', width: 20, height: 20, borderRadius: 6 }}><Ic d="M18 6L6 18M6 6l12 12" s={12} sw={2.4} /></span>
              </div>
              {(marks[pick.empId] || {})[pick.d] && (
                <div style={{ margin: '8px 11px 0', padding: '7px 9px', borderRadius: 8, background: 'rgba(210,58,82,.07)', border: '1px solid rgba(210,58,82,.25)', fontSize: 11, color: '#8c1d2a' }}>
                  <b>Review note:</b> {marks[pick.empId][pick.d].note}
                  {canEdit && <button type="button" className="btn sm" style={{ marginLeft: 8 }} onClick={() => markDone(pick.empId, pick.d)}>Done</button>}
                </div>
              )}
              {pick.alStep ? (
                <div style={{ padding: '11px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#16202e' }}>Alternative leave — in lieu of which date?</div>
                  <div style={{ fontSize: 10.5, color: '#6c7a8c', marginTop: -4 }}>The day worked that this leave replaces — any month.</div>
                  <input type="date" value={pick.alFor || ''} disabled={!canEdit} onChange={(e) => { const v = e.target.value; setPick((p) => ({ ...p, alFor: v })); }} style={alInp} />
                  {pick.alFor && <div style={{ fontSize: 10.5, fontWeight: 700, color: '#0072a3', marginTop: -3 }}>{new Date(pick.alFor + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>}
                  <input value={pick.alNote || ''} maxLength={120} disabled={!canEdit} placeholder="Reason (optional) — e.g. public holiday duty" onChange={(e) => { const v = e.target.value; setPick((p) => ({ ...p, alNote: v })); }} style={alInp} />
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button type="button" className="btn sm" onClick={() => setPick((p) => ({ ...p, alStep: false }))}>Change shift</button>
                    <button type="button" className="btn sm" onClick={() => setPick(null)}>Skip</button>
                    <button type="button" className="btn sm pri" disabled={!canEdit} onClick={saveAl}>Save</button>
                  </div>
                </div>
              ) : (
              <div style={{ padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div onClick={toggleOc} title={ocOk ? 'On call as well as this shift' : 'Pick a duty shift first — on call on a day off is the OC code'}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', borderRadius: 8, cursor: ocOk ? 'pointer' : 'not-allowed', opacity: ocOk ? 1 : 0.5,
                    border: '1px solid ' + (ocOn && ocOk ? '#0d3a5c' : 'rgba(125,145,180,.3)'), background: ocOn && ocOk ? 'rgba(13,58,92,.08)' : '#fff' }}>
                  <input type="checkbox" readOnly checked={ocOn && ocOk} style={{ margin: 0, pointerEvents: 'none' }} />
                  <b style={{ fontSize: 10.5, color: '#16202e' }}>On call</b>
                  <span style={{ fontSize: 10, color: '#6c7a8c' }}>in addition to the shift</span>
                </div>
                {[['G', 'General', '#6a52d4'], ['M', 'Morning', '#b5670a'], ['E', 'Evening', '#0072a3'], ['N', 'Night', '#5b45c4'], ['O', 'Leave / off', '#7d8ea8']].map(([b, label, color]) => (
                  <div key={b}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: .8, textTransform: 'uppercase', color, marginBottom: 5 }}>{label}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {R.SHIFTS.filter((s) => s.bucket === b).map((s) => {
                        const on = current === s.code;
                        return (
                          <div key={s.code} onClick={() => doPick(s.code)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 9px', borderRadius: 8, cursor: 'pointer', color: on ? color : '#3c4858', background: on ? color + '16' : 'transparent', border: '1px solid ' + (on ? color + '4d' : 'transparent'), fontWeight: on ? 700 : 500 }}>
                            <b style={{ fontFamily: ROS_MONO, fontSize: 10, minWidth: 30, flexShrink: 0 }}>{s.code}</b>
                            <span style={{ fontSize: 10.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: .8, textTransform: 'uppercase', color: '#9fb0c4', marginBottom: 5 }}>Clear</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div onClick={() => doPick('')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 9px', borderRadius: 8, cursor: 'pointer', color: '#a92c42', background: 'rgba(210,58,82,.08)', border: '1px solid rgba(210,58,82,.24)' }}>
                      <b style={{ fontFamily: ROS_MONO, fontSize: 10, minWidth: 30, flexShrink: 0 }}>—</b>
                      <span style={{ fontSize: 10.5 }}>Not assigned</span>
                    </div>
                  </div>
                </div>
              </div>
              )}
            </div>
          </React.Fragment>
        );
      })()}

      {/* ---- pending-changes drawer ---- */}
      {queue.length > 0 && (() => {
        const nameOf = (id) => (rows.find((r) => r.empId === id) || {}).name || id;
        const firstOf = (id) => String(nameOf(id)).split(' ')[0];
        const BN = { G: 'General', M: 'Morning', E: 'Evening', N: 'Night', O: 'Leave / off' };
        const chip = (label, c) => ({ label, style: { fontSize: 9, fontWeight: 700, color: c, background: c + '16', border: '1px solid ' + c + '33', padding: '2px 7px', borderRadius: 8, whiteSpace: 'nowrap' } });
        const qRows = queue.map((q) => {
          const aB = R.bucketOf(q.aCode) || '', bB = R.bucketOf(q.bCode) || '';
          const warns = [];
          const after = (id, d) => {
            if (id === q.bId && d === q.bDi) return q.aCode;
            if (id === q.aId && d === q.aDi) return q.mode === 'swap' ? q.bCode : '';
            return cellCode(id, d);
          };
          const bAt = (id, d) => R.bucketOf(after(id, d)) || '';
          if (bAt(q.bId, q.bDi - 1) === 'N' && bAt(q.bId, q.bDi) === 'M') warns.push(firstOf(q.bId) + ' would work night → morning.');
          if (bAt(q.bId, q.bDi) === 'N' && bAt(q.bId, q.bDi + 1) === 'M') warns.push(firstOf(q.bId) + ' has a morning right after this night.');
          [q.aDi, q.bDi].filter((v, i, arr) => arr.indexOf(v) === i).forEach((d) => {
            ['M', 'E', 'N'].forEach((bk) => {
              let n = 0; rows.forEach((x) => { if (bAt(x.empId, d) === bk) n++; });
              const floor = bk === 'M' ? cfg.minM : bk === 'E' ? cfg.minE : cfg.minN;
              if (n < floor) warns.push('Day ' + d + ' ' + BN[bk].toLowerCase() + ' drops to ' + n + ' (floor ' + floor + ').');
            });
            let sen = false;
            rows.forEach((x) => { if (bAt(x.empId, d) === 'N' && /Senior|Team|Charge/.test(x.desig || '')) sen = true; });
            if (!sen) warns.push('Day ' + d + ' night would have no senior nurse.');
          });
          let run = 0, maxRun = 0;
          for (let d = 1; d <= days; d++) { if (bAt(q.bId, d) === 'N') { run++; maxRun = Math.max(maxRun, run); } else run = 0; }
          if (maxRun > cfg.maxNights) warns.push(firstOf(q.bId) + ' would hit ' + maxRun + ' nights in a row (max ' + cfg.maxNights + ').');
          const sameKind = aB === bB;
          const aCol = rosBColor(aB), bCol = rosBColor(bB);
          const aH = R.hoursOf(q.aCode), bH = R.hoursOf(q.bCode);
          const deltas = [];
          const aDelta = q.mode === 'swap' ? bH - aH : -aH;
          const bDelta = aH - bH;
          deltas.push(chip(firstOf(q.aId) + ' ' + (aDelta >= 0 ? '+' : '') + aDelta + ' h', aDelta === 0 ? '#6c7a8c' : aDelta > 0 ? '#b5670a' : '#157a43'));
          if (q.aId !== q.bId) deltas.push(chip(firstOf(q.bId) + ' ' + (bDelta >= 0 ? '+' : '') + bDelta + ' h', bDelta === 0 ? '#6c7a8c' : bDelta > 0 ? '#b5670a' : '#157a43'));
          [q.aDi, q.bDi].filter((v, i, arr) => arr.indexOf(v) === i).forEach((d) => {
            const before = onDutyOf(d);
            let aft = 0; rows.forEach((x) => { const bb = bAt(x.empId, d); if (bb && bb !== 'O') aft++; });
            const dd = aft - before;
            deltas.push(chip('Day ' + d + ' cover ' + before + '→' + aft, dd === 0 ? '#0072a3' : dd > 0 ? '#157a43' : '#a92c42'));
          });
          return {
            q, warns, deltas,
            mode: q.mode === 'swap' ? 'SWAP' : 'MOVE',
            variation: (BN[aB] || '—') + ' → ' + (BN[bB] || '—'),
            varStyle: { fontSize: 9.5, fontWeight: 700, color: sameKind ? '#6c7a8c' : '#5b45c4', background: sameKind ? 'rgba(125,145,180,.14)' : 'rgba(106,82,212,.12)', border: '1px solid ' + (sameKind ? 'rgba(125,145,180,.24)' : 'rgba(106,82,212,.26)'), padding: '2px 8px', borderRadius: 8, whiteSpace: 'nowrap' },
            cardStyle: { background: warns.length ? 'linear-gradient(150deg,rgba(255,241,243,.95),rgba(255,255,255,.9))' : 'rgba(255,255,255,.85)', border: '1px solid ' + (warns.length ? 'rgba(210,58,82,.3)' : 'rgba(125,145,180,.22)'), borderLeft: '3px solid ' + (warns.length ? '#d23a52' : 'rgba(0,144,202,.5)'), borderRadius: 11, padding: '9px 10px', boxShadow: warns.length ? '0 3px 12px rgba(210,58,82,.12)' : '0 2px 8px rgba(31,59,90,.06)' },
            aTime: R.BY_CODE[q.aCode] ? R.BY_CODE[q.aCode].label + ' · ' + aH + ' h' : 'unassigned',
            bTime: R.BY_CODE[q.bCode] ? R.BY_CODE[q.bCode].label + ' · ' + bH + ' h' : 'unassigned',
            aCodeStyle: { fontFamily: ROS_MONO, fontSize: 9.5, fontWeight: 700, color: q.aCode ? (aB === 'O' ? '#6c7a8c' : '#fff') : '#9aa6b4', background: q.aCode ? (aB === 'O' ? 'rgba(125,145,180,.2)' : aCol) : 'rgba(125,145,180,.12)', padding: '1px 6px', borderRadius: 5, flexShrink: 0 },
            bCodeStyle: { fontFamily: ROS_MONO, fontSize: 9.5, fontWeight: 700, color: q.bCode ? (bB === 'O' ? '#6c7a8c' : '#fff') : '#9aa6b4', background: q.bCode ? (bB === 'O' ? 'rgba(125,145,180,.2)' : bCol) : 'rgba(125,145,180,.12)', padding: '1px 6px', borderRadius: 5, flexShrink: 0 },
            modeStyle: { fontSize: 9, fontWeight: 800, letterSpacing: .6, color: '#fff', background: q.mode === 'swap' ? 'linear-gradient(135deg,#27a8db,#0072a3)' : 'linear-gradient(135deg,#8a74e8,#5b45c4)', padding: '2px 7px', borderRadius: 6, flexShrink: 0 },
          };
        });
        const cross = queue.filter((q) => q.aId !== q.bId).length;
        return (
          <div style={{ position: 'fixed', right: 18, top: '50%', transform: 'translateY(-50%)', zIndex: 4300, width: 296, maxHeight: '76vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(158deg,rgba(255,255,255,.98),rgba(238,246,254,.96))', border: '1px solid rgba(255,255,255,.95)', borderRadius: 16, boxShadow: '0 26px 64px rgba(31,59,90,.28)', animation: 'rosSlideInY .26s cubic-bezier(.2,.75,.3,1) both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 15px', borderBottom: '1px solid rgba(125,145,180,.2)', background: 'linear-gradient(180deg,rgba(233,243,252,.75),rgba(255,255,255,.4))', borderRadius: '16px 16px 0 0' }}>
              <span style={rosBadge('rgba(0,144,202,.13)', '#0072a3', 30, 9)}><Ic d="M7 16H3l4-4M17 8h4l-4 4M3 16h14M21 8H7" s={15} sw={1.9} /></span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#16202e' }}>Pending changes</div>
                <div style={{ fontSize: 10.5, color: '#6c7a8c' }}>{queue.length + (queue.length === 1 ? ' change' : ' changes')} · not saved yet</div>
              </div>
              <span className="ros-xred" onClick={() => setQueue([])} title="Discard all" style={{ cursor: 'pointer', color: '#9aa6b4', display: 'grid', placeItems: 'center', width: 24, height: 24, borderRadius: 7, flexShrink: 0 }}><Ic d="M18 6L6 18M6 6l12 12" s={13} sw={2.4} /></span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {qRows.map((r) => (
                <div key={r.q.key} style={r.cardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7, flexWrap: 'wrap' }}>
                    <span style={r.modeStyle}>{r.mode}</span>
                    <span style={r.varStyle}>{r.variation}</span>
                    <span style={{ flex: 1 }} />
                    <span className="ros-xred" onClick={() => setQueue((s) => s.filter((x) => x.key !== r.q.key))} title="Remove" style={{ cursor: 'pointer', color: '#b6c0cc', display: 'grid', placeItems: 'center', width: 18, height: 18, borderRadius: 5, flexShrink: 0 }}><Ic d="M18 6L6 18M6 6l12 12" s={10} sw={3} /></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#16202e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nameOf(r.q.aId)}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}><span style={r.aCodeStyle}>{r.q.aCode || '—'}</span><span style={{ fontSize: 9.5, color: '#9aa6b4' }}>Day {r.q.aDi}</span></div>
                      <div style={{ fontSize: 9.5, color: '#6c7a8c', fontFamily: ROS_MONO, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.aTime}</div>
                    </div>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0090ca" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M7 16H3l4-4M17 8h4l-4 4M3 16h14M21 8H7" /></svg>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#16202e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nameOf(r.q.bId)}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}><span style={r.bCodeStyle}>{r.q.bCode || '—'}</span><span style={{ fontSize: 9.5, color: '#9aa6b4' }}>Day {r.q.bDi}</span></div>
                      <div style={{ fontSize: 9.5, color: '#6c7a8c', fontFamily: ROS_MONO, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.bTime}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 7, paddingTop: 7, borderTop: '1px solid rgba(125,145,180,.16)' }}>
                    {r.deltas.map((d2, i) => <span key={i} style={d2.style}>{d2.label}</span>)}
                  </div>
                  {r.warns.length > 0 && (
                    <div style={{ marginTop: 7, background: 'rgba(210,58,82,.09)', border: '1px solid rgba(210,58,82,.22)', borderRadius: 8, padding: '7px 9px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a92c42" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0zM12 9v4M12 17h.01" /></svg>
                        <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: .6, textTransform: 'uppercase', color: '#a92c42' }}>Rule alert</span>
                        <span style={{ flex: 1 }} />
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#a92c42' }}>{r.warns.length > 3 ? '+' + (r.warns.length - 3) + ' more' : ''}</span>
                      </div>
                      {r.warns.slice(0, 3).map((a, i) => <div key={i} style={{ fontSize: 10, color: '#7a1f30', lineHeight: 1.5 }}>· {a}</div>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ padding: '11px 13px', borderTop: '1px solid rgba(125,145,180,.2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 10.5, color: '#6c7a8c', background: 'rgba(0,144,202,.08)', borderRadius: 8, padding: '7px 9px', lineHeight: 1.45 }}>
                {cross ? cross + ' cross-nurse ' + (cross === 1 ? 'swap' : 'swaps') + ' will be logged for the CNS' : 'Same-nurse moves only — no approval needed'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setQueue([])} style={{ flex: 1, border: '1px solid rgba(125,145,180,.32)', background: 'rgba(255,255,255,.8)', color: '#3c4858', padding: '9px 12px', borderRadius: 9, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Discard</button>
                <button className="ros-lift" onClick={saveQueue} style={{ flex: 1.4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1px solid rgba(255,255,255,.4)', background: 'linear-gradient(135deg,#2fbf7f,#157a43)', color: '#fff', padding: '9px 12px', borderRadius: 9, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 20px rgba(31,157,87,.35)' }}><Ic d="M4 12l5 5L20 6" s={13} sw={2.4} />Confirm &amp; save</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ---- saved toast ---- */}
      {!!savedBatch && (
        <div style={{ position: 'fixed', right: 18, bottom: 20, zIndex: 4400, display: 'flex', alignItems: 'center', gap: 10, background: 'linear-gradient(158deg,rgba(255,255,255,.98),rgba(236,252,244,.96))', border: '1px solid rgba(31,157,87,.3)', borderRadius: 13, padding: '12px 15px', boxShadow: '0 20px 48px rgba(31,59,90,.24)', animation: 'rosSlideIn .24s cubic-bezier(.2,.75,.3,1) both' }}>
          <span style={rosBadge('rgba(31,157,87,.15)', '#157a43', 28, '50%')}><Ic d="M4 12l5 5L20 6" s={15} sw={3} /></span>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#16202e' }}>{savedBatch}</div>
            <div style={{ fontSize: 10.5, color: '#6c7a8c' }}>Logged in Shift swaps · Undo is still available</div>
          </div>
          <span className="ros-x" onClick={() => setSavedBatch(null)} style={{ cursor: 'pointer', color: '#9aa6b4', display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: 6, flexShrink: 0 }}><Ic d="M18 6L6 18M6 6l12 12" s={12} sw={2.4} /></span>
        </div>
      )}

      {/* ---- day popup (from the calendar) ---- */}
      {dayPop != null && (() => {
        const d = dayPop;
        const on = onDutyOf(d);
        const covC = on >= 4 ? '#157a43' : '#a92c42';
        const offOut = [];
        rows.forEach((x) => { const c = cellCode(x.empId, d); if (R.bucketOf(c) === 'O') offOut.push(String(x.name).split(' ')[0] + ' · ' + c); });
        return (
          <div onClick={() => setDayPop(null)} style={{ position: 'fixed', inset: 0, zIndex: 4200, display: 'grid', placeItems: 'center', background: 'rgba(31,59,90,.32)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>
            <div onClick={(e2) => e2.stopPropagation()} style={{ width: 'min(580px,92vw)', maxHeight: '86vh', overflowY: 'auto', background: 'linear-gradient(158deg,rgba(255,255,255,.98),rgba(238,246,254,.96))', border: '1px solid rgba(255,255,255,.95)', borderRadius: 18, boxShadow: '0 30px 80px rgba(31,59,90,.3)', animation: 'rosPopCard .28s cubic-bezier(.2,.85,.3,1.1) both' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '15px 18px', borderBottom: '1px solid rgba(125,145,180,.2)', background: 'linear-gradient(180deg,rgba(233,243,252,.7),rgba(255,255,255,.4))' }}>
                <span style={rosBadge('rgba(0,144,202,.12)', '#0072a3', 36, 11)}><Ic d="M3 5h18v16H3zM3 9h18M8 3v4M16 3v4" s={17} sw={1.9} /></span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#16202e' }}>{d} {R.MONTHS[month]} · {dowOf(d)}</div>
                  <div style={{ fontSize: 11, color: '#6c7a8c', marginTop: 1 }}>{dept} · {rosIsFri(year, month, d) ? 'weekly holiday' : 'working day'}</div>
                </div>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: covC, background: covC + '16', border: '1px solid ' + covC + '33', padding: '5px 11px', borderRadius: 14, whiteSpace: 'nowrap', flexShrink: 0 }}>{on} of {rows.length} on duty</span>
                <span className="ros-x" onClick={() => setDayPop(null)} style={{ cursor: 'pointer', color: '#9aa6b4', display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 8, flexShrink: 0 }}><Ic d="M18 6L6 18M6 6l12 12" s={14} sw={2.4} /></span>
              </div>
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 13 }}>
                {ROS_BUCKETS.map(([b, label]) => {
                  const col = ROS_TONE[b];
                  const people = [];
                  rows.forEach((x) => { const c = cellCode(x.empId, d); if (R.bucketOf(c) === b) people.push({ x, c }); });
                  return (
                    <div key={b}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 3, background: col, flexShrink: 0 }} />
                        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: .8, textTransform: 'uppercase', color: col }}>{label}</span>
                        <span style={{ fontSize: 10, color: '#7d8ea8' }}>{ROS_WINDOWS[b]}</span>
                        <span style={{ flex: 1 }} />
                        <span style={{ fontFamily: ROS_MONO, fontSize: 11, fontWeight: 800, color: people.length ? col : '#a92c42', background: people.length ? col + '16' : 'rgba(210,58,82,.1)', padding: '2px 8px', borderRadius: 9 }}>{people.length}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {people.map((p) => (
                          <div key={p.x.empId} style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(255,255,255,.85)', border: '1px solid rgba(125,145,180,.2)', borderRadius: 10, padding: '7px 10px', boxShadow: '0 2px 6px rgba(31,59,90,.05)' }}>
                            <MK.Av name={p.x.name} emp={p.x} empId={p.x.empIdShown} size={28} radius={rosAvRadius(28)} />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#16202e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.x.name}</div>
                              <div style={{ fontSize: 10, color: '#9aa6b4' }}>{p.x.desig || '—'}</div>
                            </div>
                            <span style={{ fontFamily: ROS_MONO, fontSize: 10, fontWeight: 700, color: '#fff', background: rosBColor(b), padding: '2px 7px', borderRadius: 6, flexShrink: 0 }}>{p.c}</span>
                            <span style={{ fontFamily: ROS_MONO, fontSize: 10, color: '#6c7a8c', whiteSpace: 'nowrap' }}>{(R.BY_CODE[p.c] || {}).label || ''}</span>
                          </div>
                        ))}
                        {people.length === 0 && (
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#a92c42', background: 'rgba(210,58,82,.09)', border: '1px solid rgba(210,58,82,.22)', borderRadius: 9, padding: '7px 10px' }}>Uncovered — no one rostered.</div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', borderTop: '1px solid rgba(125,145,180,.2)', paddingTop: 12 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: .8, textTransform: 'uppercase', color: '#7d8ea8' }}>Off / leave</span>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', flex: 1 }}>
                    {offOut.map((label, i) => (
                      <span key={i} style={{ fontSize: 10, fontWeight: 600, color: '#6c7a8c', background: 'rgba(255,255,255,.8)', border: '1px solid rgba(125,145,180,.25)', padding: '3px 9px', borderRadius: 10, whiteSpace: 'nowrap' }}>{label}</span>
                    ))}
                    {offOut.length === 0 && <span style={{ fontSize: 11, color: '#9aa6b4' }}>Everyone on duty</span>}
                  </div>
                  <button className="ros-goday" onClick={() => { setView('day'); setDay(d); setDayPop(null); }} style={{ border: '1px solid rgba(0,144,202,.3)', background: 'rgba(0,144,202,.09)', color: '#0072a3', padding: '7px 13px', borderRadius: 9, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Open day view ›</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ================= 3. PRINT =================
   The roster as it goes on the ward notice board and into the file: hospital letterhead,
   A4 landscape, one row per person with every day's code, the per-person totals, a
   per-day cover summary, the shift legend and the three signatures with the date each
   step happened. A sheet that is not approved carries a watermark saying so, so a draft
   on a wall can never pass for the published roster.

   The page is built as one self-contained HTML document (rosPrintHtml) and shown in an
   iframe: what is previewed is exactly what prints, and printing needs no pop-up window.
   Every print is logged on the server first (POST /api/rosters/print). */
const rosEsc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rosDate = (t) => (t ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
// The unit's name as the Departments record spells it today ("HomeCare" → its record name);
// the unit id stays the key for every lookup.
const rosDeptName = (d) => { try { return (window.staffDeptShow && window.staffDeptShow(d)) || d; } catch (e) { return d; } };

/* Who signs a printed sheet — the same rule as the on-screen Sign-off card (RosSignOff):
   before a step happens the box names who WILL sign (Setup), after it who did. A returned
   sheet is out of the chain, so whoever last sent it is not printed as its preparer. */
function rosSignNames(doc, signers) {
  const sg = signers || {}, h = (doc && doc.history) || [];
  const lastOf = (acts) => { for (let i = h.length - 1; i >= 0; i--) if (acts.indexOf(h[i].action) >= 0) return { e: h[i], i }; return null; };
  const st = rosStatusNorm(doc ? doc.status : null);
  const inChain = st === 'pending_manager' || st === 'pending_cns' || st === 'approved';
  const sent = inChain ? lastOf(['send_manager', 'send_cns']) : null;
  const fwd0 = lastOf(['forward']);
  const fwd = fwd0 && sent && fwd0.i > sent.i ? fwd0 : null;
  const ok = st === 'approved' ? lastOf(['approve']) : null;
  return {
    prepared: (sent && doc.preparedBy) || (sg.incharge && sg.incharge.name) || '',
    checked: (fwd && doc.checkedBy) || (sg.manager && sg.manager.name) || '',
    approved: (ok && doc.approvedBy) || (sg.cns && sg.cns.name) || '',
    sent: sent ? sent.e : null, fwd: fwd ? fwd.e : null, ok: ok ? ok.e : null,
  };
}

/* Two designs. The DEFAULT is the official black-and-white sheet: it is photocopied and pinned
   up, so it must read on any mono printer — black ink, ruled cells, plain codes, and only two
   greys, far apart: solid for a day off, light + hatched for leave. colourDesign = the
   letterhead band with coloured shift pills. */
function rosPrintHtml({ dept, deptName, year, month, doc, rows, grid, signers, signPeople, colourDesign, summary, cards, legend, pcaNewPage, printedBy }) {
  const official = !colourDesign;
  const days = R.daysIn(year, month);
  const ds = Array.from({ length: days }, (_, i) => i + 1);
  const dn = deptName || dept;
  const sn = rosSignNames(doc, signers);
  const { sent, fwd, ok } = sn;
  // signPeople = the print page's picks ({ name, line } per box); without them, Setup's names.
  const sp = signPeople || {};
  const who = (k, role) => (sp[k] ? [sp[k].name || '', sp[k].line || role] : [sn[k], role]);
  const signs = [
    ['Prepared by', ...who('prepared', 'In-charge, ' + dn), sent ? rosDate(sent.at) : ''],
    ['Checked by', ...who('checked', 'Nurse Manager'), fwd ? rosDate(fwd.at) : (sent && sent.action === 'send_cns' ? 'sent directly to CNS' : '')],
    ['Approved by', ...who('approved', 'Chief of Nursing Services'), ok ? rosDate(ok.at) : ''],
  ];
  const ocm = (doc && doc.oncall) || {}, alm = (doc && doc.altLeave) || {};
  // On call on top of a duty shift — the same rule the server keeps (a duty code only).
  const marked = (empId, d) => !!((ocm[empId] || {})[d]) && R.isDuty(((grid || {})[empId] || {})[d]);
  const anyMark = Object.keys(ocm).some((id) => Object.keys(ocm[id] || {}).some((d) => marked(id, d)));
  const pill = (code, mark) => {
    if (!code) return '';
    const dot = mark ? '<b class="ocm">•</b>' : '';
    if (official) return rosEsc(code) + dot;
    const b = R.bucketOf(code);
    const c = b === 'O' ? '#6b7a8d' : rosBColor(b);
    return '<span class="k" style="background:' + c + (b === 'O' ? '14' : '1c') + ';color:' + c + '">' + rosEsc(code) + dot + '</span>';
  };
  const fri = (d) => new Date(year, month, d).getDay() === 5;
  const head1 = ds.map((d) => '<th class="d' + (fri(d) ? ' fr' : '') + '">' + d + '</th>').join('');
  const head2 = ds.map((d) => '<th class="w' + (fri(d) ? ' fr' : '') + '">' + rosEsc(String(rosDow(year, month, d)).slice(0, 2)) + '</th>').join('');
  const sumRow = (label, fn, tail) => '<tr class="sum"><td colspan="3" class="sl">' + label + '</td>'
    + ds.map((d) => { const v = fn(d); return '<td class="c' + (fri(d) ? ' fr' : '') + '">' + (v || '') + '</td>'; }).join('') + '<td colspan="' + tail + '"></td></tr>';
  // One table per group — nurses, then PCAs — each with its own S/N and its own daily cover.
  const tableFor = (list, title, cls) => {
    // A G / M / E / N / O total column only when someone in this table has one — a unit that
    // works no General shift does not print an empty G column. Hrs always.
    // OC = the on-call days: OC codes plus marks on top of a shift.
    const totOf = (r) => { const t = R.totalsFor((grid && grid[r.empId]) || {}, days); t.OC = (t.OC || 0) + ds.filter((d) => marked(r.empId, d)).length; return t; };
    const tb = ['G', 'M', 'E', 'N', 'O', 'OC'].filter((b) => list.some((r) => totOf(r)[b] > 0));
    const body = list.map((r, i) => {
      const row = (grid && grid[r.empId]) || {};
      const t = totOf(r);
      // Official sheet: a day off is a solid grey cell, leave a light hatched one.
      const shade = (c) => (!official || !c ? '' : R.isOff(c) ? ' xo' : R.isLeave(c) ? ' xl' : '');
      const cells = ds.map((d) => '<td class="c' + (fri(d) ? ' fr' : '') + shade(row[d]) + '">' + pill(row[d] || '', marked(r.empId, d)) + '</td>').join('');
      return '<tr class="r"><td class="n">' + (i + 1) + '</td><td class="e">' + rosEsc(r.empIdShown || '') + '</td>'
        + '<td class="nm"><b>' + rosEsc(r.name) + '</b>' + (r.desig ? '<span> · ' + rosEsc(r.desig) + '</span>' : '') + '</td>' + cells
        + tb.map((b) => '<td class="t">' + (t[b] || '') + '</td>').join('')
        + '<td class="t h">' + (t.hours || '') + '</td></tr>';
    }).join('');
    const ids = list.map((r) => r.empId);
    const cov = {};
    ds.forEach((d) => { cov[d] = R.coverageFor(grid || {}, ids, d); });
    const leaveOn = (d) => ids.filter((id) => R.isLeave(((grid || {})[id] || {})[d])).length;
    // Only the cover rows that have something in them — a unit with no General duty or no
    // leave this month does not print an empty line for it.
    const some = (fn) => ds.some((d) => fn(d) > 0);
    const sums = !summary ? '' : [['General on duty', (d) => cov[d].G], ['Morning on duty', (d) => cov[d].M], ['Evening on duty', (d) => cov[d].E],
      ['Night on duty', (d) => cov[d].N], ['On call', (d) => ids.filter((id) => ((grid || {})[id] || {})[d] === 'OC' || marked(id, d)).length],
      ['On leave', leaveOn]].filter(([, fn]) => some(fn)).map(([l, fn]) => sumRow(l, fn, tb.length + 1)).join('');
    return '<div class="grp' + (cls ? ' ' + cls : '') + '">' + (title ? '<div class="gt"><span>' + rosEsc(title) + '</span></div>' : '')
      + '<table class="rt"><colgroup><col class="n"><col class="e"><col class="nm">' + ds.map(() => '<col class="d">').join('') + tb.map(() => '<col class="t">').join('') + '<col class="h"></colgroup>'
      + '<thead><tr><th rowspan="2">S/N</th><th rowspan="2">Emp ID</th><th rowspan="2" style="text-align:left;padding-left:4px">Name · Designation</th>' + head1
      + tb.map((b) => '<th rowspan="2">' + b + '</th>').join('') + '<th rowspan="2">Hrs</th></tr><tr>' + head2 + '</tr></thead>'
      + '<tbody>' + (body || '<tr><td colspan="' + (days + 4 + tb.length) + '" style="padding:14px;color:#7b8796">No staff on this roster.</td></tr>') + sums + '</tbody></table></div>';
  };
  const nurses = rows.filter((r) => !r.pca), pcas = rows.filter((r) => r.pca);
  const tables = pcas.length
    ? tableFor(nurses, 'Nursing staff · ' + nurses.length, 'gn') + tableFor(pcas, 'Patient care assistants · ' + pcas.length, 'gp' + (pcaNewPage ? ' np' : ''))
    : tableFor(rows, '', '');
  // The legend explains the codes on THIS sheet only — a unit that works M4 / E4 / N2 does
  // not need the hospital's whole catalogue printed under its roster.
  const used = new Set();
  rows.forEach((r) => { const row = (grid && grid[r.empId]) || {}; Object.keys(row).forEach((d) => { if (row[d]) used.add(String(row[d])); }); });
  const groups = R.BUCKETS.concat([{ id: 'O', label: 'Leave / off', color: '#8b98ab' }])
    .filter((b, i, a) => a.findIndex((x) => x.id === b.id) === i)
    .map((b) => ({ b, codes: R.SHIFTS.filter((s) => s.bucket === b.id && used.has(s.code)) }))
    .filter((g) => g.codes.length);
  const unknown = [...used].filter((c) => !R.BY_CODE[c]);
  // Official: a ruled schedule — Code · Shift · Time · Hours — split into side-by-side tables
  // of up to 6 rows so a long list does not push the signatures onto another page.
  const schedRows = [].concat(...groups.map((g) => g.codes.map((x) => g.b.id === 'O'
    ? [x.code, x.label, '—', '—', R.isOff(x.code) ? 'xo' : R.isLeave(x.code) ? 'xl' : '']
    : [x.code, g.b.label, x.label, x.hours ? String(x.hours) : '—', '']))).concat(unknown.map((c) => [c, '—', '—', '—', '']));
  const per = Math.ceil(schedRows.length / Math.max(1, Math.ceil(schedRows.length / 6)));
  const schedChunks = []; for (let i = 0; i < schedRows.length; i += per) schedChunks.push(schedRows.slice(i, i + per));
  const officialLegend = '<div class="lgx"><div class="lgh">Shift schedule</div><div class="schs">' + schedChunks.map((ch) => '<table class="sch"><thead><tr><th>Code</th><th>Shift</th><th>Time</th><th>Hrs</th></tr></thead><tbody>'
      + ch.map(([c, n, t, h, x]) => '<tr><td class="cd' + (x ? ' ' + x : '') + '">' + rosEsc(c) + '</td><td>' + rosEsc(n) + '</td><td>' + rosEsc(t) + '</td><td class="hr">' + rosEsc(h) + '</td></tr>').join('') + '</tbody></table>').join('') + '</div>'
    + '<div class="key"><span><i class="sw xo"></i>Day off</span><span><i class="sw xl"></i>Leave</span><span><i class="sw"></i>On duty</span>' + (anyMark ? '<span><b class="ocm">•</b> after a code = on call as well</span>' : '') + '</div></div>';
  const legendHtml = !legend ? '' : (!used.size ? '<div class="lgx"><div class="lgh">' + (official ? 'Shift schedule' : 'Shift legend') + '</div><div class="lgn">No shifts entered yet.</div></div>'
    : official ? officialLegend
    : '<div class="lgx"><div class="lgh">Shift legend</div><div class="lg">' + groups.map((g) => '<div class="lgb" style="--lc:' + (g.b.id === 'O' ? '#6b7a8d14' : rosBColor(g.b.id) + '1c') + '"><b style="color:' + rosBColor(g.b.id) + '">' + rosEsc(g.b.label) + '</b>'
        + g.codes.map((s) => '<span><i>' + rosEsc(s.code) + '</i> ' + rosEsc(s.label) + '</span>').join('') + '</div>').join('')
      + (anyMark ? '<div class="lgb"><b>On call</b><span><i>•</i> after a code = on call as well</span></div>' : '')
      + (unknown.length ? '<div class="lgb"><b>Other</b>' + unknown.map((c) => '<span><i>' + rosEsc(c) + '</i></span>').join('') + '</div>' : '')
      + '</div></div>');
  const at = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const d2 = (d) => String(d).padStart(2, '0') + ' ' + R.MONTHS[month].slice(0, 3) + ' ' + year;
  const period = d2(1) + ' – ' + d2(days);
  /* The month at a glance, for the cards under the header band — every figure read from the
     same rows + grid the table prints, so a card can never disagree with the sheet. */
  const g0 = grid || {};
  const ids = rows.map((r) => r.empId);
  const mix = { G: 0, M: 0, E: 0, N: 0 }, offBy = {}, perHrs = [];
  rows.forEach((r) => {
    const row = g0[r.empId] || {};
    const tt = R.totalsFor(row, days);
    perHrs.push(tt.hours || 0);
    ['G', 'M', 'E', 'N'].forEach((b) => { mix[b] += tt[b] || 0; });
    ds.forEach((d) => { const c = row[d]; if (c && (R.isLeave(c) || R.isOff(c))) offBy[c] = (offBy[c] || 0) + 1; });
  });
  const duty = mix.G + mix.M + mix.E + mix.N;
  const onCallN = rows.reduce((a, r) => a + ds.filter((d) => (g0[r.empId] || {})[d] === 'OC' || marked(r.empId, d)).length, 0);
  const hrs = perHrs.reduce((a, b) => a + b, 0);
  const onDuty = ds.map((d) => { const c = R.coverageFor(g0, ids, d); return c.G + c.M + c.E + c.N; });
  const lo = onDuty.length ? Math.min.apply(null, onDuty) : 0, hi = onDuty.length ? Math.max.apply(null, onDuty) : 0;
  const empty = onDuty.filter((n) => n === 0).length;
  const desigs = {};
  rows.forEach((r) => { const k = r.desig || (r.pca ? 'PCA' : 'Staff'); desigs[k] = (desigs[k] || 0) + 1; });
  const desigTxt = Object.keys(desigs).sort((a, b) => desigs[b] - desigs[a] || a.localeCompare(b)).map((k) => desigs[k] + ' ' + k).join(' · ');
  const offTxt = Object.keys(offBy).sort((a, b) => offBy[b] - offBy[a] || a.localeCompare(b)).map((k) => k + ' ' + offBy[k]).join(' · ');
  const dayLbl = (d) => d + ' ' + R.MONTHS[month].slice(0, 3);
  const tiles = [
    ['Staff', String(rows.length), (pcas.length ? nurses.length + ' nursing · ' + pcas.length + ' PCA · ' : '') + (desigTxt || 'no one yet'), 'b'],
    ['Shift mix', String(duty), (duty ? ['G', 'M', 'E', 'N'].filter((b) => mix[b]).map((b) => b + ' ' + mix[b]).join(' · ') : 'no duty shifts yet') + (onCallN ? ' · on call ' + onCallN : ''), 't'],
    ['Daily cover', duty ? (lo === hi ? String(lo) : lo + '–' + hi) : '0',
      !duty ? 'on duty per day' : empty ? '⚠ ' + empty + ' day' + (empty === 1 ? '' : 's') + ' with no one on duty' : 'on duty per day · lowest ' + dayLbl(onDuty.indexOf(lo) + 1), empty ? 'a' : 'g'],
    ['Off & leave', String(Object.keys(offBy).reduce((a, k) => a + offBy[k], 0)), offTxt || 'none this month', 'v'],
    ['Hours', hrs + ' h', perHrs.length ? (Math.min.apply(null, perHrs) === Math.max.apply(null, perHrs) ? Math.min.apply(null, perHrs) + ' h each' : Math.min.apply(null, perHrs) + '–' + Math.max.apply(null, perHrs) + ' h per person') : '', 'sl'],
  ];
  /* Alternative leave: which worked day each AL stands in for — so a reader sees what it was for. */
  const alRows = [];
  rows.forEach((r) => { const row = g0[r.empId] || {}; ds.forEach((d) => { if (row[d] !== 'AL') return; const a = (alm[r.empId] || {})[d] || {};
    alRows.push([r.name, dayLbl(d) + ' ' + year, a.for ? rosDate(a.for) : '—', a.note || '']); }); });
  const alHtml = !alRows.length ? '' : '<div class="alx"><div class="lgh">Alternative leave</div><table class="alt"><colgroup><col style="width:34%"><col style="width:14%"><col style="width:18%"><col></colgroup>'
    + '<thead><tr><th>Name</th><th>AL on</th><th>In lieu of (date worked)</th><th>Reason</th></tr></thead><tbody>'
    + alRows.map(([n, on, f, why]) => '<tr><td>' + rosEsc(n) + '</td><td>' + rosEsc(on) + '</td><td><b>' + rosEsc(f) + '</b></td><td>' + rosEsc(why) + '</td></tr>').join('') + '</tbody></table></div>';
  const NAVY = '#0d3a5c';
  const css = '@page{size:A4 landscape;margin:7mm 8mm 9mm;@bottom-right{content:"Page " counter(page) " of " counter(pages);font:7pt "Segoe UI",Arial,sans-serif;color:#7b8796}@bottom-left{content:"Duty Roster · ' + String(dn).replace(/["\\]/g, '') + ' · ' + R.MONTHS[month] + ' ' + year + '";font:7pt "Segoe UI",Arial,sans-serif;color:#7b8796}}'
    + '*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    + 'body{font:8pt/1.3 "Segoe UI",Arial,sans-serif;color:#16202e;margin:0;padding:12px;background:#fff}@media print{body{padding:0}}'
    // header band: logo chip | DUTY ROSTER + month + period | department
    + '.band{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:14px;padding:5px 14px;border-radius:10px;color:#fff;'
    + 'background:linear-gradient(118deg,#0d3a5c 0%,#0b5f8f 48%,#1795c6 78%,#3ab5a7 100%);position:relative;overflow:hidden}'
    + '.band:after{content:"";position:absolute;right:-40px;top:-60px;width:220px;height:220px;border-radius:50%;background:rgba(255,255,255,.07)}'
    + '.band .lg0{display:inline-flex;align-items:center;background:#fff;border-radius:8px;padding:4px 9px;box-shadow:0 2px 6px rgba(0,0,0,.15)}.band img{height:25px;display:block}'
    + '.band .mid{text-align:center;position:relative;z-index:1}.band h1{margin:0;font-size:14pt;font-weight:800;letter-spacing:6px;line-height:1.15}'
    + '.band .mo{display:inline-block;margin-top:1px;font-size:8.8pt;font-weight:700;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);border-radius:12px;padding:0 12px}'
    + '.band .pd{font-size:7pt;opacity:.85;letter-spacing:.5px;margin-top:1px}'
    + '.band .rtx{text-align:right;position:relative;z-index:1}.band .kind{font-size:6.6pt;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;opacity:.8}.band .dp{font-size:15pt;font-weight:800;line-height:1.15}'
    // summary tiles
    + '.tiles{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin:6px 0 8px;position:relative;z-index:0}'
    + '.tile{border-radius:8px;padding:2px 10px 3px;border:1px solid #e3e9f0;border-left:4px solid var(--c);background:linear-gradient(90deg,var(--bg),#fff 85%)}'
    + '.tile span{display:block;font-size:6pt;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;color:#6b7a8d}.tile b{font-size:11pt;font-weight:800;color:var(--c);line-height:1.15}.tile i{font-style:normal;font-size:6.6pt;color:#7b8796;margin-left:6px}'
    + '.tile.b{--c:#0072a3;--bg:#e8f4fb}.tile.t{--c:#0f8a7e;--bg:#e6f6f3}.tile.g{--c:#1f6f43;--bg:#eaf6ee}.tile.v{--c:#5b45c4;--bg:#efecfb}.tile.a{--c:#b5670a;--bg:#fdf3e4}.tile.sl{--c:#334e68;--bg:#eef2f6}'
    // section tags
    + '.gt{display:flex;align-items:center;gap:8px;margin:5px 0 3px}.gt span{display:inline-block;font-size:7pt;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#fff;background:linear-gradient(90deg,#0072a3,#1795c6);border-radius:10px;padding:2px 11px}'
    + '.gt:after{content:"";flex:1;height:1px;background:linear-gradient(90deg,#c9d9e8,transparent)}.gp .gt span{background:linear-gradient(90deg,#5b45c4,#7e6be0)}.grp.np{page-break-before:always}'
    // the table
    + 'table{border-collapse:separate;border-spacing:0;width:100%;table-layout:fixed;border:1px solid #c9d6e3;border-radius:8px;overflow:hidden}thead{display:table-header-group}tr{page-break-inside:avoid}'
    + 'th{background:' + NAVY + ';color:#fff;font-weight:700;padding:3px 0;font-size:7pt;border-right:1px solid rgba(255,255,255,.1)}th.w{font-weight:500;font-size:6.2pt;background:#1d5c87;padding:1px 0 2px}th.fr{background:#b5670a}th.w.fr{background:#cf7d17}'
    + '.gp th{background:#3b2f7a}.gp th.w{background:#4d3f94}.gp th.fr{background:#b5670a}.gp th.w.fr{background:#cf7d17}'
    + 'td{border-right:1px solid #e6ecf2;border-bottom:1px solid #e6ecf2;text-align:center;padding:0;height:13px}tr.r:nth-child(even) td{background:#f6f9fc}'
    + 'td.c{padding:1px}td.fr{background:#fdf5ea!important}'
    + '.k{display:inline-block;min-width:88%;border-radius:4px;padding:0;font-size:6.7pt;font-weight:800;letter-spacing:.1px}.k.ko{color:#6b7a8d}'
    + 'td.n{color:#7b8796;font-size:6.8pt}td.e{font-size:6.6pt;color:#5b6878}td.nm{text-align:left;padding:1px 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}td.nm b{font-size:7.5pt;color:#0d1b2e}td.nm span{font-size:6.2pt;color:#7b8796}'
    + 'td.t{font-size:7pt;background:#f1f5f9!important;color:#3c4858}td.h{font-weight:800;color:#0d1b2e;background:#e4eef7!important}col.n{width:6mm}col.e{width:12mm}col.nm{width:52mm}col.d{width:auto}col.t{width:6mm}col.h{width:8mm}'
    + 'tr.sum td{background:#eaf3fa!important;font-size:6.6pt;font-weight:700;color:' + NAVY + ';height:12px}tr.sum:first-of-type td{border-top:1.5px solid #9cc3de}tr.sum td.sl{text-align:right;padding-right:6px;font-weight:600;color:#3c5a74}.gp tr.sum td{background:#f0edfa!important;color:#3b2f7a}'
    // legend, notes, signatures
    + '.lnr{display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-top:7px;align-items:stretch}.lnr .notes{margin-top:0}.lgx{border:1px solid #d9e4ee;border-radius:8px;padding:4px 9px 5px;page-break-inside:avoid;background:#fbfdff}.lgh{font-size:6.4pt;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#0072a3;margin-bottom:2px}.lgn{font-size:7pt;color:#7b8796}'
    + '.lg{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:2px 16px;font-size:6.6pt;color:#3c4858}.lgb b{display:block;font-size:6.8pt;margin-bottom:1px;text-transform:uppercase;letter-spacing:.6px}.lgb span{display:inline-block;margin-right:8px;white-space:nowrap}'
    + '.lgb i{font-style:normal;font-weight:800;color:#0d1b2e;display:inline-block;min-width:18px;text-align:center;border-radius:4px;padding:0 3px;background:var(--lc,#eef2f6)}'
    + '.foot{page-break-inside:avoid;break-inside:avoid}.ocm{font-weight:900;margin-left:1px}'
    + '.alx{margin-top:7px;border:1px solid #d9e4ee;border-radius:8px;padding:4px 9px 5px;background:#fbfdff;break-inside:avoid;page-break-inside:avoid}.alt{width:100%;border-collapse:collapse;font-size:7pt}.alt th{background:#0d3a5c;color:#fff;text-align:left;padding:2px 6px;font-weight:700}.alt td{border-bottom:1px solid #e6ecf2;padding:2px 6px;color:#16202e}'
    + '.notes{margin-top:6px;border-radius:8px;background:#fffaf2;border:1px solid #f1dfc2;padding:4px 9px}.nb{font-size:7pt;color:#5a4a33}.nb b{color:#b5670a}.rm{margin-top:3px;font-size:7.4pt;color:#3c4858;border-bottom:1px dotted #c9b48f;height:14px}'
    + '.signs{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:8px;font-size:8pt;page-break-inside:avoid}'
    + '.signs>div{border:1px solid #e3e9f0;border-top:3px solid var(--sc);border-radius:9px;padding:0 11px 6px;background:linear-gradient(180deg,var(--sb),#fff 45%)}.signs>div:nth-child(1){--sc:#0072a3;--sb:#f1f8fd}.signs>div:nth-child(2){--sc:#5b45c4;--sb:#f5f3fd}.signs>div:nth-child(3){--sc:#1f6f43;--sb:#f0f8f3}'
    + '.signs .sp{height:28px}.signs .ln{border-top:1px solid #16202e;padding-top:4px}.signs .dt{margin-top:6px;font-size:7.4pt;color:#3c4858}'
    + '.signs span{display:block;font-size:6.4pt;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--sc)}.signs b{display:block;font-size:9pt;color:#0d1b2e}.signs em{display:block;font-style:normal;color:#5b6878;font-size:7pt}'
    + '.end{margin-top:6px;padding-top:3px;border-top:1px solid #e3e9f0;display:flex;justify-content:space-between;font-size:6.8pt;color:#7b8796}';
  // The official sheet: black ink, 0.75pt rules, two far-apart greys. Every background is kept in
  // print (print-color-adjust), or a browser would drop the off-day shading.
  const HATCH = 'repeating-linear-gradient(135deg,transparent 0,transparent 2.5px,rgba(0,0,0,.28) 2.5px,rgba(0,0,0,.28) 3.3px),#e0e0e0';
  const officialCss = '@page{size:A4 landscape;margin:8mm;@bottom-right{content:"Page " counter(page) " of " counter(pages);font:7pt Arial,sans-serif;color:#000}@bottom-left{content:"Duty Roster · ' + String(dn).replace(/["\\]/g, '') + ' · ' + R.MONTHS[month] + ' ' + year + '";font:7pt Arial,sans-serif;color:#000}}'
    + '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    + 'body{font:8pt/1.3 Arial,"Segoe UI",sans-serif;color:#000;margin:0;padding:12px;background:#fff}@media print{body{padding:0}}'
    // letterhead
    + '.lh{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;padding-bottom:3px}.lh img{height:32px;display:block}'
    + '.lhm{text-align:center}.lhm .org{font-size:11.5pt;font-weight:700;letter-spacing:.4px}.lhm .dv{font-size:7.5pt;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#333}.lhm h1{margin:2px 0 0;font-size:15pt;font-weight:800;letter-spacing:5px}'
    // Grids: one border per cell side (right + bottom) inside a framed table, never
    // border-collapse — html2canvas (the PDF) draws collapsed borders as two lines with a gap.
    + 'table.rt,.meta,.sch,.alt{border-collapse:separate;border-spacing:0;border-top:.75pt solid #000;border-left:.75pt solid #000}'
    + '.rt th,.rt td,.meta th,.meta td,.sch th,.sch td,.alt th,.alt td{border:0;border-right:.75pt solid #000;border-bottom:.75pt solid #000}'
    + '.ocm{font-weight:900;margin-left:1px}.alx{margin-top:7px;border:1.25pt solid #000;padding:4px 8px 5px;break-inside:avoid;page-break-inside:avoid}'
    + '.alt{width:100%;font-size:7.5pt}.alt th{background:#d0d0d0;text-align:left;padding:1px 6px;font-weight:700}.alt td{padding:1px 6px}'
    + '.lhr{justify-self:end}.meta{font-size:7.5pt}.meta th{text-align:left;font-weight:700;padding:1px 6px;background:#e0e0e0}.meta td{padding:1px 8px;font-weight:700;min-width:40mm}'
    + '.rule{border-top:2pt solid #000;border-bottom:.6pt solid #000;height:3.5px;margin:1px 0 6px}'
    // summary strip
    + '.tiles{display:grid;grid-template-columns:repeat(5,1fr);border:1.25pt solid #000;margin:0 0 6px}.tile{padding:2px 7px 3px;border-left:.75pt solid #000}.tile:first-child{border-left:0}'
    + '.tile span{display:block;font-size:6.6pt;font-weight:800;letter-spacing:1px;text-transform:uppercase}.tile b{font-size:11pt;font-weight:800;margin-right:5px}.tile i{font-style:normal;font-size:7pt;color:#333}'
    // the roster
    + '.gt{margin:6px 0 3px}.gt span{font-size:8pt;font-weight:800;letter-spacing:1px;text-transform:uppercase;border-bottom:1.25pt solid #000;padding-bottom:1px}.grp.np{page-break-before:always}'
    + 'table.rt{width:100%;table-layout:fixed;outline:.6pt solid #000}thead{display:table-header-group}tr{page-break-inside:avoid;break-inside:avoid}'
    + '.rt th{background:#d0d0d0;color:#000;font-weight:700;font-size:7pt;padding:2px 0}.rt th.w{font-weight:700;font-size:6.6pt;background:#e8e8e8;padding:1px 0}'
    + '.rt th.fr{background:#000;color:#fff;font-weight:800}'
    + '.rt td{text-align:center;padding:0;height:14px;color:#000}.rt td.c{font-size:7.5pt;font-weight:700;letter-spacing:-.1px}'
    + '.rt td.xo{background:#b3b3b3;font-weight:800}.rt td.xl{background:' + HATCH + ';font-style:italic;font-weight:800}'
    + 'td.n,td.e{font-size:7pt}td.nm{text-align:left;padding:1px 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}td.nm b{font-size:8pt}td.nm span{font-size:7pt;color:#333}'
    + 'td.t{font-size:7.5pt;font-weight:600}td.h{font-weight:800}'
    + 'col.n{width:6mm}col.e{width:12mm}col.nm{width:46mm}col.d{width:auto}col.t{width:6mm}col.h{width:8mm}'
    + 'tr.sum td{font-size:7pt;font-weight:700;height:12px}tr.sum:first-of-type td{border-top:.75pt solid #000}tr.sum td.sl{text-align:right;padding-right:6px}'
    // schedule, notes, signatures
    + '.lnr{display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-top:7px;align-items:stretch}.lgx{border:1.25pt solid #000;padding:4px 8px 5px;break-inside:avoid;page-break-inside:avoid}'
    + '.lgh{font-size:7.5pt;font-weight:800;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px}.lgn{font-size:7.5pt}'
    + '.schs{display:flex;gap:8px;align-items:flex-start}.sch{font-size:7pt;flex:1 1 0;min-width:0}.sch th{background:#d0d0d0;padding:1px 4px;text-align:left;font-weight:700}'
    + '.sch td{padding:1px 4px}.sch td.cd{font-weight:800;text-align:center;width:9mm}.sch td.hr{text-align:center;width:8mm}.sch td.xo{background:#b3b3b3}.sch td.xl{background:' + HATCH + ';font-style:italic}'
    + '.key{margin-top:4px;font-size:7pt;font-weight:700;display:flex;gap:16px;align-items:center}.sw{display:inline-block;width:15px;height:9px;border:.75pt solid #000;vertical-align:-1px;margin-right:4px;background:#fff}.sw.xo{background:#b3b3b3}.sw.xl{background:' + HATCH + '}'
    + '.notes{border:1.25pt solid #000;padding:4px 8px}.nb{font-size:7.5pt}.rm{margin-top:4px;font-size:7.5pt;border-bottom:.75pt dotted #000;height:15px}'
    + '.foot{page-break-inside:avoid;break-inside:avoid}'
    + '.signs{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:10px;page-break-inside:avoid;break-inside:avoid}.signs>div{padding:0 2px}.signs .sp{height:30px}'
    + '.signs .ln{border-top:1pt solid #000;padding-top:3px}.signs span{display:block;font-size:7pt;font-weight:800;letter-spacing:1px;text-transform:uppercase}.signs b{display:block;font-size:9pt}.signs em{display:block;font-style:normal;font-size:7.5pt;color:#333}.signs .dt{margin-top:5px;font-size:7.5pt}'
    + '.end{margin-top:6px;padding-top:3px;border-top:.75pt solid #000;display:flex;justify-content:space-between;font-size:7pt}';
  const stLabel = (ROS_STATUS[rosStatusNorm(doc ? doc.status : null)] || {}).label || 'Draft';
  const head = official
    ? '<header class="lh"><div><img src="' + rosEsc(location.origin + '/unico/logo.svg') + '" alt="UNICO Hospitals"></div>'
      + '<div class="lhm"><div class="org">UNICO Hospitals PLC</div><div class="dv">Nursing Services</div><h1>DUTY ROSTER</h1></div>'
      + '<div class="lhr"><table class="meta"><tr><th>Department</th><td>' + rosEsc(dn) + '</td></tr><tr><th>Month</th><td>' + rosEsc(R.MONTHS[month] + ' ' + year) + '</td></tr>'
      + '<tr><th>Period</th><td>' + rosEsc(period) + '</td></tr><tr><th>Status</th><td>' + rosEsc(stLabel + (doc && doc.revision ? ' · Rev ' + doc.revision : '')) + '</td></tr></table></div></header><div class="rule"></div>'
    : '<header class="band"><div><span class="lg0"><img src="' + rosEsc(location.origin + '/unico/logo.svg') + '" alt="UNICO Hospitals"></span></div>'
      + '<div class="mid"><h1>DUTY ROSTER</h1><div class="mo">' + rosEsc(R.MONTHS[month] + ' ' + year) + '</div><div class="pd">' + rosEsc(period) + '</div></div>'
      + '<div class="rtx"><div class="kind">Nursing Services</div><div class="dp">' + rosEsc(dn) + '</div></div></header>';
  const html = head
    + (cards !== false ? '<div class="tiles">' + tiles.map(([l, v, sub, k]) => '<div class="tile ' + k + '"><span>' + rosEsc(l) + '</span><b>' + rosEsc(v) + '</b><i>' + rosEsc(sub) + '</i></div>').join('') + '</div>' : '<div style="height:7px"></div>')
    + tables + alHtml
    // Legend and notes side by side, and kept on the same page as the signatures.
    + '<div class="foot"><div class="lnr">' + (legendHtml || '<div></div>') + '<div class="notes"><div class="nb"><b>NB:</b> No change to this roster without permission from the authorised person. Swaps must be approved by the in-charge and recorded.</div>'
    + '<div class="rm">Remarks:</div><div class="rm"></div></div></div>'
    + '<div class="signs">' + signs.map(([l, n, role, when]) => '<div><div class="sp"></div><div class="ln"><span>' + rosEsc(l) + '</span><b>' + rosEsc(n || ' ') + '</b><em>' + rosEsc(role) + '</em>'
      + '<div class="dt">Date: ' + (when ? '<b style="display:inline;font-size:7.4pt">' + rosEsc(when) + '</b>' : '______________________') + '</div></div></div>').join('') + '</div>'
    + '<div class="end"><span>Printed by ' + rosEsc(printedBy || '—') + ' on ' + rosEsc(at) + ' from UNICO.</span><span>' + (ok ? 'Approved on ' + rosEsc(rosDate(ok.at)) + '.' : '') + '</span></div>'
    + '</div>';
  return '<!doctype html><html><head><meta charset="utf-8"><title>' + rosEsc('Duty Roster — ' + dn + ' — ' + R.MONTHS[month] + ' ' + year) + '</title><style>' + (official ? officialCss : css) + '</style></head><body>' + html + '</body></html>';
}

// Per browser: a 'unico_*' key is synced to the server and shared by everyone, so one person
// ticking "Summary cards" turned them on for the whole hospital. The cards start hidden; the
// other choices come over once from the old shared key.
const ROS_PRINT_OPT_KEY = 'unicoRosterPrintOpts.v2';
const ROS_PRINT_OPT_OLD = 'unico_roster_print_opts_v1';
// The sheet's added staff: its own plus those carried from earlier months (month GET).
const rosSheetGuests = (r) => ({ ...((r && r.guestsCarried) || {}), ...((r && r.roster && r.roster.guests) || {}) });
/* One sign-off box on the print page: a search over the staff register. Only a real person
   can be picked — typed text that matches no one falls back to the current pick on blur.
   The list is portalled: the toolbar is a .card, whose backdrop-filter would clip it. */
function RosSignPick({ label, person, staff, onPick }) {
  const [q, setQ] = useState(null);   // null = not searching
  const box = useRef(null);
  const n = String(q || '').trim().toLowerCase();
  const hits = n.length < 2 ? [] : (staff || []).filter((e) => e && e.is_active !== false && !e.former
    && [e.name, e.emp_id, e.designation].join(' ').toLowerCase().indexOf(n) >= 0).slice(0, 8);
  const r = q != null && n.length >= 2 && box.current ? box.current.getBoundingClientRect() : null;
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '1 1 210px', minWidth: 190 }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: '#7d8ea8' }}>{label}</span>
      <input ref={box} value={q == null ? (person.name || '') : q} placeholder={person.name || 'Search staff…'}
        onFocus={() => setQ('')} onBlur={() => setQ(null)} onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') e.currentTarget.blur(); if (e.key === 'Enter' && hits[0]) { onPick(hits[0]); e.currentTarget.blur(); } }}
        style={{ padding: '6px 9px', borderRadius: 8, border: '1px solid rgba(125,145,180,.4)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, color: '#16202e' }} />
      <span style={{ fontSize: 10.5, color: '#6c7a8c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.line || '—'}</span>
      {r && rosPortal(
        <div style={{ position: 'fixed', left: r.left, top: r.bottom + 4, width: Math.max(r.width, 280), maxHeight: 300, overflow: 'auto', zIndex: 9500, background: '#fff', border: '1px solid rgba(125,145,180,.3)', borderRadius: 10, boxShadow: '0 14px 36px rgba(16,28,46,.2)' }}>
          {!hits.length && <div style={{ padding: 10, fontSize: 11.5, color: '#8a97a8' }}>No one matches.</div>}
          {hits.map((e) => (
            <div key={e.id} onMouseDown={(ev) => { ev.preventDefault(); onPick(e); setQ(null); if (box.current) box.current.blur(); }}
              style={{ padding: '7px 11px', cursor: 'pointer', borderBottom: '1px solid rgba(125,145,180,.12)' }}
              onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(0,144,202,.07)'; }} onMouseLeave={(ev) => { ev.currentTarget.style.background = ''; }}>
              <b style={{ display: 'block', fontSize: 12.5, color: '#16202e' }}>{e.name}</b>
              <span style={{ fontSize: 10.5, color: '#6c7a8c' }}>{rosSignLine(e)}{e.emp_id ? ' · ' + e.emp_id : ''}</span>
            </div>
          ))}
        </div>)}
    </label>
  );
}
// The line under a signer's name: their own designation and department, from the register.
const rosSignLine = (e) => [window.staffCanonDesig ? window.staffCanonDesig(e.designation) : e.designation, e.current_department ? rosDeptName(e.current_department) : '']
  .filter(Boolean).join(', ');
function RosterPrint({ staffStore, dept, year, month, setRoute }) {
  const [doc, setDoc] = useState(null);
  // A month not prepared yet still lists the staff carried from earlier months (and not the ones moved away).
  const [side, setSide] = useState(null);
  const [signers, setSigners] = useState({});
  const [can, setCan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [opt, setOpt] = useState(() => {
    const d = { colourDesign: false, summary: true, cards: false, legend: true, pcaNewPage: false };
    try {
      const now = localStorage.getItem(ROS_PRINT_OPT_KEY);
      if (now) return { ...d, ...(JSON.parse(now) || {}) };
      const { cards, ...old } = JSON.parse(localStorage.getItem(ROS_PRINT_OPT_OLD) || '{}') || {};   // eslint-disable-line no-unused-vars
      return { ...d, ...old };
    } catch (e) { return d; }
  });
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const frame = useRef(null);
  useEffect(() => {
    rosApi.get('/api/rosters/' + encodeURIComponent(dept) + '/' + year + '/' + month)
      .then((r) => {
        setDoc(r && r.ok && r.roster ? { ...r.roster, movedOut: r.movedOut || [], guests: rosSheetGuests(r) } : null);
        setSide(r && r.ok ? { movedOut: r.movedOut || [], guests: rosSheetGuests(r) } : null);
        setSigners((r && r.ok && r.signers) || {});
        setCan((r && r.ok && ((r.roster && r.roster.can) || r.can)) || null);
        setLoading(false);
      }).catch(() => setLoading(false));
  }, [dept, year, month]);
  useEffect(() => { try { localStorage.setItem(ROS_PRINT_OPT_KEY, JSON.stringify(opt)); } catch (e) { /* private window */ } }, [opt]);

  const view = useMemo(() => rosRowsFrom(doc || side, staffStore.staff, dept, undefined, signers.incharge && signers.incharge.name), [doc, side, staffStore.staff, dept, signers]);
  const me = (window.__UNICO_USER__ && (window.__UNICO_USER__.name || window.__UNICO_USER__.username)) || '';
  const deptName = rosDeptName(dept);
  /* Sign-off: Setup's names (same rule as the screen) until someone is picked from the register
     here. Picks are for this printout only — nothing is saved. */
  const [picks, setPicks] = useState({});
  const signPeople = useMemo(() => {
    const def = rosSignNames(doc, signers);
    const people = staffStore.staff || [];
    const byName = (nm) => { const k = String(nm || '').trim().toLowerCase(); return k ? people.find((e) => e && !e.former && e.is_active !== false && String(e.name || '').trim().toLowerCase() === k) : null; };
    const role = { prepared: 'In-charge, ' + deptName, checked: 'Nurse Manager', approved: 'Chief of Nursing Services' };
    const out = {};
    ['prepared', 'checked', 'approved'].forEach((k) => {
      const e = picks[k] || byName(def[k]);
      out[k] = e ? { name: e.name || '', line: rosSignLine(e) || role[k] } : { name: def[k], line: role[k] };
    });
    return out;
  }, [doc, signers, picks, staffStore.staff, deptName]);
  const html = useMemo(() => rosPrintHtml({ dept, deptName, year, month, doc, rows: view.rows, grid: view.grid, signers, signPeople, ...opt, printedBy: me }),
    [dept, deptName, year, month, doc, view, signers, signPeople, opt, me]);
  // The in-charge who prepares the sheet may print it, as may anyone holding roster Print.
  const meU = String((window.__UNICO_USER__ && window.__UNICO_USER__.username) || '').toLowerCase();
  const isSigner = !!meU && ['incharge', 'manager', 'cns'].some((k) => signers[k] && String(signers[k].username || '').toLowerCase() === meU);
  const mayPrint = rosCan('print') || isSigner || !!(can && (can.edit || can.send || can.forward || can.approve));

  const print = () => {
    const w = frame.current && frame.current.contentWindow;
    if (!w) return;
    setBusy(true);
    rosApi.post('/api/rosters/print', { kind: 'sheet', target: dept, detail: R.MONTHS[month] + ' ' + year + (doc ? ' · rev ' + (doc.revision || 1) + ' · ' + rosStatusNorm(doc.status) : ' · not prepared') })
      .catch(() => null)
      .then(() => { setBusy(false); try { w.focus(); w.print(); } catch (e) { rosToast('Could not open the print dialog.', 'error'); } });
  };

  /* A PDF file, straight to Downloads — no print dialog. The preview's own document is drawn at
     A4-landscape width (so the file looks the same from any screen) and cut into pages at row
     boundaries, so no person's row is ever split across two pages and the signatures stay whole. */
  const downloadPdf = async () => {
    const f = frame.current; const d0 = f && f.contentDocument;
    if (!d0 || !d0.body) return;
    setPdfBusy(true);
    const body = d0.body; const keep = { w: body.style.width, p: body.style.padding };
    try {
      if (window.unicoLoadPdfLibs && !(window.jspdf && window.html2canvas)) await window.unicoLoadPdfLibs();
      const H = window.html2canvas, J = window.jspdf && window.jspdf.jsPDF;
      if (!H || !J) throw new Error('The PDF tools did not load.');
      await rosApi.post('/api/rosters/print', { kind: 'pdf', target: dept, detail: R.MONTHS[month] + ' ' + year }).catch(() => null);
      const W = 1123;                                   // 297 mm at 96 dpi
      body.style.width = W + 'px'; body.style.padding = '0';
      await new Promise((r) => setTimeout(r, 80));
      const scale = 2;
      const top0 = body.getBoundingClientRect().top;
      const marks = Array.prototype.map.call(d0.querySelectorAll('tr, .gt, .lgx, .foot'), (el) => (el.getBoundingClientRect().bottom - top0) * scale);
      const last = d0.querySelector('.foot') || body.lastElementChild;
      const contentH = Math.ceil((last ? last.getBoundingClientRect().bottom : body.scrollHeight) - top0 + 6);
      const canvas = await H(body, { scale, backgroundColor: '#ffffff', useCORS: true, windowWidth: W, width: W, height: contentH });
      // html2canvas runs in this window and leaves the preview iframe's <img>s (the letterhead
      // logo) blank, so paint each picture onto the snapshot at its place on the page.
      const left0 = body.getBoundingClientRect().left, cg = canvas.getContext('2d');
      cg.setTransform(1, 0, 0, 1, 0, 0);   // html2canvas leaves its own scale() on the context
      for (const img of Array.prototype.slice.call(d0.querySelectorAll('img'))) {
        try {
          const r = img.getBoundingClientRect(); if (!r.width || !r.height) continue;
          const pic = new Image(); pic.src = img.src; await pic.decode();
          cg.drawImage(pic, (r.left - left0) * scale, (r.top - top0) * scale, r.width * scale, r.height * scale);
        } catch (e) { /* the PDF still downloads, just without that picture */ }
      }
      const pdf = new J({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const M = 8, pw = 297 - 2 * M, ph = 210 - 2 * M;
      const pxPerMm = canvas.width / pw, pageH = ph * pxPerMm;
      let y = 0, first = true;
      const endY = Math.min(canvas.height, contentH * scale);
      while (y < endY - 2) {
        let cut = Math.min(endY, y + pageH);
        if (cut < endY) { const fits = marks.filter((m) => m > y + 20 && m <= y + pageH); if (fits.length) cut = Math.max.apply(null, fits); }
        const h = Math.ceil(cut - y);
        const slice = document.createElement('canvas'); slice.width = canvas.width; slice.height = h;
        const g = slice.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, slice.width, h);
        g.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
        if (!first) pdf.addPage();
        first = false;
        pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', M, M, pw, h / pxPerMm);
        y = cut;
      }
      const safe = (s) => String(s || '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
      pdf.save('Duty-Roster_' + safe(deptName) + '_' + R.MONTHS[month] + '-' + year + '.pdf');
      rosToast('PDF downloaded.');
    } catch (e) {
      rosToast((e && e.message ? e.message + ' ' : '') + 'Use Print and choose “Save as PDF” instead.', 'error');
    } finally {
      body.style.width = keep.w; body.style.padding = keep.p;
      setPdfBusy(false);
    }
  };

  if (loading) return <div style={{ display: 'grid', placeItems: 'center', height: '40vh', color: 'var(--muted,#8aa0b8)' }}>Loading…</div>;
  const st = rosStatusNorm(doc ? doc.status : null);
  const tog = (k, label) => (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#3c4858', cursor: 'pointer' }}>
      <input type="checkbox" checked={!!opt[k]} onChange={(e) => setOpt((o) => ({ ...o, [k]: e.target.checked }))} />{label}
    </label>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card">
        <div className="card-b" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => setRoute({ view: 'rosterGrid', dept, year, month })}>‹ Back to the grid</button>
          <div style={{ minWidth: 180 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: '#16202e' }}>Print roster — {deptName}, {R.MONTHS[month]} {year}</div>
            <div className="sub" style={{ fontSize: 11 }}>A4 landscape · letterhead · only the shift codes this roster uses · signatures</div>
          </div>
          <RosStatusChip st={doc ? doc.status : null} />
          <div style={{ flex: 1 }} />
          {tog('colourDesign', 'Colour version')}
          {tog('cards', 'Summary cards')}
          {tog('summary', 'Daily cover rows')}
          {tog('legend', 'Shift legend')}
          {view.rows.some((r) => r.pca) && tog('pcaNewPage', 'PCAs on a new page')}
          {mayPrint
            ? <React.Fragment>
                <button className="btn" disabled={pdfBusy} onClick={downloadPdf} title="Download this roster as a PDF file">{pdfBusy ? 'Preparing PDF…' : 'Download PDF'}</button>
                <button className="btn pri" disabled={busy} onClick={print}>{busy ? 'Preparing…' : 'Print'}</button>
              </React.Fragment>
            : <span className="sub" style={{ fontSize: 11 }}>Printing needs Duty Roster print access.</span>}
        </div>
        {mayPrint && (
          <div className="card-b" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap', borderTop: '1px solid rgba(125,145,180,.18)', paddingTop: 10 }}>
            <div style={{ minWidth: 120, paddingTop: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: '#16202e' }}>Signatures</div>
              <div className="sub" style={{ fontSize: 10.5 }}>pick from the staff list</div>
            </div>
            {[['prepared', 'Prepared by'], ['checked', 'Checked by'], ['approved', 'Approved by']].map(([k, l]) => (
              <RosSignPick key={k} label={l} person={signPeople[k]} staff={staffStore.staff} onPick={(e) => setPicks((p) => ({ ...p, [k]: e }))} />
            ))}
            <button type="button" className="btn sm" style={{ marginTop: 17 }} disabled={!Object.keys(picks).length} onClick={() => setPicks({})} title="Back to the names from Duty Roster → Setup">Reset</button>
          </div>
        )}
      </div>
      <div style={{ background: 'rgba(125,145,180,.12)', borderRadius: 12, padding: 14, overflow: 'auto' }}>
        <iframe ref={frame} title="Roster print preview" srcDoc={html}
          style={{ display: 'block', margin: '0 auto', width: '100%', maxWidth: 1180, height: '78vh', border: 0, background: '#fff', borderRadius: 6, boxShadow: '0 10px 30px rgba(16,32,46,.18)' }} />
      </div>
    </div>
  );
}

/* ================= root ================= */
function RosterView({ view, dept, year, month, setRoute }) {
  const staffStore = useRosterStaff();
  const index = useRosterIndex();
  const scope = useRosterScope();
  const now = new Date();
  const y = Number(year) || now.getFullYear();
  const m = Number.isInteger(Number(month)) ? Number(month) : now.getMonth();

  const inner = (() => {
    if (view !== 'rosterHome' && !dept) return <RosterHome index={index} staffStore={staffStore} scope={scope} setRoute={setRoute} />;
    // A unit outside the assignment. The server refuses it anyway (403 on every roster
    // route), but a bookmark or a stale link would otherwise land on an editor that
    // fails silently on save — say so plainly instead. Only once the scope is known:
    // while it loads every unit is treated as allowed, so a slow answer never blocks.
    // A reviewer (Manager / CNS) may open a unit sent to them that they do not roster
    // themselves; the server still decides per sheet and answers 403 otherwise.
    if (dept && !scope.loading && !scope.inScope(dept) && !(scope.can && scope.can.review)) return <RosterNoAccess dept={dept} setRoute={setRoute} />;
    switch (view) {
      case 'rosterGrid': return <RosterGrid key={dept + '|' + y + '|' + m} staffStore={staffStore} scope={scope} dept={dept} year={y} month={m} setRoute={setRoute} onSaved={index.reload} />;
      // The old coverage-and-rules route now lands on the same screen, open on Rules & policy.
      case 'rosterReview': return <RosterGrid key={dept + '|' + y + '|' + m + '|rules'} staffStore={staffStore} scope={scope} dept={dept} year={y} month={m} setRoute={setRoute} onSaved={index.reload} initialView="rules" />;
      case 'rosterPrint': return <RosterPrint staffStore={staffStore} dept={dept} year={y} month={m} setRoute={setRoute} />;
      default: return <RosterHome index={index} staffStore={staffStore} scope={scope} setRoute={setRoute} />;
    }
  })();
  return <div className="mk-scope">{inner}</div>;
}

// A unit this account is not assigned. Deliberately names the unit: "you are not
// assigned to it" is actionable (ask an administrator for it), "access denied" is not.
function RosterNoAccess({ dept, setRoute }) {
  return (
    <div className="card">
      <div className="card-b" style={{ display: 'grid', placeItems: 'center', padding: 44, textAlign: 'center', gap: 8 }}>
        <div style={{ opacity: .35 }}><Ic d={I.lock || I.grid} s={32} /></div>
        <div style={{ fontWeight: 700, fontSize: 14.5 }}>You are not assigned to {dept}</div>
        <div className="sub" style={{ maxWidth: 420 }}>Your account holds the duty roster for other units. An administrator can add {dept} to it under <b>Users &amp; Roles → Manage → Duty roster units</b>.</div>
        <button className="btn pri" style={{ marginTop: 6 }} onClick={() => setRoute({ view: 'rosterHome' })}>Back to my units</button>
      </div>
    </div>
  );
}

window.RosterView = RosterView;

/* The roster's shared pieces, for the other screens of the module (review inbox, staff
   roster, setup, manpower). One copy of each — the review screen used to keep its own
   key / grid-migration / index hook, and the two drifted. */
window.UNICO_ROSTER_KIT = {
  api: rosApi, toast: rosToast, can: rosCan, portal: rosPortal,
  key: rosKey, migrateGrid: rosMigrateGrid, sheetId: rosSheetId, when: rosWhen,
  useRosterIndex, useRosterScope, useRosterStaff, useRosterConfig, loadConfig: rosLoadConfig, useRosDecide,
  ROS_STATUS, ROS_ACTIONS, ROS_HIST_LABEL, ROS_EDITABLE, statusNorm: rosStatusNorm,
  RosStatusChip, RosDecisionButtons, RosHistoryTimeline, RosReturnedBanner, RosDrawer, RosSheetTable, RosSignOff, RosVersions,
  rulesOf: rosRulesOf, findingsOf: rosFindingsOf, rowsFrom: rosRowsFrom, sheetGuests: rosSheetGuests, printHtml: rosPrintHtml,
  deptName: rosDeptName, signNames: rosSignNames, signLine: rosSignLine, RosMarkList,
  OC_BADGE: ROS_OC_BADGE, AL_DOT: ROS_AL_DOT, MARK_CORNER: ROS_MARK_CORNER, date: rosDate,
  bColor: rosBColor, MONO: ROS_MONO,
};
