/* UNICO — Staff Management → Paste & Update (administrators only).

   Paste the text of staff registration forms (typed out by ChatGPT / Gemini from the form photos, or
   any "Label: value" text); each person is matched to the staff register. The rule is window.UNICO_SI
   (staff-import-core.js). The screen:
     - OVERVIEW: tiles (All / New staff / Existing staff / Needs your check / Saved) that filter a table
       of every form — status, who it matched and why, how many fields change, warnings, actions — and a
       CSV summary for the file;
     - one CARD per form with a status badge, a field table (tick = write) and Update… / Create… buttons;
     - the COMPARE POP-UP: register vs form side by side, a choice per field (Keep / Use form / Merge /
       Edit), quick buttons, search ANY person on the register, a duplicate guard before Create, and
       Save for this one person at once;
     - UNDO for anything saved here in this session (only fields still as written are put back).
   Writes are the normal staff save (store.update / create + unicoFlushNow): the same conflict check,
   permissions and activity log as the staff form. Every applied form is kept on the record
   (import_source + import_source_history: filled, replaced with the old value, left, warnings). */

const { useState, useMemo } = React;
const Ic = window.Ic, I = window.I;
const spIsAdmin = () => { const u = window.__UNICO_USER__; return !u || u.role === 'Administrator'; };
const spToast = (m, t) => { try { window.UI && window.UI.toast && window.UI.toast(m, t || 'success'); } catch (e) {} };
const spDate = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? String(iso).split('-').reverse().join('/') : String(iso || ''));
const SP_DATE_KEYS = ['dob', 'doj', 'licence_expiry'];
const spShow = (k, v) => (v == null || v === '' ? '—' : SP_DATE_KEYS.indexOf(k) >= 0 ? spDate(v) : typeof v === 'string' ? v : JSON.stringify(v));
const spPortal = (n) => (window.ReactDOM && window.ReactDOM.createPortal && typeof document !== 'undefined') ? window.ReactDOM.createPortal(n, document.body) : n;   // a .card (backdrop-filter) would trap position:fixed
const spMeta = () => { const me = window.__UNICO_USER__ || {}; return { at: new Date().toISOString(), by: me.name || me.username || 'Administrator' }; };
// Warnings that mean "look at this before saving".
const SP_SERIOUS = /signature|Same (form number|phone|employee ID)|not an 11-digit|expired|More than one BNMC|not readable|not understood/i;

const SP_CSS = `
.sp-step{display:flex;align-items:center;gap:9px;font-size:13px;font-weight:800;color:var(--ink);margin-bottom:8px}
.sp-step i{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:var(--blue);color:#fff;font-style:normal;font-size:11.5px}
.sp-prompt{white-space:pre-wrap;font-family:var(--mono);font-size:11.5px;line-height:1.5;background:var(--panel-2);border:1px solid var(--line);border-radius:9px;padding:10px 12px;max-height:240px;overflow:auto;margin:0}
.sp-text{width:100%;box-sizing:border-box;min-height:170px;font:inherit;font-size:12.5px;line-height:1.5;border:1px solid var(--line);border-radius:9px;padding:10px 12px;background:var(--panel);color:var(--ink);resize:vertical}
.sp-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:12px}
.sp-tile{border:1px solid var(--line);border-left:4px solid var(--c);border-radius:11px;padding:10px 13px;background:var(--panel);text-align:left;cursor:pointer;font:inherit}
.sp-tile b{display:block;font-size:24px;line-height:1.1;font-family:var(--mono);color:var(--c)}
.sp-tile span{font-size:11.5px;color:var(--muted);font-weight:700}
.sp-tile.on{box-shadow:0 0 0 2px var(--c) inset;background:var(--panel-2)}
.sp-card{border:1px solid var(--line);border-left:4px solid var(--c, var(--line));border-radius:12px;background:var(--panel);margin-bottom:12px;overflow:hidden;scroll-margin-top:90px}
.sp-card-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;background:var(--panel-2)}
.sp-card-b{padding:11px 14px;border-top:1px solid var(--line-2)}
.sp-t{width:100%;border-collapse:collapse;font-size:12.5px}
.sp-t th{text-align:left;padding:7px 8px;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);font-weight:700;border-bottom:1px solid var(--line);white-space:nowrap}
.sp-t td{padding:6px 8px;border-bottom:1px solid var(--line-2);vertical-align:top;color:var(--ink-2)}
.sp-t tr.diff td{background:rgba(224,138,30,.07)}
.sp-t tr.fill td{background:rgba(31,157,87,.045)}
.sp-t tr.off td{opacity:.55}
.sp-t tr.same td{color:var(--muted)}
.sp-t tr.click{cursor:pointer}.sp-t tr.click:hover td{background:var(--panel-2)}
.sp-in{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:7px;padding:5px 8px;font:inherit;font-size:12.5px;background:var(--panel);color:var(--ink)}
.sp-badge{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:800;letter-spacing:.3px;padding:4px 11px;border-radius:999px;color:#fff;background:var(--c);white-space:nowrap}
.sp-chip{display:inline-block;font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:999px;white-space:nowrap}
.sp-chip.fill{background:#eaf7ef;color:#13703d}.sp-chip.diff{background:#fff5e6;color:#9a5a06}.sp-chip.new{background:#e8f3fb;color:#0b5f8a}.sp-chip.same{background:var(--panel-2);color:var(--muted)}.sp-chip.check{background:#fff5e6;color:#9a5a06;border:1px solid #f6dcb0}
.sp-warn{background:#fff5e6;border:1px solid #f6dcb0;color:#7a4705;border-radius:9px;padding:8px 11px 8px 26px;font-size:12px;margin:0 0 10px}
.sp-warn li{margin:2px 0}
.sp-ok{background:#eaf7ef;border:1px solid #c4e6d1;color:#13703d;border-radius:9px;padding:10px 12px;font-size:12.5px}
.sp-err{background:#fdf0f2;border:1px solid #f2c4cd;color:#8f1d30;border-radius:9px;padding:10px 12px;font-size:12.5px;margin-bottom:12px}
.sp-dup{background:#fdf0f2;border:1px solid #f2c4cd;color:#8f1d30;border-radius:10px;padding:10px 13px;font-size:12.5px;margin-bottom:12px}
.sp-muted{color:var(--muted);font-size:12px}
.sp-seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;white-space:nowrap}
.sp-seg button{border:0;background:var(--panel);color:var(--ink-2);font:inherit;font-size:11px;font-weight:700;padding:4px 9px;cursor:pointer;border-right:1px solid var(--line)}
.sp-seg button:last-child{border-right:0}
.sp-seg button.on{background:var(--blue);color:#fff}
.sp-seg button.on.keep{background:#5b6676}
.sp-ov{position:fixed;inset:0;background:rgba(15,25,40,.45);z-index:9000;display:grid;place-items:center;padding:16px}
.sp-dlg{background:var(--panel, #fff);border-radius:14px;box-shadow:0 30px 80px rgba(0,0,0,.35);width:min(1180px,100%);max-height:92vh;display:flex;flex-direction:column;overflow:hidden}
.sp-dlg-h{padding:13px 18px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.sp-dlg-b{padding:13px 18px;overflow:auto;flex:1}
.sp-dlg-f{padding:11px 18px;border-top:1px solid var(--line);display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:var(--panel-2)}
.sp-cand{display:inline-flex;flex-direction:column;align-items:flex-start;gap:2px;border:1px solid var(--line);border-radius:9px;padding:6px 10px;background:var(--panel);cursor:pointer;font:inherit;text-align:left;max-width:300px}
.sp-cand.on{box-shadow:0 0 0 2px var(--blue) inset}
.sp-cand small{color:var(--muted);font-size:10.5px}
`;

/* ---------- one person's plan, as the administrator has set it ---------- */
function spPlan(p, st, staff) {
  const SI = window.UNICO_SI;
  const s = st || {};
  const fields = Object.assign({}, p.fields, s.edits || {});
  // A date typed in as on the form (10/11/2026) is stored the register's way (2026-11-10).
  SP_DATE_KEYS.forEach((k) => { if (s.edits && s.edits[k]) { const d = SI.parseDate(s.edits[k]); if (d) fields[k] = d.iso; } });
  const pe = Object.assign({}, p, { fields });
  const isNew = s.choice === 'new';
  const rec = !isNew && s.choice !== 'skip' && s.choice != null ? (staff || []).find((r) => String(r.id) === String(s.choice)) || null : null;
  const plan = SI.planUpdate(pe, rec);
  if (isNew && !plan.rows.some((r) => r.key === 'current_department')) {
    plan.rows.splice(3, 0, { key: 'current_department', label: 'Department', kind: 'new', stored: '', form: '', value: '', formValue: '' });
  }
  const choices = Object.assign(SI.defaultChoices(plan), s.choices || {});
  const live = plan.rows.filter((r) => r.kind !== 'same');
  const counts = {
    fill: live.filter((r) => r.kind !== 'diff' && choices[r.key] !== 'keep').length,
    replace: live.filter((r) => r.kind === 'diff' && choices[r.key] !== 'keep').length,
    keep: live.filter((r) => choices[r.key] === 'keep').length,
    differ: live.filter((r) => r.kind === 'diff').length,
    same: plan.rows.length - live.length,
  };
  return { pe, rec, plan, choices, counts, isNew };
}

/* ---------- where a form stands: saved / new / existing / to check ---------- */
function spStatus(p, st, match, rec) {
  const s = st || {};
  const cands = (match && match.candidates) || [];
  const check = !s.done && ((match && match.decision === 'choose') || p.warnings.some((w) => SP_SERIOUS.test(w)) || (s.choice === 'new' && cands.length > 0));
  if (s.done) return { code: 'saved', label: s.done.what === 'created' ? 'SAVED · NEW RECORD' : 'SAVED · UPDATED', c: '#5b6676', check: false, reason: s.done.name + (s.done.what === 'created' ? ' was added to the register.' : ' was updated (' + s.done.count + ' field' + (s.done.count === 1 ? '' : 's') + ').') };
  if (s.choice === 'new') return { code: 'new', label: 'NEW STAFF', c: '#0b78b3', check, reason: cands.length ? 'Looks like ' + cands.slice(0, 2).map((c) => c.name + (c.emp_id ? ' (' + c.emp_id + ')' : '')).join(', ') + ' — compare before creating.' : 'Not on the register: no one has this phone or NID, or this name with the same joining / birth date.' };
  if (s.choice != null && s.choice !== 'skip') {
    const c = cands.find((x) => String(x.id) === String(s.choice));
    return { code: 'existing', label: 'EXISTING · ' + (rec ? rec.name + (rec.emp_id ? ' (' + rec.emp_id + ')' : '') : '#' + s.choice), c: '#13803f', check, reason: c ? 'Matched by ' + c.why.join(', ') + '.' : 'Picked by you.' };
  }
  if (cands.length) return { code: 'check', label: 'CHECK — ' + cands.length + ' possible match' + (cands.length === 1 ? '' : 'es'), c: '#c27a06', check: true, reason: 'Not sure who this is. Open Update… to compare, or Create… if it is a new person.' };
  return { code: 'skip', label: 'SKIPPED', c: '#8b98ab', check, reason: 'Nothing will be written for this form.' };
}

/* ---------- saving: the normal staff save, one flush for everything given ---------- */
async function spSaveAll(store, items) {
  const SI = window.UNICO_SI;
  const meta = spMeta();
  const done = [];
  for (const x of items) {
    if (x.isNew) {
      const rec = SI.newRecord(x.pe, x.plan, x.choices, meta);
      if (!rec.current_department) rec.current_department = 'Unassigned';
      const id = store.create(rec);
      done.push({ n: x.p.n, id, name: rec.name, what: 'created', count: Object.keys(rec).length, written: JSON.parse(JSON.stringify(rec)), at: meta.at });
    } else {
      const b = SI.buildPatch(x.pe, x.rec, x.plan, x.choices, meta);
      if (!b.changed) continue;
      store.update(x.rec.id, b.patch);
      done.push({ n: x.p.n, id: x.rec.id, name: x.rec.name, what: 'updated', count: b.filled.length + Object.keys(b.replaced).length, replaced: Object.keys(b.replaced).length, before: b.before, written: b.written, at: meta.at });
    }
  }
  if (!done.length) return done;
  if (!window.unicoFlushNow) throw new Error('Saving is unavailable in this tab — reload the page.');
  const res = await window.unicoFlushNow();
  if (!res || res.ok !== true) throw new Error((res && res.error) || 'The database did not confirm the save.');
  return done;
}

/* ---------- the choice control for one row ---------- */
function SpChoice({ r, how, onPick, editing, onEdit, isNew }) {
  const opts = isNew ? [['form', 'Use'], ['keep', 'Leave out']]
    : r.list ? [['keep', 'Keep'], ['merge', 'Merge'], ['form', 'Use form']]
    : [['keep', 'Keep'], ['form', 'Use form']];
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <span className="sp-seg">
        {opts.map(([v, l]) => <button key={v} type="button" className={(how === v ? 'on ' : '') + (v === 'keep' ? 'keep' : '')} onClick={() => onPick(v)}>{l}</button>)}
      </span>
      {!r.exp && !r.list && <button type="button" className="btn sm" onClick={onEdit}>{editing ? 'Done' : 'Edit'}</button>}
    </span>
  );
}

/* ---------- the compare pop-up ---------- */
function SpCompareDialog({ p, st, set, staff, match, mode, onClose, onSave, setRoute }) {
  const SI = window.UNICO_SI;
  const [q, setQ] = useState('');
  const [showSame, setShowSame] = useState(false);
  const [editing, setEditing] = useState({});
  const [anyway, setAnyway] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const isCreate = mode === 'create';
  // Create on a form that was matched to someone: start from the new-record defaults, not that compare's choices.
  // The card becomes "new" only once a choice is made here (or on Create), so Cancel changes nothing.
  const eff = isCreate && st.choice !== 'new' ? Object.assign({}, st, { choice: 'new', choices: {} }) : st;
  const view = spPlan(p, eff, staff);
  const { rec, plan, choices, counts } = view;
  const cands = (match && match.candidates) || [];
  const found = useMemo(() => SI.searchRoster(q, staff), [q, staff]);
  const pickTarget = (id) => { set({ choice: id, choices: {}, edits: st.edits || {} }); setErr(''); };
  const asNew = isCreate && st.choice !== 'new' ? { choice: 'new' } : {};
  const setChoice = (key, v) => set(Object.assign({}, asNew, { choices: Object.assign({}, eff.choices || {}, { [key]: v }) }));
  const quick = (m) => set(Object.assign({}, asNew, { choices: SI.quickChoices(plan, m) }));
  const edit = (k, v) => set(Object.assign({}, asNew, { edits: Object.assign({}, st.edits || {}, { [k]: v }), choices: Object.assign({}, eff.choices || {}, { [k]: 'form' }) }));
  const rows = plan.rows.filter((r) => showSame || r.kind !== 'same');
  const blocked = isCreate ? (cands.length > 0 && !anyway) || !String(view.pe.fields.name || '').trim() : !rec;
  const save = async () => {
    setBusy(true); setErr('');
    try {
      if (isCreate) set({ choice: 'new' });
      const out = await onSave(Object.assign({ p }, view, { isNew: isCreate }));
      if (out) onClose();
    } catch (e) { setErr((e && e.message) || 'Not saved.'); }
    finally { setBusy(false); }
  };
  return spPortal(
    <div className="sp-ov" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="sp-dlg" role="dialog" aria-modal="true">
        <div className="sp-dlg-h">
          <span className="sp-badge" style={{ '--c': isCreate ? '#0b78b3' : '#13803f' }}>{isCreate ? 'CREATE NEW' : 'UPDATE EXISTING'}</span>
          <b style={{ fontSize: 14.5, color: 'var(--ink)' }}>Form #{p.n} · {view.pe.fields.name || 'No name'}</b>
          <span className="sp-muted">{[p.fields.role, p.fields.designation, p.fields.form_no].filter(Boolean).join(' · ')}</span>
          <span style={{ flex: 1 }} />
          <button className="btn sm" onClick={onClose} disabled={busy}>Close</button>
        </div>
        <div className="sp-dlg-b">
          {/* WHO: suggested matches + search anyone (update) / duplicate guard (create) */}
          {!isCreate && (
            <div style={{ marginBottom: 12 }}>
              <div className="sp-muted" style={{ fontWeight: 700, marginBottom: 6 }}>Update which staff record?</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {cands.map((c) => (
                  <button key={c.id} type="button" className={'sp-cand' + (String(st.choice) === String(c.id) ? ' on' : '')} onClick={() => pickTarget(c.id)}>
                    <b>{c.strong ? '✓ ' : '? '}{c.name}{c.emp_id ? ' · ' + c.emp_id : ''}{c.former ? ' · archived' : ''}</b>
                    <small>{c.why.join(' · ')}</small>
                  </button>
                ))}
                {!cands.length && <span className="sp-muted">No suggested match — search the register below.</span>}
              </div>
              <input className="sp-in" style={{ maxWidth: 420 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search anyone: name, employee ID or phone…" />
              {q.trim().length >= 2 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {found.map((c) => (
                    <button key={c.id} type="button" className={'sp-cand' + (String(st.choice) === String(c.id) ? ' on' : '')} onClick={() => { pickTarget(c.id); setQ(''); }}>
                      <b>{c.name}{c.emp_id ? ' · ' + c.emp_id : ''}{c.former ? ' · archived' : ''}</b>
                      <small>{[c.designation, c.current_department, c.phone].filter(Boolean).join(' · ')} — {c.why.join(', ')}</small>
                    </button>
                  ))}
                  {!found.length && <span className="sp-muted">Nobody found.</span>}
                </div>
              )}
              {rec && <div style={{ marginTop: 10, fontSize: 12.5 }}>Comparing with <b>{rec.name}</b>{rec.emp_id ? ' · ID ' + rec.emp_id : ''}{rec.current_department ? ' · ' + rec.current_department : ''}{rec.former ? ' · in Previous Staff' : ''} <button className="btn sm" style={{ marginLeft: 6 }} onClick={() => { onClose(); setRoute({ view: 'staffProfile', emp: rec.id }); }}>Open profile</button></div>}
            </div>
          )}
          {isCreate && cands.length > 0 && (
            <div className="sp-dup">
              <b>Wait — this may already be on the register.</b>
              <div style={{ display: 'grid', gap: 6, margin: '8px 0' }}>
                {cands.map((c) => (
                  <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span><b>{c.name}</b>{c.emp_id ? ' · ' + c.emp_id : ''}{c.former ? ' · archived' : ''} — {c.why.join(', ')}</span>
                    <button className="btn sm" onClick={() => { pickTarget(c.id); onClose(); setTimeout(() => window.dispatchEvent(new CustomEvent('sp:open', { detail: { n: p.n, mode: 'update' } })), 0); }}>Compare with them</button>
                  </div>
                ))}
              </div>
              <label style={{ display: 'inline-flex', gap: 7, alignItems: 'center', fontWeight: 700, cursor: 'pointer' }}><input type="checkbox" checked={anyway} onChange={(e) => setAnyway(e.target.checked)} />It is a different person — create anyway</label>
            </div>
          )}
          {p.warnings.length > 0 && <ul className="sp-warn">{p.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}

          {(isCreate || rec) && (
            <React.Fragment>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                <span className="sp-muted" style={{ fontWeight: 700 }}>Quick:</span>
                {isCreate
                  ? <React.Fragment><button className="btn sm" onClick={() => quick('form')}>Use every field</button><button className="btn sm" onClick={() => quick('keep')}>Clear all</button></React.Fragment>
                  : <React.Fragment><button className="btn sm" onClick={() => quick('blanks')}>Fill blanks only</button><button className="btn sm" onClick={() => quick('form')}>Use all form values</button><button className="btn sm" onClick={() => quick('keep')}>Keep all</button><button className="btn sm" onClick={() => set({ choices: {} })}>Reset</button></React.Fragment>}
                <span style={{ flex: 1 }} />
                {!isCreate && counts.same > 0 && <label className="sp-muted" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={showSame} onChange={(e) => setShowSame(e.target.checked)} />Show {counts.same} matching field{counts.same === 1 ? '' : 's'}</label>}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="sp-t">
                  <thead><tr><th>Field</th>{!isCreate && <th>On the register now</th>}<th>{isCreate ? 'Value' : 'From the form'}</th><th>Choice</th><th /></tr></thead>
                  <tbody>
                    {rows.map((r) => {
                      const how = choices[r.key] || 'keep';
                      const ed = !!editing[r.key] || (isCreate && !r.exp && !r.list);
                      const shown = eff.edits && eff.edits[r.key] != null ? eff.edits[r.key] : String(r.formValue == null ? r.form : r.formValue);
                      return (
                        <tr key={r.key} className={r.kind === 'same' ? 'same' : r.kind === 'diff' ? 'diff' : 'fill'}>
                          <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{r.label}</td>
                          {!isCreate && <td style={{ maxWidth: 320 }}>{spShow(r.key, r.stored)}</td>}
                          <td style={{ maxWidth: 380 }}>
                            {ed && !r.exp && !r.list
                              ? <input className="sp-in" value={shown} placeholder={r.key === 'current_department' ? 'e.g. MICU — or leave blank' : SP_DATE_KEYS.indexOf(r.key) >= 0 ? 'DD/MM/YYYY' : ''} onChange={(e) => edit(r.key, e.target.value)} />
                              : <span>{r.exp ? r.form : spShow(r.key, r.formValue == null ? r.form : r.formValue)}{r.list && r.added && r.stored ? <span className="sp-muted"> (+ {r.added.join(', ')})</span> : null}</span>}
                          </td>
                          <td>{r.kind === 'same' ? <span className="sp-chip same">Same</span> : <SpChoice r={r} how={how} isNew={isCreate} editing={!!editing[r.key]} onPick={(v) => setChoice(r.key, v)} onEdit={() => setEditing(Object.assign({}, editing, { [r.key]: !editing[r.key] }))} />}</td>
                          <td>{r.kind === 'same' ? null : <span className={'sp-chip ' + (r.kind === 'diff' ? 'diff' : r.kind === 'new' ? 'new' : 'fill')}>{r.kind === 'diff' ? 'Mismatch' : r.kind === 'new' ? 'New' : r.added && r.stored ? 'Adds' : 'Blank on register'}</span>}</td>
                        </tr>
                      );
                    })}
                    {!rows.length && <tr><td colSpan={5} className="sp-muted">The register already holds everything on this form.</td></tr>}
                  </tbody>
                </table>
              </div>
            </React.Fragment>
          )}
          {err && <div className="sp-err" style={{ marginTop: 12 }}>{err}</div>}
        </div>
        <div className="sp-dlg-f">
          <span className="sp-muted">{isCreate ? (plan.rows.length - counts.keep) + ' fields go on the new record' : rec ? 'Will fill ' + counts.fill + ' · replace ' + counts.replace + ' · keep ' + counts.keep : 'Pick the staff record to compare with.'}</span>
          <span style={{ flex: 1 }} />
          <button className="btn sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn pri" disabled={busy || blocked || (!isCreate && counts.fill + counts.replace === 0)} onClick={save}>{busy ? 'Saving…' : isCreate ? 'Create record' : 'Save update'}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- one form's card ---------- */
function SpPerson({ p, st, set, staff, match, status, open, onToggle, onOpen, onUndo, onSaveOne, saving, setRoute }) {
  const view = spPlan(p, st, staff);
  const { rec, plan, choices, counts, isNew } = view;
  const rows = plan.rows.filter((r) => r.kind !== 'same');
  const tick = (r, on) => set({ choices: Object.assign({}, st.choices || {}, { [r.key]: on ? ((r.list && r.stored) ? 'merge' : 'form') : 'keep' }) });
  const edit = (k, v) => set({ edits: Object.assign({}, st.edits || {}, { [k]: v }) });
  const editable = (r) => !r.exp && !r.list;
  return (
    <div className="sp-card" id={'sp-card-' + p.n} style={{ '--c': status.c }}>
      <div className="sp-card-h">
        <button type="button" className="btn sm" onClick={onToggle} title={open ? 'Collapse' : 'Expand'} style={{ minWidth: 30 }}>{open ? '▾' : '▸'}</button>
        <b style={{ fontSize: 13.5, color: 'var(--ink)' }}>#{p.n} · {(st.edits && st.edits.name) || p.fields.name || 'No name'}</b>
        <span className="sp-badge" style={{ '--c': status.c }}>{status.label}</span>
        {status.check && <span className="sp-chip check">Needs your check</span>}
        <span className="sp-muted">{[p.fields.designation || p.fields.role, p.fields.form_no].filter(Boolean).join(' · ')}</span>
        <span style={{ flex: 1 }} />
        {st.done ? (
          <React.Fragment>
            <button className="btn sm" onClick={() => setRoute({ view: 'staffProfile', emp: st.done.id })}>Open profile</button>
            <button className="btn sm" onClick={onUndo}>Undo</button>
          </React.Fragment>
        ) : (
          <React.Fragment>
            {st.choice !== 'skip' && (isNew || (rec && counts.fill + counts.replace > 0)) && (
              <button className="btn pri sm" disabled={saving} onClick={onSaveOne} title="Save only this person now, with the ticks below">{saving ? 'Saving…' : isNew ? 'Create this person' : 'Save this person'}</button>
            )}
            <button className="btn sm" onClick={() => onOpen('update')}>Update existing…</button>
            <button className="btn sm" onClick={() => onOpen('create')}>Create new…</button>
            <select className="sp-in" style={{ width: 'auto', maxWidth: 260 }} value={String(st.choice)} onChange={(e) => set({ choice: e.target.value, choices: {} })} title="What the batch Apply does with this form">
              {(match.candidates || []).map((c) => <option key={c.id} value={String(c.id)}>{(c.strong ? '✓ ' : '? ') + c.name + (c.emp_id ? ' · ' + c.emp_id : '')}</option>)}
              {rec && !(match.candidates || []).some((c) => String(c.id) === String(rec.id)) && <option value={String(rec.id)}>{rec.name}</option>}
              <option value="new">+ New staff record</option>
              <option value="skip">Skip this form</option>
            </select>
          </React.Fragment>
        )}
      </div>
      <div style={{ padding: '6px 14px 8px', fontSize: 12, color: 'var(--ink-2)', borderTop: '1px solid var(--line-2)' }}>
        {status.reason}
        {!st.done && !isNew && rec && <span className="sp-muted"> · {counts.fill} to fill · {counts.differ} differ{counts.replace ? ' (' + counts.replace + ' to replace)' : ''} · {counts.same} same</span>}
      </div>
      {open && !st.done && (
        <div className="sp-card-b">
          {p.warnings.length > 0 && <ul className="sp-warn">{p.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
          {st.choice !== 'skip' && (
            <div style={{ overflowX: 'auto' }}>
              <table className="sp-t">
                <thead><tr><th style={{ width: 28 }} /><th>Field</th>{!isNew && <th>On the register now</th>}<th>{isNew ? 'Value' : 'From the form'}</th><th style={{ width: 110 }} /></tr></thead>
                <tbody>
                  {rows.map((r) => {
                    const on = (choices[r.key] || 'keep') !== 'keep';
                    return (
                      <tr key={r.key} className={(r.kind === 'diff' ? 'diff ' : 'fill ') + (on ? '' : 'off')}>
                        <td><input type="checkbox" checked={on} onChange={(e) => tick(r, e.target.checked)} /></td>
                        <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{r.label}</td>
                        {!isNew && <td>{spShow(r.key, r.stored)}</td>}
                        <td>
                          {editable(r)
                            ? <input className="sp-in" value={st.edits && st.edits[r.key] != null ? st.edits[r.key] : String(r.formValue == null ? r.form : r.formValue)} placeholder={r.key === 'current_department' ? 'e.g. MICU — or leave blank' : ''} onChange={(e) => edit(r.key, e.target.value)} />
                            : <span>{r.exp ? r.form : (r.list && r.added && r.stored && choices[r.key] === 'merge') ? <>adds <b>{r.added.join(', ')}</b></> : spShow(r.key, choices[r.key] === 'merge' ? r.value : r.formValue)}</span>}
                        </td>
                        <td><span className={'sp-chip ' + (r.kind === 'diff' ? 'diff' : r.kind === 'new' ? 'new' : 'fill')}>{r.kind === 'diff' ? 'Mismatch' : r.kind === 'new' ? 'New' : r.added && r.stored ? 'Adds' : 'Blank on register'}</span></td>
                      </tr>
                    );
                  })}
                  {!rows.length && <tr><td colSpan={5} className="sp-muted">Nothing to change — the register already holds everything on this form.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- the screen ---------- */
function StaffPasteView({ store, setRoute }) {
  const SI = window.UNICO_SI;
  const [text, setText] = useState('');
  const [people, setPeople] = useState(null);
  const [state, setState] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [filter, setFilter] = useState('all');
  const [openCards, setOpenCards] = useState({});
  const [dlg, setDlg] = useState(null);           // { n, mode: 'update' | 'create' }
  const [savingN, setSavingN] = useState(null);   // the form being saved on its own
  const staff = (store && store.staff) || [];

  const matches = useMemo(() => (people || []).map((p) => (SI ? SI.matchPerson(Object.assign({}, p, { fields: Object.assign({}, p.fields, (state[p.n] || {}).edits || {}) }), staff) : { candidates: [] })), [people, staff, state]);
  // "Compare with them" in the duplicate guard re-opens the pop-up in update mode.
  React.useEffect(() => {
    const h = (e) => { if (e.detail) setDlg({ n: e.detail.n, mode: e.detail.mode }); };
    window.addEventListener('sp:open', h);
    return () => window.removeEventListener('sp:open', h);
  }, []);

  if (!spIsAdmin()) return <div className="card"><div className="card-b">Paste &amp; Update is for administrators.</div></div>;
  if (!SI) return <div className="card"><div className="card-b">Loading…</div></div>;

  const read = () => {
    setErr('');
    const vocab = window.STAFF ? { extracurricular: window.STAFF.EXTRACURRICULARS, special_training: (window.STAFF.TRAININGS || []).concat(window.STAFF.PCA_TRAININGS || []), qualification: (window.STAFF.QUALIFICATIONS || []).concat(window.STAFF.PCA_QUALIFICATIONS || []) } : null;
    const ps = SI.parseText(text, { vocab });
    if (!ps.length) { setPeople([]); setErr('No form found in the text. Each form should start with "### STAFF 1" (the AI prompt) or "1. Name …".'); return; }
    const st = {}; const op = {};
    ps.forEach((p) => {
      const m = SI.matchPerson(p, staff);
      st[p.n] = { choice: m.decision === 'match' ? m.best.id : m.decision === 'new' ? 'new' : 'skip', choices: {}, edits: {}, done: null };
      op[p.n] = true;
    });
    setPeople(ps); setState(st); setOpenCards(op); setFilter('all');
  };
  const setOne = (n, patch) => setState((s) => Object.assign({}, s, { [n]: Object.assign({}, s[n], patch) }));

  const items = (people || []).map((p, i) => {
    const st = state[p.n] || {};
    const view = spPlan(p, st, staff);
    return Object.assign({ p, st, match: matches[i] || { candidates: [] } }, view, { status: spStatus(p, st, matches[i], view.rec) });
  });
  const tiles = [
    ['all', 'All forms', '#3c4858', items.length],
    ['new', 'New staff', '#0b78b3', items.filter((x) => x.status.code === 'new').length],
    ['existing', 'Existing staff', '#13803f', items.filter((x) => x.status.code === 'existing').length],
    ['check', 'Needs your check', '#c27a06', items.filter((x) => x.status.check || x.status.code === 'check').length],
    ['saved', 'Saved', '#5b6676', items.filter((x) => x.status.code === 'saved').length],
  ];
  const shown = items.filter((x) => filter === 'all' || (filter === 'check' ? (x.status.check || x.status.code === 'check') : x.status.code === filter));
  const pending = items.filter((x) => !x.st.done && x.st.choice != null && x.st.choice !== 'skip' && (x.isNew || (x.rec && x.counts.fill + x.counts.replace > 0)));
  const nNew = pending.filter((x) => x.isNew).length;
  const lookAlike = pending.filter((x) => x.isNew && (x.match.candidates || []).length);

  const markDone = (list) => setState((s) => { const o = Object.assign({}, s); list.forEach((d) => { o[d.n] = Object.assign({}, o[d.n], { done: d }); }); return o; });
  const saveOne = async (x) => {
    const done = await spSaveAll(store, [x]);
    if (!done.length) { spToast('Nothing to change for this person.', 'info'); return true; }
    markDone(done); setOpenCards((o) => Object.assign({}, o, { [x.p.n]: false }));
    spToast(done[0].name + (done[0].what === 'created' ? ' added to the register.' : ' updated.'));
    return true;
  };
  // Save ONE person straight from the card / overview row, with that card's ticks. A new person who
  // looks like existing staff goes to the pop-up's duplicate guard instead of being created blind.
  const saveCard = async (x) => {
    if (x.isNew && (x.match.candidates || []).length) { setDlg({ n: x.p.n, mode: 'create' }); spToast('This may already be on the register — compare first.', 'info'); return; }
    if (x.isNew && !String(x.pe.fields.name || '').trim()) { setErr('Form #' + x.p.n + ' has no name — type it before creating the record.'); goCard(x.p.n); return; }
    const what = x.isNew ? 'Create a new staff record for ' + (x.pe.fields.name || 'this person') + ' (' + (x.plan.rows.length - x.counts.keep) + ' fields)?'
      : 'Update ' + x.rec.name + (x.rec.emp_id ? ' (' + x.rec.emp_id + ')' : '') + '?\n\nFill ' + x.counts.fill + ' · replace ' + x.counts.replace + ' · keep ' + x.counts.keep + '.';
    if (!window.confirm(what + '\n\nThe form is kept on the record; Undo is on the card.')) return;
    setSavingN(x.p.n); setErr('');
    try { await saveOne(x); }
    catch (e) { setErr('#' + x.p.n + ' not saved: ' + ((e && e.message) || 'the save failed') + ' Reload the staff list and check the record before trying again.'); }
    finally { setSavingN(null); }
  };
  const applyAll = async () => {
    if (!pending.length) return;
    const noName = pending.find((x) => x.isNew && !String(x.pe.fields.name || '').trim());
    if (noName) { setErr('Form #' + noName.p.n + ' has no name — type it before creating the record.'); return; }
    if (!window.confirm('Save ' + pending.length + ' form' + (pending.length === 1 ? '' : 's') + '?\n\n' + (pending.length - nNew) + ' staff record(s) updated (the chosen fields only)\n' + nNew + ' new staff record(s) created\n' + (lookAlike.length ? '\n⚠ ' + lookAlike.length + ' new record(s) look like existing staff: ' + lookAlike.map((x) => '#' + x.p.n).join(', ') + ' — open Create… on them first if unsure.\n' : '') + '\nThe form and every replaced value are kept on each record; Undo is available on each card.')) return;
    setBusy(true); setErr('');
    try {
      const done = await spSaveAll(store, pending);
      markDone(done);
      setOpenCards((o) => { const n = Object.assign({}, o); done.forEach((d) => { n[d.n] = false; }); return n; });
      spToast(done.length + ' staff record' + (done.length === 1 ? '' : 's') + ' saved.');
    } catch (e) {
      setErr('Not saved: ' + ((e && e.message) || 'the save failed') + ' The changes are still waiting in this tab — keep it open, reload the staff list, and check the records before trying again.');
    } finally { setBusy(false); }
  };
  const undo = async (x) => {
    const d = x.st.done; if (!d) return;
    const now = store.get ? store.get(d.id) : staff.find((r) => r.id === d.id);
    try {
      if (d.what === 'created') {
        const same = now && Object.keys(d.written).every((k) => JSON.stringify(now[k]) === JSON.stringify(d.written[k]));
        if (!now) { setOne(x.p.n, { done: null }); return; }
        if (!same) { window.alert(d.name + ' has been edited since it was created here, so it is not removed. Archive it from the profile if it should go.'); return; }
        if (!window.confirm('Undo: remove the record just created for ' + d.name + '? Nothing else on the register is touched.')) return;
        store.destroy(d.id);
      } else {
        const u = SI.buildUndo(now, d);
        if (!Object.keys(u.patch).length) { window.alert('Nothing to put back — every field was changed again since.'); return; }
        if (!window.confirm('Undo the update of ' + d.name + '? ' + Object.keys(u.patch).filter((k) => k.indexOf('import_') !== 0).length + ' field(s) go back to what they were' + (u.skipped.length ? '; ' + u.skipped.join(', ') + ' changed since and stay as they are' : '') + '.')) return;
        store.update(d.id, u.patch);
      }
      const res = window.unicoFlushNow ? await window.unicoFlushNow() : { ok: false };
      if (!res || res.ok !== true) throw new Error((res && res.error) || 'The database did not confirm the undo.');
      setOne(x.p.n, { done: null }); setOpenCards((o) => Object.assign({}, o, { [x.p.n]: true }));
      spToast('Undone: ' + d.name + '.');
    } catch (e) { setErr('Undo failed: ' + ((e && e.message) || 'not saved') + ' Reload the staff list and check ' + d.name + '.'); }
  };
  const goCard = (n) => { setOpenCards((o) => Object.assign({}, o, { [n]: true })); setTimeout(() => { const el = document.getElementById('sp-card-' + n); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30); };
  const exportCsv = () => {
    const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const head = ['Form #', 'Name on form', 'Form number', 'Status', 'Matched to', 'Employee ID', 'Why', 'To fill', 'Mismatch', 'To replace', 'Warnings'];
    const lines = [head.map(esc).join(',')].concat(items.map((x) => [x.p.n, x.p.fields.name, x.p.fields.form_no, x.status.label, x.rec ? x.rec.name : '', x.rec ? x.rec.emp_id : '', x.status.reason, x.counts.fill, x.counts.differ, x.counts.replace, x.p.warnings.join(' | ')].map(esc).join(',')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'Staff-forms-summary-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const copyPrompt = () => {
    const ok = () => spToast('Prompt copied — paste it into ChatGPT or Gemini with the form photos.');
    try { navigator.clipboard.writeText(SI.AI_PROMPT).then(ok, () => { setShowPrompt(true); spToast('Select the prompt below and copy it.', 'info'); }); }
    catch (e) { setShowPrompt(true); }
  };
  const dx = dlg ? items.find((x) => x.p.n === dlg.n) : null;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <style>{SP_CSS}</style>
      <div className="card">
        <div className="card-h" style={{ flexWrap: 'wrap', gap: 10 }}>
          <Ic d={I.edit || I.doc} s={16} c="var(--blue)" />
          <div><h3>Paste &amp; Update</h3><div className="sub">Paste registration-form text; each person is matched to the staff register. See at a glance who is new and who already exists, compare side by side, and save one person or all of them. Nothing is saved until you press Save / Create.</div></div>
        </div>
        <div className="card-b" style={{ display: 'grid', gap: 18 }}>
          <div>
            <div className="sp-step"><i>1</i>Get the text from an AI (optional)</div>
            <ol className="sp-muted" style={{ margin: '0 0 8px', paddingLeft: 20, lineHeight: 1.7 }}>
              <li>Photograph or scan the filled forms (both pages).</li>
              <li>Open ChatGPT or Gemini, attach the photos and paste this prompt.</li>
              <li>Copy its whole answer and paste it in step 2. Text in other layouts ("1. Name … Phone: …") is read too.</li>
            </ol>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn pri sm" onClick={copyPrompt}>Copy the AI prompt</button>
              <button className="btn sm" onClick={() => setShowPrompt((v) => !v)}>{showPrompt ? 'Hide' : 'Show'} the prompt</button>
            </div>
            {showPrompt && <pre className="sp-prompt" style={{ marginTop: 8 }}>{SI.AI_PROMPT}</pre>}
          </div>

          <div>
            <div className="sp-step"><i>2</i>Paste the form text</div>
            <textarea className="sp-text" value={text} onChange={(e) => setText(e.target.value)} placeholder={'### STAFF 1\nName: …\nRole: Nurse\nPhone: 017…\n…'} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn pri sm" disabled={!text.trim()} onClick={read}>Read and match</button>
              {(text || people) && <button className="btn sm" onClick={() => { if (items.some((x) => x.st.done) && !window.confirm('Clear the list? Saved records stay saved, but their Undo buttons go.')) return; setText(''); setPeople(null); setState({}); setErr(''); }}>Clear</button>}
              {people && <span className="sp-muted">{people.length} form{people.length === 1 ? '' : 's'} read.</span>}
            </div>
          </div>

          {err && <div className="sp-err">{err}</div>}

          {people && people.length > 0 && (
            <div>
              <div className="sp-step"><i>3</i>Who is new, who already exists</div>
              <div className="sp-tiles">
                {tiles.map(([id, label, c, n]) => <button key={id} type="button" className={'sp-tile' + (filter === id ? ' on' : '')} style={{ '--c': c }} onClick={() => setFilter(id)}><b>{n}</b><span>{label}</span></button>)}
              </div>
              <div style={{ overflowX: 'auto', border: '1px solid var(--line-2)', borderRadius: 10, marginBottom: 10 }}>
                <table className="sp-t">
                  <thead><tr><th>#</th><th>Name on the form</th><th>Status</th><th>Matched to / why</th><th>Changes</th><th>Warnings</th><th>Action</th></tr></thead>
                  <tbody>
                    {shown.map((x) => (
                      <tr key={x.p.n} className="click" onClick={() => goCard(x.p.n)}>
                        <td style={{ fontFamily: 'var(--mono)' }}>{x.p.n}</td>
                        <td style={{ fontWeight: 700, color: 'var(--ink)' }}>{(x.st.edits && x.st.edits.name) || x.p.fields.name}<div className="sp-muted">{[x.p.fields.designation || x.p.fields.role, x.p.fields.phone].filter(Boolean).join(' · ')}</div></td>
                        <td><span className="sp-badge" style={{ '--c': x.status.c, fontSize: 10.5 }}>{x.status.code === 'existing' ? 'EXISTING' : x.status.label}</span>{x.status.check && <div><span className="sp-chip check" style={{ marginTop: 4 }}>Needs check</span></div>}</td>
                        <td style={{ maxWidth: 330 }}>{x.rec ? <b>{x.rec.name}{x.rec.emp_id ? ' · ' + x.rec.emp_id : ''}</b> : null}<div className="sp-muted">{x.status.reason}</div></td>
                        <td style={{ whiteSpace: 'nowrap' }}>{x.st.done ? x.st.done.count + ' saved' : x.isNew ? (x.plan.rows.length - x.counts.keep) + ' fields' : x.rec ? <span>{x.counts.fill} fill<br />{x.counts.differ} mismatch</span> : '—'}</td>
                        <td style={{ color: x.p.warnings.length ? '#9a5a06' : 'var(--muted)', fontWeight: 700 }}>{x.p.warnings.length || '—'}</td>
                        <td style={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                          {x.st.done
                            ? <React.Fragment><button className="btn sm" onClick={() => setRoute({ view: 'staffProfile', emp: x.st.done.id })}>Profile</button> <button className="btn sm" onClick={() => undo(x)}>Undo</button></React.Fragment>
                            : <React.Fragment>
                                {x.st.choice !== 'skip' && (x.isNew || (x.rec && x.counts.fill + x.counts.replace > 0)) && <React.Fragment><button className="btn pri sm" disabled={savingN === x.p.n} onClick={() => saveCard(x)} title="Save only this person now">{savingN === x.p.n ? 'Saving…' : 'Save'}</button>{' '}</React.Fragment>}
                                {x.status.code === 'new'
                                  ? <button className="btn sm" onClick={() => setDlg({ n: x.p.n, mode: 'create' })}>Create…</button>
                                  : <button className="btn sm" onClick={() => setDlg({ n: x.p.n, mode: 'update' })}>Update…</button>}
                                {' '}
                                {x.status.code === 'new'
                                  ? <button className="btn sm" onClick={() => setDlg({ n: x.p.n, mode: 'update' })}>Find existing…</button>
                                  : <button className="btn sm" onClick={() => setDlg({ n: x.p.n, mode: 'create' })}>Create new…</button>}
                              </React.Fragment>}
                        </td>
                      </tr>
                    ))}
                    {!shown.length && <tr><td colSpan={7} className="sp-muted">Nothing in this group.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                <button className="btn sm" onClick={exportCsv}>Download summary (Excel / CSV)</button>
                <button className="btn sm" onClick={() => { const o = {}; items.forEach((x) => { o[x.p.n] = true; }); setOpenCards(o); }}>Expand all</button>
                <button className="btn sm" onClick={() => setOpenCards({})}>Collapse all</button>
              </div>

              <div className="sp-step"><i>4</i>Check each person</div>
              <div className="sp-muted" style={{ marginBottom: 10 }}>Each person is saved on their own: set the ticks on their card and press <b>Save this person</b> (or <b>Create this person</b>). Blanks on the register start ticked; a mismatch starts unticked. <b>Update existing…</b> / <b>Create new…</b> open the side-by-side compare with more choices.</div>
              {shown.map((x) => <SpPerson key={x.p.n} p={x.p} st={x.st} set={(patch) => setOne(x.p.n, patch)} staff={staff} match={x.match} status={x.status} open={!!openCards[x.p.n]} onToggle={() => setOpenCards((o) => Object.assign({}, o, { [x.p.n]: !o[x.p.n] }))} onOpen={(mode) => setDlg({ n: x.p.n, mode })} onUndo={() => undo(x)} onSaveOne={() => saveCard(x)} saving={savingN === x.p.n} setRoute={setRoute} />)}

              <div className="sp-step" style={{ marginTop: 6 }}><i>5</i>Or save all the rest together (optional)</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn pri" disabled={busy || !pending.length} onClick={applyAll}>{busy ? 'Saving…' : 'Save ' + pending.length + ' form' + (pending.length === 1 ? '' : 's')}</button>
                <span className="sp-muted">{pending.length - nNew} update{pending.length - nNew === 1 ? '' : 's'} · {nNew} new · {items.filter((x) => x.st.done).length} already saved · {items.length - pending.length - items.filter((x) => x.st.done).length} skipped or nothing to change</span>
              </div>
            </div>
          )}
        </div>
      </div>
      {dx && <SpCompareDialog p={dx.p} st={dx.st} set={(patch) => setOne(dx.p.n, patch)} staff={staff} match={dx.match} mode={dlg.mode}
        onClose={() => setDlg(null)} onSave={saveOne} setRoute={setRoute} />}
    </div>
  );
}

Object.assign(window, { StaffPasteView });
