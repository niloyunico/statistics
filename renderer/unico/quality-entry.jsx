/* UNICO — Quality Indicator monthly data entry (formula-based, DEPARTMENT-DRIVEN).

   Reads each department's REAL indicators from the connected quality store
   (window.qualityData / window.useQualityStore) — so every indicator for the
   selected department shows up (all 86 across the hospital), is entered BY ITS
   OWN FORMULA (count / % / rate via numerator & denominator), and every saved
   value flows into the Dashboard, Scorecard, Reports, Trends & CAPA and rolls
   up into quarters automatically (the store sums monthly numerators/denominators
   then applies the formula).

   Switching the Department now changes the indicator list (previously a single
   hardcoded 12-item list showed for every department). */

/* ---- canonical FY months — match the store's quarter↔month mapping exactly ---- */
const QI_QM = (typeof window !== 'undefined' && window.QUALITY_QUARTER_MONTHS) ||
  { Q1: ['Jun-25', 'Jul-25', 'Aug-25'], Q2: ['Sep-25', 'Oct-25', 'Nov-25'], Q3: ['Dec-25', 'Jan-26', 'Feb-26'], Q4: ['Mar-26', 'Apr-26', 'May-26'] };
const QI_MONTHS = ['Q1', 'Q2', 'Q3', 'Q4'].reduce((a, q) => a.concat(QI_QM[q] || []), []);
const QI_MQ = (typeof window !== 'undefined' && window.QUALITY_MONTH_QUARTER) || {};
const QI_MFULL = {
  'Jun-25': 'June 2025', 'Jul-25': 'July 2025', 'Aug-25': 'August 2025', 'Sep-25': 'September 2025',
  'Oct-25': 'October 2025', 'Nov-25': 'November 2025', 'Dec-25': 'December 2025', 'Jan-26': 'January 2026',
  'Feb-26': 'February 2026', 'Mar-26': 'March 2026', 'Apr-26': 'April 2026', 'May-26': 'May 2026',
};

/* ---- standard formula library (kept: powers the editor's "Add from library" + the Catalog) ---- */
const QI_DEFS = [
  { id: 'cauti', name: 'CAUTI Rate', formula: 'rate1000', num: 'CAUTI cases', den: 'Urinary catheter days', unit: 'per 1000 cath-days', benchmark: 0, dir: 'lower' },
  { id: 'clabsi', name: 'CLABSI Rate', formula: 'rate1000', num: 'CLABSI cases', den: 'Central line days', unit: 'per 1000 line-days', benchmark: 0, dir: 'lower' },
  { id: 'vap', name: 'VAP Rate', formula: 'rate1000', num: 'VAP cases', den: 'Ventilator days', unit: 'per 1000 vent-days', benchmark: 0, dir: 'lower' },
  { id: 'fall', name: 'Patient Fall Rate', formula: 'rate1000', num: 'Patient falls', den: 'Patient days', unit: 'per 1000 patient-days', benchmark: 0, dir: 'lower' },
  { id: 'hapu', name: 'HAPU Rate', formula: 'rate100', num: 'HAPU cases', den: 'Patient days', unit: 'per 100 patient-days', benchmark: 0, dir: 'lower' },
  { id: 'phlebitis', name: 'Phlebitis Rate', formula: 'rate1000', num: 'Phlebitis cases', den: 'Peripheral line days', unit: 'per 1000 line-days', benchmark: 5, dir: 'lower' },
  { id: 'handhygiene', name: 'Hand Hygiene Compliance', formula: 'pct', num: 'Compliant moments', den: 'Observed moments', unit: '%', benchmark: 90, dir: 'higher' },
  { id: 'mederror', name: 'Medication Error', formula: 'count', num: 'Medication errors', den: null, unit: 'count', benchmark: 0, dir: 'lower' },
  { id: 'reintubation', name: 'Re-intubation < 48h', formula: 'count', num: 'Re-intubations', den: null, unit: 'count', benchmark: 0, dir: 'lower' },
  { id: 'readmission', name: 'ICU Re-admission < 48h', formula: 'count', num: 'Re-admissions', den: null, unit: 'count', benchmark: 0, dir: 'lower' },
  { id: 'nsi', name: 'Needle Stick Injury', formula: 'count', num: 'NSI events', den: null, unit: 'count', benchmark: 0, dir: 'lower' },
  { id: 'ssi', name: 'Surgical Site Infection', formula: 'count', num: 'SSI cases', den: null, unit: 'count', benchmark: 0, dir: 'lower' },
];
function qiFormulaText(def) {
  if (def.formula === 'count') return `${def.name} = ${def.num}`;
  const mult = def.formula === 'rate1000' ? '× 1000' : '× 100';
  return `${def.name} = (${def.num} ÷ ${def.den}) ${mult}`;
}
function qiCompute(def, num, den) {
  const n = Number(num) || 0, d = Number(den) || 0;
  if (def.formula === 'count') return n;
  if (!d) return 0;
  if (def.formula === 'rate1000') return Math.round(n / d * 1000 * 100) / 100;
  return Math.round(n / d * 100 * 100) / 100; // rate100 / pct
}
function qiStatus(def, val) { return def.dir === 'higher' ? (val >= def.benchmark ? 'ok' : 'breach') : (val <= def.benchmark ? 'ok' : 'breach'); }

/* ---- helpers for the store-backed (per-department) indicators ---- */
function qiNum(v) { return v === '' || v == null ? null : Number(v); }
// Formula of a stored indicator: enriched seed has it; custom-added rows default to 'direct'.
function qeFormulaOf(ind) { return (ind && ind.formula) || (ind && ind.valueType === '%' ? 'pct' : 'direct'); }
function qeNeedsNum(ind) { return qeFormulaOf(ind) !== 'direct'; }            // count & rate/% take a numerator
function qeNeedsDen(ind) { const f = qeFormulaOf(ind); return f !== 'count' && f !== 'direct'; } // %/rate take a denominator
function qeCompute(ind, num, den) {
  const f = qeFormulaOf(ind);
  if (f === 'direct') return qiNum(num) || 0;
  return window.qiFormulaCompute(f, num, den);
}
function qeStatus(ind, val) {
  const b = ind.benchmarkValue;
  if (b == null || b === '') return 'na';
  return ind.goalDirection === 'higher_is_better' ? (val >= b ? 'ok' : 'breach') : (val <= b ? 'ok' : 'breach');
}
function qeNumLabel(ind) { return ind.numLabel || ind.name || 'Numerator'; }
function qeDenLabel(ind) { return ind.denLabel || 'Denominator'; }
function qeUnit(ind) {
  if (ind.unit) return ind.unit;
  const f = qeFormulaOf(ind);
  return f === 'pct' ? '%' : f === 'count' ? 'count' : (ind.valueType || '');
}
function qeFormulaText(ind) {
  if (ind.formulaText) return ind.formulaText;
  const f = qeFormulaOf(ind);
  if (f === 'direct') return `${ind.name || 'Value'} = entered value`;
  if (f === 'count') return `value = ${qeNumLabel(ind)}`;
  const mult = f === 'rate1000' ? '× 1000' : '× 100';
  return `(${qeNumLabel(ind)} ÷ ${qeDenLabel(ind)}) ${mult}`;
}
// The saved value (if any) for one month of one indicator, read from the merged store.
function qeMonthVal(ind, m) {
  if (!ind) return null;
  const f = qeFormulaOf(ind);
  if (f === 'direct') {
    const v = ind.months && ind.months[m];
    return (v == null || v === '') ? null : { num: v, den: null, value: qiNum(v) || 0 };
  }
  const n = ind.mNum && ind.mNum[m];
  if (n == null || n === '') return null;
  const d = qeNeedsDen(ind) ? (ind.mDen && ind.mDen[m]) : null;
  return { num: n, den: d, value: window.qiFormulaCompute(f, n, d) };
}
// Persist one month's value into the connected store (merges, then quarters re-roll).
function qeSave(Q, deptKey, ind, m, num, den) {
  const f = qeFormulaOf(ind);
  if (f === 'direct') return Q.patchIndicator(deptKey, ind.id, { months: { [m]: qiNum(num) } });
  const patch = { mNum: { [m]: qiNum(num) } };
  if (qeNeedsDen(ind)) patch.mDen = { [m]: qiNum(den) };
  Q.patchIndicator(deptKey, ind.id, patch);
}
function qeClear(Q, deptKey, ind, m) {
  const f = qeFormulaOf(ind);
  if (f === 'direct') return Q.patchIndicator(deptKey, ind.id, { months: { [m]: null } });
  const patch = { mNum: { [m]: null } };
  if (qeNeedsDen(ind)) patch.mDen = { [m]: null };
  Q.patchIndicator(deptKey, ind.id, patch);
}

/* ---------------- Bulk entry: all of one department's indicators for one month ---------------- */
function QualityBulk({ Q, deptKey, dept, month, setMonth, depts, setDeptKey, setToast }) {
  const [vals, setVals] = React.useState({});
  React.useEffect(() => { setVals({}); }, [deptKey, month]); // reset when the target changes
  const setV = (id, k, v) => setVals(s => ({ ...s, [id]: { ...(s[id] || {}), [k]: v } }));
  const inds = (dept && dept.indicators) || [];
  const zeroAll = () => { const o = {}; inds.forEach(ind => { o[ind.id] = { ...(vals[ind.id] || {}), num: '0' }; }); setVals(o); };
  // A row is only saveable when complete FOR ITS FORMULA: rate/% need a denominator
  // too (matches the single-entry guard), else qiFormulaCompute would store a bogus 0.
  const complete = ind => { const v = vals[ind.id] || {}; return v.num !== '' && v.num != null && (!qeNeedsDen(ind) || (v.den !== '' && v.den != null)); };
  const filledCount = inds.filter(complete).length;
  const saveAll = () => {
    let n = 0;
    inds.forEach(ind => { if (!complete(ind)) return; const v = vals[ind.id] || {}; qeSave(Q, deptKey, ind, month, v.num, v.den); n++; });
    setToast(`Saved ${n} indicator${n !== 1 ? 's' : ''} for ${dept.name} · ${QI_MFULL[month] || month}`);
    try { window.UI && window.UI.toast('Saved ' + n + ' ✓', 'success'); } catch (e) { }
    setVals({});
  };
  const sel = { padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#fff' };
  const cellInp = { width: '100%', minWidth: 78, padding: '7px 8px', border: '1px solid var(--line)', borderRadius: 6, fontFamily: 'IBM Plex Mono', fontSize: 13, textAlign: 'right', outline: 'none' };
  return (
    <div className="card"><div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ minWidth: 200 }}><label>Department</label><select style={sel} value={deptKey} onChange={e => setDeptKey(e.target.value)}>{depts.map(d => <option key={d.key} value={d.key}>{d.name}</option>)}</select></div>
        <div className="field" style={{ minWidth: 180 }}><label>Reporting month</label><select style={sel} value={month} onChange={e => setMonth(e.target.value)}>{QI_MONTHS.map(m => <option key={m} value={m}>{QI_MFULL[m]}</option>)}</select></div>
        <span className="spacer" style={{ flex: 1 }} />
        <button className="btn sm" onClick={zeroAll} title="Set every indicator's numerator to 0"><Ic d={I.check} s={14} />Zero-defect month</button>
        <button className="btn sm" onClick={() => setVals({})}>Clear</button>
        <button className="btn pri" onClick={saveAll} disabled={!filledCount} style={{ opacity: filledCount ? 1 : .5 }}><Ic d={I.check} s={16} sw={2.4} />Save all ({filledCount})</button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>Enter values for all indicators of <b style={{ color: 'var(--ink)' }}>{dept ? dept.name : '—'}</b> — {QI_MFULL[month] || month}. Rates compute live; leave a row blank to skip it. Saved values flow to the dashboard & reports.</div>
      <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 9 }}>
        <table className="tbl">
          <thead><tr><th style={{ textAlign: 'left' }}>Indicator</th><th>Numerator</th><th>Denominator</th><th>Value</th><th style={{ textAlign: 'left' }}>Status</th></tr></thead>
          <tbody>
            {inds.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--faint)' }}>This department has no indicators yet — add some in Manage Indicators.</td></tr>}
            {inds.map(ind => {
              const v = vals[ind.id] || {}; const needsDen = qeNeedsDen(ind);
              const value = qeCompute(ind, v.num, v.den); const filled = complete(ind);
              const s = qeStatus(ind, value); const tone = s === 'ok' ? '#1f9d57' : s === 'breach' ? '#d23a52' : '#9aa6b4';
              return (
                <tr key={ind.id}>
                  <td style={{ textAlign: 'left' }}><b style={{ color: 'var(--ink)' }}>{ind.name}</b><div style={{ fontSize: 10, color: 'var(--faint)', fontFamily: "'IBM Plex Sans'" }}>{qeUnit(ind)}{ind.benchmarkValue != null && ind.benchmarkValue !== '' ? ' · ' + (ind.goalDirection === 'higher_is_better' ? '≥' : '≤') + ' ' + ind.benchmarkValue : ''}</div></td>
                  <td style={{ padding: 4, width: 96 }}><input type="number" min="0" style={cellInp} value={v.num ?? ''} onChange={e => setV(ind.id, 'num', e.target.value)} placeholder={qeNeedsNum(ind) ? qeNumLabel(ind) : 'value'} /></td>
                  <td style={{ padding: 4, width: 96 }}>{needsDen ? <input type="number" min="0" style={cellInp} value={v.den ?? ''} onChange={e => setV(ind.id, 'den', e.target.value)} placeholder={qeDenLabel(ind)} /> : <span style={{ color: 'var(--faint)' }}>—</span>}</td>
                  <td className="num">{filled ? value : '—'}</td>
                  <td style={{ textAlign: 'left' }}>{filled ? (s === 'na' ? <span style={{ color: 'var(--faint)' }}>—</span> : <span className="chip" style={{ background: tone + '1c', color: tone }}>{s === 'ok' ? 'On benchmark' : 'Breach'}</span>) : <span style={{ color: 'var(--faint)' }}>—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div></div>
  );
}

/* ---------------- Coverage grid for the selected department ---------------- */
function QualityCoverage({ dept, onPick }) {
  const months = QI_MONTHS;
  const inds = (dept && dept.indicators) || [];
  const has = (ind, m) => qeMonthVal(ind, m);
  let saved = 0; const total = inds.length * months.length;
  inds.forEach(ind => months.forEach(m => { if (has(ind, m)) saved++; }));
  const pct = total ? Math.round(saved * 100 / total) : 0;
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="card-h"><h3>Data Coverage — {dept ? dept.name : '—'}</h3><span className="sub">which indicator-months still need data · click a cell to fill it</span><span className="spacer" />
        <span className="chip" style={{ background: pct >= 90 ? 'var(--pos-bg)' : pct >= 50 ? '#fdf3e3' : 'var(--neg-bg)', color: pct >= 90 ? 'var(--pos)' : pct >= 50 ? 'var(--amber)' : 'var(--neg)' }}>{pct}% entered</span>
        <span className="tag num" style={{ marginLeft: 8 }}>{total - saved} needed</span></div>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl"><thead><tr><th style={{ textAlign: 'left' }}>Indicator</th>{months.map(m => <th key={m} style={{ textAlign: 'center' }}>{m}</th>)}</tr></thead>
          <tbody>{inds.map(ind => (
            <tr key={ind.id}><td style={{ textAlign: 'left' }}><b style={{ color: 'var(--ink)' }}>{ind.name}</b></td>
              {months.map(m => { const e = has(ind, m); return (
                <td key={m} style={{ textAlign: 'center' }}><span onClick={() => onPick(ind.id, m)} title={e ? `${e.value} ${qeUnit(ind)} · click to edit` : 'Needs data — click to enter'}
                  style={{ cursor: 'pointer', display: 'inline-grid', placeItems: 'center', width: 24, height: 22, borderRadius: 6, fontWeight: 700, fontSize: 11, background: e ? 'var(--pos-bg)' : 'var(--neg-bg)', color: e ? 'var(--pos)' : 'var(--neg)' }}>{e ? '✓' : '!'}</span></td>
              ); })}
            </tr>
          ))}
          {inds.length === 0 && <tr><td colSpan={months.length + 1} style={{ textAlign: 'center', color: 'var(--faint)' }}>No indicators for this department.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Main: single-entry, department-driven ---------------- */
function QualityEntry({ setRoute }) {
  const Q = window.useQualityStore();
  const depts = (Q.depts || []).filter(d => d.indicators && d.indicators.length);
  const [deptKey, setDeptKey] = React.useState(depts[0] ? depts[0].key : '');
  const dept = Q.get(deptKey) || depts[0];
  const inds = (dept && dept.indicators) || [];
  const [indId, setIndId] = React.useState(inds[0] ? inds[0].id : '');
  const [month, setMonth] = React.useState('May-26');
  const [num, setNum] = React.useState('');
  const [den, setDen] = React.useState('');
  const [toast, setToast] = React.useState(null);
  const [mode, setMode] = React.useState('single');
  const formCardRef = React.useRef(null);
  const numInputRef = React.useRef(null);

  const ind = inds.find(i => i.id === indId) || inds[0];

  // Keep selection valid as the department changes (the bug fix: indicator list is per-dept).
  const pickDept = (key) => {
    const nd = (Q.get(key) || depts.find(d => d.key === key));
    setDeptKey(key);
    setIndId(nd && nd.indicators[0] ? nd.indicators[0].id : '');
    setNum(''); setDen('');
  };

  // Load the stored value for the current (dept, indicator, month) into the form.
  React.useEffect(() => {
    const mv = qeMonthVal(ind, month);
    setNum(mv ? String(mv.num) : '');
    setDen(mv && mv.den != null ? String(mv.den) : '');
  }, [deptKey, indId, month]); // eslint-disable-line

  if (!depts.length) {
    return <div className="grid" style={{ gap: 16 }}>
      <SectionTitle icon={I.input} title="Quality Indicator — Monthly Entry" sub="Enter monthly numerator & denominator — the rate is computed by formula and checked against the benchmark" />
      <div className="card"><div className="card-b" style={{ textAlign: 'center', color: 'var(--faint)', padding: 40 }}>No quality data loaded.</div></div>
    </div>;
  }

  const f = qeFormulaOf(ind);
  const needsDen = qeNeedsDen(ind);
  const needsNum = qeNeedsNum(ind);
  const value = qeCompute(ind, num, den);
  const status = qeStatus(ind, value);
  const filled = num !== '' && (!needsDen || den !== '');
  const isEditing = !!qeMonthVal(ind, month);
  const unit = qeUnit(ind);
  const tone = status === 'ok' ? '#1f9d57' : status === 'breach' ? '#d23a52' : '#9aa6b4';

  // monthly series for the trend + saved table
  const series = QI_MONTHS.map(m => { const mv = qeMonthVal(ind, m); return mv ? { m, label: m, value: mv.value, num: mv.num, den: mv.den } : null; }).filter(Boolean);
  const chartData = series.map(r => ({ label: r.label, value: r.value }));

  const save = () => {
    if (!filled) { setToast('Enter the required value(s)'); return; }
    const wasEditing = isEditing;
    qeSave(Q, deptKey, ind, month, num, needsDen ? den : null);
    setToast(`Saved ${ind.name} · ${QI_MFULL[month]} = ${value} ${unit}`);
    try { window.UI && window.UI.toast(wasEditing ? 'Entry updated ✓' : 'Saved ✓', 'success'); } catch (e) { }
  };
  const deleteEntry = async (m) => {
    let ok = true;
    try { ok = await window.UI.confirm({ title: 'Delete this entry?', message: `Removes the saved value for ${ind.name} · ${QI_MFULL[m] || m}.`, danger: true, confirmLabel: 'Delete' }); }
    catch (e) { ok = window.confirm(`Delete the saved value for ${ind.name} · ${QI_MFULL[m] || m}?`); }
    if (!ok) return;
    qeClear(Q, deptKey, ind, m);
    if (m === month) { setNum(''); setDen(''); }
    try { window.UI && window.UI.toast('Entry deleted', 'success'); } catch (e) { }
  };
  const focusForm = () => setTimeout(() => { try { if (formCardRef.current) formCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); if (numInputRef.current) numInputRef.current.focus(); } catch (e) { } }, 60);
  // Edit a saved month of the CURRENT indicator (ind is correct here).
  const loadMonth = (m) => {
    setMonth(m);
    const mv = qeMonthVal(ind, m);
    setNum(mv ? String(mv.num) : ''); setDen(mv && mv.den != null ? String(mv.den) : '');
    focusForm();
  };
  // Jump to a (possibly different) indicator+month from the coverage grid; the
  // prefill effect loads the stored value once indId/month state has applied.
  const pickCell = (id, m) => { setIndId(id); setMonth(m); focusForm(); };

  const sel = { padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#fff' };
  const inputSty = { padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, fontFamily: 'IBM Plex Mono', fontSize: 16, width: '100%', outline: 'none' };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <SectionTitle icon={I.input} title="Quality Indicator — Monthly Entry"
        sub="Pick a department to see its indicators — enter each by its formula; the value is computed, benchmarked, and saved to the dashboard & reports"
        right={<><div className="seg"><button className={mode === 'single' ? 'on' : ''} onClick={() => setMode('single')}>Single</button><button className={mode === 'bulk' ? 'on' : ''} onClick={() => setMode('bulk')}>Bulk by month</button></div><button className="btn sm" onClick={() => setRoute({ view: 'quality' })}><Ic d={I.heart} s={15} />Dashboard</button></>} />

      {mode === 'bulk' && <QualityBulk Q={Q} deptKey={deptKey} dept={dept} month={month} setMonth={setMonth} depts={depts} setDeptKey={pickDept} setToast={setToast} />}
      {mode === 'single' &&
        <div className="grid" style={{ gridTemplateColumns: '1.1fr 1fr', alignItems: 'start' }}>
          {/* entry */}
          <div className="card" ref={formCardRef}><div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field"><label>Department</label><select style={sel} value={deptKey} onChange={e => pickDept(e.target.value)}>{depts.map(d => <option key={d.key} value={d.key}>{d.name}</option>)}</select></div>
              <div className="field"><label>Reporting month</label><select style={sel} value={month} onChange={e => setMonth(e.target.value)}>{QI_MONTHS.map(m => <option key={m} value={m}>{QI_MFULL[m]}</option>)}</select></div>
            </div>
            <div className="field"><label>Indicator <span style={{ color: 'var(--faint)' }}>· {inds.length} in {dept ? dept.name : '—'}</span></label>
              <select style={sel} value={ind ? ind.id : ''} onChange={e => { setIndId(e.target.value); }}>{inds.map(i => <option key={i.id} value={i.id}>{i.name}{qeUnit(i) ? ` (${qeUnit(i)})` : ''}</option>)}</select></div>

            {/* formula + reference banner */}
            {ind && <div style={{ background: 'var(--blue-50)', border: '1px solid var(--blue-100)', borderRadius: 9, padding: '11px 14px', fontSize: 12.5, color: 'var(--blue-700)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontFamily: 'IBM Plex Mono' }}>ƒ {qeFormulaText(ind)}</div>
              {(ind.numeratorDef || ind.denominatorDef) && <div style={{ fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                {ind.numeratorDef && <div><b>Numerator:</b> {ind.numeratorDef}</div>}
                {needsDen && ind.denominatorDef && <div><b>Denominator:</b> {ind.denominatorDef}</div>}
              </div>}
              {ind.reference && <div style={{ fontSize: 10.5, color: 'var(--muted)', borderTop: '1px solid var(--blue-100)', paddingTop: 5, display: 'flex', alignItems: 'center', gap: 5 }}><Ic d={I.doc} s={12} />Reference: {ind.reference}</div>}
            </div>}

            <div style={{ display: 'grid', gridTemplateColumns: needsDen ? '1fr 1fr' : '1fr', gap: 12 }}>
              <div className="field"><label>{qeNumLabel(ind)} <span style={{ color: 'var(--faint)' }}>{needsNum ? '(numerator)' : '(value)'}</span></label><input ref={numInputRef} type="number" min="0" style={inputSty} value={num} onChange={e => setNum(e.target.value)} placeholder="0" /></div>
              {needsDen && <div className="field"><label>{qeDenLabel(ind)} <span style={{ color: 'var(--faint)' }}>(denominator)</span></label><input type="number" min="0" style={inputSty} value={den} onChange={e => setDen(e.target.value)} placeholder="0" /></div>}
            </div>

            {/* computed result */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 11, padding: '14px 18px' }}>
              <div><div style={{ fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .4, fontWeight: 600 }}>Computed value</div>
                <div className="num" style={{ fontSize: 30, fontWeight: 700, color: filled ? tone : 'var(--faint)', lineHeight: 1.1 }}>{filled ? value : '—'} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>{unit}</span></div></div>
              <span className="spacer" />
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{ind && ind.benchmarkValue != null && ind.benchmarkValue !== '' ? `Benchmark ${ind.goalDirection === 'higher_is_better' ? '≥' : '≤'} ${ind.benchmarkValue}${f === 'pct' ? '%' : ''}` : (ind && ind.benchmark) || 'No benchmark'}</div>
                {filled && status !== 'na' && <span className="chip" style={{ background: tone + '1c', color: tone, marginTop: 4, display: 'inline-block' }}>{status === 'ok' ? '● On benchmark' : '▲ Breach'}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn pri" onClick={save}><Ic d={I.check} s={16} sw={2.4} />{isEditing ? 'Update monthly value' : 'Save monthly value'}</button>
              <button className="btn" onClick={() => { setNum(''); setDen(''); }}>Clear</button>
            </div>
          </div></div>

          {/* trend + saved */}
          <div className="grid" style={{ gap: 16 }}>
            <div className="card">
              <div className="card-h"><h3>{ind ? ind.name : '—'} — {dept ? dept.name : ''}</h3><span className="spacer" /><span className="tag">{series.length} months</span></div>
              <div className="card-b">{chartData.length ? <BarChart data={chartData} x="label" y="value" height={190} color={tone} /> : <div style={{ textAlign: 'center', color: 'var(--faint)', padding: '34px', fontSize: 13 }}>No saved months yet for this indicator.</div>}</div>
            </div>
            <div className="card" style={{ overflow: 'hidden' }}>
              <div className="card-h"><h3>Saved Monthly Values</h3><span className="spacer" /></div>
              <table className="tbl">
                <thead><tr><th>Month</th><th>{qeNumLabel(ind)}</th>{needsDen && <th>{qeDenLabel(ind)}</th>}<th>Value</th><th style={{ textAlign: 'left' }}>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
                <tbody>
                  {series.length === 0 && <tr><td colSpan={needsDen ? 6 : 5} style={{ textAlign: 'center', color: 'var(--faint)', fontFamily: "'IBM Plex Sans'" }}>No entries.</td></tr>}
                  {series.slice().reverse().map(r => { const s = qeStatus(ind, r.value); const stone = s === 'ok' ? '#1f9d57' : s === 'breach' ? '#d23a52' : '#9aa6b4'; return (
                    <tr key={r.m}><td>{QI_MFULL[r.m] || r.m}</td><td>{fmt(r.num)}</td>{needsDen && <td>{fmt(r.den)}</td>}<td>{r.value} <span style={{ color: 'var(--faint)', fontSize: 10 }}>{unit}</span></td>
                      <td style={{ textAlign: 'left' }}>{s === 'na' ? <span style={{ color: 'var(--faint)' }}>—</span> : <span className="chip" style={{ background: stone + '1c', color: stone }}>{s === 'ok' ? 'On benchmark' : 'Breach'}</span>}</td>
                      <td><div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="icon-btn" style={{ width: 24, height: 24 }} title="Edit this entry" onClick={() => loadMonth(r.m)}><Ic d={I.edit} s={13} /></button>
                        <button className="icon-btn danger" style={{ width: 24, height: 24 }} title="Delete this entry" onClick={() => deleteEntry(r.m)}><Ic d={I.x} s={13} /></button>
                      </div></td></tr>
                  ); })}
                </tbody>
              </table>
            </div>
          </div>
        </div>}
      {mode === 'single' && <QualityCoverage dept={dept} onPick={pickCell} />}
      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
window.QualityEntry = QualityEntry;
