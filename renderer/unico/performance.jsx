/* UNICO — Individual Performance module (renderer).
 *
 * The 6-monthly nursing appraisal, Form HR-NUR-PA-01, end to end: score it, discuss
 * it, let the Chief Nursing Superintendent act on it, print it 1:1 with the paper
 * form, and keep the achievement and incident registers whose points feed into it.
 *
 * Views (rendered one at a time inside the global shell, like QualityView):
 *   perfHome         dashboard — cycle progress, department progress, grade mix, reminders
 *   perfDirectory    every staff member with their appraisal status for this cycle
 *   perfForm         the appraisal form itself (10 sections, 20 parameters, live total)
 *   perfPrint        printable form, 1:1 with the paper original
 *   perfStaff        one person's performance record — trend, history, points, conduct
 *   perfQueue        CNS review queue — Part H, action and lock
 *   perfAchievements achievement register (bonus points, capped) + per-staff Achievement
 *                    History, a sub-screen of the register
 *   perfIncidents    incident register (deductions, capped) + per-staff Incident History
 *   perfCompare      department comparison
 *   perfAttrition    attrition overview (performance-hr.jsx) + the Department Attrition
 *                    and Leaver Record drill-ins, hosted here
 *
 * The four drill-in screens are SUB-SCREENS, not routes: a new perf* route name would
 * have to be registered in ui.jsx (UNICO_MODULE_VIEWS, or the sidebar highlights the
 * wrong workspace) and app.jsx (PV_TITLE, or the breadcrumb reads "Dashboard"), and
 * this file owns neither.
 *
 * THE APPRAISAL WINDOW IS PERSONAL, NOT CALENDAR. Every window runs six months from
 * the individual's own date of joining, so a new joiner's first appraisal falls six
 * months after they start rather than at the next org-wide season. All of that lives
 * in appraisal-spec.js (window.UNICO_APPRAISAL) — this file only renders it.
 *
 * Data: server/staff-performance.js (/api/performance). Staff records come from the
 * existing window.useStaffStore(), so there is ONE roster in the app, not two.
 */

const { useState, useEffect, useMemo, useRef } = React;
const Ic = window.Ic, I = window.I;
const A = window.UNICO_APPRAISAL;
const MK = window.MK;   // the mockup's design tokens — see mockup-ui.js

/* ---------------- helpers ---------------- */
const perfApi = {
  get: (u) => fetch(u, { headers: { accept: 'application/json' } }).then((r) => r.json()),
  put: (u, b) => fetch(u, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b || {}) }).then((r) => r.json()),
  post: (u, b) => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b || {}) }).then((r) => r.json()),
  del: (u) => fetch(u, { method: 'DELETE' }).then((r) => r.json()),
};
const perfToast = (m, t) => { try { window.UI && window.UI.toast && window.UI.toast(m, t || 'success'); } catch (e) { /* no toast host */ } };
const perfIsAdmin = () => { try { const u = window.__UNICO_USER__; return !u || u.role === 'Administrator'; } catch (e) { return true; } };
const perfCan = (a) => { try { return window.unicoCan ? window.unicoCan('perf', a) : true; } catch (e) { return true; } };
const todayISO = () => { try { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); } catch (e) { return ''; } };
const perfPortal = (node) => { try { if (typeof ReactDOM !== 'undefined' && ReactDOM.createPortal) return ReactDOM.createPortal(node, document.body); } catch (e) {} return node; };
const initials = (n) => String(n || '').split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// Grade colours are the mockup's own GC table, so a B looks identical on a pill, a bar
// and the printed certificate.
const gradeColor = (g) => MK.GC[g] || '#5b6b80';

function GradePill({ grade, score, size }) {
  return (
    <span style={Object.assign({}, MK.gchip(grade, size === 'lg'), { gap: 6 })}>
      {grade || '—'}{score != null && <span style={{ opacity: .75 }}>{score}</span>}
    </span>
  );
}

// The status of one person's appraisal for one window.
const STATUS_META = {
  none: { label: 'Not started' },
  draft: { label: 'In progress' },
  submitted: { label: 'Awaiting discussion' },
  discussed: { label: 'Awaiting Part H' },
  actioned: { label: 'Actioned' },
};
function StatusChip({ st }) {
  const label = (STATUS_META[st || 'none'] || STATUS_META.none).label;
  return <span style={MK.stChip(label)}>{label}</span>;
}

/* ---------------- data store ---------------- */
// One fetch for the whole module, then optimistic-free re-reads after every write:
// these are personal-file records, so the register the server holds is always the one
// shown rather than a locally patched guess.
/* The per-cycle bonus / penalty caps. The SERVER is the authority — it clamps on write
   (staff-performance.js) and returns them as `caps` — so a screen that quotes a cap must
   quote the server's, with the shared spec as the fallback for a response that predates
   the field. Nothing here writes the number 5 into the copy. */
const DEFAULT_CAPS = { bonus: A.BONUS_CAP, penalty: A.PENALTY_CAP };
const capsOf = (perf) => {
  const c = (perf && perf.caps) || {};
  const n = (v, fb) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : fb);
  return { bonus: n(c.bonus, A.BONUS_CAP), penalty: n(c.penalty, A.PENALTY_CAP) };
};

function usePerfStore() {
  const [state, setState] = useState({ appraisals: [], incidents: [], achievements: [], exits: [], caps: DEFAULT_CAPS, loading: true, error: null });
  const load = React.useCallback(() => {
    return perfApi.get('/api/performance').then((r) => {
      if (r && r.ok) setState({ appraisals: r.appraisals || [], incidents: r.incidents || [], achievements: r.achievements || [], exits: r.exits || [], caps: r.caps || DEFAULT_CAPS, loading: false, error: null });
      else setState((s) => ({ ...s, loading: false, error: (r && r.error) || 'Could not load performance records.' }));
    }).catch(() => setState((s) => ({ ...s, loading: false, error: 'Could not reach the server.' })));
  }, []);
  useEffect(() => { load(); }, [load]);

  const wrap = (p, okMsg) => p.then((r) => {
    if (r && r.ok) { if (okMsg) perfToast(okMsg); return load().then(() => r); }
    perfToast((r && r.error) || 'That did not save.', 'error');
    return r;
  }).catch(() => { perfToast('Could not reach the server.', 'error'); return { ok: false }; });

  return {
    ...state,
    reload: load,
    saveAppraisal: (body, msg) => wrap(perfApi.put('/api/performance/appraisals', body), msg),
    recordAction: (id, body) => wrap(perfApi.post('/api/performance/appraisals/' + id + '/action', body), 'Action recorded. The form is now filed to the personal record.'),
    reopen: (id) => wrap(perfApi.post('/api/performance/appraisals/' + id + '/reopen', {}), 'Appraisal reopened for correction.'),
    addIncident: (body) => wrap(perfApi.post('/api/performance/incidents', body), 'Incident recorded. The deduction now shows on the appraisal.'),
    delIncident: (id) => wrap(perfApi.del('/api/performance/incidents/' + id), 'Entry removed.'),
    addAchievement: (body) => wrap(perfApi.post('/api/performance/achievements', body), 'Achievement recorded. Bonus points are on the current appraisal.'),
    addExit: (body) => wrap(perfApi.post('/api/performance/exits', body), 'Exit recorded. The attrition figures and the unit roll-up update immediately.'),
    delExit: (id) => wrap(perfApi.del('/api/performance/exits/' + id), 'Exit record removed.'),
    delAchievement: (id) => wrap(perfApi.del('/api/performance/achievements/' + id), 'Entry removed.'),
  };
}

// Everything the module needs to know about one staff member, in one object.
function useRoster(staffStore, perf) {
  return useMemo(() => {
    const now = new Date();
    const list = (staffStore.staff || []).filter((e) => e.is_active !== false && !e.former);
    const byEmp = {};
    const rows = list.map((e) => {
      const empId = e.emp_id || String(e.id);
      const cyc = A.cycleOf(e.doj, now);
      const apr = perf.appraisals.find((x) => x.empId === empId && cyc && x.cycleId === cyc.id) || null;
      const history = perf.appraisals.filter((x) => x.empId === empId && x.status === 'actioned')
        .sort((a, b) => String(b.cycleStart).localeCompare(String(a.cycleStart)));
      const last = history[0] || null;
      const inc = perf.incidents.filter((x) => x.empId === empId && cyc && x.cycleId === cyc.id);
      const ach = perf.achievements.filter((x) => x.empId === empId && cyc && x.cycleId === cyc.id);
      const firstDue = e.doj ? A.addMonths(A.parseDate(e.doj) || now, 6) : null;
      const neverAppraised = history.length === 0;
      /* OVERDUE = a window that has already CLOSED with nothing filed against it.

         cycleOf() only ever returns the window CONTAINING today, whose due date is by
         definition still in the future — so testing it can never be true. The closed
         windows come from cyclesSince(), newest first. Testing the open window instead
         would flag the entire roster the morning a new cycle starts, which is what the
         two earlier versions of this line did in opposite directions. */
      const lastClosed = e.doj ? (A.cyclesSince(e.doj, now, 1) || [])[0] : null;
      const missedClosed = !!(lastClosed && !perf.appraisals.some((x) => x.empId === empId && x.cycleId === lastClosed.id));
      const row = {
        emp: e, empId, name: e.name, designation: e.designation, dept: e.current_department,
        doj: e.doj, cycle: cyc, appraisal: apr, status: apr ? apr.status : 'none',
        history, last, incidents: inc, achievements: ach,
        firstDue, neverAppraised,
        lastClosed,
      overdue: missedClosed,
      // Never appraised AND past their first six months: the new-joiner reminder,
      // which is a different question from "a window closed unappraised".
      newJoinerDue: !!(neverAppraised && firstDue && firstDue <= now),
      };
      byEmp[empId] = row;
      return row;
    });
    return { rows, byEmp };
  }, [staffStore.staff, perf.appraisals, perf.incidents, perf.achievements]);
}

/* ---------------- small presentational pieces ---------------- */
// The mockup's KPI tile: rounded pastel icon badge, uppercase label, big mono value.
function Stat({ label, value, sub, tone, icon, tint }) {
  return (
    <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={MK.iconBadge(tint || 'blue')}><Ic d={icon || I.grid} s={18} /></div>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: .5, textTransform: 'uppercase', color: MK.FAINT }}>{label}</div>
      </div>
      <div className="num" style={{ fontSize: 28, fontWeight: 700, color: tone || MK.INK, lineHeight: 1, letterSpacing: '-.5px' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: MK.FAINT }}>{sub}</div>}
    </div>
  );
}

function Bar({ value, max, color, height }) {
  const w = max ? (value / max) * 100 : 0;
  return <div style={MK.track(height || 7)}><div style={MK.fill(w, color || '#0090ca')} /></div>;
}

// The out-of-100 dial on the appraisal form. Pure SVG so it prints.
function Gauge({ score, grade }) {
  const c = gradeColor(grade);
  const r = 62, circ = Math.PI * r;                     // half circle
  const frac = Math.max(0, Math.min(1, (Number(score) || 0) / 100));
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width="170" height="98" viewBox="0 0 170 98">
        <path d="M23 88 A62 62 0 0 1 147 88" fill="none" stroke="rgba(130,150,175,.22)" strokeWidth="13" strokeLinecap="round" />
        <path d="M23 88 A62 62 0 0 1 147 88" fill="none" stroke={c} strokeWidth="13" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - frac)} style={{ transition: 'stroke-dashoffset .5s ease, stroke .3s' }} />
        <text x="85" y="76" textAnchor="middle" style={{ fontSize: 30, fontWeight: 700, fill: c }}>{score}</text>
        <text x="85" y="92" textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--muted, #8aa0b8)' }}>of 100</text>
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted,#8aa0b8)', padding: '0 14px', marginTop: -6 }}>
        <span>0</span><span>50</span><span>100</span>
      </div>
    </div>
  );
}

function Empty({ icon, title, sub, action }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', padding: '46px 20px', textAlign: 'center', gap: 8 }}>
      <div style={{ opacity: .35 }}><Ic d={icon || I.doc} s={34} /></div>
      <div style={{ fontWeight: 600 }}>{title}</div>
      {sub && <div className="sub" style={{ maxWidth: 420 }}>{sub}</div>}
      {action}
    </div>
  );
}

function Modal({ title, sub, onClose, children, wide, footer }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return perfPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(9,17,28,.55)', backdropFilter: 'blur(2px)', zIndex: 9000, display: 'grid', placeItems: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: wide ? 'min(920px,96vw)' : 'min(560px,96vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="card-h" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>{title}</div>
            {sub && <div className="sub" style={{ fontSize: 11.5 }}>{sub}</div>}
          </div>
          <button className="icon-btn" onClick={onClose} title="Close"><Ic d={I.x || 'M18 6L6 18M6 6l12 12'} s={16} /></button>
        </div>
        <div className="card-b" style={{ overflow: 'auto', flex: 1 }}>{children}</div>
        {footer && <div className="card-h" style={{ borderTop: '1px solid var(--line,#e3e9f1)', borderBottom: 0, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>{footer}</div>}
      </div>
    </div>
  );
}

/* ================= 1. DASHBOARD ================= */
function PerfDashboard({ roster, perf, setRoute }) {
  const rows = roster.rows;
  const done = rows.filter((r) => r.status === 'actioned').length;
  const prog = rows.filter((r) => ['draft', 'submitted', 'discussed'].indexOf(r.status) >= 0).length;
  const not = rows.length - done - prog;
  const overdue = rows.filter((r) => r.overdue);
  const org = A.orgCycle(new Date());

  // Department roll-up: how far each unit has got, and how its completed forms scored.
  const byDept = useMemo(() => {
    const m = {};
    rows.forEach((r) => {
      const d = r.dept || 'Unassigned';
      const e = m[d] || (m[d] = { dept: d, due: 0, done: 0, scores: [] });
      e.due++;
      if (r.status === 'actioned') { e.done++; if (r.appraisal) e.scores.push(r.appraisal.score); }
    });
    return Object.values(m).map((e) => ({
      ...e, avg: e.scores.length ? Math.round(e.scores.reduce((a, b) => a + b, 0) / e.scores.length) : null,
    })).sort((a, b) => b.due - a.due);
  }, [rows]);

  const gradeMix = useMemo(() => {
    const m = {};
    rows.forEach((r) => { if (r.status === 'actioned' && r.appraisal) m[r.appraisal.grade] = (m[r.appraisal.grade] || 0) + 1; });
    return A.GRADES.map((g) => ({ grade: g.grade, n: m[g.grade] || 0 }));
  }, [rows]);
  const graded = gradeMix.reduce((t, g) => t + g.n, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* page header — icon badge, title, primary actions (mockup: Performance Dashboard) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={MK.iconBadge('blue', 34)}><Ic d={I.doc} s={17} /></div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontWeight: 600, fontSize: 15.5, color: MK.INK }}>Individual Performance &mdash; Nursing &amp; PCA</div>
          <div style={{ fontSize: 11.5, color: MK.MUTED }}>6-monthly per individual &mdash; anchored to each date of joining &middot; 20 parameters &middot; out of 100</div>
        </div>
        <button className="btn" onClick={() => setRoute({ view: 'perfCompare' })}>Compare</button>
        <button className="btn" onClick={() => setRoute({ view: 'perfDirectory' })}>Rankings</button>
        {perfCan('add') && <button className="btn pri" onClick={() => setRoute({ view: 'perfDirectory' })}>+ New Appraisal</button>}
      </div>

      {/* current-cycle band */}
      <div className="card" style={{ padding: '15px 18px', display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 250 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10, fontWeight: 700, letterSpacing: .6, textTransform: 'uppercase', color: '#1f9d57' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1f9d57' }} />
            Current cycle &middot; Live
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, color: MK.INK, margin: '3px 0 2px' }}>{org.label}</div>
          <div style={{ fontSize: 11.5, color: MK.MUTED }}>
            Every 6 months from each individual&rsquo;s date of joining &middot; {rows.length} nurses + PCA across {byDept.length} departments
          </div>
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {[['Completed ' + done, '#1f9d57'], ['In progress ' + prog, '#0090ca'], ['Not started ' + not, '#5b6b80']].map(([t, c]) => (
            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, padding: '4px 11px', borderRadius: 14, color: c, background: c + '16' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />{t}
            </span>
          ))}
        </div>
        <div style={{ minWidth: 190 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="num" style={{ fontSize: 26, fontWeight: 700, color: MK.INK, letterSpacing: '-.5px' }}>{pct(done, rows.length)}%</span>
            <span style={{ fontSize: 11, color: MK.MUTED }}>of {rows.length} appraisals completed</span>
          </div>
          <div style={Object.assign({ marginTop: 6 }, MK.track(7))}>
            <div style={MK.fill(pct(done, rows.length), MK.progColor(rows.length ? done / rows.length : 0))} />
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
        <Stat label="Due this cycle" value={rows.length} sub={'nurses + PCA across ' + byDept.length + ' departments'} tint="blue" icon={I.grid} />
        <Stat label="Completed" value={done} sub={pct(done, rows.length) + '% of the cycle target'} tint="green" icon={I.check || I.doc} tone="#1f9d57" />
        <Stat label="Awaiting discussion" value={rows.filter((r) => r.status === 'submitted').length} sub="scored — meeting not yet held" tint="amber" icon={I.user} />
        <Stat label="Part H pending" value={rows.filter((r) => r.status === 'discussed').length} sub="completed — awaiting CNS action" tint="violet" icon={I.doc} />
        <Stat label="Overdue" value={overdue.length} sub="window has already closed" tint={overdue.length ? 'red' : 'slate'} icon={I.pulse} tone={overdue.length ? '#d23a52' : undefined} />
      </div>

      {overdue.length > 0 && (
        <div className="card" style={{ borderLeft: '3px solid #e08a1e' }}>
          <div className="card-h" style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(224,138,30,.07)' }}>
            <div style={MK.iconBadge('amber', 30)}><Ic d={I.alert || I.pulse} s={15} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: MK.INK }}>New-joiner appraisals due</div>
              <div style={{ fontSize: 11.5, color: MK.MUTED }}>The first appraisal falls six months after the date of joining.</div>
            </div>
            <span style={MK.stChip('Awaiting discussion')}>{overdue.length} overdue</span>
          </div>
          <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {overdue.slice(0, 6).map((r) => (
              <div key={r.empId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--line,#eef2f7)' }}>
                <div style={MK.av(r.name, 28)}>{initials(r.name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 12.5 }}>{r.name}</div>
                  <div className="sub" style={{ fontSize: 11 }}>
                    {r.designation} · {r.dept} · joined {A.fmtDay(A.parseDate(r.doj))} · due {A.fmtDay(r.firstDue)}
                  </div>
                </div>
                <span className="tag" style={{ color: '#d23a52', borderColor: '#d23a5255', background: '#d23a5214' }}>overdue</span>
                {perfCan('add') && <button className="btn pri" onClick={() => setRoute({ view: 'perfForm', emp: r.empId })}>Start now</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14 }}>
        <div className="card">
          <div className="card-h"><h3>Department progress</h3><div className="sub">done / due · average score of completed forms</div></div>
          <div className="card-b" style={{ maxHeight: 340, overflow: 'auto' }}>
            {byDept.length === 0 ? <Empty title="No staff on the roster" /> : (
              <table className="tbl" style={{ width: '100%' }}>
                <thead><tr><th>Department</th><th style={{ width: 78 }}>Done / due</th><th style={{ width: 110 }}>Progress</th><th style={{ width: 70 }}>Avg</th></tr></thead>
                <tbody>
                  {byDept.map((d) => (
                    <tr key={d.dept}>
                      <td style={{ fontWeight: 600 }}>{d.dept}</td>
                      <td className="num">{d.done} / {d.due}</td>
                      <td><Bar value={d.done} max={d.due} color={d.done === d.due ? '#1f9d63' : '#27a8db'} /></td>
                      <td className="num">{d.avg == null ? '—' : d.avg}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h3>Grade distribution</h3><div className="sub">{graded} completed appraisals</div></div>
          <div className="card-b">
            {graded === 0 ? <Empty title="Nothing graded yet" sub="Grades appear here as appraisals are completed and filed." /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {gradeMix.map((g) => (
                  <div key={g.grade} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 30 }}><GradePill grade={g.grade} /></div>
                    <div style={{ flex: 1 }}><Bar value={g.n} max={graded} color={gradeColor(g.grade)} /></div>
                    <div className="num" style={{ width: 30, textAlign: 'right' }}>{g.n}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
        <QuickCard icon={I.doc} title="CNS review queue" sub="Part H — action after discussion"
          n={rows.filter((r) => r.status === 'discussed' || r.status === 'submitted').length} onClick={() => setRoute({ view: 'perfQueue' })} />
        <QuickCard icon={I.heart} title="Achievements" sub={'Bonus points, capped at ' + A.BONUS_CAP + ' per cycle'}
          n={perf.achievements.length} onClick={() => setRoute({ view: 'perfAchievements' })} />
        <QuickCard icon={I.alert || I.pulse} title="Incidents" sub={'Deductions, capped at ' + A.PENALTY_CAP + ' per cycle'}
          n={perf.incidents.length} onClick={() => setRoute({ view: 'perfIncidents' })} />
        <QuickCard icon={I.user} title="Attrition & exits" sub="who left, when and why"
          n={(perf.exits || []).length} onClick={() => setRoute({ view: 'perfAttrition' })} />
        <QuickCard icon={I.heart} title="Recognition board" sub="wall, leaderboard and awards"
          n={perf.achievements.length} onClick={() => setRoute({ view: 'perfBoard' })} />
        <QuickCard icon={I.pulse} title="Retention risk" sub="staff to speak with this month"
          n={rows.filter((r) => r.incidents.length || r.overdue).length} onClick={() => setRoute({ view: 'perfRisk' })} />
      </div>
    </div>
  );
}

function QuickCard({ icon, title, sub, n, onClick }) {
  return (
    <div className="card" style={{ padding: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }} onClick={onClick}>
      <div style={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 10, background: 'rgba(39,168,219,.12)', color: '#27a8db' }}><Ic d={icon} s={19} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{title}</div>
        <div className="sub" style={{ fontSize: 11.5 }}>{sub}</div>
      </div>
      <div className="num" style={{ fontSize: 20, fontWeight: 700 }}>{n}</div>
    </div>
  );
}

/* ================= 2. DIRECTORY ================= */
// The mockup's quick-chip row. Each chip is a predicate over a roster row rather than a
// precomputed bucket, so a chip can never disagree with the table underneath it.
const DIR_CHIPS = [
  ['all', 'All', () => true],
  ['fav', '★ Favorites', (r) => !!(r.emp && r.emp.fav)],
  ['pending', '⚠ No appraisal yet', (r) => r.status === 'none'],
  ['done', '✓ Appraisal completed', (r) => r.status === 'actioned'],
  ['newhire', 'New hire ≤ 6 mo', (r) => {
    const d = r.doj ? A.parseDate(r.doj) : null;
    return !!(d && A.addMonths(d, 6) > new Date());
  }],
];
const dirChipStyle = (on) => ({
  padding: '7px 14px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'inherit', transition: 'all .15s',
  border: '1px solid ' + (on ? '#0090ca' : 'rgba(255,255,255,.8)'),
  background: on ? 'linear-gradient(135deg,#27a8db,#0072a3)' : 'rgba(255,255,255,.5)',
  color: on ? '#fff' : MK.BODY,
  boxShadow: on ? '0 4px 12px rgba(0,144,202,.35)' : 'none',
});
const dirSegStyle = (on) => ({
  border: 0, background: on ? '#fff' : 'transparent', color: on ? '#0090ca' : MK.MUTED,
  padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'inherit', boxShadow: on ? '0 1px 2px rgba(20,32,46,.06)' : 'none',
});
// Total experience is the staff module's own calculation (prior service + UNICO tenure).
const expOf = (e) => { try { return (window.STAFF && window.STAFF.expLabel) ? window.STAFF.expLabel(e) : '—'; } catch (x) { return '—'; } };

function PerfDirectory({ roster, staffStore, setRoute }) {
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [st, setSt] = useState('');
  const [sort, setSort] = useState('name');
  const [chip, setChip] = useState('all');
  const [role, setRole] = useState('');

  const depts = useMemo(() => [...new Set(roster.rows.map((r) => r.dept).filter(Boolean))].sort(), [roster.rows]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const chipDef = DIR_CHIPS.find((c) => c[0] === chip) || DIR_CHIPS[0];
    let out = roster.rows.filter((r) => {
      if (!chipDef[2](r)) return false;
      if (role && ((r.emp && r.emp.role) || 'Nurse') !== role) return false;
      if (dept && r.dept !== dept) return false;
      if (st && r.status !== st) return false;
      if (!needle) return true;
      return [r.name, r.empId, r.designation, r.dept].some((v) => String(v || '').toLowerCase().includes(needle));
    });
    out = out.slice().sort((a, b) => {
      if (sort === 'score') return (b.last ? b.last.score : -1) - (a.last ? a.last.score : -1);
      if (sort === 'dept') return String(a.dept).localeCompare(String(b.dept)) || String(a.name).localeCompare(String(b.name));
      return String(a.name).localeCompare(String(b.name));
    });
    return out;
  }, [roster.rows, q, dept, st, sort, chip, role]);

  const nurses = list.filter((r) => ((r.emp && r.emp.role) || 'Nurse') !== 'PCA').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {DIR_CHIPS.map(([id, label]) => (
          <button key={id} style={dirChipStyle(chip === id)} onClick={() => setChip(id)}>{label}</button>
        ))}
      </div>

      <div className="card">
      <div className="card-h" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={MK.iconBadge('blue', 32)}><Ic d={I.user} s={16} /></div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h3>Staff directory</h3>
          <div className="sub">{list.length} shown · {nurses} nurses · {list.length - nurses} PCA · appraisal status for each person's current window</div>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name / Emp ID…" style={{ minWidth: 190 }} />
        <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,.4)', border: '1px solid rgba(255,255,255,.8)', borderRadius: 9, padding: 3, gap: 2 }}>
          {[['', 'All'], ['Nurse', 'Nurses'], ['PCA', 'PCA']].map(([v, l]) => (
            <button key={l} style={dirSegStyle(role === v)} onClick={() => setRole(v)}>{l}</button>
          ))}
        </div>
        <select value={dept} onChange={(e) => setDept(e.target.value)}><option value="">All departments</option>{depts.map((d) => <option key={d}>{d}</option>)}</select>
        <select value={st} onChange={(e) => setSt(e.target.value)}>
          <option value="">Any status</option>
          {Object.keys(STATUS_META).map((k) => <option key={k} value={k}>{STATUS_META[k].label}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="name">Sort: name</option><option value="dept">Sort: department</option><option value="score">Sort: last score</option>
        </select>
      </div>
      <div className="card-b" style={{ overflow: 'auto' }}>
        {list.length === 0 ? <Empty icon={I.user} title="No staff match these filters" sub="Clear a filter to widen the search." /> : (
          <table className="tbl" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 34, textAlign: 'center' }}>★</th>
                <th>Staff</th><th>Emp ID</th><th>Designation</th><th>Department</th>
                <th style={{ textAlign: 'right' }}>Experience</th>
                <th>Appraisal window</th>
                <th style={{ textAlign: 'right' }}>Last appraisal</th>
                <th>Appraisal status</th><th style={{ width: 150 }}></th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.empId}>
                  <td style={{ textAlign: 'center' }}>
                    <span title={r.emp && r.emp.fav ? 'Remove from favourites' : 'Mark as a favourite'}
                      onClick={() => staffStore && staffStore.toggleFav(r.emp.id)}
                      style={{ cursor: 'pointer', fontSize: 15, color: (r.emp && r.emp.fav) ? '#e0a81e' : '#c4ccd6' }}>
                      {(r.emp && r.emp.fav) ? '★' : '☆'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={MK.av(r.name, 26)}>{initials(r.name)}</div>
                      <span style={{ fontWeight: 600, cursor: 'pointer' }} onClick={() => setRoute({ view: 'perfStaff', emp: r.empId })}>{r.name}</span>
                      {r.emp && r.emp.role === 'PCA' && <span style={MK.roleChip('PCA')}>PCA</span>}
                      {r.overdue && <span className="tag" style={{ color: '#d23a52', borderColor: '#d23a5255', background: '#d23a5214' }}>overdue</span>}
                    </div>
                  </td>
                  <td className="num">{r.empId}</td>
                  <td>{r.designation}</td>
                  <td>{r.dept}</td>
                  <td className="num" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{expOf(r.emp)}</td>
                  <td className="sub">{r.cycle ? r.cycle.label : '—'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {r.last ? (
                      <span>
                        <span className="num" style={{ fontWeight: 700, color: MK.INK }}>{r.last.score}</span>
                        <span style={{ marginLeft: 6 }}><span style={MK.gchip(r.last.grade)}>{r.last.grade}</span></span>
                      </span>
                    ) : <span className="sub">—</span>}
                  </td>
                  <td><StatusChip st={r.status} /></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn" onClick={() => setRoute({ view: 'perfStaff', emp: r.empId })}>Record</button>{' '}
                    {perfCan('edit') && r.cycle && (
                      <button className="btn pri" onClick={() => setRoute({ view: 'perfForm', emp: r.empId })}>
                        {r.appraisal ? (r.status === 'actioned' ? 'View' : 'Continue') : 'Start'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ paddingTop: 10, fontSize: 11, color: MK.FAINT }}>
          Click a staff member to open their profile and full appraisal history. Appraisal windows run every 6 months from each individual's date of joining.
        </div>
      </div>
      </div>
    </div>
  );
}

/* ================= 3. THE APPRAISAL FORM ================= */
// Each section gets its own accent, cycling blue -> teal -> violet, so the numbered
// badges read as a sequence rather than a wall of identical rows (mockup: New Appraisal).
const SEC_ACCENT = ['#0090ca', '#3ab5a7', '#6a52d4'];
const secAccent = (n) => SEC_ACCENT[(n - 1) % SEC_ACCENT.length];

// The speedometer on the Score Summary. Zones follow MK.barColor so the needle's
// backdrop always agrees with every other bar in the module.
function Speedo({ score, rated, of }) {
  const R = 88, CX = 110, CY = 108, W = 17;
  const ang = (v) => Math.PI * (1 - Math.max(0, Math.min(100, v)) / 100);
  const pt = (v, r) => [CX + r * Math.cos(ang(v)), CY - r * Math.sin(ang(v))];
  const arc = (a, b, color) => {
    const [x1, y1] = pt(a, R), [x2, y2] = pt(b, R);
    return <path key={a} d={'M' + x1 + ' ' + y1 + ' A' + R + ' ' + R + ' 0 0 1 ' + x2 + ' ' + y2}
      fill="none" stroke={color} strokeWidth={W} strokeLinecap="butt" />;
  };
  const [nx, ny] = pt(score, R - 20);
  const g = A.gradeFor(score);
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width="220" height="132" viewBox="0 0 220 132">
        {arc(0, 50, '#d23a52')}
        {arc(50, 70, '#e08a1e')}
        {arc(70, 90, '#0090ca')}
        {arc(90, 100, '#1f9d57')}
        <text x={pt(0, R + 15)[0]} y={pt(0, R + 15)[1] + 4} textAnchor="middle" style={{ fontSize: 9, fill: MK.FAINT }}>0</text>
        <text x={CX} y={CY - R - 8} textAnchor="middle" style={{ fontSize: 9, fill: MK.FAINT }}>50</text>
        <text x={pt(100, R + 15)[0]} y={pt(100, R + 15)[1] + 4} textAnchor="middle" style={{ fontSize: 9, fill: MK.FAINT }}>100</text>
        <line x1={CX} y1={CY} x2={nx} y2={ny} stroke={MK.INK} strokeWidth="3.4" strokeLinecap="round" style={{ transition: 'all .5s cubic-bezier(.2,.8,.25,1)' }} />
        <circle cx={CX} cy={CY} r="9" fill="#0090ca" />
        <circle cx={CX} cy={CY} r="4" fill="#fff" />
      </svg>
      <div className="num" style={{ fontSize: 30, fontWeight: 700, color: MK.INK, lineHeight: 1, marginTop: -6 }}>{score}</div>
      <div style={{ fontSize: 10.5, color: MK.FAINT, marginTop: 3 }}>of 100 · {rated}/{of} rated</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#0090ca', marginTop: 2 }}>
        pace {of ? Math.round((rated / of) * 100) : 0}% · grade {g.grade}
      </div>
    </div>
  );
}

function PerfForm({ roster, perf, empId, setRoute }) {
  const row = roster.byEmp[empId];
  const saved = row && row.appraisal;
  const locked = saved && saved.status === 'actioned';

  const [scores, setScores] = useState(() => (saved && saved.scores) || {});
  const [remarks, setRemarks] = useState(() => (saved && saved.remarks) || {});
  const [open, setOpen] = useState(() => ({ 1: true }));
  const [assessorRemarks, setAssessorRemarks] = useState(() => (saved && saved.assessorRemarks) || '');
  const [strengths, setStrengths] = useState(() => (saved && saved.strengths) || '');
  const [development, setDevelopment] = useState(() => (saved && saved.development) || '');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setScores((saved && saved.scores) || {});
    setRemarks((saved && saved.remarks) || {});
    setAssessorRemarks((saved && saved.assessorRemarks) || '');
    setStrengths((saved && saved.strengths) || '');
    setDevelopment((saved && saved.development) || '');
    setDirty(false);
  }, [empId, saved && saved.id, saved && saved.updatedAt]);

  const t = useMemo(() => A.tally(scores), [scores]);
  const missing = useMemo(() => A.missingRemarks(scores, remarks), [scores, remarks]);
  const pointsBonus = row ? Math.min(row.achievements.reduce((s, a) => s + (Number(a.points) || 0), 0), A.BONUS_CAP) : 0;
  const pointsPenalty = row ? Math.min(row.incidents.reduce((s, a) => s + (Number(a.points) || 0), 0), A.PENALTY_CAP) : 0;
  const settled = A.finalScore(t.total, pointsBonus, pointsPenalty);
  const grade = A.gradeFor(settled.score);

  if (!row) return <Empty icon={I.user} title="Staff member not found" sub="They may have left the roster." action={<button className="btn" onClick={() => setRoute({ view: 'perfDirectory' })}>Back to directory</button>} />;
  if (!row.cycle) return <Empty icon={I.doc} title="No appraisal window yet" sub={'The first window opens six months after the date of joining' + (row.doj ? ' (' + A.fmtDay(A.parseDate(row.doj)) + ').' : '.')} action={<button className="btn" onClick={() => setRoute({ view: 'perfDirectory' })}>Back</button>} />;

  const setScore = (sl, v) => { if (locked) return; setScores((s) => ({ ...s, [sl]: v })); setDirty(true); };
  const setRemark = (sl, v) => { if (locked) return; setRemarks((r) => ({ ...r, [sl]: v })); setDirty(true); };

  const body = (status) => ({
    empId: row.empId, cycleId: row.cycle.id, cycleLabel: row.cycle.label,
    cycleStart: row.cycle.start.toISOString().slice(0, 10), cycleEnd: row.cycle.end.toISOString().slice(0, 10),
    staffName: row.name, designation: row.designation, department: row.dept, doj: row.doj,
    scores, remarks, assessorRemarks, strengths, development, status,
    assessorName: (window.__UNICO_USER__ && window.__UNICO_USER__.name) || 'Administrator',
  });
  const save = (status, msg) => { setBusy(true); perf.saveAppraisal(body(status), msg).then(() => { setBusy(false); setDirty(false); }); };
  const canComplete = t.complete && missing.length === 0;

  const statusLabel = (STATUS_META[saved ? saved.status : 'none'] || STATUS_META.none).label;
  // history includes the current cycle once it is actioned, so taking [0] blindly
  // labels the period being viewed as its own predecessor.
  const prevCycle = row.history.find((h) => !row.appraisal || h.cycleId !== row.appraisal.cycleId) || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* back bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn" onClick={() => setRoute({ view: 'perfDirectory' })}>‹ Performance</button>
        <span style={{ fontSize: 11.5, color: MK.FAINT }}>Individual Performance Appraisal · Form {A.FORM_ID}</span>
      </div>

      {/* identity card */}
      <div className="card" style={{ borderTop: '3px solid #0090ca' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', padding: '15px 18px' }}>
          <div style={MK.av(row.name, 56)}>{MK.initials(row.name)}</div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 19, fontWeight: 700, color: MK.INK }}>{row.name}</span>
              <span style={MK.roleChip(row.emp && row.emp.role === 'PCA' ? 'PCA' : 'Nurse')}>{row.emp && row.emp.role === 'PCA' ? 'PCA' : 'Nurse'}</span>
              <span style={MK.stChip(statusLabel)}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', marginRight: 5 }} />{statusLabel}
              </span>
            </div>
            <div style={{ fontSize: 11.8, color: MK.MUTED, marginTop: 3 }}>
              {row.empId} · {row.designation} · {row.dept} · DOJ <b style={{ color: MK.BODY }}>{A.fmtDay(A.parseDate(row.doj))}</b>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: .6, textTransform: 'uppercase', color: MK.FAINT, marginBottom: 5 }}>Appraisal period</div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {prevCycle && <span style={{ fontSize: 11.5, padding: '5px 11px', borderRadius: 9, color: MK.MUTED, background: 'rgba(125,145,180,.12)' }}>{prevCycle.cycleLabel}</span>}
              <span style={{ fontSize: 11.5, fontWeight: 600, padding: '5px 11px', borderRadius: 9, color: '#0072a3', background: 'rgba(0,144,202,.12)', border: '1px solid rgba(0,144,202,.35)' }}>{row.cycle.label}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap', padding: '11px 18px', borderTop: '1px solid ' + MK.LINE }}>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: .6, textTransform: 'uppercase', color: MK.FAINT }}>Filled by</div>
            <div style={{ fontSize: 12.2 }}><b style={{ color: MK.INK }}>Chief Nursing Superintendent</b> <span style={{ color: MK.MUTED }}>(CNS / Admin only)</span></div>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: .6, textTransform: 'uppercase', color: MK.FAINT }}>Window</div>
            <div style={{ fontSize: 12.2 }}><b style={{ color: MK.INK }}>{row.cycle.label}</b> <span style={{ color: MK.MUTED }}>· appraisals run every 6 months from the individual&rsquo;s date of joining</span></div>
          </div>
          {!locked && perfCan('edit') && <button className="btn" disabled={busy} onClick={() => save('draft', 'Draft saved.')}>{busy ? 'Saving…' : 'Save draft'}</button>}
          {!locked && perfCan('edit') && (
            <button className="btn pri" disabled={busy || !canComplete}
              title={canComplete ? '' : 'Rate all 20 parameters and add remarks for any 1–2 first'}
              onClick={() => save('discussed', 'Appraisal completed — ready for the CNS review queue.')}>
              ✓ Complete &amp; schedule discussion
            </button>
          )}
        </div>
      </div>

      {locked && (
        <div className="card" style={{ borderLeft: '3px solid #1f9d57', padding: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={MK.iconBadge('green', 30)}><Ic d={I.check || I.doc} s={15} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 12.5, color: MK.INK }}>Filed to the personal record</div>
            <div style={{ fontSize: 11.5, color: MK.MUTED }}>The authority has recorded its action, so the form is read-only.</div>
          </div>
          {perfIsAdmin() && <button className="btn" onClick={() => perf.reopen(saved.id)}>Reopen for correction</button>}
        </div>
      )}

      {/* instruction banner */}
      <div className="card" style={{ background: 'linear-gradient(152deg,rgba(233,245,255,.9),rgba(240,248,255,.7))', display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px' }}>
        <div style={MK.iconBadge('blue', 30)}><Ic d={I.info || I.doc} s={15} /></div>
        <div style={{ flex: 1, minWidth: 260, fontSize: 11.8, color: MK.BODY, lineHeight: 1.55 }}>
          Rate on <b>documented observation over the whole period</b>, not isolated incidents. Tick one rating per
          parameter — no parameter may be left blank. A rating of <b>1 or 2 requires a written remark</b> and, where
          applicable, an incident or counselling reference. Sub-totals carry to the Score Summary automatically; the
          form is marked out of 100, so the total obtained is the percentage.
        </div>
        <button className="btn" onClick={() => setRoute({ view: 'perfPrint', emp: row.empId })}>Printable form ›</button>
      </div>

      {/* sections + rating key strip */}
      <div className="card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: .6, textTransform: 'uppercase', color: MK.FAINT, minWidth: 66 }}>Sections</span>
          {A.SECTIONS.map((sec) => {
            const sub = t.sections.find((x) => x.no === sec.no);
            const full = sub.rated === sub.of;
            const c = full ? '#1f9d57' : MK.FAINT;
            const isOpen = !!open[sec.no];
            return (
              <button key={sec.no} onClick={() => setOpen((o) => ({ ...o, [sec.no]: !o[sec.no] }))}
                style={{
                  cursor: 'pointer', font: 'inherit', fontSize: 11, fontWeight: 600, padding: '4px 11px', borderRadius: 14,
                  color: isOpen ? '#0072a3' : c, background: isOpen ? 'rgba(0,144,202,.1)' : (full ? 'rgba(31,157,87,.1)' : 'rgba(125,145,180,.1)'),
                  border: '1px solid ' + (isOpen ? 'rgba(0,144,202,.45)' : 'transparent'),
                }}>
                {sec.no} {sec.title.split(' ')[0].replace(/,$/, '')}{full ? ' ✓' : ''}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: .6, textTransform: 'uppercase', color: MK.FAINT, minWidth: 66 }}>Rating key</span>
          {[5, 4, 3, 2, 1].map((n) => (
            <span key={n} style={MK.ratingPill(n)}><b>{n}</b> {A.RATING_KEY.find((r) => r.score === n).label}</span>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 310px', gap: 14, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1, fontSize: 11.5, color: MK.MUTED }}>10 sections · 20 parameters — click a section to expand</span>
            <button className="btn" onClick={() => setOpen(Object.fromEntries(A.SECTIONS.map((s) => [s.no, true])))}>Expand all</button>
            <button className="btn" onClick={() => setOpen({})}>Collapse all</button>
          </div>

          {A.SECTIONS.map((sec) => {
            const isOpen = !!open[sec.no];
            const sub = t.sections.find((x) => x.no === sec.no);
            const acc = secAccent(sec.no);
            return (
              <div className="card" key={sec.no}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', cursor: 'pointer' }}
                  onClick={() => setOpen((o) => ({ ...o, [sec.no]: !o[sec.no] }))}>
                  <div className="num" style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', flexShrink: 0, background: acc, color: '#fff', fontWeight: 700, fontSize: 13 }}>{sec.no}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11.6, fontWeight: 700, letterSpacing: .3, color: MK.INK, textTransform: 'uppercase' }}>Section {sec.no} — {sec.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 3 }}>
                      <span style={{ fontSize: 10.8, color: MK.FAINT, whiteSpace: 'nowrap' }}>{sec.params.length} parameter{sec.params.length > 1 ? 's' : ''} · max {sec.max}</span>
                      <div style={Object.assign({ width: 92 }, MK.track(4))}><div style={MK.fill((sub.sub / sec.max) * 100, acc)} /></div>
                    </div>
                  </div>
                  <span className="num" style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 14, color: sub.rated === sub.of ? '#1f9d57' : MK.MUTED, background: sub.rated === sub.of ? 'rgba(31,157,87,.12)' : 'rgba(125,145,180,.14)' }}>{sub.sub} / {sec.max}</span>
                  <Ic d={isOpen ? (I.chevDown || 'M6 9l6 6 6-6') : (I.chevRight || 'M9 18l6-6-6-6')} s={15} />
                </div>

                {isOpen && (
                  <div style={{ borderTop: '1px solid ' + MK.LINE, padding: '4px 14px 12px' }}>
                    {sec.params.map((p) => {
                      const v = Number(scores[p.sl]) || 0;
                      const needsRemark = (v === 1 || v === 2);
                      const remarkMissing = needsRemark && !String(remarks[p.sl] || '').trim();
                      const rc = v ? MK.RT[v][1] : null;
                      return (
                        <div key={p.sl} style={{ padding: '12px 0', borderBottom: '1px solid rgba(125,145,180,.12)' }}>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <span className="num" style={{ width: 24, height: 22, borderRadius: 6, display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: '#0072a3', background: 'rgba(0,144,202,.1)' }}>{p.sl}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: MK.INK }}>{p.name}</div>
                              <div style={{ fontSize: 11.4, color: MK.MUTED, lineHeight: 1.5 }}>{p.desc}</div>
                            </div>
                            {v ? <span style={MK.ratingPill(v)}>{v} · {MK.RT[v][0]}</span> : null}
                          </div>

                          <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
                            {[5, 4, 3, 2, 1].map((n) => {
                              const on = v === n;
                              const c = MK.RT[n][1];
                              return (
                                <button key={n} disabled={locked} onClick={() => setScore(p.sl, n)} title={p.guide[n]}
                                  style={{
                                    minWidth: 78, padding: '7px 10px', borderRadius: 9, cursor: locked ? 'default' : 'pointer',
                                    font: 'inherit', textAlign: 'center',
                                    border: '1px solid ' + (on ? c : 'rgba(125,145,180,.3)'),
                                    background: on ? c : 'rgba(255,255,255,.75)',
                                    color: on ? '#fff' : MK.BODY,
                                    boxShadow: on ? '0 5px 14px ' + c + '44' : 'none',
                                  }}>
                                  <div className="num" style={{ fontSize: 15, fontWeight: 700, lineHeight: 1 }}>{n}</div>
                                  <div style={{ fontSize: 8.6, fontWeight: 700, letterSpacing: .4, textTransform: 'uppercase', marginTop: 3, opacity: on ? .95 : .6 }}>
                                    {['', 'Unsatisf.', 'Needs impr.', 'Good', 'Very good', 'Excellent'][n]}
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          {v ? (
                            <div style={{ marginTop: 9, padding: '7px 11px', borderLeft: '3px solid ' + rc, background: rc + '0e', borderRadius: '0 8px 8px 0', fontSize: 11.4, color: MK.BODY }}>
                              <b>What earns {v} — {MK.RT[v][0]}:</b> {p.guide[v]}
                            </div>
                          ) : null}

                          <input
                            value={remarks[p.sl] || ''} disabled={locked}
                            onChange={(e) => setRemark(p.sl, e.target.value)}
                            placeholder={needsRemark ? 'Remark required for a rating of 1–2 — reference the incident or counselling record' : 'Remarks (optional)'}
                            style={{ width: '100%', marginTop: 9, borderColor: remarkMissing ? '#d23a52' : undefined, background: remarkMissing ? 'rgba(210,58,82,.05)' : undefined }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div className="card">
            <div className="card-h"><h3>Part G — Assessor&rsquo;s comments</h3></div>
            <div className="card-b" style={{ display: 'grid', gap: 10 }}>
              <label style={{ display: 'grid', gap: 4 }}><span className="sub">Strongest areas</span>
                <textarea rows="2" disabled={locked} value={strengths} onChange={(e) => { setStrengths(e.target.value); setDirty(true); }} /></label>
              <label style={{ display: 'grid', gap: 4 }}><span className="sub">Areas for development</span>
                <textarea rows="2" disabled={locked} value={development} onChange={(e) => { setDevelopment(e.target.value); setDirty(true); }} /></label>
              <label style={{ display: 'grid', gap: 4 }}><span className="sub">Overall remarks</span>
                <textarea rows="3" disabled={locked} value={assessorRemarks} onChange={(e) => { setAssessorRemarks(e.target.value); setDirty(true); }} /></label>
            </div>
          </div>
        </div>

        {/* ---- Score Summary ---- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 12 }}>
          <div className="card">
            <div className="card-h"><h3>Score Summary</h3><span className="sub">carries forward live</span></div>
            <div className="card-b">
              <Speedo score={settled.score} rated={t.rated} of={t.of} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 12 }}>
                {t.sections.map((sc) => {
                  const done = sc.rated === sc.of;
                  return (
                    <div key={sc.no} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(125,145,180,.1)' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: done ? secAccent(sc.no) : 'rgba(125,145,180,.35)' }} />
                      <span style={{ flex: 1, fontSize: 11.4, color: done ? MK.BODY : MK.FAINT }}>{sc.no}. {sc.title.charAt(0) + sc.title.slice(1).toLowerCase()}</span>
                      <span className="num" style={{ fontSize: 11.4, fontWeight: 700, color: done ? MK.INK : MK.FAINT }}>{done ? sc.sub : '–'}/{sc.max}</span>
                    </div>
                  );
                })}
              </div>
              {(pointsBonus > 0 || pointsPenalty > 0) && (
                <div style={{ marginTop: 9, paddingTop: 8, borderTop: '1px solid ' + MK.LINE, fontSize: 11.4 }}>
                  {pointsBonus > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#1f9d57' }}><span>Achievement bonus</span><b className="num">+{pointsBonus}</b></div>}
                  {pointsPenalty > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d23a52' }}><span>Incident deduction</span><b className="num">−{pointsPenalty}</b></div>}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <span style={{ flex: 1, fontSize: 10.8, color: MK.FAINT }}>{t.rated} of {t.of} parameters rated</span>
                <span className="num" style={{ fontSize: 10.8, fontWeight: 700, color: MK.MUTED }}>{Math.round((t.rated / t.of) * 100)}%</span>
              </div>
              <div style={MK.track(5)}><div style={MK.fill((t.rated / t.of) * 100, '#0090ca')} /></div>
            </div>
          </div>

          <div className="card">
            <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 11.6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: t.complete ? '#1f9d57' : '#e08a1e' }}>
                <Ic d={t.complete ? (I.check || I.doc) : (I.alert || I.pulse)} s={14} />
                <span>All 20 parameters rated {t.complete ? '✓' : '— ' + (t.of - t.rated) + ' left'}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: missing.length ? '#d23a52' : '#1f9d57' }}>
                <Ic d={missing.length ? (I.alert || I.pulse) : (I.check || I.doc)} s={14} />
                <span>{missing.length ? missing.length + ' low rating(s) need a written remark' : 'Low ratings carry a remark ✓'}</span>
              </div>
              <div style={{ fontSize: 10.6, color: MK.FAINT, borderTop: '1px solid ' + MK.LINE, paddingTop: 7 }}>
                Confidential — retained in the personal file of the nurse concerned.
              </div>
              {dirty && <div style={{ fontSize: 10.8, color: '#e08a1e', textAlign: 'center' }}>Unsaved changes</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= 4. PRINTABLE FORM ================= */
function PerfPrint({ roster, empId, cycleId, setRoute }) {
  const row = roster.byEmp[empId];
  // Print the cycle that was ASKED for. Without this every Print button on the
  // appraisal-history list printed the CURRENT window's form under the heading of the
  // row the user clicked.
  const a = row && (cycleId ? (row.history || []).find((h) => h.cycleId === cycleId) : row.appraisal);
  if (!row) return <Empty title="Staff member not found" />;
  /* An unfiled appraisal is not a zero-scoring one.

     Without this guard the form printed a complete Form HR-NUR-PA-01 for a period
     nobody has assessed: tally({}) totals 0, finalScore(0) is 0, and gradeFor(0)
     returns the bottom band — so the sheet read "PERCENTAGE 0 %" and, in bold,
     "Grade awarded: E — Overall rating: Unsatisfactory" against a member of staff who
     has simply not been appraised yet. That is a document nobody should be able to
     produce by accident. */
  if (!a) {
    return (
      <Empty
        icon={I.doc}
        title="No appraisal has been filed for this period"
        sub={row.name + ' has no completed form for ' + ((cycleId && ((row.history || []).find((h) => h.cycleId === cycleId) || {}).cycleLabel) || (row.cycle && row.cycle.label) || 'this window') + '. Fill the form before printing it.'}
      />
    );
  }
  const t = A.tally((a && a.scores) || {});
  const bonus = Math.min(row.achievements.reduce((s, x) => s + (Number(x.points) || 0), 0), A.BONUS_CAP);
  const pen = Math.min(row.incidents.reduce((s, x) => s + (Number(x.points) || 0), 0), A.PENALTY_CAP);
  const settled = A.finalScore(t.total, bonus, pen);
  const g = A.gradeFor(settled.score);
  const cell = { border: '1px solid #333', padding: '4px 6px', fontSize: 10.5, verticalAlign: 'top' };
  const th = { ...cell, background: '#eef2f7', fontWeight: 700, textAlign: 'left' };

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-b" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn" onClick={() => setRoute({ view: 'perfForm', emp: empId })}>‹ Back to the form</button>
          <div style={{ flex: 1 }} />
          <span className="sub">1:1 with the paper form · Form {A.FORM_ID}</span>
          <button className="btn pri" onClick={() => window.print()}>Print / Save as PDF</button>
        </div>
      </div>

      <div id="pdf-root" style={{ background: '#fff', color: '#111', padding: '22px 26px', borderRadius: 8, maxWidth: 940, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', borderBottom: '2px solid #111', paddingBottom: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 10, letterSpacing: 1, color: '#b4232f', fontWeight: 700 }}>CONFIDENTIAL</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>INDIVIDUAL PERFORMANCE APPRAISAL</div>
          <div style={{ fontSize: 10.5 }}>UNICO Hands of Care Hospitals · Nursing Services</div>
          <div style={{ fontSize: 9.5, color: '#555' }}>Form {A.FORM_ID} · {A.FORM_REV}</div>
        </div>

        <SectionHead>Part A — Employee identification</SectionHead>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
          <tbody>
            <tr><td style={th}>Name</td><td style={cell}>{row.name}</td><td style={th}>Emp ID</td><td style={cell}>{row.empId}</td></tr>
            <tr><td style={th}>Designation</td><td style={cell}>{row.designation}</td><td style={th}>Department</td><td style={cell}>{row.dept}</td></tr>
            <tr><td style={th}>Date of joining</td><td style={cell}>{A.fmtDay(A.parseDate(row.doj))}</td><td style={th}>Appraisal period</td><td style={cell}>{row.cycle ? row.cycle.label : '—'}</td></tr>
          </tbody>
        </table>

        <SectionHead>Part B — Rating key</SectionHead>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
          <thead><tr><th style={th}>Score</th><th style={th}>Rating</th><th style={th}>Description</th></tr></thead>
          <tbody>{A.RATING_KEY.map((r) => <tr key={r.score}><td style={cell}>{r.score}</td><td style={cell}>{r.label}</td><td style={cell}>{r.desc}</td></tr>)}</tbody>
        </table>

        <SectionHead>Part D — Performance assessment</SectionHead>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
          <thead><tr><th style={{ ...th, width: 26 }}>SL</th><th style={th}>Performance parameter</th>
            {[5, 4, 3, 2, 1].map((n) => <th key={n} style={{ ...th, width: 22, textAlign: 'center' }}>{n}</th>)}
            <th style={{ ...th, width: 40, textAlign: 'center' }}>Score</th><th style={{ ...th, width: 150 }}>Remarks</th></tr></thead>
          <tbody>
            {A.SECTIONS.map((sec) => {
              const sub = t.sections.find((x) => x.no === sec.no);
              return (
                <React.Fragment key={sec.no}>
                  <tr><td colSpan="9" style={{ ...cell, background: '#dde7f2', fontWeight: 700 }}>SECTION {sec.no} — {sec.title}</td></tr>
                  {sec.params.map((p) => {
                    const v = Number((a && a.scores && (a.scores[p.sl] != null ? a.scores[p.sl] : a.scores[String(p.sl)])) || 0);
                    return (
                      <tr key={p.sl}>
                        <td style={cell}>{p.sl}</td>
                        <td style={cell}><b>{p.name}</b><div style={{ color: '#555', fontSize: 9.6 }}>{p.desc}</div></td>
                        {[5, 4, 3, 2, 1].map((n) => <td key={n} style={{ ...cell, textAlign: 'center', fontWeight: 700 }}>{v === n ? '✓' : ''}</td>)}
                        <td style={{ ...cell, textAlign: 'center', fontWeight: 700 }}>{v || ''}</td>
                        <td style={cell}>{(a && a.remarks && (a.remarks[p.sl] || a.remarks[String(p.sl)])) || ''}</td>
                      </tr>
                    );
                  })}
                  <tr><td colSpan="7" style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>SECTION SUB-TOTAL</td>
                    <td style={{ ...cell, textAlign: 'center', fontWeight: 700 }}>{sub.sub} / {sec.max}</td><td style={cell}></td></tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        <SectionHead>Part E — Score summary</SectionHead>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
          <thead><tr><th style={{ ...th, width: 26 }}>SL</th><th style={th}>Performance area</th><th style={{ ...th, width: 60 }}>Max.</th><th style={{ ...th, width: 70 }}>Obtained</th></tr></thead>
          <tbody>
            {t.sections.map((s) => <tr key={s.no}><td style={cell}>{s.no}</td><td style={cell}>{s.title}</td><td style={{ ...cell, textAlign: 'center' }}>{s.max}</td><td style={{ ...cell, textAlign: 'center' }}>{s.sub}</td></tr>)}
            <tr style={{ fontWeight: 700 }}><td style={cell}></td><td style={cell}>GRAND TOTAL</td><td style={{ ...cell, textAlign: 'center' }}>100</td><td style={{ ...cell, textAlign: 'center' }}>{t.total}</td></tr>
            {bonus > 0 && <tr><td style={cell}></td><td style={cell}>Achievement bonus (capped at {A.BONUS_CAP})</td><td style={{ ...cell, textAlign: 'center' }}>+{A.BONUS_CAP}</td><td style={{ ...cell, textAlign: 'center' }}>+{bonus}</td></tr>}
            {pen > 0 && <tr><td style={cell}></td><td style={cell}>Incident deduction (capped at {A.PENALTY_CAP})</td><td style={{ ...cell, textAlign: 'center' }}>−{A.PENALTY_CAP}</td><td style={{ ...cell, textAlign: 'center' }}>−{pen}</td></tr>}
            <tr style={{ fontWeight: 700, background: '#eef2f7' }}><td style={cell}></td>
              <td style={cell}>PERCENTAGE (marked out of 100 — the total obtained is the percentage)</td>
              <td style={{ ...cell, textAlign: 'center' }}>100</td><td style={{ ...cell, textAlign: 'center' }}>{settled.score} %</td></tr>
          </tbody>
        </table>

        <SectionHead>Part F — Overall grade</SectionHead>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
          <thead><tr><th style={th}>Percentage</th><th style={th}>Grade</th><th style={th}>Overall rating</th><th style={th}>Interpretation</th></tr></thead>
          <tbody>
            {A.GRADES.map((x) => {
              const on = x.grade === g.grade;
              return (
                <tr key={x.grade} style={on ? { background: '#dff2e6', fontWeight: 700 } : null}>
                  <td style={cell}>{x.min === 0 ? 'Below 50 %' : x.min + ' – ' + (x.min === 90 ? 100 : (A.GRADES[A.GRADES.indexOf(x) - 1] ? A.GRADES[A.GRADES.indexOf(x) - 1].min - 1 : 100)) + ' %'}</td>
                  <td style={cell}>{x.grade}</td><td style={cell}>{x.rating}</td><td style={cell}>{x.interp}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: 20, marginBottom: 14, fontSize: 11 }}>
          <div><b>Grade awarded:</b> {g.grade}</div><div><b>Overall rating:</b> {g.rating}</div>
        </div>

        <SectionHead>Part G — Assessor's comments &amp; signatures</SectionHead>
        <div style={{ border: '1px solid #333', padding: 8, fontSize: 10.5, marginBottom: 12, minHeight: 54 }}>
          {(a && a.assessorRemarks) || <span style={{ color: '#999' }}>—</span>}
          {a && a.strengths ? <div style={{ marginTop: 6 }}><b>Strongest areas:</b> {a.strengths}</div> : null}
          {a && a.development ? <div><b>Areas for development:</b> {a.development}</div> : null}
        </div>

        {a && a.status === 'actioned' && (
          <>
            <SectionHead>Part H — Action by the Chief Nursing Superintendent</SectionHead>
            <div style={{ border: '1px solid #333', padding: 8, fontSize: 10.5, marginBottom: 12 }}>
              <div><b>Action:</b> {(a.actions || []).map((id) => (A.CNS_ACTIONS.find((x) => x.id === id) || {}).label || id).join(' · ') || '—'}</div>
              {a.authorityRemarks && <div style={{ marginTop: 4 }}><b>Remarks:</b> {a.authorityRemarks}</div>}
              <div style={{ marginTop: 4 }}><b>Date of next review:</b> {a.nextReview || '—'} &nbsp; <b>Memo no.:</b> {a.memoNo || '—'}</div>
            </div>
          </>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18, marginTop: 26, fontSize: 10.5 }}>
          {['Chief Nursing Superintendent — Assessor', 'Employee — discussed & acknowledged', 'Hospital Administrator — countersign'].map((l) => (
            <div key={l} style={{ borderTop: '1px solid #333', paddingTop: 5 }}>{l}</div>
          ))}
        </div>
        <div style={{ textAlign: 'center', fontSize: 9, color: '#777', marginTop: 16 }}>
          Confidential — retained in the personal file of the nurse concerned. · Page 1 of 1
        </div>
      </div>
    </div>
  );
}
function SectionHead({ children }) {
  return <div style={{ background: '#16202e', color: '#fff', padding: '4px 8px', fontSize: 10.5, fontWeight: 700, letterSpacing: .4, marginBottom: 6 }}>{children}</div>;
}

/* ================= 5. STAFF PERFORMANCE RECORD ================= */
// A deterministic barcode strip from the employee id — the ID card in the mockup has
// one, and deriving it from the id means it is stable and actually identifies them.
function Barcode({ value }) {
  const v = String(value || '');
  let h = 7;
  for (let i = 0; i < v.length; i++) h = (h * 31 + v.charCodeAt(i)) % 100000;
  const bars = [];
  let seed = h;
  for (let i = 0; i < 46; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    bars.push(1 + (seed % 3));
  }
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 42, justifyContent: 'center' }}>
        {bars.map((w, i) => <div key={i} style={{ width: w, height: '100%', background: i % 2 ? 'transparent' : '#16202e' }} />)}
      </div>
      <div className="num" style={{ fontSize: 10.5, letterSpacing: 2, color: MK.BODY, marginTop: 4 }}>{v}</div>
    </div>
  );
}

function MiniStat({ label, value, tone }) {
  return (
    <div style={{ padding: '7px 12px', borderRadius: 10, background: 'rgba(255,255,255,.6)', border: '1px solid rgba(125,145,180,.2)', minWidth: 92 }}>
      <div style={{ fontSize: 8.8, fontWeight: 700, letterSpacing: .5, textTransform: 'uppercase', color: MK.FAINT }}>{label}</div>
      <div className="num" style={{ fontSize: 14, fontWeight: 700, color: tone || MK.INK, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function PerfStaffRecord({ roster, perf, empId, setRoute }) {
  const row = roster.byEmp[empId];
  if (!row) return <Empty icon={I.user} title="Staff member not found" />;
  const hist = row.history.slice().reverse();
  const latest = row.last;
  const isPca = row.emp && row.emp.role === 'PCA';
  /* No staff record carries a photograph, and the bundle ships exactly two stock
     portraits. Printing one on a card headed NURSE ID, beside this person's real
     name, employee number and barcode, presents a stranger's face as their identity
     photo -- and picks which stranger from their ROLE, which is not their gender.
     Use a real photo if one is ever stored; otherwise the initials avatar the rest
     of the module already uses. */
  const photo = (row.emp && (row.emp.photo || row.emp.photo_url)) || '';
  const idRow = (k, v) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(125,145,180,.14)' }}>
      <span style={{ flex: 1, fontSize: 9.6, fontWeight: 700, letterSpacing: .5, textTransform: 'uppercase', color: MK.FAINT }}>{k}</span>
      <span className="num" style={{ fontSize: 11.6, fontWeight: 700, color: MK.INK, textAlign: 'right' }}>{v || '—'}</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn" onClick={() => setRoute({ view: 'perfDirectory' })}>‹ Performance</button>
        <span style={{ fontSize: 11.5, color: MK.FAINT }}>Staff performance record</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
        {/* ---- ID card ---- */}
        <div className="card" style={{ position: 'sticky', top: 12 }}>
          <div style={{ display: 'grid', placeItems: 'center', paddingTop: 8 }}>
            <div style={{ width: 46, height: 4, borderRadius: 3, background: 'rgba(125,145,180,.3)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px' }}>
            <img src="unico/logo.svg" alt="UNICO" style={{ height: 26 }} />
            <div style={{ flex: 1 }} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9.6, fontWeight: 700, letterSpacing: .6, padding: '4px 9px', borderRadius: 7, color: '#fff', background: 'linear-gradient(135deg,#27a8db,#0072a3)' }}>
              <Ic d={I.steth || I.user} s={11} />{isPca ? 'PCA ID' : 'NURSE ID'}
            </span>
          </div>
          <div style={{ height: 3, background: 'linear-gradient(90deg,#3ab5a7,#27a8db)' }} />

          <div style={{ padding: '16px 18px 14px', textAlign: 'center' }}>
            <div style={{ width: 132, height: 132, margin: '0 auto', borderRadius: '50%', overflow: 'hidden', border: '4px solid #fff', boxShadow: '0 8px 24px rgba(31,59,90,.16)', background: 'linear-gradient(160deg,#eaf4fb,#dceaf5)' }}>
              {photo
                ? <img src={photo} alt={row.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { e.target.style.display = 'none'; }} />
                : <div style={Object.assign({}, MK.av(row.name, 132), { width: '100%', height: '100%', borderRadius: 0, fontSize: 44 })}>{initials(row.name)}</div>}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: MK.INK, marginTop: 11 }}>{row.name}</div>
            <div style={{ fontSize: 12.4, fontWeight: 600, color: '#0090ca', marginTop: 1 }}>{row.designation || '—'}</div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8 }}>
              <span style={MK.roleChip(isPca ? 'PCA' : 'Nurse')}>{isPca ? 'PCA' : 'Nurse'}</span>
              <span style={MK.stChip('Actioned')}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', marginRight: 5 }} />Active
              </span>
            </div>
          </div>

          <div style={{ padding: '0 18px 12px' }}>
            {idRow('ID no.', row.empId)}
            {idRow('Department', row.dept)}
            {idRow('Joined', row.doj)}
            {idRow('Experience', row.emp && row.emp.total_experience_text)}
            {idRow('Phone', row.emp && row.emp.phone)}
          </div>
          <div style={{ padding: '10px 18px 16px', borderTop: '1px solid ' + MK.LINE }}>
            <Barcode value={row.empId} />
          </div>
        </div>

        {/* ---- right column ---- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div className="card" style={{ borderLeft: '3px solid #0090ca' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 16px' }}>
              <div style={MK.iconBadge('blue', 32)}><Ic d={I.doc} s={16} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: MK.INK }}>Performance</span>
                <span style={{ fontSize: 11.5, color: MK.MUTED, marginLeft: 8 }}>
                  every 6 months from DOJ ({A.fmtDay(A.parseDate(row.doj))})
                </span>
              </div>
              {perfCan('edit') && row.cycle && (
                <button className="btn pri" onClick={() => setRoute({ view: 'perfForm', emp: row.empId })}>
                  {row.appraisal ? (row.status === 'actioned' ? 'View appraisal' : 'Continue appraisal') : '+ Start ' + row.cycle.label + ' appraisal'}
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', padding: '0 16px 14px' }}>
              <div style={{ flex: 1, minWidth: 230 }}>
                <div style={{ fontSize: 9.6, fontWeight: 700, letterSpacing: .6, textTransform: 'uppercase', color: MK.FAINT }}>
                  {latest ? 'Latest grade · ' + latest.cycleLabel : 'No appraisal filed yet'}
                </div>
                {latest ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 3 }}>
                      <span style={{ fontSize: 38, fontWeight: 700, lineHeight: 1, color: gradeColor(latest.grade) }}>{latest.grade}</span>
                      <span className="num" style={{ fontSize: 19, fontWeight: 700, color: MK.INK }}>{latest.score}</span>
                      <span className="num" style={{ fontSize: 14, color: MK.FAINT }}>/ 100</span>
                    </div>
                    <div style={{ fontSize: 11.8, color: MK.MUTED, marginTop: 2 }}>{A.gradeFor(latest.score).rating} — {A.gradeFor(latest.score).interp}</div>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: MK.MUTED, marginTop: 4 }}>
                    The first appraisal falls six months after joining{row.cycle ? ' — current window ' + row.cycle.label : ''}.
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <MiniStat label="Appraisals" value={row.history.length} />
                {hist.length > 1 && <MiniStat label={'Since ' + String(hist[0].cycleLabel).slice(-4)} value={(function(){ var d = hist[hist.length - 1].score - hist[0].score; return (d >= 0 ? '▲ ' : '▼ ') + Math.abs(d) + ' pts'; }())} tone={hist[hist.length - 1].score - hist[0].score >= 0 ? '#1f9d57' : '#d23a52'} />}
                <MiniStat label="Next due" value={row.cycle ? A.fmtDay(row.cycle.due) : '—'} />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h3>Score trend</h3><span className="sub">{hist.length ? hist.length + ' appraisal cycle(s)' : 'no cycles yet'}</span></div>
            <div className="card-b">
              {hist.length === 0
                ? <Empty title="No completed appraisals yet" sub="The trend appears once the first form is filed." />
                : <Trend points={hist.map((h) => ({ label: h.cycleLabel, v: h.score, grade: h.grade }))} />}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14 }}>
            <div className="card">
              <div className="card-h"><h3>Latest breakdown</h3><span className="sub">{latest ? latest.cycleLabel + ' · by section' : '—'}</span></div>
              <div className="card-b">
                {!latest ? <Empty title="Nothing to break down yet" /> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {A.tally(latest.scores).sections.map((sc) => (
                      <div key={sc.no} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{ width: 128, fontSize: 11.2, color: MK.BODY }}>{sc.title.charAt(0) + sc.title.slice(1).toLowerCase()}</div>
                        <div style={{ flex: 1 }}><Bar value={sc.sub} max={sc.max} color={MK.barColor((sc.sub / sc.max) * 100)} /></div>
                        <div className="num" style={{ width: 46, textAlign: 'right', fontSize: 11.5, fontWeight: 700 }}>{sc.sub}/{sc.max}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-h"><h3>Appraisal history</h3><span className="sub">confidential — personal file</span></div>
              <div className="card-b" style={{ overflow: 'auto' }}>
                {row.history.length === 0 ? <Empty title="No filed appraisals" /> : (
                  <table className="tbl">
                    <thead><tr><th>Period</th><th>Score</th><th>Grade</th><th>Part H</th><th></th></tr></thead>
                    <tbody>
                      {row.history.map((h) => (
                        <tr key={h.id}>
                          <td>{h.cycleLabel}</td>
                          <td className="num">{h.score}</td>
                          <td><GradePill grade={h.grade} /></td>
                          <td className="sub">{(h.actions || []).map((id) => (A.CNS_ACTIONS.find((x) => x.id === id) || {}).label || id).join(' · ') || '—'}</td>
                          <td style={{ textAlign: 'right' }}><button className="btn" onClick={() => setRoute({ view: 'perfPrint', emp: row.empId })}>Print</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14 }}>
            <EntryList title="Achievements and awards" sub={'Cap is ' + capsOf(perf).bonus + ' bonus points per cycle'} tone="#1f9d57" tint="green" icon={I.heart}
              rows={row.achievements} empty="No achievements recorded for this staff member yet."
              onOpen={() => setRoute({ view: 'perfAchievements', emp: row.empId })} />
            <EntryList title="Mistakes and incidents" sub={'Cap is ' + capsOf(perf).penalty + ' points per cycle'} tone="#d23a52" tint="red" icon={I.alert || I.pulse} negative
              rows={row.incidents} empty="Clean record for this cycle — no error, lapse or disciplinary entry on file."
              onOpen={() => setRoute({ view: 'perfIncidents', emp: row.empId })} />
          </div>
        </div>
      </div>
    </div>
  );
}

function EntryList({ title, sub, rows, empty, tone, tint, icon, negative, onOpen }) {
  return (
    <div className="card">
      <div className="card-h" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={MK.iconBadge(tint || 'slate', 30)}><Ic d={icon || I.doc} s={15} /></div>
        <div style={{ flex: 1 }}><h3>{title}</h3><div className="sub">{sub}</div></div>
        <button className="btn" onClick={onOpen}>Open register ›</button>
      </div>
      <div className="card-b">
        {rows.length === 0 ? <div className="sub" style={{ padding: '14px 0', textAlign: 'center' }}>{empty}</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {rows.map((r) => (
              <div key={r.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', paddingBottom: 7, borderBottom: '1px solid var(--line,#eef2f7)' }}>
                <span className="tag num" style={{ color: tone, borderColor: tone + '55', background: tone + '14' }}>{negative ? '−' : '+'}{r.points}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.2, fontWeight: 600 }}>{r.what}</div>
                  <div className="sub" style={{ fontSize: 11 }}>{r.category}{r.level ? ' · ' + r.level : ''}{r.severity ? ' · ' + r.severity : ''} · {r.date}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Small inline line chart — no dependency, prints cleanly.
function Trend({ points }) {
  if (!points.length) return null;
  const w = 320, h = 130, pad = 24;
  const max = 100, min = Math.max(0, Math.min(...points.map((p) => p.v)) - 10);
  const x = (i) => pad + (points.length === 1 ? (w - pad * 2) / 2 : (i * (w - pad * 2)) / (points.length - 1));
  const y = (v) => h - pad - ((v - min) / (max - min)) * (h - pad * 2);
  const d = points.map((p, i) => (i ? 'L' : 'M') + x(i) + ' ' + y(p.v)).join(' ');
  return (
    <div>
      <svg viewBox={'0 0 ' + w + ' ' + h} style={{ width: '100%', height: 150 }}>
        {[min, Math.round((min + max) / 2), max].map((v) => (
          <g key={v}><line x1={pad} x2={w - pad} y1={y(v)} y2={y(v)} stroke="rgba(130,150,175,.22)" strokeDasharray="3 3" />
            <text x={2} y={y(v) + 3} style={{ fontSize: 8, fill: '#8aa0b8' }}>{v}</text></g>
        ))}
        <path d={d} fill="none" stroke="#27a8db" strokeWidth="2.2" strokeLinecap="round" />
        {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.v)} r="4" fill={gradeColor(p.grade)} stroke="#fff" strokeWidth="1.6" />)}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#8aa0b8', gap: 4 }}>
        {points.map((p, i) => <span key={i} style={{ flex: 1, textAlign: 'center' }}>{String(p.label).split(' - ')[0]}</span>)}
      </div>
      {points.length > 1 && (
        <div className="sub" style={{ textAlign: 'center', marginTop: 6, fontSize: 11.5 }}>
          {(() => { const d2 = points[points.length - 1].v - points[0].v; return (d2 >= 0 ? '▲ ' : '▼ ') + Math.abs(d2) + ' points since ' + String(points[0].label).split(' - ')[0]; })()}
        </div>
      )}
    </div>
  );
}

/* ================= 6. CNS REVIEW QUEUE ================= */
function PerfQueue({ roster, perf, setRoute }) {
  const [tab, setTab] = useState('pending');
  const [sel, setSel] = useState(null);

  const all = roster.rows.filter((r) => r.appraisal && ['discussed', 'submitted', 'actioned'].indexOf(r.status) >= 0);
  const pending = all.filter((r) => r.status !== 'actioned');
  const actioned = all.filter((r) => r.status === 'actioned');
  const list = tab === 'pending' ? pending : tab === 'actioned' ? actioned : all;

  // Keep a selection alive as the list changes; default to the first pending item.
  const current = (sel && list.find((r) => r.empId === sel)) || list[0] || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={MK.iconBadge('violet', 34)}><Ic d={I.doc} s={17} /></div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontWeight: 600, fontSize: 15.5, color: MK.INK }}>CNS Review Queue</div>
          <div style={{ fontSize: 11.5, color: MK.MUTED }}>Part H — action by the Chief Nursing Superintendent after discussion with staff</div>
        </div>
        <div style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: 11, background: 'rgba(125,145,180,.14)' }}>
          {[['all', 'All ' + all.length], ['pending', 'Pending ' + pending.length], ['actioned', 'Actioned ' + actioned.length]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              border: 0, cursor: 'pointer', font: 'inherit', fontSize: 11.5, fontWeight: 600, padding: '5px 13px', borderRadius: 9,
              color: tab === k ? MK.INK : MK.MUTED, background: tab === k ? '#fff' : 'transparent',
              boxShadow: tab === k ? '0 2px 6px rgba(31,59,90,.12)' : 'none',
            }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(340px,1fr)', gap: 14, alignItems: 'start' }}>
        {/* ---- list ---- */}
        <div className="card">
          {list.length === 0 ? (
            <Empty icon={I.check || I.doc} title="Nothing waiting" sub="Completed appraisals arrive here for the authority's action." />
          ) : (
            <>
              <table className="tbl">
                <thead><tr><th>Staff member</th><th style={{ width: 58 }}>Score</th><th style={{ width: 58 }}>Grade</th><th style={{ width: 106 }}>Discussed</th><th style={{ width: 130 }}>Status</th></tr></thead>
                <tbody>
                  {list.map((r) => {
                    const on = current && current.empId === r.empId;
                    const stLabel = (STATUS_META[r.status] || STATUS_META.none).label;
                    return (
                      <tr key={r.empId} onClick={() => setSel(r.empId)} style={{
                        cursor: 'pointer',
                        background: on ? 'rgba(0,144,202,.07)' : undefined,
                        boxShadow: on ? 'inset 3px 0 0 #0090ca' : 'none',
                      }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <div style={MK.av(r.name, 30)}>{MK.initials(r.name)}</div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontWeight: 600, color: MK.INK }}>{r.name}</span>
                                <span style={MK.roleChip(r.emp && r.emp.role === 'PCA' ? 'PCA' : 'Nurse')}>{r.emp && r.emp.role === 'PCA' ? 'PCA' : 'Nurse'}</span>
                              </div>
                              <div style={{ fontSize: 10.6, color: MK.FAINT }}>{r.dept} · {r.designation}</div>
                            </div>
                          </div>
                        </td>
                        <td className="num" style={{ fontWeight: 700, color: MK.INK }}>{r.appraisal.score}</td>
                        <td><span style={MK.gchip(r.appraisal.grade)}>{r.appraisal.grade}</span></td>
                        <td className="num" style={{ fontSize: 11.2, color: MK.MUTED }}>{r.appraisal.discussedOn || '—'}</td>
                        <td><span style={MK.stChip(stLabel)}>{stLabel}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ padding: '10px 14px', fontSize: 11, color: MK.FAINT, borderTop: '1px solid ' + MK.LINE }}>
                Appraisals are filled by the CNS or Admin only. Recording the Part H action locks the form to the personal file.
              </div>
            </>
          )}
        </div>

        {/* ---- detail ---- */}
        {current ? <QueueDetail row={current} perf={perf} setRoute={setRoute} /> : (
          <div className="card"><Empty icon={I.doc} title="Nothing selected" sub="Pick an appraisal on the left to review it." /></div>
        )}
      </div>
    </div>
  );
}

function QueueDetail({ row, perf, setRoute }) {
  const a = row.appraisal;
  const g = a.grade;
  const locked = a.status === 'actioned';
  const suggested = A.CNS_ACTIONS.filter((x) => x.suggest.indexOf(g) >= 0);
  const [action, setAction] = useState(() => (a.actions && a.actions[0]) || (suggested[0] && suggested[0].id) || '');
  const [remarks, setRemarks] = useState(a.authorityRemarks || '');
  const [next, setNext] = useState(a.nextReview || '');
  const [memo, setMemo] = useState(a.memoNo || '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sg = A.CNS_ACTIONS.filter((x) => x.suggest.indexOf(a.grade) >= 0);
    setAction((a.actions && a.actions[0]) || (sg[0] && sg[0].id) || '');
    setRemarks(a.authorityRemarks || ''); setNext(a.nextReview || ''); setMemo(a.memoNo || '');
  }, [a.id, a.updatedAt, a.status]);

  const t = A.tally(a.scores);
  const stLabel = (STATUS_META[a.status] || STATUS_META.none).label;

  return (
    <div className="card" style={{ position: 'sticky', top: 12 }}>
      <div className="card-h"><h3>Appraisal review</h3><div style={{ flex: 1 }} /><span style={MK.stChip(stLabel)}>{stLabel}</span></div>
      <div className="card-b">
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={MK.av(row.name, 42)}>{MK.initials(row.name)}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: MK.INK }}>{row.name}</div>
            <div style={{ fontSize: 11.4, color: MK.MUTED }}>{row.dept} · {row.designation} · {row.emp && row.emp.role === 'PCA' ? 'PCA' : 'Nurse'}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, margin: '10px 0 12px' }}>
          <span className="num" style={{ fontSize: 30, fontWeight: 700, color: MK.INK, lineHeight: 1 }}>{a.score}</span>
          <span className="num" style={{ fontSize: 13, color: MK.FAINT }}>/100</span>
          <span style={MK.gchip(g, true)}>{g} · {A.gradeFor(a.score).rating}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {t.sections.map((sc) => (
            <div key={sc.no} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 118, fontSize: 11, color: MK.BODY }}>{sc.title.charAt(0) + sc.title.slice(1).toLowerCase()}</span>
              <div style={{ flex: 1 }}><Bar value={sc.sub} max={sc.max} color={MK.barColor((sc.sub / sc.max) * 100)} height={6} /></div>
              <span className="num" style={{ width: 42, textAlign: 'right', fontSize: 11, fontWeight: 700, color: MK.INK }}>{sc.sub}/{sc.max}</span>
            </div>
          ))}
        </div>

        {a.discussedOn ? (
          <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(31,157,87,.1)', color: '#1f7a48', fontSize: 11.6, lineHeight: 1.5 }}>
            ✓ Discussed with the staff member on <b>{a.discussedOn}</b> — acknowledgement signed by the employee and the CNS.
          </div>
        ) : (
          <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(224,138,30,.12)', color: '#b5670a', fontSize: 11.6, lineHeight: 1.5 }}>
            The discussion date has not been recorded yet. Hold the meeting with the staff member before filing the Part H action.
          </div>
        )}

        <div style={{ marginTop: 14, fontSize: 10.4, fontWeight: 700, letterSpacing: .5, textTransform: 'uppercase', color: '#6a52d4' }}>
          Part H — Action by Chief Nursing Superintendent
        </div>
        <div style={{ fontSize: 11.6, color: MK.MUTED, margin: '3px 0 9px' }}>
          Grade {g} — guidance: <b style={{ color: MK.INK }}>{A.gradeFor(a.score).interp}</b>
        </div>

        {locked ? (
          <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(31,157,87,.1)', fontSize: 11.6, color: '#1f7a48' }}>
            ✓ Part H action recorded — {(a.actions || []).map((id) => (A.CNS_ACTIONS.find((x) => x.id === id) || {}).label || id).join(' · ') || '—'}.
            Form locked and filed to the personal record.
            {a.authorityRemarks ? <div style={{ marginTop: 5, color: MK.BODY }}>{a.authorityRemarks}</div> : null}
          </div>
        ) : perfIsAdmin() ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <select value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">Select action…</option>
              {A.CNS_ACTIONS.map((x) => (
                <option key={x.id} value={x.id}>{x.label}{x.suggest.indexOf(g) >= 0 ? '  (suggested)' : ''}</option>
              ))}
            </select>
            <textarea rows="3" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Remarks / directions to the Nursing Office…" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input type="date" value={next} onChange={(e) => setNext(e.target.value)} title="Date of next review" />
              <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Memo no." />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => setRoute({ view: 'perfPrint', emp: row.empId })}>Printable form</button>
              <button className="btn pri" style={{ flex: 1, justifyContent: 'center' }} disabled={busy || !action}
                onClick={() => {
                  setBusy(true);
                  perf.recordAction(a.id, { actions: [action], authorityRemarks: remarks, nextReview: next, memoNo: memo })
                    .then(() => setBusy(false));
                }}>{busy ? 'Recording…' : '✓ Record action & lock'}</button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 11.5, color: MK.MUTED }}>Only the Chief Nursing Superintendent may record the Part H action.</div>
        )}
      </div>
    </div>
  );
}

/* ================= 7. REGISTERS (achievements / incidents) ================= */
const ACH_CATEGORIES = [
  { id: 'award', label: 'Award / recognition', levels: [['Hospital', 3], ['Department', 2], ['Unit', 1]] },
  { id: 'training', label: 'Training completed', levels: [['International', 3], ['National', 2], ['In-house', 1]] },
  { id: 'presentation', label: 'Presentation / teaching', levels: [['Conference', 3], ['Hospital', 2], ['Unit', 1]] },
  { id: 'improvement', label: 'Quality improvement adopted', levels: [['Hospital-wide', 3], ['Department', 2], ['Unit', 1]] },
  { id: 'appreciation', label: 'Patient / family appreciation', levels: [['Written', 2], ['Verbal', 1]] },
  { id: 'extra', label: 'Extra duty / emergency cover', levels: [['Sustained', 2], ['One-off', 1]] },
];
const INC_CATEGORIES = [
  { id: 'medication', label: 'Medication error' },
  { id: 'documentation', label: 'Documentation lapse' },
  { id: 'infection', label: 'Infection-control breach' },
  { id: 'attendance', label: 'Attendance / punctuality' },
  { id: 'conduct', label: 'Conduct / communication' },
  { id: 'procedure', label: 'Procedure / protocol deviation' },
];
const SEVERITIES = [['Minor', 1], ['Moderate', 2], ['Major', 3], ['Critical', 5]];
// The mockup's severity ramp, mapped onto this module's own severity names so a Major
// entry reads at the same weight as the mockup's "Serious".
const SEV_TONE = { Minor: '#e08a1e', Moderate: '#b5670a', Major: '#d23a52', Critical: '#8f2033' };
const sevTone = (v) => SEV_TONE[v] || '#8a93a3';
const sevPoints = (v) => { const s = SEVERITIES.find((x) => x[0] === v); return s ? s[1] : null; };

// Category / severity pill, as used in the register tables.
const tagPill = (c, soft) => ({
  display: 'inline-flex', fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 12,
  color: c, background: c + (soft ? '1a' : '18'), whiteSpace: 'nowrap',
});

// KPI tile with a coloured left rule — the treatment the mockup uses on the register
// dashboards (as distinct from the icon-badge tiles on the Performance dashboard).
function AccentStat({ label, value, sub, color }) {
  return (
    <div className="card" style={{ padding: '13px 16px', borderLeft: '3px solid ' + color }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: .6, textTransform: 'uppercase', color: MK.FAINT }}>{label}</div>
      <div className="num" style={{ fontSize: 30, fontWeight: 700, color: color, lineHeight: 1.05, margin: '4px 0 3px', letterSpacing: '-.5px' }}>{value}</div>
      <div style={{ fontSize: 11, color: MK.FAINT }}>{sub}</div>
    </div>
  );
}

// Twelve monthly buckets of a register, for the bar chart.
function monthlyCounts(rows, months) {
  const now = new Date(); const out = [];
  for (let k = months - 1; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    out.push({
      key,
      label: A.MONTHS[d.getMonth()] + (d.getMonth() === 0 ? ' ' + String(d.getFullYear()).slice(2) : ''),
      n: rows.filter((r) => String(r.date || '').slice(0, 7) === key).length,
    });
  }
  return out;
}

const CAT_COLORS = ['#0090ca', '#e08a1e', '#6a52d4', '#d23a52', '#3ab5a7', '#1f9d57', '#e0a12a', '#27a8db', '#c05621', '#8aa0b8'];

function PerfRegister({ kind, roster, perf, setRoute, focusEmp }) {
  const isAch = kind === 'ach';
  const rows = isAch ? perf.achievements : perf.incidents;
  const tone = isAch ? '#1f9d57' : '#d23a52';
  const caps = capsOf(perf);
  const cap = isAch ? caps.bonus : caps.penalty;
  const org = A.orgCycle(new Date());

  // 'staff' is the per-person drill-in (the mockup's Achievement History / Incident
  // History). It lives here as a sub-screen rather than as its own route because a new
  // perf* route name would also have to be registered in ui.jsx UNICO_MODULE_VIEWS and
  // app.jsx PV_TITLE, neither of which this file owns.
  const [screen, setScreen] = useState(focusEmp ? 'staff' : 'home');
  const [staffSel, setStaffSel] = useState(focusEmp || '');
  const openStaff = (id) => { setStaffSel(id); setScreen('staff'); };
  const [cat, setCat] = useState('');
  const [adding, setAdding] = useState(false);
  const [cert, setCert] = useState(null);

  const list = useMemo(() => {
    let l = rows.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (cat) l = l.filter((x) => x.category === cat);
    if (focusEmp) l = l.filter((x) => x.empId === focusEmp);
    return l;
  }, [rows, cat, focusEmp]);

  const points = rows.reduce((t, r) => t + (Number(r.points) || 0), 0);
  const people = new Set(rows.map((r) => r.empId)).size;
  const certs = rows.filter((r) => r.certificate || (r.reward && /certificate/i.test(r.reward))).length;
  const series = useMemo(() => monthlyCounts(rows, 12), [rows]);
  const maxN = Math.max(1, ...series.map((m) => m.n));

  const byCat = useMemo(() => {
    const m = {};
    rows.forEach((r) => { const c = r.category || 'Uncategorised'; m[c] = (m[c] || 0) + 1; });
    const total = rows.length || 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1])
      .map(([name, n], i) => ({ name, n, pctv: Math.round((n / total) * 100), color: CAT_COLORS[i % CAT_COLORS.length] }));
  }, [rows]);

  const leaders = useMemo(() => {
    const m = {};
    rows.forEach((r) => {
      const k = r.empId;
      (m[k] = m[k] || { empId: k, name: r.staffName, dept: r.department, pts: 0, n: 0 });
      m[k].pts += Number(r.points) || 0; m[k].n++;
    });
    return Object.values(m).sort((a, b) => b.pts - a.pts).slice(0, 8);
  }, [rows]);

  // One colour per category, assigned once from byCat so the chip row, the mix bar and
  // the table cell all agree on what "Medication error" looks like.
  const catColor = useMemo(() => {
    const m = {};
    byCat.forEach((c) => { m[c.name] = c.color; });
    return (name) => m[name] || '#8a93a3';
  }, [byCat]);

  // Severity mix — incidents only. Points are the spec's standard deduction for that
  // severity; where an entry uses a severity the spec does not know, fall back to what
  // was actually recorded rather than inventing a number.
  const sevMix = useMemo(() => {
    if (isAch) return [];
    const m = {};
    rows.forEach((r) => {
      const k = r.severity || 'Unspecified';
      (m[k] = m[k] || { label: k, n: 0, recorded: 0 });
      m[k].n++; m[k].recorded += Number(r.points) || 0;
    });
    const order = SEVERITIES.map((s) => s[0]);
    const total = rows.length || 1;
    return Object.values(m)
      .sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label))
      .map((x) => ({
        ...x,
        pts: sevPoints(x.label) != null ? sevPoints(x.label) : Math.round(x.recorded / x.n),
        pctv: Math.round((x.n / total) * 100),
        color: sevTone(x.label),
      }));
  }, [rows, isAch]);

  // Donut arcs for the severity mix. r=58 at stroke 16 is the mockup's dial.
  const sevArcs = useMemo(() => {
    const C = 2 * Math.PI * 58;
    const tot = sevMix.reduce((t, x) => t + x.n, 0) || 1;
    let acc = 0;
    return sevMix.filter((x) => x.n).map((x) => {
      const len = (x.n / tot) * C;
      const arc = { key: x.label, color: x.color, dash: len.toFixed(1) + ' ' + (C - len).toFixed(1), off: (-acc).toFixed(1) };
      acc += len;
      return arc;
    });
  }, [sevMix]);

  const byUnit = useMemo(() => {
    const m = {};
    rows.forEach((r) => { const d = r.department || 'Unassigned'; m[d] = (m[d] || 0) + 1; });
    return Object.entries(m).map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n);
  }, [rows]);
  const unitMax = Math.max(1, ...byUnit.map((u) => u.n));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {screen === 'staff' ? (
        <PerfEntryHistory kind={kind} roster={roster} perf={perf} empId={staffSel} caps={caps}
          onBack={() => setScreen('register')} onCert={setCert} setRoute={setRoute} />
      ) : (
      <>
      {/* hero band */}
      <div className="card" style={{ padding: '16px 18px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10, fontWeight: 700, letterSpacing: .6, textTransform: 'uppercase', color: tone }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: tone }} />
            {isAch ? 'Recognition · Nursing staff' : 'Conduct · Nursing staff'}
          </div>
          <div style={{ fontSize: 21, fontWeight: 700, color: MK.INK, margin: '3px 0 2px' }}>
            {isAch ? 'Nurse Achievements' : 'Mistakes and Incidents'}
          </div>
          <div style={{ fontSize: 11.8, color: MK.MUTED }}>
            {isAch
              ? 'Training, awards and commendations recorded against ' + roster.rows.length + ' staff · ' + org.label
              : 'Errors, lapses and disciplinary entries recorded against ' + roster.rows.length + ' staff · ' + org.label}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isAch && <button className="btn" onClick={() => setRoute({ view: 'perfBoard' })}>Recognition board</button>}
          <button className="btn" onClick={() => setScreen(screen === 'home' ? 'register' : 'home')}>
            {screen === 'home' ? 'Register' : 'Overview'}
          </button>
          {perfCan('add') && (
            <button className="btn pri" onClick={() => setAdding(true)}>
              + {isAch ? 'Record an achievement' : 'Record an incident'}
            </button>
          )}
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
        <AccentStat label="Recorded this cycle" value={rows.length} sub={'across ' + byCat.length + ' ' + (isAch ? 'achievement and award' : 'incident') + ' categories'} color="#0090ca" />
        <AccentStat label={isAch ? 'Staff recognised' : 'Staff with entries'} value={people}
          sub={roster.rows.length ? Math.round((people / roster.rows.length) * 100) + '% of the nursing roster' : '—'} color={isAch ? '#1f9d57' : '#d23a52'} />
        <AccentStat label={isAch ? 'Bonus points awarded' : 'Points deducted'} value={points}
          sub={people ? 'average ' + (points / people).toFixed(1) + ' points per staff member' : 'none yet'} color="#6a52d4" />
        <AccentStat label={isAch ? 'Certificates issued' : 'Repeat cases'}
          value={isAch ? certs : leaders.filter((l) => l.n > 1).length}
          sub={isAch ? 'recognition with a certificate' : 'more than one entry this cycle'} color="#e08a1e" />
      </div>

      {screen === 'home' ? (
        <>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.25fr) minmax(320px,1fr)', gap: 14, alignItems: 'start' }}>
          <div className="card">
            <div className="card-h"><h3>Entries recorded per month</h3><div style={{ flex: 1 }} /><span className="sub">last 12 months</span></div>
            <div className="card-b">
              {rows.length === 0 ? (
                <Empty icon={isAch ? I.heart : (I.alert || I.pulse)}
                  title={isAch ? 'Nothing recorded yet' : 'No incidents recorded'}
                  sub={isAch ? 'Recognition recorded here adds bonus points to the current appraisal.' : 'A clean register is a good thing — entries here deduct points from the appraisal.'} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 190, paddingTop: 18 }}>
                  {series.map((m) => (
                    <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, minWidth: 0 }}>
                      <div className="num" style={{ fontSize: 10.5, color: m.n ? MK.BODY : 'transparent' }}>{m.n || 0}</div>
                      <div style={{
                        width: '100%', height: Math.max(3, (m.n / maxN) * 132), borderRadius: '5px 5px 0 0',
                        background: 'linear-gradient(180deg,' + (isAch ? '#5bc0e8,#0090ca' : '#e88a8a,#d23a52') + ')',
                        animation: MK.ANIM,
                      }} />
                      <div style={{ fontSize: 9.2, color: MK.FAINT, whiteSpace: 'nowrap' }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h3>Categories recorded</h3><div style={{ flex: 1 }} /><span className="sub">this cycle</span></div>
            <div className="card-b">
              {byCat.length === 0 ? <div className="sub" style={{ textAlign: 'center', padding: 18 }}>Nothing recorded yet.</div> : (
                <>
                  <div style={{ display: 'flex', height: 7, borderRadius: 5, overflow: 'hidden', marginBottom: 12 }}>
                    {byCat.map((c) => <div key={c.name} style={{ width: c.pctv + '%', background: c.color }} />)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {byCat.map((c) => (
                      <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}
                        onClick={() => { setCat(cat === c.name ? '' : c.name); setScreen('register'); }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 11.6, color: MK.BODY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                        <div style={{ width: 62 }}><Bar value={c.n} max={byCat[0].n} color={c.color} height={5} /></div>
                        <span className="num" style={{ width: 22, textAlign: 'right', fontSize: 11.4, fontWeight: 700, color: MK.INK }}>{c.n}</span>
                        <span className="num" style={{ width: 32, textAlign: 'right', fontSize: 11, color: c.color }}>{c.pctv}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div style={{ marginTop: 12, padding: '9px 11px', borderRadius: 9, background: 'rgba(0,144,202,.07)', fontSize: 11.2, color: MK.BODY }}>
                Points from these entries {isAch ? 'carry into' : 'come off'} the 6-monthly appraisal, capped at <b>{cap}</b> per staff member per cycle.
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14, alignItems: 'start' }}>
          {/* Severity mix is an incident-only cut: an achievement has a level, not a severity. */}
          {!isAch && (
            <div className="card">
              <div className="card-h"><h3>Severity mix</h3><div style={{ flex: 1 }} /><span className="sub">points deducted per entry</span></div>
              {sevMix.length === 0 ? (
                <div className="card-b"><div className="sub" style={{ textAlign: 'center', padding: 18 }}>Nothing recorded yet.</div></div>
              ) : (
                <>
                  <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <svg viewBox="0 0 160 160" style={{ width: 128, display: 'block', flexShrink: 0 }}>
                      <circle cx="80" cy="80" r="58" fill="none" stroke="rgba(125,145,180,.16)" strokeWidth="16" />
                      {sevArcs.map((a) => (
                        <circle key={a.key} cx="80" cy="80" r="58" fill="none" stroke={a.color} strokeWidth="16"
                          strokeDasharray={a.dash} strokeDashoffset={a.off} transform="rotate(-90 80 80)" />
                      ))}
                      <text x="80" y="76" textAnchor="middle" fontSize="26" fontWeight="700" fill={MK.INK} fontFamily={MK.MONO}>{rows.length}</text>
                      <text x="80" y="94" textAnchor="middle" fontSize="10" fill={MK.FAINT}>entries</text>
                    </svg>
                    <div style={{ flex: 1, minWidth: 145, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {sevMix.map((s) => (
                        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color, display: 'inline-block', flexShrink: 0 }} />
                          <span style={{ fontSize: 11.5, color: MK.BODY, flex: 1, minWidth: 0 }}>{s.label}</span>
                          <span className="num" style={{ fontSize: 10.5, fontWeight: 700, color: s.color, whiteSpace: 'nowrap' }}>−{s.pts}</span>
                          <span className="num" style={{ fontSize: 11.5, fontWeight: 700, color: MK.INK, width: 18, textAlign: 'right' }}>{s.n}</span>
                          <span className="num" style={{ fontSize: 10.5, color: MK.FAINT, width: 32, textAlign: 'right' }}>{s.pctv}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ padding: '0 16px 15px' }}>
                    <div style={{ border: '1px solid rgba(210,58,82,.25)', background: 'rgba(210,58,82,.07)', borderRadius: 11, padding: '12px 14px', fontSize: 11.5, color: MK.BODY, lineHeight: 1.55 }}>
                      Deductions come off the 6-monthly appraisal score, capped at <b>{cap} points</b> per staff member per cycle. Achievement points and deductions are shown separately on the form.
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="card">
            <div className="card-h"><h3>{isAch ? 'Entries by unit' : 'Incidents by unit'}</h3><div style={{ flex: 1 }} /><span className="sub">this cycle</span></div>
            <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {byUnit.length === 0 ? <div className="sub" style={{ textAlign: 'center', padding: 18 }}>Nothing recorded yet.</div> : byUnit.map((u) => (
                <div key={u.name} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <span style={{ fontSize: 12, color: MK.INK, width: 116, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</span>
                  <div style={{ flex: 1, height: 8, borderRadius: 5, background: 'rgba(125,145,180,.16)', overflow: 'hidden' }}>
                    <div style={{
                      width: Math.round((u.n / unitMax) * 100) + '%', height: '100%', borderRadius: 4,
                      background: isAch ? 'linear-gradient(90deg,#3ab5a7,#0090ca)' : 'linear-gradient(90deg,#e08a1e,#d23a52)',
                      animation: MK.ANIM,
                    }} />
                  </div>
                  <span className="num" style={{ fontSize: 11.5, fontWeight: 700, color: isAch ? '#0072a3' : '#b5670a', width: 22, textAlign: 'right' }}>{u.n}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        </>
      ) : (
        <>
        {/* Category chips list the categories actually present in the register, not the
            full configured catalogue — an empty chip would filter to nothing. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: .6, textTransform: 'uppercase', color: MK.FAINT, marginRight: 2 }}>Category</span>
          {[['', isAch ? 'All entries' : 'All incidents']].concat(byCat.map((c) => [c.name, c.name])).map(([v, label]) => {
            const on = cat === v;
            return (
              <button key={label} onClick={() => setCat(v)} style={{
                border: '1px solid ' + (on ? (isAch ? 'rgba(0,144,202,.4)' : 'rgba(210,58,82,.35)') : 'rgba(255,255,255,.85)'),
                background: on ? (isAch ? 'rgba(0,144,202,.12)' : 'rgba(210,58,82,.1)') : 'rgba(255,255,255,.55)',
                color: on ? (isAch ? '#0072a3' : '#8f2033') : MK.MUTED,
                padding: '5px 12px', borderRadius: 16, fontSize: 11.5, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}>{label}</button>
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(260px,1fr)', gap: 14, alignItems: 'start' }}>
          <div className="card">
            <div className="card-h">
              <h3>{isAch ? 'Achievement register' : 'Incident register'}</h3>
              <div style={{ flex: 1 }} />
              <span className="sub">{list.length} {list.length === 1 ? (isAch ? 'entry' : 'incident') : (isAch ? 'entries' : 'incidents')}</span>
            </div>
            <div className="card-b" style={{ overflow: 'auto' }}>
              {list.length === 0 ? (
                <Empty icon={isAch ? I.heart : (I.alert || I.pulse)}
                  title={isAch ? 'No entries in this category' : 'No incidents in this category'}
                  sub={isAch ? 'Pick another category above, or record a new achievement.' : 'Pick another category above, or log a new incident.'} />
              ) : (
                <table className="tbl">
                  <thead><tr>
                    <th>Staff member</th>
                    <th>{isAch ? 'Achievement' : 'What happened'}</th>
                    <th>{isAch ? 'Type' : 'Category'}</th>
                    <th>{isAch ? 'Level' : 'Severity'}</th>
                    <th>Date</th>
                    <th style={{ width: 58, textAlign: 'right' }}>Points</th>
                    <th>{isAch ? 'Reward' : 'Action taken'}</th>
                    <th style={{ textAlign: 'right' }}>{isAch ? 'Certificate' : ''}</th>
                  </tr></thead>
                  <tbody>
                    {list.map((r) => {
                      // Designation and role live on the roster, not on the entry, so the
                      // sub-line is looked up rather than duplicated into the register.
                      const who = roster.byEmp[r.empId];
                      return (
                      <tr key={r.id} style={!isAch ? { boxShadow: 'inset 4px 0 0 ' + sevTone(r.severity) } : null}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={MK.av(r.staffName, 26)}>{MK.initials(r.staffName)}</div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontWeight: 600, color: MK.INK, cursor: 'pointer' }} onClick={() => openStaff(r.empId)}>{r.staffName}</span>
                                {who && who.emp && who.emp.role === 'PCA' && <span style={MK.roleChip('PCA')}>PCA</span>}
                              </div>
                              <div style={{ fontSize: 10.6, color: MK.FAINT }}>{who && who.designation ? who.designation + ' · ' : ''}{r.department}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ color: MK.INK, maxWidth: 300 }}>{r.what}</td>
                        <td><span style={tagPill(catColor(r.category))}>{r.category || '—'}</span></td>
                        <td>{isAch
                          ? <span className="sub">{r.level || '—'}</span>
                          : <span style={tagPill(sevTone(r.severity), true)}>{r.severity || '—'}</span>}</td>
                        <td className="num" style={{ fontSize: 11.2 }}>{r.date}</td>
                        <td style={{ textAlign: 'right' }}><span className="num" style={{ fontWeight: 700, padding: '2px 9px', borderRadius: 14, color: tone, background: tone + '18' }}>{isAch ? '+' : '−'}{r.points}</span></td>
                        <td style={{ fontSize: 11.5, color: MK.BODY }}>{(isAch ? r.reward : r.action) || <span style={{ color: MK.FAINT }}>—</span>}</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {isAch && <button className="btn" onClick={() => setCert(r)}>{r.certificate ? 'Certificate' : 'Issue'}</button>}{' '}
                          {perfCan('delete') && <button className="icon-btn danger" title="Remove" onClick={() => { if (confirm('Remove this entry? The points come off the appraisal immediately.')) (isAch ? perf.delAchievement : perf.delIncident)(r.id); }}>×</button>}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h3>{isAch ? 'Most points this cycle' : 'Repeat cases'}</h3></div>
            <div className="card-b">
              {leaders.length === 0 ? <div className="sub" style={{ textAlign: 'center', padding: 12 }}>Nothing yet.</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {leaders.map((l, k) => (
                    <div key={l.empId} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }} onClick={() => openStaff(l.empId)}>
                      <span className="num" style={{ width: 14, opacity: .5, fontSize: 11 }}>{k + 1}</span>
                      <div style={MK.av(l.name, 26)}>{MK.initials(l.name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: MK.INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</div>
                        <div style={{ fontSize: 10.4, color: MK.FAINT }}>{l.dept} · {l.n} entr{l.n === 1 ? 'y' : 'ies'}</div>
                      </div>
                      <span className="num" style={{ fontWeight: 700, padding: '2px 9px', borderRadius: 14, color: tone, background: tone + '18' }}>{isAch ? '+' : '−'}{l.pts}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        </>
      )}
      </>
      )}

      {adding && <EntryModal kind={kind} roster={roster} perf={perf} onClose={() => setAdding(false)} />}
      {cert && <CertificateModal entry={cert} onClose={() => setCert(null)} />}
    </div>
  );
}

/* ---- Achievement History / Incident History (per staff) ----------------------
   Two mockup screens, one component: they are the same layout with the sign, the
   colour and the copy flipped, exactly as PerfRegister already treats the two
   registers. Reached from the register (staff name, or the leaders list), and from
   the staff record's "Open register ›" which routes here with `emp` set.

   Category colour is taken from the CONFIGURED catalogue position, not from how often
   a category appears, so "Medication error" is the same red on this screen as on the
   next staff member's — the register's own frequency-ordered palette cannot promise
   that across people. */
const catTone = (kind, name) => {
  const cats = kind === 'ach' ? ACH_CATEGORIES : INC_CATEGORIES;
  const i = cats.findIndex((c) => c.label === name);
  return i >= 0 ? CAT_COLORS[i % CAT_COLORS.length] : '#8a93a3';
};

/* The mockup's badge vocabulary, mapped onto the categories this module actually
   records. Two of its badges (Zero-error record, Long service) have no category behind
   them here, so they are not shown rather than guessed at; the two categories it has no
   word for get a plain descriptive label instead of a borrowed one. */
const ACH_BADGES = [
  ['Certified', '#0090ca', (x) => x.category === 'Training completed'],
  ['Presenter', '#6a52d4', (x) => x.category === 'Presentation / teaching'],
  ['Commended by patients', '#e08a1e', (x) => x.category === 'Patient / family appreciation'],
  ['Crisis cover', '#b5670a', (x) => x.category === 'Extra duty / emergency cover'],
  ['Award winner', '#1f9d57', (x) => x.category === 'Award / recognition'],
  ['Improvement adopted', '#3ab5a7', (x) => x.category === 'Quality improvement adopted'],
  ['National level', '#27a8db', (x) => x.level === 'International' || x.level === 'National' || x.level === 'Conference'],
  ['Cash award', '#0072a3', (x) => /cash/i.test(x.reward || '')],
];

const histChip = (c, border) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700,
  padding: '5px 11px', borderRadius: 16, color: c, background: c + '18',
  ...(border ? { border: '1px solid ' + c + '38' } : null),
});

function PerfEntryHistory({ kind, roster, perf, empId, caps, onBack, onCert, setRoute }) {
  const isAch = kind === 'ach';
  const row = roster.byEmp[empId];
  const tone = isAch ? '#0072a3' : '#d23a52';
  const cap = isAch ? caps.bonus : caps.penalty;

  // Every entry this person has on the register, newest first — the "Recorded …" card
  // list. The headline number is the CURRENT CYCLE only (roster.byEmp already filters
  // by cycleId), because that is what reaches the appraisal.
  const all = useMemo(() => (isAch ? perf.achievements : perf.incidents)
    .filter((x) => x.empId === empId)
    .sort((a, b) => String(b.date).localeCompare(String(a.date))), [perf.achievements, perf.incidents, empId, isAch]);

  if (!row) {
    return (
      <Empty icon={I.user} title="Staff member not found"
        sub="This entry names somebody who is no longer on the active roster, so their cycle and appraisal cannot be resolved."
        action={<button className="btn" onClick={onBack}>‹ {isAch ? 'Register' : 'Incident register'}</button>} />
    );
  }

  const cycleRows = isAch ? row.achievements : row.incidents;
  const inCycle = {};
  cycleRows.forEach((r) => { inCycle[r.id] = true; });
  const pts = cycleRows.reduce((t, r) => t + (Number(r.points) || 0), 0);
  const applied = Math.min(pts, cap);
  const isPca = row.emp && row.emp.role === 'PCA';
  const cycleLabel = row.cycle ? row.cycle.label : '';
  const badges = isAch ? ACH_BADGES.filter(([, , test]) => all.some(test)) : [];
  const repeat = cycleRows.length > 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="btn" onClick={onBack}>‹ {isAch ? 'Register' : 'Incident register'}</button>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => setRoute({ view: 'perfStaff', emp: row.empId })}>Full performance record</button>
        {isAch
          ? <button className="btn" disabled={!all.length} onClick={() => onCert(all[0])}>Award certificate</button>
          : <button className="btn" onClick={() => window.print()}>Print record</button>}
      </div>

      {/* identity header */}
      <div className="card" style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={MK.av(row.name, 56)}>{MK.initials(row.name)}</div>
        <div style={{ minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 19, fontWeight: 700, color: MK.INK }}>{row.name}</span>
            <span style={MK.roleChip(isPca ? 'PCA' : 'Nurse')}>{isPca ? 'PCA' : 'Nurse'}</span>
          </div>
          <div style={{ fontSize: 12, color: MK.MUTED, marginTop: 2 }}>{row.designation || '—'} · {row.dept || 'Unassigned'}</div>
          {isAch ? (
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 9 }}>
              {badges.length === 0
                ? <span style={{ fontSize: 11.5, color: MK.FAINT }}>No badge earned yet — badges come from the categories recorded against this person.</span>
                : badges.map(([label, c]) => <span key={label} style={histChip(c, true)}>{label}</span>)}
            </div>
          ) : (
            <div style={{ marginTop: 9 }}>
              <span style={histChip(repeat ? '#8f2033' : '#1f9d57')}>
                {repeat ? 'Repeat case — ' + cycleRows.length + ' incidents in this cycle' : 'First incident in this cycle'}
              </span>
            </div>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: MK.FAINT }}>{isAch ? 'Points this cycle' : 'Points deducted'}</div>
          <div className="num" style={{ fontSize: 38, fontWeight: 700, color: tone, lineHeight: 1 }}>{pts}</div>
          <div style={{ fontSize: 11, color: MK.MUTED, marginTop: 3 }}>
            from {cycleRows.length} {isAch ? (cycleRows.length === 1 ? 'entry' : 'entries') : (cycleRows.length === 1 ? 'incident' : 'incidents')}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
        <div className="card">
          <div className="card-h"><h3>{isAch ? 'Recorded achievements' : 'Recorded incidents'}</h3></div>
          {all.length === 0 ? (
            <div className="card-b">
              <div className="sub" style={{ textAlign: 'center', padding: 18 }}>
                {isAch ? 'Nothing recorded against this staff member yet.' : 'Clean record — nothing recorded against this staff member.'}
              </div>
            </div>
          ) : all.map((p) => {
            const c = isAch ? catTone(kind, p.category) : sevTone(p.severity);
            return (
              <div key={p.id} style={{ display: 'flex', gap: 12, padding: '13px 16px', borderTop: '1px solid rgba(125,145,180,.14)', opacity: inCycle[p.id] ? 1 : .72 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, marginTop: 4, background: c }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: MK.INK, marginBottom: isAch ? 4 : 5 }}>{p.what || '—'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={tagPill(catTone(kind, p.category))}>{p.category || '—'}</span>
                    {!isAch && <span style={tagPill(sevTone(p.severity), true)}>{p.severity || '—'}</span>}
                    <span style={{ fontSize: 11, color: MK.MUTED }}>{isAch ? (p.level ? p.level + ' · ' : '') + p.date : p.date}</span>
                    {/* An entry from an earlier six-month window is still on the register but
                        no longer touches the current appraisal — say so rather than let the
                        card list disagree with the headline count. */}
                    {!inCycle[p.id] && <span style={tagPill('#8a93a3', true)}>earlier cycle</span>}
                  </div>
                  {!isAch && <div style={{ fontSize: 11, color: MK.BODY, marginTop: 6 }}>Action: {p.action || 'none recorded'}</div>}
                  {!isAch && p.note && <div style={{ fontSize: 11, color: MK.FAINT, marginTop: 3, lineHeight: 1.5 }}>{p.note}</div>}
                  {isAch && <div style={{ fontSize: 11, color: MK.FAINT, marginTop: 4 }}>Reward: {p.reward || 'none recorded'}</div>}
                  {isAch && p.note && <div style={{ fontSize: 11, color: MK.FAINT, marginTop: 3, lineHeight: 1.5 }}>{p.note}</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  <span className="num" style={{ fontSize: 15, fontWeight: 700, color: tone }}>{isAch ? '+' : '−'}{p.points}</span>
                  {isAch && <button className="btn" style={{ padding: '3px 9px', fontSize: 11 }} onClick={() => onCert(p)}>{p.certificate ? 'Certificate' : 'Issue'}</button>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="card" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: .6, textTransform: 'uppercase', color: MK.FAINT }}>Effect on the appraisal</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: MK.INK, margin: '8px 0 10px' }}>
            {isAch ? '+' : '−'}{applied} {isAch ? 'bonus points' : 'points'} {cycleLabel ? 'on the ' + cycleLabel + ' appraisal' : 'once an appraisal window opens'}
          </div>
          <div style={{ height: 8, borderRadius: 5, background: 'rgba(125,145,180,.16)', overflow: 'hidden', marginBottom: 8 }}>
            <div style={{
              width: (cap ? Math.round((applied / cap) * 100) : 0) + '%', height: '100%', borderRadius: 4,
              background: isAch ? 'linear-gradient(90deg,#3ab5a7,#0090ca)' : 'linear-gradient(90deg,#e08a1e,#d23a52)',
              animation: MK.ANIM,
            }} />
          </div>
          <div style={{ fontSize: 11, color: MK.FAINT, marginBottom: 12 }}>
            Cap is {cap} {isAch ? 'bonus points per cycle' : 'points per cycle'}
            {pts > cap ? ' — ' + (pts - cap) + ' of the ' + pts + ' recorded points fall outside it' : ''}
          </div>
          <div style={{ fontSize: 11.5, color: MK.MUTED, lineHeight: 1.6, borderTop: '1px solid rgba(125,145,180,.18)', paddingTop: 12 }}>
            {isAch
              ? 'Bonus points are added to the 100-mark total after the 20 parameters are scored, and are shown separately in Part H so the CNS can see what came from recognition rather than routine performance.'
              : 'Deductions are applied after the 20 parameters are scored and shown separately in Part H, so the CNS can see conduct history apart from routine performance. A serious or critical entry also carries the disciplinary action noted against it.'}
          </div>
          {!cycleLabel && (
            <div style={{ fontSize: 11.2, color: MK.FAINT, marginTop: 10 }}>
              No six-month window is open for this staff member yet, so nothing on this register has reached an appraisal.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EntryModal({ kind, roster, perf, onClose }) {
  const isAch = kind === 'ach';
  const cats = isAch ? ACH_CATEGORIES : INC_CATEGORIES;
  const [empId, setEmpId] = useState('');
  const [category, setCategory] = useState(cats[0].label);
  const [level, setLevel] = useState('');
  const [severity, setSeverity] = useState(SEVERITIES[0][0]);
  const [what, setWhat] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [reward, setReward] = useState('');
  const [action, setAction] = useState('');
  const [busy, setBusy] = useState(false);

  const row = roster.byEmp[empId];
  const catDef = cats.find((c) => c.label === category);
  const levels = (catDef && catDef.levels) || [];
  useEffect(() => { if (isAch && levels.length) setLevel(levels[0][0]); }, [category]);

  const points = isAch
    ? ((levels.find((l) => l[0] === level) || [null, 1])[1])
    : ((SEVERITIES.find((s) => s[0] === severity) || [null, 1])[1]);

  const alreadyThisCycle = row ? (isAch ? row.achievements : row.incidents).reduce((s, x) => s + (Number(x.points) || 0), 0) : 0;
  const cap = isAch ? capsOf(perf).bonus : capsOf(perf).penalty;   // server's cap, spec as fallback
  const effective = Math.max(0, Math.min(cap - alreadyThisCycle, points));

  const submit = () => {
    if (!row) return;
    setBusy(true);
    const body = {
      empId: row.empId, staffName: row.name, department: row.dept,
      cycleId: row.cycle ? row.cycle.id : '', date, category, what, note, points,
      ...(isAch ? { level, reward } : { severity, action }),
    };
    (isAch ? perf.addAchievement : perf.addIncident)(body).then((r) => { setBusy(false); if (r && r.ok) onClose(); });
  };

  return (
    <Modal wide title={isAch ? 'Record an achievement' : 'Record an incident'}
      sub={isAch ? 'Bonus points are added to the staff member\'s current appraisal' : 'The deduction shows on the staff member\'s current appraisal'}
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn pri" disabled={busy || !empId || !what.trim()} onClick={submit}>{busy ? 'Saving…' : (isAch ? 'Save achievement' : 'Save incident')}</button>
      </>}>
      <div style={{ display: 'grid', gap: 10 }}>
        <label style={{ display: 'grid', gap: 4 }}><span className="sub">Staff member *</span>
          <select value={empId} onChange={(e) => setEmpId(e.target.value)}>
            <option value="">Select…</option>
            {roster.rows.map((r) => <option key={r.empId} value={r.empId}>{r.name} — {r.empId} · {r.dept}</option>)}
          </select></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ display: 'grid', gap: 4 }}><span className="sub">Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>{cats.map((c) => <option key={c.id}>{c.label}</option>)}</select></label>
          {isAch ? (
            <label style={{ display: 'grid', gap: 4 }}><span className="sub">Level or basis — sets the points</span>
              <select value={level} onChange={(e) => setLevel(e.target.value)}>{levels.map((l) => <option key={l[0]} value={l[0]}>{l[0]} (+{l[1]})</option>)}</select></label>
          ) : (
            <label style={{ display: 'grid', gap: 4 }}><span className="sub">Severity — sets the points</span>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)}>{SEVERITIES.map((s) => <option key={s[0]} value={s[0]}>{s[0]} (−{s[1]})</option>)}</select></label>
          )}
        </div>
        <label style={{ display: 'grid', gap: 4 }}><span className="sub">{isAch ? 'What the achievement was *' : 'What happened *'}</span>
          <textarea rows="2" value={what} onChange={(e) => setWhat(e.target.value)} /></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ display: 'grid', gap: 4 }}><span className="sub">{isAch ? 'Date completed' : 'Date of incident'}</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label style={{ display: 'grid', gap: 4 }}><span className="sub">{isAch ? 'Reward (optional)' : 'Action taken'}</span>
            <input value={isAch ? reward : action} onChange={(e) => (isAch ? setReward : setAction)(e.target.value)}
              placeholder={isAch ? 'e.g. Certificate of appreciation' : 'e.g. Counselled, retraining scheduled'} /></label>
        </div>
        <label style={{ display: 'grid', gap: 4 }}><span className="sub">Note for the record</span>
          <textarea rows="2" value={note} onChange={(e) => setNote(e.target.value)} /></label>

        {row && (
          <div className="card" style={{ background: 'rgba(39,168,219,.06)' }}>
            <div className="card-b" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div className="sub" style={{ fontSize: 11 }}>This entry carries</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: isAch ? '#1f9d63' : '#d23a52' }}>{isAch ? '+' : '−'}{points}</div>
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div className="sub" style={{ fontSize: 11.3 }}>
                  {row.name} already has {alreadyThisCycle} of the {cap}-point {isAch ? 'bonus' : 'deduction'} cap
                  {row.cycle ? ' on the ' + row.cycle.label + ' appraisal' : ''}.
                </div>
                {effective < points && (
                  <div style={{ fontSize: 11.3, color: '#e0a12a', marginTop: 3 }}>
                    The cap means only {effective} of these {points} points will change the score.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function CertificateModal({ entry, onClose }) {
  return (
    <Modal wide title="Certificate of appreciation" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Close</button><button className="btn pri" onClick={() => window.print()}>Print certificate</button></>}>
      <div id="pdf-root" style={{ background: '#fff', color: '#16202e', padding: '36px 40px', textAlign: 'center', border: '3px double #0072a3', borderRadius: 6 }}>
        <img src="unico/logo.svg" alt="UNICO" style={{ height: 34, marginBottom: 14 }} />
        <div style={{ fontSize: 11, letterSpacing: 3, color: '#0072a3', fontWeight: 700 }}>CERTIFICATE OF APPRECIATION</div>
        <div style={{ margin: '18px 0 6px', fontSize: 12, color: '#556' }}>This certificate is awarded to</div>
        <div style={{ fontSize: 26, fontWeight: 700, borderBottom: '1px solid #cfd9e6', display: 'inline-block', padding: '0 26px 5px' }}>{entry.staffName}</div>
        <div style={{ margin: '16px auto 6px', fontSize: 12, color: '#556' }}>in recognition of</div>
        <div style={{ fontSize: 14, fontWeight: 600, maxWidth: 460, margin: '0 auto' }}>{entry.what}</div>
        <div style={{ fontSize: 11.5, color: '#556', marginTop: 8 }}>{entry.category}{entry.level ? ' · ' + entry.level : ''} · {entry.date}</div>
        <div style={{ marginTop: 12, fontSize: 11.5, color: '#1f9d63', fontWeight: 700 }}>+{entry.points} bonus points on the current appraisal cycle</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 40, fontSize: 10.5 }}>
          <div style={{ borderTop: '1px solid #333', paddingTop: 5 }}>Chief Nursing Superintendent</div>
          <div style={{ borderTop: '1px solid #333', paddingTop: 5 }}>Director, Administration</div>
        </div>
        <div style={{ fontSize: 9.5, color: '#889', marginTop: 16 }}>UNICO Hands of Care Hospitals · Issued {A.fmtDay(new Date())}</div>
      </div>
    </Modal>
  );
}

/* ================= 8. DEPARTMENT COMPARISON ================= */
const GRADE_ORDER = A.GRADES.map((g) => g.grade);   // A+ → E, straight off the spec

function PerfCompare({ roster, setRoute }) {
  const data = useMemo(() => {
    const m = {};
    roster.rows.forEach((r) => {
      const d = r.dept || 'Unassigned';
      const e = m[d] || (m[d] = { dept: d, n: 0, scores: [], grades: {}, cur: [], prev: [] });
      e.n++;
      if (r.status === 'actioned' && r.appraisal) {
        e.scores.push(r.appraisal.score);
        e.grades[r.appraisal.grade] = (e.grades[r.appraisal.grade] || 0) + 1;
        // Δ only means something for someone appraised twice, so pair this filed score
        // with that same person's previous filed one. Windows are personal, so there is
        // no single org-wide "previous cycle" to subtract.
        const prior = r.history.find((h) => h.cycleId !== r.appraisal.cycleId);
        if (prior) { e.cur.push(r.appraisal.score); e.prev.push(prior.score); }
      }
    });
    const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    return Object.values(m).map((e) => ({
      ...e,
      avg: e.scores.length ? Math.round(mean(e.scores)) : null,
      delta: e.cur.length ? mean(e.cur) - mean(e.prev) : null,
      graded: e.scores.length,
    })).sort((a, b) => (b.avg == null ? -1 : b.avg) - (a.avg == null ? -1 : a.avg));
  }, [roster.rows]);

  const mix = useMemo(() => data.filter((d) => d.graded > 0), [data]);

  const top = useMemo(() => roster.rows.filter((r) => r.last).sort((a, b) => b.last.score - a.last.score).slice(0, 10), [roster.rows]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card">
        <div className="card-h"><h3>Average score by department</h3><div className="sub">completed appraisals only · Δ vs each person's previous appraisal</div></div>
        <div className="card-b">
          {data.every((d) => d.avg == null) ? <Empty title="No completed appraisals yet" /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {data.map((d, i) => (
                <div key={d.dept} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="num" style={{ fontSize: 10.5, color: MK.FAINT, width: 18, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                  <div style={{ width: 150, fontSize: 12 }}>{d.dept}</div>
                  <div style={{ flex: 1 }}><Bar value={d.avg || 0} max={100} color={gradeColor(A.gradeFor(d.avg || 0).grade)} height={10} /></div>
                  <div className="num" style={{ width: 40, textAlign: 'right' }}>{d.avg == null ? '—' : d.avg}</div>
                  <div style={{ width: 34 }}>{d.avg != null && <GradePill grade={A.gradeFor(d.avg).grade} />}</div>
                  <span className="num" title={d.delta == null ? 'Nobody in this unit has two filed appraisals yet' : d.cur.length + ' staff appraised twice'}
                    style={{
                      fontSize: 10.5, fontWeight: 600, padding: '1px 7px', borderRadius: 12, width: 44,
                      textAlign: 'center', flexShrink: 0,
                      color: d.delta == null ? MK.FAINT : (d.delta < 0 ? '#d23a52' : '#1f9d57'),
                      background: d.delta == null ? 'rgba(125,145,180,.14)' : (d.delta < 0 ? 'rgba(210,58,82,.14)' : 'rgba(31,157,87,.15)'),
                    }}>
                    {d.delta == null ? '—' : (d.delta >= 0 ? '+' : '') + d.delta.toFixed(1)}
                  </span>
                  <div className="sub" style={{ width: 62, textAlign: 'right', fontSize: 11 }}>{d.scores.length}/{d.n}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h3>Grade mix by department</h3>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            {GRADE_ORDER.map((g) => (
              <span key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: MK.MUTED }}>
                <i style={{ width: 9, height: 9, borderRadius: 3, background: MK.GC[g], display: 'inline-block' }} />{g}
              </span>
            ))}
          </div>
        </div>
        <div className="card-b">
          {mix.length === 0 ? <Empty title="No completed appraisals yet" sub="Grades appear here as appraisals are filed, one stacked bar per department." /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {mix.map((d) => (
                <div key={d.dept} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: MK.BODY, width: 150, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.dept}</span>
                  <div style={{ flex: 1, display: 'flex', height: 13, borderRadius: 4, overflow: 'hidden', background: 'rgba(125,145,180,.16)' }}>
                    {GRADE_ORDER.filter((g) => d.grades[g]).map((g) => (
                      <div key={g} title={d.grades[g] + ' × ' + g}
                        style={{ width: (d.grades[g] / d.graded) * 100 + '%', background: MK.GC[g], height: '100%', animation: MK.ANIM }} />
                    ))}
                  </div>
                  <span className="num" style={{ fontSize: 11, color: MK.FAINT, width: 34, textAlign: 'right' }}>{d.graded}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h3>Top performers</h3><div className="sub">by latest filed appraisal</div></div>
        <div className="card-b" style={{ overflow: 'auto' }}>
          {top.length === 0 ? <Empty title="No filed appraisals yet" /> : (
            <table className="tbl" style={{ width: '100%' }}>
              <thead><tr><th style={{ width: 34 }}>#</th><th>Staff</th><th>Department</th><th>Period</th><th>Score</th><th>Grade</th></tr></thead>
              <tbody>
                {top.map((r, i) => (
                  <tr key={r.empId} style={{ cursor: 'pointer' }} onClick={() => setRoute({ view: 'perfStaff', emp: r.empId })}>
                    <td className="num">{i + 1}</td>
                    <td><b>{r.name}</b><div className="sub" style={{ fontSize: 11 }}>{r.designation}</div></td>
                    <td>{r.dept}</td><td className="sub">{r.last.cycleLabel}</td>
                    <td className="num">{r.last.score}</td><td><GradePill grade={r.last.grade} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= 9. ATTRITION DRILL-INS =================
   The Department Attrition and Leaver Record screens from the mockup. The attrition
   OVERVIEW lives in performance-hr.jsx (window.PerfAttrition) which this file does not
   own, so the drill-ins are hosted here under the existing `perfAttrition` route: a new
   perf* route name would also have to be added to ui.jsx UNICO_MODULE_VIEWS (or the
   sidebar would light up the wrong workspace) and to app.jsx PV_TITLE.

   The leaver maths is deliberately the SAME as performance-hr.jsx's: leavers are the
   roster's own archived records, enriched by an exit record where HR has filed one, so
   a leaver with no paperwork still counts in the headcount maths and simply contributes
   no reason or tenure. Those helpers are file-scoped in the bundle's IIFE, so they are
   restated here rather than reached for. If one changes, change both. */
const ATTR_TARGET = 18;             // the annual attrition target performance-hr.jsx reports against
const attrParse = (v) => { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d; };
const attrMonths = (a, b) => (a && b ? (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) : null);
const attrTenure = (m) => {
  if (m == null) return '—';
  if (m < 12) return m + ' mo';
  const y = Math.floor(m / 12), r = m % 12;
  return y + ' yr' + (y > 1 ? 's' : '') + (r ? ' ' + r + ' mo' : '');
};

function useLeavers(staffStore, perf) {
  return useMemo(() => {
    const exitBy = {};
    (perf.exits || []).forEach((x) => { exitBy[x.empId] = x; });
    // Last filed grade, for leavers who are no longer on roster.byEmp at all.
    const gradeBy = {};
    (perf.appraisals || []).filter((a) => a.status === 'actioned')
      .sort((a, b) => String(a.cycleStart).localeCompare(String(b.cycleStart)))
      .forEach((a) => { gradeBy[a.empId] = a.grade; });

    return (staffStore.staff || []).filter((e) => e.former || e.is_active === false).map((e) => {
      const empId = e.emp_id || String(e.id);
      const x = exitBy[empId] || null;
      const left = attrParse(x && x.lastDay) || (e.archived_at ? new Date(e.archived_at) : null);
      const joined = attrParse(e.doj);
      return {
        empId, emp: e, name: e.name, dept: e.current_department || 'Unassigned',
        designation: e.designation, role: e.role === 'PCA' ? 'PCA' : 'Nurse',
        joined, left, exit: x, documented: !!x,
        reason: (x && x.reason) || e.archived_reason || '',
        separation: (x && x.separation) || '',
        interview: (x && x.interview) || '',
        clearance: (x && x.clearance) || [],
        rehire: x ? !!x.rehire : null,
        noticeDate: attrParse(x && x.noticeDate),
        lastGrade: (x && x.lastGrade) || gradeBy[empId] || '',
        tenure: attrMonths(joined, left),
      };
    }).filter((l) => l.left).sort((a, b) => b.left - a.left);
  }, [staffStore.staff, perf.exits, perf.appraisals]);
}

// Per-unit roll-up. Exits are the rolling 12 months so the tile, the rate and the list
// on the drill-in all describe the same window.
function useUnitAttrition(staffStore, leavers) {
  return useMemo(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const m = {};
    const at = (d) => m[d] || (m[d] = { dept: d, roster: 0, nurses: 0, pcas: 0, exits: 0, list: [] });
    (staffStore.staff || []).filter((e) => e.is_active !== false && !e.former).forEach((e) => {
      const u = at(e.current_department || 'Unassigned');
      u.roster++; if (e.role === 'PCA') u.pcas++; else u.nurses++;
    });
    leavers.forEach((l) => { if (l.left >= from) { const u = at(l.dept); u.exits++; u.list.push(l); } });
    const units = Object.values(m).map((u) => ({
      ...u,
      // Same denominator as the attrition overview: the unit as it stood before the exits.
      rate: u.roster + u.exits ? (u.exits / (u.roster + u.exits)) * 100 : 0,
    })).sort((a, b) => b.rate - a.rate || b.exits - a.exits);
    units.forEach((u, i) => { u.rank = i + 1; });
    return units;
  }, [staffStore.staff, leavers]);
}

function AttrTile({ label, value, foot, color }) {
  return (
    <div className="card" style={{ padding: '15px 18px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: .6, textTransform: 'uppercase', color: MK.FAINT }}>{label}</div>
      <div className="num" style={{ fontSize: 24, fontWeight: 700, color: color || MK.INK, margin: '6px 0 4px', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: MK.MUTED }}>{foot}</div>
    </div>
  );
}

function PerfDeptAttrition({ unit, units, flagged, onFlag, onBack, onLeaver }) {
  const u = units.find((x) => x.dept === unit);
  if (!u) {
    return (
      <Empty icon={I.layers} title="Unit not found"
        sub="Nobody is on this unit's roster and no exit has been recorded against it."
        action={<button className="btn" onClick={onBack}>‹ Attrition</button>} />
    );
  }
  const fyFrom = new Date(new Date().getFullYear(), 0, 1);   // the reporting year is the calendar year
  const inFy = u.list.filter((l) => l.left >= fyFrom).length;
  const rateColor = u.rate > ATTR_TARGET ? '#d23a52' : '#1f9d57';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn" onClick={onBack}>‹ Attrition</button>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: MK.INK }}>{u.dept} — attrition detail</div>
          <div style={{ fontSize: 11.5, color: MK.MUTED }}>rolling 12 months · staff attached to the unit</div>
        </div>
        <div style={{ flex: 1 }} />
        {/* Session-only marker: there is no HR-review flag on the exit record, so this is
            not written anywhere and is honest about that in its tooltip. */}
        <button className="btn" title="Marks the unit for this session only — not saved to the record"
          style={flagged ? { borderColor: 'rgba(210,58,82,.4)', background: 'rgba(210,58,82,.12)', color: '#d23a52' } : null}
          onClick={() => onFlag(u.dept)}>{flagged ? 'Flagged for HR review' : 'Flag for HR review'}</button>
        <button className="btn" onClick={() => window.print()}>Print</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}>
        <AttrTile label="Attrition rate" value={u.rate.toFixed(1) + '%'} color={rateColor}
          foot={(u.rate > ATTR_TARGET ? 'above' : 'within') + ' the ' + ATTR_TARGET + '% target'} />
        <AttrTile label="Exits · 12 months" value={u.exits} foot="recorded separations" />
        <AttrTile label="Staff on unit" value={u.roster}
          foot={u.nurses + ' nurse' + (u.nurses === 1 ? '' : 's') + ' · ' + u.pcas + ' PCA' + (u.pcas === 1 ? '' : 's') + ' attached'} />
        <AttrTile label="Rank" value={'#' + u.rank} foot={'of ' + units.length + ' units by attrition rate'} />
      </div>

      <div className="card">
        <div className="card-h" style={{ flexWrap: 'wrap' }}>
          <h3>Leavers from this unit</h3>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: MK.FAINT }}>{inFy} of these {u.exits} exits fall inside the current fiscal year</span>
        </div>
        {u.list.length === 0 ? (
          <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 12.5, color: MK.FAINT }}>
            No exits recorded for this unit in the last 12 months.
          </div>
        ) : u.list.map((l) => (
          <div key={l.empId} onClick={() => onLeaver(l.empId)}
            style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 16px', borderTop: '1px solid rgba(125,145,180,.14)', cursor: 'pointer' }}>
            <div style={MK.av(l.name, 30)}>{MK.initials(l.name)}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: MK.INK }}>{l.name}</span>
                <span style={MK.roleChip(l.role)}>{l.role}</span>
              </div>
              <div style={{ fontSize: 11, color: MK.MUTED }}>
                {l.designation || '—'} · left {A.fmtDay(l.left)} after {attrTenure(l.tenure)}
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: MK.BODY, textAlign: 'right' }}>{l.reason || <span style={{ color: MK.FAINT }}>reason not recorded</span>}</div>
            <span style={{ color: '#0090ca', flexShrink: 0 }}>›</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PerfLeaverRecord({ empId, leavers, onBack }) {
  const l = leavers.find((x) => x.empId === empId);
  if (!l) {
    return (
      <Empty icon={I.user} title="Leaver not found"
        sub="This record is no longer in the roster archive, so nothing can be shown against it."
        action={<button className="btn" onClick={onBack}>‹ Attrition</button>} />
    );
  }
  const notRec = <span style={{ color: MK.FAINT, fontWeight: 500 }}>Not recorded</span>;
  const facts = [
    ['Date of joining', l.joined ? A.fmtDay(l.joined) : null],
    ['Last working day', l.left ? A.fmtDay(l.left) : null],
    ['Total tenure', l.tenure == null ? null : attrTenure(l.tenure)],
    ['Department at exit', l.dept],
    ['Designation', l.designation],
    ['Separation type', l.separation],
    ['Stated reason', l.reason],
    ['Last appraisal grade', l.lastGrade],
    ['Exit interview', l.interview ? 'Conducted' : null],
  ];
  const has = (item) => l.clearance.indexOf(item) >= 0;
  const noticeDays = l.noticeDate && l.left ? Math.round((l.left - l.noticeDate) / 86400000) : null;
  // Every step is evidenced by something HR actually filed; a step with no evidence says
  // so rather than being coloured in as done.
  const trail = [
    ['Resignation submitted', l.noticeDate ? 'Notice received ' + A.fmtDay(l.noticeDate) : (l.documented ? 'No notice date on the exit record' : 'No exit record filed'), !!l.noticeDate],
    ['Notice period', noticeDays == null ? 'Not recorded' : noticeDays + ' day' + (noticeDays === 1 ? '' : 's') + ' between notice and last working day', noticeDays != null],
    ['Handover to charge nurse', has('Handover completed') ? 'Handover completed' : 'Not ticked on the clearance checklist', has('Handover completed')],
    ['Accounts clearance', has('Dues cleared') ? 'Dues cleared' : 'Not ticked on the clearance checklist', has('Dues cleared')],
    ['Exit interview', l.interview ? l.interview : 'Not recorded', !!l.interview],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="btn" onClick={onBack}>‹ Exits register</button>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => window.print()}>Print record</button>
      </div>

      <div className="card" style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={MK.av(l.name, 56)}>{MK.initials(l.name)}</div>
        <div style={{ minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 19, fontWeight: 700, color: MK.INK }}>{l.name}</span>
            <span style={MK.roleChip(l.role)}>{l.role}</span>
          </div>
          <div style={{ fontSize: 12, color: MK.MUTED, marginTop: 2 }}>{l.designation || '—'} · {l.dept}</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: MK.FAINT }}>Last working day</div>
          <div className="num" style={{ fontSize: 17, fontWeight: 700, color: MK.INK }}>{l.left ? A.fmtDay(l.left) : '—'}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'flex-end' }}>
          {l.lastGrade
            ? <span style={MK.gchip(l.lastGrade, true)}>{l.lastGrade}</span>
            : <span style={histChip('#8a93a3')}>Never appraised</span>}
          {/* Re-hire eligibility is a field on the exit record. With no exit record there is
              no decision to report — do not infer one from the separation type. */}
          <span style={histChip(l.rehire == null ? '#8a93a3' : (l.rehire ? '#1f9d57' : '#d23a52'))}>
            {l.rehire == null ? 'Re-hire not assessed' : (l.rehire ? 'Eligible for rehire' : 'Not eligible for rehire')}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
        <div className="card">
          <div className="card-h"><h3>Service record</h3></div>
          <div style={{ padding: '4px 16px 12px' }}>
            {facts.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid rgba(125,145,180,.12)' }}>
                <span style={{ fontSize: 11.5, color: MK.FAINT, minWidth: 0, flex: 1 }}>{k}</span>
                <span style={{ fontSize: 12.5, color: MK.INK, fontWeight: 600, textAlign: 'right' }}>{v || notRec}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="card-h"><h3>Separation trail</h3></div>
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {trail.map(([t, s, done]) => (
                <div key={t} style={{ display: 'flex', gap: 11 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, marginTop: 4, background: done ? '#1f9d57' : 'rgba(125,145,180,.45)' }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: MK.INK }}>{t}</div>
                    <div style={{ fontSize: 11, color: MK.MUTED }}>{s}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: '15px 17px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: .6, textTransform: 'uppercase', color: MK.FAINT, marginBottom: 7 }}>Stated reason at exit</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: MK.INK }}>{l.reason || notRec}</div>
            <div style={{ fontSize: 11.5, color: MK.MUTED, marginTop: 6, lineHeight: 1.55 }}>
              {l.documented
                ? 'Recorded by the nurse in-charge at handover and confirmed by HR during clearance. Counted as a ' + (l.separation || 'recorded') + ' separation in the attrition figures.'
                : 'No exit record has been filed for this leaver — the roster archive is all this module knows. They still count in the attrition figures; the reason, tenure and clearance analysis stays empty until HR records the exit.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Host for the `perfAttrition` route: the overview screen still comes from
   performance-hr.jsx, the two drill-ins are rendered here. The opener is also published
   on window.PerfUI so that file can hand off from its own "By unit" table and exits
   register in one line each, once it is being edited. */
function PerfAttritionRoute({ roster, perf, staffStore, setRoute }) {
  const [drill, setDrill] = useState(null);     // null | {kind:'dept',dept} | {kind:'leaver',empId}
  const [flags, setFlags] = useState({});
  const leavers = useLeavers(staffStore, perf);
  const units = useUnitAttrition(staffStore, leavers);
  const Overview = window.PerfAttrition;

  useEffect(() => {
    window.PerfUI.openAttritionDrill = setDrill;
    return () => { if (window.PerfUI.openAttritionDrill === setDrill) window.PerfUI.openAttritionDrill = null; };
  }, []);

  if (drill && drill.kind === 'leaver') {
    return <PerfLeaverRecord empId={drill.empId} leavers={leavers} onBack={() => setDrill(null)} />;
  }
  if (drill && drill.kind === 'dept') {
    return (
      <PerfDeptAttrition unit={drill.dept} units={units} flagged={!!flags[drill.dept]}
        onFlag={(d) => setFlags((s) => ({ ...s, [d]: !s[d] }))}
        onBack={() => setDrill(null)}
        onLeaver={(empId) => setDrill({ kind: 'leaver', empId })} />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* The overview's own unit table and exits register cannot open these screens yet
          (that file is not edited here), so the two drill-ins are opened from this strip. */}
      <div className="card" style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: .6, textTransform: 'uppercase', color: MK.FAINT }}>Drill in</span>
        <select value="" onChange={(e) => { if (e.target.value) setDrill({ kind: 'dept', dept: e.target.value }); }}>
          <option value="">Unit attrition detail…</option>
          {units.map((u) => <option key={u.dept} value={u.dept}>{u.dept} — {u.rate.toFixed(1)}% · {u.exits} exit{u.exits === 1 ? '' : 's'}</option>)}
        </select>
        <select value="" onChange={(e) => { if (e.target.value) setDrill({ kind: 'leaver', empId: e.target.value }); }}>
          <option value="">Leaver record…</option>
          {leavers.map((l) => <option key={l.empId} value={l.empId}>{l.name} — {l.dept} · {A.fmtDay(l.left)}</option>)}
        </select>
        {leavers.length === 0 && <span style={{ fontSize: 11.5, color: MK.FAINT }}>Nobody has been archived off the roster yet, so there is no leaver to open.</span>}
      </div>
      {Overview ? <Overview roster={roster} perf={perf} staffStore={staffStore} setRoute={setRoute} /> : null}
    </div>
  );
}

/* ================= root ================= */
function PerformanceView({ view, emp, cycleId, setRoute }) {
  const staffStore = window.useStaffStore();
  const perf = usePerfStore();
  const roster = useRoster(staffStore, perf);

  if (perf.loading) {
    return <div style={{ display: 'grid', placeItems: 'center', height: '40vh', color: 'var(--muted,#8aa0b8)' }}>Loading performance records…</div>;
  }
  if (perf.error) {
    return <Empty icon={I.alert || I.pulse} title="Could not load performance records" sub={perf.error}
      action={<button className="btn pri" onClick={perf.reload}>Try again</button>} />;
  }

  const inner = (() => {
  switch (view) {
    case 'perfDirectory': return <PerfDirectory roster={roster} staffStore={staffStore} setRoute={setRoute} />;
    case 'perfForm': return <PerfForm roster={roster} perf={perf} empId={emp} setRoute={setRoute} />;
    case 'perfPrint': return <PerfPrint roster={roster} empId={emp} cycleId={cycleId} setRoute={setRoute} />;
    case 'perfStaff': return <PerfStaffRecord roster={roster} perf={perf} empId={emp} setRoute={setRoute} />;
    case 'perfQueue': return <PerfQueue roster={roster} perf={perf} setRoute={setRoute} />;
    // Keyed so the two registers are distinct instances. Sharing one meant a category
    // filter picked on Incidents silently emptied Achievements, with no chip to explain it.
    case 'perfAchievements': return <PerfRegister key={'ach|' + (emp || '')} kind="ach" roster={roster} perf={perf} setRoute={setRoute} focusEmp={emp} />;
    case 'perfIncidents': return <PerfRegister key={'inc|' + (emp || '')} kind="inc" roster={roster} perf={perf} setRoute={setRoute} focusEmp={emp} />;
    case 'perfCompare': return <PerfCompare roster={roster} setRoute={setRoute} />;
    // Attrition keeps its overview in performance-hr.jsx but its drill-ins here, so the
    // route goes through a local host rather than straight to window.PerfAttrition.
    case 'perfAttrition': return <PerfAttritionRoute roster={roster} perf={perf} staffStore={staffStore} setRoute={setRoute} />;
    case 'perfRisk': case 'perfBoard': {
      // Resolved through window because performance-hr.jsx is a separate bundled file.
      const C = window[{ perfRisk: 'PerfRisk', perfBoard: 'PerfBoard' }[view]];
      return C ? <C roster={roster} perf={perf} staffStore={staffStore} setRoute={setRoute} /> : null;
    }
    default: return <PerfDashboard roster={roster} perf={perf} setRoute={setRoute} />;
  }
  })();
  return <div className="mk-scope">{inner}</div>;
}

window.PerformanceView = PerformanceView;

/* ---- Nurse-Management bands -------------------------------------------------
   The mockup surfaces recognition/conduct and appraisal progress on the Nurse
   Management dashboard, not only inside this module. Rendered there through
   window.PerfBands so staff.jsx needs one line and keeps its own screen intact. */
function PerfBands({ role, setRoute }) {
  const staffStore = window.useStaffStore();
  const [data, setData] = useState(null);
  useEffect(() => {
    let live = true;
    perfApi.get('/api/performance').then((r) => { if (live && r && r.ok) setData(r); }).catch(() => {});
    return () => { live = false; };
  }, []);

  const org = A.orgCycle(new Date());
  const rows = useMemo(() => {
    const now = new Date();
    return (staffStore.staff || [])
      .filter((e) => e.is_active !== false && !e.former && (!role || (e.role || 'Nurse') === role))
      .map((e) => {
        const empId = e.emp_id || String(e.id);
        const cyc = A.cycleOf(e.doj, now);
        const apr = data ? (data.appraisals || []).find((x) => x.empId === empId && cyc && x.cycleId === cyc.id) : null;
        const firstDue = e.doj ? A.addMonths(A.parseDate(e.doj) || now, 6) : null;
        // Same rule as useRoster, deliberately: a dashboard band that disagrees with
        // the module it links to is worse than no band at all.
        const lastClosed = e.doj ? (A.cyclesSince(e.doj, now, 1) || [])[0] : null;
        // In this component the records arrive as `data`, not the module's `perf`.
        const all = (data && data.appraisals) || [];
        const missedClosed = !!(lastClosed && !all.some((x) => x.empId === empId && x.cycleId === lastClosed.id));
        return { empId, cycle: cyc, apr, status: apr ? apr.status : 'none', overdue: missedClosed,
          newJoinerDue: !!(firstDue && firstDue <= now && !all.some((x) => x.empId === empId)) };
      });
  }, [staffStore.staff, data, role]);

  if (!data) return null;
  const ach = data.achievements || [], inc = data.incidents || [];
  const achPts = ach.reduce((t, x) => t + (Number(x.points) || 0), 0);
  const incPts = inc.reduce((t, x) => t + (Number(x.points) || 0), 0);
  const recognised = new Set(ach.map((x) => x.empId)).size;
  const withInc = new Set(inc.map((x) => x.empId)).size;
  const done = rows.filter((r) => r.status === 'actioned').length;
  const pending = rows.length - done;
  const newJoiners = rows.filter((r) => r.overdue).length;
  const pctDone = rows.length ? Math.round((done / rows.length) * 100) : 0;

  const Metric = ({ icon, tint, value, label, sub, tone }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 168 }}>
      <div style={MK.iconBadge(tint, 30)}><Ic d={icon} s={15} /></div>
      <div>
        <div className="num" style={{ fontSize: 19, fontWeight: 700, color: tone || MK.INK, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 11, color: MK.BODY }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: MK.FAINT }}>{sub}</div>}
      </div>
    </div>
  );

  return (
    <div className="mk-scope" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
      <div className="card">
        <div className="card-h">
          <div style={MK.iconBadge('amber', 30)}><Ic d={I.heart} s={15} /></div>
          <h3>Recognition and conduct — {org.label}</h3>
          <div style={{ flex: 1 }} />
          <span onClick={() => setRoute({ view: 'perfAchievements' })} style={{ cursor: 'pointer', fontSize: 10.6, fontWeight: 600, padding: '3px 11px', borderRadius: 12, color: '#0072a3', background: 'rgba(0,144,202,.12)' }}>Achievements</span>
          <span onClick={() => setRoute({ view: 'perfIncidents' })} style={{ cursor: 'pointer', fontSize: 10.6, fontWeight: 600, padding: '3px 11px', borderRadius: 12, color: '#d23a52', background: 'rgba(210,58,82,.12)' }}>Incidents</span>
        </div>
        <div className="card-b" style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
          <Metric icon={I.heart} tint="green" tone="#1f9d57" value={ach.length} label="Achievements recorded" sub={'+' + achPts + ' points'} />
          <Metric icon={I.alert || I.pulse} tint="red" tone="#d23a52" value={inc.length} label="Incidents recorded" sub={'−' + incPts + ' points'} />
          <Metric icon={I.user} tint="blue" value={recognised} label="Staff recognised" sub={rows.length ? Math.round((recognised / rows.length) * 100) + '% of the roster' : '—'} />
          <Metric icon={I.doc} tint="amber" value={withInc} label="Staff with incidents" sub={rows.length ? Math.round((withInc / rows.length) * 100) + '% of the roster' : '—'} />
        </div>
      </div>

      <div className="card">
        <div className="card-b" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={MK.iconBadge('blue', 30)}><Ic d={I.doc} s={15} /></div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: MK.INK }}>Individual Performance — {org.label} cycle</div>
            <div style={{ fontSize: 11.4, color: MK.MUTED }}>
              {pctDone}% complete · {pending} appraisal{pending === 1 ? '' : 's'} pending
              {newJoiners ? ' · ' + newJoiners + ' past their first 6-month appraisal' : ''}
            </div>
          </div>
          <div style={{ width: 150 }}><div style={MK.track(7)}><div style={MK.fill(pctDone, MK.progColor(pctDone / 100))} /></div></div>
          <button className="btn pri" onClick={() => setRoute({ view: 'perfHome' })}>Open Performance →</button>
        </div>
      </div>
    </div>
  );
}
window.PerfBands = PerfBands;


// Every file in the bundle is wrapped in its own IIFE (see scripts/build-renderer.js),
// so `window` is the ONLY way one renderer file can reach another. These are the pieces
// performance-hr.jsx builds on; it destructures them at load time, which is why
// performance.jsx must come first in the MANIFEST.
window.PerfUI = {
  Stat, AccentStat, Bar, Gauge, Empty, Modal, GradePill, StatusChip, Trend, QuickCard, EntryList,
  initials, pct, gradeColor, todayISO, perfApi, perfToast, perfIsAdmin, perfCan, perfPortal,
  capsOf,
  // The attrition drill-ins and their data, for performance-hr.jsx: its "By unit" table
  // and exits register rows only need to call
  //   window.PerfUI.openAttritionDrill({ kind:'dept', dept })      // Department Attrition
  //   window.PerfUI.openAttritionDrill({ kind:'leaver', empId })   // Leaver Record
  // which PerfAttritionRoute installs while the attrition route is mounted.
  PerfDeptAttrition, PerfLeaverRecord, useLeavers, useUnitAttrition, attrTenure,
  openAttritionDrill: null,
};
