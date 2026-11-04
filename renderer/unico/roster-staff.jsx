/* UNICO — Staff roster (renderer).
 *
 * One person's duty, month after month: which unit rostered them, every day's shift
 * code, and the totals a manager actually asks about (nights, leave, rest days, hours).
 * The unit sheets are filed per unit-month; this reads them the other way round.
 *
 *   GET /api/rosters/staff/:staffId?from=YYYY-MM&to=YYYY-MM
 *       → months [{ id, dept, deptName, year, month, status, cells:{ day: code } }]
 *   Read scope is the server's: a portal account only gets approved sheets, a unit-
 *   scoped account only its units.
 *
 * Printing opens the house letterhead (same pattern as Device Days) after the server
 * has logged the print (POST /api/rosters/print).
 *
 * Published as window.RosterStaffView.
 */

const { useState, useEffect, useMemo } = React;
const Ic = window.Ic, I = window.I;
const R = window.UNICO_ROSTER;
const MK = window.MK;

const rsMonthKey = (y, m) => y + '-' + String(m + 1).padStart(2, '0');
const rsMonthsBack = (n) => {
  const d = new Date(); const out = [];
  for (let i = 0; i < n; i++) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push([x.getFullYear(), x.getMonth()]); }
  return out;
};
const rsEsc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function rsTotals(cells, y, m) {
  const days = R.daysIn(y, m);
  const t = R.totalsFor(cells || {}, days);
  let off = 0;
  for (let d = 1; d <= days; d++) { const c = cells && cells[d]; if (c && R.isOff(c)) off++; }
  return { ...t, off, duty: t.G + t.M + t.E + t.N };
}

function RosterStaffView({ staffId: sid0, setRoute }) {
  const K = window.UNICO_ROSTER_KIT;
  const store = K.useRosterStaff();
  const staff = useMemo(() => (store.staff || []).filter((e) => e && e.id != null && !e.former), [store.staff]);
  const [sel, setSel] = useState(sid0 ? String(sid0) : '');
  const [q, setQ] = useState('');
  const [pickOpen, setPickOpen] = useState(false);
  const range = rsMonthsBack(24);
  const [from, setFrom] = useState(rsMonthKey(...range[5]));
  const [to, setTo] = useState(rsMonthKey(...range[0]));
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  const person = staff.find((e) => String(e.id) === sel) || null;
  const matches = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return staff.slice(0, 12);
    return staff.filter((e) => [e.name, e.emp_id, e.current_department, e.designation].join(' ').toLowerCase().indexOf(n) >= 0).slice(0, 12);
  }, [staff, q]);

  useEffect(() => {
    if (!sel) { setData(null); return; }
    setData(null); setErr('');
    const [a, b] = from <= to ? [from, to] : [to, from];
    K.api.get('/api/rosters/staff/' + encodeURIComponent(sel) + '?from=' + a + '&to=' + b).then((r) => {
      if (r && r.ok) setData(r.months || r.rosters || r.rows || []);
      else { setErr((r && r.error) || 'Could not load this person’s roster.'); setData([]); }
    }).catch(() => { setErr('Could not reach the server.'); setData([]); });
  }, [sel, from, to]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Every month in the range, newest first, with or without a sheet.
  const months = useMemo(() => {
    const [a, b] = from <= to ? [from, to] : [to, from];
    const out = [];
    const [ay, am] = a.split('-').map(Number), [by, bm] = b.split('-').map(Number);
    for (let y = by, m = bm - 1; y > ay || (y === ay && m >= am - 1); m--) {
      if (m < 0) { m = 11; y--; if (y < ay) break; }
      const sheets = (data || []).filter((x) => x.year === y && x.month === m);
      out.push({ y, m, sheets });
    }
    return out;
  }, [data, from, to]);

  const sum = useMemo(() => {
    const s = { duty: 0, N: 0, leave: 0, off: 0, hours: 0, months: 0 };
    months.forEach((mo) => mo.sheets.forEach((x) => {
      const t = rsTotals(x.cells, mo.y, mo.m);
      s.duty += t.duty; s.N += t.N; s.leave += t.leave; s.off += t.off; s.hours += t.hours; s.months++;
    }));
    return s;
  }, [months]);

  const print = async () => {
    if (!person) return;
    const w = window.open('', '_blank');   // inside the click (pop-up blockers)
    try {
      await K.api.post('/api/rosters/print', { kind: 'staff', target: person.name, detail: from + ' – ' + to });
      if (!w) { K.toast('Allow pop-ups for this site to print.', 'error'); return; }
      const css = '@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}'
        + 'body{font:9pt/1.35 "Segoe UI",Arial,sans-serif;color:#16202e;margin:0;padding:16px}@media print{body{padding:0}}'
        + '.lh{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;padding-bottom:8px;border-bottom:1px solid #d9e2ec}.lh img{height:40px}.lh .tt{text-align:right}'
        + '.lh .kind{font-size:7.5pt;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#0072a3}.lh h1{margin:3px 0 0;font-size:15pt;color:#0d1b2e}.bar{height:3px;background:linear-gradient(90deg,#0072a3,#27a8db 55%,#3ab5a7)}'
        + '.hd{display:flex;gap:26px;margin:10px 0 8px;font-size:10pt}.hd b{font-weight:700}'
        + 'table{border-collapse:collapse;width:100%;font-size:7.4pt}th{background:#0d3a5c;color:#fff;font-weight:700;padding:4px 2px;border:1px solid #0d3a5c}'
        + 'td{padding:3px 2px;border:1px solid #c9d3de;text-align:center}td.l{text-align:left;white-space:nowrap}tfoot td{font-weight:700;background:#e6f1f8}'
        + '.end{margin-top:14px;padding-top:6px;border-top:1px solid #e3e9f0;display:flex;justify-content:space-between;font-size:7.5pt;color:#7b8796}.cr{margin-top:5px;text-align:center;font-size:6.5px;color:#a3adba}';
      const dayHead = Array.from({ length: 31 }, (_, i) => '<th>' + (i + 1) + '</th>').join('');
      const body = months.map((mo) => {
        if (!mo.sheets.length) return '<tr><td class="l">' + rsEsc(R.MONTHS[mo.m].slice(0, 3) + ' ' + mo.y) + '</td><td class="l">—</td>' + '<td colspan="31" style="color:#9aa6b4">no sheet</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>';
        return mo.sheets.map((x) => {
          const t = rsTotals(x.cells, mo.y, mo.m);
          const days = R.daysIn(mo.y, mo.m);
          const cells = Array.from({ length: 31 }, (_, i) => '<td' + (i >= days ? ' style="background:#f1f4f8"' : '') + '>' + rsEsc((x.cells || {})[i + 1] || '') + '</td>').join('');
          return '<tr><td class="l">' + rsEsc(R.MONTHS[mo.m].slice(0, 3) + ' ' + mo.y) + '</td><td class="l">' + rsEsc(x.deptName || x.dept) + '</td>' + cells
            + '<td>' + t.duty + '</td><td>' + t.N + '</td><td>' + t.off + '</td><td>' + t.leave + '</td><td>' + t.hours + '</td><td>' + rsEsc(K.ROS_STATUS[K.statusNorm(x.status)].label) + '</td></tr>';
        }).join('');
      }).join('');
      const at = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
      const me = (window.__UNICO_USER__ && (window.__UNICO_USER__.name || window.__UNICO_USER__.username)) || '—';
      const html = '<header class="lh"><img src="' + rsEsc(location.origin + '/unico/logo.svg') + '" alt="UNICO Hospitals"><div class="tt"><div class="kind">Nursing Services · Duty Roster</div><h1>Individual Duty Record</h1></div></header><div class="bar"></div>'
        + '<div class="hd"><span>Name: <b>' + rsEsc(person.name) + '</b></span><span>Emp no: <b>' + rsEsc(person.emp_id || '—') + '</b></span><span>Designation: <b>' + rsEsc(person.designation || '—') + '</b></span><span>Period: <b>' + rsEsc(from + ' to ' + to) + '</b></span></div>'
        + '<table><thead><tr><th>Month</th><th>Unit</th>' + dayHead + '<th>Duty</th><th>Nights</th><th>Off</th><th>Leave</th><th>Hours</th><th>Status</th></tr></thead><tbody>' + body + '</tbody>'
        + '<tfoot><tr><td class="l" colspan="33">Total · ' + sum.months + ' rostered month' + (sum.months === 1 ? '' : 's') + '</td><td>' + sum.duty + '</td><td>' + sum.N + '</td><td>' + sum.off + '</td><td>' + sum.leave + '</td><td>' + sum.hours + '</td><td></td></tr></tfoot></table>'
        + '<div class="end"><span>Printed by ' + rsEsc(me) + ' on ' + rsEsc(at) + ' from UNICO.</span><span>Approved sheets are final; others may still change.</span></div>'
        + '<div class="cr">Automatically generated by the system · Developed by Nasif Ahammed Niloy</div>';
      w.document.open();
      w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + rsEsc(person.name + ' — duty record') + '</title><style>' + css + '</style></head><body>' + html + '<script>window.onload=function(){setTimeout(function(){window.print();},150);};<\/script></body></html>');
      w.document.close();
    } catch (e) { if (w) w.close(); K.toast('Could not print.', 'error'); }
  };

  const cell = { fontFamily: K.MONO, fontSize: 8.8, fontWeight: 700, textAlign: 'center', padding: '4px 0', borderBottom: '1px solid rgba(125,145,180,.12)', minWidth: 21 };
  const th = { position: 'sticky', top: 0, background: '#f2f6fb', fontSize: 9, fontWeight: 700, color: '#6c7a8c', padding: '6px 1px', borderBottom: '1px solid rgba(125,145,180,.3)', textAlign: 'center', zIndex: 1 };

  return (
    <div className="mk-scope" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card">
        <div className="card-h" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={MK.iconBadge('teal', 32)}><Ic d={I.user || I.users || I.grid} s={16} /></div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 700, fontSize: 15.5, color: '#16202e' }}>Staff roster</div>
            <div className="sub">One person's shifts across months and units</div>
          </div>
          <div style={{ position: 'relative', minWidth: 260 }}>
            <input value={pickOpen ? q : (person ? person.name + (person.emp_id ? ' · ' + person.emp_id : '') : q)}
              onFocus={() => { setPickOpen(true); setQ(''); }} onBlur={() => setTimeout(() => setPickOpen(false), 150)}
              onChange={(e) => setQ(e.target.value)} placeholder="Find a nurse or PCA — name, emp no, unit…"
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 11px', borderRadius: 9, border: '1px solid rgba(125,145,180,.4)', fontFamily: 'inherit', fontSize: 12.5 }} />
            {pickOpen && (
              <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 4, background: '#fff', border: '1px solid rgba(125,145,180,.3)', borderRadius: 10, boxShadow: '0 16px 40px rgba(16,32,46,.18)', zIndex: 50, maxHeight: 320, overflow: 'auto' }}>
                {!matches.length && <div className="sub" style={{ padding: 12 }}>No one matches.</div>}
                {matches.map((e) => (
                  <div key={e.id} onMouseDown={() => { setSel(String(e.id)); setPickOpen(false); setQ(''); }}
                    style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(125,145,180,.1)' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#16202e' }}>{e.name}</div>
                    <div style={{ fontSize: 10.5, color: '#8a97a8' }}>{[e.emp_id, e.designation, e.current_department].filter(Boolean).join(' · ')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <span className="sub">From</span>
          <select value={from} onChange={(e) => setFrom(e.target.value)}>{range.map(([y, m]) => <option key={'f' + y + m} value={rsMonthKey(y, m)}>{R.MONTHS[m].slice(0, 3)} {y}</option>)}</select>
          <span className="sub">to</span>
          <select value={to} onChange={(e) => setTo(e.target.value)}>{range.map(([y, m]) => <option key={'t' + y + m} value={rsMonthKey(y, m)}>{R.MONTHS[m].slice(0, 3)} {y}</option>)}</select>
          {person && K.can('print') && <button className="btn sm" type="button" onClick={print}>Print</button>}
        </div>
      </div>

      {!person ? (
        <div className="card"><div className="card-b" style={{ display: 'grid', placeItems: 'center', padding: 40, textAlign: 'center', gap: 6 }}>
          <div style={{ opacity: .35 }}><Ic d={I.user || I.users || I.grid} s={30} /></div>
          <div style={{ fontWeight: 600 }}>Pick a person to see their roster</div>
          <div className="sub" style={{ maxWidth: 420 }}>Every month they were on a unit's sheet, with their shift on each day and the month's totals.</div>
        </div></div>
      ) : (
        <React.Fragment>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
            {[['Rostered months', sum.months, '#0072a3'], ['Duty shifts', sum.duty, '#2b9488'], ['Night shifts', sum.N, '#5b45c4'], ['Rest days', sum.off, '#7d8ea8'], ['Leave days', sum.leave, '#b5670a'], ['Hours', sum.hours, '#16202e']].map(([l, v, c]) => (
              <div key={l} className="card" style={{ padding: '11px 14px' }}>
                <div style={{ fontFamily: K.MONO, fontSize: 19, fontWeight: 700, color: c }}>{v}</div>
                <div style={{ fontSize: 11, color: '#6c7a8c' }}>{l}</div>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="card-h"><h3 style={{ margin: 0 }}>{person.name}</h3><div className="sub">{[person.emp_id, person.designation, person.current_department].filter(Boolean).join(' · ')}</div></div>
            <div className="card-b" style={{ padding: 0, overflow: 'auto' }}>
              {err && <div style={{ padding: 14, color: '#b4232f', fontSize: 12.5 }}>{err}</div>}
              {data === null ? <div className="sub" style={{ padding: 22, textAlign: 'center' }}>Loading…</div> : (
                <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: 'left', paddingLeft: 12, minWidth: 82 }}>Month</th>
                      <th style={{ ...th, textAlign: 'left', minWidth: 120 }}>Unit</th>
                      {Array.from({ length: 31 }, (_, i) => <th key={i} style={th}>{i + 1}</th>)}
                      {[['Duty', '#16202e'], ['M', K.bColor('M')], ['E', K.bColor('E')], ['N', K.bColor('N')], ['Off', '#7d8ea8'], ['Lv', '#b5670a'], ['Hrs', '#16202e']].map(([l, c]) => <th key={l} style={{ ...th, color: c, minWidth: 26 }}>{l}</th>)}
                      <th style={{ ...th, minWidth: 96 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map((mo) => {
                      const label = R.MONTHS[mo.m].slice(0, 3) + ' ' + mo.y;
                      const days = R.daysIn(mo.y, mo.m);
                      if (!mo.sheets.length) return (
                        <tr key={label}>
                          <td style={{ ...cell, fontFamily: 'inherit', textAlign: 'left', paddingLeft: 12, fontWeight: 600, color: '#3c4858' }}>{label}</td>
                          <td colSpan={40} style={{ ...cell, fontFamily: 'inherit', fontWeight: 500, color: '#9aa6b4', textAlign: 'left' }}>Not on any roster this month</td>
                        </tr>
                      );
                      return mo.sheets.map((x) => {
                        const t = rsTotals(x.cells, mo.y, mo.m);
                        return (
                          <tr key={label + x.id}>
                            <td style={{ ...cell, fontFamily: 'inherit', textAlign: 'left', paddingLeft: 12, fontWeight: 600, color: '#16202e' }}>{label}</td>
                            <td style={{ ...cell, fontFamily: 'inherit', textAlign: 'left', fontWeight: 600, color: '#0072a3', cursor: 'pointer', whiteSpace: 'nowrap' }}
                              title="Open this unit's sheet" onClick={() => setRoute({ view: 'rosterGrid', dept: x.dept, year: mo.y, month: mo.m })}>{x.deptName || x.dept}</td>
                            {Array.from({ length: 31 }, (_, i) => {
                              const d = i + 1; const c = (x.cells || {})[d] || '';
                              if (d > days) return <td key={d} style={{ ...cell, background: 'rgba(125,145,180,.08)' }} />;
                              const col = c ? K.bColor(R.bucketOf(c)) : null;
                              return <td key={d} title={c ? c + ((R.BY_CODE[c] || {}).label ? ' — ' + R.BY_CODE[c].label : '') : ''} style={{ ...cell, color: col || '#ccd3dc', background: c ? col + '14' : 'transparent' }}>{c || '·'}</td>;
                            })}
                            {[t.duty, t.M, t.E, t.N, t.off, t.leave, t.hours].map((v, i) => <td key={i} style={{ ...cell, color: '#3c4858' }}>{v || ''}</td>)}
                            <td style={{ ...cell, fontFamily: 'inherit' }}><K.RosStatusChip st={x.status} /></td>
                          </tr>
                        );
                      });
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

window.RosterStaffView = RosterStaffView;
