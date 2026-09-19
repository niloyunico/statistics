/* ===== performance.jsx ===== */
(function(){
const {
  useState,
  useEffect,
  useMemo,
  useRef
} = React;
const Ic = window.Ic,
  I = window.I;
const A = window.UNICO_APPRAISAL;
const MK = window.MK;
const perfApi = {
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
const perfToast = (m, t) => {
  try {
    window.UI && window.UI.toast && window.UI.toast(m, t || 'success');
  } catch (e) {}
};
const perfIsAdmin = () => {
  try {
    const u = window.__UNICO_USER__;
    return !u || u.role === 'Administrator';
  } catch (e) {
    return true;
  }
};
const perfCan = a => {
  try {
    return window.unicoCan ? window.unicoCan('perf', a) : true;
  } catch (e) {
    return true;
  }
};
const todayISO = () => {
  try {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  } catch (e) {
    return '';
  }
};
const perfPortal = node => {
  try {
    if (typeof ReactDOM !== 'undefined' && ReactDOM.createPortal) return ReactDOM.createPortal(node, document.body);
  } catch (e) {}
  return node;
};
const initials = n => String(n || '').split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const roleOf = e => {
  const r = String(e && e.role || '').trim().toUpperCase();
  if (r) return r === 'PCA' ? 'PCA' : 'Nurse';
  return /patient\s*care|pca/i.test(String(e && e.designation || '')) ? 'PCA' : 'Nurse';
};
const isPcaRow = r => (r && r.role ? r.role : roleOf(r && r.emp)) === 'PCA';
const gradeColor = g => MK.GC[g] || '#5b6b80';
function GradePill({
  grade,
  score,
  size
}) {
  return React.createElement("span", {
    style: Object.assign({}, MK.gchip(grade, size === 'lg'), {
      gap: 6
    })
  }, grade || '—', score != null && React.createElement("span", {
    style: {
      opacity: .75
    }
  }, score));
}
const STATUS_META = {
  none: {
    label: 'Not started'
  },
  draft: {
    label: 'In progress'
  },
  submitted: {
    label: 'Awaiting discussion'
  },
  discussed: {
    label: 'Awaiting Part H'
  },
  actioned: {
    label: 'Actioned'
  }
};
function StatusChip({
  st
}) {
  const label = (STATUS_META[st || 'none'] || STATUS_META.none).label;
  return React.createElement("span", {
    style: MK.stChip(label)
  }, label);
}
const DEFAULT_CAPS = {
  bonus: A.BONUS_CAP,
  penalty: A.PENALTY_CAP
};
const capsOf = perf => {
  const c = perf && perf.caps || {};
  const n = (v, fb) => Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : fb;
  return {
    bonus: n(c.bonus, A.BONUS_CAP),
    penalty: n(c.penalty, A.PENALTY_CAP)
  };
};
const PREFETCH_MAX_AGE = 20000;
let prefetched = null;
function prefetchPerf() {
  prefetched = {
    at: Date.now(),
    promise: perfApi.get('/api/performance').catch(() => null)
  };
  return prefetched.promise;
}
function takePrefetched() {
  const p = prefetched;
  prefetched = null;
  return p && Date.now() - p.at < PREFETCH_MAX_AGE ? p.promise : null;
}
try {
  prefetchPerf();
} catch (e) {}
function usePerfStore() {
  const [state, setState] = useState({
    appraisals: [],
    incidents: [],
    achievements: [],
    exits: [],
    caps: DEFAULT_CAPS,
    categories: null,
    loading: true,
    error: null
  });
  const load = React.useCallback(opts => {
    const inflight = opts && opts.fresh ? null : takePrefetched();
    return (inflight || perfApi.get('/api/performance')).then(r => {
      if (r && r.ok) setState({
        appraisals: r.appraisals || [],
        incidents: r.incidents || [],
        achievements: r.achievements || [],
        exits: r.exits || [],
        caps: r.caps || DEFAULT_CAPS,
        categories: r.categories || null,
        loading: false,
        error: null
      });else setState(s => ({
        ...s,
        loading: false,
        error: r && r.error || 'Could not load performance records.'
      }));
    }).catch(() => setState(s => ({
      ...s,
      loading: false,
      error: 'Could not reach the server.'
    })));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const patch = fn => setState(st => Object.assign({}, st, fn(st)));
  const put = (list, rec) => {
    const i = list.findIndex(x => x.id === rec.id);
    return i >= 0 ? list.map((x, n) => n === i ? rec : x) : list.concat([rec]);
  };
  const applyResult = r => {
    if (!r || !r.ok) return;
    if (r.appraisal) patch(st => ({
      appraisals: put(st.appraisals, r.appraisal)
    }));
    if (r.incident) patch(st => ({
      incidents: put(st.incidents, r.incident)
    }));
    if (r.achievement) patch(st => ({
      achievements: put(st.achievements, r.achievement)
    }));
    if (r.exit) patch(st => ({
      exits: put(st.exits, r.exit)
    }));
    if (r.categories) patch(() => ({
      categories: r.categories
    }));
  };
  const wrap = (p, okMsg, after) => p.then(r => {
    if (r && r.ok) {
      if (okMsg) perfToast(okMsg);
      applyResult(r);
      if (after) patch(after);
      load({
        fresh: true
      });
      return r;
    }
    perfToast(r && r.error || 'That did not save.', 'error');
    return r;
  }).catch(() => {
    perfToast('Could not reach the server.', 'error');
    return {
      ok: false
    };
  });
  const without = (key, id) => st => ({
    [key]: st[key].filter(x => x.id !== id)
  });
  return {
    ...state,
    reload: () => load({
      fresh: true
    }),
    saveAppraisal: (body, msg) => wrap(perfApi.put('/api/performance/appraisals', body), msg),
    recordAction: (id, body) => wrap(perfApi.post('/api/performance/appraisals/' + id + '/action', body), 'Action recorded. The form is now filed to the personal record.'),
    reopen: id => wrap(perfApi.post('/api/performance/appraisals/' + id + '/reopen', {}), 'Appraisal reopened for correction.'),
    addIncident: body => wrap(perfApi.post('/api/performance/incidents', body), 'Incident recorded. The deduction now shows on the appraisal.'),
    delIncident: id => wrap(perfApi.del('/api/performance/incidents/' + id), 'Entry removed.', without('incidents', id)),
    addAchievement: body => wrap(perfApi.post('/api/performance/achievements', body), 'Achievement recorded. Bonus points are on the current appraisal.'),
    addExit: body => wrap(perfApi.post('/api/performance/exits', body), 'Exit recorded. The attrition figures and the unit roll-up update immediately.'),
    delExit: id => wrap(perfApi.del('/api/performance/exits/' + id), 'Exit record removed.', without('exits', id)),
    delAchievement: id => wrap(perfApi.del('/api/performance/achievements/' + id), 'Entry removed.', without('achievements', id)),
    saveCategories: body => wrap(perfApi.put('/api/performance/categories', body), 'Categories saved.')
  };
}
function useRoster(staffStore, perf) {
  return useMemo(() => {
    const now = new Date();
    const seen = {};
    const list = (staffStore.staff || []).filter(e => {
      if (e.is_active === false || e.former) return false;
      const k = (e.emp_id || String(e.id)) + '|' + String(e.name || '').trim().toLowerCase();
      if (seen[k]) return false;
      seen[k] = 1;
      return true;
    });
    const groupBy = arr => {
      const m = {};
      (arr || []).forEach(x => {
        const k = String(x.empId);
        (m[k] || (m[k] = [])).push(x);
      });
      return m;
    };
    const apprOf = groupBy(perf.appraisals);
    const incOf = groupBy(perf.incidents);
    const achOf = groupBy(perf.achievements);
    const byEmp = {};
    const rows = list.map(e => {
      const empId = e.emp_id || String(e.id);
      const cyc = A.cycleOf(e.doj, now);
      const mineAppr = apprOf[String(empId)] || [];
      const current = mineAppr.find(x => cyc && x.cycleId === cyc.id) || null;
      const earlier = mineAppr.filter(x => x.status !== 'actioned' && !(cyc && x.cycleId === cyc.id)).sort((a, b) => String(b.cycleStart).localeCompare(String(a.cycleStart)))[0] || null;
      const apr = earlier && earlier.status !== 'draft' ? earlier : current || earlier;
      const history = mineAppr.filter(x => x.status === 'actioned').sort((a, b) => String(b.cycleStart).localeCompare(String(a.cycleStart)));
      const last = history[0] || null;
      const regCycle = apr ? apr.cycleId : cyc && cyc.id;
      const inc = (incOf[String(empId)] || []).filter(x => regCycle && x.cycleId === regCycle);
      const ach = (achOf[String(empId)] || []).filter(x => regCycle && x.cycleId === regCycle);
      const firstDue = e.doj ? A.addMonths(A.parseDate(e.doj) || now, 6) : null;
      const neverAppraised = history.length === 0;
      const lastClosed = e.doj ? (A.cyclesSince(e.doj, now, 1) || [])[0] : null;
      const missedClosed = !!(lastClosed && !mineAppr.some(x => x.cycleId === lastClosed.id));
      const row = {
        emp: e,
        empId,
        role: roleOf(e),
        name: e.name,
        designation: e.designation,
        dept: e.current_department,
        doj: e.doj,
        cycle: cyc,
        appraisal: apr,
        status: apr ? apr.status : 'none',
        history,
        last,
        incidents: inc,
        achievements: ach,
        firstDue,
        neverAppraised,
        lastClosed,
        overdue: missedClosed,
        newJoinerDue: !!(neverAppraised && firstDue && firstDue <= now)
      };
      byEmp[empId] = row;
      return row;
    });
    return {
      rows,
      byEmp
    };
  }, [staffStore.staff, perf.appraisals, perf.incidents, perf.achievements]);
}
function Stat({
  label,
  value,
  sub,
  tone,
  icon,
  tint
}) {
  return React.createElement("div", {
    className: "card",
    style: {
      padding: 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, React.createElement("div", {
    style: MK.iconBadge(tint || 'blue')
  }, React.createElement(Ic, {
    d: icon || I.grid,
    s: 18
  })), React.createElement("div", {
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: .5,
      textTransform: 'uppercase',
      color: MK.FAINT
    }
  }, label)), React.createElement("div", {
    className: "num",
    style: {
      fontSize: 28,
      fontWeight: 700,
      color: tone || MK.INK,
      lineHeight: 1,
      letterSpacing: '-.5px'
    }
  }, value), sub && React.createElement("div", {
    style: {
      fontSize: 11,
      color: MK.FAINT
    }
  }, sub));
}
function Bar({
  value,
  max,
  color,
  height
}) {
  const w = max ? value / max * 100 : 0;
  return React.createElement("div", {
    style: MK.track(height || 7)
  }, React.createElement("div", {
    style: MK.fill(w, color || '#0090ca')
  }));
}
function Gauge({
  score,
  grade
}) {
  const c = gradeColor(grade);
  const r = 62,
    circ = Math.PI * r;
  const frac = Math.max(0, Math.min(1, (Number(score) || 0) / 100));
  return React.createElement("div", {
    style: {
      textAlign: 'center'
    }
  }, React.createElement("svg", {
    width: "170",
    height: "98",
    viewBox: "0 0 170 98"
  }, React.createElement("path", {
    d: "M23 88 A62 62 0 0 1 147 88",
    fill: "none",
    stroke: "rgba(130,150,175,.22)",
    strokeWidth: "13",
    strokeLinecap: "round"
  }), React.createElement("path", {
    d: "M23 88 A62 62 0 0 1 147 88",
    fill: "none",
    stroke: c,
    strokeWidth: "13",
    strokeLinecap: "round",
    strokeDasharray: circ,
    strokeDashoffset: circ * (1 - frac),
    style: {
      transition: 'stroke-dashoffset .5s ease, stroke .3s'
    }
  }), React.createElement("text", {
    x: "85",
    y: "76",
    textAnchor: "middle",
    style: {
      fontSize: 30,
      fontWeight: 700,
      fill: c
    }
  }, score), React.createElement("text", {
    x: "85",
    y: "92",
    textAnchor: "middle",
    style: {
      fontSize: 10.5,
      fill: 'var(--muted, #8aa0b8)'
    }
  }, "of 100")), React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 10,
      color: 'var(--muted,#8aa0b8)',
      padding: '0 14px',
      marginTop: -6
    }
  }, React.createElement("span", null, "0"), React.createElement("span", null, "50"), React.createElement("span", null, "100")));
}
function Empty({
  icon,
  title,
  sub,
  action
}) {
  return React.createElement("div", {
    style: {
      display: 'grid',
      placeItems: 'center',
      padding: '46px 20px',
      textAlign: 'center',
      gap: 8
    }
  }, React.createElement("div", {
    style: {
      opacity: .35
    }
  }, React.createElement(Ic, {
    d: icon || I.doc,
    s: 34
  })), React.createElement("div", {
    style: {
      fontWeight: 600
    }
  }, title), sub && React.createElement("div", {
    className: "sub",
    style: {
      maxWidth: 420
    }
  }, sub), action);
}
function Modal({
  title,
  sub,
  onClose,
  children,
  wide,
  footer
}) {
  useEffect(() => {
    const k = e => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return perfPortal(React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(9,17,28,.55)',
      backdropFilter: 'blur(2px)',
      zIndex: 9000,
      display: 'grid',
      placeItems: 'center',
      padding: 20
    }
  }, React.createElement("div", {
    className: "mk-scope",
    style: {
      width: wide ? 'min(920px,96vw)' : 'min(560px,96vw)',
      maxHeight: '90vh',
      display: 'flex'
    }
  }, React.createElement("div", {
    className: "card",
    style: {
      width: '100%',
      maxHeight: '90vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(152deg,rgba(255,255,255,.97),rgba(236,247,255,.93))',
      boxShadow: '0 24px 60px rgba(16,32,56,.3)'
    }
  }, React.createElement("div", {
    className: "card-h",
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10
    }
  }, React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 14,
      color: MK.INK
    }
  }, title), sub && React.createElement("div", {
    className: "sub",
    style: {
      fontSize: 11.5
    }
  }, sub)), React.createElement("button", {
    className: "icon-btn",
    onClick: onClose,
    title: "Close"
  }, React.createElement(Ic, {
    d: I.x || 'M18 6L6 18M6 6l12 12',
    s: 16
  }))), React.createElement("div", {
    className: "card-b",
    style: {
      overflow: 'auto',
      flex: 1
    }
  }, children), footer && React.createElement("div", {
    className: "card-h",
    style: {
      borderTop: '1px solid ' + MK.LINE,
      borderBottom: 0,
      display: 'flex',
      gap: 8,
      justifyContent: 'flex-end'
    }
  }, footer)))));
}
function PerfDashboard({
  roster,
  perf,
  setRoute
}) {
  const rows = roster.rows;
  const done = rows.filter(r => r.status === 'actioned').length;
  const prog = rows.filter(r => ['draft', 'submitted', 'discussed'].indexOf(r.status) >= 0).length;
  const not = rows.length - done - prog;
  const overdue = rows.filter(r => r.overdue);
  const org = A.orgCycle(new Date());
  const byDept = useMemo(() => {
    const m = {};
    rows.forEach(r => {
      const d = r.dept || 'Unassigned';
      const e = m[d] || (m[d] = {
        dept: d,
        due: 0,
        done: 0,
        scores: []
      });
      e.due++;
      if (r.status === 'actioned') {
        e.done++;
        if (r.appraisal) e.scores.push(r.appraisal.score);
      }
    });
    return Object.values(m).map(e => ({
      ...e,
      avg: e.scores.length ? Math.round(e.scores.reduce((a, b) => a + b, 0) / e.scores.length) : null
    })).sort((a, b) => b.due - a.due);
  }, [rows]);
  const gradeMix = useMemo(() => {
    const m = {};
    rows.forEach(r => {
      if (r.status === 'actioned' && r.appraisal) m[r.appraisal.grade] = (m[r.appraisal.grade] || 0) + 1;
    });
    return A.GRADES.map(g => ({
      grade: g.grade,
      n: m[g.grade] || 0
    }));
  }, [rows]);
  const graded = gradeMix.reduce((t, g) => t + g.n, 0);
  return React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap'
    }
  }, React.createElement("div", {
    style: MK.iconBadge('blue', 34)
  }, React.createElement(Ic, {
    d: I.doc,
    s: 17
  })), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 240
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 15.5,
      color: MK.INK
    }
  }, "Individual Performance \u2014 Nursing & PCA"), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: MK.MUTED
    }
  }, "6-monthly per individual \u2014 anchored to each date of joining \xB7 20 parameters \xB7 out of 100")), React.createElement("button", {
    className: "btn",
    onClick: () => setRoute({
      view: 'perfCompare'
    })
  }, "Compare"), React.createElement("button", {
    className: "btn",
    onClick: () => setRoute({
      view: 'perfDirectory'
    })
  }, "Rankings"), perfCan('add') && React.createElement("button", {
    className: "btn pri",
    onClick: () => setRoute({
      view: 'perfDirectory'
    })
  }, "+ New Appraisal")), React.createElement("div", {
    className: "card",
    style: {
      padding: '15px 18px',
      display: 'flex',
      gap: 18,
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 250
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: .6,
      textTransform: 'uppercase',
      color: '#1f9d57'
    }
  }, React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: '#1f9d57'
    }
  }), "Current cycle \xB7 Live"), React.createElement("div", {
    style: {
      fontSize: 19,
      fontWeight: 700,
      color: MK.INK,
      margin: '3px 0 2px'
    }
  }, org.label), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: MK.MUTED
    }
  }, "Every 6 months from each individual\u2019s date of joining \xB7 ", rows.length, " nurses + PCA across ", byDept.length, " departments")), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 7,
      flexWrap: 'wrap'
    }
  }, [['Completed ' + done, '#1f9d57'], ['In progress ' + prog, '#0090ca'], ['Not started ' + not, '#5b6b80']].map(([t, c]) => React.createElement("span", {
    key: t,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 11,
      fontWeight: 600,
      padding: '4px 11px',
      borderRadius: 14,
      color: c,
      background: c + '16'
    }
  }, React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: c
    }
  }), t))), React.createElement("div", {
    style: {
      minWidth: 190
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8
    }
  }, React.createElement("span", {
    className: "num",
    style: {
      fontSize: 26,
      fontWeight: 700,
      color: MK.INK,
      letterSpacing: '-.5px'
    }
  }, pct(done, rows.length), "%"), React.createElement("span", {
    style: {
      fontSize: 11,
      color: MK.MUTED
    }
  }, "of ", rows.length, " appraisals completed")), React.createElement("div", {
    style: Object.assign({
      marginTop: 6
    }, MK.track(7))
  }, React.createElement("div", {
    style: MK.fill(pct(done, rows.length), MK.progColor(rows.length ? done / rows.length : 0))
  })))), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
      gap: 12
    }
  }, React.createElement(Stat, {
    label: "Due this cycle",
    value: rows.length,
    sub: 'nurses + PCA across ' + byDept.length + ' departments',
    tint: "blue",
    icon: I.grid
  }), React.createElement(Stat, {
    label: "Completed",
    value: done,
    sub: pct(done, rows.length) + '% of the cycle target',
    tint: "green",
    icon: I.check || I.doc,
    tone: "#1f9d57"
  }), React.createElement(Stat, {
    label: "Awaiting discussion",
    value: rows.filter(r => r.status === 'submitted').length,
    sub: "scored \u2014 meeting not yet held",
    tint: "amber",
    icon: I.user
  }), React.createElement(Stat, {
    label: "Part H pending",
    value: rows.filter(r => r.status === 'discussed').length,
    sub: "completed \u2014 awaiting CNS action",
    tint: "violet",
    icon: I.doc
  }), React.createElement(Stat, {
    label: "Overdue",
    value: overdue.length,
    sub: "window has already closed",
    tint: overdue.length ? 'red' : 'slate',
    icon: I.pulse,
    tone: overdue.length ? '#d23a52' : undefined
  })), overdue.length > 0 && React.createElement("div", {
    className: "card",
    style: {
      borderLeft: '3px solid #e08a1e'
    }
  }, React.createElement("div", {
    className: "card-h",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: 'rgba(224,138,30,.07)'
    }
  }, React.createElement("div", {
    style: MK.iconBadge('amber', 30)
  }, React.createElement(Ic, {
    d: I.alert || I.pulse,
    s: 15
  })), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 13,
      color: MK.INK
    }
  }, "New-joiner appraisals due"), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: MK.MUTED
    }
  }, "The first appraisal falls six months after the date of joining.")), React.createElement("span", {
    style: MK.stChip('Awaiting discussion')
  }, overdue.length, " overdue")), React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, overdue.slice(0, 6).map(r => React.createElement("div", {
    key: r.empId,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '7px 0',
      borderBottom: '1px solid var(--line,#eef2f7)'
    }
  }, React.createElement(MK.Av, {
    name: r.name,
    emp: r.emp,
    empId: r.empId,
    size: 28
  }), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 12.5
    }
  }, r.name), React.createElement("div", {
    className: "sub",
    style: {
      fontSize: 11
    }
  }, r.designation, " \xB7 ", r.dept, " \xB7 joined ", A.fmtDay(A.parseDate(r.doj)), " \xB7 due ", A.fmtDay(r.firstDue))), React.createElement("span", {
    className: "tag",
    style: {
      color: '#d23a52',
      borderColor: '#d23a5255',
      background: '#d23a5214'
    }
  }, "overdue"), perfCan('add') && React.createElement("button", {
    className: "btn pri",
    onClick: () => setRoute({
      view: 'perfForm',
      emp: r.empId
    })
  }, "Start now"))))), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))',
      gap: 14
    }
  }, React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Department progress"), React.createElement("div", {
    className: "sub"
  }, "done / due \xB7 average score of completed forms")), React.createElement("div", {
    className: "card-b",
    style: {
      maxHeight: 340,
      overflow: 'auto'
    }
  }, byDept.length === 0 ? React.createElement(Empty, {
    title: "No staff on the roster"
  }) : React.createElement("table", {
    className: "tbl",
    style: {
      width: '100%'
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Department"), React.createElement("th", {
    style: {
      width: 78
    }
  }, "Done / due"), React.createElement("th", {
    style: {
      width: 110
    }
  }, "Progress"), React.createElement("th", {
    style: {
      width: 70
    }
  }, "Avg"))), React.createElement("tbody", null, byDept.map(d => React.createElement("tr", {
    key: d.dept
  }, React.createElement("td", {
    style: {
      fontWeight: 600
    }
  }, d.dept), React.createElement("td", {
    className: "num"
  }, d.done, " / ", d.due), React.createElement("td", null, React.createElement(Bar, {
    value: d.done,
    max: d.due,
    color: d.done === d.due ? '#1f9d63' : '#27a8db'
  })), React.createElement("td", {
    className: "num"
  }, d.avg == null ? '—' : d.avg))))))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Grade distribution"), React.createElement("div", {
    className: "sub"
  }, graded, " completed appraisals")), React.createElement("div", {
    className: "card-b"
  }, graded === 0 ? React.createElement(Empty, {
    title: "Nothing graded yet",
    sub: "Grades appear here as appraisals are completed and filed."
  }) : React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 9
    }
  }, gradeMix.map(g => React.createElement("div", {
    key: g.grade,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, React.createElement("div", {
    style: {
      width: 30
    }
  }, React.createElement(GradePill, {
    grade: g.grade
  })), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement(Bar, {
    value: g.n,
    max: graded,
    color: gradeColor(g.grade)
  })), React.createElement("div", {
    className: "num",
    style: {
      width: 30,
      textAlign: 'right'
    }
  }, g.n))))))), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))',
      gap: 14
    }
  }, React.createElement(QuickCard, {
    icon: I.doc,
    title: "Appraisals to file",
    sub: "completed \u2014 Part H not yet recorded",
    n: rows.filter(r => r.status === 'discussed' || r.status === 'submitted').length,
    onClick: () => setRoute({
      view: 'perfDirectory'
    })
  }), React.createElement(QuickCard, {
    icon: I.heart,
    title: "Achievements",
    sub: 'Bonus points, capped at ' + A.BONUS_CAP + ' per cycle',
    n: perf.achievements.length,
    onClick: () => setRoute({
      view: 'perfAchievements'
    })
  }), React.createElement(QuickCard, {
    icon: I.alert || I.pulse,
    title: "Incidents",
    sub: 'Deductions, capped at ' + A.PENALTY_CAP + ' per cycle',
    n: perf.incidents.length,
    onClick: () => setRoute({
      view: 'perfIncidents'
    })
  }), React.createElement(QuickCard, {
    icon: I.user,
    title: "Attrition & exits",
    sub: "who left, when and why",
    n: (perf.exits || []).length,
    onClick: () => setRoute({
      view: 'perfAttrition'
    })
  }), React.createElement(QuickCard, {
    icon: I.heart,
    title: "Recognition board",
    sub: "wall, leaderboard and awards",
    n: perf.achievements.length,
    onClick: () => setRoute({
      view: 'perfBoard'
    })
  }), React.createElement(QuickCard, {
    icon: I.pulse,
    title: "Retention risk",
    sub: "staff to speak with this month",
    n: rows.filter(r => r.incidents.length || r.overdue).length,
    onClick: () => setRoute({
      view: 'perfRisk'
    })
  })));
}
function QuickCard({
  icon,
  title,
  sub,
  n,
  onClick
}) {
  return React.createElement("div", {
    className: "card",
    style: {
      padding: 14,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 12
    },
    onClick: onClick
  }, React.createElement("div", {
    style: {
      display: 'grid',
      placeItems: 'center',
      width: 38,
      height: 38,
      borderRadius: 10,
      background: 'rgba(39,168,219,.12)',
      color: '#27a8db'
    }
  }, React.createElement(Ic, {
    d: icon,
    s: 19
  })), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 13
    }
  }, title), React.createElement("div", {
    className: "sub",
    style: {
      fontSize: 11.5
    }
  }, sub)), React.createElement("div", {
    className: "num",
    style: {
      fontSize: 20,
      fontWeight: 700
    }
  }, n));
}
const DIR_CHIPS = [['all', 'All', () => true], ['fav', '★ Favorites', r => !!(r.emp && r.emp.fav)], ['pending', '⚠ No appraisal yet', r => r.status === 'none'], ['done', '✓ Appraisal completed', r => r.status === 'actioned'], ['newhire', 'New hire ≤ 6 mo', r => {
  const d = r.doj ? A.parseDate(r.doj) : null;
  return !!(d && A.addMonths(d, 6) > new Date());
}]];
const dirChipStyle = on => ({
  padding: '7px 14px',
  borderRadius: 9,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'all .15s',
  border: '1px solid ' + (on ? '#0090ca' : 'rgba(255,255,255,.8)'),
  background: on ? 'linear-gradient(135deg,#27a8db,#0072a3)' : 'rgba(255,255,255,.5)',
  color: on ? '#fff' : MK.BODY,
  boxShadow: on ? '0 4px 12px rgba(0,144,202,.35)' : 'none'
});
const dirSegStyle = on => ({
  border: 0,
  background: on ? '#fff' : 'transparent',
  color: on ? '#0090ca' : MK.MUTED,
  padding: '5px 12px',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  boxShadow: on ? '0 1px 2px rgba(20,32,46,.06)' : 'none'
});
const expOf = e => {
  try {
    return window.STAFF && window.STAFF.expLabel ? window.STAFF.expLabel(e) : '—';
  } catch (x) {
    return '—';
  }
};
function PerfDirectory({
  roster,
  staffStore,
  setRoute
}) {
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [st, setSt] = useState('');
  const [sort, setSort] = useState('name');
  const [chip, setChip] = useState('all');
  const PAGE = 40;
  const [shown, setShown] = useState(PAGE);
  const [role, setRole] = useState('Nurse');
  const depts = useMemo(() => [...new Set(roster.rows.map(r => r.dept).filter(Boolean))].sort(), [roster.rows]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const chipDef = DIR_CHIPS.find(c => c[0] === chip) || DIR_CHIPS[0];
    let out = roster.rows.filter(r => {
      if (!chipDef[2](r)) return false;
      if (role && (r.role || roleOf(r.emp)) !== role) return false;
      if (dept && r.dept !== dept) return false;
      if (st && r.status !== st) return false;
      if (!needle) return true;
      return [r.name, r.empId, r.designation, r.dept].some(v => String(v || '').toLowerCase().includes(needle));
    });
    out = out.slice().sort((a, b) => {
      if (sort === 'score') return (b.last ? b.last.score : -1) - (a.last ? a.last.score : -1);
      if (sort === 'dept') return String(a.dept).localeCompare(String(b.dept)) || String(a.name).localeCompare(String(b.name));
      return String(a.name).localeCompare(String(b.name));
    });
    return out;
  }, [roster.rows, q, dept, st, sort, chip, role]);
  useEffect(() => {
    setShown(PAGE);
  }, [q, dept, st, sort, chip, role]);
  const page = list.slice(0, shown);
  const nurses = list.filter(r => !isPcaRow(r)).length;
  const allNurses = roster.rows.filter(r => !isPcaRow(r)).length;
  const allPca = roster.rows.length - allNurses;
  return React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, DIR_CHIPS.map(([id, label]) => React.createElement("button", {
    key: id,
    style: dirChipStyle(chip === id),
    onClick: () => setChip(id)
  }, label))), React.createElement("div", {
    className: "card",
    style: {
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
      background: 'rgba(252,254,255,.97)',
      contain: 'content'
    }
  }, React.createElement("div", {
    className: "card-h",
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      alignItems: 'center'
    }
  }, React.createElement("div", {
    style: MK.iconBadge('blue', 32)
  }, React.createElement(Ic, {
    d: I.user,
    s: 16
  })), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 200
    }
  }, React.createElement("h3", null, "Staff directory"), React.createElement("div", {
    className: "sub"
  }, list.length, " shown \xB7 ", nurses, " nurses \xB7 ", list.length - nurses, " PCA \xB7 appraisal status for each person's current window")), React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Search name / Emp ID\u2026",
    style: {
      minWidth: 190
    }
  }), React.createElement("div", {
    style: {
      display: 'inline-flex',
      background: 'rgba(255,255,255,.4)',
      border: '1px solid rgba(255,255,255,.8)',
      borderRadius: 9,
      padding: 3,
      gap: 2
    }
  }, [['', 'All (' + roster.rows.length + ')'], ['Nurse', 'Nurses (' + allNurses + ')'], ['PCA', 'PCA (' + allPca + ')']].map(([v, l]) => React.createElement("button", {
    key: v,
    style: dirSegStyle(role === v),
    onClick: () => setRole(v)
  }, l))), React.createElement("select", {
    value: dept,
    onChange: e => setDept(e.target.value)
  }, React.createElement("option", {
    value: ""
  }, "All departments"), depts.map(d => React.createElement("option", {
    key: d
  }, d))), React.createElement("select", {
    value: st,
    onChange: e => setSt(e.target.value)
  }, React.createElement("option", {
    value: ""
  }, "Any status"), Object.keys(STATUS_META).map(k => React.createElement("option", {
    key: k,
    value: k
  }, STATUS_META[k].label))), React.createElement("select", {
    value: sort,
    onChange: e => setSort(e.target.value)
  }, React.createElement("option", {
    value: "name"
  }, "Sort: name"), React.createElement("option", {
    value: "dept"
  }, "Sort: department"), React.createElement("option", {
    value: "score"
  }, "Sort: last score"))), React.createElement("div", {
    className: "card-b",
    style: {
      overflow: 'auto'
    }
  }, list.length === 0 ? React.createElement(Empty, {
    icon: I.user,
    title: "No staff match these filters",
    sub: "Clear a filter to widen the search."
  }) : React.createElement("table", {
    className: "tbl",
    style: {
      width: '100%'
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: {
      width: 34,
      textAlign: 'center'
    }
  }, "\u2605"), React.createElement("th", null, "Staff"), React.createElement("th", null, "Emp ID"), React.createElement("th", null, "Designation"), React.createElement("th", null, "Department"), React.createElement("th", {
    style: {
      textAlign: 'right'
    }
  }, "Experience"), React.createElement("th", null, "Appraisal window"), React.createElement("th", {
    style: {
      textAlign: 'right'
    }
  }, "Last appraisal"), React.createElement("th", null, "Appraisal status"), React.createElement("th", {
    style: {
      width: 150
    }
  }))), React.createElement("tbody", null, page.map(r => React.createElement("tr", {
    key: r.empId
  }, React.createElement("td", {
    style: {
      textAlign: 'center'
    }
  }, React.createElement("span", {
    title: r.emp && r.emp.fav ? 'Remove from favourites' : 'Mark as a favourite',
    onClick: () => staffStore && staffStore.toggleFav(r.emp.id),
    style: {
      cursor: 'pointer',
      fontSize: 15,
      color: r.emp && r.emp.fav ? '#e0a81e' : '#c4ccd6'
    }
  }, r.emp && r.emp.fav ? '★' : '☆')), React.createElement("td", null, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, React.createElement(MK.Av, {
    name: r.name,
    emp: r.emp,
    empId: r.empId,
    size: 26
  }), React.createElement("span", {
    style: {
      fontWeight: 600,
      cursor: 'pointer'
    },
    onClick: () => setRoute({
      view: 'perfStaff',
      emp: r.empId
    })
  }, r.name), isPcaRow(r) && React.createElement("span", {
    style: MK.roleChip('PCA')
  }, "PCA"), r.overdue && React.createElement("span", {
    className: "tag",
    style: {
      color: '#d23a52',
      borderColor: '#d23a5255',
      background: '#d23a5214'
    }
  }, "overdue"))), React.createElement("td", {
    className: "num"
  }, r.empId), React.createElement("td", null, r.designation), React.createElement("td", null, r.dept), React.createElement("td", {
    className: "num",
    style: {
      textAlign: 'right',
      whiteSpace: 'nowrap'
    }
  }, expOf(r.emp)), React.createElement("td", {
    className: "sub"
  }, r.cycle ? r.cycle.label : '—'), React.createElement("td", {
    style: {
      textAlign: 'right',
      whiteSpace: 'nowrap'
    }
  }, r.last ? React.createElement("span", null, React.createElement("span", {
    className: "num",
    style: {
      fontWeight: 700,
      color: MK.INK
    }
  }, r.last.score), React.createElement("span", {
    style: {
      marginLeft: 6
    }
  }, React.createElement("span", {
    style: MK.gchip(r.last.grade)
  }, r.last.grade))) : React.createElement("span", {
    className: "sub"
  }, "\u2014")), React.createElement("td", null, React.createElement(StatusChip, {
    st: r.status
  })), React.createElement("td", {
    style: {
      textAlign: 'right',
      whiteSpace: 'nowrap'
    }
  }, React.createElement("button", {
    className: "btn",
    onClick: () => setRoute({
      view: 'perfStaff',
      emp: r.empId
    })
  }, "Record"), ' ', perfCan('edit') && r.cycle && React.createElement("button", {
    className: "btn pri",
    onClick: () => setRoute({
      view: 'perfForm',
      emp: r.empId
    })
  }, r.appraisal ? r.status === 'actioned' ? 'View' : 'Continue' : 'Start')))))), list.length > page.length && React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '11px 2px 2px',
      flexWrap: 'wrap'
    }
  }, React.createElement("button", {
    className: "btn",
    onClick: () => setShown(n => n + PAGE)
  }, "Show ", Math.min(PAGE, list.length - page.length), " more"), React.createElement("button", {
    className: "btn",
    onClick: () => setShown(list.length)
  }, "Show all ", list.length), React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: MK.FAINT
    }
  }, "showing ", page.length, " of ", list.length)), React.createElement("div", {
    style: {
      paddingTop: 10,
      fontSize: 11,
      color: MK.FAINT
    }
  }, "Click a staff member to open their profile and full appraisal history. Appraisal windows run every 6 months from each individual's date of joining."))));
}
const SEC_ACCENT = ['#0090ca', '#3ab5a7', '#6a52d4'];
const secAccent = n => SEC_ACCENT[(n - 1) % SEC_ACCENT.length];
function Speedo({
  score,
  rated,
  of
}) {
  const R = 88,
    CX = 110,
    CY = 108,
    W = 17;
  const ang = v => Math.PI * (1 - Math.max(0, Math.min(100, v)) / 100);
  const pt = (v, r) => [CX + r * Math.cos(ang(v)), CY - r * Math.sin(ang(v))];
  const arc = (a, b, color) => {
    const [x1, y1] = pt(a, R),
      [x2, y2] = pt(b, R);
    return React.createElement("path", {
      key: a,
      d: 'M' + x1 + ' ' + y1 + ' A' + R + ' ' + R + ' 0 0 1 ' + x2 + ' ' + y2,
      fill: "none",
      stroke: color,
      strokeWidth: W,
      strokeLinecap: "butt"
    });
  };
  const [nx, ny] = pt(score, R - 20);
  const g = A.gradeFor(score);
  return React.createElement("div", {
    style: {
      textAlign: 'center'
    }
  }, React.createElement("svg", {
    width: "220",
    height: "132",
    viewBox: "0 0 220 132"
  }, arc(0, 50, '#d23a52'), arc(50, 70, '#e08a1e'), arc(70, 90, '#0090ca'), arc(90, 100, '#1f9d57'), React.createElement("text", {
    x: pt(0, R + 15)[0],
    y: pt(0, R + 15)[1] + 4,
    textAnchor: "middle",
    style: {
      fontSize: 9,
      fill: MK.FAINT
    }
  }, "0"), React.createElement("text", {
    x: CX,
    y: CY - R - 8,
    textAnchor: "middle",
    style: {
      fontSize: 9,
      fill: MK.FAINT
    }
  }, "50"), React.createElement("text", {
    x: pt(100, R + 15)[0],
    y: pt(100, R + 15)[1] + 4,
    textAnchor: "middle",
    style: {
      fontSize: 9,
      fill: MK.FAINT
    }
  }, "100"), React.createElement("line", {
    x1: CX,
    y1: CY,
    x2: nx,
    y2: ny,
    stroke: MK.INK,
    strokeWidth: "3.4",
    strokeLinecap: "round",
    style: {
      transition: 'all .5s cubic-bezier(.2,.8,.25,1)'
    }
  }), React.createElement("circle", {
    cx: CX,
    cy: CY,
    r: "9",
    fill: "#0090ca"
  }), React.createElement("circle", {
    cx: CX,
    cy: CY,
    r: "4",
    fill: "#fff"
  })), React.createElement("div", {
    className: "num",
    style: {
      fontSize: 30,
      fontWeight: 700,
      color: MK.INK,
      lineHeight: 1,
      marginTop: -6
    }
  }, score), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: MK.FAINT,
      marginTop: 3
    }
  }, "of 100 \xB7 ", rated, "/", of, " rated"), React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: '#0090ca',
      marginTop: 2
    }
  }, "pace ", of ? Math.round(rated / of * 100) : 0, "% \xB7 grade ", g.grade));
}
function PerfForm({
  roster,
  perf,
  empId,
  setRoute
}) {
  const row = roster.byEmp[empId];
  const saved = row && row.appraisal;
  const locked = saved && saved.status === 'actioned';
  const [scores, setScores] = useState(() => saved && saved.scores || {});
  const [remarks, setRemarks] = useState(() => saved && saved.remarks || {});
  const [open, setOpen] = useState(() => ({
    1: true
  }));
  const [assessorRemarks, setAssessorRemarks] = useState(() => saved && saved.assessorRemarks || '');
  const [strengths, setStrengths] = useState(() => saved && saved.strengths || '');
  const [development, setDevelopment] = useState(() => saved && saved.development || '');
  const [discussedOn, setDiscussedOn] = useState(() => saved && saved.discussedOn || '');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setScores(saved && saved.scores || {});
    setRemarks(saved && saved.remarks || {});
    setAssessorRemarks(saved && saved.assessorRemarks || '');
    setStrengths(saved && saved.strengths || '');
    setDevelopment(saved && saved.development || '');
    setDiscussedOn(saved && saved.discussedOn || '');
    setDirty(false);
  }, [empId, saved && saved.id, saved && saved.updatedAt]);
  const t = useMemo(() => A.tally(scores), [scores]);
  const missing = useMemo(() => A.missingRemarks(scores, remarks), [scores, remarks]);
  const pointsBonus = row ? Math.min(row.achievements.reduce((s, a) => s + (Number(a.points) || 0), 0), A.BONUS_CAP) : 0;
  const pointsPenalty = row ? Math.min(row.incidents.reduce((s, a) => s + (Number(a.points) || 0), 0), A.PENALTY_CAP) : 0;
  const settled = A.finalScore(t.total, pointsBonus, pointsPenalty);
  const grade = A.gradeFor(settled.score);
  if (!row) return React.createElement(Empty, {
    icon: I.user,
    title: "Staff member not found",
    sub: "They may have left the roster.",
    action: React.createElement("button", {
      className: "btn",
      onClick: () => setRoute({
        view: 'perfDirectory'
      })
    }, "Back to directory")
  });
  if (!row.cycle) return React.createElement(Empty, {
    icon: I.doc,
    title: "No appraisal window yet",
    sub: 'The first window opens six months after the date of joining' + (row.doj ? ' (' + A.fmtDay(A.parseDate(row.doj)) + ').' : '.'),
    action: React.createElement("button", {
      className: "btn",
      onClick: () => setRoute({
        view: 'perfDirectory'
      })
    }, "Back")
  });
  const setScore = (sl, v) => {
    if (locked) return;
    setScores(s => ({
      ...s,
      [sl]: v
    }));
    setDirty(true);
  };
  const setRemark = (sl, v) => {
    if (locked) return;
    setRemarks(r => ({
      ...r,
      [sl]: v
    }));
    setDirty(true);
  };
  const body = status => ({
    empId: row.empId,
    cycleId: saved ? saved.cycleId : row.cycle.id,
    cycleLabel: saved ? saved.cycleLabel : row.cycle.label,
    cycleStart: saved ? saved.cycleStart : row.cycle.start.toISOString().slice(0, 10),
    cycleEnd: saved ? saved.cycleEnd : row.cycle.end.toISOString().slice(0, 10),
    staffName: row.name,
    designation: row.designation,
    department: row.dept,
    doj: row.doj,
    scores,
    remarks,
    assessorRemarks,
    strengths,
    development,
    discussedOn,
    status,
    assessorName: window.__UNICO_USER__ && window.__UNICO_USER__.name || 'Administrator'
  });
  const save = (status, msg) => {
    setBusy(true);
    perf.saveAppraisal(body(status), msg).then(() => {
      setBusy(false);
      setDirty(false);
    });
  };
  const canComplete = t.complete && missing.length === 0;
  const statusLabel = (STATUS_META[saved ? saved.status : 'none'] || STATUS_META.none).label;
  const prevCycle = row.history.find(h => !row.appraisal || h.cycleId !== row.appraisal.cycleId) || null;
  return React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, React.createElement("button", {
    className: "btn",
    onClick: () => setRoute({
      view: 'perfDirectory'
    })
  }, "\u2039 Performance"), React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: MK.FAINT
    }
  }, "Individual Performance Appraisal \xB7 Form ", A.FORM_ID)), React.createElement("div", {
    className: "card",
    style: {
      borderTop: '3px solid #0090ca'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      alignItems: 'center',
      flexWrap: 'wrap',
      padding: '15px 18px'
    }
  }, React.createElement(MK.Av, {
    name: row.name,
    emp: row.emp,
    empId: row.empId,
    size: 56
  }), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 240
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      flexWrap: 'wrap'
    }
  }, React.createElement("span", {
    style: {
      fontSize: 19,
      fontWeight: 700,
      color: MK.INK
    }
  }, row.name), React.createElement("span", {
    style: MK.roleChip(isPcaRow(row) ? 'PCA' : 'Nurse')
  }, isPcaRow(row) ? 'PCA' : 'Nurse'), React.createElement("span", {
    style: MK.stChip(statusLabel)
  }, React.createElement("span", {
    style: {
      width: 5,
      height: 5,
      borderRadius: '50%',
      background: 'currentColor',
      marginRight: 5
    }
  }), statusLabel)), React.createElement("div", {
    style: {
      fontSize: 11.8,
      color: MK.MUTED,
      marginTop: 3
    }
  }, row.empId, " \xB7 ", row.designation, " \xB7 ", row.dept, " \xB7 DOJ ", React.createElement("b", {
    style: {
      color: MK.BODY
    }
  }, A.fmtDay(A.parseDate(row.doj))))), React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: .6,
      textTransform: 'uppercase',
      color: MK.FAINT,
      marginBottom: 5
    }
  }, "Appraisal period"), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      justifyContent: 'flex-end',
      flexWrap: 'wrap'
    }
  }, prevCycle && React.createElement("span", {
    style: {
      fontSize: 11.5,
      padding: '5px 11px',
      borderRadius: 9,
      color: MK.MUTED,
      background: 'rgba(125,145,180,.12)'
    }
  }, prevCycle.cycleLabel), React.createElement("span", {
    style: {
      fontSize: 11.5,
      fontWeight: 600,
      padding: '5px 11px',
      borderRadius: 9,
      color: '#0072a3',
      background: 'rgba(0,144,202,.12)',
      border: '1px solid rgba(0,144,202,.35)'
    }
  }, saved && saved.cycleLabel || row.cycle.label)))), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 22,
      alignItems: 'center',
      flexWrap: 'wrap',
      padding: '11px 18px',
      borderTop: '1px solid ' + MK.LINE
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: .6,
      textTransform: 'uppercase',
      color: MK.FAINT
    }
  }, "Filled by"), React.createElement("div", {
    style: {
      fontSize: 12.2
    }
  }, React.createElement("b", {
    style: {
      color: MK.INK
    }
  }, "Chief Nursing Superintendent"), " ", React.createElement("span", {
    style: {
      color: MK.MUTED
    }
  }, "(CNS / Admin only)"))), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 220
    }
  }, React.createElement("div", {
    style: {
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: .6,
      textTransform: 'uppercase',
      color: MK.FAINT
    }
  }, "Window"), React.createElement("div", {
    style: {
      fontSize: 12.2
    }
  }, React.createElement("b", {
    style: {
      color: MK.INK
    }
  }, saved && saved.cycleLabel || row.cycle.label), " ", React.createElement("span", {
    style: {
      color: MK.MUTED
    }
  }, "\xB7 appraisals run every 6 months from the individual\u2019s date of joining"))), !locked && perfCan('edit') && (() => {
    const keep = saved && saved.status && saved.status !== 'draft' ? saved.status : 'draft';
    return React.createElement("button", {
      className: "btn",
      disabled: busy,
      onClick: () => save(keep, keep === 'draft' ? 'Draft saved.' : 'Changes saved.')
    }, busy ? 'Saving…' : keep === 'draft' ? 'Save draft' : 'Save changes');
  })(), !locked && perfCan('edit') && React.createElement("button", {
    className: "btn pri",
    disabled: busy || !canComplete,
    title: canComplete ? '' : 'Rate all 20 parameters and add remarks for any 1–2 first',
    onClick: () => save('discussed', 'Appraisal completed — record Part H at the foot of the form to file it.')
  }, "\u2713 Complete & schedule discussion"))), locked && React.createElement("div", {
    className: "card",
    style: {
      borderLeft: '3px solid #1f9d57',
      padding: 12,
      display: 'flex',
      gap: 10,
      alignItems: 'center'
    }
  }, React.createElement("div", {
    style: MK.iconBadge('green', 30)
  }, React.createElement(Ic, {
    d: I.check || I.doc,
    s: 15
  })), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 12.5,
      color: MK.INK
    }
  }, "Filed to the personal record"), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: MK.MUTED
    }
  }, "The authority has recorded its action, so the form is read-only.")), perfIsAdmin() && React.createElement("button", {
    className: "btn",
    onClick: () => perf.reopen(saved.id)
  }, "Reopen for correction")), React.createElement("div", {
    className: "card",
    style: {
      background: 'linear-gradient(152deg,rgba(233,245,255,.9),rgba(240,248,255,.7))',
      display: 'flex',
      gap: 12,
      alignItems: 'center',
      padding: '12px 16px'
    }
  }, React.createElement("div", {
    style: MK.iconBadge('blue', 30)
  }, React.createElement(Ic, {
    d: I.info || I.doc,
    s: 15
  })), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 260,
      fontSize: 11.8,
      color: MK.BODY,
      lineHeight: 1.55
    }
  }, "Rate on ", React.createElement("b", null, "documented observation over the whole period"), ", not isolated incidents. Tick one rating per parameter \u2014 no parameter may be left blank. A rating of ", React.createElement("b", null, "1 or 2 requires a written remark"), " and, where applicable, an incident or counselling reference. Sub-totals carry to the Score Summary automatically; the form is marked out of 100, so the total obtained is the percentage."), React.createElement("button", {
    className: "btn",
    onClick: () => setRoute({
      view: 'perfPrint',
      emp: row.empId
    })
  }, "Printable form \u203A")), React.createElement("div", {
    className: "card",
    style: {
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 9
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      gap: 9,
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, React.createElement("span", {
    style: {
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: .6,
      textTransform: 'uppercase',
      color: MK.FAINT,
      minWidth: 66
    }
  }, "Sections"), A.SECTIONS.map(sec => {
    const sub = t.sections.find(x => x.no === sec.no);
    const full = sub.rated === sub.of;
    const c = full ? '#1f9d57' : MK.FAINT;
    const isOpen = !!open[sec.no];
    return React.createElement("button", {
      key: sec.no,
      onClick: () => setOpen(o => ({
        ...o,
        [sec.no]: !o[sec.no]
      })),
      style: {
        cursor: 'pointer',
        font: 'inherit',
        fontSize: 11,
        fontWeight: 600,
        padding: '4px 11px',
        borderRadius: 14,
        color: isOpen ? '#0072a3' : c,
        background: isOpen ? 'rgba(0,144,202,.1)' : full ? 'rgba(31,157,87,.1)' : 'rgba(125,145,180,.1)',
        border: '1px solid ' + (isOpen ? 'rgba(0,144,202,.45)' : 'transparent')
      }
    }, sec.no, " ", sec.title.split(' ')[0].replace(/,$/, ''), full ? ' ✓' : '');
  })), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 9,
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, React.createElement("span", {
    style: {
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: .6,
      textTransform: 'uppercase',
      color: MK.FAINT,
      minWidth: 66
    }
  }, "Rating key"), [5, 4, 3, 2, 1].map(n => React.createElement("span", {
    key: n,
    style: MK.ratingPill(n)
  }, React.createElement("b", null, n), " ", A.RATING_KEY.find(r => r.score === n).label)))), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) 310px',
      gap: 14,
      alignItems: 'start'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 11.5,
      color: MK.MUTED
    }
  }, "10 sections \xB7 20 parameters \u2014 click a section to expand"), React.createElement("button", {
    className: "btn",
    onClick: () => setOpen(Object.fromEntries(A.SECTIONS.map(s => [s.no, true])))
  }, "Expand all"), React.createElement("button", {
    className: "btn",
    onClick: () => setOpen({})
  }, "Collapse all")), A.SECTIONS.map(sec => {
    const isOpen = !!open[sec.no];
    const sub = t.sections.find(x => x.no === sec.no);
    const acc = secAccent(sec.no);
    return React.createElement("div", {
      className: "card",
      key: sec.no
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 14px',
        cursor: 'pointer'
      },
      onClick: () => setOpen(o => ({
        ...o,
        [sec.no]: !o[sec.no]
      }))
    }, React.createElement("div", {
      className: "num",
      style: {
        width: 30,
        height: 30,
        borderRadius: 9,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        background: acc,
        color: '#fff',
        fontWeight: 700,
        fontSize: 13
      }
    }, sec.no), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        fontSize: 11.6,
        fontWeight: 700,
        letterSpacing: .3,
        color: MK.INK,
        textTransform: 'uppercase'
      }
    }, "Section ", sec.no, " \u2014 ", sec.title), React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        marginTop: 3
      }
    }, React.createElement("span", {
      style: {
        fontSize: 10.8,
        color: MK.FAINT,
        whiteSpace: 'nowrap'
      }
    }, sec.params.length, " parameter", sec.params.length > 1 ? 's' : '', " \xB7 max ", sec.max), React.createElement("div", {
      style: Object.assign({
        width: 92
      }, MK.track(4))
    }, React.createElement("div", {
      style: MK.fill(sub.sub / sec.max * 100, acc)
    })))), React.createElement("span", {
      className: "num",
      style: {
        fontSize: 11.5,
        fontWeight: 700,
        padding: '3px 10px',
        borderRadius: 14,
        color: sub.rated === sub.of ? '#1f9d57' : MK.MUTED,
        background: sub.rated === sub.of ? 'rgba(31,157,87,.12)' : 'rgba(125,145,180,.14)'
      }
    }, sub.sub, " / ", sec.max), React.createElement(Ic, {
      d: isOpen ? I.chevDown || 'M6 9l6 6 6-6' : I.chevRight || 'M9 18l6-6-6-6',
      s: 15
    })), isOpen && React.createElement("div", {
      style: {
        borderTop: '1px solid ' + MK.LINE,
        padding: '4px 14px 12px'
      }
    }, sec.params.map(p => {
      const v = Number(scores[p.sl]) || 0;
      const needsRemark = v === 1 || v === 2;
      const remarkMissing = needsRemark && !String(remarks[p.sl] || '').trim();
      const rc = v ? MK.RT[v][1] : null;
      return React.createElement("div", {
        key: p.sl,
        style: {
          padding: '12px 0',
          borderBottom: '1px solid rgba(125,145,180,.12)'
        }
      }, React.createElement("div", {
        style: {
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start'
        }
      }, React.createElement("span", {
        className: "num",
        style: {
          width: 24,
          height: 22,
          borderRadius: 6,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          fontSize: 10.5,
          fontWeight: 700,
          color: '#0072a3',
          background: 'rgba(0,144,202,.1)'
        }
      }, p.sl), React.createElement("div", {
        style: {
          flex: 1,
          minWidth: 0
        }
      }, React.createElement("div", {
        style: {
          fontWeight: 600,
          fontSize: 13,
          color: MK.INK
        }
      }, p.name), React.createElement("div", {
        style: {
          fontSize: 11.4,
          color: MK.MUTED,
          lineHeight: 1.5
        }
      }, p.desc)), v ? React.createElement("span", {
        style: MK.ratingPill(v)
      }, v, " \xB7 ", MK.RT[v][0]) : null), React.createElement("div", {
        style: {
          display: 'flex',
          gap: 7,
          marginTop: 10,
          flexWrap: 'wrap'
        }
      }, [5, 4, 3, 2, 1].map(n => {
        const on = v === n;
        const c = MK.RT[n][1];
        return React.createElement("button", {
          key: n,
          disabled: locked,
          onClick: () => setScore(p.sl, n),
          title: p.guide[n],
          style: {
            minWidth: 78,
            padding: '7px 10px',
            borderRadius: 9,
            cursor: locked ? 'default' : 'pointer',
            font: 'inherit',
            textAlign: 'center',
            border: '1px solid ' + (on ? c : 'rgba(125,145,180,.3)'),
            background: on ? c : 'rgba(255,255,255,.75)',
            color: on ? '#fff' : MK.BODY,
            boxShadow: on ? '0 5px 14px ' + c + '44' : 'none'
          }
        }, React.createElement("div", {
          className: "num",
          style: {
            fontSize: 15,
            fontWeight: 700,
            lineHeight: 1
          }
        }, n), React.createElement("div", {
          style: {
            fontSize: 8.6,
            fontWeight: 700,
            letterSpacing: .4,
            textTransform: 'uppercase',
            marginTop: 3,
            opacity: on ? .95 : .6
          }
        }, ['', 'Unsatisf.', 'Needs impr.', 'Good', 'Very good', 'Excellent'][n]));
      })), v ? React.createElement("div", {
        style: {
          marginTop: 9,
          padding: '7px 11px',
          borderLeft: '3px solid ' + rc,
          background: rc + '0e',
          borderRadius: '0 8px 8px 0',
          fontSize: 11.4,
          color: MK.BODY
        }
      }, React.createElement("b", null, "What earns ", v, " \u2014 ", MK.RT[v][0], ":"), " ", p.guide[v]) : null, React.createElement("input", {
        value: remarks[p.sl] || '',
        disabled: locked,
        onChange: e => setRemark(p.sl, e.target.value),
        placeholder: needsRemark ? 'Remark required for a rating of 1–2 — reference the incident or counselling record' : 'Remarks (optional)',
        style: {
          width: '100%',
          marginTop: 9,
          borderColor: remarkMissing ? '#d23a52' : undefined,
          background: remarkMissing ? 'rgba(210,58,82,.05)' : undefined
        }
      }));
    })));
  }), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Part G \u2014 Assessor\u2019s comments")), React.createElement("div", {
    className: "card-b",
    style: {
      display: 'grid',
      gap: 10
    }
  }, React.createElement("label", {
    style: {
      display: 'grid',
      gap: 4
    }
  }, React.createElement("span", {
    className: "sub"
  }, "Strongest areas"), React.createElement("textarea", {
    rows: "2",
    disabled: locked,
    value: strengths,
    onChange: e => {
      setStrengths(e.target.value);
      setDirty(true);
    }
  })), React.createElement("label", {
    style: {
      display: 'grid',
      gap: 4
    }
  }, React.createElement("span", {
    className: "sub"
  }, "Areas for development"), React.createElement("textarea", {
    rows: "2",
    disabled: locked,
    value: development,
    onChange: e => {
      setDevelopment(e.target.value);
      setDirty(true);
    }
  })), React.createElement("label", {
    style: {
      display: 'grid',
      gap: 4
    }
  }, React.createElement("span", {
    className: "sub"
  }, "Overall remarks"), React.createElement("textarea", {
    rows: "3",
    disabled: locked,
    value: assessorRemarks,
    onChange: e => {
      setAssessorRemarks(e.target.value);
      setDirty(true);
    }
  })), React.createElement("label", {
    style: {
      display: 'grid',
      gap: 4,
      maxWidth: 240
    }
  }, React.createElement("span", {
    className: "sub"
  }, "Discussed with the staff member on"), React.createElement("input", {
    type: "date",
    disabled: locked,
    value: discussedOn,
    onChange: e => {
      setDiscussedOn(e.target.value);
      setDirty(true);
    }
  })))), React.createElement(PartH, {
    row: row,
    saved: saved,
    perf: perf,
    live: {
      score: settled.score,
      grade: grade.grade
    },
    complete: canComplete,
    dirty: dirty,
    setRoute: setRoute
  })), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      position: 'sticky',
      top: 12
    }
  }, React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Score Summary"), React.createElement("span", {
    className: "sub"
  }, "carries forward live")), React.createElement("div", {
    className: "card-b"
  }, React.createElement(Speedo, {
    score: settled.score,
    rated: t.rated,
    of: t.of
  }), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
      marginTop: 12
    }
  }, t.sections.map(sc => {
    const done = sc.rated === sc.of;
    return React.createElement("div", {
      key: sc.no,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 0',
        borderBottom: '1px solid rgba(125,145,180,.1)'
      }
    }, React.createElement("span", {
      style: {
        width: 7,
        height: 7,
        borderRadius: '50%',
        flexShrink: 0,
        background: done ? secAccent(sc.no) : 'rgba(125,145,180,.35)'
      }
    }), React.createElement("span", {
      style: {
        flex: 1,
        fontSize: 11.4,
        color: done ? MK.BODY : MK.FAINT
      }
    }, sc.no, ". ", sc.title.charAt(0) + sc.title.slice(1).toLowerCase()), React.createElement("span", {
      className: "num",
      style: {
        fontSize: 11.4,
        fontWeight: 700,
        color: done ? MK.INK : MK.FAINT
      }
    }, done ? sc.sub : '–', "/", sc.max));
  })), (pointsBonus > 0 || pointsPenalty > 0) && React.createElement("div", {
    style: {
      marginTop: 9,
      paddingTop: 8,
      borderTop: '1px solid ' + MK.LINE,
      fontSize: 11.4
    }
  }, pointsBonus > 0 && React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      color: '#1f9d57'
    }
  }, React.createElement("span", null, "Achievement bonus"), React.createElement("b", {
    className: "num"
  }, "+", pointsBonus)), pointsPenalty > 0 && React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      color: '#d23a52'
    }
  }, React.createElement("span", null, "Incident deduction"), React.createElement("b", {
    className: "num"
  }, "\u2212", pointsPenalty))), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginTop: 10
    }
  }, React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 10.8,
      color: MK.FAINT
    }
  }, t.rated, " of ", t.of, " parameters rated"), React.createElement("span", {
    className: "num",
    style: {
      fontSize: 10.8,
      fontWeight: 700,
      color: MK.MUTED
    }
  }, Math.round(t.rated / t.of * 100), "%")), React.createElement("div", {
    style: MK.track(5)
  }, React.createElement("div", {
    style: MK.fill(t.rated / t.of * 100, '#0090ca')
  })))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7,
      fontSize: 11.6
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      color: t.complete ? '#1f9d57' : '#e08a1e'
    }
  }, React.createElement(Ic, {
    d: t.complete ? I.check || I.doc : I.alert || I.pulse,
    s: 14
  }), React.createElement("span", null, "All 20 parameters rated ", t.complete ? '✓' : '— ' + (t.of - t.rated) + ' left')), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      color: missing.length ? '#d23a52' : '#1f9d57'
    }
  }, React.createElement(Ic, {
    d: missing.length ? I.alert || I.pulse : I.check || I.doc,
    s: 14
  }), React.createElement("span", null, missing.length ? missing.length + ' low rating(s) need a written remark' : 'Low ratings carry a remark ✓')), React.createElement("div", {
    style: {
      fontSize: 10.6,
      color: MK.FAINT,
      borderTop: '1px solid ' + MK.LINE,
      paddingTop: 7
    }
  }, "Confidential \u2014 retained in the personal file of the nurse concerned."), dirty && React.createElement("div", {
    style: {
      fontSize: 10.8,
      color: '#e08a1e',
      textAlign: 'center'
    }
  }, "Unsaved changes"))))));
}
function PartH({
  row,
  saved,
  perf,
  live,
  complete,
  dirty,
  setRoute
}) {
  const a = saved || null;
  const filed = !!(a && a.status === 'actioned');
  const g = a && a.grade || live && live.grade || '';
  const suggested = A.CNS_ACTIONS.filter(x => x.suggest.indexOf(g) >= 0);
  const [action, setAction] = useState(null);
  const [remarks, setRemarks] = useState(a && a.authorityRemarks || '');
  const [next, setNext] = useState(a && a.nextReview || '');
  const [memo, setMemo] = useState(a && a.memoNo || '');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setAction(null);
    setRemarks(a && a.authorityRemarks || '');
    setNext(a && a.nextReview || '');
    setMemo(a && a.memoNo || '');
  }, [a && a.id, a && a.updatedAt, a && a.status]);
  const chosen = action != null ? action : a && a.actions && a.actions[0] || suggested[0] && suggested[0].id || '';
  const guide = A.gradeFor((a && a.score) != null ? a.score : live && live.score || 0);
  return React.createElement("div", {
    className: "card",
    style: filed ? {
      borderLeft: '3px solid #1f9d57'
    } : null
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Part H \u2014 Action by the Chief Nursing Superintendent"), React.createElement("div", {
    style: {
      flex: 1
    }
  }), g ? React.createElement("span", {
    style: MK.gchip(g)
  }, g) : null), React.createElement("div", {
    className: "card-b",
    style: {
      display: 'grid',
      gap: 10
    }
  }, !a ? React.createElement("div", {
    style: {
      fontSize: 11.6,
      color: MK.MUTED
    }
  }, "Save the appraisal first \u2014 the action is filed against the saved form.") : filed ? React.createElement("div", {
    style: {
      padding: '10px 12px',
      borderRadius: 10,
      background: 'rgba(31,157,87,.1)',
      fontSize: 11.6,
      color: '#1f7a48',
      lineHeight: 1.55
    }
  }, "\u2713 Action recorded \u2014 ", (a.actions || []).map(id => (A.CNS_ACTIONS.find(x => x.id === id) || {}).label || id).join(' · ') || '—', ". Form locked and filed to the personal record.", a.authorityRemarks ? React.createElement("div", {
    style: {
      marginTop: 5,
      color: MK.BODY
    }
  }, a.authorityRemarks) : null, React.createElement("div", {
    style: {
      marginTop: 5,
      color: MK.MUTED
    }
  }, "Next review ", a.nextReview || '—', " \xB7 Memo no. ", a.memoNo || '—')) : !perfIsAdmin() ? React.createElement("div", {
    style: {
      fontSize: 11.6,
      color: MK.MUTED
    }
  }, "Only the Chief Nursing Superintendent may record the Part H action.") : React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      fontSize: 11.6,
      color: MK.MUTED
    }
  }, "Grade ", g || '—', " \u2014 guidance: ", React.createElement("b", {
    style: {
      color: MK.INK
    }
  }, guide.interp)), a.discussedOn ? React.createElement("div", {
    style: {
      padding: '9px 12px',
      borderRadius: 10,
      background: 'rgba(31,157,87,.1)',
      color: '#1f7a48',
      fontSize: 11.5,
      lineHeight: 1.5
    }
  }, "\u2713 Discussed with the staff member on ", React.createElement("b", null, a.discussedOn), ".") : React.createElement("div", {
    style: {
      padding: '9px 12px',
      borderRadius: 10,
      background: 'rgba(224,138,30,.12)',
      color: '#b5670a',
      fontSize: 11.5,
      lineHeight: 1.5
    }
  }, "No discussion date recorded yet \u2014 hold the meeting with the staff member and enter the date in Part G above before filing."), React.createElement("label", {
    style: {
      display: 'grid',
      gap: 4
    }
  }, React.createElement("span", {
    className: "sub"
  }, "Action"), React.createElement("select", {
    value: chosen,
    onChange: e => setAction(e.target.value)
  }, React.createElement("option", {
    value: ""
  }, "Select action\u2026"), A.CNS_ACTIONS.map(x => React.createElement("option", {
    key: x.id,
    value: x.id
  }, x.label, x.suggest.indexOf(g) >= 0 ? '  (suggested)' : '')))), React.createElement("label", {
    style: {
      display: 'grid',
      gap: 4
    }
  }, React.createElement("span", {
    className: "sub"
  }, "Remarks / directions to the Nursing Office"), React.createElement("textarea", {
    rows: "3",
    value: remarks,
    onChange: e => setRemarks(e.target.value)
  })), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8
    }
  }, React.createElement("label", {
    style: {
      display: 'grid',
      gap: 4
    }
  }, React.createElement("span", {
    className: "sub"
  }, "Date of next review"), React.createElement("input", {
    type: "date",
    value: next,
    onChange: e => setNext(e.target.value)
  })), React.createElement("label", {
    style: {
      display: 'grid',
      gap: 4
    }
  }, React.createElement("span", {
    className: "sub"
  }, "Memo no."), React.createElement("input", {
    value: memo,
    onChange: e => setMemo(e.target.value)
  }))), dirty && React.createElement("div", {
    style: {
      fontSize: 11.2,
      color: '#b5670a'
    }
  }, "There are unsaved changes on the form. Save them first \u2014 the action is filed against the scores the server holds."), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, React.createElement("button", {
    className: "btn",
    onClick: () => setRoute({
      view: 'perfPrint',
      emp: row.empId
    })
  }, "Printable form"), React.createElement("button", {
    className: "btn pri",
    style: {
      flex: 1,
      justifyContent: 'center'
    },
    disabled: busy || !chosen || !complete || dirty,
    title: complete ? '' : 'Rate all 20 parameters and add remarks for any 1–2 first',
    onClick: () => {
      setBusy(true);
      perf.recordAction(a.id, {
        actions: [chosen],
        authorityRemarks: remarks,
        nextReview: next,
        memoNo: memo
      }).then(() => setBusy(false));
    }
  }, busy ? 'Recording…' : '✓ Record action & file')), React.createElement("div", {
    style: {
      fontSize: 10.8,
      color: MK.FAINT
    }
  }, "Filing locks the form. An administrator can reopen it from the banner at the top for a correction."))));
}
function PerfPrint({
  roster,
  empId,
  cycleId,
  setRoute
}) {
  const row = roster.byEmp[empId];
  const a = row && (cycleId ? (row.history || []).find(h => h.cycleId === cycleId) : row.appraisal);
  if (!row) return React.createElement(Empty, {
    title: "Staff member not found"
  });
  if (!a) {
    return React.createElement(Empty, {
      icon: I.doc,
      title: "No appraisal has been filed for this period",
      sub: row.name + ' has no completed form for ' + (cycleId && ((row.history || []).find(h => h.cycleId === cycleId) || {}).cycleLabel || row.cycle && row.cycle.label || 'this window') + '. Fill the form before printing it.'
    });
  }
  const t = A.tally(a && a.scores || {});
  const bonus = Math.min(row.achievements.reduce((s, x) => s + (Number(x.points) || 0), 0), A.BONUS_CAP);
  const pen = Math.min(row.incidents.reduce((s, x) => s + (Number(x.points) || 0), 0), A.PENALTY_CAP);
  const settled = A.finalScore(t.total, bonus, pen);
  const g = A.gradeFor(settled.score);
  const cell = {
    border: '1px solid #333',
    padding: '4px 6px',
    fontSize: 10.5,
    verticalAlign: 'top'
  };
  const th = {
    ...cell,
    background: '#eef2f7',
    fontWeight: 700,
    textAlign: 'left'
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
      alignItems: 'center'
    }
  }, React.createElement("button", {
    className: "btn",
    onClick: () => setRoute({
      view: 'perfForm',
      emp: empId
    })
  }, "\u2039 Back to the form"), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    className: "sub"
  }, "1:1 with the paper form \xB7 Form ", A.FORM_ID), React.createElement("button", {
    className: "btn pri",
    onClick: () => window.print()
  }, "Print / Save as PDF"))), React.createElement("div", {
    id: "pdf-root",
    style: {
      background: '#fff',
      color: '#111',
      padding: '22px 26px',
      borderRadius: 8,
      maxWidth: 940,
      margin: '0 auto'
    }
  }, React.createElement("div", {
    style: {
      textAlign: 'center',
      borderBottom: '2px solid #111',
      paddingBottom: 8,
      marginBottom: 12
    }
  }, React.createElement("div", {
    style: {
      fontSize: 10,
      letterSpacing: 1,
      color: '#b4232f',
      fontWeight: 700
    }
  }, "CONFIDENTIAL"), React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700
    }
  }, "INDIVIDUAL PERFORMANCE APPRAISAL"), React.createElement("div", {
    style: {
      fontSize: 10.5
    }
  }, "UNICO Hands of Care Hospitals \xB7 Nursing Services"), React.createElement("div", {
    style: {
      fontSize: 9.5,
      color: '#555'
    }
  }, "Form ", A.FORM_ID, " \xB7 ", A.FORM_REV)), React.createElement(SectionHead, null, "Part A \u2014 Employee identification"), React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      marginBottom: 12
    }
  }, React.createElement("tbody", null, React.createElement("tr", null, React.createElement("td", {
    style: th
  }, "Name"), React.createElement("td", {
    style: cell
  }, row.name), React.createElement("td", {
    style: th
  }, "Emp ID"), React.createElement("td", {
    style: cell
  }, row.empId)), React.createElement("tr", null, React.createElement("td", {
    style: th
  }, "Designation"), React.createElement("td", {
    style: cell
  }, row.designation), React.createElement("td", {
    style: th
  }, "Department"), React.createElement("td", {
    style: cell
  }, row.dept)), React.createElement("tr", null, React.createElement("td", {
    style: th
  }, "Date of joining"), React.createElement("td", {
    style: cell
  }, A.fmtDay(A.parseDate(row.doj))), React.createElement("td", {
    style: th
  }, "Appraisal period"), React.createElement("td", {
    style: cell
  }, row.cycle ? row.cycle.label : '—')))), React.createElement(SectionHead, null, "Part B \u2014 Rating key"), React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      marginBottom: 12
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: th
  }, "Score"), React.createElement("th", {
    style: th
  }, "Rating"), React.createElement("th", {
    style: th
  }, "Description"))), React.createElement("tbody", null, A.RATING_KEY.map(r => React.createElement("tr", {
    key: r.score
  }, React.createElement("td", {
    style: cell
  }, r.score), React.createElement("td", {
    style: cell
  }, r.label), React.createElement("td", {
    style: cell
  }, r.desc))))), React.createElement(SectionHead, null, "Part D \u2014 Performance assessment"), React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      marginBottom: 12
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: {
      ...th,
      width: 26
    }
  }, "SL"), React.createElement("th", {
    style: th
  }, "Performance parameter"), [5, 4, 3, 2, 1].map(n => React.createElement("th", {
    key: n,
    style: {
      ...th,
      width: 22,
      textAlign: 'center'
    }
  }, n)), React.createElement("th", {
    style: {
      ...th,
      width: 40,
      textAlign: 'center'
    }
  }, "Score"), React.createElement("th", {
    style: {
      ...th,
      width: 150
    }
  }, "Remarks"))), React.createElement("tbody", null, A.SECTIONS.map(sec => {
    const sub = t.sections.find(x => x.no === sec.no);
    return React.createElement(React.Fragment, {
      key: sec.no
    }, React.createElement("tr", null, React.createElement("td", {
      colSpan: "9",
      style: {
        ...cell,
        background: '#dde7f2',
        fontWeight: 700
      }
    }, "SECTION ", sec.no, " \u2014 ", sec.title)), sec.params.map(p => {
      const v = Number(a && a.scores && (a.scores[p.sl] != null ? a.scores[p.sl] : a.scores[String(p.sl)]) || 0);
      return React.createElement("tr", {
        key: p.sl
      }, React.createElement("td", {
        style: cell
      }, p.sl), React.createElement("td", {
        style: cell
      }, React.createElement("b", null, p.name), React.createElement("div", {
        style: {
          color: '#555',
          fontSize: 9.6
        }
      }, p.desc)), [5, 4, 3, 2, 1].map(n => React.createElement("td", {
        key: n,
        style: {
          ...cell,
          textAlign: 'center',
          fontWeight: 700
        }
      }, v === n ? '✓' : '')), React.createElement("td", {
        style: {
          ...cell,
          textAlign: 'center',
          fontWeight: 700
        }
      }, v || ''), React.createElement("td", {
        style: cell
      }, a && a.remarks && (a.remarks[p.sl] || a.remarks[String(p.sl)]) || ''));
    }), React.createElement("tr", null, React.createElement("td", {
      colSpan: "7",
      style: {
        ...cell,
        textAlign: 'right',
        fontWeight: 700
      }
    }, "SECTION SUB-TOTAL"), React.createElement("td", {
      style: {
        ...cell,
        textAlign: 'center',
        fontWeight: 700
      }
    }, sub.sub, " / ", sec.max), React.createElement("td", {
      style: cell
    })));
  }))), React.createElement(SectionHead, null, "Part E \u2014 Score summary"), React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      marginBottom: 12
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: {
      ...th,
      width: 26
    }
  }, "SL"), React.createElement("th", {
    style: th
  }, "Performance area"), React.createElement("th", {
    style: {
      ...th,
      width: 60
    }
  }, "Max."), React.createElement("th", {
    style: {
      ...th,
      width: 70
    }
  }, "Obtained"))), React.createElement("tbody", null, t.sections.map(s => React.createElement("tr", {
    key: s.no
  }, React.createElement("td", {
    style: cell
  }, s.no), React.createElement("td", {
    style: cell
  }, s.title), React.createElement("td", {
    style: {
      ...cell,
      textAlign: 'center'
    }
  }, s.max), React.createElement("td", {
    style: {
      ...cell,
      textAlign: 'center'
    }
  }, s.sub))), React.createElement("tr", {
    style: {
      fontWeight: 700
    }
  }, React.createElement("td", {
    style: cell
  }), React.createElement("td", {
    style: cell
  }, "GRAND TOTAL"), React.createElement("td", {
    style: {
      ...cell,
      textAlign: 'center'
    }
  }, "100"), React.createElement("td", {
    style: {
      ...cell,
      textAlign: 'center'
    }
  }, t.total)), bonus > 0 && React.createElement("tr", null, React.createElement("td", {
    style: cell
  }), React.createElement("td", {
    style: cell
  }, "Achievement bonus (capped at ", A.BONUS_CAP, ")"), React.createElement("td", {
    style: {
      ...cell,
      textAlign: 'center'
    }
  }, "+", A.BONUS_CAP), React.createElement("td", {
    style: {
      ...cell,
      textAlign: 'center'
    }
  }, "+", bonus)), pen > 0 && React.createElement("tr", null, React.createElement("td", {
    style: cell
  }), React.createElement("td", {
    style: cell
  }, "Incident deduction (capped at ", A.PENALTY_CAP, ")"), React.createElement("td", {
    style: {
      ...cell,
      textAlign: 'center'
    }
  }, "\u2212", A.PENALTY_CAP), React.createElement("td", {
    style: {
      ...cell,
      textAlign: 'center'
    }
  }, "\u2212", pen)), React.createElement("tr", {
    style: {
      fontWeight: 700,
      background: '#eef2f7'
    }
  }, React.createElement("td", {
    style: cell
  }), React.createElement("td", {
    style: cell
  }, "PERCENTAGE (marked out of 100 \u2014 the total obtained is the percentage)"), React.createElement("td", {
    style: {
      ...cell,
      textAlign: 'center'
    }
  }, "100"), React.createElement("td", {
    style: {
      ...cell,
      textAlign: 'center'
    }
  }, settled.score, " %")))), React.createElement(SectionHead, null, "Part F \u2014 Overall grade"), React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      marginBottom: 12
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: th
  }, "Percentage"), React.createElement("th", {
    style: th
  }, "Grade"), React.createElement("th", {
    style: th
  }, "Overall rating"), React.createElement("th", {
    style: th
  }, "Interpretation"))), React.createElement("tbody", null, A.GRADES.map(x => {
    const on = x.grade === g.grade;
    return React.createElement("tr", {
      key: x.grade,
      style: on ? {
        background: '#dff2e6',
        fontWeight: 700
      } : null
    }, React.createElement("td", {
      style: cell
    }, x.min === 0 ? 'Below 50 %' : x.min + ' – ' + (x.min === 90 ? 100 : A.GRADES[A.GRADES.indexOf(x) - 1] ? A.GRADES[A.GRADES.indexOf(x) - 1].min - 1 : 100) + ' %'), React.createElement("td", {
      style: cell
    }, x.grade), React.createElement("td", {
      style: cell
    }, x.rating), React.createElement("td", {
      style: cell
    }, x.interp));
  }))), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 20,
      marginBottom: 14,
      fontSize: 11
    }
  }, React.createElement("div", null, React.createElement("b", null, "Grade awarded:"), " ", g.grade), React.createElement("div", null, React.createElement("b", null, "Overall rating:"), " ", g.rating)), React.createElement(SectionHead, null, "Part G \u2014 Assessor's comments & signatures"), React.createElement("div", {
    style: {
      border: '1px solid #333',
      padding: 8,
      fontSize: 10.5,
      marginBottom: 12,
      minHeight: 54
    }
  }, a && a.assessorRemarks || React.createElement("span", {
    style: {
      color: '#999'
    }
  }, "\u2014"), a && a.strengths ? React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, React.createElement("b", null, "Strongest areas:"), " ", a.strengths) : null, a && a.development ? React.createElement("div", null, React.createElement("b", null, "Areas for development:"), " ", a.development) : null), a && a.status === 'actioned' && React.createElement(React.Fragment, null, React.createElement(SectionHead, null, "Part H \u2014 Action by the Chief Nursing Superintendent"), React.createElement("div", {
    style: {
      border: '1px solid #333',
      padding: 8,
      fontSize: 10.5,
      marginBottom: 12
    }
  }, React.createElement("div", null, React.createElement("b", null, "Action:"), " ", (a.actions || []).map(id => (A.CNS_ACTIONS.find(x => x.id === id) || {}).label || id).join(' · ') || '—'), a.authorityRemarks && React.createElement("div", {
    style: {
      marginTop: 4
    }
  }, React.createElement("b", null, "Remarks:"), " ", a.authorityRemarks), React.createElement("div", {
    style: {
      marginTop: 4
    }
  }, React.createElement("b", null, "Date of next review:"), " ", a.nextReview || '—', " \xA0 ", React.createElement("b", null, "Memo no.:"), " ", a.memoNo || '—'))), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 18,
      marginTop: 26,
      fontSize: 10.5
    }
  }, ['Chief Nursing Superintendent — Assessor', 'Employee — discussed & acknowledged', 'Hospital Administrator — countersign'].map(l => React.createElement("div", {
    key: l,
    style: {
      borderTop: '1px solid #333',
      paddingTop: 5
    }
  }, l))), React.createElement("div", {
    style: {
      textAlign: 'center',
      fontSize: 9,
      color: '#777',
      marginTop: 16
    }
  }, "Confidential \u2014 retained in the personal file of the nurse concerned. \xB7 Page 1 of 1")));
}
function SectionHead({
  children
}) {
  return React.createElement("div", {
    style: {
      background: '#16202e',
      color: '#fff',
      padding: '4px 8px',
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: .4,
      marginBottom: 6
    }
  }, children);
}
function Barcode({
  value
}) {
  const v = String(value || '');
  let h = 7;
  for (let i = 0; i < v.length; i++) h = (h * 31 + v.charCodeAt(i)) % 100000;
  const bars = [];
  let seed = h;
  for (let i = 0; i < 46; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    bars.push(1 + seed % 3);
  }
  return React.createElement("div", {
    style: {
      textAlign: 'center'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 1.5,
      height: 42,
      justifyContent: 'center'
    }
  }, bars.map((w, i) => React.createElement("div", {
    key: i,
    style: {
      width: w,
      height: '100%',
      background: i % 2 ? 'transparent' : '#16202e'
    }
  }))), React.createElement("div", {
    className: "num",
    style: {
      fontSize: 10.5,
      letterSpacing: 2,
      color: MK.BODY,
      marginTop: 4
    }
  }, v));
}
function MiniStat({
  label,
  value,
  tone
}) {
  return React.createElement("div", {
    style: {
      padding: '7px 12px',
      borderRadius: 10,
      background: 'rgba(255,255,255,.6)',
      border: '1px solid rgba(125,145,180,.2)',
      minWidth: 92
    }
  }, React.createElement("div", {
    style: {
      fontSize: 8.8,
      fontWeight: 700,
      letterSpacing: .5,
      textTransform: 'uppercase',
      color: MK.FAINT
    }
  }, label), React.createElement("div", {
    className: "num",
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: tone || MK.INK,
      marginTop: 2
    }
  }, value));
}
function PerfStaffRecord({
  roster,
  perf,
  empId,
  setRoute
}) {
  const row = roster.byEmp[empId];
  if (!row) return React.createElement(Empty, {
    icon: I.user,
    title: "Staff member not found"
  });
  const hist = row.history.slice().reverse();
  const latest = row.last;
  const isPca = isPcaRow(row);
  const idRow = (k, v) => React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 10,
      padding: '7px 0',
      borderBottom: '1px solid rgba(125,145,180,.14)'
    }
  }, React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 9.6,
      fontWeight: 700,
      letterSpacing: .5,
      textTransform: 'uppercase',
      color: MK.FAINT
    }
  }, k), React.createElement("span", {
    className: "num",
    style: {
      fontSize: 11.6,
      fontWeight: 700,
      color: MK.INK,
      textAlign: 'right'
    }
  }, v || '—'));
  return React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, React.createElement("button", {
    className: "btn",
    onClick: () => setRoute({
      view: 'perfDirectory'
    })
  }, "\u2039 Performance"), React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: MK.FAINT
    }
  }, "Staff performance record")), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '320px minmax(0,1fr)',
      gap: 14,
      alignItems: 'start'
    }
  }, React.createElement("div", {
    className: "card",
    style: {
      position: 'sticky',
      top: 12
    }
  }, React.createElement("div", {
    style: {
      display: 'grid',
      placeItems: 'center',
      paddingTop: 8
    }
  }, React.createElement("div", {
    style: {
      width: 46,
      height: 4,
      borderRadius: 3,
      background: 'rgba(125,145,180,.3)'
    }
  })), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 16px'
    }
  }, React.createElement("img", {
    src: "unico/logo.svg",
    alt: "UNICO",
    style: {
      height: 26
    }
  }), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 9.6,
      fontWeight: 700,
      letterSpacing: .6,
      padding: '4px 9px',
      borderRadius: 7,
      color: '#fff',
      background: 'linear-gradient(135deg,#27a8db,#0072a3)'
    }
  }, React.createElement(Ic, {
    d: I.steth || I.user,
    s: 11
  }), isPca ? 'PCA ID' : 'NURSE ID')), React.createElement("div", {
    style: {
      height: 3,
      background: 'linear-gradient(90deg,#3ab5a7,#27a8db)'
    }
  }), React.createElement("div", {
    style: {
      padding: '16px 18px 14px',
      textAlign: 'center'
    }
  }, React.createElement("div", {
    style: {
      width: 132,
      height: 132,
      margin: '0 auto',
      borderRadius: '50%',
      overflow: 'hidden',
      border: '4px solid #fff',
      boxShadow: '0 8px 24px rgba(31,59,90,.16)',
      background: 'linear-gradient(160deg,#eaf4fb,#dceaf5)'
    }
  }, React.createElement(MK.Av, {
    name: row.name,
    emp: row.emp,
    empId: row.empId,
    size: 132,
    radius: 0,
    style: {
      width: '100%',
      height: '100%',
      fontSize: 44
    }
  })), React.createElement("div", {
    style: {
      fontSize: 17,
      fontWeight: 700,
      color: MK.INK,
      marginTop: 11
    }
  }, row.name), React.createElement("div", {
    style: {
      fontSize: 12.4,
      fontWeight: 600,
      color: '#0090ca',
      marginTop: 1
    }
  }, row.designation || '—'), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      justifyContent: 'center',
      marginTop: 8
    }
  }, React.createElement("span", {
    style: MK.roleChip(isPca ? 'PCA' : 'Nurse')
  }, isPca ? 'PCA' : 'Nurse'), React.createElement("span", {
    style: MK.stChip('Actioned')
  }, React.createElement("span", {
    style: {
      width: 5,
      height: 5,
      borderRadius: '50%',
      background: 'currentColor',
      marginRight: 5
    }
  }), "Active"))), React.createElement("div", {
    style: {
      padding: '0 18px 12px'
    }
  }, idRow('ID no.', row.empId), idRow('Department', row.dept), idRow('Joined', row.doj), idRow('Experience', row.emp && row.emp.total_experience_text), idRow('Phone', row.emp && row.emp.phone)), React.createElement("div", {
    style: {
      padding: '10px 18px 16px',
      borderTop: '1px solid ' + MK.LINE
    }
  }, React.createElement(Barcode, {
    value: row.empId
  }))), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "card",
    style: {
      borderLeft: '3px solid #0090ca'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      padding: '13px 16px'
    }
  }, React.createElement("div", {
    style: MK.iconBadge('blue', 32)
  }, React.createElement(Ic, {
    d: I.doc,
    s: 16
  })), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: MK.INK
    }
  }, "Performance"), React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: MK.MUTED,
      marginLeft: 8
    }
  }, "every 6 months from DOJ (", A.fmtDay(A.parseDate(row.doj)), ")")), perfCan('edit') && row.cycle && React.createElement("button", {
    className: "btn pri",
    onClick: () => setRoute({
      view: 'perfForm',
      emp: row.empId
    })
  }, row.appraisal ? row.status === 'actioned' ? 'View appraisal' : 'Continue appraisal' : '+ Start ' + row.cycle.label + ' appraisal')), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 18,
      alignItems: 'center',
      flexWrap: 'wrap',
      padding: '0 16px 14px'
    }
  }, React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 230
    }
  }, React.createElement("div", {
    style: {
      fontSize: 9.6,
      fontWeight: 700,
      letterSpacing: .6,
      textTransform: 'uppercase',
      color: MK.FAINT
    }
  }, latest ? 'Latest grade · ' + latest.cycleLabel : 'No appraisal filed yet'), latest ? React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 10,
      marginTop: 3
    }
  }, React.createElement("span", {
    style: {
      fontSize: 38,
      fontWeight: 700,
      lineHeight: 1,
      color: gradeColor(latest.grade)
    }
  }, latest.grade), React.createElement("span", {
    className: "num",
    style: {
      fontSize: 19,
      fontWeight: 700,
      color: MK.INK
    }
  }, latest.score), React.createElement("span", {
    className: "num",
    style: {
      fontSize: 14,
      color: MK.FAINT
    }
  }, "/ 100")), React.createElement("div", {
    style: {
      fontSize: 11.8,
      color: MK.MUTED,
      marginTop: 2
    }
  }, A.gradeFor(latest.score).rating, " \u2014 ", A.gradeFor(latest.score).interp)) : React.createElement("div", {
    style: {
      fontSize: 12,
      color: MK.MUTED,
      marginTop: 4
    }
  }, "The first appraisal falls six months after joining", row.cycle ? ' — current window ' + row.cycle.label : '', ".")), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, React.createElement(MiniStat, {
    label: "Appraisals",
    value: row.history.length
  }), hist.length > 1 && React.createElement(MiniStat, {
    label: 'Since ' + String(hist[0].cycleLabel).slice(-4),
    value: function () {
      var d = hist[hist.length - 1].score - hist[0].score;
      return (d >= 0 ? '▲ ' : '▼ ') + Math.abs(d) + ' pts';
    }(),
    tone: hist[hist.length - 1].score - hist[0].score >= 0 ? '#1f9d57' : '#d23a52'
  }), React.createElement(MiniStat, {
    label: "Next due",
    value: row.cycle ? A.fmtDay(row.cycle.due) : '—'
  })))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Score trend"), React.createElement("span", {
    className: "sub"
  }, hist.length ? hist.length + ' appraisal cycle(s)' : 'no cycles yet')), React.createElement("div", {
    className: "card-b"
  }, hist.length === 0 ? React.createElement(Empty, {
    title: "No completed appraisals yet",
    sub: "The trend appears once the first form is filed."
  }) : React.createElement(Trend, {
    points: hist.map(h => ({
      label: h.cycleLabel,
      v: h.score,
      grade: h.grade
    }))
  }))), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))',
      gap: 14
    }
  }, React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Latest breakdown"), React.createElement("span", {
    className: "sub"
  }, latest ? latest.cycleLabel + ' · by section' : '—')), React.createElement("div", {
    className: "card-b"
  }, !latest ? React.createElement(Empty, {
    title: "Nothing to break down yet"
  }) : React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, A.tally(latest.scores).sections.map(sc => React.createElement("div", {
    key: sc.no,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9
    }
  }, React.createElement("div", {
    style: {
      width: 128,
      fontSize: 11.2,
      color: MK.BODY
    }
  }, sc.title.charAt(0) + sc.title.slice(1).toLowerCase()), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement(Bar, {
    value: sc.sub,
    max: sc.max,
    color: MK.barColor(sc.sub / sc.max * 100)
  })), React.createElement("div", {
    className: "num",
    style: {
      width: 46,
      textAlign: 'right',
      fontSize: 11.5,
      fontWeight: 700
    }
  }, sc.sub, "/", sc.max)))))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Appraisal history"), React.createElement("span", {
    className: "sub"
  }, "confidential \u2014 personal file")), React.createElement("div", {
    className: "card-b",
    style: {
      overflow: 'auto'
    }
  }, row.history.length === 0 ? React.createElement(Empty, {
    title: "No filed appraisals"
  }) : React.createElement("table", {
    className: "tbl"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Period"), React.createElement("th", null, "Score"), React.createElement("th", null, "Grade"), React.createElement("th", null, "Part H"), React.createElement("th", null))), React.createElement("tbody", null, row.history.map(h => React.createElement("tr", {
    key: h.id
  }, React.createElement("td", null, h.cycleLabel), React.createElement("td", {
    className: "num"
  }, h.score), React.createElement("td", null, React.createElement(GradePill, {
    grade: h.grade
  })), React.createElement("td", {
    className: "sub"
  }, (h.actions || []).map(id => (A.CNS_ACTIONS.find(x => x.id === id) || {}).label || id).join(' · ') || '—'), React.createElement("td", {
    style: {
      textAlign: 'right'
    }
  }, React.createElement("button", {
    className: "btn",
    onClick: () => setRoute({
      view: 'perfPrint',
      emp: row.empId
    })
  }, "Print"))))))))), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))',
      gap: 14
    }
  }, React.createElement(EntryList, {
    title: "Achievements and awards",
    sub: 'Cap is ' + capsOf(perf).bonus + ' bonus points per cycle',
    tone: "#1f9d57",
    tint: "green",
    icon: I.heart,
    rows: row.achievements,
    empty: "No achievements recorded for this staff member yet.",
    onOpen: () => setRoute({
      view: 'perfAchievements',
      emp: row.empId
    })
  }), React.createElement(EntryList, {
    title: "Mistakes and incidents",
    sub: 'Cap is ' + capsOf(perf).penalty + ' points per cycle',
    tone: "#d23a52",
    tint: "red",
    icon: I.alert || I.pulse,
    negative: true,
    rows: row.incidents,
    empty: "Clean record for this cycle \u2014 no error, lapse or disciplinary entry on file.",
    onOpen: () => setRoute({
      view: 'perfIncidents',
      emp: row.empId
    })
  })))));
}
function EntryList({
  title,
  sub,
  rows,
  empty,
  tone,
  tint,
  icon,
  negative,
  onOpen
}) {
  return React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h",
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'center'
    }
  }, React.createElement("div", {
    style: MK.iconBadge(tint || 'slate', 30)
  }, React.createElement(Ic, {
    d: icon || I.doc,
    s: 15
  })), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("h3", null, title), React.createElement("div", {
    className: "sub"
  }, sub)), React.createElement("button", {
    className: "btn",
    onClick: onOpen
  }, "Open register \u203A")), React.createElement("div", {
    className: "card-b"
  }, rows.length === 0 ? React.createElement("div", {
    className: "sub",
    style: {
      padding: '14px 0',
      textAlign: 'center'
    }
  }, empty) : React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7
    }
  }, rows.map(r => React.createElement("div", {
    key: r.id,
    style: {
      display: 'flex',
      gap: 9,
      alignItems: 'flex-start',
      paddingBottom: 7,
      borderBottom: '1px solid var(--line,#eef2f7)'
    }
  }, React.createElement("span", {
    className: "tag num",
    style: {
      color: tone,
      borderColor: tone + '55',
      background: tone + '14'
    }
  }, negative ? '−' : '+', r.points), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12.2,
      fontWeight: 600
    }
  }, r.what), React.createElement("div", {
    className: "sub",
    style: {
      fontSize: 11
    }
  }, r.category, r.level ? ' · ' + r.level : '', r.severity ? ' · ' + r.severity : '', " \xB7 ", r.date)))))));
}
function Trend({
  points
}) {
  if (!points.length) return null;
  const w = 320,
    h = 130,
    pad = 24;
  const max = 100,
    min = Math.max(0, Math.min(...points.map(p => p.v)) - 10);
  const x = i => pad + (points.length === 1 ? (w - pad * 2) / 2 : i * (w - pad * 2) / (points.length - 1));
  const y = v => h - pad - (v - min) / (max - min) * (h - pad * 2);
  const d = points.map((p, i) => (i ? 'L' : 'M') + x(i) + ' ' + y(p.v)).join(' ');
  return React.createElement("div", null, React.createElement("svg", {
    viewBox: '0 0 ' + w + ' ' + h,
    style: {
      width: '100%',
      height: 150
    }
  }, [min, Math.round((min + max) / 2), max].map(v => React.createElement("g", {
    key: v
  }, React.createElement("line", {
    x1: pad,
    x2: w - pad,
    y1: y(v),
    y2: y(v),
    stroke: "rgba(130,150,175,.22)",
    strokeDasharray: "3 3"
  }), React.createElement("text", {
    x: 2,
    y: y(v) + 3,
    style: {
      fontSize: 8,
      fill: '#8aa0b8'
    }
  }, v))), React.createElement("path", {
    d: d,
    fill: "none",
    stroke: "#27a8db",
    strokeWidth: "2.2",
    strokeLinecap: "round"
  }), points.map((p, i) => React.createElement("circle", {
    key: i,
    cx: x(i),
    cy: y(p.v),
    r: "4",
    fill: gradeColor(p.grade),
    stroke: "#fff",
    strokeWidth: "1.6"
  }))), React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 10,
      color: '#8aa0b8',
      gap: 4
    }
  }, points.map((p, i) => React.createElement("span", {
    key: i,
    style: {
      flex: 1,
      textAlign: 'center'
    }
  }, String(p.label).split(' - ')[0]))), points.length > 1 && React.createElement("div", {
    className: "sub",
    style: {
      textAlign: 'center',
      marginTop: 6,
      fontSize: 11.5
    }
  }, (() => {
    const d2 = points[points.length - 1].v - points[0].v;
    return (d2 >= 0 ? '▲ ' : '▼ ') + Math.abs(d2) + ' points since ' + String(points[0].label).split(' - ')[0];
  })()));
}
const ACH_CATEGORIES = A.ACH_CATEGORIES;
const INC_CATEGORIES = A.INC_CATEGORIES;
const SEVERITIES = A.SEVERITIES;
const catsOf = (perf, kind) => {
  const c = perf && perf.categories || null;
  const list = c && (kind === 'ach' ? c.ach : c.inc);
  return Array.isArray(list) && list.length ? list : kind === 'ach' ? ACH_CATEGORIES : INC_CATEGORIES;
};
const SEV_TONE = {
  Minor: '#e08a1e',
  Moderate: '#b5670a',
  Major: '#d23a52',
  Critical: '#8f2033'
};
const sevTone = v => SEV_TONE[v] || '#8a93a3';
const sevPoints = v => {
  const s = SEVERITIES.find(x => x[0] === v);
  return s ? s[1] : null;
};
const tagPill = (c, soft) => ({
  display: 'inline-flex',
  fontSize: 10.5,
  fontWeight: 700,
  padding: '2px 9px',
  borderRadius: 12,
  color: c,
  background: c + (soft ? '1a' : '18'),
  whiteSpace: 'nowrap'
});
function AccentStat({
  label,
  value,
  sub,
  color
}) {
  return React.createElement("div", {
    className: "card",
    style: {
      padding: '13px 16px',
      borderLeft: '3px solid ' + color
    }
  }, React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: .6,
      textTransform: 'uppercase',
      color: MK.FAINT
    }
  }, label), React.createElement("div", {
    className: "num",
    style: {
      fontSize: 30,
      fontWeight: 700,
      color: color,
      lineHeight: 1.05,
      margin: '4px 0 3px',
      letterSpacing: '-.5px'
    }
  }, value), React.createElement("div", {
    style: {
      fontSize: 11,
      color: MK.FAINT
    }
  }, sub));
}
function monthlyCounts(rows, months) {
  const now = new Date();
  const out = [];
  for (let k = months - 1; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    out.push({
      key,
      label: A.MONTHS[d.getMonth()] + (d.getMonth() === 0 ? ' ' + String(d.getFullYear()).slice(2) : ''),
      n: rows.filter(r => String(r.date || '').slice(0, 7) === key).length
    });
  }
  return out;
}
const CAT_COLORS = ['#0090ca', '#e08a1e', '#6a52d4', '#d23a52', '#3ab5a7', '#1f9d57', '#e0a12a', '#27a8db', '#c05621', '#8aa0b8'];
function PerfRegister({
  kind,
  roster,
  perf,
  setRoute,
  focusEmp
}) {
  const isAch = kind === 'ach';
  const rows = isAch ? perf.achievements : perf.incidents;
  const tone = isAch ? '#1f9d57' : '#d23a52';
  const caps = capsOf(perf);
  const cap = isAch ? caps.bonus : caps.penalty;
  const org = A.orgCycle(new Date());
  const [screen, setScreen] = useState(focusEmp ? 'staff' : 'home');
  const [staffSel, setStaffSel] = useState(focusEmp || '');
  const openStaff = id => {
    setStaffSel(id);
    setScreen('staff');
  };
  const [cat, setCat] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingCats, setEditingCats] = useState(false);
  const [cert, setCert] = useState(null);
  const list = useMemo(() => {
    let l = rows.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (cat) l = l.filter(x => x.category === cat);
    if (focusEmp) l = l.filter(x => x.empId === focusEmp);
    return l;
  }, [rows, cat, focusEmp]);
  const points = rows.reduce((t, r) => t + (Number(r.points) || 0), 0);
  const people = new Set(rows.map(r => r.empId)).size;
  const certs = rows.filter(r => r.certificate || r.reward && /certificate/i.test(r.reward)).length;
  const series = useMemo(() => monthlyCounts(rows, 12), [rows]);
  const maxN = Math.max(1, ...series.map(m => m.n));
  const byCat = useMemo(() => {
    const m = {};
    rows.forEach(r => {
      const c = r.category || 'Uncategorised';
      m[c] = (m[c] || 0) + 1;
    });
    const total = rows.length || 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([name, n], i) => ({
      name,
      n,
      pctv: Math.round(n / total * 100),
      color: CAT_COLORS[i % CAT_COLORS.length]
    }));
  }, [rows]);
  const leaders = useMemo(() => {
    const m = {};
    rows.forEach(r => {
      const k = r.empId;
      m[k] = m[k] || {
        empId: k,
        name: r.staffName,
        dept: r.department,
        pts: 0,
        n: 0
      };
      m[k].pts += Number(r.points) || 0;
      m[k].n++;
    });
    return Object.values(m).sort((a, b) => b.pts - a.pts).slice(0, 8);
  }, [rows]);
  const catColor = useMemo(() => {
    const m = {};
    byCat.forEach(c => {
      m[c.name] = c.color;
    });
    return name => m[name] || '#8a93a3';
  }, [byCat]);
  const sevMix = useMemo(() => {
    if (isAch) return [];
    const m = {};
    rows.forEach(r => {
      const k = r.severity || 'Unspecified';
      m[k] = m[k] || {
        label: k,
        n: 0,
        recorded: 0
      };
      m[k].n++;
      m[k].recorded += Number(r.points) || 0;
    });
    const order = SEVERITIES.map(s => s[0]);
    const total = rows.length || 1;
    return Object.values(m).sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label)).map(x => ({
      ...x,
      pts: sevPoints(x.label) != null ? sevPoints(x.label) : Math.round(x.recorded / x.n),
      pctv: Math.round(x.n / total * 100),
      color: sevTone(x.label)
    }));
  }, [rows, isAch]);
  const sevArcs = useMemo(() => {
    const C = 2 * Math.PI * 58;
    const tot = sevMix.reduce((t, x) => t + x.n, 0) || 1;
    let acc = 0;
    return sevMix.filter(x => x.n).map(x => {
      const len = x.n / tot * C;
      const arc = {
        key: x.label,
        color: x.color,
        dash: len.toFixed(1) + ' ' + (C - len).toFixed(1),
        off: (-acc).toFixed(1)
      };
      acc += len;
      return arc;
    });
  }, [sevMix]);
  const byUnit = useMemo(() => {
    const m = {};
    rows.forEach(r => {
      const d = r.department || 'Unassigned';
      m[d] = (m[d] || 0) + 1;
    });
    return Object.entries(m).map(([name, n]) => ({
      name,
      n
    })).sort((a, b) => b.n - a.n);
  }, [rows]);
  const unitMax = Math.max(1, ...byUnit.map(u => u.n));
  return React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, screen === 'staff' ? React.createElement(PerfEntryHistory, {
    kind: kind,
    roster: roster,
    perf: perf,
    empId: staffSel,
    caps: caps,
    onBack: () => setScreen('register'),
    onCert: setCert,
    setRoute: setRoute
  }) : React.createElement(React.Fragment, null, React.createElement("div", {
    className: "card",
    style: {
      padding: '16px 18px',
      display: 'flex',
      gap: 16,
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 260
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: .6,
      textTransform: 'uppercase',
      color: tone
    }
  }, React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: tone
    }
  }), isAch ? 'Recognition · Nursing staff' : 'Conduct · Nursing staff'), React.createElement("div", {
    style: {
      fontSize: 21,
      fontWeight: 700,
      color: MK.INK,
      margin: '3px 0 2px'
    }
  }, isAch ? 'Nurse Achievements' : 'Mistakes and Incidents'), React.createElement("div", {
    style: {
      fontSize: 11.8,
      color: MK.MUTED
    }
  }, isAch ? 'Training, awards and commendations recorded against ' + roster.rows.length + ' staff · ' + org.label : 'Errors, lapses and disciplinary entries recorded against ' + roster.rows.length + ' staff · ' + org.label)), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, isAch && React.createElement("button", {
    className: "btn",
    onClick: () => setRoute({
      view: 'perfBoard'
    })
  }, "Recognition board"), React.createElement("button", {
    className: "btn",
    onClick: () => setScreen(screen === 'home' ? 'register' : 'home')
  }, screen === 'home' ? 'Register' : 'Overview'), perfIsAdmin() && React.createElement("button", {
    className: "btn",
    onClick: () => setEditingCats(true)
  }, "Manage categories"), perfCan('add') && React.createElement("button", {
    className: "btn pri",
    onClick: () => setAdding(true)
  }, "+ ", isAch ? 'Record an achievement' : 'Record an incident'))), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))',
      gap: 12
    }
  }, React.createElement(AccentStat, {
    label: "Recorded this cycle",
    value: rows.length,
    sub: 'across ' + byCat.length + ' ' + (isAch ? 'achievement and award' : 'incident') + ' categories',
    color: "#0090ca"
  }), React.createElement(AccentStat, {
    label: isAch ? 'Staff recognised' : 'Staff with entries',
    value: people,
    sub: roster.rows.length ? Math.round(people / roster.rows.length * 100) + '% of the nursing roster' : '—',
    color: isAch ? '#1f9d57' : '#d23a52'
  }), React.createElement(AccentStat, {
    label: isAch ? 'Bonus points awarded' : 'Points deducted',
    value: points,
    sub: people ? 'average ' + (points / people).toFixed(1) + ' points per staff member' : 'none yet',
    color: "#6a52d4"
  }), React.createElement(AccentStat, {
    label: isAch ? 'Certificates issued' : 'Repeat cases',
    value: isAch ? certs : leaders.filter(l => l.n > 1).length,
    sub: isAch ? 'recognition with a certificate' : 'more than one entry this cycle',
    color: "#e08a1e"
  })), screen === 'home' ? React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1.25fr) minmax(320px,1fr)',
      gap: 14,
      alignItems: 'start'
    }
  }, React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Entries recorded per month"), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    className: "sub"
  }, "last 12 months")), React.createElement("div", {
    className: "card-b"
  }, rows.length === 0 ? React.createElement(Empty, {
    icon: isAch ? I.heart : I.alert || I.pulse,
    title: isAch ? 'Nothing recorded yet' : 'No incidents recorded',
    sub: isAch ? 'Recognition recorded here adds bonus points to the current appraisal.' : 'A clean register is a good thing — entries here deduct points from the appraisal.'
  }) : React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 6,
      height: 190,
      paddingTop: 18
    }
  }, series.map(m => React.createElement("div", {
    key: m.key,
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 5,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "num",
    style: {
      fontSize: 10.5,
      color: m.n ? MK.BODY : 'transparent'
    }
  }, m.n || 0), React.createElement("div", {
    style: {
      width: '100%',
      height: Math.max(3, m.n / maxN * 132),
      borderRadius: '5px 5px 0 0',
      background: 'linear-gradient(180deg,' + (isAch ? '#5bc0e8,#0090ca' : '#e88a8a,#d23a52') + ')',
      animation: MK.ANIM
    }
  }), React.createElement("div", {
    style: {
      fontSize: 9.2,
      color: MK.FAINT,
      whiteSpace: 'nowrap'
    }
  }, m.label)))))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Categories recorded"), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    className: "sub"
  }, "this cycle")), React.createElement("div", {
    className: "card-b"
  }, byCat.length === 0 ? React.createElement("div", {
    className: "sub",
    style: {
      textAlign: 'center',
      padding: 18
    }
  }, "Nothing recorded yet.") : React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      display: 'flex',
      height: 7,
      borderRadius: 5,
      overflow: 'hidden',
      marginBottom: 12
    }
  }, byCat.map(c => React.createElement("div", {
    key: c.name,
    style: {
      width: c.pctv + '%',
      background: c.color
    }
  }))), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7
    }
  }, byCat.map(c => React.createElement("div", {
    key: c.name,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      cursor: 'pointer'
    },
    onClick: () => {
      setCat(cat === c.name ? '' : c.name);
      setScreen('register');
    }
  }, React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: c.color,
      flexShrink: 0
    }
  }), React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 11.6,
      color: MK.BODY,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, c.name), React.createElement("div", {
    style: {
      width: 62
    }
  }, React.createElement(Bar, {
    value: c.n,
    max: byCat[0].n,
    color: c.color,
    height: 5
  })), React.createElement("span", {
    className: "num",
    style: {
      width: 22,
      textAlign: 'right',
      fontSize: 11.4,
      fontWeight: 700,
      color: MK.INK
    }
  }, c.n), React.createElement("span", {
    className: "num",
    style: {
      width: 32,
      textAlign: 'right',
      fontSize: 11,
      color: c.color
    }
  }, c.pctv, "%"))))), React.createElement("div", {
    style: {
      marginTop: 12,
      padding: '9px 11px',
      borderRadius: 9,
      background: 'rgba(0,144,202,.07)',
      fontSize: 11.2,
      color: MK.BODY
    }
  }, "Points from these entries ", isAch ? 'carry into' : 'come off', " the 6-monthly appraisal, capped at ", React.createElement("b", null, cap), " per staff member per cycle.")))), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))',
      gap: 14,
      alignItems: 'start'
    }
  }, !isAch && React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Severity mix"), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    className: "sub"
  }, "points deducted per entry")), sevMix.length === 0 ? React.createElement("div", {
    className: "card-b"
  }, React.createElement("div", {
    className: "sub",
    style: {
      textAlign: 'center',
      padding: 18
    }
  }, "Nothing recorded yet.")) : React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap'
    }
  }, React.createElement("svg", {
    viewBox: "0 0 160 160",
    style: {
      width: 128,
      display: 'block',
      flexShrink: 0
    }
  }, React.createElement("circle", {
    cx: "80",
    cy: "80",
    r: "58",
    fill: "none",
    stroke: "rgba(125,145,180,.16)",
    strokeWidth: "16"
  }), sevArcs.map(a => React.createElement("circle", {
    key: a.key,
    cx: "80",
    cy: "80",
    r: "58",
    fill: "none",
    stroke: a.color,
    strokeWidth: "16",
    strokeDasharray: a.dash,
    strokeDashoffset: a.off,
    transform: "rotate(-90 80 80)"
  })), React.createElement("text", {
    x: "80",
    y: "76",
    textAnchor: "middle",
    fontSize: "26",
    fontWeight: "700",
    fill: MK.INK,
    fontFamily: MK.MONO
  }, rows.length), React.createElement("text", {
    x: "80",
    y: "94",
    textAnchor: "middle",
    fontSize: "10",
    fill: MK.FAINT
  }, "entries")), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 145,
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, sevMix.map(s => React.createElement("div", {
    key: s.label,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: 3,
      background: s.color,
      display: 'inline-block',
      flexShrink: 0
    }
  }), React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: MK.BODY,
      flex: 1,
      minWidth: 0
    }
  }, s.label), React.createElement("span", {
    className: "num",
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      color: s.color,
      whiteSpace: 'nowrap'
    }
  }, "\u2212", s.pts), React.createElement("span", {
    className: "num",
    style: {
      fontSize: 11.5,
      fontWeight: 700,
      color: MK.INK,
      width: 18,
      textAlign: 'right'
    }
  }, s.n), React.createElement("span", {
    className: "num",
    style: {
      fontSize: 10.5,
      color: MK.FAINT,
      width: 32,
      textAlign: 'right'
    }
  }, s.pctv, "%"))))), React.createElement("div", {
    style: {
      padding: '0 16px 15px'
    }
  }, React.createElement("div", {
    style: {
      border: '1px solid rgba(210,58,82,.25)',
      background: 'rgba(210,58,82,.07)',
      borderRadius: 11,
      padding: '12px 14px',
      fontSize: 11.5,
      color: MK.BODY,
      lineHeight: 1.55
    }
  }, "Deductions come off the 6-monthly appraisal score, capped at ", React.createElement("b", null, cap, " points"), " per staff member per cycle. Achievement points and deductions are shown separately on the form.")))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, isAch ? 'Entries by unit' : 'Incidents by unit'), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    className: "sub"
  }, "this cycle")), React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 9
    }
  }, byUnit.length === 0 ? React.createElement("div", {
    className: "sub",
    style: {
      textAlign: 'center',
      padding: 18
    }
  }, "Nothing recorded yet.") : byUnit.map(u => React.createElement("div", {
    key: u.name,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11
    }
  }, React.createElement("span", {
    style: {
      fontSize: 12,
      color: MK.INK,
      width: 116,
      flexShrink: 0,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, u.name), React.createElement("div", {
    style: {
      flex: 1,
      height: 8,
      borderRadius: 5,
      background: 'rgba(125,145,180,.16)',
      overflow: 'hidden'
    }
  }, React.createElement("div", {
    style: {
      width: Math.round(u.n / unitMax * 100) + '%',
      height: '100%',
      borderRadius: 4,
      background: isAch ? 'linear-gradient(90deg,#3ab5a7,#0090ca)' : 'linear-gradient(90deg,#e08a1e,#d23a52)',
      animation: MK.ANIM
    }
  })), React.createElement("span", {
    className: "num",
    style: {
      fontSize: 11.5,
      fontWeight: 700,
      color: isAch ? '#0072a3' : '#b5670a',
      width: 22,
      textAlign: 'right'
    }
  }, u.n))))))) : React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      flexWrap: 'wrap'
    }
  }, React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: .6,
      textTransform: 'uppercase',
      color: MK.FAINT,
      marginRight: 2
    }
  }, "Category"), [['', isAch ? 'All entries' : 'All incidents']].concat(byCat.map(c => [c.name, c.name])).map(([v, label]) => {
    const on = cat === v;
    return React.createElement("button", {
      key: label,
      onClick: () => setCat(v),
      style: {
        border: '1px solid ' + (on ? isAch ? 'rgba(0,144,202,.4)' : 'rgba(210,58,82,.35)' : 'rgba(255,255,255,.85)'),
        background: on ? isAch ? 'rgba(0,144,202,.12)' : 'rgba(210,58,82,.1)' : 'rgba(255,255,255,.55)',
        color: on ? isAch ? '#0072a3' : '#8f2033' : MK.MUTED,
        padding: '5px 12px',
        borderRadius: 16,
        fontSize: 11.5,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap'
      }
    }, label);
  })), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,2fr) minmax(260px,1fr)',
      gap: 14,
      alignItems: 'start'
    }
  }, React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, isAch ? 'Achievement register' : 'Incident register'), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    className: "sub"
  }, list.length, " ", list.length === 1 ? isAch ? 'entry' : 'incident' : isAch ? 'entries' : 'incidents')), React.createElement("div", {
    className: "card-b",
    style: {
      overflow: 'auto'
    }
  }, list.length === 0 ? React.createElement(Empty, {
    icon: isAch ? I.heart : I.alert || I.pulse,
    title: isAch ? 'No entries in this category' : 'No incidents in this category',
    sub: isAch ? 'Pick another category above, or record a new achievement.' : 'Pick another category above, or log a new incident.'
  }) : React.createElement("table", {
    className: "tbl",
    style: {
      width: '100%',
      tableLayout: 'auto'
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: {
      whiteSpace: 'nowrap'
    }
  }, "Staff member"), React.createElement("th", null, isAch ? 'Achievement' : 'What happened'), React.createElement("th", {
    style: {
      whiteSpace: 'nowrap'
    }
  }, isAch ? 'Type' : 'Category'), React.createElement("th", {
    style: {
      whiteSpace: 'nowrap'
    }
  }, isAch ? 'Level' : 'Severity'), React.createElement("th", {
    style: {
      whiteSpace: 'nowrap'
    }
  }, "Date"), React.createElement("th", {
    style: {
      width: 58,
      textAlign: 'right',
      whiteSpace: 'nowrap'
    }
  }, "Points"), React.createElement("th", {
    style: {
      whiteSpace: 'nowrap'
    }
  }, isAch ? 'Reward' : 'Action taken'), React.createElement("th", {
    style: {
      textAlign: 'right',
      width: '1%',
      whiteSpace: 'nowrap'
    }
  }, isAch ? 'Certificate' : ''))), React.createElement("tbody", null, list.map(r => {
    const who = roster.byEmp[r.empId];
    return React.createElement("tr", {
      key: r.id,
      style: !isAch ? {
        boxShadow: 'inset 4px 0 0 ' + sevTone(r.severity)
      } : null
    }, React.createElement("td", null, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, React.createElement(MK.Av, {
      name: r.staffName,
      empId: r.empId,
      size: 26
    }), React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }
    }, React.createElement("span", {
      style: {
        fontWeight: 600,
        color: MK.INK,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      },
      onClick: () => openStaff(r.empId)
    }, r.staffName), who && isPcaRow(who) && React.createElement("span", {
      style: MK.roleChip('PCA')
    }, "PCA")), React.createElement("div", {
      style: {
        fontSize: 10.6,
        color: MK.FAINT,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, who && who.designation ? who.designation + ' · ' : '', r.department)))), React.createElement("td", {
      style: {
        color: MK.INK,
        minWidth: 160,
        maxWidth: 340
      }
    }, r.what), React.createElement("td", null, React.createElement("span", {
      style: tagPill(catColor(r.category))
    }, r.category || '—')), React.createElement("td", null, isAch ? React.createElement("span", {
      className: "sub"
    }, r.level || '—') : React.createElement("span", {
      style: tagPill(sevTone(r.severity), true)
    }, r.severity || '—')), React.createElement("td", {
      className: "num",
      style: {
        fontSize: 11.2,
        whiteSpace: 'nowrap'
      }
    }, r.date), React.createElement("td", {
      style: {
        textAlign: 'right'
      }
    }, React.createElement("span", {
      className: "num",
      style: {
        fontWeight: 700,
        padding: '2px 9px',
        borderRadius: 14,
        color: tone,
        background: tone + '18'
      }
    }, isAch ? '+' : '−', r.points)), React.createElement("td", {
      style: {
        fontSize: 11.5,
        color: MK.BODY,
        maxWidth: 170
      }
    }, (isAch ? r.reward : r.action) || React.createElement("span", {
      style: {
        color: MK.FAINT
      }
    }, "\u2014")), React.createElement("td", {
      style: {
        width: '1%',
        whiteSpace: 'nowrap'
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        justifyContent: 'flex-end'
      }
    }, isAch && React.createElement("button", {
      className: "btn",
      style: {
        whiteSpace: 'nowrap'
      },
      onClick: () => setCert(r)
    }, r.certificate ? 'Certificate' : 'Issue'), perfCan('delete') && React.createElement("button", {
      className: "icon-btn danger",
      title: "Remove this entry",
      onClick: () => {
        if (confirm('Remove this entry? The points come off the appraisal immediately.')) (isAch ? perf.delAchievement : perf.delIncident)(r.id);
      }
    }, "\xD7"))));
  }))))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, isAch ? 'Most points this cycle' : 'Repeat cases')), React.createElement("div", {
    className: "card-b"
  }, leaders.length === 0 ? React.createElement("div", {
    className: "sub",
    style: {
      textAlign: 'center',
      padding: 12
    }
  }, "Nothing yet.") : React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 9
    }
  }, leaders.map((l, k) => React.createElement("div", {
    key: l.empId,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      cursor: 'pointer'
    },
    onClick: () => openStaff(l.empId)
  }, React.createElement("span", {
    className: "num",
    style: {
      width: 14,
      opacity: .5,
      fontSize: 11
    }
  }, k + 1), React.createElement(MK.Av, {
    name: l.name,
    empId: l.empId,
    size: 26
  }), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: MK.INK,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, l.name), React.createElement("div", {
    style: {
      fontSize: 10.4,
      color: MK.FAINT
    }
  }, l.dept, " \xB7 ", l.n, " entr", l.n === 1 ? 'y' : 'ies')), React.createElement("span", {
    className: "num",
    style: {
      fontWeight: 700,
      padding: '2px 9px',
      borderRadius: 14,
      color: tone,
      background: tone + '18'
    }
  }, isAch ? '+' : '−', l.pts))))))))), adding && React.createElement(EntryModal, {
    kind: kind,
    roster: roster,
    perf: perf,
    onClose: () => setAdding(false)
  }), editingCats && React.createElement(CategoryManager, {
    kind: kind,
    perf: perf,
    onClose: () => setEditingCats(false)
  }), cert && React.createElement(CertificateModal, {
    entry: cert,
    onClose: () => setCert(null)
  }));
}
const catTone = (kind, name) => {
  const cats = kind === 'ach' ? ACH_CATEGORIES : INC_CATEGORIES;
  const i = cats.findIndex(c => c.label === name);
  return i >= 0 ? CAT_COLORS[i % CAT_COLORS.length] : '#8a93a3';
};
const ACH_BADGES = [['Certified', '#0090ca', x => x.category === 'Training completed'], ['Presenter', '#6a52d4', x => x.category === 'Presentation / teaching'], ['Commended by patients', '#e08a1e', x => x.category === 'Patient / family appreciation'], ['Crisis cover', '#b5670a', x => x.category === 'Extra duty / emergency cover'], ['Award winner', '#1f9d57', x => x.category === 'Award / recognition'], ['Improvement adopted', '#3ab5a7', x => x.category === 'Quality improvement adopted'], ['National level', '#27a8db', x => x.level === 'International' || x.level === 'National' || x.level === 'Conference'], ['Cash award', '#0072a3', x => /cash/i.test(x.reward || '')]];
const histChip = (c, border) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 11.5,
  fontWeight: 700,
  padding: '5px 11px',
  borderRadius: 16,
  color: c,
  background: c + '18',
  ...(border ? {
    border: '1px solid ' + c + '38'
  } : null)
});
function PerfEntryHistory({
  kind,
  roster,
  perf,
  empId,
  caps,
  onBack,
  onCert,
  setRoute
}) {
  const isAch = kind === 'ach';
  const row = roster.byEmp[empId];
  const tone = isAch ? '#0072a3' : '#d23a52';
  const cap = isAch ? caps.bonus : caps.penalty;
  const all = useMemo(() => (isAch ? perf.achievements : perf.incidents).filter(x => x.empId === empId).sort((a, b) => String(b.date).localeCompare(String(a.date))), [perf.achievements, perf.incidents, empId, isAch]);
  if (!row) {
    return React.createElement(Empty, {
      icon: I.user,
      title: "Staff member not found",
      sub: "This entry names somebody who is no longer on the active roster, so their cycle and appraisal cannot be resolved.",
      action: React.createElement("button", {
        className: "btn",
        onClick: onBack
      }, "\u2039 ", isAch ? 'Register' : 'Incident register')
    });
  }
  const cycleRows = isAch ? row.achievements : row.incidents;
  const inCycle = {};
  cycleRows.forEach(r => {
    inCycle[r.id] = true;
  });
  const pts = cycleRows.reduce((t, r) => t + (Number(r.points) || 0), 0);
  const applied = Math.min(pts, cap);
  const isPca = isPcaRow(row);
  const cycleLabel = row.cycle ? row.cycle.label : '';
  const badges = isAch ? ACH_BADGES.filter(([,, test]) => all.some(test)) : [];
  const repeat = cycleRows.length > 1;
  return React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      maxWidth: 1100,
      margin: '0 auto',
      width: '100%'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, React.createElement("button", {
    className: "btn",
    onClick: onBack
  }, "\u2039 ", isAch ? 'Register' : 'Incident register'), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("button", {
    className: "btn",
    onClick: () => setRoute({
      view: 'perfStaff',
      emp: row.empId
    })
  }, "Full performance record"), isAch ? React.createElement("button", {
    className: "btn",
    disabled: !all.length,
    onClick: () => onCert(all[0])
  }, "Award certificate") : React.createElement("button", {
    className: "btn",
    onClick: () => window.print()
  }, "Print record")), React.createElement("div", {
    className: "card",
    style: {
      padding: '18px 22px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap'
    }
  }, React.createElement(MK.Av, {
    name: row.name,
    emp: row.emp,
    empId: row.empId,
    size: 56
  }), React.createElement("div", {
    style: {
      minWidth: 200
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, React.createElement("span", {
    style: {
      fontSize: 19,
      fontWeight: 700,
      color: MK.INK
    }
  }, row.name), React.createElement("span", {
    style: MK.roleChip(isPca ? 'PCA' : 'Nurse')
  }, isPca ? 'PCA' : 'Nurse')), React.createElement("div", {
    style: {
      fontSize: 12,
      color: MK.MUTED,
      marginTop: 2
    }
  }, row.designation || '—', " \xB7 ", row.dept || 'Unassigned'), isAch ? React.createElement("div", {
    style: {
      display: 'flex',
      gap: 7,
      flexWrap: 'wrap',
      marginTop: 9
    }
  }, badges.length === 0 ? React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: MK.FAINT
    }
  }, "No badge earned yet \u2014 badges come from the categories recorded against this person.") : badges.map(([label, c]) => React.createElement("span", {
    key: label,
    style: histChip(c, true)
  }, label))) : React.createElement("div", {
    style: {
      marginTop: 9
    }
  }, React.createElement("span", {
    style: histChip(repeat ? '#8f2033' : '#1f9d57')
  }, repeat ? 'Repeat case — ' + cycleRows.length + ' incidents in this cycle' : 'First incident in this cycle'))), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      color: MK.FAINT
    }
  }, isAch ? 'Points this cycle' : 'Points deducted'), React.createElement("div", {
    className: "num",
    style: {
      fontSize: 38,
      fontWeight: 700,
      color: tone,
      lineHeight: 1
    }
  }, pts), React.createElement("div", {
    style: {
      fontSize: 11,
      color: MK.MUTED,
      marginTop: 3
    }
  }, "from ", cycleRows.length, " ", isAch ? cycleRows.length === 1 ? 'entry' : 'entries' : cycleRows.length === 1 ? 'incident' : 'incidents'))), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)',
      gap: 14,
      alignItems: 'start'
    }
  }, React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, isAch ? 'Recorded achievements' : 'Recorded incidents')), all.length === 0 ? React.createElement("div", {
    className: "card-b"
  }, React.createElement("div", {
    className: "sub",
    style: {
      textAlign: 'center',
      padding: 18
    }
  }, isAch ? 'Nothing recorded against this staff member yet.' : 'Clean record — nothing recorded against this staff member.')) : all.map(p => {
    const c = isAch ? catTone(kind, p.category) : sevTone(p.severity);
    return React.createElement("div", {
      key: p.id,
      style: {
        display: 'flex',
        gap: 12,
        padding: '13px 16px',
        borderTop: '1px solid rgba(125,145,180,.14)',
        opacity: inCycle[p.id] ? 1 : .72
      }
    }, React.createElement("span", {
      style: {
        width: 9,
        height: 9,
        borderRadius: '50%',
        flexShrink: 0,
        marginTop: 4,
        background: c
      }
    }), React.createElement("div", {
      style: {
        minWidth: 0,
        flex: 1
      }
    }, React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 600,
        color: MK.INK,
        marginBottom: isAch ? 4 : 5
      }
    }, p.what || '—'), React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap'
      }
    }, React.createElement("span", {
      style: tagPill(catTone(kind, p.category))
    }, p.category || '—'), !isAch && React.createElement("span", {
      style: tagPill(sevTone(p.severity), true)
    }, p.severity || '—'), React.createElement("span", {
      style: {
        fontSize: 11,
        color: MK.MUTED
      }
    }, isAch ? (p.level ? p.level + ' · ' : '') + p.date : p.date), !inCycle[p.id] && React.createElement("span", {
      style: tagPill('#8a93a3', true)
    }, "earlier cycle")), !isAch && React.createElement("div", {
      style: {
        fontSize: 11,
        color: MK.BODY,
        marginTop: 6
      }
    }, "Action: ", p.action || 'none recorded'), !isAch && p.note && React.createElement("div", {
      style: {
        fontSize: 11,
        color: MK.FAINT,
        marginTop: 3,
        lineHeight: 1.5
      }
    }, p.note), isAch && React.createElement("div", {
      style: {
        fontSize: 11,
        color: MK.FAINT,
        marginTop: 4
      }
    }, "Reward: ", p.reward || 'none recorded'), isAch && p.note && React.createElement("div", {
      style: {
        fontSize: 11,
        color: MK.FAINT,
        marginTop: 3,
        lineHeight: 1.5
      }
    }, p.note)), React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 6,
        flexShrink: 0
      }
    }, React.createElement("span", {
      className: "num",
      style: {
        fontSize: 15,
        fontWeight: 700,
        color: tone
      }
    }, isAch ? '+' : '−', p.points), isAch && React.createElement("button", {
      className: "btn",
      style: {
        padding: '3px 9px',
        fontSize: 11
      },
      onClick: () => onCert(p)
    }, p.certificate ? 'Certificate' : 'Issue')));
  })), React.createElement("div", {
    className: "card",
    style: {
      padding: '16px 18px'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: .6,
      textTransform: 'uppercase',
      color: MK.FAINT
    }
  }, "Effect on the appraisal"), React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: MK.INK,
      margin: '8px 0 10px'
    }
  }, isAch ? '+' : '−', applied, " ", isAch ? 'bonus points' : 'points', " ", cycleLabel ? 'on the ' + cycleLabel + ' appraisal' : 'once an appraisal window opens'), React.createElement("div", {
    style: {
      height: 8,
      borderRadius: 5,
      background: 'rgba(125,145,180,.16)',
      overflow: 'hidden',
      marginBottom: 8
    }
  }, React.createElement("div", {
    style: {
      width: (cap ? Math.round(applied / cap * 100) : 0) + '%',
      height: '100%',
      borderRadius: 4,
      background: isAch ? 'linear-gradient(90deg,#3ab5a7,#0090ca)' : 'linear-gradient(90deg,#e08a1e,#d23a52)',
      animation: MK.ANIM
    }
  })), React.createElement("div", {
    style: {
      fontSize: 11,
      color: MK.FAINT,
      marginBottom: 12
    }
  }, "Cap is ", cap, " ", isAch ? 'bonus points per cycle' : 'points per cycle', pts > cap ? ' — ' + (pts - cap) + ' of the ' + pts + ' recorded points fall outside it' : ''), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: MK.MUTED,
      lineHeight: 1.6,
      borderTop: '1px solid rgba(125,145,180,.18)',
      paddingTop: 12
    }
  }, isAch ? 'Bonus points are added to the 100-mark total after the 20 parameters are scored, and are shown separately in Part H so the CNS can see what came from recognition rather than routine performance.' : 'Deductions are applied after the 20 parameters are scored and shown separately in Part H, so the CNS can see conduct history apart from routine performance. A serious or critical entry also carries the disciplinary action noted against it.'), !cycleLabel && React.createElement("div", {
    style: {
      fontSize: 11.2,
      color: MK.FAINT,
      marginTop: 10
    }
  }, "No six-month window is open for this staff member yet, so nothing on this register has reached an appraisal."))));
}
function CategoryManager({
  kind,
  perf,
  onClose
}) {
  const capOf = k => k === 'ach' ? capsOf(perf).bonus : capsOf(perf).penalty;
  const clone = k => catsOf(perf, k).map(c => ({
    id: c.id,
    label: c.label,
    levels: (c.levels || []).map(l => [l[0], l[1]])
  }));
  const [tab, setTab] = useState(kind);
  const [ach, setAch] = useState(() => clone('ach'));
  const [inc, setInc] = useState(() => clone('inc'));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const isAch = tab === 'ach';
  const rows = isAch ? ach : inc;
  const setRows = isAch ? setAch : setInc;
  const cap = capOf(tab);
  const edit = (i, patch) => setRows(r => r.map((c, n) => n === i ? Object.assign({}, c, patch) : c));
  const drop = i => setRows(r => r.filter((c, n) => n !== i));
  const add = () => setRows(r => r.concat([{
    id: '',
    label: '',
    levels: isAch ? [['Recorded', 1]] : []
  }]));
  const editLevel = (i, li, patch) => setRows(r => r.map((c, n) => {
    if (n !== i) return c;
    const levels = (c.levels || []).map((l, m) => m === li ? [patch.name != null ? patch.name : l[0], patch.pts != null ? patch.pts : l[1]] : l);
    return Object.assign({}, c, {
      levels
    });
  }));
  const addLevel = i => setRows(r => r.map((c, n) => n === i ? Object.assign({}, c, {
    levels: (c.levels || []).concat([['', 1]])
  }) : c));
  const dropLevel = (i, li) => setRows(r => r.map((c, n) => n === i ? Object.assign({}, c, {
    levels: (c.levels || []).filter((l, m) => m !== li)
  }) : c));
  const save = () => {
    const clean = list => list.filter(c => String(c.label || '').trim());
    if (!clean(ach).length || !clean(inc).length) {
      setErr('Keep at least one category in each list.');
      return;
    }
    setBusy(true);
    setErr('');
    perf.saveCategories({
      ach: clean(ach),
      inc: clean(inc)
    }).then(r => {
      setBusy(false);
      if (r && r.ok) onClose();else setErr(r && r.error || 'That did not save.');
    });
  };
  return React.createElement(Modal, {
    wide: true,
    title: "Manage categories",
    sub: "what an achievement or an incident can be filed under",
    onClose: onClose,
    footer: React.createElement(React.Fragment, null, React.createElement("button", {
      className: "btn",
      onClick: onClose
    }, "Cancel"), React.createElement("button", {
      className: "btn pri",
      disabled: busy,
      onClick: save
    }, busy ? 'Saving…' : 'Save categories'))
  }, React.createElement("div", {
    style: {
      display: 'grid',
      gap: 12
    }
  }, React.createElement("div", {
    style: {
      display: 'inline-flex',
      gap: 2,
      padding: 3,
      borderRadius: 11,
      background: 'rgba(125,145,180,.14)',
      justifySelf: 'start'
    }
  }, [['ach', 'Achievements (' + ach.length + ')'], ['inc', 'Incidents (' + inc.length + ')']].map(([k, l]) => React.createElement("button", {
    key: k,
    onClick: () => setTab(k),
    style: {
      border: 0,
      cursor: 'pointer',
      font: 'inherit',
      fontSize: 11.5,
      fontWeight: 600,
      padding: '5px 13px',
      borderRadius: 9,
      color: tab === k ? MK.INK : MK.MUTED,
      background: tab === k ? '#fff' : 'transparent'
    }
  }, l))), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: MK.MUTED,
      lineHeight: 1.55
    }
  }, isAch ? 'Each achievement category carries its own levels, and the level sets the bonus points. Nothing may award more than ' + cap + ' — the per-cycle cap.' : 'Incident categories classify what happened. The points come from the severity chosen when the entry is filed, not from the category.', ' ', "Entries already on file keep the category they were saved with, so editing this list never changes past records."), rows.map((c, i) => React.createElement("div", {
    key: i,
    className: "card",
    style: {
      background: 'rgba(255,255,255,.55)'
    }
  }, React.createElement("div", {
    className: "card-b",
    style: {
      display: 'grid',
      gap: 9
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    }
  }, React.createElement("input", {
    value: c.label,
    onChange: e => edit(i, {
      label: e.target.value
    }),
    placeholder: "Category name",
    style: {
      flex: 1,
      fontWeight: 600
    }
  }), React.createElement("button", {
    className: "icon-btn danger",
    title: "Remove this category",
    onClick: () => drop(i)
  }, "\xD7")), isAch && React.createElement("div", {
    style: {
      display: 'grid',
      gap: 6
    }
  }, React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: .5,
      textTransform: 'uppercase',
      color: MK.FAINT
    }
  }, "Levels & points"), (c.levels || []).map((l, li) => React.createElement("div", {
    key: li,
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    }
  }, React.createElement("input", {
    value: l[0],
    onChange: e => editLevel(i, li, {
      name: e.target.value
    }),
    placeholder: "e.g. Hospital",
    style: {
      flex: 1
    }
  }), React.createElement("input", {
    type: "number",
    min: "0",
    max: cap,
    value: l[1],
    onChange: e => editLevel(i, li, {
      pts: Math.max(0, Math.min(cap, Number(e.target.value) || 0))
    }),
    style: {
      width: 74
    }
  }), React.createElement("span", {
    style: {
      fontSize: 11,
      color: MK.FAINT
    }
  }, "pts"), React.createElement("button", {
    className: "icon-btn danger",
    title: "Remove this level",
    onClick: () => dropLevel(i, li)
  }, "\xD7"))), React.createElement("button", {
    className: "btn",
    style: {
      justifySelf: 'start'
    },
    onClick: () => addLevel(i)
  }, "+ Add a level"))))), React.createElement("button", {
    className: "btn",
    style: {
      justifySelf: 'start'
    },
    onClick: add
  }, "+ Add ", isAch ? 'an achievement' : 'an incident', " category"), err && React.createElement("div", {
    style: {
      fontSize: 12,
      color: '#d23a52',
      fontWeight: 600
    }
  }, err), React.createElement("div", {
    style: {
      fontSize: 11,
      color: MK.FAINT
    }
  }, "Both lists are saved together, whichever tab you are on.")));
}
function EntryModal({
  kind,
  roster,
  perf,
  onClose
}) {
  const isAch = kind === 'ach';
  const cats = catsOf(perf, kind);
  const [empId, setEmpId] = useState('');
  const [category, setCategory] = useState((cats[0] || {}).label || '');
  const [level, setLevel] = useState('');
  const [severity, setSeverity] = useState(SEVERITIES[0][0]);
  const [what, setWhat] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [reward, setReward] = useState('');
  const [action, setAction] = useState('');
  const [busy, setBusy] = useState(false);
  const row = roster.byEmp[empId];
  const catDef = cats.find(c => c.label === category);
  const levels = catDef && catDef.levels || [];
  useEffect(() => {
    if (isAch && levels.length) setLevel(levels[0][0]);
  }, [category]);
  const points = isAch ? (levels.find(l => l[0] === level) || [null, 1])[1] : (SEVERITIES.find(s => s[0] === severity) || [null, 1])[1];
  const alreadyThisCycle = row ? (isAch ? row.achievements : row.incidents).reduce((s, x) => s + (Number(x.points) || 0), 0) : 0;
  const cap = isAch ? capsOf(perf).bonus : capsOf(perf).penalty;
  const effective = Math.max(0, Math.min(cap - alreadyThisCycle, points));
  const submit = () => {
    if (!row) return;
    setBusy(true);
    const body = {
      empId: row.empId,
      staffId: String(row.emp && row.emp.id),
      staffName: row.name,
      department: row.dept,
      designation: row.designation || '',
      cycleId: row.cycle ? row.cycle.id : '',
      date,
      category,
      what,
      note,
      points,
      ...(isAch ? {
        level,
        reward
      } : {
        severity,
        action
      })
    };
    (isAch ? perf.addAchievement : perf.addIncident)(body).then(r => {
      setBusy(false);
      if (r && r.ok) onClose();
    });
  };
  return React.createElement(Modal, {
    wide: true,
    title: isAch ? 'Record an achievement' : 'Record an incident',
    sub: isAch ? 'Bonus points are added to the staff member\'s current appraisal' : 'The deduction shows on the staff member\'s current appraisal',
    onClose: onClose,
    footer: React.createElement(React.Fragment, null, React.createElement("button", {
      className: "btn",
      onClick: onClose
    }, "Cancel"), React.createElement("button", {
      className: "btn pri",
      disabled: busy || !empId || !what.trim(),
      onClick: submit
    }, busy ? 'Saving…' : isAch ? 'Save achievement' : 'Save incident'))
  }, React.createElement("div", {
    style: {
      display: 'grid',
      gap: 12
    }
  }, React.createElement("label", {
    style: {
      display: 'grid',
      gap: 5
    }
  }, React.createElement("span", {
    className: "sub"
  }, "Staff member *"), React.createElement("select", {
    value: empId,
    onChange: e => setEmpId(e.target.value),
    style: {
      width: '100%'
    }
  }, React.createElement("option", {
    value: ""
  }, "Select\u2026"), roster.rows.map(r => React.createElement("option", {
    key: r.empId,
    value: r.empId
  }, r.name, " \u2014 ", r.empId, " \xB7 ", r.dept)))), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10
    }
  }, React.createElement("label", {
    style: {
      display: 'grid',
      gap: 4
    }
  }, React.createElement("span", {
    className: "sub"
  }, "Category"), React.createElement("select", {
    value: category,
    onChange: e => setCategory(e.target.value)
  }, cats.map(c => React.createElement("option", {
    key: c.id
  }, c.label)))), isAch ? React.createElement("label", {
    style: {
      display: 'grid',
      gap: 4
    }
  }, React.createElement("span", {
    className: "sub"
  }, "Level or basis \u2014 sets the points"), React.createElement("select", {
    value: level,
    onChange: e => setLevel(e.target.value)
  }, levels.map(l => React.createElement("option", {
    key: l[0],
    value: l[0]
  }, l[0], " (+", l[1], ")")))) : React.createElement("label", {
    style: {
      display: 'grid',
      gap: 4
    }
  }, React.createElement("span", {
    className: "sub"
  }, "Severity \u2014 sets the points"), React.createElement("select", {
    value: severity,
    onChange: e => setSeverity(e.target.value)
  }, SEVERITIES.map(s => React.createElement("option", {
    key: s[0],
    value: s[0]
  }, s[0], " (\u2212", s[1], ")"))))), React.createElement("label", {
    style: {
      display: 'grid',
      gap: 4
    }
  }, React.createElement("span", {
    className: "sub"
  }, isAch ? 'What the achievement was *' : 'What happened *'), React.createElement("textarea", {
    rows: "2",
    value: what,
    onChange: e => setWhat(e.target.value)
  })), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10
    }
  }, React.createElement("label", {
    style: {
      display: 'grid',
      gap: 4
    }
  }, React.createElement("span", {
    className: "sub"
  }, isAch ? 'Date completed' : 'Date of incident'), React.createElement("input", {
    type: "date",
    value: date,
    onChange: e => setDate(e.target.value)
  })), React.createElement("label", {
    style: {
      display: 'grid',
      gap: 4
    }
  }, React.createElement("span", {
    className: "sub"
  }, isAch ? 'Reward (optional)' : 'Action taken'), React.createElement("input", {
    value: isAch ? reward : action,
    onChange: e => (isAch ? setReward : setAction)(e.target.value),
    placeholder: isAch ? 'e.g. Certificate of appreciation' : 'e.g. Counselled, retraining scheduled'
  }))), React.createElement("label", {
    style: {
      display: 'grid',
      gap: 4
    }
  }, React.createElement("span", {
    className: "sub"
  }, "Note for the record"), React.createElement("textarea", {
    rows: "2",
    value: note,
    onChange: e => setNote(e.target.value)
  })), row && React.createElement("div", {
    className: "card",
    style: {
      background: 'rgba(39,168,219,.06)'
    }
  }, React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      gap: 14,
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, React.createElement("div", null, React.createElement("div", {
    className: "sub",
    style: {
      fontSize: 11
    }
  }, "This entry carries"), React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 18,
      color: isAch ? '#1f9d63' : '#d23a52'
    }
  }, isAch ? '+' : '−', points)), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 180
    }
  }, React.createElement("div", {
    className: "sub",
    style: {
      fontSize: 11.3
    }
  }, row.name, " already has ", alreadyThisCycle, " of the ", cap, "-point ", isAch ? 'bonus' : 'deduction', " cap", row.cycle ? ' on the ' + row.cycle.label + ' appraisal' : '', "."), effective < points && React.createElement("div", {
    style: {
      fontSize: 11.3,
      color: '#e0a12a',
      marginTop: 3
    }
  }, "The cap means only ", effective, " of these ", points, " points will change the score."))))));
}
function CertificateModal({
  entry,
  onClose
}) {
  return React.createElement(Modal, {
    wide: true,
    title: "Certificate of appreciation",
    onClose: onClose,
    footer: React.createElement(React.Fragment, null, React.createElement("button", {
      className: "btn",
      onClick: onClose
    }, "Close"), React.createElement("button", {
      className: "btn pri",
      onClick: () => window.print()
    }, "Print certificate"))
  }, React.createElement("div", {
    id: "pdf-root",
    style: {
      background: '#fff',
      color: '#16202e',
      padding: '36px 40px',
      textAlign: 'center',
      border: '3px double #0072a3',
      borderRadius: 6
    }
  }, React.createElement("img", {
    src: "unico/logo.svg",
    alt: "UNICO",
    style: {
      height: 34,
      marginBottom: 14
    }
  }), React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: 3,
      color: '#0072a3',
      fontWeight: 700
    }
  }, "CERTIFICATE OF APPRECIATION"), React.createElement("div", {
    style: {
      margin: '18px 0 6px',
      fontSize: 12,
      color: '#556'
    }
  }, "This certificate is awarded to"), React.createElement("div", {
    style: {
      fontSize: 26,
      fontWeight: 700,
      borderBottom: '1px solid #cfd9e6',
      display: 'inline-block',
      padding: '0 26px 5px'
    }
  }, entry.staffName), React.createElement("div", {
    style: {
      margin: '16px auto 6px',
      fontSize: 12,
      color: '#556'
    }
  }, "in recognition of"), React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      maxWidth: 460,
      margin: '0 auto'
    }
  }, entry.what), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: '#556',
      marginTop: 8
    }
  }, entry.category, entry.level ? ' · ' + entry.level : '', " \xB7 ", entry.date), React.createElement("div", {
    style: {
      marginTop: 12,
      fontSize: 11.5,
      color: '#1f9d63',
      fontWeight: 700
    }
  }, "+", entry.points, " bonus points on the current appraisal cycle"), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 40,
      marginTop: 40,
      fontSize: 10.5
    }
  }, React.createElement("div", {
    style: {
      borderTop: '1px solid #333',
      paddingTop: 5
    }
  }, "Chief Nursing Superintendent"), React.createElement("div", {
    style: {
      borderTop: '1px solid #333',
      paddingTop: 5
    }
  }, "Director, Administration")), React.createElement("div", {
    style: {
      fontSize: 9.5,
      color: '#889',
      marginTop: 16
    }
  }, "UNICO Hands of Care Hospitals \xB7 Issued ", A.fmtDay(new Date()))));
}
const GRADE_ORDER = A.GRADES.map(g => g.grade);
function PerfCompare({
  roster,
  setRoute
}) {
  const data = useMemo(() => {
    const m = {};
    roster.rows.forEach(r => {
      const d = r.dept || 'Unassigned';
      const e = m[d] || (m[d] = {
        dept: d,
        n: 0,
        scores: [],
        grades: {},
        cur: [],
        prev: []
      });
      e.n++;
      if (r.status === 'actioned' && r.appraisal) {
        e.scores.push(r.appraisal.score);
        e.grades[r.appraisal.grade] = (e.grades[r.appraisal.grade] || 0) + 1;
        const prior = r.history.find(h => h.cycleId !== r.appraisal.cycleId);
        if (prior) {
          e.cur.push(r.appraisal.score);
          e.prev.push(prior.score);
        }
      }
    });
    const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
    return Object.values(m).map(e => ({
      ...e,
      avg: e.scores.length ? Math.round(mean(e.scores)) : null,
      delta: e.cur.length ? mean(e.cur) - mean(e.prev) : null,
      graded: e.scores.length
    })).sort((a, b) => (b.avg == null ? -1 : b.avg) - (a.avg == null ? -1 : a.avg));
  }, [roster.rows]);
  const mix = useMemo(() => data.filter(d => d.graded > 0), [data]);
  const top = useMemo(() => roster.rows.filter(r => r.last).sort((a, b) => b.last.score - a.last.score).slice(0, 10), [roster.rows]);
  return React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Average score by department"), React.createElement("div", {
    className: "sub"
  }, "completed appraisals only \xB7 \u0394 vs each person's previous appraisal")), React.createElement("div", {
    className: "card-b"
  }, data.every(d => d.avg == null) ? React.createElement(Empty, {
    title: "No completed appraisals yet"
  }) : React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 9
    }
  }, data.map((d, i) => React.createElement("div", {
    key: d.dept,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, React.createElement("span", {
    className: "num",
    style: {
      fontSize: 10.5,
      color: MK.FAINT,
      width: 18,
      textAlign: 'right',
      flexShrink: 0
    }
  }, i + 1), React.createElement("div", {
    style: {
      width: 150,
      fontSize: 12
    }
  }, d.dept), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement(Bar, {
    value: d.avg || 0,
    max: 100,
    color: gradeColor(A.gradeFor(d.avg || 0).grade),
    height: 10
  })), React.createElement("div", {
    className: "num",
    style: {
      width: 40,
      textAlign: 'right'
    }
  }, d.avg == null ? '—' : d.avg), React.createElement("div", {
    style: {
      width: 34
    }
  }, d.avg != null && React.createElement(GradePill, {
    grade: A.gradeFor(d.avg).grade
  })), React.createElement("span", {
    className: "num",
    title: d.delta == null ? 'Nobody in this unit has two filed appraisals yet' : d.cur.length + ' staff appraised twice',
    style: {
      fontSize: 10.5,
      fontWeight: 600,
      padding: '1px 7px',
      borderRadius: 12,
      width: 44,
      textAlign: 'center',
      flexShrink: 0,
      color: d.delta == null ? MK.FAINT : d.delta < 0 ? '#d23a52' : '#1f9d57',
      background: d.delta == null ? 'rgba(125,145,180,.14)' : d.delta < 0 ? 'rgba(210,58,82,.14)' : 'rgba(31,157,87,.15)'
    }
  }, d.delta == null ? '—' : (d.delta >= 0 ? '+' : '') + d.delta.toFixed(1)), React.createElement("div", {
    className: "sub",
    style: {
      width: 62,
      textAlign: 'right',
      fontSize: 11
    }
  }, d.scores.length, "/", d.n)))))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Grade mix by department"), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 9,
      flexWrap: 'wrap'
    }
  }, GRADE_ORDER.map(g => React.createElement("span", {
    key: g,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 10.5,
      color: MK.MUTED
    }
  }, React.createElement("i", {
    style: {
      width: 9,
      height: 9,
      borderRadius: 3,
      background: MK.GC[g],
      display: 'inline-block'
    }
  }), g)))), React.createElement("div", {
    className: "card-b"
  }, mix.length === 0 ? React.createElement(Empty, {
    title: "No completed appraisals yet",
    sub: "Grades appear here as appraisals are filed, one stacked bar per department."
  }) : React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, mix.map(d => React.createElement("div", {
    key: d.dept,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '4px 0'
    }
  }, React.createElement("span", {
    style: {
      fontSize: 11.5,
      fontWeight: 600,
      color: MK.BODY,
      width: 150,
      flexShrink: 0,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, d.dept), React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      height: 13,
      borderRadius: 4,
      overflow: 'hidden',
      background: 'rgba(125,145,180,.16)'
    }
  }, GRADE_ORDER.filter(g => d.grades[g]).map(g => React.createElement("div", {
    key: g,
    title: d.grades[g] + ' × ' + g,
    style: {
      width: d.grades[g] / d.graded * 100 + '%',
      background: MK.GC[g],
      height: '100%',
      animation: MK.ANIM
    }
  }))), React.createElement("span", {
    className: "num",
    style: {
      fontSize: 11,
      color: MK.FAINT,
      width: 34,
      textAlign: 'right'
    }
  }, d.graded)))))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Top performers"), React.createElement("div", {
    className: "sub"
  }, "by latest filed appraisal")), React.createElement("div", {
    className: "card-b",
    style: {
      overflow: 'auto'
    }
  }, top.length === 0 ? React.createElement(Empty, {
    title: "No filed appraisals yet"
  }) : React.createElement("table", {
    className: "tbl",
    style: {
      width: '100%'
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: {
      width: 34
    }
  }, "#"), React.createElement("th", null, "Staff"), React.createElement("th", null, "Department"), React.createElement("th", null, "Period"), React.createElement("th", null, "Score"), React.createElement("th", null, "Grade"))), React.createElement("tbody", null, top.map((r, i) => React.createElement("tr", {
    key: r.empId,
    style: {
      cursor: 'pointer'
    },
    onClick: () => setRoute({
      view: 'perfStaff',
      emp: r.empId
    })
  }, React.createElement("td", {
    className: "num"
  }, i + 1), React.createElement("td", null, React.createElement("b", null, r.name), React.createElement("div", {
    className: "sub",
    style: {
      fontSize: 11
    }
  }, r.designation)), React.createElement("td", null, r.dept), React.createElement("td", {
    className: "sub"
  }, r.last.cycleLabel), React.createElement("td", {
    className: "num"
  }, r.last.score), React.createElement("td", null, React.createElement(GradePill, {
    grade: r.last.grade
  })))))))));
}
const ATTR_TARGET = 18;
const attrParse = v => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};
const attrMonths = (a, b) => a && b ? (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) : null;
const attrTenure = m => {
  if (m == null) return '—';
  if (m < 12) return m + ' mo';
  const y = Math.floor(m / 12),
    r = m % 12;
  return y + ' yr' + (y > 1 ? 's' : '') + (r ? ' ' + r + ' mo' : '');
};
function useLeavers(staffStore, perf) {
  return useMemo(() => {
    const exitBy = {};
    (perf.exits || []).forEach(x => {
      exitBy[x.empId] = x;
    });
    const gradeBy = {};
    (perf.appraisals || []).filter(a => a.status === 'actioned').sort((a, b) => String(a.cycleStart).localeCompare(String(b.cycleStart))).forEach(a => {
      gradeBy[a.empId] = a.grade;
    });
    return (staffStore.staff || []).filter(e => e.former || e.is_active === false).map(e => {
      const empId = e.emp_id || String(e.id);
      const x = exitBy[empId] || null;
      const left = attrParse(x && x.lastDay) || (e.archived_at ? new Date(e.archived_at) : null);
      const joined = attrParse(e.doj);
      return {
        empId,
        emp: e,
        name: e.name,
        dept: e.current_department || 'Unassigned',
        designation: e.designation,
        role: roleOf(e),
        joined,
        left,
        exit: x,
        documented: !!x,
        reason: x && x.reason || e.archived_reason || '',
        separation: x && x.separation || '',
        interview: x && x.interview || '',
        clearance: x && x.clearance || [],
        rehire: x ? !!x.rehire : null,
        noticeDate: attrParse(x && x.noticeDate),
        lastGrade: x && x.lastGrade || gradeBy[empId] || '',
        tenure: attrMonths(joined, left)
      };
    }).filter(l => l.left).sort((a, b) => b.left - a.left);
  }, [staffStore.staff, perf.exits, perf.appraisals]);
}
function useUnitAttrition(staffStore, leavers) {
  return useMemo(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const m = {};
    const at = d => m[d] || (m[d] = {
      dept: d,
      roster: 0,
      nurses: 0,
      pcas: 0,
      exits: 0,
      list: []
    });
    (staffStore.staff || []).filter(e => e.is_active !== false && !e.former).forEach(e => {
      const u = at(e.current_department || 'Unassigned');
      u.roster++;
      if (roleOf(e) === 'PCA') u.pcas++;else u.nurses++;
    });
    leavers.forEach(l => {
      if (l.left >= from) {
        const u = at(l.dept);
        u.exits++;
        u.list.push(l);
      }
    });
    const units = Object.values(m).map(u => ({
      ...u,
      rate: u.roster + u.exits ? u.exits / (u.roster + u.exits) * 100 : 0
    })).sort((a, b) => b.rate - a.rate || b.exits - a.exits);
    units.forEach((u, i) => {
      u.rank = i + 1;
    });
    return units;
  }, [staffStore.staff, leavers]);
}
function AttrTile({
  label,
  value,
  foot,
  color
}) {
  return React.createElement("div", {
    className: "card",
    style: {
      padding: '15px 18px'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: .6,
      textTransform: 'uppercase',
      color: MK.FAINT
    }
  }, label), React.createElement("div", {
    className: "num",
    style: {
      fontSize: 24,
      fontWeight: 700,
      color: color || MK.INK,
      margin: '6px 0 4px',
      lineHeight: 1
    }
  }, value), React.createElement("div", {
    style: {
      fontSize: 11,
      color: MK.MUTED
    }
  }, foot));
}
function PerfDeptAttrition({
  unit,
  units,
  flagged,
  onFlag,
  onBack,
  onLeaver
}) {
  const u = units.find(x => x.dept === unit);
  if (!u) {
    return React.createElement(Empty, {
      icon: I.layers,
      title: "Unit not found",
      sub: "Nobody is on this unit's roster and no exit has been recorded against it.",
      action: React.createElement("button", {
        className: "btn",
        onClick: onBack
      }, "\u2039 Attrition")
    });
  }
  const fyFrom = new Date(new Date().getFullYear(), 0, 1);
  const inFy = u.list.filter(l => l.left >= fyFrom).length;
  const rateColor = u.rate > ATTR_TARGET ? '#d23a52' : '#1f9d57';
  return React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      maxWidth: 1200,
      margin: '0 auto',
      width: '100%'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, React.createElement("button", {
    className: "btn",
    onClick: onBack
  }, "\u2039 Attrition"), React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 17,
      fontWeight: 700,
      color: MK.INK
    }
  }, u.dept, " \u2014 attrition detail"), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: MK.MUTED
    }
  }, "rolling 12 months \xB7 staff attached to the unit")), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("button", {
    className: "btn",
    title: "Marks the unit for this session only \u2014 not saved to the record",
    style: flagged ? {
      borderColor: 'rgba(210,58,82,.4)',
      background: 'rgba(210,58,82,.12)',
      color: '#d23a52'
    } : null,
    onClick: () => onFlag(u.dept)
  }, flagged ? 'Flagged for HR review' : 'Flag for HR review'), React.createElement("button", {
    className: "btn",
    onClick: () => window.print()
  }, "Print")), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
      gap: 14
    }
  }, React.createElement(AttrTile, {
    label: "Attrition rate",
    value: u.rate.toFixed(1) + '%',
    color: rateColor,
    foot: (u.rate > ATTR_TARGET ? 'above' : 'within') + ' the ' + ATTR_TARGET + '% target'
  }), React.createElement(AttrTile, {
    label: "Exits \xB7 12 months",
    value: u.exits,
    foot: "recorded separations"
  }), React.createElement(AttrTile, {
    label: "Staff on unit",
    value: u.roster,
    foot: u.nurses + ' nurse' + (u.nurses === 1 ? '' : 's') + ' · ' + u.pcas + ' PCA' + (u.pcas === 1 ? '' : 's') + ' attached'
  }), React.createElement(AttrTile, {
    label: "Rank",
    value: '#' + u.rank,
    foot: 'of ' + units.length + ' units by attrition rate'
  })), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h",
    style: {
      flexWrap: 'wrap'
    }
  }, React.createElement("h3", null, "Leavers from this unit"), React.createElement("span", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    style: {
      fontSize: 11,
      color: MK.FAINT
    }
  }, inFy, " of these ", u.exits, " exits fall inside the current fiscal year")), u.list.length === 0 ? React.createElement("div", {
    style: {
      padding: '28px 16px',
      textAlign: 'center',
      fontSize: 12.5,
      color: MK.FAINT
    }
  }, "No exits recorded for this unit in the last 12 months.") : u.list.map(l => React.createElement("div", {
    key: l.empId,
    onClick: () => onLeaver(l.empId),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      padding: '11px 16px',
      borderTop: '1px solid rgba(125,145,180,.14)',
      cursor: 'pointer'
    }
  }, React.createElement(MK.Av, {
    name: l.name,
    empId: l.empId,
    size: 30
  }), React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7
    }
  }, React.createElement("span", {
    style: {
      fontSize: 12.5,
      fontWeight: 600,
      color: MK.INK
    }
  }, l.name), React.createElement("span", {
    style: MK.roleChip(l.role)
  }, l.role)), React.createElement("div", {
    style: {
      fontSize: 11,
      color: MK.MUTED
    }
  }, l.designation || '—', " \xB7 left ", A.fmtDay(l.left), " after ", attrTenure(l.tenure))), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: MK.BODY,
      textAlign: 'right'
    }
  }, l.reason || React.createElement("span", {
    style: {
      color: MK.FAINT
    }
  }, "reason not recorded")), React.createElement("span", {
    style: {
      color: '#0090ca',
      flexShrink: 0
    }
  }, "\u203A")))));
}
function PerfLeaverRecord({
  empId,
  leavers,
  onBack
}) {
  const l = leavers.find(x => x.empId === empId);
  if (!l) {
    return React.createElement(Empty, {
      icon: I.user,
      title: "Leaver not found",
      sub: "This record is no longer in the roster archive, so nothing can be shown against it.",
      action: React.createElement("button", {
        className: "btn",
        onClick: onBack
      }, "\u2039 Attrition")
    });
  }
  const notRec = React.createElement("span", {
    style: {
      color: MK.FAINT,
      fontWeight: 500
    }
  }, "Not recorded");
  const facts = [['Date of joining', l.joined ? A.fmtDay(l.joined) : null], ['Last working day', l.left ? A.fmtDay(l.left) : null], ['Total tenure', l.tenure == null ? null : attrTenure(l.tenure)], ['Department at exit', l.dept], ['Designation', l.designation], ['Separation type', l.separation], ['Stated reason', l.reason], ['Last appraisal grade', l.lastGrade], ['Exit interview', l.interview ? 'Conducted' : null]];
  const has = item => l.clearance.indexOf(item) >= 0;
  const noticeDays = l.noticeDate && l.left ? Math.round((l.left - l.noticeDate) / 86400000) : null;
  const trail = [['Resignation submitted', l.noticeDate ? 'Notice received ' + A.fmtDay(l.noticeDate) : l.documented ? 'No notice date on the exit record' : 'No exit record filed', !!l.noticeDate], ['Notice period', noticeDays == null ? 'Not recorded' : noticeDays + ' day' + (noticeDays === 1 ? '' : 's') + ' between notice and last working day', noticeDays != null], ['Handover to charge nurse', has('Handover completed') ? 'Handover completed' : 'Not ticked on the clearance checklist', has('Handover completed')], ['Accounts clearance', has('Dues cleared') ? 'Dues cleared' : 'Not ticked on the clearance checklist', has('Dues cleared')], ['Exit interview', l.interview ? l.interview : 'Not recorded', !!l.interview]];
  return React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      maxWidth: 1100,
      margin: '0 auto',
      width: '100%'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, React.createElement("button", {
    className: "btn",
    onClick: onBack
  }, "\u2039 Exits register"), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("button", {
    className: "btn",
    onClick: () => window.print()
  }, "Print record")), React.createElement("div", {
    className: "card",
    style: {
      padding: '18px 22px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap'
    }
  }, React.createElement(MK.Av, {
    name: l.name,
    empId: l.empId,
    size: 56
  }), React.createElement("div", {
    style: {
      minWidth: 200
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, React.createElement("span", {
    style: {
      fontSize: 19,
      fontWeight: 700,
      color: MK.INK
    }
  }, l.name), React.createElement("span", {
    style: MK.roleChip(l.role)
  }, l.role)), React.createElement("div", {
    style: {
      fontSize: 12,
      color: MK.MUTED,
      marginTop: 2
    }
  }, l.designation || '—', " \xB7 ", l.dept)), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      color: MK.FAINT
    }
  }, "Last working day"), React.createElement("div", {
    className: "num",
    style: {
      fontSize: 17,
      fontWeight: 700,
      color: MK.INK
    }
  }, l.left ? A.fmtDay(l.left) : '—')), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7,
      alignItems: 'flex-end'
    }
  }, l.lastGrade ? React.createElement("span", {
    style: MK.gchip(l.lastGrade, true)
  }, l.lastGrade) : React.createElement("span", {
    style: histChip('#8a93a3')
  }, "Never appraised"), React.createElement("span", {
    style: histChip(l.rehire == null ? '#8a93a3' : l.rehire ? '#1f9d57' : '#d23a52')
  }, l.rehire == null ? 'Re-hire not assessed' : l.rehire ? 'Eligible for rehire' : 'Not eligible for rehire'))), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
      gap: 14,
      alignItems: 'start'
    }
  }, React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Service record")), React.createElement("div", {
    style: {
      padding: '4px 16px 12px'
    }
  }, facts.map(([k, v]) => React.createElement("div", {
    key: k,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '9px 0',
      borderBottom: '1px solid rgba(125,145,180,.12)'
    }
  }, React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: MK.FAINT,
      minWidth: 0,
      flex: 1
    }
  }, k), React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: MK.INK,
      fontWeight: 600,
      textAlign: 'right'
    }
  }, v || notRec))))), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Separation trail")), React.createElement("div", {
    style: {
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, trail.map(([t, s, done]) => React.createElement("div", {
    key: t,
    style: {
      display: 'flex',
      gap: 11
    }
  }, React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: '50%',
      flexShrink: 0,
      marginTop: 4,
      background: done ? '#1f9d57' : 'rgba(125,145,180,.45)'
    }
  }), React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 600,
      color: MK.INK
    }
  }, t), React.createElement("div", {
    style: {
      fontSize: 11,
      color: MK.MUTED
    }
  }, s)))))), React.createElement("div", {
    className: "card",
    style: {
      padding: '15px 17px'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: .6,
      textTransform: 'uppercase',
      color: MK.FAINT,
      marginBottom: 7
    }
  }, "Stated reason at exit"), React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: MK.INK
    }
  }, l.reason || notRec), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: MK.MUTED,
      marginTop: 6,
      lineHeight: 1.55
    }
  }, l.documented ? 'Recorded by the nurse in-charge at handover and confirmed by HR during clearance. Counted as a ' + (l.separation || 'recorded') + ' separation in the attrition figures.' : 'No exit record has been filed for this leaver — the roster archive is all this module knows. They still count in the attrition figures; the reason, tenure and clearance analysis stays empty until HR records the exit.')))));
}
function PerfAttritionRoute({
  roster,
  perf,
  staffStore,
  setRoute
}) {
  const [drill, setDrill] = useState(null);
  const [flags, setFlags] = useState({});
  const leavers = useLeavers(staffStore, perf);
  const units = useUnitAttrition(staffStore, leavers);
  const Overview = window.PerfAttrition;
  useEffect(() => {
    window.PerfUI.openAttritionDrill = setDrill;
    return () => {
      if (window.PerfUI.openAttritionDrill === setDrill) window.PerfUI.openAttritionDrill = null;
    };
  }, []);
  if (drill && drill.kind === 'leaver') {
    return React.createElement(PerfLeaverRecord, {
      empId: drill.empId,
      leavers: leavers,
      onBack: () => setDrill(null)
    });
  }
  if (drill && drill.kind === 'dept') {
    return React.createElement(PerfDeptAttrition, {
      unit: drill.dept,
      units: units,
      flagged: !!flags[drill.dept],
      onFlag: d => setFlags(s => ({
        ...s,
        [d]: !s[d]
      })),
      onBack: () => setDrill(null),
      onLeaver: empId => setDrill({
        kind: 'leaver',
        empId
      })
    });
  }
  return React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, React.createElement("div", {
    className: "card",
    style: {
      padding: '11px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap'
    }
  }, React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: .6,
      textTransform: 'uppercase',
      color: MK.FAINT
    }
  }, "Drill in"), React.createElement("select", {
    value: "",
    onChange: e => {
      if (e.target.value) setDrill({
        kind: 'dept',
        dept: e.target.value
      });
    }
  }, React.createElement("option", {
    value: ""
  }, "Unit attrition detail\u2026"), units.map(u => React.createElement("option", {
    key: u.dept,
    value: u.dept
  }, u.dept, " \u2014 ", u.rate.toFixed(1), "% \xB7 ", u.exits, " exit", u.exits === 1 ? '' : 's'))), React.createElement("select", {
    value: "",
    onChange: e => {
      if (e.target.value) setDrill({
        kind: 'leaver',
        empId: e.target.value
      });
    }
  }, React.createElement("option", {
    value: ""
  }, "Leaver record\u2026"), leavers.map(l => React.createElement("option", {
    key: l.empId,
    value: l.empId
  }, l.name, " \u2014 ", l.dept, " \xB7 ", A.fmtDay(l.left)))), leavers.length === 0 && React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: MK.FAINT
    }
  }, "Nobody has been archived off the roster yet, so there is no leaver to open.")), Overview ? React.createElement(Overview, {
    roster: roster,
    perf: perf,
    staffStore: staffStore,
    setRoute: setRoute
  }) : null);
}
function PerfSkeleton() {
  const shimmer = {
    background: 'linear-gradient(90deg,rgba(125,145,180,.10),rgba(125,145,180,.18),rgba(125,145,180,.10))',
    backgroundSize: '200% 100%',
    animation: 'perfShimmer 1.2s linear infinite',
    borderRadius: 8
  };
  const line = (w, h) => React.createElement("div", {
    style: Object.assign({
      width: w,
      height: h || 11
    }, shimmer)
  });
  return React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, React.createElement("style", null, '@keyframes perfShimmer{from{background-position:200% 0}to{background-position:-200% 0}}'), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, line('38%', 15), line('62%'))), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
      gap: 12
    }
  }, [0, 1, 2, 3, 4].map(i => React.createElement("div", {
    key: i,
    className: "card"
  }, React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 9
    }
  }, line('55%', 9), line('40%', 22), line('72%', 9))))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 13
    }
  }, [0, 1, 2, 3, 4, 5].map(i => React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, React.createElement("div", {
    style: Object.assign({
      width: 28,
      height: 28,
      borderRadius: '50%',
      flexShrink: 0
    }, shimmer)
  }), line('22%'), React.createElement("div", {
    style: {
      flex: 1
    }
  }, line('100%', 9)), line(54, 9))))), React.createElement("div", {
    style: {
      textAlign: 'center',
      fontSize: 11.5,
      color: MK.FAINT
    }
  }, "Loading performance records\u2026"));
}
function PerformanceView({
  view,
  emp,
  cycleId,
  setRoute
}) {
  const staffStore = window.useStaffStore();
  const perf = usePerfStore();
  const roster = useRoster(staffStore, perf);
  if (perf.loading) return React.createElement(PerfSkeleton, null);
  if (perf.error) {
    return React.createElement(Empty, {
      icon: I.alert || I.pulse,
      title: "Could not load performance records",
      sub: perf.error,
      action: React.createElement("button", {
        className: "btn pri",
        onClick: perf.reload
      }, "Try again")
    });
  }
  const inner = (() => {
    switch (view) {
      case 'perfDirectory':
        return React.createElement(PerfDirectory, {
          roster: roster,
          staffStore: staffStore,
          setRoute: setRoute
        });
      case 'perfForm':
        return React.createElement(PerfForm, {
          roster: roster,
          perf: perf,
          empId: emp,
          setRoute: setRoute
        });
      case 'perfPrint':
        return React.createElement(PerfPrint, {
          roster: roster,
          empId: emp,
          cycleId: cycleId,
          setRoute: setRoute
        });
      case 'perfStaff':
        return React.createElement(PerfStaffRecord, {
          roster: roster,
          perf: perf,
          empId: emp,
          setRoute: setRoute
        });
      case 'perfAchievements':
        return React.createElement(PerfRegister, {
          key: 'ach|' + (emp || ''),
          kind: "ach",
          roster: roster,
          perf: perf,
          setRoute: setRoute,
          focusEmp: emp
        });
      case 'perfIncidents':
        return React.createElement(PerfRegister, {
          key: 'inc|' + (emp || ''),
          kind: "inc",
          roster: roster,
          perf: perf,
          setRoute: setRoute,
          focusEmp: emp
        });
      case 'perfCompare':
        return React.createElement(PerfCompare, {
          roster: roster,
          setRoute: setRoute
        });
      case 'perfAttrition':
        return React.createElement(PerfAttritionRoute, {
          roster: roster,
          perf: perf,
          staffStore: staffStore,
          setRoute: setRoute
        });
      case 'perfRisk':
      case 'perfBoard':
        {
          const C = window[{
            perfRisk: 'PerfRisk',
            perfBoard: 'PerfBoard'
          }[view]];
          return C ? React.createElement(C, {
            roster: roster,
            perf: perf,
            staffStore: staffStore,
            setRoute: setRoute
          }) : null;
        }
      default:
        return React.createElement(PerfDashboard, {
          roster: roster,
          perf: perf,
          setRoute: setRoute
        });
    }
  })();
  return React.createElement("div", {
    className: "mk-scope"
  }, inner);
}
window.PerformanceView = PerformanceView;
function PerfBands({
  role,
  setRoute
}) {
  const staffStore = window.useStaffStore();
  const [data, setData] = useState(null);
  useEffect(() => {
    let live = true;
    perfApi.get('/api/performance').then(r => {
      if (live && r && r.ok) setData(r);
    }).catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const org = A.orgCycle(new Date());
  const rows = useMemo(() => {
    const now = new Date();
    return (staffStore.staff || []).filter(e => e.is_active !== false && !e.former && (!role || (e.role || 'Nurse') === role)).map(e => {
      const empId = e.emp_id || String(e.id);
      const cyc = A.cycleOf(e.doj, now);
      const apr = data ? (data.appraisals || []).find(x => x.empId === empId && cyc && x.cycleId === cyc.id) : null;
      const firstDue = e.doj ? A.addMonths(A.parseDate(e.doj) || now, 6) : null;
      const lastClosed = e.doj ? (A.cyclesSince(e.doj, now, 1) || [])[0] : null;
      const all = data && data.appraisals || [];
      const missedClosed = !!(lastClosed && !all.some(x => x.empId === empId && x.cycleId === lastClosed.id));
      return {
        empId,
        cycle: cyc,
        apr,
        status: apr ? apr.status : 'none',
        overdue: missedClosed,
        newJoinerDue: !!(firstDue && firstDue <= now && !all.some(x => x.empId === empId))
      };
    });
  }, [staffStore.staff, data, role]);
  if (!data) return null;
  const ach = data.achievements || [],
    inc = data.incidents || [];
  const achPts = ach.reduce((t, x) => t + (Number(x.points) || 0), 0);
  const incPts = inc.reduce((t, x) => t + (Number(x.points) || 0), 0);
  const recognised = new Set(ach.map(x => x.empId)).size;
  const withInc = new Set(inc.map(x => x.empId)).size;
  const done = rows.filter(r => r.status === 'actioned').length;
  const pending = rows.length - done;
  const newJoiners = rows.filter(r => r.overdue).length;
  const pctDone = rows.length ? Math.round(done / rows.length * 100) : 0;
  const Metric = ({
    icon,
    tint,
    value,
    label,
    sub,
    tone
  }) => React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      minWidth: 168
    }
  }, React.createElement("div", {
    style: MK.iconBadge(tint, 30)
  }, React.createElement(Ic, {
    d: icon,
    s: 15
  })), React.createElement("div", null, React.createElement("div", {
    className: "num",
    style: {
      fontSize: 19,
      fontWeight: 700,
      color: tone || MK.INK,
      lineHeight: 1.1
    }
  }, value), React.createElement("div", {
    style: {
      fontSize: 11,
      color: MK.BODY
    }
  }, label), sub && React.createElement("div", {
    style: {
      fontSize: 10,
      color: MK.FAINT
    }
  }, sub)));
  return React.createElement("div", {
    className: "mk-scope",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      marginBottom: 14
    }
  }, React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("div", {
    style: MK.iconBadge('amber', 30)
  }, React.createElement(Ic, {
    d: I.heart,
    s: 15
  })), React.createElement("h3", null, "Recognition and conduct \u2014 ", org.label), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    onClick: () => setRoute({
      view: 'perfAchievements'
    }),
    style: {
      cursor: 'pointer',
      fontSize: 10.6,
      fontWeight: 600,
      padding: '3px 11px',
      borderRadius: 12,
      color: '#0072a3',
      background: 'rgba(0,144,202,.12)'
    }
  }, "Achievements"), React.createElement("span", {
    onClick: () => setRoute({
      view: 'perfIncidents'
    }),
    style: {
      cursor: 'pointer',
      fontSize: 10.6,
      fontWeight: 600,
      padding: '3px 11px',
      borderRadius: 12,
      color: '#d23a52',
      background: 'rgba(210,58,82,.12)'
    }
  }, "Incidents")), React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      gap: 22,
      flexWrap: 'wrap'
    }
  }, React.createElement(Metric, {
    icon: I.heart,
    tint: "green",
    tone: "#1f9d57",
    value: ach.length,
    label: "Achievements recorded",
    sub: '+' + achPts + ' points'
  }), React.createElement(Metric, {
    icon: I.alert || I.pulse,
    tint: "red",
    tone: "#d23a52",
    value: inc.length,
    label: "Incidents recorded",
    sub: '−' + incPts + ' points'
  }), React.createElement(Metric, {
    icon: I.user,
    tint: "blue",
    value: recognised,
    label: "Staff recognised",
    sub: rows.length ? Math.round(recognised / rows.length * 100) + '% of the roster' : '—'
  }), React.createElement(Metric, {
    icon: I.doc,
    tint: "amber",
    value: withInc,
    label: "Staff with incidents",
    sub: rows.length ? Math.round(withInc / rows.length * 100) + '% of the roster' : '—'
  }))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      gap: 14,
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, React.createElement("div", {
    style: MK.iconBadge('blue', 30)
  }, React.createElement(Ic, {
    d: I.doc,
    s: 15
  })), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 260
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: MK.INK
    }
  }, "Individual Performance \u2014 ", org.label, " cycle"), React.createElement("div", {
    style: {
      fontSize: 11.4,
      color: MK.MUTED
    }
  }, pctDone, "% complete \xB7 ", pending, " appraisal", pending === 1 ? '' : 's', " pending", newJoiners ? ' · ' + newJoiners + ' past their first 6-month appraisal' : '')), React.createElement("div", {
    style: {
      width: 150
    }
  }, React.createElement("div", {
    style: MK.track(7)
  }, React.createElement("div", {
    style: MK.fill(pctDone, MK.progColor(pctDone / 100))
  }))), React.createElement("button", {
    className: "btn pri",
    onClick: () => setRoute({
      view: 'perfHome'
    })
  }, "Open Performance \u2192"))));
}
window.PerfBands = PerfBands;
window.PerfUI = {
  Stat,
  AccentStat,
  Bar,
  Gauge,
  Empty,
  Modal,
  GradePill,
  StatusChip,
  Trend,
  QuickCard,
  EntryList,
  initials,
  pct,
  gradeColor,
  todayISO,
  perfApi,
  perfToast,
  perfIsAdmin,
  perfCan,
  perfPortal,
  capsOf,
  PerfDeptAttrition,
  PerfLeaverRecord,
  useLeavers,
  useUnitAttrition,
  attrTenure,
  openAttritionDrill: null
};
})();
;
/* ===== performance-hr.jsx ===== */
(function(){
const {
  useState,
  useMemo
} = React;
const Ic = window.Ic,
  I = window.I;
const A = window.UNICO_APPRAISAL;
const MK = window.MK;
const {
  Stat,
  AccentStat,
  Bar,
  Empty,
  Modal,
  GradePill,
  initials,
  todayISO,
  perfCan
} = window.PerfUI;
const HR_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CLEARANCE_ITEMS = ['ID card returned', 'Locker / keys returned', 'Uniform returned', 'Library / manuals returned', 'Handover completed', 'Final duty roster settled', 'Dues cleared'];
const hrMonthKey = d => d ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') : '';
const hrParse = v => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};
function hrMonthsBetween(a, b) {
  if (!a || !b) return null;
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}
function hrTenureLabel(months) {
  if (months == null) return '—';
  if (months < 12) return months + ' mo';
  const y = Math.floor(months / 12),
    m = months % 12;
  return y + ' yr' + (y > 1 ? 's' : '') + (m ? ' ' + m + ' mo' : '');
}
function RuleStat({
  label,
  value,
  sub,
  color,
  tint,
  icon
}) {
  return React.createElement("div", {
    className: "card",
    style: {
      padding: '13px 15px',
      borderLeft: '3px solid ' + color
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9
    }
  }, React.createElement("div", {
    style: MK.iconBadge(tint, 30)
  }, React.createElement(Ic, {
    d: icon || I.user,
    s: 15
  })), React.createElement("span", {
    style: {
      fontSize: 12.5,
      fontWeight: 600,
      color: MK.INK
    }
  }, label)), React.createElement("div", {
    className: "num",
    style: {
      fontSize: 29,
      fontWeight: 700,
      color: color,
      lineHeight: 1.05,
      margin: '7px 0 5px',
      letterSpacing: '-.5px'
    }
  }, value), React.createElement("div", {
    style: {
      fontSize: 10.8,
      color: MK.FAINT
    }
  }, sub));
}
const ATTR_PERIODS = [{
  id: 'fy',
  label: 'FY YTD'
}, {
  id: '12',
  label: 'Rolling 12 months'
}, {
  id: '1',
  label: 'Current month'
}, {
  id: 'cycle',
  label: 'Current cycle'
}];
function PerfAttrition({
  roster,
  perf,
  staffStore,
  setRoute
}) {
  const [adding, setAdding] = useState(false);
  const [unit, setUnit] = useState('');
  const [period, setPeriod] = useState('12');
  const now = new Date();
  const leavers = useMemo(() => {
    const exitBy = {};
    (perf.exits || []).forEach(x => {
      exitBy[x.empId] = x;
    });
    return (staffStore.staff || []).filter(e => e.former || e.is_active === false).map(e => {
      const empId = e.emp_id || String(e.id);
      const x = exitBy[empId] || null;
      const left = hrParse(x && x.lastDay) || (e.archived_at ? new Date(e.archived_at) : null);
      const joined = hrParse(e.doj);
      return {
        empId,
        name: e.name,
        dept: e.current_department,
        designation: e.designation,
        joined,
        left,
        exit: x,
        reason: x && x.reason || e.archived_reason || '',
        separation: x && x.separation || '',
        tenure: hrMonthsBetween(joined, left),
        documented: !!x
      };
    }).filter(l => l.left).sort((a, b) => b.left - a.left);
  }, [staffStore.staff, perf.exits]);
  const active = (staffStore.staff || []).filter(e => e.is_active !== false && !e.former);
  const months = period === '1' ? 1 : period === 'fy' ? now.getMonth() + 1 : period === 'cycle' ? 6 : 12;
  const series = useMemo(() => {
    const out = [];
    for (let k = 11; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
      const key = hrMonthKey(d);
      const n = leavers.filter(l => hrMonthKey(l.left) === key).length;
      const after = leavers.filter(l => l.left > new Date(d.getFullYear(), d.getMonth() + 1, 0)).length;
      const head = active.length + after;
      out.push({
        key,
        label: HR_MONTHS[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2),
        leavers: n,
        head,
        rate: head ? n / head * 100 : 0
      });
    }
    return out;
  }, [leavers, active.length]);
  const window_ = series.slice(12 - months);
  const totalLeavers = window_.reduce((t, m) => t + m.leavers, 0);
  const avgHead = window_.length ? Math.round(window_.reduce((t, m) => t + m.head, 0) / window_.length) : 0;
  const openingHead = window_.length ? window_[0].head : 0;
  const monthlyRate = avgHead && months ? totalLeavers / months / avgHead * 100 : 0;
  const rateA = monthlyRate * 12;
  const rateB = openingHead ? totalLeavers / openingHead * (12 / months) * 100 : 0;
  const TARGET = 18;
  const firstYear = useMemo(() => {
    const cutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const joiners = (staffStore.staff || []).filter(e => {
      const j = hrParse(e.doj);
      return j && j >= cutoff;
    });
    const lost = leavers.filter(l => l.joined && l.joined >= cutoff && l.tenure != null && l.tenure < 12);
    return {
      joiners: joiners.length,
      lost: lost.length,
      pct: joiners.length ? lost.length / joiners.length * 100 : 0
    };
  }, [staffStore.staff, leavers]);
  const tenures = leavers.map(l => l.tenure).filter(x => x != null).sort((a, b) => a - b);
  const avgTenure = tenures.length ? Math.round(tenures.reduce((a, b) => a + b, 0) / tenures.length) : null;
  const medTenure = tenures.length ? tenures[Math.floor(tenures.length / 2)] : null;
  const byUnit = useMemo(() => {
    const m = {};
    active.forEach(e => {
      const d = e.current_department || 'Unassigned';
      (m[d] = m[d] || {
        dept: d,
        roster: 0,
        exits: 0
      }).roster++;
    });
    leavers.forEach(l => {
      const d = l.dept || 'Unassigned';
      (m[d] = m[d] || {
        dept: d,
        roster: 0,
        exits: 0
      }).exits++;
    });
    return Object.values(m).map(x => ({
      ...x,
      rate: x.roster + x.exits ? x.exits / (x.roster + x.exits) * 100 : 0
    })).sort((a, b) => b.rate - a.rate);
  }, [active, leavers]);
  const tenureBuckets = useMemo(() => {
    const b = [['Under 6 months', 0], ['6–12 months', 0], ['1–2 years', 0], ['2–5 years', 0], ['Over 5 years', 0]];
    leavers.forEach(l => {
      if (l.tenure == null) return;
      if (l.tenure < 6) b[0][1]++;else if (l.tenure < 12) b[1][1]++;else if (l.tenure < 24) b[2][1]++;else if (l.tenure < 60) b[3][1]++;else b[4][1]++;
    });
    return b;
  }, [leavers]);
  const reasons = useMemo(() => {
    const m = {};
    leavers.forEach(l => {
      const r = (l.reason || 'Not recorded').trim() || 'Not recorded';
      m[r] = (m[r] || 0) + 1;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [leavers]);
  const shown = unit ? leavers.filter(l => (l.dept || 'Unassigned') === unit) : leavers;
  const CW = 640,
    CH = 190,
    PAD = 26;
  const maxRate = Math.max(TARGET / 12 * 1.6, ...series.map(m => m.rate), 0.5);
  const px = k => PAD + k * (CW - PAD * 2) / Math.max(1, series.length - 1);
  const py = v => CH - PAD - v / maxRate * (CH - PAD * 2);
  const line = series.map((m, k) => (k ? 'L' : 'M') + px(k) + ' ' + py(m.rate)).join(' ');
  const areaPath = line + ' L' + px(series.length - 1) + ' ' + (CH - PAD) + ' L' + px(0) + ' ' + (CH - PAD) + ' Z';
  return React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, React.createElement("div", {
    className: "card",
    style: {
      padding: '16px 18px',
      display: 'flex',
      gap: 20,
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, React.createElement("div", {
    style: {
      minWidth: 230
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: .6,
      textTransform: 'uppercase',
      color: '#1f9d57'
    }
  }, React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: '#1f9d57'
    }
  }), "Workforce \xB7 Nursing staff"), React.createElement("div", {
    style: {
      fontSize: 21,
      fontWeight: 700,
      color: MK.INK,
      margin: '3px 0 2px'
    }
  }, "Nurse Attrition"), React.createElement("div", {
    style: {
      fontSize: 11.6,
      color: MK.MUTED
    }
  }, "Separations across ", byUnit.length, " units \xB7 last ", months, " month", months > 1 ? 's' : '')), React.createElement("div", null, React.createElement("div", {
    className: "num",
    style: {
      fontSize: 38,
      fontWeight: 700,
      color: rateA > TARGET ? '#d23a52' : '#1f9d57',
      lineHeight: 1,
      letterSpacing: '-1px'
    }
  }, rateA.toFixed(1), "%"), React.createElement("div", {
    style: {
      fontSize: 10.8,
      color: MK.FAINT,
      marginTop: 3
    }
  }, "annualised \xB7 last ", months, " month", months > 1 ? 's' : '')), React.createElement("span", {
    style: {
      fontSize: 11.4,
      fontWeight: 600,
      padding: '5px 12px',
      borderRadius: 14,
      color: rateA > TARGET ? '#d23a52' : '#1f9d57',
      background: (rateA > TARGET ? '#d23a52' : '#1f9d57') + '16'
    }
  }, rateA > TARGET ? '↗ +' : '↘ ', Math.abs(rateA - TARGET).toFixed(1), " pts vs target"), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, React.createElement("button", {
    className: "btn",
    onClick: () => setRoute({
      view: 'perfRisk'
    })
  }, "Retention risk"), React.createElement("button", {
    className: "btn",
    onClick: () => window.print()
  }, "PDF"), perfCan('add') && React.createElement("button", {
    className: "btn pri",
    onClick: () => setAdding(true)
  }, "+ Record an exit"))), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, React.createElement("span", {
    style: {
      fontSize: 9.6,
      fontWeight: 700,
      letterSpacing: .6,
      textTransform: 'uppercase',
      color: MK.FAINT
    }
  }, "Period"), ATTR_PERIODS.map(p => React.createElement("button", {
    key: p.id,
    onClick: () => setPeriod(p.id),
    style: {
      cursor: 'pointer',
      font: 'inherit',
      fontSize: 11.4,
      fontWeight: 600,
      padding: '5px 12px',
      borderRadius: 9,
      color: period === p.id ? '#0072a3' : MK.MUTED,
      background: period === p.id ? 'rgba(0,144,202,.12)' : 'rgba(255,255,255,.6)',
      border: '1px solid ' + (period === p.id ? 'rgba(0,144,202,.4)' : 'rgba(125,145,180,.24)')
    }
  }, p.label)), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    style: {
      fontSize: 11.2,
      color: MK.FAINT
    }
  }, "Average headcount in period ", React.createElement("b", {
    className: "num",
    style: {
      color: MK.INK
    }
  }, avgHead))), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))',
      gap: 12
    }
  }, React.createElement(RuleStat, {
    label: "Attrition rate",
    value: rateA.toFixed(1) + '%',
    sub: 'annualised · target ' + TARGET + '%',
    color: "#d23a52",
    tint: "red",
    icon: I.pulse
  }), React.createElement(RuleStat, {
    label: "Monthly rate",
    value: monthlyRate.toFixed(2) + '%',
    sub: "leavers \xF7 average headcount",
    color: "#0090ca",
    tint: "blue",
    icon: I.grid
  }), React.createElement(RuleStat, {
    label: "Exits",
    value: totalLeavers,
    sub: 'last ' + months + ' month' + (months > 1 ? 's' : ''),
    color: "#e08a1e",
    tint: "amber",
    icon: I.user
  }), React.createElement(RuleStat, {
    label: "First-year attrition",
    value: firstYear.pct.toFixed(1) + '%',
    sub: firstYear.lost + ' of ' + firstYear.joiners + ' joiners left within 12 months',
    color: "#6a52d4",
    tint: "violet",
    icon: I.user
  }), React.createElement(RuleStat, {
    label: "Avg tenure at exit",
    value: avgTenure == null ? '—' : hrTenureLabel(avgTenure),
    sub: medTenure == null ? 'no exits recorded' : 'median ' + hrTenureLabel(medTenure),
    color: "#2b8f83",
    tint: "teal",
    icon: I.doc
  })), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1.4fr) minmax(300px,1fr)',
      gap: 14,
      alignItems: 'start'
    }
  }, React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Monthly attrition rate \u2014 last 12 months"), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    style: {
      fontSize: 10.6,
      color: MK.MUTED
    }
  }, React.createElement("span", {
    style: {
      color: '#2b8f83'
    }
  }, "\u2014"), " monthly rate"), React.createElement("span", {
    style: {
      fontSize: 10.6,
      color: MK.MUTED
    }
  }, React.createElement("span", {
    style: {
      color: '#d23a52'
    }
  }, "--"), " Target ", TARGET, "% a year")), React.createElement("div", {
    className: "card-b"
  }, totalLeavers === 0 && leavers.length === 0 ? React.createElement(Empty, {
    icon: I.user,
    title: "No exits recorded",
    sub: "Nobody has been archived from the roster, so there is nothing to rate. Removing a staff member from the roster is what registers an exit."
  }) : React.createElement(React.Fragment, null, React.createElement("svg", {
    viewBox: '0 0 ' + CW + ' ' + CH,
    style: {
      width: '100%',
      height: 210
    }
  }, React.createElement("defs", null, React.createElement("linearGradient", {
    id: "attrFill",
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, React.createElement("stop", {
    offset: "0%",
    stopColor: "rgba(58,181,167,.34)"
  }), React.createElement("stop", {
    offset: "100%",
    stopColor: "rgba(58,181,167,.02)"
  }))), [0, maxRate / 2, maxRate].map((v, k) => React.createElement("line", {
    key: k,
    x1: PAD,
    x2: CW - PAD,
    y1: py(v),
    y2: py(v),
    stroke: "rgba(125,145,180,.18)"
  })), React.createElement("line", {
    x1: PAD,
    x2: CW - PAD,
    y1: py(TARGET / 12),
    y2: py(TARGET / 12),
    stroke: "#d23a52",
    strokeWidth: "1.4",
    strokeDasharray: "5 4"
  }), React.createElement("path", {
    d: areaPath,
    fill: "url(#attrFill)"
  }), React.createElement("path", {
    d: line,
    fill: "none",
    stroke: "#2b8f83",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }), series.map((m, k) => React.createElement("circle", {
    key: k,
    cx: px(k),
    cy: py(m.rate),
    r: "4.4",
    fill: "#fff",
    stroke: m.leavers ? '#d23a52' : '#2b8f83',
    strokeWidth: "2"
  }))), React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 9.4,
      color: MK.FAINT,
      padding: '0 20px'
    }
  }, series.map(m => React.createElement("span", {
    key: m.key,
    style: {
      flex: 1,
      textAlign: 'center'
    }
  }, m.label.split(' ')[0])))))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "How the rate is calculated")), React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 11
    }
  }, React.createElement("div", {
    style: {
      padding: '11px 13px',
      borderRadius: 11,
      background: 'rgba(0,144,202,.07)',
      border: '1px solid rgba(0,144,202,.16)'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: .5,
      textTransform: 'uppercase',
      color: '#0072a3'
    }
  }, "Method A \xB7 monthly"), React.createElement("div", {
    className: "num",
    style: {
      fontSize: 11.4,
      color: MK.BODY,
      margin: '4px 0 6px'
    }
  }, "leavers \xF7 average headcount \xD7 100"), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8
    }
  }, React.createElement("span", {
    className: "num",
    style: {
      fontSize: 21,
      fontWeight: 700,
      color: MK.INK
    }
  }, rateA.toFixed(1), "%"), React.createElement("span", {
    style: {
      fontSize: 10.8,
      color: MK.FAINT
    }
  }, monthlyRate.toFixed(2), "% monthly \xD7 12"))), React.createElement("div", {
    style: {
      padding: '11px 13px',
      borderRadius: 11,
      background: 'rgba(106,82,212,.07)',
      border: '1px solid rgba(106,82,212,.16)'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: .5,
      textTransform: 'uppercase',
      color: '#6a52d4'
    }
  }, "Method B \xB7 annualised"), React.createElement("div", {
    className: "num",
    style: {
      fontSize: 11.4,
      color: MK.BODY,
      margin: '4px 0 6px'
    }
  }, "leavers \xF7 opening headcount, annualised"), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8
    }
  }, React.createElement("span", {
    className: "num",
    style: {
      fontSize: 21,
      fontWeight: 700,
      color: MK.INK
    }
  }, rateB.toFixed(1), "%"), React.createElement("span", {
    style: {
      fontSize: 10.8,
      color: MK.FAINT
    }
  }, totalLeavers, " of ", openingHead, " in ", months, " month", months > 1 ? 's' : ''))), React.createElement("div", {
    style: {
      fontSize: 10.6,
      color: MK.FAINT,
      lineHeight: 1.5
    }
  }, "Headcount for a past month is reconstructed as today's active roster plus everybody who left after that month \u2014 exact when the roster has been kept current, and the only basis available without a historical headcount snapshot.")))), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))',
      gap: 14
    }
  }, React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "By unit"), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    className: "sub"
  }, "click to filter")), React.createElement("div", {
    className: "card-b",
    style: {
      maxHeight: 300,
      overflow: 'auto'
    }
  }, React.createElement("table", {
    className: "tbl"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Unit"), React.createElement("th", {
    style: {
      width: 54
    }
  }, "Roster"), React.createElement("th", {
    style: {
      width: 46
    }
  }, "Exits"), React.createElement("th", {
    style: {
      width: 74
    }
  }, "Rate"))), React.createElement("tbody", null, byUnit.map(u => React.createElement("tr", {
    key: u.dept,
    style: {
      cursor: 'pointer',
      background: unit === u.dept ? 'rgba(0,144,202,.07)' : undefined
    },
    onClick: () => setUnit(unit === u.dept ? '' : u.dept)
  }, React.createElement("td", {
    style: {
      fontWeight: 600,
      color: MK.INK
    }
  }, u.dept), React.createElement("td", {
    className: "num"
  }, u.roster), React.createElement("td", {
    className: "num"
  }, u.exits), React.createElement("td", {
    className: "num",
    style: {
      color: u.rate > 15 ? '#d23a52' : u.rate > 8 ? '#e08a1e' : MK.BODY
    }
  }, u.rate.toFixed(1), "%"))))))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Tenure at exit"), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    className: "sub"
  }, "how long they stayed")), React.createElement("div", {
    className: "card-b"
  }, leavers.length === 0 ? React.createElement("div", {
    className: "sub",
    style: {
      textAlign: 'center',
      padding: 14
    }
  }, "No exits yet.") : React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, tenureBuckets.map(([l, n]) => React.createElement("div", {
    key: l,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9
    }
  }, React.createElement("div", {
    style: {
      width: 106,
      fontSize: 11.4,
      color: MK.BODY
    }
  }, l), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement(Bar, {
    value: n,
    max: Math.max(1, ...tenureBuckets.map(x => x[1])),
    color: "#6a52d4"
  })), React.createElement("div", {
    className: "num",
    style: {
      width: 24,
      textAlign: 'right',
      fontWeight: 700
    }
  }, n)))))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Reason for leaving"), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    className: "sub"
  }, "as stated at exit")), React.createElement("div", {
    className: "card-b"
  }, reasons.length === 0 ? React.createElement("div", {
    className: "sub",
    style: {
      textAlign: 'center',
      padding: 14
    }
  }, "No exits yet.") : React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, reasons.map(([r, n]) => React.createElement("div", {
    key: r,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9
    }
  }, React.createElement("div", {
    style: {
      width: 128,
      fontSize: 11.4,
      color: MK.BODY,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    },
    title: r
  }, r), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement(Bar, {
    value: n,
    max: reasons[0][1],
    color: r === 'Not recorded' ? '#b9c6d6' : '#0090ca'
  })), React.createElement("div", {
    className: "num",
    style: {
      width: 24,
      textAlign: 'right',
      fontWeight: 700
    }
  }, n))))))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Exits register"), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    className: "sub"
  }, shown.length, " record(s)", unit ? ' · ' + unit : ''), unit && React.createElement("button", {
    className: "btn",
    onClick: () => setUnit('')
  }, "Clear filter")), React.createElement("div", {
    className: "card-b",
    style: {
      overflow: 'auto'
    }
  }, shown.length === 0 ? React.createElement(Empty, {
    icon: I.user,
    title: "No exits match this view"
  }) : React.createElement("table", {
    className: "tbl"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Staff member"), React.createElement("th", null, "Unit"), React.createElement("th", null, "Joined"), React.createElement("th", null, "Last day"), React.createElement("th", null, "Tenure"), React.createElement("th", null, "Separation"), React.createElement("th", null, "Reason"), React.createElement("th", null))), React.createElement("tbody", null, shown.map(l => React.createElement("tr", {
    key: l.empId
  }, React.createElement("td", null, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, React.createElement(MK.Av, {
    name: l.name,
    empId: l.empId,
    size: 26
  }), React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 600,
      color: MK.INK
    }
  }, l.name), React.createElement("div", {
    style: {
      fontSize: 10.6,
      color: MK.FAINT
    }
  }, l.empId, " \xB7 ", l.designation)))), React.createElement("td", null, l.dept), React.createElement("td", {
    className: "num",
    style: {
      fontSize: 11.2
    }
  }, l.joined ? A.fmtDay(l.joined) : '—'), React.createElement("td", {
    className: "num",
    style: {
      fontSize: 11.2
    }
  }, l.left ? A.fmtDay(l.left) : '—'), React.createElement("td", {
    className: "num"
  }, hrTenureLabel(l.tenure)), React.createElement("td", {
    className: "sub"
  }, l.separation || '—'), React.createElement("td", {
    className: "sub"
  }, l.reason || React.createElement("span", {
    style: {
      opacity: .5
    }
  }, "not recorded")), React.createElement("td", {
    style: {
      textAlign: 'right'
    }
  }, !l.documented && perfCan('add') ? React.createElement("button", {
    className: "btn",
    onClick: () => setAdding(l)
  }, "Add exit record") : React.createElement("span", {
    style: MK.stChip('Actioned')
  }, "documented")))))))), adding && React.createElement(ExitModal, {
    roster: roster,
    perf: perf,
    staffStore: staffStore,
    prefill: adding === true ? null : adding,
    onClose: () => setAdding(false)
  }));
}
const EXIT_REASONS = {
  'Resignation': ['Higher studies', 'Better offer', 'Family relocation', 'Health', 'Marriage', 'Going abroad', 'Workload', 'Salary', 'Personal'],
  'End of contract': ['Contract completed', 'Not renewed', 'Project ended'],
  'Retirement': ['Superannuation', 'Early retirement'],
  'Termination': ['Performance', 'Misconduct', 'Attendance', 'Probation not confirmed'],
  'Absconded': ['No notice, stopped attending'],
  'Transfer': ['Internal transfer', 'Sister concern'],
  'Other': ['Deceased', 'Maternity — did not return', 'Not stated']
};
const XF = {
  padding: '8px 10px',
  border: '1px solid var(--line,#dde3ec)',
  borderRadius: 8,
  fontSize: 12.6,
  fontFamily: 'inherit',
  color: 'inherit',
  background: '#fff',
  outline: 'none',
  width: '100%'
};
function ExitModal({
  roster,
  perf,
  staffStore,
  prefill,
  onClose
}) {
  const leavers = (staffStore.staff || []).filter(e => e.former || e.is_active === false);
  const [empId, setEmpId] = useState(prefill ? prefill.empId : '');
  const [noticeDate, setNoticeDate] = useState('');
  const [lastDay, setLastDay] = useState(prefill && prefill.left ? prefill.left.toISOString().slice(0, 10) : todayISO());
  const [separation, setSeparation] = useState('Resignation');
  const [reason, setReason] = useState(prefill ? prefill.reason : '');
  const [interview, setInterview] = useState('');
  const [clearance, setClearance] = useState([]);
  const [rehire, setRehire] = useState(true);
  const [handoverTo, setHandoverTo] = useState('');
  const [contact, setContact] = useState('');
  const [settlementDate, setSettlementDate] = useState('');
  const [noticeServed, setNoticeServed] = useState('');
  const [busy, setBusy] = useState(false);
  const options = [...(staffStore.staff || [])].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const person = options.find(e => (e.emp_id || String(e.id)) === empId);
  const row = roster.byEmp[empId];
  const joined = person ? hrParse(person.doj) : null;
  const tenure = hrMonthsBetween(joined, hrParse(lastDay));
  const noticeDays = (() => {
    const a = Date.parse(noticeDate),
      b = Date.parse(lastDay);
    if (isNaN(a) || isNaN(b) || b < a) return null;
    return Math.round((b - a) / 86400000);
  })();
  const toggle = c => setClearance(s => s.indexOf(c) >= 0 ? s.filter(x => x !== c) : [...s, c]);
  const submit = () => {
    if (!person) return;
    setBusy(true);
    perf.addExit({
      empId,
      staffName: person.name,
      department: person.current_department,
      designation: person.designation,
      doj: person.doj,
      noticeDate,
      lastDay,
      separation,
      reason,
      interview,
      clearance,
      rehire,
      handoverTo,
      contact,
      settlementDate,
      noticeServed,
      lastGrade: row && row.last ? row.last.grade : ''
    }).then(r => {
      setBusy(false);
      if (r && r.ok) onClose();
    });
  };
  return React.createElement(Modal, {
    wide: true,
    title: "Record an exit",
    sub: "The separation record HR keeps \u2014 the roster only knows that somebody left",
    onClose: onClose,
    footer: React.createElement(React.Fragment, null, React.createElement("button", {
      className: "btn",
      onClick: onClose
    }, "Cancel"), React.createElement("button", {
      className: "btn pri",
      disabled: busy || !empId || !lastDay,
      onClick: submit
    }, busy ? 'Saving…' : 'Save exit record'))
  }, React.createElement("div", {
    style: {
      display: 'grid',
      gap: 10
    }
  }, React.createElement("label", {
    style: {
      display: 'grid',
      gap: 4
    }
  }, React.createElement("span", {
    className: "sub"
  }, "Staff member *"), React.createElement("select", {
    value: empId,
    onChange: e => setEmpId(e.target.value),
    style: XF
  }, React.createElement("option", {
    value: ""
  }, "Select\u2026"), options.map(e => {
    const id = e.emp_id || String(e.id);
    return React.createElement("option", {
      key: id,
      value: id
    }, e.name, " \u2014 ", id, e.former ? ' (archived)' : '');
  }))), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
      gap: 10
    }
  }, React.createElement("label", {
    style: {
      display: 'grid',
      gap: 4
    }
  }, React.createElement("span", {
    className: "sub"
  }, "Notice received"), React.createElement("input", {
    type: "date",
    value: noticeDate,
    onChange: e => setNoticeDate(e.target.value),
    style: XF
  })), React.createElement("label", {
    style: {
      display: 'grid',
      gap: 4
    }
  }, React.createElement("span", {
    className: "sub"
  }, "Last working day *"), React.createElement("input", {
    type: "date",
    value: lastDay,
    onChange: e => setLastDay(e.target.value),
    style: XF
  })), React.createElement("label", {
    style: {
      display: 'grid',
      gap: 4
    }
  }, React.createElement("span", {
    className: "sub"
  }, "Separation type"), React.createElement("select", {
    value: separation,
    onChange: e => {
      setSeparation(e.target.value);
      setReason('');
    },
    style: XF
  }, ['Resignation', 'End of contract', 'Retirement', 'Termination', 'Absconded', 'Transfer', 'Other'].map(t => React.createElement("option", {
    key: t
  }, t)))), React.createElement("label", {
    style: {
      display: 'grid',
      gap: 4
    }
  }, React.createElement("span", {
    className: "sub"
  }, "Notice period served", noticeDays != null ? ' · ' + noticeDays + ' days' : ''), React.createElement("select", {
    value: noticeServed,
    onChange: e => setNoticeServed(e.target.value),
    style: XF
  }, React.createElement("option", {
    value: ""
  }, "\u2014"), ['Full', 'Partial', 'None'].map(t => React.createElement("option", {
    key: t
  }, t))))), React.createElement("label", {
    style: {
      display: 'grid',
      gap: 4
    }
  }, React.createElement("span", {
    className: "sub"
  }, "Stated reason at exit"), React.createElement("input", {
    value: reason,
    onChange: e => setReason(e.target.value),
    style: XF,
    placeholder: "Pick one below, or type the reason as it was given"
  })), React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: -4
    }
  }, (EXIT_REASONS[separation] || []).map(r => {
    const on = reason === r;
    return React.createElement("button", {
      key: r,
      onClick: () => setReason(on ? '' : r),
      style: {
        padding: '4px 10px',
        borderRadius: 16,
        cursor: 'pointer',
        font: 'inherit',
        fontSize: 11.4,
        fontWeight: 600,
        border: '1px solid ' + (on ? '#27a8db' : 'var(--line,#dde3ec)'),
        background: on ? 'rgba(39,168,219,.12)' : '#fff',
        color: on ? '#0b6f96' : 'var(--muted,#6c7a8c)'
      }
    }, r);
  })), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
      gap: 10
    }
  }, React.createElement("label", {
    style: {
      display: 'grid',
      gap: 4
    }
  }, React.createElement("span", {
    className: "sub"
  }, "Handover to"), React.createElement("input", {
    value: handoverTo,
    onChange: e => setHandoverTo(e.target.value),
    list: "hr-exit-handover",
    style: XF,
    placeholder: "Who took over the work"
  }), React.createElement("datalist", {
    id: "hr-exit-handover"
  }, options.filter(e => !e.former).slice(0, 400).map(e => React.createElement("option", {
    key: e.id,
    value: e.name
  })))), React.createElement("label", {
    style: {
      display: 'grid',
      gap: 4
    }
  }, React.createElement("span", {
    className: "sub"
  }, "Forwarding contact"), React.createElement("input", {
    value: contact,
    onChange: e => setContact(e.target.value),
    style: XF,
    placeholder: "Phone or email after leaving"
  })), React.createElement("label", {
    style: {
      display: 'grid',
      gap: 4
    }
  }, React.createElement("span", {
    className: "sub"
  }, "Final settlement date"), React.createElement("input", {
    type: "date",
    value: settlementDate,
    onChange: e => setSettlementDate(e.target.value),
    style: XF
  }))), React.createElement("label", {
    style: {
      display: 'grid',
      gap: 4
    }
  }, React.createElement("span", {
    className: "sub"
  }, "Exit interview notes"), React.createElement("textarea", {
    rows: "3",
    value: interview,
    onChange: e => setInterview(e.target.value),
    style: {
      ...XF,
      resize: 'vertical'
    }
  })), React.createElement("div", null, React.createElement("div", {
    className: "sub",
    style: {
      marginBottom: 5
    }
  }, "Clearance checklist"), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
      gap: 6
    }
  }, CLEARANCE_ITEMS.map(c => {
    const on = clearance.indexOf(c) >= 0;
    return React.createElement("button", {
      key: c,
      onClick: () => toggle(c),
      style: {
        textAlign: 'left',
        padding: '6px 9px',
        borderRadius: 7,
        cursor: 'pointer',
        font: 'inherit',
        color: 'inherit',
        fontSize: 11.6,
        border: '1px solid ' + (on ? '#1f9d63' : 'var(--line,#dde3ec)'),
        background: on ? 'rgba(31,157,99,.10)' : 'transparent'
      }
    }, on ? '✓ ' : '○ ', c);
  }))), React.createElement("label", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      fontSize: 12.3
    }
  }, React.createElement("input", {
    type: "checkbox",
    checked: rehire,
    onChange: e => setRehire(e.target.checked)
  }), " Eligible for re-hire"), person && React.createElement("div", {
    className: "card",
    style: {
      background: 'rgba(39,168,219,.06)'
    }
  }, React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      gap: 18,
      flexWrap: 'wrap',
      fontSize: 12
    }
  }, React.createElement("div", null, React.createElement("div", {
    className: "sub",
    style: {
      fontSize: 11
    }
  }, "Service record"), React.createElement("b", null, hrTenureLabel(tenure))), React.createElement("div", null, React.createElement("div", {
    className: "sub",
    style: {
      fontSize: 11
    }
  }, "Joined"), React.createElement("b", null, joined ? A.fmtDay(joined) : '—')), React.createElement("div", null, React.createElement("div", {
    className: "sub",
    style: {
      fontSize: 11
    }
  }, "Last appraisal"), React.createElement("b", null, row && row.last ? row.last.grade + ' · ' + row.last.score : '—')), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 200
    },
    className: "sub"
  }, "What this affects: the attrition rate, the unit's exit count and the tenure analysis. It does not remove the person from the roster \u2014 archive them in Staff Management for that.")))));
}
const RISK_DRIVERS = [{
  id: 'incidents',
  label: 'Incident entries this cycle',
  points: 25,
  why: 'a record of errors or lapses in the current window',
  color: '#d23a52'
}, {
  id: 'lowgrade',
  label: 'Last grade D or E',
  points: 25,
  why: 'the previous appraisal fell below satisfactory',
  color: '#e08a1e'
}, {
  id: 'overdue',
  label: 'Appraisal overdue',
  points: 20,
  why: 'the six-month window has closed with no form filed',
  color: '#0090ca'
}, {
  id: 'newJoiner',
  label: 'Under 12 months tenure',
  points: 15,
  why: 'early tenure is where attrition concentrates',
  color: '#6a52d4'
}, {
  id: 'noRecognition',
  label: 'No recognition this cycle',
  points: 10,
  why: 'nothing recorded on the achievement register',
  color: '#3ab5a7'
}, {
  id: 'hotUnit',
  label: 'Unit above average attrition',
  points: 5,
  why: 'their unit has lost more people than most',
  color: '#8aa0b8'
}];
const RISK_BANDS = [{
  min: 70,
  label: 'High',
  color: '#d23a52'
}, {
  min: 50,
  label: 'Medium',
  color: '#e08a1e'
}, {
  min: 0,
  label: 'Low',
  color: '#1f9d57'
}];
const riskBand = n => RISK_BANDS.find(b => n >= b.min) || RISK_BANDS[RISK_BANDS.length - 1];
function PerfRisk({
  roster,
  perf,
  staffStore,
  setRoute
}) {
  const now = new Date();
  const leaversByDept = useMemo(() => {
    const m = {};
    (staffStore.staff || []).filter(e => e.former || e.is_active === false).forEach(e => {
      const d = e.current_department || 'Unassigned';
      m[d] = (m[d] || 0) + 1;
    });
    return m;
  }, [staffStore.staff]);
  const avgLeavers = useMemo(() => {
    const v = Object.values(leaversByDept);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
  }, [leaversByDept]);
  const scored = useMemo(() => roster.rows.map(r => {
    const drivers = [];
    if (r.incidents.length) drivers.push({
      id: 'incidents',
      text: r.incidents.length + ' incident entr' + (r.incidents.length === 1 ? 'y' : 'ies') + ' this cycle'
    });
    if (r.last && (r.last.grade === 'D' || r.last.grade === 'E')) drivers.push({
      id: 'lowgrade',
      text: 'Last grade ' + r.last.grade + ' — below satisfactory'
    });
    if (r.overdue) drivers.push({
      id: 'overdue',
      text: 'Appraisal overdue since ' + A.fmtDay(r.firstDue)
    });
    const joined = hrParse(r.doj);
    const tenure = hrMonthsBetween(joined, now);
    if (joined && tenure != null && tenure < 12) drivers.push({
      id: 'newJoiner',
      text: hrTenureLabel(tenure) + ' on roster'
    });
    if (!r.achievements.length) drivers.push({
      id: 'noRecognition',
      text: 'No recognition recorded this cycle'
    });
    if ((leaversByDept[r.dept || 'Unassigned'] || 0) > avgLeavers && avgLeavers > 0) drivers.push({
      id: 'hotUnit',
      text: r.dept + ' is above average attrition'
    });
    const score = drivers.reduce((t, d) => t + (RISK_DRIVERS.find(x => x.id === d.id) || {
      points: 0
    }).points, 0);
    return {
      ...r,
      drivers,
      score,
      tenure,
      band: riskBand(score)
    };
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score), [roster.rows, leaversByDept, avgLeavers]);
  const high = scored.filter(r => r.score >= 70);
  const medium = scored.filter(r => r.score >= 50 && r.score < 70);
  const watch = scored.filter(r => r.score >= 50);
  const driverCounts = RISK_DRIVERS.map(d => ({
    ...d,
    n: scored.filter(r => r.drivers.some(x => x.id === d.id)).length
  })).sort((a, b) => b.n - a.n);
  const maxDriver = Math.max(1, ...driverCounts.map(d => d.n));
  return React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap'
    }
  }, React.createElement("div", {
    style: MK.iconBadge('red', 34)
  }, React.createElement(Ic, {
    d: I.alert || I.pulse,
    s: 17
  })), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 260
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 15.5,
      color: MK.INK
    }
  }, "Retention risk watchlist"), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: MK.MUTED
    }
  }, "Scored from incident history, appraisal movement, tenure and recognition \u2014 reviewed each cycle")), React.createElement("button", {
    className: "btn",
    onClick: () => setRoute({
      view: 'perfAttrition'
    })
  }, "Attrition")), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))',
      gap: 12
    }
  }, React.createElement(AccentStat, {
    label: "High risk",
    value: high.length,
    sub: "score 70 +",
    color: "#d23a52"
  }), React.createElement(AccentStat, {
    label: "Medium risk",
    value: medium.length,
    sub: "score 50 \u2013 69",
    color: "#e08a1e"
  }), React.createElement(AccentStat, {
    label: "Watchlist total",
    value: watch.length,
    sub: roster.rows.length ? (watch.length / roster.rows.length * 100).toFixed(1) + '% of nursing roster' : '—',
    color: "#0090ca"
  }), React.createElement(AccentStat, {
    label: "Clear",
    value: roster.rows.length - scored.length,
    sub: "no risk signal at all",
    color: "#1f9d57"
  })), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1.5fr) minmax(300px,1fr)',
      gap: 14,
      alignItems: 'start'
    }
  }, React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Staff to speak with this month"), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    className: "sub"
  }, watch.length, " on the list")), React.createElement("div", {
    className: "card-b",
    style: {
      maxHeight: 620,
      overflow: 'auto',
      padding: 0
    }
  }, scored.length === 0 ? React.createElement(Empty, {
    icon: I.check || I.doc,
    title: "Nobody is showing a risk signal",
    sub: "No incidents, no low grades, no overdue appraisals. That is a good place to be."
  }) : scored.slice(0, 40).map(r => React.createElement("div", {
    key: r.empId,
    onClick: () => setRoute({
      view: 'perfStaff',
      emp: r.empId
    }),
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'center',
      padding: '12px 16px',
      borderBottom: '1px solid rgba(125,145,180,.12)',
      cursor: 'pointer'
    }
  }, React.createElement(MK.Av, {
    name: r.name,
    emp: r.emp,
    empId: r.empId,
    size: 34
  }), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      flexWrap: 'wrap'
    }
  }, React.createElement("span", {
    style: {
      fontWeight: 700,
      fontSize: 13,
      color: MK.INK
    }
  }, r.name), React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      padding: '1px 8px',
      borderRadius: 12,
      color: r.band.color,
      background: r.band.color + '18'
    }
  }, r.band.label), React.createElement("span", {
    style: MK.gchip(r.last ? r.last.grade : '')
  }, r.last ? r.last.grade : '–')), React.createElement("div", {
    style: {
      fontSize: 11,
      color: MK.MUTED,
      marginTop: 1
    }
  }, r.dept, " \xB7 ", r.designation, r.tenure != null ? ' · ' + hrTenureLabel(r.tenure) + ' on roster' : ''), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      flexWrap: 'wrap',
      marginTop: 5
    }
  }, r.drivers.map(d => {
    const def = RISK_DRIVERS.find(x => x.id === d.id) || {};
    return React.createElement("span", {
      key: d.id,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 10.8,
        color: MK.BODY
      }
    }, React.createElement("span", {
      style: {
        width: 5,
        height: 5,
        borderRadius: '50%',
        background: def.color
      }
    }), d.text);
  }))), React.createElement("div", {
    style: {
      textAlign: 'right',
      minWidth: 84
    }
  }, React.createElement("div", {
    className: "num",
    style: {
      fontSize: 21,
      fontWeight: 700,
      color: r.band.color,
      lineHeight: 1
    }
  }, r.score), React.createElement("div", {
    style: {
      fontSize: 9.4,
      color: MK.FAINT,
      margin: '2px 0 5px'
    }
  }, "risk score"), React.createElement("div", {
    style: MK.track(5)
  }, React.createElement("div", {
    style: MK.fill(r.score, r.band.color)
  }))))))), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Most common risk drivers")), React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 11
    }
  }, driverCounts.map(d => React.createElement("div", {
    key: d.id
  }, React.createElement("div", {
    style: {
      fontSize: 11.6,
      color: MK.BODY,
      marginBottom: 4
    }
  }, d.label), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9
    }
  }, React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement(Bar, {
    value: d.n,
    max: maxDriver,
    color: d.color,
    height: 6
  })), React.createElement("span", {
    className: "num",
    style: {
      width: 22,
      textAlign: 'right',
      fontSize: 11.5,
      fontWeight: 700,
      color: d.color
    }
  }, d.n)))))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "How the score is built"), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    className: "sub"
  }, "out of 100")), React.createElement("div", {
    className: "card-b"
  }, React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7,
      marginBottom: 10
    }
  }, RISK_DRIVERS.map(d => React.createElement("div", {
    key: d.id,
    style: {
      display: 'flex',
      gap: 9,
      alignItems: 'baseline',
      fontSize: 11.4
    }
  }, React.createElement("span", {
    className: "num",
    style: {
      minWidth: 30,
      textAlign: 'center',
      fontWeight: 700,
      padding: '2px 0',
      borderRadius: 12,
      color: d.color,
      background: d.color + '16'
    }
  }, "+", d.points), React.createElement("div", null, React.createElement("b", {
    style: {
      color: MK.INK
    }
  }, d.label), React.createElement("div", {
    style: {
      fontSize: 10.6,
      color: MK.FAINT
    }
  }, d.why))))), React.createElement("div", {
    style: {
      fontSize: 11,
      color: MK.FAINT,
      lineHeight: 1.55,
      borderTop: '1px solid ' + MK.LINE,
      paddingTop: 9
    }
  }, "Incident history, appraisal movement between cycles, tenure band and recognition on file. Nothing here is a prediction \u2014 it is a shortlist for the nurse in-charge to have a conversation, and never a reason on its own for any action under Part H."))))));
}
const REWARD_TIERS = [{
  min: 5,
  label: 'Certificate of Excellence + full 5-point bonus',
  tone: '#1f9d57'
}, {
  min: 4,
  label: 'Certificate of Appreciation',
  tone: '#3ab5a7'
}, {
  min: 3,
  label: 'Written commendation on file',
  tone: '#0090ca'
}, {
  min: 2,
  label: 'Named on the recognition wall',
  tone: '#6a52d4'
}, {
  min: 1,
  label: 'Noted on the appraisal',
  tone: '#8aa0b8'
}];
const CAT_TONE = {
  'Award / recognition': '#e08a1e',
  'Training completed': '#0090ca',
  'Presentation / teaching': '#6a52d4',
  'Quality improvement adopted': '#3ab5a7',
  'Patient / family appreciation': '#1f9d57',
  'Extra duty / emergency cover': '#d23a52'
};
const catTone = c => CAT_TONE[c] || '#5b6b80';
function PerfBoard({
  roster,
  perf,
  staffStore,
  setRoute
}) {
  const org = A.orgCycle(new Date());
  const entries = perf.achievements || [];
  const leaders = useMemo(() => {
    const m = {};
    entries.forEach(r => {
      const k = r.empId;
      m[k] = m[k] || {
        empId: k,
        name: r.staffName,
        dept: r.department,
        desig: '',
        pts: 0,
        n: 0
      };
      m[k].pts += Number(r.points) || 0;
      m[k].n++;
      const row = roster.byEmp[k];
      if (row) {
        m[k].desig = row.designation;
        m[k].dept = row.dept || m[k].dept;
      }
    });
    return Object.values(m).map(x => ({
      ...x,
      capped: Math.min(x.pts, A.BONUS_CAP)
    })).sort((a, b) => b.pts - a.pts);
  }, [entries, roster.byEmp]);
  const topPts = leaders.length ? leaders[0].pts : 1;
  const wall = entries.filter(e => (Number(e.points) || 0) >= 2).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const monthly = useMemo(() => {
    const now = new Date();
    const out = [];
    for (let k = 0; k < 6; k++) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
      const key = hrMonthKey(d);
      const inMonth = entries.filter(e => String(e.date || '').slice(0, 7) === key);
      if (!inMonth.length) {
        out.push({
          key,
          label: HR_MONTHS[d.getMonth()] + ' ' + d.getFullYear(),
          winner: null
        });
        continue;
      }
      const m = {};
      inMonth.forEach(e => {
        (m[e.empId] = m[e.empId] || {
          empId: e.empId,
          name: e.staffName,
          dept: e.department,
          pts: 0
        }).pts += Number(e.points) || 0;
      });
      out.push({
        key,
        label: HR_MONTHS[d.getMonth()] + ' ' + d.getFullYear(),
        winner: Object.values(m).sort((a, b) => b.pts - a.pts)[0]
      });
    }
    return out;
  }, [entries]);
  const milestones = useMemo(() => {
    const now = new Date();
    const out = [];
    (staffStore.staff || []).filter(e => e.is_active !== false && !e.former).forEach(e => {
      const j2 = hrParse(e.doj);
      if (!j2) return;
      [5, 10, 15, 20, 25].forEach(y => {
        const at = new Date(j2.getFullYear() + y, j2.getMonth(), j2.getDate());
        const days = Math.round((at - now) / 86400000);
        if (days >= -30 && days <= 90) out.push({
          name: e.name,
          dept: e.current_department,
          years: y,
          at,
          days
        });
      });
    });
    return out.sort((a, b) => a.days - b.days);
  }, [staffStore.staff]);
  return React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap'
    }
  }, React.createElement("div", {
    style: MK.iconBadge('amber', 34)
  }, React.createElement(Ic, {
    d: I.heart,
    s: 17
  })), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 260
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 15.5,
      color: MK.INK
    }
  }, "Recognition board"), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: MK.MUTED
    }
  }, org.label, " \xB7 points from every recorded achievement and award")), React.createElement("button", {
    className: "btn",
    onClick: () => setRoute({
      view: 'perfAchievements'
    })
  }, "Achievement register"), React.createElement("button", {
    className: "btn",
    onClick: () => window.print()
  }, "Print for notice board")), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(300px,1fr) minmax(0,1.6fr)',
      gap: 14,
      alignItems: 'start'
    }
  }, React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Leaderboard"), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    className: "sub"
  }, "points this cycle")), React.createElement("div", {
    className: "card-b",
    style: {
      padding: 0
    }
  }, leaders.length === 0 ? React.createElement(Empty, {
    icon: I.heart,
    title: "No entries yet",
    sub: "Record an achievement and the leaderboard fills in.",
    action: React.createElement("button", {
      className: "btn pri",
      onClick: () => setRoute({
        view: 'perfAchievements'
      })
    }, "Record an achievement")
  }) : leaders.slice(0, 12).map((l, k) => React.createElement("div", {
    key: l.empId,
    onClick: () => setRoute({
      view: 'perfStaff',
      emp: l.empId
    }),
    style: {
      padding: '11px 16px',
      borderBottom: '1px solid rgba(125,145,180,.12)',
      cursor: 'pointer'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, React.createElement("span", {
    className: "num",
    style: {
      width: 22,
      fontSize: 11.5,
      fontWeight: 700,
      color: '#e08a1e'
    }
  }, "#", k + 1), React.createElement(MK.Av, {
    name: l.name,
    empId: l.empId,
    size: 32
  }), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12.8,
      fontWeight: 700,
      color: MK.INK,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, l.name), React.createElement("div", {
    style: {
      fontSize: 10.6,
      color: MK.FAINT
    }
  }, [l.desig, l.dept].filter(Boolean).join(' · '))), React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, React.createElement("div", {
    className: "num",
    style: {
      fontSize: 17,
      fontWeight: 700,
      color: MK.INK,
      lineHeight: 1
    }
  }, l.pts), React.createElement("div", {
    style: {
      fontSize: 9.6,
      color: MK.FAINT
    }
  }, l.n, " entr", l.n === 1 ? 'y' : 'ies'))), React.createElement("div", {
    style: {
      marginTop: 7
    }
  }, React.createElement("div", {
    style: MK.track(5)
  }, React.createElement("div", {
    style: MK.fill(l.pts / topPts * 100, 'linear-gradient(90deg,#3ab5a7,#0090ca)')
  }))))))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Wall of recognition"), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    className: "sub"
  }, "2 points and above")), React.createElement("div", {
    className: "card-b"
  }, wall.length === 0 ? React.createElement(Empty, {
    icon: I.heart,
    title: "Nothing on the wall yet",
    sub: "Entries worth 2 points or more appear here \u2014 record an achievement to start the board."
  }) : React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))',
      gap: 12
    }
  }, wall.map(e => {
    const tone = catTone(e.category);
    return React.createElement("div", {
      key: e.id,
      onClick: () => setRoute({
        view: 'perfStaff',
        emp: e.empId
      }),
      style: {
        padding: '13px 14px',
        borderRadius: 12,
        background: 'rgba(255,255,255,.62)',
        border: '1px solid rgba(125,145,180,.2)',
        cursor: 'pointer'
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        marginBottom: 8
      }
    }, React.createElement(MK.Av, {
      name: e.staffName,
      empId: e.empId,
      size: 32
    }), React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        fontSize: 12.8,
        fontWeight: 700,
        color: MK.INK,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, e.staffName), React.createElement("div", {
      style: {
        fontSize: 10.4,
        color: MK.FAINT
      }
    }, [(roster.byEmp[e.empId] || {}).designation, e.department].filter(Boolean).join(' · ')))), React.createElement("div", {
      style: {
        fontSize: 12.2,
        color: MK.BODY,
        lineHeight: 1.45,
        minHeight: 34
      }
    }, e.what), React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 9
      }
    }, React.createElement("span", {
      style: {
        fontSize: 10.4,
        fontWeight: 600,
        padding: '2px 9px',
        borderRadius: 12,
        color: tone,
        background: tone + '18'
      }
    }, e.category), React.createElement("span", {
      className: "num",
      style: {
        fontSize: 10.4,
        color: MK.FAINT
      }
    }, e.date), React.createElement("div", {
      style: {
        flex: 1
      }
    }), React.createElement("span", {
      className: "num",
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: '#1f9d57'
      }
    }, "+", e.points)));
  }))))), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))',
      gap: 14
    }
  }, React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Employee of the month"), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    className: "sub"
  }, "highest points each month")), React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, monthly.map(m => React.createElement("div", {
    key: m.key,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontSize: 12
    }
  }, React.createElement("span", {
    className: "num",
    style: {
      width: 76,
      fontSize: 10.8,
      color: MK.FAINT
    }
  }, m.label), m.winner ? React.createElement(React.Fragment, null, React.createElement(MK.Av, {
    name: m.winner.name,
    empId: m.winner.empId,
    size: 24
  }), React.createElement("span", {
    style: {
      flex: 1,
      fontWeight: 600,
      color: MK.INK
    }
  }, m.winner.name), React.createElement("span", {
    className: "num",
    style: {
      fontWeight: 700,
      padding: '2px 9px',
      borderRadius: 12,
      color: '#e08a1e',
      background: 'rgba(224,138,30,.16)'
    }
  }, "+", m.winner.pts)) : React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 11.4,
      color: MK.FAINT
    }
  }, "no entries"))))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Long-service milestones"), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    className: "sub"
  }, "next 90 days")), React.createElement("div", {
    className: "card-b"
  }, milestones.length === 0 ? React.createElement("div", {
    className: "sub",
    style: {
      textAlign: 'center',
      padding: 14
    }
  }, "None in the next 90 days.") : React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, milestones.slice(0, 10).map((m, k) => React.createElement("div", {
    key: k,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontSize: 12
    }
  }, React.createElement("span", {
    className: "num",
    style: {
      fontWeight: 700,
      padding: '2px 9px',
      borderRadius: 12,
      color: '#e08a1e',
      background: 'rgba(224,138,30,.16)'
    }
  }, m.years, " yr"), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 600,
      color: MK.INK,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, m.name), React.createElement("div", {
    style: {
      fontSize: 10.4,
      color: MK.FAINT
    }
  }, m.dept)), React.createElement("span", {
    className: "num",
    style: {
      fontSize: 10.8,
      color: MK.FAINT
    }
  }, m.days < 0 ? Math.abs(m.days) + 'd ago' : 'in ' + m.days + 'd')))))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Points and rewards"), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    className: "sub"
  }, "what each total earns")), React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, REWARD_TIERS.map(t => React.createElement("div", {
    key: t.min,
    style: {
      display: 'flex',
      gap: 9,
      alignItems: 'baseline',
      fontSize: 11.8
    }
  }, React.createElement("span", {
    className: "num",
    style: {
      minWidth: 30,
      textAlign: 'center',
      fontWeight: 700,
      padding: '2px 0',
      borderRadius: 12,
      color: t.tone,
      background: t.tone + '18'
    }
  }, t.min, "+"), React.createElement("span", {
    style: {
      color: MK.BODY
    }
  }, t.label))), React.createElement("div", {
    style: {
      fontSize: 10.6,
      color: MK.FAINT,
      borderTop: '1px solid ' + MK.LINE,
      paddingTop: 8,
      lineHeight: 1.5
    }
  }, "Bonus points are capped at ", A.BONUS_CAP, " per staff member per appraisal cycle, and are added after the 20 parameters have been scored.")))));
}
window.PerfAttrition = PerfAttrition;
window.PerfRisk = PerfRisk;
window.PerfBoard = PerfBoard;
})();
