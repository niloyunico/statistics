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
function useRosterScope() {
  const [state, setState] = useState({
    units: null,
    scope: 'all',
    can: null,
    loading: true
  });
  useEffect(() => {
    let live = true;
    rosApi.get('/api/rosters/scope').then(r => {
      if (!live) return;
      if (r && r.ok) setState({
        units: Array.isArray(r.units) ? r.units : null,
        scope: r.scope || 'all',
        can: r.can || null,
        loading: false
      });else setState(s => ({
        ...s,
        loading: false
      }));
    }).catch(() => {
      if (live) setState(s => ({
        ...s,
        loading: false
      }));
    });
    return () => {
      live = false;
    };
  }, []);
  const allowed = useMemo(() => state.scope === 'departments' && state.units ? new Set(state.units) : null, [state.scope, state.units]);
  return {
    ...state,
    allowed,
    inScope: d => !allowed || allowed.has(d)
  };
}
function useRosterStaff() {
  const store = window.useStaffStore();
  const mayStaff = (() => {
    try {
      return window.unicoCan ? window.unicoCan('staff', 'view') : true;
    } catch (e) {
      return true;
    }
  })();
  const [own, setOwn] = useState(null);
  useEffect(() => {
    if (mayStaff) return undefined;
    let live = true;
    rosApi.get('/api/rosters/staff').then(r => {
      if (live && r && r.ok && Array.isArray(r.staff)) setOwn(r.staff);
    }).catch(() => {});
    return () => {
      live = false;
    };
  }, [mayStaff]);
  return useMemo(() => mayStaff ? store : {
    ...store,
    staff: own || []
  }, [mayStaff, store, own]);
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
const rosPortal = n => window.ReactDOM && window.ReactDOM.createPortal && typeof document !== 'undefined' ? window.ReactDOM.createPortal(n, document.body) : n;
const ROS_STATUS = {
  draft: {
    label: 'Draft',
    color: '#b5670a',
    bg: 'rgba(224,138,30,.14)'
  },
  pending_manager: {
    label: 'Pending Manager',
    color: '#0072a3',
    bg: 'rgba(0,144,202,.12)'
  },
  pending_cns: {
    label: 'Pending CNS',
    color: '#5b45c4',
    bg: 'rgba(106,82,212,.13)'
  },
  approved: {
    label: 'Approved',
    color: '#157a43',
    bg: 'rgba(31,157,87,.13)'
  },
  returned: {
    label: 'Returned',
    color: '#b4232f',
    bg: 'rgba(210,58,82,.12)'
  },
  none: {
    label: 'Not submitted',
    color: '#7d8ea8',
    bg: 'rgba(125,145,180,.14)'
  }
};
const rosStatusNorm = st => st === 'submitted' ? 'pending_cns' : ROS_STATUS[st] ? st : st ? 'draft' : 'none';
const ROS_EDITABLE = ['draft', 'returned'];
const ROS_SEND_ICON = 'M22 2L11 13M22 2l-7 20-4-9-9-4z';
const ROS_ACTIONS = {
  send_manager: {
    label: 'Send to Manager',
    done: 'Sent to the Manager for checking.',
    tone: 'pri',
    icon: ROS_SEND_ICON
  },
  send_cns: {
    label: 'Send to CNS',
    done: 'Sent straight to the CNS for approval.',
    tone: 'ghost',
    icon: ROS_SEND_ICON
  },
  forward: {
    label: 'Forward to CNS',
    done: 'Forwarded to the CNS for approval.',
    tone: 'pri',
    icon: 'M5 12h14M13 6l6 6-6 6'
  },
  approve: {
    label: 'Approve',
    done: 'Roster approved and locked.',
    tone: 'ok',
    icon: 'M4 12l5 5L20 6'
  },
  return: {
    label: 'Return',
    done: 'Roster returned to the in-charge.',
    tone: 'danger',
    icon: 'M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3'
  },
  reopen: {
    label: 'Reopen',
    done: 'Roster reopened for editing.',
    tone: 'ghost',
    icon: 'M1 4v6h6M3.5 15a9 9 0 102.1-9.4L1 10'
  }
};
const ROS_HIST_LABEL = {
  send_manager: 'Sent to Manager',
  send_cns: 'Sent straight to CNS',
  forward: 'Forwarded to CNS',
  approve: 'Approved',
  return: 'Returned',
  reopen: 'Reopened',
  resume: 'Edited after return',
  edit: 'Edited during review',
  create: 'Created'
};
const rosWhen = t => {
  if (!t) return '';
  const d = new Date(t);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short'
  }) + ', ' + d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  });
};
const rosSheetId = (dept, year, month) => 'ros-' + String(dept).slice(0, 40) + '-' + year + '-' + String(month).padStart(2, '0');
let ROS_CFG = null,
  ROS_CFG_REQ = null;
function rosLoadConfig(force) {
  if (ROS_CFG && !force) return Promise.resolve(ROS_CFG);
  if (ROS_CFG_REQ && !force) return ROS_CFG_REQ;
  ROS_CFG_REQ = rosApi.get('/api/rosters/config').then(j => {
    ROS_CFG = j && j.ok ? j : {
      cns: null,
      depts: []
    };
    ROS_CFG_REQ = null;
    return ROS_CFG;
  }).catch(() => {
    ROS_CFG_REQ = null;
    return ROS_CFG || {
      cns: null,
      depts: []
    };
  });
  return ROS_CFG_REQ;
}
function useRosterConfig() {
  const [v, setV] = useState(ROS_CFG);
  useEffect(() => {
    let live = true;
    rosLoadConfig().then(x => {
      if (live) setV(x);
    });
    return () => {
      live = false;
    };
  }, []);
  const reload = React.useCallback(() => rosLoadConfig(true).then(x => {
    setV(x);
    return x;
  }), []);
  return {
    cns: v && v.cns || null,
    depts: v && v.depts || [],
    updatedAt: v && v.updatedAt,
    loading: !v,
    reload
  };
}
const rosRulesOf = ru => {
  ru = ru || {};
  let cfg = {
    ...ROS_DEF_CFG,
    ...(ru.cfg || {})
  };
  if (!ru.cfg && ru.minMorning) {
    cfg = {
      ...cfg,
      minM: ru.minMorning && ru.minMorning.value || cfg.minM,
      minE: ru.minEvening && ru.minEvening.value || cfg.minE,
      minN: ru.minNight && ru.minNight.value || cfg.minN,
      maxNights: ru.maxConsecNight && ru.maxConsecNight.value || cfg.maxNights,
      maxLeavePerDay: ru.leaveClash && ru.leaveClash.value || cfg.maxLeavePerDay
    };
  }
  return {
    cfg,
    en: {
      ...ROS_DEF_OFF,
      ...(ru.off || {})
    },
    custom: Array.isArray(ru.custom) ? ru.custom : []
  };
};
const rosFindingsOf = (grid, rows, year, month, rules) => {
  const r = rosRulesOf(rules);
  return rosEval(grid || {}, rows || [], R.daysIn(year, month), year, month, r.cfg, r.en, r.custom);
};
const rosRowsFrom = (doc, staff, dept, withRegister) => {
  const all = {};
  (staff || []).forEach(e => {
    all[rosKey(e)] = e;
  });
  const reg = withRegister === false ? [] : (staff || []).filter(e => e.is_active !== false && !e.former && (e.current_department || 'Unassigned') === dept).map(e => ({
    empId: rosKey(e),
    empIdShown: e.emp_id || '',
    name: e.name,
    desig: e.designation
  }));
  const known = Object.keys(all).map(k => ({
    empId: k,
    empIdShown: all[k].emp_id || ''
  }));
  const grid = rosMigrateGrid(doc && doc.grid, known);
  const names = doc && doc.names || {};
  const seen = {},
    out = [];
  const add = id => {
    if (!id || seen[id]) return;
    seen[id] = 1;
    const e = all[id];
    out.push(e ? {
      empId: id,
      empIdShown: e.emp_id || '',
      name: e.name,
      desig: e.designation
    } : {
      empId: id,
      empIdShown: '',
      name: names[id] || id,
      desig: ''
    });
  };
  (doc && doc.order || []).forEach(id => {
    if (grid[id] || reg.some(r => r.empId === id)) add(id);
  });
  Object.keys(grid).forEach(add);
  reg.forEach(r => add(r.empId));
  return {
    rows: out,
    grid
  };
};
function RosStatusChip({
  st,
  stage,
  big
}) {
  const s = ROS_STATUS[rosStatusNorm(st)];
  return React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: big ? 11.5 : 10.5,
      fontWeight: 700,
      padding: big ? '6px 12px' : '3px 9px',
      borderRadius: 14,
      whiteSpace: 'nowrap',
      color: s.color,
      background: s.bg,
      border: '1px solid ' + s.color + '33'
    }
  }, React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: s.color
    }
  }), s.label, stage ? ' · ' + stage : '');
}
function RosDecisionButtons({
  status,
  can,
  onAction,
  busy,
  compact,
  hasManager
}) {
  const c = can || {};
  const resend = rosStatusNorm(status) === 'returned';
  const tones = {
    pri: {
      background: 'linear-gradient(135deg,#27a8db,#0072a3)',
      color: '#fff',
      border: '1px solid transparent',
      boxShadow: '0 6px 16px rgba(0,144,202,.28)'
    },
    ok: {
      background: 'linear-gradient(135deg,#2fbf7f,#157a43)',
      color: '#fff',
      border: '1px solid transparent',
      boxShadow: '0 6px 16px rgba(31,157,87,.28)'
    },
    danger: {
      background: 'rgba(210,58,82,.07)',
      color: '#b4232f',
      border: '1px solid rgba(210,58,82,.35)'
    },
    ghost: {
      background: 'rgba(255,255,255,.9)',
      color: '#0072a3',
      border: '1px solid rgba(0,114,163,.3)'
    }
  };
  const btn = (a, label) => {
    const m = ROS_ACTIONS[a];
    const noMgr = a === 'send_manager' && hasManager === false;
    const dis = busy || noMgr;
    return React.createElement("button", {
      key: a,
      type: "button",
      disabled: dis,
      onClick: e => {
        e.stopPropagation();
        onAction(a);
      },
      title: noMgr ? 'No Manager is set for this unit — an administrator sets one under Duty Roster → Setup.' : '',
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: compact ? '5px 10px' : '8px 14px',
        borderRadius: 9,
        fontSize: compact ? 11 : 12,
        fontWeight: 700,
        fontFamily: 'inherit',
        cursor: dis ? 'default' : 'pointer',
        opacity: dis ? .5 : 1,
        whiteSpace: 'nowrap',
        ...tones[m.tone]
      }
    }, React.createElement(Ic, {
      d: m.icon,
      s: compact ? 12 : 13,
      sw: 2.2
    }), label || m.label);
  };
  const out = [];
  if (c.send) {
    out.push(btn('send_cns', resend ? 'Resend to CNS' : null));
    out.push(btn('send_manager', resend ? 'Resend to Manager' : null));
  }
  if (c.return) out.push(btn('return'));
  if (c.forward) out.push(btn('forward'));
  if (c.approve) out.push(btn('approve'));
  if (c.reopen) out.push(btn('reopen'));
  if (!out.length) return null;
  return React.createElement("div", {
    style: {
      display: 'inline-flex',
      gap: 7,
      flexWrap: 'wrap',
      alignItems: 'center'
    }
  }, out);
}
function RosNoteModal({
  what,
  busy,
  onCancel,
  onConfirm
}) {
  const [note, setNote] = useState('');
  const presets = ['Night cover is below the minimum', 'Rule warnings are not resolved', 'Wrong staff on the sheet', 'Leave clash', 'Too many consecutive nights'];
  useEffect(() => {
    const k = e => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  return rosPortal(React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 9000,
      background: 'rgba(16,32,46,.42)',
      display: 'grid',
      placeItems: 'center',
      padding: 16
    },
    onMouseDown: e => {
      if (e.target === e.currentTarget) onCancel();
    }
  }, React.createElement("div", {
    style: {
      width: 'min(520px,100%)',
      background: 'var(--panel,#fff)',
      borderRadius: 14,
      boxShadow: '0 24px 60px rgba(16,32,46,.3)',
      overflow: 'hidden'
    }
  }, React.createElement("div", {
    style: {
      padding: '14px 18px',
      borderBottom: '1px solid rgba(125,145,180,.18)',
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, React.createElement("span", {
    style: {
      display: 'inline-grid',
      placeItems: 'center',
      width: 30,
      height: 30,
      borderRadius: 9,
      background: 'rgba(210,58,82,.12)',
      color: '#b4232f'
    }
  }, React.createElement(Ic, {
    d: ROS_ACTIONS.return.icon,
    s: 15,
    sw: 2.2
  })), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 800,
      fontSize: 14.5,
      color: '#16202e'
    }
  }, "Return this roster"), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: '#6c7a8c'
    }
  }, what, " goes back to the in-charge, flagged red."))), React.createElement("div", {
    style: {
      padding: '14px 18px'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: '#6c7a8c',
      textTransform: 'uppercase',
      letterSpacing: .5,
      marginBottom: 6
    }
  }, "Reason ", React.createElement("span", {
    style: {
      textTransform: 'none',
      fontWeight: 500
    }
  }, "(optional)")), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap',
      marginBottom: 8
    }
  }, presets.map(p => React.createElement("button", {
    key: p,
    type: "button",
    onClick: () => setNote(n => ((n ? n.replace(/\s*$/, '') + '\n' : '') + p).slice(0, 500)),
    style: {
      border: '1px solid rgba(125,145,180,.35)',
      background: 'rgba(125,145,180,.08)',
      color: '#3c4858',
      borderRadius: 14,
      padding: '4px 10px',
      fontSize: 11,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, p))), React.createElement("textarea", {
    value: note,
    onChange: e => setNote(e.target.value.slice(0, 500)),
    rows: 4,
    autoFocus: true,
    placeholder: "What should the in-charge fix? Leave blank to return without a note.",
    style: {
      width: '100%',
      boxSizing: 'border-box',
      borderRadius: 9,
      border: '1px solid rgba(125,145,180,.4)',
      padding: '9px 11px',
      fontFamily: 'inherit',
      fontSize: 12.5,
      resize: 'vertical',
      outline: 'none'
    }
  }), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: '#9aa6b4',
      textAlign: 'right'
    }
  }, note.length, "/500")), React.createElement("div", {
    style: {
      padding: '12px 18px',
      borderTop: '1px solid rgba(125,145,180,.18)',
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 8
    }
  }, React.createElement("button", {
    className: "btn",
    type: "button",
    onClick: onCancel,
    disabled: busy
  }, "Cancel"), React.createElement("button", {
    type: "button",
    disabled: busy,
    onClick: () => onConfirm(note.trim()),
    style: {
      border: 0,
      borderRadius: 9,
      padding: '8px 16px',
      fontWeight: 700,
      fontSize: 12.5,
      fontFamily: 'inherit',
      cursor: 'pointer',
      color: '#fff',
      background: 'linear-gradient(135deg,#e8697f,#b4232f)'
    }
  }, note.trim() ? 'Return with note' : 'Return without note')))));
}
function useRosDecide() {
  const [ask, setAsk] = useState(null);
  const [busy, setBusy] = useState(false);
  const post = (id, action, note) => {
    setBusy(true);
    return rosApi.post('/api/rosters/' + encodeURIComponent(id) + '/transition', {
      action,
      note: note || ''
    }).then(r => {
      setBusy(false);
      if (r && r.ok) {
        rosToast(ROS_ACTIONS[action].done);
        try {
          window.dispatchEvent(new Event('unico:ros-refresh'));
        } catch (e) {}
        return r;
      }
      rosToast(r && r.error || 'Could not complete that step.', 'error');
      return r || {
        ok: false
      };
    }).catch(() => {
      setBusy(false);
      rosToast('Could not reach the server.', 'error');
      return {
        ok: false
      };
    });
  };
  const run = async ({
    id,
    action,
    unit,
    period,
    warnings
  }) => {
    const what = unit + ' · ' + period;
    if (action === 'return') {
      const note = await new Promise(resolve => setAsk({
        what,
        resolve
      }));
      if (note === null) return {
        ok: false,
        cancelled: true
      };
      return post(id, action, note);
    }
    const warn = warnings ? ' It still has ' + warnings + ' rule warning' + (warnings === 1 ? '' : 's') + '.' : '';
    const msgs = {
      send_manager: ['Send to the Manager?', what + ' goes to the unit Manager for checking. It is locked while it is with them.' + warn],
      send_cns: ['Send straight to the CNS?', 'This skips the Manager check. ' + what + ' goes directly to the CNS for approval.' + warn, true],
      forward: ['Forward to the CNS?', 'You have checked ' + what + '. It goes to the CNS for final approval.'],
      approve: ['Approve this roster?', what + ' becomes the published roster and is locked.' + warn],
      reopen: ['Reopen this roster?', what + ' goes back to draft so it can be edited. It has to be sent for review again.', true]
    };
    const m = msgs[action];
    if (m) {
      const UI = window.UI || {};
      const yes = UI.confirm ? await UI.confirm({
        title: m[0],
        message: m[1],
        confirmLabel: ROS_ACTIONS[action].label,
        danger: !!m[2]
      }) : true;
      if (!yes) return {
        ok: false,
        cancelled: true
      };
    }
    return post(id, action, '');
  };
  const modal = ask ? React.createElement(RosNoteModal, {
    what: ask.what,
    busy: busy,
    onCancel: () => {
      ask.resolve(null);
      setAsk(null);
    },
    onConfirm: n => {
      ask.resolve(n);
      setAsk(null);
    }
  }) : null;
  return {
    run,
    modal,
    busy
  };
}
function RosHistoryTimeline({
  history,
  empty
}) {
  const list = (history || []).slice().reverse();
  if (!list.length) return React.createElement("div", {
    style: {
      padding: '10px 2px',
      fontSize: 12,
      color: '#8a97a8'
    }
  }, empty || 'Nothing yet — the history starts the first time this sheet is sent for review.');
  return React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column'
    }
  }, list.map((h, i) => {
    const c = h.action === 'return' ? '#b4232f' : h.action === 'approve' ? '#157a43' : ROS_STATUS[rosStatusNorm(h.to)].color;
    return React.createElement("div", {
      key: i,
      style: {
        display: 'flex',
        gap: 10
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
        background: c,
        marginTop: 4,
        boxShadow: '0 0 0 3px ' + c + '22'
      }
    }), i < list.length - 1 && React.createElement("span", {
      style: {
        flex: 1,
        width: 2,
        background: 'rgba(125,145,180,.25)',
        marginTop: 3
      }
    })), React.createElement("div", {
      style: {
        minWidth: 0,
        flex: 1,
        paddingBottom: 12
      }
    }, React.createElement("div", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        color: '#16202e'
      }
    }, ROS_HIST_LABEL[h.action] || h.action, " ", React.createElement("span", {
      style: {
        fontWeight: 500,
        color: '#6c7a8c'
      }
    }, "\xB7 ", h.byName || h.by || '—')), React.createElement("div", {
      style: {
        fontSize: 10.5,
        color: '#8a97a8'
      }
    }, rosWhen(h.at), h.revision != null ? ' · rev ' + h.revision : ''), h.action === 'return' && !h.note && React.createElement("div", {
      style: {
        marginTop: 4,
        fontSize: 11,
        color: '#8c1d2a',
        fontStyle: 'italic'
      }
    }, "No reason given"), h.note && React.createElement("div", {
      style: {
        marginTop: 4,
        fontSize: 11.5,
        color: h.action === 'return' ? '#8c1d2a' : '#3c4858',
        background: h.action === 'return' ? 'rgba(210,58,82,.08)' : 'rgba(125,145,180,.1)',
        borderLeft: '3px solid ' + c,
        padding: '5px 8px',
        borderRadius: 6,
        whiteSpace: 'pre-wrap'
      }
    }, h.note)));
  }));
}
function RosReturnedBanner({
  meta
}) {
  const m = meta || {};
  const by = m.returnedByName || m.returnedBy || 'the reviewer';
  const stage = m.returnStage === 'manager' ? 'Manager' : m.returnStage === 'cns' ? 'CNS' : '';
  return React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
      background: 'rgba(210,58,82,.07)',
      border: '1px solid rgba(210,58,82,.3)',
      borderLeft: '4px solid #b4232f',
      borderRadius: 12,
      padding: '11px 15px',
      marginBottom: 14
    }
  }, React.createElement("span", {
    style: {
      display: 'inline-grid',
      placeItems: 'center',
      width: 28,
      height: 28,
      borderRadius: 8,
      background: 'rgba(210,58,82,.14)',
      color: '#b4232f',
      flexShrink: 0
    }
  }, React.createElement(Ic, {
    d: ROS_ACTIONS.return.icon,
    s: 14,
    sw: 2.2
  })), React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 800,
      color: '#8c1d2a'
    }
  }, "Returned by ", by, stage ? ' (' + stage + ')' : '', m.returnedAt ? ' · ' + rosWhen(m.returnedAt) : ''), React.createElement("div", {
    style: {
      fontSize: 12,
      color: m.returnNote ? '#5a1620' : '#9a5a63',
      marginTop: 3,
      whiteSpace: 'pre-wrap',
      fontStyle: m.returnNote ? 'normal' : 'italic'
    }
  }, m.returnNote || 'No reason given.'), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: '#9a5a63',
      marginTop: 4
    }
  }, "Fix the sheet, then send it again. The return stays in the sheet's history.")));
}
function RosDrawer({
  title,
  sub,
  onClose,
  children,
  wide
}) {
  useEffect(() => {
    const k = e => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  return rosPortal(React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 8500,
      background: 'rgba(16,32,46,.32)',
      display: 'flex',
      justifyContent: 'flex-end'
    },
    onMouseDown: e => {
      if (e.target === e.currentTarget) onClose();
    }
  }, React.createElement("div", {
    style: {
      width: wide ? 'min(1180px,100%)' : 'min(420px,100%)',
      height: '100%',
      background: 'var(--panel,#fff)',
      boxShadow: '-18px 0 50px rgba(16,32,46,.22)',
      display: 'flex',
      flexDirection: 'column'
    }
  }, React.createElement("div", {
    style: {
      padding: '14px 18px',
      borderBottom: '1px solid rgba(125,145,180,.18)',
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 800,
      fontSize: 14.5,
      color: '#16202e'
    }
  }, title), sub && React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: '#6c7a8c'
    }
  }, sub)), React.createElement("button", {
    className: "btn sm",
    type: "button",
    onClick: onClose
  }, "Close")), React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto',
      padding: '14px 18px'
    }
  }, children))));
}
function RosSheetTable({
  rows,
  grid,
  year,
  month,
  maxHeight
}) {
  const days = R.daysIn(year, month);
  const ds = Array.from({
    length: days
  }, (_, i) => i + 1);
  const th = {
    position: 'sticky',
    top: 0,
    background: '#f2f6fb',
    fontSize: 9.5,
    fontWeight: 700,
    color: '#6c7a8c',
    padding: '5px 2px',
    borderBottom: '1px solid rgba(125,145,180,.3)',
    textAlign: 'center',
    zIndex: 1
  };
  const td = {
    fontFamily: ROS_MONO,
    fontSize: 9.4,
    fontWeight: 700,
    textAlign: 'center',
    padding: '3px 1px',
    borderBottom: '1px solid rgba(125,145,180,.12)',
    minWidth: 25
  };
  const g = grid || {};
  if (!rows || !rows.length) return React.createElement("div", {
    style: {
      padding: 24,
      textAlign: 'center',
      color: '#8a97a8',
      fontSize: 12
    }
  }, "No one is on this sheet.");
  return React.createElement("div", {
    style: {
      overflow: 'auto',
      maxHeight: maxHeight || '62vh',
      border: '1px solid rgba(125,145,180,.22)',
      borderRadius: 10,
      background: '#fff'
    }
  }, React.createElement("table", {
    style: {
      borderCollapse: 'separate',
      borderSpacing: 0,
      width: '100%'
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: {
      ...th,
      textAlign: 'left',
      left: 0,
      zIndex: 2,
      minWidth: 160,
      paddingLeft: 10
    }
  }, "Staff"), ds.map(d => {
    const fri = new Date(year, month, d).getDay() === 5;
    return React.createElement("th", {
      key: d,
      style: {
        ...th,
        background: fri ? '#e3edf8' : th.background
      }
    }, d, React.createElement("div", {
      style: {
        fontWeight: 500,
        fontSize: 8.5
      }
    }, String(rosDow(year, month, d)).slice(0, 2)));
  }), ['G', 'M', 'E', 'N', 'O'].map(b => React.createElement("th", {
    key: b,
    style: {
      ...th,
      color: rosBColor(b)
    }
  }, b)), React.createElement("th", {
    style: th
  }, "Hrs"))), React.createElement("tbody", null, rows.map(r => {
    const row = g[r.empId] || {};
    const t = R.totalsFor(row, days);
    return React.createElement("tr", {
      key: r.empId
    }, React.createElement("td", {
      style: {
        position: 'sticky',
        left: 0,
        background: '#fff',
        padding: '4px 10px',
        borderBottom: '1px solid rgba(125,145,180,.12)',
        fontSize: 11.5,
        whiteSpace: 'nowrap',
        maxWidth: 200,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        zIndex: 1
      }
    }, React.createElement("div", {
      style: {
        fontWeight: 600,
        color: '#16202e',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, r.name), React.createElement("div", {
      style: {
        fontSize: 9.5,
        color: '#8a97a8'
      }
    }, [r.empIdShown, r.desig].filter(Boolean).join(' · ') || ' ')), ds.map(d => {
      const c = row[d] || '';
      const col = c ? rosBColor(R.bucketOf(c)) : null;
      return React.createElement("td", {
        key: d,
        style: {
          ...td,
          color: col || '#ccd3dc',
          background: c ? col + '14' : 'transparent'
        }
      }, c || '·');
    }), ['G', 'M', 'E', 'N', 'O'].map(b => React.createElement("td", {
      key: b,
      style: {
        ...td,
        color: '#3c4858'
      }
    }, t[b] || '')), React.createElement("td", {
      style: {
        ...td,
        color: '#16202e'
      }
    }, t.hours || ''));
  }))));
}
function RosSignOff({
  signers,
  meta,
  dept
}) {
  const sg = signers || {},
    m = meta || {};
  const h = m.history || [];
  const lastOf = acts => {
    for (let i = h.length - 1; i >= 0; i--) if (acts.indexOf(h[i].action) >= 0) return {
      e: h[i],
      i
    };
    return null;
  };
  const st = rosStatusNorm(m.status);
  const inChain = st === 'pending_manager' || st === 'pending_cns' || st === 'approved';
  const sent = inChain ? lastOf(['send_manager', 'send_cns']) : null;
  const fwd0 = lastOf(['forward']);
  const fwd = fwd0 && sent && fwd0.i > sent.i ? fwd0 : null;
  const ok = st === 'approved' ? lastOf(['approve']) : null;
  const skipped = sent && sent.e.action === 'send_cns';
  const boxes = [['Prepared by', sent && m.preparedBy || sg.incharge && sg.incharge.name, 'In-charge · ' + dept, sent ? 'sent ' + rosWhen(sent.e.at) : 'not sent yet', !!sent, !sg.incharge, 'In-charge'], ['Checked by', fwd && m.checkedBy || sg.manager && sg.manager.name, 'Manager · ' + dept, fwd ? 'forwarded ' + rosWhen(fwd.e.at) : skipped ? 'skipped — sent straight to the CNS' : 'not checked yet', !!fwd, !sg.manager, 'Manager'], ['Approved by', ok && m.approvedBy || sg.cns && sg.cns.name, 'Chief of Nursing Services', ok ? 'approved ' + rosWhen(ok.e.at) : 'not approved yet', !!ok, !sg.cns, 'CNS']];
  const missing = boxes.filter(b => b[5]).map(b => b[6]);
  return React.createElement("div", {
    style: {
      background: 'linear-gradient(152deg,rgba(255,255,255,.78),rgba(236,247,255,.48))',
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
      marginBottom: 10
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
  }, "names come from Duty Roster \u2192 Setup")), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))',
      gap: 12
    }
  }, boxes.map(([role, name, caption, stamp, done]) => React.createElement("div", {
    key: role,
    style: {
      borderTop: '2px solid ' + (done ? '#1f9d57' : 'rgba(125,145,180,.3)'),
      paddingTop: 8
    }
  }, React.createElement("div", {
    style: {
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: .6,
      textTransform: 'uppercase',
      color: '#7d8ea8'
    }
  }, role), React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: name ? '#16202e' : '#b6c0cc',
      marginTop: 3
    }
  }, name || 'Not set'), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: '#9aa6b4'
    }
  }, caption), React.createElement("span", {
    style: {
      display: 'inline-block',
      marginTop: 5,
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: .4,
      textTransform: 'uppercase',
      color: done ? '#157a43' : '#9aa6b4',
      background: done ? 'rgba(31,157,87,.13)' : 'rgba(125,145,180,.12)',
      padding: '2px 7px',
      borderRadius: 8
    }
  }, stamp)))), missing.length > 0 && React.createElement("div", {
    style: {
      marginTop: 10,
      fontSize: 11,
      color: '#b5670a',
      background: 'rgba(224,138,30,.1)',
      borderRadius: 8,
      padding: '6px 10px'
    }
  }, missing.join(' and '), " not set for this unit \u2014 an administrator sets it once under ", React.createElement("b", null, "Duty Roster \u2192 Setup"), "."));
}
function RosVersions({
  sheetId,
  staff,
  dept,
  year,
  month,
  onClose
}) {
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    rosApi.get('/api/rosters/' + encodeURIComponent(sheetId) + '/versions').then(r => {
      if (r && r.ok) setList(r.versions || []);else {
        setErr(r && r.error || 'Could not load the versions.');
        setList([]);
      }
    }).catch(() => {
      setErr('Could not reach the server.');
      setList([]);
    });
  }, [sheetId]);
  const show = v => rosApi.get('/api/rosters/' + encodeURIComponent(sheetId) + '/versions/' + v.revision).then(r => {
    if (r && r.ok && r.version) setOpen({
      v,
      snap: r.version
    });else rosToast(r && r.error || 'Could not open that version.', 'error');
  }).catch(() => rosToast('Could not reach the server.', 'error'));
  const view = open ? rosRowsFrom(open.snap, staff, dept, false) : null;
  return React.createElement(RosDrawer, {
    wide: !!open,
    onClose: onClose,
    title: open ? 'Version rev ' + open.v.revision : 'Versions',
    sub: open ? (ROS_HIST_LABEL[open.v.action] || open.v.action || 'Saved') + ' · ' + (open.v.byName || open.v.by || '—') + ' · ' + rosWhen(open.v.at) : 'The sheet as it stood each time it was sent, returned or approved'
  }, open ? React.createElement("div", null, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: 'rgba(106,82,212,.08)',
      border: '1px solid rgba(106,82,212,.25)',
      borderRadius: 10,
      padding: '8px 12px',
      marginBottom: 12
    }
  }, React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: '#5b45c4',
      flex: 1
    }
  }, "Viewing an earlier version \u2014 read only. The current sheet is unchanged."), React.createElement("button", {
    className: "btn sm",
    type: "button",
    onClick: () => setOpen(null)
  }, "\u2039 All versions")), open.v.note && React.createElement("div", {
    style: {
      fontSize: 12,
      color: '#3c4858',
      marginBottom: 10,
      whiteSpace: 'pre-wrap'
    }
  }, React.createElement("b", null, "Note:"), " ", open.v.note), React.createElement(RosSheetTable, {
    rows: view.rows,
    grid: view.grid,
    year: year,
    month: month,
    maxHeight: "72vh"
  })) : list === null ? React.createElement("div", {
    style: {
      color: '#8a97a8',
      fontSize: 12
    }
  }, "Loading\u2026") : !list.length ? React.createElement("div", {
    style: {
      color: '#8a97a8',
      fontSize: 12
    }
  }, err || 'No versions yet — a snapshot is kept each time the sheet is sent for review.') : React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, list.map(v => React.createElement("button", {
    key: v.revision,
    type: "button",
    onClick: () => show(v),
    style: {
      textAlign: 'left',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      border: '1px solid rgba(125,145,180,.25)',
      background: '#fff',
      borderRadius: 10,
      padding: '9px 12px',
      cursor: 'pointer',
      fontFamily: 'inherit'
    }
  }, React.createElement("span", {
    style: {
      fontFamily: ROS_MONO,
      fontWeight: 700,
      fontSize: 12,
      color: '#0072a3',
      minWidth: 52
    }
  }, "rev ", v.revision), React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 12,
      fontWeight: 700,
      color: '#16202e'
    }
  }, ROS_HIST_LABEL[v.action] || v.action || 'Saved'), React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 10.5,
      color: '#8a97a8'
    }
  }, (v.byName || v.by || '—') + ' · ' + rosWhen(v.at))), React.createElement(RosStatusChip, {
    st: v.status
  })))));
}
function RosterHome({
  index,
  staffStore,
  scope,
  setRoute
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const sc = scope || {
    inScope: () => true,
    scope: 'all',
    loading: false,
    units: null
  };
  const mayReview = !!(sc.can && sc.can.review);
  const [tab, setTab] = useState('mine');
  const depts = useMemo(() => {
    const m = {};
    (staffStore.staff || []).filter(e => e.is_active !== false && !e.former).forEach(e => {
      const d = e.current_department || 'Unassigned';
      m[d] = (m[d] || 0) + 1;
    });
    if (sc.scope === 'departments' && sc.units) sc.units.forEach(u => {
      if (!(u in m)) m[u] = 0;
    });
    return Object.entries(m).filter(([d]) => sc.inScope(d)).sort((a, b) => b[1] - a[1]);
  }, [staffStore.staff, sc.units, sc.scope]);
  const byKey = useMemo(() => {
    const m = {};
    (index.rosters || []).forEach(r => {
      m[r.dept + '|' + r.year + '|' + r.month] = r;
    });
    return m;
  }, [index.rosters]);
  const recent = (index.rosters || []).slice(0, 12);
  if (mayReview && tab === 'access') return React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, React.createElement(RosterViewSwitch, {
    tab: tab,
    setTab: setTab
  }), React.createElement(RosterAccessReview, {
    setRoute: setRoute
  }));
  return React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, mayReview && React.createElement(RosterViewSwitch, {
    tab: tab,
    setTab: setTab
  }), React.createElement("div", {
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
  }, sc.scope === 'departments' ? 'The units your account is assigned. Pick one to open or start its ' + R.MONTHS[month] + ' ' + year + ' roster.' : 'Pick a unit to open or start its ' + R.MONTHS[month] + ' ' + year + ' roster.'), !depts.length && !sc.loading && React.createElement("div", {
    style: {
      display: 'grid',
      placeItems: 'center',
      padding: 30,
      textAlign: 'center',
      gap: 6
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
      fontWeight: 600
    }
  }, "No units assigned to you"), React.createElement("div", {
    className: "sub",
    style: {
      maxWidth: 420
    }
  }, "An administrator assigns the units you roster under ", React.createElement("b", null, "Users & Roles \u2192 Manage \u2192 Duty roster units"), ".")), React.createElement("div", {
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
        borderLeft: '3px solid ' + (ex ? ROS_STATUS[rosStatusNorm(ex.status)].color : 'transparent')
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
function RosterViewSwitch({
  tab,
  setTab
}) {
  return React.createElement("div", {
    style: {
      display: 'inline-flex',
      gap: 3,
      padding: 3,
      borderRadius: 9,
      background: 'rgba(125,145,180,.16)',
      alignSelf: 'flex-start'
    }
  }, [['mine', 'My units', 'Build and open the rosters you are assigned'], ['access', 'Access & coverage', 'Every unit, who may roster it, and what is missing']].map(([v, l, tip]) => {
    const on = tab === v;
    return React.createElement("button", {
      key: v,
      type: "button",
      title: tip,
      onClick: () => setTab(v),
      style: {
        border: 0,
        cursor: 'pointer',
        font: 'inherit',
        fontSize: 12,
        fontWeight: 700,
        padding: '7px 16px',
        borderRadius: 7,
        color: on ? '#fff' : '#6c7a8c',
        background: on ? 'linear-gradient(135deg,#27a8db,#0072a3)' : 'transparent'
      }
    }, l);
  }));
}
function RosterAccessReview({
  setRoute
}) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(true);
  const [q, setQ] = useState('');
  const [only, setOnly] = useState('all');
  const load = React.useCallback(() => {
    setBusy(true);
    setErr('');
    return rosApi.get('/api/rosters/access').then(r => {
      if (r && r.ok) setData(r);else setErr(r && r.error || 'Could not load the review.');
    }).catch(() => setErr('Could not reach the server.')).finally(() => setBusy(false));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const rows = data && data.departments || [];
  const people = data && data.people || [];
  const orphans = data && data.orphans || [];
  const noEditor = rows.filter(r => !r.editors);
  const noSheet = rows.filter(r => !r.current);
  const qn = q.trim().toLowerCase();
  const shown = rows.filter(r => {
    if (only === 'nobody' && r.editors) return false;
    if (only === 'nosheet' && r.current) return false;
    if (!qn) return true;
    return String(r.name).toLowerCase().includes(qn) || (r.holders || []).some(h => String(h.name).toLowerCase().includes(qn));
  });
  const tile = (n, label, tone, active, onClick) => React.createElement("div", {
    onClick: onClick,
    style: {
      flex: '1 1 150px',
      cursor: onClick ? 'pointer' : 'default',
      padding: '11px 13px',
      borderRadius: 10,
      background: '#fff',
      border: '1px solid ' + (active ? tone : 'rgba(125,145,180,.22)'),
      borderLeft: '3px solid ' + tone,
      boxShadow: active ? '0 0 0 2px ' + tone + '22' : 'none'
    }
  }, React.createElement("div", {
    className: "num",
    style: {
      fontSize: 21,
      fontWeight: 800,
      color: n ? tone : '#8b98ab',
      lineHeight: 1.1
    }
  }, n), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: '#6c7a8c',
      marginTop: 2,
      lineHeight: 1.4
    }
  }, label));
  const actionDot = h => {
    const may = a => (h.actions || []).indexOf(a) >= 0;
    return may('delete') ? ['Full', '#1f9d63'] : may('add') || may('edit') ? ['Edits', '#0090ca'] : ['Reads', '#8b98ab'];
  };
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
    d: I.users || I.user,
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
  }, "Access & coverage"), React.createElement("div", {
    className: "sub"
  }, "Every unit, who may roster it, and where ", data ? R.MONTHS[data.month] + ' ' + data.year : 'this month', " has no sheet yet")), React.createElement("button", {
    className: "btn",
    onClick: load,
    disabled: busy
  }, busy ? 'Loading…' : 'Refresh')), React.createElement("div", {
    className: "card-b"
  }, err && React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: '#b3261e',
      background: '#fdecea',
      border: '1px solid #f5c6c2',
      borderRadius: 8,
      padding: '9px 11px',
      marginBottom: 11
    }
  }, err), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 9,
      flexWrap: 'wrap',
      marginBottom: 12
    }
  }, tile(rows.length, 'Units in the hospital', '#27a8db', only === 'all', () => setOnly('all')), tile(noEditor.length, 'Nobody can edit the roster', '#d23a52', only === 'nobody', () => setOnly('nobody')), tile(noSheet.length, 'No sheet this month', '#e0a12a', only === 'nosheet', () => setOnly('nosheet')), tile(people.length, 'Accounts with roster access', '#1f9d63')), noEditor.length > 0 && only !== 'nobody' && React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: '#8a2733',
      background: '#fdecea',
      border: '1px solid #f5c6c2',
      borderRadius: 8,
      padding: '9px 11px',
      marginBottom: 11
    }
  }, React.createElement("b", null, noEditor.length, " unit", noEditor.length === 1 ? '' : 's', " have nobody who may edit the roster"), " \u2014 ", noEditor.slice(0, 5).map(r => r.name).join(', '), noEditor.length > 5 ? ' and ' + (noEditor.length - 5) + ' more' : '', ". Assign someone in Users & Roles \u2192 Manage \u2192 Duty roster access."), React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Search a unit or a person\u2026",
    style: {
      width: '100%',
      padding: '8px 11px',
      border: '1px solid rgba(125,145,180,.3)',
      borderRadius: 8,
      fontSize: 12.5,
      fontFamily: 'inherit',
      outline: 'none',
      marginBottom: 10
    }
  }), React.createElement("div", {
    style: {
      overflow: 'auto'
    }
  }, React.createElement("table", {
    className: "tbl",
    style: {
      width: '100%'
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Unit"), React.createElement("th", null, "This month"), React.createElement("th", null, "Sheets"), React.createElement("th", null, "Who may roster it"), React.createElement("th", null))), React.createElement("tbody", null, shown.map(r => React.createElement("tr", {
    key: r.id
  }, React.createElement("td", {
    style: {
      fontWeight: 600,
      whiteSpace: 'nowrap'
    }
  }, r.name), React.createElement("td", null, r.current ? React.createElement(RosStatusChip, {
    st: r.current.status
  }) : React.createElement("span", {
    className: "tag",
    style: {
      opacity: .6
    }
  }, "not drafted")), React.createElement("td", {
    className: "num"
  }, r.sheets || 0), React.createElement("td", null, !r.holders.length ? React.createElement("span", {
    style: {
      fontSize: 11.5,
      fontWeight: 700,
      color: '#d23a52'
    }
  }, "Nobody") : React.createElement("div", {
    style: {
      display: 'flex',
      gap: 5,
      flexWrap: 'wrap'
    }
  }, r.holders.map(h => {
    const [lbl, c] = actionDot(h);
    return React.createElement("span", {
      key: h.username,
      title: h.name + ' · ' + lbl.toLowerCase() + (h.scope === 'all' ? ' · holds every unit' : '') + (h.inherited ? ' · never assigned units, so it inherits this reach' : ''),
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: '#fff',
        border: '1px solid ' + c + '55',
        color: '#4a5768'
      }
    }, React.createElement("span", {
      style: {
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: c,
        flexShrink: 0
      }
    }), h.name, h.scope === 'all' && React.createElement("span", {
      style: {
        fontSize: 9,
        opacity: .6
      }
    }, "ALL"), h.inherited && React.createElement("span", {
      title: "Never assigned any units \u2014 it still reaches this one",
      style: {
        fontSize: 9,
        color: '#e0a12a'
      }
    }, "!"));
  }))), React.createElement("td", {
    style: {
      textAlign: 'right',
      whiteSpace: 'nowrap'
    }
  }, React.createElement("button", {
    className: "btn",
    onClick: () => setRoute({
      view: 'rosterGrid',
      dept: r.name,
      year: data.year,
      month: data.month
    })
  }, "Open")))), !shown.length && !busy && React.createElement("tr", null, React.createElement("td", {
    colSpan: 5,
    style: {
      textAlign: 'center',
      padding: 24
    },
    className: "sub"
  }, "Nothing matches that filter."))))), React.createElement("div", {
    className: "sub",
    style: {
      fontSize: 10.5,
      marginTop: 9,
      lineHeight: 1.6
    }
  }, React.createElement("b", {
    style: {
      color: '#1f9d63'
    }
  }, "\u25CF"), " full access (may publish) \xB7 ", React.createElement("b", {
    style: {
      color: '#0090ca'
    }
  }, "\u25CF"), " may build and submit \xB7 ", React.createElement("b", {
    style: {
      color: '#8b98ab'
    }
  }, "\u25CF"), " read only.", React.createElement("b", null, "ALL"), " = the account holds every unit. ", React.createElement("b", {
    style: {
      color: '#e0a12a'
    }
  }, "!"), " = never assigned any units, so it still reaches this one \u2014 set it explicitly in Users & Roles."))), orphans.length > 0 && React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Sheets outside any unit"), React.createElement("div", {
    className: "sub"
  }, "filed under a name no department matches")), React.createElement("div", {
    className: "card-b"
  }, React.createElement("div", {
    className: "sub",
    style: {
      marginBottom: 9
    }
  }, "Only an account holding ", React.createElement("i", null, "every"), " unit can open these \u2014 a unit-scoped account cannot, however it is assigned. Usually a department renamed after the sheet was written."), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap'
    }
  }, orphans.map(o => React.createElement("span", {
    key: o.id,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      borderRadius: 999,
      fontSize: 11.5,
      fontWeight: 600,
      background: '#fff8e9',
      border: '1px solid #f1d49a',
      color: '#8a5a00'
    }
  }, o.dept, " ", React.createElement("span", {
    style: {
      opacity: .7,
      fontWeight: 500
    }
  }, R.MONTHS[o.month], " ", o.year)))))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Accounts with roster access"), React.createElement("div", {
    className: "sub"
  }, people.length, " sign-in", people.length === 1 ? '' : 's', " that can open the module")), React.createElement("div", {
    className: "card-b",
    style: {
      overflow: 'auto'
    }
  }, React.createElement("table", {
    className: "tbl",
    style: {
      width: '100%'
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Person"), React.createElement("th", null, "Can"), React.createElement("th", null, "Units"))), React.createElement("tbody", null, people.map(p => {
    const [lbl, c] = actionDot(p);
    return React.createElement("tr", {
      key: p.username
    }, React.createElement("td", {
      style: {
        fontWeight: 600
      }
    }, p.name, React.createElement("span", {
      className: "sub",
      style: {
        fontWeight: 400
      }
    }, " \xB7 ", p.username)), React.createElement("td", null, React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11.5,
        fontWeight: 600,
        color: '#4a5768'
      }
    }, React.createElement("span", {
      style: {
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: c
      }
    }), lbl)), React.createElement("td", {
      className: "sub"
    }, p.covers === null ? React.createElement("b", {
      style: {
        color: MK.INK
      }
    }, "Every unit", p.inherited ? ' (never assigned — inherited)' : '') : !p.covers.length ? React.createElement("b", {
      style: {
        color: '#d23a52'
      }
    }, "None \u2014 the module opens empty") : p.covers.map(id => (rows.find(r => r.id === id) || {}).name || id).join(', ')));
  }), !people.length && !busy && React.createElement("tr", null, React.createElement("td", {
    colSpan: 3,
    style: {
      textAlign: 'center',
      padding: 22
    },
    className: "sub"
  }, "No account has Duty Roster access yet.")))))));
}
function RosterGrid({
  staffStore,
  scope,
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
  const [meta, setMeta] = useState({});
  const [sheetCan, setSheetCan] = useState(null);
  const [signers, setSigners] = useState({});
  const [panel, setPanel] = useState(null);
  const decider = useRosDecide();
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
  const inScope = scope && scope.inScope || (() => true);
  const depts = useMemo(() => [...new Set((staffStore.staff || []).filter(e => e.is_active !== false && !e.former).map(e => e.current_department || 'Unassigned'))].filter(d => d === dept || inScope(d)).sort(), [staffStore.staff, dept, inScope]);
  const monthUrl = '/api/rosters/' + encodeURIComponent(dept) + '/' + year + '/' + month;
  const applyMeta = r => {
    const d = r.roster;
    setMeta(d ? {
      ...d,
      grid: undefined
    } : {});
    setSheetCan(d && d.can || r.can || null);
    setSigners(r.signers || {});
  };
  useEffect(() => {
    setLoading(true);
    setLoadError('');
    setConflict('');
    rosApi.get(monthUrl).then(r => {
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
      const ru = rosRulesOf(d && d.rules);
      setCfg(ru.cfg);
      setEn(ru.en);
      setCustom(ru.custom);
      applyMeta(r);
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
  const stNorm = rosStatusNorm(status);
  const locked = ROS_EDITABLE.indexOf(stNorm) < 0;
  const canEdit = !loadError && !conflict && (sheetCan ? !!sheetCan.edit : !locked && rosCan('edit'));
  const editBlocked = () => {
    rosToast(conflict ? 'Someone else saved this roster. Reload the month before editing.' : stNorm === 'approved' ? 'Approved and locked — an administrator can reopen it for editing.' : stNorm === 'pending_manager' ? 'This roster is with the Manager for checking — ask them to return it if it needs changes.' : stNorm === 'pending_cns' ? 'This roster is with the CNS for approval — ask them to return it if it needs changes.' : 'You do not have edit rights on this roster.', 'info');
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
      }, {})
    }).then(r => {
      setBusy(false);
      if (r && r.ok) {
        setRev(r.roster && r.roster.revision || rev + 1);
        if (r.roster) {
          setStatus(r.roster.status || status);
          setMeta(m => ({
            ...m,
            ...r.roster,
            grid: undefined
          }));
          if (r.roster.can) setSheetCan(r.roster.can);
        }
        setDirty(false);
        if (!quiet) rosToast('Roster saved.');
        if (onSaved) onSaved();
        return true;
      }
      if (r && r.conflict) setConflict(r.error || 'Someone else saved this roster.');
      if (r && r.locked) refreshMeta();
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
  }, [grid, cfg, en, custom, dirty, retryTick]);
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
  const refreshMeta = () => rosApi.get(monthUrl).then(r => {
    if (!r || !r.ok) return;
    applyMeta(r);
    if (r.roster) {
      setStatus(r.roster.status || 'draft');
      setRev(r.roster.revision || 0);
    }
  }).catch(() => {});
  const act = async action => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (canEdit && (dirty || !rev)) {
      const ok = await save(null, true);
      if (ok === false) return;
    }
    const r = await decider.run({
      id: meta.id || rosSheetId(dept, year, month),
      action,
      unit: dept,
      period: monthLabel,
      warnings: totalViol
    });
    if (r && r.ok) {
      await refreshMeta();
      if (onSaved) onSaved();
    } else if (r && r.code === 'conflict') refreshMeta();
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
  }, monthLabel, " \xB7 ", days, " days \xB7 ", rows.length, " staff \xB7 prepared by the in-charge, checked by the Manager, approved by the CNS")), React.createElement("div", {
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
  }, d))), React.createElement("button", {
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
  }), "Auto-draft"), React.createElement(RosStatusChip, {
    st: status,
    big: true
  }))), (() => {
    const s = ROS_STATUS[stNorm];
    const sentBy = meta.sentByName || meta.sentBy;
    const sent = meta.sentAt ? ' · sent ' + rosWhen(meta.sentAt) + (sentBy ? ' by ' + sentBy : '') : '';
    const line = stNorm === 'pending_manager' ? 'With ' + (signers.manager && signers.manager.name || 'the Manager') + ' for checking' + sent : stNorm === 'pending_cns' ? 'With ' + (signers.cns && signers.cns.name || 'the CNS') + ' for approval' + sent : stNorm === 'approved' ? 'Approved by ' + (meta.approvedBy || '—') + (meta.approvedAt ? ' · ' + rosWhen(meta.approvedAt) : '') + ' — published and locked' : stNorm === 'returned' ? 'Returned to the in-charge — fix the sheet and send it again' : 'Draft with the in-charge — send it to the Manager (or straight to the CNS) when it is ready';
    const histN = (meta.history || []).length;
    return React.createElement("div", {
      style: {
        background: 'rgba(255,255,255,.84)',
        border: '1px solid rgba(255,255,255,.95)',
        borderLeft: '4px solid ' + s.color,
        borderRadius: 14,
        boxShadow: '0 10px 28px rgba(31,59,90,.1)',
        padding: '11px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        marginBottom: 14
      }
    }, React.createElement("div", {
      style: {
        minWidth: 220,
        flex: 1
      }
    }, React.createElement("div", {
      style: {
        fontSize: 12.8,
        fontWeight: 700,
        color: '#16202e'
      }
    }, line), React.createElement("div", {
      style: {
        fontSize: 11,
        color: '#6c7a8c',
        marginTop: 2
      }
    }, rev ? 'Saved · rev ' + rev + (meta.updatedBy ? ' · by ' + meta.updatedBy : '') + (meta.updatedAt ? ' · ' + rosWhen(meta.updatedAt) : '') : 'Not saved yet', dirty ? ' · saving…' : '')), React.createElement("button", {
      className: "btn sm",
      type: "button",
      onClick: () => setPanel('history')
    }, "History", histN ? ' · ' + histN : ''), React.createElement("button", {
      className: "btn sm",
      type: "button",
      disabled: !rev,
      onClick: () => setPanel('versions')
    }, "Versions"), React.createElement("button", {
      className: "btn sm",
      type: "button",
      onClick: () => setRoute({
        view: 'rosterPrint',
        dept,
        year,
        month
      })
    }, "Print"), canEdit && React.createElement("button", {
      className: "btn sm",
      type: "button",
      disabled: busy || !dirty,
      onClick: () => {
        if (saveTimer.current) {
          clearTimeout(saveTimer.current);
          saveTimer.current = null;
        }
        save(null, false);
      }
    }, "Save draft"), sheetCan && sheetCan.send && totalViol > 0 && React.createElement("span", {
      onClick: goRules,
      title: "Sending is still allowed \u2014 the reviewer sees the same warnings",
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: '#a92c42',
        cursor: 'pointer'
      }
    }, totalViol, " rule warning", totalViol === 1 ? '' : 's'), React.createElement(RosDecisionButtons, {
      status: status,
      can: sheetCan,
      onAction: act,
      busy: busy || decider.busy,
      hasManager: !!signers.manager
    }));
  })(), stNorm === 'returned' && React.createElement(RosReturnedBanner, {
    meta: meta
  }), decider.modal, panel === 'history' && React.createElement(RosDrawer, {
    title: "History",
    sub: dept + ' · ' + monthLabel,
    onClose: () => setPanel(null)
  }, React.createElement(RosHistoryTimeline, {
    history: meta.history
  })), panel === 'versions' && React.createElement(RosVersions, {
    sheetId: meta.id || rosSheetId(dept, year, month),
    staff: staffStore.staff,
    dept: dept,
    year: year,
    month: month,
    onClose: () => setPanel(null)
  }), React.createElement("div", {
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
    }, React.createElement(RosSignOff, {
      signers: signers,
      meta: {
        ...meta,
        status
      },
      dept: dept
    })));
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
  const [signers, setSigners] = useState({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    rosApi.get('/api/rosters/' + encodeURIComponent(dept) + '/' + year + '/' + month).then(r => {
      setDoc(r && r.ok ? r.roster : null);
      setSigners(r && r.ok && r.signers || {});
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
  const sig = window.unicoSig && window.unicoSig.load && window.unicoSig.load() || {};
  const nm = k => signers[k] && signers[k].name || '';
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
  }, "1:1 with the roster workbook"), rosCan('print') && React.createElement("button", {
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
  }, R.MONTHS[month], " ", year, doc ? ' · revision ' + (doc.revision || 1) + ' · ' + ROS_STATUS[rosStatusNorm(doc.status)].label : ' · not yet drafted')), React.createElement("table", {
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
  }, [['Prepared By', doc && doc.preparedBy || nm('incharge') || sig.prepared], ['Checked By', doc && doc.checkedBy || nm('manager') || sig.reviewed], ['Approved By', doc && doc.approvedBy || nm('cns') || sig.approved]].map(([l, n]) => React.createElement("div", {
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
  const staffStore = useRosterStaff();
  const index = useRosterIndex();
  const scope = useRosterScope();
  const now = new Date();
  const y = Number(year) || now.getFullYear();
  const m = Number.isInteger(Number(month)) ? Number(month) : now.getMonth();
  const inner = (() => {
    if (view !== 'rosterHome' && !dept) return React.createElement(RosterHome, {
      index: index,
      staffStore: staffStore,
      scope: scope,
      setRoute: setRoute
    });
    if (dept && !scope.loading && !scope.inScope(dept) && !(scope.can && scope.can.review)) return React.createElement(RosterNoAccess, {
      dept: dept,
      setRoute: setRoute
    });
    switch (view) {
      case 'rosterGrid':
        return React.createElement(RosterGrid, {
          key: dept + '|' + y + '|' + m,
          staffStore: staffStore,
          scope: scope,
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
          scope: scope,
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
          scope: scope,
          setRoute: setRoute
        });
    }
  })();
  return React.createElement("div", {
    className: "mk-scope"
  }, inner);
}
function RosterNoAccess({
  dept,
  setRoute
}) {
  return React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-b",
    style: {
      display: 'grid',
      placeItems: 'center',
      padding: 44,
      textAlign: 'center',
      gap: 8
    }
  }, React.createElement("div", {
    style: {
      opacity: .35
    }
  }, React.createElement(Ic, {
    d: I.lock || I.grid,
    s: 32
  })), React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 14.5
    }
  }, "You are not assigned to ", dept), React.createElement("div", {
    className: "sub",
    style: {
      maxWidth: 420
    }
  }, "Your account holds the duty roster for other units. An administrator can add ", dept, " to it under ", React.createElement("b", null, "Users & Roles \u2192 Manage \u2192 Duty roster units"), "."), React.createElement("button", {
    className: "btn pri",
    style: {
      marginTop: 6
    },
    onClick: () => setRoute({
      view: 'rosterHome'
    })
  }, "Back to my units")));
}
window.RosterView = RosterView;
window.UNICO_ROSTER_KIT = {
  api: rosApi,
  toast: rosToast,
  can: rosCan,
  portal: rosPortal,
  key: rosKey,
  migrateGrid: rosMigrateGrid,
  sheetId: rosSheetId,
  when: rosWhen,
  useRosterIndex,
  useRosterScope,
  useRosterStaff,
  useRosterConfig,
  loadConfig: rosLoadConfig,
  useRosDecide,
  ROS_STATUS,
  ROS_ACTIONS,
  ROS_HIST_LABEL,
  ROS_EDITABLE,
  statusNorm: rosStatusNorm,
  RosStatusChip,
  RosDecisionButtons,
  RosHistoryTimeline,
  RosReturnedBanner,
  RosDrawer,
  RosSheetTable,
  RosSignOff,
  RosVersions,
  rulesOf: rosRulesOf,
  findingsOf: rosFindingsOf,
  rowsFrom: rosRowsFrom,
  bColor: rosBColor,
  MONO: ROS_MONO
};
})();
;
/* ===== roster-review.jsx ===== */
(function(){
const {
  useState,
  useEffect,
  useMemo,
  useCallback
} = React;
const Ic = window.Ic,
  I = window.I;
const R = window.UNICO_ROSTER;
const MK = window.MK;
(function riCss() {
  if (typeof document === 'undefined' || document.getElementById('ri-css')) return;
  const el = document.createElement('style');
  el.id = 'ri-css';
  el.textContent = '@media (max-width: 960px){ .ri-split{ grid-template-columns: 1fr !important; } .ri-split > div{ position: static !important; } }';
  document.head.appendChild(el);
})();
const RI_TABS = [['awaiting', 'Awaiting me'], ['inreview', 'In review'], ['returned', 'Returned'], ['approved', 'Approved'], ['none', 'Not submitted'], ['all', 'All units']];
const riNorm = r => r.hasSheet ? window.UNICO_ROSTER_KIT.statusNorm(r.status) : 'none';
const riIn = (tab, r) => {
  const st = riNorm(r);
  if (tab === 'awaiting') return !!r.pendingForMe;
  if (tab === 'inreview') return st === 'pending_manager' || st === 'pending_cns';
  if (tab === 'returned') return st === 'returned';
  if (tab === 'approved') return st === 'approved';
  if (tab === 'none') return st === 'none' || st === 'draft';
  return true;
};
const RI_OVERTIME_H = 200;
function useRosterReview(year, month) {
  const K = window.UNICO_ROSTER_KIT;
  const [state, setState] = useState({
    rows: [],
    cns: null,
    loading: true,
    error: ''
  });
  const load = useCallback(() => K.api.get('/api/rosters/review?year=' + year + '&month=' + month).then(r => {
    if (r && r.ok) setState({
      rows: r.rows || [],
      cns: r.cns || null,
      loading: false,
      error: ''
    });else setState(s => ({
      ...s,
      loading: false,
      error: r && r.error || 'Could not load the review list.'
    }));
  }).catch(() => setState(s => ({
    ...s,
    loading: false,
    error: 'Could not reach the server.'
  }))), [year, month]);
  useEffect(() => {
    setState(s => ({
      ...s,
      loading: true
    }));
    load();
  }, [load]);
  useEffect(() => {
    const on = () => load();
    window.addEventListener('unico:ros-refresh', on);
    window.addEventListener('focus', on);
    return () => {
      window.removeEventListener('unico:ros-refresh', on);
      window.removeEventListener('focus', on);
    };
  }, [load]);
  return {
    ...state,
    reload: load
  };
}
const riPerson = p => p && p.name ? p.name : null;
const riSentShown = st => st === 'pending_manager' || st === 'pending_cns' || st === 'approved' || st === 'returned';
const RI_TH = {
  textAlign: 'left',
  padding: '9px 12px',
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '.5px',
  textTransform: 'uppercase',
  color: '#7d8ea8',
  borderBottom: '1px solid rgba(125,145,180,.25)',
  whiteSpace: 'nowrap',
  background: 'rgba(242,246,251,.7)'
};
const RI_TD = {
  padding: '9px 12px',
  fontSize: 12,
  color: '#3c4858',
  borderBottom: '1px solid rgba(125,145,180,.14)',
  verticalAlign: 'middle'
};
function RiKpi({
  label,
  value,
  color,
  on,
  onClick
}) {
  return React.createElement("button", {
    type: "button",
    onClick: onClick,
    style: {
      textAlign: 'left',
      fontFamily: 'inherit',
      cursor: 'pointer',
      border: '1px solid ' + (on ? color + '66' : 'rgba(255,255,255,.92)'),
      background: on ? color + '12' : 'linear-gradient(152deg,rgba(255,255,255,.8),rgba(236,247,255,.5))',
      borderRadius: 14,
      padding: '11px 14px',
      boxShadow: '0 8px 24px rgba(31,59,90,.08)'
    }
  }, React.createElement("div", {
    style: {
      fontFamily: "'IBM Plex Mono',monospace",
      fontSize: 20,
      fontWeight: 700,
      color: value ? color : '#9aa6b4',
      lineHeight: 1.1
    }
  }, value), React.createElement("div", {
    style: {
      fontSize: 11,
      color: '#6c7a8c',
      marginTop: 2
    }
  }, label));
}
function RiPreview({
  row,
  year,
  month,
  staff,
  onBack,
  onDecide,
  busy,
  setRoute
}) {
  const K = window.UNICO_ROSTER_KIT;
  const [doc, setDoc] = useState(null);
  const [extra, setExtra] = useState({
    signers: {},
    can: null
  });
  const [err, setErr] = useState('');
  const dept = row.sheetDept || row.deptName;
  const load = useCallback(() => K.api.get('/api/rosters/' + encodeURIComponent(dept) + '/' + year + '/' + month).then(r => {
    if (r && r.ok) {
      setDoc(r.roster || null);
      setExtra({
        signers: r.signers || {},
        can: r.roster && r.roster.can || r.can || null
      });
      setErr('');
    } else setErr(r && r.error || 'Could not load the sheet.');
  }).catch(() => setErr('Could not reach the server.')), [dept, year, month]);
  useEffect(() => {
    load();
  }, [load]);
  const view = useMemo(() => doc ? K.rowsFrom(doc, staff, dept) : {
    rows: [],
    grid: {}
  }, [doc, staff, dept]);
  const ev = useMemo(() => doc ? K.findingsOf(view.grid, view.rows, year, month, doc.rules) : null, [doc, view, year, month]);
  const stats = useMemo(() => {
    const days = R.daysIn(year, month);
    let hours = 0,
      shifts = 0,
      over = 0;
    view.rows.forEach(x => {
      const t = R.totalsFor(view.grid[x.empId] || {}, days);
      hours += t.hours;
      shifts += t.G + t.M + t.E + t.N;
      if (t.hours > RI_OVERTIME_H) over++;
    });
    return {
      hours,
      shifts,
      over
    };
  }, [view, year, month]);
  const decide = action => onDecide({
    ...row,
    id: doc && doc.id || row.id
  }, action).then(r => {
    if (r && r.ok) load();
  });
  const period = R.MONTHS[month] + ' ' + year;
  const card = {
    background: 'linear-gradient(152deg,rgba(255,255,255,.82),rgba(236,247,255,.5))',
    border: '1px solid rgba(255,255,255,.92)',
    borderRadius: 16,
    boxShadow: '0 12px 34px rgba(31,59,90,.11)',
    padding: '14px 16px'
  };
  return React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, React.createElement("div", {
    style: {
      ...card,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap'
    }
  }, React.createElement("button", {
    className: "btn sm",
    type: "button",
    onClick: onBack
  }, "\u2039 Back to the list"), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 200
    }
  }, React.createElement("div", {
    style: {
      fontSize: 15.5,
      fontWeight: 800,
      color: '#16202e'
    }
  }, row.deptName, " \xB7 ", period), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: '#6c7a8c'
    }
  }, doc ? 'rev ' + (doc.revision || 0) + (doc.updatedBy ? ' · last saved by ' + doc.updatedBy + ' · ' + K.when(doc.updatedAt) : '') : 'No sheet saved for this month')), React.createElement(K.RosStatusChip, {
    st: doc ? doc.status : null,
    big: true
  }), React.createElement("button", {
    className: "btn sm",
    type: "button",
    onClick: () => setRoute({
      view: 'rosterGrid',
      dept,
      year,
      month
    })
  }, "Open in editor"), doc && React.createElement("button", {
    className: "btn sm",
    type: "button",
    onClick: () => setRoute({
      view: 'rosterPrint',
      dept,
      year,
      month
    })
  }, "Print")), err && React.createElement("div", {
    style: {
      ...card,
      color: '#b4232f',
      fontSize: 12.5
    }
  }, err), doc && K.statusNorm(doc.status) === 'returned' && React.createElement(K.RosReturnedBanner, {
    meta: doc
  }), doc && React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) 330px',
      gap: 14,
      alignItems: 'start'
    },
    className: "ri-split"
  }, React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))',
      gap: 10
    }
  }, [['Staff on sheet', view.rows.length, '#0072a3'], ['Shifts', stats.shifts, '#2b9488'], ['Total hours', stats.hours, '#5b45c4'], ['Over ' + RI_OVERTIME_H + ' h', stats.over, stats.over ? '#b5670a' : '#157a43'], ['Rule warnings', ev ? ev.totalViol : 0, ev && ev.totalViol ? '#b4232f' : '#157a43']].map(([l, v, c]) => React.createElement("div", {
    key: l,
    style: {
      ...card,
      padding: '10px 12px'
    }
  }, React.createElement("div", {
    style: {
      fontFamily: "'IBM Plex Mono',monospace",
      fontSize: 18,
      fontWeight: 700,
      color: c
    }
  }, v), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: '#6c7a8c'
    }
  }, l)))), React.createElement(K.RosSheetTable, {
    rows: view.rows,
    grid: view.grid,
    year: year,
    month: month,
    maxHeight: "56vh"
  }), ev && React.createElement("div", {
    style: card
  }, React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      color: '#16202e',
      marginBottom: 8
    }
  }, "Rule checks ", React.createElement("span", {
    style: {
      fontWeight: 500,
      color: '#8a97a8'
    }
  }, "\xB7 ", ev.okRules, " of ", ev.rules.length, " clear")), ev.rules.map(([rule, base, list], i) => React.createElement("div", {
    key: rule + i,
    style: {
      display: 'flex',
      gap: 10,
      padding: '6px 0',
      borderTop: i ? '1px solid rgba(125,145,180,.12)' : 0
    }
  }, React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      marginTop: 5,
      flexShrink: 0,
      background: list.length ? '#d23a52' : '#1f9d57'
    }
  }), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
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
      color: '#6c7a8c'
    }
  }, list.length ? list.slice(0, 3).join(' · ') + (list.length > 3 ? ' +' + (list.length - 3) + ' more' : '') : base)), React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: list.length ? '#a92c42' : '#157a43'
    }
  }, list.length || 'ok')))), React.createElement(K.RosSignOff, {
    signers: extra.signers,
    meta: doc,
    dept: row.deptName
  })), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      position: 'sticky',
      top: 12
    }
  }, React.createElement("div", {
    style: card
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: .5,
      textTransform: 'uppercase',
      color: '#7d8ea8',
      marginBottom: 8
    }
  }, "Decision"), React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: '#16202e',
      fontWeight: 600,
      marginBottom: 4
    }
  }, doc.sentAt && riSentShown(K.statusNorm(doc.status)) ? 'Sent ' + K.when(doc.sentAt) + ' by ' + (doc.sentByName || doc.sentBy || '—') : 'With the in-charge — not sent for review yet'), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: '#6c7a8c',
      marginBottom: 12
    }
  }, ev && ev.totalViol ? ev.totalViol + ' rule warning' + (ev.totalViol === 1 ? '' : 's') + ' on this sheet. ' : 'No rule warnings. ', stats.over ? stats.over + ' staff over ' + RI_OVERTIME_H + ' h.' : ''), K.RosDecisionButtons({
    status: doc.status,
    can: extra.can,
    onAction: decide,
    busy,
    hasManager: !!(extra.signers && extra.signers.manager)
  }) || React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: '#8a97a8'
    }
  }, "No step for you on this sheet right now.")), React.createElement("div", {
    style: card
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: .5,
      textTransform: 'uppercase',
      color: '#7d8ea8',
      marginBottom: 10
    }
  }, "History"), React.createElement(K.RosHistoryTimeline, {
    history: doc.history
  })))), !doc && !err && React.createElement("div", {
    style: {
      ...card,
      textAlign: 'center',
      padding: 34,
      color: '#6c7a8c',
      fontSize: 12.5
    }
  }, row.hasSheet ? 'Loading the sheet…' : 'Nobody has started this unit’s ' + period + ' roster yet.'));
}
function RosterReviewFull({
  setRoute,
  year: y0,
  month: m0
}) {
  const K = window.UNICO_ROSTER_KIT;
  const now = new Date();
  const [year, setYear] = useState(Number(y0) || now.getFullYear());
  const [month, setMonth] = useState(Number.isInteger(Number(m0)) && m0 != null ? Number(m0) : now.getMonth());
  const [tab, setTab] = useState(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const review = useRosterReview(year, month);
  const staffStore = K.useRosterStaff();
  const scope = K.useRosterScope();
  const decider = K.useRosDecide();
  const counts = useMemo(() => {
    const c = {};
    RI_TABS.forEach(([t]) => {
      c[t] = review.rows.filter(r => riIn(t, r)).length;
    });
    return c;
  }, [review.rows]);
  const curTab = tab || (counts.awaiting ? 'awaiting' : 'all');
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return review.rows.filter(r => riIn(curTab, r)).filter(r => !needle || [r.deptName, riPerson(r.incharge), riPerson(r.manager)].join(' ').toLowerCase().indexOf(needle) >= 0);
  }, [review.rows, curTab, q]);
  const period = R.MONTHS[month] + ' ' + year;
  const onDecide = (row, action) => decider.run({
    id: row.id,
    action,
    unit: row.deptName,
    period,
    warnings: 0
  }).then(r => {
    if (r && r.ok) review.reload();
    return r;
  });
  const may = scope.can || {};
  if (!scope.loading && !may.review && !may.setup) {
    return React.createElement("div", {
      className: "card"
    }, React.createElement("div", {
      className: "card-b",
      style: {
        display: 'grid',
        placeItems: 'center',
        padding: 44,
        textAlign: 'center',
        gap: 8
      }
    }, React.createElement("div", {
      style: {
        opacity: .35
      }
    }, React.createElement(Ic, {
      d: I.lock || I.grid,
      s: 32
    })), React.createElement("div", {
      style: {
        fontWeight: 700,
        fontSize: 14.5
      }
    }, "The review inbox is for Managers and the CNS"), React.createElement("div", {
      className: "sub",
      style: {
        maxWidth: 440
      }
    }, "An administrator gives an account its roster role under ", React.createElement("b", null, "Users & Roles \u2192 Manage \u2192 Duty roster role"), ", and the units it checks under ", React.createElement("b", null, "Duty Roster \u2192 Setup"), ".")));
  }
  return React.createElement("div", {
    className: "mk-scope",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, decider.modal, open ? React.createElement(RiPreview, {
    row: open,
    year: year,
    month: month,
    staff: staffStore.staff,
    busy: decider.busy,
    setRoute: setRoute,
    onBack: () => {
      setOpen(null);
      review.reload();
    },
    onDecide: onDecide
  }) : React.createElement(React.Fragment, null, React.createElement("div", {
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
    d: I.check || I.grid,
    s: 16
  })), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 220
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 15.5,
      color: '#16202e'
    }
  }, "Roster review \u2014 ", period), React.createElement("div", {
    className: "sub"
  }, may.role === 'cns' ? 'Every unit. Approve what the Managers forwarded, or return it with a note.' : may.role === 'manager' ? 'Your units. Forward checked rosters to the CNS, or return them with a note.' : 'Every unit, where its roster is in the review chain.', review.cns && review.cns.name ? ' · CNS: ' + review.cns.name : '')), React.createElement("select", {
    value: month,
    onChange: e => {
      setMonth(Number(e.target.value));
      setOpen(null);
    }
  }, R.MONTHS.map((m, i) => React.createElement("option", {
    key: m,
    value: i
  }, m))), React.createElement("select", {
    value: year,
    onChange: e => {
      setYear(Number(e.target.value));
      setOpen(null);
    }
  }, [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => React.createElement("option", {
    key: y,
    value: y
  }, y))))), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))',
      gap: 10
    }
  }, React.createElement(RiKpi, {
    label: "Awaiting me",
    value: counts.awaiting,
    color: "#d23a52",
    on: curTab === 'awaiting',
    onClick: () => setTab('awaiting')
  }), React.createElement(RiKpi, {
    label: "In review",
    value: counts.inreview,
    color: "#0072a3",
    on: curTab === 'inreview',
    onClick: () => setTab('inreview')
  }), React.createElement(RiKpi, {
    label: "Returned",
    value: counts.returned,
    color: "#b4232f",
    on: curTab === 'returned',
    onClick: () => setTab('returned')
  }), React.createElement(RiKpi, {
    label: "Approved",
    value: counts.approved,
    color: "#157a43",
    on: curTab === 'approved',
    onClick: () => setTab('approved')
  }), React.createElement(RiKpi, {
    label: "Not submitted",
    value: counts.none,
    color: "#b5670a",
    on: curTab === 'none',
    onClick: () => setTab('none')
  }), React.createElement(RiKpi, {
    label: "Units",
    value: counts.all,
    color: "#16202e",
    on: curTab === 'all',
    onClick: () => setTab('all')
  })), React.createElement("div", {
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
    className: "seg"
  }, RI_TABS.map(([t, l]) => React.createElement("button", {
    key: t,
    type: "button",
    className: curTab === t ? 'on' : '',
    onClick: () => setTab(t)
  }, l, counts[t] ? ' · ' + counts[t] : ''))), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Find a unit or person\u2026",
    style: {
      minWidth: 200,
      padding: '7px 10px',
      borderRadius: 8,
      border: '1px solid rgba(125,145,180,.35)',
      fontFamily: 'inherit',
      fontSize: 12
    }
  })), React.createElement("div", {
    className: "card-b",
    style: {
      overflow: 'auto',
      padding: 0
    }
  }, review.loading && !review.rows.length ? React.createElement("div", {
    className: "sub",
    style: {
      padding: 22,
      textAlign: 'center'
    }
  }, "Loading\u2026") : review.error ? React.createElement("div", {
    style: {
      padding: 22,
      textAlign: 'center',
      color: '#b4232f',
      fontSize: 12.5
    }
  }, review.error) : !rows.length ? React.createElement("div", {
    style: {
      padding: 34,
      textAlign: 'center',
      color: '#6c7a8c',
      fontSize: 12.5
    }
  }, curTab === 'awaiting' ? 'Nothing is waiting for you this month.' : 'No units here.') : React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse'
    }
  }, React.createElement("thead", null, React.createElement("tr", null, ['Unit', 'In-charge', 'Manager', 'Staff', 'Status', 'Sent', 'Last saved', 'Steps'].map(h => React.createElement("th", {
    key: h,
    style: {
      ...RI_TH,
      textAlign: h === 'Steps' ? 'right' : h === 'Staff' ? 'center' : 'left'
    }
  }, h)))), React.createElement("tbody", null, rows.map(r => {
    const st = riNorm(r);
    return React.createElement("tr", {
      key: (r.dept || '') + '|' + (r.id || r.deptName),
      onClick: () => setOpen(r),
      style: {
        cursor: 'pointer',
        background: r.pendingForMe ? 'rgba(210,58,82,.04)' : st === 'returned' ? 'rgba(210,58,82,.03)' : undefined
      }
    }, React.createElement("td", {
      style: {
        ...RI_TD,
        fontWeight: 700,
        color: '#16202e'
      }
    }, r.pendingForMe && React.createElement("span", {
      title: "Waiting for you",
      style: {
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: '#d23a52',
        marginRight: 7,
        verticalAlign: 'middle'
      }
    }), r.deptName, r.dept === null && React.createElement("span", {
      className: "sub",
      style: {
        fontWeight: 500
      }
    }, " \xB7 unmapped")), React.createElement("td", {
      style: RI_TD
    }, riPerson(r.incharge) || React.createElement("span", {
      style: {
        color: '#b5670a',
        fontSize: 11
      }
    }, "not set")), React.createElement("td", {
      style: RI_TD
    }, riPerson(r.manager) || React.createElement("span", {
      style: {
        color: '#b5670a',
        fontSize: 11
      }
    }, "not set")), React.createElement("td", {
      style: {
        ...RI_TD,
        textAlign: 'center',
        fontFamily: "'IBM Plex Mono',monospace"
      }
    }, r.hasSheet ? r.staffCount || 0 : '—'), React.createElement("td", {
      style: RI_TD
    }, r.hasSheet ? React.createElement(K.RosStatusChip, {
      st: r.status
    }) : React.createElement(K.RosStatusChip, {
      st: null
    }), st === 'returned' && r.returnNote && React.createElement("div", {
      className: "sub",
      title: r.returnNote,
      style: {
        fontSize: 10.5,
        maxWidth: 220,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        marginTop: 2
      }
    }, "\u201C", r.returnNote, "\u201D")), React.createElement("td", {
      style: {
        ...RI_TD,
        whiteSpace: 'nowrap',
        fontSize: 11.5,
        color: '#6c7a8c'
      }
    }, r.sentAt && riSentShown(st) ? K.when(r.sentAt) + (r.sentByName || r.sentBy ? ' · ' + (r.sentByName || r.sentBy) : '') : '—'), React.createElement("td", {
      style: {
        ...RI_TD,
        whiteSpace: 'nowrap',
        fontSize: 11.5,
        color: '#6c7a8c'
      }
    }, r.updatedAt ? K.when(r.updatedAt) + (r.updatedBy ? ' · ' + r.updatedBy : '') : '—'), React.createElement("td", {
      style: {
        ...RI_TD,
        textAlign: 'right'
      },
      onClick: e => e.stopPropagation()
    }, React.createElement("div", {
      style: {
        display: 'inline-flex',
        gap: 6,
        alignItems: 'center',
        justifyContent: 'flex-end',
        flexWrap: 'wrap'
      }
    }, r.hasSheet && r.can && (r.can.forward || r.can.approve || r.can.return) ? React.createElement(K.RosDecisionButtons, {
      status: r.status,
      can: {
        forward: r.can.forward,
        approve: r.can.approve,
        return: r.can.return
      },
      onAction: a => onDecide(r, a),
      busy: decider.busy,
      compact: true
    }) : null, React.createElement("button", {
      className: "btn sm",
      type: "button",
      onClick: () => r.hasSheet ? setOpen(r) : setRoute({
        view: 'rosterGrid',
        dept: r.sheetDept || r.deptName,
        year,
        month
      })
    }, r.hasSheet ? 'Open' : 'Open sheet'))));
  })))))));
}
window.RosterReviewFull = RosterReviewFull;
window.RosterInbox = RosterReviewFull;
})();
;
/* ===== roster-staff.jsx ===== */
(function(){
const {
  useState,
  useEffect,
  useMemo
} = React;
const Ic = window.Ic,
  I = window.I;
const R = window.UNICO_ROSTER;
const MK = window.MK;
const rsMonthKey = (y, m) => y + '-' + String(m + 1).padStart(2, '0');
const rsMonthsBack = n => {
  const d = new Date();
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push([x.getFullYear(), x.getMonth()]);
  }
  return out;
};
const rsEsc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[c]);
function rsTotals(cells, y, m) {
  const days = R.daysIn(y, m);
  const t = R.totalsFor(cells || {}, days);
  let off = 0;
  for (let d = 1; d <= days; d++) {
    const c = cells && cells[d];
    if (c && R.isOff(c)) off++;
  }
  return {
    ...t,
    off,
    duty: t.G + t.M + t.E + t.N
  };
}
function RosterStaffView({
  staffId: sid0,
  setRoute
}) {
  const K = window.UNICO_ROSTER_KIT;
  const store = K.useRosterStaff();
  const staff = useMemo(() => (store.staff || []).filter(e => e && e.id != null && !e.former), [store.staff]);
  const [sel, setSel] = useState(sid0 ? String(sid0) : '');
  const [q, setQ] = useState('');
  const [pickOpen, setPickOpen] = useState(false);
  const range = rsMonthsBack(24);
  const [from, setFrom] = useState(rsMonthKey(...range[5]));
  const [to, setTo] = useState(rsMonthKey(...range[0]));
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const person = staff.find(e => String(e.id) === sel) || null;
  const matches = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return staff.slice(0, 12);
    return staff.filter(e => [e.name, e.emp_id, e.current_department, e.designation].join(' ').toLowerCase().indexOf(n) >= 0).slice(0, 12);
  }, [staff, q]);
  useEffect(() => {
    if (!sel) {
      setData(null);
      return;
    }
    setData(null);
    setErr('');
    const [a, b] = from <= to ? [from, to] : [to, from];
    K.api.get('/api/rosters/staff/' + encodeURIComponent(sel) + '?from=' + a + '&to=' + b).then(r => {
      if (r && r.ok) setData(r.months || r.rosters || r.rows || []);else {
        setErr(r && r.error || 'Could not load this person’s roster.');
        setData([]);
      }
    }).catch(() => {
      setErr('Could not reach the server.');
      setData([]);
    });
  }, [sel, from, to]);
  const months = useMemo(() => {
    const [a, b] = from <= to ? [from, to] : [to, from];
    const out = [];
    const [ay, am] = a.split('-').map(Number),
      [by, bm] = b.split('-').map(Number);
    for (let y = by, m = bm - 1; y > ay || y === ay && m >= am - 1; m--) {
      if (m < 0) {
        m = 11;
        y--;
        if (y < ay) break;
      }
      const sheets = (data || []).filter(x => x.year === y && x.month === m);
      out.push({
        y,
        m,
        sheets
      });
    }
    return out;
  }, [data, from, to]);
  const sum = useMemo(() => {
    const s = {
      duty: 0,
      N: 0,
      leave: 0,
      off: 0,
      hours: 0,
      months: 0
    };
    months.forEach(mo => mo.sheets.forEach(x => {
      const t = rsTotals(x.cells, mo.y, mo.m);
      s.duty += t.duty;
      s.N += t.N;
      s.leave += t.leave;
      s.off += t.off;
      s.hours += t.hours;
      s.months++;
    }));
    return s;
  }, [months]);
  const print = async () => {
    if (!person) return;
    const w = window.open('', '_blank');
    try {
      await K.api.post('/api/rosters/print', {
        kind: 'staff',
        target: person.name,
        detail: from + ' – ' + to
      });
      if (!w) {
        K.toast('Allow pop-ups for this site to print.', 'error');
        return;
      }
      const css = '@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}' + 'body{font:9pt/1.35 "Segoe UI",Arial,sans-serif;color:#16202e;margin:0;padding:16px}@media print{body{padding:0}}' + '.lh{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;padding-bottom:8px;border-bottom:1px solid #d9e2ec}.lh img{height:40px}.lh .tt{text-align:right}' + '.lh .kind{font-size:7.5pt;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#0072a3}.lh h1{margin:3px 0 0;font-size:15pt;color:#0d1b2e}.bar{height:3px;background:linear-gradient(90deg,#0072a3,#27a8db 55%,#3ab5a7)}' + '.hd{display:flex;gap:26px;margin:10px 0 8px;font-size:10pt}.hd b{font-weight:700}' + 'table{border-collapse:collapse;width:100%;font-size:7.4pt}th{background:#0d3a5c;color:#fff;font-weight:700;padding:4px 2px;border:1px solid #0d3a5c}' + 'td{padding:3px 2px;border:1px solid #c9d3de;text-align:center}td.l{text-align:left;white-space:nowrap}tfoot td{font-weight:700;background:#e6f1f8}' + '.end{margin-top:14px;padding-top:6px;border-top:1px solid #e3e9f0;display:flex;justify-content:space-between;font-size:7.5pt;color:#7b8796}.cr{margin-top:5px;text-align:center;font-size:6.5px;color:#a3adba}';
      const dayHead = Array.from({
        length: 31
      }, (_, i) => '<th>' + (i + 1) + '</th>').join('');
      const body = months.map(mo => {
        if (!mo.sheets.length) return '<tr><td class="l">' + rsEsc(R.MONTHS[mo.m].slice(0, 3) + ' ' + mo.y) + '</td><td class="l">—</td>' + '<td colspan="31" style="color:#9aa6b4">no sheet</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>';
        return mo.sheets.map(x => {
          const t = rsTotals(x.cells, mo.y, mo.m);
          const days = R.daysIn(mo.y, mo.m);
          const cells = Array.from({
            length: 31
          }, (_, i) => '<td' + (i >= days ? ' style="background:#f1f4f8"' : '') + '>' + rsEsc((x.cells || {})[i + 1] || '') + '</td>').join('');
          return '<tr><td class="l">' + rsEsc(R.MONTHS[mo.m].slice(0, 3) + ' ' + mo.y) + '</td><td class="l">' + rsEsc(x.deptName || x.dept) + '</td>' + cells + '<td>' + t.duty + '</td><td>' + t.N + '</td><td>' + t.off + '</td><td>' + t.leave + '</td><td>' + t.hours + '</td><td>' + rsEsc(K.ROS_STATUS[K.statusNorm(x.status)].label) + '</td></tr>';
        }).join('');
      }).join('');
      const at = new Date().toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
      const me = window.__UNICO_USER__ && (window.__UNICO_USER__.name || window.__UNICO_USER__.username) || '—';
      const html = '<header class="lh"><img src="' + rsEsc(location.origin + '/unico/logo.svg') + '" alt="UNICO Hospitals"><div class="tt"><div class="kind">Nursing Services · Duty Roster</div><h1>Individual Duty Record</h1></div></header><div class="bar"></div>' + '<div class="hd"><span>Name: <b>' + rsEsc(person.name) + '</b></span><span>Emp no: <b>' + rsEsc(person.emp_id || '—') + '</b></span><span>Designation: <b>' + rsEsc(person.designation || '—') + '</b></span><span>Period: <b>' + rsEsc(from + ' to ' + to) + '</b></span></div>' + '<table><thead><tr><th>Month</th><th>Unit</th>' + dayHead + '<th>Duty</th><th>Nights</th><th>Off</th><th>Leave</th><th>Hours</th><th>Status</th></tr></thead><tbody>' + body + '</tbody>' + '<tfoot><tr><td class="l" colspan="33">Total · ' + sum.months + ' rostered month' + (sum.months === 1 ? '' : 's') + '</td><td>' + sum.duty + '</td><td>' + sum.N + '</td><td>' + sum.off + '</td><td>' + sum.leave + '</td><td>' + sum.hours + '</td><td></td></tr></tfoot></table>' + '<div class="end"><span>Printed by ' + rsEsc(me) + ' on ' + rsEsc(at) + ' from UNICO.</span><span>Approved sheets are final; others may still change.</span></div>' + '<div class="cr">Automatically generated by the system · Developed by Nasif Ahammed Niloy</div>';
      w.document.open();
      w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + rsEsc(person.name + ' — duty record') + '</title><style>' + css + '</style></head><body>' + html + '<script>window.onload=function(){setTimeout(function(){window.print();},150);};<\/script></body></html>');
      w.document.close();
    } catch (e) {
      if (w) w.close();
      K.toast('Could not print.', 'error');
    }
  };
  const cell = {
    fontFamily: K.MONO,
    fontSize: 8.8,
    fontWeight: 700,
    textAlign: 'center',
    padding: '4px 0',
    borderBottom: '1px solid rgba(125,145,180,.12)',
    minWidth: 21
  };
  const th = {
    position: 'sticky',
    top: 0,
    background: '#f2f6fb',
    fontSize: 9,
    fontWeight: 700,
    color: '#6c7a8c',
    padding: '6px 1px',
    borderBottom: '1px solid rgba(125,145,180,.3)',
    textAlign: 'center',
    zIndex: 1
  };
  return React.createElement("div", {
    className: "mk-scope",
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
    d: I.user || I.users || I.grid,
    s: 16
  })), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 200
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 15.5,
      color: '#16202e'
    }
  }, "Staff roster"), React.createElement("div", {
    className: "sub"
  }, "One person's shifts across months and units")), React.createElement("div", {
    style: {
      position: 'relative',
      minWidth: 260
    }
  }, React.createElement("input", {
    value: pickOpen ? q : person ? person.name + (person.emp_id ? ' · ' + person.emp_id : '') : q,
    onFocus: () => {
      setPickOpen(true);
      setQ('');
    },
    onBlur: () => setTimeout(() => setPickOpen(false), 150),
    onChange: e => setQ(e.target.value),
    placeholder: "Find a nurse or PCA \u2014 name, emp no, unit\u2026",
    style: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '8px 11px',
      borderRadius: 9,
      border: '1px solid rgba(125,145,180,.4)',
      fontFamily: 'inherit',
      fontSize: 12.5
    }
  }), pickOpen && React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: '100%',
      marginTop: 4,
      background: '#fff',
      border: '1px solid rgba(125,145,180,.3)',
      borderRadius: 10,
      boxShadow: '0 16px 40px rgba(16,32,46,.18)',
      zIndex: 50,
      maxHeight: 320,
      overflow: 'auto'
    }
  }, !matches.length && React.createElement("div", {
    className: "sub",
    style: {
      padding: 12
    }
  }, "No one matches."), matches.map(e => React.createElement("div", {
    key: e.id,
    onMouseDown: () => {
      setSel(String(e.id));
      setPickOpen(false);
      setQ('');
    },
    style: {
      padding: '8px 12px',
      cursor: 'pointer',
      borderBottom: '1px solid rgba(125,145,180,.1)'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 600,
      color: '#16202e'
    }
  }, e.name), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: '#8a97a8'
    }
  }, [e.emp_id, e.designation, e.current_department].filter(Boolean).join(' · ')))))), React.createElement("span", {
    className: "sub"
  }, "From"), React.createElement("select", {
    value: from,
    onChange: e => setFrom(e.target.value)
  }, range.map(([y, m]) => React.createElement("option", {
    key: 'f' + y + m,
    value: rsMonthKey(y, m)
  }, R.MONTHS[m].slice(0, 3), " ", y))), React.createElement("span", {
    className: "sub"
  }, "to"), React.createElement("select", {
    value: to,
    onChange: e => setTo(e.target.value)
  }, range.map(([y, m]) => React.createElement("option", {
    key: 't' + y + m,
    value: rsMonthKey(y, m)
  }, R.MONTHS[m].slice(0, 3), " ", y))), person && K.can('print') && React.createElement("button", {
    className: "btn sm",
    type: "button",
    onClick: print
  }, "Print"))), !person ? React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-b",
    style: {
      display: 'grid',
      placeItems: 'center',
      padding: 40,
      textAlign: 'center',
      gap: 6
    }
  }, React.createElement("div", {
    style: {
      opacity: .35
    }
  }, React.createElement(Ic, {
    d: I.user || I.users || I.grid,
    s: 30
  })), React.createElement("div", {
    style: {
      fontWeight: 600
    }
  }, "Pick a person to see their roster"), React.createElement("div", {
    className: "sub",
    style: {
      maxWidth: 420
    }
  }, "Every month they were on a unit's sheet, with their shift on each day and the month's totals."))) : React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))',
      gap: 10
    }
  }, [['Rostered months', sum.months, '#0072a3'], ['Duty shifts', sum.duty, '#2b9488'], ['Night shifts', sum.N, '#5b45c4'], ['Rest days', sum.off, '#7d8ea8'], ['Leave days', sum.leave, '#b5670a'], ['Hours', sum.hours, '#16202e']].map(([l, v, c]) => React.createElement("div", {
    key: l,
    className: "card",
    style: {
      padding: '11px 14px'
    }
  }, React.createElement("div", {
    style: {
      fontFamily: K.MONO,
      fontSize: 19,
      fontWeight: 700,
      color: c
    }
  }, v), React.createElement("div", {
    style: {
      fontSize: 11,
      color: '#6c7a8c'
    }
  }, l)))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", {
    style: {
      margin: 0
    }
  }, person.name), React.createElement("div", {
    className: "sub"
  }, [person.emp_id, person.designation, person.current_department].filter(Boolean).join(' · '))), React.createElement("div", {
    className: "card-b",
    style: {
      padding: 0,
      overflow: 'auto'
    }
  }, err && React.createElement("div", {
    style: {
      padding: 14,
      color: '#b4232f',
      fontSize: 12.5
    }
  }, err), data === null ? React.createElement("div", {
    className: "sub",
    style: {
      padding: 22,
      textAlign: 'center'
    }
  }, "Loading\u2026") : React.createElement("table", {
    style: {
      borderCollapse: 'separate',
      borderSpacing: 0,
      width: '100%'
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: {
      ...th,
      textAlign: 'left',
      paddingLeft: 12,
      minWidth: 82
    }
  }, "Month"), React.createElement("th", {
    style: {
      ...th,
      textAlign: 'left',
      minWidth: 120
    }
  }, "Unit"), Array.from({
    length: 31
  }, (_, i) => React.createElement("th", {
    key: i,
    style: th
  }, i + 1)), [['Duty', '#16202e'], ['M', K.bColor('M')], ['E', K.bColor('E')], ['N', K.bColor('N')], ['Off', '#7d8ea8'], ['Lv', '#b5670a'], ['Hrs', '#16202e']].map(([l, c]) => React.createElement("th", {
    key: l,
    style: {
      ...th,
      color: c,
      minWidth: 26
    }
  }, l)), React.createElement("th", {
    style: {
      ...th,
      minWidth: 96
    }
  }, "Status"))), React.createElement("tbody", null, months.map(mo => {
    const label = R.MONTHS[mo.m].slice(0, 3) + ' ' + mo.y;
    const days = R.daysIn(mo.y, mo.m);
    if (!mo.sheets.length) return React.createElement("tr", {
      key: label
    }, React.createElement("td", {
      style: {
        ...cell,
        fontFamily: 'inherit',
        textAlign: 'left',
        paddingLeft: 12,
        fontWeight: 600,
        color: '#3c4858'
      }
    }, label), React.createElement("td", {
      colSpan: 40,
      style: {
        ...cell,
        fontFamily: 'inherit',
        fontWeight: 500,
        color: '#9aa6b4',
        textAlign: 'left'
      }
    }, "Not on any roster this month"));
    return mo.sheets.map(x => {
      const t = rsTotals(x.cells, mo.y, mo.m);
      return React.createElement("tr", {
        key: label + x.id
      }, React.createElement("td", {
        style: {
          ...cell,
          fontFamily: 'inherit',
          textAlign: 'left',
          paddingLeft: 12,
          fontWeight: 600,
          color: '#16202e'
        }
      }, label), React.createElement("td", {
        style: {
          ...cell,
          fontFamily: 'inherit',
          textAlign: 'left',
          fontWeight: 600,
          color: '#0072a3',
          cursor: 'pointer',
          whiteSpace: 'nowrap'
        },
        title: "Open this unit's sheet",
        onClick: () => setRoute({
          view: 'rosterGrid',
          dept: x.dept,
          year: mo.y,
          month: mo.m
        })
      }, x.deptName || x.dept), Array.from({
        length: 31
      }, (_, i) => {
        const d = i + 1;
        const c = (x.cells || {})[d] || '';
        if (d > days) return React.createElement("td", {
          key: d,
          style: {
            ...cell,
            background: 'rgba(125,145,180,.08)'
          }
        });
        const col = c ? K.bColor(R.bucketOf(c)) : null;
        return React.createElement("td", {
          key: d,
          title: c ? c + ((R.BY_CODE[c] || {}).label ? ' — ' + R.BY_CODE[c].label : '') : '',
          style: {
            ...cell,
            color: col || '#ccd3dc',
            background: c ? col + '14' : 'transparent'
          }
        }, c || '·');
      }), [t.duty, t.M, t.E, t.N, t.off, t.leave, t.hours].map((v, i) => React.createElement("td", {
        key: i,
        style: {
          ...cell,
          color: '#3c4858'
        }
      }, v || '')), React.createElement("td", {
        style: {
          ...cell,
          fontFamily: 'inherit'
        }
      }, React.createElement(K.RosStatusChip, {
        st: x.status
      })));
    });
  })))))));
}
window.RosterStaffView = RosterStaffView;
})();
;
/* ===== roster-setup.jsx ===== */
(function(){
const {
  useState,
  useEffect,
  useMemo
} = React;
const Ic = window.Ic,
  I = window.I;
const MK = window.MK;
const RS_ROLE_LABEL = {
  incharge: 'In-charge',
  manager: 'Manager',
  cns: 'CNS'
};
function RosterSetup() {
  const K = window.UNICO_ROSTER_KIT;
  const scope = K.useRosterScope();
  const [cfg, setCfg] = useState(null);
  const [people, setPeople] = useState([]);
  const [draft, setDraft] = useState(null);
  const [q, setQ] = useState('');
  const [onlyUnset, setOnlyUnset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fromCfg = c => {
    const d = {};
    (c.depts || []).forEach(x => {
      d[x.id] = {
        incharge: x.incharge && x.incharge.username || '',
        manager: x.manager && x.manager.username || ''
      };
    });
    return {
      cns: c.cns && c.cns.username || '',
      depts: d
    };
  };
  const load = () => Promise.all([K.api.get('/api/rosters/config'), K.api.get('/api/rosters/reviewers')]).then(([c, p]) => {
    if (!c || !c.ok) {
      setErr(c && c.error || 'Could not load the setup.');
      return;
    }
    setCfg(c);
    setDraft(fromCfg(c));
    setErr('');
    setPeople(p && p.ok && (p.reviewers || p.users || p.people) || []);
  }).catch(() => setErr('Could not reach the server.'));
  useEffect(() => {
    load();
  }, []);
  const may = scope.can || {};
  const dirty = useMemo(() => !!(cfg && draft && JSON.stringify(fromCfg(cfg)) !== JSON.stringify(draft)), [cfg, draft]);
  const depts = cfg && cfg.depts || [];
  const unsetN = depts.filter(x => draft && (!draft.depts[x.id] || !draft.depts[x.id].incharge || !draft.depts[x.id].manager)).length + (draft && !draft.cns ? 1 : 0);
  useEffect(() => {
    const warn = e => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  if (!scope.loading && !may.setup) {
    return React.createElement("div", {
      className: "card"
    }, React.createElement("div", {
      className: "card-b",
      style: {
        display: 'grid',
        placeItems: 'center',
        padding: 44,
        textAlign: 'center',
        gap: 8
      }
    }, React.createElement("div", {
      style: {
        opacity: .35
      }
    }, React.createElement(Ic, {
      d: I.lock || I.grid,
      s: 32
    })), React.createElement("div", {
      style: {
        fontWeight: 700,
        fontSize: 14.5
      }
    }, "Administrators only"), React.createElement("div", {
      className: "sub",
      style: {
        maxWidth: 420
      }
    }, "Roster setup decides who prepares, checks and approves every unit's roster.")));
  }
  if (err) return React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-b",
    style: {
      color: '#b4232f',
      padding: 24
    }
  }, err, " ", React.createElement("button", {
    className: "btn sm",
    onClick: load
  }, "Try again")));
  if (!cfg || !draft) return React.createElement("div", {
    className: "sub",
    style: {
      padding: 30,
      textAlign: 'center'
    }
  }, "Loading\u2026");
  const byUser = {};
  people.forEach(u => {
    byUser[u.username] = u;
  });
  const optionsFor = (role, deptId, current) => {
    const list = people.filter(u => u.rosterRole === role || u.rosterRole === 'admin');
    const covers = u => (u.rosterDepartments || []).indexOf(deptId) >= 0;
    const sorted = list.slice().sort((a, b) => (a.rosterRole === 'admin') - (b.rosterRole === 'admin') || covers(b) - covers(a) || String(a.name).localeCompare(String(b.name)));
    if (current && !sorted.some(u => u.username === current)) sorted.unshift(byUser[current] || {
      username: current,
      name: current + ' (no roster role)'
    });
    return sorted;
  };
  const setSlot = (id, slot, v) => setDraft(d => ({
    ...d,
    depts: {
      ...d.depts,
      [id]: {
        ...(d.depts[id] || {}),
        [slot]: v
      }
    }
  }));
  const save = () => {
    setBusy(true);
    const body = {
      cns: draft.cns ? {
        username: draft.cns
      } : null,
      depts: {}
    };
    Object.keys(draft.depts).forEach(id => {
      const x = draft.depts[id];
      body.depts[id] = {
        incharge: x.incharge ? {
          username: x.incharge
        } : null,
        manager: x.manager ? {
          username: x.manager
        } : null
      };
    });
    K.api.put('/api/rosters/config', body).then(r => {
      setBusy(false);
      if (r && r.ok) {
        K.toast('Roster setup saved.');
        if (r.depts) {
          setCfg(r);
          setDraft(fromCfg(r));
        } else load();
        K.loadConfig(true);
        try {
          window.dispatchEvent(new Event('unico:ros-refresh'));
        } catch (e) {}
      } else K.toast(r && r.error || 'Could not save the setup.', 'error');
    }).catch(() => {
      setBusy(false);
      K.toast('Could not reach the server.', 'error');
    });
  };
  const needle = q.trim().toLowerCase();
  const shown = depts.filter(x => {
    const s = draft.depts[x.id] || {};
    if (onlyUnset && s.incharge && s.manager) return false;
    return !needle || String(x.name).toLowerCase().indexOf(needle) >= 0;
  });
  const sel = (value, onChange, opts, missing) => React.createElement("select", {
    value: value,
    onChange: e => onChange(e.target.value),
    style: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '7px 9px',
      borderRadius: 8,
      border: '1px solid ' + (missing ? 'rgba(224,138,30,.55)' : 'rgba(125,145,180,.35)'),
      background: missing ? 'rgba(224,138,30,.06)' : '#fff',
      fontFamily: 'inherit',
      fontSize: 12,
      color: value ? '#16202e' : '#9aa6b4'
    }
  }, React.createElement("option", {
    value: ""
  }, "\u2014 not set \u2014"), opts.map(u => React.createElement("option", {
    key: u.username,
    value: u.username
  }, u.name, u.rosterRole === 'admin' ? ' · Administrator' : u.title ? ' · ' + u.title : '')));
  const nRole = r => people.filter(u => u.rosterRole === r).length;
  return React.createElement("div", {
    className: "mk-scope",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      paddingBottom: dirty ? 70 : 0
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
    d: I.users || I.grid,
    s: 16
  })), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 240
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 15.5,
      color: '#16202e'
    }
  }, "Roster setup \u2014 who prepares, checks and approves"), React.createElement("div", {
    className: "sub"
  }, "Set once. The names fill every roster's sign-off and decide whose inbox a sent roster lands in.")), unsetN > 0 && React.createElement("span", {
    style: {
      fontSize: 11.5,
      fontWeight: 700,
      color: '#b5670a',
      background: 'rgba(224,138,30,.13)',
      padding: '5px 11px',
      borderRadius: 14
    }
  }, unsetN, " slot", unsetN === 1 ? '' : 's', " not set")), React.createElement("div", {
    className: "card-b",
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(220px,360px) 1fr',
      gap: 16,
      alignItems: 'center'
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: .6,
      textTransform: 'uppercase',
      color: '#7d8ea8',
      marginBottom: 4
    }
  }, "Chief of Nursing Services \xB7 approves every unit"), sel(draft.cns, v => setDraft(d => ({
    ...d,
    cns: v
  })), optionsFor('cns', null, draft.cns), !draft.cns)), React.createElement("div", {
    className: "sub",
    style: {
      fontSize: 11.5,
      lineHeight: 1.6
    }
  }, "Accounts with a roster role: ", React.createElement("b", null, nRole('cns')), " CNS \xB7 ", React.createElement("b", null, nRole('manager')), " Manager \xB7 ", React.createElement("b", null, nRole('incharge')), " In-charge. Someone missing from a list? Give their account a ", React.createElement("b", null, "Duty roster role"), " under Users & Roles \u2192 Manage. People whose roster units include a department are listed first for it."))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h",
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, React.createElement("h3", {
    style: {
      margin: 0
    }
  }, "Departments"), React.createElement("span", {
    className: "sub"
  }, depts.length, " departments"), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("label", {
    className: "sub",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      cursor: 'pointer'
    }
  }, React.createElement("input", {
    type: "checkbox",
    checked: onlyUnset,
    onChange: e => setOnlyUnset(e.target.checked)
  }), "Only incomplete"), React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Find a department\u2026",
    style: {
      minWidth: 190,
      padding: '7px 10px',
      borderRadius: 8,
      border: '1px solid rgba(125,145,180,.35)',
      fontFamily: 'inherit',
      fontSize: 12
    }
  })), React.createElement("div", {
    className: "card-b",
    style: {
      overflow: 'auto',
      padding: 0
    }
  }, React.createElement("table", {
    className: "tbl",
    style: {
      width: '100%'
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: {
      width: '30%'
    }
  }, "Department"), React.createElement("th", null, "In-charge ", React.createElement("span", {
    className: "sub",
    style: {
      fontWeight: 500
    }
  }, "\xB7 prepares")), React.createElement("th", null, "Manager ", React.createElement("span", {
    className: "sub",
    style: {
      fontWeight: 500
    }
  }, "\xB7 checks")))), React.createElement("tbody", null, shown.map(x => {
    const s = draft.depts[x.id] || {
      incharge: '',
      manager: ''
    };
    return React.createElement("tr", {
      key: x.id
    }, React.createElement("td", {
      style: {
        fontWeight: 600
      }
    }, x.name), React.createElement("td", {
      style: {
        minWidth: 200
      }
    }, sel(s.incharge, v => setSlot(x.id, 'incharge', v), optionsFor('incharge', x.id, s.incharge), !s.incharge)), React.createElement("td", {
      style: {
        minWidth: 200
      }
    }, sel(s.manager, v => setSlot(x.id, 'manager', v), optionsFor('manager', x.id, s.manager), !s.manager)));
  }), !shown.length && React.createElement("tr", null, React.createElement("td", {
    colSpan: 3,
    className: "sub",
    style: {
      textAlign: 'center',
      padding: 22
    }
  }, depts.length ? 'No departments match.' : 'No departments found — departments come from Department Setup.')))))), dirty && React.createElement("div", {
    style: {
      position: 'sticky',
      bottom: 10,
      zIndex: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: '#16202e',
      color: '#fff',
      borderRadius: 12,
      padding: '10px 16px',
      boxShadow: '0 14px 36px rgba(16,32,46,.35)'
    }
  }, React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 12.5,
      fontWeight: 600
    }
  }, "Unsaved changes to the roster setup"), React.createElement("button", {
    className: "btn sm",
    type: "button",
    disabled: busy,
    onClick: () => setDraft(fromCfg(cfg))
  }, "Discard"), React.createElement("button", {
    className: "btn pri sm",
    type: "button",
    disabled: busy,
    onClick: save
  }, busy ? 'Saving…' : 'Save setup')));
}
window.RosterSetup = RosterSetup;
})();
