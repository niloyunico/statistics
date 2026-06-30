/* UNICO — Manage Indicators (master CRUD console).

   The most complete indicator editor in the Quality module: a top-level,
   cross-department workspace to CREATE, EDIT, CLONE, MOVE, BULK-ADD and DELETE
   quality indicators with EVERY field exposed — identity (name, clinical
   category, reference/standard, reporting frequency, overall remark),
   measurement (formula, numerator / denominator labels & definitions, value
   type, unit), target (goal direction, benchmark value + description) and the
   full quarterly + monthly values with per-quarter remarks.

   Writes through the SAME editable overlay store as every other Quality screen
   (window.useQualityStore → patchIndicator / addIndicator / removeIndicator /
   resetDept), so changes flow to the Dashboard, Scorecard, Trends, Monthly
   Entry, Reports & CAPA and persist in localStorage (mirrored to MongoDB by the
   web / native bridge).

   Globals (classic non-module scripts share global scope):
     React, I, Ic, SectionTitle, fmt, QS, QSHORT, QLABEL, indStatus, statusTone,
     window.useQualityStore, window.qualityData, window.qualitySlug,
     window.QUALITY_QUARTER_MONTHS, window.qiFormulaCompute, window.UI,
     QI_DEFS + qedLibrary (quality-entry/edit), qcCategory (quality-catalog). */
(function () {
  const { useState, useMemo, useEffect } = React;

  const QM_FORMULAS = [
    ['direct', 'Direct value (type the value)'],
    ['count', 'Count of events'],
    ['rate1000', 'Rate per 1000'],
    ['rate100', 'Rate per 100'],
    ['pct', 'Percentage (%)'],
  ];
  const QM_FORMULA_HINT = {
    direct: 'You type the value directly each period — no calculation is applied.',
    count: 'Value = the raw count of events (numerator only, no denominator).',
    rate1000: 'Value = (numerator ÷ denominator) × 1000.',
    rate100: 'Value = (numerator ÷ denominator) × 100.',
    pct: 'Value = (numerator ÷ denominator) × 100, shown as a percentage.',
  };
  const QM_VALTYPES = ['Count', '%', 'Rate'];
  const QM_DIRS = [['lower_is_better', '↓ Lower is better'], ['higher_is_better', '↑ Higher is better']];
  const QM_FREQ = ['Monthly', 'Quarterly', 'Annually', 'Bi-annually'];
  const QM_CATEGORIES = [
    'Healthcare-Associated Infection', 'Infection Prevention', 'Patient Safety',
    'Clinical Outcomes', 'Staff Safety', 'Staff Competency', 'Activity / Volume', 'Other',
  ];
  const QM_MFULL = {
    'Jun-25': 'June 2025', 'Jul-25': 'July 2025', 'Aug-25': 'August 2025', 'Sep-25': 'September 2025', 'Oct-25': 'October 2025', 'Nov-25': 'November 2025',
    'Dec-25': 'December 2025', 'Jan-26': 'January 2026', 'Feb-26': 'February 2026', 'Mar-26': 'March 2026', 'Apr-26': 'April 2026', 'May-26': 'May 2026',
  };
  const QM_QM = (typeof window !== 'undefined' && window.QUALITY_QUARTER_MONTHS) ||
    { Q1: ['Jun-25', 'Jul-25', 'Aug-25'], Q2: ['Sep-25', 'Oct-25', 'Nov-25'], Q3: ['Dec-25', 'Jan-26', 'Feb-26'], Q4: ['Mar-26', 'Apr-26', 'May-26'] };
  const QM_QS = ['Q1', 'Q2', 'Q3', 'Q4'];
  const QM_MONTHS = QM_QS.reduce((a, q) => a.concat(QM_QM[q] || []), []); // 12 months, in order
  const QM_MQ = {}; QM_QS.forEach(q => (QM_QM[q] || []).forEach(m => { QM_MQ[m] = q; }));

  /* ---------------- helpers ---------------- */
  const qmFmt = (x) => { try { return typeof fmt === 'function' ? fmt(x) : x; } catch (e) { return x; } };
  const qmNorm = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
  const qmNum = (v) => (v === '' || v == null ? null : Number(v));
  const qmFormulaOf = (ind) => (ind && ind.formula) || (ind && ind.valueType === '%' ? 'pct' : 'direct');
  const qmNeedsNum = (ind) => qmFormulaOf(ind) !== 'direct';
  const qmNeedsDen = (ind) => { const f = qmFormulaOf(ind); return f !== 'count' && f !== 'direct'; };
  const qmCategory = (ind) => {
    if (ind && ind.category) return ind.category;
    try { if (typeof qcCategory === 'function') return qcCategory(ind || {}); } catch (e) { }
    return 'Other';
  };
  const qmMeasure = (ind) => {
    const f = qmFormulaOf(ind);
    if (f === 'pct') return 'Percentage';
    if (f === 'rate1000' || f === 'rate100') return 'Rate';
    if (f === 'count') return 'Count';
    const t = ((ind && ind.valueType) || '').toLowerCase();
    if (t.indexOf('%') >= 0) return 'Percentage';
    if (t.startsWith('rate') || t.startsWith('per')) return 'Rate';
    return 'Count';
  };
  const qmUnit = (ind) => {
    if (ind && ind.unit) return ind.unit;
    const f = qmFormulaOf(ind);
    return f === 'pct' ? '%' : f === 'count' ? 'count' : (ind && ind.valueType) || '';
  };
  // Human-readable benchmark expression, e.g. "≤ 0 per 1000 cath-days" / "≥ 90%".
  const qmBenchExpr = (ind) => {
    const v = ind && ind.benchmarkValue;
    if (v == null || v === '') return null;
    const sym = (ind && ind.goalDirection === 'higher_is_better') ? '≥' : '≤';
    const pct = qmFormulaOf(ind) === 'pct' ? '%' : '';
    const unit = ind && ind.unit && !pct ? ' ' + ind.unit : '';
    return `${sym} ${v}${pct}${unit}`;
  };
  const qmFormulaText = (ind) => {
    const f = qmFormulaOf(ind);
    const num = (ind && (ind.numLabel || ind.name)) || 'numerator';
    const den = (ind && ind.denLabel) || 'denominator';
    if (f === 'direct') return `${(ind && ind.name) || 'Value'} = entered value`;
    if (f === 'count') return `value = ${num}`;
    const mult = f === 'rate1000' ? '× 1000' : '× 100';
    return `(${num} ÷ ${den}) ${mult}`;
  };
  // Does an indicator hold any saved values? (guards against silent data loss)
  function qmHasData(ind) {
    if (!ind) return false;
    const q = ind.quarters || {};
    if (QM_QS.some(k => q[k] != null && q[k] !== '')) return true;
    const filled = o => o && Object.keys(o).some(k => o[k] != null && o[k] !== '');
    // A denominator alone is not a measurement — only numerators / direct values count.
    return filled(ind.months) || filled(ind.mNum) || filled(ind.qNum);
  }
  function qmNewId(name) {
    return window.qualitySlug ? window.qualitySlug(name)
      : 'ind-' + String(name || 'indicator').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '-' + Math.random().toString(36).slice(2, 6);
  }
  // A blank indicator shape (all fields present so the editor controls are stable).
  function qmBlankShape(name) {
    return {
      id: qmNewId(name || 'new indicator'), name: name || '',
      formula: 'count', numLabel: 'Numerator', denLabel: 'Denominator',
      numeratorDef: '', denominatorDef: '', valueType: 'Count', unit: 'count',
      benchmark: '0 (zero defect)', benchmarkValue: 0, goalDirection: 'lower_is_better',
      category: '', reference: '', frequency: 'Monthly',
      quarters: { Q1: null, Q2: null, Q3: null, Q4: null }, quarterRemarks: {},
      qNum: {}, qDen: {}, mNum: {}, mDen: {}, months: {}, monthRemarks: {}, remarks: '',
    };
  }
  // Library shape for one standard def (reuse quality-edit's qedLibrary when present).
  function qmShapeFromDef(def) {
    const formula = def.formula || 'count';
    const pct = formula === 'pct';
    return Object.assign(qmBlankShape(def.name), {
      name: def.name, formula,
      numLabel: def.num || 'Numerator', denLabel: def.den || 'Denominator',
      valueType: pct ? '%' : (formula === 'count' ? 'Count' : 'Rate'),
      unit: def.unit || '',
      benchmark: `${def.dir === 'higher' ? '≥' : '≤'} ${def.benchmark}${pct ? '%' : ''}${def.unit ? ' ' + def.unit : ''}`,
      benchmarkValue: typeof def.benchmark === 'number' ? def.benchmark : null,
      goalDirection: def.dir === 'higher' ? 'higher_is_better' : 'lower_is_better',
    });
  }
  function qmLibrary() {
    const defs = (typeof QI_DEFS !== 'undefined' && Array.isArray(QI_DEFS)) ? QI_DEFS : [];
    let shapes = [];
    try { if (typeof qedLibrary === 'function') shapes = qedLibrary(); } catch (e) { }
    return defs.map((def, i) => ({ key: def.id || ('lib' + i), name: def.name || ('Indicator ' + (i + 1)), shape: shapes[i] || qmShapeFromDef(def) }));
  }
  // Deep-clone an existing indicator into a fresh add-shape (new id, copies values).
  function qmCloneShape(ind, name) {
    const c = JSON.parse(JSON.stringify(ind || {}));
    c.id = qmNewId(name || c.name);
    if (name != null) c.name = name;
    delete c.formulaText; // stale derived text — downstream screens recompute from name/labels
    return c;
  }
  function qmToast(msg, kind) { try { if (window.UI && window.UI.toast) window.UI.toast(msg, kind || 'success'); } catch (e) { } }
  async function qmConfirm(opts, fallbackMsg) {
    try { return await window.UI.confirm(opts); }
    catch (e) { return window.confirm(fallbackMsg || opts.message || 'Are you sure?'); }
  }

  /* shared input styling */
  const SEL = { padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 7, fontSize: 12.5, fontFamily: 'inherit', background: '#fff', width: '100%', outline: 'none' };
  const TXT = { ...SEL };
  const TXTL = { ...SEL, textAlign: 'left' };
  const NUM = { padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 6, fontFamily: 'IBM Plex Mono', fontSize: 12.5, width: '100%', textAlign: 'right', outline: 'none', background: '#fff' };
  const AREA = { ...TXTL, minHeight: 52, resize: 'vertical', lineHeight: 1.5, fontSize: 12 };
  // Sticky group header used by the indicator list (Common + per-department sections).
  const QM_GRP_H = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'var(--panel-2)', borderBottom: '1px solid var(--line-2)', borderTop: '1px solid var(--line-2)', position: 'sticky', top: 0, zIndex: 2 };

  function QmField({ label, hint, children, span }) {
    return (
      <div className="field" style={span ? { gridColumn: '1 / -1' } : null}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>{label}{hint && <span style={{ color: 'var(--faint)', fontWeight: 400, fontSize: 10.5 }}>{hint}</span>}</label>
        {children}
      </div>
    );
  }

  /* ---------------- value grid (MONTH-WISE), formula-aware ----------------------
     One row per month of the fiscal year (12 months). Rate / % indicators take a
     numerator + denominator and the value computes; count / direct indicators take
     a single value. Quarters still roll up automatically in the store (so the
     Quarterly Report keeps working) — shown read-only beneath the table. */
  function QmValueGrid({ deptKey, ind, Q }) {
    const patch = (p) => Q.patchIndicator(deptKey, ind.id, p);
    const f = qmFormulaOf(ind);
    const isFormula = f !== 'direct';
    const needsDen = qmNeedsDen(ind);                 // rate / % only
    const numHead = ind.numLabel || 'Numerator';
    const denHead = ind.denLabel || 'Denominator';

    // computed value for one month (null when nothing entered)
    const monthVal = (m) => {
      if (!isFormula) { const v = ind.months && ind.months[m]; return (v == null || v === '') ? null : Number(v); }
      const n = ind.mNum && ind.mNum[m];
      if (n == null || n === '') return null;
      const d = needsDen ? (ind.mDen && ind.mDen[m]) : null;
      // rate/% need BOTH numerator and denominator — a numerator alone is not yet
      // computable (don't let a missing denominator divide-by-zero into a fake 0).
      if (needsDen && (d == null || d === '')) return null;
      return (typeof window !== 'undefined' && window.qiFormulaCompute) ? window.qiFormulaCompute(f, n, d) : Number(n);
    };
    const monthStatus = (val) => {
      if (val == null) return 'na';
      const b = ind.benchmarkValue; if (b == null || b === '') return 'ok';
      return ind.goalDirection === 'higher_is_better' ? (val >= b ? 'ok' : 'breach') : (val <= b ? 'ok' : 'breach');
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
          {needsDen ? `Enter ${numHead} ÷ ${denHead} for each month — the value computes live and rolls up automatically.`
            : isFormula ? `Enter ${numHead} for each month — the value computes live.`
              : 'Enter each month’s value. Leave a month blank to skip it.'}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl rpt" style={{ fontSize: 11.5 }}>
            <thead><tr><th style={{ textAlign: 'left', width: 132 }}>Month</th>
              {isFormula && <th style={{ width: 78 }}>{numHead}</th>}
              {needsDen && <th style={{ width: 78 }}>{denHead}</th>}
              <th style={{ width: 78 }}>Value</th><th style={{ textAlign: 'left', width: 96 }}>Status</th><th style={{ textAlign: 'left' }}>Remark</th></tr></thead>
            <tbody>
              {QM_MONTHS.map(m => {
                const val = monthVal(m);
                const s = monthStatus(val);
                const tone = s === 'ok' ? '#1f9d57' : s === 'breach' ? '#d23a52' : '#9aa6b4';
                return (
                  <tr key={m}>
                    <td style={{ textAlign: 'left', fontWeight: 600 }}>{QM_MFULL[m] || m}
                      <span style={{ color: 'var(--faint)', fontWeight: 400, fontSize: 9.5, marginLeft: 5 }}>{QM_MQ[m]}</span></td>
                    {isFormula && <td style={{ padding: 3 }}><input style={NUM} type="number" title={numHead} value={(ind.mNum && ind.mNum[m] != null) ? ind.mNum[m] : ''} onChange={e => patch({ mNum: { [m]: qmNum(e.target.value) } })} placeholder="—" /></td>}
                    {needsDen && <td style={{ padding: 3 }}><input style={NUM} type="number" title={denHead} value={(ind.mDen && ind.mDen[m] != null) ? ind.mDen[m] : ''} onChange={e => patch({ mDen: { [m]: qmNum(e.target.value) } })} placeholder="—" /></td>}
                    <td style={{ padding: 3 }}>
                      {isFormula
                        ? <span title="Computed from numerator ÷ denominator" style={{ display: 'block', textAlign: 'right', fontFamily: 'IBM Plex Mono', fontWeight: 600, color: 'var(--blue-700)' }}>{val == null ? '—' : val}</span>
                        : <input style={NUM} type="number" value={(ind.months && ind.months[m] != null) ? ind.months[m] : ''} onChange={e => patch({ months: { [m]: qmNum(e.target.value) } })} placeholder="—" />}
                    </td>
                    <td style={{ textAlign: 'left' }}><span className="chip" style={{ background: tone + '1c', color: tone }}>{s === 'ok' ? 'On benchmark' : s === 'breach' ? 'Breach' : 'n/r'}</span></td>
                    <td style={{ padding: 3 }}><input style={TXTL} value={(ind.monthRemarks && ind.monthRemarks[m]) || ''} onChange={e => patch({ monthRemarks: { [m]: e.target.value } })} placeholder="optional note" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <QmQuarterRollup ind={ind} />
      </div>
    );
  }

  // Read-only quarter rollup line — keeps existing quarterly data visible and shows
  // how the months aggregate (the Quarterly Report still reads these).
  function QmQuarterRollup({ ind }) {
    const any = QM_QS.some(q => ind.quarters && ind.quarters[q] != null && ind.quarters[q] !== '');
    if (!any) return null;
    return (
      <div style={{ fontSize: 10.5, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '2px 2px 0' }}>
        <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>Quarter rollup</span>
        {QM_QS.map(q => {
          const v = ind.quarters ? ind.quarters[q] : null;
          return <span key={q} style={{ fontFamily: 'IBM Plex Mono' }}>{((typeof QSHORT !== 'undefined' && QSHORT[q]) || q)} <b style={{ color: 'var(--ink)' }}>{v == null || v === '' ? '—' : v}</b></span>;
        })}
        <span style={{ color: 'var(--faint)' }}>· auto-summed from months; feeds the Quarterly Report</span>
      </div>
    );
  }

  /* ---------------- collapsible section ---------------- */
  function QmSection({ title, sub, open, onToggle, children }) {
    return (
      <div style={{ border: '1px solid var(--line-2)', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
        <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 13px', cursor: 'pointer', background: open ? 'var(--blue-50)' : 'var(--panel-2)' }}>
          <Ic d={I.chevR} s={14} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s', color: 'var(--faint)' }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{title}</div>
            {sub && <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{sub}</div>}
          </div>
        </div>
        {open && <div style={{ padding: '12px 14px' }}>{children}</div>}
      </div>
    );
  }

  /* ---------------- full-field editor for one indicator ---------------- */
  function QmEditor({ deptKey, dept, ind, depts, Q, onRemove, onClone, onMove, onCopy }) {
    const [sec, setSec] = useState('identity');
    const toggle = (k) => setSec(s => (s === k ? '' : k));
    const patch = (p) => Q.patchIndicator(deptKey, ind.id, p);
    // Change how the indicator is measured. The previously-entered numbers live in
    // value buckets (quarters / qNum / qDen / mNum / mDen / months) and the store
    // recomputes from whichever bucket the active formula uses — so we DON'T rewrite
    // those buckets (rewriting would fabricate a denominator or drop the real
    // numerator ÷ denominator, and would miss quarter-only data entirely). We change
    // only the `formula` and warn, because the same numbers are now interpreted under
    // the new measurement (re-check the benchmark / numerator / denominator).
    const changeFormula = async (newF) => {
      const oldF = qmFormulaOf(ind);
      if (!newF || newF === oldF) return;
      const lab = (ff) => (QM_FORMULAS.find(x => x[0] === ff) || [])[1] || ff;
      if (qmHasData(ind)) {
        const ok = await qmConfirm({
          title: 'Change how this is measured?',
          message: `Switching from “${lab(oldF)}” to “${lab(newF)}” keeps the values you already entered, but they are now interpreted and benchmarked under the new measurement — re-check the benchmark and, for rate / percentage, the numerator ÷ denominator.`,
          confirmLabel: 'Change measurement',
        }, 'Change measurement type? Existing values are kept but re-interpreted under the new formula.');
        if (!ok) return;
      }
      patch({ formula: newF });
      qmToast('Measurement type changed');
    };
    const f = qmFormulaOf(ind);
    const isFormula = f !== 'direct';
    const needsDen = qmNeedsDen(ind);
    const measure = qmMeasure(ind);
    const measureTone = { Rate: '#6a52d4', Count: '#0090ca', Percentage: '#3ab5a7' }[measure] || '#0090ca';
    const dirTone = ind.goalDirection === 'higher_is_better' ? '#0090ca' : '#1f9d57';

    const [copyOpen, setCopyOpen] = useState(false);
    const [copyTargets, setCopyTargets] = useState({});
    const otherDepts = (depts || []).filter(d => d.key !== deptKey);
    const doCopy = () => {
      const keys = Object.keys(copyTargets).filter(k => copyTargets[k]);
      if (!keys.length) return;
      onCopy(keys);
      setCopyOpen(false); setCopyTargets({});
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* header summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
          <span className="chip" style={{ background: measureTone + '1c', color: measureTone }}>{measure}</span>
          <span className="chip" style={{ background: dirTone + '1c', color: dirTone }} title="Goal direction">{ind.goalDirection === 'higher_is_better' ? '↑ higher' : '↓ lower'}</span>
          <span className="chip" onClick={() => setSec('target')} title="Set benchmark"
            style={{ cursor: 'pointer', background: qmBenchExpr(ind) ? 'var(--blue-50)' : '#fdeaec', color: qmBenchExpr(ind) ? 'var(--blue-700)' : 'var(--rose)' }}>
            <Ic d={I.filter} s={11} /> {qmBenchExpr(ind) ? 'Benchmark ' + qmBenchExpr(ind) : 'Set benchmark'}
          </span>
          <span className="tag">{qmUnit(ind) || '—'}</span>
          {qmHasData(ind) && <span className="chip" style={{ background: 'var(--blue-50)', color: 'var(--blue-700)' }}>● has data</span>}
          <span className="spacer" style={{ flex: 1 }} />
          <button className="btn sm" onClick={onClone} title="Duplicate this indicator in this department"><Ic d={I.plus} s={13} />Clone</button>
          <button className="btn sm" onClick={() => setCopyOpen(o => !o)} title="Copy to other departments" disabled={!otherDepts.length}><Ic d={I.layers} s={13} />Copy to…</button>
          <button className="icon-btn danger" style={{ width: 30, height: 30 }} title="Delete indicator" onClick={onRemove}><Ic d={I.x} s={14} /></button>
        </div>

        {copyOpen && (
          <div style={{ border: '1px solid var(--blue-100)', borderRadius: 9, background: 'var(--blue-50)', padding: '11px 13px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Copy “{ind.name || 'indicator'}” (with its values) to:</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 6 }}>
              {otherDepts.map(d => (
                <label key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, background: '#fff', border: '1px solid var(--line)', borderRadius: 7, padding: '6px 9px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!copyTargets[d.key]} onChange={e => setCopyTargets(s => ({ ...s, [d.key]: e.target.checked }))} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
              <button className="btn pri sm" onClick={doCopy} disabled={!Object.values(copyTargets).some(Boolean)}><Ic d={I.check} s={13} />Copy</button>
              <button className="btn sm" onClick={() => { setCopyOpen(false); setCopyTargets({}); }}>Cancel</button>
            </div>
          </div>
        )}

        {/* formula banner */}
        <div style={{ background: 'var(--blue-50)', border: '1px solid var(--blue-100)', borderRadius: 9, padding: '10px 13px', fontSize: 12.5, color: 'var(--blue-700)', fontFamily: 'IBM Plex Mono' }}>
          ƒ {qmFormulaText(ind)}
        </div>

        {/* 1) Identity */}
        <QmSection title="Identity" sub="name · clinical category · reference standard · frequency · remark" open={sec === 'identity'} onToggle={() => toggle('identity')}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 11 }}>
            <QmField label="Indicator name" span><input style={TXTL} value={ind.name || ''} onChange={e => patch({ name: e.target.value })} placeholder="e.g. CAUTI Rate" /></QmField>
            <QmField label="Clinical category">
              <select style={TXTL} value={QM_CATEGORIES.includes(ind.category) ? ind.category : ''} onChange={e => patch({ category: e.target.value })}>
                <option value="">{ind.category ? ind.category : `— auto: ${qmCategory(ind)} —`}</option>
                {QM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </QmField>
            <QmField label="Reporting frequency">
              <select style={TXTL} value={QM_FREQ.includes(ind.frequency) ? ind.frequency : 'Monthly'} onChange={e => patch({ frequency: e.target.value })}>{QM_FREQ.map(x => <option key={x}>{x}</option>)}</select>
            </QmField>
            <QmField label="Reference / standard" hint="WHO · CDC NHSN · NABH · KDOQI…" span><input style={TXTL} value={ind.reference || ''} onChange={e => patch({ reference: e.target.value })} placeholder="e.g. CDC NHSN CAUTI definition" /></QmField>
            <QmField label="Overall remark" hint="shown on the report" span><textarea style={AREA} value={ind.remarks || ''} onChange={e => patch({ remarks: e.target.value })} placeholder="optional summary note for this indicator" /></QmField>
          </div>
        </QmSection>

        {/* 2) Measurement */}
        <QmSection title="Measurement" sub="formula · numerator & denominator · value type · unit" open={sec === 'measure'} onToggle={() => toggle('measure')}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 11 }}>
            <QmField label="How is this measured?" span>
              <select style={TXTL} value={f} onChange={e => changeFormula(e.target.value)}>{QM_FORMULAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </QmField>
            {/* live formula actually used to calculate the value */}
            <div style={{ gridColumn: '1 / -1', background: 'var(--blue-50)', border: '1px solid var(--blue-100)', borderRadius: 8, padding: '10px 13px' }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .4, fontWeight: 700, marginBottom: 4 }}>Formula used to calculate the value</div>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 13.5, color: 'var(--blue-700)', fontWeight: 700, wordBreak: 'break-word' }}>ƒ&nbsp; {qmFormulaText(ind)}</div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 5 }}>{QM_FORMULA_HINT[f] || ''}</div>
            </div>
            {isFormula && <QmField label="Numerator label"><input style={TXTL} value={ind.numLabel || ''} onChange={e => patch({ numLabel: e.target.value })} placeholder="e.g. CAUTI cases" /></QmField>}
            {needsDen && <QmField label="Denominator label"><input style={TXTL} value={ind.denLabel || ''} onChange={e => patch({ denLabel: e.target.value })} placeholder="e.g. Catheter days" /></QmField>}
            {!isFormula && <QmField label="Value type">
              <select style={TXTL} value={QM_VALTYPES.includes(ind.valueType) ? ind.valueType : 'Count'} onChange={e => patch({ valueType: e.target.value })}>{QM_VALTYPES.map(t => <option key={t}>{t}</option>)}</select>
            </QmField>}
            <QmField label="Unit" hint="display label"><input style={TXTL} value={ind.unit || ''} onChange={e => patch({ unit: e.target.value })} placeholder="e.g. per 1000 cath-days · % · count" /></QmField>
            {isFormula && <QmField label="Numerator definition" hint="what counts" span><textarea style={AREA} value={ind.numeratorDef || ''} onChange={e => patch({ numeratorDef: e.target.value })} placeholder="Precise definition of the numerator" /></QmField>}
            {needsDen && <QmField label="Denominator definition" hint="what counts" span><textarea style={AREA} value={ind.denominatorDef || ''} onChange={e => patch({ denominatorDef: e.target.value })} placeholder="Precise definition of the denominator" /></QmField>}
          </div>
        </QmSection>

        {/* 3) Target & benchmark */}
        <QmSection title="Target & benchmark" sub="set the benchmark — goal direction · benchmark value · benchmark description" open={sec === 'target'} onToggle={() => toggle('target')}>
          {/* live preview of the resulting benchmark + what it does */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: 'var(--panel-2)', border: '1px solid var(--line-2)', borderRadius: 9, padding: '9px 12px', marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .4, fontWeight: 700 }}>Benchmark</span>
            {qmBenchExpr(ind)
              ? <span className="chip" style={{ background: 'var(--blue-50)', color: 'var(--blue-700)', fontSize: 13, fontWeight: 700 }}>{qmBenchExpr(ind)}</span>
              : <span style={{ fontSize: 12, color: 'var(--rose)' }}>not set — type a value below so breaches can be flagged</span>}
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{ind.goalDirection === 'higher_is_better' ? 'values at or above this are on benchmark' : 'values at or below this are on benchmark'}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 11 }}>
            <QmField label="Goal direction" hint="which way is good?">
              <select style={TXTL} value={ind.goalDirection || 'lower_is_better'} onChange={e => patch({ goalDirection: e.target.value })}>{QM_DIRS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </QmField>
            <QmField label="Benchmark value" hint="numeric — drives status">
              <input style={NUM} type="number" value={ind.benchmarkValue ?? ''} onChange={e => patch({ benchmarkValue: e.target.value === '' ? null : Number(e.target.value) })} placeholder="e.g. 0 or 90" />
            </QmField>
            <QmField label="Benchmark description" hint="free text shown on reports" span>
              <div style={{ display: 'flex', gap: 7 }}>
                <input style={TXTL} value={ind.benchmark || ''} onChange={e => patch({ benchmark: e.target.value })} placeholder="e.g. 0 (zero defect) · ≥ 90% of moments" />
                <button className="btn sm" style={{ whiteSpace: 'nowrap' }} title="Fill the description from the value, direction & unit"
                  disabled={ind.benchmarkValue == null || ind.benchmarkValue === ''}
                  onClick={() => patch({ benchmark: qmBenchExpr(ind) || '' })}><Ic d={I.check} s={13} />Auto-fill</button>
              </div>
            </QmField>
          </div>
        </QmSection>

        {/* 4) Values */}
        <QmSection title="Values" sub="month-wise entry (12 months) + per-month remark · quarters roll up automatically" open={sec === 'values'} onToggle={() => toggle('values')}>
          <QmValueGrid deptKey={deptKey} ind={ind} Q={Q} />
        </QmSection>

        {/* 5) Location / danger */}
        <QmSection title="Location & danger zone" sub="move to another department · delete" open={sec === 'danger'} onToggle={() => toggle('danger')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            <QmField label="Department" hint="move this indicator">
              <select style={{ ...TXTL, minWidth: 200 }} value={deptKey} onChange={e => { if (e.target.value !== deptKey) onMove(e.target.value); }}>
                {(depts || []).map(d => <option key={d.key} value={d.key}>{d.name}</option>)}
              </select>
            </QmField>
            <span className="spacer" style={{ flex: 1 }} />
            <button className="btn sm" style={{ color: 'var(--rose)', borderColor: '#f1c6cd' }} onClick={onRemove}><Ic d={I.x} s={13} />Delete indicator</button>
          </div>
        </QmSection>
      </div>
    );
  }

  /* ---------------- create-new panel ---------------- */
  function QmCreate({ depts, defaultDept, onCreate, onClose }) {
    const [src, setSrc] = useState('blank');       // blank | library | clone
    const [libKey, setLibKey] = useState('');
    const [cloneDept, setCloneDept] = useState(defaultDept || (depts[0] && depts[0].key) || '');
    const [cloneInd, setCloneInd] = useState('');
    const [name, setName] = useState('');
    const [targets, setTargets] = useState(() => (defaultDept ? { [defaultDept]: true } : {}));
    const lib = useMemo(() => qmLibrary(), []);
    const cloneSrcDept = depts.find(d => d.key === cloneDept);
    const cloneInds = (cloneSrcDept && cloneSrcDept.indicators) || [];

    useEffect(() => { if (src === 'library' && !libKey && lib[0]) setLibKey(lib[0].key); }, [src]); // eslint-disable-line
    useEffect(() => { if (src === 'clone' && !cloneInd && cloneInds[0]) setCloneInd(cloneInds[0].id); }, [src, cloneDept]); // eslint-disable-line

    const targetKeys = Object.keys(targets).filter(k => targets[k]);
    const baseName = () => {
      if (name.trim()) return name.trim();
      if (src === 'library') { const it = lib.find(l => l.key === libKey); return it ? it.name : ''; }
      if (src === 'clone') { const ci = cloneInds.find(i => i.id === cloneInd); return ci ? (ci.name + ' (copy)') : ''; }
      return '';
    };
    const buildShape = () => {
      const nm = baseName();
      if (src === 'library') { const it = lib.find(l => l.key === libKey); return Object.assign({}, it ? it.shape : qmBlankShape(nm), { name: nm }); }
      if (src === 'clone') { const ci = cloneInds.find(i => i.id === cloneInd); return ci ? qmCloneShape(ci, nm) : qmBlankShape(nm); }
      return qmBlankShape(nm);
    };
    const canCreate = !!baseName() && targetKeys.length > 0;
    const create = () => { if (canCreate) onCreate(buildShape(), targetKeys); };

    const radio = (val, label, hint) => (
      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '9px 11px', border: '1px solid ' + (src === val ? 'var(--blue)' : 'var(--line)'), background: src === val ? 'var(--blue-50)' : '#fff', borderRadius: 9, cursor: 'pointer', flex: 1, minWidth: 160 }}>
        <input type="radio" name="qm-src" checked={src === val} onChange={() => setSrc(val)} style={{ marginTop: 2 }} />
        <div><div style={{ fontSize: 12.5, fontWeight: 600 }}>{label}</div><div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{hint}</div></div>
      </label>
    );

    return (
      <div className="card" style={{ overflow: 'hidden', border: '1px solid var(--blue-100)' }}>
        <div className="card-h"><h3>New indicator</h3><span className="sub">create blank, from the standard library, or by cloning an existing one</span><span className="spacer" />
          <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={onClose}><Ic d={I.x} s={14} /></button></div>
        <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            {radio('blank', 'Blank', 'start from an empty count indicator')}
            {radio('library', 'Standard library', 'NABH / WHO formula presets')}
            {radio('clone', 'Clone existing', 'copy another indicator + its values')}
          </div>

          {src === 'library' && (
            <QmField label="Standard indicator">
              <select style={TXTL} value={libKey} onChange={e => setLibKey(e.target.value)}>{lib.map(it => <option key={it.key} value={it.key}>{it.name}</option>)}</select>
            </QmField>
          )}
          {src === 'clone' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
              <QmField label="From department"><select style={TXTL} value={cloneDept} onChange={e => { setCloneDept(e.target.value); setCloneInd(''); }}>{depts.map(d => <option key={d.key} value={d.key}>{d.name}</option>)}</select></QmField>
              <QmField label="Indicator to clone"><select style={TXTL} value={cloneInd} onChange={e => setCloneInd(e.target.value)}>{cloneInds.length === 0 && <option value="">— none —</option>}{cloneInds.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></QmField>
            </div>
          )}

          <QmField label="Name" hint={src !== 'blank' ? 'leave blank to keep the source name' : 'required'}>
            <input style={TXTL} value={name} onChange={e => setName(e.target.value)} placeholder={baseName() || 'Indicator name'} />
          </QmField>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .4 }}>Add to department(s) <span style={{ color: 'var(--faint)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>· tick one or many for bulk-add</span></label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 6, marginTop: 7 }}>
              {depts.map(d => (
                <label key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, background: targets[d.key] ? 'var(--blue-50)' : '#fff', border: '1px solid ' + (targets[d.key] ? 'var(--blue-100)' : 'var(--line)'), borderRadius: 7, padding: '6px 9px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!targets[d.key]} onChange={e => setTargets(s => ({ ...s, [d.key]: e.target.checked }))} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 9 }}>
            <button className="btn pri" onClick={create} disabled={!canCreate} style={{ opacity: canCreate ? 1 : .5 }}><Ic d={I.plus} s={15} />Create{targetKeys.length > 1 ? ` in ${targetKeys.length} departments` : ''}</button>
            <button className="btn" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- main screen ---------------- */
  function QualityManageIndicators({ setRoute }) {
    const Q = window.useQualityStore();
    const depts = Q.depts || [];
    const [scope, setScope] = useState('all');     // 'all' | dept.key
    const [q, setQ] = useState('');
    const [measureF, setMeasureF] = useState('all');
    const [dirF, setDirF] = useState('all');
    const [sel, setSel] = useState(null);          // {deptKey, id}
    const [creating, setCreating] = useState(false);
    const [expanded, setExpanded] = useState(() => new Set()); // expanded common-indicator names

    const scopeDepts = scope === 'all' ? depts : depts.filter(d => d.key === scope);

    // flat list of {dept, ind} over the scope
    const rows = useMemo(() => {
      const out = [];
      scopeDepts.forEach(d => (d.indicators || []).forEach(ind => out.push({ dept: d, ind })));
      return out;
    }, [depts, scope]);

    const ql = q.trim().toLowerCase();
    const filtered = rows.filter(({ ind }) => {
      if (measureF !== 'all' && qmMeasure(ind) !== measureF) return false;
      if (dirF !== 'all' && (ind.goalDirection || 'lower_is_better') !== dirF) return false;
      if (!ql) return true;
      return (ind.name || '').toLowerCase().includes(ql)
        || qmCategory(ind).toLowerCase().includes(ql)
        || (ind.numLabel || '').toLowerCase().includes(ql)
        || (ind.reference || '').toLowerCase().includes(ql)
        || (ind.unit || '').toLowerCase().includes(ql);
    });

    // Organize the list into a COMMON section (indicators shared across ≥2 of the
    // in-scope departments, grouped by indicator name) followed by DEPARTMENT-SPECIFIC
    // sections (each department's non-shared indicators only). With a single
    // department in scope nothing is "common", so it all lists under that department.
    const showCommon = scope === 'all' && scopeDepts.length > 1;
    const byName = new Map(); // normName -> { name, items:[{dept,ind}] }
    filtered.forEach(({ dept, ind }) => {
      const nn = qmNorm(ind.name) || ('id:' + ind.id);
      if (!byName.has(nn)) byName.set(nn, { name: ind.name || 'Untitled', items: [] });
      byName.get(nn).items.push({ dept, ind });
    });
    const sharedNames = new Set();
    const commonGroups = [];
    if (showCommon) {
      byName.forEach((v, nn) => {
        const deptKeys = new Set(v.items.map(it => it.dept.key));
        if (deptKeys.size >= 2) { commonGroups.push({ nn, name: v.name, items: v.items, deptCount: deptKeys.size }); sharedNames.add(nn); }
      });
      commonGroups.sort((a, b) => b.deptCount - a.deptCount || a.name.localeCompare(b.name));
    }
    // department-specific groups = indicators NOT pulled into the common section
    const dg = {};
    filtered.forEach(({ dept, ind }) => {
      if (showCommon && sharedNames.has(qmNorm(ind.name) || ('id:' + ind.id))) return;
      (dg[dept.key] = dg[dept.key] || { dept, inds: [] }).inds.push(ind);
    });
    // keep an EDITED department reachable (for its "reset") even if all its indicators are shared
    if (showCommon) scopeDepts.forEach(d => { if (Q.isEdited(d.key) && !dg[d.key]) dg[d.key] = { dept: d, inds: [] }; });
    const deptGroups = Object.keys(dg).map(k => dg[k]).sort((a, b) => a.dept.name.localeCompare(b.dept.name));

    // KPIs over scope
    let nBreach = 0, nData = 0;
    rows.forEach(({ ind }) => {
      if (qmHasData(ind)) nData++;
      QM_QS.forEach(qq => { if ((typeof indStatus === 'function') && indStatus(ind, qq) === 'breach') nBreach++; });
    });

    // resolve the selected (dept, indicator) freshly from the store each render
    const selDept = sel && depts.find(d => d.key === sel.deptKey);
    const selInd = selDept && (selDept.indicators || []).find(i => i.id === sel.id);
    // if the selection vanished (deleted / scope change), drop it. Gate on a stable
    // boolean — selInd is a fresh .find() each render, so depending on it directly
    // would re-fire this effect on every keystroke while an indicator is selected.
    const selPresent = !!selInd;
    useEffect(() => { if (sel && !selPresent) setSel(null); }, [selPresent, sel]);

    const pick = (deptKey, id) => { setCreating(false); setSel({ deptKey, id }); };

    const onCreate = (shape, targetKeys) => {
      let firstId = null, firstKey = null;
      targetKeys.forEach(k => {
        // deep-copy per target so departments never share nested value objects
        const fresh = qmCloneShape(shape, shape.name);
        if (!firstId) { firstId = fresh.id; firstKey = k; }
        Q.addIndicator(k, fresh);
      });
      qmToast(`Created “${shape.name}”${targetKeys.length > 1 ? ` in ${targetKeys.length} departments` : ''}`);
      setCreating(false);
      if (firstId) { if (scope !== 'all' && scope !== firstKey) setScope(firstKey); setSel({ deptKey: firstKey, id: firstId }); }
    };

    const onClone = () => {
      if (!selInd || !selDept) return;
      const shape = qmCloneShape(selInd, (selInd.name || 'Indicator') + ' (copy)');
      Q.addIndicator(selDept.key, shape);
      qmToast(`Cloned “${selInd.name}”`);
      setSel({ deptKey: selDept.key, id: shape.id });
    };

    const onCopy = (targetKeys) => {
      if (!selInd) return;
      targetKeys.forEach(k => Q.addIndicator(k, qmCloneShape(selInd, selInd.name)));
      qmToast(`Copied “${selInd.name}” to ${targetKeys.length} department(s)`);
    };

    const onMove = async (newKey) => {
      if (!selInd || !selDept || newKey === selDept.key) return;
      const target = depts.find(d => d.key === newKey);
      const ok = await qmConfirm({
        title: 'Move indicator?',
        message: `Move “${selInd.name || 'indicator'}” (with its values) from ${selDept.name} to ${target ? target.name : 'another department'}? It will be removed from ${selDept.name}.`,
        confirmLabel: 'Move',
      }, `Move "${selInd.name}" to ${target ? target.name : 'another department'}?`);
      if (!ok) return;
      const shape = qmCloneShape(selInd, selInd.name);
      Q.addIndicator(newKey, shape);
      Q.removeIndicator(selDept.key, selInd.id);
      qmToast(`Moved “${selInd.name}” to ${target ? target.name : 'department'}`);
      setSel({ deptKey: newKey, id: shape.id });
    };

    const onRemove = async () => {
      if (!selInd || !selDept) return;
      const ok = await qmConfirm({
        title: 'Delete this indicator?',
        message: `Removes “${selInd.name || 'indicator'}”${qmHasData(selInd) ? ' and its saved values' : ''} from ${selDept.name}.` + ' For built-in indicators this is undone by "Reset department to original".',
        danger: true, confirmLabel: 'Delete',
      }, `Delete "${selInd.name}" from ${selDept.name}?`);
      if (!ok) return;
      Q.removeIndicator(selDept.key, selInd.id);
      qmToast('Indicator deleted');
      setSel(null);
    };

    const resetDept = async (d) => {
      const ok = await qmConfirm({
        title: `Reset ${d.name} to original?`,
        message: 'Discards ALL your edits for this department and restores the built-in quality data (indicators, values & summary).',
        danger: true, confirmLabel: 'Reset',
      }, `Reset ${d.name} to original? All edits for it are discarded.`);
      if (!ok) return;
      Q.resetDept(d.key);
      qmToast(`${d.name} reset to original`);
      if (sel && sel.deptKey === d.key) setSel(null);
    };

    const measureTone = { Rate: '#6a52d4', Count: '#0090ca', Percentage: '#3ab5a7' };
    const toggleExp = (nn) => setExpanded(s => { const n = new Set(s); n.has(nn) ? n.delete(nn) : n.add(nn); return n; });
    // One selectable indicator row. `sub` = nested under a Common group (shows the
    // department name as the primary label, since the indicator name is the header).
    const renderIndRow = (dept, ind, sub) => {
      const on = sel && sel.deptKey === dept.key && sel.id === ind.id;
      const measure = qmMeasure(ind);
      let breaches = 0; QM_QS.forEach(qq => { if ((typeof indStatus === 'function') && indStatus(ind, qq) === 'breach') breaches++; });
      return (
        <div key={dept.key + '/' + ind.id} onClick={() => pick(dept.key, ind.id)}
          style={{ display: 'flex', alignItems: 'center', gap: 9, padding: sub ? '8px 14px 8px 32px' : '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--line-2)', background: on ? 'var(--blue-50)' : 'transparent', borderLeft: '3px solid ' + (on ? 'var(--blue)' : 'transparent') }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub ? dept.name : (ind.name || <span style={{ color: 'var(--faint)', fontStyle: 'italic' }}>Untitled</span>)}</div>
            <div style={{ fontSize: 10, color: 'var(--faint)', fontFamily: 'IBM Plex Mono', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{qmUnit(ind) || measure}</div>
          </div>
          {qmHasData(ind) && <span title="has saved data" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--blue)', flexShrink: 0 }} />}
          <span className="chip" style={{ flexShrink: 0, background: (measureTone[measure] || '#0090ca') + '1c', color: measureTone[measure] || '#0090ca', fontSize: 10 }}>{measure[0]}</span>
          {breaches > 0 && <span className="chip" style={{ flexShrink: 0, background: 'var(--neg-bg)', color: 'var(--neg)', fontSize: 10 }} title={`${breaches} quarter breach(es)`}>{breaches}!</span>}
        </div>
      );
    };

    const Kpi = ({ label, val, foot, color }) => (
      <div className="card anim-pop" style={{ padding: '15px 18px', borderLeft: `4px solid ${color}`, display: 'flex', flexDirection: 'column', minHeight: 96 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>{label}</div>
        <div className="num" style={{ fontSize: 28, fontWeight: 700, color, margin: '6px 0 0', lineHeight: 1 }}>{val}</div>
        {foot && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{foot}</div>}
      </div>
    );

    return (
      <div className="grid" style={{ gap: 16 }}>
        <SectionTitle icon={I.edit} title="Manage Indicators"
          sub="Master editor — create, edit every field, clone, copy across departments, move & delete quality indicators. Changes flow to the Dashboard, Entry, Reports & CAPA and save automatically."
          right={<>
            <button className="btn sm" onClick={() => setRoute && setRoute({ view: 'qualityAssign' })}><Ic d={I.grid} s={15} />Assign by Dept</button>
            <button className="btn sm" onClick={() => setRoute && setRoute({ view: 'qualityCatalog' })}><Ic d={I.doc} s={15} />Catalog</button>
            <button className="btn pri sm" onClick={() => { setCreating(true); setSel(null); }}><Ic d={I.plus} s={15} />New indicator</button>
          </>} />

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
          <Kpi label={scope === 'all' ? 'Departments' : 'Department'} val={scope === 'all' ? qmFmt(depts.length) : ((depts.find(d => d.key === scope) || {}).name || '—')} foot={scope === 'all' ? 'in the quality dataset' : 'in scope'} color="#0090ca" />
          <Kpi label="Indicators" val={qmFmt(rows.length)} foot="in the current scope" color="#6a52d4" />
          <Kpi label="With data" val={qmFmt(nData)} foot="hold ≥ 1 saved value" color="#1f9d57" />
          <Kpi label="Breaches" val={qmFmt(nBreach)} foot="indicator-quarters off benchmark" color={nBreach > 0 ? '#d23a52' : '#1f9d57'} />
        </div>

        {/* toolbar */}
        <div className="card" style={{ padding: '12px 14px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={scope} onChange={e => { setScope(e.target.value); }} style={{ ...SEL, width: 'auto', minWidth: 190, fontWeight: 600 }}>
            <option value="all">All departments</option>
            {depts.map(d => <option key={d.key} value={d.key}>{d.name} · {(d.indicators || []).length}</option>)}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '7px 11px', flex: 1, minWidth: 200, color: 'var(--faint)' }}>
            <Ic d={I.search} s={15} />
            <input placeholder="Search name, category, reference, numerator…" value={q} onChange={e => setQ(e.target.value)} style={{ border: 0, background: 'transparent', outline: 'none', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)', width: '100%' }} />
          </div>
          <select value={measureF} onChange={e => setMeasureF(e.target.value)} style={{ ...SEL, width: 'auto' }} title="Filter by measure type">
            <option value="all">All types</option><option>Count</option><option>Rate</option><option>Percentage</option>
          </select>
          <select value={dirF} onChange={e => setDirF(e.target.value)} style={{ ...SEL, width: 'auto' }} title="Filter by goal direction">
            <option value="all">Any goal</option><option value="lower_is_better">↓ Lower is better</option><option value="higher_is_better">↑ Higher is better</option>
          </select>
          <span style={{ fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{filtered.length} of {rows.length}</span>
        </div>

        {creating && <QmCreate key={scope} depts={depts} defaultDept={scope === 'all' ? null : scope} onCreate={onCreate} onClose={() => setCreating(false)} />}

        {/* master / detail */}
        <div className="grid qm-split" style={{ gridTemplateColumns: '340px 1fr', alignItems: 'start', gap: 16 }}>
          {/* list */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="card-h"><h3>Indicators</h3><span className="spacer" /><span className="tag num">{filtered.length}</span></div>
            <div style={{ maxHeight: 620, overflowY: 'auto' }}>
              {filtered.length === 0 && <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>No indicators match. {rows.length === 0 ? 'Create one to get started.' : 'Adjust your filters.'}</div>}

              {/* COMMON — indicators shared across departments, grouped by name */}
              {showCommon && commonGroups.length > 0 && (
                <React.Fragment>
                  <div style={{ ...QM_GRP_H, background: 'var(--blue-50)' }}>
                    <Ic d={I.layers} s={13} c="var(--blue)" />
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--blue-700)', letterSpacing: .3 }}>COMMON</span>
                    <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>· shared across departments · click to expand</span>
                    <span className="spacer" style={{ flex: 1 }} /><span className="tag num">{commonGroups.length}</span>
                  </div>
                  {commonGroups.map(cg => {
                    const isExp = expanded.has(cg.nn);
                    const here = sel && cg.items.some(it => it.dept.key === sel.deptKey && it.ind.id === sel.id);
                    const measure = qmMeasure(cg.items[0].ind);
                    return (
                      <div key={'c:' + cg.nn}>
                        <div onClick={() => toggleExp(cg.nn)}
                          style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--line-2)', background: here ? 'var(--blue-50)' : 'transparent' }}>
                          <Ic d={I.chevR} s={13} style={{ transform: isExp ? 'rotate(90deg)' : 'none', transition: 'transform .15s', color: 'var(--faint)', flexShrink: 0 }} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cg.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--faint)' }}>in {cg.deptCount} departments{here ? ' · editing one' : ''}</div>
                          </div>
                          <span className="chip" style={{ flexShrink: 0, background: (measureTone[measure] || '#0090ca') + '1c', color: measureTone[measure] || '#0090ca', fontSize: 10 }}>{measure[0]}</span>
                          <span className="tag num" style={{ flexShrink: 0 }}>{cg.deptCount}</span>
                        </div>
                        {isExp && cg.items.slice().sort((a, b) => a.dept.name.localeCompare(b.dept.name)).map(({ dept, ind }) => renderIndRow(dept, ind, true))}
                      </div>
                    );
                  })}
                </React.Fragment>
              )}

              {/* DEPARTMENT-SPECIFIC — each department's non-shared indicators */}
              {showCommon && commonGroups.length > 0 && deptGroups.length > 0 && (
                <div style={QM_GRP_H}>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--ink-2)', letterSpacing: .3 }}>DEPARTMENT-SPECIFIC</span>
                  <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>· unique to one department</span>
                </div>
              )}
              {deptGroups.map(g => (
                <div key={g.dept.key}>
                  <div style={QM_GRP_H}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)' }}>{g.dept.name}</span>
                    <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>· {g.inds.length}</span>
                    <span className="spacer" style={{ flex: 1 }} />
                    {Q.isEdited(g.dept.key) && <span title="Reset this department to original" onClick={() => resetDept(g.dept)} style={{ cursor: 'pointer', fontSize: 10.5, color: 'var(--rose)', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Ic d={I.x} s={11} />reset</span>}
                  </div>
                  {g.inds.length === 0
                    ? <div style={{ padding: '10px 14px', fontSize: 11, color: 'var(--faint)' }}>All of this department's indicators are shared — see Common above.</div>
                    : g.inds.map(ind => renderIndRow(g.dept, ind, false))}
                </div>
              ))}
            </div>
          </div>

          {/* detail */}
          <div className="card" style={{ minHeight: 320 }}>
            {selInd && selDept ? (
              <>
                <div className="card-h" style={{ alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ whiteSpace: 'normal' }}>{selInd.name || 'Untitled indicator'}</h3>
                    <span className="sub">{selDept.name} · editing every field — saves automatically</span>
                  </div>
                  <span className="spacer" />
                  <button className="btn sm" onClick={() => setRoute && setRoute({ view: 'qualityDataEntry' })} title="Enter monthly values"><Ic d={I.input} s={14} />Quality Data Entry</button>
                </div>
                <div className="card-b">
                  <QmEditor key={selDept.key + '/' + selInd.id} deptKey={selDept.key} dept={selDept} ind={selInd} depts={depts} Q={Q}
                    onRemove={onRemove} onClone={onClone} onMove={onMove} onCopy={onCopy} />
                </div>
              </>
            ) : (
              <div className="card-b" style={{ display: 'grid', placeItems: 'center', minHeight: 300, textAlign: 'center' }}>
                <div>
                  <div style={{ width: 54, height: 54, borderRadius: 14, background: 'var(--blue-50)', color: 'var(--blue)', display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}><Ic d={I.edit} s={26} /></div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Select an indicator to edit</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', margin: '6px 0 14px', maxWidth: 360 }}>Pick one from the list to edit its name, formula, definitions, benchmark and values — or create a brand-new indicator.</div>
                  <button className="btn pri" onClick={() => { setCreating(true); setSel(null); }}><Ic d={I.plus} s={15} />New indicator</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--muted)', padding: '0 2px' }}>
          <Ic d={I.doc} s={13} /> Tip: rate/percentage indicators compute their value from numerator ÷ denominator — enter those per quarter or per month under <b style={{ color: 'var(--ink-2)' }}>Values</b>. Use <b style={{ color: 'var(--ink-2)' }}>Assign by Department</b> to toggle standard indicators across many departments at once.
        </div>
      </div>
    );
  }

  window.QualityManageIndicators = QualityManageIndicators;
})();
