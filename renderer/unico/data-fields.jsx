/* UNICO — Data Collection › Form Fields.
 *
 * Admin view of WHAT collectors fill in, and where to edit it:
 *   - Patient Statistics fields  = a department's metric columns (edited in
 *     Statistics › Manage Departments — add / rename / remove custom metrics).
 *   - Quality Data fields        = a quality area's indicators (edited in
 *     Quality › Manage Indicators — add custom / from library, set benchmark).
 *
 * Rather than duplicate those proven, persisted editors (the patient columns are
 * shared app-wide with the dashboard & reports), this screen PREVIEWS the current
 * fields and jumps straight to the right editor. Reached from the Data Collection
 * sidebar (route 'dcFields'). Self-contained; helpers prefixed df_. */

function DataFields({ setRoute }) {
  const { useState, useMemo } = React;
  const depts = (window.UNICO && window.UNICO.DEPARTMENTS) || [];
  const areas = useMemo(() => (window.qualityData ? window.qualityData() : (window.QUALITY_SEED || [])).filter(d => d.indicators && d.indicators.length), []);
  const [tab, setTab] = useState('patient');
  const [deptId, setDeptId] = useState((depts[0] && depts[0].id) || '');
  const [areaKey, setAreaKey] = useState((areas[0] && areas[0].key) || '');
  const dept = depts.find(d => d.id === deptId) || depts[0];
  const area = areas.find(a => a.key === areaKey) || areas[0];

  const sel = { padding: '8px 11px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#fff', color: 'var(--ink)', minWidth: 220 };
  const chip = (txt, tone) => <span className="chip" style={{ background: (tone || '#0090ca') + '1c', color: tone || '#0090ca', fontWeight: 700 }}>{txt}</span>;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <SectionTitle icon={I.input} title="Form Fields" sub="What collectors fill in on each form — preview the fields and edit them in the right place" />

      <div className="seg" style={{ alignSelf: 'flex-start' }}>
        <button className={tab === 'patient' ? 'on' : ''} onClick={() => setTab('patient')}>Patient Statistics</button>
        <button className={tab === 'quality' ? 'on' : ''} onClick={() => setTab('quality')}>Quality Data</button>
      </div>

      {tab === 'patient' ? (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-h" style={{ flexWrap: 'wrap', gap: 8 }}>
            <h3>Patient Statistics fields</h3><span className="sub">a department's metric columns</span><span className="spacer" />
            <select style={sel} value={deptId} onChange={e => setDeptId(e.target.value)}>
              {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button className="btn pri sm" title="Add / rename / remove metric columns" onClick={() => setRoute({ view: 'manage' })}><Ic d={I.edit} s={14} />Edit fields</button>
          </div>
          <div className="card-b">
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12 }}>
              These metric columns are the fields on the Patient Statistics form for <b style={{ color: 'var(--ink)' }}>{dept ? dept.name : '—'}</b>. They are shared app-wide with the dashboard and reports — edit them in <b>Statistics › Manage Departments</b>.
            </div>
            {!dept || !(dept.cols || []).length ? <div style={{ color: 'var(--muted)' }}>No fields defined.</div> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
                {dept.cols.map((c, i) => (
                  <div key={c.id} style={{ border: '1px solid var(--line)', borderRadius: 9, padding: '10px 12px', background: 'var(--panel-2)' }}>
                    <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{c.label}</div>
                    <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {c.pct ? chip('%', '#6a52d4') : chip('Count', '#0090ca')}
                      {i === 0 && chip('Headline', '#1f9d57')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-h" style={{ flexWrap: 'wrap', gap: 8 }}>
            <h3>Quality Data fields</h3><span className="sub">a quality area's indicators</span><span className="spacer" />
            <select style={sel} value={areaKey} onChange={e => setAreaKey(e.target.value)}>
              {areas.map(a => <option key={a.key} value={a.key}>{a.name}</option>)}
            </select>
            <button className="btn pri sm" title="Add custom / from library, set benchmark" onClick={() => setRoute({ view: 'quality', qview: 'admin', dept: area && area.key })}><Ic d={I.edit} s={14} />Manage indicators</button>
          </div>
          <div className="card-b">
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12 }}>
              These indicators are the fields on the Quality Data form for <b style={{ color: 'var(--ink)' }}>{area ? area.name : '—'}</b>. Add, rename or set benchmarks in <b>Quality › Manage Indicators</b>.
            </div>
            {!area || !(area.indicators || []).length ? <div style={{ color: 'var(--muted)' }}>No indicators defined.</div> : (
              <table className="tbl" style={{ width: '100%' }}>
                <thead><tr><th style={{ textAlign: 'left' }}>Indicator</th><th style={{ textAlign: 'left' }}>Type</th><th style={{ textAlign: 'left' }}>Benchmark</th><th style={{ textAlign: 'left' }}>Goal</th></tr></thead>
                <tbody>
                  {area.indicators.map(ind => (
                    <tr key={ind.id}>
                      <td style={{ textAlign: 'left', fontWeight: 600 }}>{ind.name}</td>
                      <td style={{ textAlign: 'left' }}>{ind.valueType || 'Count'}</td>
                      <td style={{ textAlign: 'left', fontSize: 12 }}>{ind.benchmark || '—'}</td>
                      <td style={{ textAlign: 'left', fontSize: 12 }}>{ind.goalDirection === 'higher_is_better' ? '↑ higher' : '↓ lower'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

window.DataFields = DataFields;
