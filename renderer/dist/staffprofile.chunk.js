/* ===== staff-profile.jsx ===== */
(function(){
function yearsFromDOJ(doj) {
  if (!doj) return '';
  const d = new Date(doj);
  if (isNaN(d)) return '';
  const days = (Date.now() - d.getTime()) / 86400000;
  if (days < 0) return '';
  const y = days / 365.25;
  return y < 1 ? `${Math.max(1, Math.round(days / 30.44))} months` : `${y.toFixed(1)} yrs`;
}
function unicoTenure(doj) {
  if (!doj) return null;
  const d = new Date(doj);
  if (isNaN(d)) return null;
  const now = new Date();
  if (d > now) return null;
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months--;
  if (months < 0) months = 0;
  const years = Math.floor(months / 12),
    mo = months % 12;
  const text = years > 0 ? mo > 0 ? `${years} yr${years > 1 ? 's' : ''} ${mo} mo` : `${years} yr${years > 1 ? 's' : ''}` : `${mo} mo`;
  return {
    months,
    years,
    mo,
    decimalYears: Math.round(months / 12 * 10) / 10,
    text
  };
}
const REC_SECTIONS = [['identity', 'Identity & contact', 'Name, employee no., role, department, date of joining, phone, NID, emergency contact', 'staff'], ['employment', 'Employment & experience', 'Designation history, UNICO tenure, prior service, total experience', 'staff'], ['credentials', 'Qualifications & licence', 'Qualification, BNMC registration, special training, vaccination', 'staff'], ['privileges', 'Clinical privileges', 'Activities granted, by privilege area', 'staff'], ['performance', 'Performance appraisals', 'Latest grade, every filed cycle, Part H action taken', 'perf'], ['achievements', 'Achievements & awards', 'The recognition register for this staff member', 'perf'], ['incidents', 'Mistakes & incidents', 'The incident register for this staff member', 'perf'], ['notes', 'Internal notes', 'Notes kept on the record by the nursing office', 'staff']];
const REC_DEFAULT = {
  identity: true,
  employment: true,
  credentials: true,
  privileges: true,
  performance: true,
  achievements: true,
  incidents: true,
  notes: false,
  photo: true,
  signatures: true,
  confidential: true
};
const REC_PRESETS = [['Full record', {
  identity: 1,
  employment: 1,
  credentials: 1,
  privileges: 1,
  performance: 1,
  achievements: 1,
  incidents: 1,
  notes: 0
}], ['Profile only', {
  identity: 1,
  employment: 1,
  credentials: 1,
  privileges: 1,
  performance: 0,
  achievements: 0,
  incidents: 0,
  notes: 0
}], ['Performance file', {
  identity: 1,
  employment: 0,
  credentials: 0,
  privileges: 0,
  performance: 1,
  achievements: 1,
  incidents: 1,
  notes: 0
}], ['Credentials', {
  identity: 1,
  employment: 0,
  credentials: 1,
  privileges: 1,
  performance: 0,
  achievements: 0,
  incidents: 0,
  notes: 0
}]];
function StaffRecordPrint({
  e,
  perf,
  tenure,
  onClose
}) {
  const [sel, setSel] = React.useState(REC_DEFAULT);
  const [printing, setPrinting] = React.useState(false);
  const allowed = REC_SECTIONS.filter(s => s[3] !== 'perf' || canPrintPerf());
  const on = k => !!sel[k];
  const flip = k => setSel(s => Object.assign({}, s, {
    [k]: !s[k]
  }));
  const preset = map => setSel(s => Object.assign({}, s, REC_SECTIONS.reduce((m, x) => (m[x[0]] = !!map[x[0]], m), {})));
  const chosen = allowed.filter(s => on(s[0])).length;
  React.useEffect(() => {
    const k = ev => {
      if (ev.key === 'Escape' && !printing) onClose();
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose, printing]);
  if (printing) return React.createElement(StaffRecordSheet, {
    e: e,
    perf: perf,
    tenure: tenure,
    sel: sel,
    onDone: onClose
  });
  const box = (k, label, sub) => React.createElement("label", {
    key: k,
    style: {
      display: 'flex',
      gap: 9,
      alignItems: 'flex-start',
      padding: '8px 10px',
      borderRadius: 9,
      cursor: 'pointer',
      border: '1px solid ' + (on(k) ? 'var(--blue)' : 'var(--line-2)'),
      background: on(k) ? 'var(--blue-50)' : 'var(--panel-2)'
    }
  }, React.createElement("input", {
    type: "checkbox",
    checked: on(k),
    onChange: () => flip(k),
    style: {
      marginTop: 2,
      width: 15,
      height: 15,
      accentColor: '#0090ca',
      flexShrink: 0
    }
  }), React.createElement("span", {
    style: {
      minWidth: 0
    }
  }, React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 12.5,
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, label), sub && React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 11,
      color: 'var(--muted)',
      lineHeight: 1.45,
      marginTop: 1
    }
  }, sub)));
  return React.createElement("div", {
    onMouseDown: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(16,32,46,.45)',
      zIndex: 600,
      display: 'grid',
      placeItems: 'center',
      padding: 'clamp(8px,3vw,22px)'
    }
  }, React.createElement("div", {
    onMouseDown: ev => ev.stopPropagation(),
    className: "card",
    style: {
      width: 'min(620px,100%)',
      maxHeight: '92vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--panel)'
    }
  }, React.createElement("div", {
    className: "card-h",
    style: {
      alignItems: 'flex-start'
    }
  }, React.createElement("span", {
    style: {
      display: 'inline-grid',
      placeItems: 'center',
      width: 30,
      height: 30,
      borderRadius: 9,
      background: 'var(--blue-50)',
      color: 'var(--blue)',
      marginRight: 8
    }
  }, React.createElement(Ic, {
    d: I.print,
    s: 16
  })), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("h3", null, "Print staff record"), React.createElement("div", {
    className: "sub"
  }, e.name, " \xB7 ", e.emp_id || e.id, " \u2014 tick what goes on the sheet")), React.createElement("button", {
    className: "icon-btn",
    title: "Close",
    onClick: onClose
  }, React.createElement(Ic, {
    d: I.x,
    s: 15
  }))), React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      overflowY: 'auto'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap',
      alignItems: 'center'
    }
  }, React.createElement("span", {
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: .5,
      textTransform: 'uppercase',
      color: 'var(--muted)'
    }
  }, "Preset"), REC_PRESETS.map(([label, map]) => React.createElement("button", {
    key: label,
    className: "btn sm",
    onClick: () => preset(map)
  }, label))), React.createElement("div", {
    style: {
      display: 'grid',
      gap: 7
    }
  }, allowed.map(s => box(s[0], s[1], s[2]))), !canPrintPerf() && React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--muted)',
      lineHeight: 1.5,
      background: 'var(--panel-2)',
      borderRadius: 8,
      padding: '8px 10px'
    }
  }, "Appraisals, achievements and incidents are personal-file material.", canSeePerf() ? ' This account may read them but has no print permission for the Performance module, so they cannot be put on a sheet.' : ' This account does not hold the Performance module, so they are not on this sheet.'), React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: .5,
      textTransform: 'uppercase',
      color: 'var(--muted)',
      marginBottom: 6
    }
  }, "Sheet options"), React.createElement("div", {
    style: {
      display: 'grid',
      gap: 7,
      gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))'
    }
  }, box('photo', 'Photograph', 'Print the staff photo in the header'), box('signatures', 'Signature block', 'Prepared by / verified by / authorised lines at the foot'), box('confidential', 'Confidential marking', '“Confidential — personal file” on every page')))), React.createElement("div", {
    className: "card-h",
    style: {
      borderTop: '1px solid var(--line-2)',
      borderBottom: 0,
      justifyContent: 'flex-end',
      gap: 8
    }
  }, React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 11.5,
      color: chosen ? 'var(--muted)' : '#d23a52'
    }
  }, chosen ? chosen + ' section' + (chosen === 1 ? '' : 's') + ' selected' : 'Tick at least one section.'), React.createElement("button", {
    className: "btn sm",
    onClick: onClose
  }, "Cancel"), React.createElement("button", {
    className: "btn pri sm",
    disabled: !chosen,
    onClick: () => setPrinting(true)
  }, React.createElement(Ic, {
    d: I.print,
    s: 14
  }), "Print / Save as PDF"))));
}
function StaffRecordSheet({
  e,
  perf,
  tenure,
  sel,
  onDone
}) {
  const rawPhoto = e && e.photo && e.photo.url || '';
  const photoUrl = rawPhoto && window.MK && window.MK.cdnPhoto ? window.MK.cdnPhoto(rawPhoto, 320, 'fit') : rawPhoto;
  const wantPhoto = !!(sel && sel.photo);
  const [photo, setPhoto] = React.useState(() => wantPhoto && photoUrl ? 'wait' : 'fail');
  React.useEffect(() => {
    let live = true;
    if (photo !== 'wait') return;
    const img = new Image();
    const settle = ok => {
      if (live) setPhoto(ok ? 'ok' : 'fail');
    };
    img.onload = () => settle(true);
    img.onerror = () => settle(false);
    img.src = photoUrl;
    if (img.complete && img.naturalWidth) settle(true);
    const cap = setTimeout(() => settle(false), 4000);
    return () => {
      live = false;
      clearTimeout(cap);
      img.onload = img.onerror = null;
    };
  }, [photo, photoUrl]);
  React.useEffect(() => {
    if (photo === 'wait') return;
    const body = document.body;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      body.classList.remove('pdf-export-mode', 'regform-print');
      window.removeEventListener('afterprint', finish);
      if (onDone) onDone();
    };
    body.classList.add('pdf-export-mode', 'regform-print');
    window.addEventListener('afterprint', finish);
    const t = setTimeout(() => {
      try {
        window.print();
      } catch (err) {}
      setTimeout(finish, 800);
    }, 250);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', finish);
      body.classList.remove('pdf-export-mode', 'regform-print');
    };
  }, [photo]);
  const root = typeof document !== 'undefined' && document.getElementById('pdf-root');
  if (!root || typeof ReactDOM === 'undefined' || !ReactDOM.createPortal) return null;
  const S = window.STAFF || {};
  const A = window.UNICO_APPRAISAL;
  const ink = '#111a26',
    line = '#8e9aa8',
    soft = '#4f5d6e',
    head = '#1f3b5a';
  const on = k => !!sel[k];
  const now = new Date();
  const today = now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const printedAt = today + ' ' + now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  });
  const txt = v => {
    const s = String(v == null ? '' : v).trim();
    return s || '—';
  };
  const listOf = v => String(v || '').split(/[,;]/).map(x => x.trim()).filter(Boolean);
  const desig = (window.staffCanonDesig ? window.staffCanonDesig(e.designation) : e.designation) || '';
  const deptText = (window.staffDeptShow ? window.staffDeptShow(e.current_department) : e.current_department) || '';
  const st = perf && A && A.standing ? A.standing(e, perf.appraisals, new Date()) : null;
  let n = 0;
  const Sec = ({
    title,
    children
  }) => {
    n += 1;
    const no = n;
    return React.createElement("section", {
      style: {
        marginTop: 9,
        breakInside: 'avoid',
        pageBreakInside: 'avoid'
      }
    }, React.createElement("div", {
      style: {
        background: head,
        color: '#fff',
        fontSize: '8.6pt',
        fontWeight: 700,
        letterSpacing: '.4px',
        padding: '3px 8px',
        textTransform: 'uppercase',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact'
      }
    }, no, ". ", title), React.createElement("div", {
      style: {
        border: '1px solid ' + line,
        borderTop: 0,
        padding: '6px 8px 7px'
      }
    }, children));
  };
  const F = ({
    label,
    value,
    span
  }) => React.createElement("div", {
    style: {
      gridColumn: span ? 'span ' + span : 'auto',
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontSize: '6.8pt',
      fontWeight: 700,
      letterSpacing: '.5px',
      textTransform: 'uppercase',
      color: soft
    }
  }, label), React.createElement("div", {
    style: {
      fontSize: '9pt',
      fontWeight: 600,
      color: ink,
      borderBottom: '1px dotted ' + line,
      paddingBottom: 2,
      minHeight: 14,
      wordBreak: 'break-word'
    }
  }, txt(value)));
  const Grid = ({
    cols,
    children
  }) => React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) '.repeat(cols || 3).trim(),
      columnGap: 11,
      rowGap: 7
    }
  }, children);
  const Tbl = ({
    cols,
    rows,
    empty
  }) => rows.length === 0 ? React.createElement("div", {
    style: {
      fontSize: '8pt',
      color: soft,
      padding: '3px 0'
    }
  }, empty) : React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '8pt',
      marginTop: 2
    }
  }, React.createElement("thead", null, React.createElement("tr", null, cols.map((c, i) => React.createElement("th", {
    key: i,
    style: {
      textAlign: c[2] || 'left',
      borderBottom: '1px solid ' + line,
      padding: '3px 4px',
      fontSize: '7pt',
      fontWeight: 700,
      letterSpacing: '.3px',
      textTransform: 'uppercase',
      color: soft,
      width: c[3] || 'auto'
    }
  }, c[0])))), React.createElement("tbody", null, rows.map((r, ri) => React.createElement("tr", {
    key: ri
  }, cols.map((c, ci) => React.createElement("td", {
    key: ci,
    style: {
      textAlign: c[2] || 'left',
      borderBottom: '1px dotted ' + line,
      padding: '3px 4px',
      color: ink,
      verticalAlign: 'top'
    }
  }, c[1](r)))))));
  const priorEntries = Array.isArray(e.prior_experience_entries) ? e.prior_experience_entries : [];
  const privGroups = (() => {
    try {
      if (!S.privilegeGroupsFor || !S.privKey) return [];
      const granted = e.privileges || {};
      return (S.privilegeGroupsFor(e.role || 'Nurse') || []).map(g => ({
        group: g.group,
        items: (g.items || []).filter(it => granted[S.privKey(g.group, it)])
      })).filter(g => g.items.length);
    } catch (err) {
      return [];
    }
  })();
  const achievements = perf && perf.achievements || [];
  const incidents = perf && perf.incidents || [];
  const notes = Array.isArray(e.notes) ? e.notes : [];
  return ReactDOM.createPortal(React.createElement("div", {
    className: "pdf-doc portrait"
  }, React.createElement("style", null, "@media print{@page{size:A4 portrait;margin:8mm 8mm 13mm}html,body{height:auto !important;min-height:0 !important}body.regform-print>*:not(#pdf-root){display:none !important}body.regform-print #pdf-root{display:block !important;position:static !important;margin:0 !important;padding:0 !important}body.regform-print #pdf-root .staffrec-sheet{page:auto !important;box-sizing:border-box;width:100%;background:#fff}.staffrec-foot{position:fixed;bottom:0;left:0;right:0;display:flex !important}}.staffrec-foot{display:none}"), React.createElement("div", {
    className: "staffrec-foot",
    style: {
      gap: 10,
      alignItems: 'baseline',
      fontSize: '6.6pt',
      color: soft,
      borderTop: '1px solid ' + line,
      padding: '2px 8mm 0'
    }
  }, React.createElement("span", null, txt(e.name), " \xB7 ", txt(e.emp_id || e.id)), on('confidential') && React.createElement("span", {
    style: {
      fontWeight: 700
    }
  }, "CONFIDENTIAL \u2014 personal file"), React.createElement("span", {
    style: {
      flex: 1
    }
  }), React.createElement("span", null, "Printed ", printedAt)), React.createElement("section", {
    className: "staffrec-sheet",
    style: {
      fontFamily: "'IBM Plex Sans',system-ui,'Segoe UI',sans-serif",
      color: ink,
      padding: '6mm 8mm'
    }
  }, React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      borderBottom: '2px solid ' + head,
      paddingBottom: 6
    }
  }, React.createElement("img", {
    src: "unico/logo.svg",
    alt: "UNICO Hospitals",
    style: {
      height: 34
    }
  }), React.createElement("div", {
    style: {
      flex: 1,
      textAlign: 'center',
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontSize: '8pt',
      fontWeight: 700,
      letterSpacing: '1px',
      color: soft,
      textTransform: 'uppercase'
    }
  }, "UNICO Hospitals PLC \xB7 Nursing Services"), React.createElement("div", {
    style: {
      fontSize: '13pt',
      fontWeight: 800,
      marginTop: 1
    }
  }, "Staff Record \u2014 ", e.role === 'PCA' ? 'Patient Care Assistant' : 'Nurse'), React.createElement("div", {
    style: {
      fontSize: '7.6pt',
      color: soft,
      marginTop: 2
    }
  }, "Employee no. ", React.createElement("b", {
    style: {
      color: ink
    }
  }, txt(e.emp_id || e.id)), " \xB7 printed ", printedAt, on('confidential') ? ' · CONFIDENTIAL — personal file' : '')), on('photo') && (photo === 'ok' ? React.createElement("img", {
    src: photoUrl,
    alt: txt(e.name),
    crossOrigin: "anonymous",
    style: {
      width: '23mm',
      height: '28mm',
      objectFit: 'cover',
      border: '1px solid ' + line,
      flexShrink: 0,
      WebkitPrintColorAdjust: 'exact',
      printColorAdjust: 'exact'
    }
  }) : React.createElement("div", {
    style: {
      width: '23mm',
      height: '28mm',
      border: '1px solid ' + line,
      display: 'grid',
      placeItems: 'center',
      textAlign: 'center',
      flexShrink: 0,
      background: '#eef3f8',
      WebkitPrintColorAdjust: 'exact',
      printColorAdjust: 'exact'
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: '17pt',
      fontWeight: 800,
      color: head,
      lineHeight: 1
    }
  }, String(e.name || '?').split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'), React.createElement("div", {
    style: {
      fontSize: '6pt',
      color: soft,
      marginTop: 3
    }
  }, rawPhoto ? 'photo unavailable' : 'no photo on file'))))), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 10,
      flexWrap: 'wrap',
      padding: '6px 0 2px'
    }
  }, React.createElement("div", {
    style: {
      fontSize: '14pt',
      fontWeight: 800
    }
  }, txt(e.name)), React.createElement("div", {
    style: {
      fontSize: '9.5pt',
      fontWeight: 700,
      color: head
    }
  }, txt(desig || e.role)), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("div", {
    style: {
      fontSize: '8pt',
      color: soft
    }
  }, txt(deptText), e.is_active === false ? ' · INACTIVE' : '')), on('identity') && React.createElement(Sec, {
    title: "Identity & contact"
  }, React.createElement(Grid, {
    cols: 3
  }, React.createElement(F, {
    label: "Full name",
    value: e.name
  }), React.createElement(F, {
    label: "Employee no.",
    value: e.emp_id || e.id
  }), React.createElement(F, {
    label: "Role",
    value: e.role || 'Nurse'
  }), React.createElement(F, {
    label: "Designation",
    value: desig
  }), React.createElement(F, {
    label: "Department(s)",
    value: deptText,
    span: 2
  }), React.createElement(F, {
    label: "Date of joining",
    value: e.doj
  }), React.createElement(F, {
    label: "Date of birth",
    value: e.dob
  }), React.createElement(F, {
    label: "Gender",
    value: e.gender
  }), React.createElement(F, {
    label: "Mobile",
    value: e.phone
  }), React.createElement(F, {
    label: "Blood group",
    value: e.blood_group
  }), React.createElement(F, {
    label: "NID / passport",
    value: e.nid
  }), React.createElement(F, {
    label: "Emergency contact",
    value: e.emergency_contact
  }), React.createElement(F, {
    label: "Relation",
    value: e.emergency_relation
  }), React.createElement(F, {
    label: "Languages",
    value: e.languages
  }), React.createElement(F, {
    label: "Present address",
    value: e.address || e.present_address,
    span: 3
  }))), on('employment') && React.createElement(Sec, {
    title: "Employment & experience"
  }, React.createElement(Grid, {
    cols: 3
  }, React.createElement(F, {
    label: "Service at UNICO",
    value: tenure ? tenure.text : ''
  }), React.createElement(F, {
    label: "Total experience",
    value: S.expLabel ? S.expLabel(e) : e.total_experience_text
  }), React.createElement(F, {
    label: "Status",
    value: e.is_active === false ? 'Inactive / former' : 'Active on roster'
  })), React.createElement("div", {
    style: {
      fontSize: '7pt',
      fontWeight: 700,
      letterSpacing: '.5px',
      textTransform: 'uppercase',
      color: soft,
      marginTop: 8
    }
  }, "Prior service"), React.createElement(Tbl, {
    cols: [['Organisation', x => txt(x.org), 'left'], ['Department', x => txt(x.dept), 'left'], ['Duration', x => S.fmtYM ? S.fmtYM((parseFloat(x.years) || 0) + (parseFloat(x.months) || 0) / 12) : txt(x.years), 'right', '22%']],
    rows: priorEntries,
    empty: e.previous_experience ? String(e.previous_experience) : 'No prior service recorded.'
  })), on('credentials') && React.createElement(Sec, {
    title: "Qualifications, registration & training"
  }, React.createElement(Grid, {
    cols: 2
  }, React.createElement(F, {
    label: "Qualification",
    value: listOf(e.qualification).join(', ')
  }), React.createElement(F, {
    label: "Hepatitis-B vaccination",
    value: e.hepatitis_b_vaccination
  }), React.createElement(F, {
    label: "BNMC / licence no.",
    value: e.licence_no
  }), React.createElement(F, {
    label: "Licence valid until",
    value: e.licence_expiry
  }), React.createElement(F, {
    label: "Special training",
    value: listOf(e.special_training).join(', '),
    span: 2
  }), React.createElement(F, {
    label: "Extracurricular activities",
    value: listOf(e.extracurricular).join(', '),
    span: 2
  })), e.licence_verified && (() => {
    const v = e.licence_verified,
      pr = v.primary || {};
    return React.createElement("div", {
      style: {
        fontSize: '7.6pt',
        color: soft,
        marginTop: 6,
        borderTop: '1px dotted ' + line,
        paddingTop: 4
      }
    }, "Verified against the BNMC register on ", String(v.at || '').slice(0, 10) || '—', pr.regNo ? ' — registration ' + pr.regNo : '', pr.status ? ', ' + pr.status : '', pr.expired ? ' (EXPIRED)' : '', pr.renewUpto ? ', renewable up to ' + pr.renewUpto : '', ".");
  })()), on('privileges') && React.createElement(Sec, {
    title: "Clinical privileges"
  }, privGroups.length === 0 ? React.createElement("div", {
    style: {
      fontSize: '8pt',
      color: soft
    }
  }, "No clinical privileges recorded on this file.") : privGroups.map((g, i) => React.createElement("div", {
    key: i,
    style: {
      marginBottom: 5,
      breakInside: 'avoid'
    }
  }, React.createElement("div", {
    style: {
      fontSize: '7.6pt',
      fontWeight: 700,
      color: head
    }
  }, g.group), React.createElement("div", {
    style: {
      fontSize: '8pt',
      color: ink,
      lineHeight: 1.45
    }
  }, g.items.join(' · '))))), on('performance') && canPrintPerf() && React.createElement(Sec, {
    title: "Performance appraisals"
  }, React.createElement(Grid, {
    cols: 4
  }, React.createElement(F, {
    label: "Latest grade",
    value: st && st.last ? st.last.grade : ''
  }), React.createElement(F, {
    label: "Latest score",
    value: st && st.last && st.last.score != null ? st.last.score + ' / 100' : ''
  }), React.createElement(F, {
    label: "Appraisals filed",
    value: st ? String(st.history.length) : '0'
  }), React.createElement(F, {
    label: "Current window",
    value: st && st.cycle ? st.cycle.label : ''
  })), React.createElement("div", {
    style: {
      fontSize: '7pt',
      fontWeight: 700,
      letterSpacing: '.5px',
      textTransform: 'uppercase',
      color: soft,
      marginTop: 8
    }
  }, "Filed cycles"), React.createElement(Tbl, {
    cols: [['Period', x => txt(x.cycleLabel || x.cycleId), 'left'], ['Score', x => x.score == null ? '—' : String(x.score), 'right', '12%'], ['Grade', x => txt(x.grade), 'center', '12%'], ['Action taken (Part H)', x => (x.actions || []).map(id => ((A && A.CNS_ACTIONS || []).find(y => y.id === id) || {}).label || id).join(' · ') || '—', 'left', '38%']],
    rows: st ? st.history : [],
    empty: 'No appraisal has been filed yet' + (e.doj ? ' — the first falls six months after joining (' + e.doj + ').' : '.')
  }), st && st.overdue && React.createElement("div", {
    style: {
      fontSize: '7.6pt',
      color: '#a32c41',
      marginTop: 5,
      fontWeight: 700
    }
  }, "The ", st.lastClosed ? st.lastClosed.label : 'last', " appraisal window closed with no appraisal filed.")), on('achievements') && canPrintPerf() && React.createElement(Sec, {
    title: "Achievements & awards"
  }, React.createElement(Tbl, {
    cols: [['Date', x => txt(x.date), 'left', '15%'], ['Achievement', x => txt(x.what), 'left'], ['Category', x => [x.category, x.level].filter(Boolean).join(' · ') || '—', 'left', '26%'], ['Points', x => x.points ? '+' + x.points : '—', 'right', '10%']],
    rows: achievements,
    empty: "No achievement or award is recorded on this file."
  })), on('incidents') && canPrintPerf() && React.createElement(Sec, {
    title: "Mistakes & incidents"
  }, React.createElement(Tbl, {
    cols: [['Date', x => txt(x.date), 'left', '15%'], ['Incident', x => txt(x.what), 'left'], ['Category', x => [x.category, x.severity].filter(Boolean).join(' · ') || '—', 'left', '26%'], ['Points', x => x.points ? '−' + x.points : '—', 'right', '10%']],
    rows: incidents,
    empty: "Clean record \u2014 no error, lapse or disciplinary entry on this file."
  })), on('notes') && React.createElement(Sec, {
    title: "Internal notes"
  }, notes.length === 0 ? React.createElement("div", {
    style: {
      fontSize: '8pt',
      color: soft
    }
  }, "No notes on this record.") : notes.slice().reverse().map(x => React.createElement("div", {
    key: x.id,
    style: {
      fontSize: '8pt',
      marginBottom: 4,
      breakInside: 'avoid'
    }
  }, React.createElement("span", {
    style: {
      color: soft
    }
  }, new Date(x.ts).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }), " \xB7 ", txt(x.author), " \u2014 "), txt(x.text)))), on('signatures') && React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)',
      gap: 16,
      marginTop: 18,
      breakInside: 'avoid'
    }
  }, ['Prepared by', 'Verified by', 'Chief Nursing Superintendent'].map(l => React.createElement("div", {
    key: l
  }, React.createElement("div", {
    style: {
      borderBottom: '1px solid ' + ink,
      height: 26
    }
  }), React.createElement("div", {
    style: {
      fontSize: '7.4pt',
      fontWeight: 700,
      color: soft,
      marginTop: 3
    }
  }, l), React.createElement("div", {
    style: {
      fontSize: '6.8pt',
      color: soft
    }
  }, "Name, signature & date")))), React.createElement("footer", {
    style: {
      marginTop: 12,
      borderTop: '1px solid ' + line,
      paddingTop: 4,
      display: 'flex',
      gap: 10,
      fontSize: '6.8pt',
      color: soft
    }
  }, React.createElement("span", null, "UNICO Hospitals PLC \u2014 Nursing Services \xB7 staff record for ", txt(e.name), " (", txt(e.emp_id || e.id), ")"), React.createElement("span", {
    style: {
      flex: 1
    }
  }), React.createElement("span", null, on('confidential') ? 'Confidential — personal file · ' : '', "Printed ", printedAt)))), root);
}
function ApprTrend({
  points
}) {
  if (!points.length) return null;
  const W = 100,
    H = 44,
    pad = 4;
  const xs = i => points.length < 2 ? W / 2 : pad + i * (W - pad * 2) / (points.length - 1);
  const ys = v => H - pad - Math.max(0, Math.min(100, Number(v) || 0)) / 100 * (H - pad * 2);
  const d = points.map((p, i) => (i ? 'L' : 'M') + xs(i).toFixed(1) + ' ' + ys(p.v).toFixed(1)).join(' ');
  const area = d + ' L ' + xs(points.length - 1).toFixed(1) + ' ' + (H - pad) + ' L ' + xs(0).toFixed(1) + ' ' + (H - pad) + ' Z';
  const gc = g => window.MK && window.MK.GC && window.MK.GC[g] || '#0090ca';
  return React.createElement("div", null, React.createElement("svg", {
    viewBox: '0 0 ' + W + ' ' + H,
    preserveAspectRatio: "none",
    style: {
      width: '100%',
      height: 96,
      display: 'block'
    }
  }, [25, 50, 75].map(y => React.createElement("line", {
    key: y,
    x1: 0,
    x2: W,
    y1: ys(y),
    y2: ys(y),
    stroke: "var(--line-2)",
    strokeWidth: ".4"
  })), points.length > 1 && React.createElement("path", {
    d: area,
    fill: "rgba(0,144,202,.10)",
    stroke: "none"
  }), points.length > 1 && React.createElement("path", {
    d: d,
    fill: "none",
    stroke: "#0090ca",
    strokeWidth: "1.2",
    strokeLinejoin: "round",
    strokeLinecap: "round"
  }), points.map((p, i) => React.createElement("circle", {
    key: i,
    cx: xs(i),
    cy: ys(p.v),
    r: points.length > 12 ? 1.1 : 1.8,
    fill: gc(p.grade),
    stroke: "#fff",
    strokeWidth: ".6"
  }))), React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 6,
      marginTop: 4
    }
  }, points.map((p, i) => React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      minWidth: 0,
      textAlign: 'center'
    }
  }, React.createElement("div", {
    className: "num",
    style: {
      fontSize: 11.5,
      fontWeight: 700,
      color: gc(p.grade)
    }
  }, p.v), React.createElement("div", {
    style: {
      fontSize: 9.5,
      color: 'var(--muted)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, p.label)))));
}
function ApprStat({
  label,
  value,
  tone
}) {
  return React.createElement("div", {
    style: {
      background: 'var(--panel-2)',
      border: '1px solid var(--line-2)',
      borderRadius: 9,
      padding: '7px 11px',
      minWidth: 88
    }
  }, React.createElement("div", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: .5,
      textTransform: 'uppercase',
      color: 'var(--muted)'
    }
  }, label), React.createElement("div", {
    className: "num",
    style: {
      fontSize: 14,
      fontWeight: 800,
      color: tone || 'var(--ink)',
      marginTop: 2
    }
  }, value));
}
const canSeePerf = () => {
  try {
    return window.unicoCan ? window.unicoCan('perf', 'view') : true;
  } catch (e) {
    return true;
  }
};
const canAddPerf = () => {
  try {
    return window.unicoCan ? window.unicoCan('perf', 'add') : true;
  } catch (e) {
    return true;
  }
};
const canDelPerf = () => {
  try {
    return window.unicoCan ? window.unicoCan('perf', 'delete') : true;
  } catch (e) {
    return true;
  }
};
const canPrintStaff = () => {
  try {
    return window.unicoCan ? window.unicoCan('staff', 'print') : true;
  } catch (e) {
    return true;
  }
};
const canPrintPerf = () => {
  try {
    return window.unicoCan ? window.unicoCan('perf', 'view') && window.unicoCan('perf', 'print') : true;
  } catch (e) {
    return true;
  }
};
async function removeConductEntry(kind, entry, name) {
  const isAch = kind === 'achievement';
  const label = isAch ? 'achievement' : 'incident';
  const ok = await (window.UI && window.UI.confirm ? window.UI.confirm({
    title: 'Remove this ' + label + '?',
    message: '"' + (entry.what || 'Untitled') + '" will be deleted from ' + name + "'s record" + (entry.points ? ' and the ' + (isAch ? '+' : '−') + entry.points + ' point' + (entry.points === 1 ? '' : 's') + ' come back off their appraisal' : '') + '. This cannot be undone.',
    danger: true,
    confirmLabel: 'Remove ' + label
  }) : Promise.resolve(window.confirm('Remove this ' + label + '? This cannot be undone.')));
  if (!ok) return false;
  try {
    const r = await fetch('/api/performance/' + (isAch ? 'achievements' : 'incidents') + '/' + encodeURIComponent(entry.id), {
      method: 'DELETE',
      credentials: 'same-origin'
    });
    const j = await r.json().catch(() => ({
      ok: false
    }));
    if (!r.ok || !j.ok) throw new Error(j && j.error || 'Could not remove the entry.');
  } catch (ex) {
    try {
      window.UI && window.UI.toast && window.UI.toast(String(ex && ex.message || ex), 'error');
    } catch (e) {}
    return false;
  }
  try {
    window.UI && window.UI.toast && window.UI.toast('Entry removed from ' + name + "'s record", 'success');
  } catch (e) {}
  return true;
}
function useStaffPerf(perfId) {
  const [d, setD] = React.useState(null);
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    let live = true;
    if (!canSeePerf()) {
      setD({
        appraisals: [],
        incidents: [],
        achievements: [],
        denied: true
      });
      return () => {
        live = false;
      };
    }
    const api = window.PerfUI && window.PerfUI.perfApi || null;
    const get = api ? api.get('/api/performance') : fetch('/api/performance', {
      credentials: 'same-origin'
    }).then(r => r.json());
    Promise.resolve(get).then(r => {
      if (!live || !r || !r.ok) {
        if (live) setD({
          appraisals: [],
          incidents: [],
          achievements: []
        });
        return;
      }
      const mine = list => (list || []).filter(x => String(x.empId) === String(perfId));
      setD({
        appraisals: mine(r.appraisals),
        incidents: mine(r.incidents),
        achievements: mine(r.achievements),
        categories: r.categories || null
      });
    }).catch(() => {
      if (live) setD({
        appraisals: [],
        incidents: [],
        achievements: []
      });
    });
    return () => {
      live = false;
    };
  }, [perfId, tick]);
  return d ? Object.assign({}, d, {
    reload: () => setTick(t => t + 1)
  }) : d;
}
const SEPARATIONS = ['Resignation', 'End of contract', 'Retirement', 'Termination', 'Absconded', 'Transfer', 'Other'];
function DiscontinueDialog({
  e,
  onClose,
  onDone
}) {
  const today = (() => {
    try {
      const d = new Date();
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    } catch (err) {
      return '';
    }
  })();
  const [sep, setSep] = React.useState('Resignation');
  const [lastDay, setLastDay] = React.useState(today);
  const [noticeDate, setNoticeDate] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [rehire, setRehire] = React.useState(true);
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const inp = {
    padding: '9px 11px',
    border: '1px solid var(--line)',
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
    background: '#fff'
  };
  const lab = t => React.createElement("label", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--ink-2)'
    }
  }, t);
  const confirm = async () => {
    if (!lastDay) {
      setErr('Last working day is required — the attrition month is taken from it.');
      return;
    }
    if (!reason.trim()) {
      setErr('Please state the discontinue reason.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/performance/exits', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          empId: e.emp_id || String(e.id),
          staffName: e.name,
          department: e.current_department || '',
          designation: e.designation || '',
          doj: e.doj || '',
          noticeDate,
          lastDay,
          separation: sep,
          reason: reason.trim(),
          rehire,
          note
        })
      });
      const j = await r.json().catch(() => ({
        ok: false
      }));
      if (!r.ok || !j.ok) throw new Error(j && j.error || 'Could not record the exit.');
    } catch (ex) {
      setBusy(false);
      setErr(String(ex && ex.message || ex) + ' Nothing was changed — the person is still on the active roster.');
      return;
    }
    onDone(sep + ' — ' + reason.trim());
  };
  const body = React.createElement("div", {
    onMouseDown: ev => {
      if (ev.target === ev.currentTarget && !busy) onClose();
    },
    style: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(16,32,46,.5)',
      zIndex: 600,
      display: 'grid',
      placeItems: 'center',
      padding: 16
    }
  }, React.createElement("div", {
    className: "card",
    style: {
      width: 'min(500px,96vw)',
      maxHeight: '92vh',
      overflow: 'auto',
      border: '1px solid #f1c6cd'
    }
  }, React.createElement("div", {
    className: "card-h",
    style: {
      background: 'rgba(210,58,82,.06)'
    }
  }, React.createElement("span", {
    style: {
      display: 'inline-grid',
      placeItems: 'center',
      width: 30,
      height: 30,
      borderRadius: 9,
      background: 'rgba(210,58,82,.12)',
      color: '#d23a52',
      marginRight: 7,
      fontSize: 15
    }
  }, "\u26A0"), React.createElement("h3", {
    style: {
      color: '#d23a52'
    }
  }, "Discontinue ", e.name), React.createElement("span", {
    className: "spacer"
  }), React.createElement("button", {
    className: "icon-btn",
    onClick: onClose
  }, React.createElement(Ic, {
    d: I.x,
    s: 15
  }))), React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--ink-2)',
      lineHeight: 1.55,
      background: 'var(--warn-bg,#fff4e0)',
      border: '1px solid #f0d9a8',
      borderRadius: 9,
      padding: '10px 12px'
    }
  }, e.name, " is moved off the active roster to ", React.createElement("b", null, "Previous Staff"), ", and the exit is filed in the ", React.createElement("b", null, "Attrition & Exits"), " register \u2014 the attrition rate updates immediately. The record is kept and they can be restored anytime."), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, lab('Separation type'), React.createElement("select", {
    style: inp,
    value: sep,
    onChange: ev => setSep(ev.target.value)
  }, SEPARATIONS.map(x => React.createElement("option", {
    key: x
  }, x)))), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, lab('Last working day *'), React.createElement("input", {
    type: "date",
    style: {
      ...inp,
      borderColor: lastDay ? undefined : '#d23a52'
    },
    value: lastDay,
    onChange: ev => setLastDay(ev.target.value)
  })), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, lab('Notice / resignation date'), React.createElement("input", {
    type: "date",
    style: inp,
    value: noticeDate,
    onChange: ev => setNoticeDate(ev.target.value)
  })), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, lab('Eligible for rehire?'), React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 12.5,
      padding: '9px 0',
      cursor: 'pointer',
      color: 'var(--ink-2)'
    }
  }, React.createElement("input", {
    type: "checkbox",
    checked: rehire,
    onChange: ev => setRehire(ev.target.checked)
  }), "Yes \u2014 may be rehired"))), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, lab('Discontinue reason *'), React.createElement("input", {
    style: {
      ...inp,
      borderColor: reason.trim() ? undefined : '#d23a52'
    },
    value: reason,
    onChange: ev => setReason(ev.target.value),
    placeholder: "e.g. Better opportunity abroad / family relocation / contract ended"
  })), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, lab('Note (optional)'), React.createElement("textarea", {
    style: {
      ...inp,
      minHeight: 52
    },
    value: note,
    onChange: ev => setNote(ev.target.value),
    placeholder: "Exit interview points, clearance status, anything worth keeping"
  })), err && React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: '#d23a52',
      fontWeight: 600
    }
  }, err), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      justifyContent: 'flex-end'
    }
  }, React.createElement("button", {
    className: "btn",
    disabled: busy,
    onClick: onClose
  }, "Cancel"), React.createElement("button", {
    className: "btn",
    disabled: busy,
    onClick: confirm,
    style: {
      background: '#d23a52',
      borderColor: '#d23a52',
      color: '#fff',
      fontWeight: 700
    }
  }, "\u26A0 ", busy ? 'Recording…' : 'Discontinue & move to Previous Staff')))));
  return window.ReactDOM && window.ReactDOM.createPortal ? window.ReactDOM.createPortal(body, document.body) : body;
}
function ConductDialog({
  kind,
  e,
  perfId,
  already,
  categories,
  onClose,
  onSaved
}) {
  const A = window.UNICO_APPRAISAL || {};
  const isAch = kind === 'achievement';
  const cfg = categories && (isAch ? categories.ach : categories.inc) || null;
  const cats = Array.isArray(cfg) && cfg.length ? cfg : (isAch ? A.ACH_CATEGORIES : A.INC_CATEGORIES) || [];
  const sevs = A.SEVERITIES || [];
  const today = (() => {
    try {
      const d = new Date();
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    } catch (err) {
      return '';
    }
  })();
  const [category, setCategory] = React.useState(cats[0] && cats[0].label || '');
  const [level, setLevel] = React.useState(cats[0] && cats[0].levels && cats[0].levels[0][0] || '');
  const [severity, setSeverity] = React.useState(sevs[0] && sevs[0][0] || 'Minor');
  const [what, setWhat] = React.useState('');
  const [date, setDate] = React.useState(today);
  const [action, setAction] = React.useState('');
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const levels = (cats.find(c => c.label === category) || {}).levels || [];
  React.useEffect(() => {
    if (isAch) setLevel(levels[0] && levels[0][0] || '');
  }, [category]);
  const points = isAch ? (levels.find(l => l[0] === level) || [null, 1])[1] : (sevs.find(x => x[0] === severity) || [null, 1])[1];
  const cap = isAch ? A.BONUS_CAP || 5 : A.PENALTY_CAP || 5;
  const used = Number(already) || 0;
  const effective = Math.max(0, Math.min(cap - used, points));
  const cycleId = (() => {
    try {
      const c = A.cycleOf && A.cycleOf(e.doj, new Date());
      return c ? c.id : '';
    } catch (err) {
      return '';
    }
  })();
  const inp = {
    padding: '9px 11px',
    border: '1px solid var(--line)',
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
    background: '#fff'
  };
  const lab = t => React.createElement("label", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--ink-2)'
    }
  }, t);
  const tone = isAch ? '#1f9d57' : '#d23a52';
  const save = async () => {
    if (!what.trim()) {
      setErr(isAch ? 'Describe the achievement.' : 'Describe what happened.');
      return;
    }
    setBusy(true);
    setErr('');
    const body = {
      empId: perfId,
      staffId: String(e.id),
      staffName: e.name,
      department: e.current_department || '',
      designation: e.designation || '',
      cycleId,
      date,
      category,
      what: what.trim(),
      note,
      points,
      ...(isAch ? {
        level,
        reward: action
      } : {
        severity,
        action
      })
    };
    try {
      const r = await fetch('/api/performance/' + (isAch ? 'achievements' : 'incidents'), {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify(body)
      });
      const j = await r.json().catch(() => ({
        ok: false
      }));
      if (!r.ok || !j.ok) throw new Error(j && j.error || 'Could not save the entry.');
    } catch (ex) {
      setBusy(false);
      setErr(String(ex && ex.message || ex));
      return;
    }
    try {
      window.UI && window.UI.toast && window.UI.toast((isAch ? 'Achievement' : 'Incident') + ' recorded for ' + e.name, 'success');
    } catch (ex) {}
    onSaved();
  };
  const body = React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(16,32,46,.5)',
      zIndex: 600,
      display: 'grid',
      placeItems: 'center',
      padding: 16
    }
  }, React.createElement("div", {
    className: "card",
    style: {
      width: 'min(520px,96vw)',
      maxHeight: '92vh',
      overflow: 'auto'
    }
  }, React.createElement("div", {
    className: "card-h",
    style: {
      background: isAch ? 'rgba(31,157,87,.07)' : 'rgba(210,58,82,.06)'
    }
  }, React.createElement("span", {
    style: {
      display: 'inline-grid',
      placeItems: 'center',
      width: 30,
      height: 30,
      borderRadius: 9,
      background: isAch ? 'rgba(31,157,87,.13)' : 'rgba(210,58,82,.12)',
      color: tone,
      marginRight: 7,
      fontSize: 15
    }
  }, isAch ? '★' : '⚠'), React.createElement("h3", {
    style: {
      color: tone
    }
  }, isAch ? 'Add an achievement' : 'Record a mistake or incident'), React.createElement("span", {
    className: "spacer"
  }), React.createElement("button", {
    className: "icon-btn",
    onClick: onClose
  }, React.createElement(Ic, {
    d: I.x,
    s: 15
  }))), React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--ink-2)',
      lineHeight: 1.55
    }
  }, "For ", React.createElement("b", null, e.name), e.emp_id ? ' (' + e.emp_id + ')' : '', ". ", isAch ? 'Bonus points are added to' : 'The deduction shows on', " their current appraisal."), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, lab('Category'), React.createElement("select", {
    style: inp,
    value: category,
    onChange: ev => setCategory(ev.target.value)
  }, cats.map(c => React.createElement("option", {
    key: c.id
  }, c.label)))), isAch ? React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, lab('Level or basis - sets the points'), React.createElement("select", {
    style: inp,
    value: level,
    onChange: ev => setLevel(ev.target.value)
  }, levels.map(l => React.createElement("option", {
    key: l[0],
    value: l[0]
  }, l[0], " (+", l[1], ")")))) : React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, lab('Severity - sets the points'), React.createElement("select", {
    style: inp,
    value: severity,
    onChange: ev => setSeverity(ev.target.value)
  }, sevs.map(x => React.createElement("option", {
    key: x[0],
    value: x[0]
  }, x[0], " (\u2212", x[1], ")"))))), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, lab(isAch ? 'What the achievement was *' : 'What happened *'), React.createElement("textarea", {
    style: {
      ...inp,
      minHeight: 56,
      borderColor: what.trim() ? undefined : '#d23a52'
    },
    value: what,
    onChange: ev => setWhat(ev.target.value),
    placeholder: isAch ? 'e.g. Presented the fall-prevention audit at the hospital QI meeting' : 'e.g. Wrong dose charted on the evening round - caught before administration'
  })), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, lab(isAch ? 'Date completed' : 'Date of incident'), React.createElement("input", {
    type: "date",
    style: inp,
    value: date,
    onChange: ev => setDate(ev.target.value)
  })), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, lab(isAch ? 'Reward (optional)' : 'Action taken'), React.createElement("input", {
    style: inp,
    value: action,
    onChange: ev => setAction(ev.target.value),
    placeholder: isAch ? 'e.g. Certificate of appreciation' : 'e.g. Counselled, retraining scheduled'
  }))), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, lab('Note for the record (optional)'), React.createElement("textarea", {
    style: {
      ...inp,
      minHeight: 46
    },
    value: note,
    onChange: ev => setNote(ev.target.value)
  })), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'center',
      flexWrap: 'wrap',
      background: 'var(--panel-2)',
      borderRadius: 9,
      padding: '10px 12px'
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--muted)',
      textTransform: 'uppercase',
      letterSpacing: .5,
      fontWeight: 700
    }
  }, "This entry carries"), React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 800,
      color: tone
    }
  }, isAch ? '+' : '−', points)), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 170,
      fontSize: 11.5,
      color: 'var(--muted)',
      lineHeight: 1.5
    }
  }, used, " of the ", cap, "-point ", isAch ? 'bonus' : 'deduction', " cap is already used this cycle.", effective < points && React.createElement("span", {
    style: {
      color: '#b5670a'
    }
  }, " Only ", effective, " of these ", points, " points will change the score."))), !cycleId && React.createElement("div", {
    style: {
      fontSize: 12,
      color: '#b5670a'
    }
  }, "No appraisal window is open for this person yet - the entry is filed and attaches to their first window."), err && React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: '#d23a52',
      fontWeight: 600
    }
  }, err), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      justifyContent: 'flex-end'
    }
  }, React.createElement("button", {
    className: "btn",
    disabled: busy,
    onClick: onClose
  }, "Cancel"), React.createElement("button", {
    className: "btn",
    disabled: busy || !what.trim(),
    onClick: save,
    style: {
      background: tone,
      borderColor: tone,
      color: '#fff',
      fontWeight: 700
    }
  }, busy ? 'Saving...' : isAch ? 'Save achievement' : 'Save incident')))));
  return window.ReactDOM && window.ReactDOM.createPortal ? window.ReactDOM.createPortal(body, document.body) : body;
}
function StaffProfile({
  store,
  empId,
  setRoute
}) {
  const S = window.STAFF;
  const e = store.get(empId);
  const [note, setNote] = React.useState('');
  const [discontinuing, setDiscontinuing] = React.useState(false);
  const [conduct, setConduct] = React.useState(null);
  const [printing, setPrinting] = React.useState(false);
  const perfId = e ? e.emp_id || String(e.id) : null;
  const perf = useStaffPerf(perfId);
  if (!e) return React.createElement("div", {
    style: {
      padding: 40
    }
  }, "Staff not found. ", React.createElement("button", {
    className: "btn sm",
    onClick: () => setRoute({
      view: 'nurses'
    })
  }, "Back to roster"));
  const tenure = unicoTenure(e.doj);
  const backView = e.role === 'PCA' ? 'pca' : 'nurses';
  const priorY = S.priorYearsOf(e);
  const totalY = S.expYears(e);
  const totalText = S.fmtYM(totalY);
  const priorExcl = totalY != null ? Math.max(0, Math.round((totalY - S.unicoYearsOf(e)) * 100) / 100) : priorY;
  const priorExclText = priorExcl != null ? S.fmtYM(priorExcl) : '—';
  const entries = Array.isArray(e.prior_experience_entries) ? e.prior_experience_entries : [];
  const profAge = (() => {
    const t = Date.parse(e.dob);
    if (isNaN(t)) return null;
    const a = Math.floor((Date.now() - t) / (365.25 * 24 * 3600 * 1000));
    return a >= 0 && a < 130 ? a : null;
  })();
  const profBday = (() => {
    const d = new Date(e.dob);
    if (!e.dob || isNaN(d)) return null;
    const n = new Date();
    const today = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    let bd = new Date(today.getFullYear(), d.getMonth(), d.getDate());
    if (bd < today) bd = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
    const days = Math.round((bd - today) / 86400000);
    return days === 0 ? '🎂 Today' : days === 1 ? '🎂 Tomorrow' : days <= 30 ? '🎂 in ' + days + ' days' : null;
  })();
  const profLicence = (() => {
    const t = Date.parse(e.licence_expiry);
    if (isNaN(t)) return null;
    const d = Math.round((t - Date.now()) / 86400000);
    return d < 0 ? {
      t: 'Expired',
      c: '#d23a52'
    } : d <= 60 ? {
      t: 'Expires in ' + d + 'd',
      c: '#b5670a'
    } : {
      t: 'Valid',
      c: '#157a43'
    };
  })();
  const field = (l, v, mono) => React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 3
    }
  }, React.createElement("span", {
    style: {
      fontSize: 10.5,
      color: 'var(--muted)',
      textTransform: 'uppercase',
      letterSpacing: .4,
      fontWeight: 600
    }
  }, l), React.createElement("span", {
    style: {
      fontSize: 13.5,
      color: 'var(--ink)',
      fontWeight: 500,
      fontFamily: mono ? 'IBM Plex Mono' : 'inherit'
    }
  }, v || React.createElement("span", {
    style: {
      color: 'var(--faint)'
    }
  }, "\u2014")));
  const sec = (title, kids) => React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, title)), React.createElement("div", {
    className: "card-b",
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '16px 22px'
    }
  }, kids));
  const desig = (window.staffCanonDesig ? window.staffCanonDesig(e.designation) : e.designation) || '';
  const deptText = (window.staffDeptShow ? window.staffDeptShow(e.current_department) : e.current_department) || '';
  const lbl = t => React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--muted)',
      textTransform: 'uppercase',
      letterSpacing: .5,
      fontWeight: 700,
      marginBottom: 9
    }
  }, t);
  const chipRow = (val, tone) => {
    const arr = String(val || '').split(',').map(x => x.trim()).filter(Boolean);
    return arr.length ? React.createElement("div", {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 7
      }
    }, arr.map((x, i) => React.createElement("span", {
      key: i,
      style: {
        fontSize: 12,
        fontWeight: 600,
        padding: '5px 11px',
        borderRadius: 15,
        background: tone.bg,
        color: tone.fg,
        border: '1px solid ' + tone.br
      }
    }, x))) : React.createElement("span", {
      style: {
        fontSize: 11.5,
        fontWeight: 600,
        color: 'var(--faint)',
        padding: '5px 11px',
        borderRadius: 15,
        background: 'var(--panel-2)',
        border: '1px dashed var(--line)',
        display: 'inline-block'
      }
    }, "Not recorded");
  };
  const deptChipRow = val => {
    const arr = [...new Set(String(val || '').split(',').map(x => x.trim()).filter(Boolean).map(x => {
      const c = window.staffCanonDept ? window.staffCanonDept(x) : x;
      return (window.staffDeptLabel ? window.staffDeptLabel(c) : c) || x;
    }))];
    return chipRow(arr.join(', '), {
      bg: '#eef2ff',
      fg: '#4353b0',
      br: '#dfe4fb'
    });
  };
  const statBox = (l, v, c, bg, br) => React.createElement("div", {
    style: {
      background: bg || 'var(--panel-2)',
      border: '1px solid ' + (br || 'var(--line-2)'),
      borderRadius: 10,
      padding: '10px 6px',
      textAlign: 'center'
    }
  }, React.createElement("div", {
    className: "num",
    style: {
      fontSize: 15,
      fontWeight: 800,
      color: c,
      lineHeight: 1.1
    }
  }, v || '—'), React.createElement("div", {
    style: {
      fontSize: 9,
      color: 'var(--muted)',
      marginTop: 4,
      textTransform: 'uppercase',
      letterSpacing: .3,
      fontWeight: 700
    }
  }, l));
  const secHead = (icon, title, sub, ac, right) => React.createElement("div", {
    className: "card-h"
  }, React.createElement("span", {
    style: {
      display: 'inline-grid',
      placeItems: 'center',
      width: 30,
      height: 30,
      borderRadius: 9,
      background: ac ? ac.bg : 'var(--blue-50)',
      color: ac ? ac.fg : 'var(--blue)',
      marginRight: 7
    }
  }, React.createElement(Ic, {
    d: icon,
    s: 16
  })), React.createElement("h3", null, title), sub && React.createElement("span", {
    className: "sub"
  }, sub), React.createElement("span", {
    className: "spacer"
  }), right || null);
  const infoTile = (label, val, mono) => React.createElement("div", {
    style: {
      background: 'var(--panel-2)',
      borderRadius: 9,
      padding: '8px 11px'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 9,
      textTransform: 'uppercase',
      letterSpacing: .5,
      color: 'var(--muted)',
      fontWeight: 700,
      marginBottom: 3
    }
  }, label), React.createElement("div", {
    className: mono ? 'num' : '',
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: val ? 'var(--ink)' : 'var(--faint)'
    }
  }, val || '—'));
  const idRow = (icon, label, val, tint) => React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '7px 0',
      borderTop: '1px solid var(--line-2)'
    }
  }, React.createElement("span", {
    style: {
      display: 'inline-grid',
      placeItems: 'center',
      width: 27,
      height: 27,
      borderRadius: 8,
      background: tint ? tint.bg : 'var(--panel-2)',
      color: tint ? tint.fg : 'var(--muted)',
      flexShrink: 0
    }
  }, React.createElement(Ic, {
    d: icon,
    s: 14
  })), React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)'
    }
  }, label), React.createElement("span", {
    className: "num",
    style: {
      marginLeft: 'auto',
      fontSize: 12.5,
      fontWeight: 700,
      color: 'var(--ink)',
      textAlign: 'right'
    }
  }, val));
  const badgeIni = (() => {
    const p = (e.name || '?').split(' ').filter(Boolean);
    return ((p[0] && p[0][0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  })();
  let badgeHue = 0;
  for (const ch of e.name || '') badgeHue = (badgeHue * 31 + ch.charCodeAt(0)) % 360;
  const barcode = seed => {
    const s = String(seed || 'UNICO0000');
    const bars = [];
    let acc = 7;
    for (let i = 0; i < 48; i++) {
      acc = acc * 31 + (s.charCodeAt(i % s.length) || 48) + i * 7 >>> 0;
      const w = 1 + acc % 4;
      const on = (acc >> 3) % 5 !== 0;
      bars.push(React.createElement("span", {
        key: i,
        style: {
          width: w + 'px',
          background: on ? '#15181c' : 'transparent'
        }
      }));
    }
    return React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'stretch',
        gap: '1.5px',
        height: 42,
        justifyContent: 'center'
      }
    }, bars);
  };
  return React.createElement("div", {
    className: "grid",
    style: {
      gap: 16
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, React.createElement("button", {
    className: "btn sm",
    onClick: () => setRoute({
      view: backView
    })
  }, React.createElement(Ic, {
    d: I.chevR,
    s: 14,
    style: {
      transform: 'rotate(180deg)'
    }
  }), e.role === 'PCA' ? 'PCA' : 'Nurses'), React.createElement("span", {
    className: "spacer",
    style: {
      flex: 1
    }
  }), e.is_active && (!window.unicoCan || window.unicoCan('staff', 'edit')) && React.createElement("button", {
    className: "btn sm",
    title: "Discontinue \u2014 record the exit reason & move to Previous Staff (feeds the attrition rate)",
    style: {
      color: '#d23a52',
      borderColor: '#f1c6cd',
      fontWeight: 700
    },
    onClick: () => setDiscontinuing(true)
  }, "\u26A0 Discontinue"), canPrintStaff() && React.createElement("button", {
    className: "btn sm",
    title: "Print the official staff record \u2014 choose which sections go on the sheet",
    onClick: () => setPrinting(true)
  }, React.createElement(Ic, {
    d: I.print,
    s: 15
  }), "Print"), (!window.unicoCan || window.unicoCan('staff', 'delete')) && React.createElement("button", {
    className: "btn sm",
    title: "Delete permanently",
    style: {
      color: '#d23a52',
      borderColor: '#f1c6cd'
    },
    onClick: async () => {
      const ok = await window.UI.confirm({
        title: `Permanently delete ${e.name}?`,
        message: 'This removes the record entirely and cannot be undone. (Use Deactivate to keep the record.)',
        danger: true,
        confirmLabel: 'Delete permanently'
      });
      if (ok) {
        store.destroy(empId);
        window.UI.toast('Staff record deleted', 'success');
        setRoute({
          view: backView
        });
      }
    }
  }, React.createElement(Ic, {
    d: I.x,
    s: 15,
    sw: 2.4
  }), "Delete"), (!window.unicoCan || window.unicoCan('staff', 'edit')) && React.createElement("button", {
    className: "btn pri sm",
    onClick: () => setRoute({
      view: 'staffForm',
      emp: e.id
    })
  }, React.createElement(Ic, {
    d: I.edit,
    s: 15
  }), "Edit profile")), conduct && canAddPerf() && React.createElement(ConductDialog, {
    kind: conduct,
    e: e,
    perfId: perfId,
    categories: perf && perf.categories,
    already: (perf ? conduct === 'achievement' ? perf.achievements : perf.incidents : []).reduce((n, x) => n + (Number(x.points) || 0), 0),
    onClose: () => setConduct(null),
    onSaved: () => {
      setConduct(null);
      if (perf && perf.reload) perf.reload();
    }
  }), printing && React.createElement(StaffRecordPrint, {
    e: e,
    perf: perf,
    tenure: tenure,
    onClose: () => setPrinting(false)
  }), discontinuing && React.createElement(DiscontinueDialog, {
    e: e,
    onClose: () => setDiscontinuing(false),
    onDone: reasonText => {
      setDiscontinuing(false);
      store.remove(empId, reasonText);
      window.UI && window.UI.toast && window.UI.toast(e.name + ' discontinued — moved to Previous Staff & filed in Attrition & Exits', 'success');
      setRoute({
        view: backView
      });
    }
  }), React.createElement("div", {
    className: "grid staff-portfolio",
    style: {
      gridTemplateColumns: '320px minmax(0,1fr)',
      gap: 14,
      alignItems: 'start'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, React.createElement("div", {
    className: "card id-badge",
    style: {
      padding: 0,
      overflow: 'hidden'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      paddingTop: 10
    }
  }, React.createElement("div", {
    style: {
      width: 48,
      height: 7,
      borderRadius: 5,
      background: 'var(--line)'
    }
  })), React.createElement("div", {
    style: {
      marginTop: 8,
      padding: '11px 15px',
      background: 'var(--panel)',
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, React.createElement("img", {
    src: "unico/logo.svg",
    alt: "UNICO Hospitals",
    style: {
      height: 29,
      width: 'auto',
      display: 'block'
    }
  }), React.createElement("span", {
    className: "spacer",
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 9,
      fontWeight: 800,
      letterSpacing: .8,
      color: '#fff',
      background: 'linear-gradient(130deg,#0aa0d4,#0072a3)',
      padding: '4px 9px',
      borderRadius: 6,
      flexShrink: 0
    }
  }, React.createElement(Ic, {
    d: I.steth,
    s: 12,
    c: "#fff"
  }), e.role === 'PCA' ? 'PCA ID' : 'NURSE ID')), React.createElement("div", {
    style: {
      height: 4,
      background: 'linear-gradient(90deg,#3ab5a7,#0aa0d4,#0072a3)'
    }
  }), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '18px 22px 4px'
    }
  }, React.createElement("div", {
    style: {
      position: 'relative',
      borderRadius: 14,
      padding: 4,
      background: 'var(--panel)',
      border: '1px solid var(--line)',
      boxShadow: '0 6px 16px rgba(0,0,0,.13)'
    }
  }, React.createElement(PhotoPicker, {
    value: e.photo || null,
    initials: badgeIni,
    name: e.name,
    kind: "staff",
    hue: badgeHue,
    w: 104,
    h: 120,
    radius: 10,
    plain: true,
    readOnly: true,
    zoomable: true,
    zoomSub: desig || undefined
  }), e.licence_verified ? (() => {
    const ex = (e.licence_verified.primary || {}).expired;
    return React.createElement("span", {
      title: 'BNMC ' + (ex ? 'registration expired' : 'verified') + ' — checked ' + String(e.licence_verified.at || '').slice(0, 10),
      style: {
        position: 'absolute',
        right: -3,
        bottom: -3,
        width: 26,
        height: 26,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        background: ex ? '#d23a52' : '#1f9d57',
        border: '2.5px solid var(--panel)',
        boxShadow: '0 2px 6px rgba(0,0,0,.28)'
      }
    }, React.createElement(Ic, {
      d: I.check,
      s: 13,
      c: "#fff",
      sw: 3
    }));
  })() : null), React.createElement("h2", {
    style: {
      margin: '14px 0 3px',
      fontSize: 19,
      fontWeight: 800,
      letterSpacing: '-.2px',
      textAlign: 'center'
    }
  }, e.name), React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--blue-700)',
      fontWeight: 700,
      textAlign: 'center'
    }
  }, desig || '—'), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginTop: 11,
      flexWrap: 'wrap',
      justifyContent: 'center'
    }
  }, React.createElement(RoleBadge, {
    role: e.role
  }), e.is_active ? React.createElement("span", {
    className: "chip pos"
  }, "\u25CF Active") : React.createElement("span", {
    className: "chip neg"
  }, "\u25CB Inactive"), e.licence_verified ? (() => {
    const ex = (e.licence_verified.primary || {}).expired;
    return React.createElement("span", {
      title: 'Checked against the BNMC register on ' + String(e.licence_verified.at || '').slice(0, 10),
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        fontWeight: 700,
        padding: '3px 10px',
        borderRadius: 15,
        color: ex ? '#a32c41' : '#157a43',
        background: ex ? '#fdf3f4' : '#eef8f1',
        border: '1px solid ' + (ex ? '#f0c2ca' : '#cde9d8')
      }
    }, React.createElement(Ic, {
      d: I.check,
      s: 11,
      c: ex ? '#a32c41' : '#157a43'
    }), "BNMC ", ex ? 'expired' : 'verified');
  })() : null)), React.createElement("div", {
    style: {
      padding: '8px 22px 0'
    }
  }, [['ID No.', e.emp_id || 'Not set', true], ['Department', deptText || '—', false], ['Joined', e.doj || '—', true], ['Phone', e.phone || '—', true]].map(([l, v, mono], i) => React.createElement("div", {
    key: l,
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 12,
      padding: '8px 0',
      borderTop: i ? '1px solid var(--line-2)' : 'none'
    }
  }, React.createElement("span", {
    style: {
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: .5,
      color: 'var(--muted)',
      fontWeight: 700,
      flex: '0 0 78px'
    }
  }, l), l === 'Phone' && e.phone ? React.createElement("a", {
    href: `tel:${(e.phone || '').replace(/[^\d+]/g, '')}`,
    className: "num",
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      color: '#0f6a39',
      marginLeft: 'auto',
      textAlign: 'right',
      textDecoration: 'none'
    }
  }, v) : React.createElement("span", {
    className: mono ? 'num' : '',
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      color: v === 'Not set' || v === '—' ? 'var(--faint)' : 'var(--ink)',
      marginLeft: 'auto',
      textAlign: 'right',
      wordBreak: 'break-word'
    }
  }, v)))), React.createElement("div", {
    style: {
      margin: '14px 18px 16px',
      padding: '11px 10px 7px',
      borderRadius: 10,
      background: '#fff',
      border: '1px solid var(--line-2)'
    }
  }, barcode(e.emp_id || e.name), React.createElement("div", {
    className: "num",
    style: {
      textAlign: 'center',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 3,
      color: '#15181c',
      marginTop: 6
    }
  }, e.emp_id || '— — — —'))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h",
    style: {
      paddingBottom: 0,
      borderBottom: 'none'
    }
  }, React.createElement("span", {
    style: {
      display: 'inline-grid',
      placeItems: 'center',
      width: 30,
      height: 30,
      borderRadius: 9,
      background: 'var(--blue-50)',
      color: 'var(--blue)',
      marginRight: 7
    }
  }, React.createElement(Ic, {
    d: I.activity,
    s: 16
  })), React.createElement("h3", null, "Key Facts"), React.createElement("span", {
    className: "spacer"
  })), React.createElement("div", {
    className: "card-b",
    style: {
      padding: '0 18px 8px'
    }
  }, idRow(I.trend, 'Total experience', totalText, {
    bg: '#eef8fc',
    fg: 'var(--blue)'
  }), idRow(I.cal, 'Before UNICO', priorExclText, {
    bg: '#f1eefb',
    fg: '#6a52d4'
  }), idRow(I.steth, 'At UNICO', tenure ? tenure.text : '—', {
    bg: '#e7f6ed',
    fg: '#1f9d57'
  }), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '7px 0',
      borderTop: '1px solid var(--line-2)'
    }
  }, React.createElement("span", {
    style: {
      display: 'inline-grid',
      placeItems: 'center',
      width: 27,
      height: 27,
      borderRadius: 8,
      background: '#e7f6ed',
      color: '#1f9d57',
      flexShrink: 0
    }
  }, React.createElement(Ic, {
    d: I.syringe,
    s: 14
  })), React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)'
    }
  }, "Hep-B status"), React.createElement("span", {
    style: {
      marginLeft: 'auto'
    }
  }, React.createElement(VaccBadge, {
    status: e.hepatitis_b_vaccination
  })))))), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, React.createElement("div", {
    className: "card",
    style: {
      borderLeft: '4px solid #6a52d4'
    }
  }, secHead(I.layers, 'Profile', 'role · department · credentials', {
    bg: '#f1eefb',
    fg: '#6a52d4'
  }), React.createElement("div", {
    className: "card-b",
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '11px 12px'
    }
  }, infoTile('Designation', desig), infoTile('Date of joining', e.doj, true), e.gender ? infoTile('Gender', e.gender) : null, e.dob ? infoTile('Date of birth', e.dob + (profAge != null ? '  (' + profAge + ' yrs)' : '') + (profBday ? '   ' + profBday : ''), true) : null, React.createElement("div", {
    style: {
      gridColumn: '1 / -1'
    }
  }, lbl('Department(s)'), deptChipRow(e.current_department), e.primary_department ? React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--muted)',
      marginTop: 5
    }
  }, "Primary \u2014 ", React.createElement("b", {
    style: {
      color: 'var(--ink-2)'
    }
  }, e.primary_department), e.can_float ? ' · can float to other units' : '') : null), e.licence_no || e.licence_expiry ? React.createElement("div", {
    style: {
      gridColumn: '1 / -1',
      background: 'var(--panel-2)',
      borderRadius: 9,
      padding: '8px 11px'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 9,
      textTransform: 'uppercase',
      letterSpacing: .5,
      color: 'var(--muted)',
      fontWeight: 700,
      marginBottom: 3
    }
  }, "Registration / licence"), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 9,
      flexWrap: 'wrap'
    }
  }, React.createElement("span", {
    className: "num",
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, e.licence_no || '—'), e.licence_expiry ? React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)'
    }
  }, "expires ", e.licence_expiry) : null, profLicence ? React.createElement("span", {
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      color: profLicence.c,
      background: profLicence.c + '18',
      border: '1px solid ' + profLicence.c + '44',
      borderRadius: 6,
      padding: '1px 8px'
    }
  }, profLicence.t) : null, e.licence_verified ? React.createElement("span", {
    title: 'BNMC register checked ' + String(e.licence_verified.at || '').slice(0, 10),
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      color: '#157a43',
      background: '#157a4318',
      border: '1px solid #157a4344',
      borderRadius: 6,
      padding: '1px 8px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3
    }
  }, React.createElement(Ic, {
    d: I.check,
    s: 11,
    c: "#157a43"
  }), "BNMC verified ", String(e.licence_verified.at || '').slice(0, 10)) : null), e.licence_verified && e.licence_verified.primary ? React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)',
      marginTop: 5,
      display: 'flex',
      flexWrap: 'wrap',
      gap: '2px 10px'
    }
  }, React.createElement("span", null, e.licence_verified.primary.course), e.licence_verified.primary.institution ? React.createElement("span", null, "\xB7 ", e.licence_verified.primary.institution) : null, e.licence_verified.primary.status ? React.createElement("span", {
    style: {
      fontWeight: 700,
      color: e.licence_verified.primary.expired ? '#d23a52' : '#157a43'
    }
  }, "\xB7 ", e.licence_verified.primary.status) : null) : null) : null, React.createElement("div", null, lbl('Qualification'), chipRow(e.qualification, {
    bg: '#eef8fc',
    fg: '#0072a3',
    br: '#dceffa'
  })), React.createElement("div", null, lbl('Special Training'), chipRow(e.special_training, {
    bg: '#fff4e5',
    fg: '#b5670a',
    br: '#ffe2b8'
  })), React.createElement("div", {
    style: {
      gridColumn: '1 / -1'
    }
  }, lbl('Extracurricular Activities'), chipRow(e.extracurricular, {
    bg: '#f1eefb',
    fg: '#6a52d4',
    br: '#e3dcf7'
  })))), e.licence_verified ? (() => {
    const v = e.licence_verified,
      per = v.person || {},
      regs = v.registrations || [],
      p = v.primary || {};
    const ex = !!p.expired;
    return React.createElement("div", {
      className: "card",
      style: {
        borderLeft: '4px solid ' + (ex ? '#d23a52' : '#1f9d57')
      }
    }, secHead(I.check || I.doc, 'BNMC Registration', 'verified against the council register', {
      bg: ex ? '#fdf3f4' : '#e7f6ed',
      fg: ex ? '#d23a52' : '#1f9d57'
    }), React.createElement("div", {
      className: "card-b"
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '8px 12px',
        borderRadius: 9,
        marginBottom: 13,
        flexWrap: 'wrap',
        background: ex ? '#fdf3f4' : '#eef8f1',
        border: '1px solid ' + (ex ? '#f0c2ca' : '#cde9d8')
      }
    }, React.createElement(Ic, {
      d: I.check,
      s: 15,
      c: ex ? '#a32c41' : '#157a43'
    }), React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: 800,
        color: ex ? '#a32c41' : '#157a43'
      }
    }, "Registration ", p.regNo || v.number, " \xB7 ", p.status || '—', ex ? ' — this licence has expired' : ''), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("span", {
      style: {
        fontSize: 11,
        color: 'var(--muted)'
      }
    }, "checked ", String(v.at || '').slice(0, 10))), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 15,
        flexWrap: 'wrap',
        marginBottom: 14
      }
    }, per.photo ? React.createElement("img", {
      src: '/api/bnmc/photo?u=' + encodeURIComponent(per.photo),
      alt: "",
      style: {
        width: 92,
        height: 110,
        objectFit: 'cover',
        borderRadius: 9,
        border: '1px solid var(--line)',
        background: 'var(--panel-2)'
      },
      onError: ev => {
        ev.target.style.display = 'none';
      }
    }) : null, React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 230,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '11px 20px',
        alignSelf: 'start'
      }
    }, field('Name on the register', per.name), field('Course', p.course), field("Father's name", per.father), field("Mother's name", per.mother), React.createElement("div", {
      style: {
        gridColumn: '1 / -1'
      }
    }, field('Address', per.address)), field('Working place', per.workplace), field('Position', per.position))), React.createElement("div", {
      style: {
        overflowX: 'auto',
        border: '1px solid var(--line-2)',
        borderRadius: 9
      }
    }, React.createElement("table", {
      style: {
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 11.5,
        minWidth: 740
      }
    }, React.createElement("thead", null, React.createElement("tr", null, ['Registration No', 'Course Name', 'Institution / College', 'Licensing Exam Passing Date', 'Date of Registration', 'Date of Renew/Issue', 'Renew Upto', 'Status'].map(h => React.createElement("th", {
      key: h,
      style: {
        textAlign: 'left',
        padding: '8px 10px',
        background: 'var(--panel-2)',
        color: 'var(--muted)',
        textTransform: 'uppercase',
        letterSpacing: .3,
        fontSize: 9.5,
        fontWeight: 800,
        whiteSpace: 'nowrap',
        borderBottom: '1px solid var(--line-2)'
      }
    }, h)))), React.createElement("tbody", null, regs.map((r, i) => {
      const isThis = r.regNo === p.regNo && r.course === p.course;
      return React.createElement("tr", {
        key: i,
        style: {
          borderBottom: '1px solid var(--line-2)',
          background: isThis ? ex ? '#fdf7f8' : '#f6fbf8' : 'transparent'
        }
      }, React.createElement("td", {
        className: "num",
        style: {
          padding: '8px 10px',
          fontWeight: isThis ? 800 : 600
        }
      }, r.regNo), React.createElement("td", {
        style: {
          padding: '8px 10px',
          fontWeight: isThis ? 700 : 400
        }
      }, r.course), React.createElement("td", {
        style: {
          padding: '8px 10px'
        }
      }, r.institution), React.createElement("td", {
        style: {
          padding: '8px 10px',
          whiteSpace: 'nowrap'
        }
      }, r.exam || '—'), React.createElement("td", {
        className: "num",
        style: {
          padding: '8px 10px',
          whiteSpace: 'nowrap'
        }
      }, r.registered || '—'), React.createElement("td", {
        className: "num",
        style: {
          padding: '8px 10px',
          whiteSpace: 'nowrap'
        }
      }, r.renewIssued || '—'), React.createElement("td", {
        className: "num",
        style: {
          padding: '8px 10px',
          whiteSpace: 'nowrap'
        }
      }, r.renewUpto || '—'), React.createElement("td", {
        style: {
          padding: '8px 10px',
          fontWeight: 800,
          whiteSpace: 'nowrap',
          color: r.expired ? '#d23a52' : '#157a43'
        }
      }, r.status || '—'));
    })))), React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--muted)',
        marginTop: 9
      }
    }, "Recorded from bncdb.bnmc.gov.bd on ", String(v.at || '').slice(0, 10), v.programName ? ' · searched under ' + v.programName : '', ". Re-check from Edit profile.")));
  })() : null, React.createElement("div", {
    className: "card",
    style: {
      borderLeft: '4px solid #3ab5a7'
    }
  }, secHead(I.check || I.doc, 'Clinical Privileges', 'activities granted, by privilege area', {
    bg: '#e7f6ed',
    fg: '#1f9d57'
  }), React.createElement("div", {
    className: "card-b"
  }, (() => {
    const stats = S.privilegeStats ? S.privilegeStats(e.role, e.privileges) : {
      granted: 0,
      total: 0,
      byGroup: []
    };
    if (!stats.total) return React.createElement("div", {
      style: {
        color: 'var(--muted)',
        fontSize: 12.5
      }
    }, "No privilege catalogue for this role.");
    if (!stats.granted) return React.createElement("div", {
      style: {
        color: 'var(--faint)',
        fontSize: 12.5
      }
    }, "No privileges recorded yet \u2014 set them from Edit profile.");
    return React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 9
      }
    }, React.createElement("span", {
      className: "num",
      style: {
        fontSize: 26,
        fontWeight: 800,
        color: '#1f9d57'
      }
    }, stats.granted), React.createElement("span", {
      style: {
        fontSize: 12,
        color: 'var(--muted)'
      }
    }, "of ", stats.total, " activities granted, across ", stats.byGroup.filter(g => g.granted > 0).length, " privilege area", stats.byGroup.filter(g => g.granted > 0).length === 1 ? '' : 's')), React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))',
        gap: 9
      }
    }, stats.byGroup.filter(g => g.granted > 0).map(g => React.createElement("div", {
      key: g.group,
      style: {
        background: 'var(--panel-2)',
        borderRadius: 8,
        padding: '7px 10px'
      }
    }, React.createElement("div", {
      style: {
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--ink-2)',
        marginBottom: 4,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      },
      title: g.group
    }, g.group.replace(/^\d+\.\s*/, '')), React.createElement("div", {
      style: {
        height: 5,
        borderRadius: 3,
        background: 'var(--line-2)',
        overflow: 'hidden'
      }
    }, React.createElement("div", {
      style: {
        width: g.granted / g.total * 100 + '%',
        height: '100%',
        background: '#1f9d57'
      }
    })), React.createElement("div", {
      className: "num",
      style: {
        fontSize: 10.5,
        color: 'var(--muted)',
        marginTop: 3
      }
    }, g.granted, "/", g.total)))));
  })())), React.createElement("div", {
    className: "card",
    style: {
      borderLeft: '4px solid #1f9d57'
    }
  }, secHead(I.trend, 'Experience', 'career timeline', {
    bg: '#e7f6ed',
    fg: '#1f9d57'
  }), React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 11
    }
  }, React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 9
    }
  }, statBox('Total', totalText, 'var(--blue-700)', '#eef8fc', '#dceffa'), statBox('Before UNICO', priorExclText, '#6a52d4', '#f1eefb', '#e2dbf7'), statBox('At UNICO', tenure ? tenure.text : '—', '#1f9d57', '#e7f6ed', '#c5e8d4')), entries.length > 0 && React.createElement("div", null, lbl('Prior Positions'), React.createElement("div", null, entries.map((x, i) => React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'stretch'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: 12,
      flexShrink: 0
    }
  }, React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: '50%',
      background: 'var(--blue)',
      marginTop: 5
    }
  }), i < entries.length - 1 && React.createElement("span", {
    style: {
      flex: 1,
      width: 2,
      background: 'var(--line)'
    }
  })), React.createElement("div", {
    style: {
      paddingBottom: i < entries.length - 1 ? 14 : 0
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, x.org || 'Prior role'), x.dept ? React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--ink-2)',
      marginTop: 1
    }
  }, x.dept) : null, React.createElement("div", {
    className: "num",
    style: {
      fontSize: 12,
      color: 'var(--muted)',
      marginTop: 1
    }
  }, S.fmtYM((parseFloat(x.years) || 0) + (parseFloat(x.months) || 0) / 12))))))), React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--muted)',
      borderTop: '1px solid var(--line-2)',
      paddingTop: 12
    }
  }, "UNICO tenure since ", React.createElement("b", {
    style: {
      color: 'var(--ink-2)'
    }
  }, e.doj || '—'), tenure ? ` · ${tenure.text}` : '', "."))), canSeePerf() && (() => {
    const A = window.UNICO_APPRAISAL;
    const st = perf && A && A.standing ? A.standing(e, perf.appraisals, new Date()) : null;
    const done = st ? st.history.slice().reverse() : [];
    const last = st ? st.last : null;
    const cyc = st ? st.cycle : null;
    const gc = g => window.MK && window.MK.GC && window.MK.GC[g] || '#0072a3';
    const band = last ? A.gradeFor(last.score) : null;
    const fmtD = d => {
      try {
        return A.fmtDay(d);
      } catch (err) {
        return '';
      }
    };
    const startLabel = !st || !cyc ? null : st.appraisal ? st.status === 'actioned' ? 'View appraisal' : 'Continue appraisal' : '+ Start ' + cyc.label + ' appraisal';
    return React.createElement("div", {
      className: "card",
      style: {
        borderLeft: '4px solid #0072a3'
      }
    }, secHead(I.trend, 'Performance', e.doj ? 'every 6 months from joining (' + e.doj + ')' : 'every 6 months from the date of joining', {
      bg: '#eef8fc',
      fg: '#0072a3'
    }, canAddPerf() && startLabel ? React.createElement("button", {
      className: "btn sm pri",
      onClick: () => setRoute({
        view: 'perfForm',
        emp: perfId
      })
    }, startLabel) : null), React.createElement("div", {
      className: "card-b",
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }
    }, perf === null ? React.createElement("div", {
      style: {
        color: 'var(--muted)',
        fontSize: 12.5
      }
    }, "Loading the performance file\u2026") : React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        display: 'flex',
        gap: 16,
        alignItems: 'center',
        flexWrap: 'wrap'
      }
    }, React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 230
      }
    }, React.createElement("div", {
      style: {
        fontSize: 10.5,
        textTransform: 'uppercase',
        letterSpacing: .5,
        color: 'var(--muted)',
        fontWeight: 700
      }
    }, last ? 'Latest grade · ' + (last.cycleLabel || last.cycleId || '') : 'No appraisal filed yet'), last ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        marginTop: 3
      }
    }, React.createElement("span", {
      style: {
        fontSize: 36,
        fontWeight: 800,
        lineHeight: 1,
        color: gc(last.grade)
      }
    }, last.grade || '—'), React.createElement("span", {
      className: "num",
      style: {
        fontSize: 19,
        fontWeight: 800,
        color: 'var(--ink)'
      }
    }, last.score == null ? '—' : last.score), React.createElement("span", {
      className: "num",
      style: {
        fontSize: 13,
        color: 'var(--muted)'
      }
    }, "/ 100")), band && React.createElement("div", {
      style: {
        fontSize: 12,
        color: 'var(--muted)',
        marginTop: 2
      }
    }, band.rating, " \u2014 ", band.interp)) : React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: 'var(--muted)',
        marginTop: 4,
        lineHeight: 1.6
      }
    }, "The first appraisal falls six months after joining", e.doj ? ' (' + e.doj + ')' : '', ".", cyc ? ' The current window is ' + cyc.label + '.' : '')), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap'
      }
    }, React.createElement(ApprStat, {
      label: "Appraisals",
      value: st ? st.history.length : 0
    }), done.length > 1 && (() => {
      const d = done[done.length - 1].score - done[0].score;
      return React.createElement(ApprStat, {
        label: 'Since ' + String(done[0].cycleLabel || '').slice(-4),
        value: (d >= 0 ? '▲ ' : '▼ ') + Math.abs(d) + ' pts',
        tone: d >= 0 ? '#1f9d57' : '#d23a52'
      });
    })(), React.createElement(ApprStat, {
      label: "Next due",
      value: cyc ? fmtD(cyc.due) : '—',
      tone: st && st.overdue ? '#d23a52' : null
    }))), last && React.createElement("div", {
      style: {
        height: 9,
        borderRadius: 6,
        background: 'var(--panel-2)',
        overflow: 'hidden'
      }
    }, React.createElement("div", {
      style: {
        width: Math.max(0, Math.min(100, Number(last.score) || 0)) + '%',
        height: '100%',
        borderRadius: 6,
        background: gc(last.grade),
        transition: 'width .9s cubic-bezier(.2,.7,.3,1)'
      }
    })), st && st.overdue && React.createElement("div", {
      style: {
        fontSize: 12,
        fontWeight: 600,
        color: '#d23a52',
        background: '#d23a5212',
        border: '1px solid #d23a5230',
        borderRadius: 8,
        padding: '8px 11px'
      }
    }, "The ", st.lastClosed ? st.lastClosed.label : 'last', " window closed with no appraisal filed."), done.length > 0 && React.createElement("div", null, lbl('Score trend · ' + done.length + ' cycle' + (done.length === 1 ? '' : 's')), React.createElement(ApprTrend, {
      points: done.map(h => ({
        label: h.cycleLabel || h.cycleId || '',
        v: Number(h.score) || 0,
        grade: h.grade
      }))
    })), last && (() => {
      let secs = [];
      try {
        secs = A.tally(last.scores).sections;
      } catch (err) {
        secs = [];
      }
      if (!secs.length) return null;
      return React.createElement("div", null, lbl('Latest breakdown · ' + (last.cycleLabel || '') + ' · by section'), React.createElement("div", {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: 7
        }
      }, secs.map(sc => {
        const p = sc.max ? sc.sub / sc.max * 100 : 0;
        const c = window.MK && window.MK.barColor ? window.MK.barColor(p) : p >= 80 ? '#1f9d57' : p >= 60 ? '#e08a1e' : '#d23a52';
        return React.createElement("div", {
          key: sc.no,
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 9
          }
        }, React.createElement("div", {
          style: {
            width: 150,
            flexShrink: 0,
            fontSize: 11.5,
            color: 'var(--ink-2)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          },
          title: sc.title
        }, sc.title.charAt(0) + sc.title.slice(1).toLowerCase()), React.createElement("div", {
          style: {
            flex: 1,
            height: 8,
            borderRadius: 5,
            background: 'var(--panel-2)',
            overflow: 'hidden'
          }
        }, React.createElement("div", {
          style: {
            width: Math.max(0, Math.min(100, p)) + '%',
            height: '100%',
            borderRadius: 5,
            background: c
          }
        })), React.createElement("div", {
          className: "num",
          style: {
            width: 48,
            textAlign: 'right',
            fontSize: 11.5,
            fontWeight: 700,
            color: 'var(--ink)'
          }
        }, sc.sub, "/", sc.max));
      })));
    })(), React.createElement("div", null, lbl('Appraisal history · confidential'), !st || st.history.length === 0 ? React.createElement("div", {
      style: {
        fontSize: 12,
        color: 'var(--faint)'
      }
    }, "No appraisal has been filed yet.") : React.createElement("div", {
      style: {
        overflowX: 'auto'
      }
    }, React.createElement("table", {
      className: "tbl"
    }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
      style: {
        textAlign: 'left'
      }
    }, "Period"), React.createElement("th", null, "Score"), React.createElement("th", {
      style: {
        textAlign: 'left'
      }
    }, "Grade"), React.createElement("th", {
      style: {
        textAlign: 'left'
      }
    }, "Part H action"), React.createElement("th", null))), React.createElement("tbody", null, st.history.map(h => React.createElement("tr", {
      key: h.id
    }, React.createElement("td", {
      style: {
        textAlign: 'left'
      }
    }, h.cycleLabel || h.cycleId || '—'), React.createElement("td", {
      className: "num"
    }, h.score == null ? '—' : h.score), React.createElement("td", {
      style: {
        textAlign: 'left'
      }
    }, React.createElement("span", {
      style: {
        fontWeight: 800,
        color: gc(h.grade)
      }
    }, h.grade || '—')), React.createElement("td", {
      style: {
        textAlign: 'left',
        fontSize: 11.5,
        color: 'var(--muted)'
      }
    }, (h.actions || []).map(id => ((A.CNS_ACTIONS || []).find(x => x.id === id) || {}).label || id).join(' · ') || '—'), React.createElement("td", {
      style: {
        textAlign: 'right'
      }
    }, canPrintPerf() && React.createElement("button", {
      className: "btn sm",
      onClick: () => setRoute({
        view: 'perfPrint',
        emp: perfId,
        cycleId: h.cycleId
      })
    }, "Print")))))))))));
  })(), canSeePerf() && React.createElement("div", {
    className: "card",
    style: {
      borderLeft: '4px solid #6a52d4'
    }
  }, secHead(I.star || I.doc, 'Recognition & conduct', 'achievements and incidents on file', {
    bg: '#f1eefb',
    fg: '#6a52d4'
  }, canAddPerf() && React.createElement("span", {
    style: {
      display: 'flex',
      gap: 7,
      flexWrap: 'wrap'
    }
  }, React.createElement("button", {
    className: "btn sm",
    onClick: () => setConduct('achievement'),
    style: {
      color: '#1f7a48',
      borderColor: '#bfe5cd',
      fontWeight: 700
    }
  }, "\u2605 Add achievement"), React.createElement("button", {
    className: "btn sm",
    onClick: () => setConduct('incident'),
    style: {
      color: '#d23a52',
      borderColor: '#f1c6cd',
      fontWeight: 700
    }
  }, "\u26A0 Record mistake"))), React.createElement("div", {
    className: "card-b"
  }, perf === null ? React.createElement("div", {
    style: {
      color: 'var(--muted)',
      fontSize: 12.5
    }
  }, "Loading\u2026") : perf.achievements.length === 0 && perf.incidents.length === 0 ? React.createElement("div", {
    style: {
      color: 'var(--muted)',
      fontSize: 12.5
    }
  }, "Nothing recorded \u2014 no achievements and no incidents on this file.", canAddPerf() && React.createElement("span", null, " Use ", React.createElement("b", null, "Add achievement"), " or ", React.createElement("b", null, "Record mistake"), " above to file the first one.")) : React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))',
      gap: 14
    }
  }, React.createElement("div", null, lbl('Achievements · ' + perf.achievements.length), perf.achievements.length === 0 ? React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--faint)'
    }
  }, "None recorded") : perf.achievements.slice().sort((a, b) => (b.date || '') < (a.date || '') ? -1 : 1).slice(0, 6).map((a, i) => React.createElement("div", {
    key: a.id || i,
    style: {
      display: 'flex',
      gap: 9,
      padding: '7px 0',
      borderBottom: '1px solid var(--line-2)',
      alignItems: 'flex-start'
    }
  }, React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: '#1f9d57',
      marginTop: 5,
      flexShrink: 0
    }
  }), React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 600,
      color: 'var(--ink)'
    }
  }, a.what || 'Achievement'), React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--muted)'
    }
  }, [a.date, a.category, a.level, a.points ? '+' + a.points + ' pts' : null].filter(Boolean).join(' · '))), canDelPerf() && a.id && React.createElement("button", {
    className: "icon-btn danger",
    title: "Remove this achievement \u2014 filed by mistake",
    style: {
      width: 24,
      height: 24,
      flexShrink: 0
    },
    onClick: () => removeConductEntry('achievement', a, e.name).then(done => {
      if (done && perf && perf.reload) perf.reload();
    })
  }, React.createElement(Ic, {
    d: I.x,
    s: 13
  }))))), React.createElement("div", null, lbl('Incidents · ' + perf.incidents.length), perf.incidents.length === 0 ? React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--faint)'
    }
  }, "None recorded") : perf.incidents.slice().sort((a, b) => (b.date || '') < (a.date || '') ? -1 : 1).slice(0, 6).map((a, i) => React.createElement("div", {
    key: a.id || i,
    style: {
      display: 'flex',
      gap: 9,
      padding: '7px 0',
      borderBottom: '1px solid var(--line-2)',
      alignItems: 'flex-start'
    }
  }, React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: '#e08a1e',
      marginTop: 5,
      flexShrink: 0
    }
  }), React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 600,
      color: 'var(--ink)'
    }
  }, a.what || 'Incident'), React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--muted)'
    }
  }, [a.date, a.category, a.severity, a.points ? a.points + ' pts' : null].filter(Boolean).join(' · '))), canDelPerf() && a.id && React.createElement("button", {
    className: "icon-btn danger",
    title: "Remove this incident \u2014 filed by mistake",
    style: {
      width: 24,
      height: 24,
      flexShrink: 0
    },
    onClick: () => removeConductEntry('incident', a, e.name).then(done => {
      if (done && perf && perf.reload) perf.reload();
    })
  }, React.createElement(Ic, {
    d: I.x,
    s: 13
  })))))), React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--muted)',
      lineHeight: 1.6,
      marginTop: 11,
      borderTop: '1px solid var(--line-2)',
      paddingTop: 10
    }
  }, "Events are logged for the record and feed the appraisal's bonus and penalty caps. They are never scored on their own."))), e.remarks && React.createElement("div", {
    className: "card",
    style: {
      borderLeft: '4px solid #b5670a'
    }
  }, secHead(I.doc, 'Remarks', null, {
    bg: '#fff4e5',
    fg: '#b5670a'
  }), React.createElement("div", {
    className: "card-b"
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--ink)',
      lineHeight: 1.6
    }
  }, e.remarks))))), (() => {
    const defs = S.customFields && S.customFields() || [];
    const cv = e.custom || {};
    const shown = defs.filter(d => String(cv[d.id] || '').trim());
    const std = [['NID / Passport No.', e.nid, true], ['Blood Group', e.blood_group], ['Emergency Contact', e.emergency_contact], ['Emergency Contact Relation', e.emergency_relation], ['Languages Spoken', e.languages]].filter(r => String(r[1] || '').trim());
    return (std.length > 0 || shown.length > 0) && React.createElement("div", {
      className: "grid",
      style: {
        gridTemplateColumns: '1fr 1fr'
      }
    }, std.length > 0 && sec('Additional Details', std.map(([l, v, mono]) => field(l, v, mono))), shown.length > 0 && sec('Custom Fields', shown.map(d => field(d.name, cv[d.id]))));
  })(), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Notes"), React.createElement("span", {
    className: "spacer"
  }), React.createElement("span", {
    className: "tag num"
  }, (e.notes || []).length)), React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, React.createElement("input", {
    value: note,
    onChange: ev => setNote(ev.target.value),
    onKeyDown: ev => {
      if (ev.key === 'Enter' && note.trim()) {
        store.addNote(e.id, note.trim());
        setNote('');
      }
    },
    placeholder: "Add a note (Enter to save)\u2026",
    style: {
      flex: 1,
      padding: '9px 12px',
      border: '1px solid var(--line)',
      borderRadius: 7,
      fontSize: 13,
      fontFamily: 'inherit',
      outline: 'none'
    }
  }), React.createElement("button", {
    className: "btn pri",
    onClick: () => {
      if (note.trim()) {
        store.addNote(e.id, note.trim());
        setNote('');
      }
    }
  }, "Add note")), (e.notes || []).length === 0 && React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)'
    }
  }, "No notes yet."), (e.notes || []).slice().reverse().map(n => React.createElement("div", {
    key: n.id,
    style: {
      background: 'var(--panel-2)',
      borderRadius: 9,
      padding: '10px 13px'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 3
    }
  }, React.createElement("span", {
    style: {
      fontSize: 10.5,
      color: 'var(--muted)'
    }
  }, n.author, " \xB7 ", new Date(n.ts).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })), React.createElement("span", {
    className: "spacer"
  }), React.createElement("button", {
    className: "icon-btn danger",
    style: {
      width: 24,
      height: 24
    },
    onClick: () => store.delNote(e.id, n.id)
  }, React.createElement(Ic, {
    d: I.x,
    s: 13
  }))), React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--ink)'
    }
  }, n.text))))));
}
function initPriorEntries(ex) {
  const S = window.STAFF;
  if (!ex) return [];
  if (Array.isArray(ex.prior_experience_entries) && ex.prior_experience_entries.length) return ex.prior_experience_entries;
  const unico = S.unicoYearsOf(ex);
  const total = S.expYears(ex);
  const prior = total != null ? Math.max(0, total - unico) : 0;
  if (prior >= 0.08) {
    const yr = Math.floor(prior + 1e-6),
      mo = Math.round((prior - yr) * 12);
    return [{
      org: ex.previous_experience || 'Experience before UNICO',
      years: String(yr || ''),
      months: String(mo || '')
    }];
  }
  return [];
}
function MultiSelectDropdown({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  labelFn,
  allowCustom = true
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const sel = String(value || '').split(',').map(x => x.trim()).filter(Boolean);
  const extras = sel.filter(x => !(options || []).includes(x));
  const all = [...(options || []), ...extras];
  const lab = o => labelFn ? labelFn(o) : o;
  const setSel = arr => onChange(arr.join(', '));
  const toggle = o => setSel(sel.includes(o) ? sel.filter(x => x !== o) : [...sel, o]);
  const filtered = all.filter(o => !q.trim() || lab(o).toLowerCase().includes(q.trim().toLowerCase()));
  const canAdd = allowCustom && q.trim() && !all.some(o => lab(o).toLowerCase() === q.trim().toLowerCase());
  const addCustom = () => {
    const v = q.trim();
    if (v && !sel.includes(v)) setSel([...sel, v]);
    setQ('');
  };
  return React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, React.createElement("div", {
    onClick: () => setOpen(o => !o),
    style: {
      minHeight: 40,
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      flexWrap: 'wrap',
      padding: '6px 10px',
      border: '1px solid ' + (open ? 'var(--blue)' : 'var(--line)'),
      borderRadius: 7,
      background: '#fff',
      cursor: 'pointer'
    }
  }, sel.length === 0 ? React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--faint)'
    }
  }, placeholder) : sel.map(o => React.createElement("span", {
    key: o,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '3px 8px',
      borderRadius: 15,
      fontSize: 12,
      fontWeight: 600,
      background: 'var(--blue-50)',
      color: 'var(--blue-700)',
      border: '1px solid var(--blue-100)'
    }
  }, lab(o), React.createElement("span", {
    onClick: ev => {
      ev.stopPropagation();
      toggle(o);
    },
    title: "Remove",
    style: {
      display: 'inline-grid',
      placeItems: 'center',
      cursor: 'pointer',
      opacity: .7
    }
  }, React.createElement(Ic, {
    d: I.x,
    s: 11,
    sw: 2.4
  })))), React.createElement("span", {
    className: "spacer",
    style: {
      flex: 1
    }
  }), React.createElement(Ic, {
    d: I.chevR,
    s: 15,
    c: "var(--faint)",
    style: {
      transform: open ? 'rotate(-90deg)' : 'rotate(90deg)',
      transition: 'transform .15s'
    }
  })), open && React.createElement(React.Fragment, null, React.createElement("div", {
    onClick: () => {
      setOpen(false);
      setQ('');
    },
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 80
    }
  }), React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 'calc(100% + 5px)',
      zIndex: 81,
      background: '#fff',
      border: '1px solid var(--line)',
      borderRadius: 9,
      boxShadow: 'var(--shadow-pop)',
      overflow: 'hidden'
    }
  }, React.createElement("div", {
    style: {
      padding: 8,
      borderBottom: '1px solid var(--line-2)',
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, React.createElement(Ic, {
    d: I.search,
    s: 14,
    c: "var(--faint)"
  }), React.createElement("input", {
    autoFocus: true,
    value: q,
    onChange: e => setQ(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter' && canAdd) {
        e.preventDefault();
        addCustom();
      }
    },
    placeholder: "Search or type to add\u2026",
    style: {
      flex: 1,
      border: 0,
      outline: 'none',
      fontSize: 12.5,
      fontFamily: 'inherit',
      background: 'transparent'
    }
  }), sel.length > 0 && React.createElement("button", {
    type: "button",
    className: "btn sm",
    onClick: () => setSel([]),
    style: {
      padding: '3px 8px',
      fontSize: 11
    }
  }, "Clear")), React.createElement("div", {
    style: {
      maxHeight: 240,
      overflowY: 'auto',
      padding: 4
    }
  }, filtered.length === 0 && !canAdd && React.createElement("div", {
    style: {
      padding: '12px',
      fontSize: 12,
      color: 'var(--faint)',
      textAlign: 'center'
    }
  }, "No matches"), filtered.map(o => {
    const on = sel.includes(o);
    return React.createElement("div", {
      key: o,
      onClick: () => toggle(o),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '7px 9px',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 12.5,
        color: 'var(--ink-2)',
        fontWeight: on ? 600 : 500,
        background: on ? 'var(--blue-50)' : 'transparent'
      },
      onMouseEnter: ev => {
        if (!on) ev.currentTarget.style.background = 'var(--panel-2)';
      },
      onMouseLeave: ev => {
        if (!on) ev.currentTarget.style.background = 'transparent';
      }
    }, React.createElement("span", {
      style: {
        width: 16,
        height: 16,
        borderRadius: 4,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        border: '1px solid ' + (on ? 'var(--blue)' : 'var(--line)'),
        background: on ? 'var(--blue)' : '#fff'
      }
    }, on && React.createElement(Ic, {
      d: I.check,
      s: 11,
      c: "#fff",
      sw: 2.6
    })), lab(o));
  }), canAdd && React.createElement("div", {
    onClick: addCustom,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '7px 9px',
      borderRadius: 6,
      cursor: 'pointer',
      fontSize: 12.5,
      fontWeight: 600,
      color: 'var(--blue)'
    },
    onMouseEnter: ev => ev.currentTarget.style.background = 'var(--blue-50)',
    onMouseLeave: ev => ev.currentTarget.style.background = 'transparent'
  }, React.createElement(Ic, {
    d: I.plus,
    s: 14
  }), "Add \u201C", q.trim(), "\u201D")))));
}
function SelectDropdown({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  labelFn,
  allowCustom = true
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const cur = String(value || '').trim();
  const extras = cur && !(options || []).includes(cur) ? [cur] : [];
  const all = [...(options || []), ...extras];
  const lab = o => labelFn ? labelFn(o) : o;
  const filtered = all.filter(o => !q.trim() || lab(o).toLowerCase().includes(q.trim().toLowerCase()));
  const canAdd = allowCustom && q.trim() && !all.some(o => lab(o).toLowerCase() === q.trim().toLowerCase());
  const pick = v => {
    onChange(v);
    setOpen(false);
    setQ('');
  };
  return React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, React.createElement("div", {
    onClick: () => setOpen(o => !o),
    style: {
      minHeight: 40,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 10px',
      border: '1px solid ' + (open ? 'var(--blue)' : 'var(--line)'),
      borderRadius: 7,
      background: '#fff',
      cursor: 'pointer'
    }
  }, React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 13,
      color: cur ? 'var(--ink)' : 'var(--faint)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, cur ? lab(cur) : placeholder), cur && React.createElement("span", {
    onClick: ev => {
      ev.stopPropagation();
      onChange('');
    },
    title: "Clear",
    style: {
      display: 'inline-grid',
      placeItems: 'center',
      cursor: 'pointer',
      color: 'var(--faint)'
    }
  }, React.createElement(Ic, {
    d: I.x,
    s: 13,
    sw: 2.2
  })), React.createElement(Ic, {
    d: I.chevR,
    s: 15,
    c: "var(--faint)",
    style: {
      transform: open ? 'rotate(-90deg)' : 'rotate(90deg)',
      transition: 'transform .15s'
    }
  })), open && React.createElement(React.Fragment, null, React.createElement("div", {
    onClick: () => {
      setOpen(false);
      setQ('');
    },
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 80
    }
  }), React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 'calc(100% + 5px)',
      zIndex: 81,
      background: '#fff',
      border: '1px solid var(--line)',
      borderRadius: 9,
      boxShadow: 'var(--shadow-pop)',
      overflow: 'hidden'
    }
  }, React.createElement("div", {
    style: {
      padding: 8,
      borderBottom: '1px solid var(--line-2)',
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, React.createElement(Ic, {
    d: I.search,
    s: 14,
    c: "var(--faint)"
  }), React.createElement("input", {
    autoFocus: true,
    value: q,
    onChange: e => setQ(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (canAdd) pick(q.trim());else if (filtered.length) pick(filtered[0]);
      }
    },
    placeholder: "Search or type to add\u2026",
    style: {
      flex: 1,
      border: 0,
      outline: 'none',
      fontSize: 12.5,
      fontFamily: 'inherit',
      background: 'transparent'
    }
  })), React.createElement("div", {
    style: {
      maxHeight: 260,
      overflowY: 'auto',
      padding: 4
    }
  }, filtered.length === 0 && !canAdd && React.createElement("div", {
    style: {
      padding: '12px',
      fontSize: 12,
      color: 'var(--faint)',
      textAlign: 'center'
    }
  }, "No matches"), filtered.map(o => {
    const on = cur === o;
    return React.createElement("div", {
      key: o,
      onClick: () => pick(o),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '7px 9px',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 12.5,
        color: 'var(--ink-2)',
        fontWeight: on ? 700 : 500,
        background: on ? 'var(--blue-50)' : 'transparent'
      },
      onMouseEnter: ev => {
        if (!on) ev.currentTarget.style.background = 'var(--panel-2)';
      },
      onMouseLeave: ev => {
        if (!on) ev.currentTarget.style.background = 'transparent';
      }
    }, React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: '50%',
        flexShrink: 0,
        background: on ? 'var(--blue)' : 'transparent',
        border: '1px solid ' + (on ? 'var(--blue)' : 'var(--line)')
      }
    }), lab(o));
  }), canAdd && React.createElement("div", {
    onClick: () => pick(q.trim()),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '7px 9px',
      borderRadius: 6,
      cursor: 'pointer',
      fontSize: 12.5,
      fontWeight: 600,
      color: 'var(--blue)'
    },
    onMouseEnter: ev => ev.currentTarget.style.background = 'var(--blue-50)',
    onMouseLeave: ev => ev.currentTarget.style.background = 'transparent'
  }, React.createElement(Ic, {
    d: I.plus,
    s: 14
  }), "Add \u201C", q.trim(), "\u201D")))));
}
function ComboInput({
  value,
  onChange,
  options,
  placeholder,
  labelFn,
  style
}) {
  const [open, setOpen] = React.useState(false);
  const lab = o => labelFn ? labelFn(o) : o;
  const v = String(value || '');
  const q = v.trim().toLowerCase();
  const sugg = [...new Set((options || []).map(lab).filter(Boolean))].filter(l => l.toLowerCase() !== q && (!q || l.toLowerCase().includes(q))).slice(0, 8);
  return React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, React.createElement("input", {
    value: v,
    placeholder: placeholder,
    style: style,
    onChange: ev => {
      onChange(ev.target.value);
      setOpen(true);
    },
    onFocus: () => setOpen(true),
    onKeyDown: ev => {
      if (ev.key === 'Escape') setOpen(false);
    }
  }), open && sugg.length > 0 && React.createElement(React.Fragment, null, React.createElement("div", {
    onClick: () => setOpen(false),
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 80
    }
  }), React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 'calc(100% + 4px)',
      zIndex: 81,
      background: '#fff',
      border: '1px solid var(--line)',
      borderRadius: 9,
      boxShadow: 'var(--shadow-pop)',
      overflow: 'hidden',
      maxHeight: 220,
      overflowY: 'auto',
      padding: 4
    }
  }, sugg.map(l => React.createElement("div", {
    key: l,
    onMouseDown: ev => {
      ev.preventDefault();
      onChange(l);
      setOpen(false);
    },
    style: {
      padding: '7px 9px',
      borderRadius: 6,
      cursor: 'pointer',
      fontSize: 12.5,
      color: 'var(--ink-2)'
    },
    onMouseEnter: ev => ev.currentTarget.style.background = 'var(--panel-2)',
    onMouseLeave: ev => ev.currentTarget.style.background = 'transparent'
  }, l)))));
}
function PrivilegesEditor({
  role,
  value,
  onChange,
  allowedKeys,
  emptyHint,
  deptNames,
  deptGroups,
  onDeptsChanged,
  noTarget
}) {
  const S = window.STAFF;
  const allGroups = S && S.privilegeGroupsFor ? S.privilegeGroupsFor(role) : [];
  const groups = allowedKeys ? allGroups.map(g => ({
    group: g.group,
    items: g.items.filter(it => allowedKeys.has(S.privKey(g.group, it)))
  })).filter(g => g.items.length > 0) : allGroups;
  const p = value || {};
  const [q, setQ] = React.useState('');
  const [openG, setOpenG] = React.useState(() => new Set(groups.map(g => g.group)));
  const [expandedKey, setExpandedKey] = React.useState(null);
  const [, forceLocal] = React.useState(0);
  const qn = q.trim().toLowerCase();
  const total = groups.reduce((s, g) => s + g.items.length, 0);
  const granted = groups.reduce((s, g) => s + g.items.filter(it => p[S.privKey(g.group, it)]).length, 0);
  const toggle = k => {
    const next = {
      ...p
    };
    if (next[k]) delete next[k];else next[k] = true;
    onChange(next);
  };
  const setGroupAll = (g, on) => {
    const next = {
      ...p
    };
    g.items.forEach(it => {
      const k = S.privKey(g.group, it);
      if (on) next[k] = true;else delete next[k];
    });
    onChange(next);
  };
  const toggleOpen = gname => setOpenG(s => {
    const n = new Set(s);
    n.has(gname) ? n.delete(gname) : n.add(gname);
    return n;
  });
  const toggleDeptFor = (dept, group, item, on) => {
    S.setPrivilegeDeptAssignment(dept, role, group, item, !on);
    forceLocal(x => x + 1);
    if (onDeptsChanged) onDeptsChanged();
  };
  const giveManyFor = (deps, group, item, owners) => {
    deps.forEach(d => {
      if (!owners.includes(d)) S.setPrivilegeDeptAssignment(d, role, group, item, true);
    });
    forceLocal(x => x + 1);
    if (onDeptsChanged) onDeptsChanged();
  };
  if (allowedKeys && groups.length === 0) {
    return React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: 'var(--faint)',
        border: '1px dashed var(--line)',
        borderRadius: 9,
        padding: '16px 14px',
        textAlign: 'center'
      }
    }, emptyHint || 'No privileges are assigned yet.');
  }
  return React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, React.createElement("input", {
    value: q,
    onChange: ev => setQ(ev.target.value),
    placeholder: "Search activities\u2026",
    style: {
      flex: '1 1 220px',
      minWidth: 180,
      padding: '8px 11px',
      border: '1px solid var(--line)',
      borderRadius: 7,
      fontSize: 12.5,
      fontFamily: 'inherit',
      outline: 'none'
    }
  }), noTarget ? React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--muted)'
    }
  }, React.createElement("b", {
    className: "num",
    style: {
      color: 'var(--ink)'
    }
  }, total), " activities \u2014 click one below to assign it to department(s) directly.") : React.createElement(React.Fragment, null, React.createElement("span", {
    className: "num",
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: 'var(--ink)',
      whiteSpace: 'nowrap'
    }
  }, granted, " / ", total, " granted"), React.createElement("button", {
    type: "button",
    className: "btn sm",
    disabled: granted === total,
    onClick: () => {
      const next = {
        ...p
      };
      groups.forEach(g => g.items.forEach(it => {
        next[S.privKey(g.group, it)] = true;
      }));
      onChange(next);
    }
  }, "Select all"), React.createElement("button", {
    type: "button",
    className: "btn sm",
    disabled: !granted,
    onClick: () => {
      const next = {
        ...p
      };
      groups.forEach(g => g.items.forEach(it => {
        delete next[S.privKey(g.group, it)];
      }));
      onChange(next);
    }
  }, "Clear all"))), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      maxHeight: 460,
      overflowY: 'auto',
      border: '1px solid var(--line-2)',
      borderRadius: 9,
      padding: 10,
      background: 'var(--panel-2)'
    }
  }, groups.map(g => {
    const items = qn ? g.items.filter(it => it.toLowerCase().includes(qn)) : g.items;
    if (qn && items.length === 0) return null;
    const gGranted = g.items.filter(it => p[S.privKey(g.group, it)]).length;
    const open = qn ? true : allowedKeys ? true : openG.has(g.group);
    return React.createElement("div", {
      key: g.group,
      style: {
        background: '#fff',
        border: '1px solid var(--line-2)',
        borderRadius: 8
      }
    }, React.createElement("div", {
      onClick: () => toggleOpen(g.group),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 11px',
        cursor: 'pointer'
      }
    }, React.createElement(Ic, {
      d: I.chevR,
      s: 13,
      c: "var(--faint)",
      style: {
        transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
        transition: 'transform .15s',
        flexShrink: 0
      }
    }), React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: 700,
        color: 'var(--ink)',
        flex: 1
      }
    }, g.group), noTarget ? React.createElement("span", {
      style: {
        fontSize: 11,
        color: 'var(--muted)'
      }
    }, g.items.length, " activities") : React.createElement(React.Fragment, null, React.createElement("span", {
      className: "num",
      style: {
        fontSize: 11,
        fontWeight: 600,
        color: gGranted ? 'var(--blue-700)' : 'var(--muted)'
      }
    }, gGranted, "/", g.items.length), React.createElement("button", {
      type: "button",
      className: "btn sm",
      style: {
        padding: '3px 8px',
        fontSize: 10.5
      },
      onClick: ev => {
        ev.stopPropagation();
        setGroupAll(g, gGranted < g.items.length);
      }
    }, gGranted < g.items.length ? 'Select all' : 'Clear'))), open && React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))',
        gap: '3px 10px',
        padding: '2px 11px 10px'
      }
    }, items.map(it => {
      const k = S.privKey(g.group, it);
      const on = !!p[k];
      const isExp = deptNames && expandedKey === k;
      const owners = isExp ? S.privilegeDeptsAssigned(deptNames, role, g.group, it) : null;
      const covCount = noTarget ? S.privilegeDeptsAssigned(deptNames, role, g.group, it).length : null;
      const rowClick = noTarget ? () => setExpandedKey(isExp ? null : k) : () => toggle(k);
      return React.createElement(React.Fragment, {
        key: k
      }, React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'flex-start',
          gap: 4
        }
      }, React.createElement("label", {
        onClick: rowClick,
        style: {
          display: 'flex',
          alignItems: 'flex-start',
          gap: 7,
          cursor: 'pointer',
          fontSize: 12,
          color: 'var(--ink-2)',
          padding: '3px 0',
          flex: 1,
          minWidth: 0
        }
      }, noTarget ? React.createElement("span", {
        className: "num",
        title: covCount ? covCount + ' department' + (covCount === 1 ? '' : 's') : 'No departments yet',
        style: {
          minWidth: 15,
          height: 15,
          marginTop: 1,
          padding: '0 2px',
          borderRadius: 4,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          fontSize: 9,
          fontWeight: 700,
          background: covCount ? 'var(--blue-50)' : 'var(--panel-2)',
          color: covCount ? 'var(--blue-700)' : 'var(--faint)',
          border: '1px solid ' + (covCount ? 'var(--blue-100)' : 'var(--line)')
        }
      }, covCount || '') : React.createElement("span", {
        style: {
          width: 15,
          height: 15,
          marginTop: 1,
          borderRadius: 4,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          border: '1px solid ' + (on ? 'var(--blue)' : 'var(--line)'),
          background: on ? 'var(--blue)' : '#fff'
        }
      }, on && React.createElement(Ic, {
        d: I.check,
        s: 10,
        c: "#fff",
        sw: 2.6
      })), React.createElement("span", null, it)), deptNames && React.createElement("span", {
        onClick: () => setExpandedKey(isExp ? null : k),
        title: "Which departments have this activity?",
        style: {
          cursor: 'pointer',
          color: isExp ? 'var(--blue)' : 'var(--faint)',
          flexShrink: 0,
          padding: '2px 2px 0'
        }
      }, React.createElement(Ic, {
        d: I.chevR,
        s: 11,
        style: {
          transform: isExp ? 'rotate(-90deg)' : 'rotate(90deg)'
        }
      }))), isExp && React.createElement("div", {
        style: {
          gridColumn: '1 / -1',
          background: 'var(--panel-2)',
          border: '1px solid var(--line-2)',
          borderRadius: 8,
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6
        }
      }, React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap'
        }
      }, React.createElement("span", {
        style: {
          fontSize: 10.5,
          fontWeight: 700,
          color: 'var(--muted)',
          textTransform: 'uppercase',
          letterSpacing: .4
        }
      }, "Departments for \u201C", it, "\u201D"), React.createElement("span", {
        className: "num",
        style: {
          fontSize: 10.5,
          fontWeight: 700,
          color: owners.length ? 'var(--blue-700)' : '#e08a1e'
        }
      }, owners.length, "/", deptNames.length), owners.length < deptNames.length && React.createElement(React.Fragment, null, React.createElement("span", {
        onClick: () => giveManyFor(deptNames, g.group, it, owners),
        style: {
          cursor: 'pointer',
          fontSize: 10,
          fontWeight: 700,
          padding: '2px 7px',
          borderRadius: 10,
          background: '#fff',
          color: 'var(--ink-2)',
          border: '1px dashed var(--line)'
        }
      }, "+ All"), (deptGroups || []).map(gr => {
        const inSet = (gr.depts || []).filter(d => deptNames.includes(d) && !owners.includes(d));
        return inSet.length > 0 ? React.createElement("span", {
          key: gr.name,
          onClick: () => giveManyFor(inSet, g.group, it, owners),
          style: {
            cursor: 'pointer',
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: 10,
            background: '#fff',
            color: 'var(--ink-2)',
            border: '1px dashed var(--line)'
          }
        }, "+ ", gr.name) : null;
      }))), React.createElement("div", {
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          gap: 5
        }
      }, deptNames.map(d => {
        const dOn = owners.includes(d);
        return React.createElement("span", {
          key: d,
          onClick: () => toggleDeptFor(d, g.group, it, dOn),
          style: {
            cursor: 'pointer',
            padding: '4px 10px',
            borderRadius: 14,
            fontSize: 11,
            fontWeight: 600,
            border: '1px solid ' + (dOn ? 'var(--blue)' : 'var(--line)'),
            background: dOn ? 'var(--blue)' : '#fff',
            color: dOn ? '#fff' : 'var(--ink-2)'
          }
        }, d);
      }))));
    })));
  })));
}
function PrivilegeDeptMatrix({
  role,
  deptNames,
  deptGroups
}) {
  const S = window.STAFF;
  const groups = S.privilegeGroupsFor(role) || [];
  const [, force] = React.useState(0);
  const rerender = () => force(x => x + 1);
  const [q, setQ] = React.useState('');
  const [openG, setOpenG] = React.useState(() => new Set());
  const qn = q.trim().toLowerCase();
  const toggleOpen = gname => setOpenG(s => {
    const n = new Set(s);
    n.has(gname) ? n.delete(gname) : n.add(gname);
    return n;
  });
  const toggleDept = (dept, group, item, on) => {
    S.setPrivilegeDeptAssignment(dept, role, group, item, !on);
    rerender();
  };
  const giveMany = (deps, group, item, owners) => {
    deps.forEach(d => {
      if (!owners.includes(d)) S.setPrivilegeDeptAssignment(d, role, group, item, true);
    });
    rerender();
  };
  const groupsShown = groups.map(g => ({
    group: g.group,
    items: qn ? g.items.filter(it => it.toLowerCase().includes(qn) || g.group.toLowerCase().includes(qn)) : g.items
  })).filter(g => g.items.length > 0);
  const totalActivities = groups.reduce((s, g) => s + g.items.length, 0);
  const unassigned = groups.reduce((s, g) => s + g.items.filter(it => S.privilegeDeptsAssigned(deptNames, role, g.group, it).length === 0).length, 0);
  const quickBtn = {
    cursor: 'pointer',
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 7px',
    borderRadius: 10,
    background: 'var(--panel-2)',
    color: 'var(--ink-2)',
    border: '1px dashed var(--line)',
    whiteSpace: 'nowrap'
  };
  return React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)'
    }
  }, "Expand a privilege area, then click any department chip on an activity to grant or revoke it \u2014 no extra menu."), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      flexWrap: 'wrap'
    }
  }, React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Search activities or areas\u2026",
    style: {
      flex: '1 1 240px',
      minWidth: 200,
      padding: '8px 11px',
      border: '1px solid var(--line)',
      borderRadius: 7,
      fontSize: 12.5,
      fontFamily: 'inherit',
      outline: 'none'
    }
  }), React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--muted)'
    }
  }, React.createElement("b", {
    className: "num",
    style: {
      color: 'var(--ink)'
    }
  }, totalActivities), " activities"), React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--muted)'
    }
  }, React.createElement("b", {
    className: "num",
    style: {
      color: unassigned ? 'var(--rose)' : 'var(--ink)'
    }
  }, unassigned), " unassigned")), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      maxHeight: 560,
      overflowY: 'auto',
      border: '1px solid var(--line-2)',
      borderRadius: 9,
      padding: 10,
      background: 'var(--panel-2)'
    }
  }, groupsShown.length === 0 && React.createElement("div", {
    style: {
      padding: 18,
      textAlign: 'center',
      color: 'var(--faint)',
      fontSize: 12.5
    }
  }, "No matches."), groupsShown.map(g => {
    const open = qn ? true : openG.has(g.group);
    const gCovered = g.items.filter(it => S.privilegeDeptsAssigned(deptNames, role, g.group, it).length > 0).length;
    return React.createElement("div", {
      key: g.group,
      style: {
        background: '#fff',
        border: '1px solid var(--line-2)',
        borderRadius: 8
      }
    }, React.createElement("div", {
      onClick: () => toggleOpen(g.group),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 11px',
        cursor: 'pointer'
      }
    }, React.createElement(Ic, {
      d: I.chevR,
      s: 13,
      c: "var(--faint)",
      style: {
        transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
        transition: 'transform .15s',
        flexShrink: 0
      }
    }), React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: 700,
        color: 'var(--ink)',
        flex: 1
      }
    }, g.group), React.createElement("span", {
      className: "num",
      style: {
        fontSize: 11,
        fontWeight: 600,
        color: gCovered ? 'var(--blue-700)' : 'var(--muted)'
      }
    }, gCovered, "/", g.items.length, " have a department")), open && g.items.map((it, i) => {
      const owners = S.privilegeDeptsAssigned(deptNames, role, g.group, it);
      return React.createElement("div", {
        key: it,
        style: {
          padding: '9px 11px',
          borderTop: i > 0 ? '1px solid var(--line-2)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 6
        }
      }, React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap'
        }
      }, React.createElement("span", {
        style: {
          fontSize: 12.5,
          fontWeight: 600,
          color: 'var(--ink)',
          flex: '1 1 auto',
          minWidth: 160
        }
      }, it), React.createElement("span", {
        className: "num",
        style: {
          fontSize: 10.5,
          fontWeight: 700,
          color: owners.length ? 'var(--blue-700)' : '#e08a1e'
        }
      }, owners.length, "/", deptNames.length), owners.length < deptNames.length && React.createElement(React.Fragment, null, React.createElement("span", {
        onClick: () => giveMany(deptNames, g.group, it, owners),
        style: quickBtn
      }, "+ All"), (deptGroups || []).map(gr => {
        const inSet = (gr.depts || []).filter(d => deptNames.includes(d) && !owners.includes(d));
        return inSet.length > 0 ? React.createElement("span", {
          key: gr.name,
          onClick: () => giveMany(inSet, g.group, it, owners),
          style: quickBtn
        }, "+ ", gr.name) : null;
      }))), React.createElement("div", {
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          gap: 5
        }
      }, deptNames.map(d => {
        const on = owners.includes(d);
        return React.createElement("span", {
          key: d,
          onClick: () => toggleDept(d, g.group, it, on),
          style: {
            cursor: 'pointer',
            padding: '4px 10px',
            borderRadius: 14,
            fontSize: 11,
            fontWeight: 600,
            border: '1px solid ' + (on ? 'var(--blue)' : 'var(--line)'),
            background: on ? 'var(--blue)' : '#fff',
            color: on ? '#fff' : 'var(--ink-2)'
          }
        }, d);
      })));
    }));
  })));
}
function PrivilegeMatrix({
  role,
  deptNames
}) {
  const S = window.STAFF;
  const groups = S.privilegeGroupsFor(role) || [];
  const [, force] = React.useState(0);
  const rerender = () => force(x => x + 1);
  const [groupIdx, setGroupIdx] = React.useState(0);
  const gi = Math.min(groupIdx, Math.max(0, groups.length - 1));
  const g = groups[gi] || {
    group: '',
    items: []
  };
  const isOn = (dept, item) => !!(S.deptPrivilegeMap(dept, role) || {})[S.privKey(g.group, item)];
  const toggleCell = (dept, item) => {
    S.setPrivilegeDeptAssignment(dept, role, g.group, item, !isOn(dept, item));
    rerender();
  };
  const rowOn = item => deptNames.every(d => isOn(d, item));
  const toggleRow = item => {
    const on = rowOn(item);
    deptNames.forEach(d => S.setPrivilegeDeptAssignment(d, role, g.group, item, !on));
    rerender();
  };
  const colOn = dept => g.items.length > 0 && g.items.every(it => isOn(dept, it));
  const toggleCol = dept => {
    const on = colOn(dept);
    g.items.forEach(it => S.setPrivilegeDeptAssignment(dept, role, g.group, it, !on));
    rerender();
  };
  const thBase = {
    position: 'sticky',
    top: 0,
    zIndex: 2,
    padding: '8px 8px',
    fontSize: 10.5,
    fontWeight: 700,
    borderBottom: '1px solid var(--line-2)',
    whiteSpace: 'nowrap',
    minWidth: 64,
    textAlign: 'center',
    cursor: 'pointer'
  };
  return React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)'
    }
  }, "Every activity in one privilege area against every department. Click a cell to toggle it, an activity name to toggle its whole row, or a department name to toggle its whole column."), React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6,
      maxHeight: 88,
      overflowY: 'auto'
    }
  }, groups.map((gr, i) => React.createElement("button", {
    key: gr.group,
    type: "button",
    className: 'btn sm' + (i === gi ? ' pri' : ''),
    onClick: () => setGroupIdx(i)
  }, gr.group, React.createElement("span", {
    className: "num",
    style: {
      opacity: .7,
      marginLeft: 5
    }
  }, gr.items.length)))), g.items.length === 0 ? React.createElement("div", {
    style: {
      padding: 18,
      textAlign: 'center',
      color: 'var(--faint)',
      fontSize: 12.5
    }
  }, "No activities in this area.") : React.createElement("div", {
    style: {
      border: '1px solid var(--line-2)',
      borderRadius: 9,
      overflow: 'auto',
      maxHeight: 560
    }
  }, React.createElement("table", {
    style: {
      borderCollapse: 'collapse',
      fontSize: 12,
      width: '100%'
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: {
      position: 'sticky',
      left: 0,
      top: 0,
      zIndex: 3,
      background: '#fff',
      minWidth: 230,
      textAlign: 'left',
      padding: '8px 10px',
      borderBottom: '1px solid var(--line-2)',
      borderRight: '1px solid var(--line-2)',
      fontSize: 10.5,
      color: 'var(--muted)'
    }
  }, "Activity"), deptNames.map(d => {
    const on = colOn(d);
    return React.createElement("th", {
      key: d,
      onClick: () => toggleCol(d),
      title: 'Toggle every activity in this area for ' + d,
      style: {
        ...thBase,
        background: on ? 'var(--blue-50)' : 'var(--panel-2)',
        color: on ? 'var(--blue-700)' : 'var(--ink-2)'
      }
    }, d);
  }))), React.createElement("tbody", null, g.items.map((it, ri) => {
    const on = rowOn(it);
    return React.createElement("tr", {
      key: it
    }, React.createElement("td", {
      onClick: () => toggleRow(it),
      title: 'Toggle "' + it + '" for every department',
      style: {
        position: 'sticky',
        left: 0,
        zIndex: 1,
        background: on ? 'var(--blue-50)' : '#fff',
        cursor: 'pointer',
        padding: '6px 10px',
        fontWeight: 600,
        color: on ? 'var(--blue-700)' : 'var(--ink)',
        borderRight: '1px solid var(--line-2)',
        borderBottom: ri < g.items.length - 1 ? '1px solid var(--line-2)' : 'none',
        whiteSpace: 'nowrap'
      }
    }, it), deptNames.map(d => {
      const cellOn = isOn(d, it);
      return React.createElement("td", {
        key: d,
        onClick: () => toggleCell(d, it),
        style: {
          textAlign: 'center',
          cursor: 'pointer',
          padding: '6px 8px',
          borderBottom: ri < g.items.length - 1 ? '1px solid var(--line-2)' : 'none',
          background: cellOn ? 'rgba(11,102,208,.06)' : 'transparent'
        }
      }, React.createElement("span", {
        style: {
          display: 'inline-grid',
          placeItems: 'center',
          width: 16,
          height: 16,
          borderRadius: 4,
          border: '1px solid ' + (cellOn ? 'var(--blue)' : 'var(--line)'),
          background: cellOn ? 'var(--blue)' : '#fff'
        }
      }, cellOn && React.createElement(Ic, {
        d: I.check,
        s: 10,
        c: "#fff",
        sw: 2.6
      })));
    }));
  })))));
}
function BulkPrivilegeAssigner({
  role,
  deptNames,
  deptGroups
}) {
  const S = window.STAFF;
  const groups = S.privilegeGroupsFor(role) || [];
  const [, force] = React.useState(0);
  const rerender = () => force(x => x + 1);
  const [q, setQ] = React.useState('');
  const [openG, setOpenG] = React.useState(() => new Set(groups.map(g => g.group)));
  const [cart, setCart] = React.useState({});
  const [targetStr, setTargetStr] = React.useState('');
  const qn = q.trim().toLowerCase();
  const toggleOpen = gname => setOpenG(s => {
    const n = new Set(s);
    n.has(gname) ? n.delete(gname) : n.add(gname);
    return n;
  });
  const toggleCart = key => setCart(c => {
    const n = {
      ...c
    };
    if (n[key]) delete n[key];else n[key] = true;
    return n;
  });
  const cartKeys = Object.keys(cart);
  const groupsShown = groups.map(g => ({
    group: g.group,
    items: qn ? g.items.filter(it => it.toLowerCase().includes(qn) || g.group.toLowerCase().includes(qn)) : g.items
  })).filter(g => g.items.length > 0);
  const targetDepts = String(targetStr || '').split(',').map(x => x.trim()).filter(Boolean);
  const applyTo = add => {
    if (!cartKeys.length || !targetDepts.length) return;
    targetDepts.forEach(dn => {
      const m = {
        ...(S.deptPrivilegeMap(dn, role) || {})
      };
      cartKeys.forEach(k => {
        if (add) m[k] = true;else delete m[k];
      });
      S.setDeptPrivilegeMap(dn, role, m);
    });
    window.UI && window.UI.toast((add ? 'Assigned ' : 'Removed ') + cartKeys.length + ' privilege' + (cartKeys.length === 1 ? '' : 's') + (add ? ' to ' : ' from ') + targetDepts.join(', '), 'success');
    rerender();
  };
  return React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)'
    }
  }, "Tick any specific activities below \u2014 from any privilege area, mixed together \u2014 to build a bundle, then assign (or remove) that exact bundle across one or more departments in a single action."), React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Search activities or areas\u2026",
    style: {
      padding: '8px 11px',
      border: '1px solid var(--line)',
      borderRadius: 7,
      fontSize: 12.5,
      fontFamily: 'inherit',
      outline: 'none'
    }
  }), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      maxHeight: 380,
      overflowY: 'auto',
      border: '1px solid var(--line-2)',
      borderRadius: 9,
      padding: 10,
      background: 'var(--panel-2)'
    }
  }, groupsShown.length === 0 && React.createElement("div", {
    style: {
      padding: 18,
      textAlign: 'center',
      color: 'var(--faint)',
      fontSize: 12.5
    }
  }, "No matches."), groupsShown.map(g => {
    const open = qn ? true : openG.has(g.group);
    const gSel = g.items.filter(it => cart[S.privKey(g.group, it)]).length;
    return React.createElement("div", {
      key: g.group,
      style: {
        background: '#fff',
        border: '1px solid var(--line-2)',
        borderRadius: 8
      }
    }, React.createElement("div", {
      onClick: () => toggleOpen(g.group),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 11px',
        cursor: 'pointer'
      }
    }, React.createElement(Ic, {
      d: I.chevR,
      s: 13,
      c: "var(--faint)",
      style: {
        transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
        transition: 'transform .15s',
        flexShrink: 0
      }
    }), React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: 700,
        color: 'var(--ink)',
        flex: 1
      }
    }, g.group), React.createElement("span", {
      className: "num",
      style: {
        fontSize: 11,
        fontWeight: 600,
        color: gSel ? 'var(--blue-700)' : 'var(--muted)'
      }
    }, gSel, "/", g.items.length)), open && React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))',
        gap: '3px 10px',
        padding: '2px 11px 10px'
      }
    }, g.items.map(it => {
      const k = S.privKey(g.group, it);
      const on = !!cart[k];
      return React.createElement("label", {
        key: k,
        onClick: () => toggleCart(k),
        style: {
          display: 'flex',
          alignItems: 'flex-start',
          gap: 7,
          cursor: 'pointer',
          fontSize: 12,
          color: 'var(--ink-2)',
          padding: '3px 0'
        }
      }, React.createElement("span", {
        style: {
          width: 15,
          height: 15,
          marginTop: 1,
          borderRadius: 4,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          border: '1px solid ' + (on ? 'var(--blue)' : 'var(--line)'),
          background: on ? 'var(--blue)' : '#fff'
        }
      }, on && React.createElement(Ic, {
        d: I.check,
        s: 10,
        c: "#fff",
        sw: 2.6
      })), React.createElement("span", null, it));
    })));
  })), React.createElement("div", {
    style: {
      border: '1px solid var(--line-2)',
      borderRadius: 9,
      padding: 12,
      background: 'var(--panel-2)',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, React.createElement("span", {
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, "Selected: ", cartKeys.length, " activit", cartKeys.length === 1 ? 'y' : 'ies'), React.createElement("span", {
    style: {
      flex: 1
    }
  }), React.createElement("button", {
    type: "button",
    className: "btn sm",
    disabled: !cartKeys.length,
    onClick: () => setCart({})
  }, "Clear selection")), React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      color: 'var(--muted)',
      textTransform: 'uppercase',
      letterSpacing: .4,
      marginBottom: 6
    }
  }, "Quick select a zone"), React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 7
    }
  }, React.createElement("button", {
    type: "button",
    className: "btn sm",
    onClick: () => setTargetStr(deptNames.join(', '))
  }, "All Hospital ", React.createElement("span", {
    className: "num",
    style: {
      opacity: .7,
      marginLeft: 4
    }
  }, deptNames.length)), (deptGroups || []).map(g => {
    const inSet = (g.depts || []).filter(d => deptNames.includes(d));
    return inSet.length > 0 ? React.createElement("button", {
      key: g.name,
      type: "button",
      className: "btn sm",
      onClick: () => setTargetStr(inSet.join(', '))
    }, g.name, " ", React.createElement("span", {
      className: "num",
      style: {
        opacity: .7,
        marginLeft: 4
      }
    }, inSet.length)) : null;
  }))), React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      color: 'var(--muted)',
      textTransform: 'uppercase',
      letterSpacing: .4,
      marginBottom: 6
    }
  }, "Or pick department(s)"), React.createElement(MultiSelectDropdown, {
    value: targetStr,
    onChange: setTargetStr,
    options: deptNames,
    placeholder: "Select department(s)\u2026"
  })), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      alignItems: 'center',
      borderTop: '1px solid var(--line-2)',
      paddingTop: 10
    }
  }, React.createElement("button", {
    type: "button",
    className: "btn pri",
    disabled: !cartKeys.length || !targetDepts.length,
    onClick: () => applyTo(true)
  }, React.createElement(Ic, {
    d: I.plus,
    s: 14
  }), "Assign ", cartKeys.length || '', " to ", targetDepts.length || 0, " department", targetDepts.length === 1 ? '' : 's'), React.createElement("button", {
    type: "button",
    className: "btn",
    style: {
      color: 'var(--rose)',
      borderColor: '#f1c6cd'
    },
    disabled: !cartKeys.length || !targetDepts.length,
    onClick: () => applyTo(false)
  }, "Remove instead"))));
}
function DeptGroupsManager({
  deptNames,
  groups,
  onChange
}) {
  const [draftName, setDraftName] = React.useState('');
  const [draftDepts, setDraftDepts] = React.useState('');
  const update = (i, patch) => onChange(groups.map((g, j) => j === i ? {
    ...g,
    ...patch
  } : g));
  const remove = i => onChange(groups.filter((_, j) => j !== i));
  const addGroup = () => {
    const n = (draftName || '').trim();
    if (!n) return;
    const d = String(draftDepts || '').split(',').map(x => x.trim()).filter(Boolean);
    onChange([...groups, {
      name: n,
      depts: d
    }]);
    setDraftName('');
    setDraftDepts('');
  };
  return React.createElement("div", {
    style: {
      border: '1px solid var(--line-2)',
      borderRadius: 9,
      padding: 12,
      background: '#fff',
      marginBottom: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)'
    }
  }, "Edit which departments each quick-select group covers, or add your own (e.g. \u201CAll Radiology\u201D). These are just shortcuts \u2014 nothing here is assigned until you pick a group and tick privileges below."), groups.map((g, i) => React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, React.createElement("input", {
    value: g.name,
    onChange: e => update(i, {
      name: e.target.value
    }),
    style: {
      width: 170,
      padding: '8px 10px',
      border: '1px solid var(--line)',
      borderRadius: 7,
      fontSize: 12.5,
      fontFamily: 'inherit',
      outline: 'none'
    }
  }), React.createElement("div", {
    style: {
      flex: '1 1 260px',
      minWidth: 220
    }
  }, React.createElement(MultiSelectDropdown, {
    value: (g.depts || []).join(', '),
    onChange: v => update(i, {
      depts: v.split(',').map(x => x.trim()).filter(Boolean)
    }),
    options: deptNames,
    placeholder: "No departments in this group"
  })), React.createElement("button", {
    type: "button",
    className: "icon-btn danger",
    title: "Delete group",
    onClick: () => remove(i)
  }, React.createElement(Ic, {
    d: I.x,
    s: 14
  })))), groups.length === 0 && React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--faint)'
    }
  }, "No quick-select groups yet."), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      borderTop: '1px solid var(--line-2)',
      paddingTop: 10
    }
  }, React.createElement("input", {
    value: draftName,
    onChange: e => setDraftName(e.target.value),
    placeholder: "New group name \u2014 e.g. All Radiology",
    style: {
      width: 220,
      padding: '8px 10px',
      border: '1px solid var(--line)',
      borderRadius: 7,
      fontSize: 12.5,
      fontFamily: 'inherit',
      outline: 'none'
    }
  }), React.createElement("div", {
    style: {
      flex: '1 1 220px',
      minWidth: 200
    }
  }, React.createElement(MultiSelectDropdown, {
    value: draftDepts,
    onChange: setDraftDepts,
    options: deptNames,
    placeholder: "Select departments\u2026"
  })), React.createElement("button", {
    type: "button",
    className: "btn pri sm",
    onClick: addGroup,
    disabled: !draftName.trim()
  }, React.createElement(Ic, {
    d: I.plus,
    s: 13
  }), "Add group")));
}
function DeptPrivilegesSettings({
  depts
}) {
  const S = window.STAFF;
  const deptObjs = depts && depts.length ? depts : (S.DEPARTMENTS || []).map(n => ({
    name: n,
    group: ''
  }));
  const deptNames = [...new Set(deptObjs.map(d => d && d.name ? d.name : d).filter(Boolean))];
  const [groupsOpen, setGroupsOpen] = React.useState(false);
  const deptGroups = S.deptGroupsFor(deptObjs) || [];
  const [view, setView] = React.useState('byDept');
  const [deptStr, setDeptStr] = React.useState('');
  const [role, setRole] = React.useState('Nurse');
  const [copyFrom, setCopyFrom] = React.useState('');
  const [, force] = React.useState(0);
  const rerender = () => force(x => x + 1);
  const [newGroup, setNewGroup] = React.useState('');
  const [newItem, setNewItem] = React.useState('');
  const selDepts = String(deptStr || '').split(',').map(x => x.trim()).filter(Boolean);
  const assigned = (() => {
    if (!selDepts.length) return {};
    const maps = selDepts.map(d => S.deptPrivilegeMap(d, role) || {});
    const out = {};
    Object.keys(maps[0]).forEach(k => {
      if (maps[0][k] && maps.every(m => m[k])) out[k] = true;
    });
    return out;
  })();
  const setAssigned = next => {
    if (!selDepts.length) return;
    const on = Object.keys(next).filter(k => next[k] && !assigned[k]);
    const off = Object.keys(assigned).filter(k => assigned[k] && !next[k]);
    if (!on.length && !off.length) return;
    selDepts.forEach(d => {
      const m = {
        ...(S.deptPrivilegeMap(d, role) || {})
      };
      on.forEach(k => {
        m[k] = true;
      });
      off.forEach(k => {
        delete m[k];
      });
      S.setDeptPrivilegeMap(d, role, m);
    });
    rerender();
  };
  const groupOpts = (S.privilegeGroupsFor(role) || []).map(g => g.group);
  const addPrivilege = () => {
    const g = (newGroup || '').trim(),
      it = (newItem || '').trim();
    if (!g || !it) return;
    const ok = S.addCustomPrivilege(role, g, it);
    if (!ok) {
      window.UI && window.UI.toast('That activity already exists in this area', 'warn');
      return;
    }
    if (view === 'byDept' && selDepts.length) setAssigned({
      ...assigned,
      [S.privKey(g, it)]: true
    });
    setNewItem('');
    window.UI && window.UI.toast('Privilege “' + it + '” added' + (view === 'byDept' && selDepts.length ? ' and assigned to ' + selDepts.join(', ') : ''), 'success');
    rerender();
  };
  const customList = (() => {
    const all = S.loadCustomPrivileges && S.loadCustomPrivileges() || {};
    return (all[role === 'PCA' ? 'PCA' : 'Nurse'] || []).flatMap(g => g.items.map(it => ({
      group: g.group,
      item: it
    })));
  })();
  const doCopy = () => {
    if (!copyFrom || !selDepts.length) return;
    const srcMap = S.deptPrivilegeMap(copyFrom, role) || {};
    const keys = Object.keys(srcMap).filter(k => srcMap[k]);
    if (!keys.length) {
      window.UI && window.UI.toast(copyFrom + ' has no privileges assigned yet', 'warn');
      return;
    }
    selDepts.forEach(d => {
      const m = {
        ...(S.deptPrivilegeMap(d, role) || {})
      };
      keys.forEach(k => {
        m[k] = true;
      });
      S.setDeptPrivilegeMap(d, role, m);
    });
    window.UI && window.UI.toast('Copied ' + keys.length + ' activities from ' + copyFrom + ' to ' + selDepts.join(', '), 'success');
    setCopyFrom('');
    rerender();
  };
  return React.createElement("div", {
    className: "grid",
    style: {
      gap: 16
    }
  }, React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-b"
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap',
      marginBottom: 2
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, "Department privileges"), React.createElement("span", {
    style: {
      flex: 1
    }
  }), React.createElement("div", {
    style: {
      display: 'inline-flex',
      gap: 3,
      padding: 3,
      borderRadius: 9,
      background: 'rgba(125,145,180,.16)'
    }
  }, React.createElement("button", {
    type: "button",
    className: 'btn sm' + (view === 'byDept' ? ' pri' : ''),
    onClick: () => setView('byDept')
  }, "By department"), React.createElement("button", {
    type: "button",
    className: 'btn sm' + (view === 'byPrivilege' ? ' pri' : ''),
    onClick: () => setView('byPrivilege')
  }, "By privilege"), React.createElement("button", {
    type: "button",
    className: 'btn sm' + (view === 'matrix' ? ' pri' : ''),
    onClick: () => setView('matrix')
  }, "Matrix"), React.createElement("button", {
    type: "button",
    className: 'btn sm' + (view === 'bulk' ? ' pri' : ''),
    onClick: () => setView('bulk')
  }, "Bulk assign"))), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)',
      marginBottom: 14
    }
  }, view === 'byDept' ? "Choose which clinical activities apply to each department, per role. Pick several departments at once to set up the same list for all of them in one pass. Once a department is set on a staff member's profile, only the activities assigned here show up for them to be granted." : view === 'byPrivilege' ? 'Pick one activity and tick every department it applies to — quicker when the same activity belongs to several departments at once.' : view === 'matrix' ? 'A spreadsheet view: one privilege area at a time, every activity against every department. Click a cell, a row, or a whole column.' : 'Tick a bundle of specific activities from anywhere in the catalogue, then assign that whole bundle to one or more departments in a single action.'), view === 'byDept' && React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, React.createElement("div", {
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      color: 'var(--muted)',
      textTransform: 'uppercase',
      letterSpacing: .4,
      marginBottom: 6
    }
  }, "Quick select a zone"), React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 7,
      alignItems: 'center'
    }
  }, React.createElement("button", {
    type: "button",
    className: "btn sm",
    onClick: () => setDeptStr(deptNames.join(', '))
  }, "All Hospital ", React.createElement("span", {
    className: "num",
    style: {
      opacity: .7,
      marginLeft: 4
    }
  }, deptNames.length)), deptGroups.map(g => {
    const inThisSet = (g.depts || []).filter(d => deptNames.includes(d));
    return React.createElement("button", {
      key: g.name,
      type: "button",
      className: "btn sm",
      title: inThisSet.join(', ') || 'No departments in this group yet',
      disabled: !inThisSet.length,
      onClick: () => setDeptStr(inThisSet.join(', '))
    }, g.name, " ", React.createElement("span", {
      className: "num",
      style: {
        opacity: .7,
        marginLeft: 4
      }
    }, inThisSet.length));
  }), React.createElement("button", {
    type: "button",
    className: "btn sm",
    onClick: () => setGroupsOpen(o => !o)
  }, React.createElement(Ic, {
    d: I.gear,
    s: 12
  }), groupsOpen ? 'Done editing groups' : 'Manage groups')), groupsOpen && React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, React.createElement(DeptGroupsManager, {
    deptNames: deptNames,
    groups: deptGroups,
    onChange: g => {
      S.setDeptGroups(g);
      rerender();
    }
  }))), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16,
      flexWrap: 'wrap',
      alignItems: 'flex-end',
      marginBottom: 14
    }
  }, view === 'byDept' && React.createElement("div", {
    style: {
      minWidth: 260,
      flex: '1 1 260px'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      color: 'var(--muted)',
      textTransform: 'uppercase',
      letterSpacing: .4,
      marginBottom: 5
    }
  }, "Department", selDepts.length > 1 ? 's' : '', selDepts.length > 1 ? ' (' + selDepts.length + ' selected — edits apply to all)' : ''), React.createElement(MultiSelectDropdown, {
    value: deptStr,
    onChange: setDeptStr,
    options: deptNames,
    placeholder: "Select department(s)\u2026"
  })), React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      color: 'var(--muted)',
      textTransform: 'uppercase',
      letterSpacing: .4,
      marginBottom: 5
    }
  }, "Role"), React.createElement("div", {
    style: {
      display: 'inline-flex',
      gap: 3,
      padding: 3,
      borderRadius: 9,
      background: 'rgba(125,145,180,.16)'
    }
  }, ['Nurse', 'PCA'].map(r => React.createElement("button", {
    key: r,
    type: "button",
    onClick: () => setRole(r),
    style: {
      border: 0,
      cursor: 'pointer',
      font: 'inherit',
      fontSize: 12,
      fontWeight: 700,
      padding: '7px 18px',
      borderRadius: 7,
      color: role === r ? '#fff' : 'var(--muted)',
      background: role === r ? 'linear-gradient(135deg,#27a8db,#0072a3)' : 'transparent'
    }
  }, r)))), view === 'byDept' && selDepts.length > 0 && React.createElement("div", {
    style: {
      minWidth: 220
    }
  }, React.createElement("div", {
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      color: 'var(--muted)',
      textTransform: 'uppercase',
      letterSpacing: .4,
      marginBottom: 5
    }
  }, "Or copy from another department"), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, React.createElement("select", {
    value: copyFrom,
    onChange: e => setCopyFrom(e.target.value),
    style: {
      flex: 1,
      padding: '8px 11px',
      border: '1px solid var(--line)',
      borderRadius: 7,
      fontSize: 13,
      fontFamily: 'inherit',
      background: '#fff'
    }
  }, React.createElement("option", {
    value: ""
  }, "Choose a department\u2026"), deptNames.filter(d => !selDepts.includes(d)).map(d => React.createElement("option", {
    key: d,
    value: d
  }, d))), React.createElement("button", {
    type: "button",
    className: "btn sm",
    disabled: !copyFrom,
    onClick: doCopy,
    title: "Adds every activity that department has, on top of what's already assigned"
  }, "Copy")))), deptNames.length === 0 && React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)'
    }
  }, "No departments available yet \u2014 add one in Settings \u2192 Departments."), deptNames.length > 0 && view === 'byDept' && React.createElement(PrivilegesEditor, {
    role: role,
    value: assigned,
    onChange: setAssigned,
    deptNames: deptNames,
    deptGroups: deptGroups,
    onDeptsChanged: rerender,
    noTarget: !selDepts.length
  }), deptNames.length > 0 && view === 'byPrivilege' && React.createElement(PrivilegeDeptMatrix, {
    role: role,
    deptNames: deptNames,
    deptGroups: deptGroups
  }), deptNames.length > 0 && view === 'matrix' && React.createElement(PrivilegeMatrix, {
    role: role,
    deptNames: deptNames
  }), deptNames.length > 0 && view === 'bulk' && React.createElement(BulkPrivilegeAssigner, {
    role: role,
    deptNames: deptNames,
    deptGroups: deptGroups
  }))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-b"
  }, React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 700,
      color: 'var(--ink)',
      marginBottom: 2
    }
  }, "Create a new privilege"), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)',
      marginBottom: 12
    }
  }, "Add an activity that isn't in the catalogue. It's added to the ", role, " catalogue", view === 'byDept' && selDepts.length ? ' and assigned to ' + selDepts.join(', ') : '', " immediately \u2014 pick an existing area or type a new one."), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, React.createElement("input", {
    list: "dl_privgroup",
    value: newGroup,
    onChange: e => setNewGroup(e.target.value),
    placeholder: "Privilege area \u2014 e.g. 14. Telehealth",
    style: {
      flex: '1 1 220px',
      padding: '9px 11px',
      border: '1px solid var(--line)',
      borderRadius: 7,
      fontFamily: 'inherit',
      fontSize: 13,
      outline: 'none'
    }
  }), React.createElement("datalist", {
    id: "dl_privgroup"
  }, groupOpts.map(g => React.createElement("option", {
    key: g,
    value: g
  }))), React.createElement("input", {
    value: newItem,
    onChange: e => setNewItem(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addPrivilege();
      }
    },
    placeholder: "Activity name \u2014 e.g. Telehealth triage call",
    style: {
      flex: '1 1 240px',
      padding: '9px 11px',
      border: '1px solid var(--line)',
      borderRadius: 7,
      fontFamily: 'inherit',
      fontSize: 13,
      outline: 'none'
    }
  }), React.createElement("button", {
    className: "btn pri",
    onClick: addPrivilege,
    disabled: !newGroup.trim() || !newItem.trim()
  }, React.createElement(Ic, {
    d: I.plus,
    s: 14
  }), "Add")), customList.length > 0 && React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--muted)',
      marginBottom: 8
    }
  }, "Custom activities added so far (", customList.length, ") \u2014 remove one to delete it from the catalogue entirely:"), React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 7
    }
  }, customList.map(({
    group,
    item
  }) => React.createElement("span", {
    key: group + '||' + item,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '5px 10px',
      borderRadius: 16,
      fontSize: 12,
      fontWeight: 600,
      background: 'var(--blue-50)',
      color: 'var(--blue-700)',
      border: '1px solid var(--blue-100)'
    }
  }, item, React.createElement("span", {
    style: {
      opacity: .7,
      fontWeight: 500
    }
  }, "\xB7 ", group.replace(/^\d+\.\s*/, '')), React.createElement("span", {
    onClick: () => {
      S.removeCustomPrivilege(role, group, item);
      rerender();
    },
    title: "Delete this privilege entirely",
    style: {
      display: 'inline-grid',
      placeItems: 'center',
      cursor: 'pointer',
      opacity: .7
    }
  }, React.createElement(Ic, {
    d: I.x,
    s: 11,
    sw: 2.4
  })))))))));
}
function StaffPhotoLibrary({
  f,
  set,
  store,
  empId,
  editing,
  onClose
}) {
  const [rows, setRows] = React.useState(null);
  const [counts, setCounts] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [filter, setFilter] = React.useState('unattached');
  const [busy, setBusy] = React.useState('');
  const me = String(f.emp_id || '');
  const myId = f.id != null ? String(f.id) : '';
  React.useEffect(() => {
    let live = true;
    fetch('/api/upload/library', {
      credentials: 'same-origin'
    }).then(r => r.json()).then(j => {
      if (!live) return;
      if (!j || !j.ok) {
        setErr(j && j.error || 'Could not load the library.');
        setRows([]);
        return;
      }
      setRows(j.assets || []);
      setCounts(j.counts || null);
    }).catch(() => {
      if (live) {
        setErr('Could not reach the server.');
        setRows([]);
      }
    });
    return () => {
      live = false;
    };
  }, []);
  React.useEffect(() => {
    const k = e => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const isMine = a => a.attachedTo && (me && String(a.attachedTo.empId || '') === me || myId && String(a.attachedTo.staffId) === myId);
  const shown = (rows || []).filter(a => filter === 'all' || !a.attachedTo || isMine(a));
  const pick = async a => {
    if (a.attachedTo && !isMine(a)) {
      const q = 'This photo is attached to ' + (a.attachedTo.name || 'another staff member') + (a.attachedTo.empId ? ' (' + a.attachedTo.empId + ')' : '') + '. Use it for ' + (f.name || 'this record') + ' instead?';
      const ok = window.UI && window.UI.confirm ? await window.UI.confirm({
        title: 'Photo belongs to someone else',
        message: q,
        confirmLabel: 'Use it here',
        cancelLabel: 'Keep'
      }) : window.confirm(q);
      if (!ok) return;
    }
    const photo = {
      url: a.url,
      publicId: a.publicId,
      updatedAt: Date.now()
    };
    setBusy(a.publicId);
    setErr('');
    try {
      if (set) set('photo', photo);
      if (editing && store && store.update && empId != null) {
        try {
          store.update(empId, {
            photo
          });
        } catch (e) {}
      }
      if (editing && (f.id != null || f.emp_id)) {
        const r = await fetch('/api/upload/attach', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'same-origin',
          body: JSON.stringify({
            publicId: a.publicId,
            url: a.url,
            staffId: f.id != null ? f.id : null,
            empId: f.emp_id || null,
            staffName: f.name || ''
          })
        });
        const j = await r.json().catch(() => ({
          ok: false
        }));
        if (!r.ok || !j.ok) {
          setErr(j.error || 'Attached on this device, but the server copy could not be written — press Save changes.');
        }
      }
      onClose();
    } catch (e) {
      setErr('Could not attach the photo.');
    } finally {
      setBusy('');
    }
  };
  const when = iso => {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleString();
  };
  const modal = React.createElement("div", {
    onMouseDown: ev => {
      if (ev.target === ev.currentTarget) onClose();
    },
    style: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(16,32,46,.55)',
      zIndex: 6000,
      display: 'grid',
      placeItems: 'center',
      padding: 16
    }
  }, React.createElement("div", {
    style: {
      background: '#fff',
      width: 'min(920px,100%)',
      maxHeight: '88vh',
      borderRadius: 14,
      boxShadow: '0 24px 60px rgba(5,12,24,.4)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, React.createElement("div", {
    style: {
      padding: '14px 18px',
      borderBottom: '1px solid var(--line-2)',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap'
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 15.5,
      fontWeight: 800,
      color: 'var(--ink)'
    }
  }, "Uploaded staff photos"), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)',
      marginTop: 2
    }
  }, counts ? React.createElement(React.Fragment, null, counts.total, " in the library \xB7 ", React.createElement("b", {
    style: {
      color: counts.unattached ? '#b5670a' : '#157a43'
    }
  }, counts.unattached, " not attached to anyone")) : 'Loading…', f.name ? React.createElement(React.Fragment, null, " \xB7 choosing for ", React.createElement("b", {
    style: {
      color: 'var(--ink-2)'
    }
  }, f.name)) : null)), React.createElement("span", {
    style: {
      flex: 1
    }
  }), React.createElement("div", {
    className: "seg",
    style: {
      display: 'flex',
      gap: 4
    }
  }, [['unattached', 'Not attached'], ['all', 'All photos']].map(([v, l]) => React.createElement("button", {
    key: v,
    type: "button",
    onClick: () => setFilter(v),
    style: {
      border: '1px solid ' + (filter === v ? 'var(--blue)' : 'var(--line)'),
      background: filter === v ? 'var(--blue-50)' : '#fff',
      color: filter === v ? 'var(--blue-700)' : 'var(--ink-2)',
      padding: '5px 11px',
      borderRadius: 7,
      fontSize: 11.5,
      fontWeight: 700,
      cursor: 'pointer'
    }
  }, l))), React.createElement("button", {
    type: "button",
    className: "icon-btn",
    onClick: onClose,
    title: "Close (Esc)"
  }, React.createElement(Ic, {
    d: I.x,
    s: 15
  }))), err ? React.createElement("div", {
    style: {
      margin: '12px 18px 0',
      padding: '9px 12px',
      borderRadius: 8,
      background: '#fdf3f4',
      border: '1px solid #f0c2ca',
      color: '#a32c41',
      fontSize: 12.5,
      fontWeight: 600
    }
  }, err) : null, React.createElement("div", {
    style: {
      padding: 16,
      overflowY: 'auto'
    }
  }, rows === null ? React.createElement("div", {
    style: {
      color: 'var(--muted)',
      fontSize: 12.5,
      padding: '30px 0',
      textAlign: 'center'
    }
  }, "Loading the library\u2026") : shown.length === 0 ? React.createElement("div", {
    style: {
      color: 'var(--faint)',
      fontSize: 12.5,
      padding: '30px 0',
      textAlign: 'center'
    }
  }, filter === 'unattached' ? 'Every uploaded photo is attached to someone.' : 'No photos have been uploaded yet.') : React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))',
      gap: 12
    }
  }, shown.map(a => {
    const mine = isMine(a),
      taken = a.attachedTo && !mine;
    return React.createElement("button", {
      key: a.publicId,
      type: "button",
      onClick: () => pick(a),
      disabled: !!busy,
      title: taken ? 'Attached to ' + a.attachedTo.name : mine ? 'Already this staff member’s photo' : 'Attach to ' + (f.name || 'this record'),
      style: {
        border: '1px solid ' + (mine ? '#1f9d57' : taken ? 'var(--line)' : '#e6c98a'),
        borderRadius: 11,
        padding: 0,
        background: '#fff',
        cursor: 'pointer',
        textAlign: 'left',
        overflow: 'hidden',
        boxShadow: mine ? '0 0 0 2px #1f9d5733' : 'none',
        opacity: busy && busy !== a.publicId ? .6 : 1
      }
    }, React.createElement("img", {
      src: a.thumbUrl || a.url,
      alt: "",
      style: {
        width: '100%',
        aspectRatio: '1',
        objectFit: 'cover',
        display: 'block',
        background: 'var(--panel-2)'
      }
    }), React.createElement("div", {
      style: {
        padding: '7px 9px 9px'
      }
    }, mine ? React.createElement("div", {
      style: {
        fontSize: 10.5,
        fontWeight: 800,
        color: '#157a43'
      }
    }, "\u2713 Current photo") : taken ? React.createElement("div", {
      style: {
        fontSize: 10.5,
        fontWeight: 700,
        color: 'var(--ink-2)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, "\u2192 ", a.attachedTo.name || a.attachedTo.empId) : React.createElement("div", {
      style: {
        fontSize: 10.5,
        fontWeight: 800,
        color: '#b5670a'
      }
    }, "Not attached"), React.createElement("div", {
      style: {
        fontSize: 10,
        color: 'var(--muted)',
        marginTop: 2
      }
    }, when(a.createdAt), a.bytes ? ' · ' + Math.round(a.bytes / 1024) + ' KB' : '')));
  }))), React.createElement("div", {
    style: {
      padding: '10px 18px',
      borderTop: '1px solid var(--line-2)',
      fontSize: 11,
      color: 'var(--muted)'
    }
  }, "Only accounts with ", React.createElement("b", null, "edit"), " access to Staff Management can open this library. Accounts with no staff access are never sent staff photos.")));
  const RD = typeof window !== 'undefined' && window.ReactDOM;
  return RD && RD.createPortal && typeof document !== 'undefined' ? RD.createPortal(modal, document.body) : modal;
}
function StaffFormRail({
  f,
  editing,
  set,
  store,
  empId
}) {
  const [libOpen, setLibOpen] = React.useState(false);
  const MK = window.MK,
    S = window.STAFF;
  const name = (f.name || '').trim();
  const isPca = (f.role || 'Nurse') === 'PCA';
  const initials = MK ? MK.initials(name) : '?';
  const prior = S && S.priorYearsOf ? S.priorYearsOf(f) || 0 : 0;
  const atUnico = S && S.unicoYearsOf ? S.unicoYearsOf(f) || 0 : 0;
  const total = prior + atUnico;
  const mos = y => Math.max(0, Math.round(y * 12));
  const label = y => {
    const m = mos(y);
    if (m < 12) return m + ' mos';
    const yy = Math.floor(m / 12),
      mm = m % 12;
    return yy + ' yr' + (yy > 1 ? 's' : '') + (mm ? ' ' + mm + ' mo' : '');
  };
  const trainings = String(f.special_training || '').split(',').map(x => x.trim()).filter(Boolean);
  const priorPct = total ? prior / total * 100 : 0;
  const depts = String(f.current_department || '').split(',').map(x => x.trim()).filter(Boolean);
  const primary = depts[0] || '';
  const quals = String(f.qualification || '').split(',').map(x => x.trim()).filter(Boolean);
  const privStats = S && S.privilegeStats ? S.privilegeStats(isPca ? 'PCA' : 'Nurse', f.privileges) : {
    granted: 0,
    total: 0
  };
  const checks = [['Name entered', !!name], ['Date of joining set', !!f.doj], ['Department assigned', depts.length > 0], ['Qualification selected', quals.length > 0]];
  const readyPct = Math.round(checks.filter(c => c[1]).length / checks.length * 100);
  const readyDone = readyPct === 100;
  return React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      position: 'sticky',
      top: 12
    }
  }, React.createElement("div", {
    className: "card",
    style: {
      background: 'linear-gradient(160deg,#16243a,#0d1b2e)',
      border: '1px solid rgba(255,255,255,.12)',
      color: '#fff',
      padding: '22px 18px',
      textAlign: 'center'
    }
  }, React.createElement("div", {
    style: {
      display: 'grid',
      placeItems: 'center'
    }
  }, React.createElement(PhotoPicker, {
    value: f.photo || null,
    onChange: next => {
      if (set) set('photo', next);
      if (editing && store && store.update && empId != null) {
        try {
          store.update(empId, {
            photo: next
          });
        } catch (e) {}
      }
    },
    initials: name ? initials : '?',
    name: name || 'New staff member',
    kind: "staff",
    size: 112,
    radius: "50%",
    staffId: f.id != null ? f.id : null,
    empId: f.emp_id || null,
    readOnly: !(window.unicoCan ? window.unicoCan('staff', 'edit') : true),
    style: {
      background: name ? 'linear-gradient(135deg,#3ab5a7,#0090ca)' : 'linear-gradient(135deg,#2b8f83,#0072a3)',
      fontSize: 38,
      fontWeight: 700,
      color: '#fff',
      boxShadow: '0 10px 30px rgba(0,144,202,.35)',
      display: 'grid',
      placeItems: 'center'
    }
  })), (window.unicoCan ? window.unicoCan('staff', 'edit') : true) && React.createElement("button", {
    type: "button",
    onClick: () => setLibOpen(true),
    style: {
      marginTop: 10,
      border: '1px solid rgba(255,255,255,.28)',
      background: 'rgba(255,255,255,.08)',
      color: '#dbe9f7',
      padding: '5px 12px',
      borderRadius: 20,
      fontSize: 11.5,
      fontWeight: 700,
      cursor: 'pointer'
    }
  }, "Choose from uploaded photos"), libOpen && React.createElement(StaffPhotoLibrary, {
    f: f,
    set: set,
    store: store,
    empId: empId,
    editing: editing,
    onClose: () => setLibOpen(false)
  }), React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      marginTop: 12
    }
  }, name || 'New ' + (isPca ? 'PCA' : 'nurse')), React.createElement("div", {
    style: {
      fontSize: 11.6,
      color: '#a8bdd6',
      marginTop: 2
    }
  }, f.designation || (isPca ? 'Patient Care Assistant' : 'Staff Nurse'), " \xB7 ", f.current_department || 'unassigned'), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      justifyContent: 'center',
      flexWrap: 'wrap',
      marginTop: 10
    }
  }, React.createElement("span", {
    style: {
      fontSize: 10.4,
      fontWeight: 600,
      padding: '3px 10px',
      borderRadius: 12,
      background: 'rgba(58,181,167,.22)',
      color: '#8fe3d6'
    }
  }, label(total), " exp"), f.emp_id ? React.createElement("span", {
    className: "num",
    style: {
      fontSize: 10.4,
      fontWeight: 600,
      padding: '3px 10px',
      borderRadius: 12,
      background: 'rgba(0,144,202,.22)',
      color: '#9ad8f4'
    }
  }, f.emp_id) : null, trainings.slice(0, 2).map(t => React.createElement("span", {
    key: t,
    style: {
      fontSize: 10.4,
      fontWeight: 600,
      padding: '3px 10px',
      borderRadius: 12,
      background: 'rgba(255,255,255,.14)',
      color: '#dfe9f5'
    }
  }, t))), React.createElement("div", {
    style: {
      borderTop: '1px solid rgba(255,255,255,.14)',
      marginTop: 14,
      paddingTop: 10,
      fontSize: 10.4,
      color: '#8fa3ba'
    }
  }, f.photo && f.photo.url ? 'Photo saved with this record.' : 'Tap the camera to add a photo — or leave it and the initials are used.')), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Experience total")), React.createElement("div", {
    className: "card-b"
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8
    }
  }, React.createElement("span", {
    className: "num",
    style: {
      fontSize: 30,
      fontWeight: 700,
      color: 'var(--ink)',
      lineHeight: 1
    }
  }, label(total)), React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)'
    }
  }, "total")), React.createElement("div", {
    style: {
      marginTop: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 7
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 11.6
    }
  }, React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: '#6a52d4'
    }
  }), React.createElement("span", {
    style: {
      flex: 1
    }
  }, "Before UNICO"), React.createElement("span", {
    className: "num",
    style: {
      fontWeight: 700
    }
  }, label(prior))), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 11.6
    }
  }, React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: '#0090ca'
    }
  }), React.createElement("span", {
    style: {
      flex: 1
    }
  }, "At UNICO"), React.createElement("span", {
    className: "num",
    style: {
      fontWeight: 700
    }
  }, label(atUnico)))), React.createElement("div", {
    style: {
      display: 'flex',
      height: 7,
      borderRadius: 5,
      overflow: 'hidden',
      marginTop: 10,
      background: 'rgba(125,145,180,.2)'
    }
  }, React.createElement("div", {
    style: {
      width: priorPct + '%',
      background: '#6a52d4'
    }
  }), React.createElement("div", {
    style: {
      width: 100 - priorPct + '%',
      background: '#0090ca'
    }
  })), React.createElement("div", {
    style: {
      fontSize: 10.6,
      color: 'var(--muted)',
      marginTop: 9,
      lineHeight: 1.5
    }
  }, "Calculated as previous experience plus UNICO tenure from the date of joining \u2014 the same rule as the staff register."))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Deployment profile"), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    style: {
      fontSize: 10.4,
      fontWeight: 600,
      padding: '2px 9px',
      borderRadius: 12,
      color: depts.length > 1 ? '#157a43' : '#b5670a',
      background: depts.length > 1 ? 'rgba(31,157,87,.13)' : 'rgba(224,138,30,.15)'
    }
  }, depts.length > 1 ? 'Flexible' : primary ? 'Single unit' : 'Unassigned')), React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      fontSize: 11.8
    }
  }, [['Primary posting', primary || '—', '#0090ca'], ['Can also cover', depts.length - 1 === 1 ? '1 unit' : Math.max(0, depts.length - 1) + ' units', '#6a52d4'], ['Independent in', '—', '#1f9d57'], ['Privileges granted', privStats.total ? privStats.granted + ' / ' + privStats.total : '—', '#3ab5a7'], ['Shifts available', '—', '#e08a1e'], ['Designation', f.designation || '—', '#6a52d4'], ['Qualifications', quals.length, '#1f9d57'], ['Trainings on file', trainings.length, '#3ab5a7'], ['Hep-B status', f.hepatitis_b_vaccination || 'Unknown', '#e08a1e']].map(([k, v, c]) => React.createElement("div", {
    key: k,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: c
    }
  }), React.createElement("span", {
    style: {
      flex: 1,
      color: 'var(--body,#3c4858)'
    }
  }, k), React.createElement("span", {
    className: "num",
    style: {
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, v))), React.createElement("div", {
    style: {
      fontSize: 10.6,
      color: 'var(--muted)',
      lineHeight: 1.55,
      background: 'rgba(255,255,255,.55)',
      borderRadius: 9,
      padding: '9px 11px',
      marginTop: 2
    }
  }, "Independent in and Shifts available stay blank \u2014 the staff record has no competency or shift-availability field to read them from. Privileges granted comes from the checklist below."))), React.createElement("div", {
    className: "card",
    style: {
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 11
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, "Ready to save"), React.createElement("span", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    className: "num",
    style: {
      fontSize: 11,
      fontWeight: 700,
      padding: '2px 9px',
      borderRadius: 10,
      color: readyDone ? '#157a43' : '#b5670a',
      background: readyDone ? 'rgba(31,157,87,.13)' : 'rgba(224,138,30,.14)'
    }
  }, readyPct, "%")), React.createElement("div", {
    style: {
      height: 7,
      borderRadius: 4,
      background: 'rgba(125,145,180,.16)',
      overflow: 'hidden'
    }
  }, React.createElement("div", {
    style: {
      width: readyPct + '%',
      height: '100%',
      borderRadius: 4,
      background: readyDone ? 'linear-gradient(90deg,#3ab5a7,#1f9d57)' : 'linear-gradient(90deg,#27a8db,#0072a3)',
      animation: 'growW .6s cubic-bezier(.2,.7,.3,1)',
      transition: 'width .4s ease'
    }
  })), checks.map(([label, ok]) => React.createElement("div", {
    key: label,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 11.5,
      color: 'var(--muted)'
    }
  }, React.createElement("span", {
    style: {
      display: 'inline-grid',
      placeItems: 'center',
      width: 16,
      height: 16,
      borderRadius: '50%',
      flexShrink: 0,
      color: '#fff',
      background: ok ? 'linear-gradient(135deg,#2fbf7f,#157a43)' : 'rgba(125,145,180,.28)',
      boxShadow: ok ? '0 2px 8px rgba(31,157,87,.35)' : 'none',
      transition: 'all .25s'
    }
  }, React.createElement(Ic, {
    d: I.check,
    s: 9,
    sw: 3.4
  })), React.createElement("span", null, label)))));
}
function bnmcQualification(course) {
  const c = String(course || '');
  const has = (...w) => w.every(x => c.toLowerCase().includes(x));
  if (has('b. sc', 'post basic') || has('b.sc', 'post basic')) return 'Post Basic B.Sc in Nursing';
  if (has('public health nursing')) return 'B.Sc in Public Health Nursing';
  if (has('b. sc', 'nursing') || has('b.sc', 'nursing')) return 'B.Sc in Nursing';
  if (has('master of science')) return 'M.Sc in Nursing';
  if (has('bachelor of science', 'midwifery')) return 'B.Sc in Nursing';
  if (has('midwifery') && !has('nursing science')) return 'Diploma in Midwifery';
  if (has('renal')) return 'Diploma in Renal Nursing';
  if (has('cardiac')) return 'Diploma in Cardiac Nursing';
  if (has('critical care') || has('intensive care')) return 'Diploma in Critical Care Nursing';
  if (has('orthopeadic') || has('orthopaedic')) return 'Diploma in Orthopaedic Nursing';
  if (has('psychiatric') || has('mental health')) return 'Diploma in Psychiatric / Mental Health Nursing';
  if (has('community health')) return 'Community Health Nursing';
  if (has('diploma', 'nursing')) return 'Diploma in Nursing';
  return c;
}
async function bnmcApi(url) {
  let r;
  try {
    r = await fetch(url, {
      headers: {
        Accept: 'application/json'
      }
    });
  } catch (e) {
    throw new Error('Could not reach the server. Check that it is running, then try again.');
  }
  const body = await r.text();
  const looksHtml = /^\s*(<!doctype|<html)/i.test(body);
  if (r.status === 403) {
    let m = '';
    try {
      m = (JSON.parse(body) || {}).error || '';
    } catch (e) {}
    throw new Error(m || 'You do not have permission to do this. Ask an administrator for staff edit access.');
  }
  if (r.status === 401 || looksHtml && /login|sign in/i.test(body)) {
    throw new Error('Your session has expired. Reload the page, sign in again, then verify.');
  }
  if (r.status === 404 || looksHtml) {
    throw new Error('This server does not have the BNMC verification routes yet — restart the app server (npm run web) and reload this page.');
  }
  let j;
  try {
    j = JSON.parse(body);
  } catch (e) {
    throw new Error('The server sent an unexpected response (HTTP ' + r.status + ').');
  }
  if (!j || j.ok === false) throw new Error(j && j.error || 'Verification failed.');
  return j;
}
function BnmcRecord({
  m,
  compact,
  onPick,
  picked
}) {
  const per = m.person || {},
    regs = m.registrations || [],
    p = m.primary || {};
  const lbl = {
    fontSize: 10,
    color: 'var(--muted)',
    textTransform: 'uppercase',
    letterSpacing: .4,
    fontWeight: 700
  };
  return React.createElement("div", {
    style: {
      border: '1px solid ' + (picked ? '#cde9d8' : 'var(--line)'),
      borderRadius: 10,
      overflow: 'hidden',
      background: '#fff'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      gap: 13,
      padding: 12,
      flexWrap: 'wrap',
      alignItems: 'flex-start'
    }
  }, per.photo ? React.createElement("img", {
    src: '/api/bnmc/photo?u=' + encodeURIComponent(per.photo),
    alt: "",
    style: {
      width: compact ? 66 : 92,
      height: compact ? 80 : 110,
      objectFit: 'cover',
      borderRadius: 8,
      border: '1px solid var(--line)',
      background: 'var(--bg-2)'
    },
    onError: e => {
      e.target.style.display = 'none';
    }
  }) : null, React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 220,
      display: 'grid',
      gap: 4
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, React.createElement("span", {
    style: {
      fontSize: compact ? 14 : 16,
      fontWeight: 800,
      color: 'var(--ink)'
    }
  }, per.name || '—'), p.status ? React.createElement("span", {
    style: {
      fontSize: 10.5,
      fontWeight: 800,
      padding: '1px 8px',
      borderRadius: 6,
      color: p.expired ? '#a32c41' : '#157a43',
      background: p.expired ? '#fdf3f4' : '#eef8f1',
      border: '1px solid ' + (p.expired ? '#f0c2ca' : '#cde9d8')
    }
  }, p.status) : null, m.fromEducation ? React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: '#0072a3',
      background: '#eef8fc',
      border: '1px solid #dceffa',
      borderRadius: 6,
      padding: '1px 8px'
    }
  }, "matches recorded education") : null), React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--ink-2)',
      fontWeight: 600
    }
  }, m.programName), [["Father's name", per.father], ["Mother's name", per.mother], ['Address', per.address], ['Working place', per.workplace], ['Position', per.position]].filter(x => x[1]).map(([k, val]) => React.createElement("div", {
    key: k,
    style: {
      display: 'flex',
      gap: 7,
      fontSize: 12
    }
  }, React.createElement("span", {
    style: {
      ...lbl,
      minWidth: 104,
      flexShrink: 0
    }
  }, k), React.createElement("span", {
    style: {
      color: 'var(--ink)',
      fontWeight: 600
    }
  }, val)))), onPick ? React.createElement("button", {
    type: "button",
    className: "btn pri sm",
    onClick: onPick,
    style: {
      alignSelf: 'center',
      whiteSpace: 'nowrap'
    }
  }, React.createElement(Ic, {
    d: I.check,
    s: 14
  }), "This is the staff member") : null), React.createElement("div", {
    style: {
      overflowX: 'auto',
      borderTop: '1px solid var(--line-2)'
    }
  }, React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 11.5,
      minWidth: 760
    }
  }, React.createElement("thead", null, React.createElement("tr", null, ['Registration No', 'Course Name', 'Institution / College', 'Licensing Exam Passing Date', 'Date of Registration', 'Date of Renew/Issue', 'Renew Upto', 'Status'].map(h => React.createElement("th", {
    key: h,
    style: {
      textAlign: 'left',
      padding: '8px 10px',
      background: 'var(--bg-2)',
      color: 'var(--muted)',
      textTransform: 'uppercase',
      letterSpacing: .3,
      fontSize: 9.5,
      fontWeight: 800,
      whiteSpace: 'nowrap',
      borderBottom: '1px solid var(--line-2)'
    }
  }, h)))), React.createElement("tbody", null, regs.map((r, i) => {
    const isThis = r.regNo === p.regNo && r.course === p.course;
    return React.createElement("tr", {
      key: i,
      style: {
        borderBottom: '1px solid var(--line-2)',
        background: isThis ? '#f6fbf8' : 'transparent'
      }
    }, React.createElement("td", {
      className: "num",
      style: {
        padding: '8px 10px',
        fontWeight: isThis ? 800 : 600
      }
    }, r.regNo), React.createElement("td", {
      style: {
        padding: '8px 10px',
        fontWeight: isThis ? 700 : 400
      }
    }, r.course), React.createElement("td", {
      style: {
        padding: '8px 10px'
      }
    }, r.institution), React.createElement("td", {
      style: {
        padding: '8px 10px',
        whiteSpace: 'nowrap'
      }
    }, r.exam || '—'), React.createElement("td", {
      className: "num",
      style: {
        padding: '8px 10px',
        whiteSpace: 'nowrap'
      }
    }, r.registered || '—'), React.createElement("td", {
      className: "num",
      style: {
        padding: '8px 10px',
        whiteSpace: 'nowrap'
      }
    }, r.renewIssued || '—'), React.createElement("td", {
      className: "num",
      style: {
        padding: '8px 10px',
        whiteSpace: 'nowrap'
      }
    }, r.renewUpto || '—'), React.createElement("td", {
      style: {
        padding: '8px 10px',
        fontWeight: 800,
        whiteSpace: 'nowrap',
        color: r.expired ? '#d23a52' : '#157a43'
      }
    }, r.status || '—'));
  })))));
}
function BnmcVerify({
  f,
  set,
  store,
  empId,
  editing
}) {
  const [busy, setBusy] = React.useState('');
  const [prog, setProg] = React.useState(null);
  const [cands, setCands] = React.useState(null);
  const [note, setNote] = React.useState('');
  const [err, setErr] = React.useState('');
  const [manual, setManual] = React.useState(false);
  const [savedNow, setSavedNow] = React.useState(false);
  const [storedSrv, setStoredSrv] = React.useState(false);
  const [storeWarn, setStoreWarn] = React.useState('');
  const [programs, setPrograms] = React.useState([]);
  const [mProg, setMProg] = React.useState(f.licence_program || '');
  const v = f.licence_verified || null;
  const digits = String(f.licence_no || '').replace(/\D/g, '');
  const edu = String(f.qualification || '').trim();
  React.useEffect(() => {
    if (!manual || programs.length) return;
    let live = true;
    bnmcApi('/api/bnmc/programs').then(j => {
      if (live) setPrograms(j.programs || []);
    }).catch(e => {
      if (live) setErr(e.message);
    });
    return () => {
      live = false;
    };
  }, [manual]);
  const sweep = async scope => {
    let from = 0,
      out = [],
      tried = 0,
      total = 0;
    for (;;) {
      const q = 'number=' + encodeURIComponent(digits) + '&scope=' + scope + '&from=' + from + '&hint=' + encodeURIComponent(edu);
      const j = await bnmcApi('/api/bnmc/detect?' + q);
      out = out.concat(j.matches || []);
      tried += j.tried || 0;
      total = j.total || 0;
      setProg({
        tried,
        total
      });
      if (j.next == null) break;
      from = j.next;
    }
    return {
      matches: out,
      total
    };
  };
  const apply = m => {
    const p = m.primary || {},
      per = m.person || {};
    const snap = {
      at: m.fetchedAt || new Date().toISOString(),
      number: digits,
      program: m.program,
      programName: m.programName,
      person: per,
      registrations: m.registrations || [],
      primary: p
    };
    set('licence_program', m.program);
    set('licence_verified', snap);
    if (editing && store && store.update) {
      try {
        store.update(empId, {
          licence_no: f.licence_no || digits,
          licence_program: m.program,
          licence_verified: snap
        });
        setSavedNow(true);
      } catch (e) {}
    }
    const rec = store && store.get && editing ? store.get(empId) : null;
    fetch('/api/bnmc/record', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        staffId: editing ? empId : null,
        empId: rec && rec.emp_id || f.emp_id || null,
        licence_no: f.licence_no || digits,
        licence_program: m.program,
        licence_expiry: f.licence_expiry || p.renewUpto || '',
        verification: snap
      })
    }).then(r => r.json()).then(j => {
      if (j && j.ok) setStoredSrv(true);else if (j && j.error) setStoreWarn(j.error);
    }).catch(() => setStoreWarn('Saved on this device, but the server copy could not be written — press Save changes.'));
    if (!String(f.name || '').trim() && per.name) set('name', per.name);
    if (!String(f.qualification || '').trim() && p.course) set('qualification', bnmcQualification(p.course));
    if (!String(f.licence_expiry || '').trim() && p.renewUpto) set('licence_expiry', p.renewUpto);
    setCands(null);
  };
  const settle = (matches, scope, total) => {
    if (!matches.length) {
      setNote(scope === 'edu' ? '' : 'BNMC has no registration ' + digits + ' in any of its ' + total + ' courses. Check the number.');
      return false;
    }
    if (matches.length === 1) {
      apply(matches[0]);
      setNote(scope === 'edu' ? 'Matched on the course implied by this staff member’s education. Other courses were not searched.' : 'One match across all ' + total + ' courses.');
    } else {
      setCands({
        matches,
        scope,
        total
      });
      setNote(matches.length + ' different people hold registration ' + digits + '. Pick the right one — BNMC numbers repeat across courses.');
    }
    return true;
  };
  const verify = async () => {
    setErr('');
    setNote('');
    setCands(null);
    setProg(null);
    try {
      if (edu) {
        setBusy('edu');
        const a = await sweep('edu');
        if (settle(a.matches, 'edu', a.total)) return;
      }
      setBusy('all');
      const b = await sweep('all');
      settle(b.matches, 'all', b.total);
    } catch (e) {
      setErr(e.message || 'Could not reach the verification service.');
    } finally {
      setBusy('');
      setProg(null);
    }
  };
  const searchAll = async () => {
    setErr('');
    setNote('');
    setCands(null);
    setProg(null);
    setBusy('all');
    try {
      const b = await sweep('all');
      if (!settle(b.matches, 'all', b.total)) setNote('No registration ' + digits + ' in any course.');
    } catch (e) {
      setErr(e.message || 'Could not reach the verification service.');
    } finally {
      setBusy('');
      setProg(null);
    }
  };
  const manualLookup = async () => {
    setErr('');
    setNote('');
    setCands(null);
    setBusy('all');
    try {
      const j = await bnmcApi('/api/bnmc/verify?number=' + encodeURIComponent(digits) + '&program=' + encodeURIComponent(mProg) + '&fresh=1');
      if (!j.found) {
        setNote('No registration ' + digits + ' under that course.');
        return;
      }
      apply({
        program: mProg,
        programName: (programs.find(p => p.id === mProg) || {}).name || '',
        person: j.person,
        registrations: j.registrations,
        primary: j.primary,
        fetchedAt: j.fetchedAt
      });
    } catch (e) {
      setErr(e.message || 'Lookup failed.');
    } finally {
      setBusy('');
    }
  };
  const box = {
    border: '1px solid var(--line)',
    borderRadius: 10,
    padding: 12,
    background: '#fff'
  };
  const diffs = (() => {
    if (!v) return [];
    const p = v.primary || {},
      per = v.person || {};
    const out = [];
    const add = (label, mine, theirs, take) => {
      if (theirs && String(mine || '').trim() && String(mine).trim().toLowerCase() !== String(theirs).trim().toLowerCase()) out.push({
        label,
        theirs,
        take
      });
    };
    add('Name', f.name, per.name, () => set('name', per.name));
    add('Qualification', f.qualification, p.course ? bnmcQualification(p.course) : '', () => set('qualification', bnmcQualification(p.course)));
    add('Licence expiry', f.licence_expiry, p.renewUpto, () => set('licence_expiry', p.renewUpto));
    return out;
  })();
  return React.createElement("div", {
    style: {
      gridColumn: '1 / -1',
      display: 'flex',
      flexDirection: 'column',
      gap: 11
    }
  }, React.createElement("div", {
    style: {
      ...box,
      display: 'flex',
      gap: 12,
      alignItems: 'center',
      flexWrap: 'wrap',
      background: 'var(--panel-2)'
    }
  }, React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 240
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, "Live BNMC verification"), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)',
      marginTop: 3
    }
  }, !digits ? 'Enter the registration number above, then verify.' : edu ? React.createElement(React.Fragment, null, "Course taken from Education: ", React.createElement("b", {
    style: {
      color: 'var(--ink-2)'
    }
  }, edu)) : 'No Education recorded — every course will be searched.')), v ? React.createElement("button", {
    type: "button",
    className: "btn sm",
    onClick: searchAll,
    disabled: !!busy || !digits,
    title: "Search every course, in case this is a different person with the same number"
  }, "Search all courses") : null, React.createElement("button", {
    type: "button",
    className: "btn pri",
    onClick: verify,
    disabled: !digits || !!busy,
    style: {
      height: 38,
      whiteSpace: 'nowrap'
    }
  }, React.createElement(Ic, {
    d: I.search,
    s: 14
  }), busy ? prog ? 'Searching ' + prog.tried + '/' + prog.total + '…' : 'Verifying…' : 'Verify with BNMC')), busy && prog ? React.createElement("div", {
    style: {
      height: 4,
      borderRadius: 3,
      background: 'var(--line-2)',
      overflow: 'hidden'
    }
  }, React.createElement("div", {
    style: {
      height: '100%',
      width: Math.round(prog.tried / Math.max(1, prog.total) * 100) + '%',
      background: 'var(--blue)',
      transition: 'width .2s'
    }
  })) : null, err ? React.createElement("div", {
    style: {
      ...box,
      borderColor: '#f0c2ca',
      background: '#fdf3f4',
      color: '#a32c41',
      fontSize: 12.5,
      fontWeight: 600
    }
  }, err) : null, note && !cands ? React.createElement("div", {
    style: {
      ...box,
      borderColor: '#dbe4ee',
      background: 'var(--panel-2)',
      color: 'var(--ink-2)',
      fontSize: 12,
      fontWeight: 600
    }
  }, note) : null, cands ? React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 9
    }
  }, React.createElement("div", {
    style: {
      ...box,
      borderColor: '#f2ddb4',
      background: '#fdf8ec',
      color: '#8a5d09',
      fontSize: 12.5,
      fontWeight: 700
    }
  }, note), cands.matches.map((m, i) => React.createElement(BnmcRecord, {
    key: i,
    m: m,
    compact: true,
    onPick: () => apply(m)
  }))) : null, v && !cands ? React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 9
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      padding: '9px 13px',
      borderRadius: 9,
      background: (v.primary || {}).expired ? '#fdf3f4' : '#eef8f1',
      border: '1px solid ' + ((v.primary || {}).expired ? '#f0c2ca' : '#cde9d8')
    }
  }, React.createElement(Ic, {
    d: I.check,
    s: 15,
    c: (v.primary || {}).expired ? '#a32c41' : '#157a43'
  }), React.createElement("span", {
    style: {
      fontSize: 12.5,
      fontWeight: 800,
      color: (v.primary || {}).expired ? '#a32c41' : '#157a43'
    }
  }, "Verified against the BNMC register", (v.primary || {}).expired ? ' — licence EXPIRED' : ''), React.createElement("span", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--muted)'
    }
  }, "checked ", String(v.at || '').slice(0, 10))), React.createElement("div", {
    style: {
      fontSize: 11.5,
      fontWeight: 600,
      padding: '7px 11px',
      borderRadius: 8,
      color: editing ? '#157a43' : '#8a5d09',
      background: editing ? '#f2fbf5' : '#fdf8ec',
      border: '1px solid ' + (editing ? '#cde9d8' : '#f2ddb4')
    }
  }, storeWarn ? storeWarn : storedSrv ? 'Stored on the server against this staff record — it is kept permanently and survives a cleared browser, another device or a redeploy.' : editing ? savedNow ? 'Saved to this staff record — it stays even if you press Cancel.' : 'Recorded on this staff record.' : 'This verification will be stored when you press Create staff.'), React.createElement(BnmcRecord, {
    m: v,
    picked: true
  }), diffs.length ? React.createElement("div", {
    style: {
      ...box,
      borderColor: '#f2ddb4',
      background: '#fdf8ec',
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      alignItems: 'center'
    }
  }, React.createElement("span", {
    style: {
      fontSize: 11.5,
      fontWeight: 700,
      color: '#8a5d09'
    }
  }, "Differs from what is typed:"), diffs.map(d => React.createElement("button", {
    key: d.label,
    type: "button",
    onClick: d.take,
    title: "Replace with the BNMC value",
    style: {
      border: '1px solid #e6c98a',
      background: '#fff',
      borderRadius: 20,
      padding: '4px 11px',
      fontSize: 11.5,
      cursor: 'pointer',
      color: 'var(--ink)'
    }
  }, React.createElement("strong", null, d.label), " \u2014 use \u201C", d.theirs, "\u201D"))) : null) : null, React.createElement("div", null, React.createElement("button", {
    type: "button",
    onClick: () => setManual(m => !m),
    style: {
      border: 0,
      background: 'none',
      color: 'var(--blue)',
      fontSize: 11.5,
      fontWeight: 600,
      cursor: 'pointer',
      padding: 0
    }
  }, manual ? 'Hide manual course search' : 'Search a specific course instead'), manual ? React.createElement("div", {
    style: {
      display: 'flex',
      gap: 9,
      marginTop: 8,
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, React.createElement("select", {
    value: mProg,
    onChange: e => setMProg(e.target.value),
    style: {
      flex: 1,
      minWidth: 260,
      padding: '8px 11px',
      border: '1px solid var(--line)',
      borderRadius: 7,
      fontSize: 12.5,
      fontFamily: 'inherit',
      background: '#fff'
    }
  }, React.createElement("option", {
    value: ""
  }, programs.length ? 'Select registration type…' : 'Course list unavailable — see the message above'), programs.map(p => React.createElement("option", {
    key: p.id,
    value: p.id
  }, p.name))), React.createElement("button", {
    type: "button",
    className: "btn sm",
    onClick: manualLookup,
    disabled: !digits || !mProg || !!busy
  }, "Look up")) : null));
}
function StaffForm({
  store,
  empId,
  setRoute,
  role,
  depts
}) {
  const editing = !!empId;
  const existing = editing ? store.get(empId) : null;
  const [f, setF] = React.useState(() => existing ? {
    ...existing,
    prior_experience_entries: initPriorEntries(existing)
  } : {
    role: role || 'Nurse',
    emp_id: '',
    name: '',
    phone: '',
    qualification: '',
    designation: '',
    current_department: '',
    doj: '',
    prior_experience_entries: [],
    previous_experience: '',
    special_training: '',
    extracurricular: '',
    hepatitis_b_vaccination: '',
    remarks: '',
    privileges: {}
  });
  const [err, setErr] = React.useState('');
  const [saved, setSaved] = React.useState(null);
  const [customQ, setCustomQ] = React.useState('');
  const [customT, setCustomT] = React.useState('');
  const [customD, setCustomD] = React.useState('');
  const [customX, setCustomX] = React.useState('');
  const initialForm = React.useRef(f);
  const pendingId = React.useRef(empId || null);
  const saveLock = React.useRef(false);
  const [saving, setSaving] = React.useState(false);
  const [printForm, setPrintForm] = React.useState(false);
  const [customL, setCustomL] = React.useState('');
  const priorInit0 = existing && existing.prior_experience_years != null && existing.prior_experience_years !== '' && !isNaN(existing.prior_experience_years) ? +existing.prior_experience_years : 0;
  const [dpY, setDpY] = React.useState(() => {
    const y = Math.floor(priorInit0);
    return y ? String(y) : '';
  });
  const [dpM, setDpM] = React.useState(() => {
    const mo = Math.round((priorInit0 - Math.floor(priorInit0)) * 12);
    return mo ? String(mo) : '';
  });
  const set = (k, v) => setF(s => ({
    ...s,
    [k]: v
  }));
  const S = window.STAFF;
  const customFieldDefs = S.customFields && S.customFields() || [];
  const setCustom = (id, v) => setF(s => ({
    ...s,
    custom: {
      ...(s.custom || {}),
      [id]: v
    }
  }));
  const inp = (k, ph, type = 'text') => React.createElement("input", {
    value: f[k] || '',
    onChange: e => set(k, e.target.value),
    placeholder: ph,
    type: type,
    style: {
      padding: '9px 11px',
      border: '1px solid var(--line)',
      borderRadius: 7,
      fontSize: 13,
      fontFamily: k === 'phone' || k === 'doj' || k === 'emp_id' ? 'IBM Plex Mono' : 'inherit',
      outline: 'none',
      width: '100%'
    }
  });
  const cmb = (k, opts) => React.createElement("select", {
    value: f[k] || '',
    onChange: e => set(k, e.target.value),
    style: {
      padding: '9px 11px',
      border: '1px solid var(--line)',
      borderRadius: 7,
      fontSize: 13,
      fontFamily: 'inherit',
      background: '#fff',
      width: '100%'
    }
  }, React.createElement("option", {
    value: ""
  }, "\u2014"), opts.map(o => React.createElement("option", {
    key: o
  }, o)));
  const cmbFree = (k, opts, ph, labelFn) => React.createElement("div", null, React.createElement("input", {
    list: 'dl_' + k,
    value: f[k] || '',
    onChange: e => set(k, e.target.value),
    placeholder: ph || 'Select or type…',
    style: {
      padding: '9px 11px',
      border: '1px solid var(--line)',
      borderRadius: 7,
      fontSize: 13,
      fontFamily: 'inherit',
      background: '#fff',
      width: '100%',
      outline: 'none'
    }
  }), React.createElement("datalist", {
    id: 'dl_' + k
  }, opts.map(o => React.createElement("option", {
    key: o,
    value: o
  }, labelFn ? labelFn(o) : o))));
  const allStaff = store && store.staff || [];
  const uniq = arr => [...new Set(arr.filter(Boolean).map(x => String(x).trim()).filter(Boolean))];
  const canon = window.staffCanonDept || (x => x);
  const deptLabel = window.staffDeptLabel || (x => x);
  const baseDepts = S.DEPARTMENTS || [];
  const statsDeptNames = (() => {
    if (Array.isArray(depts) && depts.length) return depts.map(d => d && d.name).filter(Boolean);
    try {
      if (window.buildDepts) {
        const ov = JSON.parse(localStorage.getItem('unico_store_v3')) || {};
        const m = window.buildDepts(ov);
        if (Array.isArray(m) && m.length) return m.map(d => d.name).filter(Boolean);
      }
    } catch (e) {}
    return null;
  })();
  const deptOpts = statsDeptNames && statsDeptNames.length ? [...new Set(statsDeptNames)].sort((a, b) => a.localeCompare(b)) : [...new Set([...baseDepts, ...uniq(allStaff.map(x => canon(x && x.current_department)))])].filter(d => d && d !== 'Unassigned').sort((a, b) => deptLabel(a).localeCompare(deptLabel(b)));
  const canonDesig = window.staffCanonDesig || (x => x);
  const baseDesig = S.designationsFor ? S.designationsFor(f.role) : [];
  const desigOpts = [...new Set([...baseDesig, ...uniq(allStaff.map(x => canonDesig(x && x.designation)))])].filter(Boolean).sort((a, b) => a.localeCompare(b));
  const chipsOf = k => String(f[k] || '').split(',').map(x => x.trim()).filter(Boolean);
  const ageOf = d => {
    const t = Date.parse(d);
    if (isNaN(t)) return null;
    const a = Math.floor((Date.now() - t) / (365.25 * 24 * 3600 * 1000));
    return a >= 0 && a < 130 ? a : null;
  };
  const licenceState = (() => {
    const t = Date.parse(f.licence_expiry);
    if (isNaN(t)) return null;
    const days = Math.round((t - Date.now()) / 86400000);
    if (days < 0) return {
      t: 'Expired ' + -days + 'd ago',
      c: '#d23a52'
    };
    if (days <= 60) return {
      t: 'Expires in ' + days + 'd',
      c: '#b5670a'
    };
    return {
      t: 'Valid',
      c: '#157a43'
    };
  })();
  const multiChk = (k, opts, customText, setCustomText, ph) => {
    const sel = chipsOf(k);
    const extras = sel.filter(x => !opts.includes(x));
    const all = [...opts, ...extras];
    const setSel = arr => set(k, arr.join(', '));
    const toggle = o => setSel(sel.includes(o) ? sel.filter(x => x !== o) : [...sel, o]);
    const addCustom = () => {
      const v = (customText || '').trim();
      if (v && !sel.includes(v)) setSel([...sel, v]);
      setCustomText('');
    };
    return React.createElement("div", null, React.createElement("div", {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 7
      }
    }, all.map(o => {
      const on = sel.includes(o);
      return React.createElement("span", {
        key: o,
        onClick: () => toggle(o),
        style: {
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 11px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 600,
          border: '1px solid ' + (on ? 'var(--blue)' : 'var(--line)'),
          background: on ? 'var(--blue-50)' : '#fff',
          color: on ? 'var(--blue-700)' : 'var(--ink-2)'
        }
      }, React.createElement("span", {
        style: {
          width: 14,
          height: 14,
          borderRadius: 4,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          border: '1px solid ' + (on ? 'var(--blue)' : 'var(--line)'),
          background: on ? 'var(--blue)' : '#fff'
        }
      }, on && React.createElement(Ic, {
        d: I.check,
        s: 10,
        c: "#fff"
      })), o);
    })), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 7,
        marginTop: 9
      }
    }, React.createElement("input", {
      value: customText || '',
      onChange: e => setCustomText(e.target.value),
      onKeyDown: e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addCustom();
        }
      },
      placeholder: ph || 'Add another…',
      style: {
        flex: 1,
        padding: '8px 11px',
        border: '1px solid var(--line)',
        borderRadius: 7,
        fontSize: 12.5,
        fontFamily: 'inherit',
        outline: 'none'
      }
    }), React.createElement("button", {
      type: "button",
      className: "btn sm",
      onClick: addCustom,
      disabled: !(customText || '').trim()
    }, React.createElement(Ic, {
      d: I.plus,
      s: 13
    }), "Add")));
  };
  const field = (label, node, extra) => React.createElement("div", {
    className: "field"
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center'
    }
  }, React.createElement("label", null, label), React.createElement("span", {
    className: "spacer",
    style: {
      flex: 1
    }
  }), extra), node);
  const linkBtn = (t, fn) => React.createElement("button", {
    onClick: fn,
    style: {
      border: 0,
      background: 'none',
      color: 'var(--blue)',
      fontSize: 11,
      fontWeight: 600,
      cursor: 'pointer'
    }
  }, t);
  const entries = f.prior_experience_entries || [];
  const entYears = x => (parseFloat(x && x.years) || 0) + (parseFloat(x && x.months) || 0) / 12;
  const setEntry = (i, k, v) => set('prior_experience_entries', entries.map((x, j) => j === i ? {
    ...x,
    [k]: v
  } : x));
  const addEntry = () => set('prior_experience_entries', [...entries, {
    org: '',
    dept: '',
    years: '',
    months: ''
  }]);
  const delEntry = i => set('prior_experience_entries', entries.filter((_, j) => j !== i));
  const rowsPriorSum = entries.reduce((s, x) => s + entYears(x), 0);
  const hasRows = entries.some(x => entYears(x) > 0);
  const directPrior = (parseFloat(dpY) || 0) + (parseFloat(dpM) || 0) / 12;
  const priorSum = hasRows ? rowsPriorSum : directPrior;
  const unicoY = S.unicoYearsOf(f);
  const totalY = Math.round((priorSum + unicoY) * 10) / 10;
  const rowInp = {
    padding: '8px 10px',
    border: '1px solid var(--line)',
    borderRadius: 7,
    fontSize: 12.5,
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%'
  };
  const save = async () => {
    if (saveLock.current) return;
    const fail = m => {
      setErr(m);
      try {
        window.UI && window.UI.toast && window.UI.toast(m, 'error');
      } catch (e) {}
    };
    if (!f.name || !f.name.trim()) {
      fail('Name is required');
      return;
    }
    if (f.doj && isNaN(new Date(f.doj))) {
      fail('Date of Joining must be YYYY-MM-DD');
      return;
    }
    const cleanEntries = entries.filter(x => entYears(x) > 0 || x.org && x.org.trim() || x.dept && x.dept.trim());
    const rowsHave = cleanEntries.some(x => entYears(x) > 0);
    const pSum = rowsHave ? cleanEntries.reduce((s, x) => s + entYears(x), 0) : directPrior;
    const total = Math.round((pSum + S.unicoYearsOf(f)) * 10) / 10;
    const data = {
      ...f,
      role: f.role || 'Nurse',
      prior_experience_entries: cleanEntries,
      prior_experience_years: Math.round(pSum * 100) / 100,
      total_experience_years: total,
      total_experience_text: S.fmtYM(total),
      previous_experience: rowsHave ? cleanEntries.map(x => `${[x.org || 'Prior role', (x.dept || '').trim()].filter(Boolean).join(' — ')} (${S.fmtYM(entYears(x))})`).join('; ') : f.previous_experience || ''
    };
    saveLock.current = true;
    setSaving(true);
    try {
      if (pendingId.current != null) {
        const patch = Object.fromEntries(Object.entries(data).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(initialForm.current[key])));
        store.update(pendingId.current, patch);
      } else pendingId.current = store.create(data);
      if (!window.unicoFlushNow) throw new Error('Database saving is unavailable. Keep this form open and reconnect.');
      const result = await window.unicoFlushNow();
      if (!result || result.ok !== true) throw new Error(result && result.error || 'Database did not confirm the save. Keep this form open and retry.');
    } catch (ex) {
      const msg = ex && ex.message || 'the record could not be written';
      setErr('Not saved to database — ' + msg + ' Your edits remain in this tab.');
      try {
        window.UI && window.UI.toast && window.UI.toast('Staff record not saved', 'error');
      } catch (e) {}
      return;
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
    setErr('');
    setSaved({
      title: `${f.role || 'Nurse'} record saved`,
      sub: [f.name.trim(), f.designation, chipsOf('current_department')[0] || 'unassigned'].filter(Boolean).join(' · ')
    });
  };
  const leaveAfterSave = () => {
    setSaved(null);
    setRoute(editing ? {
      view: 'staffProfile',
      emp: empId
    } : {
      view: (f.role || 'Nurse') === 'PCA' ? 'pca' : 'nurses'
    });
  };
  const sec = (title, kids) => React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: 'var(--ink)',
      borderBottom: '1px solid var(--line-2)',
      paddingBottom: 7
    }
  }, title), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 14
    }
  }, kids));
  const MK = window.MK;
  return React.createElement("div", {
    className: "mk-scope grid",
    style: {
      gap: 14
    }
  }, React.createElement("div", {
    className: "card",
    style: {
      padding: '12px 18px',
      display: 'flex',
      gap: 13,
      alignItems: 'center',
      flexWrap: 'wrap',
      position: 'sticky',
      top: 0,
      zIndex: 60,
      boxShadow: '0 8px 22px rgba(13,27,46,.12)'
    }
  }, React.createElement("div", {
    style: MK ? MK.iconBadge('blue', 38) : {}
  }, React.createElement(Ic, {
    d: editing ? I.edit : I.plus,
    s: 18
  })), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 200
    }
  }, React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, editing ? 'Edit staff record' : `Add new ${f.role === 'PCA' ? 'PCA' : 'Nurse'}`), React.createElement("div", {
    style: {
      fontSize: 11.6,
      color: 'var(--muted)'
    }
  }, "Role sets the designation and qualification options \xB7 total experience is calculated for you")), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    }
  }, !editing && window.UnicoStaffRegForm && (!window.__UNICO_USER__ || window.__UNICO_USER__.role === 'Administrator') && React.createElement("button", {
    className: "btn sm",
    title: "Print the official registration form to fill in by hand",
    onClick: () => setPrintForm(true)
  }, React.createElement(Ic, {
    d: I.doc,
    s: 14
  }), "Print blank form"), printForm && window.UnicoStaffRegForm && React.createElement(window.UnicoStaffRegForm, {
    role: f.role || 'Nurse',
    onDone: () => setPrintForm(false)
  }), React.createElement("button", {
    className: "btn sm",
    onClick: () => setRoute(editing ? {
      view: 'staffProfile',
      emp: empId
    } : {
      view: (f.role || 'Nurse') === 'PCA' ? 'pca' : 'nurses'
    })
  }, "Cancel"), React.createElement("button", {
    className: "btn pri sm",
    disabled: saving,
    onClick: save
  }, React.createElement(Ic, {
    d: I.check,
    s: 15,
    sw: 2.4
  }), saving ? 'Saving?' : editing ? 'Save changes' : 'Create staff')), !editing && React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 9.6,
      fontWeight: 700,
      letterSpacing: .6,
      textTransform: 'uppercase',
      color: 'var(--muted)',
      marginBottom: 5
    }
  }, "Staff role"), React.createElement("div", {
    style: {
      display: 'inline-flex',
      gap: 3,
      padding: 3,
      borderRadius: 11,
      background: 'rgba(125,145,180,.16)'
    }
  }, ['Nurse', 'PCA'].map(r => React.createElement("button", {
    key: r,
    onClick: () => set('role', r),
    style: {
      border: 0,
      cursor: 'pointer',
      font: 'inherit',
      fontSize: 12,
      fontWeight: 700,
      padding: '6px 18px',
      borderRadius: 9,
      color: (f.role || 'Nurse') === r ? '#fff' : 'var(--muted)',
      background: (f.role || 'Nurse') === r ? 'linear-gradient(135deg,#27a8db,#0072a3)' : 'transparent'
    }
  }, r))))), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) 320px',
      gap: 14,
      alignItems: 'start'
    }
  }, React.createElement("div", {
    className: "grid",
    style: {
      gap: 16,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "grid",
    style: {
      alignItems: 'start'
    }
  }, React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, sec('Personal', React.createElement(React.Fragment, null, field('Emp ID', inp('emp_id', 'e.g. 11234')), field('Name *', inp('name', 'Full name')), field('Phone', inp('phone', '01XXXXXXXXX')), field('Gender', cmb('gender', ['Female', 'Male', 'Other'])), field('Date of Birth', inp('dob', 'YYYY-MM-DD', 'date'), f.dob && ageOf(f.dob) != null ? React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--muted)'
    }
  }, ageOf(f.dob), " yrs") : null), React.createElement("div", {
    style: {
      gridColumn: '1 / -1'
    }
  }, field('Qualification' + (chipsOf('qualification').length ? ' · ' + chipsOf('qualification').length + ' selected' : ''), multiChk('qualification', S.qualificationsFor(f.role), customQ, setCustomQ))), React.createElement("div", {
    style: {
      gridColumn: '1 / -1'
    }
  }, field('Extracurricular Activities' + (chipsOf('extracurricular').length ? ' · ' + chipsOf('extracurricular').length + ' selected' : ''), multiChk('extracurricular', S.EXTRACURRICULARS || [], customX, setCustomX, 'Add another activity — e.g. Chess…'))))), sec('Job', React.createElement(React.Fragment, null, field('Designation', React.createElement(SelectDropdown, {
    value: f.designation,
    onChange: v => set('designation', v),
    options: desigOpts,
    labelFn: canonDesig,
    placeholder: "Select or type \u2014 e.g. Nurse Manager, Supervisor"
  })), field('Current Department' + (chipsOf('current_department').length > 1 ? ' · ' + chipsOf('current_department').length + ' selected' : ''), React.createElement(MultiSelectDropdown, {
    value: f.current_department,
    onChange: v => set('current_department', v),
    options: deptOpts,
    labelFn: statsDeptNames && statsDeptNames.length ? undefined : deptLabel,
    placeholder: "Select department(s)\u2026"
  })), field('Date of Joining', inp('doj', 'YYYY-MM-DD', 'date')), chipsOf('current_department').length > 1 ? field('Primary Department', React.createElement(SelectDropdown, {
    value: f.primary_department || '',
    onChange: v => set('primary_department', v),
    options: chipsOf('current_department'),
    labelFn: statsDeptNames && statsDeptNames.length ? undefined : deptLabel,
    placeholder: "Which unit is home?"
  })) : null, field('Total Experience', React.createElement("div", {
    style: {
      padding: '9px 11px',
      border: '1px dashed var(--line)',
      borderRadius: 7,
      fontSize: 13,
      background: 'var(--panel-2)',
      color: 'var(--ink)',
      fontWeight: 600
    }
  }, S.fmtYM(totalY)), React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--muted)'
    }
  }, "auto = previous + UNICO")), React.createElement("div", {
    style: {
      gridColumn: '1 / -1'
    }
  }, React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      fontSize: 12.5,
      color: 'var(--ink-2)',
      cursor: 'pointer'
    }
  }, React.createElement("input", {
    type: "checkbox",
    checked: !!f.can_float,
    onChange: e => set('can_float', e.target.checked)
  }), "Can be floated to other units when they are short")))), sec('Previous Experience', React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      gridColumn: '1 / -1',
      display: 'flex',
      flexDirection: 'column',
      gap: 9
    }
  }, React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)'
    }
  }, "Enter total experience ", React.createElement("b", null, "before joining UNICO"), " below \u2014 or itemise it by organisation. UNICO tenure (from Date of Joining) is then added to give total experience."), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 10,
      flexWrap: 'wrap',
      background: 'var(--panel-2)',
      border: '1px solid var(--line)',
      borderRadius: 9,
      padding: '11px 14px'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, React.createElement("label", {
    style: {
      fontSize: 11,
      color: 'var(--ink-2)',
      fontWeight: 600
    }
  }, "Previous experience (excl. UNICO)"), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, React.createElement("input", {
    value: hasRows ? String(Math.floor(rowsPriorSum) || '') : dpY,
    disabled: hasRows,
    onChange: ev => setDpY(ev.target.value.replace(/[^\d.]/g, '')),
    placeholder: "0",
    inputMode: "decimal",
    style: {
      ...rowInp,
      width: 64,
      textAlign: 'center',
      fontFamily: 'IBM Plex Mono',
      opacity: hasRows ? .6 : 1
    }
  }), React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)'
    }
  }, "yrs"), React.createElement("input", {
    value: hasRows ? String(Math.round(rowsPriorSum % 1 * 12) || '') : dpM,
    disabled: hasRows,
    onChange: ev => setDpM(ev.target.value.replace(/[^\d]/g, '')),
    placeholder: "0",
    inputMode: "numeric",
    style: {
      ...rowInp,
      width: 64,
      textAlign: 'center',
      fontFamily: 'IBM Plex Mono',
      opacity: hasRows ? .6 : 1
    }
  }), React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)'
    }
  }, "mo"))), hasRows && React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--muted)',
      paddingBottom: 6
    }
  }, "Auto-summed from the organisation breakdown below.")), React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)',
      marginTop: 2
    }
  }, "Optional \u2014 break the above down by organisation / role:"), entries.length === 0 && React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)',
      padding: '2px 0'
    }
  }, "No itemised roles added."), entries.length > 0 && React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 78px 78px 32px',
      gap: 8,
      fontSize: 10.5,
      color: 'var(--muted)',
      textTransform: 'uppercase',
      letterSpacing: .4,
      fontWeight: 600
    }
  }, React.createElement("span", null, "Organization"), React.createElement("span", null, "Department / role"), React.createElement("span", null, "Years"), React.createElement("span", null, "Months"), React.createElement("span", null)), entries.map((x, i) => React.createElement("div", {
    key: i,
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 78px 78px 32px',
      gap: 8,
      alignItems: 'center'
    }
  }, React.createElement("input", {
    value: x.org || '',
    onChange: ev => setEntry(i, 'org', ev.target.value),
    placeholder: "Organisation \u2014 e.g. City Hospital",
    style: rowInp
  }), React.createElement(ComboInput, {
    value: x.dept || '',
    onChange: v => setEntry(i, 'dept', v),
    options: deptOpts,
    labelFn: statsDeptNames && statsDeptNames.length ? undefined : deptLabel,
    placeholder: "Department / role \u2014 type anything",
    style: rowInp
  }), React.createElement("input", {
    value: x.years || '',
    onChange: ev => setEntry(i, 'years', ev.target.value.replace(/[^\d.]/g, '')),
    placeholder: "0",
    inputMode: "decimal",
    style: {
      ...rowInp,
      textAlign: 'center',
      fontFamily: 'IBM Plex Mono'
    }
  }), React.createElement("input", {
    value: x.months || '',
    onChange: ev => setEntry(i, 'months', ev.target.value.replace(/[^\d]/g, '')),
    placeholder: "0",
    inputMode: "numeric",
    style: {
      ...rowInp,
      textAlign: 'center',
      fontFamily: 'IBM Plex Mono'
    }
  }), React.createElement("button", {
    className: "icon-btn danger",
    title: "Remove",
    onClick: () => delEntry(i),
    style: {
      justifySelf: 'center'
    }
  }, React.createElement(Ic, {
    d: I.x,
    s: 14
  })))), React.createElement("div", null, React.createElement("button", {
    className: "btn sm",
    onClick: addEntry
  }, React.createElement(Ic, {
    d: I.plus,
    s: 14
  }), "Add previous experience")), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 20,
      flexWrap: 'wrap',
      background: 'var(--panel-2)',
      borderRadius: 9,
      padding: '11px 14px',
      marginTop: 2
    }
  }, [['Previous', S.fmtYM(priorSum), '#6a52d4'], ['UNICO (from DOJ)', f.doj ? S.fmtYM(unicoY) : '—', '#1f9d57'], ['Total experience', S.fmtYM(totalY), 'var(--blue)']].map(([l, v, c], i) => React.createElement("div", {
    key: l,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, React.createElement("span", {
    style: {
      fontSize: 10.5,
      color: 'var(--muted)',
      textTransform: 'uppercase',
      letterSpacing: .4,
      fontWeight: 600
    }
  }, l), React.createElement("span", {
    className: "num",
    style: {
      fontSize: i === 2 ? 18 : 15,
      fontWeight: i === 2 ? 800 : 700,
      color: c
    }
  }, v))))))), sec('Compliance', React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      gridColumn: '1 / -1'
    }
  }, field('Special Training' + (chipsOf('special_training').length ? ' · ' + chipsOf('special_training').length + ' selected' : ''), multiChk('special_training', S.TRAININGS.filter(Boolean), customT, setCustomT, 'Add another training…'))), field('Hepatitis B Vaccination', cmb('hepatitis_b_vaccination', S.VACCINATION_STATES)), field('Registration / Licence No.', inp('licence_no', 'e.g. BNMC-12345'), f.licence_verified ? React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: '#157a43',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3
    }
  }, React.createElement(Ic, {
    d: I.check,
    s: 12,
    c: "#157a43"
  }), "BNMC verified") : null), field('Licence Expiry', inp('licence_expiry', 'YYYY-MM-DD', 'date'), licenceState ? React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: licenceState.c
    }
  }, licenceState.t) : null), React.createElement(BnmcVerify, {
    f: f,
    set: set,
    store: store,
    empId: empId,
    editing: editing
  }), React.createElement("div", {
    style: {
      gridColumn: '1 / -1'
    }
  }, field('Remarks', inp('remarks', 'Any notes'))))), sec('Privileges', React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      gridColumn: '1 / -1'
    }
  }, (() => {
    const selRaw = chipsOf('current_department');
    const resolveDept = d => {
      try {
        return (window.staffDeptShow ? window.staffDeptShow(d) : d) || d;
      } catch (e) {
        return d;
      }
    };
    const selDepts = [...new Set(selRaw.map(resolveDept).filter(Boolean))];
    const allowedKeys = S.deptPrivilegeKeysFor ? S.deptPrivilegeKeysFor(selDepts, f.role || 'Nurse') : null;
    const unknownDepts = selRaw.filter(d => !deptOpts.includes(resolveDept(d)));
    const hint = selDepts.length === 0 ? 'Select a department above first — privileges are assigned per department, in Settings → Department Privileges.' : unknownDepts.length ? `“${unknownDepts.join(', ')}” isn't a department Settings → Department Privileges recognises — re-pick the department above from the dropdown (it may have been renamed), then assign its privileges in Settings.` : `No privileges have been assigned to ${selDepts.join(', ')} yet for this role. Assign them in Settings → Department Privileges.`;
    return React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        marginBottom: 9
      }
    }, React.createElement("span", {
      style: {
        fontSize: 11.5,
        color: 'var(--muted)'
      }
    }, "Tick every clinical activity this ", f.role === 'PCA' ? 'PCA' : 'nurse', " is privileged to perform \u2014 filtered to what's assigned to ", selDepts.length ? selDepts.join(', ') : 'their department', "."), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("button", {
      type: "button",
      className: "btn sm",
      onClick: async () => {
        const ok = await window.UI.confirm({
          title: 'Leave this form?',
          message: 'Managing department privileges opens Settings and leaves this form — anything typed here will be lost unless you Save changes first.',
          confirmLabel: 'Leave without saving'
        });
        if (ok) {
          window.__UNICO_SETTINGS_TAB__ = 'deptprivileges';
          setRoute({
            view: 'settings'
          });
        }
      }
    }, "Manage in Settings")), React.createElement(PrivilegesEditor, {
      role: f.role || 'Nurse',
      value: f.privileges || {},
      onChange: v => set('privileges', v),
      allowedKeys: allowedKeys,
      emptyHint: hint
    }));
  })()))), sec('Additional Details', React.createElement(React.Fragment, null, field('NID / Passport No.', inp('nid', 'National ID or passport number')), field('Blood Group', cmb('blood_group', ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'])), field('Emergency Contact', inp('emergency_contact', 'Name & phone — e.g. Rahima, 017XXXXXXXX')), field('Emergency Contact Relation', inp('emergency_relation', 'e.g. Spouse, Father')), React.createElement("div", {
    style: {
      gridColumn: '1 / -1'
    }
  }, field('Languages Spoken' + (chipsOf('languages').length ? ' · ' + chipsOf('languages').length + ' selected' : ''), multiChk('languages', ['Bangla', 'English', 'Hindi', 'Urdu', 'Arabic'], customL, setCustomL, 'Add another language…'))))), customFieldDefs.length > 0 && sec('Custom Fields', customFieldDefs.map(cf => {
    const cv = (f.custom || {})[cf.id] || '';
    const node = cf.kind === 'multi' ? React.createElement(MultiSelectDropdown, {
      value: cv,
      onChange: v => setCustom(cf.id, v),
      options: cf.options || [],
      placeholder: 'Select ' + cf.name.toLowerCase() + '…'
    }) : cf.kind === 'text' ? React.createElement("input", {
      value: cv,
      onChange: e => setCustom(cf.id, e.target.value),
      placeholder: cf.name,
      style: {
        padding: '9px 11px',
        border: '1px solid var(--line)',
        borderRadius: 7,
        fontSize: 13,
        fontFamily: 'inherit',
        outline: 'none',
        width: '100%'
      }
    }) : React.createElement(SelectDropdown, {
      value: cv,
      onChange: v => setCustom(cf.id, v),
      options: cf.options || [],
      placeholder: 'Select ' + cf.name.toLowerCase() + '…'
    });
    return React.createElement("div", {
      key: cf.id,
      style: cf.kind === 'text' ? null : {
        gridColumn: '1 / -1'
      }
    }, field(cf.name, node));
  })), err && React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--rose)',
      fontWeight: 600
    }
  }, err), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      borderTop: '1px solid var(--line-2)',
      paddingTop: 14
    }
  }, React.createElement("button", {
    className: "btn pri",
    disabled: saving,
    onClick: save
  }, React.createElement(Ic, {
    d: I.check,
    s: 16,
    sw: 2.4
  }), saving ? 'Saving?' : editing ? 'Save changes' : 'Create staff'), React.createElement("button", {
    className: "btn",
    onClick: () => setRoute(editing ? {
      view: 'staffProfile',
      emp: empId
    } : {
      view: (f.role || 'Nurse') === 'PCA' ? 'pca' : 'nurses'
    })
  }, "Cancel")))))), React.createElement(StaffFormRail, {
    f: f,
    editing: editing,
    set: set,
    store: store,
    empId: empId
  })), saved && React.createElement(StaffSavedOverlay, {
    title: saved.title,
    sub: saved.sub,
    onClose: leaveAfterSave
  }));
}
function StaffSavedOverlay({
  title,
  sub,
  onClose
}) {
  React.useEffect(() => {
    const t = setTimeout(() => {
      try {
        onClose && onClose();
      } catch (e) {}
    }, 2600);
    return () => clearTimeout(t);
  }, []);
  return React.createElement("div", {
    onClick: onClose,
    role: "status",
    "aria-live": "polite",
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 3000,
      display: 'grid',
      placeItems: 'center',
      background: 'rgba(13,27,46,.45)',
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)'
    }
  }, React.createElement("style", null, '@keyframes stfPopCard{0%{opacity:0;transform:scale(.86) translateY(12px)}60%{transform:scale(1.03)}100%{opacity:1;transform:scale(1) translateY(0)}}@keyframes stfDrawCheck{from{stroke-dashoffset:48}to{stroke-dashoffset:0}}'), React.createElement("div", {
    style: {
      background: 'linear-gradient(152deg,rgba(255,255,255,.96),rgba(236,247,255,.88))',
      border: '1px solid rgba(255,255,255,.95)',
      borderRadius: 20,
      padding: '30px 38px 24px',
      textAlign: 'center',
      maxWidth: 360,
      boxShadow: '0 30px 80px rgba(5,12,24,.4)',
      animation: 'stfPopCard .35s cubic-bezier(.2,.85,.3,1.15) both'
    }
  }, React.createElement("div", {
    style: {
      width: 64,
      height: 64,
      borderRadius: '50%',
      background: 'rgba(31,157,87,.14)',
      display: 'grid',
      placeItems: 'center',
      margin: '0 auto 14px',
      boxShadow: '0 0 26px rgba(31,157,87,.3)'
    }
  }, React.createElement("svg", {
    width: "34",
    height: "34",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#1f9d57",
    strokeWidth: "3",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, React.createElement("path", {
    d: "M20 6L9 17l-5-5",
    strokeDasharray: "48",
    style: {
      animation: 'stfDrawCheck .5s .15s ease-out both'
    }
  }))), React.createElement("div", {
    style: {
      fontSize: 16.5,
      fontWeight: 800,
      color: '#16202e'
    }
  }, title), React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: '#6c7a8c',
      marginTop: 6
    }
  }, sub), React.createElement("div", {
    style: {
      fontSize: 11,
      color: '#9aa6b4',
      marginTop: 12
    }
  }, "Tap anywhere to close")));
}
Object.assign(window, {
  StaffProfile,
  StaffForm,
  StaffFormRail,
  StaffSavedOverlay,
  PrivilegesEditor,
  PrivilegeDeptMatrix,
  DeptPrivilegesSettings,
  StaffRecordPrint,
  StaffRecordSheet
});
})();
