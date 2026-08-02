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
        if (r.ok) { setDone({ month, dept: dept.name, correction: pCorrection }); setFlash({ ts: Date.now(), title: pCorrection ? 'Correction submitted!' : 'Data submitted successfully!', sub: dept.name + ' · ' + monthLabel(month) }); setValues({}); setNote(''); setReason(''); toast(pCorrection ? 'Correction sent for review' : 'Submitted for review', 'success'); }
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
          {pCorrection && (
            <>
              <Banner>{dept ? dept.name : ''} · {monthLabel(month)} is already recorded — submitting sends a <b>correction (edit request)</b> to an administrator. The recorded value won’t change until it is approved.</Banner>
              <Field label="Reason for the correction"><input style={inputStyle} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. wrong count entered — should be Y not X" /></Field>
            </>
          )}
          {monthPending && <Banner>{dept ? dept.name : ''} · {monthLabel(month)} already has a submission pending review — wait for the admin to approve or reject it before editing.</Banner>}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button className="btn pri" disabled={busy || monthPending} onClick={submit}><Ic d={I.check} s={15} />{busy ? 'Submitting…' : (monthPending ? 'Pending review' : (pCorrection ? 'Submit correction for review' : 'Submit'))}</button>
            <button className="btn" disabled={busy} onClick={() => { setValues({}); setNote(''); setReason(''); setDone(null); }}>Clear</button>
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
        // Hand Hygiene with no data yet opens straight into the all-departments gateway.
        setDeptRows([]); setGroups(blankG); setGroupsDen(blankG); setDirectNum(''); setNumMode('dept');
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
    const save = () => {
      setBusy(true);
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
      dcApi.patch('/api/submissions/' + encodeURIComponent(s.id), body).then((r) => {
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
    const [showGaps, setShowGaps] = useState(false);
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
    const pDone = new Set(subsM.filter((s) => s.type === 'patient').map((s) => s.department));
    const qDone = new Set(subsM.filter((s) => s.type === 'quality').map((s) => s.area));
    const pMissing = depts.filter((d) => !pDone.has(d.id));
    const qMissing = areas.filter((a) => !qDone.has(a.key));
    const pPct = depts.length ? Math.round((depts.length - pMissing.length) / depts.length * 100) : 0;
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
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <Bar label="Patient statistics" done={depts.length - pMissing.length} total={depts.length} pct={pPct} color="linear-gradient(90deg,#1f9d57,#3ab5a7)" />
          <Bar label="Quality indicators" done={areas.length - qMissing.length} total={areas.length} pct={qPct} color="linear-gradient(90deg,#0090ca,#27a8db)" />
        </div>
        {gapN > 0 ? (
          <div style={{ marginTop: 12 }}>
            <button className="btn sm" onClick={() => setShowGaps((v) => !v)} style={{ color: '#9a6b00', borderColor: '#e6c34d' }}><Ic d={I.bell} s={13} />{showGaps ? 'Hide' : 'Show'} {gapN} not submitted</button>
            {showGaps && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 10 }}>
                {pMissing.length > 0 && <div style={{ flex: '1 1 260px' }}><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 6 }}>Patient — {pMissing.length} missing</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{pMissing.map((d) => <span key={d.id} style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: 'var(--pos-bg)', color: 'var(--pos)' }}>{d.name}</span>)}</div></div>}
                {qMissing.length > 0 && <div style={{ flex: '1 1 260px' }}><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 6 }}>Quality — {qMissing.length} missing</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{qMissing.map((a) => <span key={a.key} style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: 'var(--blue-50)', color: 'var(--blue-700,#0b6aa2)' }}>{a.name}</span>)}</div></div>}
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--pos)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><Ic d={I.check} s={14} />All departments and quality areas have submitted for {monthLabel(m)}.</div>
        )}
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
      let ok = 0;
      for (const id of ids) {
        try { const r = await dcApi.post('/api/submissions/' + encodeURIComponent(id) + '/' + kind, kind === 'reject' ? { reason: reason || '' } : {}); if (r && r.ok) ok++; } catch (e) { }
      }
      setBusy(''); setSel({}); setRejectFor(null);
      toast(ok + ' ' + (kind === 'approve' ? 'approved — applied to live data' : 'rejected') + (ok < ids.length ? ' (' + (ids.length - ok) + ' failed)' : ''), kind === 'approve' ? 'success' : 'info');
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
                  {g.map((s, i) => (
                    <div key={s.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '11px 13px', background: i === 0 ? 'var(--blue-50)' : 'var(--panel-2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                        {s.status === 'approved' ? <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--pos)', background: 'var(--pos-bg)', border: '1px solid #bfe6cf', borderRadius: 999, padding: '1px 7px' }}>Previous · on record</span> : i === 0 ? <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--blue-700,#0b6aa2)', background: '#fff', border: '1px solid var(--blue-100,#cfe6f7)', borderRadius: 999, padding: '1px 7px' }}>Latest</span> : null}
                        <b style={{ fontSize: 12.5, color: 'var(--ink)' }}>{(s.responsible && s.responsible.name) || s.submittedBy || '—'}</b>
                        <span style={{ fontSize: 11.5, color: 'var(--muted)' }} className="num">{(() => { try { return new Date(s.submittedAt).toLocaleString(); } catch (e) { return ''; } })()}</span>
                        <span style={{ flex: 1 }} />{statusChip(s.status)}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{valuesSummaryEl(s)}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 9, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button className="btn sm" onClick={() => setDetail(s)}><Ic d={I.search} s={13} />View / edit</button>
                        {s.status === 'pending' && <>
                          <button className="btn sm pri" disabled={busy === 'bulk'} onClick={async () => { await runAction([s.id], 'approve'); setDupGroup((cur) => cur && cur.filter((x) => x.id !== s.id)); }}><Ic d={I.check} s={13} />Keep (approve)</button>
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
  function CollectorHistory() {
    const [rows, setRows] = useState(null);
    const [detail, setDetail] = useState(null);
    const [view, setView] = useState('patient');
    const me = (typeof window !== 'undefined' && window.__UNICO_USER__) || {};
    // A collector may edit only their OWN still-PENDING submission (values only).
    const ownsSub = (s) => !!s && s.status === 'pending' && [me.name, me.username].filter(Boolean).some((n) => n === s.submittedBy || (s.responsible && s.responsible.name === n));
    const load = () => dcApi.get('/api/submissions?limit=300').then((r) => setRows(r.ok ? r.submissions : [])).catch(() => setRows([]));
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
    return (
      <>
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
            : <div style={{ overflowX: 'auto' }}><table className="tbl" style={{ width: '100%' }}>
              <thead><tr><th>Submitted on</th>{isEdits ? <React.Fragment><th>Department</th><th>For</th><th>Reason</th></React.Fragment> : (isQ ? <React.Fragment><th>Area</th><th>Indicator</th><th>Quarter</th></React.Fragment> : <React.Fragment><th>Department</th><th>Month</th></React.Fragment>)}<th>Status</th><th></th></tr></thead>
              <tbody>{shown.map((s) => (
                <tr key={s.id} onClick={() => setDetail(s)} title="Tap to view" style={{ cursor: 'pointer' }}>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>{when(s.submittedAt)}</td>
                  {isEdits
                    ? <React.Fragment><td style={{ fontWeight: 600 }}>{s.type === 'quality' ? s.areaName : s.departmentName}</td><td>{(s.type === 'quality' ? (s.indicatorName || '') + ' · ' : '') + monthLabel(s.month)}</td><td style={{ fontSize: 12, color: 'var(--ink-2)', maxWidth: 260 }}>{s.correctionReason || '—'}{s.status === 'rejected' && s.rejectReason ? <div style={{ color: 'var(--rose)', fontSize: 11, marginTop: 2 }}>Rejected: {s.rejectReason}</div> : null}</td></React.Fragment>
                    : (isQ
                      ? <React.Fragment><td style={{ fontWeight: 600 }}>{s.areaName}</td><td>{s.indicatorName}</td><td>{s.quarter}</td></React.Fragment>
                      : <React.Fragment><td style={{ fontWeight: 600 }}>{s.departmentName}</td><td>{monthLabel(s.month)}</td></React.Fragment>)}
                  <td>{statusChip(s.status)}</td>
                  <td style={{ textAlign: 'right' }}><button className="btn sm" onClick={() => setDetail(s)}><Ic d={I.search} s={13} />View</button></td>
                </tr>
              ))}</tbody>
            </table></div>}
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
