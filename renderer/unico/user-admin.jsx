/* UNICO — User Management module.
 *
 * The "Users" mega-module workspace: lists every account in the MongoDB `users`
 * collection with its role, status and scope, plus full admin actions — create,
 * edit (name/role/status/scope), reset password, activate/deactivate, delete.
 *
 * Talks to the admin-only REST API in server/users-admin.js (mounted by web.js):
 *   GET    /api/users                 -> { ok, users:[...], roles:[...] }
 *   POST   /api/users                 -> create
 *   PATCH  /api/users/:username       -> update name/role/active/scope
 *   POST   /api/users/:username/password -> reset password
 *   DELETE /api/users/:username       -> delete
 * In the default open local mode these are unguarded (local PC admin); with
 * REQUIRE_AUTH=true they require an Administrator session.
 *
 * Self-contained: every helper is prefixed ua/UA_ to avoid the shared global
 * lexical scope; React is destructured inside the component. */

const UA_ROLES = ['Administrator', 'collector', 'User'];
const UA_ROLE_LABEL = { Administrator: 'Administrator', collector: 'Data Collector', User: 'User' };
const UA_ROLE_TONE = { Administrator: ['#6a52d4', 'rgba(106,82,212,.12)'], collector: ['#0090ca', 'var(--blue-50)'], User: ['#5b6b80', '#eef1f5'] };
function uaRoleTone(r) { return UA_ROLE_TONE[r] || UA_ROLE_TONE.User; }

function uaApi(method, path, body) {
  return fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: body ? JSON.stringify(body) : undefined,
  }).then(async r => {
    let j = null; try { j = await r.json(); } catch (e) { /* non-JSON */ }
    if (!r.ok || !j || j.ok === false) {
      const msg = (j && j.error) || (r.status === 401 ? 'Sign in as an administrator to manage users.' : r.status === 403 ? 'Administrator access required.' : 'Request failed (' + r.status + ').');
      throw new Error(msg);
    }
    return j;
  });
}
function uaToast(msg, kind) { try { if (window.UI && window.UI.toast) window.UI.toast(msg, kind || 'success'); } catch (e) { } }

/* ---- create / edit modal ---- */
function UAUserForm({ user, roles, onClose, onSaved }) {
  const { useState } = React;
  const editing = !!user;
  const [username, setUsername] = useState(user ? user.username : '');
  const [name, setName] = useState(user ? (user.name || '') : '');
  const [role, setRole] = useState(user ? (user.role || 'User') : 'User');
  const [active, setActive] = useState(user ? user.active !== false : true);
  const [password, setPassword] = useState('');
  const [departments, setDepartments] = useState(user && user.departments ? user.departments.join(', ') : '');
  const [allQualityAreas, setAllQualityAreas] = useState(user ? !!user.allQualityAreas : false);
  const [qualityAreas, setQualityAreas] = useState(user && Array.isArray(user.qualityAreas) ? user.qualityAreas : []);
  const [qualityIndicators, setQualityIndicators] = useState(user && user.qualityIndicators && typeof user.qualityIndicators === 'object' && !Array.isArray(user.qualityIndicators) ? user.qualityIndicators : {});
  const qAreas = React.useMemo(() => (window.qualityData ? window.qualityData() : []).map(d => ({ key: d.key, name: d.name })), []);
  const qAreaInds = React.useMemo(() => { const m = {}; (window.qualityData ? window.qualityData() : []).forEach(d => { m[d.key] = (d.indicators || []).map(i => ({ id: i.id, name: i.name })); }); return m; }, []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const txt = { padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', width: '100%', outline: 'none', background: '#fff' };
  const list = s => s.split(',').map(x => x.trim()).filter(Boolean);

  const submit = async () => {
    setErr('');
    if (!editing && !String(username).trim()) return setErr('Username is required.');
    if (!editing && password.length < 6) return setErr('Password must be at least 6 characters.');
    setBusy(true);
    try {
      // Quality areas are DERIVED server-side from departments (+ hospital-wide flag), so we
      // only send the department list and the flag — never a separate qualityAreas array.
      const scope = role === 'collector'
        ? { departments: list(departments), allQualityAreas, qualityAreas, qualityIndicators }
        : { departments: [], allQualityAreas: false, qualityAreas: [], qualityIndicators: {} };
      if (editing) {
        await uaApi('PATCH', '/api/users/' + encodeURIComponent(user.username), { name, role, active, ...scope });
      } else {
        await uaApi('POST', '/api/users', { username: String(username).trim().toLowerCase(), name, role, active, password, ...scope });
      }
      uaToast(editing ? 'User updated' : 'User created');
      onSaved();
    } catch (e) { setErr(e.message || 'Could not save.'); }
    finally { setBusy(false); }
  };

  return (
    <div onMouseDown={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(16,32,46,.42)', zIndex: 400, display: 'grid', placeItems: 'center', padding: 20 }}>
      <div onMouseDown={e => e.stopPropagation()} className="card" style={{ width: 460, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <div className="card-h"><h3>{editing ? 'Edit user' : 'Add user'}</h3><span className="spacer" /><button className="icon-btn" style={{ width: 28, height: 28 }} onClick={onClose}><Ic d={I.x} s={14} /></button></div>
        <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field"><label>Username</label>
            <input style={{ ...txt, opacity: editing ? 0.6 : 1 }} value={username} disabled={editing} onChange={e => setUsername(e.target.value)} placeholder="e.g. j.smith" />
          </div>
          <div className="field"><label>Full name</label>
            <input style={txt} value={name} onChange={e => setName(e.target.value)} placeholder="Display name" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
            <div className="field"><label>Role</label>
              <select style={txt} value={role} onChange={e => setRole(e.target.value)}>
                {(roles && roles.length ? roles : UA_ROLES).map(r => <option key={r} value={r}>{UA_ROLE_LABEL[r] || r}</option>)}
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer', paddingBottom: 9 }}>
              <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />Active
            </label>
          </div>
          {role === 'collector' && (() => {
            const derived = allQualityAreas ? (window.DEPTMAP ? window.DEPTMAP.allAreaKeys() : []) : (window.DEPTMAP ? window.DEPTMAP.areasFromDepts(list(departments)) : []);
            const effective = allQualityAreas ? derived : [...derived, ...qualityAreas.filter(k => !derived.includes(k))];
            const toggleArea = (k) => setQualityAreas(qa => qa.includes(k) ? qa.filter(x => x !== k) : [...qa, k]);
            const depNames = list(departments).map(id => window.DEPTMAP ? window.DEPTMAP.nameFromId(id) : id);
            return <>
              <div className="field"><label>Departments <span style={{ fontWeight: 400, color: 'var(--muted)' }}>· ids, comma-separated (incl. custom like ctot)</span></label>
                <input style={txt} value={departments} onChange={e => setDepartments(e.target.value)} placeholder="e.g. micu, ccu, ctot" />
                {depNames.length > 0 && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>{depNames.join(' · ')}</div>}
              </div>
              <div className="field"><label>Quality areas <span style={{ fontWeight: 400, color: 'var(--muted)' }}>· AUTO from departments + custom extras</span></label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer', margin: '2px 0 8px' }}>
                  <input type="checkbox" checked={allQualityAreas} onChange={e => setAllQualityAreas(e.target.checked)} />
                  Hospital-wide — every quality area
                </label>
                {!allQualityAreas && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {qAreas.map(a => { const auto = derived.includes(a.key); const on = auto || qualityAreas.includes(a.key);
                    return <span key={a.key} onClick={() => { if (!auto) toggleArea(a.key); }} title={auto ? 'From a department' : 'Custom access'}
                      style={{ cursor: auto ? 'default' : 'pointer', padding: '4px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, border: '1px solid ' + (on ? 'var(--blue)' : 'var(--line)'), background: on ? 'var(--blue-50)' : '#fff', color: on ? 'var(--blue-700)' : 'var(--ink-2)', opacity: auto ? 0.85 : 1 }}>{a.name}{auto && <span style={{ fontSize: 8.5, fontWeight: 700, marginLeft: 3, opacity: 0.7 }}>AUTO</span>}</span>; })}
                </div>}
              </div>
              {effective.length > 0 && <div className="field"><label>Specific indicators <span style={{ fontWeight: 400, color: 'var(--muted)' }}>· leave empty in an area = all indicators</span></label>
                <div style={{ display: 'grid', gap: 8 }}>
                  {effective.map(ak => { const inds = qAreaInds[ak] || []; if (!inds.length) return null; const aName = (qAreas.find(a => a.key === ak) || {}).name || ak; const sel = qualityIndicators[ak] || [];
                    const setSel = (ids) => setQualityIndicators(m => { const n = { ...m }; if (ids && ids.length) n[ak] = ids; else delete n[ak]; return n; });
                    return <div key={ak} style={{ padding: '8px 10px', background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}><span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)' }}>{aName} <span style={{ fontWeight: 500, color: 'var(--muted)' }}>· {sel.length ? (sel.length + ' of ' + inds.length + ' selected') : ('all ' + inds.length)}</span></span><span style={{ flex: 1 }} /><button type="button" onClick={() => setSel(inds.map(x => x.id))} style={{ border: 0, background: 'none', color: 'var(--blue)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}>Select all</button><button type="button" onClick={() => setSel([])} style={{ border: 0, background: 'none', color: 'var(--muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}>Clear (= all)</button></div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{inds.map(ind => { const on = sel.includes(ind.id); return <span key={ind.id} onClick={() => setSel(on ? sel.filter(x => x !== ind.id) : [...sel, ind.id])} style={{ cursor: 'pointer', padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, border: '1px solid ' + (on ? 'var(--blue)' : 'var(--line)'), background: on ? 'var(--blue-50)' : '#fff', color: on ? 'var(--blue-700)' : 'var(--ink-2)' }}>{ind.name}</span>; })}</div>
                    </div>; })}
                </div>
              </div>}
            </>;
          })()}
          {!editing && (
            <div className="field"><label>Password</label>
              <input style={txt} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" />
            </div>
          )}
          {err && <div style={{ fontSize: 12.5, color: '#b32339', background: 'var(--neg-bg)', borderRadius: 7, padding: '8px 10px' }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn sm" onClick={onClose}>Cancel</button>
            <button className="btn pri sm" onClick={submit} disabled={busy}><Ic d={I.check} s={14} />{busy ? 'Saving…' : (editing ? 'Save changes' : 'Create user')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- reset-password modal ---- */
function UAPasswordForm({ user, onClose, onSaved }) {
  const { useState } = React;
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const txt = { padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', width: '100%', outline: 'none', background: '#fff' };
  const submit = async () => {
    if (pw.length < 6) return setErr('Password must be at least 6 characters.');
    setBusy(true); setErr('');
    try { await uaApi('POST', '/api/users/' + encodeURIComponent(user.username) + '/password', { password: pw }); uaToast('Password reset'); onSaved(); }
    catch (e) { setErr(e.message || 'Could not reset.'); } finally { setBusy(false); }
  };
  return (
    <div onMouseDown={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(16,32,46,.42)', zIndex: 400, display: 'grid', placeItems: 'center', padding: 20 }}>
      <div onMouseDown={e => e.stopPropagation()} className="card" style={{ width: 380, maxWidth: '100%' }}>
        <div className="card-h"><h3>Reset password</h3><span className="spacer" /><button className="icon-btn" style={{ width: 28, height: 28 }} onClick={onClose}><Ic d={I.x} s={14} /></button></div>
        <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>New password for <b style={{ color: 'var(--ink)' }}>{user.name || user.username}</b> (@{user.username}).</div>
          <input style={txt} type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="At least 6 characters" />
          {err && <div style={{ fontSize: 12.5, color: '#b32339', background: 'var(--neg-bg)', borderRadius: 7, padding: '8px 10px' }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn sm" onClick={onClose}>Cancel</button>
            <button className="btn pri sm" onClick={submit} disabled={busy}><Ic d={I.check} s={14} />{busy ? 'Saving…' : 'Reset password'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- main screen ---- */
function UserAdmin() {
  const { useState, useEffect } = React;
  const [users, setUsers] = useState(null); // null = loading
  const [roles, setRoles] = useState(UA_ROLES);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [form, setForm] = useState(null);   // {user|null}
  const [pwUser, setPwUser] = useState(null);

  const load = () => {
    setErr('');
    uaApi('GET', '/api/users')
      .then(j => { setUsers(j.users || []); if (j.roles && j.roles.length) setRoles(j.roles); })
      .catch(e => { setUsers([]); setErr(e.message || 'Could not load users.'); });
  };
  useEffect(load, []);

  const setActive = async (u, active) => {
    try { await uaApi('PATCH', '/api/users/' + encodeURIComponent(u.username), { active }); uaToast(active ? 'Activated' : 'Deactivated'); load(); }
    catch (e) { uaToast(e.message || 'Failed', 'error'); }
  };
  const del = async (u) => {
    let ok = true;
    try { ok = await window.UI.confirm({ title: 'Delete user?', message: `Permanently removes "${u.name || u.username}" (@${u.username}).`, danger: true, confirmLabel: 'Delete' }); }
    catch (e) { ok = window.confirm('Delete ' + u.username + '?'); }
    if (!ok) return;
    try { await uaApi('DELETE', '/api/users/' + encodeURIComponent(u.username)); uaToast('User deleted'); load(); }
    catch (e) { uaToast(e.message || 'Failed', 'error'); }
  };

  const all = users || [];
  const counts = {
    total: all.length,
    admin: all.filter(u => u.role === 'Administrator').length,
    collector: all.filter(u => u.role === 'collector').length,
    active: all.filter(u => u.active !== false).length,
  };
  const ql = q.trim().toLowerCase();
  const shown = all.filter(u =>
    (roleFilter === 'all' || u.role === roleFilter) &&
    (!ql || (u.username || '').toLowerCase().includes(ql) || (u.name || '').toLowerCase().includes(ql))
  );

  const sel = { padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', background: '#fff', color: 'var(--ink)' };
  const Kpi = ({ label, val, color }) => (
    <div className="card anim-pop" style={{ padding: '15px 18px', borderLeft: `4px solid ${color}`, display: 'flex', flexDirection: 'column', minHeight: 92 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>{label}</div>
      <div className="num" style={{ fontSize: 28, fontWeight: 700, color, margin: '6px 0 0', lineHeight: 1 }}>{val}</div>
    </div>
  );

  return (
    <div className="grid" style={{ gap: 16 }}>
      <SectionTitle icon={I.user} title="User Management" sub="All accounts, roles & access across the UNICO suite"
        right={<>
          <button className="btn sm" onClick={load}><Ic d={I.search} s={14} />Refresh</button>
          <button className="btn pri sm" onClick={() => setForm({ user: null })}><Ic d={I.plus} s={14} />Add user</button>
        </>} />

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
        <Kpi label="Total users" val={counts.total} color="#0090ca" />
        <Kpi label="Administrators" val={counts.admin} color="#6a52d4" />
        <Kpi label="Data collectors" val={counts.collector} color="#3ab5a7" />
        <Kpi label="Active" val={counts.active} color="#1f9d57" />
      </div>

      {err && (
        <div className="card" style={{ padding: '12px 16px', borderLeft: '4px solid #d23a52', fontSize: 12.5, color: '#b32339' }}>
          {err} {String(err).toLowerCase().includes('administrator') ? '' : '· Is the server running with a database connection?'}
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-h" style={{ flexWrap: 'wrap', gap: 8 }}>
          <h3>Accounts</h3><span className="sub">{shown.length} of {all.length} shown</span><span className="spacer" />
          <div className="tb-search" style={{ width: 220, margin: 0 }}>
            <Ic d={I.search} s={14} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or username…" />
          </div>
          <select style={sel} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="all">All roles</option>
            {roles.map(r => <option key={r} value={r}>{UA_ROLE_LABEL[r] || r}</option>)}
          </select>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr>
              <th style={{ textAlign: 'left' }}>Name</th>
              <th style={{ textAlign: 'left' }}>Username</th>
              <th style={{ textAlign: 'left' }}>Role</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th style={{ textAlign: 'left' }}>Scope</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr></thead>
            <tbody>
              {users === null && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Loading…</td></tr>}
              {users !== null && shown.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>No users{ql || roleFilter !== 'all' ? ' match the filter' : ' found'}.</td></tr>}
              {shown.map(u => {
                const [fg, bg] = uaRoleTone(u.role);
                const active = u.active !== false;
                const scope = [].concat(u.departments || []).concat(u.qualityAreas || []);
                return (
                  <tr key={u.username}>
                    <td style={{ textAlign: 'left' }}><b style={{ color: 'var(--ink)' }}>{u.name || u.username}</b></td>
                    <td style={{ textAlign: 'left', fontFamily: 'var(--mono)', fontSize: 12 }}>@{u.username}</td>
                    <td style={{ textAlign: 'left' }}><span className="chip" style={{ background: bg, color: fg, fontWeight: 700 }}>{UA_ROLE_LABEL[u.role] || u.role}</span></td>
                    <td style={{ textAlign: 'center' }}><span className="chip" style={{ background: active ? 'var(--pos-bg)' : '#eef1f5', color: active ? 'var(--pos)' : '#9aa6b4' }}>{active ? 'Active' : 'Inactive'}</span></td>
                    <td style={{ textAlign: 'left', fontSize: 11.5, color: 'var(--muted)', maxWidth: 240 }}>{scope.length ? scope.join(', ') : '—'}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn sm" title="Edit" onClick={() => setForm({ user: u })}><Ic d={I.edit} s={13} /></button>{' '}
                      <button className="btn sm" title="Reset password" onClick={() => setPwUser(u)}><Ic d={I.gear} s={13} /></button>{' '}
                      <button className="btn sm" title={active ? 'Deactivate' : 'Activate'} onClick={() => setActive(u, !active)}><Ic d={active ? I.x : I.check} s={13} /></button>{' '}
                      <button className="icon-btn danger" style={{ width: 28, height: 28, display: 'inline-grid' }} title="Delete" onClick={() => del(u)}><Ic d={I.x} s={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {form && <UAUserForm user={form.user} roles={roles} onClose={() => setForm(null)} onSaved={() => { setForm(null); load(); }} />}
      {pwUser && <UAPasswordForm user={pwUser} onClose={() => setPwUser(null)} onSaved={() => setPwUser(null)} />}
    </div>
  );
}

window.UserAdmin = UserAdmin;
