/* UNICO — Staff Management → H360 Check → Census (administrators only). Data: /api/h360-staff/census*.

   How many people H360 lists in Nursing Services — managers, in-charges / team leaders, nurses,
   trainees, PCAs — against our register, and every mismatch for a person to look at:
     counts by group (H360 / ours / ±), the H360 × ours group table, per H360 unit, managers & leaders,
     lists (missing from us, Previous Staff still active in H360, ours not in H360 Nursing Services,
     gone from H360, someone else's ID, Nurse/PCA or rank differs, designation, age vs our date of
     birth, no date of birth, joining date / gender / phone, blanks H360 can fill, one ID twice),
     a groups editor, Excel, print and PDF.

   Safety: on H360 only its Employee Search is used (server/h360/staff.js), 2 searches at a time.
   H360 gives the AGE in whole years, never the date of birth — a date of birth is never written
   from it. Our register changes only through buttons a person presses: "Add to register" (a new
   record, checked first, Undo) and the existing H360 compare (one field at a time, old value kept).
   Shared helpers come from staff-h360.jsx (window.UNICO_HX). */

const { useState: useStateHC, useEffect: useEffectHC, useMemo: useMemoHC } = React;

const HC_LISTS = [
  ['missing', 'In H360, not in our register', 'red'],
  ['formerActive', 'Previous Staff, still active in H360', 'amber'],
  ['notInNursing', 'Ours, not in H360 Nursing Services', 'red'],
  ['goneActive', 'Gone from H360, active with us', 'red'],
  ['idOther', 'Our emp ID is another person in H360', 'red'],
  ['roleMismatch', 'Nurse / PCA differs', 'red'],
  ['rankMismatch', 'Rank differs (e.g. In-charge / Staff Nurse)', 'amber'],
  ['designation', 'Designation differs', 'amber'],
  ['ageDiff', 'Age differs from our date of birth', 'amber'],
  ['noDob', 'No date of birth with us (H360 age known)', 'info'],
  ['details', 'Joining date / gender / phone differs', 'amber'],
  ['fills', 'Blank with us, H360 has it', 'info'],
  ['sharedIds', 'One emp ID on two records', 'red'],
];
const HC_TONE = { red: '#b42339', amber: '#9a5a06', info: 'var(--blue)', green: '#13703d' };
const HC_WHY = { outside: 'In H360, but not in Nursing Services', not_found: 'Emp ID not found in H360', other_person: 'Emp ID belongs to another person', no_emp_id: 'No emp ID with us', unchecked: 'Not searched yet — run the census', error: 'Could not be checked' };
const hcEsc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const HC_CSS = `
.hc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:14px}
.hc-g{border:1px solid var(--line);border-radius:11px;padding:10px 12px;background:var(--panel)}
.hc-g h5{margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted)}
.hc-g .n{display:flex;gap:12px;align-items:baseline;font-family:var(--mono)}
.hc-g .n b{font-size:21px}
.hc-g .n span{font-size:11px;color:var(--muted);font-family:inherit}
.hc-big{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;margin-bottom:12px}
.hc-big div{border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:var(--panel-2)}
.hc-big b{display:block;font-size:28px;font-family:var(--mono);line-height:1.1;color:var(--ink)}
.hc-big span{font-size:12px;color:var(--muted)}
.hc-chips{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:10px}
.hc-chip{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:5px 11px;font:inherit;font-size:12px;cursor:pointer;color:var(--ink-2);display:inline-flex;gap:6px;align-items:center}
.hc-chip b{font-family:var(--mono)}
.hc-chip.on{box-shadow:0 0 0 2px var(--blue) inset;color:var(--ink)}
.hc-x td.c,.hc-x th.c{text-align:center;font-family:var(--mono)}
.hc-x td.click{cursor:pointer;color:var(--blue);font-weight:700}
.hc-x td.diag{background:rgba(31,157,87,.08);color:#13703d;font-weight:700}
.hc-sec{margin:18px 0 8px;display:flex;align-items:center;gap:8px}
.hc-sec h4{margin:0}
.hc-bg{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:1200;display:flex;align-items:flex-start;justify-content:center;padding:40px 14px;overflow:auto}
.hc-dlg{background:var(--panel);color:var(--ink);border-radius:14px;max-width:720px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);padding:16px 18px}
.hc-dlg h3{margin:0 0 4px}
.hc-form{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px 14px;margin:12px 0}
.hc-form label{display:grid;gap:4px;font-size:11.5px;color:var(--muted);font-weight:700}
.hc-side{font-size:11.5px;color:var(--muted)}
`;

// Pop-ups go to <body>: every .card has backdrop-filter, which would trap a fixed overlay inside it.
function HcLayer({ children, onClose }) {
  return ReactDOM.createPortal(<div className="hc-bg" onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}><style>{HC_CSS}</style>{children}</div>, document.body);
}

const hcGroupLabel = (groups, id) => ((groups || []).find((g) => g.id === id) || { label: id || '—' }).label;

/* ---------- Add to register: a new record from H360's person, checked first ---------- */
function HcAddDialog({ h, maybe, groups, store, onClose, onDone }) {
  const K = window.UNICO_HX;
  const ours = useMemoHC(() => K.hxOurDepts(store), [store && store.staff]);
  const role0 = h.group === 'pca' ? 'PCA' : 'Nurse';
  const [f, setF] = useStateHC({
    name: h.name || '', emp_id: h.code || '', role: role0, designation: h.designation || '', current_department: K.hxDeptFor(h.dept, ours) || '',
    doj: h.joinDate || '', phone: (h.phones || [])[0] || '', alt: (h.phones || []).slice(1).join(', '), gender: h.gender || '',
  });
  const [anyway, setAnyway] = useStateHC(false);
  const [busy, setBusy] = useStateHC(false);
  const [err, setErr] = useStateHC('');
  const set = (k) => (e) => setF(Object.assign({}, f, { [k]: e.target.value }));
  // Anyone we already hold who may be this person: same emp ID, same phone, or the same name.
  const NM = window.UNICO_NAME;
  const dup = useMemoHC(() => {
    const ph = String(f.phone || '').replace(/\D/g, '').slice(-10);
    return (store.staff || []).filter((r) => (String(r.emp_id || '').trim() && String(r.emp_id).trim() === String(f.emp_id).trim())
      || (ph.length === 10 && String(r.phone || '').replace(/\D/g, '').slice(-10) === ph)
      || (NM && NM.nameScore && NM.nameScore(r.name, f.name) >= (NM.SAME_NAME || 0.8))).slice(0, 5);
  }, [store.staff, f.emp_id, f.phone, f.name]);
  const missing = ['name', 'emp_id', 'role', 'current_department'].filter((k) => !String(f[k] || '').trim());
  const save = async () => {
    if (missing.length) { setErr('Fill in: ' + missing.join(', ').replace('emp_id', 'emp ID').replace('current_department', 'department') + '.'); return; }
    if (dup.length && !anyway) { setErr('We may already hold this person — open their record first, or tick “Create anyway”.'); return; }
    setBusy(true); setErr('');
    try {
      const me = window.__UNICO_USER__ || {};
      const at = new Date().toISOString();
      const rec = {
        name: f.name.trim(), emp_id: f.emp_id.trim(), role: f.role, designation: f.designation.trim(), current_department: f.current_department,
        doj: f.doj || '', phone: f.phone.trim(), gender: f.gender || '', remarks: '', notes: [], former: false,
        prior_experience_entries: [], previous_experience: '', prior_experience_years: 0, total_experience_years: 0, total_experience_text: '0 mo',
        custom: f.alt.trim() ? { cf_alternative_phone_number: f.alt.trim() } : {},
        h360_changes: [{ field: 'record', old: '', new: 'created from the H360 census', at, by: me.name || me.username || '', person_code: h.code }],
        updated_at: Date.now(),
      };
      const id = store.create(rec);
      if (!window.unicoFlushNow) throw new Error('Saving is unavailable in this tab — reload the page.');
      const res = await window.unicoFlushNow();
      if (!res || res.ok !== true) throw new Error((res && res.error) || 'The database did not confirm the save.');
      onDone({ id, name: rec.name, written: JSON.parse(JSON.stringify(Object.assign({}, rec, { id }))) });
    } catch (e) { setErr('Not saved: ' + e.message); }
    setBusy(false);
  };
  return (
    <HcLayer onClose={busy ? null : onClose}>
      <div className="hc-dlg" role="dialog" aria-label="Add to register">
        <h3>Add {h.name} to our register</h3>
        <div className="hx-muted">From H360: {h.code} · {[h.designation, h.dept, h.age && 'age ' + h.age, h.service && 'service ' + h.service].filter(Boolean).join(' · ')}. Check every value before saving. H360 gives no date of birth — add it on the profile later.</div>
        {(maybe || dup.length > 0) && <div className="hx-alert amber" style={{ marginTop: 10 }}>
          We may already hold this person:{' '}
          {(dup.length ? dup.map((r) => ({ id: r.id, name: r.name, empId: r.emp_id, former: r.former })) : [maybe]).map((r) => <b key={r.id} style={{ marginRight: 10 }}>#{r.id} {r.name} ({r.empId || 'no emp ID'}{r.former ? ', Previous Staff' : ''})</b>)}
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}><input type="checkbox" checked={anyway} onChange={(e) => setAnyway(e.target.checked)} />Create anyway — this is a different person</label>
        </div>}
        <div className="hc-form">
          <label>Name<input className="hx-input" value={f.name} onChange={set('name')} /></label>
          <label>Emp ID<input className="hx-input" value={f.emp_id} onChange={set('emp_id')} /></label>
          <label>Role<select className="hx-input" value={f.role} onChange={set('role')}><option>Nurse</option><option>PCA</option></select></label>
          <label>Designation<input className="hx-input" value={f.designation} onChange={set('designation')} /></label>
          <label>Our department<select className="hx-input" value={f.current_department} onChange={set('current_department')}><option value="">Choose…</option>{ours.map((d) => <option key={d} value={d}>{d}</option>)}</select><span className="hc-side">H360 unit: {h.dept || '—'}</span></label>
          <label>Joining date<input className="hx-input" type="date" value={f.doj} onChange={set('doj')} /></label>
          <label>Phone<input className="hx-input" value={f.phone} onChange={set('phone')} /></label>
          <label>Alternative phone<input className="hx-input" value={f.alt} onChange={set('alt')} /></label>
          <label>Gender<select className="hx-input" value={f.gender} onChange={set('gender')}><option value="">—</option><option>Female</option><option>Male</option><option>Other</option></select></label>
        </div>
        {err && <div className="hx-alert red">{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn pri" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Create record'}</button>
        </div>
      </div>
    </HcLayer>
  );
}

/* ---------- Compare: the existing H360 compare for one of our records ---------- */
function HcCompareDialog({ recId, store, onClose }) {
  const K = window.UNICO_HX;
  const [res, setRes] = useStateHC(null);
  const [err, setErr] = useStateHC('');
  const load = () => K.hxApi('/api/h360-staff/verify/' + encodeURIComponent(recId)).then(setRes).catch((e) => setErr(e.message));
  useEffectHC(() => { load(); }, [recId]);
  return (
    <HcLayer onClose={onClose}>
      <div className="hc-dlg" style={{ maxWidth: 900 }} role="dialog" aria-label="Compare with H360">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><h3>Compare with H360</h3><span className="spacer" style={{ flex: 1 }} /><button className="btn sm" onClick={onClose}>Close</button></div>
        {err && <div className="hx-alert red">{err}</div>}
        {!res && !err && <div className="hx-muted">Asking H360…</div>}
        {res && <React.Fragment>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '6px 0' }}><b>#{res.id} {res.name}</b><K.HxPill status={res.status} /></div>
          <K.HxAllFields h={res.h360} />
          {res.status === 'id_other_person' && res.h360 && <div className="hx-alert red">H360 gives emp ID {res.empId} to {res.h360.name}, not to {res.name}.</div>}
          {res.status !== 'id_other_person' && <K.HxCompare result={res} store={store} onChanged={() => setTimeout(load, 1500)} />}
          <K.HxSuggestions result={res} store={store} />
        </React.Fragment>}
      </div>
    </HcLayer>
  );
}

/* ---------- Groups editor ---------- */
function HcGroupsDialog({ data, onClose, onSaved }) {
  const K = window.UNICO_HX;
  const [map, setMap] = useStateHC(() => Object.assign({}, data.overrides || {}));
  const [busy, setBusy] = useStateHC(false);
  const [err, setErr] = useStateHC('');
  const [text, setText] = useStateHC('');
  const rows = (data.designations || []).filter((d) => !text.trim() || d.text.toLowerCase().includes(text.trim().toLowerCase()));
  const save = async () => {
    setBusy(true); setErr('');
    try { await K.hxApi('/api/h360-staff/census/groups', { method: 'PUT', body: { map } }); K.hxToast('Groups saved — the census is counted again.'); onSaved(); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <HcLayer onClose={busy ? null : onClose}>
      <div className="hc-dlg" style={{ maxWidth: 820 }} role="dialog" aria-label="Groups">
        <h3>Which group is each designation?</h3>
        <div className="hx-muted">Sorted automatically from the words in the designation. Move any designation to another group; it applies to H360 and to our register alike. “Automatic” puts it back.</div>
        <input className="hx-input" style={{ width: '100%', margin: '10px 0' }} placeholder="Filter designations" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="hx-scroll" style={{ maxHeight: '55vh', overflow: 'auto' }}>
          <table className="hx-t">
            <thead><tr><th>Designation</th><th className="c">H360</th><th className="c">Ours</th><th>Group</th></tr></thead>
            <tbody>{rows.map((d) => (
              <tr key={d.key}>
                <td style={{ color: 'var(--ink)', fontWeight: 600 }}>{d.text}</td>
                <td style={{ fontFamily: 'var(--mono)' }}>{d.h360 || ''}</td>
                <td style={{ fontFamily: 'var(--mono)' }}>{d.ours || ''}</td>
                <td><select className="hx-input" style={{ padding: '4px 8px', fontSize: 12 }} value={map[d.key] || ''} onChange={(e) => { const n = Object.assign({}, map); if (e.target.value) n[d.key] = e.target.value; else delete n[d.key]; setMap(n); }}>
                  <option value="">Automatic ({hcGroupLabel(data.groupsDef, d.rule)})</option>
                  {(data.groupsDef || []).map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                </select></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {err && <div className="hx-alert red" style={{ marginTop: 10 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn pri" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save groups'}</button>
        </div>
      </div>
    </HcLayer>
  );
}

/* ---------- print / PDF ---------- */
const HC_PRINT_CSS = `.hcp{font:11px/1.35 Arial,Helvetica,sans-serif;color:#000}.hcp h1{font-size:16px;margin:0 0 2px}.hcp h2{font-size:12.5px;margin:14px 0 5px;border-bottom:1px solid #000;padding-bottom:2px}.hcp .sub{color:#333;margin-bottom:8px}.hcp table{border-collapse:separate;border-spacing:0;width:100%;margin-bottom:6px}.hcp th,.hcp td{border-right:1px solid #999;border-bottom:1px solid #999;padding:3px 5px;text-align:left;vertical-align:top}.hcp tr>*:first-child{border-left:1px solid #999}.hcp thead tr>*{border-top:1px solid #999;background:#eee;font-weight:700}.hcp .n{text-align:center;font-family:Consolas,monospace}.hcp .foot{margin-top:10px;color:#444;font-size:9.5px}`;
function hcPrintDoc(data, listKey, rows) {
  const t = (head, body) => '<table><thead><tr>' + head.map((h) => '<th>' + hcEsc(h) + '</th>').join('') + '</tr></thead><tbody>' + body.map((r) => '<tr>' + r.map((c, i) => '<td' + (typeof c === 'number' ? ' class="n"' : '') + '>' + hcEsc(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
  const c = data.counts;
  const when = data.last ? new Date(data.last.finishedAt).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short' }) : 'not run yet';
  let body = '<h1>Nursing Services census — H360 vs our staff register</h1><div class="sub">Census ' + hcEsc(when) + (data.last && data.last.by ? ' by ' + hcEsc(data.last.by) : '') + ' · H360 ' + c.h360 + ' people · ours ' + c.ours + ' active · paired by emp ID ' + c.matched + '</div>';
  body += '<h2>By group</h2>' + t(['Group', 'H360', 'Ours', 'Paired, same group', 'Ours − H360'], data.groups.map((g) => [g.label, g.h360, g.ours, g.matched, g.diff]));
  body += '<h2>Mismatches</h2>' + t(['List', 'People'], HC_LISTS.map(([k, label]) => [label, c[k] || 0]));
  body += '<h2>By H360 unit</h2>' + t(['H360 unit', 'People', 'With us'].concat(data.groupsDef.map((g) => g.label)), data.units.map((u) => [u.unit, u.total, u.withUs].concat(data.groupsDef.map((g) => u[g.id] || 0))));
  if (listKey && rows && rows.length) {
    const label = (HC_LISTS.find((x) => x[0] === listKey) || [, listKey])[1];
    body += '<h2>' + hcEsc(label) + ' (' + rows.length + ')</h2>' + t(['H360 ID', 'H360 name', 'H360 designation', 'H360 unit', 'Our record', 'Our designation', 'Our department', 'Note'], rows.map((x) => {
      const h = x.h || {}, r = x.rec || (x.recs && x.recs[0]) || {};
      return [h.code || x.code || '', h.name || '', h.designation || '', h.dept || '', r.id ? '#' + r.id + ' ' + r.name + (r.empId ? ' (' + r.empId + ')' : '') : '', r.designation || '', r.dept || '', hcNote(listKey, x)];
    }));
  }
  body += '<div class="foot">H360 is only searched, never changed. H360 gives age in whole years, not the date of birth. Department is assigned by us; H360 units are shown for information.</div>';
  return { body, title: 'Nursing Services census ' + new Date().toISOString().slice(0, 10), file: 'Nursing-Services-census_' + new Date().toISOString().slice(0, 10) };
}
async function hcPdf(doc) {
  if (window.unicoLoadPdfLibs && !(window.jspdf && window.html2canvas)) await window.unicoLoadPdfLibs();
  const J = window.jspdf && window.jspdf.jsPDF, H = window.html2canvas;
  if (!J || !H) throw new Error('The PDF tools could not load. Use Print and choose “Save as PDF”.');
  const mmW = 297, mmH = 210, M = 10, pxW = 1123, pxPerMm = pxW / (mmW - 2 * M), pageH = (mmH - 2 * M - 6) * pxPerMm;
  const pdf = new J({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-30000px;top:0;width:' + pxW + 'px;background:#fff;z-index:-1';
  host.innerHTML = '<style>' + HC_PRINT_CSS + '</style><div class="hcp" style="width:' + pxW + 'px;padding:0 4px">' + doc.body + '</div>';
  document.body.appendChild(host);
  let pageNo = 0;
  try {
    const root = host.querySelector('.hcp');
    const scale = 2;
    const canvas = await H(root, { scale, backgroundColor: '#ffffff', logging: false, windowWidth: pxW });
    const top0 = root.getBoundingClientRect().top;
    const cuts = [...root.querySelectorAll('tr, h2')].map((el) => el.getBoundingClientRect().bottom - top0).sort((x, y) => x - y);
    const total = root.scrollHeight;
    let start = 0, guard = 0;
    while (start < total - 2 && guard++ < 80) {
      const limit = start + pageH;
      const end = total <= limit ? total : (cuts.filter((c) => c > start + 60 && c <= limit).pop() || limit);
      const c = document.createElement('canvas'); c.width = canvas.width; c.height = Math.max(1, Math.ceil((end - start) * scale));
      c.getContext('2d').drawImage(canvas, 0, start * scale, canvas.width, (end - start) * scale, 0, 0, canvas.width, (end - start) * scale);
      if (pageNo) pdf.addPage();
      pageNo++;
      pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', M, M, mmW - 2 * M, (end - start) / pxPerMm);
      start = end;
    }
  } finally { host.remove(); }
  for (let i = 1; i <= pageNo; i++) { pdf.setPage(i); pdf.setFontSize(7); pdf.setTextColor(120); pdf.text('Page ' + i + ' of ' + pageNo, mmW - M, mmH - 5, { align: 'right' }); }
  pdf.setProperties({ title: doc.title });
  pdf.save(doc.file + '.pdf');
}

// The short "what is wrong" line of a list row.
function hcNote(key, x) {
  const d = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '—');
  if (key === 'missing') return x.maybe ? 'maybe our #' + x.maybe.id + ' ' + x.maybe.name + ' (' + (x.maybe.empId || 'no emp ID') + ', ' + x.maybe.why + ')' : x.idClash ? 'our #' + x.idClash.id + ' ' + x.idClash.name + ' uses this ID' : 'not with us';
  if (key === 'formerActive') return 'in Previous Staff with us, still active in H360';
  if (key === 'notInNursing') return (HC_WHY[x.why] || x.why) + (x.h && x.why === 'outside' ? ' — H360: ' + (x.h.dept || '?') : '') + ((x.suggestions || [])[0] ? ' · H360 may know as ' + x.suggestions[0].code + ' ' + x.suggestions[0].name : '');
  if (key === 'goneActive') return 'a full census no longer met this person in H360' + (x.h && x.h.goneSince ? ' (since ' + d(x.h.goneSince) + ')' : '');
  if (key === 'idOther') return 'H360 gives this ID to ' + (x.h ? x.h.name : 'someone else');
  if (key === 'roleMismatch' || key === 'rankMismatch') return 'H360 ' + (x.h ? x.h.group : '') + ' / ours ' + (x.rec ? x.rec.group : '');
  if (key === 'designation') return 'H360 “' + (x.h ? x.h.designation : '') + '” / ours “' + (x.rec ? x.rec.designation : '') + '”';
  if (key === 'ageDiff') return 'our date of birth ' + d(x.rec && x.rec.dob) + ' = age ' + x.ourAge + '; H360 age ' + x.h360Age + ' (born about ' + (x.born ? x.born.text : '?') + ')';
  if (key === 'noDob') return 'H360 age ' + x.h360Age + ' → born about ' + (x.born ? x.born.text : '?') + ' (not written; add the real date on the profile)';
  if (key === 'details') return (x.diffs || []).map((f) => f.label + ': ours ' + (f.key === 'doj' ? d(f.ours) : f.ours || '—') + ' / H360 ' + (f.key === 'doj' ? d(f.h360) : f.h360 || '—')).join('; ');
  if (key === 'fills') return (x.fills || []).map((f) => f.label + ': ' + f.h360).join('; ');
  if (key === 'sharedIds') return (x.recs || []).map((r) => '#' + r.id + ' ' + r.name).join(' + ') + (x.h ? ' · H360: ' + x.h.name : '');
  return '';
}

/* ---------- the tab ---------- */
function HxCensus({ store, setRoute, ready, info, reload }) {
  const K = window.UNICO_HX;
  const [data, setData] = useStateHC(null);
  const [run, setRun] = useStateHC(null);
  const [err, setErr] = useStateHC('');
  const [list, setList] = useStateHC(() => { try { return localStorage.getItem('uniconurse.h360census.list') || 'missing'; } catch (e) { return 'missing'; } });
  const [cell, setCell] = useStateHC(null);       // { h, o } group filter from the cross-table
  const [text, setText] = useStateHC('');
  const [showUnits, setShowUnits] = useStateHC(true);
  const [showLeaders, setShowLeaders] = useStateHC(false);
  const [dlg, setDlg] = useStateHC(null);         // { kind: 'add'|'compare'|'groups', ... }
  const [added, setAdded] = useStateHC([]);       // records created here (for Undo)
  const [busy, setBusy] = useStateHC('');
  const load = () => K.hxApi('/api/h360-staff/census').then((d) => { setData(d); setErr(''); }).catch((e) => setErr(e.message));
  useEffectHC(() => { load(); }, []);
  // The register changed in this tab (Add / Compare / Undo): count again from the server.
  const staffKey = (store.staff || []).length + ':' + (store.staff || []).reduce((n, r) => Math.max(n, Number(r.updated_at) || 0), 0);
  useEffectHC(() => { const t = setTimeout(load, 1800); return () => clearTimeout(t); }, [staffKey]);
  const pick = (k) => { setList(k); setCell(null); try { localStorage.setItem('uniconurse.h360census.list', k); } catch (e) {} };
  const start = async (resume) => {
    if (!resume && !window.confirm('Run the H360 census now?\n\nThe app searches H360\'s Employee Search about 300 times (2 at a time, a few minutes), then checks our staff who are not in its Nursing Services list. Nothing on H360 or in our register is changed. Keep this tab open until it finishes.')) return;
    setErr('');
    try {
      await K.hxRunSteps(resume ? null : '/api/h360-staff/census', '/api/h360-staff/census/step', resume ? { id: resume.id } : {}, setRun);
      K.hxToast('H360 census finished.');
    } catch (e) { setErr(e.message); setRun(null); }
    load(); reload && reload();
  };
  const groups = (data && data.groupsDef) || [];
  const L = (data && data.lists) || {};
  const needle = text.trim().toLowerCase();
  const matchText = (x) => !needle || [x.h && x.h.code, x.h && x.h.name, x.h && x.h.designation, x.h && x.h.dept, x.rec && x.rec.name, x.rec && x.rec.empId, x.rec && x.rec.dept, x.rec && x.rec.designation, x.code]
    .concat((x.recs || []).map((r) => r.name)).some((v) => String(v || '').toLowerCase().includes(needle));
  const matchCell = (x) => !cell || ((cell.h == null || (x.h && x.h.group === cell.h)) && (cell.o == null || (x.rec && x.rec.group === cell.o)));
  const rows = (L[list] || []).filter((x) => matchText(x) && matchCell(x));
  const pendingRun = data && data.run;
  const sweep = data && data.last && data.last.sweep;

  const doPrint = async () => {
    const doc = hcPrintDoc(data, list, rows);
    const w = window.open('', '_blank');
    try {
      await K.hxApi('/api/h360-staff/census/print', { method: 'POST', body: { what: 'print · ' + list } });
      if (!w) { K.hxToast('Allow pop-ups for this site to print.', 'error'); return; }
      w.document.open();
      w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + hcEsc(doc.title) + '</title><style>@page{size:A4 landscape;margin:11mm}body{margin:0;padding:14px}@media print{body{padding:0}}' + HC_PRINT_CSS + '</style></head><body><div class="hcp">' + doc.body + '</div><script>window.onload=function(){setTimeout(function(){window.print();},200);};<\/script></body></html>');
      w.document.close();
    } catch (e) { if (w) w.close(); setErr(e.message); }
  };
  const doPdf = async () => {
    setBusy('pdf');
    try { await K.hxApi('/api/h360-staff/census/print', { method: 'POST', body: { what: 'pdf · ' + list } }); await hcPdf(hcPrintDoc(data, list, rows)); K.hxToast('PDF downloaded.'); }
    catch (e) { setErr(e.message); }
    setBusy('');
  };
  const undoAdd = async (a) => {
    const now = store.get ? store.get(a.id) : null;
    if (!now) { setAdded(added.filter((x) => x.id !== a.id)); return; }
    // Only the values typed in the dialog count (the save adds its own stamps, a check adds h360_verified).
    const same = ['name', 'emp_id', 'role', 'designation', 'current_department', 'doj', 'phone', 'gender'].every((k) => String(now[k] == null ? '' : now[k]) === String(a.written[k] == null ? '' : a.written[k]));
    if (!same) { window.alert(a.name + ' has been edited since it was created here, so it is not removed. Archive it from the profile if it should go.'); return; }
    if (!window.confirm('Undo: remove the record just created for ' + a.name + '? Nothing else is touched.')) return;
    try {
      store.destroy(a.id);
      const res = window.unicoFlushNow ? await window.unicoFlushNow() : { ok: false };
      if (!res || res.ok !== true) throw new Error((res && res.error) || 'The database did not confirm the undo.');
      setAdded(added.filter((x) => x.id !== a.id));
      K.hxToast('Undone: ' + a.name + ' removed.');
    } catch (e) { setErr('Undo failed: ' + e.message + ' Reload the staff list and check ' + a.name + '.'); }
  };

  const recLink = (r) => (r ? <span><a style={{ cursor: 'pointer', color: 'var(--blue)', fontWeight: 700 }} onClick={() => setRoute({ view: 'staffProfile', emp: r.id })}>#{r.id} {r.name}</a>{r.empId ? <span className="hx-muted"> · {r.empId}</span> : null}{r.former ? <span className="tag" style={{ marginLeft: 5 }}>Previous Staff</span> : null}</span> : <span className="hx-muted">—</span>);
  const hCell = (h) => (h ? <span><b style={{ fontFamily: 'var(--mono)' }}>{h.code}</b> <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{h.name}</span></span> : <span className="hx-muted">—</span>);
  const actions = (x) => {
    const rec = x.rec || null;
    const out = [];
    if (list === 'missing' && x.h && !added.some((a) => a.code === x.h.code)) out.push(<button key="add" className="btn sm pri" disabled={!K.hxCanEdit()} onClick={() => setDlg({ kind: 'add', h: x.h, maybe: x.maybe })}>Add to register</button>);
    if (list === 'missing' && x.maybe) out.push(<button key="open" className="btn sm" onClick={() => setRoute({ view: 'staffProfile', emp: x.maybe.id })}>Open #{x.maybe.id}</button>);
    if (rec && !rec.former && !['missing'].includes(list)) out.push(<button key="cmp" className="btn sm" disabled={!ready} onClick={() => setDlg({ kind: 'compare', id: rec.id })}>Compare</button>);
    if (rec) out.push(<button key="pro" className="btn sm" onClick={() => setRoute({ view: 'staffProfile', emp: rec.id })}>Profile</button>);
    if (x.recs) x.recs.forEach((r) => out.push(<button key={'p' + r.id} className="btn sm" onClick={() => setRoute({ view: 'staffProfile', emp: r.id })}>#{r.id}</button>));
    return <span style={{ display: 'inline-flex', gap: 5, flexWrap: 'wrap' }}>{out}</span>;
  };
  const crossClick = (h, o) => {
    if (o === 'none') { pick('missing'); setCell({ h, o: null }); return; }
    if (h === 'none') { pick('notInNursing'); setCell({ h: null, o }); return; }
    if (h === o) return;
    const role = (h === 'pca') !== (o === 'pca');
    setList(role ? 'roleMismatch' : 'rankMismatch'); setCell({ h, o });
  };

  return (
    <div>
      <style>{HC_CSS}</style>
      <div className="hx-alert info">How many people H360 lists in <b>Nursing Services</b> — managers, in-charges / team leaders, nurses, trainees and PCAs — against our register, with every mismatch listed. H360 is only searched (2 at a time); nothing there or in our register changes unless you press a button below. H360 gives the <b>age</b> in whole years, not the date of birth.</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <button className="btn pri" disabled={!ready || !!run} onClick={() => start(null)}>{run ? 'Census running…' : 'Run H360 census'}</button>
        {pendingRun && !run && <button className="btn" onClick={() => start(pendingRun)}>Continue the census ({pendingRun.done}/{pendingRun.total})</button>}
        <span className="spacer" style={{ flex: 1 }} />
        {data && <button className="btn" onClick={() => setDlg({ kind: 'groups' })}>Groups…</button>}
        {data && <a className="btn" href="/api/h360-staff/census.xlsx">Excel</a>}
        {data && <button className="btn" onClick={doPrint}>Print</button>}
        {data && <button className="btn" onClick={doPdf} disabled={busy === 'pdf'}>{busy === 'pdf' ? 'Making PDF…' : 'PDF'}</button>}
      </div>
      {run && <K.HxProgress run={run} what={run.phase === 'outside' ? 'Checking our staff who are not in H360\'s Nursing Services list' : 'Searching H360 for Nursing Services people'} />}
      {err && <div className="hx-alert red">{err}</div>}
      {!ready && <div className="hx-alert amber">The census needs the H360 login saved (top of this page).</div>}
      {data && <div className="hx-muted" style={{ marginBottom: 10 }}>
        {data.last ? <span>Last census {K.hxWhen(data.last.finishedAt)}{data.last.by ? ' by ' + data.last.by : ''}{sweep ? ' · H360 answered ' + sweep.met + ' Nursing Services people in ' + sweep.searches + ' searches' : ''}.</span>
          : <span>No census yet{data.sweep ? ' — the counts below come from the last H360 sweep and earlier checks' : ' — the counts below are only the H360 people met in earlier checks'}. Press “Run H360 census” for the full picture.</span>}
      </div>}
      {sweep && sweep.held && <div className="hx-alert amber">Nobody was marked “gone from H360” in the last census: {sweep.held}. Run it again later; people are only marked gone after a complete answer.</div>}
      {data && data.changes && (data.changes.joined.length > 0 || data.changes.left.length > 0) && <div className="hx-alert info">
        Since the census before ({K.hxWhen(data.previous && data.previous.finishedAt)}): <b>{data.changes.joined.length}</b> joined H360 Nursing Services{data.changes.joined.length ? ' (' + data.changes.joined.slice(0, 8).map((x) => x.code + ' ' + x.name).join(', ') + (data.changes.joined.length > 8 ? ' …' : '') + ')' : ''} · <b>{data.changes.left.length}</b> no longer listed{data.changes.left.length ? ' (' + data.changes.left.slice(0, 8).map((x) => x.code + ' ' + x.name).join(', ') + (data.changes.left.length > 8 ? ' …' : '') + ')' : ''}.
      </div>}
      {added.length > 0 && <div className="hx-alert info">Created here: {added.map((a) => <span key={a.id} style={{ marginRight: 12 }}><a style={{ cursor: 'pointer', color: 'var(--blue)', fontWeight: 700 }} onClick={() => setRoute({ view: 'staffProfile', emp: a.id })}>#{a.id} {a.name}</a> <button className="btn sm" onClick={() => undoAdd(a)}>Undo</button></span>)}</div>}

      {data && <React.Fragment>
        <div className="hc-big">
          <div><b>{data.counts.h360}</b><span>in H360 Nursing Services</span></div>
          <div><b>{data.counts.ours}</b><span>active in our register</span></div>
          <div><b style={{ color: '#13703d' }}>{data.counts.matched}</b><span>paired by emp ID (same person)</span></div>
          <div><b style={{ color: data.counts.ours - data.counts.h360 ? '#b42339' : '#13703d' }}>{(data.counts.ours - data.counts.h360 > 0 ? '+' : '') + (data.counts.ours - data.counts.h360)}</b><span>ours − H360</span></div>
        </div>
        <div className="hc-grid">
          {data.groups.map((g) => (
            <div className="hc-g" key={g.id}>
              <h5>{g.label}</h5>
              <div className="n"><b>{g.h360}</b><span>H360</span><b>{g.ours}</b><span>ours</span></div>
              <div style={{ fontSize: 11.5, marginTop: 4, color: g.diff ? '#b42339' : '#13703d', fontWeight: 700 }}>{g.diff ? (g.diff > 0 ? '+' : '') + g.diff + ' with us' : 'same count'} <span className="hx-muted" style={{ fontWeight: 400 }}>· {g.matched} paired</span></div>
            </div>
          ))}
        </div>

        <div className="hc-sec"><h4>H360 group × our group</h4><span className="hx-muted">people paired by emp ID; click a number to see them</span></div>
        <div className="hx-scroll" style={{ marginBottom: 12 }}>
          <table className="hx-t hc-x">
            <thead><tr><th>H360 says ↓ / we say →</th>{groups.map((g) => <th key={g.id} className="c">{g.label}</th>)}<th className="c">Not with us</th></tr></thead>
            <tbody>
              {groups.map((hg) => (
                <tr key={hg.id}><th>{hg.label}</th>
                  {groups.map((og) => { const n = data.cross[hg.id][og.id]; return <td key={og.id} className={'c ' + (hg.id === og.id ? 'diag' : n ? 'click' : '')} onClick={() => n && crossClick(hg.id, og.id)}>{n || ''}</td>; })}
                  <td className={'c ' + (data.cross[hg.id].none ? 'click' : '')} style={{ color: data.cross[hg.id].none ? '#b42339' : undefined }} onClick={() => data.cross[hg.id].none && crossClick(hg.id, 'none')}>{data.cross[hg.id].none || ''}</td>
                </tr>
              ))}
              <tr><th>Not in H360 Nursing</th>{groups.map((og) => { const n = data.notInH360By[og.id]; return <td key={og.id} className={'c ' + (n ? 'click' : '')} style={{ color: n ? '#b42339' : undefined }} onClick={() => n && crossClick('none', og.id)}>{n || ''}</td>; })}<td /></tr>
            </tbody>
          </table>
        </div>

        <div className="hc-sec"><h4>Mismatches</h4></div>
        <div className="hc-chips">
          {HC_LISTS.map(([k, label, tone]) => (
            <button key={k} className={'hc-chip' + (list === k ? ' on' : '')} onClick={() => pick(k)}><b style={{ color: (L[k] || []).length ? HC_TONE[tone] : 'var(--muted)' }}>{(L[k] || []).length}</b>{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <input className="hx-input" style={{ flex: '1 1 220px' }} placeholder="Filter by name, emp ID, unit, designation" value={text} onChange={(e) => setText(e.target.value)} />
          {cell && <span className="tag" style={{ cursor: 'pointer' }} onClick={() => setCell(null)}>{cell.h ? 'H360 ' + hcGroupLabel(groups, cell.h) : ''}{cell.h && cell.o ? ' · ' : ''}{cell.o ? 'ours ' + hcGroupLabel(groups, cell.o) : ''} ✕</span>}
          <span className="hx-muted">{rows.length} shown</span>
        </div>
        <div className="hx-scroll">
          <table className="hx-t">
            <thead><tr><th>H360</th><th className="hx-hide-sm">H360 designation · unit</th><th>Our record</th><th className="hx-hide-sm">Our designation · department</th><th>What</th><th /></tr></thead>
            <tbody>{rows.map((x, i) => {
              const r = x.rec || null;
              return (
                <tr key={(x.h && x.h.code) || x.code || (r && r.id) || i}>
                  <td>{hCell(x.h)}{x.h && (x.h.age || x.h.joinDate) ? <div className="hx-muted" style={{ fontSize: 11 }}>{[x.h.age && 'age ' + x.h.age, x.h.joinDate && 'joined ' + K.hxDate(x.h.joinDate), x.h.service].filter(Boolean).join(' · ')}</div> : null}</td>
                  <td className="hx-hide-sm">{x.h ? <span>{x.h.designation || '—'}<div className="hx-muted" style={{ fontSize: 11 }}>{x.h.dept || ''} · {hcGroupLabel(groups, x.h.group)}</div></span> : '—'}</td>
                  <td>{x.recs ? x.recs.map((rr) => <div key={rr.id}>{recLink(rr)}</div>) : recLink(r)}</td>
                  <td className="hx-hide-sm">{r ? <span>{r.designation || '—'}<div className="hx-muted" style={{ fontSize: 11 }}>{r.dept || ''} · {hcGroupLabel(groups, r.group)}{r.dob ? ' · born ' + K.hxDate(r.dob) : ''}</div></span> : '—'}</td>
                  <td style={{ maxWidth: 340 }}>{hcNote(list, x)}</td>
                  <td>{actions(x)}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        {!rows.length && <div className="hx-muted" style={{ padding: 10 }}>Nothing in this list{needle || cell ? ' with this filter' : ''}.</div>}

        <div className="hc-sec"><h4>By H360 unit</h4><button className="btn sm" onClick={() => setShowUnits(!showUnits)}>{showUnits ? 'Hide' : 'Show'}</button><span className="hx-muted">our departments are our own; shown for information</span></div>
        {showUnits && <div className="hx-scroll"><table className="hx-t hc-x">
          <thead><tr><th>H360 unit</th><th className="c">People</th><th className="c">With us</th>{groups.map((g) => <th key={g.id} className="c">{g.label}</th>)}<th className="hx-hide-sm">Our departments (paired people)</th></tr></thead>
          <tbody>{data.units.map((u) => <tr key={u.unit}><td style={{ fontWeight: 600, color: 'var(--ink)' }}>{u.unit}</td><td className="c">{u.total}</td><td className="c" style={{ color: u.withUs < u.total ? '#b42339' : undefined }}>{u.withUs}</td>{groups.map((g) => <td key={g.id} className="c">{u[g.id] || ''}</td>)}<td className="hx-hide-sm hx-muted">{u.ourDepts.map((x) => x.name + ' ' + x.n).join(', ')}</td></tr>)}</tbody>
        </table></div>}

        <div className="hc-sec"><h4>Managers & leaders ({data.leaders.length})</h4><button className="btn sm" onClick={() => setShowLeaders(!showLeaders)}>{showLeaders ? 'Hide' : 'Show'}</button></div>
        {showLeaders && <div className="hx-scroll"><table className="hx-t">
          <thead><tr><th>H360</th><th>H360 designation</th><th>Our record</th><th>Our designation</th></tr></thead>
          <tbody>{data.leaders.map((x, i) => <tr key={i}><td>{hCell(x.h)}{x.h ? <div className="hx-muted" style={{ fontSize: 11 }}>{x.h.dept}</div> : null}</td><td>{x.h ? x.h.designation + ' · ' + hcGroupLabel(groups, x.h.group) : <span style={{ color: '#b42339' }}>not in H360 Nursing</span>}</td><td>{recLink(x.rec)}</td><td>{x.rec ? x.rec.designation + ' · ' + hcGroupLabel(groups, x.rec.group) : <span style={{ color: '#b42339' }}>not with us</span>}</td></tr>)}</tbody>
        </table></div>}

        {(data.history || []).length > 1 && <React.Fragment>
          <div className="hc-sec"><h4>Census history</h4></div>
          <div className="hx-scroll"><table className="hx-t hc-x">
            <thead><tr><th>When</th><th>By</th><th className="c">H360</th><th className="c">Ours</th><th className="c">Paired</th><th className="c">Missing from us</th><th className="c">Ours not in H360</th></tr></thead>
            <tbody>{data.history.slice().reverse().map((h) => <tr key={h.at}><td>{K.hxWhen(h.at)}</td><td>{h.by || ''}</td><td className="c">{h.h360}</td><td className="c">{h.ours}</td><td className="c">{h.matched}</td><td className="c">{h.missing}</td><td className="c">{h.notInNursing}</td></tr>)}</tbody>
          </table></div>
        </React.Fragment>}
      </React.Fragment>}

      {dlg && dlg.kind === 'add' && <HcAddDialog h={dlg.h} maybe={dlg.maybe} groups={groups} store={store} onClose={() => setDlg(null)} onDone={(a) => { setAdded(added.concat([Object.assign({ code: dlg.h.code }, a)])); setDlg(null); K.hxToast(a.name + ' added to the register.'); }} />}
      {dlg && dlg.kind === 'compare' && <HcCompareDialog recId={dlg.id} store={store} onClose={() => { setDlg(null); load(); }} />}
      {dlg && dlg.kind === 'groups' && data && <HcGroupsDialog data={data} onClose={() => setDlg(null)} onSaved={() => { setDlg(null); load(); }} />}
    </div>
  );
}

window.HxCensus = HxCensus;
