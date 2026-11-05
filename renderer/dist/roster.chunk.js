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
const ROS_RANK = [[/chief|\bcns\b|nursing services/i, 0], [/assistant\s*nurse\s*manager|asst\.?\s*nurse\s*manager/i, 2], [/manager/i, 1], [/in\s*-?\s*charge|charge\s*nurse/i, 3], [/team\s*leader/i, 4], [/supervisor|instructor|infection/i, 5], [/senior\s*staff\s*nurse/i, 6], [/trainee|intern/i, 8], [/patient\s*care|\bpca\b|assistant/i, 9], [/nurse/i, 7]];
const rosRankOf = desig => {
  const s = String(desig || '');
  for (let i = 0; i < ROS_RANK.length; i++) if (ROS_RANK[i][0].test(s)) return ROS_RANK[i][1];
  return 10;
};
const rosIsPca = e => !!e && (String(e.role || '').toUpperCase() === 'PCA' || /patient\s*care|\bpca\b/i.test(String(e.designation || e.desig || '')));
const rosByGroup = list => list.filter(r => !r.pca).concat(list.filter(r => r.pca));
const rosNameKey = n => String(n || '').toLowerCase().replace(/^(md\.?|mst\.?|mrs\.?|mr\.?)\s+/, '').replace(/[^a-z]/g, '');
const rosSeniorSort = (list, inchargeName) => {
  const ic = rosNameKey(inchargeName);
  const key = r => ic && rosNameKey(r.name) === ic ? -1 : r.offRegister ? 99 : rosRankOf(r.desig);
  return list.slice().sort((a, b) => key(a) - key(b) || String(a.name).localeCompare(String(b.name)));
};
const rosRowOf = e => ({
  empId: rosKey(e),
  empIdShown: e.emp_id || '',
  name: e.name,
  desig: e.designation,
  pca: rosIsPca(e),
  photo: MK && MK.photoUrlOf && MK.photoUrlOf(e) || ''
});
const rosGuestRow = (id, g) => ({
  empId: id,
  empIdShown: g.emp || '',
  name: g.name || id,
  desig: g.desig || '',
  pca: rosIsPca({
    designation: g.desig
  }),
  photo: ''
});
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
  const CI = (() => {
    const a = [];
    for (let i = 0; i < N; i++) if (!rows[i].pca) a.push(i);
    return a.length ? a : rows.map((_, i) => i);
  })();
  const code = (i, d) => (grid[rows[i].empId] || {})[d] || '';
  const bOf = c => R.bucketOf(c) || '';
  const dayBucketCount = (d, b) => {
    let n = 0;
    for (const i of CI) if (bOf(code(i, d)) === b) n++;
    return n;
  };
  const dayMetric = (d, m) => {
    if (m === 'onDuty') {
      let n = 0;
      for (const i of CI) {
        const b = bOf(code(i, d));
        if (b && b !== 'O') n++;
      }
      return n;
    }
    if (m === 'onLeave') {
      let n = 0;
      for (const i of CI) if (ROS_LEAVE_CODES.indexOf(code(i, d)) >= 0) n++;
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
    for (const i of CI) {
      const b = bOf(code(i, d));
      if (b) {
        written++;
        if (b !== 'O') on++;
      }
    }
    if (CI.length > 0 && written === CI.length && on === 0) closedDays[d] = true;
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
        for (const i of CI) {
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
const rosIsAdmin = () => {
  try {
    const u = window.__UNICO_USER__;
    return !u || u.role === 'Administrator';
  } catch (e) {
    return false;
  }
};
const ROS_OC_BADGE = {
  position: 'absolute',
  top: -5,
  right: -6,
  fontStyle: 'normal',
  fontSize: 7,
  fontWeight: 800,
  lineHeight: '11px',
  padding: '0 3px',
  borderRadius: 5,
  background: '#0d3a5c',
  color: '#fff',
  letterSpacing: .3,
  boxShadow: '0 1px 3px rgba(0,0,0,.25)',
  pointerEvents: 'none'
};
const ROS_MARK_CORNER = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: 0,
  height: 0,
  borderTop: '9px solid #d23a52',
  borderRight: '9px solid transparent',
  borderTopLeftRadius: 5,
  pointerEvents: 'none'
};
const ROS_AL_DOT = {
  position: 'absolute',
  top: 2,
  right: 2,
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: '#e08a1e',
  boxShadow: '0 0 0 1.5px #fff',
  pointerEvents: 'none'
};
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
    supervisors: v && v.supervisors || [],
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
const rosRowsFrom = (doc, staff, dept, withRegister, inchargeName) => {
  const all = {};
  (staff || []).forEach(e => {
    all[rosKey(e)] = e;
  });
  const supIds = R.SUPERVISOR_UNIT === dept ? new Set((ROS_CFG && ROS_CFG.supervisors || []).map(x => String(x.id))) : null;
  const guests = doc && doc.guests || {};
  const moved = new Set(doc && doc.movedOut || []);
  const reg = withRegister === false ? [] : (staff || []).filter(e => e.is_active !== false && !e.former && (supIds ? supIds.has(String(e.id)) : R.unitOf(e) === dept)).map(e => rosRowOf(e)).filter(r => !moved.has(r.empId) || Object.keys(doc && doc.grid && doc.grid[r.empId] || {}).length);
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
    const g = guests[id];
    out.push(e ? rosRowOf(e) : g ? rosGuestRow(id, g) : {
      empId: id,
      empIdShown: '',
      name: names[id] || id,
      desig: ''
    });
  };
  (doc && doc.order || []).forEach(id => {
    if (grid[id] || guests[id] || reg.some(r => r.empId === id)) add(id);
  });
  Object.keys(grid).forEach(add);
  reg.forEach(r => add(r.empId));
  Object.keys(guests).forEach(add);
  const manual = !!(doc && doc.rules && doc.rules.orderManual);
  return {
    rows: rosByGroup(manual ? out : rosSeniorSort(out, inchargeName)),
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
  hasManager,
  selfManager
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
  if (c.send && selfManager) out.push(btn('send_manager', 'Check & send to CNS'));else if (c.send) {
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
  onConfirm,
  initial
}) {
  const [note, setNote] = useState(initial || '');
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
    warnings,
    selfManager,
    note: initialNote
  }) => {
    const what = unit + ' · ' + period;
    if (action === 'return') {
      const note = await new Promise(resolve => setAsk({
        what,
        resolve,
        initial: initialNote || ''
      }));
      if (note === null) return {
        ok: false,
        cancelled: true
      };
      return post(id, action, note);
    }
    const warn = warnings ? ' It still has ' + warnings + ' rule warning' + (warnings === 1 ? '' : 's') + '.' : '';
    const msgs = {
      send_manager: selfManager ? ['Check and send to the CNS?', 'You are also this unit’s Manager, so your check is part of sending: ' + what + ' goes straight to the CNS for approval.' + warn] : ['Send to the Manager?', what + ' goes to the unit Manager for checking. It is locked while it is with them.' + warn],
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
    initial: ask.initial,
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
function RosMarkList({
  marks,
  rows,
  year,
  month,
  canDone,
  onDone,
  onOpen
}) {
  const nameOf = {};
  (rows || []).forEach(r => {
    nameOf[r.empId] = r.name;
  });
  const list = [];
  Object.keys(marks || {}).forEach(emp => Object.keys(marks[emp] || {}).forEach(d => list.push({
    emp,
    d: Number(d),
    ...marks[emp][d]
  })));
  if (!list.length) return null;
  list.sort((a, b) => a.d - b.d || String(nameOf[a.emp] || '').localeCompare(String(nameOf[b.emp] || '')));
  const day = d => new Date(year, month, d).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
  return React.createElement("div", {
    style: {
      background: '#fff',
      border: '1px solid rgba(210,58,82,.28)',
      borderRadius: 12,
      padding: '10px 14px',
      marginBottom: 14
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 800,
      color: '#8c1d2a',
      marginBottom: 6
    }
  }, "Review notes \xB7 ", list.length, " cell", list.length === 1 ? '' : 's', " to fix"), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, list.map(m => React.createElement("div", {
    key: m.emp + '|' + m.d,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '5px 8px',
      borderRadius: 8,
      background: 'rgba(210,58,82,.05)'
    }
  }, React.createElement("span", {
    onClick: () => onOpen && onOpen(m.emp, m.d),
    style: {
      cursor: onOpen ? 'pointer' : 'default',
      flex: 1,
      minWidth: 0,
      fontSize: 12,
      color: '#16202e'
    }
  }, React.createElement("b", null, nameOf[m.emp] || m.emp), " \xB7 ", day(m.d), m.code ? React.createElement("span", {
    style: {
      fontFamily: ROS_MONO,
      fontWeight: 700,
      color: '#6c7a8c'
    }
  }, " (", m.code, ")") : null, " \u2014 ", m.note, React.createElement("span", {
    style: {
      color: '#8a97a8',
      fontSize: 10.5
    }
  }, " \xB7 ", m.byName || m.by || 'reviewer')), canDone && React.createElement("button", {
    type: "button",
    className: "btn sm",
    onClick: () => onDone(m.emp, m.d)
  }, "Done")))));
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
  }, "Hrs"))), React.createElement("tbody", null, rows.map((r, ri) => {
    const row = g[r.empId] || {};
    const t = R.totalsFor(row, days);
    const hasPca = rows.some(x => x.pca);
    const head = hasPca && (ri === 0 || !!rows[ri - 1].pca !== !!r.pca);
    return React.createElement(React.Fragment, {
      key: r.empId
    }, head && React.createElement("tr", null, React.createElement("td", {
      colSpan: days + 7,
      style: {
        position: 'sticky',
        left: 0,
        padding: '6px 10px',
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: .6,
        textTransform: 'uppercase',
        color: r.pca ? '#5b45c4' : '#0072a3',
        background: r.pca ? 'rgba(106,82,212,.08)' : 'rgba(0,144,202,.08)'
      }
    }, r.pca ? 'Patient care assistants · ' + rows.filter(x => x.pca).length : 'Nursing staff · ' + rows.filter(x => !x.pca).length)), React.createElement("tr", null, React.createElement("td", {
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
    }, t.hours || '')));
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
  const rcfg = useRosterConfig();
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
      const d = R.unitOf(e);
      m[d] = (m[d] || 0) + 1;
    });
    if (sc.scope === 'departments' && sc.units) sc.units.forEach(u => {
      if (!(u in m)) m[u] = 0;
    });
    const supN = (rcfg.supervisors || []).length;
    if (supN) m[R.SUPERVISOR_UNIT] = supN;
    return Object.entries(m).filter(([d]) => sc.inScope(d)).sort((a, b) => b[1] - a[1]);
  }, [staffStore.staff, sc.units, sc.scope, rcfg.supervisors]);
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
function RosAddStaff({
  dept,
  year,
  month,
  onClose,
  onAdd,
  onRoster
}) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [pick, setPick] = useState(null);
  const [mode, setMode] = useState('both');
  useEffect(() => {
    const n = q.trim();
    if (n.length < 2) {
      setHits([]);
      setErr('');
      return undefined;
    }
    let live = true;
    const t = setTimeout(() => {
      setBusy(true);
      rosApi.get('/api/rosters/staff-search?q=' + encodeURIComponent(n)).then(r => {
        if (!live) return;
        setBusy(false);
        if (r && r.ok) {
          setHits(r.staff || []);
          setErr('');
        } else {
          setHits([]);
          setErr(r && r.error || 'Could not search the staff.');
        }
      }).catch(() => {
        if (live) {
          setBusy(false);
          setErr('Could not reach the server.');
        }
      });
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);
  const monthName = new Date(year, month, 1).toLocaleString('en-GB', {
    month: 'long',
    year: 'numeric'
  });
  const pill = (v, title, sub) => React.createElement("label", {
    key: v,
    style: {
      flex: 1,
      minWidth: 180,
      display: 'flex',
      gap: 8,
      alignItems: 'flex-start',
      padding: '9px 11px',
      borderRadius: 10,
      cursor: 'pointer',
      border: '1px solid ' + (mode === v ? 'rgba(0,144,202,.5)' : 'rgba(125,145,180,.3)'),
      background: mode === v ? 'rgba(0,144,202,.07)' : '#fff'
    }
  }, React.createElement("input", {
    type: "radio",
    checked: mode === v,
    onChange: () => setMode(v),
    style: {
      marginTop: 2
    }
  }), React.createElement("span", null, React.createElement("b", {
    style: {
      display: 'block',
      fontSize: 12,
      color: '#16202e'
    }
  }, title), React.createElement("span", {
    style: {
      fontSize: 10.5,
      color: '#6c7a8c'
    }
  }, sub)));
  return React.createElement("div", {
    onMouseDown: e => {
      if (e.target === e.currentTarget) onClose();
    },
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 9000,
      background: 'rgba(16,28,46,.38)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '8vh 16px 16px'
    }
  }, React.createElement("div", {
    style: {
      width: 'min(560px,100%)',
      background: '#fff',
      borderRadius: 16,
      boxShadow: '0 24px 60px rgba(16,28,46,.28)',
      overflow: 'hidden'
    }
  }, React.createElement("div", {
    style: {
      padding: '14px 18px',
      borderBottom: '1px solid rgba(125,145,180,.2)',
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("h3", {
    style: ROS_H3
  }, "Add staff from another unit"), React.createElement("div", {
    style: {
      fontSize: 11,
      color: '#8a97a8',
      marginTop: 2
    }
  }, dept, " \xB7 ", monthName)), React.createElement("button", {
    type: "button",
    className: "btn sm",
    onClick: onClose
  }, "Close")), React.createElement("div", {
    style: {
      padding: '14px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, React.createElement("input", {
    autoFocus: true,
    value: q,
    onChange: e => {
      setQ(e.target.value);
      setPick(null);
    },
    placeholder: "Search by name, employee no., designation or unit\u2026",
    style: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '9px 12px',
      borderRadius: 10,
      border: '1px solid rgba(125,145,180,.4)',
      fontFamily: 'inherit',
      fontSize: 12.5
    }
  }), !pick && q.trim().length >= 2 && React.createElement("div", {
    style: {
      maxHeight: 280,
      overflow: 'auto',
      border: '1px solid rgba(125,145,180,.25)',
      borderRadius: 10
    }
  }, busy && !hits.length && React.createElement("div", {
    style: {
      padding: 12,
      fontSize: 11.5,
      color: '#8a97a8'
    }
  }, "Searching\u2026"), err && React.createElement("div", {
    style: {
      padding: 12,
      fontSize: 11.5,
      color: '#a92c42'
    }
  }, err), !busy && !err && !hits.length && React.createElement("div", {
    style: {
      padding: 12,
      fontSize: 11.5,
      color: '#8a97a8'
    }
  }, "No one matches."), hits.map(p => {
    const here = onRoster('S' + String(p.id));
    return React.createElement("div", {
      key: p.id,
      onClick: () => {
        if (!here) setPick(p);
      },
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        cursor: here ? 'default' : 'pointer',
        opacity: here ? 0.55 : 1,
        borderBottom: '1px solid rgba(125,145,180,.12)'
      }
    }, React.createElement(MK.Av, {
      name: p.name,
      emp: p,
      empId: p.emp_id,
      size: 30,
      radius: rosAvRadius(30)
    }), React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("span", {
      style: {
        display: 'block',
        fontSize: 12.5,
        fontWeight: 600,
        color: '#16202e'
      }
    }, p.name), React.createElement("span", {
      style: {
        display: 'block',
        fontSize: 10.5,
        color: '#8a97a8'
      }
    }, [p.emp_id, p.designation, p.unit || p.current_department].filter(Boolean).join(' · '))), React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: here ? '#8a97a8' : '#0072a3',
        whiteSpace: 'nowrap'
      }
    }, here ? 'On this roster' : 'Select'));
  })), pick && React.createElement("div", {
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
      padding: '9px 12px',
      borderRadius: 10,
      background: 'rgba(0,144,202,.06)',
      border: '1px solid rgba(0,144,202,.2)'
    }
  }, React.createElement(MK.Av, {
    name: pick.name,
    emp: pick,
    empId: pick.emp_id,
    size: 34,
    radius: rosAvRadius(34)
  }), React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("b", {
    style: {
      display: 'block',
      fontSize: 13,
      color: '#16202e'
    }
  }, pick.name), React.createElement("span", {
    style: {
      fontSize: 10.5,
      color: '#6c7a8c'
    }
  }, [pick.emp_id, pick.designation, pick.unit || pick.current_department].filter(Boolean).join(' · '))), React.createElement("button", {
    type: "button",
    className: "btn sm",
    onClick: () => setPick(null)
  }, "Change")), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, pill('both', 'Keep on both rosters', 'Also stays on the ' + (pick.unit || 'home') + ' roster'), pill('move', 'Only on this roster', 'Off the ' + (pick.unit || 'home') + ' roster for ' + monthName)), React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 8
    }
  }, React.createElement("button", {
    type: "button",
    className: "btn sm",
    onClick: onClose
  }, "Cancel"), React.createElement("button", {
    type: "button",
    className: "btn sm primary",
    onClick: () => onAdd(pick, mode)
  }, "Add to ", dept))))));
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
  const [orderManual, setOrderManual] = useState(false);
  const [rowDrag, setRowDrag] = useState(null);
  const rowDragId = useRef(null);
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
  const [members, setMembers] = useState(null);
  const [guests, setGuests] = useState({});
  const [oncall, setOncall] = useState({});
  const [altLeave, setAltLeave] = useState({});
  const [marks, setMarks] = useState({});
  const [movedOut, setMovedOut] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const staff = useMemo(() => {
    const mem = members ? new Set(members.map(String)) : null;
    const moved = new Set(movedOut);
    const byKey = {};
    (staffStore.staff || []).forEach(e => {
      if (e && e.id != null) byKey[rosKey(e)] = e;
    });
    const home = (staffStore.staff || []).filter(e => e.is_active !== false && !e.former && (dept === R.SUPERVISOR_UNIT ? !!(mem && mem.has(String(e.id))) : R.unitOf(e) === dept)).map(e => rosRowOf(e)).filter(r => !moved.has(r.empId) || Object.keys(grid[r.empId] || {}).length);
    const have = new Set(home.map(r => r.empId));
    return home.concat(Object.keys(guests).filter(k => !have.has(k)).map(k => byKey[k] ? rosRowOf(byKey[k]) : rosGuestRow(k, guests[k])));
  }, [staffStore.staff, dept, members, guests, movedOut, grid]);
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
    rosSeniorSort(staff.filter(x => !seen[x.empId]), signers.incharge && signers.incharge.name).forEach(x => {
      out.push(x);
      seen[x.empId] = 1;
    });
    Object.keys(grid).forEach(id => {
      if (!seen[id] && hasCells(id)) {
        out.push(ghost(id));
        seen[id] = 1;
      }
    });
    return rosByGroup(orderManual ? out : rosSeniorSort(out, signers.incharge && signers.incharge.name));
  }, [staff, order, grid, storedNames, orderManual, signers]);
  const pcaN = rows.filter(r => r.pca).length;
  const nurseN = rows.length - pcaN;
  const inScope = scope && scope.inScope || (() => true);
  const depts = useMemo(() => [...new Set((staffStore.staff || []).filter(e => e.is_active !== false && !e.former).map(e => R.unitOf(e)).concat([dept]))].filter(d => d === dept || inScope(d)).sort(), [staffStore.staff, dept, inScope]);
  const monthUrl = '/api/rosters/' + encodeURIComponent(dept) + '/' + year + '/' + month;
  const applyMeta = r => {
    const d = r.roster;
    setMeta(d ? {
      ...d,
      grid: undefined
    } : {});
    setSheetCan(d && d.can || r.can || null);
    setSigners(r.signers || {});
    setMembers(Array.isArray(r.members) ? r.members : d && Array.isArray(d.members) ? d.members : null);
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
      setOrderManual(!!(d && d.rules && d.rules.orderManual));
      setStoredNames(d && d.names || {});
      setGuests(d && d.guests || {});
      setOncall(d && d.oncall || {});
      setMarks(d && d.marks || {});
      setAltLeave(d && d.altLeave || {});
      setMovedOut(Array.isArray(r.movedOut) ? r.movedOut : []);
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
  const blockedAt = useRef(0);
  const editBlocked = () => {
    const now = Date.now();
    if (now - blockedAt.current < 4000) return;
    blockedAt.current = now;
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
  const markDone = (empId, d) => rosApi.post('/api/rosters/' + encodeURIComponent(meta.id || rosSheetId(dept, year, month)) + '/marks', {
    empId,
    day: d,
    remove: true
  }).then(r => {
    if (r && r.ok) {
      setMarks(r.roster && r.roster.marks || {});
      rosToast('Review note marked done.');
    } else rosToast(r && r.error || 'Could not clear the note.', 'error');
  });
  const ocMarked = (empId, d) => !!(oncall[empId] || {})[d] && R.isDuty(cellCode(empId, d));
  const alOf = (empId, d) => cellCode(empId, d) === 'AL' && (altLeave[empId] || {})[d] || null;
  const alPrefill = (empId, d) => {
    if (cellCode(empId, d) !== 'AL') return {};
    const a = alOf(empId, d) || {};
    return {
      alStep: true,
      alFor: a.for || '',
      alNote: a.note || ''
    };
  };
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
  const moveRow = (id, toIdx) => {
    if (!canEdit) {
      editBlocked();
      return;
    }
    const byId = {};
    rows.forEach(r => {
      byId[r.empId] = r;
    });
    const ids = rows.map(r => r.empId).filter(x => x !== id);
    const i = Math.max(0, Math.min(ids.length, toIdx));
    ids.splice(i, 0, id);
    setOrder(rosByGroup(ids.map(k => byId[k]).filter(Boolean)).map(r => r.empId));
    setOrderManual(true);
    setDirty(true);
  };
  const sortBySeniority = () => {
    if (!canEdit) {
      editBlocked();
      return;
    }
    setOrder(rosSeniorSort(rows, signers.incharge && signers.incharge.name).map(r => r.empId));
    setOrderManual(false);
    setDirty(true);
    rosToast('Rows sorted by seniority — In-charge and Team Leader first.');
  };
  const rowTool = (empId, v) => {
    if (v === 'up' || v === 'down' || v === 'top') {
      const at = rows.findIndex(r => r.empId === empId);
      const first = rows.findIndex(r => !!r.pca === !!(rows[at] && rows[at].pca));
      moveRow(empId, v === 'top' ? Math.max(0, first) : v === 'up' ? at - 1 : at + 1);
      return;
    }
    if (!canEdit || !v) {
      if (v) editBlocked();
      return;
    }
    if (v === 'unguest') {
      const g = guests[empId];
      if (!g || !rosIsAdmin()) return;
      if (!window.confirm('Take ' + (g.name || 'this person') + ' off this roster? Their shifts on this sheet are cleared' + (g.mode === 'move' ? ' and they go back on the ' + (g.from || 'home') + ' roster.' : '.'))) return;
      setGuests(m => {
        const n = {
          ...m
        };
        delete n[empId];
        return n;
      });
      setOrder(o => o.filter(k => k !== empId));
      setCells(gr => {
        const n = {
          ...gr
        };
        delete n[empId];
        return n;
      });
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
      guests,
      oncall,
      altLeave,
      baseRevision: rev,
      rules: {
        cfg,
        off: en,
        custom,
        orderManual,
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
  }, [grid, oncall, altLeave, cfg, en, custom, order, orderManual, dirty, retryTick]);
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
    const selfManager = !!(signers.manager && window.__UNICO_USER__ && String(window.__UNICO_USER__.username || '').toLowerCase() === String(signers.manager.username || '').toLowerCase());
    const r = await decider.run({
      id: meta.id || rosSheetId(dept, year, month),
      action,
      unit: dept,
      period: monthLabel,
      warnings: totalViol,
      selfManager
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
  const onDutyOf = (d, pca) => {
    let on = 0;
    rows.forEach(x => {
      if (!!x.pca !== !!pca) return;
      const b = R.bucketOf(cellCode(x.empId, d));
      if (b && b !== 'O') on++;
    });
    return on;
  };
  const cellDown = (empId, d) => evn => {
    if (!canEdit) {
      if (brush) {
        evn.preventDefault();
        editBlocked();
      }
      return;
    }
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
      cellBottom: r.bottom,
      ...alPrefill(empId, d)
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
      position: 'relative',
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
      onClick: () => {
        if (!canEdit) {
          editBlocked();
          return;
        }
        setBrush(brush === code ? '' : code);
      },
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
      hasManager: !!signers.manager,
      selfManager: !!(signers.manager && window.__UNICO_USER__ && String(window.__UNICO_USER__.username || '').toLowerCase() === String(signers.manager.username || '').toLowerCase())
    }));
  })(), stNorm === 'returned' && React.createElement(RosReturnedBanner, {
    meta: meta
  }), React.createElement(RosMarkList, {
    marks: marks,
    rows: rows,
    year: year,
    month: month,
    canDone: canEdit,
    onDone: markDone
  }), !canEdit && !loadError && !conflict && ROS_EDITABLE.indexOf(stNorm) >= 0 && React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'center',
      background: 'rgba(125,145,180,.1)',
      border: '1px solid rgba(125,145,180,.3)',
      borderRadius: 12,
      padding: '10px 14px',
      marginBottom: 14,
      fontSize: 12,
      color: '#3c4858'
    }
  }, React.createElement(Ic, {
    d: I.lock || 'M5 11h14v10H5zM8 11V7a4 4 0 018 0v4',
    s: 15
  }), React.createElement("span", null, React.createElement("b", null, "View only."), " Your account can open this roster but not change it, so the brushes and cells are locked. To prepare it, an administrator gives you ", React.createElement("b", null, "Duty Roster \u2014 Edit and Add"), " for ", dept, " (Access Control \u2192 Manage \u2192 Module access).")), decider.modal, panel === 'history' && React.createElement(RosDrawer, {
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
    lbl: pcaN ? 'Staff · ' + nurseN + ' nurses · ' + pcaN + ' PCAs' : 'Staff rostered',
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
  }), canEdit && rosIsAdmin() && React.createElement("button", {
    type: "button",
    onClick: () => setAddOpen(true),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      border: '1px solid rgba(0,144,202,.35)',
      background: 'rgba(0,144,202,.08)',
      color: '#0072a3',
      padding: '5px 11px',
      borderRadius: 9,
      fontSize: 10.5,
      fontWeight: 700,
      cursor: 'pointer',
      fontFamily: 'inherit',
      whiteSpace: 'nowrap'
    }
  }, React.createElement(Ic, {
    d: "M12 5v14M5 12h14",
    s: 12,
    sw: 2.4
  }), "Add staff from another unit"), addOpen && React.createElement(RosAddStaff, {
    dept: dept,
    year: year,
    month: month,
    onClose: () => setAddOpen(false),
    onRoster: k => rows.some(r => r.empId === k),
    onAdd: (p, mode) => {
      const k = 'S' + String(p.id);
      setGuests(m => ({
        ...m,
        [k]: {
          from: p.unit || p.current_department || '',
          mode,
          name: p.name || '',
          desig: p.designation || '',
          emp: p.emp_id || ''
        }
      }));
      setOrder(o => o.indexOf(k) >= 0 ? o : o.concat([k]));
      setDirty(true);
      setAddOpen(false);
      rosToast((p.name || 'Staff') + ' added to ' + dept + (mode === 'move' ? ' — off the ' + (p.unit || 'home') + ' roster this month.' : '.'));
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
    onClick: sortBySeniority,
    title: "In-charge first, then Team Leader, Senior Staff Nurse, Staff Nurse, PCA \u2014 drag a row's \u22EE\u22EE handle to set your own order",
    style: toolBtnStyle
  }, React.createElement(Ic, {
    d: "M3 6h13M3 12h9M3 18h5M17 8V20M14 17l3 3 3-3",
    s: 12,
    sw: 2
  }), orderManual ? 'Sort by seniority' : 'By seniority ✓'), React.createElement("button", {
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
    const head = pcaN && (si === 0 || !!rows[si - 1].pca !== !!x.pca) ? React.createElement("tr", {
      key: 'h-' + (x.pca ? 'p' : 'n')
    }, React.createElement("td", {
      colSpan: 99,
      style: {
        position: 'sticky',
        left: 0,
        padding: '7px 12px',
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: .7,
        textTransform: 'uppercase',
        color: x.pca ? '#5b45c4' : '#0072a3',
        background: x.pca ? 'linear-gradient(90deg,rgba(106,82,212,.12),rgba(106,82,212,.03))' : 'linear-gradient(90deg,rgba(0,144,202,.12),rgba(0,144,202,.03))',
        borderTop: si ? '2px solid rgba(106,82,212,.3)' : 'none',
        borderBottom: '1px solid rgba(125,145,180,.2)'
      }
    }, x.pca ? 'Patient care assistants · ' + pcaN : 'Nursing staff · ' + nurseN)) : null;
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
    return React.createElement(React.Fragment, {
      key: x.empId
    }, head, React.createElement("tr", {
      className: "ros-trow",
      onDragOver: e => {
        const id = rowDragId.current;
        if (!id || id === x.empId) return;
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        const after = e.clientY > r.top + r.height / 2;
        if (!rowDrag || rowDrag.over !== x.empId || rowDrag.after !== after) setRowDrag({
          id,
          over: x.empId,
          after
        });
      },
      onDrop: e => {
        e.preventDefault();
        const id = rowDragId.current;
        rowDragId.current = null;
        setRowDrag(null);
        if (!id || id === x.empId) return;
        const r = e.currentTarget.getBoundingClientRect();
        const after = e.clientY > r.top + r.height / 2;
        const ids = rows.map(k => k.empId).filter(k => k !== id);
        moveRow(id, ids.indexOf(x.empId) + (after ? 1 : 0));
      },
      style: {
        background: rowDrag && rowDrag.id === x.empId ? 'rgba(0,144,202,.08)' : si % 2 ? 'rgba(244,249,254,.5)' : 'transparent',
        transition: 'background .15s',
        boxShadow: rowDrag && rowDrag.over === x.empId ? rowDrag.after ? 'inset 0 -3px 0 #0090ca' : 'inset 0 3px 0 #0090ca' : 'none'
      }
    }, React.createElement("td", {
      style: {
        position: 'sticky',
        left: 0,
        zIndex: 1,
        background: 'rgba(250,252,255,.98)',
        padding: '4px 9px 4px 4px',
        borderBottom: '1px solid rgba(125,145,180,.14)',
        borderRight: '1px solid rgba(125,145,180,.2)'
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }
    }, React.createElement("span", {
      draggable: canEdit,
      title: canEdit ? 'Drag to move this person up or down' : '',
      onDragStart: e => {
        if (!canEdit) {
          e.preventDefault();
          return;
        }
        try {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', x.empId);
        } catch (er) {}
        rowDragId.current = x.empId;
        setRowDrag({
          id: x.empId,
          over: null,
          after: false
        });
      },
      onDragEnd: () => {
        rowDragId.current = null;
        setRowDrag(null);
      },
      style: {
        cursor: canEdit ? 'grab' : 'default',
        color: canEdit ? '#9aa6b4' : '#d6dce4',
        fontSize: 12,
        lineHeight: 1,
        letterSpacing: -2,
        padding: '6px 2px',
        userSelect: 'none',
        flexShrink: 0
      }
    }, "\u22EE\u22EE"), React.createElement(MK.Av, {
      name: x.name,
      emp: x,
      empId: x.empIdShown,
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
    }, "\u22EF"), React.createElement("optgroup", {
      label: "Position"
    }, React.createElement("option", {
      value: "top"
    }, "Move to top"), React.createElement("option", {
      value: "up"
    }, "Move up"), React.createElement("option", {
      value: "down"
    }, "Move down")), ROS_PATTERNS.map(p => React.createElement("option", {
      key: p[0],
      value: p[0]
    }, p[1])), React.createElement("option", {
      value: "blanks"
    }, "Fill blanks OFF"), React.createElement("option", {
      value: "clear"
    }, "Clear row"), guests[x.empId] && rosIsAdmin() && React.createElement("option", {
      value: "unguest"
    }, "Remove from this roster")))), Array.from({
      length: days
    }, (_, k) => k + 1).map(d => {
      const c = rowG[d] || '';
      const sh = R.BY_CODE[c];
      const oc = ocMarked(x.empId, d),
        al = c === 'AL' ? alOf(x.empId, d) : null;
      const mk = (marks[x.empId] || {})[d];
      const alTxt = c !== 'AL' ? '' : (al && al.for ? ' · in lieu of ' + rosDate(al.for) : ' · in-lieu date not set — click to add') + (al && al.note ? ' · ' + al.note : '');
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
        title: c ? c + ' — ' + (sh ? sh.label : '') + (sh && sh.hours ? ' · ' + sh.hours + ' h' : '') + (oc ? ' · + on call' : '') + alTxt + (mk ? '\nReview note: ' + mk.note : '') : mk ? 'Review note: ' + mk.note : 'Click to assign a shift',
        style: paintStyle(x.empId, d, c)
      }, c || '·', mk && React.createElement("i", {
        style: ROS_MARK_CORNER
      }), oc && React.createElement("i", {
        style: ROS_OC_BADGE
      }, "OC"), c === 'AL' && !(al && al.for) && React.createElement("i", {
        style: ROS_AL_DOT
      })));
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
    }, hrs)));
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
  }, pcaN ? 'Nurses on duty / day' : 'On duty / day'), Array.from({
    length: days
  }, (_, k) => k + 1).map(d => {
    const on = onDutyOf(d, false);
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
  }, "low = red")), pcaN > 0 && React.createElement("tr", {
    style: {
      background: 'rgba(106,82,212,.04)'
    }
  }, React.createElement("td", {
    style: {
      position: 'sticky',
      left: 0,
      zIndex: 1,
      background: 'rgba(243,240,252,.98)',
      padding: '8px 10px',
      fontSize: 9.5,
      fontWeight: 800,
      letterSpacing: .5,
      textTransform: 'uppercase',
      color: '#5b45c4',
      borderRight: '1px solid rgba(125,145,180,.2)'
    }
  }, "PCAs on duty / day"), Array.from({
    length: days
  }, (_, k) => k + 1).map(d => {
    const on = onDutyOf(d, true);
    return React.createElement("td", {
      key: d,
      title: on + ' PCA on duty on day ' + d,
      style: {
        padding: '7px 3px',
        textAlign: 'center',
        fontFamily: ROS_MONO,
        fontSize: 11,
        fontWeight: 800,
        color: on ? '#5b45c4' : '#c4ccd6',
        borderBottom: '1px solid rgba(125,145,180,.14)'
      }
    }, on);
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
      background: 'rgba(243,240,252,.98)',
      borderLeft: '1px solid rgba(125,145,180,.2)'
    }
  }, "not counted as nurses")))))), view === 'week' && (() => {
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
        emp: p.x,
        empId: p.x.empIdShown,
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
      emp: x,
      empId: x.empIdShown,
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
        emp: x,
        empId: x.empIdShown,
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
    }, [['OFF', 'Off day'], ['DO', 'Day off'], ['AL', 'Alternative leave'], ['CL', 'Casual leave'], ['EL', 'Earned leave'], ['ML', 'Maternity leave'], ['PH', 'Public holiday']].map(([code, label]) => {
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
      emp: n.p.x,
      empId: n.p.x.empIdShown,
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
      if (k === 'AL') {
        const a = (altLeave[pick.empId] || {})[pick.d] || {};
        setPick(p => ({
          ...p,
          alStep: true,
          alFor: a.for || '',
          alNote: a.note || ''
        }));
        return;
      }
      setPick(null);
    };
    const ocOn = !!(oncall[pick.empId] || {})[pick.d];
    const ocOk = R.isDuty(current);
    const toggleOc = () => {
      if (!canEdit) return editBlocked();
      if (!ocOk) return;
      setOncall(m => {
        const row = {
          ...(m[pick.empId] || {})
        };
        if (row[pick.d]) delete row[pick.d];else row[pick.d] = 1;
        return {
          ...m,
          [pick.empId]: row
        };
      });
      setDirty(true);
    };
    const saveAl = () => {
      if (!canEdit) return editBlocked();
      setAltLeave(m => ({
        ...m,
        [pick.empId]: {
          ...(m[pick.empId] || {}),
          [pick.d]: {
            for: pick.alFor || '',
            note: String(pick.alNote || '').trim()
          }
        }
      }));
      setDirty(true);
      setPick(null);
    };
    const alInp = {
      width: '100%',
      boxSizing: 'border-box',
      padding: '6px 9px',
      borderRadius: 8,
      border: '1px solid rgba(125,145,180,.4)',
      fontFamily: 'inherit',
      fontSize: 11.5,
      color: '#16202e',
      background: '#fff'
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
    }))), (marks[pick.empId] || {})[pick.d] && React.createElement("div", {
      style: {
        margin: '8px 11px 0',
        padding: '7px 9px',
        borderRadius: 8,
        background: 'rgba(210,58,82,.07)',
        border: '1px solid rgba(210,58,82,.25)',
        fontSize: 11,
        color: '#8c1d2a'
      }
    }, React.createElement("b", null, "Review note:"), " ", marks[pick.empId][pick.d].note, canEdit && React.createElement("button", {
      type: "button",
      className: "btn sm",
      style: {
        marginLeft: 8
      },
      onClick: () => markDone(pick.empId, pick.d)
    }, "Done")), pick.alStep ? React.createElement("div", {
      style: {
        padding: '11px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }
    }, React.createElement("div", {
      style: {
        fontSize: 11.5,
        fontWeight: 700,
        color: '#16202e'
      }
    }, "Alternative leave \u2014 in lieu of which date?"), React.createElement("div", {
      style: {
        fontSize: 10.5,
        color: '#6c7a8c',
        marginTop: -4
      }
    }, "The day worked that this leave replaces \u2014 any month."), React.createElement("input", {
      type: "date",
      value: pick.alFor || '',
      disabled: !canEdit,
      onChange: e => {
        const v = e.target.value;
        setPick(p => ({
          ...p,
          alFor: v
        }));
      },
      style: alInp
    }), pick.alFor && React.createElement("div", {
      style: {
        fontSize: 10.5,
        fontWeight: 700,
        color: '#0072a3',
        marginTop: -3
      }
    }, new Date(pick.alFor + 'T00:00:00').toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })), React.createElement("input", {
      value: pick.alNote || '',
      maxLength: 120,
      disabled: !canEdit,
      placeholder: "Reason (optional) \u2014 e.g. public holiday duty",
      onChange: e => {
        const v = e.target.value;
        setPick(p => ({
          ...p,
          alNote: v
        }));
      },
      style: alInp
    }), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6,
        justifyContent: 'flex-end',
        flexWrap: 'wrap'
      }
    }, React.createElement("button", {
      type: "button",
      className: "btn sm",
      onClick: () => setPick(p => ({
        ...p,
        alStep: false
      }))
    }, "Change shift"), React.createElement("button", {
      type: "button",
      className: "btn sm",
      onClick: () => setPick(null)
    }, "Skip"), React.createElement("button", {
      type: "button",
      className: "btn sm pri",
      disabled: !canEdit,
      onClick: saveAl
    }, "Save"))) : React.createElement("div", {
      style: {
        padding: '9px 11px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }
    }, React.createElement("div", {
      onClick: toggleOc,
      title: ocOk ? 'On call as well as this shift' : 'Pick a duty shift first — on call on a day off is the OC code',
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 9px',
        borderRadius: 8,
        cursor: ocOk ? 'pointer' : 'not-allowed',
        opacity: ocOk ? 1 : 0.5,
        border: '1px solid ' + (ocOn && ocOk ? '#0d3a5c' : 'rgba(125,145,180,.3)'),
        background: ocOn && ocOk ? 'rgba(13,58,92,.08)' : '#fff'
      }
    }, React.createElement("input", {
      type: "checkbox",
      readOnly: true,
      checked: ocOn && ocOk,
      style: {
        margin: 0,
        pointerEvents: 'none'
      }
    }), React.createElement("b", {
      style: {
        fontSize: 10.5,
        color: '#16202e'
      }
    }, "On call"), React.createElement("span", {
      style: {
        fontSize: 10,
        color: '#6c7a8c'
      }
    }, "in addition to the shift")), [['G', 'General', '#6a52d4'], ['M', 'Morning', '#b5670a'], ['E', 'Evening', '#0072a3'], ['N', 'Night', '#5b45c4'], ['O', 'Leave / off', '#7d8ea8']].map(([b, label, color]) => React.createElement("div", {
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
        emp: p.x,
        empId: p.x.empIdShown,
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
const rosEsc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[c]);
const rosDate = t => t ? new Date(t).toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
}) : '';
const rosDeptName = d => {
  try {
    return window.staffDeptShow && window.staffDeptShow(d) || d;
  } catch (e) {
    return d;
  }
};
function rosSignNames(doc, signers) {
  const sg = signers || {},
    h = doc && doc.history || [];
  const lastOf = acts => {
    for (let i = h.length - 1; i >= 0; i--) if (acts.indexOf(h[i].action) >= 0) return {
      e: h[i],
      i
    };
    return null;
  };
  const st = rosStatusNorm(doc ? doc.status : null);
  const inChain = st === 'pending_manager' || st === 'pending_cns' || st === 'approved';
  const sent = inChain ? lastOf(['send_manager', 'send_cns']) : null;
  const fwd0 = lastOf(['forward']);
  const fwd = fwd0 && sent && fwd0.i > sent.i ? fwd0 : null;
  const ok = st === 'approved' ? lastOf(['approve']) : null;
  return {
    prepared: sent && doc.preparedBy || sg.incharge && sg.incharge.name || '',
    checked: fwd && doc.checkedBy || sg.manager && sg.manager.name || '',
    approved: ok && doc.approvedBy || sg.cns && sg.cns.name || '',
    sent: sent ? sent.e : null,
    fwd: fwd ? fwd.e : null,
    ok: ok ? ok.e : null
  };
}
function rosPrintHtml({
  dept,
  deptName,
  year,
  month,
  doc,
  rows,
  grid,
  signers,
  signPeople,
  colourDesign,
  summary,
  cards,
  legend,
  pcaNewPage,
  printedBy
}) {
  const official = !colourDesign;
  const days = R.daysIn(year, month);
  const ds = Array.from({
    length: days
  }, (_, i) => i + 1);
  const dn = deptName || dept;
  const sn = rosSignNames(doc, signers);
  const {
    sent,
    fwd,
    ok
  } = sn;
  const sp = signPeople || {};
  const who = (k, role) => sp[k] ? [sp[k].name || '', sp[k].line || role] : [sn[k], role];
  const signs = [['Prepared by', ...who('prepared', 'In-charge, ' + dn), sent ? rosDate(sent.at) : ''], ['Checked by', ...who('checked', 'Nurse Manager'), fwd ? rosDate(fwd.at) : sent && sent.action === 'send_cns' ? 'sent directly to CNS' : ''], ['Approved by', ...who('approved', 'Chief of Nursing Services'), ok ? rosDate(ok.at) : '']];
  const ocm = doc && doc.oncall || {},
    alm = doc && doc.altLeave || {};
  const marked = (empId, d) => !!(ocm[empId] || {})[d] && R.isDuty(((grid || {})[empId] || {})[d]);
  const anyMark = Object.keys(ocm).some(id => Object.keys(ocm[id] || {}).some(d => marked(id, d)));
  const pill = (code, mark) => {
    if (!code) return '';
    const dot = mark ? '<b class="ocm">•</b>' : '';
    if (official) return rosEsc(code) + dot;
    const b = R.bucketOf(code);
    const c = b === 'O' ? '#6b7a8d' : rosBColor(b);
    return '<span class="k" style="background:' + c + (b === 'O' ? '14' : '1c') + ';color:' + c + '">' + rosEsc(code) + dot + '</span>';
  };
  const fri = d => new Date(year, month, d).getDay() === 5;
  const head1 = ds.map(d => '<th class="d' + (fri(d) ? ' fr' : '') + '">' + d + '</th>').join('');
  const head2 = ds.map(d => '<th class="w' + (fri(d) ? ' fr' : '') + '">' + rosEsc(String(rosDow(year, month, d)).slice(0, 2)) + '</th>').join('');
  const sumRow = (label, fn, tail) => '<tr class="sum"><td colspan="3" class="sl">' + label + '</td>' + ds.map(d => {
    const v = fn(d);
    return '<td class="c' + (fri(d) ? ' fr' : '') + '">' + (v || '') + '</td>';
  }).join('') + '<td colspan="' + tail + '"></td></tr>';
  const tableFor = (list, title, cls) => {
    const totOf = r => {
      const t = R.totalsFor(grid && grid[r.empId] || {}, days);
      t.OC = (t.OC || 0) + ds.filter(d => marked(r.empId, d)).length;
      return t;
    };
    const tb = ['G', 'M', 'E', 'N', 'O', 'OC'].filter(b => list.some(r => totOf(r)[b] > 0));
    const body = list.map((r, i) => {
      const row = grid && grid[r.empId] || {};
      const t = totOf(r);
      const shade = c => !official || !c ? '' : R.isOff(c) ? ' xo' : R.isLeave(c) ? ' xl' : '';
      const cells = ds.map(d => '<td class="c' + (fri(d) ? ' fr' : '') + shade(row[d]) + '">' + pill(row[d] || '', marked(r.empId, d)) + '</td>').join('');
      return '<tr class="r"><td class="n">' + (i + 1) + '</td><td class="e">' + rosEsc(r.empIdShown || '') + '</td>' + '<td class="nm"><b>' + rosEsc(r.name) + '</b>' + (r.desig ? '<span> · ' + rosEsc(r.desig) + '</span>' : '') + '</td>' + cells + tb.map(b => '<td class="t">' + (t[b] || '') + '</td>').join('') + '<td class="t h">' + (t.hours || '') + '</td></tr>';
    }).join('');
    const ids = list.map(r => r.empId);
    const cov = {};
    ds.forEach(d => {
      cov[d] = R.coverageFor(grid || {}, ids, d);
    });
    const leaveOn = d => ids.filter(id => R.isLeave(((grid || {})[id] || {})[d])).length;
    const some = fn => ds.some(d => fn(d) > 0);
    const sums = !summary ? '' : [['General on duty', d => cov[d].G], ['Morning on duty', d => cov[d].M], ['Evening on duty', d => cov[d].E], ['Night on duty', d => cov[d].N], ['On call', d => ids.filter(id => ((grid || {})[id] || {})[d] === 'OC' || marked(id, d)).length], ['On leave', leaveOn]].filter(([, fn]) => some(fn)).map(([l, fn]) => sumRow(l, fn, tb.length + 1)).join('');
    return '<div class="grp' + (cls ? ' ' + cls : '') + '">' + (title ? '<div class="gt"><span>' + rosEsc(title) + '</span></div>' : '') + '<table class="rt"><colgroup><col class="n"><col class="e"><col class="nm">' + ds.map(() => '<col class="d">').join('') + tb.map(() => '<col class="t">').join('') + '<col class="h"></colgroup>' + '<thead><tr><th rowspan="2">S/N</th><th rowspan="2">Emp ID</th><th rowspan="2" style="text-align:left;padding-left:4px">Name · Designation</th>' + head1 + tb.map(b => '<th rowspan="2">' + b + '</th>').join('') + '<th rowspan="2">Hrs</th></tr><tr>' + head2 + '</tr></thead>' + '<tbody>' + (body || '<tr><td colspan="' + (days + 4 + tb.length) + '" style="padding:14px;color:#7b8796">No staff on this roster.</td></tr>') + sums + '</tbody></table></div>';
  };
  const nurses = rows.filter(r => !r.pca),
    pcas = rows.filter(r => r.pca);
  const tables = pcas.length ? tableFor(nurses, 'Nursing staff · ' + nurses.length, 'gn') + tableFor(pcas, 'Patient care assistants · ' + pcas.length, 'gp' + (pcaNewPage ? ' np' : '')) : tableFor(rows, '', '');
  const used = new Set();
  rows.forEach(r => {
    const row = grid && grid[r.empId] || {};
    Object.keys(row).forEach(d => {
      if (row[d]) used.add(String(row[d]));
    });
  });
  const groups = R.BUCKETS.concat([{
    id: 'O',
    label: 'Leave / off',
    color: '#8b98ab'
  }]).filter((b, i, a) => a.findIndex(x => x.id === b.id) === i).map(b => ({
    b,
    codes: R.SHIFTS.filter(s => s.bucket === b.id && used.has(s.code))
  })).filter(g => g.codes.length);
  const unknown = [...used].filter(c => !R.BY_CODE[c]);
  const schedRows = [].concat(...groups.map(g => g.codes.map(x => g.b.id === 'O' ? [x.code, x.label, '—', '—', R.isOff(x.code) ? 'xo' : R.isLeave(x.code) ? 'xl' : ''] : [x.code, g.b.label, x.label, x.hours ? String(x.hours) : '—', '']))).concat(unknown.map(c => [c, '—', '—', '—', '']));
  const per = Math.ceil(schedRows.length / Math.max(1, Math.ceil(schedRows.length / 6)));
  const schedChunks = [];
  for (let i = 0; i < schedRows.length; i += per) schedChunks.push(schedRows.slice(i, i + per));
  const officialLegend = '<div class="lgx"><div class="lgh">Shift schedule</div><div class="schs">' + schedChunks.map(ch => '<table class="sch"><thead><tr><th>Code</th><th>Shift</th><th>Time</th><th>Hrs</th></tr></thead><tbody>' + ch.map(([c, n, t, h, x]) => '<tr><td class="cd' + (x ? ' ' + x : '') + '">' + rosEsc(c) + '</td><td>' + rosEsc(n) + '</td><td>' + rosEsc(t) + '</td><td class="hr">' + rosEsc(h) + '</td></tr>').join('') + '</tbody></table>').join('') + '</div>' + '<div class="key"><span><i class="sw xo"></i>Day off</span><span><i class="sw xl"></i>Leave</span><span><i class="sw"></i>On duty</span>' + (anyMark ? '<span><b class="ocm">•</b> after a code = on call as well</span>' : '') + '</div></div>';
  const legendHtml = !legend ? '' : !used.size ? '<div class="lgx"><div class="lgh">' + (official ? 'Shift schedule' : 'Shift legend') + '</div><div class="lgn">No shifts entered yet.</div></div>' : official ? officialLegend : '<div class="lgx"><div class="lgh">Shift legend</div><div class="lg">' + groups.map(g => '<div class="lgb" style="--lc:' + (g.b.id === 'O' ? '#6b7a8d14' : rosBColor(g.b.id) + '1c') + '"><b style="color:' + rosBColor(g.b.id) + '">' + rosEsc(g.b.label) + '</b>' + g.codes.map(s => '<span><i>' + rosEsc(s.code) + '</i> ' + rosEsc(s.label) + '</span>').join('') + '</div>').join('') + (anyMark ? '<div class="lgb"><b>On call</b><span><i>•</i> after a code = on call as well</span></div>' : '') + (unknown.length ? '<div class="lgb"><b>Other</b>' + unknown.map(c => '<span><i>' + rosEsc(c) + '</i></span>').join('') + '</div>' : '') + '</div></div>';
  const at = new Date().toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
  const d2 = d => String(d).padStart(2, '0') + ' ' + R.MONTHS[month].slice(0, 3) + ' ' + year;
  const period = d2(1) + ' – ' + d2(days);
  const g0 = grid || {};
  const ids = rows.map(r => r.empId);
  const mix = {
      G: 0,
      M: 0,
      E: 0,
      N: 0
    },
    offBy = {},
    perHrs = [];
  rows.forEach(r => {
    const row = g0[r.empId] || {};
    const tt = R.totalsFor(row, days);
    perHrs.push(tt.hours || 0);
    ['G', 'M', 'E', 'N'].forEach(b => {
      mix[b] += tt[b] || 0;
    });
    ds.forEach(d => {
      const c = row[d];
      if (c && (R.isLeave(c) || R.isOff(c))) offBy[c] = (offBy[c] || 0) + 1;
    });
  });
  const duty = mix.G + mix.M + mix.E + mix.N;
  const onCallN = rows.reduce((a, r) => a + ds.filter(d => (g0[r.empId] || {})[d] === 'OC' || marked(r.empId, d)).length, 0);
  const hrs = perHrs.reduce((a, b) => a + b, 0);
  const onDuty = ds.map(d => {
    const c = R.coverageFor(g0, ids, d);
    return c.G + c.M + c.E + c.N;
  });
  const lo = onDuty.length ? Math.min.apply(null, onDuty) : 0,
    hi = onDuty.length ? Math.max.apply(null, onDuty) : 0;
  const empty = onDuty.filter(n => n === 0).length;
  const desigs = {};
  rows.forEach(r => {
    const k = r.desig || (r.pca ? 'PCA' : 'Staff');
    desigs[k] = (desigs[k] || 0) + 1;
  });
  const desigTxt = Object.keys(desigs).sort((a, b) => desigs[b] - desigs[a] || a.localeCompare(b)).map(k => desigs[k] + ' ' + k).join(' · ');
  const offTxt = Object.keys(offBy).sort((a, b) => offBy[b] - offBy[a] || a.localeCompare(b)).map(k => k + ' ' + offBy[k]).join(' · ');
  const dayLbl = d => d + ' ' + R.MONTHS[month].slice(0, 3);
  const tiles = [['Staff', String(rows.length), (pcas.length ? nurses.length + ' nursing · ' + pcas.length + ' PCA · ' : '') + (desigTxt || 'no one yet'), 'b'], ['Shift mix', String(duty), (duty ? ['G', 'M', 'E', 'N'].filter(b => mix[b]).map(b => b + ' ' + mix[b]).join(' · ') : 'no duty shifts yet') + (onCallN ? ' · on call ' + onCallN : ''), 't'], ['Daily cover', duty ? lo === hi ? String(lo) : lo + '–' + hi : '0', !duty ? 'on duty per day' : empty ? '⚠ ' + empty + ' day' + (empty === 1 ? '' : 's') + ' with no one on duty' : 'on duty per day · lowest ' + dayLbl(onDuty.indexOf(lo) + 1), empty ? 'a' : 'g'], ['Off & leave', String(Object.keys(offBy).reduce((a, k) => a + offBy[k], 0)), offTxt || 'none this month', 'v'], ['Hours', hrs + ' h', perHrs.length ? Math.min.apply(null, perHrs) === Math.max.apply(null, perHrs) ? Math.min.apply(null, perHrs) + ' h each' : Math.min.apply(null, perHrs) + '–' + Math.max.apply(null, perHrs) + ' h per person' : '', 'sl']];
  const alRows = [];
  rows.forEach(r => {
    const row = g0[r.empId] || {};
    ds.forEach(d => {
      if (row[d] !== 'AL') return;
      const a = (alm[r.empId] || {})[d] || {};
      alRows.push([r.name, dayLbl(d) + ' ' + year, a.for ? rosDate(a.for) : '—', a.note || '']);
    });
  });
  const alHtml = !alRows.length ? '' : '<div class="alx"><div class="lgh">Alternative leave</div><table class="alt"><colgroup><col style="width:34%"><col style="width:14%"><col style="width:18%"><col></colgroup>' + '<thead><tr><th>Name</th><th>AL on</th><th>In lieu of (date worked)</th><th>Reason</th></tr></thead><tbody>' + alRows.map(([n, on, f, why]) => '<tr><td>' + rosEsc(n) + '</td><td>' + rosEsc(on) + '</td><td><b>' + rosEsc(f) + '</b></td><td>' + rosEsc(why) + '</td></tr>').join('') + '</tbody></table></div>';
  const NAVY = '#0d3a5c';
  const css = '@page{size:A4 landscape;margin:7mm 8mm 9mm;@bottom-right{content:"Page " counter(page) " of " counter(pages);font:7pt "Segoe UI",Arial,sans-serif;color:#7b8796}@bottom-left{content:"Duty Roster · ' + String(dn).replace(/["\\]/g, '') + ' · ' + R.MONTHS[month] + ' ' + year + '";font:7pt "Segoe UI",Arial,sans-serif;color:#7b8796}}' + '*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}' + 'body{font:8pt/1.3 "Segoe UI",Arial,sans-serif;color:#16202e;margin:0;padding:12px;background:#fff}@media print{body{padding:0}}' + '.band{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:14px;padding:5px 14px;border-radius:10px;color:#fff;' + 'background:linear-gradient(118deg,#0d3a5c 0%,#0b5f8f 48%,#1795c6 78%,#3ab5a7 100%);position:relative;overflow:hidden}' + '.band:after{content:"";position:absolute;right:-40px;top:-60px;width:220px;height:220px;border-radius:50%;background:rgba(255,255,255,.07)}' + '.band .lg0{display:inline-flex;align-items:center;background:#fff;border-radius:8px;padding:4px 9px;box-shadow:0 2px 6px rgba(0,0,0,.15)}.band img{height:25px;display:block}' + '.band .mid{text-align:center;position:relative;z-index:1}.band h1{margin:0;font-size:14pt;font-weight:800;letter-spacing:6px;line-height:1.15}' + '.band .mo{display:inline-block;margin-top:1px;font-size:8.8pt;font-weight:700;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);border-radius:12px;padding:0 12px}' + '.band .pd{font-size:7pt;opacity:.85;letter-spacing:.5px;margin-top:1px}' + '.band .rtx{text-align:right;position:relative;z-index:1}.band .kind{font-size:6.6pt;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;opacity:.8}.band .dp{font-size:15pt;font-weight:800;line-height:1.15}' + '.tiles{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin:6px 0 8px;position:relative;z-index:0}' + '.tile{border-radius:8px;padding:2px 10px 3px;border:1px solid #e3e9f0;border-left:4px solid var(--c);background:linear-gradient(90deg,var(--bg),#fff 85%)}' + '.tile span{display:block;font-size:6pt;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;color:#6b7a8d}.tile b{font-size:11pt;font-weight:800;color:var(--c);line-height:1.15}.tile i{font-style:normal;font-size:6.6pt;color:#7b8796;margin-left:6px}' + '.tile.b{--c:#0072a3;--bg:#e8f4fb}.tile.t{--c:#0f8a7e;--bg:#e6f6f3}.tile.g{--c:#1f6f43;--bg:#eaf6ee}.tile.v{--c:#5b45c4;--bg:#efecfb}.tile.a{--c:#b5670a;--bg:#fdf3e4}.tile.sl{--c:#334e68;--bg:#eef2f6}' + '.gt{display:flex;align-items:center;gap:8px;margin:5px 0 3px}.gt span{display:inline-block;font-size:7pt;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#fff;background:linear-gradient(90deg,#0072a3,#1795c6);border-radius:10px;padding:2px 11px}' + '.gt:after{content:"";flex:1;height:1px;background:linear-gradient(90deg,#c9d9e8,transparent)}.gp .gt span{background:linear-gradient(90deg,#5b45c4,#7e6be0)}.grp.np{page-break-before:always}' + 'table{border-collapse:separate;border-spacing:0;width:100%;table-layout:fixed;border:1px solid #c9d6e3;border-radius:8px;overflow:hidden}thead{display:table-header-group}tr{page-break-inside:avoid}' + 'th{background:' + NAVY + ';color:#fff;font-weight:700;padding:3px 0;font-size:7pt;border-right:1px solid rgba(255,255,255,.1)}th.w{font-weight:500;font-size:6.2pt;background:#1d5c87;padding:1px 0 2px}th.fr{background:#b5670a}th.w.fr{background:#cf7d17}' + '.gp th{background:#3b2f7a}.gp th.w{background:#4d3f94}.gp th.fr{background:#b5670a}.gp th.w.fr{background:#cf7d17}' + 'td{border-right:1px solid #e6ecf2;border-bottom:1px solid #e6ecf2;text-align:center;padding:0;height:13px}tr.r:nth-child(even) td{background:#f6f9fc}' + 'td.c{padding:1px}td.fr{background:#fdf5ea!important}' + '.k{display:inline-block;min-width:88%;border-radius:4px;padding:0;font-size:6.7pt;font-weight:800;letter-spacing:.1px}.k.ko{color:#6b7a8d}' + 'td.n{color:#7b8796;font-size:6.8pt}td.e{font-size:6.6pt;color:#5b6878}td.nm{text-align:left;padding:1px 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}td.nm b{font-size:7.5pt;color:#0d1b2e}td.nm span{font-size:6.2pt;color:#7b8796}' + 'td.t{font-size:7pt;background:#f1f5f9!important;color:#3c4858}td.h{font-weight:800;color:#0d1b2e;background:#e4eef7!important}col.n{width:6mm}col.e{width:12mm}col.nm{width:52mm}col.d{width:auto}col.t{width:6mm}col.h{width:8mm}' + 'tr.sum td{background:#eaf3fa!important;font-size:6.6pt;font-weight:700;color:' + NAVY + ';height:12px}tr.sum:first-of-type td{border-top:1.5px solid #9cc3de}tr.sum td.sl{text-align:right;padding-right:6px;font-weight:600;color:#3c5a74}.gp tr.sum td{background:#f0edfa!important;color:#3b2f7a}' + '.lnr{display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-top:7px;align-items:stretch}.lnr .notes{margin-top:0}.lgx{border:1px solid #d9e4ee;border-radius:8px;padding:4px 9px 5px;page-break-inside:avoid;background:#fbfdff}.lgh{font-size:6.4pt;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#0072a3;margin-bottom:2px}.lgn{font-size:7pt;color:#7b8796}' + '.lg{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:2px 16px;font-size:6.6pt;color:#3c4858}.lgb b{display:block;font-size:6.8pt;margin-bottom:1px;text-transform:uppercase;letter-spacing:.6px}.lgb span{display:inline-block;margin-right:8px;white-space:nowrap}' + '.lgb i{font-style:normal;font-weight:800;color:#0d1b2e;display:inline-block;min-width:18px;text-align:center;border-radius:4px;padding:0 3px;background:var(--lc,#eef2f6)}' + '.foot{page-break-inside:avoid;break-inside:avoid}.ocm{font-weight:900;margin-left:1px}' + '.alx{margin-top:7px;border:1px solid #d9e4ee;border-radius:8px;padding:4px 9px 5px;background:#fbfdff;break-inside:avoid;page-break-inside:avoid}.alt{width:100%;border-collapse:collapse;font-size:7pt}.alt th{background:#0d3a5c;color:#fff;text-align:left;padding:2px 6px;font-weight:700}.alt td{border-bottom:1px solid #e6ecf2;padding:2px 6px;color:#16202e}' + '.notes{margin-top:6px;border-radius:8px;background:#fffaf2;border:1px solid #f1dfc2;padding:4px 9px}.nb{font-size:7pt;color:#5a4a33}.nb b{color:#b5670a}.rm{margin-top:3px;font-size:7.4pt;color:#3c4858;border-bottom:1px dotted #c9b48f;height:14px}' + '.signs{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:8px;font-size:8pt;page-break-inside:avoid}' + '.signs>div{border:1px solid #e3e9f0;border-top:3px solid var(--sc);border-radius:9px;padding:0 11px 6px;background:linear-gradient(180deg,var(--sb),#fff 45%)}.signs>div:nth-child(1){--sc:#0072a3;--sb:#f1f8fd}.signs>div:nth-child(2){--sc:#5b45c4;--sb:#f5f3fd}.signs>div:nth-child(3){--sc:#1f6f43;--sb:#f0f8f3}' + '.signs .sp{height:28px}.signs .ln{border-top:1px solid #16202e;padding-top:4px}.signs .dt{margin-top:6px;font-size:7.4pt;color:#3c4858}' + '.signs span{display:block;font-size:6.4pt;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--sc)}.signs b{display:block;font-size:9pt;color:#0d1b2e}.signs em{display:block;font-style:normal;color:#5b6878;font-size:7pt}' + '.end{margin-top:6px;padding-top:3px;border-top:1px solid #e3e9f0;display:flex;justify-content:space-between;font-size:6.8pt;color:#7b8796}';
  const HATCH = 'repeating-linear-gradient(135deg,transparent 0,transparent 2.5px,rgba(0,0,0,.28) 2.5px,rgba(0,0,0,.28) 3.3px),#e0e0e0';
  const officialCss = '@page{size:A4 landscape;margin:8mm;@bottom-right{content:"Page " counter(page) " of " counter(pages);font:7pt Arial,sans-serif;color:#000}@bottom-left{content:"Duty Roster · ' + String(dn).replace(/["\\]/g, '') + ' · ' + R.MONTHS[month] + ' ' + year + '";font:7pt Arial,sans-serif;color:#000}}' + '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}' + 'body{font:8pt/1.3 Arial,"Segoe UI",sans-serif;color:#000;margin:0;padding:12px;background:#fff}@media print{body{padding:0}}' + '.lh{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;padding-bottom:3px}.lh img{height:32px;display:block}' + '.lhm{text-align:center}.lhm .org{font-size:11.5pt;font-weight:700;letter-spacing:.4px}.lhm .dv{font-size:7.5pt;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#333}.lhm h1{margin:2px 0 0;font-size:15pt;font-weight:800;letter-spacing:5px}' + 'table.rt,.meta,.sch,.alt{border-collapse:separate;border-spacing:0;border-top:.75pt solid #000;border-left:.75pt solid #000}' + '.rt th,.rt td,.meta th,.meta td,.sch th,.sch td,.alt th,.alt td{border:0;border-right:.75pt solid #000;border-bottom:.75pt solid #000}' + '.ocm{font-weight:900;margin-left:1px}.alx{margin-top:7px;border:1.25pt solid #000;padding:4px 8px 5px;break-inside:avoid;page-break-inside:avoid}' + '.alt{width:100%;font-size:7.5pt}.alt th{background:#d0d0d0;text-align:left;padding:1px 6px;font-weight:700}.alt td{padding:1px 6px}' + '.lhr{justify-self:end}.meta{font-size:7.5pt}.meta th{text-align:left;font-weight:700;padding:1px 6px;background:#e0e0e0}.meta td{padding:1px 8px;font-weight:700;min-width:40mm}' + '.rule{border-top:2pt solid #000;border-bottom:.6pt solid #000;height:3.5px;margin:1px 0 6px}' + '.tiles{display:grid;grid-template-columns:repeat(5,1fr);border:1.25pt solid #000;margin:0 0 6px}.tile{padding:2px 7px 3px;border-left:.75pt solid #000}.tile:first-child{border-left:0}' + '.tile span{display:block;font-size:6.6pt;font-weight:800;letter-spacing:1px;text-transform:uppercase}.tile b{font-size:11pt;font-weight:800;margin-right:5px}.tile i{font-style:normal;font-size:7pt;color:#333}' + '.gt{margin:6px 0 3px}.gt span{font-size:8pt;font-weight:800;letter-spacing:1px;text-transform:uppercase;border-bottom:1.25pt solid #000;padding-bottom:1px}.grp.np{page-break-before:always}' + 'table.rt{width:100%;table-layout:fixed;outline:.6pt solid #000}thead{display:table-header-group}tr{page-break-inside:avoid;break-inside:avoid}' + '.rt th{background:#d0d0d0;color:#000;font-weight:700;font-size:7pt;padding:2px 0}.rt th.w{font-weight:700;font-size:6.6pt;background:#e8e8e8;padding:1px 0}' + '.rt th.fr{background:#000;color:#fff;font-weight:800}' + '.rt td{text-align:center;padding:0;height:14px;color:#000}.rt td.c{font-size:7.5pt;font-weight:700;letter-spacing:-.1px}' + '.rt td.xo{background:#b3b3b3;font-weight:800}.rt td.xl{background:' + HATCH + ';font-style:italic;font-weight:800}' + 'td.n,td.e{font-size:7pt}td.nm{text-align:left;padding:1px 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}td.nm b{font-size:8pt}td.nm span{font-size:7pt;color:#333}' + 'td.t{font-size:7.5pt;font-weight:600}td.h{font-weight:800}' + 'col.n{width:6mm}col.e{width:12mm}col.nm{width:46mm}col.d{width:auto}col.t{width:6mm}col.h{width:8mm}' + 'tr.sum td{font-size:7pt;font-weight:700;height:12px}tr.sum:first-of-type td{border-top:.75pt solid #000}tr.sum td.sl{text-align:right;padding-right:6px}' + '.lnr{display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-top:7px;align-items:stretch}.lgx{border:1.25pt solid #000;padding:4px 8px 5px;break-inside:avoid;page-break-inside:avoid}' + '.lgh{font-size:7.5pt;font-weight:800;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px}.lgn{font-size:7.5pt}' + '.schs{display:flex;gap:8px;align-items:flex-start}.sch{font-size:7pt;flex:1 1 0;min-width:0}.sch th{background:#d0d0d0;padding:1px 4px;text-align:left;font-weight:700}' + '.sch td{padding:1px 4px}.sch td.cd{font-weight:800;text-align:center;width:9mm}.sch td.hr{text-align:center;width:8mm}.sch td.xo{background:#b3b3b3}.sch td.xl{background:' + HATCH + ';font-style:italic}' + '.key{margin-top:4px;font-size:7pt;font-weight:700;display:flex;gap:16px;align-items:center}.sw{display:inline-block;width:15px;height:9px;border:.75pt solid #000;vertical-align:-1px;margin-right:4px;background:#fff}.sw.xo{background:#b3b3b3}.sw.xl{background:' + HATCH + '}' + '.notes{border:1.25pt solid #000;padding:4px 8px}.nb{font-size:7.5pt}.rm{margin-top:4px;font-size:7.5pt;border-bottom:.75pt dotted #000;height:15px}' + '.foot{page-break-inside:avoid;break-inside:avoid}' + '.signs{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:10px;page-break-inside:avoid;break-inside:avoid}.signs>div{padding:0 2px}.signs .sp{height:30px}' + '.signs .ln{border-top:1pt solid #000;padding-top:3px}.signs span{display:block;font-size:7pt;font-weight:800;letter-spacing:1px;text-transform:uppercase}.signs b{display:block;font-size:9pt}.signs em{display:block;font-style:normal;font-size:7.5pt;color:#333}.signs .dt{margin-top:5px;font-size:7.5pt}' + '.end{margin-top:6px;padding-top:3px;border-top:.75pt solid #000;display:flex;justify-content:space-between;font-size:7pt}';
  const stLabel = (ROS_STATUS[rosStatusNorm(doc ? doc.status : null)] || {}).label || 'Draft';
  const head = official ? '<header class="lh"><div><img src="' + rosEsc(location.origin + '/unico/logo.svg') + '" alt="UNICO Hospitals"></div>' + '<div class="lhm"><div class="org">UNICO Hospitals PLC</div><div class="dv">Nursing Services</div><h1>DUTY ROSTER</h1></div>' + '<div class="lhr"><table class="meta"><tr><th>Department</th><td>' + rosEsc(dn) + '</td></tr><tr><th>Month</th><td>' + rosEsc(R.MONTHS[month] + ' ' + year) + '</td></tr>' + '<tr><th>Period</th><td>' + rosEsc(period) + '</td></tr><tr><th>Status</th><td>' + rosEsc(stLabel + (doc && doc.revision ? ' · Rev ' + doc.revision : '')) + '</td></tr></table></div></header><div class="rule"></div>' : '<header class="band"><div><span class="lg0"><img src="' + rosEsc(location.origin + '/unico/logo.svg') + '" alt="UNICO Hospitals"></span></div>' + '<div class="mid"><h1>DUTY ROSTER</h1><div class="mo">' + rosEsc(R.MONTHS[month] + ' ' + year) + '</div><div class="pd">' + rosEsc(period) + '</div></div>' + '<div class="rtx"><div class="kind">Nursing Services</div><div class="dp">' + rosEsc(dn) + '</div></div></header>';
  const html = head + (cards !== false ? '<div class="tiles">' + tiles.map(([l, v, sub, k]) => '<div class="tile ' + k + '"><span>' + rosEsc(l) + '</span><b>' + rosEsc(v) + '</b><i>' + rosEsc(sub) + '</i></div>').join('') + '</div>' : '<div style="height:7px"></div>') + tables + alHtml + '<div class="foot"><div class="lnr">' + (legendHtml || '<div></div>') + '<div class="notes"><div class="nb"><b>NB:</b> No change to this roster without permission from the authorised person. Swaps must be approved by the in-charge and recorded.</div>' + '<div class="rm">Remarks:</div><div class="rm"></div></div></div>' + '<div class="signs">' + signs.map(([l, n, role, when]) => '<div><div class="sp"></div><div class="ln"><span>' + rosEsc(l) + '</span><b>' + rosEsc(n || ' ') + '</b><em>' + rosEsc(role) + '</em>' + '<div class="dt">Date: ' + (when ? '<b style="display:inline;font-size:7.4pt">' + rosEsc(when) + '</b>' : '______________________') + '</div></div></div>').join('') + '</div>' + '<div class="end"><span>Printed by ' + rosEsc(printedBy || '—') + ' on ' + rosEsc(at) + ' from UNICO.</span><span>' + (ok ? 'Approved on ' + rosEsc(rosDate(ok.at)) + '.' : '') + '</span></div>' + '</div>';
  return '<!doctype html><html><head><meta charset="utf-8"><title>' + rosEsc('Duty Roster — ' + dn + ' — ' + R.MONTHS[month] + ' ' + year) + '</title><style>' + (official ? officialCss : css) + '</style></head><body>' + html + '</body></html>';
}
const ROS_PRINT_OPT_KEY = 'unico_roster_print_opts_v1';
function RosSignPick({
  label,
  person,
  staff,
  onPick
}) {
  const [q, setQ] = useState(null);
  const box = useRef(null);
  const n = String(q || '').trim().toLowerCase();
  const hits = n.length < 2 ? [] : (staff || []).filter(e => e && e.is_active !== false && !e.former && [e.name, e.emp_id, e.designation].join(' ').toLowerCase().indexOf(n) >= 0).slice(0, 8);
  const r = q != null && n.length >= 2 && box.current ? box.current.getBoundingClientRect() : null;
  return React.createElement("label", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      flex: '1 1 210px',
      minWidth: 190
    }
  }, React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: '#7d8ea8'
    }
  }, label), React.createElement("input", {
    ref: box,
    value: q == null ? person.name || '' : q,
    placeholder: person.name || 'Search staff…',
    onFocus: () => setQ(''),
    onBlur: () => setQ(null),
    onChange: e => setQ(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Escape') e.currentTarget.blur();
      if (e.key === 'Enter' && hits[0]) {
        onPick(hits[0]);
        e.currentTarget.blur();
      }
    },
    style: {
      padding: '6px 9px',
      borderRadius: 8,
      border: '1px solid rgba(125,145,180,.4)',
      fontFamily: 'inherit',
      fontSize: 12.5,
      fontWeight: 600,
      color: '#16202e'
    }
  }), React.createElement("span", {
    style: {
      fontSize: 10.5,
      color: '#6c7a8c',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, person.line || '—'), r && rosPortal(React.createElement("div", {
    style: {
      position: 'fixed',
      left: r.left,
      top: r.bottom + 4,
      width: Math.max(r.width, 280),
      maxHeight: 300,
      overflow: 'auto',
      zIndex: 9500,
      background: '#fff',
      border: '1px solid rgba(125,145,180,.3)',
      borderRadius: 10,
      boxShadow: '0 14px 36px rgba(16,28,46,.2)'
    }
  }, !hits.length && React.createElement("div", {
    style: {
      padding: 10,
      fontSize: 11.5,
      color: '#8a97a8'
    }
  }, "No one matches."), hits.map(e => React.createElement("div", {
    key: e.id,
    onMouseDown: ev => {
      ev.preventDefault();
      onPick(e);
      setQ(null);
      if (box.current) box.current.blur();
    },
    style: {
      padding: '7px 11px',
      cursor: 'pointer',
      borderBottom: '1px solid rgba(125,145,180,.12)'
    },
    onMouseEnter: ev => {
      ev.currentTarget.style.background = 'rgba(0,144,202,.07)';
    },
    onMouseLeave: ev => {
      ev.currentTarget.style.background = '';
    }
  }, React.createElement("b", {
    style: {
      display: 'block',
      fontSize: 12.5,
      color: '#16202e'
    }
  }, e.name), React.createElement("span", {
    style: {
      fontSize: 10.5,
      color: '#6c7a8c'
    }
  }, rosSignLine(e), e.emp_id ? ' · ' + e.emp_id : ''))))));
}
const rosSignLine = e => [window.staffCanonDesig ? window.staffCanonDesig(e.designation) : e.designation, e.current_department ? rosDeptName(e.current_department) : ''].filter(Boolean).join(', ');
function RosterPrint({
  staffStore,
  dept,
  year,
  month,
  setRoute
}) {
  const [doc, setDoc] = useState(null);
  const [signers, setSigners] = useState({});
  const [can, setCan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [opt, setOpt] = useState(() => {
    const d = {
      colourDesign: false,
      summary: true,
      cards: true,
      legend: true,
      pcaNewPage: false
    };
    try {
      return {
        ...d,
        ...(JSON.parse(localStorage.getItem(ROS_PRINT_OPT_KEY) || '{}') || {})
      };
    } catch (e) {
      return d;
    }
  });
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const frame = useRef(null);
  useEffect(() => {
    rosApi.get('/api/rosters/' + encodeURIComponent(dept) + '/' + year + '/' + month).then(r => {
      setDoc(r && r.ok && r.roster ? {
        ...r.roster,
        movedOut: r.movedOut || []
      } : null);
      setSigners(r && r.ok && r.signers || {});
      setCan(r && r.ok && (r.roster && r.roster.can || r.can) || null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [dept, year, month]);
  useEffect(() => {
    try {
      localStorage.setItem(ROS_PRINT_OPT_KEY, JSON.stringify(opt));
    } catch (e) {}
  }, [opt]);
  const view = useMemo(() => rosRowsFrom(doc, staffStore.staff, dept, undefined, signers.incharge && signers.incharge.name), [doc, staffStore.staff, dept, signers]);
  const me = window.__UNICO_USER__ && (window.__UNICO_USER__.name || window.__UNICO_USER__.username) || '';
  const deptName = rosDeptName(dept);
  const [picks, setPicks] = useState({});
  const signPeople = useMemo(() => {
    const def = rosSignNames(doc, signers);
    const people = staffStore.staff || [];
    const byName = nm => {
      const k = String(nm || '').trim().toLowerCase();
      return k ? people.find(e => e && !e.former && e.is_active !== false && String(e.name || '').trim().toLowerCase() === k) : null;
    };
    const role = {
      prepared: 'In-charge, ' + deptName,
      checked: 'Nurse Manager',
      approved: 'Chief of Nursing Services'
    };
    const out = {};
    ['prepared', 'checked', 'approved'].forEach(k => {
      const e = picks[k] || byName(def[k]);
      out[k] = e ? {
        name: e.name || '',
        line: rosSignLine(e) || role[k]
      } : {
        name: def[k],
        line: role[k]
      };
    });
    return out;
  }, [doc, signers, picks, staffStore.staff, deptName]);
  const html = useMemo(() => rosPrintHtml({
    dept,
    deptName,
    year,
    month,
    doc,
    rows: view.rows,
    grid: view.grid,
    signers,
    signPeople,
    ...opt,
    printedBy: me
  }), [dept, deptName, year, month, doc, view, signers, signPeople, opt, me]);
  const meU = String(window.__UNICO_USER__ && window.__UNICO_USER__.username || '').toLowerCase();
  const isSigner = !!meU && ['incharge', 'manager', 'cns'].some(k => signers[k] && String(signers[k].username || '').toLowerCase() === meU);
  const mayPrint = rosCan('print') || isSigner || !!(can && (can.edit || can.send || can.forward || can.approve));
  const print = () => {
    const w = frame.current && frame.current.contentWindow;
    if (!w) return;
    setBusy(true);
    rosApi.post('/api/rosters/print', {
      kind: 'sheet',
      target: dept,
      detail: R.MONTHS[month] + ' ' + year + (doc ? ' · rev ' + (doc.revision || 1) + ' · ' + rosStatusNorm(doc.status) : ' · not prepared')
    }).catch(() => null).then(() => {
      setBusy(false);
      try {
        w.focus();
        w.print();
      } catch (e) {
        rosToast('Could not open the print dialog.', 'error');
      }
    });
  };
  const downloadPdf = async () => {
    const f = frame.current;
    const d0 = f && f.contentDocument;
    if (!d0 || !d0.body) return;
    setPdfBusy(true);
    const body = d0.body;
    const keep = {
      w: body.style.width,
      p: body.style.padding
    };
    try {
      if (window.unicoLoadPdfLibs && !(window.jspdf && window.html2canvas)) await window.unicoLoadPdfLibs();
      const H = window.html2canvas,
        J = window.jspdf && window.jspdf.jsPDF;
      if (!H || !J) throw new Error('The PDF tools did not load.');
      await rosApi.post('/api/rosters/print', {
        kind: 'pdf',
        target: dept,
        detail: R.MONTHS[month] + ' ' + year
      }).catch(() => null);
      const W = 1123;
      body.style.width = W + 'px';
      body.style.padding = '0';
      await new Promise(r => setTimeout(r, 80));
      const scale = 2;
      const top0 = body.getBoundingClientRect().top;
      const marks = Array.prototype.map.call(d0.querySelectorAll('tr, .gt, .lgx, .foot'), el => (el.getBoundingClientRect().bottom - top0) * scale);
      const last = d0.querySelector('.foot') || body.lastElementChild;
      const contentH = Math.ceil((last ? last.getBoundingClientRect().bottom : body.scrollHeight) - top0 + 6);
      const canvas = await H(body, {
        scale,
        backgroundColor: '#ffffff',
        useCORS: true,
        windowWidth: W,
        width: W,
        height: contentH
      });
      const left0 = body.getBoundingClientRect().left,
        cg = canvas.getContext('2d');
      cg.setTransform(1, 0, 0, 1, 0, 0);
      for (const img of Array.prototype.slice.call(d0.querySelectorAll('img'))) {
        try {
          const r = img.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          const pic = new Image();
          pic.src = img.src;
          await pic.decode();
          cg.drawImage(pic, (r.left - left0) * scale, (r.top - top0) * scale, r.width * scale, r.height * scale);
        } catch (e) {}
      }
      const pdf = new J({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      const M = 8,
        pw = 297 - 2 * M,
        ph = 210 - 2 * M;
      const pxPerMm = canvas.width / pw,
        pageH = ph * pxPerMm;
      let y = 0,
        first = true;
      const endY = Math.min(canvas.height, contentH * scale);
      while (y < endY - 2) {
        let cut = Math.min(endY, y + pageH);
        if (cut < endY) {
          const fits = marks.filter(m => m > y + 20 && m <= y + pageH);
          if (fits.length) cut = Math.max.apply(null, fits);
        }
        const h = Math.ceil(cut - y);
        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        slice.height = h;
        const g = slice.getContext('2d');
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, slice.width, h);
        g.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
        if (!first) pdf.addPage();
        first = false;
        pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', M, M, pw, h / pxPerMm);
        y = cut;
      }
      const safe = s => String(s || '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
      pdf.save('Duty-Roster_' + safe(deptName) + '_' + R.MONTHS[month] + '-' + year + '.pdf');
      rosToast('PDF downloaded.');
    } catch (e) {
      rosToast((e && e.message ? e.message + ' ' : '') + 'Use Print and choose “Save as PDF” instead.', 'error');
    } finally {
      body.style.width = keep.w;
      body.style.padding = keep.p;
      setPdfBusy(false);
    }
  };
  if (loading) return React.createElement("div", {
    style: {
      display: 'grid',
      placeItems: 'center',
      height: '40vh',
      color: 'var(--muted,#8aa0b8)'
    }
  }, "Loading\u2026");
  const st = rosStatusNorm(doc ? doc.status : null);
  const tog = (k, label) => React.createElement("label", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 12,
      color: '#3c4858',
      cursor: 'pointer'
    }
  }, React.createElement("input", {
    type: "checkbox",
    checked: !!opt[k],
    onChange: e => setOpt(o => ({
      ...o,
      [k]: e.target.checked
    }))
  }), label);
  return React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      gap: 14,
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
      minWidth: 180
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 13.5,
      color: '#16202e'
    }
  }, "Print roster \u2014 ", deptName, ", ", R.MONTHS[month], " ", year), React.createElement("div", {
    className: "sub",
    style: {
      fontSize: 11
    }
  }, "A4 landscape \xB7 letterhead \xB7 only the shift codes this roster uses \xB7 signatures")), React.createElement(RosStatusChip, {
    st: doc ? doc.status : null
  }), React.createElement("div", {
    style: {
      flex: 1
    }
  }), tog('colourDesign', 'Colour version'), tog('cards', 'Summary cards'), tog('summary', 'Daily cover rows'), tog('legend', 'Shift legend'), view.rows.some(r => r.pca) && tog('pcaNewPage', 'PCAs on a new page'), mayPrint ? React.createElement(React.Fragment, null, React.createElement("button", {
    className: "btn",
    disabled: pdfBusy,
    onClick: downloadPdf,
    title: "Download this roster as a PDF file"
  }, pdfBusy ? 'Preparing PDF…' : 'Download PDF'), React.createElement("button", {
    className: "btn pri",
    disabled: busy,
    onClick: print
  }, busy ? 'Preparing…' : 'Print')) : React.createElement("span", {
    className: "sub",
    style: {
      fontSize: 11
    }
  }, "Printing needs Duty Roster print access.")), mayPrint && React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      gap: 14,
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      borderTop: '1px solid rgba(125,145,180,.18)',
      paddingTop: 10
    }
  }, React.createElement("div", {
    style: {
      minWidth: 120,
      paddingTop: 16
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 12.5,
      color: '#16202e'
    }
  }, "Signatures"), React.createElement("div", {
    className: "sub",
    style: {
      fontSize: 10.5
    }
  }, "pick from the staff list")), [['prepared', 'Prepared by'], ['checked', 'Checked by'], ['approved', 'Approved by']].map(([k, l]) => React.createElement(RosSignPick, {
    key: k,
    label: l,
    person: signPeople[k],
    staff: staffStore.staff,
    onPick: e => setPicks(p => ({
      ...p,
      [k]: e
    }))
  })), React.createElement("button", {
    type: "button",
    className: "btn sm",
    style: {
      marginTop: 17
    },
    disabled: !Object.keys(picks).length,
    onClick: () => setPicks({}),
    title: "Back to the names from Duty Roster \u2192 Setup"
  }, "Reset"))), React.createElement("div", {
    style: {
      background: 'rgba(125,145,180,.12)',
      borderRadius: 12,
      padding: 14,
      overflow: 'auto'
    }
  }, React.createElement("iframe", {
    ref: frame,
    title: "Roster print preview",
    srcDoc: html,
    style: {
      display: 'block',
      margin: '0 auto',
      width: '100%',
      maxWidth: 1180,
      height: '78vh',
      border: 0,
      background: '#fff',
      borderRadius: 6,
      boxShadow: '0 10px 30px rgba(16,32,46,.18)'
    }
  })));
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
  printHtml: rosPrintHtml,
  deptName: rosDeptName,
  signNames: rosSignNames,
  signLine: rosSignLine,
  RosMarkList,
  OC_BADGE: ROS_OC_BADGE,
  AL_DOT: ROS_AL_DOT,
  MARK_CORNER: ROS_MARK_CORNER,
  date: rosDate,
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
  useCallback,
  useRef
} = React;
const Ic = window.Ic,
  I = window.I;
const R = window.UNICO_ROSTER;
const MK = window.MK;
(function riCss() {
  if (typeof document === 'undefined' || document.getElementById('ri-css')) return;
  const el = document.createElement('style');
  el.id = 'ri-css';
  el.textContent = '@media (max-width: 960px){ .ri-split{ grid-template-columns: 1fr !important; } .ri-split > div{ position: static !important; } .ri-sum{ grid-template-columns: repeat(2,1fr) !important; } }' + '.ri-dec > div{ display:flex !important; width:100%; } .ri-dec button{ flex:1 1 0; justify-content:center; padding-top:10px !important; padding-bottom:10px !important; }';
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
function RiTracker({
  doc,
  signers
}) {
  const K = window.UNICO_ROSTER_KIT;
  const sg = signers || {};
  const h = doc && doc.history || [];
  const lastIdx = acts => {
    for (let i = h.length - 1; i >= 0; i--) if (acts.indexOf(h[i].action) >= 0) return i;
    return -1;
  };
  const st = K.statusNorm(doc ? doc.status : null);
  const inChain = st === 'pending_manager' || st === 'pending_cns' || st === 'approved';
  const si = inChain ? lastIdx(['send_manager', 'send_cns']) : -1;
  const sent = si >= 0 ? h[si] : null;
  const fi = lastIdx(['forward']);
  const fwd = sent && fi > si ? h[fi] : null;
  const ok = st === 'approved' && lastIdx(['approve']) >= 0 ? h[lastIdx(['approve'])] : null;
  const ret = st === 'returned' ? {
    stage: doc.returnStage,
    by: doc.returnedByName || doc.returnedBy,
    at: doc.returnedAt,
    note: doc.returnNote
  } : null;
  const nm = p => p && p.name || '';
  const steps = [{
    label: 'Prepared',
    who: sent && doc.preparedBy || nm(sg.incharge) || 'In-charge not set',
    role: 'In-charge',
    state: sent ? 'done' : 'current',
    sub: sent ? 'Sent ' + K.when(sent.at) : st === 'returned' ? 'Being corrected after return' : 'Not sent yet'
  }, {
    label: 'Checked',
    who: fwd && doc.checkedBy || nm(sg.manager) || 'Manager not set',
    role: 'Nurse Manager',
    state: fwd ? 'done' : st === 'pending_manager' ? 'current' : ret && ret.stage === 'manager' ? 'returned' : sent && sent.action === 'send_cns' ? 'skipped' : 'todo',
    sub: fwd ? 'Forwarded ' + K.when(fwd.at) : st === 'pending_manager' ? 'Checking now' : ret && ret.stage === 'manager' ? 'Returned ' + K.when(ret.at) : sent && sent.action === 'send_cns' ? 'Skipped — sent straight to CNS' : 'Waiting'
  }, {
    label: 'Approved',
    who: ok && doc.approvedBy || nm(sg.cns) || 'CNS not set',
    role: 'Chief of Nursing Services',
    state: ok ? 'done' : st === 'pending_cns' ? 'current' : ret && ret.stage === 'cns' ? 'returned' : 'todo',
    sub: ok ? 'Approved ' + K.when(ok.at) : st === 'pending_cns' ? 'Awaiting approval' : ret && ret.stage === 'cns' ? 'Returned ' + K.when(ret.at) : 'Waiting'
  }];
  const tone = {
    done: '#157a43',
    current: st === 'pending_cns' ? '#5b45c4' : '#0072a3',
    returned: '#b4232f',
    skipped: '#9aa6b4',
    todo: '#b6c0cc'
  };
  return React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 0,
      marginTop: 14,
      paddingTop: 14,
      borderTop: '1px solid rgba(125,145,180,.18)'
    }
  }, steps.map((s, i) => {
    const c = tone[s.state];
    return React.createElement("div", {
      key: s.label,
      style: {
        position: 'relative',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        paddingRight: 12
      }
    }, i < steps.length - 1 && React.createElement("span", {
      style: {
        position: 'absolute',
        left: 30,
        right: 0,
        top: 13,
        height: 2,
        background: s.state === 'done' ? '#1f9d57' : 'rgba(125,145,180,.25)',
        zIndex: 0
      }
    }), React.createElement("span", {
      style: {
        position: 'relative',
        zIndex: 1,
        display: 'inline-grid',
        placeItems: 'center',
        width: 28,
        height: 28,
        borderRadius: '50%',
        flexShrink: 0,
        fontSize: 12,
        fontWeight: 800,
        color: s.state === 'todo' || s.state === 'skipped' ? c : '#fff',
        background: s.state === 'todo' || s.state === 'skipped' ? '#fff' : c,
        border: '2px solid ' + c,
        boxShadow: s.state === 'current' ? '0 0 0 4px ' + c + '22' : 'none'
      }
    }, s.state === 'done' ? '✓' : s.state === 'returned' ? '!' : s.state === 'skipped' ? '–' : i + 1), React.createElement("div", {
      style: {
        position: 'relative',
        zIndex: 1,
        background: 'transparent',
        minWidth: 0,
        paddingRight: 8
      }
    }, React.createElement("div", {
      style: {
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: .8,
        textTransform: 'uppercase',
        color: c
      }
    }, s.label), React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 700,
        color: '#16202e',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, s.who), React.createElement("div", {
      style: {
        fontSize: 10.5,
        color: '#8a97a8'
      }
    }, s.role), React.createElement("div", {
      style: {
        fontSize: 11,
        fontWeight: 600,
        color: s.state === 'todo' ? '#9aa6b4' : c,
        marginTop: 2
      }
    }, s.sub), s.state === 'returned' && ret && React.createElement("div", {
      style: {
        fontSize: 11,
        color: '#8c1d2a',
        marginTop: 3,
        maxWidth: 260,
        whiteSpace: 'pre-wrap'
      }
    }, ret.note ? '“' + ret.note + '”' : 'No reason given')));
  }));
}
const RI_SHEET_W = 1123;
function RiSheetFrame({
  html
}) {
  const wrap = useRef(null);
  const frame = useRef(null);
  const [h, setH] = useState(700);
  const [s, setS] = useState(1);
  useEffect(() => {
    const fit = () => {
      const el = wrap.current;
      if (el) setS(Math.min(1, el.clientWidth / RI_SHEET_W));
    };
    fit();
    let ro = null;
    try {
      ro = new ResizeObserver(fit);
      if (wrap.current) ro.observe(wrap.current);
    } catch (e) {
      window.addEventListener('resize', fit);
    }
    return () => {
      if (ro) ro.disconnect();else window.removeEventListener('resize', fit);
    };
  }, []);
  const measure = () => {
    try {
      const d = frame.current.contentDocument;
      setH(Math.ceil(d.documentElement.scrollHeight) + 4);
    } catch (e) {}
  };
  return React.createElement("div", {
    ref: wrap,
    style: {
      background: '#fff',
      borderRadius: 12,
      border: '1px solid rgba(125,145,180,.22)',
      boxShadow: '0 12px 34px rgba(31,59,90,.1)',
      overflow: 'hidden',
      height: Math.ceil(h * s)
    }
  }, React.createElement("iframe", {
    ref: frame,
    title: "Roster sheet",
    srcDoc: html,
    onLoad: () => {
      measure();
      setTimeout(measure, 300);
    },
    scrolling: "no",
    style: {
      display: 'block',
      width: RI_SHEET_W,
      height: h,
      border: 0,
      transform: 'scale(' + s + ')',
      transformOrigin: '0 0'
    }
  }));
}
const riDay = (year, month, d) => new Date(year, month, d).toLocaleDateString('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short'
});
const riFri = (year, month, d) => new Date(year, month, d).getDay() === 5;
function riFocusOf(text, rows) {
  const days = new Set();
  const re = /Day (\d+)/g;
  let m;
  while (m = re.exec(String(text))) days.add(Number(m[1]));
  const people = new Set(rows.filter(r => r.name && String(text).indexOf(r.name) >= 0).map(r => r.empId));
  return {
    days,
    people,
    label: text
  };
}
function riPeopleOf(view, doc, year, month, cfg) {
  const days = R.daysIn(year, month);
  const fris = [];
  for (let d = 1; d <= days; d++) if (riFri(year, month, d)) fris.push(d);
  const marks = doc && doc.marks || {},
    al = doc && doc.altLeave || {},
    oc = doc && doc.oncall || {};
  return view.rows.map(r => {
    const row = view.grid[r.empId] || {};
    const t = R.totalsFor(row, days);
    let run = 0,
      maxRun = 0,
      offs = 0,
      alNoDate = 0,
      ocN = t.OC || 0;
    for (let d = 1; d <= days; d++) {
      const c = row[d];
      if (c && R.bucketOf(c) === 'N') {
        run++;
        maxRun = Math.max(maxRun, run);
      } else run = 0;
      if (R.isOff(c)) offs++;
      if (c === 'AL' && !((al[r.empId] || {})[d] || {}).for) alNoDate++;
      if ((oc[r.empId] || {})[d] && R.isDuty(c)) ocN++;
    }
    const friOff = fris.filter(d => R.isOff(row[d]) || R.isLeave(row[d])).length;
    const nMarks = Object.keys(marks[r.empId] || {}).length;
    const flags = [];
    if (t.hours > RI_OVERTIME_H) flags.push('Over ' + RI_OVERTIME_H + ' h');
    if (cfg.maxNights && maxRun > cfg.maxNights) flags.push(maxRun + ' nights in a row');
    if (cfg.fridayOff && fris.length && !friOff && !r.pca) flags.push('No Friday off');
    if (alNoDate) flags.push(alNoDate + ' AL without date');
    if (nMarks) flags.push(nMarks + ' review note' + (nMarks === 1 ? '' : 's'));
    return {
      r,
      t,
      maxRun,
      offs,
      friOff,
      ocN,
      alNoDate,
      nMarks,
      flags
    };
  });
}
function riDiff(rows, grid, oldGrid, days) {
  const out = [];
  rows.forEach(r => {
    const a = oldGrid[r.empId] || {},
      b = grid[r.empId] || {};
    for (let d = 1; d <= days; d++) {
      const x = a[d] || '',
        y = b[d] || '';
      if (x !== y) out.push({
        empId: r.empId,
        name: r.name,
        d,
        from: x,
        to: y
      });
    }
  });
  return out;
}
const RI_CARD = {
  background: '#fff',
  border: '1px solid rgba(125,145,180,.22)',
  borderRadius: 14,
  boxShadow: '0 6px 20px rgba(31,59,90,.06)',
  padding: '14px 18px'
};
const RI_CAP = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: .9,
  textTransform: 'uppercase',
  color: '#7d8ea8'
};
function RiGrid({
  view,
  year,
  month,
  doc,
  changes,
  focus,
  filter,
  person,
  onCell,
  flagsOf
}) {
  const K = window.UNICO_ROSTER_KIT;
  const days = R.daysIn(year, month);
  const ds = Array.from({
    length: days
  }, (_, i) => i + 1);
  const marks = doc && doc.marks || {},
    oc = doc && doc.oncall || {},
    al = doc && doc.altLeave || {};
  const changed = {};
  (changes || []).forEach(c => {
    changed[c.empId + '|' + c.d] = c.from;
  });
  const changedRows = new Set((changes || []).map(c => c.empId));
  const rows = view.rows.filter(r => person ? r.empId === person : filter === 'flagged' ? flagsOf(r.empId).length > 0 : filter === 'changed' ? changedRows.has(r.empId) : true);
  const hit = (emp, d) => !!focus && (!focus.days.size || focus.days.has(d)) && (!focus.people.size || focus.people.has(emp));
  const th = {
    position: 'sticky',
    top: 0,
    zIndex: 2,
    background: '#eef2f7',
    color: '#16202e',
    fontSize: 10,
    fontWeight: 800,
    padding: '4px 0',
    borderBottom: '1px solid #c9d3df',
    borderRight: '1px solid #e1e7ef',
    textAlign: 'center',
    minWidth: 30
  };
  return React.createElement("div", {
    style: {
      overflow: 'auto',
      maxHeight: '62vh',
      border: '1px solid #d5dde8',
      borderRadius: 10
    }
  }, React.createElement("table", {
    style: {
      borderCollapse: 'separate',
      borderSpacing: 0,
      width: '100%',
      fontFamily: "'IBM Plex Sans',system-ui,sans-serif"
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: {
      ...th,
      left: 0,
      zIndex: 3,
      textAlign: 'left',
      padding: '4px 10px',
      minWidth: 170
    }
  }, "Staff"), ds.map(d => {
    const fr = riFri(year, month, d);
    const lit = focus && focus.days.has(d);
    return React.createElement("th", {
      key: d,
      style: {
        ...th,
        background: lit ? '#ffe9a8' : fr ? '#16202e' : th.background,
        color: fr && !lit ? '#fff' : th.color
      }
    }, React.createElement("div", null, d), React.createElement("div", {
      style: {
        fontSize: 8.5,
        fontWeight: 700,
        opacity: .8
      }
    }, String(new Date(year, month, d).toLocaleDateString('en-GB', {
      weekday: 'short'
    })).slice(0, 2)));
  }), React.createElement("th", {
    style: {
      ...th,
      minWidth: 44
    }
  }, "Hrs"))), React.createElement("tbody", null, rows.map(r => {
    const row = view.grid[r.empId] || {};
    const fl = flagsOf(r.empId);
    return React.createElement("tr", {
      key: r.empId
    }, React.createElement("td", {
      style: {
        position: 'sticky',
        left: 0,
        zIndex: 1,
        background: '#fff',
        borderBottom: '1px solid #e6ebf1',
        borderRight: '1px solid #d5dde8',
        padding: '4px 10px',
        whiteSpace: 'nowrap',
        maxWidth: 220,
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, React.createElement("div", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        color: '#16202e',
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }
    }, r.name, fl.length > 0 && React.createElement("span", {
      title: fl.join(' · '),
      style: {
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: '#d23a52',
        flexShrink: 0
      }
    })), React.createElement("div", {
      style: {
        fontSize: 10,
        color: '#8a97a8'
      }
    }, [r.empIdShown, r.desig].filter(Boolean).join(' · '))), ds.map(d => {
      const c = row[d] || '';
      const mk = (marks[r.empId] || {})[d];
      const was = changed[r.empId + '|' + d];
      const ocOn = !!(oc[r.empId] || {})[d] && R.isDuty(c);
      const alx = c === 'AL' ? (al[r.empId] || {})[d] : null;
      const lit = hit(r.empId, d);
      const bg = lit ? '#fff3c4' : R.isOff(c) ? '#d9dde3' : R.isLeave(c) ? '#eef0f3' : '#fff';
      const tip = [c ? c + ((R.BY_CODE[c] || {}).label ? ' — ' + R.BY_CODE[c].label : '') : 'empty', ocOn ? '+ on call' : '', c === 'AL' ? alx && alx.for ? 'in lieu of ' + K.date(alx.for) : 'in-lieu date not set' : '', was !== undefined ? 'was ' + (was || 'empty') : '', mk ? 'Note: ' + mk.note : ''].filter(Boolean).join('\n');
      return React.createElement("td", {
        key: d,
        title: tip,
        onClick: e => onCell(r, d, e.currentTarget.getBoundingClientRect()),
        style: {
          position: 'relative',
          cursor: 'pointer',
          textAlign: 'center',
          padding: '5px 0',
          fontSize: 10.5,
          fontWeight: R.isLeave(c) ? 700 : 800,
          fontStyle: R.isLeave(c) ? 'italic' : 'normal',
          fontFamily: "'IBM Plex Mono',monospace",
          color: '#16202e',
          background: bg,
          borderBottom: '1px solid #e6ebf1',
          borderRight: '1px solid #eef1f5',
          boxShadow: was !== undefined ? 'inset 0 0 0 2px #0090ca' : lit ? 'inset 0 0 0 2px #e0a81e' : 'none'
        }
      }, c || React.createElement("span", {
        style: {
          color: '#c4ccd6'
        }
      }, "\xB7"), mk && React.createElement("i", {
        style: K.MARK_CORNER
      }), ocOn && React.createElement("i", {
        style: {
          ...K.OC_BADGE,
          top: -1,
          right: -1
        }
      }, "OC"), c === 'AL' && !(alx && alx.for) && React.createElement("i", {
        style: K.AL_DOT
      }));
    }), React.createElement("td", {
      style: {
        textAlign: 'center',
        fontSize: 11,
        fontWeight: 800,
        color: R.totalsFor(row, days).hours > RI_OVERTIME_H ? '#b4232f' : '#16202e',
        borderBottom: '1px solid #e6ebf1',
        fontFamily: "'IBM Plex Mono',monospace"
      }
    }, R.totalsFor(row, days).hours));
  }), !rows.length && React.createElement("tr", null, React.createElement("td", {
    colSpan: days + 2,
    style: {
      padding: 22,
      textAlign: 'center',
      color: '#8a97a8',
      fontSize: 12
    }
  }, "Nobody matches this filter.")))));
}
function RiCellPop({
  cell,
  doc,
  year,
  month,
  can,
  busy,
  onClose,
  onMark,
  onUnmark,
  onEdit
}) {
  const K = window.UNICO_ROSTER_KIT;
  const {
    r,
    d,
    rect,
    code,
    was
  } = cell;
  const mk = ((doc.marks || {})[r.empId] || {})[d];
  const [note, setNote] = useState(mk ? mk.note : '');
  const [to, setTo] = useState(code);
  const alx = code === 'AL' ? ((doc.altLeave || {})[r.empId] || {})[d] : null;
  const ocOn = !!((doc.oncall || {})[r.empId] || {})[d] && R.isDuty(code);
  useEffect(() => {
    const k = e => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const W = 300,
    vw = window.innerWidth,
    vh = window.innerHeight;
  const left = Math.max(8, Math.min(vw - W - 8, rect.left + rect.width / 2 - W / 2));
  const below = vh - rect.bottom > 330;
  const inp = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '6px 9px',
    borderRadius: 8,
    border: '1px solid rgba(125,145,180,.4)',
    fontFamily: 'inherit',
    fontSize: 12
  };
  return K.portal(React.createElement(React.Fragment, null, React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 7000
    }
  }), React.createElement("div", {
    style: {
      position: 'fixed',
      left,
      width: W,
      zIndex: 7001,
      ...(below ? {
        top: rect.bottom + 6
      } : {
        bottom: vh - rect.top + 6
      }),
      background: '#fff',
      borderRadius: 12,
      border: '1px solid rgba(125,145,180,.3)',
      boxShadow: '0 18px 48px rgba(16,28,46,.24)',
      overflow: 'hidden'
    }
  }, React.createElement("div", {
    style: {
      padding: '10px 13px',
      background: '#f4f7fb',
      borderBottom: '1px solid rgba(125,145,180,.2)'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 800,
      color: '#16202e'
    }
  }, r.name), React.createElement("div", {
    style: {
      fontSize: 11,
      color: '#6c7a8c'
    }
  }, riDay(year, month, d), " \xB7 ", React.createElement("b", {
    style: {
      fontFamily: "'IBM Plex Mono',monospace",
      color: '#16202e'
    }
  }, code || 'empty'), code && R.BY_CODE[code] ? ' — ' + R.BY_CODE[code].label : ''), ocOn && React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: '#0d3a5c',
      fontWeight: 700,
      marginTop: 2
    }
  }, "+ On call"), code === 'AL' && React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: alx && alx.for ? '#0072a3' : '#b5670a',
      fontWeight: 700,
      marginTop: 2
    }
  }, alx && alx.for ? 'In lieu of ' + K.date(alx.for) + (alx.note ? ' · ' + alx.note : '') : 'Alternative leave — in-lieu date not set'), was !== undefined && React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: '#0072a3',
      fontWeight: 700,
      marginTop: 2
    }
  }, "Changed \u2014 was ", was || 'empty')), React.createElement("div", {
    style: {
      padding: '10px 13px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, (can.mark || mk) && React.createElement("div", null, React.createElement("div", {
    style: {
      ...RI_CAP,
      marginBottom: 4
    }
  }, "Note for the in-charge"), can.mark ? React.createElement("textarea", {
    value: note,
    onChange: e => setNote(e.target.value),
    maxLength: 200,
    rows: 2,
    placeholder: "e.g. No night duty right after leave",
    style: {
      ...inp,
      resize: 'vertical'
    }
  }) : React.createElement("div", {
    style: {
      fontSize: 12,
      color: '#8c1d2a'
    }
  }, mk.note), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      justifyContent: 'flex-end',
      marginTop: 6
    }
  }, mk && (can.mark || can.markDone) && React.createElement("button", {
    type: "button",
    className: "btn sm",
    disabled: busy,
    onClick: () => onUnmark(r.empId, d)
  }, "Remove note"), can.mark && React.createElement("button", {
    type: "button",
    className: "btn sm pri",
    disabled: busy || !note.trim(),
    onClick: () => onMark(r.empId, d, note.trim())
  }, mk ? 'Update note' : 'Pin note'))), can.reviewEdit && React.createElement("div", {
    style: {
      borderTop: '1px solid rgba(125,145,180,.18)',
      paddingTop: 9
    }
  }, React.createElement("div", {
    style: {
      ...RI_CAP,
      marginBottom: 4
    }
  }, "Change the shift directly"), React.createElement("select", {
    value: to,
    onChange: e => setTo(e.target.value),
    style: inp
  }, React.createElement("option", {
    value: ""
  }, "\u2014 empty \u2014"), R.BUCKETS.map(b => React.createElement("optgroup", {
    key: b.id,
    label: b.label
  }, R.SHIFTS.filter(x => x.bucket === b.id).map(x => React.createElement("option", {
    key: x.code,
    value: x.code
  }, x.code, " \u2014 ", x.label))))), to !== code && React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: '#6c7a8c',
      marginTop: 5
    }
  }, React.createElement("b", {
    style: {
      fontFamily: "'IBM Plex Mono',monospace"
    }
  }, code || '—', " \u2192 ", to || '—'), " is saved at once and logged in the history for the in-charge."), React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      marginTop: 6
    }
  }, React.createElement("button", {
    type: "button",
    className: "btn sm pri",
    disabled: busy || to === code,
    onClick: () => onEdit(r.empId, d, to, code)
  }, "Apply change"))), !can.mark && !can.reviewEdit && !mk && React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: '#8a97a8'
    }
  }, "Read-only \u2014 this roster is not waiting on you.")))));
}
function RiCover({
  view,
  year,
  month,
  minOnDuty
}) {
  const K = window.UNICO_ROSTER_KIT;
  const days = R.daysIn(year, month);
  const ids = view.rows.filter(r => !r.pca).map(r => r.empId);
  const nm = {};
  view.rows.forEach(r => {
    nm[r.empId] = r.name;
  });
  const cov = Array.from({
    length: days
  }, (_, i) => R.coverageFor(view.grid, ids, i + 1));
  const tot = cov.map(c => c.G + c.M + c.E + c.N);
  const top = Math.max(minOnDuty || 0, ...tot, 1) + 1;
  const BW = 26,
    H = 170,
    PB = 34,
    PT = 10,
    ch = H - PB - PT;
  const y = v => PT + ch - v / top * ch;
  const low = tot.filter(t => minOnDuty && t < minOnDuty).length;
  return React.createElement("div", null, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      flexWrap: 'wrap',
      marginBottom: 8,
      fontSize: 11.5,
      color: '#3c4858'
    }
  }, ['G', 'M', 'E', 'N'].map(b => React.createElement("span", {
    key: b,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5
    }
  }, React.createElement("i", {
    style: {
      width: 11,
      height: 11,
      borderRadius: 3,
      background: K.bColor(b)
    }
  }), {
    G: 'General',
    M: 'Morning',
    E: 'Evening',
    N: 'Night'
  }[b])), minOnDuty ? React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5
    }
  }, React.createElement("i", {
    style: {
      width: 16,
      borderTop: '2px dashed #d23a52'
    }
  }), "Minimum ", minOnDuty, " on duty") : null, React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontWeight: 700,
      color: low ? '#b4232f' : '#157a43'
    }
  }, low ? low + ' day' + (low === 1 ? '' : 's') + ' below the minimum' : 'Every day meets the minimum')), React.createElement("div", {
    style: {
      overflowX: 'auto'
    }
  }, React.createElement("svg", {
    viewBox: '0 0 ' + (days * BW + 30) + ' ' + H,
    style: {
      width: '100%',
      minWidth: days * 20,
      height: 'auto',
      display: 'block'
    },
    role: "img",
    "aria-label": "Staff on duty per day"
  }, [0, Math.ceil(top / 2), top].map(v => React.createElement("g", {
    key: v
  }, React.createElement("line", {
    x1: 26,
    x2: days * BW + 30,
    y1: y(v),
    y2: y(v),
    stroke: "#e6ebf1"
  }), React.createElement("text", {
    x: 20,
    y: y(v) + 3,
    fontSize: "9",
    textAnchor: "end",
    fill: "#8a97a8"
  }, v))), cov.map((c, i) => {
    const d = i + 1,
      x = 30 + i * BW + 4;
    let acc = 0;
    const isLow = minOnDuty && tot[i] < minOnDuty,
      fr = riFri(year, month, d);
    return React.createElement("g", {
      key: d
    }, fr && React.createElement("rect", {
      x: 30 + i * BW,
      y: PT,
      width: BW,
      height: ch,
      fill: "#16202e",
      opacity: ".05"
    }), ['N', 'E', 'M', 'G'].map(b => {
      const v = c[b] || 0;
      if (!v) return null;
      const y0 = y(acc + v),
        hh = y(acc) - y(acc + v);
      acc += v;
      return React.createElement("rect", {
        key: b,
        x: x,
        y: y0,
        width: BW - 8,
        height: hh,
        rx: "2",
        fill: K.bColor(b)
      }, React.createElement("title", null, riDay(year, month, d) + ' · ' + b + ' ' + v + (c.names && c.names[b] && c.names[b].length ? ': ' + c.names[b].map(id => nm[id] || id).join(', ') : '')));
    }), React.createElement("text", {
      x: x + (BW - 8) / 2,
      y: y(tot[i]) - 3,
      fontSize: "9",
      textAnchor: "middle",
      fill: isLow ? '#b4232f' : '#3c4858',
      fontWeight: "700"
    }, tot[i]), React.createElement("text", {
      x: x + (BW - 8) / 2,
      y: H - 20,
      fontSize: "9.5",
      textAnchor: "middle",
      fill: isLow ? '#b4232f' : fr ? '#16202e' : '#6c7a8c',
      fontWeight: isLow || fr ? 800 : 500
    }, d), React.createElement("text", {
      x: x + (BW - 8) / 2,
      y: H - 9,
      fontSize: "8",
      textAnchor: "middle",
      fill: "#9aa6b4"
    }, String(new Date(year, month, d).toLocaleDateString('en-GB', {
      weekday: 'short'
    })).slice(0, 2)));
  }), minOnDuty ? React.createElement("line", {
    x1: 26,
    x2: days * BW + 30,
    y1: y(minOnDuty),
    y2: y(minOnDuty),
    stroke: "#d23a52",
    strokeDasharray: "5 4",
    strokeWidth: "1.5"
  }) : null)));
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
  const [tab, setTab] = useState('sheet');
  const [focus, setFocus] = useState(null);
  const [filter, setFilter] = useState('all');
  const [person, setPerson] = useState('');
  const [cell, setCell] = useState(null);
  const [acting, setActing] = useState(false);
  const [versions, setVersions] = useState([]);
  const [cmpRev, setCmpRev] = useState(null);
  const [cmpGrid, setCmpGrid] = useState(null);
  const [ticks, setTicks] = useState({});
  const [openRule, setOpenRule] = useState({});
  const [showClear, setShowClear] = useState(false);
  const rulesRef = useRef(null),
    sheetRef = useRef(null),
    checkRef = useRef(null);
  const dept = row.sheetDept || row.deptName;
  const load = useCallback(() => K.api.get('/api/rosters/' + encodeURIComponent(dept) + '/' + year + '/' + month).then(r => {
    if (r && r.ok) {
      setDoc(r.roster ? {
        ...r.roster,
        movedOut: r.movedOut || []
      } : null);
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
  const take = r => {
    if (r && r.ok && r.roster) {
      setDoc(d => ({
        ...r.roster,
        movedOut: d && d.movedOut || []
      }));
      setExtra(e => ({
        ...e,
        can: r.roster.can || e.can,
        signers: r.roster.signers || e.signers
      }));
      return true;
    }
    K.toast(r && r.error || 'Could not save that.', 'error');
    return false;
  };
  const docId = doc && doc.id,
    docRev = doc ? doc.revision || 0 : 0;
  useEffect(() => {
    if (!docId) return undefined;
    let live = true;
    K.api.get('/api/rosters/' + encodeURIComponent(docId) + '/versions').then(r => {
      if (!live || !r || !r.ok) return;
      const seen = {};
      const list = (r.versions || []).filter(v => {
        if (seen[v.revision]) return false;
        seen[v.revision] = 1;
        return true;
      });
      setVersions(list);
      setCmpRev(cur => {
        if (cur != null && list.some(v => v.revision === cur)) return cur;
        const prev = list.find(v => v.revision < docRev);
        return prev ? prev.revision : null;
      });
    }).catch(() => {});
    return () => {
      live = false;
    };
  }, [docId, docRev]);
  useEffect(() => {
    if (!docId || cmpRev == null) {
      setCmpGrid(null);
      return undefined;
    }
    let live = true;
    K.api.get('/api/rosters/' + encodeURIComponent(docId) + '/versions/' + cmpRev).then(r => {
      if (live && r && r.ok && r.version) setCmpGrid(K.rowsFrom({
        ...r.version,
        guests: doc && doc.guests || {},
        movedOut: doc && doc.movedOut || []
      }, staff, dept).grid);
    }).catch(() => {});
    return () => {
      live = false;
    };
  }, [docId, cmpRev]);
  const view = useMemo(() => doc ? K.rowsFrom(doc, staff, dept, undefined, extra.signers && extra.signers.incharge && extra.signers.incharge.name) : {
    rows: [],
    grid: {}
  }, [doc, staff, dept, extra]);
  const ev = useMemo(() => doc ? K.findingsOf(view.grid, view.rows, year, month, doc.rules) : null, [doc, view, year, month]);
  const cfg = useMemo(() => K.rulesOf(doc && doc.rules).cfg, [doc]);
  const days = R.daysIn(year, month);
  const people = useMemo(() => riPeopleOf(view, doc, year, month, cfg), [view, doc, year, month, cfg]);
  const flagsBy = useMemo(() => {
    const m = {};
    people.forEach(p => {
      m[p.r.empId] = p.flags;
    });
    return m;
  }, [people]);
  const changes = useMemo(() => cmpGrid ? riDiff(view.rows, view.grid, cmpGrid, days) : [], [cmpGrid, view, days]);
  const stats = useMemo(() => {
    let hours = 0,
      shifts = 0,
      over = 0;
    people.forEach(p => {
      hours += p.t.hours;
      shifts += p.t.G + p.t.M + p.t.E + p.t.N;
      if (p.t.hours > RI_OVERTIME_H) over++;
    });
    return {
      hours,
      shifts,
      over,
      pca: view.rows.filter(x => x.pca).length
    };
  }, [people, view]);
  const lowDays = useMemo(() => {
    const ids = view.rows.filter(r => !r.pca).map(r => r.empId);
    let n = 0;
    for (let d = 1; d <= days; d++) {
      const c = R.coverageFor(view.grid, ids, d);
      if (cfg.minOnDuty && c.G + c.M + c.E + c.N < cfg.minOnDuty) n++;
    }
    return n;
  }, [view, days, cfg]);
  const me = window.__UNICO_USER__ && (window.__UNICO_USER__.name || window.__UNICO_USER__.username) || '';
  const deptName = K.deptName ? K.deptName(dept) : dept;
  const html = useMemo(() => {
    if (!doc || !K.printHtml) return '';
    const def = K.signNames ? K.signNames(doc, extra.signers) : null;
    let signPeople;
    if (def) {
      const role = {
        prepared: 'In-charge, ' + deptName,
        checked: 'Nurse Manager',
        approved: 'Chief of Nursing Services'
      };
      const byName = nm => {
        const k = String(nm || '').trim().toLowerCase();
        return k ? (staff || []).find(e => e && !e.former && String(e.name || '').trim().toLowerCase() === k) : null;
      };
      signPeople = {};
      ['prepared', 'checked', 'approved'].forEach(k => {
        const e = byName(def[k]);
        signPeople[k] = e ? {
          name: e.name,
          line: K.signLine(e) || role[k]
        } : {
          name: def[k],
          line: role[k]
        };
      });
    }
    return K.printHtml({
      dept,
      deptName,
      year,
      month,
      doc,
      rows: view.rows,
      grid: view.grid,
      signers: extra.signers,
      signPeople,
      colourDesign: false,
      summary: true,
      cards: true,
      legend: true,
      printedBy: me
    });
  }, [doc, view, extra, dept, deptName, year, month, me, staff]);
  const st = K.statusNorm(doc ? doc.status : null);
  const can = extra.can || {};
  const failing = ev ? ev.rules.filter(r => r[2].length) : [];
  const clear = ev ? ev.rules.filter(r => !r[2].length) : [];
  const nMarks = Object.keys(doc && doc.marks || {}).reduce((a, k) => a + Object.keys(doc.marks[k] || {}).length, 0);
  const alNoDate = people.reduce((a, p) => a + p.alNoDate, 0);
  const flagged = people.filter(p => p.flags.length).length;
  const deciding = !!(can.approve || can.forward);
  const roleLine = can.approve ? 'You are approving as the CNS' : can.forward ? 'You are checking as the Manager' : can.send ? 'You prepare this roster' : '';
  const checks = [['cover', 'Daily cover checked', lowDays ? lowDays + ' day' + (lowDays === 1 ? '' : 's') + ' below the minimum' : 'every day meets the minimum', !!lowDays, () => setTab('cover')], ['leave', 'Leave & AL dates checked', alNoDate ? alNoDate + ' AL without an in-lieu date' : 'all AL dated', !!alNoDate, () => {
    setTab('people');
  }], ['hours', 'Hours & nights checked', flagged ? flagged + ' staff flagged' : 'nobody flagged', !!flagged, () => setTab('people')], ['notes', 'Review notes settled', nMarks ? nMarks + ' note' + (nMarks === 1 ? '' : 's') + ' still open' : 'no open notes', !!nMarks, () => {
    setTab('sheet');
    setFilter('flagged');
  }], ['sign', 'Sign-off names correct', 'Prepared / Checked / Approved on the official sheet', false, () => setTab('doc')]];
  const done = checks.filter(c => ticks[c[0]]).length;
  const allTicked = done === checks.length;
  const decide = action => {
    if ((action === 'approve' || action === 'forward') && !allTicked) {
      K.toast('Tick the review checklist first — ' + (checks.length - done) + ' left.', 'info');
      if (checkRef.current) checkRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      return;
    }
    const note = action === 'return' && nMarks ? nMarks + ' cell' + (nMarks === 1 ? '' : 's') + ' marked on the sheet — see the review notes.' : '';
    onDecide({
      ...row,
      id: doc && doc.id || row.id
    }, action, {
      note
    }).then(r => {
      if (r && r.ok) {
        setTicks({});
        load();
      }
    });
  };
  const post = (path, body) => {
    setActing(true);
    return K.api.post('/api/rosters/' + encodeURIComponent(doc.id) + path, body).then(r => {
      setActing(false);
      return r;
    }).catch(() => {
      setActing(false);
      return {
        ok: false,
        error: 'Could not reach the server.'
      };
    });
  };
  const onMark = (empId, d, note) => post('/marks', {
    empId,
    day: d,
    note
  }).then(r => {
    if (take(r)) {
      K.toast('Note pinned for the in-charge.');
      setCell(null);
    }
  });
  const onUnmark = (empId, d) => post('/marks', {
    empId,
    day: d,
    remove: true
  }).then(r => {
    if (take(r)) {
      K.toast('Note removed.');
      setCell(null);
    }
  });
  const onEdit = (empId, d, code, before) => post('/review-edit', {
    empId,
    day: d,
    code,
    baseRevision: doc.revision || 0
  }).then(r => {
    if (take(r)) {
      K.toast((before || '—') + ' → ' + (code || '—') + ' saved and logged.');
      setCell(null);
    } else if (r && r.conflict) load();
  });
  const openCell = (r, d, rect) => setCell({
    r,
    d,
    rect,
    code: (view.grid[r.empId] || {})[d] || '',
    was: (() => {
      const c = changes.find(x => x.empId === r.empId && x.d === d);
      return c ? c.from : undefined;
    })()
  });
  const pointAt = f => {
    setFocus(riFocusOf(f, view.rows));
    setPerson('');
    setFilter('all');
    setTab('sheet');
    setTimeout(() => {
      if (sheetRef.current) sheetRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 30);
  };
  const d2 = d => String(d).padStart(2, '0') + ' ' + R.MONTHS[month].slice(0, 3) + ' ' + year;
  const TABS = [['sheet', 'Review sheet', nMarks], ['doc', 'Official document', 0], ['people', 'People', flagged], ['changes', 'Changes', changes.length], ['cover', 'Daily cover', lowDays]];
  const seg = on => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    padding: '7px 13px',
    borderRadius: 9,
    border: 0,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 12.5,
    fontWeight: on ? 800 : 600,
    color: on ? '#fff' : '#3c4858',
    background: on ? '#0d3a5c' : 'transparent'
  });
  const badge = (n, on) => n ? React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 800,
      padding: '1px 7px',
      borderRadius: 9,
      background: on ? 'rgba(255,255,255,.22)' : 'rgba(210,58,82,.12)',
      color: on ? '#fff' : '#b4232f'
    }
  }, n) : null;
  const pill = on => ({
    padding: '4px 11px',
    borderRadius: 14,
    border: '1px solid ' + (on ? '#0d3a5c' : 'rgba(125,145,180,.35)'),
    background: on ? '#0d3a5c' : '#fff',
    color: on ? '#fff' : '#3c4858',
    fontSize: 11.5,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit'
  });
  const nameOf = id => (view.rows.find(r => r.empId === id) || {}).name || id;
  const chg = {};
  changes.forEach(c => {
    (chg[c.empId] || (chg[c.empId] = [])).push(c);
  });
  const vLabel = v => 'rev ' + v.revision + ' · ' + (K.ROS_HIST_LABEL ? K.ROS_HIST_LABEL[v.action] || v.action || '' : v.action || '') + ' · ' + K.when(v.at) + (v.byName ? ' · ' + v.byName : '');
  return React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, React.createElement("div", {
    style: RI_CARD
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      flexWrap: 'wrap'
    }
  }, React.createElement("button", {
    className: "btn sm",
    type: "button",
    onClick: onBack
  }, "\u2039 Back"), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 220
    }
  }, React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 800,
      color: '#0d1b2e',
      letterSpacing: -.2
    }
  }, deptName), React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: '#0072a3',
      fontWeight: 700
    }
  }, R.MONTHS[month], " ", year, " ", React.createElement("span", {
    style: {
      color: '#8a97a8',
      fontWeight: 500
    }
  }, "\xB7 ", d2(1), " \u2013 ", d2(days), doc ? ' · rev ' + (doc.revision || 0) : '')), doc && React.createElement("div", {
    style: {
      fontSize: 11,
      color: '#8a97a8',
      marginTop: 1
    }
  }, doc.updatedBy ? 'Last saved by ' + doc.updatedBy + ' · ' + K.when(doc.updatedAt) : '')), React.createElement(K.RosStatusChip, {
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
  }, "Print / PDF")), doc && React.createElement(RiTracker, {
    doc: doc,
    signers: extra.signers
  })), err && React.createElement("div", {
    style: {
      ...RI_CARD,
      color: '#b4232f',
      fontSize: 12.5
    }
  }, err), doc && React.createElement("div", {
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
      ...RI_CARD,
      padding: 0,
      display: 'grid',
      gridTemplateColumns: 'repeat(5,1fr)'
    },
    className: "ri-sum"
  }, [['Staff', view.rows.length, stats.pca ? view.rows.length - stats.pca + ' nurses · ' + stats.pca + ' PCA' : 'on the sheet', '#0d1b2e', () => setTab('people')], ['Duty shifts', stats.shifts, lowDays ? lowDays + ' low day' + (lowDays === 1 ? '' : 's') : 'cover met every day', lowDays ? '#b5670a' : '#0072a3', () => setTab('cover')], ['Total hours', stats.hours, stats.over ? stats.over + ' over ' + RI_OVERTIME_H + ' h' : 'nobody over ' + RI_OVERTIME_H + ' h', stats.over ? '#b5670a' : '#5b45c4', () => setTab('people')], ['Changes', changes.length, cmpRev != null ? 'since rev ' + cmpRev : 'first version', changes.length ? '#0072a3' : '#9aa6b4', () => setTab('changes')], ['Rule warnings', ev ? ev.totalViol : 0, failing.length ? failing.length + ' rule' + (failing.length === 1 ? '' : 's') + ' not met' : 'all rules met', ev && ev.totalViol ? '#b4232f' : '#157a43', () => {
    if (rulesRef.current) rulesRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }]].map(([l, v, sub, c, onClick], i) => React.createElement("div", {
    key: l,
    onClick: onClick,
    style: {
      padding: '11px 16px',
      borderLeft: i ? '1px solid rgba(125,145,180,.18)' : 0,
      cursor: 'pointer'
    }
  }, React.createElement("div", {
    style: RI_CAP
  }, l), React.createElement("div", {
    style: {
      fontFamily: "'IBM Plex Mono',monospace",
      fontSize: 20,
      fontWeight: 700,
      color: c,
      lineHeight: 1.2
    }
  }, v), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: '#8a97a8',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, sub)))), ev && React.createElement("div", {
    ref: rulesRef,
    style: RI_CARD
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: failing.length ? 8 : 0,
      flexWrap: 'wrap'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 800,
      color: '#16202e'
    }
  }, "Rule checks"), React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      padding: '2px 9px',
      borderRadius: 10,
      color: failing.length ? '#b4232f' : '#157a43',
      background: failing.length ? 'rgba(210,58,82,.1)' : 'rgba(31,157,87,.12)'
    }
  }, failing.length ? failing.length + ' need attention' : 'all clear'), failing.length > 0 && React.createElement("span", {
    style: {
      fontSize: 11,
      color: '#8a97a8'
    }
  }, "\xB7 click a warning to see it on the sheet")), failing.map(([rule, base, list]) => {
    const open = !!openRule[rule];
    const shown = open ? list : list.slice(0, 6);
    return React.createElement("div", {
      key: rule,
      style: {
        display: 'flex',
        gap: 12,
        padding: '8px 0',
        borderTop: '1px solid rgba(125,145,180,.14)'
      }
    }, React.createElement("span", {
      style: {
        minWidth: 34,
        height: 22,
        borderRadius: 11,
        display: 'inline-grid',
        placeItems: 'center',
        fontSize: 11,
        fontWeight: 800,
        color: '#fff',
        background: '#d23a52',
        flexShrink: 0
      }
    }, list.length), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        fontSize: 12.5,
        fontWeight: 700,
        color: '#16202e'
      }
    }, rule, " ", React.createElement("span", {
      style: {
        fontWeight: 500,
        color: '#9aa6b4',
        fontSize: 11
      }
    }, "\xB7 ", base)), React.createElement("div", {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        marginTop: 4
      }
    }, shown.map((f, i) => {
      const on = focus && focus.label === f;
      return React.createElement("button", {
        type: "button",
        key: i,
        onClick: () => on ? setFocus(null) : pointAt(f),
        style: {
          fontSize: 10.5,
          color: on ? '#fff' : '#8c1d2a',
          background: on ? '#b4232f' : 'rgba(210,58,82,.07)',
          border: '1px solid rgba(210,58,82,.2)',
          borderRadius: 6,
          padding: '1px 7px',
          cursor: 'pointer',
          fontFamily: 'inherit'
        }
      }, f);
    }), list.length > 6 && React.createElement("button", {
      type: "button",
      onClick: () => setOpenRule(o => ({
        ...o,
        [rule]: !open
      })),
      style: {
        border: 0,
        background: 'none',
        color: '#0072a3',
        fontSize: 10.5,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit'
      }
    }, open ? 'Show less' : '+' + (list.length - 6) + ' more'))));
  }), clear.length > 0 && React.createElement("div", {
    style: {
      borderTop: failing.length ? '1px solid rgba(125,145,180,.14)' : 0,
      paddingTop: 8
    }
  }, React.createElement("button", {
    type: "button",
    onClick: () => setShowClear(v => !v),
    style: {
      border: 0,
      background: 'none',
      padding: 0,
      cursor: 'pointer',
      fontFamily: 'inherit',
      fontSize: 12,
      fontWeight: 700,
      color: '#157a43'
    }
  }, "\u2713 ", clear.length, " rule", clear.length === 1 ? '' : 's', " clear ", showClear ? '▴' : '▾'), showClear && React.createElement("div", {
    style: {
      marginTop: 6,
      display: 'flex',
      flexDirection: 'column',
      gap: 3
    }
  }, clear.map(([rule, base]) => React.createElement("div", {
    key: rule,
    style: {
      fontSize: 11.5,
      color: '#3c4858'
    }
  }, React.createElement("span", {
    style: {
      color: '#1f9d57',
      fontWeight: 800
    }
  }, "\u2713"), " ", rule, " ", React.createElement("span", {
    style: {
      color: '#9aa6b4'
    }
  }, "\xB7 ", base)))))), React.createElement("div", {
    ref: sheetRef,
    style: RI_CARD
  }, React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      flexWrap: 'wrap',
      padding: 4,
      background: '#f1f4f8',
      borderRadius: 11,
      marginBottom: 12
    }
  }, TABS.map(([id, label, n]) => React.createElement("button", {
    key: id,
    type: "button",
    onClick: () => setTab(id),
    style: seg(tab === id)
  }, label, badge(n, tab === id)))), tab === 'sheet' && React.createElement("div", null, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
      marginBottom: 10
    }
  }, [['all', 'Everyone'], ['flagged', 'Flagged'], ['changed', 'Changed']].map(([id, l]) => React.createElement("button", {
    key: id,
    type: "button",
    onClick: () => {
      setFilter(id);
      setPerson('');
    },
    style: pill(!person && filter === id)
  }, l)), person && React.createElement("button", {
    type: "button",
    onClick: () => setPerson(''),
    style: pill(true)
  }, nameOf(person), " \u2715"), focus && React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 11.5,
      fontWeight: 700,
      color: '#8a5a00',
      background: '#fff3c4',
      border: '1px solid #f0d27a',
      borderRadius: 14,
      padding: '3px 10px'
    }
  }, "Showing: ", focus.label, React.createElement("button", {
    type: "button",
    onClick: () => setFocus(null),
    style: {
      border: 0,
      background: 'none',
      cursor: 'pointer',
      fontWeight: 800,
      color: '#8a5a00'
    }
  }, "\u2715")), React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontSize: 11,
      color: '#8a97a8'
    }
  }, can.mark || can.reviewEdit ? 'Click a cell to pin a note' + (can.reviewEdit ? ' or change the shift' : '') : 'Click a cell for its details')), React.createElement(RiGrid, {
    view: view,
    year: year,
    month: month,
    doc: doc,
    changes: changes,
    focus: focus,
    filter: filter,
    person: person,
    onCell: openCell,
    flagsOf: id => flagsBy[id] || []
  }), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16,
      flexWrap: 'wrap',
      marginTop: 8,
      fontSize: 10.5,
      color: '#6c7a8c'
    }
  }, React.createElement("span", null, React.createElement("i", {
    style: {
      display: 'inline-block',
      width: 12,
      height: 10,
      background: '#d9dde3',
      verticalAlign: -1,
      marginRight: 4
    }
  }), "Day off"), React.createElement("span", null, React.createElement("i", {
    style: {
      display: 'inline-block',
      width: 12,
      height: 10,
      background: '#eef0f3',
      verticalAlign: -1,
      marginRight: 4
    }
  }), "Leave"), React.createElement("span", null, React.createElement("i", {
    style: {
      display: 'inline-block',
      width: 12,
      height: 10,
      boxShadow: 'inset 0 0 0 2px #0090ca',
      verticalAlign: -1,
      marginRight: 4
    }
  }), "Changed", cmpRev != null ? ' since rev ' + cmpRev : ''), React.createElement("span", null, React.createElement("i", {
    style: {
      display: 'inline-block',
      width: 0,
      height: 0,
      borderTop: '9px solid #d23a52',
      borderRight: '9px solid transparent',
      verticalAlign: -1,
      marginRight: 4
    }
  }), "Review note"), React.createElement("span", null, React.createElement("i", {
    style: {
      display: 'inline-block',
      width: 12,
      height: 10,
      background: '#fff3c4',
      verticalAlign: -1,
      marginRight: 4
    }
  }), "Warning you picked"))), tab === 'doc' && (html ? React.createElement(RiSheetFrame, {
    html: html
  }) : React.createElement(K.RosSheetTable, {
    rows: view.rows,
    grid: view.grid,
    year: year,
    month: month,
    maxHeight: "56vh"
  })), tab === 'people' && React.createElement("div", {
    style: {
      overflowX: 'auto'
    }
  }, React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 12
    }
  }, React.createElement("thead", null, React.createElement("tr", null, ['Staff', 'Hours', 'G', 'M', 'E', 'N', 'Nights in a row', 'Off', 'Fridays off', 'Leave', 'On call', 'Flags'].map(h => React.createElement("th", {
    key: h,
    style: {
      ...RI_TH,
      textAlign: h === 'Staff' || h === 'Flags' ? 'left' : 'center'
    }
  }, h)))), React.createElement("tbody", null, people.slice().sort((a, b) => b.flags.length - a.flags.length || String(a.r.name).localeCompare(String(b.r.name))).map(p => React.createElement("tr", {
    key: p.r.empId,
    onClick: () => {
      setPerson(p.r.empId);
      setFocus(null);
      setTab('sheet');
    },
    style: {
      cursor: 'pointer',
      background: p.flags.length ? 'rgba(210,58,82,.04)' : 'transparent'
    }
  }, React.createElement("td", {
    style: RI_TD
  }, React.createElement("b", {
    style: {
      color: '#16202e'
    }
  }, p.r.name), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: '#8a97a8'
    }
  }, p.r.desig || '')), [p.t.hours, p.t.G, p.t.M, p.t.E, p.t.N, p.maxRun, p.offs, p.friOff, p.t.leave, p.ocN].map((v, i) => React.createElement("td", {
    key: i,
    style: {
      ...RI_TD,
      textAlign: 'center',
      fontFamily: "'IBM Plex Mono',monospace",
      fontWeight: i === 0 ? 800 : 500,
      color: i === 0 && v > RI_OVERTIME_H || i === 5 && cfg.maxNights && v > cfg.maxNights ? '#b4232f' : '#16202e'
    }
  }, v || (i === 0 ? 0 : '·'))), React.createElement("td", {
    style: RI_TD
  }, p.flags.length ? p.flags.map(f => React.createElement("span", {
    key: f,
    style: {
      display: 'inline-block',
      margin: '1px 4px 1px 0',
      fontSize: 10.5,
      fontWeight: 700,
      color: '#8c1d2a',
      background: 'rgba(210,58,82,.09)',
      borderRadius: 6,
      padding: '1px 7px'
    }
  }, f)) : React.createElement("span", {
    style: {
      color: '#157a43',
      fontWeight: 700
    }
  }, "\u2713")))))), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: '#8a97a8',
      marginTop: 6
    }
  }, "Click a person to see only their row on the review sheet.")), tab === 'changes' && React.createElement("div", null, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
      marginBottom: 10
    }
  }, React.createElement("span", {
    style: {
      fontSize: 12,
      color: '#3c4858'
    }
  }, "Compare the sheet now with"), React.createElement("select", {
    value: cmpRev == null ? '' : String(cmpRev),
    onChange: e => setCmpRev(e.target.value === '' ? null : Number(e.target.value)),
    style: {
      padding: '6px 9px',
      borderRadius: 8,
      border: '1px solid rgba(125,145,180,.4)',
      fontFamily: 'inherit',
      fontSize: 12
    }
  }, !versions.length && React.createElement("option", {
    value: ""
  }, "no earlier version"), versions.filter(v => v.revision < docRev || v.revision === cmpRev).map(v => React.createElement("option", {
    key: v.revision,
    value: v.revision
  }, vLabel(v)))), changes.length > 0 && React.createElement("button", {
    type: "button",
    className: "btn sm",
    onClick: () => {
      setFilter('changed');
      setPerson('');
      setTab('sheet');
    }
  }, "Show on the sheet")), cmpRev == null ? React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: '#8a97a8',
      padding: '10px 2px'
    }
  }, "This is the first version sent for review \u2014 there is nothing earlier to compare with.") : !changes.length ? React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: '#157a43',
      padding: '10px 2px',
      fontWeight: 700
    }
  }, "\u2713 No shift changed since rev ", cmpRev, ".") : Object.keys(chg).map(id => React.createElement("div", {
    key: id,
    style: {
      borderTop: '1px solid rgba(125,145,180,.14)',
      padding: '8px 0'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 800,
      color: '#16202e',
      marginBottom: 4
    }
  }, nameOf(id), " ", React.createElement("span", {
    style: {
      fontWeight: 500,
      color: '#8a97a8',
      fontSize: 11
    }
  }, "\xB7 ", chg[id].length, " change", chg[id].length === 1 ? '' : 's')), React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 5
    }
  }, chg[id].map(c => React.createElement("span", {
    key: c.d,
    style: {
      fontSize: 11,
      color: '#0d3a5c',
      background: 'rgba(0,144,202,.08)',
      border: '1px solid rgba(0,144,202,.22)',
      borderRadius: 7,
      padding: '2px 8px',
      fontFamily: "'IBM Plex Mono',monospace"
    }
  }, riDay(year, month, c.d), ": ", c.from || '—', " \u2192 ", React.createElement("b", null, c.to || '—')))))), (doc.history || []).some(h => h.action === 'edit') && React.createElement("div", {
    style: {
      marginTop: 10,
      fontSize: 11.5,
      color: '#6c7a8c'
    }
  }, React.createElement("div", {
    style: {
      ...RI_CAP,
      marginBottom: 4
    }
  }, "Changed during review"), (doc.history || []).filter(h => h.action === 'edit').slice(-12).reverse().map((h, i) => React.createElement("div", {
    key: i
  }, "\u2022 ", h.note, " ", React.createElement("span", {
    style: {
      color: '#9aa6b4'
    }
  }, "\u2014 ", h.byName || h.by, ", ", K.when(h.at)))))), tab === 'cover' && React.createElement(RiCover, {
    view: view,
    year: year,
    month: month,
    minOnDuty: cfg.minOnDuty
  }))), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      position: 'sticky',
      top: 12
    }
  }, deciding && React.createElement("div", {
    ref: checkRef,
    style: RI_CARD
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8
    }
  }, React.createElement("div", {
    style: RI_CAP
  }, "Review checklist"), React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontSize: 11,
      fontWeight: 800,
      color: allTicked ? '#157a43' : '#b5670a'
    }
  }, done, " of ", checks.length)), React.createElement("div", {
    style: {
      height: 4,
      borderRadius: 2,
      background: '#eef1f5',
      marginBottom: 8
    }
  }, React.createElement("div", {
    style: {
      height: 4,
      borderRadius: 2,
      width: done / checks.length * 100 + '%',
      background: allTicked ? '#1f9d57' : '#e0a81e',
      transition: 'width .2s'
    }
  })), checks.map(([id, label, sub, warn, go]) => React.createElement("label", {
    key: id,
    style: {
      display: 'flex',
      gap: 9,
      alignItems: 'flex-start',
      padding: '6px 2px',
      cursor: 'pointer',
      borderTop: '1px solid rgba(125,145,180,.1)'
    }
  }, React.createElement("input", {
    type: "checkbox",
    checked: !!ticks[id],
    onChange: e => setTicks(t => ({
      ...t,
      [id]: e.target.checked
    })),
    style: {
      marginTop: 2
    }
  }), React.createElement("span", {
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
  }, label), React.createElement("span", {
    style: {
      fontSize: 10.5,
      color: warn ? '#b5670a' : '#8a97a8'
    }
  }, warn ? '⚠ ' : '', sub, " \xB7 ", React.createElement("a", {
    onClick: e => {
      e.preventDefault();
      go();
    },
    href: "#",
    style: {
      color: '#0072a3',
      fontWeight: 700
    }
  }, "look")))))), React.createElement("div", {
    style: {
      ...RI_CARD,
      borderTop: '3px solid ' + (st === 'pending_cns' ? '#5b45c4' : st === 'pending_manager' ? '#0072a3' : st === 'approved' ? '#1f9d57' : st === 'returned' ? '#d23a52' : '#b5670a')
    }
  }, React.createElement("div", {
    style: RI_CAP
  }, "Your decision"), roleLine && React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: '#16202e',
      marginTop: 4
    }
  }, roleLine), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: '#6c7a8c',
      marginTop: 3
    }
  }, doc.sentAt && riSentShown(st) ? 'Sent ' + K.when(doc.sentAt) + ' by ' + (doc.sentByName || doc.sentBy || '—') : 'With the in-charge — not sent for review yet'), deciding && !allTicked && React.createElement("div", {
    style: {
      marginTop: 10,
      fontSize: 11.5,
      color: '#8a5a00',
      background: 'rgba(224,138,30,.09)',
      border: '1px solid rgba(224,138,30,.28)',
      borderRadius: 9,
      padding: '7px 10px'
    }
  }, "\uD83D\uDD12 ", can.approve ? 'Approve' : 'Forward', " unlocks when the checklist is ticked (", checks.length - done, " left)."), nMarks > 0 && React.createElement("div", {
    style: {
      marginTop: 8,
      fontSize: 11.5,
      color: '#8c1d2a'
    }
  }, nMarks, " review note", nMarks === 1 ? '' : 's', " pinned \u2014 Return sends them to the in-charge."), React.createElement("div", {
    className: "ri-dec",
    style: {
      marginTop: 12,
      opacity: busy ? .7 : 1
    }
  }, K.RosDecisionButtons({
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
  }, st === 'approved' ? 'Approved — this roster is published.' : 'No step for you on this roster right now.')), can.reviewEdit && React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: '#9aa6b4',
      marginTop: 8
    }
  }, "Small fixes: click a cell and change it directly \u2014 it is logged. Bigger ones: pin notes and Return.")), nMarks > 0 && K.RosMarkList && React.createElement("div", {
    style: {
      ...RI_CARD,
      padding: '10px 12px'
    }
  }, React.createElement(K.RosMarkList, {
    marks: doc.marks,
    rows: view.rows,
    year: year,
    month: month,
    canDone: !!(can.mark || can.markDone),
    onDone: onUnmark,
    onOpen: (emp, d) => {
      const r = view.rows.find(x => x.empId === emp);
      if (r) {
        setTab('sheet');
        setPerson(emp);
      }
    }
  })), React.createElement("div", {
    style: RI_CARD
  }, React.createElement("div", {
    style: {
      ...RI_CAP,
      marginBottom: 10
    }
  }, "Activity"), React.createElement("div", {
    style: {
      maxHeight: 360,
      overflowY: 'auto'
    }
  }, React.createElement(K.RosHistoryTimeline, {
    history: doc.history
  }))))), cell && doc && React.createElement(RiCellPop, {
    cell: cell,
    doc: doc,
    year: year,
    month: month,
    can: can,
    busy: acting,
    onClose: () => setCell(null),
    onMark: onMark,
    onUnmark: onUnmark,
    onEdit: onEdit
  }), !doc && !err && React.createElement("div", {
    style: {
      ...RI_CARD,
      textAlign: 'center',
      padding: 34,
      color: '#6c7a8c',
      fontSize: 12.5
    }
  }, row.hasSheet ? 'Loading the sheet…' : 'Nobody has started this unit’s ' + R.MONTHS[month] + ' ' + year + ' roster yet.'));
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
  const onDecide = (row, action, opts) => decider.run({
    id: row.id,
    action,
    unit: row.deptName,
    period,
    warnings: 0,
    note: opts && opts.note
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
  useMemo,
  useRef
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
  const pickRef = useRef(null);
  const [pickBox, setPickBox] = useState(null);
  useEffect(() => {
    if (!pickOpen) return undefined;
    const place = () => {
      const el = pickRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        setPickBox({
          left: r.left,
          top: r.bottom + 4,
          width: Math.max(r.width, 300)
        });
      }
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [pickOpen]);
  const pickOne = e => {
    setSel(String(e.id));
    setPickOpen(false);
    setQ('');
    if (pickRef.current) pickRef.current.blur();
  };
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
    ref: pickRef,
    value: pickOpen ? q : person ? person.name + (person.emp_id ? ' · ' + person.emp_id : '') : q,
    onFocus: () => {
      setPickOpen(true);
      setQ('');
    },
    onBlur: () => setTimeout(() => setPickOpen(false), 150),
    onKeyDown: e => {
      if (e.key === 'Enter' && matches.length) {
        e.preventDefault();
        pickOne(matches[0]);
      }
      if (e.key === 'Escape') {
        setPickOpen(false);
        e.currentTarget.blur();
      }
    },
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
  }), pickOpen && pickBox && K.portal(React.createElement("div", {
    style: {
      position: 'fixed',
      left: pickBox.left,
      top: pickBox.top,
      width: pickBox.width,
      background: '#fff',
      border: '1px solid rgba(125,145,180,.3)',
      borderRadius: 10,
      boxShadow: '0 16px 40px rgba(16,32,46,.18)',
      zIndex: 9500,
      maxHeight: 340,
      overflow: 'auto'
    }
  }, !matches.length && React.createElement("div", {
    style: {
      padding: '12px 14px',
      fontSize: 12,
      color: '#6c7a8c',
      lineHeight: 1.5
    }
  }, staff.length ? React.createElement(React.Fragment, null, "No one matches \u201C", q.trim(), "\u201D. Search by name, employee number or unit.") : 'No staff are on the units you can roster.'), matches.map(e => React.createElement("div", {
    key: e.id,
    onMouseDown: ev => {
      ev.preventDefault();
      pickOne(e);
    },
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      padding: '7px 12px',
      cursor: 'pointer',
      borderBottom: '1px solid rgba(125,145,180,.1)'
    }
  }, React.createElement(MK.Av, {
    name: e.name,
    emp: e,
    empId: e.emp_id,
    size: 26
  }), React.createElement("div", {
    style: {
      minWidth: 0
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
  }, [e.emp_id, e.designation, e.current_department].filter(Boolean).join(' · ')))))))), React.createElement("span", {
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
  const store = K.useRosterStaff();
  const [supQ, setSupQ] = useState('');
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
      depts: d,
      supervisors: (c.supervisors || []).map(x => String(x.id))
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
    const list = people.filter(u => u.rosterRole === 'admin' || (role === 'cns' ? u.rosterRole === 'cns' : u.rosterRole === 'incharge' || u.rosterRole === 'manager'));
    const covers = u => (u.rosterDepartments || []).indexOf(deptId) >= 0;
    const rank = u => u.rosterRole === role ? 0 : u.rosterRole === 'admin' ? 2 : 1;
    const sorted = list.slice().sort((a, b) => rank(a) - rank(b) || covers(b) - covers(a) || String(a.name).localeCompare(String(b.name)));
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
      depts: {},
      supervisors: draft.supervisors || []
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
  }, u.name, u.desig ? ' · ' + u.desig : u.rosterRole === 'admin' ? ' · Administrator' : u.title ? ' · ' + u.title : '')));
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
  }, "Accounts with a roster role: ", React.createElement("b", null, nRole('cns')), " CNS \xB7 ", React.createElement("b", null, nRole('manager')), " Manager \xB7 ", React.createElement("b", null, nRole('incharge')), " In-charge. Someone missing from a list? Give their account a ", React.createElement("b", null, "Duty roster role"), " under Users & Roles \u2192 Manage. People whose roster units include a department are listed first for it."))), (() => {
    const staffAll = (store.staff || []).filter(e => e && e.id != null && e.is_active !== false && !e.former);
    const byId = {};
    staffAll.forEach(e => {
      byId[String(e.id)] = e;
    });
    (cfg.supervisors || []).forEach(x => {
      if (!byId[String(x.id)]) byId[String(x.id)] = x;
    });
    const sel = draft.supervisors || [];
    const setSel = next => setDraft(d => ({
      ...d,
      supervisors: next
    }));
    const n = supQ.trim().toLowerCase();
    const hits = n ? staffAll.filter(e => sel.indexOf(String(e.id)) < 0 && [e.name, e.emp_id, e.current_department, e.designation].join(' ').toLowerCase().indexOf(n) >= 0).slice(0, 8) : [];
    return React.createElement("div", {
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
    }, "Nursing Supervisors"), React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: '#5b45c4',
        background: 'rgba(106,82,212,.1)',
        borderRadius: 10,
        padding: '2px 9px'
      }
    }, sel.length, " member", sel.length === 1 ? '' : 's'), React.createElement("span", {
      className: "sub",
      style: {
        flex: 1,
        minWidth: 260
      }
    }, "Who does supervisor duty. They stay on their ward roster and also appear on the ", React.createElement("b", null, "Nursing Supervisors"), " roster; set its In-charge in the table below.")), React.createElement("div", {
      className: "card-b",
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap'
      }
    }, !sel.length && React.createElement("span", {
      className: "sub"
    }, "No supervisors picked yet."), sel.map(id => {
      const e = byId[id] || {
        name: 'Staff #' + id
      };
      return React.createElement("span", {
        key: id,
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          border: '1px solid rgba(106,82,212,.3)',
          background: 'rgba(106,82,212,.06)',
          borderRadius: 16,
          padding: '3px 6px 3px 10px',
          fontSize: 12
        }
      }, React.createElement("b", {
        style: {
          fontWeight: 700,
          color: '#16202e'
        }
      }, e.name), React.createElement("span", {
        style: {
          color: '#8a97a8',
          fontSize: 11
        }
      }, [e.emp_id, e.current_department].filter(Boolean).join(' · ')), React.createElement("button", {
        type: "button",
        title: "Remove",
        onClick: () => setSel(sel.filter(x => x !== id)),
        style: {
          border: 0,
          background: 'rgba(106,82,212,.12)',
          color: '#5b45c4',
          borderRadius: '50%',
          width: 18,
          height: 18,
          cursor: 'pointer',
          fontSize: 12,
          lineHeight: '18px',
          padding: 0
        }
      }, "\xD7"));
    })), React.createElement("div", {
      style: {
        position: 'relative',
        maxWidth: 460
      }
    }, React.createElement("input", {
      value: supQ,
      onChange: e => setSupQ(e.target.value),
      placeholder: "Add a supervisor \u2014 name, emp no or unit\u2026",
      style: {
        width: '100%',
        boxSizing: 'border-box',
        padding: '8px 11px',
        borderRadius: 9,
        border: '1px solid rgba(125,145,180,.4)',
        fontFamily: 'inherit',
        fontSize: 12.5
      }
    }), n && React.createElement("div", {
      style: {
        marginTop: 4,
        border: '1px solid rgba(125,145,180,.3)',
        borderRadius: 10,
        background: '#fff',
        overflow: 'hidden'
      }
    }, !hits.length && React.createElement("div", {
      className: "sub",
      style: {
        padding: 10
      }
    }, "No one matches."), hits.map(e => React.createElement("div", {
      key: e.id,
      onClick: () => {
        setSel(sel.concat([String(e.id)]));
        setSupQ('');
      },
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 11px',
        cursor: 'pointer',
        borderBottom: '1px solid rgba(125,145,180,.1)'
      }
    }, React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("span", {
      style: {
        display: 'block',
        fontSize: 12.5,
        fontWeight: 600,
        color: '#16202e'
      }
    }, e.name), React.createElement("span", {
      style: {
        display: 'block',
        fontSize: 10.5,
        color: '#8a97a8'
      }
    }, [e.emp_id, e.designation, e.current_department].filter(Boolean).join(' · '))), React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: '#5b45c4'
      }
    }, "+ Add")))))));
  })(), React.createElement("div", {
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
