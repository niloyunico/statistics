/* ===== supervisor.jsx ===== */
(function(){
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState,
  useEffect,
  useMemo,
  useRef
} = React;
const Ic = window.Ic,
  I = window.I;
const supNum = v => {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};
const supToast = (m, t) => {
  try {
    window.UI && window.UI.toast && window.UI.toast(m, t || 'success');
  } catch (e) {}
};
const supApi = {
  get: u => fetch(u, {
    headers: {
      accept: 'application/json'
    }
  }).then(r => r.json()),
  post: (u, b) => fetch(u, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(b || {})
  }).then(r => r.json()),
  del: u => fetch(u, {
    method: 'DELETE'
  }).then(r => r.json())
};
const SUP_SHIFTS = ['Morning', 'Evening', 'Night'];
function supPortal(node) {
  try {
    if (typeof document !== 'undefined' && typeof ReactDOM !== 'undefined' && ReactDOM.createPortal) return ReactDOM.createPortal(node, document.body);
  } catch (e) {}
  return node;
}
const SHIFT_LEGEND = {
  General: [['G1', '9:00 AM - 5:00 PM'], ['G2', '10:00 AM - 6:00 PM'], ['G3', '8:00 AM - 4:00 PM'], ['G4', '11:00 AM - 7:00 PM']],
  Morning: [['M1', '7:00 AM - 3:00 PM'], ['M2', '6:00 AM - 2:00 PM'], ['M3', '8:00 AM - 8:00 PM'], ['M4', '8:00 AM - 2:00 PM'], ['M6', '8:00 AM - 3:00 PM'], ['M7', '7:00 AM - 2:00 PM'], ['M8', '10:00 AM - 10:00 PM'], ['M11', '7:00 AM - 2:00 PM']],
  Evening: [['E1', '12:00 PM - 8:00 PM'], ['E2', '1:00 PM - 9:00 PM'], ['E3', '2:00 PM - 10:00 PM'], ['E4', '2:00 PM - 8:00 PM'], ['E6', '3:00 PM - 10:00 PM'], ['E10', '4:00 PM - 10:00 PM'], ['E11', '2:00 PM - 9:00 PM']],
  Night: [['N1', '9:00 PM - 7:00 AM'], ['N2', '8:00 PM - 8:00 AM'], ['N3', '9:00 PM - 9:00 AM'], ['N4', '10:00 PM - 8:00 AM'], ['N5', '10:00 PM - 7:00 AM'], ['N6', '11:00 PM - 7:00 AM'], ['N7', '7:00 PM - 7:00 AM'], ['N11', '9:00 PM - 7:00 AM'], ['DN1', '12:00 PM - next 8:00 AM']]
};
function supTodayISO() {
  try {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  } catch (e) {
    return '';
  }
}
function supCurrentShift() {
  try {
    const h = new Date().getHours();
    if (h >= 6 && h < 14) return 'Morning';
    if (h >= 14 && h < 21) return 'Evening';
    return 'Night';
  } catch (e) {
    return 'Night';
  }
}
function supIsAdmin() {
  try {
    const u = window.__UNICO_USER__;
    return !u || u.role === 'Administrator';
  } catch (e) {
    return true;
  }
}
function supDeptNames(depts) {
  try {
    const m = window.DEPTMAP;
    if (m && m.patientDeptIds) {
      const ids = m.patientDeptIds();
      if (ids && ids.length) return ids.map(id => m.nameFromId(id));
    }
  } catch (e) {}
  return (depts || []).map(d => d.name).filter(Boolean);
}
const SUP_SUG_KEY = 'unico_sup_suggestions_v1';
function supLoadSug() {
  try {
    const s = JSON.parse(localStorage.getItem(SUP_SUG_KEY));
    return s && typeof s === 'object' ? s : {};
  } catch (e) {
    return {};
  }
}
function supRememberField(field, val) {
  val = String(val == null ? '' : val).trim();
  if (!field || field === 'uhid' || !val || val.length > 160) return;
  try {
    const s = supLoadSug();
    const arr = (s[field] || []).filter(x => x.toLowerCase() !== val.toLowerCase());
    arr.unshift(val);
    s[field] = arr.slice(0, 60);
    localStorage.setItem(SUP_SUG_KEY, JSON.stringify(s));
    window.dispatchEvent(new Event('unico:sup-sug'));
  } catch (e) {}
}
function useSug() {
  const [sug, setSug] = useState(() => supLoadSug());
  useEffect(() => {
    const h = () => setSug(supLoadSug());
    window.addEventListener('unico:sup-sug', h);
    return () => window.removeEventListener('unico:sup-sug', h);
  }, []);
  return sug;
}
function SugInput({
  value,
  onChange,
  onCommit,
  field,
  area,
  type,
  placeholder,
  rows,
  disabled
}) {
  const sug = useSug();
  const [foc, setFoc] = useState(false);
  const v = value || '';
  const pool = sug[field] || [];
  const list = (v ? pool.filter(x => x.toLowerCase().indexOf(String(v).toLowerCase()) >= 0 && x.toLowerCase() !== String(v).toLowerCase()) : pool).slice(0, 7);
  const blur = () => {
    window.setTimeout(() => setFoc(false), 140);
    supRememberField(field, v);
    if (onCommit) onCommit();
  };
  const common = {
    value: v,
    onChange: e => onChange(e.target.value),
    onFocus: () => setFoc(true),
    onBlur: blur,
    placeholder,
    disabled
  };
  return React.createElement("div", {
    className: "sup-sug-wrap"
  }, area ? React.createElement("textarea", _extends({
    rows: rows || 2
  }, common)) : React.createElement("input", _extends({
    type: type || 'text'
  }, common)), foc && !disabled && list.length > 0 && React.createElement("div", {
    className: "sup-sug-list"
  }, list.map(s => React.createElement("div", {
    key: s,
    className: "sup-sug-item",
    onMouseDown: e => {
      e.preventDefault();
      onChange(s);
      setFoc(false);
    }
  }, s))));
}
const SUP_CLIP_KEY = 'unico_sup_rowclip_v1';
function supSetClip(row) {
  try {
    localStorage.setItem(SUP_CLIP_KEY, JSON.stringify(row || {}));
    window.dispatchEvent(new Event('unico:sup-clip'));
  } catch (e) {}
}
function supGetClip() {
  try {
    const r = JSON.parse(localStorage.getItem(SUP_CLIP_KEY));
    return r && typeof r === 'object' ? r : null;
  } catch (e) {
    return null;
  }
}
function useClip() {
  const [c, setC] = useState(() => supGetClip());
  useEffect(() => {
    const h = () => setC(supGetClip());
    window.addEventListener('unico:sup-clip', h);
    return () => window.removeEventListener('unico:sup-clip', h);
  }, []);
  return c;
}
const SUP_FIELDS_KEY = 'unico_sup_fields_v1';
const SUP_FTYPES = [['text', 'Text'], ['area', 'Long text'], ['num', 'Number'], ['date', 'Date'], ['select', 'Dropdown'], ['check', 'Checkbox']];
function supLoadFields() {
  try {
    const s = JSON.parse(localStorage.getItem(SUP_FIELDS_KEY));
    return {
      cols: s && s.cols || {},
      sections: s && Array.isArray(s.sections) ? s.sections : []
    };
  } catch (e) {
    return {
      cols: {},
      sections: []
    };
  }
}
function supSaveFields(cfg) {
  try {
    localStorage.setItem(SUP_FIELDS_KEY, JSON.stringify(cfg));
    window.dispatchEvent(new Event('unico:sup-fields'));
  } catch (e) {}
}
function supFieldId() {
  return 'c_' + Date.now().toString(36) + Math.floor(Math.random() * 1e5).toString(36);
}
function useFields() {
  const [f, setF] = useState(() => supLoadFields());
  useEffect(() => {
    const h = () => setF(supLoadFields());
    window.addEventListener('unico:sup-fields', h);
    return () => window.removeEventListener('unico:sup-fields', h);
  }, []);
  return f;
}
function FieldManagerModal({
  sectionKey,
  sectionTitle,
  onClose
}) {
  const cfg = useFields();
  const cols = cfg.cols[sectionKey] || [];
  const [label, setLabel] = useState('');
  const [type, setType] = useState('text');
  const [options, setOptions] = useState('');
  const persist = nextCols => {
    const next = {
      cols: {
        ...cfg.cols,
        [sectionKey]: nextCols
      },
      sections: cfg.sections
    };
    supSaveFields(next);
  };
  const add = () => {
    const lb = label.trim();
    if (!lb) {
      supToast('Enter a field name.', 'info');
      return;
    }
    const col = {
      id: supFieldId(),
      label: lb,
      type,
      custom: true
    };
    if (type === 'select') col.options = options.split(',').map(s => s.trim()).filter(Boolean);
    persist([...cols, col]);
    setLabel('');
    setOptions('');
    setType('text');
    supToast('Field “' + lb + '” added.', 'success');
  };
  const remove = id => persist(cols.filter(c => c.id !== id));
  const moveCol = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= cols.length) return;
    const c = cols.slice();
    const [m] = c.splice(i, 1);
    c.splice(j, 0, m);
    persist(c);
  };
  return supPortal(React.createElement("div", {
    className: "sup-modal-bg",
    onClick: onClose
  }, React.createElement("div", {
    className: "sup-modal",
    onClick: e => e.stopPropagation(),
    style: {
      maxWidth: 560
    }
  }, React.createElement("div", {
    className: "sup-modal-h"
  }, React.createElement("div", {
    className: "sup-hero-ic",
    style: {
      width: 36,
      height: 36,
      background: 'rgba(255,255,255,.18)'
    }
  }, React.createElement(Ic, {
    d: I.gear,
    s: 18,
    c: "#fff"
  })), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 800,
      fontSize: 15
    }
  }, "Custom Fields"), React.createElement("div", {
    style: {
      fontSize: 11.5,
      opacity: .9
    }
  }, sectionTitle)), React.createElement("button", {
    className: "sup-modal-x",
    onClick: onClose
  }, React.createElement(Ic, {
    d: I.x,
    s: 16,
    c: "#fff"
  }))), React.createElement("div", {
    className: "sup-modal-b"
  }, cols.length > 0 ? React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, cols.map((c, i) => React.createElement("div", {
    key: c.id,
    className: "sup-fieldrow"
  }, React.createElement("span", {
    className: "sup-tag",
    style: {
      background: '#eef2ff',
      color: '#3730a3'
    }
  }, (SUP_FTYPES.find(t => t[0] === c.type) || ['', 'Text'])[1]), React.createElement("b", {
    style: {
      flex: 1
    }
  }, c.label), c.options && c.options.length ? React.createElement("span", {
    style: {
      fontSize: 10.5,
      color: '#94a3b8'
    }
  }, c.options.join(', ')) : null, React.createElement("button", {
    className: "sup-btn sm",
    onClick: () => moveCol(i, -1),
    title: "Move up",
    disabled: i === 0
  }, "\u2191"), React.createElement("button", {
    className: "sup-btn sm",
    onClick: () => moveCol(i, 1),
    title: "Move down",
    disabled: i === cols.length - 1
  }, "\u2193"), React.createElement("button", {
    className: "sup-btn sm dgr",
    onClick: () => remove(c.id)
  }, "Remove")))) : React.createElement("div", {
    style: {
      color: '#94a3b8',
      fontSize: 12.5,
      marginBottom: 14
    }
  }, "No custom fields yet. Add one below."), React.createElement("div", {
    style: {
      borderTop: '1px dashed var(--line,#e5e7eb)',
      paddingTop: 14
    }
  }, React.createElement("div", {
    className: "sup-scalar"
  }, React.createElement("div", {
    className: "sup-fld",
    style: {
      gridColumn: 'span 2'
    }
  }, React.createElement("label", null, "New field name"), React.createElement("input", {
    value: label,
    onChange: e => setLabel(e.target.value),
    placeholder: "e.g. Allergy, MRN, Isolation\u2026",
    onKeyDown: e => {
      if (e.key === 'Enter') add();
    }
  })), React.createElement("div", {
    className: "sup-fld"
  }, React.createElement("label", null, "Type"), React.createElement("select", {
    value: type,
    onChange: e => setType(e.target.value)
  }, SUP_FTYPES.map(([k, l]) => React.createElement("option", {
    key: k,
    value: k
  }, l))))), type === 'select' && React.createElement("div", {
    className: "sup-fld",
    style: {
      marginTop: 10
    }
  }, React.createElement("label", null, "Options (comma-separated)"), React.createElement("input", {
    value: options,
    onChange: e => setOptions(e.target.value),
    placeholder: "Yes, No, N/A"
  })))), React.createElement("div", {
    className: "sup-modal-f"
  }, React.createElement(SupBtn, {
    onClick: onClose
  }, "Done"), React.createElement("span", {
    style: {
      flex: 1
    }
  }), React.createElement(SupBtn, {
    kind: "pri",
    onClick: add
  }, React.createElement(Ic, {
    d: I.plus,
    s: 15
  }), "Add field")))));
}
const C = {
  dept: {
    id: 'dept',
    label: 'Department',
    type: 'select',
    w: 120
  },
  bed: {
    id: 'bed',
    label: 'Bed',
    w: 70
  },
  name: {
    id: 'name',
    label: 'Name of Patient',
    w: 130
  },
  age: {
    id: 'age',
    label: 'Age',
    w: 70
  },
  uhid: {
    id: 'uhid',
    label: 'UHID',
    w: 90,
    lookup: true
  },
  consultant: {
    id: 'consultant',
    label: 'Consultant',
    w: 120
  },
  diagnosis: {
    id: 'diagnosis',
    label: 'Diagnosis',
    type: 'area',
    w: 150
  },
  doa: {
    id: 'doa',
    label: 'DOA (Date & Time)',
    type: 'datetime',
    w: 140
  }
};
function supFmtDT(v) {
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    const p = n => String(n).padStart(2, '0');
    let h = d.getHours();
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(h) + ':' + p(d.getMinutes()) + ' ' + ap;
  } catch (e) {
    return v;
  }
}
function DateTimeInput({
  value,
  onChange,
  disabled
}) {
  const ref = useRef(null);
  const openPicker = () => {
    const el = ref.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch (e) {
      el.focus();
    }
  };
  return React.createElement("div", {
    className: "sup-dt"
  }, React.createElement("input", {
    className: "sup-dt-txt",
    value: value || '',
    onChange: e => onChange(e.target.value),
    placeholder: "DD/MM/YYYY hh:mm AM/PM",
    disabled: disabled
  }), !disabled && React.createElement(React.Fragment, null, React.createElement("button", {
    type: "button",
    className: "sup-dt-btn",
    title: "Pick date & time",
    onClick: openPicker
  }, React.createElement(Ic, {
    d: I.cal,
    s: 15
  })), React.createElement("input", {
    ref: ref,
    type: "datetime-local",
    className: "sup-dt-hidden",
    tabIndex: -1,
    onChange: e => {
      if (e.target.value) onChange(supFmtDT(e.target.value));
    }
  })));
}
const SUP_SECTIONS = [{
  key: 'newAdmissions',
  title: 'New Admission',
  sn: true,
  cols: [C.dept, C.bed, C.name, C.age, C.uhid, C.consultant, C.diagnosis, C.doa, {
    id: 'remarks',
    label: 'Remarks',
    type: 'area',
    w: 200
  }]
}, {
  key: 'criticalArea',
  title: 'Patient in Critical Areas',
  sn: true,
  cols: [C.dept, C.bed, C.name, C.age, C.uhid, C.consultant, C.diagnosis, C.doa, {
    id: 'remarks',
    label: 'Remarks',
    type: 'area',
    w: 200
  }]
}, {
  key: 'cabinArea',
  title: 'Patient in Cabin Areas',
  sn: true,
  cols: [C.dept, C.bed, C.name, C.age, C.uhid, C.consultant, C.diagnosis, C.doa, {
    id: 'remarks',
    label: 'Remarks',
    type: 'area',
    w: 200
  }]
}, {
  key: 'lama',
  title: 'LAMA / DAMA',
  sn: true,
  cols: [C.dept, C.name, C.age, C.uhid, C.consultant, C.diagnosis, C.doa, {
    id: 'reasonDama',
    label: 'Reason for DAMA',
    type: 'area',
    w: 150
  }, {
    id: 'billing',
    label: 'Billing Clearance',
    w: 90
  }]
}, {
  key: 'discharged',
  title: 'Discharged',
  sn: true,
  cols: [C.dept, C.name, C.age, C.uhid, C.consultant, C.diagnosis, C.doa, {
    id: 'billing',
    label: 'Billing Clearance',
    w: 90
  }]
}, {
  key: 'otTable',
  title: 'OT (Operation Theatre)',
  sn: true,
  cols: [{
    id: 'ot',
    label: 'OT',
    w: 90
  }, {
    id: 'planned',
    label: 'Planned Cases',
    type: 'num'
  }, {
    id: 'added',
    label: 'Added / Emergency',
    type: 'num'
  }, {
    id: 'cancelledReason',
    label: 'Reason of Cancelled',
    type: 'area',
    w: 150
  }, {
    id: 'total',
    label: 'Total Cases',
    type: 'num'
  }, {
    id: 'billing',
    label: 'Billing Status',
    w: 100
  }]
}, {
  key: 'surgeries',
  title: 'Surgery Details',
  sn: true,
  cols: [{
    id: 'name',
    label: 'Name of Patient',
    w: 120
  }, {
    id: 'surgery',
    label: 'Name of Surgery',
    w: 130
  }, {
    id: 'surgeon',
    label: 'Surgeon',
    w: 120
  }, {
    id: 'anaesthetist',
    label: 'Anesthesiologist',
    w: 120
  }, {
    id: 'anaesthesia',
    label: 'Type of Anesthesia',
    w: 90
  }, {
    id: 'note',
    label: 'Special Note',
    type: 'area',
    w: 140
  }]
}, {
  key: 'interventional',
  title: 'Interventional Procedure (Cath Lab, Endoscopy, Dialysis etc.)',
  sn: true,
  cols: [C.dept, C.name, C.age, C.uhid, C.consultant, {
    id: 'procedure',
    label: 'Name of Procedure',
    w: 130
  }, {
    id: 'bed',
    label: 'Bed No',
    w: 70
  }, {
    id: 'remarks',
    label: 'Remarks',
    type: 'area',
    w: 150
  }]
}, {
  key: 'radiological',
  title: 'Radiological Interventional Procedure',
  sn: true,
  cols: [C.dept, C.name, C.age, C.uhid, {
    id: 'procedure',
    label: 'Name of Procedure',
    w: 130
  }, {
    id: 'bed',
    label: 'Bed No',
    w: 70
  }]
}, {
  key: 'ventilators',
  title: 'Ventilator Status',
  sn: false,
  cols: [{
    id: 'type',
    label: 'Type of Ventilation',
    w: 150
  }, {
    id: 'adult',
    label: 'Adult',
    type: 'num'
  }, {
    id: 'ped',
    label: 'Pediatric',
    type: 'num'
  }, {
    id: 'total',
    label: 'Total',
    type: 'num'
  }, C.dept, {
    id: 'inUse',
    label: 'In Use',
    type: 'num'
  }, {
    id: 'standby',
    label: 'Stand By',
    type: 'num'
  }, {
    id: 'remarks',
    label: 'Remarks',
    w: 120
  }]
}, {
  key: 'pressureSore',
  title: 'Patients with Pressure Sore',
  sn: true,
  cols: [C.name, C.age, {
    id: 'bed',
    label: 'Bed No',
    w: 90
  }, C.diagnosis, C.consultant, {
    id: 'stage',
    label: 'Stage of Ulceration',
    w: 110
  }, {
    id: 'remarks',
    label: 'Remarks',
    type: 'area',
    w: 150
  }]
}, {
  key: 'phlebitis',
  title: 'Patients with Phlebitis',
  sn: true,
  cols: [C.name, C.age, {
    id: 'bed',
    label: 'Bed No',
    w: 90
  }, C.diagnosis, C.consultant, {
    id: 'vipScore',
    label: 'VIP Score',
    w: 80
  }, {
    id: 'remarks',
    label: 'Remarks',
    type: 'area',
    w: 150
  }]
}];
const SUP_SEC_BY_KEY = SUP_SECTIONS.reduce((m, s) => (m[s.key] = s, m), {});
const SEC_GROUP = {
  newAdmissions: 'Inpatient Lists',
  criticalArea: 'Inpatient Lists',
  cabinArea: 'Inpatient Lists',
  lama: 'Admissions & Movements',
  discharged: 'Admissions & Movements',
  otTable: 'Procedures & Surgery',
  surgeries: 'Procedures & Surgery',
  interventional: 'Procedures & Surgery',
  radiological: 'Procedures & Surgery',
  ventilators: 'Clinical Status',
  pressureSore: 'Patient Safety Registers',
  phlebitis: 'Patient Safety Registers'
};
const RADIOLOGY_FIELDS = [['xray', 'X-ray', 'num'], ['usg', 'USG', 'num'], ['ct', 'CT-Scan', 'num'], ['mri', 'MRI', 'num'], ['bmd', 'BMD', 'num'], ['mammogram', 'Mammogram', 'num'], ['ecg', 'ECG', 'num'], ['echo', 'Echo', 'num'], ['uroflow', 'Uroflometry', 'num']];
const ER_FIELDS = [['total', 'Total Patient', 'num'], ['admission', 'Admission', 'num'], ['discharged', 'Discharged', 'num'], ['lama', 'LAMA', 'num'], ['daycare', 'Daycare', 'num'], ['bid', 'BID', 'num'], ['present', 'Present Patient', 'num'], ['refused', 'Refused', 'num'], ['death', 'Death', 'num']];
const GENERAL_FIELDS = [['pickUp', 'Pick Up', 'text'], ['drop', 'Drop', 'text'], ['nvd', 'Birth — NVD', 'num'], ['cs', 'Birth — CS', 'num'], ['death', 'Death', 'num'], ['broughtDead', 'Brought Dead', 'num'], ['codeBlue', 'Code Blue', 'num'], ['patientComplaint', 'Patient Complaint', 'num'], ['medError', 'Med. Error', 'num'], ['doctorComplaint', "Doctors' complaint", 'num'], ['nearMiss', 'Near Miss & Incident', 'num'], ['hoToError', 'H/O & T/O Error', 'num'], ['sampleError', 'Sample Error', 'num'], ['patientFall', 'No. of Patient Fall', 'num'], ['bloodTransfusion', 'Blood Transfusion (Bed No)', 'text'], ['adr', 'ADR', 'num'], ['plannedDischarge', 'Planned Discharges', 'num'], ['vipAdmitted', 'VIP Admitted', 'text'], ['vipVisits', 'VIP Visits', 'text'], ['employeeAdmitted', 'Hospital Employee Admitted', 'text']];
const ALERT_FIELDS = [['codeBlue', 'Code Blue', 'critical'], ['death', 'Death', 'critical'], ['broughtDead', 'Brought Dead', 'critical'], ['patientFall', 'Patient Fall', 'critical'], ['medError', 'Medication Error', 'critical'], ['nearMiss', 'Near Miss / Incident', 'warn'], ['sampleError', 'Sample Error', 'warn'], ['hoToError', 'H/O & T/O Error', 'warn'], ['patientComplaint', 'Patient Complaint', 'warn'], ['adr', 'ADR', 'warn']];
function supComputeTotals(r) {
  const g = r.general || {},
    er = r.erCensus || {};
  const death = supNum(g.death) || supNum(er.death);
  return {
    newAdmission: (r.newAdmissions || []).length,
    discharge: (r.discharged || []).length,
    death
  };
}
function supComputeCensusTotal(census, deptNames) {
  let t = supNum((census || {})['OPD Total']);
  (deptNames || []).forEach(n => {
    t += supNum((census || {})[n]);
  });
  return t;
}
function supComputeAlerts(r) {
  const out = [];
  const g = r.general || {};
  ALERT_FIELDS.forEach(([k, label, level]) => {
    const n = supNum(g[k]);
    if (n > 0) out.push({
      level,
      text: label + ': ' + n
    });
  });
  if ((r.pressureSore || []).length) out.push({
    level: 'warn',
    text: r.pressureSore.length + ' patient(s) with pressure sore'
  });
  if ((r.phlebitis || []).length) out.push({
    level: 'warn',
    text: r.phlebitis.length + ' patient(s) with phlebitis'
  });
  return out;
}
function supRefreshAlertBadge(reports) {
  try {
    const today = supTodayISO();
    const todays = (reports || []).filter(r => r.date === today);
    let n = 0;
    todays.forEach(r => {
      n += supComputeAlerts(r).filter(a => a.level === 'critical').length;
    });
    SUP_SHIFTS.forEach(sh => {
      if (!todays.some(r => r.shift === sh)) n += 1;
    });
    window.__UNICO_SUP_ALERTS__ = n;
    try {
      window.dispatchEvent(new CustomEvent('unico:sup-alerts', {
        detail: n
      }));
    } catch (e) {}
  } catch (e) {}
}
const SHIFT_ORD = {
  Morning: 0,
  Evening: 1,
  Night: 2
};
function supChrono(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return (SHIFT_ORD[a.shift] || 0) - (SHIFT_ORD[b.shift] || 0);
}
function supPatKey(row) {
  const u = String(row.uhid || '').trim();
  if (u) return 'u:' + u;
  const n = String(row.name || '').trim().toLowerCase();
  return n ? 'n:' + n : '';
}
function supDaysSince(doa) {
  try {
    const m = String(doa || '').match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (!m) return null;
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    const d = new Date(y, parseInt(m[2], 10) - 1, parseInt(m[1], 10));
    const diff = Math.floor((Date.now() - d.getTime()) / 864e5);
    return diff >= 0 && diff < 3650 ? diff : null;
  } catch (e) {
    return null;
  }
}
function supActivePatients(reports) {
  const rs = (reports || []).slice().sort(supChrono);
  const map = {};
  rs.forEach(rep => {
    const stamp = {
      date: rep.date,
      shift: rep.shift
    };
    ['newAdmissions', 'criticalArea', 'cabinArea', 'interventional'].forEach(sec => {
      (rep[sec] || []).forEach(row => {
        const k = supPatKey(row);
        if (!k) return;
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
          section: sec
        };
      });
    });
    ['discharged', 'lama'].forEach(sec => {
      (rep[sec] || []).forEach(row => {
        const k = supPatKey(row);
        if (k && map[k]) delete map[k];
      });
    });
  });
  return Object.keys(map).map(k => map[k]).sort((a, b) => (a.dept || '').localeCompare(b.dept || ''));
}
function SupHero({
  icon,
  title,
  sub,
  right
}) {
  return React.createElement("div", {
    className: "sup-hero"
  }, React.createElement("div", {
    className: "sup-hero-ic"
  }, React.createElement(Ic, {
    d: icon || I.doc,
    s: 22,
    c: "#fff"
  })), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "sup-hero-t"
  }, title), sub && React.createElement("div", {
    className: "sup-hero-s"
  }, sub)), right && React.createElement("div", {
    className: "sup-hero-r"
  }, right));
}
function SupBtn({
  kind,
  sm,
  onClick,
  children,
  title,
  disabled
}) {
  return React.createElement("button", {
    className: 'sup-btn' + (kind ? ' ' + kind : '') + (sm ? ' sm' : ''),
    onClick: onClick,
    title: title || '',
    disabled: disabled
  }, children);
}
function StatusBadge({
  status
}) {
  return React.createElement("span", {
    className: 'sup-status ' + (status || 'draft')
  }, status || 'draft');
}
function RowsEditor({
  section,
  rows,
  deptNames,
  readOnly,
  onChange,
  onLookup
}) {
  rows = rows || [];
  const cfg = useFields();
  const custom = cfg.cols[section.key] || [];
  const cols = (section.cols || []).concat(custom);
  const drag = useRef(null);
  const [over, setOver] = useState(null);
  const [fm, setFm] = useState(false);
  const clip = useClip();
  const set = (i, k, v) => onChange(rows.map((r, x) => x === i ? {
    ...r,
    [k]: v
  } : r));
  const add = () => onChange([...rows, {}]);
  const dup = i => {
    const c = rows.slice();
    c.splice(i + 1, 0, {
      ...rows[i]
    });
    onChange(c);
  };
  const del = i => onChange(rows.filter((_, x) => x !== i));
  const copy = i => {
    supSetClip(rows[i]);
    supToast('Row copied — paste it in any section.', 'success');
  };
  const cut = i => {
    supSetClip(rows[i]);
    del(i);
    supToast('Row cut to clipboard.', 'success');
  };
  const pasteBelow = i => {
    if (!clip) return;
    const c = rows.slice();
    c.splice(i + 1, 0, {
      ...clip
    });
    onChange(c);
  };
  const pasteEnd = () => {
    if (!clip) return;
    onChange([...rows, {
      ...clip
    }]);
    supToast('Row pasted.', 'success');
  };
  const move = (from, to) => {
    if (from == null || to == null || from === to) return;
    const c = rows.slice();
    const [m] = c.splice(from, 1);
    c.splice(to, 0, m);
    onChange(c);
  };
  const doLookup = async (i, uhid) => {
    if (!onLookup || !String(uhid || '').trim()) return;
    const p = await onLookup(uhid);
    if (!p) return;
    onChange(rows.map((r, x) => {
      if (x !== i) return r;
      const nr = {
        ...r
      };
      ['name', 'age', 'consultant', 'diagnosis', 'dept'].forEach(k => {
        if (p[k] && !String(nr[k] || '').trim()) nr[k] = p[k];
      });
      return nr;
    }));
    supToast('Autofilled from a previous entry', 'success');
  };
  const cell = (c, row, i) => {
    if (readOnly) return React.createElement("span", null, c.type === 'check' ? row[c.id] ? 'Yes' : '' : row[c.id] || '');
    if (c.type === 'select') {
      const opts = c.options && c.options.length ? c.options : c.id === 'dept' ? deptNames : [];
      return React.createElement("select", {
        value: row[c.id] || '',
        onChange: e => set(i, c.id, e.target.value)
      }, React.createElement("option", {
        value: ""
      }), opts.concat(row[c.id] && opts.indexOf(row[c.id]) < 0 ? [row[c.id]] : []).map(n => React.createElement("option", {
        key: n,
        value: n
      }, n)));
    }
    if (c.type === 'num') return React.createElement("input", {
      type: "number",
      value: row[c.id] || '',
      onChange: e => set(i, c.id, e.target.value)
    });
    if (c.type === 'date') return React.createElement("input", {
      type: "date",
      value: row[c.id] || '',
      onChange: e => set(i, c.id, e.target.value)
    });
    if (c.type === 'datetime') return React.createElement(DateTimeInput, {
      value: row[c.id] || '',
      onChange: v => set(i, c.id, v)
    });
    if (c.type === 'check') return React.createElement("input", {
      type: "checkbox",
      checked: !!row[c.id],
      onChange: e => set(i, c.id, e.target.checked),
      style: {
        width: 18,
        height: 18
      }
    });
    return React.createElement(SugInput, {
      field: c.id,
      area: c.type === 'area',
      value: row[c.id] || '',
      onChange: val => set(i, c.id, val),
      onCommit: c.lookup ? () => doLookup(i, row[c.id]) : undefined
    });
  };
  const span = cols.length + (section.sn ? 1 : 0) + (readOnly ? 0 : 2);
  return React.createElement("div", null, React.createElement("div", {
    className: "sup-tblwrap"
  }, React.createElement("table", {
    className: "sup-tbl"
  }, React.createElement("thead", null, React.createElement("tr", null, !readOnly && React.createElement("th", {
    style: {
      width: 26
    }
  }), section.sn && React.createElement("th", {
    style: {
      width: 34
    }
  }, "#"), cols.map(c => React.createElement("th", {
    key: c.id,
    style: c.w ? {
      minWidth: c.w
    } : null
  }, c.label, c.custom ? React.createElement("span", {
    className: "sup-custom-dot",
    title: "Custom field"
  }, "\u25C6") : null)), !readOnly && React.createElement("th", {
    style: {
      width: 128
    }
  }, "Actions"))), React.createElement("tbody", null, rows.length === 0 && React.createElement("tr", null, React.createElement("td", {
    "data-label": "",
    colSpan: span,
    style: {
      color: '#94a3b8',
      textAlign: 'center',
      padding: 10
    }
  }, "No entries yet. Use \u201C+ Add row\u201D or the Add Patient button.")), rows.map((row, i) => React.createElement("tr", {
    key: i,
    className: over === i ? 'sup-drop' : '',
    onDragOver: readOnly ? undefined : e => {
      e.preventDefault();
      if (over !== i) setOver(i);
    },
    onDrop: readOnly ? undefined : e => {
      e.preventDefault();
      move(drag.current, i);
      drag.current = null;
      setOver(null);
    }
  }, !readOnly && React.createElement("td", {
    "data-label": "",
    className: "sup-grip",
    draggable: true,
    onDragStart: e => {
      drag.current = i;
      e.dataTransfer.effectAllowed = 'move';
      try {
        e.dataTransfer.setData('text/plain', String(i));
      } catch (_) {}
    },
    onDragEnd: () => {
      drag.current = null;
      setOver(null);
    },
    title: "Drag to reorder"
  }, React.createElement(Ic, {
    d: I.grip,
    s: 14
  })), section.sn && React.createElement("td", {
    "data-label": "#"
  }, i + 1), cols.map(c => React.createElement("td", {
    key: c.id,
    "data-label": c.label
  }, cell(c, row, i))), !readOnly && React.createElement("td", {
    "data-label": "Actions",
    className: "sup-actions"
  }, React.createElement("button", {
    className: "sup-ib",
    title: "Copy row",
    onClick: () => copy(i)
  }, "\u29C9"), React.createElement("button", {
    className: "sup-ib",
    title: "Cut row",
    onClick: () => cut(i)
  }, "\u2702"), clip && React.createElement("button", {
    className: "sup-ib",
    title: "Paste row below",
    onClick: () => pasteBelow(i)
  }, "\u2935"), React.createElement("button", {
    className: "sup-ib",
    title: "Duplicate row",
    onClick: () => dup(i)
  }, "\uFF0B"), React.createElement("button", {
    className: "sup-ib danger",
    title: "Remove row",
    onClick: () => del(i)
  }, "\u2715"))))))), !readOnly && React.createElement("div", {
    style: {
      marginTop: 8,
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, React.createElement(SupBtn, {
    sm: true,
    onClick: add
  }, "+ Add row"), clip && React.createElement(SupBtn, {
    sm: true,
    onClick: pasteEnd
  }, React.createElement(Ic, {
    d: I.download,
    s: 13
  }), "Paste row", clip.name ? ' · ' + clip.name : ''), React.createElement(SupBtn, {
    sm: true,
    onClick: () => setFm(true)
  }, React.createElement(Ic, {
    d: I.gear,
    s: 13
  }), "Custom fields", custom.length ? ' (' + custom.length + ')' : ''), rows.length > 0 && React.createElement(SupBtn, {
    sm: true,
    kind: "dgr",
    onClick: () => {
      if (window.confirm('Clear all ' + rows.length + ' row(s) in this section?')) onChange([]);
    }
  }, React.createElement(Ic, {
    d: I.x,
    s: 13
  }), "Clear all")), fm && React.createElement(FieldManagerModal, {
    sectionKey: section.key,
    sectionTitle: section.title,
    onClose: () => setFm(false)
  }));
}
function ScalarFields({
  fields,
  val,
  onChange,
  readOnly,
  sectionKey
}) {
  val = val || {};
  const cfg = useFields();
  const [fm, setFm] = useState(false);
  const custom = sectionKey && cfg.cols[sectionKey] || [];
  const setK = (k, v) => onChange({
    ...val,
    [k]: v
  });
  const customCell = c => {
    if (readOnly) return React.createElement("div", {
      style: {
        fontWeight: 600
      }
    }, c.type === 'check' ? val[c.id] ? 'Yes' : '—' : val[c.id] || '—');
    if (c.type === 'num') return React.createElement("input", {
      type: "number",
      value: val[c.id] || '',
      onChange: e => setK(c.id, e.target.value)
    });
    if (c.type === 'date') return React.createElement("input", {
      type: "date",
      value: val[c.id] || '',
      onChange: e => setK(c.id, e.target.value)
    });
    if (c.type === 'datetime') return React.createElement(DateTimeInput, {
      value: val[c.id] || '',
      onChange: v => setK(c.id, v)
    });
    if (c.type === 'check') return React.createElement("label", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        fontSize: 12.5
      }
    }, React.createElement("input", {
      type: "checkbox",
      checked: !!val[c.id],
      onChange: e => setK(c.id, e.target.checked),
      style: {
        width: 18,
        height: 18
      }
    }), " Yes");
    if (c.type === 'select') return React.createElement("select", {
      value: val[c.id] || '',
      onChange: e => setK(c.id, e.target.value)
    }, React.createElement("option", {
      value: ""
    }), (c.options || []).map(o => React.createElement("option", {
      key: o,
      value: o
    }, o)));
    return React.createElement("input", {
      value: val[c.id] || '',
      onChange: e => setK(c.id, e.target.value)
    });
  };
  return React.createElement("div", null, React.createElement("div", {
    className: "sup-scalar"
  }, fields.map(f => {
    const id = f[0],
      label = f[1],
      type = f[2];
    return React.createElement("div", {
      className: "sup-fld",
      key: id
    }, React.createElement("label", null, label), readOnly ? React.createElement("div", {
      style: {
        fontWeight: 600
      }
    }, val[id] || '—') : React.createElement("input", {
      type: type === 'num' ? 'number' : 'text',
      value: val[id] || '',
      onChange: e => setK(id, e.target.value)
    }));
  }), custom.map(c => React.createElement("div", {
    className: "sup-fld",
    key: c.id
  }, React.createElement("label", null, c.label, " ", React.createElement("span", {
    className: "sup-custom-dot",
    title: "Custom field"
  }, "\u25C6")), customCell(c)))), !readOnly && sectionKey && React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, React.createElement(SupBtn, {
    sm: true,
    onClick: () => setFm(true)
  }, React.createElement(Ic, {
    d: I.gear,
    s: 13
  }), "Custom fields", custom.length ? ' (' + custom.length + ')' : '')), fm && React.createElement(FieldManagerModal, {
    sectionKey: sectionKey,
    sectionTitle: "Custom fields",
    onClose: () => setFm(false)
  }));
}
function CensusFields({
  deptNames,
  val,
  onChange,
  readOnly
}) {
  val = val || {};
  const total = supComputeCensusTotal(val, deptNames);
  const setK = (k, v) => onChange({
    ...val,
    [k]: v
  });
  return React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted,#64748b)',
      marginBottom: 8
    }
  }, "Department-wise patient census (departments pulled from Statistics)."), React.createElement("div", {
    className: "sup-scalar"
  }, React.createElement("div", {
    className: "sup-fld"
  }, React.createElement("label", null, "OPD Total"), React.createElement("input", {
    type: "number",
    value: val['OPD Total'] || '',
    onChange: e => setK('OPD Total', e.target.value),
    disabled: readOnly
  })), deptNames.map(n => React.createElement("div", {
    className: "sup-fld",
    key: n
  }, React.createElement("label", null, n), React.createElement("input", {
    type: "number",
    value: val[n] || '',
    onChange: e => setK(n, e.target.value),
    disabled: readOnly
  })))), React.createElement("div", {
    style: {
      marginTop: 10,
      fontWeight: 800,
      fontSize: 13
    }
  }, "TOTAL: ", total));
}
function SecCard({
  title,
  count,
  children,
  open,
  onToggle,
  anchor
}) {
  return React.createElement("div", {
    className: 'sup-card' + (open ? ' sup-open' : '') + (count > 0 ? ' sup-has' : ''),
    id: anchor
  }, React.createElement("div", {
    className: "sup-card-h",
    onClick: onToggle
  }, React.createElement(Ic, {
    d: I.chevR,
    s: 15,
    style: {
      transform: open ? 'rotate(90deg)' : 'none',
      transition: '.15s',
      flex: '0 0 auto',
      color: open ? '#2563eb' : '#94a3b8'
    }
  }), React.createElement("h4", null, title), count != null && React.createElement("span", {
    className: 'sup-count' + (count > 0 ? ' on' : '')
  }, count), open && React.createElement("span", {
    className: "sup-active-pill"
  }, "Active")), open && React.createElement("div", {
    className: "sup-card-b"
  }, children));
}
function MiniBars({
  data,
  height
}) {
  height = height || 90;
  const max = Math.max(1, ...data.map(d => d.v));
  const bw = 100 / Math.max(1, data.length);
  return React.createElement("svg", {
    viewBox: "0 0 100 40",
    preserveAspectRatio: "none",
    style: {
      width: '100%',
      height
    }
  }, data.map((d, i) => {
    const h = d.v / max * 36;
    return React.createElement("rect", {
      key: i,
      x: i * bw + bw * 0.15,
      y: 40 - h,
      width: bw * 0.7,
      height: h,
      rx: "0.6",
      fill: "#2563eb"
    });
  }));
}
const QUICK_TARGETS = [['newAdmissions', 'New Admission'], ['criticalArea', 'Critical Area'], ['cabinArea', 'Cabin Area'], ['discharged', 'Discharged'], ['lama', 'LAMA / DAMA'], ['interventional', 'Interventional Procedure'], ['radiological', 'Radiological Procedure'], ['pressureSore', 'Pressure Sore'], ['phlebitis', 'Phlebitis']];
function QuickAddModal({
  deptNames,
  onAdd,
  onClose,
  onLookup
}) {
  const cfg = useFields();
  const [row, setRow] = useState({});
  const [target, setTarget] = useState('newAdmissions');
  const [more, setMore] = useState(false);
  const set = (k, v) => setRow(r => ({
    ...r,
    [k]: v
  }));
  const customCols = cfg.cols[target] || [];
  const customCell = c => {
    if (c.type === 'num') return React.createElement("input", {
      type: "number",
      value: row[c.id] || '',
      onChange: e => set(c.id, e.target.value)
    });
    if (c.type === 'date') return React.createElement("input", {
      type: "date",
      value: row[c.id] || '',
      onChange: e => set(c.id, e.target.value)
    });
    if (c.type === 'check') return React.createElement("label", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        fontSize: 12.5
      }
    }, React.createElement("input", {
      type: "checkbox",
      checked: !!row[c.id],
      onChange: e => set(c.id, e.target.checked),
      style: {
        width: 18,
        height: 18
      }
    }), " Yes");
    if (c.type === 'select') return React.createElement("select", {
      value: row[c.id] || '',
      onChange: e => set(c.id, e.target.value)
    }, React.createElement("option", {
      value: ""
    }), (c.options || []).map(o => React.createElement("option", {
      key: o,
      value: o
    }, o)));
    return React.createElement(SugInput, {
      field: c.id,
      area: c.type === 'area',
      value: row[c.id] || '',
      onChange: v => set(c.id, v)
    });
  };
  const doLookup = async () => {
    if (!onLookup || !String(row.uhid || '').trim()) return;
    const p = await onLookup(row.uhid);
    if (!p) return;
    setRow(r => {
      const nr = {
        ...r
      };
      ['name', 'age', 'consultant', 'diagnosis', 'dept'].forEach(k => {
        if (p[k] && !String(nr[k] || '').trim()) nr[k] = p[k];
      });
      return nr;
    });
    supToast('Autofilled from a previous entry', 'success');
  };
  const save = again => {
    if (!String(row.name || '').trim() && !String(row.uhid || '').trim()) {
      supToast('Enter at least a name or UHID.', 'info');
      return;
    }
    onAdd(target, row);
    if (again) {
      setRow({
        dept: row.dept
      });
      supToast('Patient added — add another.', 'success');
    } else onClose();
  };
  return supPortal(React.createElement("div", {
    className: "sup-modal-bg",
    onClick: onClose
  }, React.createElement("div", {
    className: "sup-modal",
    onClick: e => e.stopPropagation()
  }, React.createElement("div", {
    className: "sup-modal-h"
  }, React.createElement("div", {
    className: "sup-hero-ic",
    style: {
      width: 36,
      height: 36,
      background: 'rgba(255,255,255,.18)'
    }
  }, React.createElement(Ic, {
    d: I.plus,
    s: 18,
    c: "#fff"
  })), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 800,
      fontSize: 15
    }
  }, "Add Patient"), React.createElement("div", {
    style: {
      fontSize: 11.5,
      opacity: .9
    }
  }, "Quickly add to any section")), React.createElement("button", {
    className: "sup-modal-x",
    onClick: onClose
  }, React.createElement(Ic, {
    d: I.x,
    s: 16,
    c: "#fff"
  }))), React.createElement("div", {
    className: "sup-modal-b"
  }, React.createElement("div", {
    className: "sup-fld",
    style: {
      marginBottom: 12
    }
  }, React.createElement("label", null, "Add to section"), React.createElement("select", {
    value: target,
    onChange: e => setTarget(e.target.value)
  }, QUICK_TARGETS.map(([k, l]) => React.createElement("option", {
    key: k,
    value: k
  }, l)))), React.createElement("div", {
    className: "sup-scalar"
  }, React.createElement("div", {
    className: "sup-fld"
  }, React.createElement("label", null, "UHID"), React.createElement("input", {
    value: row.uhid || '',
    autoFocus: true,
    onChange: e => set('uhid', e.target.value),
    onBlur: doLookup,
    placeholder: "Type & tab to autofill"
  })), React.createElement("div", {
    className: "sup-fld"
  }, React.createElement("label", null, "Name of Patient"), React.createElement(SugInput, {
    field: "name",
    value: row.name || '',
    onChange: v => set('name', v)
  })), React.createElement("div", {
    className: "sup-fld"
  }, React.createElement("label", null, "Department"), React.createElement("select", {
    value: row.dept || '',
    onChange: e => set('dept', e.target.value)
  }, React.createElement("option", {
    value: ""
  }), deptNames.concat(row.dept && deptNames.indexOf(row.dept) < 0 ? [row.dept] : []).map(n => React.createElement("option", {
    key: n,
    value: n
  }, n)))), React.createElement("div", {
    className: "sup-fld"
  }, React.createElement("label", null, "Bed"), React.createElement(SugInput, {
    field: "bed",
    value: row.bed || '',
    onChange: v => set('bed', v)
  })), React.createElement("div", {
    className: "sup-fld"
  }, React.createElement("label", null, "Age"), React.createElement(SugInput, {
    field: "age",
    value: row.age || '',
    onChange: v => set('age', v)
  })), React.createElement("div", {
    className: "sup-fld"
  }, React.createElement("label", null, "Consultant"), React.createElement(SugInput, {
    field: "consultant",
    value: row.consultant || '',
    onChange: v => set('consultant', v)
  }))), React.createElement("div", {
    className: "sup-fld",
    style: {
      marginTop: 12
    }
  }, React.createElement("label", null, "Diagnosis"), React.createElement(SugInput, {
    field: "diagnosis",
    area: true,
    value: row.diagnosis || '',
    onChange: v => set('diagnosis', v)
  })), more && React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, React.createElement("div", {
    className: "sup-scalar"
  }, React.createElement("div", {
    className: "sup-fld"
  }, React.createElement("label", null, "DOA (Date & Time)"), React.createElement(DateTimeInput, {
    value: row.doa || '',
    onChange: v => set('doa', v)
  }))), React.createElement("div", {
    className: "sup-fld",
    style: {
      marginTop: 12
    }
  }, React.createElement("label", null, "Remarks"), React.createElement(SugInput, {
    field: "remarks",
    area: true,
    value: row.remarks || '',
    onChange: v => set('remarks', v)
  }))), customCols.length > 0 && React.createElement("div", {
    style: {
      marginTop: 14,
      borderTop: '1px dashed var(--line,#e5e7eb)',
      paddingTop: 12
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11.5,
      fontWeight: 700,
      color: '#7c3aed',
      marginBottom: 8
    }
  }, "Custom fields \u25C6"), React.createElement("div", {
    className: "sup-scalar"
  }, customCols.map(c => React.createElement("div", {
    className: "sup-fld",
    key: c.id
  }, React.createElement("label", null, c.label), customCell(c))))), React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, React.createElement(SupBtn, {
    sm: true,
    onClick: () => setMore(m => !m)
  }, more ? '− Fewer fields' : '+ More fields (DOA, remarks)'))), React.createElement("div", {
    className: "sup-modal-f"
  }, React.createElement(SupBtn, {
    onClick: onClose
  }, "Cancel"), React.createElement("span", {
    style: {
      flex: 1
    }
  }), React.createElement(SupBtn, {
    onClick: () => save(true)
  }, "Save & add another"), React.createElement(SupBtn, {
    kind: "pri",
    onClick: () => save(false)
  }, React.createElement(Ic, {
    d: I.check,
    s: 15
  }), "Add patient")))));
}
function CarryForwardModal({
  currentId,
  currentRep,
  onClose,
  onImport
}) {
  const SECS = [['criticalArea', 'Critical Area'], ['cabinArea', 'Cabin Area'], ['newAdmissions', 'New Admission'], ['discharged', 'Discharged'], ['lama', 'LAMA / DAMA'], ['interventional', 'Interventional'], ['pressureSore', 'Pressure Sore'], ['phlebitis', 'Phlebitis']];
  const [list, setList] = useState(null);
  const [srcId, setSrcId] = useState('');
  const [secs, setSecs] = useState({
    criticalArea: true,
    cabinArea: true,
    pressureSore: true,
    phlebitis: true
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    supApi.get('/api/supervisor-reports?limit=1000').then(j => {
      if (j.ok) {
        const others = j.reports.filter(r => r.id !== currentId);
        setList(others);
        if (others[0]) setSrcId(others[0].id);
      }
    });
  }, []);
  const toggle = k => setSecs(s => ({
    ...s,
    [k]: !s[k]
  }));
  const doImport = async () => {
    if (!srcId) {
      supToast('Pick a report to copy from.', 'info');
      return;
    }
    setBusy(true);
    const j = await supApi.get('/api/supervisor-reports/' + srcId);
    setBusy(false);
    if (!j.ok || !j.report) {
      supToast('Could not load that report.', 'error');
      return;
    }
    const src = j.report;
    const patch = {};
    let total = 0;
    Object.keys(secs).forEach(k => {
      if (!secs[k]) return;
      const cur = currentRep[k] || [];
      const seen = new Set(cur.map(supPatKey).filter(Boolean));
      const add = (src[k] || []).filter(r => {
        const key = supPatKey(r);
        return !key || !seen.has(key);
      });
      if (add.length) {
        patch[k] = [...cur, ...add.map(r => ({
          ...r
        }))];
        total += add.length;
      }
    });
    onImport(patch, src, total);
    onClose();
  };
  return supPortal(React.createElement("div", {
    className: "sup-modal-bg",
    onClick: onClose
  }, React.createElement("div", {
    className: "sup-modal",
    onClick: e => e.stopPropagation(),
    style: {
      maxWidth: 520
    }
  }, React.createElement("div", {
    className: "sup-modal-h"
  }, React.createElement("div", {
    className: "sup-hero-ic",
    style: {
      width: 36,
      height: 36,
      background: 'rgba(255,255,255,.18)'
    }
  }, React.createElement(Ic, {
    d: I.download,
    s: 17,
    c: "#fff"
  })), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 800,
      fontSize: 15
    }
  }, "Carry Forward"), React.createElement("div", {
    style: {
      fontSize: 11.5,
      opacity: .9
    }
  }, "Copy patients from an earlier shift into this report")), React.createElement("button", {
    className: "sup-modal-x",
    onClick: onClose
  }, React.createElement(Ic, {
    d: I.x,
    s: 16,
    c: "#fff"
  }))), React.createElement("div", {
    className: "sup-modal-b"
  }, React.createElement("div", {
    className: "sup-fld",
    style: {
      marginBottom: 14
    }
  }, React.createElement("label", null, "Copy from report"), list == null ? React.createElement("div", {
    style: {
      color: '#94a3b8',
      fontSize: 12.5
    }
  }, "Loading\u2026") : list.length === 0 ? React.createElement("div", {
    style: {
      color: '#94a3b8',
      fontSize: 12.5
    }
  }, "No other reports to copy from yet.") : React.createElement("select", {
    value: srcId,
    onChange: e => setSrcId(e.target.value)
  }, list.map(r => React.createElement("option", {
    key: r.id,
    value: r.id
  }, r.date, " \xB7 ", r.shift, " \xB7 ", r.supervisorName || '—', " (", (r.newAdmissions || []).length + (r.criticalArea || []).length + (r.cabinArea || []).length, " patients)")))), React.createElement("div", {
    style: {
      fontSize: 11.5,
      fontWeight: 700,
      color: 'var(--muted,#64748b)',
      marginBottom: 8
    }
  }, "Sections to carry forward (duplicates skipped by UHID)"), React.createElement("div", {
    className: "sup-scalar"
  }, SECS.map(([k, l]) => React.createElement("label", {
    key: k,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      fontSize: 12.5,
      fontWeight: 600
    }
  }, React.createElement("input", {
    type: "checkbox",
    checked: !!secs[k],
    onChange: () => toggle(k)
  }), l)))), React.createElement("div", {
    className: "sup-modal-f"
  }, React.createElement(SupBtn, {
    onClick: onClose
  }, "Cancel"), React.createElement("span", {
    style: {
      flex: 1
    }
  }), React.createElement(SupBtn, {
    kind: "pri",
    onClick: doImport,
    disabled: busy || !srcId
  }, React.createElement(Ic, {
    d: I.download,
    s: 15
  }), busy ? 'Copying…' : 'Carry forward')))));
}
function blankReport(shift) {
  return {
    date: supTodayISO(),
    shift: shift || supCurrentShift(),
    shiftTime: '',
    supervisorName: '',
    status: 'draft',
    newAdmissions: [],
    criticalArea: [],
    cabinArea: [],
    lama: [],
    discharged: [],
    otTable: [],
    surgeries: [],
    interventional: [],
    radiological: [],
    radiologyCounts: {},
    ventilators: [],
    erCensus: {},
    general: {},
    pressureSore: [],
    phlebitis: [],
    absenteeism: '',
    sickLeave: '',
    roundObservation: '',
    census: {},
    totals: {},
    sign: window.unicoSig ? window.unicoSig.load() : {
      prepared: '',
      reviewed: '',
      recommended: '',
      approved: ''
    }
  };
}
function SupEditor({
  id,
  shift,
  openAdd,
  depts,
  setRoute
}) {
  const deptNames = useMemo(() => supDeptNames(depts), [depts]);
  const cfg = useFields();
  const [rep, setRep] = useState(() => blankReport(shift));
  const [loading, setLoading] = useState(!!id);
  const [saved, setSaved] = useState('');
  const dirty = useRef(false);
  const timer = useRef(null);
  const [open, setOpen] = useState({
    newAdmissions: true,
    allPatients: true
  });
  const [quickAdd, setQuickAdd] = useState(!!openAdd);
  const [addSec, setAddSec] = useState(false);
  const [secName, setSecName] = useState('');
  const [carryOpen, setCarryOpen] = useState(false);
  const admin = supIsAdmin();
  const readOnly = rep.status === 'approved' && !admin;
  const draftKey = rid => 'unico_sup_draft_' + (rid || 'new');
  const baseline = useRef(null);
  const repRef = useRef(rep);
  repRef.current = rep;
  const baseAt = useRef(null);
  const blocked = useRef(false);
  useEffect(() => {
    baseline.current = null;
    if (!id) {
      let init = repRef.current;
      try {
        const d = localStorage.getItem('unico_sup_draft_new');
        if (d) {
          const r = JSON.parse(d);
          if (r && (String(r.supervisorName || '').trim() || (r.newAdmissions || []).length || (r.criticalArea || []).length)) {
            init = r;
            setRep(r);
            supToast('Restored your unsaved draft.', 'info');
          }
        }
      } catch (e) {}
      baseline.current = JSON.stringify(init);
      return;
    }
    setLoading(true);
    supApi.get('/api/supervisor-reports/' + encodeURIComponent(id)).then(j => {
      if (j.ok && j.report) {
        const r = {
          ...blankReport(),
          ...j.report
        };
        baseline.current = JSON.stringify(r);
        baseAt.current = j.report.updatedAt || null;
        blocked.current = false;
        setRep(r);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);
  useEffect(() => {
    if (readOnly || baseline.current == null || id && !rep.id) return;
    const s = JSON.stringify(rep);
    if (s === baseline.current) return;
    try {
      localStorage.setItem(draftKey(rep.id), s);
    } catch (e) {}
  }, [rep, readOnly, id]);
  useEffect(() => {
    const h = e => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);
  const edit = patch => {
    dirty.current = true;
    setRep(r => ({
      ...r,
      ...patch
    }));
  };
  const editSec = (key, val) => edit({
    [key]: val
  });
  useEffect(() => {
    if (!dirty.current || readOnly || blocked.current) return;
    if (!(rep.date && String(rep.supervisorName || '').trim())) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSaved('Saving…');
      const payload = {
        ...rep,
        totals: supComputeTotals(rep),
        census: {
          ...rep.census,
          TOTAL: supComputeCensusTotal(rep.census, deptNames)
        },
        baseUpdatedAt: baseAt.current || undefined
      };
      try {
        const j = await supApi.post('/api/supervisor-reports', payload);
        if (j.ok) {
          dirty.current = false;
          setSaved('Saved ✓');
          if (j.report && j.report.updatedAt) baseAt.current = j.report.updatedAt;
          const rid = rep.id || j.report && j.report.id;
          if (rid) {
            baseline.current = JSON.stringify(rep.id ? rep : {
              ...rep,
              id: rid
            });
            if (repRef.current === rep) {
              try {
                localStorage.removeItem(draftKey(rid));
              } catch (e) {}
            }
          }
          if (!rep.id && j.report && j.report.id) {
            try {
              localStorage.removeItem('unico_sup_draft_new');
            } catch (e) {}
            setRep(r => ({
              ...r,
              id: j.report.id
            }));
          }
        } else if (j.conflict || j.locked) {
          blocked.current = true;
          setSaved(j.locked ? 'Locked — not saved' : 'Not saved — changed elsewhere');
          supToast((j.error || 'This report was changed elsewhere.') + ' Your edits are kept as a draft on this device.', 'error');
        } else setSaved('Save failed');
      } catch (e) {
        setSaved('Save failed');
      }
    }, 1100);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [rep, readOnly, deptNames]);
  const lookupUhid = async uhid => {
    try {
      const j = await supApi.get('/api/supervisor-reports/lookup?uhid=' + encodeURIComponent(uhid));
      return j.ok && j.patient ? j.patient : null;
    } catch (e) {
      return null;
    }
  };
  const importPrevious = async () => {
    try {
      const j = await supApi.get('/api/supervisor-reports/previous?date=' + encodeURIComponent(rep.date) + '&shift=' + encodeURIComponent(rep.shift));
      if (!j.ok || !j.report) {
        supToast('No previous shift report found to carry forward.', 'info');
        return;
      }
      const p = j.report;
      edit({
        criticalArea: [...(rep.criticalArea || []), ...(p.criticalArea || [])],
        pressureSore: [...(rep.pressureSore || []), ...(p.pressureSore || [])],
        phlebitis: [...(rep.phlebitis || []), ...(p.phlebitis || [])]
      });
      setOpen(o => ({
        ...o,
        criticalArea: true,
        pressureSore: true,
        phlebitis: true
      }));
      supToast('Carried forward critical patients & registers from ' + p.date + ' ' + p.shift, 'success');
    } catch (e) {
      supToast('Carry-forward failed.', 'error');
    }
  };
  const importAllActive = async () => {
    try {
      const j = await supApi.get('/api/supervisor-reports?limit=1000');
      if (!j.ok) return;
      const active = supActivePatients(j.reports);
      const seen = new Set((rep.criticalArea || []).map(r => supPatKey(r)).filter(Boolean));
      const add = active.filter(p => !seen.has(p.key)).map(p => ({
        dept: p.dept,
        bed: p.bed,
        name: p.name,
        age: p.age,
        uhid: p.uhid,
        consultant: p.consultant,
        diagnosis: p.diagnosis,
        doa: p.doa,
        remarks: p.remarks
      }));
      if (!add.length) {
        supToast('No new active patients to carry forward.', 'info');
        return;
      }
      edit({
        criticalArea: [...(rep.criticalArea || []), ...add]
      });
      setOpen(o => ({
        ...o,
        criticalArea: true
      }));
      supToast('Carried forward ' + add.length + ' active patient(s).', 'success');
    } catch (e) {
      supToast('Carry-forward failed.', 'error');
    }
  };
  const setStatus = async status => {
    if (!rep.id) {
      supToast('Save the report first.', 'info');
      return;
    }
    try {
      const j = await supApi.post('/api/supervisor-reports/' + rep.id + '/status', {
        status
      });
      if (j.ok) {
        setRep(r => ({
          ...r,
          status
        }));
        supToast('Report ' + status + '.', 'success');
        const nb = j.report && j.report.updatedAt;
        if (nb) baseAt.current = nb;else supApi.get('/api/supervisor-reports/' + encodeURIComponent(rep.id)).then(g => {
          if (g.ok && g.report) baseAt.current = g.report.updatedAt || baseAt.current;
        }).catch(() => {});
        blocked.current = false;
      }
    } catch (e) {
      supToast('Could not update status.', 'error');
    }
  };
  const saveSig = sig => {
    if (window.unicoSig) window.unicoSig.save(sig);
    edit({
      sign: sig
    });
  };
  const addPatient = (target, row) => {
    edit({
      [target]: [...(rep[target] || []), {
        ...row
      }]
    });
    setOpen(o => ({
      ...o,
      [target]: true
    }));
  };
  const createCustomSection = title => {
    title = (title || '').trim();
    if (!title) return;
    const key = 'custom_' + supFieldId();
    supSaveFields({
      cols: cfg.cols,
      sections: [...cfg.sections, {
        key,
        title
      }]
    });
    setOpen(o => ({
      ...o,
      [key]: true
    }));
    setAddSec(false);
    setSecName('');
    supToast('Section “' + title + '” added — use “Custom fields” to add its columns.', 'success');
  };
  const removeCustomSection = key => {
    if (!window.confirm('Delete this custom section? (Any data already entered stays saved in the report.)')) return;
    const cols = {
      ...cfg.cols
    };
    delete cols[key];
    supSaveFields({
      cols,
      sections: cfg.sections.filter(s => s.key !== key)
    });
  };
  if (loading) return React.createElement("div", {
    style: {
      padding: 40,
      textAlign: 'center',
      color: 'var(--muted,#64748b)'
    }
  }, "Loading report\u2026");
  const totals = supComputeTotals(rep);
  const alerts = supComputeAlerts(rep);
  const PATIENT_SECS = [['newAdmissions', 'New Admission'], ['criticalArea', 'Critical Area'], ['cabinArea', 'Cabin Area'], ['lama', 'LAMA/DAMA'], ['discharged', 'Discharged'], ['interventional', 'Interventional'], ['radiological', 'Radiological']];
  const allPatients = [];
  PATIENT_SECS.forEach(([k, label]) => (rep[k] || []).forEach(r => {
    if ((r.name || '').trim() || (r.uhid || '').trim()) allPatients.push({
      section: label,
      ...r
    });
  }));
  const go = anchor => {
    const el = document.getElementById('sup-sec-' + anchor);
    if (el) el.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
    setOpen(o => ({
      ...o,
      [anchor]: true
    }));
  };
  const secMeta = [...SUP_SECTIONS.map(s => ({
    key: s.key,
    title: s.title,
    kind: 'rows'
  })), ...cfg.sections.map(cs => ({
    key: cs.key,
    title: cs.title,
    kind: 'rows'
  })), {
    key: 'radiologyCounts',
    title: 'Radiology Counts',
    kind: 'counts'
  }, {
    key: 'erCensus',
    title: 'ER Census',
    kind: 'counts'
  }, {
    key: 'general',
    title: 'General Info',
    kind: 'counts'
  }, {
    key: 'census',
    title: 'Census',
    kind: 'counts'
  }, {
    key: 'notes',
    title: 'Notes',
    kind: 'notes'
  }];
  const countOf = m => {
    if (m.kind === 'rows') return (rep[m.key] || []).length;
    if (m.kind === 'counts') {
      const o = rep[m.key] || {};
      return Object.keys(o).filter(k => {
        const v = o[k];
        return v != null && String(v).trim() !== '' && String(v) !== '0' && k !== 'TOTAL';
      }).length;
    }
    return String(rep.absenteeism || '').trim() || String(rep.sickLeave || '').trim() || String(rep.roundObservation || '').trim() ? 1 : 0;
  };
  const filledOf = m => countOf(m) > 0;
  const filledCount = secMeta.filter(filledOf).length;
  const pct = Math.round(filledCount / secMeta.length * 100);
  const expandAll = () => {
    const o = {};
    secMeta.forEach(m => {
      o[m.key] = true;
    });
    o.allPatients = true;
    o.sign = true;
    setOpen(o);
  };
  const collapseAll = () => setOpen({});
  return React.createElement("div", {
    className: "sup-wrap"
  }, React.createElement(SupHero, {
    icon: I.doc,
    title: (id ? 'Edit' : 'New') + ' Supervisor Report',
    sub: rep.date + ' · ' + rep.shift + ' shift' + (rep.supervisorName ? ' · ' + rep.supervisorName : '')
  }), React.createElement("div", {
    className: "sup-toolbar sup-sticky"
  }, React.createElement(SupBtn, {
    sm: true,
    onClick: () => setRoute({
      view: 'supHistory'
    })
  }, React.createElement(Ic, {
    d: I.chevR,
    s: 14,
    style: {
      transform: 'rotate(180deg)'
    }
  }), "Back"), React.createElement(StatusBadge, {
    status: rep.status
  }), React.createElement("span", {
    className: 'sup-saved' + (saved === 'Saved' ? ' ok' : '')
  }, saved), React.createElement("span", {
    style: {
      flex: 1
    }
  }), !readOnly && React.createElement(SupBtn, {
    sm: true,
    kind: "pri",
    onClick: () => setQuickAdd(true)
  }, React.createElement(Ic, {
    d: I.plus,
    s: 14
  }), "Add Patient"), !id ? null : React.createElement(SupBtn, {
    sm: true,
    onClick: () => setRoute({
      view: 'supReport',
      id: rep.id
    })
  }, React.createElement(Ic, {
    d: I.print,
    s: 14
  }), "Generate / Export"), !readOnly && rep.status === 'draft' && React.createElement(SupBtn, {
    sm: true,
    kind: "pri",
    onClick: () => setStatus('submitted')
  }, React.createElement(Ic, {
    d: I.check,
    s: 14
  }), "Submit"), admin && rep.status === 'submitted' && React.createElement(SupBtn, {
    sm: true,
    kind: "pri",
    onClick: () => setStatus('approved')
  }, React.createElement(Ic, {
    d: I.check,
    s: 14
  }), "Approve"), admin && rep.status === 'approved' && React.createElement(SupBtn, {
    sm: true,
    onClick: () => setStatus('draft')
  }, React.createElement(Ic, {
    d: I.edit,
    s: 14
  }), "Reopen")), readOnly && React.createElement("div", {
    className: "sup-alert info"
  }, React.createElement(Ic, {
    d: I.check,
    s: 15
  }), "This report is approved and locked. An administrator can reopen it for edits."), alerts.length > 0 && React.createElement("div", null, alerts.map((a, i) => React.createElement("div", {
    key: i,
    className: 'sup-alert ' + a.level
  }, React.createElement(Ic, {
    d: I.bell,
    s: 15
  }), a.text))), React.createElement("div", {
    className: "sup-card"
  }, React.createElement("div", {
    className: "sup-card-b"
  }, React.createElement("div", {
    className: "sup-scalar"
  }, React.createElement("div", {
    className: "sup-fld"
  }, React.createElement("label", null, "Date"), React.createElement("input", {
    type: "date",
    value: rep.date,
    onChange: e => edit({
      date: e.target.value
    }),
    disabled: readOnly
  })), React.createElement("div", {
    className: "sup-fld"
  }, React.createElement("label", null, "Shift"), React.createElement("select", {
    value: rep.shift,
    onChange: e => edit({
      shift: e.target.value
    }),
    disabled: readOnly
  }, SUP_SHIFTS.map(s => React.createElement("option", {
    key: s,
    value: s
  }, s)))), React.createElement("div", {
    className: "sup-fld"
  }, React.createElement("label", null, "Shift Time"), (() => {
    const opts = (SHIFT_LEGEND[rep.shift] || []).concat(SHIFT_LEGEND.General);
    const known = opts.some(([, t]) => t === rep.shiftTime);
    return React.createElement("select", {
      value: rep.shiftTime,
      onChange: e => edit({
        shiftTime: e.target.value
      }),
      disabled: readOnly
    }, React.createElement("option", {
      value: ""
    }, "Select shift time\u2026"), rep.shift && SHIFT_LEGEND[rep.shift] && React.createElement("optgroup", {
      label: rep.shift + ' shift'
    }, SHIFT_LEGEND[rep.shift].map(([code, t]) => React.createElement("option", {
      key: code + t,
      value: t
    }, code, " \xB7 ", t))), React.createElement("optgroup", {
      label: "General"
    }, SHIFT_LEGEND.General.map(([code, t]) => React.createElement("option", {
      key: code + t,
      value: t
    }, code, " \xB7 ", t))), rep.shiftTime && !known && React.createElement("option", {
      value: rep.shiftTime
    }, rep.shiftTime));
  })()), React.createElement("div", {
    className: "sup-fld"
  }, React.createElement("label", null, "Name of Nursing Supervisor"), React.createElement(SugInput, {
    field: "supervisorName",
    value: rep.supervisorName,
    onChange: v => edit({
      supervisorName: v
    }),
    disabled: readOnly
  }))), !readOnly && React.createElement("div", {
    style: {
      marginTop: 10,
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, React.createElement(SupBtn, {
    sm: true,
    onClick: () => setCarryOpen(true)
  }, React.createElement(Ic, {
    d: I.download,
    s: 14
  }), "Carry forward from a shift\u2026"), React.createElement(SupBtn, {
    sm: true,
    onClick: importAllActive
  }, React.createElement(Ic, {
    d: I.layers,
    s: 14
  }), "Carry forward ALL active patients"), React.createElement(SupBtn, {
    sm: true,
    onClick: () => setRoute({
      view: 'supBoard'
    })
  }, React.createElement(Ic, {
    d: I.grid,
    s: 14
  }), "Open Patient Board")))), React.createElement("div", {
    className: "sup-kpis"
  }, React.createElement("div", {
    className: "sup-kpi"
  }, React.createElement("div", {
    className: "n"
  }, totals.newAdmission), React.createElement("div", {
    className: "l"
  }, "New Admissions")), React.createElement("div", {
    className: "sup-kpi"
  }, React.createElement("div", {
    className: "n"
  }, totals.discharge), React.createElement("div", {
    className: "l"
  }, "Discharged")), React.createElement("div", {
    className: "sup-kpi"
  }, React.createElement("div", {
    className: "n"
  }, (rep.criticalArea || []).length), React.createElement("div", {
    className: "l"
  }, "Critical-area patients")), React.createElement("div", {
    className: "sup-kpi"
  }, React.createElement("div", {
    className: "n"
  }, totals.death), React.createElement("div", {
    className: "l"
  }, "Deaths"))), React.createElement("div", {
    className: "sup-card"
  }, React.createElement("div", {
    className: "sup-card-b"
  }, React.createElement("div", {
    className: "sup-statushead"
  }, React.createElement("div", null, React.createElement("div", {
    className: "sup-statust"
  }, "Report Status"), React.createElement("div", {
    className: "sup-statuss"
  }, filledCount, " of ", secMeta.length, " sections filled \xB7 ", allPatients.length, " patients logged")), React.createElement("div", {
    className: "sup-statuspct",
    style: {
      color: pct >= 66 ? '#15803d' : pct >= 33 ? '#b45309' : '#64748b'
    }
  }, pct, "%")), React.createElement("div", {
    className: "sup-prog"
  }, React.createElement("div", {
    className: "sup-prog-bar",
    style: {
      width: pct + '%',
      background: pct >= 66 ? '#16a34a' : pct >= 33 ? '#f59e0b' : '#2563eb'
    }
  })), React.createElement("div", {
    className: "sup-navgrid"
  }, secMeta.map(m => {
    const n = countOf(m);
    return React.createElement("button", {
      key: m.key,
      className: 'sup-navitem' + (n > 0 ? ' filled' : ''),
      onClick: () => go(m.key),
      title: m.title
    }, React.createElement("span", {
      className: "dot"
    }), React.createElement("span", {
      className: "t"
    }, m.title), n > 0 && React.createElement("span", {
      className: "n"
    }, n));
  })), !readOnly && React.createElement("div", {
    style: {
      marginTop: 11,
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, React.createElement(SupBtn, {
    sm: true,
    onClick: expandAll
  }, React.createElement(Ic, {
    d: I.layers,
    s: 13
  }), "Expand all"), React.createElement(SupBtn, {
    sm: true,
    onClick: collapseAll
  }, React.createElement(Ic, {
    d: I.x,
    s: 13
  }), "Collapse all"), React.createElement(SupBtn, {
    sm: true,
    kind: "pri",
    onClick: () => setQuickAdd(true)
  }, React.createElement(Ic, {
    d: I.plus,
    s: 13
  }), "Add Patient")))), React.createElement("div", {
    className: "sup-group"
  }, "Overview"), React.createElement(SecCard, {
    anchor: "sup-sec-allPatients",
    title: "All Patients in this Report \u2014 Details",
    count: allPatients.length,
    open: !!open.allPatients,
    onToggle: () => setOpen(o => ({
      ...o,
      allPatients: !o.allPatients
    }))
  }, allPatients.length === 0 ? React.createElement("div", {
    style: {
      color: '#94a3b8',
      fontSize: 12.5
    }
  }, "No patients added yet. Use \u201CAdd Patient\u201D.") : React.createElement("div", {
    className: "sup-tblwrap"
  }, React.createElement("table", {
    className: "sup-tbl",
    style: {
      minWidth: 720
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: {
      width: 34
    }
  }, "#"), React.createElement("th", null, "Section"), React.createElement("th", null, "Dept / Bed"), React.createElement("th", null, "Name"), React.createElement("th", null, "UHID"), React.createElement("th", null, "Age"), React.createElement("th", null, "Consultant"), React.createElement("th", null, "Diagnosis"))), React.createElement("tbody", null, allPatients.map((p, i) => React.createElement("tr", {
    key: i
  }, React.createElement("td", {
    "data-label": "#"
  }, i + 1), React.createElement("td", {
    "data-label": "Section"
  }, React.createElement("span", {
    className: "sup-tag",
    style: {
      background: '#eef2ff',
      color: '#3730a3'
    }
  }, p.section)), React.createElement("td", {
    "data-label": "Dept / Bed"
  }, [p.dept, p.bed].filter(Boolean).join(' · ')), React.createElement("td", {
    "data-label": "Name"
  }, React.createElement("b", null, p.name || '—')), React.createElement("td", {
    "data-label": "UHID"
  }, p.uhid || '—'), React.createElement("td", {
    "data-label": "Age"
  }, p.age || '—'), React.createElement("td", {
    "data-label": "Consultant"
  }, p.consultant || '—'), React.createElement("td", {
    "data-label": "Diagnosis",
    style: {
      maxWidth: 220
    }
  }, p.diagnosis || '—'))))))), SUP_SECTIONS.map((s, idx) => {
    const grp = SEC_GROUP[s.key];
    const prev = idx > 0 ? SEC_GROUP[SUP_SECTIONS[idx - 1].key] : null;
    return React.createElement(React.Fragment, {
      key: s.key
    }, grp && grp !== prev && React.createElement("div", {
      className: "sup-group"
    }, grp), React.createElement(SecCard, {
      anchor: 'sup-sec-' + s.key,
      title: s.title,
      count: (rep[s.key] || []).length,
      open: !!open[s.key],
      onToggle: () => setOpen(o => ({
        ...o,
        [s.key]: !o[s.key]
      }))
    }, React.createElement(RowsEditor, {
      section: s,
      rows: rep[s.key],
      deptNames: deptNames,
      readOnly: readOnly,
      onChange: v => editSec(s.key, v),
      onLookup: lookupUhid
    })));
  }), React.createElement("div", {
    className: "sup-group"
  }, "Metrics & Counts"), React.createElement(SecCard, {
    anchor: "sup-sec-radiologyCounts",
    title: "Radiology Counts",
    open: !!open.radiologyCounts,
    onToggle: () => setOpen(o => ({
      ...o,
      radiologyCounts: !o.radiologyCounts
    }))
  }, React.createElement(ScalarFields, {
    fields: RADIOLOGY_FIELDS,
    val: rep.radiologyCounts,
    onChange: v => editSec('radiologyCounts', v),
    readOnly: readOnly,
    sectionKey: "radiologyCounts"
  })), React.createElement(SecCard, {
    anchor: "sup-sec-erCensus",
    title: "ER Census",
    open: !!open.erCensus,
    onToggle: () => setOpen(o => ({
      ...o,
      erCensus: !o.erCensus
    }))
  }, React.createElement(ScalarFields, {
    fields: ER_FIELDS,
    val: rep.erCensus,
    onChange: v => editSec('erCensus', v),
    readOnly: readOnly,
    sectionKey: "erCensus"
  })), React.createElement(SecCard, {
    anchor: "sup-sec-general",
    title: "General Information",
    open: !!open.general,
    onToggle: () => setOpen(o => ({
      ...o,
      general: !o.general
    }))
  }, React.createElement(ScalarFields, {
    fields: GENERAL_FIELDS,
    val: rep.general,
    onChange: v => editSec('general', v),
    readOnly: readOnly,
    sectionKey: "general"
  })), React.createElement(SecCard, {
    anchor: "sup-sec-census",
    title: "Department-wise Census",
    open: !!open.census,
    onToggle: () => setOpen(o => ({
      ...o,
      census: !o.census
    }))
  }, React.createElement(CensusFields, {
    deptNames: deptNames,
    val: rep.census,
    onChange: v => editSec('census', v),
    readOnly: readOnly
  })), React.createElement("div", {
    className: "sup-group"
  }, "Notes & Sign-off"), React.createElement(SecCard, {
    anchor: "sup-sec-notes",
    title: "Absenteeism \xB7 Sick Leave \xB7 Round Observation",
    open: !!open.notes,
    onToggle: () => setOpen(o => ({
      ...o,
      notes: !o.notes
    }))
  }, React.createElement("div", {
    className: "sup-fld",
    style: {
      marginBottom: 10
    }
  }, React.createElement("label", null, "Absenteeism"), React.createElement("textarea", {
    rows: 2,
    value: rep.absenteeism,
    onChange: e => edit({
      absenteeism: e.target.value
    }),
    disabled: readOnly
  })), React.createElement("div", {
    className: "sup-fld",
    style: {
      marginBottom: 10
    }
  }, React.createElement("label", null, "Sick Leave"), React.createElement("textarea", {
    rows: 2,
    value: rep.sickLeave,
    onChange: e => edit({
      sickLeave: e.target.value
    }),
    disabled: readOnly
  })), React.createElement("div", {
    className: "sup-fld"
  }, React.createElement("label", null, "Observation During Hospital Round"), React.createElement("textarea", {
    rows: 3,
    value: rep.roundObservation,
    onChange: e => edit({
      roundObservation: e.target.value
    }),
    disabled: readOnly
  }))), React.createElement(SecCard, {
    anchor: "sup-sec-sign",
    title: "Authorisation / Sign-off",
    open: !!open.sign,
    onToggle: () => setOpen(o => ({
      ...o,
      sign: !o.sign
    }))
  }, React.createElement("div", {
    className: "sup-scalar"
  }, [['prepared', 'Prepared by'], ['reviewed', 'Checked by'], ['recommended', 'Recommended by'], ['approved', 'Approved by']].map(([k, l]) => React.createElement("div", {
    className: "sup-fld",
    key: k
  }, React.createElement("label", null, l), React.createElement("input", {
    value: (rep.sign || {})[k] || '',
    onChange: e => saveSig({
      ...(rep.sign || {}),
      [k]: e.target.value
    }),
    disabled: readOnly
  })))), React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--muted,#64748b)',
      marginTop: 8
    }
  }, "These names are shared with every UNICO report builder.")), React.createElement("div", {
    className: "sup-group"
  }, "Custom Sections"), cfg.sections.map(cs => React.createElement(SecCard, {
    key: cs.key,
    anchor: 'sup-sec-' + cs.key,
    title: cs.title + '  · custom',
    count: (rep[cs.key] || []).length,
    open: !!open[cs.key],
    onToggle: () => setOpen(o => ({
      ...o,
      [cs.key]: !o[cs.key]
    }))
  }, React.createElement(RowsEditor, {
    section: {
      key: cs.key,
      title: cs.title,
      sn: true,
      cols: []
    },
    rows: rep[cs.key],
    deptNames: deptNames,
    readOnly: readOnly,
    onChange: v => editSec(cs.key, v),
    onLookup: lookupUhid
  }), !readOnly && React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, React.createElement(SupBtn, {
    sm: true,
    kind: "dgr",
    onClick: () => removeCustomSection(cs.key)
  }, React.createElement(Ic, {
    d: I.x,
    s: 13
  }), "Delete section")))), !readOnly && React.createElement("div", null, React.createElement(SupBtn, {
    onClick: () => setAddSec(true)
  }, React.createElement(Ic, {
    d: I.plus,
    s: 15
  }), "Add Custom Section"), React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted,#64748b)',
      marginLeft: 10
    }
  }, "Add a whole new titled section with its own custom fields.")), !readOnly && React.createElement("button", {
    className: "sup-fab",
    title: "Add patient",
    onClick: () => setQuickAdd(true)
  }, React.createElement(Ic, {
    d: I.plus,
    s: 24,
    c: "#fff"
  })), quickAdd && React.createElement(QuickAddModal, {
    deptNames: deptNames,
    onLookup: lookupUhid,
    onClose: () => setQuickAdd(false),
    onAdd: addPatient
  }), carryOpen && React.createElement(CarryForwardModal, {
    currentId: rep.id,
    currentRep: rep,
    onClose: () => setCarryOpen(false),
    onImport: (patch, src, total) => {
      if (!total) {
        supToast('Nothing new to carry forward (all already listed).', 'info');
        return;
      }
      edit(patch);
      setOpen(o => {
        const n = {
          ...o
        };
        Object.keys(patch).forEach(k => {
          n[k] = true;
        });
        return n;
      });
      supToast('Carried forward ' + total + ' entr(ies) from ' + src.date + ' · ' + src.shift + '.', 'success');
    }
  }), addSec && supPortal(React.createElement("div", {
    className: "sup-modal-bg",
    onClick: () => setAddSec(false)
  }, React.createElement("div", {
    className: "sup-modal",
    onClick: e => e.stopPropagation(),
    style: {
      maxWidth: 440
    }
  }, React.createElement("div", {
    className: "sup-modal-h"
  }, React.createElement("div", {
    className: "sup-hero-ic",
    style: {
      width: 36,
      height: 36,
      background: 'rgba(255,255,255,.18)'
    }
  }, React.createElement(Ic, {
    d: I.plus,
    s: 18,
    c: "#fff"
  })), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 800,
      fontSize: 15
    }
  }, "Add Custom Section"), React.createElement("div", {
    style: {
      fontSize: 11.5,
      opacity: .9
    }
  }, "A new titled table you can add fields to")), React.createElement("button", {
    className: "sup-modal-x",
    onClick: () => setAddSec(false)
  }, React.createElement(Ic, {
    d: I.x,
    s: 16,
    c: "#fff"
  }))), React.createElement("div", {
    className: "sup-modal-b"
  }, React.createElement("div", {
    className: "sup-fld"
  }, React.createElement("label", null, "Section name"), React.createElement("input", {
    autoFocus: true,
    value: secName,
    onChange: e => setSecName(e.target.value),
    placeholder: "e.g. Isolation Patients, Handover Notes",
    onKeyDown: e => {
      if (e.key === 'Enter') createCustomSection(secName);
    }
  }))), React.createElement("div", {
    className: "sup-modal-f"
  }, React.createElement(SupBtn, {
    onClick: () => setAddSec(false)
  }, "Cancel"), React.createElement("span", {
    style: {
      flex: 1
    }
  }), React.createElement(SupBtn, {
    kind: "pri",
    onClick: () => createCustomSection(secName)
  }, React.createElement(Ic, {
    d: I.check,
    s: 15
  }), "Create section"))))));
}
function SupHistory({
  setRoute
}) {
  const [list, setList] = useState(null);
  const [f, setF] = useState({
    from: '',
    to: '',
    shift: '',
    status: '',
    q: ''
  });
  const [sel, setSel] = useState([]);
  const admin = supIsAdmin();
  const load = () => supApi.get('/api/supervisor-reports?limit=1000').then(j => {
    if (j.ok) {
      setList(j.reports);
      supRefreshAlertBadge(j.reports);
    }
  });
  useEffect(() => {
    load();
  }, []);
  const filtered = useMemo(() => {
    if (!list) return [];
    const q = f.q.trim().toLowerCase();
    return list.filter(r => {
      if (f.from && r.date < f.from) return false;
      if (f.to && r.date > f.to) return false;
      if (f.shift && r.shift !== f.shift) return false;
      if (f.status && r.status !== f.status) return false;
      if (q) {
        const hay = (r.supervisorName || '') + ' ' + r.date + ' ' + r.shift + ' ' + ['newAdmissions', 'criticalArea', 'discharged'].map(k => (r[k] || []).map(x => (x.name || '') + ' ' + (x.uhid || '')).join(' ')).join(' ');
        if (hay.toLowerCase().indexOf(q) < 0) return false;
      }
      return true;
    });
  }, [list, f]);
  const duplicate = async r => {
    const full = await supApi.get('/api/supervisor-reports/' + r.id).then(j => j.report);
    if (!full) return;
    const copy = {
      ...full
    };
    delete copy.id;
    delete copy._id;
    copy.status = 'draft';
    copy.date = supTodayISO();
    copy.shift = supCurrentShift();
    const j = await supApi.post('/api/supervisor-reports', copy);
    if (j.ok) {
      supToast('Duplicated as a new draft.', 'success');
      setRoute({
        view: 'supNew',
        id: j.report.id
      });
    }
  };
  const remove = async r => {
    if (!window.confirm('Delete this report permanently?')) return;
    await supApi.del('/api/supervisor-reports/' + r.id);
    load();
    setSel(s => s.filter(x => x !== r.id));
  };
  const setStatus = async (r, status) => {
    await supApi.post('/api/supervisor-reports/' + r.id + '/status', {
      status
    });
    load();
  };
  const toggleSel = id => setSel(s => s.indexOf(id) >= 0 ? s.filter(x => x !== id) : s.length < 2 ? [...s, id] : [s[1], id]);
  if (!list) return React.createElement("div", {
    style: {
      padding: 40,
      textAlign: 'center',
      color: 'var(--muted,#64748b)'
    }
  }, "Loading\u2026");
  const cmp = sel.length === 2 ? sel.map(id => list.find(r => r.id === id)).filter(Boolean) : [];
  return React.createElement("div", {
    className: "sup-wrap"
  }, React.createElement(SupHero, {
    icon: I.doc,
    title: "Report History",
    sub: list.length + ' report(s) · search, compare, duplicate & export',
    right: React.createElement(SupBtn, {
      sm: true,
      kind: "pri",
      onClick: () => setRoute({
        view: 'supNew'
      })
    }, React.createElement(Ic, {
      d: I.plus,
      s: 15
    }), "New Report")
  }), React.createElement("div", {
    className: "sup-card"
  }, React.createElement("div", {
    className: "sup-card-b"
  }, React.createElement("div", {
    className: "sup-scalar"
  }, React.createElement("div", {
    className: "sup-fld"
  }, React.createElement("label", null, "From"), React.createElement("input", {
    type: "date",
    value: f.from,
    onChange: e => setF({
      ...f,
      from: e.target.value
    })
  })), React.createElement("div", {
    className: "sup-fld"
  }, React.createElement("label", null, "To"), React.createElement("input", {
    type: "date",
    value: f.to,
    onChange: e => setF({
      ...f,
      to: e.target.value
    })
  })), React.createElement("div", {
    className: "sup-fld"
  }, React.createElement("label", null, "Shift"), React.createElement("select", {
    value: f.shift,
    onChange: e => setF({
      ...f,
      shift: e.target.value
    })
  }, React.createElement("option", {
    value: ""
  }, "All"), SUP_SHIFTS.map(s => React.createElement("option", {
    key: s
  }, s)))), React.createElement("div", {
    className: "sup-fld"
  }, React.createElement("label", null, "Status"), React.createElement("select", {
    value: f.status,
    onChange: e => setF({
      ...f,
      status: e.target.value
    })
  }, React.createElement("option", {
    value: ""
  }, "All"), ['draft', 'submitted', 'approved'].map(s => React.createElement("option", {
    key: s
  }, s)))), React.createElement("div", {
    className: "sup-fld"
  }, React.createElement("label", null, "Search (name / UHID)"), React.createElement("input", {
    value: f.q,
    onChange: e => setF({
      ...f,
      q: e.target.value
    }),
    placeholder: "Search\u2026"
  }))))), cmp.length === 2 && React.createElement("div", {
    className: "sup-card"
  }, React.createElement("div", {
    className: "sup-card-b"
  }, React.createElement("div", {
    style: {
      fontWeight: 700,
      marginBottom: 8
    }
  }, "Compare shifts"), React.createElement("div", {
    className: "sup-tblwrap"
  }, React.createElement("table", {
    className: "sup-tbl",
    style: {
      minWidth: 320
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Metric"), cmp.map(r => React.createElement("th", {
    key: r.id
  }, r.date, " \xB7 ", r.shift)))), React.createElement("tbody", null, [['New Admissions', r => (r.newAdmissions || []).length], ['Discharged', r => (r.discharged || []).length], ['Critical-area', r => (r.criticalArea || []).length], ['Deaths', r => supComputeTotals(r).death], ['Census TOTAL', r => (r.census || {}).TOTAL || '—']].map(([l, fn]) => React.createElement("tr", {
    key: l
  }, React.createElement("td", {
    "data-label": "Metric"
  }, l), cmp.map(r => React.createElement("td", {
    key: r.id,
    "data-label": r.date
  }, fn(r)))))))))), React.createElement("div", {
    className: "sup-card"
  }, React.createElement("div", {
    className: "sup-card-b",
    style: {
      padding: 0
    }
  }, React.createElement("div", {
    className: "sup-tblwrap"
  }, React.createElement("table", {
    className: "sup-tbl",
    style: {
      minWidth: 720
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: {
      width: 30
    }
  }), React.createElement("th", null, "Date"), React.createElement("th", null, "Shift"), React.createElement("th", null, "Supervisor"), React.createElement("th", null, "Adm."), React.createElement("th", null, "Disch."), React.createElement("th", null, "Status"), React.createElement("th", {
    style: {
      width: 250
    }
  }, "Actions"))), React.createElement("tbody", null, filtered.length === 0 && React.createElement("tr", null, React.createElement("td", {
    colSpan: 8,
    "data-label": "",
    style: {
      textAlign: 'center',
      padding: 16,
      color: '#94a3b8'
    }
  }, "No reports match.")), filtered.map(r => React.createElement("tr", {
    key: r.id
  }, React.createElement("td", {
    "data-label": "Compare"
  }, React.createElement("input", {
    type: "checkbox",
    checked: sel.indexOf(r.id) >= 0,
    onChange: () => toggleSel(r.id),
    title: "Select to compare (max 2)"
  })), React.createElement("td", {
    "data-label": "Date"
  }, r.date), React.createElement("td", {
    "data-label": "Shift"
  }, r.shift), React.createElement("td", {
    "data-label": "Supervisor"
  }, r.supervisorName || '—'), React.createElement("td", {
    "data-label": "Adm."
  }, (r.newAdmissions || []).length), React.createElement("td", {
    "data-label": "Disch."
  }, (r.discharged || []).length), React.createElement("td", {
    "data-label": "Status"
  }, React.createElement(StatusBadge, {
    status: r.status
  })), React.createElement("td", {
    "data-label": "Actions",
    style: {
      whiteSpace: 'nowrap'
    }
  }, React.createElement(SupBtn, {
    sm: true,
    onClick: () => setRoute({
      view: 'supNew',
      id: r.id
    })
  }, "Open"), ' ', React.createElement(SupBtn, {
    sm: true,
    onClick: () => setRoute({
      view: 'supReport',
      id: r.id
    })
  }, React.createElement(Ic, {
    d: I.print,
    s: 13
  }), "Export"), ' ', React.createElement(SupBtn, {
    sm: true,
    onClick: () => duplicate(r)
  }, "Duplicate"), ' ', r.status === 'draft' && React.createElement(SupBtn, {
    sm: true,
    onClick: () => setStatus(r, 'submitted')
  }, "Submit"), admin && r.status === 'submitted' && React.createElement(SupBtn, {
    sm: true,
    onClick: () => setStatus(r, 'approved')
  }, "Approve"), admin && React.createElement(SupBtn, {
    sm: true,
    kind: "dgr",
    onClick: () => remove(r)
  }, "Delete"))))))))));
}
function SupHome({
  setRoute
}) {
  const [list, setList] = useState(null);
  useEffect(() => {
    supApi.get('/api/supervisor-reports?limit=90').then(j => {
      if (j.ok) {
        setList(j.reports);
        supRefreshAlertBadge(j.reports);
      }
    });
  }, []);
  if (!list) return React.createElement("div", {
    style: {
      padding: 40,
      textAlign: 'center',
      color: 'var(--muted,#64748b)'
    }
  }, "Loading\u2026");
  const today = supTodayISO();
  const last7 = list.filter(r => r.date >= new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10));
  const sum = (arr, fn) => arr.reduce((s, r) => s + fn(r), 0);
  const kAdm = sum(last7, r => (r.newAdmissions || []).length);
  const kDis = sum(last7, r => (r.discharged || []).length);
  const kDeath = sum(last7, r => supComputeTotals(r).death);
  const kCrit = sum(last7, r => (r.criticalArea || []).length);
  const trend = list.slice(0, 14).reverse().map(r => ({
    v: (r.newAdmissions || []).length,
    label: r.date
  }));
  const todays = list.filter(r => r.date === today);
  const missing = SUP_SHIFTS.filter(s => !todays.some(r => r.shift === s));
  const critical = [];
  todays.forEach(r => supComputeAlerts(r).filter(a => a.level === 'critical').forEach(a => critical.push(r.shift + ' shift — ' + a.text)));
  return React.createElement("div", {
    className: "sup-wrap"
  }, React.createElement(SupHero, {
    icon: I.grid,
    title: "Supervisor Dashboard",
    sub: 'Shift overview · ' + supTodayISO() + ' · current shift: ' + supCurrentShift(),
    right: React.createElement(React.Fragment, null, React.createElement(SupBtn, {
      sm: true,
      onClick: () => setRoute({
        view: 'supBoard'
      })
    }, React.createElement(Ic, {
      d: I.layers,
      s: 14
    }), "Patient Board"), React.createElement(SupBtn, {
      sm: true,
      onClick: () => setRoute({
        view: 'supHistory'
      })
    }, "History"))
  }), React.createElement("div", {
    className: "sup-startbar"
  }, React.createElement("span", {
    className: "sup-startbar-l"
  }, "Start a report:"), SUP_SHIFTS.map(s => React.createElement(SupBtn, {
    key: s,
    sm: true,
    kind: s === supCurrentShift() ? 'pri' : '',
    onClick: () => setRoute({
      view: 'supNew',
      shift: s
    })
  }, React.createElement(Ic, {
    d: I.plus,
    s: 14
  }), s))), (missing.length > 0 || critical.length > 0) && React.createElement("div", null, critical.map((c, i) => React.createElement("div", {
    key: 'c' + i,
    className: "sup-alert critical"
  }, React.createElement(Ic, {
    d: I.bell,
    s: 15
  }), c)), missing.length > 0 && React.createElement("div", {
    className: "sup-alert warn"
  }, React.createElement(Ic, {
    d: I.bell,
    s: 15
  }), "No report yet today for: ", missing.join(', '), " shift", missing.length > 1 ? 's' : '', ".")), React.createElement("div", {
    className: "sup-kpis"
  }, React.createElement("div", {
    className: "sup-kpi"
  }, React.createElement("div", {
    className: "n"
  }, kAdm), React.createElement("div", {
    className: "l"
  }, "Admissions (7 days)")), React.createElement("div", {
    className: "sup-kpi"
  }, React.createElement("div", {
    className: "n"
  }, kDis), React.createElement("div", {
    className: "l"
  }, "Discharges (7 days)")), React.createElement("div", {
    className: "sup-kpi"
  }, React.createElement("div", {
    className: "n"
  }, kCrit), React.createElement("div", {
    className: "l"
  }, "Critical-area (7 days)")), React.createElement("div", {
    className: "sup-kpi"
  }, React.createElement("div", {
    className: "n"
  }, kDeath), React.createElement("div", {
    className: "l"
  }, "Deaths (7 days)"))), React.createElement("div", {
    className: "sup-card"
  }, React.createElement("div", {
    className: "sup-card-b"
  }, React.createElement("div", {
    style: {
      fontWeight: 700,
      marginBottom: 6,
      fontSize: 13
    }
  }, "New admissions \u2014 last 14 shifts"), trend.length ? React.createElement(MiniBars, {
    data: trend
  }) : React.createElement("div", {
    style: {
      color: '#94a3b8',
      fontSize: 12
    }
  }, "No data yet."))), React.createElement("div", {
    className: "sup-card"
  }, React.createElement("div", {
    className: "sup-card-b",
    style: {
      padding: 0
    }
  }, React.createElement("div", {
    className: "sup-tblwrap"
  }, React.createElement("table", {
    className: "sup-tbl",
    style: {
      minWidth: 560
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Date"), React.createElement("th", null, "Shift"), React.createElement("th", null, "Supervisor"), React.createElement("th", null, "Adm."), React.createElement("th", null, "Status"), React.createElement("th", null))), React.createElement("tbody", null, list.slice(0, 8).map(r => React.createElement("tr", {
    key: r.id
  }, React.createElement("td", {
    "data-label": "Date"
  }, r.date), React.createElement("td", {
    "data-label": "Shift"
  }, r.shift), React.createElement("td", {
    "data-label": "Supervisor"
  }, r.supervisorName || '—'), React.createElement("td", {
    "data-label": "Adm."
  }, (r.newAdmissions || []).length), React.createElement("td", {
    "data-label": "Status"
  }, React.createElement(StatusBadge, {
    status: r.status
  })), React.createElement("td", {
    "data-label": ""
  }, React.createElement(SupBtn, {
    sm: true,
    onClick: () => setRoute({
      view: 'supNew',
      id: r.id
    })
  }, "Open")))), list.length === 0 && React.createElement("tr", null, React.createElement("td", {
    colSpan: 6,
    "data-label": "",
    style: {
      textAlign: 'center',
      padding: 16,
      color: '#94a3b8'
    }
  }, "No reports yet \u2014 start one above."))))))));
}
const RPT_SECTIONS = [{
  key: 'newAdmissions',
  title: 'New Admission',
  kind: 'rows'
}, {
  key: 'criticalArea',
  title: 'Patient in Critical Areas',
  kind: 'rows'
}, {
  key: 'cabinArea',
  title: 'Patient in Cabin Areas',
  kind: 'rows'
}, {
  key: 'lama',
  title: 'LAMA / DAMA',
  kind: 'rows'
}, {
  key: 'discharged',
  title: 'Discharged',
  kind: 'rows'
}, {
  key: 'otTable',
  title: 'OT',
  kind: 'rows'
}, {
  key: 'surgeries',
  title: 'Surgery Details',
  kind: 'rows'
}, {
  key: 'interventional',
  title: 'Interventional Procedure',
  kind: 'rows'
}, {
  key: 'radiological',
  title: 'Radiological Interventional Procedure',
  kind: 'rows'
}, {
  key: 'radiologyCounts',
  title: 'Radiology Counts',
  kind: 'counts',
  fields: RADIOLOGY_FIELDS
}, {
  key: 'ventilators',
  title: 'Ventilator Status',
  kind: 'rows'
}, {
  key: 'erCensus',
  title: 'ER Census',
  kind: 'counts',
  fields: ER_FIELDS
}, {
  key: 'general',
  title: 'General Information',
  kind: 'counts',
  fields: GENERAL_FIELDS
}, {
  key: 'pressureSore',
  title: 'Patients with Pressure Sore',
  kind: 'rows'
}, {
  key: 'phlebitis',
  title: 'Patients with Phlebitis',
  kind: 'rows'
}, {
  key: 'notes',
  title: 'Absenteeism · Sick Leave · Round Observation',
  kind: 'notes'
}, {
  key: 'census',
  title: 'Department-wise Census',
  kind: 'census'
}];
const SUP_TEMPLATES = {
  full: {
    label: 'Full Log Sheet',
    keys: null
  },
  summary: {
    label: 'Summary Only',
    keys: ['radiologyCounts', 'erCensus', 'general', 'census']
  },
  critical: {
    label: 'Critical + Registers',
    keys: ['criticalArea', 'pressureSore', 'phlebitis', 'general']
  }
};
function RptRows({
  section,
  rows
}) {
  rows = rows || [];
  if (!rows.length) return null;
  const base = SUP_SEC_BY_KEY[section.key];
  const cfg = supLoadFields();
  const cols = (base && base.cols || []).concat(cfg.cols[section.key] || []);
  const sn = base ? base.sn : true;
  const disp = (c, v) => c.type === 'check' ? v ? '✓' : '' : v == null ? '' : v;
  return React.createElement("table", {
    className: "sup-rpt-tbl"
  }, React.createElement("thead", null, React.createElement("tr", null, sn && React.createElement("th", null, "S/N"), cols.map(c => React.createElement("th", {
    key: c.id
  }, c.label)))), React.createElement("tbody", null, rows.map((r, i) => React.createElement("tr", {
    key: i
  }, sn && React.createElement("td", null, i + 1), cols.map(c => React.createElement("td", {
    key: c.id
  }, disp(c, r[c.id])))))));
}
function RptCounts({
  fields,
  val,
  sectionKey
}) {
  val = val || {};
  const custom = sectionKey && supLoadFields().cols[sectionKey] || [];
  const all = fields.concat(custom.map(c => [c.id, c.label, c.type]));
  const disp = (id, type) => type === 'check' ? val[id] ? '✓' : '' : val[id] == null ? '' : val[id];
  return React.createElement("table", {
    className: "sup-rpt-tbl"
  }, React.createElement("tbody", null, all.map(f => React.createElement("tr", {
    key: f[0]
  }, React.createElement("th", {
    style: {
      width: '55%'
    }
  }, f[1]), React.createElement("td", null, disp(f[0], f[2]))))));
}
function SupReportView({
  id,
  depts,
  setRoute
}) {
  const deptNames = useMemo(() => supDeptNames(depts), [depts]);
  const cfg = useFields();
  const rptSecs = useMemo(() => RPT_SECTIONS.concat((cfg.sections || []).map(s => ({
    key: s.key,
    title: s.title,
    kind: 'rows'
  }))), [cfg]);
  const [list, setList] = useState(null);
  const [rep, setRep] = useState(null);
  const [customize, setCustomize] = useState(false);
  const [disabled, setDisabled] = useState({});
  const [exporting, setExporting] = useState(false);
  const pdfRoot = typeof document !== 'undefined' ? document.getElementById('pdf-root') : null;
  useEffect(() => {
    supApi.get('/api/supervisor-reports?limit=1000').then(j => {
      if (j.ok) setList(j.reports);
    });
  }, []);
  useEffect(() => {
    const target = id || list && list[0] && list[0].id;
    if (!target) return;
    supApi.get('/api/supervisor-reports/' + target).then(j => {
      if (j.ok) setRep(j.report);
    });
  }, [id, list]);
  const applyTemplate = t => {
    const keys = SUP_TEMPLATES[t].keys;
    if (!keys) {
      setDisabled({});
      return;
    }
    const d = {};
    rptSecs.forEach(s => {
      if (keys.indexOf(s.key) < 0) d[s.key] = true;
    });
    setDisabled(d);
  };
  const isOn = key => !disabled[key];
  const toggleSec = key => setDisabled(m => ({
    ...m,
    [key]: !m[key]
  }));
  const doPrint = () => {
    try {
      document.body.classList.add('pdf-export-mode');
      setTimeout(() => {
        window.print();
        setTimeout(() => document.body.classList.remove('pdf-export-mode'), 600);
      }, 60);
    } catch (e) {}
  };
  const doExport = async () => {
    if (!rep) return;
    setExporting(true);
    const fn = 'Supervisor-Report-' + (rep.date || '') + '-' + (rep.shift || '') + '.pdf';
    try {
      let ok = false;
      if (window.unicoHtmlServerPDF) ok = await window.unicoHtmlServerPDF('A4', 'portrait', fn);
      if (!ok) doPrint();
    } catch (e) {
      doPrint();
    } finally {
      setExporting(false);
    }
  };
  if (!list) return React.createElement("div", {
    style: {
      padding: 40,
      textAlign: 'center',
      color: 'var(--muted,#64748b)'
    }
  }, "Loading\u2026");
  const sig = rep && rep.sign || (window.unicoSig ? window.unicoSig.load() : {});
  const HOSP = window.UNICO && window.UNICO.HOSPITAL && window.UNICO.HOSPITAL.name || 'UNICO Hospitals PLC';
  const activeSecs = rptSecs.filter(s => isOn(s.key));
  const PageInner = rep ? React.createElement("div", null, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      borderBottom: '2px solid #1e3a8a',
      paddingBottom: 8,
      marginBottom: 10
    }
  }, React.createElement("img", {
    src: "unico/logo.svg",
    alt: "",
    style: {
      height: 42
    },
    onError: e => {
      e.target.style.display = 'none';
    }
  }), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 800,
      color: '#0f172a'
    }
  }, HOSP), React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      color: '#1e3a8a'
    }
  }, "Log Sheet For ", rep.shift, " Supervisor")), React.createElement("div", {
    style: {
      fontSize: 10.5,
      textAlign: 'right',
      color: '#334155'
    }
  }, React.createElement("div", null, React.createElement("b", null, "Supervisor:"), " ", rep.supervisorName || '—'), React.createElement("div", null, React.createElement("b", null, "Date:"), " ", rep.date, " \xA0 ", React.createElement("b", null, "Shift:"), " ", rep.shift), rep.shiftTime ? React.createElement("div", null, React.createElement("b", null, "Time:"), " ", rep.shiftTime) : null)), activeSecs.map(s => {
    if (s.kind === 'rows') {
      const rows = rep[s.key] || [];
      if (!rows.length) return null;
      return React.createElement("div", {
        key: s.key
      }, React.createElement("div", {
        className: "sup-sec-h"
      }, s.title, " : ", rows.length), React.createElement(RptRows, {
        section: s,
        rows: rows
      }));
    }
    if (s.kind === 'counts') {
      return React.createElement("div", {
        key: s.key
      }, React.createElement("div", {
        className: "sup-sec-h"
      }, s.title), React.createElement(RptCounts, {
        fields: s.fields,
        val: rep[s.key],
        sectionKey: s.key
      }));
    }
    if (s.kind === 'notes') {
      return React.createElement("div", {
        key: s.key
      }, React.createElement("div", {
        className: "sup-sec-h"
      }, s.title), React.createElement("table", {
        className: "sup-rpt-tbl"
      }, React.createElement("tbody", null, React.createElement("tr", null, React.createElement("th", {
        style: {
          width: '25%'
        }
      }, "Absenteeism"), React.createElement("td", null, rep.absenteeism || '—')), React.createElement("tr", null, React.createElement("th", null, "Sick Leave"), React.createElement("td", null, rep.sickLeave || '—')), React.createElement("tr", null, React.createElement("th", null, "Observation During Round"), React.createElement("td", null, rep.roundObservation || '—')))));
    }
    if (s.kind === 'census') {
      const cen = rep.census || {};
      const keys = ['OPD Total'].concat(deptNames);
      return React.createElement("div", {
        key: s.key
      }, React.createElement("div", {
        className: "sup-sec-h"
      }, s.title), React.createElement("table", {
        className: "sup-rpt-tbl"
      }, React.createElement("thead", null, React.createElement("tr", null, keys.map(k => React.createElement("th", {
        key: k
      }, k)), React.createElement("th", null, "TOTAL"))), React.createElement("tbody", null, React.createElement("tr", null, keys.map(k => React.createElement("td", {
        key: k
      }, cen[k] || '')), React.createElement("td", null, React.createElement("b", null, cen.TOTAL != null ? cen.TOTAL : supComputeCensusTotal(cen, deptNames)))))));
    }
    return null;
  }), React.createElement("table", {
    className: "sup-rpt-tbl",
    style: {
      marginTop: 16
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Prepared by"), React.createElement("th", null, "Checked by"), React.createElement("th", null, "Recommended by"), React.createElement("th", null, "Approved by"))), React.createElement("tbody", null, React.createElement("tr", {
    style: {
      height: 46
    }
  }, React.createElement("td", null, sig.prepared || ''), React.createElement("td", null, sig.reviewed || ''), React.createElement("td", null, sig.recommended || ''), React.createElement("td", null, sig.approved || '')))), React.createElement("div", {
    className: "pdf-foot",
    style: {
      borderTop: '1px solid #cbd5e1',
      marginTop: 12,
      paddingTop: 6,
      fontSize: 9,
      color: '#64748b',
      display: 'flex',
      justifyContent: 'space-between'
    }
  }, React.createElement("span", null, HOSP, " \u2014 Supervisor Log Sheet"), React.createElement("span", null, "Generated ", supTodayISO()))) : null;
  return React.createElement("div", {
    className: "sup-wrap"
  }, React.createElement(SupHero, {
    icon: I.print,
    title: "Generate Report",
    sub: "One-click board-ready PDF \xB7 quick templates \xB7 custom sections"
  }), React.createElement("div", {
    className: "sup-toolbar sup-sticky"
  }, React.createElement(SupBtn, {
    sm: true,
    onClick: () => setRoute({
      view: 'supHistory'
    })
  }, React.createElement(Ic, {
    d: I.chevR,
    s: 14,
    style: {
      transform: 'rotate(180deg)'
    }
  }), "Back"), React.createElement("span", {
    style: {
      flex: 1
    }
  }), React.createElement("select", {
    value: rep && rep.id || '',
    onChange: e => supApi.get('/api/supervisor-reports/' + e.target.value).then(j => {
      if (j.ok) setRep(j.report);
    }),
    style: {
      padding: '6px 9px',
      borderRadius: 8,
      border: '1px solid var(--line,#d1d5db)',
      fontSize: 12.5
    }
  }, list.map(r => React.createElement("option", {
    key: r.id,
    value: r.id
  }, r.date, " \xB7 ", r.shift, " \xB7 ", r.supervisorName || '—'))), React.createElement(SupBtn, {
    sm: true,
    onClick: doPrint
  }, React.createElement(Ic, {
    d: I.print,
    s: 14
  }), "Print"), React.createElement(SupBtn, {
    sm: true,
    kind: "pri",
    onClick: doExport,
    disabled: exporting || !rep
  }, React.createElement(Ic, {
    d: I.download,
    s: 14
  }), exporting ? 'Exporting…' : 'Export PDF')), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: 'var(--muted,#64748b)'
    }
  }, "Quick template:"), Object.keys(SUP_TEMPLATES).map(t => React.createElement(SupBtn, {
    key: t,
    sm: true,
    onClick: () => applyTemplate(t)
  }, SUP_TEMPLATES[t].label)), React.createElement(SupBtn, {
    sm: true,
    onClick: () => setCustomize(c => !c)
  }, React.createElement(Ic, {
    d: I.filter,
    s: 13
  }), "Customize sections")), customize && React.createElement("div", {
    className: "sup-card"
  }, React.createElement("div", {
    className: "sup-card-b"
  }, React.createElement("div", {
    className: "sup-scalar"
  }, rptSecs.map(s => React.createElement("label", {
    key: s.key,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      fontSize: 12.5,
      fontWeight: 600
    }
  }, React.createElement("input", {
    type: "checkbox",
    checked: isOn(s.key),
    onChange: () => toggleSec(s.key)
  }), s.title))))), React.createElement("div", {
    className: "sup-paper"
  }, rep ? React.createElement("div", {
    className: "pdf-page"
  }, PageInner) : React.createElement("div", {
    style: {
      padding: 30,
      textAlign: 'center',
      color: '#94a3b8'
    }
  }, "Select a report to preview.")), pdfRoot && rep && ReactDOM.createPortal(React.createElement("div", {
    className: "pdf-doc portrait"
  }, React.createElement("section", {
    className: "pdf-page"
  }, PageInner)), pdfRoot));
}
function BoardEditModal({
  patient,
  deptNames,
  onClose,
  onSaved
}) {
  const [rep, setRep] = useState(null);
  const [idx, setIdx] = useState(-1);
  const [row, setRow] = useState(null);
  const [busy, setBusy] = useState(false);
  const cfg = useFields();
  useEffect(() => {
    if (!patient || !patient.repId) {
      setRow({
        ...(patient || {})
      });
      return;
    }
    supApi.get('/api/supervisor-reports/' + patient.repId).then(j => {
      if (j.ok && j.report) {
        const sec = patient.section || 'criticalArea';
        const arr = j.report[sec] || [];
        const i = arr.findIndex(r => supPatKey(r) === patient.key);
        setRep(j.report);
        setIdx(i);
        setRow(i >= 0 ? {
          ...arr[i]
        } : {
          ...patient
        });
      }
    });
  }, [patient]);
  const set = (k, v) => setRow(r => ({
    ...r,
    [k]: v
  }));
  const save = async () => {
    if (!rep || idx < 0) {
      supToast('Could not locate the source row.', 'error');
      return;
    }
    setBusy(true);
    const sec = patient.section;
    const arr = (rep[sec] || []).slice();
    arr[idx] = {
      ...arr[idx],
      ...row
    };
    const j = await supApi.post('/api/supervisor-reports', {
      ...rep,
      [sec]: arr,
      baseUpdatedAt: rep.updatedAt || undefined
    });
    setBusy(false);
    if (j.ok) {
      supToast('Patient updated.', 'success');
      onSaved && onSaved();
      onClose();
    } else supToast(j.error || 'Save failed.', 'error');
  };
  if (!patient) return null;
  const custom = rep && cfg.cols[patient.section] || [];
  const f = (label, k, node) => React.createElement("div", {
    className: "sup-fld"
  }, React.createElement("label", null, label), node);
  return supPortal(React.createElement("div", {
    className: "sup-modal-bg",
    onClick: onClose
  }, React.createElement("div", {
    className: "sup-modal",
    onClick: e => e.stopPropagation()
  }, React.createElement("div", {
    className: "sup-modal-h"
  }, React.createElement("div", {
    className: "sup-hero-ic",
    style: {
      width: 36,
      height: 36,
      background: 'rgba(255,255,255,.18)'
    }
  }, React.createElement(Ic, {
    d: I.edit,
    s: 17,
    c: "#fff"
  })), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 800,
      fontSize: 15
    }
  }, "Edit Patient"), React.createElement("div", {
    style: {
      fontSize: 11.5,
      opacity: .9
    }
  }, rep ? rep.date + ' · ' + rep.shift + ' report' : 'Loading…')), React.createElement("button", {
    className: "sup-modal-x",
    onClick: onClose
  }, React.createElement(Ic, {
    d: I.x,
    s: 16,
    c: "#fff"
  }))), React.createElement("div", {
    className: "sup-modal-b"
  }, !row ? React.createElement("div", {
    style: {
      padding: 20,
      textAlign: 'center',
      color: '#94a3b8'
    }
  }, "Loading\u2026") : React.createElement("div", null, React.createElement("div", {
    className: "sup-pcard-meta",
    style: {
      marginBottom: 12
    }
  }, SUP_SEC_BY_KEY[patient.section] && React.createElement("span", null, SUP_SEC_BY_KEY[patient.section].title), patient.critical && React.createElement("span", {
    style: {
      background: '#fee2e2',
      color: '#b91c1c'
    }
  }, "Critical"), supDaysSince(row.doa) != null && React.createElement("span", null, supDaysSince(row.doa), "d in hospital"), patient.lastSeen && React.createElement("span", null, "Last update ", patient.lastSeen.date, " \xB7 ", patient.lastSeen.shift)), React.createElement("div", {
    className: "sup-scalar"
  }, f('UHID', 'uhid', React.createElement("input", {
    value: row.uhid || '',
    onChange: e => set('uhid', e.target.value)
  })), f('Name of Patient', 'name', React.createElement(SugInput, {
    field: "name",
    value: row.name || '',
    onChange: v => set('name', v)
  })), f('Department', 'dept', React.createElement("select", {
    value: row.dept || '',
    onChange: e => set('dept', e.target.value)
  }, React.createElement("option", {
    value: ""
  }), deptNames.concat(row.dept && deptNames.indexOf(row.dept) < 0 ? [row.dept] : []).map(n => React.createElement("option", {
    key: n,
    value: n
  }, n)))), f('Bed', 'bed', React.createElement(SugInput, {
    field: "bed",
    value: row.bed || '',
    onChange: v => set('bed', v)
  })), f('Age', 'age', React.createElement(SugInput, {
    field: "age",
    value: row.age || '',
    onChange: v => set('age', v)
  })), f('Consultant', 'consultant', React.createElement(SugInput, {
    field: "consultant",
    value: row.consultant || '',
    onChange: v => set('consultant', v)
  }))), React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, f('Diagnosis', 'diagnosis', React.createElement(SugInput, {
    field: "diagnosis",
    area: true,
    value: row.diagnosis || '',
    onChange: v => set('diagnosis', v)
  }))), React.createElement("div", {
    className: "sup-scalar",
    style: {
      marginTop: 12
    }
  }, f('DOA (Date & Time)', 'doa', React.createElement(DateTimeInput, {
    value: row.doa || '',
    onChange: v => set('doa', v)
  }))), React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, f('Remarks', 'remarks', React.createElement(SugInput, {
    field: "remarks",
    area: true,
    value: row.remarks || '',
    onChange: v => set('remarks', v)
  }))), custom.length > 0 && React.createElement("div", {
    style: {
      marginTop: 14,
      borderTop: '1px dashed var(--line,#e5e7eb)',
      paddingTop: 12
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11.5,
      fontWeight: 700,
      color: '#7c3aed',
      marginBottom: 8
    }
  }, "Custom fields \u25C6"), React.createElement("div", {
    className: "sup-scalar"
  }, custom.map(c => React.createElement("div", {
    className: "sup-fld",
    key: c.id
  }, React.createElement("label", null, c.label), c.type === 'num' ? React.createElement("input", {
    type: "number",
    value: row[c.id] || '',
    onChange: e => set(c.id, e.target.value)
  }) : c.type === 'date' ? React.createElement("input", {
    type: "date",
    value: row[c.id] || '',
    onChange: e => set(c.id, e.target.value)
  }) : c.type === 'datetime' ? React.createElement(DateTimeInput, {
    value: row[c.id] || '',
    onChange: v => set(c.id, v)
  }) : c.type === 'check' ? React.createElement("label", {
    style: {
      display: 'flex',
      gap: 7,
      fontSize: 12.5,
      alignItems: 'center'
    }
  }, React.createElement("input", {
    type: "checkbox",
    checked: !!row[c.id],
    onChange: e => set(c.id, e.target.checked),
    style: {
      width: 18,
      height: 18
    }
  }), " Yes") : c.type === 'select' ? React.createElement("select", {
    value: row[c.id] || '',
    onChange: e => set(c.id, e.target.value)
  }, React.createElement("option", {
    value: ""
  }), (c.options || []).map(o => React.createElement("option", {
    key: o,
    value: o
  }, o))) : React.createElement("input", {
    value: row[c.id] || '',
    onChange: e => set(c.id, e.target.value)
  }))))))), React.createElement("div", {
    className: "sup-modal-f"
  }, React.createElement(SupBtn, {
    onClick: onClose
  }, "Cancel"), rep && patient.repId && React.createElement(SupBtn, {
    onClick: () => setRoute && setRoute({
      view: 'supNew',
      id: patient.repId
    })
  }, "Open full report"), React.createElement("span", {
    style: {
      flex: 1
    }
  }), React.createElement(SupBtn, {
    kind: "pri",
    onClick: save,
    disabled: busy || !rep || idx < 0
  }, React.createElement(Ic, {
    d: I.check,
    s: 15
  }), busy ? 'Saving…' : 'Save changes')))));
}
function SupBoard({
  depts,
  setRoute
}) {
  const deptNames = useMemo(() => supDeptNames(depts), [depts]);
  const [list, setList] = useState(null);
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [mode, setMode] = useState('cards');
  const [editing, setEditing] = useState(null);
  const load = () => supApi.get('/api/supervisor-reports?limit=1000').then(j => {
    if (j.ok) {
      setList(j.reports);
      supRefreshAlertBadge(j.reports);
    }
  });
  useEffect(() => {
    load();
  }, []);
  if (!list) return React.createElement("div", {
    style: {
      padding: 40,
      textAlign: 'center',
      color: 'var(--muted,#64748b)'
    }
  }, "Loading patient board\u2026");
  const active = supActivePatients(list);
  const depSet = [];
  active.forEach(p => {
    if (p.dept && depSet.indexOf(p.dept) < 0) depSet.push(p.dept);
  });
  depSet.sort();
  const ql = q.trim().toLowerCase();
  const filtered = active.filter(p => {
    if (dept && p.dept !== dept) return false;
    if (ql) {
      const hay = (p.name + ' ' + p.uhid + ' ' + p.consultant + ' ' + p.diagnosis).toLowerCase();
      if (hay.indexOf(ql) < 0) return false;
    }
    return true;
  });
  const byDept = {};
  filtered.forEach(p => {
    const d = p.dept || 'Unassigned';
    (byDept[d] = byDept[d] || []).push(p);
  });
  const groups = Object.keys(byDept).sort();
  return React.createElement("div", {
    className: "sup-wrap"
  }, React.createElement(SupHero, {
    icon: I.layers,
    title: "Patient Board \u2014 At a Glance",
    sub: active.length + ' patient(s) currently present · carried forward automatically across shifts',
    right: React.createElement(React.Fragment, null, React.createElement(SupBtn, {
      sm: true,
      onClick: () => setRoute({
        view: 'supNew',
        openAdd: true
      })
    }, React.createElement(Ic, {
      d: I.plus,
      s: 15
    }), "Add Patient"), React.createElement(SupBtn, {
      sm: true,
      kind: "pri",
      onClick: () => setRoute({
        view: 'supNew'
      })
    }, React.createElement(Ic, {
      d: I.doc,
      s: 15
    }), "New Report"))
  }), React.createElement("div", {
    className: "sup-kpis"
  }, React.createElement("div", {
    className: "sup-kpi"
  }, React.createElement("div", {
    className: "n"
  }, active.length), React.createElement("div", {
    className: "l"
  }, "Total patients present")), React.createElement("div", {
    className: "sup-kpi"
  }, React.createElement("div", {
    className: "n"
  }, active.filter(p => p.critical).length), React.createElement("div", {
    className: "l"
  }, "In critical areas")), React.createElement("div", {
    className: "sup-kpi"
  }, React.createElement("div", {
    className: "n"
  }, depSet.length), React.createElement("div", {
    className: "l"
  }, "Departments occupied")), React.createElement("div", {
    className: "sup-kpi"
  }, React.createElement("div", {
    className: "n"
  }, filtered.length), React.createElement("div", {
    className: "l"
  }, "Showing ", dept ? '(' + dept + ')' : '(all)'))), React.createElement("div", {
    className: "sup-toolbar"
  }, React.createElement("div", {
    className: "sup-search"
  }, React.createElement(Ic, {
    d: I.search,
    s: 15,
    c: "#94a3b8"
  }), React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Search name, UHID, consultant, diagnosis\u2026"
  })), React.createElement("div", {
    className: "sup-seg"
  }, React.createElement("button", {
    className: mode === 'cards' ? 'on' : '',
    onClick: () => setMode('cards')
  }, React.createElement(Ic, {
    d: I.grid,
    s: 13
  }), "Cards"), React.createElement("button", {
    className: mode === 'table' ? 'on' : '',
    onClick: () => setMode('table')
  }, React.createElement(Ic, {
    d: I.doc,
    s: 13
  }), "Table"))), React.createElement("div", {
    className: "sup-chips"
  }, React.createElement("span", {
    className: 'sup-chip' + (dept === '' ? ' on' : ''),
    onClick: () => setDept('')
  }, "All (", active.length, ")"), depSet.map(d => React.createElement("span", {
    key: d,
    className: 'sup-chip' + (dept === d ? ' on' : ''),
    onClick: () => setDept(d)
  }, d, " (", active.filter(p => p.dept === d).length, ")"))), filtered.length === 0 && React.createElement("div", {
    className: "sup-card"
  }, React.createElement("div", {
    className: "sup-card-b",
    style: {
      textAlign: 'center',
      color: '#94a3b8',
      padding: 30
    }
  }, "No active patients", dept ? ' in ' + dept : '', ". They appear here from admissions/critical entries and drop off when discharged.")), mode === 'table' && filtered.length > 0 && React.createElement("div", {
    className: "sup-card"
  }, React.createElement("div", {
    className: "sup-card-b",
    style: {
      padding: 0
    }
  }, React.createElement("div", {
    className: "sup-tblwrap"
  }, React.createElement("table", {
    className: "sup-tbl",
    style: {
      minWidth: 860
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: {
      width: 34
    }
  }, "#"), React.createElement("th", null, "Department"), React.createElement("th", null, "Bed"), React.createElement("th", null, "Name"), React.createElement("th", null, "UHID"), React.createElement("th", null, "Age"), React.createElement("th", null, "Days"), React.createElement("th", null, "Consultant"), React.createElement("th", null, "Diagnosis"), React.createElement("th", null, "Last update"), React.createElement("th", null, "Edit"))), React.createElement("tbody", null, filtered.map((p, i) => {
    const d = supDaysSince(p.doa);
    return React.createElement("tr", {
      key: p.key
    }, React.createElement("td", {
      "data-label": "#"
    }, i + 1), React.createElement("td", {
      "data-label": "Department"
    }, p.dept || '—', p.critical && React.createElement("span", {
      className: "sup-tag crit",
      style: {
        marginLeft: 6
      }
    }, "Crit")), React.createElement("td", {
      "data-label": "Bed"
    }, p.bed || '—'), React.createElement("td", {
      "data-label": "Name"
    }, React.createElement("b", null, p.name || '—')), React.createElement("td", {
      "data-label": "UHID"
    }, p.uhid || '—'), React.createElement("td", {
      "data-label": "Age"
    }, p.age || '—'), React.createElement("td", {
      "data-label": "Days"
    }, d != null ? d + 'd' : '—'), React.createElement("td", {
      "data-label": "Consultant"
    }, p.consultant || '—'), React.createElement("td", {
      "data-label": "Diagnosis",
      style: {
        maxWidth: 240
      }
    }, p.diagnosis || '—'), React.createElement("td", {
      "data-label": "Last update"
    }, p.lastSeen.date, " \xB7 ", p.lastSeen.shift), React.createElement("td", {
      "data-label": "Edit"
    }, React.createElement("button", {
      className: "sup-ib",
      title: "Edit patient",
      onClick: () => setEditing(p)
    }, React.createElement(Ic, {
      d: I.edit,
      s: 13
    }))));
  })))))), mode === 'cards' && groups.map(g => React.createElement("div", {
    key: g
  }, React.createElement("div", {
    className: "sup-board-dh"
  }, React.createElement("span", {
    className: "dot"
  }), g, React.createElement("span", {
    className: "n"
  }, byDept[g].length)), React.createElement("div", {
    className: "sup-board"
  }, byDept[g].map(p => {
    const days = supDaysSince(p.doa);
    return React.createElement("div", {
      key: p.key,
      className: 'sup-pcard' + (p.critical ? ' crit' : '')
    }, React.createElement("div", {
      className: "sup-pcard-h"
    }, React.createElement("div", {
      className: "sup-pcard-n"
    }, p.name || '—'), p.critical && React.createElement("span", {
      className: "sup-tag crit"
    }, "Critical")), React.createElement("div", {
      className: "sup-pcard-meta"
    }, p.uhid && React.createElement("span", null, "UHID ", p.uhid), p.age && React.createElement("span", null, p.age), p.bed && React.createElement("span", null, "Bed ", p.bed), days != null && React.createElement("span", null, days, "d in hospital")), p.consultant && React.createElement("div", {
      className: "sup-pcard-row"
    }, React.createElement("b", null, "Consultant:"), " ", p.consultant), p.diagnosis && React.createElement("div", {
      className: "sup-pcard-row"
    }, React.createElement("b", null, "Dx:"), " ", p.diagnosis), p.remarks && React.createElement("div", {
      className: "sup-pcard-note"
    }, p.remarks), React.createElement("div", {
      className: "sup-pcard-foot"
    }, React.createElement("span", {
      className: "sup-pcard-f"
    }, "Updated ", p.lastSeen.date, " \xB7 ", p.lastSeen.shift), React.createElement("button", {
      className: "sup-ib",
      title: "Edit patient",
      onClick: () => setEditing(p)
    }, React.createElement(Ic, {
      d: I.edit,
      s: 13
    }))));
  })))), editing && React.createElement(BoardEditModal, {
    patient: editing,
    deptNames: deptNames,
    setRoute: setRoute,
    onClose: () => setEditing(null),
    onSaved: load
  }));
}
function SupervisorView({
  view,
  id,
  shift,
  openAdd,
  depts,
  setRoute
}) {
  if (view === 'supHistory') return React.createElement(SupHistory, {
    setRoute: setRoute
  });
  if (view === 'supReport') return React.createElement(SupReportView, {
    id: id,
    depts: depts,
    setRoute: setRoute
  });
  if (view === 'supBoard') return React.createElement(SupBoard, {
    depts: depts,
    setRoute: setRoute
  });
  if (view === 'supNew') return React.createElement(SupEditor, {
    id: id,
    shift: shift,
    openAdd: openAdd,
    depts: depts,
    setRoute: setRoute
  });
  return React.createElement(SupHome, {
    setRoute: setRoute
  });
}
const SUP_CSS = `
.sup-wrap{display:flex;flex-direction:column;gap:16px}
/* hero */
.sup-hero{display:flex;align-items:center;gap:14px;padding:18px 20px;border-radius:16px;
  background:linear-gradient(120deg,#0d1b2e 0%,#0072a3 55%,#27a8db 100%);color:#fff;
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
.sup-sticky{padding:10px 12px;background:linear-gradient(152deg,rgba(255,255,255,.76),rgba(236,247,255,.46));backdrop-filter:blur(26px) saturate(1.75);-webkit-backdrop-filter:blur(26px) saturate(1.75);border:1px solid rgba(255,255,255,.92);box-shadow:0 14px 42px rgba(31,59,90,.14),0 4px 16px rgba(0,144,202,.09),inset 0 1px 0 rgba(255,255,255,.95);border-radius:12px}
.sup-startbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:linear-gradient(152deg,rgba(255,255,255,.76),rgba(236,247,255,.46));backdrop-filter:blur(26px) saturate(1.75);-webkit-backdrop-filter:blur(26px) saturate(1.75);border:1px solid rgba(255,255,255,.92);box-shadow:0 14px 42px rgba(31,59,90,.14),0 4px 16px rgba(0,144,202,.09),inset 0 1px 0 rgba(255,255,255,.95);border-radius:12px;padding:12px 14px}
.sup-startbar-l{font-size:12.5px;font-weight:700;color:var(--muted,#64748b)}
.sup-saved{font-size:11.5px;font-weight:700;color:var(--muted,#94a3b8)}
.sup-saved.ok{color:#15803d}
/* cards */
.sup-card{background:linear-gradient(152deg,rgba(255,255,255,.76),rgba(236,247,255,.46));backdrop-filter:blur(26px) saturate(1.75);-webkit-backdrop-filter:blur(26px) saturate(1.75);border:1px solid rgba(255,255,255,.92);box-shadow:0 14px 42px rgba(31,59,90,.14),0 4px 16px rgba(0,144,202,.09),inset 0 1px 0 rgba(255,255,255,.95);border-radius:16px;overflow:hidden}
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
.sup-navitem{display:flex;align-items:center;gap:7px;text-align:left;border:1px solid var(--line,#e5e7eb);background:rgba(255,255,255,.7);border-radius:9px;padding:7px 10px;font-size:11.5px;font-weight:600;color:#475569;cursor:pointer;transition:.12s}
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
.sup-modal{width:100%;max-width:640px;max-height:90vh;display:flex;flex-direction:column;background:rgba(255,255,255,.9);backdrop-filter:blur(30px) saturate(1.6);-webkit-backdrop-filter:blur(30px) saturate(1.6);border:1px solid rgba(255,255,255,.92);border-radius:16px;overflow:hidden;box-shadow:0 30px 70px -20px rgba(0,0,0,.55);animation:supPop .16s ease-out}
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
(function injectSupCss() {
  try {
    if (typeof document === 'undefined' || document.getElementById('sup-css')) return;
    const st = document.createElement('style');
    st.id = 'sup-css';
    st.textContent = SUP_CSS;
    document.head.appendChild(st);
  } catch (e) {}
})();
Object.assign(window, {
  SupervisorView,
  SupReports: SupervisorView
});
})();
