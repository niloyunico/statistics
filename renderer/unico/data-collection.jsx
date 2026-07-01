/* UNICO — Data Collection module (renderer).
   - Responsible Persons: who gives/owns each department's or quality area's data
     (pick from existing staff OR add a new person), assigned to departments/areas.
   - Patient Statistics form + Quality Data form: Google-form-style guided entry
     that saves straight to MongoDB (departments / quality collections) and logs
     the submission (who, what, when).
   - Submission Log: recent submissions.
   All persistence is via the /api/* endpoints (server/data-collection.js). The
   browser session cookie is sent automatically, so it works behind the login gate. */
(function () {
  const { useState, useEffect, useMemo } = React;
  const Ic = window.Ic, I = window.I, SectionTitle = window.SectionTitle;
  const toast = (m, t) => { try { window.UI && window.UI.toast && window.UI.toast(m, t); } catch (e) {} };

  const dcApi = {
    get: (url) => fetch(url, { headers: { accept: 'application/json' } }).then((r) => r.json()),
    post: (url, body) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) }).then((r) => r.json()),
    patch: (url, body) => fetch(url, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) }).then((r) => r.json()),
    del: (url) => fetch(url, { method: 'DELETE' }).then((r) => r.json()),
  };

  // ---- shared helpers ----
  const MO = () => (window.UNICO && window.UNICO.MONTH_ORDER) || [];
  const MONS_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthLabel = (k) => {
    if (window.UNICO && window.UNICO.MONTHS_FULL && window.UNICO.MONTHS_FULL[k]) return window.UNICO.MONTHS_FULL[k];
    const p = String(k || '').split('-'); const mi = MONS_ABBR.indexOf(p[0]);
    return (mi >= 0 && p[1]) ? (MONS_LONG[mi] + ' 20' + p[1]) : k;
  };
  // A wide list of month keys (several fiscal years each way) so the reporting-month
  // dropdown isn't limited to the current FY — any month / year is selectable.
  const dcWideMonths = () => { const out = []; for (let yy = 24; yy <= 28; yy++) { MONS_ABBR.forEach((m) => out.push(m + '-' + String(yy).padStart(2, '0'))); } return out; };
  function defaultMonthFor(dept) {
    const order = MO();
    if (dept && dept.months && dept.months.length) {
      const last = dept.months[dept.months.length - 1];
      const i = order.indexOf(last);
      if (i >= 0 && i + 1 < order.length) return order[i + 1];
      return last;
    }
    // no data yet — default to the last COMPLETED reporting month (previous calendar month
    // relative to today), falling back to the newest catalog month. Date-relative so the
    // default stays sensible as the fiscal year advances (was a fixed magic index).
    const MMM = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const curKey = MMM[now.getMonth()] + '-' + String(now.getFullYear()).slice(-2);
    const ci = order.indexOf(curKey);
    if (ci >= 0) return order[Math.max(0, ci - 1)];
    return order[order.length - 1] || '';
  }
  function staffNames() {
    const s = window.STAFF_SEED || window.__UNICO_STAFF__ || [];
    return s.filter((e) => e && e.name).map((e) => ({ name: e.name, title: e.designation || e.role || '' }));
  }
  // The COMPLETE department list = base (window.UNICO.DEPARTMENTS) + custom departments
  // from the unico_store_v3 overlay. A newly-created custom department lives ONLY in
  // that overlay — it is never written to the `departments` collection / /api/departments —
  // so base-only sources miss it. For collectors the server injects a copy of that overlay
  // already scoped to their assignments, so their assigned custom department shows up here
  // too. Use this everywhere a department picker/list is built.
  function dcAllDepts() {
    try {
      if (window.buildDepts) {
        const ov = JSON.parse(localStorage.getItem('unico_store_v3')) || {};
        const merged = window.buildDepts(ov);
        if (Array.isArray(merged) && merged.length) return merged;
      }
    } catch (e) { /* fall back to base injection below */ }
    return ((window.UNICO && window.UNICO.DEPARTMENTS) || []).map((d) => ({ ...d }));
  }

  // ---- small UI atoms ----
  function Card(props) {
    return <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, padding: 18, boxShadow: 'var(--shadow-sm)', ...(props.style || {}) }}>{props.children}</div>;
  }
  function Field({ label, hint, children }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 13 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>{label}</label>
        {children}
        {hint && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{hint}</div>}
      </div>
    );
  }
  const inputStyle = { width: '100%', padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13.5, background: '#fff', color: 'var(--ink)', outline: 'none' };
  function Banner({ ok, children, onClose }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, marginBottom: 14, color: ok ? 'var(--pos)' : 'var(--rose)', background: ok ? 'var(--pos-bg)' : 'var(--neg-bg)', border: '1px solid ' + (ok ? '#bfe6cd' : '#f1c6cd') }}>
        <Ic d={ok ? I.check : I.x} s={16} /><span style={{ flex: 1 }}>{children}</span>
        {onClose && <button className="icon-btn" style={{ border: 0, background: 'transparent', cursor: 'pointer' }} onClick={onClose}><Ic d={I.x} s={13} /></button>}
      </div>
    );
  }

  // Responsible combobox: pick an assigned responsible / any staff / type a new name.
  function ResponsiblePicker({ value, onChange, suggestions }) {
    const list = [...new Set([...(suggestions || []).map((s) => s.name), ...staffNames().map((s) => s.name)])];
    return (
      <div>
        <input list="dc-resp-list" style={inputStyle} placeholder="Type a name, or pick from staff…" value={value || ''} onChange={(e) => onChange(e.target.value)} />
        <datalist id="dc-resp-list">{list.map((n) => <option key={n} value={n} />)}</datalist>
      </div>
    );
  }

  /* ============================ Responsible Persons ============================ */
  function DataResponsibles({ depts }) {
    const [list, setList] = useState(null);
    const [editing, setEditing] = useState(null); // the record being added/edited
    const areas = useMemo(() => (window.qualityData ? window.qualityData() : []).map((d) => ({ key: d.key, name: d.name })), []);
    const areaInds = useMemo(() => { const m = {}; (window.qualityData ? window.qualityData() : []).forEach((d) => { m[d.key] = (d.indicators || []).map((i) => ({ id: i.id, name: i.name })); }); return m; }, []);
    const load = () => dcApi.get('/api/responsibles').then((r) => setList(r.ok ? r.responsibles : [])).catch(() => setList([]));
    useEffect(() => { load(); }, []);

    const blank = () => ({ name: '', title: '', phone: '', staffId: null, empId: '', password: '', departments: [], qualityAreas: [], allQualityAreas: false, qualityIndicators: {}, active: true });
    const save = () => {
      if (!editing.name.trim()) { toast('Name is required', 'error'); return; }
      dcApi.post('/api/responsibles', editing).then((r) => {
        if (r.ok) { toast('Responsible person saved', 'success'); setEditing(null); load(); }
        else toast(r.error || 'Could not save', 'error');
      });
    };
    const remove = (id) => {
      const go = () => dcApi.del('/api/responsibles/' + encodeURIComponent(id)).then(() => load());
      if (window.UI && window.UI.confirm) window.UI.confirm('Remove this responsible person?').then((ok) => ok && go());
      else if (window.confirm('Remove this responsible person?')) go();
    };
    const toggle = (key, arr, val) => setEditing((e) => { const has = e[key].includes(val); return { ...e, [key]: has ? e[key].filter((x) => x !== val) : [...e[key], val] }; });

    const deptName = (id) => {
      const mapped = window.DEPTMAP ? window.DEPTMAP.nameFromId(id) : null;
      if (mapped && mapped !== id) return mapped;              // canonical name (map loaded)
      const d = (depts || []).find((x) => x.id === id);         // fall back to the real dept name
      return (d && (d.name || d.short)) || id;                  // never show a raw id
    };
    // Quality areas are DERIVED from the assigned departments (or ALL areas when hospital-wide),
    // so a person is assigned ONCE and covers both statistics and quality (matches the server).
    const derivedAreas = editing
      ? (editing.allQualityAreas
          ? (window.DEPTMAP ? window.DEPTMAP.allAreaKeys() : [])
          : (window.DEPTMAP ? window.DEPTMAP.areasFromDepts(editing.departments) : []))
      : [];
    // Custom = areas the admin picked directly (editing.qualityAreas) that aren't already
    // auto-granted by a department. Effective access = derived ∪ custom (or ALL if hospital-wide).
    const customAreas = editing ? (editing.qualityAreas || []).filter((k) => !derivedAreas.includes(k)) : [];
    const effectiveAreas = editing ? (editing.allQualityAreas ? derivedAreas : [...derivedAreas, ...customAreas]) : [];
    const toggleCustomArea = (k) => setEditing((ed) => ({ ...ed, qualityAreas: (ed.qualityAreas || []).includes(k) ? ed.qualityAreas.filter((x) => x !== k) : [...(ed.qualityAreas || []), k] }));

    return (
      <div className="grid" style={{ gap: 14 }}>
        <SectionTitle icon={I.user} title="Responsible Persons" sub="Who gives the data — assign each person to the departments / quality areas they own (e.g. Rabbi Miah → Cathlab)."
          right={!editing && <button className="btn pri sm" onClick={() => setEditing(blank())}><Ic d={I.plus} s={15} />Add person</button>} />

        {editing && (
          <Card>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>{editing.id ? 'Edit responsible person' : 'New responsible person'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Name" hint="Type a new name or pick an existing staff member.">
                <input list="dc-staff-list" style={inputStyle} value={editing.name} placeholder="e.g. Rabbi Miah"
                  onChange={(e) => { const name = e.target.value; const st = staffNames().find((s) => s.name === name); setEditing((ed) => ({ ...ed, name, title: st && !ed.title ? st.title : ed.title })); }} />
                <datalist id="dc-staff-list">{staffNames().map((s, i) => <option key={i} value={s.name} />)}</datalist>
              </Field>
              <Field label="Title / role"><input style={inputStyle} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="e.g. Charge Nurse" /></Field>
              <Field label="Phone (optional)"><input style={inputStyle} value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} placeholder="01XXXXXXXXX" /></Field>
              <div />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: '12px 14px', background: 'var(--panel-2)', border: '1px dashed var(--line)', borderRadius: 9, marginBottom: 13 }}>
              <Field label="Emp ID (login username)" hint="Set an emp ID + password to give this person a login that shows only their assigned data.">
                <input style={inputStyle} value={editing.empId || ''} onChange={(e) => setEditing({ ...editing, empId: e.target.value })} placeholder="e.g. rabbi.miah" />
              </Field>
              <Field label={editing.hasLogin ? 'New password (blank = keep current)' : 'Password'}>
                <input type="password" style={inputStyle} value={editing.password || ''} onChange={(e) => setEditing({ ...editing, password: e.target.value })} placeholder={editing.hasLogin ? '••••••' : 'min 4 characters'} />
              </Field>
            </div>
            <Field label="Assigned departments (patient statistics)">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {(depts || []).map((d) => {
                  const on = editing.departments.includes(d.id);
                  return <span key={d.id} onClick={() => setEditing((ed) => ({ ...ed, departments: ed.departments.includes(d.id) ? ed.departments.filter((x) => x !== d.id) : [...ed.departments, d.id] }))}
                    title={deptName(d.id) + (d.custom ? ' (custom)' : '')}
                    style={{ cursor: 'pointer', userSelect: 'none', padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, border: '1px solid ' + (on ? 'var(--blue)' : 'var(--line)'), background: on ? 'var(--blue-50)' : '#fff', color: on ? 'var(--blue-700)' : 'var(--ink-2)' }}
                   >{d.short || deptName(d.id)}</span>;
                })}
              </div>
            </Field>
            <Field label="Quality areas" hint="Auto-granted by the departments above (assign once). Tick extra areas below for custom access.">
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 9, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!editing.allQualityAreas} onChange={(e) => setEditing((ed) => ({ ...ed, allQualityAreas: e.target.checked }))} />
                Hospital-wide — every quality area (e.g. Infection Control)
              </label>
              {!editing.allQualityAreas && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {areas.map((a) => {
                    const auto = derivedAreas.includes(a.key);
                    const on = auto || (editing.qualityAreas || []).includes(a.key);
                    return <span key={a.key} onClick={() => { if (!auto) toggleCustomArea(a.key); }}
                      title={auto ? 'From an assigned department' : 'Custom extra access'}
                      style={{ cursor: auto ? 'default' : 'pointer', userSelect: 'none', padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, border: '1px solid ' + (on ? 'var(--blue)' : 'var(--line)'), background: on ? 'var(--blue-50)' : '#fff', color: on ? 'var(--blue-700)' : 'var(--ink-2)', opacity: auto ? 0.85 : 1 }}>
                      {a.name}{auto && <span style={{ fontSize: 9, fontWeight: 700, marginLeft: 4, opacity: 0.7 }}>AUTO</span>}</span>;
                  })}
                </div>
              )}
              {editing.allQualityAreas && <div style={{ fontSize: 12, color: 'var(--muted)' }}>All {areas.length} quality areas (hospital-wide).</div>}
            </Field>
            {effectiveAreas.length > 0 && (
              <Field label="Specific indicators per area (optional)" hint="Leave all unticked in an area to allow every indicator of that area. Tick some to restrict this person to just those.">
                <div style={{ display: 'grid', gap: 10 }}>
                  {effectiveAreas.map((ak) => {
                    const list = areaInds[ak] || [];
                    const aName = (areas.find((a) => a.key === ak) || {}).name || ak;
                    if (!list.length) return null;
                    const sel = (editing.qualityIndicators && editing.qualityIndicators[ak]) || [];
                    const setSel = (ids) => setEditing((ed) => { const qi = { ...(ed.qualityIndicators || {}) }; if (ids && ids.length) qi[ak] = ids; else delete qi[ak]; return { ...ed, qualityIndicators: qi }; });
                    return (
                      <div key={ak} style={{ padding: '10px 12px', background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 9 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 7 }}>{aName} <span style={{ fontWeight: 500, color: 'var(--muted)' }}>· {sel.length ? sel.length + ' selected' : 'all indicators'}</span></div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                          {list.map((ind) => {
                            const on = sel.includes(ind.id);
                            return <span key={ind.id} onClick={() => setSel(on ? sel.filter((x) => x !== ind.id) : [...sel, ind.id])}
                              style={{ cursor: 'pointer', userSelect: 'none', padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, border: '1px solid ' + (on ? 'var(--blue)' : 'var(--line)'), background: on ? 'var(--blue-50)' : '#fff', color: on ? 'var(--blue-700)' : 'var(--ink-2)' }}>{ind.name}</span>;
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Field>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button className="btn pri" onClick={save}><Ic d={I.check} s={15} />Save</button>
              <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </Card>
        )}

        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {list === null ? <div style={{ padding: 24, color: 'var(--muted)' }}>Loading…</div>
            : list.length === 0 ? <div style={{ padding: 24, color: 'var(--muted)', textAlign: 'center' }}>No responsible persons yet. Click “Add person”.</div>
              : <table className="tbl" style={{ width: '100%' }}>
                <thead><tr><th>Name</th><th>Title</th><th>Login</th><th>Departments</th><th>Quality areas</th><th></th></tr></thead>
                <tbody>{list.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td>{r.title || '—'}</td>
                    <td>{r.empId ? <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--blue-700)' }} title="Has a login account">🔑 {r.empId}</span> : <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                    <td>{(r.departments || []).map(deptName).join(', ') || '—'}</td>
                    <td>{r.allQualityAreas ? 'All areas (hospital-wide)' : ((r.qualityAreas || []).map((k) => window.DEPTMAP ? window.DEPTMAP.nameFromQualityKey(k) : k).join(', ') || '—')}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="icon-btn" title="Edit" onClick={() => setEditing({ ...blank(), ...r })}><Ic d={I.edit} s={14} /></button>
                      <button className="icon-btn" title="Remove" style={{ color: 'var(--rose)' }} onClick={() => remove(r.id)}><Ic d={I.x} s={14} /></button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>}
        </Card>
      </div>
    );
  }

  /* Admin-only: add/remove custom fields (columns) on a department's data-entry form.
     Custom columns persist to the `departments` collection and appear for collectors. */
  function DeptFieldManager({ dept, onChange }) {
    const [label, setLabel] = useState('');
    const [pct, setPct] = useState(false);
    const [busy, setBusy] = useState(false);
    const custom = ((dept && dept.cols) || []).filter((c) => c.custom);
    const add = () => {
      if (!label.trim()) { toast('Enter a field name', 'error'); return; }
      setBusy(true);
      dcApi.post('/api/departments/' + encodeURIComponent(dept.id) + '/fields', { label, pct }).then((r) => {
        setBusy(false);
        if (r.ok) { setLabel(''); setPct(false); toast('Custom field added', 'success'); onChange && onChange(); }
        else toast(r.error || 'Could not add field', 'error');
      }).catch(() => { setBusy(false); toast('Could not add field', 'error'); });
    };
    const remove = (id) => dcApi.del('/api/departments/' + encodeURIComponent(dept.id) + '/fields/' + encodeURIComponent(id))
      .then((r) => { if (r.ok) { toast('Field removed', 'info'); onChange && onChange(); } else toast(r.error || 'Could not remove', 'error'); }).catch(() => {});
    return (
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: .3 }}>Admin · custom fields for {(dept && (dept.short || dept.name)) || ''}</div>
        {custom.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {custom.map((c) => <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, background: '#fff', border: '1px solid var(--line)', borderRadius: 999, padding: '4px 5px 4px 11px' }}>{c.label}{c.pct ? ' (%)' : ''}<button className="icon-btn" title="Remove field" style={{ width: 22, height: 22, border: 0, background: 'transparent', color: 'var(--rose)' }} onClick={() => remove(c.id)}><Ic d={I.x} s={12} /></button></span>)}
        </div>}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input style={{ ...inputStyle, flex: 1, minWidth: 160 }} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="New field name (e.g. Re-admissions)" />
          <label style={{ fontSize: 12, color: 'var(--ink-2)', display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}><input type="checkbox" checked={pct} onChange={(e) => setPct(e.target.checked)} />%</label>
          <button className="btn sm" disabled={busy} onClick={add}><Ic d={I.plus} s={13} />Add field</button>
        </div>
      </div>
    );
  }

  /* ============================ Patient Statistics form ============================ */
  function DataPatientForm({ depts, prefill }) {
    const me = (typeof window !== 'undefined' && window.__UNICO_USER__) || null;
    const lockResp = !!(me && me.role === 'collector');
    const isAdmin = !lockResp; // admins (and open local mode) may manage custom fields
    // Merged base + custom departments (from the passed prop, else read the overlay).
    // Includes custom departments, which /api/departments does NOT return.
    const baseList = useMemo(() => ((depts && depts.length) ? depts : dcAllDepts()).map((d) => ({ ...d })), [depts]);
    // /api/departments only carries the latest custom COLUMNS for base departments
    // (admins add fields there); merge those in without dropping custom departments.
    const [colOverride, setColOverride] = useState(null);
    const refreshDepts = () => dcApi.get('/api/departments').then((r) => { if (r.ok) setColOverride(Object.fromEntries(r.departments.map((d) => [d.id, d.cols]))); }).catch(() => {});
    const all = useMemo(() => (colOverride ? baseList.map((d) => (colOverride[d.id] ? { ...d, cols: colOverride[d.id] } : d)) : baseList), [baseList, colOverride]);
    const [deptId, setDeptId] = useState((prefill && prefill.dept) || (all[0] && all[0].id) || '');
    const dept = useMemo(() => all.find((d) => d.id === deptId) || all[0], [deptId, all]);
    const [month, setMonth] = useState((prefill && prefill.month) || '');
    const [values, setValues] = useState({});
    const [responsible, setResponsible] = useState(lockResp ? (me.name || '') : ((prefill && prefill.responsible) || ''));
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(null);
    const [resps, setResps] = useState([]);
    const [subs, setSubs] = useState([]);

    useEffect(() => { dcApi.get('/api/responsibles').then((r) => setResps(r.ok ? r.responsibles : [])).catch(() => {}); }, []);
    useEffect(() => { dcApi.get('/api/submissions?limit=300').then((r) => setSubs(r.ok ? r.submissions : [])).catch(() => {}); }, [done]);
    // when department changes, reset month/values + auto-fill the assigned responsible
    useEffect(() => {
      if (!dept) return;
      setMonth((m) => m || defaultMonthFor(dept));
      setValues({});
      if (!(prefill && prefill.responsible)) {
        const assigned = resps.filter((r) => (r.departments || []).includes(dept.id));
        if (assigned.length) setResponsible(assigned[0].name);
      }
    }, [deptId, resps.length]);

    const assigned = resps.filter((r) => dept && (r.departments || []).includes(dept.id));
    const order = MO();
    const monthOpts = order.slice(Math.max(0, order.indexOf('Jan-25')), order.length); // sensible window
    // What's already on record for each month of THIS department: the latest
    // SUBMISSION status (pending/approved/rejected) takes priority; otherwise a
    // month already in the live database is flagged "reported".
    const monthStatus = useMemo(() => {
      const map = {};
      (subs || []).forEach((s) => { if (s.type === 'patient' && s.department === deptId && s.month && !map[s.month]) map[s.month] = s.status; });
      return map;
    }, [subs, deptId]);
    const reported = new Set((dept && dept.months) || []);
    const monthTag = (m) => { const st = monthStatus[m]; if (st === 'approved') return ' · ✓ approved'; if (st === 'pending') return ' · ⏳ pending'; if (st === 'rejected') return ' · ✗ rejected'; return reported.has(m) ? ' · ✓ reported' : ''; };
    // A collector cannot re-submit a month already submitted/approved or on record;
    // only an administrator may change it (rejected submissions may be re-sent).
    const lockedMonth = lockResp && (monthStatus[month] === 'pending' || monthStatus[month] === 'approved' || reported.has(month));
    const cols = (dept && dept.cols) || [];
    const last = (dept && dept.data && dept.data.length) ? dept.data[dept.data.length - 1] : {};

    const submit = () => {
      if (!dept) return;
      if (!month) { toast('Pick a month', 'error'); return; }
      if (lockedMonth) { toast('This month is already submitted/recorded — only an administrator can change it.', 'error'); return; }
      const matched = resps.find((r) => r.name === responsible);
      setBusy(true); setDone(null);
      dcApi.post('/api/submissions/patient', {
        department: dept.id, month, values,
        responsible: lockResp ? { name: me.name } : (matched ? { id: matched.id, name: matched.name } : (responsible ? { name: responsible } : null)),
        note,
      }).then((r) => {
        setBusy(false);
        if (r.ok) { setDone({ month, dept: dept.name }); setValues({}); setNote(''); toast('Submitted for review', 'success'); }
        else toast(r.error || 'Submission failed', 'error');
      }).catch((e) => { setBusy(false); toast('Submission failed', 'error'); });
    };

    return (
      <div className="grid" style={{ gap: 14, maxWidth: 760 }}>
        <SectionTitle icon={I.input} title="Submit Patient Statistics" sub="Fill in a department's monthly numbers — saved straight to the database and logged." />
        {done && <Banner ok onClose={() => setDone(null)}>Submitted ✓ — {done.dept} · {monthLabel(done.month)} sent for admin review. It appears on the dashboard once approved in Review &amp; History.</Banner>}
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Department">
              <select style={inputStyle} value={deptId} onChange={(e) => setDeptId(e.target.value)}>
                {all.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Reporting month">
              <select style={inputStyle} value={month} onChange={(e) => setMonth(e.target.value)}>
                {!month && <option value="">Select…</option>}
                {monthOpts.map((m) => <option key={m} value={m}>{monthLabel(m) + monthTag(m)}</option>)}
              </select>
            </Field>
          </div>
          {lockResp
            ? <Field label="Responsible person"><input style={{ ...inputStyle, background: 'var(--panel-2)', color: 'var(--ink-2)' }} value={me.name} readOnly /></Field>
            : <Field label="Responsible person (who is giving this data)" hint={assigned.length ? 'Assigned: ' + assigned.map((a) => a.name).join(', ') : 'Pick from staff or type a new name. Manage assignments in Responsible Persons.'}>
                <ResponsiblePicker value={responsible} onChange={setResponsible} suggestions={assigned} />
              </Field>}

          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', margin: '8px 0 8px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>{dept ? dept.name : ''} metrics — {monthLabel(month)}</span>
            {month && monthStatus[month] && <span className="chip" style={{ fontWeight: 700, background: monthStatus[month] === 'approved' ? 'var(--pos-bg)' : monthStatus[month] === 'rejected' ? 'var(--neg-bg)' : '#fff4e0', color: monthStatus[month] === 'approved' ? 'var(--pos)' : monthStatus[month] === 'rejected' ? 'var(--rose)' : '#9a6b00' }}>Already submitted · {monthStatus[month]}</span>}
            {month && !monthStatus[month] && reported.has(month) && <span className="chip" style={{ background: 'var(--blue-50)', color: 'var(--blue-700)', fontWeight: 700 }}>Already reported · in records</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 12 }}>
            {cols.map((c) => (
              <Field key={c.id} label={c.label + (c.pct ? ' (%)' : '')}>
                <input type="number" step="any" style={inputStyle} value={values[c.id] == null ? '' : values[c.id]}
                  placeholder={last[c.id] != null ? 'last: ' + last[c.id] : '0'}
                  onChange={(e) => setValues((v) => ({ ...v, [c.id]: e.target.value }))} />
              </Field>
            ))}
          </div>
          {isAdmin && dept && <div style={{ border: '1px dashed var(--line)', borderRadius: 9, padding: '10px 12px', margin: '2px 0 12px', background: 'var(--panel-2)' }}><DeptFieldManager dept={dept} onChange={refreshDepts} /></div>}
          <Field label="Note (optional)"><input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any comment about this submission" /></Field>
          {lockedMonth && <Banner>{dept ? dept.name : ''} · {monthLabel(month)} is already {monthStatus[month] || 'on record'} — submission is locked for data collectors. Ask an administrator to make changes.</Banner>}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button className="btn pri" disabled={busy || lockedMonth} onClick={submit}><Ic d={I.check} s={15} />{busy ? 'Submitting…' : (lockedMonth ? 'Locked — already recorded' : 'Submit')}</button>
            <button className="btn" disabled={busy} onClick={() => { setValues({}); setNote(''); setDone(null); }}>Clear</button>
          </div>
        </Card>
      </div>
    );
  }

  /* ============================ Quality Data form ============================ */
  // Map an indicator name to its Hospital Quality Indicator Framework guide entry
  // (window.HQI_GUIDE, from quality-guide.js) so the Data Collection form can show
  // collectors HOW to count / calculate it — the same reference the console Catalog uses.
  const HQI_MATCH = [
    [/hand hygiene/, 'A1'], [/\bcauti\b|catheter-associated uti/, 'A2'], [/\bclabsi\b|central line/, 'A3'],
    [/\bvap\b|ventilator-associated pneumonia/, 'A4'], [/\bvae\b|ventilator-associated event/, 'A4'],
    [/surgical site infection|\bssi\b/, 'A5'], [/phlebitis/, 'A6'], [/needle stick|\bnsi\b/, 'A13'],
    [/medication error/, 'B1'], [/falls with injury/, 'C3'], [/patient fall/, 'C2'],
    [/pressure ulcer|hapu|bed sore|pressure injury/, 'C4'], [/deep vein thrombosis|\bdvt\b/, 'C6'],
    [/return to icu/, 'D6'], [/cardiac arrest survival/, 'D11'], [/cardiac arrest events|code blue/, 'D10'],
    [/partograph/, 'F1'], [/door-to-balloon/, 'G1'], [/post-pci/, 'G2'], [/puncture site hematoma/, 'G3'],
    [/dialysis adequacy|\burr\b/, 'H1'], [/water quality/, 'H3'], [/hypotension/, 'H4'],
    [/vascular access complication/, 'H5'], [/de-lining/, 'H6'], [/infection rate/, 'H7'],
    [/post-procedure complication/, 'J1'], [/training compliance/, 'L1'], [/accidental removal of catheter/, 'L5'],
  ];
  function hqiGuideFor(name) {
    try {
      const G = (typeof window !== 'undefined' && window.HQI_GUIDE) || null;
      if (!G || !name) return null;
      const n = String(name).toLowerCase();
      const up = String(name).toUpperCase().trim();
      if (G[up]) return Object.assign({ code: up }, G[up]);                 // name IS a code (A1…)
      for (let i = 0; i < HQI_MATCH.length; i++) { if (HQI_MATCH[i][0].test(n) && G[HQI_MATCH[i][1]]) return Object.assign({ code: HQI_MATCH[i][1] }, G[HQI_MATCH[i][1]]); }
      const norm = (s) => String(s || '').toLowerCase().replace(/\s*\(.*?\)\s*/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
      const nn = norm(name); if (!nn) return null;
      for (const c in G) { if (Object.prototype.hasOwnProperty.call(G, c) && norm(G[c].name) === nn) return Object.assign({ code: c }, G[c]); }
      for (const c in G) { if (Object.prototype.hasOwnProperty.call(G, c)) { const gn = norm(G[c].name); if (gn && (nn.indexOf(gn) >= 0 || gn.indexOf(nn) >= 0)) return Object.assign({ code: c }, G[c]); } }
      return null;
    } catch (e) { return null; }
  }

  function DataQualityForm({ prefill }) {
    const areas = useMemo(() => (window.qualityData ? window.qualityData() : []), []);
    const me = (typeof window !== 'undefined' && window.__UNICO_USER__) || null;
    const lockResp = !!(me && me.role === 'collector');
    // Months = the quality FY (Jun-25…May-26), read from the store so it stays in
    // sync with the dashboard/quarters; default to the latest FY month.
    const fyMonths = (window.QUALITY_QUARTER_MONTHS) ? ['Q1', 'Q2', 'Q3', 'Q4'].reduce((a, q) => a.concat(window.QUALITY_QUARTER_MONTHS[q] || []), []) : null;
    const monthOpts = dcWideMonths();
    const defMonth = ((fyMonths && fyMonths.length) ? fyMonths[fyMonths.length - 1] : 'May-26') || monthOpts[monthOpts.length - 1] || '';
    // Default to the first area that actually HAS indicators (so a collector never
    // lands on an empty area), falling back to the first area.
    const [areaKey, setAreaKey] = useState((prefill && prefill.area) || ((areas.find((a) => a.indicators && a.indicators.length) || areas[0] || {}).key) || '');
    const area = useMemo(() => areas.find((a) => a.key === areaKey) || areas[0], [areas, areaKey]);
    const [indId, setIndId] = useState((prefill && prefill.indicatorId) || '');
    const [newInd, setNewInd] = useState({ name: '', formula: 'count', numLabel: '', denLabel: '', unit: '' });
    const [month, setMonth] = useState((prefill && prefill.month) || defMonth);
    const [den, setDen] = useState('');
    // Numerator entry: either broken down BY STAFF GROUP (Nurse / Doctor / PCA /
    // Other) which add up to the total, or typed DIRECTLY. For rate/% indicators each
    // group also carries its OWN denominator (the totals are their sums). The old
    // per-incident logging module is intentionally gone for this collector form.
    // 'group' | 'dept' | 'direct'. The staff-group / by-department breakdown is
    // Hand-Hygiene-ONLY; every other indicator uses the simple 'direct' entry.
    const [numMode, setNumMode] = useState('direct');
    const [groups, setGroups] = useState({ nurse: '', doctor: '', pca: '', other: '' });
    const [groupsDen, setGroupsDen] = useState({ nurse: '', doctor: '', pca: '', other: '' });
    // "By department" = a department × staff-group matrix, each cell {n,d}. Rolls up.
    const [deptRows, setDeptRows] = useState([]); // [{ dept, g:{nurse:{n,d},doctor:{n,d},pca:{n,d},other:{n,d}} }]
    const [directNum, setDirectNum] = useState('');
    // Optional observation + corrective / preventive action (CAPA) for the month.
    const [capa, setCapa] = useState({ finding: '', corrective: '', preventive: '' });
    // Per-incident reports (adverse-event indicators): each with its own patient + CAPA
    // detail; the month's count auto-derives from how many are logged.
    const [incidents, setIncidents] = useState([]);
    const [remark, setRemark] = useState('');
    const [responsible, setResponsible] = useState(lockResp ? (me.name || '') : ((prefill && prefill.responsible) || ''));
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(null);
    const [guideOpen, setGuideOpen] = useState(false); // HQI guide collapsed by default (click "Show" to expand)
    const [resps, setResps] = useState([]);
    useEffect(() => { if (!lockResp) dcApi.get('/api/responsibles').then((r) => setResps(r.ok ? r.responsibles : [])).catch(() => {}); }, []);
    // Reset the indicator when the AREA changes — but skip the first run so a jumped-in
    // prefill (area + indicator) from the Submission-status board isn't cleared on mount.
    const firstAreaRef = React.useRef(true);
    useEffect(() => { if (firstAreaRef.current) { firstAreaRef.current = false; return; } setIndId(''); }, [areaKey]);

    const inds = (area && area.indicators) || [];
    const assigned = resps.filter((r) => (r.qualityAreas || []).includes(areaKey));
    const isNew = indId === '__new__';
    const curInd = inds.find((i) => i.id === indId);
    const def = isNew ? newInd : (curInd || {});
    const benchmarkQ = (curInd && curInd.benchmark) || def.benchmark || '';
    const unitRaw = def.unit || '';
    // Many indicators read like a RATE in their benchmark / unit (e.g. "< 0.75 per
    // 1,000 discharges", "per 100 patient-days", "≥ 90%") yet are stored as a plain
    // count, so the form never asks for a denominator. Detect the rate from the
    // benchmark / unit when the indicator hasn't explicitly declared one. The server
    // persists whatever calculation the form submits onto the indicator at approval,
    // so entering it as a rate also corrects the indicator's definition going forward.
    const declared = def.formula;
    const rateProbe = (benchmarkQ + ' ' + unitRaw).toLowerCase();
    const per1000 = /per\s*1[.,\s]?0{3}\b|\/\s*1[.,\s]?0{3}\b/.test(rateProbe);
    const per100 = !per1000 && /per\s*100\b/.test(rateProbe);
    const pctText = !per1000 && !per100 && (/%/.test(rateProbe) || /\bpercent/.test(rateProbe));
    const formula = (declared === 'rate1000' || declared === 'rate100' || declared === 'pct' || declared === 'count') ? declared
      : per1000 ? 'rate1000' : per100 ? 'rate100' : pctText ? 'pct' : (declared || 'count');
    const isRate = formula === 'rate1000' || formula === 'rate100' || formula === 'pct';
    const mult = formula === 'rate1000' ? 1000 : (formula === 'rate100' || formula === 'pct') ? 100 : 1000;
    const vt = def.valueType || (formula === 'pct' ? '%' : isRate ? 'Rate' : 'Count');
    // parse the denominator's unit out of the benchmark, e.g. "per 1,000 discharges" -> "Discharges"
    const denMatch = rateProbe.match(/per\s*1[.,\s]?0{2,3}\s+([a-z][a-z\- ]{1,28})/) || rateProbe.match(/per\s*100\s+([a-z][a-z\- ]{1,28})/);
    const denGuess = denMatch ? denMatch[1].trim().replace(/\b\w/g, (c) => c.toUpperCase()) : '';
    const numLabel = def.numLabel || (isRate ? 'Cases (incidents)' : 'Numerator');
    const denLabel = def.denLabel || denGuess || 'Denominator';
    const numDef = def.numeratorDef || '';
    const denDef = def.denominatorDef || (isRate ? ('Total ' + denLabel.toLowerCase() + ' in ' + monthLabel(month) + ' — the denominator the rate is calculated against.') : '');
    const indNameQ = (def.name || newInd.name) || 'Result';
    const GROUP_KEYS = [['nurse', 'Nurse'], ['doctor', 'Doctor'], ['pca', 'PCA'], ['other', 'Other']];
    const groupSum = GROUP_KEYS.reduce((s, [k]) => s + (Number(groups[k]) || 0), 0);
    const groupDenSum = GROUP_KEYS.reduce((s, [k]) => s + (Number(groupsDen[k]) || 0), 0);
    // "By department" mode: department × staff-group matrix (each cell num/den) rolls up.
    const deptTot = deptRows.reduce((acc, r) => { GROUP_KEYS.forEach(([k]) => { acc.n += Number(r.g[k].n) || 0; acc.d += Number(r.g[k].d) || 0; }); return acc; }, { n: 0, d: 0 });
    const blankDeptRow = () => ({ dept: '', g: { nurse: { n: '', d: '' }, doctor: { n: '', d: '' }, pca: { n: '', d: '' }, other: { n: '', d: '' } } });
    const setDeptName = (i, v) => setDeptRows((rs) => rs.map((r, j) => (j === i ? { ...r, dept: v } : r)));
    const setDeptCell = (i, k, f, v) => setDeptRows((rs) => rs.map((r, j) => (j === i ? { ...r, g: { ...r.g, [k]: { ...r.g[k], [f]: v } } } : r)));
    const addDeptRow = () => setDeptRows((rs) => [...rs, blankDeptRow()]);
    const delDeptRow = (i) => setDeptRows((rs) => rs.filter((_, j) => j !== i));

    // Hand Hygiene Compliance is a WHOLE-HOSPITAL indicator collected across every
    // department, so its "By department" matrix is a common gateway that pre-lists
    // EVERY department as a ready-to-fill row (no typing / adding one by one). This
    // special-casing applies ONLY to Hand Hygiene; other indicators are unchanged.
    const isHandHygiene = /hand\s*hygiene/i.test(indNameQ || '');
    const hhDepartments = useMemo(() => {
      const isOverall = (a) => /overall\s*hospital/i.test((a && (a.name || a.key)) || '');
      const nameOf = (a) => ((window.DEPTMAP && window.DEPTMAP.nameFromQualityKey) ? window.DEPTMAP.nameFromQualityKey(a.key) : (a.name || a.key));
      // A specific department area lists ONLY that department, so a per-department
      // collector enters just their own hand-hygiene figures. The hospital-wide
      // "Overall Hospital" area lists EVERY department (for the roll-up).
      if (area && area.key && !isOverall(area)) { const n = nameOf(area); return n ? [n] : []; }
      const seen = new Set(); const out = [];
      (areas || []).forEach((a) => { if (!a || !a.key || isOverall(a)) return; const n = nameOf(a); if (n && !seen.has(n)) { seen.add(n); out.push(n); } });
      return out;
    }, [areas, area]);
    // Seed / keep the matrix in sync with the full department list for Hand Hygiene,
    // preserving any numbers already typed for a department that stays in the list.
    useEffect(() => {
      if (!(isHandHygiene && numMode === 'dept' && hhDepartments.length)) return;
      setDeptRows((prev) => {
        const same = prev.length === hhDepartments.length && prev.every((r, i) => r.dept === hhDepartments[i]);
        if (same) return prev;
        const byName = {}; prev.forEach((r) => { if (r.dept) byName[r.dept] = r; });
        return hhDepartments.map((n) => byName[n] || { ...blankDeptRow(), dept: n });
      });
    }, [isHandHygiene, numMode, hhDepartments]);

    // Incident-type indicators are adverse events you LOG one by one (falls, infections,
    // medication errors, ETT removals, re-admissions…): lower-is-better and NOT hand
    // hygiene / a utilization rate. For these the collector records each incident with its
    // patient + CAPA detail, and the count auto-derives from how many are logged.
    const isIncidentType = !isHandHygiene && (def.goalDirection ? def.goalDirection !== 'higher_is_better' : true);
    const blankIncident = () => ({ patientName: '', uhid: '', age: '', gender: '', diagnosis: '', admissionDate: '', details: '', finding: '', corrective: '', preventive: '', remark: '' });
    const addIncident = () => setIncidents((a) => [...a, blankIncident()]);
    const setIncidentField = (i, k, v) => setIncidents((a) => a.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
    const delIncident = (i) => setIncidents((a) => a.filter((_, j) => j !== i));
    // Adverse-event (incident) indicators are AUTO-ONLY: the numerator = the number of
    // incidents logged below. The field is read-only (no manual typing) — start at 0 and
    // it fills in as incidents are added.
    const autoCount = isIncidentType;

    const numerator = numMode === 'group' ? groupSum : numMode === 'dept' ? deptTot.n
      : autoCount ? incidents.length : (Number(directNum) || 0);
    // Every indicator can take a denominator: rate indicators REQUIRE it; counts may
    // OPTIONALLY add one to compute a rate. In "By group" / "By department" modes the total
    // denominator is the sum of the group/matrix cells; "Direct value" uses the single field.
    const denNum = numMode === 'group' ? groupDenSum : numMode === 'dept' ? deptTot.d : (Number(den) || 0);
    const denEntered = denNum > 0;
    const computeAsRate = isRate || denEntered;
    const rateUnit = (unitRaw && /per|%/.test(unitRaw)) ? unitRaw : (formula === 'pct' ? '%' : ('per ' + mult + (denGuess ? ' ' + denGuess.toLowerCase() : '')));
    const unitQ = computeAsRate ? rateUnit : (unitRaw || 'count');
    const formulaTextQ = computeAsRate
      ? (indNameQ + ' = (' + numLabel + ' ÷ ' + denLabel + ') × ' + mult)
      : (indNameQ + ' = ' + numLabel);
    // Standardised measurement guide (formula / worked example / interpretation / reference)
    // for the selected indicator, from the Hospital Quality Indicator Framework.
    const guide = hqiGuideFor(indNameQ);

    // Prefill the numerator (group breakdown or direct) + denominator from existing
    // data on month / indicator change.
    useEffect(() => {
      const blankG = { nurse: '', doctor: '', pca: '', other: '' };
      const toG = (o) => ({ nurse: o && o.nurse != null ? String(o.nurse) : '', doctor: o && o.doctor != null ? String(o.doctor) : '', pca: o && o.pca != null ? String(o.pca) : '', other: o && o.other != null ? String(o.other) : '' });
      if (!curInd) { setGroups(blankG); setGroupsDen(blankG); setDeptRows([]); setDirectNum(''); setNumMode('direct'); setDen(''); setIncidents([]); setCapa({ finding: '', corrective: '', preventive: '' }); return; }
      const g = curInd.mGroups && curInd.mGroups[month];
      const gd = curInd.mGroupsDen && curInd.mGroupsDen[month];
      const dep = curInd.mDeptBreakdown && curInd.mDeptBreakdown[month];
      const cellStr = (row, k, f) => { const v = row && row.g && row.g[k] && row.g[k][f]; return v == null ? '' : String(v); };
      const toRow = (row) => ({ dept: (row && row.dept) || '', g: { nurse: { n: cellStr(row, 'nurse', 'n'), d: cellStr(row, 'nurse', 'd') }, doctor: { n: cellStr(row, 'doctor', 'n'), d: cellStr(row, 'doctor', 'd') }, pca: { n: cellStr(row, 'pca', 'n'), d: cellStr(row, 'pca', 'd') }, other: { n: cellStr(row, 'other', 'n'), d: cellStr(row, 'other', 'd') } } });
      // existing total numerator: rate → mNum[month]; count → months[month]
      const rawNum = (curInd.mNum && curInd.mNum[month] != null && curInd.mNum[month] !== '') ? curInd.mNum[month]
        : (!isRate && curInd.months && curInd.months[month] != null && curInd.months[month] !== '') ? curInd.months[month]
        : null;
      if (!isHandHygiene) {
        // Non-Hand-Hygiene indicators use ONLY the simple direct numerator (+ denominator)
        // entry — the staff-group / by-department breakdown is Hand-Hygiene-only.
        setDeptRows([]); setGroups(blankG); setGroupsDen(blankG);
        setDirectNum(rawNum != null ? String(rawNum) : ''); setNumMode('direct');
      } else if (Array.isArray(dep) && dep.length) {
        setDeptRows(dep.map(toRow)); setNumMode('dept'); setGroups(blankG); setGroupsDen(blankG); setDirectNum('');
      } else if (g && typeof g === 'object') {
        setDeptRows([]); setGroups(toG(g)); setGroupsDen(gd && typeof gd === 'object' ? toG(gd) : blankG);
        setDirectNum(''); setNumMode('group');
      } else if (rawNum != null) {
        setDeptRows([]); setDirectNum(String(rawNum)); setGroups(blankG); setGroupsDen(blankG); setNumMode('direct');
      } else {
        // Hand Hygiene with no data yet opens straight into the all-departments gateway.
        setDeptRows([]); setGroups(blankG); setGroupsDen(blankG); setDirectNum(''); setNumMode('dept');
      }
      setDen(curInd.mDen && curInd.mDen[month] != null ? String(curInd.mDen[month]) : '');
      const cp = curInd.capa && curInd.capa[month];
      setCapa(cp && typeof cp === 'object' ? { finding: cp.finding || '', corrective: cp.corrective || '', preventive: cp.preventive || '' } : { finding: '', corrective: '', preventive: '' });
      // Load any incident reports already recorded for this indicator × month.
      const incs = (curInd.incidents && Array.isArray(curInd.incidents[month])) ? curInd.incidents[month] : [];
      setIncidents(incs.map((x) => ({ patientName: x.patientName || '', uhid: x.uhid || '', age: x.age || '', gender: x.gender || '', diagnosis: x.diagnosis || '', admissionDate: x.admissionDate || '', details: x.details || '', finding: x.finding || '', corrective: x.corrective || '', preventive: x.preventive || '', remark: x.remark || '' })));
    }, [indId, month]); // eslint-disable-line

    // The numerator (by group or direct) drives the count / rate.
    const result = computeAsRate ? (denNum > 0 ? Math.round((numerator / denNum) * mult * 100) / 100 : 0) : numerator;
    // A rate needs its denominator: when a numerator is present but the denominator is
    // still blank, the value can't be computed yet — show "—" + a prompt, not a false 0.
    const ratePending = computeAsRate && numerator > 0 && !(denNum > 0);

    // When a month already has recorded data, a data collector can still submit — but
    // it's flagged as a CORRECTION that goes to an administrator for review (it doesn't
    // overwrite the live value until approved). A fresh "Add a new indicator" is never a correction.
    const qExists = !!(curInd && (
      (curInd.incidents && Array.isArray(curInd.incidents[month]) && curInd.incidents[month].length) ||
      (curInd.mDen && curInd.mDen[month] != null && curInd.mDen[month] !== '') ||
      (curInd.mNum && curInd.mNum[month] != null && curInd.mNum[month] !== '') ||
      (curInd.months && curInd.months[month] != null && curInd.months[month] !== '')
    ));
    const qCorrection = lockResp && !isNew && qExists;
    const submit = () => {
      if (!area) { toast('Select an area', 'error'); return; }
      if (!indId) { toast('Select an indicator', 'error'); return; }
      if (isNew && !newInd.name.trim()) { toast('Enter the new indicator name', 'error'); return; }
      if (!month) { toast('Pick a month', 'error'); return; }
      if (isRate && !(denNum > 0)) { toast('Enter ' + denLabel + ' (denominator)' + (numMode === 'group' ? ' for at least one group' : numMode === 'dept' ? ' for at least one department' : ''), 'error'); return; }
      const matched = resps.find((r) => r.name === responsible);
      setBusy(true); setDone(null);
      dcApi.post('/api/submissions/quality', {
        area: area.key, month,
        indicatorId: isNew ? '' : indId,
        indicatorName: isNew ? newInd.name : (curInd && curInd.name),
        valueType: computeAsRate ? (formula === 'pct' ? '%' : 'Rate') : 'Count', entryMode: computeAsRate ? 'rate' : 'count', mult,
        formula: computeAsRate ? (isRate ? formula : 'rate1000') : 'count',
        numLabel: computeAsRate ? numLabel : undefined, denLabel: computeAsRate ? denLabel : undefined, unit: unitQ,
        value: computeAsRate ? undefined : numerator, num: computeAsRate ? numerator : undefined, den: computeAsRate ? denNum : undefined,
        groups: numMode === 'group' ? GROUP_KEYS.reduce((o, [k]) => (o[k] = Number(groups[k]) || 0, o), {}) : undefined,
        groupsDen: (numMode === 'group' && computeAsRate) ? GROUP_KEYS.reduce((o, [k]) => (o[k] = Number(groupsDen[k]) || 0, o), {}) : undefined,
        deptBreakdown: numMode === 'dept' ? deptRows.map((r) => ({ dept: r.dept || '', g: GROUP_KEYS.reduce((o, [k]) => (o[k] = { n: Number(r.g[k].n) || 0, d: Number(r.g[k].d) || 0 }, o), {}) })) : undefined,
        capa: (capa.finding || capa.corrective || capa.preventive) ? { finding: capa.finding, corrective: capa.corrective, preventive: capa.preventive } : undefined,
        // Per-incident reports (only those with something filled in). The server stores
        // them on the indicator's month; the count above already reflects how many.
        incidents: incidents.length ? incidents.map((x) => ({ patientName: x.patientName, uhid: x.uhid, age: x.age, gender: x.gender, diagnosis: x.diagnosis, admissionDate: x.admissionDate, details: x.details, finding: x.finding, corrective: x.corrective, preventive: x.preventive, remark: x.remark })) : undefined,
        remark,
        responsible: lockResp ? { name: me.name } : (matched ? { id: matched.id, name: matched.name } : (responsible ? { name: responsible } : null)),
      }).then((r) => {
        setBusy(false);
        if (r.ok) { setDone({ area: area.name, month }); setGroups({ nurse: '', doctor: '', pca: '', other: '' }); setGroupsDen({ nurse: '', doctor: '', pca: '', other: '' }); setDeptRows([]); setDirectNum(''); setCapa({ finding: '', corrective: '', preventive: '' }); setIncidents([]); setDen(''); setRemark(''); if (isNew) { setIndId(''); setNewInd({ name: '', formula: 'count', numLabel: '', denLabel: '', unit: '' }); } toast('Saved monthly value', 'success'); }
        else toast(r.error || 'Submission failed', 'error');
      }).catch(() => { setBusy(false); toast('Submission failed', 'error'); });
    };

    const showEntry = (indId && !isNew) || (isNew && newInd.name);
    return (
      <div className="grid" style={{ gap: 14, maxWidth: 760 }}>
        <SectionTitle icon={I.activity} title="Submit Quality Data" sub="Enter the month's value — by staff group (Nurse / Doctor / PCA / Other) or directly — the count / rate is calculated automatically." />
        {done && <Banner ok onClose={() => setDone(null)}>Saved ✓ — {done.area} · {monthLabel(done.month)} sent for admin review.</Banner>}
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Quality area / unit">
              <select style={inputStyle} value={areaKey} onChange={(e) => setAreaKey(e.target.value)}>
                {areas.map((a) => <option key={a.key} value={a.key}>{/overall\s*hospital/i.test(a.key) ? 'All Departments (Overall Hospital)' : a.name}</option>)}
              </select>
            </Field>
            <Field label="Reporting month">
              <select style={inputStyle} value={month} onChange={(e) => setMonth(e.target.value)}>
                {monthOpts.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Indicator" hint={inds.length === 0 ? ('No indicators are assigned to ' + (area ? area.name : 'this area') + ' yet. Ask an administrator to assign them (Quality → Assign by Department), then reload this page.') : undefined}>
            <select style={inputStyle} value={indId} onChange={(e) => setIndId(e.target.value)}>
              <option value="">{inds.length ? 'Select…' : '— no indicators for this area —'}</option>
              {inds.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </Field>
          {isNew && (
            <div style={{ border: '1px dashed var(--line)', borderRadius: 9, padding: '12px 14px', marginBottom: 13 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
                <Field label="New indicator name"><input style={inputStyle} value={newInd.name} onChange={(e) => setNewInd({ ...newInd, name: e.target.value })} placeholder="e.g. CAUTI Rate" /></Field>
                <Field label="Calculation">
                  <select style={inputStyle} value={newInd.formula} onChange={(e) => setNewInd({ ...newInd, formula: e.target.value })}>
                    <option value="count">Count</option>
                    <option value="pct">Percentage (%)</option>
                    <option value="rate1000">Rate per 1000</option>
                  </select>
                </Field>
              </div>
              {newInd.formula !== 'count' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  <Field label="Numerator label"><input style={inputStyle} value={newInd.numLabel} onChange={(e) => setNewInd({ ...newInd, numLabel: e.target.value })} placeholder="e.g. CAUTI cases" /></Field>
                  <Field label="Denominator label"><input style={inputStyle} value={newInd.denLabel} onChange={(e) => setNewInd({ ...newInd, denLabel: e.target.value })} placeholder="e.g. catheter days" /></Field>
                  <Field label="Unit (optional)"><input style={inputStyle} value={newInd.unit} onChange={(e) => setNewInd({ ...newInd, unit: e.target.value })} placeholder="e.g. per 1000 cath-days" /></Field>
                </div>
              )}
            </div>
          )}
          {showEntry && (
            <>
              <div style={{ background: 'var(--blue-50)', border: '1px solid var(--blue-100,#cfe6f7)', borderRadius: 9, padding: '10px 13px', marginBottom: 13, fontSize: 12, color: 'var(--blue-700)' }}>
                <div style={{ fontFamily: 'var(--mono)' }}><b style={{ fontStyle: 'italic', marginRight: 6 }}>ƒ</b>{formulaTextQ}</div>
                {(isRate || numDef) && (
                  <div style={{ marginTop: 7, paddingTop: 7, borderTop: '1px solid var(--blue-100,#cfe6f7)', color: 'var(--ink-2)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {numDef && <div><b>{numLabel}:</b> {numDef}</div>}
                    {isRate && <div><b>How to count {denLabel} (denominator):</b> {denDef}</div>}
                  </div>
                )}
              </div>
              {guide && (
                <div style={{ border: '1px solid var(--blue-100,#cfe6f7)', borderRadius: 9, marginBottom: 13, overflow: 'hidden' }}>
                  <div onClick={() => setGuideOpen((o) => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: 'var(--blue-50)', cursor: 'pointer', userSelect: 'none' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--blue-700)' }}>📐 How to measure this — HQI guide</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--blue-700)', background: '#fff', border: '1px solid var(--blue-100,#cfe6f7)', borderRadius: 5, padding: '1px 6px' }}>{guide.code}</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{guideOpen ? 'Hide' : 'Show'}</span>
                  </div>
                  {guideOpen && (
                    <div style={{ padding: '12px 14px', display: 'grid', gap: 10, fontSize: 12 }}>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--blue-700)' }}><b style={{ fontStyle: 'italic', marginRight: 6 }}>ƒ</b>{guide.formula}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: guide.denDef ? '1fr 1fr' : '1fr', gap: 10 }}>
                        <div style={{ background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '9px 11px' }}><div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 3 }}>Numerator — what to count</div><div style={{ color: 'var(--ink-2)', lineHeight: 1.5 }}>{guide.numDef}</div></div>
                        {guide.denDef && <div style={{ background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '9px 11px' }}><div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--violet,#6a52d4)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 3 }}>Denominator — what to count</div><div style={{ color: 'var(--ink-2)', lineHeight: 1.5 }}>{guide.denDef}</div></div>}
                      </div>
                      {guide.example && <div style={{ background: 'var(--blue-50)', border: '1px solid var(--blue-100,#cfe6f7)', borderRadius: 8, padding: '9px 11px' }}><div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--blue-700)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 3 }}>🔢 Worked example</div><div style={{ fontFamily: 'var(--mono)', color: 'var(--blue-700)', lineHeight: 1.55 }}>{guide.example}</div></div>}
                      {guide.interpretation && <div style={{ background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '9px 11px' }}><div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--pos,#1f9d57)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 3 }}>💡 Interpretation &amp; action</div><div style={{ color: 'var(--ink-2)', lineHeight: 1.5 }}>{guide.interpretation}</div></div>}
                      {(guide.multiplier || guide.source || guide.reference) && (
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 10.5, color: 'var(--muted)' }}>
                          {guide.multiplier && <span><b style={{ color: 'var(--ink-2)' }}>Multiplier:</b> {guide.multiplier}</span>}
                          {guide.source && <span><b style={{ color: 'var(--ink-2)' }}>Source:</b> {guide.source}</span>}
                          {guide.reference && <span><b style={{ color: 'var(--ink-2)' }}>Reference:</b> {guide.reference}</span>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {numMode === 'direct' && !isIncidentType && (
                <Field
                  label={<span>{denLabel} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{isRate ? '(denominator — required)' : '(denominator — optional, for a rate)'}</span></span>}
                  hint={isRate ? denDef : ('Leave blank to record a plain count. Enter the base for ' + monthLabel(month) + ' (e.g. total procedures / discharges / patient-days) to compute a rate per ' + mult + '.')}>
                  <input type="number" step="any" style={inputStyle} value={den} onChange={(e) => setDen(e.target.value)} placeholder={isRate ? ('Total ' + denLabel.toLowerCase() + ' this month') : 'Optional — total base (blank = count)'} />
                </Field>
              )}
              <div style={{ border: '1px solid var(--line)', borderRadius: 9, padding: '12px 14px', marginBottom: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>{numLabel}{isRate ? ' (numerator ÷ denominator)' : ''}</div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: 'var(--blue-50)', color: 'var(--blue-700)' }}>{numerator}{isRate ? ' / ' + denNum : ''}</span>
                  <span style={{ flex: 1 }} />
                  {/* Staff-group / by-department breakdown is Hand-Hygiene-only. Every other
                      indicator just enters the value directly, so the mode switch is hidden. */}
                  {isHandHygiene && (
                    <div className="seg">
                      <button className={numMode === 'group' ? 'on' : ''} onClick={() => setNumMode('group')}>By group</button>
                      <button className={numMode === 'dept' ? 'on' : ''} onClick={() => { setNumMode('dept'); if (!isHandHygiene && deptRows.length === 0) setDeptRows([blankDeptRow()]); }}>By department</button>
                      <button className={numMode === 'direct' ? 'on' : ''} onClick={() => setNumMode('direct')}>Direct value</button>
                    </div>
                  )}
                </div>
                {numMode === 'group' ? (
                  <>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 8 }}>
                      {isRate
                        ? ('Enter each staff group’s ' + numLabel.toLowerCase() + ' (numerator) and ' + denLabel.toLowerCase() + ' (denominator) — they add up to the totals.')
                        : ('Enter the ' + (numLabel || 'value').toLowerCase() + ' for each staff group — they add up to the total value.')}
                    </div>
                    {GROUP_KEYS.map(([k, lbl]) => (
                      <div key={k} style={{ display: 'grid', gridTemplateColumns: isRate ? '78px 1fr 1fr' : '78px 1fr', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>{lbl}</div>
                        <input type="number" min="0" step="any" style={inputStyle} value={groups[k]} onChange={(e) => setGroups((g) => ({ ...g, [k]: e.target.value }))} placeholder={isRate ? 'numerator' : '0'} />
                        {isRate && <input type="number" min="0" step="any" style={inputStyle} value={groupsDen[k]} onChange={(e) => setGroupsDen((g) => ({ ...g, [k]: e.target.value }))} placeholder="denominator" />}
                      </div>
                    ))}
                    {isRate && (
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <span>Total {numLabel.toLowerCase()} = <b style={{ color: 'var(--ink-2)' }}>{groupSum}</b></span>
                        <span>Total {denLabel.toLowerCase()} = <b style={{ color: 'var(--ink-2)' }}>{groupDenSum}</b></span>
                      </div>
                    )}
                  </>
                ) : numMode === 'dept' ? (
                  <>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 8 }}>{isHandHygiene ? (hhDepartments.length === 1 ? <>Enter <b style={{ color: 'var(--ink-2)' }}>{hhDepartments[0]}</b>’s {numLabel.toLowerCase()}{isRate ? ' (numerator) & ' + denLabel.toLowerCase() + ' (denominator)' : ''} by staff group. Pick <b style={{ color: 'var(--ink-2)' }}>Overall Hospital</b> above to enter every department at once.</> : <>All <b style={{ color: 'var(--ink-2)' }}>{hhDepartments.length}</b> departments are listed below — just fill in each department’s {numLabel.toLowerCase()}{isRate ? ' (numerator) & ' + denLabel.toLowerCase() + ' (denominator)' : ''} by staff group. They roll up to the hospital total automatically.</>) : <>Enter each department’s {numLabel.toLowerCase()}{isRate ? ' (numerator) & ' + denLabel.toLowerCase() + ' (denominator)' : ''} by staff group — every department &amp; group rolls up to the hospital total.</>}</div>
                    {deptRows.map((r, i) => {
                      const rn = GROUP_KEYS.reduce((s, [k]) => s + (Number(r.g[k].n) || 0), 0);
                      const rd = GROUP_KEYS.reduce((s, [k]) => s + (Number(r.g[k].d) || 0), 0);
                      const rv = isRate ? (rd > 0 ? Math.round((rn / rd) * mult * 100) / 100 + (formula === 'pct' ? '%' : '') : '—') : rn;
                      return (
                        <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', marginBottom: 8, background: 'var(--panel-2)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            {isHandHygiene
                              ? <div style={{ flex: 1, fontWeight: 700, fontSize: 13, color: 'var(--ink)', padding: '5px 2px' }}>{r.dept}</div>
                              : <input style={{ ...inputStyle, flex: 1, fontWeight: 600 }} value={r.dept} onChange={(e) => setDeptName(i, e.target.value)} placeholder="Department (e.g. OPD)" />}
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: 'var(--blue-50)', color: 'var(--blue-700)', whiteSpace: 'nowrap' }}>{rv}</span>
                            {!isHandHygiene && deptRows.length > 1 && <button className="icon-btn" title="Remove department" style={{ width: 26, height: 26, border: 0, background: 'transparent', color: 'var(--rose)' }} onClick={() => delDeptRow(i)}><Ic d={I.x} s={13} /></button>}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                            {GROUP_KEYS.map(([k, lbl]) => (
                              <div key={k}>
                                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 3 }}>{lbl}</div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <input type="number" min="0" step="any" style={{ ...inputStyle, padding: '6px 7px' }} value={r.g[k].n} onChange={(e) => setDeptCell(i, k, 'n', e.target.value)} placeholder={isRate ? 'num' : '0'} />
                                  {isRate && <input type="number" min="0" step="any" style={{ ...inputStyle, padding: '6px 7px' }} value={r.g[k].d} onChange={(e) => setDeptCell(i, k, 'd', e.target.value)} placeholder="den" />}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 2 }}>
                      {!isHandHygiene && <button className="btn sm" onClick={addDeptRow}><Ic d={I.plus} s={13} />Add department</button>}
                      <span style={{ flex: 1 }} />
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>Total {numLabel.toLowerCase()} = <b style={{ color: 'var(--ink-2)' }}>{deptTot.n}</b>{isRate ? <> · Total {denLabel.toLowerCase()} = <b style={{ color: 'var(--ink-2)' }}>{deptTot.d}</b></> : null}</span>
                    </div>
                  </>
                ) : autoCount ? (
                  <Field label={<span>{numLabel} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(auto — one per incident logged below)</span></span>}>
                    <div style={{ ...inputStyle, background: 'var(--panel-2)', fontWeight: 700, color: 'var(--ink)' }}>{incidents.length}</div>
                  </Field>
                ) : (
                  <Field label={<span>{numLabel} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(enter the number directly{isIncidentType ? ', or log each incident below' : ''})</span></span>} hint={numDef || undefined}>
                    <input type="number" min="0" step="any" style={inputStyle} value={directNum} onChange={(e) => setDirectNum(e.target.value)} placeholder={isRate ? ('Total ' + (numLabel || 'numerator').toLowerCase() + ' this month') : 'Total this month'} />
                  </Field>
                )}
              </div>
              {isIncidentType && (
                <div style={{ border: '1px solid var(--line)', borderRadius: 9, padding: '12px 14px', marginBottom: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>Incident reports</div>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>log each occurrence with patient &amp; CAPA detail — the count fills in automatically</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: 'var(--blue-50)', color: 'var(--blue-700)' }}>{incidents.length} logged</span>
                  </div>
                  {incidents.map((x, i) => (
                    <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '11px 12px', marginBottom: 8, background: 'var(--panel-2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--rose)', textTransform: 'uppercase', letterSpacing: .3 }}>Incident {i + 1}</div>
                        <span style={{ flex: 1 }} />
                        <button className="btn sm" style={{ color: 'var(--rose)', borderColor: '#f1c6cd' }} onClick={() => delIncident(i)}><Ic d={I.x} s={12} />Remove</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <Field label="Patient name"><input style={inputStyle} value={x.patientName} onChange={(e) => setIncidentField(i, 'patientName', e.target.value)} placeholder="Name" /></Field>
                        <Field label="UHID"><input style={inputStyle} value={x.uhid} onChange={(e) => setIncidentField(i, 'uhid', e.target.value)} placeholder="Hospital ID" /></Field>
                        <Field label="Age"><input style={inputStyle} value={x.age} onChange={(e) => setIncidentField(i, 'age', e.target.value)} placeholder="e.g. 54" /></Field>
                        <Field label="Sex"><input style={inputStyle} value={x.gender} onChange={(e) => setIncidentField(i, 'gender', e.target.value)} placeholder="M / F" /></Field>
                        <Field label="Admission date"><input type="date" style={inputStyle} value={x.admissionDate} onChange={(e) => setIncidentField(i, 'admissionDate', e.target.value)} /></Field>
                        <Field label="Diagnosis"><input style={inputStyle} value={x.diagnosis} onChange={(e) => setIncidentField(i, 'diagnosis', e.target.value)} placeholder="Diagnosis" /></Field>
                      </div>
                      <Field label="Incident details"><textarea style={{ ...inputStyle, minHeight: 40 }} value={x.details} onChange={(e) => setIncidentField(i, 'details', e.target.value)} placeholder="What happened" /></Field>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <Field label="Finding / root cause"><textarea style={{ ...inputStyle, minHeight: 40 }} value={x.finding} onChange={(e) => setIncidentField(i, 'finding', e.target.value)} placeholder="Root cause" /></Field>
                        <Field label="Corrective action"><textarea style={{ ...inputStyle, minHeight: 40 }} value={x.corrective} onChange={(e) => setIncidentField(i, 'corrective', e.target.value)} placeholder="Action taken to correct" /></Field>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <Field label="Preventive action"><textarea style={{ ...inputStyle, minHeight: 40 }} value={x.preventive} onChange={(e) => setIncidentField(i, 'preventive', e.target.value)} placeholder="Prevent recurrence" /></Field>
                        <Field label="Remark"><input style={inputStyle} value={x.remark} onChange={(e) => setIncidentField(i, 'remark', e.target.value)} placeholder="Optional note" /></Field>
                      </div>
                    </div>
                  ))}
                  <button className="btn sm" onClick={addIncident}><Ic d={I.plus} s={13} />Add incident</button>
                </div>
              )}
              {/* For incident indicators the denominator lives HERE — next to the incidents
                  and the computed value — so a rate isn't stuck at 0 for a hidden field. */}
              {isIncidentType && numMode === 'direct' && (
                <Field
                  label={<span>{denLabel} <span style={{ color: (isRate && !(denNum > 0)) ? 'var(--rose)' : 'var(--muted)', fontWeight: isRate ? 700 : 400 }}>{isRate ? '(denominator — required to compute the rate)' : '(denominator — optional, for a rate)'}</span></span>}
                  hint={isRate ? denDef : ('Leave blank to record a plain count of incidents. Enter the base for ' + monthLabel(month) + ' (e.g. total patient-days) to compute a rate per ' + mult + '.')}>
                  <input type="number" step="any" style={{ ...inputStyle, ...(isRate && !(denNum > 0) ? { borderColor: 'var(--rose)' } : {}) }} value={den} onChange={(e) => setDen(e.target.value)} placeholder={isRate ? ('Total ' + denLabel.toLowerCase() + ' this month') : 'Optional — total base (blank = count)'} />
                </Field>
              )}
              <div style={{ border: '1px solid ' + (ratePending ? '#f1c6cd' : 'var(--line)'), borderRadius: 9, padding: '13px 16px', marginBottom: 4, background: 'var(--panel-2)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .4 }}>Computed value</div>
                <span className="num" style={{ fontSize: 22, fontWeight: 800, color: ratePending ? 'var(--muted)' : 'var(--blue-700)' }}>{ratePending ? '—' : result}</span>
                {unitQ ? <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-2)' }}>{unitQ}</span> : null}
                <span style={{ flex: 1 }} />
                {ratePending
                  ? <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--rose)' }}>{numLabel} = {numerator} · enter {denLabel} (denominator) to compute the rate</span>
                  : <span style={{ fontSize: 11, color: 'var(--muted)' }}>{computeAsRate ? (numLabel + ' = ' + numerator + (denEntered ? ' · ' + denLabel + ' = ' + denNum : '')) : (numLabel + ' = ' + numerator)}{benchmarkQ ? '   ·   Benchmark ' + benchmarkQ : ''}</span>}
              </div>
              {/hand\s*hygiene/i.test(indNameQ) && (
              <div style={{ border: '1px solid var(--line)', borderRadius: 9, padding: '12px 14px', marginTop: 13 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 8 }}>Observation &amp; action <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 11 }}>(optional)</span></div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <Field label="Observation / finding"><textarea style={{ ...inputStyle, minHeight: 42 }} value={capa.finding} onChange={(e) => setCapa((c) => ({ ...c, finding: e.target.value }))} placeholder="What was observed this month" /></Field>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Field label="Corrective action"><textarea style={{ ...inputStyle, minHeight: 42 }} value={capa.corrective} onChange={(e) => setCapa((c) => ({ ...c, corrective: e.target.value }))} placeholder="Action taken to correct" /></Field>
                    <Field label="Preventive action"><textarea style={{ ...inputStyle, minHeight: 42 }} value={capa.preventive} onChange={(e) => setCapa((c) => ({ ...c, preventive: e.target.value }))} placeholder="Action to prevent recurrence" /></Field>
                  </div>
                </div>
              </div>
              )}
            </>
          )}
          {lockResp
            ? <Field label="Responsible person"><input style={{ ...inputStyle, background: 'var(--panel-2)', color: 'var(--ink-2)' }} value={me.name} readOnly /></Field>
            : <Field label="Responsible person" hint={assigned.length ? 'Assigned: ' + assigned.map((a) => a.name).join(', ') : 'Pick from staff or type a new name.'}>
                <ResponsiblePicker value={responsible} onChange={setResponsible} suggestions={assigned} />
              </Field>}
          <Field label="Remark (optional)"><input style={inputStyle} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Any note for this month" /></Field>
          {qCorrection && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '11px 14px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, marginBottom: 14, color: '#9a6b00', background: 'var(--warn-bg,#fff4e0)', border: '1px solid #f0d9a8' }}>
              <Ic d={I.doc} s={16} />
              <span style={{ flex: 1 }}>{(curInd && curInd.name) || 'This indicator'} already has data for {monthLabel(month)}. Submitting sends a <b>correction</b> to an administrator for review — the recorded value won’t change until it is approved.</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button className="btn pri" disabled={busy} onClick={submit}><Ic d={I.check} s={15} />{busy ? 'Saving…' : (qCorrection ? 'Submit correction for review' : 'Save monthly value')}</button>
            <button className="btn" disabled={busy} onClick={() => { setGroups({ nurse: '', doctor: '', pca: '', other: '' }); setGroupsDen({ nurse: '', doctor: '', pca: '', other: '' }); setDeptRows([]); setDirectNum(''); setCapa({ finding: '', corrective: '', preventive: '' }); setDen(''); setRemark(''); setDone(null); }}>Clear</button>
          </div>
        </Card>
      </div>
    );
  }

  /* ============================ Review & History ============================ */
  function StatCard({ label, value, color }) {
    return (
      <div style={{ flex: 1, minWidth: 110, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: color || 'var(--ink)' }} className="num">{value}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .3 }}>{label}</div>
      </div>
    );
  }
  function valuesSummary(s) {
    if (s.type === 'quality') return (s.indicatorName || '') + ' · ' + monthLabel(s.month) + (s.value != null ? ' = ' + s.value : '') + (s.remark ? ' (' + s.remark + ')' : '');
    const v = s.values || {};
    const parts = Object.keys(v).map((k) => k + ':' + v[k]);
    return monthLabel(s.month) + ' — ' + (parts.length ? parts.join(', ') : '(no values)');
  }
  // Full submission viewer. Admins can correct a PENDING submission's values
  // (PATCH /api/submissions/:id) before approving; collectors see it read-only.
  function SubmissionDetail({ s, canEdit, onClose, onSaved }) {
    const editable = canEdit && s.status === 'pending';
    const dept = s.type === 'patient' ? (dcAllDepts().find((d) => d.id === s.department)) : null;
    const cols = (dept && dept.cols) || (s.values ? Object.keys(s.values).map((id) => ({ id, label: id })) : []);
    const pctOf = {}; ((dept && dept.cols) || []).forEach((c) => { pctOf[c.id] = !!c.pct; });
    const [vals, setVals] = useState(() => Object.assign({}, s.values || {}));
    const [qval, setQval] = useState(s.value == null ? '' : s.value);
    const [remark, setRemark] = useState(s.remark || '');
    const [note, setNote] = useState(s.note || '');
    const [busy, setBusy] = useState(false);
    const when = (ts) => { try { return ts ? new Date(ts).toLocaleString() : '—'; } catch (e) { return '—'; } };
    const Meta = ({ label, value }) => (
      <div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</div><div style={{ fontWeight: 600, color: 'var(--ink)' }}>{value}</div></div>
    );
    const save = () => {
      setBusy(true);
      const body = { note };
      if (s.type === 'patient') body.values = vals; else { body.value = qval; body.remark = remark; }
      dcApi.patch('/api/submissions/' + encodeURIComponent(s.id), body).then((r) => {
        setBusy(false);
        if (r.ok) { toast('Submission updated', 'success'); onSaved && onSaved(r.submission); }
        else toast(r.error || 'Could not save', 'error');
      }).catch(() => { setBusy(false); toast('Could not save', 'error'); });
    };
    return (
      <div onMouseDown={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(16,32,46,.42)', zIndex: 400, display: 'grid', placeItems: 'center', padding: 20 }}>
        <div onMouseDown={(e) => e.stopPropagation()} style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, width: 580, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto', boxShadow: 'var(--shadow-pop)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--line-2)' }}>
            <Ic d={I.doc} s={16} /><div style={{ fontWeight: 700, fontSize: 14 }}>Submission · {s.type === 'quality' ? s.areaName : s.departmentName}</div>
            <span style={{ flex: 1 }} /><button className="icon-btn" style={{ width: 28, height: 28 }} onClick={onClose}><Ic d={I.x} s={14} /></button>
          </div>
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 13 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12.5 }}>
              <Meta label="Type" value={s.type === 'quality' ? 'Quality' : 'Patient'} />
              <Meta label="Reporting month" value={monthLabel(s.month)} />
              <Meta label="Responsible" value={(s.responsible && s.responsible.name) || '—'} />
              <Meta label="Submitted by" value={s.submittedBy || '—'} />
              <Meta label="Submitted at" value={when(s.submittedAt)} />
              <Meta label="Status" value={s.status} />
              {s.reviewedBy && <Meta label="Reviewed by" value={s.reviewedBy + (s.reviewedAt ? ' · ' + when(s.reviewedAt) : '')} />}
              {s.editedBy && <Meta label="Last edited by" value={s.editedBy + (s.editedAt ? ' · ' + when(s.editedAt) : '')} />}
              {s.rejectReason && <Meta label="Reject reason" value={s.rejectReason} />}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 8 }}>Submitted data</div>
              {s.type === 'patient' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {cols.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>(no values)</div>}
                  {cols.map((c) => (
                    <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 11.5, color: 'var(--muted)' }}>{c.label}{pctOf[c.id] ? ' (%)' : ''}</label>
                      {editable
                        ? <input type="number" step="any" style={inputStyle} value={vals[c.id] == null ? '' : vals[c.id]} onChange={(e) => setVals((v) => Object.assign({}, v, { [c.id]: e.target.value }))} />
                        : <div className="num" style={{ fontWeight: 700, fontSize: 15 }}>{vals[c.id] == null ? '—' : vals[c.id]}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 11.5, color: 'var(--muted)' }}>{s.indicatorName || 'Value'}</label>
                    {editable ? <input type="number" step="any" style={inputStyle} value={qval} onChange={(e) => setQval(e.target.value)} /> : <div className="num" style={{ fontWeight: 700, fontSize: 15 }}>{s.value == null ? '—' : s.value}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 11.5, color: 'var(--muted)' }}>Remark</label>
                    {editable ? <input style={inputStyle} value={remark} onChange={(e) => setRemark(e.target.value)} /> : <div>{s.remark || '—'}</div>}
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11.5, color: 'var(--muted)' }}>Note</label>
              {editable ? <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" /> : <div>{s.note || '—'}</div>}
            </div>
            {editable && <div style={{ fontSize: 11, color: 'var(--muted)' }}>Edits are allowed while the submission is pending. Approve it from the table to apply the values to live data.</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn sm" onClick={onClose}>Close</button>
              {editable && <button className="btn pri sm" onClick={save} disabled={busy}><Ic d={I.check} s={14} />{busy ? 'Saving…' : 'Save changes'}</button>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ============================ Quality Report (A4, print-ready) ============================
     Standalone auto-generated report of the quality indicators, rendered into #pdf-root and
     printed via the shared pdf-export-mode path. Reads the SAME window.qualityData() the forms
     use (so it reflects the backend-computed quarters/values), and reuses the global chart
     components (Donut / Bar3D / BarChart). Lives inside Data Collection so it never touches the
     quality-console / app / ui refactor. */
  function QualityReportDoc() {
    const areas = (typeof window.qualityData === 'function' ? window.qualityData() : (window.QUALITY_SEED || [])).filter((a) => a && a.indicators && a.indicators.length);
    const QM = (typeof window !== 'undefined' && window.QUALITY_QUARTER_MONTHS) || { Q1: ['Jun-25', 'Jul-25', 'Aug-25'], Q2: ['Sep-25', 'Oct-25', 'Nov-25'], Q3: ['Dec-25', 'Jan-26', 'Feb-26'], Q4: ['Mar-26', 'Apr-26', 'May-26'] };
    const QS = ['Q1', 'Q2', 'Q3', 'Q4'];
    const qval = (ind, q) => (ind.quarters ? ind.quarters[q] : null);
    const qstatus = (ind, q) => { const v = qval(ind, q); if (v == null || v === '') return 'na'; const b = ind.benchmarkValue; if (b == null || b === '') return 'ok'; return ind.goalDirection === 'higher_is_better' ? (v >= b ? 'ok' : 'breach') : (v <= b ? 'ok' : 'breach'); };
    const fmtv = (ind, q) => { const v = qval(ind, q); return (v == null || v === '') ? '—' : v; };
    let ok = 0, breach = 0, na = 0, totalInd = 0;
    areas.forEach((a) => { totalInd += a.indicators.length; a.indicators.forEach((ind) => QS.forEach((q) => { const s = qstatus(ind, q); if (s === 'ok') ok++; else if (s === 'breach') breach++; else na++; })); });
    const compliance = ok + breach ? Math.round(ok * 100 / (ok + breach)) : 100;
    const donut = [{ label: 'On benchmark', value: ok, color: '#1f9d57' }, { label: 'Breach', value: breach, color: '#d23a52' }, { label: 'Not reported', value: na, color: '#c4ccd6' }].filter((x) => x.value > 0);
    const breachByQ = QS.map((q) => { let b = 0; areas.forEach((a) => a.indicators.forEach((ind) => { if (qstatus(ind, q) === 'breach') b++; })); return { label: q, value: b }; });
    let date = ''; try { date = new Date().toISOString().slice(0, 10); } catch (e) { }
    const hospital = 'UNICO Hospitals';
    const tone = { ok: ['#1f9d57', '#e7f6ec'], breach: ['#d23a52', '#fdeaec'], na: ['#8a93a3', '#eef1f5'] };
    const th = { textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: .4, color: '#5b6672', padding: '6px 8px', borderBottom: '2px solid #d7dee7' };
    const td = { fontSize: 11, padding: '5px 8px', borderBottom: '1px solid #eef1f5', color: '#1f2a37' };
    const cell = (s, v) => <span style={{ display: 'inline-block', minWidth: 30, textAlign: 'center', padding: '2px 6px', borderRadius: 6, fontWeight: 700, fontSize: 10.5, background: tone[s][1], color: tone[s][0] }}>{v}</span>;
    const KPI = ({ label, value, color, foot }) => (
      <div style={{ border: '1px solid #e2e8f0', borderLeft: '4px solid ' + (color || '#0090ca'), borderRadius: 8, padding: '10px 13px' }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#5b6672', textTransform: 'uppercase', letterSpacing: .3 }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: color || '#0f2c4d', lineHeight: 1.1 }}>{value}</div>
        {foot ? <div style={{ fontSize: 10, color: '#8a93a3' }}>{foot}</div> : null}
      </div>
    );
    const Foot = () => <div className="pdf-foot" style={{ marginTop: 12, color: '#9aa6b4', fontSize: 9, borderTop: '1px solid #e4e9f0', paddingTop: 6 }}>{hospital} · Confidential · Generated {date}</div>;
    return (
      <div className="pdf-doc">
        {/* summary page */}
        <section className="pdf-page" style={{ fontFamily: "'IBM Plex Sans',Arial,sans-serif", color: '#16202e' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderBottom: '2px solid #0090ca', paddingBottom: 8, marginBottom: 14 }}>
            <div><div style={{ fontSize: 20, fontWeight: 800, color: '#0072a3' }}>{hospital}</div><div style={{ fontSize: 13, fontWeight: 600 }}>Quality Indicator Report</div></div>
            <div style={{ textAlign: 'right', fontSize: 10.5, color: '#8a93a3' }}>Generated {date}<br />NQI · Jun 2025 – May 2026</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
            <KPI label="Areas / units" value={areas.length} color="#0090ca" />
            <KPI label="Indicators" value={totalInd} color="#6a52d4" />
            <KPI label="Compliance" value={compliance + '%'} color="#1f9d57" foot={ok + ' on benchmark · ' + breach + ' breaches'} />
            <KPI label="Breaches" value={breach} color={breach ? '#d23a52' : '#1f9d57'} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16, marginBottom: 4 }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Compliance mix</div>
              <div style={{ display: 'grid', placeItems: 'center' }}>{typeof Donut === 'function' ? <Donut data={donut.length ? donut : [{ label: 'n/a', value: 1, color: '#c4ccd6' }]} size={158} centerValue={compliance + '%'} centerLabel="on benchmark" flat /> : null}</div>
            </div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Breaches by quarter</div>
              {typeof Bar3D === 'function' ? <Bar3D data={breachByQ} x="label" y="value" height={185} color="#d23a52" flat /> : (typeof BarChart === 'function' ? <BarChart data={breachByQ} x="label" y="value" height={185} color="#d23a52" flat /> : null)}
            </div>
          </div>
          <div style={{ marginTop: 12, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Area / unit</th>{QS.map((q) => <th key={q} style={{ ...th, textAlign: 'center' }}>{q}</th>)}<th style={{ ...th, textAlign: 'right' }}>Compliance</th></tr></thead>
              <tbody>{areas.map((a) => { let aok = 0, ab = 0; a.indicators.forEach((ind) => QS.forEach((q) => { const s = qstatus(ind, q); if (s === 'ok') aok++; else if (s === 'breach') ab++; })); const rate = aok + ab ? Math.round(aok * 100 / (aok + ab)) : 100; return (
                <tr key={a.key}><td style={{ ...td, fontWeight: 600 }}>{a.name} <span style={{ color: '#8a93a3', fontWeight: 400 }}>· {a.indicators.length} ind.</span></td>
                  {QS.map((q) => { let b = 0, rep = 0; a.indicators.forEach((ind) => { const s = qstatus(ind, q); if (s === 'breach') b++; if (s !== 'na') rep++; }); const s = rep === 0 ? 'na' : b > 0 ? 'breach' : 'ok'; return <td key={q} style={{ ...td, textAlign: 'center' }}>{cell(s, rep === 0 ? '–' : b > 0 ? b : '✓')}</td>; })}
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{rate}%</td></tr>
              ); })}</tbody>
            </table>
          </div>
          <Foot />
        </section>
        {/* one page per area */}
        {areas.map((a) => {
          const chartData = a.indicators.map((ind) => { let v = null; for (let i = QS.length - 1; i >= 0; i--) { const x = qval(ind, QS[i]); if (x != null && x !== '') { v = x; break; } } return { label: (ind.name || '').slice(0, 18), value: Number(v) || 0 }; });
          return (
            <section className="pdf-page" key={a.key} style={{ fontFamily: "'IBM Plex Sans',Arial,sans-serif", color: '#16202e' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderBottom: '2px solid #0090ca', paddingBottom: 6, marginBottom: 12 }}>
                <div><div style={{ fontSize: 16, fontWeight: 800, color: '#0072a3' }}>{a.name}</div><div style={{ fontSize: 11, color: '#5b6672' }}>Quality indicators · {a.indicators.length}</div></div>
                <div style={{ textAlign: 'right', fontSize: 10, color: '#8a93a3' }}>{hospital} · {date}</div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
                <thead><tr><th style={th}>Indicator</th><th style={th}>Benchmark</th>{QS.map((q) => <th key={q} style={{ ...th, textAlign: 'center' }}>{q}</th>)}<th style={th}>Unit</th></tr></thead>
                <tbody>{a.indicators.map((ind) => (
                  <tr key={ind.id}><td style={{ ...td, fontWeight: 600 }}>{ind.name}</td><td style={td}>{ind.benchmark || (ind.benchmarkValue != null && ind.benchmarkValue !== '' ? (ind.goalDirection === 'higher_is_better' ? '≥ ' : '≤ ') + ind.benchmarkValue : '—')}</td>
                    {QS.map((q) => <td key={q} style={{ ...td, textAlign: 'center' }}>{cell(qstatus(ind, q), fmtv(ind, q))}</td>)}
                    <td style={td}>{ind.unit || ''}</td></tr>
                ))}</tbody>
              </table>
              {chartData.some((d) => d.value) && typeof BarChart === 'function' && (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Latest reported value by indicator</div>
                  <BarChart data={chartData} x="label" y="value" height={195} color="#0090ca" flat />
                </div>
              )}
              <Foot />
            </section>
          );
        })}
      </div>
    );
  }

  /* ============================ Hand Hygiene Compliance report (A4) ============================
     A dedicated WHO-style report for Hand Hygiene Compliance: monthly compliance trend vs the
     ≥90% benchmark, staff-group breakdown (Nurse/Doctor/PCA/Other) and department breakdown for
     the latest reported month, plus a monthly table & WHO interpretation. Reads the same
     window.qualityData() the forms write (mNum/mDen, mGroups/mGroupsDen, mDeptBreakdown). */
  function HHReportDoc() {
    const areas = (typeof window.qualityData === 'function' ? window.qualityData() : []);
    const HH = [];
    areas.forEach((a) => (a.indicators || []).forEach((ind) => { if (/hand\s*hygiene/i.test(ind.name || '')) HH.push({ area: a, ind }); }));
    const QM = window.QUALITY_QUARTER_MONTHS || { Q1: ['Jun-25', 'Jul-25', 'Aug-25'], Q2: ['Sep-25', 'Oct-25', 'Nov-25'], Q3: ['Dec-25', 'Jan-26', 'Feb-26'], Q4: ['Mar-26', 'Apr-26', 'May-26'] };
    const months = ['Q1', 'Q2', 'Q3', 'Q4'].reduce((x, q) => x.concat(QM[q] || []), []);
    const mComp = (ind, m) => { const n = ind.mNum && ind.mNum[m], d = ind.mDen && ind.mDen[m]; if (n != null && n !== '' && d != null && d !== '' && Number(d) > 0) return Math.round((Number(n) / Number(d)) * 10000) / 100; const v = ind.months && ind.months[m]; return (v != null && v !== '') ? Number(v) : null; };
    let primary = null;
    HH.forEach((h) => { if (!primary && /overall|hospital/i.test((h.area.name || '') + ' ' + (h.ind.name || ''))) primary = h.ind; });
    if (!primary && HH.length) primary = HH[0].ind;
    const hospital = 'UNICO Hospitals';
    let date = ''; try { date = new Date().toISOString().slice(0, 10); } catch (e) { }
    const bench = (primary && primary.benchmarkValue != null && primary.benchmarkValue !== '') ? Number(primary.benchmarkValue) : 90;
    const whoStatus = (pct) => pct == null ? { label: '—', color: '#8a93a3' } : pct >= 90 ? { label: 'Compliant', color: '#1f9d57' } : pct >= 75 ? { label: 'Needs improvement', color: '#e08a1e' } : { label: 'Unacceptable', color: '#d23a52' };
    const shortM = (m) => (monthLabel(m) || m).replace(' 20', ' ');
    const series = primary ? months.map((m) => ({ m, label: shortM(m), value: mComp(primary, m) })).filter((r) => r.value != null) : [];
    const latest = series.length ? series[series.length - 1] : null;
    const avg = series.length ? Math.round(series.reduce((s, r) => s + r.value, 0) / series.length * 10) / 10 : null;
    const latestM = latest ? latest.m : months[months.length - 1];
    const GROUP_KEYS = [['nurse', 'Nurse'], ['doctor', 'Doctor'], ['pca', 'PCA'], ['other', 'Other']];
    const gN = primary && primary.mGroups && primary.mGroups[latestM];
    const gD = primary && primary.mGroupsDen && primary.mGroupsDen[latestM];
    const groupChart = (gN && gD) ? GROUP_KEYS.map(([k, lbl]) => { const n = Number(gN[k]) || 0, d = Number(gD[k]) || 0; return { label: lbl, value: d > 0 ? Math.round(n / d * 10000) / 100 : 0, n, d }; }).filter((x) => x.d > 0) : [];
    const dep = primary && primary.mDeptBreakdown && primary.mDeptBreakdown[latestM];
    const deptChart = Array.isArray(dep) ? dep.map((row) => { let n = 0, d = 0; Object.keys(row.g || {}).forEach((k) => { n += Number(row.g[k].n) || 0; d += Number(row.g[k].d) || 0; }); return { label: (row.dept || '—').slice(0, 16), value: d > 0 ? Math.round(n / d * 10000) / 100 : 0, n, d }; }).filter((x) => x.d > 0) : [];
    const th = { textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: .4, color: '#5b6672', padding: '6px 8px', borderBottom: '2px solid #d7dee7' };
    const td = { fontSize: 11, padding: '5px 8px', borderBottom: '1px solid #eef1f5', color: '#1f2a37' };
    const KPI = ({ label, value, color, foot }) => (<div style={{ border: '1px solid #e2e8f0', borderLeft: '4px solid ' + (color || '#0090ca'), borderRadius: 8, padding: '10px 13px' }}><div style={{ fontSize: 10.5, fontWeight: 700, color: '#5b6672', textTransform: 'uppercase', letterSpacing: .3 }}>{label}</div><div style={{ fontSize: 24, fontWeight: 800, color: color || '#0f2c4d', lineHeight: 1.1 }}>{value}</div>{foot ? <div style={{ fontSize: 10, color: '#8a93a3' }}>{foot}</div> : null}</div>);
    const Foot = () => <div className="pdf-foot" style={{ marginTop: 12, color: '#9aa6b4', fontSize: 9, borderTop: '1px solid #e4e9f0', paddingTop: 6 }}>{hospital} · Hand Hygiene Compliance · Confidential · Generated {date} · WHO benchmark ≥ {bench}%</div>;
    if (!primary) return <div className="pdf-doc"><section className="pdf-page" style={{ fontFamily: "'IBM Plex Sans',Arial,sans-serif", padding: 20 }}><h2 style={{ color: '#0072a3' }}>Hand Hygiene Compliance Report</h2><p>No Hand Hygiene Compliance indicator found in the quality data. Record it first in Quality Data.</p></section></div>;
    const lst = latest ? latest.value : null; const st = whoStatus(lst);
    return (
      <div className="pdf-doc">
        <section className="pdf-page" style={{ fontFamily: "'IBM Plex Sans',Arial,sans-serif", color: '#16202e' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderBottom: '2px solid #0090ca', paddingBottom: 8, marginBottom: 14 }}>
            <div><div style={{ fontSize: 20, fontWeight: 800, color: '#0072a3' }}>{hospital}</div><div style={{ fontSize: 13, fontWeight: 600 }}>Hand Hygiene Compliance Report</div></div>
            <div style={{ textAlign: 'right', fontSize: 10.5, color: '#8a93a3' }}>Generated {date}<br />WHO 5 Moments · benchmark ≥ {bench}%</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
            <KPI label={'Latest (' + (latest ? latest.label : '—') + ')'} value={lst != null ? lst + '%' : '—'} color={st.color} foot={st.label} />
            <KPI label="Average" value={avg != null ? avg + '%' : '—'} color="#0090ca" foot={series.length + ' months reported'} />
            <KPI label="Benchmark" value={'≥ ' + bench + '%'} color="#6a52d4" foot="WHO compliant target" />
            <KPI label="Months on target" value={series.filter((r) => r.value >= bench).length + '/' + series.length} color="#1f9d57" />
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Monthly compliance trend (%)</div>
            {series.length && typeof LineChart === 'function' ? <LineChart data={series} x="label" y="value" height={200} color="#1f9d57" flat /> : (typeof BarChart === 'function' ? <BarChart data={series} x="label" y="value" height={200} color="#1f9d57" flat /> : null)}
            <div style={{ fontSize: 10, color: '#8a93a3', marginTop: 4 }}>Monthly compliance %. WHO compliant target ≥ {bench}%.</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Month</th><th style={{ ...th, textAlign: 'right' }}>Compliant</th><th style={{ ...th, textAlign: 'right' }}>Opportunities</th><th style={{ ...th, textAlign: 'right' }}>Compliance</th><th style={th}>Status</th></tr></thead>
            <tbody>{series.map((r) => { const n = primary.mNum && primary.mNum[r.m], d = primary.mDen && primary.mDen[r.m]; const s = whoStatus(r.value); return (
              <tr key={r.m}><td style={{ ...td, fontWeight: 600 }}>{monthLabel(r.m)}</td><td style={{ ...td, textAlign: 'right' }}>{n != null ? n : '—'}</td><td style={{ ...td, textAlign: 'right' }}>{d != null ? d : '—'}</td><td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{r.value}%</td><td style={td}><span style={{ fontSize: 10, fontWeight: 700, color: s.color }}>{s.label}</span></td></tr>
            ); })}
            {series.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: '#8a93a3' }}>No hand hygiene data recorded yet.</td></tr>}</tbody>
          </table>
          <Foot />
        </section>
        {(groupChart.length || deptChart.length) ? (
          <section className="pdf-page" style={{ fontFamily: "'IBM Plex Sans',Arial,sans-serif", color: '#16202e' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderBottom: '2px solid #0090ca', paddingBottom: 6, marginBottom: 12 }}>
              <div><div style={{ fontSize: 16, fontWeight: 800, color: '#0072a3' }}>Breakdown — {latest ? latest.label : monthLabel(latestM)}</div><div style={{ fontSize: 11, color: '#5b6672' }}>Hand hygiene compliance by staff group &amp; department</div></div>
              <div style={{ textAlign: 'right', fontSize: 10, color: '#8a93a3' }}>{hospital} · {date}</div>
            </div>
            {groupChart.length ? (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>By staff group (compliance %)</div>
                {typeof BarChart === 'function' ? <BarChart data={groupChart} x="label" y="value" height={175} color="#0090ca" flat /> : null}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}><thead><tr><th style={th}>Group</th><th style={{ ...th, textAlign: 'right' }}>Compliant</th><th style={{ ...th, textAlign: 'right' }}>Opportunities</th><th style={{ ...th, textAlign: 'right' }}>Compliance</th></tr></thead><tbody>{groupChart.map((g) => <tr key={g.label}><td style={{ ...td, fontWeight: 600 }}>{g.label}</td><td style={{ ...td, textAlign: 'right' }}>{g.n}</td><td style={{ ...td, textAlign: 'right' }}>{g.d}</td><td style={{ ...td, textAlign: 'right', fontWeight: 700, color: whoStatus(g.value).color }}>{g.value}%</td></tr>)}</tbody></table>
              </div>
            ) : null}
            {deptChart.length ? (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>By department (compliance %)</div>
                {typeof BarChart === 'function' ? <BarChart data={deptChart} x="label" y="value" height={190} color="#6a52d4" flat /> : null}
              </div>
            ) : null}
            <div style={{ marginTop: 12, background: '#eef8fc', border: '1px solid #cfe6f7', borderRadius: 9, padding: '10px 13px', fontSize: 11, color: '#0072a3' }}>
              <b>Interpretation (WHO):</b> ≥ {bench}% compliant · 75–89% needs improvement (re-audit within 2 weeks) · &lt; 75% unacceptable (escalate). Reference: WHO (2009), Guidelines on Hand Hygiene in Health Care.
            </div>
            <Foot />
          </section>
        ) : null}
      </div>
    );
  }

  function DataReview() {
    const [rows, setRows] = useState(null);
    const [report, setReport] = useState(null); // null | 'quality' | 'hh'
    useEffect(() => { const cleanup = () => { try { document.body.classList.remove('pdf-export-mode'); } catch (e) { } }; window.addEventListener('afterprint', cleanup); return () => window.removeEventListener('afterprint', cleanup); }, []);
    const printReport = (kind) => {
      const go = () => { try { document.body.classList.add('pdf-export-mode'); window.print(); } catch (e) { } };
      if (report === kind) go(); else { setReport(kind); setTimeout(go, 240); }
    };
    const [stats, setStats] = useState(null);
    const [filter, setFilter] = useState('pending');
    const [busy, setBusy] = useState('');
    const [detail, setDetail] = useState(null);
    const when = (ts) => { try { return new Date(ts).toLocaleString(); } catch (e) { return ''; } };
    const load = () => {
      dcApi.get('/api/submissions?status=' + filter + '&limit=300').then((r) => setRows(r.ok ? r.submissions : [])).catch(() => setRows([]));
      dcApi.get('/api/submissions/stats').then((r) => setStats(r.ok ? r.stats : null)).catch(() => {});
    };
    useEffect(() => { setRows(null); load(); }, [filter]);

    const act = (id, kind) => {
      let reason = '';
      if (kind === 'reject') { reason = (window.prompt && window.prompt('Reason for rejecting (optional):')) || ''; }
      setBusy(id);
      dcApi.post('/api/submissions/' + encodeURIComponent(id) + '/' + kind, kind === 'reject' ? { reason } : {}).then((r) => {
        setBusy('');
        if (r.ok) { toast(kind === 'approve' ? 'Approved — applied to live data' : 'Submission rejected', kind === 'approve' ? 'success' : 'info'); load(); }
        else toast(r.error || 'Action failed', 'error');
      }).catch(() => { setBusy(''); toast('Action failed', 'error'); });
    };

    const statusChip = (st) => {
      const map = { pending: ['Pending', 'var(--warn-bg,#fff4e0)', '#9a6b00'], approved: ['Approved', 'var(--pos-bg)', 'var(--pos)'], rejected: ['Rejected', 'var(--neg-bg)', 'var(--rose)'] };
      const m = map[st] || ['—', 'var(--panel-2)', 'var(--muted)'];
      return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: m[1], color: m[2] }}>{m[0]}</span>;
    };

    const tabs = [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']];
    return (
      <div className="grid" style={{ gap: 14 }}>
        <SectionTitle icon={I.doc} title="Review & History" sub="Every submission with time, data and status. Submissions stay pending until an admin approves — approval applies them to the live dashboard."
          right={<>
            <button className="btn sm pri" onClick={() => printReport('hh')} title="Hand Hygiene Compliance report (WHO) — trend, staff-group & department breakdown" style={{ background: '#3ab5a7', borderColor: '#3ab5a7' }}><Ic d={I.download} s={14} />Hand Hygiene Report</button>
            <button className="btn sm pri" onClick={() => printReport('quality')} title="Generate a print-ready A4 quality report with graphs"><Ic d={I.download} s={14} />Quality Report (PDF)</button>
            <button className="btn sm" onClick={load}><Ic d={I.trend} s={14} />Refresh</button>
          </>} />

        {stats && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <StatCard label="Total" value={stats.total} />
            <StatCard label="Pending" value={stats.pending} color={stats.pending ? '#b8860b' : 'var(--ink)'} />
            <StatCard label="Approved" value={stats.approved} color="var(--pos)" />
            <StatCard label="Rejected" value={stats.rejected} color="var(--rose)" />
            <StatCard label="Patient" value={stats.patient} color="var(--blue)" />
            <StatCard label="Quality" value={stats.quality} color="var(--blue)" />
          </div>
        )}

        <div className="seg" style={{ alignSelf: 'flex-start' }}>
          {tabs.map(([id, l]) => <button key={id} className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>{l}{id === 'pending' && stats && stats.pending ? ' (' + stats.pending + ')' : ''}</button>)}
        </div>

        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {rows === null ? <div style={{ padding: 24, color: 'var(--muted)' }}>Loading…</div>
            : rows.length === 0 ? <div style={{ padding: 24, color: 'var(--muted)', textAlign: 'center' }}>No {filter === 'all' ? '' : filter} submissions.</div>
              : <table className="tbl" style={{ width: '100%' }}>
                <thead><tr><th>When</th><th>Type</th><th>Target</th><th>Data</th><th>Responsible</th><th>By</th><th>Status</th><th></th></tr></thead>
                <tbody>{rows.map((s) => (
                  <tr key={s.id}>
                    <td style={{ whiteSpace: 'nowrap' }} className="num">{when(s.submittedAt)}</td>
                    <td><span className="chip" style={{ background: s.type === 'quality' ? 'var(--blue-50)' : 'var(--pos-bg)' }}>{s.type === 'quality' ? 'Quality' : 'Patient'}</span></td>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{s.type === 'quality' ? s.areaName : s.departmentName}</td>
                    <td style={{ fontSize: 12, color: 'var(--ink-2)', maxWidth: 320 }}>{valuesSummary(s)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{(s.responsible && s.responsible.name) || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{s.submittedBy || '—'}</td>
                    <td>{statusChip(s.status)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn sm" onClick={() => setDetail(s)} style={{ marginRight: 5 }}><Ic d={I.search} s={13} />View</button>
                      {s.status === 'pending' && (
                        <>
                          <button className="btn sm pri" disabled={busy === s.id} onClick={() => act(s.id, 'approve')} style={{ marginRight: 5 }}><Ic d={I.check} s={13} />Approve</button>
                          <button className="btn sm" disabled={busy === s.id} onClick={() => act(s.id, 'reject')}>Reject</button>
                        </>
                      )}
                      {s.status !== 'pending' && s.reviewedBy && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{s.reviewedBy}</span>}
                    </td>
                  </tr>
                ))}</tbody>
              </table>}
        </Card>
        {detail && <SubmissionDetail s={detail} canEdit={true} onClose={() => setDetail(null)} onSaved={() => { setDetail(null); load(); }} />}
        {report && typeof document !== 'undefined' && document.getElementById('pdf-root') && ReactDOM.createPortal(report === 'hh' ? <HHReportDoc /> : <QualityReportDoc />, document.getElementById('pdf-root'))}
      </div>
    );
  }

  /* ============================ Share Links ============================ */
  function DataShareLinks({ depts }) {
    const all = (depts && depts.length) ? depts : dcAllDepts();
    const areas = useMemo(() => (window.qualityData ? window.qualityData() : []).map((d) => ({ key: d.key, name: d.name })), []);
    const [links, setLinks] = useState(null);
    const [resps, setResps] = useState([]);
    const [form, setForm] = useState({ type: 'patient', department: (all[0] && all[0].id) || '', area: (areas[0] && areas[0].key) || '', responsible: '', label: '' });
    const load = () => dcApi.get('/api/shortlinks').then((r) => setLinks(r.ok ? r.links : [])).catch(() => setLinks([]));
    useEffect(() => { load(); dcApi.get('/api/responsibles').then((r) => setResps(r.ok ? r.responsibles : [])).catch(() => {}); }, []);
    const origin = (typeof window !== 'undefined' && window.location && window.location.origin) || '';
    const fullUrl = (code) => origin + '/s/' + code;

    const create = () => {
      const matched = resps.find((r) => r.name === form.responsible);
      const body = { type: form.type, label: form.label, responsible: matched ? { id: matched.id, name: matched.name } : (form.responsible ? { name: form.responsible } : null) };
      if (form.type === 'patient') body.department = form.department; else body.area = form.area;
      dcApi.post('/api/shortlinks', body).then((r) => { if (r.ok) { toast('Share link created', 'success'); setForm({ ...form, label: '' }); load(); } else toast(r.error || 'Could not create', 'error'); });
    };
    const copy = (code) => { try { navigator.clipboard.writeText(fullUrl(code)); toast('Link copied to clipboard', 'success'); } catch (e) { window.prompt('Copy this link:', fullUrl(code)); } };
    const remove = (code) => { const go = () => dcApi.del('/api/shortlinks/' + encodeURIComponent(code)).then(load); if (window.UI && window.UI.confirm) window.UI.confirm('Delete this share link?').then((ok) => ok && go()); else if (window.confirm('Delete this share link?')) go(); };

    const assigned = form.type === 'patient'
      ? resps.filter((r) => (r.departments || []).includes(form.department))
      : resps.filter((r) => (r.qualityAreas || []).includes(form.area));

    return (
      <div className="grid" style={{ gap: 14 }}>
        <SectionTitle icon={I.arrowR} title="Share Links" sub="Create a short link to a single form and share it (e.g. with Rabbi Miah for Cathlab). Anyone with the link can submit — no login — and it lands in Review & History." />
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>New share link</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Form type">
              <select style={inputStyle} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="patient">Patient Statistics</option>
                <option value="quality">Quality Data</option>
              </select>
            </Field>
            {form.type === 'patient'
              ? <Field label="Department"><select style={inputStyle} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>{all.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
              : <Field label="Quality area"><select style={inputStyle} value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}>{areas.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}</select></Field>}
          </div>
          <Field label="Responsible person (who will fill this in)" hint={assigned.length ? 'Assigned: ' + assigned.map((a) => a.name).join(', ') : 'Pick from staff or type a name.'}>
            <ResponsiblePicker value={form.responsible} onChange={(v) => setForm({ ...form, responsible: v })} suggestions={assigned} />
          </Field>
          <Field label="Label (optional)"><input style={inputStyle} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Cathlab monthly stats — Rabbi Miah" /></Field>
          <button className="btn pri" onClick={create}><Ic d={I.plus} s={15} />Create link</button>
        </Card>

        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {links === null ? <div style={{ padding: 24, color: 'var(--muted)' }}>Loading…</div>
            : links.length === 0 ? <div style={{ padding: 24, color: 'var(--muted)', textAlign: 'center' }}>No share links yet.</div>
              : <table className="tbl" style={{ width: '100%' }}>
                <thead><tr><th>Link</th><th>Type</th><th>Target</th><th>Responsible</th><th>Hits</th><th></th></tr></thead>
                <tbody>{links.map((l) => (
                  <tr key={l.code}>
                    <td><a href={fullUrl(l.code)} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', fontFamily: 'var(--mono)', fontSize: 12 }}>/s/{l.code}</a></td>
                    <td>{l.type === 'quality' ? 'Quality' : 'Patient'}</td>
                    <td style={{ fontWeight: 600 }}>{l.type === 'quality' ? l.area : ((all.find((d) => d.id === l.department) || {}).name || l.department)}</td>
                    <td>{(l.responsible && l.responsible.name) || '—'}</td>
                    <td className="num">{l.hits || 0}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn sm" onClick={() => copy(l.code)} style={{ marginRight: 5 }}><Ic d={I.download} s={13} />Copy</button>
                      <button className="icon-btn" title="Delete" style={{ color: 'var(--rose)' }} onClick={() => remove(l.code)}><Ic d={I.x} s={14} /></button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>}
        </Card>
      </div>
    );
  }

  /* ===================== Collector Portal (role: collector) =====================
     A standalone, stripped-down screen for data collectors: ONLY the submit forms
     they're assigned + their own submission history. No sidebar, dashboard,
     departments, staff or any other module. Rendered by app.jsx when the signed-in
     user's role is "collector". */
  // Existing data already on record for the collector's assigned departments / areas
  // (web.js scopes window.UNICO.DEPARTMENTS + qualityData per collector). Shown in
  // "My data" so the records match what the month dropdown flags as "reported".
  function reportedRecords() {
    const out = [];
    const liveDepts = dcAllDepts();
    liveDepts.forEach((d) => (d.series || []).forEach((r) => {
      const values = {}; Object.keys(r).forEach((k) => { if (k !== 'month' && k !== 'full') values[k] = r[k]; });
      out.push({ id: 'rec-p-' + d.id + '-' + r.month, type: 'patient', department: d.id, departmentName: d.name, month: r.month, values, status: 'reported', submittedAt: null });
    }));
    const liveAreas = (window.qualityData ? window.qualityData() : []);
    liveAreas.forEach((a) => (a.indicators || []).forEach((ind) => ['Q1', 'Q2', 'Q3', 'Q4'].forEach((q) => {
      const v = ind.quarters && ind.quarters[q];
      if (v == null || v === '') return;
      out.push({ id: 'rec-q-' + a.key + '-' + ind.id + '-' + q, type: 'quality', area: a.key, areaName: a.name, indicatorId: ind.id, indicatorName: ind.name, quarter: q, value: v, remark: (ind.quarterRemarks && ind.quarterRemarks[q]) || '', status: 'reported', submittedAt: null });
    })));
    return out;
  }
  function CollectorHistory() {
    const [rows, setRows] = useState(null);
    const [detail, setDetail] = useState(null);
    const [view, setView] = useState('patient');
    const load = () => dcApi.get('/api/submissions?limit=300').then((r) => setRows(r.ok ? r.submissions : [])).catch(() => setRows([]));
    useEffect(() => { load(); }, []);
    const when = (ts) => { try { return ts ? new Date(ts).toLocaleString() : '—'; } catch (e) { return '—'; } };
    const statusChip = (st) => {
      const m = { pending: ['Pending', '#fff4e0', '#9a6b00'], approved: ['Approved', 'var(--pos-bg)', 'var(--pos)'], rejected: ['Rejected', 'var(--neg-bg)', 'var(--rose)'], reported: ['On record', 'var(--blue-50)', 'var(--blue-700)'] }[st] || ['—', '#eef1f5', '#789'];
      return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: m[1], color: m[2] }}>{m[0]}</span>;
    };
    // Merge the collector's submissions with existing on-record data, de-duped by
    // department+month (patient) / area+indicator+quarter (quality) — a submission
    // supersedes the matching record row.
    const keyOf = (s) => s.type === 'quality' ? ('q|' + s.area + '|' + (s.indicatorId || s.indicatorName) + '|' + s.quarter) : ('p|' + s.department + '|' + s.month);
    const subs = rows || [];
    const subKeys = new Set(subs.map(keyOf));
    const merged = subs.concat(reportedRecords().filter((r) => !subKeys.has(keyOf(r))))
      .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
    // Split into Patient / Quality tabs (like the top-level forms).
    const patientRows = merged.filter((s) => s.type !== 'quality');
    const qualityRows = merged.filter((s) => s.type === 'quality');
    const avail = []; if (patientRows.length) avail.push('patient'); if (qualityRows.length) avail.push('quality');
    const active = avail.indexOf(view) >= 0 ? view : (avail[0] || 'patient');
    const isQ = active === 'quality';
    const shown = isQ ? qualityRows : patientRows;
    return (
      <>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--line-2)', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700 }}>My data — submissions &amp; what's on record</div>
          {merged.length > 0 && (
            <div className="seg">
              {avail.indexOf('patient') >= 0 && <button className={active === 'patient' ? 'on' : ''} onClick={() => setView('patient')}><Ic d={I.input} s={13} />Patient Statistics ({patientRows.length})</button>}
              {avail.indexOf('quality') >= 0 && <button className={active === 'quality' ? 'on' : ''} onClick={() => setView('quality')}><Ic d={I.activity} s={13} />Quality Data ({qualityRows.length})</button>}
            </div>
          )}
          <span style={{ flex: 1 }} />
          <button className="btn sm" onClick={load}><Ic d={I.trend} s={13} />Refresh</button>
        </div>
        {rows === null ? <div style={{ padding: 24, color: 'var(--muted)' }}>Loading…</div>
          : merged.length === 0 ? <div style={{ padding: 28, color: 'var(--muted)', textAlign: 'center' }}>No data yet for your assigned departments.</div>
            : <div style={{ overflowX: 'auto' }}><table className="tbl" style={{ width: '100%' }}>
              <thead><tr><th>Submitted on</th>{isQ ? <React.Fragment><th>Area</th><th>Indicator</th><th>Quarter</th></React.Fragment> : <React.Fragment><th>Department</th><th>Month</th></React.Fragment>}<th>Status</th><th></th></tr></thead>
              <tbody>{shown.map((s) => (
                <tr key={s.id}>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>{when(s.submittedAt)}</td>
                  {isQ
                    ? <React.Fragment><td style={{ fontWeight: 600 }}>{s.areaName}</td><td>{s.indicatorName}</td><td>{s.quarter}</td></React.Fragment>
                    : <React.Fragment><td style={{ fontWeight: 600 }}>{s.departmentName}</td><td>{monthLabel(s.month)}</td></React.Fragment>}
                  <td>{statusChip(s.status)}</td>
                  <td style={{ textAlign: 'right' }}><button className="btn sm" onClick={() => setDetail(s)}><Ic d={I.search} s={13} />View</button></td>
                </tr>
              ))}</tbody>
            </table></div>}
      </Card>
      {detail && <SubmissionDetail s={detail} canEdit={false} onClose={() => setDetail(null)} />}
      </>
    );
  }

  /* Submission-status board: which of the collector's assigned quality indicators are
     Recorded / Pending / Not-submitted for a chosen month. Responsive (auto-fit cards). */
  function CollectorStatus({ onFill }) {
    const areas = useMemo(() => (window.qualityData ? window.qualityData() : []).filter((a) => a && a.indicators && a.indicators.length), []);
    const fyMonths = (window.QUALITY_QUARTER_MONTHS) ? ['Q1', 'Q2', 'Q3', 'Q4'].reduce((a, q) => a.concat(window.QUALITY_QUARTER_MONTHS[q] || []), []) : [];
    const monthOpts = dcWideMonths();
    const [month, setMonth] = useState((fyMonths.length ? fyMonths[fyMonths.length - 1] : 'May-26') || '');
    const [subs, setSubs] = useState(null);
    useEffect(() => { dcApi.get('/api/submissions?limit=500').then((r) => setSubs(r.ok ? (r.submissions || []) : [])).catch(() => setSubs([])); }, []);
    const hasData = (ind, m) => { const f = (o) => o && o[m] != null && o[m] !== ''; return f(ind.mNum) || f(ind.mDen) || f(ind.months) || (ind.incidents && Array.isArray(ind.incidents[m]) && ind.incidents[m].length > 0); };
    const pendingFor = (areaKey, ind, m) => (subs || []).some((s) => s.type === 'quality' && s.area === areaKey && s.month === m && s.status === 'pending' && (s.indicatorId === ind.id || (s.indicatorName || '').toLowerCase().trim() === (ind.name || '').toLowerCase().trim()));
    const statusOf = (areaKey, ind, m) => hasData(ind, m) ? 'recorded' : pendingFor(areaKey, ind, m) ? 'pending' : 'none';
    const tone = { recorded: ['var(--pos)', 'var(--pos-bg)', 'Recorded'], pending: ['#9a6b00', '#fff4e0', 'Pending'], none: ['var(--rose)', 'var(--neg-bg)', 'Not submitted'] };
    let totalInd = 0, rec = 0, pend = 0;
    areas.forEach((a) => a.indicators.forEach((ind) => { totalInd++; const s = statusOf(a.key, ind, month); if (s === 'recorded') rec++; else if (s === 'pending') pend++; }));
    const notSub = totalInd - rec - pend;
    const pct = totalInd ? Math.round((rec + pend) * 100 / totalInd) : 0;
    const sel = { padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#fff' };
    const Kpi = ({ label, val, color }) => (<div style={{ flex: 1, minWidth: 110, border: '1px solid var(--line)', borderLeft: '4px solid ' + color, borderRadius: 10, padding: '12px 14px', background: '#fff' }}><div className="num" style={{ fontSize: 22, fontWeight: 800, color }}>{val}</div><div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{label}</div></div>);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Submission status</div>
          <span style={{ flex: 1 }} />
          <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Month</label>
          <select style={sel} value={month} onChange={(e) => setMonth(e.target.value)}>{monthOpts.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Which of your assigned indicators are submitted for <b style={{ color: 'var(--ink)' }}>{monthLabel(month)}</b>. <span style={{ color: 'var(--rose)', fontWeight: 600 }}>Red = still needs data.</span> <b style={{ color: 'var(--blue-700)' }}>Tap any indicator to fill or correct it →</b></div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Kpi label="Coverage" val={pct + '%'} color="#0090ca" />
          <Kpi label="Recorded" val={rec} color="var(--pos)" />
          <Kpi label="Pending review" val={pend} color="#9a6b00" />
          <Kpi label="Not submitted" val={notSub} color={notSub ? 'var(--rose)' : 'var(--pos)'} />
        </div>
        {subs === null ? <div style={{ padding: 20, color: 'var(--muted)' }}>Loading…</div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 12 }}>
            {areas.map((a) => {
              let ar = 0, ap = 0; a.indicators.forEach((ind) => { const s = statusOf(a.key, ind, month); if (s === 'recorded') ar++; else if (s === 'pending') ap++; });
              const acov = a.indicators.length ? Math.round((ar + ap) * 100 / a.indicators.length) : 0;
              return (
                <div key={a.key} style={{ border: '1px solid var(--line)', borderRadius: 11, background: '#fff', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 13px', borderBottom: '1px solid var(--line-2)' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', minWidth: 0, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: acov === 100 ? 'var(--pos-bg)' : acov > 0 ? '#fff4e0' : 'var(--neg-bg)', color: acov === 100 ? 'var(--pos)' : acov > 0 ? '#9a6b00' : 'var(--rose)' }}>{ar + ap}/{a.indicators.length}</span>
                  </div>
                  <div style={{ padding: '4px 0' }}>
                    {a.indicators.map((ind) => { const st = statusOf(a.key, ind, month); const t = tone[st]; return (
                      <div key={ind.id} onClick={() => onFill && onFill(a.key, ind.id, month)} title={st === 'recorded' ? 'View / submit a correction' : 'Click to fill this now'}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 13px', cursor: 'pointer' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--panel-2)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                        <div style={{ fontSize: 12, color: 'var(--ink-2)', minWidth: 0, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ind.name}</div>
                        <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: t[1], color: t[0], whiteSpace: 'nowrap' }}>{t[2]}</span>
                        <Ic d={I.chevR} s={13} c="var(--faint)" />
                      </div>
                    ); })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function CollectorPortal() {
    const user = (typeof window !== 'undefined' && window.__UNICO_USER__) || {};
    // Merged list so a newly-created custom department the collector is assigned to
    // appears (and so the Patient Statistics tab shows when they only own a custom one).
    const depts = dcAllDepts();
    const areas = (window.qualityData ? window.qualityData() : []);
    const hasPatient = depts.length > 0;
    const hasQuality = areas.length > 0;
    const tabs = [];
    if (hasQuality) tabs.push(['status', 'Submission status', I.grid]);
    if (hasQuality) tabs.push(['quality', 'Quality Data', I.activity]);
    if (hasPatient) tabs.push(['patient', 'Patient Statistics', I.input]);
    tabs.push(['history', 'My Submissions', I.doc]);
    const [tab, setTab] = useState(tabs[0][0]);
    // Interactive: clicking an indicator on the status board jumps to the Quality Data
    // form pre-filled for that area / indicator / month (turns the board into a to-do list).
    const [jump, setJump] = useState(null);
    const fillFor = (area, indicatorId, m) => { setJump({ area, indicatorId, month: m }); setTab('quality'); };

    const tabBtn = (id, label, icon) => (
      <button key={id} onClick={() => setTab(id)} style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 15px', borderRadius: 9, cursor: 'pointer',
        border: '1px solid ' + (tab === id ? 'var(--blue)' : 'var(--line)'), background: tab === id ? 'var(--blue)' : '#fff',
        color: tab === id ? '#fff' : 'var(--ink-2)', fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
      }}><Ic d={icon} s={15} />{label}</button>
    );

    return (
      <div style={{ height: '100vh', overflowY: 'auto', background: '#eef2f7' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', height: 58, background: '#0d1b2e', color: '#fff', position: 'sticky', top: 0, zIndex: 10 }}>
          <img src="unico/logo.svg" alt="UNICO" style={{ height: 24 }} />
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>Data Collection</div>
          <span style={{ flex: 1 }} />
          <div style={{ textAlign: 'right', lineHeight: 1.2, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '40vw' }}>{user.name || 'Collector'}</div>
            <div style={{ fontSize: 10.5, color: '#83909f' }}>Data Collector</div>
          </div>
          <a href="/logout" style={{ fontSize: 12, fontWeight: 600, color: '#cfe0f0', textDecoration: 'none', border: '1px solid rgba(255,255,255,.22)', borderRadius: 8, padding: '7px 12px', whiteSpace: 'nowrap' }}>Sign out</a>
        </div>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '18px 14px 70px' }}>
          <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--muted)' }}>
            Welcome, <b style={{ color: 'var(--ink)' }}>{user.name}</b>. Submit your assigned data below — every submission goes to the administrator for review.
            {!hasPatient && !hasQuality && <span style={{ color: 'var(--rose)', fontWeight: 600 }}> No departments assigned yet — please contact your administrator.</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>{tabs.map((t) => tabBtn(t[0], t[1], t[2]))}</div>
          {tab === 'patient' && hasPatient && <DataPatientForm depts={depts} prefill={{ responsible: user.name }} />}
          {tab === 'status' && hasQuality && <CollectorStatus onFill={fillFor} />}
          {tab === 'quality' && hasQuality && <DataQualityForm key={jump ? jump.area + '/' + jump.indicatorId + '/' + jump.month : 'q'} prefill={{ responsible: user.name, area: jump && jump.area, indicatorId: jump && jump.indicatorId, month: jump && jump.month }} />}
          {tab === 'history' && <CollectorHistory />}
        </div>
      </div>
    );
  }

  Object.assign(window, { DataResponsibles, DataPatientForm, DataQualityForm, DataReview, DataShareLinks, CollectorPortal });
})();
