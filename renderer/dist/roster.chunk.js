/* ===== roster.jsx ===== */
(function(){
const {
  useState,
  useEffect,
  useMemo,
  useRef
} = React;
const Ic = window.Ic,
  I = window.I;
const R = window.UNICO_ROSTER;
const MK = window.MK;
const rosApi = {
  get: u => fetch(u, {
    headers: {
      accept: 'application/json'
    }
  }).then(r => r.json()),
  put: (u, b) => fetch(u, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(b || {})
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
const rosToast = (m, t) => {
  try {
    window.UI && window.UI.toast && window.UI.toast(m, t || 'success');
  } catch (e) {}
};
const rosCan = a => {
  try {
    return window.unicoCan ? window.unicoCan('roster', a) : true;
  } catch (e) {
    return true;
  }
};
const rosIsAdmin = () => {
  try {
    const u = window.__UNICO_USER__;
    return !u || u.role === 'Administrator';
  } catch (e) {
    return true;
  }
};
const ROS_STATUS = {
  draft: {
    label: 'Draft',
    color: '#e0a12a'
  },
  submitted: {
    label: 'Submitted',
    color: '#27a8db'
  },
  approved: {
    label: 'Approved',
    color: '#1f9d63'
  }
};
const rosKey = e => 'S' + String(e.id);
const rosMigrateGrid = (grid, rows) => {
  const g = grid || {};
  const keys = Object.keys(g);
  if (!keys.length) return g;
  const current = new Set(rows.map(r => r.empId));
  if (keys.every(k => current.has(k))) return g;
  const byEmpNo = {};
  rows.forEach(r => {
    if (r.empIdShown) byEmpNo[String(r.empIdShown)] = r.empId;
  });
  const out = {};
  keys.forEach(k => {
    out[byEmpNo[k] || k] = g[k];
  });
  return out;
};
const ROS_MONO = "'IBM Plex Mono',monospace";
const ROS_BCOLOR = {
  G: '#6a52d4',
  M: '#e08a1e',
  E: '#0090ca',
  N: '#5b45c4',
  O: '#8b98ab'
};
const rosBColor = b => ROS_BCOLOR[b] || '#8b98ab';
const ROS_BUCKETS = [['G', 'General', '#6a52d4', 'M3 5h18v16H3zM3 9h18'], ['M', 'Morning', '#e08a1e', 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z'], ['E', 'Evening', '#0090ca', 'M12 3a9 9 0 109 9 7 7 0 01-9-9z'], ['N', 'Night', '#5b45c4', 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z']];
const ROS_CODE_ORDER = ['G1', 'G2', 'G3', 'G4', 'M1', 'M2', 'M3', 'M4', 'M6', 'M7', 'M8', 'M11', 'E1', 'E2', 'E3', 'E4', 'E6', 'E10', 'E11', 'N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N11', 'DN1', 'OFF', 'DO', 'PH', 'AL', 'CL', 'EL', 'ML', 'FL'];
const ROS_QUICK_BRUSH = ['M4', 'E4', 'N2', 'G1', 'OFF', 'DO', 'AL', 'CL'];
const ROS_WINDOWS = {
  G: '8 AM – 5 PM',
  M: '6 AM – 3 PM',
  E: '12 PM – 10 PM',
  N: '7 PM – 8 AM'
};
const ROS_TONE = {
  G: '#6a52d4',
  M: '#b5670a',
  E: '#0072a3',
  N: '#5b45c4',
  O: '#7d8ea8'
};
const ROS_LEAVE_TONE = {
  OFF: '#8b98ab',
  DO: '#8b98ab',
  AL: '#b5670a',
  EL: '#b5670a',
  CL: '#0072a3',
  ML: '#5b45c4',
  FL: '#5b45c4',
  PH: '#157a43'
};
const ROS_LEAVE_CODES = ['AL', 'CL', 'EL', 'ML', 'FL'];
const ROS_PATTERNS = [['p_mmeenno', '2M · 2E · 2N · 1 off', ['M4', 'M4', 'E4', 'E4', 'N2', 'N2', 'OFF']], ['p_mmmoff', '3 mornings · 1 off', ['M4', 'M4', 'M4', 'OFF']], ['p_nnnoff', '3 nights · 2 off', ['N2', 'N2', 'N2', 'OFF', 'DO']], ['p_gen', 'General duty · Fri off', ['G1', 'G1', 'G1', 'G1', 'OFF', 'G1', 'DO']]];
const ROS_METRIC_LABEL = {
  onDuty: 'staff on duty',
  morning: 'morning staff',
  evening: 'evening staff',
  night: 'night staff',
  general: 'general-duty staff',
  onLeave: 'staff on leave',
  nights: 'night shifts',
  hours: 'total hours',
  offDays: 'rest days',
  shifts: 'shifts worked',
  fridaysWorked: 'Fridays worked'
};
const ROS_DEF_CFG = {
  minM: 2,
  minE: 2,
  minN: 2,
  maxNights: 3,
  minOff: 4,
  maxLeavePerDay: 1,
  minOnDuty: 3,
  ratio: '1 : 2',
  fridayOff: true
};
const ROS_DEF_OFF = {
  min: true,
  nm: true,
  nights: true,
  offdays: true,
  senior: true,
  leave: true,
  ratio: true,
  friday: true
};
const ROS_VIEW_TABS = [['month', 'Monthly grid', 'M3 5h18v16H3zM3 9h18M8 3v4M16 3v4'], ['week', 'Weekly board', 'M4 4h16v16H4zM9 4v16M15 4v16'], ['day', 'Day view', 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M2 12h2M20 12h2'], ['staff', 'Staff timeline', 'M4 6h16M4 12h10M4 18h7'], ['calendar', 'Calendar', 'M3 5h18v16H3zM3 9h18M8 3v4M16 3v4'], ['leave', 'Leave calendar', 'M8 2v4M16 2v4M3 8h18M5 8v13h14V8'], ['tree', 'Tree view', 'M4 12h5M14 6h6M14 12h6M14 18h6M9 6v12M9 6h5M9 18h5'], ['swap', 'Shift swaps', 'M7 16H3l4-4M17 8h4l-4 4M3 16h14M21 8H7'], ['rules', 'Rules & policy', 'M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6zM9 12l2 2 4-4']];
const rosTab = on => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  border: 0,
  background: on ? 'linear-gradient(135deg,#27a8db,#0072a3)' : 'transparent',
  color: on ? '#fff' : '#6c7a8c',
  padding: '7px 13px',
  borderRadius: 9,
  fontSize: 11.5,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'all .2s',
  boxShadow: on ? '0 5px 14px rgba(0,144,202,.35)' : 'none'
});
const rosChipS = (c, bg) => ({
  fontSize: 10,
  fontWeight: 700,
  padding: '2px 9px',
  borderRadius: 10,
  color: c,
  background: bg,
  whiteSpace: 'nowrap'
});
const rosAvRadius = s => Math.round(s / 3);
const ROS_CARD = {
  background: 'linear-gradient(152deg,rgba(255,255,255,.78),rgba(236,247,255,.48))',
  backdropFilter: 'blur(24px) saturate(1.7)',
  WebkitBackdropFilter: 'blur(24px) saturate(1.7)',
  border: '1px solid rgba(255,255,255,.92)',
  borderRadius: 16,
  boxShadow: '0 14px 40px rgba(31,59,90,.13),inset 0 1px 0 rgba(255,255,255,.95)',
  overflow: 'hidden'
};
const ROS_CARD15 = {
  ...ROS_CARD,
  borderRadius: 15,
  boxShadow: '0 12px 36px rgba(31,59,90,.12),inset 0 1px 0 rgba(255,255,255,.95)'
};
const ROS_CARD_HEAD = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '12px 16px',
  borderBottom: '1px solid rgba(125,145,180,.18)'
};
const ROS_H3 = {
  margin: 0,
  fontSize: 13.5,
  fontWeight: 700,
  color: '#16202e'
};
const rosBadge = (bg, c, n, r) => ({
  display: 'inline-grid',
  placeItems: 'center',
  width: n,
  height: n,
  borderRadius: r == null ? 8 : r,
  background: bg,
  color: c,
  flexShrink: 0
});
const rosDow = (y, m, d) => R.DOW[new Date(y, m, d).getDay()];
const rosIsFri = (y, m, d) => new Date(y, m, d).getDay() === 5;
const rosCol = (y, m, d) => (new Date(y, m, d).getDay() + 1) % 7;
function rosInjectCss() {
  if (typeof document === 'undefined' || document.getElementById('ros-style')) return;
  const el = document.createElement('style');
  el.id = 'ros-style';
  el.textContent = ['@keyframes rosPop{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}', '@keyframes rosOrbFloat{from{transform:translate(0,0) scale(1)}to{transform:translate(160px,110px) scale(1.18)}}', '@keyframes rosGrowW{from{width:0}}', '@keyframes rosSlideIn{from{opacity:0;transform:translateX(26px)}to{opacity:1;transform:none}}', '@keyframes rosSlideInY{from{opacity:0;transform:translate(26px,-50%)}to{opacity:1;transform:translate(0,-50%)}}', '@keyframes rosPopCard{0%{opacity:0;transform:scale(.9) translateY(10px)}100%{opacity:1;transform:none}}', '.ros-kpi:hover{transform:translateY(-3px)!important;box-shadow:0 20px 46px rgba(31,59,90,.18)!important}', '.ros-trow:hover{background:rgba(39,168,219,.07)!important}', '.ros-vio:hover{background:rgba(210,58,82,.2)!important}', '.ros-auto:hover{background:rgba(106,82,212,.18)!important}', '.ros-treerow:hover{background:rgba(0,144,202,.08)!important}', '.ros-navbtn:hover{background:#fff!important}', '.ros-goday:hover{background:rgba(0,144,202,.18)!important}', '.ros-lift:hover{transform:translateY(-1px)}', '.ros-x:hover{background:rgba(125,145,180,.16)!important;color:#16202e!important}', '.ros-xred:hover{background:rgba(210,58,82,.12)!important;color:#a92c42!important}', '.ros-decl:hover{background:rgba(210,58,82,.1)!important}'].join('\n');
  document.head.appendChild(el);
}
function rosEval(grid, rows, days, year, month, cfg, en, custom) {
  const N = rows.length;
  const code = (i, d) => (grid[rows[i].empId] || {})[d] || '';
  const bOf = c => R.bucketOf(c) || '';
  const dayBucketCount = (d, b) => {
    let n = 0;
    for (let i = 0; i < N; i++) if (bOf(code(i, d)) === b) n++;
    return n;
  };
  const dayMetric = (d, m) => {
    if (m === 'onDuty') {
      let n = 0;
      for (let i = 0; i < N; i++) {
        const b = bOf(code(i, d));
        if (b && b !== 'O') n++;
      }
      return n;
    }
    if (m === 'onLeave') {
      let n = 0;
      for (let i = 0; i < N; i++) if (ROS_LEAVE_CODES.indexOf(code(i, d)) >= 0) n++;
      return n;
    }
    return dayBucketCount(d, {
      general: 'G',
      morning: 'M',
      evening: 'E',
      night: 'N'
    }[m] || 'M');
  };
  const staffMetric = (i, m) => {
    let nights = 0,
      hours = 0,
      offs = 0,
      shifts = 0,
      friWork = 0;
    for (let d = 1; d <= days; d++) {
      const c = code(i, d),
        b = bOf(c);
      if (b === 'N') nights++;
      if (b === 'O') offs++;else if (b) shifts++;
      hours += R.hoursOf(c);
      if (rosIsFri(year, month, d) && b && b !== 'O') friWork++;
    }
    return {
      nights,
      hours,
      offDays: offs,
      shifts,
      fridaysWorked: friWork
    }[m] || 0;
  };
  const closedDays = {};
  for (let d = 1; d <= days; d++) {
    let written = 0,
      on = 0;
    for (let i = 0; i < N; i++) {
      const b = bOf(code(i, d));
      if (b) {
        written++;
        if (b !== 'O') on++;
      }
    }
    if (N > 0 && written === N && on === 0) closedDays[d] = true;
  }
  const viol = {
    ratio: [],
    min: [],
    nm: [],
    nights: [],
    off: [],
    senior: [],
    leave: [],
    friday: []
  };
  for (let d = 1; d <= days; d++) {
    if (!closedDays[d]) {
      if (en.min !== false) [['M', cfg.minM], ['E', cfg.minE], ['N', cfg.minN]].forEach(([b, mn]) => {
        const n = dayBucketCount(d, b);
        if (n < mn) viol.min.push('Day ' + d + ' ' + b + ' has ' + n);
      });
      if (en.senior !== false) {
        let night = 0,
          sen = false;
        for (let i = 0; i < N; i++) {
          if (bOf(code(i, d)) === 'N') {
            night++;
            if (/Senior|Team|Charge/.test(rows[i].desig || '')) sen = true;
          }
        }
        if (night && !sen) viol.senior.push('Day ' + d + ' night');
      }
      if (en.ratio !== false) {
        const on = dayMetric(d, 'onDuty');
        if (on < cfg.minOnDuty) viol.ratio.push('Day ' + d + ' only ' + on + ' on duty');
      }
    }
    if (en.leave !== false) {
      const away = [];
      for (let i = 0; i < N; i++) if (ROS_LEAVE_CODES.indexOf(code(i, d)) >= 0) away.push(rows[i].name);
      if (away.length > cfg.maxLeavePerDay) viol.leave.push('Day ' + d + ': ' + away.join(', '));
    }
  }
  for (let i = 0; i < N; i++) {
    let run = 0,
      offs = 0,
      fri = 0;
    for (let d = 1; d <= days; d++) {
      const c = code(i, d),
        b = bOf(c);
      if (b === 'N') {
        run++;
        if (en.nights !== false && run > cfg.maxNights) viol.nights.push(rows[i].name + ' day ' + d);
      } else run = 0;
      if (b === 'O') offs++;
      if (en.nm !== false && d > 1 && bOf(code(i, d - 1)) === 'N' && b === 'M') viol.nm.push(rows[i].name + ' day ' + d);
      if (rosIsFri(year, month, d) && b === 'O') fri++;
    }
    if (en.offdays !== false && offs < cfg.minOff) viol.off.push(rows[i].name + ' has ' + offs + ' rest days');
    if (en.friday !== false && cfg.fridayOff && fri === 0) viol.friday.push(rows[i].name + ' worked every Friday');
  }
  const customResults = (custom || []).map(r => {
    const hits = [];
    const bad = v => r.op === '<' ? v < r.val : r.op === '>' ? v > r.val : v === r.val;
    if (r.scope === 'day') {
      for (let d = 1; d <= days; d++) {
        const v = dayMetric(d, r.metric);
        if (bad(v)) hits.push('Day ' + d + ' = ' + v);
      }
    } else {
      for (let i = 0; i < N; i++) {
        const v = staffMetric(i, r.metric);
        if (bad(v)) hits.push(rows[i].name + ' = ' + v);
      }
    }
    return {
      rule: r,
      hits
    };
  });
  const rules = [['Nurse-to-patient ratio per shift', cfg.ratio + ' · at least ' + cfg.minOnDuty + ' on duty', viol.ratio, 'ratio'], ['Minimum staff per shift', 'M ≥ ' + cfg.minM + ' · E ≥ ' + cfg.minE + ' · N ≥ ' + cfg.minN, viol.min, 'min'], ['No night → morning back-to-back', 'at least one rest between', viol.nm, 'nm'], ['Max consecutive nights', 'no more than ' + cfg.maxNights + ' in a row', viol.nights, 'nights'], ['Weekly off entitlement', cfg.minOff + ' rest days per month minimum', viol.off, 'offdays'], ['Senior nurse on every shift', 'senior / team leader / charge on nights', viol.senior, 'senior'], ['Leave clash warnings', 'no more than ' + cfg.maxLeavePerDay + ' on leave per day', viol.leave, 'leave'], ['Friday off entitlement (BD)', 'every nurse gets at least one Friday off', viol.friday, 'friday']].filter(r => en[r[3]] !== false).concat(customResults.map(cr => [cr.rule.name, 'custom · ' + cr.rule.scope + ' ' + cr.rule.metric + ' ' + cr.rule.op + ' ' + cr.rule.val, cr.hits, 'custom']));
  const totalViol = rules.reduce((a, r) => a + r[2].length, 0);
  const okRules = rules.filter(r => !r[2].length).length;
  return {
    viol,
    customResults,
    rules,
    totalViol,
    okRules,
    dayMetric,
    staffMetric,
    dayBucketCount,
    closedDays
  };
}
function useRosterIndex() {
  const [state, setState] = useState({
    rosters: [],
    loading: true,
    error: null
  });
  const load = React.useCallback(() => rosApi.get('/api/rosters').then(r => {
    if (r && r.ok) setState({
      rosters: r.rosters || [],
      loading: false,
      error: null
    });else setState(s => ({
      ...s,
      loading: false,
      error: r && r.error || 'Could not load rosters.'
    }));
  }).catch(() => setState(s => ({
    ...s,
    loading: false,
    error: 'Could not reach the server.'
  }))), []);
  useEffect(() => {
    load();
  }, [load]);
  return {
    ...state,
    reload: load
  };
}
function RosLegendPanel() {
  return React.createElement("div", {
    style: {
      padding: '10px 16px 12px',
      borderBottom: '1px solid rgba(125,145,180,.18)',
      background: 'rgba(247,251,255,.6)',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))',
      gap: 9
    }
  }, [['G', 'General', '#6a52d4'], ['M', 'Morning', '#e08a1e'], ['E', 'Evening', '#0090ca'], ['N', 'Night', '#5b45c4'], ['O', 'Leave / off', '#8b98ab']].map(([b, label, c]) => React.createElement("div", {
    key: b,
    style: {
      background: 'rgba(255,255,255,.7)',
      border: '1px solid ' + c + '2e',
      borderLeft: '3px solid ' + c,
      borderRadius: 10,
      padding: '9px 11px',
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      marginBottom: 6
    }
  }, React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: 2,
      background: c,
      flexShrink: 0
    }
  }), React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 800,
      letterSpacing: .7,
      textTransform: 'uppercase',
      color: c
    }
  }, label)), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, R.SHIFTS.filter(s => s.bucket === b).map(s => React.createElement("div", {
    key: s.code,
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 7,
      fontSize: 10.5,
      color: '#6c7a8c',
      lineHeight: 1.5
    }
  }, React.createElement("b", {
    style: {
      fontFamily: ROS_MONO,
      fontSize: 10,
      fontWeight: 700,
      color: c,
      minWidth: 26,
      flexShrink: 0
    }
  }, s.code), React.createElement("span", {
    style: {
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, s.label)))))));
}
function ShiftLegend({
  compact
}) {
  return React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7
    }
  }, R.BUCKETS.map(b => {
    const codes = R.SHIFTS.filter(s => s.bucket === b.id);
    return React.createElement("div", {
      key: b.id,
      style: {
        display: 'flex',
        gap: 8,
        alignItems: 'baseline',
        fontSize: compact ? 10.4 : 11.4
      }
    }, React.createElement("span", {
      style: {
        minWidth: 62,
        fontWeight: 700,
        color: b.color
      }
    }, b.label), React.createElement("span", {
      className: "sub",
      style: {
        flex: 1,
        lineHeight: 1.6
      }
    }, codes.map(c => c.code + ': ' + c.label).join('  |  ')));
  }));
}
function RosStatusChip({
  st
}) {
  const map = {
    draft: 'In progress',
    submitted: 'Awaiting discussion',
    approved: 'Actioned'
  };
  const label = (ROS_STATUS[st || 'draft'] || ROS_STATUS.draft).label;
  return React.createElement("span", {
    style: MK.stChip(map[st] || 'Not started')
  }, label);
}
function RosterHome({
  index,
  staffStore,
  setRoute
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const depts = useMemo(() => {
    const m = {};
    (staffStore.staff || []).filter(e => e.is_active !== false && !e.former).forEach(e => {
      const d = e.current_department || 'Unassigned';
      m[d] = (m[d] || 0) + 1;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [staffStore.staff]);
  const byKey = useMemo(() => {
    const m = {};
    (index.rosters || []).forEach(r => {
      m[r.dept + '|' + r.year + '|' + r.month] = r;
    });
    return m;
  }, [index.rosters]);
  const recent = (index.rosters || []).slice(0, 12);
  return React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h",
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, React.createElement("div", {
    style: MK.iconBadge('teal', 32)
  }, React.createElement(Ic, {
    d: I.grid,
    s: 16
  })), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 220
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 15.5,
      color: MK.INK
    }
  }, "Duty roster"), React.createElement("div", {
    className: "sub"
  }, "One sheet per unit per month \xB7 shift codes, coverage and rule checks in one place")), React.createElement("select", {
    value: month,
    onChange: e => setMonth(Number(e.target.value))
  }, R.MONTHS.map((m, i) => React.createElement("option", {
    key: m,
    value: i
  }, m))), React.createElement("select", {
    value: year,
    onChange: e => setYear(Number(e.target.value))
  }, [year - 1, year, year + 1].map(y => React.createElement("option", {
    key: y,
    value: y
  }, y)))), React.createElement("div", {
    className: "card-b"
  }, React.createElement("div", {
    className: "sub",
    style: {
      marginBottom: 9
    }
  }, "Pick a unit to open or start its ", R.MONTHS[month], " ", year, " roster."), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))',
      gap: 10
    }
  }, depts.map(([d, n]) => {
    const ex = byKey[d + '|' + year + '|' + month];
    return React.createElement("div", {
      key: d,
      className: "card",
      style: {
        padding: 12,
        cursor: 'pointer',
        borderLeft: '3px solid ' + (ex ? (ROS_STATUS[ex.status] || ROS_STATUS.draft).color : 'transparent')
      },
      onClick: () => setRoute({
        view: 'rosterGrid',
        dept: d,
        year,
        month
      })
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        fontWeight: 700,
        fontSize: 12.8,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, d), React.createElement("div", {
      className: "sub",
      style: {
        fontSize: 11
      }
    }, n, " staff")), ex ? React.createElement(RosStatusChip, {
      st: ex.status
    }) : React.createElement("span", {
      className: "tag",
      style: {
        opacity: .6
      }
    }, "not drafted")));
  })))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Recent rosters"), React.createElement("div", {
    className: "sub"
  }, "most recent month first")), React.createElement("div", {
    className: "card-b",
    style: {
      overflow: 'auto'
    }
  }, index.loading ? React.createElement("div", {
    className: "sub",
    style: {
      padding: 16,
      textAlign: 'center'
    }
  }, "Loading\u2026") : recent.length === 0 ? React.createElement("div", {
    style: {
      display: 'grid',
      placeItems: 'center',
      padding: 34,
      textAlign: 'center',
      gap: 6
    }
  }, React.createElement("div", {
    style: {
      opacity: .35
    }
  }, React.createElement(Ic, {
    d: I.grid,
    s: 32
  })), React.createElement("div", {
    style: {
      fontWeight: 600
    }
  }, "No rosters drafted yet"), React.createElement("div", {
    className: "sub",
    style: {
      maxWidth: 400
    }
  }, "Pick a unit above to start one. The grid opens with every nurse in that unit already on a row.")) : React.createElement("table", {
    className: "tbl",
    style: {
      width: '100%'
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Unit"), React.createElement("th", null, "Month"), React.createElement("th", null, "Status"), React.createElement("th", null, "Revision"), React.createElement("th", null, "Last saved"), React.createElement("th", null))), React.createElement("tbody", null, recent.map(r => React.createElement("tr", {
    key: r.id
  }, React.createElement("td", {
    style: {
      fontWeight: 600
    }
  }, r.deptName || r.dept), React.createElement("td", null, R.MONTHS[r.month], " ", r.year), React.createElement("td", null, React.createElement(RosStatusChip, {
    st: r.status
  })), React.createElement("td", {
    className: "num"
  }, "v", r.revision || 1), React.createElement("td", {
    className: "sub"
  }, r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : '—', r.updatedBy ? ' · ' + r.updatedBy : ''), React.createElement("td", {
    style: {
      textAlign: 'right',
      whiteSpace: 'nowrap'
    }
  }, React.createElement("button", {
    className: "btn",
    onClick: () => setRoute({
      view: 'rosterPrint',
      dept: r.dept,
      year: r.year,
      month: r.month
    })
  }, "Print"), ' ', React.createElement("button", {
    className: "btn pri",
    onClick: () => setRoute({
      view: 'rosterGrid',
      dept: r.dept,
      year: r.year,
      month: r.month
    })
  }, "Open")))))))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Shift legend"), React.createElement("div", {
    className: "sub"
  }, "the unit's own codes \u2014 used everywhere in this module")), React.createElement(RosLegendPanel, null)));
}
function RosterGrid({
  staffStore,
  dept,
  year,
  month,
  setRoute,
  onSaved,
  initialView
}) {
  rosInjectCss();
  const days = R.daysIn(year, month);
  const [view, setView] = useState(initialView || 'month');
  const [grid, setGrid] = useState({});
  const [order, setOrder] = useState([]);
  const [status, setStatus] = useState('draft');
  const [rev, setRev] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [conflict, setConflict] = useState('');
  const [storedNames, setStoredNames] = useState({});
  const [retryTick, setRetryTick] = useState(0);
  const [brush, setBrush] = useState('');
  const [brushAll, setBrushAll] = useState(false);
  const [painting, setPainting] = useState(false);
  const [drag, setDrag] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [dragMode, setDragMode] = useState('swap');
  const [pick, setPick] = useState(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [queue, setQueue] = useState([]);
  const [savedBatch, setSavedBatch] = useState(null);
  const [swapLog, setSwapLog] = useState([]);
  const [week, setWeek] = useState(0);
  const now = new Date();
  const [day, setDay] = useState(() => now.getFullYear() === year && now.getMonth() === month ? now.getDate() : 1);
  const [treeDay, setTreeDay] = useState(null);
  const [treeB, setTreeB] = useState(null);
  const [treeD, setTreeD] = useState(null);
  const [dayPop, setDayPop] = useState(null);
  const [cfg, setCfg] = useState(ROS_DEF_CFG);
  const [en, setEn] = useState(ROS_DEF_OFF);
  const [custom, setCustom] = useState([]);
  const [draft, setDraft] = useState({
    name: '',
    scope: 'day',
    metric: 'onDuty',
    op: '<',
    val: 4,
    sev: 'warning'
  });
  const [sign, setSign] = useState({});
  const [approvedAt, setApprovedAt] = useState(null);
  const history = useRef([]);
  const saveTimer = useRef(null);
  const toastTimer = useRef(null);
  const staff = useMemo(() => (staffStore.staff || []).filter(e => e.is_active !== false && !e.former && (e.current_department || 'Unassigned') === dept).map(e => ({
    empId: rosKey(e),
    empIdShown: e.emp_id || '',
    name: e.name,
    desig: e.designation
  })).sort((a, b) => String(a.name).localeCompare(String(b.name))), [staffStore.staff, dept]);
  const rows = useMemo(() => {
    const byId = {};
    staff.forEach(x => {
      byId[x.empId] = x;
    });
    const seen = {};
    const out = [];
    const ghost = id => ({
      empId: id,
      empIdShown: '',
      name: storedNames[id] || id,
      desig: 'No longer on this unit',
      offRegister: true
    });
    const hasCells = id => Object.keys(grid[id] || {}).length > 0;
    order.forEach(id => {
      if (seen[id]) return;
      if (byId[id]) out.push(byId[id]);else if (hasCells(id)) out.push(ghost(id));else return;
      seen[id] = 1;
    });
    staff.forEach(x => {
      if (!seen[x.empId]) {
        out.push(x);
        seen[x.empId] = 1;
      }
    });
    Object.keys(grid).forEach(id => {
      if (!seen[id] && hasCells(id)) {
        out.push(ghost(id));
        seen[id] = 1;
      }
    });
    return out;
  }, [staff, order, grid, storedNames]);
  const depts = useMemo(() => [...new Set((staffStore.staff || []).filter(e => e.is_active !== false && !e.former).map(e => e.current_department || 'Unassigned'))].sort(), [staffStore.staff]);
  useEffect(() => {
    setLoading(true);
    setLoadError('');
    setConflict('');
    rosApi.get('/api/rosters/' + encodeURIComponent(dept) + '/' + year + '/' + month).then(r => {
      if (!r || !r.ok) {
        setLoadError(r && r.error || 'The server did not return the roster.');
        setLoading(false);
        setDirty(false);
        return;
      }
      const d = r.roster;
      setGrid(rosMigrateGrid(d && d.grid, staff));
      setOrder(d && d.order || []);
      setStoredNames(d && d.names || {});
      setStatus(d && d.status || 'draft');
      setRev(d && d.revision || 0);
      const ru = d && d.rules || {};
      setCfg({
        ...ROS_DEF_CFG,
        ...(ru.cfg || {})
      });
      setEn({
        ...ROS_DEF_OFF,
        ...(ru.off || {})
      });
      setCustom(Array.isArray(ru.custom) ? ru.custom : []);
      if (!ru.cfg && ru.minMorning) {
        setCfg(c => ({
          ...c,
          minM: ru.minMorning && ru.minMorning.value || c.minM,
          minE: ru.minEvening && ru.minEvening.value || c.minE,
          minN: ru.minNight && ru.minNight.value || c.minN,
          maxNights: ru.maxConsecNight && ru.maxConsecNight.value || c.maxNights,
          maxLeavePerDay: ru.leaveClash && ru.leaveClash.value || c.maxLeavePerDay
        }));
      }
      setSign({
        'Prepared by': d && d.preparedBy || '—',
        'Checked by': d && d.checkedBy || '—',
        'Approved by': d && d.approvedBy || '—'
      });
      setApprovedAt(d && d.approvedAt ? new Date(d.approvedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }) : null);
      setLoading(false);
      setDirty(false);
      setQueue([]);
      history.current = [];
    }).catch(() => {
      setLoadError('Could not reach the server.');
      setLoading(false);
      setDirty(false);
    });
  }, [dept, year, month, reloadKey]);
  useEffect(() => {
    const up = () => {
      setPainting(false);
      setDrag(null);
      setDragOver(null);
    };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);
  const locked = status === 'approved';
  const canEdit = !locked && !loadError && !conflict && rosCan('edit');
  const editBlocked = () => {
    rosToast(conflict ? 'Someone else saved this roster. Reload the month before editing.' : locked ? 'Approved and locked — reopen it to edit.' : 'You do not have edit rights on the roster.', 'info');
  };
  const push = () => {
    history.current.push(JSON.stringify(grid));
    if (history.current.length > 25) history.current.shift();
  };
  const undo = () => {
    if (!canEdit) return editBlocked();
    const p = history.current.pop();
    if (p == null) return;
    setGrid(JSON.parse(p));
    setDirty(true);
  };
  const cellCode = (empId, d) => (grid[empId] || {})[d] || '';
  const setCells = fn => {
    setGrid(g => fn(g));
    setDirty(true);
  };
  const writeCell = (g, empId, d, code) => {
    const row = {
      ...(g[empId] || {})
    };
    if (code) row[d] = code;else delete row[d];
    return {
      ...g,
      [empId]: row
    };
  };
  const setCell = (empId, d, code) => {
    if (!canEdit) return editBlocked();
    push();
    setCells(g => writeCell(g, empId, d, code));
  };
  const copyWeek = () => {
    if (!canEdit) return editBlocked();
    push();
    const snap = grid;
    setCells(g => {
      let out = {
        ...g
      };
      rows.forEach(x => {
        const row = {
          ...(out[x.empId] || {})
        };
        for (let d = 8; d <= days; d++) {
          const src = (snap[x.empId] || {})[d - 7];
          if (src) row[d] = src;else delete row[d];
        }
        out[x.empId] = row;
      });
      return out;
    });
  };
  const fillBlanks = () => {
    if (!canEdit) return editBlocked();
    push();
    setCells(g => {
      let out = {
        ...g
      };
      rows.forEach(x => {
        const row = {
          ...(out[x.empId] || {})
        };
        for (let d = 1; d <= days; d++) if (!row[d]) row[d] = 'OFF';
        out[x.empId] = row;
      });
      return out;
    });
  };
  const rowTool = (empId, v) => {
    if (!canEdit || !v) {
      if (v) editBlocked();
      return;
    }
    const pat = ROS_PATTERNS.find(p => p[0] === v);
    push();
    setCells(g => {
      const row = {
        ...(g[empId] || {})
      };
      for (let d = 1; d <= days; d++) {
        if (pat) row[d] = pat[2][(d - 1) % pat[2].length];else if (v === 'clear') delete row[d];else if (v === 'blanks' && !row[d]) row[d] = 'OFF';
      }
      return {
        ...g,
        [empId]: row
      };
    });
  };
  const autoFill = () => {
    if (!canEdit) return editBlocked();
    const anything = rows.some(x => Object.keys(grid[x.empId] || {}).length);
    if (anything && !window.confirm('Auto-draft replaces every shift already typed in ' + R.MONTHS[month] + '. Continue?')) return;
    push();
    const pat = ['M4', 'M4', 'E4', 'E4', 'N2', 'N2', 'OFF'];
    setCells(g => {
      let out = {
        ...g
      };
      rows.forEach((x, i) => {
        const row = {};
        for (let d = 1; d <= days; d++) row[d] = pat[(d - 1 + i * 2) % 7];
        out[x.empId] = row;
      });
      return out;
    });
  };
  const fillCol = d => {
    if (!canEdit) return editBlocked();
    if (!brush) {
      rosToast('Pick a brush code first — then click a day heading to fill that column.', 'info');
      return;
    }
    push();
    setCells(g => {
      let out = {
        ...g
      };
      rows.forEach(x => {
        out[x.empId] = {
          ...(out[x.empId] || {}),
          [d]: brush
        };
      });
      return out;
    });
  };
  const saveQueue = () => {
    const q = queue;
    if (!q.length) return;
    push();
    setCells(g => {
      let out = {
        ...g
      };
      q.forEach(x => {
        out = writeCell(out, x.bId, x.bDi, x.aCode);
        out = writeCell(out, x.aId, x.aDi, x.mode === 'swap' ? x.bCode : '');
      });
      return out;
    });
    const nameOf = id => (rows.find(r => r.empId === id) || {}).name || id;
    setSwapLog(log => q.filter(x => x.aId !== x.bId).map((x, i) => ({
      id: 'SW-' + (900 + log.length + i),
      aName: nameOf(x.aId),
      aDay: x.aDi,
      aCode: x.aCode,
      bName: nameOf(x.bId),
      bDay: x.bDi,
      bCode: x.bCode,
      mode: x.mode
    })).concat(log));
    setQueue([]);
    setSavedBatch(q.length + (q.length === 1 ? ' change saved' : ' changes saved'));
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setSavedBatch(null), 4200);
  };
  const save = (nextStatus, quiet) => {
    setBusy(true);
    return rosApi.put('/api/rosters', {
      dept,
      deptName: dept,
      year,
      month,
      grid,
      order: rows.map(r => r.empId),
      baseRevision: rev,
      rules: {
        cfg,
        off: en,
        custom,
        minMorning: {
          on: en.min !== false,
          value: cfg.minM,
          label: 'Minimum staff on morning duty',
          unit: 'per day'
        },
        minEvening: {
          on: en.min !== false,
          value: cfg.minE,
          label: 'Minimum staff on evening duty',
          unit: 'per day'
        },
        minNight: {
          on: en.min !== false,
          value: cfg.minN,
          label: 'Minimum staff on night duty',
          unit: 'per day'
        },
        maxConsecNight: {
          on: en.nights !== false,
          value: cfg.maxNights,
          label: 'Maximum consecutive night shifts',
          unit: 'per person'
        },
        leaveClash: {
          on: en.leave !== false,
          value: cfg.maxLeavePerDay,
          label: 'Maximum staff away on the same day',
          unit: 'per day'
        }
      },
      names: rows.reduce((m, r) => {
        if (r.empId) m[r.empId] = r.name || '';
        return m;
      }, {}),
      ...(nextStatus ? {
        status: nextStatus
      } : {}),
      preparedBy: sign['Prepared by'] !== '—' ? sign['Prepared by'] || '' : '',
      checkedBy: sign['Checked by'] !== '—' ? sign['Checked by'] || '' : ''
    }).then(r => {
      setBusy(false);
      if (r && r.ok) {
        setRev(r.roster && r.roster.revision || rev + 1);
        setStatus(r.roster && r.roster.status || nextStatus || status);
        setDirty(false);
        if (!quiet) rosToast(nextStatus === 'submitted' ? 'Roster submitted for approval.' : 'Roster saved.');
        if (onSaved) onSaved();
        return true;
      }
      if (r && r.conflict) setConflict(r.error || 'Someone else saved this roster.');
      if (r && r.locked) setStatus('approved');
      rosToast(r && r.error || 'Could not save.', 'error');
      return false;
    }).catch(() => {
      setBusy(false);
      rosToast('Could not reach the server — your changes are kept on this screen and will be retried.', 'error');
      if (quiet) setTimeout(() => setRetryTick(n => n + 1), 5000);
      return false;
    });
  };
  useEffect(() => {
    if (!dirty || loading || !canEdit) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      save(null, true);
    }, 1600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [grid, cfg, en, custom, sign, dirty, retryTick]);
  const saveRef = useRef(null);
  saveRef.current = save;
  const pendingRef = useRef(false);
  pendingRef.current = dirty && !loading && canEdit;
  useEffect(() => {
    const warn = e => {
      if (pendingRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      if (pendingRef.current) {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveRef.current(null, true);
      }
    };
  }, []);
  const setStatusRemote = (st, extra) => {
    const id = 'ros-' + String(dept).slice(0, 40) + '-' + year + '-' + String(month).padStart(2, '0');
    setBusy(true);
    return rosApi.post('/api/rosters/' + encodeURIComponent(id) + '/status', Object.assign({
      status: st
    }, extra || {})).then(r => {
      setBusy(false);
      if (r && r.ok) {
        setStatus(st);
        if (st === 'approved') setApprovedAt(new Date().toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        }));else setApprovedAt(null);
        rosToast(st === 'approved' ? 'Roster published and locked.' : 'Roster reopened for editing.');
        if (onSaved) onSaved();
        return true;
      }
      rosToast(r && r.error || 'Could not change the status.', 'error');
      return false;
    }).catch(() => {
      setBusy(false);
      return false;
    });
  };
  const publish = () => {
    if (!rosIsAdmin()) {
      rosToast('Only an administrator can publish the roster.', 'info');
      return;
    }
    if (locked) {
      setStatusRemote('draft');
      return;
    }
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    Promise.resolve(save('submitted', true)).then(ok => {
      if (ok !== false) setStatusRemote('approved');
    });
  };
  const ev = useMemo(() => rosEval(grid, rows, days, year, month, cfg, en, custom), [grid, rows, days, year, month, cfg, en, custom]);
  const totalViol = ev.totalViol;
  const monthLabel = R.MONTHS[month] + ' ' + year;
  const monShort = R.MONTHS[month].slice(0, 3);
  const dowOf = d => rosDow(year, month, d);
  const kpiVals = useMemo(() => {
    let shifts = 0,
      hours = 0,
      leave = 0;
    rows.forEach(x => {
      const row = grid[x.empId] || {};
      for (let d = 1; d <= days; d++) {
        const c = row[d];
        if (!c) continue;
        const b = R.bucketOf(c);
        if (b && b !== 'O') shifts++;
        hours += R.hoursOf(c);
        if (ROS_LEAVE_CODES.indexOf(c) >= 0 || c === 'PH') leave++;
      }
    });
    return {
      shifts,
      hours,
      leave
    };
  }, [grid, rows, days]);
  const usedCodes = useMemo(() => {
    const set = {};
    rows.forEach(x => {
      const row = grid[x.empId] || {};
      for (let d = 1; d <= days; d++) if (row[d]) set[row[d]] = 1;
    });
    const known = ROS_CODE_ORDER.filter(c => set[c]);
    Object.keys(set).forEach(c => {
      if (ROS_CODE_ORDER.indexOf(c) < 0) known.push(c);
    });
    return known;
  }, [grid, rows, days]);
  const onDutyOf = d => {
    let on = 0;
    rows.forEach(x => {
      const b = R.bucketOf(cellCode(x.empId, d));
      if (b && b !== 'O') on++;
    });
    return on;
  };
  const cellDown = (empId, d) => evn => {
    if (!canEdit) return;
    if (brush) {
      evn.preventDefault();
      push();
      setPainting(true);
      setCells(g => writeCell(g, empId, d, brush));
      return;
    }
    evn.preventDefault();
    setDrag({
      empId,
      d
    });
    setDragOver(null);
  };
  const cellOver = (empId, d) => () => {
    if (painting && brush) {
      setCells(g => writeCell(g, empId, d, brush));
      return;
    }
    if (drag) {
      const k = empId + '|' + d;
      if (dragOver !== k) setDragOver(k);
    }
  };
  const cellUp = (empId, name, d) => evn => {
    if (brush) return;
    if (!canEdit) {
      editBlocked();
      return;
    }
    if (drag && (drag.empId !== empId || drag.d !== d)) {
      const a = cellCode(drag.empId, drag.d),
        b2 = cellCode(empId, d);
      const src = drag;
      setQueue(q => [...q, {
        key: src.empId + '|' + src.d + '>' + empId + '|' + d + '|' + q.length,
        aId: src.empId,
        aDi: src.d,
        aCode: a,
        bId: empId,
        bDi: d,
        bCode: b2,
        mode: dragMode
      }]);
      setDrag(null);
      setDragOver(null);
      return;
    }
    const r = evn.currentTarget.getBoundingClientRect();
    setDrag(null);
    setDragOver(null);
    setPick({
      empId,
      name,
      d,
      x: r.left + r.width / 2,
      cellTop: r.top,
      cellBottom: r.bottom
    });
  };
  const paintStyle = (empId, d, c) => {
    const b = R.bucketOf(c) || '',
      col = rosBColor(b);
    const queued = queue.some(q => q.aId === empId && q.aDi === d || q.bId === empId && q.bDi === d);
    return {
      display: 'inline-grid',
      placeItems: 'center',
      width: 40,
      minWidth: 40,
      padding: '4px 2px',
      borderRadius: 6,
      cursor: brush ? 'crosshair' : 'pointer',
      userSelect: 'none',
      border: '1px solid ' + (c ? b === 'O' ? 'rgba(125,145,180,.3)' : col : 'rgba(125,145,180,.22)'),
      fontFamily: ROS_MONO,
      fontSize: 10,
      fontWeight: 700,
      color: c ? b === 'O' ? '#6c7a8c' : '#fff' : '#c4ccd6',
      background: c ? b === 'O' ? 'rgba(125,145,180,.16)' : 'linear-gradient(140deg,' + col + ',' + col + 'c4)' : 'rgba(255,255,255,.55)',
      outline: queued ? '2px dashed #0090ca' : 'none',
      outlineOffset: 1,
      boxShadow: dragOver === empId + '|' + d ? '0 0 0 2px #0090ca, 0 4px 14px rgba(0,144,202,.5)' : c && b !== 'O' ? '0 2px 7px ' + col + '4d, inset 0 1px 0 rgba(255,255,255,.28)' : 'none',
      opacity: drag && drag.empId === empId && drag.d === d ? .4 : 1,
      letterSpacing: .2
    };
  };
  const goRules = () => {
    if (view === 'month' || view === 'rules') {
      const el = document.querySelector('[data-rules]');
      if (el) el.scrollIntoView({
        block: 'center',
        behavior: 'smooth'
      });
    } else setView('rules');
  };
  if (loading) return React.createElement("div", {
    style: {
      display: 'grid',
      placeItems: 'center',
      height: '40vh',
      color: '#6c7a8c'
    }
  }, "Loading the roster\u2026");
  const retryBox = (title, detail, label, onClick) => React.createElement("div", {
    style: {
      display: 'grid',
      placeItems: 'center',
      height: '40vh',
      color: '#6c7a8c',
      textAlign: 'center',
      padding: 16
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      fontWeight: 700,
      color: '#b4232f',
      marginBottom: 6
    }
  }, title), React.createElement("div", {
    style: {
      fontSize: 12.5,
      marginBottom: 12,
      maxWidth: 520
    }
  }, detail), React.createElement("button", {
    className: "btn pri sm",
    onClick: onClick
  }, label)));
  if (loadError) return retryBox('The roster for ' + R.MONTHS[month] + ' ' + year + ' did not load.', loadError + ' Nothing is shown, so nothing can be saved over the stored roster.', 'Try again', () => setReloadKey(k => k + 1));
  if (conflict) return retryBox('Someone else saved this roster while you were editing.', conflict + ' Your last changes were not saved. Reload to see the current roster, then make them again.', 'Reload the month', () => setReloadKey(k => k + 1));
  const published = status === 'approved';
  const showGrid = view === 'month' || view === 'swap';
  const showFooter = view === 'month' || view === 'rules';
  const toolBtnStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: '1px solid rgba(255,255,255,.9)',
    background: 'rgba(255,255,255,.78)',
    color: '#3c4858',
    padding: '6px 12px',
    borderRadius: 9,
    fontSize: 10.5,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    boxShadow: '0 3px 10px rgba(31,59,90,.08)'
  };
  const brushPill = code => {
    const on = brush === code,
      col = rosBColor(R.bucketOf(code));
    return React.createElement("button", {
      key: code,
      onClick: () => setBrush(brush === code ? '' : code),
      title: code + ((R.BY_CODE[code] || {}).label ? ' — ' + R.BY_CODE[code].label : ''),
      style: {
        fontFamily: ROS_MONO,
        fontSize: 10.5,
        fontWeight: 700,
        padding: '5px 12px',
        borderRadius: 9,
        cursor: 'pointer',
        border: '1px solid ' + (on ? col : col + '40'),
        color: on ? '#fff' : col,
        background: on ? 'linear-gradient(135deg,' + col + ',' + col + 'cc)' : col + '14',
        boxShadow: on ? '0 6px 16px ' + col + '66, inset 0 1px 0 rgba(255,255,255,.3)' : 'none',
        transform: on ? 'translateY(-1px)' : 'none',
        transition: 'all .18s'
      }
    }, code);
  };
  return React.createElement("div", {
    style: {
      maxWidth: 1440,
      margin: '0 auto'
    }
  }, React.createElement("div", {
    style: {
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(140deg,rgba(255,255,255,.8),rgba(230,244,253,.52))',
      backdropFilter: 'blur(24px) saturate(1.7)',
      WebkitBackdropFilter: 'blur(24px) saturate(1.7)',
      border: '1px solid rgba(255,255,255,.92)',
      borderRadius: 18,
      boxShadow: '0 16px 44px rgba(31,59,90,.15),0 5px 18px rgba(0,144,202,.12),inset 0 1px 0 rgba(255,255,255,.95)',
      padding: '18px 22px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap',
      marginBottom: 14
    }
  }, React.createElement("div", {
    style: {
      position: 'absolute',
      right: -70,
      top: -80,
      width: 250,
      height: 230,
      borderRadius: '50%',
      background: 'radial-gradient(circle,rgba(0,144,202,.2),transparent 70%)',
      filter: 'blur(12px)',
      pointerEvents: 'none',
      animation: 'rosOrbFloat 18s ease-in-out infinite alternate'
    }
  }), React.createElement("span", {
    style: {
      position: 'relative',
      display: 'inline-grid',
      placeItems: 'center',
      width: 44,
      height: 44,
      borderRadius: 13,
      background: 'rgba(0,144,202,.16)',
      color: '#0072a3',
      flexShrink: 0,
      boxShadow: '0 0 20px rgba(0,144,202,.28)'
    }
  }, React.createElement(Ic, {
    d: "M3 5h18v16H3zM3 9h18M8 3v4M16 3v4M8 13h3M13 13h3M8 17h3M13 17h3",
    s: 21,
    sw: 1.9
  })), React.createElement("div", {
    style: {
      position: 'relative',
      minWidth: 210
    }
  }, React.createElement("div", {
    style: {
      fontSize: 17,
      fontWeight: 800,
      color: '#16202e',
      letterSpacing: -.2
    }
  }, "Duty roster \u2014 ", dept), React.createElement("div", {
    style: {
      fontSize: 12,
      color: '#6c7a8c',
      marginTop: 2
    }
  }, monthLabel, " \xB7 ", days, " days \xB7 ", rows.length, " staff \xB7 prepared by the nurse in-charge, approved by the CNS")), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      flexWrap: 'wrap'
    }
  }, React.createElement("select", {
    value: dept,
    onChange: e => setRoute({
      view: 'rosterGrid',
      dept: e.target.value,
      year,
      month
    }),
    style: {
      boxSizing: 'border-box',
      padding: '8px 11px',
      borderRadius: 9,
      border: '1px solid rgba(125,145,180,.35)',
      background: 'rgba(255,255,255,.8)',
      fontFamily: 'inherit',
      fontSize: 12,
      color: '#16202e',
      outline: 'none'
    }
  }, depts.map(d => React.createElement("option", {
    key: d,
    value: d
  }, d))), React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      padding: '6px 12px',
      borderRadius: 16,
      whiteSpace: 'nowrap',
      color: published ? '#157a43' : '#b5670a',
      background: published ? 'rgba(31,157,87,.13)' : 'rgba(224,138,30,.14)',
      border: '1px solid ' + (published ? 'rgba(31,157,87,.28)' : 'rgba(224,138,30,.3)')
    }
  }, published ? 'Published' : 'Draft'), React.createElement("button", {
    className: "ros-auto",
    onClick: autoFill,
    title: 'Lay ' + ROS_PATTERNS[0][1] + ' across the whole month, staggered nurse by nurse',
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      border: '1px solid rgba(106,82,212,.32)',
      background: 'rgba(106,82,212,.1)',
      color: '#5b45c4',
      padding: '9px 14px',
      borderRadius: 10,
      fontSize: 12,
      fontWeight: 700,
      cursor: 'pointer',
      fontFamily: 'inherit'
    }
  }, React.createElement(Ic, {
    d: "M13 2L4 14h7l-1 8 9-12h-7z",
    s: 14,
    sw: 2
  }), "Auto-draft"), React.createElement("button", {
    onClick: publish,
    disabled: busy,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      border: '1px solid rgba(255,255,255,.4)',
      background: published ? 'linear-gradient(135deg,#2fbf7f,#157a43)' : 'linear-gradient(135deg,#27a8db,#0072a3)',
      color: '#fff',
      padding: '9px 15px',
      borderRadius: 10,
      fontSize: 12,
      fontWeight: 700,
      cursor: 'pointer',
      fontFamily: 'inherit',
      boxShadow: '0 8px 22px rgba(0,144,202,.4)'
    }
  }, React.createElement(Ic, {
    d: "M4 12l5 5L20 6",
    s: 14,
    sw: 2.2
  }), published ? 'Published' : totalViol ? 'Publish anyway' : 'Send for approval'))), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
      gap: 12,
      marginBottom: 14
    }
  }, [{
    lbl: 'Staff rostered',
    val: String(rows.length),
    icd: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z',
    bg: 'rgba(0,144,202,.1)',
    c: '#0090ca'
  }, {
    lbl: 'Shifts assigned',
    val: String(kpiVals.shifts),
    icd: 'M3 5h18v16H3zM3 9h18',
    bg: 'rgba(58,181,167,.14)',
    c: '#2b9488'
  }, {
    lbl: 'Total hours',
    val: String(kpiVals.hours),
    icd: 'M12 8v4l3 3M12 2a10 10 0 100 20 10 10 0 000-20z',
    bg: 'rgba(106,82,212,.12)',
    c: '#5b45c4'
  }, {
    lbl: 'Leave days',
    val: String(kpiVals.leave),
    icd: 'M8 2v4M16 2v4M3 8h18M5 8v13h14V8',
    bg: 'rgba(224,138,30,.14)',
    c: '#b5670a'
  }, {
    lbl: 'Rule warnings',
    val: String(totalViol),
    icd: 'M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0zM12 9v4M12 17h.01',
    bg: totalViol ? 'rgba(210,58,82,.12)' : 'rgba(31,157,87,.13)',
    c: totalViol ? '#d23a52' : '#1f9d57'
  }].map(k => React.createElement("div", {
    key: k.lbl,
    className: "ros-kpi",
    style: {
      background: 'linear-gradient(152deg,rgba(255,255,255,.76),rgba(236,247,255,.46))',
      backdropFilter: 'blur(26px) saturate(1.75)',
      WebkitBackdropFilter: 'blur(26px) saturate(1.75)',
      border: '1px solid rgba(255,255,255,.92)',
      borderRadius: 15,
      boxShadow: '0 12px 36px rgba(31,59,90,.12),inset 0 1px 0 rgba(255,255,255,.95)',
      padding: '13px 15px',
      transition: 'transform .2s,box-shadow .25s'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, React.createElement("span", {
    style: {
      display: 'inline-grid',
      placeItems: 'center',
      width: 34,
      height: 34,
      borderRadius: 10,
      background: k.bg,
      color: k.c,
      flexShrink: 0
    }
  }, React.createElement(Ic, {
    d: k.icd,
    s: 16,
    sw: 1.9
  })), React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontFamily: ROS_MONO,
      fontSize: 19,
      fontWeight: 700,
      color: '#16202e',
      lineHeight: 1.15
    }
  }, k.val), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: '#6c7a8c',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, k.lbl)))))), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14,
      flexWrap: 'wrap'
    }
  }, React.createElement("div", {
    style: {
      display: 'inline-flex',
      background: 'rgba(255,255,255,.55)',
      border: '1px solid rgba(255,255,255,.9)',
      borderRadius: 11,
      padding: 3,
      gap: 2,
      boxShadow: '0 6px 18px rgba(31,59,90,.1)',
      flexWrap: 'wrap'
    }
  }, ROS_VIEW_TABS.map(([v, label, icd]) => React.createElement("button", {
    key: v,
    onClick: () => setView(v),
    style: rosTab(view === v)
  }, React.createElement(Ic, {
    d: icd,
    s: 13,
    sw: 2
  }), label))), React.createElement("div", {
    style: {
      flex: 1
    }
  }), totalViol > 0 && React.createElement("span", {
    className: "ros-vio",
    onClick: goRules,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 11.5,
      fontWeight: 700,
      color: '#a92c42',
      background: 'rgba(210,58,82,.12)',
      border: '1px solid rgba(210,58,82,.28)',
      padding: '6px 12px',
      borderRadius: 16,
      cursor: 'pointer'
    }
  }, React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: '#d23a52'
    }
  }), totalViol, " rule warnings")), showGrid && React.createElement("div", {
    style: {
      background: 'linear-gradient(152deg,rgba(255,255,255,.78),rgba(236,247,255,.48))',
      backdropFilter: 'blur(26px) saturate(1.75)',
      WebkitBackdropFilter: 'blur(26px) saturate(1.75)',
      border: '1px solid rgba(255,255,255,.92)',
      borderRadius: 16,
      boxShadow: '0 14px 42px rgba(31,59,90,.14),inset 0 1px 0 rgba(255,255,255,.95)',
      overflow: 'hidden',
      marginBottom: 14
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      padding: '12px 16px',
      borderBottom: '1px solid rgba(125,145,180,.18)',
      flexWrap: 'wrap'
    }
  }, React.createElement("h3", {
    style: ROS_H3
  }, "Monthly grid"), React.createElement("span", {
    style: {
      fontSize: 11,
      color: '#9aa6b4'
    }
  }, "click a cell to pick \xB7 drag a shift onto another to swap \xB7 paint with a brush"), React.createElement("span", {
    style: {
      flex: 1
    }
  }), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap',
      alignItems: 'center'
    }
  }, ROS_BUCKETS.concat([['O', 'Leave / off', '#8b98ab', '']]).map(([b, label, c]) => React.createElement("span", {
    key: b,
    style: {
      fontSize: 10,
      fontWeight: 700,
      padding: '2px 9px',
      borderRadius: 10,
      color: c,
      background: c + '18',
      whiteSpace: 'nowrap'
    }
  }, label)), React.createElement("button", {
    onClick: () => setLegendOpen(v => !v),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      border: '1px solid ' + (legendOpen ? 'rgba(0,144,202,.35)' : 'rgba(125,145,180,.3)'),
      background: legendOpen ? 'rgba(0,144,202,.1)' : 'rgba(255,255,255,.65)',
      color: legendOpen ? '#0072a3' : '#3c4858',
      padding: '5px 11px',
      borderRadius: 9,
      fontSize: 10.5,
      fontWeight: 700,
      cursor: 'pointer',
      fontFamily: 'inherit',
      whiteSpace: 'nowrap',
      transition: 'all .2s'
    }
  }, React.createElement(Ic, {
    d: "M4 19V5a2 2 0 012-2h13v18H6a2 2 0 01-2-2zM8 7h8M8 11h8",
    s: 12,
    sw: 2
  }), legendOpen ? 'Hide legend' : 'Shift legend'))), React.createElement("div", {
    style: {
      padding: '10px 16px',
      borderBottom: '1px solid rgba(125,145,180,.18)',
      background: 'linear-gradient(180deg,rgba(233,243,252,.7),rgba(255,255,255,.45))',
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      flexWrap: 'wrap'
    }
  }, React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 9.5,
      fontWeight: 800,
      letterSpacing: .8,
      textTransform: 'uppercase',
      color: '#7d8ea8',
      flexShrink: 0
    }
  }, React.createElement(Ic, {
    d: "M18 3l3 3-9 9-3-3zM6 15l-3 6 6-3M9 12l3 3",
    s: 13,
    sw: 1.9
  }), "Brush"), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 5,
      flexWrap: 'wrap'
    }
  }, ROS_QUICK_BRUSH.map(brushPill), brush && ROS_QUICK_BRUSH.indexOf(brush) < 0 && brushPill(brush)), React.createElement("button", {
    onClick: () => setBrushAll(v => !v),
    title: "Every shift & leave code in the legend, grouped by shift type",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      border: '1px solid ' + (brushAll ? 'rgba(0,144,202,.35)' : 'rgba(125,145,180,.3)'),
      background: brushAll ? 'rgba(0,144,202,.1)' : 'rgba(255,255,255,.65)',
      color: brushAll ? '#0072a3' : '#3c4858',
      padding: '5px 11px',
      borderRadius: 9,
      fontSize: 10.5,
      fontWeight: 700,
      cursor: 'pointer',
      fontFamily: 'inherit',
      whiteSpace: 'nowrap',
      transition: 'all .2s'
    }
  }, "All codes ", brushAll ? '▴' : '▾'), React.createElement("span", {
    style: {
      fontSize: 10.5,
      fontWeight: 600,
      color: brush ? '#0072a3' : '#9aa6b4',
      background: brush ? 'rgba(0,144,202,.1)' : 'transparent',
      border: '1px solid ' + (brush ? 'rgba(0,144,202,.24)' : 'transparent'),
      padding: brush ? '4px 11px' : 0,
      borderRadius: 12,
      whiteSpace: 'nowrap'
    }
  }, brush ? 'Click or drag across cells to paint ' + brush : 'Pick a code to paint, or click a cell to choose'), React.createElement("span", {
    style: {
      flex: 1
    }
  }), React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0
    }
  }, React.createElement("span", {
    style: {
      fontSize: 9.5,
      fontWeight: 800,
      letterSpacing: .8,
      textTransform: 'uppercase',
      color: '#7d8ea8'
    }
  }, "Drag"), React.createElement("div", {
    style: {
      display: 'inline-flex',
      background: 'rgba(255,255,255,.65)',
      border: '1px solid rgba(255,255,255,.95)',
      borderRadius: 9,
      padding: 3,
      gap: 2
    }
  }, [['swap', 'Swap', 'Exchange the two shifts'], ['move', 'Move', 'Move the shift and clear the original']].map(([v, label, title]) => {
    const on = dragMode === v;
    return React.createElement("button", {
      key: v,
      onClick: () => setDragMode(v),
      title: title,
      style: {
        border: 0,
        background: on ? 'linear-gradient(135deg,#27a8db,#0072a3)' : 'transparent',
        color: on ? '#fff' : '#6c7a8c',
        padding: '5px 12px',
        borderRadius: 7,
        fontSize: 10.5,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all .18s',
        boxShadow: on ? '0 4px 11px rgba(0,144,202,.35)' : 'none'
      }
    }, label);
  }))), React.createElement("button", {
    onClick: copyWeek,
    title: "Copy the previous week into this one",
    style: toolBtnStyle
  }, React.createElement(Ic, {
    d: "M8 4h10v12M4 8h10v12H4z",
    s: 12,
    sw: 2
  }), "Repeat last week"), React.createElement("button", {
    onClick: fillBlanks,
    title: "Fill every empty cell with OFF",
    style: toolBtnStyle
  }, React.createElement(Ic, {
    d: "M4 12l5 5L20 6",
    s: 12,
    sw: 2
  }), "Fill blanks OFF"), React.createElement("button", {
    onClick: undo,
    title: "Undo last change",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      border: '1px solid ' + (history.current.length ? 'rgba(0,144,202,.32)' : 'rgba(125,145,180,.24)'),
      background: history.current.length ? 'rgba(0,144,202,.1)' : 'rgba(255,255,255,.5)',
      color: history.current.length ? '#0072a3' : '#b6c0cc',
      padding: '6px 12px',
      borderRadius: 9,
      fontSize: 10.5,
      fontWeight: 700,
      cursor: history.current.length ? 'pointer' : 'default',
      fontFamily: 'inherit',
      whiteSpace: 'nowrap',
      flexShrink: 0
    }
  }, React.createElement(Ic, {
    d: "M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3",
    s: 12,
    sw: 2.2
  }), "Undo")), brushAll && React.createElement("div", {
    style: {
      padding: '10px 16px 12px',
      borderBottom: '1px solid rgba(125,145,180,.18)',
      background: 'rgba(247,251,255,.6)',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, [['G', 'General', '#6a52d4'], ['M', 'Morning', '#e08a1e'], ['E', 'Evening', '#0090ca'], ['N', 'Night', '#5b45c4'], ['O', 'Leave / off', '#8b98ab']].map(([b, label, c]) => {
    const codes = R.SHIFTS.filter(s => s.bucket === b).map(s => s.code);
    if (!codes.length) return null;
    return React.createElement("div", {
      key: b,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        flexWrap: 'wrap'
      }
    }, React.createElement("span", {
      style: {
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: .8,
        textTransform: 'uppercase',
        color: c,
        width: 78,
        flexShrink: 0
      }
    }, label), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 5,
        flexWrap: 'wrap'
      }
    }, codes.map(brushPill)));
  }), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: '#9aa6b4'
    }
  }, "Hover a code for its hours \xB7 picking one makes it the active brush \u2014 then click or drag across cells, or click a day heading to paint the whole column.")), legendOpen && React.createElement(RosLegendPanel, null), React.createElement("div", {
    style: {
      overflowX: 'auto'
    }
  }, rows.length === 0 ? React.createElement("div", {
    style: {
      padding: 34,
      textAlign: 'center',
      color: '#6c7a8c'
    }
  }, "No active staff are assigned to ", dept, ".") : React.createElement("table", {
    style: {
      borderCollapse: 'collapse',
      fontSize: 11.5,
      minWidth: 1180
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: {
      position: 'sticky',
      left: 0,
      zIndex: 2,
      background: 'linear-gradient(180deg,#f6fafe,#e9f1fa)',
      textAlign: 'left',
      padding: '8px 10px',
      fontSize: 9.5,
      letterSpacing: .5,
      textTransform: 'uppercase',
      color: '#7d8ea8',
      borderBottom: '1px solid rgba(125,145,180,.28)',
      borderRight: '1px solid rgba(125,145,180,.2)',
      minWidth: 190
    }
  }, "S/N \xB7 Emp-ID \xB7 Staff name \xB7 Designation"), Array.from({
    length: days
  }, (_, k) => k + 1).map(d => {
    const fri = rosIsFri(year, month, d);
    return React.createElement("th", {
      key: d,
      onClick: () => fillCol(d),
      title: canEdit ? brush ? 'Fill ' + R.MONTHS[month] + ' ' + d + ' with ' + brush + ' for every nurse' : 'Pick a brush code, then click a day heading to fill that whole column' : '',
      style: {
        padding: '6px 3px',
        textAlign: 'center',
        minWidth: 42,
        borderBottom: '1px solid rgba(125,145,180,.28)',
        background: fri ? 'rgba(0,144,202,.07)' : 'rgba(240,246,252,.9)',
        cursor: canEdit ? 'pointer' : 'default'
      }
    }, React.createElement("div", {
      style: {
        fontSize: 8.5,
        color: '#9aa6b4'
      }
    }, dowOf(d)), React.createElement("div", {
      style: {
        fontFamily: ROS_MONO,
        fontSize: 10.5,
        fontWeight: 700,
        color: '#3c4858'
      }
    }, d, "-", monShort));
  }), [['G', 26], ['M', 26], ['E', 26], ['N', 26], ['O', 26], ['Hours', 44]].map(([label, w], i, arr) => {
    const right = arr.slice(i + 1).reduce((a, x) => a + x[1], 0);
    return React.createElement("th", {
      key: label,
      style: {
        position: 'sticky',
        right,
        zIndex: 3,
        width: w,
        minWidth: w,
        padding: '5px 2px',
        textAlign: 'center',
        fontSize: 9,
        fontWeight: 800,
        color: '#7d8ea8',
        borderBottom: '1px solid rgba(125,145,180,.28)',
        borderLeft: label === 'G' ? '1px solid rgba(125,145,180,.25)' : 'none',
        background: 'linear-gradient(180deg,#f6fafe,#e9f1fa)',
        whiteSpace: 'nowrap'
      }
    }, label);
  }))), React.createElement("tbody", null, rows.map((x, si) => {
    const rowG = grid[x.empId] || {};
    const counts = {
      G: 0,
      M: 0,
      E: 0,
      N: 0,
      O: 0
    };
    let hrs = 0;
    for (let d = 1; d <= days; d++) {
      const c = rowG[d];
      const b = R.bucketOf(c);
      if (b) counts[b]++;
      hrs += R.hoursOf(c);
    }
    return React.createElement("tr", {
      key: x.empId,
      className: "ros-trow",
      style: {
        background: si % 2 ? 'rgba(244,249,254,.5)' : 'transparent',
        transition: 'background .15s'
      }
    }, React.createElement("td", {
      style: {
        position: 'sticky',
        left: 0,
        zIndex: 1,
        background: 'rgba(250,252,255,.98)',
        padding: '4px 9px',
        borderBottom: '1px solid rgba(125,145,180,.14)',
        borderRight: '1px solid rgba(125,145,180,.2)'
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, React.createElement(MK.Av, {
      name: x.name,
      empId: x.empId,
      size: 28,
      radius: rosAvRadius(28)
    }), React.createElement("div", {
      style: {
        minWidth: 0,
        flex: 1
      }
    }, React.createElement("div", {
      style: {
        fontSize: 12,
        fontWeight: 600,
        color: '#16202e',
        whiteSpace: 'nowrap'
      }
    }, x.name), React.createElement("div", {
      style: {
        fontSize: 9.5,
        color: '#9aa6b4',
        whiteSpace: 'nowrap'
      }
    }, React.createElement("span", {
      style: {
        fontFamily: ROS_MONO
      }
    }, x.empIdShown || '—'), " \xB7 ", x.desig || '—')), React.createElement("select", {
      value: "",
      title: "Row tools",
      onChange: e => {
        const v = e.target.value;
        e.target.value = '';
        rowTool(x.empId, v);
      },
      style: {
        width: 26,
        height: 24,
        flexShrink: 0,
        boxSizing: 'border-box',
        padding: '0 2px',
        borderRadius: 7,
        border: '1px solid rgba(125,145,180,.28)',
        background: 'rgba(255,255,255,.7)',
        fontFamily: 'inherit',
        fontSize: 10,
        color: '#6c7a8c',
        cursor: 'pointer',
        appearance: 'none',
        WebkitAppearance: 'none',
        textAlign: 'center',
        textAlignLast: 'center'
      }
    }, React.createElement("option", {
      value: ""
    }, "\u22EF"), ROS_PATTERNS.map(p => React.createElement("option", {
      key: p[0],
      value: p[0]
    }, p[1])), React.createElement("option", {
      value: "blanks"
    }, "Fill blanks OFF"), React.createElement("option", {
      value: "clear"
    }, "Clear row")))), Array.from({
      length: days
    }, (_, k) => k + 1).map(d => {
      const c = rowG[d] || '';
      const sh = R.BY_CODE[c];
      return React.createElement("td", {
        key: d,
        style: {
          padding: 2,
          textAlign: 'center',
          borderBottom: '1px solid rgba(125,145,180,.14)',
          background: rosIsFri(year, month, d) ? 'rgba(224,138,30,.09)' : 'transparent'
        }
      }, React.createElement("span", {
        onMouseDown: cellDown(x.empId, d),
        onMouseEnter: cellOver(x.empId, d),
        onMouseUp: cellUp(x.empId, x.name, d),
        title: c ? c + ' — ' + (sh ? sh.label : '') + (sh && sh.hours ? ' · ' + sh.hours + ' h' : '') : 'Click to assign a shift',
        style: paintStyle(x.empId, d, c)
      }, c || '·'));
    }), ['G', 'M', 'E', 'N', 'O'].map((b, i) => React.createElement("td", {
      key: b,
      style: {
        position: 'sticky',
        right: (4 - i) * 26 + 44,
        zIndex: 1,
        width: 26,
        minWidth: 26,
        padding: '3px 2px',
        textAlign: 'center',
        fontFamily: ROS_MONO,
        fontSize: 10.5,
        fontWeight: 700,
        color: counts[b] ? rosBColor(b) : '#c4ccd6',
        borderBottom: '1px solid rgba(125,145,180,.14)',
        borderLeft: b === 'G' ? '1px solid rgba(125,145,180,.25)' : 'none',
        background: 'rgba(247,250,254,.98)'
      }
    }, counts[b])), React.createElement("td", {
      style: {
        position: 'sticky',
        right: 0,
        zIndex: 1,
        width: 44,
        minWidth: 44,
        padding: '3px 6px',
        textAlign: 'right',
        fontFamily: ROS_MONO,
        fontSize: 10.5,
        fontWeight: 800,
        color: hrs > 200 ? '#a92c42' : '#16202e',
        borderBottom: '1px solid rgba(125,145,180,.14)',
        background: 'rgba(247,250,254,.98)',
        whiteSpace: 'nowrap'
      }
    }, hrs));
  }), React.createElement("tr", null, React.createElement("td", {
    colSpan: 99,
    style: {
      padding: '8px 12px',
      background: 'linear-gradient(90deg,rgba(0,144,202,.12),rgba(58,181,167,.06))',
      borderTop: '2px solid rgba(0,144,202,.28)',
      borderBottom: '1px solid rgba(125,145,180,.2)',
      fontSize: 9.5,
      fontWeight: 800,
      letterSpacing: .7,
      textTransform: 'uppercase',
      color: '#7d8ea8'
    }
  }, "Staff on each shift, per day")), usedCodes.map(code => {
    const b = R.bucketOf(code),
      col = rosBColor(b);
    let tot = 0;
    const cells = Array.from({
      length: days
    }, (_, k) => {
      const d = k + 1;
      let n = 0;
      rows.forEach(x => {
        if ((grid[x.empId] || {})[d] === code) n++;
      });
      tot += n;
      return {
        d,
        n
      };
    });
    const sh = R.BY_CODE[code];
    return React.createElement("tr", {
      key: code
    }, React.createElement("td", {
      style: {
        position: 'sticky',
        left: 0,
        zIndex: 1,
        whiteSpace: 'nowrap',
        padding: '5px 10px',
        textAlign: 'right',
        fontSize: 10.5,
        fontWeight: 700,
        color: col,
        background: '#f2f7fc',
        borderRight: '1px solid rgba(125,145,180,.2)',
        borderBottom: '1px solid rgba(125,145,180,.1)'
      }
    }, code, sh ? ' (' + sh.label.replace(/:00/g, '').replace(/ - /g, '-').replace(/ /g, '') + ')' : ''), cells.map(c2 => React.createElement("td", {
      key: c2.d,
      style: {
        padding: '5px 3px',
        textAlign: 'center',
        fontFamily: ROS_MONO,
        fontSize: 10.5,
        fontWeight: 700,
        color: c2.n ? col : '#dbe2ea',
        background: c2.n ? col + '14' : 'transparent',
        borderBottom: '1px solid rgba(125,145,180,.1)'
      }
    }, c2.n || '')), React.createElement("td", {
      colSpan: 6,
      style: {
        position: 'sticky',
        right: 0,
        zIndex: 2,
        width: 174,
        minWidth: 174,
        padding: '5px 8px',
        textAlign: 'right',
        fontFamily: ROS_MONO,
        fontSize: 10.5,
        fontWeight: 800,
        color: col,
        background: '#f2f7fc',
        borderLeft: '1px solid rgba(125,145,180,.25)',
        borderBottom: '1px solid rgba(125,145,180,.1)'
      }
    }, tot));
  }), React.createElement("tr", {
    style: {
      background: 'linear-gradient(90deg,rgba(13,28,50,.06),rgba(13,28,50,.03))'
    }
  }, React.createElement("td", {
    style: {
      position: 'sticky',
      left: 0,
      zIndex: 1,
      background: 'rgba(238,243,250,.98)',
      padding: '8px 10px',
      fontSize: 9.5,
      fontWeight: 800,
      letterSpacing: .5,
      textTransform: 'uppercase',
      color: '#7d8ea8',
      borderRight: '1px solid rgba(125,145,180,.2)'
    }
  }, "On duty / day"), Array.from({
    length: days
  }, (_, k) => k + 1).map(d => {
    const on = onDutyOf(d);
    const closed = !!ev.closedDays[d];
    const c = closed ? '#8b98ab' : on >= 5 ? '#157a43' : on >= 4 ? '#0072a3' : on >= 3 ? '#b5670a' : '#a92c42';
    return React.createElement("td", {
      key: d,
      title: closed ? 'Unit off day — everyone rostered off' : on + ' on duty on day ' + d,
      style: {
        padding: '7px 3px',
        textAlign: 'center',
        fontFamily: ROS_MONO,
        fontSize: 11,
        fontWeight: 800,
        color: c,
        background: c + '1f'
      }
    }, closed ? 'off' : on);
  }), React.createElement("td", {
    colSpan: 6,
    style: {
      position: 'sticky',
      right: 0,
      zIndex: 2,
      width: 174,
      minWidth: 174,
      padding: '5px 6px',
      fontSize: 9,
      color: '#9aa6b4',
      textAlign: 'right',
      background: 'rgba(238,243,250,.98)',
      borderLeft: '1px solid rgba(125,145,180,.25)'
    }
  }, "low = red")))))), view === 'week' && (() => {
    const weeks = Math.max(1, Math.ceil(days / 7));
    const w = Math.min(week, weeks - 1);
    const first = w * 7 + 1,
      last = Math.min(days, first + 6);
    return React.createElement("div", {
      style: {
        marginBottom: 14
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
        flexWrap: 'wrap'
      }
    }, React.createElement("div", {
      style: {
        display: 'inline-flex',
        background: 'rgba(255,255,255,.55)',
        border: '1px solid rgba(255,255,255,.9)',
        borderRadius: 10,
        padding: 3,
        gap: 2
      }
    }, Array.from({
      length: weeks
    }, (_, i) => React.createElement("button", {
      key: i,
      onClick: () => setWeek(i),
      style: rosTab(i === w)
    }, "Week ", i + 1))), React.createElement("span", {
      style: {
        fontSize: 11.5,
        color: '#6c7a8c'
      }
    }, "Days ", first, "\u2013", last, " of ", monthLabel)), React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
        gap: 12
      }
    }, Array.from({
      length: last - first + 1
    }, (_, i) => first + i).map(d => {
      const fri = rosIsFri(year, month, d);
      return React.createElement("div", {
        key: d,
        style: {
          background: 'linear-gradient(152deg,rgba(255,255,255,.78),rgba(236,247,255,.48))',
          backdropFilter: 'blur(24px) saturate(1.7)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.7)',
          border: '1px solid rgba(255,255,255,.92)',
          borderRadius: 14,
          boxShadow: '0 12px 34px rgba(31,59,90,.12),inset 0 1px 0 rgba(255,255,255,.95)',
          overflow: 'hidden'
        }
      }, React.createElement("div", {
        style: {
          padding: '9px 11px',
          background: fri ? 'linear-gradient(135deg,#27a8db,#0072a3)' : 'linear-gradient(135deg,rgba(13,28,50,.92),rgba(8,17,32,.88))',
          color: '#fff'
        }
      }, React.createElement("div", {
        style: {
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: .6,
          textTransform: 'uppercase',
          opacity: .85
        }
      }, dowOf(d)), React.createElement("div", {
        style: {
          fontFamily: ROS_MONO,
          fontSize: 16,
          fontWeight: 800
        }
      }, d)), React.createElement("div", {
        style: {
          padding: '9px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }
      }, ROS_BUCKETS.map(([b, label, col]) => {
        const people = [];
        rows.forEach(x => {
          const c = cellCode(x.empId, d);
          if (R.bucketOf(c) === b) people.push({
            name: x.name,
            code: c
          });
        });
        const short = people.length < 2 && b !== 'G';
        return React.createElement("div", {
          key: b
        }, React.createElement("div", {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 4
          }
        }, React.createElement("span", {
          style: {
            width: 8,
            height: 8,
            borderRadius: 3,
            background: col,
            flexShrink: 0
          }
        }), React.createElement("span", {
          style: {
            fontSize: 9.5,
            fontWeight: 800,
            letterSpacing: .5,
            textTransform: 'uppercase',
            color: '#7d8ea8'
          }
        }, label), React.createElement("span", {
          style: {
            flex: 1
          }
        }), React.createElement("span", {
          style: {
            fontFamily: ROS_MONO,
            fontSize: 9.5,
            fontWeight: 700,
            color: short ? '#a92c42' : '#6c7a8c',
            background: short ? 'rgba(210,58,82,.12)' : 'rgba(125,145,180,.14)',
            padding: '1px 6px',
            borderRadius: 8
          }
        }, people.length)), React.createElement("div", {
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: 3
          }
        }, people.map((p, i) => React.createElement("div", {
          key: i,
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: '#3c4858'
          }
        }, React.createElement("span", {
          style: {
            fontFamily: ROS_MONO,
            fontSize: 9.5,
            fontWeight: 700,
            color: '#fff',
            background: col,
            padding: '1px 5px',
            borderRadius: 5,
            flexShrink: 0
          }
        }, p.code), React.createElement("span", {
          style: {
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }
        }, p.name)))));
      })));
    })));
  })(), view === 'day' && (() => {
    const d = Math.min(Math.max(1, day), days);
    const on = onDutyOf(d);
    const covC = on >= 4 ? '#157a43' : '#a92c42';
    const arrow = {
      width: 32,
      height: 32,
      borderRadius: 9,
      border: '1px solid rgba(125,145,180,.3)',
      background: 'rgba(255,255,255,.7)',
      color: '#3c4858',
      cursor: 'pointer',
      display: 'grid',
      placeItems: 'center'
    };
    return React.createElement("div", {
      style: {
        marginBottom: 14
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        marginBottom: 12,
        flexWrap: 'wrap'
      }
    }, React.createElement("button", {
      className: "ros-navbtn",
      onClick: () => setDay(Math.max(1, d - 1)),
      style: arrow
    }, React.createElement(Ic, {
      d: "M9 6l6 6-6 6",
      s: 14,
      sw: 2.2,
      style: {
        transform: 'rotate(180deg)'
      }
    })), React.createElement("div", {
      style: {
        fontSize: 15,
        fontWeight: 800,
        color: '#16202e'
      }
    }, "Day ", d, " \xB7 ", dowOf(d), " \xB7 ", monthLabel), React.createElement("button", {
      className: "ros-navbtn",
      onClick: () => setDay(Math.min(days, d + 1)),
      style: arrow
    }, React.createElement(Ic, {
      d: "M9 6l6 6-6 6",
      s: 14,
      sw: 2.2
    })), React.createElement("span", {
      style: {
        fontSize: 11.5,
        fontWeight: 700,
        color: covC,
        background: covC + '16',
        padding: '6px 12px',
        borderRadius: 16,
        whiteSpace: 'nowrap'
      }
    }, on, " of ", rows.length, " on duty")), React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
        gap: 13
      }
    }, ROS_BUCKETS.map(([b, label, col, icd]) => {
      const people = [];
      rows.forEach(x => {
        const c = cellCode(x.empId, d);
        if (R.bucketOf(c) === b) people.push({
          x,
          c
        });
      });
      return React.createElement("div", {
        key: b,
        style: {
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(152deg,rgba(255,255,255,.78),rgba(236,247,255,.48))',
          backdropFilter: 'blur(24px) saturate(1.7)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.7)',
          border: '1px solid rgba(255,255,255,.92)',
          borderRadius: 15,
          boxShadow: '0 12px 36px rgba(31,59,90,.12),inset 0 1px 0 rgba(255,255,255,.95)'
        }
      }, React.createElement("div", {
        style: {
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 5,
          background: 'linear-gradient(180deg,' + col + ',' + col + '55)'
        }
      }), React.createElement("div", {
        style: {
          padding: '13px 15px 13px 20px'
        }
      }, React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          marginBottom: 10
        }
      }, React.createElement("span", {
        style: {
          display: 'inline-grid',
          placeItems: 'center',
          width: 30,
          height: 30,
          borderRadius: 9,
          background: col + '18',
          color: col,
          flexShrink: 0
        }
      }, React.createElement(Ic, {
        d: icd,
        s: 15,
        sw: 1.9
      })), React.createElement("div", null, React.createElement("div", {
        style: {
          fontSize: 13,
          fontWeight: 700,
          color: '#16202e'
        }
      }, label), React.createElement("div", {
        style: {
          fontSize: 10.5,
          color: '#9aa6b4'
        }
      }, ROS_WINDOWS[b])), React.createElement("span", {
        style: {
          flex: 1
        }
      }), React.createElement("span", {
        style: {
          fontFamily: ROS_MONO,
          fontSize: 12,
          fontWeight: 800,
          color: people.length ? col : '#a92c42',
          background: people.length ? col + '16' : 'rgba(210,58,82,.12)',
          padding: '2px 9px',
          borderRadius: 10
        }
      }, people.length)), React.createElement("div", {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: 6
        }
      }, people.map(p => React.createElement("div", {
        key: p.x.empId,
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          background: 'rgba(255,255,255,.6)',
          border: '1px solid rgba(255,255,255,.9)',
          borderRadius: 10,
          padding: '7px 10px'
        }
      }, React.createElement(MK.Av, {
        name: p.x.name,
        empId: p.x.empId,
        size: 30,
        radius: rosAvRadius(30)
      }), React.createElement("div", {
        style: {
          minWidth: 0,
          flex: 1
        }
      }, React.createElement("div", {
        style: {
          fontSize: 12,
          fontWeight: 600,
          color: '#16202e',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }
      }, p.x.name), React.createElement("div", {
        style: {
          fontSize: 10,
          color: '#9aa6b4'
        }
      }, p.x.desig || '—')), React.createElement("span", {
        style: {
          fontFamily: ROS_MONO,
          fontSize: 10,
          fontWeight: 700,
          color: '#fff',
          background: col,
          padding: '2px 7px',
          borderRadius: 6,
          flexShrink: 0
        }
      }, p.c))), people.length === 0 && React.createElement("div", {
        style: {
          fontSize: 11.5,
          color: '#a92c42',
          background: 'rgba(210,58,82,.09)',
          borderRadius: 9,
          padding: '8px 10px'
        }
      }, "No one rostered \u2014 this shift is uncovered."))));
    })));
  })(), view === 'staff' && React.createElement("div", {
    style: {
      marginBottom: 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, rows.map(x => {
    const rowG = grid[x.empId] || {};
    const counts = {
      G: 0,
      M: 0,
      E: 0,
      N: 0,
      O: 0
    };
    let hrs = 0;
    for (let d = 1; d <= days; d++) {
      const c = rowG[d];
      const b = R.bucketOf(c);
      if (b) counts[b]++;
      hrs += R.hoursOf(c);
    }
    const chips = [['G ' + counts.G, '#6a52d4'], ['M ' + counts.M, '#e08a1e'], ['E ' + counts.E, '#0090ca'], ['N ' + counts.N, '#5b45c4'], ['Off ' + counts.O, '#8b98ab'], [hrs + ' h', hrs > 200 ? '#a92c42' : '#157a43']];
    return React.createElement("div", {
      key: x.empId,
      style: {
        background: 'linear-gradient(152deg,rgba(255,255,255,.78),rgba(236,247,255,.48))',
        backdropFilter: 'blur(24px) saturate(1.7)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.7)',
        border: '1px solid rgba(255,255,255,.92)',
        borderRadius: 15,
        boxShadow: '0 12px 36px rgba(31,59,90,.12),inset 0 1px 0 rgba(255,255,255,.95)',
        padding: '13px 16px'
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        marginBottom: 10
      }
    }, React.createElement(MK.Av, {
      name: x.name,
      empId: x.empId,
      size: 34,
      radius: rosAvRadius(34)
    }), React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 700,
        color: '#16202e'
      }
    }, x.name), React.createElement("div", {
      style: {
        fontSize: 10.5,
        color: '#9aa6b4'
      }
    }, React.createElement("span", {
      style: {
        fontFamily: ROS_MONO
      }
    }, x.empIdShown || '—'), " \xB7 ", x.desig || '—')), React.createElement("span", {
      style: {
        flex: 1
      }
    }), chips.map(([label, c]) => React.createElement("span", {
      key: label,
      style: {
        fontFamily: ROS_MONO,
        fontSize: 10,
        fontWeight: 700,
        color: c,
        background: c + '16',
        padding: '3px 9px',
        borderRadius: 10,
        whiteSpace: 'nowrap'
      }
    }, label))), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 2,
        flexWrap: 'wrap'
      }
    }, Array.from({
      length: days
    }, (_, k) => k + 1).map(d => {
      const c = rowG[d] || '';
      const b = R.bucketOf(c),
        col = rosBColor(b);
      return React.createElement("span", {
        key: d,
        title: 'Day ' + d + ' · ' + (c || 'not assigned'),
        style: {
          display: 'inline-grid',
          placeItems: 'center',
          width: 22,
          height: 24,
          borderRadius: 5,
          fontFamily: ROS_MONO,
          fontSize: 9.5,
          fontWeight: 700,
          color: b === 'O' ? '#6c7a8c' : '#fff',
          background: b === 'O' ? 'rgba(125,145,180,.2)' : col,
          opacity: b ? 1 : .3
        }
      }, c ? c.replace(/[^A-Z]/g, '').slice(0, 1) || c[0] : '·');
    })));
  }), rows.length === 0 && React.createElement("div", {
    style: {
      ...ROS_CARD15,
      padding: 30,
      textAlign: 'center',
      color: '#6c7a8c'
    }
  }, "No active staff are assigned to ", dept, ".")), view === 'leave' && (() => {
    let off = 0,
      paid = 0,
      ph = 0;
    const perNurse = [];
    rows.forEach(x => {
      let n = 0;
      for (let d = 1; d <= days; d++) {
        const c = cellCode(x.empId, d);
        if (c === 'OFF' || c === 'DO') {
          off++;
          n++;
        } else if (ROS_LEAVE_CODES.indexOf(c) >= 0) {
          paid++;
          n++;
        } else if (c === 'PH') {
          ph++;
          n++;
        }
      }
      perNurse.push(n);
    });
    const lowest = perNurse.length ? Math.min.apply(null, perNurse) : 0;
    let leaveTotal = 0;
    rows.forEach(x => {
      for (let d = 1; d <= days; d++) if (R.bucketOf(cellCode(x.empId, d)) === 'O') leaveTotal++;
    });
    const ic = (bg, c) => ({
      display: 'inline-grid',
      placeItems: 'center',
      width: 32,
      height: 32,
      borderRadius: 10,
      background: bg,
      color: c,
      flexShrink: 0
    });
    const kpis = [{
      lbl: 'rest days (OFF/DO)',
      val: String(off),
      icd: 'M8 2v4M16 2v4M3 8h18M5 8v13h14V8',
      icStyle: ic('rgba(125,145,180,.16)', '#6c7a8c'),
      glow: 'rgba(125,145,180,.2)'
    }, {
      lbl: 'paid leave days',
      val: String(paid),
      icd: 'M20 6L9 17l-5-5',
      icStyle: ic('rgba(224,138,30,.14)', '#b5670a'),
      glow: 'rgba(224,138,30,.25)'
    }, {
      lbl: 'public holidays',
      val: String(ph),
      icd: 'M12 2l2.9 6.3 6.9.8-5 4.8 1.3 6.9L12 17.5 5.9 20.8 7.2 13.9 2.2 9.1l6.9-.8z',
      icStyle: ic('rgba(106,82,212,.12)', '#5b45c4'),
      glow: 'rgba(106,82,212,.22)'
    }, {
      lbl: 'fewest days off',
      val: String(lowest),
      icd: 'M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0zM12 9v4M12 17h.01',
      icStyle: ic(lowest < cfg.minOff ? 'rgba(210,58,82,.12)' : 'rgba(31,157,87,.13)', lowest < cfg.minOff ? '#a92c42' : '#157a43'),
      glow: lowest < cfg.minOff ? 'rgba(210,58,82,.2)' : 'rgba(31,157,87,.2)'
    }];
    return React.createElement("div", {
      style: {
        marginBottom: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 14
      }
    }, React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
        gap: 12
      }
    }, kpis.map(k => React.createElement("div", {
      key: k.lbl,
      style: {
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(152deg,rgba(255,255,255,.8),rgba(236,247,255,.5))',
        backdropFilter: 'blur(24px) saturate(1.7)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.7)',
        border: '1px solid rgba(255,255,255,.92)',
        borderRadius: 15,
        boxShadow: '0 12px 36px rgba(31,59,90,.12),inset 0 1px 0 rgba(255,255,255,.95)',
        padding: '13px 15px'
      }
    }, React.createElement("div", {
      style: {
        position: 'absolute',
        right: -26,
        top: -30,
        width: 96,
        height: 88,
        borderRadius: '50%',
        background: 'radial-gradient(circle,' + k.glow + ',transparent 70%)',
        filter: 'blur(8px)',
        pointerEvents: 'none'
      }
    }), React.createElement("div", {
      style: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }
    }, React.createElement("span", {
      style: k.icStyle
    }, React.createElement(Ic, {
      d: k.icd,
      s: 15,
      sw: 1.9
    })), React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        fontFamily: ROS_MONO,
        fontSize: 19,
        fontWeight: 800,
        color: '#16202e',
        lineHeight: 1.15
      }
    }, k.val), React.createElement("div", {
      style: {
        fontSize: 10.5,
        color: '#6c7a8c',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, k.lbl)))))), React.createElement("div", {
      style: {
        background: 'linear-gradient(152deg,rgba(255,255,255,.8),rgba(236,247,255,.5))',
        backdropFilter: 'blur(24px) saturate(1.7)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.7)',
        border: '1px solid rgba(255,255,255,.92)',
        borderRadius: 16,
        boxShadow: '0 14px 40px rgba(31,59,90,.13),inset 0 1px 0 rgba(255,255,255,.95)',
        overflow: 'hidden'
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '12px 16px',
        borderBottom: '1px solid rgba(125,145,180,.18)',
        flexWrap: 'wrap'
      }
    }, React.createElement("span", {
      style: rosBadge('rgba(224,138,30,.14)', '#b5670a', 26)
    }, React.createElement(Ic, {
      d: "M3 5h18v16H3zM3 9h18M8 3v4M16 3v4",
      s: 14,
      sw: 1.9
    })), React.createElement("h3", {
      style: ROS_H3
    }, "Who is away \u2014 ", monthLabel), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 5,
        flexWrap: 'wrap'
      }
    }, [['OFF / DO', '#8b98ab'], ['AL / EL', '#b5670a'], ['CL', '#0072a3'], ['ML / FL', '#5b45c4'], ['PH', '#157a43']].map(([label, c]) => React.createElement("span", {
      key: label,
      style: {
        fontSize: 9.5,
        fontWeight: 700,
        color: c,
        background: c + '16',
        border: '1px solid ' + c + '2e',
        padding: '2px 8px',
        borderRadius: 8,
        whiteSpace: 'nowrap'
      }
    }, label)))), React.createElement("div", {
      style: {
        overflowX: 'auto',
        padding: '12px 16px 14px'
      }
    }, React.createElement("table", {
      style: {
        borderCollapse: 'separate',
        borderSpacing: 2,
        fontSize: 10.5,
        minWidth: 820
      }
    }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
      style: {
        textAlign: 'left',
        padding: '3px 8px 3px 2px',
        fontSize: 9,
        letterSpacing: .5,
        textTransform: 'uppercase',
        color: '#7d8ea8',
        minWidth: 150
      }
    }, "Nurse"), Array.from({
      length: days
    }, (_, k) => k + 1).map(d => React.createElement("th", {
      key: d,
      style: {
        padding: '3px 0',
        textAlign: 'center',
        minWidth: 19,
        fontFamily: ROS_MONO,
        fontSize: 9,
        fontWeight: 700,
        color: rosIsFri(year, month, d) ? '#b5670a' : '#9aa6b4'
      }
    }, d)), React.createElement("th", {
      style: {
        padding: '3px 4px',
        fontSize: 9,
        letterSpacing: .5,
        textTransform: 'uppercase',
        color: '#7d8ea8'
      }
    }, "Off"))), React.createElement("tbody", null, rows.map(x => {
      let offN = 0;
      const cells = Array.from({
        length: days
      }, (_, k) => {
        const d = k + 1,
          c = cellCode(x.empId, d);
        const col = ROS_LEAVE_TONE[c] || '';
        if (col) offN++;
        return {
          d,
          c,
          col
        };
      });
      return React.createElement("tr", {
        key: x.empId
      }, React.createElement("td", {
        style: {
          padding: '2px 8px 2px 2px'
        }
      }, React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 7
        }
      }, React.createElement(MK.Av, {
        name: x.name,
        empId: x.empId,
        size: 22,
        radius: rosAvRadius(22)
      }), React.createElement("span", {
        style: {
          fontSize: 11,
          fontWeight: 600,
          color: '#16202e',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }
      }, x.name))), cells.map(c2 => React.createElement("td", {
        key: c2.d,
        style: {
          padding: 0
        }
      }, React.createElement("span", {
        title: 'Day ' + c2.d + ' · ' + (c2.c || 'on duty'),
        style: c2.col ? {
          display: 'grid',
          placeItems: 'center',
          width: 19,
          height: 19,
          borderRadius: 5,
          fontFamily: ROS_MONO,
          fontSize: 7.5,
          fontWeight: 800,
          color: '#fff',
          background: 'linear-gradient(140deg,' + c2.col + ',' + c2.col + 'c4)',
          boxShadow: '0 1px 4px ' + c2.col + '55'
        } : {
          display: 'grid',
          placeItems: 'center',
          width: 19,
          height: 19,
          borderRadius: 5,
          background: rosIsFri(year, month, c2.d) ? 'rgba(224,138,30,.1)' : 'rgba(125,145,180,.09)'
        }
      }, c2.col ? c2.c.slice(0, 2) : ''))), React.createElement("td", {
        style: {
          padding: '2px 4px',
          textAlign: 'center',
          fontFamily: ROS_MONO,
          fontSize: 11,
          fontWeight: 800,
          color: offN < cfg.minOff ? '#a92c42' : '#157a43'
        }
      }, offN));
    }))))), React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))',
        gap: 14
      }
    }, React.createElement("div", {
      style: {
        background: 'linear-gradient(152deg,rgba(255,255,255,.8),rgba(236,247,255,.5))',
        backdropFilter: 'blur(24px) saturate(1.7)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.7)',
        border: '1px solid rgba(255,255,255,.92)',
        borderRadius: 16,
        boxShadow: '0 14px 40px rgba(31,59,90,.13),inset 0 1px 0 rgba(255,255,255,.95)',
        overflow: 'hidden'
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 16px',
        borderBottom: '1px solid rgba(125,145,180,.18)'
      }
    }, React.createElement("h3", {
      style: ROS_H3
    }, "Leave mix"), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("span", {
      style: {
        fontSize: 11,
        color: '#9aa6b4'
      }
    }, leaveTotal, " days total")), React.createElement("div", {
      style: {
        padding: '13px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, [['OFF', 'Off day'], ['DO', 'Day off'], ['AL', 'Annual leave'], ['CL', 'Casual leave'], ['EL', 'Earned leave'], ['ML', 'Maternity leave'], ['PH', 'Public holiday']].map(([code, label]) => {
      let n = 0;
      rows.forEach(x => {
        for (let d = 1; d <= days; d++) if (cellCode(x.empId, d) === code) n++;
      });
      const c = code === 'OFF' || code === 'DO' ? '#8b98ab' : '#b5670a';
      return React.createElement("div", {
        key: code,
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }
      }, React.createElement("span", {
        style: {
          fontFamily: ROS_MONO,
          fontSize: 10,
          fontWeight: 700,
          color: '#fff',
          background: c,
          padding: '2px 7px',
          borderRadius: 6,
          flexShrink: 0,
          minWidth: 30,
          textAlign: 'center'
        }
      }, code), React.createElement("span", {
        style: {
          fontSize: 11.5,
          color: '#3c4858',
          width: 104,
          flexShrink: 0
        }
      }, label), React.createElement("div", {
        style: {
          flex: 1,
          height: 10,
          borderRadius: 6,
          background: 'rgba(125,145,180,.14)',
          overflow: 'hidden'
        }
      }, React.createElement("div", {
        style: {
          width: Math.min(100, n / Math.max(1, rows.length * 2) * 100) + '%',
          height: '100%',
          borderRadius: 5,
          background: 'linear-gradient(90deg,' + c + ',' + c + '99)',
          animation: 'rosGrowW .7s cubic-bezier(.2,.7,.3,1)'
        }
      })), React.createElement("span", {
        style: {
          fontFamily: ROS_MONO,
          fontSize: 11.5,
          fontWeight: 800,
          color: '#3c4858',
          width: 26,
          textAlign: 'right'
        }
      }, n));
    }))), React.createElement("div", {
      style: {
        background: 'linear-gradient(152deg,rgba(255,255,255,.8),rgba(236,247,255,.5))',
        backdropFilter: 'blur(24px) saturate(1.7)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.7)',
        border: '1px solid rgba(255,255,255,.92)',
        borderRadius: 16,
        boxShadow: '0 14px 40px rgba(31,59,90,.13),inset 0 1px 0 rgba(255,255,255,.95)',
        overflow: 'hidden'
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 16px',
        borderBottom: '1px solid rgba(125,145,180,.18)'
      }
    }, React.createElement("span", {
      style: rosBadge('rgba(210,58,82,.12)', '#a92c42', 26)
    }, React.createElement(Ic, {
      d: "M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0zM12 9v4M12 17h.01",
      s: 14,
      sw: 2
    })), React.createElement("h3", {
      style: ROS_H3
    }, "Clash days"), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("span", {
      style: {
        fontSize: 11,
        color: '#9aa6b4'
      }
    }, "more than ", cfg.maxLeavePerDay, " away")), React.createElement("div", null, ev.viol.leave.slice(0, 8).map((t, i) => {
      const dayN = t.split(':')[0].replace('Day ', '');
      return React.createElement("div", {
        key: i,
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 16px',
          borderBottom: '1px solid rgba(125,145,180,.12)'
        }
      }, React.createElement("span", {
        style: {
          fontFamily: ROS_MONO,
          fontSize: 11,
          fontWeight: 800,
          color: '#a92c42',
          background: 'rgba(210,58,82,.12)',
          padding: '4px 9px',
          borderRadius: 8,
          flexShrink: 0,
          minWidth: 26,
          textAlign: 'center'
        }
      }, dayN), React.createElement("div", {
        style: {
          minWidth: 0,
          flex: 1,
          fontSize: 11.5,
          color: '#3c4858'
        }
      }, t.split(': ')[1] || ''), React.createElement("span", {
        style: rosChipS('#a92c42', 'rgba(210,58,82,.12)')
      }, "clash"));
    }), ev.viol.leave.length === 0 && React.createElement("div", {
      style: {
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }
    }, React.createElement("span", {
      style: rosBadge('rgba(31,157,87,.14)', '#157a43', 30, '50%')
    }, React.createElement(Ic, {
      d: "M4 12l5 5L20 6",
      s: 15,
      sw: 3
    })), React.createElement("div", {
      style: {
        fontSize: 12,
        color: '#3c4858',
        lineHeight: 1.5
      }
    }, "Leave is spread evenly \u2014 no day has more than ", cfg.maxLeavePerDay, " nurse away."))))));
  })(), view === 'calendar' && (() => {
    const cells = [];
    for (let i = 0; i < rosCol(year, month, 1); i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(d);
    while (cells.length % 7) cells.push(null);
    return React.createElement("div", {
      style: {
        marginBottom: 14,
        background: 'linear-gradient(152deg,rgba(255,255,255,.78),rgba(236,247,255,.48))',
        backdropFilter: 'blur(24px) saturate(1.7)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.7)',
        border: '1px solid rgba(255,255,255,.92)',
        borderRadius: 16,
        boxShadow: '0 14px 40px rgba(31,59,90,.13),inset 0 1px 0 rgba(255,255,255,.95)',
        overflow: 'hidden'
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '12px 16px',
        borderBottom: '1px solid rgba(125,145,180,.18)',
        flexWrap: 'wrap'
      }
    }, React.createElement("h3", {
      style: ROS_H3
    }, monthLabel), React.createElement("span", {
      style: {
        fontSize: 11,
        color: '#9aa6b4'
      }
    }, "week starts Saturday \xB7 Friday is the weekly holiday"), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 10.5,
        fontWeight: 700,
        color: '#b5670a',
        background: 'rgba(224,138,30,.14)',
        border: '1px solid rgba(224,138,30,.28)',
        padding: '4px 11px',
        borderRadius: 12
      }
    }, "Friday off")), React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(7,minmax(0,1fr))',
        gap: 1,
        background: 'rgba(125,145,180,.16)',
        padding: 1
      }
    }, ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(label => React.createElement("div", {
      key: label,
      style: {
        padding: '8px 6px',
        textAlign: 'center',
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: .7,
        textTransform: 'uppercase',
        color: label === 'Fri' ? '#b5670a' : '#7d8ea8',
        background: label === 'Fri' ? 'rgba(224,138,30,.14)' : 'linear-gradient(180deg,#f6fafe,#e9f1fa)'
      }
    }, label)), cells.map((d, k) => {
      if (!d) return React.createElement("div", {
        key: 'b' + k,
        style: {
          minHeight: 92,
          background: 'rgba(244,248,252,.5)'
        }
      });
      const isFri = rosIsFri(year, month, d);
      let on = 0;
      const offNames = [];
      rows.forEach(x => {
        const b = R.bucketOf(cellCode(x.empId, d));
        if (b && b !== 'O') on++;else if (b === 'O') offNames.push(String(x.name).split(' ')[0]);
      });
      const closed = !!ev.closedDays[d];
      const cc = closed ? '#8b98ab' : on >= 5 ? '#157a43' : on >= 4 ? '#0072a3' : on >= 3 ? '#b5670a' : '#a92c42';
      return React.createElement("div", {
        key: d,
        onClick: () => setDayPop(d),
        style: {
          minHeight: 92,
          padding: '8px 9px',
          cursor: 'pointer',
          background: isFri ? 'linear-gradient(160deg,rgba(255,247,235,.95),rgba(255,241,222,.8))' : 'rgba(255,255,255,.82)',
          transition: 'background .15s'
        }
      }, React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 6
        }
      }, React.createElement("span", {
        style: {
          fontFamily: ROS_MONO,
          fontSize: 13,
          fontWeight: 800,
          color: isFri ? '#b5670a' : '#16202e'
        }
      }, d), React.createElement("span", {
        style: {
          flex: 1
        }
      }), React.createElement("span", {
        style: {
          fontSize: 9.5,
          fontWeight: 700,
          color: cc,
          background: cc + '18',
          padding: '1px 7px',
          borderRadius: 9,
          whiteSpace: 'nowrap'
        }
      }, closed ? 'off' : on + ' on')), React.createElement("div", {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: 3
        }
      }, [['M', '#e08a1e'], ['E', '#0090ca'], ['N', '#5b45c4'], ['G', '#6a52d4']].map(([b, col]) => {
        const n = ev.dayBucketCount(d, b);
        return React.createElement("div", {
          key: b,
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 5
          }
        }, React.createElement("span", {
          style: {
            fontFamily: ROS_MONO,
            fontSize: 8.5,
            fontWeight: 800,
            color: col,
            width: 9,
            flexShrink: 0
          }
        }, b), React.createElement("div", {
          style: {
            flex: 1,
            height: 5,
            borderRadius: 3,
            background: 'rgba(125,145,180,.14)',
            overflow: 'hidden'
          }
        }, React.createElement("div", {
          style: {
            width: Math.min(100, n / Math.max(1, rows.length) * 100) + '%',
            height: '100%',
            borderRadius: 3,
            background: col
          }
        })), React.createElement("span", {
          style: {
            fontFamily: ROS_MONO,
            fontSize: 9,
            fontWeight: 700,
            color: '#6c7a8c',
            width: 9,
            textAlign: 'right'
          }
        }, n));
      })), offNames.length > 0 && React.createElement("div", {
        style: {
          marginTop: 6,
          fontSize: 9,
          color: '#9aa6b4',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }
      }, "off: ", offNames.slice(0, 3).join(', '), offNames.length > 3 ? ' +' + (offNames.length - 3) : ''));
    })));
  })(), view === 'tree' && (() => {
    const tDay = Math.min(Math.max(1, treeDay == null ? day : treeDay), days);
    const GROUPS = [['M', 'MORNING'], ['E', 'EVENING'], ['N', 'NIGHT'], ['G', 'GENERAL DUTY'], ['O', 'OFF / LEAVE']];
    const tierRank = desig => {
      const S = window.STAFF || {};
      const nurse = S.DESIGNATIONS || [],
        pca = S.PCA_DESIGNATIONS || [];
      const i = nurse.indexOf(desig);
      if (i >= 0) return nurse.length - i;
      const j = pca.indexOf(desig);
      if (j >= 0) return 1000 + (pca.length - j);
      return 9000;
    };
    const people = rows.map(x => ({
      x,
      c: cellCode(x.empId, tDay),
      b: R.bucketOf(cellCode(x.empId, tDay)) || '',
      tier: x.desig || 'No designation recorded'
    }));
    const inB = b => people.filter(p => p.b === b);
    const present = GROUPS.filter(([b]) => inB(b).length);
    const selB = treeB && present.some(([b]) => b === treeB) ? treeB : present[0] ? present[0][0] : 'M';
    const tiersIn = [...new Set(inB(selB).map(p => p.tier))].sort((a, b) => tierRank(a) - tierRank(b) || a.localeCompare(b));
    const selD = treeD && tiersIn.indexOf(treeD) >= 0 ? treeD : tiersIn[0] || null;
    const selColor = rosBColor(selB);
    const X = [190, 470, 730, 1000],
      W = 1360,
      PITCH = 30,
      LEAF_PITCH = 30;
    const paths = [],
      L1 = [],
      L2 = [],
      L3 = [];
    const h1 = present.length * PITCH;
    let y1 = 0;
    const rootY0 = h1 / 2;
    present.forEach(([b, label]) => {
      const n = inB(b).length,
        color = rosBColor(b),
        on = b === selB;
      const y = y1 + PITCH / 2;
      y1 += PITCH;
      L1.push({
        b,
        label,
        y,
        color,
        on,
        sub: n + (n === 1 ? ' nurse' : ' nurses')
      });
      const mx = (X[0] + X[1]) / 2;
      paths.push({
        d: 'M' + (X[0] + 6) + ',' + rootY0 + ' C' + mx + ',' + rootY0 + ' ' + mx + ',' + y + ' ' + (X[1] - 6) + ',' + y,
        stroke: on ? color + 'b0' : 'rgba(125,145,180,.4)',
        w: on ? 1.7 : 1
      });
    });
    const bNode = L1.find(n => n.on) || {
      y: rootY0
    };
    const h2 = tiersIn.length * PITCH;
    let y2 = bNode.y - h2 / 2;
    tiersIn.forEach(t => {
      const n = inB(selB).filter(p => p.tier === t).length,
        on = t === selD;
      const y = y2 + PITCH / 2;
      y2 += PITCH;
      L2.push({
        t,
        y,
        on,
        sub: String(n)
      });
      const mx = (X[1] + X[2]) / 2;
      paths.push({
        d: 'M' + (X[1] + 6) + ',' + bNode.y + ' C' + mx + ',' + bNode.y + ' ' + mx + ',' + y + ' ' + (X[2] - 6) + ',' + y,
        stroke: on ? selColor + 'b0' : 'rgba(125,145,180,.4)',
        w: on ? 1.7 : 1
      });
    });
    const dNode = L2.find(n => n.on) || bNode;
    const leafRows = inB(selB).filter(p => p.tier === selD);
    let y3 = dNode.y - leafRows.length * LEAF_PITCH / 2;
    leafRows.forEach(p => {
      const y = y3 + LEAF_PITCH / 2;
      y3 += LEAF_PITCH;
      const sh = R.BY_CODE[p.c] || {};
      L3.push({
        p,
        y,
        time: sh.label || ''
      });
      const mx = (X[2] + X[3]) / 2;
      paths.push({
        d: 'M' + (X[2] + 6) + ',' + dNode.y + ' C' + mx + ',' + dNode.y + ' ' + mx + ',' + y + ' ' + (X[3] - 5) + ',' + y,
        stroke: 'rgba(125,145,180,.5)',
        w: 1
      });
    });
    const allY = [rootY0].concat(L1.map(n => n.y), L2.map(n => n.y), L3.map(n => n.y));
    const shift = 34 - Math.min.apply(null, allY);
    const H = Math.max.apply(null, allY) + shift + 34;
    L1.forEach(n => {
      n.y += shift;
    });
    L2.forEach(n => {
      n.y += shift;
    });
    L3.forEach(n => {
      n.y += shift;
    });
    paths.forEach(p => {
      p.d = p.d.replace(/,(-?[\d.]+)/g, (m, v) => ',' + (Number(v) + shift).toFixed(1));
    });
    const rY = rootY0 + shift;
    const onDuty = people.filter(p => p.b && p.b !== 'O').length;
    const navBtn = {
      display: 'inline-grid',
      placeItems: 'center',
      width: 28,
      height: 28,
      borderRadius: 8,
      border: '1px solid rgba(125,145,180,.35)',
      background: 'rgba(255,255,255,.7)',
      color: '#3c4858',
      cursor: 'pointer',
      flexShrink: 0
    };
    const crumb = [[dept + ' roster', true], [(GROUPS.find(g => g[0] === selB) || ['', ''])[1], true], [selD || '', !!selD]].filter(c => c[1] && c[0]);
    return React.createElement("div", {
      style: {
        background: 'linear-gradient(152deg,rgba(255,255,255,.78),rgba(236,247,255,.48))',
        backdropFilter: 'blur(26px) saturate(1.75)',
        WebkitBackdropFilter: 'blur(26px) saturate(1.75)',
        border: '1px solid rgba(255,255,255,.92)',
        borderRadius: 16,
        boxShadow: '0 14px 42px rgba(31,59,90,.14),inset 0 1px 0 rgba(255,255,255,.95)',
        overflow: 'hidden',
        marginBottom: 14
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '12px 16px',
        borderBottom: '1px solid rgba(125,145,180,.18)',
        flexWrap: 'wrap'
      }
    }, React.createElement("span", {
      style: rosBadge('rgba(0,144,202,.12)', '#0072a3', 32, 10)
    }, React.createElement(Ic, {
      d: "M4 12h5M14 6h6M14 12h6M14 18h6M9 6v12M9 6h5M9 18h5",
      s: 16,
      sw: 1.9
    })), React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, React.createElement("h3", {
      style: ROS_H3
    }, "Tree view \u2014 ", tDay, " ", monthLabel, " \xB7 ", dowOf(tDay)), React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        color: '#6c7a8c',
        flexWrap: 'wrap'
      }
    }, crumb.map(([label], i) => React.createElement(React.Fragment, {
      key: label + i
    }, React.createElement("span", null, label), i < crumb.length - 1 && React.createElement("span", {
      style: {
        color: '#b6c0cc'
      }
    }, "\u203A"))))), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("div", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6
      }
    }, React.createElement("button", {
      style: navBtn,
      title: "Previous day",
      onClick: () => setTreeDay((tDay - 2 + days) % days + 1)
    }, React.createElement(Ic, {
      d: "M15 6l-6 6 6 6",
      s: 13,
      sw: 2.2
    })), React.createElement("select", {
      value: String(tDay),
      onChange: e => setTreeDay(Number(e.target.value)),
      style: {
        boxSizing: 'border-box',
        padding: '7px 10px',
        borderRadius: 9,
        border: '1px solid rgba(125,145,180,.35)',
        background: 'rgba(255,255,255,.8)',
        fontFamily: 'inherit',
        fontSize: 12,
        color: '#16202e',
        outline: 'none'
      }
    }, Array.from({
      length: days
    }, (_, i) => i + 1).map(n => React.createElement("option", {
      key: n,
      value: String(n)
    }, n, " ", monShort, " \xB7 ", dowOf(n)))), React.createElement("button", {
      style: navBtn,
      title: "Next day",
      onClick: () => setTreeDay(tDay % days + 1)
    }, React.createElement(Ic, {
      d: "M9 6l6 6-6 6",
      s: 13,
      sw: 2.2
    })), React.createElement("button", {
      onClick: () => {
        setTreeB(null);
        setTreeD(null);
      },
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        border: '1px solid rgba(125,145,180,.35)',
        background: 'rgba(255,255,255,.7)',
        color: '#3c4858',
        padding: '6px 11px',
        borderRadius: 9,
        fontSize: 11.5,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit'
      }
    }, "Reset branch"))), present.length === 0 ? React.createElement("div", {
      style: {
        display: 'grid',
        placeItems: 'center',
        padding: 34,
        textAlign: 'center',
        gap: 6
      }
    }, React.createElement("div", {
      style: {
        opacity: .35
      }
    }, React.createElement(Ic, {
      d: "M3 5h18v16H3zM3 9h18M8 3v4M16 3v4",
      s: 30
    })), React.createElement("div", {
      style: {
        fontWeight: 600
      }
    }, "Nothing is written against ", tDay, " ", R.MONTHS[month]), React.createElement("div", {
      style: {
        fontSize: 11.5,
        color: '#6c7a8c',
        maxWidth: 400
      }
    }, "No shift code is recorded for anyone in ", dept, " on this day, so the tree has no branches to draw. Pick another day, or fill the column in on the monthly grid.")) : React.createElement("div", {
      style: {
        padding: '8px 12px 16px',
        overflowX: 'auto',
        display: 'flex'
      }
    }, React.createElement("div", {
      style: {
        position: 'relative',
        width: W,
        height: H,
        flexShrink: 0
      }
    }, React.createElement("svg", {
      viewBox: '0 0 ' + W + ' ' + H,
      style: {
        position: 'absolute',
        inset: 0,
        width: W,
        height: H,
        pointerEvents: 'none'
      }
    }, paths.map((p, i) => React.createElement("path", {
      key: i,
      d: p.d,
      fill: "none",
      stroke: p.stroke,
      strokeWidth: p.w
    }))), React.createElement("div", {
      style: {
        position: 'absolute',
        left: 0,
        top: rY - 20 + 'px',
        width: X[0] - 16 + 'px',
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8,
        padding: '0 10px',
        boxSizing: 'border-box'
      }
    }, React.createElement("div", {
      style: {
        textAlign: 'right'
      }
    }, React.createElement("div", {
      style: {
        fontSize: 13.5,
        fontWeight: 800,
        color: '#16202e',
        whiteSpace: 'nowrap'
      }
    }, dept), React.createElement("div", {
      style: {
        fontFamily: ROS_MONO,
        fontSize: 10,
        color: '#8a97a8',
        whiteSpace: 'nowrap'
      }
    }, onDuty, " / ", people.length, " on duty"))), React.createElement("div", {
      style: {
        position: 'absolute',
        left: X[0] - 7 + 'px',
        top: rY - 7 + 'px',
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: '#0072a3',
        border: '2px solid #fff',
        boxShadow: '0 0 0 4px rgba(0,114,163,.18)',
        boxSizing: 'border-box'
      }
    }), L1.map(n => React.createElement(React.Fragment, {
      key: n.b
    }, React.createElement("div", {
      className: "ros-treerow",
      onClick: () => {
        setTreeB(n.b);
        setTreeD(null);
      },
      style: {
        position: 'absolute',
        left: 0,
        top: n.y - 17 + 'px',
        width: X[1] - 16 + 'px',
        height: 34,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8,
        padding: '0 12px',
        boxSizing: 'border-box',
        borderRadius: 10,
        cursor: 'pointer',
        background: n.on ? 'linear-gradient(90deg,transparent,' + n.color + '1f)' : 'transparent',
        border: '1px solid ' + (n.on ? n.color + '3d' : 'transparent'),
        transition: 'all .15s'
      }
    }, React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: n.on ? 800 : 600,
        color: n.on ? n.color : '#3c4858',
        letterSpacing: .4,
        whiteSpace: 'nowrap'
      }
    }, n.label), React.createElement("span", {
      style: {
        fontFamily: ROS_MONO,
        fontSize: 10,
        fontWeight: 700,
        color: n.color,
        background: n.color + '1a',
        padding: '2px 7px',
        borderRadius: 10,
        whiteSpace: 'nowrap'
      }
    }, n.sub)), React.createElement("div", {
      style: {
        position: 'absolute',
        left: X[1] - 6 + 'px',
        top: n.y - 6 + 'px',
        width: 12,
        height: 12,
        borderRadius: '50%',
        background: n.on ? n.color : '#fff',
        border: '2px solid ' + n.color,
        boxShadow: n.on ? '0 0 0 4px ' + n.color + '24' : 'none',
        boxSizing: 'border-box'
      }
    }))), L2.map(n => React.createElement(React.Fragment, {
      key: n.t
    }, React.createElement("div", {
      className: "ros-treerow",
      onClick: () => setTreeD(n.t),
      style: {
        position: 'absolute',
        left: X[1] + 20 + 'px',
        top: n.y - 17 + 'px',
        width: X[2] - X[1] - 36 + 'px',
        height: 34,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8,
        padding: '0 12px',
        boxSizing: 'border-box',
        borderRadius: 10,
        cursor: 'pointer',
        background: n.on ? 'linear-gradient(90deg,transparent,' + selColor + '1f)' : 'transparent',
        border: '1px solid ' + (n.on ? selColor + '3d' : 'transparent'),
        transition: 'all .15s'
      }
    }, React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: n.on ? 800 : 600,
        color: n.on ? selColor : '#3c4858',
        whiteSpace: 'nowrap'
      }
    }, n.t), React.createElement("span", {
      style: {
        fontFamily: ROS_MONO,
        fontSize: 10,
        fontWeight: 700,
        color: selColor,
        background: selColor + '1a',
        padding: '2px 7px',
        borderRadius: 10
      }
    }, n.sub)), React.createElement("div", {
      style: {
        position: 'absolute',
        left: X[2] - 6 + 'px',
        top: n.y - 6 + 'px',
        width: 12,
        height: 12,
        borderRadius: '50%',
        background: n.on ? selColor : '#fff',
        border: '2px solid ' + selColor,
        boxShadow: n.on ? '0 0 0 4px ' + selColor + '24' : 'none',
        boxSizing: 'border-box'
      }
    }))), L3.map(n => React.createElement(React.Fragment, {
      key: n.p.x.empId
    }, React.createElement("div", {
      style: {
        position: 'absolute',
        left: X[3] + 16 + 'px',
        top: n.y - 15 + 'px',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '5px 12px',
        borderRadius: 10,
        background: 'rgba(255,255,255,.72)',
        border: '1px solid ' + selColor + '2e',
        boxShadow: '0 3px 10px rgba(31,59,90,.07)',
        whiteSpace: 'nowrap'
      }
    }, React.createElement(MK.Av, {
      name: n.p.x.name,
      empId: n.p.x.empId,
      size: 22,
      radius: rosAvRadius(22)
    }), React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: 700,
        color: '#16202e'
      }
    }, n.p.x.name), React.createElement("span", {
      style: {
        fontFamily: ROS_MONO,
        fontSize: 10,
        color: '#0072a3'
      }
    }, n.p.x.empIdShown ? 'ID ' + n.p.x.empIdShown : 'no Emp-ID'), React.createElement("span", {
      style: {
        fontFamily: ROS_MONO,
        fontSize: 10.5,
        fontWeight: 700,
        color: '#fff',
        background: selColor,
        padding: '2px 8px',
        borderRadius: 7
      }
    }, n.p.c), React.createElement("span", {
      style: {
        fontFamily: ROS_MONO,
        fontSize: 10.5,
        color: '#6c7a8c'
      }
    }, n.time)), React.createElement("div", {
      style: {
        position: 'absolute',
        left: X[3] - 5 + 'px',
        top: n.y - 5 + 'px',
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: '#fff',
        border: '2px solid ' + selColor,
        boxSizing: 'border-box'
      }
    }))))), React.createElement("div", {
      style: {
        padding: '10px 16px',
        borderTop: '1px solid rgba(125,145,180,.18)',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        flexWrap: 'wrap',
        background: 'rgba(247,251,255,.55)'
      }
    }, ROS_BUCKETS.concat([['O', 'Off / leave', '#8b98ab', '']]).map(([b, label, c]) => React.createElement("span", {
      key: b,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 10.5,
        fontWeight: 700,
        color: c,
        background: c + '18',
        border: '1px solid ' + c + '33',
        padding: '4px 10px',
        borderRadius: 12,
        whiteSpace: 'nowrap'
      }
    }, label)), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("span", {
      style: {
        fontSize: 10.5,
        color: '#8a97a8'
      }
    }, "Click a shift, then a designation \u2014 the branch drills down one level at a time.")));
  })(), view === 'swap' && React.createElement("div", {
    style: {
      marginBottom: 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, React.createElement("div", {
    style: {
      background: 'linear-gradient(152deg,rgba(255,255,255,.8),rgba(236,247,255,.5))',
      backdropFilter: 'blur(24px) saturate(1.7)',
      WebkitBackdropFilter: 'blur(24px) saturate(1.7)',
      border: '1px solid rgba(255,255,255,.92)',
      borderRadius: 15,
      boxShadow: '0 12px 36px rgba(31,59,90,.12),inset 0 1px 0 rgba(255,255,255,.95)',
      padding: '13px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 13,
      flexWrap: 'wrap'
    }
  }, React.createElement("span", {
    style: rosBadge('rgba(0,144,202,.12)', '#0072a3', 32, 10)
  }, React.createElement(Ic, {
    d: "M7 16H3l4-4M17 8h4l-4 4M3 16h14M21 8H7",
    s: 16,
    sw: 1.9
  })), React.createElement("div", {
    style: {
      minWidth: 200,
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: '#16202e'
    }
  }, "Drag shifts in the grid above to swap"), React.createElement("div", {
    style: {
      fontSize: 11,
      color: '#6c7a8c',
      lineHeight: 1.5
    }
  }, "Drop onto another cell \u2014 same nurse or a different one. Cross-nurse drops are logged below."))), swapLog.map(l => React.createElement("div", {
    key: l.id,
    style: {
      background: 'linear-gradient(152deg,rgba(255,255,255,.78),rgba(236,247,255,.48))',
      backdropFilter: 'blur(24px) saturate(1.7)',
      WebkitBackdropFilter: 'blur(24px) saturate(1.7)',
      border: '1px solid rgba(255,255,255,.92)',
      borderRadius: 15,
      boxShadow: '0 12px 36px rgba(31,59,90,.12),inset 0 1px 0 rgba(255,255,255,.95)',
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 13,
      flexWrap: 'wrap'
    }
  }, React.createElement("span", {
    style: {
      fontFamily: ROS_MONO,
      fontSize: 11,
      color: '#9aa6b4'
    }
  }, l.id), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      minWidth: 250,
      flex: 1
    }
  }, React.createElement(MK.Av, {
    name: l.aName,
    size: 30,
    radius: rosAvRadius(30)
  }), React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: '#16202e'
    }
  }, l.aName), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: '#9aa6b4'
    }
  }, "Day ", l.aDay, " \xB7 ", React.createElement("span", {
    style: {
      fontFamily: ROS_MONO
    }
  }, l.aCode || '—'))), React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#0090ca",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      flexShrink: 0
    }
  }, React.createElement("path", {
    d: "M7 16H3l4-4M17 8h4l-4 4M3 16h14M21 8H7"
  })), React.createElement(MK.Av, {
    name: l.bName,
    size: 30,
    radius: rosAvRadius(30)
  }), React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: '#16202e'
    }
  }, l.bName), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: '#9aa6b4'
    }
  }, "Day ", l.bDay, " \xB7 ", React.createElement("span", {
    style: {
      fontFamily: ROS_MONO
    }
  }, l.bCode || '—')))), React.createElement("div", {
    style: {
      fontSize: 11,
      color: '#6c7a8c',
      maxWidth: 230,
      lineHeight: 1.5
    }
  }, l.mode === 'swap' ? 'Created by drag — shifts exchanged in the grid.' : 'Created by drag — shift moved across.'), React.createElement("span", {
    style: rosChipS('#0072a3', 'rgba(0,144,202,.12)')
  }, "Applied"))), swapLog.length === 0 && React.createElement("div", {
    style: {
      ...ROS_CARD15,
      padding: '16px 18px',
      fontSize: 12,
      color: '#9aa6b4'
    }
  }, "No swaps logged yet this session \u2014 drag one shift onto another in the grid, then confirm the change.")), view === 'rules' && (() => {
    const selStyle = {
      width: '100%',
      boxSizing: 'border-box',
      padding: '9px 10px',
      borderRadius: 9,
      border: '1px solid rgba(125,145,180,.35)',
      background: 'rgba(255,255,255,.85)',
      fontFamily: 'inherit',
      fontSize: 12,
      color: '#16202e',
      outline: 'none'
    };
    const stepStyle = {
      width: 22,
      height: 22,
      borderRadius: 7,
      border: '1px solid rgba(125,145,180,.3)',
      background: 'rgba(255,255,255,.8)',
      color: '#3c4858',
      fontSize: 13,
      fontWeight: 700,
      cursor: 'pointer',
      fontFamily: 'inherit',
      lineHeight: 1,
      display: 'grid',
      placeItems: 'center'
    };
    const metricOpts = draft.scope === 'day' ? [['onDuty', 'staff on duty'], ['morning', 'morning staff'], ['evening', 'evening staff'], ['night', 'night staff'], ['general', 'general-duty staff'], ['onLeave', 'staff on leave']] : [['nights', 'night shifts'], ['hours', 'total hours'], ['offDays', 'rest days'], ['shifts', 'shifts worked'], ['fridaysWorked', 'Fridays worked']];
    const canAdd = !!draft.name.trim();
    return React.createElement("div", {
      style: {
        marginBottom: 14,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(330px,1fr))',
        gap: 14,
        alignItems: 'start'
      }
    }, React.createElement("div", {
      style: {
        background: 'linear-gradient(152deg,rgba(255,255,255,.78),rgba(236,247,255,.48))',
        backdropFilter: 'blur(24px) saturate(1.7)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.7)',
        border: '1px solid rgba(255,255,255,.92)',
        borderRadius: 16,
        boxShadow: '0 14px 40px rgba(31,59,90,.13),inset 0 1px 0 rgba(255,255,255,.95)',
        overflow: 'hidden'
      }
    }, React.createElement("div", {
      style: ROS_CARD_HEAD
    }, React.createElement("span", {
      style: rosBadge('rgba(0,144,202,.12)', '#0072a3', 26)
    }, React.createElement(Ic, {
      d: "M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6zM9 12l2 2 4-4",
      s: 14,
      sw: 1.9
    })), React.createElement("h3", {
      style: ROS_H3
    }, "Rule set"), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("span", {
      style: {
        fontSize: 11,
        color: '#9aa6b4'
      }
    }, "switch off or retune any rule")), React.createElement("div", null, [['ratio', 'Nurse-to-patient ratio', 'minimum on duty per day', 'minOnDuty'], ['min', 'Minimum morning staff', 'M shift floor', 'minM'], ['min2', 'Minimum evening staff', 'E shift floor', 'minE'], ['min3', 'Minimum night staff', 'N shift floor', 'minN'], ['nights', 'Max consecutive nights', 'nights in a row before a warning', 'maxNights'], ['offdays', 'Weekly off entitlement', 'rest days per month', 'minOff'], ['leave', 'Leave clash limit', 'staff allowed on leave per day', 'maxLeavePerDay'], ['nm', 'No night → morning', 'block back-to-back turnaround', ''], ['senior', 'Senior nurse on nights', 'senior / team leader / charge', ''], ['friday', 'Friday off entitlement (BD)', 'at least one Friday off per nurse', '']].map(([key, label, hint, num]) => {
      const enKey = key === 'min2' || key === 'min3' ? 'min' : key;
      const on = en[enKey] !== false;
      return React.createElement("div", {
        key: key,
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          padding: '10px 16px',
          borderBottom: '1px solid rgba(125,145,180,.12)',
          background: on ? 'transparent' : 'rgba(244,246,249,.6)',
          opacity: on ? 1 : .62
        }
      }, React.createElement("span", {
        onClick: () => {
          setEn(s => ({
            ...s,
            [enKey]: s[enKey] === false
          }));
          setDirty(true);
        },
        style: {
          width: 34,
          height: 19,
          borderRadius: 12,
          flexShrink: 0,
          cursor: 'pointer',
          padding: 2,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: on ? 'flex-end' : 'flex-start',
          background: on ? 'linear-gradient(135deg,#3ab5a7,#0090ca)' : 'rgba(125,145,180,.35)',
          transition: 'all .2s'
        }
      }, React.createElement("span", {
        style: {
          width: 15,
          height: 15,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,.25)'
        }
      })), React.createElement("div", {
        style: {
          minWidth: 0,
          flex: 1
        }
      }, React.createElement("div", {
        style: {
          fontSize: 12,
          fontWeight: 600,
          color: '#16202e'
        }
      }, label), React.createElement("div", {
        style: {
          fontSize: 10.5,
          color: '#9aa6b4',
          lineHeight: 1.45
        }
      }, hint)), !!num && React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          flexShrink: 0
        }
      }, React.createElement("button", {
        onClick: () => {
          setCfg(c => ({
            ...c,
            [num]: Math.max(0, c[num] - 1)
          }));
          setDirty(true);
        },
        style: stepStyle
      }, "\u2212"), React.createElement("span", {
        style: {
          fontFamily: ROS_MONO,
          fontSize: 12.5,
          fontWeight: 800,
          color: '#16202e',
          minWidth: 20,
          textAlign: 'center'
        }
      }, cfg[num]), React.createElement("button", {
        onClick: () => {
          setCfg(c => ({
            ...c,
            [num]: c[num] + 1
          }));
          setDirty(true);
        },
        style: stepStyle
      }, "+")), React.createElement("span", {
        style: {
          fontSize: 9.5,
          fontWeight: 800,
          letterSpacing: .5,
          textTransform: 'uppercase',
          color: on ? '#157a43' : '#9aa6b4',
          background: on ? 'rgba(31,157,87,.13)' : 'rgba(125,145,180,.14)',
          padding: '2px 8px',
          borderRadius: 9,
          flexShrink: 0,
          minWidth: 26,
          textAlign: 'center'
        }
      }, on ? 'on' : 'off'));
    }))), React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 14
      }
    }, React.createElement("div", {
      style: {
        background: 'linear-gradient(152deg,rgba(255,255,255,.78),rgba(236,247,255,.48))',
        backdropFilter: 'blur(24px) saturate(1.7)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.7)',
        border: '1px solid rgba(255,255,255,.92)',
        borderRadius: 16,
        boxShadow: '0 14px 40px rgba(31,59,90,.13),inset 0 1px 0 rgba(255,255,255,.95)',
        overflow: 'hidden'
      }
    }, React.createElement("div", {
      style: ROS_CARD_HEAD
    }, React.createElement("span", {
      style: rosBadge('rgba(106,82,212,.12)', '#5b45c4', 26)
    }, React.createElement(Ic, {
      d: "M12 5v14M5 12h14",
      s: 14,
      sw: 2
    })), React.createElement("h3", {
      style: ROS_H3
    }, "Create a custom rule")), React.createElement("div", {
      style: {
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 11
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 5
      }
    }, React.createElement("label", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: .5,
        textTransform: 'uppercase',
        color: '#7d8ea8'
      }
    }, "Rule name"), React.createElement("input", {
      value: draft.name,
      onChange: e => {
        const v = e.target.value;
        setDraft(s => ({
          ...s,
          name: v
        }));
      },
      placeholder: "e.g. At least 2 seniors on every evening",
      style: {
        width: '100%',
        boxSizing: 'border-box',
        padding: '9px 11px',
        borderRadius: 9,
        border: '1px solid rgba(125,145,180,.35)',
        background: 'rgba(255,255,255,.85)',
        fontFamily: 'inherit',
        fontSize: 12.5,
        color: '#16202e',
        outline: 'none'
      }
    })), React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))',
        gap: 9
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 5
      }
    }, React.createElement("label", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: .5,
        textTransform: 'uppercase',
        color: '#7d8ea8'
      }
    }, "Applies to"), React.createElement("select", {
      value: draft.scope,
      onChange: e => {
        const v = e.target.value;
        setDraft(s => ({
          ...s,
          scope: v,
          metric: v === 'day' ? 'onDuty' : 'nights'
        }));
      },
      style: selStyle
    }, [['day', 'Each day'], ['staff', 'Each nurse']].map(([v, label]) => React.createElement("option", {
      key: v,
      value: v
    }, label)))), React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 5
      }
    }, React.createElement("label", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: .5,
        textTransform: 'uppercase',
        color: '#7d8ea8'
      }
    }, "Count of"), React.createElement("select", {
      value: draft.metric,
      onChange: e => {
        const v = e.target.value;
        setDraft(s => ({
          ...s,
          metric: v
        }));
      },
      style: selStyle
    }, metricOpts.map(([v, label]) => React.createElement("option", {
      key: v,
      value: v
    }, label)))), React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 5
      }
    }, React.createElement("label", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: .5,
        textTransform: 'uppercase',
        color: '#7d8ea8'
      }
    }, "Flag when"), React.createElement("select", {
      value: draft.op,
      onChange: e => {
        const v = e.target.value;
        setDraft(s => ({
          ...s,
          op: v
        }));
      },
      style: selStyle
    }, [['<', 'is below'], ['>', 'is above'], ['=', 'equals']].map(([v, label]) => React.createElement("option", {
      key: v,
      value: v
    }, label)))), React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 5
      }
    }, React.createElement("label", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: .5,
        textTransform: 'uppercase',
        color: '#7d8ea8'
      }
    }, "Value"), React.createElement("input", {
      value: String(draft.val),
      onChange: e => {
        const v = parseInt(e.target.value.replace(/[^0-9]/g, '') || '0', 10);
        setDraft(s => ({
          ...s,
          val: v
        }));
      },
      style: selStyle
    }))), React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        flexWrap: 'wrap'
      }
    }, React.createElement("div", {
      style: {
        display: 'inline-flex',
        background: 'rgba(255,255,255,.6)',
        border: '1px solid rgba(255,255,255,.9)',
        borderRadius: 9,
        padding: 3,
        gap: 2
      }
    }, [['warning', 'Warning'], ['blocker', 'Blocker']].map(([v, label]) => React.createElement("button", {
      key: v,
      onClick: () => setDraft(s => ({
        ...s,
        sev: v
      })),
      style: {
        border: 0,
        background: draft.sev === v ? v === 'blocker' ? 'linear-gradient(135deg,#e8697f,#a92c42)' : 'linear-gradient(135deg,#f0a94a,#b5670a)' : 'transparent',
        color: draft.sev === v ? '#fff' : '#6c7a8c',
        padding: '6px 13px',
        borderRadius: 8,
        fontSize: 11,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all .2s'
      }
    }, label))), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("button", {
      onClick: () => {
        if (!canAdd) return;
        setCustom(s => [...s, {
          ...draft,
          id: 'c' + Date.now()
        }]);
        setDraft({
          name: '',
          scope: 'day',
          metric: 'onDuty',
          op: '<',
          val: 4,
          sev: 'warning'
        });
        setDirty(true);
      },
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        border: '1px solid rgba(255,255,255,.4)',
        background: canAdd ? 'linear-gradient(135deg,#27a8db,#0072a3)' : 'linear-gradient(135deg,#9fb3c8,#7d8ea8)',
        color: '#fff',
        padding: '8px 14px',
        borderRadius: 9,
        fontSize: 11.5,
        fontWeight: 700,
        cursor: canAdd ? 'pointer' : 'default',
        fontFamily: 'inherit',
        boxShadow: canAdd ? '0 7px 18px rgba(0,144,202,.35)' : 'none',
        flexShrink: 0
      }
    }, React.createElement(Ic, {
      d: "M12 5v14M5 12h14",
      s: 13,
      sw: 2.4
    }), "Add rule")), React.createElement("div", {
      style: {
        fontSize: 11,
        color: '#6c7a8c',
        lineHeight: 1.55,
        background: 'rgba(0,144,202,.08)',
        borderRadius: 9,
        padding: '9px 11px'
      }
    }, React.createElement("b", null, "Preview:"), " Flag every ", draft.scope === 'day' ? 'day' : 'nurse', " where ", ROS_METRIC_LABEL[draft.metric] || draft.metric, " ", {
      '<': 'is below',
      '>': 'is above',
      '=': 'equals'
    }[draft.op], " ", draft.val, " \u2014 as a ", draft.sev, "."))), React.createElement("div", {
      style: {
        background: 'linear-gradient(152deg,rgba(255,255,255,.78),rgba(236,247,255,.48))',
        backdropFilter: 'blur(24px) saturate(1.7)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.7)',
        border: '1px solid rgba(255,255,255,.92)',
        borderRadius: 16,
        boxShadow: '0 14px 40px rgba(31,59,90,.13),inset 0 1px 0 rgba(255,255,255,.95)',
        overflow: 'hidden'
      }
    }, React.createElement("div", {
      style: ROS_CARD_HEAD
    }, React.createElement("h3", {
      style: ROS_H3
    }, "Custom rules"), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("span", {
      style: {
        fontSize: 11,
        color: '#9aa6b4'
      }
    }, custom.length, " active")), React.createElement("div", null, ev.customResults.map(cr => React.createElement("div", {
      key: cr.rule.id,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 16px',
        borderBottom: '1px solid rgba(125,145,180,.12)'
      }
    }, React.createElement("span", {
      style: {
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: .5,
        color: '#fff',
        background: cr.rule.sev === 'blocker' ? 'linear-gradient(135deg,#e8697f,#a92c42)' : 'linear-gradient(135deg,#f0a94a,#b5670a)',
        padding: '3px 7px',
        borderRadius: 6,
        flexShrink: 0
      }
    }, cr.rule.sev === 'blocker' ? 'BLOCK' : 'WARN'), React.createElement("div", {
      style: {
        minWidth: 0,
        flex: 1
      }
    }, React.createElement("div", {
      style: {
        fontSize: 12,
        fontWeight: 600,
        color: '#16202e'
      }
    }, cr.rule.name), React.createElement("div", {
      style: {
        fontSize: 10.5,
        color: '#9aa6b4',
        fontFamily: ROS_MONO
      }
    }, cr.rule.scope, " \xB7 ", ROS_METRIC_LABEL[cr.rule.metric] || cr.rule.metric, " ", cr.rule.op, " ", cr.rule.val)), React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: cr.hits.length ? '#a92c42' : '#157a43',
        background: cr.hits.length ? 'rgba(210,58,82,.12)' : 'rgba(31,157,87,.13)',
        padding: '2px 8px',
        borderRadius: 9,
        whiteSpace: 'nowrap',
        flexShrink: 0
      }
    }, cr.hits.length ? cr.hits.length + ' hits' : 'clear'), React.createElement("button", {
      onClick: () => {
        setCustom(s => s.filter(x => x.id !== cr.rule.id));
        setDirty(true);
      },
      title: "Delete rule",
      className: "ros-decl",
      style: {
        width: 26,
        height: 26,
        borderRadius: 7,
        border: '1px solid rgba(210,58,82,.3)',
        background: 'rgba(255,255,255,.7)',
        color: '#a92c42',
        cursor: 'pointer',
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0
      }
    }, React.createElement(Ic, {
      d: "M18 6L6 18M6 6l12 12",
      s: 12,
      sw: 2.4
    })))), custom.length === 0 && React.createElement("div", {
      style: {
        padding: '14px 16px',
        fontSize: 12,
        color: '#9aa6b4'
      }
    }, "No custom rules yet \u2014 build one above.")))));
  })(), showFooter && (() => {
    const floatPool = (staffStore.staff || []).filter(e => e.is_active !== false && !e.former && (e.current_department || 'Unassigned') !== dept).sort((a, b) => String(a.name).localeCompare(String(b.name))).slice(0, 3).map(e => {
      const ind = /Senior|Team|Charge|In-charge/i.test(e.designation || '');
      return {
        name: e.name,
        empId: rosKey(e),
        home: e.current_department || 'Unassigned',
        level: ind ? 'Independent' : 'Supervised',
        lvlShort: ind ? 'IND' : 'SUP',
        c: ind ? '#157a43' : '#b5670a',
        bg: ind ? 'rgba(31,157,87,.13)' : 'rgba(224,138,30,.14)'
      };
    });
    const allNames = [...new Set((staffStore.staff || []).filter(e => e.is_active !== false && !e.former).map(e => e.name).filter(Boolean))].sort();
    const approver = sign['Approved by'];
    const ready = approver && approver !== '—';
    return React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))',
        gap: 14
      }
    }, React.createElement("div", {
      "data-rules": "1",
      style: {
        background: 'linear-gradient(152deg,rgba(255,255,255,.78),rgba(236,247,255,.48))',
        backdropFilter: 'blur(24px) saturate(1.7)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.7)',
        border: '1px solid rgba(255,255,255,.92)',
        borderRadius: 16,
        boxShadow: '0 14px 40px rgba(31,59,90,.13),inset 0 1px 0 rgba(255,255,255,.95)',
        overflow: 'hidden'
      }
    }, React.createElement("div", {
      style: ROS_CARD_HEAD
    }, React.createElement("span", {
      style: rosBadge('rgba(210,58,82,.12)', '#a92c42', 26)
    }, React.createElement(Ic, {
      d: "M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6zM12 8v4M12 16h.01",
      s: 14,
      sw: 2
    })), React.createElement("h3", {
      style: ROS_H3
    }, "Rule checks"), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("span", {
      style: rosChipS(ev.okRules === ev.rules.length ? '#157a43' : '#b5670a', ev.okRules === ev.rules.length ? 'rgba(31,157,87,.13)' : 'rgba(224,138,30,.14)')
    }, ev.okRules, " of ", ev.rules.length, " clear")), React.createElement("div", null, ev.rules.map(([rule, base, list], i) => React.createElement("div", {
      key: rule + i,
      style: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 16px',
        borderBottom: '1px solid rgba(125,145,180,.12)'
      }
    }, React.createElement("span", {
      style: {
        display: 'inline-grid',
        placeItems: 'center',
        width: 18,
        height: 18,
        borderRadius: '50%',
        flexShrink: 0,
        marginTop: 1,
        color: '#fff',
        background: list.length ? 'linear-gradient(135deg,#e8697f,#a92c42)' : 'linear-gradient(135deg,#2fbf7f,#157a43)'
      }
    }, React.createElement(Ic, {
      d: list.length ? 'M18 6L6 18M6 6l12 12' : 'M4 12l5 5L20 6',
      s: 10,
      sw: 3.4
    })), React.createElement("div", {
      style: {
        minWidth: 0,
        flex: 1
      }
    }, React.createElement("div", {
      style: {
        fontSize: 12,
        fontWeight: 600,
        color: '#16202e'
      }
    }, rule), React.createElement("div", {
      style: {
        fontSize: 11,
        color: '#6c7a8c',
        lineHeight: 1.5
      }
    }, list.length ? list.slice(0, 3).join(' · ') + (list.length > 3 ? ' +' + (list.length - 3) + ' more' : '') : base)), React.createElement("span", {
      style: rosChipS(list.length ? '#a92c42' : '#157a43', list.length ? 'rgba(210,58,82,.12)' : 'rgba(31,157,87,.13)')
    }, list.length ? String(list.length) : 'ok'))))), React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 14
      }
    }, React.createElement("div", {
      style: {
        background: 'linear-gradient(152deg,rgba(255,255,255,.78),rgba(236,247,255,.48))',
        backdropFilter: 'blur(24px) saturate(1.7)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.7)',
        border: '1px solid rgba(255,255,255,.92)',
        borderRadius: 16,
        boxShadow: '0 14px 40px rgba(31,59,90,.13),inset 0 1px 0 rgba(255,255,255,.95)',
        padding: '14px 16px'
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        marginBottom: 11
      }
    }, React.createElement("span", {
      style: rosBadge('rgba(106,82,212,.12)', '#5b45c4', 26)
    }, React.createElement(Ic, {
      d: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM19 8v6M22 11h-6",
      s: 14,
      sw: 1.9
    })), React.createElement("h3", {
      style: ROS_H3
    }, "Float pool suggestions")), React.createElement("div", {
      style: {
        fontSize: 11.5,
        color: '#6c7a8c',
        lineHeight: 1.6,
        marginBottom: 10
      }
    }, "Staff from other units marked ", React.createElement("b", null, "available for redeployment"), " and competent in ", dept, "."), React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }
    }, floatPool.map(f => React.createElement("div", {
      key: f.empId,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        background: 'rgba(255,255,255,.6)',
        border: '1px solid rgba(255,255,255,.9)',
        borderRadius: 10,
        padding: '8px 10px'
      }
    }, React.createElement(MK.Av, {
      name: f.name,
      empId: f.empId,
      size: 30,
      radius: rosAvRadius(30)
    }), React.createElement("div", {
      style: {
        minWidth: 0,
        flex: 1
      }
    }, React.createElement("div", {
      style: {
        fontSize: 12,
        fontWeight: 600,
        color: '#16202e',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, f.name), React.createElement("div", {
      style: {
        fontSize: 10,
        color: '#9aa6b4'
      }
    }, f.home, " \xB7 ", f.level, " in ", dept)), React.createElement("span", {
      style: rosChipS(f.c, f.bg)
    }, f.lvlShort))), floatPool.length === 0 && React.createElement("div", {
      style: {
        fontSize: 11.5,
        color: '#9aa6b4'
      }
    }, "No other units have staff on the register yet."))), React.createElement("div", {
      style: {
        background: 'linear-gradient(152deg,rgba(255,255,255,.78),rgba(236,247,255,.48))',
        backdropFilter: 'blur(24px) saturate(1.7)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.7)',
        border: '1px solid rgba(255,255,255,.92)',
        borderRadius: 16,
        boxShadow: '0 14px 40px rgba(31,59,90,.13),inset 0 1px 0 rgba(255,255,255,.95)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 22,
        flexWrap: 'wrap'
      }
    }, React.createElement("div", {
      style: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        marginBottom: 4
      }
    }, React.createElement("span", {
      style: rosBadge('rgba(0,144,202,.12)', '#0072a3', 24, 7)
    }, React.createElement(Ic, {
      d: "M4 20h16M6 16l10-10 3 3-10 10H6z",
      s: 13,
      sw: 1.9
    })), React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: 700,
        color: '#16202e'
      }
    }, "Sign-off"), React.createElement("span", {
      style: {
        fontSize: 10.5,
        color: '#9aa6b4'
      }
    }, "pick the names, then approve")), [['Prepared by', 'Nurse In-charge, ' + dept], ['Checked by', 'CNS'], ['Approved by', 'Chief of Nursing Services']].map(([role, title]) => {
      const val = sign[role] !== undefined && sign[role] !== '' ? sign[role] : '—';
      const pool = role === 'Prepared by' ? ['—'].concat(rows.map(r => r.name)) : ['—'].concat(allNames);
      const opts = pool.indexOf(val) >= 0 ? pool : [val].concat(pool);
      const stamped = role === 'Approved by' ? !!approvedAt : val !== '—';
      return React.createElement("div", {
        key: role,
        style: {
          minWidth: 186,
          flex: 1
        }
      }, React.createElement("div", {
        style: {
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: .6,
          textTransform: 'uppercase',
          color: '#7d8ea8'
        }
      }, role), React.createElement("select", {
        value: val,
        onChange: e => {
          const v = e.target.value;
          setSign(s => ({
            ...s,
            [role]: v
          }));
          setDirty(true);
        },
        style: {
          width: '100%',
          boxSizing: 'border-box',
          marginTop: 4,
          padding: '7px 9px',
          borderRadius: 8,
          border: '1px solid ' + (val === '—' ? 'rgba(125,145,180,.3)' : 'rgba(0,144,202,.32)'),
          background: val === '—' ? 'rgba(255,255,255,.6)' : 'rgba(0,144,202,.07)',
          fontFamily: 'inherit',
          fontSize: 12,
          fontWeight: 600,
          color: val === '—' ? '#9aa6b4' : '#16202e',
          outline: 'none'
        }
      }, opts.map(v => React.createElement("option", {
        key: v,
        value: v
      }, v))), React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          marginTop: 4
        }
      }, React.createElement("span", {
        style: {
          fontSize: 10.5,
          color: '#9aa6b4'
        }
      }, title), React.createElement("span", {
        style: {
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: .4,
          textTransform: 'uppercase',
          color: stamped ? '#157a43' : '#b6c0cc',
          background: stamped ? 'rgba(31,157,87,.13)' : 'rgba(125,145,180,.12)',
          padding: '2px 7px',
          borderRadius: 8,
          whiteSpace: 'nowrap'
        }
      }, role === 'Approved by' && approvedAt ? 'signed ' + approvedAt : stamped ? 'set' : 'not set')));
    }), React.createElement("div", {
      style: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        flexWrap: 'wrap',
        borderTop: '1px solid rgba(125,145,180,.18)',
        paddingTop: 11,
        marginTop: 4
      }
    }, React.createElement("div", {
      style: {
        fontSize: 10.5,
        color: '#9aa6b4',
        flex: 1,
        minWidth: 180
      }
    }, approvedAt ? 'Approved on ' + approvedAt + ' — the roster is locked for publication.' : ready ? 'Ready for the CNS to sign.' : 'Choose an approver above to enable signing.'), React.createElement("button", {
      onClick: () => {
        if (!ready || approvedAt) return;
        Promise.resolve(save('submitted', true)).then(ok => {
          if (ok !== false) setStatusRemote('approved', {
            approvedBy: approver
          });
        });
      },
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        border: '1px solid rgba(255,255,255,.4)',
        background: approvedAt ? 'linear-gradient(135deg,#2fbf7f,#157a43)' : ready ? 'linear-gradient(135deg,#27a8db,#0072a3)' : 'linear-gradient(135deg,#9fb3c8,#7d8ea8)',
        color: '#fff',
        padding: '8px 14px',
        borderRadius: 9,
        fontSize: 11.5,
        fontWeight: 700,
        cursor: ready ? 'pointer' : 'default',
        fontFamily: 'inherit',
        boxShadow: ready && !approvedAt ? '0 7px 18px rgba(0,144,202,.35)' : 'none',
        opacity: ready || approvedAt ? 1 : .6,
        flexShrink: 0
      }
    }, React.createElement(Ic, {
      d: "M4 12l5 5L20 6",
      s: 13,
      sw: 2.4
    }), approvedAt ? 'Approved' : 'Sign & approve')))));
  })(), pick && (() => {
    const vh = window.innerHeight,
      vw = window.innerWidth;
    const below = vh - pick.cellBottom - 14,
      above = pick.cellTop - 14;
    const flip = below < 260 && above > below;
    const room = Math.max(180, Math.min(Math.round(vh * 0.7), flip ? above : below));
    const pickStyle = {
      position: 'fixed',
      left: Math.min(Math.max(124, pick.x), vw - 130),
      transform: 'translateX(-50%)',
      top: flip ? 'auto' : pick.cellBottom + 6,
      bottom: flip ? vh - pick.cellTop + 6 : 'auto',
      maxHeight: room,
      overflowY: 'auto',
      zIndex: 4000,
      width: 240,
      background: 'linear-gradient(158deg,rgba(255,255,255,.99),rgba(240,247,254,.97))',
      border: '1px solid rgba(125,145,180,.28)',
      borderRadius: 13,
      boxShadow: '0 22px 56px rgba(31,59,90,.28)',
      animation: 'rosPop .16s cubic-bezier(.2,.7,.3,1) both'
    };
    const current = cellCode(pick.empId, pick.d);
    const doPick = k => {
      push();
      setCells(g => writeCell(g, pick.empId, pick.d, k));
      setPick(null);
    };
    return React.createElement(React.Fragment, null, React.createElement("div", {
      onClick: () => setPick(null),
      style: {
        position: 'fixed',
        inset: 0,
        zIndex: 3900
      }
    }), React.createElement("div", {
      style: pickStyle
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '9px 12px',
        borderBottom: '1px solid rgba(125,145,180,.2)',
        background: 'rgba(233,243,252,.6)'
      }
    }, React.createElement("span", {
      style: {
        fontSize: 11.5,
        fontWeight: 700,
        color: '#16202e',
        whiteSpace: 'nowrap'
      }
    }, pick.name), React.createElement("span", {
      style: {
        fontSize: 10.5,
        color: '#6c7a8c',
        whiteSpace: 'nowrap'
      }
    }, "Day ", pick.d, " \xB7 ", dowOf(pick.d)), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("span", {
      className: "ros-x",
      onClick: () => setPick(null),
      style: {
        cursor: 'pointer',
        color: '#9aa6b4',
        display: 'grid',
        placeItems: 'center',
        width: 20,
        height: 20,
        borderRadius: 6
      }
    }, React.createElement(Ic, {
      d: "M18 6L6 18M6 6l12 12",
      s: 12,
      sw: 2.4
    }))), React.createElement("div", {
      style: {
        padding: '9px 11px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }
    }, [['G', 'General', '#6a52d4'], ['M', 'Morning', '#b5670a'], ['E', 'Evening', '#0072a3'], ['N', 'Night', '#5b45c4'], ['O', 'Leave / off', '#7d8ea8']].map(([b, label, color]) => React.createElement("div", {
      key: b
    }, React.createElement("div", {
      style: {
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: .8,
        textTransform: 'uppercase',
        color,
        marginBottom: 5
      }
    }, label), React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 3
      }
    }, R.SHIFTS.filter(s => s.bucket === b).map(s => {
      const on = current === s.code;
      return React.createElement("div", {
        key: s.code,
        onClick: () => doPick(s.code),
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 9px',
          borderRadius: 8,
          cursor: 'pointer',
          color: on ? color : '#3c4858',
          background: on ? color + '16' : 'transparent',
          border: '1px solid ' + (on ? color + '4d' : 'transparent'),
          fontWeight: on ? 700 : 500
        }
      }, React.createElement("b", {
        style: {
          fontFamily: ROS_MONO,
          fontSize: 10,
          minWidth: 30,
          flexShrink: 0
        }
      }, s.code), React.createElement("span", {
        style: {
          fontSize: 10.5,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }
      }, s.label));
    })))), React.createElement("div", null, React.createElement("div", {
      style: {
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: .8,
        textTransform: 'uppercase',
        color: '#9fb0c4',
        marginBottom: 5
      }
    }, "Clear"), React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 3
      }
    }, React.createElement("div", {
      onClick: () => doPick(''),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 9px',
        borderRadius: 8,
        cursor: 'pointer',
        color: '#a92c42',
        background: 'rgba(210,58,82,.08)',
        border: '1px solid rgba(210,58,82,.24)'
      }
    }, React.createElement("b", {
      style: {
        fontFamily: ROS_MONO,
        fontSize: 10,
        minWidth: 30,
        flexShrink: 0
      }
    }, "\u2014"), React.createElement("span", {
      style: {
        fontSize: 10.5
      }
    }, "Not assigned")))))));
  })(), queue.length > 0 && (() => {
    const nameOf = id => (rows.find(r => r.empId === id) || {}).name || id;
    const firstOf = id => String(nameOf(id)).split(' ')[0];
    const BN = {
      G: 'General',
      M: 'Morning',
      E: 'Evening',
      N: 'Night',
      O: 'Leave / off'
    };
    const chip = (label, c) => ({
      label,
      style: {
        fontSize: 9,
        fontWeight: 700,
        color: c,
        background: c + '16',
        border: '1px solid ' + c + '33',
        padding: '2px 7px',
        borderRadius: 8,
        whiteSpace: 'nowrap'
      }
    });
    const qRows = queue.map(q => {
      const aB = R.bucketOf(q.aCode) || '',
        bB = R.bucketOf(q.bCode) || '';
      const warns = [];
      const after = (id, d) => {
        if (id === q.bId && d === q.bDi) return q.aCode;
        if (id === q.aId && d === q.aDi) return q.mode === 'swap' ? q.bCode : '';
        return cellCode(id, d);
      };
      const bAt = (id, d) => R.bucketOf(after(id, d)) || '';
      if (bAt(q.bId, q.bDi - 1) === 'N' && bAt(q.bId, q.bDi) === 'M') warns.push(firstOf(q.bId) + ' would work night → morning.');
      if (bAt(q.bId, q.bDi) === 'N' && bAt(q.bId, q.bDi + 1) === 'M') warns.push(firstOf(q.bId) + ' has a morning right after this night.');
      [q.aDi, q.bDi].filter((v, i, arr) => arr.indexOf(v) === i).forEach(d => {
        ['M', 'E', 'N'].forEach(bk => {
          let n = 0;
          rows.forEach(x => {
            if (bAt(x.empId, d) === bk) n++;
          });
          const floor = bk === 'M' ? cfg.minM : bk === 'E' ? cfg.minE : cfg.minN;
          if (n < floor) warns.push('Day ' + d + ' ' + BN[bk].toLowerCase() + ' drops to ' + n + ' (floor ' + floor + ').');
        });
        let sen = false;
        rows.forEach(x => {
          if (bAt(x.empId, d) === 'N' && /Senior|Team|Charge/.test(x.desig || '')) sen = true;
        });
        if (!sen) warns.push('Day ' + d + ' night would have no senior nurse.');
      });
      let run = 0,
        maxRun = 0;
      for (let d = 1; d <= days; d++) {
        if (bAt(q.bId, d) === 'N') {
          run++;
          maxRun = Math.max(maxRun, run);
        } else run = 0;
      }
      if (maxRun > cfg.maxNights) warns.push(firstOf(q.bId) + ' would hit ' + maxRun + ' nights in a row (max ' + cfg.maxNights + ').');
      const sameKind = aB === bB;
      const aCol = rosBColor(aB),
        bCol = rosBColor(bB);
      const aH = R.hoursOf(q.aCode),
        bH = R.hoursOf(q.bCode);
      const deltas = [];
      const aDelta = q.mode === 'swap' ? bH - aH : -aH;
      const bDelta = aH - bH;
      deltas.push(chip(firstOf(q.aId) + ' ' + (aDelta >= 0 ? '+' : '') + aDelta + ' h', aDelta === 0 ? '#6c7a8c' : aDelta > 0 ? '#b5670a' : '#157a43'));
      if (q.aId !== q.bId) deltas.push(chip(firstOf(q.bId) + ' ' + (bDelta >= 0 ? '+' : '') + bDelta + ' h', bDelta === 0 ? '#6c7a8c' : bDelta > 0 ? '#b5670a' : '#157a43'));
      [q.aDi, q.bDi].filter((v, i, arr) => arr.indexOf(v) === i).forEach(d => {
        const before = onDutyOf(d);
        let aft = 0;
        rows.forEach(x => {
          const bb = bAt(x.empId, d);
          if (bb && bb !== 'O') aft++;
        });
        const dd = aft - before;
        deltas.push(chip('Day ' + d + ' cover ' + before + '→' + aft, dd === 0 ? '#0072a3' : dd > 0 ? '#157a43' : '#a92c42'));
      });
      return {
        q,
        warns,
        deltas,
        mode: q.mode === 'swap' ? 'SWAP' : 'MOVE',
        variation: (BN[aB] || '—') + ' → ' + (BN[bB] || '—'),
        varStyle: {
          fontSize: 9.5,
          fontWeight: 700,
          color: sameKind ? '#6c7a8c' : '#5b45c4',
          background: sameKind ? 'rgba(125,145,180,.14)' : 'rgba(106,82,212,.12)',
          border: '1px solid ' + (sameKind ? 'rgba(125,145,180,.24)' : 'rgba(106,82,212,.26)'),
          padding: '2px 8px',
          borderRadius: 8,
          whiteSpace: 'nowrap'
        },
        cardStyle: {
          background: warns.length ? 'linear-gradient(150deg,rgba(255,241,243,.95),rgba(255,255,255,.9))' : 'rgba(255,255,255,.85)',
          border: '1px solid ' + (warns.length ? 'rgba(210,58,82,.3)' : 'rgba(125,145,180,.22)'),
          borderLeft: '3px solid ' + (warns.length ? '#d23a52' : 'rgba(0,144,202,.5)'),
          borderRadius: 11,
          padding: '9px 10px',
          boxShadow: warns.length ? '0 3px 12px rgba(210,58,82,.12)' : '0 2px 8px rgba(31,59,90,.06)'
        },
        aTime: R.BY_CODE[q.aCode] ? R.BY_CODE[q.aCode].label + ' · ' + aH + ' h' : 'unassigned',
        bTime: R.BY_CODE[q.bCode] ? R.BY_CODE[q.bCode].label + ' · ' + bH + ' h' : 'unassigned',
        aCodeStyle: {
          fontFamily: ROS_MONO,
          fontSize: 9.5,
          fontWeight: 700,
          color: q.aCode ? aB === 'O' ? '#6c7a8c' : '#fff' : '#9aa6b4',
          background: q.aCode ? aB === 'O' ? 'rgba(125,145,180,.2)' : aCol : 'rgba(125,145,180,.12)',
          padding: '1px 6px',
          borderRadius: 5,
          flexShrink: 0
        },
        bCodeStyle: {
          fontFamily: ROS_MONO,
          fontSize: 9.5,
          fontWeight: 700,
          color: q.bCode ? bB === 'O' ? '#6c7a8c' : '#fff' : '#9aa6b4',
          background: q.bCode ? bB === 'O' ? 'rgba(125,145,180,.2)' : bCol : 'rgba(125,145,180,.12)',
          padding: '1px 6px',
          borderRadius: 5,
          flexShrink: 0
        },
        modeStyle: {
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: .6,
          color: '#fff',
          background: q.mode === 'swap' ? 'linear-gradient(135deg,#27a8db,#0072a3)' : 'linear-gradient(135deg,#8a74e8,#5b45c4)',
          padding: '2px 7px',
          borderRadius: 6,
          flexShrink: 0
        }
      };
    });
    const cross = queue.filter(q => q.aId !== q.bId).length;
    return React.createElement("div", {
      style: {
        position: 'fixed',
        right: 18,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 4300,
        width: 296,
        maxHeight: '76vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(158deg,rgba(255,255,255,.98),rgba(238,246,254,.96))',
        border: '1px solid rgba(255,255,255,.95)',
        borderRadius: 16,
        boxShadow: '0 26px 64px rgba(31,59,90,.28)',
        animation: 'rosSlideInY .26s cubic-bezier(.2,.75,.3,1) both'
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '13px 15px',
        borderBottom: '1px solid rgba(125,145,180,.2)',
        background: 'linear-gradient(180deg,rgba(233,243,252,.75),rgba(255,255,255,.4))',
        borderRadius: '16px 16px 0 0'
      }
    }, React.createElement("span", {
      style: rosBadge('rgba(0,144,202,.13)', '#0072a3', 30, 9)
    }, React.createElement(Ic, {
      d: "M7 16H3l4-4M17 8h4l-4 4M3 16h14M21 8H7",
      s: 15,
      sw: 1.9
    })), React.createElement("div", {
      style: {
        minWidth: 0,
        flex: 1
      }
    }, React.createElement("div", {
      style: {
        fontSize: 12.5,
        fontWeight: 800,
        color: '#16202e'
      }
    }, "Pending changes"), React.createElement("div", {
      style: {
        fontSize: 10.5,
        color: '#6c7a8c'
      }
    }, queue.length + (queue.length === 1 ? ' change' : ' changes'), " \xB7 not saved yet")), React.createElement("span", {
      className: "ros-xred",
      onClick: () => setQueue([]),
      title: "Discard all",
      style: {
        cursor: 'pointer',
        color: '#9aa6b4',
        display: 'grid',
        placeItems: 'center',
        width: 24,
        height: 24,
        borderRadius: 7,
        flexShrink: 0
      }
    }, React.createElement(Ic, {
      d: "M18 6L6 18M6 6l12 12",
      s: 13,
      sw: 2.4
    }))), React.createElement("div", {
      style: {
        flex: 1,
        overflowY: 'auto',
        padding: '11px 13px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }
    }, qRows.map(r => React.createElement("div", {
      key: r.q.key,
      style: r.cardStyle
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 7,
        flexWrap: 'wrap'
      }
    }, React.createElement("span", {
      style: r.modeStyle
    }, r.mode), React.createElement("span", {
      style: r.varStyle
    }, r.variation), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("span", {
      className: "ros-xred",
      onClick: () => setQueue(s => s.filter(x => x.key !== r.q.key)),
      title: "Remove",
      style: {
        cursor: 'pointer',
        color: '#b6c0cc',
        display: 'grid',
        placeItems: 'center',
        width: 18,
        height: 18,
        borderRadius: 5,
        flexShrink: 0
      }
    }, React.createElement(Ic, {
      d: "M18 6L6 18M6 6l12 12",
      s: 10,
      sw: 3
    }))), React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 7
      }
    }, React.createElement("div", {
      style: {
        minWidth: 0,
        flex: 1
      }
    }, React.createElement("div", {
      style: {
        fontSize: 11,
        fontWeight: 600,
        color: '#16202e',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, nameOf(r.q.aId)), React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        marginTop: 2
      }
    }, React.createElement("span", {
      style: r.aCodeStyle
    }, r.q.aCode || '—'), React.createElement("span", {
      style: {
        fontSize: 9.5,
        color: '#9aa6b4'
      }
    }, "Day ", r.q.aDi)), React.createElement("div", {
      style: {
        fontSize: 9.5,
        color: '#6c7a8c',
        fontFamily: ROS_MONO,
        marginTop: 2,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, r.aTime)), React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#0090ca",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: {
        flexShrink: 0
      }
    }, React.createElement("path", {
      d: "M7 16H3l4-4M17 8h4l-4 4M3 16h14M21 8H7"
    })), React.createElement("div", {
      style: {
        minWidth: 0,
        flex: 1
      }
    }, React.createElement("div", {
      style: {
        fontSize: 11,
        fontWeight: 600,
        color: '#16202e',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, nameOf(r.q.bId)), React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        marginTop: 2
      }
    }, React.createElement("span", {
      style: r.bCodeStyle
    }, r.q.bCode || '—'), React.createElement("span", {
      style: {
        fontSize: 9.5,
        color: '#9aa6b4'
      }
    }, "Day ", r.q.bDi)), React.createElement("div", {
      style: {
        fontSize: 9.5,
        color: '#6c7a8c',
        fontFamily: ROS_MONO,
        marginTop: 2,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, r.bTime))), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 5,
        flexWrap: 'wrap',
        marginTop: 7,
        paddingTop: 7,
        borderTop: '1px solid rgba(125,145,180,.16)'
      }
    }, r.deltas.map((d2, i) => React.createElement("span", {
      key: i,
      style: d2.style
    }, d2.label))), r.warns.length > 0 && React.createElement("div", {
      style: {
        marginTop: 7,
        background: 'rgba(210,58,82,.09)',
        border: '1px solid rgba(210,58,82,.22)',
        borderRadius: 8,
        padding: '7px 9px'
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4
      }
    }, React.createElement("svg", {
      width: "12",
      height: "12",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#a92c42",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: {
        flexShrink: 0
      }
    }, React.createElement("path", {
      d: "M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0zM12 9v4M12 17h.01"
    })), React.createElement("span", {
      style: {
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: .6,
        textTransform: 'uppercase',
        color: '#a92c42'
      }
    }, "Rule alert"), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("span", {
      style: {
        fontSize: 9,
        fontWeight: 700,
        color: '#a92c42'
      }
    }, r.warns.length > 3 ? '+' + (r.warns.length - 3) + ' more' : '')), r.warns.slice(0, 3).map((a, i) => React.createElement("div", {
      key: i,
      style: {
        fontSize: 10,
        color: '#7a1f30',
        lineHeight: 1.5
      }
    }, "\xB7 ", a)))))), React.createElement("div", {
      style: {
        padding: '11px 13px',
        borderTop: '1px solid rgba(125,145,180,.2)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }
    }, React.createElement("div", {
      style: {
        fontSize: 10.5,
        color: '#6c7a8c',
        background: 'rgba(0,144,202,.08)',
        borderRadius: 8,
        padding: '7px 9px',
        lineHeight: 1.45
      }
    }, cross ? cross + ' cross-nurse ' + (cross === 1 ? 'swap' : 'swaps') + ' will be logged for the CNS' : 'Same-nurse moves only — no approval needed'), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8
      }
    }, React.createElement("button", {
      onClick: () => setQueue([]),
      style: {
        flex: 1,
        border: '1px solid rgba(125,145,180,.32)',
        background: 'rgba(255,255,255,.8)',
        color: '#3c4858',
        padding: '9px 12px',
        borderRadius: 9,
        fontSize: 11.5,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit'
      }
    }, "Discard"), React.createElement("button", {
      className: "ros-lift",
      onClick: saveQueue,
      style: {
        flex: 1.4,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        border: '1px solid rgba(255,255,255,.4)',
        background: 'linear-gradient(135deg,#2fbf7f,#157a43)',
        color: '#fff',
        padding: '9px 12px',
        borderRadius: 9,
        fontSize: 11.5,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
        boxShadow: '0 8px 20px rgba(31,157,87,.35)'
      }
    }, React.createElement(Ic, {
      d: "M4 12l5 5L20 6",
      s: 13,
      sw: 2.4
    }), "Confirm & save"))));
  })(), !!savedBatch && React.createElement("div", {
    style: {
      position: 'fixed',
      right: 18,
      bottom: 20,
      zIndex: 4400,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: 'linear-gradient(158deg,rgba(255,255,255,.98),rgba(236,252,244,.96))',
      border: '1px solid rgba(31,157,87,.3)',
      borderRadius: 13,
      padding: '12px 15px',
      boxShadow: '0 20px 48px rgba(31,59,90,.24)',
      animation: 'rosSlideIn .24s cubic-bezier(.2,.75,.3,1) both'
    }
  }, React.createElement("span", {
    style: rosBadge('rgba(31,157,87,.15)', '#157a43', 28, '50%')
  }, React.createElement(Ic, {
    d: "M4 12l5 5L20 6",
    s: 15,
    sw: 3
  })), React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      color: '#16202e'
    }
  }, savedBatch), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: '#6c7a8c'
    }
  }, "Logged in Shift swaps \xB7 Undo is still available")), React.createElement("span", {
    className: "ros-x",
    onClick: () => setSavedBatch(null),
    style: {
      cursor: 'pointer',
      color: '#9aa6b4',
      display: 'grid',
      placeItems: 'center',
      width: 22,
      height: 22,
      borderRadius: 6,
      flexShrink: 0
    }
  }, React.createElement(Ic, {
    d: "M18 6L6 18M6 6l12 12",
    s: 12,
    sw: 2.4
  }))), dayPop != null && (() => {
    const d = dayPop;
    const on = onDutyOf(d);
    const covC = on >= 4 ? '#157a43' : '#a92c42';
    const offOut = [];
    rows.forEach(x => {
      const c = cellCode(x.empId, d);
      if (R.bucketOf(c) === 'O') offOut.push(String(x.name).split(' ')[0] + ' · ' + c);
    });
    return React.createElement("div", {
      onClick: () => setDayPop(null),
      style: {
        position: 'fixed',
        inset: 0,
        zIndex: 4200,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(31,59,90,.32)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)'
      }
    }, React.createElement("div", {
      onClick: e2 => e2.stopPropagation(),
      style: {
        width: 'min(580px,92vw)',
        maxHeight: '86vh',
        overflowY: 'auto',
        background: 'linear-gradient(158deg,rgba(255,255,255,.98),rgba(238,246,254,.96))',
        border: '1px solid rgba(255,255,255,.95)',
        borderRadius: 18,
        boxShadow: '0 30px 80px rgba(31,59,90,.3)',
        animation: 'rosPopCard .28s cubic-bezier(.2,.85,.3,1.1) both'
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '15px 18px',
        borderBottom: '1px solid rgba(125,145,180,.2)',
        background: 'linear-gradient(180deg,rgba(233,243,252,.7),rgba(255,255,255,.4))'
      }
    }, React.createElement("span", {
      style: rosBadge('rgba(0,144,202,.12)', '#0072a3', 36, 11)
    }, React.createElement(Ic, {
      d: "M3 5h18v16H3zM3 9h18M8 3v4M16 3v4",
      s: 17,
      sw: 1.9
    })), React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        fontSize: 15,
        fontWeight: 800,
        color: '#16202e'
      }
    }, d, " ", R.MONTHS[month], " \xB7 ", dowOf(d)), React.createElement("div", {
      style: {
        fontSize: 11,
        color: '#6c7a8c',
        marginTop: 1
      }
    }, dept, " \xB7 ", rosIsFri(year, month, d) ? 'weekly holiday' : 'working day')), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: covC,
        background: covC + '16',
        border: '1px solid ' + covC + '33',
        padding: '5px 11px',
        borderRadius: 14,
        whiteSpace: 'nowrap',
        flexShrink: 0
      }
    }, on, " of ", rows.length, " on duty"), React.createElement("span", {
      className: "ros-x",
      onClick: () => setDayPop(null),
      style: {
        cursor: 'pointer',
        color: '#9aa6b4',
        display: 'grid',
        placeItems: 'center',
        width: 26,
        height: 26,
        borderRadius: 8,
        flexShrink: 0
      }
    }, React.createElement(Ic, {
      d: "M18 6L6 18M6 6l12 12",
      s: 14,
      sw: 2.4
    }))), React.createElement("div", {
      style: {
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 13
      }
    }, ROS_BUCKETS.map(([b, label]) => {
      const col = ROS_TONE[b];
      const people = [];
      rows.forEach(x => {
        const c = cellCode(x.empId, d);
        if (R.bucketOf(c) === b) people.push({
          x,
          c
        });
      });
      return React.createElement("div", {
        key: b
      }, React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 7
        }
      }, React.createElement("span", {
        style: {
          width: 8,
          height: 8,
          borderRadius: 3,
          background: col,
          flexShrink: 0
        }
      }), React.createElement("span", {
        style: {
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: .8,
          textTransform: 'uppercase',
          color: col
        }
      }, label), React.createElement("span", {
        style: {
          fontSize: 10,
          color: '#7d8ea8'
        }
      }, ROS_WINDOWS[b]), React.createElement("span", {
        style: {
          flex: 1
        }
      }), React.createElement("span", {
        style: {
          fontFamily: ROS_MONO,
          fontSize: 11,
          fontWeight: 800,
          color: people.length ? col : '#a92c42',
          background: people.length ? col + '16' : 'rgba(210,58,82,.1)',
          padding: '2px 8px',
          borderRadius: 9
        }
      }, people.length)), React.createElement("div", {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: 5
        }
      }, people.map(p => React.createElement("div", {
        key: p.x.empId,
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          background: 'rgba(255,255,255,.85)',
          border: '1px solid rgba(125,145,180,.2)',
          borderRadius: 10,
          padding: '7px 10px',
          boxShadow: '0 2px 6px rgba(31,59,90,.05)'
        }
      }, React.createElement(MK.Av, {
        name: p.x.name,
        empId: p.x.empId,
        size: 28,
        radius: rosAvRadius(28)
      }), React.createElement("div", {
        style: {
          minWidth: 0,
          flex: 1
        }
      }, React.createElement("div", {
        style: {
          fontSize: 12,
          fontWeight: 600,
          color: '#16202e',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }
      }, p.x.name), React.createElement("div", {
        style: {
          fontSize: 10,
          color: '#9aa6b4'
        }
      }, p.x.desig || '—')), React.createElement("span", {
        style: {
          fontFamily: ROS_MONO,
          fontSize: 10,
          fontWeight: 700,
          color: '#fff',
          background: rosBColor(b),
          padding: '2px 7px',
          borderRadius: 6,
          flexShrink: 0
        }
      }, p.c), React.createElement("span", {
        style: {
          fontFamily: ROS_MONO,
          fontSize: 10,
          color: '#6c7a8c',
          whiteSpace: 'nowrap'
        }
      }, (R.BY_CODE[p.c] || {}).label || ''))), people.length === 0 && React.createElement("div", {
        style: {
          fontSize: 11,
          fontWeight: 600,
          color: '#a92c42',
          background: 'rgba(210,58,82,.09)',
          border: '1px solid rgba(210,58,82,.22)',
          borderRadius: 9,
          padding: '7px 10px'
        }
      }, "Uncovered \u2014 no one rostered.")));
    }), React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        flexWrap: 'wrap',
        borderTop: '1px solid rgba(125,145,180,.2)',
        paddingTop: 12
      }
    }, React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: .8,
        textTransform: 'uppercase',
        color: '#7d8ea8'
      }
    }, "Off / leave"), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 5,
        flexWrap: 'wrap',
        flex: 1
      }
    }, offOut.map((label, i) => React.createElement("span", {
      key: i,
      style: {
        fontSize: 10,
        fontWeight: 600,
        color: '#6c7a8c',
        background: 'rgba(255,255,255,.8)',
        border: '1px solid rgba(125,145,180,.25)',
        padding: '3px 9px',
        borderRadius: 10,
        whiteSpace: 'nowrap'
      }
    }, label)), offOut.length === 0 && React.createElement("span", {
      style: {
        fontSize: 11,
        color: '#9aa6b4'
      }
    }, "Everyone on duty")), React.createElement("button", {
      className: "ros-goday",
      onClick: () => {
        setView('day');
        setDay(d);
        setDayPop(null);
      },
      style: {
        border: '1px solid rgba(0,144,202,.3)',
        background: 'rgba(0,144,202,.09)',
        color: '#0072a3',
        padding: '7px 13px',
        borderRadius: 9,
        fontSize: 11.5,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
        flexShrink: 0
      }
    }, "Open day view \u203A")))));
  })());
}
function RosterPrint({
  staffStore,
  dept,
  year,
  month,
  setRoute
}) {
  const days = R.daysIn(year, month);
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    rosApi.get('/api/rosters/' + encodeURIComponent(dept) + '/' + year + '/' + month).then(r => {
      setDoc(r && r.ok ? r.roster : null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [dept, year, month]);
  const staff = useMemo(() => (staffStore.staff || []).filter(e => e.is_active !== false && !e.former && (e.current_department || 'Unassigned') === dept).map(e => ({
    empId: rosKey(e),
    empIdShown: e.emp_id || '',
    name: e.name,
    desig: e.designation
  })), [staffStore.staff, dept]);
  const order = doc && doc.order || [];
  const rows = useMemo(() => {
    if (!order.length) return staff;
    const by = {};
    staff.forEach(s => {
      by[s.empId] = s;
    });
    const out = [];
    const seen = {};
    order.forEach(id => {
      if (by[id] && !seen[id]) {
        out.push(by[id]);
        seen[id] = 1;
      }
    });
    staff.forEach(s => {
      if (!seen[s.empId]) out.push(s);
    });
    return out;
  }, [staff, order]);
  if (loading) return React.createElement("div", {
    style: {
      display: 'grid',
      placeItems: 'center',
      height: '40vh',
      color: 'var(--muted,#8aa0b8)'
    }
  }, "Loading\u2026");
  const grid = rosMigrateGrid(doc && doc.grid, staff);
  const sig = window.unicoSig && window.unicoSig.get && window.unicoSig.get() || {};
  const cell = {
    border: '1px solid #333',
    padding: '2px 3px',
    fontSize: 8.6,
    textAlign: 'center'
  };
  return React.createElement("div", null, React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 12
    }
  }, React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, React.createElement("button", {
    className: "btn",
    onClick: () => setRoute({
      view: 'rosterGrid',
      dept,
      year,
      month
    })
  }, "\u2039 Back to the grid"), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    className: "sub"
  }, "1:1 with the roster workbook"), React.createElement("button", {
    className: "btn pri",
    onClick: () => window.print()
  }, "Print / Save as PDF"))), React.createElement("div", {
    id: "pdf-root",
    style: {
      background: '#fff',
      color: '#111',
      padding: '16px 18px',
      borderRadius: 8,
      overflow: 'auto'
    }
  }, React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: 8
    }
  }, React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700
    }
  }, "Duty Roster For ", dept), React.createElement("div", {
    style: {
      fontSize: 11
    }
  }, R.MONTHS[month], " ", year, doc ? ' · revision ' + (doc.revision || 1) + ' · ' + (ROS_STATUS[doc.status] || ROS_STATUS.draft).label : ' · not yet drafted')), React.createElement("table", {
    style: {
      borderCollapse: 'collapse',
      width: '100%'
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: {
      ...cell,
      background: '#eef2f7',
      width: 22
    }
  }, "S/N"), React.createElement("th", {
    style: {
      ...cell,
      background: '#eef2f7',
      width: 52
    }
  }, "EMP-ID"), React.createElement("th", {
    style: {
      ...cell,
      background: '#eef2f7',
      textAlign: 'left',
      minWidth: 120
    }
  }, "Staff Name"), React.createElement("th", {
    style: {
      ...cell,
      background: '#eef2f7',
      textAlign: 'left',
      minWidth: 84
    }
  }, "Designation"), Array.from({
    length: days
  }, (_, i) => i + 1).map(d => {
    const dt = new Date(year, month, d);
    return React.createElement("th", {
      key: d,
      style: {
        ...cell,
        background: dt.getDay() === 5 ? '#e6ebf2' : '#eef2f7',
        width: 15
      }
    }, d);
  }), ['G', 'M', 'E', 'N', 'O'].map(b => React.createElement("th", {
    key: b,
    style: {
      ...cell,
      background: '#eef2f7',
      width: 16
    }
  }, b)), React.createElement("th", {
    style: {
      ...cell,
      background: '#eef2f7',
      width: 26
    }
  }, "Hours"))), React.createElement("tbody", null, rows.map((s, i) => {
    const row = grid[s.empId] || {};
    const t = R.totalsFor(row, days);
    return React.createElement("tr", {
      key: s.empId
    }, React.createElement("td", {
      style: cell
    }, i + 1), React.createElement("td", {
      style: cell
    }, s.empIdShown || '—'), React.createElement("td", {
      style: {
        ...cell,
        textAlign: 'left'
      }
    }, s.name), React.createElement("td", {
      style: {
        ...cell,
        textAlign: 'left'
      }
    }, s.desig || ''), Array.from({
      length: days
    }, (_, k) => k + 1).map(d => React.createElement("td", {
      key: d,
      style: cell
    }, row[d] || '')), ['G', 'M', 'E', 'N', 'O'].map(b => React.createElement("td", {
      key: b,
      style: cell
    }, t[b] || '')), React.createElement("td", {
      style: {
        ...cell,
        fontWeight: 700
      }
    }, t.hours || ''));
  }))), React.createElement("div", {
    style: {
      marginTop: 10,
      fontSize: 8.6
    }
  }, React.createElement("b", null, "NB:"), " Do not make changes without permission from the authorised person."), React.createElement("div", {
    style: {
      marginTop: 8,
      fontSize: 8.4
    }
  }, React.createElement(ShiftLegend, {
    compact: true
  })), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 24,
      marginTop: 34,
      fontSize: 10
    }
  }, [['Prepared By', doc && doc.preparedBy || sig.prepared], ['Checked By', doc && doc.checkedBy || sig.checked], ['Approved By', doc && doc.approvedBy || sig.approved]].map(([l, n]) => React.createElement("div", {
    key: l,
    style: {
      borderTop: '1px solid #333',
      paddingTop: 4
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 700
    }
  }, l), React.createElement("div", null, n || ''))))));
}
function RosterView({
  view,
  dept,
  year,
  month,
  setRoute
}) {
  const staffStore = window.useStaffStore();
  const index = useRosterIndex();
  const now = new Date();
  const y = Number(year) || now.getFullYear();
  const m = Number.isInteger(Number(month)) ? Number(month) : now.getMonth();
  const inner = (() => {
    if (view !== 'rosterHome' && !dept) return React.createElement(RosterHome, {
      index: index,
      staffStore: staffStore,
      setRoute: setRoute
    });
    switch (view) {
      case 'rosterGrid':
        return React.createElement(RosterGrid, {
          key: dept + '|' + y + '|' + m,
          staffStore: staffStore,
          dept: dept,
          year: y,
          month: m,
          setRoute: setRoute,
          onSaved: index.reload
        });
      case 'rosterReview':
        return React.createElement(RosterGrid, {
          key: dept + '|' + y + '|' + m + '|rules',
          staffStore: staffStore,
          dept: dept,
          year: y,
          month: m,
          setRoute: setRoute,
          onSaved: index.reload,
          initialView: "rules"
        });
      case 'rosterPrint':
        return React.createElement(RosterPrint, {
          staffStore: staffStore,
          dept: dept,
          year: y,
          month: m,
          setRoute: setRoute
        });
      default:
        return React.createElement(RosterHome, {
          index: index,
          staffStore: staffStore,
          setRoute: setRoute
        });
    }
  })();
  return React.createElement("div", {
    className: "mk-scope"
  }, inner);
}
window.RosterView = RosterView;
})();
;
/* ===== roster-review.jsx ===== */
(function(){
const {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback
} = React;
const Ic = window.Ic,
  I = window.I;
const R = window.UNICO_ROSTER;
const MK = window.MK;
const rrApi = {
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
  }).then(r => r.json())
};
const rrToast = (m, t) => {
  try {
    window.UI && window.UI.toast && window.UI.toast(m, t || 'success');
  } catch (e) {}
};
const rrCanDecide = () => {
  let edit = true,
    admin = true;
  try {
    edit = window.unicoCan ? window.unicoCan('roster', 'edit') : true;
  } catch (e) {
    edit = true;
  }
  try {
    const u = window.__UNICO_USER__;
    admin = !u || u.role === 'Administrator';
  } catch (e) {
    admin = true;
  }
  return edit && admin;
};
const RR_DIVS = [{
  id: 'cc',
  label: 'Critical Care',
  color: '#0090ca'
}, {
  id: 'mn',
  label: 'Maternal & Neonatal',
  color: '#3ab5a7'
}, {
  id: 'ac',
  label: 'Acute & Peri-op',
  color: '#6a52d4'
}, {
  id: 'other',
  label: 'Other',
  color: '#5b6b80'
}];
const RR_DIV_BY = {};
RR_DIVS.forEach(d => {
  RR_DIV_BY[d.id] = d;
});
const RR_DIV_ICON = {
  cc: 'pulse',
  mn: 'heart',
  ac: 'syringe',
  other: 'bed'
};
function rrDivisionOf(dept) {
  const name = String(dept || '').toUpperCase();
  const tok = name.split(/[^A-Z0-9]+/).filter(Boolean);
  const has = w => tok.indexOf(w) >= 0;
  const says = w => name.indexOf(w) >= 0;
  if (has('NICU') || has('LDR') || says('NEONAT') || says('LABOUR') || says('LABOR') || says('DELIVERY') || says('MATERNITY') || says('OBSTETRIC')) return 'mn';
  if (has('ICU') || has('SICU') || has('MICU') || has('CCU') || has('ITU') || has('HDU') || says('CRITICAL') || says('INTENSIVE')) return 'cc';
  if (has('ER') || has('OT') || has('OR') || says('EMERGENC') || says('THEATRE') || says('THEATER') || says('OPERAT') || says('CATH') || says('ENDOSCOP') || says('RECOVERY') || says('ANAESTH') || says('ANESTH')) return 'ac';
  return 'other';
}
const rrKey = e => 'S' + String(e.id);
const rrMigrateGrid = (grid, rows) => {
  const g = grid || {};
  const keys = Object.keys(g);
  if (!keys.length) return g;
  const current = {};
  rows.forEach(r => {
    current[r.empId] = 1;
  });
  if (keys.every(k => current[k])) return g;
  const byEmpNo = {};
  rows.forEach(r => {
    if (r.empIdShown) byEmpNo[String(r.empIdShown)] = r.empId;
  });
  const out = {};
  keys.forEach(k => {
    out[byEmpNo[k] || k] = g[k];
  });
  return out;
};
const rrNeed = (rules, b) => {
  const r = rules[b === 'M' ? 'minMorning' : b === 'E' ? 'minEvening' : b === 'N' ? 'minNight' : ''];
  return r && r.on && r.value || 0;
};
function rrStandardHours(rules, days) {
  const off = rules && rules.weeklyOff && rules.weeklyOff.on ? rules.weeklyOff.value : 0;
  return 8 * Math.max(1, days - Math.ceil(days / 7) * off);
}
const rrLoadColor = p => p >= 92 ? '#d23a52' : p >= 82 ? '#e08a1e' : p >= 55 ? '#157a43' : '#0090ca';
const rrBar = (pct, color) => ({
  display: 'block',
  height: '100%',
  width: Math.max(3, Math.min(100, pct || 0)) + '%',
  borderRadius: 3,
  background: 'linear-gradient(90deg,' + color + '99,' + color + ')',
  animation: MK.ANIM
});
const rr1 = n => (Math.round((n || 0) * 10) / 10).toFixed(1);
const rrFirst = n => String(n || '').split(/\s+/)[0] || '—';
const rrWhen = ts => ts ? new Date(ts).toLocaleString(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
}) : '—';
const RR_STATUS = {
  draft: {
    label: 'Draft',
    c: '#b5670a',
    bg: 'rgba(224,138,30,.14)'
  },
  submitted: {
    label: 'Submitted',
    c: '#0072a3',
    bg: 'rgba(0,144,202,.12)'
  },
  approved: {
    label: 'Approved',
    c: '#157a43',
    bg: 'rgba(21,122,67,.13)'
  },
  none: {
    label: 'Not drafted',
    c: '#6c7a8c',
    bg: 'rgba(125,145,180,.14)'
  }
};
const rrStatusChip = st => {
  const t = RR_STATUS[st] || RR_STATUS.none;
  return {
    fontSize: 10.5,
    fontWeight: 700,
    padding: '3px 9px',
    borderRadius: 12,
    whiteSpace: 'nowrap',
    color: t.c,
    background: t.bg
  };
};
function rrInjectCss() {
  if (typeof document === 'undefined' || document.getElementById('rr-style')) return;
  const el = document.createElement('style');
  el.id = 'rr-style';
  el.textContent = ['@keyframes rrBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.5px)}}', '@keyframes rrLegA{0%,100%{transform:rotate(17deg)}50%{transform:rotate(-17deg)}}', '@keyframes rrLegB{0%,100%{transform:rotate(-17deg)}50%{transform:rotate(17deg)}}', '@keyframes rrArmA{0%,100%{transform:rotate(-15deg)}50%{transform:rotate(15deg)}}', '@keyframes rrArmB{0%,100%{transform:rotate(15deg)}50%{transform:rotate(-15deg)}}', '@keyframes rrDash{to{stroke-dashoffset:-60}}', '@keyframes rrPop{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}'].join('');
  document.head.appendChild(el);
}
function useRosterIndex() {
  const [state, setState] = useState({
    rosters: [],
    loading: true,
    error: null
  });
  const load = useCallback(() => rrApi.get('/api/rosters').then(r => {
    if (r && r.ok) setState({
      rosters: r.rosters || [],
      loading: false,
      error: null
    });else setState(s => ({
      ...s,
      loading: false,
      error: r && r.error || 'Could not load rosters.'
    }));
  }).catch(() => setState(s => ({
    ...s,
    loading: false,
    error: 'Could not reach the server.'
  }))), []);
  useEffect(() => {
    load();
  }, [load]);
  return {
    ...state,
    reload: load
  };
}
function useMonthSheets(index, year, month) {
  const [sheets, setSheets] = useState({});
  const [loading, setLoading] = useState(true);
  const req = useRef(0);
  const depts = useMemo(() => (index.rosters || []).filter(r => r.year === year && r.month === month).map(r => r.dept), [index.rosters, year, month]);
  const sig = depts.join('|');
  useEffect(() => {
    if (index.loading) return;
    const mine = ++req.current;
    if (!depts.length) {
      setSheets({});
      setLoading(false);
      return;
    }
    setSheets({});
    setLoading(true);
    Promise.all(depts.map(d => rrApi.get('/api/rosters/' + encodeURIComponent(d) + '/' + year + '/' + month).then(r => r && r.ok ? r.roster : null).catch(() => null))).then(list => {
      if (req.current !== mine) return;
      const m = {};
      list.forEach((doc, i) => {
        if (doc) m[depts[i]] = doc;
      });
      setSheets(m);
      setLoading(false);
    });
  }, [sig, year, month, index.loading]);
  return {
    sheets,
    loading: loading || index.loading
  };
}
function rrUnitModel(dept, entry, doc, staffRows, year, month, otLimit) {
  const days = R.daysIn(year, month);
  const rules = Object.assign({}, R.DEFAULT_RULES, doc && doc.rules || {});
  const grid = rrMigrateGrid(doc && doc.grid || {}, staffRows);
  const by = {};
  staffRows.forEach(s => {
    by[s.empId] = s;
  });
  const rows = [];
  const seen = {};
  (doc && doc.order || []).forEach(id => {
    if (by[id] && !seen[id]) {
      rows.push(by[id]);
      seen[id] = 1;
    }
  });
  staffRows.forEach(s => {
    if (!seen[s.empId]) {
      rows.push(s);
      seen[s.empId] = 1;
    }
  });
  Object.keys(grid).forEach(k => {
    if (seen[k]) return;
    rows.push({
      empId: k,
      empIdShown: '',
      name: doc && doc.names && doc.names[k] || k,
      desig: '',
      offRegister: true
    });
    seen[k] = 1;
  });
  const std = rrStandardHours(rules, days);
  const people = rows.map(s => {
    const t = R.totalsFor(grid[s.empId], days);
    const duty = t.G + t.M + t.E + t.N;
    let main = null;
    if (duty) main = ['M', 'E', 'N', 'G'].reduce((a, b) => t[b] > t[a] ? b : a, 'M');
    return {
      ...s,
      totals: t,
      hours: t.hours,
      duty,
      bucket: main,
      load: std ? Math.round(t.hours / std * 100) : 0,
      over: t.hours > otLimit
    };
  });
  const ids = rows.map(s => s.empId);
  const covByDay = [];
  for (let d = 1; d <= days; d++) covByDay.push(R.coverageFor(grid, ids, d));
  const need = {
    M: rrNeed(rules, 'M'),
    E: rrNeed(rules, 'E'),
    N: rrNeed(rules, 'N')
  };
  const avgCov = {};
  const shortDays = {};
  ['M', 'E', 'N'].forEach(b => {
    avgCov[b] = days ? covByDay.reduce((a, c) => a + c[b], 0) / days : 0;
    shortDays[b] = need[b] ? covByDay.filter(c => c[b] < need[b]).length : 0;
  });
  const hours = people.reduce((a, p) => a + p.hours, 0);
  const rostered = people.filter(p => p.duty > 0);
  return {
    dept,
    name: entry && entry.deptName || dept,
    div: rrDivisionOf(dept),
    entry: entry || null,
    doc: doc || null,
    drafted: !!doc,
    status: entry && entry.status || null,
    rules,
    grid,
    days,
    std,
    rows: people,
    rostered,
    covByDay,
    need,
    avgCov,
    shortDays,
    hours,
    load: std && people.length ? Math.round(hours / people.length / std * 100) : 0,
    overCount: people.filter(p => p.over).length,
    findings: doc ? R.checkRules(grid, rows, year, month, rules) : []
  };
}
function RRHeader({
  month,
  year,
  units,
  staffTotal,
  scope,
  setScope,
  pending,
  otLimit,
  setOtLimit,
  otRaw,
  setOtRaw,
  onApproveAll,
  busy,
  canDecide,
  months,
  years,
  setMonth,
  setYear
}) {
  return React.createElement("div", {
    className: "card",
    style: {
      position: 'relative',
      overflow: 'hidden',
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap'
    }
  }, React.createElement("span", {
    style: {
      display: 'inline-grid',
      placeItems: 'center',
      width: 44,
      height: 44,
      borderRadius: 13,
      background: 'rgba(106,82,212,.15)',
      color: '#5b45c4',
      flexShrink: 0
    }
  }, React.createElement(Ic, {
    d: I.grid,
    s: 21
  })), React.createElement("div", {
    style: {
      minWidth: 230
    }
  }, React.createElement("div", {
    style: {
      fontSize: 17,
      fontWeight: 800,
      letterSpacing: '-.2px',
      color: MK.INK
    }
  }, "Roster full review \u2014 Administrator"), React.createElement("div", {
    style: {
      fontSize: 12,
      color: MK.MUTED,
      marginTop: 2
    }
  }, R.MONTHS[month], " ", year, " \xB7 ", units, " units \xB7 ", staffTotal, " staff \xB7 workload balanced before CNS sign-off")), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      flexWrap: 'wrap'
    }
  }, React.createElement("select", {
    value: month,
    onChange: e => setMonth(Number(e.target.value)),
    title: "Which month to review"
  }, months.map((m, i) => React.createElement("option", {
    key: m,
    value: i
  }, m))), React.createElement("select", {
    value: year,
    onChange: e => setYear(Number(e.target.value)),
    title: "Which year to review"
  }, years.map(y => React.createElement("option", {
    key: y,
    value: y
  }, y))), React.createElement("select", {
    value: scope,
    onChange: e => setScope(e.target.value),
    title: "Divisions are derived from each unit's name \u2014 see the workload tree"
  }, ['All divisions'].concat(RR_DIVS.map(d => d.label)).map(v => React.createElement("option", {
    key: v,
    value: v
  }, v))), React.createElement("label", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 11.5,
      color: MK.MUTED
    },
    title: "Anyone rostered more than this many paid hours in the month is flagged. Defaults to a full month of 8-hour duties with the unit's own weekly day off."
  }, "Overtime over", React.createElement("input", {
    type: "number",
    min: "40",
    max: "400",
    step: "4",
    value: otRaw,
    style: {
      width: 66
    },
    onChange: e => {
      const v = e.target.value;
      setOtRaw(v);
      const n = Number(v);
      if (v !== '' && Number.isFinite(n) && n > 0) setOtLimit(n);
    },
    onBlur: () => setOtRaw(String(otLimit))
  }), "h"), React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 11.5,
      fontWeight: 700,
      color: '#b5670a',
      background: 'rgba(224,138,30,.14)',
      border: '1px solid rgba(224,138,30,.3)',
      padding: '6px 12px',
      borderRadius: 16
    }
  }, pending, " awaiting decision"), React.createElement("button", {
    className: "btn",
    disabled: !canDecide || busy || !pending,
    onClick: onApproveAll,
    title: canDecide ? 'Approve every drafted sheet in the current scope' : 'Approving a roster needs administrator access',
    style: {
      border: '1px solid rgba(21,122,67,.3)',
      background: 'linear-gradient(160deg,#1c8f52,#157a43)',
      color: '#fff',
      fontWeight: 700
    }
  }, React.createElement(Ic, {
    d: I.check,
    s: 14
  }), "Approve all units")));
}
function RRKpis({
  tiles
}) {
  return React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(158px,1fr))',
      gap: 12
    }
  }, tiles.map(k => React.createElement("div", {
    key: k.lbl,
    className: "card",
    style: {
      padding: '13px 15px'
    },
    title: k.why
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, React.createElement("span", {
    style: {
      display: 'inline-grid',
      placeItems: 'center',
      width: 34,
      height: 34,
      borderRadius: 10,
      flexShrink: 0,
      color: k.c,
      background: k.c + '1c'
    }
  }, React.createElement(Ic, {
    d: k.icon,
    s: 16
  })), React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "num",
    style: {
      fontSize: 19,
      fontWeight: 700,
      lineHeight: 1.15,
      color: MK.INK
    }
  }, k.val), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: MK.MUTED,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, k.lbl))), React.createElement("div", {
    style: {
      marginTop: 9,
      height: 4,
      borderRadius: 3,
      background: 'rgba(125,145,180,.18)',
      overflow: 'hidden'
    }
  }, React.createElement("div", {
    style: rrBar(k.pct, k.c)
  })))));
}
function RRTree({
  divisions,
  open,
  setOpen,
  q,
  setQ,
  matchLabel,
  sel,
  setSel,
  selUnit,
  setSelUnit,
  inScope,
  unrostered,
  bucket
}) {
  const expandAll = () => {
    const o = {};
    divisions.forEach(d => {
      o[d.id] = true;
      d.units.forEach(u => {
        o[u.dept] = true;
      });
    });
    setOpen(o);
  };
  return React.createElement("div", {
    className: "card",
    style: {
      overflow: 'hidden'
    }
  }, React.createElement("div", {
    className: "card-h",
    style: {
      flexWrap: 'wrap'
    }
  }, React.createElement("h3", null, "Workload tree"), React.createElement("span", {
    style: {
      flex: 1
    }
  }), React.createElement("button", {
    className: "btn",
    style: {
      padding: '5px 9px',
      fontSize: 10.5,
      fontWeight: 700
    },
    onClick: expandAll
  }, "Expand"), React.createElement("button", {
    className: "btn",
    style: {
      padding: '5px 9px',
      fontSize: 10.5,
      fontWeight: 700
    },
    onClick: () => setOpen({})
  }, "Collapse")), React.createElement("div", {
    style: {
      padding: '9px 15px',
      borderBottom: '1px solid ' + MK.LINE,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: 'rgba(247,251,255,.55)'
    }
  }, React.createElement(Ic, {
    d: I.search,
    s: 14,
    c: "#9aa6b4"
  }), React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Find a nurse or unit\u2026",
    style: {
      flex: 1,
      minWidth: 0,
      border: 0,
      background: 'transparent',
      padding: 0,
      fontSize: 12
    }
  }), React.createElement("span", {
    className: "num",
    style: {
      fontSize: 10.5,
      color: MK.FAINT
    }
  }, matchLabel)), React.createElement("div", {
    style: {
      maxHeight: 552,
      overflowY: 'auto',
      padding: '8px 10px 10px'
    }
  }, divisions.map(d => {
    const on = !!open[d.id];
    const c = d.load == null ? MK.FAINT : rrLoadColor(d.load);
    const dim = !inScope(d.id);
    return React.createElement("div", {
      key: d.id,
      style: {
        marginBottom: 6,
        opacity: dim ? .5 : 1
      }
    }, React.createElement("div", {
      onClick: () => setOpen({
        ...open,
        [d.id]: !on
      }),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 9px',
        borderRadius: 10,
        cursor: 'pointer',
        background: 'rgba(255,255,255,.6)',
        border: '1px solid rgba(255,255,255,.9)'
      }
    }, React.createElement("span", {
      style: {
        flexShrink: 0,
        color: '#7d8ea8',
        display: 'grid',
        transform: on ? 'rotate(90deg)' : 'none',
        transition: 'transform .18s'
      }
    }, React.createElement(Ic, {
      d: I.chevR,
      s: 13,
      sw: 2.4
    })), React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: 3,
        background: d.color,
        flexShrink: 0,
        boxShadow: '0 0 0 3px ' + d.color + '26'
      }
    }), React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: 700,
        flex: 1,
        minWidth: 0,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        color: MK.INK
      }
    }, d.label), React.createElement("span", {
      className: "num",
      style: {
        fontSize: 10.5,
        color: MK.MUTED
      }
    }, d.staff, " staff"), React.createElement("span", {
      className: "num",
      title: d.undrafted ? d.undrafted + ' unit(s) in this division have no roster for this month' : '',
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: c,
        background: c + '1c',
        padding: '2px 6px',
        borderRadius: 6
      }
    }, d.load == null ? 'not drafted' : d.load + '%')), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        margin: '2px 8px 0 30px',
        fontSize: 9.6,
        color: MK.FAINT
      }
    }, React.createElement("span", {
      className: "num"
    }, d.on, "/", d.need, " on ", bucket.label.toLowerCase()), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("span", {
      className: "num"
    }, d.hours, " h total")), React.createElement("div", {
      style: {
        height: 3,
        margin: '3px 8px 0 30px',
        borderRadius: 2,
        background: 'rgba(125,145,180,.16)',
        overflow: 'hidden'
      }
    }, React.createElement("div", {
      style: rrBar(d.load || 0, c)
    })), on && React.createElement("div", {
      style: {
        padding: '5px 0 2px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        borderLeft: '1px dashed rgba(125,145,180,.35)',
        margin: '5px 0 0 15px'
      }
    }, d.units.map(u => {
      const uOpen = !!open[u.dept] || q && u.hits.length > 0;
      const uc = rrLoadColor(u.load);
      const gap = u.on - u.needShift;
      const tone = gap < 0 ? '#d23a52' : gap > 0 ? '#0090ca' : '#157a43';
      return React.createElement("div", {
        key: u.dept
      }, React.createElement("div", {
        onClick: () => setSelUnit(u.dept),
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '6px 8px',
          borderRadius: 9,
          cursor: 'pointer',
          background: selUnit === u.dept ? 'rgba(0,144,202,.13)' : 'transparent',
          border: '1px solid ' + (selUnit === u.dept ? 'rgba(0,144,202,.35)' : 'transparent')
        }
      }, React.createElement("span", {
        onClick: e => {
          e.stopPropagation();
          setOpen({
            ...open,
            [u.dept]: !open[u.dept]
          });
        },
        style: {
          display: 'grid',
          placeItems: 'center',
          width: 16,
          height: 16,
          borderRadius: 5,
          flexShrink: 0,
          color: '#7d8ea8',
          transform: uOpen ? 'rotate(90deg)' : 'none',
          transition: 'transform .18s'
        }
      }, React.createElement(Ic, {
        d: I.chevR,
        s: 11,
        sw: 2.6
      })), React.createElement("span", {
        style: {
          fontSize: 12,
          fontWeight: 600,
          flex: 1,
          minWidth: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          color: MK.INK
        }
      }, u.name), React.createElement("span", {
        className: "num",
        title: u.drafted ? u.on + ' of ' + u.needShift + ' required on the ' + bucket.label.toLowerCase() + ' shift' : 'No sheet saved for this month',
        style: {
          fontSize: 9.5,
          fontWeight: 700,
          color: u.drafted ? tone : MK.FAINT,
          background: (u.drafted ? tone : '#8aa0b8') + '1c',
          padding: '2px 6px',
          borderRadius: 6,
          flexShrink: 0
        }
      }, u.drafted ? u.on + '/' + u.needShift : '—'), React.createElement("span", {
        className: "num",
        title: u.drafted ? '' : 'No sheet saved for this month',
        style: {
          fontSize: 10,
          color: MK.FAINT
        }
      }, u.drafted ? u.load + '%' : 'not drafted')), React.createElement("div", {
        style: {
          display: 'flex',
          gap: 6,
          margin: '1px 8px 0 34px',
          fontSize: 9.4,
          color: MK.FAINT
        }
      }, React.createElement("span", {
        className: "num"
      }, u.staff, " staff"), React.createElement("span", {
        style: {
          flex: 1
        }
      }), React.createElement("span", {
        className: "num"
      }, u.hours, " h")), React.createElement("div", {
        style: {
          height: 3,
          margin: '3px 8px 0 34px',
          borderRadius: 2,
          background: 'rgba(125,145,180,.16)',
          overflow: 'hidden'
        }
      }, React.createElement("div", {
        style: rrBar(u.load, uc)
      })), uOpen && React.createElement("div", {
        style: {
          padding: '5px 0 6px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4
        }
      }, (q ? u.hits : u.rows).length === 0 && React.createElement("div", {
        style: {
          fontSize: 10.5,
          color: MK.FAINT,
          padding: '2px 6px'
        }
      }, q ? 'Nobody in this unit matches.' : 'No nurse on the register is assigned to this unit.'), (q ? u.hits : u.rows).map(s => {
        const isSel = sel === s.empId;
        const bc = s.bucket ? R.BUCKET_COLOR[s.bucket] : '#8aa0b8';
        return React.createElement("div", {
          key: s.empId,
          onClick: () => setSel(isSel ? null : s.empId),
          title: s.name + ' — ' + (s.desig || 'designation not recorded') + ' · ' + s.duty + ' duty days · ' + s.hours + ' h this month' + (s.over ? ' (over the overtime limit)' : ''),
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '5px 8px',
            borderRadius: 9,
            cursor: 'pointer',
            border: '1px solid ' + (isSel ? 'rgba(0,144,202,.55)' : 'rgba(125,145,180,.22)'),
            background: isSel ? 'rgba(0,144,202,.12)' : 'rgba(255,255,255,.72)'
          }
        }, React.createElement(MK.Av, {
          name: s.name,
          empId: s.empId,
          size: 22,
          radius: 7
        }), React.createElement("div", {
          style: {
            minWidth: 0,
            flex: 1
          }
        }, React.createElement("div", {
          style: {
            fontSize: 11.5,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: MK.INK
          }
        }, s.name), React.createElement("div", {
          style: {
            fontSize: 9.5,
            color: MK.FAINT,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }
        }, (s.desig || '—') + ' · ' + (s.empIdShown || (s.offRegister ? 'off the register' : 'no employee no.')))), React.createElement("span", {
          className: "num",
          style: {
            fontSize: 9.5,
            fontWeight: 700,
            color: bc,
            background: bc + '1f',
            padding: '2px 5px',
            borderRadius: 5,
            flexShrink: 0
          }
        }, s.bucket || '—'), React.createElement("span", {
          className: "num",
          style: {
            fontSize: 9.5,
            fontWeight: 700,
            color: s.over ? '#a92c42' : MK.FAINT,
            flexShrink: 0
          }
        }, s.hours, "h"));
      })));
    })));
  })), React.createElement("div", {
    style: {
      padding: '12px 15px 14px',
      borderTop: '1px solid ' + MK.LINE,
      background: 'linear-gradient(180deg,rgba(58,181,167,.09),rgba(255,255,255,.4))'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8
    }
  }, React.createElement(Ic, {
    d: I.user,
    s: 14,
    c: "#3ab5a7"
  }), React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 800,
      letterSpacing: '.8px',
      textTransform: 'uppercase',
      color: '#7d8ea8'
    }
  }, "Not on this month's sheet"), React.createElement("span", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    className: "num",
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: '#2c8f83'
    }
  }, unrostered.length, " nurses")), React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 5
    }
  }, unrostered.slice(0, 60).map(s => React.createElement("span", {
    key: s.empId,
    onClick: () => setSel(sel === s.empId ? null : s.empId),
    title: s.name + ' · ' + (s.desig || '—') + ' · ' + s.unitName + ' · no duty code entered for this month',
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 10,
      fontWeight: 700,
      padding: '3px 7px',
      borderRadius: 7,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      color: '#1f6f66',
      background: 'rgba(255,255,255,.9)',
      border: '1px solid ' + (sel === s.empId ? 'rgba(58,181,167,.8)' : 'rgba(58,181,167,.35)')
    }
  }, s.name)), unrostered.length === 0 && React.createElement("span", {
    style: {
      fontSize: 10.5,
      color: MK.FAINT
    }
  }, "Everyone in scope has duty on their unit's sheet."), unrostered.length > 60 && React.createElement("span", {
    style: {
      fontSize: 10.5,
      color: MK.FAINT
    }
  }, "+", unrostered.length - 60, " more"))));
}
function RRZone({
  u,
  bucket,
  day,
  sel,
  selUnit,
  setSelUnit,
  setSel,
  inScope
}) {
  const cov = u.drafted ? u.covByDay[day - 1] : null;
  const on = cov ? cov[bucket.id] : 0;
  const need = u.need[bucket.id] || 0;
  const gap = on - need;
  const tone = !u.drafted ? '#8aa0b8' : gap < 0 ? '#d23a52' : gap > 0 ? '#0090ca' : '#157a43';
  const picked = selUnit === u.dept;
  const nameOf = {};
  u.rows.forEach(r => {
    nameOf[r.empId] = r;
  });
  const chips = cov ? cov.names[bucket.id].map(id => nameOf[id]).filter(Boolean) : [];
  return React.createElement("div", {
    onClick: () => setSelUnit(u.dept),
    title: u.name + ' — ' + RR_DIV_BY[u.div].label + ' · ' + u.rows.length + ' nurses on the sheet · ' + (u.drafted ? on + ' of ' + (need || '—') + ' on the ' + bucket.label.toLowerCase() + ' shift' : 'no sheet saved for this month'),
    style: {
      boxSizing: 'border-box',
      padding: '11px 12px',
      borderRadius: 13,
      cursor: 'pointer',
      border: '1.5px solid ' + (picked ? tone + '77' : 'rgba(255,255,255,.95)'),
      background: 'linear-gradient(160deg,rgba(255,255,255,.9),rgba(236,247,255,.6))',
      boxShadow: picked ? '0 12px 28px rgba(31,59,90,.16)' : '0 6px 18px rgba(31,59,90,.09)',
      opacity: inScope(u.div) ? 1 : .45,
      transition: 'box-shadow .2s,border-color .2s'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      marginBottom: 7
    }
  }, React.createElement("span", {
    style: {
      display: 'grid',
      placeItems: 'center',
      width: 22,
      height: 22,
      borderRadius: 7,
      flexShrink: 0,
      color: tone,
      background: tone + '1c'
    }
  }, React.createElement(Ic, {
    d: I[RR_DIV_ICON[u.div]],
    s: 13
  })), React.createElement("span", {
    style: {
      fontSize: 11.5,
      fontWeight: 700,
      flex: 1,
      minWidth: 0,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      color: MK.INK
    }
  }, u.name), React.createElement("span", {
    className: "num",
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: tone,
      flexShrink: 0
    }
  }, u.drafted ? on + '/' + (need || '—') : '—')), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 7
    }
  }, React.createElement("span", {
    className: "num",
    style: {
      fontSize: 9.5,
      color: MK.FAINT
    }
  }, u.rows.length, " on sheet"), React.createElement("span", {
    style: {
      flex: 1,
      height: 3,
      borderRadius: 2,
      background: 'rgba(125,145,180,.18)',
      overflow: 'hidden'
    }
  }, React.createElement("span", {
    style: rrBar(need ? on / need * 100 : u.drafted ? 100 : 0, tone)
  })), React.createElement("span", {
    style: {
      fontSize: 9,
      fontWeight: 800,
      letterSpacing: '.4px',
      textTransform: 'uppercase',
      color: tone,
      flexShrink: 0
    }
  }, !u.drafted ? 'no sheet' : !need ? 'no minimum set' : gap < 0 ? 'short ' + Math.abs(gap) : gap > 0 ? '+' + gap : 'met')), React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 4,
      minHeight: 24
    }
  }, chips.map(s => React.createElement("span", {
    key: s.empId,
    onClick: e => {
      e.stopPropagation();
      setSel(sel === s.empId ? null : s.empId);
    },
    title: s.name + ' · ' + (s.desig || '—') + ' · ' + (u.grid[s.empId] || {})[day] + ' · ' + s.hours + 'h this month',
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 10,
      fontWeight: 700,
      padding: '3px 7px',
      borderRadius: 7,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      color: MK.INK,
      background: 'rgba(255,255,255,.9)',
      border: '1px solid ' + (sel === s.empId ? 'rgba(0,144,202,.6)' : 'rgba(125,145,180,.28)')
    }
  }, React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: s.over ? '#d23a52' : R.BUCKET_COLOR[bucket.id],
      flexShrink: 0
    }
  }), rrFirst(s.name))), chips.length === 0 && React.createElement("span", {
    style: {
      fontSize: 9.5,
      color: '#b6c0cc',
      fontStyle: 'italic',
      alignSelf: 'center'
    }
  }, u.drafted ? 'no cover on this shift' : 'no roster drafted')));
}
function RRCorridor({
  idx,
  count,
  selName,
  bucket,
  selStaffName
}) {
  const left = 'calc(' + (count ? (idx + 0.5) / count * 100 : 50) + '% - 23px)';
  const scrub = R.BUCKET_COLOR[bucket.id];
  const limb = name => ({
    transformBox: 'fill-box',
    transformOrigin: 'top center',
    animation: name + ' .7s ease-in-out infinite'
  });
  return React.createElement("div", {
    style: {
      position: 'relative',
      height: 96,
      margin: '2px 0',
      borderRadius: 12,
      background: 'linear-gradient(180deg,rgba(255,255,255,.75),rgba(236,247,255,.5))',
      border: '1px solid rgba(255,255,255,.9)',
      overflow: 'hidden'
    }
  }, React.createElement("svg", {
    width: "100%",
    height: "4",
    viewBox: "0 0 600 4",
    preserveAspectRatio: "none",
    style: {
      position: 'absolute',
      left: 0,
      top: 48
    }
  }, React.createElement("line", {
    x1: "0",
    y1: "2",
    x2: "600",
    y2: "2",
    stroke: "rgba(0,144,202,.35)",
    strokeWidth: "3",
    strokeDasharray: "14 10",
    style: {
      animation: 'rrDash 3.2s linear infinite'
    }
  })), React.createElement("span", {
    style: {
      position: 'absolute',
      left: 14,
      top: 8,
      fontSize: 9,
      fontWeight: 800,
      letterSpacing: '.9px',
      textTransform: 'uppercase',
      color: MK.FAINT
    }
  }, "Main corridor \xB7 nurse station"), React.createElement("span", {
    style: {
      position: 'absolute',
      right: 14,
      bottom: 8,
      fontSize: 9.5,
      color: MK.FAINT
    }
  }, selStaffName ? 'reading ' + selStaffName + ' — pick a zone to see their unit' : 'pick a zone to read that unit'), React.createElement("div", {
    style: {
      position: 'absolute',
      left,
      top: 14,
      transition: 'left 1.1s cubic-bezier(.35,.7,.3,1)',
      pointerEvents: 'none'
    }
  }, React.createElement("div", {
    style: {
      position: 'absolute',
      left: 42,
      top: -2,
      whiteSpace: 'nowrap',
      fontSize: 10,
      fontWeight: 700,
      color: MK.INK,
      background: 'rgba(255,255,255,.95)',
      border: '1px solid rgba(125,145,180,.3)',
      borderRadius: 9,
      padding: '4px 8px',
      boxShadow: '0 6px 16px rgba(31,59,90,.14)'
    }
  }, "Walking to ", selName, " \xB7 ", bucket.label.toLowerCase()), React.createElement("svg", {
    width: "46",
    height: "68",
    viewBox: "0 0 46 68"
  }, React.createElement("ellipse", {
    cx: "23",
    cy: "64",
    rx: "12",
    ry: "3",
    fill: "rgba(22,32,46,.15)"
  }), React.createElement("g", {
    style: {
      animation: 'rrBob .7s ease-in-out infinite'
    }
  }, React.createElement("rect", {
    x: "17.4",
    y: "40",
    width: "5.4",
    height: "21",
    rx: "2.7",
    fill: "#2a3f5c",
    style: limb('rrLegA')
  }), React.createElement("rect", {
    x: "23.2",
    y: "40",
    width: "5.4",
    height: "21",
    rx: "2.7",
    fill: "#1d2f47",
    style: limb('rrLegB')
  }), React.createElement("rect", {
    x: "8.6",
    y: "25",
    width: "5",
    height: "18",
    rx: "2.5",
    fill: scrub,
    style: limb('rrArmA')
  }), React.createElement("rect", {
    x: "32.4",
    y: "25",
    width: "5",
    height: "18",
    rx: "2.5",
    fill: scrub,
    style: limb('rrArmB')
  }), React.createElement("path", {
    d: "M13.6 26c0-5.6 4.2-9.4 9.4-9.4s9.4 3.8 9.4 9.4v16H13.6z",
    fill: scrub
  }), React.createElement("path", {
    d: "M19 17.2l4 5.2 4-5.2",
    fill: "none",
    stroke: "rgba(255,255,255,.8)",
    strokeWidth: "1.6",
    strokeLinejoin: "round"
  }), React.createElement("rect", {
    x: "27.4",
    y: "27",
    width: "4.2",
    height: "5.6",
    rx: "1.2",
    fill: "rgba(255,255,255,.9)"
  }), React.createElement("circle", {
    cx: "23",
    cy: "11.8",
    r: "7.4",
    fill: "#f3cdae"
  }), React.createElement("path", {
    d: "M15.6 11.4c0-5.4 3.2-8.4 7.4-8.4s7.4 3 7.4 8.4c-1.6-2.6-3.4-3.6-7.4-3.6s-5.8 1-7.4 3.6z",
    fill: "#2b2118"
  }), React.createElement("path", {
    d: "M16.4 5.6h13.2l-1.6-3.2H18z",
    fill: "#fff"
  }), React.createElement("path", {
    d: "M23 2.9v1.8M22.1 3.8h1.8",
    stroke: "#d23a52",
    strokeWidth: "1.2",
    strokeLinecap: "round"
  }), React.createElement("circle", {
    cx: "20.5",
    cy: "12.2",
    r: ".95",
    fill: "#2b2118"
  }), React.createElement("circle", {
    cx: "25.5",
    cy: "12.2",
    r: ".95",
    fill: "#2b2118"
  }), React.createElement("path", {
    d: "M21.4 15.1c1 .9 2.2.9 3.2 0",
    stroke: "#b06a4a",
    strokeWidth: "1",
    fill: "none",
    strokeLinecap: "round"
  })))));
}
function RRUnitDetail({
  u,
  bucket,
  day,
  month,
  year,
  setRoute
}) {
  if (!u) return null;
  const cov = u.drafted ? u.covByDay[day - 1] : null;
  const nameOf = {};
  u.rows.forEach(r => {
    nameOf[r.empId] = r;
  });
  const dayFindings = u.findings.filter(f => f.day === day);
  return React.createElement("div", {
    style: {
      margin: '12px 16px 0',
      padding: '12px 14px',
      borderRadius: 13,
      background: 'rgba(255,255,255,.7)',
      border: '1px solid rgba(255,255,255,.95)'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      flexWrap: 'wrap',
      marginBottom: 9
    }
  }, React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 3,
      background: RR_DIV_BY[u.div].color,
      flexShrink: 0
    }
  }), React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: MK.INK
    }
  }, u.name), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: MK.FAINT
    }
  }, RR_DIV_BY[u.div].label, " \xB7 ", R.MONTHS[month], " ", day, ", ", year)), React.createElement("span", {
    style: rrStatusChip(u.status || 'none')
  }, (RR_STATUS[u.status] || RR_STATUS.none).label), u.entry && React.createElement("span", {
    className: "num",
    style: {
      fontSize: 10.5,
      color: MK.FAINT
    }
  }, "v", u.entry.revision || 1), React.createElement("span", {
    style: {
      flex: 1
    }
  }), setRoute && React.createElement("button", {
    className: "btn",
    onClick: () => setRoute({
      view: 'rosterGrid',
      dept: u.dept,
      year,
      month
    })
  }, "Open the grid"), setRoute && u.drafted && React.createElement("button", {
    className: "btn",
    onClick: () => setRoute({
      view: 'rosterPrint',
      dept: u.dept,
      year,
      month
    })
  }, "Print sheet")), !u.drafted ? React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: MK.MUTED
    }
  }, "No sheet has been saved for ", u.name, " in ", R.MONTHS[month], " ", year, ", so there is nothing to review for this unit yet.") : React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
      gap: 12
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 800,
      letterSpacing: '.7px',
      textTransform: 'uppercase',
      color: '#7d8ea8',
      marginBottom: 6
    }
  }, "Cover on ", R.MONTHS[month], " ", day), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 5
    }
  }, ['M', 'E', 'N', 'G'].map(b => {
    const meta = R.BUCKETS.find(x => x.id === b);
    const n = cov[b],
      need = u.need[b] || 0;
    const bad = need && n < need;
    return React.createElement("div", {
      key: b,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 11.4
      }
    }, React.createElement("span", {
      style: {
        minWidth: 58,
        fontWeight: 700,
        color: meta.color
      }
    }, meta.label), React.createElement("span", {
      className: "num",
      style: {
        fontWeight: 700,
        color: bad ? '#a92c42' : MK.INK
      }
    }, n, need ? ' / ' + need : ''), React.createElement("span", {
      style: {
        fontSize: 10.4,
        color: MK.FAINT
      }
    }, need ? bad ? 'below the unit minimum' : 'meets the unit minimum' : 'no minimum set'));
  }))), React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 800,
      letterSpacing: '.7px',
      textTransform: 'uppercase',
      color: '#7d8ea8',
      marginBottom: 6
    }
  }, "On ", bucket.label.toLowerCase(), " duty"), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      maxHeight: 148,
      overflowY: 'auto'
    }
  }, cov.names[bucket.id].length === 0 && React.createElement("span", {
    style: {
      fontSize: 11,
      color: MK.FAINT
    }
  }, "Nobody is on the ", bucket.label.toLowerCase(), " shift that day."), cov.names[bucket.id].map(id => {
    const s = nameOf[id];
    if (!s) return null;
    return React.createElement("div", {
      key: id,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        fontSize: 11.4
      }
    }, React.createElement(MK.Av, {
      name: s.name,
      empId: s.empId,
      size: 20,
      radius: 6
    }), React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        color: MK.INK
      }
    }, s.name), React.createElement("span", {
      className: "num",
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: R.BUCKET_COLOR[bucket.id]
      }
    }, (u.grid[id] || {})[day]), React.createElement("span", {
      className: "num",
      style: {
        fontSize: 10,
        color: s.over ? '#a92c42' : MK.FAINT
      }
    }, s.hours, "h"));
  }))), React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 800,
      letterSpacing: '.7px',
      textTransform: 'uppercase',
      color: '#7d8ea8',
      marginBottom: 6
    }
  }, "Rule findings"), React.createElement("div", {
    style: {
      fontSize: 11.4,
      color: MK.MUTED,
      marginBottom: 5
    }
  }, React.createElement("span", {
    className: "num",
    style: {
      fontWeight: 700,
      color: u.findings.length ? '#b5670a' : '#157a43'
    }
  }, u.findings.length), " this month \xB7 ", React.createElement("span", {
    className: "num"
  }, dayFindings.length), " on this day"), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      maxHeight: 130,
      overflowY: 'auto'
    }
  }, (dayFindings.length ? dayFindings : u.findings.slice(0, 6)).map((f, i) => React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 7,
      alignItems: 'baseline',
      fontSize: 11
    }
  }, React.createElement("span", {
    className: "tag num",
    style: {
      minWidth: 38,
      textAlign: 'center'
    }
  }, R.MONTHS[month].slice(0, 3), " ", f.day), React.createElement("span", {
    style: {
      color: f.severity === 'high' ? '#d23a52' : f.severity === 'medium' ? '#e07a2a' : MK.MUTED
    }
  }, f.text))), u.findings.length === 0 && React.createElement("span", {
    style: {
      fontSize: 11,
      color: '#157a43'
    }
  }, "Every rule this unit set passes.")))));
}
function RRDiagram({
  units,
  scoped,
  bucket,
  setBucket,
  day,
  setDay,
  days,
  month,
  year,
  sel,
  setSel,
  selUnit,
  setSelUnit,
  inScope,
  setRoute
}) {
  const half = Math.ceil(units.length / 2);
  const top = units.slice(0, half),
    bottom = units.slice(half);
  const idx = Math.max(0, units.findIndex(u => u.dept === selUnit));
  const selected = units.find(u => u.dept === selUnit) || units[0] || null;
  const selStaff = sel ? units.reduce((a, u) => a || u.rows.find(r => r.empId === sel), null) || null : null;
  const lanes = R.BUCKETS.filter(b => b.id !== 'O').map(b => {
    const people = [];
    let need = 0;
    let notDrafted = 0;
    scoped.forEach(u => {
      if (!u.drafted) {
        notDrafted++;
        return;
      }
      need += u.need[b.id] || 0;
      const cov = u.covByDay[day - 1];
      cov.names[b.id].forEach(id => {
        const s = u.rows.find(r => r.empId === id);
        if (s) people.push({
          ...s,
          unit: u.name
        });
      });
    });
    return {
      b,
      people,
      need,
      notDrafted
    };
  });
  const grid = list => React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))',
      gap: 10
    }
  }, list.map(u => React.createElement(RRZone, {
    key: u.dept,
    u: u,
    bucket: bucket,
    day: day,
    sel: sel,
    setSel: setSel,
    selUnit: selUnit,
    setSelUnit: setSelUnit,
    inScope: inScope
  })));
  return React.createElement("div", {
    className: "card",
    style: {
      overflow: 'hidden'
    }
  }, React.createElement("div", {
    className: "card-h",
    style: {
      flexWrap: 'wrap'
    }
  }, React.createElement("h3", null, "Hospital environment"), React.createElement("span", {
    style: {
      fontSize: 11,
      color: MK.FAINT
    }
  }, "every unit as a zone \xB7 click a zone to read it \xB7 the counts are that unit's own minimum"), React.createElement("span", {
    style: {
      flex: 1
    }
  }), React.createElement("label", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 11,
      color: MK.MUTED
    }
  }, "Day", React.createElement("select", {
    value: day,
    onChange: e => setDay(Number(e.target.value)),
    style: {
      padding: '4px 7px'
    }
  }, Array.from({
    length: days
  }, (_, i) => i + 1).map(d => React.createElement("option", {
    key: d,
    value: d
  }, d)))), React.createElement("div", {
    style: {
      display: 'inline-flex',
      background: 'rgba(255,255,255,.6)',
      border: '1px solid rgba(255,255,255,.95)',
      borderRadius: 10,
      padding: 3,
      gap: 2
    }
  }, R.BUCKETS.filter(b => b.id !== 'O').map(b => React.createElement("button", {
    key: b.id,
    onClick: () => setBucket(b.id),
    title: b.label + ' duty codes',
    style: {
      border: 0,
      borderRadius: 8,
      padding: '6px 12px',
      fontSize: 11.5,
      fontWeight: 700,
      cursor: 'pointer',
      fontFamily: 'inherit',
      color: bucket.id === b.id ? '#fff' : MK.MUTED,
      background: bucket.id === b.id ? 'linear-gradient(160deg,' + b.color + ',' + b.color + 'cc)' : 'transparent'
    }
  }, b.label)))), React.createElement("div", {
    style: {
      position: 'relative',
      padding: 16,
      background: 'linear-gradient(180deg,rgba(233,243,252,.55),rgba(255,255,255,.3))'
    }
  }, React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 16,
      borderRadius: 14,
      border: '1px dashed rgba(125,145,180,.35)',
      pointerEvents: 'none'
    }
  }), React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, grid(top), React.createElement(RRCorridor, {
    idx: idx,
    count: units.length,
    selName: selected ? selected.name : '—',
    bucket: bucket,
    selStaffName: selStaff ? rrFirst(selStaff.name) : ''
  }), grid(bottom))), React.createElement(RRUnitDetail, {
    u: selected,
    bucket: bucket,
    day: day,
    month: month,
    year: year,
    setRoute: setRoute
  }), React.createElement("div", {
    style: {
      padding: '12px 16px 14px',
      marginTop: 12,
      borderTop: '1px solid ' + MK.LINE,
      background: 'rgba(247,251,255,.5)'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      marginBottom: 9
    }
  }, React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 800,
      letterSpacing: '.8px',
      textTransform: 'uppercase',
      color: '#7d8ea8'
    }
  }, "Shift belt"), React.createElement("span", {
    style: {
      fontSize: 10.5,
      color: MK.FAINT
    }
  }, "click a lane to read that shift \xB7 edit shifts on the unit's grid")), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))',
      gap: 10
    }
  }, lanes.map(l => React.createElement("div", {
    key: l.b.id,
    onClick: () => setBucket(l.b.id),
    style: {
      boxSizing: 'border-box',
      padding: '11px 12px',
      borderRadius: 12,
      cursor: 'pointer',
      border: '1.5px solid ' + (bucket.id === l.b.id ? l.b.color + '66' : 'rgba(255,255,255,.95)'),
      background: 'linear-gradient(160deg,rgba(255,255,255,.88),rgba(236,247,255,.55))'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8
    }
  }, React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: '50%',
      background: l.b.color,
      flexShrink: 0,
      boxShadow: '0 0 0 3px ' + l.b.color + '2b'
    }
  }), React.createElement("span", {
    style: {
      fontSize: 11.5,
      fontWeight: 700,
      color: MK.INK
    }
  }, l.b.label, " shift"), React.createElement("span", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    className: "num",
    style: {
      fontSize: 11.5,
      fontWeight: 700,
      color: l.need && l.people.length < l.need ? '#a92c42' : '#157a43'
    }
  }, l.people.length, "/", l.need || '—')), React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 4
    }
  }, l.people.slice(0, 40).map(s => React.createElement("span", {
    key: s.unit + s.empId,
    title: s.name + ' · ' + s.unit,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: 10,
      fontWeight: 700,
      padding: '3px 7px',
      borderRadius: 7,
      whiteSpace: 'nowrap',
      color: MK.INK,
      background: 'rgba(255,255,255,.85)',
      border: '1px solid rgba(125,145,180,.26)'
    }
  }, rrFirst(s.name))), l.people.length === 0 && React.createElement("span", {
    style: {
      fontSize: 10,
      color: MK.FAINT
    }
  }, "nobody rostered on this shift that day"), l.people.length > 40 && React.createElement("span", {
    style: {
      fontSize: 10,
      color: MK.FAINT
    }
  }, "+", l.people.length - 40)))))));
}
const RR_HEAD = {
  background: 'linear-gradient(180deg,#f6fafe,#e9f1fa)',
  padding: '8px 12px',
  fontSize: 9.5,
  letterSpacing: '.5px',
  textTransform: 'uppercase',
  color: '#7d8ea8',
  borderBottom: '1px solid rgba(125,145,180,.28)',
  whiteSpace: 'nowrap'
};
const RR_CELL = {
  padding: '8px 10px',
  borderBottom: '1px solid rgba(125,145,180,.14)'
};
function RRQueue({
  units,
  bucket,
  inScope,
  selUnit,
  setSelUnit,
  onDecide,
  busy,
  canDecide,
  month,
  year
}) {
  const btn = (active, tone) => ({
    border: '1px solid ' + (active ? tone + '59' : 'rgba(125,145,180,.3)'),
    background: active ? tone + '29' : 'rgba(255,255,255,.8)',
    color: active ? tone : MK.MUTED,
    padding: '5px 10px',
    borderRadius: 8,
    fontSize: 10.5,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit'
  });
  return React.createElement("div", {
    className: "card",
    style: {
      overflow: 'hidden'
    }
  }, React.createElement("div", {
    className: "card-h",
    style: {
      flexWrap: 'wrap'
    }
  }, React.createElement("h3", null, "Unit review queue"), React.createElement("span", {
    style: {
      fontSize: 11,
      color: MK.FAINT
    }
  }, "coverage read for the ", bucket.label.toLowerCase(), " shift \xB7 averaged over ", R.MONTHS[month], " ", year)), React.createElement("div", {
    style: {
      overflowX: 'auto'
    }
  }, React.createElement("table", {
    style: {
      borderCollapse: 'collapse',
      width: '100%',
      fontSize: 11.5,
      minWidth: 720
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: {
      ...RR_HEAD,
      textAlign: 'left'
    }
  }, "Unit"), React.createElement("th", {
    style: {
      ...RR_HEAD,
      textAlign: 'center'
    }
  }, "Staff"), React.createElement("th", {
    style: {
      ...RR_HEAD,
      textAlign: 'left'
    }
  }, "Avg workload"), React.createElement("th", {
    style: {
      ...RR_HEAD,
      textAlign: 'center'
    }
  }, "Cover M \xB7 E \xB7 N"), React.createElement("th", {
    style: {
      ...RR_HEAD,
      textAlign: 'center'
    }
  }, "Overtime"), React.createElement("th", {
    style: {
      ...RR_HEAD,
      textAlign: 'center'
    }
  }, "Status"), React.createElement("th", {
    style: {
      ...RR_HEAD,
      textAlign: 'right'
    }
  }, "Decision"))), React.createElement("tbody", null, units.map(u => {
    const c = rrLoadColor(u.load);
    return React.createElement("tr", {
      key: u.dept,
      onClick: () => setSelUnit(u.dept),
      style: {
        opacity: inScope(u.div) ? 1 : .45,
        background: selUnit === u.dept ? 'rgba(0,144,202,.07)' : 'transparent',
        cursor: 'pointer'
      }
    }, React.createElement("td", {
      style: {
        ...RR_CELL,
        padding: '8px 12px'
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: 3,
        background: RR_DIV_BY[u.div].color,
        flexShrink: 0
      }
    }), React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        color: MK.INK
      }
    }, u.name), React.createElement("div", {
      style: {
        fontSize: 9.5,
        color: MK.FAINT,
        whiteSpace: 'nowrap'
      }
    }, RR_DIV_BY[u.div].label)))), React.createElement("td", {
      className: "num",
      style: {
        ...RR_CELL,
        textAlign: 'center'
      }
    }, u.rows.length), React.createElement("td", {
      style: RR_CELL
    }, u.drafted ? React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6
      },
      title: 'Mean of ' + u.hours + ' rostered hours over ' + u.rows.length + ' staff, against a full month of ' + u.std + ' h'
    }, React.createElement("span", {
      style: {
        flex: 1,
        height: 5,
        borderRadius: 3,
        background: 'rgba(125,145,180,.18)',
        overflow: 'hidden',
        minWidth: 54
      }
    }, React.createElement("span", {
      style: rrBar(u.load, c)
    })), React.createElement("span", {
      className: "num",
      style: {
        fontSize: 10.5,
        fontWeight: 700,
        color: c,
        minWidth: 30
      }
    }, u.load, "%")) : React.createElement("span", {
      style: {
        fontSize: 10.5,
        color: MK.FAINT
      }
    }, "\u2014")), React.createElement("td", {
      style: RR_CELL
    }, React.createElement("div", {
      style: {
        display: 'flex',
        gap: 4,
        justifyContent: 'center'
      }
    }, ['M', 'E', 'N'].map(b => {
      const need = u.need[b] || 0;
      const ok = u.drafted && (!need || u.shortDays[b] === 0);
      return React.createElement("span", {
        key: b,
        className: "num",
        title: u.drafted ? R.BUCKETS.find(x => x.id === b).label + ': ' + rr1(u.avgCov[b]) + ' staff a day on average, minimum ' + (need || 'not set') + ', ' + u.shortDays[b] + ' day(s) below it' : 'No sheet saved for this month',
        style: {
          display: 'inline-grid',
          placeItems: 'center',
          minWidth: 30,
          height: 22,
          padding: '0 4px',
          borderRadius: 6,
          fontSize: 10.5,
          fontWeight: 700,
          color: !u.drafted ? MK.FAINT : ok ? '#157a43' : '#a92c42',
          background: !u.drafted ? 'rgba(125,145,180,.12)' : ok ? 'rgba(21,122,67,.13)' : 'rgba(210,58,82,.14)',
          border: '1px solid ' + (!u.drafted ? 'rgba(125,145,180,.2)' : ok ? 'rgba(21,122,67,.25)' : 'rgba(210,58,82,.3)')
        }
      }, u.drafted ? rr1(u.avgCov[b]) : '—');
    }))), React.createElement("td", {
      style: {
        ...RR_CELL,
        textAlign: 'center'
      }
    }, React.createElement("span", {
      style: {
        fontSize: 10.5,
        fontWeight: 700,
        color: u.overCount ? '#b5670a' : MK.FAINT,
        background: u.overCount ? 'rgba(224,138,30,.14)' : 'transparent',
        padding: u.overCount ? '2px 7px' : 0,
        borderRadius: 6
      }
    }, !u.drafted ? '—' : u.overCount ? u.overCount + ' flagged' : 'clear')), React.createElement("td", {
      style: {
        ...RR_CELL,
        textAlign: 'center'
      }
    }, React.createElement("span", {
      style: rrStatusChip(u.status || 'none')
    }, (RR_STATUS[u.status] || RR_STATUS.none).label)), React.createElement("td", {
      style: {
        ...RR_CELL,
        padding: '8px 12px'
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        gap: 5,
        justifyContent: 'flex-end'
      }
    }, React.createElement("button", {
      disabled: !u.drafted || !canDecide || busy,
      style: btn(u.status === 'approved', '#157a43'),
      title: !u.drafted ? 'Nothing has been saved for this unit yet' : canDecide ? 'Approve and lock this sheet' : 'Approving a roster needs administrator access',
      onClick: e => {
        e.stopPropagation();
        onDecide(u, 'approved');
      }
    }, "Approve"), React.createElement("button", {
      disabled: !u.drafted || !canDecide || busy,
      style: btn(u.status === 'draft' && !!u.entry, '#a92c42'),
      title: !u.drafted ? 'Nothing has been saved for this unit yet' : 'Send the sheet back to the nurse in-charge as a draft',
      onClick: e => {
        e.stopPropagation();
        onDecide(u, 'draft');
      }
    }, "Return"))));
  }), units.length === 0 && React.createElement("tr", null, React.createElement("td", {
    colSpan: "7",
    style: {
      ...RR_CELL,
      textAlign: 'center',
      color: MK.MUTED,
      padding: 22
    }
  }, "No units to review."))))));
}
function rrAuditEntries(units) {
  const out = [];
  units.forEach(u => {
    const e = u.entry;
    if (!e) return;
    if (e.createdAt) out.push({
      ts: e.createdAt,
      kind: 'in',
      text: u.name + ' roster created',
      meta: (e.createdBy || 'unknown') + ' · ' + rrWhen(e.createdAt)
    });
    if (e.updatedAt) out.push({
      ts: e.updatedAt,
      kind: 'in',
      text: u.name + ' roster last saved — revision v' + (e.revision || 1),
      meta: (e.updatedBy || 'unknown') + ' · ' + rrWhen(e.updatedAt)
    });
    if (e.status === 'approved' && (e.approvedAt || e.statusAt)) {
      const ts = e.approvedAt || e.statusAt;
      out.push({
        ts,
        kind: 'ok',
        text: u.name + ' roster approved',
        meta: (e.approvedBy || e.statusBy || 'unknown') + ' · ' + rrWhen(ts)
      });
    } else if (e.statusAt) {
      out.push({
        ts: e.statusAt,
        kind: e.status === 'draft' ? 'warn' : 'in',
        text: u.name + (e.status === 'draft' ? ' roster reopened as a draft' : ' roster submitted for review'),
        meta: (e.statusBy || 'unknown') + ' · ' + rrWhen(e.statusAt)
      });
    }
  });
  return out.sort((a, b) => b.ts - a.ts);
}
function RRAudit({
  entries,
  month,
  year
}) {
  return React.createElement("div", {
    className: "card",
    style: {
      overflow: 'hidden'
    }
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Audit trail"), React.createElement("span", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    className: "num",
    style: {
      fontSize: 10.5,
      color: MK.FAINT
    }
  }, entries.length, " entries")), React.createElement("div", {
    style: {
      padding: '10px 15px',
      borderBottom: '1px solid ' + MK.LINE,
      background: 'rgba(224,138,30,.08)',
      fontSize: 10.8,
      color: '#8a5a12',
      lineHeight: 1.5
    }
  }, React.createElement("strong", null, "Not a change log."), " The roster store records only the last writer on each sheet \u2014 created, last saved, and the last status change \u2014 so those are the stamps listed here. Individual shift edits are not recorded anywhere, so a full per-change history cannot be shown."), React.createElement("div", {
    style: {
      maxHeight: 300,
      overflowY: 'auto'
    }
  }, entries.length === 0 && React.createElement("div", {
    style: {
      padding: 20,
      textAlign: 'center',
      fontSize: 11.5,
      color: MK.MUTED
    }
  }, "No sheet has been saved for ", R.MONTHS[month], " ", year, ", so there are no stamps to show."), entries.map((e, i) => {
    const c = e.kind === 'warn' ? '#d23a52' : e.kind === 'in' ? '#0090ca' : '#157a43';
    const icon = e.kind === 'warn' ? I.edit : e.kind === 'in' ? I.download : I.check;
    return React.createElement("div", {
      key: i,
      style: {
        display: 'flex',
        gap: 10,
        padding: '10px 15px',
        borderBottom: '1px solid rgba(125,145,180,.14)',
        animation: i === 0 ? 'rrPop .28s cubic-bezier(.2,.7,.3,1) both' : 'none'
      }
    }, React.createElement("span", {
      style: {
        display: 'grid',
        placeItems: 'center',
        width: 24,
        height: 24,
        borderRadius: 8,
        flexShrink: 0,
        color: c,
        background: c + '1c'
      }
    }, React.createElement(Ic, {
      d: icon,
      s: 12,
      sw: 2.2
    })), React.createElement("div", {
      style: {
        minWidth: 0,
        flex: 1
      }
    }, React.createElement("div", {
      style: {
        fontSize: 11.5,
        fontWeight: 600,
        lineHeight: 1.4,
        color: MK.INK
      }
    }, e.text), React.createElement("div", {
      style: {
        fontSize: 9.5,
        color: MK.FAINT,
        marginTop: 2
      }
    }, e.meta)));
  })));
}
function RosterReviewFull({
  dept,
  year,
  month,
  setRoute
}) {
  const staffStore = window.useStaffStore();
  const index = useRosterIndex();
  const now = new Date();
  useEffect(() => {
    rrInjectCss();
  }, []);
  const [y, setY] = useState(Number(year) || now.getFullYear());
  const [m, setM] = useState(Number.isInteger(Number(month)) ? Number(month) : now.getMonth());
  const [scope, setScope] = useState('All divisions');
  const [bucketId, setBucketId] = useState('M');
  const [dayRaw, setDay] = useState(() => now.getFullYear() === (Number(year) || now.getFullYear()) ? now.getDate() : 1);
  const [open, setOpen] = useState({
    cc: true,
    mn: true,
    ac: true,
    other: true
  });
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [selUnit, setSelUnit] = useState(dept || null);
  const [busy, setBusy] = useState(false);
  const days = R.daysIn(y, m);
  const day = Math.min(Math.max(1, dayRaw), days);
  const jumped = useRef(false);
  useEffect(() => {
    if (jumped.current || index.loading || year != null) return;
    const first = (index.rosters || [])[0];
    if (first) {
      setY(first.year);
      setM(first.month);
    }
    jumped.current = true;
  }, [index.loading, index.rosters, year]);
  const {
    sheets,
    loading
  } = useMonthSheets(index, y, m);
  const entries = useMemo(() => {
    const map = {};
    (index.rosters || []).forEach(r => {
      if (r.year === y && r.month === m) map[r.dept] = r;
    });
    return map;
  }, [index.rosters, y, m]);
  const staffByDept = useMemo(() => {
    const map = {};
    (staffStore.staff || []).filter(e => e.is_active !== false && !e.former).forEach(e => {
      const d = e.current_department || 'Unassigned';
      (map[d] = map[d] || []).push({
        empId: rrKey(e),
        empIdShown: e.emp_id || '',
        name: e.name,
        desig: e.designation,
        role: e.role
      });
    });
    Object.keys(map).forEach(d => map[d].sort((a, b) => String(a.name).localeCompare(String(b.name))));
    return map;
  }, [staffStore.staff]);
  const stdMonth = 8 * Math.max(1, days - Math.ceil(days / 7));
  const [otLimit, setOtLimit] = useState(stdMonth);
  const [otRaw, setOtRaw] = useState(String(stdMonth));
  const otTouched = useRef(false);
  useEffect(() => {
    if (!otTouched.current) setOtLimit(stdMonth);
  }, [stdMonth]);
  const setOt = v => {
    otTouched.current = true;
    setOtLimit(v);
  };
  const units = useMemo(() => {
    const names = {};
    Object.keys(staffByDept).forEach(d => {
      names[d] = 1;
    });
    Object.keys(entries).forEach(d => {
      names[d] = 1;
    });
    Object.keys(sheets).forEach(d => {
      names[d] = 1;
    });
    return Object.keys(names).map(d => rrUnitModel(d, entries[d], sheets[d], staffByDept[d] || [], y, m, otLimit)).sort((a, b) => RR_DIVS.findIndex(x => x.id === a.div) - RR_DIVS.findIndex(x => x.id === b.div) || String(a.name).localeCompare(String(b.name)));
  }, [staffByDept, entries, sheets, y, m, otLimit]);
  const bucket = R.BUCKETS.find(b => b.id === bucketId) || R.BUCKETS[1];
  const inScope = useCallback(divId => scope === 'All divisions' || (RR_DIV_BY[divId] || {}).label === scope, [scope]);
  const scoped = useMemo(() => units.filter(u => inScope(u.div)), [units, inScope]);
  useEffect(() => {
    if (!units.length) return;
    if (!selUnit || !units.some(u => u.dept === selUnit)) setSelUnit(units[0].dept);
  }, [units, selUnit]);
  const staffTotal = scoped.reduce((a, u) => a + u.rows.length, 0);
  const rosteredTotal = scoped.reduce((a, u) => a + u.rostered.length, 0);
  const overTotal = scoped.reduce((a, u) => a + u.overCount, 0);
  const draftedUnits = scoped.filter(u => u.drafted);
  const approvedUnits = scoped.filter(u => u.status === 'approved');
  const toApprove = draftedUnits.filter(u => u.status !== 'approved' && u.entry && u.entry.id);
  const pending = toApprove.length;
  const gapUnits = draftedUnits.filter(u => u.need[bucket.id] && u.shortDays[bucket.id] > 0);
  const unrostered = useMemo(() => {
    const out = [];
    scoped.forEach(u => u.rows.forEach(s => {
      if (!s.duty) out.push({
        ...s,
        unitName: u.name
      });
    }));
    return out.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [scoped]);
  const tiles = [{
    lbl: 'Staff in review',
    val: String(staffTotal),
    icon: I.user,
    c: '#0090ca',
    pct: 100,
    why: 'Every active nurse on the register whose department is one of the units in scope, plus anyone still on a saved sheet who has since left the register.'
  }, {
    lbl: 'Rostered this month',
    val: String(rosteredTotal),
    icon: I.check,
    c: '#157a43',
    pct: staffTotal ? rosteredTotal / staffTotal * 100 : 0,
    why: 'Staff with at least one duty code on their unit\'s sheet for this month. (The mockup counted "deployed to a unit"; every staff record already carries a department, so this counts the roster instead.)'
  }, {
    lbl: 'Not on any sheet',
    val: String(unrostered.length),
    icon: I.plus,
    c: '#3ab5a7',
    pct: staffTotal ? unrostered.length / staffTotal * 100 : 0,
    why: 'Staff in scope with no duty code at all this month. There is no float pool in this system, so this is the honest reading of "who is spare".'
  }, {
    lbl: bucket.label + ' gaps',
    val: String(gapUnits.length),
    icon: I.pulse,
    c: gapUnits.length ? '#d23a52' : '#157a43',
    pct: draftedUnits.length ? gapUnits.length / draftedUnits.length * 100 : 0,
    why: 'Units with a saved sheet that fall below their OWN minimum on the ' + bucket.label.toLowerCase() + ' shift on at least one day of the month.'
  }, {
    lbl: 'Over ' + otLimit + ' h this month',
    val: String(overTotal),
    icon: I.cal,
    c: '#e08a1e',
    pct: staffTotal ? overTotal / staffTotal * 100 : 0,
    why: 'Paid hours from the shift legend, summed over the month per person, compared with the overtime line in the header.'
  }, {
    lbl: 'Units approved',
    val: approvedUnits.length + '/' + scoped.length,
    icon: I.check,
    c: '#6a52d4',
    pct: scoped.length ? approvedUnits.length / scoped.length * 100 : 0,
    why: 'Sheets whose stored status is "approved", out of every unit in scope (drafted or not).'
  }];
  const query = q.trim().toLowerCase();
  const divisions = useMemo(() => RR_DIVS.map(d => {
    const list = units.filter(u => u.div === d.id).map(u => ({
      ...u,
      needShift: u.need[bucket.id] || 0,
      on: u.drafted ? u.covByDay[day - 1][bucket.id] : 0,
      hits: query ? u.rows.filter(s => (s.name + ' ' + (s.desig || '')).toLowerCase().indexOf(query) >= 0) : [],
      staff: u.rows.length
    }));
    const staff = list.reduce((a, u) => a + u.rows.length, 0);
    const hours = list.reduce((a, u) => a + u.hours, 0);
    const drafted = list.filter(u => u.drafted);
    const undrafted = list.length - drafted.length;
    const stdSum = drafted.reduce((a, u) => a + u.std * u.rows.length, 0);
    return {
      ...d,
      units: list,
      staff,
      hours,
      undrafted,
      load: stdSum ? Math.round(hours / stdSum * 100) : null,
      on: drafted.reduce((a, u) => a + u.on, 0),
      need: drafted.reduce((a, u) => a + u.needShift, 0)
    };
  }).filter(d => d.units.length), [units, bucket, day, query]);
  const matchCount = query ? units.reduce((a, u) => a + u.rows.filter(s => (s.name + ' ' + (s.desig || '')).toLowerCase().indexOf(query) >= 0).length, 0) : 0;
  const matchLabel = query ? matchCount + ' match' + (matchCount === 1 ? '' : 'es') : units.reduce((a, u) => a + u.rows.length, 0) + ' staff';
  const decide = (u, status) => {
    if (!u.entry || !u.entry.id) return;
    setBusy(true);
    rrApi.post('/api/rosters/' + encodeURIComponent(u.entry.id) + '/status', {
      status
    }).then(r => {
      if (r && r.ok) {
        rrToast(u.name + (status === 'approved' ? ' approved' : ' returned to the nurse in-charge'), 'success');
        index.reload();
      } else rrToast(r && r.error || 'Could not change the status.', 'error');
    }).catch(() => rrToast('Could not reach the server.', 'error')).then(() => setBusy(false));
  };
  const approveAll = () => {
    const todo = toApprove;
    if (!todo.length) return;
    setBusy(true);
    Promise.all(todo.map(u => rrApi.post('/api/rosters/' + encodeURIComponent(u.entry.id) + '/status', {
      status: 'approved'
    }).catch(() => null))).then(res => {
      const ok = res.filter(r => r && r.ok).length;
      rrToast(ok + ' of ' + todo.length + ' unit rosters approved and released to the CNS', ok === todo.length ? 'success' : 'error');
      index.reload();
      setBusy(false);
    });
  };
  const years = useMemo(() => {
    const s = {};
    (index.rosters || []).forEach(r => {
      s[r.year] = 1;
    });
    s[now.getFullYear()] = 1;
    s[y] = 1;
    return Object.keys(s).map(Number).sort((a, b) => b - a);
  }, [index.rosters, y]);
  const audit = useMemo(() => rrAuditEntries(scoped), [scoped]);
  const body = React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, React.createElement(RRHeader, {
    month: m,
    year: y,
    months: R.MONTHS,
    years: years,
    setMonth: setM,
    setYear: setY,
    units: scoped.length,
    staffTotal: staffTotal,
    scope: scope,
    setScope: setScope,
    pending: pending,
    otLimit: otLimit,
    setOtLimit: setOt,
    otRaw: otRaw,
    setOtRaw: setOtRaw,
    onApproveAll: approveAll,
    busy: busy,
    canDecide: rrCanDecide()
  }), React.createElement(RRKpis, {
    tiles: tiles
  }), index.error && React.createElement("div", {
    className: "card",
    style: {
      padding: 14,
      color: '#a92c42',
      fontSize: 12
    }
  }, index.error), loading ? React.createElement("div", {
    className: "card",
    style: {
      display: 'grid',
      placeItems: 'center',
      padding: 40,
      color: MK.MUTED
    }
  }, "Loading ", R.MONTHS[m], " ", y, "\u2026") : React.createElement(React.Fragment, null, draftedUnits.length === 0 && React.createElement("div", {
    className: "card",
    style: {
      display: 'grid',
      placeItems: 'center',
      padding: 28,
      gap: 6,
      textAlign: 'center'
    }
  }, React.createElement("div", {
    style: {
      opacity: .35
    }
  }, React.createElement(Ic, {
    d: I.grid,
    s: 30
  })), React.createElement("div", {
    style: {
      fontWeight: 600,
      color: MK.INK
    }
  }, "No roster has been saved for ", R.MONTHS[m], " ", y), React.createElement("div", {
    className: "sub",
    style: {
      maxWidth: 460
    }
  }, "Every unit below is listed from the staff register, but there is no sheet to review yet \u2014 coverage, workload and overtime stay blank until a unit saves one.")), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(300px,352px) minmax(0,1fr)',
      gap: 14,
      alignItems: 'start'
    }
  }, React.createElement(RRTree, {
    divisions: divisions,
    open: open,
    setOpen: setOpen,
    q: q,
    setQ: setQ,
    matchLabel: matchLabel,
    sel: sel,
    setSel: setSel,
    selUnit: selUnit,
    setSelUnit: setSelUnit,
    inScope: inScope,
    unrostered: unrostered,
    bucket: bucket
  }), React.createElement(RRDiagram, {
    units: units,
    scoped: scoped,
    bucket: bucket,
    setBucket: setBucketId,
    day: day,
    setDay: setDay,
    days: days,
    month: m,
    year: y,
    sel: sel,
    setSel: setSel,
    selUnit: selUnit,
    setSelUnit: setSelUnit,
    inScope: inScope,
    setRoute: setRoute
  })), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) 340px',
      gap: 14,
      alignItems: 'start'
    }
  }, React.createElement(RRQueue, {
    units: units,
    bucket: bucket,
    inScope: inScope,
    selUnit: selUnit,
    setSelUnit: setSelUnit,
    onDecide: decide,
    busy: busy,
    canDecide: rrCanDecide(),
    month: m,
    year: y
  }), React.createElement(RRAudit, {
    entries: audit,
    month: m,
    year: y
  }))));
  return React.createElement("div", {
    className: "mk-scope"
  }, body);
}
window.RosterReviewFull = RosterReviewFull;
})();
