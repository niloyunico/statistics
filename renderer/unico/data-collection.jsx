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

  // Shared, de-duped fetch of ALL submissions. The Review's Coverage panel, Collector
  // Progress panel and the duplicate-compare button all need the full list — without
  // this they'd each fire their own /api/submissions?status=all query, hammering the
  // database (a cause of "failed database" errors when several collectors submit at
  // once). Concurrent callers share one in-flight request; results cache for 8s.
  let _dcAllCache = null, _dcAllAt = 0, _dcAllPromise = null;
  const dcAllSubmissions = (force) => {
    const now = Date.now();
    if (!force && _dcAllCache && (now - _dcAllAt) < 8000) return Promise.resolve(_dcAllCache);
    if (_dcAllPromise) return _dcAllPromise;
    _dcAllPromise = dcApi.get('/api/submissions?status=all&limit=1000')
      .then((r) => { _dcAllCache = r && r.ok ? (r.submissions || []) : (_dcAllCache || []); _dcAllAt = Date.now(); _dcAllPromise = null; return _dcAllCache; })
      .catch(() => { _dcAllPromise = null; return _dcAllCache || []; });
    return _dcAllPromise;
  };
  if (typeof window !== 'undefined') window.addEventListener('unico:data-refreshed', () => { _dcAllCache = null; });

  // ---- shared helpers ----
  // After an approve (or an admin edit of an APPROVED submission) is applied
  // server-side, the page-load snapshots (window.UNICO.DEPARTMENTS /
  // window.QUALITY_SEED) are stale — refetch them so Statistics & Quality show
  // the new data as soon as their views remount (no full page reload needed).
  const dcRefreshLive = () => {
    try { window.UNICO && window.UNICO.refreshDepartments && window.UNICO.refreshDepartments(); } catch (e) { }
    try { window.refreshQualitySeed && window.refreshQualitySeed(); } catch (e) { }
  };
  // Views below cache qualityData()/dept lists in useMemo — include this rev in the
  // deps so they re-read after a live refetch ('unico:data-refreshed': approval in
  // another view, tab refocus, indicator assign/unassign in the Quality console).
  const useDcDataRev = () => {
    const [rev, setRev] = useState(0);
    useEffect(() => { const h = () => setRev((r) => r + 1); window.addEventListener('unico:data-refreshed', h); return () => window.removeEventListener('unico:data-refreshed', h); }, []);
    return rev;
  };

  // Unmissable submission-success popup: centered, animated check, auto-dismisses after
  // 3 seconds (click anywhere to close sooner). Collectors kept missing the inline
  // banner + corner toast and re-submitted, unsure whether the data went through.
  function DcSuccessPopup({ title, sub, onClose }) {
    useEffect(() => { const t = setTimeout(() => { try { onClose && onClose(); } catch (e) { } }, 3000); return () => clearTimeout(t); }, []);
    return (
      <div onClick={onClose} role="status" aria-live="polite" style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'grid', placeItems: 'center', background: 'rgba(13,27,46,.42)', animation: 'dcpop-bg .22s ease-out' }}>
        <style>{'@keyframes dcpop-bg{from{opacity:0}to{opacity:1}}@keyframes dcpop-card{0%{opacity:0;transform:scale(.82) translateY(12px)}60%{transform:scale(1.03)}100%{opacity:1;transform:scale(1) translateY(0)}}@keyframes dcpop-check{from{stroke-dashoffset:48}to{stroke-dashoffset:0}}'}</style>
        <div style={{ background: '#fff', borderRadius: 18, padding: '30px 38px 24px', textAlign: 'center', maxWidth: 360, boxShadow: '0 24px 70px rgba(5,12,24,.35)', animation: 'dcpop-card .35s cubic-bezier(.2,.85,.3,1.15) both' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#e7f6ed', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#1f9d57" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" strokeDasharray="48" style={{ animation: 'dcpop-check .5s .15s ease-out both' }} /></svg>
          </div>
          <div style={{ fontSize: 16.5, fontWeight: 700, color: '#17202b' }}>{title || 'Data submitted successfully!'}</div>
          {sub && <div style={{ fontSize: 12.5, color: '#6c7a8c', marginTop: 6 }}>{sub}</div>}
          <div style={{ fontSize: 11, color: '#9aa6b4', marginTop: 12 }}>Sent for admin review · closes automatically</div>
        </div>
      </div>
    );
  }
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
  const dcWideMonths = () => { const out = []; for (let yy = 24; yy <= 32; yy++) { MONS_ABBR.forEach((m) => out.push(m + '-' + String(yy).padStart(2, '0'))); } return out; }; // 2024 → 2032 (covers 2030+)
  // Default reporting month = the PREVIOUS completed calendar month (monthly reporting is
  // retrospective — e.g. in July you report June). Computed from the clock, never hardcoded.
  const dcDefaultMonth = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return MONS_ABBR[d.getMonth()] + '-' + String(d.getFullYear() % 100).padStart(2, '0'); };
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
    // Every panel in this module goes through here, so this one style is what makes
    // the Data Collection screens glass. Call sites can still override -- the
    // caller's style is spread last, which is how sticky headers keep their opacity.
    return <div style={{ background: 'linear-gradient(152deg,rgba(255,255,255,.76),rgba(236,247,255,.46))', backdropFilter: 'blur(26px) saturate(1.75)', WebkitBackdropFilter: 'blur(26px) saturate(1.75)', border: '1px solid rgba(255,255,255,.92)', boxShadow: '0 14px 42px rgba(31,59,90,.14),0 4px 16px rgba(0,144,202,.09),inset 0 1px 0 rgba(255,255,255,.95)', borderRadius: 16, padding: 18, ...(props.style || {}) }}>{props.children}</div>;
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

  /* ============================ Access Matrix ============================
     Department-wise indicator → assigned-person overview. Every indicator row shows
     WHO collects it as person chips (hover = how the access is granted); ✕ on a chip
     revokes, “+ Assign” grants — writing the SAME /api/responsibles records the People
     editor saves (the server re-derives areas and mirrors the collector login). */
  function AccessMatrix({ persons, areas, areaInds, onChanged, onEditPerson }) {
    const DM = window.DEPTMAP;
    const [q, setQ] = useState('');
    const [menu, setMenu] = useState(null);   // {area, indId} — the open “+ Assign” picker
    const [menuQ, setMenuQ] = useState('');
    const [busy, setBusy] = useState(false);

    const hasArea = (r, ak) => !!r.allQualityAreas || (r.qualityAreas || []).includes(ak);
    const selOf = (r, ak) => ((r.qualityIndicators || {})[ak]) || [];
    const covers = (r, ak, id) => hasArea(r, ak) && (selOf(r, ak).length === 0 || selOf(r, ak).includes(id));
    const derived = (r, ak) => !!r.allQualityAreas || (DM ? DM.areasFromDepts(r.departments || []) : []).includes(ak);
    const initials = (n) => String(n || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    const tipOf = (r, ak) => {
      const via = r.allQualityAreas ? 'hospital-wide access' : derived(r, ak) ? 'via department assignment' : 'custom area access';
      const sel = selOf(r, ak);
      return r.name + (r.title ? ' · ' + r.title : '') + (r.empId ? ' · ' + r.empId : '') + ' — ' + via
        + (sel.length ? ' · restricted to ' + sel.length + ' indicator' + (sel.length > 1 ? 's' : '') : ' · all indicators of this area')
        + (r.active === false ? ' · INACTIVE' : '');
    };

    const saveRec = (rec, okMsg) => {
      setBusy(true);
      return dcApi.post('/api/responsibles', rec).then((res) => {
        setBusy(false);
        if (res.ok) { toast(okMsg, 'success'); onChanged && onChanged(); }
        else toast(res.error || 'Could not save', 'error');
      }).catch(() => { setBusy(false); toast('Could not save', 'error'); });
    };

    // Give: person without the area gets the area RESTRICTED to just this indicator;
    // a restricted person gets the indicator added to their list.
    const give = (r, ak, ind) => {
      setMenu(null); setMenuQ('');
      const qi = { ...(r.qualityIndicators || {}) };
      if (!hasArea(r, ak)) {
        qi[ak] = [ind.id];
        return saveRec({ ...r, qualityAreas: [...(r.qualityAreas || []), ak], qualityIndicators: qi }, r.name + ' can now report ' + ind.name);
      }
      const sel = selOf(r, ak);
      if (sel.length === 0) { toast(r.name + ' already has every indicator of this area.', 'info'); return; }
      qi[ak] = [...sel, ind.id];
      return saveRec({ ...r, qualityIndicators: qi }, r.name + ' can now report ' + ind.name);
    };

    // Revoke: full-area access becomes an explicit list minus this indicator; removing the
    // LAST indicator drops the whole (custom) area — a department-derived area can only be
    // changed by editing the person's departments, so that case is explained instead.
    const revoke = (r, ak, ind, aName) => {
      const allIds = (areaInds[ak] || []).map((x) => x.id);
      const sel0 = selOf(r, ak);
      const left = (sel0.length === 0 ? allIds : sel0).filter((x) => x !== ind.id);
      const qi = { ...(r.qualityIndicators || {}) };
      if (left.length > 0) { qi[ak] = left; return saveRec({ ...r, qualityIndicators: qi }, 'Removed ' + ind.name + ' from ' + r.name); }
      if (derived(r, ak)) {
        toast(r.name + "'s " + aName + ' access comes from their department assignment — edit the person to change departments.', 'error');
        onEditPerson && onEditPerson(r);
        return;
      }
      delete qi[ak];
      return saveRec({ ...r, qualityAreas: (r.qualityAreas || []).filter((k) => k !== ak), qualityIndicators: qi }, 'Removed ' + r.name + ' from ' + aName);
    };

    // search filters by department/area, indicator or person name
    const qn = q.trim().toLowerCase();
    const areasShown = areas.filter((a) => {
      if (!qn) return true;
      if ((a.name || '').toLowerCase().includes(qn)) return true;
      const inds = areaInds[a.key] || [];
      return inds.some((ind) => (ind.name || '').toLowerCase().includes(qn)
        || persons.some((r) => covers(r, a.key, ind.id) && (r.name || '').toLowerCase().includes(qn)));
    });
    const totInds = areas.reduce((s, a) => s + (areaInds[a.key] || []).length, 0);
    const unassigned = areas.reduce((s, a) => s + (areaInds[a.key] || []).filter((ind) => !persons.some((r) => covers(r, a.key, ind.id))).length, 0);

    const chip = (r, a, ind) => (
      <span key={r.id} title={tipOf(r, a.key)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 4px 3px 3px', borderRadius: 999, background: 'var(--blue-50)', border: '1px solid var(--blue)', fontSize: 11.5, fontWeight: 600, color: 'var(--blue-700)', opacity: r.active === false ? 0.55 : 1 }}>
        <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--blue)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{initials(r.name)}</span>
        <span style={{ cursor: onEditPerson ? 'pointer' : 'default' }} onClick={() => onEditPerson && onEditPerson(r)}>{r.name}</span>
        <button title={'Remove ' + ind.name + ' access from ' + r.name} disabled={busy}
          onClick={() => revoke(r, a.key, ind, a.name)}
          style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--rose)', display: 'grid', placeItems: 'center', padding: '0 3px' }}><Ic d={I.x} s={11} /></button>
      </span>
    );

    return (
      <div className="grid" style={{ gap: 14 }}>
        <Card style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '12px 16px' }}>
          <input style={{ ...inputStyle, width: 300, flex: '0 1 auto' }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by department, indicator or person…" />
          <span style={{ flex: 1 }} />
          {[['Departments', areas.length], ['Indicators', totInds], ['People', persons.filter((r) => r.active !== false).length], ['Unassigned indicators', unassigned]].map(([l, v]) => (
            <span key={l} style={{ fontSize: 12, color: 'var(--muted)' }}><b style={{ color: l.startsWith('Unassigned') && v > 0 ? 'var(--rose)' : 'var(--ink)', fontFamily: 'var(--mono)' }}>{v}</b> {l}</span>
          ))}
        </Card>
        {areasShown.length === 0 && <Card><div style={{ padding: 10, color: 'var(--muted)', textAlign: 'center' }}>Nothing matches “{q}”.</div></Card>}
        {areasShown.map((a) => {
          const inds = (areaInds[a.key] || []).filter((ind) => !qn
            || (a.name || '').toLowerCase().includes(qn)
            || (ind.name || '').toLowerCase().includes(qn)
            || persons.some((r) => covers(r, a.key, ind.id) && (r.name || '').toLowerCase().includes(qn)));
          if (!inds.length) return null;
          const areaPeople = persons.filter((r) => (areaInds[a.key] || []).some((ind) => covers(r, a.key, ind.id)));
          return (
            <Card key={a.key} style={{ padding: 0, overflow: 'visible' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--panel-2)', borderRadius: '12px 12px 0 0' }}>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>{a.name}</span>
                <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{inds.length} indicator{inds.length !== 1 ? 's' : ''} · {areaPeople.length} {areaPeople.length === 1 ? 'person' : 'people'}</span>
              </div>
              {inds.map((ind, i) => {
                const owners = persons.filter((r) => covers(r, a.key, ind.id));
                const open = menu && menu.area === a.key && menu.indId === ind.id;
                const mq = menuQ.trim().toLowerCase();
                const candidates = persons.filter((r) => !covers(r, a.key, ind.id) && (!mq || (r.name || '').toLowerCase().includes(mq) || (r.title || '').toLowerCase().includes(mq)));
                return (
                  <div key={ind.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 16px', borderBottom: i < inds.length - 1 ? '1px solid var(--line-2, var(--line))' : 0, background: owners.length === 0 ? 'rgba(224,138,30,.06)' : 'transparent' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', width: 300, flex: '0 1 auto' }}>{ind.name}</span>
                    <span style={{ flex: 1 }} />
                    {owners.length === 0 && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber, #e08a1e)' }}>No one assigned</span>}
                    {owners.map((r) => chip(r, a, ind))}
                    <span style={{ position: 'relative' }}>
                      <button className="btn sm" disabled={busy} onClick={() => { setMenu(open ? null : { area: a.key, indId: ind.id }); setMenuQ(''); }}><Ic d={I.plus} s={12} />Assign</button>
                      {open && (
                        <React.Fragment>
                          <div onClick={() => setMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                          <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 41, width: 280, background: '#fff', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 8px 24px rgba(20,32,46,.16)', padding: 8 }}>
                            <input autoFocus style={{ ...inputStyle, marginBottom: 6, fontSize: 12.5 }} value={menuQ} onChange={(e) => setMenuQ(e.target.value)} placeholder="Search people…" />
                            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                              {candidates.length === 0 && <div style={{ padding: 10, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>{persons.length ? 'Everyone matching already has access.' : 'No responsible persons yet.'}</div>}
                              {candidates.map((r) => (
                                <div key={r.id} onClick={() => give(r, a.key, ind)}
                                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 8, cursor: 'pointer', opacity: r.active === false ? 0.55 : 1 }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--blue-50)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--blue)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{initials(r.name)}</span>
                                  <span style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}{r.active === false ? ' (inactive)' : ''}</div>
                                    <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{hasArea(r, a.key) ? 'Adds this indicator to their list' : 'Grants ' + a.name + ' · only this indicator'}</div>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </React.Fragment>
                      )}
                    </span>
                  </div>
                );
              })}
            </Card>
          );
        })}
      </div>
    );
  }

  /* ============================ Responsible Persons ============================ */
  function DataResponsibles({ depts }) {
    const [list, setList] = useState(null);
    const [editing, setEditing] = useState(null); // the record being added/edited
    const [view, setView] = useState('people');   // 'people' | 'access' (indicator access matrix)
    const dataRev = useDcDataRev();
    const areas = useMemo(() => (window.qualityData ? window.qualityData() : []).map((d) => ({ key: d.key, name: d.name })), [dataRev]);
    const areaInds = useMemo(() => { const m = {}; (window.qualityData ? window.qualityData() : []).forEach((d) => { m[d.key] = (d.indicators || []).map((i) => ({ id: i.id, name: i.name })); }); return m; }, [dataRev]);
    const load = () => dcApi.get('/api/responsibles').then((r) => setList(r.ok ? r.responsibles : [])).catch(() => setList([]));
    useEffect(() => { load(); }, []);
    // Everyone (except the person being edited) who can report indicator `indId` of area `ak` —
    // powers the “who else is assigned” tooltips/badges on the editor's indicator pills.
    const assignedNames = (ak, indId, exceptId) => (list || [])
      .filter((r) => r.id !== exceptId && (!!r.allQualityAreas || (r.qualityAreas || []).includes(ak))
        && ((((r.qualityIndicators || {})[ak]) || []).length === 0 || (((r.qualityIndicators || {})[ak]) || []).includes(indId)))
      .map((r) => r.name);

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
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button className={'btn sm' + (view === 'people' ? ' pri' : '')} onClick={() => setView('people')}><Ic d={I.user} s={13} />People</button>
              <button className={'btn sm' + (view === 'access' ? ' pri' : '')} title="Department-wise: every indicator with the people assigned to it — give or remove access inline" onClick={() => { setView('access'); setEditing(null); }}><Ic d={I.check} s={13} />Indicator Access</button>
              {!editing && view === 'people' && <button className="btn pri sm" onClick={() => setEditing(blank())}><Ic d={I.plus} s={15} />Add person</button>}
            </div>
          } />

        {view === 'access' && (
          list === null ? <Card><div style={{ padding: 24, color: 'var(--muted)' }}>Loading…</div></Card>
            : <AccessMatrix persons={list} areas={areas} areaInds={areaInds} onChanged={load}
                onEditPerson={(r) => { setView('people'); setEditing({ ...blank(), ...r }); }} />
        )}

        {view === 'people' && editing && (
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
                            // who ELSE already reports this indicator — visible on hover + 👤n badge
                            const others = assignedNames(ak, ind.id, editing.id);
                            return <span key={ind.id} onClick={() => setSel(on ? sel.filter((x) => x !== ind.id) : [...sel, ind.id])}
                              title={others.length ? 'Also assigned to: ' + others.join(', ') : 'No one else is assigned to this indicator yet'}
                              style={{ cursor: 'pointer', userSelect: 'none', padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, border: '1px solid ' + (on ? 'var(--blue)' : 'var(--line)'), background: on ? 'var(--blue-50)' : '#fff', color: on ? 'var(--blue-700)' : 'var(--ink-2)' }}>
                              {ind.name}
                              {others.length > 0 && <span title={'Also assigned to: ' + others.join(', ')} style={{ marginLeft: 5, fontSize: 9.5, fontWeight: 700, borderRadius: 999, padding: '1px 6px', background: on ? 'var(--blue)' : 'var(--panel-2)', color: on ? '#fff' : 'var(--muted)', border: '1px solid ' + (on ? 'var(--blue)' : 'var(--line)') }}>👤{others.length}</span>}
                            </span>;
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

        {view === 'people' && <Card style={{ padding: 0, overflow: 'hidden' }}>
          {list === null ? <div style={{ padding: 24, color: 'var(--muted)' }}>Loading…</div>
            : list.length === 0 ? <div style={{ padding: 24, color: 'var(--muted)', textAlign: 'center' }}>No responsible persons yet. Click “Add person”.</div>
              : <table className="tbl" style={{ width: '100%' }}>
                <thead><tr><th>Name</th><th>Title</th><th>Login</th><th>Departments</th><th>Quality areas</th><th></th></tr></thead>
                <tbody>{list.map((r) => (
                  <tr key={r.id} onClick={() => setEditing({ ...blank(), ...r })} title="Tap to edit" style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td>{r.title || '—'}</td>
                    <td>{r.empId ? <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--blue-700)' }} title="Has a login account">🔑 {r.empId}</span> : <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                    <td>{(r.departments || []).map(deptName).join(', ') || '—'}</td>
                    <td>{r.allQualityAreas ? 'All areas (hospital-wide)' : ((r.qualityAreas || []).map((k) => window.DEPTMAP ? window.DEPTMAP.nameFromQualityKey(k) : k).join(', ') || '—')}</td>
                    <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="icon-btn" title="Edit" onClick={() => setEditing({ ...blank(), ...r })}><Ic d={I.edit} s={14} /></button>
                      <button className="icon-btn" title="Remove" style={{ color: 'var(--rose)' }} onClick={() => remove(r.id)}><Ic d={I.x} s={14} /></button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>}
        </Card>}
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
/* Per-person drafts for the monthly statistics form.

   Kept in localStorage rather than a server collection on purpose: a draft is a
   half-typed form, not a record. It belongs to one person on one machine, it must
   survive a closed tab, and it must never be visible to an administrator or count as
   a submission. Keyed by user + department + month so two wards, or two months of the
   same ward, cannot overwrite each other. */
  const DC_DRAFT_KEY = (who, dept, month) => 'unico_dc_draft_v1|' + (who || 'local') + '|' + dept + '|' + month;
  const dcDraftLoad = (k) => { try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } };
  const dcDraftSave = (k, v) => { try { localStorage.setItem(k, JSON.stringify({ values: v, at: Date.now() })); return true; } catch (e) { return false; } };
  const dcDraftClear = (k) => { try { localStorage.removeItem(k); } catch (e) { } };

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
    const [draftAt, setDraftAt] = useState(null);   // when the current draft was last saved

    useEffect(() => { dcApi.get('/api/responsibles').then((r) => setResps(r.ok ? r.responsibles : [])).catch(() => {}); }, []);
    useEffect(() => { dcApi.get('/api/submissions?limit=300').then((r) => setSubs(r.ok ? r.submissions : [])).catch(() => {}); }, [done]);
    const canReportDept = (r, id) => {
      if (!r || !id) return false;
      if ((r.departments || []).includes(id)) return true;
      if (r.allQualityAreas) return true;
      const areas = window.DEPTMAP ? window.DEPTMAP.areasFromDepts([id]) : [];
      return areas.some((ak) => (r.qualityAreas || []).includes(ak));
    };
    // when department changes, reset month/values + auto-fill the assigned responsible
    useEffect(() => {
      if (!dept) return;
      setMonth((m) => m || defaultMonthFor(dept));
      setValues({});
      if (!(prefill && prefill.responsible)) {
        const assigned = resps.filter((r) => canReportDept(r, dept.id));
        if (assigned.length) setResponsible(assigned[0].name);
      }
    }, [deptId, resps.length]);

    // Restore the draft for whichever department+month is now selected. Runs after the
    // reset effect above, so switching away and back brings the figures back rather
    // than silently discarding them.
    const draftKey = (dept && month) ? DC_DRAFT_KEY(me && (me.username || me.name), dept.id, month) : null;
    useEffect(() => {
      if (!draftKey) { setDraftAt(null); return; }
      const d = dcDraftLoad(draftKey);
      if (d && d.values && Object.keys(d.values).length) { setValues(d.values); setDraftAt(d.at || null); }
      else setDraftAt(null);
    }, [draftKey]);

    const assigned = resps.filter((r) => dept && canReportDept(r, dept.id));
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
    // A still-PENDING month is a hard block (correcting it would duplicate the pending row).
    // An already-recorded/approved month becomes a CORRECTION (edit request): it goes to the
    // admin and never overwrites live data until approved. (Rejected months may be re-sent.)
    const monthPending = lockResp && monthStatus[month] === 'pending';
    const pCorrection = lockResp && !monthPending && (monthStatus[month] === 'approved' || reported.has(month));
    const [reason, setReason] = useState(''); // correction reason (edit request)
    const cols = (dept && dept.cols) || [];
    const last = (dept && dept.data && dept.data.length) ? dept.data[dept.data.length - 1] : {};

    const [flash, setFlash] = useState(null); // 3s success popup
    const submit = () => {
      if (!dept) return;
      if (!month) { toast('Pick a month', 'error'); return; }
      if (monthPending) { toast('A submission for this month is already pending review.', 'error'); return; }
      if (pCorrection && !reason.trim()) { toast('Please add a reason for the correction.', 'error'); return; }
      const matched = resps.find((r) => r.name === responsible);
      setBusy(true); setDone(null);
      dcApi.post('/api/submissions/patient', {
        department: dept.id, month, values,
        responsible: lockResp ? { name: me.name } : (matched ? { id: matched.id, name: matched.name } : (responsible ? { name: responsible } : null)),
        note,
        isCorrection: pCorrection, correctionReason: pCorrection ? reason.trim() : '',
      }).then((r) => {
        setBusy(false);
        if (r.ok) { setDone({ month, dept: dept.name, correction: pCorrection }); setFlash({ ts: Date.now(), title: pCorrection ? 'Correction submitted!' : 'Data submitted successfully!', sub: dept.name + ' · ' + monthLabel(month) }); setValues({}); setNote(''); setReason(''); if (draftKey) { dcDraftClear(draftKey); setDraftAt(null); } toast(pCorrection ? 'Correction sent for review' : 'Submitted for review', 'success'); }
        else toast(r.error || 'Submission failed', 'error');
      }).catch((e) => { setBusy(false); toast('Submission failed', 'error'); });
    };

    return (
      <div className="grid" style={{ gap: 14, maxWidth: 760 }}>
        <SectionTitle icon={I.input} title="Submit Patient Statistics" sub="Fill in a department's monthly numbers — saved straight to the database and logged." />
        {flash && <DcSuccessPopup key={flash.ts} title={flash.title} sub={flash.sub} onClose={() => setFlash(null)} />}
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
            {cols.map((c) => {
              const prev = last[c.id];
              const now = values[c.id];
              // The administrator queries swings over 30% after the fact. Saying so here,
              // while the figure is still on screen, is the difference between a typo
              // caught in five seconds and a correction cycle three days later.
              const swing = (prev != null && prev !== '' && Number(prev) && now !== '' && now != null && !isNaN(Number(now)))
                ? Math.round(((Number(now) - Number(prev)) / Math.abs(Number(prev))) * 100) : null;
              const big = swing != null && Math.abs(swing) > 30;
              return (
                <Field key={c.id} label={c.label + (c.pct ? ' (%)' : '')}
                  hint={prev != null ? ('last month ' + prev) : 'nothing on record for last month'}>
                  <input type="number" step="any" style={{ ...inputStyle, ...(big ? { borderColor: '#e0a21e' } : {}) }} value={now == null ? '' : now}
                    placeholder={prev != null ? 'last: ' + prev : '0'}
                    onChange={(e) => setValues((v) => ({ ...v, [c.id]: e.target.value }))} />
                  {big && <div style={{ fontSize: 10.5, color: '#9a6b00', fontWeight: 600, marginTop: 3 }}>{swing > 0 ? '+' : ''}{swing}% vs last month — check before sending.</div>}
                </Field>
              );
            })}
          </div>
          {isAdmin && dept && <div style={{ border: '1px dashed var(--line)', borderRadius: 9, padding: '10px 12px', margin: '2px 0 12px', background: 'var(--panel-2)' }}><DeptFieldManager dept={dept} onChange={refreshDepts} /></div>}
          <Field label="Note (optional)"><input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any comment about this submission" /></Field>
          {pCorrection && (
            <>
              <Banner>{dept ? dept.name : ''} · {monthLabel(month)} is already recorded — submitting sends a <b>correction (edit request)</b> to an administrator. The recorded value won’t change until it is approved.</Banner>
              <Field label="Reason for the correction"><input style={inputStyle} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. wrong count entered — should be Y not X" /></Field>
            </>
          )}
          {monthPending && <Banner>{dept ? dept.name : ''} · {monthLabel(month)} already has a submission pending review — wait for the admin to approve or reject it before editing.</Banner>}
          <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn pri" disabled={busy || monthPending} onClick={submit}><Ic d={I.check} s={15} />{busy ? 'Submitting…' : (monthPending ? 'Pending review' : (pCorrection ? 'Submit correction for review' : 'Submit for review'))}</button>
            <button className="btn" disabled={busy || !draftKey} onClick={() => {
              if (!draftKey) return;
              if (dcDraftSave(draftKey, values)) { setDraftAt(Date.now()); toast('Draft saved on this device', 'success'); }
              else toast('Could not save the draft on this device.', 'error');
            }}><Ic d={I.doc} s={15} />Save draft</button>
            <button className="btn" disabled={busy} onClick={() => { setValues({}); setNote(''); setReason(''); setDone(null); if (draftKey) { dcDraftClear(draftKey); setDraftAt(null); } }}>Clear</button>
            {draftAt && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Draft saved {new Date(draftAt).toLocaleString()} — on this device only.</span>}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 10, lineHeight: 1.6 }}>
            Figures are checked against last month before approval. Swings over 30% are queried by the administrator.
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
    [/medication (administration )?error/, 'B1'], [/falls with injury/, 'C3'], [/patient fall/, 'C2'],
    [/pressure ulcer|hapu|bed sore|pressure injury/, 'C4'], [/deep vein thrombosis|\bdvt\b/, 'C6'],
    [/return to icu/, 'D6'], [/cardiac arrest survival/, 'D11'], [/cardiac arrest events|code blue/, 'D10'],
    [/partograph/, 'F1'], [/door-to-balloon/, 'G1'], [/post-pci/, 'G2'], [/puncture site hematoma/, 'G3'],
    [/dialysis adequacy|\burr\b/, 'H1'], [/water quality/, 'H3'], [/hypotension/, 'H4'],
    [/vascular access complication/, 'H5'], [/de-lining/, 'H6'], [/infection rate/, 'H7'],
    [/post-procedure complication/, 'J1'], [/training compliance/, 'L1'], [/surgical safety/, 'C8'], [/accidental removal of catheter/, 'L5'],
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

/* A benchmark is stored as the free text a clinician wrote on the paper form --
   "≤ 2.0", "< 1 per 1000 catheter-days", "≥ 90%", "0 (zero defect)". Rather than
   demand a migration, read it: take the first number and the comparison it carries.
   `goalDirection` on the indicator wins when it is set, because it is authoritative;
   the text only supplies the threshold. Returns null when there is nothing to read,
   and the caller then shows no verdict at all -- an unparsed benchmark must never be
   guessed into a pass. */
  function dcBenchmark(ind) {
    const raw = String((ind && ind.benchmark) || '').trim();
    if (!raw) return null;
    const m = raw.match(/-?\d+(?:\.\d+)?/);
    if (!m) return null;
    const value = parseFloat(m[0]);
    if (isNaN(value)) return null;
    let lowerIsBetter = true;
    if (ind && ind.goalDirection) lowerIsBetter = ind.goalDirection !== 'higher_is_better';
    else if (/≥|>=|>|\bat least\b|\bminimum\b|\bmin\b|\babove\b/i.test(raw)) lowerIsBetter = false;
    return { value: value, lowerIsBetter: lowerIsBetter, text: raw };
  }
  const dcMeets = (b, v) => (!b || v == null) ? null : (b.lowerIsBetter ? v <= b.value : v >= b.value);

  function DataQualityForm({ prefill }) {
    const dataRev = useDcDataRev();
    const areas = useMemo(() => (window.qualityData ? window.qualityData() : []), [dataRev]);
    const me = (typeof window !== 'undefined' && window.__UNICO_USER__) || null;
    const lockResp = !!(me && me.role === 'collector');
    // Months = the quality FY (Jun-25…May-26), read from the store so it stays in
    // sync with the dashboard/quarters; default to the latest FY month.
    const fyMonths = (window.QUALITY_QUARTER_MONTHS) ? ['Q1', 'Q2', 'Q3', 'Q4'].reduce((a, q) => a.concat(window.QUALITY_QUARTER_MONTHS[q] || []), []) : null;
    const monthOpts = dcWideMonths();
    const defMonth = dcDefaultMonth() || ((fyMonths && fyMonths.length) ? fyMonths[fyMonths.length - 1] : monthOpts[monthOpts.length - 1]) || '';
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
    const [flash, setFlash] = useState(null); // 3s success popup
    const [guideOpen, setGuideOpen] = useState(false); // HQI guide collapsed by default (click "Show" to expand)
    const [resps, setResps] = useState([]);
    useEffect(() => { if (!lockResp) dcApi.get('/api/responsibles').then((r) => setResps(r.ok ? r.responsibles : [])).catch(() => {}); }, []);
    // Reset the indicator when the AREA changes — but skip the first run so a jumped-in
    // prefill (area + indicator) from the Submission-status board isn't cleared on mount.
    const firstAreaRef = React.useRef(true);
    useEffect(() => { if (firstAreaRef.current) { firstAreaRef.current = false; return; } setIndId(''); }, [areaKey]);

    const canReportArea = (r, ak) => {
      if (!r || !ak) return false;
      if (r.allQualityAreas) return true;
      if ((r.qualityAreas || []).includes(ak)) return true;
      return (window.DEPTMAP ? window.DEPTMAP.areasFromDepts(r.departments || []) : []).includes(ak);
    };
    const inds = (area && area.indicators) || [];
    const assigned = resps.filter((r) => canReportArea(r, areaKey));
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
    const formula = (declared === 'rate1000' || declared === 'rate100' || declared === 'pct' || declared === 'count' || declared === 'avg') ? declared
      : per1000 ? 'rate1000' : per100 ? 'rate100' : pctText ? 'pct' : (declared || 'count');
    // 'avg' (mean = numerator ÷ denominator, e.g. average length of stay) is captured like a
    // rate — collector enters both numerator and denominator — but with no multiplier (×1).
    const isRate = formula === 'rate1000' || formula === 'rate100' || formula === 'pct' || formula === 'avg';
    const mult = formula === 'rate1000' ? 1000 : formula === 'avg' ? 1 : (formula === 'rate100' || formula === 'pct') ? 100 : 1000;
    const vt = def.valueType || (formula === 'pct' ? '%' : isRate ? 'Rate' : 'Count');
    // parse the denominator's unit out of the benchmark, e.g. "per 1,000 discharges" -> "Discharges"
    const denMatch = rateProbe.match(/per\s*1[.,\s]?0{2,3}\s+([a-z][a-z\- ]{1,28})/) || rateProbe.match(/per\s*100\s+([a-z][a-z\- ]{1,28})/);
    const denGuess = denMatch ? denMatch[1].trim().replace(/\b\w/g, (c) => c.toUpperCase()) : '';
    const numLabel = def.numLabel || (isRate ? 'Cases (incidents)' : 'Numerator');
    const denLabel = def.denLabel || denGuess || 'Denominator';
    // Some denominators are a hospital-wide figure the ADMIN owns (e.g. NSI's "Total
    // healthcare workers"): data collectors see it read-only and enter only the numerator.
    const denAdminOnly = !!def.denAdminOnly;
    const denLockedForCollector = denAdminOnly && lockResp;
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
    // 'avg' (a continuous mean like average length of stay) is NOT an adverse-event log,
    // even though it is lower-is-better — so it must never fall into the incident register.
    const isIncidentType = !isHandHygiene && def.formula !== 'avg' && (def.goalDirection ? def.goalDirection !== 'higher_is_better' : true);
    // NSI (needle-stick injury) logs BOTH the source patient AND the injured staff member
    // (victim) + their employee id — enabled per-indicator via the `victimField` flag.
    const victimField = !!def.victimField;
    const blankIncident = () => ({ patientName: '', uhid: '', age: '', gender: '', diagnosis: '', incidentDate: '', admissionDate: '', victimName: '', victimId: '', details: '', finding: '', corrective: '', preventive: '', remark: '' });
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
    const rateUnit = (unitRaw && /per|%/.test(unitRaw)) ? unitRaw : (formula === 'pct' ? '%' : formula === 'avg' ? (unitRaw || 'average') : ('per ' + mult + (denGuess ? ' ' + denGuess.toLowerCase() : '')));
    const unitQ = computeAsRate ? rateUnit : (unitRaw || 'count');
    const formulaTextQ = formula === 'avg'
      ? (indNameQ + ' = ' + numLabel + ' ÷ ' + denLabel + (unitRaw ? ' (' + unitRaw + ')' : ''))
      : computeAsRate
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
        // Hand Hygiene with no data for THIS month → open the all-departments gateway
        // PRE-LISTED with every department. We seed the rows right here (not only via the
        // sync effect) because when you switch from a month that HAS data to an empty month,
        // numMode is already 'dept', so that effect's deps don't change and it never re-fires
        // — which left the grid blank (0/0, no departments) for every non-current month.
        setDeptRows((isHandHygiene && hhDepartments.length) ? hhDepartments.map((n) => ({ ...blankDeptRow(), dept: n })) : []);
        setGroups(blankG); setGroupsDen(blankG); setDirectNum(''); setNumMode('dept');
      }
      // Admin-set denominators (e.g. NSI's total healthcare workers) carry forward the last
      // value recorded for ANY month, so the figure is always shown even in a fresh month.
      const denThisMonth = (curInd.mDen && curInd.mDen[month] != null && curInd.mDen[month] !== '') ? curInd.mDen[month] : null;
      const denCarry = (denAdminOnly && denThisMonth == null && curInd.mDen)
        ? Object.keys(curInd.mDen).map((k) => curInd.mDen[k]).filter((v) => v != null && v !== '').pop()
        : null;
      setDen(denThisMonth != null ? String(denThisMonth) : (denCarry != null ? String(denCarry) : ''));
      const cp = curInd.capa && curInd.capa[month];
      setCapa(cp && typeof cp === 'object' ? { finding: cp.finding || '', corrective: cp.corrective || '', preventive: cp.preventive || '' } : { finding: '', corrective: '', preventive: '' });
      // Load any incident reports already recorded for this indicator × month.
      const incs = (curInd.incidents && Array.isArray(curInd.incidents[month])) ? curInd.incidents[month] : [];
      setIncidents(incs.map((x) => ({ patientName: x.patientName || '', uhid: x.uhid || '', age: x.age || '', gender: x.gender || '', diagnosis: x.diagnosis || '', incidentDate: x.incidentDate || '', admissionDate: x.admissionDate || '', victimName: x.victimName || '', victimId: x.victimId || '', details: x.details || '', finding: x.finding || '', corrective: x.corrective || '', preventive: x.preventive || '', remark: x.remark || '' })));
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
    const [qReason, setQReason] = useState(''); // correction reason (quality edit request)
    const submit = () => {
      if (!area) { toast('Select an area', 'error'); return; }
      if (!indId) { toast('Select an indicator', 'error'); return; }
      if (isNew && !newInd.name.trim()) { toast('Enter the new indicator name', 'error'); return; }
      if (!month) { toast('Pick a month', 'error'); return; }
      if (qCorrection && !qReason.trim()) { toast('Please add a reason for the correction.', 'error'); return; }
      if (isRate && !denLockedForCollector && !(denNum > 0)) {
        // Zero-exposure month (e.g. "no surgical discharges"): 0 events over an EXPLICIT 0
        // denominator is a legitimate report — only refuse when events exist without a base,
        // or the denominator was left blank (a deliberate 0 must be typed).
        const explicitZero = !(Number(numerator) > 0) && String(den == null ? '' : den).trim() !== '' && Number(den) === 0;
        if (!explicitZero) { toast('Enter ' + denLabel + ' (denominator)' + (numMode === 'group' ? ' for at least one group' : numMode === 'dept' ? ' for at least one department' : ' — type 0 if there were none this month'), 'error'); return; }
      }
      const matched = resps.find((r) => r.name === responsible);
      setBusy(true); setDone(null);
      dcApi.post('/api/submissions/quality', {
        area: area.key, month, isCorrection: qCorrection, correctionReason: qCorrection ? qReason.trim() : '',
        indicatorId: isNew ? '' : indId,
        indicatorName: isNew ? newInd.name : (curInd && curInd.name),
        valueType: computeAsRate ? (formula === 'pct' ? '%' : 'Rate') : 'Count', entryMode: computeAsRate ? 'rate' : 'count', mult,
        formula: computeAsRate ? (isRate ? formula : 'rate1000') : 'count',
        numLabel: computeAsRate ? numLabel : undefined, denLabel: computeAsRate ? denLabel : undefined, unit: unitQ,
        value: computeAsRate ? undefined : numerator, num: computeAsRate ? numerator : undefined, den: computeAsRate ? (denLockedForCollector ? undefined : denNum) : undefined,
        groups: numMode === 'group' ? GROUP_KEYS.reduce((o, [k]) => (o[k] = Number(groups[k]) || 0, o), {}) : undefined,
        groupsDen: (numMode === 'group' && computeAsRate) ? GROUP_KEYS.reduce((o, [k]) => (o[k] = Number(groupsDen[k]) || 0, o), {}) : undefined,
        deptBreakdown: numMode === 'dept' ? deptRows.map((r) => ({ dept: r.dept || '', g: GROUP_KEYS.reduce((o, [k]) => (o[k] = { n: Number(r.g[k].n) || 0, d: Number(r.g[k].d) || 0 }, o), {}) })) : undefined,
        capa: (capa.finding || capa.corrective || capa.preventive) ? { finding: capa.finding, corrective: capa.corrective, preventive: capa.preventive } : undefined,
        // Per-incident reports (only those with something filled in). The server stores
        // them on the indicator's month; the count above already reflects how many.
        incidents: incidents.length ? incidents.map((x) => ({ patientName: x.patientName, uhid: x.uhid, age: x.age, gender: x.gender, diagnosis: x.diagnosis, incidentDate: x.incidentDate, admissionDate: x.admissionDate, victimName: x.victimName, victimId: x.victimId, details: x.details, finding: x.finding, corrective: x.corrective, preventive: x.preventive, remark: x.remark })) : undefined,
        remark,
        responsible: lockResp ? { name: me.name } : (matched ? { id: matched.id, name: matched.name } : (responsible ? { name: responsible } : null)),
      }).then((r) => {
        setBusy(false);
        if (r.ok) { setDone({ area: area.name, month }); setFlash({ ts: Date.now(), title: qCorrection ? 'Correction submitted!' : 'Data submitted successfully!', sub: area.name + ' · ' + ((curInd && curInd.name) || (isNew && newInd.name) || 'Quality data') + ' · ' + monthLabel(month) }); setGroups({ nurse: '', doctor: '', pca: '', other: '' }); setGroupsDen({ nurse: '', doctor: '', pca: '', other: '' }); setDeptRows([]); setDirectNum(''); setCapa({ finding: '', corrective: '', preventive: '' }); setIncidents([]); setDen(''); setRemark(''); if (isNew) { setIndId(''); setNewInd({ name: '', formula: 'count', numLabel: '', denLabel: '', unit: '' }); } toast('Saved monthly value', 'success'); }
        else toast(r.error || 'Submission failed', 'error');
      }).catch(() => { setBusy(false); toast('Submission failed', 'error'); });
    };

    const showEntry = (indId && !isNew) || (isNew && newInd.name);
    return (
      <div className="grid" style={{ gap: 14, maxWidth: 760 }}>
        <SectionTitle icon={I.activity} title="Submit Quality Data" sub="Enter the month's value — by staff group (Nurse / Doctor / PCA / Other) or directly — the count / rate is calculated automatically." />
        {flash && <DcSuccessPopup key={flash.ts} title={flash.title} sub={flash.sub} onClose={() => setFlash(null)} />}
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
                {(def.name || newInd.name) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 7, paddingBottom: 7, borderBottom: '1px solid var(--blue-100,#cfe6f7)' }}>
                    <span style={{ fontSize: 9.5, fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: .5, background: '#dbeafe', borderRadius: 20, padding: '2px 8px' }}>Quality indicator</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#0f2a5a' }}>{indNameQ}</span>
                    {benchmarkQ && <span style={{ fontSize: 11, fontWeight: 700, color: '#0b6aa2', background: '#fff', border: '1px solid #cfe6f7', borderRadius: 20, padding: '2px 9px' }}>Benchmark {benchmarkQ}</span>}
                    {!ratePending && <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 800, color: 'var(--blue-700)' }}>= {result}{rateUnit ? ' ' + rateUnit : ''}</span>}
                  </div>
                )}
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
                  label={<span>{denLabel} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{denLockedForCollector ? '(set by administrator)' : denAdminOnly ? '(admin-set — applies to all months)' : isRate ? '(denominator — required)' : '(denominator — optional, for a rate)'}</span></span>}
                  hint={denLockedForCollector ? (denLabel + ' is maintained by the administrator — you enter only the numerator above.') : (isRate ? denDef : ('Leave blank to record a plain count. Enter the base for ' + monthLabel(month) + ' (e.g. total procedures / discharges / patient-days) to compute a rate per ' + mult + '.'))}>
                  <input type="number" step="any" readOnly={denLockedForCollector} style={{ ...inputStyle, ...(denLockedForCollector ? { background: 'var(--panel-2)', color: 'var(--ink-2)', cursor: 'not-allowed' } : {}) }} value={den} onChange={(e) => { if (!denLockedForCollector) setDen(e.target.value); }} placeholder={denLockedForCollector ? 'Set by administrator' : (isRate ? ('Total ' + denLabel.toLowerCase() + ' this month') : 'Optional — total base (blank = count)')} />
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
                        <Field label="Date of incident"><input type="date" style={inputStyle} value={x.incidentDate} onChange={(e) => setIncidentField(i, 'incidentDate', e.target.value)} /></Field>
                        <Field label="Admission date"><input type="date" style={inputStyle} value={x.admissionDate} onChange={(e) => setIncidentField(i, 'admissionDate', e.target.value)} /></Field>
                        <Field label="Diagnosis"><input style={inputStyle} value={x.diagnosis} onChange={(e) => setIncidentField(i, 'diagnosis', e.target.value)} placeholder="Diagnosis" /></Field>
                      </div>
                      {victimField && (
                        <div style={{ marginBottom: 4, padding: '9px 11px', borderRadius: 8, background: 'var(--warn-bg,#fff4e0)', border: '1px solid #f0d9a8' }}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9a6b00', textTransform: 'uppercase', letterSpacing: .3, marginBottom: 6 }}>Injured staff member (victim)</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <Field label="Victim name (staff)"><input style={inputStyle} value={x.victimName} onChange={(e) => setIncidentField(i, 'victimName', e.target.value)} placeholder="Employee name" /></Field>
                            <Field label="Victim emp ID / UHID"><input style={inputStyle} value={x.victimId} onChange={(e) => setIncidentField(i, 'victimId', e.target.value)} placeholder="Emp ID / UHID" /></Field>
                          </div>
                        </div>
                      )}
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
                  label={<span>{denLabel} <span style={{ color: (isRate && !(denNum > 0) && !denLockedForCollector) ? 'var(--rose)' : 'var(--muted)', fontWeight: isRate ? 700 : 400 }}>{denLockedForCollector ? '(set by administrator)' : denAdminOnly ? '(admin-set — applies to all months)' : isRate ? '(denominator — required to compute the rate)' : '(denominator — optional, for a rate)'}</span></span>}
                  hint={denLockedForCollector ? (denLabel + ' is maintained by the administrator — you enter only the number of cases above.') : (isRate ? denDef : ('Leave blank to record a plain count of incidents. Enter the base for ' + monthLabel(month) + ' (e.g. total patient-days) to compute a rate per ' + mult + '.'))}>
                  <input type="number" step="any" readOnly={denLockedForCollector} style={{ ...inputStyle, ...(denLockedForCollector ? { background: 'var(--panel-2)', color: 'var(--ink-2)', cursor: 'not-allowed' } : (isRate && !(denNum > 0) ? { borderColor: 'var(--rose)' } : {})) }} value={den} onChange={(e) => { if (!denLockedForCollector) setDen(e.target.value); }} placeholder={denLockedForCollector ? 'Set by administrator' : (isRate ? ('Total ' + denLabel.toLowerCase() + ' this month') : 'Optional — total base (blank = count)')} />
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
              {(() => {
                const bench = dcBenchmark(curInd);
                const val = ratePending ? null : Number(result);
                const meets = dcMeets(bench, val);
                // The indicator's own recorded history, newest last. A month with no
                // reading is left out rather than plotted as zero -- a gap in reporting
                // is not a month of perfect performance.
                const order = MO();
                const mi = Math.max(0, order.indexOf(month));
                const win = order.slice(Math.max(0, mi - 5), mi);
                const hist = win.map((m) => {
                  const g = (o) => (o && o[m] != null && o[m] !== '' && !isNaN(Number(o[m]))) ? Number(o[m]) : null;
                  const v = curInd ? (g(curInd.months) == null ? g(curInd.mNum) : g(curInd.months)) : null;
                  return { m: m, v: v };
                });
                const known = hist.filter((h) => h.v != null);
                const prev = known.length ? known[known.length - 1] : null;
                // Two things worth stopping a nurse for: an identical repeat (usually a
                // copy-paste of last month) and a swing large enough to be a typo.
                const dup = prev && val != null && prev.v === val;
                const swing = (prev && val != null && prev.v) ? Math.round(((val - prev.v) / Math.abs(prev.v)) * 100) : null;
                const anomaly = swing != null && Math.abs(swing) > 40;
                const scale = Math.max.apply(null, [1].concat(known.map((h) => h.v)).concat(bench ? [bench.value] : []).concat(val != null ? [val] : []));
                if (!curInd) return null;
                return (
                  <React.Fragment>
                    {bench && meets !== null && (
                      <div style={{ marginTop: 11, border: '1px solid ' + (meets ? '#bfe5cf' : '#f1c6cd'), background: meets ? 'rgba(31,157,87,.08)' : 'rgba(210,58,82,.08)', borderRadius: 9, padding: '11px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: meets ? 'var(--pos)' : 'var(--rose)' }}>
                            {meets ? 'Within benchmark' : 'Outside benchmark'} ({bench.text})
                          </span>
                          <span style={{ flex: 1 }} />
                          {!meets && <span style={{ fontSize: 11, color: 'var(--rose)', fontWeight: 600 }}>A remark is expected when a month is off benchmark.</span>}
                        </div>
                        <div style={{ position: 'relative', height: 8, borderRadius: 5, background: 'rgba(125,145,180,.18)', marginTop: 10 }}>
                          <div style={{ width: Math.max(2, Math.min(100, (val / scale) * 100)) + '%', height: '100%', borderRadius: 5, background: meets ? 'var(--pos)' : 'var(--rose)' }} />
                          <span title={'Benchmark ' + bench.text} style={{ position: 'absolute', top: -3, left: Math.max(0, Math.min(100, (bench.value / scale) * 100)) + '%', width: 2, height: 14, background: '#16202e', opacity: .55 }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'var(--muted)', fontFamily: 'var(--mono)', marginTop: 3 }}>
                          <span>0</span><span>{Math.round(scale * 100) / 100}</span>
                        </div>
                      </div>
                    )}
                    {(dup || anomaly) && (
                      <div style={{ marginTop: 11, border: '1px solid #f0d9a8', background: 'var(--warn-bg,#fff4e0)', borderRadius: 9, padding: '11px 14px', fontSize: 12, color: '#9a6b00', lineHeight: 1.55 }}>
                        {dup
                          ? <span><b>Possible duplicate.</b> This is identical to {monthLabel(prev.m)} ({prev.v}). Check you are not re-entering last month\u2019s figure.</span>
                          : <span><b>Anomaly \u2014 {swing > 0 ? '+' : ''}{swing}% swing.</b> {monthLabel(prev.m)} was {prev.v}. If that is right, say why in the remark.</span>}
                      </div>
                    )}
                    {known.length > 0 && (
                      <div style={{ marginTop: 11, border: '1px solid var(--line)', borderRadius: 9, padding: '12px 14px' }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 10 }}>Last {known.length} month{known.length === 1 ? '' : 's'}</div>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 8, height: 74 }}>
                          {bench && <div title={'Benchmark ' + bench.text} style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(0, Math.min(70, (bench.value / scale) * 70)), borderTop: '1px dashed rgba(22,32,46,.4)' }} />}
                          {hist.map((h) => (
                            <div key={h.m} style={{ flex: 1, minWidth: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                              <span className="num" style={{ fontSize: 10, color: 'var(--muted)' }}>{h.v == null ? '' : h.v}</span>
                              {h.v == null
                                ? <div title="Nothing recorded" style={{ width: '100%', height: 4, borderRadius: 3, background: 'rgba(125,145,180,.2)' }} />
                                : <div style={{ width: '100%', height: Math.max(4, (h.v / scale) * 56), borderRadius: '4px 4px 0 0', background: dcMeets(bench, h.v) === false ? 'var(--rose)' : 'var(--blue)' }} />}
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 5 }}>
                          {hist.map((h) => <span key={h.m} style={{ flex: 1, minWidth: 22, textAlign: 'center', fontSize: 9.5, color: 'var(--faint)', fontFamily: 'var(--mono)' }}>{h.m}</span>)}
                        </div>
                        {known.length < hist.length && (
                          <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 7 }}>{hist.length - known.length} of the last {hist.length} months has no reading on record.</div>
                        )}
                      </div>
                    )}
                  </React.Fragment>
                );
              })()}
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
          {qCorrection && <Field label="Reason for the correction"><input style={inputStyle} value={qReason} onChange={(e) => setQReason(e.target.value)} placeholder="e.g. wrong denominator — should be Y not X" /></Field>}
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
  // Map a patient submission's raw column keys -> the department's human labels
  // (falls back to a prettified key when a column no longer exists).
  const prettyKey = (k) => String(k || '').replace(/^c_/, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  function colLabelMap(s) {
    if (s.type !== 'patient') return {};
    const dept = dcAllDepts().find((d) => d.id === s.department);
    const m = {}; ((dept && dept.cols) || []).forEach((c) => { m[c.id] = c.label || prettyKey(c.id); });
    return m;
  }
  function valuesSummary(s) {
    if (s.type === 'quality') return (s.indicatorName || '') + ' · ' + monthLabel(s.month) + (s.value != null ? ' = ' + s.value : '') + (s.remark ? ' (' + s.remark + ')' : '');
    const v = s.values || {}; const lm = colLabelMap(s);
    const parts = Object.keys(v).map((k) => (lm[k] || prettyKey(k)) + ': ' + v[k]);
    return monthLabel(s.month) + ' — ' + (parts.length ? parts.join(', ') : '(no values)');
  }
  // Table-cell version of valuesSummary with the key facts HIGHLIGHTED for fast
  // scanning: the reporting month gets an amber chip, the submitted value is bold.
  const dcMonthChip = (m) => <span style={{ background: '#fff4e0', color: '#9a6b00', fontWeight: 700, padding: '1px 7px', borderRadius: 6, whiteSpace: 'nowrap' }}>{monthLabel(m)}</span>;
  function valuesSummaryEl(s) {
    if (s.type === 'quality') return <>{(s.indicatorName || '') + ' · '}{dcMonthChip(s.month)}{s.value != null && <> = <b style={{ color: 'var(--ink)' }}>{s.value}</b></>}{s.remark ? ' (' + s.remark + ')' : ''}</>;
    const v = s.values || {}; const lm = colLabelMap(s);
    const keys = Object.keys(v);
    return <>{dcMonthChip(s.month)}{' — '}{keys.length
      ? keys.map((k, i) => <span key={k}>{i ? ', ' : ''}<span style={{ color: 'var(--muted)' }}>{lm[k] || prettyKey(k)}:</span> <b style={{ color: 'var(--ink)' }}>{v[k]}</b></span>)
      : '(no values)'}</>;
  }
  // Full submission viewer. Admins can correct a PENDING submission's values
  // (PATCH /api/submissions/:id) before approving; collectors see it read-only.
  function SubmissionDetail({ s, canEdit, fullEdit = true, onClose, onSaved }) {
    const meUser = (typeof window !== 'undefined' && window.__UNICO_USER__) || {};
    const iOwn = [meUser.name, meUser.username].filter(Boolean).some((n) => n === s.submittedBy || (s.responsible && s.responsible.name === n));
    // A collector may REQUEST an edit (correction) on their OWN already-recorded submission.
    const canRequestEdit = !fullEdit && iOwn && s.status !== 'pending' && !s.isCorrection;
    const [correcting, setCorrecting] = useState(false);
    const [correctReason, setCorrectReason] = useState('');
    // Admins (fullEdit) edit any submission at any time (approved edits re-apply to live data);
    // collectors edit their OWN pending record directly, or REQUEST an edit on a recorded one.
    const editable = (canEdit && (fullEdit || s.status === 'pending')) || correcting;
    const dept = s.type === 'patient' ? (dcAllDepts().find((d) => d.id === s.department)) : null;
    const cols = (dept && dept.cols) || (s.values ? Object.keys(s.values).map((id) => ({ id, label: id })) : []);
    const pctOf = {}; ((dept && dept.cols) || []).forEach((c) => { pctOf[c.id] = !!c.pct; });
    const [vals, setVals] = useState(() => Object.assign({}, s.values || {}));
    const [qval, setQval] = useState(s.value == null ? '' : s.value);
    // Rate/% indicators store a numerator + denominator; show/edit those too (the "full data").
    const isRate = s.type === 'quality' && (s.entryMode === 'rate' || s.formula === 'rate1000' || s.formula === 'pct' || s.num != null || s.den != null);
    const [qnum, setQnum] = useState(s.num == null ? '' : s.num);
    const [qden, setQden] = useState(s.den == null ? '' : s.den);
    const rateMult = Number(s.mult) || (s.formula === 'rate1000' ? 1000 : 100);
    // Hand-hygiene-style submissions carry a FULL breakdown: department × staff-group numerator/
    // denominator (deptBreakdown). Show & edit the whole thing; num/den/value derive from it.
    const GROUPS = [['nurse', 'Nurse'], ['doctor', 'Doctor'], ['pca', 'PCA'], ['other', 'Other']];
    const [deptBreak, setDeptBreak] = useState(() => (Array.isArray(s.deptBreakdown) && s.deptBreakdown.length)
      ? s.deptBreakdown.map((r) => ({ dept: r.dept, g: GROUPS.reduce((o, [k]) => (o[k] = { n: (r.g && r.g[k] && r.g[k].n != null) ? r.g[k].n : '', d: (r.g && r.g[k] && r.g[k].d != null) ? r.g[k].d : '' }, o), {}) }))
      : null);
    const hasDeptBreak = !!(deptBreak && deptBreak.length);
    const setBreakCell = (i, k, f, v) => setDeptBreak((a) => a.map((r, j) => (j === i ? { ...r, g: { ...r.g, [k]: { ...r.g[k], [f]: v } } } : r)));
    const breakTot = hasDeptBreak ? deptBreak.reduce((acc, r) => { GROUPS.forEach(([k]) => { acc.n += Number(r.g[k].n) || 0; acc.d += Number(r.g[k].d) || 0; }); return acc; }, { n: 0, d: 0 }) : null;
    // Staff-group-only breakdown (no per-department matrix): groups{}/groupsDen{} — any collector.
    const [grp, setGrp] = useState(() => (!(Array.isArray(s.deptBreakdown) && s.deptBreakdown.length) && s.groups && typeof s.groups === 'object')
      ? GROUPS.reduce((o, [k]) => (o[k] = { n: (s.groups[k] != null ? s.groups[k] : ''), d: (s.groupsDen && s.groupsDen[k] != null ? s.groupsDen[k] : '') }, o), {})
      : null);
    const hasGrp = !!grp;
    const setGrpCell = (k, f, v) => setGrp((g) => ({ ...g, [k]: { ...g[k], [f]: v } }));
    const grpTot = hasGrp ? GROUPS.reduce((acc, [k]) => { acc.n += Number(grp[k].n) || 0; acc.d += Number(grp[k].d) || 0; return acc; }, { n: 0, d: 0 }) : null;
    const effNum = hasDeptBreak ? breakTot.n : (hasGrp ? grpTot.n : qnum);
    const effDen = hasDeptBreak ? breakTot.d : (hasGrp ? grpTot.d : qden);
    const shownVal = isRate ? (Number(effDen) > 0 ? Math.round((Number(effNum) / Number(effDen)) * rateMult * 100) / 100 : 0) : qval;
    const [remark, setRemark] = useState(s.remark || '');
    const [note, setNote] = useState(s.note || '');
    const [busy, setBusy] = useState(false);
    // Admin can also fix the MONTH, RE-ASSIGN the department/area, and edit incident details.
    const [month, setMonth] = useState(s.month || '');
    const [target, setTarget] = useState(s.type === 'patient' ? (s.department || '') : (s.area || ''));
    const [incidents, setIncidents] = useState(() => (s.type === 'quality' && Array.isArray(s.incidents)) ? s.incidents.map((x) => Object.assign({}, x)) : []);
    const monthOpts = (function () {
      // Wide reporting-month range (2024 → 2032) for both types, so an admin can move a
      // submission to any month up to 2030+. Always include the submission's ACTUAL month too.
      const base = dcWideMonths();
      return (s.month && base.indexOf(s.month) < 0) ? [s.month].concat(base) : (base.length ? base : [s.month]);
    })();
    const areaOptsRev = useDcDataRev();
    const areaOpts = React.useMemo(() => (window.qualityData ? window.qualityData() : []).map((d) => ({ key: d.key, name: d.name })), [areaOptsRev]);
    const deptOpts = React.useMemo(() => dcAllDepts(), []);
    const setInc = (i, k, v) => setIncidents((a) => a.map((x, j) => (j === i ? Object.assign({}, x, { [k]: v }) : x)));
    const INC_FIELDS = [['uhid', 'UHID'], ['patientName', 'Patient name'], ['diagnosis', 'Diagnosis'], ['details', 'What happened'], ['finding', 'Root cause / finding'], ['corrective', 'Corrective action'], ['preventive', 'Preventive action']];
    const when = (ts) => { try { return ts ? new Date(ts).toLocaleString() : '—'; } catch (e) { return '—'; } };
    const Meta = ({ label, value }) => (
      <div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</div><div style={{ fontWeight: 600, color: 'var(--ink)' }}>{value}</div></div>
    );
    const buildBody = () => {
      const body = { note, month };
      if (s.type === 'patient') { body.values = vals; if (target && target !== s.department) { body.department = target; body.departmentName = (deptOpts.find((d) => d.id === target) || {}).name || target; } }
      else {
        body.value = isRate ? shownVal : qval; body.remark = remark;
        if (isRate) { body.num = effNum; body.den = effDen; }        // totals derive from the breakdown
        if (hasDeptBreak) body.deptBreakdown = deptBreak;
        if (hasGrp) { body.groups = GROUPS.reduce((o, [k]) => (o[k] = Number(grp[k].n) || 0, o), {}); body.groupsDen = GROUPS.reduce((o, [k]) => (o[k] = Number(grp[k].d) || 0, o), {}); }
        if (target && target !== s.area) { body.area = target; body.areaName = (areaOpts.find((a) => a.key === target) || {}).name || target; }
        if (incidents.length || (Array.isArray(s.incidents) && s.incidents.length)) body.incidents = incidents;
      }
      return body;
    };
    const save = () => {
      setBusy(true);
      dcApi.patch('/api/submissions/' + encodeURIComponent(s.id), buildBody()).then((r) => {
        setBusy(false);
        if (r.ok) {
          toast('Submission updated', 'success');
          // An approved submission's edit was re-applied to live data on the server.
          if (r.submission && r.submission.status === 'approved') dcRefreshLive();
          onSaved && onSaved(r.submission);
        }
        else toast(r.error || 'Could not save', 'error');
      }).catch(() => { setBusy(false); toast('Could not save', 'error'); });
    };
    // Admin: approve straight from the detail modal. Any on-screen edits are saved first
    // (so approve applies exactly what's shown), then the submission is applied to live data.
    const approveNow = () => {
      setBusy(true);
      const url = '/api/submissions/' + encodeURIComponent(s.id);
      const finish = (r) => { setBusy(false); if (r && r.ok) { const ar = r.autoRejected || 0; toast('Approved & applied to live data' + (ar ? ' · ' + ar + ' duplicate' + (ar !== 1 ? 's' : '') + ' auto-rejected' : ''), 'success'); dcRefreshLive(); onSaved && onSaved(r.submission || r); } else toast((r && r.error) || 'Could not approve', 'error'); };
      const fail = () => { setBusy(false); toast('Could not approve', 'error'); };
      const doApprove = () => dcApi.post(url + '/approve', {}).then(finish).catch(fail);
      if (editable && !correcting) dcApi.patch(url, buildBody()).then(doApprove).catch(fail); else doApprove();
    };
    // Collector edit request -> create a NEW pending correction (never touches live data directly).
    const submitCorrection = () => {
      if (!correctReason.trim()) { toast('Please add a reason for the edit request.', 'error'); return; }
      setBusy(true);
      const common = { month, note, isCorrection: true, correctionReason: correctReason.trim() };
      let url, body;
      if (s.type === 'patient') {
        url = '/api/submissions/patient';
        body = Object.assign({ department: s.department, values: vals, responsible: s.responsible || null }, common);
      } else {
        url = '/api/submissions/quality';
        body = Object.assign({
          area: s.area, indicatorId: s.indicatorId || '', indicatorName: s.indicatorName,
          valueType: s.valueType, entryMode: s.entryMode, mult: s.mult, formula: s.formula,
          numLabel: s.numLabel, denLabel: s.denLabel, unit: s.unit,
          value: isRate ? undefined : (qval === '' ? undefined : Number(qval)),
          num: isRate ? Number(effNum) : undefined, den: isRate ? Number(effDen) : undefined,
          groups: hasGrp ? GROUPS.reduce((o, [k]) => (o[k] = Number(grp[k].n) || 0, o), {}) : undefined,
          groupsDen: (hasGrp && isRate) ? GROUPS.reduce((o, [k]) => (o[k] = Number(grp[k].d) || 0, o), {}) : undefined,
          deptBreakdown: hasDeptBreak ? deptBreak.map((r) => ({ dept: r.dept || '', g: GROUPS.reduce((o, [k]) => (o[k] = { n: Number(r.g[k].n) || 0, d: Number(r.g[k].d) || 0 }, o), {}) })) : undefined,
          incidents: incidents.length ? incidents : undefined,
        }, common);
      }
      dcApi.post(url, body).then((r) => {
        setBusy(false);
        if (r.ok) { toast('Edit request sent for review', 'success'); onSaved && onSaved(); }
        else toast(r.error || 'Could not send edit request', 'error');
      }).catch(() => { setBusy(false); toast('Could not send edit request', 'error'); });
    };
    return (
      <div onMouseDown={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(16,32,46,.42)', zIndex: 400, display: 'grid', placeItems: 'center', padding: 'clamp(6px,3vw,20px)' }}>
        <div onMouseDown={(e) => e.stopPropagation()} style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, width: 'min(580px,96vw)', maxHeight: '92vh', overflow: 'auto', boxShadow: 'var(--shadow-pop)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--line-2)', position: 'sticky', top: 0, background: 'var(--panel)', zIndex: 3 }}>
            <Ic d={I.doc} s={16} /><div style={{ fontWeight: 700, fontSize: 14, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Submission · {s.type === 'quality' ? s.areaName : s.departmentName}</div>
            <span style={{ flex: 1 }} /><button className="icon-btn" style={{ width: 30, height: 30, flexShrink: 0 }} onClick={onClose}><Ic d={I.x} s={16} /></button>
          </div>
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 13 }}>
            {s.type === 'quality' && (s.indicatorName || isRate) && (() => {
              const numL = s.numLabel || 'Numerator', denL = s.denLabel || 'Denominator';
              const labelFormula = isRate ? '(' + numL + ' ÷ ' + denL + ') × ' + rateMult : (s.numLabel || s.indicatorName || 'Recorded value');
              const numeric = isRate
                ? '(' + (effNum === '' || effNum == null ? '—' : effNum) + ' ÷ ' + (effDen === '' || effDen == null ? '—' : effDen) + ') × ' + rateMult + ' = ' + shownVal + (s.unit ? ' ' + s.unit : '')
                : (s.value == null ? '—' : s.value) + (s.unit ? ' ' + s.unit : '');
              return (
                <div style={{ background: 'linear-gradient(120deg,#eef4ff,#f6faff)', border: '1px solid #cfe0fb', borderRadius: 10, padding: '11px 13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: .5, background: '#dbeafe', borderRadius: 20, padding: '2px 9px' }}>Quality indicator</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#0f2a5a' }}>{s.indicatorName || 'Indicator'}</span>
                    {s.benchmark && <span style={{ fontSize: 11, fontWeight: 700, color: '#0b6aa2', background: '#fff', border: '1px solid #cfe6f7', borderRadius: 20, padding: '2px 9px' }}>Benchmark {s.benchmark}</span>}
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .4 }}>Formula</span>
                    <code style={{ fontSize: 12.5, fontWeight: 700, color: '#0f2a5a', background: '#fff', border: '1px solid #dbe6f7', borderRadius: 7, padding: '3px 9px' }}>{labelFormula}</code>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#0b6aa2' }}>{numeric}</span>
                  </div>
                </div>
              );
            })()}
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
              {s.isCorrection && <Meta label="Edit request" value="Correction — pending approval" />}
              {s.isCorrection && s.correctionReason && <Meta label="Correction reason" value={s.correctionReason} />}
            </div>
            {s.priorValues && (
              <div style={{ border: '1px solid #f0d9a8', background: 'var(--warn-bg,#fff4e0)', borderRadius: 9, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9a6b00', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 6 }}>Previously on record — old vs new</div>
                {s.type === 'patient'
                  ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12 }}>{cols.map((c) => { const oldV = (s.priorValues.values || {})[c.id]; const newV = vals[c.id]; const changed = String(oldV == null ? '' : oldV) !== String(newV == null ? '' : newV); return <div key={c.id} style={{ color: changed ? 'var(--rose)' : 'var(--ink-2)' }}><b>{c.label}:</b> {oldV == null ? '—' : oldV}{changed ? ' → ' + (newV == null || newV === '' ? '—' : newV) : ''}</div>; })}</div>
                  : <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>Value <b>{s.priorValues.value == null ? '—' : s.priorValues.value}</b>{s.priorValues.num != null ? ' · num ' + s.priorValues.num + ' / den ' + (s.priorValues.den == null ? '—' : s.priorValues.den) : ''} → now <b>{isRate ? shownVal : (qval === '' ? '—' : qval)}</b></div>}
              </div>
            )}
            {editable && fullEdit && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '10px 12px', background: 'var(--panel-2)', border: '1px dashed var(--line)', borderRadius: 9 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11.5, color: 'var(--muted)' }}>Reporting month</label>
                  <select style={inputStyle} value={month} onChange={(e) => setMonth(e.target.value)}>{monthOpts.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11.5, color: 'var(--muted)' }}>Re-assign {s.type === 'patient' ? 'department' : 'quality area'}</label>
                  {s.type === 'patient'
                    ? <select style={inputStyle} value={target} onChange={(e) => setTarget(e.target.value)}>{deptOpts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
                    : <select style={inputStyle} value={target} onChange={(e) => setTarget(e.target.value)}>{areaOpts.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}</select>}
                </div>
              </div>
            )}
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
                <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {isRate && !hasDeptBreak && !hasGrp && (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11.5, color: 'var(--muted)' }}>{s.numLabel || 'Numerator'}</label>
                        {editable ? <input type="number" step="any" style={inputStyle} value={qnum} onChange={(e) => setQnum(e.target.value)} /> : <div className="num" style={{ fontWeight: 700, fontSize: 15 }}>{s.num == null ? '—' : s.num}</div>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11.5, color: 'var(--muted)' }}>{s.denLabel || 'Denominator'}</label>
                        {editable ? <input type="number" step="any" style={inputStyle} value={qden} onChange={(e) => setQden(e.target.value)} /> : <div className="num" style={{ fontWeight: 700, fontSize: 15 }}>{s.den == null ? '—' : s.den}</div>}
                      </div>
                    </>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 11.5, color: 'var(--muted)' }}>{s.indicatorName || 'Value'}{isRate ? ' (computed)' : ''}{s.unit ? ' · ' + s.unit : ''}</label>
                    {(editable && !isRate)
                      ? <input type="number" step="any" style={inputStyle} value={qval} onChange={(e) => setQval(e.target.value)} />
                      : <div className="num" style={{ fontWeight: 700, fontSize: 15 }}>{isRate ? shownVal : (s.value == null ? '—' : s.value)}{s.benchmark ? <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', marginLeft: 6 }}>· benchmark {s.benchmark}</span> : null}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 11.5, color: 'var(--muted)' }}>Remark</label>
                    {editable ? <input style={inputStyle} value={remark} onChange={(e) => setRemark(e.target.value)} /> : <div>{s.remark || '—'}</div>}
                  </div>
                </div>
                {(hasDeptBreak || hasGrp) && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 8 }}>{hasDeptBreak ? 'By department × staff group' : 'By staff group'} <span style={{ fontWeight: 500, color: 'var(--muted)', textTransform: 'none' }}>· total {effNum} / {effDen} = {shownVal}{s.unit ? ' ' + s.unit : ''}</span></div>
                    {hasGrp && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                        {GROUPS.map(([k, lbl]) => (
                          <div key={k}>
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 3 }}>{lbl}</div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {editable ? <input type="number" step="any" style={{ ...inputStyle, padding: '6px 7px' }} value={grp[k].n} onChange={(e) => setGrpCell(k, 'n', e.target.value)} placeholder="num" /> : <div className="num" style={{ fontSize: 13 }}>{grp[k].n || 0}</div>}
                              {isRate && (editable ? <input type="number" step="any" style={{ ...inputStyle, padding: '6px 7px' }} value={grp[k].d} onChange={(e) => setGrpCell(k, 'd', e.target.value)} placeholder="den" /> : <div className="num" style={{ fontSize: 13 }}>{grp[k].d || 0}</div>)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {hasDeptBreak && (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {deptBreak.map((r, i) => {
                          const rn = GROUPS.reduce((s2, [k]) => s2 + (Number(r.g[k].n) || 0), 0);
                          const rd = GROUPS.reduce((s2, [k]) => s2 + (Number(r.g[k].d) || 0), 0);
                          return (
                            <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', background: 'var(--panel-2)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', flex: 1 }}>{r.dept}</div>
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue-700)' }}>{rn}{isRate ? '/' + rd : ''}</span>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                                {GROUPS.map(([k, lbl]) => (
                                  <div key={k}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 2 }}>{lbl}</div>
                                    <div style={{ display: 'flex', gap: 3 }}>
                                      {editable ? <input type="number" step="any" style={{ ...inputStyle, padding: '5px 6px', fontSize: 12 }} value={r.g[k].n} onChange={(e) => setBreakCell(i, k, 'n', e.target.value)} placeholder="num" /> : <div className="num" style={{ fontSize: 12 }}>{r.g[k].n || 0}</div>}
                                      {isRate && (editable ? <input type="number" step="any" style={{ ...inputStyle, padding: '5px 6px', fontSize: 12 }} value={r.g[k].d} onChange={(e) => setBreakCell(i, k, 'd', e.target.value)} placeholder="den" /> : <div className="num" style={{ fontSize: 12 }}>{r.g[k].d || 0}</div>)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                </>
              )}
            </div>
            {s.type === 'quality' && (editable || incidents.length > 0) && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: .4 }}>Incident / CAPA details</div>
                  <span style={{ flex: 1 }} />
                  {editable && <button className="btn sm" onClick={() => setIncidents((a) => [...a, {}])}><Ic d={I.plus} s={12} />Add incident</button>}
                </div>
                {incidents.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>No incidents logged.</div>}
                <div style={{ display: 'grid', gap: 10 }}>
                  {incidents.map((inc, i) => (
                    <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', background: 'var(--panel-2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)' }}>Incident {i + 1}</div>
                        <span style={{ flex: 1 }} />
                        {editable && <button className="icon-btn" title="Remove" style={{ width: 24, height: 24, color: 'var(--rose)' }} onClick={() => setIncidents((a) => a.filter((_, j) => j !== i))}><Ic d={I.x} s={12} /></button>}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {INC_FIELDS.map(([k, lbl]) => (
                          <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 3, gridColumn: (k === 'details' || k === 'finding' || k === 'corrective' || k === 'preventive') ? '1 / -1' : 'auto' }}>
                            <label style={{ fontSize: 10.5, color: 'var(--muted)' }}>{lbl}</label>
                            {editable
                              ? <input style={{ ...inputStyle, padding: '6px 8px', fontSize: 12 }} value={inc[k] || ''} onChange={(e) => setInc(i, k, e.target.value)} />
                              : <div style={{ fontSize: 12 }}>{inc[k] || '—'}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11.5, color: 'var(--muted)' }}>Note</label>
              {editable ? <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" /> : <div>{s.note || '—'}</div>}
            </div>
            {correcting && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11.5, color: 'var(--muted)' }}>Reason for the edit request</label>
                <input style={inputStyle} value={correctReason} onChange={(e) => setCorrectReason(e.target.value)} placeholder="e.g. wrong value entered — should be Y not X" autoFocus />
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Your edit request goes to an administrator for review — the recorded value won’t change until it’s approved.</div>
              </div>
            )}
            {editable && !correcting && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.status === 'approved' ? 'This submission is approved — saving re-applies your changes to the live dashboard immediately.' : s.status === 'rejected' ? 'This submission was rejected — saving updates the record; approve it to re-apply to live data.' : fullEdit ? 'Approve it from the table to apply the values to live data.' : 'Saving updates your pending submission before the administrator reviews it.'}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', position: 'sticky', bottom: 0, background: 'var(--panel)', paddingTop: 8, marginTop: 2, borderTop: '1px solid var(--line-2)' }}>
              <button className="btn sm" onClick={onClose}>Close</button>
              {canRequestEdit && !correcting && <button className="btn sm" onClick={() => setCorrecting(true)}><Ic d={I.edit} s={14} />Request an edit</button>}
              {correcting && <button className="btn pri sm" onClick={submitCorrection} disabled={busy}><Ic d={I.check} s={14} />{busy ? 'Sending…' : 'Submit edit request'}</button>}
              {editable && !correcting && <button className="btn pri sm" onClick={save} disabled={busy}><Ic d={I.check} s={14} />{busy ? 'Saving…' : 'Save changes'}</button>}
              {canEdit && fullEdit && !correcting && s.status !== 'approved' && <button className="btn sm" onClick={approveNow} disabled={busy} style={{ background: 'var(--pos)', borderColor: 'var(--pos)', color: '#fff' }}><Ic d={I.check} s={14} />{busy ? 'Approving…' : 'Approve'}</button>}
              {canEdit && fullEdit && !correcting && s.status === 'approved' && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--pos)', alignSelf: 'center' }}>✓ Approved — edits re-apply live on save</span>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Reject-reason dialog (single or bulk) — preset reasons + free text; shown in history.
  function RejectModal({ ids, busy, onCancel, onConfirm }) {
    const presets = ['Wrong value / data-entry error', 'Wrong month', 'Duplicate submission', 'Incomplete data', 'Not verified with records'];
    const [reason, setReason] = useState('');
    return (
      <div onMouseDown={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(16,32,46,.42)', zIndex: 420, display: 'grid', placeItems: 'center', padding: 20 }}>
        <div onMouseDown={(e) => e.stopPropagation()} style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, width: 'min(470px,96vw)', maxHeight: '92vh', overflow: 'auto', boxShadow: 'var(--shadow-pop)' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line-2)', fontWeight: 700, fontSize: 14 }}>Reject {ids.length > 1 ? ids.length + ' submissions' : 'submission'}</div>
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Pick a reason or type your own — it is saved in history and shown to the collector.</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {presets.map((p) => <span key={p} onClick={() => setReason(p)} style={{ cursor: 'pointer', padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, border: '1px solid ' + (reason === p ? 'var(--rose)' : 'var(--line)'), background: reason === p ? '#fbe9ec' : '#fff', color: reason === p ? 'var(--rose)' : 'var(--ink-2)' }}>{p}</span>)}
            </div>
            <textarea style={{ ...inputStyle, minHeight: 62, resize: 'vertical' }} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn sm" onClick={onCancel}>Cancel</button>
              <button className="btn sm" style={{ background: 'var(--rose)', borderColor: 'var(--rose)', color: '#fff' }} disabled={busy} onClick={() => onConfirm(reason)}>{busy ? 'Rejecting…' : 'Reject'}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const dcFilterSel = { padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', background: '#fff', color: 'var(--ink)', outline: 'none', cursor: 'pointer' };

  /* Monthly collection coverage — which departments (patient) and quality areas have
     submitted for the chosen month, and which are STILL MISSING (the gap/alert list).
     Analytics + alerts in one; "Copy gaps" produces a paste-ready reminder list. */
  function CollectionCoverage() {
    const [subs, setSubs] = useState(null);
    const [month, setMonth] = useState('');
    const [showP, setShowP] = useState(false);
    const [showQ, setShowQ] = useState(false);
    const load = () => dcAllSubmissions().then((s) => setSubs(s)).catch(() => setSubs([]));
    useEffect(() => { load(); const h = () => load(); window.addEventListener('unico:data-refreshed', h); return () => window.removeEventListener('unico:data-refreshed', h); }, []);
    const depts = React.useMemo(() => dcAllDepts(), []);
    const areas = React.useMemo(() => (window.qualityData ? window.qualityData() : []), []);
    const MO = (window.UNICO && window.UNICO.MONTH_ORDER) || [];
    const rank = (mm) => { const i = MO.indexOf(mm); return i < 0 ? -1 : i; };
    const monthCounts = React.useMemo(() => { const c = {}; (subs || []).forEach((s) => { if (s.month) c[s.month] = (c[s.month] || 0) + 1; }); return c; }, [subs]);
    const months = React.useMemo(() => Object.keys(monthCounts).sort((a, b) => rank(b) - rank(a)), [monthCounts]);
    // Default to the BUSIEST month (where the data actually is), not just the latest —
    // a single stray future-dated entry shouldn't make the panel look empty.
    const busiest = React.useMemo(() => Object.keys(monthCounts).sort((a, b) => monthCounts[b] - monthCounts[a])[0] || '', [monthCounts]);
    const m = month || busiest || months[0] || '';
    const subsM = (subs || []).filter((s) => s.month === m);
    // Only count departments that actually collect PATIENT statistics — have data on record
    // OR have ever submitted patient data. Excludes quality-only units (e.g. Radiology) that
    // never report a patient census, so they're not wrongly flagged as "missing".
    const everPatient = new Set((subs || []).filter((s) => s.type === 'patient').map((s) => s.department));
    const patientDepts = depts.filter((d) => (d.series || []).length > 0 || everPatient.has(d.id));
    // A dept/area is COVERED for the month if it was submitted this month OR already has data
    // on record for it (some data is entered directly, not through the submission flow).
    const hasRec = (d) => (d.series || []).some((r) => r.month === m && Object.keys(r).some((k) => k !== 'month' && k !== 'full' && r[k] != null && r[k] !== ''));
    const qHasRec = (a) => (a.indicators || []).some((ind) => (ind.months && ind.months[m] != null && ind.months[m] !== '') || (ind.mNum && ind.mNum[m] != null && ind.mNum[m] !== ''));
    const pSub = new Set(subsM.filter((s) => s.type === 'patient').map((s) => s.department));
    const qSub = new Set(subsM.filter((s) => s.type === 'quality').map((s) => s.area));
    const pMissing = patientDepts.filter((d) => !pSub.has(d.id) && !hasRec(d));
    const qMissing = areas.filter((a) => !qSub.has(a.key) && !qHasRec(a));
    const pPct = patientDepts.length ? Math.round((patientDepts.length - pMissing.length) / patientDepts.length * 100) : 0;
    const qPct = areas.length ? Math.round((areas.length - qMissing.length) / areas.length * 100) : 0;
    const gapN = pMissing.length + qMissing.length;
    const copyGaps = () => {
      const txt = 'Not yet submitted — ' + monthLabel(m) + '\n\nPatient statistics (' + pMissing.length + '):\n' + (pMissing.length ? pMissing.map((d) => '• ' + d.name).join('\n') : '(all submitted)') + '\n\nQuality indicators (' + qMissing.length + '):\n' + (qMissing.length ? qMissing.map((a) => '• ' + a.name).join('\n') : '(all submitted)');
      try { navigator.clipboard.writeText(txt); toast('Gap list copied — paste into a reminder', 'success'); } catch (e) { toast('Could not copy', 'error'); }
    };
    const Bar = ({ label, done, total, pct, color }) => (
      <div style={{ flex: '1 1 240px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 5 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{label}</span>
          <span style={{ fontSize: 11.5, color: 'var(--muted)', marginLeft: 'auto' }}>{done}/{total} · {pct}%</span>
        </div>
        <div style={{ height: 10, background: 'var(--panel-2)', borderRadius: 6, overflow: 'hidden' }}><div style={{ height: '100%', width: pct + '%', background: color, borderRadius: 6, transition: 'width .5s' }} /></div>
      </div>
    );
    if (subs === null) return null;
    return (
      <Card style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <Ic d={I.activity} s={16} c="var(--blue)" /><b style={{ fontSize: 13.5 }}>Collection coverage</b>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>who has submitted this month</span>
          <span style={{ flex: 1 }} />
          <select value={m} onChange={(e) => setMonth(e.target.value)} style={dcFilterSel}>{(months.length ? months : [m]).filter(Boolean).map((x) => <option key={x} value={x}>{monthLabel(x)}{monthCounts[x] ? ' · ' + monthCounts[x] + ' submitted' : ''}</option>)}</select>
          {gapN > 0 && <button className="btn sm" onClick={copyGaps} title="Copy the not-submitted list for a reminder"><Ic d={I.download} s={13} />Copy gaps</button>}
        </div>
        {/* Symmetric: EACH side (Patient / Quality) shows its own bar + its own
            "not submitted" toggle and gap chips — quality is no longer left blank. */}
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
          {[
            { label: 'Patient statistics', done: patientDepts.length - pMissing.length, total: patientDepts.length, pct: pPct, color: 'linear-gradient(90deg,#1f9d57,#3ab5a7)', missing: pMissing, keyOf: (x) => x.id, chipBg: 'var(--pos-bg)', chipFg: 'var(--pos)', show: showP, setShow: setShowP },
            { label: 'Quality indicators', done: areas.length - qMissing.length, total: areas.length, pct: qPct, color: 'linear-gradient(90deg,#0090ca,#27a8db)', missing: qMissing, keyOf: (x) => x.key, chipBg: 'var(--blue-50)', chipFg: 'var(--blue-700,#0b6aa2)', show: showQ, setShow: setShowQ },
          ].map((c, ci) => (
            <div key={ci} style={{ flex: '1 1 280px', minWidth: 0 }}>
              <Bar label={c.label} done={c.done} total={c.total} pct={c.pct} color={c.color} />
              <div style={{ marginTop: 9 }}>
                {c.missing.length > 0 ? (
                  <>
                    <button className="btn sm" onClick={() => c.setShow((v) => !v)} style={{ color: '#9a6b00', borderColor: '#e6c34d' }}><Ic d={I.bell} s={13} />{c.show ? 'Hide' : 'Show'} {c.missing.length} not submitted</button>
                    {c.show && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>{c.missing.map((x) => <span key={c.keyOf(x)} style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: c.chipBg, color: c.chipFg }}>{x.name}</span>)}</div>}
                  </>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--pos)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Ic d={I.check} s={13} />All submitted</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  /* Per-collector progress — activity by responsible/submitter: totals, pending vs
     approved vs rejected, last-submitted. Collapsed by default (opt-in analytics). */
  function CollectorProgress() {
    const [subs, setSubs] = useState(null);
    const [open, setOpen] = useState(false);
    const [sortBy, setSortBy] = useState('total');
    const load = () => dcAllSubmissions().then((s) => setSubs(s)).catch(() => setSubs([]));
    useEffect(() => { load(); const h = () => load(); window.addEventListener('unico:data-refreshed', h); return () => window.removeEventListener('unico:data-refreshed', h); }, []);
    const respOf = (s) => (s.responsible && s.responsible.name) || s.submittedBy || '—';
    const byPerson = {};
    (subs || []).forEach((s) => { const p = respOf(s); const r = byPerson[p] = byPerson[p] || { name: p, total: 0, pending: 0, approved: 0, rejected: 0, patient: 0, quality: 0, last: 0 }; r.total++; r[s.status] = (r[s.status] || 0) + 1; r[s.type] = (r[s.type] || 0) + 1; if ((s.submittedAt || 0) > r.last) r.last = s.submittedAt; });
    let people = Object.values(byPerson);
    people.sort((a, b) => sortBy === 'name' ? a.name.localeCompare(b.name) : sortBy === 'pending' ? b.pending - a.pending : sortBy === 'last' ? b.last - a.last : b.total - a.total);
    const ago = (ts) => { if (!ts) return 'never'; const m = Math.floor((Date.now() - ts) / 60000); if (m < 1) return 'just now'; if (m < 60) return m + 'm ago'; const h = Math.floor(m / 60); if (h < 24) return h + 'h ago'; return Math.floor(h / 24) + 'd ago'; };
    const ini = (n) => (n || '?').split(' ').map((x) => x[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
    if (subs === null) return null;
    const th = { textAlign: 'left', fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .4, fontWeight: 700, padding: '6px 8px', cursor: 'pointer' };
    return (
      <Card style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setOpen((v) => !v)}>
          <Ic d={I.user} s={16} c="var(--blue)" /><b style={{ fontSize: 13.5 }}>Collector progress</b>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{people.length} people · {(subs || []).length} submissions</span>
          <span style={{ flex: 1 }} />
          <Ic d={I.chevR} s={16} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s', opacity: .6 }} />
        </div>
        {open && (
          <div style={{ overflowX: 'auto', marginTop: 10 }}>
            <table className="tbl" style={{ width: '100%', fontSize: 12.5 }}>
              <thead><tr>
                <th style={th} onClick={() => setSortBy('name')}>Collector</th>
                <th style={{ ...th, textAlign: 'center' }} onClick={() => setSortBy('total')}>Submissions</th>
                <th style={{ ...th, textAlign: 'center' }} onClick={() => setSortBy('pending')}>Pending</th>
                <th style={{ ...th, textAlign: 'center' }}>Approved</th>
                <th style={{ ...th, textAlign: 'center' }}>Rejected</th>
                <th style={{ ...th, textAlign: 'left' }}>Mix</th>
                <th style={{ ...th, textAlign: 'right' }} onClick={() => setSortBy('last')}>Last submitted</th>
              </tr></thead>
              <tbody>
                {people.map((p) => { const appPct = p.total ? Math.round(p.approved / p.total * 100) : 0; return (
                  <tr key={p.name}>
                    <td style={{ padding: '7px 8px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--blue-50)', color: 'var(--blue-700,#0b6aa2)', display: 'grid', placeItems: 'center', fontSize: 10.5, fontWeight: 800, flexShrink: 0 }}>{ini(p.name)}</span><b style={{ color: 'var(--ink)' }}>{p.name}</b></div></td>
                    <td style={{ textAlign: 'center', fontWeight: 800 }} className="num">{p.total}</td>
                    <td style={{ textAlign: 'center' }} className="num">{p.pending ? <span style={{ fontWeight: 700, color: '#9a6b00' }}>{p.pending}</span> : <span style={{ color: 'var(--faint)' }}>0</span>}</td>
                    <td style={{ textAlign: 'center', color: 'var(--pos)', fontWeight: 700 }} className="num">{p.approved}</td>
                    <td style={{ textAlign: 'center', color: p.rejected ? 'var(--rose)' : 'var(--faint)', fontWeight: 700 }} className="num">{p.rejected}</td>
                    <td style={{ padding: '7px 8px', minWidth: 120 }}>
                      <div style={{ display: 'flex', height: 8, borderRadius: 5, overflow: 'hidden', background: 'var(--panel-2)' }} title={`${p.approved} approved · ${p.pending} pending · ${p.rejected} rejected`}>
                        <span style={{ width: (p.approved / (p.total || 1) * 100) + '%', background: 'var(--pos)' }} />
                        <span style={{ width: (p.pending / (p.total || 1) * 100) + '%', background: '#e0a81e' }} />
                        <span style={{ width: (p.rejected / (p.total || 1) * 100) + '%', background: 'var(--rose)' }} />
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>{p.patient}P · {p.quality}Q · {appPct}% approved</div>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--ink-2)' }}>{ago(p.last)}</td>
                  </tr>
                ); })}
                {people.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 18 }}>No submissions yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    );
  }

  function DataReview() {
    const [rows, setRows] = useState(null);
    const [stats, setStats] = useState(null);
    const [filter, setFilter] = useState('pending');
    const [busy, setBusy] = useState('');
    const [detail, setDetail] = useState(null);
    const [dupGroup, setDupGroup] = useState(null);   // [submissions] for a duplicate target+month
    // advanced filters (client-side, over the fetched rows)
    const [fq, setFq] = useState('');       // free-text search
    const [fType, setFType] = useState(''); // '' | 'patient' | 'quality'
    const [fDept, setFDept] = useState(''); // department / area (group) name
    const [fMonth, setFMonth] = useState(''); // reporting period
    const [fResp, setFResp] = useState('');   // responsible person
    const [sortBy, setSortBy] = useState('when'); // when | type | target | status
    const [sortDir, setSortDir] = useState('desc');
    const when = (ts) => { try { return new Date(ts).toLocaleString(); } catch (e) { return ''; } };
    const load = () => {
      dcApi.get('/api/submissions?status=' + filter + '&limit=300').then((r) => setRows(r.ok ? r.submissions : [])).catch(() => setRows([]));
      dcApi.get('/api/submissions/stats').then((r) => setStats(r.ok ? r.stats : null)).catch(() => {});
    };
    useEffect(() => { setRows(null); load(); }, [filter]);
    // Live refresh: a submission made in another tab/device (or by a collector) used to
    // stay invisible until a manual reload. Refetch silently when the tab regains focus,
    // on the shared 'unico:data-refreshed' event, and on a light 30s poll while visible.
    useEffect(() => {
      const refresh = () => { if (document.visibilityState !== 'hidden') load(); };
      const onVis = () => { if (document.visibilityState === 'visible') load(); };
      window.addEventListener('focus', refresh);
      document.addEventListener('visibilitychange', onVis);
      window.addEventListener('unico:data-refreshed', refresh);
      const iv = setInterval(refresh, 30000);
      return () => {
        window.removeEventListener('focus', refresh);
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('unico:data-refreshed', refresh);
        clearInterval(iv);
      };
    }, [filter]);

    const [sel, setSel] = useState({});                 // bulk selection: id -> true
    const [rejectFor, setRejectFor] = useState(null);   // {ids:[...]} -> reject-reason modal
    const [grouped, setGrouped] = useState(true);       // group the table by department
    // Run approve/reject over one OR many submissions (bulk), then reload.
    const runAction = async (ids, kind, reason) => {
      if (!ids || !ids.length) return;
      setBusy('bulk');
      let ok = 0, autoRej = 0; const doneIds = [];
      for (const id of ids) {
        try { const r = await dcApi.post('/api/submissions/' + encodeURIComponent(id) + '/' + kind, kind === 'reject' ? { reason: reason || '' } : {}); if (r && r.ok) { ok++; doneIds.push(id); autoRej += (r.autoRejected || 0); } } catch (e) { }
      }
      setBusy(''); setSel({}); setRejectFor(null);
      // Keep the duplicate-compare dialog in step. dupGroup is a SNAPSHOT taken when the ⚠
      // badge was clicked and nothing here refreshed it, so a submission REJECTED from inside
      // the dialog stayed on the list showing a stale "Pending" chip (approve happened to work
      // only because its button patched the snapshot itself). Drop whatever actually succeeded
      // — whichever button started it — and close once fewer than two responses remain, since
      // there is then no duplicate left to compare.
      if (doneIds.length) setDupGroup((cur) => {
        if (!cur) return cur;
        const next = cur.filter((x) => doneIds.indexOf(x.id) < 0);
        return next.length > 1 ? next : null;
      });
      toast(ok + ' ' + (kind === 'approve' ? 'approved — applied to live data' : 'rejected') + (kind === 'approve' && autoRej ? ' · ' + autoRej + ' duplicate' + (autoRej !== 1 ? 's' : '') + ' auto-rejected' : '') + (ok < ids.length ? ' (' + (ids.length - ok) + ' failed)' : ''), kind === 'approve' ? 'success' : 'info');
      if (kind === 'approve' && ok) dcRefreshLive();
      load();
    };
    const act = (id, kind) => { if (kind === 'reject') { setRejectFor({ ids: [id] }); } else { runAction([id], 'approve'); } };
    // Track multiple submissions for the SAME target + month (possible duplicates).
    const dupKey = (s) => s.type + '|' + (s.type === 'quality' ? ((s.area || '') + '|' + (s.indicatorId || s.indicatorName || '')) : (s.department || '')) + '|' + s.month;
    // Group submissions by DEPARTMENT (canonical name), so a department's patient + quality
    // submissions sit together; quality rows get a blue fill, patient rows a green fill.
    const groupKey = (s) => (s.type === 'quality'
      ? ((window.DEPTMAP && window.DEPTMAP.nameFromQualityKey(s.area)) || s.areaName)
      : ((window.DEPTMAP && window.DEPTMAP.nameFromId(s.department)) || s.departmentName)) || '—';
    // Filter option lists derived from the fetched rows.
    const respOf = (s) => (s.responsible && s.responsible.name) || s.submittedBy || '';
    const deptOptions = [...new Set((rows || []).map(groupKey))].sort();
    const monthOptions = [...new Set((rows || []).map((s) => s.month).filter(Boolean))].sort().reverse();
    const respOptions = [...new Set((rows || []).map(respOf).filter(Boolean))].sort();
    const matchesFilter = (s) => {
      if (fType && s.type !== fType) return false;
      if (fDept && groupKey(s) !== fDept) return false;
      if (fMonth && s.month !== fMonth) return false;
      if (fResp && respOf(s) !== fResp) return false;
      if (fq.trim()) {
        const hay = [s.areaName, s.departmentName, s.indicatorName, s.month, s.responsible && s.responsible.name, s.submittedBy, groupKey(s)].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(fq.trim().toLowerCase())) return false;
      }
      return true;
    };
    const anyFilter = !!(fq.trim() || fType || fDept || fMonth || fResp);
    // Sort key per column; grouped view sorts within each department group.
    const sortVal = (s) => sortBy === 'when' ? (s.submittedAt || 0)
      : sortBy === 'type' ? (s.type || '')
      : sortBy === 'status' ? (s.status || '')
      : ((s.type === 'quality' ? s.areaName : s.departmentName) || '');
    const cmp = (a, b) => { const va = sortVal(a), vb = sortVal(b); const r = va < vb ? -1 : va > vb ? 1 : 0; return sortDir === 'asc' ? r : -r; };
    const filtered = (rows || []).filter(matchesFilter).sort(cmp);
    const setSort = (k) => { if (sortBy === k) setSortDir((d) => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(k); setSortDir(k === 'when' ? 'desc' : 'asc'); } };
    const sortCaret = (k) => sortBy === k ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
    // Export the currently filtered rows to a CSV (opens in Excel).
    const exportCsv = () => {
      const cols = [['When', (s) => when(s.submittedAt)], ['Type', (s) => s.type], ['Department', groupKey], ['Target', (s) => (s.type === 'quality' ? (s.indicatorName || s.areaName) : s.departmentName)], ['Period', (s) => s.month || ''], ['Responsible', respOf], ['Submitted by', (s) => s.submittedBy || ''], ['Status', (s) => s.status]];
      const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      const lines = [cols.map((c) => esc(c[0])).join(',')].concat(filtered.map((s) => cols.map((c) => esc(c[1](s))).join(',')));
      const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'submissions-' + filter + '.csv'; document.body.appendChild(a); a.click();
      setTimeout(() => { try { document.body.removeChild(a); } catch (e) {} URL.revokeObjectURL(a.href); }, 0);
      toast(filtered.length + ' row' + (filtered.length !== 1 ? 's' : '') + ' exported', 'success');
    };
    const dupCount = {}; filtered.forEach((s) => { const k = dupKey(s); dupCount[k] = (dupCount[k] || 0) + 1; });
    const pendingRows = filtered.filter((s) => s.status === 'pending');
    const selIds = pendingRows.filter((s) => sel[s.id]).map((s) => s.id);
    const allSelected = pendingRows.length > 0 && selIds.length === pendingRows.length;
    const groups = {}; filtered.forEach((s) => { const k = groupKey(s); (groups[k] = groups[k] || []).push(s); });
    const groupNames = Object.keys(groups).sort();
    const rowFill = (s) => s.type === 'quality' ? 'rgba(0,144,202,.06)' : 'rgba(31,157,87,.06)';
    const submissionRow = (s) => (
      <tr key={s.id} onClick={() => setDetail(s)} title="Open to view / edit" style={{ background: grouped ? rowFill(s) : undefined, cursor: 'pointer' }}>
        <td onClick={(e) => e.stopPropagation()}>{s.status === 'pending' ? <input type="checkbox" checked={!!sel[s.id]} onChange={(e) => setSel((m) => Object.assign({}, m, { [s.id]: e.target.checked }))} /> : null}</td>
        <td style={{ whiteSpace: 'nowrap' }} className="num">{when(s.submittedAt)}</td>
        <td><span className="chip" style={{ background: s.type === 'quality' ? 'var(--blue-50)' : 'var(--pos-bg)', color: s.type === 'quality' ? 'var(--blue-700,#0b6aa2)' : 'var(--pos)', fontWeight: 700 }}>{s.type === 'quality' ? 'Quality' : 'Patient'}</span></td>
        <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{s.type === 'quality' ? s.areaName : s.departmentName}{dupCount[dupKey(s)] > 1 && <span title="Multiple submissions for the same target and month — click to compare (incl. previous / on-record responses)" onClick={(e) => { e.stopPropagation(); const k = dupKey(s); dcAllSubmissions(true).then((subs) => setDupGroup((subs && subs.length ? subs : filtered).filter((x) => dupKey(x) === k))).catch(() => setDupGroup(filtered.filter((x) => dupKey(x) === k))); }} style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#9a6b00', background: 'var(--warn-bg,#fff4e0)', borderRadius: 999, padding: '1px 6px', cursor: 'pointer', border: '1px solid #e6c34d' }}>⚠ {dupCount[dupKey(s)]}× duplicate</span>}{s.isCorrection && <span title={s.correctionReason || 'Correction / edit request'} style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#7c4dd6', background: 'rgba(124,77,214,.12)', borderRadius: 999, padding: '1px 7px' }}>✎ correction</span>}</td>
        <td style={{ fontSize: 12, color: 'var(--ink-2)', maxWidth: 320 }}>{valuesSummaryEl(s)}</td>
        {/* ONE person column: responsible and submitter are almost always the same
            name — show it once (bold, eye-catching), with "by …" only when they differ. */}
        <td style={{ whiteSpace: 'nowrap' }}>
          <b style={{ color: 'var(--ink)' }}>{(s.responsible && s.responsible.name) || s.submittedBy || '—'}</b>
          {s.submittedBy && s.responsible && s.responsible.name && s.submittedBy !== s.responsible.name &&
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>by {s.submittedBy}</div>}
        </td>
        <td>{statusChip(s.status)}</td>
        <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
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
    );

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
            <button className="btn sm" onClick={exportCsv} disabled={!filtered.length} title="Export the filtered rows to CSV (Excel)"><Ic d={I.download} s={14} />Export</button>
            <button className="btn sm" onClick={load}><Ic d={I.trend} s={14} />Refresh</button>
          </>} />

        <CollectionCoverage />
        <CollectorProgress />

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

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div className="seg">
            {tabs.map(([id, l]) => <button key={id} className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>{l}{id === 'pending' && stats && stats.pending ? ' (' + stats.pending + ')' : ''}</button>)}
          </div>
          <span style={{ flex: 1 }} />
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} />
            Group by department
          </label>
          <span style={{ fontSize: 11, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(31,157,87,.35)' }} /> Patient</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(0,144,202,.35)' }} /> Quality</span>
          </span>
        </div>

        {/* ---- advanced filters: search / type / department / period ---- */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }}><Ic d={I.search} s={14} /></span>
            <input value={fq} onChange={(e) => setFq(e.target.value)} placeholder="Search target, indicator, person…"
              style={{ width: '100%', padding: '8px 10px 8px 30px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <select value={fType} onChange={(e) => setFType(e.target.value)} style={dcFilterSel}>
            <option value="">All types</option><option value="patient">Patient</option><option value="quality">Quality</option>
          </select>
          <select value={fDept} onChange={(e) => setFDept(e.target.value)} style={dcFilterSel}>
            <option value="">All departments</option>
            {deptOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={fMonth} onChange={(e) => setFMonth(e.target.value)} style={dcFilterSel}>
            <option value="">All periods</option>
            {monthOptions.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={fResp} onChange={(e) => setFResp(e.target.value)} style={dcFilterSel}>
            <option value="">All people</option>
            {respOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          {anyFilter && <button className="btn sm" onClick={() => { setFq(''); setFType(''); setFDept(''); setFMonth(''); setFResp(''); }}><Ic d={I.x} s={13} />Clear</button>}
          {rows && <span style={{ fontSize: 11.5, color: 'var(--muted)', marginLeft: 'auto' }}>{filtered.length} of {rows.length} shown</span>}
          {pendingRows.length > 0 && <button className="btn sm pri" disabled={busy === 'bulk'} onClick={() => runAction(pendingRows.map((s) => s.id), 'approve')} title="Approve every pending submission currently shown"><Ic d={I.check} s={13} />Approve all {pendingRows.length}</button>}
        </div>

        {selIds.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--blue-50)', border: '1px solid var(--blue-100,#cfe6f7)', borderRadius: 9 }}>
            <b style={{ fontSize: 12.5 }}>{selIds.length} selected</b>
            <button className="btn sm pri" disabled={busy === 'bulk'} onClick={() => runAction(selIds, 'approve')}><Ic d={I.check} s={13} />Approve selected</button>
            <button className="btn sm" disabled={busy === 'bulk'} style={{ color: 'var(--rose)' }} onClick={() => setRejectFor({ ids: selIds })}>Reject selected</button>
            <span style={{ flex: 1 }} />
            <button className="btn sm" onClick={() => setSel({})}>Clear</button>
          </div>
        )}

        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {rows === null ? <div style={{ padding: 24, color: 'var(--muted)' }}>Loading…</div>
            : rows.length === 0 ? <div style={{ padding: 24, color: 'var(--muted)', textAlign: 'center' }}>No {filter === 'all' ? '' : filter} submissions.</div>
              : filtered.length === 0 ? <div style={{ padding: 24, color: 'var(--muted)', textAlign: 'center' }}>No submissions match the filters. <button className="btn sm" style={{ marginLeft: 8 }} onClick={() => { setFq(''); setFType(''); setFDept(''); setFMonth(''); }}>Clear filters</button></div>
              : <table className="tbl" style={{ width: '100%' }}>
                <thead><tr><th style={{ width: 30 }}><input type="checkbox" checked={allSelected} onChange={(e) => { if (e.target.checked) { const m = {}; pendingRows.forEach((s) => { m[s.id] = true; }); setSel(m); } else setSel({}); }} /></th><th onClick={() => setSort('when')} style={{ cursor: 'pointer', userSelect: 'none' }}>When{sortCaret('when')}</th><th onClick={() => setSort('type')} style={{ cursor: 'pointer', userSelect: 'none' }}>Type{sortCaret('type')}</th><th onClick={() => setSort('target')} style={{ cursor: 'pointer', userSelect: 'none' }}>Target{sortCaret('target')}</th><th>Data</th><th>Responsible / By</th><th onClick={() => setSort('status')} style={{ cursor: 'pointer', userSelect: 'none' }}>Status{sortCaret('status')}</th><th></th></tr></thead>
                <tbody>
                  {grouped
                    ? groupNames.map((g) => (
                      <React.Fragment key={g}>
                        <tr><td colSpan={8} style={{ background: 'var(--panel-2)', fontWeight: 700, color: 'var(--ink)', padding: '7px 12px', borderTop: '1px solid var(--line-2)' }}>{g} <span style={{ fontWeight: 500, color: 'var(--muted)', fontSize: 12 }}>· {groups[g].length} submission{groups[g].length > 1 ? 's' : ''}</span></td></tr>
                        {groups[g].map(submissionRow)}
                      </React.Fragment>
                    ))
                    : filtered.map(submissionRow)}
                </tbody>
              </table>}
        </Card>
        {detail && <SubmissionDetail s={detail} canEdit={true} onClose={() => setDetail(null)} onSaved={() => { setDetail(null); load(); }} />}
        {rejectFor && <RejectModal ids={rejectFor.ids} busy={busy === 'bulk'} onCancel={() => setRejectFor(null)} onConfirm={(reason) => runAction(rejectFor.ids, 'reject', reason)} />}
        {dupGroup && (() => {
          const g = [...dupGroup].sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
          const head = g[0] || {};
          const tgt = head.type === 'quality' ? (head.indicatorName || head.areaName) : head.departmentName;
          // Same-person detection: a person submitting the SAME target+month more than once
          // is almost always an accidental double (vs. two different people = a genuine
          // hand-off). Flag them so the admin knows which to clean up.
          const nameOf = (s) => (s.responsible && s.responsible.name) || s.submittedBy || '—';
          const personCount = {}; g.forEach((s) => { const p = nameOf(s); personCount[p] = (personCount[p] || 0) + 1; });
          const repeatPeople = Object.keys(personCount).filter((p) => personCount[p] > 1);
          return (
            <div onMouseDown={() => setDupGroup(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(16,32,46,.42)', zIndex: 380, display: 'grid', placeItems: 'center', padding: 'clamp(6px,3vw,20px)' }}>
              <div onMouseDown={(e) => e.stopPropagation()} style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, width: 'min(680px,96vw)', maxHeight: '92vh', overflow: 'auto', boxShadow: 'var(--shadow-pop)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--line-2)', position: 'sticky', top: 0, background: 'var(--panel)', zIndex: 3 }}>
                  <span style={{ fontSize: 15, color: '#9a6b00' }}>⚠</span>
                  <div style={{ fontWeight: 700, fontSize: 14, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.length} duplicate submissions · {tgt} · {monthLabel(head.month)}</div>
                  <span style={{ flex: 1 }} /><button className="icon-btn" style={{ width: 30, height: 30, flexShrink: 0 }} onClick={() => setDupGroup(null)}><Ic d={I.x} s={16} /></button>
                </div>
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Same target and month — all {g.length} responses (incl. the previous / on-record one). Compare below, then keep one (approve) and reject the rest.</div>
                  {repeatPeople.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: '#b32339', background: 'var(--neg-bg)', border: '1px solid #f1c6cd', borderRadius: 9, padding: '9px 12px' }}>
                      <span style={{ fontWeight: 700 }}>⚠ Same person submitted twice —</span>
                      <span>{repeatPeople.map((p) => p + ' (' + personCount[p] + '×)').join(', ')}. Likely an accidental double; keep one and reject the extra.</span>
                    </div>
                  )}
                  {g.map((s, i) => (
                    <div key={s.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '11px 13px', background: i === 0 ? 'var(--blue-50)' : 'var(--panel-2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                        {s.status === 'approved' ? <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--pos)', background: 'var(--pos-bg)', border: '1px solid #bfe6cf', borderRadius: 999, padding: '1px 7px' }}>Previous · on record</span> : i === 0 ? <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--blue-700,#0b6aa2)', background: '#fff', border: '1px solid var(--blue-100,#cfe6f7)', borderRadius: 999, padding: '1px 7px' }}>Latest</span> : null}
                        <b style={{ fontSize: 12.5, color: 'var(--ink)' }}>{nameOf(s)}</b>
                        {personCount[nameOf(s)] > 1 && <span title="This person submitted this same target+month more than once" style={{ fontSize: 9.5, fontWeight: 700, color: '#b32339', background: 'var(--neg-bg)', border: '1px solid #f1c6cd', borderRadius: 999, padding: '1px 6px' }}>same person</span>}
                        <span style={{ fontSize: 11.5, color: 'var(--muted)' }} className="num">{(() => { try { return new Date(s.submittedAt).toLocaleString(); } catch (e) { return ''; } })()}</span>
                        <span style={{ flex: 1 }} />{statusChip(s.status)}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{valuesSummaryEl(s)}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 9, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button className="btn sm" onClick={() => setDetail(s)}><Ic d={I.search} s={13} />View / edit</button>
                        {s.status === 'pending' && <>
                          <button className="btn sm pri" disabled={busy === 'bulk'} onClick={() => runAction([s.id], 'approve')}><Ic d={I.check} s={13} />Keep (approve)</button>
                          <button className="btn sm" style={{ color: 'var(--rose)' }} disabled={busy === 'bulk'} onClick={() => setRejectFor({ ids: [s.id] })}><Ic d={I.x} s={13} />Reject</button>
                        </>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  /* ============================ Share Links ============================ */
  function DataShareLinks({ depts }) {
    const all = (depts && depts.length) ? depts : dcAllDepts();
    const dataRev = useDcDataRev();
    const areas = useMemo(() => (window.qualityData ? window.qualityData() : []).map((d) => ({ key: d.key, name: d.name })), [dataRev]);
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

    const canReportArea = (r, ak) => {
      if (!r || !ak) return false;
      if (r.allQualityAreas) return true;
      if ((r.qualityAreas || []).includes(ak)) return true;
      return (window.DEPTMAP ? window.DEPTMAP.areasFromDepts(r.departments || []) : []).includes(ak);
    };
    const canReportDept = (r, id) => {
      if (!r || !id) return false;
      if ((r.departments || []).includes(id)) return true;
      if (r.allQualityAreas) return true;
      const areasForDept = window.DEPTMAP ? window.DEPTMAP.areasFromDepts([id]) : [];
      return areasForDept.some((ak) => (r.qualityAreas || []).includes(ak));
    };
    const assigned = form.type === 'patient'
      ? resps.filter((r) => canReportDept(r, form.department))
      : resps.filter((r) => canReportArea(r, form.area));

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
  /* My submissions.
     Three things sit above the table, all derived from the SAME /api/submissions read
     that fills it: an accuracy donut, the month's cycle counts, and a status filter.
     The mockup's "Unit accuracy ranking" is deliberately absent — see the comment on
     the header band below. */
  function CollectorHistory({ month, onFixQuality, onFixPatient }) {
    const [rows, setRows] = useState(null);
    const [detail, setDetail] = useState(null);
    const [view, setView] = useState('patient');
    const [status, setStatus] = useState('All');   // All | Pending | Approved | Rejected
    const [mode, setMode] = useState('table');     // Table | Timeline
    const me = (typeof window !== 'undefined' && window.__UNICO_USER__) || {};
    // A collector may edit only their OWN still-PENDING submission (values only).
    const ownsSub = (s) => !!s && s.status === 'pending' && [me.name, me.username].filter(Boolean).some((n) => n === s.submittedBy || (s.responsible && s.responsible.name === n));
    // limit=500 is the SAME window CollectorProfile reads. Both screens quote an
    // accuracy percentage; computing them over different-sized pages would let the
    // two disagree for a collector with more than 300 submissions.
    const load = () => dcApi.get('/api/submissions?limit=500').then((r) => setRows(r.ok ? r.submissions : [])).catch(() => setRows([]));
    useEffect(() => { load(); }, []);
    // Live refresh (same as the admin review): refetch on refocus, data-refreshed, and a 30s poll.
    useEffect(() => {
      const refresh = () => { if (document.visibilityState !== 'hidden') load(); };
      window.addEventListener('focus', refresh);
      document.addEventListener('visibilitychange', refresh);
      window.addEventListener('unico:data-refreshed', refresh);
      const iv = setInterval(refresh, 30000);
      return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('unico:data-refreshed', refresh); clearInterval(iv); };
    }, []);
    const when = (ts) => { try { return ts ? new Date(ts).toLocaleString() : '—'; } catch (e) { return '—'; } };
    // Relative "sent" wording for the timeline, in the mockup's phrasing.
    const ago = (ts) => {
      if (!ts) return 'not dated';
      try {
        const d = new Date(ts), now = new Date();
        const hm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (d.toDateString() === now.toDateString()) return 'Today · ' + hm;
        const y = new Date(now.getTime() - 864e5);
        if (d.toDateString() === y.toDateString()) return 'Yesterday · ' + hm;
        return Math.max(2, Math.round((now.getTime() - d.getTime()) / 864e5)) + ' days ago';
      } catch (e) { return '—'; }
    };
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
    // Edit Requests = the collector's own corrections (built from RAW subs, not the de-duped merge).
    const editRows = subs.filter((s) => s.isCorrection).sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
    const avail = []; if (patientRows.length) avail.push('patient'); if (qualityRows.length) avail.push('quality'); if (editRows.length) avail.push('edits');
    const active = avail.indexOf(view) >= 0 ? view : (avail[0] || 'patient');
    const isQ = active === 'quality';
    const isEdits = active === 'edits';
    const shown = isEdits ? editRows : (isQ ? qualityRows : patientRows);

    /* ---- Header band ------------------------------------------------------------
       Accuracy uses CollectorProfile's formula verbatim — approved ÷ decided over the
       collector's REAL submissions (never the merged on-record rows, which were never
       reviewed) — so "My profile" and "My submissions" cannot quote different numbers.

       The mockup's third card, a "Unit accuracy ranking" of other wards, is left out
       on purpose: a portal account is scoped to its own data, no endpoint returns
       other units' scores, and inventing one would be a privacy decision. */
    const decided = subs.filter((x) => x.status === 'approved' || x.status === 'rejected');
    const accPct = decided.length ? Math.round(subs.filter((x) => x.status === 'approved').length * 100 / decided.length) : null;
    const ACC_C = 144.5;                              // 2πr for the r=23 donut
    // "This cycle" = the reporting month the portal is currently on. Scoping it to a
    // month is what makes it a cycle; an all-time total would only repeat the donut.
    const cycle = subs.filter((x) => x.month === month);
    const cycleAppr = cycle.filter((x) => x.status === 'approved').length;
    const cycleRej = cycle.filter((x) => x.status === 'rejected').length;
    // Response time = how long the ADMIN took to decide (reviewedAt − submittedAt),
    // measurable only on rows that carry both stamps.
    const turn = cycle.filter((x) => x.submittedAt && x.reviewedAt && x.reviewedAt >= x.submittedAt);
    const avgDays = turn.length ? (turn.reduce((a, x) => a + (x.reviewedAt - x.submittedAt), 0) / turn.length / 864e5) : null;
    const cycleStats = [
      ['Submitted', String(cycle.length), '#0090ca'],
      ['Approved', String(cycleAppr), '#1f9d57'],
      ['Rejected', String(cycleRej), '#d23a52'],
      ['Avg. response time', avgDays == null ? '—' : (Math.round(avgDays * 10) / 10) + ' d', '#6a52d4'],
    ];

    /* ---- Filters ---------------------------------------------------------------
       The status filter narrows whichever type tab is open; it does not replace it.
       "All" counts every row in the tab, including on-record rows that were never
       submitted, so All != Pending + Approved + Rejected by design. */
    const FILTERS = ['All', 'Pending', 'Approved', 'Rejected'];
    const countFor = (f) => f === 'All' ? shown.length : shown.filter((s) => s.status === f.toLowerCase()).length;
    const listed = status === 'All' ? shown : shown.filter((s) => s.status === status.toLowerCase());
    const cpTab = (on) => ({ border: 0, background: on ? 'linear-gradient(135deg,#27a8db,#0072a3)' : 'transparent', color: on ? '#fff' : '#6c7a8c', padding: '6px 13px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all .2s', boxShadow: on ? '0 4px 12px rgba(0,144,202,.35)' : 'none' });
    const segWrap = { display: 'inline-flex', background: 'rgba(255,255,255,.5)', border: '1px solid rgba(255,255,255,.85)', borderRadius: 10, padding: 3, gap: 2 };
    const cntStyle = (on) => ({ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, background: on ? 'rgba(255,255,255,.22)' : 'rgba(125,145,180,.18)', padding: '1px 6px', borderRadius: 8 });

    /* ---- Fix & resubmit ---------------------------------------------------------
       Without this a rejected row is a dead end: the reason is readable but there is
       no way back to the form. Quality rows re-enter through the very same jump
       CollectorDash's "Fill now" uses; patient rows through its twin. Returns null
       (button hidden) when the row lacks the ids the form needs in order to prefill. */
    const fixFor = (s) => {
      if (!s || s.status !== 'rejected') return null;
      if (s.type === 'quality') return (onFixQuality && s.area && s.indicatorId && s.month) ? () => onFixQuality(s.area, s.indicatorId, s.month) : null;
      return (onFixPatient && s.department && s.month) ? () => onFixPatient(s.department, s.month) : null;
    };
    const FIX_BTN = { border: '1px solid rgba(210,58,82,.35)', background: 'rgba(255,255,255,.7)', color: '#a92c42', padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' };
    const FixBtn = ({ s }) => { const go = fixFor(s); return go ? <button style={FIX_BTN} onClick={(e) => { e.stopPropagation(); go(); }}>Fix &amp; resubmit</button> : null; };
    const REASON = { fontSize: 10.5, fontWeight: 400, color: '#a92c42', background: 'rgba(210,58,82,.09)', borderLeft: '2px solid rgba(210,58,82,.4)', borderRadius: 5, padding: '4px 8px', marginTop: 4, lineHeight: 1.45, maxWidth: 420 };
    const rejNote = (s) => (s.status === 'rejected' && s.rejectReason) ? <div style={REASON}>{s.rejectReason}</div> : null;

    /* ---- Timeline ---------------------------------------------------------------
       The same rows, grouped by the DAY they were sent. On-record rows carry no
       submittedAt, so they collect under one honest "Already on record" heading
       rather than being given an invented date. */
    const targetOf = (s) => (s.type === 'quality' ? (s.indicatorName || s.areaName) : s.departmentName) || '—';
    const typeOf = (s) => s.type === 'quality' ? 'Quality' : 'Statistics';
    const typeChip = (s) => ({ display: 'inline-flex', fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 12, color: s.type === 'quality' ? '#6a52d4' : '#3ab5a7', background: s.type === 'quality' ? 'rgba(106,82,212,.12)' : 'rgba(58,181,167,.14)' });
    // The synthetic on-record rows have no submission ref, so they show none.
    const refOf = (s) => (/^rec-/.test(String(s.id)) ? '' : String(s.id).slice(-8).toUpperCase());
    const dayGroups = (() => {
      const out = [];
      listed.forEach((s) => {
        let label = 'Already on record';
        if (s.submittedAt) {
          try {
            const d = new Date(s.submittedAt), now = new Date(), y = new Date(Date.now() - 864e5);
            label = d.toDateString() === now.toDateString() ? 'Today'
              : d.toDateString() === y.toDateString() ? 'Yesterday'
                : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
          } catch (e) { label = 'Not dated'; }
        }
        let g = out.find((x) => x.label === label);
        if (!g) { g = { label, rows: [] }; out.push(g); }
        g.rows.push(s);
      });
      return out;
    })();

    return (
      <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14, marginBottom: 14 }}>
        <div style={Object.assign({}, CP_CARD, { padding: '15px 17px', display: 'flex', alignItems: 'center', gap: 14 })}>
          <svg viewBox="0 0 56 56" style={{ width: 56, height: 56, flexShrink: 0, transform: 'rotate(-90deg)' }}>
            <circle cx="28" cy="28" r="23" fill="none" stroke="rgba(125,145,180,.18)" strokeWidth="6" />
            <circle cx="28" cy="28" r="23" fill="none" stroke="#1f9d57" strokeWidth="6" strokeLinecap="round" strokeDasharray={String(ACC_C)} strokeDashoffset={(ACC_C * (1 - (accPct || 0) / 100)).toFixed(1)} style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.2,.7,.3,1)' }} />
          </svg>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 22, fontWeight: 700, color: accPct == null ? '#b6c0cc' : '#16202e', lineHeight: 1 }}>{rows === null ? '…' : accPct == null ? '—' : accPct + '%'}</div>
            <div style={{ fontSize: 11, color: '#6c7a8c', marginTop: 3 }}>
              {(accPct == null && rows !== null) ? 'Nothing has been reviewed yet, so accuracy cannot be measured.' : 'accuracy — approved vs rejected'}
            </div>
            {accPct != null && <div style={{ fontSize: 10.5, color: '#9aa6b4', marginTop: 2 }}>over {decided.length} reviewed submission{decided.length === 1 ? '' : 's'}</div>}
          </div>
        </div>
        <div style={Object.assign({}, CP_CARD, { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 })}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#16202e' }}>This cycle</div>
            <div style={{ fontSize: 10.5, color: '#9aa6b4' }}>{month ? monthLabel(month) : 'no month selected'}</div>
          </div>
          {cycleStats.map((cs) => (
            <div key={cs[0]} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: '#6c7a8c' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: cs[2], flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{cs[0]}</span>
              <b style={{ fontFamily: "'IBM Plex Mono',monospace", color: '#16202e' }}>{cs[1]}</b>
            </div>
          ))}
          {avgDays == null && cycle.length > 0 && <div style={{ fontSize: 10.5, color: '#9aa6b4', lineHeight: 1.5 }}>Response time appears once a submission for this month has been reviewed.</div>}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={segWrap}>
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setStatus(f)} style={cpTab(status === f)}>{f}<span style={cntStyle(status === f)}>{countFor(f)}</span></button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        <div style={segWrap}>
          <button onClick={() => setMode('table')} style={cpTab(mode === 'table')}>Table</button>
          <button onClick={() => setMode('timeline')} style={cpTab(mode === 'timeline')}>Timeline</button>
        </div>
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--line-2)', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700 }}>My data — submissions &amp; what's on record</div>
          {merged.length > 0 && (
            <div className="seg">
              {avail.indexOf('patient') >= 0 && <button className={active === 'patient' ? 'on' : ''} onClick={() => setView('patient')}><Ic d={I.input} s={13} />Patient Statistics ({patientRows.length})</button>}
              {avail.indexOf('quality') >= 0 && <button className={active === 'quality' ? 'on' : ''} onClick={() => setView('quality')}><Ic d={I.activity} s={13} />Quality Data ({qualityRows.length})</button>}
              {avail.indexOf('edits') >= 0 && <button className={active === 'edits' ? 'on' : ''} onClick={() => setView('edits')}><Ic d={I.edit} s={13} />Edit Requests ({editRows.length})</button>}
            </div>
          )}
          <span style={{ flex: 1 }} />
          <button className="btn sm" onClick={load}><Ic d={I.trend} s={13} />Refresh</button>
        </div>
        {rows === null ? <div style={{ padding: 24, color: 'var(--muted)' }}>Loading…</div>
          : merged.length === 0 ? <div style={{ padding: 28, color: 'var(--muted)', textAlign: 'center' }}>No data yet for your assigned departments.</div>
            : listed.length === 0 ? <div style={{ padding: 28, color: 'var(--muted)', textAlign: 'center' }}>Nothing in this tab is {status.toLowerCase()}.</div>
              : mode === 'timeline'
                ? <div style={{ padding: '18px 20px' }}>
                  {dayGroups.map((g) => (
                    <div key={g.label}>
                      <div style={{ fontSize: 10.5, letterSpacing: '.6px', textTransform: 'uppercase', color: '#7d8ea8', fontWeight: 700, margin: '0 0 9px' }}>{g.label}</div>
                      {g.rows.map((s) => {
                        const dot = { pending: '#e08a1e', approved: '#1f9d57', rejected: '#d23a52' }[s.status] || '#0090ca';
                        const halo = { pending: 'rgba(224,138,30,.16)', approved: 'rgba(31,157,87,.16)', rejected: 'rgba(210,58,82,.16)' }[s.status] || 'rgba(0,144,202,.16)';
                        return (
                          <div key={s.id} onClick={() => setDetail(s)} title="Tap to view" style={{ display: 'flex', gap: 14, position: 'relative', paddingBottom: 16, cursor: 'pointer' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 26 }}>
                              <span style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0, marginTop: 3, background: dot, boxShadow: '0 0 0 4px ' + halo }} />
                              <span style={{ flex: 1, width: 2, background: 'linear-gradient(180deg,rgba(125,145,180,.3),rgba(125,145,180,.08))', borderRadius: 2, marginTop: 4 }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#16202e' }}>{targetOf(s)}</span>
                                <span style={typeChip(s)}>{typeOf(s)}</span>
                                {statusChip(s.status)}
                                <FixBtn s={s} />
                              </div>
                              <div style={{ fontSize: 11, color: '#6c7a8c', marginTop: 3 }}>
                                {refOf(s) ? <span style={{ fontFamily: "'IBM Plex Mono',monospace" }}>{refOf(s)}{' · '}</span> : null}
                                {monthLabel(s.month)}
                                {s.type === 'quality' && s.value != null && s.value !== '' ? <React.Fragment>{' · value '}<b style={{ color: '#3c4858', fontFamily: "'IBM Plex Mono',monospace" }}>{String(s.value)}</b></React.Fragment> : null}
                                {' · ' + ago(s.submittedAt)}
                              </div>
                              {rejNote(s)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: '#9aa6b4' }}>Rejected submissions show the administrator's reason — correct the figure and resubmit.</div>
                </div>
                : <React.Fragment>
                  <div style={{ overflowX: 'auto' }}><table className="tbl" style={{ width: '100%' }}>
                    <thead><tr><th>Submitted on</th>{isEdits ? <React.Fragment><th>Department</th><th>For</th><th>Reason</th></React.Fragment> : (isQ ? <React.Fragment><th>Area</th><th>Indicator</th><th>Quarter</th></React.Fragment> : <React.Fragment><th>Department</th><th>Month</th></React.Fragment>)}<th>Status</th><th></th></tr></thead>
                    <tbody>{listed.map((s) => (
                      <tr key={s.id} onClick={() => setDetail(s)} title="Tap to view" style={{ cursor: 'pointer' }}>
                        <td className="num" style={{ whiteSpace: 'nowrap' }}>{when(s.submittedAt)}</td>
                        {isEdits
                          ? <React.Fragment><td style={{ fontWeight: 600 }}>{s.type === 'quality' ? s.areaName : s.departmentName}</td><td>{(s.type === 'quality' ? (s.indicatorName || '') + ' · ' : '') + monthLabel(s.month)}</td><td style={{ fontSize: 12, color: 'var(--ink-2)', maxWidth: 260 }}>{s.correctionReason || '—'}{s.status === 'rejected' && s.rejectReason ? <div style={{ color: 'var(--rose)', fontSize: 11, marginTop: 2 }}>Rejected: {s.rejectReason}</div> : null}</td></React.Fragment>
                          : (isQ
                            ? <React.Fragment><td style={{ fontWeight: 600 }}>{s.areaName}</td><td style={{ fontWeight: 600 }}>{s.indicatorName}{rejNote(s)}</td><td>{s.quarter}</td></React.Fragment>
                            : <React.Fragment><td style={{ fontWeight: 600 }}>{s.departmentName}{rejNote(s)}</td><td>{monthLabel(s.month)}</td></React.Fragment>)}
                        <td>{statusChip(s.status)}</td>
                        <td style={{ textAlign: 'right' }}><div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, justifyContent: 'flex-end' }}><FixBtn s={s} /><button className="btn sm" onClick={() => setDetail(s)}><Ic d={I.search} s={13} />View</button></div></td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                  <div style={{ padding: '10px 16px', fontSize: 11, color: '#9aa6b4' }}>Rejected submissions show the administrator's reason — correct the figure and resubmit.</div>
                </React.Fragment>}
      </Card>
      {detail && <SubmissionDetail s={detail} canEdit={ownsSub(detail)} fullEdit={false} onClose={() => setDetail(null)} onSaved={() => { setDetail(null); load(); }} />}
      </>
    );
  }

  /* Submission-status board: which of the collector's assigned quality indicators are
     Recorded / Pending / Not-submitted for a chosen month. Responsive (auto-fit cards). */
  function CollectorStatus({ onFill }) {
    const dataRev = useDcDataRev();
    const areas = useMemo(() => (window.qualityData ? window.qualityData() : []).filter((a) => a && a.indicators && a.indicators.length), [dataRev]);
    const fyMonths = (window.QUALITY_QUARTER_MONTHS) ? ['Q1', 'Q2', 'Q3', 'Q4'].reduce((a, q) => a.concat(window.QUALITY_QUARTER_MONTHS[q] || []), []) : [];
    const monthOpts = dcWideMonths();
    const [month, setMonth] = useState(dcDefaultMonth() || (fyMonths.length ? fyMonths[fyMonths.length - 1] : '') || '');
    const [subs, setSubs] = useState(null);
    useEffect(() => { dcApi.get('/api/submissions?limit=500').then((r) => setSubs(r.ok ? (r.submissions || []) : [])).catch(() => setSubs([])); }, []);
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

  /* ============================ Data Collector portal ============================
     The collector's whole application, not a tab strip bolted onto the admin app: its
     own shell (dark sidebar, glass topbar) and a dashboard that opens on what is still
     outstanding rather than on an empty form.

     Everything on the dashboard is derived from the same two sources the rest of the
     module already trusts — the quality store (what is on record) and /api/submissions
     (what has been sent) — so the portal can never disagree with the admin's review
     queue. Nothing here is decorative-only: every number is clickable through to the
     form that changes it.  */

  const CP_CARD = {
    background: 'linear-gradient(152deg,rgba(255,255,255,.76),rgba(236,247,255,.46))',
    backdropFilter: 'blur(26px) saturate(1.75)', WebkitBackdropFilter: 'blur(26px) saturate(1.75)',
    border: '1px solid rgba(255,255,255,.92)', borderRadius: 16,
    boxShadow: '0 14px 42px rgba(31,59,90,.14),0 4px 16px rgba(0,144,202,.09),inset 0 1px 0 rgba(255,255,255,.95)',
  };
  // The in-charge nav opens on a ward Dashboard rather than on the submission board:
  // running a unit starts with who is on duty and what is outstanding, not with a form.
  const CP_NAV_HOME = ['home', 'Dashboard', 'M3 11l9-8 9 8v9a2 2 0 01-2 2h-4v-7H9v7H5a2 2 0 01-2-2z'];
  const CP_NAV_STAFFREQ = ['requests', 'Add nurse / PCA', 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M19 8v6M22 11h-6'];
  const CP_NAV_COLLECT = [
    ['status', 'Submission status', 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z'],
    ['quick', 'Quick entry', 'M13 2L4 14h7l-1 8 9-12h-7z'],
    ['quality', 'Quality data', 'M22 12h-4l-3 8-4-16-3 8H2'],
    ['patient', 'Patient statistics', 'M4 4h16v16H4zM4 9h16M9 4v16'],
  ];
  const CP_NAV_UNIT = [
    ['history', 'My submissions', 'M6 2h9l5 5v15H6zM15 2v5h5M9 13h7M9 17h7'],
    ['roster', 'Duty roster', 'M3 5h18v16H3zM3 9h18M8 3v4M16 3v4M8 13h3M13 13h3'],
    ['profile', 'My profile', 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0'],
    ['dept', 'Department & staff', 'M4 4h16v16H4zM4 9h16M9 4v16'],
  ];
  const CP_ICON = (d, s, c) => (
    <svg width={s || 17} height={s || 17} viewBox="0 0 24 24" fill="none" stroke={c || 'currentColor'} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
  );
  const cpChipStyle = (label) => {
    const c = { Missing: '#d23a52', Submitted: '#0090ca', Pending: '#e08a1e', Approved: '#1f9d57', Rejected: '#d23a52', Recorded: '#1f9d57' }[label] || '#6c7a8c';
    return { display: 'inline-flex', alignItems: 'center', fontSize: 10.5, fontWeight: 700, padding: '2px 10px', borderRadius: 12, color: c, background: c + '1a', whiteSpace: 'nowrap', flexShrink: 0 };
  };
  const cpInitials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  // The recorded number for one month: a count indicator stores it in `months`, a
  // rate/percentage indicator stores the numerator in `mNum`. Either way this is the
  // figure the collector actually typed, which is what the sparkline should show.
  const cpVal = (ind, m) => {
    const g = (o) => (o && o[m] != null && o[m] !== '' && !isNaN(Number(o[m]))) ? Number(o[m]) : null;
    const v = g(ind.months); return v == null ? g(ind.mNum) : v;
  };
  // "Is this indicator's month filled in?" -- ONE definition. The dashboard body and
  // the sidebar's progress ring both count from this; when each kept its own copy the
  // two silently disagreed for a month logged purely as incident entries.
  const cpHasData = (ind, m) => {
    const f = (o) => o && o[m] != null && o[m] !== '';
    return f(ind.mNum) || f(ind.mDen) || f(ind.months) || (ind.incidents && Array.isArray(ind.incidents[m]) && ind.incidents[m].length > 0);
  };
  // Most quality indicators are "lower is better", but not all -- hand hygiene,
  // certification and satisfaction rise when things improve. Colouring by the sign of
  // the change alone paints a real improvement red, so the direction is read from the
  // indicator rather than assumed.
  const cpImproved = (ind, first, last) => (ind && ind.goalDirection === 'higher_is_better') ? (last >= first) : (last <= first);
  // Monthly data is due by the end of the FOLLOWING month — the same rule the admin
  // analytics screen uses to decide whether a submission was on time.
  const cpDeadline = (mk) => {
    const p = String(mk || '').split('-'); const mi = MONS_ABBR.indexOf(p[0]); const yy = parseInt(p[1], 10);
    if (mi < 0 || isNaN(yy)) return null;
    return new Date(2000 + yy, mi + 2, 0, 23, 59, 59);
  };

  /* Sparkline over the six months ending at `month`. Returns null when there is not
     enough history to draw a line — an invented flat line would read as "stable". */
  function CpSpark({ ind, months }) {
    const vals = months.map((m) => cpVal(ind, m));
    const known = vals.filter((v) => v != null);
    if (known.length < 2) return <div style={{ width: 96, height: 28, flexShrink: 0 }} />;
    const mx = Math.max.apply(null, known), mn = Math.min.apply(null, known), rng = (mx - mn) || 1;
    const pts = [];
    vals.forEach((v, i) => { if (v != null) pts.push([4 + i * (88 / Math.max(1, months.length - 1)), 24 - ((v - mn) / rng) * 20]); });
    const first = known[0], last = known[known.length - 1];
    const color = cpImproved(ind, first, last) ? '#1f9d57' : '#d23a52';
    const lastPt = pts[pts.length - 1];
    return (
      <svg viewBox="0 0 96 28" style={{ width: 96, height: 28, flexShrink: 0 }}>
        <polyline points={pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={lastPt[0].toFixed(1)} cy={lastPt[1].toFixed(1)} r="2.6" fill={color} />
      </svg>
    );
  }
  function cpTrend(ind, months) {
    const vals = months.map((m) => cpVal(ind, m)).filter((v) => v != null);
    if (vals.length < 2) return null;
    const a = vals[0], b = vals[vals.length - 1];
    if (!a) return null;
    return Math.round(((b - a) / Math.abs(a)) * 100);
  }

  /* ---- Quick entry: the department-statistics sheet, as a spreadsheet -------------
     Months down, columns across, one department at a time. Typing in the empty row at
     the top adds a month; typing over an existing month raises a CORRECTION, exactly
     as the single-month form does — the grid is a faster way in, never a different
     set of rules. Enter / arrow keys move between cells. */
  function CollectorQuickGrid({ depts, onDone }) {
    const me = (typeof window !== 'undefined' && window.__UNICO_USER__) || {};
    const all = (depts && depts.length) ? depts : dcAllDepts();
    const [deptId, setDeptId] = useState((all[0] && all[0].id) || '');
    const dept = all.find((d) => d.id === deptId) || all[0];
    const [subs, setSubs] = useState([]);
    const [edits, setEdits] = useState({});          // { "month|colId": value }
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [undoStack, setUndoStack] = useState([]);
    const load = () => dcApi.get('/api/submissions?limit=300').then((r) => setSubs(r.ok ? r.submissions : [])).catch(() => {});
    useEffect(() => { load(); }, []);
    useEffect(() => { setEdits({}); setReason(''); setUndoStack([]); }, [deptId]);

    const cols = (dept && dept.cols) || [];
    const order = MO();
    // The twelve months ending at the current reporting month — a year of context is
    // what a monthly sheet is checked against, and more than that will not fit.
    const cur = dcDefaultMonth();
    const ci = Math.max(0, order.indexOf(cur));
    const rows = order.slice(Math.max(0, ci - 11), ci + 1).reverse();
    // A department's rows are POSITIONAL: data[i] belongs to months[i]. They do not
    // carry their own month, so matching on r.month silently finds nothing and every
    // month reads as blank. (A row that does carry one still wins.)
    const byMonth = {};
    const dMonths = (dept && dept.months) || [], dData = (dept && dept.data) || [];
    dMonths.forEach((m, i) => { if (dData[i]) byMonth[m] = dData[i]; });
    dData.forEach((r) => { if (r && r.month) byMonth[r.month] = r; });
    const subStatus = {};
    (subs || []).forEach((s) => { if (s.type === 'patient' && s.department === deptId && s.month && !subStatus[s.month]) subStatus[s.month] = s.status; });

    const cellVal = (m, cid) => {
      const k = m + '|' + cid;
      if (Object.prototype.hasOwnProperty.call(edits, k)) return edits[k];
      const r = byMonth[m]; const v = r && r[cid];
      return v == null ? '' : String(v);
    };
    const setCell = (m, cid, v) => {
      const k = m + '|' + cid;
      setUndoStack((u) => u.concat([{ k, prev: Object.prototype.hasOwnProperty.call(edits, k) ? edits[k] : undefined }]).slice(-80));
      setEdits((e) => Object.assign({}, e, { [k]: v }));
    };
    const undo = () => {
      const u = undoStack[undoStack.length - 1];
      if (!u) return;
      setUndoStack((s) => s.slice(0, -1));
      setEdits((e) => { const n = Object.assign({}, e); if (u.prev === undefined) delete n[u.k]; else n[u.k] = u.prev; return n; });
    };
    // Enter / arrows walk the grid the way a spreadsheet does.
    const gridKey = (e) => {
      const k = e.key;
      if (k !== 'Enter' && k !== 'ArrowDown' && k !== 'ArrowUp') return;
      const cell = e.target.closest('td'); if (!cell) return;
      const row = cell.parentElement, tbody = row.parentElement;
      const cIdx = Array.prototype.indexOf.call(row.children, cell);
      const rIdx = Array.prototype.indexOf.call(tbody.children, row);
      const target = tbody.children[rIdx + (k === 'ArrowUp' ? -1 : 1)];
      if (!target) return;
      const inp = target.children[cIdx] && target.children[cIdx].querySelector('input');
      if (inp) { e.preventDefault(); inp.focus(); inp.select(); }
    };

    // Which months the collector actually touched, and which of those overwrite data
    // that is already on record (those need a reason).
    const touched = Array.from(new Set(Object.keys(edits).filter((k) => String(edits[k]).trim() !== '').map((k) => k.split('|')[0])));
    const corrections = touched.filter((m) => byMonth[m] || subStatus[m] === 'approved');
    const blocked = touched.filter((m) => subStatus[m] === 'pending');

    const submit = () => {
      if (!dept) return;
      if (!touched.length) { toast('Nothing to submit — type a figure first.', 'error'); return; }
      if (blocked.length) { toast('A submission for ' + blocked.map(monthLabel).join(', ') + ' is already awaiting review.', 'error'); return; }
      if (corrections.length && !reason.trim()) { toast('Please say why you are changing months already on record.', 'error'); return; }
      setBusy(true);
      // One submission per month, so the admin reviews and applies them exactly as if
      // they had been sent from the single-month form.
      const jobs = touched.map((m) => {
        const values = {};
        cols.forEach((c) => { const v = cellVal(m, c.id); if (String(v).trim() !== '') values[c.id] = Number(v); });
        const isCorr = corrections.indexOf(m) >= 0;
        return dcApi.post('/api/submissions/patient', {
          department: dept.id, month: m, values,
          responsible: { name: me.name || '' }, note: '',
          isCorrection: isCorr, correctionReason: isCorr ? reason.trim() : '',
        });
      });
      Promise.all(jobs).then((rs) => {
        setBusy(false);
        const bad = rs.filter((r) => !r || !r.ok);
        if (bad.length) { toast((bad[0] && bad[0].error) || 'Some months could not be sent.', 'error'); return; }
        toast(touched.length + ' month' + (touched.length > 1 ? 's' : '') + ' sent for review', 'success');
        setEdits({}); setReason(''); setUndoStack([]); load(); if (onDone) onDone();
      }).catch(() => { setBusy(false); toast('Submission failed', 'error'); });
    };

    const selStyle = { padding: '9px 11px', borderRadius: 9, border: '1px solid rgba(125,145,180,.4)', background: 'rgba(255,255,255,.8)', fontFamily: 'inherit', fontSize: 12.5, color: '#16202e', outline: 'none' };
    const lbl = { fontSize: 10.5, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: '#7d8ea8' };

    if (!dept) return <div style={Object.assign({}, CP_CARD, { padding: 28, textAlign: 'center', color: '#6c7a8c' })}>No department is assigned to you yet — please contact your administrator.</div>;

    return (
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#16202e' }}>Quick entry — spreadsheet mode</div>
            <div style={{ fontSize: 11.5, color: '#6c7a8c' }}>Tab or Enter moves to the next cell · months already on record are editable and raise a correction.</div>
          </div>
          <span style={{ flex: 1 }} />
          <button onClick={undo} disabled={!undoStack.length} title="Undo last change" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(125,145,180,.35)', background: 'rgba(255,255,255,.7)', color: undoStack.length ? '#3c4858' : '#b6c0cc', padding: '7px 13px', borderRadius: 9, fontSize: 11.5, fontWeight: 700, cursor: undoStack.length ? 'pointer' : 'default', fontFamily: 'inherit' }}>
            {CP_ICON('M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3', 13)}Undo
          </button>
        </div>
        <div style={Object.assign({}, CP_CARD, { overflow: 'hidden', marginBottom: 14 })}>
          <div style={{ height: 3, background: 'linear-gradient(90deg,#3ab5a7,#0aa0d4,#0072a3)' }} />
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid rgba(125,145,180,.18)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 220 }}>
              <label style={lbl}>Department</label>
              <select value={deptId} onChange={(e) => setDeptId(e.target.value)} style={Object.assign({ width: '100%', boxSizing: 'border-box' }, selStyle)}>
                {all.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <span style={{ flex: 1 }} />
            <div style={{ fontSize: 11.5, color: '#6c7a8c' }}>
              {touched.length ? <b style={{ color: '#0072a3' }}>{touched.length} month{touched.length > 1 ? 's' : ''} edited</b> : 'No changes yet'}
              {corrections.length ? <span style={{ color: '#b5670a', fontWeight: 700 }}> · {corrections.length} correction{corrections.length > 1 ? 's' : ''}</span> : null}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }} onKeyDown={gridKey}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: 'rgba(240,247,255,.96)', textAlign: 'left', padding: '9px 14px', fontSize: 10.5, letterSpacing: '.5px', textTransform: 'uppercase', color: '#7d8ea8', borderBottom: '1px solid rgba(125,145,180,.25)', zIndex: 1 }}>Month</th>
                  {cols.map((c) => <th key={c.id} style={{ textAlign: 'right', padding: '9px 12px', fontSize: 10.5, letterSpacing: '.5px', textTransform: 'uppercase', color: '#7d8ea8', borderBottom: '1px solid rgba(125,145,180,.25)', whiteSpace: 'nowrap' }}>{c.label}</th>)}
                  <th style={{ textAlign: 'right', padding: '9px 14px', fontSize: 10.5, letterSpacing: '.5px', textTransform: 'uppercase', color: '#7d8ea8', borderBottom: '1px solid rgba(125,145,180,.25)' }}>State</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => {
                  const onRecord = !!byMonth[m];
                  const st = subStatus[m];
                  const state = st === 'pending' ? 'Pending' : st === 'rejected' ? 'Rejected' : (st === 'approved' || onRecord) ? 'Recorded' : 'Missing';
                  const rowEdited = cols.some((c) => Object.prototype.hasOwnProperty.call(edits, m + '|' + c.id));
                  return (
                    <tr key={m} style={{ background: rowEdited ? 'rgba(0,144,202,.07)' : (state === 'Missing' ? 'rgba(210,58,82,.045)' : 'transparent') }}>
                      <td style={{ position: 'sticky', left: 0, background: rowEdited ? 'rgba(226,243,252,.98)' : 'rgba(250,252,255,.96)', padding: '6px 14px', fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600, color: '#16202e', borderBottom: '1px solid rgba(125,145,180,.12)', whiteSpace: 'nowrap', zIndex: 1 }}>{monthLabel(m)}</td>
                      {cols.map((c) => (
                        <td key={c.id} style={{ padding: '4px 6px', borderBottom: '1px solid rgba(125,145,180,.12)' }}>
                          <input type="number" step="any" disabled={st === 'pending'}
                            value={cellVal(m, c.id)} onChange={(e) => setCell(m, c.id, e.target.value)}
                            style={{ width: '100%', minWidth: 74, maxWidth: 170, boxSizing: 'border-box', textAlign: 'right', padding: '6px 8px', border: '1px solid transparent', borderRadius: 7, background: st === 'pending' ? 'transparent' : 'rgba(255,255,255,.7)', fontFamily: "'IBM Plex Mono',monospace", fontSize: 12.5, color: st === 'pending' ? '#9aa6b4' : '#16202e', outline: 'none' }}
                            onFocus={(e) => { e.target.style.borderColor = '#27a8db'; e.target.style.background = '#fff'; }}
                            onBlur={(e) => { e.target.style.borderColor = 'transparent'; e.target.style.background = st === 'pending' ? 'transparent' : 'rgba(255,255,255,.7)'; }} />
                        </td>
                      ))}
                      <td style={{ padding: '6px 14px', textAlign: 'right', borderBottom: '1px solid rgba(125,145,180,.12)' }}><span style={cpChipStyle(state)}>{state}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        {corrections.length > 0 && (
          <div style={Object.assign({}, CP_CARD, { padding: '13px 16px', marginBottom: 14, borderLeft: '4px solid #e08a1e' })}>
            <div style={{ fontSize: 12, color: '#3c4858', marginBottom: 8, lineHeight: 1.55 }}>
              <b>{corrections.map(monthLabel).join(', ')}</b> {corrections.length > 1 ? 'are' : 'is'} already on record. Changing {corrections.length > 1 ? 'them' : 'it'} sends a correction to the administrator — live data is not overwritten until it is approved.
            </div>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this being corrected?"
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 9, border: '1px solid rgba(125,145,180,.4)', background: 'rgba(255,255,255,.85)', fontFamily: 'inherit', fontSize: 12.5, outline: 'none' }} />
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={submit} disabled={busy || !touched.length} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid rgba(255,255,255,.4)', background: touched.length ? 'linear-gradient(135deg,#27a8db,#0072a3)' : 'rgba(125,145,180,.25)', color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: touched.length && !busy ? 'pointer' : 'default', fontFamily: 'inherit', boxShadow: touched.length ? '0 8px 22px rgba(0,144,202,.4)' : 'none' }}>
            {CP_ICON('M20 6L9 17l-5-5', 15)}{busy ? 'Sending…' : 'Submit ' + (touched.length || '') + ' month' + (touched.length === 1 ? '' : 's')}
          </button>
          {touched.length > 0 && (
            <button onClick={() => { setEdits({}); setReason(''); setUndoStack([]); }} style={{ border: '1px solid rgba(125,145,180,.35)', background: 'rgba(255,255,255,.7)', color: '#3c4858', padding: '10px 16px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Discard changes</button>
          )}
        </div>
      </div>
    );
  }

  /* ---- Duty roster, read-only ----------------------------------------------------
     The collector sees the PUBLISHED sheet for their unit; they never edit it, and the
     server only ever hands them an approved one.

     The month picker is driven by the roster INDEX rather than by the department list.
     That is not a stylistic choice: a roster document is keyed by the department NAME
     the roster module uses (a staff `current_department` string such as "Emergency" or
     "CT ICU"), while dcAllDepts() yields statistics slugs ("er", "ctvs"). Building the
     URL from a slug asks for a document that cannot exist, and every month would read
     as "not drafted yet" even where an approved sheet is sitting in the database. */
  function CollectorRoster() {
    const [index, setIndex] = useState(null);       // published rosters visible to me
    const [pick, setPick] = useState(null);         // { dept, year, month }
    const [doc, setDoc] = useState(undefined);
    const R = window.UNICO_ROSTER;

    useEffect(() => {
      dcApi.get('/api/rosters')
        .then((r) => {
          const list = (r && r.ok ? (r.rosters || []) : [])
            .filter((x) => x && x.status === 'approved')
            .sort((x, y) => (y.year - x.year) || (y.month - x.month));
          setIndex(list);
          if (list.length) setPick({ dept: list[0].dept, year: list[0].year, month: list[0].month });
        })
        .catch(() => setIndex([]));
    }, []);

    useEffect(() => {
      if (!pick) return;
      setDoc(undefined);
      dcApi.get('/api/rosters/' + encodeURIComponent(pick.dept) + '/' + pick.year + '/' + pick.month)
        .then((r) => setDoc(r && r.ok ? r.roster : null)).catch(() => setDoc(null));
    }, [pick && pick.dept, pick && pick.year, pick && pick.month]);

    const selStyle = { padding: '8px 11px', borderRadius: 9, border: '1px solid rgba(125,145,180,.4)', background: 'rgba(255,255,255,.8)', fontFamily: 'inherit', fontSize: 12.5, outline: 'none' };
    const monthName = (m) => (R ? R.MONTHS[m] : String(m + 1));
    const units = index ? Array.from(new Set(index.map((x) => x.dept))) : [];
    const monthsFor = (dept) => (index || []).filter((x) => x.dept === dept);

    return (
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <div style={Object.assign({}, CP_CARD, { padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 })}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#16202e' }}>Duty roster</div>
            <div style={{ fontSize: 11.5, color: '#6c7a8c' }}>Published sheets only — read only. Drafts stay with the roster office until they are approved.</div>
          </div>
          <span style={{ flex: 1 }} />
          {index && index.length > 0 && pick && (
            <React.Fragment>
              <select value={pick.dept} onChange={(e) => { const d = e.target.value; const first = monthsFor(d)[0]; setPick({ dept: d, year: first.year, month: first.month }); }} style={selStyle}>
                {units.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <select value={pick.year + '|' + pick.month} onChange={(e) => { const p = e.target.value.split('|'); setPick({ dept: pick.dept, year: +p[0], month: +p[1] }); }} style={Object.assign({}, selStyle, { fontFamily: "'IBM Plex Mono',monospace" })}>
                {monthsFor(pick.dept).map((x) => <option key={x.year + '|' + x.month} value={x.year + '|' + x.month}>{monthName(x.month) + ' ' + x.year}</option>)}
              </select>
            </React.Fragment>
          )}
        </div>
        {index === null ? <div style={Object.assign({}, CP_CARD, { padding: 26, textAlign: 'center', color: '#6c7a8c' })}>Loading…</div>
          : index.length === 0 ? (
            <div style={Object.assign({}, CP_CARD, { padding: 28, textAlign: 'center', color: '#6c7a8c' })}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#16202e', marginBottom: 5 }}>No published roster yet</div>
              <div style={{ fontSize: 12 }}>Nothing has been approved for your unit. A roster appears here the moment it is published.</div>
            </div>
          ) : doc === undefined ? <div style={Object.assign({}, CP_CARD, { padding: 26, textAlign: 'center', color: '#6c7a8c' })}>Loading the sheet…</div>
            : !doc ? <div style={Object.assign({}, CP_CARD, { padding: 28, textAlign: 'center', color: '#6c7a8c' })}>That sheet is no longer published.</div>
              : (() => {
                const days = R ? R.daysIn(doc.year, doc.month) : 31;
                const dayNums = Array.from({ length: days }, (_, i) => i + 1);
                const people = (doc.order && doc.order.length ? doc.order : Object.keys(doc.grid || {}));
                const names = doc.names || {};
                return (
                  <div style={Object.assign({}, CP_CARD, { overflow: 'hidden' })}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderBottom: '1px solid rgba(125,145,180,.18)', flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#16202e' }}>{doc.deptName || doc.dept}</div>
                      <span style={{ fontSize: 11.5, color: '#9aa6b4', fontFamily: "'IBM Plex Mono',monospace" }}>{monthName(doc.month) + ' ' + doc.year}</span>
                      <span style={{ flex: 1 }} />
                      <span style={cpChipStyle('Approved')}>Published{doc.revision ? ' · rev ' + doc.revision : ''}</span>
                      {doc.approvedBy ? <span style={{ fontSize: 11, color: '#6c7a8c' }}>Approved by {doc.approvedBy}</span> : null}
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ borderCollapse: 'collapse', fontSize: 11.5 }}>
                        <thead>
                          <tr>
                            <th style={{ position: 'sticky', left: 0, background: 'rgba(240,247,255,.97)', textAlign: 'left', padding: '8px 12px', minWidth: 180, borderBottom: '1px solid rgba(125,145,180,.25)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.5px', color: '#7d8ea8', zIndex: 1 }}>Staff</th>
                            {dayNums.map((d) => (
                              <th key={d} style={{ padding: '6px 3px', minWidth: 30, borderBottom: '1px solid rgba(125,145,180,.25)', fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: '#7d8ea8' }}>{d}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {people.map((emp) => (
                            <tr key={emp}>
                              <td title={'Emp ID ' + emp} style={{ position: 'sticky', left: 0, background: 'rgba(250,252,255,.97)', padding: '5px 12px', borderBottom: '1px solid rgba(125,145,180,.12)', whiteSpace: 'nowrap', fontWeight: 600, color: '#16202e', zIndex: 1 }}>
                                {names[emp] || emp}
                              </td>
                              {dayNums.map((d) => {
                                const code = (doc.grid && doc.grid[emp] && doc.grid[emp][d]) || '';
                                const col = code && R ? (R.BUCKET_COLOR[R.bucketOf(code)] || '#8aa0b8') : null;
                                return (
                                  <td key={d} style={{ padding: '3px 2px', textAlign: 'center', borderBottom: '1px solid rgba(125,145,180,.12)' }}>
                                    {code ? <span title={(R && R.BY_CODE[code] ? R.BY_CODE[code].label : code)} style={{ display: 'inline-block', minWidth: 26, padding: '3px 4px', borderRadius: 7, background: col, color: '#fff', fontWeight: 700, fontSize: 10, fontFamily: "'IBM Plex Mono',monospace" }}>{code}</span> : null}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {R && (
                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', padding: '10px 14px', borderTop: '1px solid rgba(125,145,180,.18)' }}>
                        {R.BUCKETS.map((b) => (
                          <span key={b.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#6c7a8c' }}>
                            <span style={{ width: 12, height: 12, borderRadius: 4, background: b.color }} />{b.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
      </div>
    );
  }

  /* ---- My profile ----------------------------------------------------------------
     The person's own record, as the In-charge mockup lays it out: a dark identity hero,
     the details the hospital holds, and what they have actually done in the system.

     The account itself is the only thing the portal can read about them (the staff
     register is withheld from a collector scope by design), so the performance panel
     is built from their OWN submission history rather than from an appraisal they are
     not entitled to fetch. Nothing here is invented: an empty history says so. */
  function CollectorProfile({ user, onNav }) {
    // Self-service: a portal account maintains its OWN photo and contact details.
    // Everything that decides ACCESS (role, departments, quality areas) stays
    // read-only here and is refused by PATCH /api/me regardless of what we send.
    const [photo, setPhoto] = useState((user && user.photo) || null);
    const [name, setName] = useState((user && user.name) || '');
    const [designation, setDesignation] = useState((user && user.designation) || '');
    const [email, setEmail] = useState((user && user.email) || '');
    const [phone, setPhone] = useState((user && user.phone) || '');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState(null);
    const [cur, setCur] = useState(''); const [nw, setNw] = useState(''); const [nw2, setNw2] = useState('');
    const [pwBusy, setPwBusy] = useState(false); const [pwMsg, setPwMsg] = useState(null);

    const roleLabel = (user && user.role === 'incharge') ? 'In-charge' : 'Data Collector';
    const dirty = name !== ((user && user.name) || '') || designation !== ((user && user.designation) || '')
      || email !== ((user && user.email) || '') || phone !== ((user && user.phone) || '');

    const meApi = (method, path, body) => fetch(path, {
      method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => {
      let j = null; try { j = await r.json(); } catch (e) { }
      if (!r.ok || !j || j.ok === false) throw new Error((j && j.error) || ('Request failed (' + r.status + ').'));
      return j;
    });

    async function saveProfile() {
      setMsg(null); setBusy(true);
      try {
        await meApi('PATCH', '/api/me', { name, email, phone, designation });
        if (window.__UNICO_USER__) Object.assign(window.__UNICO_USER__, { name, email, phone, designation });
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
        await meApi('POST', '/api/me/password', { currentPassword: cur, newPassword: nw });
        setCur(''); setNw(''); setNw2('');
        setPwMsg({ kind: 'ok', text: 'Password changed.' });
      } catch (e) { setPwMsg({ kind: 'err', text: String((e && e.message) || e) }); }
      finally { setPwBusy(false); }
    }

    const cpInput = { padding: '7px 10px', border: '1px solid rgba(125,145,180,.28)', borderRadius: 7, fontSize: 12.5, fontFamily: 'inherit', width: '100%', outline: 'none', background: '#fff', boxSizing: 'border-box' };
    // Same row rhythm as row() above, but the value is an input.
    // `ac` is the autocomplete token: without one the browser treats a bare text box
    // beside a password form as a username field and fills the saved login into it.
    const edit = (label, val, set, placeholder, ac) => (
      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0', borderBottom: '1px solid rgba(125,145,180,.12)' }}>
        <span style={{ fontSize: 11.5, color: '#6c7a8c', width: 130, flexShrink: 0 }}>{label}</span>
        <input style={cpInput} name={ac} autoComplete={ac} value={val} placeholder={placeholder} onChange={(e) => set(e.target.value)} />
      </div>
    );

    const dataRev = useDcDataRev();
    const depts = useMemo(() => dcAllDepts(), [dataRev]);
    const areas = useMemo(() => (window.qualityData ? window.qualityData() : []).filter((a) => a && a.indicators && a.indicators.length), [dataRev]);
    const [subs, setSubs] = useState(null);
    useEffect(() => { dcApi.get('/api/submissions?limit=500').then((r) => setSubs(r.ok ? (r.submissions || []) : [])).catch(() => setSubs([])); }, []);
    const S = subs || [];

    const decided = S.filter((x) => x.status === 'approved' || x.status === 'rejected');
    const accuracy = decided.length ? Math.round(S.filter((x) => x.status === 'approved').length * 100 / decided.length) : null;
    const onTime = (() => {
      let n = 0, ok = 0;
      S.forEach((x) => { const dl = cpDeadline(x.month); if (!dl || !x.submittedAt) return; n++; if (x.submittedAt <= dl.getTime()) ok++; });
      return n ? { pct: Math.round(ok * 100 / n), n } : null;
    })();
    const indCount = areas.reduce((n, a) => n + a.indicators.length, 0);
    const when = (ts) => { try { return ts ? new Date(ts).toLocaleString() : '—'; } catch (e) { return '—'; } };
    const recent = S.slice().sort((x, y) => (y.submittedAt || 0) - (x.submittedAt || 0)).slice(0, 8);

    const HERO = { position: 'relative', overflow: 'hidden', borderRadius: 16, padding: '20px 22px', marginBottom: 14, color: '#fff', background: 'linear-gradient(160deg,#1b2c45,#0d1b2e 60%,#102138)', boxShadow: '0 18px 46px rgba(13,27,46,.28)', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' };
    const row = (label, val, mono) => (
      <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '9px 0', borderBottom: '1px solid rgba(125,145,180,.12)' }}>
        <span style={{ fontSize: 11.5, color: '#6c7a8c', width: 130, flexShrink: 0 }}>{label}</span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: val ? '#16202e' : '#b6c0cc', fontFamily: mono ? "'IBM Plex Mono',monospace" : 'inherit' }}>{val || 'Not recorded'}</span>
      </div>
    );
    const bar = (label, pct, val, color) => (
      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 11.5, color: '#6c7a8c', width: 118, flexShrink: 0 }}>{label}</span>
        <div style={{ flex: 1, height: 8, borderRadius: 5, background: 'rgba(125,145,180,.16)', overflow: 'hidden' }}>
          <div style={{ width: Math.max(0, Math.min(100, pct)) + '%', height: '100%', borderRadius: 5, background: color, transition: 'width .9s cubic-bezier(.2,.7,.3,1)' }} />
        </div>
        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11.5, fontWeight: 700, color: '#3c4858', width: 52, textAlign: 'right' }}>{val}</span>
      </div>
    );
    const stat = (v, l) => (
      <div key={l} style={{ textAlign: 'center', minWidth: 84 }}>
        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>{v}</div>
        <div style={{ fontSize: 10, color: '#8fa6c0', marginTop: 3, letterSpacing: '.4px' }}>{l}</div>
      </div>
    );

    return (
      <div style={{ maxWidth: 1260, margin: '0 auto' }}>
        <div style={HERO}>
          <div style={{ position: 'absolute', right: -70, top: -80, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,144,202,.30),transparent 68%)', filter: 'blur(10px)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <PhotoPicker
              value={photo} size={78} radius={18} kind="profile"
              initials={cpInitials(user.name)} name={user.name || 'My profile'}
              onChange={(next) => { setPhoto(next); window.unicoSetAccountPhoto(next); }}
            />
          </div>
          <div style={{ position: 'relative', minWidth: 220, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-.4px' }}>{user.name || 'My profile'}</div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 11px', borderRadius: 12, background: 'rgba(58,181,167,.22)', color: '#8ee6da', border: '1px solid rgba(58,181,167,.35)' }}>{roleLabel}</span>
            </div>
            <div style={{ fontSize: 12, color: '#a8bdd6', marginTop: 5, fontFamily: "'IBM Plex Mono',monospace" }}>
              {[user.username ? 'Staff ID ' + user.username : null, depts.map((d) => d.name).join(' · ') || null].filter(Boolean).join('  ·  ')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 11 }}>
              {areas.map((a) => (
                <span key={a.key} style={{ fontSize: 11, fontWeight: 600, padding: '4px 11px', borderRadius: 12, background: 'rgba(255,255,255,.09)', border: '1px solid rgba(255,255,255,.16)', color: '#cfe0f0' }}>{a.name}</span>
              ))}
            </div>
          </div>
          <div style={{ position: 'relative', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {stat(indCount, 'indicators')}
            {stat(depts.length, depts.length === 1 ? 'department' : 'departments')}
            {stat(subs === null ? '—' : S.length, 'submissions')}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14 }}>
          <div style={Object.assign({}, CP_CARD, { padding: '14px 17px' })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
              <span style={{ display: 'inline-grid', placeItems: 'center', width: 24, height: 24, borderRadius: 7, background: 'rgba(0,144,202,.12)', color: '#0072a3' }}>{CP_ICON('M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0', 13)}</span>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#16202e' }}>Details</h3>
            </div>
            {msg && <div style={{ fontSize: 12, fontWeight: 600, borderRadius: 8, padding: '8px 11px', marginBottom: 9, color: msg.kind === 'ok' ? '#0f6a39' : '#b4232f', background: msg.kind === 'ok' ? 'rgba(31,157,87,.10)' : 'rgba(210,58,82,.10)', border: '1px solid ' + (msg.kind === 'ok' ? 'rgba(31,157,87,.28)' : 'rgba(210,58,82,.28)') }}>{msg.text}</div>}
            {edit('Name', name, setName, 'Your full name', 'name')}
            {edit('Designation', designation, setDesignation, 'e.g. Nursing In-charge', 'organization-title')}
            {edit('Email', email, setEmail, 'name@unicohospitals.com', 'email')}
            {edit('Phone', phone, setPhone, '01XXXXXXXXX', 'tel')}
            {row('Staff ID', user.username, true)}
            {row('Role', roleLabel)}
            {row('Departments', depts.map((d) => d.name).join(', '))}
            {row('Quality areas', areas.map((a) => a.name).join(', '))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 11 }}>
              <span style={{ fontSize: 11, color: '#9aa6b4' }}>{dirty ? 'Unsaved changes' : 'Everything saved'}</span>
              <span style={{ flex: 1 }} />
              <button className="btn pri sm" onClick={saveProfile} disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save changes'}</button>
            </div>
            <div style={{ fontSize: 11, color: '#9aa6b4', marginTop: 9, lineHeight: 1.6 }}>
              Your photo and the details above are yours to maintain. Role, departments and
              quality areas are set by an administrator — ask them if those are wrong.
              Qualification, joining date and registration live on the staff register, which
              this portal is not permitted to read.
            </div>
          </div>

          <div style={Object.assign({}, CP_CARD, { padding: '14px 17px' })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
              <span style={{ display: 'inline-grid', placeItems: 'center', width: 24, height: 24, borderRadius: 7, background: 'rgba(0,144,202,.12)', color: '#0072a3' }}>{CP_ICON('M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4', 13)}</span>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#16202e' }}>Password</h3>
            </div>
            {pwMsg && <div style={{ fontSize: 12, fontWeight: 600, borderRadius: 8, padding: '8px 11px', margin: '6px 0 9px', color: pwMsg.kind === 'ok' ? '#0f6a39' : '#b4232f', background: pwMsg.kind === 'ok' ? 'rgba(31,157,87,.10)' : 'rgba(210,58,82,.10)', border: '1px solid ' + (pwMsg.kind === 'ok' ? 'rgba(31,157,87,.28)' : 'rgba(210,58,82,.28)') }}>{pwMsg.text}</div>}
            {[['Current password', cur, setCur, 'Enter current password'], ['New password', nw, setNw, 'At least 6 characters'], ['Confirm new', nw2, setNw2, 'Re-enter new password']].map(([l, v, set, ph]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0', borderBottom: '1px solid rgba(125,145,180,.12)' }}>
                <span style={{ fontSize: 11.5, color: '#6c7a8c', width: 130, flexShrink: 0 }}>{l}</span>
                <input type="password" style={cpInput} value={v} placeholder={ph} onChange={(e) => set(e.target.value)} />
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 11 }}>
              <button className="btn pri sm" onClick={savePassword} disabled={pwBusy || !cur || !nw}>{pwBusy ? 'Saving…' : 'Change password'}</button>
            </div>
          </div>

          <div style={Object.assign({}, CP_CARD, { padding: '14px 17px', display: 'flex', flexDirection: 'column', gap: 13 })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ display: 'inline-grid', placeItems: 'center', width: 24, height: 24, borderRadius: 7, background: 'rgba(58,181,167,.16)', color: '#12776c' }}>{CP_ICON('M22 12h-4l-3 8-4-16-3 8H2', 13)}</span>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#16202e' }}>My reporting record</h3>
              <span style={{ flex: 1 }} />
              {accuracy != null && <span style={cpChipStyle(accuracy >= 90 ? 'Approved' : accuracy >= 70 ? 'Submitted' : 'Missing')}>{accuracy >= 90 ? 'Excellent' : accuracy >= 70 ? 'Good' : 'Needs attention'}</span>}
            </div>
            {subs === null ? <div style={{ color: '#6c7a8c', fontSize: 12 }}>Loading…</div>
              : S.length === 0 ? <div style={{ color: '#6c7a8c', fontSize: 12, padding: '10px 0' }}>You have not sent anything yet. Once you do, your accuracy and timeliness appear here.</div>
                : (
                  <React.Fragment>
                    {accuracy != null && bar('Accepted first time', accuracy, accuracy + '%', 'linear-gradient(90deg,#3ab5a7,#1f9d57)')}
                    {onTime && bar('Sent on time', onTime.pct, onTime.pct + '%', 'linear-gradient(90deg,#27a8db,#0072a3)')}
                    {bar('Approved', S.length ? S.filter((x) => x.status === 'approved').length * 100 / S.length : 0, String(S.filter((x) => x.status === 'approved').length), 'linear-gradient(90deg,#8f7ce0,#5b45c4)')}
                    <div style={{ fontSize: 11, color: '#6c7a8c', lineHeight: 1.6, background: 'rgba(0,144,202,.08)', borderRadius: 9, padding: '9px 11px' }}>
                      {decided.length ? 'Measured over ' + decided.length + ' reviewed submission' + (decided.length === 1 ? '' : 's') + (onTime ? ', and ' + onTime.n + ' with a known deadline.' : '.') : 'Nothing has been reviewed yet, so accuracy cannot be measured.'}
                    </div>
                  </React.Fragment>
                )}
          </div>
        </div>

        <div style={Object.assign({}, CP_CARD, { overflow: 'hidden', marginTop: 14 })}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 16px', borderBottom: '1px solid rgba(125,145,180,.18)' }}>
            <span style={{ display: 'inline-grid', placeItems: 'center', width: 24, height: 24, borderRadius: 7, background: 'rgba(224,138,30,.14)', color: '#b5670a' }}>{CP_ICON('M12 8v4l3 3M12 2a10 10 0 100 20 10 10 0 000-20z', 13)}</span>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#16202e' }}>Recent activity</h3>
            <span style={{ flex: 1 }} />
            <span onClick={() => onNav('history')} style={{ fontSize: 11, fontWeight: 700, color: '#0072a3', cursor: 'pointer' }}>All submissions ›</span>
          </div>
          {subs === null ? <div style={{ padding: 20, color: '#6c7a8c' }}>Loading…</div>
            : recent.length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: '#6c7a8c', fontSize: 12 }}>Nothing yet.</div>
              : recent.map((x) => {
                const label = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' }[x.status] || 'Pending';
                const dot = { Pending: '#e08a1e', Approved: '#1f9d57', Rejected: '#d23a52' }[label];
                return (
                  <div key={x.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 16px', borderBottom: '1px solid rgba(125,145,180,.12)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, marginTop: 5, flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#16202e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {(x.type === 'quality' ? (x.indicatorName || x.areaName) : x.departmentName) + ' · ' + monthLabel(x.month)}{x.isCorrection ? ' · correction' : ''}
                      </div>
                      <div style={{ fontSize: 10.5, color: '#9aa6b4' }}>{when(x.submittedAt)}{x.status === 'rejected' && x.rejectReason ? ' — ' + x.rejectReason : ''}</div>
                    </div>
                    <span style={cpChipStyle(label)}>{label}</span>
                  </div>
                );
              })}
        </div>
      </div>
    );
  }

  /* ---- Department & staff --------------------------------------------------------
     What the collector reports on, and how much of it is already on record.

     There is deliberately NO staff roster here. The server withholds staff records
     from collectors by design (GET /api/staff returns an empty list for a collector
     scope, matching the "/" snapshot), so a staff panel could only ever render empty.
     Showing the department's own reporting history is both permitted and more use to
     the person filling the forms. */
  function CollectorDeptStaff() {
    const dataRev = useDcDataRev();
    const all = useMemo(() => dcAllDepts(), [dataRev]);
    const areas = useMemo(() => (window.qualityData ? window.qualityData() : []), [dataRev]);
    const order = MO();
    const cur = dcDefaultMonth();
    const ci = Math.max(0, order.indexOf(cur));
    const win = order.slice(Math.max(0, ci - 11), ci + 1);
    return (
      <div style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gap: 14 }}>
        <div style={Object.assign({}, CP_CARD, { padding: '14px 16px' })}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#16202e' }}>Department &amp; staff</div>
          <div style={{ fontSize: 11.5, color: '#6c7a8c' }}>What you report on, and how much of the last twelve months is on record.</div>
        </div>
        {all.length === 0 && <div style={Object.assign({}, CP_CARD, { padding: 28, textAlign: 'center', color: '#6c7a8c' })}>No department is assigned to you yet.</div>}
        {all.map((d) => {
          const ak = window.DEPTMAP ? (window.DEPTMAP.areasFromDepts([d.id]) || []) : [];
          const mine = areas.filter((a) => ak.indexOf(a.key) >= 0);
          const inds = mine.reduce((n, a) => n + ((a.indicators || []).length), 0);
          const have = new Set(d.months || []);
          const covered = win.filter((m) => have.has(m)).length;
          return (
            <div key={d.id} style={Object.assign({}, CP_CARD, { padding: '15px 17px' })}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-grid', placeItems: 'center', width: 32, height: 32, borderRadius: 10, background: 'rgba(0,144,202,.12)', color: '#0072a3', flexShrink: 0 }}>{CP_ICON('M4 4h16v16H4zM4 9h16M9 4v16', 17)}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#16202e' }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: '#9aa6b4' }}>{(d.cols || []).length} statistics column{(d.cols || []).length === 1 ? '' : 's'} · {inds} quality indicator{inds === 1 ? '' : 's'}{mine.length ? ' · ' + mine.map((a) => a.name).join(', ') : ''}</div>
                </div>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 11px', borderRadius: 12, color: covered === win.length ? '#1f9d57' : covered ? '#0072a3' : '#a92c42', background: (covered === win.length ? '#1f9d57' : covered ? '#0090ca' : '#d23a52') + '1a' }}>{covered}/{win.length} months on record</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                {(d.cols || []).map((c) => <span key={c.id} style={{ fontSize: 10.5, padding: '2px 9px', borderRadius: 12, background: 'rgba(0,144,202,.1)', color: '#0072a3', fontWeight: 600 }}>{c.label}</span>)}
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 13, flexWrap: 'wrap' }}>
                {win.map((m) => (
                  <span key={m} title={monthLabel(m) + (have.has(m) ? ' — on record' : ' — nothing recorded')}
                    style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 7, whiteSpace: 'nowrap', color: have.has(m) ? '#fff' : '#9aa6b4', background: have.has(m) ? 'linear-gradient(135deg,#3ab5a7,#0090ca)' : 'rgba(125,145,180,.14)' }}>{m}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /* ---- The dashboard the portal opens on ---------------------------------------- */
  function CollectorDash({ month, setMonth, onNav, onFill, user }) {
    const dataRev = useDcDataRev();
    const areas = useMemo(() => (window.qualityData ? window.qualityData() : []).filter((a) => a && a.indicators && a.indicators.length), [dataRev]);
    const depts = useMemo(() => dcAllDepts(), [dataRev]);
    const [subs, setSubs] = useState(null);
    const load = () => dcApi.get('/api/submissions?limit=500').then((r) => setSubs(r.ok ? (r.submissions || []) : [])).catch(() => setSubs([]));
    useEffect(() => { load(); }, []);
    useEffect(() => {
      const refresh = () => { if (document.visibilityState !== 'hidden') load(); };
      window.addEventListener('unico:data-refreshed', refresh);
      return () => window.removeEventListener('unico:data-refreshed', refresh);
    }, []);

    const S = subs || [];
    const hasData = (ind, m) => { const f = (o) => o && o[m] != null && o[m] !== ''; return f(ind.mNum) || f(ind.mDen) || f(ind.months) || (ind.incidents && Array.isArray(ind.incidents[m]) && ind.incidents[m].length > 0); };
    const pendingFor = (areaKey, ind, m) => S.some((s) => s.type === 'quality' && s.area === areaKey && s.month === m && s.status === 'pending' && (s.indicatorId === ind.id || (s.indicatorName || '').toLowerCase().trim() === (ind.name || '').toLowerCase().trim()));
    const statusOf = (areaKey, ind, m) => cpHasData(ind, m) ? 'Recorded' : pendingFor(areaKey, ind, m) ? 'Submitted' : 'Missing';

    let totalInd = 0, done = 0;
    const missing = [];
    areas.forEach((a) => a.indicators.forEach((ind) => {
      totalInd++;
      const st = statusOf(a.key, ind, month);
      if (st === 'Missing') missing.push({ area: a.key, ind }); else done++;
    }));
    const pct = totalInd ? Math.round(done * 100 / totalInd) : 0;
    const awaiting = S.filter((s) => s.status === 'pending').length;
    // A rejection is never cleared server-side: resubmitting inserts a NEW row and
    // leaves the rejected one in place for ever. Counting them raw would make "Needs
    // correction" a lifetime tally that only grows, so a rejection counts only while
    // nothing newer has been sent for the same target.
    const targetKey = (x) => (x.type === 'quality'
      ? 'q|' + x.area + '|' + (x.indicatorId || x.indicatorName || '')
      : 'p|' + x.department) + '|' + x.month;
    const newestOk = {};
    S.forEach((x) => { if (x.status === 'rejected') return; const k = targetKey(x); if (!(k in newestOk) || (x.submittedAt || 0) > newestOk[k]) newestOk[k] = (x.submittedAt || 0); });
    const rejected = S.filter((x) => x.status === 'rejected' && !(newestOk[targetKey(x)] > (x.submittedAt || 0))).length;

    // Department statistics for the month: on record, or sent and awaiting review.
    const deptDone = depts.filter((d) => ((d.months || []).indexOf(month) >= 0) || S.some((s) => s.type === 'patient' && s.department === d.id && s.month === month && s.status !== 'rejected')).length;
    const statGap = Math.max(0, depts.length - deptDone);

    const dl = cpDeadline(month);
    const overdueDays = dl ? Math.floor((Date.now() - dl.getTime()) / 864e5) : 0;
    const overdue = overdueDays > 0 && missing.length > 0;
    const ringColor = pct >= 90 ? '#1f9d57' : pct >= 60 ? '#0090ca' : pct >= 30 ? '#e08a1e' : '#d23a52';

    // Six months of history for the sparklines, ending at the reporting month.
    const order = MO();
    const mi = Math.max(0, order.indexOf(month));
    const win = order.slice(Math.max(0, mi - 5), mi + 1);

    const heroStyle = Object.assign({}, CP_CARD, { position: 'relative', overflow: 'hidden', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 14 });
    const ic = (bg, c) => ({ display: 'inline-grid', placeItems: 'center', width: 38, height: 38, borderRadius: 11, background: bg, color: c, flexShrink: 0 });

    const KPIS = [
      { val: totalInd, lbl: 'Assigned indicators', foot: 'across ' + areas.length + ' quality area' + (areas.length === 1 ? '' : 's'), icd: 'M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z', bg: 'rgba(0,144,202,.12)', c: '#0072a3' },
      { val: done, lbl: 'Sent this month', foot: pct + '% of your workload', icd: 'M20 6L9 17l-5-5', bg: 'rgba(31,157,87,.13)', c: '#1f9d57' },
      { val: awaiting, lbl: 'Awaiting review', foot: 'with the administrator', icd: 'M12 8v4l3 3M12 2a10 10 0 100 20 10 10 0 000-20z', bg: 'rgba(224,138,30,.14)', c: '#b5670a' },
      { val: rejected, lbl: 'Needs correction', foot: rejected ? 'rejected — fix and resubmit' : 'nothing rejected', icd: 'M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0zM12 9v4M12 17h.01', bg: 'rgba(210,58,82,.13)', c: '#a92c42' },
    ];
    const QUICK = [
      { go: 'quick', label: 'Quick entry', sub: 'Spreadsheet grid for department statistics', cta: 'Open grid', tone: '#0072a3', glow: 'rgba(0,144,202,.22)', badge: statGap > 0 ? statGap + ' missing' : '', icd: 'M13 2L4 14h7l-1 8 9-12h-7z', bg: 'rgba(0,144,202,.12)', c: '#0072a3' },
      { go: 'quality', label: 'Quality data', sub: 'One indicator at a time with the HQI guide', cta: 'Enter data', tone: '#1f9d57', glow: 'rgba(58,181,167,.22)', badge: missing.length ? missing.length + ' missing' : '', icd: 'M22 12h-4l-3 8-4-16-3 8H2', bg: 'rgba(58,181,167,.16)', c: '#12776c' },
      { go: 'patient', label: 'Patient statistics', sub: 'Monthly figures per department', cta: 'Fill month', tone: '#5b45c4', glow: 'rgba(106,82,212,.2)', badge: statGap > 0 ? statGap + ' left' : '', icd: 'M4 4h16v16H4zM4 9h16M9 4v16', bg: 'rgba(106,82,212,.14)', c: '#5b45c4' },
      { go: 'history', label: 'My submissions', sub: 'Everything you have sent and its status', cta: 'Open list', tone: '#b5670a', glow: 'rgba(224,138,30,.2)', badge: awaiting ? awaiting + ' pending' : '', icd: 'M6 2h9l5 5v15H6zM15 2v5h5M9 13h7M9 17h7', bg: 'rgba(224,138,30,.14)', c: '#b5670a' },
    ];
    const CAL = [
      { lbl: 'Quality indicators', val: done + '/' + totalInd, p: totalInd ? done / totalInd : 0, c: 'linear-gradient(90deg,#3ab5a7,#1f9d57)' },
      { lbl: 'Department stats', val: deptDone + '/' + depts.length, p: depts.length ? deptDone / depts.length : 0, c: 'linear-gradient(90deg,#27a8db,#0072a3)' },
      { lbl: 'Awaiting review', val: awaiting + '/' + S.length, p: S.length ? awaiting / S.length : 0, c: 'linear-gradient(90deg,#8f7ce0,#5b45c4)' },
    ];
    const activity = S.slice().sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0)).slice(0, 6);
    const when = (ts) => { try { return ts ? new Date(ts).toLocaleString() : '—'; } catch (e) { return '—'; } };
    const stLabel = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };

    const monthOpts = dcWideMonths();
    const first = String(user.name || '').trim().split(/\s+/)[0] || 'there';

    return (
      <div style={{ maxWidth: 1260, margin: '0 auto' }}>
        <div style={heroStyle}>
          <div style={{ position: 'absolute', right: -60, top: -70, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,144,202,.2),transparent 70%)', filter: 'blur(10px)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', minWidth: 230, flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#16202e', letterSpacing: '-.2px' }}>Welcome back, {first}</div>
            <div style={{ fontSize: 12, color: '#6c7a8c', marginTop: 3 }}>
              {subs === null ? 'Loading your workload…'
                : missing.length === 0 ? 'Everything assigned to you for ' + monthLabel(month) + ' has been sent. Nothing is outstanding.'
                  : overdue ? 'The ' + monthLabel(month) + ' window closed ' + overdueDays + ' day' + (overdueDays === 1 ? '' : 's') + ' ago — ' + missing.length + ' indicator' + (missing.length === 1 ? ' is' : 's are') + ' still outstanding.'
                    : missing.length + ' indicator' + (missing.length === 1 ? '' : 's') + ' still to send for ' + monthLabel(month) + '.'}
            </div>
          </div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <svg viewBox="0 0 64 64" style={{ width: 64, height: 64, transform: 'rotate(-90deg)' }}>
                <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(125,145,180,.18)" strokeWidth="7" />
                <circle cx="32" cy="32" r="26" fill="none" stroke={ringColor} strokeWidth="7" strokeLinecap="round" strokeDasharray="163.4" strokeDashoffset={163.4 * (1 - pct / 100)} style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.2,.7,.3,1), stroke .3s' }} />
              </svg>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: '#7d8ea8', marginTop: 4 }}>{pct}% complete</div>
            </div>
            <select value={month} onChange={(e) => setMonth(e.target.value)} title="Reporting month"
              style={{ padding: '9px 11px', borderRadius: 10, border: '1px solid rgba(255,255,255,.85)', background: 'rgba(255,255,255,.65)', fontFamily: "'IBM Plex Mono',monospace", fontSize: 12.5, fontWeight: 700, color: '#3c4858', outline: 'none' }}>
              {monthOpts.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              <button onClick={() => onNav('quick')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid rgba(255,255,255,.4)', background: 'linear-gradient(135deg,#27a8db,#0072a3)', color: '#fff', padding: '9px 15px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 22px rgba(0,144,202,.4)' }}>
                {CP_ICON('M13 2L4 14h7l-1 8 9-12h-7z', 14)}Quick entry{statGap ? ' (' + statGap + ')' : ''}
              </button>
              <button onClick={() => onNav('patient')} style={{ border: '1px solid rgba(255,255,255,.85)', background: 'rgba(255,255,255,.6)', color: '#3c4858', padding: '9px 15px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Patient statistics</button>
            </div>
          </div>
        </div>

        {overdue && (
          <div style={{ background: 'rgba(255,236,238,.7)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: '1px solid rgba(210,58,82,.3)', borderLeft: '4px solid #d23a52', borderRadius: 12, padding: '11px 15px', display: 'flex', alignItems: 'center', gap: 11, marginBottom: 14, boxShadow: '0 8px 24px rgba(210,58,82,.12)', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-grid', placeItems: 'center', width: 30, height: 30, borderRadius: 9, background: 'rgba(210,58,82,.14)', color: '#a92c42', flexShrink: 0 }}>{CP_ICON('M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0zM12 9v4M12 17h.01', 15)}</span>
            <div style={{ flex: 1, minWidth: 200, fontSize: 12, color: '#3c4858', lineHeight: 1.55 }}>
              <b>{missing.length} indicator{missing.length === 1 ? ' is' : 's are'} past the deadline.</b> The {monthLabel(month)} window closed on {dl.toLocaleDateString()} — submit today to clear the flag.
            </div>
            <button onClick={() => onNav('quality')} style={{ border: '1px solid rgba(210,58,82,.35)', background: 'rgba(255,255,255,.7)', color: '#a92c42', padding: '7px 13px', borderRadius: 9, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Fix now ›</button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 14 }}>
          {KPIS.map((k) => (
            <div key={k.lbl} style={Object.assign({}, CP_CARD, { padding: '14px 16px' })}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={ic(k.bg, k.c)}>{CP_ICON(k.icd, 18)}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 21, fontWeight: 700, color: '#16202e', lineHeight: 1.15 }}>{k.val}</div>
                  <div style={{ fontSize: 11, color: '#6c7a8c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.lbl}</div>
                </div>
              </div>
              <div style={{ fontSize: 10.5, color: '#9aa6b4', marginTop: 8 }}>{k.foot}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(168px,1fr))', gap: 12, marginBottom: 14 }}>
          {QUICK.map((n) => (
            <div key={n.go} onClick={() => onNav(n.go)} style={Object.assign({}, CP_CARD, { position: 'relative', overflow: 'hidden', padding: '14px 16px', cursor: 'pointer' })}>
              <div style={{ position: 'absolute', right: -30, top: -34, width: 110, height: 100, borderRadius: '50%', background: 'radial-gradient(circle,' + n.glow + ',transparent 70%)', filter: 'blur(8px)', pointerEvents: 'none' }} />
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={ic(n.bg, n.c)}>{CP_ICON(n.icd, 17)}</span>
                {n.badge ? <span style={{ marginLeft: 'auto', fontSize: 10, fontFamily: "'IBM Plex Mono',monospace", background: 'rgba(224,138,30,.18)', color: '#b5670a', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>{n.badge}</span> : null}
              </div>
              <div style={{ position: 'relative', marginTop: 11 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#16202e' }}>{n.label}</div>
                <div style={{ fontSize: 10.5, color: '#6c7a8c', lineHeight: 1.45, marginTop: 2 }}>{n.sub}</div>
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 5, marginTop: 10, fontSize: 11, fontWeight: 700, color: n.tone }}>
                {n.cta}{CP_ICON('M5 12h14M13 6l6 6-6 6', 12)}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14, marginBottom: 14 }}>
          <div style={Object.assign({}, CP_CARD, { overflow: 'hidden' })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 16px', borderBottom: '1px solid rgba(125,145,180,.18)' }}>
              <span style={{ display: 'inline-grid', placeItems: 'center', width: 24, height: 24, borderRadius: 7, background: 'rgba(0,144,202,.12)', color: '#0072a3', flexShrink: 0 }}>{CP_ICON('M12 8v4l3 3M12 2a10 10 0 100 20 10 10 0 000-20z', 13)}</span>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#16202e' }}>Recent activity</h3>
              <span style={{ flex: 1 }} />
              <span onClick={() => onNav('history')} style={{ fontSize: 11, fontWeight: 700, color: '#0072a3', cursor: 'pointer' }}>All submissions ›</span>
            </div>
            {subs === null ? <div style={{ padding: 20, color: '#6c7a8c' }}>Loading…</div>
              : activity.length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: '#6c7a8c', fontSize: 12 }}>Nothing submitted yet.</div>
                : activity.map((a) => {
                  const label = stLabel[a.status] || 'Pending';
                  const dot = { Pending: '#e08a1e', Approved: '#1f9d57', Rejected: '#d23a52' }[label];
                  return (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 16px', borderBottom: '1px solid rgba(125,145,180,.12)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, marginTop: 5, flexShrink: 0 }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#16202e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {(a.type === 'quality' ? (a.indicatorName || a.areaName) : a.departmentName) + ' · ' + monthLabel(a.month)}
                        </div>
                        <div style={{ fontSize: 10.5, color: '#9aa6b4' }}>{when(a.submittedAt)}</div>
                      </div>
                      <span style={cpChipStyle(label)}>{label}</span>
                    </div>
                  );
                })}
          </div>
          <div style={Object.assign({}, CP_CARD, { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ display: 'inline-grid', placeItems: 'center', width: 24, height: 24, borderRadius: 7, background: 'rgba(224,138,30,.14)', color: '#b5670a', flexShrink: 0 }}>{CP_ICON('M3 5h18v16H3zM3 9h18M8 3v4M16 3v4', 13)}</span>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#16202e' }}>Reporting calendar</h3>
              <span style={{ flex: 1 }} />
              <span style={cpChipStyle(overdue ? 'Missing' : 'Approved')}>{overdue ? overdueDays + ' day' + (overdueDays === 1 ? '' : 's') + ' overdue' : 'On schedule'}</span>
            </div>
            {CAL.map((c) => (
              <div key={c.lbl} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11.5, color: '#6c7a8c', width: 116, flexShrink: 0 }}>{c.lbl}</span>
                <div style={{ flex: 1, height: 8, borderRadius: 5, background: 'rgba(125,145,180,.16)', overflow: 'hidden' }}>
                  <div style={{ width: Math.round(c.p * 100) + '%', height: '100%', borderRadius: 5, background: c.c, transition: 'width .9s cubic-bezier(.2,.7,.3,1)' }} />
                </div>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11.5, fontWeight: 700, color: '#3c4858', width: 54, textAlign: 'right' }}>{c.val}</span>
              </div>
            ))}
            <div style={{ fontSize: 11, color: '#3c4858', lineHeight: 1.6, background: 'rgba(0,144,202,.08)', borderRadius: 9, padding: '9px 11px' }}>
              {dl ? (overdueDays > 0
                ? monthLabel(month) + ' was due by ' + dl.toLocaleDateString() + ' — clear the backlog before the next window opens.'
                : monthLabel(month) + ' is due by ' + dl.toLocaleDateString() + ' — ' + Math.max(0, -overdueDays) + ' day' + (Math.abs(overdueDays) === 1 ? '' : 's') + ' left.')
                : 'Monthly data is due by the end of the following month.'}
            </div>
          </div>
        </div>

        {subs === null ? <div style={Object.assign({}, CP_CARD, { padding: 24, color: '#6c7a8c' })}>Loading indicators…</div>
          : areas.length === 0 ? <div style={Object.assign({}, CP_CARD, { padding: 28, textAlign: 'center', color: '#6c7a8c' })}>No quality indicators are assigned to you yet.</div>
            : areas.map((a) => {
              let ok = 0;
              a.indicators.forEach((ind) => { if (statusOf(a.key, ind, month) !== 'Missing') ok++; });
              const apct = a.indicators.length ? Math.round(ok * 100 / a.indicators.length) : 0;
              const tone = apct === 100 ? '#1f9d57' : apct >= 50 ? '#0090ca' : apct > 0 ? '#e08a1e' : '#d23a52';
              return (
                <div key={a.key} style={Object.assign({}, CP_CARD, { position: 'relative', marginBottom: 12, overflow: 'hidden' })}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: tone }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 16px 12px 22px', borderBottom: '1px solid rgba(125,145,180,.18)', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-grid', placeItems: 'center', width: 28, height: 28, borderRadius: 9, background: tone + '1f', color: tone, flexShrink: 0 }}>{CP_ICON('M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z', 15)}</span>
                    <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#16202e' }}>{a.name}</h3>
                    <span style={{ fontSize: 11, color: '#9aa6b4' }}>{a.indicators.length} indicator{a.indicators.length === 1 ? '' : 's'}</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 12, color: tone, background: tone + '1a' }}>{apct}% for {monthLabel(month)}</span>
                  </div>
                  {a.indicators.map((ind) => {
                    const st = statusOf(a.key, ind, month);
                    const tr = cpTrend(ind, win);
                    return (
                      <div key={ind.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px 10px 22px', borderBottom: '1px solid rgba(125,145,180,.12)', flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 190, flex: 1 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#16202e' }}>{ind.name}</div>
                          <div style={{ fontSize: 10.5, color: '#9aa6b4' }}>{[ind.formula === 'count' ? 'Count' : ind.formula === 'rate' ? 'Rate' : 'Percentage', ind.benchmark ? 'benchmark ' + ind.benchmark : null].filter(Boolean).join(' · ')}</div>
                        </div>
                        <CpSpark ind={ind} months={win} />
                        {tr != null ? <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 12, fontFamily: "'IBM Plex Mono',monospace", color: cpImproved(ind, 0, tr) ? '#1f9d57' : '#d23a52', background: (cpImproved(ind, 0, tr) ? '#1f9d57' : '#d23a52') + '1a' }}>{(tr > 0 ? '+' : '') + tr}%</span> : <span style={{ width: 46 }} />}
                        <span style={cpChipStyle(st)}>{st}</span>
                        {st === 'Missing' && (
                          <button onClick={() => onFill(a.key, ind.id, month)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid rgba(0,144,202,.3)', background: 'rgba(0,144,202,.08)', color: '#0072a3', padding: '5px 12px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Fill now ›</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
      </div>
    );
  }

  /* ---- Ward dashboard (in-charge only) --------------------------------------------
     Where running a unit actually starts: who is on duty right now, how much of the
     month's reporting is done, and what is waiting on somebody. Every tile is a way
     into the screen that changes it — a dashboard that cannot be acted on is a poster.

     "On duty right now" is read from the unit's PUBLISHED roster and the wall clock.
     When there is no published roster it says so rather than showing an empty ward,
     because "nobody is on duty" and "nobody has published the sheet" are very
     different things to tell a nurse in charge. */
  function CollectorHome({ user, month, onNav }) {
    const dataRev = useDcDataRev();
    const depts = useMemo(() => dcAllDepts(), [dataRev]);
    const areas = useMemo(() => (window.qualityData ? window.qualityData() : []).filter((a) => a && a.indicators && a.indicators.length), [dataRev]);
    const [subs, setSubs] = useState(null);
    const [staff, setStaff] = useState(null);
    const [reqs, setReqs] = useState(null);
    const [duty, setDuty] = useState(undefined);   // undefined = loading, null = none published
    const R = window.UNICO_ROSTER;
    const order = MO();

    useEffect(() => {
      dcApi.get('/api/submissions?limit=500').then((r) => setSubs(r.ok ? (r.submissions || []) : [])).catch(() => setSubs([]));
      dcApi.get('/api/staff').then((r) => setStaff(r.ok ? (r.staff || []) : [])).catch(() => setStaff([]));
      dcApi.get('/api/staff-requests').then((r) => setReqs(r.ok ? (r.requests || []) : [])).catch(() => setReqs([]));
      const now = new Date();
      dcApi.get('/api/rosters').then((r) => {
        const list = (r && r.ok ? (r.rosters || []) : []).filter((x) => x && x.status === 'approved' && x.year === now.getFullYear() && x.month === now.getMonth());
        if (!list.length) { setDuty(null); return; }
        const pick = list[0];
        return dcApi.get('/api/rosters/' + encodeURIComponent(pick.dept) + '/' + pick.year + '/' + pick.month)
          .then((rr) => setDuty(rr && rr.ok ? rr.roster : null));
      }).catch(() => setDuty(null));
    }, []);

    const S = subs || [];
    let totalInd = 0, missing = 0;
    areas.forEach((a) => a.indicators.forEach((ind) => {
      totalInd++;
      const sent = cpHasData(ind, month) || S.some((x) => x.type === 'quality' && x.area === a.key && x.month === month && x.status === 'pending' && (x.indicatorId === ind.id || (x.indicatorName || '').toLowerCase().trim() === (ind.name || '').toLowerCase().trim()));
      if (!sent) missing++;
    }));
    const pct = totalInd ? Math.round((totalInd - missing) * 100 / totalInd) : 0;
    const pendingReqs = (reqs || []).filter((r) => r.status === 'pending' || r.status === 'changes').length;

    /* Reporting completeness over the six months ending at the current one.

       The mockup charts a "quality trend". This charts REPORTING COMPLETENESS and says
       so, because a single number for a unit's clinical quality does not exist in this
       data: the indicators are measured in different units, in both directions, against
       benchmarks written as free text. Averaging them would produce a confident-looking
       figure that means nothing. How much of what the ward owes has actually been filed
       is a real number, it is the thing this dashboard is for, and the ward can act on it. */
    const mi = Math.max(0, order.indexOf(month));
    const trendMonths = order.slice(Math.max(0, mi - 5), mi + 1);
    const trend = trendMonths.map((m) => {
      let t = 0, done = 0;
      areas.forEach((a) => a.indicators.forEach((ind) => {
        t++;
        if (cpHasData(ind, m) || S.some((x) => x.type === 'quality' && x.area === a.key && x.month === m && x.status !== 'rejected')) done++;
      }));
      return { m: m, pct: t ? Math.round(done * 100 / t) : 0, n: done, of: t };
    });
    const trendAvg = trend.length ? Math.round(trend.reduce((n, p) => n + p.pct, 0) / trend.length) : 0;

    // Everything that is waiting on somebody, newest concern first. Each row is a way
    // into the screen that clears it -- a list you cannot act on is just a worry.
    const rejectedOpen = (() => {
      const key = (x) => (x.type === 'quality' ? 'q|' + x.area + '|' + (x.indicatorId || x.indicatorName || '') : 'p|' + x.department) + '|' + x.month;
      const newest = {};
      S.forEach((x) => { if (x.status === 'rejected') return; const k = key(x); if (!(k in newest) || (x.submittedAt || 0) > newest[k]) newest[k] = (x.submittedAt || 0); });
      return S.filter((x) => x.status === 'rejected' && !(newest[key(x)] > (x.submittedAt || 0)));
    })();
    const attention = [];
    if (missing) attention.push({ tone: '#b5670a', bg: 'rgba(224,138,30,.14)', title: missing + ' indicator' + (missing === 1 ? '' : 's') + ' outstanding', body: monthLabel(month) + ' is not complete yet.', go: 'status', icd: 'M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z' });
    if (rejectedOpen.length) attention.push({ tone: '#a92c42', bg: 'rgba(210,58,82,.13)', title: rejectedOpen.length + ' submission' + (rejectedOpen.length === 1 ? '' : 's') + ' sent back', body: 'Rejected and not yet resubmitted.', go: 'history', icd: 'M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0zM12 9v4M12 17h.01' });
    if (duty === null) attention.push({ tone: '#5b45c4', bg: 'rgba(106,82,212,.14)', title: 'No roster published this month', body: 'Nobody can see who is on duty until it is approved.', go: 'roster', icd: 'M3 5h18v16H3zM3 9h18M8 3v4M16 3v4' });
    if (pendingReqs) attention.push({ tone: '#0072a3', bg: 'rgba(0,144,202,.12)', title: pendingReqs + ' staff request' + (pendingReqs === 1 ? '' : 's') + ' open', body: 'Waiting on the administrator.', go: 'requests', icd: 'M19 8v6M22 11h-6M9 11a4 4 0 100-8 4 4 0 000 8M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2' });

    // Unit at a glance -- the same compliance facts the staff table shows, summarised.
    const yrs = (staff || []).map((p) => Number(p.total_experience_years)).filter((n) => !isNaN(n) && n > 0);
    const glance = [
      [(staff || []).length, 'staff in unit'],
      [yrs.length ? (yrs.reduce((x, y) => x + y, 0) / yrs.length).toFixed(1) : '—', 'avg. years experience'],
      [(staff || []).filter((p) => CP_HEPB_DONE(p.hepatitis_b_vaccination)).length, 'Hep-B complete'],
      [(staff || []).filter((p) => { const t = String(p.hepatitis_b_vaccination || '').trim().toLowerCase(); return !t || t === 'unknown'; }).length, 'vaccination unknown'],
    ];

    // What is actually coming up, from the calendar rather than from a fixture.
    const dl = cpDeadline(month);
    const now = new Date();
    const week = [];
    if (dl) {
      const days = Math.ceil((dl.getTime() - now.getTime()) / 864e5);
      week.push(days >= 0
        ? { day: dl.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dl.getMonth()], title: monthLabel(month) + ' reporting closes', sub: days === 0 ? 'Today' : days + ' day' + (days === 1 ? '' : 's') + ' left', tone: days <= 3 ? '#a92c42' : '#0072a3' }
        : { day: 'Overdue', title: monthLabel(month) + ' reporting closed', sub: Math.abs(days) + ' day' + (Math.abs(days) === 1 ? '' : 's') + ' ago', tone: '#a92c42' });
    }
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    week.push({ day: '1 ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][nextMonthStart.getMonth()], title: 'Next roster is due', sub: 'Publish before the month starts', tone: '#5b45c4' });
    if (rejectedOpen.length) week.push({ day: 'Now', title: 'Resubmit ' + rejectedOpen.length + ' returned item' + (rejectedOpen.length === 1 ? '' : 's'), sub: 'Blocking this cycle', tone: '#a92c42' });

    // Who is on duty now: today's shift code for each person, kept if the current time
    // falls inside that code's bucket. Buckets, not exact clock times, because the
    // legend's hours are text and a ward only needs "morning / evening / night".
    const SHIFT_ROWS = [
      { id: 'G', label: 'General duty', window: '9 AM – 5 PM', rule: '' },
      { id: 'M', label: 'Morning', window: '7 AM – 3 PM', rule: 'minMorning' },
      { id: 'E', label: 'Evening', window: '2 PM – 10 PM', rule: 'minEvening' },
      { id: 'N', label: 'Night', window: '9 PM – 7 AM', rule: 'minNight' },
    ];
    const today = (() => {
      if (!duty || !R) return null;
      const day = new Date().getDate();
      const h = new Date().getHours();
      const by = { G: [], M: [], E: [], N: [] };
      const names = duty.names || {};
      Object.keys(duty.grid || {}).forEach((emp) => {
        const code = duty.grid[emp][day];
        if (!code) return;
        const b = R.bucketOf(code);
        if (by[b]) by[b].push({ emp, name: names[emp] || emp, code });
      });
      return { by, now: h >= 7 && h < 14 ? 'M' : h >= 14 && h < 21 ? 'E' : 'N' };
    })();
    const onDutyNow = today ? (today.by[today.now] || []).length + (today.by.G || []).length : null;

    const first = String(user.name || '').trim().split(/\s+/)[0] || 'there';
    const ic = (bg, c) => ({ display: 'inline-grid', placeItems: 'center', width: 38, height: 38, borderRadius: 11, background: bg, color: c, flexShrink: 0 });
    const TILES = [
      { val: (staff || []).length, lbl: 'Staff on my unit', foot: staff === null ? 'loading…' : ((staff || []).filter((p) => (p.role || '') !== 'PCA').length + ' nurses'), go: 'unit', icd: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8', bg: 'rgba(0,144,202,.12)', c: '#0072a3' },
      { val: onDutyNow == null ? '—' : onDutyNow, lbl: 'On duty right now', foot: today ? ((SHIFT_ROWS.find((x) => x.id === today.now) || {}).label + ' shift') : (duty === undefined ? 'loading…' : 'no published roster'), go: 'roster', icd: 'M12 8v4l3 3M12 2a10 10 0 100 20 10 10 0 000-20z', bg: 'rgba(58,181,167,.16)', c: '#12776c' },
      { val: missing, lbl: 'Indicators outstanding', foot: pct + '% of ' + monthLabel(month) + ' complete', go: 'status', icd: 'M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z', bg: 'rgba(224,138,30,.14)', c: '#b5670a' },
      { val: pendingReqs, lbl: 'Staff requests open', foot: pendingReqs ? 'awaiting the administrator' : 'nothing outstanding', go: 'requests', icd: 'M19 8v6M22 11h-6M9 11a4 4 0 100-8 4 4 0 000 8M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2', bg: 'rgba(106,82,212,.14)', c: '#5b45c4' },
    ];

    return (
      <div style={{ maxWidth: 1260, margin: '0 auto' }}>
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 16, padding: '20px 22px', marginBottom: 14, color: '#fff', background: 'linear-gradient(160deg,#1b2c45,#0d1b2e 60%,#102138)', boxShadow: '0 18px 46px rgba(13,27,46,.28)', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ position: 'absolute', right: -70, top: -80, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,144,202,.30),transparent 68%)', filter: 'blur(10px)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', minWidth: 240, flex: 1 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '2px', color: '#6fc7ec', marginBottom: 7 }}>NURSE IN-CHARGE</div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.3px' }}>Good day, {first}</div>
            <div style={{ fontSize: 12.5, color: '#a8bdd6', marginTop: 5 }}>
              {depts.map((d) => d.name).join(' · ') || 'No unit assigned'}
            </div>
          </div>
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <svg viewBox="0 0 64 64" style={{ width: 68, height: 68, transform: 'rotate(-90deg)' }}>
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="7" />
              <circle cx="32" cy="32" r="26" fill="none" stroke={pct >= 90 ? '#3ddc97' : pct >= 60 ? '#27a8db' : '#e08a1e'} strokeWidth="7" strokeLinecap="round" strokeDasharray="163.4" strokeDashoffset={163.4 * (1 - pct / 100)} style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.2,.7,.3,1)' }} />
            </svg>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: '#8fa6c0', marginTop: 5 }}>{pct}% reported</div>
          </div>
          <div style={{ position: 'relative', display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <button onClick={() => onNav('quick')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid rgba(255,255,255,.35)', background: 'linear-gradient(135deg,#27a8db,#0072a3)', color: '#fff', padding: '9px 15px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 22px rgba(0,144,202,.4)' }}>
              {CP_ICON('M13 2L4 14h7l-1 8 9-12h-7z', 14)}Quick entry
            </button>
            <button onClick={() => onNav('roster')} style={{ border: '1px solid rgba(255,255,255,.22)', background: 'rgba(255,255,255,.1)', color: '#cfe0f0', padding: '9px 15px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Open duty roster</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14, marginBottom: 14 }}>
          {TILES.map((t) => (
            <div key={t.lbl} onClick={() => onNav(t.go)} style={Object.assign({}, CP_CARD, { padding: '14px 16px', cursor: 'pointer' })}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={ic(t.bg, t.c)}>{CP_ICON(t.icd, 18)}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 21, fontWeight: 700, color: '#16202e', lineHeight: 1.15 }}>{t.val}</div>
                  <div style={{ fontSize: 11, color: '#6c7a8c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.lbl}</div>
                </div>
              </div>
              <div style={{ fontSize: 10.5, color: '#9aa6b4', marginTop: 8 }}>{t.foot}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
          <div style={Object.assign({}, CP_CARD, { overflow: 'hidden' })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 16px', borderBottom: '1px solid rgba(125,145,180,.18)' }}>
              <span style={{ display: 'inline-grid', placeItems: 'center', width: 24, height: 24, borderRadius: 7, background: 'rgba(58,181,167,.16)', color: '#12776c' }}>{CP_ICON('M12 8v4l3 3M12 2a10 10 0 100 20 10 10 0 000-20z', 13)}</span>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#16202e' }}>On duty right now</h3>
              <span style={{ flex: 1 }} />
              <span onClick={() => onNav('roster')} style={{ fontSize: 11, fontWeight: 700, color: '#0072a3', cursor: 'pointer' }}>Duty roster ›</span>
            </div>
            {duty === undefined ? <div style={{ padding: 20, color: '#6c7a8c', fontSize: 12 }}>Loading the roster…</div>
              : !today ? <div style={{ padding: 24, textAlign: 'center', color: '#6c7a8c', fontSize: 12 }}>No roster has been published for this month, so who is on duty cannot be shown.</div>
                : SHIFT_ROWS.map((sr) => {
                  const people = today.by[sr.id] || [];
                  const min = (R && R.DEFAULT_RULES[sr.rule] && R.DEFAULT_RULES[sr.rule].on) ? R.DEFAULT_RULES[sr.rule].value : 0;
                  const short = min > 0 && people.length < min;
                  return (
                    <div key={sr.id} style={{ padding: '10px 16px', borderBottom: '1px solid rgba(125,145,180,.12)', background: sr.id === today.now ? 'rgba(0,144,202,.05)' : 'transparent' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: (R && R.BUCKET_COLOR[sr.id]) || '#8aa0b8', flexShrink: 0 }} />
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#16202e' }}>{sr.label}</div>
                        <span style={{ fontSize: 10.5, color: '#9aa6b4', fontFamily: "'IBM Plex Mono',monospace" }}>{sr.window}</span>
                        {sr.id === today.now && <span style={cpChipStyle('Submitted')}>on now</span>}
                        <span style={{ flex: 1 }} />
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12.5, fontWeight: 700, color: short ? '#a92c42' : '#3c4858' }}>
                          {people.length}{min > 0 ? ' / ' + min : ''}
                        </span>
                      </div>
                      {people.length === 0
                        ? <div style={{ fontSize: 11, color: '#a92c42', marginTop: 5, marginLeft: 20 }}>No one rostered — this shift is uncovered.</div>
                        : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7, marginLeft: 20 }}>
                          {people.slice(0, 10).map((p) => (
                            <span key={p.emp} title={(R && R.BY_CODE[p.code] ? R.BY_CODE[p.code].label : p.code)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#3c4858', background: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.85)', borderRadius: 11, padding: '3px 9px 3px 3px' }}>
                              <span style={{ width: 19, height: 19, borderRadius: 6, background: 'linear-gradient(135deg,#3ab5a7,#0090ca)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 8.5, fontWeight: 700 }}>{cpInitials(p.name)}</span>
                              {p.name}
                            </span>
                          ))}
                          {people.length > 10 && <span style={{ fontSize: 11, color: '#9aa6b4', alignSelf: 'center' }}>+{people.length - 10} more</span>}
                        </div>}
                      {short && <div style={{ fontSize: 11, color: '#a92c42', marginTop: 6, marginLeft: 20, fontWeight: 600 }}>{min - people.length} short of the {min}-person floor.</div>}
                    </div>
                  );
                })}
          </div>

          <div style={Object.assign({}, CP_CARD, { overflow: 'hidden' })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 16px', borderBottom: '1px solid rgba(125,145,180,.18)' }}>
              <span style={{ display: 'inline-grid', placeItems: 'center', width: 24, height: 24, borderRadius: 7, background: 'rgba(106,82,212,.14)', color: '#5b45c4' }}>{CP_ICON('M19 8v6M22 11h-6M9 11a4 4 0 100-8 4 4 0 000 8M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2', 13)}</span>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#16202e' }}>Staff requests</h3>
              <span style={{ flex: 1 }} />
              <span onClick={() => onNav('requests')} style={{ fontSize: 11, fontWeight: 700, color: '#0072a3', cursor: 'pointer' }}>Ask for a nurse ›</span>
            </div>
            {reqs === null ? <div style={{ padding: 20, color: '#6c7a8c', fontSize: 12 }}>Loading…</div>
              : reqs.length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: '#6c7a8c', fontSize: 12 }}>You have not asked for anyone yet.</div>
                : reqs.slice(0, 6).map((r) => {
                  const label = CP_REQ_STATUS[r.status] || 'Pending';
                  const chip = label === 'Approved' ? 'Approved' : label === 'Rejected' ? 'Rejected' : label === 'Changes requested' ? 'Missing' : 'Pending';
                  return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderBottom: '1px solid rgba(125,145,180,.12)' }}>
                      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: '#9aa6b4', minWidth: 56 }}>{r.ref || '—'}</span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#16202e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                        <div style={{ fontSize: 10.5, color: '#9aa6b4' }}>{[r.role, r.designation].filter(Boolean).join(' · ')}</div>
                      </div>
                      <span style={cpChipStyle(chip)}>{label}</span>
                    </div>
                  );
                })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14, marginTop: 14 }}>
          <div style={Object.assign({}, CP_CARD, { padding: '14px 16px' })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
              <span style={{ display: 'inline-grid', placeItems: 'center', width: 24, height: 24, borderRadius: 7, background: 'rgba(0,144,202,.12)', color: '#0072a3' }}>{CP_ICON('M22 12h-4l-3 8-4-16-3 8H2', 13)}</span>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#16202e' }}>Reporting completeness — 6 months</h3>
            </div>
            {(() => {
              const W = 300, H = 96, pad = 6;
              const pts = trend.map((p, i) => [pad + i * ((W - pad * 2) / Math.max(1, trend.length - 1)), H - pad - (p.pct / 100) * (H - pad * 2)]);
              const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
              return (
                <React.Fragment>
                  <svg viewBox={'0 0 ' + W + ' ' + H} style={{ width: '100%', height: 96, display: 'block' }}>
                    {[0, 50, 100].map((g) => (
                      <line key={g} x1={pad} x2={W - pad} y1={H - pad - (g / 100) * (H - pad * 2)} y2={H - pad - (g / 100) * (H - pad * 2)} stroke="rgba(125,145,180,.22)" strokeWidth="1" strokeDasharray={g === 100 ? '4 4' : ''} />
                    ))}
                    <path d={d} fill="none" stroke="#0090ca" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                    {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 3.6 : 2.4} fill={i === pts.length - 1 ? '#0072a3' : '#27a8db'} />)}
                  </svg>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    {trend.map((p) => <span key={p.m} style={{ fontSize: 9.5, color: '#9aa6b4', fontFamily: "'IBM Plex Mono',monospace" }}>{p.m}</span>)}
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 11, borderTop: '1px solid rgba(125,145,180,.18)', flexWrap: 'wrap' }}>
                    {[[trend.length ? trend[trend.length - 1].pct + '%' : '—', 'this month'], [trendAvg + '%', '6-month average'], ['100%', 'target']].map((x) => (
                      <div key={x[1]}>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 15, fontWeight: 700, color: '#16202e' }}>{x[0]}</div>
                        <div style={{ fontSize: 10.5, color: '#9aa6b4' }}>{x[1]}</div>
                      </div>
                    ))}
                  </div>
                </React.Fragment>
              );
            })()}
          </div>

          <div style={Object.assign({}, CP_CARD, { overflow: 'hidden' })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 16px', borderBottom: '1px solid rgba(125,145,180,.18)' }}>
              <span style={{ display: 'inline-grid', placeItems: 'center', width: 24, height: 24, borderRadius: 7, background: 'rgba(224,138,30,.14)', color: '#b5670a' }}>{CP_ICON('M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0zM12 9v4M12 17h.01', 13)}</span>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#16202e' }}>Needs your attention</h3>
              <span style={{ flex: 1 }} />
              {attention.length > 0 && <span style={cpChipStyle('Pending')}>{attention.length}</span>}
            </div>
            {attention.length === 0
              ? <div style={{ padding: 26, textAlign: 'center', color: '#1f9d57', fontSize: 12.5, fontWeight: 600 }}>Nothing outstanding — the unit is up to date.</div>
              : attention.map((a) => (
                <div key={a.title} onClick={() => onNav(a.go)} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '11px 16px', borderBottom: '1px solid rgba(125,145,180,.12)', cursor: 'pointer' }}>
                  <span style={{ display: 'inline-grid', placeItems: 'center', width: 28, height: 28, borderRadius: 9, background: a.bg, color: a.tone, flexShrink: 0 }}>{CP_ICON(a.icd, 14)}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#16202e' }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: '#6c7a8c', lineHeight: 1.5 }}>{a.body}</div>
                  </div>
                  {CP_ICON('M9 6l6 6-6 6', 13, '#b6c0cc')}
                </div>
              ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14, marginTop: 14 }}>
          <div style={Object.assign({}, CP_CARD, { padding: '14px 16px' })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
              <span style={{ display: 'inline-grid', placeItems: 'center', width: 24, height: 24, borderRadius: 7, background: 'rgba(58,181,167,.16)', color: '#12776c' }}>{CP_ICON('M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8', 13)}</span>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#16202e' }}>Unit at a glance</h3>
              <span style={{ flex: 1 }} />
              <span onClick={() => onNav('unit')} style={{ fontSize: 11, fontWeight: 700, color: '#0072a3', cursor: 'pointer' }}>Staff list ›</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 12 }}>
              {glance.map((g) => (
                <div key={g[1]} style={{ background: 'rgba(255,255,255,.55)', border: '1px solid rgba(255,255,255,.8)', borderRadius: 12, padding: '11px 13px' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 19, fontWeight: 700, color: '#16202e', lineHeight: 1.15 }}>{staff === null ? '—' : g[0]}</div>
                  <div style={{ fontSize: 10.5, color: '#6c7a8c', marginTop: 2 }}>{g[1]}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={Object.assign({}, CP_CARD, { overflow: 'hidden' })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 16px', borderBottom: '1px solid rgba(125,145,180,.18)' }}>
              <span style={{ display: 'inline-grid', placeItems: 'center', width: 24, height: 24, borderRadius: 7, background: 'rgba(106,82,212,.14)', color: '#5b45c4' }}>{CP_ICON('M3 5h18v16H3zM3 9h18M8 3v4M16 3v4', 13)}</span>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#16202e' }}>What is coming up</h3>
            </div>
            {week.map((w, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid rgba(125,145,180,.12)' }}>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, fontWeight: 700, color: w.tone, background: w.tone + '18', padding: '4px 9px', borderRadius: 8, minWidth: 62, textAlign: 'center', flexShrink: 0 }}>{w.day}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: '#16202e' }}>{w.title}</div>
                  <div style={{ fontSize: 10.5, color: '#9aa6b4' }}>{w.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ---- The unit's staff (in-charge only) -----------------------------------------
     The register for the ward this person runs. The server serves WORK facts only
     (see access.PORTAL_STAFF_FIELDS) -- qualification, training, experience and Hep-B
     status, the things a nurse in charge rosters and audits against. Contact details
     and personal notes are withheld, so there is deliberately no Phone column here
     even though the paper form has one.

     Read-only on purpose: staff records are maintained in Nurse Management by the CNS.

     "Hep-B complete" is tested for EXACTLY "Completed". The register also contains
     "Not Completed", which a loose /complete/i match would score as compliant -- the
     one mistake that turns this panel from a compliance check into a false clean bill. */
  const CP_HEPB_DONE = (v) => String(v || '').trim().toLowerCase() === 'completed';
  const CP_HEPB_TONE = (v) => {
    const t = String(v || '').trim().toLowerCase();
    if (t === 'completed') return ['#1f9d57', 'Completed'];
    if (t === 'not completed' || !t) return ['#d23a52', t ? 'Not completed' : 'Not recorded'];
    if (t === 'unknown') return ['#8aa0b8', 'Unknown'];
    return ['#e08a1e', String(v).trim()];        // 1st / 2nd / 3rd Dose — in progress
  };
  const CP_HAS_TRAINING = (p, what) => new RegExp('(^|[^a-z])' + what + '([^a-z]|$)', 'i').test(String(p.special_training || ''));

  function CollectorUnitStaff() {
    const [staff, setStaff] = useState(null);
    const [q, setQ] = useState('');
    const [tab, setTab] = useState('all');
    useEffect(() => { dcApi.get('/api/staff').then((r) => setStaff(r.ok ? (r.staff || []) : [])).catch(() => setStaff([])); }, []);

    const all = staff || [];
    const TABS = [
      ['all', 'All', all.length],
      ['acls', 'ACLS', all.filter((p) => CP_HAS_TRAINING(p, 'ACLS')).length],
      ['bls', 'BLS', all.filter((p) => CP_HAS_TRAINING(p, 'BLS')).length],
      ['gap', 'Vaccination gap', all.filter((p) => !CP_HEPB_DONE(p.hepatitis_b_vaccination)).length],
    ];
    const ql = q.trim().toLowerCase();
    const rows = all.filter((p) => {
      if (tab === 'acls' && !CP_HAS_TRAINING(p, 'ACLS')) return false;
      if (tab === 'bls' && !CP_HAS_TRAINING(p, 'BLS')) return false;
      if (tab === 'gap' && CP_HEPB_DONE(p.hepatitis_b_vaccination)) return false;
      if (!ql) return true;
      return (p.name + ' ' + (p.designation || '') + ' ' + (p.emp_id || '') + ' ' + (p.qualification || '')).toLowerCase().indexOf(ql) >= 0;
    });

    // Average experience over the people who actually have a figure — averaging a
    // missing year as zero would quietly report the ward as greener than it is.
    const yrs = all.map((p) => Number(p.total_experience_years)).filter((n) => !isNaN(n) && n > 0);
    const avgYrs = yrs.length ? (yrs.reduce((x, y) => x + y, 0) / yrs.length) : null;
    const hepDone = all.filter((p) => CP_HEPB_DONE(p.hepatitis_b_vaccination)).length;
    const hepUnknown = all.filter((p) => String(p.hepatitis_b_vaccination || '').trim().toLowerCase() === 'unknown' || !String(p.hepatitis_b_vaccination || '').trim()).length;

    const STATS = [
      [all.length, 'staff in unit'],
      [avgYrs == null ? '—' : avgYrs.toFixed(1), 'avg. years experience'],
      [hepDone, 'Hep-B complete'],
      [hepUnknown, 'vaccination unknown'],
    ];
    const th = { textAlign: 'left', padding: '9px 12px', fontSize: 10.5, letterSpacing: '.5px', textTransform: 'uppercase', color: '#7d8ea8', fontWeight: 700, borderBottom: '1px solid rgba(125,145,180,.25)', whiteSpace: 'nowrap' };
    const td = { padding: '9px 12px', borderBottom: '1px solid rgba(125,145,180,.12)', verticalAlign: 'middle' };

    return (
      <div style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gap: 14 }}>
        <div style={Object.assign({}, CP_CARD, { padding: '15px 17px' })}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#16202e' }}>My unit&#39;s staff</div>
              <div style={{ fontSize: 11.5, color: '#6c7a8c' }}>Read-only — staff records are maintained in Nurse Management by the CNS.</div>
            </div>
            <span style={{ flex: 1 }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, ID, designation…"
              style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid rgba(125,145,180,.4)', background: 'rgba(255,255,255,.8)', fontFamily: 'inherit', fontSize: 12.5, outline: 'none', minWidth: 220 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, marginTop: 14 }}>
            {STATS.map((st) => (
              <div key={st[1]} style={{ background: 'rgba(255,255,255,.55)', border: '1px solid rgba(255,255,255,.8)', borderRadius: 12, padding: '11px 13px' }}>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 19, fontWeight: 700, color: '#16202e', lineHeight: 1.15 }}>{staff === null ? '—' : st[0]}</div>
                <div style={{ fontSize: 10.5, color: '#6c7a8c', marginTop: 2 }}>{st[1]}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 13 }}>
            {TABS.map((t) => (
              <button key={t[0]} onClick={() => setTab(t[0])} style={{
                border: '1px solid ' + (tab === t[0] ? 'transparent' : 'rgba(125,145,180,.32)'),
                background: tab === t[0] ? 'linear-gradient(135deg,#27a8db,#0072a3)' : 'rgba(255,255,255,.7)',
                color: tab === t[0] ? '#fff' : '#3c4858', padding: '6px 13px', borderRadius: 8,
                fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>{t[1]} <span style={{ opacity: .7, fontFamily: "'IBM Plex Mono',monospace" }}>{t[2]}</span></button>
            ))}
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11.5, color: '#9aa6b4', alignSelf: 'center' }}>{rows.length} shown</span>
          </div>
        </div>

        <div style={Object.assign({}, CP_CARD, { overflow: 'hidden' })}>
          {staff === null ? <div style={{ padding: 24, color: '#6c7a8c' }}>Loading…</div>
            : all.length === 0 ? <div style={{ padding: 28, textAlign: 'center', color: '#6c7a8c', fontSize: 12.5 }}>No staff are recorded against your unit yet. Ask your administrator to set the department on their records.</div>
              : rows.length === 0 ? <div style={{ padding: 26, textAlign: 'center', color: '#6c7a8c', fontSize: 12.5 }}>Nobody matches that filter.</div>
                : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                      <thead>
                        <tr>
                          <th style={th}>Staff</th>
                          <th style={th}>Emp ID</th>
                          <th style={th}>Designation</th>
                          <th style={th}>Qualification</th>
                          <th style={Object.assign({}, th, { textAlign: 'right' })}>Experience</th>
                          <th style={th}>Training</th>
                          <th style={th}>Hep-B</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((p, i) => {
                          const hep = CP_HEPB_TONE(p.hepatitis_b_vaccination);
                          const training = String(p.special_training || '').replace(/^-$/, '').trim();
                          return (
                            <tr key={p.id || p.emp_id || i}>
                              <td style={td}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <span style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg,#3ab5a7,#0090ca)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{cpInitials(p.name)}</span>
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, color: '#16202e', whiteSpace: 'nowrap' }}>{p.name}</div>
                                    <div style={{ fontSize: 10.5, color: '#9aa6b4' }}>{p.doj ? 'joined ' + p.doj : (p.role || 'Nurse')}</div>
                                  </div>
                                </div>
                              </td>
                              <td style={Object.assign({}, td, { fontFamily: "'IBM Plex Mono',monospace", color: '#6c7a8c' })}>{p.emp_id || '—'}</td>
                              <td style={Object.assign({}, td, { color: '#3c4858' })}>{p.designation || '—'}</td>
                              <td style={Object.assign({}, td, { color: '#3c4858' })}>{p.qualification || '—'}</td>
                              <td style={Object.assign({}, td, { textAlign: 'right', fontFamily: "'IBM Plex Mono',monospace", color: '#3c4858' })}>{p.total_experience_text || '—'}</td>
                              <td style={td}>
                                {training
                                  ? <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                    {training.split(/[,;]/).map((x) => x.trim()).filter(Boolean).slice(0, 3).map((x, k) => (
                                      <span key={k} style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 11, background: 'rgba(0,144,202,.1)', color: '#0072a3', whiteSpace: 'nowrap' }}>{x}</span>
                                    ))}
                                  </div>
                                  : <span style={{ fontSize: 11, color: '#b6c0cc' }}>None recorded</span>}
                              </td>
                              <td style={td}><span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 10px', borderRadius: 12, color: hep[0], background: hep[0] + '1a', whiteSpace: 'nowrap' }}>{hep[1]}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
        </div>
      </div>
    );
  }

  /* ---- Ask for a nurse or PCA (in-charge only) -------------------------------------
     A short ward is a request, not a hiring. Everything typed here goes to the
     administrator; nobody joins the staff register from this screen. The queue below
     is the ward's own history — including what came back and why. */
  const CP_REQ_STATUS = { pending: 'Pending', changes: 'Changes requested', approved: 'Approved', rejected: 'Rejected' };
  function CollectorStaffRequests({ depts }) {
    const blank = { role: 'Nurse', name: '', designation: '', department: (depts[0] && depts[0].name) || '', joiningDate: '', experience: '', qualification: '', phone: '', hepB: '', note: '' };
    const [f, setF] = useState(blank);
    const [rows, setRows] = useState(null);
    const [busy, setBusy] = useState(false);
    const [editing, setEditing] = useState(null);
    const load = () => dcApi.get('/api/staff-requests').then((r) => setRows(r.ok ? (r.requests || []) : [])).catch(() => setRows([]));
    useEffect(() => { load(); }, []);
    const set = (k) => (e) => setF(Object.assign({}, f, { [k]: e.target.value }));

    const submit = () => {
      if (!f.name.trim()) { toast('A name is required.', 'error'); return; }
      if (!f.department.trim()) { toast('Pick a department.', 'error'); return; }
      setBusy(true);
      const done = (r) => {
        setBusy(false);
        if (!r || !r.ok) { toast((r && r.error) || 'Could not send the request.', 'error'); return; }
        toast(editing ? 'Request updated and sent back for review' : 'Request sent to the administrator', 'success');
        setF(blank); setEditing(null); load();
      };
      const send = editing
        ? dcApi.patch('/api/staff-requests/' + editing, f)
        : dcApi.post('/api/staff-requests', f);
      send.then(done).catch(() => done(null));
    };

    const inp = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 9, border: '1px solid rgba(125,145,180,.4)', background: 'rgba(255,255,255,.85)', fontFamily: 'inherit', fontSize: 12.5, outline: 'none' };
    const lbl = { fontSize: 10.5, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: '#7d8ea8', marginBottom: 5, display: 'block' };
    const field = (label, key, type) => (
      <div key={key}><label style={lbl}>{label}</label><input type={type || 'text'} value={f[key]} onChange={set(key)} style={inp} /></div>
    );

    return (
      <div style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gap: 14 }}>
        <div style={Object.assign({}, CP_CARD, { padding: '15px 17px' })}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 14, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-grid', placeItems: 'center', width: 34, height: 34, borderRadius: 11, background: 'rgba(0,144,202,.12)', color: '#0072a3', flexShrink: 0 }}>{CP_ICON(CP_NAV_STAFFREQ[2], 18)}</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#16202e' }}>{editing ? 'Correct your request' : 'Ask for a new nurse or PCA'}</div>
              <div style={{ fontSize: 11.5, color: '#6c7a8c' }}>This goes to the administrator for approval — nobody is added to the staff register from here.</div>
            </div>
            <span style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 6 }}>
              {['Nurse', 'PCA'].map((r) => (
                <button key={r} onClick={() => setF(Object.assign({}, f, { role: r }))} style={{ border: '1px solid ' + (f.role === r ? 'transparent' : 'rgba(125,145,180,.35)'), background: f.role === r ? 'linear-gradient(135deg,#27a8db,#0072a3)' : 'rgba(255,255,255,.7)', color: f.role === r ? '#fff' : '#3c4858', padding: '7px 16px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{r}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
            {field('Full name', 'name')}
            {field('Designation', 'designation')}
            <div><label style={lbl}>Department</label>
              <select value={f.department} onChange={set('department')} style={inp}>
                {depts.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </div>
            {field('Expected joining date', 'joiningDate', 'date')}
            {field('Experience', 'experience')}
            {field('Qualification', 'qualification')}
            {field('Phone', 'phone')}
            {field('Hep-B status', 'hepB')}
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={lbl}>Why is this post needed?</label>
            <textarea value={f.note} onChange={set('note')} rows={3} style={Object.assign({}, inp, { resize: 'vertical' })} placeholder="Cover, vacancy, increased census…" />
          </div>
          <div style={{ display: 'flex', gap: 9, marginTop: 13, flexWrap: 'wrap' }}>
            <button onClick={submit} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 0, background: 'linear-gradient(135deg,#27a8db,#0072a3)', color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 22px rgba(0,144,202,.4)' }}>
              {busy ? 'Sending…' : (editing ? 'Send the correction' : 'Send request')}
            </button>
            {editing && <button onClick={() => { setEditing(null); setF(blank); }} style={{ border: '1px solid rgba(125,145,180,.35)', background: 'rgba(255,255,255,.7)', color: '#3c4858', padding: '10px 16px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>}
          </div>
        </div>

        <div style={Object.assign({}, CP_CARD, { overflow: 'hidden' })}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(125,145,180,.18)', display: 'flex', alignItems: 'center', gap: 9 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#16202e' }}>My requests</h3>
            <span style={{ flex: 1 }} />
            {rows && <span style={{ fontSize: 11.5, color: '#9aa6b4' }}>{rows.length} raised</span>}
          </div>
          {rows === null ? <div style={{ padding: 22, color: '#6c7a8c' }}>Loading…</div>
            : rows.length === 0 ? <div style={{ padding: 26, textAlign: 'center', color: '#6c7a8c', fontSize: 12.5 }}>You have not asked for anyone yet.</div>
              : rows.map((r) => {
                const label = CP_REQ_STATUS[r.status] || 'Pending';
                const chip = label === 'Approved' ? 'Approved' : label === 'Rejected' ? 'Rejected' : label === 'Changes requested' ? 'Missing' : 'Pending';
                return (
                  <div key={r.id} style={{ padding: '11px 16px', borderBottom: '1px solid rgba(125,145,180,.12)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#6c7a8c', minWidth: 62 }}>{r.ref || '—'}</span>
                      <div style={{ minWidth: 150, flex: 1 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#16202e' }}>{r.name}</div>
                        <div style={{ fontSize: 10.5, color: '#9aa6b4' }}>{[r.role, r.designation, r.department].filter(Boolean).join(' · ')}</div>
                      </div>
                      <span style={{ fontSize: 11, color: '#9aa6b4' }}>{r.joiningDate || ''}</span>
                      <span style={cpChipStyle(chip)}>{label}</span>
                      {(r.status === 'pending' || r.status === 'changes') && (
                        <button onClick={() => { setEditing(r.id); setF(Object.assign({}, blank, r)); if (typeof window !== 'undefined') window.scrollTo(0, 0); }}
                          style={{ border: '1px solid rgba(0,144,202,.3)', background: 'rgba(0,144,202,.08)', color: '#0072a3', padding: '5px 12px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
                      )}
                    </div>
                    {r.reason && (
                      <div style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.6, color: '#3c4858', background: r.status === 'rejected' ? 'rgba(210,58,82,.09)' : 'rgba(224,138,30,.1)', borderRadius: 9, padding: '8px 11px' }}>
                        <b>{r.decidedBy || 'Administrator'}:</b> {r.reason}
                      </div>
                    )}
                  </div>
                );
              })}
        </div>
      </div>
    );
  }

  /* ---- The shell ---------------------------------------------------------------- */
  function CollectorPortal() {
    const user = (typeof window !== 'undefined' && window.__UNICO_USER__) || {};
    const dataRev = useDcDataRev();
    const depts = useMemo(() => dcAllDepts(), [dataRev]);
    const areas = useMemo(() => (window.qualityData ? window.qualityData() : []), [dataRev]);
    const hasPatient = depts.length > 0;
    const hasQuality = areas.some((a) => a && a.indicators && a.indicators.length);

    // An in-charge is a collector who also runs a ward: same data scoping, more of the
    // ward's own screens. The role decides which, and it is the SERVER's role claim --
    // the extra screens are all backed by routes that check it again.
    const inCharge = user.role === 'incharge';
    const [view, setView] = useState(inCharge ? 'home' : (hasQuality ? 'status' : 'patient'));
    const [month, setMonth] = useState(dcDefaultMonth());
    const [jump, setJump] = useState(null);
    const [q, setQ] = useState('');
    const [online, setOnline] = useState(typeof navigator === 'undefined' || navigator.onLine !== false);
    const [subCount, setSubCount] = useState({ pending: 0, missing: 0 });
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
      const on = () => setOnline(true), off = () => setOnline(false);
      window.addEventListener('online', on); window.addEventListener('offline', off);
      return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
    }, []);
    // The sidebar badges and the progress ring need the same two counts the dashboard
    // computes; they are recomputed here so they stay right on every view, not just
    // while the dashboard happens to be mounted.
    useEffect(() => {
      let dead = false;
      dcApi.get('/api/submissions?limit=500').then((r) => {
        if (dead) return;
        const S = r.ok ? (r.submissions || []) : [];
        let total = 0, missing = 0;
        areas.forEach((a) => (a.indicators || []).forEach((ind) => {
          total++;
          const sent = cpHasData(ind, month) || S.some((s) => s.type === 'quality' && s.area === a.key && s.month === month && s.status === 'pending' && (s.indicatorId === ind.id || (s.indicatorName || '').toLowerCase().trim() === (ind.name || '').toLowerCase().trim()));
          if (!sent) missing++;
        }));
        const statGap = Math.max(0, depts.length - depts.filter((d) => ((d.months || []).indexOf(month) >= 0) || S.some((x) => x.type === 'patient' && x.department === d.id && x.month === month && x.status !== 'rejected')).length);
        setSubCount({ pending: S.filter((s) => s.status === 'pending').length, missing, total, statGap });
      }).catch(() => {});
      return () => { dead = true; };
    }, [month, dataRev, view]);

    const donePct = subCount.total ? Math.round((subCount.total - subCount.missing) * 100 / subCount.total) : 0;
    const fillFor = (area, indicatorId, m) => { setJump({ area, indicatorId, month: m }); setView('quality'); setSidebarOpen(false); };
    // The patient twin of fillFor. "My submissions" needs it to reopen a REJECTED
    // statistics sheet at the right department + month; DataPatientForm already
    // reads prefill.dept / prefill.month, it just had nothing feeding them.
    const fillStat = (deptId, m) => { setJump({ dept: deptId, month: m }); setView('patient'); setSidebarOpen(false); };
    const go = (v) => { setView(v); setJump(null); setSidebarOpen(false); };

    const badgeFor = (v) => (v === 'quick' ? String(subCount.statGap || '') : v === 'quality' ? String(subCount.missing || '') : v === 'history' ? String(subCount.pending || '') : '');
    // Same .sb-item / .sb-sec / .badge classes the admin sidebar (Sidebar in ui.jsx)
    // uses — the Collector Portal used to skin its own glassy/glowing nav instead of
    // matching the rest of the app; this makes the two visually one system.
    const NavItem = ([v, label, icd]) => {
      const on = view === v, badgeVal = badgeFor(v);
      return (
        <div key={v} className={'sb-item' + (on ? ' active' : '')} onClick={() => go(v)} title={label}>
          {CP_ICON(icd, 18)}<span className="lbl">{label}</span>
          {badgeVal && badgeVal !== '0' && <span className="badge alert num">{badgeVal}</span>}
        </div>
      );
    };

    const [acctOpen, setAcctOpen] = useState(false);
    const crumb = ({ home: 'Dashboard', unit: "My unit's staff", requests: 'Add nurse / PCA', status: 'Submission status', quick: 'Quick entry', quality: 'Quality data', patient: 'Patient statistics', history: 'My submissions', roster: 'Duty roster', profile: 'My profile', dept: 'Department & staff' })[view] || 'Submission status';
    const collectNav = CP_NAV_COLLECT.filter(([v]) => (v === 'patient' ? hasPatient : v === 'quick' ? hasPatient : hasQuality));
    const dl = cpDeadline(month);
    const overdueDays = dl ? Math.floor((Date.now() - dl.getTime()) / 864e5) : 0;
    const dueTxt = overdueDays > 0 ? overdueDays + ' day' + (overdueDays === 1 ? '' : 's') + ' overdue' : 'On schedule';
    const dueTone = overdueDays > 0 ? ['#a92c42', 'rgba(210,58,82,.13)', 'rgba(210,58,82,.28)'] : ['#12776c', 'rgba(58,181,167,.14)', 'rgba(58,181,167,.3)'];
    const pill = (c) => ({ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, padding: '5px 11px', borderRadius: 12, color: c[0], background: c[1], border: '1px solid ' + c[2], whiteSpace: 'nowrap', flexShrink: 0 });

    return (
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'transparent' }}>
        <style>{'@media (max-width:900px){.cp-aside{position:fixed!important;z-index:200;height:100vh;transform:translateX(-100%);transition:transform .22s ease}.cp-aside.cp-open{transform:none}.cp-burger{display:grid!important}}'}</style>
        {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(13,27,46,.4)', zIndex: 150 }} />}
        <aside className={'sb cp-aside' + (sidebarOpen ? ' cp-open' : '')} style={{ width: 248, flexShrink: 0 }}>
          <div className="sb-brand">
            <img src="unico/logo.svg" alt="UNICO Hospitals" style={{ height: 28, width: 'auto', display: 'block', filter: 'brightness(0) invert(1)', opacity: .95 }} />
          </div>
          <div className="sb-scroll">
            <div className="sb-sec">{inCharge ? 'Unit data' : 'Collect'}</div>
            {inCharge && NavItem(CP_NAV_HOME)}
            {collectNav.map(NavItem)}
            <div className="sb-sec">My unit</div>
            {CP_NAV_UNIT.map(NavItem)}
            {inCharge && NavItem(['unit', "My unit's staff", 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8'])}
            {inCharge && NavItem(CP_NAV_STAFFREQ)}
            <div style={{ margin: '14px 16px 4px', padding: 12, borderRadius: 10, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <svg viewBox="0 0 44 44" style={{ width: 44, height: 44, flexShrink: 0, transform: 'rotate(-90deg)' }}>
                <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="5" />
                <circle cx="22" cy="22" r="18" fill="none" stroke="var(--blue-500,#0b66d0)" strokeWidth="5" strokeLinecap="round" strokeDasharray="113" strokeDashoffset={113 * (1 - donePct / 100)} style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.2,.7,.3,1)' }} />
              </svg>
              <div style={{ minWidth: 0 }}>
                <div className="num" style={{ fontSize: 17, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{donePct}%</div>
                <div style={{ fontSize: 10.5, color: '#8b98ab', marginTop: 3, lineHeight: 1.4 }}>{(subCount.total || 0) - (subCount.missing || 0)} of {subCount.total || 0} indicators sent</div>
              </div>
            </div>
          </div>
          <div className="sb-foot">
            <UnicoAvatar className="avatar" initials={cpInitials(user.name)} />
            <div onClick={() => go('profile')} title="Open my profile" style={{ minWidth: 0, flex: 1, cursor: 'pointer' }}>
              <div style={{ color: '#fff', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name || 'Collector'}</div>
              <div style={{ color: '#83909f', fontSize: 10.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(inCharge ? 'In-charge' : 'Data Collector') + (depts[0] ? ' · ' + depts[0].name : '')}</div>
            </div>
            <a href="/logout" title="Sign out" style={{ marginLeft: 'auto', display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: 8, color: '#cfe0f0', background: 'rgba(255,255,255,.08)', textDecoration: 'none', flexShrink: 0 }}>
              {CP_ICON('M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9', 15)}
            </a>
          </div>
        </aside>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh', overflow: 'hidden' }}>
          <div style={{ height: 60, background: 'linear-gradient(180deg,rgba(255,255,255,.72),rgba(255,255,255,.48))', backdropFilter: 'blur(24px) saturate(1.7)', WebkitBackdropFilter: 'blur(24px) saturate(1.7)', borderBottom: '1px solid rgba(255,255,255,.75)', boxShadow: '0 10px 30px rgba(31,59,90,.09)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px', flexShrink: 0, zIndex: 20 }}>
            <button className="cp-burger" onClick={() => setSidebarOpen(true)} style={{ display: 'none', placeItems: 'center', width: 34, height: 34, borderRadius: 9, border: '1px solid rgba(255,255,255,.85)', background: 'rgba(255,255,255,.6)', color: '#3c4858', cursor: 'pointer', flexShrink: 0 }}>
              {CP_ICON('M3 6h18M3 12h18M3 18h18', 17)}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#6c7a8c', fontSize: 12, minWidth: 0, whiteSpace: 'nowrap', flexShrink: 0 }}>
              <span>{inCharge ? 'In-charge' : 'Data Collection'}</span>
              {CP_ICON('M9 6l6 6-6 6', 13, '#b6c0cc')}
              <b style={{ color: '#16202e', fontWeight: 600, fontSize: 14 }}>{crumb}</b>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.9)', borderRadius: 9, padding: '6px 11px', flex: '0 1 300px', minWidth: 0, boxShadow: 'inset 0 1px 3px rgba(31,59,90,.05)' }}>
              {CP_ICON('M11 4a7 7 0 105 12l4 4M11 4a7 7 0 015 12', 15, '#9aa6b4')}
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search indicator, department…" style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', outline: 'none', fontFamily: 'inherit', fontSize: 12.5, color: '#16202e' }} />
            </div>
            <span style={{ flex: 1 }} />
            <div style={pill(dueTone)} title="Submission deadline">{CP_ICON('M12 8v4l3 3M12 2a10 10 0 100 20 10 10 0 000-20z', 14)}<span>{dueTxt}</span></div>
            <div style={pill(online ? ['#12776c', 'rgba(58,181,167,.14)', 'rgba(58,181,167,.3)'] : ['#a92c42', 'rgba(210,58,82,.13)', 'rgba(210,58,82,.28)'])} title="Connection">
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: online ? '#3ddc97' : '#d23a52' }} />{online ? 'Online' : 'Offline'}
            </div>
            {/* Account menu. The portal has no settings screen, so this avatar is the
                one place a collector or in-charge reaches their own profile, photo and
                password — and the sign-out that used to hide in the sidebar footer. */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button onClick={() => setAcctOpen((v) => !v)} title="My account"
                style={{ width: 34, height: 34, borderRadius: 9, padding: 0, overflow: 'hidden', cursor: 'pointer', border: acctOpen ? '2px solid #0090ca' : '1px solid rgba(255,255,255,.9)', background: 'linear-gradient(135deg,#3ab5a7,#0090ca)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 }}>
                <UnicoAvatar size={32} radius={8} initials={cpInitials(user.name)} />
              </button>
              {acctOpen && (
                <React.Fragment>
                  <div onClick={() => setAcctOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
                  <div style={{ position: 'absolute', right: 0, top: 42, zIndex: 61, minWidth: 214, background: '#fff', borderRadius: 11, border: '1px solid rgba(125,145,180,.22)', boxShadow: '0 18px 40px rgba(31,59,90,.20)', overflow: 'hidden' }}>
                    <div style={{ padding: '11px 13px', borderBottom: '1px solid rgba(125,145,180,.14)' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#16202e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name || 'My account'}</div>
                      <div style={{ fontSize: 11, color: '#6c7a8c' }}>{(inCharge ? 'In-charge' : 'Data Collector') + (user.username ? ' · @' + user.username : '')}</div>
                    </div>
                    <button onClick={() => { setAcctOpen(false); go('profile'); }}
                      style={{ width: '100%', textAlign: 'left', padding: '10px 13px', border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, color: '#16202e', display: 'flex', alignItems: 'center', gap: 9 }}>
                      {CP_ICON('M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0', 14, '#0072a3')}My profile &amp; photo
                    </button>
                    <a href="/logout" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 13px', borderTop: '1px solid rgba(125,145,180,.14)', fontSize: 12.5, fontWeight: 600, color: '#a92c42', textDecoration: 'none' }}>
                      {CP_ICON('M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9', 14, '#a92c42')}Sign out
                    </a>
                  </div>
                </React.Fragment>
              )}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '22px 26px 64px' }}>
            {!hasPatient && !hasQuality && (
              <div style={Object.assign({}, CP_CARD, { maxWidth: 620, margin: '40px auto', padding: 30, textAlign: 'center' })}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#16202e', marginBottom: 6 }}>Nothing is assigned to you yet</div>
                <div style={{ fontSize: 12.5, color: '#6c7a8c' }}>Your administrator has not given you a department or quality area to report on. Once they do, it appears here.</div>
              </div>
            )}
            {view === 'status' && hasQuality && <CollectorDash month={month} setMonth={setMonth} onNav={go} onFill={fillFor} user={user} />}
            {view === 'quick' && hasPatient && <CollectorQuickGrid depts={depts} onDone={() => go('history')} />}
            {view === 'quality' && hasQuality && <div style={{ maxWidth: 900, margin: '0 auto' }}><DataQualityForm key={jump ? jump.area + '/' + jump.indicatorId + '/' + jump.month : 'q'} prefill={{ responsible: user.name, area: jump && jump.area, indicatorId: jump && jump.indicatorId, month: jump && jump.month }} /></div>}
            {view === 'patient' && hasPatient && <div style={{ maxWidth: 900, margin: '0 auto' }}><DataPatientForm key={jump && jump.dept ? 'p/' + jump.dept + '/' + jump.month : 'p'} depts={depts} prefill={{ responsible: user.name, dept: jump && jump.dept, month: jump && jump.dept ? jump.month : null }} /></div>}
            {view === 'history' && <div style={{ maxWidth: 1240, margin: '0 auto' }}><CollectorHistory month={month} onFixQuality={fillFor} onFixPatient={fillStat} /></div>}
            {view === 'roster' && <CollectorRoster />}
            {view === 'profile' && <CollectorProfile user={user} onNav={go} />}
            {view === 'home' && inCharge && <CollectorHome user={user} month={month} onNav={go} />}
            {view === 'unit' && inCharge && <CollectorUnitStaff />}
            {view === 'requests' && inCharge && <CollectorStaffRequests depts={depts} />}
            {view === 'dept' && <CollectorDeptStaff />}
          </div>
        </div>
      </div>
    );
  }

  /* ===================== Submission Analytics / Responder Performance =====================
     Who submitted what, when, how completely (statistics + quality), and how accurately
     (approved vs rejected "wrong data") — so an admin can track each responsible person's
     performance. All derived client-side from the submissions list. */
  function SubmissionAnalytics() {
    const [rows, setRows] = useState(null);
    const [days, setDays] = useState('90');          // 30 | 90 | 365 | all
    const [fType, setFType] = useState('all');       // all | patient | quality
    const [q, setQ] = useState('');                  // person/target search
    const [drill, setDrill] = useState(null);        // responder name for the drill-down
    const [sortBy, setSortBy] = useState('total');
    const [sortDir, setSortDir] = useState('desc');
    useEffect(() => {
      const load = () => dcApi.get('/api/submissions?status=all&limit=1000').then((r) => setRows(r.ok ? r.submissions : [])).catch(() => setRows([]));
      load();
      const refresh = () => { if (document.visibilityState !== 'hidden') load(); };
      window.addEventListener('unico:data-refreshed', refresh);
      return () => window.removeEventListener('unico:data-refreshed', refresh);
    }, []);
    const respOf = (s) => (s.responsible && s.responsible.name) || s.submittedBy || 'Unknown';
    const targetOf = (s) => (s.type === 'quality' ? (s.indicatorName || s.areaName) : s.departmentName) || '—';
    const when = (ts) => { try { return ts ? new Date(ts).toLocaleString() : '—'; } catch (e) { return '—'; } };
    const rangeDays = days === 'all' ? Infinity : parseInt(days, 10);
    const cutoff = rangeDays === Infinity ? 0 : Date.now() - rangeDays * 864e5;
    // Reporting lag / on-time: monthly data is due by the end of the NEXT month.
    const QMONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthEndTs = (mk) => { const p = String(mk || '').split('-'); const mi = QMONS.indexOf(p[0]); const yy = parseInt(p[1], 10); if (mi < 0 || isNaN(yy)) return null; return new Date(2000 + yy, mi + 1, 0, 23, 59, 59).getTime(); };
    const deadlineTs = (mk) => { const p = String(mk || '').split('-'); const mi = QMONS.indexOf(p[0]); const yy = parseInt(p[1], 10); if (mi < 0 || isNaN(yy)) return null; return new Date(2000 + yy, mi + 2, 0, 23, 59, 59).getTime(); };

    const data = useMemo(() => {
      const ql = q.trim().toLowerCase();
      const all = (rows || []).filter((s) => {
        if (cutoff && (s.submittedAt || 0) < cutoff) return false;
        if (fType !== 'all' && s.type !== fType) return false;
        if (ql) { const hay = (respOf(s) + ' ' + targetOf(s) + ' ' + (s.month || '')).toLowerCase(); if (hay.indexOf(ql) < 0) return false; }
        return true;
      });
      const perf = {};
      const statTargets = new Set(), qualTargets = new Set();
      const reasons = {};
      all.forEach((s) => {
        const r = respOf(s);
        const p = perf[r] || (perf[r] = { name: r, total: 0, patient: 0, quality: 0, approved: 0, rejected: 0, autoRej: 0, pending: 0, corrections: 0, last: 0, lagSum: 0, lagN: 0, onTime: 0, onN: 0, turnSum: 0, turnN: 0 });
        p.total++; if (s.type === 'patient') p.patient++; else p.quality++;
        if (s.status === 'approved') p.approved++;
        else if (s.status === 'rejected') { if (s.autoRejected) p.autoRej++; else { p.rejected++; const rr = (String(s.rejectReason || '').trim()) || 'Unspecified'; reasons[rr] = (reasons[rr] || 0) + 1; } }
        else if (s.status === 'pending') p.pending++;
        if (s.isCorrection) p.corrections++;
        if ((s.submittedAt || 0) > p.last) p.last = s.submittedAt;
        const me2 = monthEndTs(s.month), dl = deadlineTs(s.month);
        if (me2 && s.submittedAt) { p.lagSum += (s.submittedAt - me2) / 864e5; p.lagN++; if (dl) { p.onN++; if (s.submittedAt <= dl) p.onTime++; } }
        if (s.reviewedAt && s.submittedAt && s.reviewedAt >= s.submittedAt) { p.turnSum += (s.reviewedAt - s.submittedAt) / 864e5; p.turnN++; }
        if (s.type === 'patient') statTargets.add((s.department || '') + '|' + s.month);
        else qualTargets.add((s.area || '') + '|' + (s.indicatorId || s.indicatorName || '') + '|' + s.month);
      });
      const list = Object.keys(perf).map((k) => { const p = perf[k]; const denom = p.approved + p.rejected; p.accuracy = denom ? (p.approved / denom) * 100 : null; p.onPct = p.onN ? (p.onTime / p.onN) * 100 : null; p.avgLag = p.lagN ? p.lagSum / p.lagN : null; p.avgTurn = p.turnN ? p.turnSum / p.turnN : null; return p; });
      const tot = { total: all.length, approved: 0, rejected: 0, autoRej: 0, pending: 0, patient: 0, quality: 0, onTime: 0, onN: 0, turnSum: 0, turnN: 0 };
      list.forEach((p) => { tot.approved += p.approved; tot.rejected += p.rejected; tot.autoRej += p.autoRej; tot.pending += p.pending; tot.patient += p.patient; tot.quality += p.quality; tot.onTime += p.onTime; tot.onN += p.onN; tot.turnSum += p.turnSum; tot.turnN += p.turnN; });
      const denom = tot.approved + tot.rejected; tot.accuracy = denom ? (tot.approved / denom) * 100 : null;
      tot.onPct = tot.onN ? (tot.onTime / tot.onN) * 100 : null; tot.avgTurn = tot.turnN ? tot.turnSum / tot.turnN : null;
      const reasonList = Object.keys(reasons).map((k) => ({ reason: k, n: reasons[k] })).sort((a, b) => b.n - a.n);
      // Activity timeline: by day (<=60d range) else by month.
      const monthly = rangeDays > 60;
      const key = (ts) => new Date(ts).toISOString().slice(0, monthly ? 7 : 10);
      const bucket = {};
      all.forEach((s) => { if (!s.submittedAt) return; const kk = key(s.submittedAt); const b = bucket[kk] || (bucket[kk] = { k: kk, total: 0, approved: 0, rejected: 0, pending: 0 }); b.total++; if (s.status === 'approved') b.approved++; else if (s.status === 'rejected') b.rejected++; else b.pending++; });
      const timeline = Object.keys(bucket).map((k2) => bucket[k2]).sort((a, b) => a.k < b.k ? -1 : 1).slice(-48);
      return { all, list, tot, reasonList, timeline, monthly, statCount: statTargets.size, qualCount: qualTargets.size, recent: all.slice().sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0)).slice(0, 12) };
    }, [rows, days, fType, q]);

    if (!rows) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading analytics…</div>;

    const sorted = data.list.slice().sort((a, b) => {
      const val = (p) => sortBy === 'accuracy' ? (p.accuracy == null ? -1 : p.accuracy) : sortBy === 'rejected' ? p.rejected : sortBy === 'quality' ? p.quality : sortBy === 'last' ? p.last : sortBy === 'ontime' ? (p.onPct == null ? -1 : p.onPct) : sortBy === 'lag' ? (p.avgLag == null ? 1e9 : p.avgLag) : sortBy === 'turn' ? (p.avgTurn == null ? 1e9 : p.avgTurn) : p.total;
      const r = val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0; return sortDir === 'asc' ? r : -r;
    });
    const setSort = (k) => { if (sortBy === k) setSortDir((d) => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(k); setSortDir('desc'); } };
    const caret = (k) => sortBy === k ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
    const accColor = (a) => a == null ? 'var(--muted)' : a >= 90 ? 'var(--pos)' : a >= 70 ? '#b45309' : 'var(--rose)';
    const onColor = (a) => a == null ? 'var(--muted)' : a >= 90 ? 'var(--pos)' : a >= 60 ? '#b45309' : 'var(--rose)';
    const num1 = (v) => v == null ? '—' : (Math.round(v * 10) / 10);
    const lagTxt = (v) => v == null ? '—' : (v <= 0 ? (Math.abs(Math.round(v)) + 'd early') : (Math.round(v) + 'd late'));
    const exportCsv = () => {
      const cols = [['Responsible', (p) => p.name], ['Total', (p) => p.total], ['Statistics', (p) => p.patient], ['Quality', (p) => p.quality], ['Approved', (p) => p.approved], ['Wrong', (p) => p.rejected], ['Pending', (p) => p.pending], ['Accuracy %', (p) => p.accuracy == null ? '' : p.accuracy.toFixed(1)], ['On-time %', (p) => p.onPct == null ? '' : p.onPct.toFixed(0)], ['Avg lag (days)', (p) => p.avgLag == null ? '' : (Math.round(p.avgLag * 10) / 10)], ['Avg review turnaround (days)', (p) => p.avgTurn == null ? '' : (Math.round(p.avgTurn * 10) / 10)], ['Edit requests', (p) => p.corrections], ['Last submission', (p) => when(p.last)]];
      const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      const lines = [cols.map((c) => esc(c[0])).join(',')].concat(sorted.map((p) => cols.map((c) => esc(c[1](p))).join(',')));
      const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'responder-performance.csv'; document.body.appendChild(a); a.click();
      setTimeout(() => { try { document.body.removeChild(a); } catch (e) {} URL.revokeObjectURL(a.href); }, 0);
      toast(sorted.length + ' rows exported', 'success');
    };
    const drillRows = drill ? data.all.filter((s) => respOf(s) === drill).sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0)) : [];
    const drillP = drill ? data.list.find((p) => p.name === drill) : null;
    const Tile = ({ label, value, color, sub }) => (
      <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, padding: '13px 15px', minWidth: 0 }}>
        <div style={{ fontSize: 25, fontWeight: 800, lineHeight: 1, color: color || 'var(--ink)' }}>{value}</div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 5, fontWeight: 600 }}>{label}</div>
        {sub && <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
      </div>
    );
    const th = { textAlign: 'left', fontSize: 11, color: 'var(--ink-2)', fontWeight: 700, padding: '8px 9px', borderBottom: '1px solid var(--line)', cursor: 'pointer', whiteSpace: 'nowrap' };
    const td = { fontSize: 12.5, padding: '8px 9px', borderBottom: '1px solid var(--line-2)' };
    // timeline chart geometry
    const tl = data.timeline; const tlMax = Math.max(1, ...tl.map((d) => d.total)); const bw = 100 / Math.max(1, tl.length);
    const dayLabel = (k) => data.monthly ? new Date(k + '-01').toLocaleDateString(undefined, { month: 'short', year: '2-digit' }) : k.slice(8) + '/' + k.slice(5, 7);

    return (
      <div className="grid" style={{ gap: 16 }}>
        <SectionTitle icon={I.trend} title="Submission Analytics" sub="Responder performance · completeness · accuracy · timeliness"
          right={<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="seg">{[['all', 'All'], ['patient', 'Statistics'], ['quality', 'Quality']].map(([k, l]) => <button key={k} className={fType === k ? 'on' : ''} onClick={() => setFType(k)}>{l}</button>)}</div>
            <div className="seg">{[['30', '30d'], ['90', '90d'], ['365', '1y'], ['all', 'All']].map(([k, l]) => <button key={k} className={days === k ? 'on' : ''} onClick={() => setDays(k)}>{l}</button>)}</div>
            <button className="btn sm" onClick={exportCsv}><Ic d={I.download} s={14} />CSV</button>
          </div>} />

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search person, department, indicator…" style={{ ...inputStyle, maxWidth: 360, flex: 1 }} />
          {(q || fType !== 'all') && <button className="btn sm" onClick={() => { setQ(''); setFType('all'); }}>Clear</button>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12 }}>
          <Tile label="Total submissions" value={data.tot.total} />
          <Tile label="Responsible people" value={data.list.length} />
          <Tile label="Overall accuracy" value={data.tot.accuracy == null ? '—' : data.tot.accuracy.toFixed(1) + '%'} color={accColor(data.tot.accuracy)} sub={data.tot.approved + ' approved · ' + data.tot.rejected + ' rejected'} />
          <Tile label="On-time rate" value={data.tot.onPct == null ? '—' : data.tot.onPct.toFixed(0) + '%'} color={onColor(data.tot.onPct)} sub="submitted by month-end + 1" />
          <Tile label="Avg review turnaround" value={data.tot.avgTurn == null ? '—' : num1(data.tot.avgTurn) + 'd'} sub="submit → approve/reject" />
          <Tile label="Wrong data (rejected)" value={data.tot.rejected} color={data.tot.rejected ? 'var(--rose)' : 'var(--ink)'} sub={data.tot.autoRej ? data.tot.autoRej + ' dup auto-rejected' : ''} />
          <Tile label="Pending review" value={data.tot.pending} color={data.tot.pending ? '#b45309' : 'var(--ink)'} />
          <Tile label="Statistics / Quality" value={data.tot.patient + ' / ' + data.tot.quality} sub={data.statCount + ' stat + ' + data.qualCount + ' quality targets'} />
        </div>

        {data.reasonList.length > 0 && (
          <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Why data was rejected <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 11.5 }}>· top reasons</span></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {data.reasonList.slice(0, 8).map((r) => <span key={r.reason} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, background: 'var(--neg-bg)', color: 'var(--rose)', border: '1px solid #f1c6cd', borderRadius: 20, padding: '4px 11px', fontWeight: 600 }}>{r.reason}<b style={{ background: '#fff', borderRadius: 20, padding: '0 7px' }}>{r.n}</b></span>)}
            </div>
          </div>
        )}

        <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Submission timeline</div>
            <span style={{ flex: 1 }} />
            {[['Approved', '#16a34a'], ['Rejected', '#ef4444'], ['Pending', '#f59e0b']].map(([l, c]) => <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)' }}><span style={{ width: 9, height: 9, borderRadius: 2, background: c }} />{l}</span>)}
          </div>
          {tl.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 12.5, padding: '10px 0' }}>No submissions in this period.</div> : (
            <div>
              <svg viewBox="0 0 100 44" preserveAspectRatio="none" style={{ width: '100%', height: 150 }}>
                {tl.map((d, i) => { const x = i * bw + bw * 0.12, w = bw * 0.76; let y = 44; const seg = (v, c) => { const h = (v / tlMax) * 42; y -= h; return h > 0 ? <rect key={c} x={x} y={y} width={w} height={h} fill={c} /> : null; }; return <g key={i}>{seg(d.approved, '#16a34a')}{seg(d.rejected, '#ef4444')}{seg(d.pending, '#f59e0b')}</g>; })}
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
                <span>{dayLabel(tl[0].k)}</span>{tl.length > 2 && <span>{dayLabel(tl[Math.floor(tl.length / 2)].k)}</span>}<span>{dayLabel(tl[tl.length - 1].k)}</span>
              </div>
            </div>
          )}
        </div>

        <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', fontWeight: 700, fontSize: 13 }}>Responder Performance <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 11.5 }}>· click a row for details</span></div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead><tr>
                <th style={th} onClick={() => setSort('name')}>Responsible</th>
                <th style={{ ...th, textAlign: 'center' }} onClick={() => setSort('total')}>Total{caret('total')}</th>
                <th style={{ ...th, textAlign: 'center' }}>Stat / Qual</th>
                <th style={{ ...th, textAlign: 'center' }}>Appr.</th>
                <th style={{ ...th, textAlign: 'center' }} onClick={() => setSort('rejected')}>Wrong{caret('rejected')}</th>
                <th style={{ ...th, textAlign: 'center' }}>Pend.</th>
                <th style={{ ...th, textAlign: 'center' }} onClick={() => setSort('accuracy')}>Accuracy{caret('accuracy')}</th>
                <th style={{ ...th, textAlign: 'center' }} onClick={() => setSort('ontime')}>On-time{caret('ontime')}</th>
                <th style={{ ...th, textAlign: 'center' }} onClick={() => setSort('lag')}>Avg lag{caret('lag')}</th>
                <th style={{ ...th, textAlign: 'center' }} onClick={() => setSort('turn')}>Review{caret('turn')}</th>
                <th style={{ ...th, textAlign: 'right' }} onClick={() => setSort('last')}>Last{caret('last')}</th>
              </tr></thead>
              <tbody>
                {sorted.length === 0 && <tr><td style={{ ...td, textAlign: 'center', color: 'var(--muted)' }} colSpan={11}>No submissions in this period.</td></tr>}
                {sorted.map((p) => (
                  <tr key={p.name} onClick={() => setDrill(p.name)} style={{ cursor: 'pointer' }} className="dc-perf-row">
                    <td style={{ ...td, fontWeight: 600 }}>{p.name}{p.corrections ? <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 6 }}>({p.corrections} edit)</span> : null}</td>
                    <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{p.total}</td>
                    <td style={{ ...td, textAlign: 'center', color: 'var(--ink-2)' }}>{p.patient} / {p.quality}</td>
                    <td style={{ ...td, textAlign: 'center', color: 'var(--pos)' }}>{p.approved}</td>
                    <td style={{ ...td, textAlign: 'center', color: p.rejected ? 'var(--rose)' : 'var(--ink-2)', fontWeight: p.rejected ? 700 : 400 }}>{p.rejected}</td>
                    <td style={{ ...td, textAlign: 'center', color: p.pending ? '#b45309' : 'var(--ink-2)' }}>{p.pending}</td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      {p.accuracy == null ? <span style={{ color: 'var(--muted)' }}>—</span> : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 38, height: 6, borderRadius: 6, background: 'var(--line)', overflow: 'hidden', display: 'inline-block' }}><span style={{ display: 'block', height: '100%', width: p.accuracy + '%', background: accColor(p.accuracy) }} /></span>
                          <b style={{ color: accColor(p.accuracy) }}>{p.accuracy.toFixed(0)}%</b>
                        </span>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: 'center', color: onColor(p.onPct), fontWeight: 700 }}>{p.onPct == null ? '—' : p.onPct.toFixed(0) + '%'}</td>
                    <td style={{ ...td, textAlign: 'center', fontSize: 11.5, color: 'var(--ink-2)' }}>{lagTxt(p.avgLag)}</td>
                    <td style={{ ...td, textAlign: 'center', fontSize: 11.5, color: 'var(--ink-2)' }}>{p.avgTurn == null ? '—' : num1(p.avgTurn) + 'd'}</td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--muted)', fontSize: 11, whiteSpace: 'nowrap' }}>{when(p.last)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 16px' }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Recent activity</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {data.recent.map((s) => {
              const c = s.status === 'approved' ? 'var(--pos)' : s.status === 'rejected' ? 'var(--rose)' : '#b45309';
              const target = s.type === 'quality' ? (s.indicatorName || s.areaName) : s.departmentName;
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--line-2)', fontSize: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, flex: '0 0 auto' }} />
                  <span style={{ fontWeight: 600, minWidth: 120 }}>{respOf(s)}</span>
                  <span style={{ color: 'var(--muted)', textTransform: 'capitalize' }}>{s.type}</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink-2)' }}>{target} · {monthLabel(s.month)}</span>
                  <span style={{ color: c, fontWeight: 700, textTransform: 'capitalize', fontSize: 11 }}>{s.status}</span>
                  <span style={{ color: 'var(--muted)', fontSize: 11, whiteSpace: 'nowrap' }}>{when(s.submittedAt)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {drill && drillP && (
          <div onMouseDown={() => setDrill(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(16,32,46,.42)', zIndex: 400, display: 'grid', placeItems: 'center', padding: 'clamp(6px,3vw,20px)' }}>
            <div onMouseDown={(e) => e.stopPropagation()} style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, width: 'min(720px,96vw)', maxHeight: '92vh', overflow: 'auto', boxShadow: 'var(--shadow-pop)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--line-2)', position: 'sticky', top: 0, background: 'var(--panel)', zIndex: 3 }}>
                <Ic d={I.user} s={16} /><div style={{ fontWeight: 700, fontSize: 14 }}>{drill}</div>
                <span style={{ flex: 1 }} /><button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setDrill(null)}><Ic d={I.x} s={16} /></button>
              </div>
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 13 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 10 }}>
                  <Tile label="Submissions" value={drillP.total} />
                  <Tile label="Accuracy" value={drillP.accuracy == null ? '—' : drillP.accuracy.toFixed(0) + '%'} color={accColor(drillP.accuracy)} />
                  <Tile label="Wrong data" value={drillP.rejected} color={drillP.rejected ? 'var(--rose)' : 'var(--ink)'} />
                  <Tile label="On-time" value={drillP.onPct == null ? '—' : drillP.onPct.toFixed(0) + '%'} color={onColor(drillP.onPct)} />
                  <Tile label="Avg lag" value={lagTxt(drillP.avgLag)} />
                  <Tile label="Avg review" value={drillP.avgTurn == null ? '—' : num1(drillP.avgTurn) + 'd'} />
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620, fontSize: 12 }}>
                    <thead><tr>
                      <th style={{ ...th, cursor: 'default' }}>Type</th><th style={{ ...th, cursor: 'default' }}>Target</th><th style={{ ...th, cursor: 'default' }}>Month</th><th style={{ ...th, cursor: 'default' }}>Status</th><th style={{ ...th, cursor: 'default' }}>Submitted</th><th style={{ ...th, cursor: 'default' }}>Reason / note</th>
                    </tr></thead>
                    <tbody>
                      {drillRows.map((s) => {
                        const c = s.status === 'approved' ? 'var(--pos)' : s.status === 'rejected' ? 'var(--rose)' : '#b45309';
                        return (
                          <tr key={s.id}>
                            <td style={{ ...td, textTransform: 'capitalize' }}>{s.type}</td>
                            <td style={{ ...td }}>{targetOf(s)}</td>
                            <td style={{ ...td, whiteSpace: 'nowrap' }}>{monthLabel(s.month)}</td>
                            <td style={{ ...td, color: c, fontWeight: 700, textTransform: 'capitalize' }}>{s.status}{s.autoRejected ? ' (dup)' : ''}</td>
                            <td style={{ ...td, color: 'var(--muted)', fontSize: 11, whiteSpace: 'nowrap' }}>{when(s.submittedAt)}</td>
                            <td style={{ ...td, color: 'var(--ink-2)', fontSize: 11.5 }}>{s.rejectReason || s.correctionReason || s.note || (s.isCorrection ? 'Edit request' : '—')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  Object.assign(window, { DataResponsibles, DataPatientForm, DataQualityForm, DataReview, DataShareLinks, CollectorPortal, SubmissionAnalytics });
})();
