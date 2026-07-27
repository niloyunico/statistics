/* UNICO — Shift Supervisor Reports module (renderer).
   Digitises the hand-filled "Log Sheet For Night Supervisor" into a structured,
   multi-section report for any of the 3 shifts (Morning / Evening / Night).

   Views (rendered one at a time inside the global shell, like QualityView):
     supHome    — analytics dashboard + alerts + quick "start new report"
     supNew     — the big structured editor (autosave, carry-forward, UHID autofill)
     supHistory — calendar + searchable list (open / edit / duplicate / export / status)
     supReport  — one-click report builder → live preview + PDF/print export

   Data: server/supervisor-reports.js  (collection `supervisorReports`, /api/supervisor-reports).
   Departments: window.DEPTMAP (canonical Statistics dept list) so census/dropdowns stay in sync.
   Export: reuses #pdf-root + print CSS + window.unicoHtmlServerPDF + window.unicoSig letterhead. */

const { useState, useEffect, useMemo, useRef } = React;
const Ic = window.Ic, I = window.I;

/* ---------------- helpers ---------------- */
const supNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const supToast = (m, t) => { try { window.UI && window.UI.toast && window.UI.toast(m, t || 'success'); } catch (e) {} };
const supApi = {
  get: (u) => fetch(u, { headers: { accept: 'application/json' } }).then((r) => r.json()),
  post: (u, b) => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b || {}) }).then((r) => r.json()),
  del: (u) => fetch(u, { method: 'DELETE' }).then((r) => r.json()),
};
const SUP_SHIFTS = ['Morning', 'Evening', 'Night'];
function supTodayISO() { try { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); } catch (e) { return ''; } }
function supCurrentShift() { try { const h = new Date().getHours(); if (h >= 6 && h < 14) return 'Morning'; if (h >= 14 && h < 21) return 'Evening'; return 'Night'; } catch (e) { return 'Night'; } }
function supIsAdmin() { try { const u = window.__UNICO_USER__; return !u || u.role === 'Administrator'; } catch (e) { return true; } }
function supDeptNames(depts) {
  try { const m = window.DEPTMAP; if (m && m.patientDeptIds) { const ids = m.patientDeptIds(); if (ids && ids.length) return ids.map((id) => m.nameFromId(id)); } } catch (e) {}
  return (depts || []).map((d) => d.name).filter(Boolean);
}

/* ---------------- section schema ---------------- */
const C = {
  dept: { id: 'dept', label: 'Department', type: 'select', w: 120 },
  bed: { id: 'bed', label: 'Bed', w: 70 },
  name: { id: 'name', label: 'Name of Patient', w: 130 },
  age: { id: 'age', label: 'Age', w: 70 },
  uhid: { id: 'uhid', label: 'UHID', w: 90, lookup: true },
  consultant: { id: 'consultant', label: 'Consultant', w: 120 },
  diagnosis: { id: 'diagnosis', label: 'Diagnosis', type: 'area', w: 150 },
  doa: { id: 'doa', label: 'DOA', w: 90 },
};
const SUP_SECTIONS = [
  { key: 'newAdmissions', title: 'New Admission', sn: true, cols: [C.dept, C.bed, C.name, C.age, C.uhid, C.consultant, C.diagnosis, C.doa, { id: 'remarks', label: 'Remarks', type: 'area', w: 200 }] },
  { key: 'criticalArea', title: 'Patient in Critical Areas', sn: true, cols: [C.dept, C.bed, C.name, C.age, C.uhid, C.consultant, C.diagnosis, C.doa, { id: 'remarks', label: 'Remarks', type: 'area', w: 200 }] },
  { key: 'lama', title: 'LAMA / DAMA', sn: true, cols: [C.dept, C.name, C.age, C.uhid, C.consultant, C.diagnosis, C.doa, { id: 'reasonDama', label: 'Reason for DAMA', type: 'area', w: 150 }, { id: 'billing', label: 'Billing Clearance', w: 90 }] },
  { key: 'discharged', title: 'Discharged', sn: true, cols: [C.dept, C.name, C.age, C.uhid, C.consultant, C.diagnosis, C.doa, { id: 'billing', label: 'Billing Clearance', w: 90 }] },
  { key: 'otTable', title: 'OT (Operation Theatre)', sn: true, cols: [{ id: 'ot', label: 'OT', w: 90 }, { id: 'planned', label: 'Planned Cases', type: 'num' }, { id: 'added', label: 'Added / Emergency', type: 'num' }, { id: 'cancelledReason', label: 'Reason of Cancelled', type: 'area', w: 150 }, { id: 'total', label: 'Total Cases', type: 'num' }, { id: 'billing', label: 'Billing Status', w: 100 }] },
  { key: 'surgeries', title: 'Surgery Details', sn: true, cols: [{ id: 'name', label: 'Name of Patient', w: 120 }, { id: 'surgery', label: 'Name of Surgery', w: 130 }, { id: 'surgeon', label: 'Surgeon', w: 120 }, { id: 'anaesthetist', label: 'Anesthesiologist', w: 120 }, { id: 'anaesthesia', label: 'Type of Anesthesia', w: 90 }, { id: 'note', label: 'Special Note', type: 'area', w: 140 }] },
  { key: 'interventional', title: 'Interventional Procedure (Cath Lab, Endoscopy, Dialysis etc.)', sn: true, cols: [C.dept, C.name, C.age, C.uhid, C.consultant, { id: 'procedure', label: 'Name of Procedure', w: 130 }, { id: 'bed', label: 'Bed No', w: 70 }, { id: 'remarks', label: 'Remarks', type: 'area', w: 150 }] },
  { key: 'radiological', title: 'Radiological Interventional Procedure', sn: true, cols: [C.dept, C.name, C.age, C.uhid, { id: 'procedure', label: 'Name of Procedure', w: 130 }, { id: 'bed', label: 'Bed No', w: 70 }] },
  { key: 'ventilators', title: 'Ventilator Status', sn: false, cols: [{ id: 'type', label: 'Type of Ventilation', w: 150 }, { id: 'adult', label: 'Adult', type: 'num' }, { id: 'ped', label: 'Pediatric', type: 'num' }, { id: 'total', label: 'Total', type: 'num' }, C.dept, { id: 'inUse', label: 'In Use', type: 'num' }, { id: 'standby', label: 'Stand By', type: 'num' }, { id: 'remarks', label: 'Remarks', w: 120 }] },
  { key: 'pressureSore', title: 'Patients with Pressure Sore', sn: true, cols: [C.name, C.age, { id: 'bed', label: 'Bed No', w: 90 }, C.diagnosis, C.consultant, { id: 'stage', label: 'Stage of Ulceration', w: 110 }, { id: 'remarks', label: 'Remarks', type: 'area', w: 150 }] },
  { key: 'phlebitis', title: 'Patients with Phlebitis', sn: true, cols: [C.name, C.age, { id: 'bed', label: 'Bed No', w: 90 }, C.diagnosis, C.consultant, { id: 'vipScore', label: 'VIP Score', w: 80 }, { id: 'remarks', label: 'Remarks', type: 'area', w: 150 }] },
];
const SUP_SEC_BY_KEY = SUP_SECTIONS.reduce((m, s) => (m[s.key] = s, m), {});

const RADIOLOGY_FIELDS = [['xray', 'X-ray', 'num'], ['usg', 'USG', 'num'], ['ct', 'CT-Scan', 'num'], ['mri', 'MRI', 'num'], ['bmd', 'BMD', 'num'], ['mammogram', 'Mammogram', 'num'], ['ecg', 'ECG', 'num'], ['echo', 'Echo', 'num'], ['uroflow', 'Uroflometry', 'num']];
const ER_FIELDS = [['total', 'Total Patient', 'num'], ['admission', 'Admission', 'num'], ['discharged', 'Discharged', 'num'], ['lama', 'LAMA', 'num'], ['daycare', 'Daycare', 'num'], ['bid', 'BID', 'num'], ['present', 'Present Patient', 'num'], ['refused', 'Refused', 'num'], ['death', 'Death', 'num']];
const GENERAL_FIELDS = [
  ['pickUp', 'Pick Up', 'text'], ['drop', 'Drop', 'text'],
  ['nvd', 'Birth — NVD', 'num'], ['cs', 'Birth — CS', 'num'],
  ['death', 'Death', 'num'], ['broughtDead', 'Brought Dead', 'num'], ['codeBlue', 'Code Blue', 'num'],
  ['patientComplaint', 'Patient Complaint', 'num'], ['medError', 'Med. Error', 'num'], ['doctorComplaint', "Doctors' complaint", 'num'],
  ['nearMiss', 'Near Miss & Incident', 'num'], ['hoToError', 'H/O & T/O Error', 'num'], ['sampleError', 'Sample Error', 'num'],
  ['patientFall', 'No. of Patient Fall', 'num'], ['bloodTransfusion', 'Blood Transfusion (Bed No)', 'text'], ['adr', 'ADR', 'num'],
  ['plannedDischarge', 'Planned Discharges', 'num'], ['vipAdmitted', 'VIP Admitted', 'text'], ['vipVisits', 'VIP Visits', 'text'], ['employeeAdmitted', 'Hospital Employee Admitted', 'text'],
];
// General fields that raise a critical/warning alert when > 0.
const ALERT_FIELDS = [['codeBlue', 'Code Blue', 'critical'], ['death', 'Death', 'critical'], ['broughtDead', 'Brought Dead', 'critical'], ['patientFall', 'Patient Fall', 'critical'], ['medError', 'Medication Error', 'critical'], ['nearMiss', 'Near Miss / Incident', 'warn'], ['sampleError', 'Sample Error', 'warn'], ['hoToError', 'H/O & T/O Error', 'warn'], ['patientComplaint', 'Patient Complaint', 'warn'], ['adr', 'ADR', 'warn']];

/* ---------------- computed helpers ---------------- */
function supComputeTotals(r) {
  const g = r.general || {}, er = r.erCensus || {};
  const death = supNum(g.death) || supNum(er.death);
  return { newAdmission: (r.newAdmissions || []).length, discharge: (r.discharged || []).length, death };
}
function supComputeCensusTotal(census, deptNames) {
  let t = supNum((census || {})['OPD Total']);
  (deptNames || []).forEach((n) => { t += supNum((census || {})[n]); });
  return t;
}
function supComputeAlerts(r) {
  const out = [];
  const g = r.general || {};
  ALERT_FIELDS.forEach(([k, label, level]) => { const n = supNum(g[k]); if (n > 0) out.push({ level, text: label + ': ' + n }); });
  if ((r.pressureSore || []).length) out.push({ level: 'warn', text: (r.pressureSore.length) + ' patient(s) with pressure sore' });
  if ((r.phlebitis || []).length) out.push({ level: 'warn', text: (r.phlebitis.length) + ' patient(s) with phlebitis' });
  return out;
}
// Populate the sidebar badge global from a set of recent reports (today's critical
// events + any shift missing a report for today).
function supRefreshAlertBadge(reports) {
  try {
    const today = supTodayISO();
    const todays = (reports || []).filter((r) => r.date === today);
    let n = 0;
    todays.forEach((r) => { n += supComputeAlerts(r).filter((a) => a.level === 'critical').length; });
    SUP_SHIFTS.forEach((sh) => { if (!todays.some((r) => r.shift === sh)) n += 1; });
    window.__UNICO_SUP_ALERTS__ = n;
    try { window.dispatchEvent(new CustomEvent('unico:sup-alerts', { detail: n })); } catch (e) {}
  } catch (e) {}
}

/* ---------------- shared UI bits ---------------- */
function SupBtn({ kind, sm, onClick, children, title, disabled }) {
  return <button className={'sup-btn' + (kind ? ' ' + kind : '') + (sm ? ' sm' : '')} onClick={onClick} title={title || ''} disabled={disabled}>{children}</button>;
}
function StatusBadge({ status }) { return <span className={'sup-status ' + (status || 'draft')}>{status || 'draft'}</span>; }

function RowsEditor({ section, rows, deptNames, readOnly, onChange, onLookup }) {
  rows = rows || [];
  const cols = section.cols;
  const set = (i, k, v) => onChange(rows.map((r, x) => (x === i ? { ...r, [k]: v } : r)));
  const add = () => onChange([...rows, {}]);
  const dup = (i) => { const c = rows.slice(); c.splice(i + 1, 0, { ...rows[i] }); onChange(c); };
  const del = (i) => onChange(rows.filter((_, x) => x !== i));
  const doLookup = async (i, uhid) => {
    if (!onLookup || !String(uhid || '').trim()) return;
    const p = await onLookup(uhid);
    if (!p) return;
    onChange(rows.map((r, x) => {
      if (x !== i) return r;
      const nr = { ...r };
      ['name', 'age', 'consultant', 'diagnosis', 'dept'].forEach((k) => { if (p[k] && !String(nr[k] || '').trim()) nr[k] = p[k]; });
      return nr;
    }));
    supToast('Autofilled from a previous entry', 'success');
  };
  const span = cols.length + (section.sn ? 1 : 0) + (readOnly ? 0 : 1);
  return (
    <div className="sup-tblwrap">
      <table className="sup-tbl">
        <thead><tr>{section.sn && <th style={{ width: 38 }}>#</th>}{cols.map((c) => <th key={c.id} style={c.w ? { minWidth: c.w } : null}>{c.label}</th>)}{!readOnly && <th style={{ width: 68 }}></th>}</tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td data-label="" colSpan={span} style={{ color: '#94a3b8', textAlign: 'center', padding: 10 }}>No entries yet.</td></tr>}
          {rows.map((row, i) => (
            <tr key={i}>
              {section.sn && <td data-label="#">{i + 1}</td>}
              {cols.map((c) => (
                <td key={c.id} data-label={c.label}>
                  {readOnly ? <span>{row[c.id] || ''}</span>
                    : c.type === 'select' ? (
                      <select value={row[c.id] || ''} onChange={(e) => set(i, c.id, e.target.value)}>
                        <option value=""></option>
                        {deptNames.concat(row[c.id] && deptNames.indexOf(row[c.id]) < 0 ? [row[c.id]] : []).map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    ) : c.type === 'area' ? (
                      <textarea rows={2} value={row[c.id] || ''} onChange={(e) => set(i, c.id, e.target.value)} />
                    ) : (
                      <input type={c.type === 'num' ? 'number' : 'text'} value={row[c.id] || ''}
                        onChange={(e) => set(i, c.id, e.target.value)}
                        onBlur={c.lookup ? () => doLookup(i, row[c.id]) : undefined} />
                    )}
                </td>
              ))}
              {!readOnly && <td data-label="" style={{ whiteSpace: 'nowrap' }}>
                <button className="sup-btn sm" title="Duplicate row" onClick={() => dup(i)}>⧉</button>{' '}
                <button className="sup-rowdel" title="Remove row" onClick={() => del(i)}>✕</button>
              </td>}
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly && <div style={{ marginTop: 8 }}><SupBtn sm onClick={add}>+ Add row</SupBtn></div>}
    </div>
  );
}

function ScalarFields({ fields, val, onChange, readOnly }) {
  val = val || {};
  return <div className="sup-scalar">{fields.map((f) => { const id = f[0], label = f[1], type = f[2]; return (
    <div className="sup-fld" key={id}><label>{label}</label>
      {readOnly ? <div style={{ fontWeight: 600 }}>{val[id] || '—'}</div>
        : <input type={type === 'num' ? 'number' : 'text'} value={val[id] || ''} onChange={(e) => onChange({ ...val, [id]: e.target.value })} />}
    </div>); })}</div>;
}

function CensusFields({ deptNames, val, onChange, readOnly }) {
  val = val || {};
  const total = supComputeCensusTotal(val, deptNames);
  const setK = (k, v) => onChange({ ...val, [k]: v });
  return (
    <div>
      <div style={{ fontSize: 11.5, color: 'var(--muted,#64748b)', marginBottom: 8 }}>Department-wise patient census (departments pulled from Statistics).</div>
      <div className="sup-scalar">
        <div className="sup-fld"><label>OPD Total</label><input type="number" value={val['OPD Total'] || ''} onChange={(e) => setK('OPD Total', e.target.value)} disabled={readOnly} /></div>
        {deptNames.map((n) => <div className="sup-fld" key={n}><label>{n}</label><input type="number" value={val[n] || ''} onChange={(e) => setK(n, e.target.value)} disabled={readOnly} /></div>)}
      </div>
      <div style={{ marginTop: 10, fontWeight: 800, fontSize: 13 }}>TOTAL: {total}</div>
    </div>
  );
}

function SecCard({ title, count, children, open, onToggle, anchor }) {
  return (
    <div className="sup-card" id={anchor}>
      <div className="sup-card-h" onClick={onToggle}>
        <Ic d={I.chevR} s={15} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: '.15s', flex: '0 0 auto' }} />
        <h4>{title}</h4>
        {count != null && <span className="sup-count">{count}</span>}
      </div>
      {open && <div className="sup-card-b">{children}</div>}
    </div>
  );
}

function MiniBars({ data, height }) {
  height = height || 90;
  const max = Math.max(1, ...data.map((d) => d.v));
  const bw = 100 / Math.max(1, data.length);
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: '100%', height }}>
      {data.map((d, i) => { const h = (d.v / max) * 36; return <rect key={i} x={i * bw + bw * 0.15} y={40 - h} width={bw * 0.7} height={h} rx="0.6" fill="#2563eb" />; })}
    </svg>
  );
}

/* ================================================================= EDITOR */
function blankReport(shift) {
  return {
    date: supTodayISO(), shift: shift || supCurrentShift(), shiftTime: '', supervisorName: '', status: 'draft',
    newAdmissions: [], criticalArea: [], lama: [], discharged: [], otTable: [], surgeries: [], interventional: [], radiological: [],
    radiologyCounts: {}, ventilators: [], erCensus: {}, general: {}, pressureSore: [], phlebitis: [],
    absenteeism: '', sickLeave: '', roundObservation: '', census: {}, totals: {},
    sign: window.unicoSig ? window.unicoSig.load() : { prepared: '', reviewed: '', recommended: '', approved: '' },
  };
}

function SupEditor({ id, shift, depts, setRoute }) {
  const deptNames = useMemo(() => supDeptNames(depts), [depts]);
  const [rep, setRep] = useState(() => blankReport(shift));
  const [loading, setLoading] = useState(!!id);
  const [saved, setSaved] = useState('');
  const dirty = useRef(false);
  const timer = useRef(null);
  const [open, setOpen] = useState({ newAdmissions: true });
  const admin = supIsAdmin();
  const readOnly = rep.status === 'approved' && !admin;

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    supApi.get('/api/supervisor-reports/' + encodeURIComponent(id)).then((j) => {
      if (j.ok && j.report) setRep({ ...blankReport(), ...j.report });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const edit = (patch) => { dirty.current = true; setRep((r) => ({ ...r, ...patch })); };
  const editSec = (key, val) => edit({ [key]: val });

  // Autosave (debounced) once the required identity fields exist.
  useEffect(() => {
    if (!dirty.current || readOnly) return;
    if (!(rep.date && String(rep.supervisorName || '').trim())) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSaved('Saving…');
      const payload = { ...rep, totals: supComputeTotals(rep), census: { ...rep.census, TOTAL: supComputeCensusTotal(rep.census, deptNames) } };
      try {
        const j = await supApi.post('/api/supervisor-reports', payload);
        if (j.ok) { dirty.current = false; setSaved('Saved'); if (!rep.id && j.report && j.report.id) setRep((r) => ({ ...r, id: j.report.id })); }
        else setSaved('Save failed');
      } catch (e) { setSaved('Save failed'); }
    }, 1100);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [rep, readOnly, deptNames]);

  const lookupUhid = async (uhid) => {
    try { const j = await supApi.get('/api/supervisor-reports/lookup?uhid=' + encodeURIComponent(uhid)); return (j.ok && j.patient) ? j.patient : null; } catch (e) { return null; }
  };

  const importPrevious = async () => {
    try {
      const j = await supApi.get('/api/supervisor-reports/previous?date=' + encodeURIComponent(rep.date) + '&shift=' + encodeURIComponent(rep.shift));
      if (!j.ok || !j.report) { supToast('No previous shift report found to carry forward.', 'info'); return; }
      const p = j.report;
      edit({
        criticalArea: [...(rep.criticalArea || []), ...(p.criticalArea || [])],
        pressureSore: [...(rep.pressureSore || []), ...(p.pressureSore || [])],
        phlebitis: [...(rep.phlebitis || []), ...(p.phlebitis || [])],
      });
      setOpen((o) => ({ ...o, criticalArea: true, pressureSore: true, phlebitis: true }));
      supToast('Carried forward critical patients & registers from ' + p.date + ' ' + p.shift, 'success');
    } catch (e) { supToast('Carry-forward failed.', 'error'); }
  };

  const setStatus = async (status) => {
    if (!rep.id) { supToast('Save the report first.', 'info'); return; }
    try {
      const j = await supApi.post('/api/supervisor-reports/' + rep.id + '/status', { status });
      if (j.ok) { setRep((r) => ({ ...r, status })); supToast('Report ' + status + '.', 'success'); }
    } catch (e) { supToast('Could not update status.', 'error'); }
  };

  const saveSig = (sig) => { if (window.unicoSig) window.unicoSig.save(sig); edit({ sign: sig }); };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted,#64748b)' }}>Loading report…</div>;

  const totals = supComputeTotals(rep);
  const alerts = supComputeAlerts(rep);
  const jump = SUP_SECTIONS.map((s) => ({ key: s.key, title: s.title }));

  const go = (anchor) => { const el = document.getElementById('sup-sec-' + anchor); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); setOpen((o) => ({ ...o, [anchor]: true })); };

  return (
    <div className="sup-wrap">
      {/* toolbar */}
      <div className="sup-toolbar">
        <SupBtn sm onClick={() => setRoute({ view: 'supHistory' })}><Ic d={I.chevR} s={14} style={{ transform: 'rotate(180deg)' }} />Back</SupBtn>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{id ? 'Edit' : 'New'} Supervisor Report</div>
        <StatusBadge status={rep.status} />
        <span style={{ fontSize: 12, color: 'var(--muted,#64748b)' }}>{saved}</span>
        <span style={{ flex: 1 }} />
        {!id ? null : <SupBtn sm onClick={() => setRoute({ view: 'supReport', id: rep.id })}><Ic d={I.print} s={14} />Generate / Export</SupBtn>}
        {!readOnly && rep.status === 'draft' && <SupBtn sm kind="pri" onClick={() => setStatus('submitted')}><Ic d={I.check} s={14} />Submit</SupBtn>}
        {admin && rep.status === 'submitted' && <SupBtn sm kind="pri" onClick={() => setStatus('approved')}><Ic d={I.check} s={14} />Approve</SupBtn>}
        {admin && rep.status === 'approved' && <SupBtn sm onClick={() => setStatus('draft')}><Ic d={I.edit} s={14} />Reopen</SupBtn>}
      </div>

      {readOnly && <div className="sup-alert info"><Ic d={I.check} s={15} />This report is approved and locked. An administrator can reopen it for edits.</div>}
      {alerts.length > 0 && <div>{alerts.map((a, i) => <div key={i} className={'sup-alert ' + a.level}><Ic d={I.bell} s={15} />{a.text}</div>)}</div>}

      {/* header identity */}
      <div className="sup-card"><div className="sup-card-b">
        <div className="sup-scalar">
          <div className="sup-fld"><label>Date</label><input type="date" value={rep.date} onChange={(e) => edit({ date: e.target.value })} disabled={readOnly} /></div>
          <div className="sup-fld"><label>Shift</label><select value={rep.shift} onChange={(e) => edit({ shift: e.target.value })} disabled={readOnly}>{SUP_SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          <div className="sup-fld"><label>Shift Time</label><input value={rep.shiftTime} placeholder="e.g. 8:00 PM TO 8:00 AM" onChange={(e) => edit({ shiftTime: e.target.value })} disabled={readOnly} /></div>
          <div className="sup-fld"><label>Name of Nursing Supervisor</label><input value={rep.supervisorName} onChange={(e) => edit({ supervisorName: e.target.value })} disabled={readOnly} /></div>
        </div>
        {!readOnly && !id && <div style={{ marginTop: 10 }}><SupBtn sm onClick={importPrevious}><Ic d={I.download} s={14} />Carry forward from previous shift</SupBtn></div>}
      </div></div>

      {/* jump nav */}
      <div className="sup-jump">{jump.map((j) => <a key={j.key} onClick={() => go(j.key)}>{j.title}</a>)}</div>

      {/* KPI row */}
      <div className="sup-kpis">
        <div className="sup-kpi"><div className="n">{totals.newAdmission}</div><div className="l">New Admissions</div></div>
        <div className="sup-kpi"><div className="n">{totals.discharge}</div><div className="l">Discharged</div></div>
        <div className="sup-kpi"><div className="n">{(rep.criticalArea || []).length}</div><div className="l">Critical-area patients</div></div>
        <div className="sup-kpi"><div className="n">{totals.death}</div><div className="l">Deaths</div></div>
      </div>

      {/* row sections */}
      {SUP_SECTIONS.map((s) => (
        <SecCard key={s.key} anchor={'sup-sec-' + s.key} title={s.title} count={(rep[s.key] || []).length}
          open={!!open[s.key]} onToggle={() => setOpen((o) => ({ ...o, [s.key]: !o[s.key] }))}>
          <RowsEditor section={s} rows={rep[s.key]} deptNames={deptNames} readOnly={readOnly}
            onChange={(v) => editSec(s.key, v)} onLookup={lookupUhid} />
        </SecCard>
      ))}

      {/* scalar sections */}
      <SecCard anchor="sup-sec-radiologyCounts" title="Radiology Counts" open={!!open.radiologyCounts} onToggle={() => setOpen((o) => ({ ...o, radiologyCounts: !o.radiologyCounts }))}>
        <ScalarFields fields={RADIOLOGY_FIELDS} val={rep.radiologyCounts} onChange={(v) => editSec('radiologyCounts', v)} readOnly={readOnly} />
      </SecCard>
      <SecCard anchor="sup-sec-erCensus" title="ER Census" open={!!open.erCensus} onToggle={() => setOpen((o) => ({ ...o, erCensus: !o.erCensus }))}>
        <ScalarFields fields={ER_FIELDS} val={rep.erCensus} onChange={(v) => editSec('erCensus', v)} readOnly={readOnly} />
      </SecCard>
      <SecCard anchor="sup-sec-general" title="General Information" open={!!open.general} onToggle={() => setOpen((o) => ({ ...o, general: !o.general }))}>
        <ScalarFields fields={GENERAL_FIELDS} val={rep.general} onChange={(v) => editSec('general', v)} readOnly={readOnly} />
      </SecCard>
      <SecCard anchor="sup-sec-census" title="Department-wise Census" open={!!open.census} onToggle={() => setOpen((o) => ({ ...o, census: !o.census }))}>
        <CensusFields deptNames={deptNames} val={rep.census} onChange={(v) => editSec('census', v)} readOnly={readOnly} />
      </SecCard>

      {/* notes */}
      <SecCard anchor="sup-sec-notes" title="Absenteeism · Sick Leave · Round Observation" open={!!open.notes} onToggle={() => setOpen((o) => ({ ...o, notes: !o.notes }))}>
        <div className="sup-fld" style={{ marginBottom: 10 }}><label>Absenteeism</label><textarea rows={2} value={rep.absenteeism} onChange={(e) => edit({ absenteeism: e.target.value })} disabled={readOnly} /></div>
        <div className="sup-fld" style={{ marginBottom: 10 }}><label>Sick Leave</label><textarea rows={2} value={rep.sickLeave} onChange={(e) => edit({ sickLeave: e.target.value })} disabled={readOnly} /></div>
        <div className="sup-fld"><label>Observation During Hospital Round</label><textarea rows={3} value={rep.roundObservation} onChange={(e) => edit({ roundObservation: e.target.value })} disabled={readOnly} /></div>
      </SecCard>

      {/* signatures */}
      <SecCard anchor="sup-sec-sign" title="Authorisation / Sign-off" open={!!open.sign} onToggle={() => setOpen((o) => ({ ...o, sign: !o.sign }))}>
        <div className="sup-scalar">
          {[['prepared', 'Prepared by'], ['reviewed', 'Checked by'], ['recommended', 'Recommended by'], ['approved', 'Approved by']].map(([k, l]) => (
            <div className="sup-fld" key={k}><label>{l}</label><input value={(rep.sign || {})[k] || ''} onChange={(e) => saveSig({ ...(rep.sign || {}), [k]: e.target.value })} disabled={readOnly} /></div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted,#64748b)', marginTop: 8 }}>These names are shared with every UNICO report builder.</div>
      </SecCard>
    </div>
  );
}

/* ================================================================= HISTORY */
function SupHistory({ setRoute }) {
  const [list, setList] = useState(null);
  const [f, setF] = useState({ from: '', to: '', shift: '', status: '', q: '' });
  const [sel, setSel] = useState([]);
  const admin = supIsAdmin();
  const load = () => supApi.get('/api/supervisor-reports?limit=1000').then((j) => { if (j.ok) { setList(j.reports); supRefreshAlertBadge(j.reports); } });
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!list) return [];
    const q = f.q.trim().toLowerCase();
    return list.filter((r) => {
      if (f.from && r.date < f.from) return false;
      if (f.to && r.date > f.to) return false;
      if (f.shift && r.shift !== f.shift) return false;
      if (f.status && r.status !== f.status) return false;
      if (q) {
        const hay = (r.supervisorName || '') + ' ' + r.date + ' ' + r.shift + ' ' +
          ['newAdmissions', 'criticalArea', 'discharged'].map((k) => (r[k] || []).map((x) => (x.name || '') + ' ' + (x.uhid || '')).join(' ')).join(' ');
        if (hay.toLowerCase().indexOf(q) < 0) return false;
      }
      return true;
    });
  }, [list, f]);

  const duplicate = async (r) => {
    const full = await supApi.get('/api/supervisor-reports/' + r.id).then((j) => j.report);
    if (!full) return;
    const copy = { ...full }; delete copy.id; delete copy._id; copy.status = 'draft'; copy.date = supTodayISO(); copy.shift = supCurrentShift();
    const j = await supApi.post('/api/supervisor-reports', copy);
    if (j.ok) { supToast('Duplicated as a new draft.', 'success'); setRoute({ view: 'supNew', id: j.report.id }); }
  };
  const remove = async (r) => { if (!window.confirm('Delete this report permanently?')) return; await supApi.del('/api/supervisor-reports/' + r.id); load(); setSel((s) => s.filter((x) => x !== r.id)); };
  const setStatus = async (r, status) => { await supApi.post('/api/supervisor-reports/' + r.id + '/status', { status }); load(); };
  const toggleSel = (id) => setSel((s) => (s.indexOf(id) >= 0 ? s.filter((x) => x !== id) : s.length < 2 ? [...s, id] : [s[1], id]));

  if (!list) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted,#64748b)' }}>Loading…</div>;

  const cmp = sel.length === 2 ? sel.map((id) => list.find((r) => r.id === id)).filter(Boolean) : [];

  return (
    <div className="sup-wrap">
      <div className="sup-toolbar">
        <div style={{ fontWeight: 800, fontSize: 15 }}>Report History</div>
        <span style={{ flex: 1 }} />
        <SupBtn sm kind="pri" onClick={() => setRoute({ view: 'supNew' })}><Ic d={I.plus} s={15} />New Report</SupBtn>
      </div>

      <div className="sup-card"><div className="sup-card-b">
        <div className="sup-scalar">
          <div className="sup-fld"><label>From</label><input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
          <div className="sup-fld"><label>To</label><input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
          <div className="sup-fld"><label>Shift</label><select value={f.shift} onChange={(e) => setF({ ...f, shift: e.target.value })}><option value="">All</option>{SUP_SHIFTS.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div className="sup-fld"><label>Status</label><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">All</option>{['draft', 'submitted', 'approved'].map((s) => <option key={s}>{s}</option>)}</select></div>
          <div className="sup-fld"><label>Search (name / UHID)</label><input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Search…" /></div>
        </div>
      </div></div>

      {cmp.length === 2 && (
        <div className="sup-card"><div className="sup-card-b">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Compare shifts</div>
          <div className="sup-tblwrap"><table className="sup-tbl" style={{ minWidth: 320 }}>
            <thead><tr><th>Metric</th>{cmp.map((r) => <th key={r.id}>{r.date} · {r.shift}</th>)}</tr></thead>
            <tbody>
              {[['New Admissions', (r) => (r.newAdmissions || []).length], ['Discharged', (r) => (r.discharged || []).length], ['Critical-area', (r) => (r.criticalArea || []).length], ['Deaths', (r) => supComputeTotals(r).death], ['Census TOTAL', (r) => (r.census || {}).TOTAL || '—']].map(([l, fn]) => (
                <tr key={l}><td data-label="Metric">{l}</td>{cmp.map((r) => <td key={r.id} data-label={r.date}>{fn(r)}</td>)}</tr>
              ))}
            </tbody>
          </table></div>
        </div></div>
      )}

      <div className="sup-card"><div className="sup-card-b" style={{ padding: 0 }}>
        <div className="sup-tblwrap"><table className="sup-tbl" style={{ minWidth: 720 }}>
          <thead><tr><th style={{ width: 30 }}></th><th>Date</th><th>Shift</th><th>Supervisor</th><th>Adm.</th><th>Disch.</th><th>Status</th><th style={{ width: 250 }}>Actions</th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={8} data-label="" style={{ textAlign: 'center', padding: 16, color: '#94a3b8' }}>No reports match.</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id}>
                <td data-label="Compare"><input type="checkbox" checked={sel.indexOf(r.id) >= 0} onChange={() => toggleSel(r.id)} title="Select to compare (max 2)" /></td>
                <td data-label="Date">{r.date}</td>
                <td data-label="Shift">{r.shift}</td>
                <td data-label="Supervisor">{r.supervisorName || '—'}</td>
                <td data-label="Adm.">{(r.newAdmissions || []).length}</td>
                <td data-label="Disch.">{(r.discharged || []).length}</td>
                <td data-label="Status"><StatusBadge status={r.status} /></td>
                <td data-label="Actions" style={{ whiteSpace: 'nowrap' }}>
                  <SupBtn sm onClick={() => setRoute({ view: 'supNew', id: r.id })}>Open</SupBtn>{' '}
                  <SupBtn sm onClick={() => setRoute({ view: 'supReport', id: r.id })}><Ic d={I.print} s={13} />Export</SupBtn>{' '}
                  <SupBtn sm onClick={() => duplicate(r)}>Duplicate</SupBtn>{' '}
                  {r.status === 'draft' && <SupBtn sm onClick={() => setStatus(r, 'submitted')}>Submit</SupBtn>}
                  {admin && r.status === 'submitted' && <SupBtn sm onClick={() => setStatus(r, 'approved')}>Approve</SupBtn>}
                  {admin && <SupBtn sm kind="dgr" onClick={() => remove(r)}>Delete</SupBtn>}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div></div>
    </div>
  );
}

/* ================================================================= HOME */
function SupHome({ setRoute }) {
  const [list, setList] = useState(null);
  useEffect(() => { supApi.get('/api/supervisor-reports?limit=90').then((j) => { if (j.ok) { setList(j.reports); supRefreshAlertBadge(j.reports); } }); }, []);
  if (!list) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted,#64748b)' }}>Loading…</div>;

  const today = supTodayISO();
  const last7 = list.filter((r) => r.date >= new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10));
  const sum = (arr, fn) => arr.reduce((s, r) => s + fn(r), 0);
  const kAdm = sum(last7, (r) => (r.newAdmissions || []).length);
  const kDis = sum(last7, (r) => (r.discharged || []).length);
  const kDeath = sum(last7, (r) => supComputeTotals(r).death);
  const kCrit = sum(last7, (r) => (r.criticalArea || []).length);
  const trend = list.slice(0, 14).reverse().map((r) => ({ v: (r.newAdmissions || []).length, label: r.date }));
  const todays = list.filter((r) => r.date === today);
  const missing = SUP_SHIFTS.filter((s) => !todays.some((r) => r.shift === s));
  const critical = [];
  todays.forEach((r) => supComputeAlerts(r).filter((a) => a.level === 'critical').forEach((a) => critical.push(r.shift + ' shift — ' + a.text)));

  return (
    <div className="sup-wrap">
      <div className="sup-toolbar">
        <div style={{ fontWeight: 800, fontSize: 15 }}>Supervisor Dashboard</div>
        <span style={{ flex: 1 }} />
        {SUP_SHIFTS.map((s) => <SupBtn key={s} sm kind={s === supCurrentShift() ? 'pri' : ''} onClick={() => setRoute({ view: 'supNew', shift: s })}><Ic d={I.plus} s={14} />{s}</SupBtn>)}
        <SupBtn sm onClick={() => setRoute({ view: 'supHistory' })}>History</SupBtn>
      </div>

      {(missing.length > 0 || critical.length > 0) && (
        <div>
          {critical.map((c, i) => <div key={'c' + i} className="sup-alert critical"><Ic d={I.bell} s={15} />{c}</div>)}
          {missing.length > 0 && <div className="sup-alert warn"><Ic d={I.bell} s={15} />No report yet today for: {missing.join(', ')} shift{missing.length > 1 ? 's' : ''}.</div>}
        </div>
      )}

      <div className="sup-kpis">
        <div className="sup-kpi"><div className="n">{kAdm}</div><div className="l">Admissions (7 days)</div></div>
        <div className="sup-kpi"><div className="n">{kDis}</div><div className="l">Discharges (7 days)</div></div>
        <div className="sup-kpi"><div className="n">{kCrit}</div><div className="l">Critical-area (7 days)</div></div>
        <div className="sup-kpi"><div className="n">{kDeath}</div><div className="l">Deaths (7 days)</div></div>
      </div>

      <div className="sup-card"><div className="sup-card-b">
        <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>New admissions — last 14 shifts</div>
        {trend.length ? <MiniBars data={trend} /> : <div style={{ color: '#94a3b8', fontSize: 12 }}>No data yet.</div>}
      </div></div>

      <div className="sup-card"><div className="sup-card-b" style={{ padding: 0 }}>
        <div className="sup-tblwrap"><table className="sup-tbl" style={{ minWidth: 560 }}>
          <thead><tr><th>Date</th><th>Shift</th><th>Supervisor</th><th>Adm.</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {list.slice(0, 8).map((r) => (
              <tr key={r.id}>
                <td data-label="Date">{r.date}</td><td data-label="Shift">{r.shift}</td>
                <td data-label="Supervisor">{r.supervisorName || '—'}</td>
                <td data-label="Adm.">{(r.newAdmissions || []).length}</td>
                <td data-label="Status"><StatusBadge status={r.status} /></td>
                <td data-label=""><SupBtn sm onClick={() => setRoute({ view: 'supNew', id: r.id })}>Open</SupBtn></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} data-label="" style={{ textAlign: 'center', padding: 16, color: '#94a3b8' }}>No reports yet — start one above.</td></tr>}
          </tbody>
        </table></div>
      </div></div>
    </div>
  );
}

/* ================================================================= REPORT / EXPORT */
const RPT_SECTIONS = [
  { key: 'newAdmissions', title: 'New Admission', kind: 'rows' },
  { key: 'criticalArea', title: 'Patient in Critical Areas', kind: 'rows' },
  { key: 'lama', title: 'LAMA / DAMA', kind: 'rows' },
  { key: 'discharged', title: 'Discharged', kind: 'rows' },
  { key: 'otTable', title: 'OT', kind: 'rows' },
  { key: 'surgeries', title: 'Surgery Details', kind: 'rows' },
  { key: 'interventional', title: 'Interventional Procedure', kind: 'rows' },
  { key: 'radiological', title: 'Radiological Interventional Procedure', kind: 'rows' },
  { key: 'radiologyCounts', title: 'Radiology Counts', kind: 'counts', fields: RADIOLOGY_FIELDS },
  { key: 'ventilators', title: 'Ventilator Status', kind: 'rows' },
  { key: 'erCensus', title: 'ER Census', kind: 'counts', fields: ER_FIELDS },
  { key: 'general', title: 'General Information', kind: 'counts', fields: GENERAL_FIELDS },
  { key: 'pressureSore', title: 'Patients with Pressure Sore', kind: 'rows' },
  { key: 'phlebitis', title: 'Patients with Phlebitis', kind: 'rows' },
  { key: 'notes', title: 'Absenteeism · Sick Leave · Round Observation', kind: 'notes' },
  { key: 'census', title: 'Department-wise Census', kind: 'census' },
];
const SUP_TEMPLATES = {
  full: { label: 'Full Log Sheet', keys: null },
  summary: { label: 'Summary Only', keys: ['radiologyCounts', 'erCensus', 'general', 'census'] },
  critical: { label: 'Critical + Registers', keys: ['criticalArea', 'pressureSore', 'phlebitis', 'general'] },
};

function RptRows({ section, rows }) {
  rows = rows || [];
  if (!rows.length) return null;
  const cols = SUP_SEC_BY_KEY[section.key].cols;
  const sn = SUP_SEC_BY_KEY[section.key].sn;
  return (
    <table className="sup-rpt-tbl"><thead><tr>{sn && <th>S/N</th>}{cols.map((c) => <th key={c.id}>{c.label}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{sn && <td>{i + 1}</td>}{cols.map((c) => <td key={c.id}>{r[c.id] || ''}</td>)}</tr>)}</tbody></table>
  );
}
function RptCounts({ fields, val }) {
  val = val || {};
  return <table className="sup-rpt-tbl"><tbody>{fields.map((f) => <tr key={f[0]}><th style={{ width: '55%' }}>{f[1]}</th><td>{val[f[0]] || ''}</td></tr>)}</tbody></table>;
}

function SupReportView({ id, depts, setRoute }) {
  const deptNames = useMemo(() => supDeptNames(depts), [depts]);
  const [list, setList] = useState(null);
  const [rep, setRep] = useState(null);
  const [customize, setCustomize] = useState(false);
  const [enabled, setEnabled] = useState(() => RPT_SECTIONS.reduce((m, s) => (m[s.key] = true, m), {}));
  const [exporting, setExporting] = useState(false);
  const pdfRoot = typeof document !== 'undefined' ? document.getElementById('pdf-root') : null;

  useEffect(() => { supApi.get('/api/supervisor-reports?limit=1000').then((j) => { if (j.ok) setList(j.reports); }); }, []);
  useEffect(() => {
    const target = id || (list && list[0] && list[0].id);
    if (!target) return;
    supApi.get('/api/supervisor-reports/' + target).then((j) => { if (j.ok) setRep(j.report); });
  }, [id, list]);

  const applyTemplate = (t) => {
    const keys = SUP_TEMPLATES[t].keys;
    setEnabled(RPT_SECTIONS.reduce((m, s) => (m[s.key] = keys ? keys.indexOf(s.key) >= 0 : true, m), {}));
  };

  const doPrint = () => { try { document.body.classList.add('pdf-export-mode'); setTimeout(() => { window.print(); setTimeout(() => document.body.classList.remove('pdf-export-mode'), 600); }, 60); } catch (e) {} };
  const doExport = async () => {
    if (!rep) return;
    setExporting(true);
    const fn = 'Supervisor-Report-' + (rep.date || '') + '-' + (rep.shift || '') + '.pdf';
    try {
      let ok = false;
      if (window.unicoHtmlServerPDF) ok = await window.unicoHtmlServerPDF('A4', 'portrait', fn);
      if (!ok) doPrint();
    } catch (e) { doPrint(); } finally { setExporting(false); }
  };

  if (!list) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted,#64748b)' }}>Loading…</div>;

  const sig = (rep && rep.sign) || (window.unicoSig ? window.unicoSig.load() : {});
  const HOSP = (window.UNICO && window.UNICO.HOSPITAL && window.UNICO.HOSPITAL.name) || 'UNICO Hospitals PLC';
  const activeSecs = RPT_SECTIONS.filter((s) => enabled[s.key]);

  const PageInner = rep ? (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '2px solid #1e3a8a', paddingBottom: 8, marginBottom: 10 }}>
        <img src="unico/logo.svg" alt="" style={{ height: 42 }} onError={(e) => { e.target.style.display = 'none'; }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{HOSP}</div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1e3a8a' }}>Log Sheet For {rep.shift} Supervisor</div>
        </div>
        <div style={{ fontSize: 10.5, textAlign: 'right', color: '#334155' }}>
          <div><b>Supervisor:</b> {rep.supervisorName || '—'}</div>
          <div><b>Date:</b> {rep.date} &nbsp; <b>Shift:</b> {rep.shift}</div>
          {rep.shiftTime ? <div><b>Time:</b> {rep.shiftTime}</div> : null}
        </div>
      </div>

      {activeSecs.map((s) => {
        if (s.kind === 'rows') {
          const rows = rep[s.key] || [];
          if (!rows.length) return null;
          return <div key={s.key}><div className="sup-sec-h">{s.title} : {rows.length}</div><RptRows section={s} rows={rows} /></div>;
        }
        if (s.kind === 'counts') {
          return <div key={s.key}><div className="sup-sec-h">{s.title}</div><RptCounts fields={s.fields} val={rep[s.key]} /></div>;
        }
        if (s.kind === 'notes') {
          return <div key={s.key}><div className="sup-sec-h">{s.title}</div>
            <table className="sup-rpt-tbl"><tbody>
              <tr><th style={{ width: '25%' }}>Absenteeism</th><td>{rep.absenteeism || '—'}</td></tr>
              <tr><th>Sick Leave</th><td>{rep.sickLeave || '—'}</td></tr>
              <tr><th>Observation During Round</th><td>{rep.roundObservation || '—'}</td></tr>
            </tbody></table></div>;
        }
        if (s.kind === 'census') {
          const cen = rep.census || {};
          const keys = ['OPD Total'].concat(deptNames);
          return <div key={s.key}><div className="sup-sec-h">{s.title}</div>
            <table className="sup-rpt-tbl"><thead><tr>{keys.map((k) => <th key={k}>{k}</th>)}<th>TOTAL</th></tr></thead>
              <tbody><tr>{keys.map((k) => <td key={k}>{cen[k] || ''}</td>)}<td><b>{cen.TOTAL != null ? cen.TOTAL : supComputeCensusTotal(cen, deptNames)}</b></td></tr></tbody></table></div>;
        }
        return null;
      })}

      {/* signatures */}
      <table className="sup-rpt-tbl" style={{ marginTop: 16 }}><thead><tr><th>Prepared by</th><th>Checked by</th><th>Recommended by</th><th>Approved by</th></tr></thead>
        <tbody><tr style={{ height: 46 }}><td>{sig.prepared || ''}</td><td>{sig.reviewed || ''}</td><td>{sig.recommended || ''}</td><td>{sig.approved || ''}</td></tr></tbody></table>
      <div className="pdf-foot" style={{ borderTop: '1px solid #cbd5e1', marginTop: 12, paddingTop: 6, fontSize: 9, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
        <span>{HOSP} — Supervisor Log Sheet</span><span>Generated {supTodayISO()}</span>
      </div>
    </div>
  ) : null;

  return (
    <div className="sup-wrap">
      <div className="sup-toolbar">
        <SupBtn sm onClick={() => setRoute({ view: 'supHistory' })}><Ic d={I.chevR} s={14} style={{ transform: 'rotate(180deg)' }} />Back</SupBtn>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Generate Report</div>
        <span style={{ flex: 1 }} />
        <select value={(rep && rep.id) || ''} onChange={(e) => supApi.get('/api/supervisor-reports/' + e.target.value).then((j) => { if (j.ok) setRep(j.report); })} style={{ padding: '6px 9px', borderRadius: 8, border: '1px solid var(--line,#d1d5db)', fontSize: 12.5 }}>
          {list.map((r) => <option key={r.id} value={r.id}>{r.date} · {r.shift} · {r.supervisorName || '—'}</option>)}
        </select>
        <SupBtn sm onClick={doPrint}><Ic d={I.print} s={14} />Print</SupBtn>
        <SupBtn sm kind="pri" onClick={doExport} disabled={exporting || !rep}><Ic d={I.download} s={14} />{exporting ? 'Exporting…' : 'Export PDF'}</SupBtn>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted,#64748b)' }}>Quick template:</span>
        {Object.keys(SUP_TEMPLATES).map((t) => <SupBtn key={t} sm onClick={() => applyTemplate(t)}>{SUP_TEMPLATES[t].label}</SupBtn>)}
        <SupBtn sm onClick={() => setCustomize((c) => !c)}><Ic d={I.filter} s={13} />Customize sections</SupBtn>
      </div>

      {customize && (
        <div className="sup-card"><div className="sup-card-b">
          <div className="sup-scalar">
            {RPT_SECTIONS.map((s) => (
              <label key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600 }}>
                <input type="checkbox" checked={!!enabled[s.key]} onChange={() => setEnabled((m) => ({ ...m, [s.key]: !m[s.key] }))} />{s.title}
              </label>
            ))}
          </div>
        </div></div>
      )}

      {/* on-screen preview */}
      <div className="sup-paper">{rep ? <div className="pdf-page">{PageInner}</div> : <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>Select a report to preview.</div>}</div>

      {/* hidden export copy into #pdf-root */}
      {pdfRoot && rep && ReactDOM.createPortal(<div className="pdf-doc portrait"><section className="pdf-page">{PageInner}</section></div>, pdfRoot)}
    </div>
  );
}

/* ================================================================= dispatcher */
function SupervisorView({ view, id, shift, depts, setRoute }) {
  if (view === 'supHistory') return <SupHistory setRoute={setRoute} />;
  if (view === 'supReport') return <SupReportView id={id} depts={depts} setRoute={setRoute} />;
  if (view === 'supNew') return <SupEditor id={id} shift={shift} depts={depts} setRoute={setRoute} />;
  return <SupHome setRoute={setRoute} />;
}

/* ---------------- styles ---------------- */
const SUP_CSS = `
.sup-wrap{display:flex;flex-direction:column;gap:16px}
.sup-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.sup-card{background:var(--panel,#fff);border:1px solid var(--line,#e5e7eb);border-radius:12px;overflow:hidden}
.sup-card-h{display:flex;align-items:center;gap:10px;padding:11px 14px;cursor:pointer;background:var(--panel-2,#f8fafc);border-bottom:1px solid var(--line,#eef2f7)}
.sup-card-h h4{margin:0;font-size:13.5px;font-weight:700;flex:1}
.sup-count{background:#eef2ff;color:#3730a3;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700}
.sup-card-b{padding:13px 14px}
.sup-tblwrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
.sup-tbl{width:100%;border-collapse:collapse;font-size:12px;min-width:640px}
.sup-tbl th,.sup-tbl td{border:1px solid var(--line,#e5e7eb);padding:5px 6px;text-align:left;vertical-align:top}
.sup-tbl th{background:#f1f5f9;font-weight:700;font-size:11px;white-space:nowrap}
.sup-tbl input,.sup-tbl textarea,.sup-tbl select{width:100%;border:1px solid transparent;background:transparent;font:inherit;padding:3px;border-radius:4px;box-sizing:border-box}
.sup-tbl input:focus,.sup-tbl textarea:focus,.sup-tbl select:focus{border-color:#93c5fd;background:#fff;outline:none}
.sup-tbl textarea{resize:vertical;min-height:34px}
.sup-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line,#d1d5db);background:#fff;border-radius:8px;padding:6px 11px;font-size:12.5px;font-weight:600;cursor:pointer;color:var(--ink,#111827)}
.sup-btn:hover{background:#f8fafc}
.sup-btn:disabled{opacity:.55;cursor:default}
.sup-btn.pri{background:#2563eb;border-color:#2563eb;color:#fff}
.sup-btn.pri:hover{background:#1d4ed8}
.sup-btn.dgr{color:#dc2626;border-color:#fecaca}
.sup-btn.sm{padding:4px 9px;font-size:11.5px}
.sup-rowdel{color:#dc2626;cursor:pointer;border:0;background:transparent;font-weight:700;font-size:13px}
.sup-scalar{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:11px}
.sup-fld label{display:block;font-size:11px;font-weight:600;color:var(--muted,#64748b);margin-bottom:3px}
.sup-fld input,.sup-fld select,.sup-fld textarea{width:100%;border:1px solid var(--line,#d1d5db);border-radius:7px;padding:7px 9px;font:inherit;box-sizing:border-box;background:#fff;color:var(--ink,#111827)}
.sup-fld textarea{resize:vertical}
.sup-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.sup-kpi{background:var(--panel,#fff);border:1px solid var(--line,#e5e7eb);border-radius:12px;padding:14px 16px}
.sup-kpi .n{font-size:26px;font-weight:800;line-height:1;color:#0f172a}
.sup-kpi .l{font-size:11.5px;color:var(--muted,#64748b);margin-top:5px;font-weight:600}
.sup-alert{display:flex;align-items:center;gap:9px;padding:9px 12px;border-radius:9px;font-size:12.5px;font-weight:600;margin-bottom:8px}
.sup-alert.critical{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca}
.sup-alert.warn{background:#fffbeb;color:#b45309;border:1px solid #fde68a}
.sup-alert.info{background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe}
.sup-jump{display:flex;flex-wrap:wrap;gap:6px}
.sup-jump a{font-size:11.5px;padding:4px 10px;border-radius:20px;background:#f1f5f9;color:#334155;cursor:pointer;font-weight:600}
.sup-jump a:hover{background:#e2e8f0}
.sup-status{font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;text-transform:capitalize;display:inline-block}
.sup-status.draft{background:#f1f5f9;color:#475569}
.sup-status.submitted{background:#dbeafe;color:#1d4ed8}
.sup-status.approved{background:#dcfce7;color:#15803d}
.sup-paper{background:#e9edf2;padding:20px;border-radius:12px;overflow:auto}
.sup-paper .pdf-page{background:#fff;max-width:900px;margin:0 auto;box-shadow:0 4px 18px rgba(0,0,0,.12);padding:26px 30px;box-sizing:border-box}
.sup-rpt-tbl{width:100%;border-collapse:collapse;font-size:10.5px;margin:3px 0 12px}
.sup-rpt-tbl th,.sup-rpt-tbl td{border:1px solid #cbd5e1;padding:3px 5px;text-align:left;vertical-align:top}
.sup-rpt-tbl th{background:#eef2f7;font-weight:700}
.sup-sec-h{font-size:12.5px;font-weight:800;margin:14px 0 4px;color:#0f172a;border-left:3px solid #2563eb;padding-left:8px}
@media (max-width:820px){
  .sup-tbl{min-width:0}
  .sup-tbl thead{display:none}
  .sup-tbl tr{display:block;border:1px solid var(--line,#e5e7eb);border-radius:8px;margin-bottom:10px;padding:4px;background:#fff}
  .sup-tbl td{display:flex;gap:8px;border:0;border-bottom:1px solid #f1f5f9;padding:6px 4px;align-items:flex-start}
  .sup-tbl td:last-child{border-bottom:0}
  .sup-tbl td:before{content:attr(data-label);flex:0 0 42%;font-weight:700;font-size:11px;color:#64748b}
  .sup-tbl td:empty{display:none}
}`;
(function injectSupCss() { try { if (typeof document === 'undefined' || document.getElementById('sup-css')) return; const st = document.createElement('style'); st.id = 'sup-css'; st.textContent = SUP_CSS; document.head.appendChild(st); } catch (e) {} })();

Object.assign(window, { SupervisorView, SupReports: SupervisorView });
