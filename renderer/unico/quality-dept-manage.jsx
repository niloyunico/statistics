/* UNICO — Manage Quality Departments (areas).
   A dedicated add / rename / delete screen for the quality "areas" (departments /
   units like OPD, ICU, Labour…) that hold the quality indicators — the Quality-
   module equivalent of the Statistics "Manage Departments" screen.

   Self-contained: talks to the server area CRUD (GET/POST/PATCH/DELETE
   /api/quality/areas). Lives in its OWN file + its own route (app.jsx maps
   route.view 'qualityDeptManage' straight to this) so it does NOT touch the
   consolidated quality-console.jsx. Global-script React — no imports.
   Globals used: React, SectionTitle, Ic, I, window.UI. */
(function () {
  const { useState, useEffect } = React;

  function qdmApi(path, opts) {
    return fetch(path, Object.assign({ headers: { 'content-type': 'application/json' }, credentials: 'same-origin' }, opts || {}))
      .then((r) => r.json().catch(() => ({ ok: r.ok })))
      .catch((e) => ({ ok: false, error: String(e) }));
  }
  function qdmToast(msg, kind) { try { if (window.UI && window.UI.toast) window.UI.toast(msg, kind || 'info'); } catch (e) { } }

  function QualityDeptManage({ setRoute }) {
    const [areas, setAreas] = useState(null);
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [editKey, setEditKey] = useState(null);
    const [editName, setEditName] = useState('');
    const me = (typeof window !== 'undefined' && window.__UNICO_USER__) || null;
    const isAdmin = !me || (me.role !== 'collector');

    const load = () => qdmApi('/api/quality/areas').then((r) => setAreas(r.ok ? (r.areas || []) : []));
    useEffect(() => { load(); }, []);

    const create = () => {
      const nm = name.trim();
      if (!nm) { qdmToast('Enter a department name', 'error'); return; }
      setBusy(true);
      qdmApi('/api/quality/areas', { method: 'POST', body: JSON.stringify({ name: nm }) }).then((r) => {
        setBusy(false);
        if (r.ok) { setName(''); qdmToast('Department “' + nm + '” created', 'success'); load(); }
        else qdmToast(r.error || 'Could not create the department', 'error');
      });
    };
    const startEdit = (a) => { setEditKey(a.key); setEditName(a.name); };
    const saveEdit = (a) => {
      const nm = editName.trim();
      if (!nm) { qdmToast('Name is required', 'error'); return; }
      qdmApi('/api/quality/areas/' + encodeURIComponent(a.key), { method: 'PATCH', body: JSON.stringify({ name: nm }) }).then((r) => {
        if (r.ok) { setEditKey(null); qdmToast('Renamed', 'success'); load(); }
        else qdmToast(r.error || 'Could not rename', 'error');
      });
    };
    const remove = async (a) => {
      let ok = false;
      const msg = 'Removes the department/area “' + a.name + '” and its ' + a.indicatorCount + ' indicator(s) with all collected data. This cannot be undone.';
      try { ok = await window.UI.confirm({ title: 'Delete ' + a.name + '?', message: msg, danger: true, confirmLabel: 'Delete' }); }
      catch (e) { ok = window.confirm(msg); }
      if (!ok) return;
      qdmApi('/api/quality/areas/' + encodeURIComponent(a.key), { method: 'DELETE' }).then((r) => {
        if (r.ok) { qdmToast('Department deleted', 'success'); load(); }
        else qdmToast(r.error || 'Could not delete', 'error');
      });
    };

    const inputSty = { padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#fff', outline: 'none', width: '100%' };
    const total = areas ? areas.length : 0;
    const totalInd = areas ? areas.reduce((s, a) => s + (a.indicatorCount || 0), 0) : 0;

    const Kpi = ({ label, val, foot, color }) => (
      <div className="card anim-pop" style={{ padding: '15px 18px', borderLeft: '4px solid ' + color, display: 'flex', flexDirection: 'column', minHeight: 92 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>{label}</div>
        <div className="num" style={{ fontSize: 28, fontWeight: 700, color, margin: '6px 0 0', lineHeight: 1 }}>{val}</div>
        {foot && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{foot}</div>}
      </div>
    );

    return (
      <div className="grid" style={{ gap: 16 }}>
        <SectionTitle icon={I.layers} title="Manage Quality Departments"
          sub="Add, rename or remove the departments / units (OPD, ICU, Labour…) that hold quality indicators. New departments become available in Quality Data Entry & the collector forms."
          right={<button className="btn sm" onClick={load}><Ic d={I.trend} s={14} />Refresh</button>} />

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' }}>
          <Kpi label="Departments" val={total} foot="quality areas / units" color="#0090ca" />
          <Kpi label="Indicators" val={totalInd} foot="tracked across departments" color="#6a52d4" />
        </div>

        {isAdmin && (
          <div className="card"><div className="card-b" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: 1, minWidth: 220 }}>
              <label>New department / area name</label>
              <input style={inputSty} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. OPD, ICU, Labour Ward…"
                onKeyDown={(e) => { if (e.key === 'Enter') create(); }} />
            </div>
            <button className="btn pri" onClick={create} disabled={busy || !name.trim()}><Ic d={I.plus} s={15} />{busy ? 'Creating…' : 'Add department'}</button>
          </div></div>
        )}

        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-h"><h3>Departments</h3><span className="spacer" /><span className="tag num">{total}</span></div>
          {areas === null ? <div style={{ padding: 24, color: 'var(--muted)' }}>Loading…</div>
            : areas.length === 0 ? <div style={{ padding: 28, color: 'var(--faint)', textAlign: 'center', fontSize: 13 }}>No departments yet. Add one above.</div>
              : <table className="tbl" style={{ width: '100%' }}>
                <thead><tr><th style={{ textAlign: 'left' }}>Department / unit</th><th style={{ textAlign: 'right' }}>Indicators</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
                <tbody>
                  {areas.map((a) => (
                    <tr key={a.key}>
                      <td style={{ textAlign: 'left' }}>
                        {editKey === a.key
                          ? <input style={{ ...inputSty, maxWidth: 320 }} value={editName} autoFocus onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(a); if (e.key === 'Escape') setEditKey(null); }} />
                          : <b style={{ color: 'var(--ink)', cursor: 'pointer' }} title="Open in Quality Data Entry" onClick={() => setRoute && setRoute({ view: 'qualityDataEntry', dept: a.key })}>{a.name}</b>}
                        <span style={{ color: 'var(--faint)', fontFamily: 'IBM Plex Mono', fontSize: 10.5, marginLeft: 8 }}>{a.key}</span>
                      </td>
                      <td style={{ textAlign: 'right' }} className="num">{a.indicatorCount}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {editKey === a.key ? (
                          <>
                            <button className="btn sm pri" onClick={() => saveEdit(a)} style={{ marginRight: 5 }}><Ic d={I.check} s={13} />Save</button>
                            <button className="btn sm" onClick={() => setEditKey(null)}>Cancel</button>
                          </>
                        ) : isAdmin ? (
                          <>
                            <button className="btn sm" onClick={() => startEdit(a)} style={{ marginRight: 5 }}><Ic d={I.edit} s={13} />Rename</button>
                            <button className="btn sm" style={{ color: 'var(--rose)', borderColor: '#f1c6cd' }} onClick={() => remove(a)}><Ic d={I.x} s={13} />Delete</button>
                          </>
                        ) : <span style={{ color: 'var(--faint)', fontSize: 11 }}>view only</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>}
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--muted)', padding: '0 2px' }}>
          <Ic d={I.doc} s={13} /> A new department starts with no indicators — add them from <b style={{ color: 'var(--ink-2)' }}>Indicator Administration</b> or the collector’s “Add a new indicator”. Newly created departments appear in the entry forms after the next page load.
        </div>
      </div>
    );
  }

  window.QualityDeptManage = QualityDeptManage;
})();
