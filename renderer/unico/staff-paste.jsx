/* UNICO — Staff Management → Paste & Update (administrators only).

   Paste the text of staff registration forms (typed out by ChatGPT / Gemini from the form photos, or
   any "Label: value" text); each person is matched to the staff register and the screen shows, field
   by field, what would be filled in. The rule is window.UNICO_SI (staff-import-core.js):
     - a blank field on the record is filled (ticked; untick to leave it),
     - a field that already holds something different is only listed (unticked; tick to replace),
     - a person not on the register becomes a new record (every field shown),
     - nothing is written until "Apply"; the write is the normal staff save (store.update / create +
       unicoFlushNow), so conflicts, permissions and the activity log are the same as the staff form.
   Every applied form is kept on the record (import_source + import_source_history: what was filled,
   what was replaced and its old value, what was left, the warnings). */

const { useState, useMemo } = React;
const Ic = window.Ic, I = window.I;
const spIsAdmin = () => { const u = window.__UNICO_USER__; return !u || u.role === 'Administrator'; };
const spToast = (m, t) => { try { window.UI && window.UI.toast && window.UI.toast(m, t || 'success'); } catch (e) {} };
const spDate = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? String(iso).split('-').reverse().join('/') : String(iso || ''));
const SP_DATE_KEYS = ['dob', 'doj', 'licence_expiry'];
const spShow = (k, v) => (v == null || v === '' ? '—' : SP_DATE_KEYS.indexOf(k) >= 0 ? spDate(v) : String(v));

const SP_CSS = `
.sp-step{display:flex;align-items:center;gap:9px;font-size:13px;font-weight:800;color:var(--ink);margin-bottom:8px}
.sp-step i{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:var(--blue);color:#fff;font-style:normal;font-size:11.5px}
.sp-prompt{white-space:pre-wrap;font-family:var(--mono);font-size:11.5px;line-height:1.5;background:var(--panel-2);border:1px solid var(--line);border-radius:9px;padding:10px 12px;max-height:240px;overflow:auto;margin:0}
.sp-text{width:100%;box-sizing:border-box;min-height:190px;font:inherit;font-size:12.5px;line-height:1.5;border:1px solid var(--line);border-radius:9px;padding:10px 12px;background:var(--panel);color:var(--ink);resize:vertical}
.sp-card{border:1px solid var(--line);border-radius:12px;background:var(--panel);margin-bottom:12px;overflow:hidden}
.sp-card-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:11px 14px;border-bottom:1px solid var(--line-2);background:var(--panel-2)}
.sp-card-b{padding:11px 14px}
.sp-t{width:100%;border-collapse:collapse;font-size:12.5px}
.sp-t th{text-align:left;padding:7px 8px;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);font-weight:700;border-bottom:1px solid var(--line)}
.sp-t td{padding:6px 8px;border-bottom:1px solid var(--line-2);vertical-align:top;color:var(--ink-2)}
.sp-t tr.diff td{background:rgba(224,138,30,.06)}
.sp-t tr.off td{opacity:.55}
.sp-in{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:7px;padding:5px 8px;font:inherit;font-size:12.5px;background:var(--panel);color:var(--ink)}
.sp-tag{display:inline-block;font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:999px;white-space:nowrap}
.sp-tag.fill{background:#eaf7ef;color:#13703d}.sp-tag.diff{background:#fff5e6;color:#9a5a06}.sp-tag.new{background:#e8f3fb;color:#0b5f8a}
.sp-warn{background:#fff5e6;border:1px solid #f6dcb0;color:#7a4705;border-radius:9px;padding:8px 11px;font-size:12px;margin-bottom:10px}
.sp-warn li{margin:2px 0}
.sp-ok{background:#eaf7ef;border:1px solid #c4e6d1;color:#13703d;border-radius:9px;padding:10px 12px;font-size:12.5px;margin-bottom:12px}
.sp-err{background:#fdf0f2;border:1px solid #f2c4cd;color:#8f1d30;border-radius:9px;padding:10px 12px;font-size:12.5px;margin-bottom:12px}
.sp-muted{color:var(--muted);font-size:12px}
`;

// The plan for one person as the administrator has set it (choice + edits + ticks).
function spPlan(p, st, staff) {
  const fields = Object.assign({}, p.fields, st.edits || {});
  // A date typed in as on the form (10/11/2026) is stored the register's way (2026-11-10).
  SP_DATE_KEYS.forEach((k) => { if (st.edits && st.edits[k]) { const d = window.UNICO_SI.parseDate(st.edits[k]); if (d) fields[k] = d.iso; } });
  const pe = Object.assign({}, p, { fields });
  const rec = st.choice !== 'new' && st.choice !== 'skip' ? (staff || []).find((r) => String(r.id) === String(st.choice)) || null : null;
  const plan = window.UNICO_SI.planUpdate(pe, rec);
  if (st.choice === 'new' && !plan.rows.some((r) => r.key === 'current_department')) {
    plan.rows.splice(3, 0, { key: 'current_department', label: 'Department', kind: 'new', stored: '', form: '', value: '' });
  }
  const ticked = plan.rows.filter((r) => r.kind !== 'same' && (r.kind === 'diff' ? (st.on || []).indexOf(r.key) >= 0 : (st.off || []).indexOf(r.key) < 0)).map((r) => r.key);
  return { pe, rec, plan, ticked };
}

function SpPerson({ p, st, set, staff, match, setRoute }) {
  const SI = window.UNICO_SI;
  const { rec, plan, ticked } = spPlan(p, st, staff);
  const rows = plan.rows.filter((r) => r.kind !== 'same');
  const sameN = plan.rows.length - rows.length;
  const tick = (r, v) => {
    if (r.kind === 'diff') set({ on: v ? (st.on || []).concat([r.key]) : (st.on || []).filter((k) => k !== r.key) });
    else set({ off: v ? (st.off || []).filter((k) => k !== r.key) : (st.off || []).concat([r.key]) });
  };
  const edit = (k, v) => set({ edits: Object.assign({}, st.edits || {}, { [k]: v }) });
  const editable = (r) => r.key !== 'prior_experience_entries' && ['special_training', 'extracurricular', 'languages'].indexOf(r.key) < 0;
  const f = p.fields;
  const choiceLabel = st.choice === 'skip' ? 'Skipped — nothing is written for this form'
    : st.choice === 'new' ? 'A NEW staff record will be created'
    : rec ? 'Updates ' + rec.name + (rec.emp_id ? ' (ID ' + rec.emp_id + ')' : '') + (rec.current_department ? ' · ' + rec.current_department : '') : 'Pick who this is';
  const cand = (match.candidates || []).find((c) => String(c.id) === String(st.choice));
  return (
    <div className="sp-card">
      <div className="sp-card-h">
        <b style={{ fontSize: 13.5, color: 'var(--ink)' }}>#{p.n} · {(st.edits && st.edits.name) || f.name || 'No name'}</b>
        <span className="sp-muted">{[f.role, f.designation, f.form_no].filter(Boolean).join(' · ')}</span>
        <span style={{ flex: 1 }} />
        <select className="sp-in" style={{ width: 'auto', maxWidth: 380 }} value={String(st.choice)} onChange={(e) => set({ choice: e.target.value, on: [], off: [] })}>
          {(match.candidates || []).map((c) => <option key={c.id} value={String(c.id)}>{(c.strong ? '✓ ' : '? ') + c.name + (c.emp_id ? ' · ' + c.emp_id : '') + ' — ' + c.why.slice(0, 2).join(', ')}</option>)}
          <option value="new">+ Create a new staff record</option>
          <option value="skip">Skip this form</option>
          {st.choice !== 'new' && st.choice !== 'skip' && !(match.candidates || []).some((c) => String(c.id) === String(st.choice)) && <option value={String(st.choice)}>{rec ? rec.name : 'Record #' + st.choice}</option>}
        </select>
      </div>
      <div className="sp-card-b">
        <div style={{ fontSize: 12.5, fontWeight: 700, color: st.choice === 'new' ? '#0b5f8a' : st.choice === 'skip' ? 'var(--muted)' : '#13703d', marginBottom: 6 }}>
          {choiceLabel}
          {rec && <button className="btn sm" style={{ marginLeft: 8 }} onClick={() => setRoute({ view: 'staffProfile', emp: rec.id })}>Open profile</button>}
        </div>
        {cand && <div className="sp-muted" style={{ marginBottom: 8 }}>Why: {cand.why.join('; ')}.</div>}
        {match.decision === 'choose' && st.choice === 'skip' && <div className="sp-warn">Not sure who this is: {(match.candidates || []).length ? 'possible matches are in the list above — pick one, or create a new record.' : 'no one on the register matches.'}</div>}
        {match.decision === 'new' && st.choice === 'new' && <div className="sp-muted" style={{ marginBottom: 8 }}>No one on the register has this phone, NID, or this name with the same joining / birth date.</div>}
        {p.warnings.length > 0 && <ul className="sp-warn" style={{ paddingLeft: 26 }}>{p.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
        {st.choice !== 'skip' && (
          <div style={{ overflowX: 'auto' }}>
            <table className="sp-t">
              <thead><tr><th style={{ width: 28 }} /><th>Field</th>{st.choice !== 'new' && <th>On the register now</th>}<th>{st.choice === 'new' ? 'Value' : 'From the form'}</th><th style={{ width: 80 }} /></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const on = ticked.indexOf(r.key) >= 0;
                  const isExp = r.key === 'prior_experience_entries';
                  return (
                    <tr key={r.key} className={(r.kind === 'diff' ? 'diff ' : '') + (on ? '' : 'off')}>
                      <td><input type="checkbox" checked={on} onChange={(e) => tick(r, e.target.checked)} /></td>
                      <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{r.label}</td>
                      {st.choice !== 'new' && <td>{isExp ? (r.stored || '—') : spShow(r.key, r.stored)}</td>}
                      <td>
                        {isExp ? <span>{r.form}</span>
                          : editable(r) ? <input className="sp-in" value={st.edits && st.edits[r.key] != null ? st.edits[r.key] : (r.kind === 'new' || r.kind === 'diff' || !r.stored ? String(r.form || '') : String(r.value || ''))}
                            placeholder={r.key === 'current_department' ? 'e.g. MICU — or leave blank' : SP_DATE_KEYS.indexOf(r.key) >= 0 ? 'YYYY-MM-DD' : ''}
                            onChange={(e) => edit(r.key, e.target.value)} />
                          : <span>{r.added && r.stored ? <>adds <b>{r.added.join(', ')}</b></> : r.value}</span>}
                      </td>
                      <td><span className={'sp-tag ' + (r.kind === 'diff' ? 'diff' : r.kind === 'new' ? 'new' : 'fill')}>{r.kind === 'diff' ? 'Different' : r.kind === 'new' ? 'New' : r.added && r.stored ? 'Adds' : 'Fills blank'}</span></td>
                    </tr>
                  );
                })}
                {!rows.length && <tr><td colSpan={5} className="sp-muted">Nothing to change — the register already holds everything on this form.</td></tr>}
              </tbody>
            </table>
            {sameN > 0 && <div className="sp-muted" style={{ marginTop: 6 }}>{sameN} field{sameN === 1 ? '' : 's'} already the same on the register.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function StaffPasteView({ store, setRoute }) {
  const SI = window.UNICO_SI;
  const [text, setText] = useState('');
  const [people, setPeople] = useState(null);
  const [state, setState] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [err, setErr] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const staff = (store && store.staff) || [];

  const matches = useMemo(() => (people || []).map((p) => SI.matchPerson(Object.assign({}, p, { fields: Object.assign({}, p.fields, (state[p.n] || {}).edits || {}) }), staff)), [people, staff, state]);

  if (!spIsAdmin()) {
    return <div className="card"><div className="card-b">Paste &amp; Update is for administrators.</div></div>;
  }
  if (!SI) return <div className="card"><div className="card-b">Loading…</div></div>;

  const read = () => {
    setErr(''); setDone(null);
    const vocab = window.STAFF ? { extracurricular: window.STAFF.EXTRACURRICULARS, special_training: (window.STAFF.TRAININGS || []).concat(window.STAFF.PCA_TRAININGS || []), qualification: (window.STAFF.QUALIFICATIONS || []).concat(window.STAFF.PCA_QUALIFICATIONS || []) } : null;
    const ps = SI.parseText(text, { vocab });
    if (!ps.length) { setPeople([]); setErr('No form found in the text. Each form should start with "### STAFF 1" (the AI prompt below) or "1. Name …".'); return; }
    const st = {};
    ps.forEach((p) => {
      const m = SI.matchPerson(p, staff);
      st[p.n] = { choice: m.decision === 'match' ? m.best.id : m.decision === 'new' ? 'new' : 'skip', on: [], off: [], edits: {} };
    });
    setPeople(ps); setState(st);
  };
  const setOne = (n, patch) => setState((s) => Object.assign({}, s, { [n]: Object.assign({}, s[n], patch) }));

  const plans = (people || []).map((p) => ({ p, st: state[p.n] || {}, ...spPlan(p, state[p.n] || { choice: 'skip' }, staff) }));
  const toApply = plans.filter((x) => x.st.choice && x.st.choice !== 'skip' && (x.st.choice === 'new' || x.ticked.length));
  const counts = { upd: toApply.filter((x) => x.st.choice !== 'new').length, add: toApply.filter((x) => x.st.choice === 'new').length };

  const apply = async () => {
    if (!toApply.length) return;
    const noName = toApply.find((x) => x.st.choice === 'new' && !String(x.pe.fields.name || '').trim());
    if (noName) { setErr('Form #' + noName.p.n + ' has no name — type it before creating the record.'); return; }
    if (!window.confirm('Apply ' + toApply.length + ' form' + (toApply.length === 1 ? '' : 's') + '?\n\n' + (counts.upd ? counts.upd + ' staff record' + (counts.upd === 1 ? '' : 's') + ' updated (ticked fields only)\n' : '') + (counts.add ? counts.add + ' new staff record' + (counts.add === 1 ? '' : 's') + ' created\n' : '') + '\nThe form and every replaced value are kept on each record.')) return;
    setBusy(true); setErr('');
    const me = window.__UNICO_USER__ || {};
    const meta = { at: new Date().toISOString(), by: me.name || me.username || 'Administrator' };
    const out = [];
    try {
      for (const x of toApply) {
        if (x.st.choice === 'new') {
          const rec = SI.newRecord(x.pe, x.plan, x.ticked, meta);
          if (!rec.current_department) rec.current_department = 'Unassigned';
          const id = store.create(rec);
          out.push({ n: x.p.n, id, name: rec.name, what: 'created', count: x.ticked.length });
        } else {
          const b = SI.buildPatch(x.pe, x.rec, x.plan, x.ticked, meta);
          if (!b.changed) continue;
          store.update(x.rec.id, b.patch);
          out.push({ n: x.p.n, id: x.rec.id, name: x.rec.name, what: 'updated', count: b.filled.length + Object.keys(b.replaced).length, replaced: Object.keys(b.replaced).length });
        }
      }
      if (!window.unicoFlushNow) throw new Error('Saving is unavailable in this tab — reload the page.');
      const res = await window.unicoFlushNow();
      if (!res || res.ok !== true) throw new Error((res && res.error) || 'The database did not confirm the save.');
      setDone(out); setPeople(null); setState({}); setText('');
      spToast(out.length + ' staff record' + (out.length === 1 ? '' : 's') + ' saved.');
    } catch (e) {
      setErr('Not saved: ' + ((e && e.message) || 'the save failed') + ' The changes are still waiting in this tab — keep it open, reload the staff list, and check the records before trying again.');
    } finally { setBusy(false); }
  };

  const copyPrompt = () => {
    const ok = () => spToast('Prompt copied — paste it into ChatGPT or Gemini with the form photos.');
    try { navigator.clipboard.writeText(SI.AI_PROMPT).then(ok, () => { setShowPrompt(true); spToast('Select the prompt below and copy it.', 'info'); }); }
    catch (e) { setShowPrompt(true); }
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <style>{SP_CSS}</style>
      <div className="card">
        <div className="card-h" style={{ flexWrap: 'wrap', gap: 10 }}>
          <Ic d={I.edit || I.doc} s={16} c="var(--blue)" />
          <div><h3>Paste &amp; Update</h3><div className="sub">Paste registration-form text; each person is matched to the staff register. Blank fields are filled, anything different is only listed until you tick it, and nothing is saved until Apply.</div></div>
        </div>
        <div className="card-b" style={{ display: 'grid', gap: 18 }}>
          {done && (
            <div className="sp-ok">
              <b>Saved.</b> {done.length} record{done.length === 1 ? '' : 's'}:
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
                {done.map((d) => <button key={d.n} className="btn sm" onClick={() => setRoute({ view: 'staffProfile', emp: d.id })}>{d.what === 'created' ? 'New: ' : 'Updated: '}{d.name}{d.what === 'updated' ? ' · ' + d.count + ' field' + (d.count === 1 ? '' : 's') : ''}</button>)}
              </div>
            </div>
          )}

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
              {(text || people) && <button className="btn sm" onClick={() => { setText(''); setPeople(null); setState({}); setErr(''); }}>Clear</button>}
              {people && <span className="sp-muted">{people.length} form{people.length === 1 ? '' : 's'} read.</span>}
            </div>
          </div>

          {err && <div className="sp-err">{err}</div>}

          {people && people.length > 0 && (
            <div>
              <div className="sp-step"><i>3</i>Check each person</div>
              <div className="sp-muted" style={{ marginBottom: 10 }}>Ticked rows are written. "Fills blank" rows start ticked; "Different" rows start unticked — tick one only when the form is right and the register is wrong. You can correct any value before applying.</div>
              {people.map((p, i) => <SpPerson key={p.n} p={p} st={state[p.n] || {}} set={(patch) => setOne(p.n, patch)} staff={staff} match={matches[i] || { candidates: [] }} setRoute={setRoute} />)}
              <div className="sp-step" style={{ marginTop: 6 }}><i>4</i>Apply</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn pri" disabled={busy || !toApply.length} onClick={apply}>{busy ? 'Saving…' : 'Apply ' + toApply.length + ' form' + (toApply.length === 1 ? '' : 's')}</button>
                <span className="sp-muted">{counts.upd} update{counts.upd === 1 ? '' : 's'} · {counts.add} new · {plans.length - toApply.length} skipped or nothing to change</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { StaffPasteView });
