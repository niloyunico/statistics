/* UNICO — Quality Incident Reports.

   A reporting system over EVERY logged incident (not just one indicator): reads
   window.qualityData() and flattens department → indicator → month → incidents[]
   into individual incident reports, each rendered like the NQI monthly report
   blocks — Patient & Admission details, the indicator value/benchmark/status, and
   the cause / Corrective & Preventive Action (CAPA). Filter by department, month,
   indicator or free text; print/PDF any selection. Global-script React. */

/* ---- month helpers ---- */
const QIR_MON_FULL = { Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December' };
function qirMonthFull(m) { const p = String(m || '').split('-'); return p[1] ? `${QIR_MON_FULL[p[0]] || p[0]} 20${p[1]}` : m; }
function qirFYMonths() {
  const QM = window.QUALITY_QUARTER_MONTHS;
  return QM ? ['Q1', 'Q2', 'Q3', 'Q4'].reduce((a, q) => a.concat(QM[q] || []), []) : [];
}

/* ---- value + status for an indicator-month ---- */
function qirMonthValue(ind, m) {
  if (ind.months && ind.months[m] != null && ind.months[m] !== '') return Number(ind.months[m]);
  const f = ind.formula;
  if (f === 'count' || !f || f === 'direct') { const ev = ind.incidents && ind.incidents[m]; return Array.isArray(ev) ? ev.length : null; }
  const n = ind.mNum && ind.mNum[m];
  if (n != null && n !== '') return window.qiFormulaCompute ? window.qiFormulaCompute(f, n, (ind.mDen || {})[m]) : Number(n);
  return null;
}
function qirStatus(ind, v) {
  const b = ind.benchmarkValue;
  if (b == null || b === '' || v == null) return 'na';
  return ind.goalDirection === 'higher_is_better' ? (v >= b ? 'ok' : 'breach') : (v <= b ? 'ok' : 'breach');
}
function qirUnit(ind) { return ind.unit || (ind.formula === 'pct' ? '%' : ind.formula === 'rate1000' ? 'per 1000' : ''); }
function qirFormulaText(ind) {
  if (ind.formulaText) return ind.formulaText;
  const f = ind.formula, num = ind.numLabel || ind.name, den = ind.denLabel || 'denominator';
  if (!f || f === 'count' || f === 'direct') return `${ind.name} = number of incidents`;
  return `(${num} ÷ ${den}) × ${f === 'rate1000' ? '1000' : '100'}`;
}
function qirBenchmark(ind) {
  if (ind.benchmark != null && ind.benchmark !== '') return ind.benchmark;
  const b = ind.benchmarkValue;
  if (b == null || b === '') return '—';
  return `${ind.goalDirection === 'higher_is_better' ? '≥' : '≤'} ${b}${ind.formula === 'pct' ? '%' : ''}`;
}

/* ---- flatten qualityData() into individual incident records ---- */
function qirCollect() {
  const data = (typeof window.qualityData === 'function' ? window.qualityData() : (window.QUALITY_SEED || []));
  const out = [];
  data.forEach((d) => (d.indicators || []).forEach((ind) => {
    const inc = ind.incidents || {};
    Object.keys(inc).forEach((m) => {
      const arr = inc[m];
      if (!Array.isArray(arr)) return;
      const value = qirMonthValue(ind, m);
      const status = qirStatus(ind, value);
      arr.forEach((ev, idx) => {
        if (!ev || typeof ev !== 'object') return;
        out.push({ deptKey: d.key, deptName: d.name, ind, indId: ind.id, indName: ind.name, month: m, value, status, ev, idx, n: arr.length });
      });
    });
  }));
  // newest FY months first, then department, then indicator
  const order = qirFYMonths(); const rank = (m) => { const i = order.indexOf(m); return i < 0 ? 999 : i; };
  out.sort((a, b) => rank(b.month) - rank(a.month) || a.deptName.localeCompare(b.deptName) || a.indName.localeCompare(b.indName));
  return out;
}

/* ---- print: build self-contained HTML and print via a hidden iframe ---- */
function qirEsc(v) { return ((v == null ? '' : v) + '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function qirRecHTML(r) {
  const ev = r.ev, tone = r.status === 'ok' ? '#1f9d57' : r.status === 'breach' ? '#d23a52' : '#8a93a3';
  const statusTxt = r.status === 'ok' ? 'Within Target' : r.status === 'breach' ? 'Above/Outside Target' : 'Not benchmarked';
  const row = (k, v) => v ? `<tr><td style="padding:3px 8px;border:1px solid #d4dbe3;color:#5b6b80;width:170px;font-weight:600">${qirEsc(k)}</td><td style="padding:3px 8px;border:1px solid #d4dbe3">${qirEsc(v)}</td></tr>` : '';
  const ag = [ev.age, ev.gender].filter(Boolean).join(' · ');
  return `<div style="border:1px solid #c3cdd8;border-radius:8px;padding:12px 14px;margin:0 0 14px;font-family:Calibri,Arial,sans-serif;font-size:11pt;page-break-inside:avoid">
    <div style="display:flex;justify-content:space-between;border-bottom:2px solid #0090ca;padding-bottom:6px;margin-bottom:8px">
      <div><b style="font-size:12.5pt">${qirEsc(r.indName)}</b> — ${qirEsc(qirMonthFull(r.month))}<div style="font-size:9.5pt;color:#5b6b80">Department: ${qirEsc(r.deptName)}${r.n > 1 ? ' · Incident ' + (r.idx + 1) + ' of ' + r.n : ''}</div></div>
      <div style="text-align:right"><span style="background:${tone}22;color:${tone};padding:2px 9px;border-radius:10px;font-weight:700;font-size:9.5pt">${statusTxt}</span><div style="font-size:9.5pt;color:#5b6b80;margin-top:3px">${qirEsc(r.indName)} = <b>${r.value == null ? '—' : r.value}</b> ${qirEsc(qirUnit(r.ind))}</div></div>
    </div>
    <div style="font-weight:700;color:#0090ca;font-size:9.5pt;margin:6px 0 3px">PATIENT &amp; ADMISSION DETAILS</div>
    <table style="border-collapse:collapse;width:100%;font-size:10pt">
      ${row('Patient name', ev.patientName)}${row('UHID / Reg. no', ev.uhid)}${row('Age / Gender', ag)}${row('Diagnosis', ev.diagnosis)}${row('Date of admission', ev.admissionDate)}${row('Date of procedure', ev.procedureDate)}
    </table>
    <div style="font-weight:700;color:#0090ca;font-size:9.5pt;margin:8px 0 3px">INDICATOR &amp; BENCHMARK</div>
    <table style="border-collapse:collapse;width:100%;font-size:10pt">
      ${row('Formula', qirFormulaText(r.ind))}${row('Computed value', (r.value == null ? '—' : r.value) + ' ' + qirUnit(r.ind))}${row('Benchmark / Target', qirBenchmark(r.ind))}${row('Status', statusTxt)}
    </table>
    <div style="font-weight:700;color:#0090ca;font-size:9.5pt;margin:8px 0 3px">INCIDENT, CAUSE &amp; CAPA</div>
    <table style="border-collapse:collapse;width:100%;font-size:10pt">
      ${row('Incident details', ev.details)}${row('Finding / observation', ev.finding)}${row('Corrective action', ev.corrective)}${row('Preventive action', ev.preventive)}${row('Special remarks', ev.remark)}
    </table>
  </div>`;
}
function qirPrint(records, scopeLabel) {
  const body = records.map(qirRecHTML).join('');
  const hospital = (window.UNICO && window.UNICO.HOSPITAL && window.UNICO.HOSPITAL.name) || 'UNICO Hospitals';
  const html = `<html><head><title>Incident Reports</title></head><body style="margin:18px;background:#fff">
    <div style="font-family:Calibri,Arial;border-bottom:3px solid #0090ca;padding-bottom:8px;margin-bottom:14px">
      <div style="font-size:16pt;font-weight:800;color:#0d2440">${qirEsc(hospital)} — Nursing Quality Incident Reports</div>
      <div style="font-size:10pt;color:#5b6b80">${qirEsc(scopeLabel || 'All incidents')} · ${records.length} incident${records.length !== 1 ? 's' : ''}</div>
    </div>${body || '<div style="font-family:Calibri">No incidents to report.</div>'}</body></html>`;
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(f);
  const doc = f.contentWindow.document; doc.open(); doc.write(html); doc.close();
  f.contentWindow.focus();
  setTimeout(() => { try { f.contentWindow.print(); } catch (e) { } setTimeout(() => { try { document.body.removeChild(f); } catch (e) { } }, 1500); }, 350);
}

/* ---- on-screen detail card ---- */
function QirCard({ r, setRoute }) {
  const ev = r.ev;
  const tone = r.status === 'ok' ? '#1f9d57' : r.status === 'breach' ? '#d23a52' : '#8a93a3';
  const statusTxt = r.status === 'ok' ? 'Within target' : r.status === 'breach' ? 'Above / outside target' : 'Not benchmarked';
  const Sec = ({ t }) => <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--blue-700)', textTransform: 'uppercase', letterSpacing: .5, margin: '10px 0 4px' }}>{t}</div>;
  const Row = ({ k, v }) => v ? <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8, padding: '3px 0', borderBottom: '1px solid var(--line-2)' }}><div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{k}</div><div style={{ fontSize: 12.5, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>{v}</div></div> : null;
  const ag = [ev.age && (ev.age + ' yrs'), ev.gender].filter(Boolean).join(' · ');
  const anyPatient = ev.patientName || ev.uhid || ag || ev.diagnosis || ev.admissionDate || ev.procedureDate;
  const anyNarr = ev.details || ev.finding || ev.corrective || ev.preventive || ev.remark;
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="card-h" style={{ borderBottom: '2px solid var(--blue-100)' }}>
        <div>
          <h3 style={{ margin: 0, cursor: 'pointer' }} onClick={() => setRoute && setRoute({ view: 'qualityDept', dept: r.deptKey })}>{r.indName}</h3>
          <span className="sub">{r.deptName} · {qirMonthFull(r.month)}{r.n > 1 ? ` · incident ${r.idx + 1}/${r.n}` : ''}</span>
        </div>
        <span className="spacer" />
        <span className="chip" style={{ background: tone + '1c', color: tone }}>{statusTxt}</span>
        <span className="tag num" style={{ marginLeft: 8 }}>{r.value == null ? '—' : r.value} {qirUnit(r.ind)}</span>
      </div>
      <div className="card-b">
        {anyPatient && <><Sec t="Patient & admission details" />
          <Row k="Patient name" v={ev.patientName} /><Row k="UHID / Reg. no" v={ev.uhid} /><Row k="Age / Gender" v={ag} />
          <Row k="Diagnosis" v={ev.diagnosis} /><Row k="Date of admission" v={ev.admissionDate} /><Row k="Date of procedure" v={ev.procedureDate} /></>}
        <Sec t="Indicator & benchmark" />
        <Row k="Formula" v={qirFormulaText(r.ind)} /><Row k="Computed value" v={`${r.value == null ? '—' : r.value} ${qirUnit(r.ind)}`} />
        <Row k="Benchmark / target" v={qirBenchmark(r.ind)} /><Row k="Status" v={statusTxt} />
        {anyNarr && <><Sec t="Incident, cause & CAPA" />
          <Row k="Incident details" v={ev.details} /><Row k="Finding / observation" v={ev.finding} />
          <Row k="Corrective action" v={ev.corrective} /><Row k="Preventive action" v={ev.preventive} /><Row k="Special remarks" v={ev.remark} /></>}
        {!anyPatient && !anyNarr && <div style={{ fontSize: 12, color: 'var(--faint)', paddingTop: 6 }}>This incident has no detail captured yet — add patient & CAPA details in <b>Quality Data Entry</b>.</div>}
        <div style={{ marginTop: 10 }}><button className="btn sm" onClick={() => qirPrint([r], `${r.deptName} · ${r.indName} · ${qirMonthFull(r.month)}`)}><Ic d={I.printer || I.doc} s={13} />Print this report</button></div>
      </div>
    </div>
  );
}

/* ---------------- Main screen ---------------- */
function QualityIncidentReport({ setRoute }) {
  const all = React.useMemo(() => qirCollect(), []);
  const [dept, setDept] = React.useState('all');
  const [month, setMonth] = React.useState('all');
  const [indName, setIndName] = React.useState('all');
  const [q, setQ] = React.useState('');

  const depts = [...new Map(all.map(r => [r.deptKey, r.deptName])).entries()].map(([key, name]) => ({ key, name }));
  const months = qirFYMonths().filter(m => all.some(r => r.month === m));
  const indNames = [...new Set(all.map(r => r.indName))].sort();

  const ql = q.trim().toLowerCase();
  const filtered = all.filter(r => {
    if (dept !== 'all' && r.deptKey !== dept) return false;
    if (month !== 'all' && r.month !== month) return false;
    if (indName !== 'all' && r.indName !== indName) return false;
    if (ql) {
      const hay = [r.ev.patientName, r.ev.uhid, r.ev.diagnosis, r.ev.details, r.ev.finding, r.ev.corrective, r.ev.preventive, r.ev.remark, r.indName, r.deptName].join(' ').toLowerCase();
      if (!hay.includes(ql)) return false;
    }
    return true;
  });

  const breaches = filtered.filter(r => r.status === 'breach').length;
  const sel = { padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#fff' };
  const scopeLabel = [dept === 'all' ? 'All departments' : (depts.find(d => d.key === dept) || {}).name, month === 'all' ? null : qirMonthFull(month), indName === 'all' ? null : indName].filter(Boolean).join(' · ');

  return (
    <div className="grid" style={{ gap: 16 }}>
      <SectionTitle icon={I.doc} title="Quality Incident Reports"
        sub="Every logged incident as a full report — patient & admission details, the indicator value vs benchmark, and the cause / corrective & preventive action"
        right={<><button className="btn sm" onClick={() => setRoute({ view: 'qualityDataEntry' })}><Ic d={I.activity} s={15} />Add incident</button><button className="btn pri sm" disabled={!filtered.length} onClick={() => qirPrint(filtered, scopeLabel)}><Ic d={I.printer || I.doc} s={15} />Print / PDF ({filtered.length})</button></>} />

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
        <div className="card" style={{ padding: '14px 16px', borderLeft: '4px solid #0090ca' }}><div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>Incidents</div><div className="num" style={{ fontSize: 28, fontWeight: 800, color: '#0090ca' }}>{fmt(filtered.length)}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>in this view</div></div>
        <div className="card" style={{ padding: '14px 16px', borderLeft: '4px solid #d23a52' }}><div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>Benchmark breaches</div><div className="num" style={{ fontSize: 28, fontWeight: 800, color: '#d23a52' }}>{fmt(breaches)}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>above / outside target</div></div>
        <div className="card" style={{ padding: '14px 16px', borderLeft: '4px solid #6a52d4' }}><div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>Departments</div><div className="num" style={{ fontSize: 28, fontWeight: 800, color: '#6a52d4' }}>{fmt(new Set(filtered.map(r => r.deptKey)).size)}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>reporting incidents</div></div>
        <div className="card" style={{ padding: '14px 16px', borderLeft: '4px solid #1f9d57' }}><div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>Indicators</div><div className="num" style={{ fontSize: 28, fontWeight: 800, color: '#1f9d57' }}>{fmt(new Set(filtered.map(r => r.indName)).size)}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>with incidents</div></div>
      </div>

      <div className="card"><div className="card-b" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field"><label>Department</label><select style={sel} value={dept} onChange={e => setDept(e.target.value)}><option value="all">All departments</option>{depts.map(d => <option key={d.key} value={d.key}>{d.name}</option>)}</select></div>
        <div className="field"><label>Month</label><select style={sel} value={month} onChange={e => setMonth(e.target.value)}><option value="all">All months</option>{months.map(m => <option key={m} value={m}>{qirMonthFull(m)}</option>)}</select></div>
        <div className="field" style={{ minWidth: 200 }}><label>Indicator</label><select style={sel} value={indName} onChange={e => setIndName(e.target.value)}><option value="all">All indicators</option>{indNames.map(n => <option key={n} value={n}>{n}</option>)}</select></div>
        <div className="field" style={{ flex: 1, minWidth: 180 }}><label>Search</label><input style={{ ...sel, width: '100%' }} value={q} onChange={e => setQ(e.target.value)} placeholder="UHID, patient, diagnosis, cause…" /></div>
      </div></div>

      {all.length === 0 && (
        <div className="card"><div className="card-b" style={{ textAlign: 'center', color: 'var(--faint)', padding: 40, fontSize: 13 }}>
          No incidents logged yet. Use <b>Quality Data Entry</b> → “Add incident” to record an event with its patient &amp; CAPA details — it will appear here after admin review.
        </div></div>
      )}
      {all.length > 0 && filtered.length === 0 && (
        <div className="card"><div className="card-b" style={{ textAlign: 'center', color: 'var(--faint)', padding: 34, fontSize: 13 }}>No incidents match the current filters.</div></div>
      )}
      {filtered.map((r, i) => <QirCard key={r.deptKey + r.indId + r.month + r.idx + '-' + i} r={r} setRoute={setRoute} />)}
    </div>
  );
}
window.QualityIncidentReport = QualityIncidentReport;
