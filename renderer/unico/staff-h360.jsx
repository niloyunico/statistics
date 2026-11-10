/* UNICO — Staff Management → H360 Check (renderer). Data: server/h360/staff.js (/api/h360-staff/*).

   Our staff register compared with H360's employee list:
     Lookup        type an emp ID, name or phone; H360's people beside our record(s), field by field
     Bulk Verify   every active record checked; counts per status, "new since last run", Excel
     Not in register  H360 Nursing Services staff we hold no record for (the sweep)
     Duplicates & IDs shared emp IDs, an ID that belongs to someone else in H360
   plus window.StaffH360Card (the "H360 record" card on the staff profile).

   On H360 only the Employee Search is used; nothing there is pressed or written. Our register
   changes only when a Staff editor presses "Use H360 value" on one field, which goes through
   the normal staff save (store.update) and keeps the old value in the row's h360_changes. */

const { useState, useEffect, useMemo, useRef } = React;
const Ic = window.Ic, I = window.I;

async function hxApi(path, options) {
  const o = options || {};
  const response = await fetch(path, {
    method: o.method || 'GET',
    headers: o.body ? { 'content-type': 'application/json', accept: 'application/json' } : { accept: 'application/json' },
    body: o.body ? JSON.stringify(o.body) : undefined,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { const err = new Error((body && body.error) || 'The request failed.'); err.status = response.status; throw err; }
  return body;
}
const hxToast = (m, t) => { try { window.UI && window.UI.toast && window.UI.toast(m, t || 'success'); } catch (e) {} };
const hxCanEdit = () => { try { return !window.unicoCan || window.unicoCan('staff', 'edit'); } catch (e) { return false; } };
const hxWhen = (v) => { try { return v ? new Date(v).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short' }) : '—'; } catch (e) { return String(v || ''); } };
const hxDate = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');

const HX_STATUS = {
  id_other_person: { label: 'Emp ID belongs to another person', short: 'Other person', c: '#b42339', bg: '#fdf0f2', br: '#f2c4cd' },
  not_in_h360: { label: 'Emp ID not found in H360', short: 'Not in H360', c: '#b42339', bg: '#fdf0f2', br: '#f2c4cd' },
  duplicate_id: { label: 'Emp ID used twice', short: 'Duplicate', c: '#b42339', bg: '#fdf0f2', br: '#f2c4cd' },
  no_emp_id: { label: 'No emp ID in our record', short: 'No emp ID', c: '#9a5a06', bg: '#fff5e6', br: '#f6dcb0' },
  field_diff: { label: 'Same person, some details differ', short: 'Details differ', c: '#9a5a06', bg: '#fff5e6', br: '#f6dcb0' },
  match: { label: 'Matches H360', short: 'Matches', c: '#13703d', bg: '#eaf7ef', br: '#c4e6d1' },
  error: { label: 'Could not check', short: 'Error', c: '#5b6676', bg: '#f1f3f6', br: '#dde3ec' },
};
const HX_ORDER = ['id_other_person', 'not_in_h360', 'duplicate_id', 'no_emp_id', 'field_diff', 'match', 'error'];
window.UNICO_H360_STATUS = HX_STATUS;

const HX_CSS = `
.hx-pill{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;padding:2px 9px;border-radius:999px;border:1px solid;white-space:nowrap}
.hx-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.hx-tile{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--panel);text-align:left;cursor:pointer;font:inherit}
.hx-tile b{display:block;font-size:22px;line-height:1.1;font-family:var(--mono)}
.hx-tile span{font-size:11.5px;color:var(--muted)}
.hx-tile.on{box-shadow:0 0 0 2px var(--blue) inset}
.hx-t{width:100%;border-collapse:collapse;font-size:12.5px}
.hx-t th{text-align:left;padding:8px 10px;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);font-weight:700;border-bottom:1px solid var(--line);background:var(--panel-2);white-space:nowrap}
.hx-t td{padding:8px 10px;border-bottom:1px solid var(--line-2);vertical-align:top;color:var(--ink-2)}
.hx-t tr.hx-new td{background:rgba(210,58,82,.05)}
.hx-scroll{overflow-x:auto;border:1px solid var(--line-2);border-radius:9px}
.hx-input{border:1px solid var(--line);border-radius:8px;padding:8px 11px;font:inherit;font-size:13px;background:var(--panel);color:var(--ink);min-width:0}
.hx-alert{padding:10px 13px;border-radius:9px;font-size:12.5px;border:1px solid;margin-bottom:12px}
.hx-alert.red{background:#fdf0f2;border-color:#f2c4cd;color:#8f1d30}
.hx-alert.amber{background:#fff5e6;border-color:#f6dcb0;color:#7a4705}
.hx-alert.info{background:var(--panel-2);border-color:var(--line);color:var(--ink-2)}
.hx-person{border:1px solid var(--line);border-radius:12px;padding:13px 15px;background:var(--panel);margin-bottom:12px}
.hx-pairs{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px 16px;margin:10px 0}
.hx-pairs div span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:var(--faint);font-weight:700}
.hx-bar{height:8px;border-radius:5px;background:var(--line-2);overflow:hidden}
.hx-bar i{display:block;height:100%;background:var(--blue);transition:width .3s}
.hx-muted{color:var(--muted);font-size:12px}
@media (max-width:640px){.hx-hide-sm{display:none}}
`;
function HxStyle() { return <style>{HX_CSS}</style>; }

function HxPill({ status, small }) {
  const m = HX_STATUS[status] || HX_STATUS.error;
  return <span className="hx-pill" style={{ color: m.c, background: m.bg, borderColor: m.br }}>{status === 'match' ? '✓' : status === 'field_diff' || status === 'no_emp_id' ? '!' : '⚠'} {small ? m.short : m.label}</span>;
}

// One field change copied from H360 into our record, through the normal staff save.
function hxApply(store, rec, field, value, h360, label) {
  if (!store || !rec) return false;
  const old = rec[field] == null ? '' : String(rec[field]);
  if (!window.confirm(`Change ${label} of ${rec.name || 'this record'}\n\nfrom: ${old || '(blank)'}\nto:   ${value}\n\n(the value H360 holds for ${h360.code} ${h360.name})`)) return false;
  const me = window.__UNICO_USER__ || {};
  const change = { field, old, new: value, at: new Date().toISOString(), by: me.name || me.username || '', person_code: h360.code };
  store.update(rec.id, { [field]: value, h360_changes: (Array.isArray(rec.h360_changes) ? rec.h360_changes : []).concat([change]), updated_at: Date.now() });
  hxToast(`${label} updated from H360 — the old value is kept on the record.`);
  return true;
}
// The value of an H360 field in the shape our register stores it.
function hxValueOf(key, h) {
  if (key === 'phone') return (h.phones || [])[0] || '';
  if (key === 'doj') return h.joinDate || '';
  if (key === 'gender') return h.gender || '';
  if (key === 'designation') return h.designation || '';
  if (key === 'name') return h.name || '';
  return '';
}

// Our record beside H360's person, field by field.
function HxCompare({ result, store, onChanged }) {
  const rec = store && store.get ? store.get(result.id) : null;
  const h = result.h360;
  const can = hxCanEdit() && rec && !rec.former && rec.is_active !== false;
  const [done, setDone] = useState({});
  if (!h) return null;
  return (
    <div className="hx-scroll" style={{ marginTop: 8 }}>
      <table className="hx-t">
        <thead><tr><th>Field</th><th>Our record</th><th>H360</th><th></th></tr></thead>
        <tbody>
          {(result.fields || []).map((f) => {
            const value = hxValueOf(f.key, h);
            const color = f.ok === false ? '#b42339' : f.ok === true ? '#13703d' : 'var(--faint)';
            return (
              <tr key={f.key}>
                <td style={{ fontWeight: 700, color: 'var(--ink)' }}>{f.label}</td>
                <td>{f.ours || <span className="hx-muted">blank</span>}</td>
                <td style={{ color }}>{f.h360 || <span className="hx-muted">—</span>}</td>
                <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                  {f.ok === true && <span style={{ color: '#13703d', fontWeight: 700 }}>✓</span>}
                  {f.ok === null && <span className="hx-muted">not compared</span>}
                  {f.ok === false && (done[f.key] ? <span style={{ color: '#13703d', fontWeight: 700 }}>updated</span>
                    : can && f.copyable && value ? <button className="btn sm" onClick={() => { if (hxApply(store, rec, f.key, value, h, f.label)) { setDone({ ...done, [f.key]: true }); onChanged && onChanged(); } }}>Use H360 value</button>
                      : <span style={{ color: '#b42339', fontWeight: 700 }}>differs</span>)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// H360 people who may be this record (when our ID is missing or wrong).
function HxSuggestions({ result, store }) {
  const rec = store && store.get ? store.get(result.id) : null;
  const can = hxCanEdit() && rec && !rec.former;
  if (!(result.suggestions || []).length) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div className="hx-muted" style={{ fontWeight: 700, marginBottom: 4 }}>H360 may know this person as:</div>
      {result.suggestions.map((s) => (
        <div key={s.code} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5, padding: '4px 0' }}>
          <b style={{ fontFamily: 'var(--mono)' }}>{s.code}</b><span>{s.name}</span>
          <span className="hx-muted">{[s.designation, s.dept, s.joinDate && 'joined ' + hxDate(s.joinDate)].filter(Boolean).join(' · ')}</span>
          <span className="tag">{s.why}</span>
          {can && !String(rec.emp_id || '').trim() && <button className="btn sm" onClick={() => hxApply(store, rec, 'emp_id', s.code, s, 'Emp ID')}>Use this emp ID</button>}
        </div>
      ))}
    </div>
  );
}

/* ---------------- Lookup ---------------- */
function HxLookup({ store, setRoute, ready }) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState(null);
  const [err, setErr] = useState('');
  const go = async (text) => {
    const term = String(text == null ? q : text).trim();
    if (term.length < 3) { setErr('Type at least 3 letters or digits.'); return; }
    setBusy(true); setErr('');
    try { setOut(await hxApi('/api/h360-staff/search?q=' + encodeURIComponent(term))); } catch (e) { setErr(e.message); setOut(null); }
    setBusy(false);
  };
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input className="hx-input" style={{ flex: '1 1 240px' }} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') go(); }}
          placeholder="Emp ID, name or phone (e.g. 11809 or Khadija)" disabled={!ready} />
        <button className="btn pri" onClick={() => go()} disabled={busy || !ready}><Ic d={I.search || I.check} s={13} c="#fff" />{busy ? 'Searching H360…' : 'Search H360'}</button>
      </div>
      {err && <div className="hx-alert red">{err}</div>}
      {out && <div className="hx-muted" style={{ marginBottom: 10 }}>H360 found {out.count} {out.count === 1 ? 'person' : 'people'} for “{out.q}”{out.count > out.people.length ? ` (first ${out.people.length} shown)` : ''}.</div>}
      {out && out.people.map((p) => (
        <div key={p.code} className="hx-person">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <b style={{ fontFamily: 'var(--mono)', fontSize: 15 }}>{p.code}</b>
            <b style={{ fontSize: 15, color: 'var(--ink)' }}>{p.name}</b>
            <span className="hx-muted">{[p.designation, p.dept].filter(Boolean).join(' · ')}</span>
            <span className="spacer" />
            {!p.nursing && <span className="tag">not Nursing Services</span>}
          </div>
          <div className="hx-pairs">
            {[['Gender', p.gender], ['Marital status', p.marital], ['Age', p.age], ['Phone', (p.phones || []).join(', ')], ['Joined', hxDate(p.joinDate)], ['Service', p.service]].map(([k, v]) => <div key={k}><span>{k}</span>{v || '—'}</div>)}
          </div>
          {p.records.length ? p.records.map((r) => (
            <div key={r.id} style={{ borderTop: '1px dashed var(--line)', paddingTop: 9, marginTop: 6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="hx-muted">Our record #{r.id}:</span>
                <a style={{ fontWeight: 700, cursor: 'pointer', color: 'var(--blue)' }} onClick={() => setRoute({ view: 'staffProfile', emp: r.id })}>{r.name}</a>
                {r.former && <span className="tag">Previous Staff</span>}
                <HxPill status={r.status} />
              </div>
              {r.status === 'id_other_person' && <div className="hx-alert red" style={{ marginTop: 8, marginBottom: 0 }}>Our record “{r.name}” carries emp ID {p.code}, which H360 gives to {p.name}. One of the two is wrong.</div>}
              {r.duplicateOf && <div className="hx-alert red" style={{ marginTop: 8, marginBottom: 0 }}>Emp ID {p.code} is also on our record(s) #{r.duplicateOf.join(', #')}.</div>}
              {r.status !== 'id_other_person' && <HxCompare result={{ ...r, h360: p }} store={store} />}
            </div>
          )) : (
            <div className="hx-alert amber" style={{ marginBottom: 0 }}>
              Not in our register under {p.code}.
              {p.possible.length > 0 && <div style={{ marginTop: 6 }}>Maybe: {p.possible.map((r) => (
                <a key={r.id} style={{ marginRight: 12, cursor: 'pointer', fontWeight: 700, color: 'var(--blue)' }} onClick={() => setRoute({ view: 'staffProfile', emp: r.id })}>
                  #{r.id} {r.name} ({r.empId || 'no emp ID'}{r.former ? ', Previous Staff' : ''})</a>))}</div>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------------- run-in-steps helper ---------------- */
async function hxRunSteps(start, step, body, onRun) {
  let run = start ? (await hxApi(start, { method: 'POST', body: body || {} })).run : null;
  if (!run && body && body.id) run = { id: body.id };
  for (let guard = 0; run && guard < 500; guard++) {
    onRun(run);
    let next;
    try { next = await hxApi(step, { method: 'POST', body: { id: run.id } }); }
    catch (e) { if (e.status === 423) { await new Promise((r) => setTimeout(r, 6000)); continue; } throw e; }
    run = next.run;
    if (run && run.error) throw new Error(run.error);
  }
  onRun(null);
}
function HxProgress({ run, what }) {
  if (!run || !run.total) return null;
  const done = run.done || 0;
  return (
    <div style={{ margin: '10px 0' }}>
      <div className="hx-muted" style={{ marginBottom: 5 }}>{what}: {done} of {run.total}…</div>
      <div className="hx-bar"><i style={{ width: Math.round((done / run.total) * 100) + '%' }} /></div>
    </div>
  );
}

/* ---------------- Bulk verify ---------------- */
function HxVerify({ store, setRoute, ready, info, reload }) {
  const [data, setData] = useState(null);
  const [run, setRun] = useState(null);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('problems');
  const [onlyNew, setOnlyNew] = useState(false);
  const [dept, setDept] = useState('');
  const [open, setOpen] = useState(null);
  const [text, setText] = useState('');
  const load = () => hxApi('/api/h360-staff/results').then(setData).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const depts = useMemo(() => [...new Set((store.staff || []).filter((e) => e.is_active && !e.former && e.current_department).map((e) => e.current_department))].sort(), [store.staff]);
  const start = async (resume) => {
    setErr('');
    try {
      await hxRunSteps(resume ? null : '/api/h360-staff/verify-bulk', '/api/h360-staff/verify-bulk/step', resume ? { id: resume.id } : { dept }, setRun);
      hxToast('H360 check finished.');
    } catch (e) { setErr(e.message); setRun(null); }
    load(); reload && reload();
  };
  const pending = info && info.verify && info.verify.run;
  const list = (data && data.list) || [];
  const prev = (data && data.previous && data.previous.statusById) || null;
  const isNew = (r) => prev && r.status !== 'match' && prev[r.id] !== r.status;
  const counts = {}; list.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
  const needle = text.trim().toLowerCase();
  const shown = list.filter((r) => (filter === 'all' || (filter === 'problems' ? r.status !== 'match' : r.status === filter)) && (!onlyNew || isNew(r))
    && (!needle || [r.empId, r.name, r.dept, r.h360 && r.h360.name].some((v) => String(v || '').toLowerCase().includes(needle))))
    .sort((a, b) => HX_ORDER.indexOf(a.status) - HX_ORDER.indexOf(b.status) || String(a.name).localeCompare(String(b.name)));
  const differs = (r) => (r.fields || []).filter((f) => f.ok === false).map((f) => f.label).join(', ');
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <select className="hx-input" value={dept} onChange={(e) => setDept(e.target.value)} disabled={!!run}>
          <option value="">All active staff</option>
          {depts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <button className="btn pri" disabled={!ready || !!run} onClick={() => start(null)}><Ic d={I.check} s={13} c="#fff" />{run ? 'Checking…' : 'Verify with H360'}</button>
        {pending && !run && <button className="btn" onClick={() => start(pending)}>Continue the check in progress ({pending.done}/{pending.total})</button>}
        <span className="spacer" />
        <a className="btn" href="/api/h360-staff/export.xlsx"><Ic d={I.download || I.doc} s={13} />Excel</a>
      </div>
      <HxProgress run={run} what="Checking records against H360" />
      {err && <div className="hx-alert red">{err}</div>}
      {data && data.last && <div className="hx-muted" style={{ marginBottom: 10 }}>Last full check {hxWhen(data.last.finishedAt)}{data.last.by ? ' by ' + data.last.by : ''}{data.last.dept ? ' · ' + data.last.dept + ' only' : ''}{data.previous ? ' · compared with ' + hxWhen(data.previous.finishedAt) : ''}. A daily check runs by itself every morning.</div>}
      {!list.length && !run && <div className="hx-alert info">No check yet. Press “Verify with H360” to compare every active staff record with H360.</div>}
      {list.length > 0 && <React.Fragment>
        <div className="hx-tiles" style={{ marginBottom: 12 }}>
          {['problems', ...HX_ORDER.filter((s) => counts[s]), 'all'].map((s) => {
            const n = s === 'all' ? list.length : s === 'problems' ? list.filter((r) => r.status !== 'match').length : counts[s];
            const m = HX_STATUS[s];
            return <button key={s} className={'hx-tile' + (filter === s ? ' on' : '')} onClick={() => setFilter(s)}><b style={{ color: m ? m.c : 'var(--ink)' }}>{n}</b><span>{s === 'all' ? 'All checked' : s === 'problems' ? 'Need attention' : m.label}</span></button>;
          })}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <input className="hx-input" style={{ flex: '1 1 200px' }} placeholder="Filter by name, emp ID, department" value={text} onChange={(e) => setText(e.target.value)} />
          {prev && <label style={{ fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} />New since the previous check only</label>}
        </div>
        <div className="hx-scroll">
          <table className="hx-t">
            <thead><tr><th>Status</th><th>Emp ID</th><th>Our name</th><th>H360 name</th><th className="hx-hide-sm">Department</th><th className="hx-hide-sm">What differs</th><th className="hx-hide-sm">Checked</th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <React.Fragment key={r.id}>
                  <tr className={isNew(r) ? 'hx-new' : ''} style={{ cursor: 'pointer' }} onClick={() => setOpen(open === r.id ? null : r.id)}>
                    <td><HxPill status={r.status} small />{isNew(r) && <span className="tag" style={{ marginLeft: 5 }}>new</span>}</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{r.empId || '—'}</td>
                    <td style={{ fontWeight: 700, color: 'var(--ink)' }}>{r.name}</td>
                    <td>{r.h360 ? r.h360.name : (r.suggestions && r.suggestions[0] ? <span className="hx-muted">maybe {r.suggestions[0].code} {r.suggestions[0].name}</span> : '—')}</td>
                    <td className="hx-hide-sm">{r.dept || '—'}</td>
                    <td className="hx-hide-sm">{r.duplicateOf ? 'also on #' + r.duplicateOf.join(', #') : r.error || differs(r) || '—'}</td>
                    <td className="hx-hide-sm hx-muted">{hxWhen(r.at)}</td>
                  </tr>
                  {open === r.id && <tr><td colSpan={7} style={{ background: 'var(--panel-2)' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <HxPill status={r.status} />
                      <button className="btn sm" onClick={() => setRoute({ view: 'staffProfile', emp: r.id })}>Open profile</button>
                    </div>
                    {r.status === 'id_other_person' && r.h360 && <div className="hx-alert red" style={{ marginTop: 8, marginBottom: 0 }}>H360 gives emp ID {r.empId} to {r.h360.name} ({[r.h360.designation, r.h360.dept].filter(Boolean).join(', ')}), not to {r.name}.</div>}
                    {r.status !== 'id_other_person' && <HxCompare result={r} store={store} />}
                    <HxSuggestions result={r} store={store} />
                  </td></tr>}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {!shown.length && <div className="hx-muted" style={{ padding: 10 }}>Nothing in this view.</div>}
      </React.Fragment>}
    </div>
  );
}

/* ---------------- Not in register ---------------- */
function HxMissing({ setRoute, ready, info, reload }) {
  const [data, setData] = useState(null);
  const [run, setRun] = useState(null);
  const [err, setErr] = useState('');
  const [text, setText] = useState('');
  const load = () => hxApi('/api/h360-staff/missing').then(setData).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const can = hxCanEdit();
  const start = async (resume) => {
    setErr('');
    try {
      await hxRunSteps(resume ? null : '/api/h360-staff/sweep', '/api/h360-staff/sweep/step', resume ? { id: resume.id } : {}, setRun);
      hxToast('H360 sweep finished.');
    } catch (e) { setErr(e.message); setRun(null); }
    load(); reload && reload();
  };
  const pending = data && data.run;
  const needle = text.trim().toLowerCase();
  const list = ((data && data.list) || []).filter((h) => !needle || [h.code, h.name, h.dept, h.designation].some((v) => String(v || '').toLowerCase().includes(needle)));
  return (
    <div>
      <div className="hx-alert info">Searches H360 for every Nursing Services employee (about 200 small searches, 4 at a time) and lists those with no record in our register. Doctors and other hospital staff are not kept.</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        {can ? <button className="btn pri" disabled={!ready || !!run} onClick={() => start(null)}><Ic d={I.search || I.check} s={13} c="#fff" />{run ? 'Searching H360…' : 'Search H360 for all nursing staff'}</button>
          : <span className="hx-muted">Staff edit access is needed to run the H360 sweep.</span>}
        {can && pending && !run && <button className="btn" onClick={() => start(pending)}>Continue ({pending.done}/{pending.total})</button>}
        <span className="spacer" />
        {data && <span className="hx-muted">{data.sweep ? `Last sweep ${hxWhen(data.sweep.finishedAt)} · ${data.known} Nursing Services people known` : 'No sweep yet'}</span>}
      </div>
      <HxProgress run={run} what="Searching H360" />
      {err && <div className="hx-alert red">{err}</div>}
      {data && <React.Fragment>
        <input className="hx-input" style={{ width: '100%', marginBottom: 8 }} placeholder="Filter by name, ID, department" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="hx-muted" style={{ marginBottom: 6 }}>{list.length} H360 {list.length === 1 ? 'person' : 'people'} not in our register{needle ? ' (filtered)' : ''}.</div>
        <div className="hx-scroll">
          <table className="hx-t">
            <thead><tr><th>H360 ID</th><th>Name</th><th>Designation</th><th className="hx-hide-sm">Department</th><th className="hx-hide-sm">Joined</th><th className="hx-hide-sm">Phone</th><th>In our register?</th></tr></thead>
            <tbody>{list.map((h) => (
              <tr key={h.code}>
                <td style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>{h.code}</td>
                <td style={{ fontWeight: 700, color: 'var(--ink)' }}>{h.name}</td>
                <td>{h.designation || '—'}</td>
                <td className="hx-hide-sm">{h.dept || '—'}</td>
                <td className="hx-hide-sm">{hxDate(h.joinDate)}</td>
                <td className="hx-hide-sm">{(h.phones || []).join(', ') || '—'}</td>
                <td>{h.ourMatch ? <a style={{ cursor: 'pointer', color: 'var(--blue)', fontWeight: 700 }} onClick={() => setRoute({ view: 'staffProfile', emp: h.ourMatch.id })}>
                  Maybe #{h.ourMatch.id} {h.ourMatch.name} ({h.ourMatch.empId || 'no emp ID'}, {h.ourMatch.why}{h.ourMatch.former ? ', Previous Staff' : ''})</a>
                  : h.idClash ? <span style={{ color: '#b42339' }}>No — and our #{h.idClash.id} {h.idClash.name} uses this ID</span>
                    : <span style={{ color: '#b42339', fontWeight: 700 }}>No</span>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </React.Fragment>}
    </div>
  );
}

/* ---------------- Duplicates & IDs ---------------- */
function HxDuplicates({ store, setRoute }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { hxApi('/api/h360-staff/results').then(setData).catch((e) => setErr(e.message)); }, []);
  // Shared emp IDs straight from our register (no H360 needed), then what the last check found.
  const shared = useMemo(() => {
    const m = {};
    (store.staff || []).filter((e) => e.is_active && !e.former && String(e.emp_id || '').trim()).forEach((e) => { const k = String(e.emp_id).trim(); (m[k] = m[k] || []).push(e); });
    return Object.entries(m).filter(([, v]) => v.length > 1);
  }, [store.staff]);
  const other = ((data && data.list) || []).filter((r) => r.status === 'id_other_person');
  const link = (e) => <a key={e.id} style={{ cursor: 'pointer', color: 'var(--blue)', fontWeight: 700, marginRight: 14 }} onClick={() => setRoute({ view: 'staffProfile', emp: e.id })}>#{e.id} {e.name}</a>;
  return (
    <div>
      {err && <div className="hx-alert red">{err}</div>}
      <h4 style={{ margin: '0 0 8px' }}>One emp ID on two active records ({shared.length})</h4>
      {shared.length ? <div className="hx-scroll" style={{ marginBottom: 18 }}><table className="hx-t"><thead><tr><th>Emp ID</th><th>Records</th></tr></thead>
        <tbody>{shared.map(([k, v]) => <tr key={k}><td style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>{k}</td><td>{v.map(link)}</td></tr>)}</tbody></table></div>
        : <div className="hx-alert info" style={{ marginBottom: 18 }}>None: every active record has its own emp ID.</div>}
      <h4 style={{ margin: '0 0 8px' }}>Our emp ID is another person in H360 ({other.length})</h4>
      {other.length ? <div className="hx-scroll"><table className="hx-t"><thead><tr><th>Emp ID</th><th>Our record</th><th>H360 says</th><th>H360 may know ours as</th></tr></thead>
        <tbody>{other.map((r) => <tr key={r.id}><td style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>{r.empId}</td><td>{link(r)}</td>
          <td>{r.h360 ? `${r.h360.name} (${[r.h360.designation, r.h360.dept].filter(Boolean).join(', ')})` : '—'}</td>
          <td>{(r.suggestions || []).map((s) => `${s.code} ${s.name}`).join('; ') || '—'}</td></tr>)}</tbody></table></div>
        : <div className="hx-alert info">{data && data.last ? 'None found in the last check.' : 'Run Bulk Verify first.'}</div>}
    </div>
  );
}

/* ---------------- the screen ---------------- */
function StaffH360View({ store, setRoute }) {
  const [tab, setTab] = useState(() => { try { return localStorage.getItem('uniconurse.h360check.tab') || 'lookup'; } catch (e) { return 'lookup'; } });
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState('');
  const reload = () => hxApi('/api/h360-staff/info').then(setInfo).catch((e) => setErr(e.message));
  useEffect(() => { reload(); }, []);
  const pick = (t) => { setTab(t); try { localStorage.setItem('uniconurse.h360check.tab', t); } catch (e) {} };
  const ready = !!(info && info.login);
  const TABS = [['lookup', 'Lookup'], ['verify', 'Bulk Verify'], ['missing', 'Not in register'], ['dups', 'Duplicates & IDs']];
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <HxStyle />
      <div className="card">
        <div className="card-h" style={{ flexWrap: 'wrap', gap: 10 }}>
          <Ic d={I.check} s={16} c="var(--blue)" />
          <div><h3>H360 Check</h3><div className="sub">Our staff register compared with the hospital's H360 employee list. H360 is only searched, never changed.</div></div>
          <span className="spacer" />
          <div className="seg" style={{ flexWrap: 'wrap' }}>{TABS.map(([id, label]) => <button key={id} className={tab === id ? 'on' : ''} onClick={() => pick(id)}>{label}</button>)}</div>
        </div>
        <div className="card-b">
          {err && <div className="hx-alert red">{err}</div>}
          {/* The Employee Search box sends three hidden values read from H360's roster page. If none
              were found there, H360 may answer every search with nobody — say so rather than let
              the whole register read "not in H360". */}
          {info && info.searchForm && !(info.searchForm.found || []).length && <div className="hx-alert amber">H360's Employee Search form values were not found on the Employee Roster page, so H360 may be answering every search with nobody. Treat "Emp ID not found in H360" with caution until this is checked (server setting H360_EMP_SEARCH_PARAMS can supply them).</div>}
          {info && !info.login && <div className="hx-alert amber">No H360 login is saved on this server{info.loginElsewhere ? ' (one was saved on another server, which this one cannot open)' : ''}. An administrator saves it once in Supervisor Reports → H360 Scan; this screen then works for everyone with staff access.</div>}
          {tab === 'lookup' && <HxLookup store={store} setRoute={setRoute} ready={ready} />}
          {tab === 'verify' && <HxVerify store={store} setRoute={setRoute} ready={ready} info={info} reload={reload} />}
          {tab === 'missing' && <HxMissing setRoute={setRoute} ready={ready} info={info} reload={reload} />}
          {tab === 'dups' && <HxDuplicates store={store} setRoute={setRoute} />}
        </div>
      </div>
    </div>
  );
}

/* ---------------- profile card ---------------- */
function StaffH360Card({ emp, store }) {
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const known = window.__UNICO_H360__ && window.__UNICO_H360__.byId ? window.__UNICO_H360__.byId[emp.id] : null;
  const check = async () => {
    setBusy(true); setErr('');
    try { setRes(await hxApi('/api/h360-staff/verify/' + encodeURIComponent(emp.id))); window.__UNICO_H360__ = null; }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const status = res ? res.status : known ? known.s : null;
  const m = status ? HX_STATUS[status] : null;
  return (
    <div className="card" style={{ borderLeft: '4px solid ' + (m ? m.c : 'var(--line)') }}>
      <HxStyle />
      <div className="card-h" style={{ flexWrap: 'wrap' }}>
        <h3>H360 record</h3><span className="sub">the hospital system's employee list</span>
        <span className="spacer" />
        {status && <HxPill status={status} />}
        <button className="btn sm" onClick={check} disabled={busy}>{busy ? 'Checking…' : 'Check now'}</button>
      </div>
      <div className="card-b">
        {err && <div className="hx-alert red">{err}</div>}
        {!res && <div className="hx-muted">{known ? `Last checked ${hxWhen(known.at)}${known.h ? ' · H360 name: ' + known.h : ''}. Press “Check now” for the details.` : 'Not checked yet. Press “Check now” to compare this record with H360.'}</div>}
        {res && <React.Fragment>
          {res.h360 && <div className="hx-pairs">{[['H360 ID', res.h360.code], ['H360 name', res.h360.name], ['Designation', res.h360.designation], ['Department', res.h360.dept], ['Joined', hxDate(res.h360.joinDate)], ['Service', res.h360.service], ['Phone', (res.h360.phones || []).join(', ')], ['Gender', res.h360.gender]].map(([k, v]) => <div key={k}><span>{k}</span>{v || '—'}</div>)}</div>}
          {res.status === 'id_other_person' && <div className="hx-alert red">H360 gives emp ID {res.empId} to {res.h360.name}, not to {res.name}. Either our emp ID is wrong or H360's record is.</div>}
          {res.status === 'not_in_h360' && <div className="hx-alert red">H360 has nobody with emp ID {res.empId}.</div>}
          {res.status === 'no_emp_id' && <div className="hx-alert amber">This record has no emp ID.</div>}
          {res.duplicateOf && <div className="hx-alert red">Emp ID {res.empId} is also on record(s) #{res.duplicateOf.join(', #')}.</div>}
          {res.status !== 'id_other_person' && <HxCompare result={res} store={store} />}
          <HxSuggestions result={res} store={store} />
        </React.Fragment>}
      </div>
    </div>
  );
}

Object.assign(window, { StaffH360View, StaffH360Card });
