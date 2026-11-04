/* ===== device-days.jsx ===== */
(function(){
(function () {
  const {
    useState,
    useEffect,
    useMemo,
    useRef,
    useCallback
  } = React;
  const DD = window.UNICO_DD;
  const F = DD.FIELDS;
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  })[c]);
  const toast = (m, t) => {
    if (window.UI && window.UI.toast) window.UI.toast(m, t);
  };
  const confirmBox = o => window.UI && window.UI.confirm ? window.UI.confirm(o) : Promise.resolve(window.confirm(o.message || o.title));
  const refreshBadge = () => {
    try {
      window.dispatchEvent(new Event('unico:dd-refresh'));
    } catch (e) {}
  };
  const lsGet = k => {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  };
  const lsSet = (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch (e) {}
  };
  const addMonth = (ym, n) => {
    let y = +ym.slice(0, 4),
      m = +ym.slice(5, 7) - 1 + n;
    y += Math.floor(m / 12);
    m = (m % 12 + 12) % 12;
    return y + '-' + String(m + 1).padStart(2, '0');
  };
  const FREQ_LABEL = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly'
  };
  const when = t => t ? new Date(t).toLocaleString('en-GB', {
    timeZone: 'Asia/Dhaka',
    dateStyle: 'medium',
    timeStyle: 'short'
  }) : '';
  async function api(url, opts) {
    const r = await fetch(url, Object.assign({
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      }
    }, opts || {}));
    if (r.status === 401 || r.redirected) throw new Error('Your session has expired. Sign in again.');
    const j = await r.json().catch(() => null);
    if (!j) throw new Error('The server did not answer. Please try again.');
    if (!j.ok) {
      const e = new Error(j.error || 'Something went wrong.');
      e.status = r.status;
      e.body = j;
      throw e;
    }
    return j;
  }
  const CSS = `
.dd-wrap{display:flex;flex-direction:column;gap:14px}
.dd-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:10px 14px}
.dd-sel{padding:6px 10px;border-radius:8px;border:1px solid var(--line);background:#fff;font:inherit;font-size:12.5px;color:var(--ink-2);max-width:260px}
.dd-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--muted)}
.dd-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.dd-banner{display:flex;gap:10px;align-items:flex-start;padding:10px 14px;border-radius:10px;border:1px solid #f3c2cb;background:#fdf0f2;color:#8f1d33;font-size:12.5px}
.dd-banner.amber{border-color:#f0d49a;background:#fff8e9;color:#7a4b00}
.dd-banner button{border:0;background:#fff;border:1px solid currentColor;color:inherit;border-radius:6px;padding:1px 7px;margin:2px 3px 0 0;font:inherit;font-size:11.5px;font-weight:700;cursor:pointer}
.dd-tbl{border-collapse:separate;border-spacing:0;width:100%;font-size:12.5px}
.dd-tbl th{position:sticky;top:0;z-index:1;text-align:left;padding:8px 8px;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px;color:var(--muted);font-weight:700;border-bottom:1px solid var(--line);background:var(--blue-50);white-space:nowrap}
.dd-tbl td{padding:4px 8px;border-bottom:1px solid var(--line-2);white-space:nowrap;vertical-align:middle}
.dd-tbl tr td:first-child{border-left:4px solid transparent}
.dd-tbl input{width:74px;padding:5px 7px;border:1px solid var(--line);border-radius:6px;font:inherit;font-size:12.5px;text-align:right;font-variant-numeric:tabular-nums;background:#fff}
.dd-tbl input[type=time]{width:96px;text-align:left}
.dd-tbl input:disabled{background:transparent;border-color:transparent;color:var(--ink-2)}
.dd-tbl input.bad{border-color:var(--rose);background:#fdf0f2}
.dd-tbl tfoot td{font-weight:700;background:#e6f1f8;border-top:1.5px solid var(--blue-700);text-align:right;font-variant-numeric:tabular-nums;padding:7px 8px}
.dd-day b{font-variant-numeric:tabular-nums}.dd-day small{color:var(--muted);margin-left:6px}
.dd-chip{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:700;letter-spacing:.2px}
.dd-st-approved td:first-child{border-left-color:var(--green)}.dd-chip.approved{background:#e7f6ed;color:#14713f}
.dd-st-submitted td:first-child{border-left-color:var(--blue)}.dd-chip.submitted{background:var(--blue-50);color:var(--blue-700)}
.dd-st-returned td{background:#fffaf0}.dd-st-returned td:first-child{border-left-color:var(--amber)}.dd-chip.returned{background:#fbf0dd;color:#8a5a00}
.dd-st-missing td{background:#fff6f7}.dd-st-missing td:first-child{border-left-color:var(--rose)}.dd-chip.missing{background:#fde4e8;color:#a3172f}
.dd-st-open td:first-child{border-left-color:#cfd8e3}.dd-chip.open{background:#eef2f6;color:#5b6878}
.dd-st-future td{color:#a3adba}.dd-chip.future{background:transparent;color:#a3adba}
.dd-chip.not-due{background:#f3f5f8;color:#8a96a6}.dd-chip.draft{background:#eef2f6;color:#5b6878}
.dd-today td{background:#e9fbf8!important}
.dd-today td:first-child{border-left-color:var(--teal)!important}
.dd-today .dd-day{position:relative}
.dd-today-chip{display:inline-block;margin-left:8px;padding:1px 7px;border-radius:999px;background:var(--teal);color:#fff;font-size:10px;font-weight:800;letter-spacing:.4px;animation:dd-pulse 1.6s ease-out infinite}
.dd-today td:first-child{animation:dd-glow 1.6s ease-out infinite}
@keyframes dd-pulse{0%{box-shadow:0 0 0 0 rgba(58,181,167,.65)}70%{box-shadow:0 0 0 9px rgba(58,181,167,0)}100%{box-shadow:0 0 0 0 rgba(58,181,167,0)}}
@keyframes dd-glow{0%,100%{box-shadow:inset 4px 0 0 var(--teal)}50%{box-shadow:inset 4px 0 0 var(--teal),0 0 0 3px rgba(58,181,167,.25)}}
.dd-flash td{animation:dd-flash 1.2s ease-out 2}
@keyframes dd-flash{0%{background:#fff3c4}100%{background:inherit}}
@media (prefers-reduced-motion:reduce){.dd-today-chip,.dd-today td:first-child,.dd-flash td{animation:none}}
.dd-reason{font-size:11px;color:#8a5a00;white-space:normal;max-width:260px}
.dd-err{font-size:11px;color:var(--rose);white-space:normal}
.dd-send{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px 14px;position:sticky;bottom:8px;z-index:2;box-shadow:0 6px 22px rgba(13,27,46,.12)}
.dd-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.dd-kpi{padding:12px 14px}.dd-kpi span{display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);font-weight:700}
.dd-kpi b{display:block;font-size:22px;font-weight:800;color:var(--ink);font-variant-numeric:tabular-nums;margin-top:2px}.dd-kpi small{color:var(--muted);font-size:11px}
.dd-strip{display:flex;gap:1px}.dd-strip i{width:5px;height:14px;border-radius:1.5px;display:block}
.dd-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.dd-empty{padding:26px 10px;text-align:center;color:var(--muted);font-size:12.5px}
.dd-icon-btn{border:1px solid var(--line);background:#fff;border-radius:6px;padding:3px 8px;font:inherit;font-size:11px;font-weight:600;color:var(--ink-2);cursor:pointer}
.dd-icon-btn:disabled{opacity:.45;cursor:default}
@media (max-width:720px){.dd-tbl input{width:58px}.dd-tbl input[type=time]{width:84px}}
`;
  function useStyles() {
    useEffect(() => {
      if (document.getElementById('dd-css')) return;
      const s = document.createElement('style');
      s.id = 'dd-css';
      s.textContent = CSS;
      document.head.appendChild(s);
    }, []);
  }
  const STRIP_COLOR = {
    approved: '#1f9d57',
    submitted: '#0090ca',
    returned: '#e08a1e',
    missing: '#d23a52',
    open: '#cfd8e3',
    future: '#eef2f6',
    'not-due': '#eef2f6'
  };
  const STATE_LABEL = {
    approved: 'Approved',
    submitted: 'Sent · waiting',
    returned: 'Returned',
    missing: 'Missed',
    open: 'To fill',
    future: '',
    'not-due': 'Not due',
    draft: 'Saved · not sent'
  };
  const Chip = ({
    s,
    label
  }) => React.createElement("span", {
    className: 'dd-chip ' + s
  }, label || STATE_LABEL[s] || s);
  const Legend = () => React.createElement("div", {
    className: "dd-legend"
  }, [['missing', 'Missed'], ['returned', 'Returned'], ['open', 'To fill'], ['submitted', 'Sent'], ['approved', 'Approved']].map(([k, l]) => React.createElement("span", {
    key: k
  }, React.createElement("i", {
    style: {
      background: STRIP_COLOR[k]
    }
  }), l)), React.createElement("span", null, React.createElement("i", {
    style: {
      background: 'var(--teal)'
    }
  }), "Today"));
  function useMeta() {
    const [meta, setMeta] = useState(null);
    const [err, setErr] = useState('');
    useEffect(() => {
      api('/api/device-days/meta').then(setMeta).catch(e => setErr(e.message));
    }, []);
    return [meta, err];
  }
  function DeptPicker({
    meta,
    dept,
    setDept
  }) {
    if (!meta || meta.departments.length < 2) return meta && meta.departments[0] ? React.createElement("b", {
      style: {
        fontSize: 14
      }
    }, meta.departments[0].name) : null;
    return React.createElement("select", {
      className: "dd-sel",
      value: dept || '',
      onChange: e => setDept(e.target.value)
    }, meta.departments.map(d => React.createElement("option", {
      key: d.id,
      value: d.id
    }, d.name)));
  }
  const NoDepts = ({
    meta
  }) => React.createElement("div", {
    className: "card dd-empty"
  }, meta && meta.isAdmin ? React.createElement("span", null, "No department is set up for Device Days yet. Open ", React.createElement("b", null, "Device Days \u2192 Settings"), ", tick the departments that keep this record and choose how often they send it.") : React.createElement("span", null, "No department has been set for you yet. Ask the administrator to choose your departments in Access Control \u2192 Device Days."));
  function useDept(meta, initial) {
    const [dept, setDeptS] = useState(initial || lsGet('unico_dd_dept') || '');
    useEffect(() => {
      if (!meta || !meta.departments.length) return;
      if (!meta.departments.some(d => d.id === dept)) setDeptS(meta.departments[0].id);
    }, [meta]);
    const setDept = v => {
      setDeptS(v);
      lsSet('unico_dd_dept', v);
    };
    return [dept, setDept];
  }
  function EntrySheet({
    initialDept,
    initialMonth
  }) {
    const [meta, metaErr] = useMeta();
    const [dept, setDept] = useDept(meta, initialDept);
    const today = meta ? meta.today : DD.hospitalNow().date;
    const [month, setMonth] = useState(DD.isMonth(initialMonth) ? initialMonth : DD.hospitalNow().date.slice(0, 7));
    const [data, setData] = useState(null);
    const [err, setErr] = useState('');
    const [edits, setEdits] = useState({});
    const [busy, setBusy] = useState('');
    const [flash, setFlash] = useState('');
    const [unlocked, setUnlocked] = useState({});
    const scrolled = useRef('');
    const rowRefs = useRef({});
    const load = useCallback(() => {
      if (!dept) return;
      setErr('');
      api('/api/device-days?dept=' + encodeURIComponent(dept) + '&month=' + month).then(j => {
        setData(j);
      }).catch(e => setErr(e.message));
    }, [dept, month]);
    useEffect(() => {
      setData(null);
      setEdits({});
      load();
    }, [load]);
    useEffect(() => {
      const h = () => load();
      window.addEventListener('unico:data-refreshed', h);
      return () => window.removeEventListener('unico:data-refreshed', h);
    }, [load]);
    useEffect(() => {
      if (!data || scrolled.current === dept + month) return;
      scrolled.current = dept + month;
      const target = data.days.find(d => d.date === today) ? today : (data.days.find(d => d.state === 'missing') || {}).date;
      if (target) setTimeout(() => jump(target, data.days.find(d => d.date === target).state !== 'approved'), 120);
    }, [data]);
    function jump(date, focus) {
      const el = rowRefs.current[date];
      if (!el) return;
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      setFlash(date);
      setTimeout(() => setFlash(''), 2600);
      if (focus) {
        const inp = el.querySelector('input:not(:disabled)');
        if (inp) setTimeout(() => inp.focus({
          preventScroll: true
        }), 350);
      }
    }
    if (metaErr) return React.createElement("div", {
      className: "card",
      style: {
        color: 'var(--rose)'
      }
    }, metaErr);
    if (!meta) return React.createElement("div", {
      className: "card",
      style: {
        color: 'var(--muted)'
      }
    }, "Loading\u2026");
    if (!meta.departments.length) return React.createElement(NoDepts, {
      meta: meta
    });
    const deptObj = meta.departments.find(d => d.id === dept) || meta.departments[0];
    const cfg = deptObj.cfg;
    const valOf = (d, f) => {
      const e = edits[d.date];
      if (e && Object.prototype.hasOwnProperty.call(e, f)) return e[f];
      return d.row ? d.row[f] == null ? '' : String(d.row[f]) : '';
    };
    const rowVals = d => {
      const o = {
        time: valOf(d, 'time') || cfg.census || '08:00'
      };
      F.forEach(f => {
        o[f.id] = valOf(d, f.id);
      });
      return o;
    };
    const dirty = d => !!edits[d.date] && Object.keys(edits[d.date]).some(k => String(edits[d.date][k]) !== String(d.row && d.row[k] != null ? d.row[k] : ''));
    const editable = d => {
      if (d.state === 'future') return false;
      const st = d.row && d.row.status;
      if (st === 'submitted' || st === 'approved') return meta.canReview && !!unlocked[d.date];
      return meta.canAdd || meta.canReview;
    };
    const setVal = (date, f, v) => setEdits(e => Object.assign({}, e, {
      [date]: Object.assign({}, e[date] || {}, {
        [f]: v
      })
    }));
    const rowErr = d => {
      const v = rowVals(d);
      const any = F.some(f => v[f.id] !== '');
      if (!any) return null;
      return DD.validateRow(v);
    };
    const badField = (d, f) => {
      const v = rowVals(d);
      const x = v[f];
      if (x === '') return false;
      if (!Number.isInteger(+x) || +x < 0) return true;
      return f !== 'total' && v.total !== '' && +x > +v.total;
    };
    async function saveRow(d, quiet) {
      const v = rowVals(d);
      const e = DD.validateRow(v);
      if (e) {
        if (!quiet) toast(DD.fmtDay(d.date) + ': ' + e, 'error');
        return false;
      }
      const locked = d.row && (d.row.status === 'submitted' || d.row.status === 'approved');
      if (locked && !quiet) {
        const ok = await confirmBox({
          title: 'Correct a sent day?',
          message: DD.fmtDay(d.date) + ' has already been ' + (d.row.status === 'approved' ? 'approved' : 'sent') + '. Your correction is recorded in its history and the day goes back to review.',
          confirmLabel: 'Save correction'
        });
        if (!ok) return false;
      }
      try {
        const j = await api('/api/device-days/' + encodeURIComponent(dept) + '/' + d.date, {
          method: 'PUT',
          body: JSON.stringify(Object.assign({}, v, {
            baseUpdatedAt: d.row ? d.row.updatedAt : null
          }))
        });
        setEdits(x => {
          const n = Object.assign({}, x);
          delete n[d.date];
          return n;
        });
        setUnlocked(x => {
          const n = Object.assign({}, x);
          delete n[d.date];
          return n;
        });
        setData(cur => cur && Object.assign({}, cur, {
          days: cur.days.map(x => x.date === d.date ? Object.assign({}, x, {
            row: j.row,
            state: DD.dayState(x.date, j.row, cfg)
          }) : x)
        }));
        return true;
      } catch (err2) {
        toast(DD.fmtDay(d.date) + ': ' + err2.message, 'error');
        if (err2.status === 409) load();
        return false;
      }
    }
    async function saveAll() {
      const list = data.days.filter(d => dirty(d));
      if (!list.length) return true;
      setBusy('save');
      let ok = true;
      for (const d of list) {
        if (!(await saveRow(d, true))) ok = false;
      }
      setBusy('');
      if (ok) toast(list.length === 1 ? 'Saved.' : list.length + ' days saved.', 'success');else toast('Some days were not saved — check the rows marked in red.', 'error');
      load();
      refreshBadge();
      return ok;
    }
    async function send() {
      if (data.days.some(d => dirty(d))) {
        if (!(await saveAll())) return;
      }
      const fresh = await api('/api/device-days?dept=' + encodeURIComponent(dept) + '&month=' + month).catch(() => data);
      const unsent = fresh.days.filter(d => d.row && (d.row.status === 'draft' || d.row.status === 'returned'));
      if (!unsent.length) {
        toast('There is nothing new to send.', 'info');
        return;
      }
      const from = unsent[0].date,
        to = unsent[unsent.length - 1].date;
      const periods = [...new Set(unsent.map(d => d.period.key))];
      const openPeriods = unsent.filter(d => d.state === 'open' && cfg.frequency !== 'daily').map(d => d.period.label);
      const emptyInRange = fresh.days.filter(d => d.date >= from && d.date <= to && !d.row && d.state !== 'future').map(d => DD.fmtDay(d.date));
      const msg = 'Send ' + unsent.length + ' day(s): ' + unsent.map(d => DD.fmtDay(d.date)).join(', ') + '.' + (openPeriods.length ? '\n\nThe ' + (cfg.frequency === 'weekly' ? 'week' : 'month') + ' ' + [...new Set(openPeriods)].join(', ') + ' is not over yet — you are sending early.' : '') + (emptyInRange.length ? '\n\nNot filled (they stay missed): ' + emptyInRange.join(', ') + '.' : '') + '\n\nAfter sending, only a reviewer can change these days.';
      const ok = await confirmBox({
        title: 'Send to review?',
        message: msg,
        confirmLabel: 'Send ' + unsent.length + ' day(s)'
      });
      if (!ok) return;
      setBusy('send');
      try {
        const j = await api('/api/device-days/submit', {
          method: 'POST',
          body: JSON.stringify({
            dept,
            from,
            to
          })
        });
        toast(j.sent + ' day(s) sent for review' + (periods.length > 1 ? ' (' + periods.length + ' periods)' : '') + '.', 'success');
      } catch (e) {
        toast(e.message, 'error');
      }
      setBusy('');
      load();
      refreshBadge();
    }
    async function removeRow(d) {
      const ok = await confirmBox({
        title: 'Remove this day?',
        message: 'Remove the figures for ' + DD.fmtDay(d.date) + '? The record is kept in the history and the day will show as not filled.',
        confirmLabel: 'Remove',
        danger: true
      });
      if (!ok) return;
      try {
        await api('/api/device-days/' + encodeURIComponent(dept) + '/' + d.date, {
          method: 'DELETE'
        });
        toast('Removed.', 'success');
      } catch (e) {
        toast(e.message, 'error');
      }
      load();
      refreshBadge();
    }
    const days = data ? data.days : [];
    const missed = days.filter(d => d.state === 'missing');
    const returned = days.filter(d => d.state === 'returned');
    const unsentN = days.filter(d => d.row && (d.row.status === 'draft' || d.row.status === 'returned')).length;
    const dirtyN = days.filter(d => dirty(d)).length;
    const todayDay = days.find(d => d.date === today);
    const curPeriod = DD.periodOf(today, cfg);
    const sumOf = f => days.reduce((a, d) => a + (d.row ? +d.row[f] || 0 : 0), 0);
    const approvedT = data ? data.approved : null;
    const maxMonth = today.slice(0, 7);
    return React.createElement("div", {
      className: "dd-wrap"
    }, React.createElement("div", {
      className: "card dd-bar"
    }, React.createElement(DeptPicker, {
      meta: meta,
      dept: dept,
      setDept: setDept
    }), React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4
      }
    }, React.createElement("button", {
      className: "dd-icon-btn",
      onClick: () => setMonth(addMonth(month, -1)),
      "aria-label": "Previous month"
    }, "\u2039"), React.createElement("input", {
      type: "month",
      className: "dd-sel",
      value: month,
      max: maxMonth,
      onChange: e => DD.isMonth(e.target.value) && e.target.value <= maxMonth && setMonth(e.target.value)
    }), React.createElement("button", {
      className: "dd-icon-btn",
      disabled: month >= maxMonth,
      onClick: () => setMonth(addMonth(month, 1)),
      "aria-label": "Next month"
    }, "\u203A")), month !== maxMonth && React.createElement("button", {
      className: "btn sm",
      onClick: () => setMonth(maxMonth)
    }, "This month"), React.createElement("span", {
      style: {
        fontSize: 11.5,
        color: 'var(--muted)'
      }
    }, "Sends ", React.createElement("b", {
      style: {
        color: 'var(--ink-2)'
      }
    }, FREQ_LABEL[cfg.frequency].toLowerCase()), cfg.frequency === 'daily' ? ' · by ' + cfg.cutoff + ' each day' : ' · by ' + cfg.cutoff + ' the day after the ' + (cfg.frequency === 'weekly' ? 'week (' + WD[cfg.weekStart] + '–' + WD[(cfg.weekStart + 6) % 7] + ')' : 'month') + ' ends'), React.createElement("span", {
      style: {
        flex: 1
      }
    }), meta.canPrint && data && React.createElement("button", {
      className: "btn sm",
      onClick: () => printSheet(deptObj, month, data)
    }, "Print sheet")), missed.length > 0 && React.createElement("div", {
      className: "dd-banner",
      role: "alert"
    }, React.createElement("span", {
      style: {
        fontSize: 16,
        lineHeight: 1
      }
    }, "\u26A0"), React.createElement("div", null, React.createElement("b", null, missed.length, " day", missed.length > 1 ? 's' : '', " missed this month."), " ", meta.canAdd ? 'Fill and send them now — click a date to go to it:' : 'Not sent by the department:', React.createElement("br", null), missed.map(d => React.createElement("button", {
      key: d.date,
      onClick: () => jump(d.date, true)
    }, DD.fmtDay(d.date))))), returned.length > 0 && React.createElement("div", {
      className: "dd-banner amber"
    }, React.createElement("span", {
      style: {
        fontSize: 16,
        lineHeight: 1
      }
    }, "\u21A9"), React.createElement("div", null, React.createElement("b", null, returned.length, " day", returned.length > 1 ? 's' : '', " returned by the reviewer."), " Correct and send again:", React.createElement("br", null), returned.map(d => React.createElement("button", {
      key: d.date,
      onClick: () => jump(d.date, true)
    }, DD.fmtDay(d.date))))), todayDay && todayDay.state === 'open' && !todayDay.row && meta.canAdd && React.createElement("div", {
      className: "dd-banner",
      style: {
        borderColor: '#a8e3da',
        background: '#ecfaf7',
        color: '#0d5e55'
      }
    }, React.createElement("span", {
      className: "dd-today-chip",
      style: {
        marginLeft: 0
      }
    }, "TODAY"), React.createElement("div", null, "Today's figures (", DD.fmtDay(today), ") are not entered yet", cfg.frequency === 'daily' ? ' — due by ' + cfg.cutoff + '.' : '. This ' + (cfg.frequency === 'weekly' ? 'week' : 'month') + ' (' + curPeriod.label + ') is sent once it ends.', ' ', React.createElement("button", {
      onClick: () => jump(today, true)
    }, "Go to today"))), React.createElement("div", {
      className: "card",
      style: {
        padding: 0,
        overflow: 'hidden'
      }
    }, React.createElement("div", {
      style: {
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        borderBottom: '1px solid var(--line-2)'
      }
    }, React.createElement("div", null, React.createElement("div", {
      style: {
        fontSize: 15,
        fontWeight: 800,
        color: 'var(--ink)'
      }
    }, "Record of Device Insertion Days"), React.createElement("div", {
      style: {
        fontSize: 12,
        color: 'var(--muted)'
      }
    }, deptObj.name, " \xB7 ", DD.fmtMonth(month))), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement(Legend, null)), err && React.createElement("div", {
      style: {
        padding: 14,
        color: 'var(--rose)'
      }
    }, err), !data && !err && React.createElement("div", {
      className: "dd-empty"
    }, "Loading\u2026"), data && React.createElement("div", {
      className: "dd-scroll",
      style: {
        maxHeight: 'calc(100vh - 290px)',
        minHeight: 260
      }
    }, React.createElement("table", {
      className: "dd-tbl"
    }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Date"), React.createElement("th", null, "Time"), F.map(f => React.createElement("th", {
      key: f.id,
      style: {
        textAlign: 'right'
      },
      title: f.label
    }, f.short)), React.createElement("th", null, "Status"), React.createElement("th", null))), React.createElement("tbody", null, days.map(d => {
      const isToday = d.date === today;
      const can = editable(d);
      const e = dirty(d) ? rowErr(d) : null;
      const st = d.row && d.row.status === 'draft' && d.state === 'open' ? 'draft' : d.state;
      const cls = 'dd-st-' + d.state + (isToday ? ' dd-today' : '') + (flash === d.date ? ' dd-flash' : '');
      return React.createElement("tr", {
        key: d.date,
        ref: el => {
          rowRefs.current[d.date] = el;
        },
        className: cls
      }, React.createElement("td", {
        className: "dd-day"
      }, React.createElement("b", null, +d.date.slice(8)), React.createElement("small", null, WD[DD.dow(d.date)]), isToday && React.createElement("span", {
        className: "dd-today-chip"
      }, "TODAY")), React.createElement("td", null, d.state === 'future' ? null : React.createElement("input", {
        type: "time",
        value: valOf(d, 'time'),
        placeholder: cfg.census,
        disabled: !can,
        onChange: ev => setVal(d.date, 'time', ev.target.value)
      })), F.map(f => React.createElement("td", {
        key: f.id,
        style: {
          textAlign: 'right'
        }
      }, d.state === 'future' ? null : React.createElement("input", {
        inputMode: "numeric",
        value: valOf(d, f.id),
        disabled: !can,
        className: badField(d, f.id) ? 'bad' : '',
        "aria-label": f.label + ' ' + DD.fmtDay(d.date),
        onChange: ev => setVal(d.date, f.id, ev.target.value.replace(/[^0-9]/g, '').slice(0, 4)),
        onKeyDown: ev => {
          if (ev.key === 'Enter' && dirty(d)) saveRow(d).then(() => refreshBadge());
        }
      }))), React.createElement("td", null, d.state !== 'future' && React.createElement(Chip, {
        s: st,
        label: d.state === 'missing' && d.row ? 'Missed · not sent' : undefined
      }), d.row && d.row.late && d.state !== 'missing' && React.createElement("span", {
        className: "dd-chip",
        style: {
          marginLeft: 4,
          background: '#fde4e8',
          color: '#a3172f'
        },
        title: "Sent after its deadline"
      }, "late"), d.state === 'missing' && React.createElement("div", {
        className: "dd-err"
      }, "Due ", DD.fmtDay(d.due.date), " ", cfg.cutoff), d.state === 'returned' && d.row && d.row.returnReason && React.createElement("div", {
        className: "dd-reason"
      }, "\u201C", d.row.returnReason, "\u201D \u2014 ", d.row.reviewedName || d.row.reviewedBy), e && React.createElement("div", {
        className: "dd-err"
      }, e)), React.createElement("td", {
        style: {
          textAlign: 'right'
        }
      }, dirty(d) && React.createElement("button", {
        className: "btn pri sm",
        disabled: !!e || !!busy,
        onClick: () => saveRow(d).then(ok => {
          if (ok) {
            toast('Saved ' + DD.fmtDay(d.date) + '.', 'success');
            refreshBadge();
          }
        })
      }, "Save"), !dirty(d) && d.row && meta.canReview && (d.row.status === 'submitted' || d.row.status === 'approved') && !unlocked[d.date] && React.createElement("button", {
        className: "dd-icon-btn",
        title: "Reviewer: correct this sent day (logged, goes back to review)",
        onClick: () => setUnlocked(x => Object.assign({}, x, {
          [d.date]: true
        }))
      }, "Correct"), !dirty(d) && unlocked[d.date] && React.createElement("button", {
        className: "dd-icon-btn",
        onClick: () => setUnlocked(x => {
          const n = Object.assign({}, x);
          delete n[d.date];
          return n;
        })
      }, "Cancel"), !dirty(d) && d.row && meta.canDelete && d.row.status !== 'approved' && React.createElement("button", {
        className: "dd-icon-btn",
        title: "Remove this day",
        onClick: () => removeRow(d)
      }, "Remove"), !dirty(d) && d.row && d.row.history && d.row.history.length > 1 && React.createElement("span", {
        title: d.row.history.slice(-5).map(h => when(h.at) + ' · ' + h.by + ' · ' + h.action + (h.changes ? ' (' + h.changes + ')' : '')).join('\n'),
        style: {
          marginLeft: 6,
          fontSize: 11,
          color: 'var(--muted)',
          cursor: 'help'
        }
      }, "history")));
    })), React.createElement("tfoot", null, React.createElement("tr", null, React.createElement("td", {
      style: {
        textAlign: 'left'
      }
    }, "Total"), React.createElement("td", {
      style: {
        textAlign: 'left',
        fontWeight: 500,
        color: 'var(--muted)',
        fontSize: 11
      }
    }, days.filter(d => d.row).length, " days"), F.map(f => React.createElement("td", {
      key: f.id
    }, sumOf(f.id))), React.createElement("td", {
      colSpan: 2,
      style: {
        textAlign: 'left',
        fontWeight: 500,
        fontSize: 11,
        color: 'var(--muted)'
      }
    }, "Approved: ", approvedT ? approvedT.days + ' days' : '—')))))), data && (meta.canAdd || meta.canReview) && (dirtyN > 0 || unsentN > 0) && React.createElement("div", {
      className: "card dd-send"
    }, React.createElement("span", {
      style: {
        fontSize: 12.5,
        color: 'var(--ink-2)'
      }
    }, dirtyN > 0 && React.createElement("b", null, dirtyN, " unsaved change", dirtyN > 1 ? 's' : '', ". "), unsentN > 0 && React.createElement("span", null, unsentN, " saved day", unsentN > 1 ? 's' : '', " not sent yet.")), React.createElement("span", {
      style: {
        flex: 1
      }
    }), dirtyN > 0 && React.createElement("button", {
      className: "btn sm",
      disabled: !!busy,
      onClick: saveAll
    }, busy === 'save' ? 'Saving…' : 'Save all'), meta.canAdd && React.createElement("button", {
      className: "btn pri sm",
      disabled: !!busy,
      onClick: send
    }, busy === 'send' ? 'Sending…' : cfg.frequency === 'daily' ? 'Send to review' : 'Send ' + (cfg.frequency === 'weekly' ? 'week' : 'month') + ' to review')));
  }
  function ReviewQueue() {
    const [q, setQ] = useState(null);
    const [err, setErr] = useState('');
    const [pick, setPick] = useState({});
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const load = () => api('/api/device-days/review').then(j => {
      setQ(j);
      setPick({});
    }).catch(e => setErr(e.message));
    useEffect(() => {
      load();
    }, []);
    if (err) return React.createElement("div", {
      className: "card",
      style: {
        color: err ? 'var(--rose)' : ''
      }
    }, err);
    if (!q) return React.createElement("div", {
      className: "card",
      style: {
        color: 'var(--muted)'
      }
    }, "Loading\u2026");
    const names = {};
    q.departments.forEach(d => {
      names[d.id] = d.name;
    });
    const groups = {};
    q.rows.forEach(r => {
      const k = r.deptId + '|' + (r.periodKey || r.date);
      (groups[k] = groups[k] || {
        dept: r.deptId,
        period: r.periodKey || r.date,
        rows: []
      }).rows.push(r);
    });
    const list = Object.values(groups).sort((a, b) => (a.rows[0].submittedAt || 0) - (b.rows[0].submittedAt || 0));
    const own = r => !q.isAdmin && r.submittedBy === q.me;
    const ids = Object.keys(pick).filter(k => pick[k]);
    const act = async (action, only) => {
      const sel = only || ids;
      if (!sel.length) return;
      if (action === 'return' && !reason.trim()) {
        toast('Write why the days are returned (box above the list).', 'error');
        return;
      }
      setBusy(true);
      try {
        const j = await api('/api/device-days/review', {
          method: 'POST',
          body: JSON.stringify({
            ids: sel,
            action,
            reason
          })
        });
        toast((action === 'approve' ? 'Approved ' : 'Returned ') + j.done + ' day(s).' + (j.skipped.length ? ' Skipped ' + j.skipped.length + ': ' + j.skipped[0] : ''), j.skipped.length ? 'warn' : 'success');
        if (action === 'return') setReason('');
      } catch (e) {
        toast(e.message, 'error');
      }
      setBusy(false);
      load();
      refreshBadge();
    };
    const periodLabel = p => /^W\d/.test(p) ? 'Week of ' + DD.fmtDay(p.slice(1)) : DD.isMonth(p) ? DD.fmtMonth(p) : DD.isDate(p) ? DD.fmtDay(p) : p;
    return React.createElement("div", {
      className: "dd-wrap"
    }, React.createElement("div", {
      className: "card dd-bar"
    }, React.createElement("b", {
      style: {
        fontSize: 14
      }
    }, q.rows.length, " day", q.rows.length === 1 ? '' : 's', " waiting for review"), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("input", {
      className: "dd-sel",
      style: {
        maxWidth: 340,
        flex: '1 1 240px'
      },
      placeholder: "Reason for returning (required to return)",
      value: reason,
      onChange: e => setReason(e.target.value)
    }), React.createElement("button", {
      className: "btn sm",
      disabled: !ids.length || busy,
      onClick: () => act('return')
    }, "Return selected"), React.createElement("button", {
      className: "btn pri sm",
      disabled: !ids.length || busy,
      onClick: () => act('approve')
    }, "Approve selected (", ids.length, ")")), !list.length && React.createElement("div", {
      className: "card dd-empty"
    }, "Nothing is waiting. Sent days appear here for approval."), list.map(g => {
      const gIds = g.rows.filter(r => !own(r)).map(r => r.id);
      const allOn = gIds.length && gIds.every(id => pick[id]);
      const t = DD.totals(g.rows);
      return React.createElement("div", {
        key: g.dept + g.period,
        className: "card",
        style: {
          padding: 0,
          overflow: 'hidden'
        }
      }, React.createElement("div", {
        style: {
          padding: '10px 14px',
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
          borderBottom: '1px solid var(--line-2)'
        }
      }, React.createElement("input", {
        type: "checkbox",
        checked: !!allOn,
        disabled: !gIds.length,
        onChange: () => setPick(p => {
          const n = Object.assign({}, p);
          gIds.forEach(id => {
            n[id] = !allOn;
          });
          return n;
        })
      }), React.createElement("b", null, names[g.dept] || g.dept), React.createElement("span", {
        style: {
          color: 'var(--muted)',
          fontSize: 12
        }
      }, periodLabel(g.period), " \xB7 sent by ", g.rows[0].submittedName || g.rows[0].submittedBy, " \xB7 ", when(g.rows[0].submittedAt)), React.createElement("span", {
        style: {
          flex: 1
        }
      }), React.createElement("button", {
        className: "btn pri sm",
        disabled: !gIds.length || busy,
        onClick: () => act('approve', gIds)
      }, "Approve ", gIds.length, " day", gIds.length === 1 ? '' : 's')), React.createElement("div", {
        className: "dd-scroll"
      }, React.createElement("table", {
        className: "dd-tbl"
      }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null), React.createElement("th", null, "Date"), React.createElement("th", null, "Time"), F.map(f => React.createElement("th", {
        key: f.id,
        style: {
          textAlign: 'right'
        }
      }, f.short)), React.createElement("th", null, "Notes"))), React.createElement("tbody", null, g.rows.map(r => {
        const corr = (r.history || []).filter(h => h.action === 'correct' || h.action === 'edit').slice(-1)[0];
        return React.createElement("tr", {
          key: r.id
        }, React.createElement("td", null, React.createElement("input", {
          type: "checkbox",
          disabled: own(r),
          checked: !!pick[r.id],
          onChange: () => setPick(p => Object.assign({}, p, {
            [r.id]: !p[r.id]
          }))
        })), React.createElement("td", {
          className: "dd-day"
        }, React.createElement("b", null, +r.date.slice(8)), React.createElement("small", null, WD[DD.dow(r.date)], " ", DD.MONS[+r.date.slice(5, 7) - 1])), React.createElement("td", null, r.time), F.map(f => React.createElement("td", {
          key: f.id,
          style: {
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums'
          }
        }, r[f.id])), React.createElement("td", {
          style: {
            whiteSpace: 'normal',
            fontSize: 11.5,
            color: 'var(--muted)'
          }
        }, r.late && React.createElement("span", {
          className: "dd-chip missing",
          style: {
            marginRight: 4
          }
        }, "late"), own(r) && React.createElement("span", null, "You sent this \u2014 another reviewer must approve it. "), corr && React.createElement("span", {
          title: when(corr.at)
        }, "Changed by ", corr.by, ": ", corr.changes)));
      })), React.createElement("tfoot", null, React.createElement("tr", null, React.createElement("td", null), React.createElement("td", {
        style: {
          textAlign: 'left'
        }
      }, "Total"), React.createElement("td", null), F.map(f => React.createElement("td", {
        key: f.id
      }, t[f.id])), React.createElement("td", null))))));
    }));
  }
  function Summary() {
    const [meta, metaErr] = useMeta();
    const now = DD.hospitalNow().date.slice(0, 7);
    const [from, setFrom] = useState(now.slice(0, 4) + '-01');
    const [to, setTo] = useState(now);
    const [deptF, setDeptF] = useState('');
    const [s, setS] = useState(null);
    const [err, setErr] = useState('');
    const [metric, setMetric] = useState('central');
    useEffect(() => {
      setS(null);
      setErr('');
      api('/api/device-days/summary?from=' + from + '&to=' + to + (deptF ? '&dept=' + encodeURIComponent(deptF) : '')).then(setS).catch(e => setErr(e.message));
    }, [from, to, deptF]);
    if (metaErr) return React.createElement("div", {
      className: "card",
      style: {
        color: 'var(--rose)'
      }
    }, metaErr);
    if (!meta) return React.createElement("div", {
      className: "card",
      style: {
        color: 'var(--muted)'
      }
    }, "Loading\u2026");
    if (!meta.departments.length) return React.createElement(NoDepts, {
      meta: meta
    });
    const grand = {
      days: 0
    };
    F.forEach(f => {
      grand[f.id] = 0;
    });
    let missing = 0,
      waiting = 0;
    (s ? s.departments : []).forEach(d => d.months.forEach(m => {
      grand.days += m.approved.days;
      F.forEach(f => {
        grand[f.id] += m.approved[f.id];
      });
      missing += m.missing;
      waiting += m.submitted;
    }));
    const series = s ? s.months.map(ym => ({
      mon: DD.MONS[+ym.slice(5) - 1],
      v: s.departments.reduce((a, d) => a + ((d.months.find(m => m.month === ym) || {
        approved: {}
      }).approved[metric] || 0), 0)
    })) : [];
    const mf = F.find(f => f.id === metric);
    return React.createElement("div", {
      className: "dd-wrap"
    }, React.createElement("div", {
      className: "card dd-bar"
    }, React.createElement("span", {
      style: {
        fontSize: 12,
        color: 'var(--muted)'
      }
    }, "From"), React.createElement("input", {
      type: "month",
      className: "dd-sel",
      value: from,
      max: to,
      onChange: e => DD.isMonth(e.target.value) && setFrom(e.target.value)
    }), React.createElement("span", {
      style: {
        fontSize: 12,
        color: 'var(--muted)'
      }
    }, "to"), React.createElement("input", {
      type: "month",
      className: "dd-sel",
      value: to,
      min: from,
      max: now,
      onChange: e => DD.isMonth(e.target.value) && setTo(e.target.value)
    }), meta.departments.length > 1 && React.createElement("select", {
      className: "dd-sel",
      value: deptF,
      onChange: e => setDeptF(e.target.value)
    }, React.createElement("option", {
      value: ""
    }, "All my departments"), meta.departments.map(d => React.createElement("option", {
      key: d.id,
      value: d.id
    }, d.name))), React.createElement("span", {
      style: {
        flex: 1
      }
    }), meta.canPrint && s && React.createElement("button", {
      className: "btn sm",
      onClick: () => printSummary(s, deptF ? (meta.departments.find(d => d.id === deptF) || {}).name : 'All departments')
    }, "Print summary")), err && React.createElement("div", {
      className: "card",
      style: {
        color: 'var(--rose)'
      }
    }, err), !s && !err && React.createElement("div", {
      className: "card dd-empty"
    }, "Loading\u2026"), s && React.createElement(React.Fragment, null, React.createElement("div", {
      className: "dd-kpis"
    }, React.createElement("div", {
      className: "card dd-kpi"
    }, React.createElement("span", null, "Patient days"), React.createElement("b", null, grand.total), React.createElement("small", null, grand.days, " approved day-records")), DD.DEVICES.map(k => {
      const f = F.find(x => x.id === k);
      const u = DD.utilisation(grand, k);
      return React.createElement("div", {
        key: k,
        className: "card dd-kpi"
      }, React.createElement("span", null, f.short, " days"), React.createElement("b", null, grand[k]), React.createElement("small", null, u == null ? '—' : u + '% utilisation'));
    }), React.createElement("div", {
      className: "card dd-kpi",
      style: {
        borderColor: missing ? '#f3c2cb' : undefined
      }
    }, React.createElement("span", null, "Missed days"), React.createElement("b", {
      style: {
        color: missing ? 'var(--rose)' : undefined
      }
    }, missing), React.createElement("small", null, waiting, " waiting for review"))), React.createElement("div", {
      className: "card",
      style: {
        padding: '14px 16px'
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        marginBottom: 8
      }
    }, React.createElement("b", {
      style: {
        fontSize: 13
      }
    }, mf.short, " days by month (approved)"), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("select", {
      className: "dd-sel",
      value: metric,
      onChange: e => setMetric(e.target.value)
    }, F.map(f => React.createElement("option", {
      key: f.id,
      value: f.id
    }, f.id === 'total' ? 'Patient days' : f.short + ' days')))), typeof window.BarChart === 'function' && series.some(x => x.v > 0) ? React.createElement(window.BarChart, {
      data: series,
      x: 'mon',
      y: 'v',
      height: 220,
      label: 'dd' + metric
    }) : React.createElement("div", {
      className: "dd-empty"
    }, "No approved figures in this period yet.")), React.createElement("div", {
      className: "card",
      style: {
        padding: 0,
        overflow: 'hidden'
      }
    }, React.createElement("div", {
      className: "dd-scroll"
    }, React.createElement("table", {
      className: "dd-tbl"
    }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Department"), React.createElement("th", null, "Month"), React.createElement("th", null, "Sends"), F.map(f => React.createElement("th", {
      key: f.id,
      style: {
        textAlign: 'right'
      }
    }, f.id === 'total' ? 'Patient days' : f.short)), React.createElement("th", {
      style: {
        textAlign: 'right'
      }
    }, "CL util."), React.createElement("th", null, "Days (approved / due)"), React.createElement("th", null, "Calendar"))), React.createElement("tbody", null, s.departments.map(d => d.months.filter(m => m.due || m.approved.days || m.submitted || m.returned).reverse().map((m, i) => React.createElement("tr", {
      key: d.id + m.month
    }, React.createElement("td", null, i === 0 ? React.createElement("b", null, d.name) : ''), React.createElement("td", null, DD.fmtMonth(m.month)), React.createElement("td", {
      style: {
        color: 'var(--muted)',
        fontSize: 11.5
      }
    }, i === 0 ? FREQ_LABEL[d.frequency] : ''), F.map(f => React.createElement("td", {
      key: f.id,
      style: {
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums'
      }
    }, m.approved.days ? m.approved[f.id] : '—')), React.createElement("td", {
      style: {
        textAlign: 'right'
      }
    }, DD.utilisation(m.approved, 'central') == null ? '—' : DD.utilisation(m.approved, 'central') + '%'), React.createElement("td", null, m.approved.days, " / ", m.due, m.missing > 0 && React.createElement("span", {
      className: "dd-chip missing",
      style: {
        marginLeft: 6
      }
    }, m.missing, " missed"), m.submitted > 0 && React.createElement("span", {
      className: "dd-chip submitted",
      style: {
        marginLeft: 4
      }
    }, m.submitted, " waiting")), React.createElement("td", null, React.createElement("div", {
      className: "dd-strip",
      title: "Each square is one day"
    }, m.strip.map((st, k) => React.createElement("i", {
      key: k,
      title: k + 1 + ': ' + (STATE_LABEL[st] || st),
      style: {
        background: STRIP_COLOR[st] || '#eef2f6'
      }
    })))))))))), React.createElement("div", {
      style: {
        padding: '8px 14px',
        fontSize: 11,
        color: 'var(--muted)',
        borderTop: '1px solid var(--line-2)'
      }
    }, "Totals count approved days only. Utilisation = device days \xF7 patient days. ", React.createElement(Legend, null)))));
  }
  function Settings() {
    const [list, setList] = useState(null);
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const [filter, setFilter] = useState('');
    const [changed, setChanged] = useState({});
    const load = () => api('/api/device-days/config').then(j => {
      setList(j.departments);
      setChanged({});
    }).catch(e => setErr(e.message));
    useEffect(() => {
      load();
    }, []);
    if (err) return React.createElement("div", {
      className: "card",
      style: {
        color: 'var(--rose)'
      }
    }, err);
    if (!list) return React.createElement("div", {
      className: "card",
      style: {
        color: 'var(--muted)'
      }
    }, "Loading\u2026");
    const set = (id, k, v) => {
      setList(l => l.map(d => d.id === id ? Object.assign({}, d, {
        cfg: Object.assign({}, d.cfg, {
          [k]: v
        })
      }) : d));
      setChanged(c => Object.assign({}, c, {
        [id]: true
      }));
    };
    const save = async () => {
      const depts = {};
      list.filter(d => changed[d.id]).forEach(d => {
        depts[d.id] = d.cfg;
      });
      if (!Object.keys(depts).length) return;
      setBusy(true);
      try {
        const j = await api('/api/device-days/config', {
          method: 'PUT',
          body: JSON.stringify({
            depts
          })
        });
        toast(j.changed + ' department setting(s) saved.', 'success');
        load();
        refreshBadge();
      } catch (e) {
        toast(e.message, 'error');
      }
      setBusy(false);
    };
    const shown = list.filter(d => !filter || d.name.toLowerCase().indexOf(filter.toLowerCase()) >= 0);
    const n = Object.keys(changed).length;
    return React.createElement("div", {
      className: "dd-wrap"
    }, React.createElement("div", {
      className: "card",
      style: {
        padding: '12px 14px',
        fontSize: 12.5,
        color: 'var(--ink-2)'
      }
    }, "Tick the departments that keep the ", React.createElement("b", null, "Record of Device Insertion Days"), ". Each fills one row per day; ", React.createElement("b", null, "how often they send"), " decides when a day counts as missed: daily \u2014 that day by the cut-off time; weekly \u2014 the day after the week ends; monthly \u2014 the day after the month ends. Days before the ", React.createElement("b", null, "start date"), " are never counted as missed. Who may enter, review or print is set per person in Access Control \u2192 Device Days."), React.createElement("div", {
      className: "card dd-bar"
    }, React.createElement("input", {
      className: "dd-sel",
      placeholder: "Search departments",
      value: filter,
      onChange: e => setFilter(e.target.value)
    }), React.createElement("span", {
      style: {
        fontSize: 12,
        color: 'var(--muted)'
      }
    }, list.filter(d => d.cfg.tracked).length, " tracked"), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("button", {
      className: "btn pri sm",
      disabled: !n || busy,
      onClick: save
    }, busy ? 'Saving…' : 'Save' + (n ? ' (' + n + ')' : ''))), React.createElement("div", {
      className: "card",
      style: {
        padding: 0,
        overflow: 'hidden'
      }
    }, React.createElement("div", {
      className: "dd-scroll"
    }, React.createElement("table", {
      className: "dd-tbl"
    }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Tracked"), React.createElement("th", null, "Department"), React.createElement("th", null, "Sends"), React.createElement("th", null, "Week starts"), React.createElement("th", null, "Start date"), React.createElement("th", null, "Census time"), React.createElement("th", null, "Cut-off"))), React.createElement("tbody", null, shown.map(d => React.createElement("tr", {
      key: d.id,
      className: d.cfg.tracked ? 'dd-st-approved' : ''
    }, React.createElement("td", null, React.createElement("input", {
      type: "checkbox",
      style: {
        width: 'auto'
      },
      checked: !!d.cfg.tracked,
      onChange: e => set(d.id, 'tracked', e.target.checked)
    })), React.createElement("td", null, React.createElement("b", null, d.name), changed[d.id] && React.createElement("span", {
      className: "dd-chip returned",
      style: {
        marginLeft: 6
      }
    }, "unsaved")), React.createElement("td", null, React.createElement("select", {
      className: "dd-sel",
      disabled: !d.cfg.tracked,
      value: d.cfg.frequency,
      onChange: e => set(d.id, 'frequency', e.target.value)
    }, DD.FREQS.map(f => React.createElement("option", {
      key: f,
      value: f
    }, FREQ_LABEL[f])))), React.createElement("td", null, React.createElement("select", {
      className: "dd-sel",
      disabled: !d.cfg.tracked || d.cfg.frequency !== 'weekly',
      value: d.cfg.weekStart,
      onChange: e => set(d.id, 'weekStart', +e.target.value)
    }, WD.map((w, i) => React.createElement("option", {
      key: i,
      value: i
    }, w)))), React.createElement("td", null, React.createElement("input", {
      type: "date",
      style: {
        width: 140,
        textAlign: 'left'
      },
      disabled: !d.cfg.tracked,
      value: d.cfg.startDate || '',
      onChange: e => set(d.id, 'startDate', e.target.value)
    })), React.createElement("td", null, React.createElement("input", {
      type: "time",
      disabled: !d.cfg.tracked,
      value: d.cfg.census || '08:00',
      onChange: e => set(d.id, 'census', e.target.value)
    })), React.createElement("td", null, React.createElement("input", {
      type: "time",
      disabled: !d.cfg.tracked,
      value: d.cfg.cutoff || '10:00',
      onChange: e => set(d.id, 'cutoff', e.target.value)
    })))))))));
  }
  const me = () => window.__UNICO_USER__ && (window.__UNICO_USER__.name || window.__UNICO_USER__.username) || '';
  const sigNames = () => {
    try {
      return window.unicoSig ? window.unicoSig.load() : {};
    } catch (e) {
      return {};
    }
  };
  const PRINT_CSS = '' + '*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}' + 'body{font:10pt/1.4 "Segoe UI",Arial,sans-serif;color:#16202e;margin:0;padding:18px}@media print{body{padding:0}}' + '.lh{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;padding-bottom:10px;border-bottom:1px solid #d9e2ec}.lh img{height:42px}' + '.lh .tt{text-align:right}.lh .kind{font-size:7.5pt;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#0072a3}.lh h1{margin:3px 0 0;font-size:16pt;color:#0d1b2e}' + '.bar{height:3px;background:linear-gradient(90deg,#0072a3,#27a8db 55%,#3ab5a7)}' + '.hd{display:flex;justify-content:space-between;gap:20px;margin:12px 0 8px;font-size:11pt}.hd b{border-bottom:1px solid #16202e;padding:0 30px 1px 4px;font-weight:600}' + 'table{border-collapse:collapse;width:100%;font-size:9pt;font-variant-numeric:tabular-nums}thead{display:table-header-group}tr{page-break-inside:avoid}' + 'th{background:#0d3a5c;color:#fff;font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.4px;padding:6px 6px;border:1px solid #0d3a5c;text-align:center}' + 'td{padding:4px 6px;border:1px solid #c9d3de;text-align:center;height:19px}td.l{text-align:left}td:first-child{white-space:nowrap}' + 'tr.ms td{background:#fdf0f2}tr.rt td{background:#fff8e9}tfoot td{font-weight:700;background:#e6f1f8;border-top:1.5px solid #0072a3}' + '.st{font-size:7pt;color:#5b6878}.note{margin:6px 0 0;font-size:7.5pt;color:#7b8796}' + '.signs{display:grid;grid-template-columns:repeat(3,1fr);gap:30px;margin-top:34px;font-size:8.5pt}.signs div{border-top:1px solid #16202e;padding-top:4px}.signs span{display:block;font-size:7pt;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#7b8796}' + '.end{margin-top:16px;padding-top:6px;border-top:1px solid #e3e9f0;display:flex;justify-content:space-between;font-size:7.5pt;color:#7b8796}.cr{margin-top:5px;text-align:center;font-size:6.5px;color:#a3adba}';
  function letterhead(kind, title) {
    return '<header class="lh"><img src="' + esc(location.origin + '/unico/logo.svg') + '" alt="UNICO Hospitals"><div class="tt"><div class="kind">' + esc(kind) + '</div><h1>' + esc(title) + '</h1></div></header><div class="bar"></div>';
  }
  function closing() {
    const at = new Date().toLocaleString('en-GB', {
      timeZone: 'Asia/Dhaka',
      dateStyle: 'medium',
      timeStyle: 'short'
    });
    const sig = sigNames();
    return '<div class="signs"><div><span>Prepared by</span>' + esc(sig.prepared || '') + '</div><div><span>Checked by (In-charge)</span>' + esc(sig.reviewed || '') + '</div><div><span>Infection Control</span>' + esc(sig.approved || '') + '</div></div>' + '<div class="end"><span>Printed by ' + esc(me() || '—') + ' on ' + esc(at) + ' from UNICO.</span><span>Approved figures are final; others are as entered.</span></div>' + '<div class="cr">Automatically generated by the system · Developed by Nasif Ahammed Niloy</div>';
  }
  async function openPrint(body, title, html) {
    const w = window.open('', '_blank');
    try {
      await api('/api/device-days/print', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      if (!w) {
        toast('Allow pop-ups for this site to print.', 'error');
        return;
      }
      w.document.open();
      w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' + html.css + '</style></head><body>' + html.body + '<script>window.onload=function(){setTimeout(function(){window.print();},150);};<\/script></body></html>');
      w.document.close();
    } catch (e) {
      if (w) w.close();
      toast(e.message, 'error');
    }
  }
  function printSheet(dept, month, data) {
    const rows = data.days.map(d => {
      const r = d.row;
      const cls = d.state === 'missing' ? 'ms' : d.state === 'returned' ? 'rt' : '';
      return '<tr class="' + cls + '"><td>' + esc(DD.fmtDay(d.date)) + '</td><td>' + esc(r ? r.time : '') + '</td>' + F.map(f => '<td>' + esc(r ? r[f.id] : '') + '</td>').join('') + '<td class="st">' + esc(d.state === 'future' ? '' : STATE_LABEL[d.state] || '') + '</td></tr>';
    }).join('');
    const t = DD.totals(data.days.map(d => d.row).filter(Boolean));
    const body = letterhead('Infection Prevention & Control', 'Record of Device Insertion Days') + '<div class="hd"><span>Department: <b>' + esc(dept.name) + '</b></span><span>Month: <b>' + esc(DD.fmtMonth(month)) + '</b></span></div>' + '<table><thead><tr><th>Date</th><th>Time</th>' + F.map(f => '<th>' + esc(f.label.replace('Patients with ', 'Total Patients with ')) + '</th>').join('') + '<th>Status</th></tr></thead><tbody>' + rows + '</tbody>' + '<tfoot><tr><td>Total</td><td></td>' + F.map(f => '<td>' + t[f.id] + '</td>').join('') + '<td class="st">' + t.days + ' days</td></tr></tfoot></table>' + '<p class="note">Missed days are shaded red, returned days amber. Device utilisation: central line ' + (DD.utilisation(t, 'central') == null ? '—' : DD.utilisation(t, 'central') + '%') + ', urinary catheter ' + (DD.utilisation(t, 'urinary') == null ? '—' : DD.utilisation(t, 'urinary') + '%') + ', ventilator ' + (DD.utilisation(t, 'ventilator') == null ? '—' : DD.utilisation(t, 'ventilator') + '%') + '.</p>' + closing();
    openPrint({
      kind: 'sheet',
      dept: dept.id,
      month
    }, dept.name + ' — Device Insertion Days ' + DD.fmtMonth(month), {
      css: '@page{size:A4 portrait;margin:12mm}' + PRINT_CSS,
      body
    });
  }
  function printSummary(s, scope) {
    const rows = s.departments.map(d => d.months.map((m, i) => '<tr><td class="l">' + (i === 0 ? '<b>' + esc(d.name) + '</b>' : '') + '</td><td class="l">' + esc(DD.fmtMonth(m.month)) + '</td>' + F.map(f => '<td>' + (m.approved.days ? m.approved[f.id] : '—') + '</td>').join('') + '<td>' + (DD.utilisation(m.approved, 'central') == null ? '—' : DD.utilisation(m.approved, 'central') + '%') + '</td><td>' + m.approved.days + ' / ' + m.due + '</td><td>' + (m.missing || '') + '</td></tr>').join('')).join('');
    const body = letterhead('Infection Prevention & Control', 'Device Days Summary') + '<div class="hd"><span>Scope: <b>' + esc(scope) + '</b></span><span>Period: <b>' + esc(DD.fmtMonth(s.from) + ' – ' + DD.fmtMonth(s.to)) + '</b></span></div>' + '<table><thead><tr><th>Department</th><th>Month</th>' + F.map(f => '<th>' + (f.id === 'total' ? 'Patient days' : esc(f.short) + ' days') + '</th>').join('') + '<th>CL util.</th><th>Approved / due</th><th>Missed</th></tr></thead><tbody>' + rows + '</tbody></table>' + '<p class="note">Approved days only. Utilisation = device days ÷ patient days.</p>' + closing();
    openPrint({
      kind: 'summary',
      from: s.from,
      to: s.to
    }, 'Device Days Summary ' + s.from + ' – ' + s.to, {
      css: '@page{size:A4 landscape;margin:12mm}' + PRINT_CSS,
      body
    });
  }
  function DeviceDaysView({
    view,
    dept,
    month,
    setRoute
  }) {
    useStyles();
    const canReview = !window.unicoCan || window.unicoCan('devdays', 'edit');
    const isAdmin = !window.unicoUserPerms || window.unicoUserPerms() === null;
    if (view === 'devDaysReview') return canReview ? React.createElement(ReviewQueue, null) : React.createElement("div", {
      className: "card dd-empty"
    }, "Reviewing needs the Device Days \u201CEdit\u201D permission. Ask the administrator.");
    if (view === 'devDaysSummary') return React.createElement(Summary, null);
    if (view === 'devDaysSettings') return isAdmin ? React.createElement(Settings, null) : React.createElement("div", {
      className: "card dd-empty"
    }, "Only an administrator can change Device Days settings.");
    return React.createElement(EntrySheet, {
      initialDept: dept,
      initialMonth: month
    });
  }
  window.DeviceDaysView = DeviceDaysView;
})();
})();
