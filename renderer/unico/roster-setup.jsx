/* UNICO — Duty roster setup (renderer). Administrators only.
 *
 * Who sits where in the review chain, set ONCE instead of being picked on every sheet:
 *   · one CNS for the whole hospital (approves every unit),
 *   · per department, the In-charge (prepares the sheet) and the Manager (checks it).
 * The names then fill Prepared / Checked / Approved on every roster, and decide whose
 * review inbox a sent sheet lands in.
 *
 * People are picked from USER ACCOUNTS that hold a Duty roster role (Users & Roles →
 * Manage → Duty roster role), because a Manager or the CNS must be able to sign in and
 * act on what is sent to them. Departments are the canonical ones (deptmap), so a unit
 * keeps its people when its name is spelled differently on a staff record.
 *
 *   GET /api/rosters/config     { cns, depts:[{ id, name, incharge, manager }] }
 *   GET /api/rosters/reviewers  accounts with a roster role (names, roles, units)
 *   PUT /api/rosters/config     admin; the whole mapping at once
 *
 * Published as window.RosterSetup.
 */

const { useState, useEffect, useMemo } = React;
const Ic = window.Ic, I = window.I;
const MK = window.MK;

const RS_ROLE_LABEL = { incharge: 'In-charge', manager: 'Manager', cns: 'CNS' };

function RosterSetup() {
  const K = window.UNICO_ROSTER_KIT;
  const scope = K.useRosterScope();
  const [cfg, setCfg] = useState(null);          // as loaded
  const [people, setPeople] = useState([]);
  const [draft, setDraft] = useState(null);      // { cns, depts:{ id:{ incharge, manager } } } — usernames
  const [q, setQ] = useState('');
  const [onlyUnset, setOnlyUnset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const fromCfg = (c) => {
    const d = {};
    (c.depts || []).forEach((x) => { d[x.id] = { incharge: (x.incharge && x.incharge.username) || '', manager: (x.manager && x.manager.username) || '' }; });
    return { cns: (c.cns && c.cns.username) || '', depts: d };
  };
  const load = () => Promise.all([K.api.get('/api/rosters/config'), K.api.get('/api/rosters/reviewers')]).then(([c, p]) => {
    if (!c || !c.ok) { setErr((c && c.error) || 'Could not load the setup.'); return; }
    setCfg(c); setDraft(fromCfg(c)); setErr('');
    setPeople((p && p.ok && (p.reviewers || p.users || p.people)) || []);
  }).catch(() => setErr('Could not reach the server.'));
  useEffect(() => { load(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const may = scope.can || {};
  const dirty = useMemo(() => !!(cfg && draft && JSON.stringify(fromCfg(cfg)) !== JSON.stringify(draft)), [cfg, draft]);   // eslint-disable-line react-hooks/exhaustive-deps
  const depts = (cfg && cfg.depts) || [];
  const unsetN = depts.filter((x) => draft && (!draft.depts[x.id] || !draft.depts[x.id].incharge || !draft.depts[x.id].manager)).length + (draft && !draft.cns ? 1 : 0);

  // Leaving with unsaved picks asks first.
  useEffect(() => {
    const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (!scope.loading && !may.setup) {
    return (
      <div className="card"><div className="card-b" style={{ display: 'grid', placeItems: 'center', padding: 44, textAlign: 'center', gap: 8 }}>
        <div style={{ opacity: .35 }}><Ic d={I.lock || I.grid} s={32} /></div>
        <div style={{ fontWeight: 700, fontSize: 14.5 }}>Administrators only</div>
        <div className="sub" style={{ maxWidth: 420 }}>Roster setup decides who prepares, checks and approves every unit's roster.</div>
      </div></div>
    );
  }
  if (err) return <div className="card"><div className="card-b" style={{ color: '#b4232f', padding: 24 }}>{err} <button className="btn sm" onClick={load}>Try again</button></div></div>;
  if (!cfg || !draft) return <div className="sub" style={{ padding: 30, textAlign: 'center' }}>Loading…</div>;

  // Pickers list people with the matching roster role; someone already picked stays in
  // the list even if their role was changed since, so a saved slot never shows blank.
  const byUser = {};
  people.forEach((u) => { byUser[u.username] = u; });
  const optionsFor = (role, deptId, current) => {
    // Administrators may hold any slot; they are listed after the people with the role.
    const list = people.filter((u) => u.rosterRole === role || u.rosterRole === 'admin');
    const covers = (u) => (u.rosterDepartments || []).indexOf(deptId) >= 0;
    const sorted = list.slice().sort((a, b) => ((a.rosterRole === 'admin') - (b.rosterRole === 'admin')) || (covers(b) - covers(a)) || String(a.name).localeCompare(String(b.name)));
    if (current && !sorted.some((u) => u.username === current)) sorted.unshift(byUser[current] || { username: current, name: current + ' (no roster role)' });
    return sorted;
  };
  const setSlot = (id, slot, v) => setDraft((d) => ({ ...d, depts: { ...d.depts, [id]: { ...(d.depts[id] || {}), [slot]: v } } }));
  const save = () => {
    setBusy(true);
    const body = { cns: draft.cns ? { username: draft.cns } : null, depts: {} };
    Object.keys(draft.depts).forEach((id) => {
      const x = draft.depts[id];
      body.depts[id] = { incharge: x.incharge ? { username: x.incharge } : null, manager: x.manager ? { username: x.manager } : null };
    });
    K.api.put('/api/rosters/config', body).then((r) => {
      setBusy(false);
      if (r && r.ok) {
        K.toast('Roster setup saved.');
        if (r.depts) { setCfg(r); setDraft(fromCfg(r)); } else load();
        K.loadConfig(true);
        try { window.dispatchEvent(new Event('unico:ros-refresh')); } catch (e) { /* old browser */ }
      } else K.toast((r && r.error) || 'Could not save the setup.', 'error');
    }).catch(() => { setBusy(false); K.toast('Could not reach the server.', 'error'); });
  };

  const needle = q.trim().toLowerCase();
  const shown = depts.filter((x) => {
    const s = draft.depts[x.id] || {};
    if (onlyUnset && s.incharge && s.manager) return false;
    return !needle || String(x.name).toLowerCase().indexOf(needle) >= 0;
  });
  const sel = (value, onChange, opts, missing) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      style={{ width: '100%', boxSizing: 'border-box', padding: '7px 9px', borderRadius: 8, border: '1px solid ' + (missing ? 'rgba(224,138,30,.55)' : 'rgba(125,145,180,.35)'), background: missing ? 'rgba(224,138,30,.06)' : '#fff', fontFamily: 'inherit', fontSize: 12, color: value ? '#16202e' : '#9aa6b4' }}>
      <option value="">— not set —</option>
      {opts.map((u) => <option key={u.username} value={u.username}>{u.name}{u.rosterRole === 'admin' ? ' · Administrator' : u.title ? ' · ' + u.title : ''}</option>)}
    </select>
  );
  const nRole = (r) => people.filter((u) => u.rosterRole === r).length;

  return (
    <div className="mk-scope" style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: dirty ? 70 : 0 }}>
      <div className="card">
        <div className="card-h" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={MK.iconBadge('teal', 32)}><Ic d={I.users || I.grid} s={16} /></div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontWeight: 700, fontSize: 15.5, color: '#16202e' }}>Roster setup — who prepares, checks and approves</div>
            <div className="sub">Set once. The names fill every roster's sign-off and decide whose inbox a sent roster lands in.</div>
          </div>
          {unsetN > 0 && <span style={{ fontSize: 11.5, fontWeight: 700, color: '#b5670a', background: 'rgba(224,138,30,.13)', padding: '5px 11px', borderRadius: 14 }}>{unsetN} slot{unsetN === 1 ? '' : 's'} not set</span>}
        </div>
        <div className="card-b" style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,360px) 1fr', gap: 16, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: .6, textTransform: 'uppercase', color: '#7d8ea8', marginBottom: 4 }}>Chief of Nursing Services · approves every unit</div>
            {sel(draft.cns, (v) => setDraft((d) => ({ ...d, cns: v })), optionsFor('cns', null, draft.cns), !draft.cns)}
          </div>
          <div className="sub" style={{ fontSize: 11.5, lineHeight: 1.6 }}>
            Accounts with a roster role: <b>{nRole('cns')}</b> CNS · <b>{nRole('manager')}</b> Manager · <b>{nRole('incharge')}</b> In-charge.
            Someone missing from a list? Give their account a <b>Duty roster role</b> under Users &amp; Roles → Manage. People whose roster units include a department are listed first for it.
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-h" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>Departments</h3>
          <span className="sub">{depts.length} departments</span>
          <div style={{ flex: 1 }} />
          <label className="sub" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={onlyUnset} onChange={(e) => setOnlyUnset(e.target.checked)} />Only incomplete
          </label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a department…" style={{ minWidth: 190, padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(125,145,180,.35)', fontFamily: 'inherit', fontSize: 12 }} />
        </div>
        <div className="card-b" style={{ overflow: 'auto', padding: 0 }}>
          <table className="tbl" style={{ width: '100%' }}>
            <thead><tr><th style={{ width: '30%' }}>Department</th><th>In-charge <span className="sub" style={{ fontWeight: 500 }}>· prepares</span></th><th>Manager <span className="sub" style={{ fontWeight: 500 }}>· checks</span></th></tr></thead>
            <tbody>
              {shown.map((x) => {
                const s = draft.depts[x.id] || { incharge: '', manager: '' };
                return (
                  <tr key={x.id}>
                    <td style={{ fontWeight: 600 }}>{x.name}</td>
                    <td style={{ minWidth: 200 }}>{sel(s.incharge, (v) => setSlot(x.id, 'incharge', v), optionsFor('incharge', x.id, s.incharge), !s.incharge)}</td>
                    <td style={{ minWidth: 200 }}>{sel(s.manager, (v) => setSlot(x.id, 'manager', v), optionsFor('manager', x.id, s.manager), !s.manager)}</td>
                  </tr>
                );
              })}
              {!shown.length && <tr><td colSpan={3} className="sub" style={{ textAlign: 'center', padding: 22 }}>{depts.length ? 'No departments match.' : 'No departments found — departments come from Department Setup.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {dirty && (
        <div style={{ position: 'sticky', bottom: 10, zIndex: 20, display: 'flex', alignItems: 'center', gap: 10, background: '#16202e', color: '#fff', borderRadius: 12, padding: '10px 16px', boxShadow: '0 14px 36px rgba(16,32,46,.35)' }}>
          <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>Unsaved changes to the roster setup</span>
          <button className="btn sm" type="button" disabled={busy} onClick={() => setDraft(fromCfg(cfg))}>Discard</button>
          <button className="btn pri sm" type="button" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save setup'}</button>
        </div>
      )}
    </div>
  );
}

window.RosterSetup = RosterSetup;
