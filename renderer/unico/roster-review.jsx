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
  const steps = [
    { label: 'Prepared', who: (sent && doc.preparedBy) || nm(sg.incharge) || 'In-charge not set', role: 'In-charge',
      state: sent ? 'done' : 'current', sub: sent ? 'Sent ' + K.when(sent.at) : st === 'returned' ? 'Being corrected after return' : 'Not sent yet' },
    { label: 'Checked', who: (fwd && doc.checkedBy) || nm(sg.manager) || 'Manager not set', role: 'Nurse Manager',
      state: fwd ? 'done' : st === 'pending_manager' ? 'current' : (ret && ret.stage === 'manager') ? 'returned' : (sent && sent.action === 'send_cns') ? 'skipped' : 'todo',
      sub: fwd ? 'Forwarded ' + K.when(fwd.at) : st === 'pending_manager' ? 'Checking now' : (ret && ret.stage === 'manager') ? 'Returned ' + K.when(ret.at) : (sent && sent.action === 'send_cns') ? 'Skipped — sent straight to CNS' : 'Waiting' },
    { label: 'Approved', who: (ok && doc.approvedBy) || nm(sg.cns) || 'CNS not set', role: 'Chief of Nursing Services',
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

/* ---- one sheet, read-only, with the decision panel ---- */
function RiPreview({ row, year, month, staff, onBack, onDecide, busy, setRoute }) {
  const K = window.UNICO_ROSTER_KIT;
  const [doc, setDoc] = useState(null);
  const [extra, setExtra] = useState({ signers: {}, can: null });
  const [err, setErr] = useState('');
  const [showClear, setShowClear] = useState(false);
  const [openRule, setOpenRule] = useState({});
  const rulesRef = useRef(null);
  const dept = row.sheetDept || row.deptName;
  const load = useCallback(() => K.api.get('/api/rosters/' + encodeURIComponent(dept) + '/' + year + '/' + month).then((r) => {
    if (r && r.ok) { setDoc(r.roster || null); setExtra({ signers: r.signers || {}, can: (r.roster && r.roster.can) || r.can || null }); setErr(''); }
    else setErr((r && r.error) || 'Could not load the sheet.');
  }).catch(() => setErr('Could not reach the server.')), [dept, year, month]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const view = useMemo(() => (doc ? K.rowsFrom(doc, staff, dept, undefined, extra.signers && extra.signers.incharge && extra.signers.incharge.name) : { rows: [], grid: {} }), [doc, staff, dept, extra]);   // eslint-disable-line react-hooks/exhaustive-deps
  const ev = useMemo(() => (doc ? K.findingsOf(view.grid, view.rows, year, month, doc.rules) : null), [doc, view, year, month]);   // eslint-disable-line react-hooks/exhaustive-deps
  const stats = useMemo(() => {
    const days = R.daysIn(year, month);
    let hours = 0, shifts = 0, over = 0;
    view.rows.forEach((x) => {
      const t = R.totalsFor(view.grid[x.empId] || {}, days);
      hours += t.hours; shifts += t.G + t.M + t.E + t.N;
      if (t.hours > RI_OVERTIME_H) over++;
    });
    return { hours, shifts, over, pca: view.rows.filter((x) => x.pca).length };
  }, [view, year, month]);
  const me = (window.__UNICO_USER__ && (window.__UNICO_USER__.name || window.__UNICO_USER__.username)) || '';
  const html = useMemo(() => (doc && K.printHtml ? K.printHtml({ dept, year, month, doc, rows: view.rows, grid: view.grid, signers: extra.signers, colour: true, summary: true, legend: true, printedBy: me }) : ''),
    [doc, view, extra, dept, year, month, me]);   // eslint-disable-line react-hooks/exhaustive-deps

  const decide = (action) => onDecide({ ...row, id: (doc && doc.id) || row.id }, action).then((r) => { if (r && r.ok) load(); });
  const days = R.daysIn(year, month);
  const d2 = (d) => String(d).padStart(2, '0') + ' ' + R.MONTHS[month].slice(0, 3) + ' ' + year;
  const card = { background: 'linear-gradient(152deg,rgba(255,255,255,.86),rgba(240,248,255,.6))', border: '1px solid rgba(255,255,255,.95)', borderRadius: 16, boxShadow: '0 12px 34px rgba(31,59,90,.1)', padding: '14px 18px' };
  const cap = { fontSize: 10, fontWeight: 800, letterSpacing: .9, textTransform: 'uppercase', color: '#7d8ea8' };
  const st = K.statusNorm(doc ? doc.status : null);
  const can = extra.can || {};
  const failing = ev ? ev.rules.filter((r) => r[2].length) : [];
  const clear = ev ? ev.rules.filter((r) => !r[2].length) : [];
  const roleLine = can.approve ? 'You are approving as the CNS' : can.forward ? 'You are checking as the Manager' : can.send ? 'You prepare this roster' : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* header + where it is in the chain */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <button className="btn sm" type="button" onClick={onBack}>‹ Back</button>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0d1b2e', letterSpacing: -.2 }}>{row.deptName}</div>
            <div style={{ fontSize: 12.5, color: '#0072a3', fontWeight: 700 }}>{R.MONTHS[month]} {year} <span style={{ color: '#8a97a8', fontWeight: 500 }}>· {d2(1)} – {d2(days)}</span></div>
            {doc && <div style={{ fontSize: 11, color: '#8a97a8', marginTop: 1 }}>{doc.updatedBy ? 'Last saved by ' + doc.updatedBy + ' · ' + K.when(doc.updatedAt) : ''}</div>}
          </div>
          <K.RosStatusChip st={doc ? doc.status : null} big />
          <button className="btn sm" type="button" onClick={() => setRoute({ view: 'rosterGrid', dept, year, month })}>Open in editor</button>
          {doc && <button className="btn sm" type="button" onClick={() => setRoute({ view: 'rosterPrint', dept, year, month })}>Print / PDF</button>}
        </div>
        {doc && <RiTracker doc={doc} signers={extra.signers} />}
      </div>

      {err && <div style={{ ...card, color: '#b4232f', fontSize: 12.5 }}>{err}</div>}

      {doc && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 14, alignItems: 'start' }} className="ri-split">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            {/* one summary strip */}
            <div style={{ ...card, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(5,1fr)' }} className="ri-sum">
              {[
                ['Staff', view.rows.length, stats.pca ? (view.rows.length - stats.pca) + ' nurses · ' + stats.pca + ' PCA' + (stats.pca === 1 ? '' : 's') : 'on the sheet', '#0d1b2e', null],
                ['Shifts', stats.shifts, 'duty shifts this month', '#0072a3', null],
                ['Total hours', stats.hours, 'all staff', '#5b45c4', null],
                ['Over ' + RI_OVERTIME_H + ' h', stats.over, stats.over ? 'staff — check overtime' : 'nobody', stats.over ? '#b5670a' : '#157a43', null],
                ['Rule warnings', ev ? ev.totalViol : 0, failing.length ? failing.length + ' rule' + (failing.length === 1 ? '' : 's') + ' not met' : 'all rules met', ev && ev.totalViol ? '#b4232f' : '#157a43',
                  () => { if (rulesRef.current) rulesRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }],
              ].map(([l, v, sub, c, onClick], i) => (
                <div key={l} onClick={onClick || undefined} style={{ padding: '11px 16px', borderLeft: i ? '1px solid rgba(125,145,180,.18)' : 0, cursor: onClick ? 'pointer' : 'default' }}>
                  <div style={cap}>{l}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 20, fontWeight: 700, color: c, lineHeight: 1.2 }}>{v}</div>
                  <div style={{ fontSize: 10.5, color: '#8a97a8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* rule checks: what needs attention first, the rest folded away */}
            {ev && (
              <div ref={rulesRef} style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: failing.length ? 10 : 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#16202e' }}>Rule checks</div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 10, color: failing.length ? '#b4232f' : '#157a43', background: failing.length ? 'rgba(210,58,82,.1)' : 'rgba(31,157,87,.12)' }}>
                    {failing.length ? failing.length + ' need attention' : 'all clear'}
                  </span>
                  <span style={{ fontSize: 11, color: '#8a97a8' }}>· nurse cover counts nurses only; PCAs are checked for their own hours and rest</span>
                </div>
                {failing.map(([rule, base, list]) => {
                  const open = !!openRule[rule];
                  const shown = open ? list : list.slice(0, 3);
                  return (
                    <div key={rule} style={{ display: 'flex', gap: 12, padding: '9px 0', borderTop: '1px solid rgba(125,145,180,.14)' }}>
                      <span style={{ minWidth: 34, height: 22, borderRadius: 11, display: 'inline-grid', placeItems: 'center', fontSize: 11, fontWeight: 800, color: '#fff', background: '#d23a52', flexShrink: 0 }}>{list.length}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#16202e' }}>{rule} <span style={{ fontWeight: 500, color: '#9aa6b4', fontSize: 11 }}>· {base}</span></div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                          {shown.map((f, i) => <span key={i} style={{ fontSize: 10.5, color: '#8c1d2a', background: 'rgba(210,58,82,.07)', border: '1px solid rgba(210,58,82,.16)', borderRadius: 6, padding: '1px 7px' }}>{f}</span>)}
                          {list.length > 3 && (
                            <button type="button" onClick={() => setOpenRule((o) => ({ ...o, [rule]: !open }))} style={{ border: 0, background: 'none', color: '#0072a3', fontSize: 10.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                              {open ? 'Show less' : '+' + (list.length - 3) + ' more'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {clear.length > 0 && (
                  <div style={{ borderTop: failing.length ? '1px solid rgba(125,145,180,.14)' : 0, paddingTop: failing.length ? 9 : 8 }}>
                    <button type="button" onClick={() => setShowClear((v) => !v)} style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: '#157a43' }}>
                      ✓ {clear.length} rule{clear.length === 1 ? '' : 's'} clear {showClear ? '▴' : '▾'}
                    </button>
                    {showClear
                      ? <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>{clear.map(([rule, base]) => <div key={rule} style={{ fontSize: 11.5, color: '#3c4858' }}><span style={{ color: '#1f9d57', fontWeight: 800 }}>✓</span> {rule} <span style={{ color: '#9aa6b4' }}>· {base}</span></div>)}</div>
                      : <span style={{ fontSize: 11, color: '#8a97a8', marginLeft: 6 }}>{clear.map((r) => r[0]).join(' · ')}</span>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* decision */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ ...card, borderTop: '3px solid ' + (st === 'pending_cns' ? '#5b45c4' : st === 'pending_manager' ? '#0072a3' : st === 'approved' ? '#1f9d57' : st === 'returned' ? '#d23a52' : '#b5670a') }}>
              <div style={cap}>Your decision</div>
              {roleLine && <div style={{ fontSize: 13, fontWeight: 700, color: '#16202e', marginTop: 4 }}>{roleLine}</div>}
              <div style={{ fontSize: 11.5, color: '#6c7a8c', marginTop: 3 }}>
                {doc.sentAt && riSentShown(st) ? 'Sent ' + K.when(doc.sentAt) + ' by ' + (doc.sentByName || doc.sentBy || '—') : 'With the in-charge — not sent for review yet'}
              </div>
              {(ev && ev.totalViol) || stats.over ? (
                <div style={{ marginTop: 10, background: 'rgba(224,138,30,.09)', border: '1px solid rgba(224,138,30,.28)', borderRadius: 9, padding: '7px 10px', fontSize: 11.5, color: '#8a5a00', lineHeight: 1.5 }}>
                  {ev && ev.totalViol ? <div>⚠ {ev.totalViol} rule warning{ev.totalViol === 1 ? '' : 's'} on this sheet</div> : null}
                  {stats.over ? <div>⚠ {stats.over} staff over {RI_OVERTIME_H} hours</div> : null}
                </div>
              ) : (
                <div style={{ marginTop: 10, background: 'rgba(31,157,87,.08)', border: '1px solid rgba(31,157,87,.25)', borderRadius: 9, padding: '7px 10px', fontSize: 11.5, color: '#157a43' }}>✓ No rule warnings, nobody over {RI_OVERTIME_H} hours</div>
              )}
              <div className="ri-dec" style={{ marginTop: 12 }}>
                {K.RosDecisionButtons({ status: doc.status, can: extra.can, onAction: decide, busy, hasManager: !!(extra.signers && extra.signers.manager) })
                  || <div style={{ fontSize: 11.5, color: '#8a97a8' }}>{st === 'approved' ? 'Approved — this roster is published.' : 'No step for you on this roster right now.'}</div>}
              </div>
              {(can.return || can.approve || can.forward) && <div style={{ fontSize: 10.5, color: '#9aa6b4', marginTop: 8 }}>Return sends it back to the in-charge, flagged red; a reason is optional.</div>}
            </div>
            <div style={card}>
              <div style={{ ...cap, marginBottom: 10 }}>Activity</div>
              <K.RosHistoryTimeline history={doc.history} />
            </div>
          </div>
        </div>
      )}
      {/* the roster exactly as it will be printed and published — full width, so it reads at size */}
      {doc && (
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '2px 2px 8px' }}>
            <span style={{ fontSize: 13.5, fontWeight: 800, color: '#16202e' }}>The roster</span>
            <span style={{ fontSize: 11, color: '#8a97a8' }}>exactly as it will be printed and published</span>
          </div>
          {html ? <RiSheetFrame html={html} /> : <K.RosSheetTable rows={view.rows} grid={view.grid} year={year} month={month} maxHeight="56vh" />}
        </div>
      )}
      {!doc && !err && (
        <div style={{ ...card, textAlign: 'center', padding: 34, color: '#6c7a8c', fontSize: 12.5 }}>
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
  const onDecide = (row, action) => decider.run({ id: row.id, action, unit: row.deptName, period, warnings: 0 })
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
