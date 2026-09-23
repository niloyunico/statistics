/* MY PROFILE — the one page every signed-in person can open, whatever their role.
 *
 * WHY IT IS UNGATED
 * Every other view sits behind a module permission, but a person maintaining their
 * own name, contact details, photo and password is not exercising a privilege — it
 * is housekeeping on their own record. So `profile` is excluded from the module gate
 * in unicoCanAccessView(): a data collector with access to exactly one form still
 * reaches this page.
 *
 * THE DESIGN, AND WHY IT IS THIS AND NOT A SETTINGS FORM
 * In a hospital everyone already carries their identity on a lanyard. So the page
 * leads with a CREDENTIAL — slot, org bar, portrait, printed ID, barcode — the same
 * artifact this app already draws for a nurse's staff record. It is the one bold
 * element; the panels beside it are deliberately quiet.
 *
 * Identifiers are set in IBM Plex Mono throughout (ID, phone, dates, access levels,
 * department codes). Hospital wristbands, labels and requisitions are printed in
 * monospace: a number that identifies a person should look like data, not prose.
 * Prose stays in Plex Sans. That split is the whole typographic system.
 *
 * WHAT IS EDITABLE HERE, AND WHAT IS NOT
 * Editable: photo, display name, designation, email, phone, password.
 * Read-only: username, role, workspace permissions, department scope. Those are an
 * administrator's decision — the server refuses them on PATCH /api/me regardless of
 * what this page sends. "Access" states them plainly rather than hiding them, so a
 * person can see what they hold and who to ask when it is wrong.
 *
 * The photo is uploaded by PhotoPicker straight to Cloudinary (kind=profile) and the
 * server writes users.photo itself — an account document is not something the
 * renderer may patch. Everything else goes through PATCH /api/me.
 */
(function () {
  const { useState, useEffect, useMemo } = React;

  const api = (method, path, body) => fetch(path, {
    method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => {
    let j = null; try { j = await r.json(); } catch (e) { }
    if (!r.ok || !j || j.ok === false) {
      throw new Error((j && j.error) || (r.status === 401 ? 'Sign in to manage your account.' : 'Request failed (' + r.status + ').'));
    }
    return j;
  });

  const initialsOf = (n) => String(n || 'U').split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'U';

  // Workspace ids are internal; these are what people call them.
  const WS_LABEL = {
    stats: 'Statistics', quality: 'Quality Indicators', supervisor: 'Supervisor Reports',
    staff: 'Staff Management', datacol: 'Data Collection', reports: 'Reports',
    users: 'User Management', perf: 'Performance', roster: 'Duty Roster', medicine: 'Medicine & Rx',
  };
  const ACTIONS = ['view', 'edit', 'add', 'delete'];
  const ACTION_LABEL = { view: 'View', edit: 'Edit', add: 'Add', delete: 'Delete' };

  /* The barcode is generated from the ID itself, so two people never carry the same
     one and the strip changes when the ID does. Deterministic, not random: the same
     ID always prints the same bars, which is what makes it read as a credential
     rather than as decoration. */
  function Barcode({ seed, height }) {
    const bars = useMemo(() => {
      const s = String(seed || 'UNICO0000');
      const out = [];
      let acc = 7;
      for (let i = 0; i < 54; i++) {
        acc = (acc * 31 + (s.charCodeAt(i % s.length) || 48) + i * 7) >>> 0;
        out.push({ w: 1 + (acc % 4), on: (acc >> 3) % 5 !== 0 });
      }
      return out;
    }, [seed]);
    return (
      <div aria-hidden="true" style={{ display: 'flex', alignItems: 'stretch', gap: '1.5px', height: height || 38, justifyContent: 'center' }}>
        {bars.map((b, i) => <span key={i} style={{ width: b.w + 'px', background: b.on ? '#15181c' : 'transparent' }} />)}
      </div>
    );
  }

  function Field({ label, hint, children }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', color: 'var(--muted)', textTransform: 'uppercase' }}>{label}</label>
        {children}
        {hint && <div style={{ fontSize: 11, color: 'var(--faint,#9aa6b4)' }}>{hint}</div>}
      </div>
    );
  }

  function Banner({ m }) {
    if (!m) return null;
    const ok = m.kind === 'ok';
    return (
      <div role="status" style={{
        fontSize: 12.5, fontWeight: 600, borderRadius: 8, padding: '9px 12px',
        color: ok ? '#0f6a39' : '#b4232f',
        background: ok ? 'rgba(31,157,87,.10)' : 'rgba(210,58,82,.10)',
        border: '1px solid ' + (ok ? 'rgba(31,157,87,.28)' : 'rgba(210,58,82,.28)'),
      }}>{m.text}</div>
    );
  }

  function ProfileView() {
    const u = (typeof window !== 'undefined' && window.__UNICO_USER__) || null;

    const [photo, setPhoto] = useState((u && u.photo) || null);
    const [name, setName] = useState((u && u.name) || '');
    const [designation, setDesignation] = useState((u && u.designation) || '');
    const [email, setEmail] = useState((u && u.email) || '');
    const [phone, setPhone] = useState((u && u.phone) || '');
    const [workDept, setWorkDept] = useState((u && u.workDepartment) || '');

    const [cur, setCur] = useState(''); const [nw, setNw] = useState(''); const [nw2, setNw2] = useState('');
    const [busy, setBusy] = useState(false);
    const [pwBusy, setPwBusy] = useState(false);
    const [msg, setMsg] = useState(null);
    const [pwMsg, setPwMsg] = useState(null);

    useEffect(() => { document.title = 'My Profile · UNICO'; }, []);

    // This person's own record on the staff register (designation, department, joining
    // date, licence …). Read from the server so it shows for every account, including
    // ones without the staff module. Read-only here: Nursing Services keeps the register.
    const [staff, setStaff] = useState(undefined);
    useEffect(() => {
      if (!u) { setStaff(null); return; }
      let live = true;
      fetch('/api/me/staff', { credentials: 'same-origin', cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null)).then((j) => {
          if (!live) return; const st = (j && j.staff) || null; setStaff(st);
          if (st && !(u && u.designation) && st.designation) setDesignation((v) => v || st.designation);
          if (st && !(u && u.workDepartment) && st.current_department) setWorkDept((v) => v || st.current_department);
        })
        .catch(() => { if (live) setStaff(null); });
      return () => { live = false; };
    }, []);  // eslint-disable-line react-hooks/exhaustive-deps

    const baseDesig = (u && u.designation) || (staff && staff.designation) || '';
    const baseDept = (u && u.workDepartment) || (staff && staff.current_department) || '';
    const dirty = u ? (
      name !== (u.name || '') || email !== (u.email || '') ||
      phone !== (u.phone || '') || designation !== baseDesig || workDept !== baseDept
    ) : false;

    async function saveProfile() {
      setMsg(null); setBusy(true);
      try {
        // Belt and braces against autofill: the phone box is never legitimately the
        // account's own username, so refuse to persist that rather than corrupt the
        // record the way an earlier version of this page did.
        const cleanPhone = (u && phone && phone.trim().toLowerCase() === String(u.username).toLowerCase()) ? '' : phone;
        if (cleanPhone !== phone) setPhone(cleanPhone);
        await api('PATCH', '/api/me', { name, email, phone: cleanPhone, designation, workDepartment: workDept });
        if (window.__UNICO_USER__) Object.assign(window.__UNICO_USER__, { name, email, phone: cleanPhone, designation, workDepartment: workDept });
        setMsg({ kind: 'ok', text: 'Profile saved.' });
      } catch (e) { setMsg({ kind: 'err', text: String((e && e.message) || e) }); }
      finally { setBusy(false); }
    }

    async function savePassword() {
      setPwMsg(null);
      if (nw.length < 6) return setPwMsg({ kind: 'err', text: 'New password must be at least 6 characters.' });
      if (nw !== nw2) return setPwMsg({ kind: 'err', text: 'New passwords do not match.' });
      setPwBusy(true);
      try {
        await api('POST', '/api/me/password', { currentPassword: cur, newPassword: nw });
        setCur(''); setNw(''); setNw2('');
        setPwMsg({ kind: 'ok', text: 'Password changed.' });
      } catch (e) { setPwMsg({ kind: 'err', text: String((e && e.message) || e) }); }
      finally { setPwBusy(false); }
    }

    const roleLabel = !u ? 'Local session'
      : (u.role === 'collector' ? 'Data Collector' : (u.role === 'incharge' ? 'In-charge' : (u.role || 'User')));
    const idText = (staff && staff.emp_id) || (u && u.username) || '— — — —';

    // ---- Access: what this account actually holds, read from the live perms map ----
    const access = useMemo(() => {
      const perms = window.unicoUserPerms ? window.unicoUserPerms() : null;
      if (!perms) return { unrestricted: true, rows: [] };
      const ids = Object.keys(WS_LABEL).filter((m) => window.unicoCan && window.unicoCan(m, 'view'));
      return {
        unrestricted: false,
        rows: ids.map((m) => ({
          id: m, label: WS_LABEL[m] || m,
          actions: ACTIONS.filter((a) => window.unicoCan(m, a)),
        })),
      };
    }, [u]);

    const deptNames = useMemo(() => {
      const map = (typeof window !== 'undefined' && window.__UNICO_DEPT_MAP__) || null;
      const ids = (u && u.departments) || [];
      if (!ids.length) return [];
      return ids.map((id) => (map && map.byId && map.byId[id] && map.byId[id].name) || id);
    }, [u]);

    // Suggestions for the Department / Designation boxes: Nursing Service first, then the
    // staff record, the account's departments and every department the app knows.
    const deptOptions = useMemo(() => {
      const DM = window.DEPTMAP; const ids = (DM && DM.patientDeptIds) ? DM.patientDeptIds() : [];
      const names = ids.map((id) => (DM.nameFromId && DM.nameFromId(id)) || id);
      const q = (window.QUALITY_SEED || []).map((a) => a && a.name).filter(Boolean);
      return Array.from(new Set(['Nursing Service', staff && staff.current_department].concat(deptNames, names, q).filter(Boolean)));
    }, [staff, deptNames]);
    const desigOptions = useMemo(() => Array.from(new Set([staff && staff.designation, 'Director of Nursing', 'Deputy Director of Nursing', 'Nursing Supervisor', 'Nurse In-charge', 'Infection Control Nurse', 'Quality Nurse', 'Senior Staff Nurse', 'Staff Nurse', 'Junior Staff Nurse', 'Patient Care Assistant'].filter(Boolean))), [staff]);

    const scopeText = !u ? 'All staff'
      : (u.staffScope === 'self' ? 'Own record only' : (u.staffScope === 'departments' ? 'Own departments' : 'All staff'));

    const txt = {
      padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13,
      fontFamily: 'inherit', width: '100%', outline: 'none', background: '#fff', boxSizing: 'border-box',
    };
    const mono = { fontFamily: 'var(--mono)' };

    return (
      <div className="grid unico-profile" style={{ gap: 16 }}>
        <style>{`
          .unico-profile .cred{animation:credIn .5s cubic-bezier(.2,.7,.3,1) both}
          @keyframes credIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
          @media (prefers-reduced-motion:reduce){.unico-profile .cred{animation:none}}
          /* NB: this is a real stylesheet, not a JSX style object — every length needs
             its unit. A bare gap:16 is invalid CSS, silently dropped, and the two
             columns rendered with NO gap: the Details card sat flush over the
             credential's edge and clipped its values. */
          .unico-profile .cols{display:grid;grid-template-columns:minmax(280px,360px) minmax(0,1fr);gap:16px;align-items:start}
          @media (max-width:980px){.unico-profile .cols{grid-template-columns:minmax(0,1fr)}}
          .unico-profile .cred{min-width:0}
          .unico-profile .duo{display:grid;grid-template-columns:1fr 1fr;gap:12px}
          @media (max-width:560px){.unico-profile .duo{grid-template-columns:1fr}}
          .unico-profile input:focus-visible{border-color:var(--blue);box-shadow:0 0 0 3px rgba(0,144,202,.16)}
          .unico-profile .wsrow{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--line-2)}
          .unico-profile .wsrow:first-child{border-top:0}
        `}</style>

        <SectionTitle icon={I.user} title="My Profile"
          sub="Your credential, your details, and what your account can open." />

        {!u && (
          <div style={{ fontSize: 12.5, color: '#9a6b00', background: 'var(--warn-bg,#fff4e0)', border: '1px solid #f0d9a8', borderRadius: 8, padding: '10px 12px' }}>
            You are in local admin mode, so there is no account to edit. On the deployed
            site, where sign-in is required, this page saves to your account.
          </div>
        )}

        <div className="cols">

          {/* ============ THE CREDENTIAL — the one loud thing on the page ============ */}
          <div className="card cred" style={{ padding: 0, overflow: 'hidden', background: 'var(--panel)' }}>
            {/* lanyard slot */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 11 }}>
              <div style={{ width: 52, height: 7, borderRadius: 5, background: 'var(--line)' }} />
            </div>

            {/* org bar */}
            <div style={{ marginTop: 9, padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--panel-2)' }}>
              <img src="unico/logo.svg" alt="UNICO Hospitals" style={{ height: 28, width: 'auto', display: 'block' }} />
              <span style={{ flex: 1 }} />
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, letterSpacing: '.9px', color: '#fff',
                background: 'linear-gradient(130deg,#0aa0d4,#0072a3)', padding: '4px 9px', borderRadius: 6, whiteSpace: 'nowrap',
              }}>STAFF ID</span>
            </div>
            <div style={{ height: 4, background: 'linear-gradient(90deg,#3ab5a7,#0aa0d4,#0072a3)' }} />

            {/* portrait */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 22px 6px' }}>
              <PhotoPicker
                value={photo} size={132} kind="profile"
                initials={initialsOf(name || (u && u.username))} name={name || 'Account'}
                readOnly={!u}
                onChange={(next) => { setPhoto(next); window.unicoSetAccountPhoto(next); }}
              />
              <h2 style={{ margin: '15px 0 3px', fontSize: 20, fontWeight: 800, letterSpacing: '-.3px', textAlign: 'center', lineHeight: 1.2 }}>
                {name || (u && u.username) || 'Local Administrator'}
              </h2>
              <div style={{ fontSize: 12.5, color: 'var(--blue-700)', fontWeight: 700, textAlign: 'center' }}>
                {designation || (staff && staff.designation) || roleLabel}
              </div>
            </div>

            {/* printed fields — labels in sans, values in mono, like a real credential */}
            <div style={{ padding: '10px 22px 0' }}>
              {[
                ['ID No.', idText],
                ['Role', roleLabel],
                ['Dept.', workDept || (staff && staff.current_department) || 'Not recorded'],
                ...(staff ? [['Joined', staff.doj || 'Not recorded']] : []),
                ['Phone', phone || 'Not recorded'],
                ['Email', email || 'Not recorded'],
              ].map(([l, v], i) => (
                <div key={l} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '8px 0', borderTop: i ? '1px solid var(--line-2)' : 'none' }}>
                  <span style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.7px', color: 'var(--muted)', fontWeight: 700, flex: '0 0 62px' }}>{l}</span>
                  <span style={Object.assign({}, mono, {
                    fontSize: 12, fontWeight: 600, marginLeft: 'auto', textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word',
                    color: (v === 'Not recorded' || v === '— — — —') ? 'var(--faint)' : 'var(--ink)',
                  })}>{v}</span>
                </div>
              ))}
            </div>

            {/* barcode */}
            <div style={{ margin: '15px 18px 18px', padding: '11px 10px 7px', borderRadius: 10, background: '#fff', border: '1px solid var(--line-2)' }}>
              <Barcode seed={idText} />
              <div style={Object.assign({}, mono, { textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: 3, color: '#15181c', marginTop: 6 })}>
                {idText}
              </div>
            </div>
          </div>

          {/* ============ the quiet column ============ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {u && (
              <div className="card">
                <div className="card-h"><h3>Staff information</h3><span className="sub" style={{ marginLeft: 'auto' }}>From the staff register</span></div>
                <div className="card-b">
                  {staff === undefined ? (
                    <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Loading your staff record…</div>
                  ) : !staff ? (
                    <div style={{ fontSize: 12.5, color: '#8a5a00', background: 'var(--warn-bg,#fff4e0)', border: '1px solid #f0d9a8', borderRadius: 8, padding: '10px 12px' }}>
                      Your account is not linked to a staff record yet. Ask the administrator to link it (Access Control → your account), or check that your employee ID is on the staff register.
                    </div>
                  ) : (
                    <React.Fragment>
                      <div className="duo">
                        {[
                          ['Employee ID', staff.emp_id],
                          ['Designation', staff.designation],
                          ['Department', staff.current_department],
                          ['Primary department', staff.primary_department],
                          ['Date of joining', staff.doj],
                          ['Category', staff.role || staff.category || staff.staff_type],
                          ['Qualification', staff.qualification || staff.education],
                          ['Date of birth', staff.dob],
                          ['Gender', staff.gender],
                          ['Blood group', staff.blood_group],
                          ['Phone (register)', staff.phone || staff.mobile],
                          ['Registration / licence', [staff.licence_no, staff.licence_expiry && ('expires ' + staff.licence_expiry)].filter(Boolean).join(' · ')],
                          ['Hepatitis B', staff.hepatitis_b_vaccination],
                        ].filter(([, v]) => v != null && String(v).trim() !== '').map(([l, v]) => (
                          <div key={l} style={{ background: 'var(--panel-2)', borderRadius: 9, padding: '8px 11px', minWidth: 0 }}>
                            <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--muted)', fontWeight: 700, marginBottom: 3 }}>{l}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflowWrap: 'anywhere' }}>{String(v)}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>Something wrong here? Nursing Services updates the staff register.</div>
                    </React.Fragment>
                  )}
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-h"><h3>Details</h3><span className="sub" style={{ marginLeft: 'auto' }}>{dirty ? 'Unsaved changes' : 'Everything saved'}</span></div>
              <form className="card-b" autoComplete="off" onSubmit={(e) => { e.preventDefault(); if (u && dirty && !busy) saveProfile(); }}
                style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                <Banner m={msg} />
                <Field label="Full name" hint="Shown on reports you sign and everywhere your account appears.">
                  <input style={txt} name="fullname" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" disabled={!u} />
                </Field>
                <div className="duo">
                  <Field label="Department" hint="Where you work. Pick from the list or type. Does not affect your access.">
                    <input style={txt} name="workdept" list="unico-prof-depts" autoComplete="off" value={workDept} onChange={(e) => setWorkDept(e.target.value)} placeholder="e.g. Nursing Service" disabled={!u} />
                    <datalist id="unico-prof-depts">{deptOptions.map((d) => <option key={d} value={d} />)}</datalist>
                  </Field>
                  <Field label="Designation" hint="Your job title, e.g. Nursing Supervisor. Does not affect your access.">
                    <input style={txt} name="designation" list="unico-prof-desigs" autoComplete="organization-title" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="Your job title" disabled={!u} />
                    <datalist id="unico-prof-desigs">{desigOptions.map((d) => <option key={d} value={d} />)}</datalist>
                  </Field>
                </div>
                <div className="duo">
                  <Field label="Email">
                    <input style={txt} type="email" name="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@unicohospitals.com" disabled={!u} />
                  </Field>
                  <Field label="Phone">
                    <input style={Object.assign({}, txt, mono)} type="tel" name="phone" autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" disabled={!u} />
                  </Field>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn pri sm" type="submit" disabled={busy || !u || !dirty}>
                    <Ic d={I.check} s={14} />{busy ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>
            </div>

            <div className="card">
              <div className="card-h"><h3>Password</h3></div>
              <form className="card-b" onSubmit={(e) => { e.preventDefault(); if (u && cur && nw && !pwBusy) savePassword(); }}
                style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                <Banner m={pwMsg} />
                {/* THE POINT OF THIS FIELD: a browser password manager insists on
                    filling a username somewhere near a password box, and with nothing
                    marked as one it picked the last text input above — the PHONE field
                    — and wrote the login name into it. Real corrupted data came from
                    that. Giving it an actual username field to aim at is the fix; it is
                    read-only and visually hidden, never submitted, and off the tab order. */}
                <input type="text" name="username" autoComplete="username" readOnly tabIndex={-1}
                  aria-hidden="true" value={(u && u.username) || ''} onChange={() => { }}
                  style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
                <Field label="Current password">
                  <input style={txt} type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} placeholder="Enter current password" disabled={!u} />
                </Field>
                <div className="duo">
                  <Field label="New password">
                    <input style={txt} type="password" autoComplete="new-password" value={nw} onChange={(e) => setNw(e.target.value)} placeholder="At least 6 characters" disabled={!u} />
                  </Field>
                  <Field label="Confirm new password">
                    <input style={txt} type="password" autoComplete="new-password" value={nw2} onChange={(e) => setNw2(e.target.value)} placeholder="Re-enter new password" disabled={!u} />
                  </Field>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn pri sm" type="submit" disabled={pwBusy || !u || !cur || !nw}>
                    <Ic d={I.check} s={14} />{pwBusy ? 'Saving…' : 'Change password'}
                  </button>
                </div>
              </form>
            </div>

          </div>
        </div>
      </div>
    );
  }

  window.ProfileView = ProfileView;
})();
