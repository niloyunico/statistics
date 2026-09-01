/* UNICO — Performance module, HR views.
 *
 *   perfAttrition  who left, when, why — and the attrition rate computed both ways
 *   perfRisk       retention-risk watchlist: who to speak with this month, and why
 *   perfBoard      recognition wall, leaderboard, awards and the points scheme
 *
 * Split out of performance.jsx purely for file size; it is the same module and shares
 * its store, roster and helpers (the bundle is one scope — see build-renderer.js).
 *
 * WHERE THE NUMBERS COME FROM. Leavers are the roster's own archived records
 * (staff.former, set when somebody is removed from the roster), enriched by the exit
 * register where an exit has actually been recorded. That means the headcount maths is
 * always right even when HR has not yet filled in the paperwork — a leaver with no exit
 * record still counts as a leaver, it just contributes no reason or tenure analysis.
 * Nothing here invents a number it does not have; a missing input shows as "—".
 */

const { useState, useMemo } = React;
const Ic = window.Ic, I = window.I;
const A = window.UNICO_APPRAISAL;
const MK = window.MK;
// Shared with performance.jsx through window — each bundled file has its own scope.
const {
  Stat, AccentStat, Bar, Empty, Modal, GradePill, initials, todayISO, perfCan,
} = window.PerfUI;

const HR_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CLEARANCE_ITEMS = ['ID card returned', 'Locker / keys returned', 'Uniform returned', 'Library / manuals returned', 'Handover completed', 'Final duty roster settled', 'Dues cleared'];

const hrMonthKey = (d) => (d ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') : '');
const hrParse = (v) => { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d; };
// Tenure in whole months, used for the tenure-at-exit buckets.
function hrMonthsBetween(a, b) {
  if (!a || !b) return null;
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}
function hrTenureLabel(months) {
  if (months == null) return '—';
  if (months < 12) return months + ' mo';
  const y = Math.floor(months / 12), m = months % 12;
  return y + ' yr' + (y > 1 ? 's' : '') + (m ? ' ' + m + ' mo' : '');
}

/* ================= ATTRITION ================= */
// KPI tile with BOTH a coloured left rule and a small icon badge — the treatment the
// mockup uses on the attrition screen.
function RuleStat({ label, value, sub, color, tint, icon }) {
  return (
    <div className="card" style={{ padding: '13px 15px', borderLeft: '3px solid ' + color }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={MK.iconBadge(tint, 30)}><Ic d={icon || I.user} s={15} /></div>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: MK.INK }}>{label}</span>
      </div>
      <div className="num" style={{ fontSize: 29, fontWeight: 700, color: color, lineHeight: 1.05, margin: '7px 0 5px', letterSpacing: '-.5px' }}>{value}</div>
      <div style={{ fontSize: 10.8, color: MK.FAINT }}>{sub}</div>
    </div>
  );
}

const ATTR_PERIODS = [
  { id: 'fy', label: 'FY YTD' },
  { id: '12', label: 'Rolling 12 months' },
  { id: '1', label: 'Current month' },
  { id: 'cycle', label: 'Current cycle' },
];

function PerfAttrition({ roster, perf, staffStore, setRoute }) {
  const [adding, setAdding] = useState(false);
  const [unit, setUnit] = useState('');
  const [period, setPeriod] = useState('12');
  const now = new Date();

  const leavers = useMemo(() => {
    const exitBy = {};
    (perf.exits || []).forEach((x) => { exitBy[x.empId] = x; });
    return (staffStore.staff || []).filter((e) => e.former || e.is_active === false).map((e) => {
      const empId = e.emp_id || String(e.id);
      const x = exitBy[empId] || null;
      const left = hrParse(x && x.lastDay) || (e.archived_at ? new Date(e.archived_at) : null);
      const joined = hrParse(e.doj);
      return {
        empId, name: e.name, dept: e.current_department, designation: e.designation,
        joined, left, exit: x,
        reason: (x && x.reason) || e.archived_reason || '',
        separation: (x && x.separation) || '',
        tenure: hrMonthsBetween(joined, left),
        documented: !!x,
      };
    }).filter((l) => l.left).sort((a, b) => b.left - a.left);
  }, [staffStore.staff, perf.exits]);

  const active = (staffStore.staff || []).filter((e) => e.is_active !== false && !e.former);

  // How many months the chosen period covers, and when it starts.
  const months = period === '1' ? 1 : period === 'fy' ? (now.getMonth() + 1) : period === 'cycle' ? 6 : 12;
  const series = useMemo(() => {
    const out = [];
    for (let k = 11; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
      const key = hrMonthKey(d);
      const n = leavers.filter((l) => hrMonthKey(l.left) === key).length;
      const after = leavers.filter((l) => l.left > new Date(d.getFullYear(), d.getMonth() + 1, 0)).length;
      const head = active.length + after;
      out.push({ key, label: HR_MONTHS[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2), leavers: n, head, rate: head ? (n / head) * 100 : 0 });
    }
    return out;
  }, [leavers, active.length]);

  const window_ = series.slice(12 - months);
  const totalLeavers = window_.reduce((t, m) => t + m.leavers, 0);
  const avgHead = window_.length ? Math.round(window_.reduce((t, m) => t + m.head, 0) / window_.length) : 0;
  const openingHead = window_.length ? window_[0].head : 0;
  const monthlyRate = avgHead && months ? (totalLeavers / months / avgHead) * 100 : 0;
  const rateA = monthlyRate * 12;                                                   // annualised from the monthly rate
  const rateB = openingHead ? (totalLeavers / openingHead) * (12 / months) * 100 : 0; // annualised on opening headcount
  const TARGET = 18;

  // First-year attrition: of the people who joined in the last 12 months, how many left
  // within twelve months of joining.
  const firstYear = useMemo(() => {
    const cutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const joiners = (staffStore.staff || []).filter((e) => { const j = hrParse(e.doj); return j && j >= cutoff; });
    const lost = leavers.filter((l) => l.joined && l.joined >= cutoff && l.tenure != null && l.tenure < 12);
    return { joiners: joiners.length, lost: lost.length, pct: joiners.length ? (lost.length / joiners.length) * 100 : 0 };
  }, [staffStore.staff, leavers]);

  const tenures = leavers.map((l) => l.tenure).filter((x) => x != null).sort((a, b) => a - b);
  const avgTenure = tenures.length ? Math.round(tenures.reduce((a, b) => a + b, 0) / tenures.length) : null;
  const medTenure = tenures.length ? tenures[Math.floor(tenures.length / 2)] : null;

  const byUnit = useMemo(() => {
    const m = {};
    active.forEach((e) => { const d = e.current_department || 'Unassigned'; (m[d] = m[d] || { dept: d, roster: 0, exits: 0 }).roster++; });
    leavers.forEach((l) => { const d = l.dept || 'Unassigned'; (m[d] = m[d] || { dept: d, roster: 0, exits: 0 }).exits++; });
    return Object.values(m).map((x) => ({ ...x, rate: x.roster + x.exits ? (x.exits / (x.roster + x.exits)) * 100 : 0 }))
      .sort((a, b) => b.rate - a.rate);
  }, [active, leavers]);

  const tenureBuckets = useMemo(() => {
    const b = [['Under 6 months', 0], ['6–12 months', 0], ['1–2 years', 0], ['2–5 years', 0], ['Over 5 years', 0]];
    leavers.forEach((l) => {
      if (l.tenure == null) return;
      if (l.tenure < 6) b[0][1]++; else if (l.tenure < 12) b[1][1]++; else if (l.tenure < 24) b[2][1]++;
      else if (l.tenure < 60) b[3][1]++; else b[4][1]++;
    });
    return b;
  }, [leavers]);

  const reasons = useMemo(() => {
    const m = {};
    leavers.forEach((l) => { const r = (l.reason || 'Not recorded').trim() || 'Not recorded'; m[r] = (m[r] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [leavers]);

  const shown = unit ? leavers.filter((l) => (l.dept || 'Unassigned') === unit) : leavers;

  // line chart geometry
  const CW = 640, CH = 190, PAD = 26;
  const maxRate = Math.max(TARGET / 12 * 1.6, ...series.map((m) => m.rate), 0.5);
  const px = (k) => PAD + (k * (CW - PAD * 2)) / Math.max(1, series.length - 1);
  const py = (v) => CH - PAD - (v / maxRate) * (CH - PAD * 2);
  const line = series.map((m, k) => (k ? 'L' : 'M') + px(k) + ' ' + py(m.rate)).join(' ');
  const areaPath = line + ' L' + px(series.length - 1) + ' ' + (CH - PAD) + ' L' + px(0) + ' ' + (CH - PAD) + ' Z';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* hero */}
      <div className="card" style={{ padding: '16px 18px', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 230 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10, fontWeight: 700, letterSpacing: .6, textTransform: 'uppercase', color: '#1f9d57' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1f9d57' }} />Workforce · Nursing staff
          </div>
          <div style={{ fontSize: 21, fontWeight: 700, color: MK.INK, margin: '3px 0 2px' }}>Nurse Attrition</div>
          <div style={{ fontSize: 11.6, color: MK.MUTED }}>Separations across {byUnit.length} units · last {months} month{months > 1 ? 's' : ''}</div>
        </div>
        <div>
          <div className="num" style={{ fontSize: 38, fontWeight: 700, color: rateA > TARGET ? '#d23a52' : '#1f9d57', lineHeight: 1, letterSpacing: '-1px' }}>{rateA.toFixed(1)}%</div>
          <div style={{ fontSize: 10.8, color: MK.FAINT, marginTop: 3 }}>annualised · last {months} month{months > 1 ? 's' : ''}</div>
        </div>
        <span style={{
          fontSize: 11.4, fontWeight: 600, padding: '5px 12px', borderRadius: 14,
          color: rateA > TARGET ? '#d23a52' : '#1f9d57', background: (rateA > TARGET ? '#d23a52' : '#1f9d57') + '16',
        }}>
          {rateA > TARGET ? '↗ +' : '↘ '}{Math.abs(rateA - TARGET).toFixed(1)} pts vs target
        </span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => setRoute({ view: 'perfRisk' })}>Retention risk</button>
          <button className="btn" onClick={() => window.print()}>PDF</button>
          {perfCan('add') && <button className="btn pri" onClick={() => setAdding(true)}>+ Record an exit</button>}
        </div>
      </div>

      {/* period pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9.6, fontWeight: 700, letterSpacing: .6, textTransform: 'uppercase', color: MK.FAINT }}>Period</span>
        {ATTR_PERIODS.map((p) => (
          <button key={p.id} onClick={() => setPeriod(p.id)} style={{
            cursor: 'pointer', font: 'inherit', fontSize: 11.4, fontWeight: 600, padding: '5px 12px', borderRadius: 9,
            color: period === p.id ? '#0072a3' : MK.MUTED,
            background: period === p.id ? 'rgba(0,144,202,.12)' : 'rgba(255,255,255,.6)',
            border: '1px solid ' + (period === p.id ? 'rgba(0,144,202,.4)' : 'rgba(125,145,180,.24)'),
          }}>{p.label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.2, color: MK.FAINT }}>Average headcount in period <b className="num" style={{ color: MK.INK }}>{avgHead}</b></span>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
        <RuleStat label="Attrition rate" value={rateA.toFixed(1) + '%'} sub={'annualised · target ' + TARGET + '%'} color="#d23a52" tint="red" icon={I.pulse} />
        <RuleStat label="Monthly rate" value={monthlyRate.toFixed(2) + '%'} sub="leavers ÷ average headcount" color="#0090ca" tint="blue" icon={I.grid} />
        <RuleStat label="Exits" value={totalLeavers} sub={'last ' + months + ' month' + (months > 1 ? 's' : '')} color="#e08a1e" tint="amber" icon={I.user} />
        <RuleStat label="First-year attrition" value={firstYear.pct.toFixed(1) + '%'} sub={firstYear.lost + ' of ' + firstYear.joiners + ' joiners left within 12 months'} color="#6a52d4" tint="violet" icon={I.user} />
        <RuleStat label="Avg tenure at exit" value={avgTenure == null ? '—' : hrTenureLabel(avgTenure)} sub={medTenure == null ? 'no exits recorded' : 'median ' + hrTenureLabel(medTenure)} color="#2b8f83" tint="teal" icon={I.doc} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(300px,1fr)', gap: 14, alignItems: 'start' }}>
        <div className="card">
          <div className="card-h">
            <h3>Monthly attrition rate — last 12 months</h3>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 10.6, color: MK.MUTED }}><span style={{ color: '#2b8f83' }}>—</span> monthly rate</span>
            <span style={{ fontSize: 10.6, color: MK.MUTED }}><span style={{ color: '#d23a52' }}>--</span> Target {TARGET}% a year</span>
          </div>
          <div className="card-b">
            {totalLeavers === 0 && leavers.length === 0 ? (
              <Empty icon={I.user} title="No exits recorded"
                sub="Nobody has been archived from the roster, so there is nothing to rate. Removing a staff member from the roster is what registers an exit." />
            ) : (
              <>
                <svg viewBox={'0 0 ' + CW + ' ' + CH} style={{ width: '100%', height: 210 }}>
                  <defs>
                    <linearGradient id="attrFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(58,181,167,.34)" /><stop offset="100%" stopColor="rgba(58,181,167,.02)" />
                    </linearGradient>
                  </defs>
                  {[0, maxRate / 2, maxRate].map((v, k) => (
                    <line key={k} x1={PAD} x2={CW - PAD} y1={py(v)} y2={py(v)} stroke="rgba(125,145,180,.18)" />
                  ))}
                  <line x1={PAD} x2={CW - PAD} y1={py(TARGET / 12)} y2={py(TARGET / 12)} stroke="#d23a52" strokeWidth="1.4" strokeDasharray="5 4" />
                  <path d={areaPath} fill="url(#attrFill)" />
                  <path d={line} fill="none" stroke="#2b8f83" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  {series.map((m, k) => (
                    <circle key={k} cx={px(k)} cy={py(m.rate)} r="4.4" fill="#fff" stroke={m.leavers ? '#d23a52' : '#2b8f83'} strokeWidth="2" />
                  ))}
                </svg>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.4, color: MK.FAINT, padding: '0 20px' }}>
                  {series.map((m) => <span key={m.key} style={{ flex: 1, textAlign: 'center' }}>{m.label.split(' ')[0]}</span>)}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h3>How the rate is calculated</h3></div>
          <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div style={{ padding: '11px 13px', borderRadius: 11, background: 'rgba(0,144,202,.07)', border: '1px solid rgba(0,144,202,.16)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: .5, textTransform: 'uppercase', color: '#0072a3' }}>Method A · monthly</div>
              <div className="num" style={{ fontSize: 11.4, color: MK.BODY, margin: '4px 0 6px' }}>leavers ÷ average headcount × 100</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="num" style={{ fontSize: 21, fontWeight: 700, color: MK.INK }}>{rateA.toFixed(1)}%</span>
                <span style={{ fontSize: 10.8, color: MK.FAINT }}>{monthlyRate.toFixed(2)}% monthly × 12</span>
              </div>
            </div>
            <div style={{ padding: '11px 13px', borderRadius: 11, background: 'rgba(106,82,212,.07)', border: '1px solid rgba(106,82,212,.16)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: .5, textTransform: 'uppercase', color: '#6a52d4' }}>Method B · annualised</div>
              <div className="num" style={{ fontSize: 11.4, color: MK.BODY, margin: '4px 0 6px' }}>leavers ÷ opening headcount, annualised</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="num" style={{ fontSize: 21, fontWeight: 700, color: MK.INK }}>{rateB.toFixed(1)}%</span>
                <span style={{ fontSize: 10.8, color: MK.FAINT }}>{totalLeavers} of {openingHead} in {months} month{months > 1 ? 's' : ''}</span>
              </div>
            </div>
            <div style={{ fontSize: 10.6, color: MK.FAINT, lineHeight: 1.5 }}>
              Headcount for a past month is reconstructed as today's active roster plus everybody who left after that
              month — exact when the roster has been kept current, and the only basis available without a historical
              headcount snapshot.
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
        <div className="card">
          <div className="card-h"><h3>By unit</h3><div style={{ flex: 1 }} /><span className="sub">click to filter</span></div>
          <div className="card-b" style={{ maxHeight: 300, overflow: 'auto' }}>
            <table className="tbl">
              <thead><tr><th>Unit</th><th style={{ width: 54 }}>Roster</th><th style={{ width: 46 }}>Exits</th><th style={{ width: 74 }}>Rate</th></tr></thead>
              <tbody>
                {byUnit.map((u) => (
                  <tr key={u.dept} style={{ cursor: 'pointer', background: unit === u.dept ? 'rgba(0,144,202,.07)' : undefined }}
                    onClick={() => setUnit(unit === u.dept ? '' : u.dept)}>
                    <td style={{ fontWeight: 600, color: MK.INK }}>{u.dept}</td>
                    <td className="num">{u.roster}</td>
                    <td className="num">{u.exits}</td>
                    <td className="num" style={{ color: u.rate > 15 ? '#d23a52' : u.rate > 8 ? '#e08a1e' : MK.BODY }}>{u.rate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h3>Tenure at exit</h3><div style={{ flex: 1 }} /><span className="sub">how long they stayed</span></div>
          <div className="card-b">
            {leavers.length === 0 ? <div className="sub" style={{ textAlign: 'center', padding: 14 }}>No exits yet.</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tenureBuckets.map(([l, n]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{ width: 106, fontSize: 11.4, color: MK.BODY }}>{l}</div>
                    <div style={{ flex: 1 }}><Bar value={n} max={Math.max(1, ...tenureBuckets.map((x) => x[1]))} color="#6a52d4" /></div>
                    <div className="num" style={{ width: 24, textAlign: 'right', fontWeight: 700 }}>{n}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h3>Reason for leaving</h3><div style={{ flex: 1 }} /><span className="sub">as stated at exit</span></div>
          <div className="card-b">
            {reasons.length === 0 ? <div className="sub" style={{ textAlign: 'center', padding: 14 }}>No exits yet.</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {reasons.map(([r, n]) => (
                  <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{ width: 128, fontSize: 11.4, color: MK.BODY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r}>{r}</div>
                    <div style={{ flex: 1 }}><Bar value={n} max={reasons[0][1]} color={r === 'Not recorded' ? '#b9c6d6' : '#0090ca'} /></div>
                    <div className="num" style={{ width: 24, textAlign: 'right', fontWeight: 700 }}>{n}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h3>Exits register</h3>
          <div style={{ flex: 1 }} />
          <span className="sub">{shown.length} record(s){unit ? ' · ' + unit : ''}</span>
          {unit && <button className="btn" onClick={() => setUnit('')}>Clear filter</button>}
        </div>
        <div className="card-b" style={{ overflow: 'auto' }}>
          {shown.length === 0 ? <Empty icon={I.user} title="No exits match this view" /> : (
            <table className="tbl">
              <thead><tr><th>Staff member</th><th>Unit</th><th>Joined</th><th>Last day</th><th>Tenure</th><th>Separation</th><th>Reason</th><th></th></tr></thead>
              <tbody>
                {shown.map((l) => (
                  <tr key={l.empId}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={MK.av(l.name, 26)}>{MK.initials(l.name)}</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: MK.INK }}>{l.name}</div>
                          <div style={{ fontSize: 10.6, color: MK.FAINT }}>{l.empId} · {l.designation}</div>
                        </div>
                      </div>
                    </td>
                    <td>{l.dept}</td>
                    <td className="num" style={{ fontSize: 11.2 }}>{l.joined ? A.fmtDay(l.joined) : '—'}</td>
                    <td className="num" style={{ fontSize: 11.2 }}>{l.left ? A.fmtDay(l.left) : '—'}</td>
                    <td className="num">{hrTenureLabel(l.tenure)}</td>
                    <td className="sub">{l.separation || '—'}</td>
                    <td className="sub">{l.reason || <span style={{ opacity: .5 }}>not recorded</span>}</td>
                    <td style={{ textAlign: 'right' }}>
                      {!l.documented && perfCan('add')
                        ? <button className="btn" onClick={() => setAdding(l)}>Add exit record</button>
                        : <span style={MK.stChip('Actioned')}>documented</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {adding && <ExitModal roster={roster} perf={perf} staffStore={staffStore} prefill={adding === true ? null : adding} onClose={() => setAdding(false)} />}
    </div>
  );
}

function ExitModal({ roster, perf, staffStore, prefill, onClose }) {
  const leavers = (staffStore.staff || []).filter((e) => e.former || e.is_active === false);
  const [empId, setEmpId] = useState(prefill ? prefill.empId : '');
  const [noticeDate, setNoticeDate] = useState('');
  const [lastDay, setLastDay] = useState(prefill && prefill.left ? prefill.left.toISOString().slice(0, 10) : todayISO());
  const [separation, setSeparation] = useState('Resignation');
  const [reason, setReason] = useState(prefill ? prefill.reason : '');
  const [interview, setInterview] = useState('');
  const [clearance, setClearance] = useState([]);
  const [rehire, setRehire] = useState(true);
  const [busy, setBusy] = useState(false);

  // Anyone still on the roster can also be exited (the usual case: HR records the exit
  // first, the roster is archived after).
  const options = [...(staffStore.staff || [])].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const person = options.find((e) => (e.emp_id || String(e.id)) === empId);
  const row = roster.byEmp[empId];
  const joined = person ? hrParse(person.doj) : null;
  const tenure = hrMonthsBetween(joined, hrParse(lastDay));
  const toggle = (c) => setClearance((s) => (s.indexOf(c) >= 0 ? s.filter((x) => x !== c) : [...s, c]));

  const submit = () => {
    if (!person) return;
    setBusy(true);
    perf.addExit({
      empId, staffName: person.name, department: person.current_department, designation: person.designation,
      doj: person.doj, noticeDate, lastDay, separation, reason, interview, clearance, rehire,
      lastGrade: row && row.last ? row.last.grade : '',
    }).then((r) => { setBusy(false); if (r && r.ok) onClose(); });
  };

  return (
    <Modal wide title="Record an exit" sub="The separation record HR keeps — the roster only knows that somebody left"
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn pri" disabled={busy || !empId || !lastDay} onClick={submit}>{busy ? 'Saving…' : 'Save exit record'}</button>
      </>}>
      <div style={{ display: 'grid', gap: 10 }}>
        <label style={{ display: 'grid', gap: 4 }}><span className="sub">Staff member *</span>
          <select value={empId} onChange={(e) => setEmpId(e.target.value)}>
            <option value="">Select…</option>
            {options.map((e) => {
              const id = e.emp_id || String(e.id);
              return <option key={id} value={id}>{e.name} — {id}{e.former ? ' (archived)' : ''}</option>;
            })}
          </select></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <label style={{ display: 'grid', gap: 4 }}><span className="sub">Notice received</span>
            <input type="date" value={noticeDate} onChange={(e) => setNoticeDate(e.target.value)} /></label>
          <label style={{ display: 'grid', gap: 4 }}><span className="sub">Last working day *</span>
            <input type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} /></label>
          <label style={{ display: 'grid', gap: 4 }}><span className="sub">Separation type</span>
            <select value={separation} onChange={(e) => setSeparation(e.target.value)}>
              {['Resignation', 'End of contract', 'Retirement', 'Termination', 'Absconded', 'Transfer', 'Other'].map((t) => <option key={t}>{t}</option>)}
            </select></label>
        </div>
        <label style={{ display: 'grid', gap: 4 }}><span className="sub">Stated reason at exit</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Higher studies · Family relocation · Better offer · Health" /></label>
        <label style={{ display: 'grid', gap: 4 }}><span className="sub">Exit interview notes</span>
          <textarea rows="3" value={interview} onChange={(e) => setInterview(e.target.value)} /></label>
        <div>
          <div className="sub" style={{ marginBottom: 5 }}>Clearance checklist</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 6 }}>
            {CLEARANCE_ITEMS.map((c) => {
              const on = clearance.indexOf(c) >= 0;
              return (
                <button key={c} onClick={() => toggle(c)} style={{
                  textAlign: 'left', padding: '6px 9px', borderRadius: 7, cursor: 'pointer', font: 'inherit', color: 'inherit', fontSize: 11.6,
                  border: '1px solid ' + (on ? '#1f9d63' : 'var(--line,#dde3ec)'), background: on ? 'rgba(31,157,99,.10)' : 'transparent',
                }}>{on ? '✓ ' : '○ '}{c}</button>
              );
            })}
          </div>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.3 }}>
          <input type="checkbox" checked={rehire} onChange={(e) => setRehire(e.target.checked)} /> Eligible for re-hire
        </label>

        {person && (
          <div className="card" style={{ background: 'rgba(39,168,219,.06)' }}>
            <div className="card-b" style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12 }}>
              <div><div className="sub" style={{ fontSize: 11 }}>Service record</div><b>{hrTenureLabel(tenure)}</b></div>
              <div><div className="sub" style={{ fontSize: 11 }}>Joined</div><b>{joined ? A.fmtDay(joined) : '—'}</b></div>
              <div><div className="sub" style={{ fontSize: 11 }}>Last appraisal</div><b>{row && row.last ? row.last.grade + ' · ' + row.last.score : '—'}</b></div>
              <div style={{ flex: 1, minWidth: 200 }} className="sub">
                What this affects: the attrition rate, the unit's exit count and the tenure analysis. It does not remove
                the person from the roster — archive them in Staff Management for that.
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ================= RETENTION RISK ================= */
// Weights sum to 100 so the score reads as a percentage of concern, matching the
// mockup's scale. Every one is explained on screen: a manager has to be able to say
// WHY somebody is on this list, and defend it in the conversation.
const RISK_DRIVERS = [
  { id: 'incidents', label: 'Incident entries this cycle', points: 25, why: 'a record of errors or lapses in the current window', color: '#d23a52' },
  { id: 'lowgrade', label: 'Last grade D or E', points: 25, why: 'the previous appraisal fell below satisfactory', color: '#e08a1e' },
  { id: 'overdue', label: 'Appraisal overdue', points: 20, why: 'the six-month window has closed with no form filed', color: '#0090ca' },
  { id: 'newJoiner', label: 'Under 12 months tenure', points: 15, why: 'early tenure is where attrition concentrates', color: '#6a52d4' },
  { id: 'noRecognition', label: 'No recognition this cycle', points: 10, why: 'nothing recorded on the achievement register', color: '#3ab5a7' },
  { id: 'hotUnit', label: 'Unit above average attrition', points: 5, why: 'their unit has lost more people than most', color: '#8aa0b8' },
];
const RISK_BANDS = [
  { min: 70, label: 'High', color: '#d23a52' },
  { min: 50, label: 'Medium', color: '#e08a1e' },
  { min: 0, label: 'Low', color: '#1f9d57' },
];
const riskBand = (n) => RISK_BANDS.find((b) => n >= b.min) || RISK_BANDS[RISK_BANDS.length - 1];

function PerfRisk({ roster, perf, staffStore, setRoute }) {
  const now = new Date();
  const leaversByDept = useMemo(() => {
    const m = {};
    (staffStore.staff || []).filter((e) => e.former || e.is_active === false)
      .forEach((e) => { const d = e.current_department || 'Unassigned'; m[d] = (m[d] || 0) + 1; });
    return m;
  }, [staffStore.staff]);
  const avgLeavers = useMemo(() => {
    const v = Object.values(leaversByDept);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
  }, [leaversByDept]);

  const scored = useMemo(() => roster.rows.map((r) => {
    const drivers = [];
    if (r.incidents.length) drivers.push({ id: 'incidents', text: r.incidents.length + ' incident entr' + (r.incidents.length === 1 ? 'y' : 'ies') + ' this cycle' });
    if (r.last && (r.last.grade === 'D' || r.last.grade === 'E')) drivers.push({ id: 'lowgrade', text: 'Last grade ' + r.last.grade + ' — below satisfactory' });
    if (r.overdue) drivers.push({ id: 'overdue', text: 'Appraisal overdue since ' + A.fmtDay(r.firstDue) });
    const joined = hrParse(r.doj);
    const tenure = hrMonthsBetween(joined, now);
    if (joined && tenure != null && tenure < 12) drivers.push({ id: 'newJoiner', text: hrTenureLabel(tenure) + ' on roster' });
    if (!r.achievements.length) drivers.push({ id: 'noRecognition', text: 'No recognition recorded this cycle' });
    if ((leaversByDept[r.dept || 'Unassigned'] || 0) > avgLeavers && avgLeavers > 0) drivers.push({ id: 'hotUnit', text: r.dept + ' is above average attrition' });
    const score = drivers.reduce((t, d) => t + (RISK_DRIVERS.find((x) => x.id === d.id) || { points: 0 }).points, 0);
    return { ...r, drivers, score, tenure, band: riskBand(score) };
  }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score), [roster.rows, leaversByDept, avgLeavers]);

  const high = scored.filter((r) => r.score >= 70);
  const medium = scored.filter((r) => r.score >= 50 && r.score < 70);
  const watch = scored.filter((r) => r.score >= 50);
  const driverCounts = RISK_DRIVERS.map((d) => ({ ...d, n: scored.filter((r) => r.drivers.some((x) => x.id === d.id)).length }))
    .sort((a, b) => b.n - a.n);
  const maxDriver = Math.max(1, ...driverCounts.map((d) => d.n));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={MK.iconBadge('red', 34)}><Ic d={I.alert || I.pulse} s={17} /></div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontWeight: 600, fontSize: 15.5, color: MK.INK }}>Retention risk watchlist</div>
          <div style={{ fontSize: 11.5, color: MK.MUTED }}>Scored from incident history, appraisal movement, tenure and recognition — reviewed each cycle</div>
        </div>
        <button className="btn" onClick={() => setRoute({ view: 'perfAttrition' })}>Attrition</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
        <AccentStat label="High risk" value={high.length} sub="score 70 +" color="#d23a52" />
        <AccentStat label="Medium risk" value={medium.length} sub="score 50 – 69" color="#e08a1e" />
        <AccentStat label="Watchlist total" value={watch.length}
          sub={roster.rows.length ? ((watch.length / roster.rows.length) * 100).toFixed(1) + '% of nursing roster' : '—'} color="#0090ca" />
        <AccentStat label="Clear" value={roster.rows.length - scored.length} sub="no risk signal at all" color="#1f9d57" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(300px,1fr)', gap: 14, alignItems: 'start' }}>
        <div className="card">
          <div className="card-h"><h3>Staff to speak with this month</h3><div style={{ flex: 1 }} /><span className="sub">{watch.length} on the list</span></div>
          <div className="card-b" style={{ maxHeight: 620, overflow: 'auto', padding: 0 }}>
            {scored.length === 0 ? (
              <Empty icon={I.check || I.doc} title="Nobody is showing a risk signal"
                sub="No incidents, no low grades, no overdue appraisals. That is a good place to be." />
            ) : scored.slice(0, 40).map((r) => (
              <div key={r.empId} onClick={() => setRoute({ view: 'perfStaff', emp: r.empId })}
                style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(125,145,180,.12)', cursor: 'pointer' }}>
                <div style={MK.av(r.name, 34)}>{MK.initials(r.name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: MK.INK }}>{r.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 12, color: r.band.color, background: r.band.color + '18' }}>{r.band.label}</span>
                    <span style={MK.gchip(r.last ? r.last.grade : '')}>{r.last ? r.last.grade : '–'}</span>
                  </div>
                  <div style={{ fontSize: 11, color: MK.MUTED, marginTop: 1 }}>
                    {r.dept} · {r.designation}{r.tenure != null ? ' · ' + hrTenureLabel(r.tenure) + ' on roster' : ''}
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 5 }}>
                    {r.drivers.map((d) => {
                      const def = RISK_DRIVERS.find((x) => x.id === d.id) || {};
                      return (
                        <span key={d.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.8, color: MK.BODY }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: def.color }} />{d.text}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 84 }}>
                  <div className="num" style={{ fontSize: 21, fontWeight: 700, color: r.band.color, lineHeight: 1 }}>{r.score}</div>
                  <div style={{ fontSize: 9.4, color: MK.FAINT, margin: '2px 0 5px' }}>risk score</div>
                  <div style={MK.track(5)}><div style={MK.fill(r.score, r.band.color)} /></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="card-h"><h3>Most common risk drivers</h3></div>
            <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {driverCounts.map((d) => (
                <div key={d.id}>
                  <div style={{ fontSize: 11.6, color: MK.BODY, marginBottom: 4 }}>{d.label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{ flex: 1 }}><Bar value={d.n} max={maxDriver} color={d.color} height={6} /></div>
                    <span className="num" style={{ width: 22, textAlign: 'right', fontSize: 11.5, fontWeight: 700, color: d.color }}>{d.n}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h3>How the score is built</h3><div style={{ flex: 1 }} /><span className="sub">out of 100</span></div>
            <div className="card-b">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 10 }}>
                {RISK_DRIVERS.map((d) => (
                  <div key={d.id} style={{ display: 'flex', gap: 9, alignItems: 'baseline', fontSize: 11.4 }}>
                    <span className="num" style={{ minWidth: 30, textAlign: 'center', fontWeight: 700, padding: '2px 0', borderRadius: 12, color: d.color, background: d.color + '16' }}>+{d.points}</span>
                    <div><b style={{ color: MK.INK }}>{d.label}</b><div style={{ fontSize: 10.6, color: MK.FAINT }}>{d.why}</div></div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: MK.FAINT, lineHeight: 1.55, borderTop: '1px solid ' + MK.LINE, paddingTop: 9 }}>
                Incident history, appraisal movement between cycles, tenure band and recognition on file. Nothing here is
                a prediction — it is a shortlist for the nurse in-charge to have a conversation, and never a reason on its
                own for any action under Part H.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= RECOGNITION BOARD ================= */
const REWARD_TIERS = [
  { min: 5, label: 'Certificate of Excellence + full 5-point bonus', tone: '#1f9d57' },
  { min: 4, label: 'Certificate of Appreciation', tone: '#3ab5a7' },
  { min: 3, label: 'Written commendation on file', tone: '#0090ca' },
  { min: 2, label: 'Named on the recognition wall', tone: '#6a52d4' },
  { min: 1, label: 'Noted on the appraisal', tone: '#8aa0b8' },
];
// Category -> chip colour, so a "Training / certification" chip is the same blue on the
// wall as it is in the register.
const CAT_TONE = {
  'Award / recognition': '#e08a1e',
  'Training completed': '#0090ca',
  'Presentation / teaching': '#6a52d4',
  'Quality improvement adopted': '#3ab5a7',
  'Patient / family appreciation': '#1f9d57',
  'Extra duty / emergency cover': '#d23a52',
};
const catTone = (c) => CAT_TONE[c] || '#5b6b80';

function PerfBoard({ roster, perf, staffStore, setRoute }) {
  const org = A.orgCycle(new Date());
  const entries = perf.achievements || [];

  const leaders = useMemo(() => {
    const m = {};
    entries.forEach((r) => {
      const k = r.empId;
      (m[k] = m[k] || { empId: k, name: r.staffName, dept: r.department, desig: '', pts: 0, n: 0 });
      m[k].pts += Number(r.points) || 0; m[k].n++;
      const row = roster.byEmp[k];
      if (row) { m[k].desig = row.designation; m[k].dept = row.dept || m[k].dept; }
    });
    return Object.values(m).map((x) => ({ ...x, capped: Math.min(x.pts, A.BONUS_CAP) })).sort((a, b) => b.pts - a.pts);
  }, [entries, roster.byEmp]);
  const topPts = leaders.length ? leaders[0].pts : 1;

  const wall = entries.filter((e) => (Number(e.points) || 0) >= 2).sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const monthly = useMemo(() => {
    const now = new Date(); const out = [];
    for (let k = 0; k < 6; k++) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
      const key = hrMonthKey(d);
      const inMonth = entries.filter((e) => String(e.date || '').slice(0, 7) === key);
      if (!inMonth.length) { out.push({ key, label: HR_MONTHS[d.getMonth()] + ' ' + d.getFullYear(), winner: null }); continue; }
      const m = {};
      inMonth.forEach((e) => { (m[e.empId] = m[e.empId] || { empId: e.empId, name: e.staffName, dept: e.department, pts: 0 }).pts += Number(e.points) || 0; });
      out.push({ key, label: HR_MONTHS[d.getMonth()] + ' ' + d.getFullYear(), winner: Object.values(m).sort((a, b) => b.pts - a.pts)[0] });
    }
    return out;
  }, [entries]);

  const milestones = useMemo(() => {
    const now = new Date(); const out = [];
    (staffStore.staff || []).filter((e) => e.is_active !== false && !e.former).forEach((e) => {
      const j2 = hrParse(e.doj); if (!j2) return;
      [5, 10, 15, 20, 25].forEach((y) => {
        const at = new Date(j2.getFullYear() + y, j2.getMonth(), j2.getDate());
        const days = Math.round((at - now) / 86400000);
        if (days >= -30 && days <= 90) out.push({ name: e.name, dept: e.current_department, years: y, at, days });
      });
    });
    return out.sort((a, b) => a.days - b.days);
  }, [staffStore.staff]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={MK.iconBadge('amber', 34)}><Ic d={I.heart} s={17} /></div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontWeight: 600, fontSize: 15.5, color: MK.INK }}>Recognition board</div>
          <div style={{ fontSize: 11.5, color: MK.MUTED }}>{org.label} · points from every recorded achievement and award</div>
        </div>
        <button className="btn" onClick={() => setRoute({ view: 'perfAchievements' })}>Achievement register</button>
        <button className="btn" onClick={() => window.print()}>Print for notice board</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px,1fr) minmax(0,1.6fr)', gap: 14, alignItems: 'start' }}>
        {/* leaderboard */}
        <div className="card">
          <div className="card-h"><h3>Leaderboard</h3><div style={{ flex: 1 }} /><span className="sub">points this cycle</span></div>
          <div className="card-b" style={{ padding: 0 }}>
            {leaders.length === 0 ? (
              <Empty icon={I.heart} title="No entries yet"
                sub="Record an achievement and the leaderboard fills in."
                action={<button className="btn pri" onClick={() => setRoute({ view: 'perfAchievements' })}>Record an achievement</button>} />
            ) : leaders.slice(0, 12).map((l, k) => (
              <div key={l.empId} onClick={() => setRoute({ view: 'perfStaff', emp: l.empId })}
                style={{ padding: '11px 16px', borderBottom: '1px solid rgba(125,145,180,.12)', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="num" style={{ width: 22, fontSize: 11.5, fontWeight: 700, color: '#e08a1e' }}>#{k + 1}</span>
                  <div style={MK.av(l.name, 32)}>{MK.initials(l.name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.8, fontWeight: 700, color: MK.INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</div>
                    <div style={{ fontSize: 10.6, color: MK.FAINT }}>{[l.desig, l.dept].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="num" style={{ fontSize: 17, fontWeight: 700, color: MK.INK, lineHeight: 1 }}>{l.pts}</div>
                    <div style={{ fontSize: 9.6, color: MK.FAINT }}>{l.n} entr{l.n === 1 ? 'y' : 'ies'}</div>
                  </div>
                </div>
                <div style={{ marginTop: 7 }}>
                  <div style={MK.track(5)}><div style={MK.fill((l.pts / topPts) * 100, 'linear-gradient(90deg,#3ab5a7,#0090ca)')} /></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* wall */}
        <div className="card">
          <div className="card-h"><h3>Wall of recognition</h3><div style={{ flex: 1 }} /><span className="sub">2 points and above</span></div>
          <div className="card-b">
            {wall.length === 0 ? (
              <Empty icon={I.heart} title="Nothing on the wall yet"
                sub="Entries worth 2 points or more appear here — record an achievement to start the board." />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
                {wall.map((e) => {
                  const tone = catTone(e.category);
                  return (
                    <div key={e.id} onClick={() => setRoute({ view: 'perfStaff', emp: e.empId })}
                      style={{ padding: '13px 14px', borderRadius: 12, background: 'rgba(255,255,255,.62)', border: '1px solid rgba(125,145,180,.2)', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                        <div style={MK.av(e.staffName, 32)}>{MK.initials(e.staffName)}</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12.8, fontWeight: 700, color: MK.INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.staffName}</div>
                          <div style={{ fontSize: 10.4, color: MK.FAINT }}>{[(roster.byEmp[e.empId] || {}).designation, e.department].filter(Boolean).join(' · ')}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 12.2, color: MK.BODY, lineHeight: 1.45, minHeight: 34 }}>{e.what}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9 }}>
                        <span style={{ fontSize: 10.4, fontWeight: 600, padding: '2px 9px', borderRadius: 12, color: tone, background: tone + '18' }}>{e.category}</span>
                        <span className="num" style={{ fontSize: 10.4, color: MK.FAINT }}>{e.date}</span>
                        <div style={{ flex: 1 }} />
                        <span className="num" style={{ fontSize: 11, fontWeight: 700, color: '#1f9d57' }}>+{e.points}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
        <div className="card">
          <div className="card-h"><h3>Employee of the month</h3><div style={{ flex: 1 }} /><span className="sub">highest points each month</span></div>
          <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {monthly.map((m) => (
              <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                <span className="num" style={{ width: 76, fontSize: 10.8, color: MK.FAINT }}>{m.label}</span>
                {m.winner ? (
                  <>
                    <div style={MK.av(m.winner.name, 24)}>{MK.initials(m.winner.name)}</div>
                    <span style={{ flex: 1, fontWeight: 600, color: MK.INK }}>{m.winner.name}</span>
                    <span className="num" style={{ fontWeight: 700, padding: '2px 9px', borderRadius: 12, color: '#e08a1e', background: 'rgba(224,138,30,.16)' }}>+{m.winner.pts}</span>
                  </>
                ) : <span style={{ flex: 1, fontSize: 11.4, color: MK.FAINT }}>no entries</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h3>Long-service milestones</h3><div style={{ flex: 1 }} /><span className="sub">next 90 days</span></div>
          <div className="card-b">
            {milestones.length === 0 ? <div className="sub" style={{ textAlign: 'center', padding: 14 }}>None in the next 90 days.</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {milestones.slice(0, 10).map((m, k) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                    <span className="num" style={{ fontWeight: 700, padding: '2px 9px', borderRadius: 12, color: '#e08a1e', background: 'rgba(224,138,30,.16)' }}>{m.years} yr</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: MK.INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                      <div style={{ fontSize: 10.4, color: MK.FAINT }}>{m.dept}</div>
                    </div>
                    <span className="num" style={{ fontSize: 10.8, color: MK.FAINT }}>{m.days < 0 ? Math.abs(m.days) + 'd ago' : 'in ' + m.days + 'd'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h3>Points and rewards</h3><div style={{ flex: 1 }} /><span className="sub">what each total earns</span></div>
          <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {REWARD_TIERS.map((t) => (
              <div key={t.min} style={{ display: 'flex', gap: 9, alignItems: 'baseline', fontSize: 11.8 }}>
                <span className="num" style={{ minWidth: 30, textAlign: 'center', fontWeight: 700, padding: '2px 0', borderRadius: 12, color: t.tone, background: t.tone + '18' }}>{t.min}+</span>
                <span style={{ color: MK.BODY }}>{t.label}</span>
              </div>
            ))}
            <div style={{ fontSize: 10.6, color: MK.FAINT, borderTop: '1px solid ' + MK.LINE, paddingTop: 8, lineHeight: 1.5 }}>
              Bonus points are capped at {A.BONUS_CAP} per staff member per appraisal cycle, and are added after the 20
              parameters have been scored.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.PerfAttrition = PerfAttrition;
window.PerfRisk = PerfRisk;
window.PerfBoard = PerfBoard;
