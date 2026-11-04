/* MY DEPARTMENT — one department's figures, its approved duty roster and a basic staff
 * list, read-only, for the departments an administrator picked for this person
 * (Access Control → My Department). Nothing here comes from the page snapshot: every
 * figure is fetched from /api/my-department, which checks the grant and the department
 * again. Printing is its own grant (My Department → Print), and the server records each
 * printout before the print window opens. Performance / appraisal data is never shown.
 */
(function () {
  const { useState, useEffect, useMemo } = React;
  const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const SECTIONS = [['patient', 'Patient statistics'], ['quality', 'Quality indicators'], ['roster', 'Duty roster'], ['staff', 'Staff list']];
  const filled = (v) => v !== null && v !== '' && v !== undefined;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const ml = (m) => { const p = String(m).split('-'); return p[0] + ' ' + (p[1] ? '20' + p[1] : ''); };

  async function api(url, opts) {
    const r = await fetch(url, Object.assign({ credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json', 'content-type': 'application/json' } }, opts || {}));
    if (r.status === 401 || r.redirected) throw new Error('Your session has expired. Sign in again.');
    const j = await r.json().catch(() => null);
    if (!j) throw new Error('The server did not answer. Please try again.');
    if (!j.ok) throw new Error(j.error || 'Something went wrong.');
    return j;
  }

  // ---- quality: one month's reading, formatted the way the indicator is measured ----
  const isPct = (ind) => /pct|percent/i.test(String(ind.formula || '')) || /%/.test(String(ind.unit || ''));
  const mult = (ind) => { const f = String(ind.formula || ''); return /1000/.test(f) ? 1000 : /100/.test(f) || isPct(ind) ? 100 : null; };
  function qValue(ind, m) {
    if (filled((ind.months || {})[m])) return Number(ind.months[m]);
    const n = (ind.num || {})[m], d = (ind.den || {})[m], k = mult(ind);
    if (filled(n) && filled(d) && Number(d) > 0 && k) return Math.round((Number(n) / Number(d)) * k * 100) / 100;
    return filled(n) ? Number(n) : null;
  }
  const qFmt = (ind, v) => (v == null ? '—' : (Math.round(v * 100) / 100) + (isPct(ind) ? '%' : ''));
  function qStatus(ind, v) {
    if (v == null || ind.benchmarkValue == null) return null;
    return ind.goalDirection === 'higher_is_better' ? (v >= ind.benchmarkValue ? 'ok' : 'bad') : (v <= ind.benchmarkValue ? 'ok' : 'bad');
  }
  const qCell = (ind, m) => ((ind.notObserved || {})[m] ? 'N/O' : qFmt(ind, qValue(ind, m)));

  // ---- patient statistics: months that hold anything, a total (or average for % columns) ----
  function patientTable(p) {
    const months = p.months.filter((m) => p.rows[m] && Object.keys(p.rows[m]).some((k) => filled(p.rows[m][k])));
    const foot = p.cols.map((c) => {
      const vals = months.map((m) => Number((p.rows[m] || {})[c.id])).filter((v) => Number.isFinite(v));
      if (!vals.length) return '';
      const sum = vals.reduce((a, b) => a + b, 0);
      return c.pct ? (Math.round((sum / vals.length) * 10) / 10) + '%' : Math.round(sum * 100) / 100;
    });
    return { months, foot };
  }
  const pCell = (c, v) => (filled(v) ? v + (c.pct ? '%' : '') : '—');

  function rosterDays(r) { return new Date(r.year, r.month + 1, 0).getDate(); }
  function rosterPeople(r) {
    const ids = (r.order && r.order.length ? r.order : Object.keys(r.grid || {}));
    return ids.filter((id) => r.grid && r.grid[id]).map((id) => ({ id, name: (r.names || {})[id] || id, row: r.grid[id] || {} }));
  }
  const shiftColor = (code) => { const R = window.UNICO_ROSTER; const b = R && R.bucketOf(code); return (R && b && R.BUCKET_COLOR[b]) || '#64748b'; };

  /* ---------------- the print page ---------------- */
  function printHtml(data, sections) {
    const me = (window.__UNICO_USER__ && (window.__UNICO_USER__.name || window.__UNICO_USER__.username)) || '';
    const sig = window.unicoSig ? window.unicoSig.load() : {};
    let body = '';
    if (sections.indexOf('patient') >= 0 && data.patient) {
      const p = data.patient; const t = patientTable(p);
      body += '<h2>Patient statistics — ' + esc(data.year) + '</h2>' + (t.months.length
        ? '<table><thead><tr><th>Month</th>' + p.cols.map((c) => '<th class="r">' + esc(c.label) + '</th>').join('') + '</tr></thead><tbody>'
          + t.months.map((m) => '<tr><td>' + esc(ml(m)) + '</td>' + p.cols.map((c) => '<td class="r">' + esc(pCell(c, p.rows[m][c.id])) + '</td>').join('') + '</tr>').join('')
          + '<tr class="t"><td>Total / average</td>' + t.foot.map((v) => '<td class="r">' + esc(v) + '</td>').join('') + '</tr></tbody></table>'
        : '<p class="m">No figures recorded for ' + esc(data.year) + '.</p>');
    }
    if (sections.indexOf('quality') >= 0 && data.quality) {
      const q = data.quality; const months = (data.patient && data.patient.months) || MONS.map((m) => m + '-' + String(data.year % 100).padStart(2, '0'));
      const used = months.filter((m) => q.indicators.some((i) => qValue(i, m) != null || (i.notObserved || {})[m]));
      body += '<h2>Quality indicators — ' + esc(q.name) + ' · ' + esc(data.year) + '</h2>' + (used.length
        ? '<table><thead><tr><th>Indicator</th><th>Target</th>' + used.map((m) => '<th class="r">' + esc(MONS[MONS.indexOf(m.split('-')[0])]) + '</th>').join('') + '</tr></thead><tbody>'
          + q.indicators.map((i) => '<tr><td>' + esc(i.name) + '</td><td>' + esc(i.benchmark || (i.benchmarkValue != null ? i.benchmarkValue : '')) + '</td>' + used.map((m) => { const s = qStatus(i, qValue(i, m)); return '<td class="r ' + (s || '') + '">' + esc(qCell(i, m)) + '</td>'; }).join('') + '</tr>').join('')
          + '</tbody></table><p class="m">N/O = not observed that month. Red = outside the target.</p>'
        : '<p class="m">No quality readings recorded for ' + esc(data.year) + '.</p>');
    }
    if (sections.indexOf('roster') >= 0) {
      const r = data.roster;
      if (!r) body += '<h2 class="pb">Duty roster — ' + esc(MONS[data.month]) + ' ' + esc(data.year) + '</h2><p class="m">No approved roster for this month.</p>';
      else {
        const days = rosterDays(r); const ppl = rosterPeople(r); const d = Array.from({ length: days }, (_, i) => i + 1);
        body += '<h2 class="pb">Duty roster — ' + esc(MONS[r.month]) + ' ' + esc(r.year) + '</h2><table class="ros"><thead><tr><th>Name</th>' + d.map((x) => '<th>' + x + '</th>').join('') + '</tr></thead><tbody>'
          + ppl.map((p) => '<tr><td>' + esc(p.name) + '</td>' + d.map((x) => '<td>' + esc(p.row[x] || '') + '</td>').join('') + '</tr>').join('')
          + '</tbody></table><p class="m">Prepared by ' + esc(r.preparedBy || '—') + ' · Checked by ' + esc(r.checkedBy || '—') + ' · Approved by ' + esc(r.approvedBy || '—') + '</p>';
      }
    }
    if (sections.indexOf('staff') >= 0) {
      const s = data.staff || [];
      body += '<h2 class="pb">Staff list (' + s.length + ')</h2>' + (s.length
        ? '<table><thead><tr><th>#</th><th>Name</th><th>Designation</th><th>Employee no.</th><th>Joined</th></tr></thead><tbody>'
          + s.map((x, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(x.name) + '</td><td>' + esc(x.designation || x.role || '') + '</td><td>' + esc(x.emp_id || '') + '</td><td>' + esc(x.doj || '') + '</td></tr>').join('') + '</tbody></table>'
        : '<p class="m">No current staff recorded for this department.</p>');
    }
    const sigRow = ['prepared', 'reviewed', 'recommended', 'approved'].map((k) => '<td><div class="sl"></div>' + esc(sig[k] || '') + '<br><span class="m">' + k.charAt(0).toUpperCase() + k.slice(1) + ' by</span></td>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(data.dept.name) + ' — My Department</title><style>'
      + 'body{font:12px/1.4 Arial,sans-serif;color:#16202e;margin:18px}h1{font-size:18px;margin:0 0 2px}h2{font-size:14px;margin:18px 0 6px}.m{color:#5b6878}'
      + 'table{border-collapse:collapse;width:100%;font-size:10.5px}th,td{border:1px solid #cdd6e0;padding:4px 6px;text-align:left;vertical-align:top}th{background:#eef4fa}.r{text-align:right}'
      + '.t td{background:#e3f1f8;font-weight:700}.bad{color:#b4233c;font-weight:700}.ok{color:#14713f}.ros th,.ros td{padding:2px 3px;text-align:center;font-size:9px}.ros td:first-child{text-align:left;white-space:nowrap}'
      + '.sig{margin-top:28px;border:0}.sig td{border:0;width:25%;padding:0 10px;text-align:center}.sl{border-top:1px solid #16202e;margin:26px 0 4px}'
      + '@media print{@page{size:A4 landscape;margin:12mm}.pb{page-break-before:always}}</style></head><body>'
      + '<h1>UNICO Hospitals — ' + esc(data.dept.name) + '</h1><div class="m">My Department · ' + esc(data.year) + ' · printed by ' + esc(me) + ' on ' + esc(new Date().toLocaleString()) + '</div>'
      + body + '<table class="sig"><tr>' + sigRow + '</tr></table>'
      + '<script>window.onload=function(){window.print();}<\/script></body></html>';
  }

  function PrintDialog({ data, onClose }) {
    const avail = SECTIONS.filter(([k]) => k !== 'patient' || data.patient).filter(([k]) => k !== 'quality' || data.quality);
    const [pick, setPick] = useState(() => avail.map(([k]) => k));
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const toggle = (k) => setPick((p) => (p.indexOf(k) >= 0 ? p.filter((x) => x !== k) : p.concat([k])));
    const go = async () => {
      if (!pick.length || busy) return;
      setBusy(true); setErr('');
      // Open the window inside the click (pop-up blockers), fill it only once the server has recorded the print.
      const w = window.open('', '_blank');
      try {
        await api('/api/my-department/print', { method: 'POST', body: JSON.stringify({ dept: data.dept.id, year: data.year, month: data.month, sections: pick }) });
        if (!w) { setErr('Allow pop-ups for this site to print.'); setBusy(false); return; }
        w.document.open(); w.document.write(printHtml(data, pick)); w.document.close();
        onClose();
      } catch (e) { if (w) w.close(); setErr(e.message); setBusy(false); }
    };
    return (
      <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 400, display: 'grid', placeItems: 'center', padding: 16 }}>
        <div className="card" style={{ width: 'min(420px,100%)', padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Print {data.dept.name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12 }}>Choose what goes on paper. Every printout is recorded in the activity log.</div>
          {avail.map(([k, label]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={pick.indexOf(k) >= 0} onChange={() => toggle(k)} />{label}
              {k === 'roster' && <span style={{ fontSize: 11, color: 'var(--muted)' }}>· {MONS[data.month]} {data.year}</span>}
            </label>
          ))}
          {err && <div style={{ color: 'var(--rose)', fontSize: 12, marginTop: 8 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14, flexWrap: 'wrap' }}>
            <button className="btn sm" onClick={() => setPick(avail.map(([k]) => k))}>Select everything</button>
            <button className="btn sm" onClick={onClose}>Cancel</button>
            <button className="btn pri sm" disabled={!pick.length || busy} onClick={go}>{busy ? 'Preparing…' : 'Print'}</button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- the screen ---------------- */
  const th = { textAlign: 'left', padding: '8px 10px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.3px', color: 'var(--muted)', fontWeight: 700, borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap', background: 'var(--blue-50)' };
  const thr = Object.assign({}, th, { textAlign: 'right' });
  const td = { padding: '7px 10px', fontSize: 12.5, color: 'var(--ink-2)', borderBottom: '1px solid var(--line-2)', whiteSpace: 'nowrap' };
  const tdr = Object.assign({}, td, { textAlign: 'right', fontVariantNumeric: 'tabular-nums' });
  const scroll = { overflowX: 'auto', WebkitOverflowScrolling: 'touch' };
  const Empty = ({ children }) => <div style={{ padding: '22px 8px', textAlign: 'center', color: 'var(--muted)', fontSize: 12.5 }}>{children}</div>;

  function PatientTab({ p, year }) {
    if (!p) return <Empty>This department reports quality indicators only.</Empty>;
    const t = patientTable(p);
    if (!t.months.length) return <Empty>No patient statistics recorded for {year}.</Empty>;
    return (
      <div style={scroll}><table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead><tr><th style={th}>Month</th>{p.cols.map((c) => <th key={c.id} style={thr}>{c.label}</th>)}</tr></thead>
        <tbody>
          {t.months.map((m) => <tr key={m}><td style={td}>{ml(m)}</td>{p.cols.map((c) => <td key={c.id} style={tdr}>{pCell(c, p.rows[m][c.id])}</td>)}</tr>)}
          <tr><td style={Object.assign({}, td, { fontWeight: 800 })}>Total / average</td>{t.foot.map((v, i) => <td key={i} style={Object.assign({}, tdr, { fontWeight: 800, background: 'var(--blue-50)' })}>{v}</td>)}</tr>
        </tbody>
      </table></div>
    );
  }

  function QualityTab({ q, months, year }) {
    if (!q || !q.indicators.length) return <Empty>No quality indicators for this department.</Empty>;
    const used = months.filter((m) => q.indicators.some((i) => qValue(i, m) != null || (i.notObserved || {})[m]));
    if (!used.length) return <Empty>No quality readings recorded for {year}.</Empty>;
    const tone = (s) => (s === 'ok' ? { color: '#14713f', fontWeight: 700 } : s === 'bad' ? { color: '#b4233c', fontWeight: 700 } : {});
    return (
      <div style={scroll}><table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead><tr><th style={th}>Indicator</th><th style={th}>Target</th>{used.map((m) => <th key={m} style={thr}>{m.split('-')[0]}</th>)}</tr></thead>
        <tbody>{q.indicators.map((i) => (
          <tr key={i.id}><td style={Object.assign({}, td, { whiteSpace: 'normal', minWidth: 200, fontWeight: 600 })}>{i.name}</td>
            <td style={Object.assign({}, td, { color: 'var(--muted)' })}>{i.benchmark || (i.benchmarkValue != null ? i.benchmarkValue : '—')}</td>
            {used.map((m) => <td key={m} style={Object.assign({}, tdr, tone(qStatus(i, qValue(i, m))))}>{qCell(i, m)}</td>)}</tr>
        ))}</tbody>
      </table>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>Green = within target · red = outside target · N/O = not observed that month.</div></div>
    );
  }

  function RosterTab({ r, month, year }) {
    if (!r) return <Empty>No approved duty roster for {MONS[month]} {year}. Drafts and rosters awaiting sign-off are not shown.</Empty>;
    const days = rosterDays(r); const ppl = rosterPeople(r); const d = Array.from({ length: days }, (_, i) => i + 1);
    const cell = { padding: '4px 3px', fontSize: 10.5, textAlign: 'center', borderBottom: '1px solid var(--line-2)', minWidth: 26 };
    return (
      <div>
        <div style={scroll}><table style={{ borderCollapse: 'collapse' }}>
          <thead><tr><th style={Object.assign({}, th, { position: 'sticky', left: 0 })}>Name</th>{d.map((x) => <th key={x} style={Object.assign({}, th, { textAlign: 'center', padding: '6px 3px' })}>{x}</th>)}</tr></thead>
          <tbody>{ppl.map((p) => (
            <tr key={p.id}><td style={Object.assign({}, td, { position: 'sticky', left: 0, background: 'var(--card, #fff)', fontWeight: 600 })}>{p.name}</td>
              {d.map((x) => { const c = p.row[x]; return <td key={x} style={cell}>{c ? <span style={{ color: shiftColor(c), fontWeight: 700 }}>{c}</span> : ''}</td>; })}</tr>
          ))}</tbody>
        </table></div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>Prepared by {r.preparedBy || '—'} · Checked by {r.checkedBy || '—'} · Approved by {r.approvedBy || '—'}</div>
      </div>
    );
  }

  function StaffTab({ s }) {
    if (!s || !s.length) return <Empty>No current staff recorded for this department.</Empty>;
    return (
      <div style={scroll}><table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead><tr><th style={th}>#</th><th style={th}>Name</th><th style={th}>Designation</th><th style={th}>Employee no.</th><th style={th}>Joined</th></tr></thead>
        <tbody>{s.map((x, i) => <tr key={x.id || i}><td style={td}>{i + 1}</td><td style={Object.assign({}, td, { fontWeight: 600 })}>{x.name}</td><td style={td}>{x.designation || x.role || '—'}</td><td style={td}>{x.emp_id || '—'}</td><td style={td}>{x.doj || '—'}</td></tr>)}</tbody>
      </table></div>
    );
  }

  function MyDepartment() {
    const now = new Date();
    const [list, setList] = useState(null);
    const [listErr, setListErr] = useState('');
    const [dept, setDept] = useState('');
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth());
    const [tab, setTab] = useState('patient');
    const [data, setData] = useState(null);
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const [printing, setPrinting] = useState(false);

    useEffect(() => {
      api('/api/my-department').then((j) => { setList(j.departments || []); if ((j.departments || [])[0]) setDept(j.departments[0].id); })
        .catch((e) => { setListErr(e.message); setList([]); });
    }, []);
    useEffect(() => {
      if (!dept) return;
      let dead = false; setBusy(true);
      api('/api/my-department/' + encodeURIComponent(dept) + '?year=' + year + '&month=' + month)
        .then((j) => { if (!dead) { setData(j); setErr(''); if (!j.patient && tab === 'patient') setTab('quality'); } })
        .catch((e) => { if (!dead) { setErr(e.message); setData(null); } })
        .then(() => { if (!dead) setBusy(false); });
      return () => { dead = true; };
    }, [dept, year, month]);

    const years = useMemo(() => { const y = now.getFullYear(); return [y, y - 1, y - 2, y - 3]; }, []);
    const months = (data && data.patient && data.patient.months) || MONS.map((m) => m + '-' + String(year % 100).padStart(2, '0'));
    const sel = { padding: '7px 10px', borderRadius: 8, border: '1px solid var(--line)', background: '#fff', fontFamily: 'inherit', fontSize: 12.5, color: 'var(--ink-2)' };
    const tabs = [['patient', 'Patient statistics'], ['quality', 'Quality indicators'], ['roster', 'Duty roster'], ['staff', 'Staff']];

    if (list === null) return <div className="card" style={{ color: 'var(--muted)' }}>Loading…</div>;
    if (listErr) return <div className="card" style={{ color: 'var(--rose)' }}>{listErr}</div>;
    if (!list.length) return <div className="card" style={{ color: 'var(--muted)' }}>No department has been set for you yet. Ask the administrator to choose your department in Access Control → My Department.</div>;

    return (
      <div className="grid" style={{ gap: 14 }}>
        <SectionTitle icon={I.layers} title={'My Department' + (data ? ' — ' + data.dept.name : '')} sub="Your department's figures, approved duty roster and staff list. Read-only."
          right={data && data.canPrint ? <button className="btn pri sm" onClick={() => setPrinting(true)}><Ic d={I.doc} s={13} />Print</button> : null} />
        <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {list.length > 1 && <select style={sel} value={dept} onChange={(e) => setDept(e.target.value)}>{list.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>}
          <select style={sel} value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
          {tab === 'roster' && <select style={sel} value={month} onChange={(e) => setMonth(Number(e.target.value))}>{MONS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select>}
          <span style={{ flex: 1 }} />
          {busy && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Loading…</span>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tabs.map(([k, label]) => (
            <button key={k} className={'btn sm' + (tab === k ? ' pri' : '')} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>
        <div className="card" style={{ padding: '14px 16px' }}>
          {err ? <div style={{ color: 'var(--rose)', fontSize: 12.5 }}>{err}</div>
            : !data ? <Empty>Loading…</Empty>
              : tab === 'patient' ? <PatientTab p={data.patient} year={data.year} />
                : tab === 'quality' ? <QualityTab q={data.quality} months={months} year={data.year} />
                  : tab === 'roster' ? <RosterTab r={data.roster} month={data.month} year={data.year} />
                    : <StaffTab s={data.staff} />}
        </div>
        {printing && data && <PrintDialog data={data} onClose={() => setPrinting(false)} />}
      </div>
    );
  }

  window.MyDepartment = MyDepartment;
})();
