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
// Render overlays (modals) at document.body so no transformed/overflow ancestor
// (the app content column) clips or off-centers them.
function supPortal(node) { try { if (typeof document !== 'undefined' && typeof ReactDOM !== 'undefined' && ReactDOM.createPortal) return ReactDOM.createPortal(node, document.body); } catch (e) {} return node; }
// Shift-time legend (hospital roster codes → timings). Used as quick presets for the
// "Shift Time" field, grouped by shift category (+ General is always available).
const SHIFT_LEGEND = {
  General: [['G1', '9:00 AM - 5:00 PM'], ['G2', '10:00 AM - 6:00 PM'], ['G3', '8:00 AM - 4:00 PM'], ['G4', '11:00 AM - 7:00 PM']],
  Morning: [['M1', '7:00 AM - 3:00 PM'], ['M2', '6:00 AM - 2:00 PM'], ['M3', '8:00 AM - 8:00 PM'], ['M4', '8:00 AM - 2:00 PM'], ['M6', '8:00 AM - 3:00 PM'], ['M7', '7:00 AM - 2:00 PM'], ['M8', '10:00 AM - 10:00 PM'], ['M11', '7:00 AM - 2:00 PM']],
  Evening: [['E1', '12:00 PM - 8:00 PM'], ['E2', '1:00 PM - 9:00 PM'], ['E3', '2:00 PM - 10:00 PM'], ['E4', '2:00 PM - 8:00 PM'], ['E6', '3:00 PM - 10:00 PM'], ['E10', '4:00 PM - 10:00 PM'], ['E11', '2:00 PM - 9:00 PM']],
  Night: [['N1', '9:00 PM - 7:00 AM'], ['N2', '8:00 PM - 8:00 AM'], ['N3', '9:00 PM - 9:00 AM'], ['N4', '10:00 PM - 8:00 AM'], ['N5', '10:00 PM - 7:00 AM'], ['N6', '11:00 PM - 7:00 AM'], ['N7', '7:00 PM - 7:00 AM'], ['N11', '9:00 PM - 7:00 AM'], ['DN1', '12:00 PM - next 8:00 AM']],
};
function supTodayISO() { try { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); } catch (e) { return ''; } }
function supCurrentShift() { try { const h = new Date().getHours(); if (h >= 6 && h < 14) return 'Morning'; if (h >= 14 && h < 21) return 'Evening'; return 'Night'; } catch (e) { return 'Night'; } }
function supIsAdmin() { try { const u = window.__UNICO_USER__; return !u || u.role === 'Administrator'; } catch (e) { return true; } }
function supDeptNames(depts) {
  try { const m = window.DEPTMAP; if (m && m.patientDeptIds) { const ids = m.patientDeptIds(); if (ids && ids.length) return ids.map((id) => m.nameFromId(id)); } } catch (e) {}
  return (depts || []).map((d) => d.name).filter(Boolean);
}

/* ---------------- suggestion "echo" system ----------------
   Every text field remembers the values typed before (per field id) in localStorage,
   and offers them as an autocomplete dropdown next time — so recurring consultants,
   diagnoses, procedures, wards etc. are one tap to reuse. */
const SUP_SUG_KEY = 'unico_sup_suggestions_v1';
function supLoadSug() { try { const s = JSON.parse(localStorage.getItem(SUP_SUG_KEY)); return (s && typeof s === 'object') ? s : {}; } catch (e) { return {}; } }
function supRememberField(field, val) {
  val = String(val == null ? '' : val).trim();
  if (!field || field === 'uhid' || !val || val.length > 160) return;
  try {
    const s = supLoadSug();
    const arr = (s[field] || []).filter((x) => x.toLowerCase() !== val.toLowerCase());
    arr.unshift(val);
    s[field] = arr.slice(0, 60);
    localStorage.setItem(SUP_SUG_KEY, JSON.stringify(s));
    window.dispatchEvent(new Event('unico:sup-sug'));
  } catch (e) {}
}
function useSug() {
  const [sug, setSug] = useState(() => supLoadSug());
  useEffect(() => { const h = () => setSug(supLoadSug()); window.addEventListener('unico:sup-sug', h); return () => window.removeEventListener('unico:sup-sug', h); }, []);
  return sug;
}
// Dynamic text/textarea input with a live "previously used" suggestion dropdown.
function SugInput({ value, onChange, onCommit, field, area, type, placeholder, rows, disabled }) {
  const sug = useSug();
  const [foc, setFoc] = useState(false);
  const v = value || '';
  const pool = sug[field] || [];
  const list = (v ? pool.filter((x) => x.toLowerCase().indexOf(String(v).toLowerCase()) >= 0 && x.toLowerCase() !== String(v).toLowerCase()) : pool).slice(0, 7);
  const blur = () => { window.setTimeout(() => setFoc(false), 140); supRememberField(field, v); if (onCommit) onCommit(); };
  const common = { value: v, onChange: (e) => onChange(e.target.value), onFocus: () => setFoc(true), onBlur: blur, placeholder, disabled };
  return (
    <div className="sup-sug-wrap">
      {area ? <textarea rows={rows || 2} {...common} /> : <input type={type || 'text'} {...common} />}
      {foc && !disabled && list.length > 0 && (
        <div className="sup-sug-list">
          {list.map((s) => <div key={s} className="sup-sug-item" onMouseDown={(e) => { e.preventDefault(); onChange(s); setFoc(false); }}>{s}</div>)}
        </div>
      )}
    </div>
  );
}

/* ---------------- row clipboard (copy / cut / paste full patient rows) ---------------- */
const SUP_CLIP_KEY = 'unico_sup_rowclip_v1';
function supSetClip(row) { try { localStorage.setItem(SUP_CLIP_KEY, JSON.stringify(row || {})); window.dispatchEvent(new Event('unico:sup-clip')); } catch (e) {} }
function supGetClip() { try { const r = JSON.parse(localStorage.getItem(SUP_CLIP_KEY)); return (r && typeof r === 'object') ? r : null; } catch (e) { return null; } }
function useClip() {
  const [c, setC] = useState(() => supGetClip());
  useEffect(() => { const h = () => setC(supGetClip()); window.addEventListener('unico:sup-clip', h); return () => window.removeEventListener('unico:sup-clip', h); }, []);
  return c;
}

/* ---------------- custom fields engine ----------------
   Users can add their OWN columns (text / number / date / dropdown / checkbox) to any
   section, and create entirely new custom sections. Config persists in localStorage and
   applies to the editor, the report preview and the export. Row values live in the same
   free-form row objects (keyed by the custom field id), so they save with the report. */
const SUP_FIELDS_KEY = 'unico_sup_fields_v1';
const SUP_FTYPES = [['text', 'Text'], ['area', 'Long text'], ['num', 'Number'], ['date', 'Date'], ['select', 'Dropdown'], ['check', 'Checkbox']];
function supLoadFields() { try { const s = JSON.parse(localStorage.getItem(SUP_FIELDS_KEY)); return { cols: (s && s.cols) || {}, sections: (s && Array.isArray(s.sections)) ? s.sections : [] }; } catch (e) { return { cols: {}, sections: [] }; } }
function supSaveFields(cfg) { try { localStorage.setItem(SUP_FIELDS_KEY, JSON.stringify(cfg)); window.dispatchEvent(new Event('unico:sup-fields')); } catch (e) {} }
function supFieldId() { return 'c_' + Date.now().toString(36) + Math.floor(Math.random() * 1e5).toString(36); }
function useFields() {
  const [f, setF] = useState(() => supLoadFields());
  useEffect(() => { const h = () => setF(supLoadFields()); window.addEventListener('unico:sup-fields', h); return () => window.removeEventListener('unico:sup-fields', h); }, []);
  return f;
}
function FieldManagerModal({ sectionKey, sectionTitle, onClose }) {
  const cfg = useFields();
  const cols = cfg.cols[sectionKey] || [];
  const [label, setLabel] = useState('');
  const [type, setType] = useState('text');
  const [options, setOptions] = useState('');
  const persist = (nextCols) => { const next = { cols: { ...cfg.cols, [sectionKey]: nextCols }, sections: cfg.sections }; supSaveFields(next); };
  const add = () => {
    const lb = label.trim(); if (!lb) { supToast('Enter a field name.', 'info'); return; }
    const col = { id: supFieldId(), label: lb, type, custom: true };
    if (type === 'select') col.options = options.split(',').map((s) => s.trim()).filter(Boolean);
    persist([...cols, col]); setLabel(''); setOptions(''); setType('text');
    supToast('Field “' + lb + '” added.', 'success');
  };
  const remove = (id) => persist(cols.filter((c) => c.id !== id));
  const moveCol = (i, dir) => { const j = i + dir; if (j < 0 || j >= cols.length) return; const c = cols.slice(); const [m] = c.splice(i, 1); c.splice(j, 0, m); persist(c); };
  return supPortal(
    <div className="sup-modal-bg" onClick={onClose}>
      <div className="sup-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="sup-modal-h">
          <div className="sup-hero-ic" style={{ width: 36, height: 36, background: 'rgba(255,255,255,.18)' }}><Ic d={I.gear} s={18} c="#fff" /></div>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 15 }}>Custom Fields</div><div style={{ fontSize: 11.5, opacity: .9 }}>{sectionTitle}</div></div>
          <button className="sup-modal-x" onClick={onClose}><Ic d={I.x} s={16} c="#fff" /></button>
        </div>
        <div className="sup-modal-b">
          {cols.length > 0 ? (
            <div style={{ marginBottom: 14 }}>
              {cols.map((c, i) => (
                <div key={c.id} className="sup-fieldrow">
                  <span className="sup-tag" style={{ background: '#eef2ff', color: '#3730a3' }}>{(SUP_FTYPES.find((t) => t[0] === c.type) || ['', 'Text'])[1]}</span>
                  <b style={{ flex: 1 }}>{c.label}</b>
                  {c.options && c.options.length ? <span style={{ fontSize: 10.5, color: '#94a3b8' }}>{c.options.join(', ')}</span> : null}
                  <button className="sup-btn sm" onClick={() => moveCol(i, -1)} title="Move up" disabled={i === 0}>↑</button>
                  <button className="sup-btn sm" onClick={() => moveCol(i, 1)} title="Move down" disabled={i === cols.length - 1}>↓</button>
                  <button className="sup-btn sm dgr" onClick={() => remove(c.id)}>Remove</button>
                </div>
              ))}
            </div>
          ) : <div style={{ color: '#94a3b8', fontSize: 12.5, marginBottom: 14 }}>No custom fields yet. Add one below.</div>}
          <div style={{ borderTop: '1px dashed var(--line,#e5e7eb)', paddingTop: 14 }}>
            <div className="sup-scalar">
              <div className="sup-fld" style={{ gridColumn: 'span 2' }}><label>New field name</label><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Allergy, MRN, Isolation…" onKeyDown={(e) => { if (e.key === 'Enter') add(); }} /></div>
              <div className="sup-fld"><label>Type</label><select value={type} onChange={(e) => setType(e.target.value)}>{SUP_FTYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            </div>
            {type === 'select' && <div className="sup-fld" style={{ marginTop: 10 }}><label>Options (comma-separated)</label><input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Yes, No, N/A" /></div>}
          </div>
        </div>
        <div className="sup-modal-f"><SupBtn onClick={onClose}>Done</SupBtn><span style={{ flex: 1 }} /><SupBtn kind="pri" onClick={add}><Ic d={I.plus} s={15} />Add field</SupBtn></div>
      </div>
    </div>
  );
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
  doa: { id: 'doa', label: 'DOA (Date & Time)', type: 'datetime', w: 140 },
};
// Format a datetime-local value ("2026-07-26T10:30") to the readable log-sheet form.
function supFmtDT(v) { try { const d = new Date(v); if (isNaN(d.getTime())) return v; const p = (n) => String(n).padStart(2, '0'); let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(h) + ':' + p(d.getMinutes()) + ' ' + ap; } catch (e) { return v; } }
// Date+time field: an editable text (keeps the dd/mm/yyyy format + existing values) plus
// a native picker button that fills a formatted date & time.
function DateTimeInput({ value, onChange, disabled }) {
  const ref = useRef(null);
  const openPicker = () => { const el = ref.current; if (!el) return; try { el.showPicker(); } catch (e) { el.focus(); } };
  return (
    <div className="sup-dt">
      <input className="sup-dt-txt" value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="DD/MM/YYYY hh:mm AM/PM" disabled={disabled} />
      {!disabled && <React.Fragment>
        <button type="button" className="sup-dt-btn" title="Pick date & time" onClick={openPicker}><Ic d={I.cal} s={15} /></button>
        <input ref={ref} type="datetime-local" className="sup-dt-hidden" tabIndex={-1} onChange={(e) => { if (e.target.value) onChange(supFmtDT(e.target.value)); }} />
      </React.Fragment>}
    </div>
  );
}
const SUP_SECTIONS = [
  { key: 'newAdmissions', title: 'New Admission', sn: true, cols: [C.dept, C.bed, C.name, C.age, C.uhid, C.consultant, C.diagnosis, C.doa, { id: 'remarks', label: 'Remarks', type: 'area', w: 200 }] },
  { key: 'criticalArea', title: 'Patient in Critical Areas', sn: true, cols: [C.dept, C.bed, C.name, C.age, C.uhid, C.consultant, C.diagnosis, C.doa, { id: 'remarks', label: 'Remarks', type: 'area', w: 200 }] },
  { key: 'cabinArea', title: 'Patient in Cabin Areas', sn: true, cols: [C.dept, C.bed, C.name, C.age, C.uhid, C.consultant, C.diagnosis, C.doa, { id: 'remarks', label: 'Remarks', type: 'area', w: 200 }] },
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
// Logical groups so the long editor reads as an organized ecosystem, not a flat list.
const SEC_GROUP = {
  newAdmissions: 'Inpatient Lists', criticalArea: 'Inpatient Lists', cabinArea: 'Inpatient Lists',
  lama: 'Admissions & Movements', discharged: 'Admissions & Movements',
  otTable: 'Procedures & Surgery', surgeries: 'Procedures & Surgery', interventional: 'Procedures & Surgery', radiological: 'Procedures & Surgery',
  ventilators: 'Clinical Status', pressureSore: 'Patient Safety Registers', phlebitis: 'Patient Safety Registers',
};

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

/* ---------------- "at a glance" patient aggregation ----------------
   Walks every report chronologically (oldest→newest, Morning→Evening→Night)
   building a live census: a patient is upserted from admission / critical / procedure
   rows and REMOVED when they appear in a later report's discharged / LAMA list. The
   result is every patient still present in the hospital right now — the carry-forward
   source and the Patient Board. */
const SHIFT_ORD = { Morning: 0, Evening: 1, Night: 2 };
function supChrono(a, b) { if (a.date !== b.date) return a.date < b.date ? -1 : 1; return (SHIFT_ORD[a.shift] || 0) - (SHIFT_ORD[b.shift] || 0); }
function supPatKey(row) { const u = String(row.uhid || '').trim(); if (u) return 'u:' + u; const n = String(row.name || '').trim().toLowerCase(); return n ? 'n:' + n : ''; }
function supDaysSince(doa) {
  try { const m = String(doa || '').match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/); if (!m) return null; let y = parseInt(m[3], 10); if (y < 100) y += 2000; const d = new Date(y, parseInt(m[2], 10) - 1, parseInt(m[1], 10)); const diff = Math.floor((Date.now() - d.getTime()) / 864e5); return diff >= 0 && diff < 3650 ? diff : null; } catch (e) { return null; }
}
function supActivePatients(reports) {
  const rs = (reports || []).slice().sort(supChrono);
  const map = {};
  rs.forEach((rep) => {
    const stamp = { date: rep.date, shift: rep.shift };
    ['newAdmissions', 'criticalArea', 'cabinArea', 'interventional'].forEach((sec) => {
      (rep[sec] || []).forEach((row) => {
        const k = supPatKey(row); if (!k) return;
        const prev = map[k] || {};
        map[k] = {
          key: k,
          name: row.name || prev.name || '',
          uhid: row.uhid || prev.uhid || '',
          age: row.age || prev.age || '',
          dept: row.dept || prev.dept || '',
          bed: row.bed || prev.bed || '',
          consultant: row.consultant || prev.consultant || '',
          diagnosis: row.diagnosis || prev.diagnosis || '',
          doa: row.doa || prev.doa || '',
          remarks: row.remarks || prev.remarks || '',
          critical: sec === 'criticalArea' || prev.critical || false,
          admittedAt: prev.admittedAt || stamp,
          lastSeen: stamp,
          repId: rep.id || prev.repId || null,
          section: sec,
        };
      });
    });
    ['discharged', 'lama'].forEach((sec) => { (rep[sec] || []).forEach((row) => { const k = supPatKey(row); if (k && map[k]) delete map[k]; }); });
  });
  return Object.keys(map).map((k) => map[k]).sort((a, b) => (a.dept || '').localeCompare(b.dept || ''));
}

/* ---------------- shared UI bits ---------------- */
function SupHero({ icon, title, sub, right }) {
  return (
    <div className="sup-hero">
      <div className="sup-hero-ic"><Ic d={icon || I.doc} s={22} c="#fff" /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="sup-hero-t">{title}</div>
        {sub && <div className="sup-hero-s">{sub}</div>}
      </div>
      {right && <div className="sup-hero-r">{right}</div>}
    </div>
  );
}
function SupBtn({ kind, sm, onClick, children, title, disabled }) {
  return <button className={'sup-btn' + (kind ? ' ' + kind : '') + (sm ? ' sm' : '')} onClick={onClick} title={title || ''} disabled={disabled}>{children}</button>;
}
function StatusBadge({ status }) { return <span className={'sup-status ' + (status || 'draft')}>{status || 'draft'}</span>; }

function RowsEditor({ section, rows, deptNames, readOnly, onChange, onLookup }) {
  rows = rows || [];
  const cfg = useFields();
  const custom = cfg.cols[section.key] || [];
  const cols = (section.cols || []).concat(custom);
  const drag = useRef(null);
  const [over, setOver] = useState(null);
  const [fm, setFm] = useState(false);
  const clip = useClip();
  const set = (i, k, v) => onChange(rows.map((r, x) => (x === i ? { ...r, [k]: v } : r)));
  const add = () => onChange([...rows, {}]);
  const dup = (i) => { const c = rows.slice(); c.splice(i + 1, 0, { ...rows[i] }); onChange(c); };
  const del = (i) => onChange(rows.filter((_, x) => x !== i));
  const copy = (i) => { supSetClip(rows[i]); supToast('Row copied — paste it in any section.', 'success'); };
  const cut = (i) => { supSetClip(rows[i]); del(i); supToast('Row cut to clipboard.', 'success'); };
  const pasteBelow = (i) => { if (!clip) return; const c = rows.slice(); c.splice(i + 1, 0, { ...clip }); onChange(c); };
  const pasteEnd = () => { if (!clip) return; onChange([...rows, { ...clip }]); supToast('Row pasted.', 'success'); };
  const move = (from, to) => { if (from == null || to == null || from === to) return; const c = rows.slice(); const [m] = c.splice(from, 1); c.splice(to, 0, m); onChange(c); };
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
  // Typed cell renderer — built-in dept select uses the Statistics list; custom
  // dropdowns use their own options; text/long-text use the suggestion input.
  const cell = (c, row, i) => {
    if (readOnly) return <span>{c.type === 'check' ? (row[c.id] ? 'Yes' : '') : (row[c.id] || '')}</span>;
    if (c.type === 'select') {
      const opts = (c.options && c.options.length) ? c.options : (c.id === 'dept' ? deptNames : []);
      return (
        <select value={row[c.id] || ''} onChange={(e) => set(i, c.id, e.target.value)}>
          <option value=""></option>
          {opts.concat(row[c.id] && opts.indexOf(row[c.id]) < 0 ? [row[c.id]] : []).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      );
    }
    if (c.type === 'num') return <input type="number" value={row[c.id] || ''} onChange={(e) => set(i, c.id, e.target.value)} />;
    if (c.type === 'date') return <input type="date" value={row[c.id] || ''} onChange={(e) => set(i, c.id, e.target.value)} />;
    if (c.type === 'datetime') return <DateTimeInput value={row[c.id] || ''} onChange={(v) => set(i, c.id, v)} />;
    if (c.type === 'check') return <input type="checkbox" checked={!!row[c.id]} onChange={(e) => set(i, c.id, e.target.checked)} style={{ width: 18, height: 18 }} />;
    return <SugInput field={c.id} area={c.type === 'area'} value={row[c.id] || ''} onChange={(val) => set(i, c.id, val)} onCommit={c.lookup ? () => doLookup(i, row[c.id]) : undefined} />;
  };
  const span = cols.length + (section.sn ? 1 : 0) + (readOnly ? 0 : 2);
  return (
    <div>
      <div className="sup-tblwrap">
        <table className="sup-tbl">
          <thead><tr>{!readOnly && <th style={{ width: 26 }}></th>}{section.sn && <th style={{ width: 34 }}>#</th>}{cols.map((c) => <th key={c.id} style={c.w ? { minWidth: c.w } : null}>{c.label}{c.custom ? <span className="sup-custom-dot" title="Custom field">◆</span> : null}</th>)}{!readOnly && <th style={{ width: 128 }}>Actions</th>}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td data-label="" colSpan={span} style={{ color: '#94a3b8', textAlign: 'center', padding: 10 }}>No entries yet. Use “+ Add row” or the Add Patient button.</td></tr>}
            {rows.map((row, i) => (
              <tr key={i} className={over === i ? 'sup-drop' : ''}
                onDragOver={readOnly ? undefined : (e) => { e.preventDefault(); if (over !== i) setOver(i); }}
                onDrop={readOnly ? undefined : (e) => { e.preventDefault(); move(drag.current, i); drag.current = null; setOver(null); }}>
                {!readOnly && <td data-label="" className="sup-grip" draggable
                  onDragStart={(e) => { drag.current = i; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(i)); } catch (_) {} }}
                  onDragEnd={() => { drag.current = null; setOver(null); }} title="Drag to reorder"><Ic d={I.grip} s={14} /></td>}
                {section.sn && <td data-label="#">{i + 1}</td>}
                {cols.map((c) => <td key={c.id} data-label={c.label}>{cell(c, row, i)}</td>)}
                {!readOnly && <td data-label="Actions" className="sup-actions">
                  <button className="sup-ib" title="Copy row" onClick={() => copy(i)}>⧉</button>
                  <button className="sup-ib" title="Cut row" onClick={() => cut(i)}>✂</button>
                  {clip && <button className="sup-ib" title="Paste row below" onClick={() => pasteBelow(i)}>⤵</button>}
                  <button className="sup-ib" title="Duplicate row" onClick={() => dup(i)}>＋</button>
                  <button className="sup-ib danger" title="Remove row" onClick={() => del(i)}>✕</button>
                </td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <SupBtn sm onClick={add}>+ Add row</SupBtn>
        {clip && <SupBtn sm onClick={pasteEnd}><Ic d={I.download} s={13} />Paste row{clip.name ? ' · ' + clip.name : ''}</SupBtn>}
        <SupBtn sm onClick={() => setFm(true)}><Ic d={I.gear} s={13} />Custom fields{custom.length ? ' (' + custom.length + ')' : ''}</SupBtn>
        {rows.length > 0 && <SupBtn sm kind="dgr" onClick={() => { if (window.confirm('Clear all ' + rows.length + ' row(s) in this section?')) onChange([]); }}><Ic d={I.x} s={13} />Clear all</SupBtn>}
      </div>}
      {fm && <FieldManagerModal sectionKey={section.key} sectionTitle={section.title} onClose={() => setFm(false)} />}
    </div>
  );
}

function ScalarFields({ fields, val, onChange, readOnly, sectionKey }) {
  val = val || {};
  const cfg = useFields();
  const [fm, setFm] = useState(false);
  const custom = (sectionKey && cfg.cols[sectionKey]) || [];
  const setK = (k, v) => onChange({ ...val, [k]: v });
  const customCell = (c) => {
    if (readOnly) return <div style={{ fontWeight: 600 }}>{c.type === 'check' ? (val[c.id] ? 'Yes' : '—') : (val[c.id] || '—')}</div>;
    if (c.type === 'num') return <input type="number" value={val[c.id] || ''} onChange={(e) => setK(c.id, e.target.value)} />;
    if (c.type === 'date') return <input type="date" value={val[c.id] || ''} onChange={(e) => setK(c.id, e.target.value)} />;
    if (c.type === 'datetime') return <DateTimeInput value={val[c.id] || ''} onChange={(v) => setK(c.id, v)} />;
    if (c.type === 'check') return <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}><input type="checkbox" checked={!!val[c.id]} onChange={(e) => setK(c.id, e.target.checked)} style={{ width: 18, height: 18 }} /> Yes</label>;
    if (c.type === 'select') return <select value={val[c.id] || ''} onChange={(e) => setK(c.id, e.target.value)}><option value=""></option>{(c.options || []).map((o) => <option key={o} value={o}>{o}</option>)}</select>;
    return <input value={val[c.id] || ''} onChange={(e) => setK(c.id, e.target.value)} />;
  };
  return (
    <div>
      <div className="sup-scalar">
        {fields.map((f) => { const id = f[0], label = f[1], type = f[2]; return (
          <div className="sup-fld" key={id}><label>{label}</label>
            {readOnly ? <div style={{ fontWeight: 600 }}>{val[id] || '—'}</div>
              : <input type={type === 'num' ? 'number' : 'text'} value={val[id] || ''} onChange={(e) => setK(id, e.target.value)} />}
          </div>); })}
        {custom.map((c) => <div className="sup-fld" key={c.id}><label>{c.label} <span className="sup-custom-dot" title="Custom field">◆</span></label>{customCell(c)}</div>)}
      </div>
      {!readOnly && sectionKey && <div style={{ marginTop: 10 }}><SupBtn sm onClick={() => setFm(true)}><Ic d={I.gear} s={13} />Custom fields{custom.length ? ' (' + custom.length + ')' : ''}</SupBtn></div>}
      {fm && <FieldManagerModal sectionKey={sectionKey} sectionTitle="Custom fields" onClose={() => setFm(false)} />}
    </div>
  );
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
    <div className={'sup-card' + (open ? ' sup-open' : '') + (count > 0 ? ' sup-has' : '')} id={anchor}>
      <div className="sup-card-h" onClick={onToggle}>
        <Ic d={I.chevR} s={15} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: '.15s', flex: '0 0 auto', color: open ? '#2563eb' : '#94a3b8' }} />
        <h4>{title}</h4>
        {count != null && <span className={'sup-count' + (count > 0 ? ' on' : '')}>{count}</span>}
        {open && <span className="sup-active-pill">Active</span>}
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

// Sections a patient row can be added to from the Quick Add dialog.
const QUICK_TARGETS = [
  ['newAdmissions', 'New Admission'], ['criticalArea', 'Critical Area'], ['cabinArea', 'Cabin Area'], ['discharged', 'Discharged'],
  ['lama', 'LAMA / DAMA'], ['interventional', 'Interventional Procedure'], ['radiological', 'Radiological Procedure'],
  ['pressureSore', 'Pressure Sore'], ['phlebitis', 'Phlebitis'],
];
function QuickAddModal({ deptNames, onAdd, onClose, onLookup }) {
  const cfg = useFields();
  const [row, setRow] = useState({});
  const [target, setTarget] = useState('newAdmissions');
  const [more, setMore] = useState(false);
  const set = (k, v) => setRow((r) => ({ ...r, [k]: v }));
  const customCols = cfg.cols[target] || [];
  const customCell = (c) => {
    if (c.type === 'num') return <input type="number" value={row[c.id] || ''} onChange={(e) => set(c.id, e.target.value)} />;
    if (c.type === 'date') return <input type="date" value={row[c.id] || ''} onChange={(e) => set(c.id, e.target.value)} />;
    if (c.type === 'check') return <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}><input type="checkbox" checked={!!row[c.id]} onChange={(e) => set(c.id, e.target.checked)} style={{ width: 18, height: 18 }} /> Yes</label>;
    if (c.type === 'select') return <select value={row[c.id] || ''} onChange={(e) => set(c.id, e.target.value)}><option value=""></option>{(c.options || []).map((o) => <option key={o} value={o}>{o}</option>)}</select>;
    return <SugInput field={c.id} area={c.type === 'area'} value={row[c.id] || ''} onChange={(v) => set(c.id, v)} />;
  };
  const doLookup = async () => {
    if (!onLookup || !String(row.uhid || '').trim()) return;
    const p = await onLookup(row.uhid);
    if (!p) return;
    setRow((r) => { const nr = { ...r }; ['name', 'age', 'consultant', 'diagnosis', 'dept'].forEach((k) => { if (p[k] && !String(nr[k] || '').trim()) nr[k] = p[k]; }); return nr; });
    supToast('Autofilled from a previous entry', 'success');
  };
  const save = (again) => {
    if (!String(row.name || '').trim() && !String(row.uhid || '').trim()) { supToast('Enter at least a name or UHID.', 'info'); return; }
    onAdd(target, row);
    if (again) { setRow({ dept: row.dept }); supToast('Patient added — add another.', 'success'); }
    else onClose();
  };
  return supPortal(
    <div className="sup-modal-bg" onClick={onClose}>
      <div className="sup-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sup-modal-h">
          <div className="sup-hero-ic" style={{ width: 36, height: 36, background: 'rgba(255,255,255,.18)' }}><Ic d={I.plus} s={18} c="#fff" /></div>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 15 }}>Add Patient</div><div style={{ fontSize: 11.5, opacity: .9 }}>Quickly add to any section</div></div>
          <button className="sup-modal-x" onClick={onClose}><Ic d={I.x} s={16} c="#fff" /></button>
        </div>
        <div className="sup-modal-b">
          <div className="sup-fld" style={{ marginBottom: 12 }}>
            <label>Add to section</label>
            <select value={target} onChange={(e) => setTarget(e.target.value)}>{QUICK_TARGETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </div>
          <div className="sup-scalar">
            <div className="sup-fld"><label>UHID</label><input value={row.uhid || ''} autoFocus onChange={(e) => set('uhid', e.target.value)} onBlur={doLookup} placeholder="Type & tab to autofill" /></div>
            <div className="sup-fld"><label>Name of Patient</label><SugInput field="name" value={row.name || ''} onChange={(v) => set('name', v)} /></div>
            <div className="sup-fld"><label>Department</label><select value={row.dept || ''} onChange={(e) => set('dept', e.target.value)}><option value=""></option>{deptNames.concat(row.dept && deptNames.indexOf(row.dept) < 0 ? [row.dept] : []).map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
            <div className="sup-fld"><label>Bed</label><SugInput field="bed" value={row.bed || ''} onChange={(v) => set('bed', v)} /></div>
            <div className="sup-fld"><label>Age</label><SugInput field="age" value={row.age || ''} onChange={(v) => set('age', v)} /></div>
            <div className="sup-fld"><label>Consultant</label><SugInput field="consultant" value={row.consultant || ''} onChange={(v) => set('consultant', v)} /></div>
          </div>
          <div className="sup-fld" style={{ marginTop: 12 }}><label>Diagnosis</label><SugInput field="diagnosis" area value={row.diagnosis || ''} onChange={(v) => set('diagnosis', v)} /></div>
          {more && <div style={{ marginTop: 12 }}>
            <div className="sup-scalar"><div className="sup-fld"><label>DOA (Date &amp; Time)</label><DateTimeInput value={row.doa || ''} onChange={(v) => set('doa', v)} /></div></div>
            <div className="sup-fld" style={{ marginTop: 12 }}><label>Remarks</label><SugInput field="remarks" area value={row.remarks || ''} onChange={(v) => set('remarks', v)} /></div>
          </div>}
          {customCols.length > 0 && <div style={{ marginTop: 14, borderTop: '1px dashed var(--line,#e5e7eb)', paddingTop: 12 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#7c3aed', marginBottom: 8 }}>Custom fields ◆</div>
            <div className="sup-scalar">{customCols.map((c) => <div className="sup-fld" key={c.id}><label>{c.label}</label>{customCell(c)}</div>)}</div>
          </div>}
          <div style={{ marginTop: 8 }}><SupBtn sm onClick={() => setMore((m) => !m)}>{more ? '− Fewer fields' : '+ More fields (DOA, remarks)'}</SupBtn></div>
        </div>
        <div className="sup-modal-f">
          <SupBtn onClick={onClose}>Cancel</SupBtn>
          <span style={{ flex: 1 }} />
          <SupBtn onClick={() => save(true)}>Save & add another</SupBtn>
          <SupBtn kind="pri" onClick={() => save(false)}><Ic d={I.check} s={15} />Add patient</SupBtn>
        </div>
      </div>
    </div>
  );
}

// Carry-forward picker — choose WHICH earlier report to copy from and WHICH sections.
function CarryForwardModal({ currentId, currentRep, onClose, onImport }) {
  const SECS = [['criticalArea', 'Critical Area'], ['cabinArea', 'Cabin Area'], ['newAdmissions', 'New Admission'], ['discharged', 'Discharged'], ['lama', 'LAMA / DAMA'], ['interventional', 'Interventional'], ['pressureSore', 'Pressure Sore'], ['phlebitis', 'Phlebitis']];
  const [list, setList] = useState(null);
  const [srcId, setSrcId] = useState('');
  const [secs, setSecs] = useState({ criticalArea: true, cabinArea: true, pressureSore: true, phlebitis: true });
  const [busy, setBusy] = useState(false);
  useEffect(() => { supApi.get('/api/supervisor-reports?limit=1000').then((j) => { if (j.ok) { const others = j.reports.filter((r) => r.id !== currentId); setList(others); if (others[0]) setSrcId(others[0].id); } }); }, []);
  const toggle = (k) => setSecs((s) => ({ ...s, [k]: !s[k] }));
  const doImport = async () => {
    if (!srcId) { supToast('Pick a report to copy from.', 'info'); return; }
    setBusy(true);
    const j = await supApi.get('/api/supervisor-reports/' + srcId); setBusy(false);
    if (!j.ok || !j.report) { supToast('Could not load that report.', 'error'); return; }
    const src = j.report; const patch = {}; let total = 0;
    Object.keys(secs).forEach((k) => {
      if (!secs[k]) return;
      const cur = currentRep[k] || [];
      const seen = new Set(cur.map(supPatKey).filter(Boolean));
      const add = (src[k] || []).filter((r) => { const key = supPatKey(r); return !key || !seen.has(key); });
      if (add.length) { patch[k] = [...cur, ...add.map((r) => ({ ...r }))]; total += add.length; }
    });
    onImport(patch, src, total); onClose();
  };
  return supPortal(
    <div className="sup-modal-bg" onClick={onClose}>
      <div className="sup-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="sup-modal-h">
          <div className="sup-hero-ic" style={{ width: 36, height: 36, background: 'rgba(255,255,255,.18)' }}><Ic d={I.download} s={17} c="#fff" /></div>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 15 }}>Carry Forward</div><div style={{ fontSize: 11.5, opacity: .9 }}>Copy patients from an earlier shift into this report</div></div>
          <button className="sup-modal-x" onClick={onClose}><Ic d={I.x} s={16} c="#fff" /></button>
        </div>
        <div className="sup-modal-b">
          <div className="sup-fld" style={{ marginBottom: 14 }}>
            <label>Copy from report</label>
            {list == null ? <div style={{ color: '#94a3b8', fontSize: 12.5 }}>Loading…</div>
              : list.length === 0 ? <div style={{ color: '#94a3b8', fontSize: 12.5 }}>No other reports to copy from yet.</div>
                : <select value={srcId} onChange={(e) => setSrcId(e.target.value)}>{list.map((r) => <option key={r.id} value={r.id}>{r.date} · {r.shift} · {r.supervisorName || '—'} ({(r.newAdmissions || []).length + (r.criticalArea || []).length + (r.cabinArea || []).length} patients)</option>)}</select>}
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted,#64748b)', marginBottom: 8 }}>Sections to carry forward (duplicates skipped by UHID)</div>
          <div className="sup-scalar">
            {SECS.map(([k, l]) => <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600 }}><input type="checkbox" checked={!!secs[k]} onChange={() => toggle(k)} />{l}</label>)}
          </div>
        </div>
        <div className="sup-modal-f"><SupBtn onClick={onClose}>Cancel</SupBtn><span style={{ flex: 1 }} /><SupBtn kind="pri" onClick={doImport} disabled={busy || !srcId}><Ic d={I.download} s={15} />{busy ? 'Copying…' : 'Carry forward'}</SupBtn></div>
      </div>
    </div>
  );
}

/* ================================================================= EDITOR */
function blankReport(shift) {
  return {
    date: supTodayISO(), shift: shift || supCurrentShift(), shiftTime: '', supervisorName: '', status: 'draft',
    newAdmissions: [], criticalArea: [], cabinArea: [], lama: [], discharged: [], otTable: [], surgeries: [], interventional: [], radiological: [],
    radiologyCounts: {}, ventilators: [], erCensus: {}, general: {}, pressureSore: [], phlebitis: [],
    absenteeism: '', sickLeave: '', roundObservation: '', census: {}, totals: {},
    sign: window.unicoSig ? window.unicoSig.load() : { prepared: '', reviewed: '', recommended: '', approved: '' },
  };
}

function SupEditor({ id, shift, openAdd, depts, setRoute }) {
  const deptNames = useMemo(() => supDeptNames(depts), [depts]);
  const cfg = useFields();
  const [rep, setRep] = useState(() => blankReport(shift));
  const [loading, setLoading] = useState(!!id);
  const [saved, setSaved] = useState('');
  const dirty = useRef(false);
  const timer = useRef(null);
  const [open, setOpen] = useState({ newAdmissions: true, allPatients: true });
  const [quickAdd, setQuickAdd] = useState(!!openAdd);
  const [addSec, setAddSec] = useState(false);
  const [secName, setSecName] = useState('');
  const [carryOpen, setCarryOpen] = useState(false);
  const admin = supIsAdmin();
  const readOnly = rep.status === 'approved' && !admin;

  const draftKey = (rid) => 'unico_sup_draft_' + (rid || 'new');
  useEffect(() => {
    if (!id) {
      // Restore an unsaved local draft so nothing is lost if the window was closed.
      try { const d = localStorage.getItem('unico_sup_draft_new'); if (d) { const r = JSON.parse(d); if (r && (String(r.supervisorName || '').trim() || (r.newAdmissions || []).length || (r.criticalArea || []).length)) { setRep(r); supToast('Restored your unsaved draft.', 'info'); } } } catch (e) {}
      return;
    }
    setLoading(true);
    supApi.get('/api/supervisor-reports/' + encodeURIComponent(id)).then((j) => {
      if (j.ok && j.report) setRep({ ...blankReport(), ...j.report });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  // No-loss safety net: mirror the report to localStorage on every change (survives a
  // closed tab / crash), and warn before leaving with unsaved edits.
  useEffect(() => { if (readOnly) return; try { localStorage.setItem(draftKey(rep.id), JSON.stringify(rep)); } catch (e) {} }, [rep, readOnly]);
  useEffect(() => {
    const h = (e) => { if (dirty.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

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
        if (j.ok) {
          dirty.current = false; setSaved('Saved ✓');
          if (!rep.id && j.report && j.report.id) { try { localStorage.removeItem('unico_sup_draft_new'); } catch (e) {} setRep((r) => ({ ...r, id: j.report.id })); }
        } else setSaved('Save failed');
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

  // Carry forward EVERY patient still present in the hospital (the Patient Board),
  // appended to the critical-area list, skipping any already listed by UHID.
  const importAllActive = async () => {
    try {
      const j = await supApi.get('/api/supervisor-reports?limit=1000');
      if (!j.ok) return;
      const active = supActivePatients(j.reports);
      const seen = new Set((rep.criticalArea || []).map((r) => supPatKey(r)).filter(Boolean));
      const add = active.filter((p) => !seen.has(p.key)).map((p) => ({ dept: p.dept, bed: p.bed, name: p.name, age: p.age, uhid: p.uhid, consultant: p.consultant, diagnosis: p.diagnosis, doa: p.doa, remarks: p.remarks }));
      if (!add.length) { supToast('No new active patients to carry forward.', 'info'); return; }
      edit({ criticalArea: [...(rep.criticalArea || []), ...add] });
      setOpen((o) => ({ ...o, criticalArea: true }));
      supToast('Carried forward ' + add.length + ' active patient(s).', 'success');
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
  const addPatient = (target, row) => { edit({ [target]: [...(rep[target] || []), { ...row }] }); setOpen((o) => ({ ...o, [target]: true })); };
  const createCustomSection = (title) => {
    title = (title || '').trim(); if (!title) return;
    const key = 'custom_' + supFieldId();
    supSaveFields({ cols: cfg.cols, sections: [...cfg.sections, { key, title }] });
    setOpen((o) => ({ ...o, [key]: true }));
    setAddSec(false); setSecName('');
    supToast('Section “' + title + '” added — use “Custom fields” to add its columns.', 'success');
  };
  const removeCustomSection = (key) => {
    if (!window.confirm('Delete this custom section? (Any data already entered stays saved in the report.)')) return;
    const cols = { ...cfg.cols }; delete cols[key];
    supSaveFields({ cols, sections: cfg.sections.filter((s) => s.key !== key) });
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted,#64748b)' }}>Loading report…</div>;

  const totals = supComputeTotals(rep);
  const alerts = supComputeAlerts(rep);
  // Consolidated "every patient in this report" list (across the patient-bearing sections).
  const PATIENT_SECS = [['newAdmissions', 'New Admission'], ['criticalArea', 'Critical Area'], ['cabinArea', 'Cabin Area'], ['lama', 'LAMA/DAMA'], ['discharged', 'Discharged'], ['interventional', 'Interventional'], ['radiological', 'Radiological']];
  const allPatients = [];
  PATIENT_SECS.forEach(([k, label]) => (rep[k] || []).forEach((r) => { if ((r.name || '').trim() || (r.uhid || '').trim()) allPatients.push({ section: label, ...r }); }));
  const go = (anchor) => { const el = document.getElementById('sup-sec-' + anchor); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); setOpen((o) => ({ ...o, [anchor]: true })); };

  // At-a-glance section status (every section, its fill state + count) for the status panel.
  const secMeta = [
    ...SUP_SECTIONS.map((s) => ({ key: s.key, title: s.title, kind: 'rows' })),
    ...cfg.sections.map((cs) => ({ key: cs.key, title: cs.title, kind: 'rows' })),
    { key: 'radiologyCounts', title: 'Radiology Counts', kind: 'counts' },
    { key: 'erCensus', title: 'ER Census', kind: 'counts' },
    { key: 'general', title: 'General Info', kind: 'counts' },
    { key: 'census', title: 'Census', kind: 'counts' },
    { key: 'notes', title: 'Notes', kind: 'notes' },
  ];
  const countOf = (m) => {
    if (m.kind === 'rows') return (rep[m.key] || []).length;
    if (m.kind === 'counts') { const o = rep[m.key] || {}; return Object.keys(o).filter((k) => { const v = o[k]; return v != null && String(v).trim() !== '' && String(v) !== '0' && k !== 'TOTAL'; }).length; }
    return (String(rep.absenteeism || '').trim() || String(rep.sickLeave || '').trim() || String(rep.roundObservation || '').trim()) ? 1 : 0;
  };
  const filledOf = (m) => countOf(m) > 0;
  const filledCount = secMeta.filter(filledOf).length;
  const pct = Math.round((filledCount / secMeta.length) * 100);
  const expandAll = () => { const o = {}; secMeta.forEach((m) => { o[m.key] = true; }); o.allPatients = true; o.sign = true; setOpen(o); };
  const collapseAll = () => setOpen({});

  return (
    <div className="sup-wrap">
      {/* hero + toolbar */}
      <SupHero icon={I.doc} title={(id ? 'Edit' : 'New') + ' Supervisor Report'}
        sub={rep.date + ' · ' + rep.shift + ' shift' + (rep.supervisorName ? ' · ' + rep.supervisorName : '')} />
      <div className="sup-toolbar sup-sticky">
        <SupBtn sm onClick={() => setRoute({ view: 'supHistory' })}><Ic d={I.chevR} s={14} style={{ transform: 'rotate(180deg)' }} />Back</SupBtn>
        <StatusBadge status={rep.status} />
        <span className={'sup-saved' + (saved === 'Saved' ? ' ok' : '')}>{saved}</span>
        <span style={{ flex: 1 }} />
        {!readOnly && <SupBtn sm kind="pri" onClick={() => setQuickAdd(true)}><Ic d={I.plus} s={14} />Add Patient</SupBtn>}
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
          <div className="sup-fld"><label>Shift Time</label>
            {(() => {
              // Dropdown of the selected shift's roster timings (+ General, always available).
              const opts = (SHIFT_LEGEND[rep.shift] || []).concat(SHIFT_LEGEND.General);
              const known = opts.some(([, t]) => t === rep.shiftTime);
              return (
                <select value={rep.shiftTime} onChange={(e) => edit({ shiftTime: e.target.value })} disabled={readOnly}>
                  <option value="">Select shift time…</option>
                  {rep.shift && SHIFT_LEGEND[rep.shift] && (
                    <optgroup label={rep.shift + ' shift'}>
                      {SHIFT_LEGEND[rep.shift].map(([code, t]) => <option key={code + t} value={t}>{code} · {t}</option>)}
                    </optgroup>
                  )}
                  <optgroup label="General">
                    {SHIFT_LEGEND.General.map(([code, t]) => <option key={code + t} value={t}>{code} · {t}</option>)}
                  </optgroup>
                  {rep.shiftTime && !known && <option value={rep.shiftTime}>{rep.shiftTime}</option>}
                </select>
              );
            })()}
          </div>
          <div className="sup-fld"><label>Name of Nursing Supervisor</label><SugInput field="supervisorName" value={rep.supervisorName} onChange={(v) => edit({ supervisorName: v })} disabled={readOnly} /></div>
        </div>
        {!readOnly && <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <SupBtn sm onClick={() => setCarryOpen(true)}><Ic d={I.download} s={14} />Carry forward from a shift…</SupBtn>
          <SupBtn sm onClick={importAllActive}><Ic d={I.layers} s={14} />Carry forward ALL active patients</SupBtn>
          <SupBtn sm onClick={() => setRoute({ view: 'supBoard' })}><Ic d={I.grid} s={14} />Open Patient Board</SupBtn>
        </div>}
      </div></div>

      {/* KPI row */}
      <div className="sup-kpis">
        <div className="sup-kpi"><div className="n">{totals.newAdmission}</div><div className="l">New Admissions</div></div>
        <div className="sup-kpi"><div className="n">{totals.discharge}</div><div className="l">Discharged</div></div>
        <div className="sup-kpi"><div className="n">{(rep.criticalArea || []).length}</div><div className="l">Critical-area patients</div></div>
        <div className="sup-kpi"><div className="n">{totals.death}</div><div className="l">Deaths</div></div>
      </div>

      {/* at-a-glance report status + section navigator */}
      <div className="sup-card"><div className="sup-card-b">
        <div className="sup-statushead">
          <div>
            <div className="sup-statust">Report Status</div>
            <div className="sup-statuss">{filledCount} of {secMeta.length} sections filled · {allPatients.length} patients logged</div>
          </div>
          <div className="sup-statuspct" style={{ color: pct >= 66 ? '#15803d' : pct >= 33 ? '#b45309' : '#64748b' }}>{pct}%</div>
        </div>
        <div className="sup-prog"><div className="sup-prog-bar" style={{ width: pct + '%', background: pct >= 66 ? '#16a34a' : pct >= 33 ? '#f59e0b' : '#2563eb' }} /></div>
        <div className="sup-navgrid">
          {secMeta.map((m) => { const n = countOf(m); return (
            <button key={m.key} className={'sup-navitem' + (n > 0 ? ' filled' : '')} onClick={() => go(m.key)} title={m.title}>
              <span className="dot" /><span className="t">{m.title}</span>{n > 0 && <span className="n">{n}</span>}
            </button>
          ); })}
        </div>
        {!readOnly && <div style={{ marginTop: 11, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <SupBtn sm onClick={expandAll}><Ic d={I.layers} s={13} />Expand all</SupBtn>
          <SupBtn sm onClick={collapseAll}><Ic d={I.x} s={13} />Collapse all</SupBtn>
          <SupBtn sm kind="pri" onClick={() => setQuickAdd(true)}><Ic d={I.plus} s={13} />Add Patient</SupBtn>
        </div>}
      </div></div>

      {/* consolidated patient list */}
      <div className="sup-group">Overview</div>
      <SecCard anchor="sup-sec-allPatients" title="All Patients in this Report — Details" count={allPatients.length}
        open={!!open.allPatients} onToggle={() => setOpen((o) => ({ ...o, allPatients: !o.allPatients }))}>
        {allPatients.length === 0 ? <div style={{ color: '#94a3b8', fontSize: 12.5 }}>No patients added yet. Use “Add Patient”.</div> : (
          <div className="sup-tblwrap"><table className="sup-tbl" style={{ minWidth: 720 }}>
            <thead><tr><th style={{ width: 34 }}>#</th><th>Section</th><th>Dept / Bed</th><th>Name</th><th>UHID</th><th>Age</th><th>Consultant</th><th>Diagnosis</th></tr></thead>
            <tbody>{allPatients.map((p, i) => (
              <tr key={i}>
                <td data-label="#">{i + 1}</td>
                <td data-label="Section"><span className="sup-tag" style={{ background: '#eef2ff', color: '#3730a3' }}>{p.section}</span></td>
                <td data-label="Dept / Bed">{[p.dept, p.bed].filter(Boolean).join(' · ')}</td>
                <td data-label="Name"><b>{p.name || '—'}</b></td>
                <td data-label="UHID">{p.uhid || '—'}</td>
                <td data-label="Age">{p.age || '—'}</td>
                <td data-label="Consultant">{p.consultant || '—'}</td>
                <td data-label="Diagnosis" style={{ maxWidth: 220 }}>{p.diagnosis || '—'}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </SecCard>

      {/* row sections (grouped) */}
      {SUP_SECTIONS.map((s, idx) => {
        const grp = SEC_GROUP[s.key];
        const prev = idx > 0 ? SEC_GROUP[SUP_SECTIONS[idx - 1].key] : null;
        return (
          <React.Fragment key={s.key}>
            {grp && grp !== prev && <div className="sup-group">{grp}</div>}
            <SecCard anchor={'sup-sec-' + s.key} title={s.title} count={(rep[s.key] || []).length}
              open={!!open[s.key]} onToggle={() => setOpen((o) => ({ ...o, [s.key]: !o[s.key] }))}>
              <RowsEditor section={s} rows={rep[s.key]} deptNames={deptNames} readOnly={readOnly}
                onChange={(v) => editSec(s.key, v)} onLookup={lookupUhid} />
            </SecCard>
          </React.Fragment>
        );
      })}

      {/* scalar sections */}
      <div className="sup-group">Metrics &amp; Counts</div>
      <SecCard anchor="sup-sec-radiologyCounts" title="Radiology Counts" open={!!open.radiologyCounts} onToggle={() => setOpen((o) => ({ ...o, radiologyCounts: !o.radiologyCounts }))}>
        <ScalarFields fields={RADIOLOGY_FIELDS} val={rep.radiologyCounts} onChange={(v) => editSec('radiologyCounts', v)} readOnly={readOnly} sectionKey="radiologyCounts" />
      </SecCard>
      <SecCard anchor="sup-sec-erCensus" title="ER Census" open={!!open.erCensus} onToggle={() => setOpen((o) => ({ ...o, erCensus: !o.erCensus }))}>
        <ScalarFields fields={ER_FIELDS} val={rep.erCensus} onChange={(v) => editSec('erCensus', v)} readOnly={readOnly} sectionKey="erCensus" />
      </SecCard>
      <SecCard anchor="sup-sec-general" title="General Information" open={!!open.general} onToggle={() => setOpen((o) => ({ ...o, general: !o.general }))}>
        <ScalarFields fields={GENERAL_FIELDS} val={rep.general} onChange={(v) => editSec('general', v)} readOnly={readOnly} sectionKey="general" />
      </SecCard>
      <SecCard anchor="sup-sec-census" title="Department-wise Census" open={!!open.census} onToggle={() => setOpen((o) => ({ ...o, census: !o.census }))}>
        <CensusFields deptNames={deptNames} val={rep.census} onChange={(v) => editSec('census', v)} readOnly={readOnly} />
      </SecCard>

      {/* notes & sign-off */}
      <div className="sup-group">Notes &amp; Sign-off</div>
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

      {/* custom sections (at the bottom) */}
      <div className="sup-group">Custom Sections</div>
      {cfg.sections.map((cs) => (
        <SecCard key={cs.key} anchor={'sup-sec-' + cs.key} title={cs.title + '  · custom'} count={(rep[cs.key] || []).length}
          open={!!open[cs.key]} onToggle={() => setOpen((o) => ({ ...o, [cs.key]: !o[cs.key] }))}>
          <RowsEditor section={{ key: cs.key, title: cs.title, sn: true, cols: [] }} rows={rep[cs.key]} deptNames={deptNames} readOnly={readOnly}
            onChange={(v) => editSec(cs.key, v)} onLookup={lookupUhid} />
          {!readOnly && <div style={{ marginTop: 8 }}><SupBtn sm kind="dgr" onClick={() => removeCustomSection(cs.key)}><Ic d={I.x} s={13} />Delete section</SupBtn></div>}
        </SecCard>
      ))}
      {!readOnly && <div><SupBtn onClick={() => setAddSec(true)}><Ic d={I.plus} s={15} />Add Custom Section</SupBtn>
        <span style={{ fontSize: 11.5, color: 'var(--muted,#64748b)', marginLeft: 10 }}>Add a whole new titled section with its own custom fields.</span></div>}

      {/* floating quick-add */}
      {!readOnly && <button className="sup-fab" title="Add patient" onClick={() => setQuickAdd(true)}><Ic d={I.plus} s={24} c="#fff" /></button>}
      {quickAdd && <QuickAddModal deptNames={deptNames} onLookup={lookupUhid} onClose={() => setQuickAdd(false)} onAdd={addPatient} />}
      {carryOpen && <CarryForwardModal currentId={rep.id} currentRep={rep} onClose={() => setCarryOpen(false)}
        onImport={(patch, src, total) => {
          if (!total) { supToast('Nothing new to carry forward (all already listed).', 'info'); return; }
          edit(patch);
          setOpen((o) => { const n = { ...o }; Object.keys(patch).forEach((k) => { n[k] = true; }); return n; });
          supToast('Carried forward ' + total + ' entr(ies) from ' + src.date + ' · ' + src.shift + '.', 'success');
        }} />}
      {addSec && supPortal(
        <div className="sup-modal-bg" onClick={() => setAddSec(false)}>
          <div className="sup-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="sup-modal-h">
              <div className="sup-hero-ic" style={{ width: 36, height: 36, background: 'rgba(255,255,255,.18)' }}><Ic d={I.plus} s={18} c="#fff" /></div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 15 }}>Add Custom Section</div><div style={{ fontSize: 11.5, opacity: .9 }}>A new titled table you can add fields to</div></div>
              <button className="sup-modal-x" onClick={() => setAddSec(false)}><Ic d={I.x} s={16} c="#fff" /></button>
            </div>
            <div className="sup-modal-b">
              <div className="sup-fld"><label>Section name</label>
                <input autoFocus value={secName} onChange={(e) => setSecName(e.target.value)} placeholder='e.g. Isolation Patients, Handover Notes' onKeyDown={(e) => { if (e.key === 'Enter') createCustomSection(secName); }} />
              </div>
            </div>
            <div className="sup-modal-f"><SupBtn onClick={() => setAddSec(false)}>Cancel</SupBtn><span style={{ flex: 1 }} /><SupBtn kind="pri" onClick={() => createCustomSection(secName)}><Ic d={I.check} s={15} />Create section</SupBtn></div>
          </div>
        </div>
      )}
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
      <SupHero icon={I.doc} title="Report History" sub={list.length + ' report(s) · search, compare, duplicate & export'}
        right={<SupBtn sm kind="pri" onClick={() => setRoute({ view: 'supNew' })}><Ic d={I.plus} s={15} />New Report</SupBtn>} />

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
      <SupHero icon={I.grid} title="Supervisor Dashboard" sub={'Shift overview · ' + supTodayISO() + ' · current shift: ' + supCurrentShift()}
        right={<React.Fragment>
          <SupBtn sm onClick={() => setRoute({ view: 'supBoard' })}><Ic d={I.layers} s={14} />Patient Board</SupBtn>
          <SupBtn sm onClick={() => setRoute({ view: 'supHistory' })}>History</SupBtn>
        </React.Fragment>} />
      <div className="sup-startbar">
        <span className="sup-startbar-l">Start a report:</span>
        {SUP_SHIFTS.map((s) => <SupBtn key={s} sm kind={s === supCurrentShift() ? 'pri' : ''} onClick={() => setRoute({ view: 'supNew', shift: s })}><Ic d={I.plus} s={14} />{s}</SupBtn>)}
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
  { key: 'cabinArea', title: 'Patient in Cabin Areas', kind: 'rows' },
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
  const base = SUP_SEC_BY_KEY[section.key];
  const cfg = supLoadFields();
  const cols = ((base && base.cols) || []).concat(cfg.cols[section.key] || []);
  const sn = base ? base.sn : true;
  const disp = (c, v) => (c.type === 'check' ? (v ? '✓' : '') : (v == null ? '' : v));
  return (
    <table className="sup-rpt-tbl"><thead><tr>{sn && <th>S/N</th>}{cols.map((c) => <th key={c.id}>{c.label}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{sn && <td>{i + 1}</td>}{cols.map((c) => <td key={c.id}>{disp(c, r[c.id])}</td>)}</tr>)}</tbody></table>
  );
}
function RptCounts({ fields, val, sectionKey }) {
  val = val || {};
  const custom = (sectionKey && supLoadFields().cols[sectionKey]) || [];
  const all = fields.concat(custom.map((c) => [c.id, c.label, c.type]));
  const disp = (id, type) => (type === 'check' ? (val[id] ? '✓' : '') : (val[id] == null ? '' : val[id]));
  return <table className="sup-rpt-tbl"><tbody>{all.map((f) => <tr key={f[0]}><th style={{ width: '55%' }}>{f[1]}</th><td>{disp(f[0], f[2])}</td></tr>)}</tbody></table>;
}

function SupReportView({ id, depts, setRoute }) {
  const deptNames = useMemo(() => supDeptNames(depts), [depts]);
  const cfg = useFields();
  const rptSecs = useMemo(() => RPT_SECTIONS.concat((cfg.sections || []).map((s) => ({ key: s.key, title: s.title, kind: 'rows' }))), [cfg]);
  const [list, setList] = useState(null);
  const [rep, setRep] = useState(null);
  const [customize, setCustomize] = useState(false);
  const [disabled, setDisabled] = useState({});   // sections OFF; undefined => shown
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
    if (!keys) { setDisabled({}); return; }              // Full = everything on
    const d = {}; rptSecs.forEach((s) => { if (keys.indexOf(s.key) < 0) d[s.key] = true; }); setDisabled(d);
  };
  const isOn = (key) => !disabled[key];
  const toggleSec = (key) => setDisabled((m) => ({ ...m, [key]: !m[key] }));

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
  const activeSecs = rptSecs.filter((s) => isOn(s.key));

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
          return <div key={s.key}><div className="sup-sec-h">{s.title}</div><RptCounts fields={s.fields} val={rep[s.key]} sectionKey={s.key} /></div>;
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
      <SupHero icon={I.print} title="Generate Report" sub="One-click board-ready PDF · quick templates · custom sections" />
      <div className="sup-toolbar sup-sticky">
        <SupBtn sm onClick={() => setRoute({ view: 'supHistory' })}><Ic d={I.chevR} s={14} style={{ transform: 'rotate(180deg)' }} />Back</SupBtn>
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
            {rptSecs.map((s) => (
              <label key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600 }}>
                <input type="checkbox" checked={isOn(s.key)} onChange={() => toggleSec(s.key)} />{s.title}
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

// Inline edit of one patient straight from the Patient Board — loads the source
// report, edits the matching row, and saves it back (no full-report navigation).
function BoardEditModal({ patient, deptNames, onClose, onSaved }) {
  const [rep, setRep] = useState(null);
  const [idx, setIdx] = useState(-1);
  const [row, setRow] = useState(null);
  const [busy, setBusy] = useState(false);
  const cfg = useFields();
  useEffect(() => {
    if (!patient || !patient.repId) { setRow({ ...(patient || {}) }); return; }
    supApi.get('/api/supervisor-reports/' + patient.repId).then((j) => {
      if (j.ok && j.report) {
        const sec = patient.section || 'criticalArea';
        const arr = j.report[sec] || [];
        const i = arr.findIndex((r) => supPatKey(r) === patient.key);
        setRep(j.report); setIdx(i); setRow(i >= 0 ? { ...arr[i] } : { ...patient });
      }
    });
  }, [patient]);
  const set = (k, v) => setRow((r) => ({ ...r, [k]: v }));
  const save = async () => {
    if (!rep || idx < 0) { supToast('Could not locate the source row.', 'error'); return; }
    setBusy(true);
    const sec = patient.section;
    const arr = (rep[sec] || []).slice(); arr[idx] = { ...arr[idx], ...row };
    const j = await supApi.post('/api/supervisor-reports', { ...rep, [sec]: arr });
    setBusy(false);
    if (j.ok) { supToast('Patient updated.', 'success'); onSaved && onSaved(); onClose(); } else supToast('Save failed.', 'error');
  };
  if (!patient) return null;
  const custom = (rep && cfg.cols[patient.section]) || [];
  const f = (label, k, node) => <div className="sup-fld"><label>{label}</label>{node}</div>;
  return supPortal(
    <div className="sup-modal-bg" onClick={onClose}>
      <div className="sup-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sup-modal-h">
          <div className="sup-hero-ic" style={{ width: 36, height: 36, background: 'rgba(255,255,255,.18)' }}><Ic d={I.edit} s={17} c="#fff" /></div>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 15 }}>Edit Patient</div><div style={{ fontSize: 11.5, opacity: .9 }}>{rep ? (rep.date + ' · ' + rep.shift + ' report') : 'Loading…'}</div></div>
          <button className="sup-modal-x" onClick={onClose}><Ic d={I.x} s={16} c="#fff" /></button>
        </div>
        <div className="sup-modal-b">
          {!row ? <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Loading…</div> : (
            <div>
              <div className="sup-pcard-meta" style={{ marginBottom: 12 }}>
                {SUP_SEC_BY_KEY[patient.section] && <span>{SUP_SEC_BY_KEY[patient.section].title}</span>}
                {patient.critical && <span style={{ background: '#fee2e2', color: '#b91c1c' }}>Critical</span>}
                {supDaysSince(row.doa) != null && <span>{supDaysSince(row.doa)}d in hospital</span>}
                {patient.lastSeen && <span>Last update {patient.lastSeen.date} · {patient.lastSeen.shift}</span>}
              </div>
              <div className="sup-scalar">
                {f('UHID', 'uhid', <input value={row.uhid || ''} onChange={(e) => set('uhid', e.target.value)} />)}
                {f('Name of Patient', 'name', <SugInput field="name" value={row.name || ''} onChange={(v) => set('name', v)} />)}
                {f('Department', 'dept', <select value={row.dept || ''} onChange={(e) => set('dept', e.target.value)}><option value=""></option>{deptNames.concat(row.dept && deptNames.indexOf(row.dept) < 0 ? [row.dept] : []).map((n) => <option key={n} value={n}>{n}</option>)}</select>)}
                {f('Bed', 'bed', <SugInput field="bed" value={row.bed || ''} onChange={(v) => set('bed', v)} />)}
                {f('Age', 'age', <SugInput field="age" value={row.age || ''} onChange={(v) => set('age', v)} />)}
                {f('Consultant', 'consultant', <SugInput field="consultant" value={row.consultant || ''} onChange={(v) => set('consultant', v)} />)}
              </div>
              <div style={{ marginTop: 12 }}>{f('Diagnosis', 'diagnosis', <SugInput field="diagnosis" area value={row.diagnosis || ''} onChange={(v) => set('diagnosis', v)} />)}</div>
              <div className="sup-scalar" style={{ marginTop: 12 }}>{f('DOA (Date & Time)', 'doa', <DateTimeInput value={row.doa || ''} onChange={(v) => set('doa', v)} />)}</div>
              <div style={{ marginTop: 12 }}>{f('Remarks', 'remarks', <SugInput field="remarks" area value={row.remarks || ''} onChange={(v) => set('remarks', v)} />)}</div>
              {custom.length > 0 && <div style={{ marginTop: 14, borderTop: '1px dashed var(--line,#e5e7eb)', paddingTop: 12 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#7c3aed', marginBottom: 8 }}>Custom fields ◆</div>
                <div className="sup-scalar">{custom.map((c) => <div className="sup-fld" key={c.id}><label>{c.label}</label>
                  {c.type === 'num' ? <input type="number" value={row[c.id] || ''} onChange={(e) => set(c.id, e.target.value)} />
                    : c.type === 'date' ? <input type="date" value={row[c.id] || ''} onChange={(e) => set(c.id, e.target.value)} />
                    : c.type === 'datetime' ? <DateTimeInput value={row[c.id] || ''} onChange={(v) => set(c.id, v)} />
                    : c.type === 'check' ? <label style={{ display: 'flex', gap: 7, fontSize: 12.5, alignItems: 'center' }}><input type="checkbox" checked={!!row[c.id]} onChange={(e) => set(c.id, e.target.checked)} style={{ width: 18, height: 18 }} /> Yes</label>
                    : c.type === 'select' ? <select value={row[c.id] || ''} onChange={(e) => set(c.id, e.target.value)}><option value=""></option>{(c.options || []).map((o) => <option key={o} value={o}>{o}</option>)}</select>
                    : <input value={row[c.id] || ''} onChange={(e) => set(c.id, e.target.value)} />}
                </div>)}</div>
              </div>}
            </div>
          )}
        </div>
        <div className="sup-modal-f">
          <SupBtn onClick={onClose}>Cancel</SupBtn>
          {rep && patient.repId && <SupBtn onClick={() => setRoute && setRoute({ view: 'supNew', id: patient.repId })}>Open full report</SupBtn>}
          <span style={{ flex: 1 }} />
          <SupBtn kind="pri" onClick={save} disabled={busy || !rep || idx < 0}><Ic d={I.check} s={15} />{busy ? 'Saving…' : 'Save changes'}</SupBtn>
        </div>
      </div>
    </div>
  );
}

/* ================================================================= PATIENT BOARD */
function SupBoard({ depts, setRoute }) {
  const deptNames = useMemo(() => supDeptNames(depts), [depts]);
  const [list, setList] = useState(null);
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [mode, setMode] = useState('cards');
  const [editing, setEditing] = useState(null);
  const load = () => supApi.get('/api/supervisor-reports?limit=1000').then((j) => { if (j.ok) { setList(j.reports); supRefreshAlertBadge(j.reports); } });
  useEffect(() => { load(); }, []);
  if (!list) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted,#64748b)' }}>Loading patient board…</div>;

  const active = supActivePatients(list);
  const depSet = []; active.forEach((p) => { if (p.dept && depSet.indexOf(p.dept) < 0) depSet.push(p.dept); });
  depSet.sort();
  const ql = q.trim().toLowerCase();
  const filtered = active.filter((p) => {
    if (dept && p.dept !== dept) return false;
    if (ql) { const hay = (p.name + ' ' + p.uhid + ' ' + p.consultant + ' ' + p.diagnosis).toLowerCase(); if (hay.indexOf(ql) < 0) return false; }
    return true;
  });
  const byDept = {};
  filtered.forEach((p) => { const d = p.dept || 'Unassigned'; (byDept[d] = byDept[d] || []).push(p); });
  const groups = Object.keys(byDept).sort();

  return (
    <div className="sup-wrap">
      <SupHero icon={I.layers} title="Patient Board — At a Glance"
        sub={active.length + ' patient(s) currently present · carried forward automatically across shifts'}
        right={<React.Fragment>
          <SupBtn sm onClick={() => setRoute({ view: 'supNew', openAdd: true })}><Ic d={I.plus} s={15} />Add Patient</SupBtn>
          <SupBtn sm kind="pri" onClick={() => setRoute({ view: 'supNew' })}><Ic d={I.doc} s={15} />New Report</SupBtn>
        </React.Fragment>} />

      <div className="sup-kpis">
        <div className="sup-kpi"><div className="n">{active.length}</div><div className="l">Total patients present</div></div>
        <div className="sup-kpi"><div className="n">{active.filter((p) => p.critical).length}</div><div className="l">In critical areas</div></div>
        <div className="sup-kpi"><div className="n">{depSet.length}</div><div className="l">Departments occupied</div></div>
        <div className="sup-kpi"><div className="n">{filtered.length}</div><div className="l">Showing {dept ? '(' + dept + ')' : '(all)'}</div></div>
      </div>

      <div className="sup-toolbar">
        <div className="sup-search"><Ic d={I.search} s={15} c="#94a3b8" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, UHID, consultant, diagnosis…" /></div>
        <div className="sup-seg">
          <button className={mode === 'cards' ? 'on' : ''} onClick={() => setMode('cards')}><Ic d={I.grid} s={13} />Cards</button>
          <button className={mode === 'table' ? 'on' : ''} onClick={() => setMode('table')}><Ic d={I.doc} s={13} />Table</button>
        </div>
      </div>
      <div className="sup-chips">
        <span className={'sup-chip' + (dept === '' ? ' on' : '')} onClick={() => setDept('')}>All ({active.length})</span>
        {depSet.map((d) => <span key={d} className={'sup-chip' + (dept === d ? ' on' : '')} onClick={() => setDept(d)}>{d} ({active.filter((p) => p.dept === d).length})</span>)}
      </div>

      {filtered.length === 0 && <div className="sup-card"><div className="sup-card-b" style={{ textAlign: 'center', color: '#94a3b8', padding: 30 }}>No active patients{dept ? ' in ' + dept : ''}. They appear here from admissions/critical entries and drop off when discharged.</div></div>}

      {mode === 'table' && filtered.length > 0 && (
        <div className="sup-card"><div className="sup-card-b" style={{ padding: 0 }}>
          <div className="sup-tblwrap"><table className="sup-tbl" style={{ minWidth: 860 }}>
            <thead><tr><th style={{ width: 34 }}>#</th><th>Department</th><th>Bed</th><th>Name</th><th>UHID</th><th>Age</th><th>Days</th><th>Consultant</th><th>Diagnosis</th><th>Last update</th><th>Edit</th></tr></thead>
            <tbody>{filtered.map((p, i) => { const d = supDaysSince(p.doa); return (
              <tr key={p.key}>
                <td data-label="#">{i + 1}</td>
                <td data-label="Department">{p.dept || '—'}{p.critical && <span className="sup-tag crit" style={{ marginLeft: 6 }}>Crit</span>}</td>
                <td data-label="Bed">{p.bed || '—'}</td>
                <td data-label="Name"><b>{p.name || '—'}</b></td>
                <td data-label="UHID">{p.uhid || '—'}</td>
                <td data-label="Age">{p.age || '—'}</td>
                <td data-label="Days">{d != null ? d + 'd' : '—'}</td>
                <td data-label="Consultant">{p.consultant || '—'}</td>
                <td data-label="Diagnosis" style={{ maxWidth: 240 }}>{p.diagnosis || '—'}</td>
                <td data-label="Last update">{p.lastSeen.date} · {p.lastSeen.shift}</td>
                <td data-label="Edit"><button className="sup-ib" title="Edit patient" onClick={() => setEditing(p)}><Ic d={I.edit} s={13} /></button></td>
              </tr>
            ); })}</tbody>
          </table></div>
        </div></div>
      )}

      {mode === 'cards' && groups.map((g) => (
        <div key={g}>
          <div className="sup-board-dh"><span className="dot" />{g}<span className="n">{byDept[g].length}</span></div>
          <div className="sup-board">
            {byDept[g].map((p) => {
              const days = supDaysSince(p.doa);
              return (
                <div key={p.key} className={'sup-pcard' + (p.critical ? ' crit' : '')}>
                  <div className="sup-pcard-h">
                    <div className="sup-pcard-n">{p.name || '—'}</div>
                    {p.critical && <span className="sup-tag crit">Critical</span>}
                  </div>
                  <div className="sup-pcard-meta">
                    {p.uhid && <span>UHID {p.uhid}</span>}
                    {p.age && <span>{p.age}</span>}
                    {p.bed && <span>Bed {p.bed}</span>}
                    {days != null && <span>{days}d in hospital</span>}
                  </div>
                  {p.consultant && <div className="sup-pcard-row"><b>Consultant:</b> {p.consultant}</div>}
                  {p.diagnosis && <div className="sup-pcard-row"><b>Dx:</b> {p.diagnosis}</div>}
                  {p.remarks && <div className="sup-pcard-note">{p.remarks}</div>}
                  <div className="sup-pcard-foot">
                    <span className="sup-pcard-f">Updated {p.lastSeen.date} · {p.lastSeen.shift}</span>
                    <button className="sup-ib" title="Edit patient" onClick={() => setEditing(p)}><Ic d={I.edit} s={13} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {editing && <BoardEditModal patient={editing} deptNames={deptNames} setRoute={setRoute} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}

/* ================================================================= dispatcher */
function SupervisorView({ view, id, shift, openAdd, depts, setRoute }) {
  if (view === 'supHistory') return <SupHistory setRoute={setRoute} />;
  if (view === 'supReport') return <SupReportView id={id} depts={depts} setRoute={setRoute} />;
  if (view === 'supBoard') return <SupBoard depts={depts} setRoute={setRoute} />;
  if (view === 'supNew') return <SupEditor id={id} shift={shift} openAdd={openAdd} depts={depts} setRoute={setRoute} />;
  return <SupHome setRoute={setRoute} />;
}

/* ---------------- styles ---------------- */
const SUP_CSS = `
.sup-wrap{display:flex;flex-direction:column;gap:16px}
/* hero */
.sup-hero{display:flex;align-items:center;gap:14px;padding:18px 20px;border-radius:16px;
  background:linear-gradient(120deg,#1e3a8a 0%,#2563eb 55%,#0ea5e9 100%);color:#fff;
  box-shadow:0 10px 26px -12px rgba(37,99,235,.6)}
.sup-hero-ic{width:46px;height:46px;border-radius:13px;background:rgba(255,255,255,.16);
  display:flex;align-items:center;justify-content:center;flex:0 0 auto;backdrop-filter:blur(4px)}
.sup-hero-t{font-size:18px;font-weight:800;letter-spacing:-.2px;line-height:1.15}
.sup-hero-s{font-size:12.5px;opacity:.9;margin-top:3px;font-weight:500}
.sup-hero-r{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.sup-hero-r .sup-btn{background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.28);color:#fff}
.sup-hero-r .sup-btn:hover{background:rgba(255,255,255,.28)}
.sup-hero-r .sup-btn.pri{background:#fff;border-color:#fff;color:#1e3a8a}
.sup-hero-r .sup-btn.pri:hover{background:#eef2ff}
/* toolbar */
.sup-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.sup-sticky{padding:10px 12px;background:var(--panel,#fff);border:1px solid var(--line,#e5e7eb);border-radius:12px;box-shadow:0 1px 3px rgba(15,23,42,.05)}
.sup-startbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:var(--panel,#fff);border:1px solid var(--line,#e5e7eb);border-radius:12px;padding:12px 14px}
.sup-startbar-l{font-size:12.5px;font-weight:700;color:var(--muted,#64748b)}
.sup-saved{font-size:11.5px;font-weight:700;color:var(--muted,#94a3b8)}
.sup-saved.ok{color:#15803d}
/* cards */
.sup-card{background:var(--panel,#fff);border:1px solid var(--line,#e5e7eb);border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,.05)}
.sup-card-h{display:flex;align-items:center;gap:10px;padding:12px 15px;cursor:pointer;background:linear-gradient(0deg,#fbfdff,#fff);border-bottom:1px solid var(--line,#eef2f7);transition:.15s}
.sup-card-h:hover{background:#f5f8ff}
.sup-card-h h4{margin:0;font-size:13.5px;font-weight:700;flex:1;color:#0f172a}
.sup-count{background:#eef2f7;color:#64748b;border-radius:20px;padding:2px 11px;font-size:11px;font-weight:800}
.sup-count.on{background:#eef2ff;color:#3730a3}
.sup-card-b{padding:14px 15px}
/* active (open) section — clear color cue */
.sup-card.sup-open{border-color:#bfdbfe;box-shadow:0 0 0 3px rgba(37,99,235,.12),0 1px 3px rgba(15,23,42,.05)}
.sup-card.sup-open>.sup-card-h{background:linear-gradient(0deg,#eff6ff,#f5f9ff);border-bottom-color:#dbeafe}
.sup-card.sup-open>.sup-card-h h4{color:#1d4ed8}
.sup-card.sup-has:not(.sup-open){border-left:3px solid #93c5fd}
.sup-active-pill{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#1d4ed8;background:#dbeafe;padding:2px 8px;border-radius:20px}
/* section group eyebrow */
.sup-group{display:flex;align-items:center;gap:10px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:#94a3b8;margin:8px 2px 0}
.sup-group:before{content:'';width:14px;height:2px;border-radius:2px;background:#2563eb}
.sup-group:after{content:'';flex:1;height:1px;background:var(--line,#e5e7eb)}
/* tables */
.sup-tblwrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:10px}
.sup-tbl{width:100%;border-collapse:collapse;font-size:12px;min-width:640px}
.sup-tbl th,.sup-tbl td{border:1px solid var(--line,#e8edf3);padding:6px 7px;text-align:left;vertical-align:top}
.sup-tbl th{background:#f1f5f9;font-weight:700;font-size:11px;white-space:nowrap;color:#334155}
.sup-tbl tbody tr:hover td{background:#fafcff}
.sup-tbl input,.sup-tbl textarea,.sup-tbl select{width:100%;border:1px solid transparent;background:transparent;font:inherit;padding:4px;border-radius:6px;box-sizing:border-box;transition:.12s}
.sup-tbl input:hover,.sup-tbl textarea:hover,.sup-tbl select:hover{background:#f1f5f9}
.sup-tbl input:focus,.sup-tbl textarea:focus,.sup-tbl select:focus{border-color:#60a5fa;background:#fff;outline:none;box-shadow:0 0 0 3px rgba(96,165,250,.15)}
.sup-tbl textarea{resize:vertical;min-height:36px}
/* buttons */
.sup-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line,#d1d5db);background:#fff;border-radius:9px;padding:7px 12px;font-size:12.5px;font-weight:600;cursor:pointer;color:var(--ink,#111827);transition:.14s}
.sup-btn:hover{background:#f8fafc;border-color:#cbd5e1;transform:translateY(-1px)}
.sup-btn:active{transform:none}
.sup-btn:disabled{opacity:.55;cursor:default;transform:none}
.sup-btn.pri{background:#2563eb;border-color:#2563eb;color:#fff;box-shadow:0 6px 14px -6px rgba(37,99,235,.7)}
.sup-btn.pri:hover{background:#1d4ed8;border-color:#1d4ed8}
.sup-btn.dgr{color:#dc2626;border-color:#fecaca}
.sup-btn.dgr:hover{background:#fef2f2}
.sup-btn.sm{padding:5px 10px;font-size:11.5px}
.sup-rowdel{color:#dc2626;cursor:pointer;border:0;background:transparent;font-weight:700;font-size:13px;padding:2px 5px;border-radius:6px}
.sup-rowdel:hover{background:#fef2f2}
/* row action icon buttons + pinned (always-visible) Actions column */
.sup-ib{display:inline-flex;align-items:center;justify-content:center;width:25px;height:25px;border:1px solid var(--line,#e5e7eb);background:#fff;border-radius:7px;cursor:pointer;font-size:12px;color:#475569;margin:1px;line-height:1}
.sup-ib:hover{background:#f1f5f9;border-color:#93c5fd;color:#1d4ed8}
.sup-ib.danger{color:#dc2626;border-color:#fecaca}
.sup-ib.danger:hover{background:#fef2f2;border-color:#fca5a5;color:#dc2626}
.sup-tbl td.sup-actions{position:sticky;right:0;background:#fff;white-space:normal;min-width:126px;box-shadow:-7px 0 9px -7px rgba(15,23,42,.18)}
.sup-tbl tbody tr:hover td.sup-actions{background:#fafcff}
.sup-tbl thead th:last-child{position:sticky;right:0;background:#f1f5f9;z-index:3;box-shadow:-7px 0 9px -7px rgba(15,23,42,.18)}
/* fields */
.sup-scalar{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:12px}
.sup-fld label{display:block;font-size:11px;font-weight:700;color:var(--muted,#64748b);margin-bottom:4px;letter-spacing:.02em}
.sup-fld input,.sup-fld select,.sup-fld textarea{width:100%;border:1px solid var(--line,#d1d5db);border-radius:9px;padding:8px 10px;font:inherit;box-sizing:border-box;background:#fff;color:var(--ink,#111827);transition:.12s}
.sup-fld input:focus,.sup-fld select:focus,.sup-fld textarea:focus{border-color:#60a5fa;outline:none;box-shadow:0 0 0 3px rgba(96,165,250,.15)}
.sup-fld textarea{resize:vertical}
/* KPIs */
.sup-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));gap:13px}
.sup-kpi{position:relative;background:var(--panel,#fff);border:1px solid var(--line,#e5e7eb);border-radius:14px;padding:16px 17px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,.05)}
.sup-kpi:before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:#2563eb}
.sup-kpi:nth-child(2):before{background:#0ea5e9}
.sup-kpi:nth-child(3):before{background:#f59e0b}
.sup-kpi:nth-child(4):before{background:#ef4444}
.sup-kpi .n{font-size:28px;font-weight:800;line-height:1;color:#0f172a}
.sup-kpi .l{font-size:11.5px;color:var(--muted,#64748b);margin-top:6px;font-weight:600}
/* alerts */
.sup-alert{display:flex;align-items:center;gap:9px;padding:10px 13px;border-radius:11px;font-size:12.5px;font-weight:600;margin-bottom:8px}
.sup-alert.critical{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca}
.sup-alert.warn{background:#fffbeb;color:#b45309;border:1px solid #fde68a}
.sup-alert.info{background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe}
/* jump nav */
.sup-jump{display:flex;flex-wrap:wrap;gap:6px}
.sup-jump a{font-size:11.5px;padding:5px 11px;border-radius:20px;background:#eef2f7;color:#334155;cursor:pointer;font-weight:600;transition:.12s}
.sup-jump a:hover{background:#2563eb;color:#fff}
/* report status panel */
.sup-statushead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:9px}
.sup-statust{font-size:14px;font-weight:800;color:#0f172a}
.sup-statuss{font-size:11.5px;color:var(--muted,#64748b);font-weight:600;margin-top:2px}
.sup-statuspct{font-size:24px;font-weight:800;line-height:1}
.sup-prog{height:8px;border-radius:20px;background:#eef2f7;overflow:hidden;margin-bottom:12px}
.sup-prog-bar{height:100%;border-radius:20px;transition:width .3s ease}
.sup-navgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:7px}
.sup-navitem{display:flex;align-items:center;gap:7px;text-align:left;border:1px solid var(--line,#e5e7eb);background:#fff;border-radius:9px;padding:7px 10px;font-size:11.5px;font-weight:600;color:#475569;cursor:pointer;transition:.12s}
.sup-navitem:hover{border-color:#93c5fd;background:#f5f9ff}
.sup-navitem .dot{width:8px;height:8px;border-radius:50%;background:#cbd5e1;flex:0 0 auto}
.sup-navitem .t{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sup-navitem .n{background:#eef2ff;color:#3730a3;border-radius:20px;padding:1px 8px;font-size:10.5px;font-weight:800;flex:0 0 auto}
.sup-navitem.filled{border-color:#bbf7d0;background:#f0fdf4;color:#166534}
.sup-navitem.filled .dot{background:#22c55e}
/* status */
.sup-status{font-size:11px;font-weight:800;padding:3px 11px;border-radius:20px;text-transform:capitalize;display:inline-block}
.sup-status.draft{background:#f1f5f9;color:#475569}
.sup-status.submitted{background:#dbeafe;color:#1d4ed8}
.sup-status.approved{background:#dcfce7;color:#15803d}
/* search + chips */
.sup-search{display:flex;align-items:center;gap:8px;background:var(--panel,#fff);border:1px solid var(--line,#d1d5db);border-radius:10px;padding:8px 12px;min-width:230px;flex:1}
.sup-search input{border:0;outline:0;font:inherit;flex:1;background:transparent;color:var(--ink,#111827)}
.sup-chips{display:flex;gap:7px;flex-wrap:wrap}
.sup-chip{font-size:11.5px;font-weight:700;padding:6px 12px;border-radius:20px;background:#eef2f7;color:#334155;cursor:pointer;transition:.12s;border:1px solid transparent}
.sup-chip:hover{background:#e2e8f0}
.sup-chip.on{background:#2563eb;color:#fff}
.sup-legend{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:12px;padding-top:11px;border-top:1px dashed var(--line,#e5e7eb)}
.sup-legend-l{font-size:11.5px;font-weight:700;color:var(--muted,#64748b)}
/* patient board */
.sup-board-dh{display:flex;align-items:center;gap:9px;font-size:13.5px;font-weight:800;color:#0f172a;margin:6px 0 2px}
.sup-board-dh .dot{width:9px;height:9px;border-radius:50%;background:#2563eb}
.sup-board-dh .n{background:#eef2ff;color:#3730a3;border-radius:20px;padding:1px 10px;font-size:11px;font-weight:800}
.sup-board{display:grid;grid-template-columns:repeat(auto-fill,minmax(255px,1fr));gap:12px}
.sup-pcard{background:var(--panel,#fff);border:1px solid var(--line,#e5e7eb);border-left:4px solid #2563eb;border-radius:12px;padding:13px 14px;box-shadow:0 1px 3px rgba(15,23,42,.05);transition:.15s}
.sup-pcard:hover{box-shadow:0 8px 22px -12px rgba(15,23,42,.35);transform:translateY(-2px)}
.sup-pcard.crit{border-left-color:#ef4444;background:linear-gradient(0deg,#fff,#fff6f6)}
.sup-pcard-h{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
.sup-pcard-n{font-size:14px;font-weight:800;color:#0f172a;line-height:1.2}
.sup-tag{font-size:9.5px;font-weight:800;padding:2px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:.04em}
.sup-tag.crit{background:#fee2e2;color:#b91c1c}
.sup-pcard-meta{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:7px}
.sup-pcard-meta span{font-size:10.5px;font-weight:600;background:#f1f5f9;color:#475569;border-radius:6px;padding:2px 7px}
.sup-pcard-row{font-size:11.5px;color:#334155;margin-bottom:3px;line-height:1.35}
.sup-pcard-row b{color:#64748b;font-weight:700}
.sup-pcard-note{font-size:11px;color:#475569;background:#f8fafc;border-radius:8px;padding:7px 9px;margin-top:6px;max-height:70px;overflow:auto;line-height:1.4}
.sup-pcard-f{font-size:10px;color:#94a3b8;font-weight:600}
.sup-pcard-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px}
/* report preview */
.sup-paper{background:#e9edf2;padding:22px;border-radius:14px;overflow:auto}
.sup-paper .pdf-page{background:#fff;max-width:900px;margin:0 auto;box-shadow:0 8px 30px -8px rgba(0,0,0,.28);padding:28px 32px;box-sizing:border-box}
.sup-rpt-tbl{width:100%;border-collapse:collapse;font-size:10.5px;margin:3px 0 12px}
.sup-rpt-tbl th,.sup-rpt-tbl td{border:1px solid #cbd5e1;padding:3px 5px;text-align:left;vertical-align:top}
.sup-rpt-tbl th{background:#eef2f7;font-weight:700}
.sup-rpt-tbl tbody tr:nth-child(even) td{background:#fbfdff}
.sup-sec-h{font-size:12.5px;font-weight:800;margin:15px 0 5px;color:#0f172a;border-left:3px solid #2563eb;padding-left:8px}
/* drag handle + drop indicator */
.sup-grip{cursor:grab;color:#94a3b8;text-align:center;vertical-align:middle;width:26px}
.sup-grip:active{cursor:grabbing}
.sup-grip:hover{color:#2563eb;background:#eff6ff}
.sup-tbl tr.sup-drop td{border-top:2px solid #2563eb}
/* segmented toggle */
.sup-seg{display:inline-flex;background:#eef2f7;border-radius:9px;padding:3px;gap:2px}
.sup-seg button{display:inline-flex;align-items:center;gap:5px;border:0;background:transparent;font:inherit;font-size:12px;font-weight:700;color:#475569;padding:6px 12px;border-radius:7px;cursor:pointer}
.sup-seg button.on{background:#fff;color:#1d4ed8;box-shadow:0 1px 3px rgba(15,23,42,.12)}
/* suggestion dropdown */
.sup-sug-wrap{position:relative;width:100%}
.sup-sug-list{position:absolute;left:0;right:0;top:100%;z-index:40;background:#fff;border:1px solid #cbd5e1;border-radius:9px;box-shadow:0 12px 28px -8px rgba(15,23,42,.35);margin-top:3px;max-height:190px;overflow:auto;padding:4px}
.sup-sug-item{padding:7px 10px;font-size:12px;border-radius:6px;cursor:pointer;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sup-sug-item:hover{background:#eff6ff;color:#1d4ed8}
/* quick-add modal */
.sup-modal-bg{position:fixed;top:0;left:0;right:0;bottom:0;width:100vw;height:100vh;background:rgba(15,23,42,.55);backdrop-filter:blur(3px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px}
.sup-modal{width:100%;max-width:640px;max-height:90vh;display:flex;flex-direction:column;background:var(--panel,#fff);border-radius:16px;overflow:hidden;box-shadow:0 30px 70px -20px rgba(0,0,0,.55);animation:supPop .16s ease-out}
.sup-modal-b{overflow:auto}
@keyframes supPop{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
.sup-modal-h{display:flex;align-items:center;gap:12px;padding:16px 18px;color:#fff;background:linear-gradient(120deg,#1e3a8a,#2563eb)}
.sup-modal-x{border:0;background:rgba(255,255,255,.16);width:30px;height:30px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.sup-modal-x:hover{background:rgba(255,255,255,.28)}
.sup-modal-b{padding:18px}
.sup-modal-f{display:flex;align-items:center;gap:8px;padding:13px 18px;border-top:1px solid var(--line,#e5e7eb);background:var(--panel-2,#f8fafc);flex-wrap:wrap}
/* custom fields */
.sup-custom-dot{color:#7c3aed;font-size:8px;margin-left:4px;vertical-align:super}
/* date & time field: full-width text (shows the value) + small calendar button */
.sup-dt{position:relative;display:flex;gap:4px;align-items:center;width:100%}
.sup-dt-txt{flex:1;min-width:0;border:1px solid transparent;background:transparent;font:inherit;padding:4px;border-radius:6px}
.sup-dt-txt:hover{background:#f1f5f9}
.sup-dt-txt:focus{border-color:#60a5fa;background:#fff;outline:none;box-shadow:0 0 0 3px rgba(96,165,250,.15)}
.sup-dt-btn{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:1px solid #cbd5e1;border-radius:7px;color:#475569;background:#f8fafc;cursor:pointer}
.sup-dt-btn:hover{background:#eff6ff;border-color:#93c5fd;color:#1d4ed8}
.sup-dt-hidden{position:absolute;right:0;bottom:0;width:1px;height:1px;opacity:0;pointer-events:none}
.sup-fld .sup-dt-txt{border:1px solid var(--line,#d1d5db);border-radius:9px;padding:8px 10px;background:#fff}
.sup-fieldrow{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--line,#e5e7eb);border-radius:9px;margin-bottom:7px;font-size:12.5px;background:var(--panel-2,#f8fafc)}
.sup-fieldrow .sup-btn.sm{padding:3px 8px}
/* floating action button */
.sup-fab{position:fixed;right:26px;bottom:26px;z-index:60;width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;
  background:linear-gradient(135deg,#2563eb,#1e3a8a);color:#fff;box-shadow:0 12px 26px -8px rgba(37,99,235,.75);
  display:flex;align-items:center;justify-content:center;transition:.16s}
.sup-fab:hover{transform:translateY(-3px) scale(1.05);box-shadow:0 18px 34px -10px rgba(37,99,235,.8)}
/* responsive: tables collapse to cards */
@media (max-width:820px){
  .sup-fab{right:16px;bottom:16px}
  .sup-hero{flex-wrap:wrap}
  .sup-tbl{min-width:0}
  .sup-tbl thead{display:none}
  .sup-tbl tr{display:block;border:1px solid var(--line,#e5e7eb);border-radius:10px;margin-bottom:10px;padding:5px;background:#fff}
  .sup-tbl tbody tr:hover td{background:transparent}
  .sup-tbl td{display:flex;gap:8px;border:0;border-bottom:1px solid #f1f5f9;padding:7px 5px;align-items:flex-start}
  .sup-tbl td:last-child{border-bottom:0}
  .sup-tbl td:before{content:attr(data-label);flex:0 0 42%;font-weight:700;font-size:11px;color:#64748b}
  .sup-tbl td:empty{display:none}
}`;
(function injectSupCss() { try { if (typeof document === 'undefined' || document.getElementById('sup-css')) return; const st = document.createElement('style'); st.id = 'sup-css'; st.textContent = SUP_CSS; document.head.appendChild(st); } catch (e) {} })();

Object.assign(window, { SupervisorView, SupReports: SupervisorView });
