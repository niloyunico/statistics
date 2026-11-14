/* UNICO — Duty roster review inbox (renderer).
 *
 * The Manager's and the CNS's desk: every unit's roster for one month, where each one is
 * in the review chain, and the step this account may take on it. Replaces the old "Full
 * Review" screen (zone map, walking nurse, shift belt) — those showed the hospital but
 * decided nothing; this is a work queue.
 *
 *   tabs       Awaiting me · In review · Returned · Approved · Not submitted · All
 *   table      unit, in-charge, manager, staff, status, sent, last saved, the steps
 *   preview    the sheet read-only, its rule checks, sign-off and history, with the
 *              same step buttons — a reviewer decides on what they can see
 *
 * WHERE THE DATA COMES FROM
 *   GET /api/rosters/review?year&month   one row per department in this account's review
 *                                        scope, INCLUDING units with no sheet yet, each
 *                                        with `can` (the steps allowed) and `pendingForMe`
 *   GET /api/rosters/:dept/:year/:month  one sheet with grid, history, signers, can
 *   POST /api/rosters/:id/transition     the step (via the kit's useRosDecide)
 * The rights are the server's (server/roster-workflow.js); nothing here works one out.
 *
 * Shared pieces come from window.UNICO_ROSTER_KIT (roster.jsx, loaded first in the same
 * chunk). Published as window.RosterReviewFull — the route id is unchanged, so old links
 * still land here.
 */

const { useState, useEffect, useMemo, useCallback, useRef } = React;
const Ic = window.Ic, I = window.I;
const R = window.UNICO_ROSTER;
const MK = window.MK;

// The preview's sheet + decision columns stack on a narrow screen.
(function riCss() {
  if (typeof document === 'undefined' || document.getElementById('ri-css')) return;
  const el = document.createElement('style');
  el.id = 'ri-css';
  el.textContent = '@media (max-width: 960px){ .ri-split{ grid-template-columns: 1fr !important; } .ri-split > div{ position: static !important; } .ri-sum{ grid-template-columns: repeat(2,1fr) !important; } }'
    // The decision buttons fill the panel: the main step is the widest thing on it.
    + '.ri-dec > div{ display:flex !important; width:100%; } .ri-dec button{ flex:1 1 0; justify-content:center; padding-top:10px !important; padding-bottom:10px !important; }';
  document.head.appendChild(el);
}());

const RI_TABS = [
  ['awaiting', 'Awaiting me'],
  ['inreview', 'In review'],
  ['returned', 'Returned'],
  ['approved', 'Approved'],
  ['none', 'Not submitted'],
  ['all', 'All units'],
];
const riNorm = (r) => (r.hasSheet ? window.UNICO_ROSTER_KIT.statusNorm(r.status) : 'none');
const riIn = (tab, r) => {
  const st = riNorm(r);
  if (tab === 'awaiting') return !!r.pendingForMe;
  if (tab === 'inreview') return st === 'pending_manager' || st === 'pending_cns';
  if (tab === 'returned') return st === 'returned';
  if (tab === 'approved') return st === 'approved';
  if (tab === 'none') return st === 'none' || st === 'draft';
  return true;
};
// An older roster over this many hours in the month is flagged — the same line the old
// review screen drew, kept as a fixed hint rather than a setting nobody saved.
const RI_OVERTIME_H = 200;

function useRosterReview(year, month) {
  const K = window.UNICO_ROSTER_KIT;
  const [state, setState] = useState({ rows: [], cns: null, loading: true, error: '' });
  const load = useCallback(() => K.api.get('/api/rosters/review?year=' + year + '&month=' + month).then((r) => {
    if (r && r.ok) setState({ rows: r.rows || [], cns: r.cns || null, loading: false, error: '' });
    else setState((s) => ({ ...s, loading: false, error: (r && r.error) || 'Could not load the review list.' }));
  }).catch(() => setState((s) => ({ ...s, loading: false, error: 'Could not reach the server.' }))), [year, month]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setState((s) => ({ ...s, loading: true })); load(); }, [load]);
  // Another tab (or the sheet editor) took a step — the list must follow.
  useEffect(() => {
    const on = () => load();
    window.addEventListener('unico:ros-refresh', on);
    window.addEventListener('focus', on);
    return () => { window.removeEventListener('unico:ros-refresh', on); window.removeEventListener('focus', on); };
  }, [load]);
  return { ...state, reload: load };
}

const riPerson = (p) => (p && p.name ? p.name : null);
// "Sent" only while the sheet is out for review (or was approved from it) — after a return
// and an edit the old stamp would read as if it were with a reviewer.
const riSentShown = (st) => st === 'pending_manager' || st === 'pending_cns' || st === 'approved' || st === 'returned';
const RI_TH = { textAlign: 'left', padding: '9px 12px', fontSize: 10, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: '#7d8ea8', borderBottom: '1px solid rgba(125,145,180,.25)', whiteSpace: 'nowrap', background: 'rgba(242,246,251,.7)' };
const RI_TD = { padding: '9px 12px', fontSize: 12, color: '#3c4858', borderBottom: '1px solid rgba(125,145,180,.14)', verticalAlign: 'middle' };

function RiKpi({ label, value, color, on, onClick }) {
  return (
    <button type="button" onClick={onClick}
      style={{ textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', border: '1px solid ' + (on ? color + '66' : 'rgba(255,255,255,.92)'), background: on ? color + '12' : 'linear-gradient(152deg,rgba(255,255,255,.8),rgba(236,247,255,.5))', borderRadius: 14, padding: '11px 14px', boxShadow: '0 8px 24px rgba(31,59,90,.08)' }}>
      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 20, fontWeight: 700, color: value ? color : '#9aa6b4', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#6c7a8c', marginTop: 2 }}>{label}</div>
    </button>
  );
}

/* ---- where the sheet is in the chain: Prepared → Checked → Approved ---- */
function RiTracker({ doc, signers }) {
  const K = window.UNICO_ROSTER_KIT;
  const sg = signers || {};
  const h = (doc && doc.history) || [];
  const lastIdx = (acts) => { for (let i = h.length - 1; i >= 0; i--) if (acts.indexOf(h[i].action) >= 0) return i; return -1; };
  const st = K.statusNorm(doc ? doc.status : null);
  const inChain = st === 'pending_manager' || st === 'pending_cns' || st === 'approved';
  const si = inChain ? lastIdx(['send_manager', 'send_cns']) : -1;
  const sent = si >= 0 ? h[si] : null;
  const fi = lastIdx(['forward']);
  const fwd = sent && fi > si ? h[fi] : null;
  const ok = st === 'approved' && lastIdx(['approve']) >= 0 ? h[lastIdx(['approve'])] : null;
  const ret = st === 'returned' ? { stage: doc.returnStage, by: doc.returnedByName || doc.returnedBy, at: doc.returnedAt, note: doc.returnNote } : null;
  const nm = (p) => (p && p.name) || '';
  // The person's own designation (server: signers.*.desig) when the step names the Setup person.
  const own = (who, p, role) => (K.signerLine ? K.signerLine(who, p, role).text : role);
  const prepWho = (sent && doc.preparedBy) || nm(sg.incharge), chkWho = (fwd && doc.checkedBy) || nm(sg.manager), okWho = (ok && doc.approvedBy) || nm(sg.cns);
  const steps = [
    { label: 'Prepared', who: prepWho || 'In-charge not set', role: own(prepWho, sg.incharge, 'In-charge'),
      state: sent ? 'done' : 'current', sub: sent ? 'Sent ' + K.when(sent.at) : st === 'returned' ? 'Being corrected after return' : 'Not sent yet' },
    { label: 'Checked', who: chkWho || 'Manager not set', role: own(chkWho, sg.manager, 'Nurse Manager'),
      state: fwd ? 'done' : st === 'pending_manager' ? 'current' : (ret && ret.stage === 'manager') ? 'returned' : (sent && sent.action === 'send_cns') ? 'skipped' : 'todo',
      sub: fwd ? 'Forwarded ' + K.when(fwd.at) : st === 'pending_manager' ? 'Checking now' : (ret && ret.stage === 'manager') ? 'Returned ' + K.when(ret.at) : (sent && sent.action === 'send_cns') ? 'Skipped — sent straight to CNS' : 'Waiting' },
    { label: 'Approved', who: okWho || 'CNS not set', role: own(okWho, sg.cns, 'Chief of Nursing Services'),
      state: ok ? 'done' : st === 'pending_cns' ? 'current' : (ret && ret.stage === 'cns') ? 'returned' : 'todo',
      sub: ok ? 'Approved ' + K.when(ok.at) : st === 'pending_cns' ? 'Awaiting approval' : (ret && ret.stage === 'cns') ? 'Returned ' + K.when(ret.at) : 'Waiting' },
  ];
  const tone = { done: '#157a43', current: st === 'pending_cns' ? '#5b45c4' : '#0072a3', returned: '#b4232f', skipped: '#9aa6b4', todo: '#b6c0cc' };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 0, marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(125,145,180,.18)' }}>
      {steps.map((s, i) => {
        const c = tone[s.state];
        return (
          <div key={s.label} style={{ position: 'relative', display: 'flex', gap: 10, alignItems: 'flex-start', paddingRight: 12 }}>
            {i < steps.length - 1 && <span style={{ position: 'absolute', left: 30, right: 0, top: 13, height: 2, background: s.state === 'done' ? '#1f9d57' : 'rgba(125,145,180,.25)', zIndex: 0 }} />}
            <span style={{ position: 'relative', zIndex: 1, display: 'inline-grid', placeItems: 'center', width: 28, height: 28, borderRadius: '50%', flexShrink: 0, fontSize: 12, fontWeight: 800,
              color: s.state === 'todo' || s.state === 'skipped' ? c : '#fff', background: s.state === 'todo' || s.state === 'skipped' ? '#fff' : c, border: '2px solid ' + c,
              boxShadow: s.state === 'current' ? '0 0 0 4px ' + c + '22' : 'none' }}>
              {s.state === 'done' ? '✓' : s.state === 'returned' ? '!' : s.state === 'skipped' ? '–' : i + 1}
            </span>
            <div style={{ position: 'relative', zIndex: 1, background: 'transparent', minWidth: 0, paddingRight: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: .8, textTransform: 'uppercase', color: c }}>{s.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#16202e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.who}</div>
              <div style={{ fontSize: 10.5, color: '#8a97a8' }}>{s.role}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: s.state === 'todo' ? '#9aa6b4' : c, marginTop: 2 }}>{s.sub}</div>
              {s.state === 'returned' && ret && <div style={{ fontSize: 11, color: '#8c1d2a', marginTop: 3, maxWidth: 260, whiteSpace: 'pre-wrap' }}>{ret.note ? '“' + ret.note + '”' : 'No reason given'}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---- the sheet exactly as it prints, scaled to the column ---- */
const RI_SHEET_W = 1123;   // the print page's A4-landscape width at 96 dpi
function RiSheetFrame({ html }) {
  const wrap = useRef(null);
  const frame = useRef(null);
  const [h, setH] = useState(700);
  const [s, setS] = useState(1);
  useEffect(() => {
    const fit = () => { const el = wrap.current; if (el) setS(Math.min(1, el.clientWidth / RI_SHEET_W)); };
    fit();
    let ro = null;
    try { ro = new ResizeObserver(fit); if (wrap.current) ro.observe(wrap.current); } catch (e) { window.addEventListener('resize', fit); }
    return () => { if (ro) ro.disconnect(); else window.removeEventListener('resize', fit); };
  }, []);
  const measure = () => { try { const d = frame.current.contentDocument; setH(Math.ceil(d.documentElement.scrollHeight) + 4); } catch (e) { /* not ready */ } };
  return (
    <div ref={wrap} style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(125,145,180,.22)', boxShadow: '0 12px 34px rgba(31,59,90,.1)', overflow: 'hidden', height: Math.ceil(h * s) }}>
      <iframe ref={frame} title="Roster sheet" srcDoc={html} onLoad={() => { measure(); setTimeout(measure, 300); }} scrolling="no"
        style={{ display: 'block', width: RI_SHEET_W, height: h, border: 0, transform: 'scale(' + s + ')', transformOrigin: '0 0' }} />
    </div>
  );
}

/* ---- review helpers ---- */
const riDay = (year, month, d) => new Date(year, month, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const riFri = (year, month, d) => new Date(year, month, d).getDay() === 5;
// Where a rule finding points: the days it names ("Day 6 …") and any person named in it.
function riFocusOf(text, rows) {
  const days = new Set(); const re = /Day (\d+)/g; let m;
  while ((m = re.exec(String(text)))) days.add(Number(m[1]));
  const people = new Set(rows.filter((r) => r.name && String(text).indexOf(r.name) >= 0).map((r) => r.empId));
  return { days, people, label: text };
}
// One line per person: the figures a reviewer checks, and what looks wrong.
function riPeopleOf(view, doc, year, month, cfg) {
  const days = R.daysIn(year, month);
  const fris = []; for (let d = 1; d <= days; d++) if (riFri(year, month, d)) fris.push(d);
  const marks = (doc && doc.marks) || {}, al = (doc && doc.altLeave) || {}, oc = (doc && doc.oncall) || {};
  return view.rows.map((r) => {
    const row = view.grid[r.empId] || {};
    const t = R.totalsFor(row, days);
    let run = 0, maxRun = 0, offs = 0, alNoDate = 0, ocN = t.OC || 0;
    for (let d = 1; d <= days; d++) {
      const c = row[d];
      if (c && R.bucketOf(c) === 'N') { run++; maxRun = Math.max(maxRun, run); } else run = 0;
      if (R.isOff(c)) offs++;
      if (c === 'AL' && !(((al[r.empId] || {})[d]) || {}).for) alNoDate++;
      if ((oc[r.empId] || {})[d] && R.isDuty(c)) ocN++;
    }
    const friOff = fris.filter((d) => R.isOff(row[d]) || R.isLeave(row[d])).length;
    const nMarks = Object.keys(marks[r.empId] || {}).length;
    const flags = [];
    if (t.hours > RI_OVERTIME_H) flags.push('Over ' + RI_OVERTIME_H + ' h');
    if (cfg.maxNights && maxRun > cfg.maxNights) flags.push(maxRun + ' nights in a row');
    if (cfg.fridayOff && fris.length && !friOff && !r.pca) flags.push('No Friday off');
    if (alNoDate) flags.push(alNoDate + ' AL without date');
    if (nMarks) flags.push(nMarks + ' review note' + (nMarks === 1 ? '' : 's'));
    return { r, t, maxRun, offs, friOff, ocN, alNoDate, nMarks, flags };
  });
}
// Cell-by-cell difference between an earlier snapshot and the sheet now.
function riDiff(rows, grid, oldGrid, days) {
  const out = [];
  rows.forEach((r) => {
    const a = oldGrid[r.empId] || {}, b = grid[r.empId] || {};
    for (let d = 1; d <= days; d++) { const x = a[d] || '', y = b[d] || ''; if (x !== y) out.push({ empId: r.empId, name: r.name, d, from: x, to: y }); }
  });
  return out;
}

const RI_CARD = { background: '#fff', border: '1px solid rgba(125,145,180,.22)', borderRadius: 14, boxShadow: '0 6px 20px rgba(31,59,90,.06)', padding: '14px 18px' };
const RI_CAP = { fontSize: 10, fontWeight: 800, letterSpacing: .9, textTransform: 'uppercase', color: '#7d8ea8' };

/* ---- the review sheet: every cell readable and actionable ---- */
function RiGrid({ view, year, month, doc, changes, focus, filter, person, onCell, flagsOf }) {
  const K = window.UNICO_ROSTER_KIT;
  const days = R.daysIn(year, month);
  const ds = Array.from({ length: days }, (_, i) => i + 1);
  const marks = (doc && doc.marks) || {}, oc = (doc && doc.oncall) || {}, al = (doc && doc.altLeave) || {};
  const changed = {}; (changes || []).forEach((c) => { changed[c.empId + '|' + c.d] = c.from; });
  const changedRows = new Set((changes || []).map((c) => c.empId));
  const rows = view.rows.filter((r) => (person ? r.empId === person
    : filter === 'flagged' ? (flagsOf(r.empId).length > 0)
    : filter === 'changed' ? changedRows.has(r.empId) : true));
  const hit = (emp, d) => !!focus && (!focus.days.size || focus.days.has(d)) && (!focus.people.size || focus.people.has(emp));
  const th = { position: 'sticky', top: 0, zIndex: 2, background: '#eef2f7', color: '#16202e', fontSize: 10, fontWeight: 800, padding: '4px 0', borderBottom: '1px solid #c9d3df', borderRight: '1px solid #e1e7ef', textAlign: 'center', minWidth: 30 };
  return (
    <div style={{ overflow: 'auto', maxHeight: '62vh', border: '1px solid #d5dde8', borderRadius: 10 }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>
        <thead>
          <tr>
            <th style={{ ...th, left: 0, zIndex: 3, textAlign: 'left', padding: '4px 10px', minWidth: 170 }}>Staff</th>
            {ds.map((d) => {
              const fr = riFri(year, month, d);
              const lit = focus && focus.days.has(d);
              return (
                <th key={d} style={{ ...th, background: lit ? '#ffe9a8' : fr ? '#16202e' : th.background, color: fr && !lit ? '#fff' : th.color }}>
                  <div>{d}</div><div style={{ fontSize: 8.5, fontWeight: 700, opacity: .8 }}>{String(new Date(year, month, d).toLocaleDateString('en-GB', { weekday: 'short' })).slice(0, 2)}</div>
                </th>
              );
            })}
            <th style={{ ...th, minWidth: 44 }}>Hrs</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const row = view.grid[r.empId] || {};
            const fl = flagsOf(r.empId);
            return (
              <tr key={r.empId}>
                <td style={{ position: 'sticky', left: 0, zIndex: 1, background: '#fff', borderBottom: '1px solid #e6ebf1', borderRight: '1px solid #d5dde8', padding: '4px 10px', whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#16202e', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {r.name}{fl.length > 0 && <span title={fl.join(' · ')} style={{ width: 7, height: 7, borderRadius: '50%', background: '#d23a52', flexShrink: 0 }} />}
                  </div>
                  <div style={{ fontSize: 10, color: '#8a97a8' }}>{[r.empIdShown, r.desig].filter(Boolean).join(' · ')}</div>
                </td>
                {ds.map((d) => {
                  const c = row[d] || '';
                  const mk = (marks[r.empId] || {})[d];
                  const was = changed[r.empId + '|' + d];
                  const ocOn = !!((oc[r.empId] || {})[d]) && R.isDuty(c);
                  const alx = c === 'AL' ? (al[r.empId] || {})[d] : null;
                  const lit = hit(r.empId, d);
                  const bg = lit ? '#fff3c4' : R.isOff(c) ? '#d9dde3' : R.isLeave(c) ? '#eef0f3' : '#fff';
                  const tip = [c ? c + ((R.BY_CODE[c] || {}).label ? ' — ' + R.BY_CODE[c].label : '') : 'empty', ocOn ? '+ on call' : '',
                    c === 'AL' ? (alx && alx.for ? 'in lieu of ' + K.date(alx.for) : 'in-lieu date not set') : '',
                    was !== undefined ? 'was ' + (was || 'empty') : '', mk ? 'Note: ' + mk.note : ''].filter(Boolean).join('\n');
                  return (
                    <td key={d} title={tip} onClick={(e) => onCell(r, d, e.currentTarget.getBoundingClientRect())}
                      style={{ position: 'relative', cursor: 'pointer', textAlign: 'center', padding: '5px 0', fontSize: 10.5, fontWeight: R.isLeave(c) ? 700 : 800, fontStyle: R.isLeave(c) ? 'italic' : 'normal',
                        fontFamily: "'IBM Plex Mono',monospace", color: '#16202e', background: bg, borderBottom: '1px solid #e6ebf1', borderRight: '1px solid #eef1f5',
                        boxShadow: was !== undefined ? 'inset 0 0 0 2px #0090ca' : lit ? 'inset 0 0 0 2px #e0a81e' : 'none' }}>
                      {c || <span style={{ color: '#c4ccd6' }}>·</span>}
                      {mk && <i style={K.MARK_CORNER} />}
                      {ocOn && <i style={{ ...K.OC_BADGE, top: -1, right: -1 }}>OC</i>}
                      {c === 'AL' && !(alx && alx.for) && <i style={K.AL_DOT} />}
                    </td>
                  );
                })}
                <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, color: R.totalsFor(row, days).hours > RI_OVERTIME_H ? '#b4232f' : '#16202e', borderBottom: '1px solid #e6ebf1', fontFamily: "'IBM Plex Mono',monospace" }}>{R.totalsFor(row, days).hours}</td>
              </tr>
            );
          })}
          {!rows.length && <tr><td colSpan={days + 2} style={{ padding: 22, textAlign: 'center', color: '#8a97a8', fontSize: 12 }}>Nobody matches this filter.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ---- one cell: what is there, a note for the in-charge, or a direct change ---- */
function RiCellPop({ cell, doc, year, month, can, busy, onClose, onMark, onUnmark, onEdit }) {
  const K = window.UNICO_ROSTER_KIT;
  const { r, d, rect, code, was } = cell;
  const mk = ((doc.marks || {})[r.empId] || {})[d];
  const [note, setNote] = useState(mk ? mk.note : '');
  const [to, setTo] = useState(code);
  const alx = code === 'AL' ? ((doc.altLeave || {})[r.empId] || {})[d] : null;
  const ocOn = !!(((doc.oncall || {})[r.empId] || {})[d]) && R.isDuty(code);
  useEffect(() => { const k = (e) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const W = 300, vw = window.innerWidth, vh = window.innerHeight;
  const left = Math.max(8, Math.min(vw - W - 8, rect.left + rect.width / 2 - W / 2));
  const below = vh - rect.bottom > 330;
  const inp = { width: '100%', boxSizing: 'border-box', padding: '6px 9px', borderRadius: 8, border: '1px solid rgba(125,145,180,.4)', fontFamily: 'inherit', fontSize: 12 };
  return K.portal(
    <React.Fragment>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 7000 }} />
      <div style={{ position: 'fixed', left, width: W, zIndex: 7001, ...(below ? { top: rect.bottom + 6 } : { bottom: vh - rect.top + 6 }), background: '#fff', borderRadius: 12, border: '1px solid rgba(125,145,180,.3)', boxShadow: '0 18px 48px rgba(16,28,46,.24)', overflow: 'hidden' }}>
        <div style={{ padding: '10px 13px', background: '#f4f7fb', borderBottom: '1px solid rgba(125,145,180,.2)' }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#16202e' }}>{r.name}</div>
          <div style={{ fontSize: 11, color: '#6c7a8c' }}>{riDay(year, month, d)} · <b style={{ fontFamily: "'IBM Plex Mono',monospace", color: '#16202e' }}>{code || 'empty'}</b>{code && R.BY_CODE[code] ? ' — ' + R.BY_CODE[code].label : ''}</div>
          {ocOn && <div style={{ fontSize: 10.5, color: '#0d3a5c', fontWeight: 700, marginTop: 2 }}>+ On call</div>}
          {code === 'AL' && <div style={{ fontSize: 10.5, color: alx && alx.for ? '#0072a3' : '#b5670a', fontWeight: 700, marginTop: 2 }}>{alx && alx.for ? 'In lieu of ' + K.date(alx.for) + (alx.note ? ' · ' + alx.note : '') : 'Alternative leave — in-lieu date not set'}</div>}
          {was !== undefined && <div style={{ fontSize: 10.5, color: '#0072a3', fontWeight: 700, marginTop: 2 }}>Changed — was {was || 'empty'}</div>}
        </div>
        <div style={{ padding: '10px 13px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(can.mark || mk) && (
            <div>
              <div style={{ ...RI_CAP, marginBottom: 4 }}>Note for the in-charge</div>
              {can.mark
                ? <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} rows={2} placeholder="e.g. No night duty right after leave" style={{ ...inp, resize: 'vertical' }} />
                : <div style={{ fontSize: 12, color: '#8c1d2a' }}>{mk.note}</div>}
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 6 }}>
                {mk && (can.mark || can.markDone) && <button type="button" className="btn sm" disabled={busy} onClick={() => onUnmark(r.empId, d)}>Remove note</button>}
                {can.mark && <button type="button" className="btn sm pri" disabled={busy || !note.trim()} onClick={() => onMark(r.empId, d, note.trim())}>{mk ? 'Update note' : 'Pin note'}</button>}
              </div>
            </div>
          )}
          {can.reviewEdit && (
            <div style={{ borderTop: '1px solid rgba(125,145,180,.18)', paddingTop: 9 }}>
              <div style={{ ...RI_CAP, marginBottom: 4 }}>Change the shift directly</div>
              <select value={to} onChange={(e) => setTo(e.target.value)} style={inp}>
                <option value="">— empty —</option>
                {R.BUCKETS.map((b) => (
                  <optgroup key={b.id} label={b.label}>
                    {R.SHIFTS.filter((x) => x.bucket === b.id).map((x) => <option key={x.code} value={x.code}>{x.code} — {x.label}</option>)}
                  </optgroup>
                ))}
              </select>
              {to !== code && <div style={{ fontSize: 10.5, color: '#6c7a8c', marginTop: 5 }}><b style={{ fontFamily: "'IBM Plex Mono',monospace" }}>{code || '—'} → {to || '—'}</b> is saved at once and logged in the history for the in-charge.</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                <button type="button" className="btn sm pri" disabled={busy || to === code} onClick={() => onEdit(r.empId, d, to, code)}>Apply change</button>
              </div>
            </div>
          )}
          {!can.mark && !can.reviewEdit && !mk && <div style={{ fontSize: 11.5, color: '#8a97a8' }}>Read-only — this roster is not waiting on you.</div>}
        </div>
      </div>
    </React.Fragment>
  );
}

/* ---- staff on duty per day, stacked by shift, against the sheet's minimum ---- */
function RiCover({ view, year, month, minOnDuty }) {
  const K = window.UNICO_ROSTER_KIT;
  const days = R.daysIn(year, month);
  const ids = view.rows.filter((r) => !r.pca).map((r) => r.empId);
  const nm = {}; view.rows.forEach((r) => { nm[r.empId] = r.name; });
  const cov = Array.from({ length: days }, (_, i) => R.coverageFor(view.grid, ids, i + 1));
  const tot = cov.map((c) => c.G + c.M + c.E + c.N);
  const top = Math.max(minOnDuty || 0, ...tot, 1) + 1;
  const BW = 26, H = 170, PB = 34, PT = 10, ch = H - PB - PT;
  const y = (v) => PT + ch - (v / top) * ch;
  const low = tot.filter((t) => minOnDuty && t < minOnDuty).length;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 8, fontSize: 11.5, color: '#3c4858' }}>
        {['G', 'M', 'E', 'N'].map((b) => <span key={b} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 11, height: 11, borderRadius: 3, background: K.bColor(b) }} />{({ G: 'General', M: 'Morning', E: 'Evening', N: 'Night' })[b]}</span>)}
        {minOnDuty ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 16, borderTop: '2px dashed #d23a52' }} />Minimum {minOnDuty} on duty</span> : null}
        <span style={{ marginLeft: 'auto', fontWeight: 700, color: low ? '#b4232f' : '#157a43' }}>{low ? low + ' day' + (low === 1 ? '' : 's') + ' below the minimum' : 'Every day meets the minimum'}</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={'0 0 ' + (days * BW + 30) + ' ' + H} style={{ width: '100%', minWidth: days * 20, height: 'auto', display: 'block' }} role="img" aria-label="Staff on duty per day">
          {[0, Math.ceil(top / 2), top].map((v) => <g key={v}><line x1={26} x2={days * BW + 30} y1={y(v)} y2={y(v)} stroke="#e6ebf1" /><text x={20} y={y(v) + 3} fontSize="9" textAnchor="end" fill="#8a97a8">{v}</text></g>)}
          {cov.map((c, i) => {
            const d = i + 1, x = 30 + i * BW + 4; let acc = 0;
            const isLow = minOnDuty && tot[i] < minOnDuty, fr = riFri(year, month, d);
            return (
              <g key={d}>
                {fr && <rect x={30 + i * BW} y={PT} width={BW} height={ch} fill="#16202e" opacity=".05" />}
                {['N', 'E', 'M', 'G'].map((b) => {
                  const v = c[b] || 0; if (!v) return null;
                  const y0 = y(acc + v), hh = y(acc) - y(acc + v); acc += v;
                  return <rect key={b} x={x} y={y0} width={BW - 8} height={hh} rx="2" fill={K.bColor(b)}><title>{riDay(year, month, d) + ' · ' + b + ' ' + v + ((c.names && c.names[b] && c.names[b].length) ? ': ' + c.names[b].map((id) => nm[id] || id).join(', ') : '')}</title></rect>;
                })}
                <text x={x + (BW - 8) / 2} y={y(tot[i]) - 3} fontSize="9" textAnchor="middle" fill={isLow ? '#b4232f' : '#3c4858'} fontWeight="700">{tot[i]}</text>
                <text x={x + (BW - 8) / 2} y={H - 20} fontSize="9.5" textAnchor="middle" fill={isLow ? '#b4232f' : fr ? '#16202e' : '#6c7a8c'} fontWeight={isLow || fr ? 800 : 500}>{d}</text>
                <text x={x + (BW - 8) / 2} y={H - 9} fontSize="8" textAnchor="middle" fill="#9aa6b4">{String(new Date(year, month, d).toLocaleDateString('en-GB', { weekday: 'short' })).slice(0, 2)}</text>
              </g>
            );
          })}
          {minOnDuty ? <line x1={26} x2={days * BW + 30} y1={y(minOnDuty)} y2={y(minOnDuty)} stroke="#d23a52" strokeDasharray="5 4" strokeWidth="1.5" /> : null}
        </svg>
      </div>
    </div>
  );
}

/* ---- one sheet: review it, mark it, fix it, decide ---- */
function RiPreview({ row, year, month, staff, onBack, onDecide, busy, setRoute }) {
  const K = window.UNICO_ROSTER_KIT;
  const [doc, setDoc] = useState(null);
  const [extra, setExtra] = useState({ signers: {}, can: null });
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('sheet');
  const [focus, setFocus] = useState(null);
  const [filter, setFilter] = useState('all');
  const [person, setPerson] = useState('');
  const [cell, setCell] = useState(null);
  const [acting, setActing] = useState(false);
  const [versions, setVersions] = useState([]);
  const [cmpRev, setCmpRev] = useState(null);
  const [cmpGrid, setCmpGrid] = useState(null);
  const [ticks, setTicks] = useState({});
  const [openRule, setOpenRule] = useState({});
  const [showClear, setShowClear] = useState(false);
  const rulesRef = useRef(null), sheetRef = useRef(null), checkRef = useRef(null);
  const dept = row.sheetDept || row.deptName;
  const load = useCallback(() => K.api.get('/api/rosters/' + encodeURIComponent(dept) + '/' + year + '/' + month).then((r) => {
    if (r && r.ok) { setDoc(r.roster ? { ...r.roster, movedOut: r.movedOut || [], guests: K.sheetGuests(r) } : null); setExtra({ signers: r.signers || {}, can: (r.roster && r.roster.can) || r.can || null }); setErr(''); }
    else setErr((r && r.error) || 'Could not load the sheet.');
  }).catch(() => setErr('Could not reach the server.')), [dept, year, month]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  // A mark or a direct change answers with the sheet as it now stands.
  const take = (r) => { if (r && r.ok && r.roster) { setDoc((d) => ({ ...r.roster, movedOut: (d && d.movedOut) || [], guests: { ...((d && d.guests) || {}), ...(r.roster.guests || {}) } })); setExtra((e) => ({ ...e, can: r.roster.can || e.can, signers: r.roster.signers || e.signers })); return true; } K.toast((r && r.error) || 'Could not save that.', 'error'); return false; };

  // The snapshots taken at each hand-over — the sheet is compared with the newest one before now.
  const docId = doc && doc.id, docRev = doc ? (doc.revision || 0) : 0;
  useEffect(() => {
    if (!docId) return undefined;
    let live = true;
    K.api.get('/api/rosters/' + encodeURIComponent(docId) + '/versions').then((r) => {
      if (!live || !r || !r.ok) return;
      const seen = {}; const list = (r.versions || []).filter((v) => { if (seen[v.revision]) return false; seen[v.revision] = 1; return true; });
      setVersions(list);
      setCmpRev((cur) => { if (cur != null && list.some((v) => v.revision === cur)) return cur; const prev = list.find((v) => v.revision < docRev); return prev ? prev.revision : null; });
    }).catch(() => {});
    return () => { live = false; };
  }, [docId, docRev]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!docId || cmpRev == null) { setCmpGrid(null); return undefined; }
    let live = true;
    K.api.get('/api/rosters/' + encodeURIComponent(docId) + '/versions/' + cmpRev).then((r) => {
      if (live && r && r.ok && r.version) setCmpGrid(K.rowsFrom({ ...r.version, guests: (doc && doc.guests) || {}, movedOut: (doc && doc.movedOut) || [] }, staff, dept).grid);
    }).catch(() => {});
    return () => { live = false; };
  }, [docId, cmpRev]);   // eslint-disable-line react-hooks/exhaustive-deps

  const view = useMemo(() => (doc ? K.rowsFrom(doc, staff, dept, undefined, extra.signers && extra.signers.incharge && extra.signers.incharge.name) : { rows: [], grid: {} }), [doc, staff, dept, extra]);   // eslint-disable-line react-hooks/exhaustive-deps
  const ev = useMemo(() => (doc ? K.findingsOf(view.grid, view.rows, year, month, doc.rules) : null), [doc, view, year, month]);   // eslint-disable-line react-hooks/exhaustive-deps
  const cfg = useMemo(() => K.rulesOf(doc && doc.rules).cfg, [doc]);   // eslint-disable-line react-hooks/exhaustive-deps
  const days = R.daysIn(year, month);
  const people = useMemo(() => riPeopleOf(view, doc, year, month, cfg), [view, doc, year, month, cfg]);
  const flagsBy = useMemo(() => { const m = {}; people.forEach((p) => { m[p.r.empId] = p.flags; }); return m; }, [people]);
  const changes = useMemo(() => (cmpGrid ? riDiff(view.rows, view.grid, cmpGrid, days) : []), [cmpGrid, view, days]);
  const stats = useMemo(() => {
    let hours = 0, shifts = 0, over = 0;
    people.forEach((p) => { hours += p.t.hours; shifts += p.t.G + p.t.M + p.t.E + p.t.N; if (p.t.hours > RI_OVERTIME_H) over++; });
    return { hours, shifts, over, pca: view.rows.filter((x) => x.pca).length };
  }, [people, view]);
  const lowDays = useMemo(() => {
    const ids = view.rows.filter((r) => !r.pca).map((r) => r.empId);
    let n = 0; for (let d = 1; d <= days; d++) { const c = R.coverageFor(view.grid, ids, d); if (cfg.minOnDuty && c.G + c.M + c.E + c.N < cfg.minOnDuty) n++; }
    return n;
  }, [view, days, cfg]);
  const me = (window.__UNICO_USER__ && (window.__UNICO_USER__.name || window.__UNICO_USER__.username)) || '';
  const deptName = K.deptName ? K.deptName(dept) : dept;
  // The official sheet, signed as Print / PDF signs it: Setup's names, each with their own designation.
  const html = useMemo(() => {
    if (!doc || !K.printHtml) return '';
    const def = K.signNames ? K.signNames(doc, extra.signers) : null;
    let signPeople;
    if (def) {
      const role = { prepared: 'In-charge, ' + deptName, checked: 'Nurse Manager', approved: 'Chief of Nursing Services' };
      const byName = (nm) => { const k = String(nm || '').trim().toLowerCase(); return k ? (staff || []).find((e) => e && !e.former && String(e.name || '').trim().toLowerCase() === k) : null; };
      signPeople = {};
      const sgs = extra.signers || {}, setupOf = { prepared: sgs.incharge, checked: sgs.manager, approved: sgs.cns };
      ['prepared', 'checked', 'approved'].forEach((k) => {
        const e = byName(def[k]);
        if (e) { signPeople[k] = { name: e.name, line: K.signLine(e) || role[k] }; return; }
        // The designation the server read from the person's own staff record (same as the sheet's sign-off).
        signPeople[k] = { name: def[k], line: K.signerLine ? K.signerLine(def[k], setupOf[k], role[k]).text : role[k] };
      });
    }
    return K.printHtml({ dept, deptName, year, month, doc, rows: view.rows, grid: view.grid, signers: extra.signers, signPeople, colourDesign: false, summary: true, cards: false, legend: true, printedBy: me });
  }, [doc, view, extra, dept, deptName, year, month, me, staff]);   // eslint-disable-line react-hooks/exhaustive-deps

  const st = K.statusNorm(doc ? doc.status : null);
  const can = extra.can || {};
  const failing = ev ? ev.rules.filter((r) => r[2].length) : [];
  const clear = ev ? ev.rules.filter((r) => !r[2].length) : [];
  const nMarks = Object.keys((doc && doc.marks) || {}).reduce((a, k) => a + Object.keys(doc.marks[k] || {}).length, 0);
  const alNoDate = people.reduce((a, p) => a + p.alNoDate, 0);
  const flagged = people.filter((p) => p.flags.length).length;
  const deciding = !!(can.approve || can.forward);
  const roleLine = can.approve ? 'You are approving as the CNS' : can.forward ? 'You are checking as the Manager' : can.send ? 'You prepare this roster' : '';

  // The checklist a reviewer works through before Approve / Forward unlocks.
  const checks = [
    ['cover', 'Daily cover checked', lowDays ? lowDays + ' day' + (lowDays === 1 ? '' : 's') + ' below the minimum' : 'every day meets the minimum', !!lowDays, () => setTab('cover')],
    ['leave', 'Leave & AL dates checked', alNoDate ? alNoDate + ' AL without an in-lieu date' : 'all AL dated', !!alNoDate, () => { setTab('people'); }],
    ['hours', 'Hours & nights checked', flagged ? flagged + ' staff flagged' : 'nobody flagged', !!flagged, () => setTab('people')],
    ['notes', 'Review notes settled', nMarks ? nMarks + ' note' + (nMarks === 1 ? '' : 's') + ' still open' : 'no open notes', !!nMarks, () => { setTab('sheet'); setFilter('flagged'); }],
    ['sign', 'Sign-off names correct', 'Prepared / Checked / Approved on the official sheet', false, () => setTab('doc')],
  ];
  const done = checks.filter((c) => ticks[c[0]]).length;
  const allTicked = done === checks.length;

  const decide = (action) => {
    if ((action === 'approve' || action === 'forward') && !allTicked) {
      K.toast('Tick the review checklist first — ' + (checks.length - done) + ' left.', 'info');
      if (checkRef.current) checkRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const note = action === 'return' && nMarks ? nMarks + ' cell' + (nMarks === 1 ? '' : 's') + ' marked on the sheet — see the review notes.' : '';
    onDecide({ ...row, id: (doc && doc.id) || row.id }, action, { note }).then((r) => { if (r && r.ok) { setTicks({}); load(); } });
  };
  const post = (path, body) => { setActing(true); return K.api.post('/api/rosters/' + encodeURIComponent(doc.id) + path, body).then((r) => { setActing(false); return r; }).catch(() => { setActing(false); return { ok: false, error: 'Could not reach the server.' }; }); };
  const onMark = (empId, d, note) => post('/marks', { empId, day: d, note }).then((r) => { if (take(r)) { K.toast('Note pinned for the in-charge.'); setCell(null); } });
  const onUnmark = (empId, d) => post('/marks', { empId, day: d, remove: true }).then((r) => { if (take(r)) { K.toast('Note removed.'); setCell(null); } });
  const onEdit = (empId, d, code, before) => post('/review-edit', { empId, day: d, code, baseRevision: doc.revision || 0 }).then((r) => {
    if (take(r)) { K.toast((before || '—') + ' → ' + (code || '—') + ' saved and logged.'); setCell(null); }
    else if (r && r.conflict) load();
  });
  const openCell = (r, d, rect) => setCell({ r, d, rect, code: (view.grid[r.empId] || {})[d] || '', was: (() => { const c = changes.find((x) => x.empId === r.empId && x.d === d); return c ? c.from : undefined; })() });
  const pointAt = (f) => { setFocus(riFocusOf(f, view.rows)); setPerson(''); setFilter('all'); setTab('sheet'); setTimeout(() => { if (sheetRef.current) sheetRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30); };
  const d2 = (d) => String(d).padStart(2, '0') + ' ' + R.MONTHS[month].slice(0, 3) + ' ' + year;

  const TABS = [['sheet', 'Review sheet', nMarks], ['doc', 'Official document', 0], ['people', 'People', flagged], ['changes', 'Changes', changes.length], ['cover', 'Daily cover', lowDays]];
  const seg = (on) => ({ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 9, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: on ? 800 : 600, color: on ? '#fff' : '#3c4858', background: on ? '#0d3a5c' : 'transparent' });
  const badge = (n, on) => (n ? <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 9, background: on ? 'rgba(255,255,255,.22)' : 'rgba(210,58,82,.12)', color: on ? '#fff' : '#b4232f' }}>{n}</span> : null);
  const pill = (on) => ({ padding: '4px 11px', borderRadius: 14, border: '1px solid ' + (on ? '#0d3a5c' : 'rgba(125,145,180,.35)'), background: on ? '#0d3a5c' : '#fff', color: on ? '#fff' : '#3c4858', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' });
  const nameOf = (id) => (view.rows.find((r) => r.empId === id) || {}).name || id;
  const chg = {}; changes.forEach((c) => { (chg[c.empId] || (chg[c.empId] = [])).push(c); });
  const vLabel = (v) => 'rev ' + v.revision + ' · ' + (K.ROS_HIST_LABEL ? (K.ROS_HIST_LABEL[v.action] || v.action || '') : (v.action || '')) + ' · ' + K.when(v.at) + (v.byName ? ' · ' + v.byName : '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* header + where it is in the chain */}
      <div style={RI_CARD}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <button className="btn sm" type="button" onClick={onBack}>‹ Back</button>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0d1b2e', letterSpacing: -.2 }}>{deptName}</div>
            <div style={{ fontSize: 12.5, color: '#0072a3', fontWeight: 700 }}>{R.MONTHS[month]} {year} <span style={{ color: '#8a97a8', fontWeight: 500 }}>· {d2(1)} – {d2(days)}{doc ? ' · rev ' + (doc.revision || 0) : ''}</span></div>
            {doc && <div style={{ fontSize: 11, color: '#8a97a8', marginTop: 1 }}>{doc.updatedBy ? 'Last saved by ' + doc.updatedBy + ' · ' + K.when(doc.updatedAt) : ''}</div>}
          </div>
          <K.RosStatusChip st={doc ? doc.status : null} big />
          <button className="btn sm" type="button" onClick={() => setRoute({ view: 'rosterGrid', dept, year, month })}>Open in editor</button>
          {doc && <button className="btn sm" type="button" onClick={() => setRoute({ view: 'rosterPrint', dept, year, month })}>Print / PDF</button>}
        </div>
        {doc && <RiTracker doc={doc} signers={extra.signers} />}
      </div>

      {err && <div style={{ ...RI_CARD, color: '#b4232f', fontSize: 12.5 }}>{err}</div>}

      {doc && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 330px', gap: 14, alignItems: 'start' }} className="ri-split">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            {/* the month at a glance — each figure opens where it comes from */}
            <div style={{ ...RI_CARD, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(5,1fr)' }} className="ri-sum">
              {[
                ['Staff', view.rows.length, stats.pca ? (view.rows.length - stats.pca) + ' nurses · ' + stats.pca + ' PCA' : 'on the sheet', '#0d1b2e', () => setTab('people')],
                ['Duty shifts', stats.shifts, lowDays ? lowDays + ' low day' + (lowDays === 1 ? '' : 's') : 'cover met every day', lowDays ? '#b5670a' : '#0072a3', () => setTab('cover')],
                ['Total hours', stats.hours, stats.over ? stats.over + ' over ' + RI_OVERTIME_H + ' h' : 'nobody over ' + RI_OVERTIME_H + ' h', stats.over ? '#b5670a' : '#5b45c4', () => setTab('people')],
                ['Changes', changes.length, cmpRev != null ? 'since rev ' + cmpRev : 'first version', changes.length ? '#0072a3' : '#9aa6b4', () => setTab('changes')],
                ['Rule warnings', ev ? ev.totalViol : 0, failing.length ? failing.length + ' rule' + (failing.length === 1 ? '' : 's') + ' not met' : 'all rules met', ev && ev.totalViol ? '#b4232f' : '#157a43',
                  () => { if (rulesRef.current) rulesRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }],
              ].map(([l, v, sub, c, onClick], i) => (
                <div key={l} onClick={onClick} style={{ padding: '11px 16px', borderLeft: i ? '1px solid rgba(125,145,180,.18)' : 0, cursor: 'pointer' }}>
                  <div style={RI_CAP}>{l}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 20, fontWeight: 700, color: c, lineHeight: 1.2 }}>{v}</div>
                  <div style={{ fontSize: 10.5, color: '#8a97a8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* rule checks — every warning points at its cells */}
            {ev && (
              <div ref={rulesRef} style={RI_CARD}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: failing.length ? 8 : 0, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#16202e' }}>Rule checks</div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 10, color: failing.length ? '#b4232f' : '#157a43', background: failing.length ? 'rgba(210,58,82,.1)' : 'rgba(31,157,87,.12)' }}>{failing.length ? failing.length + ' need attention' : 'all clear'}</span>
                  {failing.length > 0 && <span style={{ fontSize: 11, color: '#8a97a8' }}>· click a warning to see it on the sheet</span>}
                </div>
                {failing.map(([rule, base, list]) => {
                  const open = !!openRule[rule];
                  const shown = open ? list : list.slice(0, 6);
                  return (
                    <div key={rule} style={{ display: 'flex', gap: 12, padding: '8px 0', borderTop: '1px solid rgba(125,145,180,.14)' }}>
                      <span style={{ minWidth: 34, height: 22, borderRadius: 11, display: 'inline-grid', placeItems: 'center', fontSize: 11, fontWeight: 800, color: '#fff', background: '#d23a52', flexShrink: 0 }}>{list.length}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#16202e' }}>{rule} <span style={{ fontWeight: 500, color: '#9aa6b4', fontSize: 11 }}>· {base}</span></div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                          {shown.map((f, i) => {
                            const on = focus && focus.label === f;
                            return <button type="button" key={i} onClick={() => (on ? setFocus(null) : pointAt(f))} style={{ fontSize: 10.5, color: on ? '#fff' : '#8c1d2a', background: on ? '#b4232f' : 'rgba(210,58,82,.07)', border: '1px solid rgba(210,58,82,.2)', borderRadius: 6, padding: '1px 7px', cursor: 'pointer', fontFamily: 'inherit' }}>{f}</button>;
                          })}
                          {list.length > 6 && <button type="button" onClick={() => setOpenRule((o) => ({ ...o, [rule]: !open }))} style={{ border: 0, background: 'none', color: '#0072a3', fontSize: 10.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{open ? 'Show less' : '+' + (list.length - 6) + ' more'}</button>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {clear.length > 0 && (
                  <div style={{ borderTop: failing.length ? '1px solid rgba(125,145,180,.14)' : 0, paddingTop: 8 }}>
                    <button type="button" onClick={() => setShowClear((v) => !v)} style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: '#157a43' }}>✓ {clear.length} rule{clear.length === 1 ? '' : 's'} clear {showClear ? '▴' : '▾'}</button>
                    {showClear && <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>{clear.map(([rule, base]) => <div key={rule} style={{ fontSize: 11.5, color: '#3c4858' }}><span style={{ color: '#1f9d57', fontWeight: 800 }}>✓</span> {rule} <span style={{ color: '#9aa6b4' }}>· {base}</span></div>)}</div>}
                  </div>
                )}
              </div>
            )}

            {/* the review workspace */}
            <div ref={sheetRef} style={RI_CARD}>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: 4, background: '#f1f4f8', borderRadius: 11, marginBottom: 12 }}>
                {TABS.map(([id, label, n]) => <button key={id} type="button" onClick={() => setTab(id)} style={seg(tab === id)}>{label}{badge(n, tab === id)}</button>)}
              </div>

              {tab === 'sheet' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {[['all', 'Everyone'], ['flagged', 'Flagged'], ['changed', 'Changed']].map(([id, l]) => <button key={id} type="button" onClick={() => { setFilter(id); setPerson(''); }} style={pill(!person && filter === id)}>{l}</button>)}
                    {person && <button type="button" onClick={() => setPerson('')} style={pill(true)}>{nameOf(person)} ✕</button>}
                    {focus && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: '#8a5a00', background: '#fff3c4', border: '1px solid #f0d27a', borderRadius: 14, padding: '3px 10px' }}>Showing: {focus.label}<button type="button" onClick={() => setFocus(null)} style={{ border: 0, background: 'none', cursor: 'pointer', fontWeight: 800, color: '#8a5a00' }}>✕</button></span>}
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8a97a8' }}>
                      {can.mark || can.reviewEdit ? 'Click a cell to pin a note' + (can.reviewEdit ? ' or change the shift' : '') : 'Click a cell for its details'}
                    </span>
                  </div>
                  <RiGrid view={view} year={year} month={month} doc={doc} changes={changes} focus={focus} filter={filter} person={person} onCell={openCell} flagsOf={(id) => flagsBy[id] || []} />
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8, fontSize: 10.5, color: '#6c7a8c' }}>
                    <span><i style={{ display: 'inline-block', width: 12, height: 10, background: '#d9dde3', verticalAlign: -1, marginRight: 4 }} />Day off</span>
                    <span><i style={{ display: 'inline-block', width: 12, height: 10, background: '#eef0f3', verticalAlign: -1, marginRight: 4 }} />Leave</span>
                    <span><i style={{ display: 'inline-block', width: 12, height: 10, boxShadow: 'inset 0 0 0 2px #0090ca', verticalAlign: -1, marginRight: 4 }} />Changed{cmpRev != null ? ' since rev ' + cmpRev : ''}</span>
                    <span><i style={{ display: 'inline-block', width: 0, height: 0, borderTop: '9px solid #d23a52', borderRight: '9px solid transparent', verticalAlign: -1, marginRight: 4 }} />Review note</span>
                    <span><i style={{ display: 'inline-block', width: 12, height: 10, background: '#fff3c4', verticalAlign: -1, marginRight: 4 }} />Warning you picked</span>
                  </div>
                </div>
              )}

              {tab === 'doc' && (html ? <RiSheetFrame html={html} /> : <K.RosSheetTable rows={view.rows} grid={view.grid} year={year} month={month} maxHeight="56vh" />)}

              {tab === 'people' && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead><tr>{['Staff', 'Hours', 'G', 'M', 'E', 'N', 'Nights in a row', 'Off', 'Fridays off', 'Leave', 'On call', 'Flags'].map((h) => <th key={h} style={{ ...RI_TH, textAlign: h === 'Staff' || h === 'Flags' ? 'left' : 'center' }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {people.slice().sort((a, b) => b.flags.length - a.flags.length || String(a.r.name).localeCompare(String(b.r.name))).map((p) => (
                        <tr key={p.r.empId} onClick={() => { setPerson(p.r.empId); setFocus(null); setTab('sheet'); }} style={{ cursor: 'pointer', background: p.flags.length ? 'rgba(210,58,82,.04)' : 'transparent' }}>
                          <td style={RI_TD}><b style={{ color: '#16202e' }}>{p.r.name}</b><div style={{ fontSize: 10.5, color: '#8a97a8' }}>{p.r.desig || ''}</div></td>
                          {[p.t.hours, p.t.G, p.t.M, p.t.E, p.t.N, p.maxRun, p.offs, p.friOff, p.t.leave, p.ocN].map((v, i) => (
                            <td key={i} style={{ ...RI_TD, textAlign: 'center', fontFamily: "'IBM Plex Mono',monospace", fontWeight: i === 0 ? 800 : 500, color: (i === 0 && v > RI_OVERTIME_H) || (i === 5 && cfg.maxNights && v > cfg.maxNights) ? '#b4232f' : '#16202e' }}>{v || (i === 0 ? 0 : '·')}</td>
                          ))}
                          <td style={RI_TD}>{p.flags.length ? p.flags.map((f) => <span key={f} style={{ display: 'inline-block', margin: '1px 4px 1px 0', fontSize: 10.5, fontWeight: 700, color: '#8c1d2a', background: 'rgba(210,58,82,.09)', borderRadius: 6, padding: '1px 7px' }}>{f}</span>) : <span style={{ color: '#157a43', fontWeight: 700 }}>✓</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ fontSize: 10.5, color: '#8a97a8', marginTop: 6 }}>Click a person to see only their row on the review sheet.</div>
                </div>
              )}

              {tab === 'changes' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, color: '#3c4858' }}>Compare the sheet now with</span>
                    <select value={cmpRev == null ? '' : String(cmpRev)} onChange={(e) => setCmpRev(e.target.value === '' ? null : Number(e.target.value))} style={{ padding: '6px 9px', borderRadius: 8, border: '1px solid rgba(125,145,180,.4)', fontFamily: 'inherit', fontSize: 12 }}>
                      {!versions.length && <option value="">no earlier version</option>}
                      {versions.filter((v) => v.revision < docRev || v.revision === cmpRev).map((v) => <option key={v.revision} value={v.revision}>{vLabel(v)}</option>)}
                    </select>
                    {changes.length > 0 && <button type="button" className="btn sm" onClick={() => { setFilter('changed'); setPerson(''); setTab('sheet'); }}>Show on the sheet</button>}
                  </div>
                  {cmpRev == null
                    ? <div style={{ fontSize: 12.5, color: '#8a97a8', padding: '10px 2px' }}>This is the first version sent for review — there is nothing earlier to compare with.</div>
                    : !changes.length
                      ? <div style={{ fontSize: 12.5, color: '#157a43', padding: '10px 2px', fontWeight: 700 }}>✓ No shift changed since rev {cmpRev}.</div>
                      : Object.keys(chg).map((id) => (
                        <div key={id} style={{ borderTop: '1px solid rgba(125,145,180,.14)', padding: '8px 0' }}>
                          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#16202e', marginBottom: 4 }}>{nameOf(id)} <span style={{ fontWeight: 500, color: '#8a97a8', fontSize: 11 }}>· {chg[id].length} change{chg[id].length === 1 ? '' : 's'}</span></div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            {chg[id].map((c) => <span key={c.d} style={{ fontSize: 11, color: '#0d3a5c', background: 'rgba(0,144,202,.08)', border: '1px solid rgba(0,144,202,.22)', borderRadius: 7, padding: '2px 8px', fontFamily: "'IBM Plex Mono',monospace" }}>{riDay(year, month, c.d)}: {c.from || '—'} → <b>{c.to || '—'}</b></span>)}
                          </div>
                        </div>
                      ))}
                  {(doc.history || []).some((h) => h.action === 'edit') && (
                    <div style={{ marginTop: 10, fontSize: 11.5, color: '#6c7a8c' }}>
                      <div style={{ ...RI_CAP, marginBottom: 4 }}>Changed during review</div>
                      {(doc.history || []).filter((h) => h.action === 'edit').slice(-12).reverse().map((h, i) => <div key={i}>• {h.note} <span style={{ color: '#9aa6b4' }}>— {h.byName || h.by}, {K.when(h.at)}</span></div>)}
                    </div>
                  )}
                </div>
              )}

              {tab === 'cover' && <RiCover view={view} year={year} month={month} minOnDuty={cfg.minOnDuty} />}
            </div>
          </div>

          {/* decision column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 12 }}>
            {deciding && (
              <div ref={checkRef} style={RI_CARD}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={RI_CAP}>Review checklist</div>
                  <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: allTicked ? '#157a43' : '#b5670a' }}>{done} of {checks.length}</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: '#eef1f5', marginBottom: 8 }}><div style={{ height: 4, borderRadius: 2, width: (done / checks.length * 100) + '%', background: allTicked ? '#1f9d57' : '#e0a81e', transition: 'width .2s' }} /></div>
                {checks.map(([id, label, sub, warn, go]) => (
                  <label key={id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '6px 2px', cursor: 'pointer', borderTop: '1px solid rgba(125,145,180,.1)' }}>
                    <input type="checkbox" checked={!!ticks[id]} onChange={(e) => setTicks((t) => ({ ...t, [id]: e.target.checked }))} style={{ marginTop: 2 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#16202e' }}>{label}</span>
                      <span style={{ fontSize: 10.5, color: warn ? '#b5670a' : '#8a97a8' }}>{warn ? '⚠ ' : ''}{sub} · <a onClick={(e) => { e.preventDefault(); go(); }} href="#" style={{ color: '#0072a3', fontWeight: 700 }}>look</a></span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            <div style={{ ...RI_CARD, borderTop: '3px solid ' + (st === 'pending_cns' ? '#5b45c4' : st === 'pending_manager' ? '#0072a3' : st === 'approved' ? '#1f9d57' : st === 'returned' ? '#d23a52' : '#b5670a') }}>
              <div style={RI_CAP}>Your decision</div>
              {roleLine && <div style={{ fontSize: 13, fontWeight: 700, color: '#16202e', marginTop: 4 }}>{roleLine}</div>}
              <div style={{ fontSize: 11.5, color: '#6c7a8c', marginTop: 3 }}>{doc.sentAt && riSentShown(st) ? 'Sent ' + K.when(doc.sentAt) + ' by ' + (doc.sentByName || doc.sentBy || '—') : 'With the in-charge — not sent for review yet'}</div>
              {deciding && !allTicked && <div style={{ marginTop: 10, fontSize: 11.5, color: '#8a5a00', background: 'rgba(224,138,30,.09)', border: '1px solid rgba(224,138,30,.28)', borderRadius: 9, padding: '7px 10px' }}>🔒 {can.approve ? 'Approve' : 'Forward'} unlocks when the checklist is ticked ({checks.length - done} left).</div>}
              {nMarks > 0 && <div style={{ marginTop: 8, fontSize: 11.5, color: '#8c1d2a' }}>{nMarks} review note{nMarks === 1 ? '' : 's'} pinned — Return sends them to the in-charge.</div>}
              <div className="ri-dec" style={{ marginTop: 12, opacity: busy ? .7 : 1 }}>
                {K.RosDecisionButtons({ status: doc.status, can: extra.can, onAction: decide, busy, hasManager: !!(extra.signers && extra.signers.manager) })
                  || <div style={{ fontSize: 11.5, color: '#8a97a8' }}>{st === 'approved' ? 'Approved — this roster is published.' : 'No step for you on this roster right now.'}</div>}
              </div>
              {can.reviewEdit && <div style={{ fontSize: 10.5, color: '#9aa6b4', marginTop: 8 }}>Small fixes: click a cell and change it directly — it is logged. Bigger ones: pin notes and Return.</div>}
            </div>
            {nMarks > 0 && K.RosMarkList && (
              <div style={{ ...RI_CARD, padding: '10px 12px' }}>
                <K.RosMarkList marks={doc.marks} rows={view.rows} year={year} month={month} canDone={!!(can.mark || can.markDone)} onDone={onUnmark}
                  onOpen={(emp, d) => { const r = view.rows.find((x) => x.empId === emp); if (r) { setTab('sheet'); setPerson(emp); } }} />
              </div>
            )}
            <div style={RI_CARD}>
              <div style={{ ...RI_CAP, marginBottom: 10 }}>Activity</div>
              <div style={{ maxHeight: 360, overflowY: 'auto' }}><K.RosHistoryTimeline history={doc.history} /></div>
            </div>
          </div>
        </div>
      )}
      {cell && doc && <RiCellPop cell={cell} doc={doc} year={year} month={month} can={can} busy={acting} onClose={() => setCell(null)} onMark={onMark} onUnmark={onUnmark} onEdit={onEdit} />}
      {!doc && !err && (
        <div style={{ ...RI_CARD, textAlign: 'center', padding: 34, color: '#6c7a8c', fontSize: 12.5 }}>
          {row.hasSheet ? 'Loading the sheet…' : 'Nobody has started this unit’s ' + R.MONTHS[month] + ' ' + year + ' roster yet.'}
        </div>
      )}
    </div>
  );
}

/* ================= the inbox ================= */
function RosterReviewFull({ setRoute, year: y0, month: m0 }) {
  const K = window.UNICO_ROSTER_KIT;
  const now = new Date();
  const [year, setYear] = useState(Number(y0) || now.getFullYear());
  const [month, setMonth] = useState(Number.isInteger(Number(m0)) && m0 != null ? Number(m0) : now.getMonth());
  const [tab, setTab] = useState(null);       // null = pick a sensible default once loaded
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const review = useRosterReview(year, month);
  const staffStore = K.useRosterStaff();
  const scope = K.useRosterScope();
  const decider = K.useRosDecide();

  const counts = useMemo(() => {
    const c = {};
    RI_TABS.forEach(([t]) => { c[t] = review.rows.filter((r) => riIn(t, r)).length; });
    return c;
  }, [review.rows]);
  // Open on what needs this person, if anything does; otherwise on everything.
  const curTab = tab || (counts.awaiting ? 'awaiting' : 'all');
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return review.rows.filter((r) => riIn(curTab, r))
      .filter((r) => !needle || [r.deptName, riPerson(r.incharge), riPerson(r.manager)].join(' ').toLowerCase().indexOf(needle) >= 0);
  }, [review.rows, curTab, q]);

  const period = R.MONTHS[month] + ' ' + year;
  const onDecide = (row, action, opts) => decider.run({ id: row.id, action, unit: row.deptName, period, warnings: 0, note: opts && opts.note })
    .then((r) => { if (r && r.ok) review.reload(); return r; });

  const may = scope.can || {};
  if (!scope.loading && !may.review && !may.setup) {
    return (
      <div className="card"><div className="card-b" style={{ display: 'grid', placeItems: 'center', padding: 44, textAlign: 'center', gap: 8 }}>
        <div style={{ opacity: .35 }}><Ic d={I.lock || I.grid} s={32} /></div>
        <div style={{ fontWeight: 700, fontSize: 14.5 }}>The review inbox is for Managers and the CNS</div>
        <div className="sub" style={{ maxWidth: 440 }}>An administrator gives an account its roster role under <b>Users &amp; Roles → Manage → Duty roster role</b>, and the units it checks under <b>Duty Roster → Setup</b>.</div>
      </div></div>
    );
  }

  return (
    <div className="mk-scope" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {decider.modal}
      {open ? (
        <RiPreview row={open} year={year} month={month} staff={staffStore.staff} busy={decider.busy} setRoute={setRoute}
          onBack={() => { setOpen(null); review.reload(); }} onDecide={onDecide} />
      ) : (
        <React.Fragment>
          <div className="card">
            <div className="card-h" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={MK.iconBadge('teal', 32)}><Ic d={I.check || I.grid} s={16} /></div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontWeight: 700, fontSize: 15.5, color: '#16202e' }}>Roster review — {period}</div>
                <div className="sub">{may.role === 'cns' ? 'Every unit. Approve what the Managers forwarded, or return it with a note.'
                  : may.role === 'manager' ? 'Your units. Forward checked rosters to the CNS, or return them with a note.'
                  : 'Every unit, where its roster is in the review chain.'}{review.cns && review.cns.name ? ' · CNS: ' + review.cns.name : ''}</div>
              </div>
              <select value={month} onChange={(e) => { setMonth(Number(e.target.value)); setOpen(null); }}>
                {R.MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select value={year} onChange={(e) => { setYear(Number(e.target.value)); setOpen(null); }}>
                {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
            <RiKpi label="Awaiting me" value={counts.awaiting} color="#d23a52" on={curTab === 'awaiting'} onClick={() => setTab('awaiting')} />
            <RiKpi label="In review" value={counts.inreview} color="#0072a3" on={curTab === 'inreview'} onClick={() => setTab('inreview')} />
            <RiKpi label="Returned" value={counts.returned} color="#b4232f" on={curTab === 'returned'} onClick={() => setTab('returned')} />
            <RiKpi label="Approved" value={counts.approved} color="#157a43" on={curTab === 'approved'} onClick={() => setTab('approved')} />
            <RiKpi label="Not submitted" value={counts.none} color="#b5670a" on={curTab === 'none'} onClick={() => setTab('none')} />
            <RiKpi label="Units" value={counts.all} color="#16202e" on={curTab === 'all'} onClick={() => setTab('all')} />
          </div>

          <div className="card">
            <div className="card-h" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="seg">
                {RI_TABS.map(([t, l]) => (
                  <button key={t} type="button" className={curTab === t ? 'on' : ''} onClick={() => setTab(t)}>{l}{counts[t] ? ' · ' + counts[t] : ''}</button>
                ))}
              </div>
              <div style={{ flex: 1 }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a unit or person…" style={{ minWidth: 200, padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(125,145,180,.35)', fontFamily: 'inherit', fontSize: 12 }} />
            </div>
            <div className="card-b" style={{ overflow: 'auto', padding: 0 }}>
              {review.loading && !review.rows.length ? <div className="sub" style={{ padding: 22, textAlign: 'center' }}>Loading…</div>
                : review.error ? <div style={{ padding: 22, textAlign: 'center', color: '#b4232f', fontSize: 12.5 }}>{review.error}</div>
                : !rows.length ? (
                  <div style={{ padding: 34, textAlign: 'center', color: '#6c7a8c', fontSize: 12.5 }}>
                    {curTab === 'awaiting' ? 'Nothing is waiting for you this month.' : 'No units here.'}
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr>{['Unit', 'In-charge', 'Manager', 'Staff', 'Status', 'Sent', 'Last saved', 'Steps'].map((h) => (
                      <th key={h} style={{ ...RI_TH, textAlign: h === 'Steps' ? 'right' : h === 'Staff' ? 'center' : 'left' }}>{h}</th>
                    ))}</tr></thead>
                    <tbody>
                      {rows.map((r) => {
                        const st = riNorm(r);
                        return (
                          <tr key={(r.dept || '') + '|' + (r.id || r.deptName)} onClick={() => setOpen(r)} style={{ cursor: 'pointer', background: r.pendingForMe ? 'rgba(210,58,82,.04)' : st === 'returned' ? 'rgba(210,58,82,.03)' : undefined }}>
                            <td style={{ ...RI_TD, fontWeight: 700, color: '#16202e' }}>
                              {r.pendingForMe && <span title="Waiting for you" style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#d23a52', marginRight: 7, verticalAlign: 'middle' }} />}
                              {r.deptName}{r.dept === null && <span className="sub" style={{ fontWeight: 500 }}> · unmapped</span>}
                            </td>
                            <td style={RI_TD}>{riPerson(r.incharge) || <span style={{ color: '#b5670a', fontSize: 11 }}>not set</span>}</td>
                            <td style={RI_TD}>{riPerson(r.manager) || <span style={{ color: '#b5670a', fontSize: 11 }}>not set</span>}</td>
                            <td style={{ ...RI_TD, textAlign: 'center', fontFamily: "'IBM Plex Mono',monospace" }}>{r.hasSheet ? (r.staffCount || 0) : '—'}</td>
                            <td style={RI_TD}>
                              {r.hasSheet ? <K.RosStatusChip st={r.status} /> : <K.RosStatusChip st={null} />}
                              {st === 'returned' && r.returnNote && <div className="sub" title={r.returnNote} style={{ fontSize: 10.5, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>“{r.returnNote}”</div>}
                            </td>
                            <td style={{ ...RI_TD, whiteSpace: 'nowrap', fontSize: 11.5, color: '#6c7a8c' }}>{r.sentAt && riSentShown(st) ? K.when(r.sentAt) + (r.sentByName || r.sentBy ? ' · ' + (r.sentByName || r.sentBy) : '') : '—'}</td>
                            <td style={{ ...RI_TD, whiteSpace: 'nowrap', fontSize: 11.5, color: '#6c7a8c' }}>{r.updatedAt ? K.when(r.updatedAt) + (r.updatedBy ? ' · ' + r.updatedBy : '') : '—'}</td>
                            <td style={{ ...RI_TD, textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                              <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                {r.hasSheet && r.can && (r.can.forward || r.can.approve || r.can.return)
                                  ? <K.RosDecisionButtons status={r.status} can={{ forward: r.can.forward, approve: r.can.approve, return: r.can.return }} onAction={(a) => onDecide(r, a)} busy={decider.busy} compact />
                                  : null}
                                <button className="btn sm" type="button" onClick={() => (r.hasSheet ? setOpen(r) : setRoute({ view: 'rosterGrid', dept: r.sheetDept || r.deptName, year, month }))}>{r.hasSheet ? 'Open' : 'Open sheet'}</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
            </div>
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

window.RosterReviewFull = RosterReviewFull;
window.RosterInbox = RosterReviewFull;
