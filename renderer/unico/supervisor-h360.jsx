/* UNICO — H360 link for Supervisor Reports (renderer).
   What used to be the stand-alone "Unico Patient Collector", inside the app:

     supH360  — H360 Patients: start a collection, the patients of every nurse station,
                each patient's records, the IPD Admission list, Excel, and (administrators)
                the H360 login and what is kept in the app database.
     (New Report) — "Import from H360" in the report editor uses SupH360Update below; the
                separate H360 log sheet screen is gone, the report itself prints as the Word log sheet.

   Data: server/h360 (/api/h360/*). Both screens sit beside the existing Supervisor
   Reports screens and share their styles (.sup-*); what is new is prefixed .h3-. */

const { useState, useEffect, useMemo, useRef, useCallback } = React;
const Ic = window.Ic, I = window.I;

const h3Toast = (m, t) => { try { window.UI && window.UI.toast && window.UI.toast(m, t || 'success'); } catch (e) {} };
const h3Can = (action) => { try { return !window.unicoCan || window.unicoCan('supervisor', action); } catch (e) { return true; } };
async function h3Api(path, options) {
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
const h3Pad = (n) => String(n).padStart(2, '0');
const h3ShowDate = (date) => String(date || '').split('-').reverse().join('/');
const h3When = (value) => { try { return value ? new Date(value).toLocaleString() : ''; } catch (e) { return ''; } };
const h3Today = () => { const d = new Date(); return d.getFullYear() + '-' + h3Pad(d.getMonth() + 1) + '-' + h3Pad(d.getDate()); };
const h3Shift = () => { const h = new Date().getHours(); return h < 14 ? 'Morning' : h < 21 ? 'Evening' : 'Night'; };
const h3Portal = (node) => { try { if (typeof document !== 'undefined' && typeof ReactDOM !== 'undefined' && ReactDOM.createPortal) return ReactDOM.createPortal(node, document.body); } catch (e) {} return node; };
const H3_STATION = 'Nurse Station';
// A patient whose discharge has been requested in H360 (the rows it shows in pink).
const onPcSite = (status) => !status || status.site === 'pc';
const h3Requested = (row) => /^yes/i.test(String((row || {})['Discharge Request'] || ''));
const H3_SITE = { pc: 'the hospital PC', cloud: 'the live site' };

function H3Hero({ title, sub, children }) {
  return (
    <div className="sup-hero">
      <div className="sup-hero-ic"><Ic d={I.pulse || I.doc} s={22} c="#fff" /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="sup-hero-t">{title}</div>
        {sub && <div className="sup-hero-s">{sub}</div>}
      </div>
      <div className="sup-hero-r">{children}</div>
    </div>
  );
}
function H3Btn({ kind, sm, onClick, children, title, disabled, type }) {
  return <button type={type || 'button'} className={'sup-btn' + (kind ? ' ' + kind : '') + (sm ? ' sm' : '')} onClick={onClick} title={title || ''} disabled={disabled}>{children}</button>;
}

/* ================= H360 Patients ================= */

function H3Pairs({ items }) {
  const shown = items.filter(([, value]) => value !== null && value !== undefined && value !== '');
  if (!shown.length) return null;
  return <div className="h3-pairs">{shown.map(([name, value], i) => <div key={i}><span>{name}</span>{String(value)}</div>)}</div>;
}

function H3Record({ record }) {
  const name = record.group ? record.group + ' - ' + record.label : record.label;
  const rows = record.entries.reduce((n, entry) => n + entry.rows.length, 0);
  const parts = [];
  if (rows) parts.push(rows + (rows === 1 ? ' entry' : ' entries'));
  if (record.values.length) parts.push(record.values.length + ' fields');
  // Form values, grouped under the section of the form they belong to.
  const sections = [];
  record.values.forEach((value) => {
    let at = sections.find((s) => s[0] === value.section);
    if (!at) { at = [value.section, []]; sections.push(at); }
    at[1].push([value.label, value.value]);
  });
  return (
    <details className="h3-rec" open>
      <summary>{name}<small>{parts.join(', ')}</small></summary>
      <div className="h3-rec-b">
        {sections.map(([section, items], i) => <div key={'s' + i}>{section ? <h5>{section}</h5> : null}<H3Pairs items={items} /></div>)}
        {record.entries.map((entry, i) => (
          <div key={'e' + i}>
            {entry.title ? <h5>{entry.title}</h5> : null}
            <div className="h3-scroll"><table className="h3-rtbl">
              {entry.columns.length ? <thead><tr>{entry.columns.map((c, j) => <th key={j}>{c}</th>)}</tr></thead> : null}
              <tbody>{entry.rows.map((row, r) => <tr key={r}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody>
            </table></div>
          </div>
        ))}
      </div>
    </details>
  );
}

function H3PatientDrawer({ admissionNo, onClose }) {
  const [patient, setPatient] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setPatient(null); setError('');
    h3Api('/api/h360/patient/' + encodeURIComponent(admissionNo)).then((p) => { if (live) setPatient(p); }).catch((e) => { if (live) setError(e.message); });
    const esc = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => { live = false; document.removeEventListener('keydown', esc); };
  }, [admissionNo]);
  const row = (patient && patient.row) || {};
  const has = (record) => record.entries.length > 0 || record.values.length > 0;
  const recordName = (record) => (record.group ? record.group + ' - ' + record.label : record.label);
  // Records collected before the reader was rebuilt have no entries or values yet.
  const records = patient ? patient.modules.map((r) => Object.assign({}, r, { entries: r.entries || [], values: r.values || [] })) : [];
  const saved = records.filter(has);
  const failed = records.filter((r) => r.status !== 200);
  const blank = records.filter((r) => !has(r) && r.status === 200);
  const tabs = Array.from(new Set(saved.map((r) => r.tab || "Nurse's Tab"))).sort();
  // Internal ids and switched-off flags in the admission record are not shown.
  const admission = patient ? Object.entries(patient.admission || {})
    .filter(([key, value]) => value !== null && value !== '' && !/_(fk|pk)$/.test(key) && !(/_ind$/.test(key) && String(value) === '0'))
    .map(([key, value]) => [key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()), value]) : [];
  return h3Portal(
    <div className="h3-drawer-bg" onClick={onClose}>
      <aside className="h3-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="h3-drawer-h">
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>{row['Patient Name'] || 'Patient'}</b>
            {patient && <small>{[row[H3_STATION], 'Bed ' + (row['Bed No'] || '-'), 'UHID ' + (row.UHID || '-')].join(' | ')}</small>}
          </div>
          <button className="sup-modal-x" onClick={onClose} title="Close"><Ic d={I.x} s={16} c="#fff" /></button>
        </div>
        <div className="h3-drawer-b">
          {error && <div className="sup-alert critical">{error}</div>}
          {!patient && !error && <div className="h3-muted">Loading…</div>}
          {patient && <React.Fragment>
            <h4>Patient</h4>
            <H3Pairs items={Object.entries(row).filter(([name]) => name !== 'Records').concat(Object.entries(patient.alerts || {}))} />
            {admission.length > 0 && <details className="h3-rec"><summary>More admission details</summary><div className="h3-rec-b"><H3Pairs items={admission} /></div></details>}
            {patient.records === 'pc-only' && <div className="sup-alert info" style={{ marginTop: 12 }}>The records of this patient (notes, vital signs, medicines) are not kept in the app database, which holds the log sheet content only. Open the app on the hospital PC to read them, or ask the administrator to keep everything in the app database.</div>}
            {patient.records !== 'pc-only' && !saved.length && <React.Fragment><h4>Records with saved data (0)</h4><div className="h3-muted">None yet. Run a collection to read them.</div></React.Fragment>}
            {tabs.map((tab) => {
              const inTab = saved.filter((r) => (r.tab || "Nurse's Tab") === tab);
              return <React.Fragment key={tab}><h4>{tab}: records with saved data ({inTab.length})</h4>{inTab.map((r, i) => <H3Record key={r.key + i} record={r} />)}</React.Fragment>;
            })}
            {blank.length > 0 && <React.Fragment><h4>Nothing recorded in</h4><div className="h3-muted">{blank.map(recordName).join(', ')}</div></React.Fragment>}
            {failed.length > 0 && <React.Fragment><h4>Could not be opened</h4><div className="h3-muted">{failed.map(recordName).join(', ')}</div></React.Fragment>}
          </React.Fragment>}
        </div>
      </aside>
    </div>
  );
}

// Administrators only: the login collections run under, and what is kept in the app database.
function H3Settings({ status, reload, onClose }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [level, setLevel] = useState(status.cloudData);
  const act = async (fn) => { setBusy(true); setError(''); try { await fn(); await reload(); } catch (e) { setError(e.message); } setBusy(false); };
  const saveLogin = (event) => { event.preventDefault(); act(async () => { await h3Api('/api/h360/login', { method: 'POST', body: { user, pass } }); setUser(''); setPass(''); h3Toast('H360 login saved.'); }); };
  const forget = () => {
    if (!confirm('Remove the saved H360 login from ' + (H3_SITE[status.site] || 'this server') + '? Collections from here stop working until a login is entered again.')) return;
    act(async () => { await h3Api('/api/h360/login', { method: 'DELETE' }); h3Toast('H360 login removed.'); });
  };
  const saveLevel = () => {
    let removeOnline = false;
    if (level === 'sheet' && status.cloudData === 'all') {
      removeOnline = confirm('Keep only the log sheet content in the app database?\n\nOK also removes the full patient records and contact details that are stored there now. They stay on the hospital PC.\nCancel keeps what is already stored and only applies the choice to new collections.');
    }
    if (level === 'all' && !confirm('Keep everything in the app database?\n\nEvery record the collector reads (notes, vital signs, medicines, assessments) of every in-patient will be stored online, so the patient viewer and Excel work on the live site too.')) return;
    act(async () => { await h3Api('/api/h360/options', { method: 'POST', body: { cloudData: level, removeOnline } }); h3Toast('Saved. It applies from the next collection.'); });
  };
  const fromEnv = status.loginSource === 'environment';
  return (
    <div className="sup-card"><div className="sup-card-b">
      <div className="h3-sethead"><b>H360 settings</b><span className="h3-muted">Administrators only</span><span style={{ flex: 1 }} /><H3Btn sm onClick={onClose}>Close</H3Btn></div>
      {error && <div className="sup-alert critical">{error}</div>}
      <div className="h3-setgrid">
        <form onSubmit={saveLogin} autoComplete="off">
          <div className="h3-settitle">{status.hasLogin ? 'H360 login in use: ' + status.user : 'Enter the H360 login'}</div>
          <div className="h3-muted">Collections from {H3_SITE[status.site] || 'here'} sign in to H360 as this user. The password is sealed before it is saved and is never shown again.{status.site === 'pc' ? ' The live site keeps its own copy: enter it there once too, to use Refresh patient lists.' : ' The hospital PC keeps its own copy.'}</div>
          {fromEnv ? <div className="sup-alert info" style={{ marginTop: 10 }}>This server takes the login from its own settings (HIS_USER / HIS_PASS).</div> : (
            <div className="h3-loginrow">
              <div className="sup-fld"><label>User ID</label><input value={user} onChange={(e) => setUser(e.target.value)} autoComplete="off" required /></div>
              <div className="sup-fld"><label>Password</label><input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" required /></div>
              <H3Btn kind="pri" type="submit" disabled={busy}>Save login</H3Btn>
              {status.hasLogin && <H3Btn kind="dgr" onClick={forget} disabled={busy}>Remove saved login</H3Btn>}
            </div>
          )}
        </form>
        <div>
          <div className="h3-settitle">What is kept in the app database</div>
          <div className="h3-muted">The hospital PC always keeps everything it reads. This decides how much of it is also stored online, where the live site can show it.</div>
          <label className="h3-radio"><input type="radio" name="h3level" checked={level === 'sheet'} onChange={() => setLevel('sheet')} /><span><b>Log sheet content only</b><br />Name, UHID, bed, consultant, diagnosis, remarks, surgeries, procedures and counts. The full records stay on the hospital PC.</span></label>
          <label className="h3-radio"><input type="radio" name="h3level" checked={level === 'all'} onChange={() => setLevel('all')} /><span><b>Everything collected</b><br />Also every record of every in-patient, so the patient viewer and Excel work on the live site.</span></label>
          <H3Btn kind="pri" onClick={saveLevel} disabled={busy || level === status.cloudData}>Save choice</H3Btn>
        </div>
      </div>
    </div></div>
  );
}

// The OPD Nurse Station list of the day: how many out-patients, how many have had their
// vitals taken, how many the doctor has seen; by department, and one by one where kept.
function H3Opd({ opd, onPc, query }) {
  if (!opd || !opd.counts) return <div className="sup-card"><div className="sup-card-b h3-muted">The OPD list has not been read yet. {onPc ? 'It is read with every collection.' : 'It is read by the collection on the hospital PC.'}</div></div>;
  const c = opd.counts;
  const q = String(query || '').trim().toLowerCase();
  const rows = (opd.rows || []).filter((row) => !q || [row.name, row.department, row.doctor, row.status, row.serial].some((value) => String(value || '').toLowerCase().includes(q)));
  return (
    <React.Fragment>
      <div className="h3-muted">OPD Nurse Station list of {h3ShowDate(opd.date)}, read {h3When(opd.collectedAt)}. A report takes "came to OPD" as its OPD total.</div>
      <div className="h3-tiles">
        <div className="h3-tile"><b>{c.all}</b><span>Out-patients today</span></div>
        <div className="h3-tile ok"><b>{c.vitals}</b><span>Vitals taken</span></div>
        <div className="h3-tile"><b>{c.prescribed}</b><span>Seen by the doctor</span></div>
        <div className="h3-tile"><b>{c.attended}</b><span>Came to OPD (vitals taken or seen)</span></div>
        <div className="h3-tile"><b>{Math.max(c.all - c.attended, 0)}</b><span>Appointed, not yet come</span></div>
      </div>
      {(opd.departments || []).length > 0 && <div className="sup-card"><div className="h3-tablewrap"><table className="h3-table">
        <thead><tr><th>Department</th><th>Out-patients</th><th>Vitals taken</th><th>Seen by the doctor</th></tr></thead>
        <tbody>{opd.departments.map((d) => <tr key={d.department}><td>{d.department}</td><td>{d.total}</td><td>{d.vitals}</td><td>{d.prescribed}</td></tr>)}</tbody>
      </table></div></div>}
      {(opd.rows || []).length > 0 && <div className="sup-card"><div className="h3-tablewrap"><table className="h3-table">
        <thead><tr><th>#</th><th>Patient</th><th>Age</th><th>Gender</th><th>Department</th><th>Doctor</th><th>Serial</th><th>Status</th></tr></thead>
        <tbody>{rows.map((row, i) => <tr key={i} className={row.vitals ? 'vit' : ''}><td>{i + 1}</td><td>{row.name}</td><td>{row.age}</td><td>{row.gender}</td><td>{row.department}</td><td>{row.doctor}</td><td>{row.serial}</td><td>{row.status}</td></tr>)}</tbody>
      </table></div></div>}
      {!(opd.rows || []).length && <div className="h3-muted">The app database holds the OPD counts only, not who the out-patients are (log sheet content only).</div>}
    </React.Fragment>
  );
}

// The collection as it runs: which step it is at, how far through the patients (in all
// and station by station), pages read and time taken. Redrawn with every status check.
const H3_STEPS = [['signin', 'Sign in'], ['lists', 'Patient lists'], ['register', 'IPD Admission list'], ['opd', 'OPD list'], ['records', 'Patient records'], ['saving', 'Saving'], ['done', 'Done']];
const H3_MODES = { quick: 'Quick update', full: 'Full collection', list: 'List-only refresh' };
function h3Elapsed(from, to) {
  const s = Math.max(0, Math.round(((to ? new Date(to) : new Date()) - new Date(from)) / 1000));
  return (s >= 60 ? Math.floor(s / 60) + ' min ' : '') + (s % 60) + ' s';
}
function H3Progress({ status }) {
  const p = status.progress;
  if (!p) return null;
  const running = !!status.running;
  const failed = !running && !!status.error;
  const steps = H3_STEPS.filter(([id]) => p.mode !== 'list' || id !== 'records');
  const at = steps.findIndex(([id]) => id === (failed ? p.failedAt || p.stage : p.stage));
  const finished = !running && !failed && p.stage === 'done';
  const pct = finished ? 100 : p.patients ? Math.min(100, Math.round((p.done / p.patients) * 100)) : 0;
  const name = H3_MODES[p.mode] || 'Collection';
  return (
    <div className={'sup-card h3-live' + (running ? ' on' : failed ? ' fail' : '')}><div className="sup-card-b">
      <div className="h3-livehead">
        {running && <span className="h3-pulse" />}
        <b>{name} {running ? 'is running' : failed ? 'stopped' : p.stage === 'done' ? 'finished' : 'paused'}</b>
        <span className="h3-muted">{h3Elapsed(status.startedAt, running ? null : status.finishedAt)}</span>
        <span style={{ flex: 1 }} />
        <span className="h3-livenum"><b>{p.done}</b> of {p.patients} patients</span>
        {p.mode !== 'list' && <span className="h3-livenum"><b>{Number(p.pages || 0).toLocaleString()}</b> pages read</span>}
      </div>
      <div className="h3-steps">{steps.map(([id, label], i) => (
        <span key={id} className={'h3-step' + (finished || i < at ? ' done' : i === at ? (failed ? ' fail' : ' now') : '')}>{label}</span>
      ))}</div>
      <div className="h3-bar"><i style={{ width: pct + '%' }} /></div>
      {running && p.last && <div className="h3-muted" style={{ marginTop: 6 }}>Last read: {p.last}</div>}
      {p.stations.length > 0 && <div className="h3-stbars">{p.stations.map((s) => (
        <div key={s.station} className="h3-stbar"><span title={s.station}>{s.station}</span><div className="h3-bar sm"><i style={{ width: (s.total ? Math.round((s.done / s.total) * 100) : 100) + '%' }} /></div><em>{s.done}/{s.total}</em></div>
      ))}</div>}
    </div></div>
  );
}

function H3Patients({ setRoute }) {
  const [status, setStatus] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [admissions, setAdmissions] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('patients');
  const [station, setStation] = useState(null);
  const [onlyRequested, setOnlyRequested] = useState(false);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(null);
  const [settings, setSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [opd, setOpd] = useState(null);
  // On the live site a collection is driven from this page, a few patients per request.
  const [stepping, setStepping] = useState(false);
  const going = useRef(false);
  const wasRunning = useRef(false);
  const logRef = useRef(null);

  const loadData = useCallback(async () => {
    try {
      const [p, a, o] = await Promise.all([h3Api('/api/h360/patients'), h3Api('/api/h360/admissions').catch(() => null), h3Api('/api/h360/opd').catch(() => null)]);
      setSnapshot(p); setAdmissions(a); setOpd(o); setError('');
    } catch (e) { setError(e.message); }
    setLoaded(true);
  }, []);
  const loadStatus = useCallback(async () => {
    try {
      const s = await h3Api('/api/h360/status');
      setStatus(s);
      if (wasRunning.current && !s.running) loadData();
      wasRunning.current = s.running;
      return s;
    } catch (e) { return null; }
  }, [loadData]);
  useEffect(() => { loadStatus(); loadData(); return () => { going.current = false; }; }, []);
  // While a collection runs the log is followed second by second; otherwise a slow check is enough.
  const running = !!(status && status.running);
  useEffect(() => {
    const timer = setInterval(loadStatus, running ? 1000 : 20000);
    return () => clearInterval(timer);
  }, [running, loadStatus]);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [status && status.log && status.log.length]);

// The live site: one request per step, until every patient is read or it is stopped.
  // A step that fails is tried again; after three in a row it waits for "Continue".
  const runSteps = async (first) => {
    going.current = true; setStepping(true);
    let state = first;
    let fails = 0;
    while (state && state.resumable && going.current) {
      try {
        const r = await h3Api('/api/h360/collect/step', { method: 'POST', body: { id: state.id } });
        state = r.state; fails = 0;
        setStatus((prev) => Object.assign({}, prev, state));
      } catch (e) {
        if (e.status === 409 || e.status === 423 || ++fails >= 3) { setError(e.message + (e.status === 409 || e.status === 423 ? '' : ' Press Continue to carry on from where it stopped.')); break; }
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
    }
    going.current = false; setStepping(false);
    await loadStatus(); await loadData();
    if (state && !state.resumable) h3Toast('Collection finished.');
  };
  const collect = async (mode) => {
    setBusy(true); setError('');
    try {
      const result = await h3Api('/api/h360/collect', { method: 'POST', body: { mode } });
      if (result.state) {
        // The lists are in; the records follow step by step.
        setStatus((prev) => Object.assign({}, prev, result.state));
        await loadData();
        setBusy(false);
        return runSteps(result.state);
      }
      wasRunning.current = true;
      const s = await loadStatus();
      // The live site refreshes while the request waits, so it is already over.
      if (s && !s.running) { await loadData(); if (result.error) setError(result.error); else h3Toast('Patient lists refreshed.'); }
    } catch (e) { setError(e.message); }
    setBusy(false);
  };
  const importOld = async () => {
    setBusy(true);
    try { const r = await h3Api('/api/h360/sheets/convert', { method: 'POST' }); h3Toast(r.converted + ' report(s) brought in as drafts.'); await loadStatus(); setRoute({ view: 'supHistory' }); }
    catch (e) { setError(e.message); }
    setBusy(false);
  };

  const rows = useMemo(() => {
    if (!snapshot) return [];
    const q = query.trim().toLowerCase();
    return snapshot.rows.filter((row) => (station === null || row[H3_STATION] === station)
      && (!onlyRequested || h3Requested(row))
      && (!q || snapshot.columns.some((name) => String(row[name] || '').toLowerCase().includes(q))));
  }, [snapshot, station, query, onlyRequested]);
  const requestedCount = useMemo(() => (snapshot ? snapshot.rows.filter(h3Requested).length : 0), [snapshot]);
  const regCols = useMemo(() => {
    if (!admissions || !admissions.rows.length) return [];
    const raw = admissions.rows.some((r) => r.raw);
    const names = [];
    admissions.rows.forEach((r) => Object.keys((raw ? r.raw : r.fields) || {}).forEach((k) => { if (names.indexOf(k) < 0) names.push(k); }));
    return { raw, names: names.slice(0, 40) };
  }, [admissions]);
  const regRows = useMemo(() => {
    if (!admissions || !regCols.names) return [];
    const q = query.trim().toLowerCase();
    const of = (r) => (regCols.raw ? r.raw : r.fields) || {};
    return admissions.rows.filter((r) => !q || regCols.names.some((name) => String(of(r)[name] || '').toLowerCase().includes(q))).slice(0, 600);
  }, [admissions, regCols, query]);

  const mayCollect = h3Can('add');
  const canStart = !!status && status.hasLogin && !running && !busy && !stepping && mayCollect;
  const paused = !!status && !onPcSite(status) && status.resumable && !stepping && !busy;
  const onPc = !status || status.site === 'pc';
  const shape = admissions && admissions.shape;
  const sub = snapshot
    ? snapshot.rows.length + ' in-patients in ' + snapshot.stations.length + ' stations · collected ' + h3When(snapshot.collectedAt) + (snapshot.site ? ' from ' + (H3_SITE[snapshot.site] || snapshot.site) : '')
    : 'Patients of every nurse station, read from H360';
  return (
    <div className="sup-wrap">
      <H3Hero title="H360 Patients" sub={sub}>
        {status && status.canManage && <H3Btn onClick={() => setSettings((v) => !v)} title="H360 login and what is kept in the app database"><Ic d={I.gear} s={15} c="#fff" />{status.hasLogin ? 'H360 login: ' + status.user : 'H360 login'}</H3Btn>}
        {snapshot && <a className="sup-btn" href="/api/h360/export.xlsx"><Ic d={I.download} s={15} c="#fff" />Excel</a>}
        <H3Btn onClick={() => collect('list')} disabled={!canStart} title="Updates only the patient lists (admissions, beds, discharge requests, who has left). Takes a few seconds; no records are read.">List only</H3Btn>
        <H3Btn onClick={() => collect('full')} disabled={!canStart} title="Reads every record of every patient again. Slow; use it once a day or when something looks out of date.">Full collection</H3Btn>
        {stepping
          ? <H3Btn kind="pri" onClick={() => { going.current = false; }} title="Stops after the patients being read now. What was read is kept; Continue carries on.">Stop</H3Btn>
          : <H3Btn kind="pri" onClick={() => collect('quick')} disabled={!canStart} title={onPc ? 'Reads notes, vital signs and handovers of every patient, new patients in full, and other records only when they have become old.' : 'Updates the lists, then reads the records of every patient not read in the last two hours. Keep this page open while it runs.'}>{running || busy ? 'Collecting…' : 'Collect all patients'}</H3Btn>}
      </H3Hero>

      {settings && status && status.canManage && <H3Settings status={status} reload={loadStatus} onClose={() => setSettings(false)} />}
      {status && !status.hasLogin && <div className="sup-alert warn">{status.canManage
        ? (status.loginElsewhere ? 'The H360 login was saved from ' + (status.site === 'pc' ? 'the live site' : 'the hospital PC') + ', which keeps its own sealed copy. Enter it once here too: click "H360 login" above.' : 'No H360 login is saved yet. Click "H360 login" above and enter it once.')
        : 'No H360 login is saved for ' + (H3_SITE[status.site] || 'this server') + ' yet. Ask the administrator to enter it.'}</div>}
      {status && !onPc && stepping && <div className="sup-alert info">Keep this page open while the collection runs. It reads a few patients at a time; if it is interrupted, what was read is kept and Continue carries on.</div>}
      {paused && <div className="sup-alert warn"><span style={{ flex: 1 }}>A collection stopped part-way: {status.progress ? status.progress.done + ' of ' + status.progress.patients : 'some'} patients read.{status.error ? ' (' + status.error + ')' : ''}</span><H3Btn sm kind="pri" onClick={() => { setError(''); runSteps(status); }} disabled={!mayCollect}>Continue</H3Btn></div>}
      {status && status.localStore && status.localStore.ok === false && <div className="sup-alert critical">{status.localStore.error}</div>}
      {status && status.legacyReports > 0 && <div className="sup-alert info"><span style={{ flex: 1 }}>{status.legacyReports} report(s) written with the old collector are on this computer and not in the app yet.</span><H3Btn sm onClick={importOld} disabled={busy}>Bring them in</H3Btn></div>}
      {error && <div className="sup-alert critical">{error}</div>}
      {status && status.error && !running && <div className="sup-alert critical">{status.error}</div>}
      {snapshot && (snapshot.warnings || []).map((w, i) => <div key={i} className="sup-alert warn">{w}</div>)}

      {status && <H3Progress status={stepping ? Object.assign({}, status, { running: true, error: null }) : status} />}
      {status && status.log && status.log.length > 0 && (
        <div className="sup-card"><ul className="h3-log" ref={logRef}>{status.log.map((line, i) => <li key={i}>{new Date(line.at).toLocaleTimeString()}  {line.message}</li>)}</ul></div>
      )}

      {snapshot && <div className="h3-tiles">
        <button className={'h3-tile' + (station === null && !onlyRequested ? ' on' : '')} onClick={() => { setStation(null); setOnlyRequested(false); }}><b>{snapshot.rows.length}</b><span>All stations</span></button>
        {requestedCount > 0 && <button className={'h3-tile req' + (onlyRequested ? ' on' : '')} title="Patients whose discharge has been requested in H360 (shown in pink there). A report imports them into Discharged." onClick={() => { setOnlyRequested((v) => !v); setTab('patients'); }}><b>{requestedCount}</b><span>Discharge requested</span></button>}
        {snapshot.stations.map((item) => <button key={item.station} className={'h3-tile' + (station === item.station ? ' on' : '')} onClick={() => { setStation(item.station); setTab('patients'); }}><b>{item.count}</b><span>{item.station}</span></button>)}
      </div>}

      {(snapshot || (admissions && admissions.rows.length > 0) || opd) && <div className="sup-toolbar">
        <div className="sup-seg">
          <button className={tab === 'patients' ? 'on' : ''} onClick={() => setTab('patients')}>In-patients{snapshot ? ' (' + snapshot.rows.length + ')' : ''}</button>
          <button className={tab === 'admissions' ? 'on' : ''} onClick={() => setTab('admissions')}>IPD Admission list{admissions && admissions.rows.length ? ' (' + admissions.rows.length + ')' : ''}</button>
          <button className={tab === 'opd' ? 'on' : ''} onClick={() => setTab('opd')}>OPD{opd && opd.counts ? ' (' + opd.counts.all + ')' : ''}</button>
        </div>
        <input className="h3-search" type="search" placeholder="Search name, UHID, bed, consultant…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <span className="h3-muted" style={{ flex: 1 }}>{tab === 'patients' && snapshot ? 'Showing ' + rows.length + ' of ' + snapshot.rows.length + ' patients. Click a patient to open the records.' : ''}</span>
      </div>}

      {tab === 'patients' && snapshot && <div className="sup-card"><div className="h3-tablewrap"><table className="h3-table">
        <thead><tr><th>#</th>{snapshot.columns.map((name) => <th key={name}>{name}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => (
          <tr key={row._adm || i} className={(row._adm ? 'open' : '') + (h3Requested(row) ? ' req' : '')} onClick={() => row._adm && setOpen(row._adm)}>
            <td>{i + 1}</td>{snapshot.columns.map((name) => <td key={name}>{row[name] || ''}</td>)}
          </tr>
        ))}</tbody>
      </table></div></div>}

      {tab === 'admissions' && <React.Fragment>
        {shape && shape.found && <div className="h3-muted">Read {h3When(admissions.collectedAt)} from the IPD Admission page of H360{shape.total > shape.read ? ' (' + shape.read + ' of ' + shape.total + ' rows)' : ''}. Used for: {Object.keys(shape.recognised || {}).join(', ') || 'nothing yet'}.{(shape.missing || []).length ? ' Not found on the page: ' + shape.missing.join(', ') + '.' : ''}</div>}
        {(!admissions || !admissions.rows.length) && <div className="sup-card"><div className="sup-card-b h3-muted">The IPD Admission list has not been read yet. {onPc ? 'It is read with every collection: click "Collect all patients" or "List only".' : 'It is read by the collection on the hospital PC.'}{status && status.lastRun && status.lastRun.register && status.lastRun.register.error ? ' Last attempt: ' + status.lastRun.register.error : ''}</div></div>}
        {admissions && admissions.rows.length > 0 && <div className="sup-card"><div className="h3-tablewrap"><table className="h3-table">
          <thead><tr><th>#</th>{regCols.names.map((name) => <th key={name}>{name}</th>)}</tr></thead>
          <tbody>{regRows.map((r, i) => <tr key={i}><td>{i + 1}</td>{regCols.names.map((name) => <td key={name}>{((regCols.raw ? r.raw : r.fields) || {})[name] || ''}</td>)}</tr>)}</tbody>
        </table></div></div>}
      </React.Fragment>}

      {tab === 'opd' && <H3Opd opd={opd} onPc={onPc} query={query} />}

      {loaded && !snapshot && tab === 'patients' && <div className="sup-card"><div className="sup-card-b h3-muted" style={{ textAlign: 'center', padding: 36 }}>No patients collected yet. {onPc ? <span>Press <b>Collect all patients</b>.</span> : <span>Press <b>Refresh patient lists</b>, or run a collection on the hospital PC.</span>}</div></div>}
      {open && <H3PatientDrawer admissionNo={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/* ================= H360 inside the shift report (New Report) ================= */

// What "Import from H360" may do to the report on screen (server/h360/sheets.js UPDATE_DEFAULTS).
const H3_UPDATE_DEFAULTS = { addNew: true, updateDetails: true, diagnosis: 'empty', remarks: 'empty', remarksFrom: 'nursing', useComplaint: false, sections: true, register: true, dischargeRequests: true };
const H3_OPTIONS_KEY = 'unico_h360_update_options_v1';

// The import panel of the report editor: how fresh the H360 collection is, the choices,
// and the button. The editor does the import itself (supervisor.jsx runH360).
function SupH360Update({ hasPatients, busy, onRun, onClose, setRoute }) {
  const [o, setO] = useState(() => {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(H3_OPTIONS_KEY)) || {}; } catch (e) { saved = {}; }
    return Object.assign({}, H3_UPDATE_DEFAULTS, saved);
  });
  const [status, setStatus] = useState(null);
  const [more, setMore] = useState(false);
  useEffect(() => { let live = true; h3Api('/api/h360/status').then((s) => { if (live) setStatus(s); }).catch(() => {}); return () => { live = false; }; }, []);
  const set = (key, value) => setO((prev) => Object.assign({}, prev, { [key]: value }));
  const check = (key, label) => <label className="h3-check"><input type="checkbox" checked={!!o[key]} onChange={(e) => set(key, e.target.checked)} /> {label}</label>;
  const run = () => {
    if (o.remarks === 'all' && !confirm('Replace every remark in this report with the newest note from H360? What you typed in Remarks will be lost.')) return;
    if (o.diagnosis === 'all' && !confirm('Replace every diagnosis in this report with the one recorded in H360?')) return;
    try { localStorage.setItem(H3_OPTIONS_KEY, JSON.stringify(o)); } catch (e) {}
    onRun(o);
  };
  const last = status && status.lastRun;
  return (
    <div className="sup-card h3-options"><div className="sup-card-b">
      <div className="h3-sethead">
        <b>{hasPatients ? 'Update this report from H360' : 'Import patients from H360'}</b>
        <span style={{ flex: 1 }} />
        <H3Btn sm onClick={onClose}>Close</H3Btn>
      </div>
      <div className={'sup-alert ' + (last ? 'info' : 'warn')} style={{ marginBottom: 0 }}>
        <span style={{ flex: 1 }}>{!status ? 'Checking the H360 collection…' : last
          ? 'H360 collection: ' + last.total + ' in-patients, collected ' + h3When(last.collectedAt) + '.'
          : 'Nothing has been collected from H360 yet.'}</span>
        <H3Btn sm onClick={() => setRoute({ view: 'supH360' })}>{last ? 'Collect again' : 'Collect patients'}</H3Btn>
      </div>
      <div className="h3-muted">New admissions, critical-area and cabin patients go to their lists with bed, age, consultant, diagnosis and remarks. A patient with a discharge request in H360 goes to Discharged; LAMA and completed discharges follow the IPD Admission list. Surgery, procedures, pressure sore, ventilator and the counts are filled where H360 has them. Nothing you typed is overwritten unless you choose so below.</div>
      <div className="sup-toolbar">
        <H3Btn kind="pri" onClick={run} disabled={busy || !last}>{busy ? 'Importing…' : hasPatients ? 'Update now' : 'Import now'}</H3Btn>
        <H3Btn onClick={() => setMore((v) => !v)}>{more ? 'Hide options' : 'Options'}</H3Btn>
      </div>
      {more && <React.Fragment>
        {check('addNew', 'Add newly admitted patients')}
        {check('updateDetails', 'Update bed, age and consultant of patients already in the report')}
        {check('dischargeRequests', 'Put patients with a discharge request in H360 (the pink rows) in Discharged')}
        {check('register', 'Use the IPD Admission list: move patients it shows as discharged or LAMA to those lists, and add admissions that are on no station list')}
        <div className="sup-fld"><label>Diagnosis</label>
          <select value={o.diagnosis} onChange={(e) => set('diagnosis', e.target.value)}>
            <option value="empty">Fill in only where it is empty</option>
            <option value="all">Replace every diagnosis with the one recorded in H360</option>
            <option value="none">Leave as it is</option>
          </select></div>
        {check('useComplaint', 'When no diagnosis is recorded, use the presenting complaint (written as "C/C: ...")')}
        <div className="sup-fld"><label>Remarks</label>
          <select value={o.remarks} onChange={(e) => set('remarks', e.target.value)}>
            <option value="empty">Fill in only where it is empty</option>
            <option value="all">Replace every remark with the newest note (overwrites what you typed)</option>
            <option value="none">Leave as it is</option>
          </select></div>
        <div className="sup-fld"><label>Take remarks from</label>
          <select value={o.remarksFrom} onChange={(e) => set('remarksFrom', e.target.value)}>
            <option value="nursing">The newest nursing follow-up note</option>
            <option value="progress">The newest doctor progress note</option>
            <option value="both">Both: doctor progress note, then nursing note</option>
            <option value="handover">The doctors' handover: clinical summary and plan</option>
          </select></div>
        {check('sections', 'Fill the other sections H360 can answer: Surgery Details, Interventional Procedure, Pressure Sore, Ventilator Status and the counts in General Information')}
      </React.Fragment>}
    </div></div>
  );
}

// On All Reports: the log sheets written before the two reports became one (and the old
// collector's reports on the hospital PC) are offered once, to become draft reports.
function SupH360Convert({ onDone }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => h3Api('/api/h360/status').then(setStatus).catch(() => {});
  useEffect(() => { load(); }, []);
  const waiting = status ? (status.sheetsWaiting || 0) + (status.legacyReports || 0) : 0;
  if (!waiting || !h3Can('add')) return null;
  const run = async () => {
    setBusy(true);
    try { const r = await h3Api('/api/h360/sheets/convert', { method: 'POST' }); h3Toast(r.converted + ' log sheet(s) are now draft reports.'); await load(); if (onDone) onDone(); }
    catch (e) { h3Toast(e.message, 'error'); }
    setBusy(false);
  };
  return <div className="sup-alert info"><span style={{ flex: 1 }}>{waiting} H360 log sheet(s) were written before the log sheet became part of the report. Bring them in as draft reports to keep working on them here.</span><H3Btn sm kind="pri" onClick={run} disabled={busy}>{busy ? 'Bringing in…' : 'Bring them in'}</H3Btn></div>;
}

// The H360 half of the module on the Supervisor Dashboard: how fresh the collection is, and the way in.
function SupH360Card({ setRoute }) {
  const [status, setStatus] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { let live = true; h3Api('/api/h360/status').then((s) => { if (live) setStatus(s); }).catch(() => { if (live) setFailed(true); }); return () => { live = false; }; }, []);
  const run = status && status.lastRun;
  const line = failed ? 'H360 status is not available right now'
    : !status ? 'Checking…'
    : status.running ? 'A collection is running now'
    : run ? run.total + ' in-patients · collected ' + h3When(run.collectedAt) + (run.site ? ' from ' + (H3_SITE[run.site] || run.site) : '')
    : status.hasLogin ? 'Nothing collected yet' : 'The H360 login has not been entered yet';
  return (
    <div className="sup-hubcard">
      <div className="sup-hub-t"><Ic d={I.pulse || I.doc} s={16} />H360</div>
      <div className="sup-hub-s">{line}</div>
      <div className="h3-muted">Patients read from H360. A new report imports them with one click.</div>
      <div className="sup-hub-row">
        <H3Btn sm kind="pri" onClick={() => setRoute({ view: 'supH360' })}>{run || (status && status.running) ? 'H360 Patients' : 'Collect patients'}</H3Btn>
        {run && h3Can('add') && <H3Btn sm onClick={() => setRoute({ view: 'supNew', h360: true })}><Ic d={I.plus} s={14} />New report from H360</H3Btn>}
      </div>
    </div>
  );
}

function SupH360View({ setRoute }) {
  return <H3Patients setRoute={setRoute} />;
}

/* ---------------- styles ---------------- */
const H3_CSS = `
.h3-muted{color:var(--muted,#64748b);font-size:12.5px;line-height:1.55}
.sup-hero-r a.sup-btn{background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.28);color:#fff;text-decoration:none}
a.sup-btn{text-decoration:none}
.sup-alert .sup-btn{flex:0 0 auto}
.h3-log{margin:0;padding:10px 14px;list-style:none;max-height:190px;overflow:auto;font-family:Consolas,ui-monospace,monospace;font-size:12.5px;color:#475569;white-space:pre-wrap}
.h3-live.on{border-color:#93c5fd;box-shadow:0 0 0 3px rgba(37,99,235,.12)}
.h3-live.fail{border-color:#fecaca}
.h3-livehead{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:13.5px;color:#0f172a}
.h3-livenum{font-size:12.5px;color:var(--muted,#64748b);margin-left:8px}
.h3-livenum b{font-size:17px;color:#1d4ed8}
.h3-pulse{width:10px;height:10px;border-radius:50%;background:#16a34a;box-shadow:0 0 0 0 rgba(22,163,74,.6);animation:h3Pulse 1.3s infinite}
@keyframes h3Pulse{70%{box-shadow:0 0 0 9px rgba(22,163,74,0)}100%{box-shadow:0 0 0 0 rgba(22,163,74,0)}}
.h3-steps{display:flex;gap:6px;flex-wrap:wrap;margin:11px 0 9px}
.h3-step{font-size:11.5px;font-weight:700;padding:4px 11px;border-radius:999px;background:#f1f5f9;color:#94a3b8}
.h3-step.done{background:#dcfce7;color:#15803d}
.h3-step.now{background:#2563eb;color:#fff}
.h3-step.fail{background:#fee2e2;color:#b91c1c}
.h3-bar{height:9px;border-radius:999px;background:#e8eef5;overflow:hidden}
.h3-bar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#2563eb,#27a8db);transition:width .5s ease}
.h3-bar.sm{height:6px;flex:1}
.h3-stbars{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:7px 22px;margin-top:12px}
.h3-stbar{display:flex;align-items:center;gap:9px;font-size:11.5px;color:#475569}
.h3-stbar span{flex:0 0 46%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.h3-stbar em{font-style:normal;font-weight:700;min-width:38px;text-align:right;color:#0f172a}
.h3-tiles{display:flex;gap:10px;flex-wrap:wrap}
.h3-tile{background:var(--panel,#fff);border:1px solid var(--line,#e5e7eb);border-radius:12px;padding:10px 14px;min-width:118px;cursor:pointer;text-align:left;font:inherit;color:var(--ink,#111827)}
.h3-tile.on{border-color:#2563eb;box-shadow:inset 0 0 0 1px #2563eb}
.h3-tile.req{background:#fff1f2;border-color:#fecdd3}
.h3-tile.req b{color:#be123c}
.h3-tile.req.on{border-color:#e11d48;box-shadow:inset 0 0 0 1px #e11d48}
.h3-table tr.req td{background:#ffe4e6}
.h3-table tr.vit td{background:#f0fdf4}
.h3-tile.ok{background:#f0fdf4;border-color:#bbf7d0}
.h3-tile.ok b{color:#15803d}
div.h3-tile{cursor:default}
.h3-table tbody tr.req:hover td{background:#fecdd3}
.h3-tile b{display:block;font-size:22px;color:#1d4ed8;line-height:1.15}
.h3-tile span{color:var(--muted,#64748b);font-size:11.5px}
.h3-search{font:inherit;padding:8px 11px;border:1px solid var(--line,#d1d5db);border-radius:9px;min-width:260px;background:#fff}
.h3-tablewrap{overflow:auto;max-height:68vh;border-radius:12px}
.h3-table{border-collapse:collapse;width:100%;font-size:12.5px}
.h3-table th,.h3-table td{padding:8px 10px;border-bottom:1px solid var(--line,#e8edf3);text-align:left;white-space:nowrap}
.h3-table th{position:sticky;top:0;background:#eef4fb;font-weight:700;color:#334155;z-index:1}
.h3-table tr.open{cursor:pointer}
.h3-table tbody tr:hover td{background:#f5f9ff}
.h3-table td.tools{text-align:right}
.h3-sethead{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.h3-setgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:22px}
.h3-settitle{font-weight:800;font-size:13.5px;margin-bottom:3px;color:#0f172a}
.h3-loginrow{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-top:10px}
.h3-radio{display:flex;gap:9px;align-items:flex-start;margin:10px 0;font-size:12.5px;line-height:1.45;cursor:pointer}
.h3-radio input{margin-top:3px}
.h3-drawer-bg{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:9998}
.h3-drawer{position:absolute;top:0;right:0;bottom:0;width:min(900px,96vw);background:#f3f6f9;box-shadow:-8px 0 24px rgba(0,0,0,.18);display:flex;flex-direction:column}
.h3-drawer-h{display:flex;align-items:center;gap:12px;padding:13px 18px;color:#fff;background:linear-gradient(120deg,#0d1b2e,#0072a3)}
.h3-drawer-h b{font-size:16px;display:block}
.h3-drawer-h small{display:block;opacity:.88;font-size:12px;margin-top:2px}
.h3-drawer-b{padding:14px 18px 40px;overflow:auto;flex:1}
.h3-drawer-b h4{font-size:13.5px;margin:18px 0 8px;color:#0b6475}
.h3-pairs{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:6px 18px;background:#fff;border:1px solid var(--line,#e5e7eb);border-radius:10px;padding:12px 14px;font-size:12.5px}
.h3-pairs div{overflow-wrap:anywhere}
.h3-pairs span{color:var(--muted,#64748b);font-size:11.5px;display:block}
.h3-rec{background:#fff;border:1px solid var(--line,#e5e7eb);border-radius:10px;margin-bottom:6px}
.h3-rec summary{padding:9px 14px;cursor:pointer;font-weight:700;font-size:13px}
.h3-rec summary small{font-weight:400;color:var(--muted,#64748b);margin-left:8px}
.h3-rec-b{padding:0 14px 12px}
.h3-rec-b h5{margin:12px 0 6px;font-size:12.5px}
.h3-rec-b .h3-pairs{border:0;padding:0}
.h3-scroll{overflow:auto;max-height:420px;border:1px solid var(--line,#e5e7eb);border-radius:8px;margin:8px 0}
.h3-rtbl{border-collapse:collapse;width:100%;font-size:12.5px}
.h3-rtbl th,.h3-rtbl td{padding:5px 8px;border-bottom:1px solid var(--line,#eef2f7);text-align:left;min-width:70px;vertical-align:top}
.h3-rtbl th{background:#f1f5f9;position:sticky;top:0}
.h3-options .sup-card-b{display:grid;gap:10px;max-width:780px}
.h3-options select{max-width:540px}
.h3-check{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;line-height:1.45;cursor:pointer}
.h3-check input{margin-top:2px}
`;
(function injectH3Css() { try { if (typeof document === 'undefined' || document.getElementById('h3-css')) return; const st = document.createElement('style'); st.id = 'h3-css'; st.textContent = H3_CSS; document.head.appendChild(st); } catch (e) {} })();

Object.assign(window, { SupH360View, SupH360Card, SupH360Update, SupH360Convert });
