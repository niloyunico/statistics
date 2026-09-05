/* UNICO — Roster full review (renderer).
 *
 * The administrator's cross-unit read of one month's duty rosters, built from
 * `ui/Performance module UI mockups/Roster Full Review.dc.html`. Five screens, in the
 * mockup's own order:
 *
 *   Review Header      title, scope, the pending chip and the KPI strip
 *   Workload Tree      Division > Unit > Staff, with per-level aggregates
 *   Hospital Diagram   every unit as a zone: who is on the chosen shift, that day
 *   Unit Review Queue  the cross-unit table, with Approve / Return
 *   Audit Trail        the stamps the roster store actually keeps (see below)
 *
 * WHY THIS IS A SEPARATE SCREEN FROM roster.jsx's `rosterReview`
 * That one is a single unit's coverage-and-rules sheet. This one is the hospital: it
 * loads the whole month across every unit at once and is the screen a decision is made
 * on. Neither replaces the other, and this file does not touch roster.jsx.
 *
 * WHERE THE NUMBERS COME FROM
 *   GET /api/rosters                       the index — one row per unit-month, no grid
 *   GET /api/rosters/:dept/:year/:month    one sheet, with the grid
 *   window.useStaffStore()                 the nurse register, filtered per unit
 *   window.UNICO_ROSTER                    totalsFor / coverageFor / checkRules / daysIn
 * Nothing is invented. Where the mockup showed a figure this app does not hold — bed
 * counts, a float pool, per-change history — the panel says so in words instead of
 * showing a number that would be a guess. Each deviation is commented where it happens.
 *
 * Published as window.RosterReviewFull (every bundled file is its own IIFE).
 */

const { useState, useEffect, useMemo, useRef, useCallback } = React;
const Ic = window.Ic, I = window.I;
const R = window.UNICO_ROSTER;
const MK = window.MK;

const rrApi = {
  get: (u) => fetch(u, { headers: { accept: 'application/json' } }).then((r) => r.json()),
  post: (u, b) => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b || {}) }).then((r) => r.json()),
};
const rrToast = (m, t) => { try { window.UI && window.UI.toast && window.UI.toast(m, t || 'success'); } catch (e) {} };
// Approving or returning a sheet is a write on someone else's unit, so it needs the
// roster module's own edit right AND administrator rank — the same pair the server
// enforces on POST /api/rosters/:id/status.
const rrCanDecide = () => {
  let edit = true, admin = true;
  try { edit = window.unicoCan ? window.unicoCan('roster', 'edit') : true; } catch (e) { edit = true; }
  try { const u = window.__UNICO_USER__; admin = !u || u.role === 'Administrator'; } catch (e) { admin = true; }
  return edit && admin;
};

/* ---- the division taxonomy ---------------------------------------------
   The mockup groups units into Critical Care / Maternal & Neonatal / Acute & Peri-op.
   This app has no such field: staff carry a free-text `current_department` and the
   roster is keyed on that string. So divisions are DERIVED here, by matching the
   department's own words, and anything that does not match lands in "Other" — a unit
   is never dropped just because it does not fit the mockup's three groups. This is a
   presentation grouping only; nothing is written back. */
const RR_DIVS = [
  { id: 'cc', label: 'Critical Care', color: '#0090ca' },
  { id: 'mn', label: 'Maternal & Neonatal', color: '#3ab5a7' },
  { id: 'ac', label: 'Acute & Peri-op', color: '#6a52d4' },
  { id: 'other', label: 'Other', color: '#5b6b80' },
];
const RR_DIV_BY = {};
RR_DIVS.forEach((d) => { RR_DIV_BY[d.id] = d; });
const RR_DIV_ICON = { cc: 'pulse', mn: 'heart', ac: 'syringe', other: 'bed' };

function rrDivisionOf(dept) {
  const name = String(dept || '').toUpperCase();
  const tok = name.split(/[^A-Z0-9]+/).filter(Boolean);
  const has = (w) => tok.indexOf(w) >= 0;
  const says = (w) => name.indexOf(w) >= 0;
  // Neonatal and labour first: NICU contains "ICU" and would otherwise read as critical care.
  if (has('NICU') || has('LDR') || says('NEONAT') || says('LABOUR') || says('LABOR') || says('DELIVERY') || says('MATERNITY') || says('OBSTETRIC')) return 'mn';
  if (has('ICU') || has('SICU') || has('MICU') || has('CCU') || has('ITU') || has('HDU') || says('CRITICAL') || says('INTENSIVE')) return 'cc';
  if (has('ER') || has('OT') || has('OR') || says('EMERGENC') || says('THEATRE') || says('THEATER') || says('OPERAT') || says('CATH') || says('ENDOSCOP') || says('RECOVERY') || says('ANAESTH') || says('ANESTH')) return 'ac';
  return 'other';
}

/* ---- roster helpers ----------------------------------------------------- */

/* The key a roster row is stored under — the staff record's own id, NOT the employee
   number: two pairs of serving staff share one and 39 people have none. Identical to
   roster.jsx's rosKey; repeated here because each bundled file is its own scope. */
const rrKey = (e) => 'S' + String(e.id);

// Sheets saved before rows were keyed on the staff id hold their grid under employee
// NUMBERS. Remap on read so an older month still totals correctly; anything unmatched
// is kept as-is so a nurse who has since left does not vanish from a published month.
const rrMigrateGrid = (grid, rows) => {
  const g = grid || {};
  const keys = Object.keys(g);
  if (!keys.length) return g;
  const current = {};
  rows.forEach((r) => { current[r.empId] = 1; });
  if (keys.every((k) => current[k])) return g;
  const byEmpNo = {};
  rows.forEach((r) => { if (r.empIdShown) byEmpNo[String(r.empIdShown)] = r.empId; });
  const out = {};
  keys.forEach((k) => { out[byEmpNo[k] || k] = g[k]; });
  return out;
};

// The minimum this unit expects on a duty bucket, per its OWN saved rule set — never a
// number invented on this screen.
const rrNeed = (rules, b) => {
  const r = rules[b === 'M' ? 'minMorning' : b === 'E' ? 'minEvening' : b === 'N' ? 'minNight' : ''];
  return (r && r.on && r.value) || 0;
};

/* A full month of duty, in hours, for ONE person — the denominator every workload
   percentage on this screen divides by.

   The mockup divided by a flat 210 h. That number is not in this system, so it is
   derived instead from things that are: the roster legend's standard 8-hour duty, and
   the unit's own "minimum days off per week" rule. A 31-day month with one day off a
   week is 26 duty days = 208 h. Retune the rule on the unit's sheet and this follows. */
function rrStandardHours(rules, days) {
  const off = rules && rules.weeklyOff && rules.weeklyOff.on ? rules.weeklyOff.value : 0;
  return 8 * Math.max(1, days - Math.ceil(days / 7) * off);
}

// The mockup's own workload ramp, kept because it is a colour rule rather than data.
const rrLoadColor = (p) => (p >= 92 ? '#d23a52' : p >= 82 ? '#e08a1e' : p >= 55 ? '#157a43' : '#0090ca');
const rrBar = (pct, color) => ({
  display: 'block', height: '100%', width: Math.max(3, Math.min(100, pct || 0)) + '%', borderRadius: 3,
  background: 'linear-gradient(90deg,' + color + '99,' + color + ')', animation: MK.ANIM,
});
const rr1 = (n) => (Math.round((n || 0) * 10) / 10).toFixed(1);
const rrFirst = (n) => String(n || '').split(/\s+/)[0] || '—';
const rrWhen = (ts) => (ts ? new Date(ts).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

const RR_STATUS = {
  draft: { label: 'Draft', c: '#b5670a', bg: 'rgba(224,138,30,.14)' },
  submitted: { label: 'Submitted', c: '#0072a3', bg: 'rgba(0,144,202,.12)' },
  approved: { label: 'Approved', c: '#157a43', bg: 'rgba(21,122,67,.13)' },
  none: { label: 'Not drafted', c: '#6c7a8c', bg: 'rgba(125,145,180,.14)' },
};
const rrStatusChip = (st) => {
  const t = RR_STATUS[st] || RR_STATUS.none;
  return { fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 12, whiteSpace: 'nowrap', color: t.c, background: t.bg };
};

// The corridor figure's animation. Injected from here rather than mockup-ui.js because
// it belongs to this one screen; MK owns everything shared.
function rrInjectCss() {
  if (typeof document === 'undefined' || document.getElementById('rr-style')) return;
  const el = document.createElement('style');
  el.id = 'rr-style';
  el.textContent = [
    '@keyframes rrBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.5px)}}',
    '@keyframes rrLegA{0%,100%{transform:rotate(17deg)}50%{transform:rotate(-17deg)}}',
    '@keyframes rrLegB{0%,100%{transform:rotate(-17deg)}50%{transform:rotate(17deg)}}',
    '@keyframes rrArmA{0%,100%{transform:rotate(-15deg)}50%{transform:rotate(15deg)}}',
    '@keyframes rrArmB{0%,100%{transform:rotate(15deg)}50%{transform:rotate(-15deg)}}',
    '@keyframes rrDash{to{stroke-dashoffset:-60}}',
    '@keyframes rrPop{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
  ].join('');
  document.head.appendChild(el);
}

/* ---- data ---------------------------------------------------------------- */

// The index: every unit-month ever saved, without its grid. Status, revision and the
// created/updated/approved stamps all come from here.
function useRosterIndex() {
  const [state, setState] = useState({ rosters: [], loading: true, error: null });
  const load = useCallback(() => rrApi.get('/api/rosters').then((r) => {
    if (r && r.ok) setState({ rosters: r.rosters || [], loading: false, error: null });
    else setState((s) => ({ ...s, loading: false, error: (r && r.error) || 'Could not load rosters.' }));
  }).catch(() => setState((s) => ({ ...s, loading: false, error: 'Could not reach the server.' }))), []);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

/* Every saved sheet for one month, fetched in parallel.
   Only units the index says have a sheet are fetched — asking for the other twenty
   would be twenty round trips guaranteed to return null. A request counter drops the
   answers to a month the user has already navigated away from. */
function useMonthSheets(index, year, month) {
  const [sheets, setSheets] = useState({});
  const [loading, setLoading] = useState(true);
  const req = useRef(0);
  const depts = useMemo(
    () => (index.rosters || []).filter((r) => r.year === year && r.month === month).map((r) => r.dept),
    [index.rosters, year, month]
  );
  const sig = depts.join('|');

  useEffect(() => {
    if (index.loading) return;
    const mine = ++req.current;
    if (!depts.length) { setSheets({}); setLoading(false); return; }
    // Drop the previous month's sheets BEFORE fetching. Keeping them meant a render
    // during the fetch paired the new month's index entries and day count with the old
    // month's grids, so the header briefly showed last month's figures under this
    // month's title. An empty map renders as "loading", which is the truth.
    setSheets({});
    setLoading(true);
    Promise.all(depts.map((d) => rrApi
      .get('/api/rosters/' + encodeURIComponent(d) + '/' + year + '/' + month)
      .then((r) => (r && r.ok ? r.roster : null))
      .catch(() => null)))
      .then((list) => {
        if (req.current !== mine) return;
        const m = {};
        list.forEach((doc, i) => { if (doc) m[depts[i]] = doc; });
        setSheets(m);
        setLoading(false);
      });
  }, [sig, year, month, index.loading]);          // eslint-disable-line react-hooks/exhaustive-deps

  return { sheets, loading: loading || index.loading };
}

/* One unit, fully worked out for the month: rows, hours, workload, coverage per day,
   rule findings. Everything the four screens below read comes from this object. */
function rrUnitModel(dept, entry, doc, staffRows, year, month, otLimit) {
  const days = R.daysIn(year, month);
  const rules = Object.assign({}, R.DEFAULT_RULES, (doc && doc.rules) || {});
  const grid = rrMigrateGrid((doc && doc.grid) || {}, staffRows);

  // Row order: the order the sheet was saved in first, then anyone new on the register.
  const by = {}; staffRows.forEach((s) => { by[s.empId] = s; });
  const rows = []; const seen = {};
  ((doc && doc.order) || []).forEach((id) => { if (by[id] && !seen[id]) { rows.push(by[id]); seen[id] = 1; } });
  staffRows.forEach((s) => { if (!seen[s.empId]) { rows.push(s); seen[s.empId] = 1; } });
  // A grid row with no matching staff record is somebody who has left the register
  // since the sheet was written. The sheet denormalises their name, so show them with
  // it rather than dropping duty hours that were really worked.
  Object.keys(grid).forEach((k) => {
    if (seen[k]) return;
    rows.push({ empId: k, empIdShown: '', name: (doc && doc.names && doc.names[k]) || k, desig: '', offRegister: true });
    seen[k] = 1;
  });

  const std = rrStandardHours(rules, days);
  const people = rows.map((s) => {
    const t = R.totalsFor(grid[s.empId], days);
    const duty = t.G + t.M + t.E + t.N;
    // The bucket this person mostly works, used for their colour in the tree.
    let main = null;
    if (duty) main = ['M', 'E', 'N', 'G'].reduce((a, b) => (t[b] > t[a] ? b : a), 'M');
    return {
      ...s, totals: t, hours: t.hours, duty, bucket: main,
      load: std ? Math.round((t.hours / std) * 100) : 0,
      over: t.hours > otLimit,
    };
  });

  const ids = rows.map((s) => s.empId);
  const covByDay = [];
  for (let d = 1; d <= days; d++) covByDay.push(R.coverageFor(grid, ids, d));

  const need = { M: rrNeed(rules, 'M'), E: rrNeed(rules, 'E'), N: rrNeed(rules, 'N') };
  const avgCov = {}; const shortDays = {};
  ['M', 'E', 'N'].forEach((b) => {
    avgCov[b] = days ? covByDay.reduce((a, c) => a + c[b], 0) / days : 0;
    shortDays[b] = need[b] ? covByDay.filter((c) => c[b] < need[b]).length : 0;
  });

  const hours = people.reduce((a, p) => a + p.hours, 0);
  const rostered = people.filter((p) => p.duty > 0);

  return {
    dept, name: (entry && entry.deptName) || dept, div: rrDivisionOf(dept),
    entry: entry || null, doc: doc || null, drafted: !!doc,
    status: (entry && entry.status) || null,
    rules, grid, days, std, rows: people, rostered,
    covByDay, need, avgCov, shortDays,
    hours, load: std && people.length ? Math.round((hours / people.length / std) * 100) : 0,
    overCount: people.filter((p) => p.over).length,
    findings: doc ? R.checkRules(grid, rows, year, month, rules) : [],
  };
}

/* ================= 1. REVIEW HEADER ================= */
function RRHeader({ month, year, units, staffTotal, scope, setScope, pending, otLimit, setOtLimit, otRaw, setOtRaw, onApproveAll, busy, canDecide, months, years, setMonth, setYear }) {
  return (
    <div className="card" style={{ position: 'relative', overflow: 'hidden', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <span style={{ display: 'inline-grid', placeItems: 'center', width: 44, height: 44, borderRadius: 13, background: 'rgba(106,82,212,.15)', color: '#5b45c4', flexShrink: 0 }}>
        <Ic d={I.grid} s={21} />
      </span>
      <div style={{ minWidth: 230 }}>
        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.2px', color: MK.INK }}>Roster full review — Administrator</div>
        <div style={{ fontSize: 12, color: MK.MUTED, marginTop: 2 }}>
          {R.MONTHS[month]} {year} · {units} units · {staffTotal} staff · workload balanced before CNS sign-off
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} title="Which month to review">
          {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} title="Which year to review">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={scope} onChange={(e) => setScope(e.target.value)} title="Divisions are derived from each unit's name — see the workload tree">
          {['All divisions'].concat(RR_DIVS.map((d) => d.label)).map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: MK.MUTED }}
          title="Anyone rostered more than this many paid hours in the month is flagged. Defaults to a full month of 8-hour duties with the unit's own weekly day off.">
          Overtime over
          <input type="number" min="40" max="400" step="4" value={otRaw} style={{ width: 66 }}
            onChange={(e) => {
              // Keep what was typed. Coercing on every keystroke turned an empty field
              // into 1, which relabelled the tile "Over 1 h this month" and flagged
              // every nurse with a single duty code as over the limit.
              const v = e.target.value;
              setOtRaw(v);
              const n = Number(v);
              if (v !== '' && Number.isFinite(n) && n > 0) setOtLimit(n);
            }}
            onBlur={() => setOtRaw(String(otLimit))} />
          h
        </label>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: '#b5670a', background: 'rgba(224,138,30,.14)', border: '1px solid rgba(224,138,30,.3)', padding: '6px 12px', borderRadius: 16 }}>
          {pending} awaiting decision
        </span>
        <button className="btn" disabled={!canDecide || busy || !pending} onClick={onApproveAll}
          title={canDecide ? 'Approve every drafted sheet in the current scope' : 'Approving a roster needs administrator access'}
          style={{ border: '1px solid rgba(21,122,67,.3)', background: 'linear-gradient(160deg,#1c8f52,#157a43)', color: '#fff', fontWeight: 700 }}>
          <Ic d={I.check} s={14} />Approve all units
        </button>
      </div>
    </div>
  );
}

/* The KPI strip. Six tiles, in the mockup's order, each one titled with the arithmetic
   behind it — two of the mockup's six counted things this app does not have (a float
   pool, and a "deployed" flag), so those two count the real equivalents instead. */
function RRKpis({ tiles }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(158px,1fr))', gap: 12 }}>
      {tiles.map((k) => (
        <div key={k.lbl} className="card" style={{ padding: '13px 15px' }} title={k.why}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'inline-grid', placeItems: 'center', width: 34, height: 34, borderRadius: 10, flexShrink: 0, color: k.c, background: k.c + '1c' }}>
              <Ic d={k.icon} s={16} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="num" style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.15, color: MK.INK }}>{k.val}</div>
              <div style={{ fontSize: 10.5, color: MK.MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.lbl}</div>
            </div>
          </div>
          <div style={{ marginTop: 9, height: 4, borderRadius: 3, background: 'rgba(125,145,180,.18)', overflow: 'hidden' }}>
            <div style={rrBar(k.pct, k.c)} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ================= 2. WORKLOAD TREE ================= */
function RRTree({ divisions, open, setOpen, q, setQ, matchLabel, sel, setSel, selUnit, setSelUnit, inScope, unrostered, bucket }) {
  const expandAll = () => {
    const o = {};
    divisions.forEach((d) => { o[d.id] = true; d.units.forEach((u) => { o[u.dept] = true; }); });
    setOpen(o);
  };

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="card-h" style={{ flexWrap: 'wrap' }}>
        <h3>Workload tree</h3>
        <span style={{ flex: 1 }} />
        <button className="btn" style={{ padding: '5px 9px', fontSize: 10.5, fontWeight: 700 }} onClick={expandAll}>Expand</button>
        <button className="btn" style={{ padding: '5px 9px', fontSize: 10.5, fontWeight: 700 }} onClick={() => setOpen({})}>Collapse</button>
      </div>

      <div style={{ padding: '9px 15px', borderBottom: '1px solid ' + MK.LINE, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(247,251,255,.55)' }}>
        <Ic d={I.search} s={14} c="#9aa6b4" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a nurse or unit…"
          style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', padding: 0, fontSize: 12 }} />
        <span className="num" style={{ fontSize: 10.5, color: MK.FAINT }}>{matchLabel}</span>
      </div>

      <div style={{ maxHeight: 552, overflowY: 'auto', padding: '8px 10px 10px' }}>
        {divisions.map((d) => {
          const on = !!open[d.id];
          // load is null when the division has no drafted unit at all: there is nothing
          // to average, and printing 0% would read as "nobody worked".
          const c = d.load == null ? MK.FAINT : rrLoadColor(d.load);
          const dim = !inScope(d.id);
          return (
            <div key={d.id} style={{ marginBottom: 6, opacity: dim ? .5 : 1 }}>
              <div onClick={() => setOpen({ ...open, [d.id]: !on })}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 10, cursor: 'pointer', background: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.9)' }}>
                <span style={{ flexShrink: 0, color: '#7d8ea8', display: 'grid', transform: on ? 'rotate(90deg)' : 'none', transition: 'transform .18s' }}><Ic d={I.chevR} s={13} sw={2.4} /></span>
                <span style={{ width: 8, height: 8, borderRadius: 3, background: d.color, flexShrink: 0, boxShadow: '0 0 0 3px ' + d.color + '26' }} />
                <span style={{ fontSize: 12.5, fontWeight: 700, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: MK.INK }}>{d.label}</span>
                <span className="num" style={{ fontSize: 10.5, color: MK.MUTED }}>{d.staff} staff</span>
                <span className="num" title={d.undrafted ? d.undrafted + ' unit(s) in this division have no roster for this month' : ''} style={{ fontSize: 10, fontWeight: 700, color: c, background: c + '1c', padding: '2px 6px', borderRadius: 6 }}>{d.load == null ? 'not drafted' : d.load + '%'}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, margin: '2px 8px 0 30px', fontSize: 9.6, color: MK.FAINT }}>
                <span className="num">{d.on}/{d.need} on {bucket.label.toLowerCase()}</span>
                <span style={{ flex: 1 }} />
                <span className="num">{d.hours} h total</span>
              </div>
              <div style={{ height: 3, margin: '3px 8px 0 30px', borderRadius: 2, background: 'rgba(125,145,180,.16)', overflow: 'hidden' }}><div style={rrBar(d.load || 0, c)} /></div>

              {on && (
                <div style={{ padding: '5px 0 2px 14px', display: 'flex', flexDirection: 'column', gap: 3, borderLeft: '1px dashed rgba(125,145,180,.35)', margin: '5px 0 0 15px' }}>
                  {d.units.map((u) => {
                    const uOpen = !!open[u.dept] || (q && u.hits.length > 0);
                    const uc = rrLoadColor(u.load);
                    const gap = u.on - u.needShift;
                    const tone = gap < 0 ? '#d23a52' : gap > 0 ? '#0090ca' : '#157a43';
                    return (
                      <div key={u.dept}>
                        <div onClick={() => setSelUnit(u.dept)}
                          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', borderRadius: 9, cursor: 'pointer', background: selUnit === u.dept ? 'rgba(0,144,202,.13)' : 'transparent', border: '1px solid ' + (selUnit === u.dept ? 'rgba(0,144,202,.35)' : 'transparent') }}>
                          <span onClick={(e) => { e.stopPropagation(); setOpen({ ...open, [u.dept]: !open[u.dept] }); }}
                            style={{ display: 'grid', placeItems: 'center', width: 16, height: 16, borderRadius: 5, flexShrink: 0, color: '#7d8ea8', transform: uOpen ? 'rotate(90deg)' : 'none', transition: 'transform .18s' }}>
                            <Ic d={I.chevR} s={11} sw={2.6} />
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: MK.INK }}>{u.name}</span>
                          <span className="num" title={u.drafted ? u.on + ' of ' + u.needShift + ' required on the ' + bucket.label.toLowerCase() + ' shift' : 'No sheet saved for this month'}
                            style={{ fontSize: 9.5, fontWeight: 700, color: u.drafted ? tone : MK.FAINT, background: (u.drafted ? tone : '#8aa0b8') + '1c', padding: '2px 6px', borderRadius: 6, flexShrink: 0 }}>
                            {u.drafted ? u.on + '/' + u.needShift : '—'}
                          </span>
                          {/* A unit with no sheet has no workload, not a workload of zero. */}
                          <span className="num" title={u.drafted ? '' : 'No sheet saved for this month'} style={{ fontSize: 10, color: MK.FAINT }}>{u.drafted ? u.load + '%' : 'not drafted'}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, margin: '1px 8px 0 34px', fontSize: 9.4, color: MK.FAINT }}>
                          <span className="num">{u.staff} staff</span>
                          <span style={{ flex: 1 }} />
                          <span className="num">{u.hours} h</span>
                        </div>
                        <div style={{ height: 3, margin: '3px 8px 0 34px', borderRadius: 2, background: 'rgba(125,145,180,.16)', overflow: 'hidden' }}><div style={rrBar(u.load, uc)} /></div>

                        {uOpen && (
                          <div style={{ padding: '5px 0 6px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {(q ? u.hits : u.rows).length === 0 && (
                              <div style={{ fontSize: 10.5, color: MK.FAINT, padding: '2px 6px' }}>
                                {q ? 'Nobody in this unit matches.' : 'No nurse on the register is assigned to this unit.'}
                              </div>
                            )}
                            {(q ? u.hits : u.rows).map((s) => {
                              const isSel = sel === s.empId;
                              const bc = s.bucket ? R.BUCKET_COLOR[s.bucket] : '#8aa0b8';
                              return (
                                <div key={s.empId} onClick={() => setSel(isSel ? null : s.empId)}
                                  title={s.name + ' — ' + (s.desig || 'designation not recorded') + ' · ' + s.duty + ' duty days · ' + s.hours + ' h this month' + (s.over ? ' (over the overtime limit)' : '')}
                                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 8px', borderRadius: 9, cursor: 'pointer', border: '1px solid ' + (isSel ? 'rgba(0,144,202,.55)' : 'rgba(125,145,180,.22)'), background: isSel ? 'rgba(0,144,202,.12)' : 'rgba(255,255,255,.72)' }}>
                                  <MK.Av name={s.name} empId={s.empId} size={22} radius={7} />
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: MK.INK }}>{s.name}</div>
                                    <div style={{ fontSize: 9.5, color: MK.FAINT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {(s.desig || '—') + ' · ' + (s.empIdShown || (s.offRegister ? 'off the register' : 'no employee no.'))}
                                    </div>
                                  </div>
                                  <span className="num" style={{ fontSize: 9.5, fontWeight: 700, color: bc, background: bc + '1f', padding: '2px 5px', borderRadius: 5, flexShrink: 0 }}>{s.bucket || '—'}</span>
                                  <span className="num" style={{ fontSize: 9.5, fontWeight: 700, color: s.over ? '#a92c42' : MK.FAINT, flexShrink: 0 }}>{s.hours}h</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* The mockup ends the tree with a drag-and-drop "float pool". This app has no
          float pool and no way to redeploy a nurse from this screen — a unit is the
          staff record's own department. The honest equivalent of "who is spare" is
          who has no duty at all on their unit's sheet, so that is what this shows. */}
      <div style={{ padding: '12px 15px 14px', borderTop: '1px solid ' + MK.LINE, background: 'linear-gradient(180deg,rgba(58,181,167,.09),rgba(255,255,255,.4))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Ic d={I.user} s={14} c="#3ab5a7" />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.8px', textTransform: 'uppercase', color: '#7d8ea8' }}>Not on this month's sheet</span>
          <span style={{ flex: 1 }} />
          <span className="num" style={{ fontSize: 11, fontWeight: 700, color: '#2c8f83' }}>{unrostered.length} nurses</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {unrostered.slice(0, 60).map((s) => (
            <span key={s.empId} onClick={() => setSel(sel === s.empId ? null : s.empId)} title={s.name + ' · ' + (s.desig || '—') + ' · ' + s.unitName + ' · no duty code entered for this month'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 7, cursor: 'pointer', whiteSpace: 'nowrap', color: '#1f6f66', background: 'rgba(255,255,255,.9)', border: '1px solid ' + (sel === s.empId ? 'rgba(58,181,167,.8)' : 'rgba(58,181,167,.35)') }}>
              {s.name}
            </span>
          ))}
          {unrostered.length === 0 && <span style={{ fontSize: 10.5, color: MK.FAINT }}>Everyone in scope has duty on their unit's sheet.</span>}
          {unrostered.length > 60 && <span style={{ fontSize: 10.5, color: MK.FAINT }}>+{unrostered.length - 60} more</span>}
        </div>
      </div>
    </div>
  );
}

/* ================= 3. HOSPITAL DIAGRAM ================= */

// One zone = one unit, read on the chosen day and shift.
function RRZone({ u, bucket, day, sel, selUnit, setSelUnit, setSel, inScope }) {
  const cov = u.drafted ? u.covByDay[day - 1] : null;
  const on = cov ? cov[bucket.id] : 0;
  const need = u.need[bucket.id] || 0;
  const gap = on - need;
  const tone = !u.drafted ? '#8aa0b8' : gap < 0 ? '#d23a52' : gap > 0 ? '#0090ca' : '#157a43';
  const picked = selUnit === u.dept;
  const nameOf = {};
  u.rows.forEach((r) => { nameOf[r.empId] = r; });
  const chips = cov ? cov.names[bucket.id].map((id) => nameOf[id]).filter(Boolean) : [];

  return (
    <div onClick={() => setSelUnit(u.dept)}
      title={u.name + ' — ' + RR_DIV_BY[u.div].label + ' · ' + u.rows.length + ' nurses on the sheet · ' + (u.drafted ? on + ' of ' + (need || '—') + ' on the ' + bucket.label.toLowerCase() + ' shift' : 'no sheet saved for this month')}
      style={{
        boxSizing: 'border-box', padding: '11px 12px', borderRadius: 13, cursor: 'pointer',
        border: '1.5px solid ' + (picked ? tone + '77' : 'rgba(255,255,255,.95)'),
        background: 'linear-gradient(160deg,rgba(255,255,255,.9),rgba(236,247,255,.6))',
        boxShadow: picked ? '0 12px 28px rgba(31,59,90,.16)' : '0 6px 18px rgba(31,59,90,.09)',
        opacity: inScope(u.div) ? 1 : .45, transition: 'box-shadow .2s,border-color .2s',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
        <span style={{ display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: 7, flexShrink: 0, color: tone, background: tone + '1c' }}>
          <Ic d={I[RR_DIV_ICON[u.div]]} s={13} />
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 700, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: MK.INK }}>{u.name}</span>
        <span className="num" style={{ fontSize: 12, fontWeight: 700, color: tone, flexShrink: 0 }}>{u.drafted ? on + '/' + (need || '—') : '—'}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
        {/* The mockup printed a bed count here. Bed numbers are not recorded anywhere in
            this app, so the slot carries the one size this screen does know. */}
        <span className="num" style={{ fontSize: 9.5, color: MK.FAINT }}>{u.rows.length} on sheet</span>
        <span style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(125,145,180,.18)', overflow: 'hidden' }}>
          <span style={rrBar(need ? (on / need) * 100 : (u.drafted ? 100 : 0), tone)} />
        </span>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.4px', textTransform: 'uppercase', color: tone, flexShrink: 0 }}>
          {!u.drafted ? 'no sheet' : !need ? 'no minimum set' : gap < 0 ? 'short ' + Math.abs(gap) : gap > 0 ? '+' + gap : 'met'}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, minHeight: 24 }}>
        {chips.map((s) => (
          <span key={s.empId} onClick={(e) => { e.stopPropagation(); setSel(sel === s.empId ? null : s.empId); }}
            title={s.name + ' · ' + (s.desig || '—') + ' · ' + (u.grid[s.empId] || {})[day] + ' · ' + s.hours + 'h this month'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 7, cursor: 'pointer', whiteSpace: 'nowrap', color: MK.INK, background: 'rgba(255,255,255,.9)', border: '1px solid ' + (sel === s.empId ? 'rgba(0,144,202,.6)' : 'rgba(125,145,180,.28)') }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.over ? '#d23a52' : R.BUCKET_COLOR[bucket.id], flexShrink: 0 }} />
            {rrFirst(s.name)}
          </span>
        ))}
        {chips.length === 0 && (
          <span style={{ fontSize: 9.5, color: '#b6c0cc', fontStyle: 'italic', alignSelf: 'center' }}>
            {u.drafted ? 'no cover on this shift' : 'no roster drafted'}
          </span>
        )}
      </div>
    </div>
  );
}

// The corridor band, with the mockup's walking nurse. Purely the mockup's decoration —
// but where she is walking IS real: the selected unit, on the selected shift.
function RRCorridor({ idx, count, selName, bucket, selStaffName }) {
  const left = 'calc(' + (count ? ((idx + 0.5) / count) * 100 : 50) + '% - 23px)';
  const scrub = R.BUCKET_COLOR[bucket.id];
  const limb = (name) => ({ transformBox: 'fill-box', transformOrigin: 'top center', animation: name + ' .7s ease-in-out infinite' });
  return (
    <div style={{ position: 'relative', height: 96, margin: '2px 0', borderRadius: 12, background: 'linear-gradient(180deg,rgba(255,255,255,.75),rgba(236,247,255,.5))', border: '1px solid rgba(255,255,255,.9)', overflow: 'hidden' }}>
      <svg width="100%" height="4" viewBox="0 0 600 4" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, top: 48 }}>
        <line x1="0" y1="2" x2="600" y2="2" stroke="rgba(0,144,202,.35)" strokeWidth="3" strokeDasharray="14 10" style={{ animation: 'rrDash 3.2s linear infinite' }} />
      </svg>
      <span style={{ position: 'absolute', left: 14, top: 8, fontSize: 9, fontWeight: 800, letterSpacing: '.9px', textTransform: 'uppercase', color: MK.FAINT }}>Main corridor · nurse station</span>
      <span style={{ position: 'absolute', right: 14, bottom: 8, fontSize: 9.5, color: MK.FAINT }}>
        {selStaffName ? 'reading ' + selStaffName + ' — pick a zone to see their unit' : 'pick a zone to read that unit'}
      </span>
      <div style={{ position: 'absolute', left, top: 14, transition: 'left 1.1s cubic-bezier(.35,.7,.3,1)', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', left: 42, top: -2, whiteSpace: 'nowrap', fontSize: 10, fontWeight: 700, color: MK.INK, background: 'rgba(255,255,255,.95)', border: '1px solid rgba(125,145,180,.3)', borderRadius: 9, padding: '4px 8px', boxShadow: '0 6px 16px rgba(31,59,90,.14)' }}>
          Walking to {selName} · {bucket.label.toLowerCase()}
        </div>
        <svg width="46" height="68" viewBox="0 0 46 68">
          <ellipse cx="23" cy="64" rx="12" ry="3" fill="rgba(22,32,46,.15)" />
          <g style={{ animation: 'rrBob .7s ease-in-out infinite' }}>
            <rect x="17.4" y="40" width="5.4" height="21" rx="2.7" fill="#2a3f5c" style={limb('rrLegA')} />
            <rect x="23.2" y="40" width="5.4" height="21" rx="2.7" fill="#1d2f47" style={limb('rrLegB')} />
            <rect x="8.6" y="25" width="5" height="18" rx="2.5" fill={scrub} style={limb('rrArmA')} />
            <rect x="32.4" y="25" width="5" height="18" rx="2.5" fill={scrub} style={limb('rrArmB')} />
            <path d="M13.6 26c0-5.6 4.2-9.4 9.4-9.4s9.4 3.8 9.4 9.4v16H13.6z" fill={scrub} />
            <path d="M19 17.2l4 5.2 4-5.2" fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="1.6" strokeLinejoin="round" />
            <rect x="27.4" y="27" width="4.2" height="5.6" rx="1.2" fill="rgba(255,255,255,.9)" />
            <circle cx="23" cy="11.8" r="7.4" fill="#f3cdae" />
            <path d="M15.6 11.4c0-5.4 3.2-8.4 7.4-8.4s7.4 3 7.4 8.4c-1.6-2.6-3.4-3.6-7.4-3.6s-5.8 1-7.4 3.6z" fill="#2b2118" />
            <path d="M16.4 5.6h13.2l-1.6-3.2H18z" fill="#fff" />
            <path d="M23 2.9v1.8M22.1 3.8h1.8" stroke="#d23a52" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="20.5" cy="12.2" r=".95" fill="#2b2118" />
            <circle cx="25.5" cy="12.2" r=".95" fill="#2b2118" />
            <path d="M21.4 15.1c1 .9 2.2.9 3.2 0" stroke="#b06a4a" strokeWidth="1" fill="none" strokeLinecap="round" />
          </g>
        </svg>
      </div>
    </div>
  );
}

// What clicking a zone opens: the selected unit, read on the selected day.
function RRUnitDetail({ u, bucket, day, month, year, setRoute }) {
  if (!u) return null;
  const cov = u.drafted ? u.covByDay[day - 1] : null;
  const nameOf = {}; u.rows.forEach((r) => { nameOf[r.empId] = r; });
  const dayFindings = u.findings.filter((f) => f.day === day);

  return (
    <div style={{ margin: '12px 16px 0', padding: '12px 14px', borderRadius: 13, background: 'rgba(255,255,255,.7)', border: '1px solid rgba(255,255,255,.95)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 9 }}>
        <span style={{ width: 8, height: 8, borderRadius: 3, background: RR_DIV_BY[u.div].color, flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: MK.INK }}>{u.name}</div>
          <div style={{ fontSize: 10.5, color: MK.FAINT }}>{RR_DIV_BY[u.div].label} · {R.MONTHS[month]} {day}, {year}</div>
        </div>
        <span style={rrStatusChip(u.status || 'none')}>{(RR_STATUS[u.status] || RR_STATUS.none).label}</span>
        {u.entry && <span className="num" style={{ fontSize: 10.5, color: MK.FAINT }}>v{u.entry.revision || 1}</span>}
        <span style={{ flex: 1 }} />
        {setRoute && <button className="btn" onClick={() => setRoute({ view: 'rosterGrid', dept: u.dept, year, month })}>Open the grid</button>}
        {setRoute && u.drafted && <button className="btn" onClick={() => setRoute({ view: 'rosterPrint', dept: u.dept, year, month })}>Print sheet</button>}
      </div>

      {!u.drafted ? (
        <div style={{ fontSize: 11.5, color: MK.MUTED }}>
          No sheet has been saved for {u.name} in {R.MONTHS[month]} {year}, so there is nothing to review for this unit yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.7px', textTransform: 'uppercase', color: '#7d8ea8', marginBottom: 6 }}>Cover on {R.MONTHS[month]} {day}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {['M', 'E', 'N', 'G'].map((b) => {
                const meta = R.BUCKETS.find((x) => x.id === b);
                const n = cov[b], need = u.need[b] || 0;
                const bad = need && n < need;
                return (
                  <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.4 }}>
                    <span style={{ minWidth: 58, fontWeight: 700, color: meta.color }}>{meta.label}</span>
                    <span className="num" style={{ fontWeight: 700, color: bad ? '#a92c42' : MK.INK }}>{n}{need ? ' / ' + need : ''}</span>
                    <span style={{ fontSize: 10.4, color: MK.FAINT }}>{need ? (bad ? 'below the unit minimum' : 'meets the unit minimum') : 'no minimum set'}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.7px', textTransform: 'uppercase', color: '#7d8ea8', marginBottom: 6 }}>On {bucket.label.toLowerCase()} duty</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 148, overflowY: 'auto' }}>
              {cov.names[bucket.id].length === 0 && <span style={{ fontSize: 11, color: MK.FAINT }}>Nobody is on the {bucket.label.toLowerCase()} shift that day.</span>}
              {cov.names[bucket.id].map((id) => {
                const s = nameOf[id]; if (!s) return null;
                return (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.4 }}>
                    <MK.Av name={s.name} empId={s.empId} size={20} radius={6} />
                    <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: MK.INK }}>{s.name}</span>
                    <span className="num" style={{ fontSize: 10, fontWeight: 700, color: R.BUCKET_COLOR[bucket.id] }}>{(u.grid[id] || {})[day]}</span>
                    <span className="num" style={{ fontSize: 10, color: s.over ? '#a92c42' : MK.FAINT }}>{s.hours}h</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.7px', textTransform: 'uppercase', color: '#7d8ea8', marginBottom: 6 }}>Rule findings</div>
            <div style={{ fontSize: 11.4, color: MK.MUTED, marginBottom: 5 }}>
              <span className="num" style={{ fontWeight: 700, color: u.findings.length ? '#b5670a' : '#157a43' }}>{u.findings.length}</span> this month · <span className="num">{dayFindings.length}</span> on this day
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 130, overflowY: 'auto' }}>
              {(dayFindings.length ? dayFindings : u.findings.slice(0, 6)).map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'baseline', fontSize: 11 }}>
                  <span className="tag num" style={{ minWidth: 38, textAlign: 'center' }}>{R.MONTHS[month].slice(0, 3)} {f.day}</span>
                  <span style={{ color: f.severity === 'high' ? '#d23a52' : f.severity === 'medium' ? '#e07a2a' : MK.MUTED }}>{f.text}</span>
                </div>
              ))}
              {u.findings.length === 0 && <span style={{ fontSize: 11, color: '#157a43' }}>Every rule this unit set passes.</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RRDiagram({ units, scoped, bucket, setBucket, day, setDay, days, month, year, sel, setSel, selUnit, setSelUnit, inScope, setRoute }) {
  const half = Math.ceil(units.length / 2);
  const top = units.slice(0, half), bottom = units.slice(half);
  const idx = Math.max(0, units.findIndex((u) => u.dept === selUnit));
  const selected = units.find((u) => u.dept === selUnit) || units[0] || null;
  const selStaff = sel ? (units.reduce((a, u) => a || u.rows.find((r) => r.empId === sel), null) || null) : null;

  // The shift belt: everyone on each bucket that day, across the units in scope, with
  // the total minimum those units set. Read-only — a nurse cannot be moved between
  // shifts from here, only on their unit's own grid.
  const lanes = R.BUCKETS.filter((b) => b.id !== 'O').map((b) => {
    const people = [];
    let need = 0;
    let notDrafted = 0;
    scoped.forEach((u) => {
      // The requirement of a unit with no sheet is not an unmet requirement — it is an
      // unanswered one. Counting it made the lane read 9/16 when the three units that
      // actually have rosters were fully covered.
      if (!u.drafted) { notDrafted++; return; }
      need += u.need[b.id] || 0;
      const cov = u.covByDay[day - 1];
      cov.names[b.id].forEach((id) => {
        const s = u.rows.find((r) => r.empId === id);
        if (s) people.push({ ...s, unit: u.name });
      });
    });
    return { b, people, need, notDrafted };
  });

  const grid = (list) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
      {list.map((u) => (
        <RRZone key={u.dept} u={u} bucket={bucket} day={day} sel={sel} setSel={setSel} selUnit={selUnit} setSelUnit={setSelUnit} inScope={inScope} />
      ))}
    </div>
  );

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="card-h" style={{ flexWrap: 'wrap' }}>
        <h3>Hospital environment</h3>
        <span style={{ fontSize: 11, color: MK.FAINT }}>every unit as a zone · click a zone to read it · the counts are that unit's own minimum</span>
        <span style={{ flex: 1 }} />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: MK.MUTED }}>
          Day
          <select value={day} onChange={(e) => setDay(Number(e.target.value))} style={{ padding: '4px 7px' }}>
            {Array.from({ length: days }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.95)', borderRadius: 10, padding: 3, gap: 2 }}>
          {R.BUCKETS.filter((b) => b.id !== 'O').map((b) => (
            <button key={b.id} onClick={() => setBucket(b.id)} title={b.label + ' duty codes'}
              style={{ border: 0, borderRadius: 8, padding: '6px 12px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: bucket.id === b.id ? '#fff' : MK.MUTED, background: bucket.id === b.id ? 'linear-gradient(160deg,' + b.color + ',' + b.color + 'cc)' : 'transparent' }}>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative', padding: 16, background: 'linear-gradient(180deg,rgba(233,243,252,.55),rgba(255,255,255,.3))' }}>
        <div style={{ position: 'absolute', inset: 16, borderRadius: 14, border: '1px dashed rgba(125,145,180,.35)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {grid(top)}
          <RRCorridor idx={idx} count={units.length} selName={selected ? selected.name : '—'} bucket={bucket} selStaffName={selStaff ? rrFirst(selStaff.name) : ''} />
          {grid(bottom)}
        </div>
      </div>

      <RRUnitDetail u={selected} bucket={bucket} day={day} month={month} year={year} setRoute={setRoute} />

      <div style={{ padding: '12px 16px 14px', marginTop: 12, borderTop: '1px solid ' + MK.LINE, background: 'rgba(247,251,255,.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.8px', textTransform: 'uppercase', color: '#7d8ea8' }}>Shift belt</span>
          {/* The mockup let you drop a nurse on a lane. Shifts are stored per day on the
              unit's own sheet, so this screen reads them and the grid edits them. */}
          <span style={{ fontSize: 10.5, color: MK.FAINT }}>click a lane to read that shift · edit shifts on the unit's grid</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 10 }}>
          {lanes.map((l) => (
            <div key={l.b.id} onClick={() => setBucket(l.b.id)}
              style={{ boxSizing: 'border-box', padding: '11px 12px', borderRadius: 12, cursor: 'pointer', border: '1.5px solid ' + (bucket.id === l.b.id ? l.b.color + '66' : 'rgba(255,255,255,.95)'), background: 'linear-gradient(160deg,rgba(255,255,255,.88),rgba(236,247,255,.55))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: l.b.color, flexShrink: 0, boxShadow: '0 0 0 3px ' + l.b.color + '2b' }} />
                <span style={{ fontSize: 11.5, fontWeight: 700, color: MK.INK }}>{l.b.label} shift</span>
                <span style={{ flex: 1 }} />
                <span className="num" style={{ fontSize: 11.5, fontWeight: 700, color: l.need && l.people.length < l.need ? '#a92c42' : '#157a43' }}>{l.people.length}/{l.need || '—'}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {l.people.slice(0, 40).map((s) => (
                  <span key={s.unit + s.empId} title={s.name + ' · ' + s.unit}
                    style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 7, whiteSpace: 'nowrap', color: MK.INK, background: 'rgba(255,255,255,.85)', border: '1px solid rgba(125,145,180,.26)' }}>
                    {rrFirst(s.name)}
                  </span>
                ))}
                {l.people.length === 0 && <span style={{ fontSize: 10, color: MK.FAINT }}>nobody rostered on this shift that day</span>}
                {l.people.length > 40 && <span style={{ fontSize: 10, color: MK.FAINT }}>+{l.people.length - 40}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================= 4. UNIT REVIEW QUEUE ================= */
const RR_HEAD = { background: 'linear-gradient(180deg,#f6fafe,#e9f1fa)', padding: '8px 12px', fontSize: 9.5, letterSpacing: '.5px', textTransform: 'uppercase', color: '#7d8ea8', borderBottom: '1px solid rgba(125,145,180,.28)', whiteSpace: 'nowrap' };
const RR_CELL = { padding: '8px 10px', borderBottom: '1px solid rgba(125,145,180,.14)' };

function RRQueue({ units, bucket, inScope, selUnit, setSelUnit, onDecide, busy, canDecide, month, year }) {
  const btn = (active, tone) => ({
    border: '1px solid ' + (active ? tone + '59' : 'rgba(125,145,180,.3)'),
    background: active ? tone + '29' : 'rgba(255,255,255,.8)', color: active ? tone : MK.MUTED,
    padding: '5px 10px', borderRadius: 8, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  });

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="card-h" style={{ flexWrap: 'wrap' }}>
        <h3>Unit review queue</h3>
        <span style={{ fontSize: 11, color: MK.FAINT }}>coverage read for the {bucket.label.toLowerCase()} shift · averaged over {R.MONTHS[month]} {year}</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11.5, minWidth: 720 }}>
          <thead>
            <tr>
              <th style={{ ...RR_HEAD, textAlign: 'left' }}>Unit</th>
              <th style={{ ...RR_HEAD, textAlign: 'center' }}>Staff</th>
              <th style={{ ...RR_HEAD, textAlign: 'left' }}>Avg workload</th>
              <th style={{ ...RR_HEAD, textAlign: 'center' }}>Cover M · E · N</th>
              <th style={{ ...RR_HEAD, textAlign: 'center' }}>Overtime</th>
              <th style={{ ...RR_HEAD, textAlign: 'center' }}>Status</th>
              <th style={{ ...RR_HEAD, textAlign: 'right' }}>Decision</th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => {
              const c = rrLoadColor(u.load);
              return (
                <tr key={u.dept} onClick={() => setSelUnit(u.dept)}
                  style={{ opacity: inScope(u.div) ? 1 : .45, background: selUnit === u.dept ? 'rgba(0,144,202,.07)' : 'transparent', cursor: 'pointer' }}>
                  <td style={{ ...RR_CELL, padding: '8px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 3, background: RR_DIV_BY[u.div].color, flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', color: MK.INK }}>{u.name}</div>
                        <div style={{ fontSize: 9.5, color: MK.FAINT, whiteSpace: 'nowrap' }}>{RR_DIV_BY[u.div].label}</div>
                      </div>
                    </div>
                  </td>
                  <td className="num" style={{ ...RR_CELL, textAlign: 'center' }}>{u.rows.length}</td>
                  <td style={RR_CELL}>
                    {u.drafted ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} title={'Mean of ' + u.hours + ' rostered hours over ' + u.rows.length + ' staff, against a full month of ' + u.std + ' h'}>
                        <span style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(125,145,180,.18)', overflow: 'hidden', minWidth: 54 }}><span style={rrBar(u.load, c)} /></span>
                        <span className="num" style={{ fontSize: 10.5, fontWeight: 700, color: c, minWidth: 30 }}>{u.load}%</span>
                      </div>
                    ) : <span style={{ fontSize: 10.5, color: MK.FAINT }}>—</span>}
                  </td>
                  <td style={RR_CELL}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      {['M', 'E', 'N'].map((b) => {
                        const need = u.need[b] || 0;
                        const ok = u.drafted && (!need || u.shortDays[b] === 0);
                        return (
                          <span key={b} className="num"
                            title={u.drafted
                              ? (R.BUCKETS.find((x) => x.id === b).label + ': ' + rr1(u.avgCov[b]) + ' staff a day on average, minimum ' + (need || 'not set') + ', ' + u.shortDays[b] + ' day(s) below it')
                              : 'No sheet saved for this month'}
                            style={{ display: 'inline-grid', placeItems: 'center', minWidth: 30, height: 22, padding: '0 4px', borderRadius: 6, fontSize: 10.5, fontWeight: 700, color: !u.drafted ? MK.FAINT : ok ? '#157a43' : '#a92c42', background: !u.drafted ? 'rgba(125,145,180,.12)' : ok ? 'rgba(21,122,67,.13)' : 'rgba(210,58,82,.14)', border: '1px solid ' + (!u.drafted ? 'rgba(125,145,180,.2)' : ok ? 'rgba(21,122,67,.25)' : 'rgba(210,58,82,.3)') }}>
                            {u.drafted ? rr1(u.avgCov[b]) : '—'}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td style={{ ...RR_CELL, textAlign: 'center' }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: u.overCount ? '#b5670a' : MK.FAINT, background: u.overCount ? 'rgba(224,138,30,.14)' : 'transparent', padding: u.overCount ? '2px 7px' : 0, borderRadius: 6 }}>
                      {!u.drafted ? '—' : u.overCount ? u.overCount + ' flagged' : 'clear'}
                    </span>
                  </td>
                  <td style={{ ...RR_CELL, textAlign: 'center' }}>
                    <span style={rrStatusChip(u.status || 'none')}>{(RR_STATUS[u.status] || RR_STATUS.none).label}</span>
                  </td>
                  <td style={{ ...RR_CELL, padding: '8px 12px' }}>
                    <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                      <button disabled={!u.drafted || !canDecide || busy} style={btn(u.status === 'approved', '#157a43')}
                        title={!u.drafted ? 'Nothing has been saved for this unit yet' : canDecide ? 'Approve and lock this sheet' : 'Approving a roster needs administrator access'}
                        onClick={(e) => { e.stopPropagation(); onDecide(u, 'approved'); }}>Approve</button>
                      <button disabled={!u.drafted || !canDecide || busy} style={btn(u.status === 'draft' && !!u.entry, '#a92c42')}
                        title={!u.drafted ? 'Nothing has been saved for this unit yet' : 'Send the sheet back to the nurse in-charge as a draft'}
                        onClick={(e) => { e.stopPropagation(); onDecide(u, 'draft'); }}>Return</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {units.length === 0 && (
              <tr><td colSpan="7" style={{ ...RR_CELL, textAlign: 'center', color: MK.MUTED, padding: 22 }}>No units to review.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= 5. AUDIT TRAIL =================
   READ THIS BEFORE ADDING TO IT. There is no roster event log in this system.
   server/duty-roster.js keeps only last-writer fields on each sheet — createdAt/By,
   updatedAt/By, statusAt/By, approvedAt/By and a revision counter — and every save
   overwrites them. So this panel lists exactly those stamps, newest first, and says
   plainly that individual changes are not recorded. Do not turn it into a feed of
   invented events. */
function rrAuditEntries(units) {
  const out = [];
  units.forEach((u) => {
    const e = u.entry;
    if (!e) return;
    if (e.createdAt) out.push({ ts: e.createdAt, kind: 'in', text: u.name + ' roster created', meta: (e.createdBy || 'unknown') + ' · ' + rrWhen(e.createdAt) });
    if (e.updatedAt) out.push({ ts: e.updatedAt, kind: 'in', text: u.name + ' roster last saved — revision v' + (e.revision || 1), meta: (e.updatedBy || 'unknown') + ' · ' + rrWhen(e.updatedAt) });
    if (e.status === 'approved' && (e.approvedAt || e.statusAt)) {
      const ts = e.approvedAt || e.statusAt;
      out.push({ ts, kind: 'ok', text: u.name + ' roster approved', meta: (e.approvedBy || e.statusBy || 'unknown') + ' · ' + rrWhen(ts) });
    } else if (e.statusAt) {
      out.push({
        ts: e.statusAt,
        kind: e.status === 'draft' ? 'warn' : 'in',
        text: u.name + (e.status === 'draft' ? ' roster reopened as a draft' : ' roster submitted for review'),
        meta: (e.statusBy || 'unknown') + ' · ' + rrWhen(e.statusAt),
      });
    }
  });
  return out.sort((a, b) => b.ts - a.ts);
}

function RRAudit({ entries, month, year }) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="card-h">
        <h3>Audit trail</h3>
        <span style={{ flex: 1 }} />
        <span className="num" style={{ fontSize: 10.5, color: MK.FAINT }}>{entries.length} entries</span>
      </div>
      <div style={{ padding: '10px 15px', borderBottom: '1px solid ' + MK.LINE, background: 'rgba(224,138,30,.08)', fontSize: 10.8, color: '#8a5a12', lineHeight: 1.5 }}>
        <strong>Not a change log.</strong> The roster store records only the last writer on each sheet — created, last saved, and the last status change — so those are the stamps listed here. Individual shift edits are not recorded anywhere, so a full per-change history cannot be shown.
      </div>
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {entries.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 11.5, color: MK.MUTED }}>
            No sheet has been saved for {R.MONTHS[month]} {year}, so there are no stamps to show.
          </div>
        )}
        {entries.map((e, i) => {
          const c = e.kind === 'warn' ? '#d23a52' : e.kind === 'in' ? '#0090ca' : '#157a43';
          const icon = e.kind === 'warn' ? I.edit : e.kind === 'in' ? I.download : I.check;
          return (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 15px', borderBottom: '1px solid rgba(125,145,180,.14)', animation: i === 0 ? 'rrPop .28s cubic-bezier(.2,.7,.3,1) both' : 'none' }}>
              <span style={{ display: 'grid', placeItems: 'center', width: 24, height: 24, borderRadius: 8, flexShrink: 0, color: c, background: c + '1c' }}><Ic d={icon} s={12} sw={2.2} /></span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.4, color: MK.INK }}>{e.text}</div>
                <div style={{ fontSize: 9.5, color: MK.FAINT, marginTop: 2 }}>{e.meta}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================= root ================= */
function RosterReviewFull({ dept, year, month, setRoute }) {
  const staffStore = window.useStaffStore();
  const index = useRosterIndex();
  const now = new Date();

  useEffect(() => { rrInjectCss(); }, []);

  const [y, setY] = useState(Number(year) || now.getFullYear());
  const [m, setM] = useState(Number.isInteger(Number(month)) ? Number(month) : now.getMonth());
  const [scope, setScope] = useState('All divisions');
  const [bucketId, setBucketId] = useState('M');
  const [dayRaw, setDay] = useState(() => (now.getFullYear() === (Number(year) || now.getFullYear()) ? now.getDate() : 1));
  const [open, setOpen] = useState({ cc: true, mn: true, ac: true, other: true });
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [selUnit, setSelUnit] = useState(dept || null);
  const [busy, setBusy] = useState(false);

  const days = R.daysIn(y, m);
  /* Clamped HERE, not in an effect.

     An effect runs after the render commits, so the first render of a shorter month
     still saw the old day: switching from a 31-day month to a 30-day one on the 31st
     indexed one past the end of every per-day array and threw before the correction
     could run. Deriving the value makes the out-of-range state unrenderable. */
  const day = Math.min(Math.max(1, dayRaw), days);

  // Land on the most recent month that actually has sheets, rather than an empty one —
  // but only before the user has touched the pickers, and only when the route did not
  // ask for a specific month.
  const jumped = useRef(false);
  useEffect(() => {
    if (jumped.current || index.loading || year != null) return;
    const first = (index.rosters || [])[0];       // the index is sorted year desc, month desc
    if (first) { setY(first.year); setM(first.month); }
    jumped.current = true;
  }, [index.loading, index.rosters, year]);

  const { sheets, loading } = useMonthSheets(index, y, m);

  const entries = useMemo(() => {
    const map = {};
    (index.rosters || []).forEach((r) => { if (r.year === y && r.month === m) map[r.dept] = r; });
    return map;
  }, [index.rosters, y, m]);

  // Every nurse on the register, grouped by the department string the roster keys on.
  const staffByDept = useMemo(() => {
    const map = {};
    (staffStore.staff || [])
      .filter((e) => e.is_active !== false && !e.former)
      .forEach((e) => {
        const d = e.current_department || 'Unassigned';
        (map[d] = map[d] || []).push({ empId: rrKey(e), empIdShown: e.emp_id || '', name: e.name, desig: e.designation, role: e.role });
      });
    Object.keys(map).forEach((d) => map[d].sort((a, b) => String(a.name).localeCompare(String(b.name))));
    return map;
  }, [staffStore.staff]);

  // A full month of 8-hour duties with one day off a week — the default overtime line,
  // and the same shape as the per-unit denominator. Recomputed when the month changes
  // only until the reviewer sets their own.
  const stdMonth = 8 * Math.max(1, days - Math.ceil(days / 7));
  const [otLimit, setOtLimit] = useState(stdMonth);
  // The text in the box, kept separate from the committed number so clearing it to
  // retype does not momentarily flag the whole roster as over the limit.
  const [otRaw, setOtRaw] = useState(String(stdMonth));
  const otTouched = useRef(false);
  useEffect(() => { if (!otTouched.current) setOtLimit(stdMonth); }, [stdMonth]);
  const setOt = (v) => { otTouched.current = true; setOtLimit(v); };

  /* The unit list: every department that has staff on the register OR a sheet this
     month. Union, never intersection — a unit with a saved roster but no current staff
     still has to be reviewed, and a unit with staff but no sheet is exactly the gap a
     reviewer is looking for. */
  const units = useMemo(() => {
    const names = {};
    Object.keys(staffByDept).forEach((d) => { names[d] = 1; });
    Object.keys(entries).forEach((d) => { names[d] = 1; });
    Object.keys(sheets).forEach((d) => { names[d] = 1; });
    return Object.keys(names)
      .map((d) => rrUnitModel(d, entries[d], sheets[d], staffByDept[d] || [], y, m, otLimit))
      .sort((a, b) => (RR_DIVS.findIndex((x) => x.id === a.div) - RR_DIVS.findIndex((x) => x.id === b.div)) || String(a.name).localeCompare(String(b.name)));
  }, [staffByDept, entries, sheets, y, m, otLimit]);

  const bucket = R.BUCKETS.find((b) => b.id === bucketId) || R.BUCKETS[1];
  const inScope = useCallback((divId) => scope === 'All divisions' || (RR_DIV_BY[divId] || {}).label === scope, [scope]);
  const scoped = useMemo(() => units.filter((u) => inScope(u.div)), [units, inScope]);

  // Keep a unit selected at all times so the diagram and the corridor have a subject.
  useEffect(() => {
    if (!units.length) return;
    if (!selUnit || !units.some((u) => u.dept === selUnit)) setSelUnit(units[0].dept);
  }, [units, selUnit]);

  /* ---- the aggregates every screen reads ---- */
  const staffTotal = scoped.reduce((a, u) => a + u.rows.length, 0);
  const rosteredTotal = scoped.reduce((a, u) => a + u.rostered.length, 0);
  const overTotal = scoped.reduce((a, u) => a + u.overCount, 0);
  const draftedUnits = scoped.filter((u) => u.drafted);
  const approvedUnits = scoped.filter((u) => u.status === 'approved');
  /* One set, not the difference of two.

     `drafted` came from the per-sheet fetch and `approved` from the index, so a single
     failed sheet request made the subtraction negative and lit an "Approve all" button
     with nothing behind it. This is exactly the list approveAll acts on. */
  const toApprove = draftedUnits.filter((u) => u.status !== 'approved' && u.entry && u.entry.id);
  const pending = toApprove.length;
  const gapUnits = draftedUnits.filter((u) => u.need[bucket.id] && u.shortDays[bucket.id] > 0);
  const unrostered = useMemo(() => {
    const out = [];
    scoped.forEach((u) => u.rows.forEach((s) => { if (!s.duty) out.push({ ...s, unitName: u.name }); }));
    return out.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [scoped]);

  const tiles = [
    { lbl: 'Staff in review', val: String(staffTotal), icon: I.user, c: '#0090ca', pct: 100,
      why: 'Every active nurse on the register whose department is one of the units in scope, plus anyone still on a saved sheet who has since left the register.' },
    { lbl: 'Rostered this month', val: String(rosteredTotal), icon: I.check, c: '#157a43', pct: staffTotal ? (rosteredTotal / staffTotal) * 100 : 0,
      why: 'Staff with at least one duty code on their unit\'s sheet for this month. (The mockup counted "deployed to a unit"; every staff record already carries a department, so this counts the roster instead.)' },
    { lbl: 'Not on any sheet', val: String(unrostered.length), icon: I.plus, c: '#3ab5a7', pct: staffTotal ? (unrostered.length / staffTotal) * 100 : 0,
      why: 'Staff in scope with no duty code at all this month. There is no float pool in this system, so this is the honest reading of "who is spare".' },
    { lbl: bucket.label + ' gaps', val: String(gapUnits.length), icon: I.pulse, c: gapUnits.length ? '#d23a52' : '#157a43', pct: draftedUnits.length ? (gapUnits.length / draftedUnits.length) * 100 : 0,
      why: 'Units with a saved sheet that fall below their OWN minimum on the ' + bucket.label.toLowerCase() + ' shift on at least one day of the month.' },
    { lbl: 'Over ' + otLimit + ' h this month', val: String(overTotal), icon: I.cal, c: '#e08a1e', pct: staffTotal ? (overTotal / staffTotal) * 100 : 0,
      why: 'Paid hours from the shift legend, summed over the month per person, compared with the overtime line in the header.' },
    { lbl: 'Units approved', val: approvedUnits.length + '/' + scoped.length, icon: I.check, c: '#6a52d4', pct: scoped.length ? (approvedUnits.length / scoped.length) * 100 : 0,
      why: 'Sheets whose stored status is "approved", out of every unit in scope (drafted or not).' },
  ];

  /* ---- the workload tree, division by division ---- */
  const query = q.trim().toLowerCase();
  const divisions = useMemo(() => RR_DIVS.map((d) => {
    const list = units.filter((u) => u.div === d.id).map((u) => ({
      ...u,
      needShift: u.need[bucket.id] || 0,
      on: u.drafted ? u.covByDay[day - 1][bucket.id] : 0,
      hits: query ? u.rows.filter((s) => (s.name + ' ' + (s.desig || '')).toLowerCase().indexOf(query) >= 0) : [],
      staff: u.rows.length,
    }));
    const staff = list.reduce((a, u) => a + u.rows.length, 0);
    const hours = list.reduce((a, u) => a + u.hours, 0);
    /* Workload and coverage are measured over DRAFTED units only.

       A unit with no sheet contributes a full month of expected hours to the
       denominator and no hours at all to the numerator, so folding it in reported a
       division as half-worked when the truth was that half its units had not been
       written yet. Same for coverage: an undrafted unit's minimum is a requirement
       nobody has answered, not a shortfall that exists. The count of unrecorded units
       is surfaced instead, so the gap is visible rather than averaged away. */
    const drafted = list.filter((u) => u.drafted);
    const undrafted = list.length - drafted.length;
    // Division workload is the mean of its people, not the mean of its units — a
    // three-nurse unit must not weigh the same as a twenty-nurse one.
    const stdSum = drafted.reduce((a, u) => a + u.std * u.rows.length, 0);
    return {
      ...d, units: list, staff, hours, undrafted,
      load: stdSum ? Math.round((hours / stdSum) * 100) : null,
      on: drafted.reduce((a, u) => a + u.on, 0),
      need: drafted.reduce((a, u) => a + u.needShift, 0),
    };
  }).filter((d) => d.units.length), [units, bucket, day, query]);

  const matchCount = query ? units.reduce((a, u) => a + u.rows.filter((s) => (s.name + ' ' + (s.desig || '')).toLowerCase().indexOf(query) >= 0).length, 0) : 0;
  const matchLabel = query ? matchCount + ' match' + (matchCount === 1 ? '' : 'es') : units.reduce((a, u) => a + u.rows.length, 0) + ' staff';

  /* ---- decisions ---- */
  const decide = (u, status) => {
    if (!u.entry || !u.entry.id) return;
    setBusy(true);
    rrApi.post('/api/rosters/' + encodeURIComponent(u.entry.id) + '/status', { status })
      .then((r) => {
        if (r && r.ok) { rrToast(u.name + (status === 'approved' ? ' approved' : ' returned to the nurse in-charge'), 'success'); index.reload(); }
        else rrToast((r && r.error) || 'Could not change the status.', 'error');
      })
      .catch(() => rrToast('Could not reach the server.', 'error'))
      .then(() => setBusy(false));
  };

  const approveAll = () => {
    const todo = toApprove;          // the same list the pending badge counts
    if (!todo.length) return;
    setBusy(true);
    Promise.all(todo.map((u) => rrApi.post('/api/rosters/' + encodeURIComponent(u.entry.id) + '/status', { status: 'approved' }).catch(() => null)))
      .then((res) => {
        const ok = res.filter((r) => r && r.ok).length;
        rrToast(ok + ' of ' + todo.length + ' unit rosters approved and released to the CNS', ok === todo.length ? 'success' : 'error');
        index.reload();
        setBusy(false);
      });
  };

  const years = useMemo(() => {
    const s = {};
    (index.rosters || []).forEach((r) => { s[r.year] = 1; });
    s[now.getFullYear()] = 1; s[y] = 1;
    return Object.keys(s).map(Number).sort((a, b) => b - a);
  }, [index.rosters, y]);                          // eslint-disable-line react-hooks/exhaustive-deps

  const audit = useMemo(() => rrAuditEntries(scoped), [scoped]);

  const body = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <RRHeader
        month={m} year={y} months={R.MONTHS} years={years} setMonth={setM} setYear={setY}
        units={scoped.length} staffTotal={staffTotal} scope={scope} setScope={setScope}
        pending={pending} otLimit={otLimit} setOtLimit={setOt} otRaw={otRaw} setOtRaw={setOtRaw}
        onApproveAll={approveAll} busy={busy} canDecide={rrCanDecide()}
      />
      <RRKpis tiles={tiles} />

      {index.error && (
        <div className="card" style={{ padding: 14, color: '#a92c42', fontSize: 12 }}>{index.error}</div>
      )}

      {loading ? (
        <div className="card" style={{ display: 'grid', placeItems: 'center', padding: 40, color: MK.MUTED }}>Loading {R.MONTHS[m]} {y}…</div>
      ) : (
        <>
          {draftedUnits.length === 0 && (
            <div className="card" style={{ display: 'grid', placeItems: 'center', padding: 28, gap: 6, textAlign: 'center' }}>
              <div style={{ opacity: .35 }}><Ic d={I.grid} s={30} /></div>
              <div style={{ fontWeight: 600, color: MK.INK }}>No roster has been saved for {R.MONTHS[m]} {y}</div>
              <div className="sub" style={{ maxWidth: 460 }}>
                Every unit below is listed from the staff register, but there is no sheet to review yet — coverage, workload and overtime stay blank until a unit saves one.
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px,352px) minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
            <RRTree
              divisions={divisions} open={open} setOpen={setOpen} q={q} setQ={setQ} matchLabel={matchLabel}
              sel={sel} setSel={setSel} selUnit={selUnit} setSelUnit={setSelUnit}
              inScope={inScope} unrostered={unrostered} bucket={bucket}
            />
            <RRDiagram
              units={units} scoped={scoped} bucket={bucket} setBucket={setBucketId} day={day} setDay={setDay} days={days}
              month={m} year={y} sel={sel} setSel={setSel} selUnit={selUnit} setSelUnit={setSelUnit}
              inScope={inScope} setRoute={setRoute}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 14, alignItems: 'start' }}>
            <RRQueue
              units={units} bucket={bucket} inScope={inScope} selUnit={selUnit} setSelUnit={setSelUnit}
              onDecide={decide} busy={busy} canDecide={rrCanDecide()} month={m} year={y}
            />
            <RRAudit entries={audit} month={m} year={y} />
          </div>
        </>
      )}
    </div>
  );

  return <div className="mk-scope">{body}</div>;
}

window.RosterReviewFull = RosterReviewFull;
