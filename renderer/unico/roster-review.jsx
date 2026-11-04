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

const { useState, useEffect, useMemo, useCallback } = React;
const Ic = window.Ic, I = window.I;
const R = window.UNICO_ROSTER;
const MK = window.MK;

// The preview's sheet + decision columns stack on a narrow screen.
(function riCss() {
  if (typeof document === 'undefined' || document.getElementById('ri-css')) return;
  const el = document.createElement('style');
  el.id = 'ri-css';
  el.textContent = '@media (max-width: 960px){ .ri-split{ grid-template-columns: 1fr !important; } .ri-split > div{ position: static !important; } }';
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

/* ---- one sheet, read-only, with the decision panel ---- */
function RiPreview({ row, year, month, staff, onBack, onDecide, busy, setRoute }) {
  const K = window.UNICO_ROSTER_KIT;
  const [doc, setDoc] = useState(null);
  const [extra, setExtra] = useState({ signers: {}, can: null });
  const [err, setErr] = useState('');
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
    return { hours, shifts, over };
  }, [view, year, month]);

  const decide = (action) => onDecide({ ...row, id: (doc && doc.id) || row.id }, action).then((r) => { if (r && r.ok) load(); });
  const period = R.MONTHS[month] + ' ' + year;
  const card = { background: 'linear-gradient(152deg,rgba(255,255,255,.82),rgba(236,247,255,.5))', border: '1px solid rgba(255,255,255,.92)', borderRadius: 16, boxShadow: '0 12px 34px rgba(31,59,90,.11)', padding: '14px 16px' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button className="btn sm" type="button" onClick={onBack}>‹ Back to the list</button>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: '#16202e' }}>{row.deptName} · {period}</div>
          <div style={{ fontSize: 11.5, color: '#6c7a8c' }}>{doc ? 'rev ' + (doc.revision || 0) + (doc.updatedBy ? ' · last saved by ' + doc.updatedBy + ' · ' + K.when(doc.updatedAt) : '') : 'No sheet saved for this month'}</div>
        </div>
        <K.RosStatusChip st={doc ? doc.status : null} big />
        <button className="btn sm" type="button" onClick={() => setRoute({ view: 'rosterGrid', dept, year, month })}>Open in editor</button>
        {doc && <button className="btn sm" type="button" onClick={() => setRoute({ view: 'rosterPrint', dept, year, month })}>Print</button>}
      </div>

      {err && <div style={{ ...card, color: '#b4232f', fontSize: 12.5 }}>{err}</div>}
      {doc && K.statusNorm(doc.status) === 'returned' && <K.RosReturnedBanner meta={doc} />}

      {doc && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 330px', gap: 14, alignItems: 'start' }} className="ri-split">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
              {[['Staff on sheet', view.rows.length, '#0072a3'], ['Shifts', stats.shifts, '#2b9488'], ['Total hours', stats.hours, '#5b45c4'],
                ['Over ' + RI_OVERTIME_H + ' h', stats.over, stats.over ? '#b5670a' : '#157a43'], ['Rule warnings', ev ? ev.totalViol : 0, ev && ev.totalViol ? '#b4232f' : '#157a43']].map(([l, v, c]) => (
                <div key={l} style={{ ...card, padding: '10px 12px' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 18, fontWeight: 700, color: c }}>{v}</div>
                  <div style={{ fontSize: 10.5, color: '#6c7a8c' }}>{l}</div>
                </div>
              ))}
            </div>
            <K.RosSheetTable rows={view.rows} grid={view.grid} year={year} month={month} maxHeight="56vh" />
            {ev && (
              <div style={card}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#16202e', marginBottom: 8 }}>Rule checks <span style={{ fontWeight: 500, color: '#8a97a8' }}>· {ev.okRules} of {ev.rules.length} clear</span></div>
                {ev.rules.map(([rule, base, list], i) => (
                  <div key={rule + i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderTop: i ? '1px solid rgba(125,145,180,.12)' : 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0, background: list.length ? '#d23a52' : '#1f9d57' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#16202e' }}>{rule}</div>
                      <div style={{ fontSize: 11, color: '#6c7a8c' }}>{list.length ? list.slice(0, 3).join(' · ') + (list.length > 3 ? ' +' + (list.length - 3) + ' more' : '') : base}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: list.length ? '#a92c42' : '#157a43' }}>{list.length || 'ok'}</span>
                  </div>
                ))}
              </div>
            )}
            <K.RosSignOff signers={extra.signers} meta={doc} dept={row.deptName} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 12 }}>
            <div style={card}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: .5, textTransform: 'uppercase', color: '#7d8ea8', marginBottom: 8 }}>Decision</div>
              <div style={{ fontSize: 12.5, color: '#16202e', fontWeight: 600, marginBottom: 4 }}>
                {doc.sentAt && riSentShown(K.statusNorm(doc.status)) ? 'Sent ' + K.when(doc.sentAt) + ' by ' + (doc.sentByName || doc.sentBy || '—') : 'With the in-charge — not sent for review yet'}
              </div>
              <div style={{ fontSize: 11.5, color: '#6c7a8c', marginBottom: 12 }}>
                {ev && ev.totalViol ? ev.totalViol + ' rule warning' + (ev.totalViol === 1 ? '' : 's') + ' on this sheet. ' : 'No rule warnings. '}
                {stats.over ? stats.over + ' staff over ' + RI_OVERTIME_H + ' h.' : ''}
              </div>
              {K.RosDecisionButtons({ status: doc.status, can: extra.can, onAction: decide, busy, hasManager: !!(extra.signers && extra.signers.manager) })
                || <div style={{ fontSize: 11.5, color: '#8a97a8' }}>No step for you on this sheet right now.</div>}
            </div>
            <div style={card}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: .5, textTransform: 'uppercase', color: '#7d8ea8', marginBottom: 10 }}>History</div>
              <K.RosHistoryTimeline history={doc.history} />
            </div>
          </div>
        </div>
      )}
      {!doc && !err && (
        <div style={{ ...card, textAlign: 'center', padding: 34, color: '#6c7a8c', fontSize: 12.5 }}>
          {row.hasSheet ? 'Loading the sheet…' : 'Nobody has started this unit’s ' + period + ' roster yet.'}
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
