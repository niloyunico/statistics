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
  const monthLabel = (k) => (window.UNICO && window.UNICO.MONTHS_FULL && window.UNICO.MONTHS_FULL[k]) || k;
  function defaultMonthFor(dept) {
    const order = MO();
    if (dept && dept.months && dept.months.length) {
      const last = dept.months[dept.months.length - 1];
      const i = order.indexOf(last);
      if (i >= 0 && i + 1 < order.length) return order[i + 1];
      return last;
    }
    // no data yet — pick a recent month near the middle of the catalog
    return order[Math.min(order.length - 1, 24)] || '';
  }
  function staffNames() {
    const s = window.STAFF_SEED || window.__UNICO_STAFF__ || [];
    return s.filter((e) => e && e.name).map((e) => ({ name: e.name, title: e.designation || e.role || '' }));
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
    const load = () => dcApi.get('/api/responsibles').then((r) => setList(r.ok ? r.responsibles : [])).catch(() => setList([]));
    useEffect(() => { load(); }, []);

    const blank = () => ({ name: '', title: '', phone: '', staffId: null, empId: '', password: '', departments: [], qualityAreas: [], active: true });
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

    const deptName = (id) => { const d = (depts || []).find((x) => x.id === id); return d ? d.short : id; };

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
                  return <span key={d.id} onClick={() => toggle('departments', 'departments', d.id) || toggle('departments', null, d.id)}
                    style={{ cursor: 'pointer', userSelect: 'none', padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, border: '1px solid ' + (on ? 'var(--blue)' : 'var(--line)'), background: on ? 'var(--blue-50)' : '#fff', color: on ? 'var(--blue-700)' : 'var(--ink-2)' }}
                    onClickCapture={(e) => { e.stopPropagation(); setEditing((ed) => ({ ...ed, departments: ed.departments.includes(d.id) ? ed.departments.filter((x) => x !== d.id) : [...ed.departments, d.id] })); }}>{d.short}</span>;
                })}
              </div>
            </Field>
            <Field label="Assigned quality areas (optional)">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {areas.map((a) => {
                  const on = editing.qualityAreas.includes(a.key);
                  return <span key={a.key} onClick={() => setEditing((ed) => ({ ...ed, qualityAreas: ed.qualityAreas.includes(a.key) ? ed.qualityAreas.filter((x) => x !== a.key) : [...ed.qualityAreas, a.key] }))}
                    style={{ cursor: 'pointer', userSelect: 'none', padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, border: '1px solid ' + (on ? 'var(--blue)' : 'var(--line)'), background: on ? 'var(--blue-50)' : '#fff', color: on ? 'var(--blue-700)' : 'var(--ink-2)' }}>{a.name}</span>;
                })}
              </div>
            </Field>
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
                    <td>{(r.qualityAreas || []).join(', ') || '—'}</td>
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
    const [depList, setDepList] = useState(() => (((window.UNICO && window.UNICO.DEPARTMENTS) || depts || []).map((d) => ({ ...d }))));
    const all = depList;
    const refreshDepts = () => dcApi.get('/api/departments').then((r) => { if (r.ok) setDepList(r.departments.map((d) => ({ ...d }))); }).catch(() => {});
    const [deptId, setDeptId] = useState((prefill && prefill.dept) || (all[0] && all[0].id) || '');
    const dept = useMemo(() => all.find((d) => d.id === deptId) || all[0], [deptId, depList]);
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
    const monthOpts = (fyMonths && fyMonths.length) ? fyMonths : (() => { const o = MO(); const i = o.indexOf('Jun-25'); return i >= 0 ? o.slice(i, i + 12) : o.slice(0, 12); })();
    const defMonth = monthOpts[monthOpts.length - 1] || '';
    const [areaKey, setAreaKey] = useState((prefill && prefill.area) || (areas[0] && areas[0].key) || '');
    const area = useMemo(() => areas.find((a) => a.key === areaKey) || areas[0], [areaKey]);
    const [indId, setIndId] = useState('');
    const [newInd, setNewInd] = useState({ name: '', formula: 'count', numLabel: '', denLabel: '', unit: '' });
    const [month, setMonth] = useState(defMonth);
    const [den, setDen] = useState('');
    const [incidents, setIncidents] = useState([]);
    const [remark, setRemark] = useState('');
    const [responsible, setResponsible] = useState(lockResp ? (me.name || '') : ((prefill && prefill.responsible) || ''));
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(null);
    const [guideOpen, setGuideOpen] = useState(true);
    const [resps, setResps] = useState([]);
    useEffect(() => { if (!lockResp) dcApi.get('/api/responsibles').then((r) => setResps(r.ok ? r.responsibles : [])).catch(() => {}); }, []);
    useEffect(() => { setIndId(''); }, [areaKey]);

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
    const incCount = incidents.length;
    // Every indicator can take a denominator: rate indicators REQUIRE it; counts may
    // OPTIONALLY add one to compute a rate (per 1000) instead of a plain count.
    const denNum = Number(den);
    const denEntered = den !== '' && denNum > 0;
    const computeAsRate = isRate || denEntered;
    const rateUnit = (unitRaw && /per|%/.test(unitRaw)) ? unitRaw : (formula === 'pct' ? '%' : ('per ' + mult + (denGuess ? ' ' + denGuess.toLowerCase() : '')));
    const unitQ = computeAsRate ? rateUnit : (unitRaw || 'count');
    const formulaTextQ = computeAsRate
      ? (indNameQ + ' = (' + numLabel + ' ÷ ' + denLabel + ') × ' + mult + '   ·   ' + numLabel + ' = number of incidents this month')
      : (indNameQ + ' = number of incidents this month');
    // Standardised measurement guide (formula / worked example / interpretation / reference)
    // for the selected indicator, from the Hospital Quality Indicator Framework.
    const guide = hqiGuideFor(indNameQ);

    // Prefill the incident list (and denominator) from existing data on month/indicator change.
    useEffect(() => {
      if (!curInd) { setIncidents([]); setDen(''); return; }
      const ev = curInd.incidents && curInd.incidents[month];
      setIncidents(Array.isArray(ev) ? ev.map((x) => ({
        uhid: x.uhid || '', patientName: x.patientName || '', age: x.age || '', gender: x.gender || '',
        diagnosis: x.diagnosis || '', admissionDate: x.admissionDate || '', procedureDate: x.procedureDate || '',
        details: x.details || '', finding: x.finding || '', corrective: x.corrective || '', preventive: x.preventive || '', remark: x.remark || '',
      })) : []);
      setDen(curInd.mDen && curInd.mDen[month] != null ? String(curInd.mDen[month]) : '');
    }, [indId, month]);

    // The number of incidents drives the count / numerator automatically (0 if none).
    const result = computeAsRate ? (denNum > 0 ? Math.round((incCount / denNum) * mult * 100) / 100 : 0) : incCount;
    const addIncident = () => setIncidents((arr) => [...arr, { uhid: '', patientName: '', age: '', gender: '', diagnosis: '', admissionDate: '', procedureDate: '', details: '', finding: '', corrective: '', preventive: '', remark: '' }]);
    const setInc = (i, k, v) => setIncidents((arr) => arr.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
    const delInc = (i) => setIncidents((arr) => arr.filter((_, j) => j !== i));

    // A data collector cannot overwrite a month that already has recorded data; only
    // an administrator may change it (a fresh "Add a new indicator" is always allowed).
    const qExists = !!(curInd && (
      (curInd.incidents && Array.isArray(curInd.incidents[month]) && curInd.incidents[month].length) ||
      (curInd.mDen && curInd.mDen[month] != null && curInd.mDen[month] !== '') ||
      (curInd.mNum && curInd.mNum[month] != null && curInd.mNum[month] !== '') ||
      (curInd.months && curInd.months[month] != null && curInd.months[month] !== '')
    ));
    const qLocked = lockResp && !isNew && qExists;
    const submit = () => {
      if (!area) { toast('Select an area', 'error'); return; }
      if (!indId) { toast('Select an indicator', 'error'); return; }
      if (isNew && !newInd.name.trim()) { toast('Enter the new indicator name', 'error'); return; }
      if (!month) { toast('Pick a month', 'error'); return; }
      if (qLocked) { toast('This month already has data — only an administrator can change it.', 'error'); return; }
      if (isRate && (den === '' || Number(den) <= 0)) { toast('Enter ' + denLabel + ' (denominator)', 'error'); return; }
      const matched = resps.find((r) => r.name === responsible);
      setBusy(true); setDone(null);
      dcApi.post('/api/submissions/quality', {
        area: area.key, month,
        indicatorId: isNew ? '' : indId,
        indicatorName: isNew ? newInd.name : (curInd && curInd.name),
        valueType: computeAsRate ? (formula === 'pct' ? '%' : 'Rate') : 'Count', entryMode: computeAsRate ? 'rate' : 'count', mult,
        formula: computeAsRate ? (isRate ? formula : 'rate1000') : 'count',
        numLabel: computeAsRate ? numLabel : undefined, denLabel: computeAsRate ? denLabel : undefined, unit: unitQ,
        value: computeAsRate ? undefined : incCount, num: computeAsRate ? incCount : undefined, den: computeAsRate ? den : undefined,
        incidents, remark,
        responsible: lockResp ? { name: me.name } : (matched ? { id: matched.id, name: matched.name } : (responsible ? { name: responsible } : null)),
      }).then((r) => {
        setBusy(false);
        if (r.ok) { setDone({ area: area.name, month }); setIncidents([]); setDen(''); setRemark(''); if (isNew) { setIndId(''); setNewInd({ name: '', formula: 'count', numLabel: '', denLabel: '', unit: '' }); } toast('Saved monthly value', 'success'); }
        else toast(r.error || 'Submission failed', 'error');
      }).catch(() => { setBusy(false); toast('Submission failed', 'error'); });
    };

    const showEntry = (indId && !isNew) || (isNew && newInd.name);
    return (
      <div className="grid" style={{ gap: 14, maxWidth: 760 }}>
        <SectionTitle icon={I.activity} title="Submit Quality Data" sub="Log the month's incidents — the count / rate is calculated automatically." />
        {done && <Banner ok onClose={() => setDone(null)}>Saved ✓ — {done.area} · {monthLabel(done.month)} sent for admin review.</Banner>}
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Quality area / unit">
              <select style={inputStyle} value={areaKey} onChange={(e) => setAreaKey(e.target.value)}>
                {areas.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
              </select>
            </Field>
            <Field label="Reporting month">
              <select style={inputStyle} value={month} onChange={(e) => setMonth(e.target.value)}>
                {monthOpts.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Indicator">
            <select style={inputStyle} value={indId} onChange={(e) => setIndId(e.target.value)}>
              <option value="">Select…</option>
              {inds.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              <option value="__new__">➕ Add a new indicator…</option>
            </select>
          </Field>
          {isNew && (
            <div style={{ border: '1px dashed var(--line)', borderRadius: 9, padding: '12px 14px', marginBottom: 13 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
                <Field label="New indicator name"><input style={inputStyle} value={newInd.name} onChange={(e) => setNewInd({ ...newInd, name: e.target.value })} placeholder="e.g. CAUTI Rate" /></Field>
                <Field label="Calculation">
                  <select style={inputStyle} value={newInd.formula} onChange={(e) => setNewInd({ ...newInd, formula: e.target.value })}>
                    <option value="count">Count (incidents)</option>
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
              <Field
                label={<span>{denLabel} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{isRate ? '(denominator — required)' : '(denominator — optional, for a rate)'}</span></span>}
                hint={isRate ? denDef : ('Leave blank to record a plain count. Enter the base for ' + monthLabel(month) + ' (e.g. total procedures / discharges / patient-days) to compute a rate per ' + mult + '.')}>
                <input type="number" step="any" style={inputStyle} value={den} onChange={(e) => setDen(e.target.value)} placeholder={isRate ? ('Total ' + denLabel.toLowerCase() + ' this month') : 'Optional — total base (blank = count)'} />
              </Field>
              <div style={{ border: '1px solid var(--line)', borderRadius: 9, padding: '12px 14px', marginBottom: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: incidents.length ? 10 : 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>Incidents in {monthLabel(month)}</div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: incCount ? 'var(--neg-bg)' : 'var(--pos-bg)', color: incCount ? 'var(--rose)' : 'var(--pos)' }}>{incCount}</span>
                  <span style={{ flex: 1 }} />
                  <button className="btn sm" onClick={addIncident}><Ic d={I.plus} s={13} />Add incident</button>
                </div>
                {incidents.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>No incidents — the {isRate ? 'numerator' : 'count'} stays 0. Click “Add incident” for each event that occurred.</div>}
                {incidents.map((inc, i) => (
                  <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', marginBottom: 8, background: 'var(--panel-2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <b style={{ fontSize: 12 }}>Incident #{i + 1}</b><span style={{ flex: 1 }} />
                      <button className="icon-btn" title="Remove" style={{ width: 24, height: 24, border: 0, background: 'transparent', color: 'var(--rose)' }} onClick={() => delInc(i)}><Ic d={I.x} s={13} /></button>
                    </div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {/* Patient & admission details (per-incident report fields) */}
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .4 }}>Patient &amp; admission details</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        <input style={inputStyle} value={inc.uhid} onChange={(e) => setInc(i, 'uhid', e.target.value)} placeholder="UHID / Reg. no" />
                        <input style={{ ...inputStyle, gridColumn: 'span 2' }} value={inc.patientName} onChange={(e) => setInc(i, 'patientName', e.target.value)} placeholder="Patient name" />
                        <input style={inputStyle} type="number" min="0" value={inc.age} onChange={(e) => setInc(i, 'age', e.target.value)} placeholder="Age" />
                        <select style={inputStyle} value={inc.gender} onChange={(e) => setInc(i, 'gender', e.target.value)}>
                          <option value="">Gender…</option><option>Male</option><option>Female</option><option>Other</option>
                        </select>
                        <input style={inputStyle} value={inc.diagnosis} onChange={(e) => setInc(i, 'diagnosis', e.target.value)} placeholder="Diagnosis" />
                        <label style={{ fontSize: 10, color: 'var(--muted)' }}>Date of admission<input style={inputStyle} type="date" value={inc.admissionDate} onChange={(e) => setInc(i, 'admissionDate', e.target.value)} /></label>
                        <label style={{ fontSize: 10, color: 'var(--muted)' }}>Date of procedure <span style={{ color: 'var(--faint)' }}>(if any)</span><input style={inputStyle} type="date" value={inc.procedureDate} onChange={(e) => setInc(i, 'procedureDate', e.target.value)} /></label>
                      </div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .4, marginTop: 2 }}>Incident, cause &amp; CAPA</div>
                      <textarea style={{ ...inputStyle, minHeight: 42 }} value={inc.details} onChange={(e) => setInc(i, 'details', e.target.value)} placeholder="Incident details — what happened" />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                        <textarea style={{ ...inputStyle, minHeight: 38 }} value={inc.finding} onChange={(e) => setInc(i, 'finding', e.target.value)} placeholder="Finding / observation" />
                        <textarea style={{ ...inputStyle, minHeight: 38 }} value={inc.corrective} onChange={(e) => setInc(i, 'corrective', e.target.value)} placeholder="Corrective action" />
                        <textarea style={{ ...inputStyle, minHeight: 38 }} value={inc.preventive} onChange={(e) => setInc(i, 'preventive', e.target.value)} placeholder="Preventive action" />
                      </div>
                      <input style={inputStyle} value={inc.remark} onChange={(e) => setInc(i, 'remark', e.target.value)} placeholder="Special remarks (optional)" />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ border: '1px solid var(--line)', borderRadius: 9, padding: '13px 16px', marginBottom: 4, background: 'var(--panel-2)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .4 }}>Computed value</div>
                <span className="num" style={{ fontSize: 22, fontWeight: 800, color: 'var(--blue-700)' }}>{result}</span>
                {unitQ ? <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-2)' }}>{unitQ}</span> : null}
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{computeAsRate ? (numLabel + ' = ' + incCount + (denEntered ? ' · ' + denLabel + ' = ' + denNum : '')) : (incCount + ' incident(s)')}{benchmarkQ ? '   ·   Benchmark ' + benchmarkQ : ''}</span>
              </div>
            </>
          )}
          {lockResp
            ? <Field label="Responsible person"><input style={{ ...inputStyle, background: 'var(--panel-2)', color: 'var(--ink-2)' }} value={me.name} readOnly /></Field>
            : <Field label="Responsible person" hint={assigned.length ? 'Assigned: ' + assigned.map((a) => a.name).join(', ') : 'Pick from staff or type a new name.'}>
                <ResponsiblePicker value={responsible} onChange={setResponsible} suggestions={assigned} />
              </Field>}
          <Field label="Remark (optional)"><input style={inputStyle} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Any note for this month" /></Field>
          {qLocked && <Banner>{(curInd && curInd.name) || 'This indicator'} already has data for {monthLabel(month)} — submission is locked for data collectors. Ask an administrator to change it.</Banner>}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button className="btn pri" disabled={busy || qLocked} onClick={submit}><Ic d={I.check} s={15} />{busy ? 'Saving…' : (qLocked ? 'Locked — already recorded' : 'Save monthly value')}</button>
            <button className="btn" disabled={busy} onClick={() => { setIncidents([]); setDen(''); setRemark(''); setDone(null); }}>Clear</button>
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
    const dept = s.type === 'patient' ? (((window.UNICO && window.UNICO.DEPARTMENTS) || []).find((d) => d.id === s.department)) : null;
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

  function DataReview() {
    const [rows, setRows] = useState(null);
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
          right={<button className="btn sm" onClick={load}><Ic d={I.trend} s={14} />Refresh</button>} />

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
      </div>
    );
  }

  /* ============================ Share Links ============================ */
  function DataShareLinks({ depts }) {
    const all = (window.UNICO && window.UNICO.DEPARTMENTS) || depts || [];
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
    const liveDepts = (window.UNICO && window.UNICO.DEPARTMENTS) || [];
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

  function CollectorPortal() {
    const user = (typeof window !== 'undefined' && window.__UNICO_USER__) || {};
    const depts = (window.UNICO && window.UNICO.DEPARTMENTS) || [];
    const areas = (window.qualityData ? window.qualityData() : []);
    const hasPatient = depts.length > 0;
    const hasQuality = areas.length > 0;
    const tabs = [];
    if (hasPatient) tabs.push(['patient', 'Patient Statistics', I.input]);
    if (hasQuality) tabs.push(['quality', 'Quality Data', I.activity]);
    tabs.push(['history', 'My Submissions', I.doc]);
    const [tab, setTab] = useState(tabs[0][0]);

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
          {tab === 'quality' && hasQuality && <DataQualityForm prefill={{ responsible: user.name }} />}
          {tab === 'history' && <CollectorHistory />}
        </div>
      </div>
    );
  }

  Object.assign(window, { DataResponsibles, DataPatientForm, DataQualityForm, DataReview, DataShareLinks, CollectorPortal });
})();
