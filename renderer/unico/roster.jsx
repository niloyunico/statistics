/* UNICO — Duty Roster module (renderer).
 *
 * The "Duty Roster For …" sheet as a working screen: one month, one unit, every nurse
 * on a row, every day a column, and the shift code in the cell exactly as it is written
 * on paper.
 *
 * Views:
 *   rosterHome    every drafted month across every unit, and the way in to a new one
 *   rosterGrid    the editor — brush, drag-to-swap, repeat-last-week, undo, live rules
 *                 …plus six read-only companions of the saved sheet, reached from the
 *                 same pill row: weekly board, day view, staff timeline, leave calendar,
 *                 the month calendar and the tree view (see ROS_TABS for why they are
 *                 not routes)
 *   rosterReview  coverage per shift per day, who is away, and the rule set
 *   rosterPrint   the printable sheet, 1:1 with the workbook, with the sign-off block
 *
 * WHAT MAKES IT USEFUL RATHER THAN JUST A TABLE
 * Coverage and rule breaches are computed live, from window.UNICO_ROSTER, as you type.
 * A shift nobody is on shows red the moment it happens rather than on the morning it
 * matters — which is the whole reason to do this on a screen instead of in Excel.
 *
 * Data: server/duty-roster.js (`dutyRosters`, one document per unit-month).
 * Staff: window.useStaffStore(), filtered to the unit — one roster in the app, not two.
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
const rosIsAdmin = () => { try { const u = window.__UNICO_USER__; return !u || u.role === 'Administrator'; } catch (e) { return true; } };
const rosInitials = (n) => String(n || '').split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';

const ROS_STATUS = {
  draft: { label: 'Draft', color: '#e0a12a' },
  submitted: { label: 'Submitted', color: '#27a8db' },
  approved: { label: 'Approved', color: '#1f9d63' },
};

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

/* ---------------- shared bits ---------------- */
function RosStatusChip({ st }) {
  const map = { draft: 'In progress', submitted: 'Awaiting discussion', approved: 'Actioned' };
  const label = (ROS_STATUS[st || 'draft'] || ROS_STATUS.draft).label;
  return <span style={MK.stChip(map[st] || 'Not started')}>{label}</span>;
}

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

/* ---------------- the screen strip ----------------
   Every screen in the module, as one pill row.
   The five companion screens (weekly board, day, staff timeline, leave, calendar) are
   READ-ONLY views of the saved sheet, so they hang off the rosterGrid route as a `sub`
   rather than taking route names of their own: the shell's UNICO_MODULE_VIEWS map only
   knows rosterHome/Grid/Review/Print, and an unlisted roster* view would render the
   roster body under the Statistics sidebar. */
const ROS_TABS = [
  ['Monthly grid', 'rosterGrid', ''],
  ['Weekly board', 'rosterGrid', 'week'],
  ['Day view', 'rosterGrid', 'day'],
  ['Staff timeline', 'rosterGrid', 'staff'],
  ['Leave calendar', 'rosterGrid', 'leave'],
  ['Calendar', 'rosterGrid', 'calendar'],
  ['Tree view', 'rosterGrid', 'tree'],
  ['Rules & policy', 'rosterReview', ''],
  ['Print sheet', 'rosterPrint', ''],
];

function RosterTabs({ view, sub, dept, year, month, setRoute, setSub }) {
  return (
    <div className="card" style={{ display: 'inline-flex', gap: 3, padding: 4, borderRadius: 12, flexWrap: 'wrap' }}>
      {ROS_TABS.map(([label, v, s]) => {
        const on = view === v && (sub || '') === s;
        return (
          <button key={label} onClick={() => {
            if (on) return;
            setSub(s);
            if (v !== view) setRoute({ view: v, dept, year, month });
          }} style={{
            border: 0, cursor: 'pointer', font: 'inherit', fontSize: 11.6, fontWeight: 600, padding: '6px 14px', borderRadius: 9,
            color: on ? '#fff' : MK.MUTED,
            background: on ? 'linear-gradient(135deg,#27a8db,#0072a3)' : 'transparent',
          }}>{label}</button>
        );
      })}
    </div>
  );
}

/* ---------------- shared roster maths ----------------
   WEEK START: this hospital's own convention — the week starts on SATURDAY and FRIDAY
   is the weekly holiday, which is what the printed workbook shades and what the mockup's
   calendar says on its face. Every companion screen below follows it: the calendar runs
   Sat→Fri, and Friday is the highlighted column on the board, the leave grid and the
   month cells. (roster-spec's DOW stays Sunday-indexed because it is just a lookup for
   Date.getDay(); nothing reads position 0 as "the start of the week".) */
const ROS_WEEK_ORDER = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const rosDow = (y, m, d) => R.DOW[new Date(y, m, d).getDay()];
const rosIsHoliday = (y, m, d) => new Date(y, m, d).getDay() === 5;   // Friday
// Column position of a date in a Saturday-first week. getDay(): Sun 0 … Sat 6.
const rosCol = (y, m, d) => (new Date(y, m, d).getDay() + 1) % 7;

// The four duty buckets, in the order the board and the day view stack them. 'O' is a
// day off, not a shift, so it is never a column of its own.
const ROS_DUTY = R.BUCKETS.filter((b) => b.id !== 'O');
// Bucket glyphs, lifted from the mockup's BUCKETS table (calendar / sun / dusk / moon).
const ROS_BUCKET_ICON = {
  G: 'M3 5h18v16H3zM3 9h18',
  M: 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z',
  E: 'M12 3a9 9 0 109 9 7 7 0 01-9-9z',
  N: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
};
// Deeper, text-safe tones for bucket headings (the pill colours are too light to read on).
const ROS_TONE = { G: '#6a52d4', M: '#b5670a', E: '#0072a3', N: '#5b45c4' };
// Leave-grid colour per code — grey rest, amber paid leave, blue casual, violet
// parental, green public holiday. Same table the mockup's "Who is away" grid uses.
const ROS_LEAVE_TONE = { OFF: '#8b98ab', DO: '#8b98ab', AL: '#b5670a', EL: '#b5670a', CL: '#0072a3', ML: '#5b45c4', FL: '#5b45c4', PH: '#157a43' };

/* Shift labels are the printed sheet's own time strings ("9:00 AM - 5:00 PM", and
   "12:00 PM - next 8:00 AM" for the long night). Parsed so a bucket can state the real
   window the codes rostered on it span, instead of a hard-coded one. */
function rosMins(t) {
  const m = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(t || '');
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return h * 60 + Number(m[2]) + (/next/i.test(t) ? 1440 : 0);
}
function rosClock(mins) {
  const v = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(v / 60), mm = v % 60;
  const hh = h % 12 === 0 ? 12 : h % 12;
  return hh + (mm ? ':' + String(mm).padStart(2, '0') : '') + ' ' + (h >= 12 ? 'PM' : 'AM');
}
function rosSpan(codes) {
  let lo = null, hi = null;
  codes.forEach((c) => {
    const parts = String((R.BY_CODE[c] || {}).label || '').split('-');
    if (parts.length < 2) return;
    const a = rosMins(parts[0]);
    let b = rosMins(parts[1]);
    if (a == null || b == null) return;
    if (b <= a) b += 1440;                                  // the shift crosses midnight
    if (lo == null || a < lo) lo = a;
    if (hi == null || b > hi) hi = b;
  });
  return lo == null ? '' : rosClock(lo) + ' – ' + rosClock(hi);
}
// What a bucket's hours look like today: the span of the codes actually rostered, or —
// when nobody is on it — the span of every code that bucket owns on the legend.
function rosWindow(bucketId, codes) {
  return rosSpan(codes) || rosSpan(R.SHIFTS.filter((s) => s.bucket === bucketId).map((s) => s.code));
}

/* One sheet, one set of rows. The read-only screens all need exactly this: the saved
   document, the unit's staff in the order the sheet was saved in, and the rule set that
   was saved with it. */
function useRosterSheet(staffStore, dept, year, month) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    rosApi.get('/api/rosters/' + encodeURIComponent(dept) + '/' + year + '/' + month)
      .then((r) => { setDoc(r && r.ok ? r.roster : null); setLoading(false); })
      .catch(() => { setDoc(null); setLoading(false); });
  }, [dept, year, month]);

  const staff = useMemo(() => (staffStore.staff || [])
    .filter((e) => e.is_active !== false && !e.former && (e.current_department || 'Unassigned') === dept)
    .map((e) => ({ empId: rosKey(e), empIdShown: e.emp_id || '', name: e.name, desig: e.designation }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name))), [staffStore.staff, dept]);

  const rows = useMemo(() => {
    const order = (doc && doc.order) || [];
    if (!order.length) return staff;
    const by = {}; staff.forEach((s) => { by[s.empId] = s; });
    const out = []; const seen = {};
    order.forEach((id) => { if (by[id] && !seen[id]) { out.push(by[id]); seen[id] = 1; } });
    staff.forEach((s) => { if (!seen[s.empId]) out.push(s); });
    return out;
  }, [staff, doc]);

  return {
    loading, doc, rows,
    // Through the migration, like the editor: a sheet stored under the old
    // employee-number keys would otherwise read as empty on every companion screen.
    grid: rosMigrateGrid(doc && doc.grid, staff),
    days: R.daysIn(year, month),
    rules: Object.assign({}, R.DEFAULT_RULES, (doc && doc.rules) || {}),
  };
}

/* The key a roster row is stored under.

   NOT the employee number. Two pairs of serving staff share one (11410 and 11520),
   and 39 people on the register have none at all. Keying on emp_id merged each
   colliding pair into a single row: a shift painted on one nurse appeared on the
   other, the second nurse vanished from every read-only screen, and coverageFor
   counted the pair once while the sheet listed them twice. The staff record's own id
   is unique, so that identifies the row; the employee number is display text. */
const rosKey = (e) => 'S' + String(e.id);

/* Rosters saved before rows were keyed on the staff id hold their grid under employee
   NUMBERS. Remap those on load so an existing sheet still opens; anything that cannot
   be matched to a current staff member is kept as-is rather than dropped, so a person
   who has since left does not silently vanish from a published month. */
const rosMigrateGrid = (grid, rows) => {
  const g = grid || {};
  const keys = Object.keys(g);
  if (!keys.length) return g;
  const current = new Set(rows.map((r) => r.empId));
  if (keys.every((k) => current.has(k))) return g;        // already in the new key space
  const byEmpNo = {};
  rows.forEach((r) => { if (r.empIdShown) byEmpNo[String(r.empIdShown)] = r.empId; });
  const out = {};
  keys.forEach((k) => { out[byEmpNo[k] || k] = g[k]; });
  return out;
};

// The minimum this unit expects on each duty bucket, per its own saved rule set.
const rosNeed = (rules, b) => {
  const r = rules[b === 'M' ? 'minMorning' : b === 'E' ? 'minEvening' : b === 'N' ? 'minNight' : ''];
  return (r && r.on && r.value) || 0;
};
// A day is green only when every bucket meets its own minimum — a threshold the unit set,
// never a number invented here.
const rosDayOk = (cov, rules) => ['M', 'E', 'N'].every((b) => cov[b] >= rosNeed(rules, b));

// Every read-only screen wears the same header + screen strip.
function RosSubShell({ title, sub, subName, dept, year, month, setRoute, setSub, right, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card" style={{ padding: '13px 16px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={MK.iconBadge('blue', 36)}><Ic d={I.cal} s={17} /></div>
        <div style={{ flex: 1, minWidth: 230 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: MK.INK }}>{title}</div>
          <div style={{ fontSize: 11.4, color: MK.MUTED }}>{sub}</div>
        </div>
        {right}
        <button className="btn" onClick={() => setRoute({ view: 'rosterHome' })}>All rosters</button>
      </div>
      <div><RosterTabs view="rosterGrid" sub={subName} dept={dept} year={year} month={month} setRoute={setRoute} setSub={setSub} /></div>
      {children}
    </div>
  );
}

// Nothing to show is a fact, not a blank screen: say which sheet is missing and offer
// the way to draft it.
function RosNotDrafted({ dept, year, month, setSub }) {
  return (
    <div className="card">
      <div className="card-b" style={{ display: 'grid', placeItems: 'center', padding: 36, textAlign: 'center', gap: 7 }}>
        <div style={{ opacity: .35 }}><Ic d={I.grid} s={32} /></div>
        <div style={{ fontWeight: 600 }}>No roster drafted for {R.MONTHS[month]} {year}</div>
        <div className="sub" style={{ maxWidth: 420 }}>
          Nothing has been saved for {dept} yet, so there is no duty to show on this screen.
        </div>
        <button className="btn pri" style={{ marginTop: 4 }} onClick={() => setSub('')}>Open the monthly grid</button>
      </div>
    </div>
  );
}

/* ================= 1. HOME / INDEX ================= */
function RosterHome({ index, staffStore, setRoute }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const depts = useMemo(() => {
    const m = {};
    (staffStore.staff || []).filter((e) => e.is_active !== false && !e.former)
      .forEach((e) => { const d = e.current_department || 'Unassigned'; m[d] = (m[d] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [staffStore.staff]);

  const byKey = useMemo(() => {
    const m = {};
    (index.rosters || []).forEach((r) => { m[r.dept + '|' + r.year + '|' + r.month] = r; });
    return m;
  }, [index.rosters]);

  const recent = (index.rosters || []).slice(0, 12);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
          <div className="sub" style={{ marginBottom: 9 }}>Pick a unit to open or start its {R.MONTHS[month]} {year} roster.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
            {depts.map(([d, n]) => {
              const ex = byKey[d + '|' + year + '|' + month];
              return (
                <div key={d} className="card" style={{ padding: 12, cursor: 'pointer', borderLeft: '3px solid ' + (ex ? (ROS_STATUS[ex.status] || ROS_STATUS.draft).color : 'transparent') }}
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
        <div className="card-b"><ShiftLegend /></div>
      </div>
    </div>
  );
}

/* ================= 2. THE GRID EDITOR ================= */
// The codes offered as one-click brushes — the handful a ward actually uses most days.
const QUICK_BRUSH = ['M4', 'E4', 'N2', 'G1', 'OFF', 'DO', 'AL', 'CL'];

/* The rotations a nurse in-charge writes out by hand, as one-click row tools. Each is a
   cycle laid over the month from day 1 — the four the mockup offers, in its own words,
   using this unit's own shift codes. Nothing here is a rule: a pattern is a starting
   point that the rule checker then judges like any other typing. */
const ROS_PATTERNS = [
  { id: 'p_mmeenno', label: '2M · 2E · 2N · 1 off', cycle: ['M4', 'M4', 'E4', 'E4', 'N2', 'N2', 'OFF'] },
  { id: 'p_mmmoff', label: '3 mornings · 1 off', cycle: ['M4', 'M4', 'M4', 'OFF'] },
  { id: 'p_nnnoff', label: '3 nights · 2 off', cycle: ['N2', 'N2', 'N2', 'OFF', 'DO'] },
  { id: 'p_gen', label: 'General duty · Fri off', cycle: ['G1', 'G1', 'G1', 'G1', 'OFF', 'G1', 'DO'] },
];
// Auto-draft lays the first pattern across the whole unit, staggering each nurse two
// days further into the cycle than the one above — which is how a seven-day rotation
// ends up with someone on every shift instead of the whole ward on mornings together.
const ROS_AUTO_PATTERN = ROS_PATTERNS[0].cycle;

function RosKpi({ icon, tint, value, label, tone }) {
  return (
    <div className="card" style={{ padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 11 }}>
      <div style={MK.iconBadge(tint, 34)}><Ic d={icon} s={16} /></div>
      <div style={{ minWidth: 0 }}>
        <div className="num" style={{ fontSize: 22, fontWeight: 700, color: tone || MK.INK, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 10.8, color: MK.FAINT }}>{label}</div>
      </div>
    </div>
  );
}

// One cell: a solid rounded pill in the bucket's colour, white text, exactly as the
// mockup renders it. Leave/off codes are a light grey pill with dark text so a day off
// never reads as a shift at a glance.
function ShiftCell({ code, onClick, onDragStart, onDragOver, onDrop, draggable, dim, title }) {
  const b = R.bucketOf(code);
  const c = b ? R.BUCKET_COLOR[b] : null;
  const off = b === 'O';
  return (
    <td onClick={onClick} draggable={draggable} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}
      title={title} style={{ padding: '2px 1.5px', textAlign: 'center', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{
        height: 24, borderRadius: 7, display: 'grid', placeItems: 'center',
        fontSize: 9.8, fontWeight: 700, letterSpacing: .2,
        background: code ? (off ? 'rgba(125,145,180,.2)' : c) : 'rgba(125,145,180,.07)',
        color: code ? (off ? '#5b6b80' : '#fff') : 'transparent',
        boxShadow: code && !off ? '0 1px 3px ' + c + '55' : 'none',
        opacity: dim ? .35 : 1,
        transition: 'background .15s',
      }}>{code || '·'}</div>
    </td>
  );
}

function RosterGrid({ staffStore, dept, year, month, setRoute, setSub, onSaved }) {
  const days = R.daysIn(year, month);
  const [grid, setGrid] = useState({});
  const [order, setOrder] = useState([]);
  const [status, setStatus] = useState('draft');
  const [rules, setRules] = useState({});
  const [rev, setRev] = useState(0);
  const [loading, setLoading] = useState(true);
  const [brush, setBrush] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState(null);
  const [drag, setDrag] = useState(null);
  const [dragMode, setDragMode] = useState('swap');
  const [focusBucket, setFocusBucket] = useState('');
  const [showLegend, setShowLegend] = useState(false);
  const history = useRef([]);

  const staff = useMemo(() => (staffStore.staff || [])
    .filter((e) => e.is_active !== false && !e.former && (e.current_department || 'Unassigned') === dept)
    .map((e) => ({ empId: rosKey(e), empIdShown: e.emp_id || '', name: e.name, desig: e.designation, role: e.role }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name))), [staffStore.staff, dept]);

  const rows = useMemo(() => {
    if (!order.length) return staff;
    const byId = {}; staff.forEach((x) => { byId[x.empId] = x; });
    const seen = {}; const out = [];
    order.forEach((id) => { if (byId[id] && !seen[id]) { out.push(byId[id]); seen[id] = 1; } });
    staff.forEach((x) => { if (!seen[x.empId]) out.push(x); });
    return out;
  }, [staff, order]);

  const depts = useMemo(() => [...new Set((staffStore.staff || [])
    .filter((e) => e.is_active !== false && !e.former)
    .map((e) => e.current_department || 'Unassigned'))].sort(), [staffStore.staff]);

  useEffect(() => {
    setLoading(true);
    rosApi.get('/api/rosters/' + encodeURIComponent(dept) + '/' + year + '/' + month).then((r) => {
      const d = r && r.ok ? r.roster : null;
      // `staff`, not `rows`: rows is ordered by the very document being loaded, and
      // the remap only needs the id<->employee-number pairs, which staff already has.
      setGrid(rosMigrateGrid(d && d.grid, staff));
      setOrder((d && d.order) || []);
      setStatus((d && d.status) || 'draft');
      setRules((d && d.rules) || {});
      setRev((d && d.revision) || 0);
      setLoading(false); setDirty(false);
      history.current = [];
    }).catch(() => setLoading(false));
  }, [dept, year, month]);

  const locked = status === 'approved';
  const push = () => { history.current.push(JSON.stringify(grid)); if (history.current.length > 40) history.current.shift(); };
  const undo = () => { const p = history.current.pop(); if (p == null) return; setGrid(JSON.parse(p)); setDirty(true); };

  const setCell = (empId, day, code) => {
    if (locked) return;
    push();
    setGrid((g) => {
      const row = { ...(g[empId] || {}) };
      if (code) row[day] = code; else delete row[day];
      return { ...g, [empId]: row };
    });
    setDirty(true);
  };

  const applyDrag = (from, to) => {
    if (locked || !from || !to) return;
    push();
    setGrid((g) => {
      const out = { ...g };
      const ra = { ...(out[from.empId] || {}) };
      const rb = from.empId === to.empId ? ra : { ...(out[to.empId] || {}) };
      const va = ra[from.day], vb = rb[to.day];
      if (dragMode === 'move') {
        delete ra[from.day];
        if (va) rb[to.day] = va; else delete rb[to.day];
      } else {
        if (vb) ra[from.day] = vb; else delete ra[from.day];
        if (va) rb[to.day] = va; else delete rb[to.day];
      }
      out[from.empId] = ra;
      out[to.empId] = rb;
      return out;
    });
    setDirty(true);
  };

  const repeatWeek = () => {
    if (locked) return;
    push();
    setGrid((g) => {
      const out = { ...g };
      rows.forEach((x) => {
        const row = { ...(out[x.empId] || {}) };
        for (let d = 8; d <= days; d++) { const src = row[d - 7]; if (src && !row[d]) row[d] = src; }
        out[x.empId] = row;
      });
      return out;
    });
    setDirty(true);
    rosToast('Week 1 repeated into the blank days that follow.');
  };

  const fillBlanks = (code) => {
    if (locked) return;
    push();
    setGrid((g) => {
      const out = { ...g };
      rows.forEach((x) => {
        const row = { ...(out[x.empId] || {}) };
        for (let d = 1; d <= days; d++) if (!row[d]) row[d] = code;
        out[x.empId] = row;
      });
      return out;
    });
    setDirty(true);
    rosToast('Every blank day filled with ' + code + '.');
  };

  /* ---- the bulk edits ----------------------------------------------------
     Every one of them goes through push() first, so a pattern that lands wrong is one
     Undo away, and sets the dirty flag so it is actually saved. */

  // One nurse, one tool: a rotation, a fill, or a wipe. Applied to that row only.
  const rowTool = (empId, v, who) => {
    if (locked || !v) return;
    const pat = ROS_PATTERNS.find((p) => p.id === v);
    push();
    setGrid((g) => {
      const row = { ...(g[empId] || {}) };
      for (let d = 1; d <= days; d++) {
        if (pat) row[d] = pat.cycle[(d - 1) % pat.cycle.length];
        else if (v === 'clear') delete row[d];
        else if (v === 'blanks' && !row[d]) row[d] = 'OFF';
      }
      return { ...g, [empId]: row };
    });
    setDirty(true);
    rosToast(pat ? who + ' put on ' + pat.label + '.' : v === 'clear' ? who + '’s row cleared.' : who + '’s blank days filled with OFF.');
  };

  // The whole month, every nurse. It overwrites what is already typed, so it asks first
  // whenever there is anything to lose — undo is there, but a whole month is a lot to
  // lose to a stray click.
  const autoFill = () => {
    if (locked) return;
    const anything = rows.some((x) => Object.keys(grid[x.empId] || {}).length);
    if (anything && !window.confirm('Auto-draft replaces every shift already typed in ' + R.MONTHS[month] + '. Continue?')) return;
    push();
    setGrid((g) => {
      const out = { ...g };
      rows.forEach((x, i) => {
        const row = { ...(out[x.empId] || {}) };
        for (let d = 1; d <= days; d++) row[d] = ROS_AUTO_PATTERN[((d - 1) + i * 2) % ROS_AUTO_PATTERN.length];
        out[x.empId] = row;
      });
      return out;
    });
    setDirty(true);
    rosToast('Auto-drafted — every nurse on ' + ROS_PATTERNS[0].label + ', staggered. Check the rule alerts.');
  };

  // One day, every nurse — the brush painted straight down the column from its heading.
  const fillCol = (d) => {
    if (locked || !rosCan('edit')) return;
    if (!brush) { rosToast('Pick a brush code first — then click a day heading to fill that column.', 'info'); return; }
    push();
    setGrid((g) => {
      const out = { ...g };
      rows.forEach((x) => { out[x.empId] = { ...(out[x.empId] || {}), [d]: brush }; });
      return out;
    });
    setDirty(true);
    rosToast(R.MONTHS[month] + ' ' + d + ' filled with ' + brush + ' for all ' + rows.length + ' staff.');
  };

  // Returns a promise of whether the write landed, so callers that must act only
  // after it (Publish approves the sheet it just saved) can chain rather than guess.
  const save = (nextStatus) => {
    setBusy(true);
    return rosApi.put('/api/rosters', {
      dept, deptName: dept, year, month, grid, order: rows.map((r) => r.empId), rules,
      // Names travel with the sheet so a reader without the staff register still
      // sees people rather than employee ids.
      names: rows.reduce((m, r) => { if (r.empId) m[r.empId] = r.name || ''; return m; }, {}),
      status: nextStatus || status,
      preparedBy: (window.unicoSig && window.unicoSig.get && window.unicoSig.get().prepared) || '',
      checkedBy: (window.unicoSig && window.unicoSig.get && window.unicoSig.get().checked) || '',
    }).then((r) => {
      setBusy(false);
      if (r && r.ok) {
        setRev((r.roster && r.roster.revision) || rev + 1);
        setStatus((r.roster && r.roster.status) || nextStatus || status);
        setDirty(false);
        rosToast(nextStatus === 'submitted' ? 'Roster submitted for approval.' : 'Roster saved.');
        if (onSaved) onSaved();
        return true;
      }
      rosToast((r && r.error) || 'Could not save.', 'error');
      return false;
    }).catch(() => { setBusy(false); rosToast('Could not reach the server.', 'error'); return false; });
  };

  const setStatusRemote = (st) => {
    const id = 'ros-' + dept + '-' + year + '-' + String(month).padStart(2, '0');
    setBusy(true);
    rosApi.post('/api/rosters/' + encodeURIComponent(id) + '/status', { status: st }).then((r) => {
      setBusy(false);
      if (r && r.ok) { setStatus(st); rosToast(st === 'approved' ? 'Roster published and locked.' : 'Roster reopened for editing.'); if (onSaved) onSaved(); }
      else rosToast((r && r.error) || 'Could not change the status.', 'error');
    }).catch(() => setBusy(false));
  };

  const findings = useMemo(() => R.checkRules(grid, rows, year, month, rules), [grid, rows, year, month, rules]);
  const findingsByDay = useMemo(() => {
    const m = {};
    findings.forEach((f) => { (m[f.day] = m[f.day] || []).push(f); });
    return m;
  }, [findings]);

  /* The headcount this unit expects on duty at all: its own morning + evening + night
     minimums added up. A saved sheet may hold only the rules it overrode, so read them
     the way checkRules does — defaults underneath. */
  const dutyNeed = useMemo(() => {
    const merged = Object.assign({}, R.DEFAULT_RULES, rules || {});
    return ['M', 'E', 'N'].reduce((a, b) => a + rosNeed(merged, b), 0);
  }, [rules]);

  // totals for the KPI strip
  const totals = useMemo(() => {
    let shifts = 0, hours = 0, leave = 0;
    rows.forEach((x) => {
      const t = R.totalsFor(grid[x.empId] || {}, days);
      shifts += t.G + t.M + t.E + t.N;
      hours += t.hours;
      leave += t.leave;
    });
    return { shifts, hours, leave };
  }, [grid, rows, days]);

  // every code actually used this month, ordered by bucket — the mockup's
  // "staff on each shift, per day" block.
  const usedCodes = useMemo(() => {
    const set = {};
    rows.forEach((x) => { const row = grid[x.empId] || {}; for (let d = 1; d <= days; d++) if (row[d]) set[row[d]] = 1; });
    const order2 = { G: 0, M: 1, E: 2, N: 3, O: 4 };
    return Object.keys(set).sort((a, b) => {
      const ba = order2[R.bucketOf(a)] != null ? order2[R.bucketOf(a)] : 9;
      const bb = order2[R.bucketOf(b)] != null ? order2[R.bucketOf(b)] : 9;
      return ba - bb || a.localeCompare(b);
    });
  }, [grid, rows, days]);

  const dayHead = (d) => {
    const dt = new Date(year, month, d);
    return { dow: R.DOW[dt.getDay()], weekend: dt.getDay() === 5 || dt.getDay() === 6 };
  };

  if (loading) return <div style={{ display: 'grid', placeItems: 'center', height: '40vh', color: MK.MUTED }}>Loading the roster…</div>;

  const stColor = (ROS_STATUS[status] || ROS_STATUS.draft).color;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* header */}
      <div className="card" style={{ padding: '15px 18px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={MK.iconBadge('blue', 40)}><Ic d={I.grid} s={19} /></div>
        <div style={{ flex: 1, minWidth: 250 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: MK.INK }}>Duty roster — {dept}</div>
          <div style={{ fontSize: 11.6, color: MK.MUTED }}>
            {R.MONTHS[month]} {year} · {days} days · {rows.length} staff · prepared by the nurse in-charge, approved by the CNS
          </div>
        </div>
        <select value={dept} onChange={(e) => setRoute({ view: 'rosterGrid', dept: e.target.value, year, month })}>
          {depts.map((d) => <option key={d}>{d}</option>)}
        </select>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 14, color: stColor, background: stColor + '18' }}>
          {(ROS_STATUS[status] || ROS_STATUS.draft).label}
        </span>
        <button className="btn" onClick={() => setRoute({ view: 'rosterHome' })}>All rosters</button>
        {!locked && rosCan('edit') && (
          <button onClick={autoFill} title={'Lay ' + ROS_PATTERNS[0].label + ' across the whole month, staggered nurse by nurse'} style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
            padding: '7px 13px', borderRadius: 10, color: '#5b45c4', background: 'rgba(106,82,212,.1)', border: '1px solid rgba(106,82,212,.32)',
          }}><Ic d="M13 2L4 14h7l-1 8 9-12h-7z" s={14} sw={2} />Auto-draft</button>
        )}
        {!locked && rosCan('edit') && <button className="btn" disabled={busy} onClick={() => save()}>{busy ? 'Saving…' : 'Save draft'}</button>}
        {!locked && rosIsAdmin() && (
          <button className="btn pri" disabled={busy} onClick={() => {
            // Approving a sheet that has not finished saving either 404s (it was never
            // upserted) or approves the previous revision. Chain, do not guess a delay --
            // this deployment has documented cold starts far longer than any timer.
            if (!dirty) { setStatusRemote('approved'); return; }
            Promise.resolve(save('submitted')).then((ok) => { if (ok !== false) setStatusRemote('approved'); });
          }}>
            ✓ Publish {findings.length ? 'anyway' : ''}
          </button>
        )}
        {locked && rosIsAdmin() && <button className="btn" disabled={busy} onClick={() => setStatusRemote('draft')}>Reopen</button>}
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}>
        <RosKpi icon={I.user} tint="blue" value={rows.length} label="Staff rostered" />
        <RosKpi icon={I.grid} tint="teal" value={totals.shifts} label="Shifts assigned" />
        <RosKpi icon={I.doc} tint="violet" value={totals.hours} label="Total hours" />
        <RosKpi icon={I.heart} tint="amber" value={totals.leave} label="Leave days" />
        <RosKpi icon={I.alert || I.pulse} tint={findings.length ? 'red' : 'slate'} value={findings.length} label="Rule warnings" tone={findings.length ? '#d23a52' : undefined} />
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <RosterTabs view="rosterGrid" sub="" dept={dept} year={year} month={month} setRoute={setRoute} setSub={setSub} />
        <div style={{ flex: 1 }} />
        {findings.length > 0 && (
          <span onClick={() => setRoute({ view: 'rosterReview', dept, year, month })} style={{
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.4, fontWeight: 700,
            padding: '6px 13px', borderRadius: 14, color: '#d23a52', background: 'rgba(210,58,82,.12)',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#d23a52' }} />{findings.length} rule warnings
          </span>
        )}
      </div>

      {/* grid card */}
      <div className="card">
        <div className="card-h">
          <h3>Monthly grid</h3>
          <span className="sub">click a cell to pick · drag a shift onto another to swap · paint with a brush · click a day heading to fill that column · ⋯ for row tools</span>
          <div style={{ flex: 1 }} />
          {R.BUCKETS.map((b) => (
            <span key={b.id} onClick={() => setFocusBucket(focusBucket === b.id ? '' : b.id)} style={{
              cursor: 'pointer', fontSize: 10.6, fontWeight: 700, padding: '3px 10px', borderRadius: 12,
              color: focusBucket === b.id ? '#fff' : b.color,
              background: focusBucket === b.id ? b.color : b.color + '18',
            }}>{b.label}</span>
          ))}
          <button className="btn" onClick={() => setShowLegend((v) => !v)}>Shift legend</button>
        </div>

        {showLegend && <div className="card-b" style={{ borderBottom: '1px solid ' + MK.LINE }}><ShiftLegend /></div>}

        {!locked && rosCan('edit') && (
          <div className="card-b" style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid ' + MK.LINE, paddingTop: 10, paddingBottom: 10 }}>
            <span style={{ fontSize: 9.6, fontWeight: 700, letterSpacing: .6, textTransform: 'uppercase', color: MK.FAINT }}>Brush</span>
            {QUICK_BRUSH.map((code) => {
              const b = R.bucketOf(code); const c = R.BUCKET_COLOR[b] || '#8aa0b8';
              const on = brush === code;
              return (
                <button key={code} onClick={() => setBrush(on ? '' : code)} title={(R.BY_CODE[code] || {}).label} style={{
                  cursor: 'pointer', font: 'inherit', fontSize: 10.6, fontWeight: 700, padding: '4px 12px', borderRadius: 9,
                  color: on ? '#fff' : c, background: on ? c : c + '16',
                  border: '1px solid ' + (on ? c : 'transparent'),
                }}>{code}</button>
              );
            })}
            <span style={{ fontSize: 11, color: MK.FAINT }}>
              {brush ? 'Painting ' + brush + ' — click cells' : 'Pick a code to paint, or click a cell to choose'}
            </span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 9.6, fontWeight: 700, letterSpacing: .6, textTransform: 'uppercase', color: MK.FAINT }}>Drag</span>
            <div style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: 10, background: 'rgba(125,145,180,.14)' }}>
              {['swap', 'move'].map((m) => (
                <button key={m} onClick={() => setDragMode(m)} style={{
                  border: 0, cursor: 'pointer', font: 'inherit', fontSize: 10.8, fontWeight: 600, padding: '4px 12px', borderRadius: 8,
                  color: dragMode === m ? MK.INK : MK.MUTED, background: dragMode === m ? '#fff' : 'transparent',
                }}>{m === 'swap' ? 'Swap' : 'Move'}</button>
              ))}
            </div>
            <button className="btn" onClick={repeatWeek}>Repeat last week</button>
            <button className="btn" onClick={() => fillBlanks('OFF')}>Fill blanks OFF</button>
            <button className="btn" onClick={undo} disabled={!history.current.length}>Undo</button>
          </div>
        )}

        <div className="card-b" style={{ overflow: 'auto', padding: 0 }}>
          {rows.length === 0 ? (
            <div style={{ padding: 34, textAlign: 'center', color: MK.MUTED }}>No active staff are assigned to {dept}.</div>
          ) : (
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{
                    position: 'sticky', left: 0, zIndex: 3, background: '#fff', textAlign: 'left', padding: '8px 12px',
                    borderBottom: '1px solid ' + MK.LINE, minWidth: 210,
                    fontSize: 9.4, fontWeight: 700, letterSpacing: .5, textTransform: 'uppercase', color: MK.FAINT,
                  }}>S/N · Emp-ID · Staff name · Designation</th>
                  {Array.from({ length: days }, (_, k) => k + 1).map((d) => {
                    const h = dayHead(d);
                    const bad = (findingsByDay[d] || []).some((f) => f.severity === 'high');
                    const canFill = !locked && rosCan('edit');
                    return (
                      <th key={d} onClick={canFill ? () => fillCol(d) : null}
                        title={!canFill ? '' : brush
                          ? 'Fill ' + R.MONTHS[month] + ' ' + d + ' with ' + brush + ' for every nurse'
                          : 'Pick a brush code, then click a day heading to fill that whole column'}
                        style={{
                          padding: '4px 0', width: 30, borderBottom: '1px solid ' + MK.LINE,
                          cursor: canFill ? 'pointer' : 'default',
                          background: bad ? 'rgba(210,58,82,.08)' : (h.weekend ? 'rgba(0,144,202,.06)' : undefined),
                        }}>
                        <div style={{ fontSize: 8.8, color: MK.FAINT }}>{h.dow}</div>
                        <div className="num" style={{ fontSize: 10.4, fontWeight: 700, color: MK.INK }}>{d}</div>
                      </th>
                    );
                  })}
                  {['G', 'M', 'E', 'N', 'O'].map((b) => (
                    <th key={b} style={{ width: 26, fontSize: 9.6, fontWeight: 700, borderBottom: '1px solid ' + MK.LINE, color: R.BUCKET_COLOR[b] }}>{b}</th>
                  ))}
                  <th style={{ width: 46, fontSize: 9.4, fontWeight: 700, borderBottom: '1px solid ' + MK.LINE, color: MK.FAINT }}>HOURS</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x, k) => {
                  const row = grid[x.empId] || {};
                  const t = R.totalsFor(row, days);
                  return (
                    <tr key={x.empId}>
                      <td style={{ position: 'sticky', left: 0, zIndex: 2, background: '#fff', padding: '4px 12px', borderBottom: '1px solid rgba(125,145,180,.1)' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span className="num" style={{ fontSize: 9.6, color: MK.FAINT, minWidth: 14 }}>{k + 1}</span>
                          <div style={MK.av(x.name, 28)}>{MK.initials(x.name)}</div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 11.8, color: MK.INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.name}</div>
                            <div style={{ fontSize: 9.6, color: MK.FAINT }}>{(x.empIdShown || '—') + ' · ' + (x.desig || '—')}</div>
                          </div>
                          {/* per-row tools — a rotation, a fill or a wipe, for this
                              nurse only. A <select> because it collapses to one glyph
                              in a name cell that is already crowded. */}
                          {!locked && rosCan('edit') && (
                            <select title="Row tools" value="" onChange={(e) => { const v = e.target.value; e.target.value = ''; rowTool(x.empId, v, x.name); }}
                              onClick={(e) => e.stopPropagation()} style={{
                                width: 26, height: 24, flexShrink: 0, boxSizing: 'border-box', padding: '0 2px', borderRadius: 7,
                                border: '1px solid rgba(125,145,180,.28)', background: 'rgba(255,255,255,.7)', fontFamily: 'inherit',
                                fontSize: 10, color: MK.MUTED, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
                                textAlign: 'center', textAlignLast: 'center',
                              }}>
                              <option value="">⋯</option>
                              {ROS_PATTERNS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                              <option value="blanks">Fill blanks OFF</option>
                              <option value="clear">Clear row</option>
                            </select>
                          )}
                        </div>
                      </td>
                      {Array.from({ length: days }, (_, q) => q + 1).map((d) => {
                        const code = row[d] || '';
                        return (
                          <ShiftCell key={d} code={code}
                            dim={!!focusBucket && !!code && R.bucketOf(code) !== focusBucket}
                            draggable={!locked && !!code}
                            title={code ? code + ' · ' + ((R.BY_CODE[code] || {}).label || '') : 'blank'}
                            onDragStart={() => setDrag({ empId: x.empId, day: d })}
                            onDragOver={(e) => { if (drag) e.preventDefault(); }}
                            onDrop={(e) => { e.preventDefault(); applyDrag(drag, { empId: x.empId, day: d }); setDrag(null); }}
                            onClick={locked ? null : () => { if (brush) setCell(x.empId, d, brush === code ? '' : brush); else setPick({ empId: x.empId, day: d, name: x.name }); }} />
                        );
                      })}
                      {['G', 'M', 'E', 'N', 'O'].map((b) => (
                        <td key={b} className="num" style={{ textAlign: 'center', fontSize: 10, borderBottom: '1px solid rgba(125,145,180,.1)', color: t[b] ? R.BUCKET_COLOR[b] : '#c3ceda', fontWeight: 700 }}>{t[b] || ''}</td>
                      ))}
                      <td className="num" style={{ textAlign: 'center', fontSize: 10.6, fontWeight: 700, color: MK.INK, borderBottom: '1px solid rgba(125,145,180,.1)' }}>{t.hours || ''}</td>
                    </tr>
                  );
                })}

                {/* staff on each shift, per day */}
                <tr>
                  <td colSpan={days + 7} style={{ padding: '9px 12px', background: 'rgba(125,145,180,.07)', fontSize: 9.4, fontWeight: 700, letterSpacing: .5, textTransform: 'uppercase', color: MK.FAINT }}>
                    Staff on each shift, per day
                  </td>
                </tr>
                {usedCodes.map((code) => {
                  const b = R.bucketOf(code); const c = R.BUCKET_COLOR[b] || '#8aa0b8';
                  let total = 0;
                  return (
                    <tr key={code} style={{ background: 'rgba(125,145,180,.035)' }}>
                      <td style={{ position: 'sticky', left: 0, zIndex: 2, background: '#f8fafc', padding: '3px 12px', fontSize: 10.4, fontWeight: 700, color: c }}>
                        {code} <span style={{ fontWeight: 500, color: MK.FAINT }}>({(R.BY_CODE[code] || {}).label})</span>
                      </td>
                      {Array.from({ length: days }, (_, q) => q + 1).map((d) => {
                        const n = rows.filter((x) => (grid[x.empId] || {})[d] === code).length;
                        total += n;
                        return <td key={d} className="num" style={{ textAlign: 'center', fontSize: 9.6, fontWeight: 700, color: n ? c : '#d5dee8' }}>{n || '·'}</td>;
                      })}
                      <td colSpan="5"></td>
                      <td className="num" style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: c }}>{total}</td>
                    </tr>
                  );
                })}

                {/* on duty / day — the headcount the ward actually has, against the
                    minimum this unit set for itself (morning + evening + night, from
                    its own rule set). Red is below that minimum, amber is exactly on
                    it — one person calling in sick away from short. */}
                <tr style={{ background: 'rgba(13,28,50,.05)' }}>
                  <td style={{
                    position: 'sticky', left: 0, zIndex: 2, background: '#eef3fa', padding: '8px 12px',
                    fontSize: 9.4, fontWeight: 700, letterSpacing: .5, textTransform: 'uppercase', color: MK.FAINT,
                  }}>On duty / day</td>
                  {Array.from({ length: days }, (_, q) => q + 1).map((d) => {
                    const on = rows.filter((x) => R.isDuty((grid[x.empId] || {})[d])).length;
                    // With every minimum switched off there is no threshold to judge
                    // against, so the row states the count and colours nothing.
                    const c = !dutyNeed ? MK.MUTED : on < dutyNeed ? '#a92c42' : on === dutyNeed ? '#b5670a' : '#157a43';
                    return (
                      <td key={d} className="num" title={on + ' on duty on day ' + d + (dutyNeed ? ' · unit minimum ' + dutyNeed : '')}
                        style={{ padding: '7px 3px', textAlign: 'center', fontSize: 10.4, fontWeight: 800, color: c, background: dutyNeed ? c + '1f' : 'transparent' }}>{on}</td>
                    );
                  })}
                  <td colSpan="6" style={{ padding: '5px 8px', textAlign: 'right', fontSize: 9, color: MK.FAINT, background: '#eef3fa' }}>low = red</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {findings.length > 0 && (
        <div className="card" style={{ borderLeft: '3px solid ' + (findings.some((f) => f.severity === 'high') ? '#d23a52' : '#e08a1e') }}>
          <div className="card-h">
            <div style={MK.iconBadge(findings.some((f) => f.severity === 'high') ? 'red' : 'amber', 30)}><Ic d={I.alert || I.pulse} s={15} /></div>
            <h3>Rule alerts</h3><span className="sub">checked live as you edit</span>
            <div style={{ flex: 1 }} />
            <button className="btn" onClick={() => setRoute({ view: 'rosterReview', dept, year, month })}>All findings ›</button>
          </div>
          <div className="card-b" style={{ maxHeight: 180, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {findings.slice(0, 25).map((f, k) => (
              <div key={k} style={{ display: 'flex', gap: 9, alignItems: 'baseline', fontSize: 11.6 }}>
                <span className="num" style={{ minWidth: 42, textAlign: 'center', fontSize: 10.4, padding: '2px 0', borderRadius: 11, color: MK.MUTED, background: 'rgba(125,145,180,.16)' }}>
                  {R.MONTHS[month].slice(0, 3)} {f.day}
                </span>
                <span style={{ color: f.severity === 'high' ? '#d23a52' : f.severity === 'medium' ? '#e08a1e' : MK.MUTED }}>{f.text}</span>
              </div>
            ))}
            {findings.length > 25 && <div style={{ fontSize: 11, color: MK.FAINT }}>…and {findings.length - 25} more.</div>}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-b" style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 200, fontSize: 11.5, color: MK.MUTED }}>
            {locked ? 'Published and locked — reopen it to make changes.' : dirty ? 'Unsaved changes.' : 'All changes saved.'} · revision v{rev || 1}
          </span>
          {!locked && rosCan('edit') && <button className="btn" disabled={busy} onClick={() => save('submitted')}>Submit for approval</button>}
        </div>
      </div>

      {pick && <CellPicker pick={pick} current={(grid[pick.empId] || {})[pick.day]} month={month} year={year}
        onPick={(code) => { setCell(pick.empId, pick.day, code); setPick(null); }} onClose={() => setPick(null)} />}
    </div>
  );
}

function CellPicker({ pick, current, month, year, onPick, onClose }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  const node = (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(9,17,28,.5)', zIndex: 9000, display: 'grid', placeItems: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 'min(640px,96vw)', maxHeight: '86vh', overflow: 'auto' }}>
        <div className="card-h">
          <div style={{ fontWeight: 700 }}>{pick.name} — {R.MONTHS[month]} {pick.day}, {year}</div>
          <div className="sub">Pick a shift code, or clear the cell</div>
        </div>
        <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {R.BUCKETS.map((b) => (
            <div key={b.id}>
              <div style={{ fontSize: 11, fontWeight: 700, color: b.color, marginBottom: 5 }}>{b.label}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(128px,1fr))', gap: 5 }}>
                {R.SHIFTS.filter((s) => s.bucket === b.id).map((s) => (
                  <button key={s.code} onClick={() => onPick(s.code)} style={{
                    textAlign: 'left', padding: '6px 8px', borderRadius: 7, cursor: 'pointer', font: 'inherit', color: 'inherit',
                    border: '1px solid ' + (current === s.code ? b.color : 'var(--line,#dde3ec)'),
                    background: current === s.code ? b.color + '18' : 'transparent',
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 11.6, color: b.color }}>{s.code}</div>
                    <div style={{ fontSize: 9.6, opacity: .72 }}>{s.label}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="card-h" style={{ borderTop: '1px solid var(--line,#e3e9f1)', borderBottom: 0, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => onPick('')}>Clear cell</button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
  try { if (ReactDOM.createPortal) return ReactDOM.createPortal(node, document.body); } catch (e) {}
  return node;
}

/* ================= 3. WEEKLY BOARD ================= */
function RosterWeek({ staffStore, dept, year, month, setRoute, setSub }) {
  const sheet = useRosterSheet(staffStore, dept, year, month);
  const [week, setWeek] = useState(0);
  const { days, rows, grid } = sheet;
  const weeks = Math.max(1, Math.ceil(days / 7));
  const w = Math.min(week, weeks - 1);
  const first = w * 7 + 1;
  const last = Math.min(days, first + 6);

  if (sheet.loading) return <div style={{ display: 'grid', placeItems: 'center', height: '40vh', color: MK.MUTED }}>Loading the roster…</div>;

  const tabStyle = (on) => ({
    border: 0, cursor: 'pointer', font: 'inherit', fontSize: 11.4, fontWeight: 700, padding: '6px 14px', borderRadius: 9,
    color: on ? '#fff' : MK.MUTED, background: on ? 'linear-gradient(135deg,#27a8db,#0072a3)' : 'transparent',
  });

  return (
    <RosSubShell title={'Weekly board — ' + dept} subName="week" dept={dept} year={year} month={month} setRoute={setRoute} setSub={setSub}
      sub={R.MONTHS[month] + ' ' + year + ' · one column per day, stacked by shift'}>
      {!sheet.doc ? <RosNotDrafted dept={dept} year={year} month={month} setSub={setSub} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="card" style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: 10 }}>
              {Array.from({ length: weeks }, (_, i) => (
                <button key={i} onClick={() => setWeek(i)} style={tabStyle(i === w)}>Week {i + 1}</button>
              ))}
            </div>
            <span style={{ fontSize: 11.5, color: MK.MUTED }}>Days {first}–{last} of {R.MONTHS[month]} {year}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
            {Array.from({ length: last - first + 1 }, (_, i) => first + i).map((d) => {
              const cov = R.coverageFor(grid, rows.map((r) => r.empId), d);
              const holiday = rosIsHoliday(year, month, d);
              return (
                <div key={d} className="card" style={{ borderRadius: 14 }}>
                  <div style={{
                    padding: '9px 11px', color: '#fff',
                    background: holiday ? 'linear-gradient(135deg,#27a8db,#0072a3)' : 'linear-gradient(135deg,rgba(13,28,50,.92),rgba(8,17,32,.88))',
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: .6, textTransform: 'uppercase', opacity: .85 }}>{rosDow(year, month, d)}</div>
                    <div className="num" style={{ fontSize: 16, fontWeight: 800 }}>{d}</div>
                  </div>
                  <div style={{ padding: '9px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {ROS_DUTY.map((b) => {
                      const ids = cov.names[b.id];
                      // A bucket below the unit's own minimum is the one thing a board has
                      // to shout about — everything else is just a headcount.
                      const short = ids.length < rosNeed(sheet.rules, b.id);
                      return (
                        <div key={b.id}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 3, background: b.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: .5, textTransform: 'uppercase', color: '#7d8ea8' }}>{b.label}</span>
                            <span style={{ flex: 1 }} />
                            <span className="num" style={{
                              fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
                              color: short ? '#a92c42' : MK.MUTED, background: short ? 'rgba(210,58,82,.12)' : 'rgba(125,145,180,.14)',
                            }}>{ids.length}</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {ids.map((id) => {
                              const p = rows.find((r) => r.empId === id) || {};
                              const code = (grid[id] || {})[d];
                              return (
                                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: MK.BODY }}>
                                  <span className="num" style={{ fontSize: 9.5, fontWeight: 700, color: '#fff', background: b.color, padding: '1px 5px', borderRadius: 5, flexShrink: 0 }}>{code}</span>
                                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name || id}</span>
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
            })}
          </div>
        </div>
      )}
    </RosSubShell>
  );
}

/* ================= 4. DAY VIEW ================= */
function RosterDay({ staffStore, dept, year, month, setRoute, setSub, focusDay }) {
  const sheet = useRosterSheet(staffStore, dept, year, month);
  const now = new Date();
  const [day, setDay] = useState(() => focusDay
    || (now.getFullYear() === year && now.getMonth() === month ? now.getDate() : 1));
  const { days, rows, grid } = sheet;
  const d = Math.min(Math.max(1, day), days);

  if (sheet.loading) return <div style={{ display: 'grid', placeItems: 'center', height: '40vh', color: MK.MUTED }}>Loading the roster…</div>;

  const ids = rows.map((r) => r.empId);
  const cov = R.coverageFor(grid, ids, d);
  const on = cov.G + cov.M + cov.E + cov.N;
  const covC = rosDayOk(cov, sheet.rules) ? '#157a43' : '#a92c42';
  const arrow = {
    width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(125,145,180,.3)', background: 'rgba(255,255,255,.7)',
    color: MK.BODY, cursor: 'pointer', display: 'grid', placeItems: 'center',
  };

  return (
    <RosSubShell title={'Day view — ' + dept} subName="day" dept={dept} year={year} month={month} setRoute={setRoute} setSub={setSub}
      sub={R.MONTHS[month] + ' ' + year + ' · who is on each shift, and what is uncovered'}>
      {!sheet.doc ? <RosNotDrafted dept={dept} year={year} month={month} setSub={setSub} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap' }}>
            <button style={{ ...arrow, opacity: d <= 1 ? .4 : 1 }} disabled={d <= 1} onClick={() => setDay(Math.max(1, d - 1))} title="Previous day">
              <Ic d={I.chevR} s={14} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <div style={{ fontSize: 15, fontWeight: 800, color: MK.INK }}>{d} {R.MONTHS[month]} {year} · {rosDow(year, month, d)}</div>
            <button style={{ ...arrow, opacity: d >= days ? .4 : 1 }} disabled={d >= days} onClick={() => setDay(Math.min(days, d + 1))} title="Next day">
              <Ic d={I.chevR} s={14} />
            </button>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: covC, background: covC + '16', padding: '6px 12px', borderRadius: 16, whiteSpace: 'nowrap' }}>
              {on} of {rows.length} on duty
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 13 }}>
            {ROS_DUTY.map((b) => {
              const list = cov.names[b.id];
              const codes = list.map((id) => (grid[id] || {})[d]);
              return (
                <div key={b.id} className="card" style={{ position: 'relative', borderRadius: 15 }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: 'linear-gradient(180deg,' + b.color + ',' + b.color + '55)' }} />
                  <div style={{ padding: '13px 15px 13px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
                      <span style={{ display: 'inline-grid', placeItems: 'center', width: 30, height: 30, borderRadius: 9, background: b.color + '18', color: b.color, flexShrink: 0 }}>
                        <Ic d={ROS_BUCKET_ICON[b.id]} s={15} />
                      </span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: MK.INK }}>{b.label}</div>
                        <div style={{ fontSize: 10.5, color: MK.FAINT }}>{rosWindow(b.id, codes)}</div>
                      </div>
                      <span style={{ flex: 1 }} />
                      <span className="num" style={{
                        fontSize: 12, fontWeight: 800, padding: '2px 9px', borderRadius: 10,
                        color: list.length ? b.color : '#a92c42', background: list.length ? b.color + '16' : 'rgba(210,58,82,.12)',
                      }}>{list.length}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {list.map((id) => {
                        const p = rows.find((r) => r.empId === id) || {};
                        return (
                          <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.9)', borderRadius: 10, padding: '7px 10px' }}>
                            <div style={MK.av(p.name, 30)}>{MK.initials(p.name)}</div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: MK.INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name || id}</div>
                              <div style={{ fontSize: 10, color: MK.FAINT }}>{p.desig || '—'}</div>
                            </div>
                            <span className="num" style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: b.color, padding: '2px 7px', borderRadius: 6, flexShrink: 0 }}>{(grid[id] || {})[d]}</span>
                          </div>
                        );
                      })}
                      {list.length === 0 && (
                        <div style={{ fontSize: 11.5, color: '#a92c42', background: 'rgba(210,58,82,.09)', borderRadius: 9, padding: '8px 10px' }}>
                          No one rostered — this shift is uncovered.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </RosSubShell>
  );
}

/* ================= 5. STAFF TIMELINE ================= */
function RosterStaff({ staffStore, dept, year, month, setRoute, setSub }) {
  const sheet = useRosterSheet(staffStore, dept, year, month);
  const { days, rows, grid } = sheet;

  if (sheet.loading) return <div style={{ display: 'grid', placeItems: 'center', height: '40vh', color: MK.MUTED }}>Loading the roster…</div>;

  const chip = (label, c) => ({
    fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, fontWeight: 700, color: c, background: c + '16',
    padding: '3px 9px', borderRadius: 10, whiteSpace: 'nowrap',
  });

  return (
    <RosSubShell title={'Staff timeline — ' + dept} subName="staff" dept={dept} year={year} month={month} setRoute={setRoute} setSub={setSub}
      sub={R.MONTHS[month] + ' ' + year + ' · one month of duty per nurse, with the month’s totals'}>
      {!sheet.doc ? <RosNotDrafted dept={dept} year={year} month={month} setSub={setSub} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((s) => {
            const row = grid[s.empId] || {};
            const t = R.totalsFor(row, days);
            // 200 h a month is the point at which the sheet is asking too much of one
            // person — the same line the grid's hours column draws.
            const chips = [['G ' + t.G, '#6a52d4'], ['M ' + t.M, '#e08a1e'], ['E ' + t.E, '#0090ca'],
              ['N ' + t.N, '#5b45c4'], ['Off ' + t.O, '#8b98ab'], [t.hours + ' h', t.hours > 200 ? '#a92c42' : '#157a43']];
            return (
              <div key={s.empId} className="card" style={{ borderRadius: 15, padding: '13px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                  <div style={MK.av(s.name, 34)}>{MK.initials(s.name)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: MK.INK }}>{s.name}</div>
                    <div style={{ fontSize: 10.5, color: MK.FAINT }}><span className="num">{s.empIdShown || '—'}</span> · {s.desig || '—'}</div>
                  </div>
                  <span style={{ flex: 1 }} />
                  {chips.map(([label, c]) => <span key={label} style={chip(label, c)}>{label}</span>)}
                </div>
                <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {Array.from({ length: days }, (_, k) => k + 1).map((d) => {
                    const code = row[d] || '';
                    const b = R.bucketOf(code);
                    const col = b ? R.BUCKET_COLOR[b] : 'rgba(125,145,180,.2)';
                    return (
                      <span key={d} title={R.MONTHS[month] + ' ' + d + ' · ' + (code ? code + ' — ' + ((R.BY_CODE[code] || {}).label || '') : 'not assigned')} style={{
                        display: 'inline-grid', placeItems: 'center', width: 22, height: 24, borderRadius: 5,
                        fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5, fontWeight: 700,
                        color: b === 'O' ? MK.MUTED : '#fff',
                        background: b === 'O' ? 'rgba(125,145,180,.2)' : col,
                        opacity: b ? 1 : .3,
                      }}>{code ? code[0] : '·'}</span>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {rows.length === 0 && <div className="card"><div className="card-b" style={{ textAlign: 'center', color: MK.MUTED, padding: 30 }}>No active staff are assigned to {dept}.</div></div>}
        </div>
      )}
    </RosSubShell>
  );
}

/* ================= 6. LEAVE CALENDAR ================= */
// The paid-leave codes, which are the leave codes minus the public holiday — a holiday
// is granted to the whole unit, not taken by a person.
const ROS_PAID_LEAVE = R.LEAVE_CODES.filter((c) => c !== 'PH');

function RosterLeave({ staffStore, dept, year, month, setRoute, setSub }) {
  const sheet = useRosterSheet(staffStore, dept, year, month);
  const { days, rows, grid, rules } = sheet;

  if (sheet.loading) return <div style={{ display: 'grid', placeItems: 'center', height: '40vh', color: MK.MUTED }}>Loading the roster…</div>;

  // The month's rest entitlement, from this unit's own weekly-off rule.
  const minOff = ((rules.weeklyOff || {}).on ? (rules.weeklyOff.value || 0) : 0) * Math.ceil(days / 7);
  const leaveLimit = ((rules.leaveClash || {}).on ? rules.leaveClash.value : null);

  let off = 0, paid = 0, ph = 0, total = 0;
  const awayPer = [];
  rows.forEach((s) => {
    const row = grid[s.empId] || {};
    let n = 0;
    for (let d = 1; d <= days; d++) {
      const c = row[d];
      if (!c) continue;
      if (R.OFF_CODES.indexOf(c) >= 0) { off++; n++; } else if (c === 'PH') { ph++; n++; } else if (ROS_PAID_LEAVE.indexOf(c) >= 0) { paid++; n++; }
      if (R.bucketOf(c) === 'O') total++;
    }
    awayPer.push(n);
  });
  const lowest = awayPer.length ? Math.min.apply(null, awayPer) : 0;

  const kpis = [
    { lbl: 'rest days (OFF/DO)', val: off, tint: 'slate', icd: I.cal },
    { lbl: 'paid leave days', val: paid, tint: 'amber', icd: I.check },
    { lbl: 'public holidays', val: ph, tint: 'violet', icd: I.star },
    { lbl: 'fewest days off', val: lowest, tint: lowest < minOff ? 'red' : 'green', icd: I.heart },
  ];

  const legend = [['OFF / DO', '#8b98ab'], ['AL / EL', '#b5670a'], ['CL', '#0072a3'], ['ML / FL', '#5b45c4'], ['PH', '#157a43']];

  // FL sits in the mix even though the mockup's sample never used it: the sheet accepts
  // the code, so hiding it would hide real leave.
  const mix = [['OFF', 'Off day'], ['DO', 'Day off'], ['AL', 'Annual leave'], ['CL', 'Casual leave'],
    ['EL', 'Earned leave'], ['ML', 'Maternity leave'], ['FL', 'Paternity leave'], ['PH', 'Public holiday']]
    .map(([code, label]) => {
      let n = 0;
      rows.forEach((s) => { const row = grid[s.empId] || {}; for (let d = 1; d <= days; d++) if (row[d] === code) n++; });
      return { code, label, n };
    });
  const mixMax = Math.max(1, ...mix.map((m) => m.n));

  const clashes = [];
  if (leaveLimit != null) {
    for (let d = 1; d <= days; d++) {
      const who = rows.filter((s) => R.isLeave((grid[s.empId] || {})[d]));
      if (who.length > leaveLimit) clashes.push({ day: d, who });
    }
  }

  return (
    <RosSubShell title={'Leave calendar — ' + dept} subName="leave" dept={dept} year={year} month={month} setRoute={setRoute} setSub={setSub}
      sub={R.MONTHS[month] + ' ' + year + ' · rest, leave and the days they collide'}>
      {!sheet.doc ? <RosNotDrafted dept={dept} year={year} month={month} setSub={setSub} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
            {kpis.map((k) => (
              <div key={k.lbl} className="card" style={{ padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={MK.iconBadge(k.tint, 32)}><Ic d={k.icd} s={15} /></div>
                <div style={{ minWidth: 0 }}>
                  <div className="num" style={{ fontSize: 19, fontWeight: 800, color: MK.INK, lineHeight: 1.15 }}>{k.val}</div>
                  <div style={{ fontSize: 10.5, color: MK.MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.lbl}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-h" style={{ flexWrap: 'wrap' }}>
              <div style={MK.iconBadge('amber', 26)}><Ic d={I.cal} s={14} /></div>
              <h3>Who is away — {R.MONTHS[month]} {year}</h3>
              <span style={{ flex: 1 }} />
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {legend.map(([label, c]) => (
                  <span key={label} style={{ fontSize: 9.5, fontWeight: 700, color: c, background: c + '16', border: '1px solid ' + c + '2e', padding: '2px 8px', borderRadius: 8, whiteSpace: 'nowrap' }}>{label}</span>
                ))}
              </div>
            </div>
            <div className="card-b" style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'separate', borderSpacing: 2, fontSize: 10.5 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '3px 8px 3px 2px', fontSize: 9, letterSpacing: .5, textTransform: 'uppercase', color: '#7d8ea8', minWidth: 150 }}>Nurse</th>
                    {Array.from({ length: days }, (_, k) => k + 1).map((d) => (
                      <th key={d} className="num" style={{ padding: '3px 0', textAlign: 'center', minWidth: 19, fontSize: 9, fontWeight: 700, color: rosIsHoliday(year, month, d) ? '#b5670a' : MK.FAINT }}>{d}</th>
                    ))}
                    <th style={{ padding: '3px 4px', fontSize: 9, letterSpacing: .5, textTransform: 'uppercase', color: '#7d8ea8' }}>Off</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => {
                    const row = grid[s.empId] || {};
                    let offN = 0;
                    const cells = Array.from({ length: days }, (_, k) => k + 1).map((d) => {
                      const c = row[d];
                      const col = ROS_LEAVE_TONE[c] || '';
                      if (col) offN++;
                      return { d, c, col };
                    });
                    return (
                      <tr key={s.empId}>
                        <td style={{ padding: '2px 8px 2px 2px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <div style={MK.av(s.name, 22)}>{MK.initials(s.name)}</div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: MK.INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                          </div>
                        </td>
                        {cells.map((x) => (
                          <td key={x.d} style={{ padding: 0 }}>
                            <span title={R.MONTHS[month] + ' ' + x.d + ' · ' + (x.c || 'on duty')} style={x.col ? {
                              display: 'grid', placeItems: 'center', width: 19, height: 19, borderRadius: 5,
                              fontFamily: "'IBM Plex Mono',monospace", fontSize: 7.5, fontWeight: 800, color: '#fff',
                              background: 'linear-gradient(140deg,' + x.col + ',' + x.col + 'c4)', boxShadow: '0 1px 4px ' + x.col + '55',
                            } : {
                              display: 'grid', placeItems: 'center', width: 19, height: 19, borderRadius: 5,
                              background: rosIsHoliday(year, month, x.d) ? 'rgba(224,138,30,.1)' : 'rgba(125,145,180,.09)',
                            }}>{x.col ? String(x.c).slice(0, 2) : ''}</span>
                          </td>
                        ))}
                        <td className="num" style={{ padding: '2px 4px', textAlign: 'center', fontSize: 11, fontWeight: 800, color: offN < minOff ? '#a92c42' : '#157a43' }}>{offN}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14, alignItems: 'start' }}>
            <div className="card">
              <div className="card-h">
                <h3>Leave mix</h3>
                <span style={{ flex: 1 }} />
                <span className="sub">{total} days total</span>
              </div>
              <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {mix.map((l) => {
                  const c = ROS_LEAVE_TONE[l.code] || '#8b98ab';
                  return (
                    <div key={l.code} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="num" style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: c, padding: '2px 7px', borderRadius: 6, flexShrink: 0, minWidth: 30, textAlign: 'center' }}>{l.code}</span>
                      <span style={{ fontSize: 11.5, color: MK.BODY, width: 104, flexShrink: 0 }}>{l.label}</span>
                      <div style={{ flex: 1, height: 10, borderRadius: 6, background: 'rgba(125,145,180,.14)', overflow: 'hidden' }}>
                        <div style={{ width: (l.n / mixMax * 100) + '%', height: '100%', borderRadius: 5, background: 'linear-gradient(90deg,' + c + ',' + c + '99)' }} />
                      </div>
                      <span className="num" style={{ fontSize: 11.5, fontWeight: 800, color: MK.BODY, width: 26, textAlign: 'right' }}>{l.n}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <div className="card-h">
                <div style={MK.iconBadge('red', 26)}><Ic d={I.pulse} s={14} /></div>
                <h3>Clash days</h3>
                <span style={{ flex: 1 }} />
                <span className="sub">{leaveLimit == null ? 'the clash rule is switched off' : 'more than ' + leaveLimit + ' away'}</span>
              </div>
              <div>
                {clashes.map((c) => (
                  <div key={c.day} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid rgba(125,145,180,.12)' }}>
                    <span className="num" style={{ fontSize: 11, fontWeight: 800, color: '#a92c42', background: 'rgba(210,58,82,.12)', padding: '4px 9px', borderRadius: 8, flexShrink: 0, minWidth: 26, textAlign: 'center' }}>{c.day}</span>
                    <div style={{ minWidth: 0, flex: 1, fontSize: 11.5, color: MK.BODY }}>{c.who.map((s) => s.name).join(', ')}</div>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: '#a92c42', background: 'rgba(210,58,82,.12)', padding: '2px 9px', borderRadius: 14 }}>clash</span>
                  </div>
                ))}
                {clashes.length === 0 && (
                  <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ display: 'inline-grid', placeItems: 'center', width: 30, height: 30, borderRadius: '50%', background: 'rgba(31,157,87,.14)', color: '#157a43', flexShrink: 0 }}>
                      <Ic d={I.check} s={15} sw={3} />
                    </span>
                    <div style={{ fontSize: 12, color: MK.BODY, lineHeight: 1.5 }}>
                      {leaveLimit == null
                        ? 'No clash limit is set, so nothing is flagged. Turn the leave-clash rule on under Rules & policy.'
                        : 'Leave is spread evenly — no day has more than ' + leaveLimit + ' nurse away.'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </RosSubShell>
  );
}

/* ================= 7. MONTH CALENDAR ================= */
function RosDayPop({ day, rows, grid, dept, year, month, rules, onClose, onOpenDay }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);

  const ids = rows.map((r) => r.empId);
  const cov = R.coverageFor(grid, ids, day);
  const on = cov.G + cov.M + cov.E + cov.N;
  const covC = rosDayOk(cov, rules) ? '#157a43' : '#a92c42';
  const byId = {}; rows.forEach((r) => { byId[r.empId] = r; });

  const node = (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 4200, display: 'grid', placeItems: 'center', background: 'rgba(31,59,90,.32)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', padding: 18 }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 'min(580px,92vw)', maxHeight: '86vh', overflowY: 'auto',
        background: 'linear-gradient(158deg,rgba(255,255,255,.98),rgba(238,246,254,.96))',
        border: '1px solid rgba(255,255,255,.95)', borderRadius: 18, boxShadow: '0 30px 80px rgba(31,59,90,.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '15px 18px', borderBottom: '1px solid ' + MK.LINE, background: 'linear-gradient(180deg,rgba(233,243,252,.7),rgba(255,255,255,.4))' }}>
          <span style={{ display: 'inline-grid', placeItems: 'center', width: 36, height: 36, borderRadius: 11, background: 'rgba(0,144,202,.12)', color: '#0072a3', flexShrink: 0 }}>
            <Ic d={I.cal} s={17} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: MK.INK }}>{day} {R.MONTHS[month]} · {rosDow(year, month, day)}</div>
            <div style={{ fontSize: 11, color: MK.MUTED, marginTop: 1 }}>{dept} · {rosIsHoliday(year, month, day) ? 'weekly holiday' : 'working day'}</div>
          </div>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: covC, background: covC + '16', border: '1px solid ' + covC + '33', padding: '5px 11px', borderRadius: 14, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {on} of {rows.length} on duty
          </span>
          <span onClick={onClose} style={{ cursor: 'pointer', color: MK.FAINT, display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 8, flexShrink: 0 }}><Ic d={I.x} s={14} /></span>
        </div>

        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 13 }}>
          {ROS_DUTY.map((b) => {
            const list = cov.names[b.id];
            const tone = ROS_TONE[b.id];
            return (
              <div key={b.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 3, background: tone, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: .8, textTransform: 'uppercase', color: tone }}>{b.label}</span>
                  <span style={{ fontSize: 10, color: '#7d8ea8' }}>{rosWindow(b.id, list.map((id) => (grid[id] || {})[day]))}</span>
                  <span style={{ flex: 1 }} />
                  <span className="num" style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 9, color: list.length ? tone : '#a92c42', background: list.length ? tone + '16' : 'rgba(210,58,82,.1)' }}>{list.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {list.map((id) => {
                    const p = byId[id] || {};
                    const code = (grid[id] || {})[day];
                    return (
                      <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(255,255,255,.85)', border: '1px solid rgba(125,145,180,.2)', borderRadius: 10, padding: '7px 10px', boxShadow: '0 2px 6px rgba(31,59,90,.05)' }}>
                        <div style={MK.av(p.name, 28)}>{MK.initials(p.name)}</div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: MK.INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name || id}</div>
                          <div style={{ fontSize: 10, color: MK.FAINT }}>{p.desig || '—'}</div>
                        </div>
                        <span className="num" style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: R.BUCKET_COLOR[b.id], padding: '2px 7px', borderRadius: 6, flexShrink: 0 }}>{code}</span>
                        <span className="num" style={{ fontSize: 10, color: MK.MUTED, whiteSpace: 'nowrap' }}>{(R.BY_CODE[code] || {}).label || ''}</span>
                      </div>
                    );
                  })}
                  {list.length === 0 && (
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#a92c42', background: 'rgba(210,58,82,.09)', border: '1px solid rgba(210,58,82,.22)', borderRadius: 9, padding: '7px 10px' }}>
                      Uncovered — no one rostered.
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', borderTop: '1px solid ' + MK.LINE, paddingTop: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: .8, textTransform: 'uppercase', color: '#7d8ea8' }}>Off / leave</span>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', flex: 1 }}>
              {cov.names.O.map((id) => (
                <span key={id} style={{ fontSize: 10, fontWeight: 600, color: MK.MUTED, background: 'rgba(255,255,255,.8)', border: '1px solid rgba(125,145,180,.25)', padding: '3px 9px', borderRadius: 10, whiteSpace: 'nowrap' }}>
                  {String((byId[id] || {}).name || id).split(' ')[0]} · {(grid[id] || {})[day]}
                </span>
              ))}
              {cov.names.O.length === 0 && <span style={{ fontSize: 11, color: MK.FAINT }}>Everyone on duty</span>}
            </div>
            <button onClick={onOpenDay} style={{
              border: '1px solid rgba(0,144,202,.3)', background: 'rgba(0,144,202,.09)', color: '#0072a3',
              padding: '7px 13px', borderRadius: 9, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', font: 'inherit', flexShrink: 0,
            }}>Open day view ›</button>
          </div>
        </div>
      </div>
    </div>
  );
  try { if (ReactDOM.createPortal) return ReactDOM.createPortal(node, document.body); } catch (e) {}
  return node;
}

function RosterCalendar({ staffStore, dept, year, month, setRoute, setSub, setFocusDay }) {
  const sheet = useRosterSheet(staffStore, dept, year, month);
  const [pop, setPop] = useState(0);
  const { days, rows, grid, rules } = sheet;

  if (sheet.loading) return <div style={{ display: 'grid', placeItems: 'center', height: '40vh', color: MK.MUTED }}>Loading the roster…</div>;

  const ids = rows.map((r) => r.empId);
  // Saturday-first month grid: lead blanks, then the days, padded to whole weeks.
  const cells = [];
  for (let i = 0; i < rosCol(year, month, 1); i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  // The whole-day need: what all three staffed buckets ask for together.
  const need = rosNeed(rules, 'M') + rosNeed(rules, 'E') + rosNeed(rules, 'N');

  return (
    <RosSubShell title={'Calendar — ' + dept} subName="calendar" dept={dept} year={year} month={month} setRoute={setRoute} setSub={setSub}
      sub={R.MONTHS[month] + ' ' + year + ' · click a day for who is on it'}
      right={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 700, color: '#b5670a', background: 'rgba(224,138,30,.14)', border: '1px solid rgba(224,138,30,.28)', padding: '4px 11px', borderRadius: 12 }}>Friday off</span>}>
      {!sheet.doc ? <RosNotDrafted dept={dept} year={year} month={month} setSub={setSub} /> : (
        <div className="card">
          <div className="card-h" style={{ flexWrap: 'wrap' }}>
            <h3>{R.MONTHS[month]} {year}</h3>
            <span className="sub">week starts Saturday · Friday is the weekly holiday</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 1, background: 'rgba(125,145,180,.16)', padding: 1 }}>
            {ROS_WEEK_ORDER.map((h) => (
              <div key={h} style={{
                padding: '8px 6px', textAlign: 'center', fontSize: 9.5, fontWeight: 800, letterSpacing: .7, textTransform: 'uppercase',
                color: h === 'Fri' ? '#b5670a' : '#7d8ea8',
                background: h === 'Fri' ? 'rgba(224,138,30,.14)' : 'linear-gradient(180deg,#f6fafe,#e9f1fa)',
              }}>{h}</div>
            ))}
            {cells.map((d, k) => {
              if (!d) return <div key={'b' + k} style={{ minHeight: 92, background: 'rgba(244,248,252,.5)' }} />;
              const cov = R.coverageFor(grid, ids, d);
              const on = cov.G + cov.M + cov.E + cov.N;
              /* Green only when EVERY staffed bucket meets its own minimum.

                 Comparing a total headcount against the summed minimums let six
                 general-duty staff and nobody at all on nights paint the day green --
                 on the one screen whose whole purpose is to make an uncovered shift
                 visible, while the day popup for the same date showed it red. */
              const short = ['M', 'E', 'N'].filter((b) => cov[b] < rosNeed(rules, b) && rosNeed(rules, b) > 0);
              const cc = need === 0 ? '#5b6b80' : short.length === 0 ? '#157a43' : short.length < 3 ? '#b5670a' : '#a92c42';
              const holiday = rosIsHoliday(year, month, d);
              const offNames = cov.names.O.map((id) => String((rows.find((r) => r.empId === id) || {}).name || id).split(' ')[0]);
              return (
                <div key={d} onClick={() => setPop(d)} style={{
                  minHeight: 92, padding: '8px 9px', cursor: 'pointer', transition: 'background .15s',
                  background: holiday ? 'linear-gradient(160deg,rgba(255,247,235,.95),rgba(255,241,222,.8))' : 'rgba(255,255,255,.82)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span className="num" style={{ fontSize: 13, fontWeight: 800, color: holiday ? '#b5670a' : MK.INK }}>{d}</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: cc, background: cc + '18', padding: '1px 7px', borderRadius: 9, whiteSpace: 'nowrap' }}>{on} on</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {['M', 'E', 'N', 'G'].map((b) => (
                      <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span className="num" style={{ fontSize: 8.5, fontWeight: 800, color: R.BUCKET_COLOR[b], width: 9, flexShrink: 0 }}>{b}</span>
                        <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(125,145,180,.14)', overflow: 'hidden' }}>
                          <div style={{ width: Math.min(100, cov[b] / Math.max(1, rows.length) * 100) + '%', height: '100%', borderRadius: 3, background: R.BUCKET_COLOR[b] }} />
                        </div>
                        <span className="num" style={{ fontSize: 9, fontWeight: 700, color: MK.MUTED, width: 9, textAlign: 'right' }}>{cov[b]}</span>
                      </div>
                    ))}
                  </div>
                  {offNames.length > 0 && (
                    <div style={{ marginTop: 6, fontSize: 9, color: MK.FAINT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      off: {offNames.slice(0, 3).join(', ')}{offNames.length > 3 ? ' +' + (offNames.length - 3) : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!!pop && <RosDayPop day={pop} rows={rows} grid={grid} dept={dept} year={year} month={month} rules={rules}
        onClose={() => setPop(0)}
        onOpenDay={() => { setFocusDay(pop); setPop(0); setSub('day'); }} />}
    </RosSubShell>
  );
}

/* ================= 8. TREE VIEW =================
   One day of the sheet drawn as a dendrogram: the unit branches into shifts, each shift
   into designation tiers, each tier into the nurses standing on it. It answers what the
   grid cannot show at a glance — who exactly is holding the night, and at what
   seniority.

   Only one branch is open at a time. That is what keeps a forty-nurse unit legible:
   click a shift, then a designation, and the tree redraws around that path. */

// Level 1 — the branches, in the order the mockup stacks them, in its own words.
const ROS_TREE_GROUPS = [['M', 'MORNING'], ['E', 'EVENING'], ['N', 'NIGHT'], ['G', 'GENERAL DUTY'], ['O', 'OFF / LEAVE']];

/* Level 2 is the designation tier, most senior first. Nothing on a staff record states
   seniority, so the order is taken from the staff register's own designation picker
   (window.STAFF.DESIGNATIONS), which runs junior → senior; read backwards it is the
   order a nurse in-charge reads a branch in. PCA designations follow the nursing ones,
   and anything unlisted — including the 39 people on the register with no designation
   recorded — sorts last rather than being dropped out of the tree. */
function rosTierRank(desig) {
  const S = window.STAFF || {};
  const nurse = S.DESIGNATIONS || [];
  const pca = S.PCA_DESIGNATIONS || [];
  const i = nurse.indexOf(desig);
  if (i >= 0) return nurse.length - i;
  const j = pca.indexOf(desig);
  if (j >= 0) return 1000 + (pca.length - j);
  return 9000;
}

function RosterTree({ staffStore, dept, year, month, setRoute, setSub }) {
  const sheet = useRosterSheet(staffStore, dept, year, month);
  const now = new Date();
  const [day, setDay] = useState(() => (now.getFullYear() === year && now.getMonth() === month ? now.getDate() : 1));
  const [openB, setOpenB] = useState('');
  const [openD, setOpenD] = useState('');
  const { days, rows, grid } = sheet;

  if (sheet.loading) return <div style={{ display: 'grid', placeItems: 'center', height: '40vh', color: MK.MUTED }}>Loading the roster…</div>;

  const d = Math.min(Math.max(1, day), days);

  // Everyone on the sheet, with the one code they hold on this day.
  const people = rows.map((x) => ({
    key: x.empId, name: x.name, empIdShown: x.empIdShown,
    tier: x.desig || 'No designation recorded',
    code: (grid[x.empId] || {})[d] || '',
    bucket: R.bucketOf((grid[x.empId] || {})[d]) || '',
  }));
  const inB = (b) => people.filter((p) => p.bucket === b);

  // A branch nobody is on is not drawn at all — an empty stub tells the reader nothing.
  const present = ROS_TREE_GROUPS.filter(([b]) => inB(b).length);
  const selB = present.some(([b]) => b === openB) ? openB : (present.length ? present[0][0] : '');
  const branch = selB ? inB(selB) : [];
  const tiers = [...new Set(branch.map((p) => p.tier))].sort((a, b) => rosTierRank(a) - rosTierRank(b) || a.localeCompare(b));
  const selD = tiers.indexOf(openD) >= 0 ? openD : (tiers[0] || '');
  const leaves = branch.filter((p) => p.tier === selD);
  const onDuty = people.filter((p) => p.bucket && p.bucket !== 'O').length;
  const tone = R.BUCKET_COLOR[selB] || ROS_LEAVE_TONE.OFF;

  /* ---- geometry ----
     Four columns of node centres, one row pitch, and every child column centred on its
     open parent — which is what makes it read as a tree rather than three lists. */
  const X = [190, 470, 730, 1000], W = 1360, PITCH = 30;
  const L1 = present.map(([b, label], i) => ({
    b, label, y: i * PITCH + PITCH / 2, color: R.BUCKET_COLOR[b] || ROS_LEAVE_TONE.OFF,
    on: b === selB, n: inB(b).length,
  }));
  let rootY = (present.length * PITCH) / 2;
  const bNode = L1.find((n) => n.on) || { y: rootY };
  const L2 = tiers.map((t, i) => ({
    t, y: bNode.y - (tiers.length * PITCH) / 2 + i * PITCH + PITCH / 2,
    on: t === selD, n: branch.filter((p) => p.tier === t).length,
  }));
  const dNode = L2.find((n) => n.on) || bNode;
  const L3 = leaves.map((p, i) => ({ p, y: dNode.y - (leaves.length * PITCH) / 2 + i * PITCH + PITCH / 2 }));

  // Centring a long child column on a short parent pushes it off the top of the stage,
  // so the whole drawing slides down until the highest node clears the edge.
  const allY = [rootY].concat(L1.map((n) => n.y), L2.map((n) => n.y), L3.map((n) => n.y));
  const slide = 34 - Math.min.apply(null, allY);
  const H = Math.max.apply(null, allY) + slide + 34;
  rootY += slide;
  [L1, L2, L3].forEach((L) => L.forEach((n) => { n.y += slide; }));
  const bY = (L1.find((n) => n.on) || { y: rootY }).y;
  const dY = (L2.find((n) => n.on) || { y: bY }).y;

  const curve = (x1, y1, x2, y2) => {
    const mx = (x1 + x2) / 2;
    return 'M' + x1 + ',' + y1 + ' C' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + x2 + ',' + y2;
  };
  const paths = [];
  L1.forEach((n) => paths.push({ d: curve(X[0] + 6, rootY, X[1] - 6, n.y), stroke: n.on ? n.color + 'b0' : 'rgba(125,145,180,.4)', w: n.on ? 1.7 : 1 }));
  L2.forEach((n) => paths.push({ d: curve(X[1] + 6, bY, X[2] - 6, n.y), stroke: n.on ? tone + 'b0' : 'rgba(125,145,180,.4)', w: n.on ? 1.7 : 1 }));
  L3.forEach((n) => paths.push({ d: curve(X[2] + 6, dY, X[3] - 5, n.y), stroke: 'rgba(125,145,180,.5)', w: 1 }));

  const crumbs = [dept + ' roster', (ROS_TREE_GROUPS.find((g) => g[0] === selB) || ['', ''])[1], selD].filter(Boolean);

  const navBtn = {
    display: 'inline-grid', placeItems: 'center', width: 28, height: 28, borderRadius: 8,
    border: '1px solid rgba(125,145,180,.35)', background: 'rgba(255,255,255,.7)', color: MK.BODY, cursor: 'pointer', flexShrink: 0,
  };
  const toolBtn = {
    display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid rgba(125,145,180,.35)',
    background: 'rgba(255,255,255,.7)', color: MK.BODY, padding: '6px 11px', borderRadius: 9,
    fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  };
  // A row on any level: right-aligned against its column, so the label always ends at
  // the node it belongs to.
  const rowStyle = (left, right, y, on, c) => ({
    position: 'absolute', left: left + 'px', top: (y - 17) + 'px', width: (right - left) + 'px', height: 34,
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '0 12px', boxSizing: 'border-box',
    borderRadius: 10, cursor: 'pointer', transition: 'all .15s',
    background: on ? 'linear-gradient(90deg,transparent,' + c + '1f)' : 'transparent',
    border: '1px solid ' + (on ? c + '3d' : 'transparent'),
  });
  const dotStyle = (x, y, on, c, size) => ({
    position: 'absolute', left: (x - size / 2) + 'px', top: (y - size / 2) + 'px', width: size, height: size,
    borderRadius: '50%', boxSizing: 'border-box', background: on ? c : '#fff', border: '2px solid ' + c,
    boxShadow: on ? '0 0 0 4px ' + c + '24' : 'none',
  });
  const countPill = (c) => ({
    fontFamily: MK.MONO, fontSize: 10, fontWeight: 700, color: c, background: c + '1a',
    padding: '2px 7px', borderRadius: 10, whiteSpace: 'nowrap',
  });

  return (
    <RosSubShell title={'Tree view — ' + dept} subName="tree" dept={dept} year={year} month={month} setRoute={setRoute} setSub={setSub}
      sub={R.MONTHS[month] + ' ' + year + ' · one day as a branch — shift, then designation, then nurse'}>
      {!sheet.doc ? <RosNotDrafted dept={dept} year={year} month={month} setSub={setSub} /> : (
        <div className="card">
          <div className="card-h" style={{ flexWrap: 'wrap' }}>
            <div style={MK.iconBadge('blue', 32)}><Ic d="M4 12h5M14 6h6M14 12h6M14 18h6M9 6v12M9 6h5M9 18h5" s={16} /></div>
            <div style={{ minWidth: 0 }}>
              <h3>Tree view — {d} {R.MONTHS[month]} {year} · {rosDow(year, month, d)}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: MK.MUTED, flexWrap: 'wrap' }}>
                {crumbs.map((c, i) => (
                  <React.Fragment key={c + i}>
                    <span>{c}</span>
                    {i < crumbs.length - 1 && <span style={{ color: '#b6c0cc' }}>›</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>
            <span style={{ flex: 1 }} />
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <button style={{ ...navBtn, opacity: d <= 1 ? .4 : 1 }} disabled={d <= 1} title="Previous day" onClick={() => setDay(Math.max(1, d - 1))}>
                <Ic d={I.chevR} s={13} sw={2.2} style={{ transform: 'rotate(180deg)' }} />
              </button>
              <select value={d} onChange={(e) => setDay(Number(e.target.value))}>
                {Array.from({ length: days }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n} {R.MONTHS[month].slice(0, 3)} · {rosDow(year, month, n)}</option>
                ))}
              </select>
              <button style={{ ...navBtn, opacity: d >= days ? .4 : 1 }} disabled={d >= days} title="Next day" onClick={() => setDay(Math.min(days, d + 1))}>
                <Ic d={I.chevR} s={13} sw={2.2} />
              </button>
              <button style={toolBtn} onClick={() => { setOpenB(''); setOpenD(''); }}>Reset branch</button>
            </div>
          </div>

          {present.length === 0 ? (
            <div className="card-b" style={{ display: 'grid', placeItems: 'center', padding: 34, textAlign: 'center', gap: 6 }}>
              <div style={{ opacity: .35 }}><Ic d={I.cal} s={30} /></div>
              <div style={{ fontWeight: 600 }}>Nothing is written against {d} {R.MONTHS[month]}</div>
              <div className="sub" style={{ maxWidth: 400 }}>
                No shift code is recorded for anyone in {dept} on this day, so the tree has no branches to draw. Pick another day, or fill the column in on the monthly grid.
              </div>
            </div>
          ) : (
            <div style={{ padding: '8px 12px 16px', overflowX: 'auto', display: 'flex' }}>
              <div style={{ position: 'relative', width: W, height: H, flexShrink: 0 }}>
                <svg viewBox={'0 0 ' + W + ' ' + H} style={{ position: 'absolute', inset: 0, width: W, height: H, pointerEvents: 'none' }}>
                  {paths.map((p, i) => <path key={i} d={p.d} fill="none" stroke={p.stroke} strokeWidth={p.w} />)}
                </svg>

                {/* root — the unit itself */}
                <div style={{
                  position: 'absolute', left: 0, top: (rootY - 20) + 'px', width: (X[0] - 16) + 'px', height: 40,
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '0 10px', boxSizing: 'border-box',
                }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: MK.INK, whiteSpace: 'nowrap' }}>{dept}</div>
                    <div className="num" style={{ fontSize: 10, color: '#8a97a8', whiteSpace: 'nowrap' }}>{onDuty} / {people.length} on duty</div>
                  </div>
                </div>
                <div style={{
                  position: 'absolute', left: (X[0] - 7) + 'px', top: (rootY - 7) + 'px', width: 14, height: 14, borderRadius: '50%',
                  boxSizing: 'border-box', background: '#0072a3', border: '2px solid #fff', boxShadow: '0 0 0 4px rgba(0,114,163,.18)',
                }} />

                {/* level 1 — shift buckets */}
                {L1.map((n) => (
                  <React.Fragment key={n.b}>
                    <div onClick={() => { setOpenB(n.b); setOpenD(''); }} style={rowStyle(0, X[1] - 16, n.y, n.on, n.color)}>
                      <span style={{ fontSize: 12.5, fontWeight: n.on ? 800 : 600, color: n.on ? n.color : MK.BODY, letterSpacing: .4, whiteSpace: 'nowrap' }}>{n.label}</span>
                      <span style={countPill(n.color)}>{n.n} {n.n === 1 ? 'nurse' : 'nurses'}</span>
                    </div>
                    <div style={dotStyle(X[1], n.y, n.on, n.color, 12)} />
                  </React.Fragment>
                ))}

                {/* level 2 — designation tiers inside the open shift */}
                {L2.map((n) => (
                  <React.Fragment key={n.t}>
                    <div onClick={() => setOpenD(n.t)} style={rowStyle(X[1] + 20, X[2] - 16, n.y, n.on, tone)}>
                      <span style={{ fontSize: 12, fontWeight: n.on ? 800 : 600, color: n.on ? tone : MK.BODY, whiteSpace: 'nowrap' }}>{n.t}</span>
                      <span style={countPill(tone)}>{n.n}</span>
                    </div>
                    <div style={dotStyle(X[2], n.y, n.on, tone, 12)} />
                  </React.Fragment>
                ))}

                {/* level 3 — the nurses themselves */}
                {L3.map((n) => (
                  <React.Fragment key={n.p.key}>
                    <div style={{
                      position: 'absolute', left: (X[3] + 16) + 'px', top: (n.y - 15) + 'px', display: 'flex', alignItems: 'center', gap: 9,
                      padding: '5px 12px', borderRadius: 10, background: 'rgba(255,255,255,.72)', border: '1px solid ' + tone + '2e',
                      boxShadow: '0 3px 10px rgba(31,59,90,.07)', whiteSpace: 'nowrap',
                    }}>
                      <div style={MK.av(n.p.name, 22)}>{MK.initials(n.p.name)}</div>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: MK.INK }}>{n.p.name}</span>
                      <span className="num" style={{ fontSize: 10, color: '#0072a3' }}>{n.p.empIdShown ? 'ID ' + n.p.empIdShown : 'no Emp-ID'}</span>
                      <span className="num" style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', background: tone, padding: '2px 8px', borderRadius: 7 }}>{n.p.code}</span>
                      <span className="num" style={{ fontSize: 10.5, color: MK.MUTED }}>{(R.BY_CODE[n.p.code] || {}).label || ''}</span>
                    </div>
                    <div style={dotStyle(X[3], n.y, false, tone, 10)} />
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          <div style={{
            padding: '10px 16px', borderTop: '1px solid ' + MK.LINE, display: 'flex', alignItems: 'center', gap: 9,
            flexWrap: 'wrap', background: 'rgba(247,251,255,.55)',
          }}>
            {ROS_DUTY.concat([{ id: 'O', label: 'Off / leave', color: ROS_LEAVE_TONE.OFF }]).map((b) => (
              <span key={b.id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 700, color: b.color,
                background: b.color + '18', border: '1px solid ' + b.color + '33', padding: '4px 10px', borderRadius: 12, whiteSpace: 'nowrap',
              }}>{b.label}</span>
            ))}
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 10.5, color: '#8a97a8' }}>Click a shift, then a designation — the branch drills down one level at a time.</span>
          </div>
        </div>
      )}
    </RosSubShell>
  );
}

/* ================= 9. COVERAGE & RULES ================= */
function RosterReview({ staffStore, dept, year, month, setRoute }) {
  const days = R.daysIn(year, month);
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState(R.DEFAULT_RULES);

  const staff = useMemo(() => (staffStore.staff || [])
    .filter((e) => e.is_active !== false && !e.former && (e.current_department || 'Unassigned') === dept)
    .map((e) => ({ empId: rosKey(e), empIdShown: e.emp_id || '', name: e.name, desig: e.designation })), [staffStore.staff, dept]);

  useEffect(() => {
    rosApi.get('/api/rosters/' + encodeURIComponent(dept) + '/' + year + '/' + month).then((r) => {
      const d = r && r.ok ? r.roster : null;
      setDoc(d);
      setRules(Object.assign({}, R.DEFAULT_RULES, (d && d.rules) || {}));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [dept, year, month]);

  const grid = rosMigrateGrid(doc && doc.grid, staff);
  const findings = useMemo(() => R.checkRules(grid, staff, year, month, rules), [grid, staff, year, month, rules]);
  const ids = staff.map((s) => s.empId);

  const away = useMemo(() => {
    const out = [];
    for (let d = 1; d <= days; d++) {
      const list = ids.filter((id) => R.isLeave(grid[id] && grid[id][d]));
      if (list.length) out.push({ day: d, list });
    }
    return out;
  }, [grid, ids, days]);

  if (loading) return <div style={{ display: 'grid', placeItems: 'center', height: '40vh', color: 'var(--muted,#8aa0b8)' }}>Loading…</div>;

  /* An undrafted month is not a badly-drafted one.

     Without this the screen ran the rule checks against an empty grid and presented a
     month nobody has written yet as a fully-breaching roster: 90-odd findings, "No one
     rostered on morning duty" for all 31 days, and — the line that matters — a
     Who-is-away panel reading "Nobody is on leave this month", which asserts something
     the system does not know. */
  if (!doc) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card">
          <div className="card-h" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => setRoute({ view: 'rosterGrid', dept, year, month })}>‹ Back to the grid</button>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 700 }}>Coverage &amp; rules — {dept}</div>
              <div className="sub">{R.MONTHS[month]} {year}</div>
            </div>
          </div>
        </div>
        <RosNotDrafted dept={dept} year={year} month={month} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card">
        <div className="card-h" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => setRoute({ view: 'rosterGrid', dept, year, month })}>‹ Back to the grid</button>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 700 }}>Coverage &amp; rules — {dept}</div>
            <div className="sub">{R.MONTHS[month]} {year} · {staff.length} staff</div>
          </div>
          <span className="tag num" style={{ color: findings.length ? '#e07a2a' : '#1f9d63' }}>{findings.length} finding(s)</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(280px,1fr)', gap: 14, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="card-h"><h3>Staff on each shift, per day</h3><div className="sub">red = uncovered · amber = below the minimum</div></div>
            <div className="card-b" style={{ overflow: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
                <thead><tr><th style={{ textAlign: 'left', padding: '4px 6px' }}>Shift</th>
                  {Array.from({ length: days }, (_, i) => i + 1).map((d) => <th key={d} style={{ width: 22, fontSize: 9.6 }}>{d}</th>)}</tr></thead>
                <tbody>
                  {['G', 'M', 'E', 'N'].map((b) => {
                    const key = b === 'M' ? 'minMorning' : b === 'E' ? 'minEvening' : b === 'N' ? 'minNight' : null;
                    const need = key ? (rules[key] || {}).value || 0 : 0;
                    return (
                      <tr key={b}>
                        <td style={{ padding: '4px 6px', fontWeight: 700, color: R.BUCKET_COLOR[b], whiteSpace: 'nowrap' }}>
                          {(R.BUCKETS.find((x) => x.id === b) || {}).label}{need ? ' (min ' + need + ')' : ''}
                        </td>
                        {Array.from({ length: days }, (_, k) => k + 1).map((d) => {
                          const n = R.coverageFor(grid, ids, d)[b];
                          const bad = key && n === 0, low = key && n > 0 && n < need;
                          return <td key={d} style={{
                            textAlign: 'center', fontSize: 9.8, fontWeight: 700, padding: '2px 0',
                            color: bad ? '#d23a52' : low ? '#e07a2a' : 'var(--muted,#8aa0b8)',
                            background: bad ? 'rgba(210,58,82,.14)' : low ? 'rgba(224,122,42,.12)' : undefined,
                          }}>{n}</td>;
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h3>Rule checks</h3><div className="sub">{findings.length ? 'every finding, in date order' : 'nothing to flag'}</div></div>
            <div className="card-b" style={{ maxHeight: 320, overflow: 'auto' }}>
              {findings.length === 0 ? (
                <div style={{ display: 'grid', placeItems: 'center', padding: 26, gap: 6, textAlign: 'center' }}>
                  <div style={{ color: '#1f9d63' }}><Ic d={I.check || I.doc} s={28} /></div>
                  <div style={{ fontWeight: 600 }}>Every rule passes</div>
                  <div className="sub">Coverage minimums, consecutive-duty limits and weekly rest are all satisfied.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {findings.map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 11.8, paddingBottom: 4, borderBottom: '1px solid var(--line,#f1f5f9)' }}>
                      <span className="tag num" style={{ minWidth: 38, textAlign: 'center' }}>{R.MONTHS[month].slice(0, 3)} {f.day}</span>
                      <span style={{ color: f.severity === 'high' ? '#d23a52' : f.severity === 'medium' ? '#e07a2a' : 'var(--muted,#8aa0b8)' }}>{f.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="card-h"><h3>Rule set</h3><div className="sub">switch off or retune any rule</div></div>
            <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {Object.keys(R.DEFAULT_RULES).map((k) => {
                const r = rules[k] || R.DEFAULT_RULES[k];
                return (
                  <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="checkbox" checked={!!r.on} onChange={(e) => setRules((s) => ({ ...s, [k]: { ...r, on: e.target.checked } }))} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11.6, fontWeight: 600 }}>{R.DEFAULT_RULES[k].label}</div>
                      <div className="sub" style={{ fontSize: 10.4 }}>{R.DEFAULT_RULES[k].unit}</div>
                    </div>
                    <button className="icon-btn" onClick={() => setRules((s) => ({ ...s, [k]: { ...r, value: Math.max(0, r.value - 1) } }))}>−</button>
                    <span className="num" style={{ minWidth: 18, textAlign: 'center', fontWeight: 700 }}>{r.value}</span>
                    <button className="icon-btn" onClick={() => setRules((s) => ({ ...s, [k]: { ...r, value: r.value + 1 } }))}>+</button>
                  </div>
                );
              })}
              <div className="sub" style={{ fontSize: 10.6, borderTop: '1px solid var(--line,#eef2f7)', paddingTop: 7 }}>
                Changes here apply immediately to the checks above. Save the roster from the grid to keep them with this unit's sheet.
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h3>Who is away</h3><div className="sub">{R.MONTHS[month]} {year} · leave only, not days off</div></div>
            <div className="card-b" style={{ maxHeight: 280, overflow: 'auto' }}>
              {away.length === 0 ? <div className="sub" style={{ textAlign: 'center', padding: 14 }}>Nobody is on leave this month.</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {away.map((a) => {
                    const over = a.list.length > ((rules.leaveClash || {}).value || 99);
                    return (
                      <div key={a.day} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 11.5 }}>
                        <span className="tag num" style={{ minWidth: 38, textAlign: 'center', color: over ? '#d23a52' : undefined }}>{R.MONTHS[month].slice(0, 3)} {a.day}</span>
                        <span className="sub">{a.list.map((id) => (staff.find((s) => s.empId === id) || {}).name).filter(Boolean).join(', ')}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= 10. PRINT ================= */
function RosterPrint({ staffStore, dept, year, month, setRoute }) {
  const days = R.daysIn(year, month);
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    rosApi.get('/api/rosters/' + encodeURIComponent(dept) + '/' + year + '/' + month)
      .then((r) => { setDoc(r && r.ok ? r.roster : null); setLoading(false); }).catch(() => setLoading(false));
  }, [dept, year, month]);

  const staff = useMemo(() => (staffStore.staff || [])
    .filter((e) => e.is_active !== false && !e.former && (e.current_department || 'Unassigned') === dept)
    .map((e) => ({ empId: rosKey(e), empIdShown: e.emp_id || '', name: e.name, desig: e.designation })), [staffStore.staff, dept]);

  const order = (doc && doc.order) || [];
  const rows = useMemo(() => {
    if (!order.length) return staff;
    const by = {}; staff.forEach((s) => { by[s.empId] = s; });
    const out = []; const seen = {};
    order.forEach((id) => { if (by[id] && !seen[id]) { out.push(by[id]); seen[id] = 1; } });
    staff.forEach((s) => { if (!seen[s.empId]) out.push(s); });
    return out;
  }, [staff, order]);

  if (loading) return <div style={{ display: 'grid', placeItems: 'center', height: '40vh', color: 'var(--muted,#8aa0b8)' }}>Loading…</div>;
  const grid = rosMigrateGrid(doc && doc.grid, staff);
  const sig = (window.unicoSig && window.unicoSig.get && window.unicoSig.get()) || {};
  const cell = { border: '1px solid #333', padding: '2px 3px', fontSize: 8.6, textAlign: 'center' };

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-b" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => setRoute({ view: 'rosterGrid', dept, year, month })}>‹ Back to the grid</button>
          <div style={{ flex: 1 }} />
          <span className="sub">1:1 with the roster workbook</span>
          <button className="btn pri" onClick={() => window.print()}>Print / Save as PDF</button>
        </div>
      </div>

      <div id="pdf-root" style={{ background: '#fff', color: '#111', padding: '16px 18px', borderRadius: 8, overflow: 'auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Duty Roster For {dept}</div>
          <div style={{ fontSize: 11 }}>{R.MONTHS[month]} {year}{doc ? ' · revision ' + (doc.revision || 1) + ' · ' + (ROS_STATUS[doc.status] || ROS_STATUS.draft).label : ' · not yet drafted'}</div>
        </div>

        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...cell, background: '#eef2f7', width: 22 }}>S/N</th>
              <th style={{ ...cell, background: '#eef2f7', width: 52 }}>EMP-ID</th>
              <th style={{ ...cell, background: '#eef2f7', textAlign: 'left', minWidth: 120 }}>Staff Name</th>
              <th style={{ ...cell, background: '#eef2f7', textAlign: 'left', minWidth: 84 }}>Designation</th>
              {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
                const dt = new Date(year, month, d);
                return <th key={d} style={{ ...cell, background: dt.getDay() === 5 ? '#e6ebf2' : '#eef2f7', width: 15 }}>{d}</th>;
              })}
              {['G', 'M', 'E', 'N', 'O'].map((b) => <th key={b} style={{ ...cell, background: '#eef2f7', width: 16 }}>{b}</th>)}
              <th style={{ ...cell, background: '#eef2f7', width: 26 }}>Hours</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => {
              const row = grid[s.empId] || {};
              const t = R.totalsFor(row, days);
              return (
                <tr key={s.empId}>
                  <td style={cell}>{i + 1}</td>
                  <td style={cell}>{s.empIdShown || '—'}</td>
                  <td style={{ ...cell, textAlign: 'left' }}>{s.name}</td>
                  <td style={{ ...cell, textAlign: 'left' }}>{s.desig || ''}</td>
                  {Array.from({ length: days }, (_, k) => k + 1).map((d) => <td key={d} style={cell}>{row[d] || ''}</td>)}
                  {['G', 'M', 'E', 'N', 'O'].map((b) => <td key={b} style={cell}>{t[b] || ''}</td>)}
                  <td style={{ ...cell, fontWeight: 700 }}>{t.hours || ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ marginTop: 10, fontSize: 8.6 }}>
          <b>NB:</b> Do not make changes without permission from the authorised person.
        </div>
        <div style={{ marginTop: 8, fontSize: 8.4 }}><ShiftLegend compact /></div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24, marginTop: 34, fontSize: 10 }}>
          {[['Prepared By', doc && doc.preparedBy || sig.prepared], ['Checked By', doc && doc.checkedBy || sig.checked], ['Approved By', doc && doc.approvedBy || sig.approved]].map(([l, n]) => (
            <div key={l} style={{ borderTop: '1px solid #333', paddingTop: 4 }}>
              <div style={{ fontWeight: 700 }}>{l}</div>
              <div>{n || ''}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================= root ================= */
function RosterView({ view, dept, year, month, setRoute }) {
  const staffStore = window.useStaffStore();
  const index = useRosterIndex();
  const now = new Date();
  const y = Number(year) || now.getFullYear();
  const m = Number.isInteger(Number(month)) ? Number(month) : now.getMonth();

  // Which companion screen of the grid is showing, and the day the calendar handed to
  // the day view. Held here, not in the route, so the shell keeps highlighting the
  // Duty Roster workspace (see ROS_TABS).
  const [sub, setSub] = useState('');
  const [focusDay, setFocusDay] = useState(0);
  useEffect(() => { if (view !== 'rosterGrid') setSub(''); }, [view]);

  const inner = (() => {
  if (view !== 'rosterHome' && !dept) return <RosterHome index={index} staffStore={staffStore} setRoute={setRoute} />;
  if (view === 'rosterGrid' && sub) {
    const p = { staffStore, dept, year: y, month: m, setRoute, setSub };
    switch (sub) {
      case 'week': return <RosterWeek {...p} />;
      case 'day': return <RosterDay {...p} focusDay={focusDay} />;
      case 'staff': return <RosterStaff {...p} />;
      case 'leave': return <RosterLeave {...p} />;
      case 'calendar': return <RosterCalendar {...p} setFocusDay={setFocusDay} />;
      case 'tree': return <RosterTree {...p} />;
      default: break;
    }
  }
  switch (view) {
    case 'rosterGrid': return <RosterGrid staffStore={staffStore} dept={dept} year={y} month={m} setRoute={setRoute} setSub={setSub} onSaved={index.reload} />;
    case 'rosterReview': return <RosterReview staffStore={staffStore} dept={dept} year={y} month={m} setRoute={setRoute} />;
    case 'rosterPrint': return <RosterPrint staffStore={staffStore} dept={dept} year={y} month={m} setRoute={setRoute} />;
    default: return <RosterHome index={index} staffStore={staffStore} setRoute={setRoute} />;
  }
  })();
  return <div className="mk-scope">{inner}</div>;
}

window.RosterView = RosterView;
