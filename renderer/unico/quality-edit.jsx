/* UNICO — Quality department EDITOR.
   Per-department, editable: indicator catalogue (add custom / add from a standard
   library / remove), settable benchmark + goal direction + value type, FORMULA
   indicators (count / rate per 1000 / per 100 / %, with numerator & denominator
   entered per quarter and per month), direct quarterly values, per-quarter remarks,
   monthly drill-down, and the executive summary + sign-off. Writes to the editable
   overlay (quality-store.js) so the Quality dashboard, reports, CAPA and exports
   all reflect edits.

   Globals: React, I, Ic, SectionTitle, fmt, QS, QSHORT, QLABEL, indStatus,
   window.useQualityStore, window.QUALITY_QUARTER_MONTHS, window.qualityIsPct,
   window.qualitySlug, window.qiFormulaCompute, window.UI, QI_DEFS (library). */

const QED_STATUSES = ['Excellent', 'Very Good', 'Good', 'Satisfactory', 'Needs Improvement', 'Poor'];
const QED_VALTYPES = ['Count', '%', 'Rate'];
const QED_DIRS = [['lower_is_better', '↓ Lower is better'], ['higher_is_better', '↑ Higher is better']];
const QED_FORMULAS = [['direct', 'Direct value (type the value)'], ['count', 'Count of events'], ['rate1000', 'Rate per 1000'], ['rate100', 'Rate per 100'], ['pct', 'Percentage (%)']];
const QED_MFULL = { 'Aug-25': 'Aug 25', 'Sep-25': 'Sep 25', 'Oct-25': 'Oct 25', 'Nov-25': 'Nov 25', 'Dec-25': 'Dec 25', 'Jan-26': 'Jan 26', 'Feb-26': 'Feb 26', 'Mar-26': 'Mar 26', 'Apr-26': 'Apr 26', 'May-26': 'May 26' };

function qedNum(v) { return v === '' || v == null ? null : Number(v); }

// Standard indicator library, derived from QI_DEFS (the app's formula catalogue).
function qedLibrary() {
  const defs = (typeof QI_DEFS !== 'undefined' && Array.isArray(QI_DEFS)) ? QI_DEFS : [];
  return defs.map(def => {
    const formula = def.formula || 'count';
    const pct = formula === 'pct';
    return {
      id: window.qualitySlug(def.name),
      name: def.name,
      formula,
      numLabel: def.num || 'Numerator',
      denLabel: def.den || 'Denominator',
      valueType: pct ? '%' : (formula === 'count' ? 'Count' : 'Rate'),
      unit: def.unit || '',
      benchmark: `${def.dir === 'higher' ? '≥' : '≤'} ${def.benchmark}${pct ? '%' : ''}${def.unit ? ' ' + def.unit : ''}`,
      benchmarkValue: typeof def.benchmark === 'number' ? def.benchmark : '',
      goalDirection: def.dir === 'higher' ? 'higher_is_better' : 'lower_is_better',
      quarters: { Q1: null, Q2: null, Q3: null, Q4: null }, quarterRemarks: {}, qNum: {}, qDen: {}, remarks: '',
    };
  });
}

/* ---- one indicator's editable row ---- */
function QEdIndicator({ deptKey, ind, Q, onRemove }) {
  const [openCfg, setOpenCfg] = React.useState(false);
  const [openMonths, setOpenMonths] = React.useState(false);
  const QM = window.QUALITY_QUARTER_MONTHS;
  const patch = (p) => Q.patchIndicator(deptKey, ind.id, p);
  const formula = ind.formula || 'direct';
  const isFormula = formula !== 'direct';
  const needsDen = isFormula && formula !== 'count';

  const inp = { padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 6, fontFamily: 'IBM Plex Mono', fontSize: 12.5, width: '100%', textAlign: 'right', outline: 'none', background: '#fff' };
  const txt = { padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 6, fontFamily: 'inherit', fontSize: 12, width: '100%', outline: 'none', background: '#fff' };

  // does a quarter draw from monthly numerators?
  const monthsHaveData = (q) => (QM[q] || []).some(m => isFormula
    ? (ind.mNum && ind.mNum[m] != null && ind.mNum[m] !== '')
    : (ind.months && ind.months[m] != null && ind.months[m] !== ''));
  const monthCount = (q) => (QM[q] || []).filter(m => isFormula
    ? (ind.mNum && ind.mNum[m] != null && ind.mNum[m] !== '')
    : (ind.months && ind.months[m] != null && ind.months[m] !== '')).length;

  const numHead = ind.numLabel || 'Numerator';
  const denHead = ind.denLabel || 'Denominator';

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px', background: '#fff', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <input style={{ ...txt, flex: 1, minWidth: 200, fontWeight: 700, fontSize: 13, textAlign: 'left' }} value={ind.name || ''} onChange={e => patch({ name: e.target.value })} placeholder="Indicator name" />
        <span className="chip" style={{ background: 'var(--blue-50)', color: 'var(--blue-700)' }}>{isFormula ? (QED_FORMULAS.find(f => f[0] === formula) || [])[1] || formula : (ind.valueType || 'Count')}</span>
        <span className="tag" title="Goal direction">{ind.goalDirection === 'higher_is_better' ? '↑ higher' : '↓ lower'}</span>
        <button className="btn sm" onClick={() => setOpenCfg(o => !o)} title="Formula, benchmark & definition"><Ic d={I.gear} s={13} />{openCfg ? 'Hide' : 'Setup'}</button>
        <button className="icon-btn danger" style={{ width: 28, height: 28 }} title="Remove indicator" onClick={onRemove}><Ic d={I.x} s={14} /></button>
      </div>

      {/* config: formula / type / benchmark / direction */}
      {openCfg && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, background: 'var(--panel-2)', border: '1px solid var(--line-2)', borderRadius: 8, padding: '10px 12px' }}>
          <div className="field" style={{ gridColumn: '1 / -1' }}><label>How is this measured?</label>
            <select style={{ ...txt, textAlign: 'left' }} value={formula} onChange={e => patch({ formula: e.target.value })}>{QED_FORMULAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </div>
          {isFormula && <div className="field"><label>Numerator label</label><input style={{ ...txt, textAlign: 'left' }} value={ind.numLabel || ''} onChange={e => patch({ numLabel: e.target.value })} placeholder="e.g. CAUTI cases" /></div>}
          {needsDen && <div className="field"><label>Denominator label</label><input style={{ ...txt, textAlign: 'left' }} value={ind.denLabel || ''} onChange={e => patch({ denLabel: e.target.value })} placeholder="e.g. Catheter days" /></div>}
          {!isFormula && <div className="field"><label>Value type</label>
            <select style={{ ...txt, textAlign: 'left' }} value={QED_VALTYPES.includes(ind.valueType) ? ind.valueType : 'Count'} onChange={e => patch({ valueType: e.target.value })}>{QED_VALTYPES.map(t => <option key={t}>{t}</option>)}</select>
          </div>}
          <div className="field"><label>Goal direction</label>
            <select style={{ ...txt, textAlign: 'left' }} value={ind.goalDirection || 'lower_is_better'} onChange={e => patch({ goalDirection: e.target.value })}>{QED_DIRS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </div>
          <div className="field"><label>Benchmark value</label>
            <input style={inp} type="number" value={ind.benchmarkValue ?? ''} onChange={e => patch({ benchmarkValue: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="e.g. 0 or 90" />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}><label>Benchmark description</label>
            <input style={{ ...txt, textAlign: 'left' }} value={ind.benchmark || ''} onChange={e => patch({ benchmark: e.target.value })} placeholder="e.g. 0 (zero defect) · ≥90% of cases" />
          </div>
          {isFormula && <div style={{ gridColumn: '1 / -1', fontSize: 11, color: 'var(--blue-700)', fontFamily: 'IBM Plex Mono', background: 'var(--blue-50)', border: '1px solid var(--blue-100)', borderRadius: 7, padding: '7px 10px' }}>
            ƒ {formula === 'count' ? `value = ${numHead}` : `value = (${numHead} ÷ ${denHead}) × ${formula === 'rate1000' ? '1000' : '100'}`}
          </div>}
        </div>
      )}

      {/* quarter values */}
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl rpt" style={{ fontSize: 11.5 }}>
          <thead><tr><th style={{ textAlign: 'left', width: 80 }}>Quarter</th>
            {isFormula && <th style={{ width: 80 }}>{numHead}</th>}
            {needsDen && <th style={{ width: 80 }}>{denHead}</th>}
            <th style={{ width: 76 }}>Value</th><th style={{ textAlign: 'left' }}>Status</th><th style={{ textAlign: 'left' }}>Remark</th></tr></thead>
          <tbody>
            {QS.map(q => {
              const fromMonths = monthsHaveData(q);
              const v = ind.quarters ? ind.quarters[q] : null;
              const s = indStatus(ind, q);
              const tone = s === 'ok' ? '#1f9d57' : s === 'breach' ? '#d23a52' : '#9aa6b4';
              const qn = ind.qNum ? ind.qNum[q] : null, qd = ind.qDen ? ind.qDen[q] : null;
              return (
                <tr key={q}>
                  <td style={{ textAlign: 'left', fontWeight: 600 }}>{QSHORT[q]}</td>
                  {isFormula && <td style={{ padding: 3 }}>{fromMonths
                    ? <span style={{ display: 'block', textAlign: 'right', color: 'var(--faint)', fontSize: 9.5 }}>{monthCount(q)} mo</span>
                    : <input style={inp} type="number" value={qn ?? ''} onChange={e => patch({ qNum: { [q]: qedNum(e.target.value) } })} placeholder="—" />}</td>}
                  {needsDen && <td style={{ padding: 3 }}>{fromMonths
                    ? <span style={{ display: 'block', textAlign: 'right', color: 'var(--faint)', fontSize: 9.5 }}>·</span>
                    : <input style={inp} type="number" value={qd ?? ''} onChange={e => patch({ qDen: { [q]: qedNum(e.target.value) } })} placeholder="—" />}</td>}
                  <td style={{ padding: 3 }}>
                    {isFormula
                      ? <span title="Computed" style={{ display: 'block', textAlign: 'right', fontFamily: 'IBM Plex Mono', fontWeight: 600, color: 'var(--blue-700)' }}>{v == null ? '—' : v}</span>
                      : (fromMonths
                        ? <span title="From monthly values" style={{ display: 'block', textAlign: 'right', fontFamily: 'IBM Plex Mono', color: 'var(--blue-700)', fontWeight: 600 }}>{v == null ? '—' : v}<div style={{ fontSize: 8, color: 'var(--faint)', fontWeight: 400 }}>from {monthCount(q)} mo</div></span>
                        : <input style={inp} type="number" value={v ?? ''} onChange={e => patch({ quarters: { [q]: qedNum(e.target.value) } })} placeholder="—" />)}
                  </td>
                  <td style={{ textAlign: 'left' }}><span className="chip" style={{ background: tone + '1c', color: tone }}>{s === 'ok' ? 'On benchmark' : s === 'breach' ? 'Breach' : 'n/r'}</span></td>
                  <td style={{ padding: 3 }}><input style={{ ...txt, textAlign: 'left' }} value={(ind.quarterRemarks && ind.quarterRemarks[q]) || ''} onChange={e => patch({ quarterRemarks: { [q]: e.target.value } })} placeholder="optional note" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* monthly drill-down */}
      <div>
        <button className="btn sm" style={{ borderStyle: 'dashed' }} onClick={() => setOpenMonths(o => !o)}>
          <Ic d={I.cal} s={13} />{openMonths ? 'Hide monthly detail' : 'Monthly detail (optional)'}
        </button>
        {openMonths && (
          <div style={{ marginTop: 8, background: 'var(--panel-2)', border: '1px solid var(--line-2)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
              {isFormula ? `Enter ${numHead}${needsDen ? ' & ' + denHead : ''} per month — quarters aggregate from these (numerators${needsDen ? ' & denominators' : ''} summed, then the formula applied).`
                : 'Enter month values where you have them — the quarter totals (Count) or averages (%) from these.'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 8 }}>
              {QS.map(q => (QM[q] || []).map(m => (
                <div key={m} style={{ border: '1px solid var(--line-2)', borderRadius: 7, padding: '6px 7px', background: '#fff' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>{QED_MFULL[m] || m} <span style={{ color: 'var(--faint)' }}>· {QSHORT[q]}</span></div>
                  {isFormula
                    ? <div style={{ display: 'flex', gap: 4 }}>
                      <input style={{ ...inp, fontSize: 11.5 }} type="number" title={numHead} value={(ind.mNum && ind.mNum[m] != null) ? ind.mNum[m] : ''} onChange={e => patch({ mNum: { [m]: qedNum(e.target.value) } })} placeholder="num" />
                      {needsDen && <input style={{ ...inp, fontSize: 11.5 }} type="number" title={denHead} value={(ind.mDen && ind.mDen[m] != null) ? ind.mDen[m] : ''} onChange={e => patch({ mDen: { [m]: qedNum(e.target.value) } })} placeholder="den" />}
                    </div>
                    : <input style={inp} type="number" value={(ind.months && ind.months[m] != null) ? ind.months[m] : ''} onChange={e => patch({ months: { [m]: qedNum(e.target.value) } })} placeholder="—" />}
                </div>
              )))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- executive summary + sign-off editor ---- */
function QEdExecutive({ deptKey, dept, Q }) {
  const ex = dept.executive || {};
  const meta = dept.meta || {};
  const metaStr = (k) => { const v = meta[k]; return v && typeof v === 'object' ? (v.name || '') : (v || ''); };
  const txt = { padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 7, fontFamily: 'inherit', fontSize: 12.5, width: '100%', outline: 'none', background: '#fff' };
  const area = { ...txt, minHeight: 56, resize: 'vertical', lineHeight: 1.5 };
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="card-h"><h3>Executive Summary &amp; Sign-off</h3><span className="sub">shown on the department report &amp; exports</span></div>
      <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, alignItems: 'center' }}>
          <div className="field"><label>Overall status</label>
            <select style={txt} value={QED_STATUSES.includes(ex.overallStatus) ? ex.overallStatus : ''} onChange={e => Q.setExecutive(deptKey, { overallStatus: e.target.value })}>
              <option value="">— set —</option>{QED_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Drives the status chip and tone across the Quality dashboard and heatmap.</div>
        </div>
        <div className="field"><label>Key achievements</label><textarea style={area} value={ex.keyAchievements || ''} onChange={e => Q.setExecutive(deptKey, { keyAchievements: e.target.value })} placeholder="What went well this period" /></div>
        <div className="field"><label>Major gaps</label><textarea style={area} value={ex.majorGaps || ''} onChange={e => Q.setExecutive(deptKey, { majorGaps: e.target.value })} placeholder="Breaches / data gaps to address" /></div>
        <div className="field"><label>Recommendations</label><textarea style={area} value={ex.recommendations || ''} onChange={e => Q.setExecutive(deptKey, { recommendations: e.target.value })} placeholder="Actions / next steps" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          <div className="field"><label>Prepared by</label><input style={txt} value={metaStr('preparedBy')} onChange={e => Q.setMeta(deptKey, { preparedBy: e.target.value })} /></div>
          <div className="field"><label>Reviewed by</label><input style={txt} value={metaStr('reviewedBy')} onChange={e => Q.setMeta(deptKey, { reviewedBy: e.target.value })} /></div>
          <div className="field"><label>Approved by</label><input style={txt} value={metaStr('approvedBy')} onChange={e => Q.setMeta(deptKey, { approvedBy: e.target.value })} /></div>
        </div>
      </div>
    </div>
  );
}

/* ---- library picker (standard indicators) ---- */
function QEdLibrary({ existing, onAdd, onClose }) {
  const items = qedLibrary();
  const have = new Set((existing || []).map(n => (n || '').toLowerCase()));
  return (
    <div style={{ border: '1px solid var(--blue-100)', borderRadius: 10, background: 'var(--blue-50)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Ic d={I.doc} s={15} c="var(--blue)" /><b style={{ fontSize: 12.5 }}>Standard indicator library</b>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>formula-based · pick to add to this department</span>
        <span className="spacer" style={{ flex: 1 }} /><button className="icon-btn" style={{ width: 24, height: 24 }} onClick={onClose}><Ic d={I.x} s={13} /></button>
      </div>
      {items.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>No library available.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 8 }}>
        {items.map(it => {
          const added = have.has((it.name || '').toLowerCase());
          return (
            <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</div>
                <div style={{ fontSize: 10, color: 'var(--faint)', fontFamily: 'IBM Plex Mono' }}>{it.unit || it.valueType} · {it.goalDirection === 'higher_is_better' ? '↑' : '↓'} {it.benchmarkValue}</div>
              </div>
              <button className="btn sm" disabled={added} style={{ opacity: added ? .5 : 1 }} onClick={() => onAdd(it)}>{added ? '✓' : <Ic d={I.plus} s={13} />}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---- main editor screen ---- */
function QualityDeptEdit({ deptKey, setRoute }) {
  const Q = window.useQualityStore();
  const [showLib, setShowLib] = React.useState(false);
  const allDepts = Q.depts;
  const dept = Q.get(deptKey) || allDepts[0];
  if (!dept) return <div style={{ padding: 40 }}>No quality data to edit.</div>;
  const edited = Q.isEdited(dept.key);

  const addCustom = () => Q.addIndicator(dept.key, { id: window.qualitySlug('new indicator'), name: '', formula: 'direct', valueType: 'Count', benchmark: '0 (zero defect)', benchmarkValue: 0, goalDirection: 'lower_is_better', quarters: { Q1: null, Q2: null, Q3: null, Q4: null }, quarterRemarks: {}, remarks: '' });
  const addFromLib = (it) => { Q.addIndicator(dept.key, Object.assign({}, it, { id: window.qualitySlug(it.name) })); };
  const removeIndicator = async (ind) => {
    let ok = true;
    try { ok = await window.UI.confirm({ title: 'Remove this indicator?', message: `Removes "${ind.name || 'indicator'}" from ${dept.name}. Reset-to-original restores the built-in set.`, danger: true, confirmLabel: 'Remove' }); }
    catch (e) { ok = window.confirm('Remove this indicator?'); }
    if (ok) Q.removeIndicator(dept.key, ind.id);
  };
  const resetDept = async () => {
    let ok = true;
    try { ok = await window.UI.confirm({ title: `Reset ${dept.name} to original?`, message: 'Discards all your edits for this department and restores the built-in quality data.', danger: true, confirmLabel: 'Reset' }); }
    catch (e) { ok = window.confirm('Reset to original?'); }
    if (ok) { Q.resetDept(dept.key); try { window.UI.toast('Reset to original ✓', 'success'); } catch (e) { } }
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn sm" onClick={() => setRoute({ view: 'qualityDept', dept: dept.key })}><Ic d={I.chevR} s={14} style={{ transform: 'rotate(180deg)' }} />Report</button>
        <select value={dept.key} onChange={e => setRoute({ view: 'qualityEdit', dept: e.target.value })} style={{ padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 7, fontSize: 12.5, fontFamily: 'inherit', background: '#fff' }}>
          {allDepts.map(x => <option key={x.key} value={x.key}>{x.name}</option>)}
        </select>
        <span className="spacer" />
        {edited && <span className="chip" style={{ background: 'var(--blue-50)', color: 'var(--blue-700)' }}>● edited</span>}
        {edited && <button className="btn sm" onClick={resetDept} style={{ color: 'var(--rose)', borderColor: '#f1c6cd' }}><Ic d={I.x} s={13} />Reset to original</button>}
        <button className="btn pri sm" onClick={() => setRoute({ view: 'qualityDept', dept: dept.key })}><Ic d={I.check} s={14} />Done</button>
      </div>

      <SectionTitle icon={I.edit} title={`Edit Quality — ${dept.name}`} sub="Configure indicators, formulas & benchmarks, enter quarterly / monthly values, edit the executive summary — everything flows to the dashboard, reports and CAPA" />

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-h"><h3>Indicators</h3><span className="sub">{dept.indicators.length} tracked · formula or direct, set benchmark, values &amp; remarks</span><span className="spacer" />
          <button className="btn sm" onClick={() => setShowLib(s => !s)}><Ic d={I.doc} s={14} />Add from library</button>
          <button className="btn sm pri" onClick={addCustom}><Ic d={I.plus} s={14} />Add custom</button>
        </div>
        <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {showLib && <QEdLibrary existing={dept.indicators.map(i => i.name)} onAdd={addFromLib} onClose={() => setShowLib(false)} />}
          {dept.indicators.length === 0 && <div style={{ textAlign: 'center', color: 'var(--faint)', padding: '24px', fontSize: 13 }}>No indicators yet — add one to start tracking.</div>}
          {dept.indicators.map(ind => <QEdIndicator key={ind.id} deptKey={dept.key} ind={ind} Q={Q} onRemove={() => removeIndicator(ind)} />)}
        </div>
      </div>

      <QEdExecutive deptKey={dept.key} dept={dept} Q={Q} />
    </div>
  );
}

window.QualityDeptEdit = QualityDeptEdit;
